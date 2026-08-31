package repository

import (
	"context"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// CommitRepository 提交记录仓储
type CommitRepository struct {
	db *gorm.DB
}

// NewCommitRepository 创建提交记录仓储
func NewCommitRepository(db database.Database) *CommitRepository {
	return &CommitRepository{db: db.GetDB()}
}

func (r *CommitRepository) Create(ctx context.Context, commit *model.Commit) error {
	return r.db.WithContext(ctx).Create(commit).Error
}

func (r *CommitRepository) ListByProjectID(ctx context.Context, projectID string) ([]model.Commit, error) {
	var commits []model.Commit
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at DESC").Find(&commits).Error
	if err != nil {
		return nil, err
	}
	return commits, nil
}

func (r *CommitRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	return r.db.WithContext(ctx).Where("project_id = ?", projectID).Delete(&model.Commit{}).Error
}
