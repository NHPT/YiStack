package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
	"yistack/pkg/llm"
)

// LLMProviderRepository LLM 提供商仓储
type LLMProviderRepository struct {
	db *gorm.DB
}

// NewLLMProviderRepository 创建 LLM 提供商仓储
func NewLLMProviderRepository(db database.Database) *LLMProviderRepository {
	return &LLMProviderRepository{db: db.GetDB()}
}

func (r *LLMProviderRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&model.LLMProvider{}, &model.LLMProviderModel{})
}

func (r *LLMProviderRepository) InitDefaults(ctx context.Context) error {
	defaults := model.DefaultLLMProviders()
	for _, p := range defaults {
		var existing model.LLMProvider
		if err := r.db.Where("name = ?", p.Name).First(&existing).Error; err == gorm.ErrRecordNotFound {
			if err := r.db.Create(&p).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *LLMProviderRepository) Create(ctx context.Context, provider *model.LLMProvider) error {
	return r.db.WithContext(ctx).Create(provider).Error
}

func (r *LLMProviderRepository) CreateModel(ctx context.Context, providerModel *model.LLMProviderModel) error {
	return r.db.WithContext(ctx).Create(providerModel).Error
}

func (r *LLMProviderRepository) Update(ctx context.Context, provider *model.LLMProvider) error {
	return r.db.WithContext(ctx).Save(provider).Error
}

func (r *LLMProviderRepository) Delete(ctx context.Context, id int64) error {
	return r.db.WithContext(ctx).Delete(&model.LLMProvider{}, "id = ?", id).Error
}

func (r *LLMProviderRepository) FindByID(ctx context.Context, id int64) (*model.LLMProvider, error) {
	var provider model.LLMProvider
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&provider).Error
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

func (r *LLMProviderRepository) FindByName(ctx context.Context, name string) (*model.LLMProvider, error) {
	var provider model.LLMProvider
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&provider).Error
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

func (r *LLMProviderRepository) ListAll(ctx context.Context) ([]model.LLMProvider, error) {
	var providers []model.LLMProvider
	err := r.db.Order("sort_order ASC, priority DESC").Find(&providers).Error
	return providers, err
}

func (r *LLMProviderRepository) ListEnabled(ctx context.Context) ([]model.LLMProvider, error) {
	var providers []model.LLMProvider
	err := r.db.Where("enabled = ?", true).Order("sort_order ASC, priority DESC").Find(&providers).Error
	return providers, err
}

func (r *LLMProviderRepository) ListModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error) {
	var models []model.LLMProviderModel
	err := r.db.WithContext(ctx).
		Where("provider_id = ?", providerID).
		Order("sort_order ASC, priority DESC, id ASC").
		Find(&models).Error
	return models, err
}

func (r *LLMProviderRepository) ListEnabledModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error) {
	var models []model.LLMProviderModel
	err := r.db.WithContext(ctx).
		Where("provider_id = ? AND enabled = ?", providerID, true).
		Order("sort_order ASC, priority DESC, id ASC").
		Find(&models).Error
	return models, err
}

func (r *LLMProviderRepository) ListEnabledProviders(ctx context.Context) ([]model.LLMProvider, error) {
	return r.ListEnabled(ctx)
}

func (r *LLMProviderRepository) ListDBProviders(ctx context.Context) ([]llm.DBProviderRecord, error) {
	providers, err := r.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]llm.DBProviderRecord, 0, len(providers))
	for _, p := range providers {
		models, err := r.ListEnabledModelsByProviderID(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		if len(models) == 0 && strings.TrimSpace(p.Model) != "" {
			models = append(models, model.LLMProviderModel{
				ProviderID:  p.ID,
				ModelID:     p.Model,
				DisplayName: p.Model,
				Enabled:     true,
				IsDefault:   true,
				Priority:    p.Priority,
				SortOrder:   p.SortOrder,
			})
		}
		for _, item := range models {
			modelID := strings.TrimSpace(item.ModelID)
			if modelID == "" {
				continue
			}
			displayName := strings.TrimSpace(item.DisplayName)
			if displayName == "" {
				displayName = modelID
			}
			result = append(result, llm.DBProviderRecord{
				Name:           p.Name + "::" + modelID,
				ProviderID:     p.ID,
				ProviderName:   p.Name,
				DisplayName:    strings.TrimSpace(p.DisplayName) + " / " + displayName,
				APIKey:         p.APIKey,
				BaseURL:        p.BaseURL,
				Model:          modelID,
				IsDefault:      p.IsDefault && item.IsDefault,
				Type:           p.Type,
				CapabilityTags: item.CapabilityTags,
			})
		}
	}
	return result, nil
}

func (r *LLMProviderRepository) GetDefault(ctx context.Context) (*model.LLMProvider, error) {
	var provider model.LLMProvider
	err := r.db.Where("is_default = ?", true).First(&provider).Error
	if err != nil {
		err = r.db.Where("enabled = ?", true).Order("priority DESC").First(&provider).Error
		if err != nil {
			return nil, err
		}
	}
	return &provider, nil
}

func (r *LLMProviderRepository) SetDefault(ctx context.Context, id int64) error {
	if err := r.db.Model(&model.LLMProvider{}).Update("is_default", false).Error; err != nil {
		return err
	}
	return r.db.Model(&model.LLMProvider{}).Where("id = ?", id).Update("is_default", true).Error
}

func (r *LLMProviderRepository) UpsertModel(ctx context.Context, providerModel *model.LLMProviderModel) error {
	if providerModel == nil {
		return nil
	}
	var existing model.LLMProviderModel
	err := r.db.WithContext(ctx).
		Where("provider_id = ? AND model_id = ?", providerModel.ProviderID, providerModel.ModelID).
		First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.CreateModel(ctx, providerModel)
	}
	if err != nil {
		return err
	}
	providerModel.ID = existing.ID
	return r.db.WithContext(ctx).Model(&model.LLMProviderModel{}).
		Where("id = ?", existing.ID).
		Updates(providerModel).Error
}

func (r *LLMProviderRepository) ReplaceProviderModels(ctx context.Context, providerID int64, models []model.LLMProviderModel) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("provider_id = ?", providerID).Delete(&model.LLMProviderModel{}).Error; err != nil {
			return err
		}
		for i := range models {
			models[i].ProviderID = providerID
			if err := tx.Create(&models[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *LLMProviderRepository) DeleteModel(ctx context.Context, providerID int64, modelID string) error {
	return r.db.WithContext(ctx).
		Where("provider_id = ? AND model_id = ?", providerID, modelID).
		Delete(&model.LLMProviderModel{}).Error
}

func (r *LLMProviderRepository) SetDefaultModel(ctx context.Context, providerID int64, modelID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.LLMProviderModel{}).
			Where("provider_id = ?", providerID).
			Update("is_default", false).Error; err != nil {
			return err
		}
		return tx.Model(&model.LLMProviderModel{}).
			Where("provider_id = ? AND model_id = ?", providerID, modelID).
			Update("is_default", true).Error
	})
}

func (r *LLMProviderRepository) IncrementUseCount(ctx context.Context, id int64) error {
	now := time.Now()
	return r.db.Model(&model.LLMProvider{}).Where("id = ?", id).Updates(map[string]interface{}{
		"use_count":    gorm.Expr("use_count + 1"),
		"last_used_at": now,
	}).Error
}

func (r *LLMProviderRepository) ListAllSafe(ctx context.Context) ([]model.LLMProvider, error) {
	var providers []model.LLMProvider
	err := r.db.Select("id, name, display_name, type, base_url, model, enabled, is_default, priority, sort_order, extra_config, use_count, last_used_at, created_at, updated_at").Order("sort_order ASC, priority DESC").Find(&providers).Error
	return providers, err
}
