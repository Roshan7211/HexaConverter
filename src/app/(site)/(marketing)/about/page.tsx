import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { TOTAL_ROUTES } from '@/services/conversion/registry';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'About',
  description:
    'Why HexaConverter exists, how it handles your files, and the engineering principles behind the platform.',
  path: '/about',
});

const PRINCIPLES = [
  {
    title: 'Delete by default',
    body: 'Source files are removed the moment a conversion finishes and outputs expire on a schedule. Retention is a property of the system, not a promise in a policy document.',
  },
  {
    title: 'Say what actually happened',
    body: 'When a conversion fails, the message explains why — a password-protected document, an unsupported codec, a corrupt archive. No silent retries that quietly produce the wrong file.',
  },
  {
    title: 'Use the right encoder',
    body: 'libvips for images, ffmpeg for media, LibreOffice for office documents, Poppler for PDF rendering. Mature tools, sensible defaults, and controls when defaults are not enough.',
  },
  {
    title: 'No dark patterns',
    body: 'No watermarks on free output, no artificial waiting screens, no upsell interstitial between you and your file.',
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="surface-gradient border-b">
        <div className="container py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              File conversion without the friction
            </h1>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              Most online converters make you trade privacy, quality or patience
              for convenience. HexaConverter was built to avoid all three
              trades: real encoders on the server, honest limits, and files that
              disappear when the job is done.
            </p>
          </div>
        </div>
      </section>

      <section className="container py-16" aria-labelledby="principles-heading">
        <h2
          id="principles-heading"
          className="text-center text-3xl font-semibold tracking-tight"
        >
          How we build it
        </h2>

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <Card key={principle.title}>
              <CardContent className="p-6">
                <h3 className="font-semibold tracking-tight">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {principle.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y bg-card/40 py-16">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            What runs underneath
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Uploads stream directly into object storage and are identified by
            their magic bytes before anything else happens. A conversion becomes
            a queued job in PostgreSQL, claimed atomically by a worker so the
            same file is never processed twice, and progress is reported from
            the encoder itself rather than estimated. {TOTAL_ROUTES} conversion
            routes are declared in one registry that drives the interface, the
            API and the validation layer alike — so an unsupported combination
            cannot be requested through any surface.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Read the{' '}
            <Link
              href="/legal/privacy"
              className="text-primary underline-offset-4 hover:underline"
            >
              privacy policy
            </Link>{' '}
            for exactly what is stored and for how long, or the{' '}
            <Link
              href="/faq"
              className="text-primary underline-offset-4 hover:underline"
            >
              FAQ
            </Link>{' '}
            for the practical details.
          </p>
        </div>
      </section>
    </>
  );
}
