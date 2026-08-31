package service

import (
	"context"
	"fmt"
	"strings"
)

const generationStringifiedOperationSeparator = `},"{"operation`

func normalizeGenerationResultWireFormat(rawContent string) (string, int) {
	count := strings.Count(rawContent, generationStringifiedOperationSeparator)
	if count == 0 {
		return rawContent, 0
	}
	return strings.ReplaceAll(
		rawContent,
		generationStringifiedOperationSeparator,
		`},{"operation`,
	), count
}

func (s *GeneratorService) completeGenerationArtifactsStage(
	ctx context.Context,
	req *GenerateRequest,
	runtimeStage generationRuntimeStageResult,
	contentStage generationContentStageResult,
	workflowStage string,
	handler StreamEventHandler,
) error {
	_ = handler(StreamEventProgress, map[string]interface{}{
		"progress": 60,
		"message":  "正在校验生成结果...",
	})

	rawContent, normalizedSeparators := normalizeGenerationResultWireFormat(
		contentStage.rawContent,
	)
	schemaAttempt := contentStage.schemaAttempt
	if schemaAttempt < 1 {
		schemaAttempt = 1
	}
	schemaMaxAttempts := contentStage.schemaMaxAttempts
	if schemaMaxAttempts < schemaAttempt {
		schemaMaxAttempts = schemaAttempt
	}
	if normalizedSeparators > 0 {
		_ = emitWorkflowStep(handler, "generation-result-normalization", "status_update", "规范化生成结果", "已修正误编码的 operations 对象分隔符，继续执行严格协议校验。", "done", map[string]interface{}{
			"reason_code":          "stringified_operation_separator",
			"normalized_separator": normalizedSeparators,
			"schema_attempt":       schemaAttempt,
			"schema_max_attempts":  schemaMaxAttempts,
		})
	}
	genResult, decodeErr := decodeGenerationResult(rawContent)
	if decodeErr != nil {
		_ = emitWorkflowStep(handler, "generation-result-validation", "status_update", "校验生成结果协议", decodeErr.Error(), "failed", map[string]interface{}{
			"reason_code":         GenerationFailureCode(decodeErr),
			"schema_attempt":      schemaAttempt,
			"schema_max_attempts": schemaMaxAttempts,
		})
		return decodeErr
	}
	if groundingErr := validateGenerationBrowserActionGrounding(
		genResult.Operations,
		req.BrowserAcceptance,
	); groundingErr != nil {
		failure := newGenerationSchemaFailure(groundingErr)
		_ = emitWorkflowStep(handler, "generation-result-validation", "status_update", "校验生成结果协议", groundingErr.Error(), "failed", map[string]interface{}{
			"reason_code": GenerationFailureCodeSchemaInvalid, "schema_attempt": schemaAttempt, "schema_max_attempts": schemaMaxAttempts,
		})
		return failure
	}
	if presetErr := validateSupabaseAppPresetOperations(
		req,
		runtimeStage.project,
		genResult.Operations,
		runtimeStage.workspaceSnapshot,
	); presetErr != nil {
		failure := newGenerationSchemaFailure(presetErr)
		_ = emitWorkflowStep(handler, "generation-result-validation", "status_update", "校验 Supabase 应用后端预设", presetErr.Error(), "failed", map[string]interface{}{
			"reason_code": GenerationFailureCodeSchemaInvalid, "schema_attempt": schemaAttempt, "schema_max_attempts": schemaMaxAttempts,
			"preset": supabaseAppPresetVersion,
		})
		return failure
	}
	if operationErr := validateGenerationOperationsAgainstSnapshot(
		genResult.Operations,
		runtimeStage.workspaceSnapshot,
	); operationErr != nil {
		failure := newGenerationSchemaFailure(operationErr)
		_ = emitWorkflowStep(handler, "generation-result-validation", "status_update", "校验生成结果协议", operationErr.Error(), "failed", map[string]interface{}{
			"reason_code": GenerationFailureCodeSchemaInvalid, "schema_attempt": schemaAttempt, "schema_max_attempts": schemaMaxAttempts,
		})
		return failure
	}
	_ = emitWorkflowStep(handler, "generation-result-validation", "status_update", "校验生成结果协议", "generation_result.v2 协议校验通过。", "done", map[string]interface{}{
		"schema_version":      genResult.SchemaVersion,
		"schema_attempt":      schemaAttempt,
		"schema_max_attempts": schemaMaxAttempts,
	})
	_ = handler(StreamEventProgress, map[string]interface{}{
		"progress": 60,
		"message":  "正在写入文件...",
	})
	applyRequest := *req
	applyRequest.Provider = contentStage.usedProvider
	applyRequest.Model = contentStage.usedModel
	if err := s.applyGenerationArtifacts(ctx, &applyRequest, runtimeStage.project, &genResult, handler); err != nil {
		return err
	}

	s.persistAssistantGenerationMessage(ctx, req, contentStage.usedModel, genResult, rawContent)

	_ = handler(StreamEventDone, normalizeDonePayload(rawContent, contentStage.usedProvider, genResult, responseGuidance{}))
	_ = handler(StreamEventProgress, map[string]interface{}{
		"progress": 100,
		"message":  "正在生成快捷回复...",
	})
	guidance := buildDynamicGuidance(
		ctx,
		s.llmClient,
		s.llmCfg,
		req.Provider,
		req.Model,
		fallbackText(workflowStage, serviceWorkflowModeImplement),
		req.Prompt,
		fallbackText(genResult.Message, rawContent),
		runtimeStage.projectContext,
	)
	if len(guidance.SuggestedQuestions) > 0 || len(guidance.SuggestedActions) > 0 {
		_ = handler(StreamEventGuidance, map[string]interface{}{
			"suggestedQuestions": guidance.SuggestedQuestions,
			"suggestedActions":   guidance.SuggestedActions,
		})
	}
	return nil
}

func validateGenerationOperationsAgainstSnapshot(
	operations []GenerationFileOperation,
	snapshot *GenerationWorkspaceSnapshot,
) error {
	if snapshot == nil {
		return nil
	}
	files := make(map[string]GenerationWorkspaceSnapshotFile, len(snapshot.Files))
	for _, file := range snapshot.Files {
		files[file.Path] = file
	}
	for index, operation := range operations {
		file, exists := files[operation.Path]
		if operation.Operation == GenerationFileOperationCreate {
			if exists {
				return fmt.Errorf(
					"operations[%d] create path %q already exists in the workspace snapshot",
					index,
					operation.Path,
				)
			}
			continue
		}
		if !exists {
			return fmt.Errorf(
				"operations[%d] %s path %q is absent from the workspace snapshot; use create",
				index,
				operation.Operation,
				operation.Path,
			)
		}
		if operation.BaseHash != file.SHA256 {
			return fmt.Errorf(
				"operations[%d].base_hash does not match the workspace snapshot for %q",
				index,
				operation.Path,
			)
		}
		switch operation.Operation {
		case GenerationFileOperationReplace:
			if operation.Content == file.Content {
				return fmt.Errorf(
					"operations[%d] replace does not change %q",
					index,
					operation.Path,
				)
			}
		case GenerationFileOperationPatch:
			patched, err := applyGenerationTextEdits(
				file.Content,
				operation.Edits,
			)
			if err != nil {
				return fmt.Errorf("operations[%d].%w", index, err)
			}
			if patched == file.Content {
				return fmt.Errorf(
					"operations[%d] patch does not change %q",
					index,
					operation.Path,
				)
			}
		}
	}
	return nil
}
