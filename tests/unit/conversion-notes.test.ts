import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ENCODES_AS, conversionNotes } from '@/content/conversion-notes';
import { profileFor } from '@/content/format-profiles';
import {
  PUBLISHED_ROUTES,
  getFormat,
  routeSlug,
} from '@/services/conversion/registry';

/**
 * Guards on the only part of a conversion landing page that is unique to it.
 *
 * Every published route generates a page, and a page whose explanatory section
 * is a sentence long is thin content — the whole set of them was rejected by
 * AdSense on exactly that basis. These tests make the floor executable: adding
 * a format or a route without giving its pages something to say fails the
 * build, which is the only point at which the omission is cheap to fix.
 */

/** Minimum pair-specific paragraphs on any published landing page. */
const MIN_NOTES = 3;

/** Below this a "paragraph" is a caption, not an explanation. */
const MIN_WORDS_PER_NOTE = 25;

const ROUTES = PUBLISHED_ROUTES.filter((route) => route.from !== route.to).map(
  (route) => {
    const from = getFormat(route.from)!;
    const to = getFormat(route.to)!;
    return {
      slug: routeSlug(route),
      from,
      to,
      notes: conversionNotes(from, to, profileFor(from.id)!, profileFor(to.id)!),
    };
  },
);

describe('conversion notes', () => {
  it('covers every published route', () => {
    expect(ROUTES.length).toBeGreaterThan(200);
    for (const route of ROUTES) {
      expect(profileFor(route.from.id), `no profile for ${route.from.id}`).not.toBeNull();
      expect(profileFor(route.to.id), `no profile for ${route.to.id}`).not.toBeNull();
    }
  });

  it('gives every landing page at least three things to say', () => {
    const thin = ROUTES.filter((route) => route.notes.length < MIN_NOTES).map(
      (route) => `${route.slug} (${route.notes.length})`,
    );
    expect(thin, `routes below the ${MIN_NOTES}-note floor`).toEqual([]);
  });

  it('never pads a page with one-line notes', () => {
    const short: string[] = [];
    for (const route of ROUTES) {
      for (const note of route.notes) {
        const words = note.body.trim().split(/\s+/).length;
        if (words < MIN_WORDS_PER_NOTE) {
          short.push(`${route.slug}: "${note.heading}" (${words} words)`);
        }
      }
    }
    expect(short).toEqual([]);
  });

  it('never repeats a heading within one page', () => {
    for (const route of ROUTES) {
      const headings = route.notes.map((note) => note.heading);
      expect(new Set(headings).size, `duplicate heading on ${route.slug}`).toBe(
        headings.length,
      );
    }
  });

  it('gives no two routes an identical explanation', () => {
    // The failure this catches is a rule set that has stopped discriminating —
    // pages generated in bulk that read the same as each other, which is the
    // definition of the problem these notes exist to solve.
    const seen = new Map<string, string>();
    for (const route of ROUTES) {
      const fingerprint = route.notes
        .map((note) => `${note.heading}|${note.body}`)
        .join('\n');
      const existing = seen.get(fingerprint);
      expect(
        existing,
        `${route.slug} reads identically to ${existing}`,
      ).toBeUndefined();
      seen.set(fingerprint, route.slug);
    }
  });
});

/**
 * The notes describe what our encoders do, in prose, in a file the encoders do
 * not import. These tests are what stops the two drifting apart — a codec
 * changed in the engine and not here would leave every affected page stating
 * something untrue.
 */
describe('encoder claims match the engines', () => {
  const engineSource = (file: string) =>
    readFileSync(
      path.join(process.cwd(), 'src/services/conversion/engines', file),
      'utf8',
    );

  it('names the codecs the media engine actually uses', () => {
    const source = engineSource('media.engine.ts');
    const table = source.slice(
      source.indexOf('const PROFILES'),
      source.indexOf('function buildVideoFilters'),
    );

    for (const [id, facts] of Object.entries(ENCODES_AS)) {
      const entry = new RegExp(`\\n  ${id}: \\{([\\s\\S]*?)\\n  \\},`).exec(table)
        ?? new RegExp(`\\n  ${id}: \\{(.*?)\\},`).exec(table);
      expect(entry, `${id} is missing from the engine's PROFILES`).not.toBeNull();

      const declared = entry![1]!;
      const video = /videoCodec: '([^']+)'/.exec(declared)?.[1];
      const audio = /audioCodec: '([^']+)'/.exec(declared)?.[1];

      expect(facts.encoders.video, `${id} video codec`).toBe(video);
      expect(facts.encoders.audio, `${id} audio codec`).toBe(audio);
    }
  });

  it('describes every image target the image engine can write', () => {
    const source = engineSource('image.engine.ts');
    const targets = Array.from(
      source.matchAll(/^\s+case '([a-z0-9]+)':$/gm),
      (match) => match[1]!,
    );
    expect(targets.length).toBeGreaterThan(4);

    const described = readFileSync(
      path.join(process.cwd(), 'src/content/conversion-notes.ts'),
      'utf8',
    );
    const table = described.slice(
      described.indexOf('const IMAGE_ENCODER'),
      described.indexOf('/** Formats that routinely arrive carrying camera metadata. */'),
    );

    for (const target of targets) {
      expect(table, `no copy describes how ${target} is written`).toContain(
        `${target}:`,
      );
    }
  });
});
