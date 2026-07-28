import Image from 'next/image';

import { cn } from '@/utils';

/**
 * Brand assets.
 *
 * The lockup is the supplied artwork rather than a re-drawing of it, so the
 * hexagon's gradient and the wordmark's typeface are exactly the brand's. Two
 * variants ship: the original dark wordmark, and one whose neutral ink has been
 * lifted for dark surfaces. Both are swapped with CSS — no JavaScript, no
 * theme-dependent flash on first paint.
 *
 * `priority` is set on the header lockup because it sits in the initial
 * viewport on every page and would otherwise be lazy-loaded.
 */

const LOCKUP_RATIO = 1831 / 448;

export function LogoMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={size}
      height={size}
      className={cn('size-8 object-contain', className)}
      priority
    />
  );
}

export function Logo({
  className,
  showWordmark = true,
  height = 34,
  priority = true,
}: {
  className?: string;
  showWordmark?: boolean;
  /** Rendered height in pixels; the width follows the artwork's ratio. */
  height?: number;
  priority?: boolean;
}) {
  if (!showWordmark) {
    return <LogoMark className={className} size={height} />;
  }

  const width = Math.round(height * LOCKUP_RATIO);

  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ height }}
    >
      {/* Light theme */}
      <Image
        src="/brand/logo-horizontal.png"
        alt="HexaConverter"
        width={width}
        height={height}
        priority={priority}
        className="h-full w-auto object-contain dark:hidden"
      />
      {/* Dark theme */}
      <Image
        src="/brand/logo-horizontal-dark.png"
        alt="HexaConverter"
        width={width}
        height={height}
        priority={priority}
        className="hidden h-full w-auto object-contain dark:block"
      />
    </span>
  );
}
