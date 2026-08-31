package handler

import (
	"context"

	"yistack/internal/model"
	"yistack/internal/service"
	pkgauth "yistack/pkg/auth"
)

// AuthSession 统一认证结果。
type AuthSession struct {
	User         *model.User
	Token        string
	ExpiresAt    int64
	ExpiresIn    int
	TokenType    string
	RefreshToken string
}

// AuthFacade 统一用户认证能力，屏蔽 Supabase 与传统数据库的差异。
type AuthFacade interface {
	Register(ctx context.Context, email, password, username string) (*AuthSession, error)
	Login(ctx context.Context, email, password string) (*AuthSession, error)
	RefreshToken(ctx context.Context, refreshToken string) (*AuthSession, error)
	GetUserByID(ctx context.Context, userID string) (*model.User, error)
	UpdateProfile(ctx context.Context, userID, username string) (*model.User, error)
	ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error
	Logout(ctx context.Context, refreshToken string) error
}

type supabaseAuthFacade struct {
	authService *pkgauth.SupabaseAuthService
}

func newSupabaseAuthFacade(authService *pkgauth.SupabaseAuthService) AuthFacade {
	return &supabaseAuthFacade{authService: authService}
}

func (f *supabaseAuthFacade) Register(ctx context.Context, email, password, username string) (*AuthSession, error) {
	resp, err := f.authService.Register(ctx, &pkgauth.RegisterRequest{
		Email:    email,
		Password: password,
		Username: username,
	})
	if err != nil {
		return nil, err
	}
	return authSessionFromSupabase(resp), nil
}

func (f *supabaseAuthFacade) Login(ctx context.Context, email, password string) (*AuthSession, error) {
	resp, err := f.authService.Login(ctx, &pkgauth.LoginRequest{
		Email:    email,
		Password: password,
	})
	if err != nil {
		return nil, err
	}
	return authSessionFromSupabase(resp), nil
}

func (f *supabaseAuthFacade) RefreshToken(ctx context.Context, refreshToken string) (*AuthSession, error) {
	resp, err := f.authService.RefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	return authSessionFromSupabase(resp), nil
}

func (f *supabaseAuthFacade) GetUserByID(ctx context.Context, userID string) (*model.User, error) {
	return f.authService.GetUserByID(ctx, userID)
}

func (f *supabaseAuthFacade) UpdateProfile(ctx context.Context, userID, username string) (*model.User, error) {
	updates := map[string]interface{}{}
	if username != "" {
		updates["username"] = username
	}
	return f.authService.UpdateUser(ctx, userID, updates)
}

func (f *supabaseAuthFacade) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	return f.authService.ChangePassword(ctx, userID, oldPassword, newPassword)
}

func (f *supabaseAuthFacade) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	return f.authService.RevokeRefreshToken(ctx, refreshToken)
}

type traditionalAuthFacade struct {
	authService *service.AuthService
}

func newTraditionalAuthFacade(authService *service.AuthService) AuthFacade {
	return &traditionalAuthFacade{authService: authService}
}

func (f *traditionalAuthFacade) Register(ctx context.Context, email, password, username string) (*AuthSession, error) {
	resp, err := f.authService.Register(ctx, &service.RegisterRequest{
		Email:    email,
		Password: password,
		Username: username,
	})
	if err != nil {
		return nil, err
	}
	return &AuthSession{
		User:      resp.User,
		Token:     resp.Token,
		ExpiresIn: 86400,
	}, nil
}

func (f *traditionalAuthFacade) Login(ctx context.Context, email, password string) (*AuthSession, error) {
	resp, err := f.authService.Login(ctx, &service.LoginRequest{
		Email:    email,
		Password: password,
	})
	if err != nil {
		return nil, err
	}
	return &AuthSession{
		User:      resp.User,
		Token:     resp.Token,
		ExpiresIn: 86400,
	}, nil
}

func (f *traditionalAuthFacade) RefreshToken(ctx context.Context, refreshToken string) (*AuthSession, error) {
	token, err := f.authService.RefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	return &AuthSession{
		Token:     token,
		ExpiresIn: 86400,
	}, nil
}

func (f *traditionalAuthFacade) GetUserByID(ctx context.Context, userID string) (*model.User, error) {
	return f.authService.GetUserByID(ctx, userID)
}

func (f *traditionalAuthFacade) UpdateProfile(ctx context.Context, userID, username string) (*model.User, error) {
	return f.authService.UpdateProfile(ctx, userID, username)
}

func (f *traditionalAuthFacade) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	return f.authService.ChangePassword(ctx, userID, oldPassword, newPassword)
}

func (f *traditionalAuthFacade) Logout(context.Context, string) error {
	return nil
}

func authSessionFromSupabase(resp *pkgauth.AuthResponse) *AuthSession {
	if resp == nil {
		return nil
	}
	user := resp.User
	return &AuthSession{
		User:         &user,
		Token:        resp.Token,
		ExpiresAt:    resp.ExpiresAt,
		ExpiresIn:    resp.ExpiresIn,
		TokenType:    resp.TokenType,
		RefreshToken: resp.RefreshToken,
	}
}
