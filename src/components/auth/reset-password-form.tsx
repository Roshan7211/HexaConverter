'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { KeyRound, ShieldCheck } from 'lucide-react';

import { resetPassword } from '@/api/client/auth.client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldErrors, resetPasswordSchema } from '@/api/schemas';

/**
 * Sets a new password from an emailed link.
 *
 * The token comes from the query string and is never rendered into the page or
 * a link, so it does not travel on to anything the user clicks next.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>No reset link found</AlertTitle>
          <AlertDescription>
            Open the link from your email, or request a new one.
          </AlertDescription>
        </Alert>
        <Button className="w-full" asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            Every device has been signed out. Sign in with your new password.
          </AlertDescription>
        </Alert>
        <Button className="w-full" asChild>
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirmPassword') ?? '');

    if (password !== confirm) {
      setErrors({ confirmPassword: 'Both passwords must match' });
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(parsed.data.token, parsed.data.password);
      setDone(true);
      // The old session, if any, is dead server-side; drop any cached copy.
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The password could not be reset. Check your connection.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {formError}{' '}
            <Link
              href="/forgot-password"
              className="underline underline-offset-4"
            >
              Request a new link
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 10 characters, including a number or symbol.
        </p>
        {errors.password ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.password}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.confirmPassword)}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.confirmPassword}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" loading={submitting}>
        <KeyRound aria-hidden="true" />
        Set new password
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Setting a new password signs you out on every device.
      </p>
    </form>
  );
}
