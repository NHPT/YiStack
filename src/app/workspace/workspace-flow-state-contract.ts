import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { Plan } from '@/lib/api';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
} from '@/lib/workspace/engineering-state';

import type {
  WorkspaceChatMessage,
  WorkspaceSessionSnapshot,
  WorkspaceWorkflowSnapshot,
} from './workspace-types';
import type {
  WorkspacePlanFlowStateApplyOptions,
  WorkspacePlanFlowStatePatch,
} from './workspace-plan-flow-state';

export type WorkspaceMessageListAction = Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
export type WorkspaceRuntimeRecoveryMessagesAction = WorkspaceMessageListAction;
export type WorkspaceProjectPanelRefreshMessagesAction = WorkspaceMessageListAction;

export type WorkspaceFlowStateContract = {
  messages: WorkspaceChatMessage[];
  setMessages: WorkspaceMessageListAction;
  messagesRef: RefObject<WorkspaceChatMessage[]>;
  workflowSnapshotRef: RefObject<WorkspaceWorkflowSnapshot>;
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  setSelectedPlanId: Dispatch<SetStateAction<string | null>>;
  planCountdown: number;
  setPlanCountdown: Dispatch<SetStateAction<number>>;
  planAutoConfirmDeadlineAt: string | null;
  setPlanAutoConfirmDeadlineAt: Dispatch<SetStateAction<string | null>>;
  planSelectionReady: boolean;
  updatePlanFlowState: (patch: WorkspacePlanFlowStatePatch) => void;
  applyWorkspaceState: (
    nextMessages: WorkspaceChatMessage[],
    options?: WorkspacePlanFlowStateApplyOptions,
  ) => void;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  applyRuntimeRecoveryMessages: WorkspaceRuntimeRecoveryMessagesAction;
  applyProjectPanelRefreshMessages: WorkspaceProjectPanelRefreshMessagesAction;
  applyPromptInteractionMessages: WorkspaceMessageListAction;
  applyRuntimeResourceMessages: WorkspaceMessageListAction;
  applyProjectBootstrapMessages: WorkspaceMessageListAction;
  applyPageEffectMessages: WorkspaceMessageListAction;
  applyPageUiMessages: WorkspaceMessageListAction;
  applyIdeInteractionMessages: WorkspaceMessageListAction;
  applyResourceFileMessages: WorkspaceMessageListAction;
  applyResourceGitMessages: WorkspaceMessageListAction;
  applyOrchestrationSharedMessages: WorkspaceMessageListAction;
  applyGenerationStateMessages: WorkspaceMessageListAction;
  applyPlanGenerationMessages: WorkspaceMessageListAction;
  applyPlanStreamPatchMessages: WorkspaceMessageListAction;
  applyPlanImplementationMessages: WorkspaceMessageListAction;
  applyImplementationGenerationMessages: WorkspaceMessageListAction;
  applyImplementationStreamPatchMessages: WorkspaceMessageListAction;
  readWorkspaceSessionSnapshot: (projectId: string) => WorkspaceSessionSnapshot | null;
  currentEngineeringState: WorkspaceEngineeringStateSnapshot | undefined;
  currentGateResult: WorkspaceGateResult | undefined;
};
