import { errors, ok } from '@/api/responses';
import { resetPasswordSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { clientIp, hashIp } from '@/lib/security';
import { resetPassword } from '@/services/auth/password-reset.service';

/**
 * POST /api/auth/reset-password
 *
 * Redeems a reset link and sets a new password. Success signs the account out
 * everywhere, so a recovery after a compromise evicts whoever else was signed
 * in; the client is told to sign in again with the new password.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'POST /api/auth/reset-password',
  async (request) => {
    const limited = enforceRateLimit('tokenRedemption', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, resetPasswordSchema);
    if (!body.success) return body.response;

    const result = await resetPassword({
      token: body.data.token,
      newPassword: body.data.password,
      ipHash: hashIp(clientIp(request.headers)),
    });

    if (!result.ok) return errors.badRequest(result.message);

    return ok({
      reset: true,
      email: result.email,
      message:
        'Your password has been changed and every device has been signed out. Sign in with your new password.',
    });
  },
);
