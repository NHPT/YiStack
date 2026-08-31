import type {
  ImplementationDoneFinalizationContext,
  ImplementationStreamExecutionState,
  ImplementationStreamFailureContext,
  ImplementationStreamFailureState,
} from './workspace-implementation-stream-types';
import type { WorkspaceStreamEventData } from './workspace-orchestration-shared';
import type { ImplementationFinalSyncFailure } from './workspace-implementation-finalization-effects';
import {
  applyGeneratedFilesToWorkspace,
  buildImplementationFinalSyncFailurePatch,
  buildImplementationDoneEffects,
  resolveImplementationRelatedCommit,
} from './workspace-implementation-finalization-effects';
import { buildImplementationFailurePatch } from './workspace-implementation-failure-effects';

function hasImplementationFinalSyncFailure(
  syncFailure: ImplementationFinalSyncFailure | undefined,
): syncFailure is ImplementationFinalSyncFailure {
  return syncFailure !== undefined;
}

export async function finalizeImplementationDoneEvent(
  data: WorkspaceStreamEventData,
  context: ImplementationDoneFinalizationContext,
  state: ImplementationStreamExecutionState,
) {
  context.setMessageStreamingState(context.assistantMessageId, false);
  context.setGenerationStage(
    data.mode === 'discuss'
      ? '整理探讨结果...'
      : data.mode === 'foundation'
        ? '整理项目基础设定结果...'
        : '解析生成的文件...',
  );
  context.updateStreamingMessage({ activeFileOperation: undefined });

  const { doneMessagePatch, generatedFiles } = buildImplementationDoneEffects(data, {
    getGeneratedFilesFromEvent: context.getGeneratedFilesFromEvent,
    getGuidanceFromEvent: context.getGuidanceFromEvent,
  }, state);

  applyGeneratedFilesToWorkspace(generatedFiles, {
    files: context.files,
    reflectFilePathInTree: context.reflectFilePathInTree,
    savedFiles: context.savedFiles,
    setFiles: context.setFiles,
    setSavedFiles: context.setSavedFiles,
  });
  context.patchImplementationStreamMessage(context.assistantMessageId, doneMessagePatch);

  const { relatedCommit, syncFailure } = await resolveImplementationRelatedCommit(data, {
    effectiveMode: context.effectiveMode,
    effectiveProject: context.effectiveProject,
    fetchProjectCommits: context.fetchProjectCommits,
    fetchProjectDetail: context.fetchProjectDetail,
    refreshProjectFileTree: context.refreshProjectFileTree,
  });
  context.patchImplementationStreamMessage(context.assistantMessageId, {
    relatedCommit,
  });
  if (hasImplementationFinalSyncFailure(syncFailure) === true) {
    context.patchImplementationStreamMessage(
      context.assistantMessageId,
      buildImplementationFinalSyncFailurePatch(syncFailure),
    );
  }
}

export function handleImplementationStreamFailure(
  error: unknown,
  context: ImplementationStreamFailureContext,
  state: ImplementationStreamFailureState,
) {
  context.setMessageStreamingState(context.assistantMessageId, false);
  if (error instanceof DOMException && error.name === 'AbortError') {
    context.patchImplementationStreamMessage(context.assistantMessageId, (msg) => ({
      kind: 'workflow',
      streaming: false,
      content: '本次 AI 生成已停止。你可以继续修改输入后重新开始。',
      reasoningContent: state.reasoningContent || msg.reasoningContent,
      statusContent: state.reasoningContent ? undefined : (state.statusContent || msg.statusContent),
    }));
    return;
  }

  console.error('LLM 生成失败:', error);
  context.patchImplementationStreamMessage(context.assistantMessageId, buildImplementationFailurePatch(error, {
    reasoningContent: state.reasoningContent,
    statusContent: state.statusContent,
  }));
}
