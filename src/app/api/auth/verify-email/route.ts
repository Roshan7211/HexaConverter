import { errors, ok } from '@/api/responses';
import { verifyEmailSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { clientIp, hashIp } from '@/lib/security';
import { verifyEmail } from '@/services/auth/email-verification.service';

/**
 * POST /api/auth/verify-email
 *
 * Confirms an address from an emailed link.
 *
 * Deliberately POST, not GET: verification links get followed by mail scanners
 * and link previewers, and a single-use token spent by a scanner would leave
 * the user holding a dead link. The page behind the link asks for a click.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'POST /api/auth/verify-email',
  async (request) => {
    const limited = enforceRateLimit('tokenRedemption', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, verifyEmailSchema);
    if (!body.success) return body.response;

    const result = await verifyEmail({
      token: body.data.token,
      ipHash: hashIp(clientIp(request.headers)),
    });

    if (!result.ok) return errors.badRequest(result.message);

    return ok({
      verified: true,
      email: result.email,
      message: result.alreadyVerified
        ? 'This address was already confirmed. You are all set.'
        : 'Your email address is confirmed.',
    });
  },
);
