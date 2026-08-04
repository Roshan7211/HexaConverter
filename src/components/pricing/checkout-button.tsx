'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  PADDLE_CLIENT_TOKEN,
  PADDLE_ENV,
  PADDLE_PRICE_ID,
} from '@/lib/paddle';

/**
 * Opens the Paddle overlay checkout.
 *
 * Paddle handles the payment, the tax and the receipt; this component's only
 * jobs are to know who is buying and to say nothing about entitlement.
 *
 * Deliberately, a completed checkout does **not** grant Premium here. The
 * browser is told the payment succeeded, but the account is only upgraded when
 * Paddle's webhook arrives and is signature-verified server-side. Trusting the
 * success callback would mean anyone who can call a JavaScript function can
 * award themselves a paid plan.
 */

interface Props {
  /** Email of the signed-in buyer, or null when signed out. */
  email: string | null;
  /** False when the deployment has no Paddle configuration. */
  enabled: boolean;
}

export function CheckoutButton({ email, enabled }: Props) {
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    void initializePaddle({
      environment: PADDLE_ENV,
      token: PADDLE_CLIENT_TOKEN,
    })
      .then((instance) => setPaddle(instance ?? null))
      .catch(() => {
        // Left null: the button stays disabled rather than throwing when
        // pressed. A blocked script or an offline visitor should not produce
        // an error dialog on a marketing page.
        setPaddle(null);
      });
  }, [enabled]);

  if (!enabled) {
    return (
      <Button className="w-full" variant="outline" disabled>
        Coming soon
      </Button>
    );
  }

  // Buying has to attach to an account, because the account is what carries the
  // entitlement. Sending them to sign up first is clearer than opening a
  // checkout whose payment could not be matched to anybody afterwards.
  if (!email) {
    return (
      <Button
        className="w-full"
        onClick={() => router.push('/sign-up?next=/pricing')}
      >
        Create an account to upgrade
      </Button>
    );
  }

  function open() {
    if (!paddle || busy) return;
    setBusy(true);

    try {
      paddle.Checkout.open({
        items: [{ priceId: PADDLE_PRICE_ID, quantity: 1 }],
        // Prefills the field and, more importantly, is what the webhook is
        // matched back to an account on.
        customer: { email: email! },
        settings: { displayMode: 'overlay', theme: 'light' },
      });
    } catch {
      toast.error('Could not open the checkout. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button className="w-full" onClick={open} loading={busy} disabled={!paddle}>
      {paddle ? 'Upgrade to Premium' : 'Loading checkout…'}
    </Button>
  );
}
