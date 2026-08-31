package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/pkg/llm"
)

// LLMProviderCreateRequest 创建提供商请求。
type LLMProviderCreateRequest struct {
	Name        string
	DisplayName string
	Type        string
	APIKey      string
	BaseURL     string
	Model       string
	Enabled     bool
	IsDefault   bool
	Priority    int
	SortOrder   int
	ExtraConfig string
	Models      []LLMProviderModelRequest
}

// LLMProviderUpdateRequest 更新提供商请求。
type LLMProviderUpdateRequest struct {
	DisplayName *string
	Type        *string
	APIKey      *string
	BaseURL     *string
	Model       *string
	Enabled     *bool
	IsDefault   *bool
	Priority    *int
	SortOrder   *int
	ExtraConfig *string
	Models      *[]LLMProviderModelRequest
}

type LLMProviderModelRequest struct {
	ModelID        string `json:"model_id"`
	DisplayName    string `json:"display_name"`
	Enabled        bool   `json:"enabled"`
	IsDefault      bool   `json:"is_default"`
	CapabilityTags string `json:"capability_tags"`
	ContextWindow  int    `json:"context_window"`
	DefaultFor     string `json:"default_for"`
	Priority       int    `json:"priority"`
	SortOrder      int    `json:"sort_order"`
	ExtraConfig    string `json:"extra_config"`
}

// LLMProviderConnectionTestRequest 测试连接参数请求。
type LLMProviderConnectionTestRequest struct {
	Provider string
	Model    string
	APIKey   string
	BaseURL  string
	Message  string
}

// LLMProviderConnectionTestResult 测试连接参数结果。
type LLMProviderConnectionTestResult struct {
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	HasAPIKey bool   `json:"has_api_key"`
	Status    string `json:"status"`
	LatencyMS int64  `json:"latency_ms"`
	Message   string `json:"message"`
	Recovery  string `json:"recovery"`
}

type LLMProviderModelDiscoveryResult struct {
	ProviderID      int64                      `json:"provider_id"`
	ProviderName    string                     `json:"provider_name"`
	DiscoveredCount int                        `json:"discovered_count"`
	Models          []LLMProviderModelResponse `json:"models"`
	Message         string                     `json:"message"`
	Recovery        string                     `json:"recovery"`
}

// LLMProviderPublicResponse 是普通用户可见的 LLM Provider 展示视图。
// 只包含模型选择需要的非敏感字段，不暴露 base_url、api_key 等配置信息。
type LLMProviderPublicResponse struct {
	ID            int64                      `json:"id"`
	Name          string                     `json:"name"`
	DisplayName   string                     `json:"display_name"`
	Type          string                     `json:"type"`
	Model         string                     `json:"model"`
	IsDefault     bool                       `json:"is_default"`
	RuntimeLoaded bool                       `json:"runtime_loaded"`
	RuntimeActive bool                       `json:"runtime_active"`
	Models        []LLMProviderModelResponse `json:"models"`
}

type LLMProviderModelResponse struct {
	ID             int64  `json:"id"`
	ProviderID     int64  `json:"provider_id"`
	ModelID        string `json:"model_id"`
	DisplayName    string `json:"display_name"`
	Enabled        bool   `json:"enabled"`
	IsDefault      bool   `json:"is_default"`
	CapabilityTags string `json:"capability_tags"`
	ContextWindow  int    `json:"context_window"`
	DefaultFor     string `json:"default_for"`
	Priority       int    `json:"priority"`
	SortOrder      int    `json:"sort_order"`
	ExtraConfig    string `json:"extra_config,omitempty"`
	RuntimeID      string `json:"runtime_id"`
	RuntimeLoaded  bool   `json:"runtime_loaded"`
	RuntimeActive  bool   `json:"runtime_active"`
}

func isLLMProviderRuntimeModelCandidate(item model.LLMProviderModel) bool {
	modelID := strings.TrimSpace(item.ModelID)
	return modelID != "" && item.Enabled == true
}

func isLLMProviderRuntimeLoaded(provider model.LLMProvider, models []model.LLMProviderModel, runtime ProviderRuntimeSnapshot) bool {
	if _, loaded := runtime.LoadedByName[provider.Name]; loaded {
		return true
	}
	effectiveModels := normalizeLLMProviderModels(provider, models)
	for _, item := range effectiveModels {
		if isLLMProviderRuntimeModelCandidate(item) == false {
			continue
		}
		runtimeID := buildLLMProviderRuntimeModelID(provider.Name, item.ModelID)
		if _, loaded := runtime.LoadedByName[runtimeID]; loaded {
			return true
		}
	}
	return false
}

func isLLMProviderRuntimeActive(provider model.LLMProvider, models []model.LLMProviderModel, runtime ProviderRuntimeSnapshot) bool {
	if runtime.CurrentProvider == provider.Name {
		return true
	}
	effectiveModels := normalizeLLMProviderModels(provider, models)
	for _, item := range effectiveModels {
		if isLLMProviderRuntimeModelCandidate(item) == false {
			continue
		}
		runtimeID := buildLLMProviderRuntimeModelID(provider.Name, item.ModelID)
		if runtime.CurrentProvider == runtimeID {
			return true
		}
	}
	return false
}

func toPublicLLMProvider(provider model.LLMProvider, models []model.LLMProviderModel, runtime ProviderRuntimeSnapshot) LLMProviderPublicResponse {
	loaded := isLLMProviderRuntimeLoaded(provider, models, runtime)
	active := isLLMProviderRuntimeActive(provider, models, runtime)
	return LLMProviderPublicResponse{
		ID:            provider.ID,
		Name:          provider.Name,
		DisplayName:   provider.DisplayName,
		Type:          provider.Type,
		Model:         provider.Model,
		IsDefault:     provider.IsDefault,
		RuntimeLoaded: loaded,
		RuntimeActive: active,
		Models:        toLLMProviderModelResponses(provider, models, runtime),
	}
}

// LLMProviderSafeResponse 是管理端返回的 LLM Provider 安全视图。
// API Key 只暴露是否已配置，禁止返回明文或掩码值。
type LLMProviderSafeResponse struct {
	ID            int64                      `json:"id"`
	Name          string                     `json:"name"`
	DisplayName   string                     `json:"display_name"`
	Type          string                     `json:"type"`
	BaseURL       string                     `json:"base_url"`
	Model         string                     `json:"model"`
	Enabled       bool                       `json:"enabled"`
	IsDefault     bool                       `json:"is_default"`
	Priority      int                        `json:"priority"`
	SortOrder     int                        `json:"sort_order"`
	ExtraConfig   string                     `json:"extra_config,omitempty"`
	UseCount      int64                      `json:"use_count"`
	HasAPIKey     bool                       `json:"has_api_key"`
	RuntimeLoaded bool                       `json:"runtime_loaded"`
	RuntimeActive bool                       `json:"runtime_active"`
	Models        []LLMProviderModelResponse `json:"models"`
}

func toSafeLLMProvider(provider model.LLMProvider, models []model.LLMProviderModel, runtime ProviderRuntimeSnapshot) LLMProviderSafeResponse {
	loaded := isLLMProviderRuntimeLoaded(provider, models, runtime)
	active := isLLMProviderRuntimeActive(provider, models, runtime)
	return LLMProviderSafeResponse{
		ID:            provider.ID,
		Name:          provider.Name,
		DisplayName:   provider.DisplayName,
		Type:          provider.Type,
		BaseURL:       provider.BaseURL,
		Model:         provider.Model,
		Enabled:       provider.Enabled,
		IsDefault:     provider.IsDefault,
		Priority:      provider.Priority,
		SortOrder:     provider.SortOrder,
		ExtraConfig:   provider.ExtraConfig,
		UseCount:      provider.UseCount,
		HasAPIKey:     provider.APIKey != "",
		RuntimeLoaded: loaded,
		RuntimeActive: active,
		Models:        toLLMProviderModelResponses(provider, models, runtime),
	}
}

func toLLMProviderModelResponses(
	provider model.LLMProvider,
	models []model.LLMProviderModel,
	runtime ProviderRuntimeSnapshot,
) []LLMProviderModelResponse {
	effectiveModels := normalizeLLMProviderModels(provider, models)
	responses := make([]LLMProviderModelResponse, 0, len(effectiveModels))
	for _, item := range effectiveModels {
		runtimeID := buildLLMProviderRuntimeModelID(provider.Name, item.ModelID)
		_, loaded := runtime.LoadedByName[runtimeID]
		responses = append(responses, LLMProviderModelResponse{
			ID:             item.ID,
			ProviderID:     item.ProviderID,
			ModelID:        item.ModelID,
			DisplayName:    item.DisplayName,
			Enabled:        item.Enabled,
			IsDefault:      item.IsDefault,
			CapabilityTags: item.CapabilityTags,
			ContextWindow:  item.ContextWindow,
			DefaultFor:     item.DefaultFor,
			Priority:       item.Priority,
			SortOrder:      item.SortOrder,
			ExtraConfig:    item.ExtraConfig,
			RuntimeID:      runtimeID,
			RuntimeLoaded:  loaded,
			RuntimeActive:  runtime.CurrentProvider == runtimeID,
		})
	}
	return responses
}

func buildLLMProviderRuntimeModelID(providerName, modelID string) string {
	return strings.TrimSpace(providerName) + "::" + strings.TrimSpace(modelID)
}

func normalizeLLMProviderModelRequest(provider model.LLMProvider, req LLMProviderModelRequest, index int) model.LLMProviderModel {
	modelID := strings.TrimSpace(req.ModelID)
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = modelID
	}
	enabled := req.Enabled
	if modelID != "" && req.Enabled == false && req.IsDefault == false {
		enabled = false
	}
	return model.LLMProviderModel{
		ProviderID:     provider.ID,
		ModelID:        modelID,
		DisplayName:    displayName,
		Enabled:        enabled,
		IsDefault:      req.IsDefault,
		CapabilityTags: strings.TrimSpace(req.CapabilityTags),
		ContextWindow:  req.ContextWindow,
		DefaultFor:     strings.TrimSpace(req.DefaultFor),
		Priority:       req.Priority,
		SortOrder:      firstNonZero(req.SortOrder, index+1),
		ExtraConfig:    strings.TrimSpace(req.ExtraConfig),
	}
}

func normalizeLLMProviderModelRequests(provider model.LLMProvider, requests []LLMProviderModelRequest) []model.LLMProviderModel {
	models := make([]model.LLMProviderModel, 0, len(requests))
	hasDefault := false
	for index, req := range requests {
		modelItem := normalizeLLMProviderModelRequest(provider, req, index)
		if strings.TrimSpace(modelItem.ModelID) == "" {
			continue
		}
		if modelItem.IsDefault {
			hasDefault = true
			modelItem.Enabled = true
		}
		models = append(models, modelItem)
	}
	if len(models) > 0 && hasDefault == false {
		models[0].IsDefault = true
		models[0].Enabled = true
	}
	return models
}

func modelRequestsFromProviderDefault(provider model.LLMProvider) []LLMProviderModelRequest {
	modelID := strings.TrimSpace(provider.Model)
	if modelID == "" {
		return nil
	}
	return []LLMProviderModelRequest{{
		ModelID:        modelID,
		DisplayName:    modelID,
		Enabled:        true,
		IsDefault:      true,
		CapabilityTags: "chat,reasoning,coding",
		DefaultFor:     "chat,foundation,plan,implement,repair",
		Priority:       provider.Priority,
		SortOrder:      provider.SortOrder,
		ExtraConfig:    provider.ExtraConfig,
	}}
}

func getDefaultLLMProviderModelID(models []model.LLMProviderModel) string {
	for _, item := range models {
		if item.IsDefault == true && strings.TrimSpace(item.ModelID) != "" {
			return strings.TrimSpace(item.ModelID)
		}
	}
	for _, item := range models {
		if strings.TrimSpace(item.ModelID) != "" {
			return strings.TrimSpace(item.ModelID)
		}
	}
	return ""
}

func normalizeLLMProviderModels(provider model.LLMProvider, models []model.LLMProviderModel) []model.LLMProviderModel {
	if len(models) > 0 {
		return models
	}
	modelID := strings.TrimSpace(provider.Model)
	if modelID == "" {
		return []model.LLMProviderModel{}
	}
	return []model.LLMProviderModel{{
		ProviderID:     provider.ID,
		ModelID:        modelID,
		DisplayName:    modelID,
		Enabled:        provider.Enabled,
		IsDefault:      true,
		CapabilityTags: "chat,reasoning,coding",
		DefaultFor:     "chat,foundation,plan,implement,repair",
		Priority:       provider.Priority,
		SortOrder:      provider.SortOrder,
		ExtraConfig:    provider.ExtraConfig,
	}}
}

func firstNonZero(value, fallback int) int {
	if value != 0 {
		return value
	}
	return fallback
}

func (s *LLMProviderAdminService) listProviderModels(ctx context.Context, provider model.LLMProvider) []model.LLMProviderModel {
	if s == nil || s.repo == nil || provider.ID == 0 {
		return normalizeLLMProviderModels(provider, nil)
	}
	models, err := s.repo.ListModelsByProviderID(ctx, provider.ID)
	if err != nil {
		return normalizeLLMProviderModels(provider, nil)
	}
	return normalizeLLMProviderModels(provider, models)
}

// LLMProviderAdminService 管理 LLM 提供商配置变更。
// handler 层只负责协议转换，真正的 CRUD、默认值切换和热加载由该服务统一承接。
type LLMProviderAdminService struct {
	repo        LLMProviderRepo
	providerMgr *ProviderManagerService
}

// NewLLMProviderAdminService 创建 LLM 提供商管理服务。
func NewLLMProviderAdminService(repo LLMProviderRepo, providerMgr *ProviderManagerService) *LLMProviderAdminService {
	return &LLMProviderAdminService{
		repo:        repo,
		providerMgr: providerMgr,
	}
}

// EnsureAvailable 确认提供商仓储已初始化。
func (s *LLMProviderAdminService) EnsureAvailable() error {
	if s == nil || s.repo == nil {
		return fmt.Errorf("database not connected, please configure SUPABASE_DB_PASSWORD in .env")
	}
	return nil
}

// ListProviders 获取普通用户可见的已启用提供商与默认提供商信息。
func (s *LLMProviderAdminService) ListProviders(ctx context.Context) ([]LLMProviderPublicResponse, int64, string, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, 0, "", err
	}

	providers, err := s.repo.ListEnabled(ctx)
	if err != nil {
		return nil, 0, "", err
	}

	defaultProvider, _ := s.repo.GetDefault(ctx)
	defaultID := int64(0)
	defaultName := ""
	if defaultProvider != nil {
		defaultID = defaultProvider.ID
		models := s.listProviderModels(ctx, *defaultProvider)
		defaultModelID := getDefaultLLMProviderModelID(models)
		if defaultModelID != "" {
			defaultName = buildLLMProviderRuntimeModelID(defaultProvider.Name, defaultModelID)
		} else {
			defaultName = defaultProvider.Name
		}
	}

	runtime := ProviderRuntimeSnapshot{
		Providers:    []llm.ProviderInfo{},
		LoadedByName: map[string]struct{}{},
	}
	if s.providerMgr != nil {
		_ = s.providerMgr.EnsureLoaded(ctx)
		runtime = s.providerMgr.Snapshot()
	}

	publicProviders := make([]LLMProviderPublicResponse, 0, len(providers))
	for _, provider := range providers {
		models := s.listProviderModels(ctx, provider)
		publicProviders = append(publicProviders, toPublicLLMProvider(provider, models, runtime))
	}

	return publicProviders, defaultID, defaultName, nil
}

// ListAdminProviders 获取管理端 Provider 配置列表。
func (s *LLMProviderAdminService) ListAdminProviders(ctx context.Context) ([]LLMProviderSafeResponse, int64, string, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, 0, "", err
	}

	providers, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, 0, "", err
	}

	defaultProvider, _ := s.repo.GetDefault(ctx)
	defaultID := int64(0)
	defaultName := ""
	if defaultProvider != nil {
		defaultID = defaultProvider.ID
		defaultName = defaultProvider.Name
	}

	runtime := ProviderRuntimeSnapshot{
		Providers:    []llm.ProviderInfo{},
		LoadedByName: map[string]struct{}{},
	}
	if s.providerMgr != nil {
		_ = s.providerMgr.EnsureLoaded(ctx)
		runtime = s.providerMgr.Snapshot()
	}

	safeProviders := make([]LLMProviderSafeResponse, 0, len(providers))
	for _, provider := range providers {
		models := s.listProviderModels(ctx, provider)
		safeProviders = append(safeProviders, toSafeLLMProvider(provider, models, runtime))
	}

	return safeProviders, defaultID, defaultName, nil
}

// GetProvider 获取单个提供商的普通用户可见信息。
func (s *LLMProviderAdminService) GetProvider(ctx context.Context, id int64) (*LLMProviderPublicResponse, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, err
	}

	provider, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	runtime := ProviderRuntimeSnapshot{Providers: []llm.ProviderInfo{}, LoadedByName: map[string]struct{}{}}
	if s.providerMgr != nil {
		_ = s.providerMgr.EnsureLoaded(ctx)
		runtime = s.providerMgr.Snapshot()
	}
	models := s.listProviderModels(ctx, *provider)
	publicProvider := toPublicLLMProvider(*provider, models, runtime)
	return &publicProvider, nil
}

// GetAdminProvider 获取单个提供商的管理端安全信息。
func (s *LLMProviderAdminService) GetAdminProvider(ctx context.Context, id int64) (*LLMProviderSafeResponse, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, err
	}

	provider, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	runtime := ProviderRuntimeSnapshot{Providers: []llm.ProviderInfo{}, LoadedByName: map[string]struct{}{}}
	if s.providerMgr != nil {
		_ = s.providerMgr.EnsureLoaded(ctx)
		runtime = s.providerMgr.Snapshot()
	}
	models := s.listProviderModels(ctx, *provider)
	safeProvider := toSafeLLMProvider(*provider, models, runtime)
	return &safeProvider, nil
}

// CreateProvider 创建新的提供商配置。
func (s *LLMProviderAdminService) CreateProvider(ctx context.Context, req *LLMProviderCreateRequest) (*model.LLMProvider, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, err
	}
	if req == nil || req.Name == "" || req.BaseURL == "" {
		return nil, fmt.Errorf("name and BaseURL are required")
	}

	provider := &model.LLMProvider{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Type:        req.Type,
		APIKey:      req.APIKey,
		BaseURL:     req.BaseURL,
		Model:       req.Model,
		Enabled:     req.Enabled,
		IsDefault:   req.IsDefault,
		Priority:    req.Priority,
		SortOrder:   req.SortOrder,
		ExtraConfig: req.ExtraConfig,
	}
	modelRequests := req.Models
	if len(modelRequests) == 0 {
		modelRequests = modelRequestsFromProviderDefault(*provider)
	}
	models := normalizeLLMProviderModelRequests(*provider, modelRequests)
	if provider.Model == "" {
		provider.Model = getDefaultLLMProviderModelID(models)
	}

	if req.IsDefault {
		if err := s.repo.SetDefault(ctx, 0); err != nil {
			return nil, err
		}
	}

	if err := s.repo.Create(ctx, provider); err != nil {
		return nil, err
	}
	models = normalizeLLMProviderModelRequests(*provider, modelRequests)
	if len(models) > 0 {
		if err := s.repo.ReplaceProviderModels(ctx, provider.ID, models); err != nil {
			return nil, err
		}
		if provider.Model == "" {
			provider.Model = getDefaultLLMProviderModelID(models)
			_ = s.repo.Update(ctx, provider)
		}
	}

	s.reloadProvidersAfterChange(ctx)
	provider.APIKey = ""
	return provider, nil
}

// UpdateProvider 更新已有提供商配置。
func (s *LLMProviderAdminService) UpdateProvider(ctx context.Context, id int64, req *LLMProviderUpdateRequest) (*model.LLMProvider, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, err
	}

	provider, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req == nil {
		provider.APIKey = ""
		return provider, nil
	}

	if req.DisplayName != nil {
		provider.DisplayName = *req.DisplayName
	}
	if req.Type != nil {
		provider.Type = *req.Type
	}
	if req.APIKey != nil && *req.APIKey != "" {
		provider.APIKey = *req.APIKey
	}
	if req.BaseURL != nil {
		provider.BaseURL = *req.BaseURL
	}
	if req.Model != nil {
		provider.Model = *req.Model
	}
	if req.Enabled != nil {
		provider.Enabled = *req.Enabled
	}
	if req.Priority != nil {
		provider.Priority = *req.Priority
	}
	if req.SortOrder != nil {
		provider.SortOrder = *req.SortOrder
	}
	if req.ExtraConfig != nil {
		provider.ExtraConfig = *req.ExtraConfig
	}

	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.SetDefault(ctx, provider.ID); err != nil {
			return nil, err
		}
		provider.IsDefault = true
	}
	if req.Models != nil {
		models := normalizeLLMProviderModelRequests(*provider, *req.Models)
		if len(models) > 0 {
			provider.Model = getDefaultLLMProviderModelID(models)
		}
	}

	if err := s.repo.Update(ctx, provider); err != nil {
		return nil, err
	}
	if req.Models != nil {
		models := normalizeLLMProviderModelRequests(*provider, *req.Models)
		if err := s.repo.ReplaceProviderModels(ctx, provider.ID, models); err != nil {
			return nil, err
		}
	}

	s.reloadProvidersAfterChange(ctx)
	provider.APIKey = ""
	return provider, nil
}

// DeleteProvider 删除非默认提供商。
func (s *LLMProviderAdminService) DeleteProvider(ctx context.Context, id int64) error {
	if err := s.EnsureAvailable(); err != nil {
		return err
	}

	provider, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if provider.IsDefault {
		return fmt.Errorf("cannot delete default provider")
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	s.reloadProvidersAfterChange(ctx)
	return nil
}

// SetDefaultProvider 设置默认提供商。
func (s *LLMProviderAdminService) SetDefaultProvider(ctx context.Context, id int64) error {
	if err := s.EnsureAvailable(); err != nil {
		return err
	}

	provider, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if !provider.Enabled {
		return fmt.Errorf("cannot set disabled provider as default")
	}

	if err := s.repo.SetDefault(ctx, id); err != nil {
		return err
	}

	s.reloadProvidersAfterChange(ctx)
	return nil
}

// BuildConnectionTestResult 执行受控 LLM Provider 连接测试。
func (s *LLMProviderAdminService) BuildConnectionTestResult(ctx context.Context, req *LLMProviderConnectionTestRequest) (*LLMProviderConnectionTestResult, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, err
	}
	if req == nil || strings.TrimSpace(req.Provider) == "" {
		return nil, fmt.Errorf("provider is required")
	}

	providerName := strings.TrimSpace(req.Provider)
	provider, err := s.repo.FindByName(ctx, providerName)
	if err != nil {
		return nil, err
	}
	if provider == nil {
		return nil, fmt.Errorf("provider not found")
	}

	apiKey := strings.TrimSpace(req.APIKey)
	if apiKey == "" {
		apiKey = strings.TrimSpace(provider.APIKey)
	}
	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = strings.TrimSpace(provider.Model)
	}
	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		baseURL = strings.TrimSpace(provider.BaseURL)
	}
	result := &LLMProviderConnectionTestResult{
		Provider:  providerName,
		Model:     model,
		HasAPIKey: apiKey != "",
		Status:    "blocked",
		Message:   "LLM Provider connection test is blocked by incomplete provider configuration.",
		Recovery:  "Configure provider base_url, model and API key first, then retry the connection test.",
	}
	if baseURL == "" {
		result.Message = "LLM Provider base_url is not configured."
		return result, nil
	}
	if model == "" {
		result.Message = "LLM Provider model is not configured."
		return result, nil
	}
	if strings.EqualFold(strings.TrimSpace(provider.Type), "local") == false && apiKey == "" {
		result.Message = "LLM Provider API key is not configured."
		return result, nil
	}
	message := strings.TrimSpace(req.Message)
	if message == "" {
		message = "YiStack provider connection test. Reply with ok."
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	startedAt := time.Now()
	client := llm.NewClient(baseURL, apiKey, 30*time.Second)
	_, err = client.Chat(timeoutCtx, &llm.ChatRequest{
		Model:       model,
		Temperature: 0,
		Messages: []llm.Message{{
			Role:    "user",
			Content: message,
		}},
		Stream: false,
	})
	result.LatencyMS = time.Since(startedAt).Milliseconds()
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("LLM Provider connection test failed: %s", err.Error())
		result.Recovery = "Check provider base_url, model, API key and upstream network availability, then retry from Admin LLM Providers."
		return result, nil
	}
	result.Status = "ready"
	result.Message = "LLM Provider connection test completed successfully."
	result.Recovery = "Provider configuration can reach the upstream chat completions endpoint. Runtime loading is based on enabled Provider/Model records, not on all models passing preflight."
	return result, nil
}

func (s *LLMProviderAdminService) DiscoverProviderModels(ctx context.Context, id int64) (*LLMProviderModelDiscoveryResult, error) {
	if err := s.EnsureAvailable(); err != nil {
		return nil, err
	}
	provider, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	modelIDs, err := discoverLLMProviderModels(ctx, *provider)
	if err != nil {
		return nil, err
	}
	requests := make([]LLMProviderModelRequest, 0, len(modelIDs))
	for index, modelID := range modelIDs {
		requests = append(requests, LLMProviderModelRequest{
			ModelID:        modelID,
			DisplayName:    modelID,
			Enabled:        true,
			IsDefault:      index == 0,
			CapabilityTags: "chat,reasoning,coding",
			DefaultFor:     "chat,foundation,plan,implement,repair",
			SortOrder:      index + 1,
		})
	}
	models := normalizeLLMProviderModelRequests(*provider, requests)
	if len(models) > 0 {
		provider.Model = getDefaultLLMProviderModelID(models)
		if err := s.repo.Update(ctx, provider); err != nil {
			return nil, err
		}
		if err := s.repo.ReplaceProviderModels(ctx, provider.ID, models); err != nil {
			return nil, err
		}
	}
	s.reloadProvidersAfterChange(ctx)
	runtime := ProviderRuntimeSnapshot{Providers: []llm.ProviderInfo{}, LoadedByName: map[string]struct{}{}}
	if s.providerMgr != nil {
		runtime = s.providerMgr.Snapshot()
	}
	return &LLMProviderModelDiscoveryResult{
		ProviderID:      provider.ID,
		ProviderName:    provider.Name,
		DiscoveredCount: len(models),
		Models:          toLLMProviderModelResponses(*provider, models, runtime),
		Message:         "模型发现已完成，并已同步到 Provider 模型列表。",
		Recovery:        "如模型未完整出现，请确认 Provider Base URL、API Key、Ollama /v1/models 兼容接口和网络可用性。",
	}, nil
}

func discoverLLMProviderModels(ctx context.Context, provider model.LLMProvider) ([]string, error) {
	baseURL := strings.TrimSpace(provider.BaseURL)
	if baseURL == "" {
		return nil, fmt.Errorf("provider base_url is required")
	}
	if strings.EqualFold(strings.TrimSpace(provider.Type), "local") || strings.Contains(strings.ToLower(baseURL), "11434") {
		models, err := discoverOllamaModels(ctx, baseURL)
		if err == nil && len(models) > 0 {
			return models, nil
		}
	}
	return discoverOpenAICompatibleModels(ctx, baseURL, strings.TrimSpace(provider.APIKey))
}

func discoverOllamaModels(ctx context.Context, baseURL string) ([]string, error) {
	target, err := url.JoinPath(baseURL, "/api/tags")
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ollama model discovery failed with status %d", resp.StatusCode)
	}
	var payload struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	models := make([]string, 0, len(payload.Models))
	for _, item := range payload.Models {
		modelID := strings.TrimSpace(item.Name)
		if modelID != "" {
			models = append(models, modelID)
		}
	}
	return models, nil
}

func discoverOpenAICompatibleModels(ctx context.Context, baseURL, apiKey string) ([]string, error) {
	target, err := url.JoinPath(baseURL, "/v1/models")
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("compatible model discovery failed with status %d", resp.StatusCode)
	}
	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	models := make([]string, 0, len(payload.Data))
	for _, item := range payload.Data {
		modelID := strings.TrimSpace(item.ID)
		if modelID != "" {
			models = append(models, modelID)
		}
	}
	if len(models) == 0 {
		return nil, fmt.Errorf("model discovery returned empty model list")
	}
	return models, nil
}

// ReloadProviders 手动热加载提供商配置。
func (s *LLMProviderAdminService) ReloadProviders(ctx context.Context) ([]map[string]interface{}, error) {
	if s == nil || s.providerMgr == nil {
		return nil, fmt.Errorf("provider manager not initialized")
	}
	if err := s.providerMgr.Reload(ctx); err != nil {
		return nil, err
	}
	return s.providerMgr.GetActiveProviders(ctx)
}

// reloadProvidersAfterChange 在配置变更后尝试热加载 ProviderManager。
func (s *LLMProviderAdminService) reloadProvidersAfterChange(ctx context.Context) {
	if s == nil || s.providerMgr == nil {
		return
	}
	_ = s.providerMgr.Reload(ctx)
}
