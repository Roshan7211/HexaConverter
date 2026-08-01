import 'server-only';

import type { Prisma } from '@prisma/client';

import { toJobDto, type JobDto } from '@/api/dto/job.dto';
import * as jobs from '@/database/repositories/job.repository';
import { logger } from '@/lib/logger';
import { clientIp, hashIp, verifyUploadTicket } from '@/lib/security';
import {
  checkConcurrency,
  checkQuota,
  retentionDate,
  type Requester,
} from '@/services/identity/identity.service';
import { routeAvailability } from '@/services/conversion/conversion.service';
import { defaultOptionsFor, parseOptions } from '@/services/conversion/options';
import {
  findRoute,
  getFormat,
  resolveFormatId,
} from '@/services/conversion/registry';
import { toPrismaCategory } from '@/services/jobs/job.service';
import { ensureWorker } from '@/services/jobs/worker';
import { storage } from '@/services/storage';

/**
 * Queueing a conversion.
 *
 * Every precondition is checked here in a fixed order — ticket authenticity,
 * route support, tooling availability, option validity, quota, concurrency,
 * then object existence — so the same rules apply no matter which entry point
 * (web UI today, public API later) creates the job.
 */

export type CreateJobFailure =
  | { code: 'invalid_ticket'; message: string }
  | { code: 'unsupported'; message: string }
  | { code: 'unavailable'; message: string }
  | { code: 'invalid_options'; message: string }
  | { code: 'quota_exceeded'; message: string }
  | { code: 'too_many_active'; message: string }
  | { code: 'upload_missing'; message: string };

export type CreateJobResult =
  | { ok: true; job: JobDto; usage: { used: number; limit: number } }
  | { ok: false; failure: CreateJobFailure };

export interface CreateJobInput {
  ticket: string;
  /** Further uploads to fold into one output, in page order. */
  extraTickets?: string[];
  targetFormat: string;
  options?: Record<string, unknown>;
  requester: Requester;
  headers: Headers;
}

/**
 * Whether a route may fold several uploads into one output.
 *
 * Only images to PDF qualifies: a page per image is a meaningful combination,
 * whereas concatenating two MP4s or two spreadsheets is a different operation
 * with its own semantics, not a conversion. Anything else is refused rather
 * than quietly dropping the extra files.
 */
function acceptsMultipleInputs(
  sourceCategory: string,
  targetFormat: string,
): boolean {
  return sourceCategory === 'image' && targetFormat === 'pdf';
}

export async function createConversionJob(
  input: CreateJobInput,
): Promise<CreateJobResult> {
  const { requester } = input;

  // 1. The ticket is the only trusted description of the upload.
  const ticket = verifyUploadTicket(input.ticket, requester.ownerKey);
  if (!ticket) {
    return {
      ok: false,
      failure: {
        code: 'invalid_ticket',
        message:
          'This upload is no longer valid. Upload the file again to continue.',
      },
    };
  }

  // 2. The requested route must exist and be writable.
  const targetFormat = resolveFormatId(input.targetFormat);
  const target = targetFormat ? getFormat(targetFormat) : null;

  if (!targetFormat || !target || !target.canOutput) {
    return {
      ok: false,
      failure: {
        code: 'unsupported',
        message: `${input.targetFormat.toUpperCase()} is not a supported output format.`,
      },
    };
  }

  const route = findRoute(ticket.sourceFormat, targetFormat);
  if (!route) {
    return {
      ok: false,
      failure: {
        code: 'unsupported',
        message: `Converting ${ticket.sourceFormat.toUpperCase()} to ${target.label} is not supported.`,
      },
    };
  }

  // 3. External tooling must be present on this deployment.
  const availability = await routeAvailability(
    ticket.sourceFormat,
    targetFormat,
  );
  if (!availability.available) {
    return {
      ok: false,
      failure: { code: 'unavailable', message: availability.reason! },
    };
  }

  // 4. Options are validated against the engine that will run.
  const options = parseOptions(ticket.sourceFormat, targetFormat, {
    ...defaultOptionsFor(ticket.sourceFormat, targetFormat),
    ...(input.options ?? {}),
  });
  if (!options.success) {
    return {
      ok: false,
      failure: { code: 'invalid_options', message: options.message },
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

  const sourceSpec = getFormat(ticket.sourceFormat)!;

  // 6. Extra inputs, when the route combines them.
  const extraTickets = input.extraTickets ?? [];
  const extras: Array<{ key: string; name: string }> = [];

  if (extraTickets.length > 0) {
    if (!acceptsMultipleInputs(sourceSpec.category, targetFormat)) {
      return {
        ok: false,
        failure: {
          code: 'unsupported',
          message: `Several files can only be combined when converting images to PDF, not ${sourceSpec.label} to ${target.label}.`,
        },
      };
    }

    if (extraTickets.length + 1 > requester.limits.maxBatchFiles) {
      return {
        ok: false,
        failure: {
          code: 'unsupported',
          message: `A single PDF can combine at most ${requester.limits.maxBatchFiles} images.`,
        },
      };
    }

    for (const raw of extraTickets) {
      // Verified against this requester's owner key, so one visitor cannot
      // fold another's upload into their own PDF.
      const extra = verifyUploadTicket(raw, requester.ownerKey);
      if (!extra) {
        return {
          ok: false,
          failure: {
            code: 'invalid_ticket',
            message:
              'One of the uploads is no longer valid. Upload the files again to continue.',
          },
        };
      }

      // Mixing formats would mean mixing routes, and the job records one pair.
      // Convert to a common format first if you need that.
      if (extra.sourceFormat !== ticket.sourceFormat) {
        return {
          ok: false,
          failure: {
            code: 'unsupported',
            message:
              'Every image in a combined PDF must be the same format. Convert them separately, or upload matching files.',
          },
        };
      }

      extras.push({ key: extra.key, name: extra.name });
    }
  }

  // 7. A retried request could reference an object that has since been purged.
  for (const key of [ticket.key, ...extras.map((extra) => extra.key)]) {
    if (!(await storage().exists(key))) {
      return {
        ok: false,
        failure: {
          code: 'upload_missing',
          message:
            'The uploaded file is no longer available. Upload it again to continue.',
        },
      };
    }
  }

  const row = await jobs.create({
    owner: { guestId: requester.guestId },
    category: toPrismaCategory(sourceSpec.category),
    sourceFormat: ticket.sourceFormat,
    targetFormat,
    options: options.data as Prisma.InputJsonObject,
    inputKey: ticket.key,
    inputName: ticket.name,
    inputSize: ticket.size,
    inputMime: ticket.mime,
    extraInputKeys: extras.map((extra) => extra.key),
    extraInputNames: extras.map((extra) => extra.name),
    expiresAt: retentionDate(requester),
    ipHash: hashIp(clientIp(input.headers)),
  });

  // Start the in-process worker on first use; a no-op if already running.
  ensureWorker();

  logger.info('Conversion queued', {
    jobId: row.id,
    from: ticket.sourceFormat,
    to: targetFormat,
    engine: route.engine,
  });

  return {
    ok: true,
    job: toJobDto(row),
    usage: { used: quota.used + 1, limit: quota.limit },
  };
}
