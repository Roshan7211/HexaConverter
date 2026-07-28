import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { serverEnv } from '@/lib/env';
import {
  type PutOptions,
  StorageObjectNotFoundError,
  type StorageDriver,
} from '@/types/storage';

/**
 * Filesystem-backed driver for local development.
 *
 * Every key is resolved and then re-checked against the storage root so a
 * crafted key (`../../etc/passwd`) cannot escape the sandbox.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;

  private readonly root: string;

  constructor(root = serverEnv().STORAGE_LOCAL_DIR) {
    this.root = path.resolve(process.cwd(), root);
  }

  private resolve(key: string): string {
    if (!key || key.includes('\0')) {
      throw new Error('Invalid storage key');
    }
    const target = path.resolve(this.root, key);
    const relative = path.relative(this.root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Storage key escapes the storage root');
    }
    return target;
  }

  private async ensureDir(filePath: string) {
    await mkdir(path.dirname(filePath), { recursive: true });
  }

  async put(
    key: string,
    body: Buffer | Readable,
    _options: PutOptions,
  ): Promise<void> {
    const target = this.resolve(key);
    await this.ensureDir(target);

    if (Buffer.isBuffer(body)) {
      await writeFile(target, body);
      return;
    }
    await pipeline(body, createWriteStream(target));
  }

  async putFromFile(
    key: string,
    filePath: string,
    _options: PutOptions,
  ): Promise<number> {
    const target = this.resolve(key);
    await this.ensureDir(target);
    await pipeline(createReadStream(filePath), createWriteStream(target));
    const stats = await stat(target);
    return stats.size;
  }

  async getStream(key: string): Promise<Readable> {
    const target = this.resolve(key);
    if (!(await this.exists(key))) throw new StorageObjectNotFoundError(key);
    return createReadStream(target);
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
    const source = this.resolve(key);
    if (!(await this.exists(key))) throw new StorageObjectNotFoundError(key);

    const dirPath = path.join(tmpdir(), `hexa-${randomUUID()}`);
    await mkdir(dirPath, { recursive: true });

    const suffix = extension.replace(/^\./, '');
    const target = path.join(dirPath, `input${suffix ? `.${suffix}` : ''}`);
    await pipeline(createReadStream(source), createWriteStream(target));
    return target;
  }

  async delete(key: string): Promise<void> {
    const target = this.resolve(key);
    await rm(target, { force: true });

    // Object stores have no directories; the local driver has to fake that by
    // removing the ones it created once they are empty, or an upload session
    // leaves a husk behind for every file it deleted.
    await rmdir(path.dirname(target)).catch(() => undefined);
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      const stats = await stat(this.resolve(key));
      return stats.isFile();
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number | null> {
    try {
      const stats = await stat(this.resolve(key));
      return stats.size;
    } catch {
      return null;
    }
  }

  /** Local files are always streamed through the application route. */
  async signedDownloadUrl(): Promise<string | null> {
    return null;
  }
}
