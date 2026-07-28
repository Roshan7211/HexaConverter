import { errors, ok } from '@/api/responses';
import { changePasswordSchema, updateProfileSchema } from '@/api/schemas';
import { requireSession } from '@/middleware/require-session';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { clientIp, hashIp } from '@/lib/security';
import {
  changePassword,
  deleteAccount,
  updateProfile,
} from '@/services/account/account.service';

/**
 * PATCH  /api/account — update the display name or password.
 * DELETE /api/account — erase the account, its history and all stored files.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = withErrorHandling(
  'PATCH /api/account',
  async (request) => {
    const limited = enforceRateLimit('auth', request);
    if (limited) return limited;

    const auth = await requireSession();
    if (!auth.authenticated) return auth.response;

    const userId = auth.session.user.id;
    const ipHash = hashIp(clientIp(request.headers));

    // The body decides which operation this is; peek without consuming it.
    const raw = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    if ('newPassword' in raw) {
      const body = await parseJsonBody(request, changePasswordSchema);
      if (!body.success) return body.response;

      const result = await changePassword({ userId, ...body.data, ipHash });

      if (!result.ok) {
        return result.reason === 'no_password'
          ? errors.badRequest(
              'This account signs in with a connected provider, so it has no password to change.',
            )
          : errors.forbidden('The current password is incorrect.');
      }

      // The change moved the session watermark, so this session — and every
      // other — is now dead. The client is told so it can sign out cleanly
      // rather than discovering it on the next request.
      return ok({
        updated: true,
        signedOut: true,
        message:
          'Password changed. You have been signed out on all devices — sign in again with your new password.',
      });
    }

    const body = await parseJsonBody(request, updateProfileSchema);
    if (!body.success) return body.response;
    if (!body.data.name) return errors.badRequest('Nothing to update.');

    const updated = await updateProfile(userId, body.data.name);
    return ok({ updated: true, name: updated.name });
  },
);

export const DELETE = withErrorHandling(
  'DELETE /api/account',
  async (request) => {
    const limited = enforceRateLimit('auth', request);
    if (limited) return limited;

    const auth = await requireSession();
    if (!auth.authenticated) return auth.response;

    await deleteAccount(
      auth.session.user.id,
      hashIp(clientIp(request.headers)),
    );

    return ok({ deleted: true });
  },
);
