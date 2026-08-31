package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"

	"yistack/internal/model"
)

const projectPreviewShareIDByteLength = 24

var projectPreviewShareIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{24,96}$`)

type ProjectPreviewShareResult struct {
	ProjectID           string `json:"project_id"`
	PreviewShareEnabled bool   `json:"preview_share_enabled"`
	PreviewShareID      string `json:"preview_share_id,omitempty"`
	PreviewSharePath    string `json:"preview_share_path,omitempty"`
	PreviewShareURL     string `json:"preview_share_url,omitempty"`
	Message             string `json:"message"`
}

func generateProjectPreviewShareID() (string, error) {
	raw := make([]byte, projectPreviewShareIDByteLength)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate preview share id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func normalizeProjectPreviewShareID(value string) string {
	return strings.TrimSpace(value)
}

func hasProjectPreviewShareID(value string) bool {
	normalized := normalizeProjectPreviewShareID(value)
	if normalized == "" {
		return false
	}
	return projectPreviewShareIDPattern.MatchString(normalized)
}

func ProjectPreviewShareIDIsValid(value string) bool {
	return hasProjectPreviewShareID(value)
}

func buildProjectPreviewSharePath(previewShareID string) string {
	previewShareID = normalizeProjectPreviewShareID(previewShareID)
	if previewShareID == "" {
		return ""
	}
	return "/preview/" + previewShareID
}

func buildProjectPreviewShareResult(project *model.Project, message string) *ProjectPreviewShareResult {
	result := &ProjectPreviewShareResult{Message: message}
	if project == nil {
		return result
	}
	result.ProjectID = strings.TrimSpace(project.ProjectID)
	result.PreviewShareEnabled = project.PreviewShareEnabled
	result.PreviewShareID = normalizeProjectPreviewShareID(project.PreviewShareID)
	if result.PreviewShareEnabled == true && result.PreviewShareID != "" {
		result.PreviewSharePath = buildProjectPreviewSharePath(result.PreviewShareID)
		result.PreviewShareURL = result.PreviewSharePath
	}
	return result
}

func (s *ProjectService) EnableProjectPreviewShare(ctx context.Context, projectID string) (*ProjectPreviewShareResult, error) {
	if s == nil || s.projectRepo == nil {
		return nil, fmt.Errorf("project service not available")
	}
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, fmt.Errorf("project id is required")
	}
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	previewShareID := normalizeProjectPreviewShareID(project.PreviewShareID)
	if hasProjectPreviewShareID(previewShareID) == false {
		generatedShareID, generateErr := generateProjectPreviewShareID()
		if generateErr != nil {
			return nil, generateErr
		}
		previewShareID = generatedShareID
	}
	if err := s.projectRepo.UpdateFields(ctx, project.ProjectID, map[string]interface{}{
		"preview_share_enabled": true,
		"preview_share_id":      previewShareID,
	}); err != nil {
		return nil, err
	}
	project.PreviewShareEnabled = true
	project.PreviewShareID = previewShareID
	return buildProjectPreviewShareResult(project, "预览分享已开启，获取链接的人可以访问该项目预览。"), nil
}

func (s *ProjectService) DisableProjectPreviewShare(ctx context.Context, projectID string) (*ProjectPreviewShareResult, error) {
	if s == nil || s.projectRepo == nil {
		return nil, fmt.Errorf("project service not available")
	}
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, fmt.Errorf("project id is required")
	}
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if err := s.projectRepo.UpdateFields(ctx, project.ProjectID, map[string]interface{}{
		"preview_share_enabled": false,
	}); err != nil {
		return nil, err
	}
	project.PreviewShareEnabled = false
	return buildProjectPreviewShareResult(project, "预览分享已关闭，原分享链接不能继续访问。"), nil
}

func (s *ProjectService) GetProjectByPreviewShareID(ctx context.Context, previewShareID string) (*model.Project, error) {
	if s == nil || s.projectRepo == nil {
		return nil, fmt.Errorf("project service not available")
	}
	previewShareID = normalizeProjectPreviewShareID(previewShareID)
	if hasProjectPreviewShareID(previewShareID) == false {
		return nil, fmt.Errorf("preview share is not found")
	}
	project, err := s.projectRepo.FindByPreviewShareID(ctx, previewShareID)
	if err != nil {
		return nil, fmt.Errorf("preview share is not found")
	}
	if project == nil || project.PreviewShareEnabled == false || normalizeProjectPreviewShareID(project.PreviewShareID) != previewShareID {
		return nil, fmt.Errorf("preview share is not found")
	}
	return project, nil
}
