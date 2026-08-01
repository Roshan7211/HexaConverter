import 'server-only';

import { readFile, writeFile } from 'node:fs/promises';

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';

import { logger } from '@/lib/logger';
import { standardFontsUrl } from '@/services/documents/pdfjs-fonts';
import { ConversionError } from '@/types/conversion';

/**
 * PDF to Word.
 *
 * Text is extracted with PDF.js — pure JavaScript, so this works without
 * Poppler or LibreOffice — and rebuilt as a real DOCX with the `docx` writer.
 *
 * What this does and does not do, stated plainly because the difference
 * matters to anyone using it:
 *
 *   • Reflowable text, paragraph breaks and page breaks are preserved.
 *   • Headings are inferred from font size relative to the document's body
 *     text, so most titles come through as real Word headings.
 *   • Columns, tables, images and exact positioning are NOT preserved — the
 *     output is an editable document, not a visual facsimile.
 *   • A scanned PDF contains no text layer, so it yields nothing; the job
 *     fails with an explanation rather than an empty file.
 */

interface TextItem {
  text: string;
  /** Font height in PDF units, used to infer headings. */
  size: number;
  /** Vertical position, descending down the page. */
  y: number;
  x: number;
}

interface Line {
  text: string;
  size: number;
  y: number;
}

/** Gap, relative to line height, that separates paragraphs rather than lines. */
const PARAGRAPH_GAP = 1.6;

/** A line this much larger than body text is treated as a heading. */
const HEADING_RATIO = 1.35;
const SUBHEADING_RATIO = 1.15;

async function extractPages(bytes: Buffer): Promise<TextItem[][]> {
  // The legacy build is the one meant for Node; the default build assumes a
  // browser worker environment.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Keep the loading task: it owns the worker that has to be torn down.
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    // No system font probing and no font faces — this runs on untrusted input
    // in a server process.
    useSystemFonts: false,
    disableFontFace: true,
    // Extraction leans on the standard-14 metrics for character mapping, and
    // pdfjs only warns when it cannot reach them.
    standardFontDataUrl: standardFontsUrl(),
  });

  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    throw new ConversionError(
      'The PDF could not be read. It may be corrupt or password-protected.',
      { cause: error },
    );
  }

  const pages: TextItem[][] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const items: TextItem[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;

      // transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const [, , , scaleY, x, y] = item.transform as number[];
      items.push({
        text: item.str,
        size: Math.abs(scaleY ?? 12),
        x: x ?? 0,
        y: y ?? 0,
      });
    }

    pages.push(items);
    page.cleanup();
  }

  await task.destroy();
  return pages;
}

/** Groups items sharing a baseline into lines, ordered top to bottom. */
function toLines(items: TextItem[]): Line[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  let current: TextItem[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const ordered = [...current].sort((a, b) => a.x - b.x);
    lines.push({
      // PDF text items often split mid-word; join with a space only where the
      // pieces are not already separated.
      text: ordered
        .map((item) => item.text)
        .join('')
        .replace(/\s{2,}/g, ' ')
        .trim(),
      size: Math.max(...ordered.map((item) => item.size)),
      y: ordered[0]!.y,
    });
    current = [];
  };

  for (const item of sorted) {
    const previous = current[current.length - 1];
    // Same line when the baselines are within a couple of points.
    if (
      !previous ||
      Math.abs(previous.y - item.y) <= Math.max(2, item.size * 0.3)
    ) {
      current.push(item);
    } else {
      flush();
      current = [item];
    }
  }
  flush();

  return lines.filter((line) => line.text !== '');
}

/** The most common font size, taken as body text. */
function bodySize(lines: Line[]): number {
  const tally = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.size);
    tally.set(key, (tally.get(key) ?? 0) + line.text.length);
  }

  let best = 12;
  let bestWeight = 0;
  for (const [size, weight] of tally) {
    if (weight > bestWeight) {
      best = size;
      bestWeight = weight;
    }
  }
  return best;
}

export interface PdfToDocxResult {
  outputPath: string;
  mime: string;
  detail: string;
}

export async function convertPdfToDocx(
  inputPath: string,
  outputPath: string,
  onProgress: (percent: number) => void,
): Promise<PdfToDocxResult> {
  const bytes = await readFile(inputPath);
  onProgress(15);

  const pages = await extractPages(bytes);
  onProgress(55);

  const totalCharacters = pages
    .flat()
    .reduce((sum, item) => sum + item.text.trim().length, 0);

  if (totalCharacters === 0) {
    throw new ConversionError(
      'This PDF has no selectable text — it is most likely a scan. Converting it to Word would need OCR, which this tool does not perform.',
    );
  }

  const allLines = pages.map(toLines);
  const body = bodySize(allLines.flat());

  const children: Paragraph[] = [];
  let paragraphCount = 0;

  allLines.forEach((lines, pageIndex) => {
    if (pageIndex > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    let buffer: string[] = [];
    let bufferSize = body;

    const flushParagraph = () => {
      if (buffer.length === 0) return;

      const text = buffer
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      buffer = [];
      if (!text) return;

      paragraphCount += 1;

      const ratio = bufferSize / body;
      const heading =
        ratio >= HEADING_RATIO
          ? HeadingLevel.HEADING_1
          : ratio >= SUBHEADING_RATIO
            ? HeadingLevel.HEADING_2
            : undefined;

      children.push(
        new Paragraph({
          heading,
          alignment: AlignmentType.LEFT,
          spacing: { after: heading ? 160 : 120 },
          children: [
            new TextRun({
              text,
              size: heading ? undefined : Math.round(body * 2), // half-points
            }),
          ],
        }),
      );
    };

    lines.forEach((line, index) => {
      const previous = lines[index - 1];
      const gap = previous ? previous.y - line.y : 0;
      const sizeChanged = previous && Math.abs(previous.size - line.size) > 1.5;

      // A wide vertical gap or a font-size change starts a new paragraph.
      if (previous && (gap > line.size * PARAGRAPH_GAP || sizeChanged)) {
        flushParagraph();
      }

      buffer.push(line.text);
      bufferSize = line.size;
    });

    flushParagraph();
  });

  onProgress(80);

  const document = new Document({
    creator: 'HexaConverter',
    description: 'Converted from PDF',
    title: 'Converted document',
    sections: [{ properties: {}, children }],
  });

  await writeFile(outputPath, await Packer.toBuffer(document));
  onProgress(96);

  logger.info('PDF converted to DOCX', {
    pages: pages.length,
    paragraphs: paragraphCount,
  });

  return {
    outputPath,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    detail: `${pages.length} page${pages.length === 1 ? '' : 's'}, ${paragraphCount} paragraphs — text only`,
  };
}
