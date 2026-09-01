#!/bin/bash
# prepare.sh - 环境预处理脚本
# 在 dev.sh 或 start.sh 之前运行

set -e

echo "🔧 Preparing YiStack environment..."

# 安装 Go（优先使用系统已有版本；不存在或版本过低时再安装）
install_go() {
    local GO_VERSION="1.26.6"
    local GO_ARCH="linux-amd64"
    local GO_BIN=""

    normalize_version() {
        local version="$1"
        IFS='.' read -r major minor patch <<< "$version"
        major=${major:-0}
        minor=${minor:-0}
        patch=${patch:-0}
        printf "%03d%03d%03d" "$major" "$minor" "$patch"
    }

    version_ge() {
        [ "$(normalize_version "$1")" -ge "$(normalize_version "$2")" ]
    }

    # 优先使用系统 PATH 中已有的 Go
    if GO_BIN=$(command -v go 2>/dev/null); then
        local CURRENT_VERSION
        CURRENT_VERSION=$("$GO_BIN" version 2>/dev/null | sed -n 's/.*go\([0-9][0-9.]*\).*/\1/p' | head -1)
        if [ -n "$CURRENT_VERSION" ] && version_ge "$CURRENT_VERSION" "$GO_VERSION"; then
            echo "✅ Using system Go: $("$GO_BIN" version)"
            "$GO_BIN" env -w GOPROXY=https://goproxy.cn,direct 2>/dev/null
            "$GO_BIN" env -w GO111MODULE=on 2>/dev/null
            "$GO_BIN" env -w 'GOSUMDB=sum.golang.org https://goproxy.cn/sumdb/sum.golang.org' 2>/dev/null
            return 0
        fi

        if [ -n "$CURRENT_VERSION" ]; then
            echo "⚠️  System Go version $CURRENT_VERSION is lower than required $GO_VERSION, will install Go $GO_VERSION"
        else
            echo "⚠️  Found Go at $GO_BIN but failed to parse version, will install Go $GO_VERSION"
        fi
    fi

    echo "📦 Installing Go $GO_VERSION..."

    # 尝试华为云镜像
    if ! curl -fsSL --connect-timeout 10 --max-time 120 "https://mirrors.huaweicloud.com/golang/go${GO_VERSION}.${GO_ARCH}.tar.gz" -o /tmp/go.tar.gz 2>/dev/null; then
        # 尝试腾讯云镜像
        if ! curl -fsSL --connect-timeout 10 --max-time 120 "https://mirrors.cloud.tencent.com/golang/go${GO_VERSION}.${GO_ARCH}.tar.gz" -o /tmp/go.tar.gz 2>/dev/null; then
            # 尝试 golang.google.cn
            curl -fsSL --connect-timeout 10 --max-time 120 "https://golang.google.cn/dl/go${GO_VERSION}.${GO_ARCH}.tar.gz" -o /tmp/go.tar.gz
        fi
    fi

    # 解压到临时目录
    rm -rf /tmp/go-extract
    mkdir -p /tmp/go-extract
    tar -C /tmp/go-extract -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz

    # 安装到 /usr/local/go
    rm -rf /usr/local/go
    mv /tmp/go-extract/go /usr/local/go
    rm -rf /tmp/go-extract

    # 创建符号链接到 PATH 目录
    ln -sf /usr/local/go/bin/go /usr/bin/go
    ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt 2>/dev/null || true

    # 配置 GOPROXY（永久生效）
    /usr/bin/go env -w GOPROXY=https://goproxy.cn,direct
    /usr/bin/go env -w GO111MODULE=on
    /usr/bin/go env -w 'GOSUMDB=sum.golang.org https://goproxy.cn/sumdb/sum.golang.org'

    echo "✅ Go installed: $(/usr/bin/go version)"
    echo "✅ GOPROXY configured: https://goproxy.cn,direct"
}

# 安装 Go
install_go

# 安装前端依赖
if [ -f "/workspace/projects/package.json" ]; then
    echo "📦 Installing frontend dependencies..."
    cd /workspace/projects
    pnpm install
    echo "✅ Frontend dependencies installed"
fi

# 创建日志目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
mkdir -p "$ROOT_DIR/logs"

echo "✅ Environment ready!"
