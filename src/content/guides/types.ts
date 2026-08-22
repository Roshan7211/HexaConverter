import type { Category } from '@/types';

/**
 * Long-form editorial content.
 *
 * These exist because the conversion landing pages, however specific their
 * notes have become, all answer the same shape of question: "how do I turn X
 * into Y". A guide answers the questions that sit underneath that — why a file
 * grew, which format to pick, what a quality number means — and is worth
 * reading whether or not you convert anything afterwards.
 *
 * Written as data rather than MDX for the same reason the format profiles are:
 * everything on this site that reads as prose is typed, so a test can hold it
 * to a standard and a build fails when it slips.
 */

/**
 * The complete set of inline syntax the guide renderer understands:
 * `[text](/path)`, `**text**` and a `` `code` `` span.
 *
 * It lives here rather than in the component so that a test can check the
 * content against the real expression instead of a copy of it. A copy drifts,
 * and drifting is how thirty-three code spans shipped with their backticks
 * rendering as literal backticks.
 */
export const INLINE_SYNTAX =
  /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

export interface GuideSection {
  heading: string;
  /**
   * Paragraphs of prose. Only the syntax in `INLINE_SYNTAX` is supported —
   * a link, bold, and a code span. See `renderInline` in
   * `@/components/marketing/guide-body` for how each is rendered.
   */
  body: readonly string[];
  /** Optional bulleted list rendered after the paragraphs. */
  list?: readonly string[];
  /** Optional comparison table. Every row must match the column count. */
  table?: {
    columns: readonly string[];
    rows: readonly (readonly string[])[];
  };
  /** A single pulled-out point, rendered as a callout after the body. */
  callout?: { title: string; body: string };
}

export interface Guide {
  /** URL segment under `/guides`. */
  slug: string;
  /** The `<h1>`, and how the guide is titled in listings. */
  title: string;
  /** Longer, keyword-bearing form used for `<title>` and search results. */
  metaTitle: string;
  /** Meta description, and the standfirst under the title. */
  description: string;
  /** ISO date first published. */
  published: string;
  /** ISO date last revised, when it differs from `published`. */
  updated?: string;
  /** Converter category this belongs to, for grouping and cross-linking. */
  topic: Category;
  /**
   * Format ids the guide genuinely discusses. A conversion landing page
   * surfaces a guide when either of its formats appears here, so listing a
   * format that the text barely mentions puts an irrelevant link on 20 pages.
   */
  formats: readonly string[];
  /** Lead paragraphs, before the first heading. */
  intro: readonly string[];
  sections: readonly GuideSection[];
  /** Conversion routes worth linking at the end, as `png-to-jpg` slugs. */
  related: readonly string[];
  faq?: readonly { question: string; answer: string }[];
}

/** Every word of prose in a guide, for reading time and for the length test. */
export function guideWordCount(guide: Guide): number {
  const parts: string[] = [
    guide.description,
    ...guide.intro,
    ...guide.sections.flatMap((section) => [
      section.heading,
      ...section.body,
      ...(section.list ?? []),
      ...(section.table?.rows.flatMap((row) => [...row]) ?? []),
      ...(section.callout ? [section.callout.title, section.callout.body] : []),
    ]),
    ...(guide.faq?.flatMap((entry) => [entry.question, entry.answer]) ?? []),
  ];

  return (
    parts
      .join(' ')
      // Strip the link syntax so URLs are not counted as words.
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length
  );
}

/** Reading time at 220 words per minute, rounded up, never below one. */
export function readingMinutes(guide: Guide): number {
  return Math.max(1, Math.round(guideWordCount(guide) / 220));
}
