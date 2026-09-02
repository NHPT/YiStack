package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"yistack/internal/prompt"
	"yistack/pkg/llm"
)

var (
	nativeRequiredFormControlPattern = regexp.MustCompile(`(?is)<(?:input|select|textarea)\b[^>]*\brequired(?:\s|=|/|>)`)
	submittedFormPattern             = regexp.MustCompile(`(?is)<form\b[^>]*\bonSubmit\s*=`)
	noValidateFormPattern            = regexp.MustCompile(`(?is)<form\b[^>]*\bnoValidate(?:\s|=|>)`)
	hiddenRequiredTextElementPattern = regexp.MustCompile(
		`(?is)(?:\s+hidden(?:\s|=|/|>)|` +
			`(?:display|visibility)\s*:\s*['"]?(?:none|hidden)\b|` +
			`class(?:Name)?\s*=\s*(?:"[^"]*\b(?:hidden|sr-only)\b[^"]*"|` +
			`'[^']*\b(?:hidden|sr-only)\b[^']*'))`,
	)
)

type generationContentStageResult struct {
	rawContent        string
	usedProvider      string
	usedModel         string
	schemaAttempt     int
	schemaMaxAttempts int
}

func (s *GeneratorService) streamGenerationContentStage(
	ctx context.Context,
	req *GenerateRequest,
	runtimeStage generationRuntimeStageResult,
	modelName string,
	temperature float64,
	handler StreamEventHandler,
) (generationContentStageResult, error) {
	chatReq := s.buildGenerationChatRequest(ctx, req, runtimeStage, modelName, temperature)

	var fullContent strings.Builder
	initialProvider := initialProviderName(s.llmClient, req.Provider)
	reasoningBuffer := newReasoningStreamBuffer(func(reasoning string) error {
		return handler(StreamEventChunk, map[string]interface{}{
			"provider":         initialProvider,
			"reasoningContent": reasoning,
		})
	})
	_ = emitWorkflowStep(handler, "generate-content", "status_update", "生成回复与代码", "模型开始流式输出实现结果。", "running", map[string]interface{}{
		"provider": initialProvider,
		"model":    modelName,
	})

	usedProvider, usedModel, streamErr := s.streamLLMWithProviderFallback(ctx, req.Provider, req.Model, chatReq, func(chunk *llm.StreamChunk) error {
		return s.consumeGenerationContentChunk(initialProvider, chunk, &fullContent, reasoningBuffer, handler)
	})
	if flushErr := reasoningBuffer.Flush(); flushErr != nil && streamErr == nil {
		streamErr = flushErr
	}
	if usedProvider == "" {
		usedProvider = initialProvider
	}
	if usedModel == "" {
		usedModel = modelName
	}

	if streamErr != nil {
		if errors.Is(streamErr, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
			s.persistAssistantDraftMessage(req, usedModel, "生成已停止，以下为已输出草稿：", fullContent.String())
		}
		_ = emitWorkflowStep(handler, "generate-content", "status_update", "生成回复与代码", streamErr.Error(), "failed", nil)
		return generationContentStageResult{}, s.failGeneration(ctx, req, usedModel, streamErr, handler)
	}
	if err := ctx.Err(); err != nil {
		if errors.Is(err, context.Canceled) {
			s.persistAssistantDraftMessage(req, usedModel, "生成已停止，以下为已输出草稿：", fullContent.String())
		}
		_ = emitWorkflowStep(handler, "generate-content", "status_update", "生成回复与代码", err.Error(), "failed", nil)
		return generationContentStageResult{}, err
	}

	_ = emitWorkflowStep(handler, "generate-content", "status_update", "生成回复与代码", "模型输出完成，开始应用生成结果。", "done", map[string]interface{}{
		"provider": usedProvider,
		"model":    usedModel,
	})
	return generationContentStageResult{
		rawContent:   fullContent.String(),
		usedProvider: usedProvider,
		usedModel:    usedModel,
	}, nil
}

func (s *GeneratorService) buildGenerationChatRequest(ctx context.Context, req *GenerateRequest, runtimeStage generationRuntimeStageResult, modelName string, temperature float64) *llm.ChatRequest {
	systemPromptOverride := s.lookupPromptSystemConfig(ctx, prompt.ChatImplementSystemPromptKey)
	return buildGenerationChatRequestWithSystemPrompt(ctx, req, runtimeStage, modelName, temperature, systemPromptOverride)
}

func buildGenerationChatRequest(req *GenerateRequest, runtimeStage generationRuntimeStageResult, modelName string, temperature float64) *llm.ChatRequest {
	return buildGenerationChatRequestWithSystemPrompt(context.Background(), req, runtimeStage, modelName, temperature, "")
}

func buildGenerationChatRequestWithSystemPrompt(ctx context.Context, req *GenerateRequest, runtimeStage generationRuntimeStageResult, modelName string, temperature float64, systemPromptOverride string) *llm.ChatRequest {
	onlineContext := buildOnlineContextDecision(ctx, req)
	systemPrompt := prompt.BuildGenerateSystemPrompt(systemPromptOverride, projectRuntimeProfile(runtimeStage.project), runtimeStage.projectContext, onlineContext.PromptSection())
	return &llm.ChatRequest{
		Model: modelName,
		Messages: []llm.Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: buildGenerationUserPrompt(req)},
		},
		Temperature:     temperature,
		ReasoningEffort: structuredOutputReasoningEffort(modelName),
		Stream:          true,
		ResponseFormat:  generationResultResponseFormat(),
	}
}

func buildGenerationUserPrompt(req *GenerateRequest) string {
	if req == nil {
		return ""
	}

	promptText := strings.TrimSpace(req.Prompt)
	planContext := strings.TrimSpace(req.PlanContext)
	sections := make([]string, 0, 3)
	if planContext != "" {
		sections = append(sections, strings.Join([]string{
			"已批准方案上下文：",
			planContext,
			"用户实现请求：",
			promptText,
			"实现必须完整继承已批准方案上下文；如局部表述存在冲突，以已批准方案和当前项目真源为准。",
		}, "\n\n"))
	} else {
		sections = append(sections, promptText)
	}
	if visualSection := visualContextPromptSection(req.VisualContext); visualSection != "" {
		sections = append(sections, visualSection)
	}

	if acceptanceSection := buildBrowserAcceptancePromptSection(req.BrowserAcceptance); acceptanceSection != "" {
		sections = append(sections, acceptanceSection)
	}
	return strings.Join(sections, "\n\n")
}

func buildBrowserAcceptancePromptSection(spec BrowserAcceptanceSpec) string {
	if len(spec.RequiredText) == 0 && len(spec.Actions) == 0 {
		return ""
	}
	encoded, err := json.Marshal(spec)
	if err != nil {
		return ""
	}
	return strings.Join([]string{
		"浏览器验收契约（实现必须满足）：",
		string(encoded),
		"浏览器验收固定访问 Preview 根路径 GET /；required_text 和 actions 必须在该根页面直接可见、可操作，不得只实现于未被导航的子路由。",
		"required_text 中每一项必须以普通可见页面正文呈现；仅写入 document.title、metadata、placeholder、aria-label、注释或隐藏元素不算满足。",
		"实现完成前必须逐项自检 required_text 的原文已作为 JSX/HTML 可见文本节点渲染，页面标题优先使用可见 h1；document.title 或 aria-label 中存在同名文本不能替代正文。",
		"使用确定性本地数据时，required_text 必须在首屏稳定渲染中可见；不得先用 useEffect、setTimeout 或其他人为延迟只显示 loading 占位。",
		"当 actions 为空时，required_text 必须在初始渲染状态无条件可见，不能只放在初始条件为 false 的空状态、筛选结果或弹窗分支中。",
		"actions 中每个 selector 都必须匹配可见且可操作的真实控件；执行 click 或 fill 后，expect_text（如有）必须以完全相同的原文作为可见正文呈现。",
		"若 click 提交动作要求显示自定义校验文案，且表单控件使用 required，form 必须设置 noValidate，确保浏览器原生约束不会在 onSubmit 前阻断自定义处理器。",
		"每个非空 expect_text 都是动作后的确定性字面量后置条件，必须实际写入对应事件处理或本地数据分支；禁止改写、缩写、拼接替代、仅返回其他 API 字段，或依赖初始为空的集合和外部网络。不得通过隐藏验收文本或无功能占位控件规避真实交互。",
	}, "\n")
}

func validateGenerationBrowserActionGrounding(
	operations []GenerationFileOperation,
	spec BrowserAcceptanceSpec,
) error {
	var generatedSource strings.Builder
	newScaffold := false
	for _, operation := range operations {
		generatedSource.WriteString(operation.Content)
		generatedSource.WriteByte('\n')
		for _, edit := range operation.Edits {
			generatedSource.WriteString(edit.NewText)
			generatedSource.WriteByte('\n')
		}
		if operation.Operation == GenerationFileOperationCreate &&
			(operation.Path == "package.json" ||
				operation.Path == "index.html" ||
				operation.Path == "public/index.html") {
			newScaffold = true
		}
	}
	source := generatedSource.String()
	for _, requiredText := range spec.RequiredText {
		required := strings.TrimSpace(requiredText)
		if required == "" {
			continue
		}
		appearsInSource := strings.Contains(source, required)
		if appearsInSource && !generationSourceHasVisibleRequiredText(source, required) {
			return fmt.Errorf(
				"browser acceptance required_text %q only appears in non-body metadata or attributes",
				required,
			)
		}
		if newScaffold && !appearsInSource {
			return fmt.Errorf(
				"browser acceptance required_text %q is absent from new scaffold content",
				required,
			)
		}
	}
	for _, action := range spec.Actions {
		expected := strings.TrimSpace(action.ExpectText)
		if expected == "" {
			continue
		}
		if !strings.Contains(source, expected) {
			return fmt.Errorf(
				"browser acceptance action %q expect_text %q is absent from generated executable content",
				strings.TrimSpace(action.Selector),
				expected,
			)
		}
		if action.Type == "click" &&
			strings.Contains(strings.ToLower(expected), "required") &&
			nativeRequiredFormControlPattern.MatchString(source) &&
			submittedFormPattern.MatchString(source) &&
			!noValidateFormPattern.MatchString(source) {
			return fmt.Errorf(
				"browser acceptance action %q custom expect_text is blocked by native required validation; add noValidate to the submitted form",
				strings.TrimSpace(action.Selector),
			)
		}
	}
	return nil
}

func generationSourceHasVisibleRequiredText(source, required string) bool {
	if !strings.Contains(source, required) {
		return false
	}
	escaped := regexp.QuoteMeta(required)
	requiredTextElement := regexp.MustCompile(
		`(?is)<[A-Za-z][^>]*>[^<]*` + escaped + `[^<]*</[A-Za-z][^>]*>`,
	)
	withoutHiddenElements := requiredTextElement.ReplaceAllStringFunc(
		source,
		func(candidate string) string {
			openingTagEnd := strings.IndexByte(candidate, '>')
			if openingTagEnd >= 0 && hiddenRequiredTextElementPattern.MatchString(candidate[:openingTagEnd+1]) {
				return ""
			}
			return candidate
		},
	)
	nonBodyAttribute := regexp.MustCompile(
		`(?is)\b(?:placeholder|aria-label|title)\s*=\s*(?:"[^"]*` +
			escaped +
			`[^"]*"|'[^']*` +
			escaped +
			`[^']*')`,
	)
	withoutAttributes := nonBodyAttribute.ReplaceAllString(withoutHiddenElements, "")
	documentTitle := regexp.MustCompile(
		`(?is)<title\b[^>]*>[^<]*` + escaped + `[^<]*</title>|` +
			`document\.title\s*=\s*(?:"[^"]*` + escaped +
			`[^"]*"|'[^']*` + escaped + `[^']*')`,
	)
	withoutMetadata := documentTitle.ReplaceAllString(withoutAttributes, "")
	identifierPattern := regexp.MustCompile(`[A-Za-z_$][A-Za-z0-9_$]*`)
	withoutContainingIdentifiers := identifierPattern.ReplaceAllStringFunc(
		withoutMetadata,
		func(identifier string) string {
			if identifier != required && strings.Contains(identifier, required) {
				return ""
			}
			return identifier
		},
	)
	return strings.Contains(withoutContainingIdentifiers, required)
}

func (s *GeneratorService) consumeGenerationContentChunk(
	providerName string,
	chunk *llm.StreamChunk,
	fullContent *strings.Builder,
	reasoningBuffer *reasoningStreamBuffer,
	handler StreamEventHandler,
) error {
	if chunk == nil || len(chunk.Choices) == 0 || chunk.Choices[0].Delta == nil {
		return nil
	}
	content, reasoning := extractStreamDeltaParts(chunk.Choices[0].Delta)
	if content == "" && reasoning == "" {
		return nil
	}
	if content != "" {
		fullContent.WriteString(content)
		if err := handler(StreamEventChunk, map[string]interface{}{
			"provider": providerName,
			"content":  content,
		}); err != nil {
			return err
		}
	}
	if reasoning != "" {
		if err := reasoningBuffer.Append(reasoning); err != nil {
			return err
		}
	}
	return nil
}
