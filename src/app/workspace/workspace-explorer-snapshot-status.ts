import type {
  ExplorerSnapshotStatus,
  ExplorerSnapshotStatusValue,
} from './workspace-types';

export type FreshExplorerSnapshotSource = 'project_detail' | 'file_tree_refresh' | 'manual_refresh' | 'workspace_bootstrap';

export type StaleExplorerSnapshotSource = 'file_tree_refresh' | 'manual_refresh';

export type StaleExplorerSnapshotFailureKind = 'refresh_failed' | 'manual_refresh_failed' | 'manual_refresh_unavailable';

type StaleExplorerSnapshotStatusOptions = {
  source: StaleExplorerSnapshotSource;
  previousStatus?: ExplorerSnapshotStatus | null;
  hasLocalSnapshot: boolean;
  reasonMessage: string;
  failureKind: StaleExplorerSnapshotFailureKind;
};

export type StaleExplorerSnapshotStatusResolutionOptions = {
  previousStatus?: ExplorerSnapshotStatus | null;
  hasLocalSnapshot: boolean;
};

export type StaleExplorerSnapshotMessageOptions = {
  status: ExplorerSnapshotStatusValue;
  reasonMessage: string;
  failureKind: StaleExplorerSnapshotFailureKind;
};

type ExplorerLocalFileOperationSnapshotStatusOptions = {
  operationLabel: string;
  path: string;
  targetPath?: string;
  frontendRefreshFailure: string;
};

type ExplorerImplementationStreamSnapshotStatusOptions = {
  kind: string;
  status?: string;
  path?: string;
  fromPath?: string;
  toPath?: string;
};

function resolveFreshExplorerMessage(source: FreshExplorerSnapshotSource, itemCount: number) {
  if (source === 'project_detail') {
    return itemCount > 0
      ? '项目详情已同步原始文件树。'
      : '项目详情已同步，后端返回的文件树为空。';
  }

  if (source === 'file_tree_refresh') {
    return itemCount > 0
      ? 'Explorer 文件树已从后端真源刷新。'
      : 'Explorer 文件树已刷新，后端当前返回空文件树。';
  }

  if (source === 'manual_refresh') {
    return 'Explorer 已通过手动刷新从后端真源重新拉取文件树。';
  }

  return itemCount > 0
    ? 'Workspace 初始化已恢复原始文件树。'
    : 'Workspace 初始化已完成，恢复出的文件树为空。';
}

function resolveStaleExplorerStatus({
  previousStatus,
  hasLocalSnapshot,
}: StaleExplorerSnapshotStatusResolutionOptions): ExplorerSnapshotStatusValue {
  if (previousStatus?.status === 'stale_with_stream_preview') {
    return 'stale_with_stream_preview';
  }

  if (previousStatus?.status === 'stale_with_local_changes') {
    return 'stale_with_local_changes';
  }

  if (hasLocalSnapshot || previousStatus?.status === 'fresh' || previousStatus?.status === 'stale_with_snapshot') {
    return 'stale_with_snapshot';
  }

  return 'stale_without_snapshot';
}

function resolveStaleExplorerMessage({
  status,
  reasonMessage,
  failureKind,
}: StaleExplorerSnapshotMessageOptions) {
  if (failureKind === 'manual_refresh_unavailable') {
    if (status === 'stale_with_stream_preview') {
      return `${reasonMessage}当前 Explorer 包含 Implementation 生成流本地预览，但无法刷新后端真源。`;
    }

    if (status === 'stale_with_local_changes') {
      return `${reasonMessage}当前 Explorer 包含本地文件事务反映，但无法刷新后端真源。`;
    }

    if (status === 'stale_with_snapshot') {
      return `${reasonMessage}当前 Explorer 仍显示本地旧快照。`;
    }

    return `${reasonMessage}当前 Explorer 没有可确认的后端文件树快照。`;
  }

  if (failureKind === 'manual_refresh_failed') {
    if (status === 'stale_with_stream_preview') {
      return `Explorer 重新刷新失败：${reasonMessage}。当前目录树包含 Implementation 生成流本地预览，但后端真源仍未确认。`;
    }

    if (status === 'stale_with_local_changes') {
      return `Explorer 重新刷新失败：${reasonMessage}。当前目录树包含本地文件事务反映，但后端真源仍未确认。`;
    }

    if (status === 'stale_with_snapshot') {
      return `Explorer 重新刷新失败：${reasonMessage}。当前 Explorer 仍显示上一次成功同步的旧快照。`;
    }

    return `Explorer 重新刷新失败：${reasonMessage}。当前 Explorer 没有可确认的后端文件树快照。`;
  }

  if (status === 'stale_with_stream_preview') {
    return `文件树刷新失败：${reasonMessage}。当前 Explorer 包含 Implementation 生成流本地预览，但后端真源仍未确认。`;
  }

  if (status === 'stale_with_local_changes') {
    return `文件树刷新失败：${reasonMessage}。当前 Explorer 包含本地文件事务反映，但后端真源仍未确认。`;
  }

  if (status === 'stale_with_snapshot') {
    return `文件树刷新失败：${reasonMessage}。当前 Explorer 仍显示上一次成功同步的旧快照。`;
  }

  return `文件树刷新失败：${reasonMessage}。当前 Explorer 没有可确认的后端文件树快照。`;
}

function getExplorerImplementationStreamPath(path: string | undefined): string {
  const hasPath = path !== undefined;
  if (hasPath === false) {
    return '';
  }

  return path.trim();
}

export function buildFreshExplorerSnapshotStatus({
  source,
  itemCount,
}: {
  source: FreshExplorerSnapshotSource;
  itemCount: number;
}): ExplorerSnapshotStatus {
  return {
    status: 'fresh',
    source,
    message: resolveFreshExplorerMessage(source, itemCount),
    updatedAt: new Date().toISOString(),
  };
}

export function buildStaleExplorerSnapshotStatus(options: StaleExplorerSnapshotStatusOptions): ExplorerSnapshotStatus {
  const status = resolveStaleExplorerStatus(options);

  return {
    status,
    source: options.source,
    message: resolveStaleExplorerMessage({
      status,
      reasonMessage: options.reasonMessage,
      failureKind: options.failureKind,
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function buildExplorerLocalFileOperationSnapshotStatus({
  operationLabel,
  path,
  targetPath,
  frontendRefreshFailure,
}: ExplorerLocalFileOperationSnapshotStatusOptions): ExplorerSnapshotStatus {
  return {
    status: 'stale_with_local_changes',
    source: 'local_file_operation',
    message: `Explorer 已先反映本地${operationLabel}事务：${path}${targetPath ? ` -> ${targetPath}` : ''}；但后端真源刷新失败：${frontendRefreshFailure}。当前目录树包含本地事务反映，不能当作完整后端文件树快照。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildExplorerImplementationStreamSnapshotStatus({
  kind,
  status,
  path,
  fromPath,
  toPath,
}: ExplorerImplementationStreamSnapshotStatusOptions): ExplorerSnapshotStatus | null {
  const normalizedPath = getExplorerImplementationStreamPath(path);
  const normalizedFromPath = getExplorerImplementationStreamPath(fromPath);
  const normalizedToPath = getExplorerImplementationStreamPath(toPath);
  const hasNormalizedPath = normalizedPath.length > 0;
  const hasNormalizedFromPath = normalizedFromPath.length > 0;
  const hasNormalizedToPath = normalizedToPath.length > 0;
  const statusLabel = status === 'running' ? '正在流式预览' : '已应用到本地 Workspace';

  switch (kind) {
    case 'create_file':
    case 'write_file':
    case 'create_directory':
    case 'delete_file':
    case 'delete_directory':
      if (hasNormalizedPath === false) return null;
      return {
        status: 'stale_with_stream_preview',
        source: 'implementation_stream',
        message: `Implementation 文件操作 ${statusLabel}：${normalizedPath}。当前 Explorer/编辑器包含生成流本地预览，需等待最终文件树刷新成功后再视为后端真源快照。`,
        updatedAt: new Date().toISOString(),
      };
    case 'rename_file':
      if (hasNormalizedFromPath === false || hasNormalizedToPath === false) return null;
      return {
        status: 'stale_with_stream_preview',
        source: 'implementation_stream',
        message: `Implementation 文件操作 ${statusLabel}：${normalizedFromPath} -> ${normalizedToPath}。当前 Explorer/编辑器包含生成流本地预览，需等待最终文件树刷新成功后再视为后端真源快照。`,
        updatedAt: new Date().toISOString(),
      };
    default:
      return null;
  }
}
