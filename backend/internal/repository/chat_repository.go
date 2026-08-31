package repository

import (
	"context"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// ChatMessageRepository 聊天消息仓储
type ChatMessageRepository struct {
	db *gorm.DB
}

// NewChatMessageRepository 创建聊天消息仓储
func NewChatMessageRepository(db database.Database) *ChatMessageRepository {
	return &ChatMessageRepository{db: db.GetDB()}
}

func (r *ChatMessageRepository) Create(ctx context.Context, msg *model.ChatMessage) error {
	return r.db.WithContext(ctx).Create(msg).Error
}

func (r *ChatMessageRepository) ListByProjectID(ctx context.Context, projectID string) ([]model.ChatMessage, error) {
	var messages []model.ChatMessage
	err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at ASC").Find(&messages).Error
	if err != nil {
		return nil, err
	}
	return messages, nil
}

func (r *ChatMessageRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	return r.db.WithContext(ctx).Where("project_id = ?", projectID).Delete(&model.ChatMessage{}).Error
}
