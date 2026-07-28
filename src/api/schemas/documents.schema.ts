import { z } from 'zod';

import { PDF_OPERATIONS } from '@/types/documents';

/** Document toolkit request contracts. */

/** `all`, `3`, `2-9`, or a comma-separated mix such as `1,3,5-9`. */
export const pageSelectionSchema = z
  .string()
  .trim()
  .max(200)
  .regex(
    /^(all|\d{1,5}(\s*-\s*\d{1,5})?(\s*,\s*\d{1,5}(\s*-\s*\d{1,5})?)*)$/i,
    'Use page numbers and ranges, for example 1,3,5-9',
  );

export const pdfTaskSchema = z
  .object({
    operation: z.enum(PDF_OPERATIONS),
    /** Signed upload tickets, in the order the files should be processed. */
    tickets: z.array(z.string().min(20).max(4_096)).min(1).max(30),
    pages: pageSelectionSchema.optional(),
    angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).optional(),
    splitMode: z.enum(['pages', 'ranges']).optional(),
    compression: z.enum(['light', 'balanced', 'strong']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'MERGE' && value.tickets.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tickets'],
        message: 'Select at least two PDFs to merge.',
      });
    }

    if (value.operation !== 'MERGE' && value.tickets.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tickets'],
        message: 'This operation works on one file at a time.',
      });
    }

    if (value.operation === 'EXTRACT_PAGES' && !value.pages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pages'],
        message: 'Choose which pages to extract.',
      });
    }
  });

export type PdfTaskInputPayload = z.infer<typeof pdfTaskSchema>;
