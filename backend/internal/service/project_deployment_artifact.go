package service

import (
	"context"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"

	"yistack/internal/model"
)

const (
	deploymentArtifactMaxFiles      = 512
	deploymentArtifactMaxFileBytes  = 10 * 1024 * 1024
	deploymentArtifactMaxTotalBytes = 50 * 1024 * 1024
)

type deploymentArtifactFile struct {
	Path    string
	Content []byte
	SHA1    string
	Size    int64
}

type deploymentArtifact struct {
	SourceCommitSHA string
	SHA256          string
	Files           []deploymentArtifactFile
	Size            int64
	Validation      *ProjectValidationResult
}

func (s *ProjectDeploymentService) prepareArtifact(ctx context.Context, project *model.Project) (*deploymentArtifact, error) {
	if s == nil || s.projectService == nil || s.projectService.containerMgr == nil {
		return nil, deploymentError("deployment_runtime_unavailable", "Project runtime is not available", nil)
	}
	if _, _, err := ensureProjectRuntimeBaseContainer(ctx, project, s.projectService.projectRepo, s.projectService.containerMgr, s.projectService.containerCfg, s.projectService.getImageForRuntimeProfile); err != nil {
		return nil, deploymentError("deployment_runtime_unavailable", "Project runtime could not be prepared", err)
	}
	validation, err := s.validator.Validate(ctx, project.ProjectID, project, nil)
	if err != nil || validation.Status != ProjectValidationStatusPassed {
		return nil, deploymentError("deployment_validation_failed", "Project Validation Gate must pass before deployment", err)
	}
	status, err := runGitInContainer(ctx, s.projectService.containerMgr, project.ProjectID, "status", "--porcelain")
	if err != nil {
		return nil, deploymentError("deployment_git_failed", "Git worktree status could not be read", err)
	}
	if strings.TrimSpace(status) != "" {
		return nil, deploymentError("deployment_dirty_worktree", "Deployment requires a clean Git worktree", nil)
	}
	commitSHA, err := runGitInContainer(ctx, s.projectService.containerMgr, project.ProjectID, "rev-parse", "HEAD")
	if err != nil {
		return nil, deploymentError("deployment_git_failed", "Git commit could not be resolved", err)
	}
	commitSHA = strings.TrimSpace(commitSHA)
	if len(commitSHA) != 40 && len(commitSHA) != 64 {
		return nil, deploymentError("deployment_git_failed", "Git commit SHA is invalid", nil)
	}
	listed, err := runGitInContainer(ctx, s.projectService.containerMgr, project.ProjectID, "ls-files", "-z")
	if err != nil {
		return nil, deploymentError("deployment_git_failed", "Tracked deployment files could not be listed", err)
	}
	paths := strings.Split(listed, "\x00")
	files := make([]deploymentArtifactFile, 0, len(paths))
	for _, rawPath := range paths {
		if strings.TrimSpace(rawPath) == "" {
			continue
		}
		path, normalizeErr := normalizeProjectRelativePath(rawPath)
		if normalizeErr != nil || isProtectedGenerationPath(path) || strings.HasPrefix(path, ".vercel/") {
			return nil, deploymentError("deployment_artifact_path_invalid", "Deployment artifact contains a protected or invalid path", normalizeErr)
		}
		content, readErr := readProjectFileInContainer(ctx, s.projectService.containerMgr, project.ProjectID, path)
		if readErr != nil {
			return nil, deploymentError("deployment_artifact_read_failed", "Deployment artifact file could not be read", readErr)
		}
		data := []byte(content)
		if len(data) > deploymentArtifactMaxFileBytes {
			return nil, deploymentError("deployment_artifact_too_large", "A deployment artifact file exceeds the size limit", nil)
		}
		digest := sha1.Sum(data)
		files = append(files, deploymentArtifactFile{Path: path, Content: data, SHA1: hex.EncodeToString(digest[:]), Size: int64(len(data))})
	}
	if len(files) == 0 || len(files) > deploymentArtifactMaxFiles {
		return nil, deploymentError("deployment_artifact_file_count_invalid", "Deployment artifact file count is invalid", nil)
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	hash := sha256.New()
	var total int64
	for _, file := range files {
		total += file.Size
		if total > deploymentArtifactMaxTotalBytes {
			return nil, deploymentError("deployment_artifact_too_large", "Deployment artifact exceeds the total size limit", nil)
		}
		_, _ = hash.Write([]byte(file.Path))
		_, _ = hash.Write([]byte{0})
		_, _ = hash.Write(file.Content)
		_, _ = hash.Write([]byte{0})
	}
	return &deploymentArtifact{SourceCommitSHA: commitSHA, SHA256: hex.EncodeToString(hash.Sum(nil)), Files: files, Size: total, Validation: validation}, nil
}

func deploymentProviderProjectName(projectID string) string {
	var builder strings.Builder
	for _, value := range strings.ToLower(strings.TrimSpace(projectID)) {
		if (value >= 'a' && value <= 'z') || (value >= '0' && value <= '9') || value == '-' {
			builder.WriteRune(value)
		} else {
			builder.WriteByte('-')
		}
	}
	name := strings.Trim(builder.String(), "-")
	if name == "" {
		name = "project"
	}
	name = "yistack-" + name
	if len(name) > 80 {
		name = strings.TrimRight(name[:80], "-")
	}
	return name
}
