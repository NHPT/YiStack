'use client';

import type { ProjectRuntimeStatus } from '@/lib/api';
import type { FileNodeType, GitCommit } from '@/lib/types';
import type { WorkflowStep } from '@/components/workspace/chat-message-content';

import { useWorkspacePageConversationActions } from './use-workspace-page-conversation-actions';
import type {
  WorkspacePageConversationProjectActions,
  WorkspacePageConversationShellState,
} from './use-workspace-page-conversation-actions';
import { useWorkspacePageOrchestrationActions } from './use-workspace-page-orchestration-actions';
import type { WorkspaceFlowStateContract } from './workspace-flow-state-contract';
import type { WorkspacePageAiActionsContract } from './workspace-page-ai-actions-contract';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type {
  WorkspaceFileTreeRefreshOptions,
  WorkspaceGitResourceRefreshOptions,
  WorkspaceRuntimeReadinessOptions,
} from './workspace-runtime-resources-contract';
import type { WorkspacePlanGenerationProjectIdSet } from './workspace-plan-generation-types';
import type { PersistGenerationState } from './workspace-types';

type LocalState = WorkspacePageLocalStateContract;
type FlowState = WorkspaceFlowStateContract;

export type WorkspacePageAiRuntimeResources = {
  fetchProjectDetail: (projectId: string) => Promise<void>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: WorkspaceFileTreeRefreshOptions,
  ) => Promise<void>;
  waitForProjectRuntimeReady: (projectId: string) => Promise<ProjectRuntimeStatus>;
  ensureProjectRuntimeReady: (
    projectId: string,
    options?: WorkspaceRuntimeReadinessOptions,
  ) => Promise<ProjectRuntimeStatus>;
  fetchProjectCommits: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitCommit[]>;
};

export type WorkspacePageAiProjectActions =
  WorkspacePageConversationProjectActions
  & {
    reflectFilePathInTree: (path: string, leafType?: FileNodeType) => void;
    applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  };

export type WorkspacePageAiShellState = WorkspacePageConversationShellState;

type UseWorkspacePageAiActionsOptions = {
  localState: LocalState;
  flowState: FlowState;
  shellState: WorkspacePageAiShellState;
  runtimeResources: WorkspacePageAiRuntimeResources;
  persistGenerationState: PersistGenerationState;
  projectActions: WorkspacePageAiProjectActions;
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
};

export function useWorkspacePageAiActions({
  localState,
  flowState,
  shellState,
  runtimeResources,
  persistGenerationState,
  projectActions,
  requestedPlanProjectsAcrossMounts,
  plannedProjectIdsAcrossMounts,
}: UseWorkspacePageAiActionsOptions): WorkspacePageAiActionsContract {
  const orchestrationActions = useWorkspacePageOrchestrationActions({
    localState,
    flowState: {
      messagesRef: flowState.messagesRef,
      availablePlans: flowState.availablePlans,
      recommendedPlanId: flowState.recommendedPlanId,
      selectedPlanId: flowState.selectedPlanId,
      updatePlanFlowState: flowState.updatePlanFlowState,
      applyWorkspaceState: flowState.applyWorkspaceState,
      applyWorkflowStepToMessage: flowState.applyWorkflowStepToMessage,
      applyOrchestrationSharedMessages: flowState.applyOrchestrationSharedMessages,
      applyGenerationStateMessages: flowState.applyGenerationStateMessages,
      applyPlanGenerationMessages: flowState.applyPlanGenerationMessages,
      applyPlanStreamPatchMessages: flowState.applyPlanStreamPatchMessages,
      applyPlanImplementationMessages: flowState.applyPlanImplementationMessages,
      applyImplementationGenerationMessages: flowState.applyImplementationGenerationMessages,
      applyImplementationStreamPatchMessages: flowState.applyImplementationStreamPatchMessages,
      setMessageStreamingState: flowState.setMessageStreamingState,
    },
    runtimeResources,
    persistGenerationState,
    projectActions,
    requestedPlanProjectsAcrossMounts,
    plannedProjectIdsAcrossMounts,
  });

  const conversationActions = useWorkspacePageConversationActions({
    localState,
    flowState: {
      applyPromptInteractionMessages: flowState.applyPromptInteractionMessages,
      applyPageEffectMessages: flowState.applyPageEffectMessages,
      messagesRef: flowState.messagesRef,
      availablePlans: flowState.availablePlans,
      recommendedPlanId: flowState.recommendedPlanId,
      selectedPlanId: flowState.selectedPlanId,
      updatePlanFlowState: flowState.updatePlanFlowState,
    },
    shellState,
    projectActions: {
      openWorkspaceFile: projectActions.openWorkspaceFile,
      openExplorerPanel: projectActions.openExplorerPanel,
      refreshExplorerPanel: projectActions.refreshExplorerPanel,
    },
    persistGenerationState,
    orchestrationActions,
  });

  return {
    ...conversationActions,
    choosePlanAndImplement: orchestrationActions.choosePlanAndImplement,
    requestPlansForProject: orchestrationActions.requestPlansForProject,
  };
}
