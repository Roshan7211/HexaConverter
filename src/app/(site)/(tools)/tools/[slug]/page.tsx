import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { Converter } from '@/components/convert/converter';
import { guidesForConversion } from '@/content/guides';
import { readingMinutes } from '@/content/guides/types';
import { AdSlot } from '@/components/ads/ad-slot';
import { FaqSection } from '@/components/marketing/faq-section';
import { FormatGuide } from '@/components/marketing/format-guide';
import { Badge } from '@/components/ui/badge';
import {
  getFormat,
  parseRouteSlug,
  PUBLISHED_ROUTES,
  routeSlug,
} from '@/services/conversion/registry';
import {
  breadcrumbSchema,
  buildMetadata,
  faqSchema,
  howToSchema,
  softwareApplicationSchema,
} from '@/lib/seo';

/**
 * Landing page for a single conversion route (for example `/tools/png-to-jpg`).
 *
 * Every supported route is prerendered at build time with its own copy,
 * structured data and a converter that already has the output format selected.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return PUBLISHED_ROUTES.map((route) => ({ slug: routeSlug(route) }));
}

/** Route pages are static; unknown slugs 404 rather than rendering on demand. */
export const dynamicParams = false;

function describe(slug: string) {
  const route = parseRouteSlug(slug);
  // Identity routes are valid conversions but have no landing page.
  if (!route || route.from === route.to) return null;

  const from = getFormat(route.from);
  const to = getFormat(route.to);
  if (!from || !to) return null;

  return { route, from, to };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const info = describe(slug);
  if (!info) return {};

  const { from, to } = info;
  const title = `Convert ${from.label} to ${to.label}`;

  return buildMetadata({
    title: `${title} — free online ${from.id.toUpperCase()} to ${to.id.toUpperCase()} converter`,
    description: `Convert ${from.label} files to ${to.label} online for free. ${to.description} No watermark, no signup required, and your files are deleted automatically.`,
    path: `/tools/${slug}`,
    keywords: [
      `${from.id} to ${to.id}`,
      `convert ${from.id} to ${to.id}`,
      `${from.id} to ${to.id} converter`,
      `${from.label} to ${to.label}`,
      `free ${from.id} to ${to.id} converter online`,
    ],
  });
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const info = describe(slug);
  if (!info) notFound();

  const { route, from, to } = info;
  const title = `Convert ${from.label} to ${to.label}`;

  // The window into each sibling list is rotated by this route's own position.
  // A plain `.slice(0, 8)` always surfaces the same head of the list, which
  // left routes sorting late — `mov-to-opus`, `avi-to-aac` and four others —
  // linked from nowhere on the site and reachable only through the sitemap.
  const offset = PUBLISHED_ROUTES.findIndex(
    (candidate) => candidate.from === route.from && candidate.to === route.to,
  );

  const related = linkWindow(
    PUBLISHED_ROUTES.filter(
      (candidate) =>
        candidate.from === route.from &&
        candidate.to !== route.to &&
        candidate.to !== route.from,
    ),
    offset,
    8,
  );

  const alternatives = linkWindow(
    PUBLISHED_ROUTES.filter(
      (candidate) => candidate.to === route.to && candidate.from !== route.from,
    ),
    offset,
    8,
  );

  // Two at most: the point is to offer a way deeper into the site, not to
  // bury the converter under a reading list.
  const guides = guidesForConversion(from.id, to.id).slice(0, 2);

  const faq = [
    {
      question: `How do I convert ${from.label} to ${to.label}?`,
      answer: `Upload your ${from.label} file using the box above, confirm ${to.label} as the output format, then select Convert. The converted file is ready to download as soon as processing finishes — usually in a few seconds.`,
    },
    {
      question: `Is converting ${from.id.toUpperCase()} to ${to.id.toUpperCase()} free?`,
      answer:
        'Yes, and there is nothing to sign up for. Every conversion route is free on every plan — paying raises limits such as file size and how many conversions you get, and removes advertising. It never unlocks a format, adds a watermark or degrades the output.',
    },
    {
      question: `Will the quality change when converting to ${to.label}?`,
      answer: qualityNote(from.id, to.id),
    },
    {
      question: 'What happens to my file afterwards?',
      answer:
        'The uploaded file is deleted as soon as the conversion completes, and the converted file is removed automatically once its retention window ends. Download links are signed and expire within minutes.',
    },
  ];

  return (
    <>
      <div className="border-b bg-card/40">
        <div className="container py-10 sm:py-14">
          <nav
            aria-label="Breadcrumb"
            className="mb-4 text-sm text-muted-foreground"
          >
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/convert/${from.category}`}
                  className="hover:text-foreground"
                >
                  {from.category.charAt(0).toUpperCase() +
                    from.category.slice(1)}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">
                {from.id.toUpperCase()} to {to.id.toUpperCase()}
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono uppercase">
              {from.id}
            </Badge>
            <ArrowRight
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Badge variant="accent" className="font-mono uppercase">
              {to.id}
            </Badge>
          </div>

          <h1 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Free online converter for {from.label} files. {to.description}{' '}
            Nothing to install, no watermark, and every file is deleted
            automatically.
          </p>
        </div>
      </div>

      <div className="container py-10 lg:py-14">
        <div className="mx-auto max-w-3xl">
          <Converter
            allowedSourceFormats={[from.id]}
            initialTarget={to.id}
            category={from.category}
            hint={`Upload a ${from.label} file to convert it to ${to.label}.`}
          />

          {/* Below the converter, never inside it. Someone reaching this has
              finished the job they came for; the explanatory content beneath is
              what they scroll to next. Constrained to the same `max-w-3xl` as
              the converter so a wide creative cannot break the column. */}
          {/* 300x250 up to the large breakpoint, then a 728x90 leaderboard.
              The switch waits for `lg` rather than `md` because the column is
              768px wide and a 728px creative leaves four pixels a side — enough
              for a scrollbar or a rounding error to overflow it. */}
          <AdSlot
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE}
            label="Advertisement"
            className="mt-10 h-[250px] lg:h-[90px]"
            // 250x250 on the narrowest phones: a 320px screen leaves 288px
            // inside the column, and a 300px creative there is one Google will
            // not let us crop. `shrink-0` keeps the declared width declared —
            // as a flex child it was otherwise being squeezed to 288 while
            // AdSense still served 300.
            sizeClassName="h-[250px] w-[250px] shrink-0 min-[360px]:w-[300px] lg:h-[90px] lg:w-[728px]"
          />
        </div>
      </div>

      <section
        className="border-t bg-card/40 py-14"
        aria-labelledby="about-heading"
      >
        <div className="container mx-auto max-w-3xl">
          <h2
            id="about-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            About {from.id.toUpperCase()} and {to.id.toUpperCase()}
          </h2>

          <FormatGuide from={from} to={to} />

          {related.length > 0 ? (
            <div className="mt-10">
              <h3 className="text-sm font-semibold tracking-tight">
                Other {from.label} conversions
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {related.map((candidate) => (
                  <li key={routeSlug(candidate)}>
                    <Link
                      href={`/tools/${routeSlug(candidate)}`}
                      className="inline-block rounded-lg border bg-card px-3 py-1.5 font-mono text-xs uppercase transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {candidate.from} to {candidate.to}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {alternatives.length > 0 ? (
            <div className="mt-8">
              <h3 className="text-sm font-semibold tracking-tight">
                Other ways to get {to.label}
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {alternatives.map((candidate) => (
                  <li key={routeSlug(candidate)}>
                    <Link
                      href={`/tools/${routeSlug(candidate)}`}
                      className="inline-block rounded-lg border bg-card px-3 py-1.5 font-mono text-xs uppercase transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {candidate.from} to {candidate.to}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {guides.length > 0 ? (
            <div className="mt-10 border-t pt-8">
              <h3 className="text-sm font-semibold tracking-tight">
                Worth reading next
              </h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {guides.map((guide) => (
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

      <FaqSection
        entries={faq}
        heading={`${from.id.toUpperCase()} to ${to.id.toUpperCase()} questions`}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              {
                name:
                  from.category.charAt(0).toUpperCase() +
                  from.category.slice(1),
                path: `/convert/${from.category}`,
              },
              {
                name: `${from.id.toUpperCase()} to ${to.id.toUpperCase()}`,
                path: `/tools/${slug}`,
              },
            ]),
            softwareApplicationSchema({
              name: title,
              description: `Online converter from ${from.label} to ${to.label}.`,
              path: `/tools/${slug}`,
            }),
            howToSchema({
              name: title,
              description: `Convert a ${from.label} file to ${to.label} online.`,
              steps: [
                {
                  name: 'Upload',
                  text: `Select or drag in your ${from.label} file.`,
                },
                {
                  name: 'Convert',
                  text: `Confirm ${to.label} as the output format and start the conversion.`,
                },
                {
                  name: 'Download',
                  text: 'Download the converted file with the signed link.',
                },
              ],
            }),
            faqSchema(faq),
          ]),
        }}
      />
    </>
  );
}

/**
 * A `count`-wide window into `items`, starting at `offset` and wrapping.
 *
 * Used to spread sibling links evenly across the route set: every route ends up
 * linked from somewhere, and no two adjacent pages carry an identical link list.
 */
function linkWindow<T>(
  items: readonly T[],
  offset: number,
  count: number,
): T[] {
  if (items.length <= count) return [...items];
  const start = ((offset % items.length) + items.length) % items.length;
  return Array.from(
    { length: count },
    (_, index) => items[(start + index) % items.length]!,
  );
}

/** Honest, format-aware answer about quality loss. */
function qualityNote(from: string, to: string): string {
  const LOSSLESS = new Set([
    'png',
    'tiff',
    'flac',
    'wav',
    'zip',
    'tar',
    'tgz',
    'csv',
    'json',
    'txt',
  ]);
  const LOSSY = new Set([
    'jpg',
    'webp',
    'avif',
    'gif',
    'mp3',
    'ogg',
    'opus',
    'aac',
    'm4a',
    'mp4',
    'webm',
  ]);

  if (LOSSLESS.has(to)) {
    return LOSSY.has(from)
      ? `Converting to ${to.toUpperCase()} is lossless, but it cannot restore detail that the original ${from.toUpperCase()} file already discarded. The result matches the source exactly as it is.`
      : `Both formats store data losslessly, so the conversion preserves the original quality exactly.`;
  }

  return `${to.toUpperCase()} uses lossy compression, so some data is discarded to keep the file small. The default quality setting is tuned to be visually or audibly transparent for most material, and you can raise it in the conversion settings.`;
}
