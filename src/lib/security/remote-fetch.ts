import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetching a URL the caller chose, without becoming their proxy.
 *
 * An endpoint that retrieves an arbitrary URL from inside our network is the
 * textbook server-side request forgery hole: `http://169.254.169.254/` reads
 * cloud metadata, `http://127.0.0.1:5432` reaches the database, and a hostname
 * that merely *resolves* to either does the same while looking innocent. So
 * every hop is resolved and checked against the address it actually points at,
 * not the one it appears to.
 *
 * Redirects are followed by hand for that reason. `fetch` will follow them
 * itself, but it does so without asking us — a public URL that 302s to the
 * metadata service would sail straight through a check performed only on the
 * first address.
 *
 * One limitation worth stating plainly: between the lookup and the connection,
 * a hostile DNS server could answer differently and point the connection at an
 * address this rejected. Closing that needs connecting to the validated IP
 * directly and carrying the Host header, which Node's fetch will not do. The
 * window is small and the remaining defences — no credentials forwarded, size
 * and time caps, and a body that is only ever treated as an opaque upload —
 * are what make it acceptable rather than the lookup alone.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const MAX_REDIRECTS = 3;
const CONNECT_TIMEOUT_MS = 15_000;

export class RemoteFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteFetchError';
  }
}

/** True for addresses no visitor has any business making us reach. */
export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return true;

  if (version === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts as [number, number, number, number];

    if (a === 0) return true; // "this" network
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
    if (a === 192 && b === 0) return true; // protocol assignments
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  const normalized = address.toLowerCase().split('%')[0] ?? '';
  if (normalized === '::' || normalized === '::1') return true; // loopback
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  if (normalized.startsWith('ff')) return true; // multicast

  // IPv4 smuggled inside IPv6, e.g. ::ffff:127.0.0.1
  const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1]) return isBlockedAddress(mapped[1]);

  return false;
}

/** Rejects a URL whose host resolves somewhere private. */
async function assertPublic(url: URL): Promise<void> {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new RemoteFetchError('Only http and https links can be imported.');
  }

  // Credentials in the URL would be forwarded to whatever it redirects to.
  if (url.username || url.password) {
    throw new RemoteFetchError('Links with embedded credentials are refused.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new RemoteFetchError('That address is not reachable from here.');
    }
    return;
  }

  let resolved;
  try {
    resolved = await lookup(host, { all: true });
  } catch {
    throw new RemoteFetchError('That address could not be found.');
  }

  // Every answer must be acceptable: one private record is enough to abuse.
  if (resolved.some((entry) => isBlockedAddress(entry.address))) {
    throw new RemoteFetchError('That address is not reachable from here.');
  }
}

export interface RemoteFile {
  body: ReadableStream<Uint8Array>;
  contentType: string | null;
  /** From Content-Disposition or the path, never trusted as a filesystem name. */
  suggestedName: string;
  /** Content-Length when the server declared one. */
  declaredSize: number | null;
}

/** Filename from the response, falling back to the URL's last path segment. */
function nameFrom(url: URL, disposition: string | null): string {
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition ?? '');
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/^"|"$/g, ''));
    } catch {
      /* fall through to the plain form */
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(disposition ?? '');
  if (plain?.[1]) return plain[1];

  const last = url.pathname.split('/').filter(Boolean).pop();
  return last ? decodeURIComponent(last) : 'download';
}

/**
 * Retrieves a caller-supplied URL, following redirects under the same checks.
 *
 * Returns the body as a stream so the caller can enforce its own ceiling while
 * copying; `Content-Length` is a claim by a server we do not trust, useful only
 * for refusing early.
 */
export async function fetchRemoteFile(
  rawUrl: string,
  options: { maxBytes: number },
): Promise<RemoteFile> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RemoteFetchError('That does not look like a link.');
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublic(url);

    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      headers: { accept: '*/*' },
    }).catch(() => {
      throw new RemoteFetchError('That link could not be reached.');
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location)
        throw new RemoteFetchError('That link could not be reached.');
      // Re-checked at the top of the next turn of the loop.
      url = new URL(location, url);
      continue;
    }

    if (!response.ok) {
      throw new RemoteFetchError(
        `The link returned ${response.status}. Check it is public and still valid.`,
      );
    }

    if (!response.body) {
      throw new RemoteFetchError('That link returned nothing to import.');
    }

    const declared = Number(response.headers.get('content-length'));
    const declaredSize =
      Number.isFinite(declared) && declared > 0 ? declared : null;

    if (declaredSize && declaredSize > options.maxBytes) {
      throw new RemoteFetchError('That file is larger than your plan allows.');
    }

    return {
      body: response.body,
      contentType: response.headers.get('content-type'),
      suggestedName: nameFrom(url, response.headers.get('content-disposition')),
      declaredSize,
    };
  }

  throw new RemoteFetchError('That link redirects too many times.');
}
