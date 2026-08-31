package service

import (
	"strings"
	"testing"
)

func TestDeterministicGenerationRepairNormalizesEscapedSource(t *testing.T) {
	original := `import React from "react";\nimport App from "./App.jsx";\n\nexport default App;`
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: `/workspace/src/main.jsx:1:27: ERROR: Syntax error "n"`,
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/main.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected deterministic source repair, got ok=%v result=%#v", ok, result)
	}
	operation := result.Operations[0]
	if operation.Operation != GenerationFileOperationReplace ||
		operation.BaseHash != generationContentHash(original) ||
		!strings.Contains(operation.Content, "\nimport App") ||
		strings.Contains(operation.Content, `;\nimport App`) {
		t.Fatalf("expected real source line separators, got %#v", operation)
	}
}

func TestDeterministicGenerationRepairNormalizesMixedEscapedSource(t *testing.T) {
	page := "\"use client\"\\nimport { ProductList } from './components/ProductList';\n\nexport default ProductList;\n"
	component := "\"use client\"\\nimport { useState } from 'react';\n\nexport function ProductList() {}\n"
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "./app/page.tsx:1:1\nExpected unicode escape",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{
		{
			Path: "app/page.tsx", Exists: true,
			SHA256: generationContentHash(page), Content: page,
		},
		{
			Path: "app/components/ProductList.tsx", Exists: true,
			SHA256: generationContentHash(component), Content: component,
		},
	}, validation)
	if !ok || len(result.Operations) != 2 {
		t.Fatalf("expected both mixed source files repaired, got ok=%v result=%#v", ok, result)
	}
	for _, operation := range result.Operations {
		if strings.Contains(operation.Content, `"use client"\nimport`) ||
			!strings.Contains(operation.Content, "\"use client\";\nimport") {
			t.Fatalf("expected directive separator normalized in %s, got %q", operation.Path, operation.Content)
		}
	}
}

func TestNormalizeEscapedSourcePreservesStringTemplateAndRegexEscapes(t *testing.T) {
	original := "const text = \"line\\nvalue\";\\n" +
		"const template = `line\\nvalue`;\\n" +
		"const matcher = /line\\nvalue/;\n"
	normalized, ok := normalizeEscapedSourceFile("src/main.ts", original)
	if !ok {
		t.Fatal("expected escaped structural separators to be normalized")
	}
	if !strings.Contains(normalized, `"line\nvalue"`) ||
		!strings.Contains(normalized, "`line\\nvalue`") ||
		!strings.Contains(normalized, `/line\nvalue/`) {
		t.Fatalf("expected literal escapes to be preserved, got %q", normalized)
	}
	if strings.Count(normalized, "\n") != 3 {
		t.Fatalf("expected three physical source lines, got %q", normalized)
	}
}

func TestDeterministicGenerationRepairNormalizesEscapesAfterJSXClosingTag(t *testing.T) {
	original := "export default function App() {\n" +
		"  return <main><h1>Field Inventory</h1>\\n<input /></main>;\n" +
		"}\n"
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: `Transform failed: Expected ">" but found "\"`,
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/App.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected JSX escaped source repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if strings.Contains(content, `</h1>\n<input`) || !strings.Contains(content, "</h1>\n<input") {
		t.Fatalf("expected JSX separator normalized, got %q", content)
	}
}

func TestDeterministicGenerationRepairNormalizesUseClientPlacement(t *testing.T) {
	page := strings.Join([]string{
		"import Catalog from './components/Catalog';",
		"",
		`"use client"`,
		"export default async function Page() { return <Catalog />; }",
	}, "\n")
	component := strings.Join([]string{
		"import { useState } from 'react';",
		"",
		`"use client"`,
		"export default function Catalog() { useState(0); return null; }",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: `The "use client" directive must be placed before other expressions`,
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{
		{
			Path: "app/page.tsx", Exists: true,
			SHA256: generationContentHash(page), Content: page,
		},
		{
			Path: "app/components/Catalog.tsx", Exists: true,
			SHA256: generationContentHash(component), Content: component,
		},
	}, validation)
	if !ok || len(result.Operations) != 2 {
		t.Fatalf("expected both directives repaired, got ok=%v result=%#v", ok, result)
	}
	if strings.Contains(result.Operations[0].Content, "use client") {
		t.Fatalf("expected async server page directive removed, got %q", result.Operations[0].Content)
	}
	if !strings.HasPrefix(result.Operations[1].Content, `"use client";`+"\n") {
		t.Fatalf("expected client component directive moved first, got %q", result.Operations[1].Content)
	}
}

func TestDeterministicGenerationRepairPinsUnavailableNextVersion(t *testing.T) {
	original := `{"name":"app","dependencies":{"next":"13.5.0","react":"18.2.0"}}`
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Stack:          ProjectValidationStackNodeNextJS,
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "npm error 404 Not Found - GET https://registry.npmjs.org/next/-/next-13.5.0.tgz",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "package.json", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected deterministic Next.js version repair, got ok=%v result=%#v", ok, result)
	}
	operation := result.Operations[0]
	if operation.Operation != GenerationFileOperationReplace ||
		operation.BaseHash != generationContentHash(original) ||
		!strings.Contains(operation.Content, `"next": "13.5.6"`) ||
		strings.Contains(operation.Content, `"next": "13.5.0"`) {
		t.Fatalf("expected verified Next.js version, got %#v", operation)
	}
}

func TestNormalizeUnavailableNextVersionSkipsOtherVersions(t *testing.T) {
	content := `{"dependencies":{"next":"14.2.0"}}`
	if normalized, ok := normalizeUnavailableNextPackageVersion("package.json", content); ok || normalized != "" {
		t.Fatalf("expected supported Next.js version to remain unchanged, got %q", normalized)
	}
}

func TestDeterministicGenerationRepairRewritesHTTPXAppArgument(t *testing.T) {
	original := strings.Join([]string{
		"from httpx import AsyncClient",
		"from app.main import app",
		"",
		"async def test_events():",
		`    async with AsyncClient(app=app, base_url="http://test") as client:`,
		"        pass",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "TypeError: AsyncClient.__init__() got an unexpected keyword argument 'app'",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "tests/test_events.py", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected deterministic httpx repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if !strings.Contains(content, "from httpx import ASGITransport, AsyncClient") ||
		!strings.Contains(content, "AsyncClient(transport=ASGITransport(app=app),") ||
		strings.Contains(content, "AsyncClient(app=app,") {
		t.Fatalf("expected ASGITransport rewrite, got %q", content)
	}
}

func TestDeterministicGenerationRepairImportsMissingDatetime(t *testing.T) {
	original := strings.Join([]string{
		`"""Events API router."""`,
		"from __future__ import annotations",
		"from fastapi import APIRouter",
		"",
		"def create_event():",
		"    return datetime.utcnow()",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "NameError: name 'datetime' is not defined",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "events.py", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected missing datetime import repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	docstringIndex := strings.Index(content, `"""Events API router."""`)
	futureIndex := strings.Index(content, "from __future__ import annotations")
	datetimeIndex := strings.Index(content, "from datetime import datetime")
	if docstringIndex != 0 || futureIndex < 0 || datetimeIndex <= futureIndex ||
		strings.Count(content, "from datetime import datetime") != 1 {
		t.Fatalf("expected datetime import after module preamble, got %q", content)
	}
}

func TestDeterministicGenerationRepairNormalizesPythonTopLevelImports(t *testing.T) {
	mainSource := "from .events import router\n"
	eventsSource := "from .schemas import Event\n"
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "ImportError: attempted relative import with no known parent package",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{
		{
			Path: "main.py", Exists: true,
			SHA256: generationContentHash(mainSource), Content: mainSource,
		},
		{
			Path: "events.py", Exists: true,
			SHA256: generationContentHash(eventsSource), Content: eventsSource,
		},
		{
			Path: "app/nested.py", Exists: true,
			SHA256: "nested", Content: "from .schemas import Event\n",
		},
	}, validation)
	if !ok || len(result.Operations) != 2 {
		t.Fatalf("expected root Python imports repaired, got ok=%v result=%#v", ok, result)
	}
	if result.Operations[0].Content != "from events import router\n" ||
		result.Operations[1].Content != "from schemas import Event\n" {
		t.Fatalf("unexpected Python import repair: %#v", result.Operations)
	}
}

func TestDeterministicGenerationRepairIsolatesPythonInMemoryTests(t *testing.T) {
	original := strings.Join([]string{
		"import pytest",
		"from httpx import ASGITransport, AsyncClient",
		"from app.main import app",
		"",
		"@pytest.mark.asyncio",
		"async def test_events():",
		`    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:`,
		"        pass",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "assert resp.json() == []\nE Left contains one more item",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "tests/test_events.py", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected deterministic state isolation repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	for _, expected := range []string{
		"import importlib",
		"import app.main as app_module",
		"importlib.reload(app_module)",
		"ASGITransport(app=app_module.app)",
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("expected isolated test content %q, got %q", expected, content)
		}
	}
}

func TestDeterministicGenerationRepairNormalizesEscapedConfigFiles(t *testing.T) {
	nextConfig := `/** @type {import('next').NextConfig} */\nmodule.exports = {};\n`
	tsConfig := `{\n  "compilerOptions": {"jsx": "preserve"}\n}\n`
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "SyntaxError: Invalid or unexpected token",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{
		{
			Path: "next.config.js", Exists: true,
			SHA256: generationContentHash(nextConfig), Content: nextConfig,
		},
		{
			Path: "tsconfig.json", Exists: true,
			SHA256: generationContentHash(tsConfig), Content: tsConfig,
		},
	}, validation)
	if !ok || len(result.Operations) != 2 {
		t.Fatalf("expected both escaped config files repaired, got ok=%v result=%#v", ok, result)
	}
	for _, operation := range result.Operations {
		if strings.Contains(operation.Content, `\n`) {
			t.Fatalf("expected physical config line separators in %s, got %q", operation.Path, operation.Content)
		}
	}
}

func TestDeterministicGenerationRepairNormalizesViteBrowserEnvironment(t *testing.T) {
	original := strings.Join([]string{
		"const url = process.env.VITE_SUPABASE_URL;",
		"const key = process.env.VITE_SUPABASE_ANON_KEY;",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "src/App.jsx:1:1: process is not defined in Vite browser source; use import.meta.env for VITE_* variables",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/App.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected Vite environment repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if strings.Contains(content, "process.env") ||
		!strings.Contains(content, "import.meta.env.VITE_SUPABASE_URL") ||
		!strings.Contains(content, "import.meta.env.VITE_SUPABASE_ANON_KEY") {
		t.Fatalf("expected Vite environment variables, got %q", content)
	}
}

func TestDeterministicGenerationRepairGuardsViteSupabaseClient(t *testing.T) {
	original := strings.Join([]string{
		"const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';",
		"const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';",
		"const supabase = createClient(supabaseUrl, supabaseAnonKey, {",
		"  auth: { persistSession: true },",
		"});",
		"",
		"export default function App() {",
		"  useEffect(() => {",
		"    supabase.auth.getSession();",
		"  }, []);",
		"  useEffect(() => {",
		"    loadLocalFixture();",
		"  }, []);",
		"}",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "src/App.jsx:1:1: Supabase client is created before Vite credentials are checked; use a deterministic local fallback",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/App.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected guarded Supabase client repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	for _, expected := range []string{
		"const supabase = supabaseUrl && supabaseAnonKey",
		"? createClient(supabaseUrl, supabaseAnonKey, {",
		": null;",
		"if (!supabase) {",
		"setNotes(fallbackNotes)",
		"setLoading(false)",
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("expected guarded Supabase client content %q, got %q", expected, content)
		}
	}
}

func TestDeterministicGenerationRepairCombinesViteSupabaseFixes(t *testing.T) {
	original := "import { createClient } from '@supabase/supabase-js';\\n" +
		"const supabaseUrl = process.env.VITE_SUPABASE_URL || 'demo';\\n" +
		"const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'demo';\\n" +
		"const supabase = createClient(supabaseUrl, supabaseAnonKey);\\n" +
		"function load() {\\n" +
		"  if (supabaseUrl === 'demo' || supabaseAnonKey === 'demo') return;\\n" +
		"  return supabase.from('feedback').select('*');\\n" +
		"}\\n"
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: strings.Join([]string{
				"src/App.jsx:1:1: process is not defined in Vite browser source; use import.meta.env for VITE_* variables",
				"src/App.jsx:1:1: Supabase client is created before Vite credentials are checked; use a deterministic local fallback",
			}, "\n"),
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/App.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected combined Vite Supabase repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	for _, expected := range []string{
		"import.meta.env.VITE_SUPABASE_URL || '';",
		"import.meta.env.VITE_SUPABASE_ANON_KEY || '';",
		"const supabase = supabaseUrl && supabaseAnonKey",
		"? createClient(supabaseUrl, supabaseAnonKey)",
		"if (!supabase) return;",
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("expected combined Vite Supabase content %q, got %q", expected, content)
		}
	}
	if strings.Contains(content, "process.env") ||
		strings.Contains(content, `\\n`) ||
		strings.Contains(content, "=== 'demo'") {
		t.Fatalf("expected all diagnosed Vite Supabase defects removed, got %q", content)
	}
}

func TestDeterministicGenerationRepairRemovesViteSupabaseCredentialFallbacks(t *testing.T) {
	original := strings.Join([]string{
		"const supabaseUrl =",
		"  import.meta.env.VITE_SUPABASE_URL ||",
		"  'https://demo.supabase.co';",
		"const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? \"demo-anon-key\";",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "src/App.jsx:1:1: Vite Supabase credentials use non-empty fallback literals; use empty strings and deterministic local data",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/App.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected fake Supabase credentials to be removed, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if strings.Contains(content, "https://demo.supabase.co") ||
		strings.Contains(content, "demo-anon-key") ||
		!strings.Contains(content, "import.meta.env.VITE_SUPABASE_URL ||\n  '';") ||
		!strings.Contains(content, "import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';") {
		t.Fatalf("expected empty Supabase credential fallbacks, got %q", content)
	}
}

func TestDeterministicGenerationRepairGuardsNextSupabaseRoute(t *testing.T) {
	original := strings.Join([]string{
		`import { createClient } from "@supabase/supabase-js";`,
		"",
		`const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";`,
		`const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";`,
		"const supabase = createClient(supabaseUrl, supabaseAnonKey);",
		"",
		"export async function GET() {",
		"  if (!supabaseUrl || !supabaseAnonKey) {",
		`    return Response.json([{ id: 1, name: "Demo" }]);`,
		"  }",
		`  return Response.json(await supabase.from("contacts").select("*"));`,
		"}",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "Error: supabaseUrl is required.",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "app/api/contacts/route.ts", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected Next Supabase route repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	for _, expected := range []string{
		"const supabase = supabaseUrl && supabaseAnonKey",
		"? createClient(supabaseUrl, supabaseAnonKey)",
		": null;",
		"if (!supabase) {",
	} {
		if !strings.Contains(content, expected) {
			t.Fatalf("expected guarded Next Supabase route content %q, got %q", expected, content)
		}
	}
	if strings.Contains(content, "const supabase = createClient(") ||
		strings.Contains(content, "if (!supabaseUrl || !supabaseAnonKey)") {
		t.Fatalf("expected eager client creation and credential guard to be replaced, got %q", content)
	}
}

func TestDeterministicGenerationRepairNormalizesStarletteTemplateResponse(t *testing.T) {
	original := strings.Join([]string{
		"async def read_root(request: Request):",
		`    return templates.TemplateResponse("index.html", {"request": request})`,
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "main.py:2:12: Starlette TemplateResponse positional arguments are incompatible; use TemplateResponse(request=request, name=..., context=...)",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "main.py", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected Starlette TemplateResponse repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if !strings.Contains(content, `TemplateResponse(request=request, name="index.html", context={"request": request})`) {
		t.Fatalf("expected Starlette 1.x keyword arguments, got %q", content)
	}
}

func TestDeterministicGenerationRepairRemovesMissingPythonStaticReferences(t *testing.T) {
	mainSource := strings.Join([]string{
		`app.mount("/static", StaticFiles(directory="static"), name="static")`,
		"app = FastAPI()",
	}, "\n")
	template := strings.Join([]string{
		`<link rel="stylesheet" href="/static/style.css">`,
		"<h1>Events API Console</h1>",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "RuntimeError: Directory 'static' does not exist",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{
		{
			Path: "main.py", Exists: true,
			SHA256: generationContentHash(mainSource), Content: mainSource,
		},
		{
			Path: "templates/index.html", Exists: true,
			SHA256: generationContentHash(template), Content: template,
		},
	}, validation)
	if !ok || len(result.Operations) != 2 {
		t.Fatalf("expected missing static references repaired, got ok=%v result=%#v", ok, result)
	}
	for _, operation := range result.Operations {
		if strings.Contains(operation.Content, "/static/") ||
			strings.Contains(operation.Content, "app.mount") {
			t.Fatalf("expected missing static reference removed from %s, got %q", operation.Path, operation.Content)
		}
	}
}

func TestDeterministicGenerationRepairInitializesDataclassFields(t *testing.T) {
	original := strings.Join([]string{
		"from dataclasses import dataclass, field",
		"",
		"class EventStore:",
		"    _events: dict[int, str] = field(default_factory=dict)",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "TypeError: 'Field' object does not support item assignment",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "events.py", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected dataclass field repair, got ok=%v result=%#v", ok, result)
	}
	if !strings.Contains(result.Operations[0].Content, "@dataclass\nclass EventStore:") {
		t.Fatalf("expected EventStore dataclass decorator, got %q", result.Operations[0].Content)
	}
}

func TestDeterministicGenerationRepairPreservesStateAcrossRequests(t *testing.T) {
	original := strings.Join([]string{
		"from fastapi import Depends, FastAPI",
		"from events import EventStore",
		"",
		"app = FastAPI()",
		"",
		"def get_store() -> EventStore:",
		"    return EventStore()",
		"",
		"@app.get('/events')",
		"def list_events(store: EventStore = Depends(get_store)):",
		"    return store.list()",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "assert 404 == 200\nassert 0 == 2",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "main.py", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected per-request store repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if !strings.Contains(content, "_shared_store = EventStore()") ||
		!strings.Contains(content, "return _shared_store") ||
		strings.Contains(content, "return EventStore()") {
		t.Fatalf("expected shared in-memory store dependency, got %q", content)
	}
}

func TestDeterministicGenerationRepairAddsNextClientDirective(t *testing.T) {
	original := strings.Join([]string{
		"import { useState } from 'react';",
		"export default function Page() {",
		"  const [done, setDone] = useState(false);",
		"  return <button onClick={() => setDone(true)}>{String(done)}</button>;",
		"}",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-nextjs",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "You're importing a component that needs useState. It only works in a Client Component but none of its parents are marked with use client.",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "app/page.tsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected Next.js Client Component repair, got ok=%v result=%#v", ok, result)
	}
	if !strings.HasPrefix(result.Operations[0].Content, `"use client";`+"\n\n") {
		t.Fatalf("expected client directive at file start, got %q", result.Operations[0].Content)
	}
}

func TestDeterministicGenerationRepairMountsViteReactRoot(t *testing.T) {
	original := strings.Join([]string{
		"import { useState } from 'react';",
		"export default function App() {",
		"  const [done, setDone] = useState(false);",
		"  return <button onClick={() => setDone(true)}>{String(done)}</button>;",
		"}",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "src/App.jsx:1:1: Vite React entry module does not mount the application root; call createRoot(...).render(...)",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/App.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected Vite React root mount repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if !strings.Contains(content, "import { createRoot } from 'react-dom/client';") ||
		!strings.Contains(content, "createRoot(rootElement).render(<App />);") {
		t.Fatalf("expected mounted Vite React entry, got %q", content)
	}
}

func TestDeterministicGenerationRepairRemovesStaleNPMlockfile(t *testing.T) {
	lockfile := `{"lockfileVersion":3}`
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Kind:   "prepare",
			Status: ProjectValidationStatusFailed,
			Output: "`npm ci` can only install packages when package.json and package-lock.json are in sync.\nMissing: uuid@9.0.1 from lock file",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "package-lock.json", Exists: true,
		SHA256: generationContentHash(lockfile), Content: lockfile,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected stale npm lockfile repair, got ok=%v result=%#v", ok, result)
	}
	operation := result.Operations[0]
	if operation.Operation != GenerationFileOperationDelete ||
		operation.Path != "package-lock.json" ||
		operation.BaseHash != generationContentHash(lockfile) {
		t.Fatalf("expected stale lockfile deletion, got %#v", operation)
	}
}

func TestDeterministicGenerationRepairAddsPythonMultipart(t *testing.T) {
	requirements := "fastapi\nuvicorn\n"
	validation := &ProjectValidationResult{
		RuntimeProfile: "python-fastapi",
		Checks: []ProjectValidationCheck{{
			Kind:   "test",
			Status: ProjectValidationStatusFailed,
			Output: `RuntimeError: Form data requires "python-multipart" to be installed.`,
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "requirements.txt", Exists: true,
		SHA256: generationContentHash(requirements), Content: requirements,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected python-multipart repair, got ok=%v result=%#v", ok, result)
	}
	operation := result.Operations[0]
	if operation.Operation != GenerationFileOperationReplace ||
		!strings.Contains(operation.Content, "python-multipart==0.0.20") {
		t.Fatalf("expected python-multipart requirement, got %#v", operation)
	}
}

func TestDeterministicGenerationRepairFlattensNestedTableRows(t *testing.T) {
	original := strings.Join([]string{
		"{items.map(item => (",
		"  <tr key={item.id}>",
		"    <tr><td>{item.name}</td></tr>",
		"  </tr>",
		"))}",
	}, "\n")
	validation := &ProjectValidationResult{
		RuntimeProfile: "node-react",
		Checks: []ProjectValidationCheck{{
			Status: ProjectValidationStatusFailed,
			Output: "src/Table.jsx:1:1: nested <tr> elements are invalid; render table cells directly inside one row",
		}},
	}
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/Table.jsx", Exists: true,
		SHA256: generationContentHash(original), Content: original,
	}}, validation)
	if !ok || len(result.Operations) != 1 {
		t.Fatalf("expected nested row repair, got ok=%v result=%#v", ok, result)
	}
	content := result.Operations[0].Content
	if strings.Contains(content, "<tr key={item.id}>\n    <tr>") ||
		!strings.Contains(content, "<tr key={item.id}><td>{item.name}</td></tr>") {
		t.Fatalf("expected one table row, got %q", content)
	}
}

func TestDeterministicGenerationRepairSkipsUnrelatedFailure(t *testing.T) {
	result, ok := deterministicGenerationRepairForValidation([]GenerationRepairFileState{{
		Path: "src/main.jsx", Exists: true,
		SHA256: "hash", Content: "export default function App() {}\n",
	}}, &ProjectValidationResult{Checks: []ProjectValidationCheck{{
		Status: ProjectValidationStatusFailed,
		Output: "unrelated build failure",
	}}})
	if ok {
		t.Fatalf("unexpected deterministic repair: %#v", result)
	}
}
