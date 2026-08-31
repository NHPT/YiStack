// Package service 业务逻辑层
package service

import (
	"context"
	"errors"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/utils"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ============================================
// 用户服务
// ============================================

// AuthService 认证服务
type AuthService struct {
	userRepo UserRepo
	jwtCfg   *config.JWTConfig
}

// NewAuthService 创建认证服务
func NewAuthService(userRepo UserRepo, jwtCfg *config.JWTConfig) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		jwtCfg:   jwtCfg,
	}
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
}

// RegisterResponse 注册响应
type RegisterResponse struct {
	User  *model.User `json:"user"`
	Token string      `json:"token"`
}

// Register 注册用户
func (s *AuthService) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	// 检查邮箱是否已存在
	existing, _ := s.userRepo.FindByEmail(ctx, req.Email)
	if existing != nil {
		return nil, errors.New("email already registered")
	}

	// 检查用户名是否已存在
	existing, _ = s.userRepo.FindByUsername(ctx, req.Username)
	if existing != nil {
		return nil, errors.New("username already taken")
	}

	// 密码加密
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 创建用户
	user := &model.User{
		ID:            uuid.NewString(),
		Email:         req.Email,
		PasswordHash:  string(hashedPassword),
		Username:      req.Username,
		Role:          "user",
		Status:        "active",
		EmailVerified: false,
		Plan:          "free",
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	// 生成 Token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &RegisterResponse{
		User:  user,
		Token: token,
	}, nil
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	User  *model.User `json:"user"`
	Token string      `json:"token"`
}

// Login 用户登录
func (s *AuthService) Login(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	// 查找用户
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	// 检查密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	// 检查用户状态
	if user.Status != "active" {
		return nil, errors.New("account is " + user.Status)
	}

	// 生成 Token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		User:  user,
		Token: token,
	}, nil
}

// RefreshTokenRequest 刷新 Token 请求
type RefreshTokenRequest struct {
	Token string `json:"token"`
}

// RefreshToken 刷新 Token
func (s *AuthService) RefreshToken(ctx context.Context, token string) (string, error) {
	// 验证旧 Token
	claims, err := utils.ValidateJWT(token, s.jwtCfg.Secret)
	if err != nil {
		return "", err
	}

	// 获取用户
	user, err := s.userRepo.FindByID(ctx, claims.UserID)
	if err != nil {
		return "", err
	}

	// 生成新 Token
	return s.generateToken(user)
}

// GetUserByID 根据 ID 获取用户
func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*model.User, error) {
	return s.userRepo.FindByID(ctx, userID)
}

// UpdateProfile 更新用户基础资料。
func (s *AuthService) UpdateProfile(ctx context.Context, userID, username string) (*model.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if username != "" {
		user.Username = username
	}
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

// ChangePassword 修改用户密码。
func (s *AuthService) ChangePassword(ctx context.Context, userID string, oldPassword, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("new password must be at least 6 characters")
	}

	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		return errors.New("invalid old password")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user.PasswordHash = string(hashedPassword)
	return s.userRepo.Update(ctx, user)
}

// UpdateLLMConfig 更新用户 LLM 配置
func (s *AuthService) UpdateLLMConfig(ctx context.Context, userID string, llmModel, temperature string, maxTokens int) error {
	return s.userRepo.UpdateLLMConfig(ctx, userID, llmModel, temperature, maxTokens)
}

// generateToken 生成 JWT Token
func (s *AuthService) generateToken(user *model.User) (string, error) {
	return utils.GenerateJWT(user.ID, user.Username, user.Email, user.Role, s.jwtCfg.Secret, s.jwtCfg.Expiry)
}

// ============================================
// 系统配置服务
// ============================================

// SystemConfigService 系统配置服务
type SystemConfigService struct {
	configRepo SystemConfigRepo
}

// NewSystemConfigService 创建系统配置服务
func NewSystemConfigService(configRepo SystemConfigRepo) *SystemConfigService {
	return &SystemConfigService{configRepo: configRepo}
}

// GetConfig 获取配置
func (s *SystemConfigService) GetConfig(ctx context.Context, key string) (string, error) {
	cfg, err := s.configRepo.Get(ctx, key)
	if err != nil {
		return "", err
	}
	return cfg.Value, nil
}

// SetConfig 设置配置
func (s *SystemConfigService) SetConfig(ctx context.Context, key, value string) error {
	if IsSensitiveSystemConfigKey(key) {
		return errors.New("sensitive config must use controlled secret storage")
	}
	return s.configRepo.Set(ctx, key, value)
}

// ListConfigs 列出所有配置
func (s *SystemConfigService) ListConfigs(ctx context.Context) (map[string]string, error) {
	configs, err := s.configRepo.List(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, cfg := range configs {
		result[cfg.Key] = cfg.Value
	}
	return result, nil
}

// ListConfigItems 列出完整的系统配置项
func (s *SystemConfigService) ListConfigItems(ctx context.Context) ([]model.SystemConfig, error) {
	return s.configRepo.List(ctx)
}

// GetAllConfigs 获取所有配置（ListConfigs 的别名）
func (s *SystemConfigService) GetAllConfigs(ctx context.Context) (map[string]string, error) {
	return s.ListConfigs(ctx)
}

// UpdateConfig 更新配置（SetConfig 的别名）
func (s *SystemConfigService) UpdateConfig(ctx context.Context, key, value string) error {
	return s.SetConfig(ctx, key, value)
}

// InitDefaults 初始化默认配置
func (s *SystemConfigService) InitDefaults(ctx context.Context) error {
	return s.configRepo.InitDefaults(ctx)
}
