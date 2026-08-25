#!/bin/bash
# First-time and repeat setup on the Lightsail box. Invoked by push-to-lightsail.ps1.
set -euo pipefail

APP=/opt/forextradingconsultants
TAR=/tmp/ftc-deploy.tgz
ENV_SRC=/tmp/ftc.env.local
CADDY_SRC=/tmp/ftc-Caddyfile

if [[ ! -f "$TAR" ]]; then
  echo "missing $TAR" >&2
  exit 1
fi
if [[ ! -f "$ENV_SRC" ]]; then
  echo "missing $ENV_SRC" >&2
  exit 1
fi
if [[ ! -f "$CADDY_SRC" ]]; then
  echo "missing $CADDY_SRC" >&2
  exit 1
fi

if ! swapon --show | grep -q .; then
  echo "Adding 2G swap..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

sudo mkdir -p "$APP"
sudo chown ubuntu:ubuntu "$APP"
cd "$APP"

echo "Extracting..."
tar -xzf "$TAR"
rm -f "$TAR"

# Preserve live users/payments if this is a re-deploy; seed empty stores on first run.
mkdir -p data
if [[ ! -f data/users.json ]]; then
  printf '%s\n' '{ "users": [] }' > data/users.json
fi
if [[ ! -f data/payments.json ]]; then
  printf '%s\n' '{ "payments": [] }' > data/payments.json
fi
chmod 700 data
chmod 600 data/*.json 2>/dev/null || true

# Never keep a LIVE_SITE_URL on the public box.
install -m 600 "$ENV_SRC" "$APP/.env.local"
rm -f "$ENV_SRC"
if grep -q '^LIVE_SITE_URL=' "$APP/.env.local"; then
  echo "Refusing to keep LIVE_SITE_URL on the server" >&2
  sed -i '/^LIVE_SITE_URL=/d' "$APP/.env.local"
fi

echo "Installing npm packages..."
npm ci

echo "Building Next.js (this can take several minutes on 1GB)..."
export NODE_OPTIONS=--max-old-space-size=1536
npm run build
npm prune --omit=dev

if [[ -f "$CADDY_SRC" ]]; then
  echo "Updating Caddy..."
  sudo cp "$CADDY_SRC" /etc/caddy/Caddyfile
  rm -f "$CADDY_SRC"
  sudo caddy validate --config /etc/caddy/Caddyfile
  sudo systemctl reload caddy
fi

echo "Starting app with PM2..."
if pm2 describe forextradingconsultants >/dev/null 2>&1; then
  pm2 restart forextradingconsultants --update-env
else
  pm2 start "$APP/ecosystem.config.cjs"
fi
pm2 save

echo "Waiting for Next to listen..."
ok=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 5
  code=$(curl -sS -o /tmp/ftc-health.out -w '%{http_code}' --max-time 8 http://127.0.0.1:3000/ || true)
  if [[ "$code" == "200" ]]; then
    ok=1
    break
  fi
  echo "health attempt $i -> HTTP $code"
done

pm2 list
free -h
if [[ "$ok" != "1" ]]; then
  echo "App did not return HTTP 200 on :3000" >&2
  pm2 logs forextradingconsultants --lines 40 --nostream || true
  exit 1
fi
echo "Local health OK"
head -c 200 /tmp/ftc-health.out; echo
rm -f /tmp/ftc-setup.sh
