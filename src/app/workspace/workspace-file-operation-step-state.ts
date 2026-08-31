import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';

export type WorkspaceFileOperationFailureCompletedTask = string;
export type WorkspaceFileOperationFailureCompletedTaskList = WorkspaceFileOperationFailureCompletedTask[];

type FileOperationFailureMeta = {
  currentTask: string;
  completedTasks: WorkspaceFileOperationFailureCompletedTaskList;
  nextAction: string;
  reasonMessage: string;
};

function readStepString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasFileOperationStepPath(path: string): boolean {
  const hasPath = path.length > 0;
  return hasPath === true;
}

function hasFileOperationRenamePaths(fromPath: string, toPath: string): boolean {
  const hasFromPath = hasFileOperationStepPath(fromPath);
  const hasToPath = hasFileOperationStepPath(toPath);
  return hasFromPath === true && hasToPath === true;
}

function hasFileOperationFailureMeta(meta: FileOperationFailureMeta | null): meta is FileOperationFailureMeta {
  return meta !== null;
}

function getFileOperationFailureMeta(step: WorkflowStep): FileOperationFailureMeta | null {
  const path = readStepString(step.meta?.path);
  const fromPath = readStepString(step.meta?.fromPath);
  const toPath = readStepString(step.meta?.toPath);
  const reasonMessage = readStepString(step.detail) || readStepString(step.title) || '文件操作步骤失败';

  const localCacheNotMutated: WorkspaceFileOperationFailureCompletedTaskList = [
    '失败步骤未应用到本地 Workspace 资源缓存',
  ];
  const localPreviewMayBeStale: WorkspaceFileOperationFailureCompletedTaskList = [
    '失败步骤已停止继续应用',
    '本地 Explorer 或编辑器可能包含流式预览快照',
  ];

  switch (step.kind) {
    case 'read_file':
      if (hasFileOperationStepPath(path) === false) return null;
      return {
        currentTask: `读取文件 ${path} 失败`,
        completedTasks: localCacheNotMutated,
        nextAction: '检查读取失败原因后重试；如 Explorer 与真源不一致，先刷新文件树。',
        reasonMessage,
      };
    case 'search_file':
      if (hasFileOperationStepPath(path) === false) return null;
      return {
        currentTask: `搜索文件 ${path} 失败`,
        completedTasks: localCacheNotMutated,
        nextAction: '检查搜索失败原因后重试；如目录快照可疑，先刷新文件树。',
        reasonMessage,
      };
    case 'create_file':
      if (hasFileOperationStepPath(path) === false) return null;
      return {
        currentTask: `创建文件 ${path} 失败`,
        completedTasks: localPreviewMayBeStale,
        nextAction: '检查创建失败原因后重试；如 Explorer 显示了未落盘文件，刷新文件树校准后端真源。',
        reasonMessage,
      };
    case 'write_file':
      if (hasFileOperationStepPath(path) === false) return null;
      return {
        currentTask: `修改文件 ${path} 失败`,
        completedTasks: localPreviewMayBeStale,
        nextAction: '检查修改失败原因后重试；本地编辑器内容可能尚未可靠写入后端。',
        reasonMessage,
      };
    case 'delete_file':
      if (hasFileOperationStepPath(path) === false) return null;
      return {
        currentTask: `删除文件 ${path} 失败`,
        completedTasks: localCacheNotMutated,
        nextAction: '检查删除失败原因后重试；当前 Explorer 仍保留目标文件以避免误判为已删除。',
        reasonMessage,
      };
    case 'rename_file':
      if (hasFileOperationRenamePaths(fromPath, toPath) === false) return null;
      return {
        currentTask: `重命名文件 ${fromPath} 失败`,
        completedTasks: localCacheNotMutated,
        nextAction: '检查重命名失败原因后重试；当前 Explorer 仍保留原路径以避免误判为已移动。',
        reasonMessage: `${reasonMessage}；目标路径：${toPath}`,
      };
    case 'create_directory':
      if (hasFileOperationStepPath(path) === false) return null;
      return {
        currentTask: `创建目录 ${path} 失败`,
        completedTasks: localPreviewMayBeStale,
        nextAction: '检查创建目录失败原因后重试；如 Explorer 显示了未落盘目录，刷新文件树校准后端真源。',
        reasonMessage,
      };
    case 'delete_directory':
      if (hasFileOperationStepPath(path) === false) return null;
      return {
        currentTask: `删除目录 ${path} 失败`,
        completedTasks: localCacheNotMutated,
        nextAction: '检查删除目录失败原因后重试；当前 Explorer 仍保留目标目录以避免误判为已删除。',
        reasonMessage,
      };
    default:
      return null;
  }
}

export function buildFailedWorkspaceFileOperationStepState(
  step: WorkflowStep,
): WorkspaceEngineeringStateSnapshot | undefined {
  if (step.status !== 'failed') return undefined;

  const meta = getFileOperationFailureMeta(step);
  if (hasFileOperationFailureMeta(meta) === false) return undefined;

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
      current_task: meta.currentTask,
      completed_tasks: meta.completedTasks,
      blockers: [meta.reasonMessage],
      next_action: meta.nextAction,
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: meta.currentTask,
      next_action: meta.nextAction,
      pause_reason: 'workspace_file_operation_step_failed',
    },
    recovery: {
      blocked: false,
      reason_code: 'workspace_file_operation_step_failed',
      reason_message: meta.reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}
