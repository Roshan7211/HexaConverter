import 'server-only';

import bcrypt from 'bcryptjs';

import * as audit from '@/database/repositories/audit.repository';
import * as users from '@/database/repositories/user.repository';
import { logger } from '@/lib/logger';
import { sendVerification } from '@/services/auth/email-verification.service';
import { sendPasswordChangedEmail } from '@/services/mail/auth-mail.service';
import { storage } from '@/services/storage';

/**
 * Account lifecycle: registration, credential changes and erasure.
 *
 * Password hashing parameters and the anti-enumeration behaviour live here so
 * every entry point (route handler, future API key flow, admin tooling) gets
 * the same guarantees.
 */

/** Work factor: roughly 250 ms per hash on current server hardware. */
const BCRYPT_ROUNDS = 12;

/**
 * A bcrypt hash of a value nobody knows. Compared against when an account does
 * not exist, so a sign-in attempt takes the same time either way.
 */
const DUMMY_HASH =
  '$2a$12$q7Q9Zx7Wc7Yb8hEXW3eG1O0dRZ7nJqK0gk1n1Xg9YkQ1QF2yWlkbG';

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/** Constant-ish time password check that tolerates a missing account. */
export function verifyPassword(
  plaintext: string,
  hash: string | null | undefined,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash ?? DUMMY_HASH);
}

export interface RegisterResult {
  created: boolean;
  /** True when the address was already registered — never told to the client. */
  duplicate: boolean;
}

/**
 * Creates a password account. When the address already exists the same work is
 * performed and the same response is returned, so the endpoint cannot be used
 * to discover which emails are registered.
 */
export async function register(input: {
  name: string;
  email: string;
  password: string;
  ipHash: string;
}): Promise<RegisterResult> {
  const existing = await users.exists(input.email);

  if (existing) {
    await hashPassword(input.password);
    logger.info('Registration attempted for existing address', {
      ipHash: input.ipHash,
    });
    return { created: false, duplicate: true };
  }

  const user = await users.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });

  await audit.record({
    actorId: user.id,
    action: 'user.register',
    target: user.id,
    ipHash: input.ipHash,
  });

  // Delivery is best-effort: a failed send must not roll back a created
  // account, and the user can always ask for another link.
  await sendVerification({
    userId: user.id,
    email: input.email,
    name: input.name,
    emailVerified: null,
    ipHash: input.ipHash,
  });

  logger.info('User registered', { userId: user.id });
  return { created: true, duplicate: false };
}

export type PasswordChangeResult =
  { ok: true } | { ok: false; reason: 'no_password' | 'incorrect' };

/**
 * Changes a password for a signed-in user.
 *
 * Succeeding here signs the account out everywhere, this device included:
 * `updatePassword` moves the session watermark forward. That is the point of
 * changing a password under suspicion, so the UI says so and sends the user
 * back to sign-in rather than hiding it.
 */
export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ipHash: string;
}): Promise<PasswordChangeResult> {
  const user = await users.findById(input.userId);

  if (!user?.passwordHash) return { ok: false, reason: 'no_password' };

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, reason: 'incorrect' };

  await users.updatePassword(
    input.userId,
    await hashPassword(input.newPassword),
  );
  await audit.record({
    actorId: input.userId,
    action: 'user.password_changed',
    ipHash: input.ipHash,
  });

  await sendPasswordChangedEmail({ to: user.email, name: user.name });

  logger.info('Password changed', { userId: input.userId });
  return { ok: true };
}

export function updateProfile(userId: string, name: string) {
  return users.updateProfile(userId, { name });
}

/**
 * Erases an account. Stored objects are removed before the rows that reference
 * them, so a failure part-way through never orphans files.
 */
export async function deleteAccount(
  userId: string,
  ipHash: string,
): Promise<{ objectsRemoved: number }> {
  const jobs = await users.jobStorageKeys(userId);
  const keys = jobs.flatMap((job) =>
    [job.inputKey, job.outputKey].filter((key): key is string => Boolean(key)),
  );

  if (keys.length > 0) await storage().deleteMany(keys);

  await users.remove(userId);
  await audit.record({ action: 'user.deleted', target: userId, ipHash });

  logger.info('Account deleted', { userId, objectsRemoved: keys.length });
  return { objectsRemoved: keys.length };
}
