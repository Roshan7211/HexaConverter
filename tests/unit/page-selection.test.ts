import { describe, expect, it } from 'vitest';

import {
  groupConsecutive,
  resolvePages,
} from '@/services/documents/page-selection';

/**
 * Page selection is where an off-by-one does real damage: the user types
 * 1-based page numbers and the PDF library wants 0-based indices, so every case
 * below pins that boundary.
 */

describe('resolvePages', () => {
  it('returns every page when the selection is empty or "all"', () => {
    expect(resolvePages(undefined, 3)).toEqual([0, 1, 2]);
    expect(resolvePages('', 3)).toEqual([0, 1, 2]);
    expect(resolvePages('all', 3)).toEqual([0, 1, 2]);
    expect(resolvePages('ALL', 3)).toEqual([0, 1, 2]);
    expect(resolvePages('  all  ', 2)).toEqual([0, 1]);
  });

  it('converts 1-based page numbers to 0-based indices', () => {
    expect(resolvePages('1', 5)).toEqual([0]);
    expect(resolvePages('5', 5)).toEqual([4]);
    expect(resolvePages('1,3', 5)).toEqual([0, 2]);
  });

  it('expands inclusive ranges', () => {
    expect(resolvePages('2-4', 10)).toEqual([1, 2, 3]);
    expect(resolvePages('1-2,4', 10)).toEqual([0, 1, 3]);
    expect(resolvePages('1-1', 10)).toEqual([0]);
  });

  it('counts backwards for a descending range', () => {
    expect(resolvePages('4-2', 10)).toEqual([3, 2, 1]);
  });

  it("preserves the user's order rather than sorting", () => {
    expect(resolvePages('5,1,3', 6)).toEqual([4, 0, 2]);
  });

  it('drops duplicates, keeping the first occurrence', () => {
    expect(resolvePages('2,2,2', 5)).toEqual([1]);
    expect(resolvePages('1-3,2', 5)).toEqual([0, 1, 2]);
  });

  it('ignores pages beyond the document instead of failing', () => {
    expect(resolvePages('1,99', 3)).toEqual([0]);
    expect(resolvePages('2-99', 4)).toEqual([1, 2, 3]);
  });

  it('tolerates whitespace around numbers and ranges', () => {
    expect(resolvePages(' 1 , 3 - 4 ', 6)).toEqual([0, 2, 3]);
  });

  it('throws when nothing in range matched', () => {
    expect(() => resolvePages('50-60', 3)).toThrowError(
      /This document has 3 pages/,
    );
    expect(() => resolvePages('0', 3)).toThrowError();
  });

  it('throws on syntax it cannot interpret', () => {
    expect(() => resolvePages('abc', 5)).toThrowError(
      /not a valid page or range/,
    );
    expect(() => resolvePages('1;2', 5)).toThrowError();
    expect(() => resolvePages('-1', 5)).toThrowError();
  });

  it('handles a single-page document', () => {
    expect(resolvePages('all', 1)).toEqual([0]);
    expect(() => resolvePages('2', 1)).toThrowError(
      /This document has 1 page\b/,
    );
  });
});

describe('groupConsecutive', () => {
  it('groups runs of adjacent indices', () => {
    expect(groupConsecutive([0, 1, 2, 5])).toEqual([[0, 1, 2], [5]]);
    expect(groupConsecutive([0, 2, 4])).toEqual([[0], [2], [4]]);
    expect(groupConsecutive([3, 4])).toEqual([[3, 4]]);
  });

  it('handles empty and single inputs', () => {
    expect(groupConsecutive([])).toEqual([]);
    expect(groupConsecutive([7])).toEqual([[7]]);
  });

  it('does not join a descending pair', () => {
    // 4 then 3 is not ascending-consecutive, so they stay separate documents.
    expect(groupConsecutive([4, 3])).toEqual([[4], [3]]);
  });
});
