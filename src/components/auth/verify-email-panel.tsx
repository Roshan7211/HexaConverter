'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { MailCheck, MailWarning, Send, ShieldCheck } from 'lucide-react';

import { resendVerification, verifyEmail } from '@/api/client/auth.client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldErrors, resendVerificationSchema } from '@/api/schemas';

type Outcome =
  | { kind: 'idle' }
  | { kind: 'verified'; message: string }
  | { kind: 'failed'; message: string }
  | { kind: 'resent'; message: string };

/**
 * Email confirmation.
 *
 * Confirming is a button press rather than something that happens on page load:
 * the token is single-use, and mail scanners and link previewers routinely
 * fetch URLs before a person ever sees them. A GET that spent the token would
 * hand the user a link that is already dead.
 */
export function VerifyEmailPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  // Set when sign-in was refused because the address is not yet confirmed.
  const required = searchParams.get('status') === 'required';

  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);

  async function confirm() {
    setConfirming(true);
    try {
      const result = await verifyEmail(token);
      setOutcome({ kind: 'verified', message: result.message });
    } catch (error) {
      setOutcome({
        kind: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'The address could not be confirmed. Check your connection.',
      });
    } finally {
      setConfirming(false);
    }
  }

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = resendVerificationSchema.safeParse({
      email: String(form.get('email') ?? ''),
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setResending(true);
    try {
      const result = await resendVerification(parsed.data.email);
      setOutcome({ kind: 'resent', message: result.message });
    } catch (error) {
      setOutcome({
        kind: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'The link could not be sent. Check your connection.',
      });
    } finally {
      setResending(false);
    }
  }

  if (outcome.kind === 'verified') {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Email confirmed</AlertTitle>
          <AlertDescription>{outcome.message}</AlertDescription>
        </Alert>
        <Button className="w-full" asChild>
          <Link href="/sign-in">Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  // A token in the URL means the user followed a link: offer the one action
  // that matters, and fall back to the resend form only if it fails.
  if (token && outcome.kind !== 'failed' && outcome.kind !== 'resent') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Confirm that this address belongs to you to finish setting up your
          account.
        </p>
        <Button
          className="w-full"
          loading={confirming}
          onClick={() => void confirm()}
        >
          <MailCheck aria-hidden="true" />
          Confirm my email address
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {outcome.kind === 'failed' ? (
        <Alert variant="destructive">
          <MailWarning aria-hidden="true" />
          <AlertTitle>That link did not work</AlertTitle>
          <AlertDescription>{outcome.message}</AlertDescription>
        </Alert>
      ) : null}

      {outcome.kind === 'resent' ? (
        <Alert variant="success">
          <MailCheck aria-hidden="true" />
          <AlertTitle>Link sent</AlertTitle>
          <AlertDescription>{outcome.message}</AlertDescription>
        </Alert>
      ) : null}

      {required && outcome.kind === 'idle' ? (
        <Alert variant="warning">
          <MailWarning aria-hidden="true" />
          <AlertTitle>Confirm your address to sign in</AlertTitle>
          <AlertDescription>
            This account still needs its email address confirmed. Enter it below
            and we will send another link.
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={resend} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" loading={resending}>
          <Send aria-hidden="true" />
          Send me a new link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/sign-in"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
