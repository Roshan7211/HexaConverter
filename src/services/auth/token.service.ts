import 'server-only';

import type { AuthTokenType } from '@prisma/client';

import * as tokens from '@/database/repositories/auth-token.repository';
import {
  AUTH_TOKEN_TTL_MS,
  createAuthToken,
  hashAuthToken,
  isWellFormedAuthToken,
} from '@/lib/security';

/**
 * Issue and redemption of emailed link secrets.
 *
 * Both the reset and verification flows go through here so the security
 * properties — single use, expiry, replacement of outstanding links, and a
 * per-user issue ceiling — are stated once instead of being re-derived, and
 * differently, in each flow.
 */

/**
 * Links a user may request per hour, per purpose.
 *
 * IP rate limits alone do not protect the *recipient*: an attacker rotating
 * addresses could otherwise use the form to flood someone else's inbox.
 */
const MAX_TOKENS_PER_HOUR = 5;

export interface IssuedToken {
  /** Plaintext, for the email only. */
  token: string;
  expiresAt: Date;
  ttlMs: number;
}

/**
 * Mints a link, retiring any outstanding link of the same kind.
 *
 * Returns null when the user has asked too often, which callers report as
 * success anyway — a "you have requested too many" reply would confirm the
 * address exists.
 */
export async function issueToken(input: {
  userId: string;
  type: AuthTokenType;
  ipHash?: string;
}): Promise<IssuedToken | null> {
  const recent = await tokens.countIssuedSince(
    input.userId,
    input.type,
    new Date(Date.now() - 60 * 60 * 1000),
  );
  if (recent >= MAX_TOKENS_PER_HOUR) return null;

  await tokens.revokeOutstanding(input.userId, input.type);

  const ttlMs = AUTH_TOKEN_TTL_MS[input.type];
  const { token, tokenHash } = createAuthToken();
  const expiresAt = new Date(Date.now() + ttlMs);

  await tokens.issue({
    userId: input.userId,
    type: input.type,
    tokenHash,
    expiresAt,
    ipHash: input.ipHash,
  });

  return { token, expiresAt, ttlMs };
}

export type TokenRejection = 'invalid' | 'expired' | 'used';

export type ConsumedToken =
  | {
      ok: true;
      userId: string;
      user: {
        id: string;
        email: string;
        name: string | null;
        emailVerified: Date | null;
        passwordHash: string | null;
      };
    }
  | { ok: false; reason: TokenRejection };

/**
 * Validates a link and marks it spent in one step.
 *
 * A token is only ever redeemed for the purpose it was issued for, so a
 * verification link cannot be presented to the password reset endpoint.
 */
export async function consumeToken(
  token: unknown,
  type: AuthTokenType,
): Promise<ConsumedToken> {
  if (!isWellFormedAuthToken(token)) return { ok: false, reason: 'invalid' };

  const record = await tokens.findByHash(hashAuthToken(token));

  // An unknown digest and a mismatched purpose are the same answer, so probing
  // with a valid token of the wrong kind reveals nothing.
  if (!record || record.type !== type) return { ok: false, reason: 'invalid' };
  if (record.consumedAt) return { ok: false, reason: 'used' };
  if (record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  // Claim it before acting on it; a concurrent redemption loses here.
  const claimed = await tokens.consume(record.id);
  if (!claimed) return { ok: false, reason: 'used' };

  return { ok: true, userId: record.userId, user: record.user };
}

/** Wording for a rejected link, shared by every page that can show one. */
export function rejectionMessage(reason: TokenRejection): string {
  switch (reason) {
    case 'expired':
      return 'This link has expired. Request a new one to continue.';
    case 'used':
      return 'This link has already been used. Request a new one if you still need it.';
    default:
      return 'This link is not valid. Check that you copied the whole address, or request a new one.';
  }
}
