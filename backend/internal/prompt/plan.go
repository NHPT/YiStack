package prompt

import (
	"strings"
)

func buildPlanPromptData(description, appType, language, analysis, userFeedback, currentPlanSummary, foundationContext string) map[string]string {
	return map[string]string{
		"Description":        strings.TrimSpace(description),
		"AppType":            strings.TrimSpace(appType),
		"Language":           strings.TrimSpace(language),
		"Analysis":           strings.TrimSpace(analysis),
		"UserFeedback":       strings.TrimSpace(userFeedback),
		"CurrentPlanSummary": strings.TrimSpace(currentPlanSummary),
		"FoundationContext":  strings.TrimSpace(foundationContext),
	}
}

// BuildPlanSystemPrompt 组装方案生成的系统提示词，并附加统一的输出协议约束。
func BuildPlanSystemPrompt(override string) string {
	base := sanitizePlanPromptOverride(override)
	if base == "" {
		base = renderPromptTemplate("plan_system.tmpl", nil)
	}

	protocol := renderPromptTemplate("plan_output_protocol.tmpl", nil)
	if protocol == "" {
		return strings.TrimSpace(base)
	}
	if strings.TrimSpace(base) == "" {
		return protocol
	}

	return strings.TrimSpace(base) + "\n\n" + protocol
}

// BuildPlanUserPrompt 组装方案生成的用户上下文，保持不同入口的输入格式一致。
func BuildPlanUserPrompt(description, appType, language, userFeedback, currentPlanSummary, foundationContext string) string {
	return renderPromptTemplate("plan_user.tmpl", buildPlanPromptData(description, appType, language, "", userFeedback, currentPlanSummary, foundationContext))
}

// BuildPlanAnalysisSystemPrompt 组装仅用于流式分析阶段的系统提示词。
func BuildPlanAnalysisSystemPrompt(override string) string {
	base := sanitizePlanPromptOverride(override)
	if base == "" {
		base = renderPromptTemplate("plan_analysis_system.tmpl", nil)
	}
	return strings.TrimSpace(base)
}

// BuildPlanAnalysisUserPrompt 组装仅用于流式分析阶段的用户提示词。
func BuildPlanAnalysisUserPrompt(description, appType, language, userFeedback, currentPlanSummary, foundationContext string) string {
	return renderPromptTemplate("plan_analysis_user.tmpl", buildPlanPromptData(description, appType, language, "", userFeedback, currentPlanSummary, foundationContext))
}

// BuildPlanJSONSystemPrompt 组装仅输出方案 JSON 的系统提示词。
func BuildPlanJSONSystemPrompt(override string) string {
	base := sanitizePlanPromptOverride(override)
	if base == "" {
		base = renderPromptTemplate("plan_json_system.tmpl", nil)
	}
	return strings.TrimSpace(base)
}

// BuildPlanJSONUserPrompt 组装仅输出方案 JSON 的用户提示词。
func BuildPlanJSONUserPrompt(description, appType, language, analysis, userFeedback, currentPlanSummary, foundationContext string) string {
	return renderPromptTemplate("plan_json_user.tmpl", buildPlanPromptData(description, appType, language, analysis, userFeedback, currentPlanSummary, foundationContext))
}

// BuildPlanLineSystemPrompt 组装按行输出方案 JSON 的系统提示词。
func BuildPlanLineSystemPrompt(override string) string {
	base := sanitizePlanPromptOverride(override)
	if base == "" {
		base = renderPromptTemplate("plan_lines_system.tmpl", nil)
	}
	return strings.TrimSpace(base)
}

// BuildPlanLineUserPrompt 组装按行输出方案 JSON 的用户提示词。
func BuildPlanLineUserPrompt(description, appType, language, analysis, userFeedback, currentPlanSummary, foundationContext string) string {
	return renderPromptTemplate("plan_lines_user.tmpl", buildPlanPromptData(description, appType, language, analysis, userFeedback, currentPlanSummary, foundationContext))
}

// sanitizePlanPromptOverride 清理旧配置里与新流式协议冲突的指令，避免要求模型“只能输出 JSON”。
func sanitizePlanPromptOverride(value string) string {
	replacer := strings.NewReplacer(
		"每个方案必须严格以 JSON 格式输出，包含以下字段：", "",
		"请以 JSON 数组格式输出所有方案，不要输出其他内容。", "",
	)
	return strings.TrimSpace(replacer.Replace(value))
}
