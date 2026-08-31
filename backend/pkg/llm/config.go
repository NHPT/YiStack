// Package llm LLM 客户端
// 支持多提供商动态配置，无需硬编码模型名称
package llm

import (
	"sync"
)

// ============================================
// 配置定义
// ============================================

// Config LLM 配置
type Config struct {
	// 当前激活的提供商
	ActiveProvider string `json:"active_provider"`

	// 提供商配置
	Providers map[string]*ProviderSetting `json:"providers"`

	// 默认参数
	DefaultTemperature float64 `json:"default_temperature"`
	DefaultMaxTokens   int     `json:"default_max_tokens"`

	mu sync.RWMutex
}

// ProviderSetting 提供商设置
type ProviderSetting struct {
	Enabled  bool    `json:"enabled"`
	APIKey   string  `json:"api_key"`
	BaseURL  string  `json:"base_url"`
	Model    string  `json:"model"`   // 默认模型（可自定义任意名称）
}

// ============================================
// 默认配置
// ============================================

// DefaultConfig 返回默认配置（不包含硬编码模型列表）
func DefaultConfig() *Config {
	return &Config{
		ActiveProvider:     "doubao",
		DefaultTemperature: 0.7,
		DefaultMaxTokens:   4096,
		Providers: map[string]*ProviderSetting{
			"doubao": {
				Enabled: true,
				APIKey:  "",
				BaseURL: "https://ark.cn-beijing.volces.com/api/v3",
				Model:   "doubao-seed-2.0-lite-260215",
			},
			"openai": {
				Enabled: false,
				APIKey:  "",
				BaseURL: "https://api.openai.com/v1",
				Model:   "gpt-4o",
			},
			"qwen": {
				Enabled: false,
				APIKey:  "",
				BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
				Model:   "qwen-plus",
			},
			"openrouter": {
				Enabled: false,
				APIKey:  "",
				BaseURL: "https://openrouter.ai/api/v1",
				Model:   "anthropic/claude-3.5-sonnet",
			},
			"ollama": {
				Enabled: true,
				APIKey:  "",
				BaseURL: "http://localhost:11434",
				Model:   "llama3.2",
			},
			"kimi": {
				Enabled: false,
				APIKey:  "",
				BaseURL: "https://api.moonshot.cn/v1",
				Model:   "moonshot-v1-8k",
			},
			"deepseek": {
				Enabled: false,
				APIKey:  "",
				BaseURL: "https://api.deepseek.com/v1",
				Model:   "deepseek-chat",
			},
		},
	}
}

// ============================================
// 配置更新（用于热加载）
// ============================================

// UpdateFromEnv 从环境变量更新配置
func (c *Config) UpdateFromEnv(envFunc func(string) string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 更新活跃提供商
	if provider := envFunc("LLM_PROVIDER"); provider != "" {
		c.ActiveProvider = provider
	}

	// 更新默认参数
	if temp := envFunc("LLM_DEFAULT_TEMPERATURE"); temp != "" {
		if f, ok := parseFloat(temp); ok {
			c.DefaultTemperature = f
		}
	}
	if maxTokens := envFunc("LLM_MAX_TOKENS"); maxTokens != "" {
		if i, ok := parseInt(maxTokens); ok {
			c.DefaultMaxTokens = i
		}
	}

	// 更新提供商配置
	providers := []string{"doubao", "openai", "qwen", "openrouter", "ollama", "kimi", "deepseek"}
	for _, p := range providers {
		prefix := getProviderPrefix(p)
		apiKey := envFunc(prefix + "_API_KEY")
		baseURL := envFunc(prefix + "_BASE_URL")
		model := envFunc(prefix + "_MODEL")

		if c.Providers[p] == nil {
			c.Providers[p] = &ProviderSetting{}
		}

		if apiKey != "" {
			c.Providers[p].APIKey = apiKey
		}
		if baseURL != "" {
			c.Providers[p].BaseURL = baseURL
		}
		if model != "" {
			c.Providers[p].Model = model
		}
	}
}

// GetActiveProvider 获取当前激活的提供商配置
func (c *Config) GetActiveProvider() *ProviderSetting {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if p, ok := c.Providers[c.ActiveProvider]; ok {
		return p
	}
	return nil
}

// IsProviderEnabled 检查提供商是否启用
func (c *Config) IsProviderEnabled(name string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if p, ok := c.Providers[name]; ok {
		return p.Enabled && p.APIKey != ""
	}
	return false
}

// ============================================
// 辅助函数
// ============================================

func getProviderPrefix(provider string) string {
	switch provider {
	case "doubao":
		return "DOUBAO"
	case "openai":
		return "OPENAI"
	case "qwen":
		return "QWEN"
	case "openrouter":
		return "OPENROUTER"
	case "ollama":
		return "OLLAMA"
	case "kimi":
		return "KIMI"
	case "deepseek":
		return "DEEPSEEK"
	default:
		return provider
	}
}

func parseFloat(s string) (float64, bool) {
	var f float64
	_, err := parseFloatFmt(s, &f)
	return f, err == nil
}

func parseInt(s string) (int, bool) {
	var i int
	_, err := parseIntFmt(s, &i)
	return i, err == nil
}

// 用于避免导入 fmt 包的小技巧
func parseFloatFmt(s string, f *float64) (int, error) {
	result := 0
	dot := false
	dec := 0.1
	neg := false

	for i, c := range s {
		if i == 0 && c == '-' {
			neg = true
			continue
		}
		if c == '.' {
			dot = true
			continue
		}
		if c < '0' || c > '9' {
			return 0, nil
		}
		if !dot {
			result = result*10 + int(c-'0')
		} else {
			*f += float64(c-'0') * dec
			dec *= 0.1
		}
	}
	if neg {
		result = -result
		*f = -*f
	}
	*f += float64(result)
	return result, nil
}

func parseIntFmt(s string, i *int) (int, error) {
	result := 0
	neg := false

	for _, c := range s {
		if c == '-' {
			neg = true
			continue
		}
		if c < '0' || c > '9' {
			return 0, nil
		}
		result = result*10 + int(c-'0')
	}
	if neg {
		result = -result
	}
	*i = result
	return result, nil
}
