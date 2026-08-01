# Deployment

- [Choosing a target](#choosing-a-target)
- [What every target needs](#what-every-target-needs)
- [Docker Compose on a VPS](#docker-compose-on-a-vps-recommended)
- [PM2 without Docker](#pm2-without-docker)
- [Vercel](#vercel)
- [Nginx](#nginx)
- [CI/CD](#cicd)
- [Migrations and rollback](#migrations-and-rollback)
- [Pre-launch checklist](#pre-launch-checklist)

---

## Choosing a target

This application is not a plain Next.js site. It shells out to **LibreOffice,
Poppler, Ghostscript and ffmpeg**, runs conversions that take **minutes**, and
keeps a **background worker** claiming jobs from Postgres. Those three facts
decide where it can run.

| Target                    | Conversions | Verdict                                          |
| ------------------------- | ----------- | ------------------------------------------------ |
| Docker on a VPS           | All         | **Recommended.** The image carries every binary. |
| PM2 on a VPS              | All         | Fine, if you install the tooling on the host.    |
| Fly.io / Railway / Render | All         | Works — anything that runs the container.        |
| Vercel                    | **Partial** | Web tier only. See [Vercel](#vercel).            |
| Cloudflare Workers        | None        | No Node runtime for the engines. Not viable.     |

---

## What every target needs

1. **PostgreSQL 14+.** Managed, with automated backups — see
   [BACKUP.md](./BACKUP.md).
2. **S3-compatible object storage.** `STORAGE_DRIVER=local` is refused by a
   production build unless you set `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true`,
   which is only correct for a single node with a persistent volume. A local
   directory is not shared between replicas: a file written by one instance is
   invisible to the next.
3. **Two generated secrets.** `DOWNLOAD_URL_SECRET`
   `CRON_SECRET` — fresh per environment, never the development values.
4. **`NEXT_PUBLIC_APP_URL` set before the build.** It is inlined into the client
   bundle, so it cannot be changed at runtime. Get it wrong and canonical URLs,
   OG tags, the sitemap and every emailed link point at the wrong origin.
5. **A scheduler.** The retention sweep is what makes the deletion promises in
   the privacy policy true. Nothing else triggers it.

---

## Docker Compose on a VPS (recommended)

### Provision

Two vCPU and 4 GB RAM is a realistic floor — LibreOffice and ffmpeg, not Node,
set the memory ceiling. Conversions are CPU-bound, so cores are what buy
throughput.

```bash
sudo mkdir -p /srv/hexaconverter && cd /srv/hexaconverter
# Copy in: docker-compose.prod.yml, .env.production, deploy/nginx/
```

### Configure

```bash
cp .env.production.example .env.production
chmod 600 .env.production        # secrets: not world-readable
```

Fill in every blank. `IMAGE` should be a **digest**, not a tag — a rollback then
names an exact artifact and `latest` cannot move underneath you.

### Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Three services come up in order:

- **`migrate`** runs `prisma migrate deploy` and exits. Both app services block
  on its success, so a failed migration aborts the rollout with the previous
  version still serving.
- **`web`** handles requests with `WORKER_ENABLED=false`, bound to
  `127.0.0.1:3000` so only Nginx can reach it.
- **`worker`** runs conversions with `WORKER_ENABLED=true` and no published
  port.

The split is the point: a video encode cannot starve request handling, the two
scale independently, and restarting the web tier during a deploy does not kill a
conversion halfway through.

### Scale the worker

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --scale worker=3
```

Replicas never collide — jobs are claimed with `FOR UPDATE SKIP LOCKED`. Total
parallel encodes is `WORKER_CONCURRENCY × replicas`; keep that product at or
below the host's core count.

---

## PM2 without Docker

For a host where you would rather manage the tooling yourself. Install
LibreOffice, Poppler and Ghostscript first (see
[INSTALLATION.md](./INSTALLATION.md)).

```bash
git clone <repository-url> /srv/hexaconverter && cd /srv/hexaconverter
npm ci
cp .env.production.example .env && chmod 600 .env   # Next reads .env
npm run build
npx prisma migrate deploy

pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup
```

Two apps start: `hexaconverter-web` in cluster mode across all cores, and
`hexaconverter-worker` in fork mode on port 3001.

The worker is deliberately **not** clustered. Its concurrency is already set by
`WORKER_CONCURRENCY`; running N cluster instances would multiply it by N and
oversubscribe the CPU that ffmpeg and LibreOffice need.

```bash
pm2 reload hexaconverter-web      # zero-downtime, cluster mode
pm2 logs hexaconverter-worker
pm2 monit
```

Add the retention sweep to crontab:

```cron
0 * * * * curl -fsS -X POST http://127.0.0.1:3000/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET" >/dev/null
```

---

## Vercel

**Be clear about what this gets you.** Vercel is an excellent host for the web
tier and cannot run most of the conversion engines. It provides no LibreOffice,
no Poppler and no Ghostscript, and no way to install them.

`vercel.json` is included and correct. Deployed as-is:

| Category                    | On Vercel | Why                                                                |
| --------------------------- | --------- | ------------------------------------------------------------------ |
| Images (JPEG, PNG, WebP, …) | ✅        | `sharp` is supported                                               |
| Archives (ZIP, TAR, …)      | ✅        | Pure JavaScript                                                    |
| Spreadsheets (CSV, XLSX)    | ✅        | Pure JavaScript                                                    |
| Audio / video               | ⚠️        | `ffmpeg-static` fits, but a long encode will hit the 300 s ceiling |
| Office documents            | ❌        | Needs LibreOffice                                                  |
| PDF → image, PDF → text     | ❌        | Needs Poppler                                                      |
| PDF compression             | ❌        | Needs Ghostscript (degrades to a lossless rewrite)                 |

**This degrades honestly rather than breaking.** `/api/formats` probes tooling
availability at runtime, the picker hides unavailable routes, and job creation
refuses them with a clear message. Users are never offered a conversion that
would fail.

If that tradeoff is acceptable, deploy normally:

```bash
vercel --prod
```

Set every variable from `.env.production.example` in the project settings, and
`STORAGE_DRIVER=s3` — the filesystem is ephemeral, so the local driver cannot
work at all.

`vercel.json` declares two cron jobs: `/api/cron/process` every two minutes to
drain the queue, and `/api/cron/cleanup` hourly for retention. Naming the
variable exactly `CRON_SECRET` matters — Vercel then sends it as a bearer token
automatically, which is what the route checks.

**For full format support, split the deployment:** Vercel serves the web tier
with `WORKER_ENABLED=false`, and a single container elsewhere (Fly, Railway, a
small VPS) runs `WORKER_ENABLED=true` against the same Postgres and bucket. The
worker needs no inbound traffic, so it can be the cheapest box available.

---

## Nginx

```bash
sudo cp deploy/nginx/hexaconverter.conf /etc/nginx/sites-available/hexaconverter
sudo ln -s /etc/nginx/sites-available/hexaconverter /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hexaconverter.com -d www.hexaconverter.com
```

Three settings in that file are load-bearing and are exactly what a generic
template gets wrong:

- **`client_max_body_size 512m`** must be ≥ `MAX_UPLOAD_BYTES`. Nginx rejects
  before the request reaches the app, so a mismatch surfaces as an unexplained
  413 with nothing in the application logs.
- **`proxy_request_buffering off`** on the upload routes. The upload handler
  verifies magic bytes and enforces the size cap _on the stream_; buffering the
  whole file to disk first defeats both and doubles the disk write.
- **`proxy_read_timeout 300s`** matches the `maxDuration` the route handlers
  declare. The 60-second default severs long operations mid-flight.

Security headers are **not** set in Nginx — the application sets them in
`next.config.mjs`. Two sources for one header is how they drift.

Brotli is the main reason to terminate here at all: Next's `compress: true` is
gzip-only, and brotli is another 15–20% off every text asset. If `nginx -t`
rejects the `brotli` directives, install `libnginx-mod-http-brotli` or comment
those five lines out.

---

## CI/CD

Two workflows:

**`ci.yml`** — the gate. Lint, format check, typecheck, 153 unit tests against a
real Postgres, a production build, Playwright e2e, and a Docker build. Runs on
every push and pull request to `main`.

**`deploy.yml`** — delivery, triggered by a `v*.*.*` tag rather than every merge.
A deploy should be a deliberate act with a name you can roll back to.

```
tag v1.2.3
  └─ verify   re-runs the full ci.yml gate against the tagged commit
  └─ publish  builds, pushes to GHCR, attaches signed provenance
  └─ scan     Trivy HIGH/CRITICAL → GitHub Security tab (reports, does not block)
  └─ deploy   SSH: compose pull + up -d, then polls /api/health
  └─ rollback on failure only: restores the pinned previous image
```

Required setup:

| Where                   | What                                             |
| ----------------------- | ------------------------------------------------ |
| Settings → Secrets      | `SSH_HOST`, `SSH_USER`, `SSH_KEY`                |
| Settings → Environments | `production` — add reviewers to gate the rollout |

GHCR needs no secret: `GITHUB_TOKEN` can push to the repository's own registry.

---

## Migrations and rollback

`migrate deploy` runs as its own service, before the app starts, and applies
only migrations that have not run. It never generates or resets anything.

**Rolling back code does not roll back the schema.** The `rollback` job restores
the previous image; it does not touch the database, because reversing a
migration that has already dropped a column cannot restore the data that was in
it.

Write migrations so this is survivable — the additive, expand-then-contract
shape used for the `File` table in
[ARCHITECTURE.md](./ARCHITECTURE.md#5-database-schema):

1. **Expand.** Add the new column or table; backfill it. Old code ignores it,
   new code uses it. Both versions run against this schema, so a rollback is
   safe.
2. **Contract.** Only once the new code is confirmed good, a _later_ migration
   drops what is now unused.

Never combine the two in one release. A rename is an expand-and-contract, not an
`ALTER … RENAME`.

Before any destructive migration, take a snapshot — see [BACKUP.md](./BACKUP.md).

---

## Pre-launch checklist

**Secrets**

- [ ] `DOWNLOAD_URL_SECRET` and `CRON_SECRET` freshly generated
- [ ] No development or example value anywhere in `.env.production`
- [ ] `chmod 600 .env.production`
- [ ] Database password rotated if it has ever been pasted anywhere
- [ ] `.env.production` confirmed git-ignored (`git check-ignore .env.production`)

**Configuration**

- [ ] `NEXT_PUBLIC_APP_URL` is the real https origin
- [ ] `STORAGE_DRIVER=s3` with a bucket that is **not** public
- [ ] `MAX_UPLOAD_BYTES` ≤ Nginx `client_max_body_size`
- [ ] OAuth callback URLs registered for the production domain

**Infrastructure**

- [ ] `migrate deploy` applied; `/api/health` reports `database: ok`
- [ ] Retention sweep scheduled and verified to have run once
- [ ] TLS valid; certbot renewal timer enabled
- [ ] Postgres reachable only from the app, never the internet
- [ ] Backups running **and a restore rehearsed** — see [BACKUP.md](./BACKUP.md)
- [ ] Uptime and error alerting live — see [MONITORING.md](./MONITORING.md)

**Verify**

```bash
curl -s https://www.hexaconverter.com/api/health | jq
curl -s https://www.hexaconverter.com/robots.txt
curl -s https://www.hexaconverter.com/sitemap.xml | grep -c '<loc>'
curl -sI https://www.hexaconverter.com | grep -i 'strict-transport\|content-security'
```

Then convert one real file end-to-end in each category you support, and confirm
the output downloads and the source file disappears from the bucket.
