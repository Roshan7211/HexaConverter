import { FORMATS } from '@/services/conversion/registry';

/**
 * Continuously scrolling band of supported formats.
 *
 * Implemented in CSS rather than JavaScript: the track holds the list twice and
 * translates by -50%, which loops seamlessly at zero scripting cost. The whole
 * band is `aria-hidden` — it is decorative repetition of the format table in
 * the Supported Formats section — and the global reduced-motion rule stops the
 * animation for visitors who ask for that.
 */
export function FormatMarquee() {
  const formats = Object.values(FORMATS).map((format) => format.id);

  return (
    <div
      className="pause-on-hover relative border-t bg-muted/30 py-4"
      aria-hidden="true"
    >
      <div className="mask-fade-x flex overflow-hidden">
        <div className="animate-marquee flex shrink-0 items-center gap-3 pr-3">
          {/* Rendered twice so the -50% translation wraps without a jump. */}
          {[...formats, ...formats].map((format, index) => (
            <span
              key={`${format}-${index}`}
              className="glass shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {format}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
