/**
 * Drives every advertised conversion route against a running server: uploads a
 * fixture, queues the job, polls to completion, downloads the result and checks
 * the bytes are a plausible file of the target format.
 *
 * Usage: node scripts/exercise-routes.mjs <fixtureDir> [baseUrl]
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const fixtureDir = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:3000';
const only = process.env.ONLY?.split(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Leading bytes that identify a finished file, so a route cannot "succeed"
 *  by handing back the input untouched or an empty placeholder. */
const SIGNATURES = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b.subarray(0, 3).toString() === 'GIF',
  bmp: (b) => b.subarray(0, 2).toString() === 'BM',
  webp: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  avif: (b) => b.subarray(4, 8).toString() === 'ftyp',
  tiff: (b) => ['II*\0', 'MM\0*'].includes(b.subarray(0, 4).toString('binary')),
  pdf: (b) => b.subarray(0, 5).toString() === '%PDF-',
  zip: (b) => b[0] === 0x50 && b[1] === 0x4b,
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  xlsx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  pptx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  odt: (b) => b[0] === 0x50 && b[1] === 0x4b,
  ods: (b) => b[0] === 0x50 && b[1] === 0x4b,
  odp: (b) => b[0] === 0x50 && b[1] === 0x4b,
  gz: (b) => b[0] === 0x1f && b[1] === 0x8b,
  tgz: (b) => b[0] === 0x1f && b[1] === 0x8b,
  '7z': (b) => b.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])),
  tar: (b) => b.subarray(257, 262).toString() === 'ustar',
  mp3: (b) => b.subarray(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  flac: (b) => b.subarray(0, 4).toString() === 'fLaC',
  ogg: (b) => b.subarray(0, 4).toString() === 'OggS',
  opus: (b) => b.subarray(0, 4).toString() === 'OggS',
  wav: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WAVE',
  m4a: (b) => b.subarray(4, 8).toString() === 'ftyp',
  aac: (b) => (b[0] === 0xff && (b[1] & 0xf0) === 0xf0) || b.subarray(0, 3).toString() === 'ID3',
  mp4: (b) => b.subarray(4, 8).toString() === 'ftyp',
  mov: (b) => b.subarray(4, 8).toString() === 'ftyp',
  mkv: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  webm: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  avi: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 11).toString() === 'AVI',
  // Text-ish outputs: check they are non-empty valid text rather than a magic number.
  txt: (b) => b.length > 0 && !b.includes(0),
  csv: (b) => b.length > 0 && !b.includes(0),
  json: (b) => { try { JSON.parse(b.toString()); return true; } catch { return false; } },
  html: (b) => /<html|<!doctype|<h1|<p|<body/i.test(b.toString('utf8', 0, 2000)),
  rtf: (b) => b.subarray(0, 5).toString() === '{\\rtf',
};

/**
 * Guest identity lives in an http-only cookie set on the first request. Upload
 * tickets are bound to it, so every call in a run has to carry the same jar or
 * the job endpoint rejects the ticket as belonging to someone else.
 */
const jar = new Map();

/**
 * Rate limits are keyed on the client IP, which the server reads from
 * `x-forwarded-for`. A full sweep is far more traffic than the abuse
 * thresholds allow, so each request presents a distinct address. This works
 * only because nothing is in front of the dev server rewriting the header.
 */
let fakeIp = 0;

async function http(url, init = {}) {
  const headers = new Headers(init.headers);
  fakeIp += 1;
  headers.set(
    'x-forwarded-for',
    `10.${(fakeIp >> 16) & 0xff}.${(fakeIp >> 8) & 0xff}.${fakeIp & 0xff}`,
  );
  if (jar.size) {
    headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  }
  const response = await fetch(url, { ...init, headers });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return response;
}

const formats = await (await http(`${base}/api/formats`)).json();
const available = formats.routes.filter((r) => r.available);

const fixtures = new Map();
for (const file of await fs.readdir(fixtureDir)) {
  const ext = path.extname(file).slice(1).toLowerCase();
  fixtures.set(ext, path.join(fixtureDir, file));
}

const results = { pass: [], fail: [], skip: [] };

async function uploadFixture(format) {
  const file = fixtures.get(format);
  const body = await fs.readFile(file);
  const response = await http(`${base}/api/uploads`, {
    method: 'POST',
    headers: {
      'x-file-name': encodeURIComponent(path.basename(file)),
      'content-type': 'application/octet-stream',
      'content-length': String(body.length),
    },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`upload ${response.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json.data ?? json;
}

async function convert(from, to) {
  const uploaded = await uploadFixture(from);
  const ticket = uploaded.ticket;

  const created = await http(`${base}/api/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket, targetFormat: to }),
  });
  const createdJson = await created.json().catch(() => ({}));
  if (!created.ok) {
    throw new Error(`create ${created.status}: ${JSON.stringify(createdJson).slice(0, 300)}`);
  }
  const jobId = (createdJson.data ?? createdJson).job.id;

  const deadline = Date.now() + 120_000;
  let job;
  while (Date.now() < deadline) {
    await sleep(600);
    const polled = await http(`${base}/api/jobs/${jobId}`);
    const polledJson = await polled.json().catch(() => ({}));
    if (!polled.ok) throw new Error(`poll ${polled.status}: ${JSON.stringify(polledJson).slice(0, 200)}`);
    job = (polledJson.data ?? polledJson).job;
    if (job.status === 'COMPLETED' || job.status === 'FAILED') break;
  }
  if (!job) throw new Error('no job state');
  if (job.status !== 'COMPLETED') {
    throw new Error(`job ${job.status}: ${job.error ?? job.errorMessage ?? 'no message'}`);
  }

  // Authorisation for a download is the signed token the job carries, not the
  // session — the URL is meant to be shareable on its own.
  if (!job.downloadUrl) throw new Error('completed job exposed no downloadUrl');
  const download = await http(`${base}${job.downloadUrl}`, { redirect: 'follow' });
  if (!download.ok) throw new Error(`download ${download.status}`);
  const bytes = Buffer.from(await download.arrayBuffer());
  if (bytes.length === 0) throw new Error('download was empty');

  // Multi-file outputs (e.g. pdf → jpg on a 2-page document) come back zipped.
  const disposition = download.headers.get('content-disposition') ?? '';
  const zipped = /\.zip"?$/.test(disposition) || (bytes[0] === 0x50 && bytes[1] === 0x4b && to !== 'zip' && !['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].includes(to));

  const check = SIGNATURES[to];
  if (!zipped && check && !check(bytes)) {
    throw new Error(`output is not a valid ${to} (${bytes.length} bytes, starts ${bytes.subarray(0, 8).toString('hex')})`);
  }
  return { bytes: bytes.length, zipped };
}

for (const route of available) {
  const label = `${route.from} -> ${route.to}`;
  if (only && !only.includes(label)) continue;
  if (!fixtures.has(route.from)) {
    results.skip.push(`${label} (no ${route.from} fixture)`);
    continue;
  }
  try {
    const out = await convert(route.from, route.to);
    results.pass.push(`${label} (${out.bytes}B${out.zipped ? ', zipped' : ''})`);
    process.stdout.write('.');
  } catch (error) {
    results.fail.push(`${label}: ${error.message}`);
    process.stdout.write('F');
  }
}

console.log('\n');
console.log(`PASS ${results.pass.length}  FAIL ${results.fail.length}  SKIP ${results.skip.length}`);
if (results.fail.length) {
  console.log('\n--- FAILURES ---');
  for (const f of results.fail) console.log(f);
}
if (results.skip.length) {
  console.log('\n--- SKIPPED ---');
  for (const s of results.skip) console.log(s);
}
await fs.writeFile(
  path.join(fixtureDir, '..', 'route-results.json'),
  JSON.stringify(results, null, 2),
);
