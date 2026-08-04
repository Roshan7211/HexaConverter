/**
 * Plan vocabulary.
 *
 * Lives in `types/` rather than beside the numbers in `lib/plans.ts` because
 * both the browser types and the server implementation need to name a tier, and
 * `types/` is the one layer everything is allowed to depend on. The limits
 * themselves stay in `lib/plans.ts`; only the names are here.
 */

export const PLAN_TIERS = ['ANONYMOUS', 'FREE', 'PREMIUM'] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];
