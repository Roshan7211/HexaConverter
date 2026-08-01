import type { ApiError } from '@/types/api';

/** Browser-side document toolkit calls. */

export interface PdfTaskRequest {
  operation: string;
  tickets: string[];
  pages?: string;
  angle?: 90 | 180 | 270;
  splitMode?: 'pages' | 'ranges';
  compression?: 'light' | 'balanced' | 'strong';
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

/** Queues a merge / split / extract / rotate / compress task. */
export async function createPdfTask(
  request: PdfTaskRequest,
): Promise<{ id: string; status: string; progress: number }> {
  const body = await parse<{
    job: { id: string; status: string; progress: number };
  }>(
    await fetch('/api/tools/pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }),
  );

  return body.job;
}
