import type { ApiError } from '@/types/api';
import type { ArchiveOperation, ArchiveTarget } from '@/types/archives';

/** Browser-side archive toolkit calls. */

export interface ArchiveTaskRequest {
  operation: ArchiveOperation;
  tickets: string[];
  target?: ArchiveTarget;
  compressionLevel?: number;
  password?: string;
  encryption?: 'aes256' | 'zipcrypto';
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as ApiError).error
        : 'The request failed.';
    throw new Error(message);
  }

  return body as T;
}

export async function createArchiveTask(
  request: ArchiveTaskRequest,
): Promise<{ id: string; status: string; progress: number }> {
  const body = await parse<{
    job: { id: string; status: string; progress: number };
  }>(
    await fetch('/api/tools/archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }),
  );

  return body.job;
}

export interface PurgeResult {
  jobs: number;
  files: number;
  skipped: number;
}

/** Deletes every file this visitor has stored, ahead of the retention sweep. */
export async function purgeStoredFiles(): Promise<PurgeResult> {
  return parse<PurgeResult>(await fetch('/api/storage', { method: 'DELETE' }));
}
