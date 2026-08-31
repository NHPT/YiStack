package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/container"
	"yistack/pkg/file"
)

// ProjectService 项目服务
type ProjectService struct {
	projectRepo            ProjectRepo
	ownershipRepo          ProjectAccessEnterpriseOwnershipRepo
	collaborationRepo      ProjectCollaborationRepo
	fileRepo               GeneratedFileRepo
	commitRepo             CommitRepo
	chatRepo               ChatMessageRepo
	engineeringStateRepo   EngineeringStateRepo
	generationJobRepo      GenerationJobRepo
	capabilityAuditRepo    CapabilityExecutionAuditRepo
	resourceAlertEventRepo ProjectResourceAlertEventRepo
	systemConfigSvc        *SystemConfigService
	containerMgr           *container.Manager
	terminalMgr            *projectTerminalSessionManager
	fileSvc                *file.Service
	containerCfg           *config.ContainerConfig
	projectCfg             *config.ProjectConfig
	projectSecretCfg       *config.ProjectSecretConfig
	backupRemoteHTTPClient projectBackupRemoteHTTPClient
	notificationHTTPClient projectResourceAlertNotificationHTTPClient
	deleteTasks            sync.Map
	deleteRestoreWindows   sync.Map
	deleteRestoreRequests  sync.Map
	projectCreateLocks     sync.Map
}

const projectCreateIdempotencyWindow = 2 * time.Minute

type projectBackupRemoteHTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type projectResourceAlertNotificationHTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// ProjectServiceOptions 项目服务依赖项。
type ProjectServiceOptions struct {
	ProjectRepo            ProjectRepo
	OwnershipRepo          ProjectAccessEnterpriseOwnershipRepo
	CollaborationRepo      ProjectCollaborationRepo
	FileRepo               GeneratedFileRepo
	CommitRepo             CommitRepo
	ChatRepo               ChatMessageRepo
	EngineeringStateRepo   EngineeringStateRepo
	GenerationJobRepo      GenerationJobRepo
	CapabilityAuditRepo    CapabilityExecutionAuditRepo
	ResourceAlertEventRepo ProjectResourceAlertEventRepo
	SystemConfigSvc        *SystemConfigService
	ContainerMgr           *container.Manager
	FileService            *file.Service
	ContainerCfg           *config.ContainerConfig
	ProjectCfg             *config.ProjectConfig
	ProjectSecretCfg       *config.ProjectSecretConfig
	BackupRemoteHTTPClient projectBackupRemoteHTTPClient
	NotificationHTTPClient projectResourceAlertNotificationHTTPClient
}

// NewProjectService 创建项目服务。
// 必需依赖通过 options 显式注入，可选能力通过 nil 表示未启用，避免继续膨胀多套构造器。
func NewProjectService(options ProjectServiceOptions) *ProjectService {
	configureProjectRootDir(options.ContainerCfg)
	return &ProjectService{
		projectRepo:            options.ProjectRepo,
		ownershipRepo:          options.OwnershipRepo,
		collaborationRepo:      options.CollaborationRepo,
		fileRepo:               options.FileRepo,
		commitRepo:             options.CommitRepo,
		chatRepo:               options.ChatRepo,
		engineeringStateRepo:   options.EngineeringStateRepo,
		generationJobRepo:      options.GenerationJobRepo,
		capabilityAuditRepo:    options.CapabilityAuditRepo,
		resourceAlertEventRepo: options.ResourceAlertEventRepo,
		systemConfigSvc:        options.SystemConfigSvc,
		containerMgr:           options.ContainerMgr,
		terminalMgr:            newProjectTerminalSessionManager(),
		fileSvc:                options.FileService,
		containerCfg:           options.ContainerCfg,
		projectCfg:             options.ProjectCfg,
		projectSecretCfg:       options.ProjectSecretCfg,
		backupRemoteHTTPClient: options.BackupRemoteHTTPClient,
		notificationHTTPClient: options.NotificationHTTPClient,
	}
}

// ProjectDeletionCleanupScope 返回项目删除后台清理承诺覆盖的资源范围。
func ProjectDeletionCleanupScope() []string {
	return []string{
		"container",
		"project_network",
		"project_directory",
		"chat_messages",
		"generated_file_metadata",
		"git_commits",
		"engineering_state",
		"capability_execution_audits",
		"resource_alert_events",
	}
}

// ProjectDeletionRestoreWindow 返回用户主动恢复软删项目的短窗口。
// 后台资源清理会先等待该窗口，窗口结束后恢复入口关闭并进入不可逆清理。
func ProjectDeletionRestoreWindow() time.Duration {
	return 30 * time.Second
}

// CreateProjectRequest 创建项目请求
type CreateProjectRequest struct {
	UserID      string `json:"user_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	AppType     string `json:"app_type"`
	TechStack   string `json:"tech_stack"`
	PlanID      string `json:"plan_id"`
	PlanData    string `json:"plan_data"`
}

// CreateProject 创建真实项目记录，并初始化用于容器挂载的宿主机目录。
func (s *ProjectService) CreateProject(ctx context.Context, req *CreateProjectRequest) (*model.Project, error) {
	project := s.buildProjectModel(req)
	createLock := s.getProjectCreateLock(project)
	if createLock != nil {
		createLock.Lock()
		defer createLock.Unlock()
	}

	if existingProject := s.findRecentEquivalentProject(ctx, project); existingProject != nil {
		return existingProject, nil
	}

	if err := s.projectRepo.Create(ctx, project); err != nil {
		return nil, err
	}

	s.initializeProjectWorkspace(project)
	return s.reloadProjectAfterCreate(ctx, project), nil
}

func (s *ProjectService) getProjectCreateLock(project *model.Project) *sync.Mutex {
	if s == nil || project == nil {
		return nil
	}
	fingerprint := getProjectCreateFingerprint(project)
	if fingerprint == "" {
		return nil
	}
	value, _ := s.projectCreateLocks.LoadOrStore(fingerprint, &sync.Mutex{})
	lock, ok := value.(*sync.Mutex)
	if !ok {
		return nil
	}
	return lock
}

func getProjectCreateFingerprint(project *model.Project) string {
	if project == nil {
		return ""
	}
	userID := strings.TrimSpace(project.UserID)
	name := strings.TrimSpace(project.Name)
	description := strings.TrimSpace(project.Description)
	appType := strings.TrimSpace(project.AppType)
	if userID == "" || name == "" || description == "" || appType == "" {
		return ""
	}
	return strings.Join([]string{userID, name, description, appType}, "\x1f")
}

func (s *ProjectService) findRecentEquivalentProject(ctx context.Context, target *model.Project) *model.Project {
	if s == nil || s.projectRepo == nil || target == nil {
		return nil
	}
	if strings.TrimSpace(target.UserID) == "" {
		return nil
	}

	projects, _, err := s.projectRepo.ListByUserID(ctx, target.UserID, 1, 20)
	if err != nil {
		return nil
	}

	now := time.Now()
	for i := range projects {
		project := &projects[i]
		if isRecentEquivalentProject(project, target, now) {
			return project
		}
	}

	return nil
}

func isRecentEquivalentProject(project, target *model.Project, now time.Time) bool {
	if project == nil || target == nil {
		return false
	}

	if project.CreatedAt.IsZero() {
		return false
	}
	if now.Sub(project.CreatedAt) > projectCreateIdempotencyWindow {
		return false
	}

	return strings.TrimSpace(project.UserID) == strings.TrimSpace(target.UserID) &&
		strings.TrimSpace(project.Name) == strings.TrimSpace(target.Name) &&
		strings.TrimSpace(project.Description) == strings.TrimSpace(target.Description) &&
		strings.TrimSpace(project.AppType) == strings.TrimSpace(target.AppType)
}

// GetProject 获取项目
func (s *ProjectService) GetProject(ctx context.Context, projectID string) (*model.Project, error) {
	return s.projectRepo.FindByProjectID(ctx, projectID)
}

// ListUserProjects 列出用户项目
func (s *ProjectService) ListUserProjects(ctx context.Context, userID string, page, pageSize int) ([]model.Project, int64, error) {
	projects := make([]model.Project, 0)
	for ownerPage := 1; ; ownerPage++ {
		batch, ownerTotal, err := s.projectRepo.ListByUserID(ctx, userID, ownerPage, 100)
		if err != nil {
			return nil, 0, err
		}
		projects = append(projects, batch...)
		if len(batch) == 0 || int64(len(projects)) >= ownerTotal {
			break
		}
	}
	seen := make(map[string]struct{}, len(projects))
	for i := range projects {
		seen[projects[i].ProjectID] = struct{}{}
	}
	if s.collaborationRepo != nil {
		memberships, membershipErr := s.collaborationRepo.ListMembershipsByUserID(ctx, userID)
		if membershipErr != nil {
			return nil, 0, membershipErr
		}
		for _, membership := range memberships {
			if _, exists := seen[membership.ProjectID]; exists {
				continue
			}
			project, projectErr := s.projectRepo.FindByProjectID(ctx, membership.ProjectID)
			if projectErr != nil || project == nil {
				continue
			}
			projects = append(projects, *project)
			seen[membership.ProjectID] = struct{}{}
		}
	}
	sort.Slice(projects, func(i, j int) bool { return projects[i].UpdatedAt.After(projects[j].UpdatedAt) })
	total := int64(len(projects))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	if start >= len(projects) {
		return []model.Project{}, total, nil
	}
	end := start + pageSize
	if end > len(projects) {
		end = len(projects)
	}
	return projects[start:end], total, nil

}

// UpdateProjectFileTree 更新项目文件树缓存
func (s *ProjectService) UpdateProjectFileTree(ctx context.Context, projectID, fileTree string) error {
	return s.projectRepo.UpdateFileTree(ctx, projectID, fileTree)
}

// DeleteProject 删除项目记录
func (s *ProjectService) DeleteProject(ctx context.Context, projectID string) error {
	return s.projectRepo.HardDelete(ctx, projectID)
}

// DeleteProjectAsync 立即删除项目数据库记录，并在后台清理容器、目录与附属元数据。
func (s *ProjectService) DeleteProjectAsync(ctx context.Context, projectID string) error {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	if _, exists := s.deleteTasks.LoadOrStore(projectID, struct{}{}); exists {
		log.Printf("Project %s deletion already in progress", projectID)
		return nil
	}

	if err := s.projectRepo.SoftDelete(ctx, projectID); err != nil {
		s.deleteTasks.Delete(projectID)
		return fmt.Errorf("failed to mark project deleting: %w", err)
	}

	s.deleteRestoreWindows.Store(projectID, time.Now().Add(ProjectDeletionRestoreWindow()))
	projectSnapshot := *project
	go s.cleanupDeletedProject(context.Background(), &projectSnapshot)
	return nil
}

func (s *ProjectService) RestoreDeletedProject(ctx context.Context, projectID, userID string) (*model.Project, error) {
	if s == nil || s.projectRepo == nil {
		return nil, fmt.Errorf("project repository not available")
	}
	projectID = strings.TrimSpace(projectID)
	userID = strings.TrimSpace(userID)
	if projectID == "" || userID == "" {
		return nil, fmt.Errorf("project_id and user_id are required")
	}
	if _, ok := s.deleteRestoreWindows.Load(projectID); !ok {
		return nil, fmt.Errorf("project restore window expired or cleanup already started")
	}

	s.deleteRestoreRequests.Store(projectID, struct{}{})
	project, err := s.projectRepo.RestoreDeletedByOwner(ctx, projectID, userID)
	if err != nil {
		s.deleteRestoreRequests.Delete(projectID)
		return nil, err
	}
	return project, nil
}

func (s *ProjectService) syncContainerState(ctx context.Context, project *model.Project) {
	if s == nil || s.containerMgr == nil || s.projectRepo == nil || project == nil || project.ProjectID == "" {
		return
	}

	syncCtx, cancel := context.WithTimeout(safeContext(ctx), 8*time.Second)
	defer cancel()

	info, exists, err := s.containerMgr.SyncProject(syncCtx, project.ProjectID)
	if err != nil {
		log.Printf("Warning: failed to sync container state for project %s: %v", project.ProjectID, err)
		return
	}

	s.applyContainerState(ctx, project, info, exists)
}

func (s *ProjectService) applyContainerState(ctx context.Context, project *model.Project, info *container.ContainerInfo, exists bool) {
	if !exists || info == nil {
		if project.ContainerID == "" && project.ContainerName == "" && project.ContainerStatus == "" {
			return
		}
		project.ContainerID = ""
		project.ContainerName = ""
		project.ContainerImage = ""
		project.ContainerPort = 0
		project.ContainerStatus = "missing"
		if err := s.projectRepo.UpdateContainerInfo(ctx, project.ProjectID, "", "", "", 0, "missing"); err != nil {
			log.Printf("Warning: failed to clear missing container info for project %s: %v", project.ProjectID, err)
		}
		return
	}

	status := string(info.Status)
	if status == string(container.ContainerStatusStopping) {
		status = string(container.ContainerStatusStopped)
	}
	if project.ContainerID == info.ContainerID &&
		project.ContainerName == info.Name &&
		project.ContainerImage == info.Image &&
		project.ContainerPort == info.Port &&
		project.ContainerStatus == status {
		return
	}

	project.ContainerID = info.ContainerID
	project.ContainerName = info.Name
	project.ContainerImage = info.Image
	project.ContainerPort = info.Port
	project.ContainerStatus = status
	if err := s.projectRepo.UpdateContainerInfo(ctx, project.ProjectID, info.ContainerID, info.Name, info.Image, info.Port, status); err != nil {
		log.Printf("Warning: failed to persist synced container state for project %s: %v", project.ProjectID, err)
	}
}

func applyContainerStateInMemory(project *model.Project, info *container.ContainerInfo, exists bool) {
	if project == nil {
		return
	}
	if !exists || info == nil {
		project.ContainerID = ""
		project.ContainerName = ""
		project.ContainerImage = ""
		project.ContainerPort = 0
		project.ContainerStatus = "missing"
		return
	}

	status := string(info.Status)
	if status == string(container.ContainerStatusStopping) {
		status = string(container.ContainerStatusStopped)
	}

	project.ContainerID = info.ContainerID
	project.ContainerName = info.Name
	project.ContainerImage = info.Image
	project.ContainerPort = info.Port
	project.ContainerStatus = status
}

func (s *ProjectService) cleanupDeletedProject(ctx context.Context, project *model.Project) {
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return
	}

	projectID := project.ProjectID
	defer func() {
		s.deleteTasks.Delete(projectID)
		s.deleteRestoreWindows.Delete(projectID)
		s.deleteRestoreRequests.Delete(projectID)
	}()

	if s.waitProjectDeletionRestoreWindow(ctx, projectID) {
		log.Printf("Project %s deletion cleanup cancelled by user restore request", projectID)
		return
	}

	var cleanupErr error
	for attempt := 1; attempt <= 3; attempt++ {
		attemptCtx, cancel := context.WithTimeout(safeContext(ctx), 90*time.Second)
		cleanupErr = s.cleanupProjectResources(attemptCtx, project)
		cancel()
		if cleanupErr == nil {
			break
		}
		log.Printf("Project %s async cleanup attempt %d failed: %v", projectID, attempt, cleanupErr)
		if attempt < 3 {
			time.Sleep(time.Duration(attempt) * time.Second)
		}
	}
	if cleanupErr != nil {
		log.Printf("Project %s cleanup failed after soft delete: %v", projectID, cleanupErr)
		if restoreErr := s.restoreSoftDeletedProject(context.Background(), projectID); restoreErr != nil {
			log.Printf("Warning: failed to restore project %s after cleanup failure: %v", projectID, restoreErr)
			return
		}
		s.recordProjectDeletionRecoveryNotice(context.Background(), project, "cleanup_failed", cleanupErr)
		return
	}

	if err := s.projectRepo.HardDelete(ctx, projectID); err != nil {
		log.Printf("Project %s hard delete failed after cleanup: %v", projectID, err)
		if restoreErr := s.restoreSoftDeletedProject(context.Background(), projectID); restoreErr != nil {
			log.Printf("Warning: failed to restore project %s after hard delete failure: %v", projectID, restoreErr)
			return
		}
		s.recordProjectDeletionRecoveryNotice(context.Background(), project, "hard_delete_failed", err)
		return
	}

	log.Printf("Project %s async cleanup finished", projectID)
}

func (s *ProjectService) waitProjectDeletionRestoreWindow(ctx context.Context, projectID string) bool {
	restoreWindow := ProjectDeletionRestoreWindow()
	if restoreWindow <= 0 {
		s.deleteRestoreWindows.Delete(projectID)
		return false
	}

	timer := time.NewTimer(restoreWindow)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
	}

	s.deleteRestoreWindows.Delete(projectID)
	_, restored := s.deleteRestoreRequests.Load(projectID)
	return restored
}

func (s *ProjectService) recordProjectDeletionRecoveryNotice(ctx context.Context, project *model.Project, reasonCode string, cause error) {
	if s == nil || s.chatRepo == nil || project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return
	}

	causeMessage := "后台清理失败"
	if cause != nil {
		causeMessage = cause.Error()
	}
	content := fmt.Sprintf("项目删除后台清理失败，系统已恢复项目：%s。容器、项目网络、项目目录、历史消息、工程状态、能力审计、生成文件元数据或 Git 提交记录可能仍存在未清理状态；请稍后重试删除，或联系管理员检查后台清理日志。", causeMessage)
	payload := map[string]interface{}{
		"kind":          "workflow",
		"content":       content,
		"statusContent": "Project deletion recovery: failed",
		"workflowSteps": []map[string]interface{}{
			{
				"id":     "project-deletion:recovery",
				"kind":   "project_deletion_recovery",
				"title":  "项目删除后台清理失败，已恢复项目",
				"detail": "删除请求已受理并执行软删，但后台资源清理或最终硬删除失败；系统已恢复项目，避免项目记录与关联资源状态继续漂移。",
				"status": "failed",
			},
		},
		"engineeringState": map[string]interface{}{
			"phase": map[string]interface{}{
				"current_phase": "项目删除恢复",
				"current_task":  "后台资源清理失败后恢复项目",
				"status":        "failed",
				"next_action":   "稍后重试删除，或联系管理员检查后台清理日志",
			},
			"recovery": map[string]interface{}{
				"reason_code":    reasonCode,
				"reason_message": causeMessage,
				"retry_label":    "重新删除项目",
			},
			"deletion_recovery": map[string]interface{}{
				"status":         "restored_after_cleanup_failure",
				"reason_code":    reasonCode,
				"reason_message": causeMessage,
				"cleanup_scope":  ProjectDeletionCleanupScope(),
			},
		},
	}
	rawContent, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Warning: failed to encode project deletion recovery notice for project %s: %v", project.ProjectID, err)
		return
	}
	if err := s.chatRepo.Create(ctx, &model.ChatMessage{
		ProjectID: project.ProjectID,
		UserID:    project.UserID,
		Role:      "assistant",
		Content:   string(rawContent),
		Model:     "system",
	}); err != nil {
		log.Printf("Warning: failed to record project deletion recovery notice for project %s: %v", project.ProjectID, err)
	}
}

func (s *ProjectService) cleanupProjectResources(ctx context.Context, project *model.Project) error {
	projectID := project.ProjectID
	var cleanupErrors []string

	if s.chatRepo != nil {
		if err := s.chatRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if !isIgnorableProjectDeleteError(err) {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete project chat messages: %v", err))
			} else {
				log.Printf("Warning: skip deleting chat messages for project %s: %v", projectID, err)
			}
		}
	}

	if s.fileSvc != nil {
		s.fileSvc.RemoveManager(projectID)
	}

	if s.containerMgr != nil {
		if err := s.containerMgr.RemoveContainer(ctx, projectID); err != nil {
			if isIgnorableProjectDeleteResourceError(err) {
				log.Printf("Warning: skip removing container for project %s: %v", projectID, err)
			} else {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("remove project container: %v", err))
			}
		} else {
			log.Printf("Container cleaned up for project %s", projectID)
		}
	}

	if project.DirectoryPath != "" {
		if err := s.removeProjectDirectory(project.ProjectID, project.DirectoryPath); err != nil {
			if isIgnorableProjectDeleteResourceError(err) {
				log.Printf("Warning: skip removing project directory for project %s: %v", projectID, err)
			} else {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("remove project directory: %v", err))
			}
		} else {
			log.Printf("Project directory removed: %s", project.DirectoryPath)
		}
	}

	if s.fileRepo != nil {
		if err := s.fileRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if !isIgnorableProjectDeleteError(err) {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete generated file metadata: %v", err))
			} else {
				log.Printf("Warning: skip deleting generated file metadata for project %s: %v", projectID, err)
			}
		}
	}

	if s.commitRepo != nil {
		if err := s.commitRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if !isIgnorableProjectDeleteError(err) {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete commit records: %v", err))
			} else {
				log.Printf("Warning: skip deleting commit records for project %s: %v", projectID, err)
			}
		}
	}

	if s.engineeringStateRepo != nil {
		if err := s.engineeringStateRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if !isIgnorableProjectDeleteError(err) {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete engineering state: %v", err))
			} else {
				log.Printf("Warning: skip deleting engineering state for project %s: %v", projectID, err)
			}
		}
	}

	if s.capabilityAuditRepo != nil {
		if err := s.capabilityAuditRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if !isIgnorableProjectDeleteError(err) {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete capability execution audits: %v", err))
			} else {
				log.Printf("Warning: skip deleting capability execution audits for project %s: %v", projectID, err)
			}
		}
	}

	if s.resourceAlertEventRepo != nil {
		if err := s.resourceAlertEventRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if !isIgnorableProjectDeleteError(err) {
				cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete resource alert events: %v", err))
			} else {
				log.Printf("Warning: skip deleting resource alert events for project %s: %v", projectID, err)
			}
		}
	}

	if len(cleanupErrors) > 0 {
		return fmt.Errorf(strings.Join(cleanupErrors, " | "))
	}

	return nil
}

func (s *ProjectService) removeProjectDirectory(projectID, projectDir string) error {
	projectDir = strings.TrimSpace(projectDir)
	if projectDir == "" {
		return nil
	}
	safeProjectDir, err := secureProjectHostDirectory(currentProjectRootDir(), projectID, projectDir)
	if err != nil {
		return err
	}
	return os.RemoveAll(safeProjectDir)
}

func (s *ProjectService) restoreSoftDeletedProject(ctx context.Context, projectID string) error {
	if s == nil || s.projectRepo == nil || strings.TrimSpace(projectID) == "" {
		return nil
	}
	return s.projectRepo.RestoreDeleted(ctx, projectID)
}

func isIgnorableProjectDeleteError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return strings.Contains(message, "pgrst205") ||
		strings.Contains(message, "could not find the table") ||
		strings.Contains(message, "schema cache") ||
		strings.Contains(message, `relation "chat_messages" does not exist`) ||
		strings.Contains(message, `relation "commits" does not exist`) ||
		strings.Contains(message, `relation "project_files" does not exist`) ||
		strings.Contains(message, `relation "project_engineering_states" does not exist`) ||
		strings.Contains(message, `relation "project_capability_execution_audits" does not exist`)
}

func isIgnorableProjectDeleteResourceError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(strings.TrimSpace(err.Error()))
	resourceNotFoundHints := []string{
		"not found",
		"no such file or directory",
		"cannot find the file specified",
	}
	for _, hint := range resourceNotFoundHints {
		if strings.Contains(message, hint) {
			return true
		}
	}

	return false
}

// DeleteProjectFull 完整删除项目资源。
func (s *ProjectService) DeleteProjectFull(ctx context.Context, projectID string) error {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}

	if s.containerMgr != nil {
		if err := s.containerMgr.StopContainer(ctx, projectID); err != nil {
			log.Printf("Warning: failed to stop container for project %s: %v", projectID, err)
		}
		if err := s.containerMgr.RemoveContainer(ctx, projectID); err != nil {
			log.Printf("Warning: failed to remove container for project %s: %v", projectID, err)
		}
		log.Printf("Container cleaned up for project %s", projectID)
	}

	if project.DirectoryPath != "" {
		if err := s.removeProjectDirectory(project.ProjectID, project.DirectoryPath); err != nil {
			log.Printf("Warning: failed to remove project directory %s: %v", project.DirectoryPath, err)
		} else {
			log.Printf("Project directory removed: %s", project.DirectoryPath)
		}
	}

	if s.fileSvc != nil {
		s.fileSvc.RemoveManager(projectID)
	}

	if s.fileRepo != nil {
		if err := s.fileRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if isIgnorableProjectDeleteError(err) {
				log.Printf("Warning: skip deleting generated file metadata for project %s: %v", projectID, err)
			} else {
				log.Printf("Warning: failed to delete generated file metadata for project %s: %v", projectID, err)
			}
		}
	}

	if s.commitRepo != nil {
		if err := s.commitRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if isIgnorableProjectDeleteError(err) {
				log.Printf("Warning: skip deleting commit records for project %s: %v", projectID, err)
			} else {
				log.Printf("Warning: failed to delete commit records for project %s: %v", projectID, err)
			}
		}
	}

	if s.engineeringStateRepo != nil {
		if err := s.engineeringStateRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if isIgnorableProjectDeleteError(err) {
				log.Printf("Warning: skip deleting engineering state for project %s: %v", projectID, err)
			} else {
				log.Printf("Warning: failed to delete engineering state for project %s: %v", projectID, err)
			}
		}
	}

	if s.capabilityAuditRepo != nil {
		if err := s.capabilityAuditRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if isIgnorableProjectDeleteError(err) {
				log.Printf("Warning: skip deleting capability execution audits for project %s: %v", projectID, err)
			} else {
				log.Printf("Warning: failed to delete capability execution audits for project %s: %v", projectID, err)
			}
		}
	}

	if s.resourceAlertEventRepo != nil {
		if err := s.resourceAlertEventRepo.DeleteByProjectID(ctx, projectID); err != nil {
			if isIgnorableProjectDeleteError(err) {
				log.Printf("Warning: skip deleting resource alert events for project %s: %v", projectID, err)
			} else {
				log.Printf("Warning: failed to delete resource alert events for project %s: %v", projectID, err)
			}
		}
	}

	if err := s.projectRepo.HardDelete(ctx, projectID); err != nil {
		return fmt.Errorf("failed to delete project record: %w", err)
	}
	if _, err := s.projectRepo.FindByProjectID(ctx, projectID); err == nil {
		return fmt.Errorf("project record still exists after deletion")
	}

	log.Printf("Project %s fully deleted", projectID)
	return nil
}

// UpdateProject 更新项目元数据。
// 方案和技术栈只更新数据库；代码、文档、脚手架等文件生成必须在容器启动后进行。
func (s *ProjectService) UpdateProject(ctx context.Context, projectID string, updates map[string]interface{}) error {
	sanitizedUpdates := make(map[string]interface{})

	if name, ok := updates["name"].(string); ok {
		sanitizedUpdates["name"] = name
	}
	if description, ok := updates["description"].(string); ok {
		sanitizedUpdates["description"] = description
	}
	if appType, ok := updates["app_type"].(string); ok {
		sanitizedUpdates["app_type"] = appType
	}
	if visibility, ok := updates["visibility"].(string); ok {
		sanitizedUpdates["visibility"] = visibility
	}
	if techStack, ok := updates["tech_stack"].(string); ok {
		sanitizedUpdates["tech_stack"] = techStack
	}
	if planID, ok := updates["plan_id"].(string); ok {
		sanitizedUpdates["plan_id"] = planID
	}
	if planData, ok := updates["plan_data"].(string); ok {
		sanitizedUpdates["plan_data"] = planData
	}

	if len(sanitizedUpdates) == 0 {
		return nil
	}

	if err := s.projectRepo.UpdateFields(ctx, projectID, sanitizedUpdates); err != nil {
		return err
	}

	return nil
}

// ListProjects 列出所有项目（管理员用）
func (s *ProjectService) ListProjects(ctx context.Context, page, pageSize int) ([]model.Project, int64, error) {
	if s == nil || s.projectRepo == nil {
		return nil, 0, fmt.Errorf("project repository not available")
	}
	page, pageSize = normalizeProjectListPagination(page, pageSize)
	return s.projectRepo.ListAll(ctx, page, pageSize)
}

func normalizeProjectListPagination(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func deriveProjectName(description, appType string) string {
	text := strings.TrimSpace(description)
	if text != "" {
		if idx := strings.IndexAny(text, "\r\n"); idx >= 0 {
			text = text[:idx]
		}
		text = strings.Trim(text, " \t\r\n,.;:!?，。；：！？、'\"`()[]{}<>《》【】")
		runes := []rune(text)
		if len(runes) > 18 {
			text = string(runes[:18])
		}
		if text != "" {
			return text
		}
	}

	switch appType {
	case "mobile":
		return "未命名移动应用"
	case "miniprogram":
		return "未命名小程序"
	case "desktop":
		return "未命名桌面应用"
	default:
		return "未命名网页应用"
	}
}
