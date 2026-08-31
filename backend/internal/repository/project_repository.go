package repository

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// ProjectRepository 项目仓储
type ProjectRepository struct {
	db *gorm.DB
}

// NewProjectRepository 创建项目仓储
func NewProjectRepository(db database.Database) *ProjectRepository {
	return &ProjectRepository{db: db.GetDB()}
}

func (r *ProjectRepository) Create(ctx context.Context, project *model.Project) error {
	return r.db.WithContext(ctx).Create(project).Error
}

func (r *ProjectRepository) FindByProjectID(ctx context.Context, projectID string) (*model.Project, error) {
	var project model.Project
	err := r.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *ProjectRepository) FindByPreviewShareID(ctx context.Context, previewShareID string) (*model.Project, error) {
	var project model.Project
	err := r.db.WithContext(ctx).
		Where("preview_share_id = ? AND preview_share_enabled = ? AND deleted_at IS NULL", previewShareID, true).
		First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *ProjectRepository) FindByID(ctx context.Context, id string) (*model.Project, error) {
	var project model.Project
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func (r *ProjectRepository) ListByUserID(ctx context.Context, userID string, page, pageSize int) ([]model.Project, int64, error) {
	var projects []model.Project
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Project{}).Where("user_id = ? AND deleted_at IS NULL", userID)
	query.Count(&total)
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&projects).Error
	if err != nil {
		return nil, 0, err
	}
	return projects, total, nil
}

func (r *ProjectRepository) ListAll(ctx context.Context, page, pageSize int) ([]model.Project, int64, error) {
	var projects []model.Project
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Project{}).Where("deleted_at IS NULL")
	query.Count(&total)
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&projects).Error
	if err != nil {
		return nil, 0, err
	}
	return projects, total, nil
}

func (r *ProjectRepository) ListPublic(ctx context.Context, page, pageSize int) ([]model.Project, int64, error) {
	var projects []model.Project
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Project{}).Where("visibility = ? AND deleted_at IS NULL", "public")
	query.Count(&total)
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("stars DESC, created_at DESC").Find(&projects).Error
	if err != nil {
		return nil, 0, err
	}
	return projects, total, nil
}

func (r *ProjectRepository) Update(ctx context.Context, project *model.Project) error {
	return r.db.WithContext(ctx).Save(project).Error
}

func (r *ProjectRepository) UpdateFields(ctx context.Context, projectID string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now()
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("project_id = ?", projectID).Updates(updates).Error
}

func (r *ProjectRepository) UpdateFileTree(ctx context.Context, projectID string, fileTree string) error {
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("project_id = ?", projectID).Update("file_tree", fileTree).Error
}

func (r *ProjectRepository) UpdateContainerInfo(ctx context.Context, projectID string, containerID, containerName, containerImage string, containerPort int, containerStatus string) error {
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("project_id = ?", projectID).Updates(map[string]interface{}{
		"container_id":     containerID,
		"container_name":   containerName,
		"container_image":  containerImage,
		"container_port":   containerPort,
		"container_status": containerStatus,
	}).Error
}

func (r *ProjectRepository) UpdateContainerStatus(ctx context.Context, projectID string, containerStatus string) error {
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("project_id = ?", projectID).Update("container_status", containerStatus).Error
}

func (r *ProjectRepository) UpdateDirectoryPath(ctx context.Context, projectID string, directoryPath string) error {
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("project_id = ?", projectID).Update("directory_path", directoryPath).Error
}

func (r *ProjectRepository) UpdatePlanData(ctx context.Context, projectID, planID, planData string) error {
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("project_id = ?", projectID).Updates(map[string]interface{}{
		"plan_id":   planID,
		"plan_data": planData,
	}).Error
}

func (r *ProjectRepository) HardDelete(ctx context.Context, projectID string) error {
	return r.db.WithContext(ctx).Unscoped().Where("project_id = ?", projectID).Delete(&model.Project{}).Error
}

func (r *ProjectRepository) SoftDelete(ctx context.Context, projectID string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("project_id = ?", projectID).Updates(map[string]interface{}{
		"deleted_at": now,
		"updated_at": now,
	}).Error
}

func (r *ProjectRepository) RestoreDeleted(ctx context.Context, projectID string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&model.Project{}).Unscoped().Where("project_id = ?", projectID).Updates(map[string]interface{}{
		"deleted_at": nil,
		"updated_at": now,
	}).Error
}

func (r *ProjectRepository) RestoreDeletedByOwner(ctx context.Context, projectID, userID string) (*model.Project, error) {
	var project model.Project
	if err := r.db.WithContext(ctx).Unscoped().
		Where("project_id = ? AND user_id = ?", projectID, userID).
		First(&project).Error; err != nil {
		return nil, err
	}
	if project.DeletedAt == nil {
		return nil, fmt.Errorf("project is not pending deletion")
	}

	now := time.Now()
	if err := r.db.WithContext(ctx).Model(&model.Project{}).Unscoped().
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Updates(map[string]interface{}{
			"deleted_at": nil,
			"updated_at": now,
		}).Error; err != nil {
		return nil, err
	}

	project.DeletedAt = nil
	project.UpdatedAt = now
	return &project, nil
}
