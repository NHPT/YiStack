package handler

import (
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestPreviewAccessTokenRoundTrip(t *testing.T) {
	token, err := issuePreviewAccessToken("proj_123", "user_456", "secret", 5*time.Minute)
	if err != nil {
		t.Fatalf("issue preview token: %v", err)
	}

	userID, err := validatePreviewAccessToken(token, "proj_123", "secret")
	if err != nil {
		t.Fatalf("validate preview token: %v", err)
	}
	if userID != "user_456" {
		t.Fatalf("expected user_456, got %s", userID)
	}

	projectID, ok := projectIDFromPreviewAccessToken(token, "secret")
	if !ok {
		t.Fatal("expected project id to be readable from signed preview token")
	}
	if projectID != "proj_123" {
		t.Fatalf("expected proj_123, got %s", projectID)
	}
}

func TestPreviewProjectIDCanBeReadFromExpiredTokenForErrorClassification(t *testing.T) {
	now := time.Now()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, previewAccessClaims{
		UserID:    "user_expired",
		ProjectID: "proj_expired",
		Scope:     "preview",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user_expired",
			IssuedAt:  jwt.NewNumericDate(now.Add(-20 * time.Minute)),
			NotBefore: jwt.NewNumericDate(now.Add(-20 * time.Minute)),
			ExpiresAt: jwt.NewNumericDate(now.Add(-10 * time.Minute)),
		},
	}).SignedString([]byte("secret"))
	if err != nil {
		t.Fatalf("issue expired preview token: %v", err)
	}

	projectID, ok := projectIDFromPreviewAccessToken(token, "secret")
	if !ok {
		t.Fatal("expected project id to be readable from expired preview token")
	}
	if projectID != "proj_expired" {
		t.Fatalf("expected proj_expired, got %s", projectID)
	}

	if _, err := validatePreviewAccessToken(token, "proj_expired", "secret"); err == nil {
		t.Fatal("expected expired token validation to fail")
	}
}

func TestAttachPreviewToken(t *testing.T) {
	signed := attachPreviewToken("/preview", "abc123")
	if !strings.Contains(signed, "preview_token=abc123") {
		t.Fatalf("expected preview token in url, got %s", signed)
	}
	if strings.Contains(signed, "project=proj_123") {
		t.Fatalf("signed preview url should not expose enumerable project id, got %s", signed)
	}
}

func TestRewritePreviewRedirectLocationKeepsPreviewNamespace(t *testing.T) {
	targetURL, err := url.Parse("http://127.0.0.1:3000")
	if err != nil {
		t.Fatalf("parse target url: %v", err)
	}

	location := rewritePreviewRedirectLocation("/zh", targetURL, "proj_redirect", false)

	if location != "/preview/zh?project=proj_redirect" {
		t.Fatalf("expected preview namespaced redirect, got %q", location)
	}
}

func TestRewritePreviewRedirectLocationLeavesExternalRedirect(t *testing.T) {
	targetURL, err := url.Parse("http://127.0.0.1:3000")
	if err != nil {
		t.Fatalf("parse target url: %v", err)
	}

	location := rewritePreviewRedirectLocation("https://example.com/zh", targetURL, "proj_redirect", false)

	if location != "https://example.com/zh" {
		t.Fatalf("expected external redirect to stay unchanged, got %q", location)
	}
}
