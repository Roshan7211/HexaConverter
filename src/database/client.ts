import 'server-only';

import { PrismaClient } from '@prisma/client';

import { isProduction } from '@/lib/env';

/**
 * Single PrismaClient per process. In development the instance is cached on
 * `globalThis` so hot reloads do not exhaust the connection pool.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['error', 'warn'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
