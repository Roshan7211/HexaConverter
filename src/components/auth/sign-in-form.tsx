'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
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
      const message = code
        ? describe(code, mode)
        : ((error as Error).message ?? '');
      // Empty for a closed popup — that is a decision, not a failure.
      if (message) toast.error(message);
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
