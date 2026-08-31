import type { Dispatch, SetStateAction } from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { Plan } from '@/lib/api';

import type {
  NormalizeWorkflowStep,
  ResolveStepEngineeringState,
  SafeParseJSON,
} from './workspace-orchestration-shared';
import type {
  GuidanceAction,
  WorkspaceChatMessage,
  WorkspaceEventMessageResolver,
  WorkspaceSuggestedActionsEventReader,
  WorkspaceSuggestedQuestionsEventReader,
  WorkspaceSuggestedQuestionList,
} from './workspace-types';

export type WorkspaceMessagePatch =
  | Partial<WorkspaceChatMessage>
  | ((message: WorkspaceChatMessage) => Partial<WorkspaceChatMessage> | null | undefined);

export type PlanGenerationStreamResult = {
  analysisContent: string;
  generatedPlans: Plan[];
  planSuggestedQuestions: WorkspaceSuggestedQuestionList;
  planSuggestedActions: GuidanceAction[];
};

export type PlanStreamContext = {
  appendReasoningChunk: (current: string, nextChunk: string) => string;
  appendReasoningLine: (current: string, nextLine: string) => string;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
  enrichPlanMessageGuidance: (message: WorkspaceChatMessage) => WorkspaceChatMessage;
  getEventMessage: WorkspaceEventMessageResolver;
  getSuggestedActionsFromEvent: WorkspaceSuggestedActionsEventReader;
  getSuggestedQuestionsFromEvent: WorkspaceSuggestedQuestionsEventReader;
  normalizeWorkflowStep: NormalizeWorkflowStep;
  patchPlanStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
  resolveStepEngineeringState: ResolveStepEngineeringState;
  safeParseJSON: SafeParseJSON;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
  applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
};

export type PlanMessagePatchWriter = (patch: WorkspaceMessagePatch) => void;

export type PlanMessagePatcherContext = {
  patchPlanStreamMessage: (messageId: string, patch: WorkspaceMessagePatch) => void;
};

export type PlanMessagePatchContext = {
  patchPlanMessage: PlanMessagePatchWriter;
};

export type PlanMessageIdentityContext = {
  planMessageId: string;
};

export type PlanProgressEventContext = PlanMessagePatchContext & {
  appendReasoningLine: (current: string, nextLine: string) => string;
};

export type PlanStepEffectsContext = PlanMessagePatchContext & PlanMessageIdentityContext & {
  appendReasoningLine: (current: string, nextLine: string) => string;
  applyWorkflowStepToMessage: (messageId: string, step: WorkflowStep) => void;
};

export type PlanStepEventContext = PlanStepEffectsContext & {
  normalizeWorkflowStep: NormalizeWorkflowStep;
  resolveStepEngineeringState: ResolveStepEngineeringState;
};

export type PlanChunkEventContext = PlanMessagePatchContext & {
  appendReasoningChunk: (current: string, nextChunk: string) => string;
};

export type PlanEventContext = {
  applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  enrichPlanMessageGuidance: (message: WorkspaceChatMessage) => WorkspaceChatMessage;
};

export type PlanDoneEventContext = PlanMessagePatchContext & PlanMessageIdentityContext & {
  getSuggestedActionsFromEvent: WorkspaceSuggestedActionsEventReader;
  getSuggestedQuestionsFromEvent: WorkspaceSuggestedQuestionsEventReader;
  setMessageStreamingState: (messageId: string, streaming: boolean) => void;
};

export type PlanErrorEventContext = PlanMessagePatchContext & {
  appendReasoningLine: (current: string, nextLine: string) => string;
  getEventMessage: WorkspaceEventMessageResolver;
  resolveStepEngineeringState: ResolveStepEngineeringState;
};
