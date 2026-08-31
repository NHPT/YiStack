import type {
  ImplementationDoneEffectsContext,
  ImplementationGeneratedFilesApplyContext,
  ImplementationRelatedCommitContext,
  ImplementationStreamExecutionState,
  WorkspaceMessagePatch,
} from './workspace-implementation-stream-types';
import type { GitCommit } from '@/lib/types';
import type { WorkspaceResourceSyncStage } from '@/lib/workspace/workspace-resource-operation-errors';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';
import { formatWorkspaceResourceOperationFailure } from '@/lib/workspace/workspace-resource-operation-errors';
import type {
  GuidanceAction,
  WorkspaceChatMessage,
  WorkspaceGeneratedFileList,
  WorkspaceGuidanceResolver,
} from './workspace-types';
import type { WorkspaceStreamEventData } from './workspace-orchestration-shared';

export type ImplementationFinalSyncStage = WorkspaceResourceSyncStage;

export type ImplementationFinalSyncFailure = {
  stage: ImplementationFinalSyncStage;
  label: string;
  reason: string;
};

export type ImplementationFinalSyncStageLabelMap = {
  [stage in ImplementationFinalSyncStage]: string;
};

type ImplementationRelatedCommitResult = {
  relatedCommit?: GitCommit;
  syncFailure?: ImplementationFinalSyncFailure;
};

type ImplementationFinalizationGuidanceActionList = GuidanceAction[];

const implementationFinalSyncStageLabels: ImplementationFinalSyncStageLabelMap = {
  project_detail: '项目详情同步',
  file_tree: 'Explorer 文件树同步',
  commit_list: 'Git 提交列表同步',
};

function buildImplementationFinalSyncFailure(
  stage: ImplementationFinalSyncStage,
  error: unknown,
): ImplementationFinalSyncFailure {
  return {
    stage,
    label: implementationFinalSyncStageLabels[stage],
    reason: formatWorkspaceResourceOperationFailure(error),
  };
}

function buildImplementationFinalSyncFailureState(
  failure: ImplementationFinalSyncFailure,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'failed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `实现完成后${failure.label}失败`,
      completed_tasks: ['生成流已完成', '生成结果已应用到本地 Workspace 预览'],
      blockers: [`${failure.label}失败：${failure.reason}`],
      next_action: failure.stage === 'commit_list'
        ? '先打开 Git 面板确认提交列表真源；必要时重新刷新 Explorer 校准文件树。'
        : '先重新刷新 Explorer 校准后端文件树真源，再继续依赖当前资源视图。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `实现完成后的${failure.label}失败`,
      next_action: failure.stage === 'commit_list'
        ? '打开 Git 面板确认提交状态，避免把本地生成预览误判为完整版本快照。'
        : '重新刷新 Explorer，确认本地生成预览是否已被后端文件树真源确认。',
    },
    recovery: {
      blocked: false,
      reason_code: `implementation_final_${failure.stage}_sync_failed`,
      reason_message: `${failure.label}失败：${failure.reason}`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildImplementationFinalSyncFailureActions(
  failure: ImplementationFinalSyncFailure,
): GuidanceAction[] {
  if (failure.stage === 'commit_list') {
    return [{
      label: '打开 Git 面板',
      kind: 'open_git_panel',
    }];
  }
  return [{
    label: '重新刷新 Explorer',
    kind: 'refresh_explorer_panel',
  }];
}

function getImplementationFinalizationSuggestedActions(
  message: WorkspaceChatMessage,
): ImplementationFinalizationGuidanceActionList {
  if (Array.isArray(message.suggestedActions) === false) {
    return [];
  }

  return message.suggestedActions;
}

function hasImplementationFinalizationTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasImplementationFinalizationEventText(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmedValue = value.trim();
  return hasImplementationFinalizationTextValue(trimmedValue);
}

function getImplementationFinalizationTextValue(value: string): string {
  return value.trim();
}

function getImplementationFinalizationOptionalText(value: string): string | undefined {
  const trimmedValue = getImplementationFinalizationTextValue(value);
  const hasTrimmedValue = hasImplementationFinalizationTextValue(trimmedValue);

  return hasTrimmedValue === true ? trimmedValue : undefined;
}

function getImplementationDoneMessageContent(
  data: WorkspaceStreamEventData,
  fallbackContent: string,
): string {
  const generatedMessage = data.genMessage;
  const hasGeneratedMessage = hasImplementationFinalizationEventText(generatedMessage);

  if (hasGeneratedMessage === true) {
    return generatedMessage;
  }

  const eventContent = data.content;
  const hasEventContent = hasImplementationFinalizationEventText(eventContent);

  if (hasEventContent === true) {
    return eventContent;
  }

  return fallbackContent;
}

export function buildImplementationFinalSyncFailurePatch(
  failure: ImplementationFinalSyncFailure,
): WorkspaceMessagePatch {
  return (message) => {
    const failureSummary = [
      `实现生成已完成，本地 Workspace 已应用生成结果预览，但${failure.label}失败：${failure.reason}。`,
      failure.stage === 'commit_list'
        ? '当前 Git 面板可能不是最新提交真源；请打开 Git 面板确认后再判断版本快照。'
        : '当前 Explorer 仍可能是生成流本地预览；请重新刷新 Explorer 成功后再判断完整后端文件树。',
    ].join('\n\n');
    const existingActions = getImplementationFinalizationSuggestedActions(message);
    const nextActions = [
      ...buildImplementationFinalSyncFailureActions(failure),
      ...existingActions,
    ];
    return {
      content: message.content.includes(failureSummary)
        ? message.content
        : `${message.content}\n\n${failureSummary}`,
      statusContent: `实现完成但${failure.label}失败`,
      engineeringState: buildImplementationFinalSyncFailureState(failure),
      suggestedActions: nextActions,
    };
  };
}

export function buildImplementationDoneMessagePatch(
  data: WorkspaceStreamEventData,
  context: {
    fullContent: string;
    getGuidanceFromEvent: WorkspaceGuidanceResolver;
    reasoningContent: string;
    statusContent: string;
  },
) {
  const nextGuidance = context.getGuidanceFromEvent(data, [], []);
  const finalMessageContent = getImplementationDoneMessageContent(data, context.fullContent);
  const finalReasoningContent = getImplementationFinalizationOptionalText(context.reasoningContent);
  const finalStatusContent = finalReasoningContent !== undefined
    ? undefined
    : getImplementationFinalizationOptionalText(context.statusContent);

  return {
    patch: {
      kind: 'workflow' as const,
      content: finalMessageContent,
      reasoningContent: finalReasoningContent,
      statusContent: finalStatusContent,
      activeFileOperation: undefined,
      streaming: false,
      ...nextGuidance,
    },
  };
}

export function applyGeneratedFilesToWorkspace(
  generatedFiles: WorkspaceGeneratedFileList,
  context: ImplementationGeneratedFilesApplyContext,
) {
  if (generatedFiles.length === 0) {
    return;
  }

  const nextFiles = new Map(context.files);
  const nextSavedFiles = new Map(context.savedFiles);
  for (const file of generatedFiles) {
    nextFiles.set(file.path, file.content);
    nextSavedFiles.set(file.path, file.content);
    context.reflectFilePathInTree(file.path);
  }
  context.setFiles(new Map(nextFiles));
  context.setSavedFiles(new Map(nextSavedFiles));
}

function getImplementationFinalizationFirstCommit(commits: GitCommit[]): GitCommit | undefined {
  for (const commit of commits) {
    return commit;
  }

  return undefined;
}

export async function resolveImplementationRelatedCommit(
  data: WorkspaceStreamEventData,
  context: ImplementationRelatedCommitContext,
): Promise<ImplementationRelatedCommitResult> {
  if (
    context.effectiveMode !== 'implement'
    || !context.effectiveProject?.isPersisted
    || !context.effectiveProject.projectId
  ) {
    return {};
  }

  try {
    await context.fetchProjectDetail(context.effectiveProject.projectId);
  } catch (error) {
    return { syncFailure: buildImplementationFinalSyncFailure('project_detail', error) };
  }

  try {
    await context.refreshProjectFileTree(context.effectiveProject.projectId, true, {
      throwOnFailure: true,
      suppressNotice: true,
    });
  } catch (error) {
    return { syncFailure: buildImplementationFinalSyncFailure('file_tree', error) };
  }

  if (data.gitCommitCreated !== true) {
    return {};
  }

  try {
    const latestCommits = await context.fetchProjectCommits(context.effectiveProject.projectId);
    return { relatedCommit: getImplementationFinalizationFirstCommit(latestCommits) };
  } catch (error) {
    return { syncFailure: buildImplementationFinalSyncFailure('commit_list', error) };
  }
}

export function buildImplementationDoneEffects(
  data: WorkspaceStreamEventData,
  context: ImplementationDoneEffectsContext,
  state: ImplementationStreamExecutionState,
) {
  return {
    generatedFiles: context.getGeneratedFilesFromEvent(data),
    doneMessagePatch: buildImplementationDoneMessagePatch(data, {
      fullContent: state.fullContent,
      getGuidanceFromEvent: context.getGuidanceFromEvent,
      reasoningContent: state.reasoningContent,
      statusContent: state.statusContent,
    }).patch,
  };
}
