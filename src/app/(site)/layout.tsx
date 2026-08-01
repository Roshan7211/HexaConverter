import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

/**
 * Public site shell.
 *
 * The marketing header and footer live here rather than in the root layout so
 * that error and not-found screens rendered above this level are not wrapped
 * in chrome they do not want. Route groups do not affect URLs, so `/` and
 * `/tools/*` keep their paths.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
