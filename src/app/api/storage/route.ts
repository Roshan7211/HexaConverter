import { errors, ok } from '@/api/responses';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { resolveRequester } from '@/services/auth/identity.service';
import { purgeOwnedFiles } from '@/services/jobs/job.service';

/**
 * DELETE /api/storage
 *
 * Deletes every file the requester has stored — uploads and results alike —
 * without waiting for the retention sweep. Scoped to the requester, so it can
 * never reach anyone else's files.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withErrorHandling('DELETE /api/storage', async (request) => {
  const limited = enforceRateLimit('job', request);
  if (limited) return limited;

  const requester = await resolveRequester();
  if (!requester.userId && !requester.guestId) {
    return errors.forbidden('There are no files to delete.');
  }

  return ok(await purgeOwnedFiles(requester));
});
