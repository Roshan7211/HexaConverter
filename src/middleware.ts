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

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
