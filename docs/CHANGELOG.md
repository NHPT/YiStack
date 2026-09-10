# 变更记录

[**简体中文**](CHANGELOG.md) | [English](CHANGELOG.en.md)

> 本文件是变更记录的中文主版本。中英文内容不一致时，以本文件为准。

本文档只记录对公开用户和贡献者有意义的产品、兼容性与安全变更。
内部任务流水、阶段验收记录和开发过程不在公开仓库发布。

YiStack 从 v1.0.0 起按照 [Semantic Versioning](https://semver.org/)
维护公开版本记录。

## [Unreleased]

暂无公开变更。

## [1.1.6] - 2026-09-10

### 新增

- 新增 `yistackctl runtime {info|images|ps}`，直接查看 `yistack` 用户的 rootless Podman 运行信息、镜像和容器。

### 变更

- `install.sh --start`、`yistackctl start` 和 `restart` 自动等待前后端健康检查，只有启动和健康验证全部通过后才报告成功；失败时返回非零状态并输出诊断入口。
- 安装与升级、卸载共享生命周期文件锁，避免并发修改 Release、systemd 和运行时状态。
- 卸载器在容器清理失败时保留应用、数据和服务账户供重试，并且不再在最终清理失败前输出成功消息。

### 修复

- 服务用户执行器显式设置 `DBUS_SESSION_BUS_ADDRESS=/run/user/<uid>/bus`，避免从 root shell 继承 `/run/user/0/bus` 后让 Podman 回退到 `cgroupfs`。
- PostgreSQL systemd unit 和源码安装器统一使用服务用户执行器，固定工作目录与 rootless 运行环境。

### 测试

- 新增控制命令动态验收，覆盖健康检查重试、失败报告、root-only 目录下的 runtime 查询，以及卸载运行时清理失败的关闭失败行为。



## [1.1.5] - 2026-09-10

### 修复

- 修复从 `/root` 等仅 root 可访问目录执行安装时，`runuser` 继承调用者当前目录并导致 Podman、Playwright 或 PostgreSQL 初始化报 `cannot chdir` 的问题。
- 安装、升级备份、`yistackctl postgres`、卸载和无痕维护统一通过包内服务用户执行器，在切换到 `yistack` 前进入 `/var/lib/yistack`。

### 测试

- 新增 `0700` 调用目录回归，动态验证 root → `yistack` 和已处于服务用户两条路径的 `PWD`、`HOME` 与 `XDG_RUNTIME_DIR`。

## [1.1.4] - 2026-09-09

### 新增

- 新增 `yistackctl uninstall`，默认移除程序、systemd 单元和命令入口并保留配置与数据；`--purge` 显式删除 YiStack 管理的本地容器、配置、数据、日志、缓存及服务账户。

### 变更

- Release 升级仅在 migration、健康检查和运行状态恢复全部成功后删除早于当前版本的 Release 目录；失败路径继续保留旧 Release 用于自动回滚。

### 安全

- 卸载器限定固定受管目录和 `yistack.*` 资源，不删除外部 Supabase/PostgreSQL 数据或共享系统软件包，并拒绝危险的顶级目录覆盖。

## [1.1.3] - 2026-09-09

### 修复

- 升级执行器将通过包内清单校验的数据库备份 helper 暂存到 `yistack` 可访问的私有目录后再切换用户执行，兼容 v1.1.0 和 v1.1.1 控制器创建的 root-only 解压目录。
- README 明确旧版控制器首次升级到 v1.1.3 时使用解压目录作为 `yistackctl upgrade` 输入，无需 `.sha256` sidecar；升级后可直接使用压缩包。

## [1.1.2] - 2026-09-09

### 变更

- 所有用户升级统一使用 `yistackctl upgrade`，README 不再提供直接执行 Release 内部 `upgrade.sh` 的版本分支。

### 修复

- 新版 `yistackctl` 将压缩包临时解压目录设置为 `0711`，避免其发起的后续升级阻止 `yistack` 服务用户执行数据库备份程序。

### 安全

- 升级不再强制要求压缩包旁存在可被同时替换的 `.sha256` sidecar；包内 `MANIFEST.sha256` 继续校验文件完整性，README 将 Release checksum 明确为可选的传输损坏检查，并使用 GitHub artifact attestation 验证构建来源。

## [1.1.1] - 2026-09-09

### 修复

- 修复 systemd system manager 将 `%U` 解析为 root UID，导致 `yistack` 服务在错误的 `/run/user/0` 中启动 rootless Podman 的问题。
- 将后端服务的 `ProtectHome` 调整为 `read-only`，在保留只读隔离的同时允许访问 `/run/user/<uid>/podman/podman.sock`。
- 安装器新增 `--postgres-image`，并记录受限网络中可直接使用或配置为 Podman mirror 的真实国内镜像地址。

### 变更

- 无痕体验模式统一使用 `ephemeral` 命名；移除 `demo` 命令、旧配置名、旧环境变量及旧 systemd unit，不提供兼容别名。
- 日常服务、PostgreSQL、migration、升级和无痕体验操作统一由 `yistackctl` 提供入口；安装器同时部署 Bash 自动补全，README 补充完整命令参考和配置修改流程。
- `yistackctl postgres` 自动切换到 `yistack` 服务用户及其 rootless Podman runtime，避免 `sudo` 后误用 root 容器上下文。

### 安全

- 将 ESLint 传递依赖 `js-yaml` 固定为 4.3.2，修复 GHSA-2883-xcg3-v3hh 描述的高危 CPU 消耗问题。

## [1.1.0] - 2026-09-07

### 新增

- 新增官方 Linux amd64/arm64 预编译生产部署包，以 Debian 12 为完整验收基线，内置 Go 后端、Next.js standalone、Node.js 22、浏览器验收 worker、systemd 单元和可选 PostgreSQL 16 rootless Podman 控制面数据库；Web 客户端保持跨平台。
- 新增 Tag Release 工作流，在 amd64 和原生 arm64 runner 上构建并验收部署包，发布 SHA-256、SPDX JSON SBOM 和 GitHub 构建来源证明。
- 新增默认关闭的无痕体验模式，为本地 PostgreSQL 部署提供无用户数据基线、可配置的每日自动还原、完整用户/项目数据清理、项目与容器 TTL 以及磁盘水位保护，同时保留可复用镜像。
- 新增显式数据库 migration runner，支持 manifest 顺序、SHA-256 完整性、PostgreSQL advisory lock、已知 v1.0.0 baseline 升级和单步 rollback。
- VIS-001 视觉上下文闭环：聊天支持上传或粘贴 PNG/JPEG 参考图，只有声明 `vision` 能力的模型可接收图片。
- 新增一键安全升级：v1.0.0 可从新 Release 执行 `upgrade.sh`，后续版本使用 `yistackctl upgrade`；命令自动完成备份、migration、验证、运行状态恢复，并在失败时回退数据库、配置、systemd 单元和 Release 指针。
- 图片会在服务端执行 MIME、大小、尺寸、像素与真实解码校验，并重新编码净化；多模态分析严格输出 `visual_context.v1`。
- 视觉上下文绑定消息、候选方案与持久 Generation Job，SSE 实时流和刷新重放均可恢复；方案与代码生成消费布局、组件、颜色、字体、间距、响应式和交互约束。
- VIS-002 可视化编辑闭环：owner/editor 可在内部项目 Preview 中选择真实页面元素并提交修改要求，viewer、公共分享和外部地址不可启用。
- 选中元素以脱敏 `visual_edit.v1` 绑定持久 Generation Job，修改写回真实源码，并继续经过 `generation_result.v2`、项目级 build/test/lint、有限自动修复、浏览器验收和 Git 快照。
- COLLAB-001 共享工作区闭环：owner/editor/viewer 会话显示持久在线状态，资源变更通过可重放 SSE 同步，超时和离开事件保留追加式审计。
- 远端文件保存会自动刷新 clean buffer；dirty buffer 保持本地内容并显示冲突。文件保存使用 SHA-256 revision 和 HTTP 409 防止静默覆盖。
- README 新增项目容器终端和 Preview 移动端视口切换的真实界面截图，截图使用脱敏确定性演示数据并提供可重复生成脚本。

### 变更

- README 的首要快速开始改为下载 Release 部署包并配置生产数据库；源码 clone、依赖安装和 `scripts/dev.sh` 移至源码开发流程。
- PR CI 将轻量仓库合同前置，合同失败时不再先运行完整构建和浏览器验收，并新增部署包运行时验收。
- 生产配置关闭 GORM 启动时隐式改表并验证 Release 要求的最新数据库版本；Release 包携带完整 migration 目录和 v1.0.0 升级运行时验收。补齐可空 `users.instance_id`，使本地 PostgreSQL 的注册链路与 Supabase 模型一致。
- README 首屏新增一句话生成完整应用、YES 工程体系、高性能隔离运行、持久恢复、视觉上下文与实时协作等核心优势说明。
- 新增 YES 工程体系英文文档，并更新产品差距与开源准备度报告，使 VIS-001、COLLAB-001 和后续真实缺口与当前实现保持一致。

### 安全

- 视觉上下文携带服务端 HMAC 完整性证明；即使客户端同时改写请求与项目 `plan_data` 也不能伪造分析结果，合法上下文可在讨论与重规划中连续复用。
- Preview inspector 校验 iframe `source/origin`，不读取 Cookie、Storage、HTML、表单值或 URL 查询参数；服务端再次校验路径、选择器、矩形和 computed-style allowlist，权限读取失败时关闭失败。
- systemd 仅向后端注入完整密钥配置；前端按 allowlist 读取非敏感运行参数，浏览器 worker 只接收浏览器目录和监听端口。
- 无痕体验模式维护只接受安装器管理的本地 PostgreSQL，只操作带 `yistack.project_id` 标签的 Podman 资源，并保护模板、浏览器运行时、配置和 Release 目录。
- 数据库 runner 拒绝被篡改的 SQL、checksum 漂移、版本断层、未知或过新历史；生产启动在数据库未显式升级时关闭失败。
- 升级备份使用 PostgreSQL custom format 和绑定文件名的 SHA-256，只覆盖 YiStack 管理的 `public` schema；恢复会在单事务中清理并恢复备份内对象，自动恢复不完整时保持服务停止。
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
