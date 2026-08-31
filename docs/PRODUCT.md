# YiStack 产品边界

[**简体中文**](PRODUCT.md) | [English](PRODUCT.en.md)

> 本文件是产品边界的中文主版本。中英文内容不一致时，以本文件为准。

本文档定义 YiStack 的产品定位和能力边界，不以路线图或商业设想冒充已交付功能。

> **规划不等于已实现。** 公开状态只以 `README.md`、`docs/CHANGELOG.md`、
> `docs/roadmap/ROADMAP.md` 和可执行门禁证据为准。

## 1. 产品定位

YiStack 是面向开发者的 AI 应用生成与工程工作台。用户从自然语言需求开始，系统生成候选方案，在独立项目工作区内实施代码，并通过构建、测试、lint、预览和浏览器验收判断结果是否可交付。

核心目标：

1. **真实结果**：协议、命令、构建或浏览器验收失败时不得返回伪成功。
2. **可恢复执行**：长时间生成任务具备持久状态、attempt、事件回放和明确终态。
3. **可审计边界**：Provider、Git、部署、协作和数据库操作保留明确权限与证据。
4. **代码归用户**：项目源码可查看、编辑、Git 管理和导出。
5. **最小部署面**：优先复用 Supabase、rootless Podman 和明确的 Provider adapter，不提前引入分布式控制面。

## 2. 状态定义

| 状态 | 含义 |
| --- | --- |
| 已实现 | 仓库中存在真实实现和自动化门禁 |
| 合同已实现 | 本地 adapter、失败边界和测试完成，外部平台 lifecycle 仍需凭据验收 |
| 试验性 | 可使用，但 API 或存储结构可能在稳定版前变化 |
| 规划中 | 尚未完成，不构成版本承诺 |
| 不在当前范围 | Contributor Alpha 不提供 |

## 3. 当前产品能力

| 领域 | 状态 | 当前边界 |
| --- | --- | --- |
| 需求到方案 | 已实现 | Foundation 和方案确认均有结构化状态 |
| 代码生成 | 已实现 | `generation_result.v2` 原子文件操作，拒绝越界路径和无效协议 |
| 项目质量门禁 | 已实现 | stack-aware build/test/lint，失败阻断，有限次数自动修复 |
| 任务持久化 | 已实现 | Generation Job、attempt、lease、SSE replay、取消和中断恢复 |
| 浏览器验收 | 已实现 | 预览启动后执行 deterministic acceptance，阻断浏览器错误 |
| 工作台 | 已实现 | Monaco、文件树、终端、Git、预览和生成状态 |
| 容器运行 | 已实现 | 每项目 rootless Podman 运行边界和资源策略 |
| Supabase 应用预设 | 已实现 | Auth、CRUD RLS、私有 Storage、类型、migration 和 rollback |
| GitHub 集成 | 已实现 | OAuth PKCE、token 加密、import、pull/push 冲突防护、webhook |
| Vercel adapter | 合同已实现 | 发布、日志脱敏、回滚和域名合同已测试；真实云端验收待统一多 Provider 阶段 |
| 项目协作 | 已实现 | owner/editor/viewer，owner-only 管理，append-only audit |
| 官方模板 | 试验性 | 一个初始模板，支持不可变版本、checksum、发布和 CAS rollback |
| Contributor workflow | 已实现 | Apache-2.0、治理文件、CODEOWNERS、CI 和 clean-checkout 门禁 |

## 4. 明确未实现或未承诺

以下内容不得在 README、发布说明或界面中描述为当前可用能力：

- 社区模板市场、模板交易或“50+ 模板”；
- 通用插件系统或第三方插件兼容承诺；
- 多云部署 Provider 的完整生产 lifecycle；
- 企业 SSO 登录闭环、Kubernetes 高可用和正式 SLA；
- 已发布的专业版、企业版、商业价格或付费权益；
- 任意历史数据库版本的自动原地升级；
- 无人工审查的社区代码自动合并。

这些方向只有在对应实现、测试、安全审查和发布门禁完成后才能变更为“已实现”。

## 5. 核心工作流

```text
需求输入
  -> Foundation 决策
  -> 技术方案确认
  -> 持久 Generation Job
  -> 原子文件操作
  -> 项目级 build/test/lint
  -> 有限自动修复
  -> 预览服务
  -> 浏览器验收
  -> Git 版本与交付证据
```

任何阻断步骤失败都必须产生明确失败状态、稳定错误码或恢复动作，不能跳过后继续宣称生成成功。

## 6. 架构边界

### Frontend

- Next.js 16 / React 19 / TypeScript 5.9
- 工作台通过同源 Next.js Route Handler 访问 Go API
- 浏览器不持有 service-role、GitHub client secret、Vercel token 或应用加密密钥

### Backend

- Go / Hertz / GORM
- 服务层负责权限和业务不变量，仓储层负责持久化
- 外部命令受 allowlist、工作区路径和超时约束
- 高风险操作使用 owner-only 权限、显式确认、CAS 或幂等键

### Runtime

- 每个项目使用独立 rootless Podman 容器
- 项目源码位于文件系统，数据库保存元数据和任务状态
- `runtime/`、日志和本地验收证据不是源码发布内容

### Database

- 当前默认集成 Supabase/PostgreSQL
- `backend/init.sql` 是全新安装的单点真源
- `public.schema_migrations` 记录已知 baseline 和后续升级
- Contributor Alpha 尚不承诺未知历史数据库的升级兼容

## 7. 外部集成边界

| 集成 | 凭据位置 | 失败原则 |
| --- | --- | --- |
| LLM Provider | 管理端数据库配置 | 未配置或预检失败时不加载 |
| Supabase | 服务端环境变量 | service-role 只在后端使用 |
| GitHub | 服务端加密 token vault | 冲突或 lease 不匹配时阻断 push |
| Vercel | 服务端环境变量/加密 secret | 解密、发布、日志或 rollback 失败时关闭失败 |

仓库不提供可用于真实环境的共享凭据。外部平台的可用性、配额和服务条款不由 YiStack 保证。

## 8. 开源与贡献阶段

Contributor Alpha 仓库门禁已通过。发布 GitHub remote 并启用 required checks 与 branch protection 后，允许受控 pull request：

- issue 先确定范围；
- CODEOWNERS 审查；
- lint、build、YES、Go tests 和 canonical eval smoke 全部通过；
- 数据库和安全边界具备迁移/rollback 说明；
- 用户可见变更具备浏览器验收证据。

Contributor Alpha 不等同于稳定版或 Community Beta。开放节奏和剩余门禁见 `docs/roadmap/ROADMAP.md`。

## 9. 商业与版本说明

社区版、专业版、企业版及其价格仍是产品假设，当前没有发布承诺。未来若引入闭源模块、商业条款或商标政策，必须与 Apache-2.0 开源仓库边界清晰分离，并在生效前更新治理和许可证说明。

## 10. License

本仓库源码使用 [Apache License 2.0](../LICENSE)。第三方依赖继续适用各自许可证。
