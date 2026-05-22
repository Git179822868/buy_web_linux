#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

info() {
  printf '\n[buyweb] %s\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[buyweb] Missing required command: %s\n' "$1" >&2
    return 1
  fi
}

info "Checking required commands"
missing=0
for cmd in node npm git mysql mysqldump; do
  if ! need_cmd "$cmd"; then
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  cat >&2 <<'EOF'

Install the missing tools first.

Debian/Ubuntu example:
  apt update
  apt install -y git mysql-client

Install Node.js 20+ through Baota's software store, NodeSource, or your server image.
EOF
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  printf '[buyweb] Node.js 20+ is required. Current version: %s\n' "$(node -v)" >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  cat >&2 <<'EOF'

[buyweb] .env does not exist.
Create it before continuing:

  cp .env.example .env
  nano .env

Fill DATABASE_URL, AUTH_SECRET, APP_PUBLIC_URL, payment settings, and backup settings.
This script does not create or overwrite .env automatically.
EOF
  exit 1
fi

if [ ! -d "public/uploads/contact-qr" ]; then
  info "Creating runtime upload directory"
  mkdir -p public/uploads/contact-qr
fi

info "Installing dependencies with npm ci"
npm ci

info "Generating Prisma Client for this Linux server"
npm run db:generate

info "Validating Prisma schema"
npx prisma validate

info "Running TypeScript check"
npm run typecheck

info "Running ESLint"
npm run lint

info "Running security scan"
npm run security:scan

info "Building Next.js production bundle"
npm run build

cat <<'EOF'

[buyweb] Bootstrap completed.

Next deployment steps:
  1. Run database migrations with a migration database user:
       npm run db:deploy
  2. On first deployment only, seed the admin account:
       npm run db:seed
  3. Start with PM2:
       bash scripts/linux-pm2-start.sh
  4. Configure Baota/Nginx reverse proxy to:
       http://127.0.0.1:3000
EOF
