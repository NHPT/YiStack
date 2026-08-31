package service

import (
	"errors"
	"fmt"
	"strings"
)

const defaultGenerationSchemaMaxAttempts = 3

func structuredOutputReasoningEffort(model string) string {
	normalized := strings.ToLower(strings.TrimSpace(model))
	if strings.Contains(normalized, "gpt-oss") {
		return "low"
	}
	return ""
}

type generationContentAttemptRunner func(attempt int, previousErr error) (generationContentStageResult, error)
type generationContentAttemptCompleter func(contentStage generationContentStageResult) error

func runGenerationContentAttempts(
	maxAttempts int,
	runner generationContentAttemptRunner,
	completer generationContentAttemptCompleter,
	handler StreamEventHandler,
) error {
	if maxAttempts < 1 {
		maxAttempts = 1
	}

	schemaErrors := make([]error, 0, maxAttempts-1)
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		previousErr := errors.Join(schemaErrors...)
		retryStepID := fmt.Sprintf("generation-result-retry:%d", attempt)
		if attempt > 1 {
			_ = emitWorkflowStep(
				handler,
				retryStepID,
				"status_update",
				"重新生成实现结果",
				fmt.Sprintf("第 %d/%d 次生成结果协议重试正在执行。", attempt, maxAttempts),
				"running",
				map[string]any{
					"reason_code":         GenerationFailureCodeSchemaInvalid,
					"schema_attempt":      attempt,
					"schema_max_attempts": maxAttempts,
				},
			)
		}

		contentStage, err := runner(attempt, previousErr)
		contentStage.schemaAttempt = attempt
		contentStage.schemaMaxAttempts = maxAttempts
		if err != nil {
			if attempt > 1 {
				_ = emitWorkflowStep(
					handler,
					retryStepID,
					"status_update",
					"重新生成实现结果",
					err.Error(),
					"failed",
					map[string]any{
						"reason_code":         GenerationFailureCode(err),
						"schema_attempt":      attempt,
						"schema_max_attempts": maxAttempts,
					},
				)
			}
			return err
		}
		if attempt > 1 {
			_ = emitWorkflowStep(
				handler,
				retryStepID,
				"status_update",
				"重新生成实现结果",
				"模型重试输出完成，开始严格校验 generation_result.v2。",
				"done",
				map[string]any{
					"schema_attempt":      attempt,
					"schema_max_attempts": maxAttempts,
				},
			)
		}

		err = completer(contentStage)
		if err == nil {
			return nil
		}
		if GenerationFailureCode(err) != GenerationFailureCodeSchemaInvalid || attempt == maxAttempts {
			return err
		}
		schemaErrors = append(schemaErrors, err)
	}

	return errors.Join(schemaErrors...)
}

func generationSchemaRetryRequest(req *GenerateRequest, previousErr error) *GenerateRequest {
	if req == nil {
		return nil
	}

	retryRequest := *req
	if previousErr == nil {
		return &retryRequest
	}
	instructions := []string{
		strings.TrimSpace(req.Prompt),
		"系统协议重试要求（不得作为应用展示内容）：",
		fmt.Sprintf("上一次完整输出在任何项目文件写入前未通过 generation_result.v2 严格校验：%s", previousErr.Error()),
		`operations 数组中的每一项必须直接是 JSON 对象；相邻对象使用 },{ 分隔，禁止把后续对象写成字符串或输出 },"{"operation。`,
	}
	if generationRepairRequiresReplace(previousErr.Error()) {
		instructions = append(
			instructions,
			"上一份 patch 的 old_text 与当前工作区快照不精确匹配。本轮必须改用 replace，逐字使用快照中的完整文件内容构造修改结果，不得再次猜测 patch 上下文。",
		)
	}
	if strings.Contains(previousErr.Error(), "only appears in non-body metadata or attributes") {
		instructions = append(
			instructions,
			"required_text 必须新增为普通可见 JSX/HTML 文本节点，例如与控件关联的 label、heading 或正文；placeholder、title、aria-label、注释和 JavaScript 标识符均不满足验收。",
		)
	}
	instructions = append(instructions, "请重新生成完整实现结果。只能返回一个符合指定 JSON Schema 的 JSON 对象，不得输出 Markdown、代码围栏、解释文字或第二个 JSON 值。")
	retryRequest.Prompt = strings.Join(instructions, "\n\n")
	return &retryRequest
}
