import { NextResponse } from 'next/server';

import { errors } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { logger } from '@/lib/logger';
import { RemoteFetchError, fetchRemoteFile } from '@/lib/security/remote-fetch';
import { clientIp, hashIp, sanitizeFilename } from '@/lib/security';
import { resolveRequester } from '@/services/identity/identity.service';

/**
 * POST /api/uploads/from-url
 *
 * Fetches a link the visitor pasted and streams it back to their browser, which
 * then hands it to the converter as an ordinary file.
 *
 * Sending the bytes back rather than straight into storage is a deliberate
 * trade. Everything the converter does — size checks, the format it infers,
 * the thumbnail, chunked upload, progress — is built around a real `File` in
 * the browser, and re-routing it around that would mean reworking the busiest
 * state machine in the app for one entry point. The cost is that the file
 * crosses the wire twice. That is worth it at the sizes people paste links for,
 * and it keeps this endpoint to one job: retrieving a URL safely.
 *
 * The safety is in `fetchRemoteFile`, which resolves every hop and refuses
 * anything pointing inside our network — without it this would be an open
 * proxy into the private network.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Refuses a body that grows past what the plan permits, mid-stream. */
function capped(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  let seen = 0;

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > maxBytes) {
          // A server that under-declares Content-Length, or declares none at
          // all, would otherwise stream us anything it liked.
          controller.error(new Error('Remote file exceeded the size limit'));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

export const POST = withErrorHandling(
  'POST /api/uploads/from-url',
  async (request) => {
    const limited = enforceRateLimit('urlImport', request);
    if (limited) return limited;

    const requester = await resolveRequester();

    const body = (await request.json().catch(() => null)) as {
      url?: unknown;
    } | null;

    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return errors.unprocessable('Paste a link to import.', {
        url: 'Paste a link to import.',
      });
    }

    try {
      const remote = await fetchRemoteFile(url, {
        maxBytes: requester.limits.maxFileBytes,
      });

      logger.info('Link import accepted', {
        declaredSize: remote.declaredSize,
        ipHash: hashIp(clientIp(request.headers)),
      });

      // Sanitised here as well as on upload: this name reaches the browser as a
      // header, and the upload path will sanitise it again on the way back.
      const name = sanitizeFilename(remote.suggestedName, 'download');

      return new NextResponse(
        capped(remote.body, requester.limits.maxFileBytes),
        {
          status: 200,
          headers: {
            'Content-Type': remote.contentType ?? 'application/octet-stream',
            'X-File-Name': encodeURIComponent(name),
            'Cache-Control': 'no-store',
          },
        },
      );
    } catch (error) {
      if (error instanceof RemoteFetchError) {
        return errors.unprocessable(error.message, { url: error.message });
      }
      throw error;
    }
  },
);
