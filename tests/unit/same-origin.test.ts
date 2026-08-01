import { describe, expect, it } from 'vitest';

import { isSameOrigin, MUTATING_METHODS } from '@/middleware/same-origin';

/**
 * These cover a bug that reached production: behind a TLS-terminating proxy the
 * check compared the browser's `https://` origin against Next's view of the
 * internal hop (`http://127.0.0.1:3000`) and rejected every same-site upload.
 */

/** Minimal stand-in — `isSameOrigin` reads only `headers` and `nextUrl.origin`. */
function request(headers: Record<string, string>, internalOrigin: string) {
  const map = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null },
    nextUrl: { origin: internalOrigin },
  } as unknown as Parameters<typeof isSameOrigin>[0];
}

const INTERNAL = 'http://127.0.0.1:3000';
const SITE = 'https://www.hexaconverter.com';

describe('same-origin check', () => {
  it('accepts a request with no Origin header', () => {
    // Server-to-server calls and same-origin GETs omit it; the route's own
    // authorisation is what guards those.
    expect(isSameOrigin(request({}, INTERNAL))).toBe(true);
  });

  it('accepts a direct same-origin request', () => {
    expect(isSameOrigin(request({ origin: INTERNAL }, INTERNAL))).toBe(true);
  });

  it('accepts the real site origin when proxied over TLS', () => {
    expect(
      isSameOrigin(
        request(
          {
            origin: SITE,
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'www.hexaconverter.com',
          },
          INTERNAL,
        ),
      ),
    ).toBe(true);
  });

  it('falls back to Host when x-forwarded-host is absent', () => {
    expect(
      isSameOrigin(
        request(
          {
            origin: SITE,
            'x-forwarded-proto': 'https',
            host: 'www.hexaconverter.com',
          },
          INTERNAL,
        ),
      ),
    ).toBe(true);
  });

  it('takes the first entry when proxies chain the header', () => {
    expect(
      isSameOrigin(
        request(
          {
            origin: SITE,
            'x-forwarded-proto': 'https, http',
            'x-forwarded-host': 'www.hexaconverter.com, internal.lan',
          },
          INTERNAL,
        ),
      ),
    ).toBe(true);
  });

  it('still rejects a genuinely foreign origin', () => {
    expect(
      isSameOrigin(
        request(
          {
            origin: 'https://evil.example',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'www.hexaconverter.com',
          },
          INTERNAL,
        ),
      ),
    ).toBe(false);
  });

  it('rejects a scheme downgrade on the same host', () => {
    expect(
      isSameOrigin(
        request(
          {
            origin: 'http://www.hexaconverter.com',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'www.hexaconverter.com',
          },
          INTERNAL,
        ),
      ),
    ).toBe(false);
  });

  it('rejects a sibling host', () => {
    expect(
      isSameOrigin(
        request(
          {
            origin: 'https://evil.hexaconverter.com.attacker.test',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'www.hexaconverter.com',
          },
          INTERNAL,
        ),
      ),
    ).toBe(false);
  });

  it('rejects a malformed Origin', () => {
    expect(isSameOrigin(request({ origin: 'not-a-url' }, INTERNAL))).toBe(
      false,
    );
  });

  it('guards exactly the state-changing methods', () => {
    expect([...MUTATING_METHODS].sort()).toEqual([
      'DELETE',
      'PATCH',
      'POST',
      'PUT',
    ]);
  });
});
