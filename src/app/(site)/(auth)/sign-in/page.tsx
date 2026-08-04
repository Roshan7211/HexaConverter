import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/auth/sign-in-form';
import { currentUser } from '@/lib/firebase/session';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Sign in',
  description:
    'Sign in to keep your conversion history. Converting files never requires an account.',
  path: '/sign-in',
  noIndex: true,
});

export default async function SignInPage() {
  if (await currentUser()) redirect('/');

  return (
    <div className="container flex justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Converting files never needs an account. Signing in just keeps your
            history in one place.
          </p>
        </div>

        <SignInForm mode="sign-in" />

        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
