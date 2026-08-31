import type {
  ResolvedWorkflowStepEvent,
} from './workspace-orchestration-shared';
import type {
  ImplementationStepEffectsContext,
} from './workspace-implementation-stream-types';
import { buildFailedWorkspaceFileOperationStepState } from './workspace-file-operation-step-state';

function getImplementationStepEngineeringState(stepEvent: ResolvedWorkflowStepEvent) {
  const stepEngineeringState = stepEvent.engineeringState;
  const hasStepEngineeringState = stepEngineeringState !== undefined;
  if (hasStepEngineeringState === true) {
    return stepEngineeringState;
  }

  return buildFailedWorkspaceFileOperationStepState(stepEvent.step);
}

function shouldAppendImplementationStepStatusLine(stepEvent: ResolvedWorkflowStepEvent): boolean {
  const shouldAppendStatusLine = stepEvent.shouldAppendStatusLine === true;
  return shouldAppendStatusLine === true;
}

function hasImplementationStepActiveFileOperation(stepEvent: ResolvedWorkflowStepEvent): boolean {
  const isRunning = stepEvent.isRunning === true;
  const isFileOperation = stepEvent.isFileOperation === true;
  return isRunning === true && isFileOperation === true;
}

export async function applyImplementationStepEffects(
  stepEvent: ResolvedWorkflowStepEvent,
  context: ImplementationStepEffectsContext,
  statusContent: string,
) {
  const { step, statusLine } = stepEvent;
  const effectiveStepEngineeringState = getImplementationStepEngineeringState(stepEvent);
  const shouldAppendStatusLine = shouldAppendImplementationStepStatusLine(stepEvent);
  const hasActiveFileOperation = hasImplementationStepActiveFileOperation(stepEvent);
  let nextStatusContent = statusContent;

  if (shouldAppendStatusLine === true) {
    nextStatusContent = context.appendStatusLine(statusContent, statusLine);
    context.updateStreamingStepState(effectiveStepEngineeringState, {
      statusContent: nextStatusContent,
      activeFileOperation: hasActiveFileOperation === true
        ? statusLine
        : undefined,
    });
  } else {
    context.updateStreamingStepState(effectiveStepEngineeringState);
  }

  context.applyWorkflowStepToMessage(context.assistantMessageId, step);
  context.applyIncrementalWorkflowStep(step);
  if (hasActiveFileOperation === true) {
    await context.yieldStepRender();
  }

  return { nextStatusContent };
}
