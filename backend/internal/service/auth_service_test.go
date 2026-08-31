package service

import (
	"context"
	"errors"
	"testing"

	"yistack/config"
	"yistack/internal/model"
)

type authServiceUserRepoStub struct {
	created *model.User
}

func (r *authServiceUserRepoStub) Create(ctx context.Context, user *model.User) error {
	r.created = user
	return nil
}

func (r *authServiceUserRepoStub) FindByID(ctx context.Context, id string) (*model.User, error) {
	return nil, errors.New("not found")
}

func (r *authServiceUserRepoStub) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	return nil, errors.New("not found")
}

func (r *authServiceUserRepoStub) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	return nil, errors.New("not found")
}

func (r *authServiceUserRepoStub) Update(ctx context.Context, user *model.User) error {
	return nil
}

func (r *authServiceUserRepoStub) UpdateLLMConfig(ctx context.Context, userID string, llmModel, temperature string, maxTokens int) error {
	return nil
}

func (r *authServiceUserRepoStub) List(ctx context.Context, offset, limit int) ([]model.User, int64, error) {
	return nil, 0, nil
}

func TestAuthServiceRegisterAssignsUserID(t *testing.T) {
	repo := &authServiceUserRepoStub{}
	auth := NewAuthService(repo, &config.JWTConfig{
		Secret: "test-secret",
		Expiry: 3600,
	})

	response, err := auth.Register(context.Background(), &RegisterRequest{
		Email:    "lt02@example.test",
		Password: "password123",
		Username: "lt02",
	})
	if err != nil {
		t.Fatalf("expected register to succeed, got %v", err)
	}
	if response.User.ID == "" {
		t.Fatal("expected response user id")
	}
	if repo.created == nil || repo.created.ID == "" {
		t.Fatal("expected persisted user id")
	}
	if response.Token == "" {
		t.Fatal("expected registration token")
	}
}
