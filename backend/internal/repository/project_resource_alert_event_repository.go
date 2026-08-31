package repository

import (
	"context"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// ProjectResourceAlertEventRepository 记录项目资源告警受控创建事件。
type ProjectResourceAlertEventRepository struct {
	db *gorm.DB
}

func NewProjectResourceAlertEventRepository(db database.Database) *ProjectResourceAlertEventRepository {
	return &ProjectResourceAlertEventRepository{db: db.GetDB()}
}

func (r *ProjectResourceAlertEventRepository) Create(ctx context.Context, event *model.ProjectResourceAlertEvent) error {
	if r == nil || r.db == nil || event == nil {
		return nil
	}
	return r.db.WithContext(ctx).Create(event).Error
}

func (r *ProjectResourceAlertEventRepository) ListByProjectID(ctx context.Context, projectID, status string, offset, limit int) ([]model.ProjectResourceAlertEvent, int64, error) {
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

	query := r.db.WithContext(ctx).Model(&model.ProjectResourceAlertEvent{}).Where("project_id = ?", projectID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var records []model.ProjectResourceAlertEvent
	if err := query.Order("created_at DESC, id DESC").Offset(offset).Limit(limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func (r *ProjectResourceAlertEventRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	if r == nil || r.db == nil {
		return nil
	}
	return r.db.WithContext(ctx).Where("project_id = ?", projectID).Delete(&model.ProjectResourceAlertEvent{}).Error
}
