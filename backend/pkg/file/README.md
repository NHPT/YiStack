# 文件管理模块

提供项目文件系统的管理功能，包括文件树构建、文件读写、模板初始化等。

## 功能特性

- 文件树构建与展示
- 文件读取、写入、删除
- 目录创建、删除、重命名
- 多语言文件识别
- 项目模板初始化
- 安全路径检查（防止目录遍历攻击）

## 文件结构

```
pkg/file/
├── manager.go    # 项目文件管理器
├── template.go   # 项目模板初始化
├── service.go   # 文件服务
└── README.md
```

## 使用示例

### 创建项目文件管理器

```go
import "yistack/pkg/file"

pm, err := file.NewProjectManager("/var/lib/yistack/runtime/projects/proj_123")
if err != nil {
    log.Fatal(err)
}
```

### 获取文件树

```go
tree, err := pm.GetFileTree()
if err != nil {
    log.Fatal(err)
}
// tree 包含完整的项目文件树结构
```

### 读取文件

```go
content, err := pm.ReadFile("src/app/page.tsx")
if err != nil {
    log.Fatal(err)
}
fmt.Println(content)
```

### 写入文件

```go
err = pm.WriteFile("src/app/page.tsx", "package main\n\nfunc main() {}")
if err != nil {
    log.Fatal(err)
}
```

### 使用模板初始化项目

```go
initializer := file.NewTemplateInitializer()

// 初始化 Next.js 项目
err = initializer.InitFromTemplate("/var/lib/yistack/runtime/projects/myapp", file.TemplateNodeNextJS, "myapp")
if err != nil {
    log.Fatal(err)
}
```

### 可用模板

| 模板类型 | 名称 | 说明 |
|----------|------|------|
| `node-nextjs` | Next.js | 全栈 React 框架 |
| `node-react` | React + Vite | 现代化 React 开发环境 |
| `node-vue` | Vue 3 + Vite | 渐进式 JavaScript 框架 |
| `python-fastapi` | FastAPI | 现代 Python Web 框架 |
| `python-flask` | Flask | 轻量级 Python Web 框架 |
| `go-gin` | Gin | Go 高性能 Web 框架 |
| `static-html` | Static HTML | 静态 HTML 网站 |

## 安全说明

- 所有文件路径都经过安全检查，防止 `..` 目录遍历攻击
- 禁止访问项目目录外的文件
- 隐藏目录（以 `.` 开头）和 `node_modules` 等目录会被自动跳过
