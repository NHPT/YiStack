package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"yistack/internal/model"
)

type enterpriseSsoDiscoverySystemConfigRepo struct {
	values map[string]string
}

func (r *enterpriseSsoDiscoverySystemConfigRepo) Get(_ context.Context, key string) (*model.SystemConfig, error) {
	value, ok := r.values[key]
	if !ok {
		return nil, errors.New("config not found")
	}
	return &model.SystemConfig{Key: key, Value: value}, nil
}

func (r *enterpriseSsoDiscoverySystemConfigRepo) Set(_ context.Context, key, value string) error {
	r.values[key] = value
	return nil
}

func (r *enterpriseSsoDiscoverySystemConfigRepo) List(context.Context) ([]model.SystemConfig, error) {
	configs := make([]model.SystemConfig, 0, len(r.values))
	for key, value := range r.values {
		configs = append(configs, model.SystemConfig{Key: key, Value: value})
	}
	return configs, nil
}

func (r *enterpriseSsoDiscoverySystemConfigRepo) InitDefaults(context.Context) error {
	return nil
}

func TestEnterpriseSsoDiscoveryReadinessDisabledDoesNotCallUpstream(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	defer server.Close()

	service := NewAdminConsoleService(
		NewSystemConfigService(&enterpriseSsoDiscoverySystemConfigRepo{values: map[string]string{
			enterpriseSsoEnabledConfigKey:      "false",
			enterpriseSsoProviderTypeConfigKey: "oidc",
			enterpriseSsoIssuerURLConfigKey:    server.URL,
			enterpriseSsoClientIDConfigKey:     "client-a",
			enterpriseSsoRedirectURIConfigKey:  "https://app.example.test/callback",
		}}),
		nil,
		nil,
		nil,
		nil,
	)

	readiness, err := service.GetEnterpriseSsoDiscoveryReadiness(context.Background())
	if err != nil {
		t.Fatalf("GetEnterpriseSsoDiscoveryReadiness returned error: %v", err)
	}
	if readiness.Status != EnterpriseSsoDiscoveryDisabled || readiness.DiscoveryRequestPerformed {
		t.Fatalf("expected disabled readiness without discovery request, got %#v", readiness)
	}
	if called {
		t.Fatal("disabled SSO discovery should not call upstream")
	}
}

func TestEnterpriseSsoDiscoveryReadinessMissingConfigDoesNotCallUpstream(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	defer server.Close()

	service := NewAdminConsoleService(
		NewSystemConfigService(&enterpriseSsoDiscoverySystemConfigRepo{values: map[string]string{
			enterpriseSsoEnabledConfigKey:   "true",
			enterpriseSsoIssuerURLConfigKey: server.URL,
		}}),
		nil,
		nil,
		nil,
		nil,
	)

	readiness, err := service.GetEnterpriseSsoDiscoveryReadiness(context.Background())
	if err != nil {
		t.Fatalf("GetEnterpriseSsoDiscoveryReadiness returned error: %v", err)
	}
	if readiness.Status != EnterpriseSsoDiscoveryMissingConfig || readiness.DiscoveryRequestPerformed {
		t.Fatalf("expected missing_config readiness without discovery request, got %#v", readiness)
	}
	if called {
		t.Fatal("missing config SSO discovery should not call upstream")
	}
}

func TestEnterpriseSsoDiscoveryReadinessReady(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/openid-configuration" {
			t.Fatalf("expected discovery path, got %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"issuer":                   serverURLFromRequest(r),
			"authorization_endpoint":   serverURLFromRequest(r) + "/authorize",
			"token_endpoint":           serverURLFromRequest(r) + "/token",
			"jwks_uri":                 serverURLFromRequest(r) + "/jwks",
			"response_types_supported": []string{"code"},
			"scopes_supported":         []string{"openid", "email"},
		})
	}))
	defer server.Close()

	service := NewAdminConsoleService(
		NewSystemConfigService(&enterpriseSsoDiscoverySystemConfigRepo{values: map[string]string{
			enterpriseSsoEnabledConfigKey:      "true",
			enterpriseSsoProviderTypeConfigKey: "oidc",
			enterpriseSsoIssuerURLConfigKey:    server.URL,
			enterpriseSsoClientIDConfigKey:     "client-a",
			enterpriseSsoRedirectURIConfigKey:  "https://app.example.test/callback",
		}}),
		nil,
		nil,
		nil,
		nil,
	)

	readiness, err := service.getEnterpriseSsoDiscoveryReadinessWithClient(context.Background(), server.Client())
	if err != nil {
		t.Fatalf("getEnterpriseSsoDiscoveryReadinessWithClient returned error: %v", err)
	}
	if readiness.Status != EnterpriseSsoDiscoveryReady ||
		readiness.DiscoveryRequestPerformed == false ||
		readiness.AuthorizationEndpoint == "" ||
		readiness.TokenEndpoint == "" ||
		readiness.JWKSURI == "" {
		t.Fatalf("expected discovery ready, got %#v", readiness)
	}
	if readiness.LoginCallbackEnabled || readiness.SessionNormalizationEnabled || readiness.AdminAuditWriteEnabled {
		t.Fatalf("discovery readiness must not enable login/session/audit side effects: %#v", readiness)
	}
}

func TestEnterpriseSsoDiscoveryReadinessFailsOnIssuerMismatch(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"issuer":                 "https://other-issuer.example.test",
			"authorization_endpoint": serverURLFromRequest(r) + "/authorize",
			"token_endpoint":         serverURLFromRequest(r) + "/token",
			"jwks_uri":               serverURLFromRequest(r) + "/jwks",
		})
	}))
	defer server.Close()

	service := NewAdminConsoleService(
		NewSystemConfigService(&enterpriseSsoDiscoverySystemConfigRepo{values: map[string]string{
			enterpriseSsoEnabledConfigKey:      "true",
			enterpriseSsoProviderTypeConfigKey: "oidc",
			enterpriseSsoIssuerURLConfigKey:    server.URL,
			enterpriseSsoClientIDConfigKey:     "client-a",
			enterpriseSsoRedirectURIConfigKey:  "https://app.example.test/callback",
		}}),
		nil,
		nil,
		nil,
		nil,
	)

	readiness, err := service.getEnterpriseSsoDiscoveryReadinessWithClient(context.Background(), server.Client())
	if err != nil {
		t.Fatalf("getEnterpriseSsoDiscoveryReadinessWithClient returned error: %v", err)
	}
	if readiness.Status != EnterpriseSsoDiscoveryFailed {
		t.Fatalf("expected discovery_failed for issuer mismatch, got %#v", readiness)
	}
}

func serverURLFromRequest(r *http.Request) string {
	return "https://" + r.Host
}
