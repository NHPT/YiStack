package service

import (
	"context"
	"errors"
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
	deleteRestoreStates    sync.Map
	projectCreateLocks     sync.Map
	lifecycleCoordinator   *ProjectLifecycleCoordinator
}

const projectCreateIdempotencyWindow = 2 * time.Minute

type projectDeleteRestoreState struct {
	mu               sync.Mutex
	restoreUserID    string
	deadline         time.Time
	restoreRequested bool
	restoreUncertain bool
	cleanupStarted   bool
	restoreSignal    chan struct{}
}

type projectBackupRemoteHTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type projectResourceAlertNotificationHTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type projectRestoreConfirmationRepository interface {
	FindByProjectIDIncludingDeletedByOwner(
		ctx context.Context,
		projectID string,
		userID string,
	) (*model.Project, error)
}
type userProjectDeletionRepository interface {
	ListByUserIDIncludingDeleted(ctx context.Context, userID string) ([]model.Project, error)
}
type pendingProjectDeletionRepository interface {
	ListSoftDeleted(ctx context.Context) ([]model.Project, error)
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
	LifecycleCoordinator   *ProjectLifecycleCoordinator
}

// NewProjectService 创建项目服务。
// 必需依赖通过 options 显式注入，可选能力通过 nil 表示未启用，避免继续膨胀多套构造器。
func NewProjectService(options ProjectServiceOptions) *ProjectService {
	configureProjectRootDir(options.ContainerCfg)
	lifecycleCoordinator := options.LifecycleCoordinator
	if lifecycleCoordinator == nil {
		lifecycleCoordinator = NewProjectLifecycleCoordinator()
	}
	service := &ProjectService{
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
		lifecycleCoordinator:   lifecycleCoordinator,
	}
	return service
}

// RecoverPendingUserDeletionStaging reconciles interrupted administrator
// deletions before the application starts accepting project operations.
func (s *ProjectService) RecoverPendingUserDeletionStaging(ctx context.Context) error {
	if s == nil {
		return fmt.Errorf("project service not available")
	}
	backupDir := s.projectBackupConfig(ctx).BackupDir
	localErr := recoverProjectDeletionStaging(
		ctx,
		s.projectRepo,
		currentProjectRootDir(),
		backupDir,
	)
	remoteErr := s.recoverProjectRemoteDeletionStaging(ctx, backupDir)
	if localErr != nil && remoteErr != nil {
		return fmt.Errorf("recover local deletion staging: %v; recover remote deletion staging: %v", localErr, remoteErr)
	}
	if localErr != nil {
		return localErr
	}
	return remoteErr
}

// ResumePendingProjectDeletions rebuilds asynchronous deletion state after a
// process restart. The original soft-delete timestamp preserves the restore
// deadline; expired entries continue cleanup immediately.
func (s *ProjectService) ResumePendingProjectDeletions(ctx context.Context) error {
	if s == nil || s.projectRepo == nil {
		return nil
	}
	repo, ok := s.projectRepo.(pendingProjectDeletionRepository)
	if !ok {
		return fmt.Errorf("project repository does not support pending deletion recovery")
	}
	projects, err := repo.ListSoftDeleted(ctx)
	if err != nil {
		return err
	}
	for i := range projects {
		project := projects[i]
		if project.DeletedAt == nil {
			continue
		}
		projectID := strings.TrimSpace(project.ProjectID)
		if projectID == "" {
			return fmt.Errorf("pending project deletion has an empty project id")
		}
		if _, exists := s.deleteTasks.LoadOrStore(projectID, struct{}{}); exists {
			continue
		}
		cleanupCtx, cancelCleanup := context.WithCancel(context.Background())
		unlockProject, finishDeletion, markCleanupStarted, unregisterCleanup, err :=
			s.lifecycleCoordinator.beginAsyncProjectDeletion(
				safeContext(ctx),
				projectID,
				cancelCleanup,
			)
		if err != nil {
			cancelCleanup()
			s.deleteTasks.Delete(projectID)
			return fmt.Errorf("resume project deletion %s: %w", projectID, err)
		}
		s.deleteRestoreStates.Store(projectID, &projectDeleteRestoreState{
			deadline:      project.DeletedAt.Add(ProjectDeletionRestoreWindow()),
			restoreSignal: make(chan struct{}),
		})
		projectSnapshot := project
		go func() {
			preserveDeletionBarrier := true
			defer func() {
				cancelCleanup()
				unregisterCleanup()
				unlockProject()
				finishDeletion(preserveDeletionBarrier)
			}()
			preserveDeletionBarrier = s.cleanupDeletedProject(
				cleanupCtx,
				&projectSnapshot,
				markCleanupStarted,
			)
		}()
	}
	return nil
}

// ProjectDeletionCleanupScope 返回项目删除后台清理承诺覆盖的资源范围。
func ProjectDeletionCleanupScope() []string {
	return []string{
		"container",
		"project_network",
		"project_directory",
		"local_backup_archives",
		"remote_backup_objects",
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
	unlockUserProjects, err := s.BeginUserProjectOperation(project.UserID)
	if err != nil {
		return nil, err
	}
	defer unlockUserProjects()
	unlockProject, err := s.BeginProjectMutationContext(ctx, project.ProjectID)
	if err != nil {
		return nil, err
	}
	defer unlockProject()

	return s.createProjectUnderUserOperation(ctx, project)
}

func (s *ProjectService) createProjectUnderUserOperation(ctx context.Context, project *model.Project) (*model.Project, error) {
	createLock := s.getProjectCreateLock(project)
	if createLock != nil {
		createLock.Lock()
		defer createLock.Unlock()
	}

	if existingProject := s.findRecentEquivalentProject(ctx, project); existingProject != nil {
		return existingProject, nil
	}

	return s.createProjectWithoutRecentReuseUnderUserOperation(ctx, project)
}

func (s *ProjectService) createProjectWithoutRecentReuseUnderUserOperation(
	ctx context.Context,
	project *model.Project,
) (*model.Project, error) {
	if err := s.projectRepo.Create(ctx, project); err != nil {
		return nil, err
	}

	s.initializeProjectWorkspace(project)
	return s.reloadProjectAfterCreate(ctx, project), nil
}

// BeginUserProjectOperation blocks administrator deletion while a user-level
// project operation validates ownership and persists its database changes.
func (s *ProjectService) BeginUserProjectOperation(userID string) (func(), error) {
	if s == nil || s.lifecycleCoordinator == nil {
		return func() {}, nil
	}
	return s.lifecycleCoordinator.acquireUserOperation(userID)
}

// BeginCancellableUserProjectOperation keeps an authenticated write inside the
// user deletion barrier and propagates deletion cancellation to downstream
// project lock waits and repository calls.
func (s *ProjectService) BeginCancellableUserProjectOperation(
	ctx context.Context,
	userID string,
) (context.Context, func(), error) {
	if s == nil || s.lifecycleCoordinator == nil {
		return ctx, func() {}, nil
	}
	finishUserOperation, err := s.BeginUserProjectOperation(userID)
	if err != nil {
		return ctx, nil, err
	}
	operationCtx, cancel := context.WithCancel(safeContext(ctx))
	unregister := s.lifecycleCoordinator.registerUserProjectActivity(
		userID,
		"",
		cancel,
		false,
	)
	var once sync.Once
	return operationCtx, func() {
		once.Do(func() {
			cancel()
			unregister()
			finishUserOperation()
		})
	}, nil
}

// BeginProjectMutation rejects new project mutations after administrator
// deletion starts and keeps an accepted mutation inside the deletion barrier.
func (s *ProjectService) BeginProjectMutation(projectID string) (func(), error) {
	if s == nil || s.lifecycleCoordinator == nil {
		return func() {}, nil
	}
	return s.lifecycleCoordinator.acquireProjectMutation(projectID)
}

// BeginProjectMutationContext is the cancellable form used by request-bound
// mutations so user deletion can release queued project lock waiters.
func (s *ProjectService) BeginProjectMutationContext(
	ctx context.Context,
	projectID string,
) (func(), error) {
	if s == nil || s.lifecycleCoordinator == nil {
		return func() {}, nil
	}
	return s.lifecycleCoordinator.acquireProjectMutationContext(ctx, projectID)
}

// BeginCancellableProjectMutation lets administrator deletion cancel a
// long-running project operation before waiting for its mutation gate.
func (s *ProjectService) BeginCancellableProjectMutation(
	ctx context.Context,
	projectID string,
) (context.Context, func(), error) {
	return s.BeginCancellableUserProjectMutation(ctx, "", projectID, false)
}

// BeginCancellableUserProjectMutation registers a long-running mutation
// against both the initiating user and target project before waiting for the
// project serialization gate.
func (s *ProjectService) BeginCancellableUserProjectMutation(
	ctx context.Context,
	userID string,
	projectID string,
	generation bool,
) (context.Context, func(), error) {
	if s == nil || s.lifecycleCoordinator == nil {
		return ctx, func() {}, nil
	}
	return s.lifecycleCoordinator.beginCancellableUserProjectMutation(
		ctx,
		userID,
		projectID,
		generation,
	)
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
	if _, exists := s.deleteTasks.LoadOrStore(projectID, struct{}{}); exists {
		log.Printf("Project %s deletion already in progress", projectID)
		return nil
	}
	accepted := false
	defer func() {
		if !accepted {
			s.deleteTasks.Delete(projectID)
		}
	}()

	cleanupCtx, cancelCleanup := context.WithCancel(context.Background())
	setupCtx, cancelSetup := context.WithCancel(safeContext(ctx))
	stopCleanupPropagation := context.AfterFunc(cleanupCtx, cancelSetup)
	defer cancelSetup()
	defer stopCleanupPropagation()

	unlockProject, finishDeletion, markCleanupStarted, unregisterCleanup, err :=
		s.lifecycleCoordinator.beginAsyncProjectDeletion(
			setupCtx,
			projectID,
			cancelCleanup,
		)
	if err != nil {
		cancelCleanup()
		return err
	}
	releaseDeletion := true
	defer func() {
		if releaseDeletion {
			cancelCleanup()
			unregisterCleanup()
			unlockProject()
			finishDeletion(false)
		}
	}()

	project, err := s.projectRepo.FindByProjectID(setupCtx, projectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}
	if project == nil {
		return fmt.Errorf("project not found")
	}

	if err := s.projectRepo.SoftDelete(setupCtx, projectID); err != nil {
		return fmt.Errorf("failed to mark project deleting: %w", err)
	}

	s.deleteRestoreStates.Store(projectID, &projectDeleteRestoreState{
		deadline:      time.Now().Add(ProjectDeletionRestoreWindow()),
		restoreSignal: make(chan struct{}),
	})
	projectSnapshot := *project
	accepted = true
	releaseDeletion = false
	go func() {
		preserveDeletionBarrier := true
		defer func() {
			cancelCleanup()
			unregisterCleanup()
			unlockProject()
			finishDeletion(preserveDeletionBarrier)
		}()
		preserveDeletionBarrier = s.cleanupDeletedProject(
			cleanupCtx,
			&projectSnapshot,
			markCleanupStarted,
		)
	}()
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
	value, ok := s.deleteRestoreStates.Load(projectID)
	if !ok {
		return nil, fmt.Errorf("project restore window expired or cleanup already started")
	}
	state, ok := value.(*projectDeleteRestoreState)
	if !ok || state == nil {
		return nil, fmt.Errorf("project restore window state is invalid")
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.cleanupStarted ||
		(!state.restoreUncertain && time.Now().After(state.deadline)) {
		return nil, fmt.Errorf("project restore window expired or cleanup already started")
	}
	project, confirmed, err := s.attemptRestoreDeletedProjectByOwner(ctx, projectID, userID)
	if err != nil {
		state.restoreUncertain = !confirmed
		if state.restoreUncertain {
			state.restoreUserID = userID
		} else {
			state.restoreUserID = ""
		}
		notifyProjectDeleteRestoreStateLocked(state)
		return nil, err
	}
	state.restoreRequested = true
	state.restoreUncertain = false
	state.restoreUserID = ""
	notifyProjectDeleteRestoreStateLocked(state)
	return project, nil
}

func (s *ProjectService) attemptRestoreDeletedProjectByOwner(
	ctx context.Context,
	projectID string,
	userID string,
) (*model.Project, bool, error) {
	restoreCtx, cancelRestore := context.WithTimeout(safeContext(ctx), 10*time.Second)
	project, err := s.projectRepo.RestoreDeletedByOwner(restoreCtx, projectID, userID)
	cancelRestore()
	if err == nil {
		return project, true, nil
	}
	originalErr := err
	confirmationRepo, ok := s.projectRepo.(projectRestoreConfirmationRepository)
	if !ok {
		return nil, false, originalErr
	}
	confirmationCtx, cancelConfirmation := context.WithTimeout(
		context.WithoutCancel(safeContext(ctx)),
		5*time.Second,
	)
	confirmedProject, confirmationErr := confirmationRepo.FindByProjectIDIncludingDeletedByOwner(
		confirmationCtx,
		projectID,
		userID,
	)
	cancelConfirmation()
	if confirmationErr != nil {
		if isProjectNotFoundRepositoryError(confirmationErr) {
			return nil, true, originalErr
		}
		return nil, false, originalErr
	}
	if confirmedProject != nil && confirmedProject.DeletedAt == nil {
		return confirmedProject, true, nil
	}
	return nil, true, originalErr
}

func isProjectNotFoundRepositoryError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return message == "record not found" ||
		message == "project not found" ||
		strings.Contains(message, "pgrst116")
}

func notifyProjectDeleteRestoreStateLocked(state *projectDeleteRestoreState) {
	if state.restoreSignal != nil {
		close(state.restoreSignal)
	}
	state.restoreSignal = make(chan struct{})
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

func (s *ProjectService) cleanupDeletedProject(
	ctx context.Context,
	project *model.Project,
	markCleanupStarted func() bool,
) bool {
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return false
	}

	projectID := project.ProjectID
	defer func() {
		s.deleteTasks.Delete(projectID)
		s.deleteRestoreStates.Delete(projectID)
	}()

	if s.waitProjectDeletionRestoreWindow(ctx, projectID) {
		log.Printf("Project %s deletion cleanup cancelled by user restore request", projectID)
		return false
	}

	if err := ctx.Err(); err != nil {
		log.Printf("Project %s deletion cleanup handed off to administrator user deletion: %v", projectID, err)
		return true
	}
	if markCleanupStarted == nil || !markCleanupStarted() {
		log.Printf("Project %s deletion cleanup ownership was transferred before destructive cleanup", projectID)
		return true
	}
	for attempt := 1; ; attempt++ {
		attemptCtx, cancel := context.WithTimeout(safeContext(ctx), 90*time.Second)
		cleanupErr := s.cleanupProjectResources(attemptCtx, project)
		cancel()
		if cleanupErr == nil {
			break
		}
		log.Printf("Project %s async cleanup attempt %d failed: %v", projectID, attempt, cleanupErr)
		if !waitForProjectDeletionRetry(ctx, attempt) {
			log.Printf(
				"Project %s deletion cleanup stopped while retaining the deletion barrier: %v",
				projectID,
				ctx.Err(),
			)
			return true
		}
	}

	for attempt := 1; ; attempt++ {
		attemptCtx, cancel := context.WithTimeout(safeContext(ctx), 90*time.Second)
		err := s.projectRepo.HardDelete(attemptCtx, projectID)
		cancel()
		if err == nil {
			log.Printf("Project %s async cleanup finished", projectID)
			return true
		}
		log.Printf("Project %s hard delete attempt %d failed after cleanup: %v", projectID, attempt, err)
		if !waitForProjectDeletionRetry(ctx, attempt) {
			log.Printf(
				"Project %s hard delete stopped while retaining the deletion barrier: %v",
				projectID,
				ctx.Err(),
			)
			return true
		}
	}
}

func waitForProjectDeletionRetry(ctx context.Context, attempt int) bool {
	delay := time.Duration(attempt) * time.Second
	if delay > 30*time.Second {
		delay = 30 * time.Second
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-safeContext(ctx).Done():
		return false
	case <-timer.C:
		return true
	}
}

func (s *ProjectService) waitProjectDeletionRestoreWindow(ctx context.Context, projectID string) bool {
	value, ok := s.deleteRestoreStates.Load(projectID)
	if !ok {
		return false
	}
	state, ok := value.(*projectDeleteRestoreState)
	if !ok || state == nil {
		return false
	}

	for {
		state.mu.Lock()
		if ctx.Err() != nil {
			state.mu.Unlock()
			return false
		}
		if state.restoreRequested {
			state.mu.Unlock()
			return true
		}
		if state.restoreUncertain {
			if state.restoreSignal == nil {
				state.restoreSignal = make(chan struct{})
			}
			signal := state.restoreSignal
			userID := state.restoreUserID
			state.mu.Unlock()
			retryTimer := time.NewTimer(time.Second)
			select {
			case <-ctx.Done():
				retryTimer.Stop()
				return false
			case <-signal:
				if !retryTimer.Stop() {
					<-retryTimer.C
				}
				continue
			case <-retryTimer.C:
			}

			project, confirmed, restoreErr := s.attemptRestoreDeletedProjectByOwner(
				ctx,
				projectID,
				userID,
			)
			state.mu.Lock()
			if !state.restoreUncertain || state.cleanupStarted {
				state.mu.Unlock()
				continue
			}
			if restoreErr == nil && project != nil {
				state.restoreRequested = true
				state.restoreUncertain = false
				state.restoreUserID = ""
				notifyProjectDeleteRestoreStateLocked(state)
			} else if confirmed {
				state.restoreUncertain = false
				state.restoreUserID = ""
				notifyProjectDeleteRestoreStateLocked(state)
			}
			state.mu.Unlock()
			continue
		}
		wait := time.Until(state.deadline)
		if wait <= 0 {
			state.cleanupStarted = true
			state.mu.Unlock()
			return false
		}
		if state.restoreSignal == nil {
			state.restoreSignal = make(chan struct{})
		}
		signal := state.restoreSignal
		state.mu.Unlock()
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return false
		case <-signal:
			if !timer.Stop() {
				<-timer.C
			}
		case <-timer.C:
		}
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
	if err := s.deleteProjectBackupResources(ctx, projectID); err != nil {
		cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete project backup resources: %v", err))
	}

	if len(cleanupErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(cleanupErrors, " | "))
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

func (s *ProjectService) restoreTransferredAsyncProjectDeletions(
	projectIDs []string,
	userID string,
) []string {
	failedProjectIDs := make([]string, 0)
	for _, projectID := range projectIDs {
		restoreCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := s.restoreSoftDeletedProject(restoreCtx, projectID)
		cancel()
		confirmationRepo, canConfirm := s.projectRepo.(projectRestoreConfirmationRepository)
		if canConfirm {
			confirmationCtx, cancelConfirmation := context.WithTimeout(context.Background(), 5*time.Second)
			project, confirmationErr := confirmationRepo.FindByProjectIDIncludingDeletedByOwner(
				confirmationCtx,
				projectID,
				userID,
			)
			cancelConfirmation()
			if confirmationErr == nil && project != nil && project.DeletedAt == nil {
				continue
			}
		} else if err == nil {
			continue
		}
		if err == nil {
			err = errors.New("project restore could not be confirmed")
		}
		failedProjectIDs = append(failedProjectIDs, projectID)
		log.Printf(
			"Warning: failed to restore project %s after administrator deletion rollback: %v",
			projectID,
			err,
		)
	}
	return failedProjectIDs
}

func (s *ProjectService) reconcileTransferredAsyncProjectDeletions(
	userID string,
	preserved map[string]uint64,
) {
	for projectID, generation := range preserved {
		projectID := projectID
		generation := generation
		go func() {
			backoff := time.Second
			for {
				restoreCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				err := s.restoreSoftDeletedProject(restoreCtx, projectID)
				cancel()
				confirmationRepo, canConfirm := s.projectRepo.(projectRestoreConfirmationRepository)
				if canConfirm {
					confirmationCtx, cancelConfirmation := context.WithTimeout(context.Background(), 5*time.Second)
					project, confirmationErr := confirmationRepo.FindByProjectIDIncludingDeletedByOwner(
						confirmationCtx,
						projectID,
						userID,
					)
					cancelConfirmation()
					if confirmationErr == nil && project != nil && project.DeletedAt == nil {
						s.lifecycleCoordinator.releasePreservedProjectDeletionBarrier(projectID, generation)
						return
					}
				} else if err == nil {
					s.lifecycleCoordinator.releasePreservedProjectDeletionBarrier(projectID, generation)
					return
				}
				time.Sleep(backoff)
				if backoff < 30*time.Second {
					backoff *= 2
				}
			}
		}()
	}
}

// DeleteUserWithProjectResources coordinates runtime cleanup and the database
// hard delete while preserving local directories for rollback on failure.
func (s *ProjectService) DeleteUserWithProjectResources(
	ctx context.Context,
	userID string,
	deleteUser func(context.Context) error,
) error {
	return s.deleteUserWithProjectResources(
		ctx,
		userID,
		deleteUser,
		s.stageUserProjectDirectories,
	)
}

func (s *ProjectService) deleteUserWithProjectResources(
	ctx context.Context,
	userID string,
	deleteUser func(context.Context) error,
	stageDirectories func(
		context.Context,
		[]model.Project,
	) ([]stagedProjectDirectory, error),
) error {
	if s == nil || s.projectRepo == nil {
		return fmt.Errorf("project repository not available")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return fmt.Errorf("user id is required")
	}
	if deleteUser == nil {
		return fmt.Errorf("user deletion callback is required")
	}
	if stageDirectories == nil {
		return fmt.Errorf("project directory staging callback is required")
	}

	userIdle, finishUserDeletion, err := s.lifecycleCoordinator.startUserDeletion(userID)
	if err != nil {
		return fmt.Errorf("begin user deletion: %w", err)
	}
	committed := false
	completionHandedOff := false
	defer func() {
		if !completionHandedOff {
			finishUserDeletion(committed)
		}
	}()

	repo, ok := s.projectRepo.(userProjectDeletionRepository)
	if !ok {
		return fmt.Errorf("project repository does not support administrator user deletion")
	}
	projects, err := repo.ListByUserIDIncludingDeleted(ctx, userID)
	if err != nil {
		return fmt.Errorf("list user projects for deletion: %w", err)
	}

	projectIDs := make([]string, 0, len(projects))
	for i := range projects {
		projectIDs = append(projectIDs, projects[i].ProjectID)
	}
	finishDeletion, transferredAsyncProjectIDs, err := s.lifecycleCoordinator.beginProjectDeletion(ctx, projectIDs)
	if err != nil {
		if finishDeletion != nil {
			failedProjectIDs := s.restoreTransferredAsyncProjectDeletions(
				transferredAsyncProjectIDs,
				userID,
			)
			preserved := s.lifecycleCoordinator.preserveProjectDeletionBarriers(
				failedProjectIDs,
			)
			finishDeletion(false)
			s.reconcileTransferredAsyncProjectDeletions(userID, preserved)
		}
		return fmt.Errorf("begin user project deletion: %w", err)
	}
	defer func() {
		if completionHandedOff {
			return
		}
		if !committed {
			failedProjectIDs := s.restoreTransferredAsyncProjectDeletions(
				transferredAsyncProjectIDs,
				userID,
			)
			preserved := s.lifecycleCoordinator.preserveProjectDeletionBarriers(failedProjectIDs)
			finishDeletion(false)
			s.reconcileTransferredAsyncProjectDeletions(userID, preserved)
			return
		}
		finishDeletion(committed)
	}()

	select {
	case <-ctx.Done():
		return fmt.Errorf("wait for user operations before deletion: %w", ctx.Err())
	case <-userIdle:
	}
	if s.terminalMgr != nil {
		s.terminalMgr.closeUser(userID)
	}

	currentProjects, err := repo.ListByUserIDIncludingDeleted(ctx, userID)
	if err != nil {
		return fmt.Errorf("refresh user projects for deletion: %w", err)
	}
	existingProjectIDs := make(map[string]struct{}, len(projectIDs))
	for _, projectID := range projectIDs {
		existingProjectIDs[projectID] = struct{}{}
	}
	additionalProjectIDs := make([]string, 0)
	for i := range currentProjects {
		if _, exists := existingProjectIDs[currentProjects[i].ProjectID]; !exists {
			additionalProjectIDs = append(additionalProjectIDs, currentProjects[i].ProjectID)
		}
	}
	finishAdditionalDeletion, transferredAdditionalProjectIDs, err := s.lifecycleCoordinator.beginProjectDeletion(
		ctx,
		additionalProjectIDs,
	)
	if err != nil {
		if finishAdditionalDeletion != nil {
			failedProjectIDs := s.restoreTransferredAsyncProjectDeletions(
				transferredAdditionalProjectIDs,
				userID,
			)
			preserved := s.lifecycleCoordinator.preserveProjectDeletionBarriers(
				failedProjectIDs,
			)
			finishAdditionalDeletion(false)
			s.reconcileTransferredAsyncProjectDeletions(userID, preserved)
		}
		return fmt.Errorf("begin additional user project deletion: %w", err)
	}
	defer func() {
		if completionHandedOff {
			return
		}
		if !committed {
			failedProjectIDs := s.restoreTransferredAsyncProjectDeletions(
				transferredAdditionalProjectIDs,
				userID,
			)
			preserved := s.lifecycleCoordinator.preserveProjectDeletionBarriers(failedProjectIDs)
			finishAdditionalDeletion(false)
			s.reconcileTransferredAsyncProjectDeletions(userID, preserved)
			return
		}
		finishAdditionalDeletion(committed)
	}()
	finishFailedDeletion := func() {
		failedPrimary := s.restoreTransferredAsyncProjectDeletions(
			transferredAsyncProjectIDs,
			userID,
		)
		failedAdditional := s.restoreTransferredAsyncProjectDeletions(
			transferredAdditionalProjectIDs,
			userID,
		)
		preservedPrimary := s.lifecycleCoordinator.preserveProjectDeletionBarriers(failedPrimary)
		preservedAdditional := s.lifecycleCoordinator.preserveProjectDeletionBarriers(failedAdditional)
		finishAdditionalDeletion(false)
		finishDeletion(false)
		finishUserDeletion(false)
		s.reconcileTransferredAsyncProjectDeletions(userID, preservedPrimary)
		s.reconcileTransferredAsyncProjectDeletions(userID, preservedAdditional)
	}

	projects = currentProjects
	projectIDs = projectIDs[:0]
	for i := range projects {
		projectIDs = append(projectIDs, projects[i].ProjectID)
	}

	unlockRuntimeCreation := lockProjectRuntimeCreation(projectIDs)
	runtimeCreationHandedOff := false
	defer func() {
		if !runtimeCreationHandedOff {
			unlockRuntimeCreation()
		}
	}()

	var stagedRemoteBackups []stagedProjectRemoteBackup
	restoreStagedResources := func(
		paths []stagedProjectDirectory,
		cause error,
	) error {
		localRollbackErr := rollbackStagedProjectDirectories(paths)
		remoteRollbackCtx, cancelRemoteRollback := context.WithTimeout(
			context.WithoutCancel(safeContext(ctx)),
			30*time.Second,
		)
		remoteRollbackErr := restoreStagedProjectRemoteBackups(
			remoteRollbackCtx,
			stagedRemoteBackups,
		)
		cancelRemoteRollback()
		if localRollbackErr == nil && remoteRollbackErr == nil {
			return cause
		}
		completionHandedOff = true
		runtimeCreationHandedOff = true
		localSnapshot := append([]stagedProjectDirectory(nil), paths...)
		remoteSnapshot := append(
			[]stagedProjectRemoteBackup(nil),
			stagedRemoteBackups...,
		)
		go func(initialLocalErr, initialRemoteErr error) {
			defer unlockRuntimeCreation()
			backoff := time.Second
			localErr := initialLocalErr
			remoteErr := initialRemoteErr
			for localErr != nil || remoteErr != nil {
				log.Printf(
					"Warning: failed to restore staging after user deletion %s was rejected: %v",
					userID,
					fmt.Errorf("local=%v remote=%v", localErr, remoteErr),
				)
				time.Sleep(backoff)
				if backoff < 30*time.Second {
					backoff *= 2
				}
				localErr = rollbackStagedProjectDirectories(localSnapshot)
				remoteCtx, cancelRemote := context.WithTimeout(
					context.Background(),
					30*time.Second,
				)
				remoteErr = restoreStagedProjectRemoteBackups(
					remoteCtx,
					remoteSnapshot,
				)
				cancelRemote()
			}
			finishFailedDeletion()
		}(localRollbackErr, remoteRollbackErr)
		return fmt.Errorf(
			"%w; restore staged project data: local=%v remote=%v",
			cause,
			localRollbackErr,
			remoteRollbackErr,
		)
	}

	stagedPaths, err := stageDirectories(ctx, projects)
	if err != nil {
		if len(stagedPaths) == 0 {
			return err
		}
		return restoreStagedResources(stagedPaths, err)
	}
	stagedRemoteBackups, err = s.stageUserProjectRemoteBackups(
		ctx,
		userID,
		projects,
	)
	if err != nil {
		return restoreStagedResources(stagedPaths, err)
	}
	rollback := func(cause error) error {
		return restoreStagedResources(stagedPaths, cause)
	}

	var cleanupErrors []string
	for i := range projects {
		if err := s.cleanupUserProjectRuntimeResources(ctx, &projects[i]); err != nil {
			cleanupErrors = append(cleanupErrors, fmt.Sprintf("%s: %v", projects[i].ProjectID, err))
		}
	}
	if len(cleanupErrors) > 0 {
		return rollback(fmt.Errorf("cleanup user project resources: %s", strings.Join(cleanupErrors, " | ")))
	}
	if err := deleteUser(ctx); err != nil {
		if isUserDeletionOutcomeUnknown(err) {
			completionHandedOff = true
			runtimeCreationHandedOff = true
			go func(initialErr error) {
				defer unlockRuntimeCreation()
				backoff := time.Second
				for {
					retryCtx, cancelRetry := context.WithTimeout(context.Background(), 15*time.Second)
					retryErr := deleteUser(retryCtx)
					cancelRetry()
					if isUserDeletionOutcomeUnknown(retryErr) {
						time.Sleep(backoff)
						if backoff < 30*time.Second {
							backoff *= 2
						}
						continue
					}
					if retryErr == nil {
						if markerErr := markStagedProjectDirectoriesCommitted(stagedPaths); markerErr != nil {
							log.Printf(
								"Warning: failed to mark committed staging after confirming user deletion %s: %v",
								userID,
								markerErr,
							)
						}
						if markerErr := markStagedProjectRemoteBackupsCommitted(
							stagedRemoteBackups,
						); markerErr != nil {
							log.Printf(
								"Warning: failed to mark committed remote staging after confirming user deletion %s: %v",
								userID,
								markerErr,
							)
						}
						if discardErr := discardStagedProjectDirectories(stagedPaths); discardErr != nil {
							log.Printf(
								"Warning: failed to discard staging after confirming user deletion %s: %v",
								userID,
								discardErr,
							)
							retryDiscardStagedProjectDirectories(stagedPaths)
						}
						remoteCleanupCtx, cancelRemoteCleanup := context.WithTimeout(
							context.Background(),
							30*time.Second,
						)
						remoteDiscardErr := discardStagedProjectRemoteBackups(
							remoteCleanupCtx,
							stagedRemoteBackups,
						)
						cancelRemoteCleanup()
						if remoteDiscardErr != nil {
							log.Printf(
								"Warning: failed to discard remote staging after confirming user deletion %s: %v",
								userID,
								remoteDiscardErr,
							)
							retryDiscardStagedProjectRemoteBackups(stagedRemoteBackups)
						}
						finishAdditionalDeletion(true)
						finishDeletion(true)
						finishUserDeletion(true)
						return
					}

					rollbackBackoff := time.Second
					for {
						localRollbackErr := rollbackStagedProjectDirectories(stagedPaths)
						remoteRollbackCtx, cancelRemoteRollback := context.WithTimeout(
							context.Background(),
							30*time.Second,
						)
						remoteRollbackErr := restoreStagedProjectRemoteBackups(
							remoteRollbackCtx,
							stagedRemoteBackups,
						)
						cancelRemoteRollback()
						if localRollbackErr == nil && remoteRollbackErr == nil {
							break
						}
						log.Printf(
							"Warning: failed to restore staging after user deletion %s was rejected: %v",
							userID,
							fmt.Errorf(
								"local=%v remote=%v",
								localRollbackErr,
								remoteRollbackErr,
							),
						)
						time.Sleep(rollbackBackoff)
						if rollbackBackoff < 30*time.Second {
							rollbackBackoff *= 2
						}
					}
					finishFailedDeletion()
					log.Printf(
						"User deletion %s was not committed after an ambiguous response: %v (initial error: %v)",
						userID,
						retryErr,
						initialErr,
					)
					return
				}
			}(err)
			return fmt.Errorf("delete user database records: %w", err)
		}
		return rollback(fmt.Errorf("delete user database records: %w", err))
	}
	committed = true
	if err := markStagedProjectDirectoriesCommitted(stagedPaths); err != nil {
		log.Printf("Warning: failed to mark committed staged data after deleting user %s: %v", userID, err)
	}
	if err := markStagedProjectRemoteBackupsCommitted(stagedRemoteBackups); err != nil {
		log.Printf("Warning: failed to mark committed remote staging after deleting user %s: %v", userID, err)
	}
	if err := discardStagedProjectDirectories(stagedPaths); err != nil {
		log.Printf("Warning: failed to discard staged data after deleting user %s: %v", userID, err)
		retryDiscardStagedProjectDirectories(stagedPaths)
	}
	remoteCleanupCtx, cancelRemoteCleanup := context.WithTimeout(
		context.Background(),
		30*time.Second,
	)
	remoteDiscardErr := discardStagedProjectRemoteBackups(
		remoteCleanupCtx,
		stagedRemoteBackups,
	)
	cancelRemoteCleanup()
	if remoteDiscardErr != nil {
		log.Printf("Warning: failed to discard remote staged data after deleting user %s: %v", userID, remoteDiscardErr)
		retryDiscardStagedProjectRemoteBackups(stagedRemoteBackups)
	}
	return nil
}

func (s *ProjectService) cleanupUserProjectRuntimeResources(ctx context.Context, project *model.Project) error {
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return fmt.Errorf("project id is required")
	}
	projectID := strings.TrimSpace(project.ProjectID)
	var cleanupErrors []string

	if s.terminalMgr != nil {
		s.terminalMgr.closeProject(projectID)
	}
	if s.fileSvc != nil {
		s.fileSvc.RemoveManager(projectID)
	}
	if s.containerMgr != nil {
		if err := s.containerMgr.RemoveContainer(ctx, projectID); err != nil {
			cleanupErrors = append(cleanupErrors, fmt.Sprintf("remove project container: %v", err))
		}
	}
	if len(cleanupErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(cleanupErrors, " | "))
	}
	return nil
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
func (s *ProjectService) UpdateProject(ctx context.Context, projectID, userID string, updates map[string]interface{}) error {
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
	operationCtx, finishOperation, err := s.BeginCancellableUserProjectMutation(ctx, userID, projectID, false)
	if err != nil {
		return err
	}
	defer finishOperation()

	if err := s.projectRepo.UpdateFields(operationCtx, projectID, sanitizedUpdates); err != nil {
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
