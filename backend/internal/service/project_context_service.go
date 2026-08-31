package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"yistack/internal/model"
)

// parsePlanSummary 将方案 JSON 解析为通用 map，便于抽取上下文摘要字段。
func parsePlanSummary(planDataRaw string) map[string]interface{} {
	var planData map[string]interface{}
	if strings.TrimSpace(planDataRaw) == "" {
		return map[string]interface{}{}
	}
	if err := json.Unmarshal([]byte(planDataRaw), &planData); err != nil {
		return map[string]interface{}{}
	}
	return planData
}

// stringifyPlanField 统一把方案字段转成可读字符串，兼容字符串、数组和其他基础类型。
func stringifyPlanField(planData map[string]interface{}, key string) string {
	value, ok := planData[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case []interface{}:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			parts = append(parts, fmt.Sprintf("%v", item))
		}
		return strings.Join(parts, "、")
	default:
		return fmt.Sprintf("%v", typed)
	}
}

// buildProjectContextContent 组装稳定的项目上下文文件内容，供后续生成链路持续复用。
func buildProjectContextContent(project *model.Project, lastPrompt string, generatedFiles []FileToGenerate, commands []string) string {
	if project == nil || project.DirectoryPath == "" {
		return ""
	}

	planData := parsePlanSummary(project.PlanData)
	techStack := strings.Join(techStackDisplayLabelsString(project.TechStack), "、")
	if techStack == "" {
		techStack = stringifyPlanField(planData, "tech_stack")
	}
	if techStack == "" {
		techStack = "待方案确认"
	}
	features := stringifyPlanField(planData, "features")
	if features == "" {
		features = "待方案确认"
	}
	architecture := stringifyPlanField(planData, "architecture")
	if architecture == "" {
		architecture = "待方案确认"
	}
	planName := stringifyPlanField(planData, "name")
	if planName == "" {
		planName = project.PlanID
	}
	if planName == "" {
		planName = "待确认"
	}

	fileLines := []string{"- 暂无"}
	if len(generatedFiles) > 0 {
		fileLines = make([]string, 0, len(generatedFiles))
		for _, generatedFile := range generatedFiles {
			fileLines = append(fileLines, fmt.Sprintf("- `%s`", generatedFile.Path))
		}
	}

	commandLines := []string{"- 暂无"}
	if len(commands) > 0 {
		commandLines = make([]string, 0, len(commands))
		for _, command := range commands {
			commandLines = append(commandLines, fmt.Sprintf("- `%s`", command))
		}
	}

	lastPromptText := strings.TrimSpace(lastPrompt)
	if lastPromptText == "" {
		lastPromptText = "暂无新的实现指令"
	}

	return fmt.Sprintf(`# .yistack/PROJECT_CONTEXT.md — %s

## 当前项目目标
%s

## 当前项目
- 项目 ID：%s
- 应用类型：%s
- 运行配置：%s
- 已确认方案：%s

## 技术方案摘要
- 技术栈：%s
- 核心功能：%s
- 架构说明：%s

## 最近一次实现指令
%s

## 最近生成文件
%s

## 最近执行命令
%s

## 使用约束
- 优先遵循用户最新需求与已确认技术方案
- 修改现有文件时保持目录结构与命名一致
- 新增文件前先判断是否能复用现有实现
`,
		project.Name,
		project.Description,
		project.ProjectID,
		project.AppType,
		defaultString(projectRuntimeProfile(project), "待确认"),
		planName,
		techStack,
		features,
		architecture,
		lastPromptText,
		strings.Join(fileLines, "\n"),
		strings.Join(commandLines, "\n"),
	)
}

// defaultString 返回带兜底值的字符串，用于文档生成时填补空字段。
func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
