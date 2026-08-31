package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/utils"
)

const (
	ProjectMemberRoleViewer = "viewer"
	ProjectMemberRoleEditor = "editor"
	ProjectMemberRoleOwner  = "owner"
)

type ProjectCollaborationError struct{ Code, Message string }

func (e *ProjectCollaborationError) Error() string { return e.Message }

type ProjectMemberView struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
type ProjectAccessView struct {
	Role      string `json:"role"`
	CanRead   bool   `json:"can_read"`
	CanWrite  bool   `json:"can_write"`
	CanManage bool   `json:"can_manage"`
}
type ProjectMemberMutationRequest struct {
	Email   string `json:"email"`
	UserID  string `json:"user_id"`
	Role    string `json:"role"`
	Confirm bool   `json:"confirm"`
}
type OfficialTemplateFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}
type OfficialTemplateView struct {
	Template       model.OfficialProjectTemplate         `json:"template"`
	CurrentVersion *model.OfficialProjectTemplateVersion `json:"current_version,omitempty"`
}
type CreateProjectFromTemplateRequest struct {
	Slug, VersionID, Name, Description string
	Confirm                            bool
}
type PublishOfficialTemplateRequest struct {
	Slug, Name, Description, AppType, ExpectedCurrentVersionID string
	Files                                                      []OfficialTemplateFile
	Confirm                                                    bool
}
type RollbackOfficialTemplateRequest struct {
	TargetVersionID, ExpectedCurrentVersionID string
	Confirm                                   bool
}

type ProjectCollaborationService struct {
	repo     ProjectCollaborationRepo
	projects *ProjectService
	users    UserRepo
	now      func() time.Time
}

func NewProjectCollaborationService(repo ProjectCollaborationRepo, projects *ProjectService, users UserRepo) *ProjectCollaborationService {
	return &ProjectCollaborationService{repo: repo, projects: projects, users: users, now: time.Now}
}

func validProjectMemberRole(role string) bool {
	return role == ProjectMemberRoleViewer || role == ProjectMemberRoleEditor
}
func projectAccessForRole(role string) ProjectAccessView {
	return ProjectAccessView{Role: role, CanRead: role == ProjectMemberRoleOwner || role == ProjectMemberRoleEditor || role == ProjectMemberRoleViewer, CanWrite: role == ProjectMemberRoleOwner || role == ProjectMemberRoleEditor, CanManage: role == ProjectMemberRoleOwner}
}
func (s *ProjectCollaborationService) Access(ctx context.Context, userID string, project *model.Project) (ProjectAccessView, error) {
	if project == nil {
		return ProjectAccessView{}, &ProjectCollaborationError{Code: "project_not_found", Message: "Project not found"}
	}
	if strings.TrimSpace(project.UserID) == strings.TrimSpace(userID) {
		return projectAccessForRole(ProjectMemberRoleOwner), nil
	}
	if s == nil || s.repo == nil {
		return ProjectAccessView{}, &ProjectCollaborationError{Code: "collaboration_unavailable", Message: "Project collaboration is unavailable"}
	}
	member, err := s.repo.FindMember(ctx, project.ProjectID, userID)
	if err != nil {
		return ProjectAccessView{}, err
	}
	return projectAccessForRole(member.Role), nil
}
func (s *ProjectCollaborationService) requireOwner(ctx context.Context, actorID, projectID string) (*model.Project, error) {
	if s == nil || s.projects == nil {
		return nil, &ProjectCollaborationError{Code: "collaboration_unavailable", Message: "Project collaboration is unavailable"}
	}
	project, err := s.projects.GetProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil || strings.TrimSpace(project.UserID) != strings.TrimSpace(actorID) {
		return nil, &ProjectCollaborationError{Code: "project_owner_required", Message: "Only the project owner can manage members"}
	}
	return project, nil
}
func (s *ProjectCollaborationService) ListMembers(ctx context.Context, actorID, projectID string) ([]ProjectMemberView, error) {
	project, err := s.requireOwner(ctx, actorID, projectID)
	if err != nil {
		return nil, err
	}
	ownerView := ProjectMemberView{UserID: project.UserID, Role: ProjectMemberRoleOwner, Status: "active", CreatedAt: project.CreatedAt, UpdatedAt: project.UpdatedAt}
	if owner, ownerErr := s.users.FindByID(ctx, project.UserID); ownerErr == nil && owner != nil {
		ownerView.Email = owner.Email
		ownerView.Username = owner.Username
	}
	items := []ProjectMemberView{ownerView}
	members, err := s.repo.ListMembers(ctx, projectID)
	if err != nil {
		return nil, err
	}
	for _, member := range members {
		view := ProjectMemberView{ID: member.ID, UserID: member.UserID, Role: member.Role, Status: member.Status, CreatedAt: member.CreatedAt, UpdatedAt: member.UpdatedAt}
		if user, userErr := s.users.FindByID(ctx, member.UserID); userErr == nil && user != nil {
			view.Email = user.Email
			view.Username = user.Username
		}
		items = append(items, view)
	}
	return items, nil
}
func (s *ProjectCollaborationService) AddOrUpdateMember(ctx context.Context, actorID, projectID string, req ProjectMemberMutationRequest) (ProjectMemberView, error) {
	project, err := s.requireOwner(ctx, actorID, projectID)
	if err != nil {
		return ProjectMemberView{}, err
	}
	if !req.Confirm {
		return ProjectMemberView{}, &ProjectCollaborationError{Code: "member_confirmation_required", Message: "Member change requires explicit confirmation"}
	}
	role := strings.TrimSpace(req.Role)
	if !validProjectMemberRole(role) {
		return ProjectMemberView{}, &ProjectCollaborationError{Code: "member_role_invalid", Message: "Role must be viewer or editor"}
	}
	var user *model.User
	if strings.TrimSpace(req.UserID) != "" {
		user, err = s.users.FindByID(ctx, strings.TrimSpace(req.UserID))
	} else {
		user, err = s.users.FindByEmail(ctx, strings.ToLower(strings.TrimSpace(req.Email)))
	}
	if err != nil || user == nil {
		return ProjectMemberView{}, &ProjectCollaborationError{Code: "member_user_not_found", Message: "The invited user must already be registered"}
	}
	if user.Status != "active" {
		return ProjectMemberView{}, &ProjectCollaborationError{Code: "member_user_inactive", Message: "The invited user is not active"}
	}
	if user.ID == project.UserID {
		return ProjectMemberView{}, &ProjectCollaborationError{Code: "member_owner_conflict", Message: "The project owner cannot be added as a member"}
	}
	now := s.now()
	action := "member_added"
	previousRole := ""
	memberID := utils.GenerateUUID()
	if existing, findErr := s.repo.FindMember(ctx, projectID, user.ID); findErr == nil && existing != nil {
		action = "member_role_updated"
		previousRole = existing.Role
		memberID = existing.ID
		if existing.Role == role {
			return ProjectMemberView{ID: existing.ID, UserID: user.ID, Email: user.Email, Username: user.Username, Role: role, Status: "active", CreatedAt: existing.CreatedAt, UpdatedAt: existing.UpdatedAt}, nil
		}
	}
	member := &model.ProjectMember{ID: memberID, ProjectID: projectID, UserID: user.ID, Role: role, Status: "active", InvitedByUserID: actorID, CreatedAt: now, UpdatedAt: now}
	audit := &model.ProjectCollaborationAudit{ID: utils.GenerateUUID(), ProjectID: projectID, ActorUserID: actorID, TargetUserID: user.ID, Action: action, PreviousRole: previousRole, NextRole: role, MetadataJSON: "{}", CreatedAt: now}
	if err := s.repo.UpsertMemberWithAudit(ctx, member, audit); err != nil {
		return ProjectMemberView{}, err
	}
	return ProjectMemberView{ID: member.ID, UserID: user.ID, Email: user.Email, Username: user.Username, Role: role, Status: "active", CreatedAt: member.CreatedAt, UpdatedAt: member.UpdatedAt}, nil
}
func (s *ProjectCollaborationService) RemoveMember(ctx context.Context, actorID, projectID, userID string, confirm bool) error {
	if _, err := s.requireOwner(ctx, actorID, projectID); err != nil {
		return err
	}
	if !confirm {
		return &ProjectCollaborationError{Code: "member_confirmation_required", Message: "Member removal requires explicit confirmation"}
	}
	member, err := s.repo.FindMember(ctx, projectID, userID)
	if err != nil {
		return err
	}
	now := s.now()
	return s.repo.DeleteMemberWithAudit(ctx, projectID, userID, &model.ProjectCollaborationAudit{ID: utils.GenerateUUID(), ProjectID: projectID, ActorUserID: actorID, TargetUserID: userID, Action: "member_removed", PreviousRole: member.Role, MetadataJSON: "{}", CreatedAt: now})
}
func (s *ProjectCollaborationService) ListAudits(ctx context.Context, actorID, projectID string) ([]model.ProjectCollaborationAudit, error) {
	if _, err := s.requireOwner(ctx, actorID, projectID); err != nil {
		return nil, err
	}
	return s.repo.ListCollaborationAudits(ctx, projectID, 50)
}

func normalizeTemplateFiles(files []OfficialTemplateFile) ([]OfficialTemplateFile, string, string, error) {
	if len(files) == 0 || len(files) > 100 {
		return nil, "", "", &ProjectCollaborationError{Code: "template_files_invalid", Message: "Template must contain 1 to 100 files"}
	}
	normalized := make([]OfficialTemplateFile, 0, len(files))
	seen := map[string]struct{}{}
	total := 0
	for _, item := range files {
		path, err := normalizeProjectRelativePath(item.Path)
		if err != nil || isProtectedGenerationPath(path) {
			return nil, "", "", &ProjectCollaborationError{Code: "template_path_invalid", Message: "Template contains an invalid path"}
		}
		if _, ok := seen[path]; ok {
			return nil, "", "", &ProjectCollaborationError{Code: "template_path_duplicate", Message: "Template contains a duplicate path"}
		}
		seen[path] = struct{}{}
		total += len(item.Content)
		if total > 2*1024*1024 {
			return nil, "", "", &ProjectCollaborationError{Code: "template_too_large", Message: "Template exceeds 2 MiB"}
		}
		normalized = append(normalized, OfficialTemplateFile{Path: path, Content: item.Content})
	}
	sort.Slice(normalized, func(i, j int) bool { return normalized[i].Path < normalized[j].Path })
	raw, _ := json.Marshal(normalized)
	manifest, _ := json.Marshal(map[string]interface{}{"file_count": len(normalized), "paths": templatePaths(normalized), "size": total})
	return normalized, string(raw), string(manifest), nil
}
func templatePaths(files []OfficialTemplateFile) []string {
	paths := make([]string, 0, len(files))
	for _, file := range files {
		paths = append(paths, file.Path)
	}
	return paths
}
func templateChecksum(filesJSON string) string {
	sum := sha256.Sum256([]byte(filesJSON))
	return hex.EncodeToString(sum[:])
}
func (s *ProjectCollaborationService) ListOfficialTemplates(ctx context.Context) ([]OfficialTemplateView, error) {
	templates, err := s.repo.ListOfficialTemplates(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]OfficialTemplateView, 0, len(templates))
	for i := range templates {
		view := OfficialTemplateView{Template: templates[i]}
		if templates[i].CurrentVersionID != "" {
			version, versionErr := s.repo.FindOfficialTemplateVersion(ctx, templates[i].CurrentVersionID)
			if versionErr == nil {
				view.CurrentVersion = version
			}
		}
		views = append(views, view)
	}
	return views, nil
}
func (s *ProjectCollaborationService) ListTemplateVersions(ctx context.Context, templateID string) ([]model.OfficialProjectTemplateVersion, error) {
	return s.repo.ListOfficialTemplateVersions(ctx, templateID)
}
func (s *ProjectCollaborationService) PublishTemplate(ctx context.Context, actorID string, req PublishOfficialTemplateRequest) (*OfficialTemplateView, error) {
	if !req.Confirm {
		return nil, &ProjectCollaborationError{Code: "template_confirmation_required", Message: "Template publication requires explicit confirmation"}
	}
	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	if slug == "" || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.AppType) == "" {
		return nil, &ProjectCollaborationError{Code: "template_invalid", Message: "Template slug, name and app type are required"}
	}
	_, filesJSON, manifestJSON, err := normalizeTemplateFiles(req.Files)
	if err != nil {
		return nil, err
	}
	now := s.now()
	template := &model.OfficialProjectTemplate{ID: utils.GenerateUUID(), Slug: slug, Name: strings.TrimSpace(req.Name), Description: strings.TrimSpace(req.Description), AppType: strings.TrimSpace(req.AppType), Status: "active", CreatedAt: now, UpdatedAt: now}
	versions := []model.OfficialProjectTemplateVersion{}
	existing, findErr := s.repo.FindOfficialTemplateBySlug(ctx, slug)
	if findErr == nil && existing != nil {
		template.ID = existing.ID
		template.CreatedAt = existing.CreatedAt
		template.CurrentVersionID = existing.CurrentVersionID
		if req.ExpectedCurrentVersionID != existing.CurrentVersionID {
			return nil, &ProjectCollaborationError{Code: "template_current_version_conflict", Message: "Template current version changed"}
		}
		versions, err = s.repo.ListOfficialTemplateVersions(ctx, existing.ID)
		if err != nil {
			return nil, err
		}
	} else if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		return nil, findErr
	}
	versionNumber := 1
	if len(versions) > 0 {
		versionNumber = versions[0].Version + 1
	}
	version := &model.OfficialProjectTemplateVersion{ID: utils.GenerateUUID(), TemplateID: template.ID, Version: versionNumber, Status: "published", ManifestJSON: manifestJSON, FilesJSON: filesJSON, ChecksumSHA256: templateChecksum(filesJSON), CreatedBy: actorID, CreatedAt: now}
	audit := &model.OfficialProjectTemplateAudit{ID: utils.GenerateUUID(), TemplateID: template.ID, ActorID: actorID, Action: "published", PreviousVersionID: template.CurrentVersionID, NextVersionID: version.ID, ExpectedCurrentVersion: req.ExpectedCurrentVersionID, CreatedAt: now}
	if err := s.repo.PublishOfficialTemplateVersion(ctx, template, version, audit); err != nil {
		if existing != nil {
			return nil, &ProjectCollaborationError{Code: "template_current_version_conflict", Message: "Template current version changed"}
		}
		return nil, err
	}
	template.CurrentVersionID = version.ID
	return &OfficialTemplateView{Template: *template, CurrentVersion: version}, nil
}
func (s *ProjectCollaborationService) RollbackTemplate(ctx context.Context, actorID, templateID string, req RollbackOfficialTemplateRequest) (*OfficialTemplateView, error) {
	if !req.Confirm {
		return nil, &ProjectCollaborationError{Code: "template_confirmation_required", Message: "Template rollback requires explicit confirmation"}
	}
	template, err := s.repo.FindOfficialTemplateByID(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if template.CurrentVersionID != req.ExpectedCurrentVersionID {
		return nil, &ProjectCollaborationError{Code: "template_current_version_conflict", Message: "Template current version changed"}
	}
	target, err := s.repo.FindOfficialTemplateVersion(ctx, req.TargetVersionID)
	if err != nil || target.TemplateID != template.ID {
		return nil, &ProjectCollaborationError{Code: "template_version_not_found", Message: "Target template version was not found"}
	}
	if templateChecksum(target.FilesJSON) != target.ChecksumSHA256 {
		return nil, &ProjectCollaborationError{Code: "template_checksum_invalid", Message: "Target template version checksum is invalid"}
	}
	audit := &model.OfficialProjectTemplateAudit{ID: utils.GenerateUUID(), TemplateID: template.ID, ActorID: actorID, Action: "rolled_back", PreviousVersionID: template.CurrentVersionID, NextVersionID: target.ID, ExpectedCurrentVersion: req.ExpectedCurrentVersionID, CreatedAt: s.now()}
	if err := s.repo.RollbackOfficialTemplateWithAudit(ctx, template.ID, template.CurrentVersionID, target.ID, audit); err != nil {
		return nil, &ProjectCollaborationError{Code: "template_current_version_conflict", Message: "Template current version changed"}
	}
	template.CurrentVersionID = target.ID
	return &OfficialTemplateView{Template: *template, CurrentVersion: target}, nil
}
func (s *ProjectCollaborationService) CreateProjectFromTemplate(ctx context.Context, userID string, req CreateProjectFromTemplateRequest) (*model.Project, error) {
	if !req.Confirm {
		return nil, &ProjectCollaborationError{Code: "template_confirmation_required", Message: "Template project creation requires explicit confirmation"}
	}
	template, err := s.repo.FindOfficialTemplateBySlug(ctx, strings.ToLower(strings.TrimSpace(req.Slug)))
	if err != nil {
		return nil, err
	}
	versionID := strings.TrimSpace(req.VersionID)
	if versionID == "" {
		versionID = template.CurrentVersionID
	}
	version, err := s.repo.FindOfficialTemplateVersion(ctx, versionID)
	if err != nil || version.TemplateID != template.ID {
		return nil, &ProjectCollaborationError{Code: "template_version_not_found", Message: "Template version was not found"}
	}
	if templateChecksum(version.FilesJSON) != version.ChecksumSHA256 {
		return nil, &ProjectCollaborationError{Code: "template_checksum_invalid", Message: "Template checksum verification failed"}
	}
	var files []OfficialTemplateFile
	if err := json.Unmarshal([]byte(version.FilesJSON), &files); err != nil {
		return nil, &ProjectCollaborationError{Code: "template_files_invalid", Message: "Template files are invalid"}
	}
	project, err := s.projects.CreateProject(ctx, &CreateProjectRequest{UserID: userID, Name: req.Name, Description: req.Description, AppType: template.AppType, TechStack: version.ManifestJSON})
	if err != nil {
		return nil, err
	}
	if err := materializeOfficialTemplate(project, files); err != nil {
		cleanupTemplateProject(project)
		_ = s.projects.DeleteProject(ctx, project.ProjectID)
		return nil, err
	}
	if err := commitOfficialTemplateProject(project); err != nil {
		cleanupTemplateProject(project)
		_ = s.projects.DeleteProject(ctx, project.ProjectID)
		return nil, err
	}
	return project, nil
}
func materializeOfficialTemplate(project *model.Project, files []OfficialTemplateFile) error {
	if project == nil {
		return fmt.Errorf("project is required")
	}
	root, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err != nil {
		return err
	}
	for _, file := range files {
		path, err := normalizeProjectRelativePath(file.Path)
		if err != nil || isProtectedGenerationPath(path) {
			return fmt.Errorf("invalid template path")
		}
		target := filepath.Join(root, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		content := strings.ReplaceAll(file.Content, "{{project_name}}", project.Name)
		if err := os.WriteFile(target, []byte(content), 0644); err != nil {
			return err
		}
	}
	return nil
}
func cleanupTemplateProject(project *model.Project) {
	if project == nil {
		return
	}
	root, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err == nil {
		_ = os.RemoveAll(root)
	}
}
func commitOfficialTemplateProject(project *model.Project) error {
	root, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err != nil {
		return err
	}
	if err := runProjectGitCommand(root, "add", "--all"); err != nil {
		return err
	}
	return runProjectGitCommand(root, "-c", "user.name=YiStack", "-c", "user.email=yistack", "commit", "-m", "Initialize from official template")
}
func (s *ProjectCollaborationService) EnsureBuiltinTemplates(ctx context.Context) error {
	if s == nil || s.repo == nil {
		return nil
	}
	expectedCurrentVersion := ""
	if existing, err := s.repo.FindOfficialTemplateBySlug(ctx, "static-web-starter"); err == nil {
		if existing.CurrentVersionID != "" {
			return nil
		}
		expectedCurrentVersion = existing.CurrentVersionID
	} else if !errors.Is(err, gorm.ErrRecordNotFound) && !strings.Contains(strings.ToLower(err.Error()), "not found") {
		return err
	}
	_, err := s.PublishTemplate(ctx, "system", PublishOfficialTemplateRequest{Slug: "static-web-starter", Name: "Static Web Starter", Description: "Minimal responsive static web application", AppType: "static-html", ExpectedCurrentVersionID: expectedCurrentVersion, Confirm: true, Files: []OfficialTemplateFile{{Path: "index.html", Content: "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"stylesheet\" href=\"styles.css\"><title>{{project_name}}</title></head><body><main><h1>{{project_name}}</h1><p>Start building with YiStack.</p></main></body></html>"}, {Path: "styles.css", Content: "body{font-family:system-ui;margin:0;padding:48px;color:#17212b;background:#f7f8fa}main{max-width:720px;margin:auto}"}}})
	return err
}
