import { errors, ok } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { parseJsonBody } from '@/middleware/with-validation';
import { startSessionSchema } from '@/api/schemas';
import { resolveRequester } from '@/services/identity/identity.service';
import { startSession } from '@/services/upload/session.service';
import { describeScanning } from '@/services/upload/scanner.service';
import { UploadError } from '@/services/upload/upload.service';

/**
 * POST /api/uploads/sessions
 *
 * Opens a resumable chunked upload. Everything checkable without the bytes —
 * extension, plan ceiling, chunk count — is validated here, so an oversized
 * file is refused before a single byte crosses the wire.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'POST /api/uploads/sessions',
  async (request) => {
    const limited = enforceRateLimit('upload', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, startSessionSchema);
    if (!body.success) return body.response;

    const requester = await resolveRequester();

    try {
      const session = await startSession({
        filename: body.data.filename,
        declaredSize: body.data.size,
        maxBytes: requester.limits.maxFileBytes,
        owner: { guestId: requester.guestId },
      });

      return ok({ session, scanning: describeScanning() }, { status: 201 });
    } catch (error) {
      return toResponse(error);
    }
  },
);

function toResponse(error: unknown) {
  if (error instanceof UploadError) {
    return error.status === 413
      ? errors.payloadTooLarge(error.message)
      : error.status === 415
        ? errors.unsupportedMedia(error.message)
        : errors.badRequest(error.message);
  }
  throw error;
}
