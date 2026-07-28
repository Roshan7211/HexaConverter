import { ok } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { checkQuota, resolveRequester } from '@/services/auth/identity.service';

/**
 * GET /api/limits
 *
 * The effective limits and remaining allowance for the caller. Kept separate
 * from page rendering so converter pages can be statically generated and still
 * show accurate, per-plan numbers once hydrated.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('GET /api/limits', async (request) => {
  const limited = enforceRateLimit('read', request);
  if (limited) return limited;

  const requester = await resolveRequester();
  const quota = await checkQuota(requester);

  return ok({
    plan: requester.limits.label,
    authenticated: requester.isAuthenticated,
    maxFileBytes: requester.limits.maxFileBytes,
    maxBatchFiles: requester.limits.maxBatchFiles,
    retentionHours: requester.limits.retentionHours,
    concurrentJobs: requester.limits.concurrentJobs,
    usage: { used: quota.used, limit: quota.limit },
  });
});
