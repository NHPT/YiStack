#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/scripts/validate-yes.sh"
  "$ROOT_DIR/backend/cmd/server/main.go"
  "$ROOT_DIR/src/lib/api/index.ts"
  "$ROOT_DIR/src/app/workspace/workspace-ide-desktop-preview-panel.tsx"
  "$ROOT_DIR/src/app/workspace/workspace-ide-mobile-preview-panel.tsx"
)

echo "[SMOKE] Checking required smoke files..."
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[SMOKE] Missing required file: $file" >&2
    exit 1
  fi
done

echo "[SMOKE] Checking health API contract..."
grep -q 'api.GET("/health"' "$ROOT_DIR/backend/cmd/server/main.go"
grep -q 'export const healthApi' "$ROOT_DIR/src/lib/api/index.ts"
grep -q '"smoke:check": "bash ./scripts/smoke-check.sh"' "$ROOT_DIR/package.json"

echo "[SMOKE] Checking runtime preview smoke model..."
pnpm exec tsx "$ROOT_DIR/scripts/validate-runtime-health-diagnostics-model.ts"

echo "[SMOKE] Checking roadmap smoke sync..."
node "$ROOT_DIR/scripts/validate-roadmap-table-format.mjs"
node "$ROOT_DIR/scripts/validate-roadmap-sync.mjs"

echo "[SMOKE] Smoke check passed."
