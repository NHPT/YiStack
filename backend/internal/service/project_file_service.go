package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"yistack/internal/model"
	"yistack/pkg/file"
)

// GetProjectFileTree 获取项目的当前文件树。
func (s *ProjectService) GetProjectFileTree(ctx context.Context, projectID string) (*file.FileNode, error) {
	project, err := s.getProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, errors.New("runtime is required for project file reads")
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "文件树无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	if _, _, runtimeErr := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr != nil {
		return nil, runtimeErr
	}
	return s.getProjectFileTreeFromContainer(ctx, project.ProjectID)
}

// ReadProjectFile 读取项目内指定文件的内容。
func (s *ProjectService) ReadProjectFile(ctx context.Context, projectID, filePath string) (string, error) {
	project, err := s.getProject(ctx, projectID)
	if err != nil {
		return "", err
	}
	if !projectNeedsRuntime(project.AppType) {
		return "", errors.New("runtime is required for project file reads")
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "文件读取无法连接容器管理器", containerErr)
		return "", containerErr
	}
	if _, _, runtimeErr := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr != nil {
		return "", runtimeErr
	}

	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return "", err
	}

	return readProjectFileInContainer(ctx, s.containerMgr, projectID, normalizedPath)
}

type ProjectFileWriteResult struct {
	Path                     string `json:"path"`
	WriteStatus              string `json:"write_status"`
	FileTreeStatus           string `json:"file_tree_status"`
	FileTreeStatusLabel      string `json:"file_tree_status_label"`
	FileTreeError            string `json:"file_tree_error,omitempty"`
	FileTreeErrorSource      string `json:"file_tree_error_source,omitempty"`
	FileTreeErrorDetails     string `json:"file_tree_error_details,omitempty"`
	CommitStatus             string `json:"commit_status"`
	CommitStatusLabel        string `json:"commit_status_label"`
	CommitError              string `json:"commit_error,omitempty"`
	CommitErrorSource        string `json:"commit_error_source,omitempty"`
	CommitErrorDetails       string `json:"commit_error_details,omitempty"`
	ResourceRevision         string `json:"resource_revision"`
	CollaborationEventStatus string `json:"collaboration_event_status"`
	CollaborationEventError  string `json:"collaboration_event_error,omitempty"`
}

type ProjectFileOperationResult struct {
	OperationStatus          string `json:"operation_status"`
	OperationStatusLabel     string `json:"operation_status_label"`
	Operation                string `json:"operation"`
	Path                     string `json:"path"`
	TargetPath               string `json:"target_path,omitempty"`
	FileTreeStatus           string `json:"file_tree_status"`
	FileTreeStatusLabel      string `json:"file_tree_status_label"`
	FileTreeError            string `json:"file_tree_error,omitempty"`
	FileTreeErrorSource      string `json:"file_tree_error_source,omitempty"`
	FileTreeErrorDetails     string `json:"file_tree_error_details,omitempty"`
	CommitStatus             string `json:"commit_status"`
	CommitStatusLabel        string `json:"commit_status_label"`
	CommitError              string `json:"commit_error,omitempty"`
	CommitErrorSource        string `json:"commit_error_source,omitempty"`
	CommitErrorDetails       string `json:"commit_error_details,omitempty"`
	CollaborationEventStatus string `json:"collaboration_event_status"`
	CollaborationEventError  string `json:"collaboration_event_error,omitempty"`
}

type ProjectFileRevisionValidationError struct {
	Revision string
}

func (e *ProjectFileRevisionValidationError) Error() string {
	return "expected file revision must be a 64-character lowercase SHA-256 value"
}

type ProjectFileRevisionConflictError struct {
	ExpectedRevision string
	CurrentRevision  string
}

func (e *ProjectFileRevisionConflictError) Error() string {
	return "file changed since it was opened"
}

func ProjectFileContentRevision(content string) string {
	sum := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", sum)
}

func normalizeExpectedProjectFileRevision(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "", nil
	}
	if len(value) != 64 || !isLowerHex(value) {
		return "", &ProjectFileRevisionValidationError{Revision: value}
	}
	return value, nil
}

func (s *ProjectService) lockProjectMutation(projectID string) func() {
	lockValue, _ := s.projectMutationLocks.LoadOrStore(projectID, &sync.Mutex{})
	lock := lockValue.(*sync.Mutex)
	lock.Lock()
	return lock.Unlock
}

func (s *ProjectService) recordProjectMutationEvent(
	ctx context.Context,
	actorUserID, projectID, accessRole, eventType, resourcePath, resourceRevision string,
	metadata map[string]interface{},
) (string, string) {
	if strings.TrimSpace(actorUserID) == "" {
		return "not_requested", ""
	}
	if s.collaborationRepo == nil {
		return "failed", "collaboration repository is unavailable"
	}
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadata["role"] = accessRole
	event := newProjectCollaborationEvent(
		projectID, actorUserID, "", eventType, resourcePath, resourceRevision,
		metadata, time.Now().UTC(),
	)
	if err := s.collaborationRepo.AppendCollaborationEvent(ctx, event); err != nil {
		return "failed", err.Error()
	}
	return "recorded", ""
}

func (s *ProjectService) WriteProjectFile(ctx context.Context, projectID, filePath, content string) (*ProjectFileWriteResult, error) {
	return s.writeProjectFile(ctx, "", projectID, filePath, content, "")
}

func (s *ProjectService) WriteProjectFileAsUser(
	ctx context.Context, actorUserID, projectID, filePath, content, expectedRevision string,
) (*ProjectFileWriteResult, error) {
	return s.writeProjectFile(ctx, actorUserID, projectID, filePath, content, expectedRevision)
}

// WriteProjectFile 写入项目文件，并在成功后刷新文件树和 Git 提交。
func (s *ProjectService) writeProjectFile(
	ctx context.Context, actorUserID, projectID, filePath, content, expectedRevision string,
) (*ProjectFileWriteResult, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	accessRole := ""
	if actorUserID != "" {
		decision := s.AuthorizeProjectAccess(ctx, actorUserID, projectID)
		if !decision.CanWrite() {
			return nil, &ProjectCollaborationError{Code: "collaboration_write_forbidden", Message: "Project role does not allow file writes"}
		}
		accessRole = decision.AccessRole
	}
	unlock := s.lockProjectMutation(projectID)
	defer unlock()

	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return nil, err
	}
	expectedRevision, err = normalizeExpectedProjectFileRevision(expectedRevision)
	if err != nil {
		return nil, err
	}
	project, err := s.getProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	if projectNeedsRuntime(project.AppType) {
		if s.containerMgr == nil {
			containerErr := errors.New("container manager not available")
			_ = s.persistRuntimeUnavailable(ctx, project, "文件保存无法连接容器管理器", containerErr)
			return nil, containerErr
		}
		if _, runtimeErr := ensureProjectRuntimeContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr != nil {
			return nil, runtimeErr
		}
		if expectedRevision != "" {
			currentContent, readErr := readProjectFileInContainer(ctx, s.containerMgr, projectID, normalizedPath)
			if readErr != nil {
				if strings.Contains(readErr.Error(), "file does not exist") {
					return nil, &ProjectFileRevisionConflictError{
						ExpectedRevision: expectedRevision,
						CurrentRevision:  "",
					}
				}
				return nil, readErr
			}
			currentRevision := ProjectFileContentRevision(currentContent)
			if currentRevision != expectedRevision {
				return nil, &ProjectFileRevisionConflictError{
					ExpectedRevision: expectedRevision,
					CurrentRevision:  currentRevision,
				}
			}
		}
		if err := writeFileInContainer(ctx, s.containerMgr, projectID, normalizedPath, content); err != nil {
			return nil, err
		}
	} else {
		return nil, errors.New("runtime is required for project file writes")
	}

	resourceRevision := ProjectFileContentRevision(content)
	collaborationEventStatus, collaborationEventError := s.recordProjectMutationEvent(
		ctx, actorUserID, projectID, accessRole, ProjectCollaborationEventFileSaved, normalizedPath, resourceRevision,
		map[string]interface{}{"source": "workspace", "operation": "write"},
	)
	fileTreeSync := refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)

	result := &ProjectFileWriteResult{
		Path:                     normalizedPath,
		WriteStatus:              "saved",
		FileTreeStatus:           fileTreeSync.Status,
		FileTreeStatusLabel:      fileTreeSync.StatusLabel,
		FileTreeError:            fileTreeSync.Error,
		FileTreeErrorSource:      fileTreeSync.ErrorSource,
		FileTreeErrorDetails:     fileTreeSync.ErrorDetails,
		CommitStatus:             "created",
		CommitStatusLabel:        "Git snapshot created",
		ResourceRevision:         resourceRevision,
		CollaborationEventStatus: collaborationEventStatus,
		CollaborationEventError:  collaborationEventError,
	}

	commitCreated, commitSnapshot, commitErr := createProjectGitCommitInContainer(ctx, s.containerMgr, projectID, fmt.Sprintf("Update %s", filePath))
	if commitErr != nil {
		log.Printf("Warning: failed to create git commit after file save: %v", commitErr)
		result.CommitStatus = "failed"
		result.CommitStatusLabel = "Git snapshot failed"
		result.CommitError = commitErr.Error()
		result.CommitErrorSource = "project_git_snapshot"
		result.CommitErrorDetails = commitErr.Error()
		return result, nil
	}
	if !commitCreated {
		result.CommitStatus = "skipped_no_changes"
		result.CommitStatusLabel = "No Git snapshot needed"
	} else if commitSnapshot == nil {
		result.CommitStatus = "created_record_missing"
		result.CommitStatusLabel = "Git snapshot created; commit record unavailable"
		result.CommitError = "git commit metadata unavailable"
		result.CommitErrorSource = "project_git_snapshot_record"
		result.CommitErrorDetails = "Git commit was created in the project repository, but HEAD metadata could not be read for database synchronization."
	} else if err := persistProjectGitCommitSnapshot(ctx, s.commitRepo, project, commitSnapshot); err != nil {
		log.Printf("Warning: failed to persist git commit after file save: %v", err)
		result.CommitStatus = "created_record_failed"
		result.CommitStatusLabel = "Git snapshot created; commit record failed"
		result.CommitError = err.Error()
		result.CommitErrorSource = "project_git_snapshot_record"
		result.CommitErrorDetails = err.Error()
	}

	return result, nil
}

func (s *ProjectService) PerformProjectFileOperation(ctx context.Context, projectID, operation, path, targetPath, content string) (*ProjectFileOperationResult, error) {
	return s.performProjectFileOperation(ctx, "", projectID, operation, path, targetPath, content)
}

func (s *ProjectService) PerformProjectFileOperationAsUser(
	ctx context.Context, actorUserID, projectID, operation, path, targetPath, content string,
) (*ProjectFileOperationResult, error) {
	return s.performProjectFileOperation(ctx, actorUserID, projectID, operation, path, targetPath, content)
}

func (s *ProjectService) performProjectFileOperation(
	ctx context.Context, actorUserID, projectID, operation, path, targetPath, content string,
) (*ProjectFileOperationResult, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	accessRole := ""
	if actorUserID != "" {
		decision := s.AuthorizeProjectAccess(ctx, actorUserID, projectID)
		if !decision.CanWrite() {
			return nil, &ProjectCollaborationError{Code: "collaboration_write_forbidden", Message: "Project role does not allow file operations"}
		}
		accessRole = decision.AccessRole
	}
	unlock := s.lockProjectMutation(projectID)
	defer unlock()

	project, err := s.getProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, errors.New("runtime is required for project file operations")
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "文件系统事务无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	if _, runtimeErr := ensureProjectRuntimeContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr != nil {
		return nil, runtimeErr
	}

	normalizedOperation := strings.TrimSpace(operation)
	normalizedPath, err := normalizeProjectRelativePath(path)
	if err != nil {
		return nil, err
	}
	normalizedTargetPath := ""

	switch normalizedOperation {
	case "create_file":
		if operationErr := createFileInContainer(ctx, s.containerMgr, projectID, normalizedPath, content); operationErr != nil {
			return nil, operationErr
		}
	case "create_directory":
		if operationErr := createDirectoryInContainer(ctx, s.containerMgr, projectID, normalizedPath); operationErr != nil {
			return nil, operationErr
		}
	case "rename_file", "rename_directory":
		normalizedTargetPath, err = normalizeProjectRelativePath(targetPath)
		if err != nil {
			return nil, err
		}
		if err := renamePathInContainer(ctx, s.containerMgr, projectID, normalizedPath, normalizedTargetPath); err != nil {
			return nil, err
		}
	case "delete_file", "delete_directory":
		if err := deletePathInContainer(ctx, s.containerMgr, projectID, normalizedPath); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported project file operation: %s", normalizedOperation)
	}

	eventPath := normalizedPath
	if normalizedTargetPath != "" {
		eventPath = normalizedTargetPath
	}
	collaborationEventStatus, collaborationEventError := s.recordProjectMutationEvent(
		ctx, actorUserID, projectID, accessRole, ProjectCollaborationEventTreeChanged, eventPath, "",
		map[string]interface{}{
			"source":        "workspace",
			"operation":     normalizedOperation,
			"previous_path": normalizedPath,
		},
	)
	fileTreeSync := refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	result := &ProjectFileOperationResult{
		OperationStatus:          "applied",
		OperationStatusLabel:     "File operation applied",
		Operation:                normalizedOperation,
		Path:                     normalizedPath,
		TargetPath:               normalizedTargetPath,
		FileTreeStatus:           fileTreeSync.Status,
		FileTreeStatusLabel:      fileTreeSync.StatusLabel,
		FileTreeError:            fileTreeSync.Error,
		FileTreeErrorSource:      fileTreeSync.ErrorSource,
		FileTreeErrorDetails:     fileTreeSync.ErrorDetails,
		CommitStatus:             "created",
		CommitStatusLabel:        "Git snapshot created",
		CollaborationEventStatus: collaborationEventStatus,
		CollaborationEventError:  collaborationEventError,
	}

	commitMessagePath := normalizedPath
	if normalizedTargetPath != "" {
		commitMessagePath = fmt.Sprintf("%s -> %s", normalizedPath, normalizedTargetPath)
	}
	commitCreated, commitSnapshot, commitErr := createProjectGitCommitInContainer(ctx, s.containerMgr, projectID, fmt.Sprintf("Apply %s %s", normalizedOperation, commitMessagePath))
	if commitErr != nil {
		log.Printf("Warning: failed to create git commit after file operation: %v", commitErr)
		result.CommitStatus = "failed"
		result.CommitStatusLabel = "Git snapshot failed"
		result.CommitError = commitErr.Error()
		result.CommitErrorSource = "project_git_snapshot"
		result.CommitErrorDetails = commitErr.Error()
		return result, nil
	}
	if !commitCreated {
		result.CommitStatus = "skipped_no_changes"
		result.CommitStatusLabel = "No Git snapshot needed"
	} else if commitSnapshot == nil {
		result.CommitStatus = "created_record_missing"
		result.CommitStatusLabel = "Git snapshot created; commit record unavailable"
		result.CommitError = "git commit metadata unavailable"
		result.CommitErrorSource = "project_git_snapshot_record"
		result.CommitErrorDetails = "Git commit was created in the project repository, but HEAD metadata could not be read for database synchronization."
	} else if err := persistProjectGitCommitSnapshot(ctx, s.commitRepo, project, commitSnapshot); err != nil {
		log.Printf("Warning: failed to persist git commit after file operation: %v", err)
		result.CommitStatus = "created_record_failed"
		result.CommitStatusLabel = "Git snapshot created; commit record failed"
		result.CommitError = err.Error()
		result.CommitErrorSource = "project_git_snapshot_record"
		result.CommitErrorDetails = err.Error()
	}

	return result, nil
}

func (s *ProjectService) getProject(ctx context.Context, projectID string) (*model.Project, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	return project, nil
}

func (s *ProjectService) getProjectFileTreeFromContainer(ctx context.Context, projectID string) (*file.FileNode, error) {
	return getProjectFileTreeFromContainer(ctx, s.containerMgr, projectID)
}
