'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CATEGORY_META,
  CONVERSION_ROUTES,
  formatsByCategory,
  routeSlug,
} from '@/services/conversion/registry';
import { CATEGORIES, type Category } from '@/types/conversion';
import { cn } from '@/utils';

/**
 * Supported Formats explorer.
 *
 * Every number and chip is derived from the conversion registry, so the section
 * cannot advertise a format the platform does not actually handle — and it
 * stays correct automatically when a format is added.
 */

const ICONS: Record<Category, typeof FileImage> = {
  image: FileImage,
  document: FileText,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
};

export function SupportedFormats() {
  const [active, setActive] = useState<Category>('image');
  const reduceMotion = useReducedMotion();

  // Recomputing per tab is trivial, but memoising keeps re-renders cheap when
  // the surrounding page animates.
  const data = useMemo(() => {
    const formats = formatsByCategory(active);
    const ids = new Set(formats.map((format) => format.id));
    const routes = CONVERSION_ROUTES.filter((route) => ids.has(route.from));

    return { formats, routes };
  }, [active]);

  return (
    <section
      id="formats"
      className="relative border-y bg-muted/20 py-20 sm:py-28"
      aria-labelledby="formats-heading"
    >
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="accent" className="mb-4">
            Supported formats
          </Badge>
          <h2
            id="formats-heading"
            className="text-3xl font-semibold sm:text-4xl lg:text-5xl"
          >
            {CONVERSION_ROUTES.length} conversions, all first-class
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Not a wrapper around one tool. Each category is handled by the
            encoder built for it, with settings you can actually reach.
          </p>
        </div>

        {/* Category tabs */}
        <div
          className="mt-12 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="File categories"
        >
          {CATEGORIES.map((category) => {
            const Icon = ICONS[category];
            const isActive = category === active;

            return (
              <button
                key={category}
                type="button"
                role="tab"
                id={`format-tab-${category}`}
                aria-selected={isActive}
                aria-controls={`format-panel-${category}`}
                onClick={() => setActive(category)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'glass text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {CATEGORY_META[category].label}
              </button>
            );
          })}
        </div>

        {/* Active category panel */}
        <div
          role="tabpanel"
          id={`format-panel-${active}`}
          aria-labelledby={`format-tab-${active}`}
          className="mx-auto mt-10 max-w-5xl"
        >
          {/*
            `initial={false}` suppresses the enter animation for the panel that
            is present on mount. Without it, Framer Motion server-renders
            `opacity: 0` and the panel stays invisible until hydration — the
            content must be readable before any JavaScript runs.
          */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="glass-panel gradient-ring p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    {CATEGORY_META[active].headline}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {CATEGORY_META[active].blurb}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular text-3xl font-semibold text-primary">
                    {data.routes.length}
                  </p>
                  <p className="text-xs text-muted-foreground">conversions</p>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                {data.formats.map((format) => (
                  <span
                    key={format.id}
                    title={format.description}
                    className="rounded-lg border bg-background/60 px-2.5 py-1.5 font-mono text-xs font-medium uppercase"
                  >
                    {format.id}
                    {!format.canOutput ? (
                      <span className="ml-1.5 font-sans text-[10px] normal-case text-muted-foreground">
                        input only
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>

              <div className="mt-8 border-t pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Popular in this category
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {data.routes.slice(0, 12).map((route) => (
                    <li key={routeSlug(route)}>
                      <Link
                        href={`/tools/${routeSlug(route)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-background/60 px-3 py-1.5 font-mono text-xs uppercase transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {route.from}
                        <ArrowRight className="size-3" aria-hidden="true" />
                        {route.to}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <Button asChild className="mt-8 w-full sm:w-auto">
                <Link href={`/convert/${active}`}>
                  Open the {CATEGORY_META[active].label.toLowerCase()} converter
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
