import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { PLANS } from '@/lib/plans';
import { buildMetadata, SITE } from '@/lib/seo';
import { SUPPORT_EMAIL } from '@/lib/contact';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy policy',
  description:
    'What HexaConverter collects, how long files are kept, who can access them and how to exercise your data rights. Covers both the website and the Android app.',
  path: '/legal/privacy',
});

const LAST_UPDATED = '2026-08-03';

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
          ends &mdash; {PLANS.ANONYMOUS.retentionHours} hour without an account,
          up to {PLANS.PREMIUM.retentionHours} hours on Premium.
        </li>
        <li>
          We store a salted hash of your IP address, never the address itself.
        </li>
        <li>
          Visitors without an account are shown advertising supplied by Google
          AdSense. Signing in removes it &mdash; a free account is enough. There
          is no third-party analytics, no data sale, and we never share your
          files or your conversions with anyone for marketing.
        </li>
        <li>
          Converting a file never requires an account. We do not ask for your
          name, your email address or a password in order to convert anything.
        </li>
        <li>
          You may create an account if you want one. It is entirely optional,
          and the only personal data it holds is your email address. Sign-in is
          handled by Google Firebase Authentication, which means we never see or
          store your password. You can close the account at any time and
          everything it holds is deleted immediately.
        </li>
        <li>
          If you buy Premium, we never see your card details. Paddle takes the
          payment as Merchant of Record; all we keep is which account is paid up
          and until when.
        </li>
      </ul>

      <h2>Who we are</h2>
      <p>
        {SITE.name} is operated by an independent developer and provides the
        file conversion service at {SITE.domain}. For any privacy question, to
        exercise a data right, or to reach the person responsible for this
        policy, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or
        use the <Link href="/contact">contact form</Link>. We aim to answer
        within 30 days.
      </p>

      <h2>What this policy covers</h2>
      <p>
        This policy applies to the {SITE.name} website at {SITE.domain} and to
        the {SITE.name} Android application distributed through Google Play. The
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

      <h3>Account data &mdash; only if you create one</h3>
      <p>
        Accounts are optional. The service is free to everyone who opens it, and
        every conversion works without signing in. If you do create an account,
        we store your email address, whether that address has been confirmed,
        and a display picture and name if your sign-in provider supplies one.
        Nothing else.
      </p>
      <p>
        <strong>We never see your password.</strong> Sign-in is handled by
        Google Firebase Authentication, which holds and hashes the password
        itself. Our database contains no credential of any kind, so it cannot be
        breached out of it. If you sign in with Google, we receive only the
        email address and basic profile that Google returns.
      </p>
      <h3>Payment data &mdash; only if you buy Premium</h3>
      <p>
        <strong>We never see your card details.</strong> Payment is handled
        entirely by Paddle, who act as the Merchant of Record: they take the
        payment, hold the card or PayPal details, and charge and remit any VAT
        or sales tax that applies where you are.
      </p>
      <p>
        What reaches us is only what is needed to know which account is paid up:
        the identifiers Paddle assigns to your subscription and customer record,
        which price was bought, the status of the subscription and the date the
        current term ends. No card number, no billing address, no tax figure and
        no transaction amount is stored here.
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
        We set only strictly necessary cookies. One is an opaque random
        identifier that lets your browser download the file it just converted;
        it names no person and is linked to nothing else. The other is set only
        if you sign in, keeps you signed in, and cannot be read by JavaScript.
        There are no advertising or analytics cookies. The{' '}
        <Link href="/legal/cookies">cookie policy</Link> lists every one of them
        by name, purpose and lifetime.
      </p>

      <h2>Why we are allowed to process it</h2>
      <p>
        Where the GDPR or UK GDPR applies, we rely on: performance of a contract
        to carry out the conversion you asked for, to run your account and to
        supply a subscription you have paid for; legitimate interests for abuse
        prevention, security logging and service reliability; and legal
        obligation where retention is required by law, including the records tax
        law requires of a sale. We do not rely on consent-based tracking,
        because we do not track.
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
              {PLANS.ANONYMOUS.retentionHours} hour without an account,{' '}
              {PLANS.FREE.retentionHours} hours with a free one,{' '}
              {PLANS.PREMIUM.retentionHours} on Premium &mdash; or until you
              delete it
            </td>
          </tr>
          <tr>
            <td>Incomplete or abandoned upload</td>
            <td>Discarded when the upload session expires</td>
          </tr>
          <tr>
            <td>
              Conversion record &mdash; formats, sizes, status and a hashed IP,
              never file contents
            </td>
            <td>30 days</td>
          </tr>
          <tr>
            <td>Account data, if you created an account</td>
            <td>Until you close the account, then deleted immediately</td>
          </tr>
          <tr>
            <td>Subscription record, if you bought Premium</td>
            <td>
              Deleted with the account. Paddle keeps its own transaction and
              invoice records for as long as tax law requires them
            </td>
          </tr>
          <tr>
            <td>Messages sent through the contact form</td>
            <td>Until the matter is resolved</td>
          </tr>
        </tbody>
      </table>

      <h2>Deleting your data</h2>
      <p>
        If you never created an account, there is nothing to delete: nothing
        that identifies you was stored in the first place, and your files are
        removed on the schedule above without you having to ask.
      </p>
      <p>
        If you did create one, go to <a href="/account">your account page</a>{' '}
        and choose <strong>Close account permanently</strong>. That deletes your
        sign-in credential at Firebase and your record here at the same time,
        straight away and without needing to contact us. It cannot be undone.
        Your converted files are unaffected either way, because they were never
        attached to your account &mdash; they expire on the schedule above.
      </p>
      <p>
        If you would rather not wait, the archive and PDF tools include a
        &ldquo;delete my files&rdquo; control that removes everything stored for
        your browser immediately. Clearing your cookies has the same practical
        effect: the identifier is gone, and what remains is a row of formats and
        timings that points to nobody.
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
            <td>Stores conversion metadata, never file contents</td>
          </tr>
          <tr>
            <td>Email delivery</td>
            <td>Delivers replies to messages you send us</td>
          </tr>
          <tr>
            <td>Authentication &mdash; Google Firebase Authentication</td>
            <td>
              Holds your email address and password, and sends verification and
              password-reset emails. Only involved if you create an account
            </td>
          </tr>
          <tr>
            <td>Payments &mdash; Paddle.com Market Ltd</td>
            <td>
              Merchant of Record. Takes the payment, holds the card or PayPal
              details, issues the invoice and handles refunds. Only involved if
              you buy Premium
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
        the EEA and the UK. In particular, if you create an account, Google
        Firebase Authentication stores your email address and password on
        infrastructure located in the United States. Where that happens we rely
        on the transfer safeguards offered by those providers, such as the
        European Commission&rsquo;s standard contractual clauses.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or erase your data at any time, and
        object to or restrict processing. In practice there is very little to
        exercise these against, because we hold nothing that identifies you; for
        anything else, email{' '}
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
        directories that are removed after each job. We hold no passwords to
        protect: authentication is delegated to Google Firebase, and sessions on
        this site use a cookie that JavaScript cannot read and that we can
        revoke server-side. See the <Link href="/faq">FAQ</Link> for more
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
        If this policy changes materially we will update the date above. We have
        no mailing list to announce it on, so this page is the notice. We keep
        it at a stable address so that it can be linked from elsewhere.
      </p>
    </LegalPage>
  );
}
