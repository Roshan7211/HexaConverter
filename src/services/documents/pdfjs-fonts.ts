import 'server-only';

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { logger } from '@/lib/logger';

/**
 * Where pdfjs finds substitutes for the standard 14 PDF fonts.
 *
 * Without this, any page whose text uses Helvetica, Times or Courier — which is
 * most PDFs not produced with embedded fonts — can rasterise with the text
 * degraded or missing. pdfjs only warns; it does not fail, so the result is a
 * plausible-looking page with nothing written on it.
 *
 * Returned as a plain filesystem path with a trailing slash, *not* a file://
 * URL. pdfjs calls the value a URL, but its Node data factory concatenates the
 * filename onto it and hands the result straight to `fs.readFile`, which
 * rejects a `file://` string — it accepts paths and `URL` objects only. The
 * trailing slash is required: pdfjs validates it before use.
 *
 * Candidates are probed on disk rather than trusted, because the two ways of
 * locating the directory each fail in a different environment:
 *
 *   • `process.cwd()/node_modules/...` is where the standalone server finds it,
 *     since `outputFileTracingIncludes` copies `standard_fonts` there.
 *   • `createRequire(...).resolve` is what works when running from source, but
 *     webpack cannot statically analyse the call — it reports "module
 *     .createRequire failed parsing argument" at build time and the call then
 *     throws in the bundled output.
 *
 * Taking the first candidate that actually contains a font file means neither
 * environment depends on the other's mechanism working.
 */

/** Present in every pdfjs release; used to confirm a candidate is the real directory. */
const SENTINEL_FONT = 'LiberationSans-Regular.ttf';

let cached: string | null | undefined;

function candidates(): string[] {
  const found: string[] = [];

  found.push(
    path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts'),
  );

  try {
    // Any filename inside the project root works as the resolution anchor; the
    // file itself need not exist.
    const resolver = createRequire(path.join(process.cwd(), 'noop.js'));
    const entry = resolver.resolve('pdfjs-dist/package.json');
    found.push(path.join(path.dirname(entry), 'standard_fonts'));
  } catch {
    // Bundled build: resolution is unavailable, so the cwd candidate is all
    // there is. Not an error on its own.
  }

  return found;
}

export function standardFontsUrl(): string | undefined {
  if (cached !== undefined) return cached ?? undefined;

  cached = null;
  for (const directory of candidates()) {
    if (existsSync(path.join(directory, SENTINEL_FONT))) {
      cached = directory + path.sep;
      break;
    }
  }

  if (cached === null) {
    // Rendering still works; standard-font text may be degraded or absent.
    // That is a quiet quality regression rather than a failed conversion, which
    // is exactly why it is worth saying out loud once.
    logger.warn(
      'pdfjs standard fonts not found; PDF text using the standard 14 fonts may render incorrectly',
      { searched: candidates() },
    );
  }

  return cached ?? undefined;
}
