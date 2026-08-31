package llm

import (
	"context"
	"encoding/json"
	"strings"
	"time"
)

const deterministicProviderModel = "yistack-deterministic-dev"

// DeterministicProvider is an explicit local development provider.
// It is intended for repeatable contract validation when external LLM credentials are unavailable.
type DeterministicProvider struct{}

func NewDeterministicProvider() *DeterministicProvider {
	return &DeterministicProvider{}
}

func (p *DeterministicProvider) Chat(ctx context.Context, messages []Message, opts ...Option) (*ChatResponse, error) {
	req := &ChatRequest{
		Model:       deterministicProviderModel,
		Temperature: 0.0,
		Messages:    messages,
	}
	for _, opt := range opts {
		opt(req)
	}
	content := buildDeterministicCompletion(req.Messages)
	return &ChatResponse{
		ID:    "deterministic-" + time.Now().UTC().Format("20060102150405"),
		Model: firstDeterministicValue(req.Model, deterministicProviderModel),
		Choices: []Choice{{
			Index: 0,
			Message: Message{
				Role:    "assistant",
				Content: content,
			},
			FinishReason: "stop",
		}},
		Usage: Usage{
			PromptTokens:     countDeterministicTokens(messagesText(messages)),
			CompletionTokens: countDeterministicTokens(content),
			TotalTokens:      countDeterministicTokens(messagesText(messages)) + countDeterministicTokens(content),
		},
	}, nil
}

func (p *DeterministicProvider) StreamChat(ctx context.Context, messages []Message, handler StreamChunkHandler, opts ...Option) error {
	req := &ChatRequest{
		Model:       deterministicProviderModel,
		Temperature: 0.0,
		Messages:    messages,
		Stream:      true,
	}
	for _, opt := range opts {
		opt(req)
	}
	content := buildDeterministicCompletion(req.Messages)
	for _, chunkContent := range splitDeterministicStreamChunks(content) {
		if err := ctx.Err(); err != nil {
			return err
		}
		if handler == nil {
			continue
		}
		if err := handler(&StreamChunk{
			ID:    "deterministic-stream",
			Model: firstDeterministicValue(req.Model, deterministicProviderModel),
			Choices: []StreamChoice{{
				Index: 0,
				Delta: map[string]interface{}{
					"content": chunkContent,
				},
			}},
		}); err != nil {
			return err
		}
	}
	return nil
}

func buildDeterministicCompletion(messages []Message) string {
	systemPrompt := deterministicMessageByRole(messages, "system")
	userPrompt := deterministicMessageByRole(messages, "user")
	combined := strings.ToLower(systemPrompt + "\n" + userPrompt)
	switch {
	case strings.Contains(combined, "每个方案输出为一行紧凑 json 对象") ||
		strings.Contains(combined, "每个方案单独占一行") ||
		strings.Contains(combined, "每一行都是完整 json 对象"):
		return deterministicPlanLines()
	case strings.Contains(combined, "只输出合法 json 数组"):
		return deterministicPlanJSONArray()
	case strings.Contains(combined, "只输出自然语言分析") ||
		strings.Contains(combined, "请先给出技术方案分析"):
		return deterministicPlanAnalysis()
	case strings.Contains(combined, "generation_repair.v1"):
		return deterministicRepairResult(systemPrompt)
	case strings.Contains(combined, "应用生成助手") || strings.Contains(combined, "generation_result.v2"):
		return deterministicGenerationResult(messages)
	case strings.Contains(combined, "<<plans_json>>"):
		return deterministicPlanAnalysis() + "\n\n<<PLANS_JSON>>\n" + deterministicPlanJSONArray()
	default:
		return "这是本地确定性开发 provider 返回的稳定响应，用于验证主链路契约。"
	}
}

func deterministicPlanAnalysis() string {
	return strings.Join([]string{
		"我会把当前需求收敛为一个可预览的 Web 应用主链路。",
		"技术方向优先选择 Next.js 与 TypeScript，因为它能同时覆盖页面、交互状态和轻量服务扩展。",
		"核心取舍是先保证需求输入、方案选择、生成文件和预览入口稳定，再扩展复杂后端能力。",
		"模块上应拆分为首页需求入口、项目状态、核心页面组件、运行文档和验收说明。",
		"主要风险来自外部 LLM 凭证、容器运行时、依赖安装和预览端口占用。",
		"推荐采用最小依赖的 Next.js 单体方案，便于 LT-02 阶段把生成到预览闭环跑通并保留后续扩展空间。",
	}, "")
}

func deterministicPlanLines() string {
	plans := deterministicPlans()
	lines := make([]string, 0, len(plans))
	for _, plan := range plans {
		encoded, _ := json.Marshal(plan)
		lines = append(lines, string(encoded))
	}
	return strings.Join(lines, "\n")
}

func deterministicPlanJSONArray() string {
	encoded, _ := json.Marshal(deterministicPlans())
	return string(encoded)
}

func deterministicPlans() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          "plan_nextjs_core_loop",
			"name":        "Next.js 核心生成闭环",
			"description": "使用 Next.js、TypeScript 和 Tailwind CSS 构建可预览的生成结果页面，优先保证从需求到运行预览的主路径。",
			"tech_stack": map[string]interface{}{
				"runtime": map[string]interface{}{
					"profile":         "node-nextjs",
					"needs_container": true,
					"package_manager": "pnpm",
					"languages": []map[string]string{
						{"name": "node", "version": "20"},
						{"name": "typescript", "version": "5"},
					},
				},
				"frontend": map[string]string{
					"language":  "TypeScript",
					"framework": "Next.js",
					"ui":        "Tailwind CSS",
				},
				"summary": []string{"TypeScript", "Next.js", "Tailwind CSS"},
			},
			"architecture": "单体前端应用承载主页面、状态摘要和预览入口，后续可通过 API Route 或外部服务扩展数据能力。",
			"complexity":   "simple",
			"est_files":    4,
			"features":     []string{"需求摘要", "生成状态展示", "预览入口", "验收说明"},
			"reasoning":    "该方案依赖最少，能最快验证 LT-02 的生成、写入、工作区展示和预览闭环。",
		},
		{
			"id":          "plan_react_dashboard",
			"name":        "React 状态看板",
			"description": "使用 React 构建轻量状态看板，适合后续作为 Workspace 子页面扩展。",
			"tech_stack": map[string]interface{}{
				"runtime": map[string]interface{}{
					"profile":         "node-react",
					"needs_container": true,
					"package_manager": "pnpm",
					"languages": []map[string]string{
						{"name": "node", "version": "20"},
						{"name": "typescript", "version": "5"},
					},
				},
				"frontend": map[string]string{
					"language":  "TypeScript",
					"framework": "React",
					"ui":        "Tailwind CSS",
				},
				"summary": []string{"TypeScript", "React", "Tailwind CSS"},
			},
			"architecture": "独立 React 前端聚焦交互看板，通过后续 API 接入项目状态和生成事件。",
			"complexity":   "medium",
			"est_files":    5,
			"features":     []string{"任务看板", "阶段状态", "文件摘要"},
			"reasoning":    "该方案适合交互密集型 Workspace，但 LT-02 主链路验证成本高于 Next.js 单体方案。",
		},
	}
}

func deterministicGenerationResult(messages []Message) string {
	result := map[string]interface{}{
		"schema_version": "generation_result.v2",
		"operations": []map[string]string{
			{
				"operation":   "create",
				"path":        "package.json",
				"description": "Next.js 项目运行脚本",
				"content": strings.Join([]string{
					"{",
					"  \"name\": \"lt02-core-generation-loop\",",
					"  \"version\": \"0.1.0\",",
					"  \"private\": true,",
					"  \"scripts\": {",
					"    \"dev\": \"node server.js\",",
					"    \"build\": \"node --check server.js\",",
					"    \"start\": \"node server.js\"",
					"  },",
					"  \"dependencies\": {},",
					"  \"devDependencies\": {}",
					"}",
					"",
				}, "\n"),
			},
			{
				"operation":   "create",
				"path":        "tsconfig.json",
				"description": "TypeScript 编译配置",
				"content": strings.Join([]string{
					"{",
					"  \"compilerOptions\": {",
					"    \"target\": \"es2017\",",
					"    \"lib\": [\"dom\", \"dom.iterable\", \"esnext\"],",
					"    \"allowJs\": true,",
					"    \"skipLibCheck\": true,",
					"    \"strict\": true,",
					"    \"noEmit\": true,",
					"    \"esModuleInterop\": true,",
					"    \"module\": \"esnext\",",
					"    \"moduleResolution\": \"bundler\",",
					"    \"resolveJsonModule\": true,",
					"    \"isolatedModules\": true,",
					"    \"jsx\": \"preserve\",",
					"    \"incremental\": true",
					"  },",
					"  \"include\": [\"next-env.d.ts\", \"**/*.ts\", \"**/*.tsx\"],",
					"  \"exclude\": [\"node_modules\"]",
					"}",
					"",
				}, "\n"),
			},
			{
				"operation":   "create",
				"path":        "src/app/layout.tsx",
				"description": "Next.js App Router 根布局",
				"content": strings.Join([]string{
					"import type { ReactNode } from 'react';",
					"",
					"export default function RootLayout({ children }: { children: ReactNode }) {",
					"  return (",
					"    <html lang=\"zh-CN\">",
					"      <body>{children}</body>",
					"    </html>",
					"  );",
					"}",
					"",
				}, "\n"),
			},
			{
				"operation":   "create",
				"path":        "src/app/page.tsx",
				"description": "LT-02 生成闭环可预览首页",
				"content": strings.Join([]string{
					"const acceptanceItems = [",
					"  '需求输入已进入项目主链路',",
					"  '方案选择后生成稳定页面文件',",
					"  'Workspace 可查看生成产物',",
					"  'Preview 可打开运行结果',",
					"];",
					"",
					"export default function Home() {",
					"  return (",
					"    <main className=\"min-h-screen bg-slate-950 px-8 py-12 text-white\">",
					"      <section className=\"mx-auto max-w-4xl space-y-8\">",
					"        <p className=\"text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300\">LT-02 Preview</p>",
					"        <div className=\"space-y-4\">",
					"          <h1 className=\"text-4xl font-bold\">核心生成产品闭环已生成</h1>",
					"          <p className=\"text-lg text-slate-300\">这是由本地确定性开发 provider 生成的可运行页面，用于验证从需求、方案、代码生成到预览的完整主路径。</p>",
					"        </div>",
					"        <div className=\"grid gap-3 sm:grid-cols-2\">",
					"          {acceptanceItems.map((item) => (",
					"            <div key={item} className=\"rounded-2xl border border-cyan-400/30 bg-white/10 p-4 text-sm text-slate-100\">",
					"              {item}",
					"            </div>",
					"          ))}",
					"        </div>",
					"      </section>",
					"    </main>",
					"  );",
					"}",
					"",
				}, "\n"),
			},
			{
				"operation":   "create",
				"path":        "server.js",
				"description": "无外部依赖的 Preview HTTP server",
				"content": strings.Join([]string{
					"const http = require('http');",
					"",
					"const html = `<!doctype html>",
					"<html lang=\"zh-CN\">",
					"  <head>",
					"    <meta charset=\"utf-8\" />",
					"    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
					"    <title>LT-02 Preview</title>",
					"    <style>",
					"      body { margin: 0; font-family: Arial, sans-serif; background: #020617; color: #f8fafc; }",
					"      main { min-height: 100vh; padding: 48px 32px; }",
					"      section { max-width: 880px; margin: 0 auto; }",
					"      .eyebrow { color: #67e8f9; font-weight: 700; letter-spacing: .3em; text-transform: uppercase; }",
					"      h1 { font-size: 42px; margin: 24px 0 12px; }",
					"      p { color: #cbd5e1; font-size: 18px; line-height: 1.7; }",
					"      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 32px; }",
					"      .card { border: 1px solid rgba(34,211,238,.35); border-radius: 18px; padding: 16px; background: rgba(255,255,255,.08); }",
					"    </style>",
					"  </head>",
					"  <body>",
					"    <main>",
					"      <section>",
					"        <div class=\"eyebrow\">LT-02 Preview</div>",
					"        <h1>核心生成产品闭环已生成</h1>",
					"        <p>这是由本地确定性开发 provider 生成的可运行页面，用于验证从需求、方案、代码生成到预览的完整主路径。</p>",
					"        <div class=\"grid\">",
					"          <div class=\"card\">需求输入已进入项目主链路</div>",
					"          <div class=\"card\">方案选择后生成稳定页面文件</div>",
					"          <div class=\"card\">Workspace 可查看生成产物</div>",
					"          <div class=\"card\">Preview 可打开运行结果</div>",
					"        </div>",
					"      </section>",
					"    </main>",
					"  </body>",
					"</html>`;",
					"",
					"const server = http.createServer((request, response) => {",
					"  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });",
					"  response.end(html);",
					"});",
					"",
					"server.listen(3000, '0.0.0.0', () => {",
					"  console.log('LT-02 preview server listening on 3000');",
					"});",
					"",
				}, "\n"),
			},
			{
				"operation":   "create",
				"path":        "LT02_ACCEPTANCE.md",
				"description": "LT-02 验收说明",
				"content": strings.Join([]string{
					"# LT-02 Acceptance",
					"",
					"- Open the generated workspace file list.",
					"- Confirm `src/app/page.tsx` exists.",
					"- Start the project runtime and open Preview.",
					"- Confirm the page displays `核心生成产品闭环已生成`.",
					"",
				}, "\n"),
			},
		},
		"message":  "LT-02 核心生成产品闭环的确定性开发产物已生成。",
		"commands": []string{},
	}
	if hashes := deterministicWorkspaceSnapshotHashes(messages); len(hashes) > 0 {
		operations := result["operations"].([]map[string]string)
		for index := range operations {
			if baseHash := hashes[operations[index]["path"]]; baseHash != "" {
				operations[index]["operation"] = "replace"
				operations[index]["base_hash"] = baseHash
			}
		}
	}
	encoded, _ := json.Marshal(result)
	return string(encoded)
}

func deterministicMessageByRole(messages []Message, role string) string {
	var builder strings.Builder
	for _, message := range messages {
		if strings.EqualFold(strings.TrimSpace(message.Role), role) {
			builder.WriteString(message.Content)
			builder.WriteString("\n")
		}
	}
	return builder.String()
}

func messagesText(messages []Message) string {
	var builder strings.Builder
	for _, message := range messages {
		builder.WriteString(message.Role)
		builder.WriteString(":")
		builder.WriteString(message.Content)
		builder.WriteString("\n")
	}
	return builder.String()
}

func splitDeterministicStreamChunks(content string) []string {
	if content == "" {
		return []string{""}
	}
	if strings.Contains(content, "\n") {
		lines := strings.SplitAfter(content, "\n")
		chunks := make([]string, 0, len(lines))
		for _, line := range lines {
			if line == "" {
				continue
			}
			chunks = append(chunks, line)
		}
		return chunks
	}
	const chunkSize = 96
	chunks := []string{}
	runes := []rune(content)
	for len(runes) > chunkSize {
		chunks = append(chunks, string(runes[:chunkSize]))
		runes = runes[chunkSize:]
	}
	if len(runes) > 0 {
		chunks = append(chunks, string(runes))
	}
	return chunks
}

func countDeterministicTokens(value string) int {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	return len(strings.Fields(trimmed))
}

func firstDeterministicValue(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

type deterministicWorkspaceSnapshot struct {
	Files []struct {
		Path   string `json:"path"`
		SHA256 string `json:"sha256"`
	} `json:"files"`
}

type deterministicRepairContext struct {
	AllowedPaths []string `json:"allowed_paths"`
	Files        []struct {
		Path    string `json:"path"`
		Exists  bool   `json:"exists"`
		SHA256  string `json:"sha256"`
		Content string `json:"content"`
	} `json:"files"`
}

func deterministicWorkspaceSnapshotHashes(messages []Message) map[string]string {
	text := deterministicMessageByRole(messages, "system")
	markerIndex := strings.Index(text, "当前项目文件快照（生成开始时的只读真源）")
	if markerIndex < 0 {
		return nil
	}
	var snapshot deterministicWorkspaceSnapshot
	if !decodeDeterministicJSONAfter(text[markerIndex:], `{"files":`, &snapshot) {
		return nil
	}
	hashes := make(map[string]string, len(snapshot.Files))
	for _, file := range snapshot.Files {
		if strings.TrimSpace(file.Path) != "" && strings.TrimSpace(file.SHA256) != "" {
			hashes[file.Path] = file.SHA256
		}
	}
	return hashes
}

func decodeDeterministicJSONAfter(text, prefix string, target any) bool {
	start := strings.Index(text, prefix)
	if start < 0 {
		return false
	}
	decoder := json.NewDecoder(strings.NewReader(text[start:]))
	return decoder.Decode(target) == nil
}

func deterministicRepairResult(systemPrompt string) string {
	markerIndex := strings.Index(systemPrompt, "结构化修复上下文：")
	var repairContext deterministicRepairContext
	if markerIndex < 0 || !decodeDeterministicJSONAfter(systemPrompt[markerIndex:], `{"allowed_paths":`, &repairContext) {
		return `{"schema_version":"generation_repair.v1","operations":[],"message":"无法读取修复上下文"}`
	}

	operations := make([]map[string]any, 0, 1)
	for _, file := range repairContext.Files {
		if !file.Exists {
			operations = append(operations, map[string]any{
				"operation": "create", "path": file.Path,
				"content": "// deterministic repair\n", "description": "确定性修复",
			})
			break
		}
		if file.Content == "" {
			operations = append(operations, map[string]any{
				"operation": "replace", "path": file.Path, "base_hash": file.SHA256,
				"content": "// deterministic repair\n", "description": "确定性修复",
			})
			break
		}
		oldText := file.Content
		newText := oldText + "\n"
		if strings.Contains(oldText, "bad") {
			oldText = "bad"
			newText = "good"
		}
		if oldText != "" {
			operations = append(operations, map[string]any{
				"operation": "patch", "path": file.Path, "base_hash": file.SHA256,
				"edits":       []map[string]string{{"old_text": oldText, "new_text": newText}},
				"description": "确定性修复",
			})
			break
		}
	}
	if len(operations) == 0 && len(repairContext.AllowedPaths) > 0 {
		operations = append(operations, map[string]any{
			"operation": "create", "path": repairContext.AllowedPaths[0],
			"content": "// deterministic repair\n", "description": "确定性修复",
		})
	}
	encoded, _ := json.Marshal(map[string]any{
		"schema_version": "generation_repair.v1", "operations": operations,
		"message": "本地确定性 provider 已生成受限修复操作。",
	})
	return string(encoded)
}
