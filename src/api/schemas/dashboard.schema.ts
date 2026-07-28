import { z } from 'zod';

/** Dashboard request contracts. */

const formatId = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{1,8}$/, 'Invalid format');

export const favoriteSchema = z.object({
  sourceFormat: formatId,
  targetFormat: formatId,
});

export const notificationReadSchema = z.object({
  /** Omit to mark every unread notification as read. */
  ids: z.array(z.string().cuid()).max(100).optional(),
});

export const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).optional().default(30),
});

export type FavoriteInput = z.infer<typeof favoriteSchema>;
export type NotificationReadInput = z.infer<typeof notificationReadSchema>;
