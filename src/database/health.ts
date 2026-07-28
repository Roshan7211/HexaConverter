import 'server-only';

import { prisma } from '@/database/client';

/**
 * Connectivity probe for the health endpoint.
 *
 * Lives outside `client.ts` so upper layers can import a health check
 * without gaining access to the raw Prisma instance.
 */
export async function databaseHealthy(timeoutMs = 3_000): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error('database probe timed out')),
          timeoutMs,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
