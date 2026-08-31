'use client';

import type { RefObject } from 'react';

import type { Plan } from '@/lib/api';

import { useWorkspacePageEffects } from './use-workspace-page-effects';
import { useWorkspacePromptActions } from './use-workspace-prompt-actions';
import type { WorkspaceMessageListAction } from './workspace-flow-state-contract';
import type {
  WorkspaceImplementationGenerationActionContract,
  WorkspacePlanImplementationActionContract,
} from './workspace-orchestration-actions-contract';
import type { WorkspacePlanFlowStatePatch } from './workspace-plan-flow-state';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspacePageConversationActionsContract } from './workspace-page-conversation-actions-contract';
import type { WorkspaceShellStateSetter } from './workspace-shell-state-contract';
import type {
  PersistGenerationState,
  WorkspaceChatMessage,
  WorkspaceEditorNavigationTarget,
  WorkspaceMobileView,
} from './workspace-types';
import type { PlanRequestOptions } from './workspace-orchestration-hook-types';

type LocalState = WorkspacePageLocalStateContract;

export type WorkspacePageConversationFlowState = {
  applyPromptInteractionMessages: WorkspaceMessageListAction;
  applyPageEffectMessages: WorkspaceMessageListAction;
  messagesRef: RefObject<WorkspaceChatMessage[]>;
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  updatePlanFlowState: (patch: WorkspacePlanFlowStatePatch) => void;
};

export type WorkspacePageConversationOrchestrationActions = {
  buildPlanDiscussionPrompt: (question: string) => string;
  choosePlanAndImplement: WorkspacePlanImplementationActionContract;
  handleLLMGenerate: WorkspaceImplementationGenerationActionContract;
  requestPlansForProject: (options?: PlanRequestOptions) => Promise<void>;
};

export type WorkspacePageConversationShellState = {
  setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>;
};

export type WorkspacePageConversationProjectActions = {
  openWorkspaceFile: (target: string | WorkspaceEditorNavigationTarget) => Promise<void>;
  openExplorerPanel: () => void;
  refreshExplorerPanel: () => Promise<void>;
};

type UseWorkspacePageConversationActionsOptions = {
  localState: LocalState;
  flowState: WorkspacePageConversationFlowState;
  shellState: WorkspacePageConversationShellState;
  projectActions: WorkspacePageConversationProjectActions;
  persistGenerationState: PersistGenerationState;
  orchestrationActions: WorkspacePageConversationOrchestrationActions;
};

export function useWorkspacePageConversationActions({
  localState,
  flowState,
  shellState,
  projectActions,
  persistGenerationState,
  orchestrationActions,
}: UseWorkspacePageConversationActionsOptions): WorkspacePageConversationActionsContract {
  const {
    projectInfo,
    input,
    setInput,
    isGenerating,
    setIsGenerating,
    setGenerationStage,
    isStopConfirming,
    setIsStopConfirming,
    isPlanning,
    chatMode,
    isOnline,
    focusedPlanIdRef,
    generationAbortRef,
    planningAbortRef,
    autoPlanTriggeredRef,
    setActiveTab,
    setContextMenu,
  } = localState;

  const {
    applyPromptInteractionMessages,
    applyPageEffectMessages,
    messagesRef,
    availablePlans,
    recommendedPlanId,
    selectedPlanId,
    updatePlanFlowState,
  } = flowState;
  const {
    buildPlanDiscussionPrompt,
    choosePlanAndImplement,
    handleLLMGenerate,
    requestPlansForProject,
  } = orchestrationActions;

  const { handleCancelStopGenerate, handleStopGenerate } = useWorkspacePageEffects({
    projectInfo,
    input,
    isGenerating,
    isPlanning,
    isStopConfirming,
    generationAbortRef,
    planningAbortRef,
    applyPageEffectMessages,
    setIsGenerating,
    setGenerationStage,
    setIsStopConfirming,
    setContextMenu,
    persistGenerationState,
  });

  const {
    handleGenerate,
    handleSuggestedQuestion,
    handleSuggestedAction,
    handleStartFoundation,
    handleConfirmFoundationDecisions,
    foundationActionLabel,
    foundationStatusLabel,
  } = useWorkspacePromptActions({
    input,
    chatMode,
    isOnline,
    isGenerating,
    isPlanning,
    availablePlans,
    recommendedPlanId,
    selectedPlanId,
    projectInfo,
    messagesRef,
    focusedPlanIdRef,
    autoPlanTriggeredRef,
    setInput,
    applyPromptInteractionMessages,
    updatePlanFlowState,
    buildPlanDiscussionPrompt,
    choosePlanAndImplement,
    handleLLMGenerate,
    requestPlansForProject,
    onRefreshExplorerPanel: projectActions.refreshExplorerPanel,
    onOpenExplorerPanel: projectActions.openExplorerPanel,
    onOpenGitPanel: () => {
      setActiveTab('git');
      shellState.setMobileView('ide');
    },
    onOpenCapabilityAudit: () => {
      setActiveTab('debug');
      shellState.setMobileView('ide');
    },
    onOpenValidationFailure: projectActions.openWorkspaceFile,
    onOpenFoundationPanel: () => {
      setActiveTab('explorer');
      shellState.setMobileView('ide');
    },
  });

  return {
    handleCancelStopGenerate,
    handleStopGenerate,
    handleGenerate,
    handleSuggestedQuestion,
    handleSuggestedAction,
    handleStartFoundation,
    handleConfirmFoundationDecisions,
    foundationActionLabel,
    foundationStatusLabel,
  };
}
