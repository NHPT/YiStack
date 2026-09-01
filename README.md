# YiStack 一栈

[**简体中文**](README.md) | [English](README.en.md)

**从自然语言需求到可运行、可验证、可迭代的完整应用。**

YiStack 是面向开发者和小型团队的开源 AI 应用生成与工程工作台。它将方案确认、代码生成、项目级验证、有限自动修复、容器运行、浏览器验收和 Git 版本管理组织成一条可追踪、可恢复的交付流程。

> 当前版本：**v1.0.0**。这是 YiStack 首个稳定开源版本；稳定范围以本 README 和 [`docs/PRODUCT.md`](docs/PRODUCT.md) 声明的能力边界为准。当前仅承诺全新数据库安装，不承诺任意历史数据库版本的原地升级。

## 当前能力

| 能力 | 状态 | 边界 |
| --- | --- | --- |
| 结构化应用生成 | 已实现 | LLM 输出使用版本化 Schema，失败不能伪装成成功 |
| 项目质量门禁 | 已实现 | 按项目技术栈运行 build/test/lint，支持有限自动修复 |
| 持久 Generation Job | 已实现 | 支持任务状态、attempt、SSE replay 和终态恢复 |
| 独立运行环境与预览 | 已实现 | 使用 rootless Podman，包含浏览器验收契约 |
| Supabase 应用预设 | 已实现 | 生成 Auth、RLS、私有 Storage、migration/rollback 和类型边界 |
| GitHub 导入与同步 | 已实现 | OAuth PKCE、加密 token、冲突阻断、安全 push 和 webhook 幂等 |
| Vercel 部署适配器 | 合同已实现 | 真实云端 lifecycle 需要外部凭据，并与后续多 Provider 统一验收 |
| 项目协作 | 已实现 | owner/editor/viewer，owner-only 高风险操作，append-only 审计 |
| 官方模板 | 已实现 | 持久版本、SHA-256、CAS 发布/回滚；当前不是社区模板市场 |
| 插件系统与模板市场 | 未实现 | 仍属后续规划 |
| 商业版本、SSO、K8s、SLA | 未发布 | 产品假设，不是当前开源版本承诺 |

公开变更以 [`docs/CHANGELOG.md`](docs/CHANGELOG.md) 记录，产品方向以
[`docs/PRODUCT.md`](docs/PRODUCT.md) 和
[`docs/roadmap/ROADMAP.md`](docs/roadmap/ROADMAP.md) 为准；实现状态必须由
可执行门禁验证。

## 技术栈

- Frontend: Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, Monaco Editor
- Backend: Go 1.21.6+, Hertz, GORM
- Database: Supabase/PostgreSQL
- Runtime: rootless Podman
- Package manager: pnpm 11.5.2

## 环境要求

| 工具 | 支持基线 |
| --- | --- |
| Node.js | 22.x |
| pnpm | 11.5.2 |
| Go | 1.21.6 或更高的 1.x 版本 |
| Podman | 3.4+，rootless |
| Database | Supabase，或用于 SQL 验证的 PostgreSQL 15+ |

## 快速开始

```bash
git clone https://github.com/NHPT/YiStack.git
cd YiStack
corepack enable
pnpm install --frozen-lockfile
(cd backend && go mod download)
cp .env.example .env
```

在新的 Supabase 项目中执行：

```text
backend/init.sql
```

`backend/init.sql` 是 v1.0.0 的全新安装真源。它会创建 Provider catalog，但默认不启用任何 LLM Provider。启动前应在管理端配置并预检至少一个 Provider；不要把 API Key 写入仓库。

启动本地开发环境：

```bash
bash scripts/dev.sh
```

默认入口：

- Frontend: <http://localhost:5000>
- Backend API: <http://localhost:8080/api>

仓库不公开可直接用于部署的测试密码。`backend/init.sql` 中的 seed 凭据仅用于本地初始化，任何共享或生产环境都必须立即替换。

## 验证

基础门禁：

```bash
pnpm lint
pnpm build
pnpm yes:validate
(cd backend && go test ./...)
pnpm eval:smoke:ci
git diff --check
```

干净 checkout、工具链、rootless Podman、Supabase SQL baseline 和最小 Provider catalog：

```bash
bash scripts/verify-clean-checkout.sh
```

`pnpm eval:smoke:ci` 是无外部凭据的 deterministic canonical benchmark contract smoke。真实模型 smoke 需要运行中的 YiStack 和显式凭据：

```bash
YISTACK_EVAL_TOKEN=... \
YISTACK_EVAL_PROVIDER=... \
YISTACK_EVAL_MODEL=... \
pnpm eval:smoke
```

## 数据库升级边界

v1.0.0 只承诺从空数据库执行 `backend/init.sql`。baseline、未来 migration 命名、兼容范围和 rollback 要求见 [`docs/engineering/DATABASE_LIFECYCLE.md`](docs/engineering/DATABASE_LIFECYCLE.md)。在 migration runner 和版本兼容矩阵完成前，不声明支持任意存量数据库原地升级。

## 项目结构

```text
backend/       Go API、服务、仓储和数据库初始化
src/           Next.js 应用、页面和 API 代理
scripts/       构建、工程门禁、benchmark 和环境验证
evals/         canonical prompts 与真实 fixture
docs/          架构、工程规则、公开路线图和变更记录
runtime/       本地运行工作区与证据，不进入源码审查
.github/       CI、CODEOWNERS、Issue 与 PR 模板
```

## 文档

- [开发者指南](docs/DEVELOPER_GUIDE.md) / [English](docs/DEVELOPER_GUIDE.en.md)
- [架构设计](docs/ARCHITECTURE.md) / [English](docs/ARCHITECTURE.en.md)
- [产品边界](docs/PRODUCT.md) / [English](docs/PRODUCT.en.md)
- [工程原则](docs/engineering/PRINCIPLES.md) / [English](docs/engineering/PRINCIPLES.en.md)
- [开发工作流](docs/engineering/DEVELOPMENT_WORKFLOW.md) / [English](docs/engineering/DEVELOPMENT_WORKFLOW.en.md)
- [数据库生命周期](docs/engineering/DATABASE_LIFECYCLE.md) / [English](docs/engineering/DATABASE_LIFECYCLE.en.md)
- [公开路线图](docs/roadmap/ROADMAP.md) / [English](docs/roadmap/ROADMAP.en.md)
- [变更记录](docs/CHANGELOG.md) / [English](docs/CHANGELOG.en.md)

## 参与贡献

提交 issue 或 pull request 前阅读：

- [贡献指南](CONTRIBUTING.md) / [English](CONTRIBUTING.en.md)
- [SECURITY.md](SECURITY.md)
- [行为准则英文原文](CODE_OF_CONDUCT.md) / [中文翻译](CODE_OF_CONDUCT.zh-CN.md)
- [GOVERNANCE.md](GOVERNANCE.md)
- [MAINTAINERS.md](MAINTAINERS.md)

安全问题必须使用 [`SECURITY.md`](SECURITY.md) 中的私下披露渠道，不能公开提交。

## License

YiStack is licensed under the [Apache License 2.0](LICENSE).
