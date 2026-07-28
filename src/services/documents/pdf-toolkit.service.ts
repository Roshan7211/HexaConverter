import 'server-only';

import { createWriteStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import archiver from 'archiver';
import { PDFDocument, degrees } from 'pdf-lib';

import { requirementPath, runCommand } from '@/services/conversion/binaries';
import {
  groupConsecutive,
  resolvePages,
} from '@/services/documents/page-selection';
import { ConversionError } from '@/types/conversion';
import type { PageSelection, PdfOperation } from '@/types/documents';

/**
 * PDF toolkit.
 *
 * Operations that rearrange a PDF rather than convert its format: merge,
 * split, extract, rotate and compress. Everything except compression runs on
 * pdf-lib in pure JavaScript, so the toolkit works on a default install with no
 * external binaries — compression alone benefits from Ghostscript and degrades
 * to a lossless rewrite without it.
 */

/** Refuse documents large enough to exhaust memory: pdf-lib works in-memory. */
const MAX_PDF_BYTES = 200 * 1024 * 1024;

/** Ceiling on a merge, to bound both memory and the output size. */
export const MAX_MERGE_FILES = 30;

/** Ceiling on pages produced by a split, to bound the ZIP. */
const MAX_SPLIT_PAGES = 500;

export interface PdfTaskInput {
  /** Absolute paths on local disk, in the order the user arranged them. */
  inputPaths: string[];
  /** Original filenames, parallel to `inputPaths`, used for output naming. */
  inputNames: string[];
  outputPath: string;
  operation: PdfOperation;
  params: PdfParams;
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

export interface PdfParams {
  /** `EXTRACT_PAGES` / `SPLIT`: which pages, 1-based. */
  pages?: PageSelection;
  /** `ROTATE`: clockwise degrees. */
  angle?: 90 | 180 | 270;
  /** `SPLIT`: one file per page, or one file per selected range. */
  splitMode?: 'pages' | 'ranges';
  /** `COMPRESS`: how aggressive to be. */
  compression?: 'light' | 'balanced' | 'strong';
}

export interface PdfTaskResult {
  outputPath: string;
  mime: string;
  /** Human-readable summary shown on the finished job. */
  detail: string;
  /** Suggested filename stem, without extension. */
  stem: string;
}

async function loadPdf(filePath: string): Promise<PDFDocument> {
  const stats = await stat(filePath);
  if (stats.size > MAX_PDF_BYTES) {
    throw new ConversionError(
      'That PDF is too large for this tool. Documents up to 200 MB are supported.',
    );
  }

  const bytes = await readFile(filePath);

  try {
    // `ignoreEncryption` lets us read permission-protected files, which are
    // common and harmless; password-protected files still fail below.
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch (error) {
    throw new ConversionError(
      'The PDF could not be opened. It may be corrupt or password-protected.',
      { cause: error },
    );
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

async function merge(task: PdfTaskInput): Promise<PdfTaskResult> {
  if (task.inputPaths.length < 2) {
    throw new ConversionError('Select at least two PDFs to merge.');
  }
  if (task.inputPaths.length > MAX_MERGE_FILES) {
    throw new ConversionError(
      `Up to ${MAX_MERGE_FILES} files can be merged at once.`,
    );
  }

  const merged = await PDFDocument.create();
  let pages = 0;

  for (const [index, filePath] of task.inputPaths.entries()) {
    task.signal.throwIfAborted();

    const source = await loadPdf(filePath);
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) merged.addPage(page);
    pages += copied.length;

    task.onProgress(10 + ((index + 1) / task.inputPaths.length) * 80);
  }

  merged.setProducer('HexaConverter');
  merged.setCreationDate(new Date());

  await writeFile(
    task.outputPath,
    await merged.save({ useObjectStreams: true }),
  );

  return {
    outputPath: task.outputPath,
    mime: 'application/pdf',
    detail: `${task.inputPaths.length} files, ${pages} pages`,
    stem: 'merged',
  };
}

async function extractPages(task: PdfTaskInput): Promise<PdfTaskResult> {
  const source = await loadPdf(task.inputPaths[0]!);
  const indices = resolvePages(task.params.pages, source.getPageCount());

  task.onProgress(35);

  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, indices);
  for (const page of copied) output.addPage(page);

  output.setProducer('HexaConverter');
  await writeFile(
    task.outputPath,
    await output.save({ useObjectStreams: true }),
  );

  return {
    outputPath: task.outputPath,
    mime: 'application/pdf',
    detail: `${indices.length} of ${source.getPageCount()} pages`,
    stem: 'extracted',
  };
}

async function rotate(task: PdfTaskInput): Promise<PdfTaskResult> {
  const pdf = await loadPdf(task.inputPaths[0]!);
  const angle = task.params.angle ?? 90;
  const indices = resolvePages(task.params.pages, pdf.getPageCount());
  const target = new Set(indices);

  task.onProgress(40);

  pdf.getPages().forEach((page, index) => {
    if (!target.has(index)) return;
    // Rotation is cumulative: honour whatever the page already carried.
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  });

  await writeFile(task.outputPath, await pdf.save({ useObjectStreams: true }));

  return {
    outputPath: task.outputPath,
    mime: 'application/pdf',
    detail: `${indices.length} page${indices.length === 1 ? '' : 's'} rotated ${angle}°`,
    stem: 'rotated',
  };
}

async function split(task: PdfTaskInput): Promise<PdfTaskResult> {
  const source = await loadPdf(task.inputPaths[0]!);
  const pageCount = source.getPageCount();

  if (pageCount < 2) {
    throw new ConversionError(
      'This PDF has a single page, so there is nothing to split.',
    );
  }

  const indices = resolvePages(task.params.pages, pageCount);
  if (indices.length > MAX_SPLIT_PAGES) {
    throw new ConversionError(
      `Splitting is limited to ${MAX_SPLIT_PAGES} pages at a time.`,
    );
  }

  // `ranges` keeps consecutive runs together; `pages` emits one file per page.
  const groups =
    task.params.splitMode === 'ranges'
      ? groupConsecutive(indices)
      : indices.map((index) => [index]);

  const stem = path.parse(task.inputNames[0] ?? 'document').name || 'document';
  const parts: Array<{ name: string; bytes: Uint8Array }> = [];

  for (const [position, group] of groups.entries()) {
    task.signal.throwIfAborted();

    const output = await PDFDocument.create();
    const copied = await output.copyPages(source, group);
    for (const page of copied) output.addPage(page);
    output.setProducer('HexaConverter');

    const label =
      group.length === 1
        ? `page-${group[0]! + 1}`
        : `pages-${group[0]! + 1}-${group[group.length - 1]! + 1}`;

    parts.push({
      name: `${stem}-${label}.pdf`,
      bytes: await output.save({ useObjectStreams: true }),
    });

    task.onProgress(15 + ((position + 1) / groups.length) * 70);
  }

  // A single resulting part is delivered as a plain PDF; several become a ZIP.
  if (parts.length === 1) {
    await writeFile(task.outputPath, parts[0]!.bytes);
    return {
      outputPath: task.outputPath,
      mime: 'application/pdf',
      detail: '1 document',
      stem: path.parse(parts[0]!.name).name,
    };
  }

  await zipParts(parts, task.outputPath);

  return {
    outputPath: task.outputPath,
    mime: 'application/zip',
    detail: `${parts.length} documents`,
    stem: `${stem}-split`,
  };
}

function zipParts(
  parts: Array<{ name: string; bytes: Uint8Array }>,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    for (const part of parts) {
      archive.append(Buffer.from(part.bytes), { name: part.name });
    }
    void archive.finalize();
  });
}

/** Ghostscript quality presets, from gentlest to most aggressive. */
const GS_PRESET: Record<NonNullable<PdfParams['compression']>, string> = {
  light: '/prepress',
  balanced: '/ebook',
  strong: '/screen',
};

async function compress(task: PdfTaskInput): Promise<PdfTaskResult> {
  const before = (await stat(task.inputPaths[0]!)).size;
  const level = task.params.compression ?? 'balanced';

  task.onProgress(20);

  const ghostscript = await requirementPath('ghostscript');

  if (ghostscript) {
    // Ghostscript is the only option here that genuinely recompresses images;
    // pdf-lib can only rewrite the object structure.
    await runCommand(
      ghostscript,
      [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.7',
        `-dPDFSETTINGS=${GS_PRESET[level]}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dDetectDuplicateImages=true',
        '-dCompressFonts=true',
        `-sOutputFile=${task.outputPath}`,
        task.inputPaths[0]!,
      ],
      { timeoutMs: 5 * 60 * 1000, signal: task.signal },
    );
  } else {
    // Lossless fallback: re-save with object streams, dropping unreferenced
    // objects and redundant structure. Modest, but never damages the file.
    const pdf = await loadPdf(task.inputPaths[0]!);
    await writeFile(
      task.outputPath,
      await pdf.save({ useObjectStreams: true, addDefaultPage: false }),
    );
  }

  task.onProgress(90);

  const after = (await stat(task.outputPath)).size;

  // A "compressed" file that grew is worse than doing nothing — keep the
  // original rather than hand back a bigger document.
  if (after >= before) {
    await writeFile(task.outputPath, await readFile(task.inputPaths[0]!));
    return {
      outputPath: task.outputPath,
      mime: 'application/pdf',
      detail: 'already optimised — original kept',
      stem: 'compressed',
    };
  }

  const saved = Math.round(((before - after) / before) * 100);

  return {
    outputPath: task.outputPath,
    mime: 'application/pdf',
    detail: `${saved}% smaller${ghostscript ? '' : ' (lossless rewrite)'}`,
    stem: 'compressed',
  };
}

const OPERATIONS: Record<
  PdfOperation,
  (task: PdfTaskInput) => Promise<PdfTaskResult>
> = {
  MERGE: merge,
  SPLIT: split,
  EXTRACT_PAGES: extractPages,
  ROTATE: rotate,
  COMPRESS: compress,
};

export async function runPdfOperation(
  task: PdfTaskInput,
): Promise<PdfTaskResult> {
  const handler = OPERATIONS[task.operation];
  if (!handler) {
    throw new ConversionError(`Unsupported operation: ${task.operation}`);
  }

  task.onProgress(8);
  const result = await handler(task);
  task.onProgress(100);

  return result;
}

/** Page count, for validating a selection before a job is queued. */
export async function readPageCount(filePath: string): Promise<number> {
  return (await loadPdf(filePath)).getPageCount();
}
