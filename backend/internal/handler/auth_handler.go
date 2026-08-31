// Package handler HTTP 处理器
package handler

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"golang.org/x/crypto/bcrypt"

	"yistack/config"
	"yistack/internal/model"
	"yistack/internal/service"
	pkgauth "yistack/pkg/auth"
	"yistack/pkg/utils"
)

func stringContextValue(ctx *app.RequestContext, key string) (string, bool) {
	if ctx == nil {
		return "", false
	}
	value, exists := ctx.Get(key)
	if !exists {
		return "", false
	}
	text, ok := value.(string)
	if !ok || text == "" {
		return "", false
	}
	return text, true
}

// AuthHandler 用户认证处理器。
// 认证来源的差异由 AuthFacade 屏蔽，handler 只负责 HTTP 协议转换。
type AuthHandler struct {
	auth AuthFacade
}

// NewAuthHandler 创建 Supabase 版认证处理器。
func NewAuthHandler(authService *pkgauth.SupabaseAuthService) *AuthHandler {
	return &AuthHandler{auth: newSupabaseAuthFacade(authService)}
}

// NewAuthHandlerWithService 创建传统数据库版认证处理器。
func NewAuthHandlerWithService(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: newTraditionalAuthFacade(authService)}
}

// Register 注册
// POST /api/auth/register
func (h *AuthHandler) Register(c context.Context, ctx *app.RequestContext) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Username string `json:"username"`
	}

	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(400, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
		return
	}

	if h.auth == nil {
		writeAuthUnavailable(ctx)
		return
	}

	resp, err := h.auth.Register(c, req.Email, req.Password, req.Username)
	if err != nil {
		writeAuthError(ctx, 400, err.Error())
		return
	}

	writeAuthSession(ctx, resp)
}

// Login 登录
// POST /api/auth/login
func (h *AuthHandler) Login(c context.Context, ctx *app.RequestContext) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(400, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
		return
	}

	if h.auth == nil {
		writeAuthUnavailable(ctx)
		return
	}

	resp, err := h.auth.Login(c, req.Email, req.Password)
	if err != nil {
		writeAuthError(ctx, 401, err.Error())
		return
	}

	writeAuthSession(ctx, resp)
}

// RefreshToken 刷新 Token
// POST /api/auth/refresh
func (h *AuthHandler) RefreshToken(c context.Context, ctx *app.RequestContext) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(400, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
		return
	}

	if h.auth == nil {
		writeAuthUnavailable(ctx)
		return
	}

	resp, err := h.auth.RefreshToken(c, req.RefreshToken)
	if err != nil {
		writeAuthError(ctx, 401, err.Error())
		return
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"token":         resp.Token,
			"expires_at":    resp.ExpiresAt,
			"expires_in":    resp.ExpiresIn,
			"token_type":    resp.TokenType,
			"refresh_token": resp.RefreshToken,
		},
	})
}

// GetProfile 获取当前用户信息
// GET /api/auth/profile
func (h *AuthHandler) GetProfile(c context.Context, ctx *app.RequestContext) {
	uid, ok := stringContextValue(ctx, "user_id")
	if !ok {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "unauthorized",
		})
		return
	}

	if h.auth == nil {
		writeAuthUnavailable(ctx)
		return
	}

	user, err := h.auth.GetUserByID(c, uid)
	if err != nil {
		writeAuthError(ctx, 404, "user not found")
		return
	}

	writeAuthUser(ctx, user)
}

// UpdateProfile 更新用户信息
// PUT /api/auth/profile
func (h *AuthHandler) UpdateProfile(c context.Context, ctx *app.RequestContext) {
	uid, ok := stringContextValue(ctx, "user_id")
	if !ok {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "unauthorized",
		})
		return
	}

	var req struct {
		Username string `json:"username"`
	}

	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(400, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
		return
	}

	if h.auth == nil {
		writeAuthUnavailable(ctx)
		return
	}

	user, err := h.auth.UpdateProfile(c, uid, req.Username)
	if err != nil {
		writeAuthError(ctx, 400, err.Error())
		return
	}

	writeAuthUser(ctx, user)
}

// ChangePassword 修改密码
// POST /api/auth/change-password
func (h *AuthHandler) ChangePassword(c context.Context, ctx *app.RequestContext) {
	uid, ok := stringContextValue(ctx, "user_id")
	if !ok {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "unauthorized",
		})
		return
	}

	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(400, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
		return
	}

	if h.auth == nil {
		writeAuthUnavailable(ctx)
		return
	}

	if err := h.auth.ChangePassword(c, uid, req.OldPassword, req.NewPassword); err != nil {
		writeAuthError(ctx, 400, err.Error())
		return
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data":    nil,
	})
}

// Logout 登出
// POST /api/auth/logout
func (h *AuthHandler) Logout(c context.Context, ctx *app.RequestContext) {
	if h.auth == nil {
		writeAuthUnavailable(ctx)
		return
	}

	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = ctx.Bind(&req)
	_ = h.auth.Logout(c, req.RefreshToken)

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data":    nil,
	})
}

func writeAuthUnavailable(ctx *app.RequestContext) {
	writeAuthError(ctx, 500, "auth service not available")
}

func writeAuthError(ctx *app.RequestContext, statusCode int, message string) {
	ctx.JSON(statusCode, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

func writeAuthSession(ctx *app.RequestContext, session *AuthSession) {
	if session == nil {
		writeAuthUnavailable(ctx)
		return
	}

	data := map[string]interface{}{
		"token":      session.Token,
		"expires_in": session.ExpiresIn,
	}
	if session.User != nil {
		data["user"] = map[string]interface{}{
			"id":       session.User.GetID(),
			"email":    session.User.Email,
			"username": session.User.Username,
			"role":     session.User.Role,
			"status":   session.User.Status,
			"plan":     session.User.Plan,
		}
	}
	if session.ExpiresAt > 0 {
		data["expires_at"] = session.ExpiresAt
	}
	if session.TokenType != "" {
		data["token_type"] = session.TokenType
	}
	if session.RefreshToken != "" {
		data["refresh_token"] = session.RefreshToken
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data":    data,
	})
}

func writeAuthUser(ctx *app.RequestContext, user *model.User) {
	if user == nil {
		writeAuthError(ctx, 404, "user not found")
		return
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":         user.ID,
			"email":      user.Email,
			"username":   user.Username,
			"role":       user.Role,
			"status":     user.Status,
			"plan":       user.Plan,
			"created_at": user.CreatedAt,
		},
	})
}

// AdminAuthHandler 管理员认证处理器（查 admins 表，与 users 完全分离）
type AdminAuthRepository interface {
	FindByEmail(ctx context.Context, email string) (*model.Admin, error)
	FindByID(ctx context.Context, id string) (*model.Admin, error)
	Update(ctx context.Context, admin *model.Admin) error
	UpdateLastLogin(ctx context.Context, id string) error
	GetAdminPermissionCodes(ctx context.Context, adminID string) ([]string, error)
}

type AdminAuthHandler struct {
	adminRepo AdminAuthRepository
	jwtCfg    *config.JWTConfig
}

// NewAdminAuthHandler 创建管理员认证处理器
func NewAdminAuthHandler(adminRepo AdminAuthRepository, jwtCfg *config.JWTConfig) *AdminAuthHandler {
	return &AdminAuthHandler{adminRepo: adminRepo, jwtCfg: jwtCfg}
}

func normalizedAdminAuthVersion(value int) int {
	if value < 1 {
		return 1
	}
	return value
}

// Login 管理员登录（查 admins 表）
// POST /api/admin/auth/login
func (h *AdminAuthHandler) Login(c context.Context, ctx *app.RequestContext) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(400, map[string]interface{}{
			"success": false,
			"error":   "invalid request body",
		})
		return
	}

	if h.adminRepo == nil {
		ctx.JSON(500, map[string]interface{}{
			"success": false,
			"error":   "admin repository not available",
		})
		return
	}

	// 从 admins 表查找管理员
	admin, err := h.adminRepo.FindByEmail(c, req.Email)
	if err != nil {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "invalid email or password",
		})
		return
	}

	// 检查管理员状态
	if admin.Status != "active" {
		ctx.JSON(403, map[string]interface{}{
			"success": false,
			"error":   "admin account is disabled",
		})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "invalid email or password",
		})
		return
	}

	// 生成 JWT（role 为 admin 或 super_admin）
	token, err := utils.GenerateAdminJWT(
		admin.ID,
		admin.Username,
		admin.Email,
		admin.Role,
		h.jwtCfg.Secret,
		h.jwtCfg.Expiry,
		normalizedAdminAuthVersion(admin.AuthVersion),
	)
	if err != nil {
		ctx.JSON(500, map[string]interface{}{
			"success": false,
			"error":   "failed to generate token",
		})
		return
	}

	// 更新最后登录时间
	go h.adminRepo.UpdateLastLogin(context.Background(), admin.ID)

	permissionCodes := []string{}
	if admin.Role != "super_admin" {
		if codes, err := h.adminRepo.GetAdminPermissionCodes(c, admin.ID); err == nil {
			permissionCodes = codes
		}
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"admin": map[string]interface{}{
				"id":                   admin.ID,
				"email":                admin.Email,
				"username":             admin.Username,
				"role":                 admin.Role,
				"status":               admin.Status,
				"must_change_password": admin.MustChangePassword,
				"permission_codes":     permissionCodes,
			},
			"token":      token,
			"expires_in": h.jwtCfg.Expiry,
		},
	})
}

// GetProfile 获取管理员信息
// GET /api/admin/auth/profile
func (h *AdminAuthHandler) GetProfile(c context.Context, ctx *app.RequestContext) {
	uid, ok := stringContextValue(ctx, "user_id")
	if !ok {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "unauthorized",
		})
		return
	}

	if h.adminRepo == nil {
		ctx.JSON(500, map[string]interface{}{
			"success": false,
			"error":   "admin repository not available",
		})
		return
	}

	admin, err := h.adminRepo.FindByID(c, uid)
	if err != nil {
		ctx.JSON(404, map[string]interface{}{
			"success": false,
			"error":   "admin not found",
		})
		return
	}

	permissionCodes := []string{}
	if admin.Role != "super_admin" {
		if codes, err := h.adminRepo.GetAdminPermissionCodes(c, admin.ID); err == nil {
			permissionCodes = codes
		}
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":                   admin.ID,
			"email":                admin.Email,
			"username":             admin.Username,
			"role":                 admin.Role,
			"status":               admin.Status,
			"must_change_password": admin.MustChangePassword,
			"avatar_url":           admin.AvatarURL,
			"created_at":           admin.CreatedAt,
			"permission_codes":     permissionCodes,
		},
	})
}

// ChangePassword 修改当前管理员密码，并让旧 JWT 立即失效。
// POST /api/admin/auth/change-password
func (h *AdminAuthHandler) ChangePassword(c context.Context, ctx *app.RequestContext) {
	adminID, ok := stringContextValue(ctx, "admin_id")
	if !ok {
		ctx.JSON(401, map[string]interface{}{"success": false, "error": "unauthorized"})
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(400, map[string]interface{}{"success": false, "error": "invalid request body"})
		return
	}
	if req.CurrentPassword == "" || len(req.NewPassword) < 12 {
		ctx.JSON(400, map[string]interface{}{"success": false, "error": "current password and a new password of at least 12 characters are required"})
		return
	}

	admin, err := h.adminRepo.FindByID(c, adminID)
	if err != nil || admin == nil {
		ctx.JSON(401, map[string]interface{}{"success": false, "error": "admin not found"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		ctx.JSON(401, map[string]interface{}{"success": false, "error": "invalid current password"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.NewPassword)) == nil {
		ctx.JSON(400, map[string]interface{}{"success": false, "error": "new password must differ from the current password"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		ctx.JSON(500, map[string]interface{}{"success": false, "error": "failed to hash password"})
		return
	}
	admin.PasswordHash = string(hashedPassword)
	admin.MustChangePassword = false
	admin.AuthVersion = normalizedAdminAuthVersion(admin.AuthVersion) + 1
	if err := h.adminRepo.Update(c, admin); err != nil {
		ctx.JSON(500, map[string]interface{}{"success": false, "error": "failed to update password"})
		return
	}

	token, err := utils.GenerateAdminJWT(
		admin.ID,
		admin.Username,
		admin.Email,
		admin.Role,
		h.jwtCfg.Secret,
		h.jwtCfg.Expiry,
		admin.AuthVersion,
	)
	if err != nil {
		ctx.JSON(500, map[string]interface{}{"success": false, "error": "failed to generate token"})
		return
	}

	permissionCodes := []string{}
	if admin.Role != "super_admin" {
		if codes, err := h.adminRepo.GetAdminPermissionCodes(c, admin.ID); err == nil {
			permissionCodes = codes
		}
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"admin": map[string]interface{}{
				"id":                   admin.ID,
				"email":                admin.Email,
				"username":             admin.Username,
				"role":                 admin.Role,
				"status":               admin.Status,
				"must_change_password": false,
				"permission_codes":     permissionCodes,
			},
			"token":      token,
			"expires_in": h.jwtCfg.Expiry,
		},
	})
}

// RefreshToken 刷新管理员 Token
// POST /api/admin/auth/refresh
func (h *AdminAuthHandler) RefreshToken(c context.Context, ctx *app.RequestContext) {
	// 从当前 JWT 中获取 admin ID
	uid, ok := stringContextValue(ctx, "user_id")
	if !ok {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "unauthorized",
		})
		return
	}

	if h.adminRepo == nil {
		ctx.JSON(500, map[string]interface{}{
			"success": false,
			"error":   "admin repository not available",
		})
		return
	}

	admin, err := h.adminRepo.FindByID(c, uid)
	if err != nil {
		ctx.JSON(401, map[string]interface{}{
			"success": false,
			"error":   "admin not found",
		})
		return
	}

	token, err := utils.GenerateAdminJWT(
		admin.ID,
		admin.Username,
		admin.Email,
		admin.Role,
		h.jwtCfg.Secret,
		h.jwtCfg.Expiry,
		normalizedAdminAuthVersion(admin.AuthVersion),
	)
	if err != nil {
		ctx.JSON(500, map[string]interface{}{
			"success": false,
			"error":   "failed to generate token",
		})
		return
	}

	ctx.JSON(200, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"token":      token,
			"expires_in": h.jwtCfg.Expiry,
		},
	})
}

// GetUserIDFromContext 从 Context 中获取用户 ID (UUID string)
func GetUserIDFromContext(ctx *app.RequestContext) (string, bool) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		return "", false
	}

	// 支持多种类型
	switch v := userID.(type) {
	case string:
		return v, true
	default:
		return "", false
	}
}
