import type { JobDto } from '@/api/dto/job.dto';
import type { ApiError } from '@/types/api';
import type { ConversionOptions } from '@/types/conversion';

/** Browser-side conversion job calls. */

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

export async function createJob(input: {
  ticket: string;
  /**
   * Further uploads to fold into one output, in page order. Supported only for
   * images to PDF; the server refuses it elsewhere.
   */
  extraTickets?: string[];
  targetFormat: string;
  /** Engine options; validated again server-side against the route's schema. */
  options?: ConversionOptions;
}): Promise<JobDto> {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = await parse<{ job: JobDto }>(response);
  return body.job;
}

export async function getJob(id: string): Promise<JobDto> {
  const response = await fetch(`/api/jobs/${id}`, { cache: 'no-store' });
  const body = await parse<{ job: JobDto }>(response);
  return body.job;
}

export async function listJobs(params: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ jobs: JobDto[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);

  const response = await fetch(`/api/jobs?${query.toString()}`, {
    cache: 'no-store',
  });
  return parse<{ jobs: JobDto[]; nextCursor: string | null }>(response);
}

export async function cancelJob(id: string): Promise<void> {
  await parse(await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' }));
}

export async function deleteJob(id: string): Promise<void> {
  await parse(await fetch(`/api/jobs/${id}`, { method: 'DELETE' }));
}
