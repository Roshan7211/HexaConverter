import type { NextRequest } from 'next/server';

/**
 * Cross-site request protection for cookie-authenticated endpoints.
 *
 * A browser always sends `Origin` on a cross-site state-changing request, so
 * rejecting a mismatch blocks CSRF without a token round-trip. Requests with no
 * `Origin` header (same-origin GETs, server-to-server calls) are left to the
 * route's own authorisation.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
