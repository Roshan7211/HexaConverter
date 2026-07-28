import {
  Clock,
  Cpu,
  FileCheck2,
  Gauge,
  Layers,
  Lock,
  ScanSearch,
  Server,
  Trash2,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

import { Reveal, RevealGroup, RevealItem } from '@/components/marketing/reveal';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils';

/**
 * Features grid.
 *
 * The first card spans two columns on large screens to break the grid rhythm —
 * a uniform 3x3 of identical cards reads as filler, whereas one emphasised
 * card establishes what matters most.
 */

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Spans two columns on large screens to break the grid rhythm. */
  featured?: boolean;
}

const FEATURES: readonly Feature[] = [
  {
    icon: Cpu,
    title: 'Professional encoders, not a wrapper',
    body: 'libvips for images, ffmpeg for audio and video, LibreOffice for office documents and Poppler for PDF rendering — the same tools that run in production media pipelines, with their real settings exposed.',
    featured: true,
  },
  {
    icon: ScanSearch,
    title: 'Content verification',
    body: 'Every upload is identified by its magic bytes and checked against its extension, so a renamed or malformed file is rejected before it reaches an encoder.',
  },
  {
    icon: Trash2,
    title: 'Automatic deletion',
    body: 'Source files are removed the moment a conversion finishes and outputs are purged on a schedule. Nothing lingers.',
  },
  {
    icon: Lock,
    title: 'Metadata stripping',
    body: 'EXIF data — including GPS coordinates and camera serial numbers — is removed from images by default. Keep it with one switch when you need it.',
  },
  {
    icon: Layers,
    title: 'Batch processing',
    body: 'Queue multiple files with one output format and settings. Each reports its own progress and can be cancelled independently.',
  },
  {
    icon: Gauge,
    title: 'Real encoding controls',
    body: 'Quality, resolution, bitrate, sample rate, frame rate, DPI and compression level — tuned defaults, adjustable the moment they matter.',
  },
  {
    icon: FileCheck2,
    title: 'Signed downloads',
    body: 'Links are short-lived and cryptographically bound to a single conversion, so they cannot be guessed, enumerated or replayed.',
  },
  {
    icon: Clock,
    title: 'Live progress',
    body: 'Conversions report real encoder progress, not a fake spinner, and long jobs can be stopped mid-run.',
  },
  {
    icon: Server,
    title: 'Runs anywhere',
    body: 'One container, a PostgreSQL database and any S3-compatible bucket. Self-host it on your own infrastructure if you prefer.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="container py-20 sm:py-28"
      aria-labelledby="features-heading"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mb-4">
          Features
        </Badge>
        <h2
          id="features-heading"
          className="text-3xl font-semibold sm:text-4xl lg:text-5xl"
        >
          Built to be dependable
        </h2>
        <p className="mt-4 text-pretty text-muted-foreground">
          The details that decide whether a conversion tool is usable at work,
          rather than something you fight for ten minutes and abandon.
        </p>
      </Reveal>

      <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <RevealItem
            key={feature.title}
            as="article"
            className={cn(
              'glass gradient-ring group relative rounded-2xl p-6 transition-shadow hover:shadow-xl hover:shadow-primary/5',
              feature.featured && 'lg:col-span-2',
            )}
          >
            <span
              className={cn(
                'flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105',
                feature.featured && 'bg-primary text-primary-foreground',
              )}
            >
              <feature.icon className="size-5" aria-hidden="true" />
            </span>

            <h3
              className={cn(
                'mt-5 font-semibold',
                feature.featured ? 'text-xl' : 'text-base',
              )}
            >
              {feature.title}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {feature.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
