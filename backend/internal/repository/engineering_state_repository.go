package repository

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// EngineeringStateRepository 项目级工程状态仓储。
type EngineeringStateRepository struct {
	db *gorm.DB
}

// NewEngineeringStateRepository 创建项目级工程状态仓储。
func NewEngineeringStateRepository(db database.Database) *EngineeringStateRepository {
	return &EngineeringStateRepository{db: db.GetDB()}
}

func (r *EngineeringStateRepository) UpsertSnapshot(ctx context.Context, state *model.ProjectEngineeringState) error {
	if r == nil || r.db == nil || state == nil {
		return nil
	}

	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "project_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_id",
			"workflow_stage",
			"workflow_mode",
			"workflow_status",
			"state",
			"content",
			"model",
			"updated_at",
		}),
	}).Create(state).Error
}

func (r *EngineeringStateRepository) FindByProjectID(ctx context.Context, projectID string) (*model.ProjectEngineeringState, error) {
	if r == nil || r.db == nil {
		return nil, gorm.ErrRecordNotFound
	}

	var state model.ProjectEngineeringState
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).First(&state).Error
	if err != nil {
		return nil, err
	}
	return &state, nil
}

func (r *EngineeringStateRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	if r == nil || r.db == nil {
		return nil
	}
	return r.db.WithContext(ctx).Where("project_id = ?", projectID).Delete(&model.ProjectEngineeringState{}).Error
}
