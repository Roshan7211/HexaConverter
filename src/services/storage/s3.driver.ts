import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { serverEnv } from '@/lib/env';
import { contentDisposition } from '@/lib/security';
import {
  type PutOptions,
  StorageObjectNotFoundError,
  type StorageDriver,
} from '@/types/storage';

/**
 * Driver for any S3-compatible object store (AWS S3, Cloudflare R2, MinIO,
 * Wasabi, Backblaze B2). Large bodies use the multipart uploader so memory use
 * stays flat regardless of file size.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const env = serverEnv();

    this.bucket = env.S3_BUCKET!;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }

  async put(
    key: string,
    body: Buffer | Readable,
    options: PutOptions,
  ): Promise<void> {
    if (Buffer.isBuffer(body)) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          ContentLength: body.byteLength,
          Tagging: options.ephemeral ? 'lifecycle=ephemeral' : undefined,
        }),
      );
      return;
    }

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        Tagging: options.ephemeral ? 'lifecycle=ephemeral' : undefined,
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    });

    await upload.done();
  }

  async putFromFile(
    key: string,
    filePath: string,
    options: PutOptions,
  ): Promise<number> {
    const { createReadStream } = await import('node:fs');
    await this.put(key, createReadStream(filePath), options);
    const stats = await stat(filePath);
    return stats.size;
  }

  async getStream(key: string): Promise<Readable> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) throw new StorageObjectNotFoundError(key);
      return result.Body as Readable;
    } catch (error) {
      if (isNotFound(error)) throw new StorageObjectNotFoundError(key);
      throw error;
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async toTempFile(key: string, extension: string): Promise<string> {
    const dirPath = path.join(tmpdir(), `hexa-${randomUUID()}`);
    await mkdir(dirPath, { recursive: true });

    const suffix = extension.replace(/^\./, '');
    const target = path.join(dirPath, `input${suffix ? `.${suffix}` : ''}`);

    await pipeline(await this.getStream(key), createWriteStream(target));
    return target;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    // The DeleteObjects API accepts at most 1000 keys per request.
    for (let index = 0; index < keys.length; index += 1000) {
      const batch = keys.slice(index, index + 1000);
      if (batch.length === 0) continue;
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.size(key)) !== null;
  }

  async size(key: string): Promise<number | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return result.ContentLength ?? null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async signedDownloadUrl(
    key: string,
    filename: string,
    expiresInSeconds: number,
  ): Promise<string | null> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(filename),
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.name === 'NotFound' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
