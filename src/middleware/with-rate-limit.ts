import type { NextResponse } from 'next/server';

import { errors, type ApiErrorBody } from '@/api/responses';
import {
  consume,
  rateLimitHeaders,
  type RateLimitName,
} from '@/lib/rate-limit';
import { clientIp } from '@/lib/security';

/**
 * Applies a named rate limit keyed by client IP (or an explicit identifier such
 * as a user id). Returns a response to send when the caller is over the limit,
 * or `null` to continue.
 */
export function enforceRateLimit(
  name: RateLimitName,
  request: Request,
  identifier?: string,
): NextResponse<ApiErrorBody> | null {
  const key = identifier ?? clientIp(request.headers);
  const result = consume(name, key);

  if (result.success) return null;

  return errors.tooManyRequests(
    `Too many requests. Try again in ${result.retryAfter ?? 60} seconds.`,
    rateLimitHeaders(result),
  );
}
