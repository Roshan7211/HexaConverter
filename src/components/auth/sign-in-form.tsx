'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { LogIn } from 'lucide-react';
import { signIn } from 'next-auth/react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { credentialsSchema, fieldErrors } from '@/api/schemas';

/**
 * Credential sign-in.
 *
 * The failure message is deliberately identical for an unknown address and a
 * wrong password so the form cannot be used to discover which emails are
 * registered.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(
    searchParams.get('error')
      ? 'Sign-in failed. Check your details and try again.'
      : null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    const result = await signIn('credentials', {
      ...parsed.data,
      redirect: false,
      callbackUrl,
    });
    setSubmitting(false);

    if (!result || result.error) {
      setFormError('That email and password combination is not correct.');
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.password)}
        />
      </div>

      <Button type="submit" className="w-full" loading={submitting}>
        <LogIn aria-hidden="true" />
        Sign in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link
          href="/sign-up"
          className="text-primary underline-offset-4 hover:underline"
        >
          Create a free account
        </Link>
      </p>
    </form>
  );
}
