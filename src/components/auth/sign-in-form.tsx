'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
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
    case 'auth/cancelled-popup-request':
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

  async function withGoogle() {
    if (busy || !auth) return;
    setBusy(true);

    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await establishSession(await credential.user.getIdToken());
      router.push('/');
      router.refresh();
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';

      // A pop-up is the nicer flow when it works, and on mobile it frequently
      // does not: iOS Safari blocks windows it does not consider a direct
      // result of the tap, and in-app browsers often have no pop-ups at all.
      // The failure is silent from the visitor's side — they tap, nothing
      // happens — so fall back to sending them to Google in this tab instead
      // of reporting an error they cannot act on.
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return; // The page navigates away; `busy` no longer matters.
        } catch {
          toast.error('Could not reach Google. Please try again.');
        }
      } else {
        const message = code
          ? describe(code, mode)
          : ((error as Error).message ?? '');
        // Empty for a closed popup — that is a decision, not a failure.
        if (message) toast.error(message);
      }
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
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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
