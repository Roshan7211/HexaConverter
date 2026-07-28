import { afterEach, describe, expect, it } from 'vitest';

import {
  consume,
  RATE_LIMITS,
  rateLimitHeaders,
  resetRateLimits,
} from '@/lib/rate-limit';

afterEach(() => {
  resetRateLimits();
});

describe('rate limiter', () => {
  it('allows requests up to the configured limit', () => {
    const { limit } = RATE_LIMITS.contact;

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const result = consume('contact', 'client-a');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(limit - attempt);
    }
  });

  it('rejects once the limit is exceeded', () => {
    const { limit } = RATE_LIMITS.contact;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      consume('contact', 'client-b');
    }

    const rejected = consume('contact', 'client-b');
    expect(rejected.success).toBe(false);
    expect(rejected.remaining).toBe(0);
    expect(rejected.retryAfter).toBeGreaterThan(0);
  });

  it('tracks identifiers independently', () => {
    const { limit } = RATE_LIMITS.contact;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      consume('contact', 'client-c');
    }

    expect(consume('contact', 'client-c').success).toBe(false);
    expect(consume('contact', 'client-d').success).toBe(true);
  });

  it('tracks each rule independently', () => {
    const { limit } = RATE_LIMITS.contact;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      consume('contact', 'client-e');
    }

    expect(consume('contact', 'client-e').success).toBe(false);
    expect(consume('upload', 'client-e').success).toBe(true);
  });

  it('emits standard headers', () => {
    const result = consume('upload', 'client-f');
    const headers = rateLimitHeaders(result) as Record<string, string>;

    expect(headers['RateLimit-Limit']).toBe(String(RATE_LIMITS.upload.limit));
    expect(Number(headers['RateLimit-Remaining'])).toBe(
      RATE_LIMITS.upload.limit - 1,
    );
    expect(Number(headers['RateLimit-Reset'])).toBeGreaterThan(0);
  });
});
