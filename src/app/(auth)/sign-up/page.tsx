import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
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
    <AuthShell
      title="Create an account"
      subtitle="Optional, and free. Every conversion works without one — an account raises the limits and keeps your history together."
      footer={
        <>
          Already have one?{' '}
          <Link
            href="/sign-in"
            className="inline-block font-medium text-foreground underline-offset-4 hover:underline [@media(pointer:coarse)]:-my-3.5 [@media(pointer:coarse)]:py-3.5"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignInForm mode="sign-up" />
    </AuthShell>
  );
}
