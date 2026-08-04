import 'server-only';

import { ArchiveOperation as PrismaArchiveOperation } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { toJobDto, type JobDto } from '@/api/dto/job.dto';
import * as jobs from '@/database/repositories/job.repository';
import { logger } from '@/lib/logger';
import { clientIp, hashIp, verifyUploadTicket } from '@/lib/security';
import {
  checkConcurrency,
  checkQuota,
  ownerScope,
  retentionDate,
  type Requester,
} from '@/services/identity/identity.service';
import { getFormat } from '@/services/conversion/registry';
import { ensureWorker } from '@/services/jobs/worker';
import { toPrismaCategory } from '@/services/jobs/job.service';
import { storage } from '@/services/storage';
import {
  ARCHIVE_OPERATION_SPECS,
  type ArchiveOperation,
  type ArchiveTarget,
} from '@/types/archives';

/**
 * Queueing an archive-toolkit task.
 *
 * Mirrors `document-task.service` for the PDF toolkit: the same preconditions
 * in the same order, so a task submitted here obeys the rules a conversion
 * does — ownership, quota, concurrency and object existence.
 */

export type ArchiveTaskFailure =
  | { code: 'invalid_ticket'; message: string }
  | { code: 'unsupported'; message: string }
  | { code: 'quota_exceeded'; message: string }
  | { code: 'too_many_active'; message: string }
  | { code: 'upload_missing'; message: string };

export type CreateArchiveTaskResult =
  | { ok: true; job: JobDto; usage: { used: number; limit: number } }
  | { ok: false; failure: ArchiveTaskFailure };

export interface CreateArchiveTaskInput {
  operation: ArchiveOperation;
  tickets: string[];
  params: {
    target?: ArchiveTarget;
    compressionLevel?: number;
    password?: string;
    encryption?: 'aes256' | 'zipcrypto';
  };
  requester: Requester;
  headers: Headers;
}

export async function createArchiveTask(
  input: CreateArchiveTaskInput,
): Promise<CreateArchiveTaskResult> {
  const spec = ARCHIVE_OPERATION_SPECS[input.operation];
  const { requester } = input;

  // 1. Every ticket must be authentic and owned by this requester.
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

  // 3. Extraction needs something it can actually open.
  if (input.operation === 'EXTRACT') {
    const source = getFormat(files[0]!.sourceFormat);
    if (source?.category !== 'archive') {
      return {
        ok: false,
        failure: {
          code: 'unsupported',
          message:
            'That is not an archive. Upload a ZIP, RAR, 7Z, TAR, TAR.GZ or GZIP file.',
        },
      };
    }
  }

  // 4. GZIP holds exactly one file, so reject the impossible combination here
  // rather than after the upload has been processed.
  if (
    input.operation === 'ARCHIVE' &&
    input.params.target === 'gz' &&
    files.length > 1
  ) {
    return {
      ok: false,
      failure: {
        code: 'unsupported',
        message: `GZIP holds a single file, but you selected ${files.length}. Choose TAR.GZ, ZIP or 7Z instead.`,
      },
    };
  }

  if (
    spec.usesPassword &&
    input.operation === 'PROTECT' &&
    !input.params.password
  ) {
    return {
      ok: false,
      failure: {
        code: 'unsupported',
        message: 'Enter the password the archive should be locked with.',
      },
    };
  }

  // 5. Plan limits.
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

  // 6. Every referenced object must still exist.
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
    owner: ownerScope(requester),
    category: toPrismaCategory('archive'),
    sourceFormat: primary!.sourceFormat,
    // Extraction may deliver a single file under its own type; the worker
    // records the real output when it finishes, so this is nominal only.
    targetFormat: targetFormatFor(input),
    options: input.params as Prisma.InputJsonObject,
    inputKey: primary!.key,
    inputName: primary!.name,
    inputSize: primary!.size,
    inputMime: primary!.mime,
    expiresAt: retentionDate(requester),
    ipHash: hashIp(clientIp(input.headers)),
    archiveOperation: PrismaArchiveOperation[input.operation],
    extraInputKeys: extra.map((file) => file.key),
    extraInputNames: extra.map((file) => file.name),
  });

  ensureWorker();

  logger.info('Archive task queued', {
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

function targetFormatFor(input: CreateArchiveTaskInput): string {
  if (input.operation === 'ARCHIVE') return input.params.target ?? 'zip';
  return 'zip';
}
