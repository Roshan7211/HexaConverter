'use client';

import { useEffect, useRef } from 'react';

/** Must match `AUTH_STATE_COOKIE` in `src/middleware.ts`. */
const AUTH_STATE_COOKIE = 'hx_auth';

const AUTH_STATE_PATTERN = new RegExp(`(?:^|;\\s*)${AUTH_STATE_COOKIE}=([^;]*)`);

/** The flag's current value, or `''` when the cookie is absent. */
function readAuthFlag(): string {
  return document.cookie.match(AUTH_STATE_PATTERN)?.[1] ?? '';
}

/**
 * Reloads a page that has been restored from the back/forward cache into a
 * browser whose sign-in state has changed since the page was rendered.
 *
 * Public pages are deliberately bfcache-eligible — see the note on
 * `ANONYMOUS_PAGE_CACHE_CONTROL` in `src/middleware.ts` — which makes Back
 * instant and is the most-travelled path on a converter. The cost of that is
 * that bfcache restores a page *exactly* as it was, including a header and an
 * advertising decision resolved from a session that no longer reflects reality.
 *
 * The case that matters is signing in: land on a tool page from a search
 * result, sign in, press Back. Without this, the restored page still says
 * "Sign in", and — the reason this component exists rather than being filed as
 * cosmetic — it still shows the ads that were correct for an anonymous visitor
 * and are wrong for a subscriber. `(site)/layout.tsx` resolves entitlement from
 * the account specifically so that never happens, and a stale snapshot would
 * quietly undo it.
 *
 * The check is a string comparison against a cookie, so the common restore —
 * nothing changed — costs nothing and stays instant. A network call would have
 * been more authoritative and would have spent a round trip on every Back to
 * catch a case that only arises when the visitor signs in or out in this
 * browser, which is exactly when the cookie changes too.
 */
export function BfcacheAuthGuard() {
  // Captured on first render and preserved across a bfcache restore, which is
  // what makes it a record of the state the page was actually rendered with.
  const renderedWith = useRef<string | null>(null);

  useEffect(() => {
    if (renderedWith.current === null) renderedWith.current = readAuthFlag();

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      if (readAuthFlag() === renderedWith.current) return;
      // `reload()` re-requests the document, and `no-cache` on it means the
      // server is consulted rather than the disk cache.
      window.location.reload();
    }

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return null;
}
