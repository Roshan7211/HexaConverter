import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { GUIDES } from '@/content/guides';
import { readingMinutes } from '@/content/guides/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { breadcrumbSchema, buildMetadata } from '@/lib/seo';
import { CATEGORY_META } from '@/services/conversion/registry';

export const metadata: Metadata = buildMetadata({
  title: 'Guides',
  description:
    'Plain explanations of what actually happens to a file when you convert it — why formats behave the way they do, and how to choose between them.',
  path: '/guides',
  keywords: [
    'file format guides',
    'image format comparison',
    'video codec explained',
    'csv excel problems',
  ],
});

export default function GuidesIndexPage() {
  return (
    <>
      <section className="surface-gradient border-b">
        <div className="container py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Guides
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Why a PNG is ten times the size of a JPEG. What a container is,
              and why it is not a video format. Where your spreadsheet&rsquo;s
              leading zeros went. Written to be useful whether or not you
              convert anything afterwards.
            </p>
          </div>
        </div>
      </section>

      <div className="container py-14">
        <ul className="mx-auto grid max-w-4xl gap-5">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Card className="relative transition-colors hover:border-primary/40">
                <CardContent className="p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {CATEGORY_META[guide.topic].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {readingMinutes(guide)} min read
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-semibold tracking-tight">
                    <Link
                      href={`/guides/${guide.slug}`}
                      className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none"
                    >
                      {guide.title}
                    </Link>
                  </h2>

                  <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
                    {guide.description}
                  </p>

                  <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                    Read the guide
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Guides', path: '/guides' },
            ]),
          ),
        }}
      />
    </>
  );
}
