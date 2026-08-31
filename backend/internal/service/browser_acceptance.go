package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	BrowserAcceptanceSchemaVersion  = "browser_acceptance.v1"
	browserAcceptanceDefaultTimeout = 45 * time.Second
	browserAcceptanceMaximumTimeout = 120 * time.Second
)

type BrowserAcceptanceAction struct {
	Type       string `json:"type"`
	Selector   string `json:"selector"`
	Text       string `json:"text,omitempty"`
	ExpectText string `json:"expect_text,omitempty"`
}

type BrowserAcceptanceSpec struct {
	RequiredText []string                  `json:"required_text"`
	Actions      []BrowserAcceptanceAction `json:"actions"`
}

type BrowserAcceptanceRequest struct {
	JobID        string                    `json:"job_id"`
	ProjectID    string                    `json:"project_id"`
	URL          string                    `json:"url"`
	TimeoutMS    int64                     `json:"timeout_ms"`
	RequiredText []string                  `json:"required_text"`
	Actions      []BrowserAcceptanceAction `json:"actions"`
}

type BrowserAcceptanceIssue struct {
	Source  string `json:"source"`
	Message string `json:"message"`
}

type BrowserAcceptanceArtifact struct {
	Path   string `json:"path"`
	Bytes  int64  `json:"bytes"`
	SHA256 string `json:"sha256"`
}

type BrowserAcceptanceDOM struct {
	Title          string `json:"title"`
	HTMLLength     int64  `json:"html_length"`
	BodyTextLength int64  `json:"body_text_length"`
	RootVisible    bool   `json:"root_visible"`
}

type BrowserAcceptanceResult struct {
	SchemaVersion       string                     `json:"schema_version"`
	EvidenceID          string                     `json:"evidence_id"`
	JobID               string                     `json:"job_id"`
	ProjectID           string                     `json:"project_id"`
	Status              string                     `json:"status"`
	RequestedURL        string                     `json:"requested_url"`
	FinalURL            string                     `json:"final_url"`
	NavigationStatus    int                        `json:"navigation_status"`
	DOM                 BrowserAcceptanceDOM       `json:"dom"`
	ConsoleErrors       []map[string]any           `json:"console_errors"`
	PageErrors          []map[string]any           `json:"page_errors"`
	FailedResponses     []map[string]any           `json:"failed_responses"`
	FailedRequests      []map[string]any           `json:"failed_requests"`
	MissingRequiredText []string                   `json:"missing_required_text"`
	Actions             []map[string]any           `json:"actions"`
	BlockingErrors      []BrowserAcceptanceIssue   `json:"blocking_errors"`
	Screenshot          *BrowserAcceptanceArtifact `json:"screenshot,omitempty"`
	ResultPath          string                     `json:"result_path"`
	StartedAt           string                     `json:"started_at"`
	CompletedAt         string                     `json:"completed_at"`
	DurationMS          int64                      `json:"duration_ms"`
	Error               string                     `json:"error,omitempty"`
}

type BrowserAcceptanceRunner interface {
	Accept(ctx context.Context, request BrowserAcceptanceRequest) (*BrowserAcceptanceResult, error)
}

type HTTPBrowserAcceptanceRunner struct {
	endpoint string
	client   *http.Client
}

func NewHTTPBrowserAcceptanceRunner(endpoint string) *HTTPBrowserAcceptanceRunner {
	return &HTTPBrowserAcceptanceRunner{
		endpoint: strings.TrimRight(strings.TrimSpace(endpoint), "/"),
		client:   &http.Client{Timeout: browserAcceptanceMaximumTimeout + 5*time.Second},
	}
}

func (r *HTTPBrowserAcceptanceRunner) Accept(ctx context.Context, request BrowserAcceptanceRequest) (*BrowserAcceptanceResult, error) {
	if r == nil || r.client == nil || r.endpoint == "" {
		return nil, errors.New("browser acceptance worker is not configured")
	}
	if err := validateBrowserAcceptanceWorkerEndpoint(r.endpoint); err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("encode browser acceptance request: %w", err)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, r.endpoint+"/v1/accept", bytes.NewReader(encoded))
	if err != nil {
		return nil, fmt.Errorf("create browser acceptance request: %w", err)
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	response, err := r.client.Do(httpRequest)
	if err != nil {
		return nil, fmt.Errorf("request browser acceptance worker: %w", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return nil, fmt.Errorf("read browser acceptance response: %w", err)
	}
	var result BrowserAcceptanceResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode browser acceptance response: %w", err)
	}
	if result.SchemaVersion != BrowserAcceptanceSchemaVersion {
		return nil, fmt.Errorf("browser acceptance schema must be %q", BrowserAcceptanceSchemaVersion)
	}
	if response.StatusCode >= http.StatusInternalServerError {
		return nil, fmt.Errorf("browser acceptance worker returned %s", response.Status)
	}
	return &result, nil
}

func validateBrowserAcceptanceWorkerEndpoint(endpoint string) error {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return fmt.Errorf("parse browser acceptance worker endpoint: %w", err)
	}
	if parsed.Scheme != "http" || parsed.Hostname() != "127.0.0.1" {
		return errors.New("browser acceptance worker endpoint must use loopback HTTP")
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return errors.New("browser acceptance worker endpoint must not contain a path")
	}
	return nil
}

type BrowserAcceptanceFailure struct {
	Result *BrowserAcceptanceResult
	Cause  error
}

func (e *BrowserAcceptanceFailure) Error() string {
	if e == nil {
		return "browser acceptance failed"
	}
	if e.Cause != nil {
		return "browser acceptance failed: " + e.Cause.Error()
	}
	if e.Result != nil && strings.TrimSpace(e.Result.Error) != "" {
		return "browser acceptance failed: " + strings.TrimSpace(e.Result.Error)
	}
	if e.Result != nil && len(e.Result.BlockingErrors) > 0 {
		return "browser acceptance failed: " + e.Result.BlockingErrors[0].Message
	}
	return "browser acceptance failed"
}

func (e *BrowserAcceptanceFailure) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Cause
}

func (s *GeneratorService) browserAcceptanceTimeout(ctx context.Context) time.Duration {
	seconds, err := strconv.Atoi(strings.TrimSpace(s.lookupPromptSystemConfig(ctx, "project.browser_acceptance_timeout_seconds")))
	if err != nil {
		seconds = int(browserAcceptanceDefaultTimeout / time.Second)
	}
	if seconds < 5 {
		seconds = 5
	}
	if seconds > int(browserAcceptanceMaximumTimeout/time.Second) {
		seconds = int(browserAcceptanceMaximumTimeout / time.Second)
	}
	return time.Duration(seconds) * time.Second
}

func (s *GeneratorService) runGeneratedProjectBrowserAcceptance(
	ctx context.Context,
	projectID string,
	runtimeStatus *ProjectRuntimeStatus,
	spec BrowserAcceptanceSpec,
	handler StreamEventHandler,
) (*BrowserAcceptanceResult, error) {
	if s == nil || s.browserAcceptanceRunner == nil {
		return nil, &BrowserAcceptanceFailure{Cause: errors.New("browser acceptance runner not available")}
	}
	if s.containerMgr == nil || runtimeStatus == nil {
		return nil, &BrowserAcceptanceFailure{Cause: errors.New("preview endpoint is not available")}
	}
	endpoint, err := s.containerMgr.ResolveProjectEndpoint(ctx, projectID, runtimeStatus.InternalPort)
	if err != nil {
		return nil, &BrowserAcceptanceFailure{Cause: fmt.Errorf("resolve preview endpoint: %w", err)}
	}
	host := net.JoinHostPort(endpoint.Address, strconv.Itoa(endpoint.InternalPort))
	targetURL := "http://" + host + "/"
	jobID := GenerationJobIDFromContext(ctx)
	if jobID == "" {
		jobID = "manual-" + strconv.FormatInt(time.Now().UTC().UnixNano(), 10)
	}
	timeout := s.browserAcceptanceTimeout(ctx)
	_ = emitWorkflowStep(handler, "browser-acceptance", "run_command", "执行浏览器验收", "正在采集浏览器 console、pageerror、network、DOM 与 screenshot 证据。", "running", map[string]interface{}{
		"job_id":         jobID,
		"preview_url":    targetURL,
		"schema_version": BrowserAcceptanceSchemaVersion,
	})
	acceptanceCtx, cancel := context.WithTimeout(ctx, timeout+5*time.Second)
	defer cancel()
	result, runErr := s.browserAcceptanceRunner.Accept(acceptanceCtx, BrowserAcceptanceRequest{
		JobID: jobID, ProjectID: projectID, URL: targetURL, TimeoutMS: timeout.Milliseconds(),
		RequiredText: spec.RequiredText, Actions: spec.Actions,
	})
	if runErr != nil {
		failure := &BrowserAcceptanceFailure{Result: result, Cause: runErr}
		_ = emitWorkflowStep(handler, "browser-acceptance", "run_command", "执行浏览器验收", failure.Error(), "failed", map[string]interface{}{
			"reason_code":        GenerationFailureCodeBrowserAcceptanceFailed,
			"browser_acceptance": result,
		})
		return result, failure
	}
	if result == nil || result.Status != "passed" || len(result.BlockingErrors) > 0 || result.Screenshot == nil {
		failure := &BrowserAcceptanceFailure{Result: result}
		_ = emitWorkflowStep(handler, "browser-acceptance", "run_command", "执行浏览器验收", failure.Error(), "failed", map[string]interface{}{
			"reason_code":        GenerationFailureCodeBrowserAcceptanceFailed,
			"browser_acceptance": result,
		})
		return result, failure
	}
	_ = emitWorkflowStep(handler, "browser-acceptance", "run_command", "执行浏览器验收", "浏览器验收通过，未发现阻断级 console、page、network 或 DOM 错误。", "done", map[string]interface{}{
		"browser_acceptance": result,
	})
	return result, nil
}
