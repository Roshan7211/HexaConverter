#!/usr/bin/env node
/**
 * Assembles `dist/` as a Linux x64 deployment bundle, from any host OS.
 *
 *   NEXT_PUBLIC_APP_URL=https://www.hexaconverter.com node scripts/build-linux-dist.mjs
 *
 * `next build` with `output: 'standalone'` traces only the native binaries for
 * the machine it ran on. Built on a Mac, the result is a folder full of
 * `*-darwin-x64` artefacts that throw on `require` the moment it reaches a
 * Linux server — a failure that reads like a corrupt upload rather than a
 * packaging mistake. This script swaps in the Linux equivalents so the bundle
 * can be copied to a server and started, with no `npm install` there.
 *
 * What it cannot fix: LibreOffice, Poppler and Ghostscript are system packages,
 * not npm ones. Office and PDF-rendering routes stay unavailable until those
 * are installed on the host. `/api/health` reports which are missing.
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PLATFORM = 'linux';
const ARCH = 'x64';

const log = (...a) => console.log('•', ...a);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

// --- 1. Build --------------------------------------------------------------

if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.error(
    'NEXT_PUBLIC_APP_URL must be set — it is compiled into the bundle and\n' +
      'cannot be changed afterwards. Example:\n\n' +
      '  NEXT_PUBLIC_APP_URL=https://www.hexaconverter.com node scripts/build-linux-dist.mjs\n',
  );
  process.exit(1);
}

log('building');
await rm(DIST, { recursive: true, force: true });
await rm(path.join(ROOT, '.next'), { recursive: true, force: true });
run('npx', ['prisma', 'generate']);
run('npx', ['next', 'build']);

// --- 2. Assemble the standalone output -------------------------------------

log('assembling dist/');
await cp(path.join(ROOT, '.next/standalone'), DIST, { recursive: true });
await mkdir(path.join(DIST, '.next'), { recursive: true });
await cp(path.join(ROOT, '.next/static'), path.join(DIST, '.next/static'), {
  recursive: true,
});
await cp(path.join(ROOT, 'public'), path.join(DIST, 'public'), {
  recursive: true,
});
await cp(path.join(ROOT, 'prisma'), path.join(DIST, 'prisma'), {
  recursive: true,
});

// `next build` copies the developer's own .env into the standalone output.
// It holds real credentials and must never travel to a server in a folder
// someone is about to upload.
for (const leaked of [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
]) {
  const p = path.join(DIST, leaked);
  if (await exists(p)) {
    await rm(p, { force: true });
    log(`removed leaked ${leaked}`);
  }
}

// --- 3. Swap native modules for their Linux builds -------------------------

const NATIVE = [
  // sharp: image conversion. The libvips package carries the actual library.
  { name: '@img/sharp-linux-x64', replaces: '@img/sharp-darwin-x64' },
  {
    name: '@img/sharp-libvips-linux-x64',
    replaces: '@img/sharp-libvips-darwin-x64',
  },
  // canvas: PDF page rasterisation.
  {
    name: '@napi-rs/canvas-linux-x64-gnu',
    replaces: '@napi-rs/canvas-darwin-x64',
  },
];

const staging = await mkdtemp(path.join(tmpdir(), 'hexa-linux-'));
const modules = path.join(DIST, 'node_modules');

for (const { name, replaces } of NATIVE) {
  const version = await resolveVersion(name);
  log(`fetching ${name}@${version}`);

  const tarball = execFileSync(
    'npm',
    ['pack', `${name}@${version}`, '--silent'],
    {
      cwd: staging,
      encoding: 'utf8',
    },
  ).trim();

  run('tar', ['-xzf', tarball], { cwd: staging, stdio: 'ignore' });

  const target = path.join(modules, name);
  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(staging, 'package'), target, { recursive: true });
  await rm(path.join(staging, 'package'), { recursive: true, force: true });

  // Drop the host-OS build so nothing can resolve to it by accident and so the
  // bundle does not carry a second copy of libvips.
  if (replaces) {
    await rm(path.join(modules, replaces), { recursive: true, force: true });
  }
}

/** Version to fetch: whatever the local tree resolved, else the latest. */
async function resolveVersion(name) {
  const local = path.join(ROOT, 'node_modules', name, 'package.json');
  if (await exists(local)) {
    return JSON.parse(await readFile(local, 'utf8')).version;
  }
  // sharp's optional deps are keyed to the sharp version; the registry's
  // `latest` matches what sharp expects for the same release line.
  return execFileSync('npm', ['view', name, 'version'], {
    encoding: 'utf8',
  }).trim();
}

// --- 4. ffmpeg: fetch the Linux binary -------------------------------------
// ffmpeg-static downloads one binary at install time for the installing host.
// The release tag is declared in its package.json, so the matching Linux asset
// is fetched directly rather than guessed.

const ffmpegDir = path.join(modules, 'ffmpeg-static');
if (await exists(ffmpegDir)) {
  const meta = JSON.parse(
    await readFile(path.join(ffmpegDir, 'package.json'), 'utf8'),
  );
  const tag = meta[meta.name]?.['binary-release-tag'] ?? 'b6.1.1';
  const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/ffmpeg-${PLATFORM}-${ARCH}`;

  log(`fetching ffmpeg ${tag} for ${PLATFORM}-${ARCH}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`ffmpeg download failed: ${response.status} ${url}`);
  }
  const out = path.join(ffmpegDir, 'ffmpeg');
  await pipeline(response.body, createWriteStream(out, { mode: 0o755 }));
} else {
  log('ffmpeg-static not traced into the bundle — skipping');
}

// ffprobe-static ships every platform under bin/<platform>/<arch>, but Next's
// file tracing keeps only the one the build host can execute — so the Linux
// binary has to be carried over from the source tree by hand.
const probeDir = path.join(modules, 'ffprobe-static');
if (await exists(probeDir)) {
  const from = path.join(
    ROOT,
    'node_modules/ffprobe-static/bin',
    PLATFORM,
    ARCH,
    'ffprobe',
  );
  const to = path.join(probeDir, 'bin', PLATFORM, ARCH, 'ffprobe');

  if (!(await exists(from))) {
    throw new Error(
      `ffprobe-static has no ${PLATFORM}/${ARCH} binary in node_modules — reinstall it`,
    );
  }

  log(`copying ffprobe for ${PLATFORM}-${ARCH}`);
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
  await chmod(to, 0o755);

  // The host-OS build is dead weight and would mask a bad copy of the above.
  await rm(path.join(probeDir, 'bin', process.platform), {
    recursive: true,
    force: true,
  });
}

// --- 5. Drop the host-OS Prisma engine -------------------------------------
// The client picks an engine by platform at runtime, so the Mac one is never
// loaded on the server — it is 15+ MB of upload for nothing, and leaving it
// makes the stray check below permanently noisy.

const prismaClient = path.join(modules, '.prisma/client');
if (await exists(prismaClient)) {
  for (const engine of [
    'libquery_engine-darwin.dylib.node',
    'libquery_engine-darwin-arm64.dylib.node',
    'query_engine-windows.dll.node',
  ]) {
    const p = path.join(prismaClient, engine);
    if (await exists(p)) {
      await rm(p, { force: true });
      log(`removed host engine ${engine}`);
    }
  }
}

// --- 6. Verify no host-OS artefacts survived -------------------------------

const strays = execFileSync(
  'find',
  [
    modules,
    '-maxdepth',
    '3',
    '-name',
    '*darwin*',
    '-o',
    '-maxdepth',
    '3',
    '-name',
    '*.dylib*',
  ],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

const prismaEngine = path.join(
  modules,
  '.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node',
);
if (!(await exists(prismaEngine))) {
  throw new Error(
    'Prisma Linux query engine missing. Add "debian-openssl-3.0.x" to\n' +
      'binaryTargets in prisma/schema.prisma and re-run.',
  );
}

await writeFile(
  path.join(DIST, 'BUILD-INFO.txt'),
  [
    `target:    ${PLATFORM}-${ARCH} (glibc)`,
    `app url:   ${process.env.NEXT_PUBLIC_APP_URL}`,
    `built:     ${new Date().toISOString()}`,
    `node:      ${process.version} on ${process.platform}-${process.arch}`,
    '',
    'Start with:  NODE_ENV=production PORT=3000 node server.js',
    'Still required on the host: PostgreSQL, LibreOffice, Poppler, Ghostscript.',
    '',
  ].join('\n'),
);

await writeFile(path.join(DIST, 'START-HERE.md'), startHere());

function startHere() {
  return `# HexaConverter — Linux x64 build

Built for **linux-x64 (glibc)** — Ubuntu 22.04/24.04, Debian 12. The native
modules are already the Linux ones, so **no \`npm install\` is needed on the
server**. Upload this folder as-is.

Compiled in: \`${process.env.NEXT_PUBLIC_APP_URL}\`. That value is baked into the
JavaScript and cannot be changed by an environment variable — a different
domain means a rebuild.

## This is a Node application, not a static site

Nothing runs because the files exist. Something must start it and keep it alive:

\`\`\`bash
NODE_ENV=production PORT=3000 node server.js
\`\`\`

Dropping this into \`public_html\` on shared hosting serves nothing. If your plan
cannot run a persistent process, this build cannot run there.

## What the server still needs

| Need                     | Provides                        | Without it                          |
| ------------------------ | ------------------------------- | ----------------------------------- |
| **Node.js 22+**          | runs \`server.js\`               | nothing works                       |
| **PostgreSQL 14+**       | the job queue                   | nothing works                       |
| **LibreOffice**          | Office documents                | those routes report unavailable     |
| **Poppler**              | PDF → image, PDF text           | those routes report unavailable     |
| **Ghostscript**          | PDF compression                 | falls back to a lossless rewrite    |
| **nginx + TLS**          | HTTPS                           | plain HTTP on a local port          |

\`\`\`bash
sudo apt-get install -y libreoffice-writer libreoffice-calc libreoffice-impress \\
  poppler-utils ghostscript fonts-liberation2 fonts-dejavu-core
\`\`\`

ffmpeg and ffprobe are bundled — you do not need to install them.

## First run

\`\`\`bash
# 1. Schema (needs DATABASE_URL in the environment)
npx prisma migrate deploy

# 2. Start
NODE_ENV=production PORT=3000 node server.js

# 3. Check
curl -s http://127.0.0.1:3000/api/health
\`\`\`

\`"status":"ok"\` means database and storage are reachable. \`libreoffice\` or
\`poppler\` showing \`degraded\` means those packages are not installed — the site
runs, those conversions do not.

## Configuration

Supply these as environment variables, not as a file in this folder:

\`\`\`
DATABASE_URL, DIRECT_URL, DOWNLOAD_URL_SECRET, CRON_SECRET,
STORAGE_DRIVER, ALLOW_LOCAL_STORAGE_IN_PRODUCTION, STORAGE_LOCAL_DIR,
MAX_UPLOAD_BYTES, FILE_RETENTION_HOURS, WORKER_ENABLED, WORKER_CONCURRENCY,
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, CONTACT_INBOX
\`\`\`

> **No \`.env\` ships here on purpose.** The build copies the developer's own
> \`.env\` into the output; this script deletes it, because it holds real
> credentials and this folder is meant to be uploaded.

## Retention

\`/api/cron/cleanup\` must be called periodically — nothing else deletes expired
files, and the privacy policy promises they go.

\`\`\`cron
0 * * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" http://127.0.0.1:3000/api/cron/cleanup
\`\`\`

## Rebuilding

\`\`\`bash
NEXT_PUBLIC_APP_URL=https://www.hexaconverter.com npm run build:linux
\`\`\`
`;
}

log('done');
if (strays.length) {
  console.warn(`\n⚠ ${strays.length} host-OS artefact(s) still present:`);
  for (const s of strays.slice(0, 10))
    console.warn('   ' + path.relative(DIST, s));
  process.exitCode = 1;
} else {
  log('no darwin artefacts remain');
}

await rm(staging, { recursive: true, force: true });
