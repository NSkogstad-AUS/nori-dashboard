#!/usr/bin/env bash
# One-shot local dev setup for Nori. Safe to re-run — every step is idempotent.
#
# Does NOT start docker-compose Postgres by default: this machine has a native Postgres
# install that already binds port 5432, so docker-compose's container silently loses that
# port and DATABASE_URL ends up pointing at the wrong server (see plan/PHASE_3_PLAN.md's
# session log for how this was diagnosed). Pass --docker to use docker-compose instead if
# you don't have a conflicting native Postgres.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

USE_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --docker) USE_DOCKER=true ;;
    -h|--help)
      echo "Usage: scripts/setup.sh [--docker]"
      echo "  --docker   Use docker-compose Postgres instead of a native install on port 5432."
      exit 0
      ;;
  esac
done

echo "==> Installing dependencies"
npm install

echo "==> Setting up .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created .env from .env.example"
else
  echo "    .env already exists, leaving it as-is"
fi

DB_NAME="nori"
DB_USER="nori"
DB_PASS="nori"
DB_HOST="localhost"
DB_PORT="5432"
DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if [ "$USE_DOCKER" = true ]; then
  echo "==> Starting Postgres via docker-compose"
  docker compose up -d
  echo "    waiting for Postgres to accept connections..."
  for _ in $(seq 1 20); do
    if docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "==> Ensuring a local '${DB_USER}' role/database exist on your native Postgres (port ${DB_PORT})"
  if ! command -v psql > /dev/null 2>&1; then
    echo "    psql not found on PATH — creating the role/database via the postgres npm package instead"
    node --input-type=module -e "
      import postgres from 'postgres';
      const sql = postgres({ host: '${DB_HOST}', port: ${DB_PORT}, database: 'postgres' });
      try {
        const [roleExists] = await sql\`select 1 from pg_roles where rolname = '${DB_USER}'\`;
        if (!roleExists) {
          await sql.unsafe(\"create role ${DB_USER} with login password '${DB_PASS}'\");
          console.log('    created role ${DB_USER}');
        } else {
          console.log('    role ${DB_USER} already exists');
        }
        const [dbExists] = await sql\`select 1 from pg_database where datname = '${DB_NAME}'\`;
        if (!dbExists) {
          await sql.unsafe('create database ${DB_NAME} owner ${DB_USER}');
          console.log('    created database ${DB_NAME}');
        } else {
          console.log('    database ${DB_NAME} already exists');
        }
      } finally {
        await sql.end();
      }
    "
  else
    if ! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres -tAc "select 1 from pg_roles where rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
      psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -c "create role ${DB_USER} with login password '${DB_PASS}';"
    fi
    if ! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres -tAc "select 1 from pg_database where datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
      psql -h "$DB_HOST" -p "$DB_PORT" -d postgres -c "create database ${DB_NAME} owner ${DB_USER};"
    fi
  fi
fi

# Make sure .env's DATABASE_URL actually points at the database we just set up, without
# clobbering a value the user deliberately customized to something else.
if grep -q '^DATABASE_URL=$' .env 2>/dev/null || ! grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  if grep -q '^DATABASE_URL=' .env 2>/dev/null; then
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env && rm -f .env.bak
  else
    echo "DATABASE_URL=${DATABASE_URL}" >> .env
  fi
  echo "    set DATABASE_URL in .env"
fi

# Next.js only reads env files from apps/web itself, not the monorepo root's .env — so
# `npm run dev:web` never sees the root .env's DATABASE_URL on its own. Mirror it into
# apps/web/.env.local (also where `npx clerk@latest init`, run from apps/web, writes Clerk's
# keys — see the instructions below), without clobbering anything else already in that file.
mkdir -p apps/web
touch apps/web/.env.local
if grep -q '^DATABASE_URL=' apps/web/.env.local 2>/dev/null; then
  sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" apps/web/.env.local && rm -f apps/web/.env.local.bak
else
  {
    echo ""
    echo "# Mirrored from the root .env by scripts/setup.sh — Next.js only reads env files from"
    echo "# apps/web itself, not the monorepo root."
    echo "DATABASE_URL=${DATABASE_URL}"
  } >> apps/web/.env.local
fi
echo "    set DATABASE_URL in apps/web/.env.local"

echo "==> Running database migrations"
set -a
# shellcheck disable=SC1091
source .env
set +a
npm run db:migrate

echo ""
echo "==> Setup mostly done. One manual step remains:"
echo ""
echo "    Clerk needs real API keys before the app will render past a 500 error."
echo "    Run this from apps/web (Clerk's CLI needs to detect the Next.js project —"
echo "    it won't work from the repo root of this monorepo):"
echo ""
echo "        cd apps/web && npx clerk@latest init && cd ../.."
echo ""
echo "    This writes NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY into"
echo "    apps/web/.env.local (not the root .env). Once that's done:"
echo ""
echo "        npm run dev:web"
echo ""
echo "    then open http://localhost:3000 — sign in, create/select an Organization"
echo "    (that becomes your workspace), and you're in."
