import Link from 'next/link';

import {
  ArrowRight,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import {
  CATEGORY_META,
  CONVERSION_ROUTES,
  formatsByCategory,
} from '@/services/conversion/registry';
import { CATEGORIES, type Category } from '@/types/conversion';

const ICONS: Record<Category, typeof FileImage> = {
  image: FileImage,
  document: FileText,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
};

function routeCount(category: Category): number {
  const ids = new Set(formatsByCategory(category).map((format) => format.id));
  return CONVERSION_ROUTES.filter((route) => ids.has(route.from)).length;
}

export function CategoryGrid() {
  return (
    <section
      className="container py-16 sm:py-20"
      aria-labelledby="categories-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="categories-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Five converters, one platform
        </h2>
        <p className="mt-4 text-pretty text-muted-foreground">
          Each converter uses the encoder best suited to the format — libvips
          for images, ffmpeg for media, LibreOffice for office documents.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const Icon = ICONS[category];
          const meta = CATEGORY_META[category];
          const formats = formatsByCategory(category);

          return (
            <Card
              key={category}
              className="group relative overflow-hidden transition-all hover:border-primary/40 hover:shadow-md"
            >
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary transition-transform group-hover:scale-105">
                  <Icon className="size-5" aria-hidden="true" />
                </span>

                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">
                    <Link
                      href={`/convert/${category}`}
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                    >
                      {meta.label}
                    </Link>
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {meta.blurb}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                  {formats.slice(0, 6).map((format) => (
                    <span
                      key={format.id}
                      className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground"
                    >
                      {format.id}
                    </span>
                  ))}
                </div>

                <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  {routeCount(category)} conversions
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
