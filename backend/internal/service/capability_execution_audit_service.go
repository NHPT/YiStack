package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// CapabilityExecutionAuditService 提供项目级能力执行审计只读查询。
type CapabilityExecutionAuditService struct {
	repo CapabilityExecutionAuditRepo
}

type CapabilityExecutionAuditListOptions struct {
	ProjectID         string
	Status            string
	CapabilityProfile string
	Offset            int
	Limit             int
}

type CapabilityExecutionAuditListResult struct {
	Records []CapabilityExecutionAuditRecord `json:"records"`
	Total   int64                            `json:"total"`
	Offset  int                              `json:"offset"`
	Limit   int                              `json:"limit"`
}

type CapabilityExecutionAuditRecord struct {
	ID                 int64       `json:"id"`
	ProjectID          string      `json:"project_id"`
	UserID             string      `json:"user_id"`
	WorkflowStage      string      `json:"workflow_stage"`
	WorkflowMode       string      `json:"workflow_mode"`
	CapabilityProfile  string      `json:"capability_profile"`
	Status             string      `json:"status"`
	ProviderResolution interface{} `json:"provider_resolution"`
	ExecutionAudit     interface{} `json:"execution_audit"`
	ExecutionResult    interface{} `json:"execution_result"`
	SourceNote         string      `json:"source_note"`
	CreatedAt          time.Time   `json:"created_at"`
}

func NewCapabilityExecutionAuditService(repo CapabilityExecutionAuditRepo) *CapabilityExecutionAuditService {
	return &CapabilityExecutionAuditService{repo: repo}
}

func (s *CapabilityExecutionAuditService) ListByProject(ctx context.Context, options CapabilityExecutionAuditListOptions) (*CapabilityExecutionAuditListResult, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("capability execution audit service not available")
	}
	if options.Limit <= 0 {
		options.Limit = 50
	}
	if options.Limit > 100 {
		options.Limit = 100
	}
	if options.Offset < 0 {
		options.Offset = 0
	}

	records, total, err := s.repo.ListByProjectID(
		ctx,
		strings.TrimSpace(options.ProjectID),
		strings.TrimSpace(options.Status),
		strings.TrimSpace(options.CapabilityProfile),
		options.Offset,
		options.Limit,
	)
	if err != nil {
		return nil, err
	}

	result := &CapabilityExecutionAuditListResult{
		Records: make([]CapabilityExecutionAuditRecord, 0, len(records)),
		Total:   total,
		Offset:  options.Offset,
		Limit:   options.Limit,
	}
	for _, record := range records {
		result.Records = append(result.Records, CapabilityExecutionAuditRecord{
			ID:                 record.ID,
			ProjectID:          record.ProjectID,
			UserID:             record.UserID,
			WorkflowStage:      record.WorkflowStage,
			WorkflowMode:       record.WorkflowMode,
			CapabilityProfile:  record.CapabilityProfile,
			Status:             record.Status,
			ProviderResolution: parseCapabilityAuditJSON(record.ProviderResolution),
			ExecutionAudit:     parseCapabilityAuditJSON(record.ExecutionAudit),
			ExecutionResult:    parseCapabilityAuditJSON(record.ExecutionResult),
			SourceNote:         record.SourceNote,
			CreatedAt:          record.CreatedAt,
		})
	}
	return result, nil
}

func parseCapabilityAuditJSON(raw string) interface{} {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return map[string]interface{}{}
	}
	var decoded interface{}
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return map[string]interface{}{
			"parse_error": err.Error(),
			"raw":         raw,
		}
	}
	return decoded
}
