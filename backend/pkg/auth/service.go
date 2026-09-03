// Package auth Supabase 认证服务
package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/supabase"
	"yistack/pkg/utils"
)

// SupabaseAuthService Supabase 认证服务
type SupabaseAuthService struct {
	client      *supabase.Client
	jwtCfg      *config.JWTConfig
	supabaseURL string
}

func firstResultMap(data []interface{}) (map[string]interface{}, bool) {
	if len(data) == 0 {
		return nil, false
	}
	record, ok := data[0].(map[string]interface{})
	if !ok || record == nil {
		return nil, false
	}
	return record, true
}

// NewSupabaseAuthService 创建 Supabase 认证服务
func NewSupabaseAuthService(client *supabase.Client, jwtCfg *config.JWTConfig, supabaseURL string) *SupabaseAuthService {
	return &SupabaseAuthService{
		client:      client,
		jwtCfg:      jwtCfg,
		supabaseURL: supabaseURL,
	}
}

// ============================================
// 用户相关 - 使用 model.User 统一模型
// ============================================

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthResponse 认证响应
type AuthResponse struct {
	User         model.User `json:"user"`
	Token        string     `json:"token"`
	ExpiresAt    int64      `json:"expires_at"`
	ExpiresIn    int        `json:"expires_in"`
	TokenType    string     `json:"token_type"`
	RefreshToken string     `json:"refresh_token,omitempty"`
}

// Register 注册用户
func (s *SupabaseAuthService) Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error) {
	// 验证输入
	if req.Email == "" || !isValidEmail(req.Email) {
		return nil, errors.New("invalid email address")
	}
	if len(req.Password) < 6 {
		return nil, errors.New("password must be at least 6 characters")
	}
	if req.Username == "" {
		req.Username = req.Email[:strings.Index(req.Email, "@")]
	}

	// 检查邮箱是否已存在
	existing, _ := s.client.AdminTable("users").Eq("email", req.Email).First()
	if existing != nil && len(existing.Data) > 0 {
		return nil, errors.New("email already registered")
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 生成用户 ID (UUID)
	userID := utils.GenerateUUID()

	// 创建用户 - 对齐实际 users 表结构
	now := time.Now().Format(time.RFC3339)
	userData := map[string]interface{}{
		"id":              userID,
		"email":           req.Email,
		"username":        req.Username,
		"password_hash":   string(hashedPassword),
		"role":            "user",
		"status":          "active",
		"plan":            "free",
		"email_verified":  false,
		"avatar_url":      "",
		"llm_model":       "doubao-seed-2.0-lite-260215",
		"llm_temperature": "0.7",
		"llm_max_tokens":  4096,
		"created_at":      now,
		"updated_at":      now,
	}

	result, err := s.client.AdminTable("users").Insert(userData)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// 获取创建的用户
	var user model.User
	if m, ok := firstResultMap(result.Data); ok {
		user = mapToModelUser(m)
	}

	// 生成 JWT Token
	token, expiresAt, err := s.generateToken(&user)
	if err != nil {
		return nil, err
	}

	// 生成 Refresh Token
	refreshToken := generateRefreshToken()

	return &AuthResponse{
		User:         user,
		Token:        token,
		ExpiresAt:    expiresAt,
		ExpiresIn:    int(s.jwtCfg.Expiry),
		TokenType:    "Bearer",
		RefreshToken: refreshToken,
	}, nil
}

// Login 登录
func (s *SupabaseAuthService) Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error) {
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	result, err := s.client.AdminTable("users").Eq("email", req.Email).First()
	if err != nil || len(result.Data) == 0 {
		return nil, errors.New("invalid email or password")
	}

	userRecord, ok := firstResultMap(result.Data)
	if !ok {
		return nil, errors.New("invalid user record")
	}
	user := mapToModelUser(userRecord)

	if user.Status != "active" {
		return nil, errors.New("account is disabled")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	token, expiresAt, err := s.generateToken(&user)
	if err != nil {
		return nil, err
	}

	refreshToken := generateRefreshToken()
	s.storeRefreshToken(user.ID, refreshToken)

	return &AuthResponse{
		User:         user,
		Token:        token,
		ExpiresAt:    expiresAt,
		ExpiresIn:    int(s.jwtCfg.Expiry),
		TokenType:    "Bearer",
		RefreshToken: refreshToken,
	}, nil
}

// RefreshToken 刷新 Token
func (s *SupabaseAuthService) RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	userID, err := s.validateRefreshToken(refreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	result, err := s.client.AdminTable("users").Eq("id", userID).First()
	if err != nil || len(result.Data) == 0 {
		return nil, errors.New("user not found")
	}

	userRecord, ok := firstResultMap(result.Data)
	if !ok {
		return nil, errors.New("invalid user record")
	}
	user := mapToModelUser(userRecord)

	if user.Status != "active" {
		return nil, errors.New("account is disabled")
	}

	token, expiresAt, err := s.generateToken(&user)
	if err != nil {
		return nil, err
	}

	newRefreshToken := generateRefreshToken()
	s.storeRefreshToken(user.ID, newRefreshToken)

	return &AuthResponse{
		User:         user,
		Token:        token,
		ExpiresAt:    expiresAt,
		ExpiresIn:    int(s.jwtCfg.Expiry),
		TokenType:    "Bearer",
		RefreshToken: newRefreshToken,
	}, nil
}

// GetUserByID 根据 ID 获取用户
func (s *SupabaseAuthService) GetUserByID(ctx context.Context, id string) (*model.User, error) {
	result, err := s.client.AdminTable("users").Eq("id", id).First()
	if err != nil || len(result.Data) == 0 {
		return nil, errors.New("user not found")
	}

	userRecord, ok := firstResultMap(result.Data)
	if !ok {
		return nil, errors.New("invalid user record")
	}
	user := mapToModelUser(userRecord)
	return &user, nil
}

// GetAllUsers 获取所有用户
func (s *SupabaseAuthService) GetAllUsers(ctx context.Context) ([]model.User, error) {
	result, err := s.client.AdminTable("users").Order("created_at", false).SelectQuery()
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}

	users := make([]model.User, 0, len(result.Data))
	for _, d := range result.Data {
		if m, ok := d.(map[string]interface{}); ok {
			users = append(users, mapToModelUser(m))
		}
	}

	return users, nil
}

// UpdateUser 更新用户
func (s *SupabaseAuthService) UpdateUser(ctx context.Context, id string, updates map[string]interface{}) (*model.User, error) {
	updates["updated_at"] = time.Now().Format(time.RFC3339)

	delete(updates, "password_hash")
	delete(updates, "role")

	_, err := s.client.AdminTable("users").Eq("id", id).Update(updates)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return s.GetUserByID(ctx, id)
}

// ChangePassword 修改密码
func (s *SupabaseAuthService) ChangePassword(ctx context.Context, userID string, oldPassword, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("new password must be at least 6 characters")
	}

	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		return errors.New("invalid old password")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	_, err = s.client.AdminTable("users").Eq("id", userID).Update(map[string]interface{}{
		"password_hash": string(hashedPassword),
		"updated_at":    time.Now().Format(time.RFC3339),
	})

	return err
}

// DeleteUser 删除用户
func (s *SupabaseAuthService) DeleteUser(ctx context.Context, id string) error {
	_, err := s.client.AdminTable("users").Eq("id", id).Delete()
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}

// ============================================
// Token 相关
// ============================================

// Claims JWT Claims - UserID 使用 string 兼容 UUID
type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// generateToken 生成 JWT Token
func (s *SupabaseAuthService) generateToken(user *model.User) (string, int64, error) {
	expiresAt := time.Now().Add(time.Duration(s.jwtCfg.Expiry) * time.Second)

	claims := &Claims{
		UserID:   user.ID, // UUID string
		Email:    user.Email,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtCfg.Secret))
	if err != nil {
		return "", 0, fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, expiresAt.Unix(), nil
}

// ValidateToken 验证 Token
func (s *SupabaseAuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtCfg.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token claims")
}

// ============================================
// Refresh Token 管理
// ============================================

// refreshTokens 内存存储（生产环境应该用 Redis）
var refreshTokens = make(map[string]string) // token -> userID (UUID string)

// storeRefreshToken 存储 Refresh Token
func (s *SupabaseAuthService) storeRefreshToken(userID string, token string) {
	refreshTokens[token] = userID
}

// validateRefreshToken 验证 Refresh Token
func (s *SupabaseAuthService) validateRefreshToken(token string) (string, error) {
	userID, ok := refreshTokens[token]
	if !ok {
		return "", errors.New("invalid refresh token")
	}
	return userID, nil
}

// RevokeRefreshToken 撤销 Refresh Token
func (s *SupabaseAuthService) RevokeRefreshToken(ctx context.Context, token string) error {
	delete(refreshTokens, token)
	return nil
}

// ============================================
// 辅助函数
// ============================================

// generateRefreshToken 生成 Refresh Token
func generateRefreshToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// isValidEmail 验证邮箱格式
func isValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

// mapToModelUser 映射用户数据到 model.User - 对齐实际 users 表
func mapToModelUser(m map[string]interface{}) model.User {
	user := model.User{}

	// ID is UUID string
	if id, ok := m["id"].(string); ok {
		user.ID = id
	}
	if email, ok := m["email"].(string); ok {
		user.Email = email
	}
	if username, ok := m["username"].(string); ok {
		user.Username = username
	}
	if passwordHash, ok := m["password_hash"].(string); ok {
		user.PasswordHash = passwordHash
	}
	if avatarURL, ok := m["avatar_url"].(string); ok {
		user.AvatarURL = avatarURL
	}
	if role, ok := m["role"].(string); ok {
		user.Role = role
	}
	if status, ok := m["status"].(string); ok {
		user.Status = status
	}
	if plan, ok := m["plan"].(string); ok {
		user.Plan = plan
	}
	if emailVerified, ok := m["email_verified"].(bool); ok {
		user.EmailVerified = emailVerified
	}
	if llmModel, ok := m["llm_model"].(string); ok {
		user.LLMModel = llmModel
	}
	if llmTemp, ok := m["llm_temperature"].(string); ok {
		user.LLMTemperature = llmTemp
	}
	if tokens, ok := m["llm_max_tokens"].(float64); ok {
		user.LLMMaxTokens = int(tokens)
	}
	if instanceID, ok := m["instance_id"].(string); ok {
		user.InstanceID = &instanceID
	}

	return user
}
