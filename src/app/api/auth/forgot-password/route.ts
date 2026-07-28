import { ok } from '@/api/responses';
import { forgotPasswordSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { clientIp, hashIp } from '@/lib/security';
import {
  requestPasswordReset,
  RESET_REQUEST_MESSAGE,
} from '@/services/auth/password-reset.service';

/**
 * POST /api/auth/forgot-password
 *
 * Starts password recovery. The reply never varies: unknown address, provider-
 * only account and successful send all return the same message, so the endpoint
 * cannot be used to test whether an address is registered.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'POST /api/auth/forgot-password',
  async (request) => {
    const limited = enforceRateLimit('passwordReset', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, forgotPasswordSchema);
    if (!body.success) return body.response;

    // A second limit keyed by the target address, so rotating source IPs
    // cannot be used to bury one person's inbox in reset mail.
    const perAddress = enforceRateLimit(
      'passwordReset',
      request,
      `email:${hashIp(body.data.email)}`,
    );
    if (perAddress) return perAddress;

    await requestPasswordReset({
      email: body.data.email,
      ipHash: hashIp(clientIp(request.headers)),
    });

    return ok({ sent: true, message: RESET_REQUEST_MESSAGE });
  },
);
