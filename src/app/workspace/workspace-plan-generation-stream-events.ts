import type { Plan } from '@/lib/api';
import { isVisualContext } from '@/lib/visual-context';
import {
  buildPlanFoundationGateBlockedStreamError,
  buildPlanStreamError,
} from '@/lib/workspace/workspace-stream-boundary-errors';

import { resolveWorkflowStepEvent } from './workspace-orchestration-shared';
import type { WorkspaceStreamEventData } from './workspace-orchestration-shared';
import { getWorkspaceRecommendedPlanId } from './workspace-plan-message-helpers';
import { applyPlanStepEffects } from './workspace-plan-step-effects';
import type {
  PlanChunkEventContext,
  PlanDoneEventContext,
  PlanErrorEventContext,
  PlanEventContext,
  PlanMessagePatchContext,
  PlanMessagePatcherContext,
  PlanProgressEventContext,
  PlanStepEventContext,
  WorkspaceMessagePatch,
} from './workspace-plan-generation-stream-types';
import type { WorkspaceChatMessage } from './workspace-types';

type PlanGenerationStreamPlanList = Plan[];
type PlanGenerationStreamMessageList = WorkspaceChatMessage[];

type PlanGenerationStreamMessageMaterializerInput = {
  messages: WorkspaceChatMessage[];
  planMessageId: string;
  planMessage: WorkspaceChatMessage;
};

function getPlanStreamReasoningContent(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value;
}

function getPlanStreamEventText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

function hasPlanStreamContent(value: string): boolean {
  const hasContent = value.length > 0;
  return hasContent === true;
}

function getPlanGenerationStreamPlanIndex(
  plans: Plan[],
  planId: string,
): number {
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    const isTargetPlan = plan.id === planId;
    if (isTargetPlan === true) {
      return index;
    }
  }

  return -1;
}

function materializePlanGenerationStreamPlans(
  plans: Plan[],
  nextPlan: Plan,
): PlanGenerationStreamPlanList {
  const nextPlans: PlanGenerationStreamPlanList = [];

  for (const plan of plans) {
    nextPlans.push(plan);
  }

  const existingIndex = getPlanGenerationStreamPlanIndex(nextPlans, nextPlan.id);
  if (existingIndex >= 0) {
    nextPlans[existingIndex] = nextPlan;
    return nextPlans;
  }

  nextPlans.push(nextPlan);
  return nextPlans;
}

function getPlanGenerationStreamMessageWorkflowSteps(
  messages: WorkspaceChatMessage[],
  planMessageId: string,
) {
  for (const message of messages) {
    const isPlanMessage = message.id === planMessageId;
    if (isPlanMessage === true) {
      return message.workflowSteps;
    }
  }

  return undefined;
}

function materializePlanGenerationStreamMessages({
  messages,
  planMessageId,
  planMessage,
}: PlanGenerationStreamMessageMaterializerInput): PlanGenerationStreamMessageList {
  const nextMessages: PlanGenerationStreamMessageList = [];
  let hasReplacedPlanMessage = false;

  for (const message of messages) {
    const isPlanMessage = message.id === planMessageId;
    if (isPlanMessage === false) {
      nextMessages.push(message);
      continue;
    }

    nextMessages.push({
      ...message,
      ...planMessage,
    });
    hasReplacedPlanMessage = true;
  }

  if (hasReplacedPlanMessage === false) {
    nextMessages.push(planMessage);
  }

  return nextMessages;
}

export function createPlanMessagePatcher(
  context: PlanMessagePatcherContext,
  planMessageId: string,
) {
  return (patch: WorkspaceMessagePatch) => {
    context.patchPlanStreamMessage(planMessageId, (message) => {
      const nextPatch = typeof patch === 'function' ? patch(message) : patch;
      const hasNextPatch = nextPatch !== null && nextPatch !== undefined;
      return hasNextPatch === true ? { kind: 'plan-options', ...nextPatch } : null;
    });
  };
}

export function handlePlanVisualContextEvent(
  data: WorkspaceStreamEventData,
  context: PlanMessagePatchContext,
) {
  const visualContext = data.visual_context;
  if (isVisualContext(visualContext) === false) {
    return { handled: false };
  }
  context.patchPlanMessage({ visualContext });
  return { handled: true };
}

export function handlePlanProgressEvent(
  data: WorkspaceStreamEventData,
  context: PlanProgressEventContext,
  analysisContent: string,
  lastStatusMessage: string,
) {
  const statusMessage = typeof data.message === 'string' ? data.message.trim() : '';
  const hasStatusMessage = statusMessage.length > 0;
  const hasRepeatedStatusMessage = statusMessage === lastStatusMessage;
  if (hasStatusMessage === false || hasRepeatedStatusMessage === true) {
    return { handled: false, nextLastStatusMessage: lastStatusMessage };
  }

  const analysisContentValue = analysisContent.trim();
  const hasAnalysisContent = analysisContentValue.length > 0;
  context.patchPlanMessage((message) => {
    if (hasAnalysisContent === true) return null;
    const reasoningContent = getPlanStreamReasoningContent(message.reasoningContent);
    return { reasoningContent: context.appendReasoningLine(reasoningContent, statusMessage) };
  });

  return { handled: true, nextLastStatusMessage: statusMessage };
}

export function handlePlanStepEvent(
  data: WorkspaceStreamEventData,
  context: PlanStepEventContext,
  analysisContent: string,
  lastStatusMessage: string,
) {
  const stepEvent = resolveWorkflowStepEvent(
    data,
    context.normalizeWorkflowStep,
    context.resolveStepEngineeringState,
  );
  const hasStepEvent = stepEvent !== null && stepEvent !== undefined;
  if (hasStepEvent === false) {
    return { handled: false, nextLastStatusMessage: lastStatusMessage };
  }

  const { nextLastStatusMessage } = applyPlanStepEffects(stepEvent, context, {
    analysisContent,
    lastStatusMessage,
  });

  return {
    handled: true,
    nextLastStatusMessage,
  };
}

export function handlePlanChunkEvent(
  data: WorkspaceStreamEventData,
  context: PlanChunkEventContext,
  analysisContent: string,
) {
  let nextAnalysisContent = analysisContent;
  const reasoningContent = getPlanStreamEventText(data.reasoningContent);
  const hasReasoningContent = hasPlanStreamContent(reasoningContent);
  if (hasReasoningContent === true) {
    nextAnalysisContent = context.appendReasoningChunk(analysisContent, reasoningContent);
  } else {
    const eventContent = getPlanStreamEventText(data.content);
    nextAnalysisContent += eventContent;
  }

  context.patchPlanMessage({ reasoningContent: nextAnalysisContent });
  return { nextAnalysisContent };
}

export function handlePlanEvent(
  data: WorkspaceStreamEventData,
  context: PlanEventContext,
  state: {
    generatedPlans: Plan[];
    analysisContent: string;
    lastStatusMessage: string;
    planMessageId: string;
  },
) {
  const nextPlan = data.plan as Plan | undefined;
  const hasNextPlan = nextPlan !== undefined && nextPlan !== null && typeof nextPlan === 'object';
  if (hasNextPlan === false) {
    return { handled: false, nextGeneratedPlans: state.generatedPlans };
  }

  const dedupedPlans = materializePlanGenerationStreamPlans(state.generatedPlans, nextPlan);

  context.applyPlanGenerationMessages((prev) => {
    const workflowSteps = getPlanGenerationStreamMessageWorkflowSteps(prev, state.planMessageId);
    const analysisContent = state.analysisContent.trim();
    const hasAnalysisContent = analysisContent.length > 0;
    const recommendedPlanId = getWorkspaceRecommendedPlanId(dedupedPlans);
    const nextPlanMessage = context.enrichPlanMessageGuidance({
      id: state.planMessageId,
      role: 'assistant',
      kind: 'plan-options',
      content: '',
      reasoningContent: hasAnalysisContent === true ? analysisContent : state.lastStatusMessage,
      timestamp: new Date().toISOString(),
      plans: dedupedPlans,
      recommendedPlanId: recommendedPlanId ?? undefined,
      planStreamComplete: false,
      workflowSteps,
      streaming: true,
    });
    return materializePlanGenerationStreamMessages({
      messages: prev,
      planMessageId: state.planMessageId,
      planMessage: nextPlanMessage,
    });
  });

  return { handled: true, nextGeneratedPlans: dedupedPlans };
}

export function handlePlanDoneEvent(
  data: WorkspaceStreamEventData,
  context: PlanDoneEventContext,
  analysisContent: string,
  generatedPlans: Plan[],
) {
  let nextAnalysisContent = analysisContent;
  let nextGeneratedPlans = generatedPlans;

  context.setMessageStreamingState(context.planMessageId, false);
  const hasEventPlans = Array.isArray(data.plans) && data.plans.length > 0;
  if (hasEventPlans === true) {
    nextGeneratedPlans = data.plans as Plan[];
  }
  const planSuggestedQuestions = context.getSuggestedQuestionsFromEvent(data);
  const planSuggestedActions = context.getSuggestedActionsFromEvent(data);
  const eventContent = typeof data.content === 'string' ? data.content.trim() : '';
  const hasEventContent = eventContent.length > 0;
  if (hasEventContent === true) {
    nextAnalysisContent = eventContent;
    context.patchPlanMessage({ streaming: false, reasoningContent: nextAnalysisContent });
  }

  return {
    nextAnalysisContent,
    nextGeneratedPlans,
    planSuggestedQuestions,
    planSuggestedActions,
  };
}

export function handlePlanErrorEvent(
  data: WorkspaceStreamEventData,
  context: PlanErrorEventContext,
) {
  const engineeringState = context.resolveStepEngineeringState(data);
  if (data.code === 'foundation_gate_blocked') {
    const message = context.getEventMessage(data, '项目基础设定尚未完成，已暂停进入方案生成。');
    const hasEngineeringState = engineeringState !== undefined;
    context.patchPlanMessage((currentMessage) => ({
      content: message,
      reasoningContent: context.appendReasoningLine(
        getPlanStreamReasoningContent(currentMessage.reasoningContent),
        message,
      ),
      statusContent: '项目基础设定尚未完成，已暂停进入方案生成。',
      engineeringState: hasEngineeringState === true ? engineeringState : currentMessage.engineeringState,
      streaming: false,
    }));
    throw buildPlanFoundationGateBlockedStreamError(message, engineeringState);
  }
  const message = context.getEventMessage(data, '生成技术方案失败');
  throw buildPlanStreamError(data, message, engineeringState);
}
