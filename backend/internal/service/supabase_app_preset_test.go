package service

import (
	"strings"
	"testing"

	"yistack/internal/model"
)

func TestProjectRequestsSupabaseAppPreset(t *testing.T) {
	tests := []struct {
		name    string
		req     *GenerateRequest
		project *model.Project
		want    bool
	}{
		{
			name: "structured backend preset",
			project: &model.Project{
				TechStack: `{"runtime":{"profile":"node-nextjs"},"backend":{"preset":"supabase"}}`,
			},
			want: true,
		},
		{
			name: "explicit generation request",
			req:  &GenerateRequest{Prompt: "Build a Supabase-backed notes app"},
			want: true,
		},
		{
			name: "explicit opt out",
			req:  &GenerateRequest{Prompt: "Do not use Supabase; use an in-memory store"},
		},
		{
			name: "unrelated app",
			req:  &GenerateRequest{Prompt: "Build a static portfolio"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := projectRequestsSupabaseAppPreset(tt.req, tt.project); got != tt.want {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
		})
	}
}

func TestSupabaseAppPresetContextDefinesSecurityBoundary(t *testing.T) {
	context := appendSupabaseAppPresetContext(
		"project context",
		&GenerateRequest{Prompt: "Create a Supabase app"},
		nil,
	)
	for _, required := range []string{
		supabaseAppPresetVersion,
		"Supabase Auth",
		"enable row level security",
		"storage.objects",
		"SUPABASE_SERVICE_ROLE_KEY",
		"server-only",
		"supabase/rollback",
	} {
		if !strings.Contains(context, required) {
			t.Fatalf("preset context missing %q: %s", required, context)
		}
	}
}

func TestValidateSupabaseAppPresetOperationsAcceptsCompletePreset(t *testing.T) {
	operations := completeSupabasePresetOperations()
	err := validateSupabaseAppPresetOperations(
		&GenerateRequest{Prompt: "Create a Supabase app"},
		nil,
		operations,
		nil,
	)
	if err != nil {
		t.Fatalf("expected complete preset to pass: %v", err)
	}
}

func TestValidateSupabaseAppPresetOperationsRequiresRLSAndRollback(t *testing.T) {
	operations := completeSupabasePresetOperations()
	operations[1].Content = "create table public.notes (id uuid primary key);"
	err := validateSupabaseAppPresetOperations(
		&GenerateRequest{Prompt: "Create a Supabase app"}, nil, operations, nil,
	)
	if err == nil || !strings.Contains(err.Error(), "forward migration") {
		t.Fatalf("expected incomplete migration to fail, got %v", err)
	}

	operations = completeSupabasePresetOperations()
	operations = operations[:len(operations)-1]
	err = validateSupabaseAppPresetOperations(
		&GenerateRequest{Prompt: "Create a Supabase app"}, nil, operations, nil,
	)
	if err == nil || !strings.Contains(err.Error(), "rollback migration") {
		t.Fatalf("expected missing rollback to fail, got %v", err)
	}
}

func TestValidateSupabaseAppPresetOperationsBlocksServiceRoleLeak(t *testing.T) {
	operations := completeSupabasePresetOperations()
	operations = append(operations, GenerationFileOperation{
		Operation:   GenerationFileOperationCreate,
		Path:        "src/lib/supabase/client.ts",
		Content:     `"use client"; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;`,
		Description: "unsafe client",
	})
	err := validateSupabaseAppPresetOperations(
		&GenerateRequest{Prompt: "Create a Supabase app"}, nil, operations, nil,
	)
	if err == nil || !strings.Contains(err.Error(), "server-only") {
		t.Fatalf("expected browser service role reference to fail, got %v", err)
	}
}

func TestValidateSupabaseAppPresetOperationsBlocksCommittedSecret(t *testing.T) {
	operations := completeSupabasePresetOperations()
	operations[0].Content += "\nSUPABASE_SERVICE_ROLE_KEY=fixture_nonsecret_rejected_value_123"
	err := validateSupabaseAppPresetOperations(
		&GenerateRequest{Prompt: "Create a Supabase app"}, nil, operations, nil,
	)
	if err == nil || !strings.Contains(err.Error(), "committed") {
		t.Fatalf("expected committed service role key to fail, got %v", err)
	}
}

func TestValidateSupabaseAppPresetOperationsChecksMaterializedEnvironmentExample(t *testing.T) {
	operations := completeSupabasePresetOperations()
	operations[0].Content += "\nOPENAI_API_KEY=fixture_nonsecret_rejected_value_123"
	err := validateSupabaseAppPresetOperations(
		&GenerateRequest{Prompt: "Create a Supabase app"}, nil, operations, nil,
	)
	if err == nil || !strings.Contains(err.Error(), "placeholder") {
		t.Fatalf("expected materialized environment example to reject runtime value, got %v", err)
	}
}

func TestGenerationFileOperationsAllowOnlyEnvironmentExample(t *testing.T) {
	if isProtectedGenerationPath(".env.example") {
		t.Fatal(".env.example must be allowed for placeholder-only documentation")
	}
	for _, filePath := range []string{".env", ".env.local", ".env.production"} {
		if !isProtectedGenerationPath(filePath) {
			t.Fatalf("expected %s to remain protected", filePath)
		}
	}
}

func TestGenerationFileOperationRejectsServiceRoleLeakWithoutPresetDetection(t *testing.T) {
	operation := GenerationFileOperationCreate
	filePath := "src/client.ts"
	description := "unsafe browser client"
	content := `const key = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;`
	_, err := validateGenerationFileOperations([]generationFileOperationWire{{
		Operation:   &operation,
		Path:        &filePath,
		Description: &description,
		Content:     &content,
	}})
	if err == nil || !strings.Contains(err.Error(), "browser-exposed service role") {
		t.Fatalf("expected generic operation validation to block service role leak, got %v", err)
	}
}

func TestGenerationFileOperationRejectsRuntimeValueInEnvironmentExample(t *testing.T) {
	operation := GenerationFileOperationCreate
	filePath := ".env.example"
	description := "unsafe environment example"
	content := "OPENAI_API_KEY=" + "sk-" + "live-value-that-must-not-be-committed"
	_, err := validateGenerationFileOperations([]generationFileOperationWire{{
		Operation: &operation, Path: &filePath, Description: &description, Content: &content,
	}})
	if err == nil || !strings.Contains(err.Error(), "placeholder") {
		t.Fatalf("expected runtime environment value to fail, got %v", err)
	}
}

func TestGenerationFileOperationRequiresServerOnlyServiceRoleModule(t *testing.T) {
	operation := GenerationFileOperationCreate
	filePath := "src/lib/supabase/admin.ts"
	description := "server client"
	content := `const key = process.env.SUPABASE_SERVICE_ROLE_KEY;`
	_, err := validateGenerationFileOperations([]generationFileOperationWire{{
		Operation: &operation, Path: &filePath, Description: &description, Content: &content,
	}})
	if err == nil || !strings.Contains(err.Error(), "server-only import") {
		t.Fatalf("expected missing server-only import to fail, got %v", err)
	}

	content = `import "server-only"; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;`
	if _, err := validateGenerationFileOperations([]generationFileOperationWire{{
		Operation: &operation, Path: &filePath, Description: &description, Content: &content,
	}}); err != nil {
		t.Fatalf("expected server-only service role reference to pass: %v", err)
	}
}

func TestBuildStructuredTechStackRecordsSupabasePreset(t *testing.T) {
	stack := string(buildStructuredTechStack("node-nextjs", []string{
		"Next.js",
		"Supabase",
	}))
	for _, expected := range []string{
		`"preset":"supabase"`,
		`"type":"Supabase"`,
		`"profile":"node-nextjs"`,
	} {
		if !strings.Contains(stack, expected) {
			t.Fatalf("structured tech stack missing %s: %s", expected, stack)
		}
	}
}

func completeSupabasePresetOperations() []GenerationFileOperation {
	return []GenerationFileOperation{
		{
			Operation: GenerationFileOperationCreate,
			Path:      ".env.example",
			Content: strings.Join([]string{
				"NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co",
				"NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key",
				"SUPABASE_SERVICE_ROLE_KEY=your_service_role_key",
			}, "\n"),
			Description: "environment contract",
		},
		{
			Operation: GenerationFileOperationCreate,
			Path:      "supabase/migrations/202608280001_notes.sql",
			Content: strings.Join([]string{
				"create table public.notes (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade);",
				"alter table public.notes enable row level security;",
				"create policy notes_select on public.notes for select using (auth.uid() = user_id);",
				"create policy notes_insert on public.notes for insert with check (auth.uid() = user_id);",
				"create policy notes_update on public.notes for update using (auth.uid() = user_id);",
				"create policy notes_delete on public.notes for delete using (auth.uid() = user_id);",
				"create policy objects_select on storage.objects for select using ((storage.foldername(name))[1] = auth.uid()::text);",
				"create policy objects_insert on storage.objects for insert with check ((storage.foldername(name))[1] = auth.uid()::text);",
				"insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);",
				"create policy objects_update on storage.objects for update using ((storage.foldername(name))[1] = auth.uid()::text);",
				"create policy objects_delete on storage.objects for delete using ((storage.foldername(name))[1] = auth.uid()::text);",
			}, "\n"),
			Description: "schema and policies",
		},
		{
			Operation:   GenerationFileOperationCreate,
			Path:        "src/lib/supabase/database.types.ts",
			Content:     "export type Database = { public: { Tables: { notes: unknown } } };",
			Description: "database types",
		},
		{
			Operation:   GenerationFileOperationCreate,
			Path:        "src/lib/supabase/client.ts",
			Content:     `import { createClient } from "@supabase/supabase-js"; client.auth.signInWithPassword({ email, password });`,
			Description: "browser client",
		},
		{
			Operation:   GenerationFileOperationCreate,
			Path:        "supabase/rollback/202608280001_notes.sql",
			Content:     "drop table if exists public.notes cascade;",
			Description: "rollback",
		},
	}
}
