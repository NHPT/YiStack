# API 接口规范

> 本文档以当前代码实现为准，描述 YiStack 后端真实可用接口、鉴权方式、用户权限与管理员权限边界。

---

## 基础信息

| 项目 | 说明 |
|------|------|
| 基础 URL | `http://localhost:8080/api` |
| 数据格式 | JSON |
| 认证方式 | Bearer Token (JWT) |
| 流式输出 | SSE (`/api/chat/generate`) |

---

## 鉴权模型

### 用户 JWT

用于用户端项目接口，JWT Claims 中常见字段：

```json
{
  "user_id": "uuid",
  "username": "john",
  "email": "john@example.com",
  "role": "user"
}
```

### 管理员 JWT

用于后台管理接口，JWT Claims 中 `role` 为：

- `admin`
- `super_admin`

### 当前权限层级

- 用户接口：要求 `role = user` 的登录态
- 管理员接口：要求 `role = admin | super_admin`
- 超级管理员接口：要求 `role = super_admin`
- 管理员功能权限：在 `admin/super_admin` 之上，再通过 RBAC 权限点控制具体功能

### 当前主要权限点

- `system.config.read`
- `system.config.update`
- `system.container_config.read`
- `system.container_config.update`
- `user.read`
- `user.update`
- `user.delete`
- `audit.read`
- `llm.provider.manage`

---

## 响应格式现状

当前活跃 HTTP JSON API 默认使用 `{ success, data/error }` 响应包装：

### 成功响应

```json
{
  "success": true,
  "data": {}
}
```

### 失败响应

```json
{
  "success": false,
  "error": "missing authorization header",
  "reason_code": "auth_required",
  "source": "next_api_proxy",
  "details": "fetch failed"
}
```

其中 `source/details/reason_code` 会在代理异常、后端不可达、鉴权失败或运行时诊断场景中按需返回。旧 `{ code, message, data }` 包装不应再作为新增或活跃接口协议使用。

---

## 接口分组总览

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/refresh` | 刷新用户 Token |
| POST | `/api/admin/auth/login` | 管理员登录 |
| POST | `/api/project/plans` | 生成技术方案 |
| POST | `/api/chat/generate` | AI 流式代码生成 |
| GET | `/api/chat/models` | 获取模型列表 |
| GET | `/api/llm/providers` | 获取启用的 LLM Provider 列表 |
| GET | `/api/llm/providers/:id` | 获取单个 Provider |
| POST | `/api/llm/providers/test` | 测试 Provider 连接 |
| GET | `/api/llm/config` | 获取当前 LLM 配置 |

### 用户鉴权接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/profile` | 获取当前用户信息 |
| PUT | `/api/auth/profile` | 更新当前用户信息 |
| POST | `/api/auth/change-password` | 修改密码 |
| POST | `/api/auth/logout` | 登出 |
| POST | `/api/project/create` | 创建项目 |
| GET | `/api/project/list` | 获取当前用户项目列表 |
| GET | `/api/project/:id` | 获取项目详情 |
| PUT | `/api/project/:id` | 更新项目 |
| DELETE | `/api/project/:id` | 删除项目 |
| POST | `/api/project/:id/restore` | 在软删除恢复窗口内恢复项目记录 |
| GET | `/api/project/:id/resource-snapshot` | 获取项目运行时资源只读快照 |
| GET | `/api/project/:id/resource-alert-readiness` | 只读查看项目资源告警策略 readiness |
| GET | `/api/project/:id/resource-alert-evaluation-preview` | 只读预览项目资源告警评估结果 |
| GET | `/api/project/:id/resource-alert-events` | 只读查询项目资源告警事件列表 |
| POST | `/api/project/:id/resource-alert-events/create` | 受控创建项目资源告警事件 |
| GET | `/api/project/:id/resource-alert-notification-readiness` | 只读查看项目资源告警通知通道 readiness |
| POST | `/api/project/:id/resource-alert-notification/send` | 显式确认后受控发送项目资源告警 webhook 通知 |
| GET | `/api/project/:id/resource-alert-enforcement-readiness` | 只读查看项目资源告警硬配额执行 readiness |
| POST | `/api/project/:id/resource-alert-enforcement/execute` | 显式确认后受控执行项目资源告警硬配额 stop_container |
| GET | `/api/project/:id/messages` | 获取项目聊天消息 |
| POST | `/api/project/:id/messages` | 保存项目聊天消息 |
| GET | `/api/project/:id/branches` | 获取项目 Git 分支列表 |
| GET | `/api/project/:id/remotes` | 获取项目 Git remote 名称只读列表 |
| GET | `/api/project/:id/remote-branches` | 获取项目 Git 远端分支只读列表 |
| POST | `/api/project/:id/remote-branches/refresh` | 受控刷新已配置 remote 的本地远端引用 |
| GET | `/api/project/:id/tags` | 获取项目 Git 标签列表 |
| POST | `/api/project/:id/tags/create` | 从当前 HEAD 受控创建本地 Git 标签 |
| POST | `/api/project/:id/tags/delete` | 受控删除本地 Git 标签 |
| GET | `/api/project/:id/stashes` | 获取项目 Git stash 只读列表 |
| POST | `/api/project/:id/stashes/apply` | 受控应用项目 Git stash |
| GET | `/api/project/:id/worktree-status` | 获取项目 Git worktree clean/dirty、dirty 文件明细与只读 diff 预览 |
| POST | `/api/project/:id/worktree/commit` | 受控提交当前 dirty Git worktree |
| GET | `/api/project/:id/backups` | 获取项目本地备份 manifest 列表 |
| POST | `/api/project/:id/backups/create` | 创建项目本地备份归档与 manifest |
| GET | `/api/project/:id/backups/policy-readiness` | 只读查看项目自动备份策略 readiness |
| GET | `/api/project/:id/backups/remote-storage-readiness` | 只读查看项目备份远端存储 readiness |
| GET | `/api/project/:id/backups/remote-inventory` | 只读列举项目备份远端对象清单和可恢复候选 |
| POST | `/api/project/:id/backups/remote-upload` | 受控上传已校验的本地备份归档与 manifest 到远端存储 |
| POST | `/api/project/:id/backups/remote-download` | 受控下载远端完整备份候选并导入本地备份缓存 |
| POST | `/api/project/:id/backups/remote-restore` | 受控下载远端完整备份候选并复用本地恢复 guard 恢复项目 |
| POST | `/api/project/:id/backups/automatic-run` | 按自动备份策略执行一次受控本地备份 |
| GET | `/api/project/:id/backups/:backup_id/download` | 下载已校验的项目本地备份归档 |
| POST | `/api/project/:id/backups/restore-preflight` | 只读预检项目备份恢复风险 |
| POST | `/api/project/:id/backups/restore` | 受控执行项目本地备份恢复 |
| GET | `/api/project/:id/branches/compare` | 获取项目 Git 分支只读对比 |
| POST | `/api/project/:id/branches/compare/apply-file` | 从分支对比目标分支受控引入单个文件 |
| POST | `/api/project/:id/branches/create` | 创建项目本地 Git 分支 |
| POST | `/api/project/:id/branches/create-from-remote` | 从本地已有远端引用创建本地跟踪分支 |
| POST | `/api/project/:id/branches/delete` | 删除项目非当前本地 Git 分支 |
| POST | `/api/project/:id/branches/rename` | 重命名项目非当前本地 Git 分支 |
| GET | `/api/project/:id/commits` | 获取项目 Git 提交历史 |
| GET | `/api/project/:id/commits/:hash` | 获取单个 Git 提交详情与 diff |
| POST | `/api/project/:id/commits/restore-file` | 从指定 Git 提交恢复单个文件 |
| POST | `/api/project/:id/start` | 启动项目容器 |
| POST | `/api/project/:id/stop` | 停止项目容器 |
| GET | `/api/project/:id/files` | 获取项目文件树 |
| GET | `/api/project/:id/files/content` | 读取项目文件 |
| PUT | `/api/project/:id/files/content` | 写入项目文件 |
| POST | `/api/project/:id/terminal/ws-ticket` | 创建终端 WebSocket 短期票据 |
| GET | `/api/project/terminal/ws?ticket=...` | 建立项目终端 WebSocket 连接 |

### 管理员鉴权接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth/refresh` | 刷新管理员 Token |
| GET | `/api/admin/auth/profile` | 获取管理员资料 |
| GET | `/api/admin/config` | 查看系统配置 |
| PUT | `/api/admin/config/:key` | 更新系统配置 |
| GET | `/api/admin/users` | 查看用户列表 |
| PUT | `/api/admin/users/:id` | 更新用户 |
| DELETE | `/api/admin/users/:id` | 删除用户 |
| GET | `/api/admin/audit` | 查看审计日志 |
| POST | `/api/llm/providers` | 创建 LLM Provider |
| PUT | `/api/llm/providers/:id` | 更新 LLM Provider |
| DELETE | `/api/llm/providers/:id` | 删除 LLM Provider |
| PUT | `/api/llm/providers/:id/default` | 设置默认 Provider |
| POST | `/api/llm/providers/reload` | 重载 Provider 配置 |

### 超级管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/admins` | 获取管理员列表 |
| GET | `/api/admin/projects` | 获取全局项目只读列表 |
| POST | `/api/admin/admins` | 创建管理员 |
| PUT | `/api/admin/admins/:id` | 更新管理员 |
| DELETE | `/api/admin/admins/:id` | 删除管理员 |
| PUT | `/api/admin/admins/:id/roles` | 更新管理员角色绑定 |
| GET | `/api/admin/roles` | 获取 RBAC 角色列表 |
| POST | `/api/admin/roles` | 创建 RBAC 角色 |
| PUT | `/api/admin/roles/:id` | 更新 RBAC 角色 |
| DELETE | `/api/admin/roles/:id` | 删除 RBAC 角色 |
| GET | `/api/admin/permissions` | 获取权限点列表 |
| GET | `/api/admin/enterprise/organization-readiness` | 只读查看企业组织 / 团队 / 成员 readiness |
| GET | `/api/admin/enterprise/organizations` | 只读查看企业组织列表 |
| POST | `/api/admin/enterprise/organizations` | 受控创建企业组织 |
| GET | `/api/admin/enterprise/teams` | 只读查看企业团队列表 |
| POST | `/api/admin/enterprise/teams` | 受控创建企业团队 |
| POST | `/api/admin/enterprise/members` | 受控绑定企业成员 |
| GET | `/api/admin/enterprise/project-ownership-readiness` | 只读查看项目归属迁移 readiness |
| GET | `/api/admin/enterprise/project-ownership-preflight` | 只读查看项目归属迁移候选预检 |
| POST | `/api/admin/enterprise/project-ownership-migrations` | 受控写入项目企业归属映射 |
| GET | `/api/admin/enterprise/project-ownership-mappings` | 只读回读项目企业归属映射 |
| GET | `/api/admin/enterprise/project-ownership-owner-guard-readiness` | 只读查看 owner guard 接线覆盖率 |
| GET | `/api/admin/enterprise/project-access-guard-switch-readiness` | 只读查看 Project Access Guard switch readiness |
| GET | `/api/admin/enterprise/project-access-guard-authorization-dry-run` | 只读查看 enterprise 授权 dry-run evidence |
| GET | `/api/admin/enterprise/project-access-guard-activation-readiness` | 只读查看 Project Access Guard activation readiness |
| GET | `/api/admin/enterprise/project-access-guard-activation-audit-readiness` | 只读查看 activation audit readiness |
| GET | `/api/admin/enterprise/audit-coverage-readiness` | 只读查看企业治理审计覆盖 readiness |
| GET | `/api/admin/enterprise/audit-export-readiness` | 只读查看企业治理审计导出前置 readiness |
| GET | `/api/admin/enterprise/audit-export-query-readiness` | 只读查看企业治理审计导出查询条件 readiness |
| GET | `/api/admin/enterprise/audit-export-task-preflight-readiness` | 只读查看企业治理审计导出任务创建 preflight readiness |
| GET | `/api/admin/enterprise/audit-export-file-format-readiness` | 只读查看企业治理审计导出文件格式 readiness |
| GET | `/api/admin/enterprise/audit-export-file-generator-readiness` | 只读查看企业治理审计导出文件生成器 readiness |
| GET | `/api/admin/enterprise/audit-export-task-create-request-readiness` | 只读查看企业治理审计导出任务创建请求契约 readiness |
| GET | `/api/admin/enterprise/audit-export-task-persistence-readiness` | 只读查看企业治理审计导出任务持久化契约 readiness |
| GET | `/api/admin/enterprise/audit-export-tasks` | 只读回读企业治理审计导出任务 |
| POST | `/api/admin/enterprise/audit-export-tasks` | 受控创建企业治理审计导出任务 queued 记录 |
| GET | `/api/admin/enterprise/audit-export-worker-readiness` | 只读查看企业治理审计导出 worker 输入与执行契约 readiness |
| GET | `/api/admin/enterprise/audit-export-worker-execution-request-readiness` | 只读查看企业治理审计导出 worker execution request 契约 readiness |
| GET | `/api/admin/enterprise/audit-export-worker-execution-request-persistence-readiness` | 只读查看企业治理审计导出 worker execution request 持久化契约 readiness |
| POST | `/api/admin/enterprise/audit-export-worker-execution-requests` | 受控持久化企业治理审计导出 worker execution request 幂等证据并写入 admin audit |
| GET | `/api/admin/enterprise/audit-export-worker-execution-dry-run-readiness` | 只读查看企业治理审计导出 worker execution dry-run 结果写入 readiness |
| POST | `/api/admin/enterprise/audit-export-worker-execution-dry-run` | 受控写入企业治理审计导出 worker execution dry-run result、checksum、row count 和 admin audit |
| GET | `/api/admin/enterprise/audit-export-worker-execution-artifact-readiness` | 只读查看企业治理审计导出 worker execution artifact 输入、命名和 checksum 契约 readiness |
| POST | `/api/admin/enterprise/audit-export-worker-execution-artifact` | 受控生成企业治理审计导出 worker execution artifact metadata、checksum、output path 并写入 admin audit |
| GET | `/api/admin/enterprise/audit-export-worker-execution-output-storage-readiness` | 只读查看企业治理审计导出 worker execution output storage 路径、字段和 checksum 契约 readiness |
| POST | `/api/admin/enterprise/audit-export-worker-execution-output-storage` | 受控写入企业治理审计导出 worker execution output storage metadata snapshot 并写入 admin audit |
| GET | `/api/admin/enterprise/audit-export-worker-execution-task-completion-readiness` | 只读查看 `output_stored` worker execution request 推进任务 `completed` 的前置契约 readiness |
| POST | `/api/admin/enterprise/audit-export-worker-execution-task-completions` | 受控使用 `output_stored` worker execution request 推进任务 `completed` 并写入 admin audit |
| GET | `/api/admin/enterprise/audit-export-task-status-transition-readiness` | 只读查看企业治理审计导出任务详情和状态转移 preflight readiness |
| POST | `/api/admin/enterprise/audit-export-task-status-transitions` | 受控转移企业治理审计导出任务状态并写入 admin audit |
| GET | `/api/admin/enterprise/audit-export-archive-expiration-readiness` | 只读查看企业治理审计导出归档/过期扫描 preflight readiness |
| GET | `/api/admin/enterprise/audit-export-delivery-report-readiness` | 只读查看企业治理审计导出交付报告 readiness |
| GET | `/api/admin/enterprise/audit-export-delivery-report-completed-task-readiness` | 只读查看 `completed` task 作为交付报告生成/存储输入证据的 readiness |
| GET | `/api/admin/enterprise/audit-export-delivery-report-generate-request-readiness` | 只读查看企业治理审计导出交付报告生成请求契约 readiness |
| GET | `/api/admin/enterprise/audit-export-delivery-report-storage-readiness` | 只读查看企业治理审计导出交付报告存储契约 readiness |
| POST | `/api/admin/enterprise/audit-export-delivery-report` | 受控生成企业治理审计导出内存 markdown 交付报告 |
| POST | `/api/admin/enterprise/audit-export-delivery-report-storage` | 受控存储企业治理审计导出交付报告 DB 记录并写入 admin audit |
| GET | `/api/admin/enterprise/audit-retention-readiness` | 只读查看企业治理审计保留策略 readiness |

Admin `/admin/enterprise` 前端页面对 `POST /api/admin/enterprise/organizations`、`POST /api/admin/enterprise/teams`、`POST /api/admin/enterprise/members` 与 `POST /api/admin/enterprise/project-ownership-migrations` 统一展示 `admin-enterprise-mutation-confirmation-snapshot` 后才提交请求。该确认层只治理前端写入触发和失败重试，不改变后端 super_admin、`confirm_migrate=true`、只写企业治理真源表等既有 API 语义。

---

## 用户认证接口

普通用户认证接口统一返回 `{ success, data/error }`。登录、注册、刷新成功时 `data` 中包含 token 事实；profile 读取和更新成功时 `data` 直接返回用户资料；修改密码和退出成功时 `data=null`。

### POST `/api/auth/register`

**请求体**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "john"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "john",
      "role": "user",
      "status": "active",
      "plan": "free"
    },
    "token": "jwt-token",
    "expires_in": 86400
  }
}
```

### POST `/api/auth/login`

**请求体**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "john",
      "role": "user",
      "status": "active",
      "plan": "free"
    },
    "token": "jwt-token",
    "expires_in": 86400
  }
}
```

### POST `/api/auth/refresh`

**请求体**

```json
{
  "refresh_token": "refresh-token"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token",
    "expires_at": 1720000000,
    "expires_in": 86400,
    "token_type": "bearer",
    "refresh_token": "new-refresh-token"
  }
}
```

### GET `/api/auth/profile`

- 需要用户 JWT

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john",
    "role": "user",
    "status": "active",
    "plan": "free",
    "created_at": "2026-07-16T00:00:00Z"
  }
}
```

### PUT `/api/auth/profile`

**请求体**

```json
{
  "username": "new-name"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "new-name",
    "role": "user",
    "status": "active",
    "plan": "free",
    "created_at": "2026-07-16T00:00:00Z"
  }
}
```

### POST `/api/auth/change-password`

**请求体**

```json
{
  "old_password": "old123",
  "new_password": "new123456"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": null
}
```

### POST `/api/auth/logout`

**请求体**

```json
{
  "refresh_token": "refresh-token"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": null
}
```

---

## 管理员认证接口

### POST `/api/admin/auth/login`

管理员登录，账号数据来自 `admins` 表，与普通用户 `users` 表完全分离。

**鉴权**

- 无

**请求体**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "admin": {
      "id": "uuid",
      "email": "admin@example.com",
      "username": "ops-admin",
      "role": "admin",
      "status": "active",
      "must_change_password": true
    },
    "token": "jwt-token",
    "expires_in": 86400
  }
}
```

### POST `/api/admin/auth/change-password`

首次登录或管理员密码被重置后修改密码。新密码至少 12 个字符，成功后返回新 JWT，并立即作废旧 JWT。

**鉴权**

- 需要管理员 JWT

**请求体**

```json
{
  "current_password": "current-password",
  "new_password": "new-password-at-least-12-characters"
}
```

### POST `/api/admin/auth/refresh`

刷新管理员 JWT。

**鉴权**

- 需要管理员 JWT

**说明**

- 当前响应会附带 `permission_codes`
- 管理后台前端会用该字段控制菜单显隐和功能按钮

**说明**

- 当前实现基于当前登录态刷新
- 当前不提交 `refresh_token`

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token",
    "expires_in": 86400
  }
}
```

### GET `/api/admin/auth/profile`

获取当前管理员资料。

**鉴权**

- 需要管理员 JWT

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@example.com",
    "username": "ops-admin",
    "role": "super_admin",
    "status": "active",
    "must_change_password": false,
    "avatar_url": "",
    "created_at": "2026-06-11T00:00:00Z"
  }
}
```

---

## 管理员业务接口

### GET `/api/admin/config`

获取系统配置列表。

**鉴权**

- 需要管理员 JWT
- 满足以下任一权限即可：
  - `system.config.read`
  - `system.container_config.read`

**说明**

- 当前返回结构化配置数组，而不是简单键值 map
- 只有 `system.container_config.read` 权限的管理员，只会看到 `container.*` 配置项
- `super_admin` 自动放行并返回全部配置

**成功响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "key": "container.runtime",
      "value": "podman",
      "value_type": "string",
      "description": "容器运行时: podman/docker",
      "updated_at": "2026-06-17T10:00:00Z"
    }
  ]
}
```

### PUT `/api/admin/config/:key`

更新指定系统配置。

**鉴权**

- 需要管理员 JWT
- 更新普通配置需要权限点 `system.config.update`
- 更新 `container.*` 配置项可使用以下任一权限：
  - `system.config.update`
  - `system.container_config.update`

**路径参数**

- `key`: 配置键名

**请求体**

```json
{
  "value": "YiStack Pro"
}
```

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "key": "site_name",
    "value": "YiStack Pro"
  }
}
```

### GET `/api/admin/users`

分页获取用户列表。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `user.read`

**查询参数**

- `limit`: 每页数量，默认 `50`
- `offset`: 偏移量，默认 `0`

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "users": [],
    "total": 0
  }
}
```

### PUT `/api/admin/users/:id`

更新指定用户的系统角色或状态。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `user.update`

**路径参数**

- `id`: 用户 ID

**请求体**

```json
{
  "role": "user",
  "status": "active"
}
```

**说明**

- 当前实现会按请求体中出现的字段做覆盖更新
- 常见用途是启用/禁用用户，或修正用户角色

### DELETE `/api/admin/users/:id`

软删除用户。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `user.delete`

**路径参数**

- `id`: 用户 ID

**说明**

- 当前实现是将用户状态改为 `deleted`
- 不是物理删除数据库行
- 前端 Admin Users 页面必须将 `deleted` 作为合法 read-side 状态展示，不应归类为 unknown 枚举漂移

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "id": "user_uuid"
  }
}
```

### GET `/api/admin/audit`

获取管理员操作审计日志。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `audit.read`

**查询参数**

- `limit`: 每页数量，默认 `50`
- `offset`: 偏移量，默认 `0`

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "logs": [],
    "total": 0
  }
}
```

---

## 项目与工作台接口

### POST `/api/project/plans`

根据需求生成多个技术方案。

- 需要用户 JWT
- 后端路由挂在已认证 Project 路由组内；未携带有效 `Authorization: Bearer <token>` 时返回后端鉴权错误
- Next 流式代理在后端返回非 2xx 时会优先保留后端 JSON 错误体，避免鉴权失败被压成字符串 JSON

```json
{
  "description": "做一个支持文章发布和评论的博客系统",
  "app_type": "web",
  "language": "zh-CN"
}
```

### POST `/api/project/create`

- 需要用户 JWT
- 当前主流程会在用户提交需求后立即创建项目记录与宿主机项目目录
- 方案确认后通过 `PUT /api/project/:id` 回写 `plan_id`、`plan_data`、`tech_stack`

```json
{
  "name": "我的博客系统",
  "description": "支持文章发布和评论",
  "app_type": "web",
  "tech_stack": "{\"runtime\":{\"profile\":\"node-nextjs\"},\"summary\":[\"TypeScript\",\"Next.js\",\"Tailwind CSS\"]}",
  "plan_id": "plan_xxx",
  "plan_data": "{...json string...}"
}
```

### GET `/api/project/list`

- 需要用户 JWT
- 仅返回当前登录用户的项目列表
- Next 代理异常会保留 `source=next_api_proxy`、`details`，后端不可达时保留 `reason_code=backend_unreachable`；前端 `ApiError` 会继续保留该 `reason_code`，项目列表页据此展示 `ApiHealth=backend_unreachable/proxy_error/auth_required/api_error/empty/ready`

### GET `/api/health`

- 同源 Next 代理只读转发到 Go 后端 `/api/health`
- Next 代理异常会复用共享 `backend-proxy` 结构化错误：`source=next_api_proxy`、`details`、`reason_code=backend_unreachable/proxy_error` 和 `recovery`
- 项目列表用户页不再自动探测该接口，也不再提供“检查后端健康”按钮；该接口保留给 smoke、启动脚本、Admin/Debug 或内部诊断流程使用
- 当 `/api/project/list` 已到达 Go 后端但返回 `auth_required` / `missing authorization header` 时，项目列表页会把该状态派生为 `AuthRecovery=backend_auth_required`，展示登录恢复建议，并提供 `project-list-auth-recovery-login` 入口跳转 `/auth?redirect=/projects`
- 该接口只确认 Next 代理到 Go backend health endpoint 的可达性，不启动后端、不停止运行时、不写项目目录、不执行 Git

### GET `/api/project/:id`

- 需要用户 JWT
- 当前实现已补 owner 校验，只允许项目 owner 访问

### PUT `/api/project/:id`

- 需要用户 JWT
- 当前实现已补 owner 校验

### DELETE `/api/project/:id`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 删除请求返回 `202 Accepted`，先将项目标记为软删除，并返回 `deletion_status=accepted`、`cleanup_status=background_cleanup_pending`、`cleanup_strategy=soft_delete_then_async_cleanup`、`cleanup_scope`、`restore_window_seconds` 和 `can_restore`
- 后台资源清理会先等待软删除恢复窗口；窗口内用户可通过 `POST /api/project/:id/restore` 显式恢复项目记录
- 窗口结束且未恢复时，后台清理聊天记录、项目目录、容器运行资源、文件服务缓存、生成文件元数据、Git 提交记录、工程状态和能力执行审计，最终执行硬删除

### POST `/api/project/:id/restore`

- 需要用户 JWT
- 仅在 `DELETE /api/project/:id` 返回的软删除恢复窗口内可用
- 后端通过 owner guard 按 `project_id + user_id` 恢复软删除项目记录，只清空 `deleted_at` 并更新 `updated_at`
- 成功响应 `data` 包含 `restore_status=restored`、`cleanup_status=cancelled_by_user_restore`、`cleanup_strategy=soft_delete_restore_before_async_cleanup`、`restored_project`、`restore_scope`、`restore_boundary` 和 `restore_window_open=false`
- 失败时返回 `409 Conflict`，`data.restore_status=blocked`、`can_restore=false`，表示恢复窗口已过期、后台清理已开始、项目不属于当前用户或项目不处于软删除状态
- 该入口只恢复项目软删标记；不启动容器、不恢复已清理资源、不执行 Git、不写备份、不回滚文件树

### GET `/api/project/:id/messages`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目持久化聊天消息列表
- 后端路由表只允许该路径的 GET 与 POST 各注册一次，避免 Hertz 因重复 `POST /api/project/:id/messages` 注册在启动期 panic

### POST `/api/project/:id/messages`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 用于保存方案消息、探讨消息和实现阶段消息
- 后端路由表只允许该路径的 GET 与 POST 各注册一次，避免消息保存入口重复注册导致后端无法启动

### GET `/api/project/:id/branches`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目容器内真实 Git 分支列表，包含分支名、当前分支标记、短提交 hash、upstream、是否存在 upstream、ahead/behind 数量和 `none/up_to_date/ahead/behind/diverged/gone` tracking 状态
- 后端只执行 `git branch --format=%(refname:short)%x1f%(HEAD)%x1f%(objectname:short)%x1f%(upstream:short)%x1f%(upstream:track,nobracket)` 读取本地 Git 真源，不触发 fetch 或远端探测
- 无提交历史时返回空列表；接口只读，不执行 fetch、pull、push、prune、分支切换、创建、删除、重命名、merge、reset 或工作区文件修改

### GET `/api/project/:id/remotes`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目容器内已配置 Git remote 名称列表，响应项仅包含 `name`
- 后端只执行 `git remote` 读取 remote 名称并去重；不会读取 remote URL，不执行 fetch、pull、push、prune、`git remote remove/prune/set-url`、checkout、switch、merge、reset 或工作区文件修改
- Workspace bootstrap 会同步 `gitRemotes` 与 `GitRemoteListStatus`，双端 Git 面板将这些 remote 名称作为受控 remote refs 刷新的候选项；如果列表不可用，仍保留手动输入兜底

### GET `/api/project/:id/remote-branches`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目容器内本地已有 Git remote refs，包含完整远端分支名、remote 名、分支名和短提交 hash
- 无提交历史或无可见远端分支时返回空列表；接口只读，只执行 `git branch -r --format=%(refname:short)%x1f%(objectname:short)` 读取，不执行 fetch、pull、push、prune、远端删除或工作区文件修改

### POST `/api/project/:id/remote-branches/refresh`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "remote": "origin"
}
```

- `remote` 会按 Git remote 名称规则校验，不能为空、不能包含路径分隔符、空格或命令参数式前缀
- 后端先读取 `git remote` 确认 remote 已存在；remote 缺失或 fetch 失败时返回 `status=blocked`
- remote 可刷新时只执行 `git fetch <remote>`，返回 `status=fetched`
- 该接口不会执行 pull、push、prune、checkout、switch、merge、reset、远端删除或工作区文件修改；刷新完成后前端会重新读取 `/remote-branches` 确认本地 remote refs 真源

### GET `/api/project/:id/tags`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目容器内真实 Git 标签列表，包含标签名、目标提交短 hash 和标签说明
- 无提交历史或无可见标签时返回空列表；接口只读，只执行 `git tag --list` 与 `git rev-list -n 1` 读取，不执行 tag create/delete/checkout/push 或任何远端写操作

### POST `/api/project/:id/tags/create`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "name": "v0.1.0"
}
```

- `name` 会按 Git ref 名称规则校验，不能为空，不能是 `refs/*` 完整引用，不能包含 `..`、换行、`@{}`、`.lock` 或命令参数式前缀
- 后端准备 runtime 后只读取当前分支、`HEAD` 和 `refs/tags/<name>` 是否已存在；目标标签已存在时返回 `status=blocked`
- 目标可创建时只执行 `git tag <name> HEAD`，返回创建标签、当前分支和目标提交短 hash
- 该接口不会 checkout、push tag、创建提交、删除标签、修改远端或修改工作区文件；前端成功后只刷新 Git 标签列表真源

### POST `/api/project/:id/tags/delete`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "name": "v0.1.0"
}
```

- `name` 会按 Git ref 名称规则校验，不能为空，不能是 `refs/*` 完整引用，不能包含 `..`、换行、`@{}`、`.lock` 或命令参数式前缀
- 后端准备 runtime 后只读取当前分支和 `refs/tags/<name>` 是否存在；目标标签不存在时返回 `status=blocked`
- 目标存在时只执行 `git tag -d <name>`，返回删除标签、当前分支和原目标提交短 hash
- 该接口不会 checkout、push、删除远端标签、创建提交、修改远端或修改工作区文件；前端成功后只刷新 Git 标签列表真源

### GET `/api/project/:id/stashes`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目容器内真实 Git stash 列表，包含 stash ref、目标提交短 hash、来源分支和 stash 说明
- 无提交历史或无可见 stash 时返回空列表；接口只读，只执行 `git stash list --format=%gd%x1f%H%x1f%gs` 读取，不执行 stash apply/pop/drop/clear、checkout、reset 或任何远端写操作

### POST `/api/project/:id/stashes/apply`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "ref": "stash@{0}"
}
```

- `ref` 只接受 `stash@{数字}` 本地 stash 引用，避免任意 ref 或 shell 片段进入写操作
- 后端会确认 stash ref 存在，并要求当前 worktree 为 clean；dirty 文件数大于 0 时返回 `status=blocked`，不会执行 apply 或创建快照
- 应用前会通过 `git stash show --patch --include-untracked --binary --full-index <ref> | git apply --check --index --whitespace=nowarn` 做 patch 可应用性预检；预检失败时返回 `blocked`
- 预检通过后只执行 `git stash apply --index <ref>`，随后创建 Git 应用快照并刷新项目文件树；不会执行 `stash pop`、`stash drop` 或 `stash clear`
- 前端成功后会清理编辑器缓存和打开文件，再重新同步 Explorer、worktree、stash 列表、提交列表与分支真源

### GET `/api/project/:id/branches/compare`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 查询参数：
  - `base`: 基准分支名
  - `head`: 目标分支名
- 返回项目容器内真实 Git 分支只读对比，包含基准分支、目标分支、目标分支 ahead commit 数、变更文件数、增删行统计、`diff --numstat` 文件预览（path、additions、deletions、is_binary、content），以及最多 8 条 `base..head` commit preview（短 hash、message、author、email、time）
- 接口会校验分支名并确认本地分支存在；只执行 `rev-parse`、`rev-list`、`diff --numstat`、路径限定 `git diff --unified=3 base...head -- <path>` 和 `git log --max-count=8 --date=iso-strict --pretty=format:%H%x1f%s%x1f%an%x1f%ae%x1f%ad base..head` 读取，不执行 checkout、merge、reset、branch switch、创建或删除分支

### POST `/api/project/:id/branches/compare/apply-file`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "base_branch": "main",
  "head_branch": "feature/demo",
  "path": "src/app/page.tsx"
}
```

- `base_branch` 与 `head_branch` 会按 Git 分支名规则校验；`path` 必须是项目相对路径，不能越过项目工作区
- 后端会确认两个分支都是本地 `refs/heads/*`，并要求当前分支仍等于 `base_branch`，防止基于旧分支对比执行写操作
- 当基准分支和目标分支相同、当前分支不匹配或目标文件存在本地 dirty 变更时返回 `status=blocked`，不会执行 checkout，也不会创建引入快照
- 目标文件必须存在于 `head_branch`；允许时仅执行路径限定 `git checkout refs/heads/<head_branch> -- <path>`，随后创建 Git 引入快照并同步提交记录
- 该接口不会修改其他文件，不执行 merge、reset、branch switch、创建或删除分支；前端成功后只清理被引入文件的编辑器缓存，并刷新 Explorer、Git 提交列表和分支对比真源

### POST `/api/project/:id/branches/create`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "name": "feature/local-branch"
}
```

- `name` 会按 Git 分支名规则校验，不能为空、不能越界或注入 Git 参数
- 后端从项目容器读取当前分支与 `HEAD`，目标本地分支已存在时返回 `status=blocked`
- 目标可创建时只执行 `git branch <name>` 从当前 `HEAD` 创建本地分支，返回 `status=created`
- 该接口不会执行 checkout、switch、merge、reset、删除分支或修改工作区文件；进入新分支仍需走分支切换 readiness guard

### POST `/api/project/:id/branches/create-from-remote`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "remote_branch": "origin/feature/demo",
  "name": "feature/demo"
}
```

- `remote_branch` 必须是本地已有 remote ref 名称，需包含 remote 与分支名，不能是 `origin/HEAD` 或 `origin/HEAD -> origin/main` 这类符号引用
- `name` 会按 Git 本地分支名规则校验，不能为空、不能越界或注入 Git 参数
- 后端从项目容器读取当前分支，确认 `refs/remotes/<remote_branch>` 存在，并确认 `refs/heads/<name>` 尚未存在；远端引用缺失或目标本地分支已存在时返回 `status=blocked`
- 目标可创建时只执行 `git branch --track <name> refs/remotes/<remote_branch>`，返回 `status=created` 且 `tracking=true`
- 该接口不会执行 fetch、pull、push、prune、远端删除、checkout、switch、merge、reset 或修改工作区文件；创建成功后前端会刷新本地分支真源，并把新分支名作为对比/readiness 目标

### POST `/api/project/:id/branches/delete`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "name": "feature/local-branch"
}
```

- `name` 会按 Git 分支名规则校验，不能为空、不能越界或注入 Git 参数
- 后端从项目容器读取当前分支并确认目标本地分支存在；当前分支不可确认、目标不存在或目标就是当前分支时返回 `status=blocked`
- 目标可删除时只执行非强制 `git branch -d <name>`，成功返回 `status=deleted`
- 如果 Git 拒绝删除未合并分支，该接口返回 `status=blocked`；不会执行 `git branch -D`
- 该接口不会执行 checkout、switch、merge、reset、强制删除、远端删除或修改工作区文件；删除成功后前端会刷新分支真源和对比/readiness 目标

### POST `/api/project/:id/branches/rename`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "previous_name": "feature/local-branch",
  "name": "feature/renamed-branch"
}
```

- `previous_name` 与 `name` 都会按 Git 分支名规则校验，不能为空、不能越界或注入 Git 参数
- 后端从项目容器读取当前分支，确认源本地分支存在并确认目标本地分支名未被占用；当前分支不可确认、源分支不存在、源分支就是当前分支、新旧名称相同或目标名已存在时返回 `status=blocked`
- 目标可重命名时只执行 `git branch -m <previous_name> <name>`，成功返回 `status=renamed`
- 该接口不会执行 checkout、switch、merge、reset、删除分支、覆盖已有分支、远端操作或修改工作区文件；重命名成功后前端会刷新分支真源，并把新分支名作为对比/readiness 目标

### GET `/api/project/:id/worktree-status`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目容器内 Git worktree 的当前分支、`clean/dirty` 状态、dirty 文件数、结构化 dirty 文件明细、tracked/staged 文件只读 diff 预览、增删行统计、提示和恢复建议
- 只执行 `git branch --show-current`、`git status --porcelain`、`git diff --numstat`、`git diff --cached --numstat` 和路径限定的 `git diff --[cached] -- <path>` 读取
- untracked 文件会出现在 dirty 文件明细中；只有 Git 能提供 diff 的 tracked/staged 文件进入 `diff` 预览
- 该接口不会执行 fetch、pull、push、prune、checkout、switch、merge、reset、branch 写操作、stash 写操作或修改工作区文件

### POST `/api/project/:id/worktree/commit`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：`{ "message": "commit message" }`
- `message` 必须非空且不超过 200 个字符；后端会准备项目 runtime，并在提交前执行 `git status --porcelain` 预检
- clean worktree 返回 `status=blocked`，不会创建提交；dirty worktree 复用既有提交快照路径执行 `git add -A` 与 `git commit -m <message>`，并在读取到提交元数据后同步 `commits` 记录
- 如果 Git 提交已经创建但提交元数据缺失或数据库记录同步失败，响应会返回 `committed_record_missing` 或 `committed_record_failed`，前端需要刷新 Git 面板确认容器 Git 真源
- 该接口不会执行 reset、stash mutation、branch switch、merge 或 selective staging；前端成功后刷新 Explorer、worktree、分支和提交列表，不清理未保存编辑器 buffer

### GET `/api/project/:id/resource-snapshot`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 返回项目运行时资源只读快照，字段包含 `status`、`project_id`、`app_type`、容器状态、容器身份、镜像、端口、`metrics_available`、CPU 百分比、内存使用/限制、网络 RX/TX、磁盘使用、读取时间、提示和恢复建议
- 后端先同步已有容器状态到内存项目对象，再读取容器 stats；容器管理器不可用、容器不存在或容器未运行时返回 `unavailable/blocked`，不会尝试启动容器
- `ready` 表示已成功读取运行中容器的资源 stats；`blocked` 表示项目运行时或容器状态不满足读取条件；`failed` 表示 stats 读取失败；`unavailable` 表示当前后端没有容器管理器；`not_required` 预留给无需 runtime 的项目类型
- 该接口只读取运行时与容器资源事实，不启动容器、不停止容器、不写项目目录、不执行 Git 操作、不创建告警、不持久化资源快照、不执行硬配额限制

### GET `/api/project/:id/resource-alert-readiness`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 只读读取 `PROJECT_RESOURCE_ALERT_ENABLED`、`PROJECT_RESOURCE_ALERT_CPU_PERCENT`、`PROJECT_RESOURCE_ALERT_MEMORY_PERCENT`、`PROJECT_RESOURCE_ALERT_DISK_BYTES` 对应的资源告警 readiness 配置
- 默认 `resource_alert_enabled=false`，返回 `status=disabled`，不会读取容器状态或资源快照
- 开启后必须至少配置一个显式阈值；CPU/内存阈值单位为百分比，磁盘阈值单位为字节，阈值 `<=0` 视为未配置
- 仅在启用且至少一个阈值已配置时复用 `GET /api/project/:id/resource-snapshot` 的服务层逻辑读取当前资源事实；快照非 `ready` 或 `metrics_available=false` 时返回 `status=unavailable`
- 返回字段包括 `status=ready/alerting/blocked/disabled/unavailable`、阈值配置状态、阈值数值、`snapshot_status`、`metrics_available`、CPU/内存/磁盘当前事实、各阈值是否超过、`any_threshold_exceeded`、可选 `resource_snapshot`、提示和恢复建议
- `alerting` 只表示当前事实超过至少一个已配置阈值；该接口不创建或持久化告警，不发送通知，不执行硬配额限制
- 该接口不启动容器、不停止容器、不写项目目录、不执行 Git 操作、不写资源快照、不创建告警、不发送通知、不执行硬配额限制

### GET `/api/project/:id/resource-alert-evaluation-preview`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 复用资源告警 readiness 读取配置、资源快照和阈值事实，再生成一次非持久化评估预览
- 返回字段包括 `status=ready/would_alert/blocked/disabled/unavailable`、`evaluation_id`、`evaluated_at`、`readiness_status`、`would_create_alert`、`triggered_count`、`triggered_thresholds`、全部 `thresholds`、嵌入的 `readiness`、提示和恢复建议
- 仅当 readiness 为 `alerting` 且至少一个阈值触发时返回 `status=would_alert` 与 `would_create_alert=true`
- 该接口不创建或持久化告警事件，不发送通知，不执行硬配额限制，不启动或停止容器，不写项目目录，不执行 Git 操作

### POST `/api/project/:id/resource-alert-events/create`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 请求体必须包含 `confirm_create=true`
- 服务层会重新执行资源告警评估预览，不接受前端提交的旧预览结果作为写入凭据
- 只有当前预览返回 `would_create_alert=true` 时才写入 `project_resource_alert_events` append-only 事件
- 返回字段包括 `status=created/ready/would_alert/blocked/disabled/unavailable`、`event_created`、`event_id`、`evaluation_id`、`created_at`、`readiness_status`、触发阈值、全部阈值、嵌入的 `evaluation_preview`、提示和恢复建议
- 缺少确认、告警事件仓储不可用、当前预览不会创建告警时均返回结构化未创建结果
- 该接口只持久化告警事件，不发送通知，不执行硬配额限制，不启动或停止容器，不写项目目录，不执行 Git 操作

### GET `/api/project/:id/resource-alert-events`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 查询参数支持 `limit`、`offset` 和可选 `status`，分页上限为 100
- 只读取 `project_resource_alert_events` append-only 事件，不重新执行资源告警评估预览
- 返回字段包括 `status=ready/empty/unavailable`、`records`、`total`、`offset`、`limit`、提示和恢复建议
- 单条记录会返回 `evaluation_id`、readiness 状态、触发阈值、全部阈值、嵌入的评估预览、原始 JSON 证据以及解析错误字段；单条历史 JSON 损坏不会阻断列表读取
- 该接口不创建或更新告警事件，不发送通知，不执行硬配额限制，不启动或停止容器，不写项目目录，不执行 Git 操作

### GET `/api/project/:id/resource-alert-notification-readiness`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 只读读取 `PROJECT_RESOURCE_ALERT_NOTIFICATION_ENABLED`、`PROJECT_RESOURCE_ALERT_NOTIFICATION_PROVIDER` 和 `PROJECT_RESOURCE_ALERT_NOTIFICATION_WEBHOOK_URL` 的配置事实
- 默认 `notification_enabled=false`，返回 `status=disabled`，不会读取告警事件仓储或发送通知
- 当前仅支持 `provider=webhook`；provider 缺失、不支持或 webhook URL 缺失时返回 `status=blocked`
- webhook URL 只在服务端内部用于 readiness 判断，响应只返回 `webhook_configured` 布尔事实，不暴露 URL 或密钥
- 通道配置就绪后只从 append-only 告警事件仓储读取最近一条 `status=created` 的候选事件；仓储缺失返回 `unavailable`，无候选返回 `empty`，存在候选返回 `ready`
- 返回字段包括 `status=ready/empty/disabled/blocked/unavailable`、`notification_enabled`、`provider`、`provider_supported`、`webhook_configured`、候选事件摘要、提示和恢复建议
- 该接口不发送通知、不更新告警事件、不重新评估资源、不执行硬配额限制、不启动或停止容器、不写项目目录、不执行 Git 操作

### POST `/api/project/:id/resource-alert-notification/send`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 请求体必须包含显式确认：

```json
{
  "confirm_send": true
}
```

- 服务层先复用 `GET /api/project/:id/resource-alert-notification-readiness` 的结果，只有 readiness `status=ready` 且最近 `created` 候选事件仍匹配时才允许发送
- 当前仅支持内部配置的 `provider=webhook`，webhook URL 只在服务端用于 HTTP POST，不会写入响应、前端提示或发送结果事件消息
- webhook payload 只包含项目 ID、源告警事件 ID、评估 ID、readiness 状态、触发阈值、全部阈值、源事件时间和消息等非敏感事实
- 同一候选事件已有 `notification_sent` 记录时返回 `status=blocked`，不会重复访问 webhook
- webhook 返回 2xx 时追加 append-only `notification_sent` 事件；请求失败或非 2xx 时追加 append-only `notification_failed` 事件，并返回脱敏失败说明
- 返回字段包括 `status=sent/failed/blocked/empty/disabled/unavailable`、`provider`、`webhook_configured`、`notification_sent`、`notification_event_created`、`notification_event_id`、`candidate_event_id`、`candidate_evaluation_id`、`http_status_code`、嵌入 readiness、提示和恢复建议
- 该接口不更新源告警事件、不重新评估资源、不执行硬配额限制、不启动或停止容器、不写项目目录、不执行 Git 操作

### GET `/api/project/:id/resource-alert-enforcement-readiness`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 只读读取 `PROJECT_RESOURCE_ALERT_ENFORCEMENT_ENABLED` 和 `PROJECT_RESOURCE_ALERT_ENFORCEMENT_MODE` 的硬配额执行前置配置；默认关闭，返回 `status=disabled`，不会读取告警事件仓储
- 当前 readiness 仅识别 `enforcement_mode=stop_container` 作为后续受控执行模式；mode 缺失或不支持时返回 `status=blocked`
- 开关和模式就绪后，只读取最近 `status=created` 的资源告警事件候选；候选必须满足 `readiness_status=alerting` 且 `triggered_count > 0`
- 该检查要求同一候选事件已有 `notification_sent` append-only 证据；缺少通知发送证据时返回 `status=blocked`，不会继续进入执行态
- 返回字段包括 `status=ready/disabled/blocked/empty/unavailable`、`enforcement_enabled`、`enforcement_mode`、`enforcement_mode_supported`、`notification_sent_required`、`notification_sent_available`、候选事件摘要、`would_enforce`、提示和恢复建议
- `would_enforce=true` 只表示后续可进入显式受控硬配额执行流程；该接口本身不执行 `stop_container`，不重新评估资源，不更新告警事件，不启动或停止容器，不写项目目录，不执行 Git 操作

### POST `/api/project/:id/resource-alert-enforcement/execute`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 请求体必须包含显式确认：

```json
{
  "confirm_execute": true
}
```

- 服务层会重新读取 `GET /api/project/:id/resource-alert-enforcement-readiness` 的结果；只有 readiness `status=ready` 且 `would_enforce=true` 时才会继续
- 当前执行入口只允许 `enforcement_mode=stop_container`
- 执行前会重新读取最近 `status=created` 候选事件，并要求候选事件 ID 仍等于 readiness 返回的 `candidate_event_id`；候选变化时返回 `status=blocked`，不会停止容器
- 同一候选事件已有 `enforcement_executed` append-only 记录时返回 `status=blocked`，不会重复停止容器
- 通过 guard 后复用既有 `StopProjectContainer` 受控停止链路；只有停止成功后才追加 `enforcement_executed` 事件
- 停止失败时返回 `status=failed` 和 `stop_result`，不会追加 `enforcement_executed` 事件
- 返回字段包括 `status=executed/failed/blocked/disabled/empty/unavailable`、`enforcement_executed`、`enforcement_event_created`、`enforcement_event_id`、候选事件摘要、`mode`、嵌入 readiness、`stop_result`、提示和恢复建议
- 该接口不更新源告警事件、不重新评估资源、不写项目目录、不执行 Git 操作；唯一允许的运行时动作是通过既有受控链路停止项目容器，并在成功后写入 append-only 执行证据

### GET `/api/project/:id/backups`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 从 `PROJECT_BACKUP_DIR` / `ProjectConfig.BackupDir` 下的项目备份子目录只读扫描 `*.manifest.json`
- 返回 `status=ready` 时包含 `backup_count` 和 `backups`；每条记录包含 `status`、`backup_id`、`file_name`、`manifest_name`、`size_bytes`、`file_count`、`directory_count`、`excluded_paths`、`checksum_sha256`、`created_at`、`source`、`message` 和 `recovery`
- 单个 manifest 损坏、身份字段不可信或归档缺失时，不会让整个列表失败；对应记录返回 `manifest_invalid` 或 `archive_missing`
- 可信本地备份来源包括手动入口 `source=project_host_directory` 与自动策略入口 `source=automatic_policy`
- 备份目录不存在或没有 manifest 时返回 `status=empty`
- 该接口不创建备份目录、不启动容器、不读取项目代码目录、不执行 Git 操作、不恢复、不上传远端存储

### POST `/api/project/:id/backups/create`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 从受控项目宿主目录创建本地 `.tar.gz` 备份归档，并写入同名 `manifest.json`
- 备份目录来自 `PROJECT_BACKUP_DIR` / `ProjectConfig.BackupDir`，单项目归档写入备份根目录下的项目子目录
- 项目目录必须通过后端项目归属校验和宿主路径 guard，防止跨项目或跨根目录读取
- 返回 `status=created` 时包含 `backup_id`、`file_name`、`manifest_name`、`size_bytes`、`file_count`、`directory_count`、`excluded_paths`、`checksum_sha256`、`created_at`、`source`、`message` 和 `recovery`
- 返回 `status=blocked` 时不会确认创建归档，响应会包含阻断原因和恢复建议
- 备份会排除 `.cache`、`.next`、`.turbo`、`.yistack`、`build`、`coverage`、`dist`、`node_modules`，同时排除 symlink 和非 regular 文件
- 该接口不启动容器、不执行 Git 写操作、不上传远端存储；备份列表由只读 `GET /api/project/:id/backups` 提供，自动备份策略 readiness 由 `GET /api/project/:id/backups/policy-readiness` 提供，自动策略受控执行由 `POST /api/project/:id/backups/automatic-run` 提供，下载由 `GET /api/project/:id/backups/:backup_id/download` 提供；后台自动调度循环复用同一受控自动备份入口，远端存储仍待后续治理任务

### GET `/api/project/:id/backups/policy-readiness`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 只读读取 `ProjectConfig.AutoBackup`、`ProjectConfig.BackupDir` 和本地备份 manifest 列表事实，用于判断后续自动备份调度是否具备策略前置条件
- 返回 `status=ready/empty/disabled/blocked`、`auto_backup_enabled`、`backup_dir_configured`、`backup_dir`、`available_backup_count`、`latest_available_backup`、`message` 和 `recovery`
- `ready` 表示自动备份配置开启、备份目录已配置且当前存在可用本地备份；`empty` 表示策略开启但还没有可用本地备份；`disabled` 表示 `PROJECT_AUTO_BACKUP=false`；`blocked` 表示策略关键配置缺失
- 该接口不创建备份、不创建备份目录、不读取项目代码目录、不启动容器、不执行 Git 操作、不恢复或下载备份、不上传远端存储

### GET `/api/project/:id/backups/remote-storage-readiness`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 只读读取 `ProjectConfig.RemoteBackupEnabled / RemoteBackupProvider / RemoteBackupBucket / RemoteBackupPrefix / RemoteBackupEndpoint / RemoteBackupRegion / RemoteBackupCredentials` 与本地备份 manifest 列表事实，用于判断后续远端备份上传是否具备前置条件
- 返回 `status=ready/empty/disabled/blocked`、`remote_backup_enabled`、`provider`、`provider_configured`、`bucket`、`bucket_configured`、`prefix`、`endpoint`、`region`、`credentials_configured`、`available_backup_count`、`latest_available_backup`、`message` 和 `recovery`
- `credentials_configured` 只表示 `PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID` 与 `PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY` 是否同时配置，响应不会返回密钥值
- `ready` 表示远端存储配置开启、provider 为 `s3`、bucket 与凭据已配置且存在可用本地备份；`empty` 表示远端配置就绪但当前没有可上传的本地备份；`disabled` 表示 `PROJECT_BACKUP_REMOTE_ENABLED=false`；`blocked` 表示 provider、bucket 或凭据等关键配置缺失或不受支持
- 该接口不创建备份、不创建备份目录、不读取项目代码目录、不初始化云 SDK、不访问网络、不上传或下载远端对象、不启动容器、不执行 Git 操作

### GET `/api/project/:id/backups/remote-inventory`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 只读读取 `ProjectConfig.RemoteBackupEnabled / RemoteBackupProvider / RemoteBackupBucket / RemoteBackupPrefix / RemoteBackupEndpoint / RemoteBackupRegion / RemoteBackupCredentials`，在配置与凭据 guard 通过后通过 S3/S3-compatible `ListObjectsV2` 列举 `prefix/project_id/` 下的远端对象
- 返回 `status=ready/empty/disabled/blocked/failed`、provider、bucket、prefix、endpoint、region、`credentials_configured`、`object_count`、`candidate_count`、`complete_count`、`candidates`、`message` 和 `recovery`
- `candidates` 按 `prefix/project_id/backup_id/*` 聚合远端对象，单条候选返回 `backup_id`、`status=complete/manifest_only/archive_only`、归档/manifest object key、大小与 last_modified；`complete` 表示同一 `backup_id` 下同时存在 `.tar.gz` 与 `.manifest.json`
- `credentials_configured` 只表示 `PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID` 与 `PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY` 是否同时配置，响应不会返回密钥值
- `empty` 表示远端配置可读但当前未发现候选对象；`failed` 表示 ListObjectsV2 请求或响应解析失败；`disabled/blocked` 表示远端读取 guard 未通过且不会访问远端
- 该接口不读取本地备份目录、不读取项目代码目录、不创建、覆盖或删除远端对象、不下载远端对象内容、不恢复备份、不启动容器、不执行 Git 操作

### POST `/api/project/:id/backups/remote-upload`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 请求体必须包含显式 `backup_id`
- 后端先复用远端存储 readiness，只有 `status=ready` 时才继续；随后复用本地备份下载前校验，确认可信 manifest、归档 regular 文件属性、归档大小和 SHA256 checksum
- 成功时通过 S3/S3-compatible HTTP PUT 上传归档和 manifest，返回 `status=uploaded`、`uploaded=true`、provider、bucket、prefix、`archive_object_key`、`manifest_object_key`、归档/manifest 大小、`checksum_sha256`、`checksum_verified`、`credentials_configured`、`message` 和 `recovery`
- readiness 未就绪、`backup_id` 不安全、本地 manifest/归档校验失败时返回 `status=blocked` 且不会访问远端存储；远端 HTTP 上传失败时返回 `status=failed`，用于提示可能存在归档或 manifest 部分上传风险
- 响应只暴露 `credentials_configured` 布尔值，不返回 `PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID` 或 `PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY`
- 该接口只读取已校验的本地备份归档和 manifest，不创建新备份、不读取项目代码目录、不启动容器、不执行 Git 操作、不下载远端对象、不恢复备份

### POST `/api/project/:id/backups/automatic-run`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 按当前 `ProjectConfig.AutoBackup` 与 `ProjectConfig.BackupDir` 执行一次受控本地备份；`PROJECT_AUTO_BACKUP=false` 或 `PROJECT_BACKUP_DIR` 为空时返回 `status=blocked`
- 成功时复用项目本地备份创建边界，返回 `status=created`、备份归档、manifest、文件/目录数量、排除路径、归档大小、SHA256、`source=automatic_policy`、`message` 和 `recovery`
- 手动备份仍使用 `source=project_host_directory`；自动策略执行入口使用 `source=automatic_policy`，便于后续调度和治理区分来源
- 该接口只执行一次显式请求驱动的本地备份；后台 scheduler loop 会复用同一受控服务入口，不通过该 HTTP 请求启动；该接口不创建远端对象、不启动容器、不执行 Git 操作、不恢复或下载备份、不上传远端存储
- 后台自动备份调度由后端启动时根据 `PROJECT_AUTO_BACKUP=true`、`PROJECT_BACKUP_DIR` 非空和 `PROJECT_AUTO_BACKUP_INTERVAL_SECONDS>0` 启用；每轮只枚举项目并调用受控自动备份服务，单轮失败不会绕过 guard 或触碰远端存储

### GET `/api/project/:id/backups/:backup_id/download`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 路径参数 `backup_id` 必须是安全的本地备份身份字符串，后端不会接受路径分隔符或空值
- 下载前会读取可信 manifest，校验 manifest 身份、归档 regular 文件属性、归档大小和 SHA256 checksum
- 响应为 `application/gzip` 附件流，包含 `Content-Disposition`、`X-YiStack-Backup-ID`、`X-YiStack-Backup-Manifest`、`X-YiStack-Backup-Checksum-SHA256` 和 `X-YiStack-Backup-Checksum-Verified` 等下载校验证据
- 该接口只读取本地备份 manifest 与归档，不写项目目录、不启动容器、不执行 Git 操作、不恢复备份、不上传远端存储，也不触碰远端对象存储

### POST `/api/project/:id/backups/restore-preflight`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 请求体：`{ "backup_id": "project-20260716T000000.000000000Z" }`
- 该接口只读检查指定本地备份是否具备后续恢复条件，返回 `status=ready` 或 `status=blocked`
- 预检会读取并校验 manifest 身份字段、归档文件存在性、归档大小、SHA256 checksum、tar.gz 条目路径安全性和目标项目目录同名路径冲突
- 返回字段包含 `can_restore`、`archive_entry_count`、`conflict_paths`、`unsafe_paths`、`checksum_verified`、`message` 和 `recovery`
- `ready` 只表示 manifest、归档和目标目录风险预检通过；当前接口不会解包归档、不会写入项目目录、不会启动容器、不会执行 Git 操作、不会下载或上传远端存储

### POST `/api/project/:id/backups/restore`

- 需要用户 JWT
- 需要当前用户拥有该项目
- 请求体：`{ "backup_id": "project-20260716T000000.000000000Z", "confirm_restore": true }`
- 该接口执行受控本地备份恢复，必须先通过同一服务内的恢复预检，且必须显式传入 `confirm_restore=true`
- 恢复前会再次复核可信 manifest、归档存在性、regular 文件属性、归档大小与 SHA256 checksum，防止预检与写入之间归档被替换
- 恢复过程先将 `.tar.gz` 解包到目标项目目录同级的临时 staging 目录，仅接受 regular file 与 directory 条目，并通过路径 guard 阻断越界路径；发布阶段只在目标路径不存在时通过 `os.Rename` 写入项目宿主目录
- 返回 `status=restored` 或 `status=blocked`，字段包含 `restored`、`restored_files`、`restored_directories`、`archive_entry_count`、`conflict_paths`、`unsafe_paths`、`checksum_verified`、`message` 和 `recovery`
- 该接口不启动容器、不执行 Git 操作、不下载、不上传远端存储，也不会覆盖目标目录中已存在的同名路径

### GET `/api/project/:id/commits`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 返回项目目录下真实 Git 提交历史，包含提交摘要和文件变更统计，不批量返回完整 patch 内容

### GET `/api/project/:id/commits/:hash`

- 需要用户 JWT
- 当前实现已补 owner 校验
- `hash` 支持 7 到 64 位十六进制 Git commit hash
- 返回单个提交的元数据、文件变更统计与完整 diff patch，用于 Workspace Git 面板按需查看详情

### POST `/api/project/:id/commits/restore-file`

- 需要用户 JWT
- 当前实现已补 owner 校验
- 请求体：

```json
{
  "hash": "a1b2c3d",
  "path": "src/app/page.tsx"
}
```

- `hash` 支持 7 到 64 位十六进制 Git commit hash；`path` 必须是项目相对路径，不能越过项目工作区
- 后端会确认提交和目标文件存在，并在执行恢复前检查目标文件是否存在本地 dirty 变更
- 当目标文件 dirty 时返回 `status=blocked`，不会执行 checkout，也不会创建恢复快照
- 当恢复成功时返回 `status=restored`，会创建新的 Git 恢复快照，并由 Workspace 刷新 Explorer 与 Git 提交列表

### POST `/api/project/:id/start`
### POST `/api/project/:id/stop`
### POST `/api/project/:id/runtime-activity`
### GET `/api/project/:id/files`
### GET `/api/project/:id/files/content`
### PUT `/api/project/:id/files/content`
### POST `/api/project/:id/terminal/ws-ticket`
### GET `/api/project/terminal/ws?ticket=...`

- `ws-ticket` 接口需要用户 JWT，并校验项目 owner
- WebSocket 连接使用短期 ticket 完成握手，不直接暴露长期登录 JWT
- 当前实现均已补 owner 校验
- `POST /api/project/:id/start` 只应在方案确认后调用
- 所有项目类型都必须启动 runtime，容器不可用时接口应失败，不降级到宿主机执行
- 真正使用哪类镜像由 `tech_stack.runtime.profile` 决定
- `POST /api/project/:id/runtime-activity` 用于 Workspace / Preview 心跳刷新运行中容器的空闲活动时间；它只返回结构化 activity touch 结果，不启动 runtime、不停止 runtime、不替代 Runtime Health 只读诊断
- 当前前端正式链路不再暴露独立的 `/api/project/:id/exec` 代理接口
- 终端接口使用真实容器 PTY 会话，当前正式链路为 WebSocket，支持持续 shell 上下文、输入输出流式传输和窗口 resize

`POST /api/project/:id/runtime-activity` 成功响应示例：

```json
{
  "success": true,
  "data": {
    "projectId": "proj_xxx",
    "activityStatus": "touched",
    "containerStatus": "running",
    "source": "runtime_activity_api",
    "message": "项目运行时活动时间已刷新",
    "updatedAt": "2026-07-16T10:00:00Z"
  }
}
```

---

## AI 生成接口

### POST `/api/chat/generate`

当前工作台使用的流式代码生成接口。

- 需要用户 JWT
- 后端路由挂在已认证 Chat 路由组内；未携带有效 `Authorization: Bearer <token>` 时返回后端鉴权错误
- Next 流式代理在后端返回非 2xx 时会优先保留后端 JSON 错误体，便于前端按真实后端错误分类恢复

```json
{
  "prompt": "请基于已确认方案实现首页与文章列表",
  "project_id": "proj_xxx",
  "app_type": "web",
  "project_name": "我的博客系统",
  "mode": "implement",
  "online": false,
  "provider": "deepseek",
  "temperature": 0.5,
  "conversation_stage": "implementation",
  "plan_context": "已确认使用 Next.js + Tailwind CSS 实现博客系统"
}
```

当前请求字段说明：

- `project_id` / `app_type` / `project_name`
  - 当前主链路统一使用 snake_case
  - 前端活跃代码不再默认依赖 `projectId` / `appType` / `projectName` 兼容写法
- `mode`: `discuss | implement`
  - `discuss`: 只进行方案分析、实现建议和风险讨论，不写文件、不执行命令
  - `implement`: 进入当前实现链路，写文件、更新项目上下文，并触发 Git 提交
- `online`: 是否启用联网模式标记
  - 当前版本已进入后端 `online_context` 决策，并通过 `resolve-online-context` workflow step 对前端可见
  - 探讨和实现 system prompt 都会注入该决策；未配置真实搜索 / 抓取 provider 时会明确标记 `online_context_provider_unavailable`，模型不得声称已联网核验
  - `online=true` 会附加可选 MCP 能力 `online_context.search_crawl`，provider 未启用、execution policy 未允许、runner 未注入或 runner 返回 blocked 时只写入 skipped 诊断并继续主链路；当受控 runner 返回产物时，prompt/meta 会注入 `provider_executed` 和 provider artifact
  - 真实外部请求仍必须沿 Capability runner、网络 allowlist 与审计边界接入；未配置受控 provider 时不会执行搜索、抓取或外部核验
- `conversation_stage`
  - 表示当前对话处于需求澄清、方案确认或实现阶段等哪一类上下文
- `plan_context`
  - 用于把当前已确认方案摘要传递到生成链路

实现模式生成结果协议：

- LLM 必须返回 `generation_result.v2`，根字段固定为 `schema_version/operations/message/commands`
- 支持 OpenAI-compatible JSON Schema 的 Provider 会收到严格 `response_format=json_schema`
- `operations` 支持 `create/replace/patch/delete`；replace/patch/delete 必须携带生成前快照中的 SHA-256 `base_hash`，服务端应用后计算 `result_hash`
- 生成前快照仅包含受限 UTF-8 文本，排除 `.git`、`.yistack`、`.env`、密钥、二进制、锁文件和超限内容
- 目标路径存在用户 dirty 变更、base hash 不一致、patch 上下文非唯一或 preflight 后并发变化时返回 `generation_file_conflict`；批次部分失败会逆序回滚
- Provider 明确返回不支持 JSON Schema 时，后端会在同一 Provider 上回退为 Prompt 严格 JSON，但最终仍执行同一服务端 Schema 校验
- 解析失败返回 `generation_schema_invalid`，不会生成 README 兜底文件
- 推荐命令仅允许精确依赖准备 allowlist，校验后使用结构化 argv 在 `/workspace` 执行；error、timeout、nil result 或非零退出码返回 `generation_command_failed`
- 上述失败会阻断 Preview、Git 版本和成功 `done`
- 生成文件和推荐命令成功后，后端会在项目容器 `/workspace` 内执行 stack-aware Project Validation Gate
- 当前支持 static HTML、Next.js、Vite/React/Vue、通用 Node、Go 和 Python；Next/Vite 缺 build 会失败，缺 test/lint 记录 `skipped_with_reason`
- 初始项目检查失败返回 `project_validation_failed` 并携带 stack、check、command、exit_code、duration、截断 output、结构化 diagnostics 和 failure fingerprint；默认最多执行 2 轮有限自动修复，每轮只允许初始 attempt 路径并重新运行完整 Project Validation Gate
- 修复结果无效、预算耗尽或重复错误指纹分别返回 `repair_result_invalid`、`repair_budget_exhausted`、`repair_repeated_failure`；失败 attempt 不创建 Git 版本
- YiStack 仓库的 `pnpm yes:validate` 仅用于平台开发自检，不是生成项目通过证据

SSE 事件：

- `start`
- `progress`
- `chunk`
- `step`
- `done`
- `guidance`
- `error`

成功 `done` 事件包含：

```json
{
  "schemaVersion": "generation_result.v2",
  "operations": [],
  "files": [],
  "commands": [],
  "repair": null,
  "projectValidation": {
    "status": "passed",
    "stack": "node-nextjs",
    "runtime_profile": "node-nextjs",
    "package_manager": "pnpm",
    "checks": [],
    "diagnostics": []
  },
  "gitCommitCreated": true
}
```

结构化失败事件示例：

```json
{
  "code": "generation_command_failed",
  "blocking": true,
  "stage": "generation_command",
  "message": "生成命令执行失败",
  "details": "build failed",
  "command": "pnpm build",
  "exit_code": 1
}
```

项目级校验失败示例：

```json
{
  "code": "project_validation_failed",
  "blocking": true,
  "stage": "project_validation",
  "check": "build",
  "command": "pnpm run build",
  "exit_code": 1,
  "project_validation": {
    "status": "failed",
    "stack": "node-nextjs",
    "checks": []
  }
}
```

文件冲突或有限修复停止时，`error` 事件还会携带 `file_conflict` 或 `repair`：

```json
{
  "code": "repair_budget_exhausted",
  "blocking": true,
  "stage": "generation_repair",
  "project_validation": {"status": "failed", "failure_fingerprint": "sha256..."},
  "repair": {"status": "failed", "max_attempts": 2, "attempts": [], "stop_reason": "repair_budget_exhausted"}
}
```

---

## LLM Provider 接口

### 公开只读接口

- `GET /api/llm/providers`
- `GET /api/llm/providers/:id`
- `POST /api/llm/providers/test`
- `GET /api/llm/config`

普通 `/api/llm/config` 仅用于只读查看当前运行期 LLM 配置，不提供 `PUT` 写入口。配置写入必须走 Admin 配置或 LLM Provider 管理接口，避免公开普通接口绕过管理员权限与审计边界。

### 管理接口

以下接口要求管理员 JWT，并要求具备 `llm.provider.manage` 权限；`super_admin` 自动放行：

### POST `/api/llm/providers`

创建新的 LLM Provider。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `llm.provider.manage`

**请求体示例**

```json
{
  "name": "deepseek",
  "display_name": "DeepSeek",
  "type": "cloud",
  "api_key": "sk-xxx",
  "base_url": "https://api.deepseek.com/v1",
  "model": "deepseek-chat",
  "enabled": true,
  "is_default": false,
  "priority": 10,
  "sort_order": 1,
  "extra_config": ""
}
```

### PUT `/api/llm/providers/:id`

更新指定 Provider。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `llm.provider.manage`

**路径参数**

- `id`: Provider ID

### DELETE `/api/llm/providers/:id`

删除指定 Provider。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `llm.provider.manage`

**路径参数**

- `id`: Provider ID

### PUT `/api/llm/providers/:id/default`

设置默认 Provider。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `llm.provider.manage`

**路径参数**

- `id`: Provider ID

### POST `/api/llm/providers/reload`

重载数据库中的 Provider 配置到运行时内存。

**鉴权**

- 需要管理员 JWT
- 需要权限点 `llm.provider.manage`

---

## 超级管理员 RBAC 接口

### GET `/api/admin/permissions`

获取所有权限点。

**鉴权**

- 需要超级管理员 JWT

**成功响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "perm_uuid_1",
      "code": "system.container_config.update",
      "name": "更新容器配置",
      "description": "修改容器运行时配置"
    }
  ]
}
```

### GET `/api/admin/roles`

获取角色列表，返回角色基础信息及其绑定的权限点。

**鉴权**

- 需要超级管理员 JWT

**成功响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "role_uuid_1",
      "name": "ops_admin",
      "display_name": "运营管理员",
      "description": "负责用户与配置管理",
      "is_system": false,
      "status": "active",
      "permissions": [
        {
          "id": "perm_uuid_1",
          "code": "user.read",
          "name": "查看用户"
        }
      ]
    }
  ]
}
```

### POST `/api/admin/roles`

创建自定义后台角色。

**鉴权**

- 需要超级管理员 JWT

**请求体**

```json
{
  "name": "ops_admin",
  "display_name": "运营管理员",
  "description": "负责用户与配置管理",
  "status": "active",
  "permission_ids": ["perm_uuid_1", "perm_uuid_2"]
}
```

**说明**

- `name` 和 `display_name` 必填
- `permission_ids` 为要绑定的权限点 ID 数组
- 创建的角色默认是自定义角色，`is_system = false`

### PUT `/api/admin/roles/:id`

更新指定自定义角色。

**鉴权**

- 需要超级管理员 JWT

**路径参数**

- `id`: 角色 ID

**请求体**

```json
{
  "display_name": "新的角色名称",
  "description": "新的说明",
  "status": "active",
  "permission_ids": ["perm_uuid_1"]
}
```

### DELETE `/api/admin/roles/:id`

删除指定自定义角色。

**鉴权**

- 需要超级管理员 JWT

**路径参数**

- `id`: 角色 ID

**说明**

- 系统内置角色不可删除
- 删除时会同时删除角色和权限、管理员绑定关系
- Admin Roles 页面必须通过 `admin-role-delete-confirmation-snapshot` 结构化确认后才调用该接口；系统角色确认快照展示 `blocked` 风险且不提交 DELETE

### GET `/api/admin/admins`

获取管理员列表，返回系统角色、绑定的自定义角色和聚合后的权限点。

**鉴权**

- 需要超级管理员 JWT

**查询参数**

- `page`: 页码，默认 `1`
- `pageSize`: 每页数量，默认 `20`

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "id": "admin_uuid_1",
        "email": "ops@example.com",
        "username": "ops-admin",
        "role": "admin",
        "status": "active",
        "assigned_roles": [
          {
            "id": "role_uuid_1",
            "name": "ops_admin"
          }
        ],
        "permission_codes": [
          "user.read",
          "system.config.read"
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### GET `/api/admin/projects`

获取超级管理员全局项目只读列表，用作 Admin 运维观测的数据入口。该接口只读取项目记录和已有 runtime-status 文件快照，不签发 preview token、不读取文件树、不启动或停止 runtime。

**鉴权**

- 需要超级管理员 JWT

**查询参数**

- `page`: 页码，默认 `1`
- `pageSize`: 每页数量，默认 `20`，最大 `100`

**成功响应示例**

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "project_uuid_1",
        "project_id": "proj_202607140001",
        "user_id": "user_uuid_1",
        "name": "Project 1",
        "app_type": "web",
        "tech_stack": "{}",
        "container_port": 3000,
        "internal_port": 3000,
        "container_status": "running",
        "runtime_status": {
          "projectId": "proj_202607140001",
          "status": "ready",
          "containerStatus": "running",
          "phase": "ready",
          "message": "开发环境已就绪",
          "updatedAt": "2026-07-14T12:08:00Z"
        },
        "created_at": "2026-07-14T12:00:00Z",
        "updated_at": "2026-07-14T12:10:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### POST `/api/admin/admins`

创建管理员账号。

**鉴权**

- 需要超级管理员 JWT

**请求体**

```json
{
  "email": "ops@example.com",
  "username": "ops-admin",
  "password": "password123",
  "role": "admin",
  "status": "active",
  "avatar_url": "",
  "role_ids": ["role_uuid_1"]
}
```

**说明**

- `email`、`username`、`password` 必填
- `role` 是系统角色，只允许 `admin` 或 `super_admin`
- `role_ids` 是要绑定的 RBAC 自定义角色 ID 数组

### PUT `/api/admin/admins/:id`

更新管理员账号。

**鉴权**

- 需要超级管理员 JWT

**路径参数**

- `id`: 管理员 ID

**请求体**

```json
{
  "username": "new-admin-name",
  "status": "active",
  "role": "admin",
  "role_ids": ["role_uuid_1", "role_uuid_2"]
}
```

**说明**

- 可更新 `email`、`username`、`password`、`role`、`status`、`avatar_url`
- 若传入 `role_ids`，则会覆盖该管理员当前的角色绑定
- 当前登录的 `super_admin` 不能把自己降级成普通 `admin`

### DELETE `/api/admin/admins/:id`

删除管理员账号。

**鉴权**

- 需要超级管理员 JWT

**路径参数**

- `id`: 管理员 ID

**说明**

- 当前登录的 `super_admin` 不能删除自己
- Admin Managers 页面必须通过 `admin-manager-delete-confirmation-snapshot` 结构化确认后才调用该接口
- 当前接口删除管理员账号记录，不是 soft-delete 状态切换

### PUT `/api/admin/admins/:id/roles`

覆盖更新指定管理员的自定义角色绑定。

**鉴权**

- 需要超级管理员 JWT

**路径参数**

- `id`: 管理员 ID

**请求体**

```json
{
  "role_ids": ["role_uuid_1", "role_uuid_2"]
}
```

---

## Generation Job 与 SSE Replay

### POST `/api/chat/generate`

生成请求会先创建或复用 durable Generation Job，再订阅持久事件。请求体可传 `idempotency_key`，也可使用 `Idempotency-Key` 请求头；同一用户的相同 key 只执行一次。响应为 SSE，并返回 `X-Generation-Job-ID`。

SSE `id` 等于该 Job 内单调递增的 event sequence：

```text
id: 12
event: progress
data: {"generation_job_id":"...","generation_event_sequence":12,"generation_event_key":"event:000012:progress","message":"..."}
```

HTTP 连接断开只终止当前订阅，不取消后台 Job。用户主动停止、新请求替换旧请求或 lease 过期通过持久状态转换处理。

### GET `/api/project/:id/generation/status`

返回项目最新 Generation Job 摘要：

```json
{
  "success": true,
  "project_id": "project-id",
  "generation_active": true,
  "generation_job": {
    "id": "job-uuid",
    "idempotency_key": "assistant-message-id",
    "status": "validating",
    "current_attempt": 2,
    "last_event_sequence": 12,
    "provider": "provider-name",
    "model": "model-id"
  }
}
```

`status` 为 `queued/running/repairing/validating/previewing/succeeded/failed/cancelled/interrupted` 之一。

### GET `/api/project/:id/generation/events`

回放并跟随持久事件。可传 `job_id`，不传时读取项目最新 Job；使用 `cursor` query 或 `Last-Event-ID` header 指定已消费 sequence，服务端只返回更大的事件。接口要求项目 owner 权限，且指定 Job 必须属于路径中的项目。

```text
GET /api/project/project-id/generation/events?job_id=job-uuid&cursor=12
Last-Event-ID: 12
```

### POST `/api/project/:id/generation/stop`

原子地把当前 active Job 转为 `cancelled` 并追加唯一 terminal error event；重复停止不会创建重复终态。

---

## 安全说明

### 已实现

- 所有项目接口位于用户 JWT 路由组内
- 所有项目读写/容器/执行接口均已补 owner 校验
- 管理员与普通用户账号表分离
- `super_admin` 可管理管理员与 RBAC 角色
- 管理员业务接口按权限点做能力控制

### 当前仍需继续增强

- `chat/generate` 与 `project/plans` 已要求用户 JWT；后续可继续按业务策略补充更细粒度的生成配额、项目级能力限制或模型调用限流
- 更细粒度的后台菜单权限和前端权限渲染尚未实现
- 权限点目前只覆盖当前已开放的后台功能，后续新增后台模块时需要同步扩展

### Generation Browser Acceptance (EVAL-001)

`POST /api/chat/generate` may include an optional browser smoke contract:

```json
{
  "browser_acceptance": {
    "required_text": ["Application ready"],
    "actions": [
      {"type": "click", "selector": "[data-testid='primary-action']", "expect_text": "Completed"}
    ]
  }
}
```

After project validation and Preview readiness, the backend resolves the project container endpoint and calls the loopback Playwright worker. Browser acceptance runs before Git commit and emits a durable `browser-acceptance` workflow step. A blocking console, page, network, DOM, interaction or screenshot failure terminates the Job with `browser_acceptance_failed`; success payloads include `browserAcceptance` evidence with relative `runtime/generation-evidence` artifact paths. The worker never accepts a model-provided worker endpoint or unrestricted public target URL.
