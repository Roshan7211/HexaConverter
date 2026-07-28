import { z } from 'zod';

import { emailSchema, nameSchema } from '@/api/schemas/common';

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  subject: z.string().trim().min(3, 'Add a subject').max(150),
  message: z.string().trim().min(20, 'Tell us a little more').max(5_000),
  /** Honeypot: bots fill hidden fields, humans leave them empty. */
  website: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
