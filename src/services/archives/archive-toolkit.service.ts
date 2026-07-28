import 'server-only';

import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import * as tar from 'tar';

import { logger } from '@/lib/logger';
import {
  assertSafeEntryName,
  createEncryptedZip,
  createGzipFile,
  createSevenZip,
  extractGzip,
  extractRar,
  extractWithSevenZip,
  type ArchiveEntry,
} from '@/services/archives/formats';
import { getFormat } from '@/services/conversion/registry';
import { ConversionError } from '@/types/conversion';
import type { ArchiveOperation, ArchiveTarget } from '@/types/archives';
import { sanitizeFilename } from '@/lib/security';
import { fileExtension, formatExtension } from '@/utils';

/**
 * The three archive-toolkit operations.
 *
 * Extract opens an archive of any supported format and hands back its contents;
 * archive and protect go the other way, packing loose files into one download.
 * All of them run inside a workspace the caller deletes, so nothing survives a
 * job beyond the object the user asked for.
 */

export interface ArchiveTaskParams {
  target?: ArchiveTarget;
  compressionLevel?: number;
  password?: string;
  encryption?: 'aes256' | 'zipcrypto';
}

export interface ArchiveTaskInput {
  inputPaths: string[];
  inputNames: string[];
  workDir: string;
  outputPath: string;
  operation: ArchiveOperation;
  params: ArchiveTaskParams;
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

export interface ArchiveTaskResult {
  outputPath: string;
  mime: string;
  /** Extension the delivered file should carry. */
  extension: string;
  /** Filename stem, without extension. */
  stem: string;
  detail: string;
  entries: ArchiveEntry[];
}

const MIME_BY_TARGET: Record<ArchiveTarget, string> = {
  zip: 'application/zip',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  tgz: 'application/gzip',
  gz: 'application/gzip',
};

export async function runArchiveOperation(
  input: ArchiveTaskInput,
): Promise<ArchiveTaskResult> {
  switch (input.operation) {
    case 'EXTRACT':
      return extract(input);
    case 'ARCHIVE':
      return pack(input, input.params.target ?? 'zip');
    case 'PROTECT':
      return protect(input);
  }
}

/** Opens an archive and returns its contents. */
async function extract(input: ArchiveTaskInput): Promise<ArchiveTaskResult> {
  const archivePath = input.inputPaths[0]!;
  const originalName = input.inputNames[0]!;
  const format = getFormat(formatExtension(originalName))?.id ?? 'zip';

  const contents = path.join(input.workDir, 'contents');
  await mkdir(contents, { recursive: true });

  input.onProgress(15);

  const entries = await readInto(
    format,
    archivePath,
    originalName,
    contents,
    input,
  );

  input.onProgress(60);
  input.signal.throwIfAborted();

  const files = await listFiles(contents);
  if (files.length === 0) {
    throw new ConversionError(
      'The archive contained no files that could be extracted.',
    );
  }

  const stem = sanitizeFilename(stripArchiveExtension(originalName)) || 'files';

  // A single file is handed back as itself — wrapping one file in a ZIP just
  // to unwrap an archive would leave the user exactly where they started.
  if (files.length === 1) {
    const only = files[0]!;
    const delivered = path.join(input.workDir, path.basename(only));
    if (delivered !== path.join(contents, only)) {
      await copyFile(path.join(contents, only), delivered);
    }

    input.onProgress(95);
    return {
      outputPath: delivered,
      mime: 'application/octet-stream',
      extension: fileExtension(only) || 'bin',
      stem: sanitizeFilename(stripExtension(path.basename(only))) || stem,
      detail: `1 file extracted from ${format.toUpperCase()}`,
      entries,
    };
  }

  await createZip(contents, input.outputPath, 6);
  input.onProgress(95);

  return {
    outputPath: input.outputPath,
    mime: 'application/zip',
    extension: 'zip',
    stem,
    detail: `${files.length} files extracted from ${format.toUpperCase()}`,
    entries,
  };
}

/** Dispatches to the reader for the source format. */
async function readInto(
  format: string,
  archivePath: string,
  originalName: string,
  destination: string,
  input: ArchiveTaskInput,
): Promise<ArchiveEntry[]> {
  const { password } = input.params;

  switch (format) {
    case 'zip':
      // 7-Zip reads both plain and encrypted ZIPs, and is the only one of the
      // two readers that can decrypt, so the toolkit always uses it here.
      return extractWithSevenZip(archivePath, destination, {
        password,
        signal: input.signal,
      });
    case '7z':
      return extractWithSevenZip(archivePath, destination, {
        password,
        signal: input.signal,
      });
    case 'rar':
      return extractRar(archivePath, destination, { password });
    case 'gz':
      return extractGzip(archivePath, destination, originalName);
    case 'tar':
    case 'tgz':
      return extractTar(archivePath, destination, format === 'tgz');
    default:
      throw new ConversionError(
        `${format.toUpperCase()} archives cannot be opened here.`,
      );
  }
}

async function extractTar(
  archivePath: string,
  destination: string,
  gzip: boolean,
): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];

  try {
    await tar.extract({
      file: archivePath,
      cwd: destination,
      gzip,
      strict: true,
      preservePaths: false,
      onentry(entry) {
        assertSafeEntryName(entry.path);
        entries.push({
          name: entry.path,
          size: entry.size ?? 0,
          directory: entry.type === 'Directory',
          encrypted: false,
        });
      },
      filter(_path, entry) {
        const type = (entry as { type?: string }).type;
        return type !== 'SymbolicLink' && type !== 'Link';
      },
    });
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    throw new ConversionError(
      'The TAR archive could not be read. It may be corrupt or truncated.',
      { cause: error },
    );
  }

  return entries;
}

/** Packs the uploaded files into one archive. */
async function pack(
  input: ArchiveTaskInput,
  target: ArchiveTarget,
): Promise<ArchiveTaskResult> {
  const staging = await stage(input);
  const level = input.params.compressionLevel ?? 6;

  input.onProgress(45);

  switch (target) {
    case 'zip':
      await createZip(staging, input.outputPath, level);
      break;
    case '7z':
      await createSevenZip(staging, input.outputPath, {
        compressionLevel: level,
        signal: input.signal,
      });
      break;
    case 'tar':
      await createTar(staging, input.outputPath, false, level);
      break;
    case 'tgz':
      await createTar(staging, input.outputPath, true, level);
      break;
    case 'gz':
      await createGzipFile(staging, input.outputPath, level);
      break;
  }

  input.onProgress(95);

  return {
    outputPath: input.outputPath,
    mime: MIME_BY_TARGET[target],
    extension: target === 'tgz' ? 'tar.gz' : target,
    stem: archiveStem(input.inputNames),
    detail: `${input.inputNames.length} files archived`,
    entries: [],
  };
}

/** Packs the uploaded files into an encrypted ZIP. */
async function protect(input: ArchiveTaskInput): Promise<ArchiveTaskResult> {
  const password = input.params.password;
  if (!password) {
    throw new ConversionError('A password is required to protect an archive.');
  }

  const staging = await stage(input);
  input.onProgress(45);

  await createEncryptedZip(staging, input.outputPath, password, {
    encryption: input.params.encryption ?? 'aes256',
    compressionLevel: input.params.compressionLevel ?? 6,
    signal: input.signal,
  });

  input.onProgress(95);

  const scheme =
    input.params.encryption === 'zipcrypto' ? 'ZipCrypto' : 'AES-256';

  return {
    outputPath: input.outputPath,
    mime: 'application/zip',
    extension: 'zip',
    stem: archiveStem(input.inputNames),
    detail: `${input.inputNames.length} files, ${scheme} encrypted`,
    entries: [],
  };
}

/**
 * Copies the uploads into one directory under their original names, which is
 * what the packers read. Names are made unique so two uploads called
 * `notes.txt` do not silently become one entry.
 */
async function stage(input: ArchiveTaskInput): Promise<string> {
  const staging = path.join(input.workDir, 'staging');
  await mkdir(staging, { recursive: true });

  const used = new Set<string>();

  for (const [index, source] of input.inputPaths.entries()) {
    const original = path.basename(input.inputNames[index] ?? `file-${index}`);
    let name = sanitizeFilename(original) || `file-${index + 1}`;

    if (used.has(name)) {
      const extension = fileExtension(name);
      const stem = stripExtension(name);
      let counter = 2;
      while (used.has(name)) {
        name = extension
          ? `${stem} (${counter}).${extension}`
          : `${stem} (${counter})`;
        counter += 1;
      }
    }

    used.add(name);
    await copyFile(source, path.join(staging, name));
  }

  return staging;
}

function createZip(
  sourceDir: string,
  outputPath: string,
  compressionLevel: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: compressionLevel } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (warning) => {
      if (warning.code === 'ENOENT') {
        logger.warn('Archive entry missing while packing', {
          message: warning.message,
        });
        return;
      }
      reject(warning);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

async function createTar(
  sourceDir: string,
  outputPath: string,
  gzip: boolean,
  compressionLevel: number,
): Promise<void> {
  const entries = await readdir(sourceDir);

  await tar.create(
    {
      file: outputPath,
      cwd: sourceDir,
      gzip: gzip ? { level: compressionLevel } : false,
      portable: true,
      follow: false,
    },
    entries,
  );
}

/** Relative paths of every regular file under `directory`. */
async function listFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(path.join(directory, entry.name), relative)),
      );
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }

  return files;
}

/** `photos.tar.gz` → `photos`, `report.7z` → `report`. */
function stripArchiveExtension(name: string): string {
  return name.replace(/\.(tar\.gz|tgz|tar|zip|7z|rar|gz|gzip)$/i, '');
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** One file keeps its own name; several become `archive`. */
function archiveStem(names: string[]): string {
  if (names.length === 1) {
    return (
      sanitizeFilename(stripExtension(path.basename(names[0]!))) || 'archive'
    );
  }
  return 'archive';
}

/** Deletes a toolkit workspace, never throwing. */
export async function cleanWorkspace(workDir: string): Promise<void> {
  await rm(workDir, { recursive: true, force: true }).catch((error) => {
    logger.warn('Failed to clean archive workspace', { error });
  });
}

/** Size of a produced archive, for the empty-output guard. */
export async function outputSize(target: string): Promise<number> {
  return (await stat(target)).size;
}
