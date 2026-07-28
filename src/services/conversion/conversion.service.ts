import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { DocumentOperation } from '@prisma/client';

import {
  cleanWorkspace,
  runArchiveOperation,
} from '@/services/archives/archive-toolkit.service';
import { isRequirementAvailable } from '@/services/conversion/binaries';
import { archiveEngine } from '@/services/conversion/engines/archive.engine';
import { documentEngine } from '@/services/conversion/engines/document.engine';
import { findRoute, getFormat } from '@/services/conversion/registry';
import { imageEngine } from '@/services/conversion/engines/image.engine';
import { mediaEngine } from '@/services/conversion/engines/media.engine';
import { officeEngine } from '@/services/conversion/engines/office.engine';
import { pdfRenderEngine } from '@/services/conversion/engines/pdf-render.engine';
import { spreadsheetEngine } from '@/services/conversion/engines/spreadsheet.engine';
import { pdfTextEngine } from '@/services/documents/pdf-text.engine';
import {
  runPdfOperation,
  type PdfParams,
} from '@/services/documents/pdf-toolkit.service';
import {
  ConversionError,
  type ConversionEngine,
  type ConversionOptions,
  type ConversionRoute,
} from '@/types/conversion';
import { logger } from '@/lib/logger';
import { buildStorageKey, storage } from '@/services/storage';
import { sanitizeFilename } from '@/lib/security';
import { fileStem } from '@/utils';
import type { ArchiveOperation } from '@/types/archives';

/**
 * Conversion orchestrator.
 *
 * Resolves the route to an engine, materialises the input on local disk, runs
 * the engine inside a private temporary directory and streams the result back
 * to object storage. The temporary directory is always removed, including on
 * failure, so worker instances never accumulate residue.
 */

const ENGINES: Record<ConversionRoute['engine'], ConversionEngine> = {
  image: imageEngine,
  media: mediaEngine,
  document: documentEngine,
  spreadsheet: spreadsheetEngine,
  office: officeEngine,
  'pdf-render': pdfRenderEngine,
  'pdf-text': pdfTextEngine,
  archive: archiveEngine,
};

export interface RunConversionInput {
  inputKey: string;
  inputName: string;
  sourceFormat: string;
  targetFormat: string;
  options: ConversionOptions;
  onProgress: (percent: number) => void;
  signal: AbortSignal;
  /** Set for document-toolkit jobs; absent for format conversions. */
  operation?: DocumentOperation | null;
  /** Set for archive-toolkit jobs; absent for format conversions. */
  archiveOperation?: ArchiveOperation | null;
  /** Additional inputs for multi-file operations such as merge. */
  extraInputs?: Array<{ key: string; name: string }>;
}

export interface RunConversionResult {
  outputKey: string;
  outputName: string;
  outputSize: number;
  outputMime: string;
  detail?: string;
}

/**
 * Confirms the external tooling a route depends on is present. Called before a
 * job is queued so users get an immediate, accurate answer rather than a
 * failure minutes later.
 */
export async function routeAvailability(
  from: string,
  to: string,
): Promise<{ available: boolean; reason?: string }> {
  const route = findRoute(from, to);
  if (!route) {
    return { available: false, reason: 'This conversion is not supported.' };
  }
  if (!route.requires) return { available: true };

  if (await isRequirementAvailable(route.requires)) return { available: true };

  return {
    available: false,
    reason:
      route.requires === 'libreoffice'
        ? 'Office document conversion is temporarily unavailable.'
        : 'PDF rendering is temporarily unavailable.',
  };
}

export async function runConversion(
  input: RunConversionInput,
): Promise<RunConversionResult> {
  // Toolkit operations rearrange a document rather than change its format, so
  // they bypass the format registry entirely.
  if (input.operation) return runToolkitJob(input, input.operation);
  if (input.archiveOperation) {
    return runArchiveJob(input, input.archiveOperation);
  }

  const route = findRoute(input.sourceFormat, input.targetFormat);
  if (!route) {
    throw new ConversionError(
      `Converting ${input.sourceFormat.toUpperCase()} to ${input.targetFormat.toUpperCase()} is not supported.`,
    );
  }

  const availability = await routeAvailability(
    input.sourceFormat,
    input.targetFormat,
  );
  if (!availability.available) {
    throw new ConversionError(availability.reason!, { retryable: true });
  }

  const engine = ENGINES[route.engine];
  const targetSpec = getFormat(input.targetFormat)!;

  const workDir = path.join(tmpdir(), `hexa-job-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const startedAt = Date.now();
  const log = logger.child({
    engine: route.engine,
    from: input.sourceFormat,
    to: input.targetFormat,
  });

  try {
    const store = storage();

    // Engines shell out to native tools, so the source must exist as a real
    // file rather than a stream.
    const sourceExtension =
      input.sourceFormat === 'tgz' ? 'tar.gz' : input.sourceFormat;
    const inputPath = path.join(workDir, `source.${sourceExtension}`);
    await downloadTo(store, input.inputKey, inputPath);

    // Routes that fold several files into one output — images to a single PDF —
    // carry the rest here. Downloaded in order, because for a combined PDF the
    // order is the page order the user arranged.
    const extraInputPaths: string[] = [];
    for (const [index, extra] of (input.extraInputs ?? []).entries()) {
      const extraPath = path.join(
        workDir,
        `source-${index + 1}.${sourceExtension}`,
      );
      await downloadTo(store, extra.key, extraPath);
      extraInputPaths.push(extraPath);
    }

    const outputPath = path.join(workDir, `result.${input.targetFormat}`);

    input.onProgress(4);

    const outcome = await engine.run({
      inputPath,
      outputPath,
      inputName: input.inputName,
      extraInputPaths,
      extraInputNames: (input.extraInputs ?? []).map((extra) => extra.name),
      sourceFormat: input.sourceFormat,
      targetFormat: input.targetFormat,
      options: input.options,
      onProgress: input.onProgress,
      signal: input.signal,
    });

    const stats = await stat(outcome.outputPath);
    if (stats.size === 0) {
      throw new ConversionError('The conversion produced an empty file.');
    }

    // A multi-page PDF render is delivered as a ZIP of page images.
    const deliveredAsZip =
      outcome.mime === 'application/zip' && targetSpec.id !== 'zip';
    const extension = deliveredAsZip ? 'zip' : targetSpec.id;

    const outputKey = buildStorageKey('outputs', extension);
    // A combined output is not "the first file, converted", so naming it after
    // that file would misdescribe it. Count the pages instead.
    const stem =
      extraInputPaths.length > 0
        ? `combined-${extraInputPaths.length + 1}-images`
        : sanitizeFilename(fileStem(input.inputName)) || 'converted';
    const outputName = `${stem}.${extension}`;

    const outputSize = await store.putFromFile(outputKey, outcome.outputPath, {
      contentType: outcome.mime,
      contentLength: stats.size,
      ephemeral: true,
    });

    log.info('Conversion completed', {
      durationMs: Date.now() - startedAt,
      outputSize,
    });

    return {
      outputKey,
      outputName,
      outputSize,
      outputMime: outcome.mime,
      detail: outcome.detail,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch((error) => {
      log.warn('Failed to clean conversion workspace', { error });
    });
  }
}

/**
 * Runs a document-toolkit operation: every input is materialised locally, the
 * operation writes one artefact, and that artefact is uploaded like any other
 * conversion output.
 */
async function runToolkitJob(
  input: RunConversionInput,
  operation: DocumentOperation,
): Promise<RunConversionResult> {
  const workDir = path.join(tmpdir(), `hexa-pdf-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const log = logger.child({ operation });
  const startedAt = Date.now();

  try {
    const store = storage();

    const sources = [
      { key: input.inputKey, name: input.inputName },
      ...(input.extraInputs ?? []),
    ];

    const inputPaths: string[] = [];
    for (const [index, source] of sources.entries()) {
      const localPath = path.join(workDir, `input-${index}.pdf`);
      await downloadTo(store, source.key, localPath);
      inputPaths.push(localPath);
    }

    input.onProgress(6);

    const outputPath = path.join(workDir, 'result.bin');
    const result = await runPdfOperation({
      inputPaths,
      inputNames: sources.map((source) => source.name),
      outputPath,
      operation,
      params: input.options as PdfParams,
      onProgress: input.onProgress,
      signal: input.signal,
    });

    const stats = await stat(result.outputPath);
    if (stats.size === 0) {
      throw new ConversionError('The operation produced an empty file.');
    }

    const extension = result.mime === 'application/zip' ? 'zip' : 'pdf';
    const outputKey = buildStorageKey('outputs', extension);
    const outputName = `${sanitizeFilename(result.stem) || 'document'}.${extension}`;

    const outputSize = await store.putFromFile(outputKey, result.outputPath, {
      contentType: result.mime,
      contentLength: stats.size,
      ephemeral: true,
    });

    log.info('Toolkit operation completed', {
      durationMs: Date.now() - startedAt,
      outputSize,
      inputs: inputPaths.length,
    });

    return {
      outputKey,
      outputName,
      outputSize,
      outputMime: result.mime,
      detail: result.detail,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch((error) => {
      log.warn('Failed to clean toolkit workspace', { error });
    });
  }
}

/**
 * Runs an archive-toolkit job.
 *
 * Unlike a conversion, the delivered extension is decided by the operation
 * rather than the route: extracting a one-file archive returns that file under
 * its own name, so the output type is only known once the work is done.
 */
async function runArchiveJob(
  input: RunConversionInput,
  operation: ArchiveOperation,
): Promise<RunConversionResult> {
  const workDir = path.join(tmpdir(), `hexa-archive-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const log = logger.child({ archiveOperation: operation });
  const startedAt = Date.now();

  try {
    const store = storage();

    const sources = [
      { key: input.inputKey, name: input.inputName },
      ...(input.extraInputs ?? []),
    ];

    const inputPaths: string[] = [];
    for (const [index, source] of sources.entries()) {
      const localPath = path.join(workDir, `input-${index}`);
      await downloadTo(store, source.key, localPath);
      inputPaths.push(localPath);
    }

    input.onProgress(6);

    const result = await runArchiveOperation({
      inputPaths,
      inputNames: sources.map((source) => source.name),
      workDir,
      outputPath: path.join(workDir, 'result.bin'),
      operation,
      params: input.options,
      onProgress: input.onProgress,
      signal: input.signal,
    });

    const stats = await stat(result.outputPath);
    if (stats.size === 0) {
      throw new ConversionError('The operation produced an empty file.');
    }

    const outputKey = buildStorageKey('outputs', result.extension);
    const outputName = `${result.stem}.${result.extension}`;

    const outputSize = await store.putFromFile(outputKey, result.outputPath, {
      contentType: result.mime,
      contentLength: stats.size,
      ephemeral: true,
    });

    log.info('Archive operation completed', {
      durationMs: Date.now() - startedAt,
      outputSize,
      inputs: inputPaths.length,
    });

    return {
      outputKey,
      outputName,
      outputSize,
      outputMime: result.mime,
      detail: result.detail,
    };
  } finally {
    await cleanWorkspace(workDir);
  }
}

async function downloadTo(
  store: ReturnType<typeof storage>,
  key: string,
  destination: string,
): Promise<void> {
  const { createWriteStream } = await import('node:fs');
  const { pipeline } = await import('node:stream/promises');

  const source = await store.getStream(key);
  await pipeline(source, createWriteStream(destination));
}
