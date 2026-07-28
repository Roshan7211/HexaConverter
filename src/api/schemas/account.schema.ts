import { z } from 'zod';

import { nameSchema, passwordSchema } from '@/api/schemas/common';

/** Profile and credential management payloads. */

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'Choose a password you have not used before',
    path: ['newPassword'],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
