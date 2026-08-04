import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { buildMetadata, SITE } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of service',
  description:
    'The terms that govern your use of HexaConverter, including acceptable use, service limits, liability and termination.',
  path: '/legal/terms',
});

const LAST_UPDATED = '2026-08-04';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      summary="The agreement between you and HexaConverter. Written to be read, not skipped."
      lastUpdated={LAST_UPDATED}
    >
      <h2>1. Agreement</h2>
      <p>
        By using {SITE.name} you agree to these terms. If you are using the
        service on behalf of an organisation, you confirm you have authority to
        bind it.
      </p>

      <h2>2. The service</h2>
      <p>
        {SITE.name} converts files between supported formats. Conversion is
        performed by established open-source encoders; the result depends on the
        source file and the capabilities of the target format. We do not
        guarantee that a specific layout, codec feature or font will survive
        every conversion.
      </p>

      <h2>3. Your content</h2>
      <p>
        You keep all rights to the files you upload. You grant us a limited
        licence to store and process them for the sole purpose of performing the
        conversion you requested, for as long as retention requires. We claim no
        other rights.
      </p>
      <p>
        You are responsible for having the right to upload and convert each
        file. Do not upload content you are not licensed to process.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You must not use the service to:</p>
      <ul>
        <li>process content that is unlawful in your jurisdiction or ours;</li>
        <li>
          distribute malware, or attempt to exploit the conversion pipeline;
        </li>
        <li>
          circumvent the service limits or rate limits, including by automating
          requests to reset them;
        </li>
        <li>place disproportionate load on the platform;</li>
        <li>infringe someone else's intellectual property or privacy.</li>
      </ul>

      <h2>5. Accounts</h2>
      <p>
        Accounts are optional and free, and no conversion route requires one.
        Signing in raises the limits set out on the{' '}
        <Link href="/pricing">pricing page</Link> and adds conversion history
        and text recognition; without one, every format is still available and
        the same terms apply to your use of it.
      </p>
      <p>
        If you do create one, you are responsible for keeping your sign-in
        details secure and for activity carried out through it. Provide an email
        address you control and are entitled to use. We may suspend or close an
        account that is used to break these terms. You may close your own
        account at any time from your account page, which deletes it
        immediately.
      </p>

      <h2>6. Plans, payment and renewal</h2>
      <p>
        The service can be used free of charge, with or without an account. A
        paid plan, Premium, raises the limits described on the{' '}
        <Link href="/pricing">pricing page</Link>. Paying never changes the
        output: there is no watermark, no degraded quality and no conversion
        format held back on the free plans. Text recognition needs a free
        account, because it costs far more processing than a conversion does.
      </p>
      <p>
        The free plans are supported by advertising. Premium removes it. We do
        not give advertisers your files, and no ad is placed inside the
        converter or over any control you need to use.
      </p>
      <p>
        Premium is billed once a year and renews automatically until you cancel.
        We will tell you before the price of a renewal changes, and you can
        cancel at any time from your account page &mdash; access then continues
        until the end of the term you have already paid for.
      </p>
      <p>
        Our order process is conducted by our online reseller Paddle.com. Paddle
        is the Merchant of Record for all our orders and handles all
        customer-service enquiries relating to payments, invoices, taxes and
        refunds. Prices include any sales tax or VAT that applies where you are.
        Refunds are covered by the{' '}
        <Link href="/legal/refunds">refund policy</Link>.
      </p>
      <p>
        Technical limits still apply — a maximum file size, a conversion
        allowance, a batch size, a concurrency cap and a retention period —
        because the service runs on finite storage and CPU. These are enforced
        by the service, apply equally to everyone, and may be adjusted if
        capacity requires it.
      </p>

      <h2>7. Availability</h2>
      <p>
        We aim for continuous availability but do not promise it. Maintenance,
        upstream provider incidents and abuse mitigation may interrupt service.
      </p>

      <h2>8. Retention and deletion</h2>
      <p>
        Files are deleted automatically as described in the{' '}
        <Link href="/legal/privacy">privacy policy</Link>. Download a converted
        file before its retention window ends; we cannot recover a deleted file.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The service is provided "as is" without warranties of any kind, to the
        maximum extent permitted by law. Keep your own copy of every original
        file. We are not a backup service.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the extent permitted by law, our aggregate liability arising from the
        service is limited to the greater of the amount you have paid us in the
        twelve months before the claim, or USD 100. We are not liable for
        indirect, incidental or consequential damages, including lost data or
        lost profits. Nothing here excludes liability that cannot lawfully be
        excluded.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the service at any time, and close your account from
        your account page if you have one. We may terminate access for a
        material breach of these terms. On termination, your stored files are
        deleted.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these terms. Material changes will be announced with the
        updated date above; we have no mailing list to announce them on, so this
        page is the notice. Continued use after a change means you accept it.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these terms? Use the{' '}
        <Link href="/contact">contact form</Link>.
      </p>
    </LegalPage>
  );
}
