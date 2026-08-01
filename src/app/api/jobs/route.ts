import { errors, ok } from '@/api/responses';
import { createJobSchema, jobListQuerySchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { resolveRequester } from '@/services/identity/identity.service';
import { createConversionJob } from '@/services/jobs/job-creation.service';
import { listJobs } from '@/services/jobs/job.service';

/**
 * POST /api/jobs — queue a conversion for a previously uploaded file.
 * GET  /api/jobs — list the requester's conversions.
 *
 * These handlers are deliberately thin: they translate HTTP to a service call
 * and a service result back to a status code. All conversion rules live in
 * `job-creation.service`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Maps a domain failure onto the HTTP status that describes it. */
const STATUS_FOR = {
  invalid_ticket: errors.forbidden,
  unsupported: errors.unprocessable,
  unavailable: errors.unavailable,
  invalid_options: errors.unprocessable,
  quota_exceeded: errors.forbidden,
  too_many_active: errors.conflict,
  upload_missing: errors.conflict,
} as const;

export const POST = withErrorHandling('POST /api/jobs', async (request) => {
  const limited = enforceRateLimit('job', request);
  if (limited) return limited;

  const body = await parseJsonBody(request, createJobSchema);
  if (!body.success) return body.response;

  const result = await createConversionJob({
    ticket: body.data.ticket,
    extraTickets: body.data.extraTickets,
    targetFormat: body.data.targetFormat,
    options: body.data.options,
    requester: await resolveRequester(),
    headers: request.headers,
  });

  if (!result.ok) {
    return STATUS_FOR[result.failure.code](result.failure.message);
  }

  return ok({ job: result.job, usage: result.usage }, { status: 202 });
});

export const GET = withErrorHandling('GET /api/jobs', async (request) => {
  const limited = enforceRateLimit('read', request);
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = jobListQuerySchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) return errors.unprocessable('Invalid query parameters.');

  return ok(
    await listJobs({ requester: await resolveRequester(), ...parsed.data }),
  );
});
