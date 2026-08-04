import { NextResponse } from 'next/server';

import { Environment, EventName, Paddle } from '@paddle/paddle-node-sdk';
import { SubscriptionStatus } from '@prisma/client';

import { findByEmail } from '@/database/repositories/user.repository';
import {
  alreadyProcessed,
  applySubscription,
  findUserIdBySubscription,
  markProcessed,
} from '@/database/repositories/subscription.repository';
import { logger } from '@/lib/logger';
import { PADDLE_ENV } from '@/lib/paddle';

/**
 * POST /api/webhooks/paddle
 *
 * The only thing that grants or removes Premium.
 *
 * The browser is never trusted for this. A completed checkout tells the buyer
 * their payment worked; it is this endpoint, verifying Paddle's signature over
 * the raw request body, that changes what the account is entitled to.
 *
 * Three properties matter here and each is deliberate:
 *
 *  - **Verified.** An unsigned or wrongly-signed request is rejected before
 *    anything is read out of it. Without that, the URL alone would be enough to
 *    award anyone a paid plan.
 *  - **Idempotent.** Paddle retries until it receives a 2xx, so the same event
 *    will arrive again after any blip. Each is recorded by its own event id and
 *    refused a second time; otherwise an outage turns into free months.
 *  - **Honest about failure.** A 5xx is returned when we genuinely could not
 *    process an event, so Paddle retries it. Returning 200 to make the
 *    dashboard look clean would silently drop real payments.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function paddle(): Paddle | null {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return null;

  return new Paddle(key, {
    environment:
      PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox,
  });
}

/** Paddle's subscription states, narrowed to what this service acts on. */
function statusOf(raw: string | undefined): SubscriptionStatus {
  switch (raw) {
    case 'active':
    case 'trialing':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'paused':
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.CANCELLED;
  }
}

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const client = paddle();

  if (!secret || !client) {
    // 503 rather than 200: Paddle should keep retrying while the deployment is
    // misconfigured, not consider the event delivered and discard it.
    logger.error('Paddle webhook received but payments are not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const signature = request.headers.get('paddle-signature');
  if (!signature) return NextResponse.json({ error: 'unsigned' }, { status: 400 });

  // Must be the raw text. Parsing to JSON and re-serialising changes the bytes
  // and the signature will never match.
  const body = await request.text();

  let event;
  try {
    event = await client.webhooks.unmarshal(body, secret, signature);
  } catch (error) {
    // `unmarshal` both verifies the signature and parses the body, and those
    // two failures need opposite responses. A bad signature is someone else's
    // request and should be refused permanently; a body this SDK version cannot
    // parse is our problem, and answering 401 would tell Paddle to stop trying
    // while a real payment went unapplied. It also makes the two
    // indistinguishable in the logs, which cost an afternoon to work out once.
    const message = error instanceof Error ? error.message : String(error);
    const badSignature = /signature/i.test(message);

    if (badSignature) {
      logger.warn('Paddle webhook signature rejected');
      return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
    }

    logger.error('Paddle webhook could not be parsed', { error });
    return NextResponse.json({ error: 'unparseable' }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ error: 'unparseable' }, { status: 400 });
  }

  if (await alreadyProcessed(event.eventId)) {
    logger.info('Paddle webhook replayed, ignoring', {
      eventId: event.eventId,
      eventType: event.eventType,
    });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPastDue:
      case EventName.SubscriptionPaused:
      case EventName.SubscriptionResumed: {
        const data = event.data as {
          id: string;
          status?: string;
          customerId?: string;
          currentBillingPeriod?: { endsAt?: string };
          scheduledChange?: { action?: string; effectiveAt?: string } | null;
          items?: Array<{ price?: { id?: string } }>;
          customData?: unknown;
        };

        // Match to an account: by the subscription if it is already known, and
        // otherwise by the buyer's email, which is what the checkout collected.
        let userId = await findUserIdBySubscription(data.id);

        if (!userId) {
          const email = await emailFor(client, data.customerId);
          const user = email ? await findByEmail(email) : null;
          userId = user?.id ?? null;
        }

        if (!userId) {
          // Nothing to attach the payment to. Logged loudly rather than
          // silently dropped — it means someone paid and cannot be upgraded,
          // which needs a person to look at it.
          logger.error('Paddle subscription has no matching account', {
            eventId: event.eventId,
            subscriptionId: data.id,
          });
          break;
        }

        const endsAt = data.currentBillingPeriod?.endsAt;

        await applySubscription({
          userId,
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customerId ?? null,
          paddlePriceId: data.items?.[0]?.price?.id ?? null,
          status: statusOf(data.status),
          currentPeriodEnd: endsAt ? new Date(endsAt) : null,
          cancelledAt:
            data.scheduledChange?.action === 'cancel'
              ? new Date(data.scheduledChange.effectiveAt ?? Date.now())
              : null,
        });

        logger.info('Paddle subscription applied', {
          eventType: event.eventType,
          userId,
          status: data.status,
        });
        break;
      }

      default:
        // Everything else — transactions, adjustments, product edits — is
        // recorded as seen and otherwise ignored. Entitlement follows the
        // subscription, so acting on payment events too would double-handle it.
        break;
    }

    await markProcessed(event.eventId, event.eventType);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Not marked processed, so Paddle's retry gets another attempt.
    logger.error('Paddle webhook handler failed', {
      eventId: event.eventId,
      eventType: event.eventType,
      error,
    });
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
  }
}

/** Looks up the buyer's email from Paddle, for first-time matching. */
async function emailFor(
  client: Paddle,
  customerId: string | undefined,
): Promise<string | null> {
  if (!customerId) return null;

  try {
    const customer = await client.customers.get(customerId);
    return customer.email ?? null;
  } catch (error) {
    logger.warn('Could not read Paddle customer', { customerId, error });
    return null;
  }
}
