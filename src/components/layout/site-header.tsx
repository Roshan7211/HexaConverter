'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ChevronDown, Menu, X } from 'lucide-react';

import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CONVERTER_LINKS,
  LANDING_SECTIONS,
  PDF_TOOL_LINKS,
  PRIMARY_LINKS,
} from '@/lib/nav';
import { cn } from '@/utils';

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the drawer on navigation so a back/forward move never leaves it open.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Prevent the page behind the drawer from scrolling.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Section anchors only resolve on the landing page itself.
  const navLinks = pathname === '/' ? LANDING_SECTIONS : PRIMARY_LINKS;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-300',
        // Transparent over the hero, frosted once the page scrolls — the
        // border only appears when there is content behind it to separate.
        scrolled
          ? 'glass-nav shadow-sm'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="HexaConverter home"
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'gap-1',
                  pathname.startsWith('/convert') && 'text-primary',
                )}
              >
                Converters
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {CONVERTER_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link
                    href={link.href}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{link.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {link.description}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'gap-1',
                  pathname.startsWith('/tools/pdf') && 'text-primary',
                )}
              >
                PDF tools
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {PDF_TOOL_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link
                    href={link.href}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{link.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {link.description}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              asChild
              className={cn(isActive(link.href) && 'text-primary')}
            >
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:block">
            <UserMenu />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Menu aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-navigation" className="glass-nav border-t md:hidden">
          <nav
            className="container flex flex-col gap-1 py-4"
            aria-label="Mobile"
          >
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Converters
            </p>
            {CONVERTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  isActive(link.href) && 'bg-accent text-accent-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}

            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              PDF tools
            </p>
            {PDF_TOOL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  isActive(link.href) && 'bg-accent text-accent-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}

            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Company
            </p>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  isActive(link.href) && 'bg-accent text-accent-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-4 border-t pt-4 sm:hidden">
              <UserMenu />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
