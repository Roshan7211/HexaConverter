/**
 * Structured JSON logger.
 *
 * Emits one JSON object per line so hosted log pipelines (CloudWatch, Loki,
 * Datadog) can index fields without a parser. Pretty-prints in development.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: Level =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/** Keys whose values are never written to logs. */
const REDACTED = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'sessiontoken',
]);

type Meta = Record<string, unknown>;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      // Wrapped errors carry the real reason on `cause`; without this a
      // user-facing message hides the diagnosis entirely.
      cause:
        value.cause instanceof Error
          ? { name: value.cause.name, message: value.cause.message }
          : undefined,
      stack: process.env.NODE_ENV === 'production' ? undefined : value.stack,
    };
  }
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Meta = {};
    for (const [key, val] of Object.entries(value as Meta)) {
      out[key] = REDACTED.has(key.toLowerCase())
        ? '[redacted]'
        : sanitize(val, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, message: string, meta?: Meta) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[MIN_LEVEL]) return;

  const record = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? (sanitize(meta) as Meta) : {}),
  };

  const line =
    process.env.NODE_ENV === 'production'
      ? JSON.stringify(record)
      : `${level.toUpperCase().padEnd(5)} ${message}${
          meta ? ` ${JSON.stringify(sanitize(meta))}` : ''
        }`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Meta) => write('debug', message, meta),
  info: (message: string, meta?: Meta) => write('info', message, meta),
  warn: (message: string, meta?: Meta) => write('warn', message, meta),
  error: (message: string, meta?: Meta) => write('error', message, meta),
  /** Returns a logger that merges `context` into every record. */
  child(context: Meta) {
    return {
      debug: (m: string, meta?: Meta) =>
        write('debug', m, { ...context, ...meta }),
      info: (m: string, meta?: Meta) =>
        write('info', m, { ...context, ...meta }),
      warn: (m: string, meta?: Meta) =>
        write('warn', m, { ...context, ...meta }),
      error: (m: string, meta?: Meta) =>
        write('error', m, { ...context, ...meta }),
    };
  },
};
