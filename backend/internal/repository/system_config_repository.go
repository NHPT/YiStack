package repository

import (
	"context"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/database"
)

// SystemConfigRepository 系统配置仓储
type SystemConfigRepository struct {
	db *gorm.DB
}

// NewSystemConfigRepository 创建系统配置仓储
func NewSystemConfigRepository(db database.Database) *SystemConfigRepository {
	return &SystemConfigRepository{db: db.GetDB()}
}

func (r *SystemConfigRepository) Get(ctx context.Context, key string) (*model.SystemConfig, error) {
	var config model.SystemConfig
	err := r.db.WithContext(ctx).Where("key = ?", key).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *SystemConfigRepository) Set(ctx context.Context, key, value string) error {
	return r.db.WithContext(ctx).Save(&model.SystemConfig{
		Key:   key,
		Value: value,
	}).Error
}

func (r *SystemConfigRepository) List(ctx context.Context) ([]model.SystemConfig, error) {
	var configs []model.SystemConfig
	err := r.db.WithContext(ctx).Find(&configs).Error
	if err != nil {
		return nil, err
	}
	return configs, nil
}

func (r *SystemConfigRepository) InitDefaults(ctx context.Context) error {
	for _, cfg := range model.DefaultSystemConfigs {
		var existing model.SystemConfig
		err := r.db.WithContext(ctx).Where("key = ?", cfg.Key).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := r.db.WithContext(ctx).Create(&cfg).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
