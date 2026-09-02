import { useCallback, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { projectApi } from '@/lib/api';
import { isVisualContext } from '@/lib/visual-context';
import { formatStopGenerationSyncFailure } from '@/lib/workspace/workspace-generation-control-errors';
import {
  buildWorkspaceGenerationStateInvalidShapeFailure,
  buildWorkspaceGenerationStateParseFailure,
  buildWorkspaceGenerationStateStorageFailure,
  formatWorkspaceGenerationStateLocalFailure,
} from '@/lib/workspace/workspace-generation-state-local-errors';
import type {
  WorkspaceGenerationStateLocalDetails,
  WorkspaceGenerationStateParseSource,
  WorkspaceGenerationStateStorageSource,
} from '@/lib/workspace/workspace-generation-state-local-errors';

import {
  replayWorkspaceGenerationJob,
  shouldReplayWorkspaceGenerationJob,
} from './workspace-generation-job-replay';

import type {
  PersistedGenerationState,
  PersistedGenerationStateReason,
  PersistedGenerationStateStatus,
  PersistGenerationState,
  WorkspaceChatMessage,
  WorkspaceContextMenu,
  WorkspaceProjectInfo,
} from './workspace-types';
import { appendGenerationStatePersistenceFailureMessage } from './workspace-generation-state-persistence';
import type { WorkspacePageEffectsContract } from './workspace-page-effects-contract';

type UseWorkspacePageEffectsOptions = {
  projectInfo: WorkspaceProjectInfo | null;
  input: string;
  isGenerating: boolean;
  isPlanning: boolean;
  isStopConfirming: boolean;
  generationAbortRef: MutableRefObject<AbortController | null>;
  planningAbortRef: MutableRefObject<AbortController | null>;
  applyPageEffectMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setGenerationStage: Dispatch<SetStateAction<string>>;
  setIsStopConfirming: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<SetStateAction<WorkspaceContextMenu | null>>;
  persistGenerationState: PersistGenerationState;
};

function hasWorkspacePageEffectProjectIdValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspacePageEffectProject(projectInfo: WorkspaceProjectInfo | null): WorkspaceProjectInfo | null {
  if (projectInfo === null) {
    return null;
  }

  const hasProjectId = hasWorkspacePageEffectProjectIdValue(projectInfo.projectId);
  if (hasProjectId === true) {
    return projectInfo;
  }

  return null;
}

function getWorkspacePageEffectPersistedProject(projectInfo: WorkspaceProjectInfo | null): WorkspaceProjectInfo | null {
  const effectiveProject = getWorkspacePageEffectProject(projectInfo);
  if (effectiveProject === null) {
    return null;
  }

  const isPersistedProject = effectiveProject.isPersisted === true;
  if (isPersistedProject === false) {
    return null;
  }

  return effectiveProject;
}

function hasWorkspacePageEffectActiveGeneration(isGenerating: boolean, isPlanning: boolean): boolean {
  if (isGenerating === true) {
    return true;
  }

  return isPlanning === true;
}

function hasWorkspacePageEffectRawGenerationState(rawState: string | null): rawState is string {
  if (rawState === null) {
    return false;
  }

  const hasRawState = rawState.length > 0;
  return hasRawState === true;
}

const generationStateStorageKey = 'yistack_generation_state';

type GenerationStateStorageReadResult =
  | { ok: true; raw: string | null }
  | {
    ok: false;
    error: unknown;
    source: WorkspaceGenerationStateStorageSource;
    details: WorkspaceGenerationStateLocalDetails;
  };

type GenerationStateParseResult =
  | { ok: true; value: PersistedGenerationState }
  | {
    ok: false;
    error: unknown;
    source: WorkspaceGenerationStateParseSource;
    details: WorkspaceGenerationStateLocalDetails;
  };

export type PersistedGenerationStateRawObject = {
  [fieldName: string]: unknown;
};

function readGenerationStateStorage(): GenerationStateStorageReadResult {
  try {
    return { ok: true, raw: sessionStorage.getItem(generationStateStorageKey) };
  } catch (error) {
    return buildWorkspaceGenerationStateStorageFailure(
      error,
      '浏览器拒绝读取本地生成状态',
    );
  }
}

function isPersistedGenerationStateRawObject(value: unknown): value is PersistedGenerationStateRawObject {
  const isObject = typeof value === 'object';
  if (isObject === false) {
    return false;
  }

  if (value === null) {
    return false;
  }

  const isArray = Array.isArray(value);
  return isArray === false;
}

function isPersistedGenerationStateStatus(value: unknown): value is PersistedGenerationStateStatus {
  return value === 'running' || value === 'interrupted';
}

function isPersistedGenerationStateReason(value: unknown): value is PersistedGenerationStateReason {
  return value === 'refresh' || value === 'manual';
}

function hasPersistedGenerationStateRequiredShape(
  value: PersistedGenerationStateRawObject,
): value is PersistedGenerationState {
  const hasProjectId = typeof value.projectId === 'string';
  if (hasProjectId === false) {
    return false;
  }

  const hasPrompt = typeof value.prompt === 'string';
  if (hasPrompt === false) {
    return false;
  }

  const hasStatus = isPersistedGenerationStateStatus(value.status);
  if (hasStatus === false) {
    return false;
  }

  const reason = value.reason;
  const hasInvalidReason = reason !== undefined && isPersistedGenerationStateReason(reason) === false;
  if (hasInvalidReason === true) {
    return false;
  }

  const projectName = value.projectName;
  const hasInvalidProjectName = projectName !== undefined && typeof projectName !== 'string';
  if (hasInvalidProjectName === true) {
    return false;
  }

  const hasStartedAt = typeof value.startedAt === 'string';
  return hasStartedAt === true;
}

function parsePersistedGenerationState(rawState: string): GenerationStateParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawState);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'JSON.parse failed';
    return buildWorkspaceGenerationStateParseFailure(
      error,
      rawState,
      reason,
    );
  }

  if (isPersistedGenerationStateRawObject(parsed) === false) {
    return buildWorkspaceGenerationStateInvalidShapeFailure(rawState);
  }

  if (hasPersistedGenerationStateRequiredShape(parsed) === false) {
    return buildWorkspaceGenerationStateInvalidShapeFailure(rawState);
  }

  return {
    ok: true,
    value: {
      projectId: parsed.projectId,
      projectName: parsed.projectName,
      prompt: parsed.prompt,
      status: parsed.status,
      reason: parsed.reason,
      startedAt: parsed.startedAt,
    },
  };
}

export function useWorkspacePageEffects({
  projectInfo,
  input,
  isGenerating,
  isPlanning,
  isStopConfirming,
  generationAbortRef,
  planningAbortRef,
  applyPageEffectMessages,
  setIsGenerating,
  setGenerationStage,
  setIsStopConfirming,
  setContextMenu,
  persistGenerationState,
}: UseWorkspacePageEffectsOptions): WorkspacePageEffectsContract {
  useEffect(() => {
    const effectiveProject = getWorkspacePageEffectProject(projectInfo);
    if (effectiveProject === null) return;
    if (isGenerating === true && generationAbortRef.current !== null) return;
    let cancelled = false;
    let generationStatusPollTimer: number | undefined;
    let replayAbortController: AbortController | undefined;
    let replayStarted = false;
    let replayAttempted = false;
    let replayCursor = 0;
    let terminalReplayAllowed = false;
    let replayContent = '';

    const finishGenerationRecovery = () => {
      setIsGenerating(false);
      setGenerationStage('');
      appendGenerationStatePersistenceFailureMessage(applyPageEffectMessages, persistGenerationState(null));
    };

    const cleanupGenerationStatusPolling = () => {
      cancelled = true;
      replayAbortController?.abort();
      if (generationStatusPollTimer !== undefined) {
        window.clearTimeout(generationStatusPollTimer);
      }
    };

    const updateGenerationReplayMessage = (
      assistantMessageId: string,
      patch: Partial<WorkspaceChatMessage>,
    ) => {
      if (!assistantMessageId) return;
      applyPageEffectMessages((messages) => {
        const nextMessages: WorkspaceChatMessage[] = [];
        let found = false;
        for (const message of messages) {
          if (message.id !== assistantMessageId) {
            nextMessages.push(message);
            continue;
          }
          found = true;
          nextMessages.push({ ...message, kind: 'workflow', ...patch });
        }
        if (found === false) {
          nextMessages.push({
            id: assistantMessageId,
            role: 'assistant',
            content: patch.content ?? '',
            kind: 'workflow',
            streaming: patch.streaming,
            statusContent: patch.statusContent,
            timestamp: new Date(),
          });
        }
        return nextMessages;
      });
    };

    const applyGenerationReplayEvent = (
      assistantMessageId: string,
      event: string,
      data: Record<string, unknown>,
    ) => {
      const readText = (value: unknown) => typeof value === 'string' ? value : '';
      if (event === 'visual_context') {
        const visualContext = data.visual_context;
        if (isVisualContext(visualContext) === true) {
          updateGenerationReplayMessage(assistantMessageId, { visualContext });
        }
        return;
      }
      if (event === 'chunk') {
        replayContent += readText(data.content);
        updateGenerationReplayMessage(assistantMessageId, {
          content: replayContent,
          streaming: true,
        });
        return;
      }
      if (event === 'done') {
        const finalContent = readText(data.genMessage).trim()
          || readText(data.content).trim()
          || replayContent.trim()
          || readText(data.message).trim();
        updateGenerationReplayMessage(assistantMessageId, {
          content: finalContent,
          statusContent: undefined,
          streaming: false,
        });
        return;
      }
      if (event === 'error') {
        const errorMessage = readText(data.message).trim()
          || readText(data.error).trim()
          || '生成失败';
        updateGenerationReplayMessage(assistantMessageId, {
          content: errorMessage,
          statusContent: errorMessage,
          streaming: false,
        });
      }
    };

    const startGenerationEventReplay = (jobId: string, assistantMessageId: string) => {
      if (replayStarted === true || cancelled === true) return;
      replayStarted = true;
      replayAttempted = true;
      let replayReachedTerminal = false;
      replayAbortController = new AbortController();
      void projectApi.replayGenerationEvents(
        effectiveProject.projectId,
        jobId,
        replayCursor,
        replayAbortController.signal,
      ).then(async (response) => {
        await replayWorkspaceGenerationJob(response, {
          onEvent: (event, data) => {
            applyGenerationReplayEvent(assistantMessageId, event, data);
          },
          onCursor: (cursor) => {
            replayCursor = cursor;
          },
          onStage: (stage) => {
            if (stage) {
              setGenerationStage(stage);
              updateGenerationReplayMessage(assistantMessageId, { statusContent: stage, streaming: true });
            }
          },
          onTerminal: () => {
            replayReachedTerminal = true;
            if (cancelled === false) finishGenerationRecovery();
          },
        });
        replayStarted = false;
        if (cancelled === false && replayReachedTerminal === false) {
          generationStatusPollTimer = window.setTimeout(pollGenerationStatusUntilSettled, 0);
        }
      }).catch((error) => {
        replayStarted = false;
        if (cancelled === true || replayAbortController?.signal.aborted === true) return;
        console.error('恢复持久生成事件失败:', error);
        generationStatusPollTimer = window.setTimeout(pollGenerationStatusUntilSettled, 3000);
      });
    };

    const pollGenerationStatusUntilSettled = () => {
      void projectApi.getGenerationStatus(effectiveProject.projectId).then((status) => {
        if (cancelled === true) return;
        const generationJob = status.generation_job;
        const shouldReplayGenerationJob = generationJob !== null
          && shouldReplayWorkspaceGenerationJob({
            generationActive: status.generation_active,
            terminalReplayAllowed: terminalReplayAllowed === true || replayAttempted === true,
            lastEventSequence: generationJob.last_event_sequence,
            cursor: replayCursor,
          });
        if (shouldReplayGenerationJob === true) {
          setIsGenerating(true);
          setGenerationStage(`生成任务 ${generationJob.status}，正在恢复事件...`);
          startGenerationEventReplay(generationJob.id, generationJob.idempotency_key);
          return;
        }
        if (status.generation_active === true) {
          setIsGenerating(true);
          generationStatusPollTimer = window.setTimeout(pollGenerationStatusUntilSettled, 3000);
          return;
        }
        finishGenerationRecovery();
      }).catch((error) => {
        if (cancelled === true) return;
        console.error('轮询生成任务状态失败:', error);
        generationStatusPollTimer = window.setTimeout(pollGenerationStatusUntilSettled, 5000);
      });
    };
    const generationStateReadResult = readGenerationStateStorage();
    if (generationStateReadResult.ok === false) {
      console.error(
        '读取本地生成恢复状态失败:',
        formatWorkspaceGenerationStateLocalFailure(generationStateReadResult, '浏览器拒绝读取本地生成状态'),
      );
      appendGenerationStatePersistenceFailureMessage(applyPageEffectMessages, persistGenerationState(null));
      pollGenerationStatusUntilSettled();
      return cleanupGenerationStatusPolling;
    }

    const rawState = generationStateReadResult.raw;
    if (hasWorkspacePageEffectRawGenerationState(rawState) === true) {
      const parseResult = parsePersistedGenerationState(rawState);
      if (parseResult.ok === false) {
        console.error(
          '解析本地生成恢复状态失败:',
          formatWorkspaceGenerationStateLocalFailure(parseResult, '本地生成恢复状态解析失败'),
        );
        appendGenerationStatePersistenceFailureMessage(applyPageEffectMessages, persistGenerationState(null));
      } else if (
        parseResult.value.projectId === effectiveProject.projectId
      ) {
        terminalReplayAllowed = true;
      }
    }

    pollGenerationStatusUntilSettled();
    return cleanupGenerationStatusPolling;
  }, [applyPageEffectMessages, generationAbortRef, isGenerating, persistGenerationState, projectInfo, setGenerationStage, setIsGenerating]);

  useEffect(() => {
    const effectiveProject = getWorkspacePageEffectProject(projectInfo);
    if (isGenerating === false || effectiveProject === null) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      appendGenerationStatePersistenceFailureMessage(applyPageEffectMessages, persistGenerationState({
        projectId: effectiveProject.projectId,
        projectName: effectiveProject.projectName,
        prompt: input,
        status: 'interrupted',
        reason: 'refresh',
        startedAt: new Date().toISOString(),
      }));
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [applyPageEffectMessages, input, isGenerating, persistGenerationState, projectInfo]);

  useEffect(() => {
    if (isStopConfirming === false) return;
    const timer = window.setTimeout(() => setIsStopConfirming(false), 5000);
    return () => window.clearTimeout(timer);
  }, [isStopConfirming, setIsStopConfirming]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [setContextMenu]);

  const handleCancelStopGenerate = useCallback(() => {
    setIsStopConfirming(false);
  }, [setIsStopConfirming]);

  const handleStopGenerate = useCallback(() => {
    const hasActiveGeneration = hasWorkspacePageEffectActiveGeneration(isGenerating, isPlanning);
    if (hasActiveGeneration === false) return;
    if (isStopConfirming === false) {
      setIsStopConfirming(true);
      return;
    }

    const effectiveProject = getWorkspacePageEffectProject(projectInfo);
    if (effectiveProject !== null) {
      appendGenerationStatePersistenceFailureMessage(applyPageEffectMessages, persistGenerationState({
        projectId: effectiveProject.projectId,
        projectName: effectiveProject.projectName,
        prompt: input,
        status: 'interrupted',
        reason: 'manual',
        startedAt: new Date().toISOString(),
      }));
    }

    planningAbortRef.current?.abort();
    generationAbortRef.current?.abort();
    setIsStopConfirming(false);
    const persistedProject = getWorkspacePageEffectPersistedProject(projectInfo);
    if (persistedProject !== null) {
      void projectApi.stopGeneration(persistedProject.projectId).catch((error) => {
        console.error('请求后端停止生成失败:', error);
        applyPageEffectMessages((prev) => [...prev, {
          id: `stop-generation-failed-${persistedProject.projectId}-${Date.now()}`,
          role: 'assistant',
          content: `停止生成请求同步失败：${formatStopGenerationSyncFailure(error)}。本地生成流已中断，但后端可能仍在处理当前项目；请稍后刷新项目或查看最新消息，避免把当前视图误判为后端已完全停止。`,
          timestamp: new Date().toISOString(),
        }]);
      });
    }
  }, [
    generationAbortRef,
    input,
    isGenerating,
    isPlanning,
    isStopConfirming,
    persistGenerationState,
    planningAbortRef,
    projectInfo,
    applyPageEffectMessages,
    setIsStopConfirming,
  ]);

  return {
    handleCancelStopGenerate,
    handleStopGenerate,
  };
}
