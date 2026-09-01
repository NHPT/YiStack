#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/verify-repository-integrity.sh"

version_ge() {
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n 1)" = "$2" ]
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[R7] Missing required command: $1" >&2
    exit 1
  fi
}

for command in git node pnpm go podman; do
  require_command "$command"
done

node_version="$(node --version | sed 's/^v//')"
pnpm_version="$(pnpm --version)"
go_version="$(go version | sed -n 's/.*go\([0-9][0-9.]*\).*/\1/p')"
podman_version="$(podman --version | sed -n 's/.*version \([0-9][0-9.]*\).*/\1/p')"

case "$node_version" in
  22.*) ;;
  *)
    echo "[R7] Node.js 22.x is required; found $node_version." >&2
    exit 1
    ;;
esac
if [ "$pnpm_version" != "11.5.2" ]; then
  echo "[R7] pnpm 11.5.2 is required; found $pnpm_version." >&2
  exit 1
fi
if ! version_ge "$go_version" "1.21.6"; then
  echo "[R7] Go 1.21.6 or newer is required; found $go_version." >&2
  exit 1
fi
if ! version_ge "$podman_version" "3.4.0"; then
  echo "[R7] Podman 3.4.0 or newer is required; found $podman_version." >&2
  exit 1
fi

if [ "$(podman info --format '{{.Host.Security.Rootless}}')" != "true" ]; then
  echo "[R7] Podman must run rootless." >&2
  exit 1
fi

if [ "${YISTACK_REQUIRE_CLEAN_TREE:-false}" = "true" ] && \
  [ -n "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=all)" ]; then
  echo "[R7] Clean-checkout verification requires an unchanged worktree." >&2
  exit 1
fi

echo "[R7] Toolchain: Node $node_version, pnpm $pnpm_version, Go $go_version, Podman $podman_version."
echo "[R7] Installing immutable Node dependencies..."
cd "$ROOT_DIR"
pnpm install --frozen-lockfile

echo "[R7] Downloading immutable Go module graph..."
cd "$ROOT_DIR/backend"
go mod download

echo "[R7] Checking repository and provider bootstrap contracts..."
cd "$ROOT_DIR"
node scripts/validate-contributor-alpha.mjs
bash scripts/verify-supabase-baseline.sh

echo "[R7] Clean-checkout dependency, Podman, Supabase SQL, and provider checks passed."
