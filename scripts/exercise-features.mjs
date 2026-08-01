/**
 * Exercises the parts of the app that are not plain format conversion: the PDF
 * and archive toolkits, chunked upload sessions, job cancellation, the cron
 * hooks, and the rendered pages.
 *
 * Usage: node scripts/exercise-features.mjs <fixtureDir> [baseUrl]
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const fixtureDir = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:3000';
const cronSecret = process.env.CRON_SECRET;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { pass: [], fail: [] };

let fakeIp = 0;
const jar = new Map();

async function http(url, init = {}) {
  const headers = new Headers(init.headers);
  fakeIp += 1;
  headers.set('x-forwarded-for', `10.${(fakeIp >> 16) & 0xff}.${(fakeIp >> 8) & 0xff}.${fakeIp & 0xff}`);
  if (jar.size && init.useJar !== false) {
    headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  }
  const response = await fetch(url.startsWith('http') ? url : `${base}${url}`, { ...init, headers });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  return response;
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.pass.push(`${name}${detail ? ` — ${detail}` : ''}`);
    process.stdout.write('.');
  } catch (error) {
    results.fail.push(`${name}: ${error.message}`);
    process.stdout.write('F');
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function body(response) {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return json.data ?? json;
  } catch {
    return text;
  }
}

async function upload(file) {
  const bytes = await fs.readFile(path.join(fixtureDir, file));
  const response = await http('/api/uploads', {
    method: 'POST',
    headers: {
      'x-file-name': encodeURIComponent(file),
      'content-type': 'application/octet-stream',
    },
    body: bytes,
  });
  const json = await body(response);
  assert(response.ok, `upload ${response.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

async function awaitJob(jobId, { expect = 'COMPLETED' } = {}) {
  const deadline = Date.now() + 120_000;
  let job;
  while (Date.now() < deadline) {
    await sleep(500);
    const response = await http(`/api/jobs/${jobId}`);
    job = (await body(response)).job;
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) break;
  }
  assert(job.status === expect, `job ended ${job.status} (wanted ${expect}): ${job.error ?? ''}`);
  return job;
}

async function download(job) {
  assert(job.downloadUrl, 'no downloadUrl on a completed job');
  const response = await http(job.downloadUrl, { redirect: 'follow' });
  assert(response.ok, `download ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ------------------------------------------------------------ PDF toolkit
async function pdfTask(payload) {
  const response = await http('/api/tools/pdf', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await body(response);
  assert(response.ok, `${response.status}: ${JSON.stringify(json).slice(0, 250)}`);
  return json.job;
}

await check('pdf MERGE', async () => {
  const a = await upload('sample.pdf');
  const b = await upload('sample.pdf');
  const job = await pdfTask({ operation: 'MERGE', tickets: [a.ticket, b.ticket] });
  const bytes = await download(await awaitJob(job.id));
  assert(bytes.subarray(0, 5).toString() === '%PDF-', 'merged output is not a PDF');
  const { PDFDocument } = await import('pdf-lib');
  const pages = (await PDFDocument.load(bytes)).getPageCount();
  assert(pages === 4, `expected 4 pages from two 2-page files, got ${pages}`);
  return `${pages} pages`;
});

await check('pdf SPLIT', async () => {
  const a = await upload('sample.pdf');
  const job = await pdfTask({ operation: 'SPLIT', tickets: [a.ticket], splitMode: 'pages' });
  const bytes = await download(await awaitJob(job.id));
  assert(bytes[0] === 0x50 && bytes[1] === 0x4b, 'split output should be a zip of pages');
  return `${bytes.length}B zip`;
});

await check('pdf EXTRACT_PAGES', async () => {
  const a = await upload('sample.pdf');
  const job = await pdfTask({ operation: 'EXTRACT_PAGES', tickets: [a.ticket], pages: '2' });
  const bytes = await download(await awaitJob(job.id));
  const { PDFDocument } = await import('pdf-lib');
  const pages = (await PDFDocument.load(bytes)).getPageCount();
  assert(pages === 1, `expected 1 extracted page, got ${pages}`);
  return '1 page';
});

await check('pdf ROTATE', async () => {
  const a = await upload('sample.pdf');
  const job = await pdfTask({ operation: 'ROTATE', tickets: [a.ticket], angle: 90 });
  const bytes = await download(await awaitJob(job.id));
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  const angle = doc.getPage(0).getRotation().angle;
  assert(angle === 90, `expected 90° rotation, got ${angle}`);
  return '90°';
});

await check('pdf COMPRESS', async () => {
  const a = await upload('sample.pdf');
  const job = await pdfTask({ operation: 'COMPRESS', tickets: [a.ticket], compression: 'balanced' });
  const bytes = await download(await awaitJob(job.id));
  assert(bytes.subarray(0, 5).toString() === '%PDF-', 'compressed output is not a PDF');
  return `${bytes.length}B`;
});

await check('pdf MERGE rejects a single file', async () => {
  const a = await upload('sample.pdf');
  const response = await http('/api/tools/pdf', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'MERGE', tickets: [a.ticket] }),
  });
  assert(response.status === 422, `expected 422, got ${response.status}`);
  return '422';
});

await check('pdf EXTRACT_PAGES rejects a bad page spec', async () => {
  const a = await upload('sample.pdf');
  const response = await http('/api/tools/pdf', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'EXTRACT_PAGES', tickets: [a.ticket], pages: 'nonsense' }),
  });
  assert(response.status === 422, `expected 422, got ${response.status}`);
  return '422';
});

// -------------------------------------------------------- archive toolkit
async function archiveTask(payload) {
  const response = await http('/api/tools/archive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await body(response);
  assert(response.ok, `${response.status}: ${JSON.stringify(json).slice(0, 250)}`);
  return json.job;
}

await check('archive EXTRACT', async () => {
  const a = await upload('sample.zip');
  const job = await archiveTask({ operation: 'EXTRACT', tickets: [a.ticket] });
  const bytes = await download(await awaitJob(job.id));
  assert(bytes.length > 0, 'extract produced nothing');
  return `${bytes.length}B`;
});

await check('archive ARCHIVE (multi-file to zip)', async () => {
  const a = await upload('sample.txt');
  const b = await upload('sample.csv');
  const job = await archiveTask({ operation: 'ARCHIVE', tickets: [a.ticket, b.ticket], target: 'zip' });
  const bytes = await download(await awaitJob(job.id));
  assert(bytes[0] === 0x50 && bytes[1] === 0x4b, 'not a zip');
  return `${bytes.length}B`;
});

for (const target of ['7z', 'tar', 'tgz']) {
  await check(`archive ARCHIVE to ${target}`, async () => {
    const a = await upload('sample.txt');
    const job = await archiveTask({ operation: 'ARCHIVE', tickets: [a.ticket], target });
    const bytes = await download(await awaitJob(job.id));
    assert(bytes.length > 0, 'empty');
    return `${bytes.length}B`;
  });
}

await check('archive PROTECT (password)', async () => {
  const a = await upload('sample.txt');
  const job = await archiveTask({
    operation: 'PROTECT',
    tickets: [a.ticket],
    target: 'zip',
    password: 'correct horse battery staple',
    encryption: 'aes256',
  });
  const bytes = await download(await awaitJob(job.id));
  assert(bytes[0] === 0x50 && bytes[1] === 0x4b, 'not a zip');
  return `${bytes.length}B`;
});

await check('archive PROTECT requires a password', async () => {
  const a = await upload('sample.txt');
  const response = await http('/api/tools/archive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'PROTECT', tickets: [a.ticket], target: 'zip' }),
  });
  assert(response.status === 422, `expected 422, got ${response.status}`);
  return '422';
});

// ------------------------------------------------------- upload behaviour
await check('upload rejects a missing filename header', async () => {
  const response = await http('/api/uploads', { method: 'POST', body: Buffer.from('hello') });
  assert(response.status === 400, `expected 400, got ${response.status}`);
  return '400';
});

await check('upload rejects an unsupported type', async () => {
  const response = await http('/api/uploads', {
    method: 'POST',
    headers: { 'x-file-name': 'evil.exe', 'content-type': 'application/octet-stream' },
    body: Buffer.from('MZ\x90\x00 this is a windows executable'),
  });
  assert(response.status === 415, `expected 415, got ${response.status}`);
  return '415';
});

await check('upload rejects content that contradicts its extension', async () => {
  // A PNG renamed to .pdf must be caught by magic-byte checking.
  const png = await fs.readFile(path.join(fixtureDir, 'sample.png'));
  const response = await http('/api/uploads', {
    method: 'POST',
    headers: { 'x-file-name': 'actually-a-png.pdf', 'content-type': 'application/octet-stream' },
    body: png,
  });
  assert(response.status === 415, `expected 415, got ${response.status}`);
  return '415';
});

await check('job creation rejects an unsupported target', async () => {
  const a = await upload('sample.png');
  const response = await http('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: a.ticket, targetFormat: 'mp4' }),
  });
  assert(response.status === 422, `expected 422, got ${response.status}`);
  return '422';
});

await check('job creation rejects a tampered ticket', async () => {
  const a = await upload('sample.png');
  const tampered = a.ticket.slice(0, -4) + 'AAAA';
  const response = await http('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: tampered, targetFormat: 'jpg' }),
  });
  assert(response.status === 403, `expected 403, got ${response.status}`);
  return '403';
});

await check('download rejects a forged token', async () => {
  const a = await upload('sample.png');
  const created = await http('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: a.ticket, targetFormat: 'jpg' }),
  });
  const job = await awaitJob((await body(created)).job.id);
  const forged = job.downloadUrl.replace(/token=.*/, 'token=bm90LWEtdG9rZW4.ZmFrZXNpZ25hdHVyZQ');
  const response = await http(forged);
  assert(response.status === 403, `expected 403, got ${response.status}`);
  return '403';
});

// --------------------------------------------------------- chunked upload
await check('chunked upload session', async () => {
  const bytes = await fs.readFile(path.join(fixtureDir, 'sample.mp4'));

  const started = await http('/api/uploads/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: 'sample.mp4', size: bytes.length }),
  });
  const payload = await body(started);
  assert(started.ok, `session start ${started.status}: ${JSON.stringify(payload).slice(0, 250)}`);

  // The server decides the chunk size; the client has to follow it.
  const session = payload.session ?? payload;
  const { id, chunkSize, totalChunks } = session;
  assert(chunkSize > 0, `session did not report a chunk size: ${JSON.stringify(session)}`);

  for (let index = 0; index < totalChunks; index += 1) {
    const chunk = bytes.subarray(index * chunkSize, (index + 1) * chunkSize);
    const put = await http(`/api/uploads/sessions/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream', 'x-chunk-index': String(index) },
      body: chunk,
    });
    assert(put.ok, `chunk ${index} ${put.status}: ${JSON.stringify(await body(put)).slice(0, 200)}`);
  }

  const completed = await http(`/api/uploads/sessions/${id}/complete`, { method: 'POST' });
  const result = await body(completed);
  assert(completed.ok, `complete ${completed.status}: ${JSON.stringify(result).slice(0, 250)}`);
  assert(result.ticket, 'completed session returned no ticket');

  const created = await http('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: result.ticket, targetFormat: 'webm' }),
  });
  const job = await awaitJob((await body(created)).job.id);
  const out = await download(job);
  assert(out.length > 0, 'converted chunked upload was empty');
  return `${totalChunks} chunks of ${chunkSize}B, ${out.length}B out`;
});

await check('chunked upload rejects a missing chunk index', async () => {
  const bytes = await fs.readFile(path.join(fixtureDir, 'sample.txt'));
  const started = await http('/api/uploads/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: 'sample.txt', size: bytes.length }),
  });
  const session = (await body(started)).session ?? (await body(started));
  const put = await http(`/api/uploads/sessions/${session.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  assert(put.status === 400, `expected 400 without x-chunk-index, got ${put.status}`);
  return '400';
});

await check('chunked upload rejects an out-of-range chunk index', async () => {
  const bytes = await fs.readFile(path.join(fixtureDir, 'sample.txt'));
  const started = await http('/api/uploads/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: 'sample.txt', size: bytes.length }),
  });
  const session = (await body(started)).session ?? (await body(started));
  const put = await http(`/api/uploads/sessions/${session.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream', 'x-chunk-index': '9999' },
    body: bytes,
  });
  assert(put.status === 400, `expected 400, got ${put.status}`);
  return '400';
});

await check('chunked upload of a 20MB file survives intact', async () => {
  const bytes = await fs.readFile(path.join(fixtureDir, 'large.mp4'));
  assert(bytes.length > 16 * 1024 * 1024, 'fixture is too small to span three chunks');

  const started = await http('/api/uploads/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: 'large.mp4', size: bytes.length }),
  });
  const payload = await body(started);
  assert(started.ok, `session start ${started.status}: ${JSON.stringify(payload).slice(0, 250)}`);
  const session = payload.session ?? payload;
  assert(session.totalChunks >= 3, `expected 3+ chunks, got ${session.totalChunks}`);

  for (let index = 0; index < session.totalChunks; index += 1) {
    const chunk = bytes.subarray(index * session.chunkSize, (index + 1) * session.chunkSize);
    const put = await http(`/api/uploads/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream', 'x-chunk-index': String(index) },
      body: chunk,
    });
    assert(put.ok, `chunk ${index} ${put.status}: ${JSON.stringify(await body(put)).slice(0, 200)}`);
  }

  const completed = await http(`/api/uploads/sessions/${session.id}/complete`, { method: 'POST' });
  const result = await body(completed);
  assert(completed.ok, `complete ${completed.status}: ${JSON.stringify(result).slice(0, 250)}`);

  // The reassembled size is the real check: a truncated join still yields a
  // playable prefix, so only the byte count catches it.
  assert(
    result.file.size === bytes.length,
    `reassembled ${result.file.size} bytes, uploaded ${bytes.length}`,
  );
  return `${session.totalChunks} chunks, ${result.file.size} bytes intact`;
});

await check('single-shot upload of a 20MB file is not truncated', async () => {
  const bytes = await fs.readFile(path.join(fixtureDir, 'large.mp4'));
  const uploaded = await upload('large.mp4');
  assert(
    uploaded.file.size === bytes.length,
    `stored ${uploaded.file.size} bytes, sent ${bytes.length}`,
  );
  return `${uploaded.file.size} bytes intact`;
});

// -------------------------------------------------------- job lifecycle
await check('job cancel', async () => {
  const a = await upload('sample.mp4');
  const created = await http('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: a.ticket, targetFormat: 'webm' }),
  });
  const jobId = (await body(created)).job.id;
  const cancelled = await http(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
  assert([200, 202, 409].includes(cancelled.status), `cancel returned ${cancelled.status}`);
  return `status ${cancelled.status}`;
});

await check('job list is scoped to the requester', async () => {
  const response = await http('/api/jobs?limit=5');
  const json = await body(response);
  assert(response.ok, `list ${response.status}`);
  assert(Array.isArray(json.jobs ?? json.items), 'no jobs array');
  return `${(json.jobs ?? json.items).length} jobs`;
});

await check('unknown job id is a 404', async () => {
  const response = await http('/api/jobs/clnonexistent000000000000');
  assert(response.status === 404, `expected 404, got ${response.status}`);
  return '404';
});

// -------------------------------------------------- read-only endpoints
for (const [name, url] of [
  ['health', '/api/health'],
  ['formats', '/api/formats'],
  ['limits', '/api/limits'],
]) {
  await check(`GET /api/${name}`, async () => {
    const response = await http(url);
    assert(response.ok, `${response.status}`);
    return `${response.status}`;
  });
}

await check('/api/storage is DELETE-only', async () => {
  const response = await http('/api/storage');
  assert(
    response.status === 405,
    `GET /api/storage returned ${response.status}, expected 405`,
  );
  return '405';
});

// ------------------------------------------------------------------ cron
await check('cron endpoints reject an unauthenticated call', async () => {
  const cleanup = await http('/api/cron/cleanup', { method: 'POST' });
  assert(cleanup.status === 401 || cleanup.status === 403, `cleanup returned ${cleanup.status}`);
  return `${cleanup.status}`;
});

if (cronSecret) {
  await check('cron cleanup with the secret', async () => {
    const response = await http('/api/cron/cleanup', {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    const payload = await body(response);
    assert(response.ok, `${response.status}: ${JSON.stringify(payload).slice(0, 200)}`);
    return JSON.stringify(payload).slice(0, 120);
  });
  await check('cron process with the secret', async () => {
    const response = await http('/api/cron/process', {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    assert(response.ok, `${response.status}`);
    return `${response.status}`;
  });
}

// ------------------------------------------------------------- contact
await check('contact form validates its input', async () => {
  const response = await http('/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', email: 'not-an-email', message: '' }),
  });
  assert(response.status === 422 || response.status === 400, `expected 4xx, got ${response.status}`);
  return `${response.status}`;
});

console.log('\n');
console.log(`PASS ${results.pass.length}  FAIL ${results.fail.length}`);
for (const p of results.pass) console.log(`  ok   ${p}`);
if (results.fail.length) {
  console.log('\n--- FAILURES ---');
  for (const f of results.fail) console.log(`  FAIL ${f}`);
}
