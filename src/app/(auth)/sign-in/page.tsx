import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
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
    <AuthShell
      title="Sign in"
      subtitle="Converting files never needs an account. Signing in keeps your history in one place and raises every limit."
      footer={
        <>
          No account?{' '}
          <Link
            href="/sign-up"
            className="inline-block font-medium text-foreground underline-offset-4 hover:underline [@media(pointer:coarse)]:-my-3.5 [@media(pointer:coarse)]:py-3.5"
          >
            Create one
          </Link>
        </>
      }
    >
      <SignInForm mode="sign-in" />
    </AuthShell>
  );
}
