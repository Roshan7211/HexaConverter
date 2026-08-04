import 'server-only';

import type { PlanTier } from '@prisma/client';

import { prisma } from '@/database/client';

/**
 * Data access for signed-in people.
 *
 * Every field here is a cache of what Firebase holds. Nothing in this file
 * should ever be written from a request body — the only acceptable source is a
 * token this server has verified, because a caller who can name their own UID
 * or email address can take over someone else's row.
 */

export interface UserRecord {
  id: string;
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
  planTier: PlanTier;
  premiumUntil: Date | null;
}

const columns = {
  id: true,
  firebaseUid: true,
  email: true,
  emailVerified: true,
  displayName: true,
  photoUrl: true,
  planTier: true,
  premiumUntil: true,
} as const;

/**
 * Creates the row on first sign-in and refreshes the cached profile on every
 * later one.
 *
 * Keyed on `firebaseUid` rather than the address so that changing an email —
 * or signing in with Google after registering with a password — updates the
 * same person instead of colliding with them.
 */
export function upsertFromClaims(claims: {
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string | null;
  photoUrl?: string | null;
}): Promise<UserRecord> {
  const profile = {
    email: claims.email,
    emailVerified: claims.emailVerified,
    displayName: claims.displayName ?? null,
    photoUrl: claims.photoUrl ?? null,
  };

  return prisma.user.upsert({
    where: { firebaseUid: claims.firebaseUid },
    create: { firebaseUid: claims.firebaseUid, ...profile },
    update: { ...profile, lastSeenAt: new Date() },
    select: columns,
  });
}

export function findByFirebaseUid(
  firebaseUid: string,
): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { firebaseUid },
    select: columns,
  });
}

/**
 * Lookup by address, for matching a payment to an account.
 *
 * Only used by the Paddle webhook, where the buyer's email is the only link
 * between a transaction and a person. Never used to authenticate anybody —
 * knowing an address proves nothing.
 */
export function findByEmail(email: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: columns,
  });
}

/**
 * Removes the local row. The Firebase user must be deleted separately —
 * dropping one and leaving the other strands an account that can still sign in
 * but owns nothing, or a row nobody can reach.
 */
export async function deleteByFirebaseUid(firebaseUid: string): Promise<void> {
  await prisma.user.deleteMany({ where: { firebaseUid } });
}
