package service

import (
	"context"
	"encoding/json"
	"strings"

	"yistack/config"
	"yistack/pkg/llm"
)

type guidanceAction struct {
	Label  string `json:"label"`
	Kind   string `json:"kind"`
	Prompt string `json:"prompt,omitempty"`
}

type responseGuidance struct {
	SuggestedQuestions []string         `json:"suggestedQuestions"`
	SuggestedActions   []guidanceAction `json:"suggestedActions"`
}

func buildDynamicGuidance(
	ctx context.Context,
	llmClient *llm.ProviderManager,
	llmCfg *config.LLMConfig,
	requestedProvider string,
	requestedModel string,
	stage string,
	userInput string,
	assistantContent string,
	contextSummary string,
) responseGuidance {
	if llmClient == nil || strings.TrimSpace(assistantContent) == "" {
		return responseGuidance{}
	}

	systemPrompt := strings.Join([]string{
		"你是 YiStack 的对话引导生成器。",
		"请根据用户刚刚的输入、助手刚刚的回答和当前阶段，生成真实、具体、贴合上下文的后续问题或操作。",
		"不要输出固定套话，不要重复助手已经完整回答过的问题。",
		"只输出 JSON，不要 Markdown，不要解释。",
		`JSON 格式：{"suggestedQuestions":["问题1","问题2"],"suggestedActions":[{"label":"短标签","kind":"send_prompt","prompt":"用户点击后发送的完整文本"}]}`,
		"要求：suggestedQuestions 生成 2 到 3 条；suggestedActions 生成 1 到 2 条；label 不超过 12 个中文字符；kind 只能是 send_prompt。",
		"如果当前阶段是方案确认，建议可以包含追问、补充约束、比较方案，但不要直接替用户启动实现。",
	}, "\n")

	userPrompt := strings.Join([]string{
		"当前阶段：" + strings.TrimSpace(stage),
		"用户输入：",
		truncateForGuidance(userInput, 1200),
		"助手回答：",
		truncateForGuidance(assistantContent, 2400),
		"上下文：",
		truncateForGuidance(contextSummary, 1800),
	}, "\n\n")

	modelName := resolveModelForProvider(llmClient, llmCfg, initialProviderName(llmClient, requestedProvider), requestedModel)
	resp, _, _, err := chatWithProviderFallback(ctx, llmClient, llmCfg, requestedProvider, requestedModel, &llm.ChatRequest{
		Model:       modelName,
		Temperature: 0.3,
		Messages: []llm.Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}, nil)
	if err != nil || resp == nil || len(resp.Choices) == 0 {
		return responseGuidance{}
	}

	message := ""
	if len(resp.Choices) > 0 {
		message = resp.Choices[0].Message.Content
	}
	return normalizeGuidance(parseGuidanceJSON(message))
}

func parseGuidanceJSON(raw string) responseGuidance {
	content := strings.TrimSpace(raw)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var guidance responseGuidance
	if err := json.Unmarshal([]byte(content), &guidance); err == nil {
		return guidance
	}

	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end > start {
		_ = json.Unmarshal([]byte(content[start:end+1]), &guidance)
	}
	return guidance
}

func normalizeGuidance(guidance responseGuidance) responseGuidance {
	seenQuestions := make(map[string]bool)
	questions := make([]string, 0, 3)
	for _, question := range guidance.SuggestedQuestions {
		question = strings.TrimSpace(question)
		if question == "" || seenQuestions[question] {
			continue
		}
		seenQuestions[question] = true
		questions = append(questions, question)
		if len(questions) >= 3 {
			break
		}
	}

	actions := make([]guidanceAction, 0, 2)
	for _, action := range guidance.SuggestedActions {
		label := strings.TrimSpace(action.Label)
		prompt := strings.TrimSpace(action.Prompt)
		if label == "" || prompt == "" {
			continue
		}
		actions = append(actions, guidanceAction{
			Label:  label,
			Kind:   "send_prompt",
			Prompt: prompt,
		})
		if len(actions) >= 2 {
			break
		}
	}

	return responseGuidance{
		SuggestedQuestions: questions,
		SuggestedActions:   actions,
	}
}

func truncateForGuidance(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit] + "\n..."
}
