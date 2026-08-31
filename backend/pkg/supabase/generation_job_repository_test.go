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

func newGenerationJobRepositoryTestClient(t *testing.T, handler http.HandlerFunc) *GenerationJobRepository {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := NewClient(&Config{URL: server.URL, APIKey: "anon-key", ServiceKey: "service-key"})
	if err != nil {
		t.Fatalf("create Supabase client: %v", err)
	}
	return (&SupabaseRepository{client: client}).GenerationJobRepository()
}

func TestSupabaseGenerationJobAppendEventUsesAtomicRPC(t *testing.T) {
	now := time.Date(2026, 8, 19, 15, 0, 0, 0, time.UTC)
	repo := newGenerationJobRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/rest/v1/rpc/append_generation_event" {
			t.Fatalf("request path = %q", req.URL.Path)
		}
		if req.Header.Get("Authorization") != "Bearer service-key" {
			t.Fatalf("authorization header = %q", req.Header.Get("Authorization"))
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode RPC payload: %v", err)
		}
		if payload["p_job_id"] != "11111111-1111-1111-1111-111111111111" || payload["p_event_key"] != "event:000001:progress" {
			t.Fatalf("unexpected RPC payload: %#v", payload)
		}
		if _, ok := payload["p_payload"].(map[string]interface{}); !ok {
			t.Fatalf("event payload is not JSON object: %#v", payload["p_payload"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{
			"id":1,
			"job_id":"11111111-1111-1111-1111-111111111111",
			"project_id":"project-1",
			"sequence":1,
			"event_key":"event:000001:progress",
			"event_type":"progress",
			"payload":{"message":"running"},
			"created_at":"2026-08-19T15:00:00Z",
			"created":true
		}]`))
	})

	event, created, err := repo.AppendEvent(
		context.Background(), "11111111-1111-1111-1111-111111111111",
		"event:000001:progress", "progress", `{"message":"running"}`, now,
	)
	if err != nil {
		t.Fatalf("append generation event: %v", err)
	}
	if !created || event.Sequence != 1 || event.ProjectID != "project-1" {
		t.Fatalf("unexpected append result: created=%v event=%#v", created, event)
	}
}

func TestSupabaseGenerationJobCompleteUsesAtomicTerminalRPC(t *testing.T) {
	now := time.Date(2026, 8, 19, 15, 5, 0, 0, time.UTC)
	repo := newGenerationJobRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/rest/v1/rpc/transition_generation_job_terminal" {
			t.Fatalf("request path = %q", req.URL.Path)
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode RPC payload: %v", err)
		}
		if payload["p_worker_id"] != "worker-1" || payload["p_status"] != model.GenerationJobStatusSucceeded {
			t.Fatalf("unexpected terminal RPC payload: %#v", payload)
		}
		if payload["p_event_type"] != string(model.GenerationEventTypeDone) {
			t.Fatalf("terminal event type = %#v", payload["p_event_type"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"applied":true}]`))
	})

	applied, err := repo.CompleteJob(context.Background(), "11111111-1111-1111-1111-111111111111", "worker-1", model.GenerationJobCompletion{
		Status: model.GenerationJobStatusSucceeded, ResultSummary: `{"message":"done"}`,
		EventType: string(model.GenerationEventTypeDone), EventPayload: `{"message":"done"}`, CompletedAt: now,
	})
	if err != nil {
		t.Fatalf("complete generation job: %v", err)
	}
	if !applied {
		t.Fatal("terminal transition was not applied")
	}
}

func TestSupabaseGenerationJobHeartbeatUsesLeaseCASRPC(t *testing.T) {
	now := time.Date(2026, 8, 19, 15, 5, 0, 0, time.UTC)
	leaseUntil := now.Add(30 * time.Second)
	repo := newGenerationJobRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/rest/v1/rpc/heartbeat_generation_job_lease" {
			t.Fatalf("request path = %q", req.URL.Path)
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode RPC payload: %v", err)
		}
		if payload["p_worker_id"] != "worker-1" || payload["p_job_id"] != "11111111-1111-1111-1111-111111111111" {
			t.Fatalf("unexpected heartbeat RPC payload: %#v", payload)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"applied":true}]`))
	})

	applied, err := repo.HeartbeatJobLease(
		context.Background(),
		"11111111-1111-1111-1111-111111111111",
		"worker-1",
		leaseUntil,
		now,
	)
	if err != nil {
		t.Fatalf("heartbeat generation job: %v", err)
	}
	if !applied {
		t.Fatal("heartbeat lease CAS was not applied")
	}
}

func TestSupabaseGenerationJobInterruptStaleUsesObservedLeaseVersion(t *testing.T) {
	now := time.Date(2026, 8, 19, 15, 5, 0, 0, time.UTC)
	jobID := "11111111-1111-1111-1111-111111111111"
	rpcCalled := false
	repo := newGenerationJobRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch req.URL.Path {
		case "/rest/v1/generation_jobs":
			_, _ = w.Write([]byte(`[{
				"id":"` + jobID + `",
				"project_id":"project-1",
				"user_id":"22222222-2222-2222-2222-222222222222",
				"idempotency_key":"message-1",
				"status":"running",
				"lease_version":4,
				"lease_expires_at":"2026-08-19T15:04:00Z",
				"created_at":"2026-08-19T15:00:00Z",
				"updated_at":"2026-08-19T15:04:00Z"
			}]`))
		case "/rest/v1/rpc/interrupt_stale_generation_job":
			rpcCalled = true
			var payload map[string]interface{}
			if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
				t.Fatalf("decode RPC payload: %v", err)
			}
			if payload["p_expected_lease_version"] != float64(4) {
				t.Fatalf("unexpected stale lease version: %#v", payload)
			}
			_, _ = w.Write([]byte(`[{"applied":false}]`))
		default:
			t.Fatalf("request path = %q", req.URL.Path)
		}
	})

	interrupted, err := repo.InterruptStaleJobs(context.Background(), "worker-2", now)
	if err != nil {
		t.Fatalf("interrupt stale generation jobs: %v", err)
	}
	if interrupted != 0 || !rpcCalled {
		t.Fatalf("expected renewed lease CAS to reject stale interrupt: interrupted=%d rpc=%v", interrupted, rpcCalled)
	}
}

func TestSupabaseGenerationJobMappingPreservesDurableState(t *testing.T) {
	job := mapGenerationJob(map[string]interface{}{
		"id": "11111111-1111-1111-1111-111111111111", "project_id": "project-1",
		"user_id": "22222222-2222-2222-2222-222222222222", "idempotency_key": "message-1",
		"status": model.GenerationJobStatusValidating, "event_sequence": "42", "lease_version": float64(3),
		"current_attempt": float64(2), "request_payload": map[string]interface{}{"prompt": "build"},
		"result_summary": map[string]interface{}{}, "lease_expires_at": "2026-08-19T15:10:00Z",
		"created_at": "2026-08-19T15:00:00Z", "updated_at": "2026-08-19T15:01:00Z",
	})
	if job.EventSequence != 42 || job.LeaseVersion != 3 || job.CurrentAttempt != 2 {
		t.Fatalf("durable counters were not mapped: %#v", job)
	}
	if job.LeaseExpiresAt == nil || job.RequestPayload != `{"prompt":"build"}` {
		t.Fatalf("durable payload or lease was not mapped: %#v", job)
	}
}

func TestSupabaseGenerationJobCreateAttemptUsesAtomicRPC(t *testing.T) {
	now := time.Date(2026, 8, 19, 15, 2, 0, 0, time.UTC)
	repo := newGenerationJobRepositoryTestClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/rest/v1/rpc/create_generation_attempt" {
			t.Fatalf("request path = %q", req.URL.Path)
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("decode RPC payload: %v", err)
		}
		if payload["p_attempt_number"] != float64(2) || payload["p_kind"] != model.GenerationAttemptKindRepair {
			t.Fatalf("unexpected attempt RPC payload: %#v", payload)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"id":"33333333-3333-3333-3333-333333333333"}]`))
	})

	attempt := &model.GenerationAttempt{
		ID: "33333333-3333-3333-3333-333333333333", JobID: "11111111-1111-1111-1111-111111111111",
		AttemptNumber: 2, Kind: model.GenerationAttemptKindRepair, Status: model.GenerationJobStatusRunning,
		InputSnapshot: `{}`, ResultSummary: `{}`, StartedAt: now, CreatedAt: now, UpdatedAt: now,
	}
	if err := repo.CreateAttempt(context.Background(), attempt); err != nil {
		t.Fatalf("create generation attempt: %v", err)
	}
}
