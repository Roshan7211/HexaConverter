import type { ReactNode } from 'react';

import { redirect } from 'next/navigation';

import { getServerSession } from 'next-auth';

import { DashboardTopbar } from '@/components/dashboard/topbar';
import { authOptions } from '@/services/auth/auth-options';

/**
 * Dashboard shell.
 *
 * The session is checked once here rather than in every page: middleware
 * already redirects unauthenticated visitors, and this is the defence in depth
 * that also gives child pages a guaranteed session.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in?callbackUrl=/dashboard');

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#dashboard-content" className="skip-link">
        Skip to dashboard content
      </a>

      <div className="flex min-h-dvh flex-col">
        <DashboardTopbar
          name={session.user.name ?? null}
          email={session.user.email ?? null}
          image={session.user.image ?? null}
          plan={session.user.plan}
        />

        <main
          id="dashboard-content"
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
