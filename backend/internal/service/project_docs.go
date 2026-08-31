package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"yistack/internal/model"
)

const (
	projectAgentsPath                  = ".yistack/AGENTS.md"
	projectContextPath                 = ".yistack/PROJECT_CONTEXT.md"
	projectDocsManifestPath            = ".yistack/PROJECT_DOCS_MANIFEST.json"
	projectRequirementsPath            = ".yistack/docs/REQUIREMENTS.md"
	projectDesignPath                  = ".yistack/docs/DESIGN.md"
	projectRunbookPath                 = ".yistack/docs/RUNBOOK.md"
	projectBootstrapStatePath          = ".yistack/foundation/bootstrap_state.json"
	projectFoundationBriefPath         = ".yistack/foundation/foundation-brief.md"
	projectFoundationEngineeringPath   = ".yistack/foundation/engineering-policy.md"
	projectFoundationArchitecturePath  = ".yistack/foundation/architecture-lifecycle-spec.md"
	projectFoundationDeferredDecisions = ".yistack/foundation/deferred-decisions.md"

	ProjectBootstrapStatePath = projectBootstrapStatePath
)

// ProjectFoundationArtifactPaths returns the canonical Foundation artifact paths.
func ProjectFoundationArtifactPaths() []string {
	return []string{
		projectFoundationBriefPath,
		projectFoundationEngineeringPath,
		projectFoundationArchitecturePath,
		projectFoundationDeferredDecisions,
	}
}

type projectPlanSnapshot struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	TechStack    json.RawMessage `json:"tech_stack"`
	Architecture string          `json:"architecture"`
	Features     []string        `json:"features"`
	Reasoning    string          `json:"reasoning"`
}

type projectDocTemplateData struct {
	ProjectName        string
	ProjectDescription string
	Description        string
	RuntimeProfile     string
	AppType            string
	PlanID             string
	PlanName           string
	PlanDescription    string
	TechStack          string
	Architecture       string
	Features           string
	FeatureList        string
	GeneratedFiles     string
	Reasoning          string
	DirectoryPath      string
	ContainerStatus    string
	ContainerPort      int
	LastPrompt         string
	CommandList        string
}

type projectDocsManifest struct {
	SchemaVersion  string                        `json:"schema_version"`
	ProjectID      string                        `json:"project_id"`
	ProjectName    string                        `json:"project_name"`
	Revision       int                           `json:"revision"`
	UpdatedAt      string                        `json:"updated_at"`
	Source         string                        `json:"source"`
	PlanID         string                        `json:"plan_id"`
	RuntimeProfile string                        `json:"runtime_profile"`
	PromptDigest   string                        `json:"prompt_digest"`
	PromptSummary  string                        `json:"prompt_summary"`
	Documents      []projectDocsManifestDocument `json:"documents"`
	GeneratedFiles []string                      `json:"generated_files"`
	Commands       []string                      `json:"commands"`
}

type projectDocsManifestDocument struct {
	Path      string `json:"path"`
	Checksum  string `json:"checksum"`
	Revision  int    `json:"revision"`
	UpdatedAt string `json:"updated_at"`
	Source    string `json:"source"`
}

// buildProjectDocTemplateData 组装项目级 Markdown 模板渲染数据，避免文档内容继续内嵌在 Go 代码中。
func buildProjectDocTemplateData(project *model.Project, lastPrompt string, generatedFiles []FileToGenerate, commands []string) projectDocTemplateData {
	plan := parseProjectPlanSnapshot(project.PlanData)
	featuresBytes, _ := json.Marshal(plan.Features)
	techStack := strings.TrimSpace(project.TechStack)
	if techStack == "" && len(plan.TechStack) > 0 {
		techStack = string(plan.TechStack)
	}

	return projectDocTemplateData{
		ProjectName:        project.Name,
		ProjectDescription: fallbackText(project.Description, "暂无项目描述"),
		Description:        fallbackText(project.Description, "暂无项目描述"),
		RuntimeProfile:     fallbackText(projectRuntimeProfile(project), "待确定"),
		AppType:            fallbackText(project.AppType, "web"),
		PlanID:             fallbackText(project.PlanID, "未选择"),
		PlanName:           fallbackText(plan.Name, "未选择方案"),
		PlanDescription:    fallbackText(plan.Description, "暂无方案说明"),
		TechStack:          fallbackText(techStack, "{}"),
		Architecture:       fallbackText(plan.Architecture, ""),
		Features:           fallbackText(string(featuresBytes), "[]"),
		FeatureList:        bulletList(plan.Features, "待补充功能清单"),
		GeneratedFiles:     bulletGeneratedFiles(generatedFiles),
		Reasoning:          fallbackText(plan.Reasoning, "待补充设计理由"),
		DirectoryPath:      fallbackText(project.DirectoryPath, "未初始化"),
		ContainerStatus:    fallbackText(project.ContainerStatus, "stopped"),
		ContainerPort:      project.ContainerPort,
		LastPrompt:         fallbackText(strings.TrimSpace(lastPrompt), "暂无新的实现指令"),
		CommandList:        bulletList(commands, "暂无推荐命令"),
	}
}

func parseProjectPlanSnapshot(planData string) projectPlanSnapshot {
	if strings.TrimSpace(planData) == "" {
		return projectPlanSnapshot{}
	}
	var plan projectPlanSnapshot
	if err := json.Unmarshal([]byte(planData), &plan); err != nil {
		return projectPlanSnapshot{}
	}
	return plan
}

func bulletList(items []string, empty string) string {
	if len(items) == 0 {
		return "- " + empty
	}
	lines := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		lines = append(lines, "- "+item)
	}
	if len(lines) == 0 {
		return "- " + empty
	}
	return strings.Join(lines, "\n")
}

func bulletGeneratedFiles(files []FileToGenerate) string {
	if len(files) == 0 {
		return "- 当前尚未生成业务文件"
	}
	lines := make([]string, 0, len(files))
	for _, file := range files {
		lines = append(lines, fmt.Sprintf("- `%s`", file.Path))
	}
	return strings.Join(lines, "\n")
}

func fallbackText(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func buildProjectDocsManifestContent(project *model.Project, prompt string, docs []FileToGenerate, generatedFiles []FileToGenerate, commands []string, previousManifest string, now time.Time) string {
	if project == nil {
		return ""
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	updatedAt := now.UTC().Format(time.RFC3339)
	previous := parseProjectDocsManifest(previousManifest)
	previousDocs := make(map[string]projectDocsManifestDocument, len(previous.Documents))
	for _, doc := range previous.Documents {
		if strings.TrimSpace(doc.Path) == "" {
			continue
		}
		previousDocs[doc.Path] = doc
	}

	documents := make([]projectDocsManifestDocument, 0, len(docs))
	for _, doc := range docs {
		path := strings.TrimSpace(doc.Path)
		content := strings.TrimSpace(doc.Content)
		if path == "" || content == "" || path == projectDocsManifestPath {
			continue
		}
		checksum := projectDocsContentChecksum(content)
		revision := 1
		if previousDoc, ok := previousDocs[path]; ok {
			revision = previousDoc.Revision
			if revision <= 0 {
				revision = 1
			}
			if previousDoc.Checksum != checksum {
				revision++
			}
		}
		documents = append(documents, projectDocsManifestDocument{
			Path:      path,
			Checksum:  checksum,
			Revision:  revision,
			UpdatedAt: updatedAt,
			Source:    "generation_finalize",
		})
	}
	sort.Slice(documents, func(i, j int) bool {
		return documents[i].Path < documents[j].Path
	})

	revision := previous.Revision + 1
	if revision <= 0 {
		revision = 1
	}
	manifest := projectDocsManifest{
		SchemaVersion:  "v1",
		ProjectID:      strings.TrimSpace(project.ProjectID),
		ProjectName:    strings.TrimSpace(project.Name),
		Revision:       revision,
		UpdatedAt:      updatedAt,
		Source:         "generation_finalize",
		PlanID:         strings.TrimSpace(project.PlanID),
		RuntimeProfile: projectRuntimeProfile(project),
		PromptDigest:   projectDocsContentChecksum(prompt),
		PromptSummary:  projectDocsPromptSummary(prompt),
		Documents:      documents,
		GeneratedFiles: projectDocsFilePaths(generatedFiles),
		Commands:       projectDocsCommands(commands),
	}
	content, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return ""
	}
	return string(content) + "\n"
}

func parseProjectDocsManifest(raw string) projectDocsManifest {
	var manifest projectDocsManifest
	if strings.TrimSpace(raw) == "" {
		return manifest
	}
	if err := json.Unmarshal([]byte(raw), &manifest); err != nil {
		return projectDocsManifest{}
	}
	return manifest
}

func projectDocsContentChecksum(content string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(content)))
	return hex.EncodeToString(sum[:])
}

func projectDocsPromptSummary(prompt string) string {
	prompt = strings.Join(strings.Fields(strings.TrimSpace(prompt)), " ")
	runes := []rune(prompt)
	if len(runes) <= 240 {
		return prompt
	}
	return string(runes[:240])
}

func projectDocsFilePaths(files []FileToGenerate) []string {
	paths := make([]string, 0, len(files))
	seen := map[string]struct{}{}
	for _, file := range files {
		path := strings.TrimSpace(file.Path)
		if path == "" {
			continue
		}
		if _, exists := seen[path]; exists {
			continue
		}
		seen[path] = struct{}{}
		paths = append(paths, path)
	}
	sort.Strings(paths)
	return paths
}

func projectDocsCommands(commands []string) []string {
	items := make([]string, 0, len(commands))
	for _, command := range commands {
		command = strings.TrimSpace(command)
		if command != "" {
			items = append(items, command)
		}
	}
	return items
}
