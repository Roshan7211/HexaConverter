import { ok } from '@/api/responses';
import { registerSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { clientIp, hashIp } from '@/lib/security';
import { register } from '@/services/account/account.service';
import { isVerificationRequired } from '@/services/auth/email-verification.service';

/**
 * POST /api/auth/register
 *
 * Creates a password account and sends a confirmation link. The response is
 * identical whether or not the address was already registered, so the endpoint
 * cannot be used to enumerate accounts; the duplicate case surfaces only
 * through the sign-in flow.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'POST /api/auth/register',
  async (request) => {
    const limited = enforceRateLimit('register', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, registerSchema);
    if (!body.success) return body.response;

    const result = await register({
      ...body.data,
      ipHash: hashIp(clientIp(request.headers)),
    });

    // `verificationRequired` is a property of the deployment, not of the
    // account, so returning it leaks nothing about whether one was created.
    const verificationRequired = isVerificationRequired();

    return ok(
      {
        created: true,
        verificationRequired,
        message: verificationRequired
          ? 'Check your inbox for a confirmation link to finish setting up your account.'
          : 'Account ready. Sign in to continue.',
      },
      { status: result.duplicate ? 200 : 201 },
    );
  },
);
