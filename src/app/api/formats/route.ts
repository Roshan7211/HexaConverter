import { NextResponse } from 'next/server';

import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { isRequirementAvailable } from '@/services/conversion/binaries';
import { CONVERSION_ROUTES, FORMATS } from '@/services/conversion/registry';
import { CATEGORIES, type Requirement } from '@/types/conversion';

/**
 * GET /api/formats
 *
 * Public capability document: every format and every route this deployment can
 * actually run. Routes that depend on an external tool are marked unavailable
 * when the probe fails, so clients never offer a conversion that would fail.
 */

export const runtime = 'nodejs';
// Must be evaluated at runtime: the availability probes describe the machine
// serving the request, which is not the machine that ran the build. Edge
// caching is still applied through the response headers below.
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('GET /api/formats', async (request) => {
  const limited = enforceRateLimit('read', request);
  if (limited) return limited;

  const requirements: Record<Requirement, boolean> = {
    libreoffice: await isRequirementAvailable('libreoffice'),
    poppler: await isRequirementAvailable('poppler'),
    // Optional everywhere: PDF compression degrades gracefully without it.
    ghostscript: await isRequirementAvailable('ghostscript'),
  };

  const routes = CONVERSION_ROUTES.map((route) => ({
    from: route.from,
    to: route.to,
    available: route.requires ? requirements[route.requires] : true,
  }));

  return NextResponse.json(
    {
      categories: CATEGORIES,
      formats: Object.values(FORMATS).map((format) => ({
        id: format.id,
        label: format.label,
        mime: format.mime,
        category: format.category,
        canInput: format.canInput,
        canOutput: format.canOutput,
      })),
      routes,
      counts: {
        formats: Object.keys(FORMATS).length,
        routes: routes.length,
        available: routes.filter((route) => route.available).length,
      },
    },
    {
      headers: {
        // Safe to cache at the edge: the payload changes only on deploy.
        'Cache-Control':
          'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
});
