// Package llm LLM 服务集成
package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	defaultLLMRequestMaxAttempts = 8
	defaultLLMRetryBaseDelay     = 500 * time.Millisecond
	defaultLLMRetryMaxDelay      = 4 * time.Second
)

// DBProviderRecord 数据库中的 LLM 提供商记录（避免循环依赖 internal/model）
type DBProviderRecord struct {
	Name           string
	ProviderID     int64
	ProviderName   string
	DisplayName    string
	APIKey         string
	BaseURL        string
	Model          string
	IsDefault      bool
	Type           string // cloud 或 local
	CapabilityTags string
}

// DBProviderRepo 数据库提供商仓储接口（避免循环依赖）
type DBProviderRepo interface {
	ListDBProviders(ctx context.Context) ([]DBProviderRecord, error)
}

// ProviderInfo 提供商详细信息（用于 API 返回）
type ProviderInfo struct {
	Name           string `json:"name"`
	DisplayName    string `json:"display_name"`
	Type           string `json:"type"`
	Model          string `json:"model"`
	CapabilityTags string `json:"capability_tags,omitempty"`
	IsDefault      bool   `json:"is_default"`
	Enabled        bool   `json:"enabled"`
}

// MessageImageURL describes an OpenAI-compatible image input.
type MessageImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail,omitempty"`
}

// MessageContentPart is one text or image segment in a multimodal message.
type MessageContentPart struct {
	Type     string           `json:"type"`
	Text     string           `json:"text,omitempty"`
	ImageURL *MessageImageURL `json:"image_url,omitempty"`
}

// Message 聊天消息
type Message struct {
	Role    string               `json:"role"`
	Content string               `json:"-"`
	Parts   []MessageContentPart `json:"-"`
}

func (m Message) MarshalJSON() ([]byte, error) {
	content := any(m.Content)
	if len(m.Parts) > 0 {
		content = m.Parts
	}
	return json.Marshal(struct {
		Role    string `json:"role"`
		Content any    `json:"content"`
	}{
		Role:    m.Role,
		Content: content,
	})
}

func (m *Message) UnmarshalJSON(data []byte) error {
	var wire struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	m.Role = wire.Role
	m.Content = ""
	m.Parts = nil
	if len(wire.Content) == 0 || string(wire.Content) == "null" {
		return nil
	}
	if err := json.Unmarshal(wire.Content, &m.Content); err == nil {
		return nil
	}
	if err := json.Unmarshal(wire.Content, &m.Parts); err != nil {
		return err
	}
	var text strings.Builder
	for _, part := range m.Parts {
		if part.Type == "text" {
			text.WriteString(part.Text)
		}
	}
	m.Content = text.String()
	return nil
}

// ChatRequest 聊天请求
type ChatRequest struct {
	Model           string              `json:"model"`
	Temperature     float64             `json:"temperature"`
	MaxTokens       int                 `json:"max_tokens,omitempty"`
	ReasoningEffort string              `json:"reasoning_effort,omitempty"`
	Messages        []Message           `json:"messages"`
	Stream          bool                `json:"stream"`
	ResponseFormat  *ChatResponseFormat `json:"response_format,omitempty"`
}

// ChatResponseFormat 描述 OpenAI-compatible 结构化响应请求。
type ChatResponseFormat struct {
	Type       string                  `json:"type"`
	JSONSchema *ChatResponseJSONSchema `json:"json_schema,omitempty"`
}

// ChatResponseJSONSchema 承载命名 strict JSON Schema 契约。
type ChatResponseJSONSchema struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

// ChatResponse 聊天响应
type ChatResponse struct {
	ID      string   `json:"id"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

// Choice 选择
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

// Usage 使用量
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// StreamChunk 流式输出块
type StreamChunk struct {
	ID      string         `json:"id"`
	Model   string         `json:"model"`
	Choices []StreamChoice `json:"choices"`
}

// StreamChoice 流式选择
type StreamChoice struct {
	Index        int                    `json:"index"`
	Delta        map[string]interface{} `json:"delta"`
	FinishReason string                 `json:"finish_reason,omitempty"`
}

// Client LLM 客户端
type Client struct {
	baseURL        string
	apiKey         string
	httpClient     *http.Client
	timeout        time.Duration
	maxAttempts    int
	retryBaseDelay time.Duration
}

// NewClient 创建 LLM 客户端
func NewClient(baseURL, apiKey string, timeout time.Duration) *Client {
	if timeout == 0 {
		timeout = 120 * time.Second
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = timeout

	return &Client{
		baseURL:        strings.TrimSuffix(baseURL, "/"),
		apiKey:         apiKey,
		httpClient:     &http.Client{Transport: transport},
		timeout:        timeout,
		maxAttempts:    defaultLLMRequestMaxAttempts,
		retryBaseDelay: defaultLLMRetryBaseDelay,
	}
}

func (c *Client) newChatHTTPRequest(ctx context.Context, jsonData []byte) (*http.Request, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/chat/completions", strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	return httpReq, nil
}

func retryableLLMStatus(statusCode int) bool {
	return statusCode == http.StatusRequestTimeout ||
		statusCode == http.StatusTooEarly ||
		statusCode == http.StatusTooManyRequests ||
		(statusCode >= http.StatusInternalServerError && statusCode <= 599)
}

func retryableLLMRequestError(ctx context.Context, err error) bool {
	if err == nil || ctx.Err() != nil ||
		errors.Is(err, context.Canceled) ||
		errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	var networkError net.Error
	return errors.As(err, &networkError)
}

func waitForLLMRetry(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (c *Client) doChatHTTPRequest(ctx context.Context, jsonData []byte) (*http.Response, error) {
	maxAttempts := c.maxAttempts
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	retryBaseDelay := c.retryBaseDelay
	if retryBaseDelay <= 0 {
		retryBaseDelay = defaultLLMRetryBaseDelay
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		httpReq, err := c.newChatHTTPRequest(ctx, jsonData)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		resp, err := c.httpClient.Do(httpReq)
		if err == nil && (!retryableLLMStatus(resp.StatusCode) || attempt == maxAttempts) {
			return resp, nil
		}
		if err != nil && (!retryableLLMRequestError(ctx, err) || attempt == maxAttempts) {
			return nil, fmt.Errorf("failed to send request: %w", err)
		}

		delay := retryBaseDelay * time.Duration(1<<(attempt-1))
		if delay > defaultLLMRetryMaxDelay {
			delay = defaultLLMRetryMaxDelay
		}
		if resp != nil {
			_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64*1024))
			_ = resp.Body.Close()
			log.Printf("[LLM] request returned retryable status %d on attempt %d/%d; retrying in %s", resp.StatusCode, attempt, maxAttempts, delay)
		} else {
			log.Printf("[LLM] request failed transiently on attempt %d/%d: %v; retrying in %s", attempt, maxAttempts, err, delay)
		}
		if err := waitForLLMRetry(ctx, delay); err != nil {
			return nil, fmt.Errorf("failed to send request: %w", err)
		}
	}

	return nil, errors.New("failed to send request: exhausted all attempts")
}

// Chat 聊天（同步）
func (c *Client) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	resp, err := c.doChatHTTPRequest(requestCtx, jsonData)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &chatResp, nil
}

// StreamChunkHandler 流式输出处理函数
type StreamChunkHandler func(chunk *StreamChunk) error

type llmStreamReadResult struct {
	count int
	err   error
}

func readLLMStreamChunk(
	ctx context.Context,
	body io.ReadCloser,
	buffer []byte,
	idleTimeout time.Duration,
) (int, error) {
	if idleTimeout <= 0 {
		return body.Read(buffer)
	}

	resultCh := make(chan llmStreamReadResult, 1)
	go func() {
		count, err := body.Read(buffer)
		resultCh <- llmStreamReadResult{count: count, err: err}
	}()

	timer := time.NewTimer(idleTimeout)
	defer timer.Stop()
	select {
	case result := <-resultCh:
		return result.count, result.err
	case <-ctx.Done():
		_ = body.Close()
		return 0, ctx.Err()
	case <-timer.C:
		_ = body.Close()
		return 0, fmt.Errorf("stream idle timeout after %s", idleTimeout)
	}
}

// StreamChat 聊天（流式）
func (c *Client) StreamChat(ctx context.Context, req *ChatRequest, handler StreamChunkHandler) error {
	if ctx == nil {
		ctx = context.Background()
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.doChatHTTPRequest(ctx, jsonData)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	buffer := make([]byte, 0, 4096)

	for {
		buf := make([]byte, 1024)
		n, err := readLLMStreamChunk(ctx, resp.Body, buf, c.timeout)
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("failed to read stream: %w", err)
		}

		buffer = append(buffer, buf[:n]...)
		content := string(buffer)

		lines := strings.Split(content, "\n")
		for _, line := range lines[:len(lines)-1] {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "data:") {
				data := strings.TrimPrefix(line, "data:")
				data = strings.TrimSpace(data)

				if data == "[DONE]" {
					return nil
				}

				var chunk StreamChunk
				if err := json.Unmarshal([]byte(data), &chunk); err != nil {
					continue
				}

				if handler != nil {
					if err := handler(&chunk); err != nil {
						return err
					}
				}
			}
		}

		if len(lines) > 0 {
			buffer = []byte(lines[len(lines)-1])
		}
	}

	return nil
}

// LLMProvider LLM 提供商接口
type LLMProvider interface {
	// Chat 同步聊天
	Chat(ctx context.Context, messages []Message, opts ...Option) (*ChatResponse, error)

	// StreamChat 流式聊天
	StreamChat(ctx context.Context, messages []Message, handler StreamChunkHandler, opts ...Option) error
}

// Option 配置选项
type Option func(*ChatRequest)

func WithModel(model string) Option {
	return func(req *ChatRequest) {
		req.Model = model
	}
}

func WithTemperature(temp float64) Option {
	return func(req *ChatRequest) {
		req.Temperature = temp
	}
}

func WithMaxTokens(maxTokens int) Option {
	return func(req *ChatRequest) {
		req.MaxTokens = maxTokens
	}
}

func WithReasoningEffort(reasoningEffort string) Option {
	return func(req *ChatRequest) {
		req.ReasoningEffort = reasoningEffort
	}
}

func WithStream(stream bool) Option {
	return func(req *ChatRequest) {
		req.Stream = stream
	}
}

func WithResponseFormat(responseFormat *ChatResponseFormat) Option {
	return func(req *ChatRequest) {
		req.ResponseFormat = responseFormat
	}
}

// DefaultProvider 默认 LLM 提供商
type DefaultProvider struct {
	client *Client
	mu     sync.RWMutex
}

func NewDefaultProvider(baseURL, apiKey string, timeout time.Duration) *DefaultProvider {
	return &DefaultProvider{
		client: NewClient(baseURL, apiKey, timeout),
	}
}

func (p *DefaultProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*ChatResponse, error) {
	req := &ChatRequest{
		Model:       "doubao-seed-2.0-lite-260215",
		Temperature: 0.7,
		Stream:      false,
		Messages:    messages,
	}

	for _, opt := range opts {
		opt(req)
	}

	return p.client.Chat(ctx, req)
}

func (p *DefaultProvider) StreamChat(ctx context.Context, messages []Message, handler StreamChunkHandler, opts ...Option) error {
	req := &ChatRequest{
		Model:       "doubao-seed-2.0-lite-260215",
		Temperature: 0.7,
		Stream:      true,
		Messages:    messages,
	}

	for _, opt := range opts {
		opt(req)
	}

	return p.client.StreamChat(ctx, req, handler)
}

// ProviderManager LLM 提供商管理器
type ProviderManager struct {
	providers map[string]LLMProvider
	configs   map[string]*ProviderConfig
	order     []string
	current   string
	mu        sync.RWMutex
}

// ProviderConfig 提供商配置
type ProviderConfig struct {
	ProviderID     int64
	BaseURL        string
	APIKey         string
	Model          string
	DisplayName    string
	ProviderName   string
	Type           string // cloud 或 local
	CapabilityTags string
	Temperature    float64
	MaxTokens      int
	Timeout        int
}

// NewProviderManager 创建提供商管理器
func NewProviderManager() *ProviderManager {
	return &ProviderManager{
		providers: make(map[string]LLMProvider),
		configs:   make(map[string]*ProviderConfig),
		order:     []string{},
	}
}

// RegisterProvider 注册提供商
func (m *ProviderManager) RegisterProvider(name string, provider LLMProvider, config *ProviderConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.providers[name]; !exists {
		m.order = append(m.order, name)
	}
	m.providers[name] = provider
	m.configs[name] = config
}

// SetCurrent 设置当前提供商
func (m *ProviderManager) SetCurrent(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.providers[name]; !ok {
		return fmt.Errorf("provider %s not found", name)
	}
	m.current = name
	return nil
}

// GetCurrent 获取当前提供商
func (m *ProviderManager) GetCurrent() LLMProvider {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.providers[m.current]
}

// GetProvider 获取指定提供商
func (m *ProviderManager) GetProvider(name string) (LLMProvider, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	provider, ok := m.providers[name]
	if !ok {
		return nil, fmt.Errorf("provider %s not found", name)
	}
	return provider, nil
}

func (m *ProviderManager) getProviderSnapshot(name string) (LLMProvider, *ProviderConfig, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	provider, ok := m.providers[name]
	if !ok {
		return nil, nil, fmt.Errorf("provider %s not found", name)
	}
	config := m.configs[name]
	var configCopy *ProviderConfig
	if config != nil {
		copied := *config
		configCopy = &copied
	}
	return provider, configCopy, nil
}

// ListProviders 列出所有提供商
func (m *ProviderManager) ListProviders() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	names := make([]string, 0, len(m.order))
	for _, name := range m.order {
		if _, ok := m.providers[name]; ok {
			names = append(names, name)
		}
	}
	return names
}

// ListProvidersDetailed 列出所有提供商的详细信息
func (m *ProviderManager) ListProvidersDetailed() []ProviderInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]ProviderInfo, 0, len(m.providers))
	for name, cfg := range m.configs {
		infos = append(infos, ProviderInfo{
			Name:           name,
			DisplayName:    cfg.DisplayName,
			Type:           cfg.Type,
			Model:          cfg.Model,
			CapabilityTags: cfg.CapabilityTags,
			IsDefault:      m.current == name,
			Enabled:        true,
		})
	}
	return infos
}

// GetConfig 获取提供商配置
func (m *ProviderManager) GetConfig(name string) *ProviderConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()

	config := m.configs[name]
	if config == nil {
		return nil
	}
	copied := *config
	return &copied
}

// SupportsCapability 判断指定运行时模型是否声明了目标能力。
func (m *ProviderManager) SupportsCapability(name, capability string) bool {
	config := m.GetConfig(strings.TrimSpace(name))
	if config == nil {
		return false
	}
	target := strings.ToLower(strings.TrimSpace(capability))
	if target == "" {
		return false
	}
	for _, tag := range strings.Split(config.CapabilityTags, ",") {
		if strings.ToLower(strings.TrimSpace(tag)) == target {
			return true
		}
	}
	return false
}

// UnregisterProvider 移除提供商
func (m *ProviderManager) UnregisterProvider(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.providers, name)
	delete(m.configs, name)
	m.order = removeProviderOrderName(m.order, name)
	if m.current == name {
		m.current = ""
		// 切换到第一个可用的
		for _, n := range m.order {
			if _, ok := m.providers[n]; !ok {
				continue
			}
			m.current = n
			break
		}
	}
}

func removeProviderOrderName(order []string, name string) []string {
	result := make([]string, 0, len(order))
	for _, item := range order {
		if item == name {
			continue
		}
		result = append(result, item)
	}
	return result
}

// GetCurrentName 获取当前提供商名称
func (m *ProviderManager) GetCurrentName() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current
}

// Chat 发送聊天请求到当前提供商
func (m *ProviderManager) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	return m.ChatWithProvider(ctx, m.GetCurrentName(), req)
}

// ChatWithProvider 发送聊天请求到指定 provider，不修改全局 current。
func (m *ProviderManager) ChatWithProvider(ctx context.Context, providerName string, req *ChatRequest) (*ChatResponse, error) {
	provider, config, err := m.getProviderSnapshot(providerName)
	if err != nil {
		return nil, err
	}
	messages := make([]Message, len(req.Messages))
	for i, msg := range req.Messages {
		messages[i] = msg
	}

	model := req.Model
	if model == "" {
		if config != nil {
			model = config.Model
		}
	}

	maxTokens := resolveProviderMaxTokens(req.MaxTokens, config)
	return provider.Chat(ctx, messages,
		WithModel(model),
		WithTemperature(req.Temperature),
		WithMaxTokens(maxTokens),
		WithReasoningEffort(req.ReasoningEffort),
		WithResponseFormat(req.ResponseFormat),
	)
}

// StreamChat 流式聊天（通过 ProviderManager 转发）
func (m *ProviderManager) StreamChat(ctx context.Context, req *ChatRequest, handler StreamChunkHandler) error {
	return m.StreamChatWithProvider(ctx, m.GetCurrentName(), req, handler)
}

// StreamChatWithProvider 流式请求指定 provider，不修改全局 current。
func (m *ProviderManager) StreamChatWithProvider(ctx context.Context, providerName string, req *ChatRequest, handler StreamChunkHandler) error {
	provider, config, err := m.getProviderSnapshot(providerName)
	if err != nil {
		return err
	}
	messages := make([]Message, len(req.Messages))
	for i, msg := range req.Messages {
		messages[i] = msg
	}

	model := req.Model
	if model == "" {
		if config != nil {
			model = config.Model
		}
	}

	maxTokens := resolveProviderMaxTokens(req.MaxTokens, config)
	return provider.StreamChat(ctx, messages, handler,
		WithModel(model),
		WithTemperature(req.Temperature),
		WithMaxTokens(maxTokens),
		WithReasoningEffort(req.ReasoningEffort),
		WithResponseFormat(req.ResponseFormat),
	)
}

func resolveProviderMaxTokens(requested int, config *ProviderConfig) int {
	if requested > 0 {
		return requested
	}
	if config != nil && config.MaxTokens > 0 {
		return config.MaxTokens
	}
	return 0
}

// Provider 类型别名（兼容旧代码）
type Provider = *DefaultProvider

// NewOllamaProvider 创建 Ollama 提供商（兼容旧代码）
func NewOllamaProvider(baseURL, model string, temperature float64, maxTokens int) Provider {
	provider := &DefaultProvider{
		client: NewClient(baseURL, "", 120*time.Second),
	}
	// 设置默认模型参数
	provider.mu.Lock()
	// Note: 实际使用需要通过 API 调用设置模型
	provider.mu.Unlock()
	return provider
}

// NewOpenAIProvider 创建 OpenAI 兼容提供商（兼容旧代码）
func NewOpenAIProvider(baseURL, apiKey, model string, temperature float64, maxTokens int) Provider {
	return &DefaultProvider{
		client: NewClient(baseURL, apiKey, 120*time.Second),
	}
}

// LLMProviderDB 数据库中的 LLM 提供商记录接口
type LLMProviderDB interface {
	ListEnabledProviders(ctx context.Context) ([]LLMProviderRecord, error)
}

// LLMProviderRecord 数据库中的 LLM 提供商记录
type LLMProviderRecord struct {
	Name      string
	APIKey    string
	BaseURL   string
	Model     string
	IsDefault bool
	Type      string // cloud 或 local
}

// ReloadFromDB 从数据库重新加载 LLM 提供商配置
func (m *ProviderManager) ReloadFromDB(ctx context.Context, repo DBProviderRepo) error {
	log.Printf("[LLM] 正在从数据库重新加载提供商配置...")

	// 从数据库读取已启用的提供商
	providers, err := repo.ListDBProviders(ctx)
	if err != nil {
		return fmt.Errorf("failed to load providers from DB: %w", err)
	}

	nextProviders := make(map[string]LLMProvider)
	nextConfigs := make(map[string]*ProviderConfig)
	nextOrder := []string{}
	if len(providers) == 0 {
		log.Printf("[LLM] 警告: 数据库中没有已启用的 LLM 提供商")
		m.mu.Lock()
		m.providers = nextProviders
		m.configs = nextConfigs
		m.order = nextOrder
		m.current = ""
		m.mu.Unlock()
		return nil
	}

	var defaultName string
	for _, p := range providers {
		config := &ProviderConfig{
			ProviderID:     p.ProviderID,
			APIKey:         p.APIKey,
			BaseURL:        p.BaseURL,
			Model:          p.Model,
			DisplayName:    p.DisplayName,
			ProviderName:   p.ProviderName,
			Type:           p.Type,
			CapabilityTags: p.CapabilityTags,
			MaxTokens:      4096,
			Temperature:    0.7,
		}

		provider := &DefaultProvider{
			client: NewClient(p.BaseURL, p.APIKey, 120*time.Second),
		}

		nextProviders[p.Name] = provider
		nextConfigs[p.Name] = config
		nextOrder = append(nextOrder, p.Name)

		if p.IsDefault {
			defaultName = p.Name
		}

		log.Printf("[LLM] 已加载提供商: %s (model=%s, base_url=%s, default=%v)",
			p.Name, p.Model, p.BaseURL, p.IsDefault)
	}

	// 设置默认提供商
	nextCurrent := ""
	if defaultName != "" {
		nextCurrent = defaultName
	} else if len(nextProviders) > 0 {
		// 如果没有默认，选第一个
		for name := range nextProviders {
			nextCurrent = name
			break
		}
	}

	m.mu.Lock()
	m.providers = nextProviders
	m.configs = nextConfigs
	m.order = nextOrder
	m.current = nextCurrent
	m.mu.Unlock()

	log.Printf("[LLM] 配置加载完成，当前使用: %s，共 %d 个提供商", nextCurrent, len(nextProviders))
	return nil
}
