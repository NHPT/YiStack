# YiStack Devbox

这个目录提供 YiStack 预构建开发镜像的最小实现。

当前镜像定位：

- 基于 Debian bookworm 系发行版
- 预装 `node`、`npm`、`pnpm`
- 预装 `git`、`curl`、`wget`、`build-essential`
- 预装 `python3`、`pip`
- 用作 `node-nextjs`、`node-react`、`node-vue`、`node-express`、`static-html` 的默认 devbox

## 构建

构建脚本不再读取 `.env`。镜像名、运行时和平台都通过命令行显式传入。

```bash
bash scripts/build-devbox.sh --image ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm
```

常用参数：

```bash
bash scripts/build-devbox.sh \
  --image ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm \
  --runtime podman \
  --platform linux/amd64 \
  --pnpm-version 9.12.3
```

## 推送

不再单独提供推送脚本，直接手动执行容器运行时命令即可，例如：

```bash
podman push ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm
```

## 接入运行时

构建或推送完成后，把镜像地址写入后台 `system_config.container.images`，例如：

```json
[
  { "type": "node-nextjs", "image": "ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm" },
  { "type": "node-react", "image": "ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm" },
  { "type": "node-vue", "image": "ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm" },
  { "type": "node-express", "image": "ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm" },
  { "type": "static-html", "image": "ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm" },
  { "type": "default", "image": "ghcr.1ms.run/chaitin/monkeycode-runner/devbox:bookworm" }
]
```

`default` 是未命中专用 profile 时使用的默认镜像。开发阶段建议直接指向同一个 `devbox:bookworm`。
