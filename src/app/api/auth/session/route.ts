import { cookies } from 'next/headers';

import { errors, ok } from '@/api/responses';
import { sessionSchema } from '@/api/schemas';
import { claimGuestJobs } from '@/database/repositories/job.repository';
import { upsertFromClaims } from '@/database/repositories/user.repository';
import { GUEST_COOKIE, isValidGuestId } from '@/lib/security';
import { isAdminConfigured } from '@/lib/firebase/admin';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  sessionCookieOptions,
} from '@/lib/firebase/session';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';

/**
 * POST   /api/auth/session — sign in: exchange an ID token for a session cookie
 * DELETE /api/auth/session — sign out: clear it
 *
 * Sign-in itself happens in the browser against Firebase; this endpoint exists
 * so the server has something it can trust on subsequent requests. It verifies
 * the token, mirrors the profile into the local `User` row, and sets an
 * `httpOnly` cookie the browser cannot read.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'POST /api/auth/session',
  async (request) => {
    if (!isAdminConfigured()) {
      return errors.unavailable('Accounts are not enabled on this deployment.');
    }

    // Shares the `auth` bucket with the rest of sign-in: 10 attempts per 15
    // minutes. Verification is a network call to Google, so this also stops an
    // unauthenticated caller using the endpoint to generate traffic.
    const limited = enforceRateLimit('auth', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, sessionSchema);
    if (!body.success) return body.response;

    const session = await createSession(body.data.idToken);
    if (!session) {
      return errors.unauthorized('That sign-in could not be verified.');
    }

    // Mirrored after verification, never from the request. Failing here would
    // leave someone authenticated to Firebase but unknown locally, so the
    // cookie is only set once the row exists.
    const user = await upsertFromClaims(session.user);

    (await cookies()).set(
      SESSION_COOKIE,
      session.cookie,
      sessionCookieOptions(SESSION_MAX_AGE),
    );

    // Anything converted in this browser before signing in becomes part of the
    // account. Without this, someone who converts a file and then decides to
    // register watches their work vanish from their own history.
    //
    // Deliberately not fatal: the session is already valid, and failing the
    // whole sign-in because a backfill did not run would be the worse outcome.
    const guestId = (await cookies()).get(GUEST_COOKIE)?.value;
    if (isValidGuestId(guestId)) {
      try {
        const claimed = await claimGuestJobs(guestId, user.id);
        if (claimed > 0) {
          logger.info('Claimed guest conversions on sign-in', {
            userId: user.id,
            claimed,
          });
        }
      } catch (error) {
        logger.warn('Could not claim guest conversions', { error });
      }
    }

    logger.info('Session established', { userId: user.id });

    return ok({
      user: {
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
      },
    });
  },
);

export const DELETE = withErrorHandling(
  'DELETE /api/auth/session',
  async () => {
    // Unconditional: signing out must work even when the cookie is already
    // expired, invalid or absent, and must never report why.
    (await cookies()).set(SESSION_COOKIE, '', sessionCookieOptions(0));
    return ok({ signedOut: true });
  },
);
