import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Cookie policy',
  description:
    'HexaConverter uses only strictly necessary cookies and no tracking or advertising cookies.',
  path: '/legal/cookies',
});

const LAST_UPDATED = '2026-08-03';

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      summary="Two strictly necessary cookies of our own. Free use is ad-supported, and Google sets its own cookies for that — Premium removes them."
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
          <tr>
            <td>hexa_session</td>
            <td>
              Set only if you choose to sign in. Keeps you signed in between
              visits. It cannot be read by JavaScript, is never sent to anyone
              else, and is deleted when you sign out.
            </td>
            <td>14 days, or until you sign out</td>
          </tr>
        </tbody>
      </table>
      <p>
        That is the entire list. Both are strictly necessary &mdash; one to hand
        you back your own converted file, one to keep you signed in if you asked
        to be. Neither is set by us for advertising or analytics, and if you
        never create an account the second is never set.
      </p>

      <h2>What we do not use</h2>
      <ul>
        <li>
          No advertising or retargeting cookies of our own. Google AdSense sets
          its own cookies on the free plans, governed by{' '}
          <a
            href="https://policies.google.com/technologies/ads"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google&rsquo;s advertising policies
          </a>
          . Premium stops the ad script loading at all.
        </li>
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
