import type { UseWorkspaceOrchestrationOptions } from './workspace-orchestration-hook-types';
import type {
  ImplementationActionOptions,
  PlanningActionOptions,
  SharedActions,
  SharedActionOptions,
  WorkspaceOrchestrationPlanningEngineeringActions,
} from './workspace-orchestration-action-types';

export function buildSharedActionOptions(
  options: UseWorkspaceOrchestrationOptions,
): SharedActionOptions {
  return {
    initializedProjectIdRef: options.initializedProjectIdRef,
    projectInfo: options.projectInfo,
    setProjectInfo: options.setProjectInfo,
    applyOrchestrationSharedMessages: options.applyOrchestrationSharedMessages,
  };
}

export function buildImplementationActionOptions(
  options: UseWorkspaceOrchestrationOptions,
  sharedActions: SharedActions,
): ImplementationActionOptions {
  return {
    projectInfo: options.projectInfo,
    chatMode: options.chatMode,
    isOnline: options.isOnline,
    selectedModel: options.selectedModel,
    availablePlans: options.availablePlans,
    recommendedPlanId: options.recommendedPlanId,
    selectedPlanId: options.selectedPlanId,
    files: options.files,
    savedFiles: options.savedFiles,
    messagesRef: options.messagesRef,
    generationAbortRef: options.generationAbortRef,
    implementingPlanRef: options.implementingPlanRef,
    autoPlanTriggeredRef: options.autoPlanTriggeredRef,
    setProjectInfo: options.setProjectInfo,
    applyImplementationGenerationMessages: options.applyImplementationGenerationMessages,
    applyImplementationStreamPatchMessages: options.applyImplementationStreamPatchMessages,
    applyPlanImplementationMessages: options.applyPlanImplementationMessages,
    applyGenerationStateMessages: options.applyGenerationStateMessages,
    setFiles: options.setFiles,
    setSavedFiles: options.setSavedFiles,
    setIsGenerating: options.setIsGenerating,
    setIsStopConfirming: options.setIsStopConfirming,
    setGenerationStage: options.setGenerationStage,
    updatePlanFlowState: options.updatePlanFlowState,
    persistGenerationState: options.persistGenerationState,
    applyWorkspaceState: options.applyWorkspaceState,
    applyWorkflowStepToMessage: options.applyWorkflowStepToMessage,
    applyIncrementalWorkflowStep: options.applyIncrementalWorkflowStep,
    setMessageStreamingState: options.setMessageStreamingState,
    yieldStepRender: options.yieldStepRender,
    reflectFilePathInTree: options.reflectFilePathInTree,
    fetchProjectDetail: options.fetchProjectDetail,
    refreshProjectFileTree: options.refreshProjectFileTree,
    fetchProjectCommits: options.fetchProjectCommits,
    ensureProjectRuntimeReady: options.ensureProjectRuntimeReady,
    safeParseJSON: options.safeParseJSON,
    appendStatusLine: options.appendStatusLine,
    appendReasoningChunk: options.appendReasoningChunk,
    normalizeWorkflowStep: options.normalizeWorkflowStep,
    getEventMessage: options.getEventMessage,
    getGeneratedFilesFromEvent: options.getGeneratedFilesFromEvent,
    getGuidanceFromEvent: options.getGuidanceFromEvent,
    createPersistedProject: sharedActions.createPersistedProject,
    persistWorkspaceProject: sharedActions.persistWorkspaceProject,
    resolveStepEngineeringState: sharedActions.resolveStepEngineeringState,
  };
}

export function buildPlanningActionOptions(
  options: UseWorkspaceOrchestrationOptions,
  sharedActions: WorkspaceOrchestrationPlanningEngineeringActions,
): PlanningActionOptions {
  return {
    projectInfo: options.projectInfo,
    selectedModel: options.selectedModel,
    availablePlans: options.availablePlans,
    recommendedPlanId: options.recommendedPlanId,
    requestedPlanProjectsAcrossMounts: options.requestedPlanProjectsAcrossMounts,
    plannedProjectIdsAcrossMounts: options.plannedProjectIdsAcrossMounts,
    messagesRef: options.messagesRef,
    planningAbortRef: options.planningAbortRef,
    planningProjectIdRef: options.planningProjectIdRef,
    autoPlanTriggeredRef: options.autoPlanTriggeredRef,
    requestedPlansRef: options.requestedPlansRef,
    plannedProjectIdsRef: options.plannedProjectIdsRef,
    applyPlanGenerationMessages: options.applyPlanGenerationMessages,
    setIsPlanning: options.setIsPlanning,
    applyWorkspaceState: options.applyWorkspaceState,
    applyWorkflowStepToMessage: options.applyWorkflowStepToMessage,
    applyPlanStreamPatchMessages: options.applyPlanStreamPatchMessages,
    setMessageStreamingState: options.setMessageStreamingState,
    safeParseJSON: options.safeParseJSON,
    appendReasoningChunk: options.appendReasoningChunk,
    appendReasoningLine: options.appendReasoningLine,
    normalizeWorkflowStep: options.normalizeWorkflowStep,
    getEventMessage: options.getEventMessage,
    getSuggestedQuestionsFromEvent: options.getSuggestedQuestionsFromEvent,
    getSuggestedActionsFromEvent: options.getSuggestedActionsFromEvent,
    enrichPlanMessageGuidance: options.enrichPlanMessageGuidance,
    supersedePlanSelectionMessages: options.supersedePlanSelectionMessages,
    resolveStepEngineeringState: sharedActions.resolveStepEngineeringState,
  };
}
