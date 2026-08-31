package supabase

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"gorm.io/gorm"
)

func TestSupabaseTableGetRetriesTransientStatus(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodGet {
			t.Fatalf("unexpected request method: %s", req.Method)
		}
		if requests.Add(1) == 1 {
			http.Error(w, "temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"project_id":"project-retry"}]`))
	}))
	t.Cleanup(server.Close)

	client, err := NewClient(&Config{URL: server.URL, APIKey: "anon-key", ServiceKey: "service-key"})
	if err != nil {
		t.Fatalf("create Supabase client: %v", err)
	}
	result, err := client.AdminTable("projects").Eq("project_id", "project-retry").First()
	if err != nil {
		t.Fatalf("transient GET must recover: %v", err)
	}
	if requests.Load() != 2 || len(result.Data) != 1 {
		t.Fatalf("GET retry evidence: requests=%d result=%#v", requests.Load(), result)
	}
}

func TestSupabaseTablePostDoesNotRetryTransientStatus(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		http.Error(w, "temporarily unavailable", http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)

	client, err := NewClient(&Config{URL: server.URL, APIKey: "anon-key", ServiceKey: "service-key"})
	if err != nil {
		t.Fatalf("create Supabase client: %v", err)
	}
	if _, err := client.AdminTable("projects").Insert(map[string]any{"project_id": "project-no-retry"}); err == nil {
		t.Fatal("transient POST failure must be returned")
	}
	if requests.Load() != 1 {
		t.Fatalf("POST was replayed %d times", requests.Load())
	}
}

func TestSupabaseProjectLookupReturnsRecordNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	t.Cleanup(server.Close)

	client, err := NewClient(&Config{URL: server.URL, APIKey: "anon-key", ServiceKey: "service-key"})
	if err != nil {
		t.Fatalf("create Supabase client: %v", err)
	}
	_, err = NewSupabaseRepository(client).ProjectRepository().FindByProjectID(context.Background(), "missing-project")
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("missing project error = %v, want gorm.ErrRecordNotFound", err)
	}
}
