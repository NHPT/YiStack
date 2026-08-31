# 数据库生命周期

[**简体中文**](DATABASE_LIFECYCLE.md) |
[English](DATABASE_LIFECYCLE.en.md)

> 本文件是当前数据库生命周期规则的中文主版本。中英文内容不一致时，以本
> 文件为准。

## 适用范围

YiStack 当前处于预发布阶段。`backend/init.sql` 是全新 Supabase 数据库的
单点真源，基线版本为 `000000000000_contributor_alpha`。

基线标记不代表任意历史数据库都可以升级。只有最后记录的数据库结构版本和
对应源码提交均已知时，现有数据库才属于支持范围。

## 全新安装

对于新的 Supabase 项目：

1. 创建空项目；
2. 使用 `ON_ERROR_STOP` 执行 `backend/init.sql`；
3. 再执行一次，验证可重复执行；
4. 检查 `public.schema_migrations` 中的基线记录；
5. 对外提供服务前替换种子凭据，并至少配置一个 Provider。

仓库门禁 `bash scripts/verify-supabase-baseline.sh` 会在隔离的 PostgreSQL
容器中执行这套流程，并补齐兼容 Supabase 的认证角色和函数。

## Migration 契约

后续升级脚本使用以下路径：

```text
backend/migrations/<UTC timestamp>_<name>.sql
backend/migrations/rollback/<UTC timestamp>_<name>.sql
```

每个正向 migration 必须：

- 在事务中运行，除非 PostgreSQL 明确不允许；
- 可以安全重试，或者在记录版本前失败；
- 对冲突状态变更加锁或使用 compare-and-set；
- 默认保留数据；
- 准确插入一条对应的 `public.schema_migrations` 记录；
- 声明可接受的最旧来源版本；
- 覆盖全新安装及受支持升级路径的测试。

同一次变更必须同步更新 `backend/init.sql`，确保全新安装直接到达最新结构。

## Rollback 契约

每个 migration 必须提供以下其中一项：

- 已测试的 rollback SQL；或
- 明确的 `IRREVERSIBLE` 头部及备份、恢复步骤。

应用启动时绝不自动 rollback。执行破坏性或不可逆 migration 前，运维人员
必须创建并验证数据库备份。只有目标程序版本兼容当前数据库版本时，才允许
回滚应用。

基线 rollback 仅在不存在后续 migration 时删除基线标记，不会删除业务表或
用户数据。完整撤销基线必须恢复安装前的数据库快照。

## 发布门禁

在发布首个支持现有安装升级的 tag 前，必须：

- 在发布说明中固定基线 checksum；
- 提供带锁和 checksum 校验的 migration runner；
- 测试从每个声明支持的来源版本执行升级和 rollback；
- 发布应用版本与数据库版本兼容矩阵；
- 遇到未知或更新的数据库版本时拒绝启动。

该门禁完成前，YiStack 只支持全新安装，不得宣称支持原地升级。
