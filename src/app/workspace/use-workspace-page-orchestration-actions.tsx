'use client';

import { useCallback } from 'react';
import type { RefObject } from 'react';

import type { Plan, ProjectRuntimeStatus } from '@/lib/api';
import type { FileNodeType, GitCommit } from '@/lib/types';
import type { WorkflowStep } from '@/components/workspace/chat-message-content';

import { useWorkspaceOrchestration } from './use-workspace-orchestration';
import type { WorkspaceMessageListAction } from './workspace-flow-state-contract';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspacePageOrchestrationActionsContract } from './workspace-page-orchestration-actions-contract';
import type {
  WorkspacePlanFlowStateApplyOptions,
  WorkspacePlanFlowStatePatch,
} from './workspace-plan-flow-state';
import type {
  WorkspaceFileTreeRefreshOptions,
  WorkspaceGitResourceRefreshOptions,
  WorkspaceRuntimeReadinessOptions,
} from './workspace-runtime-resources-contract';
import type { WorkspacePlanGenerationProjectIdSet } from './workspace-plan-generation-types';
import type { PersistGenerationState, WorkspaceChatMessage } from './workspace-types';
import {
  appendReasoningChunk,
  appendReasoningLine,
  appendStatusLine,
  getEventMessage,
  getGeneratedFilesFromEvent,
  normalizeWorkflowStep,
  safeParseJSON,
} from './workspace-page-helpers';
import {
  enrichPlanMessageGuidance,
  getGuidanceFromEvent,
  getSuggestedActionsFromEvent,
  getSuggestedQuestionsFromEvent,
  supersedePlanSelectionMessages,
} from './workspace-plan-message-helpers';

type LocalState = WorkspacePageLocalStateContract;

export type WorkspacePageOrchestrationFlowState = {
  messagesRef: RefObject<WorkspaceChatMessage[]>;
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  updatePlanFlowState: (patch: WorkspacePlanFlowStatePatch) => void;
  applyWorkspaceState: (
    nextMessages: WorkspaceChatMessage[],
    options?: WorkspacePlanFlowStateApplyOptions,
  ) => void;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  applyOrchestrationSharedMessages: WorkspaceMessageListAction;
  applyGenerationStateMessages: WorkspaceMessageListAction;
  applyPlanGenerationMessages: WorkspaceMessageListAction;
  applyPlanStreamPatchMessages: WorkspaceMessageListAction;
  applyPlanImplementationMessages: WorkspaceMessageListAction;
  applyImplementationGenerationMessages: WorkspaceMessageListAction;
  applyImplementationStreamPatchMessages: WorkspaceMessageListAction;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
};

export type WorkspacePageOrchestrationRuntimeResources = {
  fetchProjectDetail: (projectId: string) => Promise<void>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: WorkspaceFileTreeRefreshOptions,
  ) => Promise<void>;
  ensureProjectRuntimeReady: (
    projectId: string,
    options?: WorkspaceRuntimeReadinessOptions,
  ) => Promise<ProjectRuntimeStatus>;
  fetchProjectCommits: (
    projectId: string,
    options?: WorkspaceGitResourceRefreshOptions,
  ) => Promise<GitCommit[]>;
};

export type WorkspacePageOrchestrationProjectActions = {
  reflectFilePathInTree: (path: string, leafType?: FileNodeType) => void;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
};

type UseWorkspacePageOrchestrationActionsOptions = {
  localState: LocalState;
  flowState: WorkspacePageOrchestrationFlowState;
  runtimeResources: WorkspacePageOrchestrationRuntimeResources;
  persistGenerationState: PersistGenerationState;
  projectActions: WorkspacePageOrchestrationProjectActions;
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
};

export function useWorkspacePageOrchestrationActions({
  localState,
  flowState,
  runtimeResources,
  persistGenerationState,
  projectActions,
  requestedPlanProjectsAcrossMounts,
  plannedProjectIdsAcrossMounts,
}: UseWorkspacePageOrchestrationActionsOptions): WorkspacePageOrchestrationActionsContract {
  const {
    projectInfo,
    setProjectInfo,
    setIsGenerating,
    setGenerationStage,
    setIsStopConfirming,
    setIsPlanning,
    selectedModel,
    chatMode,
    isOnline,
    files,
    setFiles,
    savedFiles,
    setSavedFiles,
    generationAbortRef,
    planningAbortRef,
    initializedProjectIdRef,
    planningProjectIdRef,
    implementingPlanRef,
    autoPlanTriggeredRef,
    requestedPlansRef,
    plannedProjectIdsRef,
  } = localState;

  const {
    messagesRef,
    availablePlans,
    recommendedPlanId,
    selectedPlanId,
    updatePlanFlowState,
    applyWorkspaceState,
    applyWorkflowStepToMessage,
    applyOrchestrationSharedMessages,
    applyGenerationStateMessages,
    applyPlanGenerationMessages,
    applyPlanStreamPatchMessages,
    applyPlanImplementationMessages,
    applyImplementationGenerationMessages,
    applyImplementationStreamPatchMessages,
    setMessageStreamingState,
  } = flowState;

  const {
    fetchProjectDetail,
    refreshProjectFileTree,
    ensureProjectRuntimeReady,
    fetchProjectCommits,
  } = runtimeResources;
  const { reflectFilePathInTree, applyIncrementalWorkflowStep } = projectActions;

  const yieldStepRender = useCallback(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  }), []);

  return useWorkspaceOrchestration({
    projectInfo,
    chatMode,
    isOnline,
    selectedModel,
    availablePlans,
    recommendedPlanId,
    selectedPlanId,
      updatePlanFlowState,
    files,
    savedFiles,
    requestedPlanProjectsAcrossMounts,
    plannedProjectIdsAcrossMounts,
    messagesRef,
    generationAbortRef,
    planningAbortRef,
    initializedProjectIdRef,
    planningProjectIdRef,
    implementingPlanRef,
    autoPlanTriggeredRef,
    requestedPlansRef,
    plannedProjectIdsRef,
    setProjectInfo,
    setFiles,
    setSavedFiles,
    setIsGenerating,
    setIsPlanning,
    setIsStopConfirming,
    setGenerationStage,
    persistGenerationState,
    applyWorkspaceState,
    applyWorkflowStepToMessage,
    applyOrchestrationSharedMessages,
    applyGenerationStateMessages,
    applyPlanGenerationMessages,
    applyPlanStreamPatchMessages,
    applyPlanImplementationMessages,
    applyImplementationGenerationMessages,
    applyImplementationStreamPatchMessages,
    applyIncrementalWorkflowStep,
    setMessageStreamingState,
    yieldStepRender,
    reflectFilePathInTree,
    fetchProjectDetail,
    refreshProjectFileTree,
    fetchProjectCommits,
    ensureProjectRuntimeReady,
    safeParseJSON,
    appendStatusLine,
    appendReasoningChunk,
    appendReasoningLine,
    normalizeWorkflowStep,
    getEventMessage,
    getGeneratedFilesFromEvent,
    getGuidanceFromEvent,
    getSuggestedQuestionsFromEvent,
    getSuggestedActionsFromEvent,
    enrichPlanMessageGuidance,
    supersedePlanSelectionMessages,
  });
}
