'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithRedirect,
} from 'firebase/auth';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { firebaseAuth } from '@/lib/firebase/client';

/**
 * Sign-in and registration, in one form.
 *
 * The two differ by a single Firebase call and the wording, so splitting them
 * across two pages would duplicate the layout, the Google button and the error
 * handling to no benefit.
 *
 * Both paths end the same way: Firebase mints an ID token in the browser, and
 * that token is posted to `/api/auth/session`, which is what actually signs the
 * person in as far as this server is concerned. Until that request succeeds
 * nothing is signed in, which is why its failure is surfaced rather than
 * swallowed.
 */

type Mode = 'sign-in' | 'sign-up';

/** Firebase error codes mapped to something worth reading. */
function describe(code: string, mode: Mode): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // One message for all three on purpose: distinguishing them tells an
      // attacker which addresses are registered.
      return 'That email and password do not match.';
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a password of at least six characters.';
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/popup-closed-by-user':
      // Reported both when someone genuinely closes the window and when the
      // flow fails and the window closes itself. Staying silent was wrong for
      // the second case: the visitor taps, nothing happens, and there is
      // nothing to act on or report. A short message covers both honestly.
      return 'The Google window closed before sign-in finished. Try again, or use your email and password below.';
    case 'auth/cancelled-popup-request':
      // Genuinely internal: a second request superseded the first.
      return '';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site, or try again — we will send you to Google directly.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised in Firebase.';
    default:
      return mode === 'sign-up'
        ? 'Could not create the account. Please try again.'
        : 'Could not sign in. Please try again.';
  }
}

/**
 * Google's four-colour mark, inline.
 *
 * The button was text alone, which reads as a generic control — the mark is
 * what people scan for and what makes the button look like the trusted path.
 * Inline rather than an image so it needs no network request and cannot be
 * blocked; drawn from Google's published brand paths and left uncoloured by
 * our theme, which their branding guidelines require.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function SignInForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const auth = firebaseAuth();

  /**
   * Finishes a redirect sign-in when the browser comes back from Google.
   *
   * The pop-up path resolves inside the same page, so it can act on the result
   * directly. A redirect does not: the visitor returns on a fresh page load,
   * and without this they arrive signed in to Firebase but with no session
   * cookie — indistinguishable, from their side, from the sign-in having
   * silently failed.
   *
   * Declared above the early return below because hooks cannot run
   * conditionally; the effect itself does nothing when Firebase is absent.
   */
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;

    void getRedirectResult(auth)
      .then(async (credential) => {
        // Null on an ordinary page load that did not come back from Google.
        if (!credential || cancelled) return;

        setBusy(true);
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: await credential.user.getIdToken() }),
        });
        if (!response.ok) throw new Error('Could not start your session.');

        router.push('/');
        router.refresh();
      })
      .catch((error: unknown) => {
        const code = (error as { code?: string })?.code ?? '';
        const message = code
          ? describe(code, mode)
          : ((error as Error).message ?? '');
        if (message) toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth, mode, router]);

  // Rendered rather than thrown: a build without Firebase configured should
  // still serve this page, just without a broken form on it.
  if (!auth) {
    return (
      <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Accounts are not enabled on this deployment.
      </p>
    );
  }

  /** Trades the Firebase token for this site's session cookie. */
  async function establishSession(idToken: string) {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? 'Could not start your session.');
    }
  }

  async function withEmail(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !auth) return;
    setBusy(true);

    try {
      const credential =
        mode === 'sign-up'
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);

      await establishSession(await credential.user.getIdToken());
      router.push('/');
      router.refresh();
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      const message = code
        ? describe(code, mode)
        : ((error as Error).message ?? '');
      if (message) toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Google sign-in, by redirect rather than pop-up.
   *
   * The pop-up is the slicker flow and it does not work here. Traced against
   * production: the window opens on our own auth handler, reaches Google's
   * sign-in page correctly, and then fails during Firebase's handoff back to
   * the opener — the visitor lands back on this page signed out, and the SDK
   * reports only `popup-closed-by-user`. Every part we control checks out: the
   * handler is byte-identical to Firebase's own, the domain is authorised, the
   * OAuth redirect URI is registered, the CSP permits the frame and the script.
   *
   * The redirect flow does not use that handoff, and it demonstrably works —
   * on mobile, where pop-ups were blocked, this path was already succeeding.
   * So it becomes the only path: a whole-page navigation is a smaller price
   * than a sign-in button that silently does nothing, and it sidesteps pop-up
   * blockers everywhere as a bonus. `getRedirectResult` above completes it.
   */
  async function withGoogle() {
    if (busy || !auth) return;
    setBusy(true);

    try {
      await signInWithRedirect(auth, new GoogleAuthProvider());
      // The browser leaves this page; `busy` stops mattering.
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      const message = code
        ? describe(code, mode)
        : ((error as Error).message ?? '');
      toast.error(message || 'Could not reach Google. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void withGoogle()}
        disabled={busy}
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={withEmail} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === 'sign-in' ? (
              <Link
                href="/forgot-password"
                className="inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [@media(pointer:coarse)]:-my-3.5 [@media(pointer:coarse)]:py-3.5"
              >
                Forgot it?
              </Link>
            ) : null}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete={
              mode === 'sign-up' ? 'new-password' : 'current-password'
            }
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </div>

        <Button type="submit" className="w-full" loading={busy}>
          {mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
