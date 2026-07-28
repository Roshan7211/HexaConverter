import type { Readable } from 'node:stream';

export interface PutOptions {
  contentType: string;
  contentLength?: number;
  /** Marks the object for lifecycle expiry on backends that support tagging. */
  ephemeral?: boolean;
}

/**
 * Object-storage abstraction. The local driver is used for development, the S3
 * driver for any S3-compatible service in production. Conversion code depends
 * only on this interface.
 */
export interface StorageDriver {
  readonly name: 'local' | 's3';

  put(key: string, body: Buffer | Readable, options: PutOptions): Promise<void>;

  /** Uploads a file from the local filesystem and returns its byte length. */
  putFromFile(
    key: string,
    filePath: string,
    options: PutOptions,
  ): Promise<number>;

  getStream(key: string): Promise<Readable>;

  getBuffer(key: string): Promise<Buffer>;

  /**
   * Materialises an object as a local file and returns its path. Required by
   * engines that shell out to native binaries, which cannot read streams.
   */
  toTempFile(key: string, extension: string): Promise<string>;

  delete(key: string): Promise<void>;

  deleteMany(keys: string[]): Promise<void>;

  exists(key: string): Promise<boolean>;

  size(key: string): Promise<number | null>;

  /**
   * Pre-signed direct download URL, when the backend supports it. Returning
   * `null` makes the application stream the object through its own route.
   */
  signedDownloadUrl(
    key: string,
    filename: string,
    expiresInSeconds: number,
  ): Promise<string | null>;
}

export class StorageObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = 'StorageObjectNotFoundError';
  }
}
