# Backup strategy

- [What is worth backing up](#what-is-worth-backing-up)
- [PostgreSQL](#postgresql)
- [Object storage](#object-storage)
- [Secrets](#secrets)
- [Restore drills](#restore-drills)
- [Disaster recovery](#disaster-recovery)

---

## What is worth backing up

Not everything here is equally precious, and treating it as if it were wastes
money and attention.

| Data                        | Recoverable?                   | Backup                                      |
| --------------------------- | ------------------------------ | ------------------------------------------- |
| PostgreSQL                  | **No**                         | Daily + PITR. The only irreplaceable thing. |
| Secrets (`.env.production`) | **No**                         | Secret manager, offline copy                |
| Converted files in S3       | Yes — expire in ≤ 168 h anyway | None needed                                 |
| Uploaded source files       | Yes — deleted on completion    | None needed                                 |
| Docker images               | Yes                            | GHCR keeps them; digests pinned             |
| Application code            | Yes                            | Git                                         |

**The user files are deliberately not backed up.** Every object has an
`expiresAt` and the retention sweep deletes it — usually within hours. Backing
them up would mean keeping user files _longer_ than the privacy policy promises,
which turns a backup into a liability. The database rows survive the files by
design: history stays readable, with the file marked `DELETED`.

So the backup strategy is really two things: **the database, and the secrets.**

---

## PostgreSQL

### Use managed Postgres

Supabase, Neon, RDS and Cloud SQL all give you automated daily backups and
point-in-time recovery with no scripts to maintain. Turn PITR on and confirm the
retention window is what you think it is.

This is the single strongest recommendation in this document. Owning Postgres
backups yourself means owning WAL archiving, retention pruning, off-host copies,
encryption and restore testing — every one of which fails silently.

### If you self-host it

Nightly logical dump, retained 30 days, with the copy off the database host:

```bash
#!/usr/bin/env bash
# /usr/local/bin/hexa-backup.sh  —  chmod 700, run as postgres
set -euo pipefail

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST=/var/backups/hexaconverter
mkdir -p "$DEST"

# --format=custom is compressed and restorable table-by-table, which a plain
# SQL dump is not.
pg_dump --format=custom --no-owner --no-privileges \
        --file="$DEST/hexa-$STAMP.dump" "$DATABASE_URL"

# Encrypt before it leaves the host. A database dump is every user's email
# address and password hash.
age -r "$AGE_PUBLIC_KEY" -o "$DEST/hexa-$STAMP.dump.age" "$DEST/hexa-$STAMP.dump"
rm "$DEST/hexa-$STAMP.dump"

aws s3 cp "$DEST/hexa-$STAMP.dump.age" "s3://$BACKUP_BUCKET/postgres/"

# Prune local copies; the bucket's lifecycle rule handles the remote side.
find "$DEST" -name '*.dump.age' -mtime +7 -delete

echo "backup complete: hexa-$STAMP.dump.age"
```

```cron
30 3 * * * /usr/local/bin/hexa-backup.sh >> /var/log/hexa-backup.log 2>&1
```

Four things people skip, in the order they cause pain:

1. **Off-host.** A backup on the machine that dies is not a backup.
2. **Encrypted.** The dump contains every email address and password hash.
3. **Monitored.** A cron job that has silently failed for six weeks is the
   normal way backups fail. Alert on _absence_ — see
   [MONITORING.md](./MONITORING.md).
4. **Tested.** See below.

### Retention

| Age         | Keep                           |
| ----------- | ------------------------------ |
| 0–7 days    | Every nightly dump             |
| 7–30 days   | One per week                   |
| 30–365 days | One per month                  |
| PITR        | As long as the provider allows |

Enforce it with an S3 lifecycle rule rather than a script, so it keeps working
when the script does not.

---

## Object storage

No backup. Do configure two things:

**Versioning** on the bucket, with a short expiry. It converts an accidental
mass delete from permanent to recoverable, without accumulating data.

**A lifecycle rule** as a safety net beneath the application's own sweep:

```json
{
  "Rules": [
    {
      "ID": "expire-orphans",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "Expiration": { "Days": 14 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 7 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }
  ]
}
```

Set `Days` comfortably above `FILE_RETENTION_HOURS` (168 h = 7 days). This is not
the primary mechanism — the retention sweep is — it exists to catch objects the
application lost track of, and to stop abandoned multipart uploads billing you
forever.

---

## Secrets

`.env.production` is unrecoverable and losing it is worse than losing a
database backup, because without it a restored database is useless.

Keep it in a real secret manager (1Password, Vaultwarden, AWS Secrets Manager)
with one offline copy. Store the age/GPG key used for backup encryption
**somewhere other than the backup bucket** — encrypting your backups with a key
you only kept in the backups is a complete loss.

Rotation, and what each rotation costs:

| Secret                | On rotation                                                     |
| --------------------- | --------------------------------------------------------------- |
| `DOWNLOAD_URL_SECRET` | Outstanding download links break; upload tickets in flight fail |
| `CRON_SECRET`         | Update the scheduler in the same change                         |
| Database password     | Percent-encode it, update `DATABASE_URL` **and** `DIRECT_URL`   |
| OAuth secrets         | Rotate at the provider first, then here                         |

`DOWNLOAD_URL_SECRET` also keys the IP hashing in audit rows. Rotating it means
old and new hashes are not comparable — correct, but it breaks continuity in
abuse investigations, so note when you did it.

---

## Restore drills

**An untested backup is a hypothesis.** Rehearse quarterly, and after any change
to the schema or the backup script.

```bash
# 1. Fresh, isolated target — never the production database.
createdb hexa_restore_test

# 2. Restore.
age -d -i ~/.age/backup-key.txt hexa-20260728T033000Z.dump.age \
  | pg_restore --dbname=hexa_restore_test --no-owner --no-privileges

# 3. Does the schema match what the code expects?
DATABASE_URL=postgresql://localhost/hexa_restore_test npx prisma migrate status

# 4. Is the data actually there?
psql hexa_restore_test -c '
  SELECT
    (SELECT count(*) FROM "User")          AS users,
    (SELECT count(*) FROM "ConversionJob") AS jobs,
    (SELECT count(*) FROM "File")          AS files,
    (SELECT max("createdAt") FROM "User")  AS newest_user;'

# 5. Does the application boot against it?
DATABASE_URL=postgresql://localhost/hexa_restore_test npm run dev
curl -s localhost:3000/api/health | jq '.checks.database'

# 6. Clean up.
dropdb hexa_restore_test
```

Record the date, the dump restored, the row counts, and how long it took.
**Recovery time is a number you should know before you need it**, not discover
during an outage.

`prisma migrate status` in step 3 is the step that catches the nasty case: a
dump older than your current migrations restores fine and then fails at runtime
on a missing column.

---

## Disaster recovery

Targets worth writing down and then measuring against:

|                                       | Target                                           |
| ------------------------------------- | ------------------------------------------------ |
| **RPO** (data you can afford to lose) | ≤ 5 min with PITR; ≤ 24 h on nightly dumps alone |
| **RTO** (time to be serving again)    | ≤ 1 h                                            |

### Total loss of the application host

Low severity — the host is disposable.

```bash
# On a new box:
sudo mkdir -p /srv/hexaconverter && cd /srv/hexaconverter
# restore .env.production from the secret manager, chmod 600
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
# repoint DNS
```

No data is on that machine. In-flight conversions are lost, and that is handled:
the stale-lease sweep reclaims jobs whose worker vanished, so they are retried
rather than stuck.

### Loss of the database

The severe case.

1. Provision a new instance.
2. Restore the newest verified dump, or PITR to just before the incident.
3. `npx prisma migrate status`, then `migrate deploy` if it is behind.
4. Update `DATABASE_URL` / `DIRECT_URL`; restart.
5. `curl /api/health` — expect `database: ok`.

Expect some inconsistency between the database and the bucket: rows may
reference objects already expired, and objects may exist with no row. Neither
breaks anything. A row with a missing object surfaces as a failed download; an
object with no row is swept by the lifecycle rule.

### Compromised secrets

1. Rotate the leaked secret **first**; understand the blast radius after.
2. `DOWNLOAD_URL_SECRET` — rotating it invalidates every outstanding download
   link and upload ticket, which is the point.
3. Database password — rotate at the provider, re-encode, update both URLs.
4. Review the application log for the affected window. There are no accounts to
   sign out and no sessions to revoke.
