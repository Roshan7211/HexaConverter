'use client';

import { useState } from 'react';

import Link from 'next/link';

import { MailCheck, Send } from 'lucide-react';

import { requestPasswordReset } from '@/api/client/auth.client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldErrors, forgotPasswordSchema } from '@/api/schemas';

/**
 * Requests a reset link.
 *
 * The confirmation is shown for every valid address, whether or not it has an
 * account — the server answers identically, and the UI must not undo that by
 * distinguishing the cases.
 */
export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({
      email: String(form.get('email') ?? ''),
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(parsed.data.email);
      setSentTo(parsed.data.email);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The request could not be sent. Check your connection.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <MailCheck aria-hidden="true" />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If <strong>{sentTo}</strong> has an account, a reset link is on its
            way. It expires in an hour and can be used once.
          </AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">
          Nothing arrived? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-primary underline-offset-4 hover:underline"
          >
            try a different address
          </button>
          .
        </p>

        <Button variant="outline" className="w-full" asChild>
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

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
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email ? (
          <p id="email-error" className="text-xs text-destructive" role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" loading={submitting}>
        <Send aria-hidden="true" />
        Send reset link
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link
          href="/sign-in"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
