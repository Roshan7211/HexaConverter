import {
  JobStatus,
  type DocumentOperation,
  type FileCategory,
} from '@prisma/client';

import type { JobRow } from '@/database/repositories/job.repository';
import { signDownloadToken } from '@/lib/security';
import type { Category } from '@/types/conversion';

/**
 * The wire representation of a conversion job.
 *
 * Mapping lives here rather than in the service so the HTTP contract can evolve
 * without touching business logic — and so `BigInt` columns and internal
 * storage keys never reach a response by accident.
 */

export interface JobDto {
  id: string;
  status: JobStatus;
  category: Category;
  sourceFormat: string;
  targetFormat: string;
  progress: number;
  error: string | null;
  inputName: string;
  inputSize: number;
  outputName: string | null;
  outputSize: number | null;
  durationMs: number | null;
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string;
  /** Set for toolkit jobs (merge, split, ...); null for format conversions. */
  operation: DocumentOperation | null;
  /** What the engine reported producing, e.g. `4 files extracted from RAR`. */
  detail: string | null;
  /** Present only while the output still exists; re-signed on every read. */
  downloadUrl: string | null;
}

/** Download links are valid for 15 minutes. */
const DOWNLOAD_TTL_SECONDS = 15 * 60;

const CATEGORY_TO_SLUG: Record<FileCategory, Category> = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video',
  ARCHIVE: 'archive',
};

export function toJobDto(job: JobRow): JobDto {
  const downloadable =
    job.status === JobStatus.COMPLETED &&
    Boolean(job.outputKey) &&
    job.expiresAt.getTime() > Date.now();

  return {
    id: job.id,
    status: job.status,
    category: CATEGORY_TO_SLUG[job.category],
    sourceFormat: job.sourceFormat,
    targetFormat: job.targetFormat,
    progress: job.progress,
    error: job.error,
    inputName: job.inputName,
    inputSize: Number(job.inputSize),
    outputName: job.outputName,
    outputSize: job.outputSize === null ? null : Number(job.outputSize),
    durationMs: job.durationMs,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    expiresAt: job.expiresAt.toISOString(),
    operation: job.operation,
    detail: job.outputDetail,
    downloadUrl: downloadable
      ? `/api/jobs/${job.id}/download?token=${encodeURIComponent(
          signDownloadToken({
            jobId: job.id,
            expiresAt: Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SECONDS,
          }),
        )}`
      : null,
  };
}
