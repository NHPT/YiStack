package main

import (
	"context"
	"strings"
	"testing"

	"yistack/config"
)

func TestSupabaseProjectRefFromURL(t *testing.T) {
	tests := []struct {
		name    string
		rawURL  string
		want    string
		wantErr bool
	}{
		{name: "https URL", rawURL: "https://projectref.supabase.co", want: "projectref"},
		{name: "host only", rawURL: "projectref.supabase.co", want: "projectref"},
		{name: "with path", rawURL: "https://projectref.supabase.co/rest/v1", want: "projectref"},
		{name: "empty", rawURL: "", wantErr: true},
		{name: "wrong host", rawURL: "https://example.com", wantErr: true},
		{name: "spoofed host suffix", rawURL: "https://projectref.supabase.co.evil.test", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := supabaseProjectRefFromURL(tt.rawURL)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q", tt.rawURL)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("unexpected project ref: got %q want %q", got, tt.want)
			}
		})
	}
}

func TestBuildSupabaseDirectDatabaseConfigUsesPoolerAndDirectTargets(t *testing.T) {
	cfg := &config.Config{
		Database: config.DatabaseConfig{
			SupabaseURL:        "https://projectref.supabase.co",
			SupabaseDBPassword: "secret-password",
			SupabaseDBRegion:   "ap-southeast-2",
			MaxIdleConns:       3,
			MaxOpenConns:       7,
			ConnMaxLife:        11,
		},
	}

	pooler, err := buildSupabaseDirectDatabaseConfig(cfg, true)
	if err != nil {
		t.Fatalf("unexpected pooler config error: %v", err)
	}
	if pooler.Type != "postgres" ||
		pooler.Host != "aws-0-ap-southeast-2.pooler.supabase.com" ||
		pooler.Port != 6543 ||
		pooler.User != "postgres.projectref" ||
		pooler.Password != "secret-password" ||
		pooler.Database != "postgres" ||
		pooler.SSLMode != "require" ||
		pooler.MaxIdleConns != 3 ||
		pooler.MaxOpenConns != 7 ||
		pooler.ConnMaxLife != 11 {
		t.Fatalf("unexpected pooler config: %#v", pooler)
	}

	direct, err := buildSupabaseDirectDatabaseConfig(cfg, false)
	if err != nil {
		t.Fatalf("unexpected direct config error: %v", err)
	}
	if direct.Host != "db.projectref.supabase.com" || direct.Port != 5432 {
		t.Fatalf("unexpected direct config: %#v", direct)
	}
}

func TestBuildSupabaseDirectDatabaseConfigRequiresPasswordAndValidURL(t *testing.T) {
	if _, err := buildSupabaseDirectDatabaseConfig(&config.Config{
		Database: config.DatabaseConfig{SupabaseURL: "https://projectref.supabase.co"},
	}, true); err == nil || !strings.Contains(err.Error(), "SUPABASE_DB_PASSWORD") {
		t.Fatalf("expected missing password error, got %v", err)
	}

	if _, err := buildSupabaseDirectDatabaseConfig(&config.Config{
		Database: config.DatabaseConfig{
			SupabaseURL:        "https://example.com",
			SupabaseDBPassword: "secret-password",
		},
	}, true); err == nil || !strings.Contains(err.Error(), "expected <project-ref>.supabase.co") {
		t.Fatalf("expected invalid URL error, got %v", err)
	}
}

func TestSupabaseRESTOnlyDatabaseErrorIsActionableWithoutNotImplemented(t *testing.T) {
	adapter := &supabaseAdapter{}
	err := adapter.Create(context.Background(), struct{}{})
	if err == nil {
		t.Fatal("expected REST-only adapter error")
	}
	message := err.Error()
	if strings.Contains(message, "not implemented") {
		t.Fatalf("REST-only adapter error should not use not implemented wording: %q", message)
	}
	if !strings.Contains(message, "SUPABASE_DB_PASSWORD") || !strings.Contains(message, "direct PostgreSQL access") {
		t.Fatalf("REST-only adapter error should mention direct PostgreSQL access: %q", message)
	}
}
