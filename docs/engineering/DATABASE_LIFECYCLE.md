# 数据库生命周期

[**简体中文**](DATABASE_LIFECYCLE.md) |
[English](DATABASE_LIFECYCLE.en.md)

> 本文件是当前数据库生命周期规则的中文主版本。中英文内容不一致时，以本
> 文件为准。

## 适用范围

Contributor Alpha 数据库基线版本为
`000000000000_contributor_alpha`。每个 Release 中的 `backend/init.sql`
始终是该 Release 全新安装的单点真源。

当前 main 分支的最新版本为
`202609070001_migration_integrity`。

基线标记不代表任意历史数据库都可以升级。只有最后记录的数据库结构版本和
对应源码提交均已知时，现有数据库才属于支持范围。

## 全新安装

对于新的 Supabase 项目：

1. 创建空项目；
2. 使用 `ON_ERROR_STOP` 执行 `backend/init.sql`；
3. 再执行一次，验证可重复执行；
4. 检查 `public.schema_migrations` 已记录 manifest 中的完整版本链和 checksum；
5. 对外提供服务前替换种子凭据，并至少配置一个 Provider。

仓库门禁 `bash scripts/verify-supabase-baseline.sh` 会在隔离的 PostgreSQL
容器中执行这套流程，并补齐兼容 Supabase 的认证角色和函数。

预编译生产包默认设置 `DB_AUTO_MIGRATE=false`。后端启动时会读取打包的
`manifest.json`，并要求数据库已位于该 Release 的最新版本且所有已记录
checksum 匹配；它不会在启动过程中执行 migration 或允许 GORM 隐式改表。
源码开发环境可保留 `DB_AUTO_MIGRATE=true`，但它不能替代正式 migration。

## Migration 契约

后续升级脚本使用以下路径：

```text
backend/migrations/<UTC timestamp>_<name>.sql
backend/migrations/rollback/<UTC timestamp>_<name>.sql
backend/migrations/manifest.json
```

每个正向 migration 必须：

- 不得自行包含 `BEGIN`、`COMMIT` 或 `ROLLBACK`，每个版本的事务由 runner 管理；
- 在全局 PostgreSQL advisory lock 内按 manifest 顺序执行；
- 可以安全重试，或者与版本记录在同一事务内失败；
- 默认保留数据；
- 由 runner 在 SQL 成功后准确插入一条带 SHA-256 的版本记录；
- 在 manifest 中声明前一版本为唯一可接受来源；
- forward 和 rollback 文件一经发布不可修改，manifest checksum 必须匹配；
- 覆盖全新安装及受支持升级路径的测试。

同一次变更必须同步更新 `backend/init.sql`，确保全新安装直接到达最新结构。

## 受支持升级流程

安装新 Release 前先备份数据库，并验证备份可以恢复。升级期间不允许应用继续
写入数据库：

```bash
sudo yistackctl stop
# 安装新的不可变 Release 包
sudo ./install.sh
sudo yistackctl database plan
sudo yistackctl database migrate
sudo yistackctl database verify
sudo yistackctl start
sudo yistackctl health
```

`migrate` 和 `rollback` 在 `yistack.target` 运行时会拒绝执行。Supabase 模式
必须配置 `SUPABASE_DB_PASSWORD` 以建立 PostgreSQL 直连；REST-only 模式不能
执行 schema migration。重复执行 `migrate` 不会重复应用已记录版本。

runner 会拒绝 manifest 文件篡改、数据库 checksum 不匹配、版本历史断层、未知
版本和高于当前 Release 的版本。生产应用也会在这些情况下拒绝启动，并且在
数据库落后时提示执行 `yistackctl database migrate`。

## Rollback 契约

每个 migration 必须提供以下其中一项：

- 已测试的 rollback SQL；或
- 明确的 `IRREVERSIBLE` 头部及备份、恢复步骤。

应用启动时绝不自动 rollback。执行破坏性或不可逆 migration 前，运维人员
必须创建并验证数据库备份。只有目标程序版本兼容当前数据库版本时，才允许
回滚应用。

基线 rollback 仅在不存在后续 migration 时删除基线标记，不会删除业务表或
用户数据。完整撤销基线必须恢复安装前的数据库快照。

`yistackctl database rollback` 每次只回退最新一个版本，且仅允许执行 manifest
中声明为 reversible 的 migration。回退后必须安装与目标数据库版本兼容的
应用 Release，再启动服务；不得用较新的二进制绕过版本检查。

## 版本兼容矩阵

| 应用版本 | 必需数据库版本 | 支持的安装/来源 | 回退边界 |
| --- | --- | --- | --- |
| v1.0.0 | `000000000000_contributor_alpha` | 仅全新安装 | 仅删除 baseline 标记，不删除业务表 |
| Unreleased（下一个可升级 tag） | `202609070001_migration_integrity` | 全新安装；或从 v1.0.0 baseline 原地升级 | 可单步回退至 v1.0.0 baseline，保留业务数据 |

## 完整性与发布门禁

当前固定 checksum：

| 数据库版本 | Forward SHA-256 |
| --- | --- |
| `000000000000_contributor_alpha` | `a7dbe43d655163175bb51cb4c5eed1f87249a37a50e2e0585d794d4283d8e871` |
| `202609070001_migration_integrity` | `aa230dafac97ea8e3e1ddcd37c39ca962be8ad6f3beae88f007833728d46d113` |

仓库已提供带锁和 checksum 校验的 runner、支持来源的 upgrade/rollback 测试、
版本兼容矩阵以及未知/更新版本的启动拒绝。Release 包必须携带完整 migration
目录，并在 PostgreSQL 16 上执行从每个声明来源版本到目标版本的运行时验收。

只有新的不可变 tag 完成 Release 工作流后，表格中的 `Unreleased` 才能替换为
实际版本，并正式声明该 tag 支持 v1.0.0 存量数据库原地升级。任意未列出的来源
版本仍不受支持。
