import { errors, ok } from '@/api/responses';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { resolveRequester } from '@/services/identity/identity.service';
import { cancelOwnedJob } from '@/services/jobs/job.service';

/**
 * POST /api/jobs/[id]/cancel
 *
 * Marks a queued or running conversion cancelled. A running job observes the
 * new status at its next progress checkpoint and aborts its encoder.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withErrorHandling(
  'POST /api/jobs/[id]/cancel',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('job', request);
    if (limited) return limited;

    const { id } = await context.params;
    const result = await cancelOwnedJob(id, await resolveRequester());

    if (!result.ok) {
      return result.reason === 'not_found'
        ? errors.notFound('Conversion not found.')
        : errors.conflict('This conversion has already finished.');
    }

    return ok({ job: result.job });
  },
);
