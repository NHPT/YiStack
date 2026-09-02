import type { Plan } from '@/lib/api';

import { runSSEEventStream } from './workspace-orchestration-shared';
import {
  createPlanMessagePatcher,
  handlePlanChunkEvent,
  handlePlanDoneEvent,
  handlePlanErrorEvent,
  handlePlanEvent,
  handlePlanProgressEvent,
  handlePlanStepEvent,
  handlePlanVisualContextEvent,
} from './workspace-plan-generation-stream-events';
import type {
  PlanGenerationStreamResult,
  PlanStreamContext,
} from './workspace-plan-generation-stream-types';
import type { GuidanceAction, WorkspaceSuggestedQuestionList } from './workspace-types';

export type {
  PlanGenerationStreamResult,
  PlanStreamContext,
} from './workspace-plan-generation-stream-types';

export async function consumePlanGenerationStream(
  response: Response,
  state: {
    initialStatusMessage: string;
    planMessageId: string;
  },
  context: PlanStreamContext,
): Promise<PlanGenerationStreamResult> {
  let analysisContent = '';
  let generatedPlans: Plan[] = [];
  let planSuggestedQuestions: WorkspaceSuggestedQuestionList = [];
  let planSuggestedActions: GuidanceAction[] = [];
  let lastStatusMessage = state.initialStatusMessage;

  const patchPlanMessage = createPlanMessagePatcher(context, state.planMessageId);

  await runSSEEventStream({
    response,
    safeParseJSON: context.safeParseJSON,
    unreadableMessage: '无法读取方案响应流',
    unreadableSource: 'plan_generation_stream_reader',
    handlers: {
      start: (data) => {
        const result = handlePlanProgressEvent(data, {
          appendReasoningLine: context.appendReasoningLine,
          patchPlanMessage,
        }, analysisContent, lastStatusMessage);
        lastStatusMessage = result.nextLastStatusMessage;
      },
      progress: (data) => {
        const result = handlePlanProgressEvent(data, {
          appendReasoningLine: context.appendReasoningLine,
          patchPlanMessage,
        }, analysisContent, lastStatusMessage);
        lastStatusMessage = result.nextLastStatusMessage;
      },
      visual_context: (data) => {
        handlePlanVisualContextEvent(data, { patchPlanMessage });
      },
      step: (data) => {
        const result = handlePlanStepEvent(data, {
          appendReasoningLine: context.appendReasoningLine,
          applyWorkflowStepToMessage: context.applyWorkflowStepToMessage,
          normalizeWorkflowStep: context.normalizeWorkflowStep,
          patchPlanMessage,
          planMessageId: state.planMessageId,
          resolveStepEngineeringState: context.resolveStepEngineeringState,
        }, analysisContent, lastStatusMessage);
        lastStatusMessage = result.nextLastStatusMessage;
      },
      chunk: (data) => {
        const result = handlePlanChunkEvent(data, {
          appendReasoningChunk: context.appendReasoningChunk,
          patchPlanMessage,
        }, analysisContent);
        analysisContent = result.nextAnalysisContent;
      },
      plan: (data) => {
        const result = handlePlanEvent(data, {
          applyPlanGenerationMessages: context.applyPlanGenerationMessages,
          enrichPlanMessageGuidance: context.enrichPlanMessageGuidance,
        }, {
          generatedPlans,
          analysisContent,
          lastStatusMessage,
          planMessageId: state.planMessageId,
        });
        generatedPlans = result.nextGeneratedPlans;
      },
      done: (data) => {
        const result = handlePlanDoneEvent(data, {
          getSuggestedActionsFromEvent: context.getSuggestedActionsFromEvent,
          getSuggestedQuestionsFromEvent: context.getSuggestedQuestionsFromEvent,
          patchPlanMessage,
          planMessageId: state.planMessageId,
          setMessageStreamingState: context.setMessageStreamingState,
        }, analysisContent, generatedPlans);
        analysisContent = result.nextAnalysisContent;
        generatedPlans = result.nextGeneratedPlans;
        planSuggestedQuestions = result.planSuggestedQuestions;
        planSuggestedActions = result.planSuggestedActions;
      },
      error: (data) => {
        handlePlanErrorEvent(data, {
          appendReasoningLine: context.appendReasoningLine,
          getEventMessage: context.getEventMessage,
          patchPlanMessage,
          resolveStepEngineeringState: context.resolveStepEngineeringState,
        });
      },
    },
  });

  return {
    analysisContent,
    generatedPlans,
    planSuggestedQuestions,
    planSuggestedActions,
  };
}
