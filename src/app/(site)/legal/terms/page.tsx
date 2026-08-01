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

const LAST_UPDATED = '2026-07-01';

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

      <h2>5. No accounts</h2>
      <p>
        The service has no accounts. There is nothing to register for, no
        credentials to keep secure and no profile we hold about you. Everyone
        who opens the site gets the same service on the same terms.
      </p>

      <h2>6. Service limits</h2>
      <p>
        The service is provided free of charge. There is no paid tier, no
        billing and no payment details to give us.
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
        service is limited to USD 100. The service is free, so you have paid us
        nothing against which to measure a larger sum. We are not liable for
        indirect, incidental or consequential damages, including lost data or
        lost profits. Nothing here excludes liability that cannot lawfully be
        excluded.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the service at any time; there is no account to
        close. We may terminate access for a material breach of these terms. On
        termination, your stored files are deleted.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these terms. Material changes will be announced with the
        updated date above; with no accounts there is no mailing list to
        announce them on, so this page is the notice. Continued use after a
        change means you accept it.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these terms? Use the{' '}
        <Link href="/contact">contact form</Link>.
      </p>
    </LegalPage>
  );
}
