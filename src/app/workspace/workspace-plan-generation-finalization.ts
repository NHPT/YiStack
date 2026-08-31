import type { MutableRefObject } from 'react';

import type { Plan } from '@/lib/api';
import { buildPlanGenerationFinalizationError } from '@/lib/workspace/workspace-business-boundary-errors';

import type { PlanGenerationStreamResult } from './workspace-plan-generation-stream';
import { getWorkspaceRecommendedPlan } from './workspace-plan-message-helpers';
import type {
  WorkspacePlanGenerationProjectIdSet,
  WorkspacePlanGenerationProjectIdSetRef,
} from './workspace-plan-generation-types';
import type { ApplyWorkspaceState } from './workspace-orchestration-shared-types';
import type { WorkspaceChatMessage } from './workspace-types';
import {
  WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS,
  getWorkspacePlanAutoConfirmDeadlineFromSeconds,
} from './workspace-plan-flow-state';

type PlanGenerationFinalizationMessageList = WorkspaceChatMessage[];

function getPlanGenerationFinalizationTextValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value.trim();
}

function hasPlanGenerationFinalizationTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getPlanGenerationFinalizationMessage(
  messages: WorkspaceChatMessage[],
  planMessageId: string,
): WorkspaceChatMessage | undefined {
  for (const message of messages) {
    const isTargetMessage = message.id === planMessageId;
    if (isTargetMessage === true) {
      return message;
    }
  }

  return undefined;
}

function getPlanGenerationFinalizationWorkflowSteps(
  latestPlanMessage: WorkspaceChatMessage | undefined,
) {
  if (latestPlanMessage === undefined) {
    return undefined;
  }

  return latestPlanMessage.workflowSteps;
}

function materializePlanGenerationFinalizedMessages(
  messages: WorkspaceChatMessage[],
  planMessageId: string,
  planMessage: WorkspaceChatMessage,
): PlanGenerationFinalizationMessageList {
  const nextMessages: PlanGenerationFinalizationMessageList = [];

  for (const message of messages) {
    const isCurrentPlanMessage = message.id === planMessageId;
    if (isCurrentPlanMessage === true) {
      continue;
    }

    nextMessages.push(message);
  }

  nextMessages.push(planMessage);
  return nextMessages;
}

function getPlanGenerationFinalizationReasoningContent(
  payload: PlanGenerationStreamResult,
  latestPlanMessage: WorkspaceChatMessage | undefined,
): string | undefined {
  const analysisContent = getPlanGenerationFinalizationTextValue(payload.analysisContent);
  const hasAnalysisContent = hasPlanGenerationFinalizationTextValue(analysisContent);

  if (hasAnalysisContent === true) {
    return analysisContent;
  }

  const latestReasoningContent = getPlanGenerationFinalizationTextValue(latestPlanMessage?.reasoningContent);
  const hasLatestReasoningContent = hasPlanGenerationFinalizationTextValue(latestReasoningContent);

  return hasLatestReasoningContent === true ? latestReasoningContent : undefined;
}

function finalizePlanSelectionMessage(
  context: {
    enrichPlanMessageGuidance: (message: WorkspaceChatMessage) => WorkspaceChatMessage;
    isReplan: boolean;
    messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
    planMessageId: string;
  },
  payload: PlanGenerationStreamResult,
) {
  const recommendedPlan = getWorkspaceRecommendedPlan(payload.generatedPlans);
  if (recommendedPlan === undefined) {
    throw buildPlanGenerationFinalizationError(payload);
  }
  const latestPlanMessage = getPlanGenerationFinalizationMessage(
    context.messagesRef.current,
    context.planMessageId,
  );
  const reasoningContent = getPlanGenerationFinalizationReasoningContent(payload, latestPlanMessage);
  const workflowSteps = getPlanGenerationFinalizationWorkflowSteps(latestPlanMessage);

  return {
    recommendedPlan,
    planMessage: context.enrichPlanMessageGuidance({
      id: context.planMessageId,
      role: 'assistant',
      kind: 'plan-options',
      content: context.isReplan
        ? '我已根据你补充的需求更新了候选技术方案。你可以继续补充要求，或选择一个方案开始实现；如果 120 秒内未选择，我会自动确认推荐方案。'
        : '我已经完成需求分析，下面是推荐给你的技术方案。你可以手动选择一个方案继续实现；如果 120 秒内未选择，我会自动确认推荐方案。',
      reasoningContent,
      timestamp: new Date().toISOString(),
      plans: payload.generatedPlans,
      recommendedPlanId: recommendedPlan.id,
      suggestedQuestions: payload.planSuggestedQuestions,
      suggestedActions: payload.planSuggestedActions.length > 0
        ? [{ label: '按推荐方案实现', kind: 'confirm_recommended_plan' }, ...payload.planSuggestedActions]
        : payload.planSuggestedActions,
      planStreamComplete: true,
      workflowSteps,
      streaming: false,
    }),
  };
}

function applyFinalizedPlanState(
  context: {
    applyWorkspaceState: ApplyWorkspaceState;
    messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
    planMessage: WorkspaceChatMessage;
    planMessageId: string;
  },
  payload: {
    generatedPlans: Plan[];
    recommendedPlanId: string;
  },
) {
  const nextMessages = materializePlanGenerationFinalizedMessages(
    context.messagesRef.current,
    context.planMessageId,
    context.planMessage,
  );
  context.applyWorkspaceState(nextMessages, {
    availablePlans: payload.generatedPlans,
    recommendedPlanId: payload.recommendedPlanId,
    selectedPlanId: null,
    planCountdown: WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS,
    planAutoConfirmDeadlineAt: getWorkspacePlanAutoConfirmDeadlineFromSeconds(WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS),
    planSelectionReady: true,
  });
}

export function finalizeGeneratedPlans(
  context: {
    applyWorkspaceState: ApplyWorkspaceState;
    autoPlanTriggeredRef: MutableRefObject<boolean>;
    enrichPlanMessageGuidance: (message: WorkspaceChatMessage) => WorkspaceChatMessage;
    isReplan: boolean;
    messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
    planMessageId: string;
    plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
    plannedProjectIdsRef: WorkspacePlanGenerationProjectIdSetRef;
    projectId: string;
  },
  payload: PlanGenerationStreamResult,
) {
  if (payload.generatedPlans.length === 0) {
    throw buildPlanGenerationFinalizationError(payload);
  }

  const { recommendedPlan, planMessage } = finalizePlanSelectionMessage({
    enrichPlanMessageGuidance: context.enrichPlanMessageGuidance,
    isReplan: context.isReplan,
    messagesRef: context.messagesRef,
    planMessageId: context.planMessageId,
  }, payload);

  context.plannedProjectIdsRef.current.add(context.projectId);
  context.plannedProjectIdsAcrossMounts.add(context.projectId);
  context.autoPlanTriggeredRef.current = false;

  applyFinalizedPlanState({
    applyWorkspaceState: context.applyWorkspaceState,
    messagesRef: context.messagesRef,
    planMessage,
    planMessageId: context.planMessageId,
  }, {
    generatedPlans: payload.generatedPlans,
    recommendedPlanId: recommendedPlan.id,
  });
}
