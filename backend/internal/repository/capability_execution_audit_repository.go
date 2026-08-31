package repository

import (
	"context"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// CapabilityExecutionAuditRepository 记录项目级能力执行审计。
type CapabilityExecutionAuditRepository struct {
	db *gorm.DB
}

func NewCapabilityExecutionAuditRepository(db database.Database) *CapabilityExecutionAuditRepository {
	return &CapabilityExecutionAuditRepository{db: db.GetDB()}
}

func (r *CapabilityExecutionAuditRepository) Create(ctx context.Context, audit *model.ProjectCapabilityExecutionAudit) error {
	if r == nil || r.db == nil || audit == nil {
		return nil
	}
	return r.db.WithContext(ctx).Create(audit).Error
}

func (r *CapabilityExecutionAuditRepository) ListByProjectID(ctx context.Context, projectID, status, capabilityProfile string, offset, limit int) ([]model.ProjectCapabilityExecutionAudit, int64, error) {
	if r == nil || r.db == nil {
		return nil, 0, gorm.ErrRecordNotFound
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := r.db.WithContext(ctx).Model(&model.ProjectCapabilityExecutionAudit{}).Where("project_id = ?", projectID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if capabilityProfile != "" {
		query = query.Where("capability_profile = ?", capabilityProfile)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var records []model.ProjectCapabilityExecutionAudit
	if err := query.Order("created_at DESC, id DESC").Offset(offset).Limit(limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func (r *CapabilityExecutionAuditRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	if r == nil || r.db == nil {
		return nil
	}
	return r.db.WithContext(ctx).Where("project_id = ?", projectID).Delete(&model.ProjectCapabilityExecutionAudit{}).Error
}
