# YiStack 一栈

[**简体中文**](README.md) | [English](README.en.md)

**一句话生成完整应用：从自然语言需求到可运行、可验证、可迭代的全栈交付。**

YiStack 是由 **YES Engineering System** 驱动、面向开发者和小型团队的开源高性能 AI 应用生成平台。它以 Go 后端、独立 Workspace 和持久任务为基础，将需求与参考图、方案确认、全栈代码生成、项目级验证、有限自动修复、容器运行、浏览器验收和 Git 交付组织成一条真实、可追踪、可恢复的工程闭环。

> 当前版本：**v1.0.0**。这是 YiStack 首个稳定开源版本；稳定范围以本 README 和 [`docs/PRODUCT.md`](docs/PRODUCT.md) 声明的能力边界为准。当前仅承诺全新数据库安装，不承诺任意历史数据库版本的原地升级。

## 核心优势

| 特点 | 用户获得的能力 |
| --- | --- |
| 一句话到完整应用 | 从自然语言需求或参考图开始，贯通 Foundation、方案、实现、验证、预览和 Git 交付，而不只生成代码片段 |
| YES 工程体系 | 用 Specification、Execution 和 Validation 约束 AI 与人工开发；协议、权限或验证失败时拒绝伪成功 |
| 真实项目级验证 | 在生成项目中运行 stack-aware build/test/lint，失败后执行有限自动修复，并通过浏览器验收最终结果 |
| 高性能隔离运行 | Go 后端承载编排与流式事件，每个项目运行在独立 rootless Podman Workspace 中 |
| 持久且可恢复 | Generation Job、attempt、lease 和 SSE replay 共同保证刷新、断线或进程中断后的状态恢复 |
| 视觉与实时协作 | 参考图转为可信 `visual_context.v1`；共享工作区提供角色权限、presence、远端同步和 SHA-256 冲突保护 |
| 源码与交付可控 | Monaco、终端、Git、GitHub 同步、版本恢复和导出能力让生成代码始终归用户管理 |

## 产品预览

![YiStack 工作台中的生成流程、质量门禁和 Monaco 代码编辑器](docs/assets/screenshots/workspace-overview.png)

<p align="center">从需求、工程执行和质量门禁到可审阅源码的统一工作台</p>

<table>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/verified-preview.png" alt="YiStack 运行预览与浏览器验收"></td>
    <td width="50%"><img src="docs/assets/screenshots/git-delivery.png" alt="YiStack Git 提交与差异视图"></td>
  </tr>
  <tr>
    <td align="center">真实运行预览与浏览器验收</td>
    <td align="center">Git 提交、文件差异与交付追踪</td>
  </tr>
</table>

> 截图来自真实 YiStack 界面，使用脱敏演示项目和确定性演示数据。

## 当前能力

| 能力 | 状态 | 边界 |
| --- | --- | --- |
| Foundation 与方案决策 | 已实现 | 从需求约束生成结构化 Foundation 和候选技术方案，经用户确认后进入实现 |
| 视觉上下文 | 已实现 | PNG/JPEG 上传或粘贴、真实多模态分析、HMAC 完整性证明和 `visual_context.v1` 全链路绑定 |
| 结构化应用生成 | 已实现 | LLM 输出使用版本化 Schema，失败不能伪装成成功 |
| 项目质量门禁 | 已实现 | 按项目技术栈运行 build/test/lint，支持有限自动修复 |
| 持久 Generation Job | 已实现 | 支持任务状态、attempt、SSE replay 和终态恢复 |
| 独立运行环境与预览 | 已实现 | 使用 rootless Podman，包含浏览器验收契约 |
| Supabase 应用预设 | 已实现 | 生成 Auth、RLS、私有 Storage、migration/rollback 和类型边界 |
| GitHub 导入与同步 | 已实现 | OAuth PKCE、加密 token、冲突阻断、安全 push 和 webhook 幂等 |
| Vercel 部署适配器 | 已实现，待云端验收 | 发布、域名、日志和回滚逻辑已有自动化测试；真实 lifecycle 仍需外部凭据验收 |
| 共享工作区协作 | 已实现 | owner/editor/viewer、持久 presence、SSE 重放、远端文件同步、append-only 审计和 SHA-256 CAS |
| 官方模板 | 已实现 | 持久版本、SHA-256、CAS 发布/回滚；当前不是社区模板市场 |
| 插件系统与模板市场 | 未实现 | 仍属后续规划 |
| 商业版本、SSO、K8s、SLA | 未发布 | 产品假设，不是当前开源版本承诺 |

公开变更以 [`docs/CHANGELOG.md`](docs/CHANGELOG.md) 记录，产品方向以
[`docs/PRODUCT.md`](docs/PRODUCT.md) 和
[`docs/roadmap/ROADMAP.md`](docs/roadmap/ROADMAP.md) 为准；实现状态必须由
可执行门禁验证。

## YES 工程体系

YES（YiStack Engineering Specification）是 YiStack 的工程规范与执行内核，不是一个提示词模板。它用五层结构把“生成了代码”和“完成了可交付软件”区分开：

1. **Entry**：统一入口、上下文读取顺序和硬约束。
2. **Principle**：定义真实性、安全性、用户控制权和工程价值排序。
3. **Architecture**：约束模块边界、调用方向、状态职责和数据所有权。
4. **Execution**：规定需求澄清、方案、实现、验证和交付的连续执行协议。
5. **Validation**：通过 `pnpm yes:validate`、项目级 build/test/lint、数据库检查、安全审计和浏览器验收提供可执行证据。

YES 使 YiStack 不把文件写入或模型回复视为成功。协议、权限、构建、测试、运行或浏览器验收失败时，流程必须明确阻断、记录原因并提供恢复路径。

完整定义、当前边界和演进方向见 [YES 工程体系](docs/engineering/YES.md)。

## 技术栈

- Frontend: Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, Monaco Editor
- Backend: Go 1.26.6+, Hertz, GORM
- Database: Supabase/PostgreSQL
- Runtime: rootless Podman
- Package manager: pnpm 11.5.2

## 环境要求

| 工具 | 支持基线 |
| --- | --- |
| Node.js | 22.x |
| pnpm | 11.5.2 |
| Go | 1.26.6 或更高的 1.x 版本 |
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

- [开发者指南](docs/DEVELOPER_GUIDE.md)
- [架构设计](docs/ARCHITECTURE.md)
- [产品边界](docs/PRODUCT.md)
- [YES 工程体系](docs/engineering/YES.md)
- [工程原则](docs/engineering/PRINCIPLES.md)
- [开发工作流](docs/engineering/DEVELOPMENT_WORKFLOW.md)
- [数据库生命周期](docs/engineering/DATABASE_LIFECYCLE.md)
- [公开路线图](docs/roadmap/ROADMAP.md)
- [变更记录](docs/CHANGELOG.md)

## 参与贡献

提交 issue 或 pull request 前阅读：

- [贡献指南](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [行为准则](CODE_OF_CONDUCT.zh-CN.md)
- [GOVERNANCE.md](GOVERNANCE.md)
- [MAINTAINERS.md](MAINTAINERS.md)

安全问题必须使用 [`SECURITY.md`](SECURITY.md) 中的私下披露渠道，请勿通过公开 Issue 或其他公开渠道提交。

## License

YiStack is licensed under the [Apache License 2.0](LICENSE).
