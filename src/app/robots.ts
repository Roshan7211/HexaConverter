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
        // `_rsc` URLs are Next's client-side prefetch payloads. They leak into
        // the crawlable link graph and were taking 73% of Googlebot's requests
        // here — 2,960 of 4,059 — each returning a full copy of a page it had
        // already fetched under the clean URL. They canonicalise correctly, so
        // nothing was mis-indexed; the cost is crawl budget, which a new domain
        // has very little of. Blocked now, while nothing is indexed yet: once a
        // blocked URL is in the index, Google can no longer crawl it to see the
        // canonical that would have removed it.
        disallow: ['/api/', '/*_rsc='],
      },
    ],
    sitemap: new URL('/sitemap.xml', SITE.url).toString(),
    host: SITE.url,
  };
}
