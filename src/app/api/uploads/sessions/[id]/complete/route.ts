import { errors, ok } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { logger } from '@/lib/logger';
import { clientIp, hashIp, signUploadTicket } from '@/lib/security';
import { targetsFor } from '@/services/conversion/registry';
import { resolveRequester } from '@/services/auth/identity.service';
import { completeSession } from '@/services/upload/session.service';
import {
  InfectedUploadError,
  ScannerUnavailableError,
} from '@/services/upload/scanner.service';
import { UploadError } from '@/services/upload/upload.service';

/**
 * POST /api/uploads/sessions/[id]/complete
 *
 * Assembles the received chunks, verifies the finished file's magic bytes and
 * scans it, then issues the same signed ticket the single-shot upload returns —
 * so everything downstream is identical whichever path a file arrived by.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TICKET_TTL_MS = 60 * 60 * 1000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withErrorHandling(
  'POST /api/uploads/sessions/[id]/complete',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('upload', request);
    if (limited) return limited;

    const { id } = await context.params;
    const requester = await resolveRequester();

    try {
      const upload = await completeSession(id, {
        userId: requester.userId,
        guestId: requester.guestId,
      });

      const ticket = signUploadTicket({
        key: upload.key,
        name: upload.name,
        size: upload.size,
        mime: upload.mime,
        sourceFormat: upload.sourceFormat,
        owner: requester.ownerKey,
        expiresAt: Date.now() + TICKET_TTL_MS,
      });

      logger.info('Chunked upload accepted', {
        sourceFormat: upload.sourceFormat,
        size: upload.size,
        authenticated: requester.isAuthenticated,
        ipHash: hashIp(clientIp(request.headers)),
      });

      return ok(
        {
          ticket,
          file: {
            name: upload.name,
            size: upload.size,
            sourceFormat: upload.sourceFormat,
            category: upload.category,
          },
          scan: upload.scan,
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
  },
);
