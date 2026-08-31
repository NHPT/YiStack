package orchestration

import (
	"context"
	"net/http"
)

// SkillHTTPCapabilityProviderRunner 是第一版受限 Skill client runner。
// 它复用统一 HTTP runner 内核，并受 provider、policy、runner 与网络边界共同约束。
type SkillHTTPCapabilityProviderRunner struct {
	Endpoint   string
	SourceNote string
	HTTPClient *http.Client
}

func (r SkillHTTPCapabilityProviderRunner) ExecuteCapability(ctx context.Context, item CapabilityExecutionAuditItem) CapabilityProviderRunResult {
	return httpCapabilityProviderRunner{
		Endpoint:   r.Endpoint,
		SourceNote: r.SourceNote,
		HTTPClient: r.HTTPClient,
		Provider:   CapabilityProviderSkill,
		RunnerMode: "skill-http",
	}.ExecuteCapability(ctx, item)
}
