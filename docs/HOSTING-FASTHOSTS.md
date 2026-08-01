# Hosting HexaConverter on Fasthosts

Step-by-step, for a domain **and** server both bought from Fasthosts.

Target: `https://www.hexaconverter.com`, running under Docker Compose on one
Ubuntu server, with nginx terminating TLS in front.

---

## 0. Read this before you buy anything

**Fasthosts shared/web hosting cannot run this application.** Not a limitation
worth working around — it is structurally impossible. This app:

- shells out to **LibreOffice, ffmpeg, Ghostscript and Poppler**, which shared
  hosting will not let you install;
- runs a **background worker process** that must stay alive between requests;
- needs **PostgreSQL**, where Fasthosts shared plans give you MySQL;
- runs conversions for **minutes**, past any shared-hosting CGI timeout.

You need a product with **root access on Ubuntu**. In the Fasthosts catalogue
that means a **Cloud Server / VPS** or a **Dedicated Server**. If what you
already bought is "Web Hosting", "WordPress Hosting" or anything administered
through Plesk, you will have to add a Cloud Server. The domain is fine either
way — domains are independent of the hosting product.

### Sizing

| Load                  | vCPU | RAM   | Disk       |
| --------------------- | ---- | ----- | ---------- |
| Testing / low traffic | 2    | 4 GB  | 60 GB SSD  |
| Real traffic          | 4    | 8 GB  | 100 GB SSD |
| Video-heavy           | 8    | 16 GB | 200 GB SSD |

LibreOffice and ffmpeg set the memory floor, not Node. Conversions are
CPU-bound, so cores buy throughput. Disk must hold uploads plus outputs for the
full 168-hour retention window.

Choose **Ubuntu 24.04 LTS**.

---

## 1. Create the server

1. Fasthosts control panel → **Cloud Servers** (or **Servers**) → create a new
   server.
2. Operating system: **Ubuntu 24.04 LTS**.
3. Pick the size from the table above.
4. Add your **SSH public key** during creation. If you do not have one:
   ```bash
   ssh-keygen -t ed25519 -C "you@example.com"
   cat ~/.ssh/id_ed25519.pub     # paste this into Fasthosts
   ```
5. Note the server's **public IPv4 address** (and IPv6 if given).

---

## 2. Point the domain at the server

In the Fasthosts panel → **Domains** → `hexaconverter.com` → **DNS / Advanced
DNS**.

Delete any existing `A` record for `@` and `www` that points at their parking
or shared-hosting IP, then add:

| Type | Host / Name | Value              | TTL |
| ---- | ----------- | ------------------ | --- |
| A    | `@`         | _your server IPv4_ | 300 |
| A    | `www`       | _your server IPv4_ | 300 |

Add `AAAA` records for the same two hosts if your server has IPv6.

> Use a low TTL (300) until you have verified everything, then raise it to 3600.

Do **not** use a Fasthosts "web forwarding" / redirect feature — it will
intercept the domain before it reaches your server.

Check propagation before continuing:

```bash
dig +short hexaconverter.com
dig +short www.hexaconverter.com
```

Both must return your server's IP. Wait until they do — TLS issuance in step 7
will fail otherwise.

---

## 3. First login and basic hardening

```bash
ssh root@YOUR_SERVER_IP

# Create a non-root user with sudo
adduser hexa
usermod -aG sudo hexa
rsync --archive --chown=hexa:hexa ~/.ssh /home/hexa

# Disable password and root SSH login
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

Reconnect as the new user and confirm it works **before** closing the root
session:

```bash
ssh hexa@YOUR_SERVER_IP
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

Postgres (5432) and the app (3000) are deliberately **not** opened — both are
reached only from inside the server.

---

## 4. Install Docker

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
docker run --rm hello-world      # must succeed
```

---

## 5. Get the code onto the server

```bash
sudo mkdir -p /srv/hexaconverter
sudo chown $USER:$USER /srv/hexaconverter
cd /srv/hexaconverter

git clone YOUR_REPO_URL .
# or: scp -r ./HexaConverter\ Website/* hexa@YOUR_SERVER_IP:/srv/hexaconverter/
```

---

## 6. Configure the environment

```bash
cp .env.production.example .env.production
chmod 600 .env.production

# Generate the two secrets — never reuse development values
echo "DOWNLOAD_URL_SECRET=$(openssl rand -hex 32)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"

nano .env.production
```

Set at minimum:

```ini
NODE_ENV=production

# Must match the canonical host in nginx. Inlined at BUILD time — changing it
# later requires a rebuild, not a restart.
NEXT_PUBLIC_APP_URL=https://www.hexaconverter.com
NEXT_PUBLIC_APP_NAME=HexaConverter

# Image tag built locally on this box (no registry in the loop).
IMAGE=hexaconverter:local

# Postgres runs alongside the app via the single-server overlay. The host
# `postgres` is the compose service name, not a public address.
POSTGRES_USER=hexa
POSTGRES_PASSWORD=<from above>
POSTGRES_DB=hexaconverter
DATABASE_URL=postgresql://hexa:THE_PASSWORD@postgres:5432/hexaconverter?schema=public
DIRECT_URL=postgresql://hexa:THE_PASSWORD@postgres:5432/hexaconverter?schema=public

DOWNLOAD_URL_SECRET=<from above>
CRON_SECRET=<from above>

# Single server with a persistent volume: local storage is correct here, and
# the opt-in is required because a local directory is not shared between
# replicas. Add a second app server later and you must move to S3.
STORAGE_DRIVER=local
ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true
STORAGE_LOCAL_DIR=/var/lib/hexaconverter/storage

MAX_UPLOAD_BYTES=536870912
FILE_RETENTION_HOURS=168
WORKER_ENABLED=true
WORKER_CONCURRENCY=2

# Contact form delivery. Use the Fasthosts mailbox for hexaconverter.com,
# or any SMTP provider. Leave SMTP_HOST blank and messages are stored but
# never delivered.
SMTP_HOST=smtp.fasthosts.co.uk
SMTP_PORT=587
SMTP_USER=info@hexaconverter.com
SMTP_PASSWORD=<mailbox password>
MAIL_FROM=no-reply@hexaconverter.com
CONTACT_INBOX=info@hexaconverter.com
```

> **Password encoding.** If the Postgres password contains `% + / @ : ?` it must
> be percent-encoded inside the URL, or it will not parse and the failure looks
> exactly like a wrong password:
> `node -e "console.log(encodeURIComponent('PASSWORD'))"`

Converted files live on a Docker named volume (`storage`) created by the
single-server overlay, so there is no host directory to create or chown.
`STORAGE_LOCAL_DIR` is the path _inside_ the container.

---

## 7. TLS certificate

Issue the certificate **before** starting nginx with the TLS config, otherwise
nginx fails to start on missing cert files.

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone \
  -d hexaconverter.com -d www.hexaconverter.com \
  --agree-tos -m info@hexaconverter.com --no-eff-email
```

Port 80 must be free and DNS must already resolve (step 2). Verify:

```bash
sudo ls /etc/letsencrypt/live/hexaconverter.com/
```

Renewal is automatic via certbot's systemd timer. Confirm:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

---

## 8. Build and start

`docker-compose.prod.yml` alone expects a prebuilt image from a registry and
managed Postgres. For one box, layer the single-server overlay on top — it adds
the local build, a bundled Postgres and the persistent storage volume.

Define the command once so you cannot forget a flag:

```bash
cd /srv/hexaconverter

cat >> ~/.bashrc <<'EOF'
alias hexa='docker compose -f /srv/hexaconverter/docker-compose.prod.yml -f /srv/hexaconverter/deploy/single-server/compose.override.yml --env-file /srv/hexaconverter/.env.production'
EOF
source ~/.bashrc

hexa build            # first build pulls LibreOffice etc. — expect 5-15 min
hexa up -d
hexa ps
```

Migrations run automatically: the `migrate` service executes
`prisma migrate deploy` and must exit successfully before `web` or `worker`
start. Confirm it did:

```bash
hexa logs migrate
```

Watch the app come up:

```bash
hexa logs -f web
```

Smoke-test from the server itself, before nginx is involved:

```bash
curl -s http://127.0.0.1:3000/api/health | head -c 400
```

The web tier publishes on `127.0.0.1:3000` only — it is not reachable from
outside the box until nginx proxies to it.

You want `"status":"ok"`. `"database":"down"` means `DATABASE_URL` is wrong;
`"storage":"down"` means the volume permissions are wrong.

---

## 9. nginx

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx/hexaconverter.conf /etc/nginx/sites-available/hexaconverter
sudo ln -sf /etc/nginx/sites-available/hexaconverter /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t          # must pass before reloading
sudo systemctl reload nginx
```

The shipped config already:

- redirects `http` → `https` and the bare domain → `www`;
- sets `client_max_body_size 512m` to match `MAX_UPLOAD_BYTES` (a mismatch
  shows up as an unexplained 413 on large uploads);
- proxies to `127.0.0.1:3000` with long timeouts on the upload and download
  routes.

---

## 10. Schedule the background jobs

The retention sweep is what makes the deletion promises in the privacy policy
true. **Nothing else triggers it.**

**This is already handled.** The stack includes a `cron` service that calls
`/api/cron/cleanup` hourly, and the `worker` service drains the conversion
queue continuously. You do not need a host crontab for either.

Verify the sweep is actually running before you consider the deploy done:

```bash
hexa ps cron              # should be Up
hexa logs cron | tail -20 # no 'cleanup sweep failed' lines
```

If you ever set `WORKER_ENABLED=false`, you must then schedule
`/api/cron/process` yourself, or conversions will queue and never run.

---

## 11. Verify the live site

```bash
curl -sI https://www.hexaconverter.com | head -1                 # 200
curl -sI https://hexaconverter.com | grep -i location            # -> www
curl -sI http://www.hexaconverter.com | grep -i location         # -> https
curl -s  https://www.hexaconverter.com/api/health | head -c 200  # status ok
curl -s  https://www.hexaconverter.com/sitemap.xml | grep -c '<loc>'
curl -sI https://www.hexaconverter.com/favicon.ico | head -1     # 200
curl -sI https://www.hexaconverter.com | grep -i strict-transport
```

Then in a browser:

- convert a small PNG → JPG and download the result;
- merge two PDFs;
- upload a file larger than 100 MB to exercise the chunked upload path;
- submit the contact form and confirm the mail arrives.

Check the sitemap contains `https://www.hexaconverter.com/...` and **not**
`localhost`. If it says localhost, `NEXT_PUBLIC_APP_URL` was not set at build
time — rebuild with the `--build-arg`.

---

## 12. Backups

The database and the storage directory are the only stateful things.

```bash
sudo mkdir -p /var/backups/hexaconverter
sudo crontab -e
```

```cron
15 3 * * * cd /srv/hexaconverter && docker compose -f docker-compose.prod.yml -f deploy/single-server/compose.override.yml --env-file .env.production exec -T postgres pg_dump -U hexa hexaconverter | gzip > /var/backups/hexaconverter/db-$(date +\%F).sql.gz
30 3 * * * find /var/backups/hexaconverter -name 'db-*.sql.gz' -mtime +14 -delete
```

The converted files themselves are deliberately **not** backed up: everything in
that volume is deleted within 168 hours by design, and archiving it would
contradict the privacy policy.

Copy backups **off** the server — a backup on the same disk is not a backup.
See [BACKUP.md](./BACKUP.md).

---

## Updating later

```bash
cd /srv/hexaconverter
git pull
hexa build
hexa up -d          # migrate runs first and gates web/worker
hexa logs migrate   # confirm the schema step succeeded
```

---

## Troubleshooting

| Symptom                            | Cause                                                                 |
| ---------------------------------- | --------------------------------------------------------------------- |
| 502 Bad Gateway                    | Web container not running. `hexa logs web`.                           |
| 413 on upload                      | `client_max_body_size` below `MAX_UPLOAD_BYTES`.                      |
| Sitemap/canonical say `localhost`  | Built without `NEXT_PUBLIC_APP_URL`. Rebuild with the build arg.      |
| certbot fails                      | DNS not propagated, or port 80 blocked/occupied.                      |
| `"database":"down"` in health      | Wrong `DATABASE_URL`, or password not percent-encoded.                |
| `"storage":"down"` in health       | `/var/lib/hexaconverter/storage` not owned by uid 1001.               |
| Office conversions fail only       | LibreOffice missing — you are not on the Docker image.                |
| Conversions queue but never finish | `worker` service down. `hexa ps worker`, `hexa logs worker`.          |
| Files never deleted after 168h     | `cron` service down. `hexa logs cron`.                                |
| `migrate` exits non-zero           | Bad `DATABASE_URL`, or Postgres not healthy yet. `hexa logs migrate`. |

---

## If you must stay on Fasthosts shared hosting

You cannot. The honest options are:

1. Add a Fasthosts **Cloud Server** and keep the domain where it is (this guide).
2. Keep Fasthosts for the domain only, and run the server anywhere that takes a
   container — Hetzner, DigitalOcean, Fly.io, Railway. Only step 2 changes: you
   point the same DNS records at the other provider's IP.
