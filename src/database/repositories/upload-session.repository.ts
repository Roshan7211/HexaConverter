import 'server-only';

import { prisma } from '@/database/client';

/**
 * Data access for resumable upload sessions.
 *
 * Every query that touches `UploadSession` goes through here, so the ownership
 * predicate is written once — a session id on its own must never be enough to
 * read, extend or destroy someone else's transfer.
 */

export interface SessionOwner {
  userId: string | null;
  guestId: string | null;
}

function ownerFilter(owner: SessionOwner) {
  return owner.userId ? { userId: owner.userId } : { guestId: owner.guestId! };
}

export interface CreateSessionData {
  owner: SessionOwner;
  filename: string;
  sourceFormat: string;
  mime: string;
  declaredSize: number;
  chunkSize: number;
  totalChunks: number;
  storagePrefix: string;
  expiresAt: Date;
}

export function create(data: CreateSessionData) {
  return prisma.uploadSession.create({
    data: {
      userId: data.owner.userId,
      guestId: data.owner.guestId,
      filename: data.filename,
      sourceFormat: data.sourceFormat,
      mime: data.mime,
      declaredSize: BigInt(data.declaredSize),
      chunkSize: data.chunkSize,
      totalChunks: data.totalChunks,
      storagePrefix: data.storagePrefix,
      expiresAt: data.expiresAt,
    },
  });
}

export function findOwned(id: string, owner: SessionOwner) {
  return prisma.uploadSession.findFirst({
    where: { id, ...ownerFilter(owner) },
  });
}

export function recordChunks(
  id: string,
  receivedChunks: number[],
  receivedSize: number,
) {
  return prisma.uploadSession.update({
    where: { id },
    data: { receivedChunks, receivedSize: BigInt(receivedSize) },
  });
}

export function remove(id: string) {
  return prisma.uploadSession.delete({ where: { id } });
}

/** Sessions abandoned mid-transfer, for the retention sweep. */
export function findExpired(now = new Date()) {
  return prisma.uploadSession.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, storagePrefix: true, receivedChunks: true },
  });
}

export function removeMany(ids: string[]) {
  return prisma.uploadSession.deleteMany({ where: { id: { in: ids } } });
}
