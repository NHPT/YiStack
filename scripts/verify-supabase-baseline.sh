#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="yistack-r7-postgres-$$"
POSTGRES_IMAGE="${YISTACK_POSTGRES_IMAGE:-docker.io/library/postgres:16-alpine}"
POSTGRES_PASSWORD="${YISTACK_POSTGRES_TEST_PASSWORD:-yistack-r7-local-only}"
DATABASE_USER="${YISTACK_POSTGRES_USER:-postgres}"

cleanup() {
  podman rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[R7] Starting isolated PostgreSQL baseline container..."
podman run --name "$CONTAINER_NAME" \
  --env "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
  --env POSTGRES_DB=yistack \
  --detach "$POSTGRES_IMAGE" >/dev/null

ready=false
for _ in $(seq 1 60); do
  if podman exec "$CONTAINER_NAME" pg_isready -U "$DATABASE_USER" -d yistack >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done

if [ "$ready" != "true" ]; then
  podman logs "$CONTAINER_NAME" >&2
  echo "[R7] PostgreSQL did not become ready." >&2
  exit 1
fi

echo "[R7] Installing Supabase-compatible auth contract..."
podman exec -i --env PGOPTIONS=--client-min-messages=warning "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d yistack >/dev/null <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS 'SELECT NULL::uuid';
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text LANGUAGE sql STABLE
AS 'SELECT current_user::text';
SQL

echo "[R7] Applying backend/init.sql twice..."
for _ in 1 2; do
  podman exec -i --env PGOPTIONS=--client-min-messages=warning "$CONTAINER_NAME" \
    psql -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d yistack \
    < "$ROOT_DIR/backend/init.sql" >/dev/null
done

baseline_count="$(
  podman exec "$CONTAINER_NAME" psql -At -U "$DATABASE_USER" -d yistack \
    -c "SELECT count(*) FROM public.schema_migrations WHERE version = '000000000000_contributor_alpha';"
)"
provider_contract="$(
  podman exec "$CONTAINER_NAME" psql -At -U "$DATABASE_USER" -d yistack \
    -c "SELECT count(*) || ':' || count(*) FILTER (WHERE enabled) || ':' || max(base_url) FILTER (WHERE name = 'ollama-cloud') FROM public.llm_providers;"
)"
admin_auth_contract="$(
  podman exec "$CONTAINER_NAME" psql -At -U "$DATABASE_USER" -d yistack \
    -c "SELECT must_change_password::text || ':' || auth_version || ':' || (crypt('admin123', password_hash) = password_hash)::text FROM public.admins WHERE email = 'admin@yistack.com';"
)"

if [ "$baseline_count" != "1" ]; then
  echo "[R7] Expected exactly one Contributor Alpha baseline row, got $baseline_count." >&2
  exit 1
fi
if [ "$provider_contract" != "7:0:https://ollama.com" ]; then
  echo "[R7] Unexpected minimal provider catalog: $provider_contract" >&2
  exit 1
fi
if [ "$admin_auth_contract" != "true:1:true" ]; then
  echo "[R7] Unexpected default Admin password-change contract." >&2
  exit 1
fi

echo "[R7] Verifying baseline rollback and re-apply..."
podman exec -i --env PGOPTIONS=--client-min-messages=warning "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d yistack \
  < "$ROOT_DIR/backend/migrations/rollback/000000000000_contributor_alpha.sql" >/dev/null
podman exec -i --env PGOPTIONS=--client-min-messages=warning "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d yistack \
  < "$ROOT_DIR/backend/migrations/000000000000_contributor_alpha.sql" >/dev/null

baseline_count="$(
  podman exec "$CONTAINER_NAME" psql -At -U "$DATABASE_USER" -d yistack \
    -c "SELECT count(*) FROM public.schema_migrations WHERE version = '000000000000_contributor_alpha';"
)"
if [ "$baseline_count" != "1" ]; then
  echo "[R7] Baseline re-apply failed." >&2
  exit 1
fi

echo "[R7] Supabase SQL baseline, rollback, and provider catalog passed."
