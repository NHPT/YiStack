'use client';

import { cn } from '@/lib/utils';

import type {
  EditorBufferStatus,
  EditorBufferStatusValue,
  EditorPanelSnapshot,
  EditorPanelSnapshotSource,
  EditorPanelSnapshotStatus,
  WorkspaceEditorNavigationTarget,
  WorkspacePanelSurface,
} from './workspace-types';

type EditorPanelBooleanFactList = readonly boolean[];
type EditorPanelSnapshotStatusList = readonly EditorPanelSnapshotStatus[];

const EDITOR_PANEL_WARNING_STATUSES: EditorPanelSnapshotStatusList = [
  'dirty',
  'stale_from_cache',
  'local_preview',
  'navigation_pending',
];

function hasEditorPanelTrueFact(values: EditorPanelBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function isEditorPanelSnapshotStatusIn(
  status: EditorPanelSnapshotStatus,
  statuses: EditorPanelSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getEditorPanelBufferStatusLabel(
  editorBufferStatus: EditorBufferStatus | null,
): EditorBufferStatusValue | 'none' {
  const hasEditorBufferStatus = editorBufferStatus !== null;

  return hasEditorBufferStatus === true ? editorBufferStatus.status : 'none';
}

function hasEditorPanelActiveFile(activeFile: string | null): boolean {
  if (activeFile === null) {
    return false;
  }

  const hasActiveFile = activeFile.length > 0;
  return hasActiveFile === true;
}

function getEditorPanelActiveFileLabel({
  hasActiveFile,
  activeFile,
}: {
  hasActiveFile: boolean;
  activeFile: string | null;
}): string {
  if (hasActiveFile === false) {
    return 'none';
  }

  if (activeFile === null) {
    return 'none';
  }

  return activeFile;
}

function hasEditorPanelNavigationTarget({
  hasActiveFile,
  activeFile,
  editorNavigationTarget,
}: {
  hasActiveFile: boolean;
  activeFile: string | null;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
}): boolean {
  if (hasActiveFile === false) {
    return false;
  }

  if (activeFile === null) {
    return false;
  }

  if (editorNavigationTarget === null) {
    return false;
  }

  const hasMatchedPath = editorNavigationTarget.path === activeFile;
  return hasMatchedPath === true;
}

function canSaveEditorPanel({
  hasActiveFile,
  isDirty,
}: {
  hasActiveFile: boolean;
  isDirty: boolean;
}): boolean {
  if (hasActiveFile === false) {
    return false;
  }

  return isDirty === true;
}

function hasEditorPanelDirtyStatus({
  isDirty,
  bufferStatus,
}: {
  isDirty: boolean;
  bufferStatus: EditorBufferStatusValue | 'none';
}): boolean {
  return hasEditorPanelTrueFact([isDirty, bufferStatus === 'dirty_buffer']);
}

function getEditorPanelSnapshotStatus({
  hasActiveFile,
  hasNavigationTarget,
  hasDirtyStatus,
  bufferStatus,
}: {
  hasActiveFile: boolean;
  hasNavigationTarget: boolean;
  hasDirtyStatus: boolean;
  bufferStatus: EditorBufferStatusValue | 'none';
}): EditorPanelSnapshotStatus {
  if (hasActiveFile === false) {
    return 'empty';
  }

  if (hasNavigationTarget === true) {
    return 'navigation_pending';
  }

  if (hasDirtyStatus === true) {
    return 'dirty';
  }

  if (bufferStatus === 'stale_from_cache') {
    return 'stale_from_cache';
  }

  if (bufferStatus === 'local_preview') {
    return 'local_preview';
  }

  if (bufferStatus === 'saved_snapshot') {
    return 'saved_snapshot';
  }

  return 'clean';
}

function getEditorPanelSnapshotSource({
  status,
  bufferStatus,
}: {
  status: EditorPanelSnapshotStatus;
  bufferStatus: EditorBufferStatusValue | 'none';
}): EditorPanelSnapshotSource {
  if (status === 'empty') {
    return 'empty_editor';
  }

  if (status === 'navigation_pending') {
    return 'navigation_target';
  }

  if (status === 'dirty') {
    return 'dirty_state';
  }

  if (bufferStatus !== 'none') {
    return 'editor_buffer';
  }

  return 'active_file';
}

function getEditorPanelSnapshotMessage(status: EditorPanelSnapshotStatus): string {
  if (status === 'empty') {
    return '当前没有打开的编辑器文件。';
  }

  if (status === 'navigation_pending') {
    return '编辑器正在等待定位到指定文件位置。';
  }

  if (status === 'dirty') {
    return '当前文件包含未保存编辑器 buffer。';
  }

  if (status === 'stale_from_cache') {
    return '当前文件内容来自缓存快照。';
  }

  if (status === 'local_preview') {
    return '当前文件内容来自本地预览。';
  }

  if (status === 'saved_snapshot') {
    return '当前文件已对齐最近保存快照。';
  }

  return '当前编辑器文件已就绪。';
}

function getEditorPanelSnapshotRecovery(status: EditorPanelSnapshotStatus): string {
  if (status === 'empty') {
    return '从 Explorer 选择文件后再查看或编辑内容。';
  }

  if (status === 'navigation_pending') {
    return '等待编辑器定位完成；若未跳转，重新触发打开目标文件。';
  }

  if (status === 'dirty') {
    return '保存文件以写入后端快照，或关闭文件时确认丢弃修改。';
  }

  if (status === 'stale_from_cache') {
    return '重新读取文件或刷新 Explorer，确认最新后端内容。';
  }

  if (status === 'local_preview') {
    return '保存或刷新文件，确认本地预览是否需要写入后端。';
  }

  return '可继续编辑、复制或通过 Explorer 切换文件。';
}

export function buildEditorPanelSnapshot({
  surface,
  activeFile,
  content,
  editorBufferStatus,
  isDirty,
  editorNavigationTarget,
}: {
  surface: WorkspacePanelSurface;
  activeFile: string | null;
  content: string;
  editorBufferStatus: EditorBufferStatus | null;
  isDirty: boolean;
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null;
}): EditorPanelSnapshot {
  const hasActiveFile = hasEditorPanelActiveFile(activeFile);
  const hasNavigationTarget = hasEditorPanelNavigationTarget({
    hasActiveFile,
    activeFile,
    editorNavigationTarget,
  });
  const canSave = canSaveEditorPanel({ hasActiveFile, isDirty });
  const canCopy = hasActiveFile === true;
  const bufferStatus = getEditorPanelBufferStatusLabel(editorBufferStatus);
  const activeFileLabel = getEditorPanelActiveFileLabel({ hasActiveFile, activeFile });
  const hasDirtyStatus = hasEditorPanelDirtyStatus({ isDirty, bufferStatus });
  const status = getEditorPanelSnapshotStatus({
    hasActiveFile,
    hasNavigationTarget,
    hasDirtyStatus,
    bufferStatus,
  });
  const source = getEditorPanelSnapshotSource({ status, bufferStatus });
  const message = getEditorPanelSnapshotMessage(status);
  const recovery = getEditorPanelSnapshotRecovery(status);

  return {
    status,
    source,
    surface,
    activeFile: activeFileLabel,
    bufferStatus,
    isDirty,
    canSave,
    canCopy,
    hasNavigationTarget,
    contentLength: content.length,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getEditorPanelSnapshotClassName(snapshot: EditorPanelSnapshot) {
  const hasWarningStatus = isEditorPanelSnapshotStatusIn(snapshot.status, EDITOR_PANEL_WARNING_STATUSES);
  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'empty') {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function getEditorPanelSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function EditorPanelSnapshotStrip({ snapshot }: { snapshot: EditorPanelSnapshot }) {
  const isDirtyLabel = getEditorPanelSnapshotBooleanLabel(snapshot.isDirty);
  const canSaveLabel = getEditorPanelSnapshotBooleanLabel(snapshot.canSave);
  const canCopyLabel = getEditorPanelSnapshotBooleanLabel(snapshot.canCopy);
  const hasNavigationTargetLabel = getEditorPanelSnapshotBooleanLabel(snapshot.hasNavigationTarget);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-editor-panel-snapshot"
      className={cn('mx-3 mt-2 rounded-md border px-2.5 py-2 text-xs', getEditorPanelSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Editor 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Surface: {snapshot.surface}</span>
        <span>Buffer: {snapshot.bufferStatus}</span>
        <span>Dirty: {isDirtyLabel}</span>
        <span>CanSave: {canSaveLabel}</span>
        <span>CanCopy: {canCopyLabel}</span>
        <span>Navigation: {hasNavigationTargetLabel}</span>
        <span>Chars: {snapshot.contentLength}</span>
      </div>
      <p className="mt-1 truncate">File: {snapshot.activeFile}</p>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
