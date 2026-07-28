import Link from 'next/link';

import {
  ArrowRight,
  Clock,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

import { FormatMarquee } from '@/components/marketing/format-marquee';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FORMATS, TOTAL_ROUTES } from '@/services/conversion/registry';

/**
 * Landing hero.
 *
 * A pure server component with no client JavaScript at all. The hero contains
 * the largest contentful paint element, so it deliberately opts out of the
 * scroll-reveal treatment used below the fold — this content must be painted,
 * not animated in.
 */

const PROOF_POINTS = [
  {
    icon: Zap,
    label: 'Professional encoders',
    detail: 'libvips, ffmpeg and LibreOffice',
  },
  {
    icon: ShieldCheck,
    label: 'Private by default',
    detail: 'Metadata stripped, files auto-deleted',
  },
  {
    icon: Clock,
    label: 'Batch conversions',
    detail: 'Queue several files at once',
  },
] as const;

export function Hero() {
  const formatCount = Object.keys(FORMATS).length;

  return (
    <section className="relative overflow-hidden border-b">
      {/* Ambient colour field. Decorative, so hidden from assistive tech. */}
      <div className="aurora" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-grid-pattern bg-[size:44px_44px] opacity-[0.3] [mask-image:radial-gradient(48rem_28rem_at_50%_0%,black,transparent)]"
        aria-hidden="true"
      />

      <div className="container relative py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            className="glass mb-7 gap-1.5 px-3.5 py-1.5 text-xs font-medium"
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {TOTAL_ROUTES} conversions across {formatCount} formats
          </Badge>

          <h1 className="text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
            Convert any file in{' '}
            <span className="relative whitespace-nowrap">
              <span className="bg-gradient-to-br from-[hsl(var(--brand-amber))] via-[hsl(var(--brand))] to-[hsl(var(--brand-deep))] bg-clip-text text-transparent">
                seconds
              </span>
              {/* Hand-drawn underline, purely decorative. */}
              <svg
                className="absolute -bottom-2 left-0 w-full text-primary/35"
                viewBox="0 0 200 10"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 7.5C40 3 90 2 198 5.5"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Documents, images, video, audio and archives — converted on our
            servers with professional encoders, then deleted automatically. No
            watermarks, no software to install.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="group w-full sm:w-auto">
              <Link href="/convert/image">
                Start converting free
                <ArrowRight
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="glass w-full sm:w-auto"
            >
              <Link href="#how-it-works">
                <Play aria-hidden="true" />
                See how it works
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No account required · No credit card · No watermark
          </p>
        </div>

        <dl className="glass-panel gradient-ring mx-auto mt-16 grid max-w-4xl overflow-hidden sm:grid-cols-3">
          {PROOF_POINTS.map((point) => (
            <div
              key={point.label}
              className="flex flex-col items-center gap-2 px-6 py-7 text-center"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <point.icon className="size-5" aria-hidden="true" />
              </span>
              <dt className="text-sm font-semibold">{point.label}</dt>
              <dd className="text-xs text-muted-foreground">{point.detail}</dd>
            </div>
          ))}
        </dl>
      </div>

      <FormatMarquee />
    </section>
  );
}
