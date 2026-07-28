import 'server-only';

import * as audit from '@/database/repositories/audit.repository';
import * as authTokens from '@/database/repositories/auth-token.repository';
import * as notifications from '@/database/repositories/notification.repository';
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

/** Guest job rows are removed once their files are long gone. */
const GUEST_HISTORY_DAYS = 30;
const AUDIT_RETENTION_DAYS = 365;
const NOTIFICATION_RETENTION_DAYS = 90;

export interface PurgeSummary {
  jobsExpired: number;
  objectsDeleted: number;
}

/**
 * Deletes stored files past their retention window and marks the owning jobs
 * expired. Rows are kept without file references, so users keep their history.
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
  guestRowsRemoved: number;
  auditRowsRemoved: number;
  notificationsRemoved: number;
  /** Chunked uploads abandoned before they were completed. */
  uploadSessionsPurged: number;
  /** Spent and expired password-reset and verification links. */
  authTokensRemoved: number;
}

/** The full retention pass invoked by the cleanup cron. */
export async function runRetentionPass(
  batchSize = 1_000,
): Promise<CleanupSummary> {
  const purged = await purgeExpiredFiles(batchSize);

  const daysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const guestHistory = await queue.deleteGuestHistoryBefore(
    daysAgo(GUEST_HISTORY_DAYS),
  );
  const auditLogs = await audit.pruneOlderThan(daysAgo(AUDIT_RETENTION_DAYS));
  const staleNotifications = await notifications.pruneOlderThan(
    daysAgo(NOTIFICATION_RETENTION_DAYS),
  );

  // Abandoned chunked uploads leave their pieces in storage; they are not
  // attached to any job, so only this sweep will ever reclaim them.
  const uploadSessions = await purgeExpiredSessions();

  // Dead link secrets are of no use to us and of some use to an attacker who
  // gets a copy of the table, so they do not linger.
  const spentTokens = await authTokens.pruneExpired();

  const summary: CleanupSummary = {
    ...purged,
    uploadSessionsPurged: uploadSessions,
    guestRowsRemoved: guestHistory.count,
    auditRowsRemoved: auditLogs.count,
    notificationsRemoved: staleNotifications.count,
    authTokensRemoved: spentTokens.count,
  };

  logger.info('Retention pass finished', { ...summary });
  return summary;
}
