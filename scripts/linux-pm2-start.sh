#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  cat >&2 <<'EOF'
[buyweb] pm2 is not installed.

Install it first:
  npm install -g pm2
EOF
  exit 1
fi

if [ ! -f ".env" ]; then
  cat >&2 <<'EOF'
[buyweb] .env does not exist. Create and fill it before starting production.
EOF
  exit 1
fi

mkdir -p public/uploads/contact-qr

if pm2 describe buyweb >/dev/null 2>&1; then
  pm2 restart buyweb --update-env
else
  pm2 start npm --name buyweb -- run start
fi

pm2 save

cat <<'EOF'

[buyweb] PM2 process is running.

Useful commands:
  pm2 status
  pm2 logs buyweb
  pm2 restart buyweb --update-env

To enable boot startup, run the command printed by:
  pm2 startup
EOF
