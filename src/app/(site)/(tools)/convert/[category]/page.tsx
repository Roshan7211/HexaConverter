import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdSlot } from '@/components/ads/ad-slot';
import { CATEGORY_NOTES } from '@/content/category-notes';
import { renderInline } from '@/components/marketing/guide-body';
import { guidesForTopic } from '@/content/guides';
import { readingMinutes } from '@/content/guides/types';
import { Converter } from '@/components/convert/converter';
import { Badge } from '@/components/ui/badge';
import {
  CATEGORY_META,
  CONVERSION_ROUTES,
  formatsByCategory,
  inputFormatsFor,
  routeSlug,
} from '@/services/conversion/registry';
import { CATEGORIES, type Category } from '@/types/conversion';
import { PLANS } from '@/lib/plans';
import { breadcrumbSchema, buildMetadata, howToSchema } from '@/lib/seo';

/**
 * Category converter page.
 *
 * Statically generated for every category. The converter widget confirms the
 * displayed limits against the server after hydration.
 */

interface PageProps {
  params: Promise<{ category: string }>;
}

/**
 * Operations that are not a format conversion, surfaced on the category hub so
 * someone looking for "open a RAR" finds it without knowing it lives in a
 * separate tool.
 */
const TOOLKIT_LINKS: Partial<
  Record<Category, ReadonlyArray<{ label: string; href: string }>>
> = {
  archive: [
    { label: 'Extract an archive', href: '/tools/archive/extract' },
    { label: 'Create an archive', href: '/tools/archive/compress' },
    { label: 'Password-protect a ZIP', href: '/tools/archive/protect' },
  ],
  document: [
    { label: 'Merge PDFs', href: '/tools/pdf/merge' },
    { label: 'Split a PDF', href: '/tools/pdf/split' },
    { label: 'Compress a PDF', href: '/tools/pdf/compress' },
    { label: 'Rotate a PDF', href: '/tools/pdf/rotate' },
    { label: 'Extract pages', href: '/tools/pdf/extract-pages' },
  ],
};

function parseCategory(value: string): Category | null {
  return (CATEGORIES as readonly string[]).includes(value)
    ? (value as Category)
    : null;
}

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category: raw } = await params;
  const category = parseCategory(raw);
  if (!category) return {};

  const meta = CATEGORY_META[category];
  const formats = formatsByCategory(category)
    .map((format) => format.label)
    .join(', ');

  return buildMetadata({
    title: meta.headline,
    description: `${meta.blurb} Free, fast and secure — supported formats: ${formats}.`,
    path: `/convert/${category}`,
    keywords: [
      `${category} converter`,
      `convert ${category} online`,
      ...formatsByCategory(category).map((format) => `${format.id} converter`),
    ],
  });
}

export default async function CategoryConverterPage({ params }: PageProps) {
  const { category: raw } = await params;
  const category = parseCategory(raw);
  if (!category) notFound();

  const meta = CATEGORY_META[category];
  const inputs = inputFormatsFor(category);
  const sourceIds = inputs.map((format) => format.id);

  const routes = CONVERSION_ROUTES.filter((route) =>
    sourceIds.includes(route.from),
  );

  // Four at most: enough to give the page somewhere to lead, without turning
  // the bottom of a converter into a reading list.
  const categoryGuides = guidesForTopic(category).slice(0, 4);

  return (
    <>
      <div className="border-b bg-card/40">
        <div className="container py-10 sm:py-14">
          <nav
            aria-label="Breadcrumb"
            className="mb-4 text-sm text-muted-foreground"
          >
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{meta.label}</li>
            </ol>
          </nav>

          <h1 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {meta.headline}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            {meta.blurb}
          </p>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {inputs.map((format) => (
              <Badge
                key={format.id}
                variant="outline"
                className="font-mono uppercase"
              >
                {format.id}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="container grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-14">
        <Converter
          category={category}
          allowedSourceFormats={sourceIds}
          hint={`Accepts ${inputs.map((format) => format.label).join(', ')}.`}
        />

        <aside className="space-y-6" aria-label="Available conversions">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold tracking-tight">
              All {meta.label.toLowerCase()} conversions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {routes.length} routes available. Each has its own page.
            </p>

            <ul className="mt-4 flex flex-wrap gap-1.5">
              {routes.slice(0, 40).map((route) => (
                <li key={`${route.from}-${route.to}`}>
                  <Link
                    href={`/tools/${routeSlug(route)}`}
                    className="inline-block rounded border px-2 py-1 font-mono text-[11px] uppercase text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {route.from}→{route.to}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {TOOLKIT_LINKS[category] ? (
            <div className="rounded-xl border bg-card p-5 text-sm">
              <h2 className="font-semibold tracking-tight">
                {category === 'archive' ? 'Archive manager' : 'PDF tools'}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Beyond converting between formats.
              </p>
              <ul className="mt-3 space-y-2">
                {TOOLKIT_LINKS[category]!.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border bg-card p-5 text-sm">
            <h2 className="font-semibold tracking-tight">
              How your files are handled
            </h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Uploads are verified against their file signature.</li>
              <li>
                The source file is deleted as soon as conversion finishes.
              </li>
              <li>
                Converted files are removed automatically &mdash; after{' '}
                {PLANS.ANONYMOUS.retentionHours} hour without an account, up to{' '}
                {PLANS.PREMIUM.retentionHours} hours on Premium.
              </li>
              <li>Download links are signed and expire in minutes.</li>
            </ul>
          </div>

          {/* Last in the sidebar, so nothing sits below it to be pushed down.
              On a phone the grid is one column and this falls beneath the whole
              converter — the same slot works for both without a second rule. */}
          {/* 300x250 stacked on a phone, 300x600 in the desktop rail. The
              reserved height is the creative height at each breakpoint. */}
          <AdSlot
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR}
            label="Advertisement"
            className="h-[250px] lg:h-[600px]"
            sizeClassName="h-[250px] w-[250px] shrink-0 min-[360px]:w-[300px] lg:h-[600px] lg:w-[300px]"
          />
        </aside>
      </div>

      <section
        className="border-t bg-card/40 py-14"
        aria-labelledby="about-category"
      >
        <div className="container mx-auto max-w-3xl">
          <h2
            id="about-category"
            className="text-2xl font-semibold tracking-tight"
          >
            How {meta.label.toLowerCase()} conversion works here
          </h2>

          {CATEGORY_NOTES[category].map((note) => (
            <div key={note.heading} className="mt-8">
              <h3 className="text-base font-semibold tracking-tight">
                {note.heading}
              </h3>
              {note.body.map((paragraph, index) => (
                <p
                  key={index}
                  className="mt-3 leading-relaxed text-muted-foreground"
                >
                  {renderInline(paragraph)}
                </p>
              ))}
            </div>
          ))}

          {categoryGuides.length > 0 ? (
            <div className="mt-12 border-t pt-8">
              <h3 className="text-sm font-semibold tracking-tight">
                Guides on {meta.label.toLowerCase()}
              </h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {categoryGuides.map((guide) => (
                  <li key={guide.slug}>
                    <Link
                      href={`/guides/${guide.slug}`}
                      className="block h-full rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                    >
                      <p className="font-medium leading-snug">{guide.title}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {guide.description}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {readingMinutes(guide)} min read
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: meta.label, path: `/convert/${category}` },
            ]),
            howToSchema({
              name: meta.headline,
              description: meta.blurb,
              steps: [
                {
                  name: 'Upload',
                  text: 'Drag your file into the upload area or choose it from your device.',
                },
                {
                  name: 'Choose a format',
                  text: 'Select the output format and adjust the conversion settings if needed.',
                },
                {
                  name: 'Download',
                  text: 'Wait for the conversion to finish and download the converted file.',
                },
              ],
            }),
          ]),
        }}
      />
    </>
  );
}
