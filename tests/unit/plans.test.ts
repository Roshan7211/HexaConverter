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

/** Each rung paired with the one below it, lowest first. */
const steps: ReadonlyArray<readonly [lower: PlanTier, higher: PlanTier]> = [
  ['ANONYMOUS', 'FREE'],
  ['FREE', 'PREMIUM'],
];

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
      for (const [lower, higher] of steps) {
        expect(
          PLANS[higher][key],
          `${key} must not fall from ${lower} to ${higher}`,
        ).toBeGreaterThan(PLANS[lower][key]);
      }
    }
  });

  it('holds the ladder on sustained volume, not just per window', () => {
    // The allowances are quoted over different windows, so the headline numbers
    // cannot be compared directly. Rating them per day is the only comparison
    // that reflects what someone actually gets, and it is the one that used to
    // fail: 50 a month against 5 a day read as the bigger allowance while being
    // a third of it, making registration a downgrade for regular use.
    const perDay = (tier: PlanTier) =>
      PLANS[tier].jobsPerPeriod / PLANS[tier].periodDays;

    for (const [lower, higher] of steps) {
      expect(
        perDay(higher),
        `${higher} must beat ${lower} per day, not just per window`,
      ).toBeGreaterThan(perDay(lower));
    }
  });

  it('keeps the two free rungs on the same window', () => {
    // Guest and member sit side by side on the pricing table and in every
    // upsell sentence. Quoting one per day and the other per month is what
    // hid the inversion above in the first place.
    expect(PLANS.FREE.periodDays).toBe(PLANS.ANONYMOUS.periodDays);
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
