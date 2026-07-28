import { errors, ok } from '@/api/responses';
import { pdfTaskSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { resolveRequester } from '@/services/auth/identity.service';
import { createDocumentTask } from '@/services/documents/document-task.service';

/**
 * POST /api/tools/pdf
 *
 * Queues a document-toolkit operation — merge, split, extract, rotate or
 * compress — over one or more previously uploaded PDFs.
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
  'POST /api/tools/pdf',
  async (request) => {
    const limited = enforceRateLimit('job', request);
    if (limited) return limited;

    const body = await parseJsonBody(request, pdfTaskSchema);
    if (!body.success) return body.response;

    const { operation, tickets, ...params } = body.data;

    const result = await createDocumentTask({
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
