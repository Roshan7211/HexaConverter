#!/usr/bin/env node
/**
 * Restores a backup, or lists what is available.
 *
 * An untested backup is not a backup. This exists so a restore can be rehearsed
 * into a scratch database on an ordinary Tuesday, rather than attempted for the
 * first time during an incident.
 *
 *   node scripts/restore-database.mjs --list
 *   node scripts/restore-database.mjs --key backups/hexaconverter-....dump.gz \
 *     --to postgresql://postgres:pw@127.0.0.1:5432/hexaconverter_restore_test
 *
 * `--to` is required and has no default. Restoring is destructive — it drops
 * and recreates every object it touches — so the target must be typed out
 * deliberately every time. There is no way to run this and accidentally hit
 * production because a variable happened to be set.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

const PREFIX = 'backups/';

function fail(message) {
  console.error(`[restore] FAILED: ${message}`);
  process.exit(1);
}

function loadEnv() {
  const file = path.resolve(process.cwd(), '.env');
  if (!existsSync(file)) fail('No .env found in the working directory.');

  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function findTool(name) {
  const candidates = [
    `/usr/bin/${name}`,
    `/usr/lib/postgresql/18/bin/${name}`,
    `/Library/PostgreSQL/18/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    return execFileSync('/usr/bin/env', ['which', name], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return fail(`${name} not found. Install the PostgreSQL client tools.`);
  }
}

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const env = loadEnv();
const bucket = env.S3_BUCKET;
if (!bucket) fail('S3_BUCKET is not set.');

const s3 = new S3Client({
  region: env.S3_REGION || 'auto',
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const listed = await s3.send(
  new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX }),
);
const backups = (listed.Contents ?? [])
  .filter((object) => object.Key?.endsWith('.dump.gz'))
  .sort((a, b) => (b.Key ?? '').localeCompare(a.Key ?? ''));

if (args.includes('--list') || args.length === 0) {
  if (backups.length === 0) {
    console.log('[restore] no backups found.');
  } else {
    console.log(`[restore] ${backups.length} backup(s):\n`);
    for (const object of backups) {
      const kb = ((object.Size ?? 0) / 1024).toFixed(0);
      console.log(
        `  ${object.Key}  ${kb} KB  ${object.LastModified?.toISOString() ?? ''}`,
      );
    }
  }
  process.exit(0);
}

const target = flag('--to');
if (!target) {
  fail('--to is required. Name the database to restore into, explicitly.');
}

// The one guard that matters. Everything else here is recoverable; restoring
// over the live database is not.
if (/hexaconverter(\?|$)/.test(target) && !args.includes('--i-mean-it')) {
  fail(
    'That target looks like the production database. Restore into a scratch ' +
      'database instead, or pass --i-mean-it if you genuinely intend to ' +
      'overwrite production.',
  );
}

const key = flag('--key') ?? backups[0]?.Key;
if (!key) fail('No backup to restore.');

const workDir = await mkdtemp(path.join(tmpdir(), 'hexa-restore-'));
const dumpPath = path.join(workDir, 'db.dump.gz');

try {
  console.log(`[restore] downloading ${key}`);
  const object = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  await pipeline(object.Body, createWriteStream(dumpPath));
  console.log(`[restore] ${(statSync(dumpPath).size / 1024).toFixed(0)} KB`);

  console.log(`[restore] restoring into ${target.replace(/:[^:@]+@/, ':***@')}`);

  const restore = spawnSync(
    findTool('pg_restore'),
    [
      '--dbname',
      target,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      dumpPath,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'] },
  );

  // pg_restore warns about objects that did not exist to drop, which is normal
  // on a fresh target. Only a non-zero exit with real errors matters.
  if (restore.status !== 0) {
    const stderr = (restore.stderr || '').trim();
    const realErrors = stderr
      .split('\n')
      .filter((line) => /error:/i.test(line) && !/does not exist/i.test(line));

    if (realErrors.length > 0) {
      fail(`pg_restore exited ${restore.status}:\n${realErrors.join('\n')}`);
    }
    console.log('[restore] completed with warnings about absent objects');
  }

  console.log('[restore] done');
} finally {
  await rm(workDir, { recursive: true, force: true });
}
