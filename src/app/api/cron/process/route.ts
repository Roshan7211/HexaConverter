import { errors, ok } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { serverEnv } from '@/lib/env';
import { processQueueBatch } from '@/services/jobs/queue.service';
import { constantTimeEqual } from '@/lib/security';

/**
 * POST /api/cron/process
 *
 * Drains a batch of queued conversions. Deployments that cannot keep a
 * background loop alive (serverless platforms) schedule this endpoint instead of
 * enabling the in-process worker — the same queue and the same code path.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_JOBS_PER_INVOCATION = 5;

function authorize(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(token) && constantTimeEqual(token, serverEnv().CRON_SECRET);
}

export const POST = withErrorHandling(
  'POST /api/cron/process',
  async (request) => {
    if (!authorize(request))
      return errors.unauthorized('Invalid cron credentials.');

    const processed = await processQueueBatch(MAX_JOBS_PER_INVOCATION);
    return ok({ processed });
  },
);

export const GET = POST;
