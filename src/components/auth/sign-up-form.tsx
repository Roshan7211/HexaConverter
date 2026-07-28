'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { UserPlus } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldErrors, registerSchema } from '@/api/schemas';

/** Account creation, followed by an automatic sign-in on success. */
export function SignUpForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      acceptTerms: accepted,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
        message?: string;
        verificationRequired?: boolean;
      };

      if (!response.ok) {
        if (body.fields) setErrors(body.fields);
        setFormError(body.error ?? 'The account could not be created.');
        return;
      }

      // Sign-in would be refused until the address is confirmed, so send the
      // user to the page that explains that rather than through a failure.
      if (body.verificationRequired) {
        toast.success(
          body.message ?? 'Check your inbox to confirm your email.',
        );
        router.push('/verify-email?status=required');
        return;
      }

      const result = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (!result || result.error) {
        toast.success('Account created. Sign in to continue.');
        router.push('/sign-in');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setFormError('The account could not be created. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          autoFocus
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
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

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="acceptTerms"
          checked={accepted}
          onCheckedChange={(value) => setAccepted(value === true)}
          aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
        />
        <Label
          htmlFor="acceptTerms"
          className="text-sm font-normal leading-snug"
        >
          I agree to the{' '}
          <Link
            href="/legal/terms"
            className="text-primary underline-offset-4 hover:underline"
          >
            terms of service
          </Link>{' '}
          and{' '}
          <Link
            href="/legal/privacy"
            className="text-primary underline-offset-4 hover:underline"
          >
            privacy policy
          </Link>
          .
        </Label>
      </div>
      {errors.acceptTerms ? (
        <p id="terms-error" className="text-xs text-destructive" role="alert">
          {errors.acceptTerms}
        </p>
      ) : null}

      <Button type="submit" className="w-full" loading={submitting}>
        <UserPlus aria-hidden="true" />
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/sign-in"
          className="text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
