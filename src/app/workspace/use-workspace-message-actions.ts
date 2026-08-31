import type { SetStateAction } from 'react';
import { useCallback } from 'react';

import type {
  WorkflowStep,
  WorkflowStepMeta,
} from '@/components/workspace/chat-message-content';

import type { WorkspaceMessageActionsContract } from './workspace-message-actions-contract';
import type { WorkspaceMessageMutationSource } from './workspace-message-state';
import type { WorkspaceChatMessage } from './workspace-types';

type WorkspaceMessagesApplier = (
  source: WorkspaceMessageMutationSource,
  value: SetStateAction<WorkspaceChatMessage[]>,
) => void;

type UseWorkspaceMessageActionsOptions = {
  applyWorkspaceMessages: WorkspaceMessagesApplier;
};

type WorkspaceMessageActionMessageList = WorkspaceChatMessage[];
type WorkspaceMessageActionWorkflowStepList = WorkflowStep[];

type WorkspaceMessageActionWorkflowMessageMaterializerInput = {
  messages: WorkspaceChatMessage[];
  messageId: string;
  step: WorkflowStep;
};

type WorkspaceMessageActionStreamingMessageMaterializerInput = {
  messages: WorkspaceChatMessage[];
  messageId: string;
  streaming: boolean;
};

function getWorkspaceMessageActionWorkflowSteps(
  message: WorkspaceChatMessage,
): WorkspaceMessageActionWorkflowStepList {
  if (Array.isArray(message.workflowSteps) === false) {
    return [];
  }

  return message.workflowSteps;
}

function getWorkspaceMessageActionWorkflowStepMeta(
  meta: WorkflowStepMeta | undefined,
): WorkflowStepMeta {
  if (meta === undefined) {
    return {};
  }

  return meta;
}

function hasWorkspaceMessageActionWorkflowStepMeta(meta: WorkflowStepMeta): boolean {
  const metaKeyCount = Object.keys(meta).length;
  const hasMeta = metaKeyCount > 0;
  return hasMeta === true;
}

function getWorkspaceMessageActionNextWorkflowStepMeta(
  nextMeta: WorkflowStepMeta,
  step: WorkflowStep,
): WorkflowStepMeta | undefined {
  const hasNextMeta = hasWorkspaceMessageActionWorkflowStepMeta(nextMeta);
  if (hasNextMeta === true) {
    return nextMeta;
  }

  return step.meta;
}

function getWorkspaceMessageActionWorkflowStepIndex(
  steps: WorkspaceMessageActionWorkflowStepList,
  stepId: string,
): number {
  for (let index = 0; index < steps.length; index += 1) {
    const item = steps[index];
    const isMatchingStep = item.id === stepId;
    if (isMatchingStep === true) {
      return index;
    }
  }

  return -1;
}

function materializeWorkspaceMessageActionWorkflowSteps(
  workflowSteps: WorkspaceMessageActionWorkflowStepList,
  step: WorkflowStep,
): WorkspaceMessageActionWorkflowStepList {
  const nextSteps: WorkspaceMessageActionWorkflowStepList = [];

  for (const workflowStep of workflowSteps) {
    nextSteps.push(workflowStep);
  }

  const existingIndex = getWorkspaceMessageActionWorkflowStepIndex(nextSteps, step.id);
  const now = Date.now();
  if (existingIndex >= 0) {
    const existingStep = nextSteps[existingIndex];
    const existingMeta = getWorkspaceMessageActionWorkflowStepMeta(existingStep.meta);
    const nextMeta: WorkflowStepMeta = {
      ...existingMeta,
      ...getWorkspaceMessageActionWorkflowStepMeta(step.meta),
    };
    if (step.status === 'running') {
      nextMeta.__startedAt = typeof existingMeta.__startedAt === 'number' ? existingMeta.__startedAt : now;
      delete nextMeta.__completedAt;
    } else if ((step.status === 'done' || step.status === 'failed') && typeof existingMeta.__startedAt === 'number') {
      nextMeta.__startedAt = existingMeta.__startedAt;
      nextMeta.__completedAt = now;
    }
    nextSteps[existingIndex] = {
      ...existingStep,
      ...step,
      meta: nextMeta,
    };

    return nextSteps;
  }

  const nextMeta: WorkflowStepMeta = {
    ...getWorkspaceMessageActionWorkflowStepMeta(step.meta),
  };
  if (step.status === 'running') {
    nextMeta.__startedAt = now;
  }
  nextSteps.push({
    ...step,
    meta: getWorkspaceMessageActionNextWorkflowStepMeta(nextMeta, step),
  });

  return nextSteps;
}

function materializeWorkspaceMessageActionWorkflowMessages({
  messages,
  messageId,
  step,
}: WorkspaceMessageActionWorkflowMessageMaterializerInput): WorkspaceMessageActionMessageList {
  const nextMessages: WorkspaceMessageActionMessageList = [];

  for (const message of messages) {
    if (message.id !== messageId) {
      nextMessages.push(message);
      continue;
    }

    const workflowSteps = getWorkspaceMessageActionWorkflowSteps(message);
    const nextSteps = materializeWorkspaceMessageActionWorkflowSteps(workflowSteps, step);
    nextMessages.push({
      ...message,
      kind: message.kind === 'plan-options' ? message.kind : 'workflow',
      workflowSteps: nextSteps,
    });
  }

  return nextMessages;
}

function materializeWorkspaceMessageActionStreamingMessages({
  messages,
  messageId,
  streaming,
}: WorkspaceMessageActionStreamingMessageMaterializerInput): WorkspaceMessageActionMessageList {
  const nextMessages: WorkspaceMessageActionMessageList = [];

  for (const message of messages) {
    if (message.id !== messageId) {
      nextMessages.push(message);
      continue;
    }

    nextMessages.push({
      ...message,
      kind: message.kind === 'plan-options' ? message.kind : 'workflow',
      streaming,
    });
  }

  return nextMessages;
}

export function useWorkspaceMessageActions({
  applyWorkspaceMessages,
}: UseWorkspaceMessageActionsOptions): WorkspaceMessageActionsContract {
  const applyWorkflowStepToMessage = useCallback((messageId: string, step: WorkflowStep) => {
    applyWorkspaceMessages('workflow_step', (prev) => materializeWorkspaceMessageActionWorkflowMessages({
      messages: prev,
      messageId,
      step,
    }));
  }, [applyWorkspaceMessages]);

  const setMessageStreamingState = useCallback((messageId: string, streaming: boolean) => {
    applyWorkspaceMessages('message_streaming', (prev) => materializeWorkspaceMessageActionStreamingMessages({
      messages: prev,
      messageId,
      streaming,
    }));
  }, [applyWorkspaceMessages]);

  const applyRuntimeRecoveryMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('runtime_recovery', value);
  }, [applyWorkspaceMessages]);

  const applyProjectPanelRefreshMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('project_panel_refresh', value);
  }, [applyWorkspaceMessages]);

  const applyPromptInteractionMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('prompt_interaction', value);
  }, [applyWorkspaceMessages]);

  const applyRuntimeResourceMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    void value;
  }, []);

  const applyProjectBootstrapMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('project_bootstrap', value);
  }, [applyWorkspaceMessages]);

  const applyPageEffectMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('page_effect', value);
  }, [applyWorkspaceMessages]);

  const applyPageUiMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('page_ui', value);
  }, [applyWorkspaceMessages]);

  const applyIdeInteractionMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('ide_interaction', value);
  }, [applyWorkspaceMessages]);

  const applyResourceFileMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('resource_file', value);
  }, [applyWorkspaceMessages]);

  const applyResourceGitMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('resource_git', value);
  }, [applyWorkspaceMessages]);

  const applyOrchestrationSharedMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('orchestration_shared', value);
  }, [applyWorkspaceMessages]);

  const applyGenerationStateMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('generation_state_persistence', value);
  }, [applyWorkspaceMessages]);

  const applyPlanGenerationMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('plan_generation', value);
  }, [applyWorkspaceMessages]);

  const applyPlanStreamPatchMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('plan_stream_patch', value);
  }, [applyWorkspaceMessages]);

  const applyPlanImplementationMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('plan_implementation', value);
  }, [applyWorkspaceMessages]);

  const applyImplementationGenerationMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('implementation_generation', value);
  }, [applyWorkspaceMessages]);

  const applyImplementationStreamPatchMessages = useCallback((value: SetStateAction<WorkspaceChatMessage[]>) => {
    applyWorkspaceMessages('implementation_stream_patch', value);
  }, [applyWorkspaceMessages]);

  return {
    applyWorkflowStepToMessage,
    setMessageStreamingState,
    applyRuntimeRecoveryMessages,
    applyProjectPanelRefreshMessages,
    applyPromptInteractionMessages,
    applyRuntimeResourceMessages,
    applyProjectBootstrapMessages,
    applyPageEffectMessages,
    applyPageUiMessages,
    applyIdeInteractionMessages,
    applyResourceFileMessages,
    applyResourceGitMessages,
    applyOrchestrationSharedMessages,
    applyGenerationStateMessages,
    applyPlanGenerationMessages,
    applyPlanStreamPatchMessages,
    applyPlanImplementationMessages,
    applyImplementationGenerationMessages,
    applyImplementationStreamPatchMessages,
  };
}
