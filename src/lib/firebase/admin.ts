import 'server-only';

import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Server-side Firebase, for verifying what the browser claims.
 *
 * A token arriving from a client is just a string until this verifies its
 * signature and expiry. Nothing on the server should ever trust a UID, an email
 * or a plan tier that came from the request body — only what comes back from
 * `verifySessionCookie` or `verifyIdToken` here.
 *
 * The service-account credential can impersonate any user and bypasses every
 * rule, so unlike the client configuration it is a genuine secret: runtime-only
 * (never `NEXT_PUBLIC_`), and it belongs in `.env` with `chmod 600`, never in
 * the repository.
 */

/**
 * PEM keys are multi-line, and `.env` files are not. The value is stored with
 * literal backslash-n and restored here — the single most common cause of
 * `Failed to parse private key` on a first deployment, because the variable
 * looks perfectly correct in the file.
 */
function privateKey(): string | undefined {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

/** Whether the server has a complete admin credential. */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    privateKey(),
  );
}

/**
 * The Admin Auth instance.
 *
 * Throws when unconfigured rather than returning null, which is the opposite of
 * the client helper and deliberate: this is only ever reached from routes that
 * exist to authenticate somebody. Failing loudly there is right, because the
 * alternative is a route that quietly treats every caller as signed out.
 */
export function adminAuth(): Auth {
  if (!isAdminConfigured()) {
    throw new Error(
      'Firebase admin is not configured. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID, ' +
        'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
    );
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey(),
          }),
        });

  return getAuth(app);
}
