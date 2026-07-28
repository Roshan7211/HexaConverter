import { z } from 'zod';

import { ARCHIVE_OPERATIONS, ARCHIVE_TARGETS } from '@/types/archives';

/** Archive toolkit request contracts. */

/**
 * Passwords are passed straight to the archiver, never to a shell, so the only
 * limits that matter are the ones that keep a request sane. Control characters
 * are excluded because no archive tool round-trips them reliably.
 */
export const archivePasswordSchema = z
  .string()
  .min(1, 'Enter a password.')
  .max(256, 'That password is too long.')
  .refine(
    (value) => ![...value].some((char) => char.charCodeAt(0) < 0x20),
    'The password cannot contain control characters.',
  );

export const archiveTaskSchema = z
  .object({
    operation: z.enum(ARCHIVE_OPERATIONS),
    /** Signed upload tickets, in the order the files should be packed. */
    tickets: z.array(z.string().min(20).max(4_096)).min(1).max(50),
    target: z.enum(ARCHIVE_TARGETS).optional(),
    compressionLevel: z.number().int().min(0).max(9).optional(),
    password: archivePasswordSchema.optional(),
    encryption: z.enum(['aes256', 'zipcrypto']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === 'EXTRACT' && value.tickets.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tickets'],
        message: 'Extraction opens one archive at a time.',
      });
    }

    if (value.operation === 'PROTECT' && !value.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Enter the password the archive should be locked with.',
      });
    }

    if (value.operation === 'ARCHIVE' && !value.target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target'],
        message: 'Choose an archive format.',
      });
    }
  });

export type ArchiveTaskInputPayload = z.infer<typeof archiveTaskSchema>;
