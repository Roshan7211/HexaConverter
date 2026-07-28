import type { FavoriteDto } from '@/services/favorites/favorite.service';
import type { NotificationDto } from '@/services/notifications/notification.service';
import type { DashboardStats } from '@/types/stats';
import type { ApiError } from '@/types/api';

/** Browser-side dashboard calls. */

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as ApiError).error
        : 'The request failed.';
    throw new Error(message);
  }

  return body as T;
}

// --- Statistics -------------------------------------------------------------

export async function getStats(days = 30): Promise<DashboardStats> {
  return parse<DashboardStats>(
    await fetch(`/api/stats?days=${days}`, { cache: 'no-store' }),
  );
}

// --- Favourites -------------------------------------------------------------

export interface FavoritesResponse {
  favorites: FavoriteDto[];
  suggestions: FavoriteDto[];
}

export async function getFavorites(): Promise<FavoritesResponse> {
  return parse<FavoritesResponse>(
    await fetch('/api/favorites', { cache: 'no-store' }),
  );
}

export async function addFavorite(
  sourceFormat: string,
  targetFormat: string,
): Promise<FavoriteDto> {
  const body = await parse<{ favorite: FavoriteDto }>(
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceFormat, targetFormat }),
    }),
  );
  return body.favorite;
}

export async function removeFavorite(
  sourceFormat: string,
  targetFormat: string,
): Promise<void> {
  const query = new URLSearchParams({ from: sourceFormat, to: targetFormat });
  await parse(
    await fetch(`/api/favorites?${query.toString()}`, { method: 'DELETE' }),
  );
}

// --- Notifications ----------------------------------------------------------

export interface NotificationsResponse {
  notifications: NotificationDto[];
  unreadCount: number;
}

export async function getNotifications(
  limit = 20,
): Promise<NotificationsResponse> {
  return parse<NotificationsResponse>(
    await fetch(`/api/notifications?limit=${limit}`, { cache: 'no-store' }),
  );
}

/** Omit `ids` to mark everything read. */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const body = await parse<{ marked: number }>(
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    }),
  );
  return body.marked;
}

// --- Document toolkit --------------------------------------------------------

export interface PdfTaskRequest {
  operation: string;
  tickets: string[];
  pages?: string;
  angle?: 90 | 180 | 270;
  splitMode?: 'pages' | 'ranges';
  compression?: 'light' | 'balanced' | 'strong';
}

/** Queues a merge / split / extract / rotate / compress task. */
export async function createPdfTask(
  request: PdfTaskRequest,
): Promise<{ id: string; status: string; progress: number }> {
  const body = await parse<{
    job: { id: string; status: string; progress: number };
  }>(
    await fetch('/api/tools/pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }),
  );

  return body.job;
}
