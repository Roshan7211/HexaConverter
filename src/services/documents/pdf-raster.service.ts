import 'server-only';

import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';

import { ConversionError } from '@/types/conversion';

/**
 * PDF rasterisation and text extraction without Poppler.
 *
 * `pdftoppm` is a system binary, which rules it out anywhere packages cannot be
 * installed — serverless in particular. This path renders with `pdfjs-dist`,
 * which is already a dependency (the PDF-to-Word route uses it), onto a
 * `@napi-rs/canvas` surface that ships prebuilt binaries rather than needing
 * Cairo on the host.
 *
 * Pixels are handed to `sharp` for encoding rather than using the canvas's own
 * encoders: sharp is already the image engine here, it covers TIFF as well as
 * JPEG and PNG, and it keeps quality and chroma settings in one place instead
 * of two.
 *
 * Poppler is still preferred when present — it is faster on large documents and
 * has better CMYK handling. This is the fallback that makes the route work
 * everywhere.
 */

/** PDF user-space is 72 units to the inch, so scale is simply dpi / 72. */
const PDF_UNITS_PER_INCH = 72;

/** Matches the Poppler path's ceiling. */
const MAX_PAGES = 500;

/**
 * Refuse a page that would rasterise to more pixels than sharp will accept.
 * A malicious PDF can declare an enormous MediaBox; at 600 dpi that becomes a
 * multi-gigabyte allocation.
 */
const MAX_PIXELS_PER_PAGE = 80_000_000;

export type RasterFormat = 'jpg' | 'png' | 'tiff';

export interface RasterOptions {
  dpi?: number;
  /** `all`, `3`, or `2-7`. */
  pages?: string;
  /** JPEG quality, 1–100. */
  quality?: number;
}

export interface RasterisedPage {
  /** 1-based page number in the source document. */
  pageNumber: number;
  data: Buffer;
}

interface LoadedPdf {
  pdf: Awaited<ReturnType<typeof loadDocument>>['pdf'];
  destroy: () => Promise<void>;
}

/**
 * Where pdfjs finds substitutes for the standard 14 PDF fonts.
 *
 * Without this, any page whose text uses Helvetica, Times or Courier — which is
 * most PDFs not produced with embedded fonts — rasterises with the text
 * *missing*. pdfjs only warns; it does not fail, so the result is a
 * plausible-looking page with nothing written on it.
 *
 * Resolution is anchored to `process.cwd()` rather than `import.meta.url`
 * because webpack rewrites the latter to a numeric module id when it bundles
 * this file for the server build. `createRequire` then receives a number and
 * throws, taking down every PDF route — including text extraction, which does
 * not otherwise need fonts at all.
 *
 * Returned as a file:// URL: pdfjs treats the value as a URL, not a path.
 */
let cachedFontsUrl: string | null | undefined;

function standardFontsUrl(): string | undefined {
  if (cachedFontsUrl !== undefined) return cachedFontsUrl ?? undefined;

  try {
    // Any filename inside the project root works as the resolution anchor; the
    // file itself need not exist.
    const resolver = createRequire(path.join(process.cwd(), 'noop.js'));
    const entry = resolver.resolve('pdfjs-dist/package.json');
    cachedFontsUrl = pathToFileURL(
      path.join(path.dirname(entry), 'standard_fonts/'),
    ).toString();
  } catch {
    // Rendering still works; standard-font text will be missing from it. That
    // is a degraded page rather than a failed conversion, so it is not fatal.
    cachedFontsUrl = null;
  }

  return cachedFontsUrl ?? undefined;
}

async function loadDocument(bytes: Buffer) {
  // The legacy build is the one meant for Node; the default build assumes a
  // browser worker environment.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // No system font probing and no font faces — this runs on untrusted input
    // in a server process.
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: standardFontsUrl(),
  });

  try {
    const pdf = await task.promise;
    return { pdf, destroy: () => task.destroy() };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    throw new ConversionError(
      'The PDF could not be read. It may be corrupt or password-protected.',
      { cause: error },
    );
  }
}

/** Resolves `all` / `3` / `2-7` against the document's real page count. */
export function resolvePageRange(
  pages: string | undefined,
  pageCount: number,
): number[] {
  const all = () =>
    Array.from({ length: Math.min(pageCount, MAX_PAGES) }, (_, i) => i + 1);

  if (!pages || pages === 'all') return all();

  const [start, end] = pages.split('-');
  const first = Number(start);
  if (!Number.isInteger(first) || first < 1) return all();

  const last = end === undefined ? first : Number(end);
  if (!Number.isInteger(last) || last < first) {
    return first <= pageCount ? [first] : [];
  }

  const selected: number[] = [];
  for (let n = first; n <= Math.min(last, pageCount); n += 1) {
    if (selected.length >= MAX_PAGES) break;
    selected.push(n);
  }
  return selected;
}

function encode(
  raw: Buffer,
  width: number,
  height: number,
  format: RasterFormat,
  quality: number,
) {
  const image = sharp(raw, { raw: { width, height, channels: 4 } });

  switch (format) {
    case 'jpg':
      // The canvas is opaque white behind the page, so flattening is a no-op
      // for content but guarantees JPEG never receives an alpha channel.
      return image
        .flatten({ background: '#ffffff' })
        .jpeg({ quality })
        .toBuffer();
    case 'png':
      return image.png({ compressionLevel: 9 }).toBuffer();
    case 'tiff':
      return image.tiff({ compression: 'lzw' }).toBuffer();
  }
}

/**
 * Renders the selected pages to encoded images.
 *
 * `onPage` fires after each page so a long document can report real progress
 * rather than jumping from 0 to 100.
 */
export async function rasterisePdf(
  bytes: Buffer,
  format: RasterFormat,
  options: RasterOptions = {},
  onPage?: (done: number, total: number) => void,
): Promise<RasterisedPage[]> {
  const { pdf, destroy }: LoadedPdf = await loadDocument(bytes);

  try {
    const scale = (options.dpi ?? 150) / PDF_UNITS_PER_INCH;
    const quality = options.quality ?? 90;
    const wanted = resolvePageRange(options.pages, pdf.numPages);

    if (wanted.length === 0) {
      throw new ConversionError(
        `That page range is outside the document, which has ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}.`,
      );
    }

    const rendered: RasterisedPage[] = [];

    for (const [index, pageNumber] of wanted.entries()) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const width = Math.max(1, Math.floor(viewport.width));
      const height = Math.max(1, Math.floor(viewport.height));

      if (width * height > MAX_PIXELS_PER_PAGE) {
        throw new ConversionError(
          `Page ${pageNumber} is too large to render at ${options.dpi ?? 150} dpi. Try a lower resolution.`,
        );
      }

      const canvas = createCanvas(width, height);
      const canvasContext = canvas.getContext('2d');

      // PDF pages are transparent by default; without this, anything that is
      // not drawn becomes black in JPEG and transparent in PNG, neither of
      // which is what a page of paper looks like.
      canvasContext.fillStyle = '#ffffff';
      canvasContext.fillRect(0, 0, width, height);

      await page.render({
        // pdfjs's types describe the browser's canvas API. The napi-rs surface
        // implements the same drawing operations, so the cast is the shape
        // mismatch of two type definitions rather than a behavioural gap.
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      const rgba = Buffer.from(
        canvasContext.getImageData(0, 0, width, height).data,
      );

      rendered.push({
        pageNumber,
        data: await encode(rgba, width, height, format, quality),
      });

      // Free the page's operator list before moving on; a 500-page document
      // otherwise accumulates every page's resources.
      page.cleanup();
      onPage?.(index + 1, wanted.length);
    }

    return rendered;
  } finally {
    await destroy().catch(() => undefined);
  }
}

/**
 * Extracts text, preserving line and paragraph breaks well enough to read.
 *
 * Items are grouped by their vertical position because pdfjs returns them in
 * drawing order, which is not reading order for multi-column layouts or for
 * text drawn out of sequence.
 */
export async function extractPdfText(
  bytes: Buffer,
  options: RasterOptions = {},
): Promise<string> {
  const { pdf, destroy }: LoadedPdf = await loadDocument(bytes);

  try {
    const wanted = resolvePageRange(options.pages, pdf.numPages);
    const out: string[] = [];

    for (const pageNumber of wanted) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      // Bucket by rounded baseline: items sharing one are the same visual line.
      const lines = new Map<number, Array<{ x: number; text: string }>>();

      for (const item of content.items) {
        if (!('str' in item) || item.str === '') continue;
        const transform = item.transform as number[];
        const x = transform[4] ?? 0;
        const y = Math.round(transform[5] ?? 0);
        const bucket = lines.get(y) ?? [];
        bucket.push({ x, text: item.str });
        lines.set(y, bucket);
      }

      const ordered = [...lines.entries()]
        // Descending y: PDF origin is bottom-left, so larger y is higher up.
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) =>
          items
            .sort((a, b) => a.x - b.x)
            .map((i) => i.text)
            .join('')
            .replace(/\s+/g, ' ')
            .trim(),
        );

      out.push(ordered.join('\n'));
      page.cleanup();
    }

    return out
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .concat('\n');
  } finally {
    await destroy().catch(() => undefined);
  }
}
