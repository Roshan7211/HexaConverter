import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import archiver from 'archiver';
import StreamZip from 'node-stream-zip';
import * as tar from 'tar';

import {
  assertSafeEntryName,
  createGzipFile,
  createSevenZip,
  extractGzip,
  extractRar,
  extractWithSevenZip,
} from '@/services/archives/formats';
import { getFormat } from '@/services/conversion/registry';
import { logger } from '@/lib/logger';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
} from '@/types/conversion';

/**
 * Archive repackaging between ZIP, TAR, TAR.GZ, 7Z, RAR and GZIP.
 *
 * Extraction is the security-sensitive step: entries are rejected if they
 * escape the destination directory (Zip Slip), if the archive declares more
 * entries than the limit, or if the inflated size exceeds the budget — the
 * standard defences against zip bombs and path-traversal archives.
 */

const MAX_ENTRIES = 20_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
/** Maximum inflated:compressed ratio before an archive is treated as a bomb. */
const MAX_COMPRESSION_RATIO = 200;

async function extractZip(
  archivePath: string,
  destination: string,
): Promise<number> {
  const zip = new StreamZip.async({ file: archivePath, storeEntries: true });

  try {
    const entries = await zip.entries();
    const names = Object.keys(entries);

    if (names.length > MAX_ENTRIES) {
      throw new ConversionError(
        `The archive contains more than ${MAX_ENTRIES.toLocaleString()} entries, which exceeds the processing limit.`,
      );
    }

    let totalBytes = 0;
    for (const name of names) {
      const entry = entries[name]!;
      assertSafeEntryName(entry.name);
      totalBytes += entry.size;

      // Bit 0 of the general purpose flags marks an encrypted entry. Saying so
      // here turns "could not be read" into an instruction the user can act on.
      if ((entry.flags & 0x1) !== 0) {
        throw new ConversionError(
          'This archive is password protected. Enter its password to open it.',
        );
      }

      if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        throw new ConversionError(
          'The archive expands beyond the 4 GB processing limit.',
        );
      }
      if (
        entry.compressedSize > 1024 &&
        entry.size / Math.max(entry.compressedSize, 1) > MAX_COMPRESSION_RATIO
      ) {
        throw new ConversionError(
          'The archive has an abnormal compression ratio and was rejected for security reasons.',
        );
      }
    }

    await zip.extract(null, destination);
    return names.length;
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    throw new ConversionError(
      'The ZIP archive could not be read. It may be corrupt, encrypted or use an unsupported compression method.',
      { cause: error },
    );
  } finally {
    await zip.close().catch(() => undefined);
  }
}

async function extractTar(
  archivePath: string,
  destination: string,
  gzip: boolean,
): Promise<number> {
  let entryCount = 0;
  let totalBytes = 0;

  try {
    await tar.extract({
      file: archivePath,
      cwd: destination,
      gzip,
      // Reject absolute paths and `..` segments instead of sanitising silently.
      strict: true,
      preservePaths: false,
      onentry(entry) {
        entryCount += 1;
        totalBytes += entry.size ?? 0;

        if (entryCount > MAX_ENTRIES) {
          throw new ConversionError(
            `The archive contains more than ${MAX_ENTRIES.toLocaleString()} entries, which exceeds the processing limit.`,
          );
        }
        if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          throw new ConversionError(
            'The archive expands beyond the 4 GB processing limit.',
          );
        }
        assertSafeEntryName(entry.path);
      },
      filter(_entryPath, entry) {
        // Symlinks and hard links can point outside the extraction root.
        // `filter` receives a Stats object for some entries, which carries no
        // `type` field; those are regular files and are kept.
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

  return entryCount;
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
  const { readdir } = await import('node:fs/promises');
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

/** Counts the regular files an extraction produced, recursively. */
async function countFiles(directory: string): Promise<number> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(directory, { withFileTypes: true });

  let total = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      total += await countFiles(path.join(directory, entry.name));
    } else if (entry.isFile()) {
      total += 1;
    }
  }
  return total;
}

/**
 * An archive that yields nothing is either empty or silently failed to
 * decode. Repacking that would hand the user a valid but useless file, so it
 * is treated as an error while there is still context to explain it.
 */
async function assertExtractionNotEmpty(directory: string): Promise<void> {
  if ((await countFiles(directory)) === 0) {
    throw new ConversionError(
      'The archive contained no files that could be extracted.',
    );
  }
}

export const archiveEngine: ConversionEngine = {
  id: 'archive',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    const target = getFormat(context.targetFormat);
    if (!target) {
      throw new ConversionError(
        `Unsupported target format: ${context.targetFormat}`,
      );
    }

    const workDir = path.join(tmpdir(), `hexa-archive-${randomUUID()}`);
    const extractDir = path.join(workDir, 'contents');
    await mkdir(extractDir, { recursive: true });

    try {
      context.onProgress(10);

      const password = context.options.password;

      let entryCount: number;
      switch (context.sourceFormat) {
        case 'zip':
          // node-stream-zip cannot decrypt, so a ZIP the user supplied a
          // password for goes through 7-Zip instead.
          entryCount = password
            ? (
                await extractWithSevenZip(context.inputPath, extractDir, {
                  password,
                  signal: context.signal,
                })
              ).length
            : await extractZip(context.inputPath, extractDir);
          break;
        case 'tar':
          entryCount = await extractTar(context.inputPath, extractDir, false);
          break;
        case 'tgz':
          entryCount = await extractTar(context.inputPath, extractDir, true);
          break;
        case '7z':
          entryCount = (
            await extractWithSevenZip(context.inputPath, extractDir, {
              password,
              signal: context.signal,
            })
          ).length;
          break;
        case 'rar':
          entryCount = (
            await extractRar(context.inputPath, extractDir, { password })
          ).length;
          break;
        case 'gz':
          entryCount = (
            await extractGzip(context.inputPath, extractDir, context.inputName)
          ).length;
          break;
        default:
          throw new ConversionError(
            `Unsupported source format: ${context.sourceFormat}`,
          );
      }

      await assertExtractionNotEmpty(extractDir);

      context.onProgress(55);
      context.signal.throwIfAborted();

      const level = context.options.compressionLevel ?? 6;

      switch (context.targetFormat) {
        case 'zip':
          await createZip(extractDir, context.outputPath, level);
          break;
        case 'tar':
          await createTar(extractDir, context.outputPath, false, level);
          break;
        case 'tgz':
          await createTar(extractDir, context.outputPath, true, level);
          break;
        case '7z':
          await createSevenZip(extractDir, context.outputPath, {
            compressionLevel: level,
            signal: context.signal,
          });
          break;
        case 'gz':
          await createGzipFile(extractDir, context.outputPath, level);
          break;
        default:
          throw new ConversionError(
            `Unsupported target format: ${context.targetFormat}`,
          );
      }

      const stats = await stat(context.outputPath);
      if (stats.size === 0) {
        throw new ConversionError('The repackaged archive is empty.');
      }

      context.onProgress(100);
      return {
        outputPath: context.outputPath,
        mime: target.mime,
        detail: `${entryCount} entries`,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  },
};
