package repository

import (
	"context"
	"time"

	"yistack/internal/model"
	"yistack/pkg/database"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GitHubIntegrationRepository struct {
	db database.Database
}

func NewGitHubIntegrationRepository(db database.Database) *GitHubIntegrationRepository {
	return &GitHubIntegrationRepository{db: db}
}

func (r *GitHubIntegrationRepository) UpsertConnection(ctx context.Context, connection *model.GitHubConnection) error {
	return r.db.GetDB().WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"account_id", "account_login", "account_name", "avatar_url", "scopes",
			"token_ciphertext", "token_nonce", "token_key_version", "updated_at",
		}),
	}).Create(connection).Error
}

func (r *GitHubIntegrationRepository) FindConnectionByUserID(ctx context.Context, userID string) (*model.GitHubConnection, error) {
	var connection model.GitHubConnection
	if err := r.db.GetDB().WithContext(ctx).Where("user_id = ?", userID).First(&connection).Error; err != nil {
		return nil, err
	}
	return &connection, nil
}

func (r *GitHubIntegrationRepository) DeleteConnectionByUserID(ctx context.Context, userID string) error {
	return r.db.GetDB().WithContext(ctx).Where("user_id = ?", userID).Delete(&model.GitHubConnection{}).Error
}

func (r *GitHubIntegrationRepository) CreateOAuthState(ctx context.Context, state *model.GitHubOAuthState) error {
	return r.db.GetDB().WithContext(ctx).Create(state).Error
}

func (r *GitHubIntegrationRepository) ConsumeOAuthState(ctx context.Context, stateHash string, now time.Time) (*model.GitHubOAuthState, error) {
	var state model.GitHubOAuthState
	err := r.db.GetDB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("state_hash = ? AND consumed_at IS NULL AND expires_at > ?", stateHash, now).
			First(&state).Error; err != nil {
			return err
		}
		return tx.Model(&model.GitHubOAuthState{}).
			Where("state_hash = ? AND consumed_at IS NULL", stateHash).
			Update("consumed_at", now).Error
	})
	if err != nil {
		return nil, err
	}
	state.ConsumedAt = &now
	return &state, nil
}

func (r *GitHubIntegrationRepository) UpsertBinding(ctx context.Context, binding *model.GitHubProjectBinding) error {
	return r.db.GetDB().WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "project_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_id", "repository_id", "repository_name", "repository_url",
			"default_branch", "remote_name", "permission_push", "remote_head_sha", "updated_at",
			"webhook_id",
		}),
	}).Create(binding).Error
}

func (r *GitHubIntegrationRepository) FindBindingByProjectID(ctx context.Context, projectID string) (*model.GitHubProjectBinding, error) {
	var binding model.GitHubProjectBinding
	if err := r.db.GetDB().WithContext(ctx).Where("project_id = ?", projectID).First(&binding).Error; err != nil {
		return nil, err
	}
	return &binding, nil
}

func (r *GitHubIntegrationRepository) ListBindingsByRepository(ctx context.Context, repositoryName string) ([]model.GitHubProjectBinding, error) {
	var bindings []model.GitHubProjectBinding
	if err := r.db.GetDB().WithContext(ctx).Where("repository_name = ?", repositoryName).Find(&bindings).Error; err != nil {
		return nil, err
	}
	return bindings, nil
}

func (r *GitHubIntegrationRepository) CreateSyncOperation(ctx context.Context, operation *model.GitHubSyncOperation) (bool, error) {
	result := r.db.GetDB().WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "idempotency_key"}},
		DoNothing: true,
	}).Create(operation)
	return result.RowsAffected == 1, result.Error
}

func (r *GitHubIntegrationRepository) FindSyncOperation(ctx context.Context, userID, idempotencyKey string) (*model.GitHubSyncOperation, error) {
	var operation model.GitHubSyncOperation
	if err := r.db.GetDB().WithContext(ctx).
		Where("user_id = ? AND idempotency_key = ?", userID, idempotencyKey).
		First(&operation).Error; err != nil {
		return nil, err
	}
	return &operation, nil
}

func (r *GitHubIntegrationRepository) UpdateSyncOperation(ctx context.Context, operation *model.GitHubSyncOperation) error {
	return r.db.GetDB().WithContext(ctx).Model(&model.GitHubSyncOperation{}).
		Where("id = ?", operation.ID).
		Updates(map[string]interface{}{
			"status": operation.Status, "result": operation.Result,
			"error_code": operation.ErrorCode, "updated_at": operation.UpdatedAt,
		}).Error
}

func (r *GitHubIntegrationRepository) CreateWebhookDelivery(ctx context.Context, delivery *model.GitHubWebhookDelivery) (bool, error) {
	result := r.db.GetDB().WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "delivery_id"}},
		DoNothing: true,
	}).Create(delivery)
	return result.RowsAffected == 1, result.Error
}
