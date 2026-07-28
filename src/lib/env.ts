import { z } from 'zod';

/**
 * Runtime environment validation.
 *
 * Server variables are parsed once, on first access from a server context, and
 * the process fails fast with an actionable message when configuration is
 * missing. Client-visible values are read from statically inlined
 * `NEXT_PUBLIC_*` references so they survive bundling.
 */

const booleanish = z
  .enum(['true', 'false', '1', '0', ''])
  .transform((v) => v === 'true' || v === '1');

const serverSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    DATABASE_URL: z.string().url('DATABASE_URL must be a valid database URL'),

    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z
      .string()
      .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // Refuses sign-in until the address is confirmed. Off by default because
    // it is only safe once outbound mail is known to work — see the SMTP check
    // in `superRefine`, which stops the two settings drifting apart.
    REQUIRE_EMAIL_VERIFICATION: booleanish.default('false'),

    DOWNLOAD_URL_SECRET: z
      .string()
      .min(32, 'DOWNLOAD_URL_SECRET must be at least 32 characters'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    // Opt-in for single-node deployments backed by a persistent volume, and
    // for CI. Without it, a production build refuses the local driver.
    ALLOW_LOCAL_STORAGE_IN_PRODUCTION: booleanish.default('false'),

    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanish.default('false'),

    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024 * 1024)
      .default(512 * 1024 * 1024),
    FILE_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
    WORKER_ENABLED: booleanish.default('true'),

    FFMPEG_PATH: z.string().optional(),
    FFPROBE_PATH: z.string().optional(),
    SOFFICE_PATH: z.string().optional(),
    SEVEN_ZIP_PATH: z.string().optional(),

    // Malware scanning is delegated to a ClamAV daemon. Leaving the host unset
    // disables scanning entirely, which the health endpoint reports honestly
    // rather than implying files are checked when they are not.
    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65_535).default(3310),
    CLAMAV_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(600_000)
      .default(120_000),

    CRON_SECRET: z
      .string()
      .min(16, 'CRON_SECRET must be at least 16 characters'),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('no-reply@hexaconverter.app'),
    CONTACT_INBOX: z.string().default('support@hexaconverter.app'),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === 's3') {
      for (const key of [
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }

    // Enforcing verification without a way to send the mail locks every new
    // account out permanently, so the two are required to agree.
    if (value.REQUIRE_EMAIL_VERIFICATION && !value.SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REQUIRE_EMAIL_VERIFICATION'],
        message:
          'REQUIRE_EMAIL_VERIFICATION needs SMTP_HOST set, otherwise verification ' +
          'emails cannot be delivered and new accounts can never sign in',
      });
    }

    if (
      value.NODE_ENV === 'production' &&
      value.STORAGE_DRIVER === 'local' &&
      !value.ALLOW_LOCAL_STORAGE_IN_PRODUCTION
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message:
          'Local storage is not durable across replicas. Set STORAGE_DRIVER=s3, or ' +
          'ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true for a single node with a persistent volume',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** Validated server environment. Throws on the first access if misconfigured. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must not be called from client code');
  }

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}

/** Client-safe configuration, inlined at build time. */
export const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'HexaConverter',
} as const;

export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
