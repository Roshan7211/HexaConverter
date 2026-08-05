import type { ApiError, UploadResponse } from '@/types/api';

/**
 * Browser-side upload caller.
 *
 * Two paths, one interface. Small files go in a single request over
 * `XMLHttpRequest`, which is still the only API that reports upload progress.
 * Anything past the threshold is split into chunks and sent through the
 * resumable session endpoints, because a large file in one request means a
 * dropped connection at 95% costs the whole transfer — and because proxies
 * routinely cap request bodies well below the sizes people convert.
 *
 * Chunks are retried on their own with exponential backoff. Retrying a chunk
 * is safe by construction: the server stores it under its index, so a resend
 * overwrites whatever the failed attempt left behind.
 */

/** Files at or above this go through the chunked path. */
export const CHUNKED_THRESHOLD_BYTES = 16 * 1024 * 1024;

/** Attempts per chunk before the upload is reported as failed. */
const MAX_CHUNK_ATTEMPTS = 4;

/** How many chunks are in flight at once. */
const CHUNK_CONCURRENCY = 3;

export interface UploadHandle {
  promise: Promise<UploadResponse>;
  abort: () => void;
}

interface SessionState {
  id: string;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
}

export function uploadFile(
  file: File,
  onProgress: (percent: number) => void,
): UploadHandle {
  return file.size >= CHUNKED_THRESHOLD_BYTES
    ? uploadInChunks(file, onProgress)
    : uploadWhole(file, onProgress);
}

/** Single-request upload, for files small enough that a retry is cheap. */
function uploadWhole(
  file: File,
  onProgress: (percent: number) => void,
): UploadHandle {
  const request = new XMLHttpRequest();

  const promise = new Promise<UploadResponse>((resolve, reject) => {
    request.open('POST', '/api/uploads', true);
    request.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    request.setRequestHeader(
      'content-type',
      file.type || 'application/octet-stream',
    );

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText) as UploadResponse);
        } catch {
          reject(new Error('The upload response could not be read.'));
        }
        return;
      }
      reject(new Error(errorMessage(request.responseText)));
    });

    request.addEventListener('error', () => {
      reject(
        new Error('The upload failed. Check your connection and try again.'),
      );
    });

    request.addEventListener('abort', () => {
      reject(new DOMException('Upload aborted', 'AbortError'));
    });

    request.send(file);
  });

  return { promise, abort: () => request.abort() };
}

/** Resumable chunked upload, for everything large. */
function uploadInChunks(
  file: File,
  onProgress: (percent: number) => void,
): UploadHandle {
  const controller = new AbortController();
  let sessionId: string | null = null;

  const promise = (async (): Promise<UploadResponse> => {
    const started = await fetch('/api/uploads/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: file.name, size: file.size }),
      signal: controller.signal,
    });

    if (!started.ok) throw new Error(await readError(started));

    const { session } = (await started.json()) as { session: SessionState };
    sessionId = session.id;

    // A resumed session already holds some chunks; only the gaps are sent.
    const done = new Set(session.receivedChunks);
    const queue = Array.from(
      { length: session.totalChunks },
      (_, index) => index,
    ).filter((index) => !done.has(index));

    const report = () =>
      onProgress(Math.round((done.size / session.totalChunks) * 100));
    report();

    // A worker pool rather than one request at a time: a single chunk cannot
    // saturate an ordinary connection, so serial uploads leave bandwidth idle.
    const workers = Array.from(
      { length: Math.min(CHUNK_CONCURRENCY, queue.length) },
      async () => {
        for (;;) {
          const index = queue.shift();
          if (index === undefined) return;

          await sendChunk(session, file, index, controller.signal);
          done.add(index);
          report();
        }
      },
    );

    await Promise.all(workers);

    const completed = await fetch(
      `/api/uploads/sessions/${session.id}/complete`,
      { method: 'POST', signal: controller.signal },
    );

    if (!completed.ok) throw new Error(await readError(completed));

    onProgress(100);
    // Completing consumes the session, so cancellation must not try to delete
    // it afterwards.
    sessionId = null;
    return (await completed.json()) as UploadResponse;
  })();

  return {
    promise,
    abort: () => {
      controller.abort();
      // Drop the partial upload now rather than leaving it for the sweeper.
      // `keepalive` so the request survives the page being closed.
      if (sessionId) {
        void fetch(`/api/uploads/sessions/${sessionId}`, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => undefined);
      }
    },
  };
}

/** Sends one chunk, retrying transient failures with exponential backoff. */
async function sendChunk(
  session: SessionState,
  file: File,
  index: number,
  signal: AbortSignal,
): Promise<void> {
  const start = index * session.chunkSize;
  const blob = file.slice(start, start + session.chunkSize);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt += 1) {
    signal.throwIfAborted();

    try {
      const response = await fetch(`/api/uploads/sessions/${session.id}`, {
        method: 'PUT',
        headers: {
          'x-chunk-index': String(index),
          'content-type': 'application/octet-stream',
        },
        body: blob,
        signal,
      });

      if (response.ok) return;

      const message = await readError(response);

      // A 4xx other than 429 means the request itself is wrong: the file was
      // rejected, the session is gone, the limit is exceeded. Retrying that is
      // only a slower way to fail, so it is surfaced immediately.
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        throw new PermanentUploadError(message);
      }

      lastError = new Error(message);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      if (error instanceof PermanentUploadError) throw error;

      lastError = error instanceof Error ? error : new Error('Upload failed.');
    }

    if (attempt < MAX_CHUNK_ATTEMPTS) {
      await delay(2 ** (attempt - 1) * 500, signal);
    }
  }

  throw lastError ?? new Error(`Chunk ${index + 1} could not be uploaded.`);
}

/** A failure the server explained; retrying it would change nothing. */
class PermanentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentUploadError';
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function readError(response: Response): Promise<string> {
  return errorMessage(await response.text());
}

function errorMessage(responseText: string): string {
  try {
    return (
      (JSON.parse(responseText) as ApiError).error ?? 'The upload was rejected.'
    );
  } catch {
    return 'The upload was rejected.';
  }
}

/**
 * Retrieves a pasted link through our server and returns it as a `File`.
 *
 * The round trip exists because the browser cannot fetch an arbitrary URL
 * itself — cross-origin rules forbid reading the response — and because a URL
 * the visitor chose must never be fetched without the checks on the server
 * side. What comes back is an ordinary file, so every path after this point is
 * the one a dropped file already takes.
 */
export async function importFromUrl(url: string): Promise<File> {
  const response = await fetch('/api/uploads/from-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? 'That link could not be imported.');
  }

  const name = decodeURIComponent(
    response.headers.get('x-file-name') ?? 'download',
  );
  const blob = await response.blob();

  return new File([blob], name, {
    type: blob.type || 'application/octet-stream',
  });
}
