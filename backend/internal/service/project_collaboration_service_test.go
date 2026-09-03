package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
)

type r64CollaborationRepo struct {
	members        map[string]model.ProjectMember
	audits         []model.ProjectCollaborationAudit
	sessions       map[string]model.ProjectCollaborationSession
	events         []model.ProjectCollaborationEvent
	templates      map[string]model.OfficialProjectTemplate
	versions       map[string]model.OfficialProjectTemplateVersion
	templateAudits []model.OfficialProjectTemplateAudit
}

func newR64CollaborationRepo() *r64CollaborationRepo {
	return &r64CollaborationRepo{
		members: map[string]model.ProjectMember{}, sessions: map[string]model.ProjectCollaborationSession{},
		templates: map[string]model.OfficialProjectTemplate{}, versions: map[string]model.OfficialProjectTemplateVersion{},
	}
}
func r64MemberKey(projectID, userID string) string { return projectID + ":" + userID }
func (r *r64CollaborationRepo) FindMember(_ context.Context, p, u string) (*model.ProjectMember, error) {
	v, ok := r.members[r64MemberKey(p, u)]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &v, nil
}
func (r *r64CollaborationRepo) ListMembers(_ context.Context, p string) ([]model.ProjectMember, error) {
	items := []model.ProjectMember{}
	for _, v := range r.members {
		if v.ProjectID == p && v.Status == "active" {
			items = append(items, v)
		}
	}
	return items, nil
}
func (r *r64CollaborationRepo) ListMembershipsByUserID(_ context.Context, u string) ([]model.ProjectMember, error) {
	items := []model.ProjectMember{}
	for _, v := range r.members {
		if v.UserID == u && v.Status == "active" {
			items = append(items, v)
		}
	}
	return items, nil
}
func (r *r64CollaborationRepo) UpsertMemberWithAudit(_ context.Context, m *model.ProjectMember, a *model.ProjectCollaborationAudit) error {
	r.members[r64MemberKey(m.ProjectID, m.UserID)] = *m
	r.audits = append(r.audits, *a)
	return nil
}
func (r *r64CollaborationRepo) DeleteMemberWithAudit(_ context.Context, p, u string, a *model.ProjectCollaborationAudit) error {
	delete(r.members, r64MemberKey(p, u))
	r.audits = append(r.audits, *a)
	return nil
}
func (r *r64CollaborationRepo) ListCollaborationAudits(_ context.Context, p string, _ int) ([]model.ProjectCollaborationAudit, error) {
	items := []model.ProjectCollaborationAudit{}
	for _, v := range r.audits {
		if v.ProjectID == p {
			items = append(items, v)
		}
	}
	return items, nil
}
func (r *r64CollaborationRepo) FindCollaborationSession(_ context.Context, projectID, userID, clientID string) (*model.ProjectCollaborationSession, error) {
	session, ok := r.sessions[projectID+":"+userID+":"+clientID]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &session, nil
}
func (r *r64CollaborationRepo) UpsertCollaborationSessionWithEvent(_ context.Context, session *model.ProjectCollaborationSession, event *model.ProjectCollaborationEvent) error {
	r.sessions[session.ProjectID+":"+session.UserID+":"+session.ClientID] = *session
	if event != nil {
		event.Sequence = int64(len(r.events) + 1)
		r.events = append(r.events, *event)
	}
	return nil
}
func (r *r64CollaborationRepo) LeaveCollaborationSessionWithEvent(_ context.Context, projectID, userID, clientID string, leftAt time.Time, event *model.ProjectCollaborationEvent) error {
	key := projectID + ":" + userID + ":" + clientID
	session, ok := r.sessions[key]
	if !ok || session.Status != "active" {
		return nil
	}
	session.Status = "left"
	session.ExpiresAt = leftAt
	session.UpdatedAt = leftAt
	r.sessions[key] = session
	if event != nil {
		event.Sequence = int64(len(r.events) + 1)
		r.events = append(r.events, *event)
	}
	return nil
}
func (r *r64CollaborationRepo) ExpireCollaborationSessions(_ context.Context, projectID string, expiredAt time.Time) error {
	for key, session := range r.sessions {
		if session.ProjectID != projectID || session.Status != "active" || session.ExpiresAt.After(expiredAt) {
			continue
		}
		session.Status = "expired"
		session.UpdatedAt = expiredAt
		r.sessions[key] = session
		event := newProjectCollaborationEvent(
			projectID,
			session.UserID,
			session.ID,
			ProjectCollaborationEventPresenceExpired,
			session.CurrentFile,
			"",
			map[string]interface{}{"activity": session.Activity, "role": session.Role},
			expiredAt,
		)
		event.Sequence = int64(len(r.events) + 1)
		r.events = append(r.events, *event)
	}
	return nil
}
func (r *r64CollaborationRepo) ListActiveCollaborationSessions(_ context.Context, projectID string, activeAfter time.Time) ([]model.ProjectCollaborationSession, error) {
	items := []model.ProjectCollaborationSession{}
	for _, session := range r.sessions {
		if session.ProjectID == projectID && session.Status == "active" && session.ExpiresAt.After(activeAfter) {
			items = append(items, session)
		}
	}
	return items, nil
}
func (r *r64CollaborationRepo) AppendCollaborationEvent(_ context.Context, event *model.ProjectCollaborationEvent) error {
	event.Sequence = int64(len(r.events) + 1)
	r.events = append(r.events, *event)
	return nil
}
func (r *r64CollaborationRepo) ListCollaborationEvents(_ context.Context, projectID string, afterSequence int64, limit int) ([]model.ProjectCollaborationEvent, error) {
	items := []model.ProjectCollaborationEvent{}
	for _, event := range r.events {
		if event.ProjectID == projectID && event.Sequence > afterSequence {
			items = append(items, event)
			if len(items) == limit {
				break
			}
		}
	}
	return items, nil
}
func (r *r64CollaborationRepo) UpsertOfficialTemplate(_ context.Context, t *model.OfficialProjectTemplate) error {
	r.templates[t.ID] = *t
	return nil
}
func (r *r64CollaborationRepo) FindOfficialTemplateBySlug(_ context.Context, slug string) (*model.OfficialProjectTemplate, error) {
	for _, v := range r.templates {
		if v.Slug == slug {
			x := v
			return &x, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (r *r64CollaborationRepo) FindOfficialTemplateByID(_ context.Context, id string) (*model.OfficialProjectTemplate, error) {
	v, ok := r.templates[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &v, nil
}
func (r *r64CollaborationRepo) ListOfficialTemplates(_ context.Context) ([]model.OfficialProjectTemplate, error) {
	items := []model.OfficialProjectTemplate{}
	for _, v := range r.templates {
		items = append(items, v)
	}
	return items, nil
}
func (r *r64CollaborationRepo) FindOfficialTemplateVersion(_ context.Context, id string) (*model.OfficialProjectTemplateVersion, error) {
	v, ok := r.versions[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &v, nil
}
func (r *r64CollaborationRepo) ListOfficialTemplateVersions(_ context.Context, id string) ([]model.OfficialProjectTemplateVersion, error) {
	items := []model.OfficialProjectTemplateVersion{}
	for _, v := range r.versions {
		if v.TemplateID == id {
			items = append(items, v)
		}
	}
	return items, nil
}
func (r *r64CollaborationRepo) PublishOfficialTemplateVersion(_ context.Context, t *model.OfficialProjectTemplate, v *model.OfficialProjectTemplateVersion, a *model.OfficialProjectTemplateAudit) error {
	r.templates[t.ID] = *t
	v.TemplateID = t.ID
	r.versions[v.ID] = *v
	t.CurrentVersionID = v.ID
	r.templates[t.ID] = *t
	a.TemplateID = t.ID
	r.templateAudits = append(r.templateAudits, *a)
	return nil
}
func (r *r64CollaborationRepo) RollbackOfficialTemplateWithAudit(_ context.Context, id, expected, target string, a *model.OfficialProjectTemplateAudit) error {
	t, ok := r.templates[id]
	if !ok || t.CurrentVersionID != expected {
		return gorm.ErrRecordNotFound
	}
	t.CurrentVersionID = target
	r.templates[id] = t
	r.templateAudits = append(r.templateAudits, *a)
	return nil
}

type r64UserRepo struct{ users map[string]model.User }

func (r *r64UserRepo) Create(_ context.Context, u *model.User) error { r.users[u.ID] = *u; return nil }
func (r *r64UserRepo) FindByID(_ context.Context, id string) (*model.User, error) {
	u, ok := r.users[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &u, nil
}
func (r *r64UserRepo) FindByEmail(_ context.Context, email string) (*model.User, error) {
	for _, u := range r.users {
		if u.Email == email {
			x := u
			return &x, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}
func (r *r64UserRepo) FindByUsername(_ context.Context, name string) (*model.User, error) {
	return nil, gorm.ErrRecordNotFound
}
func (r *r64UserRepo) Update(context.Context, *model.User) error                          { return nil }
func (r *r64UserRepo) UpdateLLMConfig(context.Context, string, string, string, int) error { return nil }
func (r *r64UserRepo) List(context.Context, int, int) ([]model.User, int64, error) {
	return nil, 0, nil
}

type r64ProjectRepo struct{ project *model.Project }

func (r *r64ProjectRepo) Create(_ context.Context, p *model.Project) error { r.project = p; return nil }
func (r *r64ProjectRepo) FindByID(context.Context, string) (*model.Project, error) {
	return r.project, nil
}
func (r *r64ProjectRepo) FindByProjectID(_ context.Context, id string) (*model.Project, error) {
	if r.project == nil || r.project.ProjectID != id {
		return nil, gorm.ErrRecordNotFound
	}
	return r.project, nil
}
func (r *r64ProjectRepo) FindByPreviewShareID(context.Context, string) (*model.Project, error) {
	return nil, gorm.ErrRecordNotFound
}
func (r *r64ProjectRepo) ListByUserID(_ context.Context, id string, _, _ int) ([]model.Project, int64, error) {
	if r.project != nil && r.project.UserID == id {
		return []model.Project{*r.project}, 1, nil
	}
	return []model.Project{}, 0, nil
}
func (r *r64ProjectRepo) ListAll(context.Context, int, int) ([]model.Project, int64, error) {
	return nil, 0, nil
}
func (r *r64ProjectRepo) Update(context.Context, *model.Project) error { return nil }
func (r *r64ProjectRepo) UpdateFields(context.Context, string, map[string]interface{}) error {
	return nil
}
func (r *r64ProjectRepo) UpdateContainerInfo(context.Context, string, string, string, string, int, string) error {
	return nil
}
func (r *r64ProjectRepo) UpdateContainerStatus(context.Context, string, string) error  { return nil }
func (r *r64ProjectRepo) UpdateFileTree(context.Context, string, string) error         { return nil }
func (r *r64ProjectRepo) UpdateDirectoryPath(context.Context, string, string) error    { return nil }
func (r *r64ProjectRepo) UpdatePlanData(context.Context, string, string, string) error { return nil }
func (r *r64ProjectRepo) SoftDelete(context.Context, string) error                     { return nil }
func (r *r64ProjectRepo) RestoreDeleted(context.Context, string) error                 { return nil }
func (r *r64ProjectRepo) RestoreDeletedByOwner(context.Context, string, string) (*model.Project, error) {
	return nil, errors.New("unused")
}
func (r *r64ProjectRepo) HardDelete(context.Context, string) error { return nil }

func TestProjectCollaborationMemberLifecycleAndRoles(t *testing.T) {
	ctx := context.Background()
	repo := newR64CollaborationRepo()
	users := &r64UserRepo{users: map[string]model.User{"owner": {ID: "owner", Email: "owner@example.com", Status: "active"}, "member": {ID: "member", Email: "member@example.com", Username: "Member", Status: "active"}}}
	project := &model.Project{ProjectID: "project-1", UserID: "owner", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	projects := NewProjectService(ProjectServiceOptions{ProjectRepo: &r64ProjectRepo{project: project}, CollaborationRepo: repo})
	svc := NewProjectCollaborationService(repo, projects, users)
	viewer, err := svc.AddOrUpdateMember(ctx, "owner", "project-1", ProjectMemberMutationRequest{Email: "member@example.com", Role: "viewer", Confirm: true})
	if err != nil || viewer.Role != "viewer" {
		t.Fatalf("add viewer: %#v %v", viewer, err)
	}
	access, err := svc.Access(ctx, "member", project)
	if err != nil || !access.CanRead || access.CanWrite {
		t.Fatalf("viewer access=%#v err=%v", access, err)
	}
	editor, err := svc.AddOrUpdateMember(ctx, "owner", "project-1", ProjectMemberMutationRequest{UserID: "member", Role: "editor", Confirm: true})
	if err != nil || editor.Role != "editor" {
		t.Fatalf("update editor: %#v %v", editor, err)
	}
	access, err = svc.Access(ctx, "member", project)
	if err != nil || !access.CanWrite || access.CanManage {
		t.Fatalf("editor access=%#v err=%v", access, err)
	}
	if err := svc.RemoveMember(ctx, "owner", "project-1", "member", true); err != nil {
		t.Fatal(err)
	}
	if len(repo.audits) != 3 {
		t.Fatalf("audit count=%d", len(repo.audits))
	}
}
func TestProjectCollaborationRejectsUnconfirmedAndNonOwnerMutation(t *testing.T) {
	ctx := context.Background()
	repo := newR64CollaborationRepo()
	users := &r64UserRepo{users: map[string]model.User{"member": {ID: "member", Email: "member@example.com", Status: "active"}}}
	projects := NewProjectService(ProjectServiceOptions{ProjectRepo: &r64ProjectRepo{project: &model.Project{ProjectID: "p", UserID: "owner"}}, CollaborationRepo: repo})
	svc := NewProjectCollaborationService(repo, projects, users)
	if _, err := svc.AddOrUpdateMember(ctx, "owner", "p", ProjectMemberMutationRequest{UserID: "member", Role: "viewer"}); err == nil {
		t.Fatal("expected confirmation guard")
	}
	if _, err := svc.AddOrUpdateMember(ctx, "member", "p", ProjectMemberMutationRequest{UserID: "member", Role: "viewer", Confirm: true}); err == nil {
		t.Fatal("expected owner guard")
	}
}
func TestOfficialTemplateVersionPublishAndRollback(t *testing.T) {
	ctx := context.Background()
	repo := newR64CollaborationRepo()
	svc := NewProjectCollaborationService(repo, nil, nil)
	first, err := svc.PublishTemplate(ctx, "admin", PublishOfficialTemplateRequest{Slug: "starter", Name: "Starter", AppType: "static-html", Confirm: true, Files: []OfficialTemplateFile{{Path: "index.html", Content: "v1"}}})
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.PublishTemplate(ctx, "admin", PublishOfficialTemplateRequest{Slug: "starter", Name: "Starter", AppType: "static-html", ExpectedCurrentVersionID: first.CurrentVersion.ID, Confirm: true, Files: []OfficialTemplateFile{{Path: "index.html", Content: "v2"}}})
	if err != nil {
		t.Fatal(err)
	}
	rolled, err := svc.RollbackTemplate(ctx, "admin", first.Template.ID, RollbackOfficialTemplateRequest{TargetVersionID: first.CurrentVersion.ID, ExpectedCurrentVersionID: second.CurrentVersion.ID, Confirm: true})
	if err != nil || rolled.Template.CurrentVersionID != first.CurrentVersion.ID {
		t.Fatalf("rollback=%#v err=%v", rolled, err)
	}
	if _, err := svc.RollbackTemplate(ctx, "admin", first.Template.ID, RollbackOfficialTemplateRequest{TargetVersionID: second.CurrentVersion.ID, ExpectedCurrentVersionID: second.CurrentVersion.ID, Confirm: true}); err == nil {
		t.Fatal("expected stale rollback guard")
	}
}
func TestOfficialTemplateRejectsUnsafePathAndTamperedChecksum(t *testing.T) {
	if _, _, _, err := normalizeTemplateFiles([]OfficialTemplateFile{{Path: "../secret", Content: "x"}}); err == nil {
		t.Fatal("expected unsafe path rejection")
	}
	repo := newR64CollaborationRepo()
	svc := NewProjectCollaborationService(repo, nil, nil)
	view, err := svc.PublishTemplate(context.Background(), "admin", PublishOfficialTemplateRequest{Slug: "starter", Name: "Starter", AppType: "static-html", Confirm: true, Files: []OfficialTemplateFile{{Path: "index.html", Content: "ok"}}})
	if err != nil {
		t.Fatal(err)
	}
	version := repo.versions[view.CurrentVersion.ID]
	version.FilesJSON = "[]"
	repo.versions[version.ID] = version
	if _, err := svc.RollbackTemplate(context.Background(), "admin", view.Template.ID, RollbackOfficialTemplateRequest{TargetVersionID: version.ID, ExpectedCurrentVersionID: version.ID, Confirm: true}); err == nil {
		t.Fatal("expected checksum rejection")
	}
}

func TestGeneratorProjectAccessAllowsEditorAndBlocksViewer(t *testing.T) {
	ctx := context.Background()
	project := &model.Project{ProjectID: "project-1", UserID: "owner"}
	repo := newR64CollaborationRepo()
	repo.members[r64MemberKey("project-1", "editor")] = model.ProjectMember{ProjectID: "project-1", UserID: "editor", Role: ProjectMemberRoleEditor, Status: "active"}
	repo.members[r64MemberKey("project-1", "viewer")] = model.ProjectMember{ProjectID: "project-1", UserID: "viewer", Role: ProjectMemberRoleViewer, Status: "active"}
	generator := &GeneratorService{projectRepo: &r64ProjectRepo{project: project}, collaborationRepo: repo}
	if err := generator.ensureGenerateProjectAccess(ctx, &GenerateRequest{ProjectID: "project-1", UserID: "editor"}); err != nil {
		t.Fatalf("editor should generate: %v", err)
	}
	if err := generator.ensureGenerateProjectAccess(ctx, &GenerateRequest{ProjectID: "project-1", UserID: "viewer"}); err == nil {
		t.Fatal("viewer should not generate")
	}
}
