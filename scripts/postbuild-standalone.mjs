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
import path from 'node:path';

const ROOT = process.cwd();
const STANDALONE = path.join(ROOT, '.next/standalone');

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
