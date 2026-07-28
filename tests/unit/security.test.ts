import { beforeAll, describe, expect, it } from 'vitest';

/**
 * `security.ts` reads validated environment on first use, so the required
 * variables are provided before the module is imported.
 */
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/test';
  process.env.NEXTAUTH_SECRET ??=
    'test-secret-value-that-is-long-enough-123456';
  process.env.DOWNLOAD_URL_SECRET ??=
    'test-download-secret-value-long-enough-1234567';
  process.env.CRON_SECRET ??= 'test-cron-secret-value';
});

describe('filename sanitisation', () => {
  it('strips directory traversal and path separators', async () => {
    const { sanitizeFilename } = await import('@/lib/security');

    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe(
      'cmd.exe',
    );
    expect(sanitizeFilename('/absolute/path/report.pdf')).toBe('report.pdf');
  });

  it('replaces unsafe characters and reserved names', async () => {
    const { sanitizeFilename } = await import('@/lib/security');

    expect(sanitizeFilename('my file (1).png')).toBe('my_file_1_.png');
    expect(sanitizeFilename('CON.txt')).toBe('file');
    expect(sanitizeFilename('...')).toBe('file');
    expect(sanitizeFilename('')).toBe('file');
  });

  it('caps the length', async () => {
    const { sanitizeFilename } = await import('@/lib/security');
    expect(
      sanitizeFilename(`${'a'.repeat(500)}.png`).length,
    ).toBeLessThanOrEqual(180);
  });
});

describe('download tokens', () => {
  it('round-trips a valid token', async () => {
    const { signDownloadToken, verifyDownloadToken } =
      await import('@/lib/security');

    const token = signDownloadToken({
      jobId: 'job_123',
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });

    expect(verifyDownloadToken(token)?.jobId).toBe('job_123');
  });

  it('rejects a tampered payload', async () => {
    const { signDownloadToken, verifyDownloadToken } =
      await import('@/lib/security');

    const token = signDownloadToken({
      jobId: 'job_123',
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });

    const [body, signature] = token.split('.');
    const forged = `${Buffer.from('job_456.9999999999').toString('base64url')}.${signature}`;

    expect(verifyDownloadToken(forged)).toBeNull();
    expect(verifyDownloadToken(`${body}.deadbeef`)).toBeNull();
    expect(verifyDownloadToken('nonsense')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const { signDownloadToken, verifyDownloadToken } =
      await import('@/lib/security');

    const token = signDownloadToken({
      jobId: 'job_123',
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });

    expect(verifyDownloadToken(token)).toBeNull();
  });
});

describe('upload tickets', () => {
  const payload = {
    key: 'inputs/2026/01/01/abc.png',
    name: 'photo.png',
    size: 1024,
    mime: 'image/png',
    sourceFormat: 'png',
    owner: 'u:user_1',
    expiresAt: Date.now() + 60_000,
  };

  it('round-trips for the issuing owner', async () => {
    const { signUploadTicket, verifyUploadTicket } =
      await import('@/lib/security');

    const ticket = signUploadTicket(payload);
    expect(verifyUploadTicket(ticket, 'u:user_1')?.key).toBe(payload.key);
  });

  it('refuses a ticket presented by another owner', async () => {
    const { signUploadTicket, verifyUploadTicket } =
      await import('@/lib/security');

    const ticket = signUploadTicket(payload);
    expect(verifyUploadTicket(ticket, 'u:user_2')).toBeNull();
    expect(
      verifyUploadTicket(ticket, 'g:g_00000000000000000000000000000000'),
    ).toBeNull();
  });

  it('refuses an expired ticket', async () => {
    const { signUploadTicket, verifyUploadTicket } =
      await import('@/lib/security');

    const ticket = signUploadTicket({
      ...payload,
      expiresAt: Date.now() - 1_000,
    });
    expect(verifyUploadTicket(ticket, 'u:user_1')).toBeNull();
  });
});

describe('guest identifiers', () => {
  it('generates values that pass validation', async () => {
    const { createGuestId, isValidGuestId } = await import('@/lib/security');

    expect(isValidGuestId(createGuestId())).toBe(true);
    expect(isValidGuestId('g_short')).toBe(false);
    expect(isValidGuestId(undefined)).toBe(false);
    expect(isValidGuestId('../etc/passwd')).toBe(false);
  });
});

describe('content disposition', () => {
  it('provides an ASCII fallback and a UTF-8 form', async () => {
    const { contentDisposition } = await import('@/lib/security');

    const header = contentDisposition('résumé "final".pdf');
    expect(header).toContain('attachment;');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).not.toContain('"final"');
  });
});
