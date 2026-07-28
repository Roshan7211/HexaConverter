import { createServer, type Server } from 'node:net';
import { Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The clamd INSTREAM client, exercised against a socket server that speaks the
 * protocol back.
 *
 * Worth testing at this level because the failure that matters is silent: a
 * scanner that answers something unexpected must never be read as "clean", or
 * the product goes on claiming files are checked while nothing is checked.
 */

let server: Server | null = null;

afterEach(async () => {
  delete process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_PORT;

  if (server) {
    await new Promise((resolve) => server!.close(resolve));
    server = null;
  }
  // The env module caches, so each case needs a fresh module graph.
  vi.resetModules();
});

/**
 * A fake clamd: reads the INSTREAM framing and replies with `reply`.
 * Returns the total payload length it received, so the framing itself is
 * checked rather than assumed.
 */
async function fakeClamd(
  reply: string,
): Promise<{ port: number; received: () => number }> {
  let received = 0;

  server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let sawCommand = false;

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      if (!sawCommand) {
        const end = buffer.indexOf(0);
        if (end < 0) return;
        sawCommand = true;
        buffer = buffer.subarray(end + 1);
      }

      // Each chunk is a 4-byte big-endian length followed by that many bytes;
      // a zero length ends the stream.
      for (;;) {
        if (buffer.byteLength < 4) return;
        const length = buffer.readUInt32BE(0);

        if (length === 0) {
          socket.write(reply);
          socket.end();
          return;
        }
        if (buffer.byteLength < 4 + length) return;

        received += length;
        buffer = buffer.subarray(4 + length);
      }
    });
  });

  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server!.address();
  if (typeof address === 'string' || !address) throw new Error('No port');

  return { port: address.port, received: () => received };
}

async function loadScanner(port: number) {
  process.env.CLAMAV_HOST = '127.0.0.1';
  process.env.CLAMAV_PORT = String(port);
  return import('@/services/upload/scanner.service');
}

describe('malware scanner', () => {
  it('reports a clean file and forwards every byte', async () => {
    const clamd = await fakeClamd('stream: OK\0');
    const { scanStream } = await loadScanner(clamd.port);

    const payload = Buffer.alloc(70_000, 7);
    const verdict = await scanStream(Readable.from([payload]));

    expect(verdict).toEqual({ status: 'clean' });
    expect(clamd.received()).toBe(payload.byteLength);
  });

  it('reports the signature when clamd finds something', async () => {
    const clamd = await fakeClamd('stream: Eicar-Test-Signature FOUND\0');
    const { scanStream } = await loadScanner(clamd.port);

    const verdict = await scanStream(Readable.from([Buffer.from('x')]));

    expect(verdict).toEqual({
      status: 'infected',
      signature: 'Eicar-Test-Signature',
    });
  });

  it('throws rather than guessing when the reply is unrecognised', async () => {
    // The dangerous outcome is treating an error reply as a pass.
    const clamd = await fakeClamd('ERROR: size limit exceeded\0');
    const { scanStream } = await loadScanner(clamd.port);

    await expect(scanStream(Readable.from([Buffer.from('x')]))).rejects.toThrow(
      /Unexpected scanner reply/,
    );
  });

  it('rejects the upload when a configured scanner is unreachable', async () => {
    // Nothing is listening on this port.
    const { assertClean, ScannerUnavailableError } = await loadScanner(1);

    await expect(
      assertClean(async () => Readable.from([Buffer.from('x')]), {
        name: 'file.png',
      }),
    ).rejects.toBeInstanceOf(ScannerUnavailableError);
  });

  it('skips, and says so, when no scanner is configured', async () => {
    vi.resetModules();
    delete process.env.CLAMAV_HOST;

    const { assertClean, describeScanning, isScannerConfigured } =
      await import('@/services/upload/scanner.service');

    expect(isScannerConfigured()).toBe(false);
    expect(describeScanning()).toMatch(/not signature-scanned/);
    await expect(
      assertClean(async () => Readable.from([Buffer.from('x')]), {
        name: 'file.png',
      }),
    ).resolves.toEqual({ status: 'skipped', reason: 'No scanner configured' });
  });

  it('surfaces an infection as a rejection, not a verdict to ignore', async () => {
    const clamd = await fakeClamd('stream: Win.Test.EICAR_HDB-1 FOUND\0');
    const { assertClean, InfectedUploadError } = await loadScanner(clamd.port);

    await expect(
      assertClean(async () => Readable.from([Buffer.from('x')]), {
        name: 'invoice.pdf',
      }),
    ).rejects.toBeInstanceOf(InfectedUploadError);
  });
});
