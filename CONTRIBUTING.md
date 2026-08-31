# 参与 YiStack 贡献

[**简体中文**](CONTRIBUTING.md) | [English](CONTRIBUTING.en.md)

> 本文件是当前贡献流程的中文主版本。中英文内容不一致时，以本文件为准。

YiStack 当前处于 **Contributor Alpha** 阶段。项目通过经过审查的 issue 和
pull request 接受贡献；`main` 分支不是未经审查的集成分支。

提交贡献即表示你同意按照
[Apache License 2.0](LICENSE) 对该贡献进行许可。

## 开始之前

- 修复 bug 时优先使用已有 issue。
- 实现新能力，或者修改公开 API、数据库契约、安全边界或用户工作流前，
  应先创建 feature request。
- 怀疑存在安全漏洞时，不要创建公开 issue，请遵循
  [SECURITY.md](SECURITY.md)。
- 保持改动范围清晰。生成的应用、运行时数据、凭据和本地验收证据不得进入
  pull request。

## 开发基线

必需工具：

| 工具 | 支持基线 |
| --- | --- |
| Node.js | 22.x |
| pnpm | 11.5.2 |
| Go | 1.21.6 或更高的 1.x 版本 |
| Podman | 3.4 或更高版本，rootless |
| PostgreSQL | 15 或更高版本，或一个 Supabase 项目 |

在仓库根目录安装依赖：

```bash
corepack enable
pnpm install --frozen-lockfile
(cd backend && go mod download)
cp .env.example .env
```

新建 Supabase 项目后执行 `backend/init.sql`。该文件是当前 pre-release
版本的全新安装数据库单点真源。数据库升级规则见
[`docs/engineering/DATABASE_LIFECYCLE.md`](docs/engineering/DATABASE_LIFECYCLE.md)。

## 必须执行的验证

运行与 CI 相同的阻断门禁：

```bash
pnpm lint
pnpm build
pnpm yes:validate
(cd backend && go test ./...)
pnpm eval:smoke:ci
git diff --check
```

修改用户可见工作流时，还必须在桌面端和移动端执行相关 Playwright
验收路径。修改数据库或环境配置时，还需要运行：

```bash
bash scripts/verify-clean-checkout.sh
```

真实 canonical generation benchmark 需要正在运行的 YiStack 实例和显式
配置的模型：

```bash
YISTACK_EVAL_TOKEN=... \
YISTACK_EVAL_PROVIDER=... \
YISTACK_EVAL_MODEL=... \
pnpm eval:smoke
```

不要提交 benchmark 凭据或 `runtime/` 下的生成文件。

## Pull Request 要求

Pull request 必须：

- 说明用户可见行为和本次修改涉及的职责边界；
- 除小型文档修正外，关联对应 issue；
- 为行为变化提供聚焦的测试；
- 在公开行为变化时同步更新契约和文档；
- 保持向后兼容，或明确记录迁移与回滚方式；
- 通过全部必需 CI，且 ESLint 为零错误；
- 不包含凭据、生成的运行时工作区或无关重构。

维护者可以关闭过期、不安全、无法验证或超出范围的改动。合并前必须取得
`.github/CODEOWNERS` 中相应负责人的批准。

## Commit 格式

建议使用简短的祈使句标题，并尽量采用常用前缀：

```text
feat: add ...
fix: prevent ...
docs: clarify ...
test: cover ...
chore: update ...
```

## 审查与合并

维护者负责判断改动是否符合当前路线图。审查重点包括正确性、安全边界、
失败行为、测试和运维回滚。通过 CI 是合并的必要条件，但不代表改动一定会
被合并。
