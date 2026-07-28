'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogOut, Settings, User } from 'lucide-react';
import { signOut } from 'next-auth/react';
import type { PlanTier } from '@prisma/client';

import { NotificationBell } from '@/components/dashboard/notification-bell';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DASHBOARD_ITEMS } from '@/lib/dashboard-nav';
import { PLAN_LABEL } from '@/lib/plans';

/**
 * Dashboard topbar: page title, notifications, theme and the account menu.
 *
 * The title is derived from the route rather than passed by each page, so a new
 * page cannot forget to set one.
 */

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.split('@')[0] || 'U';
  return source
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function DashboardTopbar({
  name,
  email,
  image,
  plan,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  plan: PlanTier;
}) {
  const pathname = usePathname();

  // Longest matching route wins, so `/dashboard/settings` does not resolve to
  // the `/dashboard` entry.
  const current = [...DASHBOARD_ITEMS]
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <header className="glass-nav sticky top-0 z-20 flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
      <DashboardSidebar />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">
          {current?.label ?? 'Dashboard'}
        </h1>
        {current?.description ? (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {current.description}
          </p>
        ) : null}
      </div>

      <Badge variant="outline" className="hidden sm:inline-flex">
        {PLAN_LABEL[plan]}
      </Badge>

      <NotificationBell />
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Open account menu"
          >
            <Avatar className="size-8">
              {image ? <AvatarImage src={image} alt="" /> : null}
              <AvatarFallback>{initials(name, email)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate">{name ?? 'Your account'}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">
              <User aria-hidden="true" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <Settings aria-hidden="true" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void signOut({ callbackUrl: '/' })}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
