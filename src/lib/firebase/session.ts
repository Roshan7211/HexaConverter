import 'server-only';

import { cookies } from 'next/headers';

import { adminAuth, isAdminConfigured } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger';

/**
 * Server-side sessions, built on a Firebase session cookie.
 *
 * The browser holds an ID token that expires hourly and lives in JavaScript's
 * reach. That is fine for calling Google, and wrong for authenticating requests
 * to this server: it cannot be read during server rendering, and script on the
 * page can steal it. So sign-in trades it once for a session cookie, which is
 * `httpOnly` — unreadable from JavaScript — and arrives automatically on every
 * request, including the first one for a server-rendered page.
 *
 * The trade also means revocation works. Firebase checks the cookie against the
 * user's revocation time, so disabling an account or signing out everywhere
 * takes effect on the next request rather than whenever a stale token happens
 * to expire.
 */

export const SESSION_COOKIE = 'hexa_session';

/**
 * Two weeks, the longest Firebase will issue. It is a deliberate choice for a
 * file converter rather than a bank: being signed out mid-task is a real cost
 * here, and the cookie is revocable server-side, which is the protection that
 * actually matters.
 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export interface SessionUser {
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
}

/**
 * Verifies an ID token from the client and exchanges it for a session cookie.
 *
 * `true` on the second argument checks the token against Firebase's revocation
 * list rather than trusting its signature alone, so a token minted before an
 * account was disabled cannot be cashed in for a fortnight of access.
 */
export async function createSession(
  idToken: string,
): Promise<{ cookie: string; user: SessionUser } | null> {
  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);

    // An address is required: it is how the account is identified everywhere
    // else, and every enabled provider supplies one.
    if (!decoded.email) {
      logger.warn('Sign-in rejected: token carries no email address');
      return null;
    }

    const cookie = await auth.createSessionCookie(idToken, {
      expiresIn: MAX_AGE_SECONDS * 1000,
    });

    return {
      cookie,
      user: {
        firebaseUid: decoded.uid,
        email: decoded.email,
        emailVerified: Boolean(decoded.email_verified),
        displayName: (decoded.name as string | undefined) ?? null,
        photoUrl: (decoded.picture as string | undefined) ?? null,
      },
    };
  } catch (error) {
    // Expected whenever a token is expired, replayed or forged, so this is a
    // warning rather than an error. The reason is logged and never returned:
    // telling a caller *why* verification failed helps them iterate.
    logger.warn('ID token verification failed', { error });
    return null;
  }
}

/** Cookie attributes, shared by the set and clear paths so they cannot drift. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Off over plain HTTP so development works; on everywhere real.
    secure: process.env.NODE_ENV === 'production',
    // `lax` rather than `strict`: the cookie must survive the redirect back
    // from Google's sign-in, which `strict` would drop.
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;

/**
 * The signed-in person for the current request, or `null`.
 *
 * Safe to call from any server component or route handler: it returns null when
 * Firebase is unconfigured, when there is no cookie, and when the cookie is
 * expired or revoked. Callers cannot tell those apart, which is intended.
 */
export async function currentUser(): Promise<SessionUser | null> {
  if (!isAdminConfigured()) return null;

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    if (!decoded.email) return null;

    return {
      firebaseUid: decoded.uid,
      email: decoded.email,
      emailVerified: Boolean(decoded.email_verified),
      displayName: (decoded.name as string | undefined) ?? null,
      photoUrl: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    // A cookie that no longer verifies is indistinguishable from none at all.
    return null;
  }
}
