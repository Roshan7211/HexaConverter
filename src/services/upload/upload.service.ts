import { Readable } from 'node:stream';

import {
  ACCEPTED_INPUT_EXTENSIONS,
  getFormat,
  resolveFormatId,
} from '@/services/conversion/registry';
import type { Category } from '@/types/conversion';
import { serverEnv } from '@/lib/env';
import {
  isExtensionConsistent,
  SNIFF_LENGTH,
  sniffContainer,
} from '@/services/upload/file-signatures';
import { buildStorageKey, storage } from '@/services/storage';
import { sanitizeFilename } from '@/lib/security';
import { formatExtension } from '@/utils';

/**
 * Streaming upload ingestion.
 *
 * The request body is piped straight to object storage, so peak memory is one
 * chunk regardless of file size. Validation happens *before* the first byte is
 * forwarded: the leading bytes are buffered, the container is identified from
 * its magic number and checked against the declared extension, and the running
 * byte count is enforced against the plan limit so a lying `Content-Length`
 * cannot be used to bypass it.
 */

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface ReceivedUpload {
  key: string;
  name: string;
  size: number;
  mime: string;
  sourceFormat: string;
  category: Category;
}

export interface ReceiveOptions {
  /** Plan-derived ceiling for this requester. */
  maxBytes: number;
  /** Raw filename from the client. */
  filename: string;
}

export function decodeFilenameHeader(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value).slice(0, 255);
  } catch {
    return value.slice(0, 255);
  }
}

export async function receiveUpload(
  body: ReadableStream<Uint8Array> | null,
  options: ReceiveOptions,
): Promise<ReceivedUpload> {
  if (!body) {
    throw new UploadError('No file was received.', 400);
  }

  const env = serverEnv();
  const maxBytes = Math.min(options.maxBytes, env.MAX_UPLOAD_BYTES);

  const safeName = sanitizeFilename(options.filename, 'upload');
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

  const key = buildStorageKey(
    'inputs',
    sourceFormat === 'tgz' ? 'tar.gz' : sourceFormat,
  );

  let size = 0;

  const source = Readable.fromWeb(
    body as Parameters<typeof Readable.fromWeb>[0],
  );

  async function* validated(): AsyncGenerator<Buffer> {
    let head: Buffer = Buffer.alloc(0);
    let verified = false;

    for await (const chunk of source) {
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array);
      size += buffer.byteLength;

      if (size > maxBytes) {
        throw new UploadError(
          `The file exceeds your ${formatLimit(maxBytes)} upload limit.`,
          413,
        );
      }

      if (verified) {
        yield buffer;
        continue;
      }

      head = head.byteLength === 0 ? buffer : Buffer.concat([head, buffer]);
      if (head.byteLength < SNIFF_LENGTH) continue;

      verifyContainer(head, extension, spec!.label);
      verified = true;
      yield head;
      head = Buffer.alloc(0);
    }

    // Files smaller than the sniff window are validated once the body ends.
    if (!verified) {
      if (head.byteLength === 0) {
        throw new UploadError('The uploaded file is empty.', 400);
      }
      verifyContainer(head, extension, spec!.label);
      yield head;
    }
  }

  try {
    await storage().put(key, Readable.from(validated()), {
      contentType: spec.mime,
      ephemeral: true,
    });
  } catch (error) {
    // A rejected or aborted upload can still have opened the destination
    // object, so remove it rather than leaving a truncated orphan behind.
    await storage()
      .delete(key)
      .catch(() => undefined);
    throw error;
  }

  if (size === 0) {
    await storage()
      .delete(key)
      .catch(() => undefined);
    throw new UploadError('The uploaded file is empty.', 400);
  }

  return {
    key,
    name: safeName,
    size,
    mime: spec.mime,
    sourceFormat,
    category: spec.category,
  };
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

function formatLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024
    ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
    : `${Math.round(mb)} MB`;
}
