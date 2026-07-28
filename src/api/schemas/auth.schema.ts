import { z } from 'zod';

import { emailSchema, nameSchema, passwordSchema } from '@/api/schemas/common';

/** Sign-in and registration payloads. */

export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to continue' }),
  }),
});

/**
 * A link secret as it appears in an emailed URL: 32 random bytes, base64url.
 * Checked here so a malformed link is refused by the same validation layer as
 * everything else, before any lookup happens.
 */
export const authTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'This link is not valid');

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: authTokenSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: authTokenSchema,
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
