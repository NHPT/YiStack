#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITLEAKS_BIN="${GITLEAKS_BIN:-$(command -v gitleaks || true)}"
if [[ -z "$GITLEAKS_BIN" && -x "$HOME/.local/bin/gitleaks" ]]; then
  GITLEAKS_BIN="$HOME/.local/bin/gitleaks"
fi
if [[ -z "$GITLEAKS_BIN" ]]; then
  echo "[release-audit] gitleaks is required" >&2
  exit 1
fi

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/yistack-public-audit.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT

cd "$ROOT_DIR"
node scripts/validate-public-release.mjs

while IFS= read -r -d '' file; do
  if [[ -f "$file" ]] &&
    ! git ls-files -ci --exclude-standard --error-unmatch -- "$file" \
      >/dev/null 2>&1; then
    printf '%s\0' "$file"
  fi
done < <(git ls-files -co --exclude-standard -z) \
  | tar --null -T - -cf "$TMP_ROOT/public-surface.tar"

"$GITLEAKS_BIN" dir "$TMP_ROOT/public-surface.tar" \
  --max-archive-depth 1 \
  --redact=100 \
  --no-banner \
  --no-color

if [[ "${YISTACK_PUBLIC_AUDIT_SKIP_HISTORY:-false}" != "true" ]]; then
  "$GITLEAKS_BIN" git . \
    --log-opts="--all" \
    --redact=100 \
    --no-banner \
    --no-color
fi

echo "[release-audit] credential and privacy checks passed."
