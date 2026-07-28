import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getServerSession } from 'next-auth';

import { SecurityPanel } from '@/components/dashboard/security-panel';
import { authOptions } from '@/services/auth/auth-options';
import { UNIVERSAL_LIMITS } from '@/lib/plans';
import { findById } from '@/database/repositories/user.repository';
import { buildMetadata } from '@/lib/seo';
import { formatBytes } from '@/utils';

export const metadata: Metadata = buildMetadata({
  title: 'Account settings',
  description: 'Manage your password, active sessions and account data.',
  path: '/dashboard/settings',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/settings');

  const user = await findById(session.user.id);
  if (!user) redirect('/sign-in');

  return (
    <div className="container max-w-3xl py-10 lg:py-14">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 text-sm text-muted-foreground"
      >
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">Settings</li>
        </ol>
      </nav>

      <h1 className="text-3xl font-semibold tracking-tight">
        Account settings
      </h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as {user.email} · member since{' '}
        {new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
        }).format(user.createdAt)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your name and email live on your{' '}
        <Link
          href="/dashboard/profile"
          className="text-primary underline-offset-4 hover:underline"
        >
          profile
        </Link>
        .
      </p>

      <div className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Your limits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Free, with no paid tier —{' '}
          {formatBytes(UNIVERSAL_LIMITS.maxFileBytes, 0)} per file,{' '}
          {UNIVERSAL_LIMITS.jobsPerPeriod.toLocaleString()} conversions a month,{' '}
          {UNIVERSAL_LIMITS.retentionHours}-hour retention. The same for
          everyone.
        </p>
      </div>

      <div className="mt-8">
        <SecurityPanel hasPassword={Boolean(user.passwordHash)} />
      </div>
    </div>
  );
}
