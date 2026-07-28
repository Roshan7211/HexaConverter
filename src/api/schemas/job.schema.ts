import { z } from 'zod';

import { CATEGORIES } from '@/types/conversion';

/** Conversion job request payloads. */

const ticketSchema = z.string().min(20).max(4_096);

export const createJobSchema = z.object({
  /** Signed ticket returned by the upload endpoint. */
  ticket: ticketSchema,
  /**
   * Further uploads to fold into one output, in page order. Only images to a
   * single PDF supports this today; the service rejects it for anything else
   * rather than silently ignoring the extras.
   *
   * Capped at 199 so a request can never describe more than the 200-file batch
   * ceiling, whatever the client sends.
   */
  extraTickets: z.array(ticketSchema).max(199).optional(),
  targetFormat: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]{1,8}$/, 'Invalid target format'),
  options: z.record(z.unknown()).optional(),
});

export const jobListQuerySchema = z.object({
  status: z
    .enum(['all', 'active', 'completed', 'failed'])
    .optional()
    .default('all'),
  category: z.enum(CATEGORIES).optional(),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobListQuery = z.infer<typeof jobListQuerySchema>;
