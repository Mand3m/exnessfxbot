#!/bin/bash
set -euo pipefail
echo "UTC $(date -u +%H:%M:%S) — waiting until 15:32 UTC for Let's Encrypt cooldown"
while [ "$(date -u +%H%M)" -lt 1532 ]; do
  date -u +%H:%M:%S
  sleep 15
done

echo "Reloading Caddy to obtain production certs"
sudo systemctl reload caddy

CERT_DIR=/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory
ok=0
for i in $(seq 1 18); do
  sleep 10
  if [ -f "$CERT_DIR/forextradingconsultants.com/forextradingconsultants.com.crt" ]; then
    echo "CERT_OK after ${i}0s"
    ok=1
    break
  fi
  echo "attempt $i"
  sudo journalctl -u caddy -n 6 --no-pager | tail -5
done

echo "CERT_DIRS"
sudo ls "$CERT_DIR" || true

echo "LOCAL"
curl -sS -o /dev/null -w "local:%{http_code}\n" --max-time 8 http://127.0.0.1:3000/

echo "HTTPS"
curl -sS -o /dev/null -w "https:%{http_code}\n" --max-time 20 https://forextradingconsultants.com/ || true
curl -sS -o /dev/null -w "https_www:%{http_code}\n" --max-time 20 https://www.forextradingconsultants.com/ || true

if [ "$ok" != "1" ]; then
  echo "Production cert not issued yet"
  sudo journalctl -u caddy -n 30 --no-pager
  exit 1
fi
