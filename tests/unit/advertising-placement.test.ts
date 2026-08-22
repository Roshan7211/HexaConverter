import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sourceFiles } from './helpers/source-files';
import { CATEGORY_NOTES } from '@/content/category-notes';
import { CATEGORIES } from '@/types/conversion';

/**
 * Where advertising is allowed to appear.
 *
 * AdSense judges a site by the pages carrying its units, and the failure mode
 * is quiet: a new page gets built, someone copies an existing page as a
 * starting point, and a unit arrives on something with nothing on it. This
 * fixes the list in one place so adding a unit anywhere else has to be a
 * deliberate act that updates this test.
 *
 * The rule is not "pages we like". It is that a page carrying an advertisement
 * must have substantial content of its own, and must not be a page where an
 * advertisement is inappropriate regardless of length — a sign-in form, an
 * error screen, a legal document, or anything behind the account.
 */

const SRC = path.join(process.cwd(), 'src');

/** Files permitted to render an `AdSlot`, relative to `src/`. */
const ALLOWED = new Set([
  'components/ads/ad-slot.tsx',
  'app/(site)/(tools)/tools/[slug]/page.tsx',
  'app/(site)/(tools)/convert/[category]/page.tsx',
  'app/(site)/(marketing)/guides/[slug]/page.tsx',
]);

/**
 * Pages that must never carry advertising, whatever else changes.
 *
 * Legal documents and error screens are the ones that would actually cost
 * something: an ad beside a privacy policy undermines the document, and an ad
 * on an error page is the pattern AdSense's own policies single out.
 */
const FORBIDDEN_AREAS = [
  'app/(auth)/',
  'app/(site)/account/',
  'app/(site)/legal/',
  'app/error.tsx',
  'app/global-error.tsx',
  'app/not-found.tsx',
];

describe('advertising placement', () => {
  const renderers = sourceFiles()
    .filter((file) => /<AdSlot|AdSlot\s+/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(SRC, file).split(path.sep).join('/'));

  it('renders advertising only where it has been sanctioned', () => {
    const unexpected = renderers.filter((file) => !ALLOWED.has(file));
    expect(
      unexpected,
      'these files render an ad unit and are not on the allowlist',
    ).toEqual([]);
  });

  it('keeps advertising off account, auth, legal and error pages', () => {
    for (const file of renderers) {
      for (const area of FORBIDDEN_AREAS) {
        expect(
          file.startsWith(area),
          `${file} renders advertising in a forbidden area (${area})`,
        ).toBe(false);
      }
    }
  });

  it('never loads the AdSense tag outside the public site shell', () => {
    // The tag itself is what sets cookies, so it matters as much as the units.
    const loaders = sourceFiles()
      .filter((file) => /AdSenseScript/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'));

    expect(loaders.sort()).toEqual([
      'app/(site)/layout.tsx',
      'components/ads/adsense-script.tsx',
    ]);
  });
});

/**
 * The category pages carry a unit and sit in the main navigation, so they are
 * held to the same standard as the conversion pages: real content of their own,
 * not a headline over a directory of links.
 */
describe('category page content', () => {
  it('gives every category substantial explanatory copy', () => {
    for (const category of CATEGORIES) {
      const notes = CATEGORY_NOTES[category];
      expect(notes?.length ?? 0, `${category} has no notes`).toBeGreaterThanOrEqual(3);

      const words = notes
        .flatMap((note) => [note.heading, ...note.body])
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length;

      expect(words, `${category} category copy is thin`).toBeGreaterThanOrEqual(300);
    }
  });

  it('never repeats the same paragraph between categories', () => {
    const seen = new Map<string, string>();
    for (const category of CATEGORIES) {
      for (const note of CATEGORY_NOTES[category]) {
        for (const paragraph of note.body) {
          const existing = seen.get(paragraph);
          expect(
            existing,
            `${category} repeats a paragraph from ${existing}`,
          ).toBeUndefined();
          seen.set(paragraph, category);
        }
      }
    }
  });
});
