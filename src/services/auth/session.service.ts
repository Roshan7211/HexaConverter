import 'server-only';

import type { PlanTier, UserRole } from '@prisma/client';

import * as audit from '@/database/repositories/audit.repository';
import * as users from '@/database/repositories/user.repository';
import { logger } from '@/lib/logger';

/**
 * Session lifetime and revocation.
 *
 * Sessions are stateless JWTs, which are fast but, on their own, impossible to
 * withdraw before they expire. The account row carries a `sessionsValidFrom`
 * watermark and every token records when it was authenticated; a token older
 * than the watermark is refused. That buys back revocation — for a password
 * change, a reset, a deliberate "sign out everywhere" and a deleted account —
 * at the cost of one cached lookup per minute per session.
 */

/** Absolute session lifetime. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** How often an active session is re-issued with a fresh expiry. */
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

/**
 * How long a token may go without being re-checked against the database.
 *
 * This is the revocation delay: after signing out everywhere, other devices
 * keep working for at most this long. A minute keeps the database out of the
 * hot path for ordinary requests while staying far inside any useful window
 * for the person doing the revoking.
 */
export const SESSION_REVALIDATE_MS = 60_000;

export interface LiveSessionState {
  revoked: false;
  name: string | null;
  image: string | null;
  role: UserRole;
  plan: PlanTier;
  emailVerified: Date | null;
}

export type SessionState = LiveSessionState | { revoked: true };

/**
 * Re-checks a live session against the account it belongs to.
 *
 * A missing user means the account was deleted, which revokes just as firmly as
 * an explicit sign-out; returning the fresh role and plan alongside means a plan
 * upgrade takes effect on the same schedule without a second query.
 */
export async function resolveSessionState(
  userId: string,
  authenticatedAt: number,
): Promise<SessionState> {
  const user = await users.findSessionState(userId);
  if (!user) return { revoked: true };

  // Second resolution: a token issued in the same second as the revocation is
  // treated as older, so a race resolves in favour of revoking.
  if (authenticatedAt <= user.sessionsValidFrom.getTime()) {
    return { revoked: true };
  }

  return {
    revoked: false,
    name: user.name,
    image: user.image,
    role: user.role,
    plan: user.plan,
    emailVerified: user.emailVerified,
  };
}

/**
 * Signs the user out on every device, including the one asking.
 *
 * Deliberately not scoped to "other" devices: with stateless tokens there is no
 * per-device identity to exclude, and promising otherwise in the UI would be a
 * claim the implementation cannot keep.
 */
export async function signOutEverywhere(
  userId: string,
  ipHash: string,
): Promise<{ revokedAt: Date }> {
  const { sessionsValidFrom } = await users.revokeSessions(userId);

  await audit.record({
    actorId: userId,
    action: 'user.sessions_revoked',
    target: userId,
    ipHash,
  });

  logger.info('All sessions revoked', { userId });
  return { revokedAt: sessionsValidFrom };
}
