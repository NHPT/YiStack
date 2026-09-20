package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
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
	listIncludingDeletedErr  error
	listSoftDeletedErr       error
	hardDeleteErr            error
	hardDeleteErrors         []error
	hardDeleteCalls          int
	hardDeletedProject       string
	projects                 []model.Project
	createdProjects          []model.Project
	total                    int64
	updateContainerStatusErr error
	updatedContainerProject  string
	updatedContainerStatus   string
	updatedFieldsProjectID   string
	updatedFields            map[string]interface{}
	restoreMu                sync.Mutex
	softDeletedProject       string
	restoredProject          string
	restoredProjects         []string
	restoreDeletedErrors     map[string]error
	restoreByOwnerErr        error
	restoreDeletedFailures   map[string]int
	confirmedProject         *model.Project
	confirmationErr          error
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

func (r *stubProjectListRepo) ListByUserIDIncludingDeleted(_ context.Context, userID string) ([]model.Project, error) {
	if r.listIncludingDeletedErr != nil {
		return nil, r.listIncludingDeletedErr
	}
	projects := []model.Project{}
	for i := range r.projects {
		if r.projects[i].UserID == userID {
			projects = append(projects, r.projects[i])
		}
	}
	return projects, nil
}

func (r *stubProjectListRepo) ListSoftDeleted(context.Context) ([]model.Project, error) {
	if r.listSoftDeletedErr != nil {
		return nil, r.listSoftDeletedErr
	}
	r.restoreMu.Lock()
	defer r.restoreMu.Unlock()
	projects := make([]model.Project, 0)
	for i := range r.projects {
		if r.projects[i].DeletedAt != nil {
			projects = append(projects, r.projects[i])
		}
	}
	return projects, nil
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

func (r *stubProjectListRepo) SoftDelete(_ context.Context, projectID string) error {
	r.restoreMu.Lock()
	defer r.restoreMu.Unlock()
	r.softDeletedProject = projectID
	now := time.Now().UTC()
	for i := range r.projects {
		if r.projects[i].ProjectID == projectID {
			r.projects[i].DeletedAt = &now
		}
	}
	return nil
}

func (r *stubProjectListRepo) RestoreDeleted(_ context.Context, projectID string) error {
	r.restoreMu.Lock()
	defer r.restoreMu.Unlock()
	r.restoredProject = projectID
	r.restoredProjects = append(r.restoredProjects, projectID)
	if restoreErr := r.restoreDeletedErrors[projectID]; restoreErr != nil {
		if failures, controlled := r.restoreDeletedFailures[projectID]; controlled {
			if failures > 0 {
				r.restoreDeletedFailures[projectID] = failures - 1
				return restoreErr
			}
		} else {
			return restoreErr
		}
	}
	for i := range r.projects {
		if r.projects[i].ProjectID == projectID {
			r.projects[i].DeletedAt = nil
		}
	}
	return nil
}

func (r *stubProjectListRepo) RestoreDeletedByOwner(_ context.Context, projectID, userID string) (*model.Project, error) {
	r.restoreMu.Lock()
	defer r.restoreMu.Unlock()
	if r.restoreByOwnerErr != nil {
		return nil, r.restoreByOwnerErr
	}
	for i := range r.projects {
		if r.projects[i].ProjectID == projectID && r.projects[i].UserID == userID {
			r.projects[i].DeletedAt = nil
			return &r.projects[i], nil
		}
	}
	return nil, errors.New("project not found")
}

func (r *stubProjectListRepo) FindByProjectIDIncludingDeletedByOwner(
	_ context.Context,
	projectID string,
	userID string,
) (*model.Project, error) {
	if r.confirmationErr != nil {
		return nil, r.confirmationErr
	}
	if r.confirmedProject != nil {
		r.restoreMu.Lock()
		defer r.restoreMu.Unlock()
		project := *r.confirmedProject
		return &project, nil
	}
	for i := range r.projects {
		if r.projects[i].ProjectID == projectID && r.projects[i].UserID == userID {
			project := r.projects[i]
			return &project, nil
		}
	}
	return nil, errors.New("project not found")
}

func (r *stubProjectListRepo) HardDelete(_ context.Context, projectID string) error {
	r.restoreMu.Lock()
	defer r.restoreMu.Unlock()
	r.hardDeleteCalls++
	r.hardDeletedProject = projectID
	if len(r.hardDeleteErrors) > 0 {
		err := r.hardDeleteErrors[0]
		r.hardDeleteErrors = r.hardDeleteErrors[1:]
		return err
	}
	return r.hardDeleteErr
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
	projectID    string
	err          error
	deleteErrors []error
	deleteCalls  int
}

func (r *stubProjectCleanupStateRepo) UpsertSnapshot(context.Context, *model.ProjectEngineeringState) error {
	return nil
}

func (r *stubProjectCleanupStateRepo) FindByProjectID(context.Context, string) (*model.ProjectEngineeringState, error) {
	return nil, nil
}

func (r *stubProjectCleanupStateRepo) DeleteByProjectID(_ context.Context, projectID string) error {
	r.deleteCalls++
	r.projectID = projectID
	if len(r.deleteErrors) > 0 {
		err := r.deleteErrors[0]
		r.deleteErrors = r.deleteErrors[1:]
		return err
	}
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

func (r *stubProjectCleanupResourceAlertEventRepo) ClaimAction(
	context.Context,
	*model.ProjectResourceAlertActionClaim,
	*model.ProjectResourceAlertEvent,
) (bool, error) {
	return false, r.err
}

func (r *stubProjectCleanupResourceAlertEventRepo) CompleteAction(
	context.Context, string, int64, string, string, time.Time,
) error {
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

	_, err := service.CreateTerminalSession(context.Background(), "user-terminal", "proj_terminal_unavailable", 24, 80)

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

	result, err := service.StopProjectContainer(context.Background(), "proj_stop_unavailable", "stop-user")

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

	result, err := service.StopProjectContainer(context.Background(), "proj_stop_unavailable", "stop-user")

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
		"local_backup_archives",
		"remote_backup_objects",
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
	restoreState := &projectDeleteRestoreState{deadline: time.Now().Add(ProjectDeletionRestoreWindow())}
	service.deleteRestoreStates.Store("proj_restore", restoreState)

	project, err := service.RestoreDeletedProject(context.Background(), "proj_restore", "user_restore")

	if err != nil {
		t.Fatalf("RestoreDeletedProject returned error: %v", err)
	}
	if project == nil || project.ProjectID != "proj_restore" || project.UserID != "user_restore" {
		t.Fatalf("expected restored owner project, got %#v", project)
	}
	restoreState.mu.Lock()
	restoreRequested := restoreState.restoreRequested
	restoreState.mu.Unlock()
	if !restoreRequested {
		t.Fatal("expected atomic restore state to cancel background cleanup")
	}
}

func TestRestoreDeletedProjectReleasesAsyncDeletionBarrier(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: "proj_restore_barrier",
		UserID:    "user_restore_barrier",
	}}}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		LifecycleCoordinator: coordinator,
	})

	if err := service.DeleteProjectAsync(
		context.Background(),
		"proj_restore_barrier",
	); err != nil {
		t.Fatalf("DeleteProjectAsync() error = %v", err)
	}
	if _, err := service.RestoreDeletedProject(
		context.Background(),
		"proj_restore_barrier",
		"user_restore_barrier",
	); err != nil {
		t.Fatalf("RestoreDeletedProject() error = %v", err)
	}

	deadline := time.Now().Add(time.Second)
	for {
		finish, err := coordinator.acquireProjectMutation(
			"proj_restore_barrier",
		)
		if err == nil {
			finish()
			break
		}
		if !errors.Is(err, errProjectDeletionInProgress) {
			t.Fatalf("acquireProjectMutation() error = %v", err)
		}
		if time.Now().After(deadline) {
			t.Fatal("restore did not release the asynchronous deletion barrier")
		}
		time.Sleep(time.Millisecond)
	}

	if _, exists := service.deleteTasks.Load("proj_restore_barrier"); exists {
		t.Fatal("restore left the asynchronous deletion task registered")
	}
}
func TestRestoreDeletedProjectConfirmsAmbiguousRepositoryResponse(t *testing.T) {
	now := time.Now().UTC()
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID: "proj_restore_ambiguous",
			UserID:    "user_restore_ambiguous",
			DeletedAt: &now,
		}},
		restoreByOwnerErr: context.DeadlineExceeded,
		confirmedProject: &model.Project{
			ProjectID: "proj_restore_ambiguous",
			UserID:    "user_restore_ambiguous",
		},
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})
	state := &projectDeleteRestoreState{
		deadline:      time.Now().Add(ProjectDeletionRestoreWindow()),
		restoreSignal: make(chan struct{}),
	}
	service.deleteRestoreStates.Store("proj_restore_ambiguous", state)

	project, err := service.RestoreDeletedProject(
		context.Background(),
		"proj_restore_ambiguous",
		"user_restore_ambiguous",
	)
	if err != nil {
		t.Fatalf("RestoreDeletedProject() error = %v", err)
	}
	if project == nil || project.DeletedAt != nil {
		t.Fatalf("confirmed project = %#v, want active project", project)
	}
	state.mu.Lock()
	restoreRequested := state.restoreRequested
	state.mu.Unlock()
	if !restoreRequested {
		t.Fatal("ambiguous restore confirmation did not stop project cleanup")
	}
}

func TestRestoreDeletedProjectPausesCleanupWhenConfirmationIsUnavailable(t *testing.T) {
	now := time.Now().UTC()
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID: "proj_restore_uncertain",
			UserID:    "user_restore_uncertain",
			DeletedAt: &now,
		}},
		restoreByOwnerErr: context.DeadlineExceeded,
		confirmationErr:   context.DeadlineExceeded,
	}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})
	state := &projectDeleteRestoreState{
		deadline:      time.Now().Add(10 * time.Millisecond),
		restoreSignal: make(chan struct{}),
	}
	service.deleteRestoreStates.Store("proj_restore_uncertain", state)

	_, err := service.RestoreDeletedProject(
		context.Background(),
		"proj_restore_uncertain",
		"user_restore_uncertain",
	)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("RestoreDeletedProject() error = %v, want ambiguous deadline", err)
	}

	waitCtx, cancelWait := context.WithTimeout(context.Background(), 50*time.Millisecond)
	time.Sleep(20 * time.Millisecond)
	defer cancelWait()
	if restored := service.waitProjectDeletionRestoreWindow(
		waitCtx,
		"proj_restore_uncertain",
	); restored {
		t.Fatal("uncertain restore was reported as confirmed")
	}
	state.mu.Lock()
	cleanupStarted := state.cleanupStarted
	restoreUncertain := state.restoreUncertain
	state.mu.Unlock()
	if cleanupStarted || !restoreUncertain {
		t.Fatalf("uncertain restore state = cleanupStarted:%t restoreUncertain:%t", cleanupStarted, restoreUncertain)
	}

	repo.restoreMu.Lock()
	repo.restoreByOwnerErr = nil
	repo.confirmationErr = nil
	repo.restoreMu.Unlock()
	project, retryErr := service.RestoreDeletedProject(
		context.Background(),
		"proj_restore_uncertain",
		"user_restore_uncertain",
	)
	if retryErr != nil {
		t.Fatalf("RestoreDeletedProject() retry after deadline error = %v", retryErr)
	}
	if project == nil || project.DeletedAt != nil {
		t.Fatalf("retry restored project = %#v, want active project", project)
	}
	state.mu.Lock()
	restoreRequested := state.restoreRequested
	state.mu.Unlock()
	if !restoreRequested {
		t.Fatal("retry after an uncertain restore did not stop cleanup")
	}
}

func TestRestoreDeletedProjectRejectsCleanupDecisionAtomically(t *testing.T) {
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: "proj_cleanup_started",
		UserID:    "user_restore",
	}}}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})
	state := &projectDeleteRestoreState{
		deadline:       time.Now().Add(ProjectDeletionRestoreWindow()),
		cleanupStarted: true,
	}
	service.deleteRestoreStates.Store("proj_cleanup_started", state)

	_, err := service.RestoreDeletedProject(
		context.Background(),
		"proj_cleanup_started",
		"user_restore",
	)
	if err == nil || !strings.Contains(err.Error(), "cleanup already started") {
		t.Fatalf("RestoreDeletedProject() error = %v, want cleanup boundary rejection", err)
	}
	state.mu.Lock()
	restoreRequested := state.restoreRequested
	state.mu.Unlock()
	if restoreRequested {
		t.Fatal("restore request crossed the cleanup decision")
	}
}
func TestDeleteUserWithProjectResourcesRemovesActiveAndSoftDeletedLocalData(t *testing.T) {
	root := t.TempDir()
	projectRoot := filepath.Join(root, "projects")
	backupRoot := filepath.Join(root, "backups")
	targetProjectIDs := []string{"target-active", "target-soft-deleted"}
	otherProjectID := "other-user-project"
	for _, projectID := range append(targetProjectIDs, otherProjectID) {
		if err := os.MkdirAll(filepath.Join(projectRoot, projectID), 0o755); err != nil {
			t.Fatalf("create project directory: %v", err)
		}
		if err := os.WriteFile(filepath.Join(projectRoot, projectID, "app.txt"), []byte(projectID), 0o600); err != nil {
			t.Fatalf("write project file: %v", err)
		}
		if err := os.MkdirAll(filepath.Join(backupRoot, projectID), 0o755); err != nil {
			t.Fatalf("create project backup directory: %v", err)
		}
		if err := os.WriteFile(filepath.Join(backupRoot, projectID, "snapshot.tar.gz"), []byte(projectID), 0o600); err != nil {
			t.Fatalf("write project backup: %v", err)
		}
	}
	deletedAt := time.Now().UTC()
	repo := &stubProjectListRepo{projects: []model.Project{
		{
			ProjectID:     targetProjectIDs[0],
			UserID:        "target-user",
			DirectoryPath: filepath.Join(projectRoot, targetProjectIDs[0]),
		},
		{
			ProjectID: targetProjectIDs[1],
			UserID:    "target-user",
			DeletedAt: &deletedAt,
		},
		{
			ProjectID:     otherProjectID,
			UserID:        "other-user",
			DirectoryPath: filepath.Join(projectRoot, otherProjectID),
		},
	}}
	previousProjectRoot := currentProjectRootDir()
	t.Cleanup(func() {
		configureProjectRootDir(&config.ContainerConfig{ProjectDir: previousProjectRoot})
	})
	projectService := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg:   &config.ProjectConfig{BackupDir: backupRoot},
	})

	deleteCalled := false
	if err := projectService.DeleteUserWithProjectResources(
		context.Background(),
		"target-user",
		func(context.Context) error {
			deleteCalled = true
			return nil
		},
	); err != nil {
		t.Fatalf("DeleteUserWithProjectResources() error = %v", err)
	}
	if !deleteCalled {
		t.Fatal("expected database deletion callback")
	}
	for _, projectID := range targetProjectIDs {
		if _, err := os.Stat(filepath.Join(projectRoot, projectID)); !os.IsNotExist(err) {
			t.Fatalf("project directory %q still exists: %v", projectID, err)
		}
		if _, err := os.Stat(filepath.Join(backupRoot, projectID)); !os.IsNotExist(err) {
			t.Fatalf("project backup directory %q still exists: %v", projectID, err)
		}
	}
	for _, path := range []string{
		filepath.Join(projectRoot, otherProjectID, "app.txt"),
		filepath.Join(backupRoot, otherProjectID, "snapshot.tar.gz"),
	} {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("other user's data was removed at %q: %v", path, err)
		}
	}
}

func TestDeleteUserWithProjectResourcesRestoresLocalDataWhenDatabaseDeleteFails(t *testing.T) {
	root := t.TempDir()
	projectRoot := filepath.Join(root, "projects")
	backupRoot := filepath.Join(root, "backups")
	projectID := "target-project"
	projectDir := filepath.Join(projectRoot, projectID)
	projectBackupDir := filepath.Join(backupRoot, projectID)
	for path, content := range map[string]string{
		filepath.Join(projectDir, "app.txt"):               "project data",
		filepath.Join(projectBackupDir, "snapshot.tar.gz"): "backup data",
	} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("create test directory: %v", err)
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatalf("write test data: %v", err)
		}
	}

	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID:     projectID,
		UserID:        "target-user",
		DirectoryPath: projectDir,
	}}}
	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	projectService := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg:   &config.ProjectConfig{BackupDir: backupRoot},
	})
	deleteErr := errors.New("database unavailable")

	err := projectService.DeleteUserWithProjectResources(
		context.Background(),
		"target-user",
		func(context.Context) error {
			return deleteErr
		},
	)
	if !errors.Is(err, deleteErr) {
		t.Fatalf("expected database error, got %v", err)
	}
	for path, content := range map[string]string{
		filepath.Join(projectDir, "app.txt"):               "project data",
		filepath.Join(projectBackupDir, "snapshot.tar.gz"): "backup data",
	} {
		actual, readErr := os.ReadFile(path)
		if readErr != nil {
			t.Fatalf("read restored data %q: %v", path, readErr)
		}
		if string(actual) != content {
			t.Fatalf("restored data %q = %q, want %q", path, actual, content)
		}
	}
}

func TestDeleteUserWithProjectResourcesRejectsConcurrentProjectCreation(t *testing.T) {
	repo := &stubProjectListRepo{}
	projectService := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})
	deleteStarted := make(chan struct{})
	releaseDelete := make(chan struct{})
	deleteDone := make(chan error, 1)

	go func() {
		deleteDone <- projectService.DeleteUserWithProjectResources(
			context.Background(),
			"target-user",
			func(context.Context) error {
				close(deleteStarted)
				<-releaseDelete
				return nil
			},
		)
	}()
	<-deleteStarted

	createDone := make(chan error, 1)
	go func() {
		_, err := projectService.CreateProject(context.Background(), &CreateProjectRequest{
			UserID:      "target-user",
			Name:        "Concurrent project",
			Description: "must wait for deletion",
			AppType:     "web",
		})
		createDone <- err
	}()

	select {
	case err := <-createDone:
		if !errors.Is(err, errUserDeletionInProgress) {
			t.Fatalf("CreateProject() error = %v, want deletion in progress", err)
		}
	case <-time.After(time.Second):
		t.Fatal("project creation waited instead of rejecting the deletion boundary")
	}

	close(releaseDelete)
	if err := <-deleteDone; err != nil {
		t.Fatalf("DeleteUserWithProjectResources() error = %v", err)
	}
}

func TestProjectLifecycleDeletionCancelsGenerationAndRejectsNewMutation(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	releaseMutation, err := coordinator.acquireProjectMutation("target-project")
	if err != nil {
		t.Fatalf("acquireProjectMutation() error = %v", err)
	}
	generationCtx, cancelGeneration := context.WithCancel(context.Background())
	unregister := coordinator.registerGeneration("target-project", cancelGeneration)

	deletionReady := make(chan func(bool), 1)
	deletionErr := make(chan error, 1)
	go func() {
		finish, _, beginErr := coordinator.beginProjectDeletion(
			context.Background(),
			[]string{"target-project"},
		)
		if beginErr != nil {
			deletionErr <- beginErr
			return
		}
		deletionReady <- finish
	}()

	select {
	case <-generationCtx.Done():
	case <-time.After(time.Second):
		t.Fatal("administrator deletion did not cancel active generation")
	}
	unregister()
	releaseMutation()

	var finish func(bool)
	select {
	case err := <-deletionErr:
		t.Fatalf("beginProjectDeletion() error = %v", err)
	case finish = <-deletionReady:
	case <-time.After(time.Second):
		t.Fatal("administrator deletion did not wait for active mutation completion")
	}
	defer finish(false)

	if release, err := coordinator.acquireProjectMutation("target-project"); err == nil {
		release()
		t.Fatal("new project mutation was accepted during administrator deletion")
	}
}

func TestProjectLifecycleUserDeletionWaitsForAuthenticatedOperation(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	finishOperation, err := coordinator.acquireUserOperation("target-user")
	if err != nil {
		t.Fatalf("acquireUserOperation() error = %v", err)
	}

	deletionReady := make(chan func(bool), 1)
	deletionErr := make(chan error, 1)
	go func() {
		finish, beginErr := coordinator.beginUserDeletion(
			context.Background(),
			"target-user",
		)
		if beginErr != nil {
			deletionErr <- beginErr
			return
		}
		deletionReady <- finish
	}()

	select {
	case finish := <-deletionReady:
		finish(false)
		t.Fatal("user deletion crossed an active authenticated operation")
	case err := <-deletionErr:
		t.Fatalf("beginUserDeletion() error = %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	finishOperation()
	var finishDeletion func(bool)
	select {
	case finishDeletion = <-deletionReady:
	case err := <-deletionErr:
		t.Fatalf("beginUserDeletion() error = %v", err)
	case <-time.After(time.Second):
		t.Fatal("user deletion did not continue after active operation finished")
	}
	defer finishDeletion(false)

	if finish, err := coordinator.acquireUserOperation("target-user"); err == nil {
		finish()
		t.Fatal("new user operation was accepted during deletion")
	}
}

func TestProjectLifecycleUserDeletionCancelsCollaboratorActivity(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	finishUserOperation, err := coordinator.acquireUserOperation("collaborator")
	if err != nil {
		t.Fatalf("acquireUserOperation() error = %v", err)
	}
	activityCtx, cancelActivity := context.WithCancel(context.Background())
	unregister := coordinator.registerUserProjectActivity(
		"collaborator",
		"owner-project",
		cancelActivity,
		true,
	)
	finishMutation, err := coordinator.acquireProjectMutationContext(
		activityCtx,
		"owner-project",
	)
	if err != nil {
		t.Fatalf("acquireProjectMutationContext() error = %v", err)
	}

	deletionReady := make(chan func(bool), 1)
	deletionErr := make(chan error, 1)
	go func() {
		finish, beginErr := coordinator.beginUserDeletion(
			context.Background(),
			"collaborator",
		)
		if beginErr != nil {
			deletionErr <- beginErr
			return
		}
		deletionReady <- finish
	}()

	select {
	case <-activityCtx.Done():
	case <-time.After(time.Second):
		t.Fatal("user deletion did not cancel the collaborator activity")
	}
	select {
	case finish := <-deletionReady:
		finish(false)
		t.Fatal("user deletion completed before the canceled activity exited")
	case err := <-deletionErr:
		t.Fatalf("beginUserDeletion() error = %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	finishMutation()
	unregister()
	finishUserOperation()

	select {
	case finish := <-deletionReady:
		finish(false)
	case err := <-deletionErr:
		t.Fatalf("beginUserDeletion() error = %v", err)
	case <-time.After(time.Second):
		t.Fatal("user deletion did not continue after the collaborator activity exited")
	}
}

func TestProjectLifecycleUserDeletionCancelsCollaboratorQueuedMutation(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	projectService := &ProjectService{lifecycleCoordinator: coordinator}
	finishOwnerMutation, err := projectService.BeginProjectMutation("owner-project")
	if err != nil {
		t.Fatalf("BeginProjectMutation() error = %v", err)
	}
	defer finishOwnerMutation()

	operationCtx, finishUserOperation, err :=
		projectService.BeginCancellableUserProjectOperation(
			context.Background(),
			"collaborator",
		)
	if err != nil {
		t.Fatalf("BeginCancellableUserProjectOperation() error = %v", err)
	}

	queuedErr := make(chan error, 1)
	go func() {
		finish, acquireErr := projectService.BeginProjectMutationContext(
			operationCtx,
			"owner-project",
		)
		if acquireErr == nil {
			finish()
		}
		queuedErr <- acquireErr
	}()

	gate := coordinator.projectGate("owner-project")
	deadline := time.Now().Add(time.Second)
	for {
		gate.mu.Lock()
		active := gate.active
		gate.mu.Unlock()
		if active == 2 {
			break
		}
		if time.Now().After(deadline) {
			finishUserOperation()
			t.Fatal("collaborator mutation did not enter the project gate")
		}
		time.Sleep(time.Millisecond)
	}

	deletionReady := make(chan func(bool), 1)
	deletionErr := make(chan error, 1)
	go func() {
		finish, beginErr := coordinator.beginUserDeletion(
			context.Background(),
			"collaborator",
		)
		if beginErr != nil {
			deletionErr <- beginErr
			return
		}
		deletionReady <- finish
	}()

	select {
	case err := <-queuedErr:
		if !errors.Is(err, context.Canceled) {
			finishUserOperation()
			t.Fatalf("queued collaborator mutation error = %v, want context canceled", err)
		}
	case <-time.After(time.Second):
		finishUserOperation()
		t.Fatal("user deletion did not cancel the queued collaborator mutation")
	}

	select {
	case finish := <-deletionReady:
		finish(false)
		finishUserOperation()
		t.Fatal("user deletion completed before the canceled request exited")
	case err := <-deletionErr:
		finishUserOperation()
		t.Fatalf("beginUserDeletion() error = %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	finishUserOperation()
	select {
	case finish := <-deletionReady:
		finish(false)
	case err := <-deletionErr:
		t.Fatalf("beginUserDeletion() error = %v", err)
	case <-time.After(time.Second):
		t.Fatal("user deletion waited for another user's active project mutation")
	}
}

func TestProjectLifecycleDeletionCancelsQueuedMutation(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	finishFirst, err := coordinator.acquireProjectMutation("target-project")
	if err != nil {
		t.Fatalf("acquireProjectMutation() error = %v", err)
	}

	queuedCtx, cancelQueued := context.WithCancel(context.Background())
	unregisterQueued := coordinator.registerProjectActivity(
		"target-project",
		cancelQueued,
		false,
	)
	queuedErr := make(chan error, 1)
	go func() {
		finish, acquireErr := coordinator.acquireProjectMutationContext(
			queuedCtx,
			"target-project",
		)
		if acquireErr == nil {
			finish()
		}
		queuedErr <- acquireErr
	}()
	gate := coordinator.projectGate("target-project")
	deadline := time.Now().Add(time.Second)
	for {
		gate.mu.Lock()
		active := gate.active
		gate.mu.Unlock()
		if active == 2 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("queued mutation did not enter the project gate")
		}
		time.Sleep(time.Millisecond)
	}

	deletionReady := make(chan func(bool), 1)
	deletionErr := make(chan error, 1)
	go func() {
		finish, _, beginErr := coordinator.beginProjectDeletion(
			context.Background(),
			[]string{"target-project"},
		)
		if beginErr != nil {
			deletionErr <- beginErr
			return
		}
		deletionReady <- finish
	}()

	select {
	case err := <-queuedErr:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("queued mutation error = %v, want context canceled", err)
		}
	case <-time.After(time.Second):
		t.Fatal("project deletion did not cancel the queued mutation")
	}
	unregisterQueued()
	cancelQueued()

	select {
	case finish := <-deletionReady:
		finish(false)
		t.Fatal("project deletion completed before the active mutation exited")
	case err := <-deletionErr:
		t.Fatalf("beginProjectDeletion() error = %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	finishFirst()
	select {
	case finish := <-deletionReady:
		finish(false)
	case err := <-deletionErr:
		t.Fatalf("beginProjectDeletion() error = %v", err)
	case <-time.After(time.Second):
		t.Fatal("project deletion did not continue after the active mutation exited")
	}
}

func TestProjectLifecycleSerializesProjectMutations(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	finishFirst, err := coordinator.acquireProjectMutation("target-project")
	if err != nil {
		t.Fatalf("first acquireProjectMutation() error = %v", err)
	}

	secondReady := make(chan func(), 1)
	secondErr := make(chan error, 1)
	go func() {
		finish, acquireErr := coordinator.acquireProjectMutation("target-project")
		if acquireErr != nil {
			secondErr <- acquireErr
			return
		}
		secondReady <- finish
	}()

	select {
	case finish := <-secondReady:
		finish()
		t.Fatal("concurrent project mutation was not serialized")
	case err := <-secondErr:
		t.Fatalf("second acquireProjectMutation() error = %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	finishFirst()
	select {
	case finish := <-secondReady:
		finish()
	case err := <-secondErr:
		t.Fatalf("second acquireProjectMutation() error = %v", err)
	case <-time.After(time.Second):
		t.Fatal("second project mutation did not continue after the first completed")
	}
}

func TestRecoverPendingUserDeletionStagingPurgesCommittedBeforeLookupFailure(t *testing.T) {
	root := t.TempDir()
	projectRoot := filepath.Join(root, "projects")
	backupRoot := filepath.Join(root, "backups")
	committedRoots := []string{
		filepath.Join(projectRoot, projectDeletionStagingPrefix+"project"),
		filepath.Join(backupRoot, projectDeletionStagingPrefix+"backup"),
	}
	for _, stagingRoot := range committedRoots {
		if err := os.MkdirAll(filepath.Join(stagingRoot, "data"), 0o700); err != nil {
			t.Fatalf("create committed staging directory: %v", err)
		}
		if err := os.WriteFile(
			filepath.Join(stagingRoot, projectDeletionCommittedMarker),
			[]byte("committed\n"),
			0o600,
		); err != nil {
			t.Fatalf("write committed marker: %v", err)
		}
	}
	pendingRoot := filepath.Join(projectRoot, projectDeletionStagingPrefix+"pending")
	if err := os.MkdirAll(filepath.Join(pendingRoot, "data"), 0o700); err != nil {
		t.Fatalf("create pending staging directory: %v", err)
	}

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	service := NewProjectService(ProjectServiceOptions{
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg:   &config.ProjectConfig{BackupDir: backupRoot},
	})
	if err := service.RecoverPendingUserDeletionStaging(context.Background()); err == nil {
		t.Fatal("staging recovery succeeded without a project lookup repository")
	}

	for _, stagingRoot := range committedRoots {
		if _, err := os.Stat(stagingRoot); !os.IsNotExist(err) {
			t.Fatalf("committed staging directory still exists at %q: %v", stagingRoot, err)
		}
	}
	if _, err := os.Stat(pendingRoot); err != nil {
		t.Fatalf("pending staging directory must be preserved for recovery: %v", err)
	}
}

func TestRecoverPendingUserDeletionStagingReconcilesUnmarkedData(t *testing.T) {
	previousProjectRoot := currentProjectRootDir()
	t.Cleanup(func() {
		configureProjectRootDir(&config.ContainerConfig{ProjectDir: previousProjectRoot})
	})

	t.Run("restore when project row still exists", func(t *testing.T) {
		projectRoot := filepath.Join(t.TempDir(), "projects")
		projectID := "project-existing"
		projectDir := filepath.Join(projectRoot, projectID)
		if err := os.MkdirAll(projectDir, 0o755); err != nil {
			t.Fatalf("create project directory: %v", err)
		}
		if err := os.WriteFile(filepath.Join(projectDir, "app.txt"), []byte("keep"), 0o600); err != nil {
			t.Fatalf("write project data: %v", err)
		}
		staged, err := stageProjectDirectory(projectDir, "target-user", projectID, "project")
		if err != nil {
			t.Fatalf("stageProjectDirectory() error = %v", err)
		}

		service := NewProjectService(ProjectServiceOptions{
			ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
				ProjectID:     projectID,
				UserID:        "target-user",
				DirectoryPath: projectDir,
			}}},
			ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		})
		if err := service.RecoverPendingUserDeletionStaging(context.Background()); err != nil {
			t.Fatalf("RecoverPendingUserDeletionStaging() error = %v", err)
		}

		content, err := os.ReadFile(filepath.Join(projectDir, "app.txt"))
		if err != nil || string(content) != "keep" {
			t.Fatalf("pending staging was not restored: content=%q err=%v", content, err)
		}
		if _, err := os.Stat(staged.stagingRoot); !os.IsNotExist(err) {
			t.Fatalf("restored staging root still exists: %v", err)
		}
	})

	t.Run("purge when project row no longer exists", func(t *testing.T) {
		projectRoot := filepath.Join(t.TempDir(), "projects")
		projectID := "project-deleted"
		projectDir := filepath.Join(projectRoot, projectID)
		if err := os.MkdirAll(projectDir, 0o755); err != nil {
			t.Fatalf("create project directory: %v", err)
		}
		if err := os.WriteFile(filepath.Join(projectDir, "app.txt"), []byte("remove"), 0o600); err != nil {
			t.Fatalf("write project data: %v", err)
		}
		staged, err := stageProjectDirectory(projectDir, "target-user", projectID, "project")
		if err != nil {
			t.Fatalf("stageProjectDirectory() error = %v", err)
		}

		service := NewProjectService(ProjectServiceOptions{
			ProjectRepo:  &stubProjectListRepo{},
			ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		})

		if err := service.RecoverPendingUserDeletionStaging(context.Background()); err != nil {
			t.Fatalf("RecoverPendingUserDeletionStaging() error = %v", err)
		}
		if _, err := os.Stat(projectDir); !os.IsNotExist(err) {
			t.Fatalf("deleted project directory was restored: %v", err)
		}
		if _, err := os.Stat(staged.stagingRoot); !os.IsNotExist(err) {
			t.Fatalf("deleted project staging root still exists: %v", err)
		}
	})
}

func TestDeleteUserWithProjectResourcesCancelsAsyncProjectRestoreWait(t *testing.T) {
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: "async-delete-project",
		UserID:    "async-delete-user",
	}}}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	if err := service.DeleteProjectAsync(context.Background(), "async-delete-project"); err != nil {
		t.Fatalf("DeleteProjectAsync() error = %v", err)
	}

	deleteDone := make(chan error, 1)
	go func() {
		deleteDone <- service.DeleteUserWithProjectResources(
			context.Background(),
			"async-delete-user",
			func(context.Context) error { return nil },
		)
	}()

	select {
	case err := <-deleteDone:
		if err != nil {
			t.Fatalf("DeleteUserWithProjectResources() error = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("user deletion waited for the asynchronous project restore window")
	}
}

func TestProjectGitEntryHoldsMutationGate(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: "git-gated-project",
			UserID:    "git-gated-user",
		}}},
		LifecycleCoordinator: coordinator,
	})

	finishMutation, err := coordinator.acquireProjectMutation("git-gated-project")
	if err != nil {
		t.Fatalf("acquireProjectMutation() error = %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, err = service.GetProjectGitCommits(ctx, "git-gated-project")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("GetProjectGitCommits() error = %v, want mutation gate timeout", err)
	}
	finishMutation()
}

func TestProjectDeletionCancelsQueuedGitEntry(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: "git-cancel-project",
		UserID:    "git-cancel-user",
	}}}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		LifecycleCoordinator: coordinator,
	})
	finishFirst, err := coordinator.acquireProjectMutation("git-cancel-project")
	if err != nil {
		t.Fatalf("acquireProjectMutation() error = %v", err)
	}
	firstReleased := false
	defer func() {
		if !firstReleased {
			finishFirst()
		}
	}()

	gitDone := make(chan error, 1)
	go func() {
		_, gitErr := service.GetProjectGitCommits(context.Background(), "git-cancel-project")
		gitDone <- gitErr
	}()
	gate := coordinator.projectGate("git-cancel-project")
	deadline := time.Now().Add(time.Second)
	for {
		gate.mu.Lock()
		active := gate.active
		gate.mu.Unlock()
		if active == 2 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("Git request did not enter the project mutation queue")
		}
		time.Sleep(time.Millisecond)
	}

	deleteDone := make(chan error, 1)
	go func() {
		deleteDone <- service.DeleteProjectAsync(
			context.Background(),
			"git-cancel-project",
		)
	}()

	select {
	case gitErr := <-gitDone:
		if !errors.Is(gitErr, context.Canceled) {
			t.Fatalf("GetProjectGitCommits() error = %v, want context canceled", gitErr)
		}
	case <-time.After(time.Second):
		t.Fatal("project deletion did not cancel the queued Git request")
	}
	finishFirst()
	firstReleased = true
	select {
	case deleteErr := <-deleteDone:
		if deleteErr != nil {
			t.Fatalf("DeleteProjectAsync() error = %v", deleteErr)
		}
	case <-time.After(time.Second):
		t.Fatal("DeleteProjectAsync() did not finish after the active mutation exited")
	}

	if finish, mutationErr := coordinator.acquireProjectMutation("git-cancel-project"); mutationErr == nil {
		finish()
		t.Fatal("new Git mutation was accepted during asynchronous deletion")
	}

	takeoverDone := make(chan error, 1)
	go func() {
		takeoverDone <- service.DeleteUserWithProjectResources(
			context.Background(),
			"git-cancel-user",
			func(context.Context) error { return nil },
		)
	}()
	select {
	case takeoverErr := <-takeoverDone:
		if takeoverErr != nil {
			t.Fatalf("DeleteUserWithProjectResources() error = %v", takeoverErr)
		}

	case <-time.After(time.Second):
		t.Fatal("administrator deletion did not take over asynchronous cleanup")
	}
}
func TestUserDeletionRollbackRestoresTransferredAsyncProject(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: "async-rollback-project",
		UserID:    "async-rollback-user",
	}}}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		LifecycleCoordinator: coordinator,
	})

	if err := service.DeleteProjectAsync(
		context.Background(),
		"async-rollback-project",
	); err != nil {
		t.Fatalf("DeleteProjectAsync() error = %v", err)
	}
	if repo.softDeletedProject != "async-rollback-project" {
		t.Fatalf("soft-deleted project = %q", repo.softDeletedProject)
	}

	databaseErr := errors.New("database deletion failed")
	err := service.DeleteUserWithProjectResources(
		context.Background(),
		"async-rollback-user",
		func(context.Context) error { return databaseErr },
	)
	if !errors.Is(err, databaseErr) {
		t.Fatalf("DeleteUserWithProjectResources() error = %v, want %v", err, databaseErr)
	}
	if repo.restoredProject != "async-rollback-project" {
		t.Fatalf(
			"restored project = %q, want async-rollback-project",
			repo.restoredProject,
		)
	}

	finish, mutationErr := coordinator.acquireProjectMutation(
		"async-rollback-project",
	)
	if mutationErr != nil {
		t.Fatalf(
			"acquireProjectMutation() after rollback error = %v",
			mutationErr,
		)
	}
	finish()
}

func TestUserDeletionRollbackPreservesOnlyFailedProjectRestoreBarrier(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	restoreErr := errors.New("restore failed")
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ProjectID: "async-restore-success", UserID: "mixed-restore-user"},
			{ProjectID: "async-restore-failure", UserID: "mixed-restore-user"},
		},
		restoreDeletedErrors: map[string]error{
			"async-restore-failure": restoreErr,
		},
		restoreDeletedFailures: map[string]int{
			"async-restore-failure": 2,
		},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		LifecycleCoordinator: coordinator,
	})
	for _, projectID := range []string{
		"async-restore-success",
		"async-restore-failure",
	} {
		if err := service.DeleteProjectAsync(
			context.Background(),
			projectID,
		); err != nil {
			t.Fatalf("DeleteProjectAsync(%q) error = %v", projectID, err)
		}
	}

	databaseErr := errors.New("database deletion failed")
	err := service.DeleteUserWithProjectResources(
		context.Background(),
		"mixed-restore-user",
		func(context.Context) error { return databaseErr },
	)
	if !errors.Is(err, databaseErr) {
		t.Fatalf("DeleteUserWithProjectResources() error = %v, want %v", err, databaseErr)
	}

	finishSuccess, successErr := coordinator.acquireProjectMutation(
		"async-restore-success",
	)
	if successErr != nil {
		t.Fatalf("restored project barrier was not released: %v", successErr)
	}
	finishSuccess()

	finishFailure, failureErr := coordinator.acquireProjectMutation(
		"async-restore-failure",
	)
	if failureErr == nil {
		finishFailure()
		t.Fatal("failed project restore reopened the deletion barrier")
	}
	if !errors.Is(failureErr, errProjectDeletionInProgress) {
		t.Fatalf(
			"failed project restore barrier error = %v, want deletion in progress",
			failureErr,
		)
	}

	deadline := time.Now().Add(3 * time.Second)
	for {
		finishRecovered, recoveryErr := coordinator.acquireProjectMutation(
			"async-restore-failure",
		)
		if recoveryErr == nil {
			finishRecovered()
			break
		}
		if !errors.Is(recoveryErr, errProjectDeletionInProgress) {
			t.Fatalf("background recovery barrier error = %v", recoveryErr)
		}
		if time.Now().After(deadline) {
			t.Fatal("background project restore did not release the preserved barrier")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestDeleteUserUnknownOutcomeKeepsStagingUntilBackgroundConfirmation(t *testing.T) {
	projectRoot := filepath.Join(t.TempDir(), "projects")
	projectID := "unknown-delete-project"
	projectDir := filepath.Join(projectRoot, projectID)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("create project directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(projectDir, "app.txt"), []byte("project data"), 0o600); err != nil {
		t.Fatalf("write project data: %v", err)
	}

	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID:     projectID,
		UserID:        "unknown-delete-user",
		DirectoryPath: projectDir,
	}}}
	coordinator := NewProjectLifecycleCoordinator()
	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		ContainerCfg:         &config.ContainerConfig{ProjectDir: projectRoot},
		LifecycleCoordinator: coordinator,
	})

	var attempts atomic.Int32
	retryStarted := make(chan struct{})
	releaseRetry := make(chan struct{})
	err := service.DeleteUserWithProjectResources(
		context.Background(),
		"unknown-delete-user",
		func(context.Context) error {
			if attempts.Add(1) == 1 {
				return &userDeletionOutcomeUnknownError{cause: errors.New("ambiguous delete response")}
			}
			close(retryStarted)
			<-releaseRetry
			return nil
		},
	)
	if !isUserDeletionOutcomeUnknown(err) {
		t.Fatalf("DeleteUserWithProjectResources() error = %v, want unknown outcome", err)
	}

	select {
	case <-retryStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("background deletion confirmation did not start")
	}
	if _, statErr := os.Stat(projectDir); !os.IsNotExist(statErr) {
		t.Fatalf("uncertain deletion restored staged data early: %v", statErr)
	}
	if finish, gateErr := coordinator.acquireUserOperation("unknown-delete-user"); gateErr == nil {
		finish()
		t.Fatal("uncertain deletion released the user barrier")
	}
	runtimeLockAcquired := make(chan func(), 1)
	go func() {
		runtimeLockAcquired <- lockProjectRuntimeCreation([]string{projectID})
	}()
	select {
	case unlock := <-runtimeLockAcquired:
		unlock()
		t.Fatal("uncertain deletion released the runtime creation lock")
	case <-time.After(50 * time.Millisecond):
	}

	close(releaseRetry)
	select {
	case unlock := <-runtimeLockAcquired:
		unlock()
	case <-time.After(2 * time.Second):
		t.Fatal("confirmed deletion did not release the runtime creation lock")
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		matches, globErr := filepath.Glob(filepath.Join(projectRoot, projectDeletionStagingPrefix+"*"))
		if globErr != nil {
			t.Fatalf("list staging directories: %v", globErr)
		}
		if len(matches) == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("confirmed deletion left staging directories: %v", matches)
		}
		time.Sleep(10 * time.Millisecond)
	}
	if _, statErr := os.Stat(projectDir); !os.IsNotExist(statErr) {
		t.Fatalf("confirmed deletion restored local project data: %v", statErr)
	}
}

func TestProjectLifecycleRejectsTakeoverAfterDestructiveCleanupStarts(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	cleanupCtx, cancelCleanup := context.WithCancel(context.Background())
	releaseMutation, finishDeletion, markCleanupStarted, unregister, err :=
		coordinator.beginAsyncProjectDeletion(
			cleanupCtx,
			"cleanup-started-project",
			cancelCleanup,
		)
	if err != nil {
		t.Fatalf("beginAsyncProjectDeletion() error = %v", err)
	}
	defer cancelCleanup()
	defer unregister()
	defer releaseMutation()
	defer finishDeletion(false)

	if !markCleanupStarted() {
		t.Fatal("asynchronous deletion did not enter destructive cleanup")
	}
	takeoverFinish, transferred, takeoverErr := coordinator.beginProjectDeletion(
		context.Background(),
		[]string{"cleanup-started-project"},
	)
	if !errors.Is(takeoverErr, errProjectDeletionInProgress) {
		t.Fatalf("beginProjectDeletion() error = %v, want deletion in progress", takeoverErr)
	}
	if takeoverFinish != nil || len(transferred) != 0 {
		t.Fatalf("destructive cleanup was transferred: finish=%v projects=%v", takeoverFinish != nil, transferred)
	}
}

func TestAsyncProjectDeletionRetriesHardDeleteWithoutRestoringProject(t *testing.T) {
	now := time.Now().UTC()
	projectID := "async-restore-recovery"
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID: projectID,
			UserID:    "async-restore-recovery-user",
			DeletedAt: &now,
		}},
		hardDeleteErrors: []error{
			errors.New("temporary hard delete failure"),
			nil,
		},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
	})
	service.deleteRestoreStates.Store(projectID, &projectDeleteRestoreState{
		deadline:      time.Now().Add(-time.Second),
		restoreSignal: make(chan struct{}),
	})

	preserve := service.cleanupDeletedProject(
		context.Background(),
		&repo.projects[0],
		func() bool { return true },
	)
	if !preserve {
		t.Fatal("destructive cleanup did not preserve the deletion barrier")
	}
	if repo.restoredProject != "" {
		t.Fatalf("destructively cleaned project was restored as %q", repo.restoredProject)
	}
	repo.restoreMu.Lock()
	hardDeleteCalls := repo.hardDeleteCalls
	repo.restoreMu.Unlock()
	if hardDeleteCalls != 2 {
		t.Fatalf("hard delete calls = %d, want 2", hardDeleteCalls)
	}
}

func TestProjectFileReadRejectedDuringDeletion(t *testing.T) {
	coordinator := NewProjectLifecycleCoordinator()
	finishDeletion, _, err := coordinator.beginProjectDeletion(
		context.Background(),
		[]string{"file-read-deleting-project"},
	)
	if err != nil {
		t.Fatalf("beginProjectDeletion() error = %v", err)
	}
	defer finishDeletion(false)
	service := NewProjectService(ProjectServiceOptions{LifecycleCoordinator: coordinator})

	_, err = service.GetProjectFileTree(context.Background(), "file-read-deleting-project")
	if !errors.Is(err, errProjectDeletionInProgress) {
		t.Fatalf("GetProjectFileTree() error = %v, want deletion in progress", err)
	}
}

func TestRecoverPendingUserDeletionStagingReturnsLookupFailure(t *testing.T) {
	projectRoot := filepath.Join(t.TempDir(), "projects")
	projectID := "recovery-lookup-failure"
	projectDir := filepath.Join(projectRoot, projectID)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("create project directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(projectDir, "app.txt"), []byte("project data"), 0o600); err != nil {
		t.Fatalf("write project data: %v", err)
	}
	staged, err := stageProjectDirectory(
		projectDir,
		"recovery-lookup-user",
		projectID,
		"project",
	)
	if err != nil {
		t.Fatalf("stageProjectDirectory() error = %v", err)
	}
	lookupErr := errors.New("database temporarily unavailable")
	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{listIncludingDeletedErr: lookupErr},
		ContainerCfg: &config.ContainerConfig{
			ProjectDir: projectRoot,
		},
	})

	err = service.RecoverPendingUserDeletionStaging(context.Background())
	if err == nil || !strings.Contains(err.Error(), lookupErr.Error()) {
		t.Fatalf("RecoverPendingUserDeletionStaging() error = %v, want lookup failure", err)
	}
	if _, statErr := os.Stat(projectDir); !os.IsNotExist(statErr) {
		t.Fatalf("failed recovery recreated the project path: %v", statErr)
	}
	if _, statErr := os.Stat(staged.stagedPath); statErr != nil {
		t.Fatalf("failed recovery lost staged project data: %v", statErr)
	}
}

func TestDeleteUserRollbackFailureKeepsBarriersUntilStagingIsRestored(t *testing.T) {
	projectRoot := filepath.Join(t.TempDir(), "projects")
	projectID := "rollback-retry-project"
	projectDir := filepath.Join(projectRoot, projectID)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("create project directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(projectDir, "app.txt"), []byte("project data"), 0o600); err != nil {
		t.Fatalf("write project data: %v", err)
	}
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID:     projectID,
		UserID:        "rollback-retry-user",
		DirectoryPath: projectDir,
	}}}
	coordinator := NewProjectLifecycleCoordinator()
	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		ContainerCfg:         &config.ContainerConfig{ProjectDir: projectRoot},
		LifecycleCoordinator: coordinator,
	})
	databaseErr := errors.New("database deletion rejected")

	err := service.DeleteUserWithProjectResources(
		context.Background(),
		"rollback-retry-user",
		func(context.Context) error {
			if mkdirErr := os.MkdirAll(projectDir, 0o755); mkdirErr != nil {
				t.Fatalf("create rollback conflict: %v", mkdirErr)
			}
			return databaseErr
		},
	)
	if !errors.Is(err, databaseErr) || !strings.Contains(err.Error(), "restore staged project data") {
		t.Fatalf("DeleteUserWithProjectResources() error = %v, want rollback failure", err)
	}
	if finish, gateErr := coordinator.acquireUserOperation("rollback-retry-user"); gateErr == nil {
		finish()
		t.Fatal("rollback failure released the user barrier")
	}
	if finish, gateErr := coordinator.acquireProjectMutation(projectID); gateErr == nil {
		finish()
		t.Fatal("rollback failure released the project barrier")
	}
	runtimeLockAcquired := make(chan func(), 1)
	go func() {
		runtimeLockAcquired <- lockProjectRuntimeCreation([]string{projectID})
	}()
	select {
	case unlock := <-runtimeLockAcquired:
		unlock()
		t.Fatal("rollback failure released the runtime creation lock")
	case <-time.After(50 * time.Millisecond):
	}

	if err := os.RemoveAll(projectDir); err != nil {
		t.Fatalf("remove rollback conflict: %v", err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for {
		content, readErr := os.ReadFile(filepath.Join(projectDir, "app.txt"))
		if readErr == nil && string(content) == "project data" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("background rollback did not restore project data: content=%q err=%v", content, readErr)
		}
		time.Sleep(10 * time.Millisecond)
	}
	select {
	case unlock := <-runtimeLockAcquired:
		unlock()
	case <-time.After(2 * time.Second):
		t.Fatal("successful background rollback did not release the runtime lock")
	}
	finishUser, userErr := coordinator.acquireUserOperation("rollback-retry-user")
	if userErr != nil {
		t.Fatalf("successful background rollback retained the user barrier: %v", userErr)
	}
	finishUser()
}

func TestResumePendingProjectDeletionsContinuesExpiredCleanup(t *testing.T) {
	deletedAt := time.Now().Add(-ProjectDeletionRestoreWindow() - time.Second)
	projectID := "restart-expired-deletion"
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: projectID,
		UserID:    "restart-delete-user",
		DeletedAt: &deletedAt,
	}}}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	if err := service.ResumePendingProjectDeletions(context.Background()); err != nil {
		t.Fatalf("ResumePendingProjectDeletions() error = %v", err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		repo.restoreMu.Lock()
		hardDeletedProject := repo.hardDeletedProject
		repo.restoreMu.Unlock()
		if hardDeletedProject == projectID {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("expired project deletion did not resume cleanup")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestResumePendingProjectDeletionsPreservesRestoreWindow(t *testing.T) {
	deletedAt := time.Now().Add(-time.Second)
	projectID := "restart-restorable-deletion"
	userID := "restart-restore-user"
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: projectID,
		UserID:    userID,
		DeletedAt: &deletedAt,
	}}}
	coordinator := NewProjectLifecycleCoordinator()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		LifecycleCoordinator: coordinator,
	})

	if err := service.ResumePendingProjectDeletions(context.Background()); err != nil {
		t.Fatalf("ResumePendingProjectDeletions() error = %v", err)
	}
	restored, err := service.RestoreDeletedProject(context.Background(), projectID, userID)
	if err != nil {
		t.Fatalf("RestoreDeletedProject() after restart error = %v", err)
	}
	if restored == nil || restored.DeletedAt != nil {
		t.Fatalf("restored project = %#v, want active project", restored)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		finish, mutationErr := coordinator.acquireProjectMutation(projectID)
		if mutationErr == nil {
			finish()
			break
		}
		if !errors.Is(mutationErr, errProjectDeletionInProgress) {
			t.Fatalf("restored project gate error = %v", mutationErr)
		}
		if time.Now().After(deadline) {
			t.Fatal("restored project did not release resumed deletion barrier")
		}
		time.Sleep(10 * time.Millisecond)
	}
	repo.restoreMu.Lock()
	hardDeletedProject := repo.hardDeletedProject
	repo.restoreMu.Unlock()
	if hardDeletedProject != "" {
		t.Fatalf("restored project was hard deleted: %s", hardDeletedProject)
	}
}

func TestResumePendingProjectDeletionsFailsClosedOnLookupError(t *testing.T) {
	lookupErr := errors.New("database temporarily unavailable")
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{listSoftDeletedErr: lookupErr},
	})

	err := service.ResumePendingProjectDeletions(context.Background())
	if !errors.Is(err, lookupErr) {
		t.Fatalf("ResumePendingProjectDeletions() error = %v, want %v", err, lookupErr)
	}
}
