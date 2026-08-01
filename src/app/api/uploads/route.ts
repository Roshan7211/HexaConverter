import { errors, ok } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { targetsFor } from '@/services/conversion/registry';
import { resolveRequester } from '@/services/identity/identity.service';
import { logger } from '@/lib/logger';
import { clientIp, hashIp, signUploadTicket } from '@/lib/security';
import {
  InfectedUploadError,
  ScannerUnavailableError,
  assertClean,
} from '@/services/upload/scanner.service';
import { storage } from '@/services/storage';
import {
  UploadError,
  decodeFilenameHeader,
  receiveUpload,
} from '@/services/upload/upload.service';

/**
 * POST /api/uploads
 *
 * Accepts a single file as a raw request body — not multipart — so the payload
 * can be streamed to storage without buffering. The filename travels in the
 * `x-file-name` header, URL-encoded.
 *
 * Responds with a signed ticket that the job endpoint requires: the client
 * never gets to name a storage key or restate a file's size or format.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Tickets are short-lived; the target format is normally chosen immediately. */
const TICKET_TTL_MS = 60 * 60 * 1000;

export const POST = withErrorHandling('POST /api/uploads', async (request) => {
  const limited = enforceRateLimit('upload', request);
  if (limited) return limited;

  const requester = await resolveRequester();

  const filename = decodeFilenameHeader(request.headers.get('x-file-name'));
  if (!filename) {
    return errors.badRequest('The x-file-name header is required.');
  }

  const declaredSize = Number(request.headers.get('content-length') ?? '0');
  if (declaredSize > requester.limits.maxFileBytes) {
    return errors.payloadTooLarge(
      `Uploads are limited to ${formatMb(requester.limits.maxFileBytes)} per file.`,
    );
  }

  try {
    const upload = await receiveUpload(request.body, {
      maxBytes: requester.limits.maxFileBytes,
      filename,
    });

    // Scanned before a ticket exists, so an infected file is never convertible
    // even for the moment it sits in storage.
    let scan: string;
    try {
      const verdict = await assertClean(() => storage().getStream(upload.key), {
        name: upload.name,
      });
      scan =
        verdict.status === 'skipped'
          ? `Not scanned: ${verdict.reason}`
          : 'Scanned and clean';
    } catch (error) {
      await storage()
        .delete(upload.key)
        .catch(() => undefined);
      throw error;
    }

    const ticket = signUploadTicket({
      key: upload.key,
      name: upload.name,
      size: upload.size,
      mime: upload.mime,
      sourceFormat: upload.sourceFormat,
      owner: requester.ownerKey,
      expiresAt: Date.now() + TICKET_TTL_MS,
    });

    logger.info('Upload accepted', {
      sourceFormat: upload.sourceFormat,
      size: upload.size,
      ipHash: hashIp(clientIp(request.headers)),
    });

    return ok(
      {
        ticket,
        scan,
        file: {
          name: upload.name,
          size: upload.size,
          sourceFormat: upload.sourceFormat,
          category: upload.category,
        },
        targets: targetsFor(upload.sourceFormat).map((format) => ({
          id: format.id,
          label: format.label,
          category: format.category,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof InfectedUploadError) {
      return errors.unsupportedMedia(error.message);
    }
    if (error instanceof ScannerUnavailableError) {
      return errors.unavailable(error.message);
    }
    if (error instanceof UploadError) {
      return error.status === 413
        ? errors.payloadTooLarge(error.message)
        : error.status === 415
          ? errors.unsupportedMedia(error.message)
          : errors.badRequest(error.message);
    }
    throw error;
  }
});

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${Math.round(mb)} MB`;
}
