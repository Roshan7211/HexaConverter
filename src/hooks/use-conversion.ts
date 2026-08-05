'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import { createJob, getJob, cancelJob } from '@/api/client/jobs.client';
import { uploadFile } from '@/api/client/uploads.client';

import {
  ACCEPTED_INPUT_EXTENSIONS,
  getFormat,
  resolveFormatId,
  targetsFor,
} from '@/services/conversion/registry';
import type { ConversionOptions } from '@/types/conversion';
import { fileExtension } from '@/utils';

/**
 * Client-side conversion workflow.
 *
 * Files are uploaded one at a time over XHR (the only API that reports upload
 * progress), each upload returns a signed ticket, and tickets are exchanged for
 * jobs which are then polled until they reach a terminal state. All of the
 * state a converter screen needs is derived here so the components stay
 * presentational.
 */

export type ItemStatus =
  | 'pending'
  | 'uploading'
  | 'ready'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  /**
   * Folded into another item's combined output. Terminal, and deliberately not
   * downloadable on its own — the single PDF is the result, and offering a
   * download per contributing image would imply otherwise.
   */
  | 'merged';

export interface TargetOption {
  id: string;
  label: string;
}

export interface ConversionItem {
  localId: string;
  name: string;
  size: number;
  /**
   * Blob URL for the file the user picked, so a thumbnail can be shown without
   * a round trip. Revoked when the item is removed.
   */
  previewUrl: string | null;
  status: ItemStatus;
  /** 0–100. Covers upload during `uploading` and conversion afterwards. */
  progress: number;
  error: string | null;
  sourceFormat: string | null;
  targets: TargetOption[];
  ticket: string | null;
  jobId: string | null;
  outputName: string | null;
  outputSize: number | null;
  downloadUrl: string | null;
  durationMs: number | null;
  /**
   * On the item that owns a combined job: how many images went into the PDF.
   * Null on every other item, including the ones folded into it.
   */
  combinedCount: number | null;
}

const POLL_INTERVAL_MS = 1_500;

/**
 * Consecutive failed polls before a conversion is declared lost.
 *
 * Twelve ticks is eighteen seconds — long enough that a flaky connection or a
 * server restart recovers on its own, short enough that nobody sits watching a
 * spinner that will never move.
 */
const MAX_POLL_FAILURES = 12;
const TERMINAL: ReadonlySet<ItemStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
  'merged',
]);

/**
 * Whether this selection can become one PDF.
 *
 * Requires at least two files, a PDF target, and a single shared source format
 * — the job records one format pair, so a mixed batch has to go through the
 * per-file path. The server enforces all three again.
 */
function canCombine(
  ready: readonly ConversionItem[],
  targetFormat: string,
): boolean {
  if (ready.length < 2 || targetFormat !== 'pdf') return false;

  const first = ready[0]?.sourceFormat;
  if (!first || getFormat(first)?.category !== 'image') return false;

  return ready.every((item) => item.sourceFormat === first);
}

/**
 * Source formats the browser can render or play from a blob URL, so a preview
 * is available before anything is uploaded.
 */
const PREVIEWABLE = new Set([
  'png',
  'jpg',
  'webp',
  'gif',
  'svg',
  'avif',
  'bmp',
  'mp4',
  'webm',
  'mov',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'opus',
  'aac',
  'flac',
]);

let counter = 0;
function nextId() {
  counter += 1;
  return `item-${Date.now().toString(36)}-${counter}`;
}

export interface UseConversionOptions {
  /** Restricts accepted uploads, e.g. to a single category page. */
  allowedSourceFormats?: readonly string[];
  /** Preselects an output format, used by the per-route landing pages. */
  initialTarget?: string;
  maxFiles: number;
  maxFileBytes: number;
}

export function useConversion({
  allowedSourceFormats,
  initialTarget,
  maxFiles,
  maxFileBytes,
}: UseConversionOptions) {
  const [items, setItems] = useState<ConversionItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>(initialTarget ?? '');
  const [options, setOptions] = useState<ConversionOptions>({});
  const [isConverting, setIsConverting] = useState(false);
  // Defaults on: someone who selects five photographs and picks PDF almost
  // always wants one five-page document, not five one-page files.
  const [combinePdf, setCombinePdf] = useState(true);

  const uploadsRef = useRef(new Map<string, { abort: () => void }>());
  /**
   * The picked `File` objects, kept so a failed upload can be retried without
   * making the user find the file again. Dropped when the item is removed.
   */
  const filesRef = useRef(new Map<string, File>());
  const itemsRef = useRef<ConversionItem[]>([]);
  itemsRef.current = items;

  const patch = useCallback(
    (localId: string, changes: Partial<ConversionItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.localId === localId ? { ...item, ...changes } : item,
        ),
      );
    },
    [],
  );

  // --- Adding files -------------------------------------------------------

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      const accepted: Array<{ item: ConversionItem; file: File }> = [];
      const remaining = maxFiles - itemsRef.current.length;

      if (remaining <= 0) {
        toast.error(
          `You can convert ${maxFiles} files at a time on your plan.`,
        );
        return;
      }

      for (const file of list.slice(0, remaining)) {
        const extension = fileExtension(file.name);
        const sourceFormat = resolveFormatId(extension);

        if (
          !extension ||
          !sourceFormat ||
          !ACCEPTED_INPUT_EXTENSIONS.includes(extension)
        ) {
          toast.error(`${file.name} is not a supported file type.`);
          continue;
        }
        if (
          allowedSourceFormats &&
          !allowedSourceFormats.includes(sourceFormat)
        ) {
          toast.error(`${file.name} does not belong to this converter.`);
          continue;
        }
        if (file.size === 0) {
          toast.error(`${file.name} is empty.`);
          continue;
        }
        if (file.size > maxFileBytes) {
          toast.error(
            `${file.name} is larger than your ${formatMb(maxFileBytes)} upload limit.`,
          );
          continue;
        }

        accepted.push({
          file,
          item: {
            localId: nextId(),
            name: file.name,
            size: file.size,
            previewUrl:
              // Images, audio and video can all be previewed locally. Anything
              // else (documents, archives) has no in-browser player.
              PREVIEWABLE.has(sourceFormat) ? URL.createObjectURL(file) : null,
            status: 'pending',
            progress: 0,
            error: null,
            sourceFormat,
            targets: targetsFor(sourceFormat).map((format) => ({
              id: format.id,
              label: format.label,
            })),
            ticket: null,
            jobId: null,
            outputName: null,
            outputSize: null,
            downloadUrl: null,
            durationMs: null,
            combinedCount: null,
          },
        });
      }

      if (list.length > remaining) {
        toast.error(
          `Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added.`,
        );
      }
      if (accepted.length === 0) return;

      setItems((current) => [
        ...current,
        ...accepted.map((entry) => entry.item),
      ]);

      // Uploads run sequentially so a large batch cannot saturate the
      // connection or the server's request limit.
      for (const entry of accepted) {
        filesRef.current.set(entry.item.localId, entry.file);
      }

      void (async () => {
        for (const entry of accepted) {
          await upload(entry.item.localId, entry.file);
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedSourceFormats, maxFileBytes, maxFiles],
  );

  const upload = useCallback(
    async (localId: string, file: File) => {
      patch(localId, { status: 'uploading', progress: 0, error: null });

      const handle = uploadFile(file, (progress) =>
        patch(localId, { progress }),
      );
      uploadsRef.current.set(localId, handle);

      try {
        const payload = await handle.promise;
        patch(localId, {
          status: 'ready',
          progress: 100,
          ticket: payload.ticket,
          sourceFormat: payload.file.sourceFormat,
          targets: payload.targets,
        });
      } catch (error) {
        // An aborted upload was removed by the user; say nothing.
        if (error instanceof DOMException && error.name === 'AbortError')
          return;

        const message =
          error instanceof Error ? error.message : 'The upload failed.';
        patch(localId, { status: 'failed', error: message });
        toast.error(message);
      } finally {
        uploadsRef.current.delete(localId);
      }
    },
    [patch],
  );

  /**
   * Re-uploads a file whose upload failed.
   *
   * Distinct from retrying a conversion: this one starts the transfer over,
   * which is the only recovery when the bytes never arrived. Large files go
   * back through the chunked path, so a retry after a dropped connection
   * re-sends only what is missing.
   */
  const retryUpload = useCallback(
    (localId: string) => {
      const file = filesRef.current.get(localId);
      if (!file) {
        toast.error('That file is no longer available. Add it again.');
        return;
      }
      void upload(localId, file);
    },
    [upload],
  );

  // --- Conversion ---------------------------------------------------------

  const convert = useCallback(async () => {
    const ready = itemsRef.current.filter(
      (item) => item.status === 'ready' && item.ticket,
    );
    if (ready.length === 0 || !targetFormat) return;

    setIsConverting(true);

    // Several images going to PDF become one document with a page each, which
    // is almost always what was wanted — a receipt scanned across four photos
    // is one receipt. One job, not four, so it also costs a quarter of the
    // allowance. Unticking the option falls through to the per-file loop below.
    if (canCombine(ready, targetFormat) && combinePdf) {
      const [first, ...rest] = ready as [ConversionItem, ...ConversionItem[]];

      for (const item of ready) {
        patch(item.localId, { status: 'queued', progress: 0, error: null });
      }

      try {
        const job = await createJob({
          ticket: first.ticket!,
          extraTickets: rest.map((item) => item.ticket!),
          targetFormat,
          options,
        });

        patch(first.localId, {
          jobId: job.id,
          status: 'queued',
          progress: job.progress,
          combinedCount: ready.length,
        });

        // The contributing files have no separate result to report. Marking
        // them terminal keeps them out of the polling set, so one job is
        // polled once rather than once per contributing file. They still carry
        // the job id, so if it fails they can be corrected rather than left
        // claiming they were added to a PDF that does not exist.
        for (const item of rest) {
          patch(item.localId, {
            status: 'merged',
            progress: 100,
            jobId: job.id,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'The conversion could not be started.';
        for (const item of ready) {
          patch(item.localId, { status: 'failed', error: message });
        }
        toast.error(message);
      }

      setIsConverting(false);
      return;
    }

    for (const item of ready) {
      patch(item.localId, { status: 'queued', progress: 0, error: null });

      try {
        const job = await createJob({
          ticket: item.ticket!,
          targetFormat,
          options,
        });

        patch(item.localId, {
          jobId: job.id,
          status: 'queued',
          progress: job.progress,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'The conversion could not be started.';
        patch(item.localId, { status: 'failed', error: message });
        toast.error(message);
      }
    }

    setIsConverting(false);
  }, [combinePdf, options, patch, targetFormat]);

  // --- Polling ------------------------------------------------------------

  /**
   * Key identifying which jobs are in flight. The polling effect depends on
   * this rather than on `items`, so a progress update does not tear down and
   * restart the interval on every tick.
   */
  /** Consecutive failed polls per job, so a persistent fault stops being silent. */
  const pollFailures = useRef(new Map<string, number>());

  const activeJobKey = items
    .filter(
      (item) =>
        item.jobId &&
        (item.status === 'queued' || item.status === 'processing'),
    )
    .map((item) => item.jobId)
    .join(',');

  useEffect(() => {
    if (!activeJobKey) return;

    let cancelled = false;

    const timer = setInterval(async () => {
      // Read the latest snapshot each tick; the effect itself never restarts.
      const active = itemsRef.current.filter(
        (item) =>
          item.jobId &&
          (item.status === 'queued' || item.status === 'processing'),
      );

      await Promise.all(
        active.map(async (item) => {
          try {
            const job = await getJob(item.jobId!);
            if (cancelled) return;

            const status = job.status.toLowerCase() as ItemStatus;

            patch(item.localId, {
              status,
              progress: job.progress,
              error: job.error,
              outputName: job.outputName,
              outputSize: job.outputSize,
              downloadUrl: job.downloadUrl,
              durationMs: job.durationMs,
            });

            // A combined job that did not produce a PDF invalidates the rows
            // folded into it: leaving them as "added to the PDF" would describe
            // an output nobody has.
            if (
              item.combinedCount &&
              (status === 'failed' || status === 'cancelled')
            ) {
              for (const sibling of itemsRef.current) {
                if (
                  sibling.localId !== item.localId &&
                  sibling.jobId === item.jobId &&
                  sibling.status === 'merged'
                ) {
                  patch(sibling.localId, {
                    status,
                    progress: 0,
                    error: job.error,
                  });
                }
              }
            }

            if (status === 'completed') {
              toast.success(
                item.combinedCount
                  ? `${item.combinedCount} images combined into one PDF.`
                  : `${item.name} converted successfully.`,
              );
            } else if (status === 'failed' && job.error) {
              toast.error(job.error);
            }
            pollFailures.current.delete(item.jobId!);
          } catch {
            // A tick failing is usually a blip, so retry quietly. Failing over
            // and over is not a blip, and treating it as one is how a job whose
            // status endpoint answered 404 forever sat at "Queued" until the
            // visitor gave up — the conversion had finished and nobody could
            // tell. After enough consecutive failures, say so.
            const seen = (pollFailures.current.get(item.jobId!) ?? 0) + 1;
            pollFailures.current.set(item.jobId!, seen);

            if (seen >= MAX_POLL_FAILURES) {
              pollFailures.current.delete(item.jobId!);
              patch(item.localId, {
                status: 'failed',
                error:
                  'Lost track of this conversion. It may have finished — reload the page to check before converting it again.',
              });
            }
          }
        }),
      );
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeJobKey, patch]);

  // --- Item actions -------------------------------------------------------

  const remove = useCallback((localId: string) => {
    const handle = uploadsRef.current.get(localId);
    if (handle) {
      handle.abort();
      uploadsRef.current.delete(localId);
    }
    filesRef.current.delete(localId);
    setItems((current) => {
      const going = current.find((item) => item.localId === localId);
      if (going?.previewUrl) URL.revokeObjectURL(going.previewUrl);
      return current.filter((item) => item.localId !== localId);
    });
  }, []);

  const cancel = useCallback(
    async (localId: string) => {
      const item = itemsRef.current.find((entry) => entry.localId === localId);
      if (!item?.jobId) {
        remove(localId);
        return;
      }

      try {
        await cancelJob(item.jobId);
        patch(localId, {
          status: 'cancelled',
          error: 'Cancelled at your request.',
        });
      } catch {
        toast.error('The conversion could not be cancelled.');
      }
    },
    [patch, remove],
  );

  const reset = useCallback(() => {
    for (const handle of uploadsRef.current.values()) handle.abort();
    uploadsRef.current.clear();
    filesRef.current.clear();
    setItems((current) => {
      for (const item of current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }, []);

  // Abort in-flight uploads and release blob URLs if the component unmounts.
  useEffect(
    () => () => {
      for (const handle of uploadsRef.current.values()) handle.abort();
      uploadsRef.current.clear();
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  // --- Derived state ------------------------------------------------------

  /** Formats every uploaded file can be converted to. */
  const availableTargets = useMemo<TargetOption[]>(() => {
    const withTargets = items.filter((item) => item.targets.length > 0);
    if (withTargets.length === 0) return [];

    const [first, ...rest] = withTargets;
    return first!.targets.filter((target) =>
      rest.every((item) =>
        item.targets.some((option) => option.id === target.id),
      ),
    );
  }, [items]);

  // Drop a preselected target that the current files cannot produce.
  useEffect(() => {
    if (!targetFormat || availableTargets.length === 0) return;
    if (!availableTargets.some((target) => target.id === targetFormat)) {
      setTargetFormat('');
    }
  }, [availableTargets, targetFormat]);

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const activeCount = items.filter(
    (item) =>
      item.status === 'uploading' ||
      item.status === 'queued' ||
      item.status === 'processing',
  ).length;
  const completed = items.filter((item) => item.status === 'completed');

  return {
    items,
    targetFormat,
    setTargetFormat,
    options,
    setOptions,
    availableTargets,
    addFiles,
    retryUpload,
    convert,
    cancel,
    remove,
    reset,
    isConverting,
    canConvert: readyCount > 0 && Boolean(targetFormat) && !isConverting,
    readyCount,
    activeCount,
    completed,
    isBusy: activeCount > 0 || isConverting,
    allDone:
      items.length > 0 && items.every((item) => TERMINAL.has(item.status)),
    combinePdf,
    setCombinePdf,
    /** True when the current selection would produce one PDF. */
    canCombinePdf: canCombine(
      items.filter((item) => item.status === 'ready' && item.ticket),
      targetFormat,
    ),
  };
}

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${Math.round(mb)} MB`;
}
