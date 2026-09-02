import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { projectApi } from '@/lib/api';
import type { WorkflowStep } from '@/components/workspace/chat-message-content';

import { finalizeGeneratedPlans } from './workspace-plan-generation-finalization';
import {
  consumePlanGenerationStream,
} from './workspace-plan-generation-stream';
import type {
  PreparedPlanGenerationRequest,
  WorkspacePlanGenerationProjectIdSet,
  WorkspacePlanGenerationProjectIdSetRef,
} from './workspace-plan-generation-types';
import type {
  NormalizeWorkflowStep,
  ResolveStepEngineeringState,
  SafeParseJSON,
} from './workspace-orchestration-shared';
import type { ApplyWorkspaceState, WorkspaceMessagePatch } from './workspace-orchestration-shared-types';
import type {
  WorkspaceChatMessage,
  WorkspaceEventMessageResolver,
  WorkspaceSuggestedActionsEventReader,
  WorkspaceSuggestedQuestionsEventReader,
} from './workspace-types';

export type PlanGenerationExecutionContext = {
  appendReasoningChunk: (current: string, nextChunk: string) => string;
  appendReasoningLine: (current: string, nextLine: string) => string;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  enrichPlanMessageGuidance: (message: WorkspaceChatMessage) => WorkspaceChatMessage;
  getEventMessage: WorkspaceEventMessageResolver;
  getSuggestedActionsFromEvent: WorkspaceSuggestedActionsEventReader;
  getSuggestedQuestionsFromEvent: WorkspaceSuggestedQuestionsEventReader;
  normalizeWorkflowStep: NormalizeWorkflowStep;
  resolveStepEngineeringState: ResolveStepEngineeringState;
  safeParseJSON: SafeParseJSON;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  applyWorkspaceState: ApplyWorkspaceState;
  applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyPlanStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  autoPlanTriggeredRef: MutableRefObject<boolean>;
  messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  plannedProjectIdsRef: WorkspacePlanGenerationProjectIdSetRef;
};

type WorkspacePlanStreamPatchMessageList = WorkspaceChatMessage[];

type WorkspacePlanStreamPatchMessageMaterializerInput = {
  messages: WorkspaceChatMessage[];
  messageId: string;
  patch: WorkspaceMessagePatch;
};

function createPlanStreamingMessage(
  planMessageId: string,
  initialStatusMessage: string,
) {
  return {
    id: planMessageId,
    role: 'assistant' as const,
    content: '',
    reasoningContent: initialStatusMessage,
    kind: 'plan-options' as const,
    plans: [],
    recommendedPlanId: undefined,
    planStreamComplete: false,
    workflowSteps: [],
    streaming: true,
    timestamp: new Date().toISOString(),
  };
}

function appendPlanStreamingMessage(
  context: {
    baseMessages: WorkspaceChatMessage[];
    initialStatusMessage: string;
    planMessageId: string;
    applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  },
) {
  context.applyPlanGenerationMessages((prev) => {
    const effectiveBaseMessages = prev.length > 0 ? prev : context.baseMessages;
    return [
      ...effectiveBaseMessages,
      createPlanStreamingMessage(context.planMessageId, context.initialStatusMessage),
    ];
  });
}

function materializeWorkspacePlanStreamPatchMessages({
  messages,
  messageId,
  patch,
}: WorkspacePlanStreamPatchMessageMaterializerInput): WorkspacePlanStreamPatchMessageList {
  const nextMessages: WorkspacePlanStreamPatchMessageList = [];

  for (const message of messages) {
    if (message.id !== messageId) {
      nextMessages.push(message);
      continue;
    }

    const nextPatch = typeof patch === 'function' ? patch(message) : patch;
    const hasNextPatch = nextPatch !== null && nextPatch !== undefined;
    if (hasNextPatch === false) {
      nextMessages.push(message);
      continue;
    }

    nextMessages.push({
      ...message,
      ...nextPatch,
    });
  }

  return nextMessages;
}

export async function executePlanGenerationRequest(
  request: PreparedPlanGenerationRequest,
  state: {
    abortController: AbortController;
    planMessageId: string;
  },
  context: PlanGenerationExecutionContext,
) {
  appendPlanStreamingMessage({
    baseMessages: request.baseMessages,
    initialStatusMessage: request.initialStatusMessage,
    planMessageId: state.planMessageId,
    applyPlanGenerationMessages: context.applyPlanGenerationMessages,
  });

  const hasUserFeedback = request.userFeedback.length > 0;
  const hasCurrentPlansForReplan = request.currentPlansForReplan.length > 0;
  const response = await projectApi.generatePlansStream({
    description: request.requestDescription,
    app_type: request.appType,
    project_id: request.persistedProjectId,
    provider: request.selectedModel || undefined,
    user_feedback: hasUserFeedback === true ? request.userFeedback : undefined,
    current_plans: hasCurrentPlansForReplan === true ? request.currentPlansForReplan : undefined,
    visual_attachments: request.visualAttachments,
    visual_context: request.visualContext,
  }, state.abortController.signal);

  const patchPlanStreamMessage = (
    messageId: string,
    patch: WorkspaceMessagePatch,
  ) => {
    context.applyPlanStreamPatchMessages((prev) => materializeWorkspacePlanStreamPatchMessages({
      messages: prev,
      messageId,
      patch,
    }));
  };

  const result = await consumePlanGenerationStream(response, {
    initialStatusMessage: request.initialStatusMessage,
    planMessageId: state.planMessageId,
  }, {
    appendReasoningChunk: context.appendReasoningChunk,
    appendReasoningLine: context.appendReasoningLine,
    applyWorkflowStepToMessage: context.applyWorkflowStepToMessage,
    enrichPlanMessageGuidance: context.enrichPlanMessageGuidance,
    getEventMessage: context.getEventMessage,
    getSuggestedActionsFromEvent: context.getSuggestedActionsFromEvent,
    getSuggestedQuestionsFromEvent: context.getSuggestedQuestionsFromEvent,
    normalizeWorkflowStep: context.normalizeWorkflowStep,
    patchPlanStreamMessage,
    resolveStepEngineeringState: context.resolveStepEngineeringState,
    safeParseJSON: context.safeParseJSON,
    setMessageStreamingState: context.setMessageStreamingState,
    applyPlanGenerationMessages: context.applyPlanGenerationMessages,
  });

  finalizeGeneratedPlans({
    applyWorkspaceState: context.applyWorkspaceState,
    autoPlanTriggeredRef: context.autoPlanTriggeredRef,
    enrichPlanMessageGuidance: context.enrichPlanMessageGuidance,
    isReplan: request.isReplan,
    messagesRef: context.messagesRef,
    planMessageId: state.planMessageId,
    plannedProjectIdsAcrossMounts: context.plannedProjectIdsAcrossMounts,
    plannedProjectIdsRef: context.plannedProjectIdsRef,
    projectId: request.projectId,
  }, result);
}
