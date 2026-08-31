package handler

import (
	"errors"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/sse"

	"yistack/internal/orchestration"
	"yistack/internal/service"
)

func respondJSONError(ctx *app.RequestContext, statusCode int, payload map[string]any) {
	ctx.Response.Reset()
	ctx.JSON(statusCode, payload)
}

func buildGenerateStreamErrorPayload(err error) map[string]any {
	var foundationErr *orchestration.FoundationGateError
	if errors.As(err, &foundationErr) {
		payload := map[string]any{
			"code":             "foundation_gate_blocked",
			"blocking":         true,
			"gate":             foundationErr.Gate,
			"engineeringState": orchestrationPayload(foundationErr.State),
			"error":            err.Error(),
			"message":          "Project Foundation 尚未完成，当前阶段已被阻断。",
			"details":          err.Error(),
		}
		if foundationErr.State.BootstrapState != nil && foundationErr.State.BootstrapState.GateResult != nil {
			payload["gate_result"] = map[string]any{
				"decision":       foundationErr.State.BootstrapState.GateResult.Decision,
				"reasons":        foundationErr.State.BootstrapState.GateResult.Reasons,
				"blocking_items": foundationErr.State.BootstrapState.GateResult.BlockingItems,
				"warning_items":  foundationErr.State.BootstrapState.GateResult.WarningItems,
				"next_action":    foundationErr.State.BootstrapState.GateResult.NextAction,
			}
		}
		return payload
	}

	var validationErr *orchestration.ValidationGateError
	if errors.As(err, &validationErr) {
		return map[string]any{
			"code":             "validation_gate_blocked",
			"blocking":         true,
			"gate":             validationErr.Gate,
			"engineeringState": orchestrationPayload(validationErr.State),
			"error":            err.Error(),
			"message":          "YES 校验未通过，当前阶段已被阻断。",
			"details":          err.Error(),
		}
	}

	var capabilityErr *orchestration.CapabilityGateError
	if errors.As(err, &capabilityErr) {
		return map[string]any{
			"code":             "capability_execution_blocked",
			"blocking":         true,
			"engineeringState": orchestrationPayload(capabilityErr.State),
			"execution_result": capabilityExecutionResultPayload(capabilityErr.Result),
			"error":            err.Error(),
			"message":          "能力执行被阻断，当前阶段已暂停。",
			"details":          err.Error(),
		}
	}
	var generationErr *service.GenerationFailureError
	if errors.As(err, &generationErr) {
		payload := map[string]any{
			"code":     generationErr.Code,
			"blocking": true,
			"stage":    generationErr.Stage,
			"error":    generationErr.Error(),
			"message":  generationErr.Message,
			"details":  generationErr.Details,
		}
		if generationErr.Command != "" {
			payload["command"] = generationErr.Command
		}
		if generationErr.ExitCode != nil {
			payload["exit_code"] = *generationErr.ExitCode
		}
		if generationErr.Check != "" {
			payload["check"] = generationErr.Check
		}
		if generationErr.ValidationResult != nil {
			payload["project_validation"] = generationErr.ValidationResult
		}
		if generationErr.FileConflict != nil {
			payload["file_conflict"] = generationErr.FileConflict
		}
		if generationErr.RepairEvidence != nil {
			payload["repair"] = generationErr.RepairEvidence
		}
		if generationErr.BrowserAcceptance != nil {
			payload["browser_acceptance"] = generationErr.BrowserAcceptance
		}
		return payload
	}
	return map[string]any{
		"error":   err.Error(),
		"message": err.Error(),
	}
}

func orchestrationPayload(state orchestration.EngineeringState) map[string]any {
	return orchestration.EngineeringStatePayload(state)
}

func capabilityExecutionResultPayload(result orchestration.CapabilityExecutionResult) map[string]any {
	items := make([]map[string]any, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, map[string]any{
			"capability_id": item.CapabilityID,
			"provider":      item.Provider,
			"status":        item.Status,
			"reason_code":   item.ReasonCode,
			"source_note":   item.SourceNote,
			"metadata":      capabilityMetadataPayload(item.Metadata),
			"artifacts":     capabilityArtifactsPayload(item.Artifacts),
		})
	}

	return map[string]any{
		"status":             result.Status,
		"capability_profile": result.CapabilityProfile,
		"items":              items,
		"source_note":        result.SourceNote,
	}
}

func capabilityMetadataPayload(metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return map[string]any{}
	}
	return metadata
}

func capabilityArtifactsPayload(artifacts []orchestration.CapabilityExecutionArtifact) []map[string]any {
	items := make([]map[string]any, 0, len(artifacts))
	for _, artifact := range artifacts {
		items = append(items, map[string]any{
			"id":          artifact.ID,
			"type":        artifact.Type,
			"name":        artifact.Name,
			"uri":         artifact.URI,
			"source_note": artifact.SourceNote,
			"metadata":    capabilityMetadataPayload(artifact.Metadata),
		})
	}
	return items
}

func writeGenerateStreamError(writer *sse.Writer, err error) error {
	return writeSSEJSONEvent(writer, service.StreamEventError, buildGenerateStreamErrorPayload(err))
}

func writeGenerateServiceUnavailable(writer *sse.Writer) error {
	return writeSSEJSONEvent(writer, service.StreamEventError, map[string]any{
		"error":   "代码生成服务未初始化",
		"message": "请确保数据库已配置且 LLM 服务可用",
	})
}

func writeGeneratePlansStreamError(writer *sse.Writer, err error) error {
	var foundationErr *orchestration.FoundationGateError
	if errors.As(err, &foundationErr) {
		return writeSSEJSONEvent(writer, service.StreamEventError, buildGenerateStreamErrorPayload(err))
	}
	return writeSSEJSONEvent(writer, service.StreamEventError, map[string]any{
		"error":   "Failed to generate plans",
		"details": err.Error(),
		"message": err.Error(),
	})
}

func writeGeneratePlansDone(writer *sse.Writer, response *service.GeneratePlansResponse, analysis string) error {
	return writeSSEJSONEvent(writer, service.StreamEventDone, map[string]any{
		"success":            true,
		"plans":              response.Plans,
		"content":            analysis,
		"suggestedQuestions": response.SuggestedQuestions,
		"suggestedActions":   response.SuggestedActions,
	})
}
