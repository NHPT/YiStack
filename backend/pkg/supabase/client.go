// Package supabase Supabase Go 客户端
// 使用 Supabase REST API 直接连接，无需数据库密码
package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var supabaseReadRetryDelays = []time.Duration{
	200 * time.Millisecond,
	500 * time.Millisecond,
}

// Client Supabase 客户端
type Client struct {
	URL          string
	APIKey       string
	AuthKey      string
	httpClient   *http.Client
	headers      map[string]string
	adminHeaders map[string]string
}

// Config Supabase 配置
type Config struct {
	URL        string // Supabase 项目 URL
	APIKey     string // anon public key
	ServiceKey string // service_role key (可选，用于管理员操作)
}

// NewClient 创建 Supabase 客户端
func NewClient(cfg *Config) (*Client, error) {
	if cfg.URL == "" || cfg.APIKey == "" {
		return nil, fmt.Errorf("URL and APIKey are required")
	}

	// 默认使用 anon key
	defaultHeaders := map[string]string{
		"apikey":        cfg.APIKey,
		"Authorization": "Bearer " + cfg.APIKey,
		"Content-Type":  "application/json",
		"Prefer":        "return=representation",
	}

	// 保存 service key 用于管理员操作
	adminHeaders := map[string]string{
		"apikey":        cfg.ServiceKey,
		"Authorization": "Bearer " + cfg.ServiceKey,
		"Content-Type":  "application/json",
		"Prefer":        "return=representation",
	}

	return &Client{
		URL:          strings.TrimSuffix(cfg.URL, "/"),
		APIKey:       cfg.APIKey,
		AuthKey:      cfg.ServiceKey,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		headers:      defaultHeaders,
		adminHeaders: adminHeaders,
	}, nil
}

// Table 获取表操作接口
func (c *Client) Table(name string) *Table {
	return &Table{
		client:    c,
		tableName: name,
	}
}

// AdminTable 获取管理员表操作接口（绕过 RLS）
func (c *Client) AdminTable(name string) *Table {
	return &Table{
		client:    c,
		tableName: name,
		isAdmin:   true,
	}
}

// Auth 获取认证接口
func (c *Client) Auth() *Auth {
	return &Auth{
		client: c,
	}
}

// Admin 检查是否有管理员权限
func (c *Client) Admin() bool {
	return c.AuthKey != ""
}

// ============================================
// Table 操作
// ============================================

// Table 表操作
type Table struct {
	client     *Client
	tableName  string
	selectCols string
	filters    []filter
	orders     []order
	limitVal   int
	offsetVal  int
	returns    string
	isAdmin    bool
}

type filter struct {
	column   string
	operator string
	value    interface{}
}

type order struct {
	column string
	asc    bool
}

// Select 指定返回的列
func (t *Table) Select(cols string) *Table {
	t.selectCols = cols
	return t
}

// Filter 添加过滤条件
func (t *Table) Filter(column, operator string, value interface{}) *Table {
	t.filters = append(t.filters, filter{column, operator, value})
	return t
}

// Eq 等于
func (t *Table) Eq(column string, value interface{}) *Table {
	return t.Filter(column, "eq", value)
}

// Neq 不等于
func (t *Table) Neq(column string, value interface{}) *Table {
	return t.Filter(column, "neq", value)
}

// Lt 小于
func (t *Table) Lt(column string, value interface{}) *Table {
	return t.Filter(column, "lt", value)
}

// Lte 小于等于
func (t *Table) Lte(column string, value interface{}) *Table {
	return t.Filter(column, "lte", value)
}

// Gt 大于
func (t *Table) Gt(column string, value interface{}) *Table {
	return t.Filter(column, "gt", value)
}

// Gte 大于等于
func (t *Table) Gte(column string, value interface{}) *Table {
	return t.Filter(column, "gte", value)
}

// Like 模糊匹配
func (t *Table) Like(column, pattern string) *Table {
	return t.Filter(column, "like", pattern)
}

// Ilike 不区分大小写模糊匹配
func (t *Table) Ilike(column, pattern string) *Table {
	return t.Filter(column, "ilike", pattern)
}

// IsNull 为空
func (t *Table) IsNull(column string) *Table {
	return t.Filter(column, "is", "null")
}

// IsNotNull 不为空
func (t *Table) IsNotNull(column string) *Table {
	return t.Filter(column, "is", "not.null")
}

// In 在列表中
func (t *Table) In(column string, values []interface{}) *Table {
	return t.Filter(column, "in", fmt.Sprintf("(%v)", joinInterfaces(values, ",")))
}

// Order 排序
func (t *Table) Order(column string, ascending bool) *Table {
	t.orders = append(t.orders, order{column, ascending})
	return t
}

// Limit 限制数量
func (t *Table) Limit(n int) *Table {
	t.limitVal = n
	return t
}

// Offset 偏移量
func (t *Table) Offset(n int) *Table {
	t.offsetVal = n
	return t
}

// Insert 插入数据
func (t *Table) Insert(data interface{}) (*QueryResult, error) {
	return t.execute("POST", nil, data)
}

// Upsert 插入或更新
func (t *Table) Upsert(data interface{}) (*QueryResult, error) {
	t.returns = "representation"
	return t.execute("POST", nil, data)
}

// Select 查询数据
func (t *Table) SelectQuery() (*QueryResult, error) {
	params := t.buildParams()
	return t.execute("GET", params, nil)
}

// Find 查询单条（根据 ID）
func (t *Table) Find(id interface{}) (*QueryResult, error) {
	params := url.Values{}
	params.Add("id", fmt.Sprintf("eq.%v", id))
	params.Add("limit", "1")
	return t.execute("GET", params, nil)
}

// First 获取第一条
func (t *Table) First() (*QueryResult, error) {
	params := t.buildParams()
	params.Add("limit", "1")
	return t.execute("GET", params, nil)
}

// Update 更新数据
func (t *Table) Update(data interface{}) (*QueryResult, error) {
	if len(t.filters) == 0 {
		return nil, fmt.Errorf("update requires filter conditions")
	}
	params := t.buildParams()
	return t.execute("PATCH", params, data)
}

// Delete 删除数据
func (t *Table) Delete() (*QueryResult, error) {
	if len(t.filters) == 0 {
		return nil, fmt.Errorf("delete requires filter conditions")
	}
	params := t.buildParams()
	return t.execute("DELETE", params, nil)
}

// Count 计数
func (t *Table) Count() (int, error) {
	params := t.buildParams()
	params.Add("select", "count")
	resp, err := t.execute("GET", params, nil)
	if err != nil {
		return 0, err
	}

	if len(resp.Data) > 0 {
		if countMap, ok := resp.Data[0].(map[string]interface{}); ok {
			if count, ok := countMap["count"].(string); ok {
				var n int
				fmt.Sscanf(count, "%d", &n)
				return n, nil
			}
		}
	}
	return 0, nil
}

func (t *Table) buildParams() url.Values {
	params := url.Values{}

	if t.selectCols != "" {
		params.Add("select", t.selectCols)
	} else {
		params.Add("select", "*")
	}

	// 构建过滤条件
	for _, f := range t.filters {
		params.Add(f.column, fmt.Sprintf("%s.%v", f.operator, f.value))
	}

	// 构建排序
	if len(t.orders) > 0 {
		var orderParts []string
		for _, o := range t.orders {
			direction := "desc"
			if o.asc {
				direction = "asc"
			}
			orderParts = append(orderParts, fmt.Sprintf("%s.%s", o.column, direction))
		}
		params.Add("order", strings.Join(orderParts, ","))
	}

	if t.limitVal > 0 {
		params.Add("limit", fmt.Sprintf("%d", t.limitVal))
	}

	if t.offsetVal > 0 {
		params.Add("offset", fmt.Sprintf("%d", t.offsetVal))
	}

	return params
}

func (t *Table) execute(method string, params url.Values, data interface{}) (*QueryResult, error) {
	// 构建 URL
	reqURL := fmt.Sprintf("%s/rest/v1/%s", t.client.URL, t.tableName)
	if params != nil {
		reqURL += "?" + params.Encode()
	}

	var jsonData []byte
	if data != nil {
		encoded, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal data: %w", err)
		}
		jsonData = encoded
	}

	var lastErr error
	maxAttempts := 1
	if method == http.MethodGet {
		maxAttempts += len(supabaseReadRetryDelays)
	}
	for attempt := 0; attempt < maxAttempts; attempt++ {
		result, err := t.executeOnce(method, reqURL, jsonData)
		if err == nil {
			return result, nil
		}
		lastErr = err
		if method != http.MethodGet || !isRetryableSupabaseReadError(err) || attempt == maxAttempts-1 {
			return nil, err
		}
		time.Sleep(supabaseReadRetryDelays[attempt])
	}
	return nil, lastErr
}

func (t *Table) executeOnce(method, reqURL string, jsonData []byte) (*QueryResult, error) {
	var body io.Reader
	if jsonData != nil {
		body = bytes.NewReader(jsonData)
	}
	req, err := http.NewRequest(method, reqURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	// 选择使用 admin headers 还是普通 headers
	headersToUse := t.client.headers
	if t.isAdmin && t.client.adminHeaders != nil {
		headersToUse = t.client.adminHeaders
	}
	for k, v := range headersToUse {
		req.Header.Set(k, v)
	}

	// 执行请求
	resp, err := t.client.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	// 读取响应
	respBody, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// 检查状态码
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	// 解析响应
	var result QueryResult
	if len(respBody) > 0 && respBody[0] == '[' {
		// 数组响应
		if err := json.Unmarshal(respBody, &result.Data); err != nil {
			return nil, fmt.Errorf("failed to unmarshal response: %w", err)
		}
	} else if len(respBody) > 0 && respBody[0] == '{' {
		// 对象响应
		var singleResult []interface{}
		var objResult map[string]interface{}
		if err := json.Unmarshal(respBody, &objResult); err != nil {
			return nil, fmt.Errorf("failed to unmarshal response: %w", err)
		}
		singleResult = append(singleResult, objResult)
		result.Data = singleResult
	}

	// 提取响应头信息
	result.Count = resp.Header.Get("Content-Range")

	return &result, nil
}

func isRetryableSupabaseReadError(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, io.EOF) ||
		errors.Is(err, io.ErrUnexpectedEOF) ||
		errors.Is(err, syscall.ECONNRESET) ||
		errors.Is(err, syscall.ECONNREFUSED) ||
		errors.Is(err, syscall.EPIPE) ||
		errors.Is(err, syscall.ETIMEDOUT) {
		return true
	}
	var networkErr net.Error
	if errors.As(err, &networkErr) && (networkErr.Timeout() || networkErr.Temporary()) {
		return true
	}
	message := strings.ToLower(err.Error())
	for _, marker := range []string{
		"connection reset",
		"server closed idle connection",
		"tls handshake timeout",
		"temporarily unavailable",
		"request failed with status 408",
		"request failed with status 425",
		"request failed with status 429",
		"request failed with status 5",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

// QueryResult 查询结果
type QueryResult struct {
	Data  []interface{} `json:"data"`
	Count string        `json:"count,omitempty"`
}

// ============================================
// Auth 认证
// ============================================

// Auth 认证操作
type Auth struct {
	client *Client
}

// SignUp 注册用户
func (a *Auth) SignUp(email, password string, metadata map[string]interface{}) (*User, error) {
	data := map[string]interface{}{
		"email":    email,
		"password": password,
	}
	if metadata != nil {
		data["data"] = metadata
	}

	reqBody, _ := json.Marshal(data)
	req, err := http.NewRequest("POST", a.client.URL+"/auth/v1/signup", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.client.APIKey)

	resp, err := a.client.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("signup failed: %s", string(respBody))
	}

	var result User
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// SignIn 登录
func (a *Auth) SignIn(email, password string) (*Session, error) {
	data := map[string]interface{}{
		"email":    email,
		"password": password,
	}

	reqBody, _ := json.Marshal(data)
	req, err := http.NewRequest("POST", a.client.URL+"/auth/v1/token?grant_type=password", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.client.APIKey)

	resp, err := a.client.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("login failed: %s", string(respBody))
	}

	var result Session
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// RefreshToken 刷新 Token
func (a *Auth) RefreshToken(refreshToken string) (*Session, error) {
	data := map[string]interface{}{
		"refresh_token": refreshToken,
	}

	reqBody, _ := json.Marshal(data)
	req, err := http.NewRequest("POST", a.client.URL+"/auth/v1/token?grant_type=refresh_token", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.client.APIKey)

	resp, err := a.client.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("refresh failed: %s", string(respBody))
	}

	var result Session
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// User 用户信息
type User struct {
	ID           string                 `json:"id"`
	Email        string                 `json:"email"`
	CreatedAt    string                 `json:"created_at"`
	UpdatedAt    string                 `json:"updated_at"`
	AppMetaData  map[string]interface{} `json:"app_metadata"`
	UserMetaData map[string]interface{} `json:"user_metadata"`
}

// Session 会话信息
type Session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	ExpiresAt    int64  `json:"expires_at"`
	TokenType    string `json:"token_type"`
	User         *User  `json:"user"`
}

// ============================================
// 辅助函数
// ============================================

func joinInterfaces(values []interface{}, sep string) string {
	var parts []string
	for _, v := range values {
		parts = append(parts, fmt.Sprintf("%v", v))
	}
	return strings.Join(parts, sep)
}

// GenerateJWT 生成 JWT (用于 RLS 策略验证)
func GenerateJWT(claims jwt.MapClaims, secret string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
