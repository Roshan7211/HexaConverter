import Link from 'next/link';

import {
  Boxes,
  FileCheck2,
  GitBranch,
  Lock,
  Server,
  Timer,
} from 'lucide-react';

import { Reveal, RevealGroup, RevealItem } from '@/components/marketing/reveal';
import { Badge } from '@/components/ui/badge';
import { LIMITS } from '@/lib/plans';
import { FORMATS, TOTAL_ROUTES } from '@/services/conversion/registry';

/**
 * Verifiable trust signals.
 *
 * Shown in place of testimonials until real customer quotes exist. Every claim
 * here is checkable against the running service or the source — which is worth
 * more to a first-time visitor than a wall of anonymous five-star cards.
 */

const SIGNALS = [
  {
    icon: Boxes,
    title: 'Every route is declared, not implied',
    body: 'One registry defines each supported conversion. The picker, the API and the validator all read from it, so the platform cannot advertise something it will not do.',
    proof: { label: 'Inspect /api/formats', href: '/api/formats' },
  },
  {
    icon: Lock,
    title: 'Uploads are verified byte-by-byte',
    body: 'Files are identified by their magic number and matched against the declared extension before a single byte is stored. Rename a PNG to .pdf and the upload is refused.',
    proof: { label: 'How we handle files', href: '/faq' },
  },
  {
    icon: Timer,
    title: 'Deletion is scheduled, not promised',
    body: `Source files go the moment a conversion finishes. Outputs are purged by a cron job after ${LIMITS.retentionHours} hours — the same for everyone.`,
    proof: { label: 'Read the retention table', href: '/legal/privacy' },
  },
  {
    icon: Server,
    title: 'Live service status',
    body: 'A public health endpoint reports database, storage and conversion-tooling availability. Nothing is hidden behind a status page you cannot query.',
    proof: { label: 'Check /api/health', href: '/api/health' },
  },
  {
    icon: FileCheck2,
    title: 'No watermark, no upsell wall',
    body: 'Every conversion produces exactly what the encoder emitted. There is no degraded output, no queue penalty and no interstitial between you and your file.',
    proof: { label: 'See what is supported', href: '/features' },
  },
  {
    icon: GitBranch,
    title: 'Self-hostable',
    body: 'One container, PostgreSQL and any S3-compatible bucket. If you would rather not send files to someone else at all, run the whole platform yourself.',
    proof: { label: 'Deployment guide', href: '/about' },
  },
] as const;

export function TrustSignals() {
  const formatCount = Object.keys(FORMATS).length;

  return (
    <section
      id="trust"
      className="relative overflow-hidden border-y bg-muted/20 py-20 sm:py-28"
      aria-labelledby="trust-heading"
    >
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="accent" className="mb-4">
            Why you can trust it
          </Badge>
          <h2
            id="trust-heading"
            className="text-3xl font-semibold sm:text-4xl lg:text-5xl"
          >
            Claims you can check yourself
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            HexaConverter is new, so there are no customer quotes here yet — we
            would rather show you {TOTAL_ROUTES} verifiable conversions across{' '}
            {formatCount} formats than testimonials you have no way to confirm.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNALS.map((signal) => (
            <RevealItem
              key={signal.title}
              as="article"
              className="glass gradient-ring flex flex-col rounded-2xl p-6"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <signal.icon className="size-5" aria-hidden="true" />
              </span>

              <h3 className="mt-5 text-base font-semibold">{signal.title}</h3>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {signal.body}
              </p>

              <Link
                href={signal.proof.href}
                className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {signal.proof.label} &rarr;
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
