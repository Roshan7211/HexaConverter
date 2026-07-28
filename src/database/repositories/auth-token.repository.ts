import 'server-only';

import type { AuthTokenType } from '@prisma/client';

import { prisma } from '@/database/client';

/**
 * Data access for emailed, single-use auth tokens.
 *
 * Rows are looked up by digest only — no query in here accepts a plaintext
 * token, so the secret cannot reach the database layer by accident.
 */

export interface IssueTokenInput {
  userId: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
  ipHash?: string;
}

export function issue(input: IssueTokenInput) {
  return prisma.authToken.create({
    data: input,
    select: { id: true, expiresAt: true },
  });
}

export function findByHash(tokenHash: string) {
  return prisma.authToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      type: true,
      expiresAt: true,
      consumedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          passwordHash: true,
        },
      },
    },
  });
}

/**
 * Marks a token used, but only if it is still unused.
 *
 * The `consumedAt: null` guard makes this an atomic compare-and-set: two
 * requests racing on the same link produce one winner and one miss, so a reset
 * link cannot be redeemed twice.
 */
export async function consume(id: string): Promise<boolean> {
  const result = await prisma.authToken.updateMany({
    where: { id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return result.count === 1;
}

/**
 * Invalidates a user's outstanding tokens of one kind.
 *
 * Issuing a new link retires the previous ones, so a forwarded or shoulder-read
 * older email stops working the moment the user asks for another.
 */
export function revokeOutstanding(userId: string, type: AuthTokenType) {
  return prisma.authToken.updateMany({
    where: { userId, type, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

/** Number of tokens of one kind issued to a user since an instant. */
export function countIssuedSince(
  userId: string,
  type: AuthTokenType,
  since: Date,
) {
  return prisma.authToken.count({
    where: { userId, type, createdAt: { gte: since } },
  });
}

/** Sweeps spent and expired rows; called by the cleanup cron. */
export function pruneExpired(now = new Date()) {
  return prisma.authToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        // Consumed rows are kept briefly so a double-click reports "already
        // used" rather than "unknown link", then swept with everything else.
        { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
}
