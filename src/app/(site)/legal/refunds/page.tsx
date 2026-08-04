import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/layout/legal-page';
import { SUPPORT_EMAIL } from '@/lib/contact';
import { PLANS, PREMIUM_PRICE_PENCE } from '@/lib/plans';
import { buildMetadata, SITE } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Refund policy',
  description:
    'A 14-day money-back guarantee on HexaConverter Premium, how to cancel, and how refunds are processed.',
  path: '/legal/refunds',
});

const LAST_UPDATED = '2026-08-03';

const price = (PREMIUM_PRICE_PENCE / 100).toFixed(2);

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund policy"
      summary="Fourteen days, no questions asked. Nearly everything here is free anyway, so you can decide before you pay."
      lastUpdated={LAST_UPDATED}
    >
      <h2>The short version</h2>
      <ul>
        <li>
          Premium is £{price} a year. Ask within <strong>14 days</strong> of
          paying and you get all of it back, for any reason or none.
        </li>
        <li>
          After 14 days we do not refund the remainder of a year, but you keep
          Premium until the term ends.
        </li>
        <li>Cancelling stops the next renewal. It never cuts you off early.</li>
        <li>
          Refunds go back to the card or PayPal account you paid with, by the
          same route.
        </li>
      </ul>

      <h2>Try it before you pay</h2>
      <p>
        Every conversion {SITE.name} performs is available without paying and
        without an account. A free account raises the limits further &mdash;{' '}
        {PLANS.FREE.jobsPerPeriod} conversions a month at up to 500 MB &mdash;
        and costs nothing. Premium raises them again; it does not unlock
        quality, remove a watermark or lift a restriction on what the encoders
        will do.
      </p>
      <p>
        We would rather you established that the service handles your files
        properly before spending anything, which is why the refund window exists
        at all.
      </p>

      <h2>The 14-day guarantee</h2>
      <p>
        Ask within 14 days of the payment and we refund it in full. You do not
        have to explain why, and we will not try to talk you out of it. This
        applies to a first purchase and to each annual renewal.
      </p>
      <p>
        We may decline where an account is closed for breaching the{' '}
        <Link href="/legal/terms">terms of service</Link>, or where the same
        person has repeatedly bought and refunded.
      </p>

      <h2>After 14 days</h2>
      <p>
        We do not refund the unused part of an annual term. Premium stays active
        until the date it was paid up to, so nothing is taken away &mdash; and
        cancelling any time before that date stops the renewal.
      </p>

      <h2>Cancelling</h2>
      <p>
        Cancel from your <Link href="/account">account page</Link> at any time.
        Premium continues until the end of the term you have already paid for,
        then the account returns to the free plan. Nothing is deleted when that
        happens; the free limits simply apply again.
      </p>

      <h2>Who processes the payment</h2>
      <p>
        Our order process is conducted by our online reseller Paddle.com. Paddle
        is the Merchant of Record for all our orders and handles all
        customer-service enquiries relating to payments, invoices, taxes and
        refunds.
      </p>
      <p>
        In practice this means a refund is issued by Paddle and reaches you the
        way you paid. Card refunds usually appear within 5&ndash;10 business
        days, depending on your bank; PayPal is normally faster. The timing is
        the payment provider&rsquo;s, not ours.
      </p>

      <h2>How to ask</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or use the{' '}
        <Link href="/contact">contact form</Link> from the address you bought
        with, and say you would like a refund. You can also contact Paddle
        directly at{' '}
        <a href="https://paddle.net" rel="noopener noreferrer" target="_blank">
          paddle.net
        </a>
        , which is their buyer support portal. We aim to answer within two
        business days.
      </p>

      <h2>Your legal rights</h2>
      <p>
        Nothing in this policy affects the rights you have under consumer law.
        If you are in the UK or the EU you normally have a statutory 14-day
        right to cancel a distance contract, which this policy matches
        deliberately rather than trying to narrow. Where a service is supplied
        immediately at your request, that statutory right can be reduced &mdash;
        our 14 days apply regardless.
      </p>
      <p>
        If something we sold you does not work as described, you are entitled to
        a remedy whatever this page says.
      </p>

      <h2>Failed payments</h2>
      <p>
        If an annual renewal fails, Premium lapses and the account returns to
        the free plan. Nothing is charged, nothing is deleted, and you can buy
        again whenever you like.
      </p>
    </LegalPage>
  );
}
