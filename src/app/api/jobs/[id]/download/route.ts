import { Readable } from 'node:stream';

import { JobStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

import { errors } from '@/api/responses';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { logger } from '@/lib/logger';
import { findForDownload } from '@/database/repositories/job.repository';
import { contentDisposition, verifyDownloadToken } from '@/lib/security';
import { storage, StorageObjectNotFoundError } from '@/services/storage';

/**
 * GET /api/jobs/[id]/download?token=…
 *
 * The signed token is the authorisation: it is bound to one job id and expires
 * in minutes, so links can be shared deliberately but never enumerated or
 * replayed indefinitely. On S3-compatible storage the request is redirected to
 * a pre-signed URL so the file never transits the application server.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 300;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(
  'GET /api/jobs/[id]/download',
  async (request, context: RouteContext) => {
    const limited = enforceRateLimit('download', request);
    if (limited) return limited;

    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      return errors.unauthorized('This download link is incomplete.');
    }

    const payload = verifyDownloadToken(token);
    if (!payload || payload.jobId !== id) {
      return errors.forbidden(
        'This download link has expired. Open your conversion again to get a fresh link.',
      );
    }

    const job = await findForDownload(id);

    if (!job || job.status !== JobStatus.COMPLETED || !job.outputKey) {
      return errors.notFound('This converted file is no longer available.');
    }

    if (job.expiresAt.getTime() < Date.now()) {
      return errors.notFound(
        'This file has passed its retention window and has been deleted.',
      );
    }

    const filename = job.outputName ?? 'converted-file';
    const store = storage();

    const signedUrl = await store.signedDownloadUrl(
      job.outputKey,
      filename,
      SIGNED_URL_TTL_SECONDS,
    );
    if (signedUrl) {
      return NextResponse.redirect(signedUrl, 307);
    }

    try {
      const stream = await store.getStream(job.outputKey);

      return new NextResponse(
        Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>,
        {
          status: 200,
          headers: {
            'Content-Type': job.outputMime ?? 'application/octet-stream',
            'Content-Disposition': contentDisposition(filename),
            ...(job.outputSize
              ? { 'Content-Length': String(job.outputSize) }
              : {}),
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        logger.warn('Download requested for missing object', { jobId: id });
        return errors.notFound('This converted file is no longer available.');
      }
      throw error;
    }
  },
);
