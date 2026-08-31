import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { Plan } from '@/lib/api';
import type { GitCommit } from '@/lib/types';
import type { WorkflowStep } from '@/components/workspace/chat-message-content';

import type {
  ChatMode,
  PersistGenerationState,
  WorkspaceChatMessage,
  WorkspaceEventMessageResolver,
  WorkspaceGeneratedFilesEventReader,
  WorkspaceGuidanceResolver,
  WorkspaceProjectInfo,
} from './workspace-types';
import type { UpdatePlanFlowState } from './workspace-orchestration-flow-types';
import type {
  NormalizeWorkflowStep,
  ResolveStepEngineeringState,
  SafeParseJSON,
} from './workspace-orchestration-shared';
import type { ApplyWorkspaceState } from './workspace-orchestration-shared-types';
import type {
  WorkspaceImplementationGenerationActionContract as CoreWorkspaceImplementationGenerationActionContract,
  WorkspacePlanImplementationActionContract as CoreWorkspacePlanImplementationActionContract,
} from './workspace-orchestration-actions-contract';

export type ImplementationGenerationAction =
  CoreWorkspaceImplementationGenerationActionContract;

export type WorkspaceImplementationGenerationActionContract =
  CoreWorkspaceImplementationGenerationActionContract;

export type ImplementationGenerationActionOptions = {
  projectInfo: WorkspaceProjectInfo | null;
  chatMode: ChatMode;
  isOnline: boolean;
  selectedModel: string;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  generationAbortRef: MutableRefObject<AbortController | null>;
  applyImplementationGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyImplementationStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyGenerationStateMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setIsStopConfirming: Dispatch<SetStateAction<boolean>>;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  persistGenerationState: PersistGenerationState;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  yieldStepRender: () => Promise<void>;
  reflectFilePathInTree: (filePath: string) => void;
  fetchProjectDetail: (projectId: string) => Promise<void>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: {
      throwOnFailure?: boolean;
      suppressNotice?: boolean;
    },
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

export type PlanImplementationAction =
  CoreWorkspacePlanImplementationActionContract;

export type WorkspacePlanImplementationActionContract =
  CoreWorkspacePlanImplementationActionContract;

export type PlanImplementationBaseActionOptions = {
  projectInfo: WorkspaceProjectInfo | null;
  isOnline: boolean;
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  messagesRef: MutableRefObject<WorkspaceChatMessage[]>;
  implementingPlanRef: MutableRefObject<boolean>;
  autoPlanTriggeredRef: MutableRefObject<boolean>;
  setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
  applyPlanImplementationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  applyWorkspaceState: ApplyWorkspaceState;
  ensureProjectRuntimeReady: (
    projectId: string,
    options?: {
      initialStage?: string;
      waitStage?: string;
    },
  ) => Promise<unknown>;
  createPersistedProject: (plan: Plan) => Promise<WorkspaceProjectInfo>;
  persistWorkspaceProject: (nextProject: WorkspaceProjectInfo) => void;
  updatePlanFlowState: UpdatePlanFlowState;
};

export type PlanImplementationActionOptions = PlanImplementationBaseActionOptions & {
  handleLLMGenerate: WorkspaceImplementationGenerationActionContract;
};
