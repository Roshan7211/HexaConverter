import 'server-only';

import { cookies } from 'next/headers';

import { JobStatus } from '@prisma/client';

import { serverEnv } from '@/lib/env';
import { LIMITS, USAGE_PERIOD_DAYS, type Limits } from '@/lib/plans';
import * as jobs from '@/database/repositories/job.repository';
import {
  createGuestId,
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  isValidGuestId,
} from '@/lib/security';

/**
 * Requester identity and quota enforcement.
 *
 * The service has no accounts, so a requester is only ever a browser. Each one
 * gets an opaque, http-only cookie holding a random id — enough to keep one
 * visitor's conversions private from another's and to hold everyone to the same
 * allowance, and nothing more. The value identifies no person, is never joined
 * to anything, and expires on its own.
 */

export interface Requester {
  /** Opaque per-browser id from the guest cookie. */
  guestId: string;
  /** Stable owner key used for signing storage tickets. */
  ownerKey: string;
  limits: Limits;
}

function requesterFor(guestId: string): Requester {
  return { guestId, ownerKey: `g:${guestId}`, limits: LIMITS };
}

/**
 * Resolves the current requester, creating the guest cookie when needed.
 * Only callable from route handlers and server actions, where cookies are
 * writable.
 */
export async function resolveRequester(): Promise<Requester> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;

  if (isValidGuestId(existing)) return requesterFor(existing);

  const guestId = createGuestId();
  store.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: serverEnv().NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  });

  return requesterFor(guestId);
}

/** Read-only variant for server components, which cannot set cookies. */
export async function peekRequester(): Promise<Requester | null> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;

  return isValidGuestId(existing) ? requesterFor(existing) : null;
}

/** Narrows the requester to the owner scope the repositories expect. */
export function ownerScope(requester: Requester): jobs.OwnerScope {
  return { guestId: requester.guestId };
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
  const periodStart = new Date(
    Date.now() - USAGE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );

  const used = await jobs.countForOwner(ownerScope(requester), {
    createdAt: { gte: periodStart },
    status: { not: JobStatus.CANCELLED },
  });

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      // There is nothing to upsell: the allowance is the same for everyone, so
      // the honest message is when it resets, not what to buy.
      reason: `You have used all ${limit.toLocaleString()} conversions in the last ${USAGE_PERIOD_DAYS} days. The allowance is a rolling window, so it frees up as older conversions age out.`,
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
