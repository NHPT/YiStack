package handler

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
	"github.com/cloudwego/hertz/pkg/route/param"

	"yistack/internal/model"
	"yistack/internal/service"
)

func TestGenerationEventCursorUsesHighestValidCursor(t *testing.T) {
	ctx := app.NewContext(0)
	ctx.Request.SetRequestURI("/api/project/project-1/generation/events?cursor=7")
	ctx.Request.Header.Set("Last-Event-ID", "11")
	if cursor := generationEventCursor(ctx); cursor != 11 {
		t.Fatalf("cursor = %d, want 11", cursor)
	}

	ctx.Request.SetRequestURI("/api/project/project-1/generation/events?cursor=13")
	ctx.Request.Header.Set("Last-Event-ID", "invalid")
	if cursor := generationEventCursor(ctx); cursor != 13 {
		t.Fatalf("cursor = %d, want 13", cursor)
	}
}

func TestGenerationSSEPayloadIncludesJobMetadata(t *testing.T) {
	payload := generationSSEPayload(model.GenerationEvent{
		ID: 1, JobID: "11111111-1111-1111-1111-111111111111", ProjectID: "project-1",
		Sequence: 9, EventKey: "event:000009:progress", EventType: "progress",
		Payload: `{"message":"running"}`,
	})
	var decoded map[string]interface{}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("decode generation SSE payload: %v", err)
	}
	if decoded["generation_job_id"] != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("generation job id = %#v", decoded["generation_job_id"])
	}
	if decoded["generation_event_sequence"] != float64(9) {
		t.Fatalf("generation event sequence = %#v", decoded["generation_event_sequence"])
	}
	if decoded["generation_event_key"] != "event:000009:progress" || decoded["message"] != "running" {
		t.Fatalf("unexpected generation event payload: %#v", decoded)
	}
}

type generationJobOwnershipProjectRepo struct {
	project model.Project
}

func (r *generationJobOwnershipProjectRepo) Create(context.Context, *model.Project) error { return nil }
func (r *generationJobOwnershipProjectRepo) FindByID(context.Context, string) (*model.Project, error) {
	return &r.project, nil
}
func (r *generationJobOwnershipProjectRepo) FindByProjectID(_ context.Context, projectID string) (*model.Project, error) {
	if r.project.ProjectID != projectID {
		return nil, nil
	}
	project := r.project
	return &project, nil
}
func (r *generationJobOwnershipProjectRepo) FindByPreviewShareID(context.Context, string) (*model.Project, error) {
	return nil, nil
}
func (r *generationJobOwnershipProjectRepo) ListByUserID(context.Context, string, int, int) ([]model.Project, int64, error) {
	return nil, 0, nil
}
func (r *generationJobOwnershipProjectRepo) ListAll(context.Context, int, int) ([]model.Project, int64, error) {
	return nil, 0, nil
}
func (r *generationJobOwnershipProjectRepo) Update(context.Context, *model.Project) error { return nil }
func (r *generationJobOwnershipProjectRepo) UpdateFields(context.Context, string, map[string]interface{}) error {
	return nil
}
func (r *generationJobOwnershipProjectRepo) UpdateContainerInfo(context.Context, string, string, string, string, int, string) error {
	return nil
}
func (r *generationJobOwnershipProjectRepo) UpdateContainerStatus(context.Context, string, string) error {
	return nil
}
func (r *generationJobOwnershipProjectRepo) UpdateFileTree(context.Context, string, string) error {
	return nil
}
func (r *generationJobOwnershipProjectRepo) UpdateDirectoryPath(context.Context, string, string) error {
	return nil
}
func (r *generationJobOwnershipProjectRepo) UpdatePlanData(context.Context, string, string, string) error {
	return nil
}
func (r *generationJobOwnershipProjectRepo) SoftDelete(context.Context, string) error { return nil }
func (r *generationJobOwnershipProjectRepo) RestoreDeleted(context.Context, string) error {
	return nil
}
func (r *generationJobOwnershipProjectRepo) RestoreDeletedByOwner(context.Context, string, string) (*model.Project, error) {
	return nil, nil
}
func (r *generationJobOwnershipProjectRepo) HardDelete(context.Context, string) error { return nil }

func TestGetGenerationEventsRejectsNonOwnerBeforeReplay(t *testing.T) {
	projectService := service.NewProjectService(service.ProjectServiceOptions{
		ProjectRepo: &generationJobOwnershipProjectRepo{project: model.Project{
			ID: "record-1", ProjectID: "project-1", UserID: "owner-1",
		}},
	})
	handler := NewProjectHandler(projectService, nil, nil, nil, nil, nil)
	ctx := app.NewContext(1)
	ctx.Params = append(ctx.Params, param.Param{Key: "id", Value: "project-1"})
	ctx.Set("user_id", "other-user")

	handler.GetGenerationEvents(context.Background(), ctx)
	if ctx.Response.StatusCode() != consts.StatusForbidden {
		t.Fatalf("status = %d, want %d; body=%s", ctx.Response.StatusCode(), consts.StatusForbidden, ctx.Response.Body())
	}
}
