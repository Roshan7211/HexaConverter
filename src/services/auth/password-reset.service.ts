import 'server-only';

import { AuthTokenType } from '@prisma/client';

import * as audit from '@/database/repositories/audit.repository';
import * as users from '@/database/repositories/user.repository';
import { logger } from '@/lib/logger';
import { hashPassword } from '@/services/account/account.service';
import {
  consumeToken,
  issueToken,
  rejectionMessage,
  type TokenRejection,
} from '@/services/auth/token.service';
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from '@/services/mail/auth-mail.service';

/**
 * Forgotten-password recovery.
 *
 * The request step is deliberately uninformative: unknown address, address
 * registered through Google or GitHub, and address with a password all produce
 * the same response and similar work, so the form cannot be used to discover
 * who has an account or how they sign in.
 */

/** Always the same, whatever actually happened. */
export const RESET_REQUEST_MESSAGE =
  'If that address has an account, a reset link is on its way. Check your inbox, and your spam folder.';

export async function requestPasswordReset(input: {
  email: string;
  ipHash: string;
}): Promise<void> {
  const user = await users.findByEmail(input.email);

  if (!user) {
    logger.info('Password reset requested for unknown address', {
      ipHash: input.ipHash,
    });
    return;
  }

  // OAuth-only accounts have no password to reset. Sending a link anyway would
  // let someone with mailbox access convert a Google account into a password
  // one, which is a privilege escalation, not a convenience.
  if (!user.passwordHash) {
    logger.info('Password reset requested for a provider-only account', {
      userId: user.id,
    });
    return;
  }

  const issued = await issueToken({
    userId: user.id,
    type: AuthTokenType.PASSWORD_RESET,
    ipHash: input.ipHash,
  });

  // Over the per-user ceiling: stay silent rather than confirm the address.
  if (!issued) return;

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    token: issued.token,
    ttlMs: issued.ttlMs,
  });

  await audit.record({
    actorId: user.id,
    action: 'user.password_reset_requested',
    target: user.id,
    ipHash: input.ipHash,
  });

  logger.info('Password reset link sent', { userId: user.id });
}

export type ResetResult =
  | { ok: true; email: string }
  | { ok: false; reason: TokenRejection; message: string };

/**
 * Redeems a reset link.
 *
 * Completing a reset also verifies the address — the user just proved they read
 * mail sent to it — and revokes every existing session, because a reset is
 * exactly the moment you want other devices logged out.
 */
export async function resetPassword(input: {
  token: string;
  newPassword: string;
  ipHash: string;
}): Promise<ResetResult> {
  const consumed = await consumeToken(
    input.token,
    AuthTokenType.PASSWORD_RESET,
  );

  if (!consumed.ok) {
    logger.info('Password reset link rejected', {
      reason: consumed.reason,
      ipHash: input.ipHash,
    });
    return {
      ok: false,
      reason: consumed.reason,
      message: rejectionMessage(consumed.reason),
    };
  }

  // `updatePassword` bumps `sessionsValidFrom`, so every session anywhere —
  // including the attacker's, if this was a recovery — stops working now.
  await users.updatePassword(
    consumed.userId,
    await hashPassword(input.newPassword),
  );
  await users.markEmailVerified(consumed.userId);

  await audit.record({
    actorId: consumed.userId,
    action: 'user.password_reset_completed',
    target: consumed.userId,
    ipHash: input.ipHash,
  });

  await sendPasswordChangedEmail({
    to: consumed.user.email,
    name: consumed.user.name,
  });

  logger.info('Password reset completed', { userId: consumed.userId });
  return { ok: true, email: consumed.user.email };
}
