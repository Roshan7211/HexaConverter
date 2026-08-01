import 'server-only';

import * as queue from '@/database/repositories/job-queue.repository';
import { logger } from '@/lib/logger';
import { storage } from '@/services/storage';
import { purgeExpiredSessions } from '@/services/upload/session.service';

/**
 * Retention enforcement.
 *
 * This is what makes the deletion promises in the privacy policy true, so it
 * is a scheduled job rather than a best-effort cleanup on request paths.
 */

/** Job rows are removed once their files are long gone. */
const JOB_HISTORY_DAYS = 30;

export interface PurgeSummary {
  jobsExpired: number;
  objectsDeleted: number;
}

/**
 * Deletes stored files past their retention window and marks the owning jobs
 * expired. The rows themselves are cleared of file references here and removed
 * outright by the sweep below.
 */
export async function purgeExpiredFiles(
  batchSize = 500,
): Promise<PurgeSummary> {
  const expired = await queue.findExpired(batchSize);
  if (expired.length === 0) return { jobsExpired: 0, objectsDeleted: 0 };

  const keys = expired.flatMap((job) =>
    [job.inputKey, job.outputKey].filter((key): key is string => Boolean(key)),
  );

  await storage().deleteMany(keys);
  await queue.markExpired(expired.map((job) => job.id));

  logger.info('Purged expired conversion files', {
    jobs: expired.length,
    objects: keys.length,
  });

  return { jobsExpired: expired.length, objectsDeleted: keys.length };
}

export interface CleanupSummary extends PurgeSummary {
  /** Job rows removed once their files were long gone. */
  jobRowsRemoved: number;
  /** Chunked uploads abandoned before they were completed. */
  uploadSessionsPurged: number;
}

/** The full retention pass invoked by the cleanup cron. */
export async function runRetentionPass(
  batchSize = 1_000,
): Promise<CleanupSummary> {
  const purged = await purgeExpiredFiles(batchSize);

  const daysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const history = await queue.deleteHistoryBefore(daysAgo(JOB_HISTORY_DAYS));

  // Abandoned chunked uploads leave their pieces in storage; they are not
  // attached to any job, so only this sweep will ever reclaim them.
  const uploadSessions = await purgeExpiredSessions();

  const summary: CleanupSummary = {
    ...purged,
    jobRowsRemoved: history.count,
    uploadSessionsPurged: uploadSessions,
  };

  logger.info('Retention pass finished', { ...summary });
  return summary;
}
