import { ok } from '@/api/responses';
import { requireSession } from '@/middleware/require-session';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { clientIp, hashIp } from '@/lib/security';
import {
  SESSION_REVALIDATE_MS,
  signOutEverywhere,
} from '@/services/auth/session.service';

/**
 * DELETE /api/account/sessions — sign out on every device.
 *
 * Under `/api/account` rather than `/api/auth` so the middleware's same-origin
 * check applies: this acts on the caller's ambient session cookie, which is
 * exactly the shape a cross-site request would try to abuse.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withErrorHandling(
  'DELETE /api/account/sessions',
  async (request) => {
    const limited = enforceRateLimit('auth', request);
    if (limited) return limited;

    const auth = await requireSession();
    if (!auth.authenticated) return auth.response;

    await signOutEverywhere(
      auth.session.user.id,
      hashIp(clientIp(request.headers)),
    );

    return ok({
      revoked: true,
      // Other devices hold a token that is still cryptographically valid until
      // they next re-check, so the honest answer includes the delay.
      propagationSeconds: Math.ceil(SESSION_REVALIDATE_MS / 1000),
      message:
        'Signed out on all devices. Other devices lose access within a minute.',
    });
  },
);
