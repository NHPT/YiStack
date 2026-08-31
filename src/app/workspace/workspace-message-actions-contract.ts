import type {
  Dispatch,
  SetStateAction,
} from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';

import type { WorkspaceChatMessage } from './workspace-types';

export type WorkspaceMessageAction = Dispatch<SetStateAction<WorkspaceChatMessage[]>>;

export type WorkspaceMessageActionsContract = {
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  applyRuntimeRecoveryMessages: WorkspaceMessageAction;
  applyProjectPanelRefreshMessages: WorkspaceMessageAction;
  applyPromptInteractionMessages: WorkspaceMessageAction;
  applyRuntimeResourceMessages: WorkspaceMessageAction;
  applyProjectBootstrapMessages: WorkspaceMessageAction;
  applyPageEffectMessages: WorkspaceMessageAction;
  applyPageUiMessages: WorkspaceMessageAction;
  applyIdeInteractionMessages: WorkspaceMessageAction;
  applyResourceFileMessages: WorkspaceMessageAction;
  applyResourceGitMessages: WorkspaceMessageAction;
  applyOrchestrationSharedMessages: WorkspaceMessageAction;
  applyGenerationStateMessages: WorkspaceMessageAction;
  applyPlanGenerationMessages: WorkspaceMessageAction;
  applyPlanStreamPatchMessages: WorkspaceMessageAction;
  applyPlanImplementationMessages: WorkspaceMessageAction;
  applyImplementationGenerationMessages: WorkspaceMessageAction;
  applyImplementationStreamPatchMessages: WorkspaceMessageAction;
};
