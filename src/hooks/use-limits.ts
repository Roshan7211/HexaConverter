'use client';

import useSWR from 'swr';

import { getLimits } from '@/api/client/limits.client';
import { LIMITS } from '@/lib/plans';
import type { LimitsResponse } from '@/types/api';

/**
 * Limits for the current visitor.
 *
 * Converter pages are statically generated, so they render from this constant
 * and confirm it once the request resolves. The allowance is the same for
 * everyone, so the fallback is the real answer rather than a conservative
 * guess — only `usage` can differ.
 */

const FALLBACK: LimitsResponse = {
  maxFileBytes: LIMITS.maxFileBytes,
  maxBatchFiles: LIMITS.maxBatchFiles,
  retentionHours: LIMITS.retentionHours,
  concurrentJobs: LIMITS.concurrentJobs,
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
