package repository

import (
	"context"

	"yistack/internal/model"
	"yistack/pkg/database"

	"gorm.io/gorm/clause"
)

type ProjectDeploymentRepository struct{ db database.Database }

func NewProjectDeploymentRepository(db database.Database) *ProjectDeploymentRepository {
	return &ProjectDeploymentRepository{db: db}
}

func (r *ProjectDeploymentRepository) UpsertBinding(ctx context.Context, binding *model.ProjectDeploymentBinding) error {
	return r.db.GetDB().WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "project_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_id", "provider", "provider_project_id", "provider_project_name", "team_id", "updated_at",
		}),
	}).Create(binding).Error
}

func (r *ProjectDeploymentRepository) FindBindingByProjectID(ctx context.Context, projectID string) (*model.ProjectDeploymentBinding, error) {
	var binding model.ProjectDeploymentBinding
	if err := r.db.GetDB().WithContext(ctx).Where("project_id = ?", projectID).First(&binding).Error; err != nil {
		return nil, err
	}
	return &binding, nil
}

func (r *ProjectDeploymentRepository) CreateRelease(ctx context.Context, release *model.ProjectDeploymentRelease) error {
	return r.db.GetDB().WithContext(ctx).Create(release).Error
}

func (r *ProjectDeploymentRepository) UpdateRelease(ctx context.Context, release *model.ProjectDeploymentRelease) error {
	return r.db.GetDB().WithContext(ctx).Model(&model.ProjectDeploymentRelease{}).Where("id = ?", release.ID).Updates(map[string]interface{}{
		"status": release.Status, "url": release.URL, "error_code": release.ErrorCode,
		"error_message": release.ErrorMessage, "ready_at": release.ReadyAt, "updated_at": release.UpdatedAt,
	}).Error
}

func (r *ProjectDeploymentRepository) FindReleaseByID(ctx context.Context, releaseID string) (*model.ProjectDeploymentRelease, error) {
	var release model.ProjectDeploymentRelease
	if err := r.db.GetDB().WithContext(ctx).Where("id = ?", releaseID).First(&release).Error; err != nil {
		return nil, err
	}
	return &release, nil
}

func (r *ProjectDeploymentRepository) ListReleases(ctx context.Context, projectID string, limit int) ([]model.ProjectDeploymentRelease, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var releases []model.ProjectDeploymentRelease
	if err := r.db.GetDB().WithContext(ctx).Where("project_id = ?", projectID).Order("created_at DESC").Limit(limit).Find(&releases).Error; err != nil {
		return nil, err
	}
	return releases, nil
}

func (r *ProjectDeploymentRepository) FindLatestReadyProductionRelease(ctx context.Context, projectID string) (*model.ProjectDeploymentRelease, error) {
	var release model.ProjectDeploymentRelease
	if err := r.db.GetDB().WithContext(ctx).Where("project_id = ? AND target = ? AND status = ?", projectID, "production", "ready").Order("created_at DESC").First(&release).Error; err != nil {
		return nil, err
	}
	return &release, nil
}

func (r *ProjectDeploymentRepository) UpsertDomain(ctx context.Context, domain *model.ProjectDeploymentDomain) error {
	return r.db.GetDB().WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "project_id"}, {Name: "domain"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status", "verified", "verification_type", "verification_domain", "verification_value", "updated_at",
		}),
	}).Create(domain).Error
}

func (r *ProjectDeploymentRepository) FindDomain(ctx context.Context, projectID, domain string) (*model.ProjectDeploymentDomain, error) {
	var record model.ProjectDeploymentDomain
	if err := r.db.GetDB().WithContext(ctx).Where("project_id = ? AND domain = ?", projectID, domain).First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *ProjectDeploymentRepository) ListDomains(ctx context.Context, projectID string) ([]model.ProjectDeploymentDomain, error) {
	var domains []model.ProjectDeploymentDomain
	if err := r.db.GetDB().WithContext(ctx).Where("project_id = ?", projectID).Order("domain ASC").Find(&domains).Error; err != nil {
		return nil, err
	}
	return domains, nil
}

func (r *ProjectDeploymentRepository) DeleteDomain(ctx context.Context, projectID, domain string) error {
	return r.db.GetDB().WithContext(ctx).Where("project_id = ? AND domain = ?", projectID, domain).Delete(&model.ProjectDeploymentDomain{}).Error
}

func (r *ProjectDeploymentRepository) CreateOperation(ctx context.Context, operation *model.ProjectDeploymentOperation) (bool, error) {
	result := r.db.GetDB().WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "idempotency_key"}}, DoNothing: true,
	}).Create(operation)
	return result.RowsAffected == 1, result.Error
}

func (r *ProjectDeploymentRepository) FindOperation(ctx context.Context, userID, idempotencyKey string) (*model.ProjectDeploymentOperation, error) {
	var operation model.ProjectDeploymentOperation
	if err := r.db.GetDB().WithContext(ctx).Where("user_id = ? AND idempotency_key = ?", userID, idempotencyKey).First(&operation).Error; err != nil {
		return nil, err
	}
	return &operation, nil
}

func (r *ProjectDeploymentRepository) UpdateOperation(ctx context.Context, operation *model.ProjectDeploymentOperation) error {
	return r.db.GetDB().WithContext(ctx).Model(&model.ProjectDeploymentOperation{}).Where("id = ?", operation.ID).Updates(map[string]interface{}{
		"status": operation.Status, "result": operation.Result, "error_code": operation.ErrorCode, "updated_at": operation.UpdatedAt,
	}).Error
}
