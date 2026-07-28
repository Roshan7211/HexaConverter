'use client';

import useSWR from 'swr';

import { getLimits } from '@/api/client/limits.client';
import { UNIVERSAL_LIMITS } from '@/lib/plans';
import type { LimitsResponse } from '@/types/api';

/**
 * Effective limits for the current visitor.
 *
 * Converter pages are statically generated, so they render from this constant
 * and confirm it once the request resolves. Since the allowance is now the same
 * for everyone, the fallback is the real answer rather than a conservative
 * guess — only `usage` can differ.
 */

const FALLBACK: LimitsResponse = {
  plan: 'Free',
  authenticated: false,
  maxFileBytes: UNIVERSAL_LIMITS.maxFileBytes,
  maxBatchFiles: UNIVERSAL_LIMITS.maxBatchFiles,
  retentionHours: UNIVERSAL_LIMITS.retentionHours,
  concurrentJobs: UNIVERSAL_LIMITS.concurrentJobs,
  usage: { used: 0, limit: UNIVERSAL_LIMITS.jobsPerPeriod },
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
