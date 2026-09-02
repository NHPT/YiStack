import { isVisualContext } from '@/lib/visual-context';
import {
  normalizeWorkspaceEngineeringState,
  normalizeWorkspaceGateResult,
} from '@/lib/workspace/engineering-state';
import {
  buildImplementationStreamPayloadError,
  readWorkspaceStreamErrorDetails,
  readWorkspaceStreamExecutionResult,
  readWorkspaceStreamErrorField,
  readWorkspaceStreamErrorMessage,
  readWorkspaceStreamErrorSource,
} from '@/lib/workspace/workspace-stream-boundary-errors';

import type {
  GenerationStreamError,
  ImplementationChunkEventContext,
  ImplementationGuidanceEventContext,
  ImplementationProgressEventContext,
  ImplementationStartEventContext,
  ImplementationStepEventContext,
  ImplementationStreamErrorContext,
} from './workspace-implementation-stream-types';
import { applyImplementationStepEffects } from './workspace-implementation-step-effects';
import { resolveWorkflowStepEvent } from './workspace-orchestration-shared';
import type {
  ResolvedWorkflowStepEvent,
  WorkspaceStreamEventData,
} from './workspace-orchestration-shared';

function hasImplementationStepEvent(
  stepEvent: ResolvedWorkflowStepEvent | null,
): stepEvent is ResolvedWorkflowStepEvent {
  return stepEvent !== null;
}

function hasImplementationProgressMessage(progressMessage: string): boolean {
  const hasProgressMessage = progressMessage.length > 0;
  return hasProgressMessage === true;
}

function hasImplementationStartMessage(startMessage: string): boolean {
  const hasStartMessage = startMessage.length > 0;
  return hasStartMessage === true;
}

export function getGenerationStreamError(data: WorkspaceStreamEventData): GenerationStreamError {
  const message = readWorkspaceStreamErrorMessage(data, '生成失败');
  return {
    message,
    code: readWorkspaceStreamErrorField(data, 'code'),
    source: readWorkspaceStreamErrorSource(data, 'implementation_generation_stream'),
    details: readWorkspaceStreamErrorDetails(data, message),
    gate: readWorkspaceStreamErrorField(data, 'gate'),
    blocking: data.blocking === true,
    gateResult: normalizeWorkspaceGateResult(data.gate_result),
    engineeringState: normalizeWorkspaceEngineeringState(data.engineeringState),
    executionResult: readWorkspaceStreamExecutionResult(data.execution_result),
  };
}

export async function handleImplementationStepEvent(
  data: WorkspaceStreamEventData,
  context: ImplementationStepEventContext,
  statusContent: string,
) {
  const stepEvent = resolveWorkflowStepEvent(
    data,
    context.normalizeWorkflowStep,
    context.resolveStepEngineeringState,
  );
  if (hasImplementationStepEvent(stepEvent) === false) {
    return { handled: false, nextStatusContent: statusContent };
  }

  const { nextStatusContent } = await applyImplementationStepEffects(
    stepEvent,
    context,
    statusContent,
  );

  return { handled: true, nextStatusContent };
}

export function handleImplementationVisualContextEvent(
  data: WorkspaceStreamEventData,
  context: Pick<ImplementationProgressEventContext, 'updateStreamingMessage'>,
) {
  const visualContext = data.visual_context;
  if (isVisualContext(visualContext) === false) {
    return { handled: false };
  }
  context.updateStreamingMessage({ visualContext });
  return { handled: true };
}

export function handleImplementationProgressEvent(
  data: WorkspaceStreamEventData,
  context: ImplementationProgressEventContext,
  statusContent: string,
) {
  const progressMessage = context.getEventMessage(data, '');
  const hasProgressMessage = hasImplementationProgressMessage(progressMessage);
  if (hasProgressMessage === false) {
    return { handled: false, nextStatusContent: statusContent };
  }

  const nextStatusContent = context.appendStatusLine(statusContent, progressMessage);
  context.updateStreamingMessage({ statusContent: nextStatusContent });
  return { handled: true, nextStatusContent };
}

export function buildImplementationStreamError(
  data: WorkspaceStreamEventData,
  context: ImplementationStreamErrorContext,
  statusContent: string,
) {
  context.updateStreamingMessage({ activeFileOperation: undefined });
  const streamError = getGenerationStreamError(data);
  let nextStatusContent = statusContent;

  if (streamError.code === 'validation_gate_blocked' && streamError.blocking) {
    const gateLabel = streamError.gate ? `（${streamError.gate}）` : '';
    const statusLine = `YES 校验未通过${gateLabel}，当前阶段已阻断。`;
    nextStatusContent = context.appendStatusLine(statusContent, statusLine);
    context.updateStreamingMessage({
      statusContent: nextStatusContent,
      engineeringState: streamError.engineeringState,
    });
  } else if (streamError.code === 'foundation_gate_blocked') {
    const statusLine = '项目基础设定尚未完成，已暂停进入实现。';
    nextStatusContent = context.appendStatusLine(statusContent, statusLine);
    context.updateStreamingMessage({
      statusContent: nextStatusContent,
      engineeringState: streamError.engineeringState,
      gateResult: streamError.gateResult,
    });
  } else if (streamError.code === 'context_gate_blocked') {
    const statusLine = '检测到当前项目上下文冲突，已阻断继续生成。';
    nextStatusContent = context.appendStatusLine(statusContent, statusLine);
    context.updateStreamingMessage({
      statusContent: nextStatusContent,
      engineeringState: streamError.engineeringState,
    });
  } else if (streamError.code === 'capability_execution_blocked') {
    const statusLine = '能力执行被阻断，当前阶段已暂停。';
    nextStatusContent = context.appendStatusLine(statusContent, statusLine);
    context.updateStreamingMessage({
      statusContent: nextStatusContent,
      engineeringState: streamError.engineeringState,
    });
  }

  return {
    error: buildImplementationStreamPayloadError(streamError),
    nextStatusContent,
  };
}

export function handleImplementationStartEvent(
  data: WorkspaceStreamEventData,
  context: ImplementationStartEventContext,
  statusContent: string,
) {
  const startMessage = typeof data.message === 'string' ? data.message : '';
  let nextStatusContent = statusContent;

  context.setMessageStreamingState(context.assistantMessageId, true);
  context.setGenerationStage(
    data.mode === 'discuss'
      ? `正在使用 ${data.model} 进行技术探讨...`
      : data.mode === 'foundation'
        ? `正在使用 ${data.model} 准备项目基础设定...`
        : `正在使用 ${data.model} 生成代码...`,
  );
  const hasStartMessage = hasImplementationStartMessage(startMessage);
  if (hasStartMessage === true) {
    nextStatusContent = context.appendStatusLine(statusContent, startMessage);
    context.updateStreamingMessage({ statusContent: nextStatusContent });
  }

  return { nextStatusContent };
}

export function handleImplementationChunkEvent(
  data: WorkspaceStreamEventData,
  context: ImplementationChunkEventContext,
  fullContent: string,
  reasoningContent: string,
) {
  let nextFullContent = fullContent;
  let nextReasoningContent = reasoningContent;

  nextFullContent += typeof data.content === 'string' ? data.content : '';
  if (typeof data.reasoningContent === 'string' && data.reasoningContent) {
    nextReasoningContent = context.appendReasoningChunk(reasoningContent, data.reasoningContent);
    context.updateStreamingMessage({ reasoningContent: nextReasoningContent, statusContent: undefined });
  }

  context.setGenerationStage(
    data.mode === 'discuss'
      ? '正在进行技术探讨...'
      : data.mode === 'foundation'
        ? '正在准备项目基础设定...'
        : '正在生成代码...',
  );
  return { nextFullContent, nextReasoningContent };
}

export function handleImplementationGuidanceEvent(
  data: WorkspaceStreamEventData,
  context: ImplementationGuidanceEventContext,
) {
  const guidancePatch = context.getGuidanceFromEvent(data, [], []);
  context.patchImplementationStreamMessage(context.assistantMessageId, guidancePatch);
}
