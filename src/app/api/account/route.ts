import { cookies } from 'next/headers';

import { errors, ok } from '@/api/responses';
import { deleteByFirebaseUid } from '@/database/repositories/user.repository';
import { adminAuth, isAdminConfigured } from '@/lib/firebase/admin';
import {
  SESSION_COOKIE,
  currentUser,
  sessionCookieOptions,
} from '@/lib/firebase/session';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';

/**
 * DELETE /api/account
 *
 * Closes the account: removes the Firebase user, the local row and the session.
 *
 * The order matters. Firebase goes first, because that is what allows anyone to
 * sign in — if the process dies halfway, the outcome is a local row nobody can
 * reach rather than a live login whose data is gone. The reverse would leave
 * someone able to sign in and be handed a brand new empty account, which looks
 * exactly like deletion having silently failed.
 *
 * Conversions are not touched. They belong to the browser's guest cookie, not
 * to the account, and are swept by the retention pass on their own schedule.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withErrorHandling('DELETE /api/account', async (request) => {
  if (!isAdminConfigured()) {
    return errors.unavailable('Accounts are not enabled on this deployment.');
  }

  const limited = enforceRateLimit('auth', request);
  if (limited) return limited;

  // Read from the verified session, never from the request. A uid in the body
  // would let any caller delete any account.
  const user = await currentUser();
  if (!user) return errors.unauthorized('Sign in to close your account.');

  await adminAuth().deleteUser(user.firebaseUid);
  await deleteByFirebaseUid(user.firebaseUid);

  (await cookies()).set(SESSION_COOKIE, '', sessionCookieOptions(0));

  logger.info('Account deleted');

  return ok({ deleted: true });
});
