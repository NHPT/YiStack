package repository

import (
	"context"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// AdminAuditLogRepository persists administrator audit events in PostgreSQL.
type AdminAuditLogRepository struct {
	db *gorm.DB
}

func NewAdminAuditLogRepository(db database.Database) *AdminAuditLogRepository {
	return &AdminAuditLogRepository{db: db.GetDB()}
}

func (r *AdminAuditLogRepository) Create(ctx context.Context, audit *model.AdminAuditLog) error {
	return r.db.WithContext(ctx).Create(audit).Error
}

func (r *AdminAuditLogRepository) List(ctx context.Context, offset, limit int) ([]model.AdminAuditLog, error) {
	var audits []model.AdminAuditLog
	query := r.db.WithContext(ctx).Order("created_at DESC")
	if offset > 0 {
		query = query.Offset(offset)
	}
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&audits).Error
	return audits, err
}

func (r *AdminAuditLogRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.AdminAuditLog{}).Count(&count).Error
	return count, err
}
