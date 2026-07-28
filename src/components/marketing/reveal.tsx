import type { ReactNode } from 'react';

import { cn } from '@/utils';

/**
 * Scroll-reveal primitive.
 *
 * Deliberately **not** a client component. An earlier Framer Motion version
 * server-rendered `opacity: 0`, which meant the content stayed invisible until
 * hydration finished — a slow or failed script left the page blank, and it
 * delayed the largest contentful paint for no visual gain.
 *
 * This implementation is pure CSS driven by a scroll timeline:
 *
 *   • Content is visible by default. Browsers without `animation-timeline`
 *     (Safari, Firefox today) simply show it — correct, just not animated.
 *   • Where supported, each element animates as it enters the viewport, which
 *     staggers a grid naturally as the user scrolls; no per-card delay needed.
 *   • `prefers-reduced-motion` disables it at the media-query level, so the
 *     animation is never defined rather than merely shortened.
 *   • Zero JavaScript and zero hydration cost.
 */

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none';

const DIRECTION_CLASS: Record<RevealDirection, string> = {
  up: 'reveal-up',
  down: 'reveal-down',
  left: 'reveal-left',
  right: 'reveal-right',
  none: 'reveal-fade',
};

interface RevealProps {
  children: ReactNode;
  className?: string;
  direction?: RevealDirection;
  as?: 'div' | 'section' | 'li' | 'article';
}

export function Reveal({
  children,
  className,
  direction = 'up',
  as: Tag = 'div',
}: RevealProps) {
  return (
    <Tag className={cn('reveal', DIRECTION_CLASS[direction], className)}>
      {children}
    </Tag>
  );
}

/**
 * Wrapper for a group of revealed items. Purely structural — the stagger comes
 * from each child entering the viewport at a slightly different moment.
 */
export function RevealGroup({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  /** Accepted for call-site compatibility; CSS timing needs no stagger value. */
  stagger?: number;
  as?: 'div' | 'ul' | 'ol';
}) {
  return <Tag className={className}>{children}</Tag>;
}

export function RevealItem({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  return <Tag className={cn('reveal', 'reveal-up', className)}>{children}</Tag>;
}
