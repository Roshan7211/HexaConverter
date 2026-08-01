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
│  database/       repositories, Prisma client, health probe   │
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

One documented exception, asserted by the test so it cannot silently multiply:

1. `src/middleware.ts` must live at the root of `src/` (a Next.js requirement),
   which shadows `src/middleware/index.ts` in module resolution. The pieces in
   `src/middleware/` are therefore imported by explicit path, and no barrel
   file exists there.

Modules that touch the database, object storage or child processes are marked
`import 'server-only'`, so a mistaken import from a client component fails at
build time rather than leaking server code into the browser bundle.

---

## 2. Folder structure

| Directory     | Contains                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `app/`        | Next.js App Router only: route groups, pages, layouts, error boundaries, metadata routes, HTTP handlers          |
| `components/` | React components, grouped by role: `ui`, `layout`, `marketing`, `convert`, `documents`, `archives`, `providers`  |
| `hooks/`      | Client-side state machines (`use-conversion`, `use-limits`)                                                      |
| `api/`        | The API contract: request schemas, response envelope, DTO mappers and typed browser clients                      |
| `middleware/` | Composable request-pipeline pieces used by route handlers, plus the same-origin check used at the edge           |
| `services/`   | Business logic by domain: `conversion`, `jobs`, `storage`, `upload`, `identity`, `documents`, `archives`, `mail` |
| `database/`   | Prisma client, health probe and the repositories                                                                 |
| `lib/`        | Cross-cutting infrastructure: env validation, logger, rate limiter, security primitives, plans, SEO, nav         |
| `types/`      | Shared type surface and module augmentation                                                                      |
| `utils/`      | Pure, dependency-free helpers                                                                                    |
| `styles/`     | Global stylesheet and design tokens                                                                              |
| `content/`    | Long-form copy reused across pages and structured data                                                           |
| `public/`     | Static binary assets served as-is                                                                                |

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
├── ui/           17 shadcn/ui primitives — no app knowledge, no data fetching
├── layout/       site chrome: header, footer, logo, theme toggle
├── marketing/    static content sections composed by the marketing pages
├── convert/      the conversion workspace
├── documents/    the PDF toolkit workspace
├── archives/     the archive toolkit workspace
└── providers/    client context mounted once in the root layout
```

**Composition of the converter**, the only genuinely stateful surface:

```
Converter                       (client) owns nothing; reads the hook
├── useLimits()                 service limits, confirmed after hydration
├── useConversion()             the whole upload → convert → poll machine
├── Dropzone                    presentational; emits File[]
├── FileRow[]                   presentational; one per file, emits actions
├── OptionsPanel                renders only controls the target format honours
└── Select                      output format, intersected across the batch
```

Rules that keep this maintainable:

- **Server Components by default.** Only files that need state, effects or
  event handlers carry `'use client'` — the converter, the toolkits, the
  contact form, the theme toggle and the header.
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
│   ├── common.ts             email, name, fieldErrors
│   ├── contact.schema.ts     enquiry + honeypot
│   ├── archives.schema.ts    archive toolkit operations
│   ├── documents.schema.ts   PDF toolkit operations
│   ├── upload.schema.ts      chunked upload sessions
│   └── job.schema.ts         create job, list query
└── client/                   typed browser callers used by hooks
    ├── uploads.client.ts     XHR (the only API with upload progress)
    ├── jobs.client.ts        create / get / list / cancel / delete
    ├── archives.client.ts    archive tasks, purge stored files
    ├── documents.client.ts   PDF toolkit tasks
    └── limits.client.ts      service limits
```

### Endpoints

| Method   | Route                                 | Auth          | Rate limit   | Delegates to                     |
| -------- | ------------------------------------- | ------------- | ------------ | -------------------------------- |
| `POST`   | `/api/uploads`                        | guest cookie  | 20 / 10 min  | `upload.service`                 |
| `POST`   | `/api/uploads/sessions`               | guest cookie  | 20 / 10 min  | `upload/session.service`         |
| `PUT`    | `/api/uploads/sessions/[id]`          | owner-scoped  | 20 / 10 min  | `upload/session.service`         |
| `POST`   | `/api/uploads/sessions/[id]/complete` | owner-scoped  | 20 / 10 min  | `upload/session.service`         |
| `POST`   | `/api/jobs`                           | guest cookie  | 30 / 10 min  | `job-creation.service`           |
| `GET`    | `/api/jobs`                           | guest cookie  | 300 / min    | `job.service.listJobs`           |
| `GET`    | `/api/jobs/[id]`                      | owner-scoped  | 300 / min    | `job.service.getOwnedJob`        |
| `POST`   | `/api/jobs/[id]/cancel`               | owner-scoped  | 30 / 10 min  | `job.service.cancelOwnedJob`     |
| `DELETE` | `/api/jobs/[id]`                      | owner-scoped  | 30 / 10 min  | `job.service.deleteOwnedJob`     |
| `GET`    | `/api/jobs/[id]/download`             | signed token  | 120 / 10 min | `job.repository.findForDownload` |
| `POST`   | `/api/tools/pdf`                      | guest cookie  | 30 / 10 min  | `document-task.service`          |
| `POST`   | `/api/tools/archive`                  | guest cookie  | 30 / 10 min  | `archive-task.service`           |
| `DELETE` | `/api/storage`                        | owner-scoped  | 30 / 10 min  | `job.service.purgeOwnedFiles`    |
| `GET`    | `/api/formats`                        | public        | 300 / min    | `conversion/registry` + probes   |
| `GET`    | `/api/limits`                         | guest cookie  | 300 / min    | `identity.service`               |
| `POST`   | `/api/contact`                        | public        | 3 / hour     | `contact.service`                |
| `GET`    | `/api/health`                         | public        | —            | `database/health`, `storage`     |
| `POST`   | `/api/cron/cleanup`                   | bearer secret | —            | `retention.service`              |
| `POST`   | `/api/cron/process`                   | bearer secret | —            | `queue.service`                  |

"Guest cookie" is not authentication: it identifies a browser so that one
visitor's files are not readable by another, and nothing more. "Owner-scoped"
means the repository applies that filter itself, so a foreign id reads as a
404 rather than leaking existence.

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

### The three tables

| Domain     | Tables                           |
| ---------- | -------------------------------- |
| Conversion | `ConversionJob`, `UploadSession` |
| Operations | `ContactMessage`                 |

The service has no accounts, so it has no identity, billing or dashboard
tables. What is stored is only what a conversion in flight needs in order to
exist across requests: the browser posts an upload, the worker picks the job up
in another process, and the browser polls for the result. None of it describes
a person, and all of it is swept by the retention pass.

```
┌────────────────────────────────────────────────┐
│ ConversionJob                                  │
│ guestId              ← opaque per-browser id   │
│ status, category, sourceFormat, targetFormat   │
│ options (jsonb), progress, error, attempts     │
│ inputKey/Name/Size/Mime                        │
│ extraInputKeys[], extraInputNames[]            │
│ outputKey/Name/Size/Mime, outputDetail         │
│ operation?, archiveOperation?  ← toolkit jobs  │
│ lockedAt, lockedBy   ← worker lease            │
│ expiresAt            ← retention deadline      │
│ ipHash, durationMs, timestamps                 │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ UploadSession        ← resumable chunked upload│
│ guestId, filename, sourceFormat, mime          │
│ declaredSize, receivedSize                     │
│ chunkSize, totalChunks, receivedChunks[]       │
│ storagePrefix, completed, expiresAt            │
└────────────────────────────────────────────────┘

┌──────────────────┐
│ ContactMessage   │  name, email, subject, message, status, ipHash
└──────────────────┘
```

**Design decisions**

- **`guestId` is the only owner.** A visitor owns their jobs through an opaque
  http-only cookie, and every query is scoped by `ownerFilter()` in the
  repository rather than in handlers, so a new endpoint cannot forget it.
- **`expiresAt` on the row, not inferred.** Retention is data, so the cleanup
  job is a single indexed range scan and the promise in the privacy policy is
  verifiable in SQL.
- **`lockedAt`/`lockedBy` implement a lease.** A worker that dies mid-job leaves
  a stale lease; `reclaimStaleJobs()` returns it to the queue after 20 minutes.
- **`BigInt` for file sizes.** A 10 GB upload overflows `Int`. DTO mapping
  converts to `Number` at the boundary.
- **Salted `ipHash`, never the address.** Enough for abuse control, not
  personal data at rest.
- **Rows are deleted, not archived.** Nothing is kept for a user to look back
  at, so a job record has no reason to outlive the file it described; the sweep
  removes it after 30 days.

**Indexes** — `ConversionJob` on `(guestId, createdAt)`, `(status, createdAt)`
and `(expiresAt)`. Those cover the three real access patterns: a browser's own
conversions, the queue claim, and retention.

---

## 6. Requester identity

There is no authentication. The service is free, has no accounts and asks for
nothing about the person using it, so there is no sign-in flow, no session, no
password and no OAuth provider.

### Guest identity

A visitor still needs to own their own conversions, so that one browser cannot
read another's files:

```
resolveRequester()
  └── read or mint `hx_guest` (opaque, http-only, 30 days)
      → { guestId, ownerKey: "g:<id>", limits: LIMITS }
```

The cookie holds a random identifier. It names no person, is joined to nothing,
and expires on its own. `ownerKey` is what upload tickets are bound to, so a
ticket issued to one visitor cannot be redeemed by another.

### Authorisation surfaces

| Surface                | Mechanism                                                  |
| ---------------------- | ---------------------------------------------------------- |
| Job endpoints          | Repository-level owner scoping — a foreign id reads as 404 |
| Downloads              | HMAC token bound to one job id, minutes-long expiry        |
| Cron endpoints         | Bearer secret compared in constant time                    |
| All mutating API calls | Same-origin check at the edge                              |

Ownership is enforced in the repository layer rather than in handlers, so a new
endpoint cannot forget it: every query that touches `ConversionJob` or
`UploadSession` goes through a module that applies the guest filter itself.

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
| Whole browser   | `DELETE /api/storage`: objects first, then rows                |

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
│ Route handler: schema validation, rate limit, owner scoping  │
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
| Privacy leakage                  | EXIF/GPS stripped by default; IPs stored only as salted hashes; scheduled deletion                                                |
| Server code in the browser       | `server-only` markers on database, storage and process-spawning modules                                                           |

### Secrets

Two independent secrets, validated at startup by `lib/env.ts`, which fails
fast with a specific message rather than misbehaving later:

| Secret                | Protects                                   | Rotation effect                                                         |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `DOWNLOAD_URL_SECRET` | Download tokens, upload tickets, IP hashes | Invalidates outstanding links — the desired behaviour after an incident |
| `CRON_SECRET`         | Scheduled job endpoints                    | Update the scheduler                                                    |

### Response headers

Set in `next.config.mjs` for every route: `Content-Security-Policy` with
`frame-ancestors 'none'` and `object-src 'none'`, `Strict-Transport-Security`
(2 years, preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, and `X-Robots-Tag: noindex` plus `no-store` on `/api/*`.

---

## 10. Scaling model

| Axis                | Approach                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Read traffic        | 237 pages prerendered at build; marketing and all 214 tool pages are static and CDN-cacheable  |
| Conversion capacity | Horizontal: any number of instances share one queue via `FOR UPDATE SKIP LOCKED`               |
| Mixed workloads     | `WORKER_ENABLED=false` on web-facing instances, `true` on a worker pool — same image           |
| Database            | Three indexes cover every access pattern; the queue claim touches one row                      |
| Storage             | Stateless app; S3 scales independently, downloads bypass the server via pre-signed URLs        |
| Memory              | Streaming upload/download and per-job temp directories keep usage flat regardless of file size |

**Known limits, stated plainly.** Rate-limit counters are per instance, so
behind N replicas the effective limit is N× the configured value — `consume()`
in `lib/rate-limit.ts` is the single call site to swap for Redis. There is no
billing and no accounts: `lib/plans.ts` holds one allowance that applies to
everyone.

---

## 11. Full project tree

```
hexaconverter/
├── .github/workflows/                 CI and deploy pipelines
├── deploy/nginx/                      reverse-proxy configuration
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BACKUP.md
│   ├── DEPLOYMENT.md
│   ├── INSTALLATION.md
│   ├── MONITORING.md
│   └── PLAY_STORE.md
├── prisma/
│   ├── migrations/
│   │   ├── 20260701000000_init/
│   │   │   └── migration.sql
│   │   ├── 20260727000000_dashboard/
│   │   │   └── migration.sql
│   │   ├── 20260727120000_document_toolkit/
│   │   │   └── migration.sql
│   │   ├── 20260727154707_archive_toolkit/
│   │   │   └── migration.sql
│   │   ├── 20260727155557_job_output_detail/
│   │   │   └── migration.sql
│   │   ├── 20260727162417_upload_sessions/
│   │   │   └── migration.sql
│   │   ├── 20260727190000_auth_tokens_and_session_revocation/
│   │   │   └── migration.sql
│   │   ├── 20260727200000_billing_files_history/
│   │   │   └── migration.sql
│   │   ├── 20260801120000_free_service_no_accounts/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── public/
│   ├── brand/                         logos and wordmarks
│   ├── icon-192.png
│   └── icon-512.png
├── scripts/
│   ├── exercise-abuse.mjs
│   ├── exercise-features.mjs
│   ├── exercise-routes.mjs
│   └── make-fixtures.mjs
├── src/
│   ├── api/
│   │   ├── client/
│   │   │   ├── archives.client.ts
│   │   │   ├── documents.client.ts
│   │   │   ├── jobs.client.ts
│   │   │   ├── limits.client.ts
│   │   │   └── uploads.client.ts
│   │   ├── dto/
│   │   │   └── job.dto.ts
│   │   ├── schemas/
│   │   │   ├── archives.schema.ts
│   │   │   ├── common.ts
│   │   │   ├── contact.schema.ts
│   │   │   ├── documents.schema.ts
│   │   │   ├── index.ts
│   │   │   ├── job.schema.ts
│   │   │   └── upload.schema.ts
│   │   └── responses.ts
│   ├── app/
│   │   ├── (site)/
│   │   │   ├── (marketing)/
│   │   │   │   ├── about/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── contact/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── faq/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── features/
│   │   │   │       └── page.tsx
│   │   │   ├── (tools)/
│   │   │   │   ├── convert/
│   │   │   │   │   └── [category]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── tools/
│   │   │   │       ├── [slug]/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── archive/
│   │   │   │       │   └── [operation]/
│   │   │   │       │       └── page.tsx
│   │   │   │       └── pdf/
│   │   │   │           └── [operation]/
│   │   │   │               └── page.tsx
│   │   │   ├── legal/
│   │   │   │   ├── cookies/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── privacy/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── terms/
│   │   │   │       └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── contact/
│   │   │   │   └── route.ts
│   │   │   ├── cron/
│   │   │   │   ├── cleanup/
│   │   │   │   │   └── route.ts
│   │   │   │   └── process/
│   │   │   │       └── route.ts
│   │   │   ├── formats/
│   │   │   │   └── route.ts
│   │   │   ├── health/
│   │   │   │   └── route.ts
│   │   │   ├── jobs/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── cancel/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── download/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── limits/
│   │   │   │   └── route.ts
│   │   │   ├── storage/
│   │   │   │   └── route.ts
│   │   │   ├── tools/
│   │   │   │   ├── archive/
│   │   │   │   │   └── route.ts
│   │   │   │   └── pdf/
│   │   │   │       └── route.ts
│   │   │   └── uploads/
│   │   │       ├── sessions/
│   │   │       │   ├── [id]/
│   │   │       │   │   ├── complete/
│   │   │       │   │   │   └── route.ts
│   │   │       │   │   └── route.ts
│   │   │       │   └── route.ts
│   │   │       └── route.ts
│   │   ├── apple-icon.png
│   │   ├── error.tsx
│   │   ├── global-error.tsx
│   │   ├── icon.png
│   │   ├── layout.tsx
│   │   ├── manifest.ts
│   │   ├── not-found.tsx
│   │   ├── opengraph-image.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── components/
│   │   ├── archives/
│   │   │   ├── archive-workspace.tsx
│   │   │   └── purge-button.tsx
│   │   ├── convert/
│   │   │   ├── converter.tsx
│   │   │   ├── dropzone.tsx
│   │   │   ├── file-list.tsx
│   │   │   ├── file-row.tsx
│   │   │   ├── image-preview.tsx
│   │   │   ├── media-preview.tsx
│   │   │   └── options-panel.tsx
│   │   ├── documents/
│   │   │   └── pdf-workspace.tsx
│   │   ├── layout/
│   │   │   ├── legal-page.tsx
│   │   │   ├── logo.tsx
│   │   │   ├── site-footer.tsx
│   │   │   ├── site-header.tsx
│   │   │   └── theme-toggle.tsx
│   │   ├── marketing/
│   │   │   ├── category-grid.tsx
│   │   │   ├── contact-form.tsx
│   │   │   ├── faq-section.tsx
│   │   │   ├── feature-list.tsx
│   │   │   ├── features.tsx
│   │   │   ├── format-marquee.tsx
│   │   │   ├── hero.tsx
│   │   │   ├── how-it-works.tsx
│   │   │   ├── popular-tools.tsx
│   │   │   ├── reveal.tsx
│   │   │   ├── supported-formats.tsx
│   │   │   ├── testimonials.tsx
│   │   │   ├── trust-signals.tsx
│   │   │   └── why-choose-us.tsx
│   │   ├── providers/
│   │   │   ├── index.tsx
│   │   │   └── theme-provider.tsx
│   │   └── ui/
│   │       ├── accordion.tsx
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── progress.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       └── tooltip.tsx
│   ├── content/
│   │   ├── faq.ts
│   │   └── testimonials.ts
│   ├── database/
│   │   ├── repositories/
│   │   │   ├── contact.repository.ts
│   │   │   ├── job-queue.repository.ts
│   │   │   ├── job.repository.ts
│   │   │   └── upload-session.repository.ts
│   │   ├── client.ts
│   │   └── health.ts
│   ├── hooks/
│   │   ├── use-archive-toolkit.ts
│   │   ├── use-conversion.ts
│   │   ├── use-limits.ts
│   │   └── use-pdf-toolkit.ts
│   ├── lib/
│   │   ├── security/
│   │   │   └── index.ts
│   │   ├── contact.ts
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   ├── nav.ts
│   │   ├── plans.ts
│   │   ├── rate-limit.ts
│   │   └── seo.ts
│   ├── middleware/
│   │   ├── same-origin.ts
│   │   ├── with-error-handling.ts
│   │   ├── with-rate-limit.ts
│   │   └── with-validation.ts
│   ├── services/
│   │   ├── archives/
│   │   │   ├── archive-task.service.ts
│   │   │   ├── archive-toolkit.service.ts
│   │   │   └── formats.ts
│   │   ├── conversion/
│   │   │   ├── codecs/
│   │   │   │   ├── bmp.ts
│   │   │   │   └── sample-rate.ts
│   │   │   ├── engines/
│   │   │   │   ├── archive.engine.ts
│   │   │   │   ├── document.engine.ts
│   │   │   │   ├── image.engine.ts
│   │   │   │   ├── media.engine.ts
│   │   │   │   ├── office.engine.ts
│   │   │   │   ├── pdf-render.engine.ts
│   │   │   │   └── spreadsheet.engine.ts
│   │   │   ├── binaries.ts
│   │   │   ├── conversion.service.ts
│   │   │   ├── options.ts
│   │   │   └── registry.ts
│   │   ├── documents/
│   │   │   ├── document-task.service.ts
│   │   │   ├── page-selection.ts
│   │   │   ├── pdf-raster.service.ts
│   │   │   ├── pdf-text.engine.ts
│   │   │   ├── pdf-to-docx.service.ts
│   │   │   ├── pdf-toolkit.service.ts
│   │   │   └── pdfjs-fonts.ts
│   │   ├── identity/
│   │   │   └── identity.service.ts
│   │   ├── jobs/
│   │   │   ├── job-creation.service.ts
│   │   │   ├── job.service.ts
│   │   │   ├── queue.service.ts
│   │   │   ├── retention.service.ts
│   │   │   └── worker.ts
│   │   ├── mail/
│   │   │   ├── contact.service.ts
│   │   │   └── mail.service.ts
│   │   ├── storage/
│   │   │   ├── index.ts
│   │   │   ├── local.driver.ts
│   │   │   └── s3.driver.ts
│   │   └── upload/
│   │       ├── file-signatures.ts
│   │       ├── scanner.service.ts
│   │       ├── session.service.ts
│   │       └── upload.service.ts
│   ├── styles/
│   │   └── globals.css
│   ├── types/
│   │   ├── api.ts
│   │   ├── archives.ts
│   │   ├── conversion.ts
│   │   ├── documents.ts
│   │   ├── heic-decode.d.ts
│   │   ├── index.ts
│   │   └── storage.ts
│   ├── utils/
│   │   ├── cn.ts
│   │   ├── file.ts
│   │   ├── format.ts
│   │   ├── index.ts
│   │   ├── number.ts
│   │   └── string.ts
│   └── middleware.ts
├── tests/
│   ├── e2e/
│   │   └── smoke.spec.ts
│   └── unit/
│       ├── helpers/
│       │   ├── env.setup.ts
│       │   ├── server-only.ts
│       │   └── source-files.ts
│       ├── architecture.test.ts
│       ├── bmp.test.ts
│       ├── combine-pdf.test.ts
│       ├── file-signatures.test.ts
│       ├── formats.test.ts
│       ├── page-selection.test.ts
│       ├── pdf-raster.test.ts
│       ├── rasterize-to-png.test.ts
│       ├── rate-limit.test.ts
│       ├── sample-rate.test.ts
│       ├── scanner.test.ts
│       ├── security.test.ts
│       ├── utils.test.ts
│       └── validation.test.ts
├── Dockerfile
├── docker-compose.yml                 local Postgres and app
├── docker-compose.prod.yml            production stack
├── ecosystem.config.cjs               PM2 process definitions
├── next.config.mjs
├── package.json
├── playwright.config.ts
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
