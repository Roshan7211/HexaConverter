import type { LimitsResponse } from '@/types/api';

/** Fetches the caller's effective plan limits and remaining allowance. */
export async function getLimits(): Promise<LimitsResponse> {
  const response = await fetch('/api/limits', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to load plan limits');
  return (await response.json()) as LimitsResponse;
}
