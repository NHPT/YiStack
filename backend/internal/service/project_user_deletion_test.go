package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"yistack/config"
	"yistack/internal/model"
)

const projectBackupS3CopySuccessResponse = `<?xml version="1.0" encoding="UTF-8"?>
<CopyObjectResult><ETag>"etag"</ETag></CopyObjectResult>`

func TestRollbackStagedProjectDirectoriesConvergesAfterPartialRestore(t *testing.T) {
	root := t.TempDir()
	projectDir := filepath.Join(root, "project")
	backupDir := filepath.Join(root, "backup")
	for path, content := range map[string]string{
		projectDir: "project data",
		backupDir:  "backup data",
	} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatalf("create staged source %s: %v", path, err)
		}
		if err := os.WriteFile(
			filepath.Join(path, "content.txt"),
			[]byte(content),
			0o600,
		); err != nil {
			t.Fatalf("write staged source %s: %v", path, err)
		}
	}

	projectStaged, err := stageProjectDirectory(
		projectDir,
		"partial-restore-user",
		"partial-restore-project",
		"project",
	)
	if err != nil {
		t.Fatalf("stage project directory: %v", err)
	}
	backupStaged, err := stageProjectDirectory(
		backupDir,
		"partial-restore-user",
		"partial-restore-project",
		"backup",
	)
	if err != nil {
		t.Fatalf("stage backup directory: %v", err)
	}
	staged := []stagedProjectDirectory{*projectStaged, *backupStaged}

	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		t.Fatalf("create backup restore conflict: %v", err)
	}
	if err := rollbackStagedProjectDirectories(staged); err == nil {
		t.Fatal("partial rollback unexpectedly succeeded")
	}
	projectContent, err := os.ReadFile(filepath.Join(projectDir, "content.txt"))
	if err != nil || string(projectContent) != "project data" {
		t.Fatalf(
			"partial rollback did not restore project data: content=%q err=%v",
			projectContent,
			err,
		)
	}
	if _, err := os.Stat(projectStaged.stagedPath); !os.IsNotExist(err) {
		t.Fatalf("restored project data still exists in staging: %v", err)
	}

	if err := os.RemoveAll(backupDir); err != nil {
		t.Fatalf("remove backup restore conflict: %v", err)
	}
	if err := rollbackStagedProjectDirectories(staged); err != nil {
		t.Fatalf("retry partial rollback: %v", err)
	}
	backupContent, err := os.ReadFile(filepath.Join(backupDir, "content.txt"))
	if err != nil || string(backupContent) != "backup data" {
		t.Fatalf(
			"retry did not restore backup data: content=%q err=%v",
			backupContent,
			err,
		)
	}
	for _, entry := range staged {
		if _, err := os.Stat(entry.stagingRoot); !os.IsNotExist(err) {
			t.Fatalf(
				"restored staging root still exists at %q: %v",
				entry.stagingRoot,
				err,
			)
		}
	}
}

func TestDeleteUserStagingFailureKeepsBarriersUntilDataIsRestored(t *testing.T) {
	root := t.TempDir()
	projectRoot := filepath.Join(root, "projects")
	backupRoot := filepath.Join(root, "backups")
	projectID := "staging-failure-project"
	userID := "staging-failure-user"
	projectDir := filepath.Join(projectRoot, projectID)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("create project directory: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(projectDir, "app.txt"),
		[]byte("project data"),
		0o600,
	); err != nil {
		t.Fatalf("write project data: %v", err)
	}

	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID:     projectID,
		UserID:        userID,
		DirectoryPath: projectDir,
	}}}
	coordinator := NewProjectLifecycleCoordinator()
	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		ContainerCfg:         &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg:           &config.ProjectConfig{BackupDir: backupRoot},
		LifecycleCoordinator: coordinator,
	})
	stageErr := errors.New("backup staging failed")
	deleteCalled := atomic.Bool{}
	stageDirectories := func(
		ctx context.Context,
		projects []model.Project,
	) ([]stagedProjectDirectory, error) {
		return service.stageUserProjectDirectoriesWith(
			ctx,
			projects,
			func(path, stagedUserID, stagedProjectID, kind string) (*stagedProjectDirectory, error) {
				if kind == "backup" {
					if err := os.MkdirAll(projectDir, 0o755); err != nil {
						return nil, fmt.Errorf(
							"create project restore conflict: %w",
							err,
						)
					}
					return nil, stageErr
				}
				return stageProjectDirectory(
					path,
					stagedUserID,
					stagedProjectID,
					kind,
				)
			},
		)
	}

	err := service.deleteUserWithProjectResources(
		context.Background(),
		userID,
		func(context.Context) error {
			deleteCalled.Store(true)
			return nil
		},
		stageDirectories,
	)
	if !errors.Is(err, stageErr) ||
		!strings.Contains(err.Error(), "restore staged project data") {
		t.Fatalf(
			"deleteUserWithProjectResources() error = %v, want staging rollback failure",
			err,
		)
	}
	if deleteCalled.Load() {
		t.Fatal("database deletion ran after project directory staging failed")
	}
	if finish, gateErr := coordinator.acquireUserOperation(userID); gateErr == nil {
		finish()
		t.Fatal("staging rollback failure released the user barrier")
	}
	if finish, gateErr := coordinator.acquireProjectMutation(projectID); gateErr == nil {
		finish()
		t.Fatal("staging rollback failure released the project barrier")
	}
	runtimeLockAcquired := make(chan func(), 1)
	go func() {
		runtimeLockAcquired <- lockProjectRuntimeCreation([]string{projectID})
	}()
	select {
	case unlock := <-runtimeLockAcquired:
		unlock()
		t.Fatal("staging rollback failure released the runtime creation lock")
	case <-time.After(50 * time.Millisecond):
	}

	if err := os.RemoveAll(projectDir); err != nil {
		t.Fatalf("remove project restore conflict: %v", err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for {
		content, readErr := os.ReadFile(filepath.Join(projectDir, "app.txt"))
		if readErr == nil && string(content) == "project data" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf(
				"background rollback did not restore staged project data: content=%q err=%v",
				content,
				readErr,
			)
		}
		time.Sleep(10 * time.Millisecond)
	}
	select {
	case unlock := <-runtimeLockAcquired:
		unlock()
	case <-time.After(2 * time.Second):
		t.Fatal("successful staging rollback did not release the runtime creation lock")
	}
	finishUser, userErr := coordinator.acquireUserOperation(userID)
	if userErr != nil {
		t.Fatalf("successful staging rollback retained the user barrier: %v", userErr)
	}
	finishUser()
	finishProject, projectErr := coordinator.acquireProjectMutation(projectID)
	if projectErr != nil {
		t.Fatalf("successful staging rollback retained the project barrier: %v", projectErr)
	}
	finishProject()
}

func TestCopyProjectBackupS3ObjectRejectsEmbeddedError(t *testing.T) {
	client := &projectBackupRemoteUploadHTTPClient{
		responseCodes: []int{http.StatusOK},
		responseBodies: []string{`<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>InternalError</Code><Message>copy failed</Message></Error>`},
	}
	remote := projectBackupS3RemoteConfig{
		Bucket:          "yistack-backups",
		Endpoint:        "https://s3.example.local",
		Region:          "us-east-1",
		AccessKeyID:     "access-key-for-test",
		SecretAccessKey: "secret-key-for-test",
	}
	err := copyProjectBackupS3Object(
		context.Background(),
		client,
		remote,
		"source/archive.tar.gz",
		"staging/archive.tar.gz",
	)
	if err == nil || !strings.Contains(err.Error(), "embedded error InternalError") {
		t.Fatalf("copyProjectBackupS3Object() error = %v, want embedded S3 error", err)
	}
	if len(client.requests) != 1 {
		t.Fatalf("embedded copy error triggered %d requests, want 1", len(client.requests))
	}
}

func TestCopyProjectBackupS3ObjectRequiresVisibleTarget(t *testing.T) {
	client := &projectBackupRemoteUploadHTTPClient{
		responseCodes:  []int{http.StatusOK, http.StatusNotFound},
		responseBodies: []string{projectBackupS3CopySuccessResponse},
	}
	err := copyProjectBackupS3Object(
		context.Background(),
		client,
		projectBackupS3RemoteConfig{
			Bucket: "yistack-backups", Endpoint: "https://s3.example.local",
			Region: "us-east-1", AccessKeyID: "access-key", SecretAccessKey: "secret-key",
		},
		"source/archive.tar.gz",
		"staging/archive.tar.gz",
	)
	if err == nil || !strings.Contains(err.Error(), "target is missing") {
		t.Fatalf("copyProjectBackupS3Object() error = %v, want missing target", err)
	}
}

func TestDeleteUserWithProjectResourcesBlocksDatabaseDeleteWhenRemoteBackupCleanupFails(t *testing.T) {
	root := t.TempDir()
	projectRoot := filepath.Join(root, "projects")
	backupRoot := filepath.Join(root, "backups")
	projectID := "remote-cleanup-failure-project"
	userID := "remote-cleanup-failure-user"
	projectDir := filepath.Join(projectRoot, projectID)
	backupDir := filepath.Join(backupRoot, projectID)
	for _, path := range []string{projectDir, backupDir} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatalf("create project data path: %v", err)
		}
		if err := os.WriteFile(filepath.Join(path, "data.txt"), []byte("preserve"), 0o600); err != nil {
			t.Fatalf("write project data: %v", err)
		}
	}
	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseCodes: []int{
			http.StatusOK,
			http.StatusOK,
			http.StatusOK,
			http.StatusInternalServerError,
			http.StatusOK,
			http.StatusOK,
			http.StatusOK,
			http.StatusNoContent,
		},
		responseBodies: []string{`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>tenant-a/projects/remote-cleanup-failure-project/backup-1/backup-1.tar.gz</Key><Size>100</Size></Contents>
</ListBucketResult>`, projectBackupS3CopySuccessResponse, "", "delete failed", "", projectBackupS3CopySuccessResponse},
	}
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID:     projectID,
		UserID:        userID,
		DirectoryPath: projectDir,
	}}}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})
	deleteCalled := atomic.Bool{}
	err := service.DeleteUserWithProjectResources(context.Background(), userID, func(context.Context) error {
		deleteCalled.Store(true)
		return nil
	})
	if err == nil || !strings.Contains(err.Error(), "remote delete returned status 500") {
		t.Fatalf("DeleteUserWithProjectResources() error = %v, want remote cleanup failure", err)
	}
	if deleteCalled.Load() {
		t.Fatal("database deletion ran after remote backup cleanup failed")
	}
	for _, path := range []string{projectDir, backupDir} {
		if _, err := os.Stat(filepath.Join(path, "data.txt")); err != nil {
			t.Fatalf("staged local data was not restored at %q: %v", path, err)
		}
	}
}

func TestDeleteUserWithProjectResourcesRestoresRemoteBackupsWhenDatabaseDeleteFails(t *testing.T) {
	root := t.TempDir()
	projectRoot := filepath.Join(root, "projects")
	backupRoot := filepath.Join(root, "backups")
	projectID := "remote-database-rollback-project"
	userID := "remote-database-rollback-user"
	projectDir := filepath.Join(projectRoot, projectID)
	backupDir := filepath.Join(backupRoot, projectID)
	for _, path := range []string{projectDir, backupDir} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatalf("create project data path: %v", err)
		}
		if err := os.WriteFile(
			filepath.Join(path, "data.txt"),
			[]byte("preserve"),
			0o600,
		); err != nil {
			t.Fatalf("write project data: %v", err)
		}
	}
	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	const sourceKey = "tenant-a/projects/remote-database-rollback-project/backup-1/backup-1.tar.gz"
	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseCodes: []int{
			http.StatusOK,
			http.StatusOK,
			http.StatusOK,
			http.StatusNoContent,
			http.StatusOK,
			http.StatusOK,
			http.StatusOK,
			http.StatusNoContent,
		},
		responseBodies: []string{`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>` + sourceKey + `</Key><Size>100</Size></Contents>
</ListBucketResult>`, projectBackupS3CopySuccessResponse, "", "", "", projectBackupS3CopySuccessResponse},
	}
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID:     projectID,
		UserID:        userID,
		DirectoryPath: projectDir,
	}}}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})
	databaseErr := errors.New("database delete failed")
	err := service.DeleteUserWithProjectResources(
		context.Background(),
		userID,
		func(context.Context) error { return databaseErr },
	)
	if !errors.Is(err, databaseErr) {
		t.Fatalf("DeleteUserWithProjectResources() error = %v, want database failure", err)
	}
	if len(fakeClient.requests) != 8 {
		t.Fatalf("remote request count = %d, want 8", len(fakeClient.requests))
	}
	stageCopy := fakeClient.requests[1]
	sourceDelete := fakeClient.requests[3]
	restoreCopy := fakeClient.requests[5]
	if stageCopy.method != http.MethodPut ||
		stageCopy.copySource != "/yistack-backups/"+sourceKey ||
		!strings.Contains(stageCopy.authorization, "x-amz-copy-source") ||
		sourceDelete.method != http.MethodDelete ||
		!strings.Contains(sourceDelete.url, sourceKey) {
		t.Fatalf(
			"unexpected remote staging requests: copy=%#v delete=%#v",
			stageCopy,
			sourceDelete,
		)
	}
	if restoreCopy.method != http.MethodPut ||
		!strings.Contains(restoreCopy.url, sourceKey) ||
		!strings.Contains(restoreCopy.copySource, projectRemoteDeletionKeySegment) {
		t.Fatalf("remote backup was not restored from staging: %#v", restoreCopy)
	}
	for _, path := range []string{projectDir, backupDir} {
		if _, err := os.Stat(filepath.Join(path, "data.txt")); err != nil {
			t.Fatalf("local staged data was not restored at %q: %v", path, err)
		}
	}
}

func TestAsyncProjectDeletionRetriesCleanupWithoutRestoringProject(t *testing.T) {
	now := time.Now().UTC()
	projectID := "async-cleanup-retry-project"
	cleanupErr := errors.New("temporary cleanup failure")
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: projectID,
		UserID:    "async-cleanup-retry-user",
		DeletedAt: &now,
	}}}
	stateRepo := &stubProjectCleanupStateRepo{
		deleteErrors: []error{cleanupErr, nil},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo:          repo,
		EngineeringStateRepo: stateRepo,
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
		t.Fatalf("partially cleaned project was restored as %q", repo.restoredProject)
	}
	if stateRepo.deleteCalls != 2 {
		t.Fatalf("engineering state cleanup calls = %d, want 2", stateRepo.deleteCalls)
	}
	repo.restoreMu.Lock()
	hardDeletedProject := repo.hardDeletedProject
	hardDeleteCalls := repo.hardDeleteCalls
	repo.restoreMu.Unlock()
	if hardDeletedProject != projectID || hardDeleteCalls != 1 {
		t.Fatalf(
			"hard delete result = project:%q calls:%d, want project:%q calls:1",
			hardDeletedProject,
			hardDeleteCalls,
			projectID,
		)
	}
}

func TestRecoverPendingUserDeletionStagingRejectsMissingProjectData(t *testing.T) {
	projectRoot := filepath.Join(t.TempDir(), "projects")
	projectID := "missing-staged-project"
	userID := "missing-staged-user"
	projectDir := filepath.Join(projectRoot, projectID)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("create project directory: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(projectDir, "app.txt"),
		[]byte("project data"),
		0o600,
	); err != nil {
		t.Fatalf("write project data: %v", err)
	}
	staged, err := stageProjectDirectory(projectDir, userID, projectID, "project")
	if err != nil {
		t.Fatalf("stage project directory: %v", err)
	}
	if err := os.RemoveAll(staged.stagedPath); err != nil {
		t.Fatalf("remove staged project data: %v", err)
	}

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			UserID:        userID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
	})
	err = service.RecoverPendingUserDeletionStaging(context.Background())
	if err == nil || !strings.Contains(err.Error(), "both original and staged data are missing") {
		t.Fatalf("RecoverPendingUserDeletionStaging() error = %v, want missing data failure", err)
	}
	if _, err := os.Stat(staged.stagingRoot); err != nil {
		t.Fatalf("missing-data staging evidence was removed: %v", err)
	}
}

func TestRecoverPendingUserDeletionStagingCleansAlreadyRestoredEntry(t *testing.T) {
	projectRoot := filepath.Join(t.TempDir(), "projects")
	projectID := "already-restored-project"
	userID := "already-restored-user"
	projectDir := filepath.Join(projectRoot, projectID)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("create project directory: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(projectDir, "app.txt"),
		[]byte("project data"),
		0o600,
	); err != nil {
		t.Fatalf("write project data: %v", err)
	}
	staged, err := stageProjectDirectory(projectDir, userID, projectID, "project")
	if err != nil {
		t.Fatalf("stage project directory: %v", err)
	}
	if err := os.Rename(staged.stagedPath, projectDir); err != nil {
		t.Fatalf("simulate completed staging rollback: %v", err)
	}

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			UserID:        userID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
	})
	if err := service.RecoverPendingUserDeletionStaging(context.Background()); err != nil {
		t.Fatalf("RecoverPendingUserDeletionStaging() error = %v", err)
	}
	content, err := os.ReadFile(filepath.Join(projectDir, "app.txt"))
	if err != nil || string(content) != "project data" {
		t.Fatalf("already-restored project data changed: content=%q err=%v", content, err)
	}
	if _, err := os.Stat(staged.stagingRoot); !os.IsNotExist(err) {
		t.Fatalf("already-restored staging root still exists: %v", err)
	}
}

func TestProjectRestoreNotFoundDoesNotPauseDeletion(t *testing.T) {
	projectID := "restore-owner-mismatch-project"
	ownerID := "restore-owner"
	intruderID := "restore-intruder"
	now := time.Now().UTC()
	repo := &stubProjectListRepo{projects: []model.Project{{
		ProjectID: projectID,
		UserID:    ownerID,
		DeletedAt: &now,
	}}}
	service := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})
	state := &projectDeleteRestoreState{
		deadline:      time.Now().Add(20 * time.Millisecond),
		restoreSignal: make(chan struct{}),
	}
	service.deleteRestoreStates.Store(projectID, state)

	if _, err := service.RestoreDeletedProject(
		context.Background(),
		projectID,
		intruderID,
	); err == nil {
		t.Fatal("non-owner project restore unexpectedly succeeded")
	}
	state.mu.Lock()
	restoreUncertain := state.restoreUncertain
	restoreUserID := state.restoreUserID
	state.mu.Unlock()
	if restoreUncertain || restoreUserID != "" {
		t.Fatalf(
			"non-owner restore changed uncertainty state: uncertain=%t user=%q",
			restoreUncertain,
			restoreUserID,
		)
	}

	waitCtx, cancelWait := context.WithTimeout(context.Background(), time.Second)
	defer cancelWait()
	if restored := service.waitProjectDeletionRestoreWindow(waitCtx, projectID); restored {
		t.Fatal("non-owner restore stopped project deletion cleanup")
	}
	if err := waitCtx.Err(); err != nil {
		t.Fatalf("project deletion remained paused after non-owner restore: %v", err)
	}
	state.mu.Lock()
	cleanupStarted := state.cleanupStarted
	state.mu.Unlock()
	if !cleanupStarted {
		t.Fatal("project deletion did not enter cleanup after the original deadline")
	}
}

func TestRecoverPendingUserDeletionStagingRestoresRemoteBackupObjects(t *testing.T) {
	root := t.TempDir()
	projectRoot := filepath.Join(root, "projects")
	backupRoot := filepath.Join(root, "backups")
	if err := os.MkdirAll(backupRoot, 0o755); err != nil {
		t.Fatalf("create backup root: %v", err)
	}
	controlRoot, err := os.MkdirTemp(backupRoot, projectRemoteDeletionStagingPrefix)
	if err != nil {
		t.Fatalf("create remote staging control directory: %v", err)
	}
	record := projectRemoteDeletionStagingRecord{
		SchemaVersion: projectRemoteDeletionStagingSchema,
		UserID:        "recovery-user",
		ProjectID:     "recovery-project",
		Provider:      "s3",
		Bucket:        "yistack-backups",
		Endpoint:      "https://s3.example.local",
		Region:        "us-east-1",
		Objects: []projectRemoteDeletionObject{{
			SourceKey:  "tenant-a/projects/recovery-project/backup-1/archive.tar.gz",
			StagingKey: "tenant-a/projects/.yistack-user-delete-staging/recovery-user/recovery-project/token/archive.tar.gz",
		}},
	}
	if err := writeProjectRemoteDeletionStagingRecord(controlRoot, record); err != nil {
		t.Fatalf("write remote staging record: %v", err)
	}
	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseCodes:  []int{http.StatusOK, http.StatusOK, http.StatusOK, http.StatusNoContent},
		responseBodies: []string{"", projectBackupS3CopySuccessResponse},
	}
	service := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: "recovery-project",
			UserID:    "recovery-user",
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir: backupRoot,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	if err := service.RecoverPendingUserDeletionStaging(context.Background()); err != nil {
		t.Fatalf("RecoverPendingUserDeletionStaging() error = %v", err)
	}
	if len(fakeClient.requests) != 4 ||
		fakeClient.requests[0].method != http.MethodHead ||
		fakeClient.requests[1].method != http.MethodPut ||
		fakeClient.requests[2].method != http.MethodHead ||
		fakeClient.requests[3].method != http.MethodDelete {
		t.Fatalf("unexpected remote recovery requests: %#v", fakeClient.requests)
	}
	if fakeClient.requests[1].copySource != "/yistack-backups/"+record.Objects[0].StagingKey {
		t.Fatalf("unexpected remote recovery copy source: %q", fakeClient.requests[1].copySource)
	}
	if _, err := os.Stat(controlRoot); !os.IsNotExist(err) {
		t.Fatalf("remote staging control directory was not removed: %v", err)
	}
}
