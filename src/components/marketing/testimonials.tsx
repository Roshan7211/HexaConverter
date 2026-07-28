import { Quote, Star } from 'lucide-react';

import { Reveal, RevealGroup, RevealItem } from '@/components/marketing/reveal';
import { TrustSignals } from '@/components/marketing/trust-signals';
import { Badge } from '@/components/ui/badge';
import { TESTIMONIALS } from '@/content/testimonials';
import { cn } from '@/utils';

/**
 * Testimonials.
 *
 * Renders real quotes from `content/testimonials.ts`. While that list is empty
 * the section falls back to `<TrustSignals />` — verifiable facts about the
 * platform — rather than showing invented endorsements, which are unlawful in
 * the US, UK and EU and corrosive to trust everywhere else.
 */
export function Testimonials() {
  if (TESTIMONIALS.length === 0) return <TrustSignals />;

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden border-y bg-muted/20 py-20 sm:py-28"
      aria-labelledby="testimonials-heading"
    >
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="accent" className="mb-4">
            Testimonials
          </Badge>
          <h2
            id="testimonials-heading"
            className="text-3xl font-semibold sm:text-4xl lg:text-5xl"
          >
            What people are saying
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Quotes from people who use HexaConverter in their day-to-day work,
            published with their permission.
          </p>
        </Reveal>

        <RevealGroup
          className={cn(
            'mt-14 grid gap-5',
            TESTIMONIALS.length > 1 && 'sm:grid-cols-2',
            TESTIMONIALS.length > 2 && 'lg:grid-cols-3',
          )}
        >
          {TESTIMONIALS.map((testimonial) => (
            <RevealItem
              key={`${testimonial.author}-${testimonial.quote.slice(0, 24)}`}
              as="article"
              className="glass gradient-ring flex flex-col rounded-2xl p-6"
            >
              <Quote className="size-7 text-primary/30" aria-hidden="true" />

              <blockquote className="mt-4 flex-1 text-sm leading-relaxed">
                {testimonial.quote}
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3 border-t pt-4">
                {testimonial.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={testimonial.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {testimonial.author.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {testimonial.author}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </figcaption>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/** Star row, exported for use once ratings are collected from real users. */
export function Rating({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'size-4',
            star <= value
              ? 'fill-warning text-warning'
              : 'text-muted-foreground/30',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
