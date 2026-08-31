import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { Plan } from '@/lib/api';
import type { GitCommit } from '@/lib/types';

import type { GenerateOptions } from './workspace-implementation-generation';
import type { PlanRequestOptions } from './workspace-plan-generation';
import type {
  WorkspacePlanGenerationProjectIdSet,
  WorkspacePlanGenerationProjectIdSetRef,
} from './workspace-plan-generation-types';
import type {
  ChoosePlanOptions,
  UpdatePlanFlowState,
} from './workspace-orchestration-flow-types';
import type {
  ChatMode,
  PersistGenerationState,
  WorkspaceChatMessage,
  WorkspaceEventMessageResolver,
  WorkspaceGeneratedFilesEventReader,
  WorkspaceGuidanceResolver,
  WorkspaceProjectInfo,
  WorkspaceSuggestedActionsEventReader,
  WorkspaceSuggestedQuestionsEventReader,
} from './workspace-types';
import type {
  ApplyWorkspaceState,
  WorkspaceMessagePatch,
} from './workspace-orchestration-shared-types';
import type {
  NormalizeWorkflowStep,
  SafeParseJSON,
} from './workspace-orchestration-shared';

export type UseWorkspaceOrchestrationOptions = {
  projectInfo: WorkspaceProjectInfo | null;
  chatMode: ChatMode;
  isOnline: boolean;
  selectedModel: string;
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
  generationAbortRef: MutableRefObject<AbortController | null>;
  planningAbortRef: MutableRefObject<AbortController | null>;
  initializedProjectIdRef: MutableRefObject<string | null>;
  planningProjectIdRef: MutableRefObject<string | null>;
  implementingPlanRef: MutableRefObject<boolean>;
  autoPlanTriggeredRef: MutableRefObject<boolean>;
  requestedPlansRef: WorkspacePlanGenerationProjectIdSetRef;
  plannedProjectIdsRef: WorkspacePlanGenerationProjectIdSetRef;
  setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
  applyOrchestrationSharedMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyGenerationStateMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyPlanStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyPlanImplementationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyImplementationGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyImplementationStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setIsPlanning: Dispatch<SetStateAction<boolean>>;
  setIsStopConfirming: Dispatch<SetStateAction<boolean>>;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  updatePlanFlowState: UpdatePlanFlowState;
  persistGenerationState: PersistGenerationState;
  applyWorkspaceState: ApplyWorkspaceState;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  yieldStepRender: () => Promise<void>;
  reflectFilePathInTree: (filePath: string) => void;
  fetchProjectDetail: (projectId: string) => Promise<void>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<void>;
  fetchProjectCommits: (projectId: string) => Promise<GitCommit[]>;
  ensureProjectRuntimeReady: (projectId: string, options?: {
    initialStage?: string;
    waitStage?: string;
  }) => Promise<unknown>;
  safeParseJSON: SafeParseJSON;
  appendStatusLine: (current: string, nextLine: string) => string;
  appendReasoningChunk: (current: string, nextChunk: string) => string;
  appendReasoningLine: (current: string, nextLine: string) => string;
  normalizeWorkflowStep: NormalizeWorkflowStep;
  getEventMessage: WorkspaceEventMessageResolver;
  getGeneratedFilesFromEvent: WorkspaceGeneratedFilesEventReader;
  getGuidanceFromEvent: WorkspaceGuidanceResolver;
  getSuggestedQuestionsFromEvent: WorkspaceSuggestedQuestionsEventReader;
  getSuggestedActionsFromEvent: WorkspaceSuggestedActionsEventReader;
  enrichPlanMessageGuidance: (message: WorkspaceChatMessage) => WorkspaceChatMessage;
  supersedePlanSelectionMessages: (messages: WorkspaceChatMessage[]) => WorkspaceChatMessage[];
};

export type {
  ApplyWorkspaceState,
  ChoosePlanOptions,
  GenerateOptions,
  PlanRequestOptions,
  UpdatePlanFlowState,
  WorkspaceMessagePatch,
};
