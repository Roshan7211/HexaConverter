'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Browser-side Firebase, initialised lazily and exactly once.
 *
 * These values are public by design: they are compiled into the client bundle
 * and visible to anyone who opens dev tools. They are identifiers, not secrets.
 * What actually protects the project is the authorised-domain list in the
 * Firebase console and the fact that every privileged action is re-checked on
 * the server against a verified token — never the confidentiality of the key.
 *
 * Read through `NEXT_PUBLIC_*`, so they are inlined at build time. Changing a
 * value means a rebuild, not a restart; a deployment that only reloads the
 * process keeps serving the previous project's configuration.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Whether the build carries a complete Firebase configuration. */
export const isFirebaseConfigured = Object.values(config).every(Boolean);

/**
 * Returns the singleton app, or `null` when the build has no Firebase
 * configuration.
 *
 * Null rather than a thrown error on purpose: the site has to keep converting
 * files for anonymous visitors whether or not accounts are set up, so callers
 * hide the sign-in affordances instead of the page failing to render.
 */
export function firebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  return getApps().length > 0
    ? getApp()
    : initializeApp(config as Required<typeof config>);
}

/** The Auth instance, or `null` when Firebase is not configured. */
export function firebaseAuth(): Auth | null {
  const app = firebaseApp();
  return app ? getAuth(app) : null;
}
