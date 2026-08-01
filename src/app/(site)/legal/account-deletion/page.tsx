import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { UNIVERSAL_LIMITS } from '@/lib/plans';
import { buildMetadata, SITE } from '@/lib/seo';
import { SUPPORT_EMAIL } from '@/lib/contact';

/**
 * Google Play requires that an app offering account creation also publish a
 * way to request account and data deletion that is reachable *without*
 * installing the app. That is what this page is: a stable, public URL stating
 * what gets deleted, what is kept and for how long.
 */

export const metadata: Metadata = buildMetadata({
  title: 'Delete your account',
  description:
    'How to delete your HexaConverter account and every file and record attached to it, from the app or from any browser.',
  path: '/legal/account-deletion',
});

const LAST_UPDATED = '2026-08-01';

export default function AccountDeletionPage() {
  return (
    <LegalPage
      title="Delete your account"
      summary="You can delete your HexaConverter account and everything attached to it at any time. You do not need the app installed to do it."
      lastUpdated={LAST_UPDATED}
    >
      <h2>Delete it yourself</h2>
      <p>
        This is immediate and needs no request, no waiting and no contact with
        us. It works identically in the Android app and in any web browser.
      </p>
      <ul>
        <li>
          <Link href="/sign-in">Sign in</Link> to your {SITE.name} account.
        </li>
        <li>
          Open <Link href="/dashboard/settings">Settings</Link>.
        </li>
        <li>Choose &ldquo;Delete account&rdquo; and confirm.</li>
      </ul>

      <h2>Ask us to delete it</h2>
      <p>
        If you cannot sign in &mdash; for example you have lost access to your
        email address &mdash; email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address
        you registered with, asking us to delete your account. We will verify
        that you control the account before acting, complete the deletion within
        30 days, and confirm by email when it is done.
      </p>
      <p>
        You do not need to install the app to make this request, and we will not
        ask you to.
      </p>

      <h2>What is deleted</h2>
      <p>
        Deleting your account is permanent and cannot be undone. It removes,
        immediately:
      </p>
      <ul>
        <li>Your profile, email address and display name</li>
        <li>Your password hash and any connected sign-in providers</li>
        <li>Your entire conversion history</li>
        <li>
          Every file still stored for you, both uploads and converted results
        </li>
        <li>Your pinned conversions and your notifications</li>
        <li>Every active session, on every device</li>
      </ul>

      <h2>What is kept, and for how long</h2>
      <table>
        <caption className="sr-only">
          Data retained after account deletion
        </caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Kept for</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Security audit entries (a salted hash of an IP address, never the
              address, and never file contents)
            </td>
            <td>12 months from the event</td>
            <td>
              Investigating abuse and protecting the service. These are not
              linked to a profile once the account is gone.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Nothing else is retained. We keep no backup copy of your files beyond
        the {UNIVERSAL_LIMITS.retentionHours}-hour retention window that applies
        to every conversion.
      </p>

      <h2>Deleting a single file instead</h2>
      <p>
        If you only want to remove one conversion rather than your whole
        account, delete it from your dashboard. Every converted file is deleted
        automatically {UNIVERSAL_LIMITS.retentionHours} hours after the
        conversion in any case, and the file you uploaded is deleted as soon as
        the conversion finishes.
      </p>

      <h2>Converting without an account</h2>
      <p>
        You never had to create an account to use {SITE.name}. Conversions made
        as a guest are not attached to a profile, and their records are removed
        automatically after 30 days.
      </p>
      <p>
        Full detail on what we process is in the{' '}
        <Link href="/legal/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
