#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="digarr-pg"
DB_USER="digarr"
DB_PASS="digarr"
DB_NAME="digarr"
DB_PORT="5432"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[0;34m%s\033[0m\n' "$*"; }

cd "$(git rev-parse --show-toplevel)"

# -- postgres ----------------------------------------------------------------

if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    green "postgres already running ($CONTAINER_NAME)"
  else
    blue "starting existing postgres container..."
    docker start "$CONTAINER_NAME"
  fi
else
  blue "creating postgres container..."
  docker run -d --name "$CONTAINER_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -e POSTGRES_DB="$DB_NAME" \
    -p "${DB_PORT}:5432" \
    postgres:17-alpine
fi

blue "waiting for postgres to accept connections..."
for i in $(seq 1 30); do
  if pg_isready -h localhost -p "$DB_PORT" -U "$DB_USER" &>/dev/null; then
    green "postgres ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    red "postgres did not start in time"
    exit 1
  fi
  sleep 1
done

# -- .env --------------------------------------------------------------------

if [ ! -f .env ]; then
  blue "creating .env from .env.example..."
  cp .env.example .env
else
  green ".env already exists"
fi

# -- deps --------------------------------------------------------------------

if [ ! -d node_modules ]; then
  blue "installing dependencies..."
  bun install
else
  green "node_modules exists (run 'bun install' manually if stale)"
fi

# -- migrations --------------------------------------------------------------

blue "running database migrations..."
DATABASE_URL="$DATABASE_URL" bun run db:migrate

green "setup complete"
echo ""
echo "start the dev servers in two terminals:"
echo ""
echo "  terminal 1 (backend):  bun run dev"
echo "  terminal 2 (frontend): bun run dev:web"
echo ""
echo "then open http://localhost:5173"
echo ""
