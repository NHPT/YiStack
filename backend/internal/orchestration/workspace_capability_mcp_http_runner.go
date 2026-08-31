package orchestration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type httpCapabilityProviderRunner struct {
	Endpoint   string
	SourceNote string
	HTTPClient *http.Client
	Provider   string
	RunnerMode string
}

type capabilityProviderHTTPRequest struct {
	CapabilityID             string `json:"capability_id"`
	CapabilityName           string `json:"capability_name"`
	CapabilityVersion        string `json:"capability_version"`
	CapabilityCatalogSource  string `json:"capability_catalog_source"`
	Provider                 string `json:"provider"`
	ProviderResolutionStatus string `json:"provider_resolution_status"`
	Required                 bool   `json:"required"`
	ReasonCode               string `json:"reason_code"`
	SourceNote               string `json:"source_note"`
	WorkflowStage            string `json:"workflow_stage"`
	WorkflowMode             string `json:"workflow_mode"`
	CapabilityProfile        string `json:"capability_profile"`
	ProjectID                string `json:"project_id"`
	UserID                   string `json:"user_id"`
}

func (r httpCapabilityProviderRunner) ExecuteCapability(ctx context.Context, item CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	endpoint := strings.TrimSpace(r.Endpoint)
	provider := strings.TrimSpace(r.Provider)
	runnerMode := strings.TrimSpace(r.RunnerMode)
	if runnerMode == "" {
		runnerMode = provider + "-http"
	}
	if endpoint == "" {
		return blockedCapabilityProviderRunResult(
			"provider_runner_endpoint_missing",
			strings.ToUpper(provider)+" HTTP runner 未配置 endpoint，真实 "+provider+" client 调用被阻断。",
			map[string]interface{}{
				"runner_mode": runnerMode,
				"provider":    provider,
			},
		)
	}

	boundary, ok := CapabilityRunnerBoundaryFromContext(ctx)
	if !ok {
		boundary = CapabilityRunnerBoundary{}
	}
	if validation := boundary.ValidateNetworkTarget(endpoint); validation.Status != CapabilityExecutionResultStatusExecuted {
		validation.Metadata = mergeCapabilityMetadata(validation.Metadata, map[string]interface{}{
			"runner_mode": runnerMode,
			"provider":    provider,
			"endpoint":    endpoint,
		})
		return validation
	}

	body, err := json.Marshal(capabilityProviderHTTPRequestFromContext(ctx, item, provider))
	if err != nil {
		return blockedCapabilityProviderRunResult(
			"provider_runner_invalid_request",
			strings.ToUpper(provider)+" HTTP runner 无法构造结构化请求。",
			map[string]interface{}{
				"runner_mode": runnerMode,
				"provider":    provider,
				"endpoint":    endpoint,
				"error":       err.Error(),
			},
		)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return blockedCapabilityProviderRunResult(
			"provider_runner_endpoint_invalid",
			strings.ToUpper(provider)+" HTTP runner endpoint 不是合法 HTTP 请求目标。",
			map[string]interface{}{
				"runner_mode": runnerMode,
				"provider":    provider,
				"endpoint":    endpoint,
				"error":       err.Error(),
			},
		)
	}
	request.Header.Set("Content-Type", "application/json")

	client := r.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	response, err := client.Do(request)
	if err != nil {
		return blockedCapabilityProviderRunResult(
			"provider_runner_http_failed",
			strings.ToUpper(provider)+" HTTP runner 调用失败。",
			map[string]interface{}{
				"runner_mode": runnerMode,
				"provider":    provider,
				"endpoint":    endpoint,
				"error":       err.Error(),
			},
		)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return blockedCapabilityProviderRunResult(
			"provider_runner_http_failed",
			strings.ToUpper(provider)+" HTTP runner 无法读取响应。",
			map[string]interface{}{
				"runner_mode": runnerMode,
				"provider":    provider,
				"endpoint":    endpoint,
				"status_code": response.StatusCode,
				"error":       err.Error(),
			},
		)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return blockedCapabilityProviderRunResult(
			"provider_runner_http_failed",
			fmt.Sprintf("%s HTTP runner 返回非成功状态码：%d。", strings.ToUpper(provider), response.StatusCode),
			map[string]interface{}{
				"runner_mode": runnerMode,
				"provider":    provider,
				"endpoint":    endpoint,
				"status_code": response.StatusCode,
			},
		)
	}

	var result CapabilityProviderRunResult
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return blockedCapabilityProviderRunResult(
			"provider_runner_invalid_response",
			strings.ToUpper(provider)+" HTTP runner 返回了非法 JSON 响应。",
			map[string]interface{}{
				"runner_mode": runnerMode,
				"provider":    provider,
				"endpoint":    endpoint,
				"error":       err.Error(),
			},
		)
	}

	result.Metadata = mergeCapabilityMetadata(result.Metadata, map[string]interface{}{
		"runner_mode": runnerMode,
		"provider":    provider,
		"endpoint":    endpoint,
	})
	result.SourceNote = firstNonEmpty(
		strings.TrimSpace(result.SourceNote),
		strings.TrimSpace(r.SourceNote),
		strings.ToUpper(provider)+" HTTP runner 已通过受限网络边界返回结构化执行结果。",
	)
	return result
}

func capabilityProviderHTTPRequestFromContext(ctx context.Context, item CapabilityExecutionAuditItem, provider string) capabilityProviderHTTPRequest {
	orchestrationContext, _ := OrchestrationContextFromContext(ctx)
	capabilityContext, _ := CapabilityContextFromContext(ctx)
	requestContext, _ := CapabilityExecutionRequestFromContext(ctx)

	return capabilityProviderHTTPRequest{
		CapabilityID:             strings.TrimSpace(item.CapabilityID),
		CapabilityName:           strings.TrimSpace(item.CapabilityName),
		CapabilityVersion:        strings.TrimSpace(item.CapabilityVersion),
		CapabilityCatalogSource:  strings.TrimSpace(item.CapabilityCatalogSource),
		Provider:                 strings.TrimSpace(provider),
		ProviderResolutionStatus: strings.TrimSpace(item.ProviderResolutionStatus),
		Required:                 item.Required,
		ReasonCode:               strings.TrimSpace(item.ReasonCode),
		SourceNote:               strings.TrimSpace(item.SourceNote),
		WorkflowStage:            strings.TrimSpace(orchestrationContext.WorkflowStage),
		WorkflowMode:             strings.TrimSpace(orchestrationContext.WorkflowMode),
		CapabilityProfile:        strings.TrimSpace(capabilityContext.Profile),
		ProjectID:                strings.TrimSpace(requestContext.ProjectID),
		UserID:                   strings.TrimSpace(requestContext.UserID),
	}
}

// MCPHTTPCapabilityProviderRunner 是第一版受限 MCP client runner。
// 它只在网络边界放行后向显式配置的 HTTP endpoint 发送结构化请求。
type MCPHTTPCapabilityProviderRunner struct {
	Endpoint   string
	SourceNote string
	HTTPClient *http.Client
}

func (r MCPHTTPCapabilityProviderRunner) ExecuteCapability(ctx context.Context, item CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	return httpCapabilityProviderRunner{
		Endpoint:   r.Endpoint,
		SourceNote: r.SourceNote,
		HTTPClient: r.HTTPClient,
		Provider:   CapabilityProviderMCP,
		RunnerMode: "mcp-http",
	}.ExecuteCapability(ctx, item)
}
