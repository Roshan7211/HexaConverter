import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { Reveal, RevealGroup, RevealItem } from '@/components/marketing/reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FEATURED_ROUTES,
  getFormat,
  parseRouteSlug,
} from '@/services/conversion/registry';

/**
 * High-intent conversion shortcuts.
 *
 * Each links to a prerendered landing page with the output format already
 * selected, which is both the fastest path for a visitor who knows what they
 * want and the internal-linking backbone for those 214 pages.
 */
export function PopularTools() {
  const tools = FEATURED_ROUTES.map((slug) => {
    const route = parseRouteSlug(slug);
    if (!route) return null;

    const from = getFormat(route.from);
    const to = getFormat(route.to);
    if (!from || !to) return null;

    return {
      slug,
      from: from.id,
      to: to.id,
      label: `${from.label} to ${to.label}`,
    };
  }).filter(
    (tool): tool is { slug: string; from: string; to: string; label: string } =>
      tool !== null,
  );

  return (
    <section
      className="container py-20 sm:py-28"
      aria-labelledby="popular-heading"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mb-4">
          Popular conversions
        </Badge>
        <h2
          id="popular-heading"
          className="text-3xl font-semibold sm:text-4xl lg:text-5xl"
        >
          Jump straight to what you need
        </h2>
        <p className="mt-4 text-pretty text-muted-foreground">
          Every conversion has its own page with the output format already
          selected.
        </p>
      </Reveal>

      <RevealGroup
        as="ul"
        className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {tools.map((tool) => (
          <RevealItem key={tool.slug} as="li">
            <Link
              href={`/tools/${tool.slug}`}
              title={tool.label}
              className="glass group flex items-center justify-between gap-2 rounded-xl px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="font-mono text-sm font-medium uppercase">
                {tool.from} <span className="text-muted-foreground">to</span>{' '}
                {tool.to}
              </span>
              <ArrowUpRight
                className="size-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mt-10 text-center">
        <Button variant="outline" asChild>
          <Link href="/features">Browse all 214 conversions</Link>
        </Button>
      </Reveal>
    </section>
  );
}
