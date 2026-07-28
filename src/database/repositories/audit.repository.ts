import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/database/client';

/**
 * Append-only security log.
 *
 * Writes must never fail a user-facing request, so callers use `record`, which
 * swallows storage errors after logging them.
 */

export interface AuditEntry {
  actorId?: string;
  action: string;
  target?: string;
  metadata?: Prisma.InputJsonObject;
  ipHash?: string;
}

export async function record(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({ data: entry }).catch(() => undefined);
}

export function pruneOlderThan(cutoff: Date) {
  return prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
