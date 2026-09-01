#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if git -C "$ROOT_DIR" grep -n -E '^(<<<<<<< |>>>>>>> )' -- .; then
  echo "[integrity] Unresolved Git merge conflict markers detected." >&2
  exit 1
fi

echo "[integrity] No unresolved Git merge conflict markers found."
