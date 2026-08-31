package repository

import (
	"context"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// GeneratedFileRepository 生成文件仓储
type GeneratedFileRepository struct {
	db *gorm.DB
}

// NewGeneratedFileRepository 创建生成文件仓储
func NewGeneratedFileRepository(db database.Database) *GeneratedFileRepository {
	return &GeneratedFileRepository{db: db.GetDB()}
}

func (r *GeneratedFileRepository) Create(ctx context.Context, file *model.ProjectFile) error {
	return r.db.WithContext(ctx).Create(file).Error
}

func (r *GeneratedFileRepository) BatchCreate(ctx context.Context, files []model.ProjectFile) error {
	return r.db.WithContext(ctx).Create(&files).Error
}

func (r *GeneratedFileRepository) FindByProjectID(ctx context.Context, projectID string) ([]model.ProjectFile, error) {
	var files []model.ProjectFile
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Find(&files).Error
	if err != nil {
		return nil, err
	}
	return files, nil
}

func (r *GeneratedFileRepository) FindByPath(ctx context.Context, projectID, path string) (*model.ProjectFile, error) {
	var file model.ProjectFile
	err := r.db.WithContext(ctx).Where("project_id = ? AND path = ?", projectID, path).First(&file).Error
	if err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *GeneratedFileRepository) Update(ctx context.Context, file *model.ProjectFile) error {
	return r.db.WithContext(ctx).Save(file).Error
}

func (r *GeneratedFileRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	return r.db.WithContext(ctx).Where("project_id = ?", projectID).Delete(&model.ProjectFile{}).Error
}
