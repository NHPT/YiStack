import type { Dispatch, SetStateAction } from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { GitCommit } from '@/lib/types';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
} from '@/lib/workspace/engineering-state';
import type {
  WorkspaceStreamErrorCode,
  WorkspaceStreamErrorDetails,
  WorkspaceStreamErrorGate,
  WorkspaceStreamErrorMessage,
  WorkspaceStreamErrorSource,
  WorkspaceStreamExecutionResult,
} from '@/lib/workspace/workspace-stream-boundary-errors';

import type {
  NormalizeWorkflowStep,
  ResolveStepEngineeringState,
  SafeParseJSON,
} from './workspace-orchestration-shared';
import type {
  WorkspaceGenerationMode,
  WorkspaceChatMessage,
  WorkspaceEventMessageResolver,
  WorkspaceGeneratedFilesEventReader,
  WorkspaceGuidanceResolver,
  WorkspaceProjectInfo,
} from './workspace-types';

export type WorkspaceMessagePatch =
  | Partial<WorkspaceChatMessage>
  | ((message: WorkspaceChatMessage) => Partial<WorkspaceChatMessage> | null | undefined);

export type GenerationStreamError = {
  message: WorkspaceStreamErrorMessage;
  code?: WorkspaceStreamErrorCode;
  source?: WorkspaceStreamErrorSource;
  details?: WorkspaceStreamErrorDetails;
  gate?: WorkspaceStreamErrorGate;
  blocking?: boolean;
  gateResult?: WorkspaceGateResult;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  executionResult?: WorkspaceStreamExecutionResult;
};

export type ImplementationStreamExecutionState = {
  fullContent: string;
  reasoningContent: string;
  statusContent: string;
};

export type ImplementationStreamStatusState = {
  statusContent: string;
};

export type ImplementationStreamFailureState = {
  reasoningContent: string;
  statusContent: string;
};

export type ImplementationStreamContext = {
  assistantMessageId: string;
  appendReasoningChunk: (current: string, nextChunk: string) => string;
  appendStatusLine: (current: string, nextLine: string) => string;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  effectiveMode: WorkspaceGenerationMode;
  effectiveProject: WorkspaceProjectInfo | null;
  fetchProjectCommits: (projectId: string) => Promise<GitCommit[]>;
  fetchProjectDetail: (projectId: string) => Promise<void>;
  files: Map<string, string>;
  getEventMessage: WorkspaceEventMessageResolver;
  getGeneratedFilesFromEvent: WorkspaceGeneratedFilesEventReader;
  getGuidanceFromEvent: WorkspaceGuidanceResolver;
  normalizeWorkflowStep: NormalizeWorkflowStep;
  patchImplementationStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<void>;
  reflectFilePathInTree: (filePath: string) => void;
  resolveStepEngineeringState: ResolveStepEngineeringState;
  safeParseJSON: SafeParseJSON;
  savedFiles: Map<string, string>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
  updateStreamingStepState: (
    engineeringState?: WorkspaceEngineeringStateSnapshot,
    patch?: Partial<WorkspaceChatMessage>,
  ) => WorkspaceEngineeringStateSnapshot | undefined;
  yieldStepRender: () => Promise<void>;
};

export type ImplementationStepEffectsContext = {
  assistantMessageId: string;
  appendStatusLine: (current: string, nextLine: string) => string;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  updateStreamingStepState: (
    engineeringState?: WorkspaceEngineeringStateSnapshot,
    patch?: Partial<WorkspaceChatMessage>,
  ) => WorkspaceEngineeringStateSnapshot | undefined;
  yieldStepRender: () => Promise<void>;
};

export type ImplementationStepEventContext = ImplementationStepEffectsContext & {
  normalizeWorkflowStep: NormalizeWorkflowStep;
  resolveStepEngineeringState: ResolveStepEngineeringState;
};

export type ImplementationProgressEventContext = {
  appendStatusLine: (current: string, nextLine: string) => string;
  getEventMessage: WorkspaceEventMessageResolver;
  updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
};

export type ImplementationStreamErrorContext = {
  appendStatusLine: (current: string, nextLine: string) => string;
  updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
};

export type ImplementationStartEventContext = {
  assistantMessageId: string;
  appendStatusLine: (current: string, nextLine: string) => string;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
};

export type ImplementationChunkEventContext = {
  appendReasoningChunk: (current: string, nextChunk: string) => string;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
};

export type ImplementationGuidanceEventContext = {
  assistantMessageId: string;
  getGuidanceFromEvent: WorkspaceGuidanceResolver;
  patchImplementationStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
};

export type ImplementationGeneratedFilesApplyContext = {
  files: Map<string, string>;
  reflectFilePathInTree: (filePath: string) => void;
  savedFiles: Map<string, string>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
};

export type ImplementationRelatedCommitContext = {
  effectiveMode: WorkspaceGenerationMode;
  effectiveProject: WorkspaceProjectInfo | null;
  fetchProjectCommits: (projectId: string) => Promise<GitCommit[]>;
  fetchProjectDetail: (projectId: string) => Promise<void>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<void>;
};

export type ImplementationDoneEffectsContext = {
  getGeneratedFilesFromEvent: WorkspaceGeneratedFilesEventReader;
  getGuidanceFromEvent: WorkspaceGuidanceResolver;
};

export type ImplementationDoneFinalizationContext =
  ImplementationGeneratedFilesApplyContext
  & ImplementationRelatedCommitContext
  & ImplementationDoneEffectsContext
  & {
    assistantMessageId: string;
    patchImplementationStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
    setGenerationStage: Dispatch<SetStateAction<string>>;
    setMessageStreamingState: (messageId: string, streaming: boolean) => void;
    updateStreamingMessage: (patch: Partial<WorkspaceChatMessage>) => void;
  };

export type ImplementationStreamFailureContext = {
  assistantMessageId: string;
  patchImplementationStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
};

export type ImplementationStreamContextInput = {
  appendReasoningChunk: (current: string, nextChunk: string) => string;
  appendStatusLine: (current: string, nextLine: string) => string;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  fetchProjectCommits: (projectId: string) => Promise<GitCommit[]>;
  fetchProjectDetail: (projectId: string) => Promise<void>;
  files: Map<string, string>;
  getEventMessage: WorkspaceEventMessageResolver;
  getGeneratedFilesFromEvent: WorkspaceGeneratedFilesEventReader;
  getGuidanceFromEvent: WorkspaceGuidanceResolver;
  normalizeWorkflowStep: NormalizeWorkflowStep;
  patchImplementationStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<void>;
  reflectFilePathInTree: (filePath: string) => void;
  resolveStepEngineeringState: ResolveStepEngineeringState;
  safeParseJSON: SafeParseJSON;
  savedFiles: Map<string, string>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  yieldStepRender: () => Promise<void>;
};
