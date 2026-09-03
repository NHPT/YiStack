// Package model 数据模型
package model

import (
	"encoding/json"
	"fmt"
	"time"
)

// ============================================
// 用户相关模型
// ============================================

// User 用户模型 - 对齐实际 Supabase 表结构
// users 表: id(uuid), email, username, password_hash, role, status, plan,
//
//	email_verified, avatar_url, llm_model, llm_temperature(varchar), llm_max_tokens(int),
//	created_at, updated_at, instance_id(uuid)
type User struct {
	ID            string `gorm:"primaryKey;type:uuid" json:"id"`
	Email         string `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash  string `gorm:"size:255;not null" json:"-"`
	Username      string `gorm:"uniqueIndex;size:100" json:"username"`
	AvatarURL     string `gorm:"column:avatar_url;size:500" json:"avatar_url"`
	Role          string `gorm:"size:20;default:'user'" json:"role"`     // user only (admins in separate table)
	Status        string `gorm:"size:20;default:'active'" json:"status"` // active, banned, pending
	EmailVerified bool   `gorm:"default:false" json:"email_verified"`

	// 订阅相关
	Plan string `gorm:"size:20;default:'free'" json:"plan"` // free, pro, enterprise

	// LLM 配置偏好 - 对齐实际表: llm_model, llm_temperature(varchar), llm_max_tokens(int)
	LLMModel       string `gorm:"column:llm_model;size:100;default:'doubao-seed-2.0-lite-260215'" json:"llm_model"`
	LLMTemperature string `gorm:"column:llm_temperature;size:20;default:'0.7'" json:"llm_temperature"` // varchar in DB
	LLMMaxTokens   int    `gorm:"column:llm_max_tokens;default:4096" json:"llm_max_tokens"`

	// 时间戳
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Supabase 实例 ID
	InstanceID *string `gorm:"column:instance_id;type:uuid" json:"instance_id,omitempty"`
}

// GetID 获取用户 ID（UUID 字符串）
func (u *User) GetID() string {
	return u.ID
}

// ============================================
// 管理员相关模型（admins 表，与 users 完全分离）
// ============================================

// Admin 管理员模型 - 独立 admins 表，不与 users 混合
// admins 表: id(uuid), email, username, password_hash, role, status,
//
//	must_change_password, auth_version, avatar_url, last_login_at, created_at, updated_at
type Admin struct {
	ID                 string     `gorm:"primaryKey;type:uuid" json:"id"`
	Email              string     `gorm:"uniqueIndex;size:255;not null" json:"email"`
	Username           string     `gorm:"uniqueIndex;size:100;not null" json:"username"`
	PasswordHash       string     `gorm:"size:255;not null" json:"-"`
	Role               string     `gorm:"size:20;not null;default:'admin'" json:"role"` // admin, super_admin
	Status             string     `gorm:"size:20;default:'active'" json:"status"`       // active, disabled
	MustChangePassword bool       `gorm:"not null;default:false" json:"must_change_password"`
	AuthVersion        int        `gorm:"not null;default:1" json:"-"`
	AvatarURL          string     `gorm:"column:avatar_url;size:500" json:"avatar_url"`
	LastLoginAt        *time.Time `json:"last_login_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (Admin) TableName() string {
	return "admins"
}

// IsSuperAdmin 判断是否为超级管理员
func (a *Admin) IsSuperAdmin() bool {
	return a.Role == "super_admin"
}

// GetID 获取管理员 ID
func (a *Admin) GetID() string {
	return a.ID
}

// AdminRole 管理员自定义角色
type AdminRole struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name        string    `gorm:"uniqueIndex;size:100;not null" json:"name"`
	DisplayName string    `gorm:"column:display_name;size:100;not null" json:"display_name"`
	Description string    `gorm:"size:255;default:''" json:"description"`
	IsSystem    bool      `gorm:"column:is_system;default:false" json:"is_system"`
	Status      string    `gorm:"size:20;default:'active'" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (AdminRole) TableName() string {
	return "admin_roles"
}

// AdminPermission 管理员权限点
type AdminPermission struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Code        string    `gorm:"uniqueIndex;size:120;not null" json:"code"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `gorm:"size:255;default:''" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (AdminPermission) TableName() string {
	return "admin_permissions"
}

// AdminRolePermission 角色权限关联
type AdminRolePermission struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	RoleID       string    `gorm:"column:role_id;type:uuid;not null" json:"role_id"`
	PermissionID string    `gorm:"column:permission_id;type:uuid;not null" json:"permission_id"`
	CreatedAt    time.Time `json:"created_at"`
}

func (AdminRolePermission) TableName() string {
	return "admin_role_permissions"
}

// AdminUserRole 管理员角色关联
type AdminUserRole struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	AdminID   string    `gorm:"column:admin_id;type:uuid;not null" json:"admin_id"`
	RoleID    string    `gorm:"column:role_id;type:uuid;not null" json:"role_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (AdminUserRole) TableName() string {
	return "admin_user_roles"
}

// AdminSetting 管理员设置 - 对齐实际 admin_settings 表
type AdminSetting struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Category    string    `gorm:"size:50;not null;default:'general'" json:"category"`
	Key         string    `gorm:"uniqueIndex;size:100;not null" json:"key"`
	Value       string    `gorm:"type:text;default:''" json:"value"`
	ValueType   string    `gorm:"size:20;default:'string'" json:"value_type"`
	Description string    `gorm:"size:255;default:''" json:"description"`
	IsPublic    bool      `gorm:"default:false" json:"is_public"`
	UpdatedBy   string    `gorm:"column:updated_by;type:uuid" json:"updated_by,omitempty"` // UUID -> admins.id
	UpdatedAt   time.Time `gorm:"default:now()" json:"updated_at"`
}

func (AdminSetting) TableName() string {
	return "admin_settings"
}

// AdminAuditLog 管理员审计日志 - 对齐实际 admin_audit_log 表
type AdminAuditLog struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	AdminID    string    `gorm:"type:uuid;not null" json:"admin_id"` // UUID, FK -> admins.id
	Action     string    `gorm:"size:100;not null" json:"action"`
	TargetType string    `gorm:"size:50;default:''" json:"target_type"`
	TargetID   string    `gorm:"size:100;default:''" json:"target_id"`
	Detail     string    `gorm:"type:text;default:''" json:"detail"`
	IPAddress  string    `gorm:"size:50;default:''" json:"ip_address"`
	CreatedAt  time.Time `gorm:"default:now()" json:"created_at"`
}

func (AdminAuditLog) TableName() string {
	return "admin_audit_log"
}

// EnterpriseOrganization 企业组织模型。
// 当前阶段只作为企业治理 readiness 的真源表，不接入租户隔离或认证链路。
type EnterpriseOrganization struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Slug        string    `gorm:"uniqueIndex;size:100;not null" json:"slug"`
	DisplayName string    `gorm:"column:display_name;size:120;not null;default:''" json:"display_name"`
	Status      string    `gorm:"size:32;not null;default:'active'" json:"status"`
	Source      string    `gorm:"size:32;not null;default:'manual'" json:"source"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (EnterpriseOrganization) TableName() string {
	return "enterprise_organizations"
}

// EnterpriseTeam 企业团队模型。
// 团队必须归属组织；当前阶段只提供结构化真源和只读统计。
type EnterpriseTeam struct {
	ID             string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	OrganizationID string    `gorm:"column:organization_id;type:uuid;not null;index:idx_enterprise_teams_organization_id;index:idx_enterprise_teams_org_slug,unique" json:"organization_id"`
	Slug           string    `gorm:"size:100;not null;index:idx_enterprise_teams_org_slug,unique" json:"slug"`
	DisplayName    string    `gorm:"column:display_name;size:120;not null;default:''" json:"display_name"`
	Status         string    `gorm:"size:32;not null;default:'active'" json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (EnterpriseTeam) TableName() string {
	return "enterprise_teams"
}

// EnterpriseMember 企业成员模型。
// 成员关联 users 表；当前阶段不改变用户登录、项目归属或 RBAC 语义。
type EnterpriseMember struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	OrganizationID string    `gorm:"column:organization_id;type:uuid;not null;index;index:idx_enterprise_members_org_user_team,unique" json:"organization_id"`
	TeamID         *string   `gorm:"column:team_id;type:uuid;index;index:idx_enterprise_members_org_user_team,unique" json:"team_id,omitempty"`
	UserID         string    `gorm:"column:user_id;type:uuid;not null;index;index:idx_enterprise_members_org_user_team,unique" json:"user_id"`
	Role           string    `gorm:"size:32;not null;default:'member'" json:"role"`
	Status         string    `gorm:"size:32;not null;default:'active'" json:"status"`
	Source         string    `gorm:"size:32;not null;default:'manual'" json:"source"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (EnterpriseMember) TableName() string {
	return "enterprise_members"
}

// EnterpriseProjectOwnership 企业项目归属映射模型。
// 当前阶段只作为迁移 readiness 的显式 schema 真源，不改变 projects.user_id owner guard。
type EnterpriseProjectOwnership struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID      string    `gorm:"column:project_id;size:64;not null;uniqueIndex" json:"project_id"`
	OrganizationID string    `gorm:"column:organization_id;type:uuid;not null;index" json:"organization_id"`
	TeamID         *string   `gorm:"column:team_id;type:uuid;index" json:"team_id,omitempty"`
	Status         string    `gorm:"size:32;not null;default:'active'" json:"status"`
	Source         string    `gorm:"size:32;not null;default:'migration_readiness'" json:"source"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (EnterpriseProjectOwnership) TableName() string {
	return "enterprise_project_ownerships"
}

// EnterpriseProjectAccessGuardActivationAudit 是企业映射授权真实切换前后的 append-only 审计表。
// 当前阶段只建立 schema 和只读 readiness，不由 activation readiness 写入事件。
type EnterpriseProjectAccessGuardActivationAudit struct {
	ID                int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	EventType         string    `gorm:"column:event_type;size:64;not null;index" json:"event_type"`
	Status            string    `gorm:"size:32;not null;default:'planned';index" json:"status"`
	ActorAdminID      string    `gorm:"column:actor_admin_id;type:uuid;default:null" json:"actor_admin_id,omitempty"`
	ReadinessStatus   string    `gorm:"column:readiness_status;size:64;not null;default:''" json:"readiness_status"`
	CurrentMode       string    `gorm:"column:current_mode;size:32;not null;default:'legacy_user_owned'" json:"current_mode"`
	TargetMode        string    `gorm:"column:target_mode;size:32;not null;default:'enterprise_owned'" json:"target_mode"`
	ReadinessSnapshot string    `gorm:"column:readiness_snapshot;type:jsonb;not null;default:'{}'" json:"readiness_snapshot"`
	BlockerSnapshot   string    `gorm:"column:blocker_snapshot;type:jsonb;not null;default:'{}'" json:"blocker_snapshot"`
	ReviewSnapshot    string    `gorm:"column:review_snapshot;type:jsonb;not null;default:'{}'" json:"review_snapshot"`
	AuditPlanSnapshot string    `gorm:"column:audit_plan_snapshot;type:jsonb;not null;default:'{}'" json:"audit_plan_snapshot"`
	ExecutionResult   string    `gorm:"column:execution_result;type:jsonb;not null;default:'{}'" json:"execution_result"`
	RollbackReference string    `gorm:"column:rollback_reference;type:text;not null;default:''" json:"rollback_reference"`
	Source            string    `gorm:"size:64;not null;default:'activation_audit_schema_readiness'" json:"source"`
	CreatedAt         time.Time `json:"created_at"`
}

func (EnterpriseProjectAccessGuardActivationAudit) TableName() string {
	return "enterprise_project_access_guard_activation_audits"
}

// EnterpriseAuditExportTask 是企业审计导出任务的持久化落点。
// 当前阶段只建立 schema 和只读 readiness，不由 readiness 创建任务、生成文件或写 storage。
type EnterpriseAuditExportTask struct {
	ID                   string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	IdempotencyKey       string    `gorm:"column:idempotency_key;size:128;not null;uniqueIndex" json:"idempotency_key"`
	RequestedByAdminID   string    `gorm:"column:requested_by_admin_id;type:uuid;not null;index" json:"requested_by_admin_id"`
	Status               string    `gorm:"size:32;not null;default:'queued';index" json:"status"`
	Format               string    `gorm:"size:16;not null;default:'jsonl'" json:"format"`
	Reason               string    `gorm:"type:text;not null;default:''" json:"reason"`
	FiltersSnapshot      string    `gorm:"column:filters_snapshot;type:jsonb;not null;default:'{}'" json:"filters_snapshot"`
	TimeRangeStart       time.Time `gorm:"column:time_range_start;not null;index" json:"time_range_start"`
	TimeRangeEnd         time.Time `gorm:"column:time_range_end;not null;index" json:"time_range_end"`
	RequestSchemaVersion string    `gorm:"column:request_schema_version;size:80;not null;default:''" json:"request_schema_version"`
	FileSchemaVersion    string    `gorm:"column:file_schema_version;size:80;not null;default:''" json:"file_schema_version"`
	OutputPath           string    `gorm:"column:output_path;type:text;not null;default:''" json:"output_path"`
	ChecksumSHA256       string    `gorm:"column:checksum_sha256;size:64;not null;default:''" json:"checksum_sha256"`
	RowCount             int64     `gorm:"column:row_count;not null;default:0" json:"row_count"`
	ErrorMessage         string    `gorm:"column:error_message;type:text;not null;default:''" json:"error_message"`
	Source               string    `gorm:"size:64;not null;default:'audit_export_task_persistence_readiness'" json:"source"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func (EnterpriseAuditExportTask) TableName() string {
	return "enterprise_audit_export_tasks"
}

// EnterpriseAuditExportDeliveryReport 是企业审计导出交付报告的受控存储落点。
// 当前阶段只写数据库 report storage 与 admin audit，不写文件、不启动 worker、不修改任务状态。
type EnterpriseAuditExportDeliveryReport struct {
	ID                     string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	IdempotencyKey         string    `gorm:"column:idempotency_key;size:128;not null;uniqueIndex" json:"idempotency_key"`
	RequestedByAdminID     string    `gorm:"column:requested_by_admin_id;type:uuid;not null;index" json:"requested_by_admin_id"`
	Reason                 string    `gorm:"type:text;not null;default:''" json:"reason"`
	ReportFormat           string    `gorm:"column:report_format;size:32;not null;default:'markdown'" json:"report_format"`
	ReportContent          string    `gorm:"column:report_content;type:text;not null;default:''" json:"report_content"`
	ReportContentByteCount int64     `gorm:"column:report_content_byte_count;not null;default:0" json:"report_content_byte_count"`
	GeneratedAt            time.Time `gorm:"column:generated_at;not null;index" json:"generated_at"`
	ChecksumSHA256         string    `gorm:"column:checksum_sha256;size:64;not null;default:''" json:"checksum_sha256"`
	StoragePath            string    `gorm:"column:storage_path;type:text;not null;default:''" json:"storage_path"`
	StorageSchemaVersion   string    `gorm:"column:storage_schema_version;size:80;not null;default:''" json:"storage_schema_version"`
	MetadataJSON           string    `gorm:"column:metadata_json;type:jsonb;not null;default:'{}'" json:"metadata_json"`
	Source                 string    `gorm:"size:64;not null;default:'audit_export_delivery_report_storage_write'" json:"source"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

func (EnterpriseAuditExportDeliveryReport) TableName() string {
	return "enterprise_audit_export_delivery_reports"
}

// EnterpriseAuditExportWorkerExecutionRequest 是 worker 执行请求的幂等持久化落点。
// 当前阶段只建立 schema 和只读 readiness，不由 readiness 写执行请求、不启动 worker、不生成文件。
type EnterpriseAuditExportWorkerExecutionRequest struct {
	ID                              string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	IdempotencyKey                  string    `gorm:"column:idempotency_key;size:128;not null;uniqueIndex" json:"idempotency_key"`
	TaskID                          string    `gorm:"column:task_id;type:uuid;not null;index" json:"task_id"`
	RequestedByAdminID              string    `gorm:"column:requested_by_admin_id;type:uuid;not null;index" json:"requested_by_admin_id"`
	Status                          string    `gorm:"size:32;not null;default:'requested';index" json:"status"`
	Reason                          string    `gorm:"type:text;not null;default:''" json:"reason"`
	BatchLimit                      int       `gorm:"column:batch_limit;not null;default:10" json:"batch_limit"`
	RequestSchemaVersion            string    `gorm:"column:request_schema_version;size:80;not null;default:''" json:"request_schema_version"`
	WorkerReadinessStatus           string    `gorm:"column:worker_readiness_status;size:80;not null;default:''" json:"worker_readiness_status"`
	StatusTransitionReadinessStatus string    `gorm:"column:status_transition_readiness_status;size:80;not null;default:''" json:"status_transition_readiness_status"`
	TaskReadbackStatus              string    `gorm:"column:task_readback_status;size:80;not null;default:''" json:"task_readback_status"`
	QueuedTaskCount                 int       `gorm:"column:queued_task_count;not null;default:0" json:"queued_task_count"`
	RequestPayloadSnapshot          string    `gorm:"column:request_payload_snapshot;type:jsonb;not null;default:'{}'" json:"request_payload_snapshot"`
	ReadinessSnapshot               string    `gorm:"column:readiness_snapshot;type:jsonb;not null;default:'{}'" json:"readiness_snapshot"`
	ExecutionResult                 string    `gorm:"column:execution_result;type:jsonb;not null;default:'{}'" json:"execution_result"`
	OutputPath                      string    `gorm:"column:output_path;type:text;not null;default:''" json:"output_path"`
	ChecksumSHA256                  string    `gorm:"column:checksum_sha256;size:64;not null;default:''" json:"checksum_sha256"`
	RowCount                        int64     `gorm:"column:row_count;not null;default:0" json:"row_count"`
	ErrorMessage                    string    `gorm:"column:error_message;type:text;not null;default:''" json:"error_message"`
	Source                          string    `gorm:"size:64;not null;default:'audit_export_worker_execution_request_persistence_readiness'" json:"source"`
	CreatedAt                       time.Time `json:"created_at"`
	UpdatedAt                       time.Time `json:"updated_at"`
}

func (EnterpriseAuditExportWorkerExecutionRequest) TableName() string {
	return "enterprise_audit_export_worker_execution_requests"
}

func (User) TableName() string {
	return "users"
}

// ============================================
// 项目相关模型
// ============================================

// Project 项目模型
type Project struct {
	ID          string `gorm:"primaryKey;type:uuid" json:"id"`
	UserID      string `gorm:"index;type:uuid;not null" json:"user_id"`     // 关联用户 (UUID)
	ProjectID   string `gorm:"uniqueIndex;size:64" json:"project_id"`       // 项目唯一标识
	Name        string `gorm:"size:255;not null" json:"name"`               // 项目名称
	Description string `gorm:"type:text" json:"description"`                // 项目描述
	AppType     string `gorm:"size:50;default:'web'" json:"app_type"`       // 应用类型：web, mobile, miniprogram, desktop
	TechStack   string `gorm:"type:text" json:"tech_stack"`                 // 技术栈（结构化 JSON）
	Visibility  string `gorm:"size:20;default:'private'" json:"visibility"` // private, public, unlisted

	// Preview 分享
	PreviewShareEnabled bool   `gorm:"column:preview_share_enabled;default:false" json:"preview_share_enabled"`
	PreviewShareID      string `gorm:"column:preview_share_id;size:96;uniqueIndex:projects_preview_share_id_unique,where:preview_share_id IS NOT NULL AND preview_share_id <> ''" json:"preview_share_id"`

	// 容器相关字段（YiStack 架构核心）
	ContainerID     string `gorm:"size:64" json:"container_id"`                // Podman 容器ID
	ContainerName   string `gorm:"size:128" json:"container_name"`             // 容器名称
	ContainerPort   int    `gorm:"default:0" json:"container_port"`            // 容器映射端口
	ContainerImage  string `gorm:"size:256" json:"container_image"`            // 镜像名
	ContainerStatus string `gorm:"size:20;default:''" json:"container_status"` // running, stopped, error
	DirectoryPath   string `gorm:"size:512" json:"directory_path"`             // 项目目录路径

	// 方案相关字段
	PlanID   string `gorm:"size:64" json:"plan_id"`
	PlanData string `gorm:"type:text" json:"plan_data"`

	// Git 相关
	GitRepoURL string `gorm:"size:500" json:"git_repo_url"`
	GitBranch  string `gorm:"size:100;default:'main'" json:"git_branch"`

	// 统计
	Stars int `gorm:"default:0" json:"stars"`
	Forks int `gorm:"default:0" json:"forks"`

	// 文件树
	FileTree string `gorm:"type:text" json:"file_tree"`

	// 软删除
	DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`

	// 时间戳
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// 关联
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Project) TableName() string {
	return "projects"
}

// ProjectFile 项目文件模型 - 对齐实际 project_files 表
type ProjectFile struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID   string    `gorm:"index;size:64;not null" json:"project_id"` // 关联项目
	Path        string    `gorm:"size:512;not null" json:"path"`            // 文件路径
	Content     string    `gorm:"type:text" json:"content"`                 // 文件内容
	ContentHash string    `gorm:"size:64" json:"content_hash"`              // SHA256 哈希
	FileType    string    `gorm:"size:50;default:'file'" json:"file_type"`  // file, directory
	Size        int       `gorm:"default:0" json:"size"`                    // 文件大小（字节）
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (ProjectFile) TableName() string {
	return "project_files"
}

// ProjectEngineeringState 项目级工程状态快照。
// 该表是 workflow 消息状态的查询增强入口，完整状态语义仍以 State JSON 快照为准。
type ProjectEngineeringState struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID      string    `gorm:"uniqueIndex;size:64;not null" json:"project_id"`
	UserID         string    `gorm:"index;type:uuid" json:"user_id"`
	WorkflowStage  string    `gorm:"index;size:64" json:"workflow_stage"`
	WorkflowMode   string    `gorm:"size:64" json:"workflow_mode"`
	WorkflowStatus string    `gorm:"index;size:32" json:"workflow_status"`
	State          string    `gorm:"type:text;not null" json:"state"`
	Content        string    `gorm:"type:text" json:"content"`
	Model          string    `gorm:"size:64" json:"model"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (ProjectEngineeringState) TableName() string {
	return "project_engineering_states"
}

// ProjectCapabilityExecutionAudit 记录单次能力执行层审计结果。
// 该表是 append-only 审计入口，主链路状态仍以 EngineeringState 和 capability step meta 为准。
type ProjectCapabilityExecutionAudit struct {
	ID                 int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID          string    `gorm:"index;size:64" json:"project_id"`
	UserID             string    `gorm:"index;type:uuid" json:"user_id"`
	WorkflowStage      string    `gorm:"index;size:64" json:"workflow_stage"`
	WorkflowMode       string    `gorm:"size:64" json:"workflow_mode"`
	CapabilityProfile  string    `gorm:"index;size:128" json:"capability_profile"`
	Status             string    `gorm:"index;size:32" json:"status"`
	ProviderResolution string    `gorm:"type:text;not null" json:"provider_resolution"`
	ExecutionAudit     string    `gorm:"type:text;not null" json:"execution_audit"`
	ExecutionResult    string    `gorm:"type:text;not null" json:"execution_result"`
	SourceNote         string    `gorm:"type:text" json:"source_note"`
	CreatedAt          time.Time `json:"created_at"`
}

func (ProjectCapabilityExecutionAudit) TableName() string {
	return "project_capability_execution_audits"
}

// GitHubConnection stores OAuth identity metadata and an encrypted access token.
type GitHubConnection struct {
	ID              string    `gorm:"primaryKey;type:uuid" json:"id"`
	UserID          string    `gorm:"uniqueIndex;type:uuid;not null" json:"user_id"`
	AccountID       int64     `gorm:"not null" json:"account_id"`
	AccountLogin    string    `gorm:"size:255;not null" json:"account_login"`
	AccountName     string    `gorm:"size:255" json:"account_name"`
	AvatarURL       string    `gorm:"size:1000" json:"avatar_url"`
	Scopes          string    `gorm:"type:text" json:"scopes"`
	TokenCiphertext string    `gorm:"type:text;not null" json:"-"`
	TokenNonce      string    `gorm:"size:255;not null" json:"-"`
	TokenKeyVersion string    `gorm:"size:32;not null" json:"-"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (GitHubConnection) TableName() string { return "github_connections" }

// GitHubOAuthState is a one-time PKCE state record. Raw state is never stored.
type GitHubOAuthState struct {
	StateHash    string     `gorm:"primaryKey;size:64" json:"-"`
	UserID       string     `gorm:"index;type:uuid;not null" json:"user_id"`
	CodeVerifier string     `gorm:"type:text;not null" json:"-"`
	ReturnPath   string     `gorm:"size:1000;not null" json:"return_path"`
	ExpiresAt    time.Time  `gorm:"index;not null" json:"expires_at"`
	ConsumedAt   *time.Time `gorm:"index" json:"consumed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

func (GitHubOAuthState) TableName() string { return "github_oauth_states" }

// GitHubProjectBinding maps a YiStack project to one GitHub repository.
type GitHubProjectBinding struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID      string    `gorm:"uniqueIndex;size:64;not null" json:"project_id"`
	UserID         string    `gorm:"index;type:uuid;not null" json:"user_id"`
	RepositoryID   int64     `gorm:"index;not null" json:"repository_id"`
	RepositoryName string    `gorm:"index;size:500;not null" json:"repository_name"`
	RepositoryURL  string    `gorm:"size:1000;not null" json:"repository_url"`
	DefaultBranch  string    `gorm:"size:255;not null" json:"default_branch"`
	RemoteName     string    `gorm:"size:64;not null;default:'origin'" json:"remote_name"`
	PermissionPush bool      `gorm:"not null;default:false" json:"permission_push"`
	RemoteHeadSHA  string    `gorm:"size:64" json:"remote_head_sha"`
	WebhookID      int64     `gorm:"not null;default:0" json:"webhook_id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (GitHubProjectBinding) TableName() string { return "github_project_bindings" }

// GitHubSyncOperation is the durable idempotency record for import/pull/push.
type GitHubSyncOperation struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	UserID         string    `gorm:"index:github_sync_idempotency,unique;type:uuid;not null" json:"user_id"`
	ProjectID      string    `gorm:"index;size:64;not null" json:"project_id"`
	IdempotencyKey string    `gorm:"index:github_sync_idempotency,unique;size:255;not null" json:"idempotency_key"`
	Kind           string    `gorm:"index;size:32;not null" json:"kind"`
	RequestHash    string    `gorm:"size:64;not null" json:"request_hash"`
	Status         string    `gorm:"index;size:32;not null" json:"status"`
	Result         string    `gorm:"type:text" json:"result"`
	ErrorCode      string    `gorm:"size:128" json:"error_code"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (GitHubSyncOperation) TableName() string { return "github_sync_operations" }

// GitHubWebhookDelivery is append-only replay protection for GitHub webhooks.
type GitHubWebhookDelivery struct {
	DeliveryID     string    `gorm:"primaryKey;size:255" json:"delivery_id"`
	Event          string    `gorm:"index;size:100;not null" json:"event"`
	RepositoryName string    `gorm:"index;size:500" json:"repository_name"`
	ProjectID      string    `gorm:"index;size:64" json:"project_id"`
	Ref            string    `gorm:"size:500" json:"ref"`
	AfterSHA       string    `gorm:"size:64" json:"after_sha"`
	Status         string    `gorm:"index;size:32;not null" json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

func (GitHubWebhookDelivery) TableName() string { return "github_webhook_deliveries" }

// ProjectResourceAlertEvent 记录项目资源告警的显式受控创建事件。
// 该表是 append-only 事件入口，不承担通知、硬配额或运行时控制职责。
type ProjectResourceAlertEvent struct {
	ID                  int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID           string    `gorm:"index;size:64;not null" json:"project_id"`
	UserID              string    `gorm:"index;type:uuid" json:"user_id"`
	Status              string    `gorm:"index;size:32;not null" json:"status"`
	EvaluationID        string    `gorm:"index;size:128;not null" json:"evaluation_id"`
	ReadinessStatus     string    `gorm:"index;size:32" json:"readiness_status"`
	TriggeredCount      int       `gorm:"default:0" json:"triggered_count"`
	TriggeredThresholds string    `gorm:"type:text;not null" json:"triggered_thresholds"`
	Thresholds          string    `gorm:"type:text;not null" json:"thresholds"`
	EvaluationPreview   string    `gorm:"type:text;not null" json:"evaluation_preview"`
	Message             string    `gorm:"type:text" json:"message"`
	Recovery            string    `gorm:"type:text" json:"recovery"`
	CreatedAt           time.Time `json:"created_at"`
}

func (ProjectResourceAlertEvent) TableName() string {
	return "project_resource_alert_events"
}

// ============================================
// 方案相关模型（AI 生成方案）
// ============================================

// Plan 方案模型 - AI 根据用户需求生成的技术方案
type Plan struct {
	ID            string          `json:"id"`           // 方案唯一标识
	ProjectID     string          `json:"project_id"`   // 关联项目
	Name          string          `json:"name"`         // 方案名称
	Description   string          `json:"description"`  // 方案描述
	TechStack     json.RawMessage `json:"tech_stack"`   // 结构化技术栈
	Architecture  string          `json:"architecture"` // 架构说明
	Complexity    string          `json:"complexity"`   // 复杂度: simple, medium, complex
	EstFiles      int             `json:"est_files"`    // 预估文件数量
	Features      []string        `json:"features"`     // 包含的功能列表
	Reasoning     string          `json:"reasoning"`    // AI 推荐理由
	VisualContext *VisualContext  `json:"visual_context,omitempty"`
}

// ============================================
// 聊天相关模型
// ============================================

// ChatMessage 聊天消息模型
type ChatMessage struct {
	ID                int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID         string    `gorm:"index;size:64" json:"project_id"` // 关联项目
	UserID            string    `gorm:"index;type:uuid" json:"user_id"`  // 关联用户 (UUID)
	Role              string    `gorm:"size:20" json:"role"`             // system, user, assistant
	Content           string    `gorm:"type:text" json:"content"`        // 消息内容
	VisualAttachments string    `gorm:"column:visual_attachments;type:text" json:"visual_attachments,omitempty"`
	VisualContext     string    `gorm:"column:visual_context;type:text" json:"visual_context,omitempty"`
	Model             string    `gorm:"size:64" json:"model"`    // 使用的模型
	Tokens            int       `gorm:"default:0" json:"tokens"` // 消耗的 token 数
	CreatedAt         time.Time `json:"created_at"`
}

func (ChatMessage) TableName() string {
	return "chat_messages"
}

// ============================================
// 系统配置模型
// ============================================

// SystemConfig 系统配置模型
type SystemConfig struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Key         string    `gorm:"uniqueIndex;size:100;not null" json:"key"`
	Value       string    `gorm:"type:text" json:"value"`
	ValueType   string    `gorm:"size:20;default:'string'" json:"value_type"` // string, number, boolean, json
	Description string    `gorm:"size:255" json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (SystemConfig) TableName() string {
	return "system_config"
}

// 系统配置常量
var DefaultSystemConfigs = []SystemConfig{
	{Key: "features.user_registration", Value: "true", ValueType: "boolean", Description: "是否开放用户注册"},
	{Key: "features.ai_generation", Value: "true", ValueType: "boolean", Description: "是否启用AI生成"},
	{Key: "features.git_integration", Value: "true", ValueType: "boolean", Description: "是否启用Git集成"},
	{Key: "system.maintenance_mode", Value: "false", ValueType: "boolean", Description: "维护模式"},
	{Key: "system.registration_mode", Value: "open", ValueType: "string", Description: "注册模式: open/invite/closed"},
	{Key: "system.max_upload_size", Value: "10485760", ValueType: "number", Description: "最大上传大小（字节），运行期后台配置"},
	{Key: "enterprise.sso.enabled", Value: "false", ValueType: "boolean", Description: "企业 SSO 配置开关；仅表示配置 readiness，不启用登录回调"},
	{Key: "enterprise.sso.provider_type", Value: "oidc", ValueType: "string", Description: "企业 SSO provider 类型，当前仅作为 readiness 配置保留"},
	{Key: "enterprise.sso.issuer_url", Value: "", ValueType: "string", Description: "企业 SSO OIDC issuer URL，留空表示未配置"},
	{Key: "enterprise.sso.client_id", Value: "", ValueType: "string", Description: "企业 SSO OIDC client_id，留空表示未配置"},
	{Key: "enterprise.sso.redirect_uri", Value: "", ValueType: "string", Description: "企业 SSO 登录回调地址，留空表示未配置"},
	{Key: "enterprise.sso.allowed_domains", Value: "[]", ValueType: "json", Description: "允许使用企业 SSO 的邮箱域名列表(JSON)，空数组表示未限制"},
	{Key: "enterprise.audit.retention_days", Value: "180", ValueType: "number", Description: "企业审计日志保留天数；仅用于 readiness，不执行自动删除"},
	{Key: "enterprise.project_access_guard.mode", Value: "legacy_user_owned", ValueType: "string", Description: "Project Access Guard 授权模式：legacy_user_owned 或 enterprise_owned；默认保持用户归属授权"},
	{Key: "project.max_size", Value: "2147483648", ValueType: "number", Description: "项目目录最大大小（字节），后台运行期配置"},
	{Key: "project.max_file_size", Value: "10485760", ValueType: "number", Description: "项目单文件最大大小（字节），后台运行期配置"},
	{Key: "project.allowed_extensions", Value: ".go,.py,.js,.ts,.tsx,.jsx,.html,.css,.json,.yaml,.yml,.md,.txt,.sql,.sh", ValueType: "string", Description: "允许写入/备份治理的项目文件扩展名列表，逗号分隔"},
	{Key: "project.auto_backup", Value: "true", ValueType: "boolean", Description: "是否启用项目自动备份策略"},
	{Key: "project.backup_dir", Value: "", ValueType: "string", Description: "项目备份根目录；留空时使用启动配置或默认 runtime/backups"},
	{Key: "project.auto_backup_interval_seconds", Value: "3600", ValueType: "number", Description: "项目自动备份调度间隔（秒），<=0 表示禁用后台调度"},
	{Key: "project.backup_remote_enabled", Value: "false", ValueType: "boolean", Description: "是否启用项目远端备份存储"},
	{Key: "project.backup_remote_provider", Value: "", ValueType: "string", Description: "项目远端备份存储 provider，例如 s3"},
	{Key: "project.backup_remote_bucket", Value: "", ValueType: "string", Description: "项目远端备份存储 bucket"},
	{Key: "project.backup_remote_prefix", Value: "yistack/project-backups", ValueType: "string", Description: "项目远端备份对象前缀"},
	{Key: "project.backup_remote_endpoint", Value: "", ValueType: "string", Description: "项目远端备份 S3-compatible endpoint"},
	{Key: "project.backup_remote_region", Value: "", ValueType: "string", Description: "项目远端备份区域"},
	{Key: "project.generation_repair_max_attempts", Value: "2", ValueType: "number", Description: "生成项目 Validation 失败后的自动修复轮数，硬上限为 3"},
	{Key: "project.generation_repair_timeout_seconds", Value: "90", ValueType: "number", Description: "单轮生成项目自动修复 LLM 请求超时秒数"},
	{Key: "project.generation_repair_max_output_units", Value: "4096", ValueType: "number", Description: "单轮生成项目自动修复最大输出 token 数"},
	{Key: "project.browser_acceptance_timeout_seconds", Value: "45", ValueType: "number", Description: "生成项目 Playwright 浏览器验收超时秒数，硬上限为 120"},
	{Key: "project.resource_alert_enabled", Value: "false", ValueType: "boolean", Description: "是否启用项目资源告警策略 readiness"},
	{Key: "project.resource_alert_cpu_percent", Value: "0", ValueType: "number", Description: "项目 CPU 使用率告警阈值百分比，<=0 表示未配置"},
	{Key: "project.resource_alert_memory_percent", Value: "0", ValueType: "number", Description: "项目内存使用率告警阈值百分比，<=0 表示未配置"},
	{Key: "project.resource_alert_disk_bytes", Value: "0", ValueType: "number", Description: "项目磁盘使用告警阈值（字节），<=0 表示未配置"},
	{Key: "project.resource_alert_notification_enabled", Value: "false", ValueType: "boolean", Description: "是否启用项目资源告警通知通道 readiness"},
	{Key: "project.resource_alert_notification_provider", Value: "", ValueType: "string", Description: "项目资源告警通知 provider，例如 webhook；webhook URL 需走受控 secret storage"},
	{Key: "project.resource_alert_enforcement_enabled", Value: "false", ValueType: "boolean", Description: "是否启用项目资源告警硬配额执行 readiness"},
	{Key: "project.resource_alert_enforcement_mode", Value: "", ValueType: "string", Description: "项目资源告警硬配额执行模式，例如 stop_container"},
	{Key: "capability.enable_skill_provider", Value: "false", ValueType: "boolean", Description: "是否允许 Skill provider 被解析为可用"},
	{Key: "capability.enable_mcp_provider", Value: "false", ValueType: "boolean", Description: "是否允许 MCP provider 被解析为可用"},
	{Key: "capability.enable_skill_execution", Value: "false", ValueType: "boolean", Description: "是否允许真实调用 Skill runner"},
	{Key: "capability.enable_mcp_execution", Value: "false", ValueType: "boolean", Description: "是否允许真实调用 MCP runner"},
	{Key: "capability.skill_runner_mode", Value: "", ValueType: "string", Description: "Skill runner 模式：空值、dry-run、contract、skill-http"},
	{Key: "capability.mcp_runner_mode", Value: "", ValueType: "string", Description: "MCP runner 模式：空值、dry-run、contract、mcp-http"},
	{Key: "capability.skill_runner_manifest", Value: "", ValueType: "string", Description: "Skill contract runner manifest 路径"},
	{Key: "capability.mcp_runner_manifest", Value: "", ValueType: "string", Description: "MCP contract runner manifest 路径"},
	{Key: "capability.skill_runner_endpoint", Value: "", ValueType: "string", Description: "Skill HTTP runner endpoint"},
	{Key: "capability.mcp_runner_endpoint", Value: "", ValueType: "string", Description: "MCP HTTP runner endpoint"},
	{Key: "capability.runner_timeout_seconds", Value: "30", ValueType: "number", Description: "外部 capability runner 统一超时时间（秒）"},
	{Key: "capability.runner_network_enabled", Value: "false", ValueType: "boolean", Description: "是否允许真实 capability runner 发起网络调用"},
	{Key: "capability.runner_network_allowlist", Value: "", ValueType: "string", Description: "允许真实 capability runner 访问的网络目标，逗号分隔"},
	{Key: "capability.execution_policy_note", Value: "后台配置未启用外部 Skill / MCP 执行；默认保持能力调用禁用。", ValueType: "string", Description: "Capability 执行策略来源说明"},
	{Key: "llm.default_model", Value: "doubao-seed-2.0-lite-260215", ValueType: "string", Description: "默认LLM模型"},
	{Key: "prompt.project_plans.system", Value: `你是一个应用架构师。用户描述需求，你需要生成 2-3 个技术方案供用户选择。

每个方案必须严格以 JSON 格式输出，包含以下字段：
- id: 方案唯一标识，格式 plan_xxx
- name: 方案名称（简短）
- description: 方案描述（1-2句话）
- tech_stack: 结构化技术栈对象，必须包含 runtime.profile、runtime.languages 和 summary。runtime.profile 从以下选择：node-nextjs, node-react, node-vue, node-express, python-fastapi, python-django, python-flask, go-gin, go-fiber, static-html。需要 MySQL/Redis 时必须在 services 中声明。示例：{"runtime":{"profile":"python-django","needs_container":true,"package_manager":"pip","languages":[{"name":"python","version":"3.11"},{"name":"node","version":"20"}]},"frontend":{"language":"TypeScript","framework":"React","ui":"Tailwind CSS"},"backend":{"language":"Python","framework":"Django"},"database":{"type":"MySQL"},"services":[{"type":"mysql"},{"type":"redis"}],"summary":["TypeScript","React","Python","Django","MySQL","Redis"]}
- architecture: 架构说明
- complexity: 复杂度评估 simple/medium/complex
- est_files: 预估文件数量
- features: 包含的核心功能列表
- reasoning: 为什么推荐这个方案

请以 JSON 数组格式输出所有方案，不要输出其他内容。`, ValueType: "string", Description: "项目方案生成的系统提示词"},
	{Key: "prompt.chat.discuss.system", Value: `你是 YiStack 的企业级项目技术顾问。

你的当前任务是“探讨”，不是“直接实现”。

要求：
1. 只做分析、澄清、方案权衡、实现建议与风险提示。
2. 不要声称已经修改文件、执行命令、启动容器或完成提交。
3. 如果用户的问题涉及当前项目，优先结合项目上下文回答。
4. 回答要直接、结构清晰，优先给出下一步建议。`, ValueType: "string", Description: "探讨模式的系统提示词"},
	{Key: "prompt.chat.implement.system", Value: `你是一个应用生成助手。用户描述需求，你需要生成相应的代码文件。

生成结果必须遵循系统追加的“生成结果协议（强制）”，不得输出协议外内容。
确保生成的代码完整、可运行。`, ValueType: "string", Description: "实现模式的系统提示词"},
	{Key: "template.project_docs.agents_md", Value: "", ValueType: "string", Description: "项目 AGENTS.md 模板覆盖，留空使用内置模板"},
	{Key: "template.project_docs.requirements_md", Value: "", ValueType: "string", Description: "项目 REQUIREMENTS.md 模板覆盖，留空使用内置模板"},
	{Key: "template.project_docs.design_md", Value: "", ValueType: "string", Description: "项目 DESIGN.md 模板覆盖，留空使用内置模板"},
	{Key: "template.project_docs.runbook_md", Value: "", ValueType: "string", Description: "项目 RUNBOOK.md 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.default.readme_md", Value: "", ValueType: "string", Description: "默认脚手架 README.md 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.go_gin.dockerfile", Value: "", ValueType: "string", Description: "Go Gin 脚手架 Dockerfile 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.go_gin.go_mod", Value: "", ValueType: "string", Description: "Go Gin 脚手架 go.mod 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.go_gin.main_go", Value: "", ValueType: "string", Description: "Go Gin 脚手架 main.go 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.node_nextjs.gitignore", Value: "", ValueType: "string", Description: "Node Next.js 脚手架 .gitignore 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.node_nextjs.package_json", Value: "", ValueType: "string", Description: "Node Next.js 脚手架 package.json 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.node_nextjs.src.app.layout_tsx", Value: "", ValueType: "string", Description: "Node Next.js 脚手架 app layout 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.node_nextjs.src.app.page_tsx", Value: "", ValueType: "string", Description: "Node Next.js 脚手架 app page 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.node_nextjs.tsconfig_json", Value: "", ValueType: "string", Description: "Node Next.js 脚手架 tsconfig.json 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.python_fastapi.dockerfile", Value: "", ValueType: "string", Description: "Python FastAPI 脚手架 Dockerfile 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.python_fastapi.main_py", Value: "", ValueType: "string", Description: "Python FastAPI 脚手架 main.py 模板覆盖，留空使用内置模板"},
	{Key: "template.project_scaffolds.python_fastapi.requirements_txt", Value: "", ValueType: "string", Description: "Python FastAPI 脚手架 requirements.txt 模板覆盖，留空使用内置模板"},
	{Key: "container.enabled", Value: "true", ValueType: "boolean", Description: "是否启用项目容器运行时"},
	{Key: "container.runtime", Value: "podman", ValueType: "string", Description: "容器运行时: podman/docker"},
	{Key: "container.socket_path", Value: "", ValueType: "string", Description: "容器运行时 Socket 路径（留空时自动使用当前用户 Podman socket）"},
	{Key: "container.project_dir", Value: "", ValueType: "string", Description: "项目代码宿主机根目录（留空时使用环境变量或默认 runtime/projects）"},
	{Key: "container.template_dir", Value: "", ValueType: "string", Description: "项目模板根目录（留空时使用环境变量或默认 runtime/templates）"},
	{Key: "container.data_dir", Value: "", ValueType: "string", Description: "容器相关数据目录（留空时使用环境变量或默认 runtime/container-data）"},
	{Key: "container.apt_mirror", Value: "https://mirrors.tuna.tsinghua.edu.cn", ValueType: "string", Description: "容器内 apt 镜像源基地址，例如 https://mirrors.tuna.tsinghua.edu.cn"},
	{Key: "container.apt_mirror_candidates", Value: `[{"url":"https://mirrors.tuna.tsinghua.edu.cn","priority":1,"enabled":true},{"url":"https://mirrors.ustc.edu.cn","priority":2,"enabled":true},{"url":"https://mirrors.aliyun.com","priority":3,"enabled":true},{"url":"https://mirrors.cloud.tencent.com","priority":4,"enabled":true}]`, ValueType: "json", Description: "容器内 apt 候选镜像源列表(JSON)，支持字符串数组或带 url/priority/enabled 的对象数组"},
	{Key: "container.port_range_start", Value: "30000", ValueType: "number", Description: "容器映射端口起始值"},
	{Key: "container.port_range_end", Value: "40000", ValueType: "number", Description: "容器映射端口结束值"},
	{Key: "container.default_cpu", Value: "1", ValueType: "string", Description: "默认 CPU 配额"},
	{Key: "container.default_memory", Value: "1g", ValueType: "string", Description: "默认内存配额"},
	{Key: "container.default_disk", Value: "2g", ValueType: "string", Description: "默认磁盘配额"},
	{Key: "container.idle_timeout_min", Value: "15", ValueType: "number", Description: "工作台容器空闲自动停止时间(分钟)"},
	{Key: "container.images", Value: `[{"type":"node-nextjs","name":"Node Devbox","image":"localhost/devbox:bookworm","port":3000,"priority":10,"description":"Next.js/Node 项目默认开发镜像"},{"type":"node-react","name":"Node Devbox","image":"localhost/devbox:bookworm","port":5173,"priority":20,"description":"React/Vite 项目默认开发镜像"},{"type":"node-vue","name":"Node Devbox","image":"localhost/devbox:bookworm","port":5173,"priority":30,"description":"Vue 项目默认开发镜像"},{"type":"node-express","name":"Node Devbox","image":"localhost/devbox:bookworm","port":3000,"priority":40,"description":"Node 服务项目默认开发镜像"},{"type":"static-html","name":"Node Devbox","image":"localhost/devbox:bookworm","port":3000,"priority":50,"description":"静态站点项目默认开发镜像"},{"type":"default","name":"Default Runtime Image","image":"localhost/devbox:bookworm","port":3000,"priority":1000,"description":"未命中专用 profile 时使用的默认运行时镜像"}]`, ValueType: "json", Description: "可用容器镜像列表(JSON)，支持按 runtime profile 选择镜像，并在未命中时回退到 default 默认镜像"},
	{Key: "rate_limit.requests_per_minute", Value: "60", ValueType: "number", Description: "每分钟请求限制"},
}

// GeneratedFile 生成文件模型（兼容旧代码）
type GeneratedFile struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID string    `gorm:"index;size:64" json:"project_id"`
	Path      string    `gorm:"size:512" json:"path"`
	Content   string    `gorm:"type:longtext" json:"content"`
	Size      int       `json:"size"`
	FileType  string    `gorm:"size:50" json:"file_type"`
	CreatedAt time.Time `json:"created_at"`
}

func (GeneratedFile) TableName() string {
	return "generated_files"
}

// ============================================
// LLM Provider 配置模型
// ============================================

// LLMProvider LLM 提供商配置 - 对齐实际 llm_providers 表
type LLMProvider struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string `gorm:"uniqueIndex;size:50;not null" json:"name"`
	DisplayName string `gorm:"size:100" json:"display_name"`
	Type        string `gorm:"size:20;default:'cloud'" json:"type"` // cloud 或 local
	APIKey      string `gorm:"size:500" json:"api_key,omitempty"`
	BaseURL     string `gorm:"size:500" json:"base_url"`
	Model       string `gorm:"size:200" json:"model"`
	Enabled     bool   `gorm:"default:false" json:"enabled"`
	IsDefault   bool   `gorm:"default:false" json:"is_default"`
	Priority    int    `gorm:"default:0" json:"priority"`
	SortOrder   int    `gorm:"default:0" json:"sort_order"`

	// 额外配置（JSON 存储）
	ExtraConfig string `gorm:"type:text" json:"extra_config,omitempty"`

	// 使用统计
	UseCount   int64      `gorm:"default:0" json:"use_count"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`

	// 时间戳
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (LLMProvider) TableName() string {
	return "llm_providers"
}

// LLMProviderModel 是 Provider 下的模型配置。
// Provider 保存连接信息；Model 保存可选模型、能力标签、默认用途与排序。
type LLMProviderModel struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProviderID     int64     `gorm:"column:provider_id;not null;index;uniqueIndex:idx_llm_provider_models_provider_model" json:"provider_id"`
	ModelID        string    `gorm:"column:model_id;size:200;not null;uniqueIndex:idx_llm_provider_models_provider_model" json:"model_id"`
	DisplayName    string    `gorm:"column:display_name;size:200" json:"display_name"`
	Enabled        bool      `gorm:"default:true" json:"enabled"`
	IsDefault      bool      `gorm:"column:is_default;default:false" json:"is_default"`
	CapabilityTags string    `gorm:"column:capability_tags;type:text" json:"capability_tags"`
	ContextWindow  int       `gorm:"column:context_window;default:0" json:"context_window"`
	DefaultFor     string    `gorm:"column:default_for;size:120;default:''" json:"default_for"`
	Priority       int       `gorm:"default:0" json:"priority"`
	SortOrder      int       `gorm:"column:sort_order;default:0" json:"sort_order"`
	ExtraConfig    string    `gorm:"column:extra_config;type:text" json:"extra_config,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (LLMProviderModel) TableName() string {
	return "llm_provider_models"
}

// LLMProviderExtraConfig LLM Provider 额外配置
type LLMProviderExtraConfig struct {
	Temperature float64 `json:"temperature,omitempty"`
	MaxTokens   int     `json:"max_tokens,omitempty"`
	TopP        float64 `json:"top_p,omitempty"`
	Timeout     int     `json:"timeout,omitempty"`
}

// DefaultLLMProviders 返回默认的 LLM Provider 配置
func DefaultLLMProviders() []LLMProvider {
	return []LLMProvider{
		{
			Name: "doubao", DisplayName: "豆包 (Doubao)", Type: "cloud",
			BaseURL: "https://ark.cn-beijing.volces.com/api/v3", Model: "doubao-seed-2.0-lite-260215",
			Enabled: true, IsDefault: true, Priority: 100, SortOrder: 1,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
		{
			Name: "openai", DisplayName: "OpenAI", Type: "cloud",
			BaseURL: "https://api.openai.com/v1", Model: "gpt-4o",
			Enabled: false, Priority: 90, SortOrder: 2,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
		{
			Name: "qwen", DisplayName: "通义千问 (Qwen)", Type: "cloud",
			BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", Model: "qwen-plus",
			Enabled: false, Priority: 80, SortOrder: 3,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
		{
			Name: "openrouter", DisplayName: "OpenRouter", Type: "cloud",
			BaseURL: "https://openrouter.ai/api/v1", Model: "anthropic/claude-3.5-sonnet",
			Enabled: false, Priority: 70, SortOrder: 4,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
		{
			Name: "ollama", DisplayName: "Ollama (本地部署)", Type: "local",
			BaseURL: "http://localhost:11434", Model: "llama3.2",
			Enabled: false, Priority: 60, SortOrder: 5,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
		{
			Name: "ollama-cloud", DisplayName: "Ollama (云端部署)", Type: "cloud",
			BaseURL: "https://ollama.com", Model: "llama3.2",
			Enabled: false, Priority: 60, SortOrder: 6,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
		{
			Name: "kimi", DisplayName: "Kimi (Moonshot)", Type: "cloud",
			BaseURL: "https://api.moonshot.cn/v1", Model: "moonshot-v1-8k",
			Enabled: false, Priority: 85, SortOrder: 7,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
		{
			Name: "deepseek", DisplayName: "DeepSeek", Type: "cloud",
			BaseURL: "https://api.deepseek.com/v1", Model: "deepseek-chat",
			Enabled: false, Priority: 75, SortOrder: 8,
			ExtraConfig: `{"temperature":0.7,"max_tokens":4096}`,
		},
	}
}

// FormatUserID 格式化用户 ID 用于日志等
func FormatUserID(id string) string {
	if len(id) > 8 {
		return id[:8] + "..."
	}
	return id
}

// SafeUserID 安全地获取用户 ID 字符串
func SafeUserID(id any) string {
	switch v := id.(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%.0f", v)
	case int:
		return fmt.Sprintf("%d", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// Commit 提交记录模型
type Commit struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID  string    `gorm:"index;size:64" json:"project_id"`
	UserID     string    `gorm:"type:uuid" json:"user_id"`
	Message    string    `gorm:"size:500" json:"message"`
	Hash       string    `gorm:"size:64" json:"hash"`
	ParentHash string    `gorm:"size:64" json:"parent_hash"`
	CreatedAt  time.Time `json:"created_at"`
}

func (Commit) TableName() string {
	return "commits"
}
