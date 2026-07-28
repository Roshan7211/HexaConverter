import { errors, ok } from '@/api/responses';
import { statsQuerySchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { resolveRequester } from '@/services/auth/identity.service';
import { getDashboardStats } from '@/services/stats/stats.service';

/**
 * GET /api/stats
 *
 * Conversion statistics and storage accounting for the caller. Works for guests
 * too, scoped to their session cookie, so the figures always describe the
 * conversions the requester actually owns.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('GET /api/stats', async (request) => {
  const limited = enforceRateLimit('read', request);
  if (limited) return limited;

  const url = new URL(request.url);
  const query = statsQuerySchema.safeParse({
    days: url.searchParams.get('days') ?? undefined,
  });
  if (!query.success) return errors.unprocessable('Invalid range.');

  const requester = await resolveRequester();
  return ok(await getDashboardStats(requester, query.data.days));
});
