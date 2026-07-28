import { ok } from '@/api/responses';
import { notificationReadSchema } from '@/api/schemas';
import { requireSession } from '@/middleware/require-session';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import {
  listNotifications,
  markAllRead,
  markRead,
} from '@/services/notifications/notification.service';

/**
 * GET   /api/notifications — recent notifications and the unread count.
 * PATCH /api/notifications — mark some, or all, as read.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(
  'GET /api/notifications',
  async (request) => {
    const limited = enforceRateLimit('read', request);
    if (limited) return limited;

    const auth = await requireSession();
    if (!auth.authenticated) return auth.response;

    const url = new URL(request.url);

    return ok(
      await listNotifications(auth.session.user.id, {
        limit: Math.min(50, Number(url.searchParams.get('limit') ?? 20) || 20),
        unreadOnly: url.searchParams.get('unread') === '1',
      }),
    );
  },
);

export const PATCH = withErrorHandling(
  'PATCH /api/notifications',
  async (request) => {
    const limited = enforceRateLimit('job', request);
    if (limited) return limited;

    const auth = await requireSession();
    if (!auth.authenticated) return auth.response;

    const body = await parseJsonBody(request, notificationReadSchema);
    if (!body.success) return body.response;

    const userId = auth.session.user.id;
    const result = body.data.ids?.length
      ? await markRead(userId, body.data.ids)
      : await markAllRead(userId);

    return ok({ marked: result.count });
  },
);
