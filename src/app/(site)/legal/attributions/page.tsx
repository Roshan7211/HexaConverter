import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { SUPPORT_EMAIL } from '@/lib/contact';
import { buildMetadata, SITE } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Open-source attributions',
  description:
    'The open-source software HexaConverter is built on, the licence each component is used under, and where to get its source.',
  path: '/legal/attributions',
});

const LAST_UPDATED = '2026-08-04';

/**
 * Attribution and source-offer page.
 *
 * Several of the encoders here are licensed under the GPL family, which grants
 * the right to use them commercially and without payment, and asks in return
 * that the software be named, its licence stated and its source made reachable.
 * The fonts carry the same obligation under the SIL Open Font License, which is
 * triggered by serving the font files at all.
 *
 * None of these components is modified, and each runs as a separate program
 * invoked by this service rather than as code linked into it. The links below
 * point at each project's own source, which is the form the corresponding
 * source takes when nothing has been changed.
 */

interface Component {
  name: string;
  licence: string;
  href: string;
  what: string;
}

const CONVERTERS: Component[] = [
  {
    name: 'FFmpeg',
    licence:
      'LGPL-2.1-or-later, or GPL-2.0-or-later depending on build options',
    href: 'https://ffmpeg.org/download.html',
    what: 'Audio and video conversion',
  },
  {
    name: 'Ghostscript',
    licence: 'AGPL-3.0-or-later',
    href: 'https://www.ghostscript.com/releases/gsdnld.html',
    what: 'PDF compression, where it is installed',
  },
  {
    name: 'Poppler',
    licence: 'GPL-2.0-or-later',
    href: 'https://poppler.freedesktop.org/',
    what: 'Rendering PDF pages to images',
  },
  {
    name: 'LibreOffice',
    licence: 'MPL-2.0',
    href: 'https://www.libreoffice.org/download/download/',
    what: 'Documents and spreadsheets',
  },
  {
    name: '7-Zip / p7zip',
    licence: 'LGPL-2.1-or-later, with the RAR decoder under its own licence',
    href: 'https://www.7-zip.org/download.html',
    what: 'Archives',
  },
  {
    name: 'Tesseract, via tesseract.js',
    licence: 'Apache-2.0',
    href: 'https://github.com/tesseract-ocr/tesseract',
    what: 'Text recognition',
  },
];

const APPLICATION: Component[] = [
  {
    name: 'Next.js and React',
    licence: 'MIT',
    href: 'https://github.com/vercel/next.js',
    what: 'The application framework',
  },
  {
    name: 'Prisma',
    licence: 'Apache-2.0',
    href: 'https://github.com/prisma/prisma',
    what: 'Database access',
  },
  {
    name: 'Tailwind CSS',
    licence: 'MIT',
    href: 'https://github.com/tailwindlabs/tailwindcss',
    what: 'Styling',
  },
  {
    name: 'Lucide',
    licence: 'ISC',
    href: 'https://github.com/lucide-icons/lucide',
    what: 'Icons',
  },
  {
    name: 'Inter and JetBrains Mono',
    licence: 'SIL Open Font License 1.1',
    href: 'https://github.com/rsms/inter',
    what: 'Typefaces, served from this domain',
  },
];

function Table({ rows, caption }: { rows: Component[]; caption: string }) {
  return (
    <table>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Component</th>
          <th scope="col">Used for</th>
          <th scope="col">Licence</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              <a href={row.href} rel="noopener noreferrer" target="_blank">
                {row.name}
              </a>
            </td>
            <td>{row.what}</td>
            <td>{row.licence}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AttributionsPage() {
  return (
    <LegalPage
      title="Open-source attributions"
      summary="This service is built on open-source software. This page names it, states the licence each part is used under, and tells you where to get the source."
      lastUpdated={LAST_UPDATED}
    >
      <p>
        {SITE.name} does not write its own encoders. Conversion is performed by
        established open-source projects, which is why the output is the same as
        what those tools produce anywhere else &mdash; no watermark, no
        re-encoding to a lower quality, and no format withheld to sell you
        something.
      </p>

      <h2>Conversion tools</h2>
      <Table rows={CONVERTERS} caption="Open-source conversion tools" />

      <h2>Application</h2>
      <Table rows={APPLICATION} caption="Open-source application libraries" />

      <h2>Getting the source</h2>
      <p>
        Each project is used unmodified and runs as a separate program, so the
        corresponding source is the upstream release linked above. If you would
        rather receive it from us, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will send
        the source for the version in use, at no charge beyond the cost of
        sending it.
      </p>
      <p>
        Nothing on this page grants you rights over {SITE.name} itself, and
        nothing about {SITE.name} limits the rights those licences give you over
        the components named here.
      </p>

      <h2>Trademarks</h2>
      <p>
        Format and product names &mdash; among them Microsoft Word, Excel and
        PowerPoint, and Apple Pages &mdash; are trademarks of their respective
        owners. They appear here only to describe which file formats can be
        converted, which is the accurate way to say it. {SITE.name} is not
        affiliated with, endorsed by or sponsored by any of them.
      </p>

      <h2>Our own material</h2>
      <p>
        The {SITE.name} name, logo and the text of this site are ours. The files
        you convert remain entirely yours; see the{' '}
        <Link href="/legal/terms">terms of service</Link>, which claim no rights
        over your content beyond performing the conversion you asked for.
      </p>
    </LegalPage>
  );
}
