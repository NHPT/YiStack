# Container Manager 容器管理模块

Podman 无守护进程容器管理模块，提供项目容器创建、启停、删除、命令执行等能力。

## 功能特性

- Podman Rootless 容器管理
- 端口池自动分配与回收
- 多语言支持（Node.js, Python, Go, 静态 HTML）
- 镜像预热与缓存
- 项目隔离与资源限制
- 命令执行与日志输出

## 目录结构

```
container/
├── types.go       # 类型定义
├── podman.go      # Podman API 客户端
├── port_pool.go   # 端口池管理
├── manager.go     # 容器管理器
├── preheat.go     # 镜像预热
├── errors.go      # 错误定义
└── README.md      # 本文档
```

## 快速开始

### 1. 配置 Podman

确保 Podman 已安装并运行：

```bash
# 检查 Podman 版本
podman version

# 启动 Podman Socket（rootless 模式）
systemctl --user enable --now podman.socket
```

### 2. 创建管理器

```go
import "yistack/backend/pkg/container"

cfg := &container.Config{
    SocketPath:    "",                                      // 使用默认 rootless socket
    ProjectDir:    "/var/lib/yistack/runtime/projects",     // 项目目录
    TemplateDir:   "/var/lib/yistack/runtime/templates",    // 模板目录
    PortRangeStart: 30000,           // 端口范围起始
    PortRangeEnd:   40000,           // 端口范围结束
    DefaultMemory:  "1g",           // 默认内存限制
    DefaultCPU:     1.0,             // 默认 CPU 限制
}

manager, err := container.NewManager(cfg)
if err != nil {
    log.Fatal(err)
}
```

### 3. 创建项目

```go
config := &container.ProjectConfig{
    ProjectID:   "my-project-001",
    ProjectType: container.ProjectTypeNodeNext,
    ProjectName: "My Project",
    UserID:      "user-001",
}

info, err := manager.CreateProject(context.Background(), config)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Container created: %s, Port: %d\n", info.ContainerID, info.Port)
```

### 4. 启动项目

```go
info, err := manager.StartProject(context.Background(), "my-project-001")
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Container running at: http://localhost:%d\n", info.Port)
```

### 5. 执行命令

```go
opts := container.RunOptions{
    Command: "npm install && npm run dev",
    WorkDir: "/app",
    Timeout: 300,
}

result, err := manager.RunCommand(context.Background(), "my-project-001", opts)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Exit code: %d\n", result.ExitCode)
fmt.Printf("Output: %s\n", result.Stdout)
```

### 6. 停止项目

```go
err := manager.StopProject(context.Background(), "my-project-001")
if err != nil {
    log.Fatal(err)
}
```

### 7. 删除项目

```go
err := manager.DeleteProject(context.Background(), "my-project-001")
if err != nil {
    log.Fatal(err)
}
```

## 镜像预热

系统启动时预热镜像，可以加快项目创建速度：

```go
preheatManager := container.NewPreheatManager(podmanClient)

// 预热所有镜像
err := preheatManager.PreheatAll(context.Background())

// 或启动后台预热
preheatManager.StartBackgroundPreheat(context.Background())

// 检查预热状态
status := preheatManager.GetStatus()
for name, info := range status {
    fmt.Printf("%s: %s (%d%%)\n", name, info.Status, info.Progress)
}
```

## 支持的项目类型

| 类型 | 主容器基础镜像 | 说明 |
|------|----------------|------|
| `node-next` / `node-react` / `node-vue` / `node-express` | localhost/devbox:bookworm | 主容器预装 Node.js 与常用开发工具，容器内按需补装其他语言工具 |
| `python-fastapi` / `python-django` | localhost/devbox:bookworm | 主容器预装常用开发工具，容器内按需安装 Python |
| `go-gin` / `go-fiber` | localhost/devbox:bookworm | 主容器预装常用开发工具，容器内按需安装 Go |
| `static-html` | localhost/devbox:bookworm | 主容器预装 Node.js 与常用开发工具 |

## 端口池

端口池自动管理项目端口分配：

```go
// 获取端口池状态
stats := manager.GetPortPoolStats()
fmt.Printf("Total: %d, Used: %d, Available: %d\n", 
    stats.TotalPorts, stats.UsedPorts, stats.AvailablePorts)

// 获取项目端口
port, exists := manager.GetPortPool().GetPort("my-project-001")
```

## 健康检查

```go
err := manager.HealthCheck(context.Background())
if err != nil {
    fmt.Println("Health check failed:", err)
} else {
    fmt.Println("Health check passed")
}
```

## 环境要求

- Go 1.21+
- Podman 4.0+
- Linux/macOS（支持 rootless Podman）

## 注意事项

1. **Rootless 模式**：推荐使用 rootless Podman，更安全
2. **端口范围**：默认 30000-40000，可根据需要调整
3. **资源限制**：每个容器默认 1 核 1GB，可配置
4. **镜像预热**：首次创建项目需要拉取镜像，建议提前预热
5. **数据持久化**：生产环境项目代码存储在 `/var/lib/yistack/runtime/projects/{project_id}`

## 示例

完整示例请参考 `backend/cmd/server/main.go`。
