#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${VERSION:-${1:-}}"
TARGET_ARCH="${TARGET_ARCH:-${2:-amd64}}"
NODE_RUNTIME_VERSION="${NODE_RUNTIME_VERSION:-22.23.2}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/dist/release}"
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git -C "$ROOT_DIR" show -s --format=%ct HEAD 2>/dev/null || date +%s)}"
SOURCE_COMMIT="${SOURCE_COMMIT:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-false}"
REQUIRE_CLEAN_TREE="${REQUIRE_CLEAN_TREE:-false}"

if [ -z "$VERSION" ]; then
  echo "VERSION is required, for example VERSION=v1.1.0 pnpm build:release" >&2
  exit 2
fi
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "VERSION must use a vMAJOR.MINOR.PATCH form: $VERSION" >&2
  exit 2
fi

case "$TARGET_ARCH" in
  amd64)
    go_arch="amd64"
    node_arch="x64"
    ;;
  arm64)
    go_arch="arm64"
    node_arch="arm64"
    ;;
  *)
    echo "Unsupported target architecture: $TARGET_ARCH" >&2
    exit 2
    ;;
esac

case "$(uname -m)" in
  x86_64)
    host_arch="amd64"
    ;;
  aarch64 | arm64)
    host_arch="arm64"
    ;;
  *)
    echo "Unsupported release build host architecture: $(uname -m)" >&2
    exit 2
    ;;
esac

if [ "$host_arch" != "$TARGET_ARCH" ]; then
  echo "Release packages must be built natively because Next.js includes architecture-specific modules." >&2
  echo "Build host: $host_arch; target: $TARGET_ARCH" >&2
  exit 2
fi

for command in curl file git go gzip node pnpm sha256sum tar xz; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing release build command: $command" >&2
    exit 1
  fi
done

if [[ ! "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SOURCE_COMMIT must be a full Git commit SHA: $SOURCE_COMMIT" >&2
  exit 1
fi

if [ "$REQUIRE_CLEAN_TREE" = "true" ] &&
  [ -n "$(git -C "$ROOT_DIR" status --short --untracked-files=all)" ]; then
  echo "Release builds require a clean Git worktree." >&2
  git -C "$ROOT_DIR" status --short >&2
  exit 1
fi

if [ "$SKIP_FRONTEND_BUILD" = "true" ]; then
  if [ ! -f "$ROOT_DIR/.next/standalone/server.js" ]; then
    echo "SKIP_FRONTEND_BUILD=true requires an existing Next.js standalone build." >&2
    exit 1
  fi
else
  (
    cd "$ROOT_DIR"
    rm -rf .next
    NEXT_TELEMETRY_DISABLED=1 YISTACK_BUILD_ID="$SOURCE_COMMIT" \
      pnpm exec next build --webpack
  )
fi

package_name="yistack-${VERSION}-linux-${TARGET_ARCH}"
stage_root="$OUTPUT_DIR/$package_name"
archive_path="$OUTPUT_DIR/$package_name.tar.gz"
download_root="$OUTPUT_DIR/.downloads"
node_archive="node-v${NODE_RUNTIME_VERSION}-linux-${node_arch}.tar.xz"
node_url="https://nodejs.org/dist/v${NODE_RUNTIME_VERSION}/${node_archive}"
node_shasums="SHASUMS256-v${NODE_RUNTIME_VERSION}.txt"
node_shasums_url="https://nodejs.org/dist/v${NODE_RUNTIME_VERSION}/SHASUMS256.txt"

rm -rf "$stage_root"
mkdir -p \
  "$stage_root/bin" \
  "$stage_root/browser-worker/lib" \
  "$stage_root/config" \
  "$stage_root/database" \
  "$stage_root/frontend/.next" \
  "$stage_root/runtime/node" \
  "$stage_root/systemd" \
  "$download_root"

echo "[release] Building Go backend for linux/$go_arch..."
(
  cd "$ROOT_DIR/backend"
  CGO_ENABLED=0 GOOS=linux GOARCH="$go_arch" \
    go build -trimpath -ldflags="-s -w" \
    -o "$stage_root/bin/yistack-server" ./cmd/server
)

echo "[release] Copying Next.js standalone output..."
cp -a "$ROOT_DIR/.next/standalone/." "$stage_root/frontend/"
cp -a "$ROOT_DIR/.next/static" "$stage_root/frontend/.next/static"
if [ -d "$ROOT_DIR/public" ]; then
  cp -a "$ROOT_DIR/public" "$stage_root/frontend/public"
fi

echo "[release] Packaging browser acceptance worker..."
cp "$ROOT_DIR/scripts/browser-acceptance-worker.mjs" "$stage_root/browser-worker/"
cp "$ROOT_DIR/scripts/lib/browser-acceptance.mjs" "$stage_root/browser-worker/lib/"
mkdir -p "$stage_root/browser-worker/node_modules"
playwright_dir="$(
  cd "$ROOT_DIR"
  node -p "require('path').dirname(require.resolve('playwright/package.json'))"
)"
playwright_core_dir="$(
  cd "$ROOT_DIR"
  node -p "require('path').dirname(require.resolve('playwright-core/package.json', { paths: [require('path').dirname(require.resolve('playwright/package.json'))] }))"
)"
cp -aL "$playwright_dir" "$stage_root/browser-worker/node_modules/playwright"
cp -aL "$playwright_core_dir" "$stage_root/browser-worker/node_modules/playwright-core"

if [ ! -f "$download_root/$node_archive" ]; then
  echo "[release] Downloading Node.js v$NODE_RUNTIME_VERSION for linux/$node_arch..."
  curl --fail --location --retry 3 "$node_url" -o "$download_root/$node_archive"
fi
if [ ! -f "$download_root/$node_shasums" ]; then
  curl --fail --location --retry 3 \
    "$node_shasums_url" \
    -o "$download_root/$node_shasums"
fi
(
  cd "$download_root"
  checksum_line="$(grep "  ${node_archive}\$" "$node_shasums" || true)"
  if [ -z "$checksum_line" ]; then
    echo "Node.js checksum is missing for $node_archive" >&2
    exit 1
  fi
  printf '%s\n' "$checksum_line" | sha256sum --check -
)
node_extract_dir="$download_root/node-v${NODE_RUNTIME_VERSION}-linux-${node_arch}"
rm -rf "$node_extract_dir"
tar -xJf "$download_root/$node_archive" -C "$download_root"
install -d -m 0755 "$stage_root/runtime/node/bin"
install -m 0755 "$node_extract_dir/bin/node" "$stage_root/runtime/node/bin/node"
cp "$node_extract_dir/LICENSE" "$stage_root/runtime/node/LICENSE"

cp "$ROOT_DIR/backend/init.sql" "$stage_root/database/init.sql"
cp "$ROOT_DIR/deploy/database/postgres-auth-compat.sql" "$stage_root/database/"
cp "$ROOT_DIR/deploy/config/"* "$stage_root/config/"
cp "$ROOT_DIR/deploy/systemd/"* "$stage_root/systemd/"
cp "$ROOT_DIR/deploy/bin/"* "$stage_root/bin/"
cp "$ROOT_DIR/deploy/install.sh" "$stage_root/install.sh"
cp "$ROOT_DIR/LICENSE" "$stage_root/LICENSE"
cp "$ROOT_DIR/README.md" "$stage_root/README.md"
cp "$ROOT_DIR/README.en.md" "$stage_root/README.en.md"
printf '%s\n' "$VERSION" > "$stage_root/VERSION"
printf '%s\n' "$SOURCE_COMMIT" > "$stage_root/SOURCE_COMMIT"

chmod 0755 "$stage_root/install.sh" "$stage_root/bin/"*

(
  cd "$stage_root"
  find . -type f ! -name MANIFEST.sha256 -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 sha256sum > MANIFEST.sha256
)

rm -f "$archive_path" "$archive_path.sha256"
tar \
  --sort=name \
  --mtime="@$SOURCE_DATE_EPOCH" \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -C "$OUTPUT_DIR" \
  -cf - \
  "$package_name" \
  | gzip -n > "$archive_path"
(
  cd "$OUTPUT_DIR"
  sha256sum "$(basename "$archive_path")" > "$(basename "$archive_path").sha256"
)

echo "[release] Package: $archive_path"
echo "[release] Checksum: $archive_path.sha256"
