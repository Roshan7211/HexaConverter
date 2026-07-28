import { errors, ok } from '@/api/responses';
import { favoriteSchema } from '@/api/schemas';
import { requireSession } from '@/middleware/require-session';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
  suggestedFavorites,
} from '@/services/favorites/favorite.service';

/**
 * GET    /api/favorites — pinned routes plus suggestions from usage history.
 * POST   /api/favorites — pin a route.
 * DELETE /api/favorites — unpin a route.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('GET /api/favorites', async (request) => {
  const limited = enforceRateLimit('read', request);
  if (limited) return limited;

  const auth = await requireSession();
  if (!auth.authenticated) return auth.response;

  const userId = auth.session.user.id;
  const [favorites, suggestions] = await Promise.all([
    listFavorites(userId),
    suggestedFavorites(userId),
  ]);

  return ok({ favorites, suggestions });
});

export const POST = withErrorHandling(
  'POST /api/favorites',
  async (request) => {
    const limited = enforceRateLimit('job', request);
    if (limited) return limited;

    const auth = await requireSession();
    if (!auth.authenticated) return auth.response;

    const body = await parseJsonBody(request, favoriteSchema);
    if (!body.success) return body.response;

    const result = await addFavorite(
      auth.session.user.id,
      body.data.sourceFormat,
      body.data.targetFormat,
    );

    if (!result.ok) {
      return result.failure.code === 'limit_reached'
        ? errors.conflict(result.failure.message)
        : errors.unprocessable(result.failure.message);
    }

    return ok({ favorite: result.favorite }, { status: 201 });
  },
);

export const DELETE = withErrorHandling(
  'DELETE /api/favorites',
  async (request) => {
    const limited = enforceRateLimit('job', request);
    if (limited) return limited;

    const auth = await requireSession();
    if (!auth.authenticated) return auth.response;

    const url = new URL(request.url);
    const body = favoriteSchema.safeParse({
      sourceFormat: url.searchParams.get('from') ?? '',
      targetFormat: url.searchParams.get('to') ?? '',
    });
    if (!body.success) return errors.unprocessable('Invalid conversion route.');

    const removed = await removeFavorite(
      auth.session.user.id,
      body.data.sourceFormat,
      body.data.targetFormat,
    );

    if (!removed) return errors.notFound('That conversion is not pinned.');
    return ok({ removed: true });
  },
);
