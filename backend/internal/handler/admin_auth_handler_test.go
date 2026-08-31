package handler

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"golang.org/x/crypto/bcrypt"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/utils"
)

type adminAuthRepositoryStub struct {
	admin *model.Admin
}

func (r *adminAuthRepositoryStub) FindByEmail(context.Context, string) (*model.Admin, error) {
	return r.admin, nil
}

func (r *adminAuthRepositoryStub) FindByID(context.Context, string) (*model.Admin, error) {
	return r.admin, nil
}

func (r *adminAuthRepositoryStub) Update(_ context.Context, admin *model.Admin) error {
	copy := *admin
	r.admin = &copy
	return nil
}

func (r *adminAuthRepositoryStub) UpdateLastLogin(context.Context, string) error {
	return nil
}

func (r *adminAuthRepositoryStub) GetAdminPermissionCodes(context.Context, string) ([]string, error) {
	return nil, nil
}

func TestAdminChangePasswordClearsRequirementAndRotatesTokenVersion(t *testing.T) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	repo := &adminAuthRepositoryStub{admin: &model.Admin{
		ID:                 "admin-1",
		Email:              "admin@example.com",
		Username:           "admin",
		PasswordHash:       string(passwordHash),
		Role:               "super_admin",
		Status:             "active",
		MustChangePassword: true,
		AuthVersion:        1,
	}}
	jwtConfig := &config.JWTConfig{Secret: "test-admin-auth-secret", Expiry: 3600}
	handler := NewAdminAuthHandler(repo, jwtConfig)
	ctx := app.NewContext(0)
	ctx.Request.SetMethod("POST")
	ctx.Request.Header.SetContentTypeBytes([]byte("application/json"))
	ctx.Request.SetBodyString(`{"current_password":"admin123","new_password":"a-new-password-123"}`)
	ctx.Request.Header.SetContentLength(len(ctx.Request.Body()))
	ctx.Set("admin_id", "admin-1")

	handler.ChangePassword(context.Background(), ctx)

	if ctx.Response.StatusCode() != 200 {
		t.Fatalf("unexpected status %d: %s", ctx.Response.StatusCode(), ctx.Response.Body())
	}
	if repo.admin.MustChangePassword {
		t.Fatal("password change requirement was not cleared")
	}
	if repo.admin.AuthVersion != 2 {
		t.Fatalf("auth version = %d, want 2", repo.admin.AuthVersion)
	}
	if bcrypt.CompareHashAndPassword([]byte(repo.admin.PasswordHash), []byte("a-new-password-123")) != nil {
		t.Fatal("new password was not persisted")
	}

	var response struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if decodeErr := json.Unmarshal(ctx.Response.Body(), &response); decodeErr != nil {
		t.Fatalf("decode response: %v", decodeErr)
	}
	claims, err := utils.ValidateJWT(response.Data.Token, jwtConfig.Secret)
	if err != nil {
		t.Fatalf("validate rotated token: %v", err)
	}
	if claims.AuthVersion != 2 {
		t.Fatalf("token auth version = %d, want 2", claims.AuthVersion)
	}
}

func TestAdminChangePasswordRejectsCurrentPasswordReuse(t *testing.T) {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	repo := &adminAuthRepositoryStub{admin: &model.Admin{
		ID:                 "admin-1",
		PasswordHash:       string(passwordHash),
		Role:               "super_admin",
		Status:             "active",
		MustChangePassword: true,
		AuthVersion:        1,
	}}
	handler := NewAdminAuthHandler(repo, &config.JWTConfig{Secret: "test-admin-auth-secret", Expiry: 3600})
	ctx := app.NewContext(0)
	ctx.Request.SetMethod("POST")
	ctx.Request.Header.SetContentTypeBytes([]byte("application/json"))
	ctx.Request.SetBodyString(`{"current_password":"admin123","new_password":"admin123"}`)
	ctx.Request.Header.SetContentLength(len(ctx.Request.Body()))
	ctx.Set("admin_id", "admin-1")

	handler.ChangePassword(context.Background(), ctx)

	if ctx.Response.StatusCode() != 400 {
		t.Fatalf("unexpected status %d: %s", ctx.Response.StatusCode(), ctx.Response.Body())
	}
	if !repo.admin.MustChangePassword || repo.admin.AuthVersion != 1 {
		t.Fatal("rejected password reuse must not change admin authentication state")
	}
}
