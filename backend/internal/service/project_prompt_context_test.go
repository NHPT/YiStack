package service

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"yistack/config"
	"yistack/internal/model"
)

func TestBuildProjectPromptContextBundleOrdersSourcesByPriority(t *testing.T) {
	bundle := buildProjectPromptContextBundle("project-123", []projectPromptContextSource{
		{Title: "项目级稳定上下文", Priority: 6, Content: "PROJECT_CONTEXT"},
		{Title: "项目级文档维护清单", Priority: 7, Content: `{"revision":2}`},
		{Title: "Foundation 结构化状态", Priority: 1, Content: "{\"status\":\"completed\"}"},
		{Title: "Engineering Policy", Priority: 3, Content: "POLICY"},
	})

	if !strings.Contains(bundle, "当前项目命名空间：project-123") {
		t.Fatalf("expected project namespace in bundle, got %q", bundle)
	}
	firstIndex := strings.Index(bundle, "[P1] Foundation 结构化状态")
	secondIndex := strings.Index(bundle, "[P3] Engineering Policy")
	thirdIndex := strings.Index(bundle, "[P6] 项目级稳定上下文")
	fourthIndex := strings.Index(bundle, "[P7] 项目级文档维护清单")
	if firstIndex < 0 || secondIndex < 0 || thirdIndex < 0 || fourthIndex < 0 {
		t.Fatalf("expected all prioritized sections in bundle, got %q", bundle)
	}
	if !(firstIndex < secondIndex && secondIndex < thirdIndex && thirdIndex < fourthIndex) {
		t.Fatalf("expected sources ordered by priority, got %q", bundle)
	}
	if !strings.Contains(bundle, "项目级 supporting docs 维护清单") {
		t.Fatalf("expected supporting docs manifest priority in bundle, got %q", bundle)
	}
	if !strings.Contains(bundle, "聊天历史与压缩摘要（仅作补充，不得覆盖以上真源）") {
		t.Fatalf("expected summary boundary in bundle, got %q", bundle)
	}
}

func TestBuildProjectPromptContextBundleSkipsEmptySources(t *testing.T) {
	bundle := buildProjectPromptContextBundle("project-123", []projectPromptContextSource{
		{Title: "Foundation 结构化状态", Priority: 1, Content: ""},
		{Title: "项目级稳定上下文", Priority: 6, Content: "PROJECT_CONTEXT"},
	})

	if strings.Contains(bundle, "[P1] Foundation 结构化状态") {
		t.Fatalf("expected empty source to be skipped, got %q", bundle)
	}
	if !strings.Contains(bundle, "[P6] 项目级稳定上下文") {
		t.Fatalf("expected non-empty source to remain, got %q", bundle)
	}
}

func TestDetectProjectPromptContextConflictsReturnsProjectIDMismatch(t *testing.T) {
	conflicts := detectProjectPromptContextConflicts(
		"project-current",
		"ai_agent",
		"- 项目 ID：project-other\n- 应用类型：ai_agent",
		"",
	)
	if len(conflicts) == 0 {
		t.Fatal("expected conflict for mismatched project id")
	}
	if !strings.Contains(conflicts[0], projectContextPath+" 项目 ID=project-other") {
		t.Fatalf("expected project id mismatch detail, got %v", conflicts)
	}
}

func TestDetectProjectPromptContextConflictsReturnsNoConflictForMatchingNamespace(t *testing.T) {
	conflicts := detectProjectPromptContextConflicts(
		"project-current",
		"ai_agent",
		"- 项目 ID：project-current\n- 应用类型：ai_agent",
		`{"schema_version":"v1","updated_at":"2026-07-10T00:00:00Z","state":{"project_type":"ai_agent_platform"}}`,
	)
	if len(conflicts) != 0 {
		t.Fatalf("expected no conflict, got %v", conflicts)
	}
}

func TestLoadProjectPromptContextManagerUnavailableBlocksContextGate(t *testing.T) {
	root := t.TempDir()
	projectID := "project-context-unavailable"
	projectDir := filepath.Join(root, projectID)
	repo := &stubProjectListRepo{}
	service := NewGeneratorService(GeneratorServiceOptions{
		ProjectRepo:  repo,
		ContainerCfg: &config.ContainerConfig{ProjectDir: root},
	})
	project := &model.Project{
		ProjectID:     projectID,
		DirectoryPath: projectDir,
		AppType:       "web",
	}

	bundle, err := service.loadProjectPromptContext(context.Background(), project)

	if strings.Contains(bundle, "[P1] Foundation 结构化状态") {
		t.Fatalf("expected no context source sections when bootstrap cannot be read, got %q", bundle)
	}
	var gateErr *ProjectPromptContextConflictError
	if !errors.As(err, &gateErr) {
		t.Fatalf("expected context gate error, got %T %v", err, err)
	}
	if len(gateErr.Reasons) == 0 || !strings.Contains(gateErr.Reasons[0], projectBootstrapStatePath+" 读取失败") {
		t.Fatalf("expected context source read failure reason, got %#v", gateErr.Reasons)
	}
	if repo.updatedContainerProject != projectID || repo.updatedContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status update, got project=%q status=%q", repo.updatedContainerProject, repo.updatedContainerStatus)
	}
	stored, err := readProjectRuntimeStatus(projectDir)
	if err != nil {
		t.Fatalf("expected context unavailable runtime snapshot to be readable: %v", err)
	}
	if stored == nil || stored.Status != "failed" || stored.ContainerStatus != "unavailable" || stored.Phase != "generation" {
		t.Fatalf("expected persisted context unavailable runtime snapshot, got %#v", stored)
	}
}

func TestLoadProjectPromptContextUsesProjectFileArtifactBeforeContainer(t *testing.T) {
	projectID := "project-context-artifact"
	fileRepo := &artifactFileRepoStub{}
	service := NewGeneratorService(GeneratorServiceOptions{
		FileRepo: fileRepo,
	})
	_, err := service.persistProjectArtifactRecord(
		context.Background(),
		projectID,
		projectBootstrapStatePath,
		`{"schema_version":"v1","updated_at":"2026-07-26T00:00:00Z","state":{"status":"completed","project_type":"web","design_readiness":{"status":"ready","tech_stack_ready":true,"architecture_ready":true,"directory_structure_ready":true,"interface_contract_ready":true,"data_model_ready":true,"missing_items":[]}}}`,
	)
	if err != nil {
		t.Fatalf("expected bootstrap artifact record to persist, got %v", err)
	}

	bundle, err := service.loadProjectPromptContext(context.Background(), &model.Project{
		ProjectID: projectID,
		AppType:   "web",
	})

	if err != nil {
		t.Fatalf("expected project file artifact context to pass without container, got %v", err)
	}
	if !strings.Contains(bundle, "[P1] Foundation 结构化状态") {
		t.Fatalf("expected bootstrap artifact in context bundle, got %q", bundle)
	}
	if !strings.Contains(bundle, "生成前设计 readiness 摘要：") || !strings.Contains(bundle, "- 技术栈与运行时：ready") {
		t.Fatalf("expected design readiness summary in context bundle, got %q", bundle)
	}
	if strings.Contains(bundle, projectFoundationBriefPath+" 读取失败") {
		t.Fatalf("optional foundation docs should not block context bundle, got %q", bundle)
	}
}

func TestBuildFoundationDesignReadinessPromptSummaryIncludesMissingItems(t *testing.T) {
	summary := BuildFoundationDesignReadinessPromptSummary(`{
  "schema_version": "v1",
  "state": {
    "design_readiness": {
      "status": "blocked",
      "tech_stack_ready": true,
      "architecture_ready": false,
      "directory_structure_ready": true,
      "interface_contract_ready": false,
      "data_model_ready": false,
      "missing_items": ["架构边界", "接口契约与错误模型", "数据模型与持久化策略"]
    }
  }
}`)

	for _, expected := range []string{
		"生成前设计 readiness 摘要：",
		"- 状态：blocked",
		"- 技术栈与运行时：ready",
		"- 架构边界：blocked",
		"- 接口契约：blocked",
		"- 缺失项：架构边界、接口契约与错误模型、数据模型与持久化策略",
	} {
		if !strings.Contains(summary, expected) {
			t.Fatalf("expected summary to include %q, got:\n%s", expected, summary)
		}
	}
}

func TestBuildProjectPromptContextGatePayloadIncludesStructuredGate(t *testing.T) {
	payload := buildProjectPromptContextGatePayload(&GenerateRequest{
		ProjectID:         "project-1",
		ProjectName:       "demo",
		AppType:           "ai_agent",
		Mode:              "discuss",
		ConversationStage: "bootstrap_review",
	}, &ProjectPromptContextConflictError{
		ProjectID: "project-1",
		Reasons:   []string{projectContextPath + " 项目 ID=project-x，与当前项目 project-1 不一致"},
	})

	if payload["code"] != "context_gate_blocked" {
		t.Fatalf("expected code %q, got %v", "context_gate_blocked", payload["code"])
	}
	gateResult, ok := payload["gate_result"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected gate_result payload, got %T", payload["gate_result"])
	}
	if gateResult["decision"] != "block" {
		t.Fatalf("expected decision %q, got %v", "block", gateResult["decision"])
	}
	engineeringState, ok := payload["engineeringState"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected engineeringState payload, got %T", payload["engineeringState"])
	}
	execution, ok := engineeringState["execution"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected execution payload, got %T", engineeringState["execution"])
	}
	if execution["pause_reason"] != "context_gate_blocked" {
		t.Fatalf("expected pause_reason %q, got %v", "context_gate_blocked", execution["pause_reason"])
	}
	recovery, ok := engineeringState["recovery"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recovery payload, got %T", engineeringState["recovery"])
	}
	if recovery["can_retry"] != true {
		t.Fatalf("expected can_retry true, got %v", recovery["can_retry"])
	}
	if recovery["resume_stage"] != "bootstrap_review" {
		t.Fatalf("expected resume_stage %q, got %v", "bootstrap_review", recovery["resume_stage"])
	}
}

func TestEmitProjectPromptContextConflictEmitsStepAndError(t *testing.T) {
	events := make([]struct {
		name    string
		payload interface{}
	}, 0)

	handler := func(name StreamEventName, payload StreamEventPayload) error {
		events = append(events, struct {
			name    string
			payload interface{}
		}{name: name, payload: payload})
		return nil
	}

	err := emitProjectPromptContextConflict(handler, &GenerateRequest{
		ProjectID: "project-1",
		AppType:   "ai_agent",
		Mode:      "implement",
	}, &ProjectPromptContextConflictError{
		ProjectID: "project-1",
		Reasons:   []string{projectContextPath + " 项目 ID=project-x，与当前项目 project-1 不一致"},
	})
	if err != nil {
		t.Fatalf("expected no handler error, got %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}
	if events[0].name != StreamEventStep {
		t.Fatalf("expected first event %q, got %q", StreamEventStep, events[0].name)
	}
	if events[1].name != StreamEventError {
		t.Fatalf("expected second event %q, got %q", StreamEventError, events[1].name)
	}
}
