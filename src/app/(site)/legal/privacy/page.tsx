import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { UNIVERSAL_LIMITS } from '@/lib/plans';
import { buildMetadata, SITE } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy policy',
  description:
    'What HexaConverter collects, how long files are kept, who can access them and how to exercise your data rights.',
  path: '/legal/privacy',
});

const LAST_UPDATED = '2026-07-01';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      summary="We collect the minimum needed to convert your files and delete them on a schedule. This page explains exactly what that means."
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
          No advertising networks, no third-party analytics, no data sales.
        </li>
      </ul>

      <h2>Who we are</h2>
      <p>
        {SITE.name} operates the file conversion service at {SITE.url}. For any
        privacy question, use the <Link href="/contact">contact form</Link>.
      </p>

      <h2>What we process</h2>

      <h3>Files you upload</h3>
      <p>
        The contents of the file, its name and its size are processed solely to
        produce the output you asked for. Files are never opened by a person,
        indexed, shared with third parties, or used to train any model. Image
        metadata such as EXIF — including GPS coordinates — is stripped by
        default during conversion; you can opt out per conversion.
      </p>

      <h3>Account data</h3>
      <p>
        If you create an account we store your email address, your display name,
        a bcrypt hash of your password (never the password itself) and your
        plan. If you sign in with a connected provider we store the provider
        identifier and the tokens needed to keep the session valid.
      </p>

      <h3>Technical data</h3>
      <p>
        For each conversion we record the source and target format, file sizes,
        duration, status and a salted SHA-256 hash of the requesting IP address.
        The hash lets us enforce rate limits and investigate abuse without
        retaining an identifier that points back to you.
      </p>

      <h2>Retention</h2>
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
            <td>Conversion record (no file contents)</td>
            <td>Until you delete it, or 30 days for guest conversions</td>
          </tr>
          <tr>
            <td>Account data</td>
            <td>Until you delete your account</td>
          </tr>
          <tr>
            <td>Security audit log</td>
            <td>12 months</td>
          </tr>
        </tbody>
      </table>

      <h2>Legal bases</h2>
      <p>
        Where the GDPR applies, we rely on: performance of a contract for
        conversions and account management; legitimate interests for abuse
        prevention, security logging and service reliability; and legal
        obligation where retention is required by law.
      </p>

      <h2>Sub-processors</h2>
      <p>
        Files are stored in an S3-compatible object store and metadata in a
        PostgreSQL database, both operated by our infrastructure provider under
        a data processing agreement. Email, when you contact us, is delivered
        through our SMTP provider. We do not use third-party analytics or
        advertising services.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or erase your data at any time. Deleting
        your account from the settings page removes your profile, your
        conversion history and every stored file immediately. If you are in the
        EEA or UK, you also have the right to lodge a complaint with your
        supervisory authority.
      </p>

      <h2>Security</h2>
      <p>
        Transfers use HTTPS with HSTS enforced. Files at rest are encrypted by
        the object store. Download links are signed with an HMAC bound to a
        single conversion and expire within minutes. Conversions run in isolated
        temporary directories that are removed after each job. See the{' '}
        <Link href="/faq">FAQ</Link> for more detail.
      </p>

      <h2>Children</h2>
      <p>
        The service is not directed at children under 16 and we do not knowingly
        collect their data.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially we will update the date above and, for
        account holders, notify you by email before the change takes effect.
      </p>
    </LegalPage>
  );
}
