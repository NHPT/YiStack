import type { SetStateAction } from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { Plan } from '@/lib/api';
import type { GitCommit } from '@/lib/types';

import type { GenerateOptions } from './workspace-implementation-generation';
import type { PlanRequestOptions } from './workspace-plan-generation';
import type {
  WorkspacePlanGenerationProjectIdSet,
} from './workspace-plan-generation-types';
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
  MutableRefLike,
} from './workspace-orchestration-shared-types';
import type {
  NormalizeWorkflowStep,
  ResolveStepEngineeringState,
  SafeParseJSON,
} from './workspace-orchestration-shared';

export type RunWorkspaceImplementationGenerationOptions = {
  prompt: string;
  targetProject?: WorkspaceProjectInfo;
  options?: GenerateOptions;
  projectInfo: WorkspaceProjectInfo | null;
  chatMode: ChatMode;
  isOnline: boolean;
  selectedModel: string;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  generationAbortRef: MutableRefLike<AbortController | null>;
  persistGenerationState: PersistGenerationState;
  applyImplementationGenerationMessages: (value: SetStateAction<WorkspaceChatMessage[]>) => void;
  applyImplementationStreamPatchMessages: (value: SetStateAction<WorkspaceChatMessage[]>) => void;
  applyGenerationStateMessages: (value: SetStateAction<WorkspaceChatMessage[]>) => void;
  setFiles: (value: SetStateAction<Map<string, string>>) => void;
  setSavedFiles: (value: SetStateAction<Map<string, string>>) => void;
  setIsGenerating: (value: SetStateAction<boolean>) => void;
  setIsStopConfirming: (value: SetStateAction<boolean>) => void;
  setGenerationStage: (value: SetStateAction<string>) => void;
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
  safeParseJSON: SafeParseJSON;
  appendStatusLine: (current: string, nextLine: string) => string;
  appendReasoningChunk: (current: string, nextChunk: string) => string;
  normalizeWorkflowStep: NormalizeWorkflowStep;
  getEventMessage: WorkspaceEventMessageResolver;
  getGeneratedFilesFromEvent: WorkspaceGeneratedFilesEventReader;
  getGuidanceFromEvent: WorkspaceGuidanceResolver;
  resolveStepEngineeringState: ResolveStepEngineeringState;
};

export type WorkspacePlanGenerationMessagesAction = (value: SetStateAction<WorkspaceChatMessage[]>) => void;
export type WorkspacePlanGenerationAutoPlanTriggeredRef = MutableRefLike<boolean>;
export type WorkspacePlanGenerationRequestedPlansRef = MutableRefLike<WorkspacePlanGenerationProjectIdSet>;
export type WorkspacePlanGenerationRequestedProjects = WorkspacePlanGenerationProjectIdSet;

export type RunWorkspacePlanGenerationOptions = {
  options?: PlanRequestOptions;
  projectInfo: WorkspaceProjectInfo;
  selectedModel: string;
  availablePlans: Plan[];
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationRequestedProjects;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  messagesRef: MutableRefLike<WorkspaceChatMessage[]>;
  planningAbortRef: MutableRefLike<AbortController | null>;
  planningProjectIdRef: MutableRefLike<string | null>;
  autoPlanTriggeredRef: WorkspacePlanGenerationAutoPlanTriggeredRef;
  requestedPlansRef: WorkspacePlanGenerationRequestedPlansRef;
  plannedProjectIdsRef: MutableRefLike<WorkspacePlanGenerationProjectIdSet>;
  applyPlanGenerationMessages: WorkspacePlanGenerationMessagesAction;
  setIsPlanning: (value: SetStateAction<boolean>) => void;
  applyWorkspaceState: ApplyWorkspaceState;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  applyPlanStreamPatchMessages: (value: SetStateAction<WorkspaceChatMessage[]>) => void;
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
  resolveStepEngineeringState: ResolveStepEngineeringState;
};
