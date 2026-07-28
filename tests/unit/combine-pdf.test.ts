import { describe, expect, it } from 'vitest';

import { createJobSchema } from '@/api/schemas';
import { getFormat } from '@/services/conversion/registry';

/**
 * Combining several images into one PDF.
 *
 * The rule is narrow on purpose — same format, image source, PDF target — and
 * it is enforced in three places: the request schema, the job service, and the
 * browser before either. These cover the contract and the predicate; the
 * service's own checks are integration-level and are not reachable without a
 * database.
 */

/**
 * Mirrors `canCombine` in `use-conversion`. Kept in step by asserting the same
 * registry facts the hook reads, rather than duplicating the format list.
 */
function canCombine(
  sourceFormats: readonly string[],
  targetFormat: string,
): boolean {
  if (sourceFormats.length < 2 || targetFormat !== 'pdf') return false;
  const first = sourceFormats[0];
  if (!first || getFormat(first)?.category !== 'image') return false;
  return sourceFormats.every((format) => format === first);
}

const TICKET = 'x'.repeat(64);

describe('combine request contract', () => {
  it('accepts a job with extra tickets', () => {
    const parsed = createJobSchema.safeParse({
      ticket: TICKET,
      extraTickets: [TICKET, TICKET],
      targetFormat: 'pdf',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.extraTickets).toHaveLength(2);
  });

  it('still accepts a single-file job, so the common path is unchanged', () => {
    const parsed = createJobSchema.safeParse({
      ticket: TICKET,
      targetFormat: 'pdf',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.extraTickets).toBeUndefined();
  });

  it('caps the batch below the largest allowance', () => {
    const parsed = createJobSchema.safeParse({
      ticket: TICKET,
      extraTickets: Array.from({ length: 200 }, () => TICKET),
      targetFormat: 'pdf',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a malformed extra ticket rather than ignoring it', () => {
    const parsed = createJobSchema.safeParse({
      ticket: TICKET,
      extraTickets: ['too-short'],
      targetFormat: 'pdf',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('when a selection combines', () => {
  it('combines several images of one format targeting PDF', () => {
    expect(canCombine(['jpg', 'jpg', 'jpg'], 'pdf')).toBe(true);
    expect(canCombine(['png', 'png'], 'pdf')).toBe(true);
  });

  it('leaves a single file on the ordinary path', () => {
    expect(canCombine(['jpg'], 'pdf')).toBe(false);
  });

  it('does not combine when the target is not PDF', () => {
    expect(canCombine(['jpg', 'jpg'], 'png')).toBe(false);
    expect(canCombine(['png', 'png'], 'webp')).toBe(false);
  });

  it('does not combine mixed source formats', () => {
    // The job row records one format pair, so a mixed batch cannot be one job.
    expect(canCombine(['jpg', 'png'], 'pdf')).toBe(false);
  });

  it('does not combine non-images, even several of one format', () => {
    expect(canCombine(['docx', 'docx'], 'pdf')).toBe(false);
    expect(canCombine(['mp4', 'mp4'], 'pdf')).toBe(false);
    expect(canCombine(['csv', 'csv'], 'pdf')).toBe(false);
  });

  it('agrees with the registry about what an image is', () => {
    // If a format is ever recategorised, this fails rather than silently
    // changing which selections combine.
    for (const format of ['jpg', 'png', 'webp', 'avif', 'gif', 'bmp']) {
      expect(getFormat(format)?.category).toBe('image');
      expect(canCombine([format, format], 'pdf')).toBe(true);
    }
  });
});
