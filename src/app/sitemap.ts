import type { MetadataRoute } from 'next';

import { GUIDES } from '@/content/guides';
import { PUBLISHED_ROUTES, routeSlug } from '@/services/conversion/registry';
import { ARCHIVE_OPERATION_SPECS } from '@/types/archives';
import { PDF_OPERATION_SPECS } from '@/types/documents';
import { CATEGORIES } from '@/types/conversion';
import { SITE } from '@/lib/seo';

/**
 * Sitemap covering every indexable route, including one entry per conversion
 * landing page. API routes are deliberately excluded.
 */

export const revalidate = 86400;

/**
 * When the generated pages' content was last materially revised.
 *
 * This is a hand-maintained constant, and it has to be: `lastmod` is supposed
 * to describe the *content*, and the generated routes have no per-page date of
 * their own the way a guide does.
 *
 * It replaces a `new Date()` call. Combined with `revalidate = 86400` that made
 * every one of the 288 URLs claim it had been modified today, refreshed every
 * 24 hours, forever — so a crawler comparing two fetches a week apart saw 288
 * pages all rewritten twice, and none of it true. Google's documented response
 * to a `lastmod` it cannot corroborate is to ignore the field across the whole
 * sitemap, which spends a real ranking signal on noise. A date that only moves
 * when the content moves is worth something; a date that always says "now" is
 * worth less than nothing.
 *
 * Bump this when the pair prose, format profiles, conversion notes or category
 * copy change materially — not for styling, refactors or dependency bumps.
 * `2026-08-22` is when the per-pair prose landed, alongside the guides.
 */
const CONTENT_REVISED = new Date('2026-08-22T00:00:00.000Z');

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE.url).toString();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: url('/'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: url('/features'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: url('/guides'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: url('/faq'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: url('/about'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: url('/contact'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: url('/legal/privacy'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/terms'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/cookies'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/refunds'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/attributions'),
      lastModified: CONTENT_REVISED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: url(`/guides/${guide.slug}`),
    lastModified: new Date(guide.updated ?? guide.published),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((category) => ({
    url: url(`/convert/${category}`),
    lastModified: CONTENT_REVISED,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  const toolRoutes: MetadataRoute.Sitemap = PUBLISHED_ROUTES.map((route) => ({
    url: url(`/tools/${routeSlug(route)}`),
    lastModified: CONTENT_REVISED,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const pdfToolRoutes: MetadataRoute.Sitemap = Object.values(
    PDF_OPERATION_SPECS,
  ).map((spec) => ({
    url: url(`/tools/pdf/${spec.slug}`),
    lastModified: CONTENT_REVISED,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const archiveToolRoutes: MetadataRoute.Sitemap = Object.values(
    ARCHIVE_OPERATION_SPECS,
  ).map((spec) => ({
    url: url(`/tools/archive/${spec.slug}`),
    lastModified: CONTENT_REVISED,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [
    ...staticRoutes,
    ...guideRoutes,
    ...categoryRoutes,
    ...pdfToolRoutes,
    ...archiveToolRoutes,
    ...toolRoutes,
  ];
}
