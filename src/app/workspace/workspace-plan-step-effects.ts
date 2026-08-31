import type {
  ResolvedWorkflowStepEvent,
} from './workspace-orchestration-shared';
import type {
  PlanStepEffectsContext,
} from './workspace-plan-generation-stream-types';

function getPlanStepReasoningContent(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value;
}

export function applyPlanStepEffects(
  stepEvent: ResolvedWorkflowStepEvent,
  context: PlanStepEffectsContext,
  state: {
    analysisContent: string;
    lastStatusMessage: string;
  },
) {
  const { engineeringState: stepEngineeringState, step, statusLine } = stepEvent;
  const hasStatusLine = statusLine.length > 0;
  const analysisContentValue = state.analysisContent.trim();
  const hasAnalysisContent = analysisContentValue.length > 0;
  const shouldAppendStatusLine = hasStatusLine === true && hasAnalysisContent === false;
  const hasStepEngineeringState = stepEngineeringState !== undefined;

  context.patchPlanMessage((message) => {
    if (shouldAppendStatusLine === true) {
      const reasoningContent = getPlanStepReasoningContent(message.reasoningContent);
      return {
        reasoningContent: context.appendReasoningLine(reasoningContent, statusLine),
        engineeringState: hasStepEngineeringState === true ? stepEngineeringState : message.engineeringState,
      };
    }
    if (hasStepEngineeringState === true) {
      return { engineeringState: stepEngineeringState };
    }
    return null;
  });
  context.applyWorkflowStepToMessage(context.planMessageId, step);

  return {
    nextLastStatusMessage: shouldAppendStatusLine === true
      ? statusLine
      : state.lastStatusMessage,
  };
}
