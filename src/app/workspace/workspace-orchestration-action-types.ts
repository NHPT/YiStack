import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { Plan } from '@/lib/api';

import type {
  WorkspaceChatMessage,
  WorkspaceEventMessageResolver,
  WorkspaceProjectInfo,
  WorkspaceSuggestedActionsEventReader,
  WorkspaceSuggestedQuestionsEventReader,
} from './workspace-types';
import type {
  WorkspaceImplementationGenerationActionContract,
  WorkspacePlanImplementationActionContract,
} from './workspace-orchestration-actions-contract';
import type {
  NormalizeWorkflowStep,
  ResolveStepEngineeringState,
  SafeParseJSON,
} from './workspace-orchestration-shared';
import type {
  PlanRequestOptions,
} from './workspace-orchestration-hook-types';
import type {
  WorkspacePlanGenerationProjectIdSet,
  WorkspacePlanGenerationProjectIdSetRef,
} from './workspace-plan-generation-types';
import type { ApplyWorkspaceState } from './workspace-orchestration-shared-types';
import type {
  ImplementationGenerationActionOptions,
  PlanImplementationBaseActionOptions,
} from './workspace-orchestration-implementation-action-types';

export type SharedActionOptions = {
  initializedProjectIdRef: MutableRefObject<string | null>;
  projectInfo: WorkspaceProjectInfo | null;
  setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
  applyOrchestrationSharedMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
};

export type SharedActions = {
  createPersistedProject: (plan: Plan) => Promise<WorkspaceProjectInfo>;
  persistWorkspaceProject: (nextProject: WorkspaceProjectInfo) => void;
  resolveStepEngineeringState: ResolveStepEngineeringState;
};

export type WorkspaceOrchestrationSharedActionsContract =
  SharedActions;

export type WorkspaceOrchestrationPlanningEngineeringActions = {
  resolveStepEngineeringState: ResolveStepEngineeringState;
};

export type ImplementationActionOptions = ImplementationGenerationActionOptions &
  PlanImplementationBaseActionOptions &
  SharedActions;

export type ImplementationActions = {
  choosePlanAndImplement: WorkspacePlanImplementationActionContract;
  handleLLMGenerate: WorkspaceImplementationGenerationActionContract;
};

export type WorkspaceOrchestrationImplementationActionsContract =
  ImplementationActions;

export type PlanningActionOptions =
  WorkspaceOrchestrationPlanningEngineeringActions
  & {
    projectInfo: WorkspaceProjectInfo | null;
    selectedModel: string;
    availablePlans: Plan[];
    recommendedPlanId: string | null;
    requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
    plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
    messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
    planningAbortRef: MutableRefObject<AbortController | null>;
    planningProjectIdRef: MutableRefObject<string | null>;
    autoPlanTriggeredRef: MutableRefObject<boolean>;
    requestedPlansRef: WorkspacePlanGenerationProjectIdSetRef;
    plannedProjectIdsRef: WorkspacePlanGenerationProjectIdSetRef;
    applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
    setIsPlanning: Dispatch<SetStateAction<boolean>>;
    applyWorkspaceState: ApplyWorkspaceState;
    applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
    applyPlanStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
    setMessageStreamingState: (messageId: string, streaming: boolean) => void;
    safeParseJSON: SafeParseJSON;
    appendReasoningChunk: (current: string, nextChunk: string) => string;
    appendReasoningLine: (current: string, nextLine: string) => string;
    normalizeWorkflowStep: NormalizeWorkflowStep;
    getEventMessage: WorkspaceEventMessageResolver;
    getSuggestedQuestionsFromEvent: WorkspaceSuggestedQuestionsEventReader;
    getSuggestedActionsFromEvent: WorkspaceSuggestedActionsEventReader;
    enrichPlanMessageGuidance: (message: WorkspaceChatMessage) => WorkspaceChatMessage;
    supersedePlanSelectionMessages: (messages: WorkspaceChatMessage[]) => WorkspaceChatMessage[];
  };

export type PlanningActions = {
  buildPlanDiscussionPrompt: (question: string) => string;
  requestPlansForProject: (options?: PlanRequestOptions) => Promise<void>;
};

export type WorkspaceOrchestrationPlanningActionsContract =
  PlanningActions;
