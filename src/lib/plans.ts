/**
 * Service limits.
 *
 * The service is free and has no accounts, so there are no tiers to compare
 * and nothing to buy. What remains is the single allowance everyone is held
 * to, which the quota checks enforce and the marketing copy reads from — so
 * what the site claims and what the server does cannot drift apart.
 */

const GB = 1024 * 1024 * 1024;

export interface Limits {
  /** Largest single upload, in bytes. */
  maxFileBytes: number;
  /** Conversions allowed per rolling window. */
  jobsPerPeriod: number;
  /** Files accepted in one batch. */
  maxBatchFiles: number;
  /** Hours a finished file is retained. */
  retentionHours: number;
  concurrentJobs: number;
}

/**
 * The one allowance everybody gets.
 *
 * Still a ceiling rather than "unlimited": storage and CPU are finite and the
 * conversion endpoints accept anonymous traffic, so an open-ended allowance
 * would be an invitation. Raise or lower these in one place.
 */
export const LIMITS: Limits = {
  maxFileBytes: 10 * GB,
  jobsPerPeriod: 100_000,
  maxBatchFiles: 200,
  retentionHours: 168,
  concurrentJobs: 16,
};

/** Length of the rolling usage window, in days. */
export const USAGE_PERIOD_DAYS = 30;
