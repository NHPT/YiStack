package supabase

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"yistack/internal/model"
)

func TestSupabaseProjectCreateUsesNullForEmptyPreviewShareID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost || req.URL.Path != "/rest/v1/projects" {
			t.Fatalf("unexpected request: %s %s", req.Method, req.URL.Path)
		}
		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode project payload: %v", err)
		}
		if value, exists := payload["preview_share_id"]; !exists || value != nil {
			t.Fatalf("preview_share_id must be null before sharing is enabled: %#v", payload)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	t.Cleanup(server.Close)

	client, err := NewClient(&Config{URL: server.URL, APIKey: "anon-key", ServiceKey: "service-key"})
	if err != nil {
		t.Fatalf("create Supabase client: %v", err)
	}
	project := &model.Project{
		UserID:         "11111111-1111-1111-1111-111111111111",
		ProjectID:      "project-null-preview-share",
		Name:           "Project",
		PreviewShareID: "   ",
	}
	if err := NewSupabaseRepository(client).ProjectRepository().Create(context.Background(), project); err != nil {
		t.Fatalf("create project: %v", err)
	}
}
