'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Carries the advertising decision from the layout down to the slots.
 *
 * The decision is made once, on the server, in `(site)/layout.tsx` — which is
 * already rendered per request because it resolves the session. The slots
 * themselves sit inside pages that are statically prerendered: 214 conversion
 * landing pages and the category pages, which are the bulk of search traffic
 * and must stay that way. Reading the tier inside those pages would make every
 * one of them render on demand, trading the site's fastest pages for a boolean.
 *
 * A client fetch was the other option and is worse. It cannot know the answer
 * until after hydration, so the slot either appears late — shifting whatever
 * follows it — or reserves space for people who will never see an ad. Composing
 * the dynamic layout around the cached page gives the correct answer in the
 * first byte of HTML, with no shift and nothing to hydrate.
 */

const AdsContext = createContext(false);

export function AdsProvider({
  showAds,
  children,
}: {
  showAds: boolean;
  children: ReactNode;
}) {
  return <AdsContext.Provider value={showAds}>{children}</AdsContext.Provider>;
}

/** Whether this visitor's plan shows advertising. */
export function useShowAds(): boolean {
  return useContext(AdsContext);
}
