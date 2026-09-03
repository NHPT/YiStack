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
  if podman exec "$CONTAINER_NAME" \
    psql -At -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d yistack \
    -c "SELECT 1;" 2>/dev/null | grep -qx "1"; then
    ready=true
    break
  fi

  container_status="$(
    podman inspect --format '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || true
  )"
  if [ "$container_status" = "exited" ] || [ "$container_status" = "dead" ]; then
    podman logs "$CONTAINER_NAME" >&2
    echo "[R7] PostgreSQL container stopped before the yistack database became ready." >&2
    exit 1
  fi

  sleep 1
done

if [ "$ready" != "true" ]; then
  podman logs "$CONTAINER_NAME" >&2
  echo "[R7] PostgreSQL did not make the yistack database queryable." >&2
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
user_schema_contract="$(
  podman exec "$CONTAINER_NAME" psql -At -U "$DATABASE_USER" -d yistack \
    -c "SELECT data_type || ':' || is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'instance_id';"
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
if [ "$user_schema_contract" != "uuid:YES" ]; then
  echo "[R7] Unexpected users.instance_id contract: $user_schema_contract" >&2
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

echo "[R7] Verifying collaboration session, audit, and expiry RPCs..."
collaboration_contract="$(
  podman exec -i --env PGOPTIONS=--client-min-messages=warning "$CONTAINER_NAME" \
    psql -qAt -v ON_ERROR_STOP=1 -U "$DATABASE_USER" -d yistack <<'SQL'
INSERT INTO public.users (id, email, username, password_hash)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'collab-owner@example.invalid',
  'Collab Owner',
  'test-only'
);
INSERT INTO public.projects (id, user_id, project_id, name, app_type)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'collab-baseline',
  'Collaboration Baseline',
  'vite-react'
);
DO $$
BEGIN
  PERFORM public.touch_project_collaboration_session(
    '30000000-0000-0000-0000-000000000001',
    'collab-baseline',
    '10000000-0000-0000-0000-000000000001',
    'browser-client-1',
    'owner',
    'editing',
    'src/App.tsx',
    '2026-09-02T12:00:00Z',
    '2026-09-02T12:00:00Z',
    '2026-09-02T12:00:45Z',
    true,
    '40000000-0000-0000-0000-000000000001',
    'presence_joined',
    '{"role":"owner","activity":"editing"}'::jsonb
  );
  PERFORM public.expire_project_collaboration_sessions(
    'collab-baseline',
    '2026-09-02T12:00:46Z'
  );
END
$$;
SELECT
  (SELECT status FROM public.project_collaboration_sessions WHERE project_id = 'collab-baseline')
  || ':' ||
  (SELECT count(*) FROM public.project_collaboration_events WHERE project_id = 'collab-baseline')
  || ':' ||
  has_function_privilege(
    'service_role',
    'public.expire_project_collaboration_sessions(text,timestamp with time zone)',
    'EXECUTE'
  )::text;
SQL
)"
if [ "$collaboration_contract" != "expired:2:true" ]; then
  echo "[R7] Unexpected collaboration persistence contract: $collaboration_contract" >&2
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
