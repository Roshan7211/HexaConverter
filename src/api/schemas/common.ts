import { z } from 'zod';

/** Primitives shared by more than one request schema. */

export const emailSchema = z
  .string()
  .trim()
  .min(5, 'Enter your email address')
  .max(254)
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((value) => /[a-zA-Z]/.test(value), {
    message: 'Include at least one letter',
  })
  .refine((value) => /[0-9]/.test(value) || /[^a-zA-Z0-9]/.test(value), {
    message: 'Include at least one number or symbol',
  });

/** True when a string contains C0 control characters or DEL. */
function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your name')
  .max(80, 'Use at most 80 characters')
  // Angle brackets and control characters have no place in a display name.
  .refine((value) => !/[<>]/.test(value) && !hasControlCharacters(value), {
    message: 'Remove any special characters',
  });

/** Flattens a Zod error into a field -> message map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    output[key] ??= issue.message;
  }
  return output;
}
