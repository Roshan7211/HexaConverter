import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CategoryBreakdown } from '@/components/dashboard/charts/category-breakdown';
import { ConversionsChart } from '@/components/dashboard/charts/conversions-chart';
import { Meter } from '@/components/dashboard/charts/meter';
import type { CategoryPoint, DailyPoint } from '@/types/stats';

/**
 * Chart geometry.
 *
 * An SVG path containing `NaN` renders as nothing — no error, no warning, just
 * an empty chart. These tests render the real components and assert the output
 * is well-formed for the edge cases that produce it: a single point, an empty
 * series, and all-zero data.
 */

function days(counts: Array<[number, number]>): DailyPoint[] {
  return counts.map(([completed, failed], index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    completed,
    failed,
  }));
}

describe('ConversionsChart', () => {
  it('produces no NaN coordinates for a normal series', () => {
    const html = renderToStaticMarkup(
      <ConversionsChart
        data={days([
          [3, 0],
          [7, 1],
          [2, 0],
          [11, 2],
        ])}
      />,
    );

    expect(html).not.toContain('NaN');
    expect(html).toContain('<path');
  });

  it('handles a single data point without dividing by zero', () => {
    const html = renderToStaticMarkup(
      <ConversionsChart data={days([[4, 0]])} />,
    );

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('handles an all-zero series', () => {
    const html = renderToStaticMarkup(
      <ConversionsChart
        data={days([
          [0, 0],
          [0, 0],
          [0, 0],
        ])}
      />,
    );

    expect(html).not.toContain('NaN');
    // With no failures the second line is omitted rather than drawn flat.
    expect(html).not.toContain('stroke-dasharray');
  });

  it('renders nothing when there is no data at all', () => {
    expect(renderToStaticMarkup(<ConversionsChart data={[]} />)).toBe('');
  });

  it('draws the failure line only when failures exist', () => {
    const without = renderToStaticMarkup(
      <ConversionsChart
        data={days([
          [5, 0],
          [6, 0],
        ])}
      />,
    );
    const with_ = renderToStaticMarkup(
      <ConversionsChart
        data={days([
          [5, 0],
          [6, 3],
        ])}
      />,
    );

    expect(without).not.toContain('stroke-dasharray');
    expect(with_).toContain('stroke-dasharray');
  });

  it('describes itself for screen readers', () => {
    const html = renderToStaticMarkup(
      <ConversionsChart
        data={days([
          [5, 0],
          [6, 1],
        ])}
      />,
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label');
    expect(html).toContain('11 completed');
  });
});

describe('CategoryBreakdown', () => {
  const data: CategoryPoint[] = [
    { category: 'image', label: 'Images', count: 40 },
    { category: 'video', label: 'Video', count: 10 },
    { category: 'audio', label: 'Audio', count: 0 },
  ];

  it('labels every bar with its value, never colour alone', () => {
    const html = renderToStaticMarkup(<CategoryBreakdown data={data} />);

    expect(html).toContain('Images');
    expect(html).toContain('40');
    // 40 of 50 total.
    expect(html).toContain('80%');
    expect(html).not.toContain('NaN');
  });

  it('gives a zero-count category a visible minimum bar', () => {
    const html = renderToStaticMarkup(<CategoryBreakdown data={data} />);
    expect(html).toContain('width:2%');
  });

  it('renders nothing when empty', () => {
    expect(renderToStaticMarkup(<CategoryBreakdown data={[]} />)).toBe('');
  });
});

describe('Meter', () => {
  it('exposes an accessible meter role with bounded values', () => {
    const html = renderToStaticMarkup(
      <Meter
        value={512}
        max={1024}
        label="Storage"
        valueLabel="512 B of 1 KB"
      />,
    );

    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('50%');
  });

  it('never exceeds 100% or divides by a zero maximum', () => {
    const over = renderToStaticMarkup(
      <Meter value={99} max={10} label="Quota" valueLabel="99 of 10" />,
    );
    const zero = renderToStaticMarkup(
      <Meter value={5} max={0} label="Quota" valueLabel="5 of 0" />,
    );

    expect(over).toContain('aria-valuenow="100"');
    expect(zero).toContain('aria-valuenow="0"');
    expect(zero).not.toContain('NaN');
  });

  it('escalates its tone as the limit approaches', () => {
    const warning = renderToStaticMarkup(
      <Meter value={80} max={100} label="Quota" valueLabel="80 of 100" />,
    );
    const critical = renderToStaticMarkup(
      <Meter value={95} max={100} label="Quota" valueLabel="95 of 100" />,
    );

    // The wording carries the state too — colour is never the only signal.
    expect(warning).toContain('approaching the limit');
    expect(critical).toContain('almost full');
  });
});
