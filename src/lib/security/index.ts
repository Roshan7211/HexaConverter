import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { serverEnv } from '@/lib/env';

/** Characters that are unsafe in object keys, headers and filesystem paths. */
const UNSAFE_FILENAME = /[^A-Za-z0-9._-]+/g;
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Reduces an untrusted filename to a safe, single-segment ASCII name.
 * Strips directory components, control characters, leading dots and Windows
 * reserved device names.
 */
export function sanitizeFilename(input: string, fallback = 'file'): string {
  // Defeat both POSIX and Windows path separators plus percent/unicode escapes.
  const base = input
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .normalize('NFKD')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(UNSAFE_FILENAME, '_')
    .replace(/^[._]+/, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 180);

  if (!base || RESERVED_WINDOWS_NAMES.test(base)) return fallback;
  return base;
}

/**
 * Pseudonymised client IP for abuse controls and audit logs. Storing a salted
 * digest instead of the address keeps rate limiting effective without
 * retaining personal data.
 */
export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`${ip}:${serverEnv().DOWNLOAD_URL_SECRET}`)
    .digest('hex')
    .slice(0, 32);
}

/** Best-effort client IP from proxy headers, falling back to `unknown`. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    headers.get('x-vercel-forwarded-for') ??
    'unknown'
  );
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

// ---------------------------------------------------------------------------
// Signed download tokens
// ---------------------------------------------------------------------------

export interface DownloadTokenPayload {
  jobId: string;
  /** Unix seconds. */
  expiresAt: number;
}

/**
 * Signs a download grant. Tokens are short-lived and bound to a single job, so
 * a leaked link cannot be replayed indefinitely or pivoted to another file.
 */
export function signDownloadToken(payload: DownloadTokenPayload): string {
  const body = `${payload.jobId}.${payload.expiresAt}`;
  const signature = createHmac('sha256', serverEnv().DOWNLOAD_URL_SECRET)
    .update(body)
    .digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${signature}`;
}

export function verifyDownloadToken(
  token: string,
): DownloadTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedBody, signature] = parts as [string, string];

  let body: string;
  try {
    body = Buffer.from(encodedBody, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = createHmac('sha256', serverEnv().DOWNLOAD_URL_SECRET)
    .update(body)
    .digest('base64url');

  if (!constantTimeEqual(signature, expected)) return null;

  const [jobId, expiry] = body.split('.');
  const expiresAt = Number(expiry);
  if (!jobId || !Number.isFinite(expiresAt)) return null;
  if (expiresAt * 1000 < Date.now()) return null;

  return { jobId, expiresAt };
}

// ---------------------------------------------------------------------------
// Upload tickets
// ---------------------------------------------------------------------------

export interface UploadTicketPayload {
  /** Storage key of the verified upload. */
  key: string;
  name: string;
  size: number;
  mime: string;
  sourceFormat: string;
  /** User id or guest id the upload belongs to. */
  owner: string;
  expiresAt: number;
}

/**
 * Signs the result of a completed upload.
 *
 * The job endpoint trusts only what is inside this ticket, so a caller cannot
 * point a conversion at a storage key belonging to someone else or misreport a
 * file's size or format after validation has run.
 */
export function signUploadTicket(payload: UploadTicketPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', serverEnv().DOWNLOAD_URL_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

export function verifyUploadTicket(
  ticket: string,
  owner: string,
): UploadTicketPayload | null {
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts as [string, string];

  const expected = createHmac('sha256', serverEnv().DOWNLOAD_URL_SECRET)
    .update(body)
    .digest('base64url');

  if (!constantTimeEqual(signature, expected)) return null;

  let payload: UploadTicketPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (payload.expiresAt < Date.now()) return null;
  if (!constantTimeEqual(payload.owner, owner)) return null;

  return payload;
}

// ---------------------------------------------------------------------------
// Guest identity
// ---------------------------------------------------------------------------

export const GUEST_COOKIE = 'hx_guest';
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function createGuestId(): string {
  return `g_${randomBytes(16).toString('hex')}`;
}

export function isValidGuestId(value: string | undefined): value is string {
  return typeof value === 'string' && /^g_[a-f0-9]{32}$/.test(value);
}

// ---------------------------------------------------------------------------
// Emailed auth tokens (password reset, email verification)
// ---------------------------------------------------------------------------

/** How long an emailed secret stays usable, by purpose. */
export const AUTH_TOKEN_TTL_MS = {
  /** Short, because possession of the mailbox is being traded for the account. */
  PASSWORD_RESET: 60 * 60 * 1000,
  /** Longer, because the cost of expiry is only an extra click. */
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
} as const;

/** 32 random bytes, base64url-encoded. */
const AUTH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface GeneratedAuthToken {
  /** Goes in the email link and is never stored. */
  token: string;
  /** Stored in place of the token. */
  tokenHash: string;
}

/**
 * Mints a link secret.
 *
 * 256 bits from the CSPRNG puts guessing out of reach, so the lookup can be a
 * single indexed read on the digest rather than a scan-and-compare.
 */
export function createAuthToken(): GeneratedAuthToken {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashAuthToken(token) };
}

/**
 * Keyed digest of a link secret.
 *
 * HMAC rather than a bare hash: an attacker who reads the token table still
 * cannot mint a matching link without also holding the application secret.
 */
export function hashAuthToken(token: string): string {
  return createHmac('sha256', serverEnv().NEXTAUTH_SECRET)
    .update(token)
    .digest('hex');
}

/** Cheap shape check, so a malformed link never reaches the database. */
export function isWellFormedAuthToken(value: unknown): value is string {
  return typeof value === 'string' && AUTH_TOKEN_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export interface GeneratedApiKey {
  /** Shown to the user exactly once. */
  plaintext: string;
  hashedKey: string;
  prefix: string;
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString('base64url');
  const plaintext = `hx_${secret}`;
  return {
    plaintext,
    hashedKey: hashApiKey(plaintext),
    prefix: plaintext.slice(0, 11),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Escapes a filename for the HTTP `Content-Disposition` header, providing both
 * an ASCII fallback and RFC 5987 UTF-8 form.
 */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
