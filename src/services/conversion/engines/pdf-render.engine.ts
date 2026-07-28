import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import archiver from 'archiver';

import {
  popplerTool,
  requirementPath,
  runCommand,
} from '@/services/conversion/binaries';
import { getFormat } from '@/services/conversion/registry';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
} from '@/types/conversion';

/**
 * PDF rasterisation and text extraction via Poppler (`pdftoppm`, `pdftotext`).
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
    if (!(await requirementPath('poppler'))) {
      throw new ConversionError(
        'PDF rendering is not available on this server. Contact support if this persists.',
        { retryable: true },
      );
    }

    return context.targetFormat === 'txt'
      ? extractText(context)
      : renderPages(context);
  },
};

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
