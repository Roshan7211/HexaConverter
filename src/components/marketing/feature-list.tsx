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

const FEATURES = [
  {
    icon: Cpu,
    title: 'Professional encoders',
    body: 'libvips for images, ffmpeg for audio and video, LibreOffice for office documents and Poppler for PDF rendering — the same tools used in production pipelines.',
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
    body: 'EXIF data, including GPS coordinates and camera serial numbers, is removed from images by default.',
  },
  {
    icon: Layers,
    title: 'Batch processing',
    body: 'Queue multiple files with one output format and settings. Progress is reported per file.',
  },
  {
    icon: Gauge,
    title: 'Encoding controls',
    body: 'Quality, resolution, bitrate, sample rate, frame rate, DPI and compression level — tuned defaults, adjustable when it matters.',
  },
  {
    icon: FileCheck2,
    title: 'Signed downloads',
    body: 'Download links are short-lived and cryptographically bound to a single conversion, so they cannot be guessed or reused.',
  },
  {
    icon: Server,
    title: 'Runs anywhere',
    body: 'One container, a PostgreSQL database and any S3-compatible bucket. Deploy on your own infrastructure if you prefer.',
  },
  {
    icon: Clock,
    title: 'Live progress',
    body: 'Conversions report real encoder progress, not a fake spinner, and long jobs can be cancelled mid-run.',
  },
] as const;

export function FeatureList() {
  return (
    <section
      className="container py-16 sm:py-20"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="features-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Built to be dependable
        </h2>
        <p className="mt-4 text-pretty text-muted-foreground">
          The details that decide whether a conversion tool is usable at work.
        </p>
      </div>

      <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
              <feature.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold tracking-tight">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
