#!/bin/bash
# preheat.sh - 预热 YiStack 常用项目开发镜像

set -euo pipefail

RUNTIME="${CONTAINER_RUNTIME:-podman}"

IMAGES_DEFAULT="docker.io/library/node:20-bookworm-slim"
IMAGES="${YISTACK_PREHEAT_IMAGES:-$IMAGES_DEFAULT}"

if ! command -v "$RUNTIME" >/dev/null 2>&1; then
  echo "❌ 未找到容器运行时: $RUNTIME"
  exit 1
fi

echo "🔥 开始预热 YiStack 开发镜像..."
echo "   Runtime: $RUNTIME"

failed=0
for image in $IMAGES; do
  if [ -z "$image" ]; then
    continue
  fi

  echo "📦 检查镜像: $image"
  if "$RUNTIME" image exists "$image" >/dev/null 2>&1; then
    echo "   ✅ 已存在，跳过"
    continue
  fi

  echo "   ⬇️  拉取镜像..."
  if "$RUNTIME" pull "$image"; then
    echo "   ✅ 已就绪"
  else
    echo "   ⚠️  拉取失败: $image"
    failed=$((failed + 1))
  fi
done

if [ "$failed" -gt 0 ]; then
  echo "⚠️  镜像预热完成，但有 $failed 个镜像拉取失败。项目启动时仍会按需补拉。"
  exit 0
fi

echo "✅ 镜像预热完成"
