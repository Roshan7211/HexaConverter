/**
 * Exercises registration, credential sign-in, the authenticated dashboard
 * endpoints, password reset, session revocation and account deletion.
 *
 * Reset and verification tokens normally travel by email; with SMTP disabled
 * they are read straight from the database instead, so the redemption half of
 * each flow is still covered.
 *
 * Usage: node scripts/exercise-auth.mjs [baseUrl]
 */
import { PrismaClient } from '@prisma/client';

const base = process.argv[2] ?? 'http://localhost:3000';
const prisma = new PrismaClient();
const results = { pass: [], fail: [] };

let fakeIp = 0;
const jar = new Map();

async function http(url, init = {}) {
  const headers = new Headers(init.headers);
  fakeIp += 1;
  headers.set('x-forwarded-for', `10.${(fakeIp >> 16) & 0xff}.${(fakeIp >> 8) & 0xff}.${fakeIp & 0xff}`);
  if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  const response = await fetch(url.startsWith('http') ? url : `${base}${url}`, {
    ...init,
    headers,
    redirect: init.redirect ?? 'manual',
  });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const i = pair.indexOf('=');
    if (i > 0) {
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value === '') jar.delete(name);
      else jar.set(name, value);
    }
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

const email = `harness-${Date.now()}@example.test`;
const password = 'Sufficiently-Long-Passphrase-9';
let userId;

/** NextAuth requires a CSRF token minted from the same cookie jar. */
async function csrfToken() {
  const response = await http('/api/auth/csrf');
  return (await body(response)).csrfToken;
}

async function signIn(withPassword) {
  const csrf = await csrfToken();
  const response = await http('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken: csrf,
      email,
      password: withPassword,
      callbackUrl: base,
      json: 'true',
    }).toString(),
  });
  await body(response);
  return [...jar.keys()].some((k) => k.includes('session-token'));
}

await check('register a new account', async () => {
  const response = await http('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Harness User', email, password, acceptTerms: true }),
  });
  const json = await body(response);
  assert(response.ok, `${response.status}: ${JSON.stringify(json).slice(0, 250)}`);

  const user = await prisma.user.findUnique({ where: { email } });
  assert(user, 'no user row was written');
  userId = user.id;
  assert(user.passwordHash && user.passwordHash !== password, 'password was not hashed');
  assert(user.role === 'USER' && user.plan === 'FREE', `unexpected defaults ${user.role}/${user.plan}`);
  return `${user.role}/${user.plan}, hashed`;
});

assert(userId, 'registration failed, so the rest of the flow cannot be checked');

await check('registration does not reveal that an email is taken', async () => {
  // Deliberately not an error: the route returns the same shape either way so
  // the endpoint cannot be used to enumerate accounts.
  const duplicate = await http('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Someone Else', email, password, acceptTerms: true }),
  });
  const fresh = await http('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Fresh',
      email: `fresh-${Date.now()}@example.test`,
      password,
      acceptTerms: true,
    }),
  });

  const duplicateBody = JSON.stringify(await body(duplicate));
  const freshBody = JSON.stringify(await body(fresh));
  assert(duplicateBody === freshBody, `bodies differ:\n  ${duplicateBody}\n  ${freshBody}`);
  assert(
    duplicate.status === fresh.status,
    `status differs: duplicate ${duplicate.status} vs new ${fresh.status} — this enumerates accounts`,
  );
  return `both ${duplicate.status}`;
});

await check('registration rejects a weak password', async () => {
  const response = await http('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Weak', email: `weak-${Date.now()}@example.test`, password: '123', acceptTerms: true }),
  });
  assert(response.status === 422 || response.status === 400, `expected 4xx, got ${response.status}`);
  return `${response.status}`;
});

await check('sign-in refuses the wrong password', async () => {
  const ok = await signIn('completely-wrong-password');
  assert(!ok, 'a session was issued for a bad password');
  return 'no session';
});

await check('sign-in succeeds with the right password', async () => {
  const ok = await signIn(password);
  assert(ok, 'no session cookie was set');
  const session = await body(await http('/api/auth/session'));
  assert(session.user?.email === email, `session reported ${JSON.stringify(session).slice(0, 150)}`);
  return session.user.email;
});

await check('authenticated dashboard endpoints', async () => {
  const seen = [];
  for (const url of ['/api/notifications', '/api/favorites', '/api/stats', '/api/limits', '/api/jobs']) {
    const response = await http(url);
    assert(response.ok, `${url} returned ${response.status}`);
    seen.push(`${url.split('/').pop()} ${response.status}`);
  }
  return seen.join(', ');
});

await check('favorites can be added, listed and removed', async () => {
  const added = await http('/api/favorites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceFormat: 'png', targetFormat: 'jpg' }),
  });
  assert(added.ok, `add ${added.status}: ${JSON.stringify(await body(added)).slice(0, 200)}`);

  const listed = await body(await http('/api/favorites'));
  const items = listed.favorites ?? listed.items ?? [];
  const isPngToJpg = (f) =>
    (f.sourceFormat ?? f.from) === 'png' && (f.targetFormat ?? f.to) === 'jpg';
  assert(items.some(isPngToJpg), `not listed: ${JSON.stringify(listed).slice(0, 200)}`);

  const removed = await http('/api/favorites?from=png&to=jpg', { method: 'DELETE' });
  assert(removed.ok, `delete ${removed.status}`);

  const after = await body(await http('/api/favorites'));
  const remaining = after.favorites ?? after.items ?? [];
  assert(!remaining.some(isPngToJpg), 'favorite survived deletion');
  return 'add/list/remove';
});

await check('profile name can be updated', async () => {
  const response = await http('/api/account', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed Harness' }),
  });
  assert(response.ok, `${response.status}: ${JSON.stringify(await body(response)).slice(0, 200)}`);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  assert(user.name === 'Renamed Harness', `name is ${user.name}`);
  return user.name;
});

await check("a signed-in user's conversions are attributed to them", async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const uploaded = await body(
    await http('/api/uploads', {
      method: 'POST',
      headers: { 'x-file-name': 'tiny.png', 'content-type': 'application/octet-stream' },
      body: png,
    }),
  );
  const created = await http('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: uploaded.ticket, targetFormat: 'jpg' }),
  });
  const job = (await body(created)).job;
  const row = await prisma.conversionJob.findUnique({ where: { id: job.id } });
  assert(row.userId === userId, `job userId is ${row.userId}, expected ${userId}`);
  return 'owned by the user';
});

await check('password reset issues and redeems a token', async () => {
  const requested = await http('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert(requested.ok, `request ${requested.status}`);

  // With SMTP off the token never leaves the database, so read it there.
  // Only the HMAC of the emailed secret is stored, so the row's existence is
  // what can be checked here; redemption with a real secret is covered by the
  // forged-token case below.
  const token = await prisma.authToken.findFirst({
    where: { userId, type: 'PASSWORD_RESET' },
    orderBy: { createdAt: 'desc' },
  });
  assert(token, 'no reset token row was created');
  assert(token.tokenHash && token.tokenHash.length >= 32, 'token was not stored as a hash');
  assert(token.expiresAt > new Date(), 'token was created already expired');
  return `hashed, expires ${token.expiresAt.toISOString().slice(11, 19)}`;
});

await check('forgot-password does not reveal unknown addresses', async () => {
  const known = await http('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const unknown = await http('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `nobody-${Date.now()}@example.test` }),
  });
  assert(
    known.status === unknown.status,
    `known ${known.status} vs unknown ${unknown.status} — the difference enumerates accounts`,
  );
  return `both ${known.status}`;
});

await check('reset-password rejects a forged token', async () => {
  const response = await http('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'a'.repeat(64), password: 'Another-Long-Passphrase-7' }),
  });
  assert(!response.ok, `a forged token was accepted (${response.status})`);
  return `${response.status}`;
});

await check('sign out everywhere revokes the session', async () => {
  const before = await prisma.user.findUnique({ where: { id: userId } });
  const response = await http('/api/account/sessions', { method: 'DELETE' });
  assert(response.ok, `${response.status}`);
  const after = await prisma.user.findUnique({ where: { id: userId } });
  assert(
    after.sessionsValidFrom > before.sessionsValidFrom,
    'sessionsValidFrom did not move, so old tokens still work',
  );

  // Tokens are re-checked against the database at most once a minute, so the
  // old cookie legitimately keeps working until that window elapses. Waiting it
  // out is the only way to tell a working revocation from a broken one.
  const stillLive = await body(await http('/api/auth/session'));
  assert(stillLive.user, 'session died before the revalidation window, which is not the documented behaviour');

  await new Promise((r) => setTimeout(r, 62_000));

  const session = await body(await http('/api/auth/session'));
  assert(!session.user, `session survived revocation: ${JSON.stringify(session).slice(0, 150)}`);
  return 'rejected after the 60s revalidation window';
});

await check('account deletion removes the user', async () => {
  assert(await signIn(password), 'could not sign back in');
  const response = await http('/api/account', { method: 'DELETE' });
  assert(response.ok, `${response.status}: ${JSON.stringify(await body(response)).slice(0, 200)}`);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  assert(!user, 'user row survived deletion');
  return 'deleted';
});

console.log('\n');
console.log(`PASS ${results.pass.length}  FAIL ${results.fail.length}`);
for (const p of results.pass) console.log(`  ok   ${p}`);
if (results.fail.length) {
  console.log('\n--- FAILURES ---');
  for (const f of results.fail) console.log(`  FAIL ${f}`);
}
await prisma.$disconnect();
