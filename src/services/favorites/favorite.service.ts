import 'server-only';

import * as favorites from '@/database/repositories/favorite.repository';
import * as stats from '@/database/repositories/stats.repository';
import {
  findRoute,
  getFormat,
  routeSlug,
} from '@/services/conversion/registry';

/**
 * Pinned conversion routes.
 *
 * A favourite is a *route* (png to jpg), not a file — files expire, routes are
 * what a person repeats. Every route is validated against the registry before
 * it is stored, so a favourite can never point at a conversion the platform
 * does not support.
 */

/** Ceiling per user; the UI is a shortcut list, not an archive. */
const MAX_FAVORITES = 24;

export interface FavoriteDto {
  id: string;
  sourceFormat: string;
  targetFormat: string;
  sourceLabel: string;
  targetLabel: string;
  category: string;
  slug: string;
  useCount: number;
  lastUsedAt: string | null;
}

export type FavoriteFailure =
  | { code: 'unsupported_route'; message: string }
  | { code: 'limit_reached'; message: string };

function toDto(favorite: {
  id: string;
  sourceFormat: string;
  targetFormat: string;
  useCount: number;
  lastUsedAt: Date | null;
}): FavoriteDto | null {
  const from = getFormat(favorite.sourceFormat);
  const to = getFormat(favorite.targetFormat);
  if (!from || !to) return null;

  return {
    id: favorite.id,
    sourceFormat: favorite.sourceFormat,
    targetFormat: favorite.targetFormat,
    sourceLabel: from.label,
    targetLabel: to.label,
    category: from.category,
    slug: routeSlug({ from: favorite.sourceFormat, to: favorite.targetFormat }),
    useCount: favorite.useCount,
    lastUsedAt: favorite.lastUsedAt?.toISOString() ?? null,
  };
}

export async function listFavorites(userId: string): Promise<FavoriteDto[]> {
  const rows = await favorites.list(userId);
  // A route retired from the registry is filtered out rather than rendered
  // as a dead shortcut.
  return rows
    .map(toDto)
    .filter((favorite): favorite is FavoriteDto => favorite !== null);
}

export async function addFavorite(
  userId: string,
  sourceFormat: string,
  targetFormat: string,
): Promise<
  { ok: true; favorite: FavoriteDto } | { ok: false; failure: FavoriteFailure }
> {
  if (!findRoute(sourceFormat, targetFormat)) {
    return {
      ok: false,
      failure: {
        code: 'unsupported_route',
        message: `Converting ${sourceFormat.toUpperCase()} to ${targetFormat.toUpperCase()} is not supported.`,
      },
    };
  }

  const existing = await favorites.find(userId, sourceFormat, targetFormat);
  if (!existing && (await favorites.count(userId)) >= MAX_FAVORITES) {
    return {
      ok: false,
      failure: {
        code: 'limit_reached',
        message: `You can pin up to ${MAX_FAVORITES} conversions. Remove one to add another.`,
      },
    };
  }

  const favorite = toDto(
    await favorites.add(userId, sourceFormat, targetFormat),
  );
  return favorite
    ? { ok: true, favorite }
    : {
        ok: false,
        failure: { code: 'unsupported_route', message: 'Unknown conversion.' },
      };
}

export async function removeFavorite(
  userId: string,
  sourceFormat: string,
  targetFormat: string,
): Promise<boolean> {
  const result = await favorites.remove(userId, sourceFormat, targetFormat);
  return result.count > 0;
}

export function recordFavoriteUse(
  userId: string,
  sourceFormat: string,
  targetFormat: string,
) {
  return favorites.markUsed(userId, sourceFormat, targetFormat);
}

/**
 * Routes the user converts often but has not pinned — the "you might want to
 * pin this" list, derived from their own history rather than a generic top-ten.
 */
export async function suggestedFavorites(
  userId: string,
  limit = 4,
): Promise<FavoriteDto[]> {
  const [pinned, top] = await Promise.all([
    favorites.list(userId),
    stats.topRoutes({ userId, guestId: null }, limit + 8),
  ]);

  const alreadyPinned = new Set(
    pinned.map(
      (favorite) => `${favorite.sourceFormat}>${favorite.targetFormat}`,
    ),
  );

  return top
    .filter(
      (route) =>
        !alreadyPinned.has(`${route.sourceFormat}>${route.targetFormat}`),
    )
    .map((route) =>
      toDto({
        id: `suggestion-${route.sourceFormat}-${route.targetFormat}`,
        sourceFormat: route.sourceFormat,
        targetFormat: route.targetFormat,
        useCount: route._count._all,
        lastUsedAt: null,
      }),
    )
    .filter((favorite): favorite is FavoriteDto => favorite !== null)
    .slice(0, limit);
}
