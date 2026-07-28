import 'server-only';

import { JobStatus, type FileCategory } from '@prisma/client';

import { serverEnv } from '@/lib/env';
import * as stats from '@/database/repositories/stats.repository';
import type { Requester } from '@/services/auth/identity.service';
import { ownerScope } from '@/services/auth/identity.service';
import { CATEGORY_META } from '@/services/conversion/registry';
import type { Category } from '@/types/conversion';
import type { DashboardStats, StatsSummary } from '@/types/stats';

/**
 * Statistics and storage accounting for the dashboard.
 *
 * Every figure is computed from the job table rather than a counter that could
 * drift, so the dashboard and the enforcement path can never disagree.
 */

const CATEGORY_SLUG: Record<FileCategory, Category> = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video',
  ARCHIVE: 'archive',
};

export async function getDashboardStats(
  requester: Requester,
  days = 30,
): Promise<DashboardStats> {
  const owner = ownerScope(requester);

  const [daily, byCategory, byStatus, totals, live, expiring] =
    await Promise.all([
      stats.dailyCounts(owner, days),
      stats.countsByCategory(owner),
      stats.countsByStatus(owner),
      stats.durationAndBytes(owner),
      stats.liveStorage(owner),
      stats.expiringSoon(owner, 24),
    ]);

  const statusCount = (status: JobStatus) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  const completed = statusCount(JobStatus.COMPLETED);
  const failed = statusCount(JobStatus.FAILED);
  const active =
    statusCount(JobStatus.QUEUED) + statusCount(JobStatus.PROCESSING);
  const settled = completed + failed;

  const bytesIn = Number(totals._sum.inputSize ?? 0);
  const bytesOut = Number(totals._sum.outputSize ?? 0);

  const summary: StatsSummary = {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    completed,
    failed,
    active,
    successRate: settled > 0 ? Math.round((completed / settled) * 100) : null,
    avgDurationMs: totals._avg.durationMs ?? null,
    bytesIn,
    bytesOut,
    bytesSavedPercent:
      bytesIn > 0 ? Math.round(((bytesIn - bytesOut) / bytesIn) * 100) : null,
  };

  const usedBytes = Number(live._sum.outputSize ?? 0);

  // There is no separate storage plan: the practical ceiling is one full batch
  // at the plan's per-file limit, held for the plan's retention window.
  const quotaBytes =
    requester.limits.maxFileBytes * requester.limits.maxBatchFiles;

  return {
    summary,
    daily: daily.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      completed: Number(row.completed),
      failed: Number(row.failed),
    })),
    byCategory: byCategory.map((row) => ({
      category: CATEGORY_SLUG[row.category],
      label: CATEGORY_META[CATEGORY_SLUG[row.category]].label,
      count: row._count._all,
    })),
    storage: {
      usedBytes,
      fileCount: live._count._all,
      quotaBytes,
      percentUsed:
        quotaBytes > 0
          ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100))
          : 0,
      retentionHours: Math.min(
        requester.limits.retentionHours,
        serverEnv().FILE_RETENTION_HOURS,
      ),
      expiring: expiring.map((file) => ({
        id: file.id,
        name: file.outputName ?? 'Converted file',
        sizeBytes: Number(file.outputSize ?? 0),
        expiresAt: file.expiresAt.toISOString(),
      })),
    },
  };
}
