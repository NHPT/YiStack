package prompt

import "strings"

const (
	ProjectPlansSystemPromptKey  = "prompt.project_plans.system"
	ChatDiscussSystemPromptKey   = "prompt.chat.discuss.system"
	ChatImplementSystemPromptKey = "prompt.chat.implement.system"
)

func appendPromptContextSections(base string, sections ...string) string {
	parts := []string{strings.TrimSpace(base)}
	for _, section := range sections {
		if trimmed := strings.TrimSpace(section); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return strings.Join(parts, "\n\n")
}

func buildPromptFactSection(title, content string) string {
	content = strings.TrimSpace(content)
	if content == "" {
		return ""
	}
	return title + "：\n" + content
}

func buildDiscussProjectFacts(projectName, runtimeProfile, appType, onlineModeText string) string {
	facts := []string{
		buildPromptFactLine("项目名称", projectName),
		buildPromptFactLine("运行配置", runtimeProfile),
		buildPromptFactLine("应用类型", appType),
		buildPromptFactLine("联网模式", onlineModeText),
	}
	compact := make([]string, 0, len(facts))
	for _, fact := range facts {
		if fact != "" {
			compact = append(compact, fact)
		}
	}
	if len(compact) == 0 {
		return ""
	}
	return "当前项目事实：\n" + strings.Join(compact, "\n")
}

func buildPromptFactLine(label, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return "- " + label + "：" + value
}

func renderDefaultDiscussSystemPrompt(projectName, runtimeProfile, appType, onlineModeText, projectContext, onlineContext string) string {
	return renderPromptTemplate("discuss_system.tmpl", map[string]string{
		"ProjectName":    strings.TrimSpace(projectName),
		"RuntimeProfile": strings.TrimSpace(runtimeProfile),
		"AppType":        strings.TrimSpace(appType),
		"OnlineModeText": strings.TrimSpace(onlineModeText),
		"ProjectContext": strings.TrimSpace(projectContext),
		"OnlineContext":  strings.TrimSpace(onlineContext),
	})
}
