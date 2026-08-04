import Link from 'next/link';

import { Check, Minus, Sparkles } from 'lucide-react';

import { Reveal, RevealGroup, RevealItem } from '@/components/marketing/reveal';
import { Badge } from '@/components/ui/badge';
import { PLANS } from '@/lib/plans';
import { TOTAL_ROUTES } from '@/services/conversion/registry';
import { formatBytes } from '@/utils';

/**
 * Why Choose Us.
 *
 * The comparison column is deliberately labelled "typical free converters"
 * rather than naming competitors: the claims describe common industry practice
 * we can stand behind, not assertions about a specific named product we would
 * have to prove.
 */

const DIFFERENTIATORS = [
  {
    stat: `${TOTAL_ROUTES}`,
    label: 'conversion routes',
    body: 'Across images, documents, spreadsheets, presentations, audio, video and archives — every one declared in a single registry that also drives our validation.',
  },
  {
    stat: '0',
    label: 'watermarks, ever',
    body: 'Output contains exactly what the encoder produced. No branding, no overlays, no injected metadata.',
  },
  {
    stat: `${PLANS.PREMIUM.retentionHours}h`,
    label: 'file retention',
    body: `Source files are deleted the moment a conversion finishes. Outputs are purged automatically — after ${PLANS.ANONYMOUS.retentionHours} hour without an account, up to ${PLANS.PREMIUM.retentionHours} hours on Premium — or sooner if you delete them yourself.`,
  },
  {
    stat: `${formatBytes(PLANS.ANONYMOUS.maxFileBytes, 0)}`,
    label: 'per file, no account',
    body: `Convert immediately, no signup wall. A free account raises it to ${formatBytes(PLANS.FREE.maxFileBytes, 0)} and removes the ads.`,
  },
] as const;

const COMPARISON = [
  { claim: 'No watermark on output', us: true, them: false },
  {
    claim: 'Files deleted on a schedule, not "eventually"',
    us: true,
    them: false,
  },
  { claim: 'EXIF and GPS stripped by default', us: true, them: false },
  { claim: 'Real encoder settings exposed', us: true, them: false },
  { claim: 'Live progress from the encoder itself', us: true, them: false },
  { claim: 'Honest error messages when a file fails', us: true, them: false },
  { claim: 'Ad-free with a free account', us: true, them: false },
  { claim: 'Self-hostable on your own infrastructure', us: true, them: false },
] as const;

export function WhyChooseUs() {
  return (
    <section
      id="why-us"
      className="container py-20 sm:py-28"
      aria-labelledby="why-us-heading"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mb-4">
          Why HexaConverter
        </Badge>
        <h2
          id="why-us-heading"
          className="text-3xl font-semibold sm:text-4xl lg:text-5xl"
        >
          Everything free converters get wrong
        </h2>
        <p className="mt-4 text-pretty text-muted-foreground">
          Most online converters trade your privacy, your quality or your
          patience for convenience. This one was built to avoid all three.
        </p>
      </Reveal>

      <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {DIFFERENTIATORS.map((item) => (
          <RevealItem
            key={item.label}
            className="glass gradient-ring rounded-2xl p-6"
          >
            <p className="tabular bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-deep))] bg-clip-text text-4xl font-semibold text-transparent">
              {item.stat}
            </p>
            <p className="mt-1 text-sm font-semibold">{item.label}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {item.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mx-auto mt-16 max-w-3xl">
        <div className="glass-panel gradient-ring overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b bg-muted/30 px-6 py-4 text-xs font-semibold uppercase tracking-wide sm:gap-x-8">
            <span className="text-muted-foreground">What you get</span>
            <span className="flex items-center gap-1.5 text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Us
            </span>
            <span className="text-right text-muted-foreground">Typical</span>
          </div>

          <ul>
            {COMPARISON.map((row) => (
              <li
                key={row.claim}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b px-6 py-3.5 text-sm last:border-0 sm:gap-x-8"
              >
                <span>{row.claim}</span>
                <span className="flex justify-center">
                  <Check
                    className="size-4 text-success"
                    aria-label="Included"
                  />
                </span>
                <span className="flex justify-end">
                  <Minus
                    className="size-4 text-muted-foreground/60"
                    aria-label="Not included"
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          &ldquo;Typical&rdquo; describes common practice among free online
          converters, not any single named product. Verify ours on the{' '}
          <Link
            href="/legal/privacy"
            className="text-primary underline-offset-4 hover:underline"
          >
            privacy policy
          </Link>{' '}
          and{' '}
          <Link
            href="/faq"
            className="text-primary underline-offset-4 hover:underline"
          >
            FAQ
          </Link>
          .
        </p>
      </Reveal>
    </section>
  );
}
