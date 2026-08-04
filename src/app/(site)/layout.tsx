import type { ReactNode } from 'react';

import { AdSenseScript } from '@/components/ads/adsense-script';
import { AdsProvider } from '@/components/ads/ads-context';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { isAdminConfigured } from '@/lib/firebase/admin';
import { currentUser } from '@/lib/firebase/session';
import { limitsFor } from '@/lib/plans';
import { currentTier } from '@/services/identity/identity.service';

/**
 * Public site shell.
 *
 * The marketing header and footer live here rather than in the root layout so
 * that error and not-found screens rendered above this level are not wrapped
 * in chrome they do not want. Route groups do not affect URLs, so `/` and
 * `/tools/*` keep their paths.
 */
export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Resolved here so the header renders the right control in the first paint.
  // Reading it from Firebase in the browser instead would flash "Sign in" at
  // someone who is already signed in, on every page load.
  const user = await currentUser();

  // Entitlement only, resolved from the account rather than the guest cookie.
  // Someone who has just signed up has a session but no guest id yet, and
  // reading ownership here would call them anonymous and show them advertising
  // their plan says they should never see.
  const tier = await currentTier();

  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  // The script loads only once a unit actually exists to fill. Loading it with
  // no units configured buys nothing — there is no ad to serve — while still
  // letting Google set cookies in a UK/EEA visitor's browser, which PECR does
  // not allow before consent. Gating on the slots means advertising cannot
  // start until the slot ids are filled in, which is the same moment the
  // consent platform has to be in place anyway.
  const adsConfigured =
    Boolean(adsenseClient) &&
    Boolean(
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE,
    );

  const showAds = adsConfigured && limitsFor(tier).showsAds;

  return (
    <div className="flex min-h-dvh flex-col">
      {showAds ? <AdSenseScript client={adsenseClient!} /> : null}

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <SiteHeader
        user={user ? { email: user.email } : null}
        accountsEnabled={isAdminConfigured()}
      />
      <main id="main-content" className="flex-1">
        <AdsProvider showAds={showAds}>{children}</AdsProvider>
      </main>
      <SiteFooter />
    </div>
  );
}
