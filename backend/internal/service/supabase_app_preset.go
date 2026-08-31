package service

import (
	"encoding/json"
	"fmt"
	pathpkg "path"
	"regexp"
	"sort"
	"strings"

	"yistack/internal/model"
)

const supabaseAppPresetVersion = "supabase_app.v1"

var (
	supabaseServiceRoleAssignmentPattern = regexp.MustCompile(
		`(?i)SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([A-Za-z0-9._-]{24,})`,
	)
	supabaseClientServiceRolePattern = regexp.MustCompile(
		`(?i)(NEXT_PUBLIC_|VITE_|PUBLIC_)[A-Z0-9_]*SERVICE_ROLE`,
	)
)

func projectRequestsSupabaseAppPreset(req *GenerateRequest, project *model.Project) bool {
	values := []string{requestPlanContext(req), requestPrompt(req)}
	if project != nil {
		values = append(values, project.TechStack, project.PlanData)
	}
	for _, value := range values {
		if structuredSupabasePreset(value) || explicitSupabaseRequest(value) {
			return true
		}
	}
	return false
}

func requestPlanContext(req *GenerateRequest) string {
	if req == nil {
		return ""
	}
	return req.PlanContext
}

func requestPrompt(req *GenerateRequest) string {
	if req == nil {
		return ""
	}
	return req.Prompt
}

func structuredSupabasePreset(raw string) bool {
	var value any
	if json.Unmarshal([]byte(strings.TrimSpace(raw)), &value) != nil {
		return false
	}
	return jsonContainsSupabasePreset(value)
}

func jsonContainsSupabasePreset(value any) bool {
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			normalizedKey := strings.ToLower(strings.TrimSpace(key))
			if (normalizedKey == "preset" || normalizedKey == "provider" ||
				normalizedKey == "database" || normalizedKey == "backend") &&
				strings.EqualFold(strings.TrimSpace(fmt.Sprint(item)), "supabase") {
				return true
			}
			if jsonContainsSupabasePreset(item) {
				return true
			}
		}
	case []any:
		for _, item := range typed {
			if jsonContainsSupabasePreset(item) {
				return true
			}
		}
	case string:
		return strings.EqualFold(strings.TrimSpace(typed), "supabase")
	}
	return false
}

func explicitSupabaseRequest(raw string) bool {
	normalized := strings.ToLower(strings.Join(strings.Fields(raw), " "))
	if normalized == "" || !strings.Contains(normalized, "supabase") {
		return false
	}
	for _, negative := range []string{
		"do not use supabase", "don't use supabase", "without supabase",
		"不使用 supabase", "不要使用 supabase",
	} {
		if strings.Contains(normalized, negative) {
			return false
		}
	}
	return true
}

func appendSupabaseAppPresetContext(projectContext string, req *GenerateRequest, project *model.Project) string {
	if !projectRequestsSupabaseAppPreset(req, project) {
		return projectContext
	}
	section := strings.Join([]string{
		"Supabase 应用后端预设（" + supabaseAppPresetVersion + "，强制）：",
		"- 使用 Supabase Auth；业务表必须以 user_id uuid not null references auth.users(id) on delete cascade 绑定所有者。",
		"- 在 supabase/migrations 生成建表、索引、enable row level security 以及 SELECT/INSERT/UPDATE/DELETE owner policy；policy 必须使用 auth.uid()。",
		"- 在 supabase/rollback 生成对应 rollback SQL；只回滚本预设创建的对象。",
		"- Storage 使用私有 bucket；storage.objects 读写 policy 按 auth.uid() 隔离，对象路径第一段必须是用户 UUID。",
		"- 生成 TypeScript Database 类型和 .env.example；示例值只能是明显占位符。",
		"- 浏览器只能读取公开 URL/anon key；SUPABASE_SERVICE_ROLE_KEY 只能由 server-only 服务端模块在运行时读取。",
		"- service role key 不得进入浏览器变量、源码字面量、Git、日志、API 响应或错误消息；普通用户 CRUD 必须使用用户 session。",
	}, "\n")
	return strings.TrimSpace(strings.Join([]string{projectContext, section}, "\n\n"))
}

func validateSupabaseAppPresetOperations(
	req *GenerateRequest,
	project *model.Project,
	operations []GenerationFileOperation,
	snapshot *GenerationWorkspaceSnapshot,
) error {
	if !projectRequestsSupabaseAppPreset(req, project) {
		return nil
	}
	files, err := materializeGenerationFiles(operations, snapshot)
	if err != nil {
		return err
	}
	if err := validateSupabaseSecretBoundary(files); err != nil {
		return err
	}
	if !supabaseScaffoldIntroduced(operations, snapshot) {
		return nil
	}

	required := []struct {
		name  string
		match func(string, string) bool
	}{
		{"forward migration", func(filePath, content string) bool {
			return strings.HasPrefix(filePath, "supabase/migrations/") &&
				strings.HasSuffix(filePath, ".sql") &&
				containsAllFold(content, "enable row level security", "auth.uid()", "create policy")
		}},
		{"rollback migration", func(filePath, _ string) bool {
			return strings.HasPrefix(filePath, "supabase/rollback/") &&
				strings.HasSuffix(filePath, ".sql")
		}},
		{"generated database types", func(filePath, content string) bool {
			return strings.HasSuffix(filePath, "database.types.ts") &&
				strings.Contains(content, "export type Database")
		}},
		{"environment example", func(filePath, content string) bool {
			return pathpkg.Base(filePath) == ".env.example" &&
				containsAllFold(content, "SUPABASE_URL", "SUPABASE_ANON_KEY")
		}},
		{"auth integration", func(_, content string) bool {
			return strings.Contains(content, "signInWithPassword") ||
				strings.Contains(content, "signUp(") ||
				strings.Contains(content, ".auth.getUser(")
		}},
	}
	for _, requirement := range required {
		if !containsSupabasePresetArtifact(files, requirement.match) {
			return fmt.Errorf("%s requires %s", supabaseAppPresetVersion, requirement.name)
		}
	}

	migrations := joinedFiles(files, "supabase/migrations/", ".sql")
	for _, requiredSQL := range []string{
		"references auth.users", "for select", "for insert", "for update", "for delete",
		"storage.objects", "storage.buckets", "false", "storage.foldername",
	} {
		if !strings.Contains(strings.ToLower(migrations), requiredSQL) {
			return fmt.Errorf("%s forward SQL is missing %q", supabaseAppPresetVersion, requiredSQL)
		}
	}
	return nil
}

func materializeGenerationFiles(
	operations []GenerationFileOperation,
	snapshot *GenerationWorkspaceSnapshot,
) (map[string]string, error) {
	files := map[string]string{}
	if snapshot != nil {
		for _, file := range snapshot.Files {
			files[file.Path] = file.Content
		}
	}
	for index, operation := range operations {
		switch operation.Operation {
		case GenerationFileOperationCreate, GenerationFileOperationReplace:
			files[operation.Path] = operation.Content
		case GenerationFileOperationPatch:
			content, ok := files[operation.Path]
			if !ok {
				return nil, fmt.Errorf(
					"operations[%d] cannot validate Supabase patch for missing %q",
					index,
					operation.Path,
				)
			}
			patched, err := applyGenerationTextEdits(content, operation.Edits)
			if err != nil {
				return nil, fmt.Errorf("operations[%d].%w", index, err)
			}
			files[operation.Path] = patched
		case GenerationFileOperationDelete:
			delete(files, operation.Path)
		}
	}
	return files, nil
}

func validateSupabaseSecretBoundary(files map[string]string) error {
	paths := make([]string, 0, len(files))
	for filePath := range files {
		paths = append(paths, filePath)
	}
	sort.Strings(paths)
	for _, filePath := range paths {
		if err := validateGeneratedSupabaseSecretContent(filePath, files[filePath]); err != nil {
			return err
		}
	}
	return nil
}

func isSupabasePlaceholder(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	return strings.Contains(normalized, "your_") ||
		strings.Contains(normalized, "your-") ||
		strings.Contains(normalized, "example") ||
		strings.Contains(normalized, "placeholder") ||
		strings.Contains(normalized, "changeme")
}

func looksLikeBrowserModule(filePath, content string) bool {
	lowerPath := strings.ToLower(filePath)
	return strings.Contains(content, `"use client"`) ||
		strings.Contains(content, `'use client'`) ||
		strings.Contains(content, "import.meta.env") ||
		strings.Contains(lowerPath, "/client.") ||
		strings.HasPrefix(lowerPath, "src/client")
}

func supabaseScaffoldIntroduced(operations []GenerationFileOperation, snapshot *GenerationWorkspaceSnapshot) bool {
	if snapshot != nil {
		for _, file := range snapshot.Files {
			if strings.Contains(strings.ToLower(file.Content), "@supabase/supabase-js") ||
				strings.HasPrefix(file.Path, "supabase/migrations/") {
				return false
			}
		}
	}
	for _, operation := range operations {
		if strings.Contains(strings.ToLower(operation.Content), "@supabase/supabase-js") ||
			strings.HasPrefix(operation.Path, "supabase/migrations/") {
			return true
		}
	}
	return false
}

func containsSupabasePresetArtifact(files map[string]string, match func(string, string) bool) bool {
	for filePath, content := range files {
		if match(filePath, content) {
			return true
		}
	}
	return false
}

func containsAllFold(content string, needles ...string) bool {
	lower := strings.ToLower(content)
	for _, needle := range needles {
		if !strings.Contains(lower, strings.ToLower(needle)) {
			return false
		}
	}
	return true
}

func joinedFiles(files map[string]string, prefix, suffix string) string {
	contents := make([]string, 0)
	for filePath, content := range files {
		if strings.HasPrefix(filePath, prefix) && strings.HasSuffix(filePath, suffix) {
			contents = append(contents, content)
		}
	}
	sort.Strings(contents)
	return strings.Join(contents, "\n")
}

func validateGeneratedSupabaseSecretContent(filePath, content string) error {
	if match := supabaseServiceRoleAssignmentPattern.FindStringSubmatch(content); len(match) == 2 &&
		!isSupabasePlaceholder(match[1]) {
		return fmt.Errorf("%s forbids a committed SUPABASE_SERVICE_ROLE_KEY value in %q", supabaseAppPresetVersion, filePath)
	}
	if supabaseClientServiceRolePattern.MatchString(content) {
		return fmt.Errorf("%s forbids browser-exposed service role variables in %q", supabaseAppPresetVersion, filePath)
	}
	if strings.Contains(content, "SUPABASE_SERVICE_ROLE_KEY") && looksLikeBrowserModule(filePath, content) {
		return fmt.Errorf("%s requires SUPABASE_SERVICE_ROLE_KEY to stay in a server-only module; found in %q", supabaseAppPresetVersion, filePath)
	}
	if requiresServerOnlySupabaseBoundary(filePath, content) && !strings.Contains(content, `"server-only"`) &&
		!strings.Contains(content, `'server-only'`) {
		return fmt.Errorf("%s requires a server-only import for SUPABASE_SERVICE_ROLE_KEY in %q", supabaseAppPresetVersion, filePath)
	}
	if err := validateGeneratedEnvironmentExample(filePath, content); err != nil {
		return err
	}
	return nil
}

func validateGeneratedEnvironmentExample(filePath, content string) error {
	if pathpkg.Base(strings.ToLower(strings.TrimSpace(filePath))) != ".env.example" {
		return nil
	}
	for lineNumber, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" {
			return fmt.Errorf(".env.example line %d must use KEY=placeholder", lineNumber+1)
		}
		value := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		if value == "" || isSupabasePlaceholder(value) ||
			strings.Contains(value, "localhost") || strings.Contains(value, "127.0.0.1") {
			continue
		}
		return fmt.Errorf(".env.example line %d must contain a placeholder, not a runtime value", lineNumber+1)
	}
	return nil
}

func requiresServerOnlySupabaseBoundary(filePath, content string) bool {
	lowerPath := strings.ToLower(filePath)
	if !strings.Contains(content, "SUPABASE_SERVICE_ROLE_KEY") ||
		pathpkg.Base(lowerPath) == ".env.example" ||
		strings.Contains(lowerPath, "/test") || strings.Contains(lowerPath, "tests/") {
		return false
	}
	return strings.HasPrefix(lowerPath, "src/") || strings.HasPrefix(lowerPath, "app/")
}
