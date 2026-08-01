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

  let sent: string;
  try {
    sent = new URL(origin).origin;
  } catch {
    return false;
  }

  if (sent === request.nextUrl.origin) return true;

  // Behind a TLS-terminating proxy, `nextUrl.origin` describes the internal
  // hop — `http://127.0.0.1:3000` — and never the origin the browser used.
  // Comparing against it rejects every same-site POST from the real site,
  // which surfaces as "Cross-origin requests are not permitted" on upload.
  //
  // Trusting these headers is only sound because of two facts that must stay
  // true together: the server binds loopback, so nothing but the proxy can
  // reach it, and the proxy sets both headers with `proxy_set_header`, which
  // overwrites whatever a client sent. Expose this port publicly, or switch
  // to appending rather than overwriting, and a caller could forge an origin
  // and defeat the check.
  const proto = firstValue(request.headers.get('x-forwarded-proto'));
  const host = firstValue(
    request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
  );

  return Boolean(proto && host) && sent === `${proto}://${host}`;
}

/** Chained proxies produce `a, b`; the first entry is the closest to the client. */
function firstValue(header: string | null): string | null {
  return header?.split(',')[0]?.trim() || null;
}

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
