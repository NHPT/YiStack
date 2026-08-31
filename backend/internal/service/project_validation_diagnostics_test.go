package service

import "testing"

func TestCollectProjectValidationDiagnosticsParsesCommonLocations(t *testing.T) {
	checks := []ProjectValidationCheck{{
		Kind: "build", Status: ProjectValidationStatusFailed,
		Output: "src/app/page.tsx:12:7: error TS2322: invalid value\nmain.py(8, 3): warning: unused value",
	}}
	diagnostics := collectProjectValidationDiagnostics(checks)
	if len(diagnostics) != 2 {
		t.Fatalf("expected two diagnostics, got %#v", diagnostics)
	}
	if diagnostics[0].Path != "src/app/page.tsx" || diagnostics[0].Line != 12 || diagnostics[0].Column != 7 || diagnostics[0].Severity != "error" {
		t.Fatalf("unexpected TypeScript diagnostic: %#v", diagnostics[0])
	}
	if diagnostics[1].Path != "main.py" || diagnostics[1].Line != 8 || diagnostics[1].Column != 3 || diagnostics[1].Severity != "warning" {
		t.Fatalf("unexpected Python diagnostic: %#v", diagnostics[1])
	}
}

func TestFinalizeProjectValidationFailureProducesStableFingerprint(t *testing.T) {
	result := &ProjectValidationResult{Stack: ProjectValidationStackNodeNextJS, Checks: []ProjectValidationCheck{{
		Kind: "build", Status: ProjectValidationStatusFailed,
		Command: []string{"npm", "run", "build"}, Output: "src/app.ts:2:1: error: failed", Message: "build failed",
	}}}
	finalizeProjectValidationFailure(result)
	first := result.FailureFingerprint
	finalizeProjectValidationFailure(result)
	if len(first) != 64 || result.FailureFingerprint != first || len(result.Diagnostics) != 1 {
		t.Fatalf("expected stable SHA-256 fingerprint and diagnostics, got %#v", result)
	}
}
