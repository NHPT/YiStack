'use client';

import type { FileNode } from '@/lib/types';
import { cn } from '@/lib/utils';

import type {
  EditorBufferStatus,
  EditorBufferStatusValue,
  ExplorerPanelSnapshot,
  ExplorerPanelSnapshotSource,
  ExplorerPanelSnapshotStatus,
  ExplorerSnapshotStatus,
  ExplorerSnapshotStatusValue,
  WorkspaceOpenFilePathList,
} from './workspace-types';

type ExplorerPanelBooleanFactList = readonly boolean[];
type ExplorerPanelSnapshotStatusList = readonly ExplorerPanelSnapshotStatus[];
type ExplorerSnapshotHealthStatusList = readonly ExplorerSnapshotStatusValue[];

const EXPLORER_PANEL_STALE_HEALTH_STATUSES: ExplorerSnapshotHealthStatusList = [
  'stale_with_snapshot',
  'stale_without_snapshot',
];

const EXPLORER_PANEL_SNAPSHOT_SOURCE_STATUSES: ExplorerPanelSnapshotStatusList = [
  'stream_preview',
  'local_changes',
  'stale_snapshot',
];

const EXPLORER_PANEL_EDITOR_BUFFER_SOURCE_STATUSES: ExplorerPanelSnapshotStatusList = [
  'active_dirty',
  'active_stale',
];

const EXPLORER_PANEL_WARNING_STATUSES: ExplorerPanelSnapshotStatusList = [
  'stale_snapshot',
  'local_changes',
  'stream_preview',
  'active_dirty',
  'active_stale',
];

const EXPLORER_PANEL_EMPTY_STATUSES: ExplorerPanelSnapshotStatusList = [
  'empty_tree',
  'filtered_empty',
];

function hasExplorerPanelTrueFact(values: ExplorerPanelBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function isExplorerSnapshotHealthStatusIn(
  status: ExplorerSnapshotStatusValue,
  statuses: ExplorerSnapshotHealthStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isExplorerPanelSnapshotStatusIn(
  status: ExplorerPanelSnapshotStatus,
  statuses: ExplorerPanelSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getExplorerPanelBufferStatusLabel(
  activeFileBufferStatus: EditorBufferStatus | null,
): EditorBufferStatusValue | 'none' {
  const hasActiveFileBufferStatus = activeFileBufferStatus !== null;

  return hasActiveFileBufferStatus === true ? activeFileBufferStatus.status : 'none';
}

function countFileTreeItems(nodes: FileNode[]): number {
  let total = 0;

  for (const node of nodes) {
    total += 1;
    total += countFileTreeItems(getExplorerPanelFileNodeChildren(node));
  }

  return total;
}

function getExplorerPanelFileNodeChildren(node: FileNode): FileNode[] {
  if (node.children === undefined) {
    return [];
  }

  return node.children;
}

function hasExplorerPanelItems(filteredTree: FileNode[]): boolean {
  const hasItems = filteredTree.length > 0;
  return hasItems === true;
}

function hasExplorerPanelTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getExplorerPanelSnapshotStatus({
  explorerSnapshotStatus,
  isActiveDirty,
  activeBufferStatus,
  hasFilteredItems,
  hasOriginalFileTreeData,
}: {
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  isActiveDirty: boolean;
  activeBufferStatus: EditorBufferStatusValue | 'none';
  hasFilteredItems: boolean;
  hasOriginalFileTreeData: boolean;
}): ExplorerPanelSnapshotStatus {
  const explorerHealthStatus = explorerSnapshotStatus?.status;

  if (explorerHealthStatus === 'stale_with_stream_preview') {
    return 'stream_preview';
  }

  if (explorerHealthStatus === 'stale_with_local_changes') {
    return 'local_changes';
  }

  if (explorerHealthStatus !== undefined) {
    const hasStaleHealthStatus = isExplorerSnapshotHealthStatusIn(
      explorerHealthStatus,
      EXPLORER_PANEL_STALE_HEALTH_STATUSES,
    );
    if (hasStaleHealthStatus === true) {
      return 'stale_snapshot';
    }
  }

  const hasActiveDirtyStatus = hasExplorerPanelTrueFact([
    isActiveDirty,
    activeBufferStatus === 'dirty_buffer',
  ]);
  if (hasActiveDirtyStatus === true) {
    return 'active_dirty';
  }

  if (activeBufferStatus === 'stale_from_cache') {
    return 'active_stale';
  }

  if (hasFilteredItems === false && hasOriginalFileTreeData === true) {
    return 'filtered_empty';
  }

  if (hasFilteredItems === false) {
    return 'empty_tree';
  }

  return 'ready';
}

function getExplorerPanelSnapshotSource({
  status,
  hasOpenFiles,
  hasActiveFile,
}: {
  status: ExplorerPanelSnapshotStatus;
  hasOpenFiles: boolean;
  hasActiveFile: boolean;
}): ExplorerPanelSnapshotSource {
  const hasExplorerSnapshotSource = isExplorerPanelSnapshotStatusIn(
    status,
    EXPLORER_PANEL_SNAPSHOT_SOURCE_STATUSES,
  );
  if (hasExplorerSnapshotSource === true) {
    return 'explorer_snapshot';
  }

  const hasEditorBufferSource = isExplorerPanelSnapshotStatusIn(
    status,
    EXPLORER_PANEL_EDITOR_BUFFER_SOURCE_STATUSES,
  );
  if (hasEditorBufferSource === true) {
    return 'editor_buffer';
  }

  if (status === 'filtered_empty') {
    return 'search_filter';
  }

  const hasOpenFileSource = hasExplorerPanelTrueFact([hasOpenFiles, hasActiveFile]);
  if (hasOpenFileSource === true) {
    return 'open_files';
  }

  return 'file_tree';
}

export function buildExplorerPanelSnapshot({
  filteredTree,
  hasOriginalFileTreeData,
  explorerSnapshotStatus,
  searchQuery,
  activeFile,
  openFiles,
  activeFileBufferStatus,
  isActiveDirty,
}: {
  filteredTree: FileNode[];
  hasOriginalFileTreeData: boolean;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  searchQuery: string;
  activeFile: string | null;
  openFiles: WorkspaceOpenFilePathList;
  activeFileBufferStatus: EditorBufferStatus | null;
  isActiveDirty: boolean;
}): ExplorerPanelSnapshot {
  const normalizedSearch = searchQuery.trim();
  const filteredItemCount = countFileTreeItems(filteredTree);
  const activeBufferStatus = getExplorerPanelBufferStatusLabel(activeFileBufferStatus);
  const hasActiveFile = hasExplorerPanelTextValue(activeFile);
  const hasOpenFiles = openFiles.length > 0;
  const hasFilteredItems = hasExplorerPanelItems(filteredTree);
  const activeFileLabel = hasActiveFile === true ? activeFile : 'none';
  const hasSearchQuery = hasExplorerPanelTextValue(normalizedSearch);
  const searchQueryLabel = hasSearchQuery === true ? normalizedSearch : 'none';
  const status = getExplorerPanelSnapshotStatus({
    explorerSnapshotStatus,
    isActiveDirty,
    activeBufferStatus,
    hasFilteredItems,
    hasOriginalFileTreeData,
  });
  const source = getExplorerPanelSnapshotSource({
    status,
    hasOpenFiles,
    hasActiveFile,
  });
  const hasRefreshRecoveryStatus = isExplorerPanelSnapshotStatusIn(
    status,
    EXPLORER_PANEL_SNAPSHOT_SOURCE_STATUSES,
  );

  return {
    status,
    source,
    hasOriginalFileTreeData,
    filteredItemCount,
    openFileCount: openFiles.length,
    hasActiveFile,
    activeFile: activeFileLabel,
    activeBufferStatus,
    isActiveDirty,
    searchQuery: searchQueryLabel,
    message: status === 'stream_preview'
      ? 'Explorer 包含 Implementation 生成流本地预览。'
      : status === 'local_changes'
        ? 'Explorer 包含本地文件事务反映。'
        : status === 'stale_snapshot'
          ? 'Explorer 当前不是已确认的最新后端文件树。'
          : status === 'active_dirty'
            ? '当前编辑器文件包含未保存修改。'
            : status === 'active_stale'
              ? '当前编辑器文件来自缓存快照。'
              : status === 'filtered_empty'
                ? '当前搜索条件没有匹配文件。'
                : status === 'empty_tree'
                  ? '当前没有可展示的文件树数据。'
                  : 'Explorer 面板已就绪。',
    recovery: hasRefreshRecoveryStatus === true
      ? '刷新 Explorer 校准后端文件树真源。'
      : status === 'active_dirty'
        ? '保存或放弃当前文件修改后再依赖后端真源。'
        : status === 'active_stale'
          ? '重新读取文件或刷新 Explorer，确认最新后端内容。'
          : status === 'filtered_empty'
            ? '清空搜索条件或调整关键词查看完整文件树。'
            : status === 'empty_tree'
              ? '刷新 Explorer，确认后端是否已返回文件树。'
              : '可继续选择文件、编辑内容或执行文件事务。',
    updatedAt: 'derived',
  };
}

function getExplorerPanelSnapshotClassName(snapshot: ExplorerPanelSnapshot) {
  const hasWarningStatus = isExplorerPanelSnapshotStatusIn(snapshot.status, EXPLORER_PANEL_WARNING_STATUSES);
  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  const hasEmptyStatus = isExplorerPanelSnapshotStatusIn(snapshot.status, EXPLORER_PANEL_EMPTY_STATUSES);
  if (hasEmptyStatus === true) {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function getExplorerPanelSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function ExplorerPanelSnapshotStrip({ snapshot }: { snapshot: ExplorerPanelSnapshot }) {
  const hasOriginalFileTreeDataLabel = getExplorerPanelSnapshotBooleanLabel(snapshot.hasOriginalFileTreeData);
  const hasActiveFileLabel = getExplorerPanelSnapshotBooleanLabel(snapshot.hasActiveFile);
  const isActiveDirtyLabel = getExplorerPanelSnapshotBooleanLabel(snapshot.isActiveDirty);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-explorer-panel-snapshot"
      className={cn('mx-3 mb-2 rounded-md border px-2.5 py-2 text-xs', getExplorerPanelSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Explorer 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Original: {hasOriginalFileTreeDataLabel}</span>
        <span>Filtered: {snapshot.filteredItemCount}</span>
        <span>Open: {snapshot.openFileCount}</span>
        <span>Active: {hasActiveFileLabel}</span>
        <span>Buffer: {snapshot.activeBufferStatus}</span>
        <span>Dirty: {isActiveDirtyLabel}</span>
        <span>Search: {snapshot.searchQuery}</span>
      </div>
      <p className="mt-1 truncate">File: {snapshot.activeFile}</p>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
