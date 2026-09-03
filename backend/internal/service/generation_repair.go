package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/internal/prompt"
	"yistack/pkg/llm"
)

const (
	generationRepairDefaultAttempts = 2
	generationRepairHardMaxAttempts = 3
	generationRepairDefaultTimeout  = 90 * time.Second
	generationRepairDefaultTokens   = 4096
	generationRepairSchemaAttempts  = 2
	generationRepairFollowupLimit   = 6
)

var (
	nextValidationSourcePathPattern     = regexp.MustCompile(`^\./([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)$`)
	nextValidationRelativeImportPattern = regexp.MustCompile(`(?i)(?:can't|cannot) resolve ['"](\.{1,2}/[^'"]+)['"]`)
)

type GenerationRepairAttempt struct {
	Attempt              int                       `json:"attempt"`
	SchemaVersion        string                    `json:"schema_version"`
	Status               string                    `json:"status"`
	Message              string                    `json:"message"`
	Operations           []GenerationFileOperation `json:"operations"`
	Validation           *ProjectValidationResult  `json:"project_validation,omitempty"`
	FailureFingerprint   string                    `json:"failure_fingerprint,omitempty"`
	NormalizedSeparators int                       `json:"normalized_separators,omitempty"`
	SchemaAttempt        int                       `json:"schema_attempt,omitempty"`
	SchemaMaxAttempts    int                       `json:"schema_max_attempts,omitempty"`
}

type GenerationRepairEvidence struct {
	Status      string                    `json:"status"`
	MaxAttempts int                       `json:"max_attempts"`
	Attempts    []GenerationRepairAttempt `json:"attempts"`
	StopReason  string                    `json:"stop_reason,omitempty"`
}

type generationRepairResult struct {
	SchemaVersion        string
	Operations           []GenerationFileOperation
	Message              string
	NormalizedSeparators int
	SchemaAttempt        int
	SchemaMaxAttempts    int
}

type generationRepairResultWire struct {
	SchemaVersion *string                        `json:"schema_version"`
	Operations    *[]generationFileOperationWire `json:"operations"`
	Message       *string                        `json:"message"`
}

type GenerationRepairFileState struct {
	Path    string `json:"path"`
	Exists  bool   `json:"exists"`
	SHA256  string `json:"sha256,omitempty"`
	Content string `json:"content,omitempty"`
}

type generationRepairRequest struct {
	Provider      string
	Model         string
	Attempt       int
	PreviousError string
	UserPrompt    string
	AllowedPaths  []string
	Files         []GenerationRepairFileState
	Validation    *ProjectValidationResult
	Guidance      []string
}

type generationRepairGenerator interface {
	GenerateRepair(ctx context.Context, request generationRepairRequest) (generationRepairResult, error)
}

type llmGenerationRepairGenerator struct {
	service *GeneratorService
}

func (g *llmGenerationRepairGenerator) GenerateRepair(ctx context.Context, request generationRepairRequest) (generationRepairResult, error) {
	if g == nil || g.service == nil || g.service.llmClient == nil {
		return generationRepairResult{}, errors.New("repair LLM provider is not available")
	}
	retryInstruction := generationRepairRetryInstruction(request.PreviousError)
	contextPayload, err := json.Marshal(map[string]any{
		"attempt": request.Attempt, "allowed_paths": request.AllowedPaths,
		"files": request.Files, "project_validation": request.Validation,
		"previous_repair_error": strings.TrimSpace(request.PreviousError),
		"retry_instruction":     retryInstruction,
		"repair_guidance":       request.Guidance,
		"original_user_request": strings.TrimSpace(request.UserPrompt),
	})
	if err != nil {
		return generationRepairResult{}, fmt.Errorf("encode repair context: %w", err)
	}
	userMessage := "根据本轮 Validation 诊断修复项目。只修改 allowed_paths，并输出 generation_repair.v1。"
	if retryInstruction != "" {
		userMessage += "\n" + retryInstruction
	}
	allowedPathSet := make(map[string]struct{}, len(request.AllowedPaths))
	for _, allowedPath := range request.AllowedPaths {
		allowedPathSet[allowedPath] = struct{}{}
	}
	return runGenerationRepairProtocolAttempts(
		generationRepairSchemaAttempts,
		func(_ int, previousSchemaErr error) (string, error) {
			attemptUserMessage := userMessage
			if previousSchemaErr != nil {
				attemptUserMessage += "\n" + generationRepairSchemaRetryInstruction(previousSchemaErr)
				if generationRepairRequiresReplace(previousSchemaErr.Error()) {
					attemptUserMessage += "\n" + generationRepairRetryInstruction(previousSchemaErr.Error())
				}
			}
			chatRequest := &llm.ChatRequest{
				Model: request.Model, Temperature: 0.1, MaxTokens: g.service.generationRepairMaxTokens(ctx),
				ReasoningEffort: structuredOutputReasoningEffort(request.Model),
				Messages: []llm.Message{
					{Role: "system", Content: prompt.GenerationRepairProtocol() + "\n\n结构化修复上下文：\n" + string(contextPayload)},
					{Role: "user", Content: attemptUserMessage},
				},
				ResponseFormat: generationRepairResponseFormatForPaths(
					generationRepairAllowsPatch(request.PreviousError, previousSchemaErr),
					request.AllowedPaths,
				),
			}
			repairCtx, cancel := context.WithTimeout(ctx, g.service.generationRepairTimeout(ctx))
			response, _, _, requestErr := chatWithProviderFallback(
				repairCtx, g.service.llmClient, g.service.llmCfg, request.Provider, request.Model,
				chatRequest, g.service.recordProviderUse,
			)
			cancel()
			if requestErr != nil {
				return "", fmt.Errorf("request generation repair: %w", requestErr)
			}
			if response == nil || len(response.Choices) == 0 {
				return "", errors.New("repair LLM returned no choices")
			}
			return response.Choices[0].Message.Content, nil
		},
		func(result generationRepairResult) error {
			if err := validateGenerationRepairPaths(result.Operations, allowedPathSet); err != nil {
				return err
			}
			return validateGenerationRepairOperationStates(result.Operations, request.Files)
		},
	)

}

type generationRepairSchemaAttemptRunner func(attempt int, previousErr error) (string, error)
type generationRepairResultValidator func(result generationRepairResult) error

func runGenerationRepairSchemaAttempts(
	maxAttempts int,
	runner generationRepairSchemaAttemptRunner,
) (generationRepairResult, error) {
	return runGenerationRepairProtocolAttempts(maxAttempts, runner, nil)
}

func runGenerationRepairProtocolAttempts(
	maxAttempts int,
	runner generationRepairSchemaAttemptRunner,
	validate generationRepairResultValidator,
) (generationRepairResult, error) {
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	var previousErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		rawContent, err := runner(attempt, previousErr)
		if err != nil {
			return generationRepairResult{}, err
		}
		result, err := decodeGenerationRepairResult(rawContent)
		if err == nil && validate != nil {
			err = validate(result)
		}
		if err == nil {
			result.SchemaAttempt = attempt
			result.SchemaMaxAttempts = maxAttempts
			return result, nil
		}
		previousErr = err
	}
	return generationRepairResult{}, previousErr
}

func generationRepairSchemaRetryInstruction(previousErr error) string {
	if previousErr == nil {
		return ""
	}
	return fmt.Sprintf(
		"上一份 repair 输出未通过严格 JSON 解码或操作协议校验：%s。请重新输出完整且唯一的 generation_repair.v1 JSON 对象；operations 数组项必须是直接对象并以逗号分隔，不得输出 Markdown、代码围栏或额外文本。",
		previousErr.Error(),
	)
}

func generationRepairAllowsPatch(previousRepairError string, previousSchemaErr error) bool {
	if generationRepairRequiresReplace(previousRepairError) {
		return false
	}
	return previousSchemaErr == nil ||
		!generationRepairRequiresReplace(previousSchemaErr.Error())
}

func generationRepairRequiresReplace(previousError string) bool {
	normalized := strings.ToLower(strings.TrimSpace(previousError))
	return strings.Contains(normalized, "old_text must match exactly once") ||
		strings.Contains(normalized, "patch_context_mismatch") ||
		strings.Contains(normalized, "expected unicode escape") ||
		strings.Contains(normalized, "must change content") ||
		strings.Contains(normalized, "does not change the current snapshot")
}

func generationRepairRetryInstruction(previousError string) string {
	if strings.TrimSpace(previousError) == "" {
		return ""
	}
	normalized := strings.ToLower(previousError)
	if strings.Contains(normalized, "expected unicode escape") {
		return `上一轮修复把源码换行写成了字面量 \n，导致编译器报告 Expected unicode escape。本轮禁止 patch 和 delete；必须从 files[].content 重建完整 replace.content。JSON 中源码换行只能转义一次，解码后的文件必须包含真实换行，不能包含用于分隔源码行的反斜杠+n。`
	}
	if strings.Contains(normalized, "must change content") ||
		strings.Contains(normalized, "does not change the current snapshot") {
		return "上一轮修复是 no-op，没有改变当前文件。本轮禁止 patch 和 delete；必须使用 replace，并确保 replace.content 与 files[].content 实际不同且直接修复 Validation 诊断。"
	}
	if generationRepairRequiresReplace(previousError) {
		return "上一轮 patch 的 old_text 与当前文件快照不兼容。本轮禁止 patch，也不得删除目标文件；对 files 中 exists=true 的目标必须使用 replace，逐字复制当前 content 后仅修复诊断问题，并使用该文件当前 SHA-256。"
	}
	if strings.Contains(normalized, "decode repair result") ||
		strings.Contains(normalized, "decode trailing repair result") ||
		strings.Contains(normalized, "multiple json values") ||
		strings.Contains(normalized, "repair result is empty") {
		return "上一轮输出不是合法的单一 JSON 对象。本轮必须严格按 response schema 输出，确保 operations 数组中的对象以逗号直接分隔，所有源码内容只作为合法 JSON 字符串，不得输出 Markdown 或额外文本。"
	}
	return "上一轮修复结果已被拒绝。必须根据 previous_repair_error 和本轮 files 快照生成不同且可应用的修复，不得重复无效操作。"
}

func decodeGenerationRepairResult(rawContent string) (generationRepairResult, error) {
	rawContent, normalizedSeparators := normalizeGenerationResultWireFormat(rawContent)
	rawContent = strings.TrimSpace(rawContent)
	if rawContent == "" {
		return generationRepairResult{}, errors.New("repair result is empty")
	}
	decoder := json.NewDecoder(strings.NewReader(rawContent))
	decoder.DisallowUnknownFields()
	var wire generationRepairResultWire
	if err := decoder.Decode(&wire); err != nil {
		return generationRepairResult{}, fmt.Errorf("decode repair result: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return generationRepairResult{}, errors.New("repair result contains multiple JSON values")
		}
		return generationRepairResult{}, fmt.Errorf("decode trailing repair result: %w", err)
	}
	if wire.SchemaVersion == nil || strings.TrimSpace(*wire.SchemaVersion) != prompt.GenerationRepairSchemaVersion {
		return generationRepairResult{}, fmt.Errorf("schema_version must be %q", prompt.GenerationRepairSchemaVersion)
	}
	if wire.Operations == nil {
		return generationRepairResult{}, errors.New("operations must be an array")
	}
	operations, err := validateGenerationFileOperations(*wire.Operations)
	if err != nil {
		return generationRepairResult{}, err
	}
	if wire.Message == nil || strings.TrimSpace(*wire.Message) == "" {
		return generationRepairResult{}, errors.New("message must be a non-empty string")
	}
	return generationRepairResult{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations:    operations, Message: strings.TrimSpace(*wire.Message),
		NormalizedSeparators: normalizedSeparators,
	}, nil
}

func (s *GeneratorService) repairGeneratedProject(
	ctx context.Context,
	req *GenerateRequest,
	project *model.Project,
	result *generationResult,
	initialValidation *ProjectValidationResult,
	initialErr error,
	handler StreamEventHandler,
) error {
	maxAttempts := s.generationRepairMaxAttempts(ctx)
	workspace := s.activeGenerationFileWorkspace()
	generator := s.repairGenerator
	if generator == nil && s != nil && s.llmClient != nil {
		generator = &llmGenerationRepairGenerator{service: s}
	}
	if maxAttempts <= 0 || generator == nil || result == nil || len(result.Operations) == 0 || workspace == nil {
		return initialErr
	}

	evidence := &GenerationRepairEvidence{Status: "running", MaxAttempts: maxAttempts, Attempts: []GenerationRepairAttempt{}}
	result.Repair = evidence
	ownedPaths := map[string]struct{}{}
	for _, operation := range result.Operations {
		ownedPaths[operation.Path] = struct{}{}
	}
	allowedPathSet := generationRepairAllowedPathSet(ownedPaths, initialValidation)
	allowedPaths := sortedGenerationPaths(allowedPathSet)
	previousFingerprint := ""
	if initialValidation != nil {
		previousFingerprint = initialValidation.FailureFingerprint
	}
	lastValidation := initialValidation
	lastErr := initialErr
	previousRepairError := ""
	recordInvalidAttempt := func(attempt int, attemptErr error) {
		attemptEvidence := GenerationRepairAttempt{
			Attempt: attempt, Status: "failed", Message: attemptErr.Error(), Validation: lastValidation,
			FailureFingerprint: previousFingerprint,
		}
		evidence.Attempts = append(evidence.Attempts, attemptEvidence)
		_ = emitWorkflowStep(handler, fmt.Sprintf("generation-repair:%d", attempt), "status_update", "自动修复项目", attemptErr.Error(), "failed", map[string]any{
			"repair_attempt": attempt, "repair_max_attempts": maxAttempts, "repair_evidence": attemptEvidence,
		})
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		_ = emitWorkflowStep(handler, fmt.Sprintf("generation-repair:%d", attempt), "status_update", "自动修复项目", fmt.Sprintf("正在执行第 %d/%d 轮有限修复。", attempt, maxAttempts), "running", map[string]any{
			"repair_attempt": attempt, "repair_max_attempts": maxAttempts,
			"failure_fingerprint": previousFingerprint,
		})
		files, err := readGenerationRepairFileStates(ctx, workspace, req.ProjectID, allowedPaths)
		if err != nil {
			return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairResultInvalid, lastValidation, err)
		}
		repairResult, deterministic := deterministicGenerationRepairForValidation(files, lastValidation)
		if !deterministic {
			repairResult, err = generator.GenerateRepair(ctx, generationRepairRequest{
				Provider: req.Provider, Model: req.Model, Attempt: attempt, UserPrompt: req.Prompt,
				PreviousError: previousRepairError,
				AllowedPaths:  allowedPaths, Files: files, Validation: lastValidation,
				Guidance: generationRepairGuidance(lastValidation),
			})
		}
		if err != nil {
			previousRepairError = err.Error()
			recordInvalidAttempt(attempt, err)
			lastErr = err
			if attempt == maxAttempts {
				return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairResultInvalid, lastValidation, err)
			}
			continue
		}
		if err := validateGenerationRepairPaths(repairResult.Operations, allowedPathSet); err != nil {
			previousRepairError = err.Error()
			recordInvalidAttempt(attempt, err)
			lastErr = err
			if attempt == maxAttempts {
				return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairResultInvalid, lastValidation, err)
			}
			continue
		}
		if err := validateGenerationRepairOperationStates(repairResult.Operations, files); err != nil {
			previousRepairError = err.Error()
			recordInvalidAttempt(attempt, err)
			lastErr = err
			if attempt == maxAttempts {
				return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairResultInvalid, lastValidation, err)
			}
			continue
		}
		previousRepairError = ""
		operations, filesWritten, err := applyGenerationFileOperations(ctx, workspace, req.ProjectID, repairResult.Operations, ownedPaths, handler)
		if err != nil {
			evidence.Status = "failed"
			evidence.StopReason = GenerationFailureCodeFileConflict
			var failure *GenerationFailureError
			if errors.As(err, &failure) {
				failure.RepairEvidence = evidence
			}
			return err
		}
		attemptOperations := append([]GenerationFileOperation(nil), operations...)
		result.Operations = append(result.Operations, operations...)
		result.Files = mergeGenerationResultFiles(result.Files, operations, filesWritten)
		if eventErr := s.recordGenerationCollaborationEvents(ctx, req, project, operations); eventErr != nil {
			_ = handler(StreamEventProgress, map[string]interface{}{
				"progress":       87,
				"message":        "修复文件已写入，但共享工作区事件同步失败；协作者需手动刷新。",
				"warning":        eventErr.Error(),
				"repair_attempt": attempt,
			})
		}
		for _, operation := range operations {
			ownedPaths[operation.Path] = struct{}{}
		}
		if s.containerMgr != nil {
			refreshProjectFileTree(ctx, req.ProjectID, s.containerMgr, s.projectRepo)
		}

		validation, validationErr := s.validateGeneratedProject(ctx, req.ProjectID, project, handler)
		lastValidation, lastErr = validation, validationErr
		result.ProjectValidation = validation
		for followup := 1; validationErr != nil && followup <= generationRepairFollowupLimit; followup++ {
			currentFiles, readErr := readGenerationRepairFileStates(ctx, workspace, req.ProjectID, allowedPaths)
			if readErr != nil {
				return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairResultInvalid, validation, readErr)
			}
			followupResult, ok := deterministicGenerationRepairForValidation(currentFiles, validation)
			if !ok {
				break
			}
			if followupErr := validateGenerationRepairPaths(followupResult.Operations, allowedPathSet); followupErr != nil {
				return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairResultInvalid, validation, followupErr)
			}
			if followupErr := validateGenerationRepairOperationStates(followupResult.Operations, currentFiles); followupErr != nil {
				return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairResultInvalid, validation, followupErr)
			}
			followupOperations, followupFilesWritten, followupErr := applyGenerationFileOperations(
				ctx, workspace, req.ProjectID, followupResult.Operations, ownedPaths, handler,
			)
			if followupErr != nil {
				evidence.Status = "failed"
				evidence.StopReason = GenerationFailureCodeFileConflict
				var failure *GenerationFailureError
				if errors.As(followupErr, &failure) {
					failure.RepairEvidence = evidence
				}
				return followupErr
			}
			attemptOperations = append(attemptOperations, followupOperations...)
			result.Operations = append(result.Operations, followupOperations...)
			result.Files = mergeGenerationResultFiles(result.Files, followupOperations, followupFilesWritten)
			if eventErr := s.recordGenerationCollaborationEvents(ctx, req, project, followupOperations); eventErr != nil {
				_ = handler(StreamEventProgress, map[string]interface{}{
					"progress":                87,
					"message":                 "后续修复文件已写入，但共享工作区事件同步失败；协作者需手动刷新。",
					"warning":                 eventErr.Error(),
					"repair_attempt":          attempt,
					"repair_followup_attempt": followup,
				})
			}
			for _, operation := range followupOperations {
				ownedPaths[operation.Path] = struct{}{}
			}
			if s.containerMgr != nil {
				refreshProjectFileTree(ctx, req.ProjectID, s.containerMgr, s.projectRepo)
			}
			validation, validationErr = s.validateGeneratedProject(ctx, req.ProjectID, project, handler)
			lastValidation, lastErr = validation, validationErr
			result.ProjectValidation = validation
		}
		attemptEvidence := GenerationRepairAttempt{
			Attempt: attempt, SchemaVersion: repairResult.SchemaVersion, Status: "failed",
			Message: repairResult.Message, Operations: attemptOperations, Validation: validation,
			NormalizedSeparators: repairResult.NormalizedSeparators,
			SchemaAttempt:        repairResult.SchemaAttempt, SchemaMaxAttempts: repairResult.SchemaMaxAttempts,
		}
		if validation != nil {
			attemptEvidence.FailureFingerprint = validation.FailureFingerprint
		}
		if validationErr == nil {
			attemptEvidence.Status = "passed"
			evidence.Attempts = append(evidence.Attempts, attemptEvidence)
			evidence.Status = "passed"
			evidence.StopReason = "validation_passed"
			_ = emitWorkflowStep(handler, fmt.Sprintf("generation-repair:%d", attempt), "status_update", "自动修复项目", "自动修复后完整 Project Validation Gate 已通过。", "done", map[string]any{"repair_evidence": evidence})
			return nil
		}
		evidence.Attempts = append(evidence.Attempts, attemptEvidence)
		previousRepairError = validationErr.Error()
		if previousFingerprint != "" && attemptEvidence.FailureFingerprint == previousFingerprint {
			return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairRepeatedFailure, validation, validationErr)
		}
		previousFingerprint = attemptEvidence.FailureFingerprint
	}
	return s.stopGenerationRepair(evidence, result, GenerationFailureCodeRepairBudgetExhausted, lastValidation, lastErr)
}

func (s *GeneratorService) stopGenerationRepair(evidence *GenerationRepairEvidence, result *generationResult, code string, validation *ProjectValidationResult, err error) error {
	if evidence != nil {
		evidence.Status = "failed"
		evidence.StopReason = code
	}
	if result != nil {
		result.Repair = evidence
	}
	return newGenerationRepairFailure(code, validation, evidence, err)
}

func readGenerationRepairFileStates(ctx context.Context, workspace generationFileWorkspace, projectID string, paths []string) ([]GenerationRepairFileState, error) {
	files := make([]GenerationRepairFileState, 0, len(paths))
	for _, filePath := range paths {
		exists, err := workspace.PathExists(ctx, projectID, filePath)
		if err != nil {
			return nil, err
		}
		state := GenerationRepairFileState{Path: filePath, Exists: exists}
		if exists {
			content, err := workspace.ReadFile(ctx, projectID, filePath)
			if err != nil {
				return nil, err
			}
			if len(content) > generationMaxOperationContent {
				return nil, fmt.Errorf("repair file %s exceeds hard limit", filePath)
			}
			state.Content = content
			state.SHA256 = generationContentHash(content)
		}
		files = append(files, state)
	}
	return files, nil
}

const verifiedPythonFastAPIRequirements = `fastapi==0.116.0
uvicorn==0.35.0
httpx==0.28.1
pytest==8.4.1
pytest-asyncio==1.1.0
jinja2==3.1.6
python-multipart==0.0.20
`

func deterministicGenerationRepair(
	files []GenerationRepairFileState,
	validation *ProjectValidationResult,
) (generationRepairResult, bool) {
	if validation == nil {
		return generationRepairResult{}, false
	}
	var detail strings.Builder
	for _, check := range validation.Checks {
		if check.Status != ProjectValidationStatusFailed {
			continue
		}
		detail.WriteString(check.Message)
		detail.WriteByte('\n')
		detail.WriteString(check.Output)
		detail.WriteByte('\n')
	}
	normalizedDetail := strings.ToLower(detail.String())
	if strings.Contains(normalizedDetail, "`npm ci` can only install packages") &&
		strings.Contains(normalizedDetail, "missing:") {
		for _, file := range files {
			if file.Path == "package-lock.json" && file.Exists {
				return generationRepairResult{
					SchemaVersion: prompt.GenerationRepairSchemaVersion,
					Operations: []GenerationFileOperation{{
						Operation:   GenerationFileOperationDelete,
						Path:        file.Path,
						BaseHash:    file.SHA256,
						Description: "Remove the stale npm lockfile so validation can regenerate it",
					}},
					Message: "已移除与 package.json 不一致的 npm 锁文件。",
				}, true
			}
		}
	}
	if strings.Contains(normalizedDetail, `form data requires "python-multipart" to be installed`) {
		for _, file := range files {
			if file.Path != "requirements.txt" || !file.Exists {
				continue
			}
			content := strings.TrimRight(file.Content, "\r\n") + "\n"
			if strings.Contains(strings.ToLower(content), "python-multipart") {
				break
			}
			content += "python-multipart==0.0.20\n"
			return generationRepairResult{
				SchemaVersion: prompt.GenerationRepairSchemaVersion,
				Operations: []GenerationFileOperation{{
					Operation:   GenerationFileOperationReplace,
					Path:        file.Path,
					BaseHash:    file.SHA256,
					Content:     content,
					Description: "Add the FastAPI form-data runtime dependency",
				}},
				Message: "已补充 FastAPI 表单解析依赖。",
			}, true
		}
	}
	if strings.EqualFold(strings.TrimSpace(validation.RuntimeProfile), "python-fastapi") &&
		strings.Contains(normalizedDetail, "requires requirements.txt or pyproject.toml") {
		for _, file := range files {
			if file.Path == "requirements.txt" && !file.Exists {
				return generationRepairResult{
					SchemaVersion: prompt.GenerationRepairSchemaVersion,
					Operations: []GenerationFileOperation{{
						Operation:   GenerationFileOperationCreate,
						Path:        file.Path,
						Content:     verifiedPythonFastAPIRequirements,
						Description: "Create the verified FastAPI dependency manifest",
					}},
					Message: "已创建经过验证的 FastAPI requirements.txt。",
				}, true
			}
		}
	}
	if strings.EqualFold(strings.TrimSpace(validation.RuntimeProfile), "node-nextjs") &&
		strings.Contains(normalizedDetail, `runtime profile "node-nextjs" requires package.json`) {
		for _, file := range files {
			if file.Path == "package.json" && !file.Exists {
				return generationRepairResult{
					SchemaVersion: prompt.GenerationRepairSchemaVersion,
					Operations: []GenerationFileOperation{{
						Operation:   GenerationFileOperationCreate,
						Path:        file.Path,
						Content:     verifiedNextPackageJSON,
						Description: "Create the verified Next.js package manifest",
					}},
					Message: "已创建经过验证的 Next.js package.json。",
				}, true
			}
		}
	}
	if !strings.Contains(normalizedDetail, "parse package.json") {
		return generationRepairResult{}, false
	}
	for _, file := range files {
		if file.Path != "package.json" || !file.Exists {
			continue
		}
		content, ok := normalizeEscapedPackageJSON(file.Content)
		if !ok {
			return generationRepairResult{}, false
		}
		return generationRepairResult{
			SchemaVersion: prompt.GenerationRepairSchemaVersion,
			Operations: []GenerationFileOperation{{
				Operation:   GenerationFileOperationReplace,
				Path:        file.Path,
				BaseHash:    file.SHA256,
				Content:     content,
				Description: "Normalize escaped package.json into valid JSON",
			}},
			Message: "已将转义损坏的 package.json 规范化为可解析 JSON。",
		}, true
	}
	return generationRepairResult{}, false
}

func normalizeEscapedPackageJSON(content string) (string, bool) {
	if json.Valid([]byte(content)) {
		return "", false
	}
	candidate := strings.NewReplacer(
		`\r\n`, "\n",
		`\n`, "\n",
		`\r`, "\n",
		`\t`, "\t",
	).Replace(content)
	var document any
	if err := json.Unmarshal([]byte(candidate), &document); err != nil {
		return "", false
	}
	normalized, err := json.Marshal(document)
	if err != nil {
		return "", false
	}
	return string(normalized) + "\n", true
}

func generationRepairAllowedPathSet(ownedPaths map[string]struct{}, validation *ProjectValidationResult) map[string]struct{} {
	allowed := make(map[string]struct{}, len(ownedPaths)+3)
	hasAppPath := false
	hasSrcAppPath := false
	for filePath := range ownedPaths {
		allowed[filePath] = struct{}{}
		hasSrcAppPath = hasSrcAppPath || strings.HasPrefix(filePath, "src/app/")
		hasAppPath = hasAppPath || strings.HasPrefix(filePath, "app/")
	}
	if _, ownsPackageManifest := ownedPaths["package.json"]; ownsPackageManifest {
		allowed["package-lock.json"] = struct{}{}
	}
	for _, filePath := range generationRepairDiagnosedMissingPaths(validation) {
		allowed[filePath] = struct{}{}
	}
	if !projectValidationNeedsNextRootLayout(validation) {
		return allowed
	}
	if hasSrcAppPath {
		allowed["src/app/layout.tsx"] = struct{}{}
	} else if hasAppPath {
		allowed["app/layout.tsx"] = struct{}{}
	}
	return allowed
}

func generationRepairDiagnosedMissingPaths(validation *ProjectValidationResult) []string {
	if validation == nil {
		return nil
	}
	targets := map[string]struct{}{}
	for _, check := range validation.Checks {
		if check.Status != ProjectValidationStatusFailed {
			continue
		}
		detail := strings.ToLower(strings.TrimSpace(check.Message + "\n" + check.Output))
		if check.Kind == "detect" {
			switch {
			case isPythonRuntimeProfile(validation.RuntimeProfile) &&
				strings.Contains(detail, "requires requirements.txt or pyproject.toml"):
				targets["requirements.txt"] = struct{}{}
			case isNodeRuntimeProfile(validation.RuntimeProfile) &&
				strings.Contains(detail, "requires package.json"):
				targets["package.json"] = struct{}{}
			case isGoRuntimeProfile(validation.RuntimeProfile) &&
				strings.Contains(detail, "requires go.mod"):
				targets["go.mod"] = struct{}{}
			}
		}
		if check.Kind == "prepare" &&
			strings.Contains(detail, "`npm ci` can only install packages") &&
			strings.Contains(detail, "missing:") {
			targets["package-lock.json"] = struct{}{}
		}
		if validation.Stack != ProjectValidationStackNodeNextJS {
			continue
		}
		importer := ""
		for _, line := range strings.Split(check.Message+"\n"+check.Output, "\n") {
			line = strings.TrimSpace(line)
			if matches := nextValidationSourcePathPattern.FindStringSubmatch(line); len(matches) == 2 {
				normalized, err := normalizeProjectRelativePath(matches[1])
				if err == nil && !isProtectedGenerationPath(normalized) {
					importer = normalized
				}
				continue
			}
			matches := nextValidationRelativeImportPattern.FindStringSubmatch(line)
			if importer == "" || len(matches) != 2 {
				continue
			}
			target := path.Clean(path.Join(path.Dir(importer), matches[1]))
			if path.Ext(target) == "" {
				switch extension := path.Ext(importer); extension {
				case ".tsx", ".jsx", ".ts", ".js":
					target += extension
				}
			}
			normalized, err := normalizeProjectRelativePath(target)
			if err == nil && !isProtectedGenerationPath(normalized) {
				targets[normalized] = struct{}{}
			}
		}
	}
	return sortedGenerationPaths(targets)
}

func projectValidationNeedsNextRootLayout(validation *ProjectValidationResult) bool {
	if validation == nil || validation.Stack != ProjectValidationStackNodeNextJS {
		return false
	}
	for _, check := range validation.Checks {
		if check.Status != ProjectValidationStatusFailed {
			continue
		}
		detail := strings.ToLower(check.Message + "\n" + check.Output)
		if strings.Contains(detail, "root layout") {
			return true
		}
	}
	return false
}

func generationRepairGuidance(validation *ProjectValidationResult) []string {
	if validation == nil {
		return nil
	}
	var detail strings.Builder
	for _, check := range validation.Checks {
		if check.Status != ProjectValidationStatusFailed {
			continue
		}
		detail.WriteString(check.Message)
		detail.WriteByte(10)
		detail.WriteString(check.Output)
		detail.WriteByte(10)
	}
	normalized := strings.ToLower(detail.String())
	guidance := make([]string, 0, 2)
	if validation.Stack == ProjectValidationStackNodeNextJS && strings.Contains(normalized, "can't resolve '@/") {
		guidance = append(guidance, "Next.js 未解析 @/ 导入时，禁止改成另一个 @/ 前缀；若 tsconfig/jsconfig 未配置可匹配实际文件的 baseUrl 和 paths，必须改为从导入文件出发的相对路径。例如 app/page.tsx 导入 app/components/Card.tsx 必须使用 ./components/Card。")
	}
	if validation.Stack == ProjectValidationStackNodeNextJS && strings.Contains(normalized, "client component") {
		guidance = append(guidance, "使用 useState、useEffect 或浏览器事件的 Next.js 文件必须以 \"use client\" 开头；纯服务端展示应移除不必要的客户端 Hook。")
	}
	if validation.Stack == ProjectValidationStackNodeNextJS && strings.Contains(normalized, "expected workstore to be initialized") {
		guidance = append(guidance, "Next.js Server Component prerender 出现 workStore invariant 时，必须移除 render 路径中的 await new Promise、setTimeout 或其他假延迟，并同步读取确定性本地数据；不要通过升级依赖或 no-op patch 规避。")
	}
	if validation.Stack == ProjectValidationStackNodeNextJS &&
		strings.Contains(normalized, `the "id" argument must be of type string`) &&
		strings.Contains(normalized, "received undefined") {
		guidance = append(guidance, "Next.js 已完成源码编译但 TypeScript 依赖检测失败；必须修改 package.json，将 devDependencies.typescript 精确固定为 5.4.5，禁止 latest、范围版本或 TypeScript 6/7；不得仅修改页面源码。")
	}
	if strings.Contains(normalized, "parse package.json") {
		guidance = append(guidance, `package.json 无法解析时必须修复 manifest 本身；若文件包含字面量 \n 或错误反斜杠，使用 replace 返回紧凑单行标准 JSON，并确保 replace.content 在外层 repair JSON 中正确转义。`)
	}
	if validation.Stack == ProjectValidationStackNodeNextJS && isUnavailableNextPackageVersion(normalized) {
		guidance = append(guidance, "Next.js 13.5.0 的 npm tarball 不可用；必须修改 package.json，将 dependencies.next 精确固定为 13.5.6。")
	}
	if validation.Stack == ProjectValidationStackNodeNextJS &&
		strings.Contains(normalized, "supabaseurl is required") {
		guidance = append(guidance, "Next.js prerender 缺少 Supabase 配置；必须修改所有实际调用 createClient 的源码模块，先同时检查 URL 与 anon key，再创建客户端；缺少任一配置时直接使用确定性本地 demo/fixture，不得只修改导入模块的包装页面，也不得用伪造 URL/key 发起网络请求。")
	}
	if isPythonRuntimeProfile(validation.RuntimeProfile) && isPythonTopLevelRelativeImportFailure(normalized) {
		guidance = append(guidance, "Python 项目根目录模块由 uvicorn main:app 或 pytest 直接导入时，必须把 from .module import 改为 from module import；包目录内的合法相对导入保持不变。")
	}
	if isPythonRuntimeProfile(validation.RuntimeProfile) &&
		strings.Contains(normalized, "asyncclient.__init__() got an unexpected keyword argument 'app'") {
		guidance = append(guidance, "httpx 0.28 已移除 AsyncClient(app=...)；必须修改失败测试，先创建 httpx.ASGITransport(app=app)，再使用 AsyncClient(transport=transport, base_url=...)；不得仅添加 pytest-asyncio 或原样 replace 文件。")
	}
	if isPythonRuntimeProfile(validation.RuntimeProfile) &&
		isPythonInMemoryStateLeakage(normalized) {
		guidance = append(guidance, "进程内可变存储污染了后续测试；必须通过 fixture 清空状态，或在每个测试创建 client 前 reload 应用模块并引用重建后的 app，禁止依赖测试执行顺序或放宽断言。")
	}
	if validation.Stack == ProjectValidationStackNodeVite && strings.Contains(normalized, "react is not defined") {
		guidance = append(guidance, "React Vite 浏览器运行时缺少 React 绑定时，必须在诊断列出的每个 JSX 文件中添加 import React from \"react\"，或在 vite.config 中实际启用 @vitejs/plugin-react；仅在 package.json 声明插件依赖不算启用。")
	}
	if strings.Contains(normalized, "implicitly has an 'any' type") || strings.Contains(normalized, "implicitly has an any type") {
		guidance = append(guidance, "TypeScript 隐式 any 必须在诊断文件中为解构 props、函数参数或回调参数补充明确类型；不得关闭 strict/noImplicitAny，也不得用 @ts-ignore 绕过。")
	}
	return guidance
}

func validateGenerationRepairPaths(operations []GenerationFileOperation, allowed map[string]struct{}) error {
	for _, operation := range operations {
		if _, ok := allowed[operation.Path]; !ok {
			return fmt.Errorf("repair operation path %q is outside allowed_paths", operation.Path)
		}
	}
	return nil
}

func validateGenerationRepairOperationStates(operations []GenerationFileOperation, files []GenerationRepairFileState) error {
	states := make(map[string]GenerationRepairFileState, len(files))
	for _, file := range files {
		states[file.Path] = file
	}
	for _, operation := range operations {
		state, ok := states[operation.Path]
		if !ok {
			return fmt.Errorf("repair operation path %q is missing from the current snapshot", operation.Path)
		}
		if operation.Operation == GenerationFileOperationCreate {
			if state.Exists {
				return fmt.Errorf("repair create path %q already exists; use patch or replace with the snapshot base_hash", operation.Path)
			}
			continue
		}
		if !state.Exists {
			return fmt.Errorf("repair %s path %q does not exist; use create", operation.Operation, operation.Path)
		}
		if operation.BaseHash != state.SHA256 {
			return fmt.Errorf("repair %s path %q base_hash does not match the current snapshot", operation.Operation, operation.Path)
		}
		switch operation.Operation {
		case GenerationFileOperationPatch:
			patched, err := applyGenerationTextEdits(state.Content, operation.Edits)
			if err != nil {
				return fmt.Errorf("repair patch path %q is incompatible with the current snapshot: %w", operation.Path, err)
			}
			if patched == state.Content {
				return fmt.Errorf("repair patch path %q does not change the current snapshot", operation.Path)
			}
		case GenerationFileOperationReplace:
			if operation.Content == state.Content {
				return fmt.Errorf("repair replace path %q does not change the current snapshot", operation.Path)
			}
		}
	}
	return nil
}

func sortedGenerationPaths(paths map[string]struct{}) []string {
	result := make([]string, 0, len(paths))
	for filePath := range paths {
		result = append(result, filePath)
	}
	sort.Strings(result)
	return result
}

func mergeGenerationResultFiles(current []FileToGenerate, operations []GenerationFileOperation, written []FileToGenerate) []FileToGenerate {
	files := make(map[string]FileToGenerate, len(current)+len(written))
	for _, file := range current {
		files[file.Path] = file
	}
	for _, operation := range operations {
		if operation.Operation == GenerationFileOperationDelete {
			delete(files, operation.Path)
		}
	}
	for _, file := range written {
		files[file.Path] = file
	}
	paths := make([]string, 0, len(files))
	for filePath := range files {
		paths = append(paths, filePath)
	}
	sort.Strings(paths)
	result := make([]FileToGenerate, 0, len(paths))
	for _, filePath := range paths {
		result = append(result, files[filePath])
	}
	return result
}

func (s *GeneratorService) generationRepairMaxAttempts(ctx context.Context) int {
	return boundedGenerationRepairConfig(s.lookupPromptSystemConfig(ctx, "project.generation_repair_max_attempts"), generationRepairDefaultAttempts, 0, generationRepairHardMaxAttempts)
}

func (s *GeneratorService) generationRepairTimeout(ctx context.Context) time.Duration {
	seconds := boundedGenerationRepairConfig(s.lookupPromptSystemConfig(ctx, "project.generation_repair_timeout_seconds"), int(generationRepairDefaultTimeout/time.Second), 10, 180)
	return time.Duration(seconds) * time.Second
}

func (s *GeneratorService) generationRepairMaxTokens(ctx context.Context) int {
	return boundedGenerationRepairConfig(s.lookupPromptSystemConfig(ctx, "project.generation_repair_max_output_units"), generationRepairDefaultTokens, 256, 4096)
}

func boundedGenerationRepairConfig(raw string, fallback, minimum, maximum int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		value = fallback
	}
	if value < minimum {
		return minimum
	}
	if value > maximum {
		return maximum
	}
	return value
}
