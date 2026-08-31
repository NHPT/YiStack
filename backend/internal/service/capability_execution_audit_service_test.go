package service

import (
	"context"
	"testing"
	"time"

	"yistack/internal/model"
)

type stubCapabilityExecutionAuditRepo struct {
	projectID         string
	status            string
	capabilityProfile string
	offset            int
	limit             int
	records           []model.ProjectCapabilityExecutionAudit
	total             int64
}

func (r *stubCapabilityExecutionAuditRepo) ListByProjectID(_ context.Context, projectID, status, capabilityProfile string, offset, limit int) ([]model.ProjectCapabilityExecutionAudit, int64, error) {
	r.projectID = projectID
	r.status = status
	r.capabilityProfile = capabilityProfile
	r.offset = offset
	r.limit = limit
	return r.records, r.total, nil
}

func (r *stubCapabilityExecutionAuditRepo) DeleteByProjectID(_ context.Context, _ string) error {
	r.records = nil
	r.total = 0
	return nil
}

func TestCapabilityExecutionAuditServiceListByProjectNormalizesOptionsAndParsesJSON(t *testing.T) {
	createdAt := time.Date(2026, 7, 13, 12, 0, 0, 0, time.UTC)
	repo := &stubCapabilityExecutionAuditRepo{
		total: 1,
		records: []model.ProjectCapabilityExecutionAudit{
			{
				ID:                 7,
				ProjectID:          "project-1",
				UserID:             "user-1",
				WorkflowStage:      "implementation",
				WorkflowMode:       "execute",
				CapabilityProfile:  "implementation-mcp-dry-run-capability-profile",
				Status:             "blocked",
				ProviderResolution: `{"status":"blocked"}`,
				ExecutionAudit:     `{"items":[{"provider":"mcp"}]}`,
				ExecutionResult:    `{"status":"blocked"}`,
				SourceNote:         "审计查询测试",
				CreatedAt:          createdAt,
			},
		},
	}

	result, err := NewCapabilityExecutionAuditService(repo).ListByProject(context.Background(), CapabilityExecutionAuditListOptions{
		ProjectID:         " project-1 ",
		Status:            " blocked ",
		CapabilityProfile: " implementation-mcp-dry-run-capability-profile ",
		Offset:            -1,
		Limit:             200,
	})
	if err != nil {
		t.Fatalf("ListByProject returned error: %v", err)
	}

	if repo.projectID != "project-1" || repo.status != "blocked" || repo.capabilityProfile != "implementation-mcp-dry-run-capability-profile" {
		t.Fatalf("unexpected filters: project=%q status=%q profile=%q", repo.projectID, repo.status, repo.capabilityProfile)
	}
	if repo.offset != 0 || repo.limit != 100 {
		t.Fatalf("unexpected pagination: offset=%d limit=%d", repo.offset, repo.limit)
	}
	if result.Total != 1 || result.Offset != 0 || result.Limit != 100 || len(result.Records) != 1 {
		t.Fatalf("unexpected result summary: %+v", result)
	}
	if result.Records[0].CreatedAt != createdAt {
		t.Fatalf("unexpected created_at: %s", result.Records[0].CreatedAt)
	}
	providerResolution, ok := result.Records[0].ProviderResolution.(map[string]interface{})
	if !ok || providerResolution["status"] != "blocked" {
		t.Fatalf("provider resolution was not parsed: %#v", result.Records[0].ProviderResolution)
	}
}

func TestCapabilityExecutionAuditServiceListByProjectPreservesInvalidJSON(t *testing.T) {
	repo := &stubCapabilityExecutionAuditRepo{
		total: 1,
		records: []model.ProjectCapabilityExecutionAudit{
			{
				ID:                 8,
				ProjectID:          "project-1",
				ProviderResolution: "{invalid-json",
				ExecutionAudit:     "",
				ExecutionResult:    `{"status":"executed"}`,
			},
		},
	}

	result, err := NewCapabilityExecutionAuditService(repo).ListByProject(context.Background(), CapabilityExecutionAuditListOptions{
		ProjectID: "project-1",
	})
	if err != nil {
		t.Fatalf("ListByProject returned error: %v", err)
	}

	providerResolution, ok := result.Records[0].ProviderResolution.(map[string]interface{})
	if !ok || providerResolution["parse_error"] == "" || providerResolution["raw"] != "{invalid-json" {
		t.Fatalf("invalid JSON was not preserved: %#v", result.Records[0].ProviderResolution)
	}
	executionAudit, ok := result.Records[0].ExecutionAudit.(map[string]interface{})
	if !ok || len(executionAudit) != 0 {
		t.Fatalf("empty execution audit should decode as empty object: %#v", result.Records[0].ExecutionAudit)
	}
}
