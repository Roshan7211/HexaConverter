import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ConversionHistory } from '@/components/auth/conversion-history';
import { DeleteAccount } from '@/components/auth/delete-account';
import { ProfilePicture } from '@/components/auth/profile-picture';
import { VerifyEmailNotice } from '@/components/auth/verify-email-notice';
import { listForUser } from '@/database/repositories/job.repository';
import { findByFirebaseUid } from '@/database/repositories/user.repository';
import { currentUser } from '@/lib/firebase/session';
import { PLANS } from '@/lib/plans';
import { currentAccountSummary } from '@/services/identity/identity.service';
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
  const summary = await currentAccountSummary();

  return (
    <div className="container max-w-2xl space-y-8 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-sm text-muted-foreground">
          An account is optional. Converting files has never required one, and
          still does not.
        </p>
      </div>

      {summary ? (
        <ProfilePicture
          photoUrl={summary.photoUrl}
          email={user.email}
          hasUpload={Boolean(account?.avatarKey)}
        />
      ) : null}

      <dl className="space-y-3 rounded-xl border bg-card p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Email verified</dt>
          <dd className="font-medium">{user.emailVerified ? 'Yes' : 'No'}</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="font-medium">Member &mdash; free</dd>
        </div>
      </dl>

      {/* The allowance is enforced on every conversion and was visible nowhere,
          so the first anyone knew of it was being refused. */}
      {summary ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Your allowance
            </h2>
            <p className="text-sm tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">
                {summary.used}
              </span>{' '}
              of {summary.limit} used
            </p>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={summary.used}
            aria-valuemin={0}
            aria-valuemax={summary.limit}
            aria-label="Conversions used"
          >
            <div
              className={
                summary.remaining === 0
                  ? 'h-full rounded-full bg-destructive'
                  : 'h-full rounded-full bg-primary'
              }
              style={{
                width: `${summary.limit > 0 ? Math.min(100, (summary.used / summary.limit) * 100) : 0}%`,
              }}
            />
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary.remaining > 0
              ? `${summary.remaining} conversion${summary.remaining === 1 ? '' : 's'} left `
              : 'You have used the whole allowance '}
            {summary.periodDays === 1
              ? 'today'
              : `in the last ${summary.periodDays} days`}
            . It is a rolling window rather than a daily reset, so it frees up
            gradually as older conversions age out. Files up to{' '}
            {Math.round(PLANS.FREE.maxFileBytes / (1024 * 1024))} MB, up to{' '}
            {PLANS.FREE.maxBatchFiles} at a time.
          </p>
        </section>
      ) : null}

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

      {/* `DeleteAccount` already renders its own destructive card with its own
          heading; wrapping it in a second one produced nested boxes and two
          near-identical titles. */}
      <DeleteAccount email={user.email} />
    </div>
  );
}
