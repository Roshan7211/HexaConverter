# HexaConverter — Architecture

The design of the platform, as it is actually built. Every path and boundary in
this document exists in the repository, and the layer rules are enforced by
`tests/unit/architecture.test.ts` — if a dependency points the wrong way, the
test suite fails.

- [1. Layering model](#1-layering-model)
- [2. Folder structure](#2-folder-structure)
- [3. Component structure](#3-component-structure)
- [4. API structure](#4-api-structure)
- [5. Database schema](#5-database-schema)
- [6. Authentication flow](#6-authentication-flow)
- [7. Conversion engine architecture](#7-conversion-engine-architecture)
- [8. Storage architecture](#8-storage-architecture)
- [9. Security architecture](#9-security-architecture)
- [10. Scaling model](#10-scaling-model)
- [11. Full project tree](#11-full-project-tree)

---

## 1. Layering model

Dependencies point in one direction only. Each layer may use the layers below
it and must never reach upwards.

```
┌──────────────────────────────────────────────────────────────┐
│  app/            routing, rendering, HTTP adapters           │
├──────────────────────────────────────────────────────────────┤
│  components/     presentation            hooks/  browser     │
├──────────────────────────────────────────────────────────────┤
│  api/            contracts: schemas, DTOs, responses,        │
│                  typed browser clients                       │
│  middleware/     request pipeline: errors, limits, auth      │
├──────────────────────────────────────────────────────────────┤
│  services/       business logic — the only layer that        │
│                  decides anything                            │
├──────────────────────────────────────────────────────────────┤
│  database/       repositories, Prisma client, seed           │
├──────────────────────────────────────────────────────────────┤
│  lib/            cross-cutting infrastructure (env, logging, │
│                  security, rate limits, plans, SEO)          │
├──────────────────────────────────────────────────────────────┤
│  utils/  types/  pure helpers and shared type surface        │
└──────────────────────────────────────────────────────────────┘
```

**The rules, as enforced by the guard test**

| Layer         | May not import                                              | Why                                                         |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `utils/`      | everything except other utils                               | Bottom of the graph; safe from any layer, server or browser |
| `types/`      | any implementation module                                   | Types must not drag runtime code into a bundle              |
| `lib/`        | `services/`, `database/`, `app/`, `components/`, `hooks/`   | Infrastructure must not know about domains                  |
| `database/`   | `services/`, `app/`, `components/`, `hooks/`, `middleware/` | Data access is a leaf, not an orchestrator                  |
| `services/`   | `app/`, `components/`, `hooks/`                             | Business logic must run without a web layer                 |
| `components/` | `database/`, `app/`                                         | UI reaches the server through `api/`, never the database    |
| `hooks/`      | `database/`, `app/`, `services/storage`, `services/jobs`    | Browser code calls the API layer, not server services       |
| `app/`        | `@/database/client`                                         | Handlers use repositories or services, never raw Prisma     |

Two documented exceptions, both asserted by the test so they cannot silently
multiply:

1. `services/auth/auth-options.ts` imports the Prisma client because the
   NextAuth adapter takes the instance itself.
2. `src/middleware.ts` must live at the root of `src/` (a Next.js requirement),
   which shadows `src/middleware/index.ts` in module resolution. The pieces in
   `src/middleware/` are therefore imported by explicit path, and no barrel
   file exists there.

Modules that touch the database, object storage or child processes are marked
`import 'server-only'`, so a mistaken import from a client component fails at
build time rather than leaking server code into the browser bundle.

---

## 2. Folder structure

| Directory     | Contains                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `app/`        | Next.js App Router only: route groups, pages, layouts, error boundaries, metadata routes, HTTP handlers     |
| `components/` | React components, grouped by role: `ui`, `layout`, `marketing`, `convert`, `dashboard`, `auth`, `providers` |
| `hooks/`      | Client-side state machines (`use-conversion`, `use-limits`)                                                 |
| `api/`        | The API contract: request schemas, response envelope, DTO mappers and typed browser clients                 |
| `middleware/` | Composable request-pipeline pieces used by route handlers, plus the same-origin check used at the edge      |
| `services/`   | Business logic by domain: `conversion`, `jobs`, `storage`, `upload`, `auth`, `account`, `mail`              |
| `database/`   | Prisma client, health probe, repositories and the development seed                                          |
| `lib/`        | Cross-cutting infrastructure: env validation, logger, rate limiter, security primitives, plans, SEO, nav    |
| `types/`      | Shared type surface and module augmentation                                                                 |
| `utils/`      | Pure, dependency-free helpers                                                                               |
| `styles/`     | Global stylesheet and design tokens                                                                         |
| `content/`    | Long-form copy reused across pages and structured data                                                      |
| `public/`     | Static binary assets served as-is                                                                           |

### Why `api/` is not `app/api/`

Next.js requires route handlers to live at `app/api/**/route.ts`, so `api/`
cannot hold them. It holds the **contract** instead — schemas, DTOs, the
response envelope and the browser clients — while the files under `app/api/`
are thin adapters that translate HTTP to a service call and a service result
back to a status code. A handler is typically under 40 lines and contains no
business rules; compare `app/api/jobs/route.ts` with
`services/jobs/job-creation.service.ts`.

---

## 3. Component structure

```
components/
├── ui/           21 shadcn/ui primitives — no app knowledge, no data fetching
├── layout/       site chrome: header, footer, logo, theme toggle, user menu
├── marketing/    static content sections composed by the marketing pages
├── convert/      the conversion workspace
├── dashboard/    the authenticated app: sidebar, topbar, panels, charts
├── auth/         sign-in, sign-up, password reset, email confirmation
└── providers/    client context mounted once in the root layout
```

**Composition of the converter**, the only genuinely stateful surface:

```
Converter                       (client) owns nothing; reads the hook
├── useLimits()                 plan limits, fetched after hydration
├── useConversion()             the whole upload → convert → poll machine
├── Dropzone                    presentational; emits File[]
├── FileRow[]                   presentational; one per file, emits actions
├── OptionsPanel                renders only controls the target format honours
└── Select                      output format, intersected across the batch
```

Rules that keep this maintainable:

- **Server Components by default.** Only files that need state, effects or
  event handlers carry `'use client'` — the converter, forms, theme toggle,
  header and dashboard history.
- **Presentational components take data and emit events.** `Dropzone`,
  `FileRow` and `OptionsPanel` hold no fetch logic; everything lives in
  `useConversion`.
- **`ui/` primitives never import from the app.** They are portable and
  contain no domain vocabulary.
- **One source of truth for formats.** The picker, the landing pages and the
  server validator all read `services/conversion/registry.ts`, so an
  unsupported combination cannot be offered by any surface.

---

## 4. API structure

### Layout

```
api/
├── responses.ts              ok() / fail() / errors.*  — one envelope
├── dto/job.dto.ts            JobRow -> JobDto (hides storage keys, BigInt)
├── schemas/                  zod contracts, shared with the browser forms
│   ├── common.ts             email, password, name, fieldErrors
│   ├── auth.schema.ts        credentials, register, reset, verify
│   ├── account.schema.ts     profile, password change
│   ├── contact.schema.ts     enquiry + honeypot
│   └── job.schema.ts         create job, list query
└── client/                   typed browser callers used by hooks
    ├── uploads.client.ts     XHR (the only API with upload progress)
    ├── jobs.client.ts        create / get / list / cancel / delete
    ├── auth.client.ts        reset, verify, resend, revoke sessions
    └── limits.client.ts      plan limits
```

### Endpoints

| Method   | Route                           | Auth             | Rate limit   | Delegates to                     |
| -------- | ------------------------------- | ---------------- | ------------ | -------------------------------- |
| `POST`   | `/api/uploads`                  | guest cookie     | 20 / 10 min  | `upload.service`                 |
| `POST`   | `/api/jobs`                     | guest or session | 30 / 10 min  | `job-creation.service`           |
| `GET`    | `/api/jobs`                     | guest or session | 300 / min    | `job.service.listJobs`           |
| `GET`    | `/api/jobs/[id]`                | owner-scoped     | 300 / min    | `job.service.getOwnedJob`        |
| `POST`   | `/api/jobs/[id]/cancel`         | owner-scoped     | 30 / 10 min  | `job.service.cancelOwnedJob`     |
| `DELETE` | `/api/jobs/[id]`                | owner-scoped     | 30 / 10 min  | `job.service.deleteOwnedJob`     |
| `GET`    | `/api/jobs/[id]/download`       | signed token     | 120 / 10 min | `job.repository.findForDownload` |
| `GET`    | `/api/formats`                  | public           | 300 / min    | `conversion/registry` + probes   |
| `GET`    | `/api/limits`                   | guest or session | 300 / min    | `identity.service`               |
| `POST`   | `/api/auth/register`            | public           | 5 / hour     | `account.service.register`       |
| `*`      | `/api/auth/[...nextauth]`       | NextAuth         | —            | `auth-options`                   |
| `POST`   | `/api/auth/forgot-password`     | public           | 5 / hour ×2  | `password-reset.service`         |
| `POST`   | `/api/auth/reset-password`      | link secret      | 20 / 15 min  | `password-reset.service`         |
| `POST`   | `/api/auth/verify-email`        | link secret      | 20 / 15 min  | `email-verification.service`     |
| `POST`   | `/api/auth/resend-verification` | public           | 5 / hour ×2  | `email-verification.service`     |
| `PATCH`  | `/api/account`                  | session          | 10 / 15 min  | `account.service`                |
| `DELETE` | `/api/account`                  | session          | 10 / 15 min  | `account.service.deleteAccount`  |
| `DELETE` | `/api/account/sessions`         | session          | 10 / 15 min  | `session.service`                |
| `POST`   | `/api/contact`                  | public           | 3 / hour     | `contact.service`                |
| `GET`    | `/api/health`                   | public           | —            | `database/health`, `storage`     |
| `POST`   | `/api/cron/cleanup`             | bearer secret    | —            | `retention.service`              |
| `POST`   | `/api/cron/process`             | bearer secret    | —            | `queue.service`                  |

"×2" marks the endpoints that send mail to a caller-chosen address: they are
limited by source IP _and_ by target address, because an IP-only limit does not
protect the recipient from someone rotating addresses to flood one inbox.

### Request pipeline

Middleware is composed explicitly at each call site so the order is visible:

```ts
export const POST = withErrorHandling('POST /api/jobs', async (request) => {
  const limited = enforceRateLimit('job', request); // 429 + Retry-After
  if (limited) return limited;

  const body = await parseJsonBody(request, createJobSchema); // 422 + fields
  if (!body.success) return body.response;

  const result = await createConversionJob({ ...body.data, requester });
  if (!result.ok)
    return STATUS_FOR[result.failure.code](result.failure.message);

  return ok({ job: result.job }, { status: 202 });
});
```

Services return **discriminated failures**, not thrown errors, and the handler
owns the mapping from domain failure to HTTP status. That is what keeps status
codes correct and business logic transport-agnostic.

### Response envelope

```jsonc
// success — shape defined per endpoint
{ "job": { "id": "clx…", "status": "QUEUED", "progress": 0 } }

// failure — always this shape
{ "error": "Human-readable and safe to display.",
  "code": "unprocessable_entity",
  "fields": { "targetFormat": "Invalid target format" } }
```

---

## 5. Database schema

PostgreSQL 14+ via Prisma. Source: `prisma/schema.prisma`; migrations in
`prisma/migrations/`, applied in filename order.

### The sixteen tables

| Domain     | Tables                                                         |
| ---------- | -------------------------------------------------------------- |
| Identity   | `User`, `Account`, `Session`, `VerificationToken`, `AuthToken` |
| Conversion | `ConversionJob`, `File`, `UploadSession`, `ApiKey`             |
| Billing    | `Subscription`, `Payment`                                      |
| Dashboard  | `FavoriteRoute`, `Notification`, `HistoryEntry`                |
| Operations | `AuditLog`, `ContactMessage`                                   |

Three pairs look redundant and are not. Each split exists because the two halves
have different lifetimes, different audiences, or different truth:

- **`ConversionJob` vs `File`.** A job is a unit of work; a file is a stored
  object. They are not one-to-one — a merge has many inputs and one output —
  so the file side cannot live in job columns without parallel arrays.
- **`HistoryEntry` vs `AuditLog`.** History is written for the user and shown
  to them. The audit log is evidence for operators, carries an IP digest, and
  must survive a user clearing their own history.
- **`Subscription` vs `User.plan`.** The subscription is the truth, including
  status and period. `User.plan` is a denormalised copy read by every quota
  check on the request path, which must not join to find it.

### Money

`Payment.amountCents` is an integer in minor units, never a float or a
`Decimal` mapped through JavaScript's `number`. Binary floating point cannot
represent 0.1, and a ledger that rounds is a defect that compounds quietly.
`providerPaymentId` is unique, so a webhook delivered twice — which every
processor eventually does — records one payment rather than two.

`Payment.userId` is nullable and set to `NULL` on account deletion rather than
cascading. Everything else a user owns is erased with them; financial records
are the exception that tax and chargeback rules require be retained, so erasure
detaches the person and leaves the amounts.

```
┌───────────────────┐         ┌──────────────────┐
│ User              │1       *│ Account          │  OAuth links
│ id, email, name   ├─────────┤ provider, tokens │
│ passwordHash?     │         └──────────────────┘
│ role, plan        │
│ usage counters    │1       *┌──────────────────┐
│ createdAt         ├─────────┤ Session          │  adapter sessions
└─────────┬─────────┘         └──────────────────┘
          │1
          │                   ┌──────────────────┐
          │                  *│ ApiKey           │  hashed, prefix shown
          ├───────────────────┤ hashedKey, prefix│
          │                   └──────────────────┘
          │*
┌─────────┴──────────────────────────────────────┐
│ ConversionJob                                  │
│ userId? | guestId?   ← exactly one identifies  │
│ status, category, sourceFormat, targetFormat   │
│ options (jsonb), progress, error, attempts     │
│ inputKey/Name/Size/Mime                        │
│ outputKey/Name/Size/Mime                       │
│ lockedAt, lockedBy   ← worker lease            │
│ expiresAt            ← retention deadline      │
│ ipHash, durationMs, timestamps                 │
└────────────────────────────────────────────────┘

          │*                        │*
┌─────────┴─────────┐   ┌──────────┴──────────┐
│ FavoriteRoute     │   │ Notification        │
│ source/target fmt │   │ type, title, body   │
│ useCount,lastUsed │   │ href, readAt        │
│ unique per user   │   │ indexed by read     │
└───────────────────┘   └─────────────────────┘

┌──────────────────┐   ┌──────────────────┐   ┌─────────────────────┐
│ VerificationToken│   │ ContactMessage   │   │ AuditLog            │
│ (NextAuth adapter)│  └──────────────────┘   └─────────────────────┘
└──────────────────┘

┌────────────────────────────────────────────────┐
│ AuthToken                          * ─┐        │
│ userId, type (RESET | VERIFICATION)   │ to User│
│ tokenHash  ← HMAC only; never the token        │
│ expiresAt, consumedAt ← single use, atomically │
│ ipHash, createdAt                              │
└────────────────────────────────────────────────┘

User 1───1 Subscription 1───* Payment      (Payment.userId also → User,
          tier, status,       amountCents,  nullable: SET NULL on delete)
          period, provider    currency,
          cancelAtPeriodEnd   providerPaymentId UNIQUE

User 1───* HistoryEntry       action, summary, entityType/entityId, metadata

ConversionJob 1───* File ←─── the object store's index
                     storageKey UNIQUE, role (INPUT|OUTPUT|INTERMEDIATE),
                     position (order within a merge), status, checksum,
                     sizeBytes, expiresAt, deletedAt
```

**Dashboard models**

- **`FavoriteRoute`** pins a _route_ (png to jpg), not a file — files expire,
  routes are what a person repeats. A unique constraint on
  `(userId, source, target)` makes pinning idempotent, and `useCount` /
  `lastUsedAt` order the list by real use.
- **`Notification`** is written by the worker when a conversion settles. Writes
  are best-effort: a notification failure must never fail the conversion it
  describes, so the service swallows and logs. Rows are pruned after 90 days by
  the same retention pass that deletes files.
- **`File`** is the canonical record of every stored object, keyed by
  `storageKey`. It replaces the `extraInputKeys[]` / `extraInputNames[]` pair on
  `ConversionJob`: two arrays kept in step by convention will eventually fall
  out of step, and nothing in the database prevents it. `role` plus `position`
  expresses input ordering for merges directly.

  The migration backfills a row for every existing job input, extra input and
  output, so the table describes reality on the first deploy rather than
  starting empty. `ConversionJob` keeps its denormalised columns for now — they
  are still the live read path in 14 files — which makes this the expand half of
  an expand-and-contract migration. The contract half drops those columns once
  the services read through `File`.

- **`AuthToken`** backs password reset and email confirmation. Consumed rows are
  kept for a day rather than deleted, so a second click on a spent link reports
  "already used" instead of the more alarming "unknown link"; the retention pass
  sweeps them after that. `User.sessionsValidFrom` is the companion field —
  see [session revocation](#session-revocation).

**Design decisions**

- **`userId` or `guestId`, never both.** Anonymous conversions are first-class:
  a guest owns their jobs through an opaque http-only cookie, and every query
  is scoped by `ownerFilter()` in the repository.
- **`expiresAt` on the row, not inferred.** Retention is data, so the cleanup
  job is a single indexed range scan and the promise in the privacy policy is
  verifiable in SQL.
- **`lockedAt`/`lockedBy` implement a lease.** A worker that dies mid-job leaves
  a stale lease; `reclaimStaleJobs()` returns it to the queue after 20 minutes.
- **`BigInt` for file sizes.** A 10 GB Business-tier upload overflows `Int`.
  DTO mapping converts to `Number` at the boundary.
- **Salted `ipHash`, never the address.** Enough for abuse control, not
  personal data at rest.
- **Cascades from `User`.** Deleting an account removes accounts, sessions,
  API keys and jobs in one statement; object storage is cleared first.

**Indexes** — `ConversionJob` on `(userId, createdAt)`, `(guestId, createdAt)`,
`(status, createdAt)` and `(expiresAt)`. Those cover the four real access
patterns: a user's history, a guest's history, the queue claim, and retention.

---

## 6. Authentication flow

NextAuth v4 with a **JWT session strategy** (credentials sign-in cannot create
database sessions) and the Prisma adapter for OAuth accounts.

### Credential sign-in

```
Browser                    /api/auth/*              services / database
   │  email + password         │                            │
   ├──────────────────────────►│  authorize()               │
   │                           ├───────────────────────────►│ users.findByEmail
   │                           │                            │
   │                           │  verifyPassword() compares against a dummy
   │                           │  hash when the account is absent, so the
   │                           │  response time is identical either way
   │                           │◄───────────────────────────┤
   │  Set-Cookie: __Secure-…   │  jwt() → { id, role, plan }│
   │◄──────────────────────────┤                            │
```

### Registration

`POST /api/auth/register` → `account.service.register()`. When the address is
already taken, the service performs an equivalent bcrypt hash and returns the
same body, so the endpoint cannot enumerate accounts. A duplicate is
distinguishable only by attempting to sign in. Registration also dispatches a
confirmation link; delivery failure never rolls back the account.

### Emailed link secrets

Password reset and email confirmation share one mechanism, in
`services/auth/token.service.ts`:

```
issueToken()   32 random bytes ──► base64url token  (goes in the email only)
                                └─► HMAC-SHA256     (the AuthToken row)

consumeToken() token ──► digest ──► indexed lookup
                                 ├── wrong purpose / unknown → "invalid"
                                 ├── past expiresAt          → "expired"
                                 ├── consumedAt set          → "used"
                                 └── UPDATE … WHERE consumedAt IS NULL
                                     └── 0 rows → lost the race → "used"
```

Properties this buys: a database disclosure yields no working links (only
digests, and the HMAC key lives in the app); a link works exactly once, even
under concurrent redemption; a link is only accepted for the purpose it was
issued for; issuing a new link retires the outstanding one. Reset links live an
hour, confirmation links a day.

Both request endpoints answer identically for every address — registered or
not, over the per-user ceiling or not — so neither can be used to enumerate
accounts. Confirmation is a `POST` behind a button rather than a `GET`, because
mail scanners follow links before people do and would otherwise spend the
token.

### Session revocation

JWT sessions are fast but not withdrawable on their own. `User.sessionsValidFrom`
is a watermark, and each token records `authenticatedAt` — a stable claim,
unlike `iat`, which NextAuth rewrites on every re-encode:

```
jwt()  ── at most once per SESSION_REVALIDATE_MS (60s) ──►  resolveSessionState()
           │                                                 │
           │  authenticatedAt <= sessionsValidFrom  ──────────┤ revoked
           │  user row missing (account deleted)    ──────────┤ revoked
           │  otherwise → refresh role, plan, name, verified  │
session() ── token.revoked → a session with no `user` ────────► every guard fails
```

The watermark moves on a password change, a completed reset, and
`DELETE /api/account/sessions`. Cost is one indexed read per session per minute;
the trade is that revocation takes up to a minute to reach other devices, which
the UI states rather than hides.

### Guest identity

Visitors who never sign in still need to own their conversions:

```
resolveRequester()
  ├── session present  → { userId, plan, ownerKey: "u:<id>", limits: plan }
  └── no session       → read or mint `hx_guest` (http-only, 30 days)
                       → { guestId, ownerKey: "g:<id>", limits: GUEST_LIMITS }
```

`ownerKey` is what upload tickets are bound to, so a ticket issued to one
visitor cannot be redeemed by another.

### Authorisation surfaces

| Surface                | Mechanism                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `/dashboard/*`         | Edge middleware checks the JWT, redirects with `callbackUrl` |
| Account endpoints      | `requireSession()` returns the session or a ready 401        |
| Job endpoints          | Repository-level owner scoping — a foreign id reads as 404   |
| Downloads              | HMAC token bound to one job id, minutes-long expiry          |
| Cron endpoints         | Bearer secret compared in constant time                      |
| All mutating API calls | Same-origin check at the edge                                |

Role and plan are copied into the JWT so middleware needs no database round
trip; `trigger === 'update'` refreshes them without a full re-login, and the
same path re-checks revocation.

Endpoints that act on the ambient session cookie live under `/api/account` so
the edge same-origin check applies to them. `/api/auth/*` is exempt from that
check because everything there proves its own authority — NextAuth's CSRF token
or a single-use link secret — and so has nothing for a cross-site request to
borrow.

---

## 7. Conversion engine architecture

### Registry-driven design

`services/conversion/registry.ts` declares 38 formats and derives **214 routes**.
Everything else reads from it:

```
registry.ts ──► picker UI (targets for an uploaded file)
            ──► 214 prerendered /tools/[slug] landing pages
            ──► GET /api/formats (public capability document)
            ──► server-side validation at job creation
            ──► option schema selection per route
```

A conversion that is not in the registry cannot be requested through any
surface — the UI will not offer it, and the validator rejects it.

### Engine contract

Every engine implements one interface, so adding a format is additive:

```ts
interface ConversionEngine {
  readonly id:
    | 'image'
    | 'media'
    | 'document'
    | 'spreadsheet'
    | 'office'
    | 'pdf-render'
    | 'archive';
  run(context: ConversionContext): Promise<ConversionOutcome>;
}

interface ConversionContext {
  inputPath: string; // a real file — native tools cannot read streams
  outputPath: string;
  sourceFormat: string;
  targetFormat: string;
  options: ConversionOptions; // already validated for this route
  onProgress: (percent: number) => void;
  signal: AbortSignal; // cancellation reaches the encoder
}
```

| Engine        | Backed by       | In-process | External binary |
| ------------- | --------------- | :--------: | :-------------: |
| `image`       | sharp / libvips |     ✓      |        —        |
| `media`       | ffmpeg          |     —      | bundled static  |
| `document`    | pdf-lib, marked |     ✓      |        —        |
| `spreadsheet` | ExcelJS         |     ✓      |        —        |
| `office`      | LibreOffice     |     —      |  runtime image  |
| `pdf-render`  | Poppler         |     —      |  runtime image  |
| `archive`     | archiver, tar   |     ✓      |        —        |

### Capability probing

External tooling is probed once per process and cached. A route whose binary is
missing is reported unavailable by `/api/formats` and rejected at job creation
with a clear message — never accepted and then failed halfway through.

```ts
routeAvailability('docx', 'pdf');
// → { available: false, reason: 'Office document conversion is temporarily unavailable.' }
```

### Orchestration

`conversion.service.runConversion()` is the only entry point:

```
1. resolve route → engine            (unknown route → ConversionError)
2. check requirement availability    (missing tool → retryable error)
3. mkdtemp() a private workspace
4. stream the source from storage to a local file
5. engine.run(context)               progress + abort flow through
6. assert non-empty output
7. stream the result back to storage, return key/name/size/mime
8. finally: rm -rf the workspace     — always, including on failure
```

### Queue and worker

```
POST /api/jobs ──► ConversionJob(QUEUED) ──► ensureWorker()
                          │
        ┌─────────────────┴──────────────────┐
        │  UPDATE … SET status='PROCESSING'  │
        │  WHERE id = (SELECT id … QUEUED    │
        │    ORDER BY createdAt              │
        │    FOR UPDATE SKIP LOCKED LIMIT 1) │  ← atomic claim, no broker
        └─────────────────┬──────────────────┘
                          ▼
              processJob() → runConversion()
                          │
     progress write every ~1.2s doubles as:
       • the cancellation check (status === CANCELLED → abort())
       • the lease renewal (lockedAt = now())
                          ▼
        COMPLETED ──► delete the source object
        FAILED    ──► retry up to 3 attempts if retryable
        CANCELLED ──► discard partial output
```

Two drive modes over the same code:

- **Long-running instances** — `WORKER_ENABLED=true` starts `WORKER_CONCURRENCY`
  loops lazily on first use.
- **Serverless** — `WORKER_ENABLED=false` and a scheduled `POST /api/cron/process`
  drains a batch per invocation.

---

## 8. Storage architecture

### Driver abstraction

```ts
interface StorageDriver {
  readonly name: 'local' | 's3';
  put(key, body: Buffer | Readable, options): Promise<void>;
  putFromFile(key, filePath, options): Promise<number>;
  getStream(key): Promise<Readable>;
  getBuffer(key): Promise<Buffer>;
  toTempFile(key, extension): Promise<string>;
  delete(key) / deleteMany(keys): Promise<void>;
  exists(key): Promise<boolean>;
  size(key): Promise<number | null>;
  signedDownloadUrl(key, filename, ttl): Promise<string | null>;
}
```

One env var switches implementation; no conversion code changes.

| Driver  | Used for                 | Behaviour                                                                                                              |
| ------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `local` | development, single node | Writes under `STORAGE_LOCAL_DIR`; every key is re-resolved and checked against the root so a crafted key cannot escape |
| `s3`    | production               | Any S3-compatible service; multipart upload for large bodies; pre-signed GET so files never transit the app server     |

A production build refuses `local` unless `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true`
is set explicitly, because local files are not durable across replicas.

### Key layout

```
inputs/<yyyy>/<mm>/<dd>/<uuid>.<ext>     source, deleted when the job finishes
outputs/<yyyy>/<mm>/<dd>/<uuid>.<ext>    result, deleted at expiry
```

Date-prefixed so lifecycle rules and cost reports can target a prefix;
UUID-named so two uploads of the same filename never collide and no user-
supplied string reaches a storage key.

### Data flow

```
Upload    request body (stream) → sniff first 512 B → object storage
                                   ▲
                                   └ nothing is written before validation passes

Convert   storage → temp file → engine → temp file → storage
                                                        │
Download  S3:    302 to a pre-signed URL ───────────────┘
          local: streamed through the route with Content-Disposition
```

Peak memory is one chunk regardless of file size: the upload never buffers, the
S3 driver uses the multipart uploader, and downloads stream.

### Lifecycle

| Object          | Removed when                                                   |
| --------------- | -------------------------------------------------------------- |
| Source file     | The conversion finishes, fails terminally or is cancelled      |
| Output file     | `expiresAt` passes and the cleanup cron runs (2–168 h by plan) |
| Rejected upload | Immediately — the key is deleted if the write errors           |
| Whole account   | On deletion: objects first, then rows                          |

A bucket lifecycle rule matching the longest retention window is recommended as
a backstop, not a substitute.

---

## 9. Security architecture

### Trust boundaries

```
                  ▼ untrusted
┌──────────────────────────────────────────────────────────────┐
│ Browser: filename, bytes, MIME, options, cookies             │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS + HSTS, CSP, same-origin check
┌──────────────────────────────▼───────────────────────────────┐
│ Route handler: schema validation, rate limit, session        │
└──────────────────────────────┬───────────────────────────────┘
                               │ signed ticket — the only trusted description
┌──────────────────────────────▼───────────────────────────────┐
│ Service: quota, ownership, route availability                │
└──────────────────────────────┬───────────────────────────────┘
                               │ argument arrays, never a shell string
┌──────────────────────────────▼───────────────────────────────┐
│ Engine: unprivileged process, private tempdir, timeout       │
└──────────────────────────────────────────────────────────────┘
```

### Controls by threat

| Threat                           | Control                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Malicious file disguised by name | Magic-byte sniffing of the leading 512 bytes, checked against the declared extension, **before** any byte is forwarded to storage |
| Command injection                | Every binary is spawned with an argument array (`shell: false`); no user string is ever concatenated into a command               |
| Option tampering                 | Strict Zod schemas per engine: unknown keys rejected, every numeric bound clamped                                                 |
| Zip Slip / zip bomb              | Absolute paths, `..` segments and symlinks rejected; entry count, inflated size and compression ratio capped                      |
| Decompression bomb (images)      | 215 MP pixel ceiling before allocation; SVG rasterisation capped                                                                  |
| Runaway job                      | Wall-clock timeout per process, `SIGKILL` on expiry, worker lease reclaim                                                         |
| IDOR on jobs                     | Ownership applied in the repository; a foreign id is indistinguishable from a missing one                                         |
| Stolen or guessed download link  | HMAC bound to a single job id, minutes-long expiry, re-signed on every read                                                       |
| Ticket replay by another user    | Upload tickets are HMAC-signed over key, size, MIME, format **and owner**                                                         |
| CSRF                             | Same-origin enforcement on all mutating API routes; `SameSite=Lax`, http-only, `__Secure-` cookies                                |
| XSS                              | React escaping, restrictive CSP, `sanitize-html` on any generated markup, inert URL schemes only                                  |
| Account enumeration              | Identical registration responses; dummy-hash comparison equalises sign-in timing                                                  |
| Credential stuffing              | bcrypt cost 12, rate limits on auth routes                                                                                        |
| Privacy leakage                  | EXIF/GPS stripped by default; IPs stored only as salted hashes; scheduled deletion                                                |
| Server code in the browser       | `server-only` markers on database, storage and process-spawning modules                                                           |

### Secrets

Three independent secrets, validated at startup by `lib/env.ts`, which fails
fast with a specific message rather than misbehaving later:

| Secret                | Protects                                   | Rotation effect                                                         |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `NEXTAUTH_SECRET`     | Session JWTs                               | Signs everyone out                                                      |
| `DOWNLOAD_URL_SECRET` | Download tokens, upload tickets, IP hashes | Invalidates outstanding links — the desired behaviour after an incident |
| `CRON_SECRET`         | Scheduled job endpoints                    | Update the scheduler                                                    |

### Response headers

Set in `next.config.mjs` for every route: `Content-Security-Policy` with
`frame-ancestors 'none'` and `object-src 'none'`, `Strict-Transport-Security`
(2 years, preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, and `X-Robots-Tag: noindex` plus `no-store` on `/api/*`.

---

## 9a. Dashboard

```
app/(app)/dashboard/
├── layout.tsx          session guard + shell (sidebar, topbar, skip link)
├── page.tsx            overview: profile, KPIs, trend, quick convert, panels
├── conversions/        full history with status filters
├── favorites/          pinned routes + suggestions from history
├── statistics/         90-day trend, category breakdown, data processed
├── storage/            what is stored now, what expires within 24 h
├── subscription/       plan, limits, usage meter
└── settings/           profile, password, account deletion
```

**Chrome is chosen per route group.** `(site)` wraps the public pages in the
marketing header and footer; `(app)` wraps the dashboard in its own shell. The
root layout holds only the document, providers and site-wide JSON-LD — so the
dashboard is never wrapped in marketing chrome, and each shell ships its own
skip link.

**Charts are inline SVG, not a library.** The shapes are simple and this keeps a
~40 kB dependency out of the bundle. Their colour follows the data-viz method:

- _Conversions over time_ — single-series area. The job is trend, so one hue and
  no legend; the caption names the series. Failures appear as a dashed line only
  when failures exist.
- _By category_ — ranked horizontal bars on a **single-hue ordinal ramp** (the
  job is magnitude, not identity). Every bar is directly labelled with its count
  and percentage, so colour never carries the value alone.
- _Quota and storage_ — meters, the right form for one ratio against a limit.
  Tone escalates at 75% and 90%, and the wording escalates with it so colour is
  never the only signal.

The ramp was checked with the palette validator in both modes — monotone
lightness, adjacent lightness gaps ≥ 0.06, single hue, and the step nearest the
surface clearing 2:1 contrast:

| Mode  | Ramp (low → high magnitude)   | Surface   | Nearest-step contrast |
| ----- | ----------------------------- | --------- | --------------------- |
| Light | `#818cf8 → #2a2382` (darker)  | `#ffffff` | 2.98:1                |
| Dark  | `#4f46e5 → #c7d2fe` (lighter) | `#15151a` | 2.89:1                |

`tests/unit/charts.test.tsx` renders each chart to static markup and asserts the
output contains no `NaN` for the geometry edge cases — a single point, an empty
series, all zeros — because an SVG path with `NaN` renders as nothing at all,
with no error to notice.

---

## 10. Scaling model

| Axis                | Approach                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Read traffic        | 237 pages prerendered at build; marketing and all 214 tool pages are static and CDN-cacheable  |
| Conversion capacity | Horizontal: any number of instances share one queue via `FOR UPDATE SKIP LOCKED`               |
| Mixed workloads     | `WORKER_ENABLED=false` on web-facing instances, `true` on a worker pool — same image           |
| Database            | Four indexes cover every access pattern; the queue claim touches one row                       |
| Storage             | Stateless app; S3 scales independently, downloads bypass the server via pre-signed URLs        |
| Memory              | Streaming upload/download and per-job temp directories keep usage flat regardless of file size |

**Known limits, stated plainly.** Rate-limit counters are per instance, so
behind N replicas the effective limit is N× the configured value — `consume()`
in `lib/rate-limit.ts` is the single call site to swap for Redis. Billing is
defined and enforced in `lib/plans.ts` but no payment provider is wired in.

---

## 11. Full project tree

```
hexaconverter/
├── .github/workflows/ci.yml           lint · typecheck · test · build · e2e · docker
├── .vscode/                           workspace settings and extension hints
├── docs/
│   └── ARCHITECTURE.md                this document
├── prisma/
│   ├── migrations/
│   │   ├── 20260701000000_init/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── public/
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── api/                           ── API contract layer
│   │   ├── client/
│   │   │   ├── jobs.client.ts
│   │   │   ├── limits.client.ts
│   │   │   └── uploads.client.ts
│   │   ├── dto/
│   │   │   └── job.dto.ts
│   │   ├── schemas/
│   │   │   ├── account.schema.ts
│   │   │   ├── auth.schema.ts
│   │   │   ├── common.ts
│   │   │   ├── contact.schema.ts
│   │   │   ├── index.ts
│   │   │   └── job.schema.ts
│   │   └── responses.ts
│   │
│   ├── app/                           ── routing and HTTP adapters
│   │   ├── (app)/dashboard/
│   │   │   ├── page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx
│   │   │   └── sign-up/page.tsx
│   │   ├── (marketing)/
│   │   │   ├── about/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── features/page.tsx
│   │   │   └── pricing/page.tsx
│   │   ├── (tools)/
│   │   │   ├── convert/[category]/page.tsx     5 category converters
│   │   │   └── tools/[slug]/page.tsx           214 prerendered routes
│   │   ├── api/
│   │   │   ├── account/route.ts
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/route.ts
│   │   │   │   └── register/route.ts
│   │   │   ├── contact/route.ts
│   │   │   ├── cron/
│   │   │   │   ├── cleanup/route.ts
│   │   │   │   └── process/route.ts
│   │   │   ├── formats/route.ts
│   │   │   ├── health/route.ts
│   │   │   ├── jobs/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── cancel/route.ts
│   │   │   │   │   ├── download/route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── limits/route.ts
│   │   │   └── uploads/route.ts
│   │   ├── legal/
│   │   │   ├── cookies/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── terms/page.tsx
│   │   ├── apple-icon.tsx
│   │   ├── error.tsx
│   │   ├── global-error.tsx
│   │   ├── icon.svg
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── manifest.ts
│   │   ├── not-found.tsx
│   │   ├── opengraph-image.tsx
│   │   ├── page.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   │
│   ├── components/                    ── presentation
│   │   ├── auth/
│   │   │   ├── oauth-buttons.tsx
│   │   │   ├── sign-in-form.tsx
│   │   │   └── sign-up-form.tsx
│   │   ├── convert/
│   │   │   ├── converter.tsx
│   │   │   ├── dropzone.tsx
│   │   │   ├── file-row.tsx
│   │   │   └── options-panel.tsx
│   │   ├── dashboard/
│   │   │   ├── account-settings.tsx
│   │   │   └── job-history.tsx
│   │   ├── layout/
│   │   │   ├── legal-page.tsx
│   │   │   ├── logo.tsx
│   │   │   ├── site-footer.tsx
│   │   │   ├── site-header.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   └── user-menu.tsx
│   │   ├── marketing/
│   │   │   ├── category-grid.tsx
│   │   │   ├── contact-form.tsx
│   │   │   ├── cta.tsx
│   │   │   ├── faq-section.tsx
│   │   │   ├── feature-list.tsx
│   │   │   ├── hero.tsx
│   │   │   ├── how-it-works.tsx
│   │   │   └── popular-tools.tsx
│   │   ├── providers/
│   │   │   ├── auth-provider.tsx
│   │   │   ├── index.tsx
│   │   │   └── theme-provider.tsx
│   │   └── ui/                        21 shadcn/ui primitives
│   │       ├── accordion.tsx   ├── alert.tsx      ├── avatar.tsx
│   │       ├── badge.tsx       ├── button.tsx     ├── card.tsx
│   │       ├── checkbox.tsx    ├── dialog.tsx     ├── dropdown-menu.tsx
│   │       ├── input.tsx       ├── label.tsx      ├── progress.tsx
│   │       ├── scroll-area.tsx ├── select.tsx     ├── separator.tsx
│   │       ├── skeleton.tsx    ├── slider.tsx     ├── sonner.tsx
│   │       ├── switch.tsx      ├── tabs.tsx       └── tooltip.tsx
│   │
│   ├── content/
│   │   └── faq.ts                     copy reused by pages and JSON-LD
│   │
│   ├── database/                      ── data access
│   │   ├── client.ts                  Prisma singleton (server-only)
│   │   ├── health.ts                  connectivity probe
│   │   ├── repositories/
│   │   │   ├── audit.repository.ts
│   │   │   ├── contact.repository.ts
│   │   │   ├── job-queue.repository.ts    atomic claim, leases, retention
│   │   │   ├── job.repository.ts          owner-scoped reads and writes
│   │   │   └── user.repository.ts
│   │   └── seed.ts
│   │
│   ├── hooks/                         ── browser state
│   │   ├── use-conversion.ts          upload → convert → poll machine
│   │   └── use-limits.ts
│   │
│   ├── lib/                           ── cross-cutting infrastructure
│   │   ├── env.ts                     zod-validated environment
│   │   ├── logger.ts                  structured JSON logs with redaction
│   │   ├── nav.ts
│   │   ├── plans.ts                   plan limits — enforced and displayed
│   │   ├── rate-limit.ts
│   │   ├── security/index.ts          hashing, HMAC tokens, tickets, filenames
│   │   └── seo.ts                     metadata builders and JSON-LD
│   │
│   ├── middleware/                    ── request pipeline
│   │   ├── require-session.ts
│   │   ├── same-origin.ts
│   │   ├── with-error-handling.ts
│   │   ├── with-rate-limit.ts
│   │   └── with-validation.ts
│   │
│   ├── services/                      ── business logic
│   │   ├── account/account.service.ts
│   │   ├── auth/
│   │   │   ├── auth-options.ts
│   │   │   └── identity.service.ts    requester, quota, concurrency, retention
│   │   ├── conversion/
│   │   │   ├── binaries.ts            probing and safe process spawning
│   │   │   ├── conversion.service.ts  orchestrator
│   │   │   ├── engines/
│   │   │   │   ├── archive.engine.ts
│   │   │   │   ├── document.engine.ts
│   │   │   │   ├── image.engine.ts
│   │   │   │   ├── media.engine.ts
│   │   │   │   ├── office.engine.ts
│   │   │   │   ├── pdf-render.engine.ts
│   │   │   │   └── spreadsheet.engine.ts
│   │   │   ├── options.ts             per-engine option schemas
│   │   │   └── registry.ts            38 formats · 214 routes
│   │   ├── jobs/
│   │   │   ├── job-creation.service.ts    all preconditions, in order
│   │   │   ├── job.service.ts             read, cancel, delete
│   │   │   ├── queue.service.ts           claim, execute, retry, reclaim
│   │   │   ├── retention.service.ts       scheduled deletion
│   │   │   └── worker.ts                  in-process loop
│   │   ├── mail/
│   │   │   ├── contact.service.ts
│   │   │   └── mail.service.ts
│   │   ├── storage/
│   │   │   ├── index.ts               driver selection and key building
│   │   │   ├── local.driver.ts
│   │   │   └── s3.driver.ts
│   │   └── upload/
│   │       ├── file-signatures.ts     magic-byte container sniffing
│   │       └── upload.service.ts      streaming ingestion + validation
│   │
│   ├── styles/
│   │   └── globals.css                design tokens, both themes
│   │
│   ├── types/
│   │   ├── api.ts
│   │   ├── conversion.ts
│   │   ├── index.ts
│   │   ├── next-auth.d.ts
│   │   └── storage.ts
│   │
│   ├── utils/                         ── pure helpers
│   │   ├── cn.ts
│   │   ├── file.ts
│   │   ├── format.ts
│   │   ├── index.ts
│   │   ├── number.ts
│   │   └── string.ts
│   │
│   └── middleware.ts                  Next.js edge entry (must live here)
│
├── tests/
│   ├── e2e/smoke.spec.ts
│   └── unit/
│       ├── helpers/source-files.ts
│       ├── architecture.test.ts       enforces every rule in section 1
│       ├── file-signatures.test.ts
│       ├── formats.test.ts
│       ├── rate-limit.test.ts
│       ├── security.test.ts
│       ├── utils.test.ts
│       └── validation.test.ts
│
├── .env.example                       every variable, documented
├── Dockerfile                         multi-stage; bundles LibreOffice + Poppler
├── docker-compose.yml                 app + PostgreSQL + MinIO
├── LICENSE
├── README.md
├── SECURITY.md
├── components.json                    shadcn/ui configuration
├── next.config.mjs                    security headers, CSP, standalone output
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## Adding a new format — the maintainability test

A good architecture is measured by how little a routine change touches. Adding
WebP-to-BMP support:

1. Add the format to `services/conversion/registry.ts` (one `spec()` call).
2. Add it to the relevant route-building loop in the same file.
3. Handle the new case in the owning engine's `switch`.

Nothing else changes. The picker offers it, a landing page is prerendered for
it, `/api/formats` advertises it, the validator accepts it, and the format
invariant tests check it — all from the registry entry.
