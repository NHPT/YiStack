package prompt

import "strings"

// GenerationRuntimeRequirements returns the minimum runnable scaffold required by the selected runtime.
func GenerationRuntimeRequirements(runtimeProfile string) string {
	switch strings.ToLower(strings.TrimSpace(runtimeProfile)) {
	case "static-html", "static":
		return "必须创建项目根目录 index.html（或 public/index.html）作为可见入口；不得只创建其他名称的 HTML 页面。"
	case "node-react":
		return "必须创建 package.json、index.html 和源码入口；package.json 文件内容必须是解码后可直接解析的 JSON，禁止把换行或引号写成字面量反斜杠转义；必须声明 react、react-dom、vite 依赖并提供可通过的 build 脚本及可绑定 0.0.0.0、接受 PORT/--port 的 dev 脚本；React JSX 必须启用 @vitejs/plugin-react 的 react() 插件，或在每个使用 JSX 的文件显式 import React，确保浏览器无 React is not defined。表格 JSX 必须保持 table -> thead/tbody -> tr -> th/td 的合法层级，禁止 tr 直接嵌套 tr。使用 Supabase 或其他可选外部服务时，缺少环境变量必须进入确定性本地 demo/fixture 模式；必须先检查全部配置再创建客户端，禁止在模块顶层用空值或伪造 URL/key 调用 createClient，build、preview 和 GET / 不得依赖外部凭据或网络。"
	case "node-vue":
		return "必须创建 package.json、index.html 和源码入口；package.json 文件内容必须是解码后可直接解析的 JSON；必须声明 vue、vite 依赖并提供可通过的 build 脚本及可绑定 0.0.0.0、接受 PORT/--port 的 dev 脚本。"
	case "node-nextjs", "node-next":
		return "必须创建 package.json 和可从 GET / 访问的 Next.js 根页面；使用 App Router 时必须创建 app/page.tsx 与 app/layout.tsx，或同时创建 src/app/page.tsx 与 src/app/layout.tsx，禁止只创建子路由 page.tsx；package.json 必须声明 next/react/react-dom，并提供 build、dev、start 脚本；使用 Next.js 13 时必须将 next 精确固定为 13.5.6，禁止使用不存在的 13.5.0；TypeScript 项目必须在 devDependencies 中将 typescript 精确固定为 5.4.5，禁止使用 latest、^、~ 或 6/7 等未验证主版本；服务必须绑定 0.0.0.0 并接受 PORT；禁止使用未配置的 @/ 导入别名，只有同批 tsconfig.json/jsconfig.json 明确包含可匹配实际文件位置的 baseUrl 和 paths 时才能使用，否则必须使用从导入文件出发的可解析相对路径，例如 app/page.tsx 导入 app/components/Card.tsx 应使用 ./components/Card；使用 useState、useEffect 或浏览器事件的文件必须以 \"use client\" 开头，纯服务端展示不得无故引入客户端 Hook。表格 JSX 必须保持 table -> thead/tbody -> tr -> th/td 的合法层级，禁止 tr 直接嵌套 tr。服务端渲染确定性本地数据必须同步读取，禁止在 render 中使用 await new Promise、setTimeout 或其他假延迟；loading 状态使用 app/loading.tsx、src/app/loading.tsx 或无延迟的确定性界面。使用 Supabase 或其他可选外部服务时，缺少环境变量必须进入确定性本地 demo/fixture 模式；必须先检查全部配置再创建客户端，禁止在模块顶层用空值或伪造 URL/key 调用 createClient，build、preview 和 GET / 不得依赖外部凭据或网络。"
	case "node-express", "node":
		return "必须创建 package.json 和服务入口；package.json 必须声明运行依赖并提供 start 或 dev 脚本；服务必须绑定 0.0.0.0、使用 PORT，并在 GET / 返回可浏览页面。"
	case "go-gin", "go-fiber", "go":
		return "必须创建 go.mod、可编译的 Go 服务入口和项目根目录 index.html；Go 代码必须通过 go build ./...、go test ./...、go vet ./...，浏览器根页面不得依赖外部服务。"
	case "python-fastapi", "python-django", "python-flask", "python":
		return "必须创建 requirements.txt 或 pyproject.toml、可编译的 Python 服务入口和项目根目录 index.html；依赖安装与 python3 -m compileall . 必须通过，浏览器根页面不得依赖外部凭据。Python 模块直接位于项目根目录且由 uvicorn main:app 或 pytest 从根目录导入时，必须使用无点号的绝对导入，禁止使用 from .module 相对导入。使用 Jinja2Templates 时必须按 Starlette 1.x 接口调用 TemplateResponse(request=request, name=\"index.html\", context=...)，禁止旧式 TemplateResponse(name, context) 位置参数。FastAPI 异步测试使用 httpx 时必须创建 ASGITransport(app=app)，再使用 AsyncClient(transport=transport, base_url=...)；禁止使用已移除的 AsyncClient(app=...) 参数。使用进程内可变存储的测试必须彼此隔离，每个测试前重建应用模块或通过 fixture 清空状态，禁止依赖测试执行顺序。"
	default:
		return "必须生成与 runtime profile 匹配的完整可运行入口、依赖清单和启动脚本，并满足项目级 build/test/lint Gate。"
	}
}
