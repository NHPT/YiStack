// Package config 配置文件管理
package config

import (
	"crypto/rand"
	"encoding/base64"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

const insecureDefaultJWTSecret = "your-super-secret-key-change-in-production"

func resolveJWTSecret(value string) (string, bool) {
	secret := strings.TrimSpace(value)
	switch strings.ToLower(secret) {
	case "", insecureDefaultJWTSecret, "your-secret-key", "change-me":
		randomBytes := make([]byte, 32)
		if _, err := rand.Read(randomBytes); err != nil {
			panic("failed to generate JWT secret: " + err.Error())
		}
		return base64.RawURLEncoding.EncodeToString(randomBytes), true
	default:
		return secret, false
	}
}

func defaultRuntimePath(parts ...string) string {
	cwd, err := os.Getwd()
	if err != nil {
		return filepath.Join(parts...)
	}

	base := cwd
	if filepath.Base(base) == "backend" {
		base = filepath.Dir(base)
	}

	segments := append([]string{base, "runtime"}, parts...)
	return filepath.Join(segments...)
}

func defaultContainerSocketPath(runtime string) string {
	runtime = strings.ToLower(strings.TrimSpace(runtime))
	candidates := make([]string, 0, 3)

	switch runtime {
	case "", "podman":
		uid := os.Getuid()
		candidates = append(candidates,
			filepath.Join("/run/user", strconv.Itoa(uid), "podman", "podman.sock"),
			"/var/run/podman/podman.sock",
		)
	case "docker":
		candidates = append(candidates, "/var/run/docker.sock")
	default:
		uid := os.Getuid()
		candidates = append(candidates,
			filepath.Join("/run/user", strconv.Itoa(uid), "podman", "podman.sock"),
			"/var/run/podman/podman.sock",
			"/var/run/docker.sock",
		)
	}

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	if len(candidates) == 0 {
		return ""
	}
	return candidates[0]
}

// Config 全局配置
type Config struct {
	Server            ServerConfig            `json:"server"`
	Database          DatabaseConfig          `json:"database"`
	LLM               LLMConfig               `json:"llm"`
	JWT               JWTConfig               `json:"jwt"`
	CORS              CORSConfig              `json:"cors"`
	System            SystemConfig            `json:"system"`
	Container         ContainerConfig         `json:"container"`
	Project           ProjectConfig           `json:"project"`
	ProjectSecrets    ProjectSecretConfig     `json:"-"`
	GitHub            GitHubIntegrationConfig `json:"-"`
	Deployment        DeploymentConfig        `json:"-"`
	Capability        CapabilityConfig        `json:"capability"`
	BrowserAcceptance BrowserAcceptanceConfig `json:"browser_acceptance"`
}

// ServerConfig 服务配置
type ServerConfig struct {
	Host string
	Port string
	Mode string // dev, prod
}

// DatabaseConfig 数据库配置
// 使用 DB_TYPE 指定数据库类型：
//   - supabase : Supabase REST API 方式
//   - postgres : PostgreSQL
//   - mysql    : MySQL
//   - oracle   : Oracle
type DatabaseConfig struct {
	Type         string // supabase, postgres, mysql, oracle
	Host         string
	Port         int
	User         string
	Password     string
	Database     string
	MaxIdleConns int    // 最大空闲连接数
	MaxOpenConns int    // 最大打开连接数
	ConnMaxLife  int    // 连接最大生命周期（秒）
	SSLMode      string // PostgreSQL SSL 模式
	Charset      string // MySQL 字符集

	// Supabase 专用配置
	SupabaseURL        string
	SupabaseAnonKey    string
	SupabaseServiceKey string
	SupabaseDBPassword string // Supabase 数据库密码（从 Dashboard > Settings > Database 获取）
	SupabaseDBRegion   string // Supabase 数据库区域（如 ap-southeast-1），默认自动检测
}

// LLMConfig LLM 配置
type LLMConfig struct {
	// 提供商配置
	ActiveProvider       string // 当前激活的提供商: doubao, openai, qwen, openrouter, ollama, kimi, deepseek
	DeterministicEnabled bool   // 是否启用本地确定性开发 provider

	// 默认参数
	DefaultModel       string
	DefaultTemperature float64
	MaxTokens          int
	Timeout            int // 超时时间（秒）

	// Doubao 配置
	DoubaoAPIKey  string
	DoubaoBaseURL string

	// OpenAI 配置
	OpenAIAPIKey  string
	OpenAIBaseURL string

	// Qwen 配置
	QwenAPIKey  string
	QwenBaseURL string

	// OpenRouter 配置
	OpenRouterAPIKey  string
	OpenRouterBaseURL string

	// Ollama 配置（本地部署）
	OllamaBaseURL string

	// Kimi 配置
	KimiAPIKey  string
	KimiBaseURL string

	// DeepSeek 配置
	DeepSeekAPIKey  string
	DeepSeekBaseURL string
}

// JWTConfig JWT 配置
type JWTConfig struct {
	Secret             string // JWT 密钥
	Expiry             int64  // Token 过期时间（秒）
	RefreshTokenExpiry int64  // Refresh Token 过期时间（秒）
}

// CORSConfig CORS 配置
type CORSConfig struct {
	AllowedOrigins   []string // 允许的源
	AllowedMethods   []string // 允许的方法
	AllowedHeaders   []string // 允许的头部
	ExposedHeaders   []string // 暴露的头部
	MaxAge           int      // 预检请求缓存时间
	AllowCredentials bool     // 允许凭证
}

// SystemConfig 系统配置
type SystemConfig struct {
	MaintenanceMode  bool   `json:"maintenance_mode"`  // 维护模式
	RegistrationMode string `json:"registration_mode"` // 注册模式: open, invite, closed
	MaxUploadSize    int64  `json:"max_upload_size"`   // 最大上传大小（字节）
}

// CapabilityConfig 能力执行配置。
type CapabilityConfig struct {
	EnableSkillProvider  bool     `json:"enable_skill_provider"`  // 是否允许 Skill provider 被解析为可用
	EnableMCPProvider    bool     `json:"enable_mcp_provider"`    // 是否允许 MCP provider 被解析为可用
	EnableSkillExecution bool     `json:"enable_skill_execution"` // 是否允许真实调用 Skill runner
	EnableMCPExecution   bool     `json:"enable_mcp_execution"`   // 是否允许真实调用 MCP runner
	SkillRunnerMode      string   `json:"skill_runner_mode"`      // Skill runner 模式：空值、dry-run、contract、skill-http
	MCPRunnerMode        string   `json:"mcp_runner_mode"`        // MCP runner 模式：空值、dry-run、contract、mcp-http
	SkillRunnerManifest  string   `json:"skill_runner_manifest"`  // Skill contract runner manifest 路径
	MCPRunnerManifest    string   `json:"mcp_runner_manifest"`    // MCP contract runner manifest 路径
	SkillRunnerEndpoint  string   `json:"skill_runner_endpoint"`  // Skill HTTP runner endpoint
	MCPRunnerEndpoint    string   `json:"mcp_runner_endpoint"`    // MCP HTTP runner endpoint
	RunnerTimeoutSeconds int      `json:"runner_timeout_seconds"` // 外部 runner 统一超时时间
	NetworkEnabled       bool     `json:"network_enabled"`        // 是否允许真实 runner 发起网络调用
	NetworkAllowlist     []string `json:"network_allowlist"`      // 允许真实 runner 访问的网络目标
	ExecutionPolicyNote  string   `json:"execution_policy_note"`  // 执行策略来源说明
}

// BrowserAcceptanceConfig configures the loopback Playwright worker connection.
type BrowserAcceptanceConfig struct {
	WorkerURL string `json:"worker_url"`
}

// ContainerConfig 容器配置
type ContainerConfig struct {
	Enabled                bool     `json:"enabled"`                   // 是否启用容器
	Runtime                string   `json:"runtime"`                   // 容器运行时: podman, docker
	SocketPath             string   `json:"socket_path"`               // Podman/Docker Socket 路径
	ProjectDir             string   `json:"project_dir"`               // 项目根目录
	TemplateDir            string   `json:"template_dir"`              // 模板目录
	DataDir                string   `json:"data_dir"`                  // 数据目录
	PreviewBindHost        string   `json:"preview_bind_host"`         // 统一预览网关监听地址，例如 127.0.0.1
	PreviewPort            int      `json:"preview_port"`              // 统一预览网关端口
	PreviewURL             string   `json:"preview_url"`               // 统一预览网关外部访问地址
	PreviewScheme          string   `json:"preview_scheme"`            // 预览地址协议，优先用于子域名模式
	PreviewBaseDomain      string   `json:"preview_base_domain"`       // 用户访问预览时的基础域名，例如 preview.example.com
	PreviewTargetDomain    string   `json:"preview_target_domain"`     // 网关转发时的内部服务发现域名
	PreviewTargetPort      int      `json:"preview_target_port"`       // 网关转发时的内部固定端口，0 表示沿用应用内部端口
	PreviewTokenTTLSeconds int      `json:"preview_token_ttl_seconds"` // 预览票据有效期（秒）
	APTMirror              string   `json:"apt_mirror"`                // 兼容旧配置：单个运行时 apt 镜像源基地址
	APTMirrors             []string `json:"apt_mirror_candidates"`     // 运行时 apt 候选镜像源列表

	// 端口配置
	PortRangeStart int `json:"port_range_start"` // 端口范围起始
	PortRangeEnd   int `json:"port_range_end"`   // 端口范围结束

	// 资源限制
	DefaultCPU     string `json:"default_cpu"`      // 默认 CPU 限制
	DefaultMemory  string `json:"default_memory"`   // 默认内存限制
	DefaultDisk    string `json:"default_disk"`     // 默认磁盘限制
	IdleTimeoutMin int    `json:"idle_timeout_min"` // 空闲自动停止时间（分钟），0 表示禁用

	// 镜像配置
	Images []ContainerImage `json:"images"` // 可用镜像列表
}

// ContainerImage 容器镜像配置。
// 这里保持“数据库里只存可直接拉取的镜像地址”这条简单语义，
// 但额外保留少量元数据，方便后台按 runtime profile 选镜像和做启停排序。
type ContainerImage struct {
	Type        string `json:"type"`                  // 运行时类型/技术栈，如 node-nextjs、python-fastapi、default
	Image       string `json:"image"`                 // 可直接用于拉取的完整镜像名
	Name        string `json:"name,omitempty"`        // 后台展示名，可选
	Port        int    `json:"port,omitempty"`        // 默认应用端口，可选
	Priority    int    `json:"priority,omitempty"`    // 优先级，值越小越优先
	Enabled     *bool  `json:"enabled,omitempty"`     // nil 视为启用，便于兼容旧 JSON
	Description string `json:"description,omitempty"` // 备注说明，可选
}

// ProjectConfig 项目配置
type ProjectConfig struct {
	MaxProjectSize                    int64    `json:"max_project_size"`                     // 最大项目大小（字节）
	MaxFileSize                       int64    `json:"max_file_size"`                        // 最大文件大小（字节）
	AllowedExtensions                 []string `json:"allowed_extensions"`                   // 允许的文件扩展名
	AutoBackup                        bool     `json:"auto_backup"`                          // 是否自动备份
	BackupDir                         string   `json:"backup_dir"`                           // 备份目录
	AutoBackupIntervalSeconds         int      `json:"auto_backup_interval_seconds"`         // 自动备份调度间隔（秒），<=0 表示禁用后台调度
	RemoteBackupEnabled               bool     `json:"remote_backup_enabled"`                // 是否启用远端备份存储
	RemoteBackupProvider              string   `json:"remote_backup_provider"`               // 远端备份存储提供方，例如 s3
	RemoteBackupBucket                string   `json:"remote_backup_bucket"`                 // 远端备份存储 bucket
	RemoteBackupPrefix                string   `json:"remote_backup_prefix"`                 // 远端备份对象前缀
	RemoteBackupEndpoint              string   `json:"remote_backup_endpoint"`               // S3 兼容存储 endpoint，可选
	RemoteBackupRegion                string   `json:"remote_backup_region"`                 // 远端备份区域，可选
	RemoteBackupCredentials           bool     `json:"remote_backup_credentials"`            // 远端备份凭据是否已配置；不暴露密钥值
	ResourceAlertEnabled              bool     `json:"resource_alert_enabled"`               // 是否启用资源告警策略 readiness
	ResourceAlertCPUPercent           float64  `json:"resource_alert_cpu_percent"`           // CPU 使用率告警阈值，百分比，<=0 表示未配置
	ResourceAlertMemoryPercent        float64  `json:"resource_alert_memory_percent"`        // 内存使用率告警阈值，百分比，<=0 表示未配置
	ResourceAlertDiskBytes            int64    `json:"resource_alert_disk_bytes"`            // 磁盘使用告警阈值，字节，<=0 表示未配置
	ResourceAlertNotificationEnabled  bool     `json:"resource_alert_notification_enabled"`  // 是否启用资源告警通知通道 readiness
	ResourceAlertNotificationProvider string   `json:"resource_alert_notification_provider"` // 资源告警通知通道提供方，例如 webhook
	ResourceAlertEnforcementEnabled   bool     `json:"resource_alert_enforcement_enabled"`   // 是否启用资源告警硬配额执行 readiness
	ResourceAlertEnforcementMode      string   `json:"resource_alert_enforcement_mode"`      // 资源告警硬配额执行模式，例如 stop_container
}

// ProjectSecretConfig 项目级敏感配置。
// 该结构只作为受控 Secret Storage 接入前的服务端内部边界；不得进入 system_config、Admin Config 或 API 响应。
type ProjectSecretConfig struct {
	RemoteBackupAccessKeyID             string
	RemoteBackupSecretAccessKey         string
	ResourceAlertNotificationWebhookURL string
}

// GitHubIntegrationConfig contains bootstrap-only OAuth and encryption secrets.
// It must never be exposed through system_config, logs, or API responses.
type GitHubIntegrationConfig struct {
	OAuthClientID      string
	OAuthClientSecret  string
	OAuthCallbackURL   string
	TokenEncryptionKey string
	WebhookSecret      string
	APIBaseURL         string
	WebhookURL         string
	WebBaseURL         string
}

// DeploymentConfig contains server-only credentials for managed deployment adapters.
type DeploymentConfig struct {
	VercelAccessToken   string
	VercelTeamID        string
	VercelAPIBaseURL    string
	SecretEncryptionKey string
}

var (
	cfg  *Config
	once sync.Once
)

// Load 加载配置
func Load() *Config {
	once.Do(func() {
		dbType := getEnv("DB_TYPE", "supabase")
		runtimeName := getEnv("CONTAINER_RUNTIME", "podman")
		jwtSecret, generatedJWTSecret := resolveJWTSecret(os.Getenv("JWT_SECRET"))
		if generatedJWTSecret {
			log.Print("Warning: JWT_SECRET is empty or insecure; generated an ephemeral secret for this process")
		}
		socketPath := strings.TrimSpace(getEnv("CONTAINER_SOCKET_PATH", ""))
		if socketPath == "" {
			socketPath = defaultContainerSocketPath(runtimeName)
		}

		cfg = &Config{
			Server: ServerConfig{
				Host: getEnv("APP_HOST", "127.0.0.1"),
				Port: getEnv("APP_PORT", "8080"),
				Mode: getEnv("APP_ENV", "development"),
			},
			Database: DatabaseConfig{
				Type:         dbType,
				Host:         getEnv("DB_HOST", "localhost"),
				Port:         getEnvInt("DB_PORT", 5432),
				User:         getEnv("DB_USER", "postgres"),
				Password:     getEnv("DB_PASSWORD", ""),
				Database:     getEnv("DB_NAME", "yistack"),
				MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 10),
				MaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 100),
				ConnMaxLife:  getEnvInt("DB_CONN_MAX_LIFE", 3600),
				SSLMode:      getEnv("DB_SSL_MODE", "disable"),
				Charset:      getEnv("DB_CHARSET", "utf8mb4"),

				// Supabase 专用配置
				SupabaseURL:        getEnv("SUPABASE_URL", ""),
				SupabaseAnonKey:    getEnv("SUPABASE_ANON_KEY", ""),
				SupabaseServiceKey: getEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
				SupabaseDBPassword: getEnv("SUPABASE_DB_PASSWORD", ""),
				SupabaseDBRegion:   getEnv("SUPABASE_DB_REGION", ""),
			},
			LLM: LLMConfig{
				ActiveProvider:       getEnv("LLM_PROVIDER", "doubao"),
				DeterministicEnabled: getEnvBool("LLM_DETERMINISTIC_ENABLED", false),
				DefaultModel:         getEnv("LLM_DEFAULT_MODEL", "doubao-seed-2.0-lite-260215"),
				DefaultTemperature:   getEnvFloat("LLM_DEFAULT_TEMPERATURE", 0.7),
				MaxTokens:            getEnvInt("LLM_MAX_TOKENS", 4096),
				Timeout:              getEnvInt("LLM_TIMEOUT", 120),

				// Doubao
				DoubaoAPIKey:  getEnv("DOUBAO_API_KEY", ""),
				DoubaoBaseURL: getEnv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),

				// OpenAI
				OpenAIAPIKey:  getEnv("OPENAI_API_KEY", ""),
				OpenAIBaseURL: getEnv("OPENAI_BASE_URL", "https://api.openai.com/v1"),

				// Qwen
				QwenAPIKey:  getEnv("QWEN_API_KEY", ""),
				QwenBaseURL: getEnv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),

				// OpenRouter
				OpenRouterAPIKey:  getEnv("OPENROUTER_API_KEY", ""),
				OpenRouterBaseURL: getEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),

				// Ollama
				OllamaBaseURL: getEnv("OLLAMA_BASE_URL", "http://localhost:11434"),

				// Kimi
				KimiAPIKey:  getEnv("KIMI_API_KEY", ""),
				KimiBaseURL: getEnv("KIMI_BASE_URL", "https://api.moonshot.cn/v1"),

				// DeepSeek
				DeepSeekAPIKey:  getEnv("DEEPSEEK_API_KEY", ""),
				DeepSeekBaseURL: getEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
			},
			JWT: JWTConfig{
				Secret:             jwtSecret,
				Expiry:             getEnvInt64("JWT_EXPIRY", 86400),            // 24小时
				RefreshTokenExpiry: getEnvInt64("REFRESH_TOKEN_EXPIRY", 604800), // 7天
			},
			CORS: CORSConfig{
				AllowedOrigins:   parseCSVEnv("CORS_ALLOWED_ORIGINS", ""),
				AllowedMethods:   parseCSVEnv("CORS_ALLOWED_METHODS", "GET,POST,PUT,DELETE,OPTIONS"),
				AllowedHeaders:   parseCSVEnv("CORS_ALLOWED_HEADERS", "Content-Type,Authorization,X-Requested-With"),
				ExposedHeaders:   parseCSVEnv("CORS_EXPOSED_HEADERS", "X-Request-Id,X-RateLimit-Limit,X-RateLimit-Remaining"),
				MaxAge:           getEnvInt("CORS_MAX_AGE", 86400),
				AllowCredentials: true,
			},
			System: SystemConfig{
				MaintenanceMode:  getEnv("SYSTEM_MAINTENANCE_MODE", "false") == "true",
				RegistrationMode: getEnv("SYSTEM_REGISTRATION_MODE", "open"),
				MaxUploadSize:    getEnvInt64("SYSTEM_MAX_UPLOAD_SIZE", 10*1024*1024), // 10MB
			},
			BrowserAcceptance: BrowserAcceptanceConfig{
				WorkerURL: "http://127.0.0.1:43120",
			},
			Capability: CapabilityConfig{
				EnableSkillProvider:  getEnvBool("CAPABILITY_ENABLE_SKILL_PROVIDER", false),
				EnableMCPProvider:    getEnvBool("CAPABILITY_ENABLE_MCP_PROVIDER", false),
				EnableSkillExecution: getEnvBool("CAPABILITY_ENABLE_SKILL_EXECUTION", false),
				EnableMCPExecution:   getEnvBool("CAPABILITY_ENABLE_MCP_EXECUTION", false),
				SkillRunnerMode:      getEnv("CAPABILITY_SKILL_RUNNER_MODE", ""),
				MCPRunnerMode:        getEnv("CAPABILITY_MCP_RUNNER_MODE", ""),
				SkillRunnerManifest:  getEnv("CAPABILITY_SKILL_RUNNER_MANIFEST", ""),
				MCPRunnerManifest:    getEnv("CAPABILITY_MCP_RUNNER_MANIFEST", ""),
				SkillRunnerEndpoint:  getEnv("CAPABILITY_SKILL_RUNNER_ENDPOINT", ""),
				MCPRunnerEndpoint:    getEnv("CAPABILITY_MCP_RUNNER_ENDPOINT", ""),
				RunnerTimeoutSeconds: getEnvInt("CAPABILITY_RUNNER_TIMEOUT_SECONDS", 30),
				NetworkEnabled:       getEnvBool("CAPABILITY_RUNNER_NETWORK_ENABLED", false),
				NetworkAllowlist:     parseCSVEnv("CAPABILITY_RUNNER_NETWORK_ALLOWLIST", ""),
				ExecutionPolicyNote:  getEnv("CAPABILITY_EXECUTION_POLICY_NOTE", "环境配置未启用外部 Skill / MCP 执行；默认保持能力调用禁用。"),
			},
			Container: ContainerConfig{
				Enabled:                getEnv("CONTAINER_ENABLED", "true") == "true",
				Runtime:                runtimeName,
				SocketPath:             socketPath,
				ProjectDir:             getEnv("CONTAINER_PROJECT_DIR", defaultRuntimePath("projects")),
				TemplateDir:            getEnv("CONTAINER_TEMPLATE_DIR", defaultRuntimePath("templates")),
				DataDir:                getEnv("CONTAINER_DATA_DIR", defaultRuntimePath("container-data")),
				PreviewBindHost:        getEnv("CONTAINER_PREVIEW_BIND_HOST", "127.0.0.1"),
				PreviewPort:            getEnvInt("CONTAINER_PREVIEW_PORT", 3100),
				PreviewURL:             getEnv("CONTAINER_PREVIEW_URL", ""),
				PreviewScheme:          getEnv("CONTAINER_PREVIEW_SCHEME", "https"),
				PreviewBaseDomain:      getEnv("CONTAINER_PREVIEW_BASE_DOMAIN", ""),
				PreviewTargetDomain:    getEnv("CONTAINER_PREVIEW_TARGET_DOMAIN", ""),
				PreviewTargetPort:      getEnvInt("CONTAINER_PREVIEW_TARGET_PORT", 0),
				PreviewTokenTTLSeconds: getEnvInt("CONTAINER_PREVIEW_TOKEN_TTL_SECONDS", 900),
				APTMirror:              getEnv("CONTAINER_APT_MIRROR", ""),
				APTMirrors:             parseCSVEnv("CONTAINER_APT_MIRROR_CANDIDATES", ""),
				PortRangeStart:         getEnvInt("CONTAINER_PORT_RANGE_START", 30000),
				PortRangeEnd:           getEnvInt("CONTAINER_PORT_RANGE_END", 40000),
				DefaultCPU:             getEnv("CONTAINER_DEFAULT_CPU", "1"),
				DefaultMemory:          getEnv("CONTAINER_DEFAULT_MEMORY", "1g"),
				DefaultDisk:            getEnv("CONTAINER_DEFAULT_DISK", "2g"),
				IdleTimeoutMin:         getEnvInt("CONTAINER_IDLE_TIMEOUT_MIN", 30),
				Images: []ContainerImage{
					{Type: "node-nextjs", Name: "Node Devbox", Image: "localhost/devbox:bookworm", Port: 3000, Priority: 10, Description: "Next.js/Node 项目默认开发镜像"},
					{Type: "node-react", Name: "Node Devbox", Image: "localhost/devbox:bookworm", Port: 5173, Priority: 20, Description: "React/Vite 项目默认开发镜像"},
					{Type: "node-vue", Name: "Node Devbox", Image: "localhost/devbox:bookworm", Port: 5173, Priority: 30, Description: "Vue 项目默认开发镜像"},
					{Type: "node-express", Name: "Node Devbox", Image: "localhost/devbox:bookworm", Port: 3000, Priority: 40, Description: "Node 服务项目默认开发镜像"},
					{Type: "static-html", Name: "Node Devbox", Image: "localhost/devbox:bookworm", Port: 3000, Priority: 50, Description: "静态站点项目默认开发镜像"},
					{Type: "default", Name: "Default Runtime Image", Image: "localhost/devbox:bookworm", Port: 3000, Priority: 1000, Description: "未命中专用 profile 时使用的默认运行时镜像"},
				},
			},
			Project: ProjectConfig{
				MaxProjectSize:            getEnvInt64("PROJECT_MAX_SIZE", 2*1024*1024*1024),  // 2GB
				MaxFileSize:               getEnvInt64("PROJECT_MAX_FILE_SIZE", 10*1024*1024), // 10MB
				AllowedExtensions:         strings.Split(getEnv("PROJECT_ALLOWED_EXTENSIONS", ".go,.py,.js,.ts,.tsx,.jsx,.html,.css,.json,.yaml,.yml,.md,.txt,.sql,.sh"), ","),
				AutoBackup:                getEnv("PROJECT_AUTO_BACKUP", "true") == "true",
				BackupDir:                 getEnv("PROJECT_BACKUP_DIR", defaultRuntimePath("backups")),
				AutoBackupIntervalSeconds: getEnvInt("PROJECT_AUTO_BACKUP_INTERVAL_SECONDS", 3600),
				RemoteBackupEnabled:       getEnvBool("PROJECT_BACKUP_REMOTE_ENABLED", false),
				RemoteBackupProvider:      getEnv("PROJECT_BACKUP_REMOTE_PROVIDER", ""),
				RemoteBackupBucket:        getEnv("PROJECT_BACKUP_REMOTE_BUCKET", ""),
				RemoteBackupPrefix:        getEnv("PROJECT_BACKUP_REMOTE_PREFIX", "yistack/project-backups"),
				RemoteBackupEndpoint:      getEnv("PROJECT_BACKUP_REMOTE_ENDPOINT", ""),
				RemoteBackupRegion:        getEnv("PROJECT_BACKUP_REMOTE_REGION", ""),
				RemoteBackupCredentials: strings.TrimSpace(getEnv("PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID", "")) != "" &&
					strings.TrimSpace(getEnv("PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY", "")) != "",
				ResourceAlertEnabled:              getEnvBool("PROJECT_RESOURCE_ALERT_ENABLED", false),
				ResourceAlertCPUPercent:           getEnvFloat("PROJECT_RESOURCE_ALERT_CPU_PERCENT", 0),
				ResourceAlertMemoryPercent:        getEnvFloat("PROJECT_RESOURCE_ALERT_MEMORY_PERCENT", 0),
				ResourceAlertDiskBytes:            getEnvInt64("PROJECT_RESOURCE_ALERT_DISK_BYTES", 0),
				ResourceAlertNotificationEnabled:  getEnvBool("PROJECT_RESOURCE_ALERT_NOTIFICATION_ENABLED", false),
				ResourceAlertNotificationProvider: getEnv("PROJECT_RESOURCE_ALERT_NOTIFICATION_PROVIDER", ""),
				ResourceAlertEnforcementEnabled:   getEnvBool("PROJECT_RESOURCE_ALERT_ENFORCEMENT_ENABLED", false),
				ResourceAlertEnforcementMode:      getEnv("PROJECT_RESOURCE_ALERT_ENFORCEMENT_MODE", ""),
			},
			ProjectSecrets: ProjectSecretConfig{
				RemoteBackupAccessKeyID:             getEnv("PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID", ""),
				RemoteBackupSecretAccessKey:         getEnv("PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY", ""),
				ResourceAlertNotificationWebhookURL: getEnv("PROJECT_RESOURCE_ALERT_NOTIFICATION_WEBHOOK_URL", ""),
			},
			GitHub: GitHubIntegrationConfig{
				OAuthClientID:      getEnv("GITHUB_OAUTH_CLIENT_ID", ""),
				OAuthClientSecret:  getEnv("GITHUB_OAUTH_CLIENT_SECRET", ""),
				OAuthCallbackURL:   getEnv("GITHUB_OAUTH_CALLBACK_URL", ""),
				TokenEncryptionKey: getEnv("GITHUB_TOKEN_ENCRYPTION_KEY", ""),
				WebhookSecret:      getEnv("GITHUB_WEBHOOK_SECRET", ""),
				APIBaseURL:         getEnv("GITHUB_API_BASE_URL", "https://api.github.com"),
				WebBaseURL:         getEnv("GITHUB_WEB_BASE_URL", "https://github.com"),
				WebhookURL:         getEnv("GITHUB_WEBHOOK_URL", ""),
			},
			Deployment: DeploymentConfig{
				VercelAccessToken:   getEnv("VERCEL_ACCESS_TOKEN", ""),
				VercelTeamID:        getEnv("VERCEL_TEAM_ID", ""),
				VercelAPIBaseURL:    getEnv("VERCEL_API_BASE_URL", "https://api.vercel.com"),
				SecretEncryptionKey: getEnv("DEPLOYMENT_SECRET_ENCRYPTION_KEY", ""),
			},
		}
	})
	return cfg
}

func parseCSVEnv(key, defaultValue string) []string {
	raw := getEnv(key, defaultValue)
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value != "" {
			result = append(result, value)
		}
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

// Get 获取配置
func Get() *Config {
	if cfg == nil {
		return Load()
	}
	return cfg
}

// getEnv 获取环境变量（字符串）
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt 获取环境变量（整数）
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvFloat 获取环境变量（浮点数）
func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

// getEnvBool 获取环境变量（布尔值）
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "1", "true", "yes", "on":
			return true
		case "0", "false", "no", "off":
			return false
		}
	}
	return defaultValue
}

// getEnvInt64 获取环境变量（64位整数）
func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}
