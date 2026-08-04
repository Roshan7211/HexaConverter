import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ConversionHistory } from '@/components/auth/conversion-history';
import { DeleteAccount } from '@/components/auth/delete-account';
import { VerifyEmailNotice } from '@/components/auth/verify-email-notice';
import { listForUser } from '@/database/repositories/job.repository';
import { findByFirebaseUid } from '@/database/repositories/user.repository';
import { currentUser } from '@/lib/firebase/session';
import { buildMetadata } from '@/lib/seo';

/** Enough to be useful without paginating. */
const HISTORY_LIMIT = 25;

export const metadata: Metadata = buildMetadata({
  title: 'Your account',
  description: 'Manage your HexaConverter account.',
  path: '/account',
  noIndex: true,
});

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  // The session names the Firebase uid; history is keyed on the local row.
  const account = await findByFirebaseUid(user.firebaseUid);
  const jobs = account ? await listForUser(account.id, HISTORY_LIMIT) : [];

  return (
    <div className="container max-w-2xl space-y-8 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-sm text-muted-foreground">
          An account is optional. Converting files has never required one, and
          still does not.
        </p>
      </div>

      <dl className="space-y-3 rounded-xl border bg-card p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Email verified</dt>
          <dd className="font-medium">{user.emailVerified ? 'Yes' : 'No'}</dd>
        </div>
      </dl>

      {user.emailVerified ? null : <VerifyEmailNotice />}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Your conversions
          </h2>
          <p className="text-sm text-muted-foreground">
            The last {HISTORY_LIMIT} conversions on this account, from any
            device. Files themselves are still deleted on the usual schedule.
          </p>
        </div>
        <ConversionHistory jobs={jobs} />
      </section>

      <DeleteAccount email={user.email} />
    </div>
  );
}
