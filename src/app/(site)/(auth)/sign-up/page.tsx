import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/auth/sign-in-form';
import { currentUser } from '@/lib/firebase/session';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Create an account',
  description:
    'Create an account to keep your conversion history. Converting files never requires one.',
  path: '/sign-up',
  noIndex: true,
});

export default async function SignUpPage() {
  if (await currentUser()) redirect('/');

  return (
    <div className="container flex justify-center py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create an account
          </h1>
          <p className="text-sm text-muted-foreground">
            Optional, and free. Every conversion works without one — an account
            only keeps your history together.
          </p>
        </div>

        <SignInForm mode="sign-up" />

        <p className="text-center text-sm text-muted-foreground">
          Already have one?{' '}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
