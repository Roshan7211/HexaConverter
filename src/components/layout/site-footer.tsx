import Link from 'next/link';

import { ShieldCheck } from 'lucide-react';

import { Logo } from '@/components/layout/logo';
import { Separator } from '@/components/ui/separator';
import { FOOTER_SECTIONS } from '@/lib/nav';
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
              Developed by <span className="font-medium">HEXAVO</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
