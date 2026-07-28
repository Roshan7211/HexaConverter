import { z } from 'zod';

/** Chunked upload request contracts. */

export const startSessionSchema = z.object({
  /** The name as the browser reports it; sanitised again server-side. */
  filename: z.string().min(1).max(255),
  /** Total byte length, so the server can refuse an oversized file up front. */
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024 * 1024),
});

export type StartSessionPayload = z.infer<typeof startSessionSchema>;
