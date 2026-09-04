import { NextResponse } from 'next/server';

/**
 * Chrome's Private Prefetch Proxy opt-in, served at `/.well-known/traffic-advice`
 * by the rewrite in `next.config.mjs`.
 *
 * When someone opens a search result, Chrome can prefetch the page through a
 * Google-operated proxy so it is already warm when they click. The proxy asks
 * for this document first and treats a 404 as "no opinion", which is what this
 * origin returned — Google's prefetch proxy requested it five times in the last
 * fortnight and was declined each time. Saying yes explicitly means search
 * visitors get the page from a prefetch rather than a cold navigation.
 *
 * `fraction: 1.0` accepts prefetching for all eligible traffic. The pages are
 * cheap to render and carry no per-visitor content above the header, so there
 * is nothing here that would be wrong to fetch ahead of a click.
 *
 * It lives under `/api` because the content type is the load-bearing part —
 * Chrome ignores the document unless it arrives as `application/trafficadvice+json`,
 * which a file in `public/` with no extension cannot be given.
 */
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(
    [
      {
        user_agent: 'prefetch-proxy',
        google_prefetch_proxy_eap: { fraction: 1.0 },
      },
    ],
    {
      headers: {
        'Content-Type': 'application/trafficadvice+json',
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
