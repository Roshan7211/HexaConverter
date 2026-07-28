import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/seo';

/**
 * Crawl rules.
 *
 * Only machine-only and authenticated routes are disallowed. The auth pages are
 * deliberately *not* listed: they already carry `noindex` in their metadata, and
 * a crawler that is forbidden from fetching a page can never read the noindex on
 * it — so disallowing them would leave a URL that can be indexed from inbound
 * links but never de-indexed. Blocking and noindex are alternatives, not a pair.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/'],
      },
    ],
    sitemap: new URL('/sitemap.xml', SITE.url).toString(),
    host: SITE.url,
  };
}
