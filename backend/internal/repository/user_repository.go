package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// UserRepository 用户仓储
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓储
func NewUserRepository(db database.Database) *UserRepository {
	return &UserRepository{db: db.GetDB()}
}

// Create 创建用户
func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// FindByID 根据 ID 查询用户
func (r *UserRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmail 根据邮箱查询用户
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByUsername 根据用户名查询用户
func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Update 更新用户
func (r *UserRepository) Update(ctx context.Context, user *model.User) error {
	if user == nil {
		return gorm.ErrInvalidData
	}
	result := r.db.WithContext(ctx).
		Model(&model.User{}).
		Where("id = ?", user.ID).
		Updates(map[string]interface{}{
			"email":           user.Email,
			"password_hash":   user.PasswordHash,
			"username":        user.Username,
			"avatar_url":      user.AvatarURL,
			"role":            user.Role,
			"status":          user.Status,
			"email_verified":  user.EmailVerified,
			"plan":            user.Plan,
			"llm_model":       user.LLMModel,
			"llm_temperature": user.LLMTemperature,
			"llm_max_tokens":  user.LLMMaxTokens,
			"instance_id":     user.InstanceID,
			"updated_at":      time.Now(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// UpdateLLMConfig 更新用户 LLM 配置
func (r *UserRepository) UpdateLLMConfig(ctx context.Context, userID string, llmModel, temperature string, maxTokens int) error {
	return r.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"llm_model":       llmModel,
		"llm_temperature": temperature,
		"llm_max_tokens":  maxTokens,
	}).Error
}

// Delete permanently removes a regular user and all related business records.
func (r *UserRepository) Delete(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Exec("SELECT public.admin_delete_user(?)", userID).Error
}

// DeleteWithAudit permanently removes a regular user and writes the administrator audit atomically.
func (r *UserRepository) DeleteWithAudit(ctx context.Context, userID, adminID, detail, ipAddress string) error {
	return r.db.WithContext(ctx).Exec(
		"SELECT public.admin_delete_user_with_audit(?, ?, ?, ?)",
		userID, adminID, detail, ipAddress,
	).Error
}

// List 查询用户列表
func (r *UserRepository) List(ctx context.Context, page, pageSize int) ([]model.User, int64, error) {
	var users []model.User
	var total int64

	r.db.WithContext(ctx).Model(&model.User{}).Count(&total)
	offset := (page - 1) * pageSize
	err := r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&users).Error
	if err != nil {
		return nil, 0, err
	}
	return users, total, nil
}
