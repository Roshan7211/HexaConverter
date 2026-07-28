import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  JobStatus,
  type ArchiveOperation,
  type DocumentOperation,
} from '@prisma/client';

import * as queue from '@/database/repositories/job-queue.repository';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { runConversion } from '@/services/conversion/conversion.service';
import {
  notifyConversionCompleted,
  notifyConversionFailed,
} from '@/services/notifications/notification.service';
import { storage } from '@/services/storage';
import { ConversionError, type ConversionOptions } from '@/types/conversion';

/**
 * Job queue orchestration.
 *
 * Claiming, executing, retrying and lease recovery. The worker loop
 * (`worker.ts`) and the cron endpoint both drive this same code, so a
 * long-running instance and a serverless invocation behave identically.
 */

/** Identifies this process in the `lockedBy` column. */
export const WORKER_ID = `${process.pid}-${randomUUID().slice(0, 8)}`;

/** Attempts before a job is marked permanently failed. */
export const MAX_ATTEMPTS = 3;

/** A claimed job whose lease is older than this is considered abandoned. */
const LEASE_TIMEOUT_MS = 20 * 60 * 1000;

/** Minimum interval between progress writes for a single job. */
const PROGRESS_WRITE_MS = 1_200;

export interface ClaimedJob {
  id: string;
  inputKey: string;
  inputName: string;
  sourceFormat: string;
  targetFormat: string;
  options: ConversionOptions;
  attempts: number;
  /** Null for guest conversions, which have nowhere to deliver a notification. */
  userId: string | null;
  /** Set for document-toolkit jobs. */
  operation: DocumentOperation | null;
  /** Set for archive-toolkit jobs. */
  archiveOperation: ArchiveOperation | null;
  extraInputKeys: string[];
  extraInputNames: string[];
}

export async function claimNextJob(): Promise<ClaimedJob | null> {
  const row = await queue.claimNext(WORKER_ID);
  if (!row) return null;

  return { ...row, options: (row.options ?? {}) as ConversionOptions };
}

/** Returns abandoned leases to the queue, failing those out of attempts. */
export async function reclaimStaleJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - LEASE_TIMEOUT_MS);

  const [requeued, failed] = await Promise.all([
    queue.requeueStale(cutoff, MAX_ATTEMPTS),
    queue.failStale(cutoff, MAX_ATTEMPTS),
  ]);

  const total = requeued.count + failed.count;
  if (total > 0) {
    logger.warn('Reclaimed stale conversion jobs', {
      requeued: requeued.count,
      failed: failed.count,
    });
  }
  return total;
}

/** Runs one claimed job to completion. Never throws. */
export async function processJob(job: ClaimedJob): Promise<void> {
  const log = logger.child({ jobId: job.id, attempt: job.attempts });
  const controller = new AbortController();
  const startedAt = Date.now();

  let lastWrite = 0;
  let lastProgress = 0;

  const reportProgress = (percent: number) => {
    const rounded = Math.min(99, Math.max(0, Math.round(percent)));
    const now = Date.now();

    if (rounded <= lastProgress || now - lastWrite < PROGRESS_WRITE_MS) return;
    lastProgress = rounded;
    lastWrite = now;

    // Progress writes double as a cancellation check and a lease renewal.
    void queue
      .reportProgress(job.id, rounded)
      .then((updated) => {
        if (updated.status === JobStatus.CANCELLED) controller.abort();
      })
      .catch((error) => log.warn('Failed to persist job progress', { error }));
  };

  try {
    const result = await runConversion({
      inputKey: job.inputKey,
      inputName: job.inputName,
      sourceFormat: job.sourceFormat,
      targetFormat: job.targetFormat,
      options: job.options,
      onProgress: reportProgress,
      signal: controller.signal,
      operation: job.operation,
      archiveOperation: job.archiveOperation,
      extraInputs: job.extraInputKeys.map((key, index) => ({
        key,
        name: job.extraInputNames[index] ?? `file-${index + 2}.pdf`,
      })),
    });

    await queue.markCompleted(job.id, {
      outputKey: result.outputKey,
      outputName: result.outputName,
      outputSize: result.outputSize,
      outputMime: result.outputMime,
      detail: result.detail,
      durationMs: Date.now() - startedAt,
    });

    // Source files are no longer needed once the output exists.
    await Promise.all(
      [job.inputKey, ...job.extraInputKeys].map((key) =>
        storage()
          .delete(key)
          .catch((error) =>
            log.warn('Failed to delete source object', { error }),
          ),
      ),
    );

    if (job.userId) {
      await notifyConversionCompleted({
        userId: job.userId,
        jobId: job.id,
        inputName: job.inputName,
        targetFormat: job.targetFormat,
      });
    }

    log.info('Job completed', { durationMs: Date.now() - startedAt });
  } catch (error) {
    await handleFailure(job, error, controller.signal.aborted, startedAt);
  }
}

async function handleFailure(
  job: ClaimedJob,
  error: unknown,
  cancelled: boolean,
  startedAt: number,
) {
  const log = logger.child({ jobId: job.id });

  if (cancelled) {
    await queue.markCancelled(job.id);
    await Promise.all(
      [job.inputKey, ...job.extraInputKeys].map((key) =>
        storage()
          .delete(key)
          .catch(() => undefined),
      ),
    );
    return;
  }

  const userFacing =
    error instanceof ConversionError
      ? error.message
      : 'The conversion failed unexpectedly. Please try again or contact support.';

  const retryable = error instanceof ConversionError ? error.retryable : true;
  const canRetry = retryable && job.attempts < MAX_ATTEMPTS;

  log.error('Job failed', { error, retryable, canRetry });

  if (canRetry) {
    await queue.requeue(job.id, userFacing);
    return;
  }

  await queue.markFailed(job.id, userFacing, Date.now() - startedAt);
  await Promise.all(
    [job.inputKey, ...job.extraInputKeys].map((key) =>
      storage()
        .delete(key)
        .catch(() => undefined),
    ),
  );

  if (job.userId) {
    await notifyConversionFailed({
      userId: job.userId,
      jobId: job.id,
      inputName: job.inputName,
      reason: userFacing,
    });
  }
}

/**
 * Claims and processes up to `max` jobs at the configured concurrency.
 * Returns the number handled — used by the cron endpoint.
 */
export async function processQueueBatch(max = 5): Promise<number> {
  await reclaimStaleJobs();

  const concurrency = Math.min(serverEnv().WORKER_CONCURRENCY, max);
  let processed = 0;

  const runners = Array.from({ length: concurrency }, async () => {
    while (processed < max) {
      const job = await claimNextJob();
      if (!job) return;
      processed += 1;
      await processJob(job);
    }
  });

  await Promise.all(runners);
  return processed;
}
