import { NextResponse, type NextRequest } from 'next/server';

import { isSameOrigin, MUTATING_METHODS } from '@/middleware/same-origin';

/**
 * Edge middleware — the Next.js entry point.
 *
 * Next requires this file at the root of `src/`, so it stays a thin composition
 * of the pieces in `src/middleware/`. It handles only what must run before a
 * route is reached: rejecting cross-origin writes. Per-route concerns (rate
 * limits, body validation) run inside the handlers, where they have access to
 * the Node.js runtime.
 */

/**
 * Routes authorised by a bearer secret rather than by the ambient cookie.
 *
 * The cron endpoints carry their own credential, so a cross-site request there
 * gains nothing the secret does not already gate.
 */
const CSRF_EXEMPT_PREFIXES = ['/api/cron'];

/** Must match `GUEST_COOKIE` in `@/lib/security`, which cannot be imported at the edge. */
const GUEST_COOKIE = 'hx_guest';
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Must match `SESSION_COOKIE` in `@/lib/firebase/session`, which is `server-only`. */
const SESSION_COOKIE = 'hexa_session';

/**
 * Cache policy for a signed-out visitor's page, replacing Next's dynamic-render
 * default of `private, no-cache, no-store, max-age=0, must-revalidate`.
 *
 * The only difference is that `no-store` is gone, and it is the whole point:
 * `no-store` is the one directive that makes a page ineligible for the back/
 * forward cache. Every public page here carried it, so pressing Back re-ran a
 * full server render and repainted from scratch instead of restoring the page
 * instantly — on a converter, where bouncing between a tool page and the
 * category listing is the normal browsing pattern, that is the most-travelled
 * path on the site.
 *
 * `no-cache` and `must-revalidate` are kept, so this is not a loosening of
 * freshness: the browser must still revalidate with the server before serving
 * this page from the ordinary HTTP cache. bfcache is a separate mechanism —
 * an in-memory snapshot of a page the same user just had open, in the same tab
 * — and it is exempt from that revalidation by design.
 *
 * It applies only when no session cookie is present. A signed-in visitor's
 * pages render their email and remaining quota in the header, so those keep
 * `no-store` and stay out of every cache, bfcache included. That is the
 * conservative half of the trade, and it costs almost nothing: essentially all
 * of this site's traffic is signed out.
 */
const ANONYMOUS_PAGE_CACHE_CONTROL = 'private, no-cache, must-revalidate';

/** Same shape as `createGuestId`, using the Web Crypto available at the edge. */
function createGuestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `g_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    MUTATING_METHODS.has(request.method) &&
    !CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !isSameOrigin(request)
  ) {
    return NextResponse.json(
      { error: 'Cross-origin requests are not permitted.', code: 'forbidden' },
      { status: 403 },
    );
  }

  const response = NextResponse.next();

  /**
   * A real page request, as opposed to an asset, an API call or a well-known
   * document.
   *
   * `/.well-known/` is excluded because those paths are machine endpoints that
   * merely happen to sit outside `/api`. `/.well-known/traffic-advice` is
   * rewritten to a route handler that sets its own long cache lifetime and is
   * identical for everyone; treating it as a page would overwrite that header
   * and mint a guest cookie for a crawler that will never use one. Nothing
   * under here is a document a person navigates to.
   */
  const isDocumentRequest =
    request.method === 'GET' &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/.well-known/') &&
    (request.headers.get('accept')?.includes('text/html') ?? false);

  /**
   * Establish the guest identity on the page request, before anything can race
   * for it.
   *
   * `resolveRequester` mints one when it finds no cookie, which is fine for a
   * single call and wrong for several at once: uploading two files from a fresh
   * browser fired two requests that each found no cookie, each minted a
   * *different* id, and each signed its upload ticket to a different owner.
   * Only one of those cookies survived, so the second ticket then belonged to
   * nobody — Merge PDFs and Create archive failed on a first visit with a 403,
   * and worked on the second attempt, because by then a cookie existed.
   *
   * Setting it here means one id exists before any upload can start. Only
   * document requests are considered: an API call arriving without a cookie is
   * still handled downstream, and tagging asset responses would be noise.
   */
  if (isDocumentRequest && !request.cookies.has(GUEST_COOKIE)) {
    response.cookies.set(GUEST_COOKIE, createGuestId(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  }

  // Restore back/forward-cache eligibility for signed-out visitors. See the note
  // on ANONYMOUS_PAGE_CACHE_CONTROL for why `no-store` is the only directive
  // being dropped, and why signed-in pages keep it.
  if (isDocumentRequest && !request.cookies.has(SESSION_COOKIE)) {
    response.headers.set('Cache-Control', ANONYMOUS_PAGE_CACHE_CONTROL);
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    /**
     * Page requests too, so the guest cookie exists before anything can race
     * for it. Static assets and image optimiser output are excluded — they
     * need neither check, and running middleware on them is pure cost.
     *
     * There are no server actions in this app, so widening the matcher does
     * not bring page POSTs under the cross-origin rule by surprise.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)',
  ],
};
