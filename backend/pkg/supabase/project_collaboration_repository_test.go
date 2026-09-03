package supabase

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"yistack/internal/model"
)

func newProjectCollaborationRepositoryTestClient(
	t *testing.T,
	handler http.HandlerFunc,
) *ProjectCollaborationRepository {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := NewClient(&Config{
		URL: server.URL, APIKey: "anon-key", ServiceKey: "service-key",
	})
	if err != nil {
		t.Fatalf("create Supabase client: %v", err)
	}
	return NewSupabaseRepository(client).ProjectCollaborationRepository()
}

func TestSupabaseProjectCollaborationTouchUsesAtomicRPC(t *testing.T) {
	now := time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)
	repo := newProjectCollaborationRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost || req.URL.Path != "/rest/v1/rpc/touch_project_collaboration_session" {
			t.Fatalf("unexpected request: %s %s", req.Method, req.URL.Path)
		}
		if req.Header.Get("Authorization") != "Bearer service-key" {
			t.Fatalf("authorization header = %q", req.Header.Get("Authorization"))
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode touch payload: %v", err)
		}
		if payload["p_project_id"] != "project-1" ||
			payload["p_client_id"] != "web-client-1" ||
			payload["p_event_type"] != "presence_joined" ||
			payload["p_emit_event"] != true {
			t.Fatalf("unexpected touch payload: %#v", payload)
		}
		if eventPayload, ok := payload["p_event_payload"].(map[string]interface{}); !ok || eventPayload["role"] != "editor" {
			t.Fatalf("event payload must remain structured JSON: %#v", payload["p_event_payload"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	})

	session := &model.ProjectCollaborationSession{
		ID: "11111111-1111-1111-1111-111111111111", ProjectID: "project-1",
		UserID: "22222222-2222-2222-2222-222222222222", ClientID: "web-client-1",
		Role: "editor", Activity: "editing", CurrentFile: "src/app.tsx",
		Status: "active", JoinedAt: now, LastSeenAt: now, ExpiresAt: now.Add(45 * time.Second), UpdatedAt: now,
	}
	event := &model.ProjectCollaborationEvent{
		ID: "33333333-3333-3333-3333-333333333333", ProjectID: "project-1",
		ActorUserID: session.UserID, SessionID: session.ID, EventType: "presence_joined",
		ResourcePath: session.CurrentFile, PayloadJSON: `{"role":"editor"}`, CreatedAt: now,
	}
	if err := repo.UpsertCollaborationSessionWithEvent(context.Background(), session, event); err != nil {
		t.Fatalf("touch collaboration session: %v", err)
	}
}

func TestSupabaseProjectCollaborationLeaveUsesAtomicRPC(t *testing.T) {
	now := time.Date(2026, 9, 2, 12, 5, 0, 0, time.UTC)
	repo := newProjectCollaborationRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/rest/v1/rpc/leave_project_collaboration_session" {
			t.Fatalf("request path = %q", req.URL.Path)
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode leave payload: %v", err)
		}
		if payload["p_project_id"] != "project-1" ||
			payload["p_client_id"] != "web-client-1" ||
			payload["p_event_type"] != "presence_left" {
			t.Fatalf("unexpected leave payload: %#v", payload)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	})

	event := &model.ProjectCollaborationEvent{
		ID:        "33333333-3333-3333-3333-333333333333",
		EventType: "presence_left", PayloadJSON: `{}`,
	}
	if err := repo.LeaveCollaborationSessionWithEvent(
		context.Background(),
		"project-1",
		"22222222-2222-2222-2222-222222222222",
		"web-client-1",
		now,
		event,
	); err != nil {
		t.Fatalf("leave collaboration session: %v", err)
	}
}

func TestSupabaseProjectCollaborationExpiryUsesAtomicRPC(t *testing.T) {
	now := time.Date(2026, 9, 2, 12, 10, 0, 0, time.UTC)
	repo := newProjectCollaborationRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/rest/v1/rpc/expire_project_collaboration_sessions" {
			t.Fatalf("request path = %q", req.URL.Path)
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode expiry payload: %v", err)
		}
		if payload["p_project_id"] != "project-1" || payload["p_expired_at"] == nil {
			t.Fatalf("unexpected expiry payload: %#v", payload)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	})

	if err := repo.ExpireCollaborationSessions(context.Background(), "project-1", now); err != nil {
		t.Fatalf("expire collaboration sessions: %v", err)
	}
}
