package service

import (
	"path"
	"regexp"
	"strings"

	"yistack/internal/prompt"
)

var (
	viteBrowserProcessEnvPattern          = regexp.MustCompile(`\bprocess\.env\.(VITE_[A-Za-z_][A-Za-z0-9_]*)\b`)
	legacyTemplateResponsePattern         = regexp.MustCompile(`(?s)TemplateResponse\(\s*("[^"\r\n]*"|'[^'\r\n]*')\s*,\s*(\{[^)]*\})\s*\)`)
	pythonPerRequestStorePattern          = regexp.MustCompile(`(?m)^def (get_[A-Za-z0-9_]*store)\(\)\s*->\s*([A-Za-z_][A-Za-z0-9_]*):\n([ \t]+)return ([A-Za-z_][A-Za-z0-9_]*)\(\)\s*$`)
	pythonDatetimeImportPattern           = regexp.MustCompile(`(?m)^\s*(?:import\s+datetime(?:\s+as\s+\w+)?|from\s+datetime\s+import\s+[^\n#]*\bdatetime\b)`)
	viteDirectSupabasePattern             = regexp.MustCompile(`(?m)^const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*createClient\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)`)
	viteSupabaseCredentialFallbackPattern = regexp.MustCompile(`(import\.meta\.env\.VITE_SUPABASE_(?:URL|ANON_KEY)\s*(?:\|\||\?\?)\s*)(?:"[^"\r\n]+"|'[^'\r\n]+')`)
	nestedTableRowPattern                 = regexp.MustCompile(`(?s)<tr(\s[^>]*)?>\s*<tr(\s[^>]*)?>(.*?)</tr>\s*</tr>`)
	defaultFunctionComponentPattern       = regexp.MustCompile(`(?m)export\s+default\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(`)
	defaultComponentIdentifierPattern     = regexp.MustCompile(`(?m)export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;`)
	reactClientHookPattern                = regexp.MustCompile(`\buse(?:State|Effect|Reducer|Ref|Context|Memo|Callback|LayoutEffect|ImperativeHandle|Transition|DeferredValue|Id|SyncExternalStore|InsertionEffect)\s*\(`)
)

func deterministicGenerationRepairForValidation(
	files []GenerationRepairFileState,
	validation *ProjectValidationResult,
) (generationRepairResult, bool) {
	if result, ok := deterministicGenerationRepair(files, validation); ok {
		return result, true
	}
	if validation == nil {
		return generationRepairResult{}, false
	}
	var detail strings.Builder
	for _, check := range validation.Checks {
		if check.Status != ProjectValidationStatusFailed {
			continue
		}
		detail.WriteString(check.Message)
		detail.WriteByte('\n')
		detail.WriteString(check.Output)
		detail.WriteByte('\n')
	}
	normalizedDetail := strings.ToLower(detail.String())
	operations := make([]GenerationFileOperation, 0, 2)
	for _, file := range files {
		if !file.Exists {
			continue
		}
		content := ""
		description := ""
		switch {
		case isUnavailableNextPackageVersion(normalizedDetail):
			content, _ = normalizeUnavailableNextPackageVersion(file.Path, file.Content)
			description = "Pin unavailable Next.js version to the verified release"
		case isEscapedSourceValidationFailure(normalizedDetail):
			content, _ = normalizeEscapedSourceFile(file.Path, file.Content)
			description = "Normalize escaped source line separators"
		case strings.Contains(normalizedDetail, "asyncclient.__init__() got an unexpected keyword argument 'app'"):
			content, _ = normalizeHTTPXASGITransport(file.Path, file.Content)
			description = "Replace removed httpx app argument with ASGITransport"
		case strings.Contains(normalizedDetail, "starlette templateresponse positional arguments are incompatible"):
			content, _ = normalizeStarletteTemplateResponse(file.Path, file.Content)
			description = "Use the Starlette 1.x TemplateResponse keyword arguments"
		case strings.Contains(normalizedDetail, "process is not defined in vite browser source") ||
			strings.Contains(normalizedDetail, "supabase client is created before vite credentials are checked") ||
			strings.Contains(normalizedDetail, "vite supabase credentials use non-empty fallback literals") ||
			strings.Contains(normalizedDetail, "supabaseurl is required"):
			content, _ = normalizeJavaScriptSupabaseRuntime(file.Path, file.Content, normalizedDetail)
			description = "Normalize browser environment and guard the Supabase client"
		case strings.Contains(normalizedDetail, "directory 'static' does not exist"):
			content, _ = normalizeMissingPythonStaticDirectory(file.Path, file.Content)
			description = "Remove references to a missing optional Python static directory"
		case strings.Contains(normalizedDetail, "'field' object does not support item assignment"):
			content, _ = normalizePythonDataclassFieldInitialization(file.Path, file.Content)
			description = "Initialize Python dataclass fields on instances"
		case isPythonPerRequestStateLoss(normalizedDetail):
			content, _ = normalizePythonPerRequestStore(file.Path, file.Content)
			description = "Preserve in-memory state across API requests"
		case strings.Contains(normalizedDetail, "name 'datetime' is not defined"):
			content, _ = normalizePythonMissingDatetimeImport(file.Path, file.Content)
			description = "Import datetime where it is used"
		case strings.Contains(normalizedDetail, "client component") &&
			(strings.Contains(normalizedDetail, "it only works in a client component") ||
				strings.Contains(normalizedDetail, "needs usestate")):
			content, _ = normalizeNextClientComponentDirective(file.Path, file.Content)
			description = "Mark the interactive Next.js module as a Client Component"
		case strings.Contains(normalizedDetail, "vite react entry module does not mount the application root"):
			content, _ = normalizeViteReactRootMount(file.Path, file.Content)
			description = "Mount the Vite React application root"
		case strings.Contains(normalizedDetail, "nested <tr> elements are invalid"):
			content, _ = normalizeNestedTableRows(file.Path, file.Content)
			description = "Remove invalid nested table rows"
		case isPythonTopLevelRelativeImportFailure(normalizedDetail):
			content, _ = normalizePythonTopLevelRelativeImports(file.Path, file.Content)
			description = "Normalize top-level Python module imports"
		case isPythonInMemoryStateLeakage(normalizedDetail):
			content, _ = normalizePythonTestIsolation(file.Path, file.Content)
			description = "Isolate in-memory application state between tests"
		}
		if content != "" && content != file.Content {
			operations = append(operations, GenerationFileOperation{
				Operation:   GenerationFileOperationReplace,
				Path:        file.Path,
				BaseHash:    file.SHA256,
				Content:     content,
				Description: description,
			})
		}
	}
	if len(operations) == 0 {
		return generationRepairResult{}, false
	}
	return generationRepairResult{
		SchemaVersion: prompt.GenerationRepairSchemaVersion,
		Operations:    operations,
		Message:       "已执行确定性兼容修复。",
	}, true
}

func normalizeNextClientComponentDirective(filePath, content string) (string, bool) {
	extension := strings.ToLower(path.Ext(filePath))
	if !strings.HasPrefix(filePath, "app/") ||
		(extension != ".jsx" && extension != ".tsx") ||
		strings.Contains(content, `"use client"`) ||
		strings.Contains(content, `'use client'`) ||
		!reactClientHookPattern.MatchString(content) {
		return "", false
	}
	return `"use client";` + "\n\n" + content, true
}

func normalizeViteReactRootMount(filePath, content string) (string, bool) {
	extension := strings.ToLower(path.Ext(filePath))
	if !strings.HasPrefix(filePath, "src/") ||
		(extension != ".jsx" && extension != ".tsx") ||
		strings.Contains(content, "createRoot(") ||
		strings.Contains(content, "ReactDOM.render(") {
		return "", false
	}
	match := defaultFunctionComponentPattern.FindStringSubmatch(content)
	if len(match) != 2 {
		match = defaultComponentIdentifierPattern.FindStringSubmatch(content)
	}
	if len(match) != 2 {
		return "", false
	}
	componentName := match[1]
	normalized := "import { createRoot } from 'react-dom/client';\n" + content
	normalized = strings.TrimRight(normalized, "\r\n") +
		"\n\nconst rootElement = document.getElementById('root');\n" +
		"if (rootElement) {\n" +
		"  createRoot(rootElement).render(<" + componentName + " />);\n" +
		"}\n"
	return normalized, true
}

func normalizeNestedTableRows(filePath, content string) (string, bool) {
	extension := strings.ToLower(path.Ext(filePath))
	if extension != ".jsx" && extension != ".tsx" {
		return "", false
	}
	normalized := nestedTableRowPattern.ReplaceAllString(
		content,
		"<tr$1$2>$3</tr>",
	)
	return normalized, normalized != content
}

func isEscapedSourceValidationFailure(detail string) bool {
	return strings.Contains(detail, `syntax error "n"`) ||
		strings.Contains(detail, "expected unicode escape") ||
		strings.Contains(detail, `"use client" directive must be placed before other expressions`) ||
		strings.Contains(detail, "invalid or unexpected token") ||
		strings.Contains(detail, "error ts1127: invalid character") ||
		(strings.Contains(detail, "transform failed") &&
			strings.Contains(detail, `but found "\"`))
}

func normalizeEscapedSourceFile(filePath, content string) (string, bool) {
	switch strings.ToLower(path.Ext(filePath)) {
	case ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".css":
	case ".json":
		return normalizeEscapedPackageJSON(content)
	default:
		return "", false
	}
	hasEscapedWhitespace := strings.Contains(content, `\n`) ||
		strings.Contains(content, `\r`) ||
		strings.Contains(content, `\t`)
	if !hasEscapedWhitespace &&
		!hasMisplacedUseClientDirective(content) {
		return "", false
	}
	normalized := normalizeEscapedSourceWhitespace(content)
	normalized = normalizeUseClientDirectivePlacement(normalized)
	return normalized, normalized != content
}

func normalizeJavaScriptSupabaseRuntime(filePath, content, detail string) (string, bool) {
	normalized := content
	if strings.Contains(detail, "process is not defined in vite browser source") {
		if candidate, ok := normalizeViteBrowserEnvironment(filePath, normalized); ok {
			normalized = candidate
		}
	}

	requiresSupabaseRepair :=
		strings.Contains(detail, "supabase client is created before vite credentials are checked") ||
			strings.Contains(detail, "vite supabase credentials use non-empty fallback literals") ||
			strings.Contains(detail, "supabaseurl is required")
	if !requiresSupabaseRepair {
		return normalized, normalized != content
	}
	if candidate, ok := normalizeEscapedSourceFile(filePath, normalized); ok {
		normalized = candidate
	}
	if candidate, ok := normalizeViteSupabaseCredentialFallbacks(filePath, normalized); ok {
		normalized = candidate
	}
	if candidate, ok := normalizeViteSupabaseClientFallback(filePath, normalized); ok {
		normalized = candidate
	}
	return normalized, normalized != content
}

func normalizeViteBrowserEnvironment(filePath, content string) (string, bool) {
	extension := strings.ToLower(path.Ext(filePath))
	if !strings.HasPrefix(filePath, "src/") ||
		(extension != ".js" &&
			extension != ".jsx" &&
			extension != ".ts" &&
			extension != ".tsx") {
		return "", false
	}
	normalized := viteBrowserProcessEnvPattern.ReplaceAllString(
		content,
		"import.meta.env.$1",
	)
	return normalized, normalized != content
}

func normalizeViteSupabaseCredentialFallbacks(filePath, content string) (string, bool) {
	extension := strings.ToLower(path.Ext(filePath))
	if !strings.HasPrefix(filePath, "src/") ||
		(extension != ".js" &&
			extension != ".jsx" &&
			extension != ".ts" &&
			extension != ".tsx") {
		return "", false
	}
	normalized := viteSupabaseCredentialFallbackPattern.ReplaceAllString(
		content,
		"$1''",
	)
	return normalized, normalized != content
}

func normalizeViteSupabaseClientFallback(filePath, content string) (string, bool) {
	extension := strings.ToLower(path.Ext(filePath))
	if extension != ".js" && extension != ".jsx" &&
		extension != ".ts" && extension != ".tsx" {
		return "", false
	}
	match := viteDirectSupabasePattern.FindStringSubmatchIndex(content)
	if len(match) != 8 {
		return "", false
	}
	clientName := content[match[2]:match[3]]
	urlName := content[match[4]:match[5]]
	keyName := content[match[6]:match[7]]
	callStartOffset := strings.Index(content[match[0]:match[1]], "createClient(")
	if callStartOffset < 0 {
		return "", false
	}
	callStart := match[0] + callStartOffset
	openParen := callStart + len("createClient")
	callEnd := findJavaScriptCallEnd(content, openParen)
	if callEnd < 0 {
		return "", false
	}
	statementEnd := callEnd + 1
	for statementEnd < len(content) &&
		(content[statementEnd] == ' ' || content[statementEnd] == '\t') {
		statementEnd++
	}
	if statementEnd < len(content) && content[statementEnd] == ';' {
		statementEnd++
	}
	call := content[callStart : callEnd+1]
	replacement := "const " + clientName + " = " + urlName + " && " + keyName + "\n" +
		"  ? " + call + "\n" +
		"  : null;"
	normalized := content[:match[0]] + replacement + content[statementEnd:]
	credentialCondition := "if (!" + urlName + " || !" + keyName + ")"
	normalized = strings.ReplaceAll(
		normalized,
		credentialCondition,
		"if (!"+clientName+")",
	)
	demoValue := `(?:"demo"|'demo')`
	urlDemo := regexp.QuoteMeta(urlName) + `\s*===\s*` + demoValue
	keyDemo := regexp.QuoteMeta(keyName) + `\s*===\s*` + demoValue
	demoCondition := regexp.MustCompile(
		`if\s*\(\s*(?:` + urlDemo + `\s*\|\|\s*` + keyDemo +
			`|` + keyDemo + `\s*\|\|\s*` + urlDemo + `)\s*\)`,
	)
	normalized = demoCondition.ReplaceAllString(
		normalized,
		"if (!"+clientName+")",
	)

	effectMarker := "useEffect(() => {"
	effectIndex := strings.Index(normalized, effectMarker)
	authIndex := strings.Index(normalized, clientName+".auth")
	if effectIndex < 0 || authIndex < effectIndex {
		return normalized, normalized != content
	}
	nextEffectOffset := strings.Index(normalized[effectIndex+len(effectMarker):], effectMarker)
	if nextEffectOffset >= 0 &&
		authIndex > effectIndex+len(effectMarker)+nextEffectOffset {
		return normalized, normalized != content
	}
	guardOffset := effectIndex + len(effectMarker)
	guard := "\n    if (!" + clientName + ") {\n" +
		"      if (typeof setNotes === 'function' && typeof fallbackNotes !== 'undefined') setNotes(fallbackNotes);\n" +
		"      if (typeof setLoading === 'function') setLoading(false);\n" +
		"      return;\n" +
		"    }"
	normalized = normalized[:guardOffset] + guard + normalized[guardOffset:]
	return normalized, normalized != content
}

func findJavaScriptCallEnd(content string, openParen int) int {
	if openParen < 0 || openParen >= len(content) || content[openParen] != '(' {
		return -1
	}
	depth := 0
	quote := byte(0)
	escaped := false
	for index := openParen; index < len(content); index++ {
		current := content[index]
		if quote != 0 {
			if escaped {
				escaped = false
				continue
			}
			if current == '\\' {
				escaped = true
				continue
			}
			if current == quote {
				quote = 0
			}
			continue
		}
		switch current {
		case '\'', '"', '`':
			quote = current
		case '(':
			depth++
		case ')':
			depth--
			if depth == 0 {
				return index
			}
		}
	}
	return -1
}

func normalizeStarletteTemplateResponse(filePath, content string) (string, bool) {
	if strings.ToLower(path.Ext(filePath)) != ".py" {
		return "", false
	}
	matches := legacyTemplateResponsePattern.FindAllStringSubmatchIndex(content, -1)
	if len(matches) == 0 {
		return "", false
	}
	var normalized strings.Builder
	last := 0
	for _, match := range matches {
		normalized.WriteString(content[last:match[0]])
		normalized.WriteString("TemplateResponse(request=request, name=")
		normalized.WriteString(content[match[2]:match[3]])
		normalized.WriteString(", context=")
		normalized.WriteString(content[match[4]:match[5]])
		normalized.WriteByte(')')
		last = match[1]
	}
	normalized.WriteString(content[last:])
	return normalized.String(), true
}

func normalizeMissingPythonStaticDirectory(filePath, content string) (string, bool) {
	extension := strings.ToLower(path.Ext(filePath))
	lines := strings.Split(content, "\n")
	changed := false
	kept := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		remove := false
		switch extension {
		case ".py":
			remove = strings.Contains(trimmed, ".mount(") &&
				strings.Contains(trimmed, "StaticFiles(") &&
				(strings.Contains(trimmed, `directory="static"`) ||
					strings.Contains(trimmed, `directory='static'`))
		case ".html":
			remove = (strings.Contains(trimmed, `href="/static/`) ||
				strings.Contains(trimmed, `href='/static/`) ||
				strings.Contains(trimmed, `src="/static/`) ||
				strings.Contains(trimmed, `src='/static/`))
		}
		if remove {
			changed = true
			continue
		}
		kept = append(kept, line)
	}
	if !changed {
		return "", false
	}
	return strings.Join(kept, "\n"), true
}

func normalizePythonDataclassFieldInitialization(filePath, content string) (string, bool) {
	if strings.ToLower(path.Ext(filePath)) != ".py" ||
		!strings.Contains(content, "from dataclasses import") ||
		!strings.Contains(content, "dataclass") {
		return "", false
	}
	lines := strings.Split(content, "\n")
	decorate := map[int]struct{}{}
	for index, line := range lines {
		if !strings.Contains(line, "= field(") {
			continue
		}
		fieldIndent := len(line) - len(strings.TrimLeft(line, " \t"))
		for classIndex := index - 1; classIndex >= 0; classIndex-- {
			candidate := lines[classIndex]
			trimmed := strings.TrimSpace(candidate)
			if !strings.HasPrefix(trimmed, "class ") {
				continue
			}
			classIndent := len(candidate) - len(strings.TrimLeft(candidate, " \t"))
			if classIndent >= fieldIndent {
				continue
			}
			previous := classIndex - 1
			for previous >= 0 && strings.TrimSpace(lines[previous]) == "" {
				previous--
			}
			if previous < 0 || strings.TrimSpace(lines[previous]) != "@dataclass" {
				decorate[classIndex] = struct{}{}
			}
			break
		}
	}
	if len(decorate) == 0 {
		return "", false
	}
	normalized := make([]string, 0, len(lines)+len(decorate))
	for index, line := range lines {
		if _, ok := decorate[index]; ok {
			normalized = append(normalized, line[:len(line)-len(strings.TrimLeft(line, " \t"))]+"@dataclass")
		}
		normalized = append(normalized, line)
	}
	return strings.Join(normalized, "\n"), true
}

func normalizeHTTPXASGITransport(filePath, content string) (string, bool) {
	if strings.ToLower(path.Ext(filePath)) != ".py" {
		return "", false
	}
	normalized := strings.ReplaceAll(content, "httpx.AsyncClient(app=app,", "httpx.AsyncClient(transport=httpx.ASGITransport(app=app),")
	if strings.Contains(normalized, "AsyncClient(app=app,") &&
		strings.Contains(normalized, "from httpx import AsyncClient") {
		normalized = strings.Replace(normalized, "from httpx import AsyncClient", "from httpx import ASGITransport, AsyncClient", 1)
		normalized = strings.ReplaceAll(normalized, "AsyncClient(app=app,", "AsyncClient(transport=ASGITransport(app=app),")
	}
	return normalized, normalized != content
}

func isPythonTopLevelRelativeImportFailure(detail string) bool {
	return strings.Contains(detail, "attempted relative import with no known parent package")
}

func normalizePythonTopLevelRelativeImports(filePath, content string) (string, bool) {
	if strings.ToLower(path.Ext(filePath)) != ".py" || path.Dir(filePath) != "." {
		return "", false
	}

	lines := strings.Split(content, "\n")
	changed := false
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "from .") {
			continue
		}
		importIndex := strings.Index(trimmed, " import ")
		if importIndex < 0 {
			continue
		}
		module := strings.TrimPrefix(trimmed[:importIndex], "from .")
		if module == "" || strings.HasPrefix(module, ".") {
			continue
		}
		indent := line[:len(line)-len(strings.TrimLeft(line, " \t"))]
		lines[index] = indent + "from " + module + trimmed[importIndex:]
		changed = true
	}
	if !changed {
		return "", false
	}
	return strings.Join(lines, "\n"), true
}

func normalizePythonMissingDatetimeImport(filePath, content string) (string, bool) {
	if strings.ToLower(path.Ext(filePath)) != ".py" ||
		!strings.Contains(content, "datetime.") ||
		pythonDatetimeImportPattern.MatchString(content) {
		return "", false
	}

	lines := strings.Split(content, "\n")
	insertAt := 0
	if len(lines) > 0 && strings.HasPrefix(lines[0], "#!") {
		insertAt++
	}
	if insertAt < len(lines) && strings.Contains(lines[insertAt], "coding") {
		insertAt++
	}
	for insertAt < len(lines) && strings.TrimSpace(lines[insertAt]) == "" {
		insertAt++
	}
	if insertAt < len(lines) {
		trimmed := strings.TrimSpace(lines[insertAt])
		quote := ""
		switch {
		case strings.HasPrefix(trimmed, `"""`):
			quote = `"""`
		case strings.HasPrefix(trimmed, `'''`):
			quote = `'''`
		}
		if quote != "" {
			if strings.Count(trimmed, quote) >= 2 && len(trimmed) > len(quote) {
				insertAt++
			} else {
				insertAt++
				for insertAt < len(lines) {
					line := lines[insertAt]
					insertAt++
					if strings.Contains(line, quote) {
						break
					}
				}
			}
		}
	}
	for insertAt < len(lines) && strings.TrimSpace(lines[insertAt]) == "" {
		insertAt++
	}
	for insertAt < len(lines) && strings.HasPrefix(strings.TrimSpace(lines[insertAt]), "from __future__ import ") {
		insertAt++
	}
	lines = append(lines, "")
	copy(lines[insertAt+1:], lines[insertAt:])
	lines[insertAt] = "from datetime import datetime"
	return strings.Join(lines, "\n"), true
}

func isPythonInMemoryStateLeakage(detail string) bool {
	return strings.Contains(detail, ".json() == []") &&
		strings.Contains(detail, "left contains")
}

func isPythonPerRequestStateLoss(detail string) bool {
	return strings.Contains(detail, "assert 404 == 200") &&
		(strings.Contains(detail, "assert 0 == 2") ||
			strings.Contains(detail, "assert 0 == 1"))
}

func normalizePythonPerRequestStore(filePath, content string) (string, bool) {
	if strings.ToLower(path.Ext(filePath)) != ".py" {
		return "", false
	}
	match := pythonPerRequestStorePattern.FindStringSubmatchIndex(content)
	if len(match) != 10 {
		return "", false
	}
	functionName := content[match[2]:match[3]]
	returnType := content[match[4]:match[5]]
	indent := content[match[6]:match[7]]
	constructor := content[match[8]:match[9]]
	if returnType != constructor {
		return "", false
	}
	sharedName := "_shared_" + strings.TrimPrefix(functionName, "get_")
	replacement := sharedName + " = " + constructor + "()\n\n" +
		"def " + functionName + "() -> " + returnType + ":\n" +
		indent + "return " + sharedName
	normalized := content[:match[0]] + replacement + content[match[1]:]
	return normalized, true
}

func normalizePythonTestIsolation(filePath, content string) (string, bool) {
	if strings.ToLower(path.Ext(filePath)) != ".py" {
		return "", false
	}
	lines := strings.Split(content, "\n")
	moduleName := ""
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "from ") ||
			!strings.HasSuffix(trimmed, " import app") {
			continue
		}
		moduleName = strings.TrimSpace(strings.TrimSuffix(
			strings.TrimPrefix(trimmed, "from "),
			" import app",
		))
		if moduleName == "" {
			return "", false
		}
		lines[index] = "import importlib\nimport " + moduleName + " as app_module"
		break
	}
	if moduleName == "" {
		return "", false
	}
	changed := false
	for index, line := range lines {
		if !strings.Contains(line, "async with AsyncClient(") ||
			!strings.Contains(line, "app=app") {
			continue
		}
		indent := line[:len(line)-len(strings.TrimLeft(line, " \t"))]
		lines[index] = indent + "importlib.reload(app_module)\n" +
			strings.Replace(line, "app=app", "app=app_module.app", 1)
		changed = true
	}
	if !changed {
		return "", false
	}
	return strings.Join(lines, "\n"), true
}
