package middleware

import (
	"context"
	"errors"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/utils"
)

type authMiddlewareUserLookupStub struct {
	user *model.User
	err  error
}

func (s *authMiddlewareUserLookupStub) FindByID(context.Context, string) (*model.User, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.user, nil
}

type authMiddlewareAdminLookupStub struct {
	admin *model.Admin
	err   error
}

func (s *authMiddlewareAdminLookupStub) FindByID(context.Context, string) (*model.Admin, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.admin, nil
}

func TestAuthRejectsValidTokenWhenUserNoLongerExists(t *testing.T) {
	token := mustAuthMiddlewareToken(t, "user-missing", "user")
	ctx := newAuthMiddlewareContext(token)
	handler := Auth(NewUserAuthConfig(testJWTConfig(), &authMiddlewareUserLookupStub{
		err: errors.New("user not found"),
	}))

	handler(context.Background(), ctx)

	if ctx.Response.StatusCode() != consts.StatusUnauthorized {
		t.Fatalf("expected unauthorized for deleted user token, got %d", ctx.Response.StatusCode())
	}
	if _, exists := ctx.Get("user_id"); exists {
		t.Fatalf("deleted user token must not populate user context")
	}
}

func TestAuthAcceptsValidTokenWhenUserIsActive(t *testing.T) {
	token := mustAuthMiddlewareToken(t, "user-active", "user")
	ctx := newAuthMiddlewareContext(token)
	handler := Auth(NewUserAuthConfig(testJWTConfig(), &authMiddlewareUserLookupStub{
		user: &model.User{ID: "user-active", Role: "user", Status: "active"},
	}))

	handler(context.Background(), ctx)

	userID, exists := ctx.Get("user_id")
	if exists == false || userID != "user-active" {
		t.Fatalf("expected active user context, got value=%#v exists=%v", userID, exists)
	}
}

func TestAuthRejectsValidTokenWhenUserIsDisabled(t *testing.T) {
	token := mustAuthMiddlewareToken(t, "user-disabled", "user")
	ctx := newAuthMiddlewareContext(token)
	handler := Auth(NewUserAuthConfig(testJWTConfig(), &authMiddlewareUserLookupStub{
		user: &model.User{ID: "user-disabled", Role: "user", Status: "banned"},
	}))

	handler(context.Background(), ctx)

	if ctx.Response.StatusCode() != consts.StatusUnauthorized {
		t.Fatalf("expected unauthorized for disabled user token, got %d", ctx.Response.StatusCode())
	}
	if _, exists := ctx.Get("user_id"); exists {
		t.Fatalf("disabled user token must not populate user context")
	}
}

func TestAuthRejectsAdminTokenOnUserEndpoint(t *testing.T) {
	token := mustAuthMiddlewareToken(t, "admin-1", "admin")
	ctx := newAuthMiddlewareContext(token)
	handler := Auth(NewUserAuthConfig(testJWTConfig(), &authMiddlewareUserLookupStub{
		user: &model.User{ID: "admin-1", Role: "user", Status: "active"},
	}))

	handler(context.Background(), ctx)

	if ctx.Response.StatusCode() != consts.StatusForbidden {
		t.Fatalf("expected forbidden for admin token on user endpoint, got %d", ctx.Response.StatusCode())
	}
	if _, exists := ctx.Get("user_id"); exists {
		t.Fatalf("admin token on user endpoint must not populate user context")
	}
}

func TestAuthRejectsValidAdminTokenWhenAdminNoLongerExists(t *testing.T) {
	token := mustAuthMiddlewareToken(t, "admin-missing", "admin")
	ctx := newAuthMiddlewareContext(token)
	handler := Auth(NewAdminAuthConfig(testJWTConfig(), &authMiddlewareAdminLookupStub{
		err: errors.New("admin not found"),
	}))

	handler(context.Background(), ctx)

	if ctx.Response.StatusCode() != consts.StatusUnauthorized {
		t.Fatalf("expected unauthorized for deleted admin token, got %d", ctx.Response.StatusCode())
	}
	if _, exists := ctx.Get("admin_id"); exists {
		t.Fatalf("deleted admin token must not populate admin context")
	}
}

func TestAuthAcceptsValidAdminTokenWhenAdminIsActive(t *testing.T) {
	token := mustAuthMiddlewareToken(t, "admin-active", "super_admin")
	ctx := newAuthMiddlewareContext(token)
	handler := Auth(NewAdminAuthConfig(testJWTConfig(), &authMiddlewareAdminLookupStub{
		admin: &model.Admin{ID: "admin-active", Role: "super_admin", Status: "active", AuthVersion: 1},
	}))

	handler(context.Background(), ctx)

	adminID, exists := ctx.Get("admin_id")
	if exists == false || adminID != "admin-active" {
		t.Fatalf("expected active admin context, got value=%#v exists=%v", adminID, exists)
	}
}

func TestAuthRejectsStaleAdminTokenAfterPasswordChange(t *testing.T) {
	token, err := utils.GenerateAdminJWT(
		"admin-active",
		"admin-active",
		"admin-active@example.com",
		"super_admin",
		testJWTConfig().Secret,
		testJWTConfig().Expiry,
		1,
	)
	if err != nil {
		t.Fatalf("failed to generate test token: %v", err)
	}
	ctx := newAuthMiddlewareContext(token)
	handler := Auth(NewAdminAuthConfig(testJWTConfig(), &authMiddlewareAdminLookupStub{
		admin: &model.Admin{ID: "admin-active", Role: "super_admin", Status: "active", AuthVersion: 2},
	}))

	handler(context.Background(), ctx)

	if ctx.Response.StatusCode() != consts.StatusUnauthorized {
		t.Fatalf("expected unauthorized for stale admin token, got %d", ctx.Response.StatusCode())
	}
}

func TestRequireAdminPasswordChangedRejectsDefaultPasswordSession(t *testing.T) {
	ctx := app.NewContext(0)
	ctx.Set("admin_must_change_password", true)

	RequireAdminPasswordChanged()(context.Background(), ctx)

	if ctx.Response.StatusCode() != consts.StatusForbidden {
		t.Fatalf("expected forbidden while password change is required, got %d", ctx.Response.StatusCode())
	}
}

func newAuthMiddlewareContext(token string) *app.RequestContext {
	ctx := app.NewContext(0)
	request := protocol.NewRequest("GET", "/api/project/list", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	request.CopyTo(&ctx.Request)
	return ctx
}

func mustAuthMiddlewareToken(t *testing.T, userID string, role string) string {
	t.Helper()
	var token string
	var err error
	if role == "admin" || role == "super_admin" {
		token, err = utils.GenerateAdminJWT(
			userID,
			userID,
			userID+"@example.com",
			role,
			testJWTConfig().Secret,
			testJWTConfig().Expiry,
			1,
		)
	} else {
		token, err = utils.GenerateJWT(userID, userID, userID+"@example.com", role, testJWTConfig().Secret, testJWTConfig().Expiry)
	}
	if err != nil {
		t.Fatalf("failed to generate test token: %v", err)
	}
	return token
}

func testJWTConfig() *config.JWTConfig {
	return &config.JWTConfig{
		Secret: "test-auth-secret",
		Expiry: 3600,
	}
}
