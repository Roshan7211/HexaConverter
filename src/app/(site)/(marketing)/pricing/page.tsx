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
    'Convert files free without an account. A free account raises every limit, keeps your conversion history and adds text recognition.',
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
    name: 'Guest',
    price: 'Free',
    note: 'Nothing to sign up for',
    cta: { label: 'Start converting', href: '/convert/image' },
    highlight: false,
  },
  {
    id: 'FREE' as const,
    name: 'Member',
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

/**
 * Premium is only shown when it can actually be bought.
 *
 * A price with a "coming soon" button is an upsell that goes nowhere: the
 * people most likely to click it are the ones already hitting a limit, and it
 * reads to a reviewer as a half-finished site. Gating on the same flag the
 * checkout uses means the column disappears while payments are unconfigured and
 * returns on its own the moment the Paddle keys are set — no code change, no
 * risk of it being forgotten in either direction.
 */
const VISIBLE_TIERS = isPaddleConfigured
  ? TIERS
  : TIERS.filter((tier) => tier.id !== 'PREMIUM');

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

/**
 * Rows worth showing, given which tiers are visible.
 *
 * With Premium hidden, "Ad-free" and "Priority queue" would be a dash on every
 * remaining plan — a row advertising something nobody can have, which reads as
 * the service lacking it rather than as a paid extra. Measured rows always
 * stay; a yes/no row survives only if some visible plan answers yes.
 */
const VISIBLE_ROWS = new Set(
  rows('ANONYMOUS')
    .map((row) => row.label)
    .filter((label) =>
      VISIBLE_TIERS.some((tier) => {
        const value = rows(tier.id).find((row) => row.label === label)?.value;
        return typeof value !== 'boolean' || value;
      }),
    ),
);

export default async function PricingPage() {
  const user = await currentUser();

  return (
    <div className="container py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mb-4">
          Pricing
        </Badge>
        {/* The headline has to match what the page can actually offer. With no
            paid plan on it, "pay only if you need more" points at nothing. */}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {isPaddleConfigured
            ? 'Convert free. Pay only if you need more.'
            : 'Free to use. Better with an account.'}
        </h1>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          {isPaddleConfigured ? (
            <>
              Every conversion produces exactly what the encoder emitted, on
              every plan. There is no watermark, no degraded output and no
              upsell wall between you and your file &mdash; paying raises
              limits, it does not unlock quality.
            </>
          ) : (
            <>
              Every conversion produces exactly what the encoder emitted. There
              is no watermark, no degraded output and no upsell wall between you
              and your file. An account is free, and raises every limit on this
              page.
            </>
          )}
        </p>
      </div>

      <div
        className={cn(
          'mx-auto mt-14 grid gap-5',
          // Two cards in a three-column grid would sit stranded to one side.
          VISIBLE_TIERS.length > 2
            ? 'max-w-5xl lg:grid-cols-3'
            : 'max-w-3xl sm:grid-cols-2',
        )}
      >
        {VISIBLE_TIERS.map((tier) => (
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
              {rows(tier.id)
                .filter((row) => VISIBLE_ROWS.has(row.label))
                .map((row) => (
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

      {/* The asterisk belongs to Premium's "Unlimited*", so the Premium half
          goes with it. The rolling-window explanation is true of the free plans
          on their own and is the part people actually ask about. */}
      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        {isPaddleConfigured ? (
          <>
            *Premium has a fair-use ceiling of{' '}
            {PLANS.PREMIUM.jobsPerPeriod.toLocaleString()} conversions a month.
            Conversion is real work on real hardware, so an unbounded allowance
            is not something anyone can honestly promise &mdash; but the ceiling
            sits far above what normal use reaches. Allowances are counted over
            a rolling window &mdash; 24 hours on the free plans, 30 days on
            Premium &mdash; so they free up gradually rather than resetting on a
            fixed date.
          </>
        ) : (
          <>
            Allowances are counted over a rolling 24-hour window rather than
            resetting at midnight, so they free up gradually as older
            conversions age out.
          </>
        )}
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
