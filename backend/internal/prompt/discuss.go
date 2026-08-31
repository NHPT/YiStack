package prompt

import "strings"

// BuildDiscussSystemPrompt 组装探讨模式的系统提示词，明确限制模型只做分析与建议，不直接声称已执行实现。
func BuildDiscussSystemPrompt(override, projectName, runtimeProfile, appType, onlineModeText, projectContext, onlineContext string) string {
	base := strings.TrimSpace(override)
	if base == "" {
		return renderDefaultDiscussSystemPrompt(projectName, runtimeProfile, appType, onlineModeText, projectContext, onlineContext)
	}

	return appendPromptContextSections(base,
		buildDiscussProjectFacts(projectName, runtimeProfile, appType, onlineModeText),
		buildPromptFactSection("项目上下文", projectContext),
		buildPromptFactSection("联网上下文", onlineContext),
	)
}
