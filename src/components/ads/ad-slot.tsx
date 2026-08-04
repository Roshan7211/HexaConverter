'use client';

import { useEffect, useRef } from 'react';

import { useShowAds } from '@/components/ads/ads-context';
import { cn } from '@/utils';

/**
 * A single advertising unit.
 *
 * Renders nothing at all unless the visitor's plan shows advertising and both
 * the publisher and the unit are configured, so a Premium visitor gets no
 * markup and no empty box, and an unconfigured build behaves as it did before
 * advertising existed.
 *
 * **The reserved height is the point of this component.** An ad arrives after
 * the page has painted, and a unit given no space to land in pushes everything
 * below it down at the moment it fills. That is the single most common way a
 * site destroys its layout stability, and this one measures 0.0006 with 214
 * landing pages whose ranking depends on it. Reserving the space up front means
 * the ad appears into a gap that was always there.
 *
 * That reservation is only worth anything if it is the size the ad actually
 * turns out to be, which is why these are fixed sizes per breakpoint rather
 * than `data-ad-format="auto"`. Auto picks its height from the container width
 * at fill time, so the reservation is a guess: measured here, a slot reserving
 * 100px on a phone came back 375px. Both of these units sit above further page
 * content and AdSense fills below-the-fold units lazily, so that difference
 * lands as a jump under the reader's thumb at the moment they scroll to it.
 * Giving the `ins` an explicit size makes the box and the creative the same
 * number by construction.
 *
 * Clipping is deliberately not the answer — AdSense forbids obscuring a
 * creative, so `overflow-hidden` here is a guard against a misbehaving ad
 * widening the page, never a way to crop one into a box that is too small.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface Props {
  /** AdSense unit id (`data-ad-slot`), from the AdSense dashboard. */
  slot: string | undefined;
  /**
   * Reserved space, as Tailwind height classes, plus any outer spacing. The
   * heights must equal the creative heights in `sizeClassName` at every
   * breakpoint, or the reservation is decorative.
   */
  className: string;
  /**
   * The creative's own size per breakpoint, as width and height classes. These
   * must be real AdSense sizes — Google serves the unit at the size it finds
   * here, and an invented one simply goes unfilled.
   */
  sizeClassName: string;
  /** Describes the unit for screen readers and for anyone reading the markup. */
  label: string;
}

export function AdSlot({ slot, className, sizeClassName, label }: Props) {
  const showAds = useShowAds();
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const pushed = useRef(false);

  useEffect(() => {
    if (!showAds || !client || !slot || pushed.current) return;

    // React runs effects twice in development's strict mode, and AdSense throws
    // "All ins elements already have ads" on the second push for the same
    // element. The ref makes the push happen once per mount either way.
    pushed.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // A blocked or failed ad is not worth an error boundary. The reserved
      // space simply stays empty.
    }
  }, [showAds, client, slot]);

  if (!showAds || !client || !slot) return null;

  return (
    <aside
      aria-label={label}
      // Centred because the creative is narrower than the column it sits in at
      // most widths, and `overflow-hidden` stops one that ignores its bounds
      // from widening the page — a wide ad is the usual cause of a horizontal
      // scrollbar appearing on a phone.
      className={cn(
        'flex items-start justify-center overflow-hidden',
        className,
      )}
    >
      <ins
        className={cn('adsbygoogle', sizeClassName)}
        style={{ display: 'inline-block' }}
        data-ad-client={client}
        data-ad-slot={slot}
      />
    </aside>
  );
}
