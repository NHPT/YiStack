package service

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/container"

	"gorm.io/gorm"
)

func TestGeneratedCommandOutputPreservesFailureTail(t *testing.T) {
	output := "traceback start\n" + strings.Repeat("frame\n", 900) + "NameError: name 'datetime' is not defined"
	result := generatedCommandOutput(&container.ExecResult{ExitCode: 1, Stderr: output})

	if !strings.HasPrefix(result, "traceback start") ||
		!strings.Contains(result, "... output truncated ...") ||
		!strings.HasSuffix(result, "NameError: name 'datetime' is not defined") {
		t.Fatalf("expected command output head and failure tail, got %q", result)
	}
}

type artifactFileRepoStub struct {
	files map[string]*model.ProjectFile
}

func TestGeneratorServiceReportsActiveGeneration(t *testing.T) {
	service := NewGeneratorService(GeneratorServiceOptions{})
	_, cancel := context.WithCancel(context.Background())
	defer cancel()

	service.registerActiveTask("project-active", cancel)
	if service.IsGenerationActive("project-active") != true {
		t.Fatal("expected active generation to be reported")
	}

	service.unregisterActiveTask("project-active", cancel)
	if service.IsGenerationActive("project-active") == true {
		t.Fatal("expected inactive generation after unregister")
	}
}

func (r *artifactFileRepoStub) Create(ctx context.Context, file *model.ProjectFile) error {
	if r.files == nil {
		r.files = make(map[string]*model.ProjectFile)
	}
	r.files[file.ProjectID+"\x00"+file.Path] = file
	return nil
}

func (r *artifactFileRepoStub) BatchCreate(ctx context.Context, files []model.ProjectFile) error {
	for index := range files {
		if err := r.Create(ctx, &files[index]); err != nil {
			return err
		}
	}
	return nil
}

func (r *artifactFileRepoStub) FindByProjectID(ctx context.Context, projectID string) ([]model.ProjectFile, error) {
	result := []model.ProjectFile{}
	for _, file := range r.files {
		if file.ProjectID == projectID {
			result = append(result, *file)
		}
	}
	return result, nil
}

func (r *artifactFileRepoStub) FindByPath(ctx context.Context, projectID, path string) (*model.ProjectFile, error) {
	if r.files == nil {
		return nil, gorm.ErrRecordNotFound
	}
	file, ok := r.files[projectID+"\x00"+path]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return file, nil
}

func (r *artifactFileRepoStub) Update(ctx context.Context, file *model.ProjectFile) error {
	return r.Create(ctx, file)
}

func (r *artifactFileRepoStub) DeleteByProjectID(ctx context.Context, projectID string) error {
	for key, file := range r.files {
		if file.ProjectID == projectID {
			delete(r.files, key)
		}
	}
	return nil
}

func TestEnsureRuntimeForGenerationSurfacesUnavailableStatusPersistence(t *testing.T) {
	root := t.TempDir()
	projectID := "proj_generation_unavailable"
	projectDir := filepath.Join(root, projectID)
	repo := &stubProjectListRepo{}
	service := NewGeneratorService(GeneratorServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: root},
	})

	var eventName string
	var eventPayload map[string]any
	err := service.ensureRuntimeForGeneration(context.Background(), &model.Project{
		ProjectID:     projectID,
		DirectoryPath: projectDir,
		AppType:       "web",
	}, func(name string, payload any) error {
		eventName = name
		eventPayload, _ = payload.(map[string]any)
		return nil
	})

	if err == nil {
		t.Fatal("expected runtime error")
	}
	if repo.updatedContainerProject != projectID || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	if eventName != StreamEventError {
		t.Fatalf("expected stream error event, got %q", eventName)
	}
	if eventPayload["container_status"] != "unavailable" {
		t.Fatalf("expected unavailable container status payload, got %#v", eventPayload)
	}
	if eventPayload["container_status_persistence"] != "updated" {
		t.Fatalf("expected updated persistence payload, got %#v", eventPayload)
	}
	status, ok := eventPayload["runtime_status"].(ProjectRuntimeStatus)
	if !ok {
		t.Fatalf("expected runtime status payload, got %#v", eventPayload["runtime_status"])
	}
	if status.Status != "failed" || status.ContainerStatus != "unavailable" || status.Phase != "generation" {
		t.Fatalf("expected generation unavailable runtime status, got %#v", status)
	}
	if status.PersistenceStatus != "persisted" {
		t.Fatalf("expected persisted runtime status payload, got %#v", status)
	}
	stored, err := readProjectRuntimeStatus(projectDir)
	if err != nil {
		t.Fatalf("expected runtime status snapshot to be readable: %v", err)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Phase != "generation" {
		t.Fatalf("expected persisted generation unavailable runtime snapshot, got %#v", stored)
	}
}

func TestEnsureRuntimeForGenerationSurfacesUnavailableStatusPersistenceFailure(t *testing.T) {
	repo := &stubProjectListRepo{updateContainerStatusErr: errors.New("database unavailable")}
	service := NewGeneratorService(GeneratorServiceOptions{ProjectRepo: repo})

	var eventPayload map[string]any
	err := service.ensureRuntimeForGeneration(context.Background(), &model.Project{
		ProjectID: "proj_generation_unavailable",
		AppType:   "web",
	}, func(_ string, payload any) error {
		eventPayload, _ = payload.(map[string]any)
		return nil
	})

	if err == nil {
		t.Fatal("expected runtime error")
	}
	if repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update attempt, got %q", repo.updatedContainerStatus)
	}
	if eventPayload["container_status_persistence"] != "failed" {
		t.Fatalf("expected failed persistence payload, got %#v", eventPayload)
	}
	if eventPayload["container_status_persistence_error"] != "database unavailable" {
		t.Fatalf("expected database error in payload, got %#v", eventPayload)
	}
}

func TestWriteGeneratedFilesSurfacesUnavailableStatusPersistence(t *testing.T) {
	repo := &stubProjectListRepo{}
	service := NewGeneratorService(GeneratorServiceOptions{ProjectRepo: repo})
	project := &model.Project{ProjectID: "proj_generation_artifacts_unavailable", AppType: "web"}

	eventName, eventPayload, handler := captureGenerationEvent()
	err := service.writeGeneratedFiles(context.Background(), project.ProjectID, project, []FileToGenerate{
		{Path: "src/App.tsx", Content: "export default function App() { return null }"},
	}, handler)

	assertGenerationUnavailablePayload(t, err, repo, project.ProjectID, eventName, eventPayload)
}

func TestRunGeneratedCommandsSurfacesUnavailableStatusPersistence(t *testing.T) {
	repo := &stubProjectListRepo{}
	service := NewGeneratorService(GeneratorServiceOptions{ProjectRepo: repo})
	project := &model.Project{ProjectID: "proj_generation_commands_unavailable", AppType: "web"}

	eventName, eventPayload, handler := captureGenerationEvent()
	err := service.runGeneratedCommands(context.Background(), project.ProjectID, project, []string{"npm install"}, handler)

	assertGenerationUnavailablePayload(t, err, repo, project.ProjectID, eventName, eventPayload)
}

func TestFinalizeGeneratedProjectSurfacesUnavailableStatusPersistence(t *testing.T) {
	repo := &stubProjectListRepo{}
	service := NewGeneratorService(GeneratorServiceOptions{ProjectRepo: repo})
	project := &model.Project{ProjectID: "proj_generation_finalize_unavailable", AppType: "web"}

	eventName, eventPayload, handler := captureGenerationEvent()
	err := service.finalizeGeneratedProject(context.Background(), &GenerateRequest{
		ProjectID: project.ProjectID,
		Prompt:    "Build a sample app",
	}, project, &generationResult{}, handler)

	assertGenerationUnavailablePayload(t, err, repo, project.ProjectID, eventName, eventPayload)
}

func TestPersistProjectArtifactSurfacesUnavailableStatusPersistence(t *testing.T) {
	root := t.TempDir()
	projectID := "proj_artifact_persist_unavailable"
	projectDir := filepath.Join(root, projectID)
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
			AppType:       "web",
		}},
	}
	service := NewGeneratorService(GeneratorServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: root},
	})

	err := service.PersistProjectArtifact(context.Background(), projectID, projectBootstrapStatePath, "{}")

	if err == nil {
		t.Fatal("expected artifact persistence error")
	}
	if repo.updatedContainerProject != projectID || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, err := readProjectRuntimeStatus(projectDir)
	if err != nil {
		t.Fatalf("expected artifact persistence unavailable runtime snapshot to be readable: %v", err)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Phase != "generation" {
		t.Fatalf("expected persisted artifact unavailable runtime snapshot, got %#v", stored)
	}
}

func TestPersistAndLoadProjectArtifactUseProjectFileRepository(t *testing.T) {
	projectID := "proj_artifact_record"
	fileRepo := &artifactFileRepoStub{}
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "desktop",
		}},
	}
	service := NewGeneratorService(GeneratorServiceOptions{
		ProjectRepo: repo,
		FileRepo:    fileRepo,
	})

	if err := service.PersistProjectArtifact(context.Background(), projectID, projectBootstrapStatePath, `{"status":"completed"}`); err != nil {
		t.Fatalf("expected artifact persistence via file repo, got %v", err)
	}

	content, found, err := service.LoadProjectArtifact(context.Background(), projectID, projectBootstrapStatePath)
	if err != nil {
		t.Fatalf("expected artifact load via file repo, got %v", err)
	}
	if !found || content != `{"status":"completed"}` {
		t.Fatalf("expected stored artifact content, found=%v content=%q", found, content)
	}
}

func TestLoadProjectArtifactSurfacesUnavailableStatusPersistence(t *testing.T) {
	root := t.TempDir()
	projectID := "proj_artifact_load_unavailable"
	projectDir := filepath.Join(root, projectID)
	repo := &stubProjectListRepo{
		projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
			AppType:       "web",
		}},
	}
	service := NewGeneratorService(GeneratorServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: root},
	})

	content, found, err := service.LoadProjectArtifact(context.Background(), projectID, projectBootstrapStatePath)

	if err == nil {
		t.Fatal("expected artifact load error")
	}
	if content != "" || found {
		t.Fatalf("expected empty artifact result on load failure, got content=%q found=%v", content, found)
	}
	if repo.updatedContainerProject != projectID || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, err := readProjectRuntimeStatus(projectDir)
	if err != nil {
		t.Fatalf("expected artifact load unavailable runtime snapshot to be readable: %v", err)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Phase != "generation" {
		t.Fatalf("expected persisted artifact load unavailable runtime snapshot, got %#v", stored)
	}
}

func captureGenerationEvent() (*string, *map[string]any, func(string, any) error) {
	var eventName string
	var eventPayload map[string]any
	return &eventName, &eventPayload, func(name string, payload any) error {
		eventName = name
		eventPayload, _ = payload.(map[string]any)
		return nil
	}
}

func assertGenerationUnavailablePayload(t *testing.T, err error, repo *stubProjectListRepo, projectID string, eventName *string, eventPayload *map[string]any) {
	t.Helper()
	if err == nil {
		t.Fatal("expected generation artifact error")
	}
	if repo.updatedContainerProject != projectID || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	if eventName == nil || *eventName != StreamEventError {
		t.Fatalf("expected stream error event, got %#v", eventName)
	}
	if eventPayload == nil || *eventPayload == nil {
		t.Fatal("expected stream error payload")
	}
	if (*eventPayload)["container_status"] != "unavailable" {
		t.Fatalf("expected unavailable container status payload, got %#v", *eventPayload)
	}
	if (*eventPayload)["container_status_persistence"] != "updated" {
		t.Fatalf("expected updated persistence payload, got %#v", *eventPayload)
	}
	status, ok := (*eventPayload)["runtime_status"].(ProjectRuntimeStatus)
	if !ok {
		t.Fatalf("expected runtime status payload, got %#v", *eventPayload)
	}
	if status.Status != "failed" || status.ContainerStatus != "unavailable" || status.Phase != "generation" {
		t.Fatalf("expected generation unavailable runtime status payload, got %#v", status)
	}
}
