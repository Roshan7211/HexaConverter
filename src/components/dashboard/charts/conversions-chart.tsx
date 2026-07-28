'use client';

import { useId, useState } from 'react';

import type { DailyPoint } from '@/types/stats';
import { cn } from '@/utils';

/**
 * Conversions over time.
 *
 * A single-series area chart: the job is trend, not identity, so it uses one
 * hue and needs no legend — the caption names the series. Failures appear as a
 * second, dashed line only when any exist, so a clean history is not cluttered
 * by a flat zero line.
 *
 * Rendered as inline SVG rather than through a charting library: the shapes are
 * simple, and this keeps a ~40 kB dependency out of the dashboard bundle.
 */

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 34 };

interface Props {
  data: DailyPoint[];
  className?: string;
}

export function ConversionsChart({ data, className }: Props) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return null;

  const hasFailures = data.some((point) => point.failed > 0);
  const peak = Math.max(
    1,
    ...data.map((point) => point.completed + point.failed),
  );
  // A rounded ceiling keeps axis labels readable (5, 10, 20 — not 7).
  const ceiling = niceCeiling(peak);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (index: number) =>
    PADDING.left +
    (data.length === 1
      ? plotWidth / 2
      : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) =>
    PADDING.top + plotHeight - (value / ceiling) * plotHeight;

  const line = (key: 'completed' | 'failed') =>
    data
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${x(index)},${y(point[key])}`,
      )
      .join(' ');

  const area = `${line('completed')} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const active = hover === null ? null : data[hover];
  const total = data.reduce((sum, point) => sum + point.completed, 0);

  return (
    <figure className={cn('viz', className)}>
      <figcaption className="sr-only">
        Conversions per day over the last {data.length} days, {total} completed
        in total.
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={`Daily conversions for the last ${data.length} days`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-area-from)" />
              <stop offset="100%" stopColor="var(--viz-area-to)" />
            </linearGradient>
          </defs>

          {/* Recessive gridlines with their value labels */}
          {[0, 0.5, 1].map((fraction) => {
            const value = Math.round(ceiling * fraction);
            return (
              <g key={fraction}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--viz-grid)"
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8}
                  y={y(value) + 4}
                  textAnchor="end"
                  className="tabular fill-muted-foreground text-[10px]"
                >
                  {value}
                </text>
              </g>
            );
          })}

          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line('completed')}
            fill="none"
            stroke="var(--viz-line)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hasFailures ? (
            <path
              d={line('failed')}
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          ) : null}

          {active && hover !== null ? (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PADDING.top}
                y2={PADDING.top + plotHeight}
                stroke="var(--viz-grid)"
                strokeWidth={1}
              />
              <circle
                cx={x(hover)}
                cy={y(active.completed)}
                r={5}
                fill="var(--viz-line)"
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            </g>
          ) : null}

          {/* Hit areas, wider than the marks they select */}
          {data.map((point, index) => (
            <rect
              key={point.date}
              x={x(index) - plotWidth / data.length / 2}
              y={PADDING.top}
              width={plotWidth / data.length}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}

          {/* First and last date only — one label per day would collide */}
          <text
            x={PADDING.left}
            y={HEIGHT - 8}
            className="fill-muted-foreground text-[10px]"
          >
            {formatDay(data[0]!.date)}
          </text>
          <text
            x={WIDTH - PADDING.right}
            y={HEIGHT - 8}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatDay(data[data.length - 1]!.date)}
          </text>
        </svg>

        {active && hover !== null ? (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(x(hover) / WIDTH) * 100}%`,
              transform: 'translateX(-50%)',
            }}
            role="status"
          >
            <p className="font-medium">{formatDay(active.date, true)}</p>
            <p className="tabular mt-0.5 text-muted-foreground">
              {active.completed} completed
              {active.failed > 0 ? ` · ${active.failed} failed` : ''}
            </p>
          </div>
        ) : null}
      </div>

      {hasFailures ? (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: 'var(--viz-line)' }}
              aria-hidden="true"
            />
            Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded-full bg-destructive"
              aria-hidden="true"
            />
            Failed
          </span>
        </div>
      ) : null}
    </figure>
  );
}

/** Rounds an axis maximum up to a readable step. */
function niceCeiling(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatDay(iso: string, long = false): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(long ? { weekday: 'short' } : {}),
  }).format(new Date(`${iso}T00:00:00Z`));
}
