import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type {
  ChatMode,
  PersistGenerationState,
  WorkspaceGenerationMode,
  WorkspaceChatMessage,
  WorkspaceProjectInfo,
} from './workspace-types';
import { appendGenerationStatePersistenceFailureMessage } from './workspace-generation-state-persistence';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';
import type { WorkspaceBackendWorkflowStage } from '@/lib/workspace/workflow-contract';
import type {
  ImplementationStreamContext,
  ImplementationStreamContextInput,
  ImplementationStreamStatusState,
} from './workspace-implementation-stream';

export {
  consumeImplementationStream,
  handleImplementationStreamFailure,
  type ImplementationStreamExecutionState,
} from './workspace-implementation-stream';

export type GenerateOptions = {
  mode?: WorkspaceGenerationMode;
  online?: boolean;
  conversationStage?: WorkspaceBackendWorkflowStage;
  capabilityProfile?: string;
  planContext?: string;
  assistantMessageId?: string;
  initialReasoningContent?: string;
};

export type PreparedImplementationGenerationRequest = {
  assistantMessageId: string;
  effectiveMode: WorkspaceGenerationMode;
  effectiveOnline: boolean;
  effectiveProject: WorkspaceProjectInfo | null;
  prompt: string;
  conversationStage?: WorkspaceBackendWorkflowStage;
  capabilityProfile?: string;
  planContext?: string;
  statusContent: string;
  hasExistingAssistantMessage: boolean;
};

type WorkspaceMessagePatch =
  | Partial<WorkspaceChatMessage>
  | ((message: WorkspaceChatMessage) => Partial<WorkspaceChatMessage> | null | undefined);

function getImplementationGeneratePayloadAppType(effectiveProject: WorkspaceProjectInfo | null): string {
  if (effectiveProject === null) {
    return 'web';
  }

  const hasAppType = effectiveProject.appType.length > 0;
  if (hasAppType === true) {
    return effectiveProject.appType;
  }

  return 'web';
}

function hasImplementationGenerationExistingAssistantMessage(hasExistingAssistantMessage: boolean): boolean {
  return hasExistingAssistantMessage === true;
}

function getImplementationGenerationStatusContent(statusContent: string): string | undefined {
  const hasStatusContent = statusContent.length > 0;
  if (hasStatusContent === true) {
    return statusContent;
  }

  return undefined;
}

function hasImplementationGenerationTextValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getImplementationGenerationAssistantMessageId(options: GenerateOptions | undefined): string {
  if (options === undefined) {
    return `assistant-${Date.now()}`;
  }

  const assistantMessageId = options.assistantMessageId;
  const hasAssistantMessageId = hasImplementationGenerationTextValue(assistantMessageId);
  if (hasAssistantMessageId === true) {
    return assistantMessageId;
  }

  return `assistant-${Date.now()}`;
}

function getImplementationGenerationMode(
  options: GenerateOptions | undefined,
  chatMode: ChatMode,
): WorkspaceGenerationMode {
  if (options === undefined) {
    return chatMode;
  }

  if (options.mode !== undefined) {
    return options.mode;
  }

  return chatMode;
}

function getImplementationGenerationOnline(options: GenerateOptions | undefined, isOnline: boolean): boolean {
  if (options === undefined) {
    return isOnline;
  }

  if (options.online !== undefined) {
    return options.online;
  }

  return isOnline;
}

function getImplementationGenerationProject(
  targetProject: WorkspaceProjectInfo | undefined,
  projectInfo: WorkspaceProjectInfo | null,
): WorkspaceProjectInfo | null {
  if (targetProject !== undefined) {
    return targetProject;
  }

  return projectInfo;
}

function getImplementationGenerationInitialReasoningContent(options: GenerateOptions | undefined): string {
  if (options === undefined) {
    return '';
  }

  const initialReasoningContent = options.initialReasoningContent;
  const hasInitialReasoningContent = hasImplementationGenerationTextValue(initialReasoningContent);
  if (hasInitialReasoningContent === true) {
    return initialReasoningContent;
  }

  return '';
}

function hasImplementationGenerationAssistantMessageId(options: GenerateOptions | undefined): boolean {
  if (options === undefined) {
    return false;
  }

  const hasAssistantMessageId = hasImplementationGenerationTextValue(options.assistantMessageId);
  return hasAssistantMessageId === true;
}

function hasImplementationGenerationEffectiveProjectId(
  effectiveProject: WorkspaceProjectInfo | null,
): effectiveProject is WorkspaceProjectInfo {
  if (effectiveProject === null) {
    return false;
  }

  const hasProjectId = effectiveProject.projectId.length > 0;
  return hasProjectId === true;
}

export type ImplementationStreamingUpdaters = {
  updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
  updateStreamingStepState: (
    stepEngineeringState?: WorkspaceEngineeringStateSnapshot,
    patch?: Partial<WorkspaceChatMessage>,
  ) => WorkspaceEngineeringStateSnapshot | undefined;
};

export function initializeImplementationGeneration(
  context: {
    assistantMessageId: string;
    effectiveMode: WorkspaceGenerationMode;
    effectiveProject: WorkspaceProjectInfo | null;
    hasExistingAssistantMessage: boolean;
    persistGenerationState: PersistGenerationState;
    prompt: string;
    applyImplementationGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
    applyGenerationStateMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
    setGenerationStage: Dispatch<SetStateAction<string>>;
    setIsGenerating: Dispatch<SetStateAction<boolean>>;
    setIsStopConfirming: Dispatch<SetStateAction<boolean>>;
    updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
  },
  state: ImplementationStreamStatusState,
) {
  const hasExistingAssistantMessage = hasImplementationGenerationExistingAssistantMessage(context.hasExistingAssistantMessage);
  const statusContent = getImplementationGenerationStatusContent(state.statusContent);

  if (hasExistingAssistantMessage === false) {
    context.applyImplementationGenerationMessages((prev) => [...prev, {
      id: context.assistantMessageId,
      role: 'assistant',
      content: '',
      reasoningContent: undefined,
      statusContent,
      kind: 'workflow',
      workflowSteps: [],
      streaming: true,
      timestamp: new Date(),
    }]);
  } else if (statusContent !== undefined) {
    context.updateStreamingMessage({ statusContent, streaming: true });
  }

  context.setIsGenerating(true);
  context.setIsStopConfirming(false);
  context.setGenerationStage(
    context.effectiveMode === 'discuss'
      ? '正在进行技术探讨...'
      : context.effectiveMode === 'foundation'
        ? '正在准备项目基础设定...'
        : '正在生成代码...',
  );

  if (hasImplementationGenerationEffectiveProjectId(context.effectiveProject) === true) {
    appendGenerationStatePersistenceFailureMessage(context.applyGenerationStateMessages, context.persistGenerationState({
      projectId: context.effectiveProject.projectId,
      projectName: context.effectiveProject.projectName,
      prompt: context.prompt,
      status: 'running',
      startedAt: new Date().toISOString(),
    }));
  }
}

export function cleanupImplementationGeneration(
  context: {
    generationAbortRef: MutableRefObject<AbortController | null>;
    persistGenerationState: PersistGenerationState;
    applyGenerationStateMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
    setGenerationStage: Dispatch<SetStateAction<string>>;
    setIsGenerating: Dispatch<SetStateAction<boolean>>;
    setIsStopConfirming: Dispatch<SetStateAction<boolean>>;
  },
) {
  context.generationAbortRef.current = null;
  context.setIsGenerating(false);
  context.setIsStopConfirming(false);
  context.setGenerationStage('');
  appendGenerationStatePersistenceFailureMessage(context.applyGenerationStateMessages, context.persistGenerationState(null));
}

export function prepareImplementationGenerationRequest(
  prompt: string,
  projectInfo: WorkspaceProjectInfo | null,
  chatMode: ChatMode,
  isOnline: boolean,
  options?: GenerateOptions,
  targetProject?: WorkspaceProjectInfo,
): PreparedImplementationGenerationRequest {
  return {
    assistantMessageId: getImplementationGenerationAssistantMessageId(options),
    effectiveMode: getImplementationGenerationMode(options, chatMode),
    effectiveOnline: getImplementationGenerationOnline(options, isOnline),
    effectiveProject: getImplementationGenerationProject(targetProject, projectInfo),
    prompt,
    conversationStage: options?.conversationStage,
    capabilityProfile: options?.capabilityProfile,
    planContext: options?.planContext,
    statusContent: getImplementationGenerationInitialReasoningContent(options),
    hasExistingAssistantMessage: hasImplementationGenerationAssistantMessageId(options),
  };
}

export function createImplementationStreamingUpdaters(
  assistantMessageId: string,
  context: {
    patchImplementationStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
  },
): ImplementationStreamingUpdaters {
  const updateStreamingMessage = (patch: Partial<WorkspaceChatMessage>) => {
    context.patchImplementationStreamMessage(assistantMessageId, { kind: 'workflow', ...patch });
  };

  const updateStreamingStepState = (
    stepEngineeringState?: WorkspaceEngineeringStateSnapshot,
    patch?: Partial<WorkspaceChatMessage>,
  ) => {
    if (stepEngineeringState || patch) {
      updateStreamingMessage({
        ...patch,
        ...(stepEngineeringState ? { engineeringState: stepEngineeringState } : {}),
      });
    }
    return stepEngineeringState;
  };

  return {
    updateStreamingMessage,
    updateStreamingStepState,
  };
}

export function buildImplementationGeneratePayload(
  request: PreparedImplementationGenerationRequest,
  selectedModel: string,
) {
  return {
    prompt: request.prompt,
    project_id: request.effectiveProject?.projectId,
    app_type: getImplementationGeneratePayloadAppType(request.effectiveProject),
    project_name: request.effectiveProject?.projectName,
    mode: request.effectiveMode,
    online: request.effectiveOnline,
    provider: selectedModel || undefined,
    temperature: 0.5,
    conversation_stage: request.conversationStage,
    capability_profile: request.capabilityProfile,
    plan_context: request.planContext,
    idempotency_key: request.assistantMessageId,
  };
}

export function buildImplementationStreamContext(
  request: PreparedImplementationGenerationRequest,
  updaters: ImplementationStreamingUpdaters,
  context: ImplementationStreamContextInput,
): ImplementationStreamContext {
  return {
    assistantMessageId: request.assistantMessageId,
    effectiveMode: request.effectiveMode,
    effectiveProject: request.effectiveProject,
    updateStreamingMessage: updaters.updateStreamingMessage,
    updateStreamingStepState: updaters.updateStreamingStepState,
    ...context,
  };
}
