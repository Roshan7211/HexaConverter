/**
 * Fixed-window rate limiter backed by an in-process map.
 *
 * Counters are per instance. Behind multiple replicas the effective limit is
 * `limit × replicas`, which is acceptable for the abuse-prevention thresholds
 * used here; the entry point is a single `consume()` call so a shared store
 * (Redis/Upstash) can replace the map without touching call sites.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

const MAX_TRACKED_KEYS = 50_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000 && windows.size < MAX_TRACKED_KEYS) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // Hard cap as a memory backstop if traffic outpaces expiry.
  if (windows.size > MAX_TRACKED_KEYS) windows.clear();
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix milliseconds when the current window resets. */
  resetAt: number;
  /** Seconds the caller should wait, only set when the request was rejected. */
  retryAfter?: number;
}

/** Named rules so thresholds live in one place. */
export const RATE_LIMITS = {
  upload: { limit: 20, windowSeconds: 60 * 10 },
  // A single large file is many requests, so chunks get their own allowance;
  // sharing the `upload` budget would make chunking count against itself.
  chunk: { limit: 2_000, windowSeconds: 60 * 10 },
  job: { limit: 30, windowSeconds: 60 * 10 },
  // Importing a link makes us fetch a third party on the caller's behalf, so
  // it gets its own budget rather than sharing the upload one. Sized against
  // the largest batch a plan allows: a tighter ceiling than `maxBatchFiles`
  // would refuse someone halfway through assembling a legitimate batch.
  urlImport: { limit: 20, windowSeconds: 60 * 10 },
  download: { limit: 120, windowSeconds: 60 * 10 },
  auth: { limit: 10, windowSeconds: 60 * 15 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  // Endpoints that send mail to an address the caller chose. Kept tight
  // because the cost of abuse lands on the recipient's inbox, not on us; the
  // per-user ceiling in the token service is the second half of this.
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  emailVerification: { limit: 5, windowSeconds: 60 * 60 },
  // Redemption, not sending: the limit exists to stop token guessing, which is
  // already hopeless at 256 bits, so it only needs to be non-generous.
  tokenRedemption: { limit: 20, windowSeconds: 60 * 15 },
  contact: { limit: 3, windowSeconds: 60 * 60 },
  read: { limit: 300, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export function consume(
  name: RateLimitName,
  identifier: string,
): RateLimitResult {
  const rule = RATE_LIMITS[name];
  const now = Date.now();
  sweep(now);

  const key = `${name}:${identifier}`;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowSeconds * 1000;
    windows.set(key, { count: 1, resetAt });
    return {
      success: true,
      limit: rule.limit,
      remaining: rule.limit - 1,
      resetAt,
    };
  }

  existing.count += 1;

  if (existing.count > rule.limit) {
    return {
      success: false,
      limit: rule.limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    success: true,
    limit: rule.limit,
    remaining: rule.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Standard rate-limit response headers. */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  };
  if (result.retryAfter) headers['Retry-After'] = String(result.retryAfter);
  return headers;
}

/** Test helper — clears all windows. */
export function resetRateLimits() {
  windows.clear();
}
