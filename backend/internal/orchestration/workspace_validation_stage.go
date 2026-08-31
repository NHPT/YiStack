package orchestration

import (
	"context"
	"strings"

	"yistack/internal/service"
)

func startValidationWorkflowStage(ctx context.Context, state EngineeringState, handler service.StreamEventHandler) (context.Context, EngineeringState) {
	state = state.withWorkflowStatus(EngineeringStatusRunning).
		withValidationStatus(EngineeringStatusRunning).
		withCurrentTask("执行 YES 校验").
		withExecutionPause(false, "", "", "等待 YES 校验结果")
	ctx = withEngineeringState(ctx, state)

	_ = emitValidationWorkflowStep(handler, buildValidationWorkflowStep(
		state.Validation.Gate,
		"运行 YES 最小验证",
		"正在执行 yes:validate，验证当前结果是否允许进入 preview。",
		"running",
		state,
	))

	return ctx, state
}

func finishFailedValidationWorkflowStage(
	ctx context.Context,
	recorder EngineeringStateRecorder,
	command GenerateCommand,
	state EngineeringState,
	result ValidationGateResult,
	err error,
	handler service.StreamEventHandler,
) (context.Context, error) {
	detail := summarizeValidationOutput(result.Output, err)
	state.Validation.FailureItems = parseValidationFailureItems(state.Validation.Gate, result.Output, detail, err)
	state = state.withWorkflowStatus(EngineeringStatusFailed).
		withValidationStatus(EngineeringStatusFailed).
		withCurrentTask("处理 YES 校验失败").
		withExecutionAutoProgress(false).
		withExecutionPause(true, "validation_gate_blocked", "validation_gate", "修复校验失败项后重试").
		withRecovery(buildValidationGateRecoveryState(state, detail))
	ctx = withEngineeringState(ctx, state)

	step := buildValidationWorkflowStep(state.Validation.Gate, "运行 YES 最小验证", detail, "failed", state)
	_ = emitValidationWorkflowStep(handler, step)
	recordValidationState(ctx, recorder, command, state, step, detail)

	return ctx, &ValidationGateError{
		Gate:   state.Validation.Gate,
		State:  state,
		Output: result.Output,
		Err:    err,
	}
}

func finishPassedValidationWorkflowStage(
	ctx context.Context,
	recorder EngineeringStateRecorder,
	command GenerateCommand,
	state EngineeringState,
	result ValidationGateResult,
	handler service.StreamEventHandler,
) (context.Context, error) {
	state = state.withWorkflowStatus(EngineeringStatusPassed).
		withValidationStatus(EngineeringStatusPassed).
		withCurrentTask("YES 校验通过").
		withExecutionPause(false, "", "", "继续进入预览或后续流程")
	ctx = withEngineeringState(ctx, state)

	detail := strings.TrimSpace(result.Summary)
	if detail == "" {
		detail = "YES validation passed, ready for preview."
	}
	step := buildValidationWorkflowStep(state.Validation.Gate, "运行 YES 最小验证", detail, "done", state)
	_ = emitValidationWorkflowStep(handler, step)
	recordValidationState(ctx, recorder, command, state, step, detail)
	return ctx, nil
}
