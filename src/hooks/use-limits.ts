'use client';

import useSWR from 'swr';

import { getLimits } from '@/api/client/limits.client';
import { LIMITS } from '@/lib/plans';
import type { LimitsResponse } from '@/types/api';

/**
 * Limits for the current visitor.
 *
 * Converter pages are statically generated, so they render from this constant
 * and correct it once the request resolves. The fallback is deliberately the
 * *anonymous* allowance — the smallest one — so a signed-in person briefly sees
 * limits lower than their own rather than being shown a ceiling they do not
 * have and hitting a server refusal. Nothing here is a security boundary; the
 * server enforces the real numbers regardless of what this says.
 */

const FALLBACK: LimitsResponse = {
  tier: 'ANONYMOUS',
  maxFileBytes: LIMITS.maxFileBytes,
  maxBatchFiles: LIMITS.maxBatchFiles,
  retentionHours: LIMITS.retentionHours,
  concurrentJobs: LIMITS.concurrentJobs,
  showsAds: LIMITS.showsAds,
  usage: { used: 0, limit: LIMITS.jobsPerPeriod },
};

export function useLimits(): { limits: LimitsResponse; isLoading: boolean } {
  const { data, isLoading } = useSWR<LimitsResponse>('/api/limits', getLimits, {
    fallbackData: FALLBACK,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });

  return { limits: data ?? FALLBACK, isLoading };
}
