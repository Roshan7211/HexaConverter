#!/usr/bin/env node
/**
 * Nightly database backup to object storage.
 *
 * What this protects is the part that cannot be regenerated: accounts and
 * subscription records. Conversions are transient and expire on their own, so
 * losing them costs an inconvenience; losing who paid you costs a chargeback
 * dispute you cannot answer.
 *
 * Runs from cron on the server. Uploads through the S3 SDK the application
 * already depends on rather than shelling out to `aws`, so nothing extra has to
 * be installed on the host.
 *
 *   node scripts/backup-database.mjs
 *
 * Exits non-zero on any failure, and says why. A backup script that fails
 * quietly is worse than no backup script, because it also removes the sense
 * that anything needs doing.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const PREFIX = 'backups/';

/** Keep a fortnight of nights, and a month of Sundays beyond that. */
const KEEP_DAILY = 7;
const KEEP_WEEKLY = 4;

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

function fail(message) {
  console.error(`[backup] FAILED: ${message}`);
  process.exit(1);
}

/**
 * `pg_dump` must be at least the server's major version, so prefer a versioned
 * install over whatever happens to be first on PATH.
 */
function findPgDump() {
  const candidates = [
    '/usr/bin/pg_dump',
    '/usr/lib/postgresql/18/bin/pg_dump',
    '/Library/PostgreSQL/18/bin/pg_dump',
    '/opt/homebrew/bin/pg_dump',
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    return execFileSync('/usr/bin/env', ['which', 'pg_dump'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return fail('pg_dump not found. Install the PostgreSQL client tools.');
  }
}

/**
 * Prisma's connection strings carry parameters libpq has never heard of —
 * `schema`, `pgbouncer`, `connection_limit` — and pg_dump refuses the whole URI
 * rather than ignoring them: `invalid URI query parameter: "schema"`. Since
 * both the provisioning script and every local .env include `?schema=public`,
 * passing the URL through untouched fails everywhere, on the first run.
 *
 * The schema is returned separately so it can be given to pg_dump properly.
 */
function splitConnectionUrl(raw) {
  const url = new URL(raw);
  const prismaOnly = [
    'schema',
    'pgbouncer',
    'connection_limit',
    'pool_timeout',
    'socket_timeout',
    'statement_cache_size',
  ];

  const schema = url.searchParams.get('schema') ?? undefined;
  for (const param of prismaOnly) url.searchParams.delete(param);

  return { url: url.toString(), schema };
}

const env = loadEnv();

// The unpooled connection. A transaction pooler hands each statement whichever
// backend is free, and a dump needs one consistent snapshot for its whole run.
const rawUrl = env.DIRECT_URL || env.DATABASE_URL;
if (!rawUrl) fail('Neither DIRECT_URL nor DATABASE_URL is set.');

const { url, schema } = splitConnectionUrl(rawUrl);

const bucket = env.S3_BUCKET;
if (!bucket) fail('S3_BUCKET is not set, so there is nowhere to put the dump.');

const s3 = new S3Client({
  region: env.S3_REGION || 'auto',
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const key = `${PREFIX}hexaconverter-${stamp}.dump.gz`;

const workDir = await mkdtemp(path.join(tmpdir(), 'hexa-backup-'));
const dumpPath = path.join(workDir, 'db.dump.gz');

try {
  console.log(`[backup] dumping to ${dumpPath}`);

  // `--format=custom` is compressed and restores selectively, which matters
  // when you want one table back rather than the whole database. `--no-owner`
  // and `--no-privileges` let it restore into a differently-named role, which
  // is exactly the situation a recovery is.
  const dump = spawnSync(
    findPgDump(),
    [
      url,
      '--format=custom',
      '--compress=9',
      '--no-owner',
      '--no-privileges',
      ...(schema ? ['--schema', schema] : []),
      '--file',
      dumpPath,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'] },
  );

  if (dump.status !== 0) {
    fail(`pg_dump exited ${dump.status}: ${(dump.stderr || '').trim()}`);
  }

  const size = statSync(dumpPath).size;
  if (size < 1024) {
    // A dump this small is an empty or failed one. Uploading it would quietly
    // replace good backups with useless ones.
    fail(`dump is only ${size} bytes, which cannot be a real database.`);
  }

  console.log(`[backup] uploading ${(size / 1024).toFixed(0)} KB to ${key}`);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(dumpPath),
      ContentLength: size,
      ContentType: 'application/octet-stream',
    }),
  );

  console.log('[backup] uploaded');

  // --- retention ----------------------------------------------------------
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX }),
  );

  const all = (listed.Contents ?? [])
    .filter((object) => object.Key?.endsWith('.dump.gz'))
    .sort((a, b) => (b.Key ?? '').localeCompare(a.Key ?? ''));

  const keep = new Set(all.slice(0, KEEP_DAILY).map((object) => object.Key));

  // Sundays, kept beyond the daily window so a fault noticed late still has
  // something from before it started.
  const sundays = all.filter((object) => {
    const date = object.Key?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    return date ? new Date(date).getUTCDay() === 0 : false;
  });
  for (const object of sundays.slice(0, KEEP_WEEKLY)) keep.add(object.Key);

  const stale = all
    .filter((object) => !keep.has(object.Key))
    .map((object) => ({ Key: object.Key }));

  if (stale.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: stale },
      }),
    );
    console.log(`[backup] pruned ${stale.length} old backup(s)`);
  }

  // `all` was listed after the upload, so it already includes tonight's.
  console.log(`[backup] done — ${all.length - stale.length} backup(s) retained`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
