// Package container 容器管理模块
// 提供 Podman 容器创建、启停、删除、命令执行等能力
package container

import "time"

// ContainerStatus 容器状态
type ContainerStatus string

const (
	ContainerStatusPending  ContainerStatus = "pending"  // 等待创建
	ContainerStatusStarting ContainerStatus = "starting" // 启动中
	ContainerStatusRunning  ContainerStatus = "running"  // 运行中
	ContainerStatusStopping ContainerStatus = "stopping" // 停止中
	ContainerStatusStopped  ContainerStatus = "stopped"  // 已停止
	ContainerStatusError    ContainerStatus = "error"    // 错误
	ContainerStatusDeleted  ContainerStatus = "deleted"  // 已删除
)

// ProjectType 项目类型/模板
type ProjectType string

const (
	ProjectTypeNodeNext      ProjectType = "node-next"      // Next.js 全栈
	ProjectTypeNodeReact     ProjectType = "node-react"     // React SPA
	ProjectTypeNodeVue       ProjectType = "node-vue"       // Vue3
	ProjectTypeNodeExpress   ProjectType = "node-express"   // Express API
	ProjectTypePythonFastAPI ProjectType = "python-fastapi" // Python FastAPI
	ProjectTypePythonDjango  ProjectType = "python-django"  // Python Django
	ProjectTypeGoGin         ProjectType = "go-gin"         // Go Gin
	ProjectTypeGoFiber       ProjectType = "go-fiber"       // Go Fiber
	ProjectTypeStaticHTML    ProjectType = "static-html"    // 静态 HTML
)

// ContainerInfo 容器信息
type ContainerInfo struct {
	ProjectID    string          `json:"project_id"`     // 项目ID
	ContainerID  string          `json:"container_id"`   // Podman 容器ID
	Name         string          `json:"name"`           // 容器名称
	Image        string          `json:"image"`          // 镜像名称
	Port         int             `json:"port"`           // 项目应用内部端口（兼容旧字段）
	Status       ContainerStatus `json:"status"`         // 容器状态
	CreatedAt    time.Time       `json:"created_at"`     // 创建时间
	StartedAt    *time.Time      `json:"started_at"`     // 启动时间
	LastActiveAt time.Time       `json:"last_active_at"` // 最后活跃时间
}

type ProjectEndpoint struct {
	ProjectID    string `json:"project_id"`
	ContainerID  string `json:"container_id"`
	Address      string `json:"address"`
	InternalPort int    `json:"internal_port"`
	HostPort     int    `json:"host_port,omitempty"`
}

// ProjectConfig 项目容器配置
type ProjectConfig struct {
	ProjectID   string      `json:"project_id"`   // 项目ID
	ProjectType ProjectType `json:"project_type"` // 项目类型
	ProjectName string      `json:"project_name"` // 项目名称
	UserID      string      `json:"user_id"`      // 用户ID
	Port        int         `json:"port"`         // 分配的端口
}

// CreateOptions 创建容器选项
type CreateOptions struct {
	Name          string            `json:"name"`           // 容器名称
	Image         string            `json:"image"`          // 镜像名称
	Port          int               `json:"port"`           // 主机端口
	ContainerPort int               `json:"container_port"` // 容器端口
	VolumePath    string            `json:"volume_path"`    // 挂载路径
	Env           []string          `json:"env"`            // 环境变量
	Cmd           []string          `json:"cmd"`            // 容器启动命令
	Memory        string            `json:"memory"`         // 内存限制，如 "512m"
	CPU           float64           `json:"cpu"`            // CPU 限制，如 0.5
	WorkDir       string            `json:"work_dir"`       // 工作目录
	Network       string            `json:"network"`        // 项目专属网络
	Labels        map[string]string `json:"labels"`         // 标签
	Binds         []string          `json:"binds"`          // 挂载卷，如 /host/path:/container/path
}

// RunOptions 运行命令选项
type RunOptions struct {
	ProjectID string   `json:"project_id"`     // 项目ID
	Command   string   `json:"command"`        // 要执行的命令
	Args      []string `json:"args,omitempty"` // 结构化命令参数，不经过 shell
	Env       []string `json:"-"`              // 服务端受控临时环境变量，不进入 API
	WorkDir   string   `json:"work_dir"`       // 工作目录
	Timeout   int      `json:"timeout"`        // 超时时间(秒)，默认 300
}

// ExecResult 命令执行结果
type ExecResult struct {
	ProjectID string    `json:"project_id"` // 项目ID
	ExitCode  int       `json:"exit_code"`  // 退出码
	Stdout    string    `json:"stdout"`     // 标准输出
	Stderr    string    `json:"stderr"`     // 标准错误
	Duration  int64     `json:"duration"`   // 执行耗时(毫秒)
	Timestamp time.Time `json:"timestamp"`  // 执行时间
}

// ContainerStats 容器资源使用统计
type ContainerStats struct {
	ProjectID   string    `json:"project_id"`
	CPUPercent  float64   `json:"cpu_percent"`  // CPU 使用百分比
	MemoryUsage int64     `json:"memory_usage"` // 内存使用(bytes)
	MemoryLimit int64     `json:"memory_limit"` // 内存限制(bytes)
	NetworkRx   int64     `json:"network_rx"`   // 网络接收(bytes)
	NetworkTx   int64     `json:"network_tx"`   // 网络发送(bytes)
	DiskUsage   int64     `json:"disk_usage"`   // 磁盘使用(bytes)
	ReadTime    time.Time `json:"read_time"`    // 统计时间
}

// ImageInfo 镜像信息
type ImageInfo struct {
	Name   string `json:"name"`   // 镜像名称
	Tag    string `json:"tag"`    // 镜像标签
	Size   int64  `json:"size"`   // 镜像大小(bytes)
	Id     string `json:"id"`     // 镜像ID
	Loaded bool   `json:"loaded"` // 是否已加载
}

// PreheatConfig 预热配置
type PreheatConfig struct {
	Images []PreheatImage `json:"images"` // 需要预热的镜像列表
}

// PreheatImage 预热镜像配置
type PreheatImage struct {
	Name       string `json:"name"`        // 镜像名称
	Alias      string `json:"alias"`       // 别名/模板类型
	Required   bool   `json:"required"`    // 是否必需
	MinVersion string `json:"min_version"` // 最小版本要求
}

const DefaultWorkspaceImage = "localhost/devbox:bookworm"

// SupportedImages 支持的镜像列表
var SupportedImages = []PreheatImage{
	{Name: DefaultWorkspaceImage, Alias: "default", Required: true, MinVersion: ""},
	{Name: "ollama/ollama:latest", Alias: "ollama", Required: false, MinVersion: ""},
}

// PortRange 端口范围配置
type PortRange struct {
	Start int `json:"start"` // 起始端口
	End   int `json:"end"`   // 结束端口
}

// DefaultPortRange 默认端口范围
var DefaultPortRange = PortRange{
	Start: 30000,
	End:   40000,
}
