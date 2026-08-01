# HexaConverter

A production-ready online file conversion platform. Converts documents, images,
video, audio and archives — 214 conversion routes across 38 formats — with
server-side encoding, signed downloads and automatic file deletion.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui,
Framer Motion, Prisma and PostgreSQL.

---

## Contents

- [Architecture](#architecture)
- [Requirements](#requirements)
- [Local setup](#local-setup)
- [Environment](#environment)
- [Conversion engines](#conversion-engines)
- [How a conversion flows](#how-a-conversion-flows)
- [Security model](#security-model)
- [API](#api)
- [Deployment](#deployment)
- [Scheduled jobs](#scheduled-jobs)
- [Testing](#testing)
- [Known limitations](#known-limitations)

---

## Architecture

```
Browser
  │  1. POST /api/uploads      raw body stream + x-file-name
  ▼
Next.js route handler ──► magic-byte verification ──► object storage
  │                                                    (local FS or S3)
  │  returns a signed upload ticket
  │
  │  2. POST /api/jobs         ticket + target format + options
  ▼
PostgreSQL job queue ◄────── worker claims with FOR UPDATE SKIP LOCKED
  │                                   │
  │  3. GET /api/jobs/:id (poll)      ▼
  │                            conversion engine
  │                            (libvips │ ffmpeg │ LibreOffice │ Poppler │ node)
  ▼                                   │
signed download URL ◄─────────────────┘
```

Layout:

| Path                            | Contents                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `src/app/(site)/(marketing)`    | Home, features, FAQ, about, contact                           |
| `src/app/(site)/(tools)`        | Category converters and one landing page per conversion route |
| `src/app/(site)/legal`          | Privacy, terms, cookies                                       |
| `src/app/api`                   | Route handlers                                                |
| `src/services/conversion`       | Format registry, option schemas and the five engines          |
| `src/services/documents`        | PDF rasterising, text extraction and the Word writer          |
| `src/services/storage`          | Driver interface with local-filesystem and S3 implementations |
| `src/services/jobs/queue.service.ts` | Job claiming, retries, lease recovery and retention purging |
| `src/components/ui`             | shadcn/ui primitives                                          |

The **format registry** (`src/services/conversion/registry.ts`) is the single source
of truth. The picker UI, the SEO landing pages, `/api/formats` and the
server-side validator all read from it, so an unsupported combination cannot be
requested through any surface.

## Requirements

- Node.js 22+ — `pdfjs-dist` calls `ArrayBuffer.prototype.transferToFixedLength`,
  which does not exist before Node 21. On Node 20 the PDF routes do not fail
  cleanly: standard-font text vanishes from rendered pages and a multi-page
  render hangs indefinitely.
- PostgreSQL 14+
- Optional at runtime, required for some routes:
  - **LibreOffice** (`soffice`) — Word/Excel/PowerPoint/OpenDocument conversions
  - **Poppler** (`pdftoppm`, `pdftotext`) — PDF rasterisation and text extraction

ffmpeg and ffprobe are bundled as static builds; nothing to install.

Routes whose tooling is missing are reported as unavailable by `/api/formats`
and rejected at job creation with a clear message, rather than failing halfway
through. The Docker image installs both.

## Local setup

```bash
git clone <repository-url> hexaconverter && cd hexaconverter
npm install

cp .env.example .env
# Generate the secrets:
#   openssl rand -hex 32      -> DOWNLOAD_URL_SECRET and CRON_SECRET

# Start PostgreSQL (or point DATABASE_URL at an existing instance)
docker compose up -d postgres

npm run db:migrate
npm run dev
```

The app runs at http://localhost:3000. With `STORAGE_DRIVER=local` (the default)
files are written to `./storage`, which is git-ignored.

Optional tooling on macOS:

```bash
brew install --cask libreoffice   # office documents
brew install poppler              # PDF rendering
```

On Debian/Ubuntu:

```bash
sudo apt-get install libreoffice-writer libreoffice-calc libreoffice-impress poppler-utils
```

### Full stack with Docker

```bash
docker compose up --build
```

Brings up the app, PostgreSQL and MinIO (as the S3 target), creates the bucket
and applies migrations. Replace the placeholder secrets in
`docker-compose.yml` before exposing it to a network.

## Environment

Every variable is documented in [`.env.example`](.env.example) and validated at
startup by `src/lib/env.ts` — the process fails fast with a specific message
rather than misbehaving later. The essentials:

| Variable                     | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`               | PostgreSQL connection string                               |
| `DOWNLOAD_URL_SECRET`        | HMAC key for download links and upload tickets (32+ chars) |
| `CRON_SECRET`                | Bearer token for `/api/cron/*`                             |
| `STORAGE_DRIVER`             | `local` in development, `s3` in production                 |
| `S3_*`                       | Bucket, credentials and endpoint for S3-compatible storage |
| `MAX_UPLOAD_BYTES`           | Hard ceiling applied before the service limit              |
| `WORKER_ENABLED`             | Whether this instance processes jobs                       |
| `SMTP_*`                     | Outbound mail for the contact form                         |

A production build refuses `STORAGE_DRIVER=local` unless you explicitly set
`ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true`, which is appropriate only for a single
instance backed by a persistent volume.

## Conversion engines

| Engine        | Backed by       | Handles                                                                     |
| ------------- | --------------- | --------------------------------------------------------------------------- |
| `image`       | sharp / libvips | JPEG, PNG, WebP, AVIF, TIFF, GIF, SVG input                                 |
| `media`       | ffmpeg          | MP4, WebM, MKV, MOV, AVI, MP3, WAV, FLAC, OGG, Opus, AAC, M4A, animated GIF |
| `document`    | pdf-lib, marked | Markdown, HTML, plain text, image-to-PDF                                    |
| `spreadsheet` | ExcelJS         | CSV, XLSX, JSON                                                             |
| `office`      | LibreOffice     | DOCX, DOC, ODT, RTF, XLSX, XLS, ODS, PPTX, PPT, ODP                         |
| `pdf-render`  | Poppler         | PDF to JPEG/PNG/TIFF and PDF to text                                        |
| `archive`     | archiver, tar   | ZIP, TAR, TAR.GZ                                                            |

Each engine receives a validated options object, reports real progress and
respects an `AbortSignal` so a cancelled job stops its encoder immediately.

## How a conversion flows

1. **Upload.** The raw request body is streamed to storage. Before the first
   byte is forwarded, the leading bytes are read and the container is
   identified from its magic number and checked against the declared extension.
   The running byte count is enforced against the service limit, so a lying
   `Content-Length` cannot bypass it. The response is a **signed upload ticket**
   containing the storage key, size, MIME type and owner.
2. **Queue.** `POST /api/jobs` trusts only what is inside the ticket, so a
   caller cannot point a conversion at someone else's file or misreport its
   format. Quota, concurrency and route availability are checked, then a
   `ConversionJob` row is created.
3. **Process.** A worker claims the oldest queued job atomically
   (`FOR UPDATE SKIP LOCKED`), downloads the source into a private temporary
   directory, runs the engine and uploads the result. Progress writes double as
   a cancellation check and a lease renewal.
4. **Deliver.** The client polls until the job reaches a terminal state and
   downloads via a short-lived HMAC-signed link. On S3, the request is
   redirected to a pre-signed URL so the file never transits the app server.
5. **Delete.** The source file is deleted the moment the conversion finishes;
   the output is purged by the retention job.

## Security model

- **Content verification** — uploads are identified by magic bytes; a renamed
  or malformed file is rejected before any encoder sees it.
- **No shell interpolation** — every external tool is spawned with an argument
  array, never a shell string. Options are parsed by strict Zod schemas that
  reject unknown keys and clamp every numeric bound.
- **Archive defences** — entry-count, total-size and compression-ratio limits,
  plus path-traversal and symlink rejection (Zip Slip, zip bombs).
- **Decompression limits** — a pixel ceiling on image decoding, a cell budget on
  spreadsheets and a wall-clock timeout on every external process.
- **Signed, short-lived links** — download tokens are HMAC-bound to one job and
  expire in minutes; upload tickets are bound to one owner.
- **Ownership scoping** — every job query is filtered by the anonymous guest
  cookie, so ids cannot be enumerated.
- **Isolation** — LibreOffice runs with a private user profile per job and a
  temporary `HOME`; each conversion gets a fresh directory that is always
  removed, including on failure.
- **Transport and headers** — HSTS, a restrictive CSP, `nosniff`,
  `frame-ancestors 'none'`, and a same-origin check on all mutating API calls.
- **Privacy** — image metadata (including GPS) is stripped by default, and IP
  addresses are stored only as salted hashes.

See [SECURITY.md](SECURITY.md) for reporting a vulnerability.

## API

| Method   | Route                           | Purpose                                         |
| -------- | ------------------------------- | ----------------------------------------------- |
| `POST`   | `/api/uploads`                  | Stream a file; returns a signed ticket          |
| `POST`   | `/api/jobs`                     | Queue a conversion from a ticket                |
| `GET`    | `/api/jobs`                     | List your conversions (cursor-paginated)        |
| `GET`    | `/api/jobs/:id`                 | Poll one conversion                             |
| `POST`   | `/api/jobs/:id/cancel`          | Cancel a queued or running conversion           |
| `DELETE` | `/api/jobs/:id`                 | Delete a conversion and its files               |
| `GET`    | `/api/jobs/:id/download`        | Download with a signed token                    |
| `GET`    | `/api/formats`                  | Formats and routes available on this deploy     |
| `GET`    | `/api/limits`                   | Limits and remaining allowance for the caller   |
| `POST`   | `/api/tools/pdf`                | Queue a PDF toolkit task                        |
| `POST`   | `/api/tools/archive`            | Queue an archive toolkit task                   |
| `DELETE` | `/api/storage`                  | Delete every file stored for this browser       |
| `GET`    | `/api/health`                   | Readiness probe (503 when a dependency is down) |
| `POST`   | `/api/contact`                  | Contact form                                    |

Example:

```bash
# 1. Upload
TICKET=$(curl -s -X POST http://localhost:3000/api/uploads \
  -H "x-file-name: photo.png" \
  --data-binary @photo.png | jq -r .ticket)

# 2. Queue the conversion
JOB=$(curl -s -X POST http://localhost:3000/api/jobs \
  -H 'content-type: application/json' \
  -d "{\"ticket\":\"$TICKET\",\"targetFormat\":\"webp\",\"options\":{\"quality\":85}}" \
  | jq -r .job.id)

# 3. Poll, then follow the returned downloadUrl
curl -s "http://localhost:3000/api/jobs/$JOB" | jq
```

## Deployment

Full guides live in `docs/`:

| Guide                                   | Covers                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| [INSTALLATION.md](docs/INSTALLATION.md) | Local setup, optional tooling, troubleshooting                            |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md)     | Docker Compose, PM2, Vercel, Nginx, CI/CD, rollback, pre-launch checklist |
| [BACKUP.md](docs/BACKUP.md)             | What to back up and what deliberately not to, restore drills, DR          |
| [MONITORING.md](docs/MONITORING.md)     | Health checks, alert thresholds, queue queries, runbook                   |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering, data model, auth flow, engines                                  |

The Docker image is the supported deployment unit: it bundles LibreOffice,
Poppler, Ghostscript and the fonts office documents need.

```bash
# Production stack: migrate, then web + worker as separate services.
cp .env.production.example .env.production   # fill in, then chmod 600
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Supporting files:

| File                              | Purpose                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `Dockerfile`                      | Multi-stage build; standalone server, non-root, healthcheck                    |
| `docker-compose.yml`              | Local production-parity stack with Postgres + MinIO                            |
| `docker-compose.prod.yml`         | Production: web and worker split, secrets from `.env.production`               |
| `deploy/nginx/hexaconverter.conf` | TLS, brotli, streamed uploads, long proxy timeouts                             |
| `ecosystem.config.cjs`            | PM2, for a VPS without Docker                                                  |
| `vercel.json`                     | Cron schedules and function limits — **partial** format support, see the guide |
| `.github/workflows/ci.yml`        | Lint, typecheck, tests, build, e2e, Docker build                               |
| `.github/workflows/deploy.yml`    | Tag-triggered: publish to GHCR, scan, roll out, roll back                      |

**A note on Vercel.** It can host the web tier but cannot run LibreOffice,
Poppler or Ghostscript, so Office documents, PDF→image and PDF compression will
report as unavailable. That degrades honestly rather than failing — `/api/formats`
probes tooling at runtime and the picker hides what is missing. For full format
support, pair Vercel with one worker container elsewhere. See
[DEPLOYMENT.md](docs/DEPLOYMENT.md#vercel).

Checklist for a real deployment:

1. `STORAGE_DRIVER=s3` with a private bucket, server-side encryption and a
   lifecycle rule matching your longest retention window.
2. Fresh `DOWNLOAD_URL_SECRET` and `CRON_SECRET`.
3. `npx prisma migrate deploy` on release (the compose file does this on start).
4. Point your load balancer's health check at `/api/health`.
5. Schedule the cron endpoints (below).
6. Size instances for conversion, not for HTTP: ffmpeg and LibreOffice are
   CPU-bound. Tune `WORKER_CONCURRENCY` to roughly the vCPU count, and set
   `WORKER_ENABLED=false` on any instance that should only serve traffic.

### Serverless platforms

Long-running background loops are not available on most serverless hosts. Set
`WORKER_ENABLED=false` and schedule `/api/cron/process` every minute instead —
it drains the same queue through the same code path.

## Scheduled jobs

Both endpoints require `Authorization: Bearer $CRON_SECRET`.

| Endpoint            | Suggested schedule | Does                                                     |
| ------------------- | ------------------ | -------------------------------------------------------- |
| `/api/cron/cleanup` | every 15 minutes   | Deletes expired files, prunes guest history and old logs |
| `/api/cron/process` | every minute       | Drains queued conversions (serverless deployments only)  |

```bash
curl -X POST https://your-domain/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Testing

```bash
npm test           # Vitest unit tests, including the architecture guard
npm run test:e2e   # Playwright smoke tests (builds and starts the app)
npm run typecheck
npm run lint
```

Unit tests cover the layer boundaries, the format registry's invariants,
magic-byte sniffing, option validation, token signing and the rate limiter. The Playwright suite covers the
marketing pages, a converter, a landing page, the auth redirect and the crawler
surfaces.

## Known limitations

Stated explicitly so nothing surprises you in production:

- **HEIC/HEIF input is not offered.** The prebuilt libvips that ships with
  `sharp` excludes HEIC decoding for licensing reasons. Building `sharp` against
  a libvips with `libheif` enables it; the format is left out of the registry
  rather than advertised and failing.
- **PDF is output-only for office routes.** PDF-to-Word conversion produces
  unusable results with the available tooling, so it is not offered. PDF to
  image and PDF to text are supported through Poppler.
- **Multi-page PDF rendering returns a ZIP.** One image per page, packaged
  together; the output MIME type and filename reflect that.
- **Rate limiting is per instance.** Counters live in process memory, so behind
  N replicas the effective limit is N times the configured value. `consume()` in
  `src/lib/rate-limit.ts` is the single call site to swap for Redis.
- **Billing is not integrated.** Plans and their limits are defined and
  enforced, but there is no payment provider wired in; paid tiers are activated
  manually. `src/lib/plans.ts` is where a checkout flow would attach.

## Licence

MIT — see [LICENSE](LICENSE).
