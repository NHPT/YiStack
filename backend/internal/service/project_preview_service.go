package service

import (
	"context"
	"encoding/base32"
	"fmt"
	"net/url"
	"strings"

	"yistack/config"
	"yistack/internal/model"
)

type ProjectPreviewTarget struct {
	ProjectID    string `json:"projectId"`
	TargetHost   string `json:"targetHost"`
	InternalPort int    `json:"internalPort"`
	PreviewURL   string `json:"previewUrl,omitempty"`
}

var previewSlugEncoding = base32.StdEncoding.WithPadding(base32.NoPadding)

func EncodeProjectPreviewSlug(projectID string) string {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return ""
	}
	return "p-" + strings.ToLower(previewSlugEncoding.EncodeToString([]byte(projectID)))
}

func DecodeProjectPreviewSlug(slug string) (string, bool) {
	normalized := strings.TrimSpace(strings.ToLower(slug))
	if !strings.HasPrefix(normalized, "p-") || len(normalized) <= 2 {
		return "", false
	}

	decoded, err := previewSlugEncoding.DecodeString(strings.ToUpper(normalized[2:]))
	if err != nil {
		return "", false
	}

	projectID := strings.TrimSpace(string(decoded))
	if projectID == "" {
		return "", false
	}
	return projectID, true
}

func ProjectIDFromPreviewHost(host, baseDomain string) (string, bool) {
	host = normalizePreviewHost(host)
	baseDomain = normalizePreviewHost(baseDomain)
	if host == "" || baseDomain == "" || host == baseDomain {
		return "", false
	}
	if !strings.HasSuffix(host, "."+baseDomain) {
		return "", false
	}

	label := strings.TrimSuffix(host, "."+baseDomain)
	if strings.Contains(label, ".") {
		return "", false
	}
	return DecodeProjectPreviewSlug(label)
}

func normalizePreviewHost(host string) string {
	trimmed := strings.TrimSpace(host)
	trimmed = strings.TrimPrefix(trimmed, "http://")
	trimmed = strings.TrimPrefix(trimmed, "https://")
	if idx := strings.Index(trimmed, "/"); idx >= 0 {
		trimmed = trimmed[:idx]
	}
	if idx := strings.Index(trimmed, ":"); idx >= 0 {
		trimmed = trimmed[:idx]
	}
	return strings.ToLower(strings.Trim(trimmed, "."))
}

func (s *ProjectService) BuildProjectPreviewURL(projectID string) string {
	if s == nil {
		return ""
	}
	return buildProjectPreviewURL(projectID, s.containerCfg)
}

func buildProjectPreviewURL(projectID string, containerCfg *config.ContainerConfig) string {
	if containerCfg == nil || strings.TrimSpace(projectID) == "" {
		return ""
	}

	if baseDomain := normalizePreviewHost(containerCfg.PreviewBaseDomain); baseDomain != "" {
		scheme := strings.TrimSpace(containerCfg.PreviewScheme)
		if scheme == "" {
			scheme = "https"
		}
		slug := EncodeProjectPreviewSlug(projectID)
		if slug == "" {
			return ""
		}
		return fmt.Sprintf("%s://%s.%s", scheme, slug, baseDomain)
	}

	base := strings.TrimSpace(containerCfg.PreviewURL)
	if strings.TrimSpace(base) == "" {
		return "/preview"
	}

	parsed, err := url.Parse(base)
	if err != nil {
		return ""
	}
	return parsed.String()
}

func (s *ProjectService) ResolveProjectPreviewTarget(ctx context.Context, projectID string) (*ProjectPreviewTarget, error) {
	if s == nil || s.projectRepo == nil {
		return nil, fmt.Errorf("project repository not available")
	}
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	return s.resolveProjectPreviewTargetFromProject(ctx, project)
}

func (s *ProjectService) AttachPreviewStatus(project *model.Project, status *ProjectRuntimeStatus) *ProjectRuntimeStatus {
	if status == nil || project == nil {
		return status
	}

	baseImage := normalizeRuntimeImage(project.ContainerImage)
	if strings.TrimSpace(baseImage) == "" {
		baseImage = normalizeRuntimeImage(s.getImageForRuntimeProfile(projectRuntimeProfile(project)))
	}
	spec := projectRuntimeEnvironmentSpec(project, baseImage, inferRuntimeImageStrategy(projectRuntimeProfile(project), baseImage, s.containerCfg))
	internalPort := runtimeApplicationPort(spec)
	if internalPort <= 0 {
		internalPort = 3000
	}

	status.InternalPort = internalPort
	status.PreviewURL = s.BuildProjectPreviewURL(project.ProjectID)
	return status
}

func (s *ProjectService) resolveProjectPreviewTargetFromProject(ctx context.Context, project *model.Project) (*ProjectPreviewTarget, error) {
	if project == nil {
		return nil, fmt.Errorf("project is required")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Preview 无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	if !strings.EqualFold(strings.TrimSpace(project.ContainerStatus), "running") {
		return nil, fmt.Errorf("project container is not running")
	}

	baseImage := normalizeRuntimeImage(project.ContainerImage)
	if strings.TrimSpace(baseImage) == "" {
		baseImage = normalizeRuntimeImage(s.getImageForRuntimeProfile(projectRuntimeProfile(project)))
	}
	spec := projectRuntimeEnvironmentSpec(project, baseImage, inferRuntimeImageStrategy(projectRuntimeProfile(project), baseImage, s.containerCfg))
	internalPort := runtimeApplicationPort(spec)
	if internalPort <= 0 {
		internalPort = 3000
	}

	if err := ensureProjectPreviewServer(ctx, s.containerMgr, project, spec, false); err != nil {
		return nil, fmt.Errorf("preview server is not ready: %w", err)
	}

	if s.containerCfg != nil {
		if baseDomain := normalizePreviewHost(s.containerCfg.PreviewTargetDomain); baseDomain != "" {
			slug := EncodeProjectPreviewSlug(project.ProjectID)
			if slug == "" {
				return nil, fmt.Errorf("project preview host is invalid")
			}

			targetPort := s.containerCfg.PreviewTargetPort
			if targetPort <= 0 {
				targetPort = internalPort
			}

			return &ProjectPreviewTarget{
				ProjectID:    project.ProjectID,
				TargetHost:   fmt.Sprintf("%s.%s", slug, baseDomain),
				InternalPort: targetPort,
				PreviewURL:   s.BuildProjectPreviewURL(project.ProjectID),
			}, nil
		}
	}

	endpoint, err := s.containerMgr.ResolveProjectEndpoint(ctx, project.ProjectID, internalPort)
	if err != nil {
		return nil, err
	}

	return &ProjectPreviewTarget{
		ProjectID:    project.ProjectID,
		TargetHost:   endpoint.Address,
		InternalPort: endpoint.InternalPort,
		PreviewURL:   s.BuildProjectPreviewURL(project.ProjectID),
	}, nil
}
