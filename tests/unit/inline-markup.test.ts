import { describe, expect, it } from 'vitest';

import { CATEGORY_NOTES } from '@/content/category-notes';
import { GUIDES } from '@/content/guides';
import { conversionNotes } from '@/content/conversion-notes';
import { profileFor } from '@/content/format-profiles';
import { INLINE_SYNTAX, type Guide } from '@/content/guides/types';
import { CATEGORIES } from '@/types/conversion';
import {
  PUBLISHED_ROUTES,
  getFormat,
  routeSlug,
} from '@/services/conversion/registry';

/**
 * Every marker written in the prose has to be one the renderer understands.
 *
 * This exists because it did not. Thirty-three code spans shipped through four
 * phases of review with their backticks rendering as literal backticks, because
 * nothing compared what the content used against what
 * `@/components/marketing/guide-body` implements. Reading the copy is how a
 * person catches that; this is how a build catches it.
 */

/** Markers that mean nothing to the renderer and would print as themselves. */
const LEFTOVER = [
  { pattern: /`/, name: 'backtick' },
  { pattern: /\*\*/, name: 'bold marker' },
  { pattern: /\]\(/, name: 'link syntax' },
  { pattern: /^\s*[-*]\s/, name: 'list marker' },
  { pattern: /^#{1,6}\s/, name: 'heading marker' },
  { pattern: /_[a-z]+_/i, name: 'underscore emphasis' },
];

function unrendered(text: string): string[] {
  const remainder = text.replace(INLINE_SYNTAX, '');
  return LEFTOVER.filter((marker) => marker.pattern.test(remainder)).map(
    (marker) => marker.name,
  );
}

function guideProse(guide: Guide): string[] {
  return [
    guide.title,
    guide.description,
    ...guide.intro,
    ...guide.sections.flatMap((section) => [
      section.heading,
      ...section.body,
      ...(section.list ?? []),
      ...(section.table?.columns ?? []),
      ...(section.table?.rows.flatMap((row) => [...row]) ?? []),
      ...(section.callout ? [section.callout.title, section.callout.body] : []),
    ]),
    ...(guide.faq?.flatMap((entry) => [entry.question, entry.answer]) ?? []),
  ];
}

describe('inline markup', () => {
  it('leaves nothing unrendered in the guides', () => {
    const bad: string[] = [];
    for (const guide of GUIDES) {
      for (const text of guideProse(guide)) {
        for (const marker of unrendered(text)) {
          bad.push(`${guide.slug}: stray ${marker} in "${text.slice(0, 60)}…"`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('leaves nothing unrendered in the category copy', () => {
    const bad: string[] = [];
    for (const category of CATEGORIES) {
      for (const note of CATEGORY_NOTES[category]) {
        for (const text of [note.heading, ...note.body]) {
          for (const marker of unrendered(text)) {
            bad.push(`${category}: stray ${marker} in "${text.slice(0, 60)}…"`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('writes conversion notes as plain prose', () => {
    // These are rendered directly rather than through the inline parser, so
    // they may not contain any markup syntax at all.
    const bad: string[] = [];
    for (const route of PUBLISHED_ROUTES) {
      if (route.from === route.to) continue;
      const from = getFormat(route.from)!;
      const to = getFormat(route.to)!;
      const notes = conversionNotes(
        from,
        to,
        profileFor(from.id)!,
        profileFor(to.id)!,
      );

      for (const note of notes) {
        for (const text of [note.heading, note.body]) {
          if (/`|\*\*|\]\(/.test(text)) {
            bad.push(`${routeSlug(route)}: markup in "${text.slice(0, 60)}…"`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
