import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { UNIVERSAL_LIMITS } from '@/lib/plans';
import { buildMetadata, SITE } from '@/lib/seo';
import { SUPPORT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy policy',
  description:
    'What HexaConverter collects, how long files are kept, who can access them and how to exercise your data rights. Covers both the website and the Android app.',
  path: '/legal/privacy',
});

const LAST_UPDATED = '2026-08-01';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      summary="We collect the minimum needed to convert your files and delete them on a schedule. This page explains exactly what that means, for both the website and the Android app."
      lastUpdated={LAST_UPDATED}
    >
      <h2>Summary</h2>
      <ul>
        <li>
          Uploaded files are used only to perform the conversion you requested.
        </li>
        <li>Source files are deleted as soon as the conversion finishes.</li>
        <li>
          Converted files are deleted automatically when their retention window
          ends, {UNIVERSAL_LIMITS.retentionHours} hours after the conversion.
        </li>
        <li>
          We store a salted hash of your IP address, never the address itself.
        </li>
        <li>
          No advertising networks, no third-party analytics, no data sales, and
          no sharing of your data for anyone else&rsquo;s marketing.
        </li>
        <li>
          You can delete your account, and everything attached to it, at any
          time &mdash; from the app, or from the web without installing
          anything.
        </li>
      </ul>

      <h2>Who we are</h2>
      <p>
        {SITE.name} is operated by an independent developer and provides the
        file conversion service at {SITE.url}. For any privacy question, to
        exercise a data right, or to reach the person responsible for this
        policy, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or
        use the <Link href="/contact">contact form</Link>. We aim to answer
        within 30 days.
      </p>

      <h2>What this policy covers</h2>
      <p>
        This policy applies to the {SITE.name} website at {SITE.url} and to the{' '}
        {SITE.name} Android application distributed through Google Play. The
        Android app is a secure wrapper around the same website: it contains no
        advertising libraries, no analytics or crash-reporting SDKs, and no
        third-party trackers, so what it collects is exactly what is described
        below. Google Play itself collects installation and billing data under{' '}
        <a
          href="https://policies.google.com/privacy"
          rel="noopener noreferrer"
          target="_blank"
        >
          Google&rsquo;s own privacy policy
        </a>
        , which we neither control nor receive.
      </p>

      <h3>Device permissions the Android app uses</h3>
      <p>
        The app requests access to files only at the moment you pick one to
        convert, through the Android system file picker. It does not browse,
        index or read your storage in the background, and it does not request
        access to your contacts, camera, microphone, location or call logs.
      </p>

      <h2>What we process</h2>

      <h3>Files you upload</h3>
      <p>
        The contents of the file, its name and its size are processed solely to
        produce the output you asked for. Files are never opened by a person,
        indexed, sold, shared with third parties, used for advertising, or used
        to train any model. Image metadata such as EXIF &mdash; including GPS
        coordinates &mdash; is stripped by default during conversion; you can
        opt out per conversion.
      </p>
      <p>
        A file you upload may itself contain personal information, in the
        document text, in a photograph or in its metadata. We do not inspect
        that content, and it is deleted on the schedule below, but you should
        upload only files you are entitled to share.
      </p>

      <h3>Account data</h3>
      <p>
        Creating an account is optional; conversions work without one. If you do
        create one we store your email address, your display name, a bcrypt hash
        of your password (never the password itself) and your plan. If you sign
        in with a connected provider we store the provider identifier and the
        tokens needed to keep the session valid. We do not receive your password
        from those providers.
      </p>

      <h3>Technical data</h3>
      <p>
        For each conversion we record the source and target format, file sizes,
        duration, status and a salted SHA-256 hash of the requesting IP address.
        The hash lets us enforce rate limits and investigate abuse without
        retaining an identifier that points back to you. We do not collect
        advertising identifiers, device identifiers or precise location.
      </p>

      <h3>Messages you send us</h3>
      <p>
        If you use the contact form we store the name, email address and message
        you provide, so that we can reply and so we can recognise repeat abuse.
      </p>

      <h3>Cookies</h3>
      <p>
        We set a small number of strictly necessary cookies &mdash; an opaque
        guest identifier, and session and anti-forgery cookies once you sign in.
        There are no advertising or analytics cookies. The{' '}
        <Link href="/legal/cookies">cookie policy</Link> lists every one of them
        by name, purpose and lifetime.
      </p>

      <h2>Why we are allowed to process it</h2>
      <p>
        Where the GDPR or UK GDPR applies, we rely on: performance of a contract
        for conversions and account management; legitimate interests for abuse
        prevention, security logging and service reliability; and legal
        obligation where retention is required by law. We do not rely on
        consent-based tracking, because we do not track.
      </p>

      <h2>Retention and deletion</h2>
      <table>
        <caption className="sr-only">Retention periods by data type</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Kept for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Uploaded source file</td>
            <td>Until the conversion completes, then deleted immediately</td>
          </tr>
          <tr>
            <td>Converted output file</td>
            <td>
              {UNIVERSAL_LIMITS.retentionHours} hours, or until you delete it
            </td>
          </tr>
          <tr>
            <td>Incomplete or abandoned upload</td>
            <td>Discarded when the upload session expires</td>
          </tr>
          <tr>
            <td>Conversion record (no file contents)</td>
            <td>
              Until you delete it, or 30 days for conversions made as a guest
            </td>
          </tr>
          <tr>
            <td>Account data</td>
            <td>Until you delete your account</td>
          </tr>
          <tr>
            <td>In-app notifications</td>
            <td>90 days</td>
          </tr>
          <tr>
            <td>Security audit log (hashed IP, no file contents)</td>
            <td>12 months</td>
          </tr>
        </tbody>
      </table>

      <h2>Deleting your account and your data</h2>
      <p>
        You can delete your account at any time, and you do not need the app
        installed to do it:
      </p>
      <ul>
        <li>
          <strong>In the app or on the website:</strong> open{' '}
          <Link href="/dashboard/settings">Settings</Link> and choose to delete
          your account.
        </li>
        <li>
          <strong>Without the app:</strong> follow the{' '}
          <Link href="/legal/account-deletion">account deletion</Link>{' '}
          instructions, which work from any browser.
        </li>
      </ul>
      <p>
        Deleting your account immediately and permanently removes your profile,
        your email address and display name, your conversion history, your
        pinned conversions, your notifications and every file still stored for
        you. It cannot be undone. Security audit entries, which contain a hashed
        IP address and no file contents, are kept for the 12 months described
        above so that we can investigate abuse; they are not linked to a profile
        once the account is gone.
      </p>

      <h2>Who else can see your data</h2>
      <p>
        We do not sell your data and we do not share it for advertising. Your
        data is handled by a small number of service providers acting on our
        instructions under a data processing agreement:
      </p>
      <table>
        <caption className="sr-only">Service providers</caption>
        <thead>
          <tr>
            <th scope="col">Provider role</th>
            <th scope="col">What it handles</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Application hosting</td>
            <td>Runs the service and performs the conversions</td>
          </tr>
          <tr>
            <td>Object storage</td>
            <td>Stores uploaded and converted files until deletion</td>
          </tr>
          <tr>
            <td>Managed database</td>
            <td>Stores account and conversion metadata, never file contents</td>
          </tr>
          <tr>
            <td>Email delivery</td>
            <td>
              Sends confirmation, password reset and support email you have
              asked for
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        We may also disclose data where we are legally required to, or where it
        is necessary to establish or defend a legal claim &mdash; for example a
        valid court order. We will not do so voluntarily.
      </p>

      <h2>International transfers</h2>
      <p>
        Our providers may process data outside your country, including outside
        the EEA and the UK. Where that happens we rely on the transfer
        safeguards offered by those providers, such as the European
        Commission&rsquo;s standard contractual clauses.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or erase your data at any time, and
        object to or restrict processing. Most of this is self-service from your
        settings; for anything else, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We will not
        charge you or degrade the service for exercising a right. If you are in
        the EEA or UK you also have the right to lodge a complaint with your
        supervisory authority. If you are a California resident, we do not sell
        or share personal information as those terms are defined by the CCPA, so
        there is nothing to opt out of.
      </p>

      <h2>Security</h2>
      <p>
        Transfers use HTTPS with HSTS enforced, in the app and on the web.
        Uploads are identified by their magic bytes, never executed, and never
        served back with an executable content type. Files at rest are encrypted
        by the object store. Download links are signed with an HMAC bound to a
        single conversion and expire within minutes, so a link cannot be guessed
        or replayed indefinitely. Conversions run in isolated temporary
        directories that are removed after each job. Passwords are stored as
        bcrypt hashes, and changing your password or signing out everywhere
        revokes existing sessions. See the <Link href="/faq">FAQ</Link> for more
        detail.
      </p>
      <p>
        No service can promise perfect security. If we discover a breach
        affecting your personal data we will notify you and the relevant
        regulator as required by law.
      </p>

      <h2>Children</h2>
      <p>
        The service is not directed at children under 16, it is not designed for
        or targeted at children, and we do not knowingly collect their data. If
        you believe a child has provided us with personal information, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will
        delete it.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially we will update the date above and, for
        account holders, notify you by email before the change takes effect. We
        keep this page at a stable address so that it can be linked from Google
        Play and elsewhere.
      </p>
    </LegalPage>
  );
}
