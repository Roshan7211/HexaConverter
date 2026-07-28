import 'server-only';

import { JobStatus, type Prisma } from '@prisma/client';

import { toJobDto, type JobDto } from '@/api/dto/job.dto';
import * as jobs from '@/database/repositories/job.repository';
import type { Requester } from '@/services/auth/identity.service';
import { logger } from '@/lib/logger';
import { storage } from '@/services/storage';
import type { Category } from '@/types/conversion';
import type { FileCategory } from '@prisma/client';

/**
 * Conversion job business logic.
 *
 * Route handlers call these functions; they never touch Prisma directly. Each
 * one takes the resolved `Requester` so ownership scoping is not optional.
 */

const SLUG_TO_CATEGORY: Record<Category, FileCategory> = {
  image: 'IMAGE',
  document: 'DOCUMENT',
  audio: 'AUDIO',
  video: 'VIDEO',
  archive: 'ARCHIVE',
};

export function toPrismaCategory(category: Category): FileCategory {
  return SLUG_TO_CATEGORY[category];
}

function scope(requester: Requester): jobs.OwnerScope {
  return { userId: requester.userId, guestId: requester.guestId };
}

export async function getOwnedJob(
  id: string,
  requester: Requester,
): Promise<JobDto | null> {
  const row = await jobs.findOwned(id, scope(requester));
  return row ? toJobDto(row) : null;
}

export interface ListJobsParams {
  requester: Requester;
  status: 'all' | 'active' | 'completed' | 'failed';
  category?: Category;
  cursor?: string;
  limit: number;
}

const STATUS_FILTERS: Record<string, Prisma.ConversionJobWhereInput> = {
  active: { status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] } },
  completed: { status: JobStatus.COMPLETED },
  failed: { status: { in: [JobStatus.FAILED, JobStatus.CANCELLED] } },
  all: {},
};

export async function listJobs({
  requester,
  status,
  category,
  cursor,
  limit,
}: ListJobsParams): Promise<{ jobs: JobDto[]; nextCursor: string | null }> {
  const rows = await jobs.list({
    owner: scope(requester),
    where: {
      ...(STATUS_FILTERS[status] ?? {}),
      ...(category ? { category: toPrismaCategory(category) } : {}),
    },
    limit,
    cursor,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    jobs: page.map(toJobDto),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/** Aggregate counters for the dashboard header. */
export async function jobStats(requester: Requester) {
  const owner = scope(requester);

  const [total, completed, active, bytes] = await Promise.all([
    jobs.countForOwner(owner),
    jobs.countForOwner(owner, { status: JobStatus.COMPLETED }),
    jobs.countForOwner(owner, {
      status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
    }),
    jobs.sumInputBytes(owner),
  ]);

  return {
    total,
    completed,
    active,
    bytesProcessed: Number(bytes._sum.inputSize ?? 0),
  };
}

export type JobActionResult =
  | { ok: true; job: JobDto }
  | { ok: false; reason: 'not_found' | 'still_running' | 'already_finished' };

/**
 * Cancels a queued or running conversion. The worker observes the new status
 * at its next progress checkpoint and aborts its encoder.
 */
export async function cancelOwnedJob(
  id: string,
  requester: Requester,
): Promise<JobActionResult> {
  const existing = await jobs.findOwned(id, scope(requester));
  if (!existing) return { ok: false, reason: 'not_found' };

  if (
    existing.status !== JobStatus.QUEUED &&
    existing.status !== JobStatus.PROCESSING
  ) {
    return { ok: false, reason: 'already_finished' };
  }

  return { ok: true, job: toJobDto(await jobs.markCancelled(id)) };
}

/** Deletes a conversion and every object it still references. */
export async function deleteOwnedJob(
  id: string,
  requester: Requester,
): Promise<JobActionResult | { ok: true; job: null }> {
  const existing = await jobs.findOwned(id, scope(requester));
  if (!existing) return { ok: false, reason: 'not_found' };

  if (existing.status === JobStatus.PROCESSING) {
    return { ok: false, reason: 'still_running' };
  }

  const record = await jobs.findKeys(id);
  const keys = [record?.inputKey, record?.outputKey].filter(
    (key): key is string => Boolean(key),
  );
  if (keys.length > 0) await storage().deleteMany(keys);

  await jobs.remove(id);
  return { ok: true, job: null };
}

export interface PurgeResult {
  /** Conversions removed from the queue and the database. */
  jobs: number;
  /** Stored objects deleted from the file store. */
  files: number;
  /** Conversions left alone because they are still running. */
  skipped: number;
}

/**
 * Deletes every file this requester has stored, ahead of the retention sweep.
 *
 * Running jobs are left alone — deleting an input from under a worker turns a
 * conversion that was about to succeed into an unexplained failure — and are
 * reported back so the UI can say why the number is not zero.
 */
export async function purgeOwnedFiles(
  requester: Requester,
): Promise<PurgeResult> {
  const owner = scope(requester);

  const [purgeable, total] = await Promise.all([
    jobs.findPurgeableKeys(owner),
    jobs.countForOwner(owner),
  ]);

  const keys = purgeable
    .flatMap((row) => [row.inputKey, row.outputKey])
    .filter((key): key is string => Boolean(key));

  if (keys.length > 0) await storage().deleteMany(keys);
  if (purgeable.length > 0) {
    await jobs.removeMany(purgeable.map((row) => row.id));
  }

  logger.info('Purged stored files', {
    jobs: purgeable.length,
    files: keys.length,
  });

  return {
    jobs: purgeable.length,
    files: keys.length,
    skipped: Math.max(0, total - purgeable.length),
  };
}
