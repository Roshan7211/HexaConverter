import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import archiver from 'archiver';

import {
  popplerTool,
  requirementPath,
  runCommand,
} from '@/services/conversion/binaries';
import {
  extractPdfText,
  rasterisePdf,
  type RasterFormat,
} from '@/services/documents/pdf-raster.service';
import { getFormat } from '@/services/conversion/registry';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
} from '@/types/conversion';

/**
 * PDF rasterisation and text extraction.
 *
 * Two implementations, chosen at run time. Poppler (`pdftoppm`, `pdftotext`) is
 * preferred where it exists: it is faster on large documents and handles CMYK
 * better. Where it does not — serverless, or any host without system packages —
 * the same work is done in-process with `pdfjs-dist` and a prebuilt canvas.
 *
 * The fallback is what makes this route work at all on a platform that cannot
 * install binaries. Both paths produce identical output shapes, so nothing
 * downstream needs to know which ran.
 *
 * A PDF with more than one page produces one image per page, which are
 * delivered as a single ZIP archive — the job's output MIME type reflects that
 * so the download is named correctly.
 */

const RENDER_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_PAGES = 500;

const FORMAT_FLAG: Record<string, string> = {
  jpg: '-jpeg',
  png: '-png',
  tiff: '-tiff',
};

function parsePageRange(pages: string | undefined): {
  first?: number;
  last?: number;
} {
  if (!pages || pages === 'all') return {};

  const [start, end] = pages.split('-');
  const first = Number(start);
  if (!Number.isInteger(first) || first < 1) return {};

  if (end === undefined) return { first, last: first };

  const last = Number(end);
  if (!Number.isInteger(last) || last < first) return { first, last: first };

  return { first, last: Math.min(last, first + MAX_PAGES - 1) };
}

export const pdfRenderEngine: ConversionEngine = {
  id: 'pdf-render',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    const hasPoppler = Boolean(await requirementPath('poppler'));

    if (context.targetFormat === 'txt') {
      return hasPoppler ? extractText(context) : extractTextInProcess(context);
    }

    return hasPoppler ? renderPages(context) : renderPagesInProcess(context);
  },
};

// --- In-process fallback ----------------------------------------------------

/**
 * Renders with `pdfjs-dist` when Poppler is absent.
 *
 * Deliberately mirrors `renderPages` rather than sharing its body: that one is
 * organised around a child process writing numbered files into a directory,
 * this one around buffers in memory. Forcing both through one abstraction would
 * obscure each.
 */
async function renderPagesInProcess(
  context: ConversionContext,
): Promise<ConversionOutcome> {
  const target = getFormat(context.targetFormat);
  const format = context.targetFormat as RasterFormat;

  if (!target || !FORMAT_FLAG[context.targetFormat]) {
    throw new ConversionError(
      `Unsupported target format: ${context.targetFormat}`,
    );
  }

  context.onProgress(15);

  const pages = await rasterisePdf(
    await readFile(context.inputPath),
    format,
    {
      dpi: context.options.dpi,
      pages: context.options.pages,
      quality: context.options.quality,
    },
    (done, total) => {
      // 15–85 spans the render; the remainder is encoding and packaging.
      context.onProgress(15 + Math.round((done / total) * 70));
    },
  );

  if (pages.length === 0) {
    throw new ConversionError(
      'No pages could be rendered. The PDF may be encrypted or contain no printable content.',
    );
  }

  if (pages.length === 1) {
    await writeFile(context.outputPath, pages[0]!.data);
    context.onProgress(100);
    return { outputPath: context.outputPath, mime: target.mime };
  }

  const workDir = path.join(tmpdir(), `hexa-pdfjs-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  try {
    const width = String(pages.at(-1)!.pageNumber).length;
    const names: string[] = [];

    for (const page of pages) {
      // Zero-padded so a lexical sort in the archive matches page order.
      const name = `page-${String(page.pageNumber).padStart(width, '0')}.${context.targetFormat}`;
      await writeFile(path.join(workDir, name), page.data);
      names.push(name);
    }

    await zipDirectory(workDir, context.outputPath, names);
    context.onProgress(100);

    return {
      outputPath: context.outputPath,
      mime: 'application/zip',
      detail: `${pages.length} pages`,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function extractTextInProcess(
  context: ConversionContext,
): Promise<ConversionOutcome> {
  context.onProgress(25);

  const text = await extractPdfText(await readFile(context.inputPath), {
    pages: context.options.pages,
  });

  await writeFile(context.outputPath, text, 'utf8');
  context.onProgress(100);

  return { outputPath: context.outputPath, mime: 'text/plain' };
}

async function extractText(
  context: ConversionContext,
): Promise<ConversionOutcome> {
  const pdftotext = await popplerTool('pdftotext');
  if (!pdftotext) {
    throw new ConversionError(
      'PDF text extraction is not available on this server.',
    );
  }

  context.onProgress(25);

  const { first, last } = parsePageRange(context.options.pages);
  const args = ['-layout', '-enc', 'UTF-8', '-nopgbrk'];
  if (first) args.push('-f', String(first));
  if (last) args.push('-l', String(last));
  args.push(context.inputPath, context.outputPath);

  await runCommand(pdftotext, args, {
    timeoutMs: RENDER_TIMEOUT_MS,
    signal: context.signal,
  });

  context.onProgress(100);
  return { outputPath: context.outputPath, mime: 'text/plain' };
}

async function renderPages(
  context: ConversionContext,
): Promise<ConversionOutcome> {
  const pdftoppm = await requirementPath('poppler');
  const target = getFormat(context.targetFormat);
  const flag = FORMAT_FLAG[context.targetFormat];

  if (!pdftoppm || !target || !flag) {
    throw new ConversionError(
      `Unsupported target format: ${context.targetFormat}`,
    );
  }

  const workDir = path.join(tmpdir(), `hexa-pdf-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  try {
    const dpi = context.options.dpi ?? 150;
    const { first, last } = parsePageRange(context.options.pages);

    const args = [flag, '-r', String(dpi)];
    if (context.targetFormat === 'jpg') args.push('-jpegopt', 'quality=90');
    if (first) args.push('-f', String(first));
    args.push('-l', String(last ?? MAX_PAGES));
    args.push(context.inputPath, path.join(workDir, 'page'));

    context.onProgress(25);

    await runCommand(pdftoppm, args, {
      timeoutMs: RENDER_TIMEOUT_MS,
      signal: context.signal,
    });

    context.onProgress(75);

    const produced = (await readdir(workDir)).filter((entry) =>
      entry.startsWith('page'),
    );
    produced.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

    if (produced.length === 0) {
      throw new ConversionError(
        'No pages could be rendered. The PDF may be encrypted or contain no printable content.',
      );
    }

    if (produced.length === 1) {
      const single = path.join(workDir, produced[0]!);
      await rename(single, context.outputPath).catch(async (error) => {
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
        const { copyFile } = await import('node:fs/promises');
        await copyFile(single, context.outputPath);
      });

      context.onProgress(100);
      return { outputPath: context.outputPath, mime: target.mime };
    }

    await zipDirectory(workDir, context.outputPath, produced);
    context.onProgress(100);

    return {
      outputPath: context.outputPath,
      mime: 'application/zip',
      detail: `${produced.length} pages`,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function zipDirectory(
  sourceDir: string,
  outputPath: string,
  entries: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (warning) => {
      if (warning.code !== 'ENOENT') reject(warning);
    });

    archive.pipe(output);
    for (const entry of entries) {
      archive.file(path.join(sourceDir, entry), { name: entry });
    }
    void archive.finalize();
  });
}
