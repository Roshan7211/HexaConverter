import Link from 'next/link';

import { ShieldCheck } from 'lucide-react';

import { Logo } from '@/components/layout/logo';
import { Separator } from '@/components/ui/separator';
import { STORE_MARKS } from '@/components/layout/store-marks';
import { APP_LINKS, FOOTER_SECTIONS } from '@/lib/nav';
import { SITE } from '@/lib/seo';
import { FORMATS, TOTAL_ROUTES } from '@/services/conversion/registry';

/** Site footer: navigation, trust signals and legal links. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const formatCount = Object.keys(FORMATS).length;

  return (
    <footer className="relative border-t bg-card/40">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="aurora opacity-40" />
      </div>

      <div className="container relative">
        <div className="grid gap-10 pb-14 pt-14 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {TOTAL_ROUTES} conversions across {formatCount} formats — images,
              documents, audio, video and archives. Encrypted in transit,
              deleted automatically.
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck
                className="size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              No watermarks · No tracking scripts · No data sales
            </p>

            {/* In the brand column rather than as a sixth nav section: these
                are two promotional links, and a column of them would sit
                nearly empty next to lists of six. */}
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-semibold">Get the app</h2>
              <ul className="flex flex-wrap gap-2">
                {APP_LINKS.map((link) => {
                  const Icon = STORE_MARKS[link.platform];
                  return (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        {link.store}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav
              key={section.title}
              aria-labelledby={`footer-${section.title}`}
            >
              <h2
                id={`footer-${section.title}`}
                className="text-sm font-semibold"
              >
                {section.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator />

        <div className="flex flex-col items-start justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © {year} {SITE.name}. All rights reserved.
          </p>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <p>
              Developed by{' '}
              <a
                href="https://hexavo.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded font-medium transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                HEXAVO
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
