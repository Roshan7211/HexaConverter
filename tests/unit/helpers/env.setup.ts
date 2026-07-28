/**
 * Minimal server environment for unit tests.
 *
 * Modules that read `serverEnv()` validate the whole schema on first access,
 * so a test touching one of them needs every required variable present —
 * placeholder values are enough, since nothing here connects to anything.
 */

// NODE_ENV is typed read-only; vitest already sets it to 'test'.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.NEXTAUTH_SECRET ??= 'test-secret-value-that-is-long-enough-32';
process.env.DOWNLOAD_URL_SECRET ??= 'test-secret-value-that-is-long-enough-32';
process.env.CRON_SECRET ??= 'test-cron-secret-value';
process.env.STORAGE_DRIVER ??= 'local';

export {};
