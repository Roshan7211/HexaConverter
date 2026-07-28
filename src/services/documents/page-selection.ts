import { ConversionError } from '@/types/conversion';
import type { PageSelection } from '@/types/documents';

/**
 * Page-selection parsing.
 *
 * Kept free of `server-only` and of any I/O so it can be unit tested directly —
 * this is the fiddliest logic in the toolkit and the easiest place to introduce
 * an off-by-one.
 */

/**
 * Parses a selection such as `1,3,5-9` into zero-based page indices.
 *
 * The user's order is preserved (so `5,1` really does put page 5 first),
 * duplicates are dropped, out-of-range pages are ignored rather than fatal, and
 * a descending range like `9-5` counts backwards.
 */
export function resolvePages(
  selection: PageSelection | undefined,
  pageCount: number,
): number[] {
  if (
    !selection ||
    selection.trim() === '' ||
    selection.trim().toLowerCase() === 'all'
  ) {
    return Array.from({ length: pageCount }, (_unused, index) => index);
  }

  const indices: number[] = [];
  const seen = new Set<number>();

  const push = (page: number) => {
    const index = page - 1;
    if (index >= 0 && index < pageCount && !seen.has(index)) {
      seen.add(index);
      indices.push(index);
    }
  };

  for (const part of selection.split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;

    const range = /^(\d+)\s*-\s*(\d+)$/.exec(chunk);

    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      const step = from <= to ? 1 : -1;

      for (let page = from; step > 0 ? page <= to : page >= to; page += step) {
        push(page);
      }
      continue;
    }

    const single = Number(chunk);
    if (!Number.isInteger(single) || single < 1) {
      throw new ConversionError(
        `"${chunk}" is not a valid page or range. Use a format like 1,3,5-9.`,
      );
    }

    push(single);
  }

  if (indices.length === 0) {
    throw new ConversionError(
      `No pages matched that selection. This document has ${pageCount} page${pageCount === 1 ? '' : 's'}.`,
    );
  }

  return indices;
}

/** Groups consecutive indices, so `[0,1,2,5]` becomes `[[0,1,2],[5]]`. */
export function groupConsecutive(indices: number[]): number[][] {
  const groups: number[][] = [];

  for (const index of indices) {
    const last = groups[groups.length - 1];
    if (last && index === last[last.length - 1]! + 1) last.push(index);
    else groups.push([index]);
  }

  return groups;
}
