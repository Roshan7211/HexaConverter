# Monitoring

- [The health endpoint](#the-health-endpoint)
- [What to alert on](#what-to-alert-on)
- [Logs](#logs)
- [Database queries worth watching](#database-queries-worth-watching)
- [Uptime monitoring](#uptime-monitoring)
- [Error tracking](#error-tracking)
- [Runbook](#runbook)

---

## The health endpoint

`GET /api/health` is unauthenticated, uncached, and designed to be the one thing
a monitor needs.

```bash
curl -s https://www.hexaconverter.com/api/health | jq
```

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "storage": "ok",
    "libreoffice": "ok",
    "poppler": "ok",
    "malwareScanner": "degraded"
  },
  "uptimeSeconds": 138,
  "timestamp": "2026-07-28T03:31:02.745Z"
}
```

The distinction that matters:

| `status`      | HTTP | Meaning                                                                           |
| ------------- | ---- | --------------------------------------------------------------------------------- |
| `ok`          | 200  | Database and storage reachable. Some tooling may be absent.                       |
| `degraded`    | 200  | Optional capability missing. Those routes are unavailable; everything else works. |
| `unavailable` | 503  | Database or storage is down. **Page someone.**                                    |

`degraded` on a tooling check is not an incident — it means those conversions
are correctly reported unavailable rather than failing halfway through. Alert on
`unavailable` and on the 503, not on `degraded`.

Point your load balancer at this. It returns 503 when the instance genuinely
cannot serve, which is what you want driving traffic away.

---

## What to alert on

Ordered by how much it should wake someone.

### Page immediately

| Condition                                           | Why                                                       |
| --------------------------------------------------- | --------------------------------------------------------- |
| `/api/health` returns 503, or unreachable for 2 min | Users cannot convert anything                             |
| `checks.database != "ok"`                           | Nothing that touches data works, including conversions    |
| `checks.storage != "ok"`                            | Uploads and downloads both fail                           |
| TLS certificate expires in < 7 days                 | Certbot renewal has stopped                               |
| Disk > 90% on the worker host                       | Conversions write to scratch space and will start failing |

### Notify during working hours

| Condition                                              | Why                                                                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **No successful retention sweep in 26 h**              | Files are outliving the privacy policy. Alert on _absence_ — a cron that silently stopped is the normal failure. |
| **No backup in 26 h**                                  | Same reasoning. See [BACKUP.md](./BACKUP.md).                                                                    |
| Job failure rate > 20% over 1 h                        | Tooling regression or a bad deploy                                                                               |
| Queue depth > 100, or oldest queued job > 15 min       | Worker is dead, or under-provisioned                                                                             |
| `checks.libreoffice` / `poppler` flipped to `degraded` | A binary vanished — usually a base-image change                                                                  |
| 5xx rate > 1% over 15 min                              | Something is broken that health checks do not cover                                                              |
| Auth failures spike from one IP hash                   | Credential stuffing                                                                                              |

The two "no event in 26 h" alerts are the ones teams forget, and they protect the
two things that fail invisibly: **retention and backups.** Nobody notices either
until it is a legal problem or an outage.

---

## Logs

Structured JSON, one object per line, so any log pipeline can index the fields
without a parser. Sensitive keys — `password`, `token`, `authorization`,
`cookie`, `secret`, `apiKey`, `sessionToken` — are redacted before they are
written, so logs are safe to ship to a third party.

```json
{
  "level": "error",
  "time": "2026-07-28T03:31:02.745Z",
  "message": "Unhandled API error",
  "route": "POST /api/auth/register",
  "error": { "name": "PrismaClientInitializationError" }
}
```

```bash
# Docker
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f worker

# PM2
pm2 logs hexaconverter-worker --lines 200

# Errors only
docker compose logs --no-log-prefix web | jq -c 'select(.level=="error")'

# Conversion durations, to find the slow routes
docker compose logs --no-log-prefix worker \
  | jq -c 'select(.durationMs) | {sourceFormat,targetFormat,durationMs}'
```

Docker log rotation is configured in `docker-compose.prod.yml` (10 MB × 5 per
service). Without it, a busy worker fills the disk — and a full disk on the
worker host fails conversions.

Ship them somewhere queryable (Loki, CloudWatch, Datadog). The format is already
right for it.

---

## Database queries worth watching

Turn these into a dashboard; they answer "is the pipeline healthy?" faster than
any log search.

```sql
-- Queue depth and the oldest thing waiting. The second number is the one that
-- tells you the worker has stopped.
SELECT status, count(*),
       max(now() - "createdAt") AS oldest
FROM "ConversionJob"
WHERE status IN ('QUEUED','PROCESSING')
GROUP BY status;

-- Failure rate over the last hour, by route. A single format dominating means
-- tooling, not load.
SELECT "sourceFormat", "targetFormat",
       count(*) FILTER (WHERE status='FAILED')    AS failed,
       count(*) FILTER (WHERE status='COMPLETED') AS completed,
       round(100.0 * count(*) FILTER (WHERE status='FAILED') / count(*), 1) AS pct
FROM "ConversionJob"
WHERE "createdAt" > now() - interval '1 hour'
GROUP BY 1,2
HAVING count(*) FILTER (WHERE status='FAILED') > 0
ORDER BY pct DESC;

-- Stuck leases: claimed but never finished. The sweep reclaims these, so a
-- persistent non-zero count means the sweep is not running.
SELECT id, "lockedBy", now() - "lockedAt" AS held
FROM "ConversionJob"
WHERE status='PROCESSING' AND "lockedAt" < now() - interval '30 minutes';

-- Is retention actually working? Live files past their expiry should be ~0.
SELECT count(*) AS overdue
FROM "File"
WHERE "expiresAt" < now() AND status <> 'DELETED';

-- Conversion throughput and p95 duration, last 24 h.
SELECT date_trunc('hour', "finishedAt") AS hour,
       count(*),
       percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95_ms
FROM "ConversionJob"
WHERE "finishedAt" > now() - interval '24 hours'
GROUP BY 1 ORDER BY 1 DESC;
```

The `overdue` query is the compliance one. If it climbs, the privacy policy is
no longer accurate and that is a real problem, not a performance nit.

---

## Uptime monitoring

Any of Better Stack, Uptime Robot, Healthchecks.io or a Grafana Cloud probe.

```
Endpoint  https://www.hexaconverter.com/api/health
Interval  60s
Regions   at least two
Healthy   HTTP 200 AND body contains "\"status\":\"ok\""
```

Match on the body, not just the status code. `degraded` also returns 200, and a
partially broken deployment should not read as green.

For the cron sweeps, use a dead-man's switch — Healthchecks.io or similar. Add a
ping to the end of the job so _not_ running raises the alert:

```cron
0 * * * * curl -fsS -X POST http://127.0.0.1:3000/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET" \
  && curl -fsS https://hc-ping.com/YOUR-UUID
```

This is the only pattern that catches a scheduler that stopped, which is how
retention and backups actually fail.

---

## Error tracking

Nothing is wired in — no third-party SDK ships in the bundle, which is
deliberate given the privacy claims on the marketing pages. If you add Sentry:

```bash
npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs
```

Two things to get right, or you will undo a guarantee the site makes:

1. **Add the ingest host to the CSP** in `next.config.mjs`. `connect-src 'self'`
   will block it silently otherwise.
2. **Do not send file contents or filenames.** Filenames are user data. Scrub
   `beforeSend`, and keep the same redaction list the logger uses.

The application log records conversion lifecycle events with a salted IP hash
rather than the address. There is no audit table and no account activity to
audit: the service holds nothing that identifies a person.

---

## Runbook

**`/api/health` returns 503**

```bash
curl -s https://www.hexaconverter.com/api/health | jq .checks   # which check failed?
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 web
```

`database` failing: check the provider's status, connection limits (a pooler
exhausted by too many replicas is common), and that credentials still work.
`storage` failing: check the bucket exists, the keys are valid, and the endpoint
is right.

**Queue is backing up**

```bash
docker compose -f docker-compose.prod.yml ps worker
docker compose -f docker-compose.prod.yml logs --tail=200 worker
```

Worker dead → restart it. Worker alive but slow → scale out:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --scale worker=3
```

Keep `WORKER_CONCURRENCY × replicas` at or below the host's core count.

**One format is failing and others are not**

Almost always missing tooling, and `/api/health` will say so. Check
`checks.libreoffice` / `checks.poppler`. In Docker this means the image changed;
on a host, that a package was removed. `/api/formats` reflects it immediately, so
users see the route as unavailable rather than getting failures.

**Files are not being deleted**

```sql
SELECT count(*) FROM "File" WHERE "expiresAt" < now() AND status <> 'DELETED';
```

Non-zero and rising means the retention sweep is not running. Trigger it by hand,
then fix the scheduler:

```bash
curl -fsS -X POST https://www.hexaconverter.com/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

**Disk filling on the worker**

Conversions use scratch space and clean up after themselves; a crashed encode
can leave a temp file behind.

```bash
docker compose exec worker df -h /tmp
docker system prune -f --filter 'until=168h'
```

**After any deploy**

```bash
curl -s https://www.hexaconverter.com/api/health | jq
docker compose -f docker-compose.prod.yml logs --tail=50 web | jq -c 'select(.level=="error")'
```

Then convert one real file and confirm it downloads.
