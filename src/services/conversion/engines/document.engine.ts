import { readFile, writeFile } from 'node:fs/promises';

import { marked } from 'marked';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sanitizeHtml from 'sanitize-html';

import { getFormat } from '@/services/conversion/registry';
import { rasterizeToPng } from '@/services/conversion/engines/image.engine';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
  type DocumentOptions,
} from '@/types/conversion';

/**
 * Document conversions that run fully in-process: Markdown, HTML, plain text
 * and image-to-PDF. Office formats are handled by the LibreOffice engine.
 */

/** Page dimensions in PDF points (1 pt = 1/72 in). */
const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
} as const satisfies Record<string, readonly [number, number]>;

const MM_TO_PT = 72 / 25.4;

/** Refuse text payloads large enough to exhaust memory during layout. */
const MAX_TEXT_BYTES = 20 * 1024 * 1024;

function pageDimensions(options: DocumentOptions): [number, number] {
  const [width, height] = PAGE_SIZES[options.pageSize ?? 'a4'];
  return options.orientation === 'landscape'
    ? [height, width]
    : [width, height];
}

async function readTextFile(path: string): Promise<string> {
  const buffer = await readFile(path);
  if (buffer.byteLength > MAX_TEXT_BYTES) {
    throw new ConversionError(
      'The text document is too large to convert. Split it into smaller files and try again.',
    );
  }
  // Strip a UTF-8 BOM so it does not render as a stray glyph.
  return buffer.toString('utf8').replace(/^﻿/, '');
}

/** Sanitiser profile for HTML the platform generates or passes through. */
const SANITIZE_PROFILE: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'blockquote',
    'pre',
    'code',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'del',
    'a',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
    'figure',
    'figcaption',
    'span',
    'div',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'],
    span: ['class'],
    div: ['class'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
  },
  // Only inert schemes survive: no `javascript:` or `vbscript:` URLs.
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  disallowedTagsMode: 'discard',
};

const HTML_SHELL = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 2.5rem 1.25rem; max-width: 46rem;
    font: 16px/1.7 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #18181b; background: #ffffff;
  }
  h1, h2, h3, h4 { line-height: 1.25; margin: 2rem 0 0.75rem; }
  pre { padding: 1rem; overflow-x: auto; background: #f4f4f5; border-radius: 8px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  blockquote { margin: 1.5rem 0; padding-left: 1rem; border-left: 3px solid #d4d4d8; color: #52525b; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  th, td { padding: 0.5rem 0.75rem; border: 1px solid #e4e4e7; text-align: left; }
  img { max-width: 100%; height: auto; }
  a { color: #4338ca; }
  @media (prefers-color-scheme: dark) {
    body { color: #e4e4e7; background: #09090b; }
    pre { background: #18181b; }
    th, td { border-color: #27272a; }
    blockquote { border-color: #3f3f46; color: #a1a1aa; }
    a { color: #a5b4fc; }
  }
</style>
</head>
<body>
${body}
</body>
</html>
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Converts HTML to readable plain text, preserving block structure. */
function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*(br|hr)\s*\/?>/gi, '\n')
    .replace(
      /<\/\s*(p|div|li|h[1-6]|tr|blockquote|pre|table|section|article)\s*>/gi,
      '\n\n',
    )
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\/\s*(td|th)\s*>/gi, '\t');

  const stripped = sanitizeHtml(withBreaks, {
    allowedTags: [],
    allowedAttributes: {},
    // Drop content that is never user-visible.
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'head'],
  });

  return stripped
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n');
}

async function markdownToHtml(markdown: string): Promise<string> {
  const rendered = await marked.parse(markdown, { gfm: true, breaks: false });
  return sanitizeHtml(rendered, SANITIZE_PROFILE);
}

/**
 * Lays plain text out as a paginated PDF using the built-in Helvetica font.
 * Characters outside WinAnsi are transliterated because the standard 14 fonts
 * cannot encode them.
 */
async function textToPdf(
  text: string,
  options: DocumentOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setProducer('HexaConverter');
  pdf.setCreator('HexaConverter');
  pdf.setCreationDate(new Date());

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const [pageWidth, pageHeight] = pageDimensions(options);
  const margin = (options.marginMm ?? 18) * MM_TO_PT;
  const fontSize = 10.5;
  const lineHeight = fontSize * 1.45;
  const maxWidth = pageWidth - margin * 2;

  const lines: string[] = [];
  for (const rawLine of toWinAnsi(text).split('\n')) {
    if (rawLine.trim() === '') {
      lines.push('');
      continue;
    }
    lines.push(...wrapLine(rawLine, font, fontSize, maxWidth));
  }

  const linesPerPage = Math.max(
    1,
    Math.floor((pageHeight - margin * 2) / lineHeight),
  );
  const pageCount = Math.max(1, Math.ceil(lines.length / linesPerPage));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const slice = lines.slice(
      pageIndex * linesPerPage,
      (pageIndex + 1) * linesPerPage,
    );

    slice.forEach((line, lineIndex) => {
      if (!line) return;
      page.drawText(line, {
        x: margin,
        y: pageHeight - margin - lineHeight * (lineIndex + 1),
        size: fontSize,
        font,
        color: rgb(0.09, 0.09, 0.11),
      });
    });
  }

  return pdf.save();
}

/** Greedy word wrap measured against the embedded font's real metrics. */
function wrapLine(
  line: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = line.split(/(\s+)/);
  const output: string[] = [];
  let current = '';

  const widthOf = (value: string) => font.widthOfTextAtSize(value, fontSize);

  for (const word of words) {
    const candidate = current + word;
    if (widthOf(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current.trim()) output.push(current.trimEnd());
    current = word.trimStart();

    // A single token longer than the line must be broken by character.
    while (widthOf(current) > maxWidth && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && widthOf(current.slice(0, cut)) > maxWidth) cut -= 1;
      output.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }

  if (current.trim()) output.push(current.trimEnd());
  return output.length > 0 ? output : [''];
}

/** Maps common non-Latin-1 typography to WinAnsi-safe equivalents. */
const TRANSLITERATIONS: Array<[RegExp, string]> = [
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
  [/[–—―]/g, '-'],
  [/…/g, '...'],
  [/•/g, '*'],
  [/ /g, ' '],
  [/[←-⇿]/g, '->'],
  [/\t/g, '    '],
];

function toWinAnsi(text: string): string {
  let output = text.replace(/\r\n/g, '\n');
  for (const [pattern, replacement] of TRANSLITERATIONS) {
    output = output.replace(pattern, replacement);
  }
  // Anything still outside the encodable range becomes '?' rather than
  // throwing during layout.
  return output.replace(/[^\n\x20-\x7E\xA1-\xFF]/g, '?');
}

/**
 * Wraps one or more images in a PDF, one page per image, in the order given.
 *
 * A single image is just the one-page case of this, so there is no separate
 * path for it — which is what keeps page sizing, margins and centring
 * identical whether the user converts one file or twenty.
 *
 * Images are rasterised and embedded one at a time rather than decoded up
 * front: a twenty-file batch of large photographs would otherwise hold every
 * decoded bitmap in memory at once.
 */
async function imagesToPdf(
  inputPaths: readonly string[],
  options: DocumentOptions,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setProducer('HexaConverter');
  pdf.setCreator('HexaConverter');
  pdf.setCreationDate(new Date());

  const [pageWidth, pageHeight] = pageDimensions(options);
  const margin = (options.marginMm ?? 10) * MM_TO_PT;

  for (const [index, inputPath] of inputPaths.entries()) {
    const { data, width, height } = await rasterizeToPng(inputPath);
    const embedded = await pdf.embedPng(data);

    // Fit inside the margins without ever enlarging: upscaling a small image
    // to fill A4 makes it blurry, which reads as a conversion defect.
    const scale = Math.min(
      (pageWidth - margin * 2) / width,
      (pageHeight - margin * 2) / height,
      1,
    );
    const drawWidth = width * scale;
    const drawHeight = height * scale;

    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });

    onProgress?.((index + 1) / inputPaths.length);
  }

  return pdf.save();
}

export const documentEngine: ConversionEngine = {
  id: 'document',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    const { sourceFormat, targetFormat, options } = context;
    const target = getFormat(targetFormat);
    const source = getFormat(sourceFormat);

    if (!target || !source) {
      throw new ConversionError(
        `Unsupported conversion: ${sourceFormat} to ${targetFormat}`,
      );
    }

    context.onProgress(10);

    // Any image can be wrapped in a PDF. Several images become one PDF with a
    // page each, in the order the user arranged them.
    if (source.category === 'image' && targetFormat === 'pdf') {
      const inputPaths = [
        context.inputPath,
        ...(context.extraInputPaths ?? []),
      ];

      const bytes = await imagesToPdf(inputPaths, options, (fraction) => {
        // 10% was reported before this branch; leave headroom for the write.
        context.onProgress(10 + Math.round(fraction * 85));
      });

      await writeFile(context.outputPath, bytes);
      context.onProgress(100);

      return {
        outputPath: context.outputPath,
        mime: 'application/pdf',
        detail:
          inputPaths.length > 1
            ? `${inputPaths.length} images combined into ${inputPaths.length} pages`
            : undefined,
      };
    }

    const pair = `${sourceFormat}>${targetFormat}`;

    switch (pair) {
      case 'md>html': {
        const html = await markdownToHtml(
          await readTextFile(context.inputPath),
        );
        context.onProgress(70);
        await writeFile(
          context.outputPath,
          HTML_SHELL('Converted document', html),
          'utf8',
        );
        break;
      }
      case 'md>txt': {
        const html = await markdownToHtml(
          await readTextFile(context.inputPath),
        );
        context.onProgress(70);
        await writeFile(context.outputPath, htmlToText(html), 'utf8');
        break;
      }
      case 'html>txt': {
        const source_ = await readTextFile(context.inputPath);
        context.onProgress(60);
        await writeFile(context.outputPath, htmlToText(source_), 'utf8');
        break;
      }
      case 'txt>html': {
        const text = await readTextFile(context.inputPath);
        context.onProgress(60);
        const paragraphs = text
          .split(/\n{2,}/)
          .map(
            (block) =>
              `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`,
          )
          .join('\n');
        await writeFile(
          context.outputPath,
          HTML_SHELL('Converted document', paragraphs),
          'utf8',
        );
        break;
      }
      case 'txt>pdf': {
        const text = await readTextFile(context.inputPath);
        context.onProgress(50);
        const bytes = await textToPdf(text, options);
        await writeFile(context.outputPath, bytes);
        break;
      }
      default:
        throw new ConversionError(
          `Converting ${source.label} to ${target.label} is not supported.`,
        );
    }

    context.onProgress(100);
    return { outputPath: context.outputPath, mime: target.mime };
  },
};
