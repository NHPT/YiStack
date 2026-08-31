package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"yistack/config"
	"yistack/internal/model"
)

func TestRunProjectAutomaticBackupSchedulerOnceCreatesAutomaticPolicyBackups(t *testing.T) {
	projectRoot := t.TempDir()
	backupRoot := t.TempDir()
	projectID := "project-backup-scheduler"
	projectDir := filepath.Join(projectRoot, projectID)
	writeProjectBackupTestFile(t, filepath.Join(projectDir, "README.md"), "hello scheduled backup\n")

	restoreProjectRoot := configureProjectRootDirForTest(t, projectRoot)
	defer restoreProjectRoot()

	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{
			projects: []model.Project{{
				ProjectID:     projectID,
				DirectoryPath: projectDir,
			}},
			total: 1,
		},
		ContainerCfg: &config.ContainerConfig{ProjectDir: projectRoot},
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:                true,
			BackupDir:                 backupRoot,
			AutoBackupIntervalSeconds: 60,
			MaxProjectSize:            1024 * 1024,
		},
	})

	summary, err := projectSvc.RunProjectAutomaticBackupSchedulerOnce(context.Background())
	if err != nil {
		t.Fatalf("RunProjectAutomaticBackupSchedulerOnce returned error: %v", err)
	}
	if summary.Status != "completed" ||
		summary.Source != projectAutomaticBackupSchedulerSource ||
		summary.ProjectCount != 1 ||
		summary.CreatedCount != 1 ||
		summary.BlockedCount != 0 ||
		summary.FailedCount != 0 {
		t.Fatalf("unexpected scheduler summary: %#v", summary)
	}
	if len(summary.Results) != 1 {
		t.Fatalf("expected one scheduler result, got %#v", summary.Results)
	}
	result := summary.Results[0]
	if result.ProjectID != projectID ||
		result.Status != "created" ||
		!result.BackupCreated ||
		result.Source != "automatic_policy" ||
		result.BackupID == "" {
		t.Fatalf("unexpected scheduler project result: %#v", result)
	}

	entries, err := os.ReadDir(filepath.Join(backupRoot, projectID))
	if err != nil {
		t.Fatalf("read scheduler backup dir: %v", err)
	}
	manifestCount := 0
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) == ".json" {
			manifestCount++
		}
	}
	if manifestCount != 1 {
		t.Fatalf("expected one manifest to be written, got %d entries=%#v", manifestCount, entries)
	}
}

func TestRunProjectAutomaticBackupSchedulerOnceSkipsWhenPolicyDisabled(t *testing.T) {
	backupRoot := filepath.Join(t.TempDir(), "backups")
	repo := &stubProjectListRepo{
		projects: []model.Project{{ProjectID: "project-disabled"}},
		total:    1,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:                false,
			BackupDir:                 backupRoot,
			AutoBackupIntervalSeconds: 60,
		},
	})

	summary, err := projectSvc.RunProjectAutomaticBackupSchedulerOnce(context.Background())
	if err != nil {
		t.Fatalf("RunProjectAutomaticBackupSchedulerOnce returned error: %v", err)
	}
	if summary.Status != "skipped" || summary.ProjectCount != 0 || repo.listAllPage != 0 {
		t.Fatalf("expected disabled scheduler to skip project enumeration, got summary=%#v listPage=%d", summary, repo.listAllPage)
	}
	if _, err := os.Stat(backupRoot); !os.IsNotExist(err) {
		t.Fatalf("disabled scheduler should not create backup root, stat err=%v", err)
	}
}

func TestRunProjectAutomaticBackupSchedulerOnceStopsOnProjectListFailure(t *testing.T) {
	backupRoot := filepath.Join(t.TempDir(), "backups")
	listErr := errors.New("database unavailable")
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{listAllErr: listErr},
		ProjectCfg: &config.ProjectConfig{
			AutoBackup:                true,
			BackupDir:                 backupRoot,
			AutoBackupIntervalSeconds: 60,
		},
	})

	summary, err := projectSvc.RunProjectAutomaticBackupSchedulerOnce(context.Background())
	if !errors.Is(err, listErr) {
		t.Fatalf("expected list error, got %v", err)
	}
	if summary == nil || summary.Status != "failed" || summary.FailedCount != 1 || summary.CreatedCount != 0 {
		t.Fatalf("unexpected failure summary: %#v", summary)
	}
	if _, err := os.Stat(backupRoot); !os.IsNotExist(err) {
		t.Fatalf("list failure should not create backup root, stat err=%v", err)
	}
}
