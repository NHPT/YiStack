package service

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"

	"yistack/config"
	"yistack/internal/model"
)

func TestCreateProjectBackupWritesArchiveAndManifest(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-ok"
	projectDir := filepath.Join(projectRoot, projectID)

	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "src", "app.tsx"), "export default function App() { return null; }\n")
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "node_modules", "ignored.js"), "ignored\n")
	writeProjectBackupTestFile(t, filepath.Join(projectDir, ".yistack", "state.json"), "{}\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	result, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	if result.Status != "created" || !result.BackupCreated {
		t.Fatalf("expected created backup result, got %#v", result)
	}
	if result.ProjectID != projectID || result.BackupID == "" || result.FileName == "" || result.ManifestName == "" {
		t.Fatalf("backup result missing identity fields: %#v", result)
	}
	if result.Source != "project_host_directory" {
		t.Fatalf("manual backup should preserve project_host_directory source, got %#v", result)
	}
	if result.FileCount != 2 || result.DirectoryCount != 1 {
		t.Fatalf("expected 2 files and 1 directory, got files=%d dirs=%d", result.FileCount, result.DirectoryCount)
	}

	archivePath := filepath.Join(backupRoot, projectID, result.FileName)
	manifestPath := filepath.Join(backupRoot, projectID, result.ManifestName)
	archiveBytes, err := os.ReadFile(archivePath)
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	checksum := sha256.Sum256(archiveBytes)
	if result.ChecksumSHA256 != hex.EncodeToString(checksum[:]) {
		t.Fatalf("checksum mismatch: result=%s actual=%s", result.ChecksumSHA256, hex.EncodeToString(checksum[:]))
	}

	entries := readProjectBackupTarEntries(t, archivePath)
	if got, want := entries, []string{"README.md", "src/", "src/app.tsx"}; !equalStringSlices(got, want) {
		t.Fatalf("archive entries mismatch:\n got: %#v\nwant: %#v", got, want)
	}

	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	var manifest projectBackupManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatalf("unmarshal manifest: %v", err)
	}
	if manifest.SchemaVersion != "project_backup_manifest.v1" ||
		manifest.ProjectID != projectID ||
		manifest.BackupID != result.BackupID ||
		manifest.FileName != result.FileName ||
		manifest.ChecksumSHA256 != result.ChecksumSHA256 ||
		manifest.Source != "project_host_directory" {
		t.Fatalf("manifest does not match result: %#v result=%#v", manifest, result)
	}
	if got, want := manifest.ExcludedPaths, []string{".yistack", "node_modules"}; !equalStringSlices(got, want) {
		t.Fatalf("excluded paths mismatch:\n got: %#v\nwant: %#v", got, want)
	}
}

func TestCreateProjectBackupBlocksOversizedProject(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-too-large"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "large.txt"), "0123456789")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 3,
		},
	})

	result, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	if result.Status != "blocked" || result.BackupCreated {
		t.Fatalf("expected blocked backup result, got %#v", result)
	}
	if result.ProjectID != projectID || result.Message == "" || result.Recovery == "" {
		t.Fatalf("blocked result missing diagnostic fields: %#v", result)
	}
	if entries, err := os.ReadDir(filepath.Join(backupRoot, projectID)); err == nil && len(entries) > 0 {
		t.Fatalf("blocked backup should not publish files, found %d entries", len(entries))
	}
}

func TestCreateProjectBackupRejectsEscapedProjectDirectory(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-escape"
	escapedDir := filepath.Join(t.TempDir(), projectID)
	writeProjectBackupTestFile(t, filepath.Join(escapedDir, "file.txt"), "escape\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: escapedDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024,
		},
	})

	if _, err := projectSvc.CreateProjectBackup(context.Background(), projectID); err == nil {
		t.Fatal("expected escaped project directory to be rejected")
	}
}

func TestListProjectBackupsReadsManifestsAndFlagsMissingArchive(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-list"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	backupDir := filepath.Join(backupRoot, projectID)
	missingArchiveManifest := projectBackupManifest{
		SchemaVersion:  "project_backup_manifest.v1",
		ProjectID:      projectID,
		BackupID:       "missing-archive",
		FileName:       "missing-archive.tar.gz",
		SizeBytes:      42,
		FileCount:      1,
		DirectoryCount: 0,
		ChecksumSHA256: "abc123",
		CreatedAt:      "2099-01-01T00:00:00Z",
		Source:         "project_host_directory",
	}
	if writeManifestErr := writeProjectBackupManifest(filepath.Join(backupDir, "missing-archive.manifest.json"), missingArchiveManifest); writeManifestErr != nil {
		t.Fatalf("write missing archive manifest: %v", writeManifestErr)
	}

	result, err := projectSvc.ListProjectBackups(context.Background(), projectID)
	if err != nil {
		t.Fatalf("ListProjectBackups returned error: %v", err)
	}
	if result.Status != "ready" || result.BackupCount != 2 {
		t.Fatalf("expected ready list with 2 records, got %#v", result)
	}
	if result.Backups[0].BackupID != "missing-archive" || result.Backups[0].Status != "archive_missing" {
		t.Fatalf("expected newest missing archive record first, got %#v", result.Backups[0])
	}
	if result.Backups[1].BackupID != created.BackupID || result.Backups[1].Status != "available" {
		t.Fatalf("expected created backup to be available, got %#v", result.Backups[1])
	}
	if result.Backups[1].ManifestName != created.ManifestName ||
		result.Backups[1].FileName != created.FileName ||
		result.Backups[1].Source != "project_host_directory" {
		t.Fatalf("created backup list record does not match manifest/result: %#v created=%#v", result.Backups[1], created)
	}
}

func TestListProjectBackupsReturnsEmptyWhenDirectoryMissing(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-list-empty"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024,
		},
	})

	result, err := projectSvc.ListProjectBackups(context.Background(), projectID)
	if err != nil {
		t.Fatalf("ListProjectBackups returned error: %v", err)
	}
	if result.Status != "empty" || result.BackupCount != 0 || len(result.Backups) != 0 {
		t.Fatalf("expected empty backup list, got %#v", result)
	}
	if _, err := os.Stat(filepath.Join(backupRoot, projectID)); !os.IsNotExist(err) {
		t.Fatalf("ListProjectBackups should not create backup directory, stat err=%v", err)
	}
}

func TestProjectBackupPolicyReadinessReadyWhenAutoBackupEnabledAndBackupAvailable(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-policy-ready"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:     true,
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	readiness, err := projectSvc.GetProjectBackupPolicyReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectBackupPolicyReadiness returned error: %v", err)
	}
	if readiness.Status != "ready" || !readiness.AutoBackupEnabled || !readiness.BackupDirConfigured {
		t.Fatalf("expected ready policy readiness, got %#v", readiness)
	}
	if readiness.AvailableBackupCount != 1 || readiness.LatestAvailableBackup == nil {
		t.Fatalf("expected one latest available backup, got %#v", readiness)
	}
	if readiness.LatestAvailableBackup.BackupID != created.BackupID {
		t.Fatalf("latest backup mismatch: readiness=%#v created=%#v", readiness.LatestAvailableBackup, created)
	}
}

func TestProjectBackupPolicyReadinessDisabledWhenAutoBackupOff(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-policy-disabled"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:     false,
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	readiness, err := projectSvc.GetProjectBackupPolicyReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectBackupPolicyReadiness returned error: %v", err)
	}
	if readiness.Status != "disabled" || readiness.AutoBackupEnabled || !readiness.BackupDirConfigured {
		t.Fatalf("expected disabled policy readiness, got %#v", readiness)
	}
	if readiness.AvailableBackupCount != 0 || readiness.LatestAvailableBackup != nil {
		t.Fatalf("disabled readiness should not require backup list facts, got %#v", readiness)
	}
	if _, err := os.Stat(filepath.Join(backupRoot, projectID)); !os.IsNotExist(err) {
		t.Fatalf("disabled readiness should not create backup directory, stat err=%v", err)
	}
}

func TestProjectBackupRemoteStorageReadinessReadyWhenConfigAndBackupAvailable(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-ready"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			MaxProjectSize:          1024 * 1024,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "/tenant-a/projects/",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupRegion:      "ap-southeast-1",
			RemoteBackupCredentials: true,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	readiness, err := projectSvc.GetProjectBackupRemoteStorageReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectBackupRemoteStorageReadiness returned error: %v", err)
	}
	if readiness.Status != "ready" ||
		!readiness.RemoteBackupEnabled ||
		!readiness.ProviderConfigured ||
		!readiness.BucketConfigured ||
		!readiness.CredentialsConfigured {
		t.Fatalf("expected ready remote storage readiness, got %#v", readiness)
	}
	if readiness.Provider != "s3" ||
		readiness.Bucket != "yistack-backups" ||
		readiness.Prefix != "tenant-a/projects" ||
		readiness.Endpoint != "https://s3.example.local" ||
		readiness.Region != "ap-southeast-1" {
		t.Fatalf("remote storage readiness should expose non-secret config facts, got %#v", readiness)
	}
	if readiness.AvailableBackupCount != 1 ||
		readiness.LatestAvailableBackup == nil ||
		readiness.LatestAvailableBackup.BackupID != created.BackupID {
		t.Fatalf("expected latest available backup in readiness, got %#v created=%#v", readiness, created)
	}
}

func TestProjectBackupRemoteStorageReadinessDisabledDoesNotReadBackupDirectory(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-disabled"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			MaxProjectSize:          1024 * 1024,
			RemoteBackupEnabled:     false,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupCredentials: true,
		},
	})

	readiness, err := projectSvc.GetProjectBackupRemoteStorageReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectBackupRemoteStorageReadiness returned error: %v", err)
	}
	if readiness.Status != "disabled" || readiness.RemoteBackupEnabled {
		t.Fatalf("expected disabled remote storage readiness, got %#v", readiness)
	}
	if readiness.AvailableBackupCount != 0 || readiness.LatestAvailableBackup != nil {
		t.Fatalf("disabled remote storage readiness should not require local backup facts, got %#v", readiness)
	}
	if _, err := os.Stat(filepath.Join(backupRoot, projectID)); !os.IsNotExist(err) {
		t.Fatalf("disabled remote storage readiness should not create backup directory, stat err=%v", err)
	}
}

func TestProjectBackupRemoteStorageReadinessBlocksWhenBucketMissing(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-no-bucket"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			MaxProjectSize:          1024 * 1024,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "  ",
			RemoteBackupCredentials: true,
		},
	})

	readiness, err := projectSvc.GetProjectBackupRemoteStorageReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectBackupRemoteStorageReadiness returned error: %v", err)
	}
	if readiness.Status != "blocked" || readiness.BucketConfigured {
		t.Fatalf("expected missing bucket to block remote storage readiness, got %#v", readiness)
	}
	if _, err := os.Stat(filepath.Join(backupRoot, projectID)); !os.IsNotExist(err) {
		t.Fatalf("blocked remote storage readiness should not create backup directory, stat err=%v", err)
	}
}

func TestProjectBackupRemoteStorageReadinessEmptyWhenNoLocalBackups(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-empty"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			MaxProjectSize:          1024 * 1024,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupCredentials: true,
		},
	})

	readiness, err := projectSvc.GetProjectBackupRemoteStorageReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectBackupRemoteStorageReadiness returned error: %v", err)
	}
	if readiness.Status != "empty" || readiness.AvailableBackupCount != 0 || readiness.LatestAvailableBackup != nil {
		t.Fatalf("expected empty readiness when config is ready but no local backups exist, got %#v", readiness)
	}
	if _, err := os.Stat(filepath.Join(backupRoot, projectID)); !os.IsNotExist(err) {
		t.Fatalf("empty remote storage readiness should not create backup directory, stat err=%v", err)
	}
}

func TestUploadProjectBackupToRemoteStorageUploadsArchiveAndManifest(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-upload"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote upload\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	fakeClient := &projectBackupRemoteUploadHTTPClient{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			MaxProjectSize:          1024 * 1024,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupRegion:      "ap-southeast-1",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	backup, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	result, err := projectSvc.UploadProjectBackupToRemoteStorage(context.Background(), projectID, backup.BackupID)
	if err != nil {
		t.Fatalf("UploadProjectBackupToRemoteStorage returned error: %v", err)
	}
	if result.Status != "uploaded" || !result.Uploaded || !result.ChecksumVerified {
		t.Fatalf("expected uploaded result, got %#v", result)
	}
	if result.ArchiveObjectKey != "tenant-a/projects/"+projectID+"/"+backup.BackupID+"/"+backup.FileName {
		t.Fatalf("unexpected archive object key: %#v", result)
	}
	if result.ManifestObjectKey != "tenant-a/projects/"+projectID+"/"+backup.BackupID+"/"+backup.ManifestName {
		t.Fatalf("unexpected manifest object key: %#v", result)
	}
	if len(fakeClient.requests) != 2 {
		t.Fatalf("expected archive and manifest uploads, got %d requests", len(fakeClient.requests))
	}
	if fakeClient.requests[0].method != http.MethodPut || fakeClient.requests[1].method != http.MethodPut {
		t.Fatalf("remote upload should use PUT requests, got %#v", fakeClient.requests)
	}
	if !strings.Contains(fakeClient.requests[0].url, "/yistack-backups/tenant-a/projects/"+projectID+"/"+backup.BackupID+"/"+backup.FileName) ||
		!strings.Contains(fakeClient.requests[1].url, "/yistack-backups/tenant-a/projects/"+projectID+"/"+backup.BackupID+"/"+backup.ManifestName) {
		t.Fatalf("remote upload URLs did not include bucket and object keys: %#v", fakeClient.requests)
	}
	if fakeClient.requests[0].authorization == "" || fakeClient.requests[1].authorization == "" {
		t.Fatalf("remote upload requests should be signed, got %#v", fakeClient.requests)
	}
	if int64(len(fakeClient.requests[1].body)) != result.ManifestSizeBytes {
		t.Fatalf("manifest size mismatch: result=%d body=%d", result.ManifestSizeBytes, len(fakeClient.requests[1].body))
	}
}

func TestUploadProjectBackupToRemoteStorageBlockedDoesNotCallRemote(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-upload-blocked"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote upload blocked\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	fakeClient := &projectBackupRemoteUploadHTTPClient{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			MaxProjectSize:          1024 * 1024,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	backup, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	result, err := projectSvc.UploadProjectBackupToRemoteStorage(context.Background(), projectID, backup.BackupID)
	if err != nil {
		t.Fatalf("UploadProjectBackupToRemoteStorage returned error: %v", err)
	}
	if result.Status != "blocked" || result.Uploaded {
		t.Fatalf("expected blocked remote upload result, got %#v", result)
	}
	if len(fakeClient.requests) != 0 {
		t.Fatalf("blocked remote upload should not call remote storage, got %#v", fakeClient.requests)
	}
}

func TestListProjectBackupRemoteInventoryListsCompleteAndPartialCandidates(t *testing.T) {
	projectRoot := t.TempDir()
	projectID := "project-backup-remote-inventory"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote inventory\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseBodies: []string{`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>tenant-a/projects/project-backup-remote-inventory/backup-complete/backup-complete.tar.gz</Key>
    <LastModified>2026-07-16T10:00:00Z</LastModified>
    <Size>120</Size>
  </Contents>
  <Contents>
    <Key>tenant-a/projects/project-backup-remote-inventory/backup-complete/backup-complete.manifest.json</Key>
    <LastModified>2026-07-16T10:00:01Z</LastModified>
    <Size>64</Size>
  </Contents>
  <Contents>
    <Key>tenant-a/projects/project-backup-remote-inventory/backup-archive-only/backup-archive-only.tar.gz</Key>
    <LastModified>2026-07-16T09:00:00Z</LastModified>
    <Size>88</Size>
  </Contents>
  <Contents>
    <Key>tenant-a/projects/project-backup-remote-inventory/backup-ignored/notes.txt</Key>
    <LastModified>2026-07-16T08:00:00Z</LastModified>
    <Size>12</Size>
  </Contents>
</ListBucketResult>`},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupRegion:      "ap-southeast-1",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	result, err := projectSvc.ListProjectBackupRemoteInventory(context.Background(), projectID)
	if err != nil {
		t.Fatalf("ListProjectBackupRemoteInventory returned error: %v", err)
	}
	if result.Status != "ready" || result.ObjectCount != 4 || result.CandidateCount != 2 || result.CompleteCount != 1 {
		t.Fatalf("unexpected remote inventory result: %#v", result)
	}
	if len(fakeClient.requests) != 1 || fakeClient.requests[0].method != http.MethodGet {
		t.Fatalf("remote inventory should make one signed GET request, got %#v", fakeClient.requests)
	}
	if !strings.Contains(fakeClient.requests[0].url, "list-type=2") || !strings.Contains(fakeClient.requests[0].url, "prefix=tenant-a%2Fprojects%2F"+projectID+"%2F") {
		t.Fatalf("remote inventory request should use ListObjectsV2 with project prefix, got %s", fakeClient.requests[0].url)
	}
	if fakeClient.requests[0].authorization == "" {
		t.Fatalf("remote inventory request should be signed, got %#v", fakeClient.requests[0])
	}
	if result.Candidates[0].Status != "complete" || result.Candidates[0].BackupID != "backup-complete" {
		t.Fatalf("expected complete backup first, got %#v", result.Candidates)
	}
	if result.Candidates[1].Status != "archive_only" || result.Candidates[1].ManifestObjectKey != "" {
		t.Fatalf("expected archive_only partial candidate second, got %#v", result.Candidates)
	}
}

func TestListProjectBackupRemoteInventoryBlockedDoesNotCallRemote(t *testing.T) {
	projectRoot := t.TempDir()
	projectID := "project-backup-remote-inventory-blocked"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote inventory blocked\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	fakeClient := &projectBackupRemoteUploadHTTPClient{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	result, err := projectSvc.ListProjectBackupRemoteInventory(context.Background(), projectID)
	if err != nil {
		t.Fatalf("ListProjectBackupRemoteInventory returned error: %v", err)
	}
	if result.Status != "blocked" || result.CandidateCount != 0 {
		t.Fatalf("expected blocked remote inventory result, got %#v", result)
	}
	if len(fakeClient.requests) != 0 {
		t.Fatalf("blocked remote inventory should not call remote storage, got %#v", fakeClient.requests)
	}
}

func TestDownloadProjectBackupFromRemoteStorageImportsCompleteCandidate(t *testing.T) {
	projectRoot := t.TempDir()
	sourceBackupRoot := t.TempDir()
	importBackupRoot := t.TempDir()
	projectID := "project-backup-remote-download"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote download\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	createSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      sourceBackupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})
	backup, err := createSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	archiveBytes, err := os.ReadFile(filepath.Join(sourceBackupRoot, projectID, backup.FileName))
	if err != nil {
		t.Fatalf("read source archive: %v", err)
	}
	manifestBytes, err := os.ReadFile(filepath.Join(sourceBackupRoot, projectID, backup.ManifestName))
	if err != nil {
		t.Fatalf("read source manifest: %v", err)
	}

	archiveObjectKey := "tenant-a/projects/" + projectID + "/" + backup.BackupID + "/" + backup.FileName
	manifestObjectKey := "tenant-a/projects/" + projectID + "/" + backup.BackupID + "/" + backup.ManifestName
	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseBodies: []string{
			`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>` + archiveObjectKey + `</Key>
    <LastModified>2026-07-16T10:00:00Z</LastModified>
    <Size>` + strconv.FormatInt(backup.SizeBytes, 10) + `</Size>
  </Contents>
  <Contents>
    <Key>` + manifestObjectKey + `</Key>
    <LastModified>2026-07-16T10:00:01Z</LastModified>
    <Size>` + strconv.Itoa(len(manifestBytes)) + `</Size>
  </Contents>
</ListBucketResult>`,
			string(manifestBytes),
			string(archiveBytes),
		},
	}
	downloadSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               importBackupRoot,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupRegion:      "ap-southeast-1",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	result, err := downloadSvc.DownloadProjectBackupFromRemoteStorage(context.Background(), projectID, backup.BackupID)
	if err != nil {
		t.Fatalf("DownloadProjectBackupFromRemoteStorage returned error: %v", err)
	}
	if result.Status != "downloaded" || !result.Downloaded || !result.ChecksumVerified {
		t.Fatalf("expected downloaded result, got %#v", result)
	}
	if len(fakeClient.requests) != 3 ||
		fakeClient.requests[0].method != http.MethodGet ||
		fakeClient.requests[1].method != http.MethodGet ||
		fakeClient.requests[2].method != http.MethodGet {
		t.Fatalf("remote download should list inventory then GET manifest and archive, got %#v", fakeClient.requests)
	}
	for _, request := range fakeClient.requests {
		if request.authorization == "" {
			t.Fatalf("remote download request should be signed, got %#v", request)
		}
	}
	download, err := downloadSvc.PrepareProjectBackupDownload(context.Background(), projectID, backup.BackupID)
	if err != nil {
		t.Fatalf("imported remote backup should be available for local download: %v", err)
	}
	if download.ChecksumSHA256 != backup.ChecksumSHA256 || download.SizeBytes != backup.SizeBytes {
		t.Fatalf("imported backup facts mismatch: download=%#v backup=%#v", download, backup)
	}
}

func TestDownloadProjectBackupFromRemoteStorageBlocksExistingLocalBackup(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-download-existing"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote download existing\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})
	backup, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	manifestBytes, err := os.ReadFile(filepath.Join(backupRoot, projectID, backup.ManifestName))
	if err != nil {
		t.Fatalf("read source manifest: %v", err)
	}

	archiveObjectKey := "tenant-a/projects/" + projectID + "/" + backup.BackupID + "/" + backup.FileName
	manifestObjectKey := "tenant-a/projects/" + projectID + "/" + backup.BackupID + "/" + backup.ManifestName
	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseBodies: []string{
			`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>` + archiveObjectKey + `</Key>
    <LastModified>2026-07-16T10:00:00Z</LastModified>
    <Size>` + strconv.FormatInt(backup.SizeBytes, 10) + `</Size>
  </Contents>
  <Contents>
    <Key>` + manifestObjectKey + `</Key>
    <LastModified>2026-07-16T10:00:01Z</LastModified>
    <Size>` + strconv.Itoa(len(manifestBytes)) + `</Size>
  </Contents>
</ListBucketResult>`,
			string(manifestBytes),
		},
	}
	downloadSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupRegion:      "ap-southeast-1",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	result, err := downloadSvc.DownloadProjectBackupFromRemoteStorage(context.Background(), projectID, backup.BackupID)
	if err != nil {
		t.Fatalf("DownloadProjectBackupFromRemoteStorage returned error: %v", err)
	}
	if result.Status != "blocked" || result.Downloaded {
		t.Fatalf("expected blocked remote download result for existing local backup, got %#v", result)
	}
	if len(fakeClient.requests) != 2 {
		t.Fatalf("existing local backup should list inventory and download manifest only, got %#v", fakeClient.requests)
	}
	if _, downloadErr := downloadSvc.PrepareProjectBackupDownload(context.Background(), projectID, backup.BackupID); downloadErr != nil {
		t.Fatalf("existing local backup should remain available after blocked remote download: %v", downloadErr)
	}
}

func TestDownloadProjectBackupFromRemoteStorageBlocksPartialCandidate(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-remote-download-partial"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote download blocked\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseBodies: []string{`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>tenant-a/projects/project-backup-remote-download-partial/backup-partial/backup-partial.tar.gz</Key>
    <LastModified>2026-07-16T10:00:00Z</LastModified>
    <Size>120</Size>
  </Contents>
</ListBucketResult>`},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               backupRoot,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupRegion:      "ap-southeast-1",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	result, err := projectSvc.DownloadProjectBackupFromRemoteStorage(context.Background(), projectID, "backup-partial")
	if err != nil {
		t.Fatalf("DownloadProjectBackupFromRemoteStorage returned error: %v", err)
	}
	if result.Status != "blocked" || result.Downloaded {
		t.Fatalf("expected blocked remote download result, got %#v", result)
	}
	if len(fakeClient.requests) != 1 {
		t.Fatalf("partial remote candidate should only list inventory, got %#v", fakeClient.requests)
	}
}

func TestRestoreProjectBackupFromRemoteStorageImportsAndRestoresCompleteCandidate(t *testing.T) {
	projectRoot := t.TempDir()
	sourceBackupRoot := t.TempDir()
	restoreBackupRoot := t.TempDir()
	projectID := "project-backup-remote-restore"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote restore\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	createSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      sourceBackupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})
	backup, err := createSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	archiveBytes, err := os.ReadFile(filepath.Join(sourceBackupRoot, projectID, backup.FileName))
	if err != nil {
		t.Fatalf("read source archive: %v", err)
	}
	manifestBytes, err := os.ReadFile(filepath.Join(sourceBackupRoot, projectID, backup.ManifestName))
	if err != nil {
		t.Fatalf("read source manifest: %v", err)
	}
	if removeErr := os.RemoveAll(projectDir); removeErr != nil {
		t.Fatalf("clear target project directory: %v", removeErr)
	}
	if mkdirErr := os.MkdirAll(projectDir, 0o755); mkdirErr != nil {
		t.Fatalf("recreate empty target project directory: %v", mkdirErr)
	}

	archiveObjectKey := "tenant-a/projects/" + projectID + "/" + backup.BackupID + "/" + backup.FileName
	manifestObjectKey := "tenant-a/projects/" + projectID + "/" + backup.BackupID + "/" + backup.ManifestName
	fakeClient := &projectBackupRemoteUploadHTTPClient{
		responseBodies: []string{
			`<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>` + archiveObjectKey + `</Key>
    <LastModified>2026-07-16T10:00:00Z</LastModified>
    <Size>` + strconv.FormatInt(backup.SizeBytes, 10) + `</Size>
  </Contents>
  <Contents>
    <Key>` + manifestObjectKey + `</Key>
    <LastModified>2026-07-16T10:00:01Z</LastModified>
    <Size>` + strconv.Itoa(len(manifestBytes)) + `</Size>
  </Contents>
</ListBucketResult>`,
			string(manifestBytes),
			string(archiveBytes),
		},
	}
	restoreSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               restoreBackupRoot,
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupPrefix:      "tenant-a/projects",
			RemoteBackupEndpoint:    "https://s3.example.local",
			RemoteBackupRegion:      "ap-southeast-1",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	result, err := restoreSvc.RestoreProjectBackupFromRemoteStorage(context.Background(), projectID, backup.BackupID, true)
	if err != nil {
		t.Fatalf("RestoreProjectBackupFromRemoteStorage returned error: %v", err)
	}
	if result.Status != "restored" || !result.Downloaded || !result.Restored || result.DownloadStatus != "downloaded" || result.RestoreStatus != "restored" {
		t.Fatalf("expected restored remote restore result, got %#v", result)
	}
	if len(fakeClient.requests) != 3 {
		t.Fatalf("remote restore should list inventory then GET manifest and archive once, got %#v", fakeClient.requests)
	}
	restoredBytes, err := os.ReadFile(filepath.Join(projectDir, "README.md"))
	if err != nil {
		t.Fatalf("read restored file: %v", err)
	}
	if string(restoredBytes) != "hello remote restore\n" {
		t.Fatalf("restored file content mismatch: %q", string(restoredBytes))
	}
}

func TestRestoreProjectBackupFromRemoteStorageBlocksWithoutExplicitConfirmation(t *testing.T) {
	projectRoot := t.TempDir()
	projectID := "project-backup-remote-restore-confirm"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello remote restore confirm\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	fakeClient := &projectBackupRemoteUploadHTTPClient{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:               t.TempDir(),
			RemoteBackupEnabled:     true,
			RemoteBackupProvider:    "s3",
			RemoteBackupBucket:      "yistack-backups",
			RemoteBackupCredentials: true,
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			RemoteBackupAccessKeyID:     "access-key-for-test",
			RemoteBackupSecretAccessKey: "secret-key-for-test",
		},
		BackupRemoteHTTPClient: fakeClient,
	})

	result, err := projectSvc.RestoreProjectBackupFromRemoteStorage(context.Background(), projectID, "backup-confirm", false)
	if err != nil {
		t.Fatalf("RestoreProjectBackupFromRemoteStorage returned error: %v", err)
	}
	if result.Status != "blocked" || result.Downloaded || result.Restored {
		t.Fatalf("expected blocked remote restore result without confirmation, got %#v", result)
	}
	if len(fakeClient.requests) != 0 {
		t.Fatalf("remote restore without confirmation should not call remote storage, got %#v", fakeClient.requests)
	}
}

func TestRunProjectAutomaticBackupCreatesAutomaticPolicySource(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-auto-run"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello automatic backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:     true,
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	result, err := projectSvc.RunProjectAutomaticBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("RunProjectAutomaticBackup returned error: %v", err)
	}
	if result.Status != "created" || !result.BackupCreated || result.Source != "automatic_policy" {
		t.Fatalf("expected created automatic_policy backup result, got %#v", result)
	}
	if result.FileName == "" || result.ManifestName == "" || result.ChecksumSHA256 == "" {
		t.Fatalf("automatic backup result missing archive facts: %#v", result)
	}

	manifestBytes, err := os.ReadFile(filepath.Join(backupRoot, projectID, result.ManifestName))
	if err != nil {
		t.Fatalf("read automatic backup manifest: %v", err)
	}
	var manifest projectBackupManifest
	if unmarshalErr := json.Unmarshal(manifestBytes, &manifest); unmarshalErr != nil {
		t.Fatalf("unmarshal automatic backup manifest: %v", unmarshalErr)
	}
	if manifest.Source != "automatic_policy" ||
		manifest.ProjectID != projectID ||
		manifest.BackupID != result.BackupID ||
		manifest.FileName != result.FileName ||
		manifest.ChecksumSHA256 != result.ChecksumSHA256 {
		t.Fatalf("automatic backup manifest does not match result: %#v result=%#v", manifest, result)
	}

	backupList, listErr := projectSvc.ListProjectBackups(context.Background(), projectID)
	if listErr != nil {
		t.Fatalf("ListProjectBackups returned error after automatic backup: %v", listErr)
	}
	if backupList.Status != "ready" ||
		len(backupList.Backups) != 1 ||
		backupList.Backups[0].Status != "available" ||
		backupList.Backups[0].Source != "automatic_policy" {
		t.Fatalf("automatic backup should be listed as an available trusted backup, got %#v", backupList)
	}

	download, downloadErr := projectSvc.PrepareProjectBackupDownload(context.Background(), projectID, result.BackupID)
	if downloadErr != nil {
		t.Fatalf("PrepareProjectBackupDownload should trust automatic backup manifest: %v", downloadErr)
	}
	if download.BackupID != result.BackupID || !download.ChecksumVerified {
		t.Fatalf("unexpected automatic backup download descriptor: %#v", download)
	}
}

func TestRunProjectAutomaticBackupBlocksWhenPolicyDisabled(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-auto-disabled"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello automatic backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:     false,
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	result, err := projectSvc.RunProjectAutomaticBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("RunProjectAutomaticBackup returned error: %v", err)
	}
	if result.Status != "blocked" || result.BackupCreated || result.Message == "" || result.Recovery == "" {
		t.Fatalf("expected disabled automatic backup to be blocked, got %#v", result)
	}
	if _, err := os.Stat(filepath.Join(backupRoot, projectID)); !os.IsNotExist(err) {
		t.Fatalf("disabled automatic backup should not create backup directory, stat err=%v", err)
	}
}

func TestRunProjectAutomaticBackupBlocksWhenBackupDirMissing(t *testing.T) {
	projectRoot := t.TempDir()
	projectID := "project-backup-auto-no-dir"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello automatic backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:     true,
			BackupDir:      "  ",
			MaxProjectSize: 1024 * 1024,
		},
	})

	result, err := projectSvc.RunProjectAutomaticBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("RunProjectAutomaticBackup returned error: %v", err)
	}
	if result.Status != "blocked" || result.BackupCreated || result.Message == "" || result.Recovery == "" {
		t.Fatalf("expected missing backup dir automatic backup to be blocked, got %#v", result)
	}
	if result.FileName != "" || result.ManifestName != "" || result.Source != "" {
		t.Fatalf("blocked automatic backup should not publish archive facts, got %#v", result)
	}
}

func TestPreflightProjectBackupRestoreReadyWhenArchiveIsTrustedAndTargetEmpty(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-preflight-ready"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "src", "app.tsx"), "export default function App() { return null; }\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	if err := os.RemoveAll(projectDir); err != nil {
		t.Fatalf("clear target project directory: %v", err)
	}
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("recreate empty target project directory: %v", err)
	}

	result, err := projectSvc.PreflightProjectBackupRestore(context.Background(), projectID, created.BackupID)
	if err != nil {
		t.Fatalf("PreflightProjectBackupRestore returned error: %v", err)
	}
	if result.Status != "ready" || !result.CanRestore || !result.ChecksumVerified {
		t.Fatalf("expected ready preflight, got %#v", result)
	}
	if result.BackupID != created.BackupID || result.FileName != created.FileName || result.ManifestName != created.ManifestName {
		t.Fatalf("preflight identity mismatch: result=%#v created=%#v", result, created)
	}
	if result.ArchiveEntryCount != 3 || len(result.ConflictPaths) != 0 || len(result.UnsafePaths) != 0 {
		t.Fatalf("unexpected archive inspection result: %#v", result)
	}
}

func TestPreflightProjectBackupRestoreBlocksTargetConflicts(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-preflight-conflict"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	result, err := projectSvc.PreflightProjectBackupRestore(context.Background(), projectID, created.BackupID)
	if err != nil {
		t.Fatalf("PreflightProjectBackupRestore returned error: %v", err)
	}
	if result.Status != "blocked" || result.CanRestore || !result.ChecksumVerified {
		t.Fatalf("expected conflict-blocked preflight with verified checksum, got %#v", result)
	}
	if got, want := result.ConflictPaths, []string{"README.md"}; !equalStringSlices(got, want) {
		t.Fatalf("conflict paths mismatch:\n got: %#v\nwant: %#v", got, want)
	}
}

func TestPreflightProjectBackupRestoreBlocksChecksumMismatch(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-preflight-checksum"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	archivePath := filepath.Join(backupRoot, projectID, created.FileName)
	if err := os.WriteFile(archivePath, []byte("tampered archive"), 0o644); err != nil {
		t.Fatalf("tamper archive: %v", err)
	}

	result, err := projectSvc.PreflightProjectBackupRestore(context.Background(), projectID, created.BackupID)
	if err != nil {
		t.Fatalf("PreflightProjectBackupRestore returned error: %v", err)
	}
	if result.Status != "blocked" || result.CanRestore || result.ChecksumVerified {
		t.Fatalf("expected checksum-blocked preflight, got %#v", result)
	}
}

func TestPreflightProjectBackupRestoreBlocksUnsafeTarPath(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-preflight-unsafe"
	backupID := "unsafe-backup"
	projectDir := filepath.Join(projectRoot, projectID)
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("create project dir: %v", err)
	}

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	backupDir := filepath.Join(backupRoot, projectID)
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		t.Fatalf("create backup dir: %v", err)
	}
	archiveName := backupID + ".tar.gz"
	archivePath := filepath.Join(backupDir, archiveName)
	sizeBytes, checksum := writeRawProjectBackupArchive(t, archivePath, []projectBackupRawTestEntry{{
		Name: "../escape.txt",
		Body: "escape\n",
	}})
	manifest := projectBackupManifest{
		SchemaVersion:  "project_backup_manifest.v1",
		ProjectID:      projectID,
		BackupID:       backupID,
		FileName:       archiveName,
		SizeBytes:      sizeBytes,
		FileCount:      1,
		DirectoryCount: 0,
		ChecksumSHA256: checksum,
		CreatedAt:      "2099-01-01T00:00:00Z",
		Source:         "project_host_directory",
	}
	if err := writeProjectBackupManifest(filepath.Join(backupDir, backupID+".manifest.json"), manifest); err != nil {
		t.Fatalf("write unsafe manifest: %v", err)
	}

	result, err := projectSvc.PreflightProjectBackupRestore(context.Background(), projectID, backupID)
	if err != nil {
		t.Fatalf("PreflightProjectBackupRestore returned error: %v", err)
	}
	if result.Status != "blocked" || result.CanRestore || !result.ChecksumVerified {
		t.Fatalf("expected unsafe-path blocked preflight with verified checksum, got %#v", result)
	}
	if got, want := result.UnsafePaths, []string{"../escape.txt"}; !equalStringSlices(got, want) {
		t.Fatalf("unsafe paths mismatch:\n got: %#v\nwant: %#v", got, want)
	}
}

func TestPrepareProjectBackupDownloadVerifiesTrustedArchive(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-download-ok"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	download, err := projectSvc.PrepareProjectBackupDownload(context.Background(), projectID, created.BackupID)
	if err != nil {
		t.Fatalf("PrepareProjectBackupDownload returned error: %v", err)
	}
	if download.ProjectID != projectID ||
		download.BackupID != created.BackupID ||
		download.FileName != created.FileName ||
		download.ManifestName != created.ManifestName ||
		download.ArchivePath != filepath.Join(backupRoot, projectID, created.FileName) ||
		download.SizeBytes != created.SizeBytes ||
		download.ChecksumSHA256 != created.ChecksumSHA256 ||
		!download.ChecksumVerified {
		t.Fatalf("download descriptor does not match created backup: %#v created=%#v", download, created)
	}
}

func TestPrepareProjectBackupDownloadRejectsChecksumMismatch(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-download-checksum"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	archivePath := filepath.Join(backupRoot, projectID, created.FileName)
	if err := os.WriteFile(archivePath, []byte("tampered archive"), 0o644); err != nil {
		t.Fatalf("tamper archive: %v", err)
	}

	if _, err := projectSvc.PrepareProjectBackupDownload(context.Background(), projectID, created.BackupID); err == nil {
		t.Fatal("expected checksum mismatch to block backup download")
	}
}

func TestRestoreProjectBackupWritesArchiveEntriesAfterConfirmation(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-restore-ok"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "src", "app.tsx"), "export default function App() { return null; }\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	if err := os.RemoveAll(projectDir); err != nil {
		t.Fatalf("clear target project directory: %v", err)
	}
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("recreate target project directory: %v", err)
	}

	result, err := projectSvc.RestoreProjectBackup(context.Background(), projectID, created.BackupID, true)
	if err != nil {
		t.Fatalf("RestoreProjectBackup returned error: %v", err)
	}
	if result.Status != "restored" || !result.Restored || !result.ChecksumVerified {
		t.Fatalf("expected restored result, got %#v", result)
	}
	if result.RestoredFiles != 2 || result.RestoredDirectories != 1 || result.ArchiveEntryCount != 3 {
		t.Fatalf("restore counts mismatch: %#v", result)
	}
	readmeBytes, err := os.ReadFile(filepath.Join(projectDir, "README.md"))
	if err != nil {
		t.Fatalf("read restored README: %v", err)
	}
	if string(readmeBytes) != "hello backup\n" {
		t.Fatalf("restored README mismatch: %q", string(readmeBytes))
	}
	appBytes, err := os.ReadFile(filepath.Join(projectDir, "src", "app.tsx"))
	if err != nil {
		t.Fatalf("read restored app file: %v", err)
	}
	if string(appBytes) != "export default function App() { return null; }\n" {
		t.Fatalf("restored app file mismatch: %q", string(appBytes))
	}
}

func TestRestoreProjectBackupBlocksWithoutExplicitConfirmation(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-restore-confirm"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	if err := os.RemoveAll(projectDir); err != nil {
		t.Fatalf("clear target project directory: %v", err)
	}
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("recreate target project directory: %v", err)
	}

	result, err := projectSvc.RestoreProjectBackup(context.Background(), projectID, created.BackupID, false)
	if err != nil {
		t.Fatalf("RestoreProjectBackup returned error: %v", err)
	}
	if result.Status != "blocked" || result.Restored {
		t.Fatalf("expected confirmation-blocked restore, got %#v", result)
	}
	if _, err := os.Stat(filepath.Join(projectDir, "README.md")); !os.IsNotExist(err) {
		t.Fatalf("restore without confirmation should not write files, stat err=%v", err)
	}
}

func TestRestoreProjectBackupBlocksWhenPreflightHasConflicts(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-restore-conflict"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:     projectID,
			DirectoryPath: projectDir,
		}}},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			BackupDir:      backupRoot,
			MaxProjectSize: 1024 * 1024,
		},
	})

	created, err := projectSvc.CreateProjectBackup(context.Background(), projectID)
	if err != nil {
		t.Fatalf("CreateProjectBackup returned error: %v", err)
	}
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "current file must survive\n")

	result, err := projectSvc.RestoreProjectBackup(context.Background(), projectID, created.BackupID, true)
	if err != nil {
		t.Fatalf("RestoreProjectBackup returned error: %v", err)
	}
	if result.Status != "blocked" || result.Restored || !result.ChecksumVerified {
		t.Fatalf("expected preflight-blocked restore, got %#v", result)
	}
	if got, want := result.ConflictPaths, []string{"README.md"}; !equalStringSlices(got, want) {
		t.Fatalf("restore conflict paths mismatch:\n got: %#v\nwant: %#v", got, want)
	}
	currentBytes, err := os.ReadFile(filepath.Join(projectDir, "README.md"))
	if err != nil {
		t.Fatalf("read current README: %v", err)
	}
	if string(currentBytes) != "current file must survive\n" {
		t.Fatalf("conflict-blocked restore modified current file: %q", string(currentBytes))
	}
}

func configureProjectRootDirForTest(t *testing.T, projectRoot string) func() {
	t.Helper()
	oldProjectRoot := currentProjectRootDir()
	configureProjectRootDir(&config.ContainerConfig{ProjectDir: projectRoot})
	return func() {
		if oldProjectRoot == "" {
			configureProjectRootDir(nil)
			return
		}
		configureProjectRootDir(&config.ContainerConfig{ProjectDir: oldProjectRoot})
	}
}

func writeProjectBackupTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create test directory for %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write test file %s: %v", path, err)
	}
}

type projectBackupRemoteUploadHTTPClient struct {
	requests       []projectBackupRemoteUploadHTTPRequest
	responseCodes  []int
	responseBodies []string
}

type projectBackupRemoteUploadHTTPRequest struct {
	method        string
	url           string
	contentType   string
	authorization string
	body          []byte
}

func (c *projectBackupRemoteUploadHTTPClient) Do(req *http.Request) (*http.Response, error) {
	bodyBytes := []byte{}
	if req.Body != nil {
		var err error
		bodyBytes, err = io.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
	}
	c.requests = append(c.requests, projectBackupRemoteUploadHTTPRequest{
		method:        req.Method,
		url:           req.URL.String(),
		contentType:   req.Header.Get("Content-Type"),
		authorization: req.Header.Get("Authorization"),
		body:          bodyBytes,
	})
	responseIndex := len(c.requests) - 1
	statusCode := http.StatusOK
	if responseIndex < len(c.responseCodes) && c.responseCodes[responseIndex] != 0 {
		statusCode = c.responseCodes[responseIndex]
	}
	responseBody := "ok"
	if responseIndex < len(c.responseBodies) {
		responseBody = c.responseBodies[responseIndex]
	}
	return &http.Response{
		StatusCode: statusCode,
		Body:       io.NopCloser(strings.NewReader(responseBody)),
	}, nil
}

func readProjectBackupTarEntries(t *testing.T, archivePath string) []string {
	t.Helper()
	file, err := os.Open(archivePath)
	if err != nil {
		t.Fatalf("open archive: %v", err)
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		t.Fatalf("create gzip reader: %v", err)
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	entries := make([]string, 0)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("read tar entry: %v", err)
		}
		entries = append(entries, header.Name)
	}
	sort.Strings(entries)
	return entries
}

type projectBackupRawTestEntry struct {
	Name string
	Body string
}

func writeRawProjectBackupArchive(t *testing.T, archivePath string, entries []projectBackupRawTestEntry) (int64, string) {
	t.Helper()
	file, err := os.Create(archivePath)
	if err != nil {
		t.Fatalf("create raw archive: %v", err)
	}

	gzipWriter := gzip.NewWriter(file)
	tarWriter := tar.NewWriter(gzipWriter)
	for _, entry := range entries {
		header := &tar.Header{
			Name: entry.Name,
			Mode: 0o644,
			Size: int64(len(entry.Body)),
		}
		if err := tarWriter.WriteHeader(header); err != nil {
			_ = file.Close()
			t.Fatalf("write raw tar header: %v", err)
		}
		if _, err := tarWriter.Write([]byte(entry.Body)); err != nil {
			_ = file.Close()
			t.Fatalf("write raw tar body: %v", err)
		}
	}
	if err := tarWriter.Close(); err != nil {
		_ = file.Close()
		t.Fatalf("close raw tar writer: %v", err)
	}
	if err := gzipWriter.Close(); err != nil {
		_ = file.Close()
		t.Fatalf("close raw gzip writer: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close raw archive: %v", err)
	}

	archiveBytes, err := os.ReadFile(archivePath)
	if err != nil {
		t.Fatalf("read raw archive: %v", err)
	}
	checksum := sha256.Sum256(archiveBytes)
	return int64(len(archiveBytes)), hex.EncodeToString(checksum[:])
}

func equalStringSlices(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
