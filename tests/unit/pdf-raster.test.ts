import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  extractPdfText,
  rasterisePdf,
  resolvePageRange,
} from '@/services/documents/pdf-raster.service';

/**
 * PDF rasterisation without Poppler.
 *
 * These exercise the fallback that lets `pdf → jpg/png/tiff/txt` work on hosts
 * that cannot install system binaries. Everything runs against a real PDF built
 * here rather than a fixture, so the test states what it depends on.
 */

let sample: Buffer;

beforeAll(async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const colours = [
    rgb(0.85, 0.2, 0.2),
    rgb(0.2, 0.7, 0.35),
    rgb(0.2, 0.35, 0.85),
  ];

  for (let index = 0; index < 3; index += 1) {
    const page = pdf.addPage([595.28, 841.89]); // A4
    page.drawRectangle({
      x: 60,
      y: 500,
      width: 300,
      height: 180,
      color: colours[index]!,
    });
    page.drawText(`Page number ${index + 1}`, {
      x: 60,
      y: 720,
      size: 28,
      font,
    });
    page.drawText('HexaConverter rasterisation test', {
      x: 60,
      y: 680,
      size: 14,
      font,
    });
  }

  sample = Buffer.from(await pdf.save());
});

describe('page range resolution', () => {
  it('defaults to every page', () => {
    expect(resolvePageRange(undefined, 3)).toEqual([1, 2, 3]);
    expect(resolvePageRange('all', 3)).toEqual([1, 2, 3]);
  });

  it('accepts a single page and a range', () => {
    expect(resolvePageRange('2', 5)).toEqual([2]);
    expect(resolvePageRange('2-4', 5)).toEqual([2, 3, 4]);
  });

  it('clamps a range that runs past the end', () => {
    expect(resolvePageRange('2-99', 3)).toEqual([2, 3]);
  });

  it('returns nothing when the range starts past the end', () => {
    expect(resolvePageRange('9', 3)).toEqual([]);
  });

  it('falls back to everything for nonsense input', () => {
    expect(resolvePageRange('abc', 2)).toEqual([1, 2]);
    expect(resolvePageRange('0', 2)).toEqual([1, 2]);
  });
});

describe('rasterising', () => {
  it('renders every page to JPEG', async () => {
    const pages = await rasterisePdf(sample, 'jpg', { dpi: 150 });
    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);

    const meta = await sharp(pages[0]!.data).metadata();
    expect(meta.format).toBe('jpeg');
    // A4 is 8.27in wide; at 150 dpi that is ~1240px.
    expect(Math.round(meta.width! / 10) * 10).toBe(1240);
    // JPEG cannot carry alpha, and the page was flattened onto white.
    expect(meta.hasAlpha).toBe(false);
  });

  it('renders onto white paper rather than a transparent void', async () => {
    // A PDF page has no background. Without an explicit fill this comes out
    // black in JPEG, which looks like a broken conversion.
    const [page] = await rasterisePdf(sample, 'jpg', { dpi: 72, pages: '1' });
    const stats = await sharp(page!.data).stats();
    expect(stats.channels[0]!.mean).toBeGreaterThan(200);
  });

  it('actually draws the text, not just the shapes', async () => {
    // The standard 14 fonts are not embedded in a PDF; pdfjs needs to be told
    // where its substitutes live. Miss that and it only *warns*, then renders a
    // page with the artwork present and every glyph absent. Cropping to the
    // text band and looking for dark pixels is what distinguishes the two.
    const [page] = await rasterisePdf(sample, 'png', { dpi: 150, pages: '1' });
    const { width } = await sharp(page!.data).metadata();

    const band = await sharp(page!.data)
      // The heading sits near the top; the coloured rectangle is far below it.
      .extract({ left: 0, top: 180, width: width!, height: 120 })
      .greyscale()
      .raw()
      .toBuffer();

    const darkPixels = band.filter((value) => value < 128).length;
    expect(darkPixels).toBeGreaterThan(200);
  });

  it('honours a page selection', async () => {
    const pages = await rasterisePdf(sample, 'png', { dpi: 72, pages: '2' });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.pageNumber).toBe(2);
    expect((await sharp(pages[0]!.data).metadata()).format).toBe('png');
  });

  it('encodes TIFF', async () => {
    const pages = await rasterisePdf(sample, 'tiff', { dpi: 72, pages: '1-2' });
    expect(pages).toHaveLength(2);
    expect((await sharp(pages[0]!.data).metadata()).format).toBe('tiff');
  });

  it('scales resolution with dpi', async () => {
    const low = await rasterisePdf(sample, 'png', { dpi: 72, pages: '1' });
    const high = await rasterisePdf(sample, 'png', { dpi: 288, pages: '1' });

    const lowWidth = (await sharp(low[0]!.data).metadata()).width!;
    const highWidth = (await sharp(high[0]!.data).metadata()).width!;

    expect(Math.round(highWidth / lowWidth)).toBe(4);
  });

  it('refuses a range outside the document rather than producing nothing', async () => {
    await expect(rasterisePdf(sample, 'png', { pages: '99' })).rejects.toThrow(
      /outside the document/i,
    );
  });
});

describe('text extraction', () => {
  it('reads text from every page', async () => {
    const text = await extractPdfText(sample);
    expect(text).toContain('Page number 1');
    expect(text).toContain('Page number 3');
    expect(text).toContain('rasterisation test');
  });

  it('honours a page selection', async () => {
    const text = await extractPdfText(sample, { pages: '2' });
    expect(text).toContain('Page number 2');
    expect(text).not.toContain('Page number 1');
  });
});
