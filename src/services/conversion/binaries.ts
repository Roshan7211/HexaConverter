import { spawn } from 'node:child_process';
import { chmodSync, statSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';

import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { ConversionError, type Requirement } from '@/types/conversion';

/**
 * Resolution and probing of the external binaries used by the conversion
 * engines.
 *
 * ffmpeg/ffprobe come from bundled static builds so they are always present.
 * LibreOffice and Poppler are supplied by the runtime image; their presence is
 * probed once per process so routes that depend on them can be reported as
 * unavailable up front rather than failing halfway through a job.
 */

const CANDIDATE_PATHS: Record<Requirement, readonly string[]> = {
  libreoffice: [
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
    '/opt/libreoffice/program/soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ],
  poppler: [
    '/usr/bin/pdftoppm',
    '/usr/local/bin/pdftoppm',
    '/opt/homebrew/bin/pdftoppm',
  ],
  ghostscript: ['/usr/bin/gs', '/usr/local/bin/gs', '/opt/homebrew/bin/gs'],
};

/** Binary that must exist for a requirement to be considered satisfied. */
async function resolveRequirement(
  requirement: Requirement,
): Promise<string | null> {
  const env = serverEnv();

  const configured =
    requirement === 'libreoffice' ? env.SOFFICE_PATH : undefined;
  const candidates = configured
    ? [configured, ...CANDIDATE_PATHS[requirement]]
    : CANDIDATE_PATHS[requirement];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  // Fall back to PATH resolution.
  const name =
    requirement === 'libreoffice'
      ? 'soffice'
      : requirement === 'ghostscript'
        ? 'gs'
        : 'pdftoppm';

  return which(name);
}

async function which(command: string): Promise<string | null> {
  try {
    const result = await runCommand('/usr/bin/env', ['which', command], {
      timeoutMs: 5_000,
      quiet: true,
    });
    const resolved = result.stdout.trim().split('\n')[0]?.trim();
    return resolved || null;
  } catch {
    return null;
  }
}

const requirementCache = new Map<Requirement, Promise<string | null>>();

/** Absolute path to the binary backing a requirement, or `null` if missing. */
export function requirementPath(
  requirement: Requirement,
): Promise<string | null> {
  const cached = requirementCache.get(requirement);
  if (cached) return cached;

  const probe = resolveRequirement(requirement).then((path) => {
    logger.info('Probed conversion requirement', {
      requirement,
      available: Boolean(path),
      path: path ?? undefined,
    });
    return path;
  });

  requirementCache.set(requirement, probe);
  return probe;
}

export async function isRequirementAvailable(
  requirement: Requirement,
): Promise<boolean> {
  return (await requirementPath(requirement)) !== null;
}

/** Path to a sibling Poppler tool (`pdftotext`, `pdfinfo`). */
export async function popplerTool(name: string): Promise<string | null> {
  const base = await requirementPath('poppler');
  if (!base) return null;
  return base.replace(/pdftoppm$/, name);
}

export function ffmpegPath(): string {
  const configured = serverEnv().FFMPEG_PATH;
  if (configured) return configured;

  // ffmpeg-static exports the path to its bundled binary.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const resolved = require('ffmpeg-static') as string | null;
  if (!resolved) {
    throw new ConversionError(
      'The media encoder is unavailable on this server. Set FFMPEG_PATH to a valid ffmpeg binary.',
    );
  }
  return resolved;
}

export function ffprobePath(): string {
  const configured = serverEnv().FFPROBE_PATH;
  if (configured) return configured;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const resolved = require('ffprobe-static') as { path: string } | undefined;
  if (!resolved?.path) {
    throw new ConversionError(
      'The media analyser is unavailable on this server. Set FFPROBE_PATH to a valid ffprobe binary.',
    );
  }
  return resolved.path;
}

let sevenZipPathCache: string | null = null;

/**
 * Path to the bundled 7-Zip binary, used for 7z archives and for the AES
 * encryption that ZIP writers in JavaScript do not implement.
 *
 * The executable bit is set on first use: npm does not always preserve file
 * modes when installing from a registry tarball, and a 7za without `+x` fails
 * with a bare EACCES that says nothing about the cause.
 */
export function sevenZipPath(): string {
  if (sevenZipPathCache) return sevenZipPathCache;

  const configured = serverEnv().SEVEN_ZIP_PATH;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bundled = (require('7zip-bin') as { path7za?: string }).path7za;
  const resolved = configured || bundled;

  if (!resolved) {
    throw new ConversionError(
      'The archive tool is unavailable on this server. Set SEVEN_ZIP_PATH to a valid 7za binary.',
    );
  }

  try {
    if ((statSync(resolved).mode & 0o111) === 0) chmodSync(resolved, 0o755);
  } catch (error) {
    logger.warn('Could not verify the 7-Zip binary mode', { error });
  }

  sevenZipPathCache = resolved;
  return resolved;
}

export interface RunOptions {
  timeoutMs: number;
  cwd?: string;
  signal?: AbortSignal;
  /** Extra environment entries; the parent environment is inherited. */
  env?: Record<string, string>;
  /**
   * Suppresses the failure log. Used by capability probes, where a non-zero
   * exit means "not installed" rather than "something went wrong".
   */
  quiet?: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

const MAX_CAPTURED_OUTPUT = 64 * 1024;

/**
 * Spawns a binary with an argument array — never a shell string — so no part of
 * a filename or user-supplied option can be interpreted as a shell token.
 */
export function runCommand(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(
        new ConversionError(
          'The conversion exceeded the maximum allowed processing time.',
          { retryable: true },
        ),
      );
    }, options.timeoutMs);

    const onAbort = () => {
      child.kill('SIGKILL');
      finish(new ConversionError('The conversion was cancelled.'));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });

    function finish(error: Error | null, result?: RunResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(result!);
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURED_OUTPUT) stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURED_OUTPUT) stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      finish(
        new ConversionError('Failed to start the conversion process.', {
          cause: error,
        }),
      );
    });

    child.on('close', (code) => {
      if (code === 0) {
        finish(null, { stdout, stderr, code: 0 });
        return;
      }
      if (!options.quiet) {
        logger.warn('External command failed', {
          command,
          code,
          stderr: stderr.slice(-2_000),
        });
      }
      finish(
        new ConversionError(
          'The file could not be converted. It may be corrupt, password-protected or use an unsupported feature.',
          { cause: new Error(stderr.slice(-2_000)) },
        ),
      );
    });
  });
}

/** Test/ops helper — forces the next probe to re-resolve. */
export function clearRequirementCache() {
  requirementCache.clear();
}
