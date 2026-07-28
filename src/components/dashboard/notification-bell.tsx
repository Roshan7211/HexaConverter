'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Info,
  XCircle,
} from 'lucide-react';
import useSWR from 'swr';

import {
  getNotifications,
  markNotificationsRead,
  type NotificationsResponse,
} from '@/api/client/dashboard.client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelativeTime } from '@/utils';

/**
 * Notification bell.
 *
 * Polls only while the dropdown is closed and the tab is visible — an open
 * panel is already showing what the user asked for, and a background tab does
 * not need updates.
 */

const ICONS = {
  CONVERSION_COMPLETED: { icon: CheckCircle2, tone: 'text-success' },
  CONVERSION_FAILED: { icon: XCircle, tone: 'text-destructive' },
  FILE_EXPIRING: { icon: Clock, tone: 'text-warning' },
  QUOTA_WARNING: { icon: AlertTriangle, tone: 'text-warning' },
  SYSTEM: { icon: Info, tone: 'text-primary' },
} as const;

const POLL_MS = 30_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data, isLoading, mutate } = useSWR<NotificationsResponse>(
    'notifications',
    () => getNotifications(15),
    {
      refreshInterval: open ? 0 : POLL_MS,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );

  const unread = data?.unreadCount ?? 0;

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) await mutate();
  }

  async function markAll() {
    // Optimistic: the count clears immediately, then the server confirms.
    await mutate(
      async () => {
        await markNotificationsRead();
        return getNotifications(15);
      },
      {
        optimisticData: data
          ? {
              notifications: data.notifications.map((item) => ({
                ...item,
                read: true,
              })),
              unreadCount: 0,
            }
          : undefined,
        rollbackOnError: true,
      },
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
          }
        >
          <Bell aria-hidden="true" />
          {unread > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground"
              aria-hidden="true"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={() => void markAll()}
            >
              <CheckCheck aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !data || data.notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell
                className="mx-auto size-8 text-muted-foreground/40"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium">You are all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Conversion updates will appear here.
              </p>
            </div>
          ) : (
            <ul>
              {data.notifications.map((notification) => {
                const { icon: Icon, tone } = ICONS[notification.type];
                const content = (
                  <>
                    <Icon
                      className={cn('mt-0.5 size-4 shrink-0', tone)}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {notification.title}
                        </span>
                        {!notification.read ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-primary"
                            aria-label="Unread"
                          />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {notification.body}
                      </span>
                      <time
                        dateTime={notification.createdAt}
                        className="mt-1 block text-[11px] text-muted-foreground/80"
                      >
                        {formatRelativeTime(notification.createdAt)}
                      </time>
                    </span>
                  </>
                );

                return (
                  <li key={notification.id} className="border-b last:border-0">
                    {notification.href ? (
                      <Link
                        href={notification.href}
                        className={cn(
                          'flex gap-3 px-4 py-3 transition-colors hover:bg-accent',
                          !notification.read && 'bg-primary/[0.04]',
                        )}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        className={cn(
                          'flex gap-3 px-4 py-3',
                          !notification.read && 'bg-primary/[0.04]',
                        )}
                      >
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
