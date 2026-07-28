import type { CategoryPoint } from '@/types/stats';
import { cn } from '@/utils';

/**
 * Conversions by category.
 *
 * Ranked horizontal bars. The job is magnitude comparison, so colour is
 * sequential on a single hue (more is darker in light mode, lighter in dark) —
 * categorical hues would imply the categories are series to tell apart, which
 * they are not here. Every bar is directly labelled, so colour never carries
 * the value alone.
 *
 * Horizontal because the category names are words, not codes: vertical columns
 * would force rotated labels.
 */
export function CategoryBreakdown({
  data,
  className,
}: {
  data: CategoryPoint[];
  className?: string;
}) {
  if (data.length === 0) return null;

  const peak = Math.max(...data.map((point) => point.count), 1);
  const total = data.reduce((sum, point) => sum + point.count, 0);

  // Rank drives the ramp step, so the darkest bar is always the largest.
  const ranked = [...data].sort((a, b) => b.count - a.count);

  return (
    <figure className={cn('viz', className)}>
      <figcaption className="sr-only">
        Conversions by file category, {total} in total.
      </figcaption>

      <ul className="space-y-3">
        {ranked.map((point, index) => {
          const percent = Math.round((point.count / total) * 100);
          const step = Math.min(5, Math.max(1, 5 - index));

          return (
            <li key={point.category}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{point.label}</span>
                <span className="tabular text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {point.count.toLocaleString()}
                  </span>{' '}
                  · {percent}%
                </span>
              </div>

              <div
                className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full"
                style={{ background: 'var(--viz-track)' }}
                role="img"
                aria-label={`${point.label}: ${point.count} conversions, ${percent} percent`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(2, (point.count / peak) * 100)}%`,
                    background: `var(--viz-${step})`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
