# 后端认证系统实现总结

## 完成的功能

### 1. 数据库配置统一化
- 使用 `DB_TYPE` 环境变量统一指定数据库类型
- 支持的数据库类型：
  - `supabase` - Supabase REST API 方式
  - `postgres` - PostgreSQL
  - `mysql` - MySQL
  - `oracle` - Oracle

### 2. Supabase 认证服务
- **pkg/auth/service.go** - Supabase 认证服务核心实现
  - `Register()` - 用户注册（使用 bcrypt 加密密码）
  - `Login()` - 用户登录
  - `RefreshToken()` - 刷新 Token
  - `ChangePassword()` - 修改密码
  - `GetUserByID()` - 获取用户信息
  - `UpdateUser()` - 更新用户信息
  - `Logout()` - 登出

### 3. 认证处理器
- **internal/handler/auth_handler.go** - 统一的认证处理器
  - 支持 Supabase 和传统数据库两种后端
  - 公开接口：`/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`
  - 认证接口：`/api/auth/profile`, `/api/auth/profile` (PUT), `/api/auth/change-password`, `/api/auth/logout`

### 4. 管理员认证
- **internal/handler/admin_handler.go** - 管理员处理器
  - `/api/admin/auth/login` - 管理员登录
  - `/api/admin/auth/profile` - 获取管理员信息

### 5. 中间件增强
- JWT 认证中间件
- 角色权限中间件 (`RequireRole`)
- 限流中间件
- CORS 中间件（支持配置化）

### 6. 配置更新
- **config/config.go** - 新增：
  - `CORSConfig` - CORS 配置结构
  - `RefreshTokenExpiry` - Refresh Token 过期时间

## 环境变量配置

```env
# 数据库配置
DB_TYPE=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT 配置
JWT_EXPIRY=86400
REFRESH_TOKEN_EXPIRY=604800
# 生产环境必须设置至少 32 字节的随机值；留空时每次启动生成临时密钥
JWT_SECRET=

# CORS 配置
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With
```

## API 路由

### 公开认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/admin/auth/login` | 管理员登录 |

### 需要认证的接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/profile` | 获取用户信息 |
| PUT | `/api/auth/profile` | 更新用户信息 |
| POST | `/api/auth/change-password` | 修改密码 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/admin/auth/profile` | 获取管理员信息 |

## Supabase 数据库设置

在 Supabase SQL Editor 中执行 `supabase-schema.sql` 来创建必要的表和函数。

### 创建管理员账号
SQL 文件末尾包含创建默认管理员账号的语句：
- 邮箱: `admin@yistack.com`
- 初始密码: `admin123`
- 首次登录后必须修改密码；完成前不能访问管理接口

## 前端集成

前端已实现登录/注册页面，位于 `src/app/auth/page.tsx`。

### API 调用示例

```typescript
// 登录
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// 获取用户信息
const response = await fetch('/api/auth/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 后续任务

1. 在 Supabase 中执行 `supabase-schema.sql` 创建表结构
2. 创建管理员账号（可选）
3. 测试完整的登录/注册流程
4. 实现前端 Protected Route 组件
5. 添加 Token 自动刷新逻辑
