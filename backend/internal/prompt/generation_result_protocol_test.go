package prompt

import (
	"strings"
	"testing"
)

func TestBuildGenerateSystemPromptAlwaysAppendsMandatoryResultProtocol(t *testing.T) {
	for _, override := range []string{"", "custom implement prompt"} {
		got := BuildGenerateSystemPrompt(override, "node-nextjs", "PROJECT_CONTEXT", "ONLINE_CONTEXT")
		for _, expected := range []string{
			"生成结果协议（强制）：",
			GenerationResultSchemaVersion,
			"schema_version、operations、message、commands",
			"不得输出 Markdown 代码围栏",
			"相邻对象必须使用 },{ 分隔",
		} {
			if !strings.Contains(got, expected) {
				t.Fatalf("override=%q expected mandatory protocol %q, got:\n%s", override, expected, got)
			}
		}
		if strings.Count(got, "PROJECT_CONTEXT") != 1 {
			t.Fatalf("override=%q expected project context once, got:\n%s", override, got)
		}
	}
}

func TestBuildGenerateSystemPromptAddsRuntimeScaffoldRequirements(t *testing.T) {
	tests := []struct {
		profile  string
		expected string
	}{
		{profile: "static-html", expected: "必须创建项目根目录 index.html"},
		{profile: "node-react", expected: "必须创建 package.json、index.html 和源码入口"},
		{profile: "node-react", expected: "@vitejs/plugin-react"},
		{profile: "node-react", expected: "浏览器无 React is not defined"},
		{profile: "node-react", expected: "禁止 tr 直接嵌套 tr"},
		{profile: "node-react", expected: "确定性本地 demo/fixture 模式"},
		{profile: "node-nextjs", expected: "提供 build、dev、start 脚本"},
		{profile: "node-nextjs", expected: "app/page.tsx 与 app/layout.tsx"},
		{profile: "node-nextjs", expected: "baseUrl 和 paths"},
		{profile: "node-nextjs", expected: "./components/Card"},
		{profile: "node-nextjs", expected: "use client"},
		{profile: "node-nextjs", expected: "table -> thead/tbody -> tr -> th/td"},
		{profile: "node-nextjs", expected: "禁止在 render 中使用 await new Promise"},
		{profile: "node-nextjs", expected: "next 精确固定为 13.5.6"},
		{profile: "node-nextjs", expected: "typescript 精确固定为 5.4.5"},
		{profile: "node-nextjs", expected: "禁止在模块顶层用空值或伪造 URL/key 调用 createClient"},
		{profile: "node-express", expected: "在 GET / 返回可浏览页面"},
		{profile: "go-gin", expected: "必须创建 go.mod"},
		{profile: "python-fastapi", expected: "必须创建 requirements.txt 或 pyproject.toml"},
		{profile: "python-fastapi", expected: "禁止使用 from .module 相对导入"},
		{profile: "python-fastapi", expected: `TemplateResponse(request=request, name="index.html"`},
		{profile: "python-fastapi", expected: "ASGITransport(app=app)"},
		{profile: "python-fastapi", expected: "使用进程内可变存储的测试必须彼此隔离"},
	}
	for _, test := range tests {
		got := BuildGenerateSystemPrompt("", test.profile, "", "")
		if !strings.Contains(got, "运行时最小工程契约（强制）") || !strings.Contains(got, test.expected) {
			t.Fatalf("profile=%q expected runtime requirement %q, got:\n%s", test.profile, test.expected, got)
		}
	}
}

func TestGenerationRepairProtocolUsesExactOperationField(t *testing.T) {
	got := GenerationRepairProtocol()
	for _, expected := range []string{
		GenerationRepairSchemaVersion,
		"判别字段必须名为 operation",
		"禁止使用 type、action、op",
		`"operation":"patch"`,
		"operations 必须是非空数组",
		"exists=false",
		"exists=true",
		"完整路径",
		"app/globals.css",
		"禁止改成另一个 @/ 前缀",
		"Expected workStore to be initialized",
		`The "id" argument must be of type string`,
		"devDependencies.typescript 精确固定为 5.4.5",
		"next-13.5.0.tgz Not Found",
		`package.json 因字面量 \n`,
		"supabaseUrl is required",
		"所有实际调用 createClient 的源码模块",
		"attempted relative import with no known parent package",
		"AsyncClient.__init__() got an unexpected keyword argument 'app'",
		"AsyncClient(transport=transport",
		"进程内可变存储导致后续测试",
	} {
		if !strings.Contains(got, expected) {
			t.Fatalf("expected repair protocol %q, got:\n%s", expected, got)
		}
	}
}
