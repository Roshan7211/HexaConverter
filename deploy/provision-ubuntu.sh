#!/usr/bin/env bash
#
# Provisions a bare Ubuntu server to run HexaConverter under PM2, without
# Docker. Written against Ubuntu 24.04 and 26.04.
#
#   sudo bash deploy/provision-ubuntu.sh
#
# Safe to re-run: every step checks before acting, and it never overwrites an
# existing .env or database.
#
# What it deliberately does NOT do, because both need a decision or working
# DNS, and getting them wrong is expensive:
#
#   * issue a TLS certificate  — needs DNS already pointing here, or the cert
#                                copied from the server being replaced
#   * change DNS               — the cutover should be yours to time
#
set -euo pipefail

APP_USER=hexaapp
APP_DIR=/srv/hexaconverter
REPO=${REPO:-https://github.com/Roshan7211/HexaConverter.git}
APP_URL=${APP_URL:-https://www.hexaconverter.com}
DB_NAME=hexaconverter
DB_USER=hexa

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

# --- Swap ------------------------------------------------------------------
# Even with enough RAM, `next build` peaks well above steady state. Swap turns
# an OOM kill — which lands on an arbitrary process, often Postgres — into a
# slow minute.
log "Swap"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "  4G swapfile created"
else
  echo "  already present"
fi

# --- Firewall --------------------------------------------------------------
# SSH first, or enabling this locks you out. Postgres and the app port stay
# closed: both are reached only over loopback.
log "Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -6

# --- Packages --------------------------------------------------------------
# The fonts are not optional: without them LibreOffice substitutes silently and
# converted documents come out with the wrong glyphs and wrong line breaks.
log "Packages (10-15 minutes)"
apt-get update -qq
apt-get install -y --no-install-recommends \
  nodejs npm git curl ca-certificates \
  postgresql postgresql-contrib \
  nginx certbot python3-certbot-nginx \
  libreoffice-writer libreoffice-calc libreoffice-impress \
  libreoffice-core libreoffice-common default-jre-headless \
  poppler-utils ghostscript \
  fonts-liberation2 fonts-dejavu-core fonts-noto-core fonts-noto-cjk
fc-cache -f >/dev/null

node_major=$(node -v | sed 's/v\([0-9]*\).*/\1/')
[ "$node_major" -ge 22 ] || { echo "Node >= 22 required, found $(node -v)"; exit 1; }

for bin in soffice pdftoppm gs psql; do
  command -v "$bin" >/dev/null || { echo "MISSING: $bin"; exit 1; }
done
echo "  node $(node -v), all conversion binaries present"

# --- Service user ----------------------------------------------------------
# Conversions run external binaries over files supplied by strangers. An
# unprivileged account is what bounds the damage if one of them has a parser
# bug.
log "Service user"
id "$APP_USER" >/dev/null 2>&1 || adduser --system --group --home "$APP_DIR" "$APP_USER"
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# --- Database --------------------------------------------------------------
log "Database"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  echo "  role $DB_USER already exists, leaving it alone"
  DB_PASS=""
else
  # Hex only. A password containing % + / @ : or ? has to be percent-encoded
  # inside the URL, and the resulting parse failure looks exactly like a wrong
  # password.
  DB_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -qc "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  echo "  created role and database"
fi

# --- Code ------------------------------------------------------------------
log "Code"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  sudo -u "$APP_USER" git clone "$REPO" "$APP_DIR"
fi
sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1

# --- Configuration ---------------------------------------------------------
log "Configuration"
if [ -f "$APP_DIR/.env" ]; then
  echo "  .env exists, not touching it"
else
  [ -n "$DB_PASS" ] || { echo "  .env is missing but the DB role already existed."; \
    echo "  Set the password by hand, or drop the role and re-run."; exit 1; }

  sudo -u "$APP_USER" tee "$APP_DIR/.env" >/dev/null <<EOF
NODE_ENV=production

# Compiled into the bundle at build time. Changing it needs a rebuild, not a
# restart — a stale value publishes canonical URLs for the wrong host.
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_APP_NAME=HexaConverter

DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public
DIRECT_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public

DOWNLOAD_URL_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)

STORAGE_DRIVER=local
ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true
STORAGE_LOCAL_DIR=$APP_DIR/storage

MAX_UPLOAD_BYTES=536870912
FILE_RETENTION_HOURS=168

WORKER_ENABLED=true
# At or below the core count: each slot can spawn an ffmpeg or soffice child
# that saturates a core.
WORKER_CONCURRENCY=$(( $(nproc) > 2 ? 2 : 1 ))

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=no-reply@hexaconverter.com
CONTACT_INBOX=info@hexaconverter.com
EOF
  chmod 600 "$APP_DIR/.env"
  echo "  .env written"
fi

mkdir -p "$APP_DIR/storage"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/storage"

# --- Build -----------------------------------------------------------------
# The heap cap is raised deliberately: Node sizes it from available memory and
# lands below what a 280-page build needs, then aborts with a heap error while
# swap sits unused.
log "Build (several minutes)"
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" env NODE_OPTIONS="--max-old-space-size=3072" npm run build
sudo -u "$APP_USER" npx prisma migrate deploy

# --- Process manager -------------------------------------------------------
# One process that serves and converts. Splitting them needs
# /api/cron/process scheduled, because the worker's lazy start only fires in
# the process that accepted the job — see src/services/jobs/worker.ts.
log "PM2"
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null
total_mb=$(free -m | awk '/^Mem:/{print $2}')
web_mem=$(( total_mb > 3000 ? 2000 : 1200 ))

sudo -u "$APP_USER" pm2 delete all >/dev/null 2>&1 || true
sudo -u "$APP_USER" env \
  WEB_WORKER_ENABLED=true \
  WEB_INSTANCES=1 \
  WEB_MAX_MEMORY="${web_mem}M" \
  pm2 start ecosystem.config.cjs --only hexaconverter-web --env production
sudo -u "$APP_USER" pm2 save
pm2 startup systemd -u "$APP_USER" --hp "$APP_DIR" | tail -1 | bash || true

# --- Nginx -----------------------------------------------------------------
log "Nginx"
mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot
cp "$APP_DIR/deploy/nginx/hexaconverter.conf" /etc/nginx/sites-available/hexaconverter
ln -sf /etc/nginx/sites-available/hexaconverter /etc/nginx/sites-enabled/hexaconverter
rm -f /etc/nginx/sites-enabled/default

# brotli is not in stock Nginx and there are no optional directives: an absent
# module fails the whole config. The block wraps across lines, so the range
# must run to the terminator or the orphaned arguments fail the same way.
if ! nginx -t >/dev/null 2>&1; then
  if apt-get install -y libnginx-mod-brotli >/dev/null 2>&1 && nginx -t >/dev/null 2>&1; then
    echo "  brotli module installed"
  else
    sed -i '/brotli[[:space:]]*on;/,/manifest+json;/ s/^/# /' \
      /etc/nginx/sites-available/hexaconverter
    echo "  brotli directives commented out (gzip still active)"
  fi
fi
nginx -t

# --- Retention -------------------------------------------------------------
# This is what makes the deletion promise in the privacy policy true. Nothing
# else triggers it.
log "Retention sweep"
SECRET=$(grep '^CRON_SECRET=' "$APP_DIR/.env" | cut -d= -f2)
crontab -l 2>/dev/null | grep -v '/api/cron/cleanup' | crontab - || true
(crontab -l 2>/dev/null; \
  echo "0 * * * * curl -fsS -X POST -H \"Authorization: Bearer $SECRET\" http://127.0.0.1:3000/api/cron/cleanup >/dev/null 2>&1") | crontab -
echo "  scheduled hourly"

# --- Done ------------------------------------------------------------------
log "Provisioned"
sudo -u "$APP_USER" pm2 status
echo
curl -s http://127.0.0.1:3000/api/health || echo "  app not answering yet — check: pm2 logs"
cat <<'EOF'


Nginx is configured but NOT started, because it needs a certificate.

  Moving from another server (no downtime):
    rsync -a OLD:/etc/letsencrypt/ /etc/letsencrypt/
    systemctl enable --now nginx
    curl -sI --resolve www.hexaconverter.com:443:127.0.0.1 https://www.hexaconverter.com
    # then switch DNS

  Fresh, with DNS already pointing here:
    certbot certonly --standalone -d hexaconverter.com -d www.hexaconverter.com \
      --agree-tos -m info@hexaconverter.com --no-eff-email
    systemctl enable --now nginx

Then set renewal to webroot, or it fails in 60 days with nginx holding port 80:

  sed -i 's/^authenticator = standalone/authenticator = webroot/' \
    /etc/letsencrypt/renewal/hexaconverter.com.conf
  grep -q webroot_path /etc/letsencrypt/renewal/hexaconverter.com.conf || \
    sed -i '/^\[renewalparams\]/a webroot_path = /var/www/certbot,' \
      /etc/letsencrypt/renewal/hexaconverter.com.conf
  certbot renew --dry-run
EOF
