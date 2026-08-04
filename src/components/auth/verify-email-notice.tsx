'use client';

import { useState } from 'react';

import { sendEmailVerification } from 'firebase/auth';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { firebaseAuth } from '@/lib/firebase/client';

/**
 * Prompt to confirm the address, shown only while it is unverified.
 *
 * Verification is not enforced anywhere yet, and that is deliberate: nothing on
 * this site is gated behind an account, so blocking an unverified one would
 * withhold something nobody is being given. It matters later, when a
 * subscription is attached to the address and a reset email has to reach a
 * mailbox the person actually controls.
 */
export function VerifyEmailNotice() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    const auth = firebaseAuth();
    const user = auth?.currentUser;

    // The session cookie can outlive the browser SDK's own state — a reload
    // leaves this server sure who you are while the client has not restored
    // yet. Nothing to resend to in that case.
    if (!user) {
      toast.error('Sign in again to resend the verification email.');
      return;
    }

    setBusy(true);
    try {
      await sendEmailVerification(user);
      setSent(true);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      toast.error(
        code === 'auth/too-many-requests'
          ? 'Too many requests. Try again in a few minutes.'
          : 'Could not send the email. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        {sent
          ? 'Verification email sent. Check your inbox, then reload this page.'
          : 'Your email address has not been confirmed yet.'}
      </p>
      {sent ? null : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void resend()}
          loading={busy}
        >
          Send verification email
        </Button>
      )}
    </div>
  );
}
