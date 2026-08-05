import { NextResponse } from 'next/server';

import { errors, ok } from '@/api/responses';
import { findByFirebaseUid } from '@/database/repositories/user.repository';
import { currentUser } from '@/lib/firebase/session';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import {
  AvatarError,
  MAX_AVATAR_BYTES,
  readAvatar,
  removeAvatar,
  saveAvatar,
} from '@/services/account/avatar.service';

/**
 * GET    /api/account/avatar — the signed-in person's uploaded picture.
 * POST   /api/account/avatar — replace it.
 * DELETE /api/account/avatar — remove it, falling back to the provider's photo.
 *
 * Everything here is scoped to the caller's own account. There is deliberately
 * no way to ask for someone else's picture: an avatar is only ever shown to the
 * person it belongs to, so an endpoint taking a user id would create an
 * enumeration surface for nothing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Long-lived because the URL carries a version that changes with the file. */
const CACHE_CONTROL = 'private, max-age=86400';

export const GET = withErrorHandling('GET /api/account/avatar', async () => {
  const session = await currentUser();
  if (!session) return errors.notFound('No picture.');

  const account = await findByFirebaseUid(session.firebaseUid);
  if (!account?.avatarKey) return errors.notFound('No picture.');

  const stream = await readAvatar(account.avatarKey).catch(() => null);
  if (!stream) return errors.notFound('No picture.');

  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': CACHE_CONTROL,
    },
  });
});

export const POST = withErrorHandling(
  'POST /api/account/avatar',
  async (request) => {
    const limited = enforceRateLimit('upload', request);
    if (limited) return limited;

    const session = await currentUser();
    if (!session) return errors.unauthorized('Sign in to change your picture.');

    const account = await findByFirebaseUid(session.firebaseUid);
    if (!account) return errors.notFound('Account not found.');

    // Refused on the declared length before reading, so an oversized body is
    // not streamed into memory just to be rejected afterwards.
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_AVATAR_BYTES) {
      return errors.payloadTooLarge('Pictures must be 8 MB or smaller.');
    }

    const body = new Uint8Array(await request.arrayBuffer());

    try {
      await saveAvatar(account.id, body);
    } catch (error) {
      if (error instanceof AvatarError) {
        return errors.unprocessable(error.message);
      }
      throw error;
    }

    logger.info('Avatar updated', { userId: account.id });

    // The version changes with every upload, which is what lets the image be
    // cached hard and still update the moment someone changes it.
    return ok({ avatarUrl: `/api/account/avatar?v=${Date.now()}` });
  },
);

export const DELETE = withErrorHandling(
  'DELETE /api/account/avatar',
  async (request) => {
    const limited = enforceRateLimit('upload', request);
    if (limited) return limited;

    const session = await currentUser();
    if (!session) return errors.unauthorized('Sign in to change your picture.');

    const account = await findByFirebaseUid(session.firebaseUid);
    if (!account) return errors.notFound('Account not found.');

    await removeAvatar(account.id);
    logger.info('Avatar removed', { userId: account.id });

    return ok({ avatarUrl: account.photoUrl });
  },
);
