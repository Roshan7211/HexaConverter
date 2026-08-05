import type { ReactNode } from 'react';

import Link from 'next/link';

import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { FOOTER_SECTIONS } from '@/lib/nav';
import { SITE } from '@/lib/seo';

/**
 * Shell for sign-in, sign-up and password reset.
 *
 * A sibling of the main site group rather than a child of it, which is the only
 * way to leave its chrome behind: a nested layout can add to a parent but never
 * remove from it. Route groups do not affect URLs, so these pages keep their
 * paths exactly.
 *
 * What that buys is proportion. A five-column footer of sixty links under a
 * single sign-in form made the page look like an afterthought, and the main
 * navigation invites someone mid-task to wander off. What stays is a logo back
 * to the site, the theme toggle, and the legal links a person is entitled to
 * read before handing over an email address.
 */
const LEGAL =
  FOOTER_SECTIONS.find((section) => section.title === 'Legal')?.links ?? [];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [@media(pointer:coarse)]:min-h-11"
            aria-label={`${SITE.name} home`}
          >
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="border-t py-6">
        <div className="container flex flex-col items-center gap-3 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {SITE.name}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {LEGAL.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
