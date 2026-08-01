'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from 'sonner';

import { createPdfTask } from '@/api/client/documents.client';
import { getJob } from '@/api/client/jobs.client';
import { uploadFile } from '@/api/client/uploads.client';
import { fileExtension } from '@/utils';
import { PDF_OPERATION_SPECS, type PdfOperation } from '@/types/documents';

/**
 * Client workflow for the document toolkit.
 *
 * Differs from the single-file converter in two ways: several files can be
 * queued and reordered (merge cares about order), and the whole selection
 * produces exactly one job rather than one job per file.
 */

export type ToolkitStatus =
  | 'idle'
  | 'uploading'
  | 'ready'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface ToolkitFile {
  localId: string;
  name: string;
  size: number;
  /** 0-100 upload progress. */
  progress: number;
  ticket: string | null;
  error: string | null;
}

export interface ToolkitParams {
  pages: string;
  angle: 90 | 180 | 270;
  splitMode: 'pages' | 'ranges';
  compression: 'light' | 'balanced' | 'strong';
}

const POLL_MS = 1_200;

let counter = 0;
const nextId = () => `pdf-${Date.now().toString(36)}-${(counter += 1)}`;

export function usePdfToolkit(operation: PdfOperation, maxFileBytes: number) {
  const spec = PDF_OPERATION_SPECS[operation];

  const [files, setFiles] = useState<ToolkitFile[]>([]);
  const [status, setStatus] = useState<ToolkitStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    downloadUrl: string;
    name: string;
    size: number;
  } | null>(null);

  const [params, setParams] = useState<ToolkitParams>({
    pages: 'all',
    angle: 90,
    splitMode: 'pages',
    compression: 'balanced',
  });

  const jobIdRef = useRef<string | null>(null);
  const uploadsRef = useRef(new Map<string, { abort: () => void }>());
  /** Picked files, kept so a failed upload can be retried in place. */
  const filesRef = useRef(new Map<string, File>());

  const patch = useCallback(
    (localId: string, changes: Partial<ToolkitFile>) => {
      setFiles((current) =>
        current.map((file) =>
          file.localId === localId ? { ...file, ...changes } : file,
        ),
      );
    },
    [],
  );

  /**
   * Uploads one file and records the ticket. Split out from `addFiles` so a
   * failed transfer can be retried in place, without the user having to find
   * the file again.
   */
  const startUpload = useCallback(
    async (localId: string, file: File) => {
      setStatus('uploading');
      patch(localId, { progress: 0, error: null });

      const handle = uploadFile(file, (percent) =>
        patch(localId, { progress: percent }),
      );
      uploadsRef.current.set(localId, handle);

      try {
        const payload = await handle.promise;
        patch(localId, { ticket: payload.ticket, progress: 100 });
      } catch (uploadError) {
        if (
          uploadError instanceof DOMException &&
          uploadError.name === 'AbortError'
        ) {
          return;
        }
        const message =
          uploadError instanceof Error ? uploadError.message : 'Upload failed.';
        patch(localId, { error: message });
        toast.error(message);
      } finally {
        uploadsRef.current.delete(localId);
        setStatus((current) => (current === 'uploading' ? 'ready' : current));
      }
    },
    [patch],
  );

  /** Re-sends a file whose upload failed. */
  const retryUpload = useCallback(
    (localId: string) => {
      const file = filesRef.current.get(localId);
      if (!file) {
        toast.error('That file is no longer available. Add it again.');
        return;
      }
      void startUpload(localId, file);
    },
    [startUpload],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      setFiles((current) => {
        const room = spec.maxFiles - current.length;
        if (room <= 0) {
          toast.error(
            `${spec.label} accepts at most ${spec.maxFiles} file${spec.maxFiles === 1 ? '' : 's'}.`,
          );
          return current;
        }

        const accepted: ToolkitFile[] = [];

        for (const file of list.slice(0, room)) {
          if (fileExtension(file.name) !== 'pdf') {
            toast.error(`${file.name} is not a PDF.`);
            continue;
          }
          if (file.size === 0) {
            toast.error(`${file.name} is empty.`);
            continue;
          }
          if (file.size > maxFileBytes) {
            toast.error(`${file.name} exceeds your upload limit.`);
            continue;
          }

          const entry: ToolkitFile = {
            localId: nextId(),
            name: file.name,
            size: file.size,
            progress: 0,
            ticket: null,
            error: null,
          };
          accepted.push(entry);
          filesRef.current.set(entry.localId, file);

          // Upload immediately; the ticket is what the task will reference.
          void startUpload(entry.localId, file);
        }

        if (list.length > room) {
          toast.error(
            `Only ${room} more file${room === 1 ? '' : 's'} can be added.`,
          );
        }

        return [...current, ...accepted];
      });
    },
    [maxFileBytes, spec.label, spec.maxFiles, startUpload],
  );

  const remove = useCallback((localId: string) => {
    uploadsRef.current.get(localId)?.abort();
    uploadsRef.current.delete(localId);
    filesRef.current.delete(localId);
    setFiles((current) => current.filter((file) => file.localId !== localId));
  }, []);

  /** Merge honours the visible order, so files can be moved up and down. */
  const move = useCallback((localId: string, direction: -1 | 1) => {
    setFiles((current) => {
      const index = current.findIndex((file) => file.localId === localId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    for (const handle of uploadsRef.current.values()) handle.abort();
    uploadsRef.current.clear();
    filesRef.current.clear();
    jobIdRef.current = null;
    setFiles([]);
    setStatus('idle');
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const run = useCallback(async () => {
    const tickets = files
      .map((file) => file.ticket)
      .filter((ticket): ticket is string => Boolean(ticket));

    if (tickets.length !== files.length || tickets.length === 0) {
      toast.error('Wait for the uploads to finish.');
      return;
    }

    setStatus('queued');
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const job = await createPdfTask({
        operation,
        tickets,
        ...(operation === 'EXTRACT_PAGES' ||
        operation === 'SPLIT' ||
        operation === 'ROTATE'
          ? { pages: params.pages }
          : {}),
        ...(operation === 'ROTATE' ? { angle: params.angle } : {}),
        ...(operation === 'SPLIT' ? { splitMode: params.splitMode } : {}),
        ...(operation === 'COMPRESS'
          ? { compression: params.compression }
          : {}),
      });

      jobIdRef.current = job.id;
      setStatus('processing');
    } catch (taskError) {
      const message =
        taskError instanceof Error
          ? taskError.message
          : 'The task could not be started.';
      setStatus('failed');
      setError(message);
      toast.error(message);
    }
  }, [files, operation, params]);

  // --- poll the job to completion -------------------------------------------
  useEffect(() => {
    if (status !== 'processing' && status !== 'queued') return;
    const jobId = jobIdRef.current;
    if (!jobId) return;

    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const job = await getJob(jobId);
        if (cancelled) return;

        setProgress(job.progress);

        if (job.status === 'COMPLETED' && job.downloadUrl) {
          setStatus('completed');
          setResult({
            downloadUrl: job.downloadUrl,
            name: job.outputName ?? 'result.pdf',
            size: job.outputSize ?? 0,
          });
          toast.success(`${spec.label} finished.`);
        } else if (job.status === 'FAILED' || job.status === 'CANCELLED') {
          setStatus('failed');
          setError(job.error ?? 'The task failed.');
          toast.error(job.error ?? 'The task failed.');
        }
      } catch {
        // Transient failure; the next tick retries.
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, spec.label]);

  useEffect(
    () => () => {
      for (const handle of uploadsRef.current.values()) handle.abort();
      uploadsRef.current.clear();
    },
    [],
  );

  const uploading = files.some((file) => !file.ticket && !file.error);
  const busy = status === 'queued' || status === 'processing';

  return {
    spec,
    files,
    params,
    setParams,
    status,
    progress,
    error,
    result,
    addFiles,
    remove,
    retryUpload,
    move,
    reset,
    run,
    canRun:
      !busy &&
      !uploading &&
      files.length >= spec.minFiles &&
      files.length <= spec.maxFiles &&
      files.every((file) => file.ticket),
    busy,
    uploading,
  };
}
