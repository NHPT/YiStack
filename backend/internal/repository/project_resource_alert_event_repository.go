package repository

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("project_id = ?", projectID).
			Delete(&model.ProjectResourceAlertActionClaim{}).Error; err != nil {
			return err
		}
		return tx.Where("project_id = ?", projectID).
			Delete(&model.ProjectResourceAlertEvent{}).Error
	})
}

func (r *ProjectResourceAlertEventRepository) ClaimAction(
	ctx context.Context,
	claim *model.ProjectResourceAlertActionClaim,
	pendingEvent *model.ProjectResourceAlertEvent,
) (bool, error) {
	if r == nil || r.db == nil || claim == nil || pendingEvent == nil {
		return false, fmt.Errorf("project resource alert action claim repository is unavailable")
	}
	acquired := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		createPendingEvent := func() error {
			if err := tx.Create(pendingEvent).Error; err != nil {
				return fmt.Errorf("create project resource alert pending event: %w", err)
			}
			return nil
		}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(claim)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 1 {
			if err := createPendingEvent(); err != nil {
				return err
			}
			acquired = true
			return nil
		}

		result = tx.Model(&model.ProjectResourceAlertActionClaim{}).
			Where(
				"project_id = ? AND source_event_id = ? AND action = ? AND status = ?",
				claim.ProjectID,
				claim.SourceEventID,
				claim.Action,
				"failed",
			).
			Updates(map[string]interface{}{
				"status":        "pending",
				"actor_user_id": claim.ActorUserID,
				"claimed_at":    claim.ClaimedAt,
				"updated_at":    claim.UpdatedAt,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 1 {
			if err := createPendingEvent(); err != nil {
				return err
			}
			claim.Status = "pending"
			acquired = true
			return nil
		}
		return tx.Where(
			"project_id = ? AND source_event_id = ? AND action = ?",
			claim.ProjectID,
			claim.SourceEventID,
			claim.Action,
		).First(claim).Error
	})
	return acquired, err
}

func (r *ProjectResourceAlertEventRepository) CompleteAction(
	ctx context.Context,
	projectID string,
	sourceEventID int64,
	action string,
	status string,
	updatedAt time.Time,
) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("project resource alert action claim repository is unavailable")
	}
	result := r.db.WithContext(ctx).
		Model(&model.ProjectResourceAlertActionClaim{}).
		Where(
			"project_id = ? AND source_event_id = ? AND action = ? AND status = ?",
			projectID,
			sourceEventID,
			action,
			"pending",
		).
		Updates(map[string]interface{}{
			"status":     status,
			"updated_at": updatedAt,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}
	var claim model.ProjectResourceAlertActionClaim
	if err := r.db.WithContext(ctx).Where(
		"project_id = ? AND source_event_id = ? AND action = ?",
		projectID,
		sourceEventID,
		action,
	).First(&claim).Error; err != nil {
		return err
	}
	if claim.Status != status {
		return fmt.Errorf(
			"project resource alert action claim is %s, want %s",
			claim.Status,
			status,
		)
	}
	return nil
}
