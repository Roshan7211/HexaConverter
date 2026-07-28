import 'server-only';

import { prisma } from '@/database/client';

/** Data access for pinned conversion routes. */

export function list(userId: string) {
  return prisma.favoriteRoute.findMany({
    where: { userId },
    orderBy: [
      { lastUsedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
  });
}

export function count(userId: string) {
  return prisma.favoriteRoute.count({ where: { userId } });
}

export function find(
  userId: string,
  sourceFormat: string,
  targetFormat: string,
) {
  return prisma.favoriteRoute.findUnique({
    where: {
      userId_sourceFormat_targetFormat: { userId, sourceFormat, targetFormat },
    },
  });
}

/** Idempotent: pinning an existing route is a no-op rather than an error. */
export function add(
  userId: string,
  sourceFormat: string,
  targetFormat: string,
) {
  return prisma.favoriteRoute.upsert({
    where: {
      userId_sourceFormat_targetFormat: { userId, sourceFormat, targetFormat },
    },
    update: {},
    create: { userId, sourceFormat, targetFormat },
  });
}

export function remove(
  userId: string,
  sourceFormat: string,
  targetFormat: string,
) {
  return prisma.favoriteRoute.deleteMany({
    where: { userId, sourceFormat, targetFormat },
  });
}

/** Records a launch so the list can be ordered by recency of use. */
export function markUsed(
  userId: string,
  sourceFormat: string,
  targetFormat: string,
) {
  return prisma.favoriteRoute.updateMany({
    where: { userId, sourceFormat, targetFormat },
    data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}
