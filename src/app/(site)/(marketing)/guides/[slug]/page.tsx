import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GUIDES, guideBySlug } from '@/content/guides';
import { readingMinutes } from '@/content/guides/types';
import {
  GuideParagraphs,
  GuideSectionBlock,
} from '@/components/marketing/guide-body';
import { FaqSection } from '@/components/marketing/faq-section';
import { AdSlot } from '@/components/ads/ad-slot';
import { Badge } from '@/components/ui/badge';
import {
  articleSchema,
  breadcrumbSchema,
  buildMetadata,
  faqSchema,
} from '@/lib/seo';
import {
  CATEGORY_META,
  getFormat,
  parseRouteSlug,
} from '@/services/conversion/registry';

/**
 * A single guide.
 *
 * Prerendered in full at build time from the content module, so the entire
 * article is in the HTML a crawler receives — none of it arrives after
 * hydration, and none of it depends on a request.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return {};

  return buildMetadata({
    title: guide.metaTitle,
    description: guide.description,
    path: `/guides/${guide.slug}`,
    type: 'article',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  // Only routes that genuinely exist are linked. A guide naming a conversion
  // we do not offer would otherwise put a 404 at the end of the article.
  const related = guide.related
    .map((route) => ({ slug: route, parsed: parseRouteSlug(route) }))
    .filter((entry) => entry.parsed !== null)
    .map(({ slug: route, parsed }) => ({
      slug: route,
      from: getFormat(parsed!.from)!,
      to: getFormat(parsed!.to)!,
    }));

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
                <Link href="/guides" className="hover:text-foreground">
                  Guides
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{guide.title}</li>
            </ol>
          </nav>

          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {CATEGORY_META[guide.topic].label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {readingMinutes(guide)} min read
              </span>
            </div>

            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {guide.title}
            </h1>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              {guide.description}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              <time dateTime={guide.updated ?? guide.published}>
                {guide.updated
                  ? `Updated ${formatDate(guide.updated)}`
                  : `Published ${formatDate(guide.published)}`}
              </time>
            </p>
          </div>
        </div>
      </div>

      <article className="container py-12">
        <div className="mx-auto max-w-3xl">
          <GuideParagraphs body={guide.intro} />

          {guide.sections.map((section, index) => (
            <GuideSectionBlock
              key={section.heading}
              section={section}
              id={`section-${index}`}
            />
          ))}

          {/* Placed after the article rather than inside it: someone who has
              read this far has finished what they came for. Same column width
              as the prose so a wide creative cannot break the measure. */}
          <AdSlot
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_INLINE}
            label="Advertisement"
            className="mt-14 h-[250px] lg:h-[90px]"
            sizeClassName="h-[250px] w-[250px] shrink-0 min-[360px]:w-[300px] lg:h-[90px] lg:w-[728px]"
          />

          {related.length > 0 ? (
            <div className="mt-14 rounded-xl border bg-card/40 p-6">
              <h2 className="text-sm font-semibold tracking-tight">
                Conversions covered in this guide
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {related.map((route) => (
                  <li key={route.slug}>
                    <Link
                      href={`/tools/${route.slug}`}
                      className="inline-block rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {route.from.label} to {route.to.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </article>

      {guide.faq && guide.faq.length > 0 ? (
        <div className="border-t bg-card/40">
          <FaqSection entries={guide.faq} heading="Common questions" />
        </div>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Guides', path: '/guides' },
              { name: guide.title, path: `/guides/${guide.slug}` },
            ]),
            articleSchema({
              headline: guide.title,
              description: guide.description,
              path: `/guides/${guide.slug}`,
              datePublished: guide.published,
              dateModified: guide.updated,
            }),
            ...(guide.faq && guide.faq.length > 0
              ? [faqSchema([...guide.faq])]
              : []),
          ]),
        }}
      />
    </>
  );
}
