import 'server-only';

import { AuthTokenType } from '@prisma/client';

import * as audit from '@/database/repositories/audit.repository';
import * as users from '@/database/repositories/user.repository';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  consumeToken,
  issueToken,
  rejectionMessage,
  type TokenRejection,
} from '@/services/auth/token.service';
import { isMailEnabled } from '@/services/mail/mail.service';
import { sendVerificationEmail } from '@/services/mail/auth-mail.service';

/**
 * Email address confirmation.
 *
 * Verification is always offered and only enforced when
 * `REQUIRE_EMAIL_VERIFICATION` is set, so a deployment without SMTP still has
 * working sign-in rather than a silent lockout.
 */

/** Same reply for every outcome, so resend cannot enumerate accounts. */
export const VERIFICATION_SENT_MESSAGE =
  'If that address needs confirming, a new link is on its way.';

export function isVerificationRequired(): boolean {
  return serverEnv().REQUIRE_EMAIL_VERIFICATION;
}

/**
 * Sends a confirmation link. Safe to call for any user: already-verified
 * accounts and disabled mail are no-ops.
 */
export async function sendVerification(input: {
  userId: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  ipHash?: string;
}): Promise<boolean> {
  if (input.emailVerified) return false;

  if (!isMailEnabled()) {
    logger.info('Verification email skipped; SMTP is not configured', {
      userId: input.userId,
    });
    return false;
  }

  const issued = await issueToken({
    userId: input.userId,
    type: AuthTokenType.EMAIL_VERIFICATION,
    ipHash: input.ipHash,
  });
  if (!issued) return false;

  const sent = await sendVerificationEmail({
    to: input.email,
    name: input.name,
    token: issued.token,
    ttlMs: issued.ttlMs,
  });

  logger.info('Verification email dispatched', {
    userId: input.userId,
    delivered: sent,
  });
  return sent;
}

/** Re-sends by address. Never reports whether the address is registered. */
export async function resendVerification(input: {
  email: string;
  ipHash: string;
}): Promise<void> {
  const user = await users.findByEmail(input.email);
  if (!user) return;

  await sendVerification({
    userId: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    ipHash: input.ipHash,
  });
}

export type VerificationResult =
  | { ok: true; email: string; alreadyVerified: boolean }
  | { ok: false; reason: TokenRejection; message: string };

export async function verifyEmail(input: {
  token: string;
  ipHash: string;
}): Promise<VerificationResult> {
  const consumed = await consumeToken(
    input.token,
    AuthTokenType.EMAIL_VERIFICATION,
  );

  if (!consumed.ok) {
    return {
      ok: false,
      reason: consumed.reason,
      message: rejectionMessage(consumed.reason),
    };
  }

  const marked = await users.markEmailVerified(consumed.userId);

  if (marked) {
    await audit.record({
      actorId: consumed.userId,
      action: 'user.email_verified',
      target: consumed.userId,
      ipHash: input.ipHash,
    });
    logger.info('Email address verified', { userId: consumed.userId });
  }

  return {
    ok: true,
    email: consumed.user.email,
    alreadyVerified: !marked,
  };
}
