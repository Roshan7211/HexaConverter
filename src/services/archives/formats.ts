import 'server-only';

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';

import { runCommand, sevenZipPath } from '@/services/conversion/binaries';
import { ConversionError } from '@/types/conversion';

/**
 * Readers and writers for the archive formats that need more than a JavaScript
 * library.
 *
 * 7z goes through the bundled 7-Zip binary, which also provides the AES-256
 * ZIP encryption no pure-JS zip writer implements. RAR goes through a WASM
 * build of the reference unrar sources — extraction only, because RAR
 * compression is proprietary and no free encoder exists.
 */

/** Wall-clock ceiling for a single archive command. */
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

export type ZipEncryption = 'aes256' | 'zipcrypto';

export interface ArchiveEntry {
  name: string;
  size: number;
  directory: boolean;
  encrypted: boolean;
}

/**
 * 7-Zip reports a wrong password as a generic non-zero exit, so the stderr
 * text is the only way to tell "you typed it wrong" from "this file is
 * broken" — and that distinction is the whole difference between a useful
 * error and a dead end.
 */
function translateSevenZipFailure(error: unknown): ConversionError {
  const text = error instanceof Error ? (error.cause as Error)?.message : '';
  const haystack = String(text ?? '');

  if (/Wrong password|Data Error in encrypted file/i.test(haystack)) {
    return new ConversionError(
      'That password did not open the archive. Check it and try again.',
    );
  }
  if (
    /Can not open (the )?file as archive|is not supported archive/i.test(
      haystack,
    )
  ) {
    return new ConversionError(
      'The archive could not be opened. It may be corrupt or use an unsupported compression method.',
    );
  }
  if (/Cannot open encrypted archive|Enter password/i.test(haystack)) {
    return new ConversionError(
      'This archive is password protected. Enter its password to open it.',
    );
  }
  return new ConversionError(
    'The archive could not be read. It may be corrupt or use an unsupported compression method.',
    { cause: error instanceof Error ? error : undefined },
  );
}

/** Entry count and inflated-size ceilings, matching the ZIP and TAR readers. */
const MAX_ENTRIES = 20_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

/**
 * Extracts anything 7-Zip can read (7z, and password-protected ZIP) into
 * `destination`.
 *
 * The listing is read first and every entry checked, rather than trusting the
 * extractor to sanitise paths: the limits and the traversal rule are then the
 * same ones the ZIP and TAR readers enforce, instead of whatever a given
 * 7-Zip build happens to do.
 */
export async function extractWithSevenZip(
  archivePath: string,
  destination: string,
  options: { password?: string; signal?: AbortSignal } = {},
): Promise<ArchiveEntry[]> {
  const entries = await listWithSevenZip(archivePath, options);

  if (entries.length > MAX_ENTRIES) {
    throw new ConversionError(
      `The archive contains more than ${MAX_ENTRIES.toLocaleString()} entries, which exceeds the processing limit.`,
    );
  }

  let total = 0;
  for (const entry of entries) {
    assertSafeEntryName(entry.name);
    total += entry.size;
    if (total > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new ConversionError(
        'The archive expands beyond the 4 GB processing limit.',
      );
    }
  }

  if (!options.password && entries.some((entry) => entry.encrypted)) {
    throw new ConversionError(
      'This archive is password protected. Enter its password to open it.',
    );
  }

  try {
    await runCommand(
      sevenZipPath(),
      [
        'x',
        archivePath,
        `-o${destination}`,
        '-y',
        // `-p` with an empty value stops 7-Zip prompting on stdin for an
        // encrypted archive, which would otherwise hang until the timeout.
        `-p${options.password ?? ''}`,
      ],
      {
        timeoutMs: COMMAND_TIMEOUT_MS,
        signal: options.signal,
        quiet: true,
      },
    );
  } catch (error) {
    throw translateSevenZipFailure(error);
  }

  return entries;
}

/** Packs the contents of `sourceDir` into a 7z archive. */
export async function createSevenZip(
  sourceDir: string,
  outputPath: string,
  options: { compressionLevel?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const level = clampLevel(options.compressionLevel);

  await runCommand(
    sevenZipPath(),
    ['a', '-t7z', `-mx=${level}`, '-y', outputPath, path.join(sourceDir, '*')],
    { timeoutMs: COMMAND_TIMEOUT_MS, signal: options.signal, cwd: sourceDir },
  );
}

/**
 * Packs `sourceDir` into a password-protected ZIP.
 *
 * AES-256 is real encryption; ZipCrypto is the legacy scheme, breakable with a
 * known-plaintext attack, and is offered only because some built-in operating
 * system unzippers still cannot open AES archives.
 */
export async function createEncryptedZip(
  sourceDir: string,
  outputPath: string,
  password: string,
  options: {
    encryption?: ZipEncryption;
    compressionLevel?: number;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  if (!password) {
    throw new ConversionError('A password is required to protect an archive.');
  }

  const level = clampLevel(options.compressionLevel);
  const method = options.encryption === 'zipcrypto' ? 'ZipCrypto' : 'AES256';

  await runCommand(
    sevenZipPath(),
    [
      'a',
      '-tzip',
      `-mx=${level}`,
      `-mem=${method}`,
      `-p${password}`,
      '-y',
      outputPath,
      path.join(sourceDir, '*'),
    ],
    { timeoutMs: COMMAND_TIMEOUT_MS, signal: options.signal, cwd: sourceDir },
  );
}

/** Lists an archive's entries without extracting it. */
export async function listWithSevenZip(
  archivePath: string,
  options: { password?: string } = {},
): Promise<ArchiveEntry[]> {
  let result;
  try {
    result = await runCommand(
      sevenZipPath(),
      ['l', '-slt', archivePath, `-p${options.password ?? ''}`],
      { timeoutMs: 60_000, quiet: true },
    );
  } catch (error) {
    throw translateSevenZipFailure(error);
  }

  const entries: ArchiveEntry[] = [];
  // `-slt` prints one `Key = Value` block per entry, blocks separated by a
  // blank line, after a `----------` divider.
  const body = result.stdout.split(/^----------\s*$/m)[1] ?? '';

  for (const block of body.split(/\n\s*\n/)) {
    const fields = new Map<string, string>();
    for (const line of block.split('\n')) {
      const split = line.indexOf(' = ');
      if (split > 0) {
        fields.set(line.slice(0, split).trim(), line.slice(split + 3).trim());
      }
    }

    const name = fields.get('Path');
    if (!name) continue;

    entries.push({
      name,
      size: Number(fields.get('Size') ?? 0) || 0,
      directory: (fields.get('Folder') ?? '') === '+',
      encrypted: (fields.get('Encrypted') ?? '') === '+',
    });
  }

  return entries;
}

/**
 * Extracts a RAR archive.
 *
 * unrar is compiled to WebAssembly, so this needs no binary on the host and
 * behaves identically in development and in the container.
 */
export async function extractRar(
  archivePath: string,
  destination: string,
  options: { password?: string } = {},
): Promise<ArchiveEntry[]> {
  const { createExtractorFromData, UnrarError } = await import('node-unrar-js');
  const { readFile } = await import('node:fs/promises');

  const data = await readFile(archivePath);

  try {
    const extractor = await createExtractorFromData({
      data: new Uint8Array(data).buffer as ArrayBuffer,
      password: options.password,
    });

    const extracted = extractor.extract({});
    const entries: ArchiveEntry[] = [];

    for (const file of extracted.files) {
      const header = file.fileHeader;
      assertSafeEntryName(header.name);

      entries.push({
        name: header.name,
        size: header.unpSize,
        directory: header.flags.directory,
        encrypted: header.flags.encrypted,
      });

      const target = path.join(destination, header.name);
      if (header.flags.directory) {
        await mkdir(target, { recursive: true });
        continue;
      }
      if (!file.extraction) continue;

      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(file.extraction));
    }

    return entries;
  } catch (error) {
    if (error instanceof ConversionError) throw error;

    const message = error instanceof Error ? error.message : '';
    if (error instanceof UnrarError || /password|encrypted/i.test(message)) {
      if (/password/i.test(message)) {
        throw new ConversionError(
          'This RAR archive is password protected. Enter its password to open it.',
        );
      }
      throw new ConversionError(
        'The RAR archive could not be read. It may be corrupt, or the password may be wrong.',
        { cause: error instanceof Error ? error : undefined },
      );
    }

    throw new ConversionError('The RAR archive could not be read.', {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

/** Decompresses a single-file gzip stream into `destination`. */
export async function extractGzip(
  archivePath: string,
  destination: string,
  originalName: string,
): Promise<ArchiveEntry[]> {
  // `report.json.gz` unpacks to `report.json`; a name without the extension
  // still has to produce something, hence the fallback.
  const inner = originalName.replace(/\.(gz|gzip)$/i, '');
  const name = inner && inner !== originalName ? inner : `${originalName}.out`;

  assertSafeEntryName(name);
  const target = path.join(destination, path.basename(name));

  await pipeline(
    createReadStream(archivePath),
    createGunzip(),
    createWriteStream(target),
  );

  const stats = await stat(target);
  return [
    {
      name: path.basename(name),
      size: stats.size,
      directory: false,
      encrypted: false,
    },
  ];
}

/**
 * Compresses a single file with gzip. GZIP is a stream format, not a container:
 * it holds exactly one file and no directory structure.
 */
export async function createGzipFile(
  sourceDir: string,
  outputPath: string,
  compressionLevel = 6,
): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());

  if (files.length !== 1) {
    throw new ConversionError(
      files.length === 0
        ? 'There is nothing to compress.'
        : `GZIP holds a single file, but this would contain ${files.length}. Choose TAR.GZ, ZIP or 7Z instead.`,
    );
  }

  await pipeline(
    createReadStream(path.join(sourceDir, files[0]!.name)),
    createGzip({ level: clampLevel(compressionLevel) }),
    createWriteStream(outputPath),
  );
}

/** Rejects entry names that would write outside the extraction root. */
export function assertSafeEntryName(name: string) {
  if (
    !name ||
    name.includes('\0') ||
    path.isAbsolute(name) ||
    /^[a-zA-Z]:[\\/]/.test(name) ||
    name.split(/[\\/]/).some((segment) => segment === '..')
  ) {
    throw new ConversionError(
      'The archive contains an unsafe file path and was rejected for security reasons.',
    );
  }
}

function clampLevel(level: number | undefined): number {
  if (typeof level !== 'number' || Number.isNaN(level)) return 6;
  return Math.min(9, Math.max(0, Math.round(level)));
}
