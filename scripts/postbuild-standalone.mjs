#!/usr/bin/env node
/**
 * Copies static assets into the standalone output. Runs automatically as
 * npm's `postbuild`.
 *
 * `output: 'standalone'` emits a server that resolves assets relative to
 * itself — `.next/standalone/.next/static` and `.next/standalone/public` —
 * but `next build` writes them to `.next/static` and `public`. Next does not
 * copy them, by design: the docs expect a Dockerfile to do it.
 *
 * Deployments that run `server.js` directly (PM2, systemd, a bare VPS) have no
 * such step, and the failure is quiet and expensive: the server starts, every
 * page returns 200, and only the CSS, JavaScript and images 404. The result
 * looks like a broken stylesheet rather than a missing build step, and it is
 * indistinguishable from a CDN problem until someone checks an asset URL.
 *
 * Doing it here means it happens for every deployment shape, not just Docker.
 */

import { cp, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, '.next/standalone');
const require = createRequire(import.meta.url);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(STANDALONE))) {
  // A non-standalone build is legitimate (`next dev`, or a config change).
  // Nothing to do rather than an error.
  console.log('postbuild: no standalone output, skipping');
  process.exit(0);
}

const copies = [
  {
    from: path.join(ROOT, '.next/static'),
    to: path.join(STANDALONE, '.next/static'),
  },
  { from: path.join(ROOT, 'public'), to: path.join(STANDALONE, 'public') },
];

for (const { from, to } of copies) {
  if (!(await exists(from))) continue;
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  console.log(
    `postbuild: ${path.relative(ROOT, from)} -> ${path.relative(ROOT, to)}`,
  );
}

// The whole point is that the server can find these. Assert it, so a future
// change to Next's output layout fails the build rather than the website.
const cssDir = path.join(STANDALONE, '.next/static');
if (!(await exists(cssDir))) {
  console.error(
    'postbuild: .next/standalone/.next/static is missing after copy — the ' +
      'standalone server will 404 every asset. Check the build output layout.',
  );
  process.exit(1);
}

/**
 * Native payloads, which Next's file tracer does not copy either.
 *
 * Listing a package in `serverExternalPackages` keeps it out of the webpack
 * bundle; it does *not* make the tracer copy the package's binary. So the
 * standalone tree got `ffmpeg-static`'s `index.js` and `package.json` and not
 * the 79 MB `ffmpeg` next to them — and every audio and video conversion on
 * production failed with `spawn .../ffmpeg-static/ffmpeg ENOENT`, surfaced to
 * the user as "the media file could not be converted, it may be corrupt", which
 * blames their file for a missing build artefact. It went unnoticed for weeks.
 *
 * The paths are resolved the same way the running server resolves them, rather
 * than hardcoded, because these packages pick a binary per platform and per
 * libc. Hardcoding `linux/x64` would silently copy nothing on a different host,
 * which is the failure mode this whole file exists to prevent. It also means
 * only the binary actually in use is copied: `ffprobe-static` ships every
 * platform, and mirroring the package wholesale would add ~274 MB of binaries
 * for operating systems this server will never run.
 */
const binaryEntryPoints = [
  { name: 'ffmpeg-static', resolve: () => require('ffmpeg-static') },
  { name: 'ffprobe-static', resolve: () => require('ffprobe-static').path },
  { name: '7zip-bin', resolve: () => require('7zip-bin').path7za },
];

/**
 * Payloads with no resolvable export, so they have to be named.
 *
 * `node-unrar-js` loads its WebAssembly by path relative to its own module, and
 * the tracer copied neither copy — so extracting a `.rar` failed the same quiet
 * way ffmpeg did. Both build flavours are listed because the package picks
 * between them by import style.
 */
const extraPayloads = [
  'node_modules/node-unrar-js/esm/js/unrar.wasm',
  'node_modules/node-unrar-js/dist/js/unrar.wasm',
];

const required = [];

for (const { name, resolve } of binaryEntryPoints) {
  let sourcePath;
  try {
    sourcePath = resolve();
  } catch (error) {
    console.error(
      `postbuild: could not resolve the ${name} binary — ${error.message}`,
    );
    process.exit(1);
  }
  if (!sourcePath || !(await exists(sourcePath))) {
    console.error(
      `postbuild: ${name} resolves to ${sourcePath}, which does not exist in ` +
        'node_modules. The install is incomplete; run `npm ci`.',
    );
    process.exit(1);
  }
  required.push({ name, source: sourcePath });
}

for (const relative of extraPayloads) {
  const source = path.join(ROOT, relative);
  // Absent flavours are legitimate — the package only ships the ones it builds.
  if (await exists(source)) required.push({ name: relative, source });
}

for (const { name, source } of required) {
  const destination = path.join(STANDALONE, path.relative(ROOT, source));
  if (await exists(destination)) continue;
  await mkdir(path.dirname(destination), { recursive: true });
  // `cp` preserves the executable bit, which a spawned binary needs.
  await cp(source, destination, { recursive: true, preserveTimestamps: true });
  console.log(`postbuild: ${name} -> ${path.relative(ROOT, destination)}`);
}

// Verify rather than trust. A binary that is missing here is a broken feature
// in production, and the build is the last place it is cheap to notice.
const missing = [];
for (const { name, source } of required) {
  const destination = path.join(STANDALONE, path.relative(ROOT, source));
  if (!(await exists(destination))) missing.push(`${name} (${destination})`);
}

if (missing.length > 0) {
  console.error(
    'postbuild: native payloads missing from the standalone output after ' +
      'copying:\n  ' +
      missing.join('\n  ') +
      '\nThe server would start and fail every conversion that needs them.',
  );
  process.exit(1);
}

console.log(
  `postbuild: verified ${required.length} native payloads in the standalone output`,
);
