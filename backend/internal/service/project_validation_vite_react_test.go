package service

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestViteReactRuntimeValidationRejectsSupabaseCredentialFallbacks(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is required for the Vite runtime validation test")
	}

	root := t.TempDir()
	sourceDirectory := filepath.Join(root, "src")
	if err := os.Mkdir(sourceDirectory, 0o750); err != nil {
		t.Fatalf("create source directory: %v", err)
	}
	sourcePath := filepath.Join(sourceDirectory, "App.jsx")
	source := strings.Join([]string{
		"const supabaseUrl =",
		"  import.meta.env.VITE_SUPABASE_URL ||",
		"  'https://demo.supabase.co';",
		"const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'demo-anon-key';",
	}, "\n")
	if err := os.WriteFile(sourcePath, []byte(source), 0o600); err != nil {
		t.Fatalf("write Vite source: %v", err)
	}

	command := exec.Command("node", "-e", viteReactJSXRuntimeValidationScript)
	command.Env = append(os.Environ(), "YISTACK_VALIDATION_ROOT="+root)
	output, err := command.CombinedOutput()
	if err == nil {
		t.Fatal("expected fake Supabase credentials to fail validation")
	}
	if !strings.Contains(
		string(output),
		"Vite Supabase credentials use non-empty fallback literals",
	) {
		t.Fatalf("expected actionable Supabase credential diagnostic, got %q", output)
	}

	validSource := strings.ReplaceAll(source, "'https://demo.supabase.co'", "''")
	validSource = strings.ReplaceAll(validSource, "'demo-anon-key'", "''")
	if err := os.WriteFile(sourcePath, []byte(validSource), 0o600); err != nil {
		t.Fatalf("write valid Vite source: %v", err)
	}
	command = exec.Command("node", "-e", viteReactJSXRuntimeValidationScript)
	command.Env = append(os.Environ(), "YISTACK_VALIDATION_ROOT="+root)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("expected empty Supabase credential fallbacks to pass, got %v: %s", err, output)
	}
}

func TestViteReactRuntimeValidationRejectsUnmountedEntryModule(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is required for the Vite runtime validation test")
	}

	root := t.TempDir()
	sourceDirectory := filepath.Join(root, "src")
	if err := os.Mkdir(sourceDirectory, 0o750); err != nil {
		t.Fatalf("create source directory: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(root, "index.html"),
		[]byte(`<div id="root"></div><script type="module" src="/src/App.jsx"></script>`),
		0o600,
	); err != nil {
		t.Fatalf("write Vite index: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(sourceDirectory, "App.jsx"),
		[]byte(`import React from 'react'; export default function App() { return <main>Ready</main>; }`),
		0o600,
	); err != nil {
		t.Fatalf("write Vite entry: %v", err)
	}

	command := exec.Command("node", "-e", viteReactJSXRuntimeValidationScript)
	command.Env = append(os.Environ(), "YISTACK_VALIDATION_ROOT="+root)
	output, err := command.CombinedOutput()
	if err == nil {
		t.Fatal("expected unmounted Vite React entry to fail validation")
	}
	if !strings.Contains(
		string(output),
		"Vite React entry module does not mount the application root",
	) {
		t.Fatalf("expected root mount diagnostic, got %q", output)
	}
}

func TestViteReactRuntimeValidationAcceptsDotSlashMountedEntry(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is required for the Vite runtime validation test")
	}

	root := t.TempDir()
	sourceDirectory := filepath.Join(root, "src")
	if err := os.Mkdir(sourceDirectory, 0o750); err != nil {
		t.Fatalf("create source directory: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(root, "index.html"),
		[]byte(`<div id="root"></div><script type="module" src="./src/main.jsx"></script>`),
		0o600,
	); err != nil {
		t.Fatalf("write Vite index: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(sourceDirectory, "main.jsx"),
		[]byte(`import React from 'react'; import ReactDOM from 'react-dom/client'; ReactDOM.createRoot(document.getElementById('root')).render(<App />);`),
		0o600,
	); err != nil {
		t.Fatalf("write Vite entry: %v", err)
	}

	command := exec.Command("node", "-e", viteReactJSXRuntimeValidationScript)
	command.Env = append(os.Environ(), "YISTACK_VALIDATION_ROOT="+root)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("expected ./src mounted entry to pass, got %v: %s", err, output)
	}
}

func TestViteReactRuntimeValidationRejectsNestedTableRows(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is required for the Vite runtime validation test")
	}

	root := t.TempDir()
	sourceDirectory := filepath.Join(root, "src")
	if err := os.Mkdir(sourceDirectory, 0o750); err != nil {
		t.Fatalf("create source directory: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(root, "index.html"),
		[]byte(`<div id="root"></div><script type="module" src="/src/main.jsx"></script>`),
		0o600,
	); err != nil {
		t.Fatalf("write Vite index: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(sourceDirectory, "main.jsx"),
		[]byte(`import React from 'react'; import { createRoot } from 'react-dom/client'; createRoot(document.getElementById('root')).render(<App />);`),
		0o600,
	); err != nil {
		t.Fatalf("write Vite entry: %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(sourceDirectory, "Table.jsx"),
		[]byte(`import React from 'react'; export default () => <table><tbody><tr><tr><td>Nested</td></tr></tr></tbody></table>;`),
		0o600,
	); err != nil {
		t.Fatalf("write table component: %v", err)
	}

	command := exec.Command("node", "-e", viteReactJSXRuntimeValidationScript)
	command.Env = append(os.Environ(), "YISTACK_VALIDATION_ROOT="+root)
	output, err := command.CombinedOutput()
	if err == nil {
		t.Fatal("expected nested table rows to fail validation")
	}
	if !strings.Contains(string(output), "nested <tr> elements are invalid") {
		t.Fatalf("expected nested row diagnostic, got %q", output)
	}
}
