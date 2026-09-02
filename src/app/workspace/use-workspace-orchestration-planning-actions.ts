import { useCallback } from 'react';

import { runWorkspacePlanGeneration } from './workspace-orchestration-execution';
import { buildPlanDiscussionPrompt as buildPlanDiscussionPromptText } from './workspace-orchestration-support';
import type {
  PlanningActionOptions,
  WorkspaceOrchestrationPlanningActionsContract,
} from './workspace-orchestration-action-types';
import type {
  PlanRequestOptions,
} from './workspace-orchestration-hook-types';
import type { WorkspaceProjectInfo } from './workspace-types';

function hasWorkspaceOrchestrationPlanningProjectInfo(
  projectInfo: WorkspaceProjectInfo | null,
): projectInfo is WorkspaceProjectInfo {
  return projectInfo !== null;
}

export function useWorkspaceOrchestrationPlanningActions({
  projectInfo,
  selectedModel,
  availablePlans,
  recommendedPlanId,
  requestedPlanProjectsAcrossMounts,
  plannedProjectIdsAcrossMounts,
  messagesRef,
  planningAbortRef,
  planningProjectIdRef,
  autoPlanTriggeredRef,
  requestedPlansRef,
  plannedProjectIdsRef,
  applyPlanGenerationMessages,
  setIsPlanning,
  applyWorkspaceState,
  applyWorkflowStepToMessage,
  applyPlanStreamPatchMessages,
  setMessageStreamingState,
  safeParseJSON,
  appendReasoningChunk,
  appendReasoningLine,
  normalizeWorkflowStep,
  getEventMessage,
  getSuggestedQuestionsFromEvent,
  getSuggestedActionsFromEvent,
  enrichPlanMessageGuidance,
  supersedePlanSelectionMessages,
  resolveStepEngineeringState,
}: PlanningActionOptions): WorkspaceOrchestrationPlanningActionsContract {
  const buildPlanDiscussionPrompt = useCallback(
    (question: string) => buildPlanDiscussionPromptText(question, {
      availablePlans,
      recommendedPlanId,
      projectInfo,
    }),
    [availablePlans, recommendedPlanId, projectInfo],
  );

  const requestPlansForProject = useCallback(async (options?: PlanRequestOptions) => {
    const hasProjectInfo = hasWorkspaceOrchestrationPlanningProjectInfo(projectInfo);
    if (hasProjectInfo === false) {
      options?.onTerminal?.(false);
      return;
    }
    await runWorkspacePlanGeneration({
      options,
      projectInfo,
      selectedModel,
      availablePlans,
      requestedPlanProjectsAcrossMounts,
      plannedProjectIdsAcrossMounts,
      messagesRef,
      planningAbortRef,
      planningProjectIdRef,
      autoPlanTriggeredRef,
      requestedPlansRef,
      plannedProjectIdsRef,
      applyPlanGenerationMessages,
      setIsPlanning,
      applyWorkspaceState,
      applyWorkflowStepToMessage,
      applyPlanStreamPatchMessages,
      setMessageStreamingState,
      safeParseJSON,
      appendReasoningChunk,
      appendReasoningLine,
      normalizeWorkflowStep,
      getEventMessage,
      getSuggestedQuestionsFromEvent,
      getSuggestedActionsFromEvent,
      enrichPlanMessageGuidance,
      supersedePlanSelectionMessages,
      resolveStepEngineeringState,
    });
  }, [
    appendReasoningChunk,
    appendReasoningLine,
    applyWorkspaceState,
    applyWorkflowStepToMessage,
    applyPlanStreamPatchMessages,
    autoPlanTriggeredRef,
    availablePlans,
    enrichPlanMessageGuidance,
    getEventMessage,
    getSuggestedActionsFromEvent,
    getSuggestedQuestionsFromEvent,
    messagesRef,
    normalizeWorkflowStep,
    plannedProjectIdsAcrossMounts,
    plannedProjectIdsRef,
    planningAbortRef,
    planningProjectIdRef,
    projectInfo,
    selectedModel,
    requestedPlanProjectsAcrossMounts,
    requestedPlansRef,
    applyPlanGenerationMessages,
    resolveStepEngineeringState,
    safeParseJSON,
    setIsPlanning,
    setMessageStreamingState,
    supersedePlanSelectionMessages,
  ]);

  return {
    buildPlanDiscussionPrompt,
    requestPlansForProject,
  };
}
