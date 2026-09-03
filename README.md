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

## 生产部署要求

预编译部署包面向 Debian 12，并支持使用 `apt`、systemd 和 rootless Podman 的兼容 Ubuntu 环境。选择与服务器一致的架构：`amd64` 或 `arm64`。安装需要 root 权限和访问系统软件源、Playwright 浏览器下载站及容器镜像仓库的网络连接；Node.js 22 运行时已包含在包内，生产服务器无需安装 Go、pnpm 或前端构建工具。

## 生产快速部署

从 [GitHub Releases](https://github.com/NHPT/YiStack/releases) 下载对应版本的部署包和同名 `.sha256` 文件，例如：

```text
yistack-vX.Y.Z-linux-amd64.tar.gz
yistack-vX.Y.Z-linux-amd64.tar.gz.sha256
```

校验、解压并安装：

```bash
sha256sum --check yistack-vX.Y.Z-linux-amd64.tar.gz.sha256
tar -xzf yistack-vX.Y.Z-linux-amd64.tar.gz
cd yistack-vX.Y.Z-linux-amd64
sudo ./install.sh
```

安装器会校验包内 `MANIFEST.sha256`，创建 `yistack` 系统用户，配置 rootless Podman，安装 systemd 单元和 Playwright Chromium，并使用以下稳定目录：

```text
/opt/yistack/current   当前发布版本
/etc/yistack           配置
/var/lib/yistack       项目、容器数据和浏览器运行时
/var/log/yistack       日志目录
/var/cache/yistack     缓存目录
```

### 使用外部 Supabase

1. 在新的 Supabase 项目中执行部署包内的 `database/init.sql`。
2. 编辑 `/etc/yistack/yistack.env`，至少配置 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 和 `SUPABASE_DB_PASSWORD`。完整功能需要数据库直连密码。
3. 配置 `CORS_ALLOWED_ORIGINS`、公网回调 URL 及其他部署所需密钥。
4. 启动并检查服务：

```bash
sudo systemctl start yistack.target
sudo yistackctl health
sudo yistackctl status
```

### 使用 PostgreSQL 16 容器

如不使用 Supabase 承载 YiStack 控制面数据库，可由安装器创建受 CPU、内存和进程数限制的 PostgreSQL 16 rootless Podman 容器：

```bash
sudo ./install.sh --with-postgres --start
sudo yistackctl postgres status
sudo yistackctl health
```

安装器会生成数据库密码，写入 `/etc/yistack/postgres.env`，并依次执行 Supabase SQL 兼容层和 `database/init.sql`。此模式提供 YiStack 自身的 PostgreSQL 数据库和传统 JWT 认证，不提供 Supabase Auth、Storage 或其他托管服务；生成的应用若依赖 Supabase，仍需单独配置 Supabase 项目。

### 可选演示环境维护

公开体验环境继续使用上述标准 PostgreSQL 生产部署，不需要维护专用应用分支。部署包提供默认关闭的运维层，可按日恢复演示基线，并按小时执行 TTL、缓存、日志和磁盘水位治理。该功能只支持安装器管理的本地 PostgreSQL；检测到外部 Supabase 时会拒绝执行，避免对外部数据库进行不完整或不可逆的重置。

先完成 Provider、演示账号和演示项目配置，再显式安装配置并采集基线：

```bash
sudo install -m 0640 -o root -g yistack \
  /opt/yistack/current/config/yistack-demo-maintenance.env.example \
  /etc/yistack/demo-maintenance.env
sudo sed -i 's/^DEMO_MAINTENANCE_ENABLED=false$/DEMO_MAINTENANCE_ENABLED=true/' \
  /etc/yistack/demo-maintenance.env
sudo yistackctl demo snapshot
sudo systemctl enable --now \
  yistack-demo-reset.timer \
  yistack-demo-cleanup.timer
sudo yistackctl demo status
```

`snapshot` 会在短暂停止应用和项目容器后保存 PostgreSQL dump、项目工作区、基线项目列表、Release commit 和 SHA-256 清单。它不会复制 `/etc/yistack` 中的密钥。默认策略为：

- 每天 04:00 后随机延迟最多 10 分钟恢复基线；
- 每小时清理过期的非基线项目、已停止项目容器、生成证据和缓存；
- 磁盘达到 80% 时，从最旧的非基线项目开始清理，直至降到 70%；
- 始终保留基线项目、`runtime/templates`、`ms-playwright`、配置目录和已安装 Release；
- 仅删除带精确 `yistack.project_id` 标签的 Podman 容器和网络，不执行全局 `podman system prune`。

可在 `/etc/yistack/demo-maintenance.env` 调整 TTL 和水位。升级 YiStack 后，旧基线因 `SOURCE_COMMIT` 不匹配而拒绝恢复，必须在新版本验证完成后重新执行 `snapshot`。手动操作和停用命令如下：

```bash
sudo yistackctl demo cleanup
sudo yistackctl demo reset
sudo systemctl list-timers 'yistack-demo-*'
sudo systemctl disable --now \
  yistack-demo-reset.timer \
  yistack-demo-cleanup.timer
```

前端默认仅监听 `127.0.0.1:5000`，后端默认监听 `127.0.0.1:8080`。公网部署应在前端之前配置带 TLS 的 Caddy、Nginx 或等效反向代理。更新 `/etc/yistack/yistack.env` 后执行：

```bash
sudo yistackctl restart
sudo yistackctl logs
```

Release 同时发布 amd64/arm64 部署包、独立 SHA-256、合并 `SHA256SUMS`、SPDX JSON SBOM 和 GitHub 构建来源证明。Tag 发布工作流仅在完整质量门禁和部署包运行时验收通过后创建或更新 Release。

`database/init.sql` 是 v1.0.0 的全新安装真源。它会创建 Provider catalog，但默认不启用任何 LLM Provider。启动后应在管理端配置并预检至少一个 Provider；不要把 API Key 写入仓库或部署包。

## 源码开发

源码开发需要以下工具；生产部署不需要这些构建依赖。

| 工具 | 支持基线 |
| --- | --- |
| Node.js | 22.x |
| pnpm | 11.5.2 |
| Go | 1.26.6 或更高的 1.x 版本 |
| Podman | 3.4+，rootless |
| Database | Supabase，或用于 SQL 验证的 PostgreSQL 15+ |

```bash
git clone https://github.com/NHPT/YiStack.git
cd YiStack
corepack enable
pnpm install --frozen-lockfile
(cd backend && go mod download)
cp .env.example .env
```

在开发数据库中执行 `backend/init.sql`，完成 `.env` 配置后启动：

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
