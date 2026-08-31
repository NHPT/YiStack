package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPBrowserAcceptanceRunnerUsesStructuredLoopbackRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/v1/accept" {
			t.Fatalf("unexpected worker request: %s %s", request.Method, request.URL.Path)
		}
		var input BrowserAcceptanceRequest
		if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
			t.Fatalf("decode worker request: %v", err)
		}
		if input.JobID != "job-1" || input.ProjectID != "project-1" || input.URL != "http://127.0.0.1:3000/" {
			t.Fatalf("unexpected worker input: %#v", input)
		}
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(BrowserAcceptanceResult{
			SchemaVersion: BrowserAcceptanceSchemaVersion,
			JobID:         input.JobID, ProjectID: input.ProjectID, Status: "passed",
			Screenshot: &BrowserAcceptanceArtifact{Path: "runtime/generation-evidence/job-1/screenshot.png", SHA256: "abc", Bytes: 3},
		})
	}))
	defer server.Close()

	runner := NewHTTPBrowserAcceptanceRunner(server.URL)
	result, err := runner.Accept(context.Background(), BrowserAcceptanceRequest{
		JobID: "job-1", ProjectID: "project-1", URL: "http://127.0.0.1:3000/", TimeoutMS: 5000,
	})
	if err != nil {
		t.Fatalf("expected browser acceptance result, got %v", err)
	}
	if result.Status != "passed" || result.Screenshot == nil {
		t.Fatalf("unexpected browser acceptance result: %#v", result)
	}
}

func TestHTTPBrowserAcceptanceRunnerRejectsNonLoopbackWorker(t *testing.T) {
	runner := NewHTTPBrowserAcceptanceRunner("https://worker.example.com")
	if _, err := runner.Accept(context.Background(), BrowserAcceptanceRequest{JobID: "job", ProjectID: "project", URL: "http://127.0.0.1:3000"}); err == nil {
		t.Fatal("expected non-loopback worker endpoint to be rejected")
	}
}

func TestGenerationBrowserAcceptanceFailureIsBlocking(t *testing.T) {
	result := &BrowserAcceptanceResult{SchemaVersion: BrowserAcceptanceSchemaVersion, Status: "failed"}
	err := newGenerationBrowserAcceptanceFailure(result, &BrowserAcceptanceFailure{Result: result})
	if GenerationFailureCode(err) != GenerationFailureCodeBrowserAcceptanceFailed {
		t.Fatalf("expected browser acceptance failure code, got %q", GenerationFailureCode(err))
	}
	if err.BrowserAcceptance != result || err.Stage != "browser_acceptance" {
		t.Fatalf("expected browser acceptance evidence on failure: %#v", err)
	}
}
