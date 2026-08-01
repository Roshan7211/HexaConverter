import { errors, ok } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { resolveRequester } from '@/services/identity/identity.service';
import {
  cancelSession,
  getSessionState,
  storeChunk,
} from '@/services/upload/session.service';
import { UploadError } from '@/services/upload/upload.service';

/**
 * GET    /api/uploads/sessions/[id] — which chunks have arrived, for resuming.
 * PUT    /api/uploads/sessions/[id] — store one chunk (raw body, index in a header).
 * DELETE /api/uploads/sessions/[id] — cancel and discard the partial upload.
 *
 * Every route is scoped to the session's owner, so an id on its own is not
 * enough to read, extend or destroy someone else's transfer.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(
  'GET /api/uploads/sessions/[id]',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('read', request);
    if (limited) return limited;

    const { id } = await context.params;
    const requester = await resolveRequester();

    const session = await getSessionState(id, { guestId: requester.guestId });

    if (!session) return errors.notFound('That upload session has expired.');
    return ok({ session });
  },
);

export const PUT = withErrorHandling(
  'PUT /api/uploads/sessions/[id]',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('chunk', request);
    if (limited) return limited;

    const { id } = await context.params;
    const requester = await resolveRequester();

    // `Number(null)` is 0, so testing the converted value lets a request with
    // no header through as chunk 0 — which silently overwrites the first chunk
    // of the transfer. The raw header has to be checked before conversion.
    const rawIndex = request.headers.get('x-chunk-index');
    const index = Number(rawIndex);
    if (
      rawIndex === null ||
      rawIndex.trim() === '' ||
      !Number.isInteger(index)
    ) {
      return errors.badRequest('The x-chunk-index header is required.');
    }

    try {
      const session = await storeChunk(
        id,
        { guestId: requester.guestId },
        index,
        request.body,
      );
      return ok({ session });
    } catch (error) {
      if (error instanceof UploadError) {
        return error.status === 413
          ? errors.payloadTooLarge(error.message)
          : errors.badRequest(error.message);
      }
      throw error;
    }
  },
);

export const DELETE = withErrorHandling(
  'DELETE /api/uploads/sessions/[id]',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('upload', request);
    if (limited) return limited;

    const { id } = await context.params;
    const requester = await resolveRequester();

    const cancelled = await cancelSession(id, { guestId: requester.guestId });

    if (!cancelled) return errors.notFound('That upload session has expired.');
    return ok({ cancelled: true });
  },
);
