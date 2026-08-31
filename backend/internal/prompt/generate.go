package prompt

import "strings"

const GenerationResultSchemaVersion = "generation_result.v2"

// GenerationResultProtocol 返回不可由 Admin Prompt 覆盖的实现结果协议。
func GenerationResultProtocol() string {
	return strings.Join([]string{
		"只输出一个合法 JSON 对象，不得输出 Markdown 代码围栏、解释文字或第二个 JSON 值。",
		"根对象必须且只能包含 schema_version、operations、message、commands。",
		`schema_version 必须为 "` + GenerationResultSchemaVersion + `"。`,
		"operations 必须是非空数组；每个项目路径最多出现一次，path 必须是项目内安全相对路径。",
		`operations 中每个元素必须直接是 JSON 对象，不得把对象再次编码成字符串；相邻对象必须使用 },{ 分隔，严禁写成 },"{"operation。`,
		"create 必须且只能包含 operation、path、content、description；仅用于当前不存在的文件。",
		"replace 必须且只能包含 operation、path、base_hash、content、description；base_hash 必须来自当前项目文件快照。",
		"patch 必须且只能包含 operation、path、base_hash、edits、description；每个 edit 必须且只能包含 old_text、new_text，old_text 必须在当前文本中唯一匹配。",
		"delete 必须且只能包含 operation、path、base_hash、description。",
		"不得操作 .git、.yistack、.env、私钥或凭据文件，不得覆盖存在未提交用户修改的路径。",
		"message 必须是非空字符串。",
		"commands 必须是字符串数组；没有命令时必须输出空数组 []。",
		"commands 只允许使用系统明确许可的依赖准备命令；不得执行 build/test/lint、启动服务、项目脚本、代码生成、删除操作、提权、跨项目路径访问、管道、重定向或后台执行。",
		"系统追加的当前项目稳定上下文必须严格参考；如有冲突，优先遵循靠前来源和仓库真实事实。",
		"示例：",
		`{"schema_version":"` + GenerationResultSchemaVersion + `","operations":[{"operation":"create","path":"src/app/layout.tsx","content":"export default function Layout({ children }) { return children }","description":"应用布局"},{"operation":"create","path":"src/app/page.tsx","content":"export default function Page() { return null }","description":"应用首页"}],"message":"已生成应用入口","commands":[]}`,
	}, "\n")
}

// BuildGenerateSystemPrompt 组装实现模式下的系统提示词，并注入运行配置、稳定上下文与联网决策。
func BuildGenerateSystemPrompt(override, runtimeProfile, projectContext, onlineContext string) string {
	base := strings.TrimSpace(override)
	if base == "" {
		base = renderPromptTemplate("generate_system.tmpl", map[string]string{
			"RuntimeProfile": strings.TrimSpace(runtimeProfile),
			"ProjectContext": strings.TrimSpace(projectContext),
			"OnlineContext":  strings.TrimSpace(onlineContext),
		})
		return appendPromptContextSections(base,
			buildPromptFactSection("生成结果协议（强制）", GenerationResultProtocol()),
			buildPromptFactSection("运行时最小工程契约（强制）", GenerationRuntimeRequirements(runtimeProfile)),
		)
	}

	return appendPromptContextSections(base,
		buildPromptFactSection("生成结果协议（强制）", GenerationResultProtocol()),
		buildPromptFactSection("运行配置", runtimeProfile),
		buildPromptFactSection("运行时最小工程契约（强制）", GenerationRuntimeRequirements(runtimeProfile)),
		buildPromptFactSection("当前项目稳定上下文", projectContext),
		buildPromptFactSection("联网上下文", onlineContext),
	)
}
