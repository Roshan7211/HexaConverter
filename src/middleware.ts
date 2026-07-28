import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { isSameOrigin, MUTATING_METHODS } from '@/middleware/same-origin';

/**
 * Edge middleware — the Next.js entry point.
 *
 * Next requires this file at the root of `src/`, so it stays a thin composition
 * of the pieces in `src/middleware/`. It handles only what must run before a
 * route is reached: cross-origin rejection and session-based redirects.
 * Per-route concerns (rate limits, body validation) run inside the handlers,
 * where they have access to the Node.js runtime.
 */

const PROTECTED_PREFIXES = ['/dashboard'];

/**
 * Pages that only make sense signed out.
 *
 * `/reset-password` and `/verify-email` are deliberately absent: both are
 * reached from an emailed link that may well be opened in a browser already
 * signed in, and bouncing that to the dashboard would strand the token.
 */
const AUTH_PAGES = ['/sign-in', '/sign-up', '/forgot-password'];

/**
 * Routes authorised by a signed token or bearer secret, not by cookies.
 *
 * Everything under `/api/auth` proves its own authority — NextAuth's own CSRF
 * token, or a single-use link secret — so a cross-site request there gains
 * nothing. Endpoints that act on the ambient session cookie live under
 * `/api/account` instead, where the same-origin check below applies.
 */
const CSRF_EXEMPT_PREFIXES = ['/api/auth', '/api/cron'];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // --- Cross-site protection for cookie-authenticated endpoints ------------
  if (
    pathname.startsWith('/api/') &&
    MUTATING_METHODS.has(request.method) &&
    !CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !isSameOrigin(request)
  ) {
    return NextResponse.json(
      { error: 'Cross-origin requests are not permitted.', code: 'forbidden' },
      { status: 403 },
    );
  }

  const needsAuth = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!needsAuth && !isAuthPage) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (needsAuth && !token) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/api/:path*',
  ],
};
