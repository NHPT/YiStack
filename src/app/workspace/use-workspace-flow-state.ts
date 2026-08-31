import type {
  EditorBufferStatus,
  WorkspaceChatMessage,
  WorkspaceOpenFilePathList,
} from './workspace-types';
import type { WorkspaceFlowStateContract } from './workspace-flow-state-contract';
import { useWorkspaceFlowRefs } from './use-workspace-flow-refs';
import { useWorkspaceMessageActions } from './use-workspace-message-actions';
import { useWorkspaceMessageDispatch } from './use-workspace-message-dispatch';
import { useWorkspacePlanFlowState } from './use-workspace-plan-flow-state';
import { useWorkspaceSessionSnapshot } from './use-workspace-session-snapshot';

type UseWorkspaceFlowStateOptions = {
  projectId: string | null | undefined;
  editorState: {
    activeFile: string | null;
    openFiles: WorkspaceOpenFilePathList;
    files: Map<string, string>;
    savedFiles: Map<string, string>;
    editorBufferStatuses: Map<string, EditorBufferStatus>;
    expandedFolders: Set<string>;
    searchQuery: string;
    pendingCloseFile: string | null;
  };
  normalizePlanSelectionMessages: (messages: WorkspaceChatMessage[]) => WorkspaceChatMessage[];
  removeLegacyPlaceholderMessages: (messages: WorkspaceChatMessage[]) => WorkspaceChatMessage[];
};

export function useWorkspaceFlowState({
  projectId,
  editorState,
  normalizePlanSelectionMessages,
  removeLegacyPlaceholderMessages,
}: UseWorkspaceFlowStateOptions): WorkspaceFlowStateContract {
  const messageDispatch = useWorkspaceMessageDispatch();

  const messageActions = useWorkspaceMessageActions({
    applyWorkspaceMessages: messageDispatch.applyWorkspaceMessages,
  });
  const flowRefs = useWorkspaceFlowRefs({
    messages: messageDispatch.messages,
    workflowSnapshot: messageDispatch.workflowSnapshot,
    initialWorkflowSnapshot: messageDispatch.initialWorkflowSnapshot,
  });

  const planFlowState = useWorkspacePlanFlowState({
    normalizePlanSelectionMessages,
    removeLegacyPlaceholderMessages,
    applyWorkspaceMessages: messageDispatch.applyWorkspaceMessages,
  });
  const sessionSnapshot = useWorkspaceSessionSnapshot({
    projectId,
    messages: messageDispatch.messages,
    planState: {
      availablePlans: planFlowState.availablePlans,
      recommendedPlanId: planFlowState.recommendedPlanId,
      selectedPlanId: planFlowState.selectedPlanId,
      planCountdown: planFlowState.planCountdown,
      planAutoConfirmDeadlineAt: planFlowState.planAutoConfirmDeadlineAt,
      planSelectionReady: planFlowState.planSelectionReady,
    },
    editorState,
    applyWorkspaceMessages: messageDispatch.applyWorkspaceMessages,
  });

  return {
    messages: messageDispatch.messages,
    setMessages: messageDispatch.setMessages,
    messagesRef: flowRefs.messagesRef,
    workflowSnapshotRef: flowRefs.workflowSnapshotRef,
    availablePlans: planFlowState.availablePlans,
    recommendedPlanId: planFlowState.recommendedPlanId,
    selectedPlanId: planFlowState.selectedPlanId,
    setSelectedPlanId: planFlowState.setSelectedPlanId,
    planCountdown: planFlowState.planCountdown,
    setPlanCountdown: planFlowState.setPlanCountdown,
    planAutoConfirmDeadlineAt: planFlowState.planAutoConfirmDeadlineAt,
    setPlanAutoConfirmDeadlineAt: planFlowState.setPlanAutoConfirmDeadlineAt,
    planSelectionReady: planFlowState.planSelectionReady,
    updatePlanFlowState: planFlowState.updatePlanFlowState,
    applyWorkspaceState: planFlowState.applyWorkspaceState,
    applyWorkflowStepToMessage: messageActions.applyWorkflowStepToMessage,
    setMessageStreamingState: messageActions.setMessageStreamingState,
    applyRuntimeRecoveryMessages: messageActions.applyRuntimeRecoveryMessages,
    applyProjectPanelRefreshMessages: messageActions.applyProjectPanelRefreshMessages,
    applyPromptInteractionMessages: messageActions.applyPromptInteractionMessages,
    applyRuntimeResourceMessages: messageActions.applyRuntimeResourceMessages,
    applyProjectBootstrapMessages: messageActions.applyProjectBootstrapMessages,
    applyPageEffectMessages: messageActions.applyPageEffectMessages,
    applyPageUiMessages: messageActions.applyPageUiMessages,
    applyIdeInteractionMessages: messageActions.applyIdeInteractionMessages,
    applyResourceFileMessages: messageActions.applyResourceFileMessages,
    applyResourceGitMessages: messageActions.applyResourceGitMessages,
    applyOrchestrationSharedMessages: messageActions.applyOrchestrationSharedMessages,
    applyGenerationStateMessages: messageActions.applyGenerationStateMessages,
    applyPlanGenerationMessages: messageActions.applyPlanGenerationMessages,
    applyPlanStreamPatchMessages: messageActions.applyPlanStreamPatchMessages,
    applyPlanImplementationMessages: messageActions.applyPlanImplementationMessages,
    applyImplementationGenerationMessages: messageActions.applyImplementationGenerationMessages,
    applyImplementationStreamPatchMessages: messageActions.applyImplementationStreamPatchMessages,
    readWorkspaceSessionSnapshot: sessionSnapshot.readWorkspaceSessionSnapshot,
    currentEngineeringState: messageDispatch.currentEngineeringState,
    currentGateResult: messageDispatch.currentGateResult,
  };
}
