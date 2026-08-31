package service

import (
	"context"
	"testing"

	"yistack/internal/model"
)

type stubProjectMessageRepo struct {
	messages []model.ChatMessage
}

type stubEngineeringStateRepo struct {
	state *model.ProjectEngineeringState
	err   error
}

func (r *stubEngineeringStateRepo) UpsertSnapshot(_ context.Context, state *model.ProjectEngineeringState) error {
	r.state = state
	return r.err
}

func (r *stubEngineeringStateRepo) FindByProjectID(_ context.Context, _ string) (*model.ProjectEngineeringState, error) {
	if r.err != nil {
		return nil, r.err
	}
	if r.state == nil {
		return nil, nil
	}
	return r.state, nil
}

func (r *stubEngineeringStateRepo) DeleteByProjectID(_ context.Context, _ string) error {
	r.state = nil
	return r.err
}

func (r *stubProjectMessageRepo) Create(_ context.Context, msg *model.ChatMessage) error {
	if msg != nil {
		r.messages = append(r.messages, *msg)
	}
	return nil
}

func (r *stubProjectMessageRepo) ListByProjectID(_ context.Context, _ string) ([]model.ChatMessage, error) {
	return r.messages, nil
}

func (r *stubProjectMessageRepo) DeleteByProjectID(_ context.Context, _ string) error {
	r.messages = nil
	return nil
}

func TestGetLatestEngineeringStateSnapshot(t *testing.T) {
	repo := &stubProjectMessageRepo{
		messages: []model.ChatMessage{
			{Content: "普通聊天消息"},
			{Content: `{"kind":"workflow","content":"旧状态","engineeringState":{"bootstrap_state":{"status":"awaiting_confirmation"}}}`},
			{Content: `{"kind":"workflow","content":"新状态","engineeringState":{"bootstrap_state":{"status":"completed"},"execution":{"next_action":"进入 Plan 阶段"}}}`},
		},
	}
	svc := NewProjectMessageService(repo)

	snapshot, ok, err := svc.GetLatestEngineeringStateSnapshot(context.Background(), "project-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !ok {
		t.Fatal("expected latest engineering state snapshot")
	}

	bootstrapState, ok := snapshot["bootstrap_state"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected bootstrap_state snapshot, got %T", snapshot["bootstrap_state"])
	}
	if bootstrapState["status"] != "completed" {
		t.Fatalf("expected completed bootstrap state, got %v", bootstrapState["status"])
	}
	execution, ok := snapshot["execution"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected execution snapshot, got %T", snapshot["execution"])
	}
	if execution["next_action"] != "进入 Plan 阶段" {
		t.Fatalf("expected latest next action, got %v", execution["next_action"])
	}
}

func TestGetLatestEngineeringStateSnapshotPrefersProjectStateTable(t *testing.T) {
	repo := &stubProjectMessageRepo{
		messages: []model.ChatMessage{
			{Content: `{"kind":"workflow","engineeringState":{"workflow":{"status":"old"}}}`},
		},
	}
	stateRepo := &stubEngineeringStateRepo{
		state: &model.ProjectEngineeringState{
			ProjectID: "project-1",
			State:     `{"workflow":{"status":"new"},"execution":{"next_action":"继续执行"}}`,
		},
	}
	svc := NewProjectMessageService(repo, stateRepo)

	snapshot, ok, err := svc.GetLatestEngineeringStateSnapshot(context.Background(), "project-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !ok {
		t.Fatal("expected engineering state snapshot")
	}

	workflow, ok := snapshot["workflow"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected workflow snapshot, got %T", snapshot["workflow"])
	}
	if workflow["status"] != "new" {
		t.Fatalf("expected project state table snapshot, got %v", workflow["status"])
	}
}
