import 'server-only';

import { randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import * as sessions from '@/database/repositories/upload-session.repository';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { sanitizeFilename } from '@/lib/security';
import {
  ACCEPTED_INPUT_EXTENSIONS,
  getFormat,
  resolveFormatId,
} from '@/services/conversion/registry';
import { buildStorageKey, storage } from '@/services/storage';
import {
  isExtensionConsistent,
  SNIFF_LENGTH,
  sniffContainer,
} from '@/services/upload/file-signatures';
import { assertClean } from '@/services/upload/scanner.service';
import { UploadError } from '@/services/upload/upload.service';
import type { Category } from '@/types/conversion';
import { formatExtension } from '@/utils';

/**
 * Resumable chunked uploads.
 *
 * A large file is a bad fit for one request: a drop at 95% costs the whole
 * transfer, and any proxy in the path can impose its own body limit. So the
 * client declares the file up front, sends it in fixed-size pieces that are
 * each stored as their own object, and asks the server to assemble them when
 * it is done. A retried chunk overwrites the previous attempt, which makes
 * every chunk request idempotent and resumption a matter of asking which
 * indices already arrived.
 *
 * The pieces are never all held in memory: assembly streams one chunk object
 * at a time into the destination.
 */

/** 8 MB balances request overhead against how much a failure costs. */
export const CHUNK_SIZE = 8 * 1024 * 1024;

/** An abandoned session is swept after this long. */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

/** Refuses a file that would need an unreasonable number of round trips. */
const MAX_CHUNKS = 4_096;

export interface SessionOwner {
  userId: string | null;
  guestId: string | null;
}

export interface StartSessionInput {
  filename: string;
  declaredSize: number;
  maxBytes: number;
  owner: SessionOwner;
}

export interface SessionState {
  id: string;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  receivedSize: number;
  declaredSize: number;
  filename: string;
  sourceFormat: string;
  completed: boolean;
  expiresAt: string;
}

export interface AssembledUpload {
  key: string;
  name: string;
  size: number;
  mime: string;
  sourceFormat: string;
  category: Category;
  /** What the malware scanner concluded, or why it did not run. */
  scan: string;
}

/**
 * Opens a session after validating everything that can be checked without the
 * bytes: the extension, the plan ceiling and the resulting chunk count.
 */
export async function startSession(
  input: StartSessionInput,
): Promise<SessionState> {
  const safeName = sanitizeFilename(input.filename, 'upload');
  const extension = formatExtension(safeName);

  if (!extension) {
    throw new UploadError(
      'The file has no extension, so its format cannot be determined.',
      400,
    );
  }
  if (!ACCEPTED_INPUT_EXTENSIONS.includes(extension)) {
    throw new UploadError(
      `.${extension} files are not supported. See the format list for everything HexaConverter accepts.`,
      415,
    );
  }

  const sourceFormat = resolveFormatId(extension);
  const spec = sourceFormat ? getFormat(sourceFormat) : null;
  if (!sourceFormat || !spec) {
    throw new UploadError(`.${extension} files are not supported.`, 415);
  }

  if (!Number.isFinite(input.declaredSize) || input.declaredSize <= 0) {
    throw new UploadError('The file is empty.', 400);
  }

  const ceiling = Math.min(input.maxBytes, serverEnv().MAX_UPLOAD_BYTES);
  if (input.declaredSize > ceiling) {
    throw new UploadError(
      `The file exceeds your ${formatLimit(ceiling)} upload limit.`,
      413,
    );
  }

  const totalChunks = Math.ceil(input.declaredSize / CHUNK_SIZE);
  if (totalChunks > MAX_CHUNKS) {
    throw new UploadError(
      'The file is too large to upload in one session.',
      413,
    );
  }

  const session = await sessions.create({
    owner: input.owner,
    filename: safeName,
    sourceFormat,
    mime: spec.mime,
    declaredSize: input.declaredSize,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    storagePrefix: `uploads/${randomUUID()}`,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  logger.info('Upload session opened', {
    sessionId: session.id,
    sourceFormat,
    totalChunks,
  });

  return toState(session);
}

/** Loads a session, scoped to its owner so an id alone is not enough. */
export async function findSession(id: string, owner: SessionOwner) {
  return sessions.findOwned(id, owner);
}

export async function getSessionState(
  id: string,
  owner: SessionOwner,
): Promise<SessionState | null> {
  const session = await findSession(id, owner);
  return session ? toState(session) : null;
}

/**
 * Stores one chunk.
 *
 * Re-sending a chunk is allowed and overwrites the stored object, which is
 * what makes a retry safe: the client never has to know whether its previous
 * attempt got through before the connection dropped.
 */
export async function storeChunk(
  id: string,
  owner: SessionOwner,
  index: number,
  body: ReadableStream<Uint8Array> | null,
): Promise<SessionState> {
  const session = await findSession(id, owner);
  if (!session) throw new UploadError('That upload session has expired.', 400);
  if (session.completed) {
    throw new UploadError('That upload has already finished.', 400);
  }
  if (session.expiresAt.getTime() < Date.now()) {
    throw new UploadError('That upload session has expired.', 400);
  }
  if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) {
    throw new UploadError(
      `Chunk index must be between 0 and ${session.totalChunks - 1}.`,
      400,
    );
  }
  if (!body) throw new UploadError('No chunk data was received.', 400);

  // The last chunk is short; every other one must be exactly chunkSize, so a
  // client cannot smuggle extra bytes past the declared total.
  const expected =
    index === session.totalChunks - 1
      ? Number(session.declaredSize) - index * session.chunkSize
      : session.chunkSize;

  const key = `${session.storagePrefix}/${String(index).padStart(5, '0')}`;
  let written = 0;

  // Counting has to happen inside `_transform`, not in a `data` listener: a
  // listener puts the stream in flowing mode, which drains it before the
  // storage driver attaches its reader and silently stores zero bytes.
  const counting = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.byteLength;
      if (written > expected) {
        callback(new UploadError('The chunk is larger than it declared.', 413));
        return;
      }
      callback(null, chunk);
    },
  });

  // `allSettled`, not `all`: cleaning up while the write is still in flight
  // races it, and the loser is a zero-byte object nothing will ever collect.
  const [piped, stored] = await Promise.allSettled([
    pipeline(
      Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]),
      counting,
    ),
    storage().put(key, counting, {
      contentType: 'application/octet-stream',
      ephemeral: true,
    }),
  ]);

  const failure =
    piped.status === 'rejected'
      ? piped.reason
      : stored.status === 'rejected'
        ? stored.reason
        : null;

  if (failure) {
    await storage()
      .delete(key)
      .catch(() => undefined);
    throw failure instanceof UploadError
      ? failure
      : new UploadError('The chunk could not be stored.', 400);
  }

  if (written !== expected) {
    await storage()
      .delete(key)
      .catch(() => undefined);
    throw new UploadError(
      `Chunk ${index} is ${written} bytes but should be ${expected}.`,
      400,
    );
  }

  // Recomputed from the set rather than incremented, so a replayed chunk does
  // not double-count towards the total.
  const receivedChunks = session.receivedChunks.includes(index)
    ? session.receivedChunks
    : [...session.receivedChunks, index].sort((a, b) => a - b);

  const receivedSize = receivedChunks.reduce(
    (total, chunkIndex) =>
      total +
      (chunkIndex === session.totalChunks - 1
        ? Number(session.declaredSize) - chunkIndex * session.chunkSize
        : session.chunkSize),
    0,
  );

  const updated = await sessions.recordChunks(
    session.id,
    receivedChunks,
    receivedSize,
  );

  return toState(updated);
}

/**
 * Streams the chunks together into one object, then validates the assembled
 * file exactly as the single-request path does.
 */
export async function completeSession(
  id: string,
  owner: SessionOwner,
): Promise<AssembledUpload> {
  const session = await findSession(id, owner);
  if (!session) throw new UploadError('That upload session has expired.', 400);
  if (session.completed) {
    throw new UploadError('That upload has already finished.', 400);
  }

  const missing = Array.from(
    { length: session.totalChunks },
    (_, index) => index,
  ).filter((index) => !session.receivedChunks.includes(index));

  if (missing.length > 0) {
    throw new UploadError(
      `The upload is incomplete: ${missing.length} chunk${missing.length === 1 ? '' : 's'} still missing.`,
      400,
    );
  }

  const spec = getFormat(session.sourceFormat)!;
  const extension = formatExtension(session.filename);
  const store = storage();

  const chunkKeys = Array.from(
    { length: session.totalChunks },
    (_, index) => `${session.storagePrefix}/${String(index).padStart(5, '0')}`,
  );

  const key = buildStorageKey(
    'inputs',
    session.sourceFormat === 'tgz' ? 'tar.gz' : session.sourceFormat,
  );

  let head = Buffer.alloc(0);
  let verified = false;
  let size = 0;

  async function* assembled(): AsyncGenerator<Buffer> {
    for (const chunkKey of chunkKeys) {
      const stream = await store.getStream(chunkKey);

      for await (const piece of stream) {
        const buffer = Buffer.from(piece as Uint8Array);
        size += buffer.byteLength;

        if (verified) {
          yield buffer;
          continue;
        }

        head = head.byteLength === 0 ? buffer : Buffer.concat([head, buffer]);
        if (head.byteLength < SNIFF_LENGTH) continue;

        verifyContainer(head, extension, spec.label);
        verified = true;
        yield head;
        head = Buffer.alloc(0);
      }
    }

    if (!verified) {
      if (head.byteLength === 0) {
        throw new UploadError('The uploaded file is empty.', 400);
      }
      verifyContainer(head, extension, spec.label);
      yield head;
    }
  }

  try {
    await store.put(key, Readable.from(assembled()), {
      contentType: spec.mime,
      ephemeral: true,
    });
  } catch (error) {
    await store.delete(key).catch(() => undefined);
    await discardChunks(chunkKeys);
    await sessions.remove(session.id).catch(() => undefined);
    throw error;
  }

  // The assembled file is scanned before the caller is given a ticket, so an
  // infected file is never convertible even for the moment it exists on disk.
  let scan: string;
  try {
    const verdict = await assertClean(() => store.getStream(key), {
      name: session.filename,
    });
    scan =
      verdict.status === 'skipped'
        ? `Not scanned: ${verdict.reason}`
        : 'Scanned and clean';
  } catch (error) {
    await store.delete(key).catch(() => undefined);
    await discardChunks(chunkKeys);
    await sessions.remove(session.id).catch(() => undefined);
    throw error;
  }

  await discardChunks(chunkKeys);
  await sessions.remove(session.id);

  logger.info('Chunked upload assembled', {
    sessionId: session.id,
    sourceFormat: session.sourceFormat,
    size,
    chunks: session.totalChunks,
  });

  return {
    key,
    name: session.filename,
    size,
    mime: spec.mime,
    sourceFormat: session.sourceFormat,
    category: spec.category,
    scan,
  };
}

/** Cancels a session and removes whatever was uploaded so far. */
export async function cancelSession(
  id: string,
  owner: SessionOwner,
): Promise<boolean> {
  const session = await findSession(id, owner);
  if (!session) return false;

  await discardChunks(
    session.receivedChunks.map(
      (index) => `${session.storagePrefix}/${String(index).padStart(5, '0')}`,
    ),
  );
  await sessions.remove(session.id);

  logger.info('Upload session cancelled', { sessionId: session.id });
  return true;
}

/** Sweeps sessions abandoned mid-transfer. Called by the cleanup cron. */
export async function purgeExpiredSessions(): Promise<number> {
  const expired = await sessions.findExpired();

  for (const session of expired) {
    await discardChunks(
      session.receivedChunks.map(
        (index) => `${session.storagePrefix}/${String(index).padStart(5, '0')}`,
      ),
    );
  }

  if (expired.length > 0) {
    await sessions.removeMany(expired.map((session) => session.id));
  }

  return expired.length;
}

async function discardChunks(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await storage()
    .deleteMany(keys)
    .catch((error) => logger.warn('Failed to remove upload chunks', { error }));
}

function verifyContainer(head: Buffer, extension: string, label: string) {
  const family = sniffContainer(head);

  if (!family) {
    throw new UploadError(
      'The file contents could not be identified. It may be corrupt or not a real ' +
        `${label} file.`,
      415,
    );
  }
  if (!isExtensionConsistent(family, extension)) {
    throw new UploadError(
      `The file contents do not match its .${extension} extension. Rename it to the correct format and try again.`,
      415,
    );
  }
}

function toState(session: {
  id: string;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  receivedSize: bigint;
  declaredSize: bigint;
  filename: string;
  sourceFormat: string;
  completed: boolean;
  expiresAt: Date;
}): SessionState {
  return {
    id: session.id,
    chunkSize: session.chunkSize,
    totalChunks: session.totalChunks,
    receivedChunks: session.receivedChunks,
    receivedSize: Number(session.receivedSize),
    declaredSize: Number(session.declaredSize),
    filename: session.filename,
    sourceFormat: session.sourceFormat,
    completed: session.completed,
    expiresAt: session.expiresAt.toISOString(),
  };
}

function formatLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024
    ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
    : `${Math.round(mb)} MB`;
}
