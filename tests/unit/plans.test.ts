import { describe, expect, it } from 'vitest';

import { PLANS, limitsFor } from '@/lib/plans';
import { PLAN_TIERS, type PlanTier } from '@/types/plans';

/**
 * The plan matrix is read by the limit checks, the marketing copy and the
 * advertising slots alike, so a careless edit here changes what the site
 * promises, what it enforces and who sees ads, all at once and silently.
 *
 * These tests assert the *shape* of the ladder rather than restating every
 * number. Restating them would only duplicate the table — a test that has to be
 * edited in lockstep with the thing it guards catches nothing.
 */

const ordered: PlanTier[] = ['ANONYMOUS', 'FREE', 'PREMIUM'];

describe('plan matrix', () => {
  it('covers every declared tier', () => {
    expect(Object.keys(PLANS).sort()).toEqual([...PLAN_TIERS].sort());
  });

  it('shows advertising on the free rungs and never on the paid one', () => {
    // The entire commercial proposition of Premium. If this inverts, paying
    // customers see ads they paid to remove.
    expect(PLANS.ANONYMOUS.showsAds).toBe(true);
    expect(PLANS.FREE.showsAds).toBe(true);
    expect(PLANS.PREMIUM.showsAds).toBe(false);
  });

  it('never goes backwards as the tier rises', () => {
    // "An account is always better than no account, and paying is always better
    // than not" — the ordering the file's own docblock claims.
    const rising = [
      'maxFileBytes',
      'maxBatchFiles',
      'retentionHours',
      'concurrentJobs',
    ] as const;

    for (const key of rising) {
      for (let i = 1; i < ordered.length; i += 1) {
        const lower = PLANS[ordered[i - 1]][key];
        const higher = PLANS[ordered[i]][key];
        expect(
          higher,
          `${key} must not fall from ${ordered[i - 1]} to ${ordered[i]}`,
        ).toBeGreaterThan(lower);
      }
    }
  });

  it('gives a free account a bigger single-sitting allowance than none', () => {
    // What a visitor actually runs into. Anonymous use stops after 5 in a day;
    // an account carries a 50-conversion budget into that same sitting.
    expect(PLANS.FREE.jobsPerPeriod).toBeGreaterThan(
      PLANS.ANONYMOUS.jobsPerPeriod,
    );
    expect(PLANS.PREMIUM.jobsPerPeriod).toBeGreaterThan(
      PLANS.FREE.jobsPerPeriod,
    );
  });

  it('documents that the ladder inverts on sustained monthly volume', () => {
    // Deliberate, and the one place the file's "an account is always better"
    // rule does not hold. Anonymous resets daily, so 5 a day is ~150 a month
    // against a free account's 50: someone converting a couple of files every
    // day is better off never registering, on count alone. Everything else —
    // file size, batch, retention, concurrency, history, OCR — still favours
    // the account, which is what the free tier is actually selling.
    //
    // Asserted rather than left implicit so that if the allowances are ever
    // rebalanced, this test fails and the choice gets made again on purpose.
    const perDay = (tier: PlanTier) =>
      PLANS[tier].jobsPerPeriod / PLANS[tier].periodDays;

    expect(perDay('ANONYMOUS')).toBeGreaterThan(perDay('FREE'));
    expect(perDay('PREMIUM')).toBeGreaterThan(perDay('ANONYMOUS'));
  });

  it('reserves the priority queue for the paid tier', () => {
    expect(PLANS.ANONYMOUS.priorityQueue).toBe(false);
    expect(PLANS.FREE.priorityQueue).toBe(false);
    expect(PLANS.PREMIUM.priorityQueue).toBe(true);
  });

  it('resolves limits by tier', () => {
    for (const tier of PLAN_TIERS) {
      expect(limitsFor(tier)).toBe(PLANS[tier]);
    }
  });
});
