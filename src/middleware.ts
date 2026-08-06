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
  if (
    request.method === 'GET' &&
    !pathname.startsWith('/api/') &&
    !request.cookies.has(GUEST_COOKIE) &&
    request.headers.get('accept')?.includes('text/html')
  ) {
    response.cookies.set(GUEST_COOKIE, createGuestId(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
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
