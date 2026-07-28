import { errors, ok } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { serverEnv } from '@/lib/env';
import { constantTimeEqual } from '@/lib/security';
import { runRetentionPass } from '@/services/jobs/retention.service';

/**
 * POST /api/cron/cleanup
 *
 * Retention job: deletes expired files, prunes stale guest history and trims
 * the audit log. This is what makes the deletion promises in the privacy policy
 * true, so it must be scheduled — the app never relies on request traffic to
 * clean up.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(token) && constantTimeEqual(token, serverEnv().CRON_SECRET);
}

export const POST = withErrorHandling(
  'POST /api/cron/cleanup',
  async (request) => {
    if (!authorized(request)) {
      return errors.unauthorized('Invalid cron credentials.');
    }

    return ok(await runRetentionPass(1_000));
  },
);

/** Some schedulers only issue GET requests. */
export const GET = POST;
