#!/bin/bash
# build.sh - 构建脚本

set -e

echo "🔨 Building YiStack..."

# 构建前端
if [ -f "package.json" ]; then
    echo "📦 Building frontend..."
    pnpm exec next build --webpack
fi

# 构建后端
if [ -d "backend" ] && [ -f "backend/go.mod" ]; then
    echo "📦 Building backend..."
    mkdir -p dist
    cd backend
    go build -o ../dist/yistack-server ./cmd/server
    cd ..
fi

echo "✅ Build completed!"
