'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from 'sonner';

import { createArchiveTask } from '@/api/client/archives.client';
import { getJob } from '@/api/client/jobs.client';
import { uploadFile } from '@/api/client/uploads.client';
import {
  ARCHIVE_OPERATION_SPECS,
  type ArchiveOperation,
  type ArchiveTarget,
} from '@/types/archives';
import { formatExtension } from '@/utils';

/**
 * Client workflow for the archive toolkit.
 *
 * Shaped like the document toolkit — several uploads collapse into one job —
 * with the extra wrinkle that extraction only accepts archives, so an
 * ordinary file is rejected in the browser instead of after an upload.
 */

export type ArchiveStatus =
  | 'idle'
  | 'uploading'
  | 'ready'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface ArchiveFile {
  localId: string;
  name: string;
  size: number;
  progress: number;
  ticket: string | null;
  error: string | null;
}

export interface ArchiveParams {
  target: ArchiveTarget;
  compressionLevel: number;
  password: string;
  encryption: 'aes256' | 'zipcrypto';
}

/** Extensions the extractor can open. */
const OPENABLE = new Set(['zip', 'rar', '7z', 'tar', 'tgz', 'gz', 'gzip']);

const POLL_MS = 1_200;

let counter = 0;
const nextId = () => `arc-${Date.now().toString(36)}-${(counter += 1)}`;

export function useArchiveToolkit(
  operation: ArchiveOperation,
  maxFileBytes: number,
) {
  const spec = ARCHIVE_OPERATION_SPECS[operation];

  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [status, setStatus] = useState<ArchiveStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    downloadUrl: string;
    name: string;
    size: number;
    detail: string | null;
  } | null>(null);

  const [params, setParams] = useState<ArchiveParams>({
    target: 'zip',
    compressionLevel: 6,
    password: '',
    encryption: 'aes256',
  });

  const jobIdRef = useRef<string | null>(null);
  const uploadsRef = useRef(new Map<string, { abort: () => void }>());
  /** Picked files, kept so a failed upload can be retried in place. */
  const filesRef = useRef(new Map<string, File>());

  const patch = useCallback(
    (localId: string, changes: Partial<ArchiveFile>) => {
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

        const accepted: ArchiveFile[] = [];

        for (const file of list.slice(0, room)) {
          const extension = formatExtension(file.name);

          if (operation === 'EXTRACT' && !OPENABLE.has(extension)) {
            toast.error(`${file.name} is not an archive.`);
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

          const entry: ArchiveFile = {
            localId: nextId(),
            name: file.name,
            size: file.size,
            progress: 0,
            ticket: null,
            error: null,
          };
          accepted.push(entry);
          filesRef.current.set(entry.localId, file);

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
    [maxFileBytes, operation, spec.label, spec.maxFiles, startUpload],
  );

  const remove = useCallback((localId: string) => {
    uploadsRef.current.get(localId)?.abort();
    uploadsRef.current.delete(localId);
    filesRef.current.delete(localId);
    setFiles((current) => current.filter((file) => file.localId !== localId));
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
      const job = await createArchiveTask({
        operation,
        tickets,
        compressionLevel: params.compressionLevel,
        ...(operation === 'ARCHIVE' ? { target: params.target } : {}),
        ...(operation === 'PROTECT'
          ? { password: params.password, encryption: params.encryption }
          : {}),
        // An extraction password is only sent when one was typed; an empty
        // string would be a password attempt rather than "no password".
        ...(operation === 'EXTRACT' && params.password
          ? { password: params.password }
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
            name: job.outputName ?? 'result.zip',
            size: job.outputSize ?? 0,
            detail: job.detail ?? null,
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
  const needsPassword = operation === 'PROTECT' && params.password.length === 0;

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
    reset,
    run,
    canRun:
      !busy &&
      !uploading &&
      !needsPassword &&
      files.length >= spec.minFiles &&
      files.length <= spec.maxFiles &&
      files.every((file) => file.ticket),
    busy,
    uploading,
  };
}
