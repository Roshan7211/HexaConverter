import 'server-only';

import { SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/database/client';

/**
 * Data access for billing records.
 *
 * Two things are kept deliberately apart here: the `Subscription` row, which is
 * the history of what Paddle says, and `User.planTier` / `User.premiumUntil`,
 * which is what the service enforces. They are written together in one
 * transaction so a crash between them cannot leave someone paid-up in one place
 * and free in the other.
 */

/** True when this event has already been handled and must not be replayed. */
export async function alreadyProcessed(eventId: string): Promise<boolean> {
  const seen = await prisma.processedWebhook.findUnique({
    where: { eventId },
    select: { eventId: true },
  });

  return seen !== null;
}

export async function markProcessed(
  eventId: string,
  eventType: string,
): Promise<void> {
  // `createMany` with skipDuplicates rather than `create`: two deliveries of the
  // same event arriving concurrently would otherwise race to insert and one
  // would throw on the unique constraint.
  await prisma.processedWebhook.createMany({
    data: [{ eventId, eventType }],
    skipDuplicates: true,
  });
}

export interface SubscriptionUpdate {
  userId: string;
  paddleSubscriptionId: string;
  paddleCustomerId?: string | null;
  paddlePriceId?: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelledAt?: Date | null;
}

/**
 * Records the subscription and moves the account's entitlement to match, in one
 * transaction.
 *
 * The tier is derived from the status rather than passed in: only an `ACTIVE`
 * subscription grants premium, and a lapsed `currentPeriodEnd` is caught
 * separately by the entitlement check, so a stale webhook cannot leave someone
 * on a paid plan indefinitely.
 */
export async function applySubscription(
  update: SubscriptionUpdate,
): Promise<void> {
  const premium = update.status === SubscriptionStatus.ACTIVE;

  const record = {
    paddleCustomerId: update.paddleCustomerId ?? null,
    paddlePriceId: update.paddlePriceId ?? null,
    status: update.status,
    currentPeriodEnd: update.currentPeriodEnd,
    cancelledAt: update.cancelledAt ?? null,
  };

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { paddleSubscriptionId: update.paddleSubscriptionId },
      create: {
        userId: update.userId,
        paddleSubscriptionId: update.paddleSubscriptionId,
        ...record,
      },
      update: record,
    }),
    prisma.user.update({
      where: { id: update.userId },
      data: {
        planTier: premium ? 'PREMIUM' : 'FREE',
        // Kept even when downgrading: it is what the entitlement check reads,
        // and a cancelled subscription still runs to the end of its paid term.
        premiumUntil: update.currentPeriodEnd,
      },
    }),
  ]);
}

/** Finds the account a Paddle subscription belongs to. */
export async function findUserIdBySubscription(
  paddleSubscriptionId: string,
): Promise<string | null> {
  const row = await prisma.subscription.findUnique({
    where: { paddleSubscriptionId },
    select: { userId: true },
  });

  return row?.userId ?? null;
}
