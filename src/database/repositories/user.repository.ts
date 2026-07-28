import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/database/client';

/** Data access for user accounts. */

export function findByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      plan: true,
      passwordHash: true,
      emailVerified: true,
    },
  });
}

export function findById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      plan: true,
      role: true,
      passwordHash: true,
      emailVerified: true,
      createdAt: true,
    },
  });
}

export function exists(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

/**
 * The fields the JWT callback re-checks on a live session: whether it has been
 * revoked, plus the values mirrored into the token.
 */
export function findSessionState(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      role: true,
      plan: true,
      emailVerified: true,
      sessionsValidFrom: true,
    },
  });
}

/** Identity and provider links, for the profile page. */
export function findProfile(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      plan: true,
      emailVerified: true,
      passwordHash: true,
      sessionsValidFrom: true,
      createdAt: true,
      accounts: {
        select: { provider: true },
        orderBy: { provider: 'asc' },
      },
    },
  });
}

export function create(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data, select: { id: true } });
}

export function updateProfile(id: string, data: { name?: string }) {
  return prisma.user.update({ where: { id }, data, select: { name: true } });
}

/**
 * Sets a new password and revokes every session in the same statement.
 *
 * The two belong together: a password change that leaves old sessions alive
 * does not evict whoever the change was meant to lock out.
 */
export function updatePassword(id: string, passwordHash: string) {
  return prisma.user.update({
    where: { id },
    data: { passwordHash, sessionsValidFrom: new Date() },
    select: { id: true },
  });
}

/** Invalidates every session issued before now. */
export function revokeSessions(id: string, at = new Date()) {
  return prisma.user.update({
    where: { id },
    data: { sessionsValidFrom: at },
    select: { sessionsValidFrom: true },
  });
}

/** Idempotent: re-verifying an already verified address keeps the first date. */
export async function markEmailVerified(id: string, at = new Date()) {
  const result = await prisma.user.updateMany({
    where: { id, emailVerified: null },
    data: { emailVerified: at },
  });
  return result.count === 1;
}

/** Cascades to accounts, sessions and conversion jobs. */
export function remove(id: string) {
  return prisma.user.delete({ where: { id } });
}

export function jobStorageKeys(userId: string) {
  return prisma.conversionJob.findMany({
    where: { userId },
    select: { inputKey: true, outputKey: true },
  });
}
