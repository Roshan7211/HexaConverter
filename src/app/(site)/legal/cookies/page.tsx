import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { buildMetadata, SITE } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Cookie policy',
  description:
    'HexaConverter uses one strictly necessary cookie and no tracking or advertising cookies.',
  path: '/legal/cookies',
});

const LAST_UPDATED = '2026-07-01';

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      summary="We use one strictly necessary cookie and nothing else. No advertising, no cross-site tracking, no consent banner needed."
      lastUpdated={LAST_UPDATED}
    >
      <h2>Cookies we set</h2>
      <table>
        <caption className="sr-only">Cookies used by HexaConverter</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Purpose</th>
            <th scope="col">Lifetime</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>hx_guest</td>
            <td>
              Opaque identifier that links anonymous conversions to your browser
              so you can see and download your own files. Contains no personal
              data.
            </td>
            <td>30 days</td>
          </tr>
        </tbody>
      </table>
      <p>
        That is the entire list. There are no accounts on {SITE.name}, so there
        is no session cookie, no sign-in cookie and nothing that identifies you
        as a person.
      </p>

      <h2>What we do not use</h2>
      <ul>
        <li>No advertising or retargeting cookies.</li>
        <li>No third-party analytics.</li>
        <li>No cross-site tracking or fingerprinting.</li>
      </ul>

      <h2>Local storage</h2>
      <p>
        Your colour theme preference is stored in your browser's local storage
        so the site does not flash the wrong theme on load. It never leaves your
        device.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can clear or block cookies in your browser settings. Blocking the
        guest cookie means a conversion cannot be tied back to your browser, so
        you would not be able to download its result — but nothing about you is
        recorded either way.
      </p>

      <p>
        For the full picture of what we store, see the{' '}
        <Link href="/legal/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
