// Package service 仓储接口定义
// 统一 GORM 和 Supabase REST API 两种实现
// 所有用户相关 ID 使用 string 类型以兼容 UUID
package service

import (
	"context"
	"time"

	"yistack/internal/model"
	"yistack/pkg/llm"
)

// ProjectRepo 项目仓储接口
type ProjectRepo interface {
	Create(ctx context.Context, project *model.Project) error
	FindByID(ctx context.Context, id string) (*model.Project, error)
	FindByProjectID(ctx context.Context, projectID string) (*model.Project, error)
	FindByPreviewShareID(ctx context.Context, previewShareID string) (*model.Project, error)
	ListByUserID(ctx context.Context, userID string, page, pageSize int) ([]model.Project, int64, error)
	ListAll(ctx context.Context, page, pageSize int) ([]model.Project, int64, error)
	Update(ctx context.Context, project *model.Project) error
	UpdateFields(ctx context.Context, projectID string, updates map[string]interface{}) error
	UpdateContainerInfo(ctx context.Context, projectID string, containerID, containerName, containerImage string, containerPort int, containerStatus string) error
	UpdateContainerStatus(ctx context.Context, projectID string, containerStatus string) error
	UpdateFileTree(ctx context.Context, projectID string, fileTree string) error
	UpdateDirectoryPath(ctx context.Context, projectID string, directoryPath string) error
	UpdatePlanData(ctx context.Context, projectID, planID, planData string) error
	SoftDelete(ctx context.Context, projectID string) error
	RestoreDeleted(ctx context.Context, projectID string) error
	RestoreDeletedByOwner(ctx context.Context, projectID, userID string) (*model.Project, error)
	HardDelete(ctx context.Context, projectID string) error
}

// ChatMessageRepo 聊天消息仓储接口
type ChatMessageRepo interface {
	Create(ctx context.Context, msg *model.ChatMessage) error
	ListByProjectID(ctx context.Context, projectID string) ([]model.ChatMessage, error)
	DeleteByProjectID(ctx context.Context, projectID string) error
}

// EngineeringStateRepo 项目级工程状态仓储接口。
type EngineeringStateRepo interface {
	UpsertSnapshot(ctx context.Context, state *model.ProjectEngineeringState) error
	FindByProjectID(ctx context.Context, projectID string) (*model.ProjectEngineeringState, error)
	DeleteByProjectID(ctx context.Context, projectID string) error
}

// CapabilityExecutionAuditRepo 项目级能力执行审计仓储接口。
type CapabilityExecutionAuditRepo interface {
	ListByProjectID(ctx context.Context, projectID, status, capabilityProfile string, offset, limit int) ([]model.ProjectCapabilityExecutionAudit, int64, error)
	DeleteByProjectID(ctx context.Context, projectID string) error
}

// ProjectResourceAlertEventRepo 项目资源告警事件仓储接口。
type ProjectResourceAlertEventRepo interface {
	Create(ctx context.Context, event *model.ProjectResourceAlertEvent) error
	ListByProjectID(ctx context.Context, projectID, status string, offset, limit int) ([]model.ProjectResourceAlertEvent, int64, error)
	DeleteByProjectID(ctx context.Context, projectID string) error
}

// GeneratedFileRepo 生成文件仓储接口
type GeneratedFileRepo interface {
	Create(ctx context.Context, file *model.ProjectFile) error
	BatchCreate(ctx context.Context, files []model.ProjectFile) error
	FindByProjectID(ctx context.Context, projectID string) ([]model.ProjectFile, error)
	FindByPath(ctx context.Context, projectID, path string) (*model.ProjectFile, error)
	Update(ctx context.Context, file *model.ProjectFile) error
	DeleteByProjectID(ctx context.Context, projectID string) error
}

// CommitRepo 提交记录仓储接口
type CommitRepo interface {
	Create(ctx context.Context, commit *model.Commit) error
	DeleteByProjectID(ctx context.Context, projectID string) error
}

// GitHubIntegrationRepo stores encrypted OAuth connections and durable sync state.
type GitHubIntegrationRepo interface {
	UpsertConnection(ctx context.Context, connection *model.GitHubConnection) error
	FindConnectionByUserID(ctx context.Context, userID string) (*model.GitHubConnection, error)
	DeleteConnectionByUserID(ctx context.Context, userID string) error
	CreateOAuthState(ctx context.Context, state *model.GitHubOAuthState) error
	ConsumeOAuthState(ctx context.Context, stateHash string, now time.Time) (*model.GitHubOAuthState, error)
	UpsertBinding(ctx context.Context, binding *model.GitHubProjectBinding) error
	FindBindingByProjectID(ctx context.Context, projectID string) (*model.GitHubProjectBinding, error)
	ListBindingsByRepository(ctx context.Context, repositoryName string) ([]model.GitHubProjectBinding, error)
	CreateSyncOperation(ctx context.Context, operation *model.GitHubSyncOperation) (bool, error)
	FindSyncOperation(ctx context.Context, userID, idempotencyKey string) (*model.GitHubSyncOperation, error)
	UpdateSyncOperation(ctx context.Context, operation *model.GitHubSyncOperation) error
	CreateWebhookDelivery(ctx context.Context, delivery *model.GitHubWebhookDelivery) (bool, error)
}

type ProjectDeploymentRepo interface {
	UpsertBinding(ctx context.Context, binding *model.ProjectDeploymentBinding) error
	FindBindingByProjectID(ctx context.Context, projectID string) (*model.ProjectDeploymentBinding, error)
	CreateRelease(ctx context.Context, release *model.ProjectDeploymentRelease) error
	UpdateRelease(ctx context.Context, release *model.ProjectDeploymentRelease) error
	FindReleaseByID(ctx context.Context, releaseID string) (*model.ProjectDeploymentRelease, error)
	ListReleases(ctx context.Context, projectID string, limit int) ([]model.ProjectDeploymentRelease, error)
	FindLatestReadyProductionRelease(ctx context.Context, projectID string) (*model.ProjectDeploymentRelease, error)
	UpsertDomain(ctx context.Context, domain *model.ProjectDeploymentDomain) error
	FindDomain(ctx context.Context, projectID, domain string) (*model.ProjectDeploymentDomain, error)
	ListDomains(ctx context.Context, projectID string) ([]model.ProjectDeploymentDomain, error)
	DeleteDomain(ctx context.Context, projectID, domain string) error
	CreateOperation(ctx context.Context, operation *model.ProjectDeploymentOperation) (bool, error)
	FindOperation(ctx context.Context, userID, idempotencyKey string) (*model.ProjectDeploymentOperation, error)
	UpdateOperation(ctx context.Context, operation *model.ProjectDeploymentOperation) error
}

type ProjectCollaborationRepo interface {
	FindMember(ctx context.Context, projectID, userID string) (*model.ProjectMember, error)
	ListMembers(ctx context.Context, projectID string) ([]model.ProjectMember, error)
	ListMembershipsByUserID(ctx context.Context, userID string) ([]model.ProjectMember, error)
	UpsertMemberWithAudit(ctx context.Context, member *model.ProjectMember, audit *model.ProjectCollaborationAudit) error
	DeleteMemberWithAudit(ctx context.Context, projectID, userID string, audit *model.ProjectCollaborationAudit) error
	ListCollaborationAudits(ctx context.Context, projectID string, limit int) ([]model.ProjectCollaborationAudit, error)
	FindCollaborationSession(ctx context.Context, projectID, userID, clientID string) (*model.ProjectCollaborationSession, error)
	UpsertCollaborationSessionWithEvent(ctx context.Context, session *model.ProjectCollaborationSession, event *model.ProjectCollaborationEvent) error
	LeaveCollaborationSessionWithEvent(ctx context.Context, projectID, userID, clientID string, leftAt time.Time, event *model.ProjectCollaborationEvent) error
	ExpireCollaborationSessions(ctx context.Context, projectID string, expiredAt time.Time) error
	ListActiveCollaborationSessions(ctx context.Context, projectID string, activeAfter time.Time) ([]model.ProjectCollaborationSession, error)
	AppendCollaborationEvent(ctx context.Context, event *model.ProjectCollaborationEvent) error
	ListCollaborationEvents(ctx context.Context, projectID string, afterSequence int64, limit int) ([]model.ProjectCollaborationEvent, error)
	UpsertOfficialTemplate(ctx context.Context, template *model.OfficialProjectTemplate) error
	FindOfficialTemplateBySlug(ctx context.Context, slug string) (*model.OfficialProjectTemplate, error)
	FindOfficialTemplateByID(ctx context.Context, id string) (*model.OfficialProjectTemplate, error)
	ListOfficialTemplates(ctx context.Context) ([]model.OfficialProjectTemplate, error)
	FindOfficialTemplateVersion(ctx context.Context, id string) (*model.OfficialProjectTemplateVersion, error)
	ListOfficialTemplateVersions(ctx context.Context, templateID string) ([]model.OfficialProjectTemplateVersion, error)
	PublishOfficialTemplateVersion(ctx context.Context, template *model.OfficialProjectTemplate, version *model.OfficialProjectTemplateVersion, audit *model.OfficialProjectTemplateAudit) error
	RollbackOfficialTemplateWithAudit(ctx context.Context, templateID, expectedCurrentID, targetID string, audit *model.OfficialProjectTemplateAudit) error
}

// UserRepo 用户仓储接口
type UserRepo interface {
	Create(ctx context.Context, user *model.User) error
	FindByID(ctx context.Context, id string) (*model.User, error)
	FindByEmail(ctx context.Context, email string) (*model.User, error)
	FindByUsername(ctx context.Context, username string) (*model.User, error)
	Update(ctx context.Context, user *model.User) error
	UpdateLLMConfig(ctx context.Context, userID string, llmModel, temperature string, maxTokens int) error
	List(ctx context.Context, offset, limit int) ([]model.User, int64, error)
}

// SystemConfigRepo 系统配置仓储接口
type SystemConfigRepo interface {
	Get(ctx context.Context, key string) (*model.SystemConfig, error)
	Set(ctx context.Context, key, value string) error
	List(ctx context.Context) ([]model.SystemConfig, error)
	InitDefaults(ctx context.Context) error
}

// AdminRepo 管理员仓储接口（独立 admins 表）
type AdminRepo interface {
	FindByEmail(ctx context.Context, email string) (*model.Admin, error)
	FindByID(ctx context.Context, id string) (*model.Admin, error)
	Create(ctx context.Context, admin *model.Admin) error
	Update(ctx context.Context, admin *model.Admin) error
	UpdateLastLogin(ctx context.Context, id string) error
	List(ctx context.Context, page, pageSize int) ([]model.Admin, int64, error)
	Delete(ctx context.Context, id string) error
	ListRoles(ctx context.Context) ([]model.AdminRole, error)
	FindRoleByID(ctx context.Context, id string) (*model.AdminRole, error)
	CreateRole(ctx context.Context, role *model.AdminRole) error
	UpdateRole(ctx context.Context, role *model.AdminRole) error
	DeleteRole(ctx context.Context, id string) error
	ListPermissions(ctx context.Context) ([]model.AdminPermission, error)
	GetRolePermissions(ctx context.Context, roleID string) ([]model.AdminPermission, error)
	ReplaceRolePermissions(ctx context.Context, roleID string, permissionIDs []string) error
	GetAdminRoles(ctx context.Context, adminID string) ([]model.AdminRole, error)
	ReplaceAdminRoles(ctx context.Context, adminID string, roleIDs []string) error
	GetAdminPermissionCodes(ctx context.Context, adminID string) ([]string, error)
	CountEnterpriseOrganizations(ctx context.Context) (int64, error)
	CountEnterpriseTeams(ctx context.Context) (int64, error)
	CountEnterpriseMembers(ctx context.Context) (int64, error)
	CountEnterpriseProjectOwnerships(ctx context.Context) (int64, error)
	CountEnterpriseProjectAccessGuardActivationAudits(ctx context.Context) (int64, error)
	CountEnterpriseAuditExportTasks(ctx context.Context) (int64, error)
	FindEnterpriseAuditExportTaskByID(ctx context.Context, taskID string) (*model.EnterpriseAuditExportTask, error)
	FindEnterpriseAuditExportTaskByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportTask, error)
	ListEnterpriseAuditExportTasks(ctx context.Context, limit int) ([]model.EnterpriseAuditExportTask, error)
	CountEnterpriseAuditExportDeliveryReports(ctx context.Context) (int64, error)
	ListEnterpriseAuditExportDeliveryReports(ctx context.Context, limit int) ([]model.EnterpriseAuditExportDeliveryReport, error)
	CountEnterpriseAuditExportWorkerExecutionRequests(ctx context.Context) (int64, error)
	CountEnterpriseAuditExportWorkerExecutionRequestsByStatus(ctx context.Context, status string) (int64, error)
	FindEnterpriseAuditExportWorkerExecutionRequestByID(ctx context.Context, requestID string) (*model.EnterpriseAuditExportWorkerExecutionRequest, error)
	FindEnterpriseAuditExportWorkerExecutionRequestByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportWorkerExecutionRequest, error)
	CreateEnterpriseAuditExportWorkerExecutionRequest(ctx context.Context, request *model.EnterpriseAuditExportWorkerExecutionRequest) error
	UpdateEnterpriseAuditExportWorkerExecutionRequestExecutionResult(ctx context.Context, request *model.EnterpriseAuditExportWorkerExecutionRequest) error
	FindEnterpriseAuditExportDeliveryReportByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportDeliveryReport, error)
	CreateEnterpriseAuditExportDeliveryReport(ctx context.Context, report *model.EnterpriseAuditExportDeliveryReport) error
	ListEnterpriseProjectAccessGuardActivationAudits(ctx context.Context, limit int) ([]model.EnterpriseProjectAccessGuardActivationAudit, error)
	CreateEnterpriseProjectAccessGuardActivationAudit(ctx context.Context, audit *model.EnterpriseProjectAccessGuardActivationAudit) error
	ListEnterpriseOrganizations(ctx context.Context) ([]model.EnterpriseOrganization, error)
	FindEnterpriseOrganizationByID(ctx context.Context, id string) (*model.EnterpriseOrganization, error)
	ListEnterpriseTeams(ctx context.Context) ([]model.EnterpriseTeam, error)
	FindEnterpriseTeamByID(ctx context.Context, id string) (*model.EnterpriseTeam, error)
	FindEnterpriseMembersByUserAndOrganizationID(ctx context.Context, userID, organizationID string) ([]model.EnterpriseMember, error)
	ListEnterpriseProjectOwnerships(ctx context.Context) ([]model.EnterpriseProjectOwnership, error)
	FindEnterpriseProjectOwnershipByProjectID(ctx context.Context, projectID string) (*model.EnterpriseProjectOwnership, error)
	CreateEnterpriseOrganization(ctx context.Context, organization *model.EnterpriseOrganization) error
	CreateEnterpriseTeam(ctx context.Context, team *model.EnterpriseTeam) error
	CreateEnterpriseMember(ctx context.Context, member *model.EnterpriseMember) error
	CreateEnterpriseProjectOwnership(ctx context.Context, ownership *model.EnterpriseProjectOwnership) error
	CreateEnterpriseAuditExportTask(ctx context.Context, task *model.EnterpriseAuditExportTask) error
	UpdateEnterpriseAuditExportTaskStatus(ctx context.Context, task *model.EnterpriseAuditExportTask) error
}

// LLMProviderRepo LLM 提供商仓储接口
type LLMProviderRepo interface {
	Create(ctx context.Context, provider *model.LLMProvider) error
	CreateModel(ctx context.Context, providerModel *model.LLMProviderModel) error
	FindByID(ctx context.Context, id int64) (*model.LLMProvider, error)
	FindByName(ctx context.Context, name string) (*model.LLMProvider, error)
	ListAll(ctx context.Context) ([]model.LLMProvider, error)
	ListEnabled(ctx context.Context) ([]model.LLMProvider, error)
	ListModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error)
	ListEnabledModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error)
	GetDefault(ctx context.Context) (*model.LLMProvider, error)
	Update(ctx context.Context, provider *model.LLMProvider) error
	UpsertModel(ctx context.Context, providerModel *model.LLMProviderModel) error
	ReplaceProviderModels(ctx context.Context, providerID int64, models []model.LLMProviderModel) error
	Delete(ctx context.Context, id int64) error
	DeleteModel(ctx context.Context, providerID int64, modelID string) error
	SetDefault(ctx context.Context, id int64) error
	SetDefaultModel(ctx context.Context, providerID int64, modelID string) error
	IncrementUseCount(ctx context.Context, id int64) error
	ListDBProviders(ctx context.Context) ([]llm.DBProviderRecord, error)
	ListAllSafe(ctx context.Context) ([]model.LLMProvider, error)
	InitDefaults(ctx context.Context) error
}

// AdminAuditLogRepo 管理员审计日志仓储接口
type AdminAuditLogRepo interface {
	Create(ctx context.Context, log *model.AdminAuditLog) error
	List(ctx context.Context, offset, limit int) ([]model.AdminAuditLog, error)
	Count(ctx context.Context) (int64, error)
}
