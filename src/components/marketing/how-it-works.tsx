import { CloudUpload, Download, Settings2 } from 'lucide-react';

import { Reveal, RevealGroup, RevealItem } from '@/components/marketing/reveal';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  {
    icon: CloudUpload,
    title: 'Upload your file',
    body: 'Drag a file in or pick it from your device. Uploads stream straight to storage and the contents are verified against the file signature before anything runs.',
    detail: 'Verified before a single byte is stored',
  },
  {
    icon: Settings2,
    title: 'Choose the output',
    body: 'Pick a target format and, if you want, adjust quality, resolution, bitrate or compression. Sensible defaults are already selected.',
    detail: 'Only the settings your target format honours',
  },
  {
    icon: Download,
    title: 'Download the result',
    body: 'Conversion happens on our servers with live progress. Download with a signed link, then the file is deleted on schedule.',
    detail: 'Signed link, minutes-long expiry',
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden border-y bg-muted/20 py-20 sm:py-28"
      aria-labelledby="how-it-works-heading"
    >
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="accent" className="mb-4">
            How it works
          </Badge>
          <h2
            id="how-it-works-heading"
            className="text-3xl font-semibold sm:text-4xl lg:text-5xl"
          >
            Three steps, no account needed
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            There is nothing to sign up for. Every feature and every limit is
            the same for everyone who opens the page.
          </p>
        </Reveal>

        <RevealGroup
          as="ol"
          stagger={0.12}
          className="relative mt-16 grid gap-8 md:grid-cols-3"
        >
          {/* Connecting rail behind the numbered markers, desktop only. */}
          <div
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            aria-hidden="true"
          />

          {STEPS.map((step, index) => (
            <RevealItem key={step.title} as="li" className="relative">
              <div className="flex items-center gap-3">
                <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                  {index + 1}
                </span>
                <span className="glass flex size-10 items-center justify-center rounded-xl text-primary">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
              </div>

              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
              <p className="mt-3 inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {step.detail}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
