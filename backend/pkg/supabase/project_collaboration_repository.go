package supabase

import (
	"context"
	"encoding/json"
	"strings"

	"gorm.io/gorm"

	"yistack/internal/model"
)

type ProjectCollaborationRepository struct{ supabase *Client }

func (r *SupabaseRepository) ProjectCollaborationRepository() *ProjectCollaborationRepository {
	return &ProjectCollaborationRepository{supabase: r.client}
}

func (r *ProjectCollaborationRepository) FindMember(_ context.Context, projectID, userID string) (*model.ProjectMember, error) {
	result, err := r.supabase.AdminTable("project_members").Eq("project_id", projectID).Eq("user_id", userID).Eq("status", "active").First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapProjectMember(item), nil
}
func (r *ProjectCollaborationRepository) ListMembers(_ context.Context, projectID string) ([]model.ProjectMember, error) {
	result, err := r.supabase.AdminTable("project_members").Eq("project_id", projectID).Eq("status", "active").Order("created_at", true).SelectQuery()
	if err != nil {
		return nil, err
	}
	items := make([]model.ProjectMember, 0, len(result.Data))
	for _, raw := range result.Data {
		if item, ok := raw.(map[string]interface{}); ok {
			items = append(items, *mapProjectMember(item))
		}
	}
	return items, nil
}
func (r *ProjectCollaborationRepository) ListMembershipsByUserID(_ context.Context, userID string) ([]model.ProjectMember, error) {
	result, err := r.supabase.AdminTable("project_members").Eq("user_id", userID).Eq("status", "active").Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	items := make([]model.ProjectMember, 0, len(result.Data))
	for _, raw := range result.Data {
		if item, ok := raw.(map[string]interface{}); ok {
			items = append(items, *mapProjectMember(item))
		}
	}
	return items, nil
}
func (r *ProjectCollaborationRepository) UpsertMemberWithAudit(_ context.Context, member *model.ProjectMember, audit *model.ProjectCollaborationAudit) error {
	_, err := r.supabase.AdminTable("rpc/mutate_project_member").Insert(map[string]interface{}{
		"p_action": audit.Action, "p_member_id": member.ID, "p_audit_id": audit.ID, "p_project_id": member.ProjectID, "p_actor_user_id": audit.ActorUserID, "p_target_user_id": member.UserID, "p_role": member.Role, "p_previous_role": audit.PreviousRole, "p_now": member.UpdatedAt,
	})
	return err
}
func (r *ProjectCollaborationRepository) DeleteMemberWithAudit(_ context.Context, projectID, userID string, audit *model.ProjectCollaborationAudit) error {
	_, err := r.supabase.AdminTable("rpc/mutate_project_member").Insert(map[string]interface{}{
		"p_action": audit.Action, "p_member_id": "00000000-0000-0000-0000-000000000000", "p_audit_id": audit.ID, "p_project_id": projectID, "p_actor_user_id": audit.ActorUserID, "p_target_user_id": userID, "p_role": "", "p_previous_role": audit.PreviousRole, "p_now": audit.CreatedAt,
	})
	return err
}
func (r *ProjectCollaborationRepository) ListCollaborationAudits(_ context.Context, projectID string, limit int) ([]model.ProjectCollaborationAudit, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	result, err := r.supabase.AdminTable("project_collaboration_audits").Eq("project_id", projectID).Order("created_at", false).Limit(limit).SelectQuery()
	if err != nil {
		return nil, err
	}
	items := make([]model.ProjectCollaborationAudit, 0, len(result.Data))
	for _, raw := range result.Data {
		if item, ok := raw.(map[string]interface{}); ok {
			items = append(items, *mapProjectCollaborationAudit(item))
		}
	}
	return items, nil
}
func (r *ProjectCollaborationRepository) UpsertOfficialTemplate(ctx context.Context, template *model.OfficialProjectTemplate) error {
	existing, err := r.FindOfficialTemplateBySlug(ctx, template.Slug)
	if err == nil {
		template.ID = existing.ID
		data := officialTemplateData(template)
		_, err = r.supabase.AdminTable("official_project_templates").Eq("slug", template.Slug).Update(data)
		return err
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	data := officialTemplateData(template)
	result, err := r.supabase.AdminTable("official_project_templates").Insert(data)
	if item, ok := firstDataMap(result.Data); ok {
		template.ID = stringValue(item["id"])
	}
	return err
}
func (r *ProjectCollaborationRepository) FindOfficialTemplateBySlug(_ context.Context, slug string) (*model.OfficialProjectTemplate, error) {
	return r.findTemplate("slug", slug)
}
func (r *ProjectCollaborationRepository) FindOfficialTemplateByID(_ context.Context, id string) (*model.OfficialProjectTemplate, error) {
	return r.findTemplate("id", id)
}
func (r *ProjectCollaborationRepository) findTemplate(field, value string) (*model.OfficialProjectTemplate, error) {
	result, err := r.supabase.AdminTable("official_project_templates").Eq(field, value).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapOfficialTemplate(item), nil
}
func (r *ProjectCollaborationRepository) ListOfficialTemplates(_ context.Context) ([]model.OfficialProjectTemplate, error) {
	result, err := r.supabase.AdminTable("official_project_templates").Eq("status", "active").Order("name", true).SelectQuery()
	if err != nil {
		return nil, err
	}
	items := make([]model.OfficialProjectTemplate, 0, len(result.Data))
	for _, raw := range result.Data {
		if item, ok := raw.(map[string]interface{}); ok {
			items = append(items, *mapOfficialTemplate(item))
		}
	}
	return items, nil
}
func (r *ProjectCollaborationRepository) FindOfficialTemplateVersion(_ context.Context, id string) (*model.OfficialProjectTemplateVersion, error) {
	result, err := r.supabase.AdminTable("official_project_template_versions").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapOfficialTemplateVersion(item), nil
}
func (r *ProjectCollaborationRepository) ListOfficialTemplateVersions(_ context.Context, templateID string) ([]model.OfficialProjectTemplateVersion, error) {
	result, err := r.supabase.AdminTable("official_project_template_versions").Eq("template_id", templateID).Order("version", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	items := make([]model.OfficialProjectTemplateVersion, 0, len(result.Data))
	for _, raw := range result.Data {
		if item, ok := raw.(map[string]interface{}); ok {
			items = append(items, *mapOfficialTemplateVersion(item))
		}
	}
	return items, nil
}
func (r *ProjectCollaborationRepository) PublishOfficialTemplateVersion(_ context.Context, t *model.OfficialProjectTemplate, v *model.OfficialProjectTemplateVersion, a *model.OfficialProjectTemplateAudit) error {
	_, err := r.supabase.AdminTable("rpc/publish_official_project_template_version").Insert(map[string]interface{}{"p_template_id": t.ID, "p_slug": t.Slug, "p_name": t.Name, "p_description": t.Description, "p_app_type": t.AppType, "p_version_id": v.ID, "p_version": v.Version, "p_manifest": jsonObjectValue(v.ManifestJSON), "p_files": jsonObjectValue(v.FilesJSON), "p_checksum": v.ChecksumSHA256, "p_expected_current_version_id": nullableUUID(a.ExpectedCurrentVersion), "p_actor_id": a.ActorID, "p_audit_id": a.ID, "p_now": t.UpdatedAt})
	return err
}
func (r *ProjectCollaborationRepository) RollbackOfficialTemplateWithAudit(_ context.Context, templateID, expectedCurrentID, targetID string, a *model.OfficialProjectTemplateAudit) error {
	_, err := r.supabase.AdminTable("rpc/rollback_official_project_template_version").Insert(map[string]interface{}{"p_template_id": templateID, "p_expected_current_version_id": expectedCurrentID, "p_target_version_id": targetID, "p_actor_id": a.ActorID, "p_audit_id": a.ID, "p_now": a.CreatedAt})
	return err
}

func nullableUUID(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
func jsonObjectValue(raw string) interface{} {
	var value interface{}
	if err := json.Unmarshal([]byte(raw), &value); err == nil {
		return value
	}
	return map[string]interface{}{}
}
func mapProjectMember(m map[string]interface{}) *model.ProjectMember {
	return &model.ProjectMember{ID: stringValue(m["id"]), ProjectID: stringValue(m["project_id"]), UserID: stringValue(m["user_id"]), Role: stringValue(m["role"]), Status: stringValue(m["status"]), InvitedByUserID: stringValue(m["invited_by_user_id"]), CreatedAt: timeValue(m["created_at"]), UpdatedAt: timeValue(m["updated_at"])}
}
func mapProjectCollaborationAudit(m map[string]interface{}) *model.ProjectCollaborationAudit {
	return &model.ProjectCollaborationAudit{ID: stringValue(m["id"]), ProjectID: stringValue(m["project_id"]), ActorUserID: stringValue(m["actor_user_id"]), TargetUserID: stringValue(m["target_user_id"]), Action: stringValue(m["action"]), PreviousRole: stringValue(m["previous_role"]), NextRole: stringValue(m["next_role"]), MetadataJSON: jsonStringValue(m["metadata_json"]), CreatedAt: timeValue(m["created_at"])}
}
func officialTemplateData(t *model.OfficialProjectTemplate) map[string]interface{} {
	return map[string]interface{}{"id": t.ID, "slug": t.Slug, "name": t.Name, "description": t.Description, "app_type": t.AppType, "status": t.Status, "current_version_id": t.CurrentVersionID, "created_at": t.CreatedAt, "updated_at": t.UpdatedAt}
}
func mapOfficialTemplate(m map[string]interface{}) *model.OfficialProjectTemplate {
	return &model.OfficialProjectTemplate{ID: stringValue(m["id"]), Slug: stringValue(m["slug"]), Name: stringValue(m["name"]), Description: stringValue(m["description"]), AppType: stringValue(m["app_type"]), Status: stringValue(m["status"]), CurrentVersionID: stringValue(m["current_version_id"]), CreatedAt: timeValue(m["created_at"]), UpdatedAt: timeValue(m["updated_at"])}
}
func mapOfficialTemplateVersion(m map[string]interface{}) *model.OfficialProjectTemplateVersion {
	return &model.OfficialProjectTemplateVersion{ID: stringValue(m["id"]), TemplateID: stringValue(m["template_id"]), Version: int(getSupabaseInt64(m["version"])), Status: stringValue(m["status"]), ManifestJSON: jsonStringValue(m["manifest_json"]), FilesJSON: jsonStringValue(m["files_json"]), ChecksumSHA256: stringValue(m["checksum_sha256"]), CreatedBy: stringValue(m["created_by"]), CreatedAt: timeValue(m["created_at"])}
}
