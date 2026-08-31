package middleware

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
	"github.com/golang-jwt/jwt/v5"

	"yistack/config"
	"yistack/internal/model"
	"yistack/internal/service"
)

// JWTClaims JWT Claims - UserID 使用 string 以兼容 UUID
type JWTClaims struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	AuthVersion int    `json:"auth_version,omitempty"`
	jwt.RegisteredClaims
}

type AuthUserLookup interface {
	FindByID(ctx context.Context, id string) (*model.User, error)
}

type AuthAdminLookup interface {
	FindByID(ctx context.Context, id string) (*model.Admin, error)
}

// AuthConfig 认证配置
type AuthConfig struct {
	JWTConfig *config.JWTConfig
	SkipPaths []string
	UserRepo  AuthUserLookup
	AdminRepo AuthAdminLookup
}

// Auth JWT认证中间件
func Auth(cfg *AuthConfig) app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		path := string(ctx.Request.URI().Path())
		if cfg != nil && shouldSkipAuth(path, cfg.SkipPaths) {
			ctx.Next(c)
			return
		}

		authHeader := string(ctx.Request.Header.Get("Authorization"))
		if authHeader == "" {
			respondError(ctx, consts.StatusUnauthorized, 1002, "缺少登录凭据，请重新登录")
			ctx.Abort()
			return
		}

		tokenParts := strings.SplitN(authHeader, " ", 2)
		if len(tokenParts) != 2 || strings.ToLower(tokenParts[0]) != "bearer" {
			respondError(ctx, consts.StatusUnauthorized, 1002, "登录凭据格式无效，请重新登录")
			ctx.Abort()
			return
		}

		tokenString := tokenParts[1]
		claims := &JWTClaims{}
		if cfg == nil || cfg.JWTConfig == nil || strings.TrimSpace(cfg.JWTConfig.Secret) == "" {
			respondError(ctx, consts.StatusServiceUnavailable, 3001, "认证服务未正确配置")
			ctx.Abort()
			return
		}
		secret := strings.TrimSpace(cfg.JWTConfig.Secret)

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			respondError(ctx, consts.StatusUnauthorized, 1002, "登录状态已失效，请重新登录")
			ctx.Abort()
			return
		}

		if strings.TrimSpace(claims.UserID) == "" {
			respondError(ctx, consts.StatusUnauthorized, 1002, "登录状态缺少用户身份，请重新登录")
			ctx.Abort()
			return
		}

		if cfg != nil && cfg.AdminRepo != nil {
			admin, err := cfg.AdminRepo.FindByID(c, claims.UserID)
			if err != nil || admin == nil {
				respondError(ctx, consts.StatusUnauthorized, 1002, "管理员登录状态已失效，请重新登录")
				ctx.Abort()
				return
			}
			if strings.TrimSpace(admin.Status) != "active" {
				respondError(ctx, consts.StatusUnauthorized, 1002, "管理员账号已被禁用，请联系超级管理员")
				ctx.Abort()
				return
			}
			if claims.Role != "admin" && claims.Role != "super_admin" {
				respondError(ctx, consts.StatusForbidden, 1003, "管理员登录状态无效，请重新登录")
				ctx.Abort()
				return
			}
			authVersion := admin.AuthVersion
			if authVersion < 1 {
				authVersion = 1
			}
			if claims.AuthVersion != authVersion {
				respondError(ctx, consts.StatusUnauthorized, 1002, "管理员登录状态已过期，请重新登录")
				ctx.Abort()
				return
			}
			ctx.Set("admin_must_change_password", admin.MustChangePassword)
		}

		if cfg != nil && cfg.UserRepo != nil {
			user, err := cfg.UserRepo.FindByID(c, claims.UserID)
			if err != nil || user == nil {
				respondError(ctx, consts.StatusUnauthorized, 1002, "登录用户不存在，请重新登录")
				ctx.Abort()
				return
			}
			if strings.TrimSpace(user.Status) != "active" {
				respondError(ctx, consts.StatusUnauthorized, 1002, "用户账号已被禁用，请联系管理员")
				ctx.Abort()
				return
			}
			if claims.Role == "admin" || claims.Role == "super_admin" {
				respondError(ctx, consts.StatusForbidden, 1003, "管理员账号不能访问用户端接口")
				ctx.Abort()
				return
			}
		}

		if cfg == nil || (cfg.UserRepo == nil && cfg.AdminRepo == nil) {
			respondError(ctx, consts.StatusUnauthorized, 1002, "认证上下文未配置用户校验，请重新登录")
			ctx.Abort()
			return
		}

		ctx.Set("user_id", claims.UserID)
		ctx.Set("username", claims.Username)
		ctx.Set("email", claims.Email)
		ctx.Set("role", claims.Role)
		if claims.Role == "admin" || claims.Role == "super_admin" {
			ctx.Set("admin_id", claims.UserID)
		}

		ctx.Next(c)
	}
}

// RequireAdminPasswordChanged 阻止仍在使用初始密码的管理员访问管理接口。
func RequireAdminPasswordChanged() app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		value, exists := ctx.Get("admin_must_change_password")
		mustChangePassword, valid := value.(bool)
		if !exists || !valid {
			respondError(ctx, consts.StatusForbidden, 1003, "管理员密码状态不可用，请重新登录")
			ctx.Abort()
			return
		}
		if mustChangePassword {
			respondError(ctx, consts.StatusForbidden, 1004, "首次登录必须先修改默认密码")
			ctx.Abort()
			return
		}
		ctx.Next(c)
	}
}

// RequireRole 角色验证中间件
func RequireRole(roles ...string) app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		userRole, ok := ctx.Get("role")
		if !ok {
			respondError(ctx, consts.StatusForbidden, 1003, "登录状态缺少角色信息，请重新登录")
			ctx.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok || roleStr == "" {
			respondError(ctx, consts.StatusForbidden, 1003, "登录角色无效，请重新登录")
			ctx.Abort()
			return
		}
		for _, r := range roles {
			if roleStr == r {
				ctx.Next(c)
				return
			}
		}

		respondError(ctx, consts.StatusForbidden, 1003, "权限不足")
		ctx.Abort()
	}
}

// RequireAdminPermission 管理员权限点校验
func RequireAdminPermission(adminRepo service.AdminRepo, permissions ...string) app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		userID, exists := ctx.Get("user_id")
		if !exists {
			respondError(ctx, consts.StatusUnauthorized, 1002, "需要管理员登录")
			ctx.Abort()
			return
		}
		adminID, ok := userID.(string)
		if !ok || adminID == "" {
			respondError(ctx, consts.StatusUnauthorized, 1002, "管理员身份无效，请重新登录")
			ctx.Abort()
			return
		}

		roleValue, exists := ctx.Get("role")
		if !exists {
			respondError(ctx, consts.StatusForbidden, 1003, "登录状态缺少角色信息，请重新登录")
			ctx.Abort()
			return
		}
		role, _ := roleValue.(string)
		if role == "super_admin" {
			ctx.Next(c)
			return
		}
		if role != "admin" {
			respondError(ctx, consts.StatusForbidden, 1003, "权限不足")
			ctx.Abort()
			return
		}
		if adminRepo == nil {
			respondError(ctx, consts.StatusServiceUnavailable, 1001, "管理员权限服务不可用")
			ctx.Abort()
			return
		}

		codes, err := adminRepo.GetAdminPermissionCodes(c, adminID)
		if err != nil {
			respondError(ctx, consts.StatusInternalServerError, 1001, "读取管理员权限失败")
			ctx.Abort()
			return
		}
		for _, code := range codes {
			for _, permission := range permissions {
				if code == permission {
					ctx.Next(c)
					return
				}
			}
		}

		respondError(ctx, consts.StatusForbidden, 1003, "缺少必要的管理员权限")
		ctx.Abort()
	}
}

// NewAuthConfig 创建认证配置
func NewAuthConfig(jwtCfg *config.JWTConfig) *AuthConfig {
	return &AuthConfig{
		JWTConfig: jwtCfg,
		SkipPaths: []string{
			"/api/health",
			"/api/auth/register",
			"/api/auth/login",
			"/api/auth/refresh",
			"/api/admin/auth/login",
			"/api/chat/models",
			"/api/llm/providers",
			"/api/llm/providers/:id",
			"/api/llm/providers/test",
			"/api/llm/config",
		},
	}
}

func NewUserAuthConfig(jwtCfg *config.JWTConfig, userRepo AuthUserLookup) *AuthConfig {
	cfg := NewAuthConfig(jwtCfg)
	cfg.UserRepo = userRepo
	return cfg
}

func NewAdminAuthConfig(jwtCfg *config.JWTConfig, adminRepo AuthAdminLookup) *AuthConfig {
	cfg := NewAuthConfig(jwtCfg)
	cfg.AdminRepo = adminRepo
	return cfg
}

func shouldSkipAuth(path string, skipPaths []string) bool {
	for _, skipPath := range skipPaths {
		if path == skipPath || strings.HasPrefix(path, skipPath) {
			return true
		}
	}
	return false
}

// GetUserID 从 Context 获取用户 ID (UUID string)
func GetUserID(ctx *app.RequestContext) string {
	if userID, exists := ctx.Get("user_id"); exists {
		if id, ok := userID.(string); ok {
			return id
		}
	}
	return ""
}

// GetUserRole 从 Context 获取用户角色
func GetUserRole(ctx *app.RequestContext) string {
	if role, exists := ctx.Get("role"); exists {
		if value, ok := role.(string); ok {
			return value
		}
	}
	return ""
}

// IsAdmin 检查是否为管理员
func IsAdmin(ctx *app.RequestContext) bool {
	return GetUserRole(ctx) == "admin"
}

// GetClientIP 获取客户端 IP
func GetClientIP(ctx *app.RequestContext) string {
	ip := string(ctx.Request.Header.Get("X-Forwarded-For"))
	if ip == "" {
		ip = string(ctx.ClientIP())
	}
	return strings.Split(ip, ",")[0]
}
