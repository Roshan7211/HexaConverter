import { describe, expect, it } from 'vitest';

import { GUIDES, guideBySlug, guidesForConversion } from '@/content/guides';
import { guideWordCount, type Guide } from '@/content/guides/types';
import {
  FORMATS,
  PUBLISHED_ROUTES,
  parseRouteSlug,
  routeSlug,
} from '@/services/conversion/registry';

/**
 * Guides exist to be substantial, so "substantial" has to mean something a
 * build can check. These tests hold the length floor, and — the part that
 * actually breaks in practice — verify that every link written inside the
 * prose points at a page that exists.
 */

/** Below this it is a note, not a guide. */
const MIN_WORDS = 700;

/** Paths that are real pages but are not conversion routes or guides. */
const KNOWN_PAGES = new Set([
  '/',
  '/about',
  '/contact',
  '/faq',
  '/features',
  '/guides',
  '/pricing',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/refunds',
  '/legal/attributions',
]);

/** Every string in a guide that renders as prose. */
function prose(guide: Guide): string[] {
  return [
    ...guide.intro,
    ...guide.sections.flatMap((section) => [
      ...section.body,
      ...(section.list ?? []),
      ...(section.table?.rows.flatMap((row) => [...row]) ?? []),
      ...(section.callout ? [section.callout.body] : []),
    ]),
    ...(guide.faq?.map((entry) => entry.answer) ?? []),
  ];
}

function linksIn(guide: Guide): string[] {
  return prose(guide).flatMap((text) =>
    Array.from(text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g), (match) => match[1]!),
  );
}

describe('guide library', () => {
  it('has a unique slug and title for each guide', () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    expect(new Set(GUIDES.map((g) => g.title)).size).toBe(GUIDES.length);
    for (const guide of GUIDES) {
      expect(guideBySlug(guide.slug)).toBe(guide);
    }
  });

  it('gives every guide enough substance to be worth publishing', () => {
    const short = GUIDES.filter(
      (guide) => guideWordCount(guide) < MIN_WORDS,
    ).map((guide) => `${guide.slug} (${guideWordCount(guide)} words)`);
    expect(short, `guides below ${MIN_WORDS} words`).toEqual([]);
  });

  it('gives every guide an intro, sections and questions', () => {
    for (const guide of GUIDES) {
      expect(guide.intro.length, guide.slug).toBeGreaterThan(0);
      expect(guide.sections.length, guide.slug).toBeGreaterThanOrEqual(4);
      expect(guide.faq?.length ?? 0, guide.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every table rectangular', () => {
    for (const guide of GUIDES) {
      for (const section of guide.sections) {
        if (!section.table) continue;
        for (const row of section.table.rows) {
          expect(
            row.length,
            `${guide.slug} — "${section.heading}" has a ragged row`,
          ).toBe(section.table.columns.length);
        }
      }
    }
  });

  it('only claims formats that exist', () => {
    for (const guide of GUIDES) {
      expect(guide.formats.length, guide.slug).toBeGreaterThan(0);
      for (const format of guide.formats) {
        expect(FORMATS[format], `${guide.slug} names unknown format ${format}`).toBeDefined();
      }
    }
  });

  it('only points `related` at routes that are actually published', () => {
    const published = new Set(PUBLISHED_ROUTES.map(routeSlug));
    for (const guide of GUIDES) {
      expect(guide.related.length, guide.slug).toBeGreaterThan(0);
      for (const route of guide.related) {
        expect(
          published.has(route),
          `${guide.slug} links to /tools/${route}, which is not a published route`,
        ).toBe(true);
      }
    }
  });

  it('never writes a link in the prose that leads nowhere', () => {
    // The failure this prevents is the expensive one: an article that reads
    // well and quietly sends readers — and crawlers — to a 404.
    const broken: string[] = [];

    for (const guide of GUIDES) {
      for (const href of linksIn(guide)) {
        if (KNOWN_PAGES.has(href)) continue;

        if (href.startsWith('/tools/')) {
          const slug = href.slice('/tools/'.length);
          // Identity routes convert but have no landing page.
          const route = parseRouteSlug(slug);
          if (route && route.from !== route.to) continue;
          broken.push(`${guide.slug} -> ${href}`);
          continue;
        }

        if (href.startsWith('/guides/')) {
          if (guideBySlug(href.slice('/guides/'.length))) continue;
          broken.push(`${guide.slug} -> ${href}`);
          continue;
        }

        if (href.startsWith('/convert/')) continue;
        broken.push(`${guide.slug} -> ${href}`);
      }
    }

    expect(broken, 'links pointing at pages that do not exist').toEqual([]);
  });

  it('surfaces a relevant guide on the conversion pages it belongs to', () => {
    // A guide nothing links to is a guide nobody reads. Every one of them must
    // be reachable from at least one conversion page, not just the index.
    const surfaced = new Set<string>();
    for (const route of PUBLISHED_ROUTES) {
      for (const guide of guidesForConversion(route.from, route.to).slice(0, 2)) {
        surfaced.add(guide.slug);
      }
    }

    const orphans = GUIDES.filter((guide) => !surfaced.has(guide.slug)).map(
      (guide) => guide.slug,
    );
    expect(orphans, 'guides not linked from any conversion page').toEqual([]);
  });
});
