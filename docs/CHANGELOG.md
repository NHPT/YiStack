# 变更记录

[**简体中文**](CHANGELOG.md) | [English](CHANGELOG.en.md)

> 本文件是变更记录的中文主版本。中英文内容不一致时，以本文件为准。

本文档只记录对公开用户和贡献者有意义的产品、兼容性与安全变更。
内部任务流水、阶段验收记录和开发过程不在公开仓库发布。

YiStack 从 v1.0.0 起按照 [Semantic Versioning](https://semver.org/)
维护公开版本记录。

## [Unreleased]

### 新增

- 新增 Debian 12 预编译生产部署包，内置 Go 后端、Next.js standalone、Node.js 22、浏览器验收 worker、systemd 单元和可选 PostgreSQL 16 rootless Podman 控制面数据库。
- 新增 Tag Release 工作流，在 amd64 和原生 arm64 runner 上构建并验收部署包，发布 SHA-256、SPDX JSON SBOM 和 GitHub 构建来源证明。
- 新增默认关闭的演示环境维护层，为本地 PostgreSQL 部署提供带校验和的基线快照、每日恢复、项目与容器 TTL、缓存与证据清理以及磁盘高低水位保护。
- VIS-001 视觉上下文闭环：聊天支持上传或粘贴 PNG/JPEG 参考图，只有声明 `vision` 能力的模型可接收图片。
- 图片会在服务端执行 MIME、大小、尺寸、像素与真实解码校验，并重新编码净化；多模态分析严格输出 `visual_context.v1`。
- 视觉上下文绑定消息、候选方案与持久 Generation Job，SSE 实时流和刷新重放均可恢复；方案与代码生成消费布局、组件、颜色、字体、间距、响应式和交互约束。
- VIS-002 可视化编辑闭环：owner/editor 可在内部项目 Preview 中选择真实页面元素并提交修改要求，viewer、公共分享和外部地址不可启用。
- 选中元素以脱敏 `visual_edit.v1` 绑定持久 Generation Job，修改写回真实源码，并继续经过 `generation_result.v2`、项目级 build/test/lint、有限自动修复、浏览器验收和 Git 快照。
- COLLAB-001 共享工作区闭环：owner/editor/viewer 会话显示持久在线状态，资源变更通过可重放 SSE 同步，超时和离开事件保留追加式审计。
- 远端文件保存会自动刷新 clean buffer；dirty buffer 保持本地内容并显示冲突。文件保存使用 SHA-256 revision 和 HTTP 409 防止静默覆盖。

### 变更

- README 的首要快速开始改为下载 Release 部署包并配置生产数据库；源码 clone、依赖安装和 `scripts/dev.sh` 移至源码开发流程。
- PR CI 将轻量仓库合同前置，合同失败时不再先运行完整构建和浏览器验收，并新增部署包运行时验收。
- 生产配置关闭 GORM 启动时隐式改表并验证已安装 SQL baseline；补齐可空 `users.instance_id`，使本地 PostgreSQL 的注册链路与 Supabase 模型一致。
- README 首屏新增一句话生成完整应用、YES 工程体系、高性能隔离运行、持久恢复、视觉上下文与实时协作等核心优势说明。
- 新增 YES 工程体系英文文档，并更新产品差距与开源准备度报告，使 VIS-001、COLLAB-001 和后续真实缺口与当前实现保持一致。

### 安全

- 视觉上下文携带服务端 HMAC 完整性证明；即使客户端同时改写请求与项目 `plan_data` 也不能伪造分析结果，合法上下文可在讨论与重规划中连续复用。
- Preview inspector 校验 iframe `source/origin`，不读取 Cookie、Storage、HTML、表单值或 URL 查询参数；服务端再次校验路径、选择器、矩形和 computed-style allowlist，权限读取失败时关闭失败。
- systemd 仅向后端注入完整密钥配置；前端按 allowlist 读取非敏感运行参数，浏览器 worker 只接收浏览器目录和监听端口。
- 演示维护只接受安装器管理的本地 PostgreSQL，只操作带 `yistack.project_id` 标签的 Podman 资源，并保护模板、浏览器运行时、配置和 Release 目录。
- 协作资源事件只能由后端文件或生成事务写入，客户端不能伪造 mutation audit。
- `express@5.2.1` 的传递依赖 `body-parser` 固定升级至 2.3.0，High/Critical 依赖审计保持为零。

## [1.0.0] - 2026-09-01

### 新增

- 自然语言驱动的方案确认、代码生成、项目级验证和有限自动修复流程。
- 持久 Generation Job、attempt、SSE replay、取消和中断恢复。
- 基于 rootless Podman 的项目隔离、运行时管理和浏览器验收。
- Supabase Auth、RLS、私有 Storage、migration 和 rollback 应用预设。
- GitHub OAuth/PKCE、仓库导入、显式 pull/push 和 webhook 防重放。
- Vercel 部署适配器、自定义域名、发布日志和受保护回滚契约。
- owner/editor/viewer 项目协作，以及版本化官方模板。
- Apache-2.0、CI、贡献指南、安全策略、治理文件和发布审计。
- README、贡献指南、行为准则和核心公开文档的中英文入口。
- README 中新增使用脱敏演示数据拍摄的真实工作台、运行预览和 Git 交付截图。

### 变更

- 公开仓库默认分支统一为 `main`。
- `docs/roadmap/ROADMAP.md` 成为唯一公开 roadmap。
- 内部任务流水、阶段状态和实施记录保留在本地，不进入公开源码。
- `runtime/`、环境文件、调试归档和生成证据从发布面排除。
- CI 在干净环境安装 Playwright Chromium、通过真实 SQL 查询等待数据库就绪，并升级到 Node.js 24 兼容的 GitHub Actions。
- pnpm 显式执行 24 小时依赖成熟期策略，锁文件保持为唯一依赖真源。
- Go 基线升级至 1.26.6，Node.js 与 Go 生产依赖完成安全升级。

### 安全

- 默认管理员首次登录必须修改密码，修改后旧管理员 JWT 立即失效。
- `JWT_SECRET` 为空或使用已知示例值时生成进程级随机密钥。
- GitHub 和部署凭据仅在服务端加密保存，不进入项目文件或 API 响应。
- 发布门禁扫描公开文件、提交元数据和完整 Git 历史中的凭据及隐私信息。
- Mermaid 升级至 11.16.1，包含上游原型污染防护增强。
- CI 新增 High/Critical 依赖审计门禁；发布时 npm 与 Go 可达漏洞均无 High/Critical。

### 发布说明

- v1.0.0 仅承诺从空数据库执行 `backend/init.sql`。
- 尚未承诺任意历史数据库版本的原地升级。
- 真实云端部署生命周期仍需使用外部平台凭据单独验收。
