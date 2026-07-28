import { randomUUID } from 'node:crypto';

import { serverEnv } from '@/lib/env';
import { LocalStorageDriver } from '@/services/storage/local.driver';
import { S3StorageDriver } from '@/services/storage/s3.driver';
import type { StorageDriver } from '@/types/storage';

export type { StorageDriver, PutOptions } from '@/types/storage';
export { StorageObjectNotFoundError } from '@/types/storage';

let driver: StorageDriver | null = null;

/** The configured storage driver for this deployment. */
export function storage(): StorageDriver {
  if (driver) return driver;
  driver =
    serverEnv().STORAGE_DRIVER === 's3'
      ? new S3StorageDriver()
      : new LocalStorageDriver();
  return driver;
}

/**
 * Object keys are namespaced by purpose and date so lifecycle rules and cost
 * reporting can target prefixes, and are suffixed with a random id so two
 * uploads of the same filename never collide.
 */
export function buildStorageKey(
  purpose: 'inputs' | 'outputs',
  extension: string,
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const suffix = extension.replace(/^\./, '').toLowerCase();

  return `${purpose}/${year}/${month}/${day}/${randomUUID()}${
    suffix ? `.${suffix}` : ''
  }`;
}
