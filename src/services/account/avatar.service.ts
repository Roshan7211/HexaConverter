import 'server-only';

import sharp from 'sharp';

import { setAvatarKey } from '@/database/repositories/user.repository';
import { storage } from '@/services/storage';

/**
 * Profile pictures.
 *
 * Whatever arrives is decoded and re-encoded by sharp rather than stored as
 * sent. That is the whole security model here: an "image" from a stranger can
 * carry a polyglot payload, an enormous decompression bomb or a pile of EXIF
 * including where the photo was taken. Re-encoding keeps only the pixels —
 * anything that was not really an image fails to decode and is refused, and
 * metadata is dropped because sharp does not carry it across unless asked.
 *
 * It also settles the size question. A 4 MB phone photo becomes a 256px WebP of
 * a few kilobytes, so the avatar in the header costs nothing to load and the
 * storage bill does not grow with the number of people who sign up.
 */

/** Square, and large enough for a retina header at 32px. */
const AVATAR_SIZE = 256;

/** Generous for a photo, small enough to refuse anything absurd early. */
export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

function keyFor(userId: string): string {
  // One key per account, so replacing a picture overwrites rather than
  // accumulating orphans nobody will ever delete.
  return `avatars/${userId}.webp`;
}

/**
 * Stores a new picture for an account and returns its storage key.
 *
 * `limitInputPixels` is the decompression-bomb guard: a small file can declare
 * enormous dimensions, and without a ceiling sharp would dutifully try to
 * allocate them.
 */
export async function saveAvatar(
  userId: string,
  input: Uint8Array,
): Promise<string> {
  if (input.byteLength === 0) {
    throw new AvatarError('That file is empty.');
  }

  if (input.byteLength > MAX_AVATAR_BYTES) {
    throw new AvatarError('Pictures must be 8 MB or smaller.');
  }

  let encoded: Buffer;
  try {
    encoded = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate() // Honour EXIF orientation before the tag is discarded.
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AvatarError(
      'That does not look like an image we can read. Try a PNG, JPEG or WebP.',
    );
  }

  const key = keyFor(userId);
  await storage().put(key, encoded, { contentType: 'image/webp' });
  await setAvatarKey(userId, key);

  return key;
}

/** Removes the uploaded picture, falling the account back to its provider photo. */
export async function removeAvatar(userId: string): Promise<void> {
  // The row is cleared first: a storage delete that fails must not leave the
  // account pointing at a key that no longer resolves.
  await setAvatarKey(userId, null);
  await storage()
    .delete(keyFor(userId))
    .catch(() => undefined);
}

/** The stored picture as a stream, for serving it back. */
export function readAvatar(key: string) {
  return storage().getStream(key);
}
