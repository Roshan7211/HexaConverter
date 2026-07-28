import { AuthTokenType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@/api/schemas';
import {
  AUTH_TOKEN_TTL_MS,
  createAuthToken,
  hashAuthToken,
  isWellFormedAuthToken,
} from '@/lib/security';

/**
 * Authentication guarantees that are easy to state and easy to lose:
 * link secrets are unguessable and stored only as digests, a link works once
 * and only for its own purpose, and a revoked session stops being accepted.
 */

// The token and session services talk to Prisma; the repositories are replaced
// so the rules under test are exercised without a database.
vi.mock('@/database/repositories/auth-token.repository', () => ({
  issue: vi.fn(),
  findByHash: vi.fn(),
  consume: vi.fn(),
  revokeOutstanding: vi.fn(),
  countIssuedSince: vi.fn(),
  pruneExpired: vi.fn(),
}));

vi.mock('@/database/repositories/user.repository', () => ({
  findSessionState: vi.fn(),
}));

const tokens = await import('@/database/repositories/auth-token.repository');
const users = await import('@/database/repositories/user.repository');
const { consumeToken, issueToken } =
  await import('@/services/auth/token.service');
const { resolveSessionState } = await import('@/services/auth/session.service');

beforeEach(() => {
  vi.resetAllMocks();
});

/** A stored token row as the repository would return it. */
function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tok_1',
    userId: 'user_1',
    type: AuthTokenType.PASSWORD_RESET,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    user: {
      id: 'user_1',
      email: 'ada@example.com',
      name: 'Ada',
      emailVerified: null,
      passwordHash: 'hash',
    },
    ...overrides,
  };
}

describe('auth token secrets', () => {
  it('mints 256 bits of base64url and stores only the digest', () => {
    const { token, tokenHash } = createAuthToken();

    expect(isWellFormedAuthToken(token)).toBe(true);
    expect(token).toHaveLength(43);
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashes deterministically, so a link can be looked up by digest', () => {
    const { token, tokenHash } = createAuthToken();
    expect(hashAuthToken(token)).toBe(tokenHash);
  });

  it('never repeats a token', () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => createAuthToken().token),
    );
    expect(seen.size).toBe(200);
  });

  it('rejects anything that is not a whole, well-formed token', () => {
    for (const value of [
      '',
      'short',
      `${'a'.repeat(42)}`,
      `${'a'.repeat(44)}`,
      `${'a'.repeat(42)}+`, // base64, not base64url
      null,
      undefined,
      42,
    ]) {
      expect(isWellFormedAuthToken(value)).toBe(false);
    }
  });

  it('gives a reset link a shorter life than a verification link', () => {
    expect(AUTH_TOKEN_TTL_MS.PASSWORD_RESET).toBeLessThan(
      AUTH_TOKEN_TTL_MS.EMAIL_VERIFICATION,
    );
  });
});

describe('token issuing', () => {
  it('retires outstanding links of the same kind before issuing', async () => {
    vi.mocked(tokens.countIssuedSince).mockResolvedValue(0);
    vi.mocked(tokens.revokeOutstanding).mockResolvedValue({ count: 1 });
    vi.mocked(tokens.issue).mockResolvedValue({
      id: 'tok_1',
      expiresAt: new Date(),
    });

    const issued = await issueToken({
      userId: 'user_1',
      type: AuthTokenType.PASSWORD_RESET,
    });

    expect(issued).not.toBeNull();
    expect(tokens.revokeOutstanding).toHaveBeenCalledWith(
      'user_1',
      AuthTokenType.PASSWORD_RESET,
    );
    // The plaintext must never be what gets written.
    const stored = vi.mocked(tokens.issue).mock.calls[0]![0]!;
    expect(stored.tokenHash).not.toBe(issued!.token);
    expect(stored.tokenHash).toBe(hashAuthToken(issued!.token));
  });

  it('stops issuing once a user is over the hourly ceiling', async () => {
    vi.mocked(tokens.countIssuedSince).mockResolvedValue(5);

    const issued = await issueToken({
      userId: 'user_1',
      type: AuthTokenType.PASSWORD_RESET,
    });

    expect(issued).toBeNull();
    expect(tokens.issue).not.toHaveBeenCalled();
  });
});

describe('token redemption', () => {
  it('accepts a live token and marks it spent', async () => {
    vi.mocked(tokens.findByHash).mockResolvedValue(tokenRow());
    vi.mocked(tokens.consume).mockResolvedValue(true);

    const { token } = createAuthToken();
    const result = await consumeToken(token, AuthTokenType.PASSWORD_RESET);

    expect(result.ok).toBe(true);
    expect(tokens.consume).toHaveBeenCalledWith('tok_1');
  });

  it('refuses a token issued for a different purpose', async () => {
    vi.mocked(tokens.findByHash).mockResolvedValue(
      tokenRow({ type: AuthTokenType.EMAIL_VERIFICATION }),
    );

    const { token } = createAuthToken();
    const result = await consumeToken(token, AuthTokenType.PASSWORD_RESET);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(tokens.consume).not.toHaveBeenCalled();
  });

  it('refuses an expired token', async () => {
    vi.mocked(tokens.findByHash).mockResolvedValue(
      tokenRow({ expiresAt: new Date(Date.now() - 1) }),
    );

    const { token } = createAuthToken();
    const result = await consumeToken(token, AuthTokenType.PASSWORD_RESET);

    expect(result).toEqual({ ok: false, reason: 'expired' });
    expect(tokens.consume).not.toHaveBeenCalled();
  });

  it('refuses a token that has already been redeemed', async () => {
    vi.mocked(tokens.findByHash).mockResolvedValue(
      tokenRow({ consumedAt: new Date() }),
    );

    const { token } = createAuthToken();
    const result = await consumeToken(token, AuthTokenType.PASSWORD_RESET);

    expect(result).toEqual({ ok: false, reason: 'used' });
  });

  it('lets only one of two concurrent redemptions win', async () => {
    vi.mocked(tokens.findByHash).mockResolvedValue(tokenRow());
    // The compare-and-set in the repository claims the row once.
    vi.mocked(tokens.consume).mockResolvedValue(false);

    const { token } = createAuthToken();
    const result = await consumeToken(token, AuthTokenType.PASSWORD_RESET);

    expect(result).toEqual({ ok: false, reason: 'used' });
  });

  it('does not query at all for a malformed token', async () => {
    const result = await consumeToken(
      'not-a-token',
      AuthTokenType.PASSWORD_RESET,
    );

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(tokens.findByHash).not.toHaveBeenCalled();
  });
});

describe('session revocation', () => {
  const state = {
    id: 'user_1',
    name: 'Ada',
    image: null,
    role: 'USER' as const,
    plan: 'FREE' as const,
    emailVerified: null,
  };

  it('accepts a session authenticated after the watermark', async () => {
    vi.mocked(users.findSessionState).mockResolvedValue({
      ...state,
      sessionsValidFrom: new Date(1_000),
    });

    const result = await resolveSessionState('user_1', 2_000);
    expect(result.revoked).toBe(false);
  });

  it('rejects a session authenticated before the watermark', async () => {
    vi.mocked(users.findSessionState).mockResolvedValue({
      ...state,
      sessionsValidFrom: new Date(5_000),
    });

    const result = await resolveSessionState('user_1', 2_000);
    expect(result.revoked).toBe(true);
  });

  it('resolves a tie against the session, so a race revokes', async () => {
    vi.mocked(users.findSessionState).mockResolvedValue({
      ...state,
      sessionsValidFrom: new Date(2_000),
    });

    const result = await resolveSessionState('user_1', 2_000);
    expect(result.revoked).toBe(true);
  });

  it('treats a deleted account as revoked', async () => {
    vi.mocked(users.findSessionState).mockResolvedValue(null);

    const result = await resolveSessionState('user_1', Date.now());
    expect(result.revoked).toBe(true);
  });
});

describe('recovery request schemas', () => {
  it('normalises the address on a reset request', () => {
    const parsed = forgotPasswordSchema.parse({ email: '  ADA@Example.COM ' });
    expect(parsed.email).toBe('ada@example.com');
  });

  it('only accepts a whole, well-formed link secret', () => {
    const { token } = createAuthToken();

    expect(authTokenSchema.safeParse(token).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ token }).success).toBe(true);
    expect(authTokenSchema.safeParse(`${token}x`).success).toBe(false);
    expect(authTokenSchema.safeParse(token.slice(0, -1)).success).toBe(false);
  });

  it('holds a reset to the same password policy as registration', () => {
    const { token } = createAuthToken();

    expect(
      resetPasswordSchema.safeParse({ token, password: 'short1' }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token, password: 'allletterspassword' })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ token, password: 'correct horse 7' })
        .success,
    ).toBe(true);
  });
});
