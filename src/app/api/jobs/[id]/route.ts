import { errors, ok } from '@/api/responses';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { resolveRequester } from '@/services/auth/identity.service';
import { deleteOwnedJob, getOwnedJob } from '@/services/jobs/job.service';

/**
 * GET    /api/jobs/[id] — poll a single conversion.
 * DELETE /api/jobs/[id] — delete a conversion and its stored files.
 *
 * Both are scoped to the requester inside the service, so an id belonging to
 * someone else is indistinguishable from one that does not exist.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(
  'GET /api/jobs/[id]',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('read', request);
    if (limited) return limited;

    const { id } = await context.params;
    const job = await getOwnedJob(id, await resolveRequester());

    if (!job) return errors.notFound('Conversion not found.');
    return ok({ job });
  },
);

export const DELETE = withErrorHandling(
  'DELETE /api/jobs/[id]',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('job', request);
    if (limited) return limited;

    const { id } = await context.params;
    const result = await deleteOwnedJob(id, await resolveRequester());

    if (!result.ok) {
      return result.reason === 'not_found'
        ? errors.notFound('Conversion not found.')
        : errors.conflict(
            'This conversion is still running. Cancel it before deleting.',
          );
    }

    return ok({ deleted: true });
  },
);
