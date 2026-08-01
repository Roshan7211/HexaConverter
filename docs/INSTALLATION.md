# Installation

Getting HexaConverter running locally. For production, see
[DEPLOYMENT.md](./DEPLOYMENT.md).

- [Requirements](#requirements)
- [Quick start with Docker](#quick-start-with-docker)
- [Local development](#local-development)
- [Optional conversion tooling](#optional-conversion-tooling)
- [Verifying the install](#verifying-the-install)
- [Troubleshooting](#troubleshooting)

---

## Requirements

| Component   | Version | Required?                              |
| ----------- | ------- | -------------------------------------- |
| Node.js     | ≥ 20.11 | Yes (22 recommended, `.nvmrc` pins it) |
| PostgreSQL  | ≥ 14    | Yes                                    |
| LibreOffice | any     | Only for Office document conversions   |
| Poppler     | any     | Only for PDF → image and PDF → text    |
| Ghostscript | any     | Improves PDF compression; optional     |
| Docker      | ≥ 24    | Only for the container path            |

ffmpeg, ffprobe and 7-Zip ship as bundled static builds, and unrar is compiled
to WebAssembly. None of the four need installing.

**Nothing in the second group is a hard dependency.** Routes whose tooling is
absent are reported unavailable by `/api/formats` and refused at job creation
with a clear message, rather than failing halfway through a conversion. You can
run the whole platform without them and still convert images, audio, video,
archives and spreadsheets.

---

## Quick start with Docker

The fastest path to a working stack — application, PostgreSQL, and MinIO
standing in for S3:

```bash
git clone <repository-url> hexaconverter && cd hexaconverter
docker compose up --build
```

That brings up http://localhost:3000, creates the bucket, and applies
migrations. The compose file carries placeholder secrets and binds Postgres to
`localhost` only; **replace the secrets before exposing it to a network.**

The image includes LibreOffice, Poppler and Ghostscript, so every conversion
route works in this stack.

---

## Local development

### 1. Install dependencies

```bash
git clone <repository-url> hexaconverter && cd hexaconverter
nvm use          # or ensure Node ≥ 20.11 yourself
npm install
```

`postinstall` runs `prisma generate`, so the typed client exists before the
first build.

### 2. Configure the environment

```bash
cp .env.example .env
```

Generate the three secrets — do not reuse the placeholders:

```bash
openssl rand -hex 32      # DOWNLOAD_URL_SECRET
openssl rand -hex 32      # CRON_SECRET
```

Every variable is validated at startup by `src/lib/env.ts`. A missing or
malformed value fails the boot with a message naming the variable and what is
wrong with it, so misconfiguration is loud rather than mysterious.

### 3. Start a database

Either use the compose service:

```bash
docker compose up -d postgres
```

…or point `DATABASE_URL` at any Postgres you already have. **The port in
`DATABASE_URL` must match what your Postgres is actually listening on** —
`docker-compose.yml` publishes `5432`.

For a hosted database (Supabase, Neon, RDS), two things bite:

- Supabase's direct host `db.<ref>.supabase.co` is **IPv6-only**. If your
  network has no IPv6 route, use the **session pooler** hostname instead; the
  failure otherwise looks identical to a wrong password.
- A password containing `%`, `+`, `/`, `@`, `:` or `?` **must be
  percent-encoded** or the URL will not parse:
  ```bash
  node -e 'console.log(encodeURIComponent(process.argv[1]))' 'your-password'
  ```

### 4. Apply migrations

```bash
npm run db:migrate     # creates the 16 tables
```

### 5. Run it

```bash
npm run dev            # http://localhost:3000
```

---

## Optional conversion tooling

**macOS**

```bash
brew install --cask libreoffice     # Office documents
brew install poppler ghostscript    # PDF rendering and compression
```

**Debian / Ubuntu**

```bash
sudo apt-get install -y \
  libreoffice-writer libreoffice-calc libreoffice-impress \
  poppler-utils ghostscript
```

If a binary is somewhere unusual, point at it explicitly with `SOFFICE_PATH`,
`FFMPEG_PATH`, `FFPROBE_PATH` or `SEVEN_ZIP_PATH`. Poppler and Ghostscript are
discovered on `PATH` only.

---

## Verifying the install

`/api/health` is the single source of truth, and it reports honestly:

```bash
curl -s http://localhost:3000/api/health | jq
```

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "storage": "ok",
    "libreoffice": "degraded",
    "poppler": "degraded",
    "malwareScanner": "degraded"
  }
}
```

`degraded` on the tooling checks is expected and fine if you skipped the
optional installs — it means those specific routes are unavailable, not that the
service is broken. `status` stays `ok` as long as the database and storage are
reachable; those two are what make it `unavailable`.

Then run the suite:

```bash
npm run typecheck
npm test              # 153 unit tests
npm run test:e2e      # Playwright, needs a build first
```

---

## Troubleshooting

**`Can't reach database server`** — Postgres is not running, or the port in
`DATABASE_URL` does not match where it is listening. This is the single most
common failure, and it surfaces on every page that touches data, including
sign-up. Check with `docker compose ps` or `pg_isready -h host -p port`.

**`Invalid environment configuration`** — the message names the variable and the
constraint it failed. Secrets have minimum lengths (32 characters for
`DOWNLOAD_URL_SECRET`, 16 for `CRON_SECRET`).

**`Local storage is not durable across replicas`** — a production build refuses
`STORAGE_DRIVER=local`. Either set `STORAGE_DRIVER=s3`, or set
`ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true` if this really is one node with a
persistent volume.

**`"next start" does not work with "output: standalone"`** — correct, and the
warning means what it says. Use `node .next/standalone/server.js`, which is what
the Dockerfile and the PM2 config both do.

**Office conversions fail with a spawn error** — LibreOffice is not installed or
`SOFFICE_PATH` is wrong. `/api/health` will already be saying `libreoffice:
degraded`.
