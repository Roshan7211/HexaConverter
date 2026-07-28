import 'server-only';

import type { NotificationType, Prisma } from '@prisma/client';

import { prisma } from '@/database/client';

/** Data access for in-app notifications. */

export const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  href: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export function list(userId: string, limit: number, unreadOnly: boolean) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
    select: notificationSelect,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export function countUnread(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
}

export function create(notification: NewNotification) {
  return prisma.notification.create({
    data: notification,
    select: notificationSelect,
  });
}

export function markRead(userId: string, ids: string[]) {
  return prisma.notification.updateMany({
    where: { userId, id: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export function remove(userId: string, id: string) {
  return prisma.notification.deleteMany({ where: { userId, id } });
}

/** Keeps the table bounded; called by the retention pass. */
export function pruneOlderThan(cutoff: Date) {
  return prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
