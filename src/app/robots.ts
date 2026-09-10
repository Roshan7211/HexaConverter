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
        allow: [
          '/',
          // `/api` is machine-only and blanket-disallowed below, with one
          // deliberate exception: the capability document the homepage links to
          // as a checkable trust signal. It already carries
          // `X-Robots-Tag: noindex` from next.config.mjs, and the two rules
          // contradicted each other — robots.txt winning in the worst way,
          // because a URL Google may not fetch is a URL whose headers Google
          // never reads. The `noindex` expressing the actual intent (crawlable,
          // not indexable) was therefore unreachable, and Search Console
          // reported the URL as "Blocked by robots.txt" instead. Google
          // resolves conflicting rules by specificity, so this wins over the
          // `/api/` disallow for this one path.
          '/api/formats',
        ],
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
