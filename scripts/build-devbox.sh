#!/bin/bash
# build-devbox.sh - 构建基于 Debian bookworm 的 YiStack devbox 镜像

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME="podman"
DEVBOX_CONTEXT="$ROOT_DIR/images/devbox"
DEVBOX_DOCKERFILE="$DEVBOX_CONTEXT/Dockerfile"
DEVBOX_IMAGE=""
DEVBOX_PLATFORM="linux/amd64"
DEVBOX_PNPM_VERSION="9.12.3"
DEVBOX_NO_CACHE="false"

usage() {
  cat <<'EOF'
用法:
  bash scripts/build-devbox.sh --image <image> [options]

必选参数:
  --image <image>             要构建的目标镜像，例如 ghcr.1ms.run/org/devbox:bookworm

可选参数:
  --runtime <runtime>         容器运行时，默认 podman
  --platform <platform>       构建平台，默认 linux/amd64
  --pnpm-version <version>    构建时注入的 pnpm 版本，默认 9.12.3
  --context <path>            构建上下文，默认 projects/images/devbox
  --dockerfile <path>         Dockerfile 路径，默认 <context>/Dockerfile
  --no-cache                  构建时禁用缓存
  -h, --help                  显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      DEVBOX_IMAGE="${2:-}"
      shift 2
      ;;
    --runtime)
      RUNTIME="${2:-}"
      shift 2
      ;;
    --platform)
      DEVBOX_PLATFORM="${2:-}"
      shift 2
      ;;
    --pnpm-version)
      DEVBOX_PNPM_VERSION="${2:-}"
      shift 2
      ;;
    --context)
      DEVBOX_CONTEXT="${2:-}"
      shift 2
      ;;
    --dockerfile)
      DEVBOX_DOCKERFILE="${2:-}"
      shift 2
      ;;
    --no-cache)
      DEVBOX_NO_CACHE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ 未知参数: $1"
      usage
      exit 1
      ;;
  esac
done

if [ -z "$DEVBOX_IMAGE" ]; then
  echo "❌ 缺少必选参数 --image"
  usage
  exit 1
fi

if [ -z "$DEVBOX_DOCKERFILE" ]; then
  DEVBOX_DOCKERFILE="$DEVBOX_CONTEXT/Dockerfile"
fi

if ! command -v "$RUNTIME" >/dev/null 2>&1; then
  echo "❌ 未找到容器运行时: $RUNTIME"
  exit 1
fi

if [ ! -f "$DEVBOX_DOCKERFILE" ]; then
  echo "❌ 未找到 Dockerfile: $DEVBOX_DOCKERFILE"
  exit 1
fi

echo "🔨 Building YiStack devbox image..."
echo "   Runtime:    $RUNTIME"
echo "   Image:      $DEVBOX_IMAGE"
echo "   Platform:   $DEVBOX_PLATFORM"
echo "   Dockerfile: $DEVBOX_DOCKERFILE"

BUILD_CMD=(
  "$RUNTIME" build
  --platform "$DEVBOX_PLATFORM"
  --build-arg "PNPM_VERSION=$DEVBOX_PNPM_VERSION"
  -t "$DEVBOX_IMAGE"
  -f "$DEVBOX_DOCKERFILE"
)

if [ "$DEVBOX_NO_CACHE" = "true" ]; then
  BUILD_CMD+=(--no-cache)
fi

BUILD_CMD+=("$DEVBOX_CONTEXT")

"${BUILD_CMD[@]}"

cat <<EOF
✅ Devbox image build completed

建议将以下镜像地址写入 system_config.container.images：
[
  { "type": "node-nextjs", "image": "$DEVBOX_IMAGE" },
  { "type": "node-react", "image": "$DEVBOX_IMAGE" },
  { "type": "node-vue", "image": "$DEVBOX_IMAGE" },
  { "type": "node-express", "image": "$DEVBOX_IMAGE" },
  { "type": "static-html", "image": "$DEVBOX_IMAGE" },
  { "type": "default", "image": "$DEVBOX_IMAGE" }
]
EOF
