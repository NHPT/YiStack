# 变更记录

[**简体中文**](CHANGELOG.md) | [English](CHANGELOG.en.md)

> 本文件是变更记录的中文主版本。中英文内容不一致时，以本文件为准。

本文档只记录对公开用户和贡献者有意义的产品、兼容性与安全变更。
内部任务流水、阶段验收记录和开发过程不在公开仓库发布。

YiStack 从 v1.0.0 起按照 [Semantic Versioning](https://semver.org/)
维护公开版本记录。

## [Unreleased]

### 新增

- VIS-001 视觉上下文闭环：聊天支持上传或粘贴 PNG/JPEG 参考图，只有声明 `vision` 能力的模型可接收图片。
- 图片会在服务端执行 MIME、大小、尺寸、像素与真实解码校验，并重新编码净化；多模态分析严格输出 `visual_context.v1`。
- 视觉上下文绑定消息、候选方案与持久 Generation Job，SSE 实时流和刷新重放均可恢复；方案与代码生成消费布局、组件、颜色、字体、间距、响应式和交互约束。

### 安全

- 视觉上下文携带服务端 HMAC 完整性证明；即使客户端同时改写请求与项目 `plan_data` 也不能伪造分析结果，合法上下文可在讨论与重规划中连续复用。

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
