import { cn } from '@/utils';

/**
 * A single ratio against a limit.
 *
 * Used for quota and storage. The track and fill are steps of the same ramp,
 * and the numeric value is always printed beside the bar — the meter is a
 * secondary encoding of a number the reader can already see, never the only
 * way to read it.
 *
 * The fill turns to the warning and critical status colours as it approaches
 * the limit; those thresholds are also stated in the caption, so the colour is
 * never the only signal.
 */

export type MeterTone = 'default' | 'warning' | 'critical';

function toneFor(percent: number): MeterTone {
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warning';
  return 'default';
}

const FILL: Record<MeterTone, string> = {
  default: 'var(--viz-3)',
  warning: 'hsl(var(--warning))',
  critical: 'hsl(var(--destructive))',
};

export function Meter({
  value,
  max,
  label,
  valueLabel,
  hint,
  className,
}: {
  value: number;
  max: number;
  label: string;
  /** Formatted value shown beside the label, e.g. "1.2 GB of 6 GB". */
  valueLabel: string;
  hint?: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tone = toneFor(percent);

  return (
    <div className={cn('viz', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="tabular text-sm text-muted-foreground">{valueLabel}</p>
      </div>

      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--viz-track)' }}
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent}% used`}
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-500"
          style={{ width: `${Math.max(1, percent)}%`, background: FILL[tone] }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        <span className="tabular font-medium text-foreground">{percent}%</span>{' '}
        used
        {hint ? ` · ${hint}` : ''}
        {tone === 'critical' ? ' · almost full' : ''}
        {tone === 'warning' ? ' · approaching the limit' : ''}
      </p>
    </div>
  );
}
