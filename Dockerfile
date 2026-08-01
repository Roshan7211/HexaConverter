# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# HexaConverter production image
#
# Multi-stage build producing a standalone Next.js server plus the external
# tooling the conversion engines depend on (LibreOffice for office documents,
# Poppler for PDF rendering; ffmpeg and 7-Zip ship as bundled static builds,
# and unrar is compiled to WebAssembly, so none of the three need packages).
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm NEXT_TELEMETRY_DISABLED=1
WORKDIR /app


# --- Dependencies ----------------------------------------------------------
FROM base AS deps

# `sharp` and Prisma need these to install and generate.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates openssl python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma

# `npm ci` requires a lockfile; fall back to `install` for a first build.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi


# --- Build -----------------------------------------------------------------
FROM base AS builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The public origin is NOT a placeholder. `NEXT_PUBLIC_*` values are inlined
# into the bundle by the compiler, so this is the only moment they can be set —
# injecting one at runtime does nothing. Build with the real origin:
#
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://www.hexaconverter.com .
#
# Get it wrong and the image ships canonical URLs, a sitemap and Open Graph
# tags all naming the wrong host.
ARG NEXT_PUBLIC_APP_URL=https://www.hexaconverter.com
ARG NEXT_PUBLIC_APP_NAME=HexaConverter

# Build-time placeholders: real secrets are injected at runtime. The build only
# needs these to satisfy env validation while prerendering static pages.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DOWNLOAD_URL_SECRET=build-time-placeholder-secret-value-32-chars \
    CRON_SECRET=build-time-placeholder \
    STORAGE_DRIVER=s3 \
    S3_BUCKET=build \
    S3_ACCESS_KEY_ID=build \
    S3_SECRET_ACCESS_KEY=build

RUN npx prisma generate && npm run build


# --- Runtime ---------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Conversion tooling:
#   libreoffice-*  headless converters for Writer/Calc/Impress documents
#   poppler-utils  pdftoppm / pdftotext for PDF rendering and extraction
#   ghostscript    real image recompression for the PDF compressor; without it
#                  compression falls back to a lossless structural rewrite
#   fonts-*        substitution fonts so office documents render correctly
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates openssl tini \
      libreoffice-writer libreoffice-calc libreoffice-impress \
      libreoffice-core libreoffice-common default-jre-headless \
      poppler-utils ghostscript \
      fonts-liberation2 fonts-dejavu-core fonts-noto-core fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# Run as an unprivileged user; conversions execute as this account.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --home /home/hexa --create-home hexa

COPY --from=builder --chown=hexa:nodejs /app/.next/standalone ./
COPY --from=builder --chown=hexa:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=hexa:nodejs /app/public ./public
COPY --from=builder --chown=hexa:nodejs /app/prisma ./prisma
# Prisma CLI and engines, so `migrate deploy` can run on container start.
COPY --from=builder --chown=hexa:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=hexa:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=hexa:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# The 7-Zip binary is loaded by absolute path at runtime, so Next's tracer
# cannot see it and it has to be copied explicitly. `chmod` guards against a
# registry tarball that lost the executable bit.
COPY --from=builder --chown=hexa:nodejs /app/node_modules/7zip-bin ./node_modules/7zip-bin
RUN chmod -R +x ./node_modules/7zip-bin/linux || true

# Writable scratch space for in-flight conversions.
RUN mkdir -p /tmp/hexa && chown hexa:nodejs /tmp/hexa

USER hexa
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps the child processes that ffmpeg and LibreOffice leave behind.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
