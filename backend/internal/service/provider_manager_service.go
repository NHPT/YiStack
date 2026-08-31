package service

import (
	"context"
	"fmt"
	"log"
	"strings"

	"yistack/config"
	"yistack/pkg/llm"
)

// ProviderManagerService 管理 LLM ProviderManager 的热加载。
type ProviderManagerService struct {
	providerMgr *llm.ProviderManager
	llmRepo     LLMProviderRepo
	llmCfg      *config.LLMConfig
}

// RecordProviderUse 记录一次成功的真实 LLM provider 调用。
// runtime provider 可能是 "provider::model_id"，数据库 provider id 保存在运行态配置中。
func (s *ProviderManagerService) RecordProviderUse(ctx context.Context, providerName string) error {
	if s == nil || s.providerMgr == nil || s.llmRepo == nil {
		return nil
	}
	providerName = strings.TrimSpace(providerName)
	if providerName == "" {
		return nil
	}
	config := s.providerMgr.GetConfig(providerName)
	if config == nil || config.ProviderID <= 0 {
		return nil
	}
	if err := s.llmRepo.IncrementUseCount(ctx, config.ProviderID); err != nil {
		log.Printf("failed to record LLM provider use for %s(id=%d): %v", providerName, config.ProviderID, err)
		return err
	}
	return nil
}

type ProviderRuntimeSnapshot struct {
	CurrentProvider string              `json:"current_provider"`
	LoadedCount     int                 `json:"loaded_count"`
	Providers       []llm.ProviderInfo  `json:"providers"`
	LoadedByName    map[string]struct{} `json:"-"`
}

// NewProviderManagerService 创建 ProviderManager 服务
func NewProviderManagerService(providerMgr *llm.ProviderManager, llmRepo LLMProviderRepo, llmCfgs ...*config.LLMConfig) *ProviderManagerService {
	var llmCfg *config.LLMConfig
	for _, candidate := range llmCfgs {
		if candidate != nil {
			llmCfg = candidate
			break
		}
	}
	return &ProviderManagerService{
		providerMgr: providerMgr,
		llmRepo:     llmRepo,
		llmCfg:      llmCfg,
	}
}

// Reload 从数据库重新加载 LLM 提供商配置，无需重启后端。
func (s *ProviderManagerService) Reload(ctx context.Context) error {
	if s.providerMgr == nil {
		return fmt.Errorf("provider manager not initialized")
	}
	if s.llmRepo == nil {
		return fmt.Errorf("LLM repository not initialized")
	}
	if err := s.providerMgr.ReloadFromDB(ctx, s.llmRepo); err != nil {
		return err
	}
	s.registerDeterministicProvider()
	return nil
}

// EnsureLoaded 确保 ProviderManager 至少存在一个可用 provider。
// 运行态为空时会自动尝试从数据库重新加载，避免数据库已有配置但内存态未同步。
func (s *ProviderManagerService) EnsureLoaded(ctx context.Context) error {
	if s == nil {
		return fmt.Errorf("provider manager service not initialized")
	}
	if s.providerMgr == nil {
		return fmt.Errorf("provider manager not initialized")
	}
	if len(s.providerMgr.ListProviders()) > 0 && strings.TrimSpace(s.providerMgr.GetCurrentName()) != "" {
		return nil
	}
	return s.Reload(ctx)
}

func (s *ProviderManagerService) Snapshot() ProviderRuntimeSnapshot {
	if s == nil || s.providerMgr == nil {
		return ProviderRuntimeSnapshot{
			Providers:    []llm.ProviderInfo{},
			LoadedByName: map[string]struct{}{},
		}
	}

	providers := s.providerMgr.ListProvidersDetailed()
	loadedByName := make(map[string]struct{}, len(providers))
	for _, item := range providers {
		loadedByName[item.Name] = struct{}{}
	}

	return ProviderRuntimeSnapshot{
		CurrentProvider: s.providerMgr.GetCurrentName(),
		LoadedCount:     len(providers),
		Providers:       providers,
		LoadedByName:    loadedByName,
	}
}

func (s *ProviderManagerService) registerDeterministicProvider() {
	if s == nil || s.providerMgr == nil || s.llmCfg == nil || s.llmCfg.DeterministicEnabled == false {
		return
	}
	s.providerMgr.RegisterProvider("deterministic", llm.NewDeterministicProvider(), &llm.ProviderConfig{
		BaseURL:     "local://deterministic",
		Model:       "yistack-deterministic-dev",
		DisplayName: "YiStack Deterministic Dev",
		Type:        "local",
		Temperature: 0,
		MaxTokens:   s.llmCfg.MaxTokens,
		Timeout:     s.llmCfg.Timeout,
	})
	if strings.EqualFold(strings.TrimSpace(s.llmCfg.ActiveProvider), "deterministic") || strings.TrimSpace(s.providerMgr.GetCurrentName()) == "" {
		_ = s.providerMgr.SetCurrent("deterministic")
	}
}

// GetActiveProviders 获取当前活跃的提供商列表。
func (s *ProviderManagerService) GetActiveProviders(ctx context.Context) ([]map[string]interface{}, error) {
	if s.llmRepo == nil {
		return nil, fmt.Errorf("LLM repository not initialized")
	}
	providers, err := s.llmRepo.ListAllSafe(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]map[string]interface{}, 0, len(providers))
	for _, p := range providers {
		result = append(result, map[string]interface{}{
			"id":           p.ID,
			"name":         p.Name,
			"display_name": p.DisplayName,
			"type":         p.Type,
			"base_url":     p.BaseURL,
			"model":        p.Model,
			"enabled":      p.Enabled,
			"is_default":   p.IsDefault,
			"sort_order":   p.SortOrder,
		})
	}
	return result, nil
}
