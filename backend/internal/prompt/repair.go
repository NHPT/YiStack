package prompt

import "strings"

const GenerationRepairSchemaVersion = "generation_repair.v1"

// GenerationRepairProtocol 返回不可覆盖的有限自动修复协议。
func GenerationRepairProtocol() string {
	return strings.Join([]string{
		"只输出一个合法 JSON 对象，不得输出 Markdown、解释文字或第二个 JSON 值。",
		"根对象必须且只能包含 schema_version、operations、message。",
		"operations 必须是非空数组；Validation 未通过时不得返回空数组。",
		`schema_version 必须为 "` + GenerationRepairSchemaVersion + `"。`,
		"operations 使用 generation_result.v2 相同的 create/replace/patch/delete 单文件操作约束。",
		"每个操作的判别字段必须名为 operation；禁止使用 type、action、op 或其他别名。",
		"create 必须且只能包含 operation、path、content、description。",
		"replace 必须且只能包含 operation、path、base_hash、content、description。",
		"patch 必须且只能包含 operation、path、base_hash、edits、description；每个 edit 只能包含 old_text、new_text。",
		"delete 必须且只能包含 operation、path、base_hash、description。",
		"只能操作系统给出的 allowed_paths，不得新增范围外路径。",
		"每个 operation.path 必须逐字复制 allowed_paths 中的完整路径，保留目录前缀；例如 app/layout.tsx 中的 ./globals.css 对应 app/globals.css，不得缩写为 globals.css。",
		"files 中 exists=false 的 allowed_paths 可使用 create 创建；不得因为诊断要求的文件尚不存在而返回空 operations。",
		"files 中 exists=true 的路径禁止 create，必须使用携带当前 SHA-256 base_hash 的 patch、replace 或 delete；exists=false 的路径只能使用 create。",
		"patch 的每个 old_text 必须从本轮 files[].content 逐字复制，包含完全一致的空格、缩进和换行；不得凭记忆重写 patch 上下文。",
		"若 retry_instruction 要求 replace，则本轮禁止 patch 和 delete；必须基于本轮完整 files[].content 生成 replace.content。",
		`package.json 因字面量 \n、反斜杠或引号转义错误而无法解析时，必须返回可直接解析的标准 JSON；优先将完整 replace.content 写成紧凑单行 JSON，并确保它在外层 repair JSON 中仍是合法字符串。`,
		"Next.js 报 Cannot resolve 或 Can't resolve '@/...' 且 tsconfig/jsconfig 未配置匹配 paths 时，禁止改成另一个 @/ 前缀；必须使用从导入文件出发的相对路径，或完整补齐 baseUrl 与 paths。",
		"Next.js prerender 报 Expected workStore to be initialized 时，必须移除服务端 render 中的 await new Promise、setTimeout 或其他假延迟，并同步读取确定性本地数据；禁止 no-op patch。",
		`Next.js 在 Compiled successfully 后报告 The "id" argument must be of type string. Received undefined，且尝试重新安装 TypeScript 时，必须修复 package.json：将 devDependencies.typescript 精确固定为 5.4.5；不得仅修改页面源码。`,
		`Next.js 依赖安装报告 next-13.5.0.tgz Not Found 时，必须将 package.json dependencies.next 精确固定为 13.5.6。`,
		`Next.js prerender 报 supabaseUrl is required 时，必须修改所有实际调用 createClient 的源码模块，而不是只修改导入它们的页面；仅在 URL 与 anon key 同时存在后才能创建客户端，缺少配置时必须直接渲染确定性本地 demo/fixture，禁止使用伪造 URL/key 发起网络请求。`,
		`Python 报 attempted relative import with no known parent package 时，项目根目录模块必须将 from .module import 改为 from module import；包目录内的合法相对导入不得修改。`,
		`FastAPI 测试报告 AsyncClient.__init__() got an unexpected keyword argument 'app' 时，必须修改测试代码：创建 httpx.ASGITransport(app=app)，再使用 AsyncClient(transport=transport, base_url=...)；不得仅添加 pytest-asyncio 或原样 replace 文件。`,
		"进程内可变存储导致后续测试预期空集合却读到前序数据时，必须用 fixture 清空状态，或在每个测试创建 client 前 reload 应用模块并引用新 app；禁止依赖测试执行顺序或放宽断言。",
		"replace/patch/delete 必须使用本轮当前文件快照中的 SHA-256 base_hash。",
		"优先使用最小 patch；不得修改 .git、.yistack、secret、环境变量或私钥文件。",
		`示例：{"schema_version":"` + GenerationRepairSchemaVersion + `","operations":[{"operation":"patch","path":"src/app.ts","base_hash":"<当前 SHA-256>","edits":[{"old_text":"旧文本","new_text":"新文本"}],"description":"修复 Validation 失败"}],"message":"已修复项目"}`,
	}, "\n")
}
