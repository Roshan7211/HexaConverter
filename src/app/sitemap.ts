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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const url = (path: string) => new URL(path, SITE.url).toString();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: url('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: url('/features'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: url('/guides'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: url('/faq'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: url('/about'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: url('/contact'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: url('/legal/privacy'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/terms'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/cookies'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/refunds'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: url('/legal/attributions'),
      lastModified: now,
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
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  const toolRoutes: MetadataRoute.Sitemap = PUBLISHED_ROUTES.map((route) => ({
    url: url(`/tools/${routeSlug(route)}`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const pdfToolRoutes: MetadataRoute.Sitemap = Object.values(
    PDF_OPERATION_SPECS,
  ).map((spec) => ({
    url: url(`/tools/pdf/${spec.slug}`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const archiveToolRoutes: MetadataRoute.Sitemap = Object.values(
    ARCHIVE_OPERATION_SPECS,
  ).map((spec) => ({
    url: url(`/tools/archive/${spec.slug}`),
    lastModified: now,
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
