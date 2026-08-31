package repository

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"yistack/internal/model"
	"yistack/pkg/database"
)

type ProjectCollaborationRepository struct{ db *gorm.DB }

func NewProjectCollaborationRepository(db database.Database) *ProjectCollaborationRepository {
	return &ProjectCollaborationRepository{db: db.GetDB()}
}

func (r *ProjectCollaborationRepository) FindMember(ctx context.Context, projectID, userID string) (*model.ProjectMember, error) {
	var member model.ProjectMember
	if err := r.db.WithContext(ctx).Where("project_id = ? AND user_id = ? AND status = ?", projectID, userID, "active").First(&member).Error; err != nil {
		return nil, err
	}
	return &member, nil
}
func (r *ProjectCollaborationRepository) ListMembers(ctx context.Context, projectID string) ([]model.ProjectMember, error) {
	var items []model.ProjectMember
	return items, r.db.WithContext(ctx).Where("project_id = ? AND status = ?", projectID, "active").Order("created_at ASC").Find(&items).Error
}
func (r *ProjectCollaborationRepository) ListMembershipsByUserID(ctx context.Context, userID string) ([]model.ProjectMember, error) {
	var items []model.ProjectMember
	return items, r.db.WithContext(ctx).Where("user_id = ? AND status = ?", userID, "active").Order("created_at DESC").Find(&items).Error
}
func (r *ProjectCollaborationRepository) UpsertMemberWithAudit(ctx context.Context, member *model.ProjectMember, audit *model.ProjectCollaborationAudit) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "project_id"}, {Name: "user_id"}}, DoUpdates: clause.AssignmentColumns([]string{"role", "status", "invited_by_user_id", "updated_at"})}).Create(member).Error; err != nil {
			return err
		}
		return tx.Create(audit).Error
	})
}
func (r *ProjectCollaborationRepository) DeleteMemberWithAudit(ctx context.Context, projectID, userID string, audit *model.ProjectCollaborationAudit) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("project_id = ? AND user_id = ?", projectID, userID).Delete(&model.ProjectMember{}).Error; err != nil {
			return err
		}
		return tx.Create(audit).Error
	})
}
func (r *ProjectCollaborationRepository) ListCollaborationAudits(ctx context.Context, projectID string, limit int) ([]model.ProjectCollaborationAudit, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var items []model.ProjectCollaborationAudit
	return items, r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at DESC").Limit(limit).Find(&items).Error
}
func (r *ProjectCollaborationRepository) UpsertOfficialTemplate(ctx context.Context, template *model.OfficialProjectTemplate) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "slug"}}, DoUpdates: clause.AssignmentColumns([]string{"name", "description", "app_type", "status", "updated_at"})}).Create(template).Error
}
func (r *ProjectCollaborationRepository) FindOfficialTemplateBySlug(ctx context.Context, slug string) (*model.OfficialProjectTemplate, error) {
	var item model.OfficialProjectTemplate
	if err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}
func (r *ProjectCollaborationRepository) FindOfficialTemplateByID(ctx context.Context, id string) (*model.OfficialProjectTemplate, error) {
	var item model.OfficialProjectTemplate
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}
func (r *ProjectCollaborationRepository) ListOfficialTemplates(ctx context.Context) ([]model.OfficialProjectTemplate, error) {
	var items []model.OfficialProjectTemplate
	return items, r.db.WithContext(ctx).Where("status = ?", "active").Order("name ASC").Find(&items).Error
}
func (r *ProjectCollaborationRepository) FindOfficialTemplateVersion(ctx context.Context, id string) (*model.OfficialProjectTemplateVersion, error) {
	var item model.OfficialProjectTemplateVersion
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}
func (r *ProjectCollaborationRepository) ListOfficialTemplateVersions(ctx context.Context, templateID string) ([]model.OfficialProjectTemplateVersion, error) {
	var items []model.OfficialProjectTemplateVersion
	return items, r.db.WithContext(ctx).Where("template_id = ?", templateID).Order("version DESC").Find(&items).Error
}
func (r *ProjectCollaborationRepository) PublishOfficialTemplateVersion(ctx context.Context, template *model.OfficialProjectTemplate, version *model.OfficialProjectTemplateVersion, audit *model.OfficialProjectTemplateAudit) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "slug"}}, DoUpdates: clause.AssignmentColumns([]string{"name", "description", "app_type", "status", "updated_at"})}).Create(template).Error; err != nil {
			return err
		}
		var stored model.OfficialProjectTemplate
		if err := tx.Where("slug = ?", template.Slug).First(&stored).Error; err != nil {
			return err
		}
		if stored.CurrentVersionID != audit.ExpectedCurrentVersion {
			return gorm.ErrRecordNotFound
		}
		version.TemplateID = stored.ID
		if err := tx.Create(version).Error; err != nil {
			return err
		}
		if err := tx.Model(&stored).Updates(map[string]interface{}{"current_version_id": version.ID, "updated_at": template.UpdatedAt}).Error; err != nil {
			return err
		}
		audit.TemplateID = stored.ID
		return tx.Create(audit).Error
	})
}
func (r *ProjectCollaborationRepository) RollbackOfficialTemplateWithAudit(ctx context.Context, templateID, expectedCurrentID, targetID string, audit *model.OfficialProjectTemplateAudit) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&model.OfficialProjectTemplate{}).Where("id = ? AND current_version_id = ?", templateID, expectedCurrentID).Update("current_version_id", targetID)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return tx.Create(audit).Error
	})
}
