import { ok } from '@/api/responses';
import { resendVerificationSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { clientIp, hashIp } from '@/lib/security';
import {
  resendVerification,
  VERIFICATION_SENT_MESSAGE,
} from '@/services/auth/email-verification.service';

/**
 * POST /api/auth/resend-verification
 *
 * Sends a fresh confirmation link. Unauthenticated on purpose — a deployment
 * that requires verification will not let an unverified user sign in, so
 * requiring a session here would be a dead end. The reply is constant for the
 * same anti-enumeration reason as the reset endpoint.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'POST /api/auth/resend-verification',
  async (request) => {
    const limited = enforceRateLimit('emailVerification', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, resendVerificationSchema);
    if (!body.success) return body.response;

    const perAddress = enforceRateLimit(
      'emailVerification',
      request,
      `email:${hashIp(body.data.email)}`,
    );
    if (perAddress) return perAddress;

    await resendVerification({
      email: body.data.email,
      ipHash: hashIp(clientIp(request.headers)),
    });

    return ok({ sent: true, message: VERIFICATION_SENT_MESSAGE });
  },
);
