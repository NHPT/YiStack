package service

import (
	"context"
	"errors"
	"testing"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/llm"
)

type providerManagerServiceRepoStub struct {
	providers         []model.LLMProvider
	models            []model.LLMProviderModel
	useCountByID      map[int64]int
	lastUseProviderID int64
	setDefaultErr     error
}

func (r *providerManagerServiceRepoStub) Create(ctx context.Context, provider *model.LLMProvider) error {
	r.providers = append(r.providers, *provider)
	return nil
}

func (r *providerManagerServiceRepoStub) CreateModel(ctx context.Context, providerModel *model.LLMProviderModel) error {
	r.models = append(r.models, *providerModel)
	return nil
}

func (r *providerManagerServiceRepoStub) FindByID(ctx context.Context, id int64) (*model.LLMProvider, error) {
	for _, provider := range r.providers {
		if provider.ID == id {
			return &provider, nil
		}
	}
	return nil, nil
}

func (r *providerManagerServiceRepoStub) FindByName(ctx context.Context, name string) (*model.LLMProvider, error) {
	for _, provider := range r.providers {
		if provider.Name == name {
			return &provider, nil
		}
	}
	return nil, nil
}

func (r *providerManagerServiceRepoStub) ListAll(ctx context.Context) ([]model.LLMProvider, error) {
	return r.providers, nil
}

func (r *providerManagerServiceRepoStub) ListEnabled(ctx context.Context) ([]model.LLMProvider, error) {
	enabled := []model.LLMProvider{}
	for _, provider := range r.providers {
		if provider.Enabled == true {
			enabled = append(enabled, provider)
		}
	}
	return enabled, nil
}

func (r *providerManagerServiceRepoStub) ListModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error) {
	models := []model.LLMProviderModel{}
	for _, item := range r.models {
		if item.ProviderID == providerID {
			models = append(models, item)
		}
	}
	return models, nil
}

func (r *providerManagerServiceRepoStub) ListEnabledModelsByProviderID(ctx context.Context, providerID int64) ([]model.LLMProviderModel, error) {
	models := []model.LLMProviderModel{}
	for _, item := range r.models {
		if item.ProviderID == providerID && item.Enabled == true {
			models = append(models, item)
		}
	}
	return models, nil
}

func (r *providerManagerServiceRepoStub) GetDefault(ctx context.Context) (*model.LLMProvider, error) {
	for _, provider := range r.providers {
		if provider.IsDefault == true {
			return &provider, nil
		}
	}
	return nil, nil
}

func (r *providerManagerServiceRepoStub) Update(ctx context.Context, provider *model.LLMProvider) error {
	for index := range r.providers {
		if r.providers[index].ID == provider.ID {
			isDefault := r.providers[index].IsDefault
			r.providers[index] = *provider
			r.providers[index].IsDefault = isDefault
			return nil
		}
	}
	r.providers = append(r.providers, *provider)
	return nil
}

func (r *providerManagerServiceRepoStub) UpsertModel(ctx context.Context, providerModel *model.LLMProviderModel) error {
	for index := range r.models {
		if r.models[index].ProviderID == providerModel.ProviderID && r.models[index].ModelID == providerModel.ModelID {
			r.models[index] = *providerModel
			return nil
		}
	}
	r.models = append(r.models, *providerModel)
	return nil
}

func (r *providerManagerServiceRepoStub) ReplaceProviderModels(ctx context.Context, providerID int64, models []model.LLMProviderModel) error {
	remaining := []model.LLMProviderModel{}
	for _, item := range r.models {
		if item.ProviderID != providerID {
			remaining = append(remaining, item)
		}
	}
	for _, item := range models {
		item.ProviderID = providerID
		remaining = append(remaining, item)
	}
	r.models = remaining
	return nil
}

func (r *providerManagerServiceRepoStub) Delete(ctx context.Context, id int64) error {
	filtered := []model.LLMProvider{}
	for _, provider := range r.providers {
		if provider.ID != id {
			filtered = append(filtered, provider)
		}
	}
	r.providers = filtered
	return nil
}

func (r *providerManagerServiceRepoStub) DeleteModel(ctx context.Context, providerID int64, modelID string) error {
	filtered := []model.LLMProviderModel{}
	for _, item := range r.models {
		if item.ProviderID == providerID && item.ModelID == modelID {
			continue
		}
		filtered = append(filtered, item)
	}
	r.models = filtered
	return nil
}

func (r *providerManagerServiceRepoStub) SetDefault(ctx context.Context, id int64) error {
	if r.setDefaultErr != nil {
		return r.setDefaultErr
	}
	for index := range r.providers {
		r.providers[index].IsDefault = r.providers[index].ID == id
	}
	return nil
}

func (r *providerManagerServiceRepoStub) SetDefaultModel(ctx context.Context, providerID int64, modelID string) error {
	for index := range r.models {
		if r.models[index].ProviderID == providerID {
			r.models[index].IsDefault = r.models[index].ModelID == modelID
		}
	}
	return nil
}

func (r *providerManagerServiceRepoStub) IncrementUseCount(ctx context.Context, id int64) error {
	if r.useCountByID == nil {
		r.useCountByID = map[int64]int{}
	}
	r.useCountByID[id]++
	r.lastUseProviderID = id
	return nil
}

func (r *providerManagerServiceRepoStub) InitDefaults(ctx context.Context) error {
	return nil
}

func (r *providerManagerServiceRepoStub) ListDBProviders(ctx context.Context) ([]llm.DBProviderRecord, error) {
	records := []llm.DBProviderRecord{}
	for _, provider := range r.providers {
		if provider.Enabled == false {
			continue
		}
		models, _ := r.ListEnabledModelsByProviderID(ctx, provider.ID)
		if len(models) == 0 {
			models = []model.LLMProviderModel{{ProviderID: provider.ID, ModelID: provider.Model, Enabled: true, IsDefault: true}}
		}
		for _, item := range models {
			records = append(records, llm.DBProviderRecord{
				Name:         provider.Name + "::" + item.ModelID,
				ProviderID:   provider.ID,
				ProviderName: provider.Name,
				DisplayName:  provider.DisplayName + " / " + item.ModelID,
				APIKey:       provider.APIKey,
				BaseURL:      provider.BaseURL,
				Model:        item.ModelID,
				IsDefault:    provider.IsDefault && item.IsDefault,
				Type:         provider.Type,
			})
		}
	}
	return records, nil
}

func (r *providerManagerServiceRepoStub) ListAllSafe(ctx context.Context) ([]model.LLMProvider, error) {
	return r.providers, nil
}

func TestLLMProviderAdminServiceUpdateProviderPersistsType(t *testing.T) {
	repo := &providerManagerServiceRepoStub{
		providers: []model.LLMProvider{{
			ID:          10,
			Name:        "ollama-cloud",
			DisplayName: "Ollama (云端部署)",
			Type:        "local",
			BaseURL:     "https://ollama.com",
			Model:       "llama3.2",
		}},
	}
	service := NewLLMProviderAdminService(repo, nil)
	updatedType := "cloud"

	updatedProvider, err := service.UpdateProvider(context.Background(), 10, &LLMProviderUpdateRequest{
		Type: &updatedType,
	})
	if err != nil {
		t.Fatalf("expected provider update to succeed, got %v", err)
	}
	if updatedProvider.Type != "cloud" {
		t.Fatalf("expected response type cloud, got %q", updatedProvider.Type)
	}
	if repo.providers[0].Type != "cloud" {
		t.Fatalf("expected persisted type cloud, got %q", repo.providers[0].Type)
	}
}

func TestLLMProviderAdminServiceUpdateProviderRejectsDisabledDefault(t *testing.T) {
	repo := &providerManagerServiceRepoStub{
		providers: []model.LLMProvider{{
			ID:        10,
			Name:      "disabled-provider",
			BaseURL:   "https://example.test",
			Enabled:   false,
			IsDefault: false,
		}},
	}
	service := NewLLMProviderAdminService(repo, nil)
	isDefault := true

	if _, err := service.UpdateProvider(context.Background(), 10, &LLMProviderUpdateRequest{
		IsDefault: &isDefault,
	}); err == nil || err.Error() != "cannot set disabled provider as default" {
		t.Fatalf("expected disabled default validation error, got %v", err)
	}
	if repo.providers[0].IsDefault {
		t.Fatal("disabled provider must not become the default")
	}
}

func TestLLMProviderAdminServiceCreateProviderRejectsDisabledDefault(t *testing.T) {
	repo := &providerManagerServiceRepoStub{}
	service := NewLLMProviderAdminService(repo, nil)

	if _, err := service.CreateProvider(context.Background(), &LLMProviderCreateRequest{
		Name:      "disabled-provider",
		BaseURL:   "https://example.test",
		Enabled:   false,
		IsDefault: true,
	}); err == nil || err.Error() != "cannot set disabled provider as default" {
		t.Fatalf("expected disabled default validation error, got %v", err)
	}
	if len(repo.providers) != 0 {
		t.Fatalf("disabled default provider must not be created, got %#v", repo.providers)
	}
}

func TestLLMProviderAdminServiceCreateProviderCleansUpDefaultFailure(t *testing.T) {
	repo := &providerManagerServiceRepoStub{
		setDefaultErr: errors.New("set default failed"),
	}
	service := NewLLMProviderAdminService(repo, nil)

	if _, err := service.CreateProvider(context.Background(), &LLMProviderCreateRequest{
		Name:      "default-provider",
		BaseURL:   "https://example.test",
		Enabled:   true,
		IsDefault: true,
	}); !errors.Is(err, repo.setDefaultErr) {
		t.Fatalf("expected default switch error, got %v", err)
	}
	if len(repo.providers) != 0 {
		t.Fatalf("failed default provider must be removed, got %#v", repo.providers)
	}
}

func TestLLMProviderAdminServiceUpdateProviderRejectsDisablingDefault(t *testing.T) {
	repo := &providerManagerServiceRepoStub{
		providers: []model.LLMProvider{{
			ID:        10,
			Name:      "default-provider",
			BaseURL:   "https://example.test",
			Enabled:   true,
			IsDefault: true,
		}},
	}
	service := NewLLMProviderAdminService(repo, nil)
	enabled := false

	if _, err := service.UpdateProvider(context.Background(), 10, &LLMProviderUpdateRequest{
		Enabled: &enabled,
	}); err == nil || err.Error() != "cannot disable default provider" {
		t.Fatalf("expected default provider disable validation error, got %v", err)
	}
	if !repo.providers[0].Enabled || !repo.providers[0].IsDefault {
		t.Fatalf("default provider state must remain unchanged, got %#v", repo.providers[0])
	}
}

func TestLLMProviderAdminServiceUpdateProviderCanEnableDefault(t *testing.T) {
	repo := &providerManagerServiceRepoStub{
		providers: []model.LLMProvider{{
			ID:        10,
			Name:      "disabled-provider",
			BaseURL:   "https://example.test",
			Enabled:   false,
			IsDefault: false,
		}},
	}
	service := NewLLMProviderAdminService(repo, nil)
	enabled := true
	isDefault := true

	provider, err := service.UpdateProvider(context.Background(), 10, &LLMProviderUpdateRequest{
		Enabled:   &enabled,
		IsDefault: &isDefault,
	})
	if err != nil {
		t.Fatalf("expected enabled provider to become default, got %v", err)
	}
	if !provider.Enabled || !provider.IsDefault {
		t.Fatalf("expected enabled default provider, got %#v", provider)
	}
	if !repo.providers[0].Enabled || !repo.providers[0].IsDefault {
		t.Fatalf("expected enabled default provider to persist, got %#v", repo.providers[0])
	}
}

func TestProviderManagerServiceReloadKeepsExplicitDeterministicProvider(t *testing.T) {
	manager := llm.NewProviderManager()
	repo := &providerManagerServiceRepoStub{
		providers: []model.LLMProvider{{
			ID:        1,
			Name:      "doubao",
			BaseURL:   "https://example.test/api",
			Model:     "doubao-test",
			APIKey:    "invalid",
			Enabled:   true,
			IsDefault: true,
			Type:      "cloud",
		}},
	}
	service := NewProviderManagerService(manager, repo, &config.LLMConfig{
		ActiveProvider:       "deterministic",
		DeterministicEnabled: true,
		MaxTokens:            4096,
		Timeout:              120,
	})

	if err := service.Reload(context.Background()); err != nil {
		t.Fatalf("expected reload to succeed, got %v", err)
	}

	providers := manager.ListProviders()
	want := []string{"doubao::doubao-test", "deterministic"}
	if len(providers) != len(want) {
		t.Fatalf("expected providers %#v, got %#v", want, providers)
	}
	for index, provider := range providers {
		if provider != want[index] {
			t.Fatalf("expected providers %#v, got %#v", want, providers)
		}
	}
	if manager.GetCurrentName() != "deterministic" {
		t.Fatalf("expected deterministic current provider, got %q", manager.GetCurrentName())
	}
}

func TestProviderManagerServiceReloadExpandsProviderModels(t *testing.T) {
	manager := llm.NewProviderManager()
	repo := &providerManagerServiceRepoStub{
		providers: []model.LLMProvider{{
			ID:        1,
			Name:      "ollama",
			BaseURL:   "http://localhost:11434",
			Model:     "llama3.1",
			Enabled:   true,
			IsDefault: true,
			Type:      "local",
		}},
		models: []model.LLMProviderModel{{
			ProviderID: 1,
			ModelID:    "llama3.1",
			Enabled:    true,
			IsDefault:  true,
		}, {
			ProviderID: 1,
			ModelID:    "qwen2.5-coder",
			Enabled:    true,
		}},
	}
	service := NewProviderManagerService(manager, repo)

	if err := service.Reload(context.Background()); err != nil {
		t.Fatalf("expected reload to succeed, got %v", err)
	}

	providers := manager.ListProviders()
	want := []string{"ollama::llama3.1", "ollama::qwen2.5-coder"}
	if len(providers) != len(want) {
		t.Fatalf("expected providers %#v, got %#v", want, providers)
	}
	for index, provider := range providers {
		if provider != want[index] {
			t.Fatalf("expected providers %#v, got %#v", want, providers)
		}
	}
	if manager.GetCurrentName() != "ollama::llama3.1" {
		t.Fatalf("expected default model provider, got %q", manager.GetCurrentName())
	}
	config := manager.GetConfig("ollama::qwen2.5-coder")
	if config == nil || config.Model != "qwen2.5-coder" {
		t.Fatalf("expected qwen2.5-coder config, got %#v", config)
	}
}

func TestProviderManagerServiceRecordProviderUseUsesRuntimeProviderID(t *testing.T) {
	manager := llm.NewProviderManager()
	repo := &providerManagerServiceRepoStub{}
	manager.RegisterProvider("ollama::llama3.1", llm.NewDeterministicProvider(), &llm.ProviderConfig{
		ProviderID: 42,
		Model:      "llama3.1",
	})
	service := NewProviderManagerService(manager, repo)

	if err := service.RecordProviderUse(context.Background(), "ollama::llama3.1"); err != nil {
		t.Fatalf("expected provider use to be recorded, got %v", err)
	}

	if repo.useCountByID[42] != 1 {
		t.Fatalf("expected provider id 42 use count to increment, got %#v", repo.useCountByID)
	}
	if repo.lastUseProviderID != 42 {
		t.Fatalf("expected last used provider id 42, got %d", repo.lastUseProviderID)
	}
}
