// Package supabase Supabase REST API 客户端和数据访问层
package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/pkg/llm"

	"gorm.io/gorm"
)

// SupabaseRepository 聚合所有 Supabase 仓储
type SupabaseRepository struct {
	client *Client
}

func firstDataMap(data []interface{}) (map[string]interface{}, bool) {
	if len(data) == 0 {
		return nil, false
	}
	record, ok := data[0].(map[string]interface{})
	if !ok || record == nil {
		return nil, false
	}
	return record, true
}

// NewSupabaseRepository 创建 Supabase 仓储集合
func NewSupabaseRepository(client *Client) *SupabaseRepository {
	return &SupabaseRepository{client: client}
}

func (r *SupabaseRepository) UserRepository() *UserRepository {
	return &UserRepository{supabase: r.client}
}

func (r *SupabaseRepository) ProjectRepository() *ProjectRepository {
	return &ProjectRepository{supabase: r.client}
}

func (r *SupabaseRepository) ChatMessageRepository() *ChatMessageRepository {
	return &ChatMessageRepository{supabase: r.client}
}

func (r *SupabaseRepository) CommitRepository() *CommitRepository {
	return &CommitRepository{supabase: r.client}
}

func (r *SupabaseRepository) GeneratedFileRepository() *GeneratedFileRepository {
	return &GeneratedFileRepository{supabase: r.client}
}

func (r *SupabaseRepository) EngineeringStateRepository() *EngineeringStateRepository {
	return &EngineeringStateRepository{supabase: r.client}
}

func (r *SupabaseRepository) CapabilityExecutionAuditRepository() *CapabilityExecutionAuditRepository {
	return &CapabilityExecutionAuditRepository{supabase: r.client}
}

func (r *SupabaseRepository) ProjectResourceAlertEventRepository() *ProjectResourceAlertEventRepository {
	return &ProjectResourceAlertEventRepository{supabase: r.client}
}

func (r *SupabaseRepository) LLMProviderRepository() *LLMProviderRepository {
	return &LLMProviderRepository{supabase: r.client}
}

func (r *SupabaseRepository) SystemConfigRepository() *SystemConfigRepository {
	return NewSystemConfigRepository(r)
}

func (r *SupabaseRepository) AdminRepository() *AdminRepository {
	return &AdminRepository{supabase: r.client}
}

func (r *SupabaseRepository) AdminAuditLogRepository() *AdminAuditLogRepository {
	return NewAdminAuditLogRepository(r)
}

// ============================================
// User Repository - 对齐 users 表 (id: uuid)
// ============================================

type UserRepository struct {
	supabase *Client
}

func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	data := map[string]interface{}{
		"id":              user.ID, // UUID
		"email":           user.Email,
		"password_hash":   user.PasswordHash,
		"username":        user.Username,
		"role":            user.Role,
		"status":          user.Status,
		"plan":            user.Plan,
		"email_verified":  user.EmailVerified,
		"avatar_url":      user.AvatarURL,
		"llm_model":       user.LLMModel,
		"llm_temperature": user.LLMTemperature,
		"llm_max_tokens":  user.LLMMaxTokens,
	}

	result, err := r.supabase.AdminTable("users").Insert(data)
	if err != nil {
		return fmt.Errorf("create user failed: %w", err)
	}

	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(string); ok {
			user.ID = id // UUID string
		}
	}

	return nil
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
	result, err := r.supabase.AdminTable("users").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("user not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid user record")
	}
	return r.mapToUser(record), nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	result, err := r.supabase.AdminTable("users").Eq("email", email).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("user not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid user record")
	}
	return r.mapToUser(record), nil
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	result, err := r.supabase.AdminTable("users").Eq("username", username).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("user not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid user record")
	}
	return r.mapToUser(record), nil
}

func (r *UserRepository) Update(ctx context.Context, user *model.User) error {
	data := map[string]interface{}{
		"username":        user.Username,
		"avatar_url":      user.AvatarURL,
		"role":            user.Role,
		"status":          user.Status,
		"llm_model":       user.LLMModel,
		"llm_temperature": user.LLMTemperature,
		"llm_max_tokens":  user.LLMMaxTokens,
		"updated_at":      "now()",
	}

	_, err := r.supabase.AdminTable("users").Eq("id", user.ID).Update(data)
	return err
}

func (r *UserRepository) UpdateLLMConfig(ctx context.Context, userID string, llmModel, temperature string, maxTokens int) error {
	_, err := r.supabase.AdminTable("users").Eq("id", userID).Update(map[string]interface{}{
		"llm_model":       llmModel,
		"llm_temperature": temperature,
		"llm_max_tokens":  maxTokens,
		"updated_at":      "now()",
	})
	return err
}

func (r *UserRepository) List(ctx context.Context, offset, limit int) ([]model.User, int64, error) {
	// Get total count
	total, err := r.supabase.AdminTable("users").Count()
	if err != nil {
		return nil, 0, fmt.Errorf("count users failed: %w", err)
	}

	// Get paginated users
	result, err := r.supabase.AdminTable("users").
		Select("*").
		Order("created_at", false).
		Offset(offset).
		Limit(limit).
		SelectQuery()
	if err != nil {
		return nil, 0, fmt.Errorf("list users failed: %w", err)
	}

	users := make([]model.User, 0, len(result.Data))
	for _, item := range result.Data {
		if m, ok := item.(map[string]interface{}); ok {
			users = append(users, *r.mapToUser(m))
		}
	}
	return users, int64(total), nil
}

func (r *UserRepository) mapToUser(m map[string]interface{}) *model.User {
	u := &model.User{}
	// ID is UUID string
	if id, ok := m["id"].(string); ok {
		u.ID = id
	}
	if email, ok := m["email"].(string); ok {
		u.Email = email
	}
	if hash, ok := m["password_hash"].(string); ok {
		u.PasswordHash = hash
	}
	if username, ok := m["username"].(string); ok {
		u.Username = username
	}
	if avatarURL, ok := m["avatar_url"].(string); ok {
		u.AvatarURL = avatarURL
	}
	if role, ok := m["role"].(string); ok {
		u.Role = role
	}
	if status, ok := m["status"].(string); ok {
		u.Status = status
	}
	if plan, ok := m["plan"].(string); ok {
		u.Plan = plan
	}
	if emailVerified, ok := m["email_verified"].(bool); ok {
		u.EmailVerified = emailVerified
	}
	if llmModel, ok := m["llm_model"].(string); ok {
		u.LLMModel = llmModel
	}
	if llmTemp, ok := m["llm_temperature"].(string); ok {
		u.LLMTemperature = llmTemp
	}
	if tokens, ok := m["llm_max_tokens"].(float64); ok {
		u.LLMMaxTokens = int(tokens)
	}
	if instanceID, ok := m["instance_id"].(string); ok {
		u.InstanceID = instanceID
	}
	return u
}

// ============================================
// LLM Provider Repository - 对齐 llm_providers 表 (id: bigserial)
// ============================================

type LLMProviderRepository struct {
	supabase *Client
}

func (r *LLMProviderRepository) Create(ctx context.Context, provider *model.LLMProvider) error {
	data := map[string]interface{}{
		"name":         provider.Name,
		"display_name": provider.DisplayName,
		"type":         provider.Type,
		"api_key":      provider.APIKey,
		"base_url":     provider.BaseURL,
		"model":        provider.Model,
		"enabled":      provider.Enabled,
		"is_default":   provider.IsDefault,
		"priority":     provider.Priority,
		"sort_order":   provider.SortOrder,
		"extra_config": provider.ExtraConfig,
	}

	result, err := r.supabase.AdminTable("llm_providers").Insert(data)
	if err != nil {
		return fmt.Errorf("create LLM provider failed: %w", err)
	}

	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			provider.ID = int64(id) // bigserial
		}
	}

	return nil
}

func (r *LLMProviderRepository) CreateModel(ctx context.Context, providerModel *model.LLMProviderModel) error {
	data := map[string]interface{}{
		"provider_id":     providerModel.ProviderID,
		"model_id":        providerModel.ModelID,
		"display_name":    providerModel.DisplayName,
		"enabled":         providerModel.Enabled,
		"is_default":      providerModel.IsDefault,
		"capability_tags": providerModel.CapabilityTags,
		"context_window":  providerModel.ContextWindow,
		"default_for":     providerModel.DefaultFor,
		"priority":        providerModel.Priority,
		"sort_order":      providerModel.SortOrder,
		"extra_config":    providerModel.ExtraConfig,
	}
	result, err := r.supabase.AdminTable("llm_provider_models").Insert(data)
	if err != nil {
		return fmt.Errorf("create LLM provider model failed: %w", err)
	}
	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			providerModel.ID = int64(id)
		}
	}
	return nil
}

func (r *LLMProviderRepository) FindByID(ctx context.Context, id int64) (*model.LLMProvider, error) {
	result, err := r.supabase.AdminTable("llm_providers").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("LLM provider not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid LLM provider record")
	}
	return r.mapToLLMProvider(record), nil
}

func (r *LLMProviderRepository) FindByName(ctx context.Context, name string) (*model.LLMProvider, error) {
	result, err := r.supabase.AdminTable("llm_providers").Eq("name", name).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("LLM provider not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid LLM provider record")
	}
	return r.mapToLLMProvider(record), nil
}

func (r *LLMProviderRepository) ListAll(ctx context.Context) ([]model.LLMProvider, error) {
	result, err := r.supabase.AdminTable("llm_providers").Order("sort_order", true).SelectQuery()
	if err != nil {
		return nil, err
	}

	providers := make([]model.LLMProvider, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			providers = append(providers, *r.mapToLLMProvider(m))
		}
	}
	return providers, nil
}

func (r *LLMProviderRepository) ListEnabled(ctx context.Context) ([]model.LLMProvider, error) {
	result, err := r.supabase.AdminTable("llm_providers").Eq("enabled", true).Order("priority", false).SelectQuery()
	if err != nil {
		return nil, err
	}

	providers := make([]model.LLMProvider, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			providers = append(providers, *r.mapToLLMProvider(m))
		}
	}
	return providers, nil
}

func (r *LLMProviderRepository) ListModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error) {
	result, err := r.supabase.AdminTable("llm_provider_models").
		Eq("provider_id", providerID).
		Order("sort_order", true).
		SelectQuery()
	if err != nil {
		return nil, err
	}
	models := make([]model.LLMProviderModel, 0, len(result.Data))
	for _, item := range result.Data {
		if m, ok := item.(map[string]interface{}); ok {
			models = append(models, *mapToLLMProviderModel(m))
		}
	}
	return models, nil
}

func (r *LLMProviderRepository) ListEnabledModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error) {
	result, err := r.supabase.AdminTable("llm_provider_models").
		Eq("provider_id", providerID).
		Eq("enabled", true).
		Order("sort_order", true).
		SelectQuery()
	if err != nil {
		return nil, err
	}
	models := make([]model.LLMProviderModel, 0, len(result.Data))
	for _, item := range result.Data {
		if m, ok := item.(map[string]interface{}); ok {
			models = append(models, *mapToLLMProviderModel(m))
		}
	}
	return models, nil
}

func (r *LLMProviderRepository) GetDefault(ctx context.Context) (*model.LLMProvider, error) {
	result, err := r.supabase.AdminTable("llm_providers").Eq("is_default", true).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("no default LLM provider")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid LLM provider record")
	}
	return r.mapToLLMProvider(record), nil
}

func (r *LLMProviderRepository) Update(ctx context.Context, provider *model.LLMProvider) error {
	data := map[string]interface{}{
		"display_name": provider.DisplayName,
		"type":         provider.Type,
		"api_key":      provider.APIKey,
		"base_url":     provider.BaseURL,
		"model":        provider.Model,
		"enabled":      provider.Enabled,
		"is_default":   provider.IsDefault,
		"priority":     provider.Priority,
		"sort_order":   provider.SortOrder,
		"extra_config": provider.ExtraConfig,
		"updated_at":   "now()",
	}

	_, err := r.supabase.AdminTable("llm_providers").Eq("id", provider.ID).Update(data)
	return err
}

func (r *LLMProviderRepository) UpsertModel(ctx context.Context, providerModel *model.LLMProviderModel) error {
	if providerModel == nil {
		return nil
	}
	existing, err := r.supabase.AdminTable("llm_provider_models").
		Eq("provider_id", providerModel.ProviderID).
		Eq("model_id", providerModel.ModelID).
		SelectQuery()
	if err != nil {
		return err
	}
	data := map[string]interface{}{
		"display_name":    providerModel.DisplayName,
		"enabled":         providerModel.Enabled,
		"is_default":      providerModel.IsDefault,
		"capability_tags": providerModel.CapabilityTags,
		"context_window":  providerModel.ContextWindow,
		"default_for":     providerModel.DefaultFor,
		"priority":        providerModel.Priority,
		"sort_order":      providerModel.SortOrder,
		"extra_config":    providerModel.ExtraConfig,
		"updated_at":      "now()",
	}
	if len(existing.Data) > 0 {
		_, err = r.supabase.AdminTable("llm_provider_models").
			Eq("provider_id", providerModel.ProviderID).
			Eq("model_id", providerModel.ModelID).
			Update(data)
		return err
	}
	return r.CreateModel(ctx, providerModel)
}

func (r *LLMProviderRepository) ReplaceProviderModels(ctx context.Context, providerID int64, models []model.LLMProviderModel) error {
	_, err := r.supabase.AdminTable("llm_provider_models").Eq("provider_id", providerID).Delete()
	if err != nil {
		return err
	}
	for i := range models {
		models[i].ProviderID = providerID
		if err := r.CreateModel(ctx, &models[i]); err != nil {
			return err
		}
	}
	return nil
}

func (r *LLMProviderRepository) Delete(ctx context.Context, id int64) error {
	_, err := r.supabase.AdminTable("llm_providers").Eq("id", id).Delete()
	return err
}

func (r *LLMProviderRepository) DeleteModel(ctx context.Context, providerID int64, modelID string) error {
	_, err := r.supabase.AdminTable("llm_provider_models").
		Eq("provider_id", providerID).
		Eq("model_id", modelID).
		Delete()
	return err
}

func (r *LLMProviderRepository) SetDefault(ctx context.Context, id int64) error {
	// 先取消所有默认
	_, err := r.supabase.AdminTable("llm_providers").Eq("is_default", true).Update(map[string]interface{}{
		"is_default": false,
	})
	if err != nil {
		return err
	}
	// 设置新的默认
	_, err = r.supabase.AdminTable("llm_providers").Eq("id", id).Update(map[string]interface{}{
		"is_default": true,
	})
	return err
}

func (r *LLMProviderRepository) SetDefaultModel(ctx context.Context, providerID int64, modelID string) error {
	_, err := r.supabase.AdminTable("llm_provider_models").
		Eq("provider_id", providerID).
		Eq("is_default", true).
		Update(map[string]interface{}{"is_default": false, "updated_at": "now()"})
	if err != nil {
		return err
	}
	_, err = r.supabase.AdminTable("llm_provider_models").
		Eq("provider_id", providerID).
		Eq("model_id", modelID).
		Update(map[string]interface{}{"is_default": true, "updated_at": "now()"})
	return err
}

func (r *LLMProviderRepository) IncrementUseCount(ctx context.Context, id int64) error {
	provider, err := r.FindByID(ctx, id)
	if err != nil {
		return err
	}
	_, err = r.supabase.AdminTable("llm_providers").Eq("id", id).Update(map[string]interface{}{
		"use_count":    provider.UseCount + 1,
		"last_used_at": time.Now().UTC().Format(time.RFC3339Nano),
	})
	return err
}

func (r *LLMProviderRepository) ListDBProviders(ctx context.Context) ([]llm.DBProviderRecord, error) {
	providers, err := r.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}

	records := make([]llm.DBProviderRecord, 0, len(providers))
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
			records = append(records, llm.DBProviderRecord{
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
	return records, nil
}

// ListAllSafe 返回所有提供商（脱敏）
func (r *LLMProviderRepository) ListAllSafe(ctx context.Context) ([]model.LLMProvider, error) {
	providers, err := r.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	for i := range providers {
		if len(providers[i].APIKey) > 4 {
			providers[i].APIKey = "****" + providers[i].APIKey[len(providers[i].APIKey)-4:]
		} else if providers[i].APIKey != "" {
			providers[i].APIKey = "****"
		}
	}
	return providers, nil
}

// InitDefaults 初始化默认 LLM 提供商（Supabase 已通过 SQL 预置）
func (r *LLMProviderRepository) InitDefaults(ctx context.Context) error {
	return nil
}

func (r *LLMProviderRepository) mapToLLMProvider(m map[string]interface{}) *model.LLMProvider {
	p := &model.LLMProvider{}
	if id, ok := m["id"].(float64); ok {
		p.ID = int64(id)
	}
	if name, ok := m["name"].(string); ok {
		p.Name = name
	}
	if displayName, ok := m["display_name"].(string); ok {
		p.DisplayName = displayName
	}
	if typ, ok := m["type"].(string); ok {
		p.Type = typ
	}
	if apiKey, ok := m["api_key"].(string); ok {
		p.APIKey = apiKey
	}
	if baseURL, ok := m["base_url"].(string); ok {
		p.BaseURL = baseURL
	}
	if model, ok := m["model"].(string); ok {
		p.Model = model
	}
	if enabled, ok := m["enabled"].(bool); ok {
		p.Enabled = enabled
	}
	if isDefault, ok := m["is_default"].(bool); ok {
		p.IsDefault = isDefault
	}
	if priority, ok := m["priority"].(float64); ok {
		p.Priority = int(priority)
	}
	if sortOrder, ok := m["sort_order"].(float64); ok {
		p.SortOrder = int(sortOrder)
	}
	if extraConfig, ok := m["extra_config"].(string); ok {
		p.ExtraConfig = extraConfig
	}
	if useCount, ok := m["use_count"].(float64); ok {
		p.UseCount = int64(useCount)
	}
	return p
}

func mapToLLMProviderModel(m map[string]interface{}) *model.LLMProviderModel {
	p := &model.LLMProviderModel{}
	if id, ok := m["id"].(float64); ok {
		p.ID = int64(id)
	}
	if providerID, ok := m["provider_id"].(float64); ok {
		p.ProviderID = int64(providerID)
	}
	if modelID, ok := m["model_id"].(string); ok {
		p.ModelID = modelID
	}
	if displayName, ok := m["display_name"].(string); ok {
		p.DisplayName = displayName
	}
	if enabled, ok := m["enabled"].(bool); ok {
		p.Enabled = enabled
	}
	if isDefault, ok := m["is_default"].(bool); ok {
		p.IsDefault = isDefault
	}
	if tags, ok := m["capability_tags"].(string); ok {
		p.CapabilityTags = tags
	}
	if contextWindow, ok := m["context_window"].(float64); ok {
		p.ContextWindow = int(contextWindow)
	}
	if defaultFor, ok := m["default_for"].(string); ok {
		p.DefaultFor = defaultFor
	}
	if priority, ok := m["priority"].(float64); ok {
		p.Priority = int(priority)
	}
	if sortOrder, ok := m["sort_order"].(float64); ok {
		p.SortOrder = int(sortOrder)
	}
	if extraConfig, ok := m["extra_config"].(string); ok {
		p.ExtraConfig = extraConfig
	}
	return p
}

// ============================================
// Project Repository - 对齐 projects 表
// ============================================

type ProjectRepository struct {
	supabase *Client
}

func nullableProjectPreviewShareID(value string) interface{} {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return nil
	}
	return normalized
}

func (r *ProjectRepository) Create(ctx context.Context, project *model.Project) error {
	data := map[string]interface{}{
		"user_id":               project.UserID, // UUID string
		"project_id":            project.ProjectID,
		"name":                  project.Name,
		"description":           project.Description,
		"app_type":              project.AppType,
		"tech_stack":            project.TechStack,
		"visibility":            project.Visibility,
		"preview_share_enabled": project.PreviewShareEnabled,
		"preview_share_id":      nullableProjectPreviewShareID(project.PreviewShareID),
		"container_id":          project.ContainerID,
		"container_name":        project.ContainerName,
		"container_port":        project.ContainerPort,
		"container_image":       project.ContainerImage,
		"container_status":      project.ContainerStatus,
		"directory_path":        project.DirectoryPath,
		"plan_id":               project.PlanID,
		"plan_data":             project.PlanData,
		"git_branch":            project.GitBranch,
		"file_tree":             project.FileTree,
	}

	result, err := r.supabase.AdminTable("projects").Insert(data)
	if err != nil {
		return fmt.Errorf("create project failed: %w", err)
	}

	if m, ok := firstDataMap(result.Data); ok {
		mapped := r.mapToProject(m)
		project.ID = mapped.ID
		project.UserID = mapped.UserID
		project.ProjectID = mapped.ProjectID
		project.Name = mapped.Name
		project.Description = mapped.Description
		project.AppType = mapped.AppType
		project.TechStack = mapped.TechStack
		project.Visibility = mapped.Visibility
		project.PreviewShareEnabled = mapped.PreviewShareEnabled
		project.PreviewShareID = mapped.PreviewShareID
		project.ContainerID = mapped.ContainerID
		project.ContainerName = mapped.ContainerName
		project.ContainerPort = mapped.ContainerPort
		project.ContainerImage = mapped.ContainerImage
		project.ContainerStatus = mapped.ContainerStatus
		project.DirectoryPath = mapped.DirectoryPath
		project.PlanID = mapped.PlanID
		project.PlanData = mapped.PlanData
		project.GitBranch = mapped.GitBranch
		project.FileTree = mapped.FileTree
		project.CreatedAt = mapped.CreatedAt
		project.UpdatedAt = mapped.UpdatedAt
	}

	return nil
}

func (r *ProjectRepository) FindByID(ctx context.Context, id string) (*model.Project, error) {
	result, err := r.supabase.AdminTable("projects").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid project record")
	}
	return r.mapToProject(record), nil
}

func (r *ProjectRepository) FindByProjectID(ctx context.Context, projectID string) (*model.Project, error) {
	result, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid project record")
	}
	return r.mapToProject(record), nil
}

func (r *ProjectRepository) FindByPreviewShareID(ctx context.Context, previewShareID string) (*model.Project, error) {
	result, err := r.supabase.AdminTable("projects").Eq("preview_share_id", previewShareID).Eq("preview_share_enabled", true).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid project record")
	}
	if isSoftDeleted(record) {
		return nil, gorm.ErrRecordNotFound
	}
	return r.mapToProject(record), nil
}

func (r *ProjectRepository) FindByUserID(ctx context.Context, userID string) ([]model.Project, error) {
	result, err := r.supabase.AdminTable("projects").Eq("user_id", userID).Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}

	projects := make([]model.Project, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			projects = append(projects, *r.mapToProject(m))
		}
	}
	return projects, nil
}

func (r *ProjectRepository) Update(ctx context.Context, project *model.Project) error {
	data := map[string]interface{}{
		"name":                  project.Name,
		"description":           project.Description,
		"app_type":              project.AppType,
		"tech_stack":            project.TechStack,
		"visibility":            project.Visibility,
		"preview_share_enabled": project.PreviewShareEnabled,
		"preview_share_id":      nullableProjectPreviewShareID(project.PreviewShareID),
		"container_id":          project.ContainerID,
		"container_name":        project.ContainerName,
		"container_port":        project.ContainerPort,
		"container_image":       project.ContainerImage,
		"container_status":      project.ContainerStatus,
		"directory_path":        project.DirectoryPath,
		"plan_id":               project.PlanID,
		"plan_data":             project.PlanData,
		"file_tree":             project.FileTree,
		"updated_at":            "now()",
	}

	_, err := r.supabase.AdminTable("projects").Eq("id", project.ID).Update(data)
	return err
}

func (r *ProjectRepository) UpdateFields(ctx context.Context, projectID string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = "now()"
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(updates)
	return err
}

func (r *ProjectRepository) UpdateContainerInfo(ctx context.Context, projectID string, containerID, containerName, containerImage string, containerPort int, containerStatus string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(map[string]interface{}{
		"container_id":     containerID,
		"container_name":   containerName,
		"container_port":   containerPort,
		"container_image":  containerImage,
		"container_status": containerStatus,
		"updated_at":       "now()",
	})
	return err
}

func (r *ProjectRepository) UpdateContainerStatus(ctx context.Context, projectID string, containerStatus string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(map[string]interface{}{
		"container_status": containerStatus,
		"updated_at":       "now()",
	})
	return err
}

func (r *ProjectRepository) UpdateFileTree(ctx context.Context, projectID string, fileTree string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(map[string]interface{}{
		"file_tree":  fileTree,
		"updated_at": "now()",
	})
	return err
}

func (r *ProjectRepository) UpdateDirectoryPath(ctx context.Context, projectID string, directoryPath string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(map[string]interface{}{
		"directory_path": directoryPath,
		"updated_at":     "now()",
	})
	return err
}

func (r *ProjectRepository) UpdatePlanData(ctx context.Context, projectID, planID, planData string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(map[string]interface{}{
		"plan_id":    planID,
		"plan_data":  planData,
		"updated_at": "now()",
	})
	return err
}

func (r *ProjectRepository) SoftDelete(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(map[string]interface{}{
		"deleted_at": "now()",
	})
	return err
}

func (r *ProjectRepository) RestoreDeleted(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Update(map[string]interface{}{
		"deleted_at": nil,
		"updated_at": "now()",
	})
	return err
}

func (r *ProjectRepository) RestoreDeletedByOwner(ctx context.Context, projectID, userID string) (*model.Project, error) {
	result, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Eq("user_id", userID).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("project not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid project record")
	}
	if !isSoftDeleted(record) {
		return nil, fmt.Errorf("project is not pending deletion")
	}

	_, err = r.supabase.AdminTable("projects").Eq("project_id", projectID).Eq("user_id", userID).Update(map[string]interface{}{
		"deleted_at": nil,
		"updated_at": "now()",
	})
	if err != nil {
		return nil, err
	}

	project := r.mapToProject(record)
	project.DeletedAt = nil
	project.UpdatedAt = time.Now()
	return project, nil
}

func (r *ProjectRepository) HardDelete(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("projects").Eq("project_id", projectID).Delete()
	return err
}

func (r *ProjectRepository) ListByUserID(ctx context.Context, userID string, page, pageSize int) ([]model.Project, int64, error) {
	// 先获取总数
	countResult, err := r.supabase.AdminTable("projects").Eq("user_id", userID).SelectQuery()
	if err != nil {
		return nil, 0, err
	}
	// 过滤掉已软删除的
	total := int64(0)
	for _, d := range countResult.Data {
		if m, ok := d.(map[string]interface{}); ok {
			if !isSoftDeleted(m) {
				total++
			}
		}
	}

	// 分页查询
	t := r.supabase.AdminTable("projects").Eq("user_id", userID).Order("created_at", false)
	offset := (page - 1) * pageSize
	if offset > 0 {
		t = t.Offset(offset)
	}
	t = t.Limit(pageSize)

	result, err := t.SelectQuery()
	if err != nil {
		return nil, 0, err
	}

	projects := make([]model.Project, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			// 跳过已软删除的
			if isSoftDeleted(m) {
				continue
			}
			projects = append(projects, *r.mapToProject(m))
		}
	}
	return projects, total, nil
}

func (r *ProjectRepository) ListAll(ctx context.Context, page, pageSize int) ([]model.Project, int64, error) {
	countResult, err := r.supabase.AdminTable("projects").SelectQuery()
	if err != nil {
		return nil, 0, err
	}

	total := int64(0)
	for _, d := range countResult.Data {
		if m, ok := d.(map[string]interface{}); ok {
			if !isSoftDeleted(m) {
				total++
			}
		}
	}

	t := r.supabase.AdminTable("projects").Order("created_at", false)
	offset := (page - 1) * pageSize
	if offset > 0 {
		t = t.Offset(offset)
	}
	t = t.Limit(pageSize)

	result, err := t.SelectQuery()
	if err != nil {
		return nil, 0, err
	}

	projects := make([]model.Project, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			if isSoftDeleted(m) {
				continue
			}
			projects = append(projects, *r.mapToProject(m))
		}
	}
	return projects, total, nil
}

func isSoftDeleted(record map[string]interface{}) bool {
	deletedAt, exists := record["deleted_at"]
	if !exists || deletedAt == nil {
		return false
	}

	if value, ok := deletedAt.(string); ok {
		return value != ""
	}

	return true
}

func parseSupabaseTime(value string) (time.Time, bool) {
	if value == "" {
		return time.Time{}, false
	}

	layouts := []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05.999999-07:00"}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, true
		}
	}

	return time.Time{}, false
}

func getSupabaseInt64(value interface{}) int64 {
	switch typed := value.(type) {
	case int64:
		return typed
	case int:
		return int64(typed)
	case float64:
		return int64(typed)
	default:
		return 0
	}
}

func getSupabaseInt(value interface{}) int {
	return int(getSupabaseInt64(value))
}

func mapToProjectFile(m map[string]interface{}) *model.ProjectFile {
	file := &model.ProjectFile{}
	applyProjectFileFields(file, m)
	return file
}

func applyProjectFileFields(file *model.ProjectFile, m map[string]interface{}) {
	if file == nil || m == nil {
		return
	}
	file.ID = getSupabaseInt64(m["id"])
	if projectID, ok := m["project_id"].(string); ok {
		file.ProjectID = projectID
	}
	if path, ok := m["path"].(string); ok {
		file.Path = path
	}
	if content, ok := m["content"].(string); ok {
		file.Content = content
	}
	if contentHash, ok := m["content_hash"].(string); ok {
		file.ContentHash = contentHash
	}
	if fileType, ok := m["file_type"].(string); ok {
		file.FileType = fileType
	}
	file.Size = getSupabaseInt(m["size"])
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, parsedOK := parseSupabaseTime(createdAt); parsedOK {
			file.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, parsedOK := parseSupabaseTime(updatedAt); parsedOK {
			file.UpdatedAt = parsed
		}
	}
}

func (r *ProjectRepository) mapToProject(m map[string]interface{}) *model.Project {
	p := &model.Project{}

	// ID is UUID string
	if id, ok := m["id"].(string); ok {
		p.ID = id
	}
	// UserID is UUID string
	if userID, ok := m["user_id"].(string); ok {
		p.UserID = userID
	}
	if projectID, ok := m["project_id"].(string); ok {
		p.ProjectID = projectID
	}
	if name, ok := m["name"].(string); ok {
		p.Name = name
	}
	if desc, ok := m["description"].(string); ok {
		p.Description = desc
	}
	if appType, ok := m["app_type"].(string); ok {
		p.AppType = appType
	}
	if techStack, ok := m["tech_stack"].(string); ok {
		p.TechStack = techStack
	}
	if visibility, ok := m["visibility"].(string); ok {
		p.Visibility = visibility
	}
	if previewShareEnabled, ok := m["preview_share_enabled"].(bool); ok {
		p.PreviewShareEnabled = previewShareEnabled
	}
	if previewShareID, ok := m["preview_share_id"].(string); ok {
		p.PreviewShareID = previewShareID
	}
	if containerID, ok := m["container_id"].(string); ok {
		p.ContainerID = containerID
	}
	if containerName, ok := m["container_name"].(string); ok {
		p.ContainerName = containerName
	}
	if containerPort, ok := m["container_port"].(float64); ok {
		p.ContainerPort = int(containerPort)
	}
	if containerImage, ok := m["container_image"].(string); ok {
		p.ContainerImage = containerImage
	}
	if containerStatus, ok := m["container_status"].(string); ok {
		p.ContainerStatus = containerStatus
	}
	if directoryPath, ok := m["directory_path"].(string); ok {
		p.DirectoryPath = directoryPath
	}
	if planID, ok := m["plan_id"].(string); ok {
		p.PlanID = planID
	}
	if planData, ok := m["plan_data"].(string); ok {
		p.PlanData = planData
	}
	if fileTree, ok := m["file_tree"].(string); ok {
		p.FileTree = fileTree
	}
	if gitBranch, ok := m["git_branch"].(string); ok {
		p.GitBranch = gitBranch
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(createdAt); ok {
			p.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(updatedAt); ok {
			p.UpdatedAt = parsed
		}
	}
	if deletedAt, ok := m["deleted_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(deletedAt); ok {
			p.DeletedAt = &parsed
		}
	}

	return p
}

// ============================================
// ChatMessage Repository
// ============================================

type ChatMessageRepository struct {
	supabase *Client
}

type CommitRepository struct {
	supabase *Client
}

type GeneratedFileRepository struct {
	supabase *Client
}

type EngineeringStateRepository struct {
	supabase *Client
}

type CapabilityExecutionAuditRepository struct {
	supabase *Client
}

type ProjectResourceAlertEventRepository struct {
	supabase *Client
}

func (r *CommitRepository) Create(ctx context.Context, commit *model.Commit) error {
	data := map[string]interface{}{
		"project_id":  commit.ProjectID,
		"message":     commit.Message,
		"hash":        commit.Hash,
		"parent_hash": commit.ParentHash,
		"created_at":  commit.CreatedAt,
	}
	if commit.UserID != "" {
		data["user_id"] = commit.UserID
	}

	result, err := r.supabase.AdminTable("commits").Insert(data)
	if err != nil {
		return fmt.Errorf("create commit failed: %w", err)
	}
	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			commit.ID = int64(id)
		}
	}
	return nil
}

func (r *GeneratedFileRepository) Create(ctx context.Context, file *model.ProjectFile) error {
	if r == nil || r.supabase == nil || file == nil {
		return nil
	}

	data := map[string]interface{}{
		"project_id":   file.ProjectID,
		"path":         file.Path,
		"content":      file.Content,
		"content_hash": file.ContentHash,
		"file_type":    file.FileType,
		"size":         file.Size,
	}
	result, err := r.supabase.AdminTable("project_files").Insert(data)
	if err != nil {
		return fmt.Errorf("create project file failed: %w", err)
	}
	if m, ok := firstDataMap(result.Data); ok {
		applyProjectFileFields(file, m)
	}
	return nil
}

func (r *GeneratedFileRepository) BatchCreate(ctx context.Context, files []model.ProjectFile) error {
	if r == nil || r.supabase == nil || len(files) == 0 {
		return nil
	}

	rows := make([]map[string]interface{}, 0, len(files))
	for _, file := range files {
		rows = append(rows, map[string]interface{}{
			"project_id":   file.ProjectID,
			"path":         file.Path,
			"content":      file.Content,
			"content_hash": file.ContentHash,
			"file_type":    file.FileType,
			"size":         file.Size,
		})
	}
	if _, err := r.supabase.AdminTable("project_files").Insert(rows); err != nil {
		return fmt.Errorf("batch create project files failed: %w", err)
	}
	return nil
}

func (r *GeneratedFileRepository) FindByProjectID(ctx context.Context, projectID string) ([]model.ProjectFile, error) {
	result, err := r.supabase.AdminTable("project_files").Eq("project_id", projectID).Order("path", true).SelectQuery()
	if err != nil {
		return nil, err
	}

	files := make([]model.ProjectFile, 0, len(result.Data))
	for _, item := range result.Data {
		record, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		files = append(files, *mapToProjectFile(record))
	}
	return files, nil
}

func (r *GeneratedFileRepository) FindByPath(ctx context.Context, projectID, path string) (*model.ProjectFile, error) {
	result, err := r.supabase.AdminTable("project_files").Eq("project_id", projectID).Eq("path", path).First()
	if err != nil {
		return nil, err
	}
	if fileMap, ok := firstDataMap(result.Data); ok {
		return mapToProjectFile(fileMap), nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *GeneratedFileRepository) Update(ctx context.Context, file *model.ProjectFile) error {
	if r == nil || r.supabase == nil || file == nil {
		return nil
	}

	data := map[string]interface{}{
		"content":      file.Content,
		"content_hash": file.ContentHash,
		"file_type":    file.FileType,
		"size":         file.Size,
	}
	result, err := r.supabase.AdminTable("project_files").Eq("project_id", file.ProjectID).Eq("path", file.Path).Update(data)
	if err != nil {
		return fmt.Errorf("update project file failed: %w", err)
	}
	if fileMap, ok := firstDataMap(result.Data); ok {
		applyProjectFileFields(file, fileMap)
	}
	return nil
}

func (r *GeneratedFileRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	if r == nil || r.supabase == nil {
		return nil
	}
	if _, err := r.supabase.AdminTable("project_files").Eq("project_id", projectID).Delete(); err != nil {
		return fmt.Errorf("delete project files failed: %w", err)
	}
	return nil
}

func (r *EngineeringStateRepository) UpsertSnapshot(ctx context.Context, state *model.ProjectEngineeringState) error {
	if r == nil || r.supabase == nil || state == nil {
		return nil
	}

	if _, err := r.supabase.AdminTable("project_engineering_states").Eq("project_id", state.ProjectID).Delete(); err != nil {
		return fmt.Errorf("replace project engineering state failed: %w", err)
	}
	data := map[string]interface{}{
		"project_id":      state.ProjectID,
		"user_id":         state.UserID,
		"workflow_stage":  state.WorkflowStage,
		"workflow_mode":   state.WorkflowMode,
		"workflow_status": state.WorkflowStatus,
		"state":           state.State,
		"content":         state.Content,
		"model":           state.Model,
	}
	if !state.CreatedAt.IsZero() {
		data["created_at"] = state.CreatedAt
	}
	if !state.UpdatedAt.IsZero() {
		data["updated_at"] = state.UpdatedAt
	}

	result, err := r.supabase.AdminTable("project_engineering_states").Insert(data)
	if err != nil {
		return fmt.Errorf("upsert project engineering state failed: %w", err)
	}
	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			state.ID = int64(id)
		}
	}
	return nil
}

func (r *EngineeringStateRepository) FindByProjectID(ctx context.Context, projectID string) (*model.ProjectEngineeringState, error) {
	result, err := r.supabase.AdminTable("project_engineering_states").Eq("project_id", projectID).First()
	if err != nil {
		return nil, err
	}
	if m, ok := firstDataMap(result.Data); ok {
		return mapToProjectEngineeringState(m), nil
	}
	return nil, fmt.Errorf("project engineering state not found")
}

func (r *EngineeringStateRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("project_engineering_states").Eq("project_id", projectID).Delete()
	if err != nil {
		return fmt.Errorf("delete project engineering state failed: %w", err)
	}
	return nil
}

func (r *CapabilityExecutionAuditRepository) Create(ctx context.Context, audit *model.ProjectCapabilityExecutionAudit) error {
	if r == nil || r.supabase == nil || audit == nil {
		return nil
	}
	data := map[string]interface{}{
		"project_id":          audit.ProjectID,
		"user_id":             audit.UserID,
		"workflow_stage":      audit.WorkflowStage,
		"workflow_mode":       audit.WorkflowMode,
		"capability_profile":  audit.CapabilityProfile,
		"status":              audit.Status,
		"provider_resolution": audit.ProviderResolution,
		"execution_audit":     audit.ExecutionAudit,
		"execution_result":    audit.ExecutionResult,
		"source_note":         audit.SourceNote,
	}
	if !audit.CreatedAt.IsZero() {
		data["created_at"] = audit.CreatedAt
	}

	result, err := r.supabase.AdminTable("project_capability_execution_audits").Insert(data)
	if err != nil {
		return fmt.Errorf("create project capability execution audit failed: %w", err)
	}
	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			audit.ID = int64(id)
		}
	}
	return nil
}

func (r *CapabilityExecutionAuditRepository) ListByProjectID(ctx context.Context, projectID, status, capabilityProfile string, offset, limit int) ([]model.ProjectCapabilityExecutionAudit, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := r.supabase.AdminTable("project_capability_execution_audits").Eq("project_id", projectID).Order("created_at", false).Order("id", false).Offset(offset).Limit(limit)
	if status != "" {
		query = query.Eq("status", status)
	}
	if capabilityProfile != "" {
		query = query.Eq("capability_profile", capabilityProfile)
	}

	result, err := query.SelectQuery()
	if err != nil {
		return nil, 0, err
	}
	records := make([]model.ProjectCapabilityExecutionAudit, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			records = append(records, *mapToProjectCapabilityExecutionAudit(m))
		}
	}
	return records, int64(len(records)), nil
}

func (r *CapabilityExecutionAuditRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("project_capability_execution_audits").Eq("project_id", projectID).Delete()
	if err != nil {
		return fmt.Errorf("delete project capability execution audits failed: %w", err)
	}
	return nil
}

func (r *ProjectResourceAlertEventRepository) Create(ctx context.Context, event *model.ProjectResourceAlertEvent) error {
	if r == nil || r.supabase == nil || event == nil {
		return nil
	}
	data := map[string]interface{}{
		"project_id":           event.ProjectID,
		"user_id":              event.UserID,
		"status":               event.Status,
		"evaluation_id":        event.EvaluationID,
		"readiness_status":     event.ReadinessStatus,
		"triggered_count":      event.TriggeredCount,
		"triggered_thresholds": event.TriggeredThresholds,
		"thresholds":           event.Thresholds,
		"evaluation_preview":   event.EvaluationPreview,
		"message":              event.Message,
		"recovery":             event.Recovery,
	}
	if !event.CreatedAt.IsZero() {
		data["created_at"] = event.CreatedAt
	}

	result, err := r.supabase.AdminTable("project_resource_alert_events").Insert(data)
	if err != nil {
		return fmt.Errorf("create project resource alert event failed: %w", err)
	}
	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			event.ID = int64(id)
		}
	}
	return nil
}

func (r *ProjectResourceAlertEventRepository) ListByProjectID(ctx context.Context, projectID, status string, offset, limit int) ([]model.ProjectResourceAlertEvent, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := r.supabase.AdminTable("project_resource_alert_events").Eq("project_id", projectID).Order("created_at", false).Order("id", false).Offset(offset).Limit(limit)
	if status != "" {
		query = query.Eq("status", status)
	}

	result, err := query.SelectQuery()
	if err != nil {
		return nil, 0, err
	}
	records := make([]model.ProjectResourceAlertEvent, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			records = append(records, *mapToProjectResourceAlertEvent(m))
		}
	}
	return records, int64(len(records)), nil
}

func (r *ProjectResourceAlertEventRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("project_resource_alert_events").Eq("project_id", projectID).Delete()
	if err != nil {
		return fmt.Errorf("delete project resource alert events failed: %w", err)
	}
	return nil
}

func (r *ChatMessageRepository) Create(ctx context.Context, msg *model.ChatMessage) error {
	data := map[string]interface{}{
		"project_id":         msg.ProjectID,
		"user_id":            msg.UserID, // UUID string
		"role":               msg.Role,
		"content":            msg.Content,
		"visual_attachments": msg.VisualAttachments,
		"visual_context":     msg.VisualContext,
		"model":              msg.Model,
		"tokens":             msg.Tokens,
	}

	result, err := r.supabase.AdminTable("chat_messages").Insert(data)
	if err != nil {
		if msg.UserID != "" && shouldRetryChatMessageWithoutUserID(err) {
			delete(data, "user_id")
			result, err = r.supabase.AdminTable("chat_messages").Insert(data)
		}
	}
	if err != nil {
		return fmt.Errorf("create chat message failed: %w", err)
	}

	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			msg.ID = int64(id)
		}
	}

	return nil
}

func shouldRetryChatMessageWithoutUserID(err error) bool {
	errMsg := strings.ToLower(err.Error())
	return strings.Contains(errMsg, "invalid input syntax for type bigint") ||
		strings.Contains(errMsg, "\"code\":\"22p02\"") ||
		(strings.Contains(errMsg, "user_id") && strings.Contains(errMsg, "bigint"))
}

func (r *ChatMessageRepository) ListByProjectID(ctx context.Context, projectID string) ([]model.ChatMessage, error) {
	result, err := r.supabase.AdminTable("chat_messages").Eq("project_id", projectID).Order("created_at", true).SelectQuery()
	if err != nil {
		return nil, err
	}

	messages := make([]model.ChatMessage, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			messages = append(messages, *r.mapToChatMessage(m))
		}
	}
	return messages, nil
}

func (r *ChatMessageRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("chat_messages").Eq("project_id", projectID).Delete()
	if err != nil {
		return fmt.Errorf("delete chat messages failed: %w", err)
	}
	return nil
}

func (r *CommitRepository) DeleteByProjectID(ctx context.Context, projectID string) error {
	_, err := r.supabase.AdminTable("commits").Eq("project_id", projectID).Delete()
	if err != nil {
		return fmt.Errorf("delete commits failed: %w", err)
	}
	return nil
}

func mapToProjectEngineeringState(m map[string]interface{}) *model.ProjectEngineeringState {
	state := &model.ProjectEngineeringState{}
	if id, ok := m["id"].(float64); ok {
		state.ID = int64(id)
	}
	if projectID, ok := m["project_id"].(string); ok {
		state.ProjectID = projectID
	}
	if userID, ok := m["user_id"].(string); ok {
		state.UserID = userID
	}
	if workflowStage, ok := m["workflow_stage"].(string); ok {
		state.WorkflowStage = workflowStage
	}
	if workflowMode, ok := m["workflow_mode"].(string); ok {
		state.WorkflowMode = workflowMode
	}
	if workflowStatus, ok := m["workflow_status"].(string); ok {
		state.WorkflowStatus = workflowStatus
	}
	if rawState, ok := m["state"].(string); ok {
		state.State = rawState
	}
	if content, ok := m["content"].(string); ok {
		state.Content = content
	}
	if modelName, ok := m["model"].(string); ok {
		state.Model = modelName
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(createdAt); ok {
			state.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(updatedAt); ok {
			state.UpdatedAt = parsed
		}
	}
	return state
}

func mapToProjectCapabilityExecutionAudit(m map[string]interface{}) *model.ProjectCapabilityExecutionAudit {
	audit := &model.ProjectCapabilityExecutionAudit{}
	if id, ok := m["id"].(float64); ok {
		audit.ID = int64(id)
	}
	if projectID, ok := m["project_id"].(string); ok {
		audit.ProjectID = projectID
	}
	if userID, ok := m["user_id"].(string); ok {
		audit.UserID = userID
	}
	if workflowStage, ok := m["workflow_stage"].(string); ok {
		audit.WorkflowStage = workflowStage
	}
	if workflowMode, ok := m["workflow_mode"].(string); ok {
		audit.WorkflowMode = workflowMode
	}
	if capabilityProfile, ok := m["capability_profile"].(string); ok {
		audit.CapabilityProfile = capabilityProfile
	}
	if status, ok := m["status"].(string); ok {
		audit.Status = status
	}
	if providerResolution, ok := m["provider_resolution"].(string); ok {
		audit.ProviderResolution = providerResolution
	}
	if executionAudit, ok := m["execution_audit"].(string); ok {
		audit.ExecutionAudit = executionAudit
	}
	if executionResult, ok := m["execution_result"].(string); ok {
		audit.ExecutionResult = executionResult
	}
	if sourceNote, ok := m["source_note"].(string); ok {
		audit.SourceNote = sourceNote
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(createdAt); ok {
			audit.CreatedAt = parsed
		}
	}
	return audit
}

func mapToProjectResourceAlertEvent(m map[string]interface{}) *model.ProjectResourceAlertEvent {
	event := &model.ProjectResourceAlertEvent{}
	if id, ok := m["id"].(float64); ok {
		event.ID = int64(id)
	}
	if projectID, ok := m["project_id"].(string); ok {
		event.ProjectID = projectID
	}
	if userID, ok := m["user_id"].(string); ok {
		event.UserID = userID
	}
	if status, ok := m["status"].(string); ok {
		event.Status = status
	}
	if evaluationID, ok := m["evaluation_id"].(string); ok {
		event.EvaluationID = evaluationID
	}
	if readinessStatus, ok := m["readiness_status"].(string); ok {
		event.ReadinessStatus = readinessStatus
	}
	if triggeredCount, ok := m["triggered_count"].(float64); ok {
		event.TriggeredCount = int(triggeredCount)
	}
	if triggeredThresholds, ok := m["triggered_thresholds"].(string); ok {
		event.TriggeredThresholds = triggeredThresholds
	}
	if thresholds, ok := m["thresholds"].(string); ok {
		event.Thresholds = thresholds
	}
	if evaluationPreview, ok := m["evaluation_preview"].(string); ok {
		event.EvaluationPreview = evaluationPreview
	}
	if message, ok := m["message"].(string); ok {
		event.Message = message
	}
	if recovery, ok := m["recovery"].(string); ok {
		event.Recovery = recovery
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(createdAt); ok {
			event.CreatedAt = parsed
		}
	}
	return event
}

func (r *ChatMessageRepository) mapToChatMessage(m map[string]interface{}) *model.ChatMessage {
	msg := &model.ChatMessage{}

	if id, ok := m["id"].(float64); ok {
		msg.ID = int64(id)
	}
	if projectID, ok := m["project_id"].(string); ok {
		msg.ProjectID = projectID
	}
	// UserID is UUID string
	if userID, ok := m["user_id"].(string); ok {
		msg.UserID = userID
	}
	if role, ok := m["role"].(string); ok {
		msg.Role = role
	}
	if content, ok := m["content"].(string); ok {
		msg.Content = content
	}
	if visualAttachments, ok := m["visual_attachments"].(string); ok {
		msg.VisualAttachments = visualAttachments
	}
	if visualContext, ok := m["visual_context"].(string); ok {
		msg.VisualContext = visualContext
	}
	if model, ok := m["model"].(string); ok {
		msg.Model = model
	}
	if tokens, ok := m["tokens"].(float64); ok {
		msg.Tokens = int(tokens)
	}

	return msg
}

// ============================================
// SystemConfig Repository
// ============================================

type SystemConfigRepository struct {
	supabase *Client
	table    *Table
}

func NewSystemConfigRepository(repo *SupabaseRepository) *SystemConfigRepository {
	return &SystemConfigRepository{
		supabase: repo.client,
		table:    repo.client.Table("system_config"),
	}
}

func (r *SystemConfigRepository) Get(ctx context.Context, key string) (*model.SystemConfig, error) {
	result, err := r.supabase.AdminTable("system_config").Eq("key", key).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("config not found: %s", key)
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid config record")
	}
	return r.mapToSystemConfig(record), nil
}

func (r *SystemConfigRepository) Set(ctx context.Context, key, value string) error {
	result, err := r.supabase.AdminTable("system_config").Eq("key", key).Update(map[string]interface{}{
		"value":      value,
		"updated_at": "now()",
	})
	if err != nil {
		return err
	}
	if len(result.Data) == 0 {
		_, err = r.supabase.AdminTable("system_config").Insert(map[string]interface{}{
			"key":   key,
			"value": value,
		})
	}
	return err
}

func (r *SystemConfigRepository) List(ctx context.Context) ([]model.SystemConfig, error) {
	result, err := r.supabase.AdminTable("system_config").SelectQuery()
	if err != nil {
		return nil, err
	}

	configs := make([]model.SystemConfig, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			configs = append(configs, *r.mapToSystemConfig(m))
		}
	}
	return configs, nil
}

// InitDefaults 初始化默认系统配置（Supabase 已通过 SQL 预置）
func (r *SystemConfigRepository) InitDefaults(ctx context.Context) error {
	return nil
}

func (r *SystemConfigRepository) mapToSystemConfig(m map[string]interface{}) *model.SystemConfig {
	cfg := &model.SystemConfig{}
	if id, ok := m["id"].(float64); ok {
		cfg.ID = int64(id)
	}
	if key, ok := m["key"].(string); ok {
		cfg.Key = key
	}
	if value, ok := m["value"].(string); ok {
		cfg.Value = value
	}
	if desc, ok := m["description"].(string); ok {
		cfg.Description = desc
	}
	return cfg
}

// ============================================
// AdminAuditLog Repository - admin_id is uuid
// ============================================

type AdminAuditLogRepository struct {
	supabase *Client
	table    *Table
}

func NewAdminAuditLogRepository(repo *SupabaseRepository) *AdminAuditLogRepository {
	return &AdminAuditLogRepository{
		supabase: repo.client,
		table:    repo.client.Table("admin_audit_log"),
	}
}

func (r *AdminAuditLogRepository) Create(ctx context.Context, log *model.AdminAuditLog) error {
	data := map[string]interface{}{
		"admin_id":    log.AdminID, // UUID string
		"action":      log.Action,
		"target_type": log.TargetType,
		"target_id":   log.TargetID,
		"detail":      log.Detail,
		"ip_address":  log.IPAddress,
	}

	result, err := r.supabase.AdminTable("admin_audit_log").Insert(data)
	if err != nil {
		return err
	}

	if m, ok := firstDataMap(result.Data); ok {
		if id, ok := m["id"].(float64); ok {
			log.ID = int64(id)
		}
	}

	return nil
}

func (r *AdminAuditLogRepository) List(ctx context.Context, offset, limit int) ([]model.AdminAuditLog, error) {
	t := r.supabase.AdminTable("admin_audit_log").Order("created_at", false)
	if limit > 0 {
		t = t.Limit(limit)
	}
	if offset > 0 {
		t = t.Offset(offset)
	}
	result, err := t.SelectQuery()
	if err != nil {
		return nil, err
	}

	logs := make([]model.AdminAuditLog, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			log := model.AdminAuditLog{}
			if id, ok := m["id"].(float64); ok {
				log.ID = int64(id)
			}
			if adminID, ok := m["admin_id"].(string); ok {
				log.AdminID = adminID // UUID string
			}
			if action, ok := m["action"].(string); ok {
				log.Action = action
			}
			if targetType, ok := m["target_type"].(string); ok {
				log.TargetType = targetType
			}
			if targetID, ok := m["target_id"].(string); ok {
				log.TargetID = targetID
			}
			if detail, ok := m["detail"].(string); ok {
				log.Detail = detail
			}
			if ip, ok := m["ip_address"].(string); ok {
				log.IPAddress = ip
			}
			logs = append(logs, log)
		}
	}
	return logs, nil
}

func (r *AdminAuditLogRepository) Count(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("admin_audit_log").Count()
	return int64(count), err
}

// ============================================
// Admin Repository - 对齐 admins 表 (id: uuid, 独立于 users)
// ============================================

type AdminRepository struct {
	supabase *Client
}

// FindByEmail 根据邮箱查找管理员
func (r *AdminRepository) FindByEmail(ctx context.Context, email string) (*model.Admin, error) {
	result, err := r.supabase.AdminTable("admins").Eq("email", email).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("admin not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid admin record")
	}
	mapped := mapToAdmin(record)
	return &mapped, nil
}

// FindByID 根据 ID 查找管理员
func (r *AdminRepository) FindByID(ctx context.Context, id string) (*model.Admin, error) {
	result, err := r.supabase.AdminTable("admins").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("admin not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid admin record")
	}
	mapped := mapToAdmin(record)
	return &mapped, nil
}

// Create 创建管理员
func (r *AdminRepository) Create(ctx context.Context, admin *model.Admin) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"id":                   admin.ID,
		"email":                admin.Email,
		"username":             admin.Username,
		"password_hash":        admin.PasswordHash,
		"role":                 admin.Role,
		"status":               admin.Status,
		"must_change_password": admin.MustChangePassword,
		"auth_version":         admin.AuthVersion,
		"avatar_url":           admin.AvatarURL,
		"created_at":           now,
		"updated_at":           now,
	}

	result, err := r.supabase.AdminTable("admins").Insert(data)
	if err != nil {
		return err
	}

	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToAdmin(m)
		admin.ID = mapped.ID
		admin.CreatedAt = mapped.CreatedAt
		admin.UpdatedAt = mapped.UpdatedAt
	}
	return nil
}

// Update 更新管理员
func (r *AdminRepository) Update(ctx context.Context, admin *model.Admin) error {
	data := map[string]interface{}{
		"email":                admin.Email,
		"username":             admin.Username,
		"password_hash":        admin.PasswordHash,
		"role":                 admin.Role,
		"status":               admin.Status,
		"must_change_password": admin.MustChangePassword,
		"auth_version":         admin.AuthVersion,
		"avatar_url":           admin.AvatarURL,
		"updated_at":           time.Now().Format(time.RFC3339),
	}
	_, err := r.supabase.AdminTable("admins").Eq("id", admin.ID).Update(data)
	return err
}

// UpdateLastLogin 更新最后登录时间
func (r *AdminRepository) UpdateLastLogin(ctx context.Context, id string) error {
	data := map[string]interface{}{
		"last_login_at": time.Now().Format(time.RFC3339),
	}
	_, err := r.supabase.AdminTable("admins").Eq("id", id).Update(data)
	return err
}

// List 列出管理员
func (r *AdminRepository) List(ctx context.Context, page, pageSize int) ([]model.Admin, int64, error) {
	offset := (page - 1) * pageSize
	t := r.supabase.AdminTable("admins").Order("created_at", false)
	if pageSize > 0 {
		t = t.Limit(pageSize)
	}
	if offset > 0 {
		t = t.Offset(offset)
	}

	result, err := t.SelectQuery()
	if err != nil {
		return nil, 0, err
	}

	admins := make([]model.Admin, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			admins = append(admins, mapToAdmin(m))
		}
	}
	return admins, int64(len(admins)), nil
}

// Delete 删除管理员
func (r *AdminRepository) Delete(ctx context.Context, id string) error {
	_, err := r.supabase.AdminTable("admins").Eq("id", id).Delete()
	return err
}

func (r *AdminRepository) ListRoles(ctx context.Context) ([]model.AdminRole, error) {
	result, err := r.supabase.AdminTable("admin_roles").Order("is_system", false).Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	roles := make([]model.AdminRole, 0, len(result.Data))
	for _, item := range result.Data {
		if m, ok := item.(map[string]interface{}); ok {
			roles = append(roles, mapToAdminRole(m))
		}
	}
	return roles, nil
}

func (r *AdminRepository) FindRoleByID(ctx context.Context, id string) (*model.AdminRole, error) {
	result, err := r.supabase.AdminTable("admin_roles").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("admin role not found")
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("invalid admin role record")
	}
	role := mapToAdminRole(record)
	return &role, nil
}

func (r *AdminRepository) CreateRole(ctx context.Context, role *model.AdminRole) error {
	data := map[string]interface{}{
		"id":           role.ID,
		"name":         role.Name,
		"display_name": role.DisplayName,
		"description":  role.Description,
		"is_system":    role.IsSystem,
		"status":       role.Status,
		"created_at":   time.Now().Format(time.RFC3339),
		"updated_at":   time.Now().Format(time.RFC3339),
	}
	result, err := r.supabase.AdminTable("admin_roles").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToAdminRole(m)
		role.ID = mapped.ID
		role.CreatedAt = mapped.CreatedAt
		role.UpdatedAt = mapped.UpdatedAt
	}
	return nil
}

func (r *AdminRepository) UpdateRole(ctx context.Context, role *model.AdminRole) error {
	_, err := r.supabase.AdminTable("admin_roles").Eq("id", role.ID).Update(map[string]interface{}{
		"name":         role.Name,
		"display_name": role.DisplayName,
		"description":  role.Description,
		"is_system":    role.IsSystem,
		"status":       role.Status,
		"updated_at":   time.Now().Format(time.RFC3339),
	})
	return err
}

func (r *AdminRepository) DeleteRole(ctx context.Context, id string) error {
	if _, err := r.supabase.AdminTable("admin_role_permissions").Eq("role_id", id).Delete(); err != nil {
		return err
	}
	if _, err := r.supabase.AdminTable("admin_user_roles").Eq("role_id", id).Delete(); err != nil {
		return err
	}
	_, err := r.supabase.AdminTable("admin_roles").Eq("id", id).Delete()
	return err
}

func (r *AdminRepository) ListPermissions(ctx context.Context) ([]model.AdminPermission, error) {
	result, err := r.supabase.AdminTable("admin_permissions").Order("code", true).SelectQuery()
	if err != nil {
		return nil, err
	}
	permissions := make([]model.AdminPermission, 0, len(result.Data))
	for _, item := range result.Data {
		if m, ok := item.(map[string]interface{}); ok {
			permissions = append(permissions, mapToAdminPermission(m))
		}
	}
	return permissions, nil
}

func (r *AdminRepository) GetRolePermissions(ctx context.Context, roleID string) ([]model.AdminPermission, error) {
	rolePermissionResult, err := r.supabase.AdminTable("admin_role_permissions").Eq("role_id", roleID).SelectQuery()
	if err != nil {
		return nil, err
	}
	permissionIDs := make([]interface{}, 0, len(rolePermissionResult.Data))
	for _, item := range rolePermissionResult.Data {
		if m, ok := item.(map[string]interface{}); ok {
			if permissionID, ok := m["permission_id"].(string); ok && permissionID != "" {
				permissionIDs = append(permissionIDs, permissionID)
			}
		}
	}
	if len(permissionIDs) == 0 {
		return []model.AdminPermission{}, nil
	}
	permissionsResult, err := r.supabase.AdminTable("admin_permissions").In("id", permissionIDs).Order("code", true).SelectQuery()
	if err != nil {
		return nil, err
	}
	permissions := make([]model.AdminPermission, 0, len(permissionsResult.Data))
	for _, item := range permissionsResult.Data {
		if m, ok := item.(map[string]interface{}); ok {
			permissions = append(permissions, mapToAdminPermission(m))
		}
	}
	return permissions, nil
}

func (r *AdminRepository) ReplaceRolePermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	if _, err := r.supabase.AdminTable("admin_role_permissions").Eq("role_id", roleID).Delete(); err != nil {
		return err
	}
	if len(permissionIDs) == 0 {
		return nil
	}
	now := time.Now().Format(time.RFC3339)
	rows := make([]map[string]interface{}, 0, len(permissionIDs))
	for _, permissionID := range permissionIDs {
		rows = append(rows, map[string]interface{}{
			"role_id":       roleID,
			"permission_id": permissionID,
			"created_at":    now,
		})
	}
	_, err := r.supabase.AdminTable("admin_role_permissions").Insert(rows)
	return err
}

func (r *AdminRepository) GetAdminRoles(ctx context.Context, adminID string) ([]model.AdminRole, error) {
	adminRoleResult, err := r.supabase.AdminTable("admin_user_roles").Eq("admin_id", adminID).SelectQuery()
	if err != nil {
		return nil, err
	}
	roleIDs := make([]interface{}, 0, len(adminRoleResult.Data))
	for _, item := range adminRoleResult.Data {
		if m, ok := item.(map[string]interface{}); ok {
			if roleID, ok := m["role_id"].(string); ok && roleID != "" {
				roleIDs = append(roleIDs, roleID)
			}
		}
	}
	if len(roleIDs) == 0 {
		return []model.AdminRole{}, nil
	}
	rolesResult, err := r.supabase.AdminTable("admin_roles").In("id", roleIDs).Order("is_system", false).Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	roles := make([]model.AdminRole, 0, len(rolesResult.Data))
	for _, item := range rolesResult.Data {
		if m, ok := item.(map[string]interface{}); ok {
			roles = append(roles, mapToAdminRole(m))
		}
	}
	return roles, nil
}

func (r *AdminRepository) ReplaceAdminRoles(ctx context.Context, adminID string, roleIDs []string) error {
	if _, err := r.supabase.AdminTable("admin_user_roles").Eq("admin_id", adminID).Delete(); err != nil {
		return err
	}
	if len(roleIDs) == 0 {
		return nil
	}
	now := time.Now().Format(time.RFC3339)
	rows := make([]map[string]interface{}, 0, len(roleIDs))
	for _, roleID := range roleIDs {
		rows = append(rows, map[string]interface{}{
			"admin_id":   adminID,
			"role_id":    roleID,
			"created_at": now,
		})
	}
	_, err := r.supabase.AdminTable("admin_user_roles").Insert(rows)
	return err
}

func (r *AdminRepository) GetAdminPermissionCodes(ctx context.Context, adminID string) ([]string, error) {
	roles, err := r.GetAdminRoles(ctx, adminID)
	if err != nil {
		return nil, err
	}
	codeSet := make(map[string]struct{})
	for _, role := range roles {
		permissions, err := r.GetRolePermissions(ctx, role.ID)
		if err != nil {
			return nil, err
		}
		for _, permission := range permissions {
			codeSet[permission.Code] = struct{}{}
		}
	}
	result := make([]string, 0, len(codeSet))
	for code := range codeSet {
		result = append(result, code)
	}
	return result, nil
}

func (r *AdminRepository) CountEnterpriseOrganizations(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_organizations").Count()
	return int64(count), err
}

func (r *AdminRepository) CountEnterpriseTeams(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_teams").Count()
	return int64(count), err
}

func (r *AdminRepository) CountEnterpriseMembers(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_members").Count()
	return int64(count), err
}

func (r *AdminRepository) CountEnterpriseProjectOwnerships(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_project_ownerships").Count()
	return int64(count), err
}

func (r *AdminRepository) CountEnterpriseProjectAccessGuardActivationAudits(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_project_access_guard_activation_audits").Count()
	return int64(count), err
}

func (r *AdminRepository) CountEnterpriseAuditExportTasks(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_audit_export_tasks").Count()
	return int64(count), err
}

func (r *AdminRepository) FindEnterpriseAuditExportTaskByID(ctx context.Context, taskID string) (*model.EnterpriseAuditExportTask, error) {
	result, err := r.supabase.AdminTable("enterprise_audit_export_tasks").Eq("id", taskID).Limit(1).SelectQuery()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, nil
	}
	task := mapToEnterpriseAuditExportTask(record)
	return &task, nil
}

func (r *AdminRepository) FindEnterpriseAuditExportTaskByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportTask, error) {
	result, err := r.supabase.AdminTable("enterprise_audit_export_tasks").Eq("idempotency_key", idempotencyKey).Limit(1).SelectQuery()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, nil
	}
	task := mapToEnterpriseAuditExportTask(record)
	return &task, nil
}

func (r *AdminRepository) ListEnterpriseAuditExportTasks(ctx context.Context, limit int) ([]model.EnterpriseAuditExportTask, error) {
	if limit <= 0 {
		limit = 50
	}
	result, err := r.supabase.AdminTable("enterprise_audit_export_tasks").Order("created_at", false).Limit(limit).SelectQuery()
	if err != nil {
		return nil, err
	}
	tasks := make([]model.EnterpriseAuditExportTask, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			tasks = append(tasks, mapToEnterpriseAuditExportTask(record))
		}
	}
	return tasks, nil
}

func (r *AdminRepository) CountEnterpriseAuditExportDeliveryReports(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_audit_export_delivery_reports").Count()
	return int64(count), err
}

func (r *AdminRepository) ListEnterpriseAuditExportDeliveryReports(ctx context.Context, limit int) ([]model.EnterpriseAuditExportDeliveryReport, error) {
	if limit <= 0 {
		limit = 25
	}
	result, err := r.supabase.AdminTable("enterprise_audit_export_delivery_reports").Order("created_at", false).Limit(limit).SelectQuery()
	if err != nil {
		return nil, err
	}
	reports := make([]model.EnterpriseAuditExportDeliveryReport, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			reports = append(reports, mapToEnterpriseAuditExportDeliveryReport(record))
		}
	}
	return reports, nil
}

func (r *AdminRepository) CountEnterpriseAuditExportWorkerExecutionRequests(ctx context.Context) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_audit_export_worker_execution_requests").Count()
	return int64(count), err
}

func (r *AdminRepository) CountEnterpriseAuditExportWorkerExecutionRequestsByStatus(ctx context.Context, status string) (int64, error) {
	count, err := r.supabase.AdminTable("enterprise_audit_export_worker_execution_requests").Eq("status", status).Count()
	return int64(count), err
}

func (r *AdminRepository) FindEnterpriseAuditExportWorkerExecutionRequestByID(ctx context.Context, requestID string) (*model.EnterpriseAuditExportWorkerExecutionRequest, error) {
	result, err := r.supabase.AdminTable("enterprise_audit_export_worker_execution_requests").Eq("id", requestID).Limit(1).SelectQuery()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, nil
	}
	request := mapToEnterpriseAuditExportWorkerExecutionRequest(record)
	return &request, nil
}

func (r *AdminRepository) FindEnterpriseAuditExportWorkerExecutionRequestByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportWorkerExecutionRequest, error) {
	result, err := r.supabase.AdminTable("enterprise_audit_export_worker_execution_requests").Eq("idempotency_key", idempotencyKey).Limit(1).SelectQuery()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, nil
	}
	request := mapToEnterpriseAuditExportWorkerExecutionRequest(record)
	return &request, nil
}

func (r *AdminRepository) FindEnterpriseAuditExportDeliveryReportByIdempotencyKey(ctx context.Context, idempotencyKey string) (*model.EnterpriseAuditExportDeliveryReport, error) {
	result, err := r.supabase.AdminTable("enterprise_audit_export_delivery_reports").Eq("idempotency_key", idempotencyKey).Limit(1).SelectQuery()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, nil
	}
	report := mapToEnterpriseAuditExportDeliveryReport(record)
	return &report, nil
}

func (r *AdminRepository) ListEnterpriseProjectAccessGuardActivationAudits(ctx context.Context, limit int) ([]model.EnterpriseProjectAccessGuardActivationAudit, error) {
	if limit <= 0 {
		limit = 50
	}
	result, err := r.supabase.AdminTable("enterprise_project_access_guard_activation_audits").Order("created_at", false).Limit(limit).SelectQuery()
	if err != nil {
		return nil, err
	}
	audits := make([]model.EnterpriseProjectAccessGuardActivationAudit, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			audits = append(audits, mapToEnterpriseProjectAccessGuardActivationAudit(record))
		}
	}
	return audits, nil
}

func (r *AdminRepository) CreateEnterpriseProjectAccessGuardActivationAudit(ctx context.Context, audit *model.EnterpriseProjectAccessGuardActivationAudit) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"event_type":          audit.EventType,
		"status":              audit.Status,
		"actor_admin_id":      audit.ActorAdminID,
		"readiness_status":    audit.ReadinessStatus,
		"current_mode":        audit.CurrentMode,
		"target_mode":         audit.TargetMode,
		"readiness_snapshot":  mapStringToJSONBValue(audit.ReadinessSnapshot),
		"blocker_snapshot":    mapStringToJSONBValue(audit.BlockerSnapshot),
		"review_snapshot":     mapStringToJSONBValue(audit.ReviewSnapshot),
		"audit_plan_snapshot": mapStringToJSONBValue(audit.AuditPlanSnapshot),
		"execution_result":    mapStringToJSONBValue(audit.ExecutionResult),
		"rollback_reference":  audit.RollbackReference,
		"source":              audit.Source,
		"created_at":          now,
	}
	result, err := r.supabase.AdminTable("enterprise_project_access_guard_activation_audits").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseProjectAccessGuardActivationAudit(m)
		audit.ID = mapped.ID
		audit.CreatedAt = mapped.CreatedAt
	}
	return nil
}

func (r *AdminRepository) ListEnterpriseOrganizations(ctx context.Context) ([]model.EnterpriseOrganization, error) {
	result, err := r.supabase.AdminTable("enterprise_organizations").Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	organizations := make([]model.EnterpriseOrganization, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			organizations = append(organizations, mapToEnterpriseOrganization(record))
		}
	}
	return organizations, nil
}

func (r *AdminRepository) FindEnterpriseOrganizationByID(ctx context.Context, id string) (*model.EnterpriseOrganization, error) {
	result, err := r.supabase.AdminTable("enterprise_organizations").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("enterprise organization not found")
	}
	organization := mapToEnterpriseOrganization(record)
	return &organization, nil
}

func (r *AdminRepository) ListEnterpriseTeams(ctx context.Context) ([]model.EnterpriseTeam, error) {
	result, err := r.supabase.AdminTable("enterprise_teams").Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	teams := make([]model.EnterpriseTeam, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			teams = append(teams, mapToEnterpriseTeam(record))
		}
	}
	return teams, nil
}

func (r *AdminRepository) FindEnterpriseTeamByID(ctx context.Context, id string) (*model.EnterpriseTeam, error) {
	result, err := r.supabase.AdminTable("enterprise_teams").Eq("id", id).First()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, fmt.Errorf("enterprise team not found")
	}
	team := mapToEnterpriseTeam(record)
	return &team, nil
}

func (r *AdminRepository) FindEnterpriseMembersByUserAndOrganizationID(ctx context.Context, userID, organizationID string) ([]model.EnterpriseMember, error) {
	result, err := r.supabase.AdminTable("enterprise_members").Eq("user_id", userID).Eq("organization_id", organizationID).Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	members := make([]model.EnterpriseMember, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			members = append(members, mapToEnterpriseMember(record))
		}
	}
	return members, nil
}

func (r *AdminRepository) ListEnterpriseProjectOwnerships(ctx context.Context) ([]model.EnterpriseProjectOwnership, error) {
	result, err := r.supabase.AdminTable("enterprise_project_ownerships").Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, err
	}
	ownerships := make([]model.EnterpriseProjectOwnership, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			ownerships = append(ownerships, mapToEnterpriseProjectOwnership(record))
		}
	}
	return ownerships, nil
}

func (r *AdminRepository) FindEnterpriseProjectOwnershipByProjectID(ctx context.Context, projectID string) (*model.EnterpriseProjectOwnership, error) {
	result, err := r.supabase.AdminTable("enterprise_project_ownerships").Eq("project_id", projectID).Limit(1).SelectQuery()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, nil
	}
	ownership := mapToEnterpriseProjectOwnership(record)
	return &ownership, nil
}

func (r *AdminRepository) CreateEnterpriseOrganization(ctx context.Context, organization *model.EnterpriseOrganization) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"id":           organization.ID,
		"slug":         organization.Slug,
		"display_name": organization.DisplayName,
		"status":       organization.Status,
		"source":       organization.Source,
		"created_at":   now,
		"updated_at":   now,
	}
	result, err := r.supabase.AdminTable("enterprise_organizations").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseOrganization(m)
		organization.ID = mapped.ID
		organization.CreatedAt = mapped.CreatedAt
		organization.UpdatedAt = mapped.UpdatedAt
	}
	return nil
}

func (r *AdminRepository) CreateEnterpriseTeam(ctx context.Context, team *model.EnterpriseTeam) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"id":              team.ID,
		"organization_id": team.OrganizationID,
		"slug":            team.Slug,
		"display_name":    team.DisplayName,
		"status":          team.Status,
		"created_at":      now,
		"updated_at":      now,
	}
	result, err := r.supabase.AdminTable("enterprise_teams").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseTeam(m)
		team.ID = mapped.ID
		team.CreatedAt = mapped.CreatedAt
		team.UpdatedAt = mapped.UpdatedAt
	}
	return nil
}

func (r *AdminRepository) CreateEnterpriseMember(ctx context.Context, member *model.EnterpriseMember) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"organization_id": member.OrganizationID,
		"team_id":         member.TeamID,
		"user_id":         member.UserID,
		"role":            member.Role,
		"status":          member.Status,
		"source":          member.Source,
		"created_at":      now,
		"updated_at":      now,
	}
	result, err := r.supabase.AdminTable("enterprise_members").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseMember(m)
		member.ID = mapped.ID
		member.CreatedAt = mapped.CreatedAt
		member.UpdatedAt = mapped.UpdatedAt
	}
	return nil
}

func (r *AdminRepository) CreateEnterpriseProjectOwnership(ctx context.Context, ownership *model.EnterpriseProjectOwnership) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"project_id":      ownership.ProjectID,
		"organization_id": ownership.OrganizationID,
		"team_id":         ownership.TeamID,
		"status":          ownership.Status,
		"source":          ownership.Source,
		"created_at":      now,
		"updated_at":      now,
	}
	result, err := r.supabase.AdminTable("enterprise_project_ownerships").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseProjectOwnership(m)
		ownership.ID = mapped.ID
		ownership.CreatedAt = mapped.CreatedAt
		ownership.UpdatedAt = mapped.UpdatedAt
	}
	return nil
}

func (r *AdminRepository) CreateEnterpriseAuditExportTask(ctx context.Context, task *model.EnterpriseAuditExportTask) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"id":                     task.ID,
		"idempotency_key":        task.IdempotencyKey,
		"requested_by_admin_id":  task.RequestedByAdminID,
		"status":                 task.Status,
		"format":                 task.Format,
		"reason":                 task.Reason,
		"filters_snapshot":       json.RawMessage(task.FiltersSnapshot),
		"time_range_start":       task.TimeRangeStart.Format(time.RFC3339),
		"time_range_end":         task.TimeRangeEnd.Format(time.RFC3339),
		"request_schema_version": task.RequestSchemaVersion,
		"file_schema_version":    task.FileSchemaVersion,
		"output_path":            task.OutputPath,
		"checksum_sha256":        task.ChecksumSHA256,
		"row_count":              task.RowCount,
		"error_message":          task.ErrorMessage,
		"source":                 task.Source,
		"created_at":             now,
		"updated_at":             now,
	}
	result, err := r.supabase.AdminTable("enterprise_audit_export_tasks").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseAuditExportTask(m)
		*task = mapped
	}
	return nil
}

func (r *AdminRepository) UpdateEnterpriseAuditExportTaskStatus(ctx context.Context, task *model.EnterpriseAuditExportTask) error {
	data := map[string]interface{}{
		"status":     task.Status,
		"source":     task.Source,
		"updated_at": time.Now().Format(time.RFC3339),
	}
	result, err := r.supabase.AdminTable("enterprise_audit_export_tasks").Eq("id", task.ID).Update(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseAuditExportTask(m)
		*task = mapped
		return nil
	}
	updatedTask, err := r.FindEnterpriseAuditExportTaskByID(ctx, task.ID)
	if err != nil {
		return err
	}
	if updatedTask != nil {
		*task = *updatedTask
	}
	return nil
}

func (r *AdminRepository) CreateEnterpriseAuditExportDeliveryReport(ctx context.Context, report *model.EnterpriseAuditExportDeliveryReport) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"id":                        report.ID,
		"idempotency_key":           report.IdempotencyKey,
		"requested_by_admin_id":     report.RequestedByAdminID,
		"reason":                    report.Reason,
		"report_format":             report.ReportFormat,
		"report_content":            report.ReportContent,
		"report_content_byte_count": report.ReportContentByteCount,
		"generated_at":              report.GeneratedAt.Format(time.RFC3339),
		"checksum_sha256":           report.ChecksumSHA256,
		"storage_path":              report.StoragePath,
		"storage_schema_version":    report.StorageSchemaVersion,
		"metadata_json":             json.RawMessage(report.MetadataJSON),
		"source":                    report.Source,
		"created_at":                now,
		"updated_at":                now,
	}
	result, err := r.supabase.AdminTable("enterprise_audit_export_delivery_reports").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseAuditExportDeliveryReport(m)
		*report = mapped
	}
	return nil
}

// mapToAdmin 将 map 转换为 Admin 模型
func mapToAdmin(m map[string]interface{}) model.Admin {
	admin := model.Admin{}
	if id, ok := m["id"].(string); ok {
		admin.ID = id
	}
	if email, ok := m["email"].(string); ok {
		admin.Email = email
	}
	if username, ok := m["username"].(string); ok {
		admin.Username = username
	}
	if passwordHash, ok := m["password_hash"].(string); ok {
		admin.PasswordHash = passwordHash
	}
	if role, ok := m["role"].(string); ok {
		admin.Role = role
	}
	if status, ok := m["status"].(string); ok {
		admin.Status = status
	}
	if mustChangePassword, ok := m["must_change_password"].(bool); ok {
		admin.MustChangePassword = mustChangePassword
	}
	if authVersion, ok := m["auth_version"].(float64); ok {
		admin.AuthVersion = int(authVersion)
	}
	if avatarURL, ok := m["avatar_url"].(string); ok {
		admin.AvatarURL = avatarURL
	}
	// timestamps are handled by DB
	return admin
}

func mapToAdminRole(m map[string]interface{}) model.AdminRole {
	role := model.AdminRole{}
	if id, ok := m["id"].(string); ok {
		role.ID = id
	}
	if name, ok := m["name"].(string); ok {
		role.Name = name
	}
	if displayName, ok := m["display_name"].(string); ok {
		role.DisplayName = displayName
	}
	if description, ok := m["description"].(string); ok {
		role.Description = description
	}
	if isSystem, ok := m["is_system"].(bool); ok {
		role.IsSystem = isSystem
	}
	if status, ok := m["status"].(string); ok {
		role.Status = status
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
			role.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
			role.UpdatedAt = parsed
		}
	}
	return role
}

func mapToEnterpriseOrganization(m map[string]interface{}) model.EnterpriseOrganization {
	organization := model.EnterpriseOrganization{}
	if id, ok := m["id"].(string); ok {
		organization.ID = id
	}
	if slug, ok := m["slug"].(string); ok {
		organization.Slug = slug
	}
	if displayName, ok := m["display_name"].(string); ok {
		organization.DisplayName = displayName
	}
	if status, ok := m["status"].(string); ok {
		organization.Status = status
	}
	if source, ok := m["source"].(string); ok {
		organization.Source = source
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
			organization.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
			organization.UpdatedAt = parsed
		}
	}
	return organization
}

func mapToEnterpriseTeam(m map[string]interface{}) model.EnterpriseTeam {
	team := model.EnterpriseTeam{}
	if id, ok := m["id"].(string); ok {
		team.ID = id
	}
	if organizationID, ok := m["organization_id"].(string); ok {
		team.OrganizationID = organizationID
	}
	if slug, ok := m["slug"].(string); ok {
		team.Slug = slug
	}
	if displayName, ok := m["display_name"].(string); ok {
		team.DisplayName = displayName
	}
	if status, ok := m["status"].(string); ok {
		team.Status = status
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
			team.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
			team.UpdatedAt = parsed
		}
	}
	return team
}

func mapToEnterpriseMember(m map[string]interface{}) model.EnterpriseMember {
	member := model.EnterpriseMember{}
	switch id := m["id"].(type) {
	case int64:
		member.ID = id
	case int:
		member.ID = int64(id)
	case float64:
		member.ID = int64(id)
	}
	if organizationID, ok := m["organization_id"].(string); ok {
		member.OrganizationID = organizationID
	}
	if teamID, ok := m["team_id"].(string); ok {
		member.TeamID = &teamID
	}
	if userID, ok := m["user_id"].(string); ok {
		member.UserID = userID
	}
	if role, ok := m["role"].(string); ok {
		member.Role = role
	}
	if status, ok := m["status"].(string); ok {
		member.Status = status
	}
	if source, ok := m["source"].(string); ok {
		member.Source = source
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
			member.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
			member.UpdatedAt = parsed
		}
	}
	return member
}

func mapToEnterpriseProjectOwnership(m map[string]interface{}) model.EnterpriseProjectOwnership {
	ownership := model.EnterpriseProjectOwnership{}
	switch id := m["id"].(type) {
	case int64:
		ownership.ID = id
	case int:
		ownership.ID = int64(id)
	case float64:
		ownership.ID = int64(id)
	}
	if projectID, ok := m["project_id"].(string); ok {
		ownership.ProjectID = projectID
	}
	if organizationID, ok := m["organization_id"].(string); ok {
		ownership.OrganizationID = organizationID
	}
	if teamID, ok := m["team_id"].(string); ok {
		ownership.TeamID = &teamID
	}
	if status, ok := m["status"].(string); ok {
		ownership.Status = status
	}
	if source, ok := m["source"].(string); ok {
		ownership.Source = source
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
			ownership.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
			ownership.UpdatedAt = parsed
		}
	}
	return ownership
}

func mapToEnterpriseProjectAccessGuardActivationAudit(m map[string]interface{}) model.EnterpriseProjectAccessGuardActivationAudit {
	audit := model.EnterpriseProjectAccessGuardActivationAudit{}
	switch id := m["id"].(type) {
	case int64:
		audit.ID = id
	case int:
		audit.ID = int64(id)
	case float64:
		audit.ID = int64(id)
	}
	if eventType, ok := m["event_type"].(string); ok {
		audit.EventType = eventType
	}
	if status, ok := m["status"].(string); ok {
		audit.Status = status
	}
	if actorAdminID, ok := m["actor_admin_id"].(string); ok {
		audit.ActorAdminID = actorAdminID
	}
	if readinessStatus, ok := m["readiness_status"].(string); ok {
		audit.ReadinessStatus = readinessStatus
	}
	if currentMode, ok := m["current_mode"].(string); ok {
		audit.CurrentMode = currentMode
	}
	if targetMode, ok := m["target_mode"].(string); ok {
		audit.TargetMode = targetMode
	}
	audit.ReadinessSnapshot = mapJSONBToString(m["readiness_snapshot"])
	audit.BlockerSnapshot = mapJSONBToString(m["blocker_snapshot"])
	audit.ReviewSnapshot = mapJSONBToString(m["review_snapshot"])
	audit.AuditPlanSnapshot = mapJSONBToString(m["audit_plan_snapshot"])
	audit.ExecutionResult = mapJSONBToString(m["execution_result"])
	if rollbackReference, ok := m["rollback_reference"].(string); ok {
		audit.RollbackReference = rollbackReference
	}
	if source, ok := m["source"].(string); ok {
		audit.Source = source
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
			audit.CreatedAt = parsed
		}
	}
	return audit
}

func mapJSONBToString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case nil:
		return ""
	default:
		encoded, err := json.Marshal(typed)
		if err != nil {
			return ""
		}
		return string(encoded)
	}
}

func mapStringToJSONBValue(value string) interface{} {
	var mapped map[string]interface{}
	if err := json.Unmarshal([]byte(value), &mapped); err != nil {
		return map[string]interface{}{}
	}
	return mapped
}

func mapToEnterpriseAuditExportTask(m map[string]interface{}) model.EnterpriseAuditExportTask {
	task := model.EnterpriseAuditExportTask{}
	if id, ok := m["id"].(string); ok {
		task.ID = id
	}
	if idempotencyKey, ok := m["idempotency_key"].(string); ok {
		task.IdempotencyKey = idempotencyKey
	}
	if requestedByAdminID, ok := m["requested_by_admin_id"].(string); ok {
		task.RequestedByAdminID = requestedByAdminID
	}
	if status, ok := m["status"].(string); ok {
		task.Status = status
	}
	if format, ok := m["format"].(string); ok {
		task.Format = format
	}
	if reason, ok := m["reason"].(string); ok {
		task.Reason = reason
	}
	task.FiltersSnapshot = mapJSONBToString(m["filters_snapshot"])
	if timeRangeStart, ok := m["time_range_start"].(string); ok {
		if parsed, ok := parseSupabaseTime(timeRangeStart); ok {
			task.TimeRangeStart = parsed
		}
	}
	if timeRangeEnd, ok := m["time_range_end"].(string); ok {
		if parsed, ok := parseSupabaseTime(timeRangeEnd); ok {
			task.TimeRangeEnd = parsed
		}
	}
	if requestSchemaVersion, ok := m["request_schema_version"].(string); ok {
		task.RequestSchemaVersion = requestSchemaVersion
	}
	if fileSchemaVersion, ok := m["file_schema_version"].(string); ok {
		task.FileSchemaVersion = fileSchemaVersion
	}
	if outputPath, ok := m["output_path"].(string); ok {
		task.OutputPath = outputPath
	}
	if checksumSHA256, ok := m["checksum_sha256"].(string); ok {
		task.ChecksumSHA256 = checksumSHA256
	}
	switch rowCount := m["row_count"].(type) {
	case int64:
		task.RowCount = rowCount
	case int:
		task.RowCount = int64(rowCount)
	case float64:
		task.RowCount = int64(rowCount)
	}
	if errorMessage, ok := m["error_message"].(string); ok {
		task.ErrorMessage = errorMessage
	}
	if source, ok := m["source"].(string); ok {
		task.Source = source
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(createdAt); ok {
			task.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(updatedAt); ok {
			task.UpdatedAt = parsed
		}
	}
	return task
}

func mapToEnterpriseAuditExportDeliveryReport(m map[string]interface{}) model.EnterpriseAuditExportDeliveryReport {
	report := model.EnterpriseAuditExportDeliveryReport{}
	if id, ok := m["id"].(string); ok {
		report.ID = id
	}
	if idempotencyKey, ok := m["idempotency_key"].(string); ok {
		report.IdempotencyKey = idempotencyKey
	}
	if requestedByAdminID, ok := m["requested_by_admin_id"].(string); ok {
		report.RequestedByAdminID = requestedByAdminID
	}
	if reason, ok := m["reason"].(string); ok {
		report.Reason = reason
	}
	if reportFormat, ok := m["report_format"].(string); ok {
		report.ReportFormat = reportFormat
	}
	if reportContent, ok := m["report_content"].(string); ok {
		report.ReportContent = reportContent
	}
	switch byteCount := m["report_content_byte_count"].(type) {
	case int64:
		report.ReportContentByteCount = byteCount
	case int:
		report.ReportContentByteCount = int64(byteCount)
	case float64:
		report.ReportContentByteCount = int64(byteCount)
	}
	if generatedAt, ok := m["generated_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(generatedAt); ok {
			report.GeneratedAt = parsed
		}
	}
	if checksumSHA256, ok := m["checksum_sha256"].(string); ok {
		report.ChecksumSHA256 = checksumSHA256
	}
	if storagePath, ok := m["storage_path"].(string); ok {
		report.StoragePath = storagePath
	}
	if storageSchemaVersion, ok := m["storage_schema_version"].(string); ok {
		report.StorageSchemaVersion = storageSchemaVersion
	}
	report.MetadataJSON = mapJSONBToString(m["metadata_json"])
	if source, ok := m["source"].(string); ok {
		report.Source = source
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(createdAt); ok {
			report.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(updatedAt); ok {
			report.UpdatedAt = parsed
		}
	}
	return report
}

func mapToEnterpriseAuditExportWorkerExecutionRequest(m map[string]interface{}) model.EnterpriseAuditExportWorkerExecutionRequest {
	request := model.EnterpriseAuditExportWorkerExecutionRequest{}
	if id, ok := m["id"].(string); ok {
		request.ID = id
	}
	if idempotencyKey, ok := m["idempotency_key"].(string); ok {
		request.IdempotencyKey = idempotencyKey
	}
	if taskID, ok := m["task_id"].(string); ok {
		request.TaskID = taskID
	}
	if requestedByAdminID, ok := m["requested_by_admin_id"].(string); ok {
		request.RequestedByAdminID = requestedByAdminID
	}
	if status, ok := m["status"].(string); ok {
		request.Status = status
	}
	if reason, ok := m["reason"].(string); ok {
		request.Reason = reason
	}
	switch batchLimit := m["batch_limit"].(type) {
	case int:
		request.BatchLimit = batchLimit
	case int64:
		request.BatchLimit = int(batchLimit)
	case float64:
		request.BatchLimit = int(batchLimit)
	}
	if requestSchemaVersion, ok := m["request_schema_version"].(string); ok {
		request.RequestSchemaVersion = requestSchemaVersion
	}
	if workerReadinessStatus, ok := m["worker_readiness_status"].(string); ok {
		request.WorkerReadinessStatus = workerReadinessStatus
	}
	if statusTransitionReadinessStatus, ok := m["status_transition_readiness_status"].(string); ok {
		request.StatusTransitionReadinessStatus = statusTransitionReadinessStatus
	}
	if taskReadbackStatus, ok := m["task_readback_status"].(string); ok {
		request.TaskReadbackStatus = taskReadbackStatus
	}
	switch queuedTaskCount := m["queued_task_count"].(type) {
	case int:
		request.QueuedTaskCount = queuedTaskCount
	case int64:
		request.QueuedTaskCount = int(queuedTaskCount)
	case float64:
		request.QueuedTaskCount = int(queuedTaskCount)
	}
	request.RequestPayloadSnapshot = mapJSONBToString(m["request_payload_snapshot"])
	request.ReadinessSnapshot = mapJSONBToString(m["readiness_snapshot"])
	request.ExecutionResult = mapJSONBToString(m["execution_result"])
	if outputPath, ok := m["output_path"].(string); ok {
		request.OutputPath = outputPath
	}
	if checksumSHA256, ok := m["checksum_sha256"].(string); ok {
		request.ChecksumSHA256 = checksumSHA256
	}
	switch rowCount := m["row_count"].(type) {
	case int64:
		request.RowCount = rowCount
	case int:
		request.RowCount = int64(rowCount)
	case float64:
		request.RowCount = int64(rowCount)
	}
	if errorMessage, ok := m["error_message"].(string); ok {
		request.ErrorMessage = errorMessage
	}
	if source, ok := m["source"].(string); ok {
		request.Source = source
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(createdAt); ok {
			request.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, ok := parseSupabaseTime(updatedAt); ok {
			request.UpdatedAt = parsed
		}
	}
	return request
}

func (r *AdminRepository) CreateEnterpriseAuditExportWorkerExecutionRequest(ctx context.Context, request *model.EnterpriseAuditExportWorkerExecutionRequest) error {
	now := time.Now().Format(time.RFC3339)
	data := map[string]interface{}{
		"id":                                 request.ID,
		"idempotency_key":                    request.IdempotencyKey,
		"task_id":                            request.TaskID,
		"requested_by_admin_id":              request.RequestedByAdminID,
		"status":                             request.Status,
		"reason":                             request.Reason,
		"batch_limit":                        request.BatchLimit,
		"request_schema_version":             request.RequestSchemaVersion,
		"worker_readiness_status":            request.WorkerReadinessStatus,
		"status_transition_readiness_status": request.StatusTransitionReadinessStatus,
		"task_readback_status":               request.TaskReadbackStatus,
		"queued_task_count":                  request.QueuedTaskCount,
		"request_payload_snapshot":           json.RawMessage(request.RequestPayloadSnapshot),
		"readiness_snapshot":                 json.RawMessage(request.ReadinessSnapshot),
		"execution_result":                   json.RawMessage(request.ExecutionResult),
		"output_path":                        request.OutputPath,
		"checksum_sha256":                    request.ChecksumSHA256,
		"row_count":                          request.RowCount,
		"error_message":                      request.ErrorMessage,
		"source":                             request.Source,
		"created_at":                         now,
		"updated_at":                         now,
	}
	result, err := r.supabase.AdminTable("enterprise_audit_export_worker_execution_requests").Insert(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseAuditExportWorkerExecutionRequest(m)
		*request = mapped
	}
	return nil
}

func (r *AdminRepository) UpdateEnterpriseAuditExportWorkerExecutionRequestExecutionResult(ctx context.Context, request *model.EnterpriseAuditExportWorkerExecutionRequest) error {
	data := map[string]interface{}{
		"status":           request.Status,
		"execution_result": json.RawMessage(request.ExecutionResult),
		"output_path":      request.OutputPath,
		"checksum_sha256":  request.ChecksumSHA256,
		"row_count":        request.RowCount,
		"error_message":    request.ErrorMessage,
		"source":           request.Source,
		"updated_at":       time.Now().Format(time.RFC3339),
	}
	result, err := r.supabase.AdminTable("enterprise_audit_export_worker_execution_requests").Eq("id", request.ID).Update(data)
	if err != nil {
		return err
	}
	if m, ok := firstDataMap(result.Data); ok {
		mapped := mapToEnterpriseAuditExportWorkerExecutionRequest(m)
		*request = mapped
		return nil
	}
	updatedRequest, err := r.FindEnterpriseAuditExportWorkerExecutionRequestByID(ctx, request.ID)
	if err != nil {
		return err
	}
	if updatedRequest != nil {
		*request = *updatedRequest
	}
	return nil
}

func mapToAdminPermission(m map[string]interface{}) model.AdminPermission {
	permission := model.AdminPermission{}
	if id, ok := m["id"].(string); ok {
		permission.ID = id
	}
	if code, ok := m["code"].(string); ok {
		permission.Code = code
	}
	if name, ok := m["name"].(string); ok {
		permission.Name = name
	}
	if description, ok := m["description"].(string); ok {
		permission.Description = description
	}
	if createdAt, ok := m["created_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, createdAt); err == nil {
			permission.CreatedAt = parsed
		}
	}
	if updatedAt, ok := m["updated_at"].(string); ok {
		if parsed, err := time.Parse(time.RFC3339, updatedAt); err == nil {
			permission.UpdatedAt = parsed
		}
	}
	return permission
}
