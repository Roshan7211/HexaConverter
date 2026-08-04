import type { Metadata } from 'next';
import Link from 'next/link';

import { Check, Minus } from 'lucide-react';

import { CheckoutButton } from '@/components/pricing/checkout-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { currentUser } from '@/lib/firebase/session';
import { isPaddleConfigured } from '@/lib/paddle';
import { PLANS, PREMIUM_PRICE_PENCE } from '@/lib/plans';
import { buildMetadata } from '@/lib/seo';
import { cn, formatBytes } from '@/utils';

export const metadata: Metadata = buildMetadata({
  title: 'Pricing',
  description:
    'Convert files free without an account. A free account raises every limit and adds conversion history. Premium is £9.99 a year for 2 GB files, no monthly limit and no ads.',
  path: '/pricing',
});

const price = (PREMIUM_PRICE_PENCE / 100).toFixed(2);

/**
 * Every number is read from `PLANS`, never typed in.
 *
 * A pricing page that disagrees with what the server enforces is worse than no
 * pricing page: someone buys on the strength of a number and then meets a
 * refusal. Reading from the same constant the quota checks use makes that
 * impossible by construction.
 */
const TIERS = [
  {
    id: 'ANONYMOUS' as const,
    name: 'No account',
    price: 'Free',
    note: 'Nothing to sign up for',
    cta: { label: 'Start converting', href: '/convert/image' },
    highlight: false,
  },
  {
    id: 'FREE' as const,
    name: 'Free account',
    price: 'Free',
    note: 'Sign in with email or Google',
    cta: { label: 'Create an account', href: '/sign-up' },
    highlight: true,
  },
  {
    id: 'PREMIUM' as const,
    name: 'Premium',
    price: `£${price}`,
    note: 'Billed once a year',
    cta: { label: 'Coming soon', href: null },
    highlight: false,
  },
];

function rows(id: 'ANONYMOUS' | 'FREE' | 'PREMIUM') {
  const plan = PLANS[id];

  return [
    {
      label: 'Largest file',
      value: formatBytes(plan.maxFileBytes, 0),
    },
    {
      label: 'Conversions',
      value:
        id === 'PREMIUM'
          ? 'Unlimited*'
          : `${plan.jobsPerPeriod.toLocaleString()} / ${plan.periodDays === 1 ? 'day' : 'month'}`,
    },
    { label: 'Files per batch', value: String(plan.maxBatchFiles) },
    { label: 'Converting at once', value: String(plan.concurrentJobs) },
    {
      label: 'Files kept for',
      value:
        plan.retentionHours >= 24
          ? `${plan.retentionHours / 24} day${plan.retentionHours === 24 ? '' : 's'}`
          : `${plan.retentionHours} hour`,
    },
    { label: 'Ad-free', value: !plan.showsAds },
    { label: 'Conversion history', value: id !== 'ANONYMOUS' },
    { label: 'Scan to searchable text', value: id !== 'ANONYMOUS' },
    { label: 'Priority queue', value: plan.priorityQueue },
  ];
}

export default async function PricingPage() {
  const user = await currentUser();

  return (
    <div className="container py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mb-4">
          Pricing
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          Convert free. Pay only if you need more.
        </h1>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          Every conversion produces exactly what the encoder emitted, on every
          plan. There is no watermark, no degraded output and no upsell wall
          between you and your file &mdash; paying raises limits, it does not
          unlock quality.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <section
            key={tier.id}
            aria-labelledby={`plan-${tier.id}`}
            className={cn(
              'flex flex-col rounded-2xl border bg-card p-6',
              tier.highlight && 'border-primary/50 shadow-lg',
            )}
          >
            {/* The slot is always present, so the three cards' rows line up
                across columns instead of the highlighted one sitting lower. */}
            <div className="mb-3 h-6">
              {tier.highlight ? (
                <Badge variant="accent" className="w-fit">
                  Most people want this
                </Badge>
              ) : null}
            </div>

            <h2
              id={`plan-${tier.id}`}
              className="text-lg font-semibold tracking-tight"
            >
              {tier.name}
            </h2>

            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">
                {tier.price}
              </span>
              {tier.id === 'PREMIUM' ? (
                <span className="text-sm text-muted-foreground">/ year</span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{tier.note}</p>

            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {rows(tier.id).map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  {typeof row.value === 'boolean' ? (
                    row.value ? (
                      <Check
                        className="size-4 shrink-0 text-success"
                        aria-label="Included"
                      />
                    ) : (
                      <Minus
                        className="size-4 shrink-0 text-muted-foreground/60"
                        aria-label="Not included"
                      />
                    )
                  ) : (
                    <span className="font-medium">{row.value}</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {tier.cta.href ? (
                <Button
                  asChild
                  className="w-full"
                  variant={tier.highlight ? 'default' : 'outline'}
                >
                  <Link href={tier.cta.href}>
                    {tier.id === 'FREE' && user
                      ? 'You are signed in'
                      : tier.cta.label}
                  </Link>
                </Button>
              ) : (
                <CheckoutButton
                  email={user?.email ?? null}
                  enabled={isPaddleConfigured}
                />
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        *Premium has a fair-use ceiling of{' '}
        {PLANS.PREMIUM.jobsPerPeriod.toLocaleString()} conversions a month.
        Conversion is real work on real hardware, so an unbounded allowance is
        not something anyone can honestly promise &mdash; but the ceiling sits
        far above what normal use reaches. Allowances are counted over a rolling
        window &mdash; 24 hours without an account, 30 days with one &mdash; so
        they free up gradually rather than resetting on a fixed date.
      </p>

      <div className="mx-auto mt-14 max-w-2xl space-y-6 rounded-2xl border bg-card p-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            What stays the same on every plan
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              No watermark, ever. Output is exactly what the encoder made.
            </li>
            <li>
              EXIF and GPS metadata stripped by default, on free and paid alike.
            </li>
            <li>
              Source files deleted the moment a conversion finishes, not
              &ldquo;eventually&rdquo;.
            </li>
            <li>Every conversion route available, with no format held back.</li>
          </ul>
        </div>

        <div className="border-t pt-5">
          <h2 className="text-base font-semibold tracking-tight">
            Changing your mind
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Fourteen days, no questions asked. Cancelling stops the next renewal
            and never cuts you off early &mdash; see the{' '}
            <Link
              href="/legal/refunds"
              className="text-foreground underline-offset-4 hover:underline"
            >
              refund policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
