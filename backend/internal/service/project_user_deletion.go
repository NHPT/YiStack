package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yistack/internal/model"
)

type stagedProjectDirectory struct {
	originalPath string
	stagingRoot  string
	stagedPath   string
}

type projectDirectoryStageFunc func(
	path string,
	userID string,
	projectID string,
	kind string,
) (*stagedProjectDirectory, error)

const (
	projectDeletionStagingPrefix   = ".yistack-user-delete-"
	projectDeletionStagingManifest = "manifest.json"
	projectDeletionCommittedMarker = "COMMITTED"
	projectDeletionStagingSchema   = "user_project_deletion_staging.v1"
)

type projectDeletionStagingRecord struct {
	SchemaVersion string `json:"schema_version"`
	UserID        string `json:"user_id"`
	ProjectID     string `json:"project_id"`
	Kind          string `json:"kind"`
	OriginalPath  string `json:"original_path"`
	StagedName    string `json:"staged_name"`
}

func (s *ProjectService) stageUserProjectDirectories(
	ctx context.Context,
	projects []model.Project,
) ([]stagedProjectDirectory, error) {
	return s.stageUserProjectDirectoriesWith(
		ctx,
		projects,
		stageProjectDirectory,
	)
}

func (s *ProjectService) stageUserProjectDirectoriesWith(
	ctx context.Context,
	projects []model.Project,
	stageDirectory projectDirectoryStageFunc,
) ([]stagedProjectDirectory, error) {
	if stageDirectory == nil {
		return nil, fmt.Errorf("project directory stager is required")
	}
	staged := make([]stagedProjectDirectory, 0, len(projects)*2)
	seen := make(map[string]struct{}, len(projects)*2)
	projectCfg := s.projectBackupConfig(ctx)
	stage := func(path, userID, projectID, kind string) error {
		path = filepath.Clean(strings.TrimSpace(path))
		if path == "." || path == "" {
			return nil
		}
		if _, exists := seen[path]; exists {
			return nil
		}
		seen[path] = struct{}{}
		entry, err := stageDirectory(path, userID, projectID, kind)
		if err != nil {
			return err
		}
		if entry != nil {
			staged = append(staged, *entry)
		}
		return nil
	}

	for i := range projects {
		project := &projects[i]
		projectID := strings.TrimSpace(project.ProjectID)
		if projectID == "" {
			return staged, fmt.Errorf("project id is required")
		}

		projectDir := strings.TrimSpace(project.DirectoryPath)
		if projectDir == "" && strings.TrimSpace(currentProjectRootDir()) != "" {
			projectDir = filepath.Join(currentProjectRootDir(), projectID)
		}
		if projectDir != "" {
			safeProjectDir, err := secureProjectHostDirectory(
				currentProjectRootDir(),
				projectID,
				projectDir,
			)
			if err != nil {
				return staged, fmt.Errorf(
					"resolve project directory for %s: %w",
					projectID,
					err,
				)
			}
			if err := stage(safeProjectDir, project.UserID, projectID, "project"); err != nil {
				return staged, fmt.Errorf(
					"stage project directory for %s: %w",
					projectID,
					err,
				)
			}
		}

		if strings.TrimSpace(projectCfg.BackupDir) == "" {
			continue
		}
		backupRoot, err := resolveProjectBackupRoot(projectCfg.BackupDir, projectID)
		if err != nil {
			return staged, fmt.Errorf(
				"resolve project backup directory for %s: %w",
				projectID,
				err,
			)
		}
		if err := stage(backupRoot, project.UserID, projectID, "backup"); err != nil {
			return staged, fmt.Errorf(
				"stage project backup directory for %s: %w",
				projectID,
				err,
			)
		}
	}
	return staged, nil
}

func stageProjectDirectory(
	path string,
	userID string,
	projectID string,
	kind string,
) (*stagedProjectDirectory, error) {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("inspect %s: %w", path, err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return nil, fmt.Errorf("refuse to stage non-directory path: %s", path)
	}

	stagingRoot, err := os.MkdirTemp(filepath.Dir(path), projectDeletionStagingPrefix)
	if err != nil {
		return nil, fmt.Errorf("create deletion staging directory: %w", err)
	}
	stagedName := "data"
	record := projectDeletionStagingRecord{
		SchemaVersion: projectDeletionStagingSchema,
		UserID:        strings.TrimSpace(userID),
		ProjectID:     strings.TrimSpace(projectID),
		Kind:          strings.TrimSpace(kind),
		OriginalPath:  path,
		StagedName:    stagedName,
	}
	encoded, err := json.Marshal(record)
	if err != nil {
		_ = os.Remove(stagingRoot)
		return nil, fmt.Errorf("encode deletion staging manifest: %w", err)
	}
	if err := os.WriteFile(
		filepath.Join(stagingRoot, projectDeletionStagingManifest),
		encoded,
		0o600,
	); err != nil {
		_ = os.Remove(stagingRoot)
		return nil, fmt.Errorf("write deletion staging manifest: %w", err)
	}
	stagedPath := filepath.Join(stagingRoot, stagedName)
	if err := os.Rename(path, stagedPath); err != nil {
		_ = os.RemoveAll(stagingRoot)
		return nil, fmt.Errorf("move %s into deletion staging: %w", path, err)
	}
	return &stagedProjectDirectory{
		originalPath: path,
		stagingRoot:  stagingRoot,
		stagedPath:   stagedPath,
	}, nil
}

func rollbackStagedProjectDirectories(staged []stagedProjectDirectory) error {
	var rollbackErrors []string
	for i := len(staged) - 1; i >= 0; i-- {
		entry := staged[i]
		_, originalErr := os.Lstat(entry.originalPath)
		_, stagedErr := os.Lstat(entry.stagedPath)
		if originalErr == nil {
			if os.IsNotExist(stagedErr) {
				if err := os.RemoveAll(entry.stagingRoot); err != nil {
					rollbackErrors = append(
						rollbackErrors,
						fmt.Sprintf(
							"remove restored staging directory %s: %v",
							entry.stagingRoot,
							err,
						),
					)
				}
				continue
			}
			if stagedErr != nil {
				rollbackErrors = append(
					rollbackErrors,
					fmt.Sprintf(
						"inspect staged restore data %s: %v",
						entry.stagedPath,
						stagedErr,
					),
				)
				continue
			}
			rollbackErrors = append(
				rollbackErrors,
				fmt.Sprintf("refuse to overwrite restored path %s", entry.originalPath),
			)
			continue
		}
		if !os.IsNotExist(originalErr) {
			rollbackErrors = append(
				rollbackErrors,
				fmt.Sprintf(
					"inspect restore path %s: %v",
					entry.originalPath,
					originalErr,
				),
			)
			continue
		}
		if stagedErr != nil {
			if os.IsNotExist(stagedErr) {
				rollbackErrors = append(
					rollbackErrors,
					fmt.Sprintf(
						"staged restore data is missing for %s",
						entry.originalPath,
					),
				)
			} else {
				rollbackErrors = append(
					rollbackErrors,
					fmt.Sprintf(
						"inspect staged restore data %s: %v",
						entry.stagedPath,
						stagedErr,
					),
				)
			}
			continue
		}
		if err := os.Rename(entry.stagedPath, entry.originalPath); err != nil {
			rollbackErrors = append(
				rollbackErrors,
				fmt.Sprintf("restore %s: %v", entry.originalPath, err),
			)
			continue
		}
		if err := os.RemoveAll(entry.stagingRoot); err != nil {
			rollbackErrors = append(
				rollbackErrors,
				fmt.Sprintf("remove empty staging directory %s: %v", entry.stagingRoot, err),
			)
		}
	}
	if len(rollbackErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(rollbackErrors, " | "))
	}
	return nil
}

func markStagedProjectDirectoriesCommitted(staged []stagedProjectDirectory) error {
	var markerErrors []string
	for _, entry := range staged {
		markerPath := filepath.Join(entry.stagingRoot, projectDeletionCommittedMarker)
		if err := os.WriteFile(markerPath, []byte("committed\n"), 0o600); err != nil {
			markerErrors = append(
				markerErrors,
				fmt.Sprintf("write committed marker %s: %v", markerPath, err),
			)
		}
	}
	if len(markerErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(markerErrors, " | "))
	}
	return nil
}

func discardStagedProjectDirectories(staged []stagedProjectDirectory) error {
	var cleanupErrors []string
	for _, entry := range staged {
		var cleanupErr error
		for attempt := 0; attempt < 3; attempt++ {
			cleanupErr = os.RemoveAll(entry.stagingRoot)
			if cleanupErr == nil {
				break
			}
			_ = makeProjectDeletionStagingWritable(entry.stagingRoot)
			time.Sleep(time.Duration(attempt+1) * 50 * time.Millisecond)
		}
		if cleanupErr != nil {
			cleanupErrors = append(
				cleanupErrors,
				fmt.Sprintf("remove staging directory %s: %v", entry.stagingRoot, cleanupErr),
			)
		}
	}
	if len(cleanupErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(cleanupErrors, " | "))
	}
	return nil
}

func retryDiscardStagedProjectDirectories(staged []stagedProjectDirectory) {
	if len(staged) == 0 {
		return
	}
	snapshot := append([]stagedProjectDirectory(nil), staged...)
	go func() {
		var cleanupErr error
		for attempt := 0; attempt < 12; attempt++ {
			cleanupErr = discardStagedProjectDirectories(snapshot)
			if cleanupErr == nil {
				return
			}
			time.Sleep(time.Duration(attempt+1) * time.Second)
		}
		log.Printf(
			"Warning: committed user deletion staging still requires cleanup: %v",
			cleanupErr,
		)
	}()
}

func recoverProjectDeletionStaging(
	ctx context.Context,
	projectRepo ProjectRepo,
	projectRoot string,
	backupRoot string,
) error {
	var cleanupErrors []string
	projectIDsByUser := make(map[string]map[string]struct{})
	loadedUsers := make(map[string]bool)
	deletionRepo, supportsDeletionLookup := projectRepo.(userProjectDeletionRepository)
	baseDirs := []string{projectRoot, backupRoot}
	seenBaseDirs := make(map[string]struct{}, len(baseDirs))
	for _, baseDir := range baseDirs {
		baseDir = filepath.Clean(strings.TrimSpace(baseDir))
		if baseDir == "" || baseDir == "." {
			continue
		}
		if _, exists := seenBaseDirs[baseDir]; exists {
			continue
		}
		seenBaseDirs[baseDir] = struct{}{}
		entries, err := os.ReadDir(baseDir)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			cleanupErrors = append(cleanupErrors, fmt.Sprintf("read staging parent %s: %v", baseDir, err))
			continue
		}
		for _, entry := range entries {
			if !entry.IsDir() || !strings.HasPrefix(entry.Name(), projectDeletionStagingPrefix) {
				continue
			}
			stagingRoot := filepath.Join(baseDir, entry.Name())
			markerPath := filepath.Join(stagingRoot, projectDeletionCommittedMarker)
			markerInfo, markerErr := os.Lstat(markerPath)
			if markerErr == nil && markerInfo.Mode().IsRegular() {
				if err := os.RemoveAll(stagingRoot); err != nil {
					cleanupErrors = append(
						cleanupErrors,
						fmt.Sprintf("remove committed staging directory %s: %v", stagingRoot, err),
					)
				}
				continue
			}

			record, recordErr := readProjectDeletionStagingRecord(stagingRoot)
			if recordErr != nil {
				cleanupErrors = append(
					cleanupErrors,
					fmt.Sprintf("read pending staging directory %s: %v", stagingRoot, recordErr),
				)
				continue
			}
			stagedPath := filepath.Join(stagingRoot, record.StagedName)
			_, stagedDataErr := os.Lstat(stagedPath)
			if stagedDataErr != nil && !os.IsNotExist(stagedDataErr) {
				cleanupErrors = append(
					cleanupErrors,
					fmt.Sprintf(
						"inspect pending staging data %s: %v",
						stagedPath,
						stagedDataErr,
					),
				)
				continue
			}

			expectedPath, pathErr := expectedProjectDeletionOriginalPath(
				record,
				projectRoot,
				backupRoot,
			)
			if pathErr != nil || filepath.Clean(record.OriginalPath) != expectedPath {
				if pathErr == nil {
					pathErr = fmt.Errorf("unexpected original path %s", record.OriginalPath)
				}
				cleanupErrors = append(
					cleanupErrors,
					fmt.Sprintf("validate pending staging directory %s: %v", stagingRoot, pathErr),
				)
				continue
			}

			if !supportsDeletionLookup {
				cleanupErrors = append(
					cleanupErrors,
					fmt.Sprintf("project deletion recovery lookup unavailable for %s", stagingRoot),
				)
				continue
			}
			if !loadedUsers[record.UserID] {
				projects, listErr := deletionRepo.ListByUserIDIncludingDeleted(ctx, record.UserID)
				if listErr != nil {
					cleanupErrors = append(
						cleanupErrors,
						fmt.Sprintf("list projects for staging recovery %s: %v", stagingRoot, listErr),
					)
					continue
				}
				projectIDsByUser[record.UserID] = make(map[string]struct{}, len(projects))
				for i := range projects {
					projectIDsByUser[record.UserID][projects[i].ProjectID] = struct{}{}
				}
				loadedUsers[record.UserID] = true
			}

			stagedEntry := stagedProjectDirectory{
				originalPath: expectedPath,
				stagingRoot:  stagingRoot,
				stagedPath:   stagedPath,
			}
			if _, projectExists := projectIDsByUser[record.UserID][record.ProjectID]; projectExists {
				if os.IsNotExist(stagedDataErr) {
					if _, originalErr := os.Lstat(expectedPath); originalErr == nil {
						if err := os.RemoveAll(stagingRoot); err != nil {
							cleanupErrors = append(
								cleanupErrors,
								fmt.Sprintf(
									"remove restored staging directory %s: %v",
									stagingRoot,
									err,
								),
							)
						}
						continue
					} else if os.IsNotExist(originalErr) {
						cleanupErrors = append(
							cleanupErrors,
							fmt.Sprintf(
								"project %s still exists but both original and staged data are missing",
								record.ProjectID,
							),
						)
					} else {
						cleanupErrors = append(
							cleanupErrors,
							fmt.Sprintf("inspect recovered project path %s: %v", expectedPath, originalErr),
						)
					}
					continue
				}
				if err := rollbackStagedProjectDirectories([]stagedProjectDirectory{stagedEntry}); err != nil {
					cleanupErrors = append(cleanupErrors, err.Error())
				}
				continue
			}
			if err := discardStagedProjectDirectories([]stagedProjectDirectory{stagedEntry}); err != nil {
				cleanupErrors = append(cleanupErrors, err.Error())
			}
		}
	}
	if len(cleanupErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(cleanupErrors, " | "))
	}
	return nil
}

func readProjectDeletionStagingRecord(
	stagingRoot string,
) (projectDeletionStagingRecord, error) {
	var record projectDeletionStagingRecord
	manifestPath := filepath.Join(stagingRoot, projectDeletionStagingManifest)
	info, err := os.Lstat(manifestPath)
	if err != nil {
		return record, err
	}
	if !info.Mode().IsRegular() {
		return record, fmt.Errorf("staging manifest is not a regular file")
	}
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		return record, err
	}
	if err := json.Unmarshal(raw, &record); err != nil {
		return record, err
	}
	if record.SchemaVersion != projectDeletionStagingSchema ||
		strings.TrimSpace(record.UserID) == "" ||
		strings.TrimSpace(record.ProjectID) == "" ||
		record.StagedName != "data" {
		return record, fmt.Errorf("invalid staging manifest")
	}
	return record, nil
}

func expectedProjectDeletionOriginalPath(
	record projectDeletionStagingRecord,
	projectRoot string,
	backupRoot string,
) (string, error) {
	switch record.Kind {
	case "project":
		return secureProjectHostDirectory(
			projectRoot,
			record.ProjectID,
			record.OriginalPath,
		)
	case "backup":
		expected, err := resolveProjectBackupRoot(backupRoot, record.ProjectID)
		if err != nil {
			return "", err
		}
		return filepath.Clean(expected), nil
	default:
		return "", fmt.Errorf("invalid staging kind %q", record.Kind)
	}
}

func makeProjectDeletionStagingWritable(root string) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		return os.Chmod(path, info.Mode().Perm()|0o700)
	})
}
