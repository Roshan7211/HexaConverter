import 'server-only';

import { DocumentOperation, type Prisma } from '@prisma/client';

import { toJobDto, type JobDto } from '@/api/dto/job.dto';
import * as jobs from '@/database/repositories/job.repository';
import { logger } from '@/lib/logger';
import { clientIp, hashIp, verifyUploadTicket } from '@/lib/security';
import {
  checkConcurrency,
  checkQuota,
  retentionDate,
  type Requester,
} from '@/services/auth/identity.service';
import { ensureWorker } from '@/services/jobs/worker';
import { toPrismaCategory } from '@/services/jobs/job.service';
import { storage } from '@/services/storage';
import { PDF_OPERATION_SPECS, type PdfOperation } from '@/types/documents';

/**
 * Queueing a document-toolkit task.
 *
 * Mirrors `job-creation.service` for format conversions: every precondition is
 * checked here, in a fixed order, so the same rules hold no matter which
 * surface submits the work.
 */

export type TaskFailure =
  | { code: 'invalid_ticket'; message: string }
  | { code: 'unsupported'; message: string }
  | { code: 'quota_exceeded'; message: string }
  | { code: 'too_many_active'; message: string }
  | { code: 'upload_missing'; message: string };

export type CreateTaskResult =
  | { ok: true; job: JobDto; usage: { used: number; limit: number } }
  | { ok: false; failure: TaskFailure };

export interface CreateTaskInput {
  operation: PdfOperation;
  tickets: string[];
  params: {
    pages?: string;
    angle?: 90 | 180 | 270;
    splitMode?: 'pages' | 'ranges';
    compression?: 'light' | 'balanced' | 'strong';
  };
  requester: Requester;
  headers: Headers;
}

export async function createDocumentTask(
  input: CreateTaskInput,
): Promise<CreateTaskResult> {
  const spec = PDF_OPERATION_SPECS[input.operation];
  const { requester } = input;

  // 1. Every ticket must be authentic, owned by this requester, and a PDF.
  const resolved = input.tickets.map((ticket) =>
    verifyUploadTicket(ticket, requester.ownerKey),
  );

  if (resolved.some((ticket) => ticket === null)) {
    return {
      ok: false,
      failure: {
        code: 'invalid_ticket',
        message:
          'One of those uploads is no longer valid. Upload the files again to continue.',
      },
    };
  }

  const files = resolved as NonNullable<(typeof resolved)[number]>[];

  if (files.some((file) => file.sourceFormat !== 'pdf')) {
    return {
      ok: false,
      failure: {
        code: 'unsupported',
        message: `${spec.label} works on PDF files only.`,
      },
    };
  }

  // 2. File-count bounds for this operation.
  if (files.length < spec.minFiles || files.length > spec.maxFiles) {
    return {
      ok: false,
      failure: {
        code: 'unsupported',
        message:
          spec.minFiles === spec.maxFiles
            ? `${spec.label} takes exactly ${spec.minFiles} file.`
            : `${spec.label} takes between ${spec.minFiles} and ${spec.maxFiles} files.`,
      },
    };
  }

  // 3. Plan limits.
  const quota = await checkQuota(requester);
  if (!quota.allowed) {
    return {
      ok: false,
      failure: { code: 'quota_exceeded', message: quota.reason! },
    };
  }

  const concurrency = await checkConcurrency(requester);
  if (!concurrency.allowed) {
    return {
      ok: false,
      failure: { code: 'too_many_active', message: concurrency.reason! },
    };
  }

  // 4. Every referenced object must still exist.
  const store = storage();
  const present = await Promise.all(
    files.map((file) => store.exists(file.key)),
  );
  if (present.some((exists) => !exists)) {
    return {
      ok: false,
      failure: {
        code: 'upload_missing',
        message:
          'Those uploads are no longer available. Upload them again to continue.',
      },
    };
  }

  const [primary, ...extra] = files;

  const row = await jobs.create({
    owner: { userId: requester.userId, guestId: requester.guestId },
    category: toPrismaCategory('document'),
    sourceFormat: 'pdf',
    // Split may emit a ZIP; the worker records the real output type when it
    // finishes, so this is the nominal target only.
    targetFormat: 'pdf',
    options: input.params as Prisma.InputJsonObject,
    inputKey: primary!.key,
    inputName: primary!.name,
    inputSize: primary!.size,
    inputMime: primary!.mime,
    expiresAt: retentionDate(requester),
    ipHash: hashIp(clientIp(input.headers)),
    operation: DocumentOperation[input.operation],
    extraInputKeys: extra.map((file) => file.key),
    extraInputNames: extra.map((file) => file.name),
  });

  ensureWorker();

  logger.info('Document task queued', {
    jobId: row.id,
    operation: input.operation,
    files: files.length,
  });

  return {
    ok: true,
    job: toJobDto(row),
    usage: { used: quota.used + 1, limit: quota.limit },
  };
}
