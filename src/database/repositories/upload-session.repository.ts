import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/database/client';

/**
 * Data access for resumable upload sessions.
 *
 * Every query that touches `UploadSession` goes through here, so the ownership
 * predicate is written once — a session id on its own must never be enough to
 * read, extend or destroy someone else's transfer.
 */

export interface SessionOwner {
  guestId: string;
}

function ownerFilter(owner: SessionOwner) {
  return { guestId: owner.guestId };
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

/**
 * Records one received chunk, atomically.
 *
 * The index is merged into the array **by the database**, against the row as it
 * is at write time. Computing the new array in application code and writing it
 * whole is a read-modify-write, and chunks upload concurrently: three requests
 * that each read `[]`, append their own index and write back leave only the
 * last one's. The bytes are all in storage, but the session reports the other
 * chunks missing and the upload fails to assemble — more often the larger the
 * file, because there are more chunks to race.
 *
 * `receivedSize` is derived from the merged array in the same statement, so it
 * cannot drift from it, and re-sending a chunk is idempotent: `DISTINCT` keeps
 * the array a set, so a replay changes nothing.
 */
export async function recordChunk(id: string, index: number) {
  const rows = await prisma.$queryRaw<
    Array<{ receivedChunks: number[]; receivedSize: bigint }>
  >(Prisma.sql`
    UPDATE "UploadSession" SET
      "receivedChunks" = merged.chunks,
      "receivedSize"   = (
        SELECT COALESCE(SUM(
          CASE WHEN c = "totalChunks" - 1
               THEN "declaredSize" - c::bigint * "chunkSize"
               ELSE "chunkSize"
          END
        ), 0)
        FROM unnest(merged.chunks) AS c
      ),
      "updatedAt" = NOW()
    FROM (
      SELECT ARRAY(
        SELECT DISTINCT x FROM unnest(
          array_append(s."receivedChunks", ${index}::int)
        ) AS x ORDER BY x
      ) AS chunks
      FROM "UploadSession" s WHERE s.id = ${id}
    ) AS merged
    WHERE "UploadSession".id = ${id}
    RETURNING "receivedChunks", "receivedSize"
  `);

  const row = rows[0];
  if (!row) throw new Error(`Upload session ${id} disappeared mid-write`);
  return row;
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
