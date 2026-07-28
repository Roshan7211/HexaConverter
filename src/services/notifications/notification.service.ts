import 'server-only';

import { NotificationType } from '@prisma/client';

import * as notifications from '@/database/repositories/notification.repository';
import { logger } from '@/lib/logger';

/**
 * In-app notifications.
 *
 * Emitted by the worker when a conversion settles and by the quota check when
 * an allowance runs low. Delivery is best-effort: a notification write must
 * never fail the operation it describes, so `notify` swallows and logs errors.
 */

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

function toDto(row: notifications.NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
  const [rows, unreadCount] = await Promise.all([
    notifications.list(
      userId,
      options.limit ?? 20,
      options.unreadOnly ?? false,
    ),
    notifications.countUnread(userId),
  ]);

  return { notifications: rows.map(toDto), unreadCount };
}

export function markRead(userId: string, ids: string[]) {
  return notifications.markRead(userId, ids);
}

export function markAllRead(userId: string) {
  return notifications.markAllRead(userId);
}

export function dismiss(userId: string, id: string) {
  return notifications.remove(userId, id);
}

/** Creates a notification, never throwing into the caller's control flow. */
async function notify(entry: notifications.NewNotification): Promise<void> {
  try {
    await notifications.create(entry);
  } catch (error) {
    logger.warn('Failed to write notification', { error, type: entry.type });
  }
}

// ---------------------------------------------------------------------------
// Emitters — one per event, so wording lives in a single place
// ---------------------------------------------------------------------------

export function notifyConversionCompleted(input: {
  userId: string;
  jobId: string;
  inputName: string;
  targetFormat: string;
}) {
  return notify({
    userId: input.userId,
    type: NotificationType.CONVERSION_COMPLETED,
    title: 'Conversion ready',
    body: `${input.inputName} is ready to download as ${input.targetFormat.toUpperCase()}.`,
    href: '/dashboard/conversions',
  });
}

export function notifyConversionFailed(input: {
  userId: string;
  jobId: string;
  inputName: string;
  reason: string;
}) {
  return notify({
    userId: input.userId,
    type: NotificationType.CONVERSION_FAILED,
    title: 'Conversion failed',
    body: `${input.inputName} could not be converted. ${input.reason}`,
    href: '/dashboard/conversions',
  });
}

export function notifyQuotaWarning(input: {
  userId: string;
  used: number;
  limit: number;
}) {
  const remaining = Math.max(0, input.limit - input.used);

  return notify({
    userId: input.userId,
    type: NotificationType.QUOTA_WARNING,
    title: 'Running low on conversions',
    body: `${remaining} of your ${input.limit} monthly conversions remain.`,
    href: '/dashboard',
  });
}

export function notifyFilesExpiring(input: {
  userId: string;
  count: number;
  withinHours: number;
}) {
  return notify({
    userId: input.userId,
    type: NotificationType.FILE_EXPIRING,
    title: 'Files expiring soon',
    body: `${input.count} converted file${input.count === 1 ? '' : 's'} will be deleted within ${input.withinHours} hours. Download them if you still need them.`,
    href: '/dashboard/storage',
  });
}
