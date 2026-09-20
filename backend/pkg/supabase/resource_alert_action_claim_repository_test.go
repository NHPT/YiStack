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

func TestProjectResourceAlertActionClaimUsesAtomicRPCs(t *testing.T) {
	now := time.Date(2026, 9, 19, 18, 0, 0, 0, time.UTC)
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		calls++
		if req.Header.Get("Authorization") != "Bearer service-key" {
			t.Fatalf("authorization header = %q", req.Header.Get("Authorization"))
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode RPC payload: %v", err)
		}
		switch req.URL.Path {
		case "/rest/v1/rpc/claim_project_resource_alert_action":
			if payload["p_project_id"] != "project-1" ||
				payload["p_source_event_id"] != float64(42) ||
				payload["p_action"] != "notification" ||
				payload["p_pending_status"] != "notification_pending" ||
				payload["p_message"] != "pending source_event_id=42" {
				t.Fatalf("unexpected claim payload: %#v", payload)
			}
			_, _ = w.Write([]byte(`[{"acquired":true,"status":"pending","event_id":43,"event_created_at":"2026-09-19T18:00:00Z"}]`))
		case "/rest/v1/rpc/complete_project_resource_alert_action":
			if payload["p_status"] != "succeeded" {
				t.Fatalf("unexpected completion payload: %#v", payload)
			}
			_, _ = w.Write([]byte(`[{"applied":true}]`))
		default:
			t.Fatalf("unexpected request path: %s", req.URL.Path)
		}
	}))
	defer server.Close()

	client, err := NewClient(&Config{
		URL:        server.URL,
		APIKey:     "anon-key",
		ServiceKey: "service-key",
	})
	if err != nil {
		t.Fatalf("create Supabase client: %v", err)
	}
	repo := (&SupabaseRepository{client: client}).ProjectResourceAlertEventRepository()
	claim := &model.ProjectResourceAlertActionClaim{
		ProjectID:     "project-1",
		SourceEventID: 42,
		Action:        "notification",
		Status:        "pending",
		ActorUserID:   "11111111-1111-1111-1111-111111111111",
		ClaimedAt:     now,
		UpdatedAt:     now,
	}
	pendingEvent := &model.ProjectResourceAlertEvent{
		ProjectID:           claim.ProjectID,
		UserID:              claim.ActorUserID,
		Status:              "notification_pending",
		EvaluationID:        "evaluation-1",
		ReadinessStatus:     "alerting",
		TriggeredCount:      1,
		TriggeredThresholds: "[]",
		Thresholds:          "[]",
		EvaluationPreview:   "{}",
		Message:             "pending source_event_id=42",
		Recovery:            "inspect",
		CreatedAt:           now,
	}
	acquired, err := repo.ClaimAction(context.Background(), claim, pendingEvent)
	if err != nil || !acquired || claim.Status != "pending" {
		t.Fatalf("ClaimAction() acquired=%v claim=%#v err=%v", acquired, claim, err)
	}
	if pendingEvent.ID != 43 || !pendingEvent.CreatedAt.Equal(now) {
		t.Fatalf("ClaimAction() pending event = %#v", pendingEvent)
	}
	if err := repo.CompleteAction(
		context.Background(),
		claim.ProjectID,
		claim.SourceEventID,
		claim.Action,
		"succeeded",
		now.Add(time.Second),
	); err != nil {
		t.Fatalf("CompleteAction() error = %v", err)
	}
	if calls != 2 {
		t.Fatalf("RPC call count = %d, want 2", calls)
	}
}
