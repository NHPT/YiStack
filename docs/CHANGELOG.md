# 变更记录

本文档只记录对公开用户和贡献者有意义的产品、兼容性与安全变更。
内部任务流水、阶段验收记录和开发过程不在公开仓库发布。

YiStack 当前处于 Contributor Alpha，尚未发布稳定版本。正式发布后将按照
[Semantic Versioning](https://semver.org/) 维护版本记录。

## [Unreleased]

### 新增

- 自然语言驱动的方案确认、代码生成、项目级验证和有限自动修复流程。
- 持久 Generation Job、attempt、SSE replay、取消和中断恢复。
- 基于 rootless Podman 的项目隔离、运行时管理和浏览器验收。
- Supabase Auth、RLS、私有 Storage、migration 和 rollback 应用预设。
- GitHub OAuth/PKCE、仓库导入、显式 pull/push 和 webhook 防重放。
- Vercel 部署适配器、自定义域名、发布日志和受保护回滚契约。
- owner/editor/viewer 项目协作，以及版本化官方模板。
- Apache-2.0、CI、贡献指南、安全策略、治理文件和发布审计。
- README、贡献指南和行为准则的中英文入口。

### 变更

- 公开仓库默认分支统一为 `main`。
- `docs/roadmap/ROADMAP.md` 成为唯一公开 roadmap。
- 内部任务流水、阶段状态和实施记录保留在本地，不进入公开源码。
- `runtime/`、环境文件、调试归档和生成证据从发布面排除。

### 安全

- 默认管理员首次登录必须修改密码，修改后旧管理员 JWT 立即失效。
- `JWT_SECRET` 为空或使用已知示例值时生成进程级随机密钥。
- GitHub 和部署凭据仅在服务端加密保存，不进入项目文件或 API 响应。
- 发布门禁扫描公开文件、提交元数据和完整 Git 历史中的凭据及隐私信息。

## 发布说明

- 当前仅承诺从空数据库执行 `backend/init.sql`。
- 尚未承诺任意历史数据库版本的原地升级。
- 真实云端部署生命周期仍需使用外部平台凭据单独验收。
