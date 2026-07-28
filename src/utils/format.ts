/** Presentation formatters. Pure, isomorphic, no dependencies. */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Human-readable byte size, e.g. `2.4 MB`. */
export function formatBytes(bytes: number | bigint, decimals = 1): string {
  const value = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const scaled = value / 1024 ** exponent;
  const unit = BYTE_UNITS[exponent] ?? 'B';

  return `${scaled.toFixed(exponent === 0 ? 0 : decimals)} ${unit}`;
}

/** Duration in milliseconds as `820ms`, `4.2s` or `1m 12s`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', options).format(value);
}

/** Compact relative time, e.g. `3 minutes ago`, `in 2 hours`. */
export function formatRelativeTime(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';

  const diffSeconds = (value.getTime() - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.34524],
    ['month', 12],
  ];

  let duration = diffSeconds;
  for (const [unit, limit] of thresholds) {
    if (Math.abs(duration) < limit) {
      return formatter.format(Math.round(duration), unit);
    }
    duration /= limit;
  }
  return formatter.format(Math.round(duration), 'year');
}
