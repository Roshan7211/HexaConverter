/**
 * Customer testimonials.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS ARRAY IS INTENTIONALLY EMPTY.
 *
 * Add an entry only when a real, identifiable person has given you permission
 * to quote them. Invented testimonials — even plausible-sounding ones with
 * made-up names and job titles — are deceptive advertising. In the US the FTC
 * treats fabricated endorsements as an unfair or deceptive practice (16 CFR
 * Part 465, in force since 2024) with civil penalties per violation; the UK
 * (CPUC/DMCCA) and EU (UCPD) have equivalent prohibitions.
 *
 * While this list is empty, the landing page renders `<TrustSignals />` in its
 * place — verifiable facts about the platform instead of manufactured social
 * proof. Populate this array and the testimonials section appears automatically
 * with no other change.
 *
 * Good sources of real quotes: support threads where someone thanks you (ask
 * permission to quote), a beta programme, or a post-conversion feedback prompt.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Testimonial {
  /** The quote itself. Keep it verbatim — do not tidy someone's words. */
  quote: string;
  /** Full name of a real person who agreed to be quoted. */
  author: string;
  /** Their role, and company if they consented to it being named. */
  role: string;
  /** Optional avatar served from `public/`. Never a stock photo of a stranger. */
  avatarUrl?: string;
  /** Where the quote came from, for your own records. */
  source?: string;
  /** ISO date the permission was given. */
  collectedAt?: string;
}

export const TESTIMONIALS: readonly Testimonial[] = [];

/*
 * Shape of a populated entry:
 *
 * export const TESTIMONIALS: readonly Testimonial[] = [
 *   {
 *     quote:
 *       'We batch-convert a few hundred product shots to WebP every week. It is the first converter that did not silently recompress them twice.',
 *     author: 'Real Person',
 *     role: 'Ecommerce lead, Their Company',
 *     source: 'support ticket #1428, permission granted by email',
 *     collectedAt: '2026-03-14',
 *   },
 * ];
 */
