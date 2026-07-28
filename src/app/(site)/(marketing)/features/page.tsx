import type { Metadata } from 'next';
import Link from 'next/link';

import { FeatureList } from '@/components/marketing/feature-list';
import { Badge } from '@/components/ui/badge';
import {
  CONVERSION_ROUTES,
  FORMATS,
  formatsByCategory,
  routeSlug,
  TOTAL_ROUTES,
} from '@/services/conversion/registry';
import { CATEGORIES } from '@/types/conversion';
import { CATEGORY_META } from '@/services/conversion/registry';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Features and supported formats',
  description: `Every format and conversion HexaConverter supports — ${TOTAL_ROUTES} routes across images, documents, audio, video and archives, with the encoding controls available for each.`,
  path: '/features',
  keywords: ['supported file formats', 'conversion features', 'format list'],
});

export default function FeaturesPage() {
  return (
    <>
      <section className="surface-gradient border-b">
        <div className="container py-16 text-center sm:py-20">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything HexaConverter can do
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            {Object.keys(FORMATS).length} formats and {TOTAL_ROUTES} conversion
            routes, handled by the encoder best suited to each job.
          </p>
        </div>
      </section>

      <FeatureList />

      <section
        className="border-t bg-card/40 py-16"
        aria-labelledby="formats-heading"
      >
        <div className="container">
          <h2
            id="formats-heading"
            className="text-center text-3xl font-semibold tracking-tight"
          >
            Supported formats
          </h2>

          <div className="mt-12 space-y-10">
            {CATEGORIES.map((category) => {
              const formats = formatsByCategory(category);
              const ids = new Set(formats.map((format) => format.id));
              const routes = CONVERSION_ROUTES.filter((route) =>
                ids.has(route.from),
              );

              return (
                <div key={category}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-xl font-semibold tracking-tight">
                      <Link
                        href={`/convert/${category}`}
                        className="hover:text-primary"
                      >
                        {CATEGORY_META[category].label}
                      </Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {routes.length} conversions
                    </p>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[36rem] border-collapse text-sm">
                      <caption className="sr-only">
                        {CATEGORY_META[category].label} formats and their
                        capabilities
                      </caption>
                      <thead>
                        <tr className="border-b text-left">
                          <th scope="col" className="py-2 font-medium">
                            Format
                          </th>
                          <th scope="col" className="py-2 font-medium">
                            Description
                          </th>
                          <th scope="col" className="py-2 font-medium">
                            Input
                          </th>
                          <th scope="col" className="py-2 font-medium">
                            Output
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {formats.map((format) => (
                          <tr
                            key={format.id}
                            className="border-b last:border-0"
                          >
                            <th
                              scope="row"
                              className="py-2.5 text-left font-normal"
                            >
                              <Badge
                                variant="outline"
                                className="font-mono uppercase"
                              >
                                {format.id}
                              </Badge>
                            </th>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {format.description}
                            </td>
                            <td className="py-2.5">
                              {format.canInput ? 'Yes' : '—'}
                            </td>
                            <td className="py-2.5">
                              {format.canOutput ? 'Yes' : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {routes.slice(0, 24).map((route) => (
                      <li key={routeSlug(route)}>
                        <Link
                          href={`/tools/${routeSlug(route)}`}
                          className="inline-block rounded border bg-card px-2 py-1 font-mono text-[11px] uppercase text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          {route.from}→{route.to}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
