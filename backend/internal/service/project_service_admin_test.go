package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"yistack/config"
	"yistack/internal/model"
)

type stubProjectListRepo struct {
	listAllPage              int
	listAllPageSize          int
	listAllErr               error
	findByProjectIDErr       error
	projects                 []model.Project
	createdProjects          []model.Project
	total                    int64
	updateContainerStatusErr error
	updatedContainerProject  string
	updatedContainerStatus   string
	updatedFieldsProjectID   string
	updatedFields            map[string]interface{}
}

func (r *stubProjectListRepo) Create(_ context.Context, project *model.Project) error {
	r.createdProjects = append(r.createdProjects, *project)
	r.projects = append(r.projects, *project)
	return nil
}

func (r *stubProjectListRepo) FindByID(context.Context, string) (*model.Project, error) {
	return nil, nil
}

func (r *stubProjectListRepo) FindByProjectID(_ context.Context, projectID string) (*model.Project, error) {
	if r.findByProjectIDErr != nil {
		return nil, r.findByProjectIDErr
	}
	for i := range r.projects {
		if r.projects[i].ProjectID == projectID {
			return &r.projects[i], nil
		}
	}
	return nil, nil
}

func (r *stubProjectListRepo) FindByPreviewShareID(_ context.Context, previewShareID string) (*model.Project, error) {
	for i := range r.projects {
		if r.projects[i].PreviewShareID == previewShareID && r.projects[i].PreviewShareEnabled {
			return &r.projects[i], nil
		}
	}
	return nil, nil
}

func (r *stubProjectListRepo) ListByUserID(_ context.Context, userID string, _, _ int) ([]model.Project, int64, error) {
	projects := []model.Project{}
	for i := range r.projects {
		if r.projects[i].UserID == userID {
			projects = append(projects, r.projects[i])
		}
	}
	return projects, int64(len(projects)), nil
}

func (r *stubProjectListRepo) ListAll(_ context.Context, page, pageSize int) ([]model.Project, int64, error) {
	r.listAllPage = page
	r.listAllPageSize = pageSize
	if r.listAllErr != nil {
		return nil, 0, r.listAllErr
	}
	return r.projects, r.total, nil
}

func (r *stubProjectListRepo) Update(context.Context, *model.Project) error {
	return nil
}

func (r *stubProjectListRepo) UpdateFields(_ context.Context, projectID string, updates map[string]any) error {
	r.updatedFieldsProjectID = projectID
	r.updatedFields = updates
	for i := range r.projects {
		if r.projects[i].ProjectID != projectID {
			continue
		}
		if enabled, ok := updates["preview_share_enabled"].(bool); ok {
			r.projects[i].PreviewShareEnabled = enabled
		}
		if shareID, ok := updates["preview_share_id"].(string); ok {
			r.projects[i].PreviewShareID = shareID
		}
	}
	return nil
}

func (r *stubProjectListRepo) UpdateContainerInfo(context.Context, string, string, string, string, int, string) error {
	return nil
}

func (r *stubProjectListRepo) UpdateContainerStatus(_ context.Context, projectID string, status string) error {
	r.updatedContainerProject = projectID
	r.updatedContainerStatus = status
	return r.updateContainerStatusErr
}

func (r *stubProjectListRepo) UpdateFileTree(context.Context, string, string) error {
	return nil
}

func (r *stubProjectListRepo) UpdateDirectoryPath(context.Context, string, string) error {
	return nil
}

func (r *stubProjectListRepo) UpdatePlanData(context.Context, string, string, string) error {
	return nil
}

func (r *stubProjectListRepo) SoftDelete(context.Context, string) error {
	return nil
}

func (r *stubProjectListRepo) RestoreDeleted(context.Context, string) error {
	return nil
}

func (r *stubProjectListRepo) RestoreDeletedByOwner(_ context.Context, projectID, userID string) (*model.Project, error) {
	for i := range r.projects {
		if r.projects[i].ProjectID == projectID && r.projects[i].UserID == userID {
			return &r.projects[i], nil
		}
	}
	return nil, errors.New("project not found")
}

func (r *stubProjectListRepo) HardDelete(context.Context, string) error {
	return nil
}

func TestProjectPreviewShareEnableCreatesPublicPath(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID: "proj_preview_share",
			UserID:    "user_preview_share",
		}},
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	result, err := service.EnableProjectPreviewShare(context.Background(), "proj_preview_share")
	if err != nil {
		t.Fatalf("EnableProjectPreviewShare returned error: %v", err)
	}
	if result.PreviewShareEnabled != true {
		t.Fatalf("expected preview share enabled, got %#v", result)
	}
	if result.PreviewShareID == "" || result.PreviewShareID == "proj_preview_share" {
		t.Fatalf("expected independent preview share id, got %#v", result)
	}
	if !strings.HasPrefix(result.PreviewShareURL, "/preview/") {
		t.Fatalf("expected preview share url path, got %#v", result)
	}
	project, err := service.GetProjectByPreviewShareID(context.Background(), result.PreviewShareID)
	if err != nil {
		t.Fatalf("GetProjectByPreviewShareID returned error: %v", err)
	}
	if project.ProjectID != "proj_preview_share" {
		t.Fatalf("expected shared project id, got %q", project.ProjectID)
	}
}

func TestProjectPreviewShareDisableInvalidatesPublicPath(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:           "proj_preview_share_disabled",
			UserID:              "user_preview_share",
			PreviewShareEnabled: true,
			PreviewShareID:      "abcdEFGHijklMNOPqrstUVWXyz012345",
		}},
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	result, err := service.DisableProjectPreviewShare(context.Background(), "proj_preview_share_disabled")
	if err != nil {
		t.Fatalf("DisableProjectPreviewShare returned error: %v", err)
	}
	if result.PreviewShareEnabled != false {
		t.Fatalf("expected preview share disabled, got %#v", result)
	}
	if result.PreviewShareURL != "" {
		t.Fatalf("disabled share should not return public URL, got %#v", result)
	}
	if _, err := service.GetProjectByPreviewShareID(context.Background(), "abcdEFGHijklMNOPqrstUVWXyz012345"); err == nil {
		t.Fatal("expected disabled preview share to be unavailable")
	}
}

type stubProjectCleanupStateRepo struct {
	projectID string
	err       error
}

func (r *stubProjectCleanupStateRepo) UpsertSnapshot(context.Context, *model.ProjectEngineeringState) error {
	return nil
}

func (r *stubProjectCleanupStateRepo) FindByProjectID(context.Context, string) (*model.ProjectEngineeringState, error) {
	return nil, nil
}

func (r *stubProjectCleanupStateRepo) DeleteByProjectID(_ context.Context, projectID string) error {
	r.projectID = projectID
	return r.err
}

type stubProjectCleanupCapabilityAuditRepo struct {
	projectID string
	err       error
}

func (r *stubProjectCleanupCapabilityAuditRepo) ListByProjectID(context.Context, string, string, string, int, int) ([]model.ProjectCapabilityExecutionAudit, int64, error) {
	return nil, 0, nil
}

func (r *stubProjectCleanupCapabilityAuditRepo) DeleteByProjectID(_ context.Context, projectID string) error {
	r.projectID = projectID
	return r.err
}

type stubProjectCleanupResourceAlertEventRepo struct {
	projectID string
	err       error
}

func (r *stubProjectCleanupResourceAlertEventRepo) Create(context.Context, *model.ProjectResourceAlertEvent) error {
	return nil
}

func (r *stubProjectCleanupResourceAlertEventRepo) ListByProjectID(context.Context, string, string, int, int) ([]model.ProjectResourceAlertEvent, int64, error) {
	return nil, 0, nil
}

func (r *stubProjectCleanupResourceAlertEventRepo) DeleteByProjectID(_ context.Context, projectID string) error {
	r.projectID = projectID
	return r.err
}

func TestProjectServiceListProjectsUsesAdminListAndNormalizesPagination(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{{ProjectID: "proj_1", Name: "Project 1"}},
		total:    1,
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	projects, total, err := service.ListProjects(context.Background(), 0, 500)
	if err != nil {
		t.Fatalf("ListProjects returned error: %v", err)
	}
	if total != 1 || len(projects) != 1 || projects[0].ProjectID != "proj_1" {
		t.Fatalf("unexpected project list result: total=%d projects=%#v", total, projects)
	}
	if repo.listAllPage != 1 {
		t.Fatalf("expected normalized page 1, got %d", repo.listAllPage)
	}
	if repo.listAllPageSize != 100 {
		t.Fatalf("expected capped page size 100, got %d", repo.listAllPageSize)
	}
}

func TestCreateProjectReusesRecentEquivalentProject(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:   "proj_existing",
			UserID:      "user-1",
			Name:        "企业官网",
			Description: "创建一个企业官网",
			AppType:     "web",
			CreatedAt:   time.Now().Add(-30 * time.Second),
		}},
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	project, err := service.CreateProject(context.Background(), &CreateProjectRequest{
		UserID:      "user-1",
		Name:        "企业官网",
		Description: "创建一个企业官网",
		AppType:     "web",
	})
	if err != nil {
		t.Fatalf("CreateProject returned error: %v", err)
	}
	if project.ProjectID != "proj_existing" {
		t.Fatalf("expected existing project to be reused, got %q", project.ProjectID)
	}
	if len(repo.createdProjects) != 0 {
		t.Fatalf("expected no new project insert, got %#v", repo.createdProjects)
	}
}

func TestProjectIdleProtectionUsesDurableGenerationJob(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	repo.jobs["active-job"] = &model.GenerationJob{
		ID:        "active-job",
		ProjectID: "project-active-generation",
		Status:    model.GenerationJobStatusValidating,
		CreatedAt: time.Now(),
	}
	projectService := NewProjectService(ProjectServiceOptions{
		GenerationJobRepo: repo,
	})

	protected, err := projectService.hasActiveGenerationJob(
		context.Background(),
		"project-active-generation",
	)
	if err != nil || !protected {
		t.Fatalf("active durable generation must protect runtime: protected=%t err=%v", protected, err)
	}

	repo.mu.Lock()
	repo.jobs["active-job"].Status = model.GenerationJobStatusSucceeded
	repo.mu.Unlock()
	protected, err = projectService.hasActiveGenerationJob(
		context.Background(),
		"project-active-generation",
	)
	if err != nil || protected {
		t.Fatalf("terminal generation must release runtime protection: protected=%t err=%v", protected, err)
	}
}

func TestProjectRuntimeActivityManagerUnavailable(t *testing.T) {
	project := &model.Project{
		ProjectID:       "proj_runtime_activity",
		AppType:         "web",
		ContainerStatus: "running",
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: &stubProjectListRepo{}})

	status := service.TouchProjectRuntimeActivity(context.Background(), project, "runtime_activity_api")

	if status.ProjectID != "proj_runtime_activity" {
		t.Fatalf("expected project id to be preserved, got %q", status.ProjectID)
	}
	if status.ActivityStatus != "unavailable" {
		t.Fatalf("expected unavailable activity status, got %q", status.ActivityStatus)
	}
	if status.ContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status, got %q", status.ContainerStatus)
	}
	if status.Source != "runtime_activity_api" {
		t.Fatalf("expected source runtime_activity_api, got %q", status.Source)
	}
	if status.Error != "container manager not available" {
		t.Fatalf("expected container manager error, got %q", status.Error)
	}
	if status.UpdatedAt == "" {
		t.Fatal("expected activity status to include updatedAt")
	}
}

func TestProjectServiceGetStoredProjectRuntimeStatusForProjectReadsSnapshotOnly(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_1")
	stateDir := filepath.Join(projectDir, ".yistack")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatalf("failed to create runtime state dir: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(stateDir, "runtime-status.json"),
		[]byte(`{"status":"ready","phase":"ready","message":"ok","previewUrl":"http://preview.local"}`),
		0o644,
	); err != nil {
		t.Fatalf("failed to write runtime status: %v", err)
	}

	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  &stubProjectListRepo{},
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	status, err := service.GetStoredProjectRuntimeStatusForProject(&model.Project{
		ProjectID:       "proj_1",
		DirectoryPath:   projectDir,
		ContainerStatus: "running",
	})
	if err != nil {
		t.Fatalf("GetStoredProjectRuntimeStatusForProject returned error: %v", err)
	}
	if status == nil {
		t.Fatal("expected stored runtime status")
	}
	if status.ProjectID != "proj_1" {
		t.Fatalf("expected project id to be attached, got %q", status.ProjectID)
	}
	if status.ContainerStatus != "running" {
		t.Fatalf("expected container status to be attached, got %q", status.ContainerStatus)
	}
	if status.Status != "ready" || status.Phase != "ready" || status.Message != "ok" {
		t.Fatalf("unexpected runtime status: %#v", status)
	}
	if status.PreviewURL != "http://preview.local" {
		t.Fatalf("expected stored preview url to be preserved, got %q", status.PreviewURL)
	}
}

func TestProjectServiceGetRuntimeStatusSurfacesCorruptSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_corrupt")
	stateDir := filepath.Join(projectDir, ".yistack")
	if err := os.MkdirAll(stateDir, 0o755); err != nil {
		t.Fatalf("failed to create runtime state dir: %v", err)
	}
	statusPath := filepath.Join(stateDir, "runtime-status.json")
	if err := os.WriteFile(statusPath, []byte(`{"status":`), 0o644); err != nil {
		t.Fatalf("failed to write corrupt runtime status: %v", err)
	}

	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  &stubProjectListRepo{},
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	status, err := service.GetProjectRuntimeStatusForProject(context.Background(), &model.Project{
		ProjectID:       "proj_corrupt",
		DirectoryPath:   projectDir,
		ContainerStatus: "running",
	})
	if err != nil {
		t.Fatalf("GetProjectRuntimeStatusForProject returned error: %v", err)
	}
	if status == nil {
		t.Fatal("expected failed runtime status")
	}
	if status.Status != "failed" || status.Phase != "status_snapshot" {
		t.Fatalf("expected failed status_snapshot, got %#v", status)
	}
	if status.Message != "运行时状态快照读取失败" {
		t.Fatalf("expected snapshot read failure message, got %q", status.Message)
	}
	if status.Error == "" {
		t.Fatal("expected snapshot parse error to be exposed")
	}
	if _, err := os.Stat(statusPath); !os.IsNotExist(err) {
		t.Fatalf("expected corrupt runtime status file to be archived, stat err=%v", err)
	}
	archived, globErr := filepath.Glob(statusPath + ".corrupt-*")
	if globErr != nil {
		t.Fatalf("failed to glob archived runtime status: %v", globErr)
	}
	if len(archived) != 1 {
		t.Fatalf("expected one archived corrupt runtime status file, got %v", archived)
	}
}

func TestProjectRuntimeStatusPersistenceFailureIsExposed(t *testing.T) {
	rootDir := t.TempDir()
	NewProjectService(ProjectServiceOptions{
		ProjectRepo:  &stubProjectListRepo{},
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	status := setProjectRuntimeStatus(filepath.Join(t.TempDir(), "outside-root"), ProjectRuntimeStatus{
		ProjectID:       "proj_persist_failed",
		Status:          "starting",
		ContainerStatus: "starting",
		Phase:           "container",
		Message:         "正在启动开发容器",
	})

	if status.PersistenceStatus != "failed" {
		t.Fatalf("expected persistence failure status, got %#v", status)
	}
	if status.PersistenceError == "" {
		t.Fatal("expected persistence error to be exposed")
	}
	if status.UpdatedAt == "" {
		t.Fatal("expected persistence failure to update status timestamp")
	}
}

func TestProjectRuntimeStatusPersistenceSuccessIsExposed(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_persisted")
	NewProjectService(ProjectServiceOptions{
		ProjectRepo:  &stubProjectListRepo{},
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	status := setProjectRuntimeStatus(projectDir, ProjectRuntimeStatus{
		ProjectID:       "proj_persisted",
		Status:          "ready",
		ContainerStatus: "running",
		Phase:           "ready",
		Message:         "开发环境已就绪",
	})

	if status.PersistenceStatus != "persisted" {
		t.Fatalf("expected persistence success status, got %#v", status)
	}
	if status.PersistenceError != "" {
		t.Fatalf("expected empty persistence error, got %q", status.PersistenceError)
	}

	stored, err := readProjectRuntimeStatus(projectDir)
	if err != nil {
		t.Fatalf("failed to read persisted runtime status: %v", err)
	}
	if stored == nil || stored.PersistenceStatus != "persisted" {
		t.Fatalf("expected persisted marker in runtime status file, got %#v", stored)
	}
}

func TestProjectRuntimeStartFailurePersistsFailedContainerStatus(t *testing.T) {
	repo := &stubProjectListRepo{}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	status := service.persistRuntimeStartFailure(context.Background(), "proj_start_failed", ProjectRuntimeStatus{
		ProjectID:       "proj_start_failed",
		Status:          "failed",
		ContainerStatus: "running",
		Phase:           "installing",
	})

	if repo.updatedContainerProject != "proj_start_failed" || repo.updatedContainerStatus != "failed" {
		t.Fatalf("expected failed container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	if status.ContainerStatusPersistence != "updated" {
		t.Fatalf("expected updated container status persistence, got %#v", status)
	}
	if status.ContainerStatusPersistenceError != "" {
		t.Fatalf("expected empty container status persistence error, got %q", status.ContainerStatusPersistenceError)
	}
}

func TestProjectRuntimeStartFailureExposesContainerStatusPersistenceFailure(t *testing.T) {
	repo := &stubProjectListRepo{updateContainerStatusErr: errors.New("database unavailable")}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	status := service.persistRuntimeStartFailure(context.Background(), "proj_start_failed", ProjectRuntimeStatus{
		ProjectID: "proj_start_failed",
		Status:    "failed",
		Phase:     "container",
	})

	if repo.updatedContainerStatus != "failed" {
		t.Fatalf("expected failed container status update attempt, got %q", repo.updatedContainerStatus)
	}
	if status.ContainerStatus != "failed" {
		t.Fatalf("expected blank container status to default to failed, got %q", status.ContainerStatus)
	}
	if status.ContainerStatusPersistence != "failed" {
		t.Fatalf("expected failed container status persistence, got %#v", status)
	}
	if status.ContainerStatusPersistenceError != "database unavailable" {
		t.Fatalf("expected database error to be exposed, got %q", status.ContainerStatusPersistenceError)
	}
}

func TestProjectRuntimeUnavailablePersistsFailedSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_runtime_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_runtime_unavailable",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	status := service.persistRuntimeUnavailable(context.Background(), &repo.projects[0], "开发容器管理器不可用", errors.New("container manager not available"))

	if repo.updatedContainerProject != "proj_runtime_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	if status.Status != "failed" || status.ContainerStatus != "unavailable" || status.Phase != "container" {
		t.Fatalf("expected failed unavailable runtime status, got %#v", status)
	}
	if status.ContainerStatusPersistence != "updated" {
		t.Fatalf("expected updated container status persistence, got %#v", status)
	}
	if status.PersistenceStatus != "persisted" {
		t.Fatalf("expected persisted runtime status, got %#v", status)
	}
	stored, err := readProjectRuntimeStatus(projectDir)
	if err != nil {
		t.Fatalf("failed to read runtime status: %v", err)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" {
		t.Fatalf("expected persisted unavailable failed status, got %#v", stored)
	}
}

func TestProjectRuntimeUnavailableExposesContainerStatusPersistenceFailure(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_runtime_unavailable")
	repo := &stubProjectListRepo{
		updateContainerStatusErr: errors.New("database unavailable"),
		projects: []model.Project{{
			ProjectID:     "proj_runtime_unavailable",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	status := service.persistRuntimeUnavailable(context.Background(), &repo.projects[0], "开发容器管理器不可用", errors.New("container manager not available"))

	if repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update attempt, got %q", repo.updatedContainerStatus)
	}
	if status.ContainerStatusPersistence != "failed" {
		t.Fatalf("expected failed container status persistence, got %#v", status)
	}
	if status.ContainerStatusPersistenceError != "database unavailable" {
		t.Fatalf("expected database error to be exposed, got %q", status.ContainerStatusPersistenceError)
	}
	if status.PersistenceStatus != "persisted" {
		t.Fatalf("expected runtime status snapshot to persist, got %#v", status)
	}
}

func TestProjectStartContainerManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_start_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_start_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	err := service.StartProjectContainer(context.Background(), "proj_start_unavailable")

	if err == nil {
		t.Fatal("expected start container error")
	}
	if repo.updatedContainerProject != "proj_start_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "同步启动无法连接容器管理器" {
		t.Fatalf("expected start unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectEnsureContainerRunningManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_ensure_running_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_ensure_running_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.ensureProjectContainerRunning(context.Background(), &repo.projects[0])

	if err == nil {
		t.Fatal("expected ensure running error")
	}
	if repo.updatedContainerProject != "proj_ensure_running_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "容器运行状态确认无法连接容器管理器" {
		t.Fatalf("expected ensure running unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectExecuteInContainerManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_exec_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_exec_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.ExecuteInContainer(context.Background(), "proj_exec_unavailable", "npm test")

	if err == nil {
		t.Fatal("expected exec error")
	}
	if repo.updatedContainerProject != "proj_exec_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" {
		t.Fatalf("expected failed unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectTerminalManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_terminal_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_terminal_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.CreateTerminalSession(context.Background(), "proj_terminal_unavailable", 24, 80)

	if err == nil {
		t.Fatal("expected terminal error")
	}
	if repo.updatedContainerProject != "proj_terminal_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "开发终端无法连接容器管理器" {
		t.Fatalf("expected terminal unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectFileTreeManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_file_tree_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_file_tree_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.GetProjectFileTree(context.Background(), "proj_file_tree_unavailable")

	if err == nil {
		t.Fatal("expected file tree error")
	}
	if repo.updatedContainerProject != "proj_file_tree_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "文件树无法连接容器管理器" {
		t.Fatalf("expected file tree unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectReadFileManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_read_file_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_read_file_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.ReadProjectFile(context.Background(), "proj_read_file_unavailable", "src/App.tsx")

	if err == nil {
		t.Fatal("expected read file error")
	}
	if repo.updatedContainerProject != "proj_read_file_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "文件读取无法连接容器管理器" {
		t.Fatalf("expected read file unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectWriteFileManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_write_file_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_write_file_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.WriteProjectFile(context.Background(), "proj_write_file_unavailable", "src/App.tsx", "export default function App() { return null }")

	if err == nil {
		t.Fatal("expected write file error")
	}
	if repo.updatedContainerProject != "proj_write_file_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "文件保存无法连接容器管理器" {
		t.Fatalf("expected write file unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectFileOperationManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_file_operation_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_file_operation_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.PerformProjectFileOperation(context.Background(), "proj_file_operation_unavailable", "create_file", "src/App.tsx", "", "")

	if err == nil {
		t.Fatal("expected file operation error")
	}
	if repo.updatedContainerProject != "proj_file_operation_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "文件系统事务无法连接容器管理器" {
		t.Fatalf("expected file operation unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectFileTreeSyncResultHelpers(t *testing.T) {
	success := successfulProjectFileTreeSyncResult()
	if success.Status != "updated" || success.StatusLabel == "" || success.Error != "" {
		t.Fatalf("unexpected successful file tree sync result: %#v", success)
	}

	failed := failedProjectFileTreeSyncResult(errors.New("database unavailable"))
	if failed.Status != "failed" || failed.StatusLabel == "" || failed.Error != "database unavailable" || failed.ErrorSource != "project_file_tree_cache" || failed.ErrorDetails != "database unavailable" {
		t.Fatalf("unexpected failed file tree sync result: %#v", failed)
	}
}

func TestProjectGitCommitsManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_git_commits_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_git_commits_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	commits, err := service.GetProjectGitCommits(context.Background(), "proj_git_commits_unavailable")

	if err != nil {
		t.Fatalf("expected git commits to degrade to empty list, got %v", err)
	}
	if len(commits) != 0 {
		t.Fatalf("expected empty git commits when container manager unavailable, got %#v", commits)
	}
	if repo.updatedContainerProject != "proj_git_commits_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "Git 提交列表无法连接容器管理器" {
		t.Fatalf("expected git commits unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectGitRestoreManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_git_restore_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_git_restore_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	err := service.RestoreProjectGitCommit(context.Background(), "proj_git_restore_unavailable", "abcdef1")

	if err == nil {
		t.Fatal("expected git restore error")
	}
	if repo.updatedContainerProject != "proj_git_restore_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "Git 恢复无法连接容器管理器" {
		t.Fatalf("expected git restore unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectPreviewTargetManagerUnavailablePersistsRuntimeSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_preview_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:       "proj_preview_unavailable",
			AppType:         "web",
			ContainerStatus: "running",
			DirectoryPath:   projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	_, err := service.ResolveProjectPreviewTarget(context.Background(), "proj_preview_unavailable")

	if err == nil {
		t.Fatal("expected preview target error")
	}
	if repo.updatedContainerProject != "proj_preview_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "Preview 无法连接容器管理器" {
		t.Fatalf("expected preview unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectStoppedRuntimeStatusPersistsSnapshot(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_idle_stopped")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_idle_stopped",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	status := service.persistStoppedRuntimeStatus(context.Background(), "proj_idle_stopped", "开发容器因空闲超时已自动停止")

	if repo.updatedContainerProject != "proj_idle_stopped" || repo.updatedContainerStatus != "stopped" {
		t.Fatalf("expected stopped container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	if status == nil || status.Status != "stopped" || status.Phase != "stopped" {
		t.Fatalf("expected stopped runtime status, got %#v", status)
	}
	if status.ContainerStatusPersistence != "updated" {
		t.Fatalf("expected updated container status persistence, got %#v", status)
	}
	if status.PersistenceStatus != "persisted" {
		t.Fatalf("expected persisted runtime status, got %#v", status)
	}
	stored, err := readProjectRuntimeStatus(projectDir)
	if err != nil {
		t.Fatalf("failed to read stopped runtime status: %v", err)
	}
	if stored == nil || stored.Status != "stopped" || stored.Message != "开发容器因空闲超时已自动停止" {
		t.Fatalf("expected persisted stopped runtime status, got %#v", stored)
	}
}

func TestProjectStoppedRuntimeStatusExposesPersistenceFailures(t *testing.T) {
	repo := &stubProjectListRepo{updateContainerStatusErr: errors.New("database unavailable")}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	status := service.persistStoppedRuntimeStatus(context.Background(), "proj_idle_stopped", "开发容器因空闲超时已自动停止")

	if repo.updatedContainerStatus != "stopped" {
		t.Fatalf("expected stopped container status update attempt, got %q", repo.updatedContainerStatus)
	}
	if status == nil {
		t.Fatal("expected stopped runtime status")
	}
	if status.ContainerStatusPersistence != "failed" {
		t.Fatalf("expected failed container status persistence, got %#v", status)
	}
	if status.ContainerStatusPersistenceError != "database unavailable" {
		t.Fatalf("expected database error to be exposed, got %q", status.ContainerStatusPersistenceError)
	}
	if status.PersistenceStatus != "failed" || status.PersistenceError != "project not found for runtime status" {
		t.Fatalf("expected runtime status persistence failure for missing project, got %#v", status)
	}
}

func TestProjectStopContainerManagerUnavailableReturnsStructuredResult(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_stop_unavailable")
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     "proj_stop_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	result, err := service.StopProjectContainer(context.Background(), "proj_stop_unavailable")

	if err == nil {
		t.Fatal("expected stop error")
	}
	if result == nil {
		t.Fatal("expected structured stop result")
	}
	if repo.updatedContainerProject != "proj_stop_unavailable" || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	if result.StopStatus != "failed" || result.ContainerStatus != "unavailable" {
		t.Fatalf("expected failed unavailable stop result, got %#v", result)
	}
	if result.ContainerStatusPersistence != "updated" {
		t.Fatalf("expected updated container status persistence, got %#v", result)
	}
	if result.RuntimeStatus == nil || result.RuntimeStatus.Status != "failed" || result.RuntimeStatus.ContainerStatus != "unavailable" || result.RuntimeStatus.Message != "停止运行时无法连接容器管理器" {
		t.Fatalf("expected stop unavailable runtime status in result, got %#v", result.RuntimeStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read stop unavailable runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Message != "停止运行时无法连接容器管理器" {
		t.Fatalf("expected persisted stop unavailable runtime snapshot, got %#v", stored)
	}
}

func TestProjectStopContainerManagerUnavailableExposesPersistenceFailure(t *testing.T) {
	rootDir := t.TempDir()
	projectDir := filepath.Join(rootDir, "proj_stop_unavailable")
	repo := &stubProjectListRepo{
		updateContainerStatusErr: errors.New("database unavailable"),
		projects: []model.Project{{
			ProjectID:     "proj_stop_unavailable",
			AppType:       "web",
			DirectoryPath: projectDir,
		}},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: rootDir},
	})

	result, err := service.StopProjectContainer(context.Background(), "proj_stop_unavailable")

	if err == nil {
		t.Fatal("expected stop error")
	}
	if result == nil {
		t.Fatal("expected structured stop result")
	}
	if repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update attempt, got %q", repo.updatedContainerStatus)
	}
	if result.ContainerStatusPersistence != "failed" {
		t.Fatalf("expected failed container status persistence, got %#v", result)
	}
	if result.ContainerStatusPersistenceError != "database unavailable" {
		t.Fatalf("expected database error to be exposed, got %q", result.ContainerStatusPersistenceError)
	}
	if result.RuntimeStatus == nil || result.RuntimeStatus.ContainerStatusPersistence != "failed" || result.RuntimeStatus.ContainerStatusPersistenceError != "database unavailable" {
		t.Fatalf("expected runtime status to expose container status persistence failure, got %#v", result.RuntimeStatus)
	}
	if result.RuntimeStatus.PersistenceStatus != "persisted" {
		t.Fatalf("expected runtime status snapshot to persist despite DB sync failure, got %#v", result.RuntimeStatus)
	}
	stored, readErr := readProjectRuntimeStatus(projectDir)
	if readErr != nil {
		t.Fatalf("failed to read stop unavailable runtime status: %v", readErr)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.ContainerStatusPersistence != "failed" {
		t.Fatalf("expected persisted stop unavailable runtime snapshot with DB failure, got %#v", stored)
	}
}

func TestProjectCleanupResourcesDeletesEngineeringStateAndCapabilityAudits(t *testing.T) {
	stateRepo := &stubProjectCleanupStateRepo{}
	auditRepo := &stubProjectCleanupCapabilityAuditRepo{}
	resourceAlertEventRepo := &stubProjectCleanupResourceAlertEventRepo{}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{},
		EngineeringStateRepo:   stateRepo,
		CapabilityAuditRepo:    auditRepo,
		ResourceAlertEventRepo: resourceAlertEventRepo,
	})

	err := service.cleanupProjectResources(context.Background(), &model.Project{ProjectID: "proj_cleanup"})

	if err != nil {
		t.Fatalf("cleanupProjectResources returned error: %v", err)
	}
	if stateRepo.projectID != "proj_cleanup" {
		t.Fatalf("expected engineering state cleanup for project, got %q", stateRepo.projectID)
	}
	if auditRepo.projectID != "proj_cleanup" {
		t.Fatalf("expected capability audit cleanup for project, got %q", auditRepo.projectID)
	}
	if resourceAlertEventRepo.projectID != "proj_cleanup" {
		t.Fatalf("expected resource alert event cleanup for project, got %q", resourceAlertEventRepo.projectID)
	}
}

func TestProjectCleanupResourcesAggregatesEngineeringStateAndCapabilityAuditFailures(t *testing.T) {
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{},
		EngineeringStateRepo: &stubProjectCleanupStateRepo{
			err: errors.New("state delete failed"),
		},
		CapabilityAuditRepo: &stubProjectCleanupCapabilityAuditRepo{
			err: errors.New("audit delete failed"),
		},
		ResourceAlertEventRepo: &stubProjectCleanupResourceAlertEventRepo{
			err: errors.New("resource alert event delete failed"),
		},
	})

	err := service.cleanupProjectResources(context.Background(), &model.Project{ProjectID: "proj_cleanup_failed"})

	if err == nil {
		t.Fatal("expected cleanup error")
	}
	message := err.Error()
	if !strings.Contains(message, "delete engineering state: state delete failed") {
		t.Fatalf("expected engineering state cleanup failure, got %q", message)
	}
	if !strings.Contains(message, "delete capability execution audits: audit delete failed") {
		t.Fatalf("expected capability audit cleanup failure, got %q", message)
	}
	if !strings.Contains(message, "delete resource alert events: resource alert event delete failed") {
		t.Fatalf("expected resource alert event cleanup failure, got %q", message)
	}
}

func TestProjectDeletionCleanupScopeIncludesAllProjectOwnedResources(t *testing.T) {
	scope := strings.Join(ProjectDeletionCleanupScope(), ",")
	for _, resource := range []string{
		"container",
		"project_network",
		"project_directory",
		"chat_messages",
		"generated_file_metadata",
		"git_commits",
		"engineering_state",
		"capability_execution_audits",
		"resource_alert_events",
	} {
		if !strings.Contains(scope, resource) {
			t.Fatalf("expected cleanup scope to include %q, got %q", resource, scope)
		}
	}
}

func TestRestoreDeletedProjectRequiresOpenRestoreWindow(t *testing.T) {
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{
			projects: []model.Project{{
				ProjectID: "proj_restore",
				UserID:    "user_restore",
				Name:      "Restore",
			}},
		},
	})

	_, err := service.RestoreDeletedProject(context.Background(), "proj_restore", "user_restore")

	if err == nil {
		t.Fatal("expected restore to be blocked when restore window is closed")
	}
	if !strings.Contains(err.Error(), "restore window expired") {
		t.Fatalf("expected restore window error, got %v", err)
	}
}

func TestRestoreDeletedProjectRestoresByOwnerDuringOpenWindow(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID: "proj_restore",
			UserID:    "user_restore",
			Name:      "Restore",
		}},
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})
	service.deleteRestoreWindows.Store("proj_restore", time.Now().Add(ProjectDeletionRestoreWindow()))

	project, err := service.RestoreDeletedProject(context.Background(), "proj_restore", "user_restore")

	if err != nil {
		t.Fatalf("RestoreDeletedProject returned error: %v", err)
	}
	if project == nil || project.ProjectID != "proj_restore" || project.UserID != "user_restore" {
		t.Fatalf("expected restored owner project, got %#v", project)
	}
	if _, ok := service.deleteRestoreRequests.Load("proj_restore"); !ok {
		t.Fatal("expected restore request marker for background cleanup cancellation")
	}
}
