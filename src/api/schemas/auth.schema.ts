import { z } from 'zod';

/**
 * The only thing the browser sends to establish a session.
 *
 * Deliberately just the token. Anything else a client might offer about itself
 * — uid, email, display name — is ignored, because the server reads all of it
 * out of the token after verifying the signature. A field here would be a field
 * an attacker could set.
 */
export const sessionSchema = z.object({
  // Firebase ID tokens are JWTs, so bound the length rather than the shape and
  // let verification be the real check. Generous, because custom claims grow
  // the token.
  idToken: z.string().min(20, 'Missing sign-in token').max(8_192),
});

export type SessionInput = z.infer<typeof sessionSchema>;
