/**
 * Service limits, by plan.
 *
 * Three rungs, and the ladder only ever goes up: an account is always better
 * than no account, and paying is always better than not. That ordering is the
 * whole design — a free account worse than staying anonymous would give nobody
 * a reason to register, and registering is what makes the rest possible.
 *
 * Every number here is enforced server-side and read by the marketing copy, so
 * what the site claims and what the server does cannot drift apart.
 */

import type { PlanTier } from '@/types/plans';

const MB = 1024 * 1024;
const GB = 1024 * MB;

export { PLAN_TIERS, type PlanTier } from '@/types/plans';

export interface Limits {
  /** Largest single upload, in bytes. */
  maxFileBytes: number;
  /** Conversions allowed per rolling window. */
  jobsPerPeriod: number;
  /**
   * Length of that window, in days.
   *
   * Per-tier rather than global because the two allowances answer different
   * questions. Someone with no account is passing through and needs enough to
   * finish what they came for today; someone with an account is being given a
   * monthly budget. A daily window also recovers on its own, so hitting the
   * anonymous limit costs a visitor a day rather than the rest of the month.
   */
  periodDays: number;
  /** Files accepted in one batch. */
  maxBatchFiles: number;
  /** Hours a finished file is retained. */
  retentionHours: number;
  concurrentJobs: number;
  /** Whether advertising is shown to this tier. */
  showsAds: boolean;
  /** Whether queued work is served ahead of other tiers'. */
  priorityQueue: boolean;
}

export const PLANS: Record<PlanTier, Limits> = {
  /**
   * No account. Deliberately usable rather than crippled — this is what a
   * visitor arriving from search gets, and most convert one file and leave.
   */
  ANONYMOUS: {
    maxFileBytes: 100 * MB,
    jobsPerPeriod: 5,
    periodDays: 1,
    maxBatchFiles: 3,
    retentionHours: 1,
    concurrentJobs: 1,
    showsAds: true,
    priorityQueue: false,
  },

  /**
   * Free, with an account. Ten times the allowance, five times the file size
   * and no advertising, so registering is obviously worth doing.
   */
  FREE: {
    maxFileBytes: 500 * MB,
    jobsPerPeriod: 50,
    periodDays: 30,
    maxBatchFiles: 15,
    retentionHours: 24,
    concurrentJobs: 2,
    showsAds: false,
    priorityQueue: false,
  },

  /**
   * Paid. `jobsPerPeriod` is a fair-use ceiling rather than a true infinity:
   * the conversion endpoints are finite CPU, and an unbounded allowance would
   * be an invitation. It sits far above what honest use reaches, so it reads as
   * unlimited to everyone not abusing it.
   *
   * `maxFileBytes` is 2 GB rather than the 10 GB the old copy advertised. A
   * 10 GB video needs roughly twice that in transient disk and more memory than
   * the server has — and `MAX_UPLOAD_BYTES` was capping every upload at 512 MB
   * regardless, so the old number was never real. Raise it when the hardware
   * can take it.
   */
  PREMIUM: {
    maxFileBytes: 2 * GB,
    jobsPerPeriod: 10_000,
    periodDays: 30,
    maxBatchFiles: 200,
    retentionHours: 168,
    concurrentJobs: 8,
    showsAds: false,
    priorityQueue: true,
  },
};

/** Billed once a year. */
export const PREMIUM_PRICE_PENCE = 999;
export const PREMIUM_CURRENCY = 'GBP';

export function limitsFor(tier: PlanTier): Limits {
  return PLANS[tier];
}

/**
 * What you get without doing anything, which is what a first-time visitor is
 * asking. Marketing copy and the client bundle read this.
 */
export const LIMITS: Limits = PLANS.ANONYMOUS;

/**
 * Default window, kept for copy that talks about the monthly allowance. The
 * enforced window is `limits.periodDays`, which differs by tier.
 */
export const USAGE_PERIOD_DAYS = 30;
