import 'server-only';

import {
  JobStatus,
  Prisma,
  type ArchiveOperation,
  type DocumentOperation,
} from '@prisma/client';

import { prisma } from '@/database/client';

/**
 * Queue-side data access.
 *
 * Separate from `job.repository` because these queries are written for
 * concurrency rather than for reads: the claim uses `FOR UPDATE SKIP LOCKED`
 * so any number of workers can share one queue without a broker, and every
 * mutation carries the lease bookkeeping that makes a crashed worker
 * recoverable.
 */

export interface ClaimedJobRow {
  id: string;
  inputKey: string;
  inputName: string;
  sourceFormat: string;
  targetFormat: string;
  options: Prisma.JsonValue;
  attempts: number;
  operation: DocumentOperation | null;
  archiveOperation: ArchiveOperation | null;
  extraInputKeys: string[];
  extraInputNames: string[];
}

/**
 * Atomically claims the oldest queued job for `workerId`, or returns `null`
 * when the queue is empty. Two workers racing here cannot claim the same row.
 */
export async function claimNext(
  workerId: string,
): Promise<ClaimedJobRow | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE "ConversionJob"
    SET status = 'PROCESSING',
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "startedAt" = COALESCE("startedAt", NOW()),
        attempts = attempts + 1,
        "updatedAt" = NOW()
    WHERE id = (
      SELECT id FROM "ConversionJob"
      WHERE status = 'QUEUED' AND "expiresAt" > NOW()
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
  `);

  const claimedId = rows[0]?.id;
  if (!claimedId) return null;

  return prisma.conversionJob.findUnique({
    where: { id: claimedId },
    select: {
      id: true,
      inputKey: true,
      inputName: true,
      sourceFormat: true,
      targetFormat: true,
      options: true,
      attempts: true,
      operation: true,
      archiveOperation: true,
      extraInputKeys: true,
      extraInputNames: true,
    },
  });
}

/** Persists progress and renews the lease; returns the current status. */
export function reportProgress(id: string, progress: number) {
  return prisma.conversionJob.update({
    where: { id },
    data: { progress, lockedAt: new Date() },
    select: { status: true },
  });
}

export interface CompletionData {
  outputKey: string;
  outputName: string;
  outputSize: number;
  outputMime: string;
  durationMs: number;
  /** Engine-reported summary, e.g. `4 files extracted from RAR`. */
  detail?: string;
}

export function markCompleted(id: string, result: CompletionData) {
  return prisma.conversionJob.update({
    where: { id },
    data: {
      status: JobStatus.COMPLETED,
      progress: 100,
      outputKey: result.outputKey,
      outputName: result.outputName,
      outputSize: BigInt(result.outputSize),
      outputMime: result.outputMime,
      outputDetail: result.detail ?? null,
      durationMs: result.durationMs,
      finishedAt: new Date(),
      error: null,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export function markFailed(id: string, error: string, durationMs: number) {
  return prisma.conversionJob.update({
    where: { id },
    data: {
      status: JobStatus.FAILED,
      error,
      durationMs,
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export function markCancelled(id: string) {
  return prisma.conversionJob.update({
    where: { id },
    data: {
      status: JobStatus.CANCELLED,
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

/** Returns a job to the queue for another attempt. */
export function requeue(id: string, error: string) {
  return prisma.conversionJob.update({
    where: { id },
    data: {
      status: JobStatus.QUEUED,
      progress: 0,
      error,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export function requeueStale(cutoff: Date, maxAttempts: number) {
  return prisma.conversionJob.updateMany({
    where: {
      status: JobStatus.PROCESSING,
      lockedAt: { lt: cutoff },
      attempts: { lt: maxAttempts },
    },
    data: {
      status: JobStatus.QUEUED,
      lockedAt: null,
      lockedBy: null,
      progress: 0,
    },
  });
}

export function failStale(cutoff: Date, maxAttempts: number) {
  return prisma.conversionJob.updateMany({
    where: {
      status: JobStatus.PROCESSING,
      lockedAt: { lt: cutoff },
      attempts: { gte: maxAttempts },
    },
    data: {
      status: JobStatus.FAILED,
      error: 'The conversion timed out and could not be completed.',
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export function findExpired(limit: number) {
  return prisma.conversionJob.findMany({
    where: {
      expiresAt: { lt: new Date() },
      status: {
        in: [
          JobStatus.COMPLETED,
          JobStatus.FAILED,
          JobStatus.QUEUED,
          JobStatus.CANCELLED,
        ],
      },
      OR: [{ inputKey: { not: '' } }, { outputKey: { not: null } }],
    },
    select: { id: true, inputKey: true, outputKey: true },
    take: limit,
  });
}

/**
 * Clears file references but keeps the row, so a browser still polling a
 * finished conversion gets "expired" rather than "not found". The rows
 * themselves go in the sweep below.
 */
export function markExpired(ids: string[]) {
  return prisma.conversionJob.updateMany({
    where: { id: { in: ids } },
    data: {
      status: JobStatus.EXPIRED,
      inputKey: '',
      outputKey: null,
      progress: 100,
    },
  });
}

/**
 * Removes job rows outright once their files are long gone. Nothing is kept
 * for a user to look back at, so the record has no reason to outlive the file
 * it described.
 */
export function deleteHistoryBefore(cutoff: Date) {
  return prisma.conversionJob.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
