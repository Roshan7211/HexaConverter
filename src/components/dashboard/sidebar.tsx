'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ArrowLeft, Menu, Plus, X } from 'lucide-react';

import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { DASHBOARD_NAV } from '@/lib/dashboard-nav';
import { cn } from '@/utils';

/**
 * Dashboard sidebar.
 *
 * One component serves both breakpoints: a fixed rail from `lg` up, and a
 * slide-over drawer below it. The drawer traps nothing and closes on route
 * change, on Escape and on backdrop click — the three ways people expect to
 * dismiss it.
 */

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
      aria-label="Dashboard"
    >
      {DASHBOARD_NAV.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <item.icon
                      className={cn(
                        'size-4 shrink-0 transition-transform',
                        !active && 'group-hover:scale-110',
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {active ? (
                      <span
                        className="size-1.5 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-3 border-t p-3">
      <Button asChild className="w-full" onClick={onNavigate}>
        <Link href="/convert/image">
          <Plus aria-hidden="true" />
          New conversion
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="w-full justify-start"
      >
        <Link href="/" onClick={onNavigate}>
          <ArrowLeft aria-hidden="true" />
          Back to site
        </Link>
      </Button>
    </div>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on navigation so a back/forward move never leaves the drawer open.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Mobile trigger, rendered in the dashboard topbar. */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open dashboard menu"
        aria-expanded={open}
        aria-controls="dashboard-sidebar"
      >
        <Menu aria-hidden="true" />
      </Button>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card/60 lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Link
            href="/dashboard"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Logo />
          </Link>
        </div>
        <NavList />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close dashboard menu"
            tabIndex={-1}
          />

          <div
            id="dashboard-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
            className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-card shadow-2xl duration-200 animate-in slide-in-from-left"
          >
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Logo />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <SidebarFooter onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
