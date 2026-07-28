import Link from 'next/link';

import { FileQuestion, Home, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CONVERTER_LINKS } from '@/lib/nav';

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
        <FileQuestion className="size-8" aria-hidden="true" />
      </span>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        We could not find that page
      </h1>
      <p className="mt-3 max-w-md text-pretty text-muted-foreground">
        The link may be out of date, or the conversion you are looking for is
        not one we support.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Home aria-hidden="true" />
            Back to home
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/features">
            <Search aria-hidden="true" />
            Browse all formats
          </Link>
        </Button>
      </div>

      <nav aria-label="Converters" className="mt-10">
        <ul className="flex flex-wrap justify-center gap-2">
          {CONVERTER_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-block rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:text-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
