import 'server-only';

import { PDFDocument } from 'pdf-lib';
import { createWorker, type Worker } from 'tesseract.js';

import { logger } from '@/lib/logger';
import { ConversionError } from '@/types/conversion';

/**
 * Optical character recognition.
 *
 * Uses tesseract.js — the WebAssembly build — rather than the native binary,
 * unlike LibreOffice and Poppler which are supplied by the host. That is a
 * deliberate departure: native Tesseract needs ten C libraries built for the
 * platform, which makes the service unrunnable on any machine where those are
 * awkward to obtain and adds a provisioning step to every deployment. The WASM
 * build is the same engine, runs identically everywhere Node does, and costs
 * roughly two to three times the CPU. For work that is Premium-only and
 * measured in pages rather than requests, that is the right trade.
 *
 * The language data is fetched once and cached by tesseract.js on first use.
 */

/** Recognition is slow; a runaway page must not hold a worker forever. */
const PAGE_TIMEOUT_MS = 120_000;

/**
 * Pages are rendered at this DPI before recognition.
 *
 * Below about 150 the engine starts guessing at ordinary body text, and above
 * 300 the accuracy gain is marginal while the pixel count — and so the time —
 * grows quadratically. 200 is the usual sweet spot for scanned documents.
 */
export const OCR_DPI = 200;

export type OcrOutput = 'text' | 'pdf';

export interface OcrPageResult {
  text: string;
  /** Single-page searchable PDF, when `output` is `pdf`. */
  pdf?: Uint8Array;
  /** Mean per-word confidence, 0-100. */
  confidence: number;
}

/**
 * Runs recognition over already-rendered page images.
 *
 * One worker is created for the whole run and reused: spinning one up costs
 * well over a second, which would dominate a ten-page document.
 */
export async function recognisePages(
  pages: Array<{ image: Buffer }>,
  options: {
    output: OcrOutput;
    language?: string;
    signal?: AbortSignal;
    onPage?: (done: number, total: number) => void;
  },
): Promise<OcrPageResult[]> {
  if (pages.length === 0) {
    throw new ConversionError('There was nothing to read in that file.');
  }

  const language = options.language ?? 'eng';
  let worker: Worker | null = null;

  try {
    worker = await createWorker(language);
  } catch (error) {
    logger.error('OCR worker failed to start', { language, error });
    throw new ConversionError(
      'Text recognition is unavailable at the moment. Please try again shortly.',
      { cause: error },
    );
  }

  const results: OcrPageResult[] = [];

  try {
    for (const [index, page] of pages.entries()) {
      if (options.signal?.aborted) {
        throw new ConversionError('Cancelled at your request.');
      }

      const recognised = await withTimeout(
        worker.recognize(
          page.image,
          {},
          { text: true, pdf: options.output === 'pdf' },
        ),
        PAGE_TIMEOUT_MS,
        `Page ${index + 1} took too long to read.`,
      );

      results.push({
        text: recognised.data.text ?? '',
        pdf: recognised.data.pdf
          ? Uint8Array.from(recognised.data.pdf)
          : undefined,
        confidence: recognised.data.confidence ?? 0,
      });

      options.onPage?.(index + 1, pages.length);
    }
  } finally {
    // Terminating releases the WASM heap. Skipping it leaks tens of megabytes
    // per job, which on a small host is a handful of jobs before trouble.
    await worker.terminate().catch(() => undefined);
  }

  return results;
}

/** Joins per-page text with a page marker, so the output stays navigable. */
export function joinPageText(pages: OcrPageResult[]): string {
  if (pages.length === 1) return pages[0]!.text.trim();

  return pages
    .map((page, index) => `--- Page ${index + 1} ---\n\n${page.text.trim()}`)
    .join('\n\n');
}

/** Combines the per-page searchable PDFs into one document. */
export async function mergePagePdfs(
  pages: OcrPageResult[],
): Promise<Uint8Array> {
  const parts = pages.filter((page) => page.pdf);

  if (parts.length === 0) {
    throw new ConversionError('No searchable pages could be produced.');
  }

  if (parts.length === 1) return parts[0]!.pdf!;

  const merged = await PDFDocument.create();

  for (const part of parts) {
    const source = await PDFDocument.load(part.pdf!);
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) merged.addPage(page);
  }

  return merged.save();
}

/** Mean confidence across pages, for the summary shown on the finished job. */
export function meanConfidence(pages: OcrPageResult[]): number {
  const scored = pages.filter((page) => page.confidence > 0);
  if (scored.length === 0) return 0;

  const total = scored.reduce((sum, page) => sum + page.confidence, 0);
  return Math.round(total / scored.length);
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ConversionError(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
