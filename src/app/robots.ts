import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/seo';

/**
 * Crawl rules.
 *
 * Every page is a public tool page, so only the machine-only API surface is
 * disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: new URL('/sitemap.xml', SITE.url).toString(),
    host: SITE.url,
  };
}
