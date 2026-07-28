import 'server-only';

import { connect, type Socket } from 'node:net';
import type { Readable } from 'node:stream';

import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Malware scanning.
 *
 * Signature scanning is delegated to ClamAV, which is a separate daemon: this
 * module speaks clamd's INSTREAM protocol over a socket. It is therefore
 * *optional* — with no `CLAMAV_HOST` configured there is no scanning at all,
 * and `describeScanning()` says so rather than implying protection that is not
 * there. What always applies, scanner or not, is containment: uploads are
 * identified by their magic bytes, never executed, never served back with an
 * executable content type, and deleted on a timer.
 *
 * Enforcement is deliberate about failure. When a scanner is configured but
 * unreachable, uploads are rejected rather than waved through — a scanner that
 * silently stops working is worse than no scanner, because the product goes on
 * claiming files are checked.
 */

export type ScanVerdict =
  | { status: 'clean' }
  | { status: 'infected'; signature: string }
  | { status: 'skipped'; reason: string };

/** clamd's INSTREAM ends with a zero-length chunk; replies are NUL-terminated. */
const TERMINATOR = Buffer.from([0, 0, 0, 0]);
const CHUNK_HEADER_BYTES = 4;

export function isScannerConfigured(): boolean {
  return Boolean(serverEnv().CLAMAV_HOST);
}

/** One line describing the scanning posture, for the health endpoint and docs. */
export function describeScanning(): string {
  return isScannerConfigured()
    ? 'Uploads are scanned by ClamAV before they can be converted.'
    : 'No malware scanner is configured; uploads are content-verified and isolated but not signature-scanned.';
}

/**
 * Streams `source` to clamd and returns its verdict.
 *
 * The stream is consumed either way, so callers can pipe the same data they
 * are about to store without buffering the file twice.
 */
export async function scanStream(source: Readable): Promise<ScanVerdict> {
  const env = serverEnv();

  if (!env.CLAMAV_HOST) {
    source.resume(); // Drain, so a caller piping into us is not left hanging.
    return { status: 'skipped', reason: 'No scanner configured' };
  }

  const socket = connect({
    host: env.CLAMAV_HOST,
    port: env.CLAMAV_PORT,
    timeout: env.CLAMAV_TIMEOUT_MS,
  });

  try {
    const reply = await instream(socket, source, env.CLAMAV_TIMEOUT_MS);
    return interpret(reply);
  } finally {
    socket.destroy();
  }
}

function instream(
  socket: Socket,
  source: Readable,
  timeoutMs: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let reply = '';
    let settled = false;

    const finish = (error: Error | null, value?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      source.destroy();
      if (error) reject(error);
      else resolve(value!);
    };

    const timer = setTimeout(
      () => finish(new Error('The malware scanner timed out.')),
      timeoutMs,
    );

    socket.on('error', (error) => finish(error));
    socket.on('timeout', () =>
      finish(new Error('The malware scanner timed out.')),
    );
    socket.on('data', (data: Buffer) => {
      reply += data.toString('utf8');
      // clamd answers once, NUL-terminated, and may answer early on a hit.
      if (reply.includes('\0')) finish(null, reply);
    });
    socket.on('close', () => finish(null, reply));

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');

      source.on('data', (chunk: Buffer) => {
        const header = Buffer.allocUnsafe(CHUNK_HEADER_BYTES);
        header.writeUInt32BE(chunk.byteLength, 0);
        // Respect backpressure: clamd is slower than the disk feeding it.
        if (!socket.write(Buffer.concat([header, chunk]))) {
          source.pause();
          socket.once('drain', () => source.resume());
        }
      });

      source.on('end', () => socket.write(TERMINATOR));
      source.on('error', (error) => finish(error));
    });
  });
}

function interpret(reply: string): ScanVerdict {
  const text = reply.replace(/\0/g, '').trim();

  if (/\bOK$/.test(text)) return { status: 'clean' };

  const found = /^stream:\s*(.+?)\s+FOUND$/i.exec(text);
  if (found) return { status: 'infected', signature: found[1]! };

  throw new Error(`Unexpected scanner reply: ${text.slice(0, 200)}`);
}

export class InfectedUploadError extends Error {
  constructor(readonly signature: string) {
    super(
      'This file was rejected because a malware scan identified it as harmful.',
    );
    this.name = 'InfectedUploadError';
  }
}

export class ScannerUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      'Uploads are temporarily unavailable because the malware scanner cannot be reached.',
    );
    this.name = 'ScannerUnavailableError';
    this.cause = cause;
  }
}

/**
 * Scans a stored object and throws unless it is clean.
 *
 * A configured-but-broken scanner fails the upload: quietly accepting files
 * while the scanner is down is exactly the situation this is meant to prevent.
 */
export async function assertClean(
  open: () => Promise<Readable>,
  context: { name: string },
): Promise<ScanVerdict> {
  if (!isScannerConfigured()) {
    return { status: 'skipped', reason: 'No scanner configured' };
  }

  let verdict: ScanVerdict;
  try {
    verdict = await scanStream(await open());
  } catch (error) {
    logger.error('Malware scan failed', { error, name: context.name });
    throw new ScannerUnavailableError(error);
  }

  if (verdict.status === 'infected') {
    logger.warn('Rejected an infected upload', {
      name: context.name,
      signature: verdict.signature,
    });
    throw new InfectedUploadError(verdict.signature);
  }

  return verdict;
}
