import { errors, ok } from '@/api/responses';
import { archiveTaskSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { resolveRequester } from '@/services/identity/identity.service';
import { createArchiveTask } from '@/services/archives/archive-task.service';

/**
 * POST /api/tools/archive
 *
 * Queues an archive-toolkit operation — extract, archive or password-protect —
 * over one or more previously uploaded files.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_FOR = {
  invalid_ticket: errors.forbidden,
  unsupported: errors.unprocessable,
  quota_exceeded: errors.forbidden,
  too_many_active: errors.conflict,
  upload_missing: errors.conflict,
} as const;

export const POST = withErrorHandling(
  'POST /api/tools/archive',
  async (request) => {
    const limited = enforceRateLimit('job', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, archiveTaskSchema);
    if (!body.success) return body.response;

    const { operation, tickets, ...params } = body.data;

    const result = await createArchiveTask({
      operation,
      tickets,
      params,
      requester: await resolveRequester(),
      headers: request.headers,
    });

    if (!result.ok) {
      return STATUS_FOR[result.failure.code](result.failure.message);
    }

    return ok({ job: result.job, usage: result.usage }, { status: 202 });
  },
);
