package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"yistack/internal/model"
)

type projectPromptContextSource struct {
	Title    string
	Priority int
	Content  string
}

type projectPromptContextSpec struct {
	Title    string
	Priority int
	Path     string
	Required bool
}

type ProjectPromptContextConflictError struct {
	ProjectID string
	Reasons   []string
}

func (e *ProjectPromptContextConflictError) Error() string {
	if e == nil {
		return ""
	}
	if len(e.Reasons) == 0 {
		return "project prompt context conflict detected"
	}
	return "project prompt context conflict detected: " + strings.Join(e.Reasons, "; ")
}

var projectPromptContextSpecs = []projectPromptContextSpec{
	{Title: "Foundation 结构化状态", Priority: 1, Path: projectBootstrapStatePath, Required: true},
	{Title: "Foundation Brief", Priority: 2, Path: projectFoundationBriefPath},
	{Title: "Engineering Policy", Priority: 3, Path: projectFoundationEngineeringPath},
	{Title: "Architecture / Lifecycle Spec", Priority: 4, Path: projectFoundationArchitecturePath},
	{Title: "Deferred Decisions", Priority: 5, Path: projectFoundationDeferredDecisions},
	{Title: "项目级稳定上下文", Priority: 6, Path: projectContextPath},
	{Title: "项目级文档维护清单", Priority: 7, Path: projectDocsManifestPath},
}

func buildProjectPromptContextBundle(projectID string, sources []projectPromptContextSource) string {
	normalizedProjectID := strings.TrimSpace(projectID)
	orderedSources := append([]projectPromptContextSource(nil), sources...)
	sort.SliceStable(orderedSources, func(i, j int) bool {
		return orderedSources[i].Priority < orderedSources[j].Priority
	})
	sections := make([]string, 0, len(sources)+8)
	sections = append(sections,
		"以下内容仅来自当前项目命名空间，请勿引用其他项目的上下文、摘要或历史结论。",
		fmt.Sprintf("当前项目命名空间：%s", firstNonEmpty(normalizedProjectID, "unknown")),
		"上下文优先级从高到低如下：",
		"1. Foundation 结构化状态 / EngineeringState",
		"2. 已确认 Foundation 工件",
		"3. 当前项目稳定上下文",
		"4. 项目级 supporting docs 维护清单",
		"5. 当前仓库代码 / 配置 / 文档事实",
		"6. 项目聊天历史与压缩摘要（仅作补充，不得覆盖以上真源）",
	)

	for _, source := range orderedSources {
		content := strings.TrimSpace(source.Content)
		if content == "" {
			continue
		}
		sections = append(sections, fmt.Sprintf("[P%d] %s\n%s", source.Priority, source.Title, content))
	}

	return strings.TrimSpace(strings.Join(sections, "\n\n"))
}

func (s *GeneratorService) loadProjectPromptContext(ctx context.Context, project *model.Project) (string, error) {
	if s == nil || project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return "", nil
	}
	if !projectNeedsRuntime(project.AppType) {
		return "", nil
	}

	sources := make([]projectPromptContextSource, 0, len(projectPromptContextSpecs))
	sourceByPath := make(map[string]string, len(projectPromptContextSpecs))
	readFailures := make([]string, 0, len(projectPromptContextSpecs))
	for _, spec := range projectPromptContextSpecs {
		content, found, err := s.loadProjectPromptContextSource(ctx, project, spec)
		if err != nil {
			readFailures = append(readFailures, fmt.Sprintf("%s 读取失败：%s", spec.Path, err.Error()))
			continue
		}
		if !found || strings.TrimSpace(content) == "" {
			if spec.Required {
				readFailures = append(readFailures, fmt.Sprintf("缺少 %s，Project Foundation 尚未完成", spec.Path))
			}
			continue
		}
		sourceByPath[spec.Path] = content
		content = buildProjectPromptContextSourceContent(spec, content)
		sources = append(sources, projectPromptContextSource{
			Title:    spec.Title,
			Priority: spec.Priority,
			Content:  content,
		})
	}

	bundle := buildProjectPromptContextBundle(project.ProjectID, sources)
	conflicts := detectProjectPromptContextConflicts(
		project.ProjectID,
		project.AppType,
		sourceByPath[projectContextPath],
		sourceByPath[projectBootstrapStatePath],
	)
	if len(conflicts) > 0 {
		return bundle, &ProjectPromptContextConflictError{
			ProjectID: project.ProjectID,
			Reasons:   conflicts,
		}
	}
	if len(readFailures) > 0 {
		return bundle, &ProjectPromptContextConflictError{
			ProjectID: project.ProjectID,
			Reasons:   readFailures,
		}
	}
	return bundle, nil
}

func (s *GeneratorService) loadProjectPromptContextSource(ctx context.Context, project *model.Project, spec projectPromptContextSpec) (string, bool, error) {
	if s == nil || project == nil || strings.TrimSpace(spec.Path) == "" {
		return "", false, nil
	}
	if content, found, err := s.loadProjectArtifactRecord(ctx, project.ProjectID, spec.Path); err != nil {
		return "", false, err
	} else if found {
		return content, true, nil
	}
	if s.containerMgr == nil {
		if spec.Required {
			s.persistGenerationContainerUnavailable(ctx, project)
			return "", false, fmt.Errorf("container manager not available")
		}
		return "", false, nil
	}
	content, err := readOptionalProjectFileInContainer(ctx, s.containerMgr, project.ProjectID, spec.Path)
	if err != nil {
		if spec.Required {
			return "", false, err
		}
		return "", false, nil
	}
	if strings.TrimSpace(content) == "" {
		return "", false, nil
	}
	return content, true, nil
}

func buildProjectPromptContextSourceContent(spec projectPromptContextSpec, content string) string {
	trimmedContent := strings.TrimSpace(content)
	if strings.TrimSpace(spec.Path) != projectBootstrapStatePath {
		return trimmedContent
	}
	summary := BuildFoundationDesignReadinessPromptSummary(trimmedContent)
	if summary == "" {
		return trimmedContent
	}
	return strings.TrimSpace(trimmedContent + "\n\n" + summary)
}

type bootstrapStateEnvelope struct {
	SchemaVersion string                 `json:"schema_version"`
	UpdatedAt     string                 `json:"updated_at"`
	State         map[string]interface{} `json:"state"`
}

func BuildFoundationDesignReadinessPromptSummary(content string) string {
	if strings.TrimSpace(content) == "" {
		return ""
	}
	var envelope bootstrapStateEnvelope
	if err := json.Unmarshal([]byte(content), &envelope); err != nil {
		return ""
	}
	designReadiness, ok := envelope.State["design_readiness"].(map[string]interface{})
	if !ok {
		return ""
	}
	status := strings.TrimSpace(stringValue(designReadiness["status"]))
	if status == "" {
		return ""
	}
	lines := []string{
		"生成前设计 readiness 摘要：",
		"- 状态：" + status,
		"- 技术栈与运行时：" + readinessFactLabel(boolValue(designReadiness["tech_stack_ready"])),
		"- 架构边界：" + readinessFactLabel(boolValue(designReadiness["architecture_ready"])),
		"- 目录结构：" + readinessFactLabel(boolValue(designReadiness["directory_structure_ready"])),
		"- 接口契约：" + readinessFactLabel(boolValue(designReadiness["interface_contract_ready"])),
		"- 数据模型：" + readinessFactLabel(boolValue(designReadiness["data_model_ready"])),
	}
	missingItems := stringSliceValue(designReadiness["missing_items"])
	if len(missingItems) > 0 {
		lines = append(lines, "- 缺失项："+strings.Join(missingItems, "、"))
	}
	return strings.Join(lines, "\n")
}

func readinessFactLabel(ready bool) string {
	if ready {
		return "ready"
	}
	return "blocked"
}

func detectProjectPromptContextConflicts(projectID, appType, projectContext, bootstrapState string) []string {
	reasons := make([]string, 0, 4)

	projectID = strings.TrimSpace(projectID)
	appType = strings.TrimSpace(appType)

	contextProjectID := extractMarkdownBulletValue(projectContext, "项目 ID")
	if contextProjectID != "" && projectID != "" && !strings.EqualFold(contextProjectID, projectID) {
		reasons = append(reasons, fmt.Sprintf("%s 项目 ID=%s，与当前项目 %s 不一致", projectContextPath, contextProjectID, projectID))
	}

	contextAppType := extractMarkdownBulletValue(projectContext, "应用类型")
	if contextAppType != "" && appType != "" && !strings.EqualFold(contextAppType, appType) {
		reasons = append(reasons, fmt.Sprintf("%s 应用类型=%s，与当前应用类型 %s 不一致", projectContextPath, contextAppType, appType))
	}

	if strings.TrimSpace(bootstrapState) != "" {
		var envelope bootstrapStateEnvelope
		if err := json.Unmarshal([]byte(bootstrapState), &envelope); err != nil {
			reasons = append(reasons, fmt.Sprintf("%s 不是合法 JSON", projectBootstrapStatePath))
		} else {
			stateProjectType := strings.TrimSpace(stringValue(envelope.State["project_type"]))
			if stateProjectType != "" && appType != "" && strings.Contains(strings.ToLower(stateProjectType), "admin") && !strings.Contains(strings.ToLower(appType), "admin") {
				reasons = append(reasons, fmt.Sprintf("%s project_type=%s，与当前应用类型 %s 不一致", projectBootstrapStatePath, stateProjectType, appType))
			}
		}
	}

	return reasons
}

func extractMarkdownBulletValue(content, label string) string {
	normalizedLabel := strings.TrimSpace(label)
	if normalizedLabel == "" {
		return ""
	}
	for _, rawLine := range strings.Split(content, "\n") {
		line := strings.TrimSpace(rawLine)
		if !strings.HasPrefix(line, "- ") {
			continue
		}
		body := strings.TrimSpace(strings.TrimPrefix(line, "- "))
		prefix := normalizedLabel + "："
		if strings.HasPrefix(body, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(body, prefix))
		}
	}
	return ""
}

func stringValue(value interface{}) string {
	if value == nil {
		return ""
	}
	if typed, ok := value.(string); ok {
		return typed
	}
	return fmt.Sprintf("%v", value)
}

func boolValue(value interface{}) bool {
	typed, ok := value.(bool)
	if !ok {
		return false
	}
	return typed
}

func stringSliceValue(value interface{}) []string {
	items, ok := value.([]interface{})
	if !ok {
		return nil
	}
	values := make([]string, 0, len(items))
	for _, item := range items {
		text := strings.TrimSpace(stringValue(item))
		if text == "" {
			continue
		}
		values = append(values, text)
	}
	return values
}
