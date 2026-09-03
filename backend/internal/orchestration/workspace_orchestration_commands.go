package orchestration

import (
	"strings"

	"yistack/internal/model"
)

const (
	WorkflowStageBootstrap          = "bootstrap"
	WorkflowStageBootstrapReview    = "bootstrap_review"
	WorkflowStageBootstrapConfirmed = "bootstrap_confirmed"
	WorkflowStagePlanAnalysis       = "plan-analysis"
	WorkflowStagePlanSelection      = "plan-selection"
	WorkflowStagePlanApproved       = "plan-approved"
	WorkflowStageImplement          = "implement"
	WorkflowModeFoundation          = "foundation"
	WorkflowModePlan                = "plan"
	WorkflowModeDiscuss             = "discuss"
	WorkflowModeImplement           = "implement"
	RequestSourceHTTP               = "http"
	ValidationGateBeforePreview     = "validate-before-preview"
)

// WorkflowStageDefinition describes a stable orchestration stage contract.
type WorkflowStageDefinition struct {
	Stage               string
	DefaultMode         string
	AutoProgressEnabled bool
	ApprovalBoundary    string
}

// WorkflowStageDefinitions returns the canonical workflow stage contract list.
func WorkflowStageDefinitions() []WorkflowStageDefinition {
	return []WorkflowStageDefinition{
		{Stage: WorkflowStageBootstrap, DefaultMode: WorkflowModeFoundation, AutoProgressEnabled: false, ApprovalBoundary: "foundation"},
		{Stage: WorkflowStageBootstrapReview, DefaultMode: WorkflowModeFoundation, AutoProgressEnabled: false, ApprovalBoundary: "foundation_review"},
		{Stage: WorkflowStageBootstrapConfirmed, DefaultMode: WorkflowModeFoundation, AutoProgressEnabled: true, ApprovalBoundary: "foundation_confirmed"},
		{Stage: WorkflowStagePlanAnalysis, DefaultMode: WorkflowModePlan, AutoProgressEnabled: true, ApprovalBoundary: "plan_generation"},
		{Stage: WorkflowStagePlanSelection, DefaultMode: WorkflowModeDiscuss, AutoProgressEnabled: false, ApprovalBoundary: "plan_selection"},
		{Stage: WorkflowStagePlanApproved, DefaultMode: WorkflowModeImplement, AutoProgressEnabled: true, ApprovalBoundary: "approved_plan"},
		{Stage: WorkflowStageImplement, DefaultMode: WorkflowModeImplement, AutoProgressEnabled: true, ApprovalBoundary: "implementation"},
	}
}

func workflowStageDefinitionForStage(stage string) (WorkflowStageDefinition, bool) {
	normalizedStage := strings.TrimSpace(stage)
	for _, definition := range WorkflowStageDefinitions() {
		if definition.Stage == normalizedStage {
			return definition, true
		}
	}
	return WorkflowStageDefinition{}, false
}

// OrchestrationContext 描述主链路编排阶段上下文。
type OrchestrationContext struct {
	WorkflowStage     string
	WorkflowMode      string
	RequestSource     string
	ValidationGate    string
	CapabilityProfile string
	RuntimeProjectID  string
	RuntimeAppType    string
	RuntimeProject    string
}

func (c OrchestrationContext) withDefaults(defaultStage, defaultMode string) OrchestrationContext {
	if strings.TrimSpace(c.WorkflowStage) == "" {
		c.WorkflowStage = defaultStage
	}
	if strings.TrimSpace(c.WorkflowMode) == "" {
		c.WorkflowMode = defaultMode
	}
	if strings.TrimSpace(c.RequestSource) == "" {
		c.RequestSource = RequestSourceHTTP
	}
	return c
}

// GeneratePlansCommand 描述方案链路的最小编排输入。
type GeneratePlansCommand struct {
	Context                   OrchestrationContext
	UserID                    string
	ProjectID                 string
	Description               string
	AppType                   string
	Language                  string
	Provider                  string
	UserFeedback              string
	CurrentPlans              []model.Plan
	VisualAttachments         []model.VisualAttachmentInput `json:"visual_attachments,omitempty"`
	VisualContext             *model.VisualContext          `json:"visual_context,omitempty"`
	VisualAttachmentsPrepared bool                          `json:"-"`
}

type BrowserAcceptanceAction struct {
	Type       string `json:"type"`
	Selector   string `json:"selector"`
	Text       string `json:"text,omitempty"`
	ExpectText string `json:"expect_text,omitempty"`
}

type BrowserAcceptanceContract struct {
	RequiredText []string                  `json:"required_text"`
	Actions      []BrowserAcceptanceAction `json:"actions"`
}

// GenerateCommand 描述生成链路的最小编排输入。
type GenerateCommand struct {
	Context                   OrchestrationContext
	UserID                    string
	ProjectID                 string
	Prompt                    string
	ConversationStage         string
	PlanContext               string
	AppType                   string
	ProjectName               string
	Mode                      string
	Online                    bool
	Model                     string
	Provider                  string
	Temperature               float64
	BrowserAcceptance         BrowserAcceptanceContract
	VisualAttachments         []model.VisualAttachmentInput `json:"visual_attachments,omitempty"`
	VisualContext             *model.VisualContext          `json:"visual_context,omitempty"`
	VisualEdit                *model.VisualEditContext      `json:"visual_edit,omitempty"`
	VisualAttachmentsPrepared bool                          `json:"-"`
	VisualEditPrepared        bool                          `json:"-"`
}

func (c GeneratePlansCommand) normalized() GeneratePlansCommand {
	c.Context = c.Context.withDefaults(WorkflowStagePlanAnalysis, WorkflowModePlan)
	if strings.TrimSpace(c.Context.RuntimeProjectID) == "" {
		c.Context.RuntimeProjectID = c.ProjectID
	}
	if strings.TrimSpace(c.Context.RuntimeAppType) == "" {
		c.Context.RuntimeAppType = c.AppType
	}
	return c
}

func defaultWorkflowModeForStage(stage string) string {
	if strings.TrimSpace(stage) == "" {
		return ""
	}
	definition, ok := workflowStageDefinitionForStage(stage)
	if ok {
		return definition.DefaultMode
	}
	return WorkflowModeImplement
}

// ResolveWorkflowStageMode 将旧请求字段归一化为显式编排阶段与模式。
func ResolveWorkflowStageMode(stageCandidate, modeCandidate, defaultStage, defaultMode string) (string, string) {
	stage := strings.TrimSpace(stageCandidate)
	mode := strings.TrimSpace(modeCandidate)
	if stage == "" {
		stage = mode
	}
	if stage == "" {
		stage = strings.TrimSpace(defaultStage)
	}
	if mode == "" {
		mode = defaultWorkflowModeForStage(stage)
	}
	if mode == "" {
		mode = strings.TrimSpace(defaultMode)
	}
	return stage, mode
}

func (c GenerateCommand) normalized() GenerateCommand {
	stage, mode := ResolveWorkflowStageMode(
		c.Context.WorkflowStage,
		c.Context.WorkflowMode,
		"",
		"",
	)
	if stage == "" || mode == "" {
		fallbackStage, fallbackMode := ResolveWorkflowStageMode(c.ConversationStage, c.Mode, WorkflowStageImplement, WorkflowModeImplement)
		if stage == "" {
			stage = fallbackStage
		}
		if mode == "" {
			mode = fallbackMode
		}
	}
	c.Context = c.Context.withDefaults(stage, mode)
	if c.Context.WorkflowMode == WorkflowModeImplement && strings.TrimSpace(c.Context.ValidationGate) == "" {
		c.Context.ValidationGate = ValidationGateBeforePreview
	}
	if strings.TrimSpace(c.Context.RuntimeProjectID) == "" {
		c.Context.RuntimeProjectID = c.ProjectID
	}
	if strings.TrimSpace(c.Context.RuntimeAppType) == "" {
		c.Context.RuntimeAppType = c.AppType
	}
	if strings.TrimSpace(c.Context.RuntimeProject) == "" {
		c.Context.RuntimeProject = c.ProjectName
	}
	return c
}
