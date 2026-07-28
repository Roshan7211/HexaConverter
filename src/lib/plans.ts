import type { PlanTier } from '@prisma/client';

/**
 * Service limits.
 *
 * The service is free, so there are no tiers to compare and nothing to buy.
 * What remains is the single allowance everyone is held to, which the quota
 * checks enforce and the marketing copy reads from — so what the site claims
 * and what the server does cannot drift apart.
 */

const GB = 1024 * 1024 * 1024;

/**
 * The one allowance everybody gets, signed in or not.
 *
 * Still a ceiling rather than "unlimited": storage and CPU are finite and the
 * conversion endpoints accept anonymous traffic, so an open-ended allowance
 * would be an invitation. Raise or lower these in one place.
 */
export const UNIVERSAL_LIMITS = {
  /** Largest single upload, in bytes. */
  maxFileBytes: 10 * GB,
  /** Conversions allowed per rolling window. */
  jobsPerPeriod: 100_000,
  /** Files accepted in one batch. */
  maxBatchFiles: 200,
  /** Hours a finished file is retained. */
  retentionHours: 168,
  concurrentJobs: 16,
} as const;

/**
 * Display names for the tier still stored on each user.
 *
 * The `PlanTier` column and its badges outlive pricing: the enum is in the
 * database and the value is meaningful for support and for any future
 * entitlement, it just no longer implies a price.
 */
export const PLAN_LABEL: Record<PlanTier, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

export interface EffectiveLimits {
  maxFileBytes: number;
  jobsPerPeriod: number;
  maxBatchFiles: number;
  retentionHours: number;
  concurrentJobs: number;
  label: string;
}

/**
 * Everyone gets the same allowance.
 *
 * The parameter is kept so callers — quota checks, the limits endpoint, the
 * dashboard — did not all have to change, and so reinstating per-tier limits
 * is an edit to this one function.
 */
export function limitsFor(_plan?: PlanTier | null): EffectiveLimits {
  return { ...UNIVERSAL_LIMITS, label: 'Free' };
}

/** Length of the rolling usage window, in days. */
export const USAGE_PERIOD_DAYS = 30;
