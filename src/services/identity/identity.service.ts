import 'server-only';

import { cookies } from 'next/headers';

import { JobStatus } from '@prisma/client';

import { serverEnv } from '@/lib/env';
import { currentUser } from '@/lib/firebase/session';
import { isPaddleConfigured } from '@/lib/paddle';
import { limitsFor, PLANS, type Limits, type PlanTier } from '@/lib/plans';
import * as jobs from '@/database/repositories/job.repository';
import {
  findByFirebaseUid,
  type UserRecord,
} from '@/database/repositories/user.repository';
import {
  createGuestId,
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  isValidGuestId,
} from '@/lib/security';

/**
 * Requester identity and quota enforcement.
 *
 * A requester is always a browser, and sometimes also an account. Every visitor
 * gets an opaque, http-only cookie holding a random id — enough to keep one
 * visitor's conversions private from another's, identifying no person. Signing
 * in adds an account id alongside it, which is what lets history follow someone
 * to another device.
 *
 * Anonymous use is unchanged by any of this: with no session cookie the
 * requester is exactly what it always was.
 */

export interface Requester {
  /** Opaque per-browser id from the guest cookie. */
  guestId: string;
  /** Local account id, when signed in. Null for anonymous visitors. */
  userId: string | null;
  /** Which rung of the ladder this request is entitled to. */
  tier: PlanTier;
  /** Stable owner key used for signing storage tickets. */
  ownerKey: string;
  limits: Limits;
}

/**
 * Entitlement is derived, never read straight off the row.
 *
 * A premium account whose term has ended is treated as free from the instant it
 * lapses, without waiting for anything to process the expiry. That way a failed
 * renewal, a webhook that never arrived or a cron that did not run degrades the
 * account quietly instead of handing out paid limits indefinitely.
 */
function tierFor(account: UserRecord | null): PlanTier {
  if (!account) return 'ANONYMOUS';

  const livePremium =
    account.planTier === 'PREMIUM' &&
    account.premiumUntil !== null &&
    account.premiumUntil.getTime() > Date.now();

  return livePremium ? 'PREMIUM' : 'FREE';
}

/**
 * The owner key deliberately stays bound to the browser even when signed in.
 * It signs storage tickets issued before sign-in, and re-keying them mid-upload
 * would invalidate a transfer already in progress.
 */
function requesterFor(guestId: string, account: UserRecord | null): Requester {
  const tier = tierFor(account);

  return {
    guestId,
    userId: account?.id ?? null,
    tier,
    ownerKey: `g:${guestId}`,
    limits: limitsFor(tier),
  };
}

/** The signed-in account for this request, or null. */
async function currentAccount(): Promise<UserRecord | null> {
  const session = await currentUser();
  if (!session) return null;

  return findByFirebaseUid(session.firebaseUid);
}

/**
 * Resolves the current requester, creating the guest cookie when needed.
 * Only callable from route handlers and server actions, where cookies are
 * writable.
 */
export async function resolveRequester(): Promise<Requester> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  const account = await currentAccount();

  if (isValidGuestId(existing)) return requesterFor(existing, account);

  const guestId = createGuestId();
  store.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: serverEnv().NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  });

  return requesterFor(guestId, account);
}

/** Read-only variant for server components, which cannot set cookies. */
export async function peekRequester(): Promise<Requester | null> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;

  return isValidGuestId(existing)
    ? requesterFor(existing, await currentAccount())
    : null;
}

/** Narrows the requester to the owner scope the repositories expect. */
export function ownerScope(requester: Requester): jobs.OwnerScope {
  return { guestId: requester.guestId, userId: requester.userId };
}

/**
 * The plan tier for this request, for callers that only need entitlement.
 *
 * Deliberately independent of the guest cookie. `peekRequester` returns null
 * when there is no guest id — which is the ordinary state of someone who has
 * just signed up and not converted anything yet — and treating that as
 * anonymous would show advertising to a signed-in visitor who is entitled to
 * none. Ownership needs a browser; entitlement only needs an account.
 */
export async function currentTier(): Promise<PlanTier> {
  return tierFor(await currentAccount());
}

export interface QuotaVerdict {
  allowed: boolean;
  reason?: string;
  used: number;
  limit: number;
}

/**
 * Checks the rolling conversion allowance, counted from the requester's own
 * job rows — the only place usage is recorded, now that there is no account to
 * accumulate it on.
 */
export async function checkQuota(requester: Requester): Promise<QuotaVerdict> {
  const limit = requester.limits.jobsPerPeriod;
  const days = requester.limits.periodDays;
  const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const used = await jobs.countForOwner(ownerScope(requester), {
    createdAt: { gte: periodStart },
    status: { not: JobStatus.CANCELLED },
  });

  if (used >= limit) {
    // Says what to do about it, and says it differently at each rung. A
    // premium user who somehow reaches the fair-use ceiling is not being
    // upsold anything — the honest answer there is when it resets.
    // The window word is derived, not written, so the sentence cannot drift
    // out of step with the table the way a hardcoded "a month" did when the
    // member allowance became a daily one.
    const freeWindow = PLANS.FREE.periodDays === 1 ? 'a day' : 'a month';

    // Never point someone at a plan they cannot buy. While payments are
    // unconfigured the honest answer to a member at their ceiling is when it
    // frees up, not an upsell to a checkout that does not exist.
    const nextStep =
      requester.tier === 'ANONYMOUS'
        ? ` Creating a free account raises this to ${PLANS.FREE.jobsPerPeriod} ${freeWindow}.`
        : requester.tier === 'FREE' && isPaddleConfigured
          ? ' Premium removes the limit.'
          : '';

    const window = days === 1 ? '24 hours' : `${days} days`;

    return {
      allowed: false,
      used,
      limit,
      reason: `You have used all ${limit.toLocaleString()} conversions in the last ${window}. The allowance is a rolling window, so it frees up as older conversions age out.${nextStep}`,
    };
  }

  return { allowed: true, used, limit };
}

/** Enforces the concurrent-conversion ceiling. */
export async function checkConcurrency(
  requester: Requester,
): Promise<{ allowed: boolean; reason?: string }> {
  const active = await jobs.countForOwner(ownerScope(requester), {
    status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
  });

  if (active >= requester.limits.concurrentJobs) {
    return {
      allowed: false,
      reason: `You already have ${active} conversion${active === 1 ? '' : 's'} in progress. Wait for ${
        requester.limits.concurrentJobs === 1 ? 'it' : 'them'
      } to finish before starting another.`,
    };
  }

  return { allowed: true };
}

/** Retention deadline for a new job. */
export function retentionDate(requester: Requester): Date {
  const hours = Math.min(
    requester.limits.retentionHours,
    serverEnv().FILE_RETENTION_HOURS,
  );
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
