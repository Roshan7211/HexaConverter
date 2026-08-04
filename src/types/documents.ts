/**
 * Document toolkit contracts.
 *
 * Shared by the browser controls and the server, so a page selection typed in
 * the UI is the same shape the service validates.
 */

export const PDF_OPERATIONS = [
  'MERGE',
  'SPLIT',
  'EXTRACT_PAGES',
  'ROTATE',
  'COMPRESS',
  'OCR',
] as const;

export type PdfOperation = (typeof PDF_OPERATIONS)[number];

/** A page list such as `all`, `1,4`, `2-9`, or `1,3,5-9`. */
export type PageSelection = string;

export interface PdfOperationSpec {
  id: PdfOperation;
  /** URL segment, e.g. `/tools/pdf/merge`. */
  slug: string;
  label: string;
  description: string;
  /** Minimum and maximum files the operation accepts. */
  minFiles: number;
  maxFiles: number;
  /** Whether the result may be a ZIP rather than a single PDF. */
  mayProduceArchive: boolean;
  /**
   * Requires a signed-in account. Not a paid gate — it exists because the
   * operation is expensive enough that it should not be available to an
   * anonymous visitor who can reset their allowance by clearing a cookie.
   */
  requiresAccount?: boolean;
}

export const PDF_OPERATION_SPECS: Readonly<
  Record<PdfOperation, PdfOperationSpec>
> = Object.freeze({
  MERGE: {
    id: 'MERGE',
    slug: 'merge',
    label: 'Merge PDFs',
    description:
      'Combine several PDFs into one document, in the order you arrange them.',
    minFiles: 2,
    maxFiles: 30,
    mayProduceArchive: false,
  },
  SPLIT: {
    id: 'SPLIT',
    slug: 'split',
    label: 'Split PDF',
    description:
      'Break a document into separate files — one per page, or one per range.',
    minFiles: 1,
    maxFiles: 1,
    mayProduceArchive: true,
  },
  EXTRACT_PAGES: {
    id: 'EXTRACT_PAGES',
    slug: 'extract-pages',
    label: 'Extract pages',
    description: 'Keep only the pages you choose and discard the rest.',
    minFiles: 1,
    maxFiles: 1,
    mayProduceArchive: false,
  },
  ROTATE: {
    id: 'ROTATE',
    slug: 'rotate',
    label: 'Rotate PDF',
    description:
      'Turn every page, or just the ones you pick, by 90°, 180° or 270°.',
    minFiles: 1,
    maxFiles: 1,
    mayProduceArchive: false,
  },
  COMPRESS: {
    id: 'COMPRESS',
    slug: 'compress',
    label: 'Compress PDF',
    description: 'Reduce the file size, with a choice of how aggressive to be.',
    minFiles: 1,
    maxFiles: 1,
    mayProduceArchive: false,
  },
  OCR: {
    id: 'OCR',
    slug: 'ocr',
    label: 'Make a scan searchable',
    description:
      'Read the text in a scanned document and give you it back as plain text, or as a PDF you can search and copy from.',
    minFiles: 1,
    maxFiles: 1,
    mayProduceArchive: false,
    // Recognition is seconds of CPU per page rather than the fractions a normal
    // conversion needs, so it is tied to an account: the allowance then belongs
    // to a person rather than to a cookie anyone can clear and start again.
    // Free accounts included — it is a reason to register, not a reason to pay.
    requiresAccount: true,
  },
});

export const PDF_OPERATION_BY_SLUG: Readonly<Record<string, PdfOperation>> =
  Object.freeze(
    Object.fromEntries(
      Object.values(PDF_OPERATION_SPECS).map((spec) => [spec.slug, spec.id]),
    ),
  );
