'use client';

import { useState } from 'react';

import { sendPasswordResetEmail } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { firebaseAuth } from '@/lib/firebase/client';

/**
 * Password reset request.
 *
 * Firebase sends and handles the email; nothing about it touches this server,
 * which is the point of delegating authentication in the first place.
 *
 * The outcome is always the same message whether or not the address exists.
 * Reporting "no account with that email" would turn this form into a way to
 * test which addresses are registered, and it is a public, unauthenticated
 * endpoint. The same reason `auth/user-not-found` is swallowed below.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const auth = firebaseAuth();

  if (!auth) {
    return (
      <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Accounts are not enabled on this deployment.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !auth) return;
    setBusy(true);

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      // Rate limiting is worth surfacing; everything else is deliberately
      // indistinguishable from success.
      if (code === 'auth/too-many-requests') {
        setBusy(false);
        setSent(false);
        return;
      }
    }

    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div
        className="rounded-xl border border-success/40 bg-success/5 p-4 text-sm"
        role="status"
      >
        <p className="font-medium">Check your inbox.</p>
        <p className="mt-1 text-muted-foreground">
          If an account exists for {email || 'that address'}, a reset link is on
          its way. It expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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

      <Button type="submit" className="w-full" loading={busy}>
        Send reset link
      </Button>
    </form>
  );
}
