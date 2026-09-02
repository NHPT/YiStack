import { chatApi, projectApi } from '@/lib/api';

import {
  buildImplementationGeneratePayload,
  buildImplementationStreamContext,
  cleanupImplementationGeneration,
  consumeImplementationStream,
  createImplementationStreamingUpdaters,
  handleImplementationStreamFailure,
  initializeImplementationGeneration,
  prepareImplementationGenerationRequest,
  type ImplementationStreamExecutionState,
} from './workspace-implementation-generation';
import type { RunWorkspaceImplementationGenerationOptions } from './workspace-orchestration-execution-types';
import type { WorkspaceMessagePatch } from './workspace-orchestration-shared-types';
import type { WorkspaceChatMessage } from './workspace-types';

type WorkspaceImplementationStreamPatchMessageList = WorkspaceChatMessage[];

type WorkspaceImplementationStreamPatchMessageMaterializerInput = {
  messages: WorkspaceChatMessage[];
  messageId: string;
  patch: WorkspaceMessagePatch;
};

function materializeWorkspaceImplementationStreamPatchMessages({
  messages,
  messageId,
  patch,
}: WorkspaceImplementationStreamPatchMessageMaterializerInput): WorkspaceImplementationStreamPatchMessageList {
  const nextMessages: WorkspaceImplementationStreamPatchMessageList = [];

  for (const message of messages) {
    if (message.id !== messageId) {
      nextMessages.push(message);
      continue;
    }

    const nextPatch = typeof patch === 'function' ? patch(message) : patch;
    const hasNextPatch = nextPatch !== null && nextPatch !== undefined;
    if (hasNextPatch === false) {
      nextMessages.push(message);
      continue;
    }

    nextMessages.push({
      ...message,
      ...nextPatch,
    });
  }

  return nextMessages;
}

export async function runWorkspaceImplementationGeneration({
  prompt,
  targetProject,
  options,
  projectInfo,
  chatMode,
  isOnline,
  selectedModel,
  files,
  savedFiles,
  generationAbortRef,
  persistGenerationState,
  applyImplementationGenerationMessages,
  applyImplementationStreamPatchMessages,
  applyGenerationStateMessages,
  setFiles,
  setSavedFiles,
  setIsGenerating,
  setIsStopConfirming,
  setGenerationStage,
  applyWorkflowStepToMessage,
  applyIncrementalWorkflowStep,
  setMessageStreamingState,
  yieldStepRender,
  reflectFilePathInTree,
  fetchProjectDetail,
  refreshProjectFileTree,
  fetchProjectCommits,
  safeParseJSON,
  appendStatusLine,
  appendReasoningChunk,
  normalizeWorkflowStep,
  getEventMessage,
  getGeneratedFilesFromEvent,
  getGuidanceFromEvent,
  resolveStepEngineeringState,
}: RunWorkspaceImplementationGenerationOptions) {
  const request = prepareImplementationGenerationRequest(
    prompt,
    projectInfo,
    chatMode,
    isOnline,
    options,
    targetProject,
  );
  const streamState: ImplementationStreamExecutionState = {
    fullContent: '',
    reasoningContent: '',
    statusContent: request.statusContent,
  };
  const abortController = new AbortController();
  generationAbortRef.current = abortController;

  const patchImplementationStreamMessage = (
    messageId: string,
    patch: WorkspaceMessagePatch,
  ) => {
    applyImplementationStreamPatchMessages((prev) => materializeWorkspaceImplementationStreamPatchMessages({
      messages: prev,
      messageId,
      patch,
    }));
  };

  const { updateStreamingMessage, updateStreamingStepState } = createImplementationStreamingUpdaters(
    request.assistantMessageId,
    {
      patchImplementationStreamMessage,
    },
  );

  const streamContext = buildImplementationStreamContext(request, {
    updateStreamingMessage,
    updateStreamingStepState,
  }, {
    appendReasoningChunk,
    appendStatusLine,
    applyIncrementalWorkflowStep,
    applyWorkflowStepToMessage,
    fetchProjectCommits,
    fetchProjectDetail,
    files,
    getEventMessage,
    getGeneratedFilesFromEvent,
    getGuidanceFromEvent,
    normalizeWorkflowStep,
    patchImplementationStreamMessage,
    refreshProjectFileTree,
    reflectFilePathInTree,
    resolveStepEngineeringState,
    safeParseJSON,
    savedFiles,
    setFiles,
    setGenerationStage,
    setMessageStreamingState,
    setSavedFiles,
    yieldStepRender,
  });

  initializeImplementationGeneration({
    assistantMessageId: request.assistantMessageId,
    effectiveMode: request.effectiveMode,
    effectiveProject: request.effectiveProject,
    hasExistingAssistantMessage: request.hasExistingAssistantMessage,
    persistGenerationState,
    prompt: request.prompt,
    applyImplementationGenerationMessages,
    applyGenerationStateMessages,
    setGenerationStage,
    setIsGenerating,
    setIsStopConfirming,
    updateStreamingMessage,
  }, {
    statusContent: streamState.statusContent,
  });

  try {
    let generationJobId = '';
    let generationEventCursor = 0;
    let terminalReached = false;
    let completionReported = false;
    const reportCompletion = (succeeded: boolean) => {
      if (completionReported === true) return;
      completionReported = true;
      options?.onTerminal?.(succeeded);
    };
    const consumeGenerationResponse = async (response: Response) => {
      const responseJobId = response.headers.get('X-Generation-Job-ID')?.trim();
      if (responseJobId) generationJobId = responseJobId;
      await consumeImplementationStream(response, streamContext, streamState, {
        onEventCursor: (cursor) => {
          const parsed = Number.parseInt(cursor, 10);
          if (Number.isFinite(parsed) && parsed >= generationEventCursor) {
            generationEventCursor = parsed;
          }
        },
        onTerminal: (status) => {
          terminalReached = true;
          reportCompletion(status === 'succeeded');
        },
      });
    };
    const resolveGenerationJobId = async () => {
      if (generationJobId || !request.effectiveProject?.projectId) return generationJobId;
      const status = await projectApi.getGenerationStatus(request.effectiveProject.projectId);
      const job = status.generation_job;
      if (job?.idempotency_key === request.assistantMessageId) {
        generationJobId = job.id;
      }
      return generationJobId;
    };
    const replayGenerationJob = async () => {
      const jobId = await resolveGenerationJobId();
      const projectId = request.effectiveProject?.projectId;
      if (!jobId || !projectId) {
        throw new Error('无法定位持久生成任务，不能恢复中断的事件流');
      }
      setGenerationStage('生成连接已中断，正在恢复任务事件...');
      const replayResponse = await projectApi.replayGenerationEvents(
        projectId,
        jobId,
        generationEventCursor,
        abortController.signal,
      );
      await consumeGenerationResponse(replayResponse);
    };

    let streamFailure: unknown;
    let hasStreamFailure = false;
    try {
      const response = await chatApi.generateStream(
        buildImplementationGeneratePayload(request, selectedModel),
        abortController.signal,
      );
      await consumeGenerationResponse(response);
    } catch (error) {
      streamFailure = error;
      hasStreamFailure = true;
    }

    const requestWasAborted = streamFailure instanceof DOMException && streamFailure.name === 'AbortError';
    if (terminalReached === false && requestWasAborted === false) {
      try {
        await replayGenerationJob();
        hasStreamFailure = false;
        streamFailure = undefined;
      } catch (error) {
        streamFailure = error;
        hasStreamFailure = true;
      }
    }
    if (terminalReached === false && hasStreamFailure === false) {
      streamFailure = new Error('持久生成事件流在终态前结束');
      hasStreamFailure = true;
    }
    if (hasStreamFailure === true) {
      handleImplementationStreamFailure(streamFailure, {
        assistantMessageId: request.assistantMessageId,
        patchImplementationStreamMessage,
        setMessageStreamingState,
      }, {
        reasoningContent: streamState.reasoningContent,
        statusContent: streamState.statusContent,
      });
      reportCompletion(false);
    }
  } finally {
    cleanupImplementationGeneration({
      generationAbortRef,
      persistGenerationState,
      applyGenerationStateMessages,
      setGenerationStage,
      setIsGenerating,
      setIsStopConfirming,
    });
  }
}
