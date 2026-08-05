'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ChevronDown, Menu, X } from 'lucide-react';

import { UserMenu } from '@/components/auth/user-menu';
import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
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

export interface SiteHeaderProps {
  /** The signed-in person, resolved on the server. Null when signed out. */
  user: { email: string } | null;
  /** False when the deployment has no Firebase configuration at all. */
  accountsEnabled: boolean;
}

export function SiteHeader({ user, accountsEnabled }: SiteHeaderProps) {
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
          // The logo is the "go home" control on every page, and the mark is
          // 40px tall — the extra height is invisible but thumb-sized.
          className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [@media(pointer:coarse)]:min-h-11"
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
          {/* Rendered from the server-verified session rather than from
              Firebase's client state, so the correct control is in the first
              paint and never flickers from signed-out to signed-in. Absent
              entirely when accounts are not configured. */}
          {accountsEnabled ? (
            user ? (
              <UserMenu email={user.email} />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                asChild
                // Shown from 360px up: the logo, this, the theme toggle and
                // the menu button together need 311px, which fits inside the
                // container on all but the very narrowest phones. Below that
                // the drawer carries it instead.
                className="hidden min-[360px]:inline-flex"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
            )
          ) : null}

          <ThemeToggle />

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
        <div
          id="mobile-navigation"
          // The drawer scrolls itself. It opens under a 4rem sticky header and
          // its content is taller than a phone screen, while the effect above
          // locks the body — so without a scroller of its own the items past
          // the fold cannot be reached at all. `dvh` rather than `vh` because
          // Safari's toolbar shrinks the visible area after load, and `vh`
          // would size the drawer to a viewport the reader cannot see all of.
          // `overscroll-contain` stops a flick at either end scrolling the page
          // behind it.
          className="glass-nav max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t md:hidden"
        >
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

            {/* Accounts were unreachable on a phone. The header's "Sign in"
                button is hidden on narrow screens to leave room for the logo
                and the menu, and this drawer — the only other navigation a
                phone has — never mentioned accounts at all. Between them there
                was no way to sign in below 640px. */}
            {accountsEnabled ? (
              <>
                <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Account
                </p>
                {user ? (
                  <Link
                    href="/account"
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                      isActive('/account') &&
                        'bg-accent text-accent-foreground',
                    )}
                  >
                    Your account
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/sign-in"
                      className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/sign-up"
                      className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      Create an account
                    </Link>
                  </>
                )}
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
