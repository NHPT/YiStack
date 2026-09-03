import { useCallback } from 'react';
import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';

import type { WorkflowStep, WorkflowStepMeta } from '@/components/workspace/chat-message-content';
import { projectApi } from '@/lib/api';
import type { ProjectFileOperationResponse } from '@/lib/api';
import type { FileNode, FileNodeType } from '@/lib/types';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';
import { formatWorkspaceResourceOperationFailure } from '@/lib/workspace/workspace-resource-operation-errors';

import {
  buildExplorerImplementationStreamSnapshotStatus,
  buildExplorerLocalFileOperationSnapshotStatus,
} from './workspace-explorer-snapshot-status';
import { getWorkspaceExplorerContextOperationLabel } from './workspace-explorer-context-operation-labels';
import {
  buildImplementationStreamEditorBufferStatus,
  buildLocalFileOperationEditorBufferStatus,
  buildOpenFileCacheEditorBufferStatus,
  buildOpenFileSavedSnapshotEditorBufferStatus,
} from './workspace-editor-buffer-status';
import {
  getWorkspaceEditorBufferContent,
  isWorkspaceEditorBufferDirty,
} from './workspace-editor-buffer-content';
import type { WorkspaceIdeInteractionsContract } from './workspace-ide-interactions-contract';
import type {
  EditorBufferStatus,
  GuidanceAction,
  ExplorerSnapshotStatus,
  WorkspaceChatMessage,
  WorkspaceContextMenu,
  WorkspaceEditorNavigationTarget,
  WorkspaceExplorerContextOperation,
  WorkspaceExplorerContextOperationInput,
  WorkspaceOpenFilePathList,
  WorkspaceProjectInfo,
} from './workspace-types';

type UseWorkspaceIdeInteractionsOptions = {
  projectInfo: WorkspaceProjectInfo | null;
  activeFile: string | null;
  openFiles: WorkspaceOpenFilePathList;
  mobileEditingFile: string | null;
  isMobile: boolean;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  editorBufferStatuses: Map<string, EditorBufferStatus>;
  refreshProjectFileTree: (
    projectId: string,
    force?: boolean,
    options?: { throwOnFailure?: boolean; suppressNotice?: boolean },
  ) => Promise<void>;
  setExplorerSnapshotStatus: Dispatch<SetStateAction<ExplorerSnapshotStatus | null>>;
  setFileTree: Dispatch<SetStateAction<FileNode[]>>;
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setEditorBufferStatuses: Dispatch<SetStateAction<Map<string, EditorBufferStatus>>>;
  setOpenFiles: Dispatch<SetStateAction<WorkspaceOpenFilePathList>>;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  setEditorNavigationTarget: Dispatch<SetStateAction<WorkspaceEditorNavigationTarget | null>>;
  setMobileEditingFile: Dispatch<SetStateAction<string | null>>;
  setMobileFileContent: Dispatch<SetStateAction<string>>;
  applyIdeInteractionMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  pendingCloseFile: string | null;
  setPendingCloseFile: Dispatch<SetStateAction<string | null>>;
  setContextMenu: Dispatch<SetStateAction<WorkspaceContextMenu | null>>;
  showExplorerTab: () => void;
  upsertFilePathIntoTree: (nodes: FileNode[], filePath: string, leafType?: FileNodeType) => FileNode[];
  removeFilePathFromTree: (nodes: FileNode[], targetPath: string) => FileNode[];
  renameFilePathInTree: (nodes: FileNode[], fromPath: string, toPath: string, leafType?: FileNodeType) => FileNode[];
};

type ExplorerRenameLocalMigrationSummary = {
  dirtyBufferCount: number;
  savedSnapshotCount: number;
  openFileCount: number;
  activeFileMigrated: boolean;
  mobileEditingFileMigrated: boolean;
  pendingCloseFileMigrated: boolean;
};

type ExplorerCreateLocalApplySummary = {
  path: string;
  nodeType: FileNodeType;
  treeReflected: boolean;
  editorBufferCreated: boolean;
};

type ExplorerDeleteLocalCleanupSummary = {
  dirtyBufferCount: number;
  savedSnapshotCount: number;
  openFileCount: number;
  activeFileCleared: boolean;
  mobileEditingFileCleared: boolean;
  pendingCloseFileCleared: boolean;
};

type ExplorerContextOperationNoticeSegment = string;
type ExplorerContextOperationNoticeSegmentList = ExplorerContextOperationNoticeSegment[];
type WorkspaceIdeInteractionDirtyReader = (path: string) => boolean;
type WorkspaceIdeInteractionDescendantPathMatcher = (candidate: string, targetPath: string) => boolean;
type ExplorerDeleteLocalCleanupPointerReader = (candidate: string | null, targetPath: string) => boolean;
type WorkspaceIdeInteractionOpenFileTarget = string | WorkspaceEditorNavigationTarget;
type WorkspaceIdeInteractionPathContentMap = Map<string, string>;
type WorkspaceIdeInteractionEditorStatusMap = Map<string, EditorBufferStatus>;

type ExplorerRenameLocalMigrationInput = {
  isRenameOperation: boolean;
  sourcePath: string;
  targetPath: string | undefined;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  openFiles: WorkspaceOpenFilePathList;
  activeFile: string | null;
  mobileEditingFile: string | null;
  pendingCloseFile: string | null;
  isFileDirty: WorkspaceIdeInteractionDirtyReader;
};

type ExplorerCreateLocalApplyInput = {
  isCreateOperation: boolean;
  operation: WorkspaceExplorerContextOperation;
  path: string;
};

type ExplorerDeleteLocalCleanupInput = {
  isDeleteOperation: boolean;
  path: string;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  openFiles: WorkspaceOpenFilePathList;
  activeFile: string | null;
  mobileEditingFile: string | null;
  pendingCloseFile: string | null;
  isFileDirty: WorkspaceIdeInteractionDirtyReader;
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher;
  isExplorerDeleteLocalCleanupPointerCleared: ExplorerDeleteLocalCleanupPointerReader;
};

function hasExplorerContextOperationNoticeSegment(
  segment: ExplorerContextOperationNoticeSegment | null | undefined,
): segment is ExplorerContextOperationNoticeSegment {
  if (segment === null || segment === undefined) {
    return false;
  }

  const hasSegment = segment.length > 0;
  return hasSegment === true;
}

function getExplorerContextOperationNoticeSegments(
  segments: Array<ExplorerContextOperationNoticeSegment | null | undefined>,
): ExplorerContextOperationNoticeSegmentList {
  const noticeSegments: ExplorerContextOperationNoticeSegmentList = [];
  for (const segment of segments) {
    const hasSegment = hasExplorerContextOperationNoticeSegment(segment);
    if (hasSegment === true) {
      noticeSegments.push(segment);
    }
  }

  return noticeSegments;
}

function hasWorkspaceIdeInteractionTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceIdeInteractionTrimmedTextValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();
  const hasValue = hasWorkspaceIdeInteractionTextValue(normalizedValue);
  if (hasValue === true) {
    return normalizedValue;
  }

  return null;
}

function getWorkspaceIdeInteractionPersistedProject(
  projectInfo: WorkspaceProjectInfo | null,
): WorkspaceProjectInfo | null {
  if (projectInfo === null) {
    return null;
  }

  const isPersistedProject = projectInfo.isPersisted === true;
  if (isPersistedProject === false) {
    return null;
  }

  const hasProjectId = hasWorkspaceIdeInteractionTextValue(projectInfo.projectId);
  if (hasProjectId === false) {
    return null;
  }

  return projectInfo;
}

function getWorkspaceIdeInteractionOperationPath(
  inputPath: string | undefined,
  nodePath: string,
): string {
  const normalizedInputPath = getWorkspaceIdeInteractionTrimmedTextValue(inputPath);
  if (normalizedInputPath !== null) {
    return normalizedInputPath;
  }

  return nodePath;
}

function getWorkspaceIdeInteractionTargetPath(targetPath: string | undefined): string | undefined {
  const normalizedTargetPath = getWorkspaceIdeInteractionTrimmedTextValue(targetPath);
  if (normalizedTargetPath !== null) {
    return normalizedTargetPath;
  }

  return undefined;
}

function getWorkspaceIdeInteractionOperationContent(content: string | undefined): string {
  if (content === undefined) {
    return '';
  }

  return content;
}

function getWorkspaceIdeInteractionWorkflowStepTextMeta(
  meta: WorkflowStepMeta | undefined,
  fieldName: string,
): string {
  if (meta === undefined) {
    return '';
  }

  const value = meta[fieldName];
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function getWorkspaceIdeInteractionWorkflowStepContentMeta(
  meta: WorkflowStepMeta | undefined,
  fieldName: string,
): string {
  if (meta === undefined) {
    return '';
  }

  const value = meta[fieldName];
  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

function isWorkspaceIdeInteractionRenameOperation(operation: WorkspaceExplorerContextOperation): boolean {
  const isRenameOperation = operation === 'rename_file' || operation === 'rename_directory';
  return isRenameOperation === true;
}

function isWorkspaceIdeInteractionCreateOperation(operation: WorkspaceExplorerContextOperation): boolean {
  const isCreateOperation = operation === 'create_file' || operation === 'create_directory';
  return isCreateOperation === true;
}

function isWorkspaceIdeInteractionDeleteOperation(operation: WorkspaceExplorerContextOperation): boolean {
  const isDeleteOperation = operation === 'delete_file' || operation === 'delete_directory';
  return isDeleteOperation === true;
}

function hasWorkspaceIdeInteractionTargetPath(targetPath: string | undefined): targetPath is string {
  if (targetPath === undefined) {
    return false;
  }

  return true;
}

function getWorkspaceIdeInteractionStructuredStatusLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const hasValue = hasWorkspaceIdeInteractionTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getWorkspaceIdeInteractionMigratedPath(
  candidatePath: string,
  sourcePath: string,
  targetPath: string,
): string {
  const migratedPath = renameWorkspacePathAfterOperation(candidatePath, sourcePath, targetPath);
  if (migratedPath !== null) {
    return migratedPath;
  }

  return candidatePath;
}

function hasWorkspaceIdeInteractionPathMigration(
  candidatePath: string | null,
  sourcePath: string,
  targetPath: string,
): boolean {
  const migratedPath = renameWorkspacePathAfterOperation(candidatePath, sourcePath, targetPath);
  const hasMigration = migratedPath !== candidatePath;
  return hasMigration === true;
}

function getExplorerRenameLocalMigrationDirtyBufferCount(
  files: Map<string, string>,
  sourcePath: string,
  targetPath: string,
  isFileDirty: WorkspaceIdeInteractionDirtyReader,
): number {
  let dirtyBufferCount = 0;
  for (const candidatePath of files.keys()) {
    const hasMigration = hasWorkspaceIdeInteractionPathMigration(candidatePath, sourcePath, targetPath);
    if (hasMigration === false) {
      continue;
    }

    const isDirty = isFileDirty(candidatePath);
    if (isDirty === true) {
      dirtyBufferCount += 1;
    }
  }

  return dirtyBufferCount;
}

function getExplorerRenameLocalMigrationSavedSnapshotCount(
  savedFiles: Map<string, string>,
  sourcePath: string,
  targetPath: string,
  isFileDirty: WorkspaceIdeInteractionDirtyReader,
): number {
  let savedSnapshotCount = 0;
  for (const candidatePath of savedFiles.keys()) {
    const hasMigration = hasWorkspaceIdeInteractionPathMigration(candidatePath, sourcePath, targetPath);
    if (hasMigration === false) {
      continue;
    }

    const isDirty = isFileDirty(candidatePath);
    if (isDirty === false) {
      savedSnapshotCount += 1;
    }
  }

  return savedSnapshotCount;
}

function getExplorerRenameLocalMigrationOpenFileCount(
  openFiles: WorkspaceOpenFilePathList,
  sourcePath: string,
  targetPath: string,
): number {
  let openFileCount = 0;
  for (const candidatePath of openFiles) {
    const hasMigration = hasWorkspaceIdeInteractionPathMigration(candidatePath, sourcePath, targetPath);
    if (hasMigration === true) {
      openFileCount += 1;
    }
  }

  return openFileCount;
}

function getExplorerRenameLocalMigrationSummary(
  input: ExplorerRenameLocalMigrationInput,
): ExplorerRenameLocalMigrationSummary | undefined {
  if (input.isRenameOperation === false) {
    return undefined;
  }

  const targetPath = input.targetPath;
  const hasTargetPath = hasWorkspaceIdeInteractionTargetPath(targetPath);
  if (hasTargetPath === false) {
    return undefined;
  }

  return {
    dirtyBufferCount: getExplorerRenameLocalMigrationDirtyBufferCount(
      input.files,
      input.sourcePath,
      targetPath,
      input.isFileDirty,
    ),
    savedSnapshotCount: getExplorerRenameLocalMigrationSavedSnapshotCount(
      input.savedFiles,
      input.sourcePath,
      targetPath,
      input.isFileDirty,
    ),
    openFileCount: getExplorerRenameLocalMigrationOpenFileCount(
      input.openFiles,
      input.sourcePath,
      targetPath,
    ),
    activeFileMigrated: hasWorkspaceIdeInteractionPathMigration(input.activeFile, input.sourcePath, targetPath),
    mobileEditingFileMigrated: hasWorkspaceIdeInteractionPathMigration(input.mobileEditingFile, input.sourcePath, targetPath),
    pendingCloseFileMigrated: hasWorkspaceIdeInteractionPathMigration(input.pendingCloseFile, input.sourcePath, targetPath),
  };
}

function getExplorerLocalOperationNodeType(
  operation: WorkspaceExplorerContextOperation,
): FileNodeType {
  const isFileOperation = operation === 'create_file' || operation === 'rename_file';
  if (isFileOperation === true) {
    return 'file';
  }

  return 'directory';
}

function getExplorerCreateLocalApplySummary(
  input: ExplorerCreateLocalApplyInput,
): ExplorerCreateLocalApplySummary | undefined {
  if (input.isCreateOperation === false) {
    return undefined;
  }

  return {
    path: input.path,
    nodeType: getExplorerLocalOperationNodeType(input.operation),
    treeReflected: true,
    editorBufferCreated: false,
  };
}

function getExplorerDeleteLocalCleanupDirtyBufferCount(
  files: Map<string, string>,
  targetPath: string,
  isFileDirty: WorkspaceIdeInteractionDirtyReader,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): number {
  let dirtyBufferCount = 0;
  for (const candidatePath of files.keys()) {
    const isDeleteTarget = isSameOrDescendantPath(candidatePath, targetPath);
    if (isDeleteTarget === false) {
      continue;
    }

    const isDirty = isFileDirty(candidatePath);
    if (isDirty === true) {
      dirtyBufferCount += 1;
    }
  }

  return dirtyBufferCount;
}

function getExplorerDeleteLocalCleanupSavedSnapshotCount(
  savedFiles: Map<string, string>,
  targetPath: string,
  isFileDirty: WorkspaceIdeInteractionDirtyReader,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): number {
  let savedSnapshotCount = 0;
  for (const candidatePath of savedFiles.keys()) {
    const isDeleteTarget = isSameOrDescendantPath(candidatePath, targetPath);
    if (isDeleteTarget === false) {
      continue;
    }

    const isDirty = isFileDirty(candidatePath);
    if (isDirty === false) {
      savedSnapshotCount += 1;
    }
  }

  return savedSnapshotCount;
}

function getExplorerDeleteLocalCleanupOpenFileCount(
  openFiles: WorkspaceOpenFilePathList,
  targetPath: string,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): number {
  let openFileCount = 0;
  for (const candidatePath of openFiles) {
    const isDeleteTarget = isSameOrDescendantPath(candidatePath, targetPath);
    if (isDeleteTarget === true) {
      openFileCount += 1;
    }
  }

  return openFileCount;
}

function getExplorerDeleteLocalCleanupSummary(
  input: ExplorerDeleteLocalCleanupInput,
): ExplorerDeleteLocalCleanupSummary | undefined {
  if (input.isDeleteOperation === false) {
    return undefined;
  }

  return {
    dirtyBufferCount: getExplorerDeleteLocalCleanupDirtyBufferCount(
      input.files,
      input.path,
      input.isFileDirty,
      input.isSameOrDescendantPath,
    ),
    savedSnapshotCount: getExplorerDeleteLocalCleanupSavedSnapshotCount(
      input.savedFiles,
      input.path,
      input.isFileDirty,
      input.isSameOrDescendantPath,
    ),
    openFileCount: getExplorerDeleteLocalCleanupOpenFileCount(
      input.openFiles,
      input.path,
      input.isSameOrDescendantPath,
    ),
    activeFileCleared: input.isExplorerDeleteLocalCleanupPointerCleared(input.activeFile, input.path),
    mobileEditingFileCleared: input.isExplorerDeleteLocalCleanupPointerCleared(input.mobileEditingFile, input.path),
    pendingCloseFileCleared: input.isExplorerDeleteLocalCleanupPointerCleared(input.pendingCloseFile, input.path),
  };
}

function getWorkspaceIdeInteractionTargetLabel(targetPath: string | undefined): string {
  const hasTargetPath = hasWorkspaceIdeInteractionTargetPath(targetPath);
  if (hasTargetPath === true) {
    return ` -> ${targetPath}`;
  }

  return '';
}

function getWorkspaceIdeInteractionAppliedTargetNotice(targetPath: string | undefined): string {
  const hasTargetPath = hasWorkspaceIdeInteractionTargetPath(targetPath);
  if (hasTargetPath === true) {
    return ` 已变更为 \`${targetPath}\``;
  }

  return '';
}

function getWorkspaceIdeInteractionRenameMigrationNotice(
  renameLocalMigration: ExplorerRenameLocalMigrationSummary | undefined,
): string {
  if (renameLocalMigration !== undefined) {
    return `本地状态迁移：${formatExplorerRenameLocalMigrationNotice(renameLocalMigration)}。`;
  }

  return '';
}

function getWorkspaceIdeInteractionCreateApplyNotice(
  createLocalApply: ExplorerCreateLocalApplySummary | undefined,
): string {
  if (createLocalApply !== undefined) {
    return `本地新建反映：${formatExplorerCreateLocalApplyNotice(createLocalApply)}。`;
  }

  return '';
}

function getWorkspaceIdeInteractionDeleteCleanupNotice(
  deleteLocalCleanup: ExplorerDeleteLocalCleanupSummary | undefined,
): string {
  if (deleteLocalCleanup !== undefined) {
    return `本地删除清理：${formatExplorerDeleteLocalCleanupNotice(deleteLocalCleanup)}。`;
  }

  return '';
}

function getWorkspaceIdeInteractionFrontendRefreshStatusLabel(
  frontendRefreshFailure: string | undefined,
  fallback: string,
): string {
  const hasFrontendRefreshFailure = hasWorkspaceIdeInteractionTextValue(frontendRefreshFailure);
  if (hasFrontendRefreshFailure === true) {
    return `前端刷新失败：${frontendRefreshFailure}`;
  }

  return fallback;
}

function getWorkspaceIdeInteractionFrontendRefreshFailureSegment(
  frontendRefreshFailure: string | undefined,
): string | null {
  const normalizedFailure = getWorkspaceIdeInteractionTrimmedTextValue(frontendRefreshFailure);
  if (normalizedFailure !== null) {
    return `前端 Explorer 刷新失败：${normalizedFailure}`;
  }

  return null;
}

function getWorkspaceIdeInteractionSuggestedActions(
  actions: GuidanceAction[],
): GuidanceAction[] | undefined {
  const hasActions = actions.length > 0;
  if (hasActions === true) {
    return actions;
  }

  return undefined;
}

function getExplorerContextOperationNoticeSegmentSummary(
  segments: ExplorerContextOperationNoticeSegmentList,
  activeLabel: string,
  fallbackLabel: string,
): string {
  const hasSegments = segments.length > 0;
  if (hasSegments === true) {
    return `${segments.join(' / ')} ${activeLabel}`;
  }

  return fallbackLabel;
}

function getExplorerRenameLocalMigrationPointerSegments(
  summary: ExplorerRenameLocalMigrationSummary,
): ExplorerContextOperationNoticeSegmentList {
  return getExplorerContextOperationNoticeSegments([
    summary.activeFileMigrated === true ? 'active file' : null,
    summary.mobileEditingFileMigrated === true ? 'mobile editing file' : null,
    summary.pendingCloseFileMigrated === true ? 'pending close file' : null,
  ]);
}

function getExplorerDeleteLocalCleanupPointerSegments(
  summary: ExplorerDeleteLocalCleanupSummary,
): ExplorerContextOperationNoticeSegmentList {
  return getExplorerContextOperationNoticeSegments([
    summary.activeFileCleared === true ? 'active file' : null,
    summary.mobileEditingFileCleared === true ? 'mobile editing file' : null,
    summary.pendingCloseFileCleared === true ? 'pending close file' : null,
  ]);
}

function getExplorerCreateLocalApplyNodeTypeLabel(nodeType: FileNodeType): string {
  const isFileNode = nodeType === 'file';
  if (isFileNode === true) {
    return '文件';
  }

  return '文件夹';
}

function getExplorerCreateLocalApplyEditorBufferLabel(editorBufferCreated: boolean): string {
  const hasEditorBuffer = editorBufferCreated === true;
  if (hasEditorBuffer === true) {
    return '已创建编辑器 buffer';
  }

  return '未创建编辑器 buffer';
}

function getExplorerContextOperationAppliedCompletedTasks(
  renameLocalMigration: ExplorerRenameLocalMigrationSummary | undefined,
  createLocalApply: ExplorerCreateLocalApplySummary | undefined,
  deleteLocalCleanup: ExplorerDeleteLocalCleanupSummary | undefined,
): string[] {
  const completedTasks: string[] = [];
  if (renameLocalMigration !== undefined) {
    completedTasks.push(`本地重命名迁移已完成：${formatExplorerRenameLocalMigrationNotice(renameLocalMigration)}`);
  }
  if (createLocalApply !== undefined) {
    completedTasks.push(`本地新建反映已完成：${formatExplorerCreateLocalApplyNotice(createLocalApply)}`);
  }
  if (deleteLocalCleanup !== undefined) {
    completedTasks.push(`本地删除清理已完成：${formatExplorerDeleteLocalCleanupNotice(deleteLocalCleanup)}`);
  }

  return completedTasks;
}

function getExplorerContextOperationAppliedReasonMessage(
  operationLabel: string,
  syncFailures: ExplorerContextOperationNoticeSegmentList,
  renameLocalMigration: ExplorerRenameLocalMigrationSummary | undefined,
  createLocalApply: ExplorerCreateLocalApplySummary | undefined,
  deleteLocalCleanup: ExplorerDeleteLocalCleanupSummary | undefined,
): string {
  const hasSyncFailures = syncFailures.length > 0;
  if (hasSyncFailures === true) {
    return syncFailures.join('；');
  }

  if (renameLocalMigration !== undefined) {
    return `Explorer 右键${operationLabel}已执行；${formatExplorerRenameLocalMigrationNotice(renameLocalMigration)}。`;
  }

  if (createLocalApply !== undefined) {
    return `Explorer 右键${operationLabel}已执行；${formatExplorerCreateLocalApplyNotice(createLocalApply)}。`;
  }

  if (deleteLocalCleanup !== undefined) {
    return `Explorer 右键${operationLabel}已执行；${formatExplorerDeleteLocalCleanupNotice(deleteLocalCleanup)}。`;
  }

  return `Explorer 右键${operationLabel}已执行。`;
}

function getWorkspaceIdeInteractionPhaseStatus(hasFailures: boolean): 'failed' | 'passed' {
  if (hasFailures === true) {
    return 'failed';
  }

  return 'passed';
}

function getWorkspaceIdeInteractionFileTreeRefreshTask(
  result: ProjectFileOperationResponse,
  frontendRefreshFailure: string | undefined,
): string {
  const isFileTreeUpdated = result.file_tree_status === 'updated';
  const hasFrontendRefreshFailure = hasWorkspaceIdeInteractionTextValue(frontendRefreshFailure);
  if (isFileTreeUpdated === true && hasFrontendRefreshFailure === false) {
    return '项目文件树缓存和前端 Explorer 已刷新';
  }

  return '文件树缓存或前端 Explorer 可能仍是旧状态';
}

function getWorkspaceIdeInteractionGitSnapshotTask(result: ProjectFileOperationResponse): string {
  if (result.commit_status === 'created') {
    return 'Git 快照已创建';
  }

  if (result.commit_status === 'created_record_missing') {
    return 'Git 快照已创建但提交记录同步异常';
  }

  if (result.commit_status === 'created_record_failed') {
    return 'Git 快照已创建但提交记录同步异常';
  }

  if (result.commit_status === 'skipped_no_changes') {
    return '无需创建新的 Git 快照';
  }

  return 'Git 快照创建失败';
}

function getExplorerContextOperationAppliedTasks(
  result: ProjectFileOperationResponse,
  frontendRefreshFailure: string | undefined,
  renameLocalMigration: ExplorerRenameLocalMigrationSummary | undefined,
  createLocalApply: ExplorerCreateLocalApplySummary | undefined,
  deleteLocalCleanup: ExplorerDeleteLocalCleanupSummary | undefined,
): string[] {
  const completedTasks = [
    '后端文件系统事务已执行',
    getWorkspaceIdeInteractionFileTreeRefreshTask(result, frontendRefreshFailure),
    getWorkspaceIdeInteractionGitSnapshotTask(result),
  ];
  const localOperationTasks = getExplorerContextOperationAppliedCompletedTasks(
    renameLocalMigration,
    createLocalApply,
    deleteLocalCleanup,
  );
  for (const task of localOperationTasks) {
    completedTasks.push(task);
  }

  return completedTasks;
}

function getExplorerContextOperationNextAction(syncFailures: ExplorerContextOperationNoticeSegmentList): string {
  const hasSyncFailures = syncFailures.length > 0;
  if (hasSyncFailures === true) {
    return '文件系统操作已生效；请刷新 Explorer 或 Git 面板确认后续资源视图。';
  }

  return '继续编辑或查看 Explorer/Git 面板确认变更。';
}

function getExplorerContextOperationExecutionNextAction(syncFailures: ExplorerContextOperationNoticeSegmentList): string {
  const hasSyncFailures = syncFailures.length > 0;
  if (hasSyncFailures === true) {
    return '先校准 Explorer/Git 资源视图，再继续依赖当前目录快照。';
  }

  return '继续进行后续文件编辑或提交检查。';
}

function getExplorerContextOperationAppliedReasonCode(
  syncFailures: ExplorerContextOperationNoticeSegmentList,
): 'explorer_context_operation_applied_with_sync_failure' | 'explorer_context_operation_applied' {
  const hasSyncFailures = syncFailures.length > 0;
  if (hasSyncFailures === true) {
    return 'explorer_context_operation_applied_with_sync_failure';
  }

  return 'explorer_context_operation_applied';
}

function getWorkspaceIdeInteractionRemainingOpenFilesAfterClose(
  openFiles: WorkspaceOpenFilePathList,
  targetPath: string,
): WorkspaceOpenFilePathList {
  const remainingOpenFiles: WorkspaceOpenFilePathList = [];
  for (const openFile of openFiles) {
    const isCloseTarget = openFile === targetPath;
    if (isCloseTarget === false) {
      remainingOpenFiles.push(openFile);
    }
  }

  return remainingOpenFiles;
}

function getWorkspaceIdeInteractionActiveFileAfterClose(
  current: string | null,
  nextOpenFiles: WorkspaceOpenFilePathList,
  targetPath: string,
): string | null {
  if (current === targetPath) {
    return getWorkspaceIdeInteractionLastOpenFilePath(nextOpenFiles);
  }

  return current;
}

function shouldClearWorkspaceIdeInteractionMobileEditorAfterClose(
  mobileEditingFile: string | null,
  targetPath: string,
): boolean {
  const shouldClearMobileEditor = mobileEditingFile === targetPath;
  return shouldClearMobileEditor === true;
}

function getWorkspaceIdeInteractionRemainingOpenFilesAfterDelete(
  openFiles: WorkspaceOpenFilePathList,
  targetPath: string,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): WorkspaceOpenFilePathList {
  const remainingOpenFiles: WorkspaceOpenFilePathList = [];
  for (const openFile of openFiles) {
    const isDeleteTarget = isSameOrDescendantPath(openFile, targetPath);
    if (isDeleteTarget === false) {
      remainingOpenFiles.push(openFile);
    }
  }

  return remainingOpenFiles;
}

function getWorkspaceIdeInteractionActiveFileAfterDelete(
  current: string | null,
  nextOpenFiles: WorkspaceOpenFilePathList,
  targetPath: string,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): string | null {
  if (current === null) {
    return current;
  }

  const isDeleteTarget = isSameOrDescendantPath(current, targetPath);
  if (isDeleteTarget === true) {
    return getWorkspaceIdeInteractionLastOpenFilePath(nextOpenFiles);
  }

  return current;
}

function getWorkspaceIdeInteractionPendingCloseFileAfterDelete(
  current: string | null,
  targetPath: string,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): string | null {
  if (current === null) {
    return current;
  }

  const isDeleteTarget = isSameOrDescendantPath(current, targetPath);
  if (isDeleteTarget === true) {
    return null;
  }

  return current;
}

function shouldClearWorkspaceIdeInteractionMobileEditorAfterDelete(
  mobileEditingFile: string | null,
  targetPath: string,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): boolean {
  if (mobileEditingFile === null) {
    return false;
  }

  const isDeleteTarget = isSameOrDescendantPath(mobileEditingFile, targetPath);
  return isDeleteTarget === true;
}

function getWorkspaceIdeInteractionExactRenamePath(
  candidatePath: string | null,
  sourcePath: string,
  targetPath: string,
): string | null {
  if (candidatePath === sourcePath) {
    return targetPath;
  }

  return candidatePath;
}

function getWorkspaceIdeInteractionOpenFilesAfterExactRename(
  openFiles: WorkspaceOpenFilePathList,
  sourcePath: string,
  targetPath: string,
): WorkspaceOpenFilePathList {
  let changed = false;
  const nextOpenFiles: WorkspaceOpenFilePathList = [];
  for (const openFile of openFiles) {
    const migratedPath = getWorkspaceIdeInteractionExactRenamePath(openFile, sourcePath, targetPath);
    if (migratedPath !== openFile) {
      changed = true;
    }
    if (migratedPath !== null) {
      nextOpenFiles.push(migratedPath);
    }
  }

  if (changed === true) {
    return nextOpenFiles;
  }

  return openFiles;
}

function getWorkspaceIdeInteractionOpenFilesAfterPathMigration(
  openFiles: WorkspaceOpenFilePathList,
  sourcePath: string,
  targetPath: string,
): WorkspaceOpenFilePathList {
  let changed = false;
  const nextOpenFiles: WorkspaceOpenFilePathList = [];
  for (const openFile of openFiles) {
    const migratedPath = getWorkspaceIdeInteractionMigratedPath(openFile, sourcePath, targetPath);
    if (migratedPath !== openFile) {
      changed = true;
    }
    nextOpenFiles.push(migratedPath);
  }

  if (changed === true) {
    return nextOpenFiles;
  }

  return openFiles;
}

function getWorkspaceIdeInteractionOpenFilePath(
  target: WorkspaceIdeInteractionOpenFileTarget,
): string {
  if (typeof target === 'string') {
    return target;
  }

  return target.path;
}

function getWorkspaceIdeInteractionNavigationTargetAfterOpen(
  target: WorkspaceIdeInteractionOpenFileTarget,
): WorkspaceEditorNavigationTarget | null {
  if (typeof target === 'string') {
    return null;
  }

  return target;
}

function getWorkspaceIdeInteractionOpenFilesAfterOpen(
  openFiles: WorkspaceOpenFilePathList,
  targetPath: string,
): WorkspaceOpenFilePathList {
  for (const openFile of openFiles) {
    const isAlreadyOpen = openFile === targetPath;
    if (isAlreadyOpen === true) {
      return openFiles;
    }
  }

  return [...openFiles, targetPath];
}

function shouldBuildWorkspaceIdeInteractionOpenCacheStatus(
  files: Map<string, string>,
  editorBufferStatuses: Map<string, EditorBufferStatus>,
  targetPath: string,
): boolean {
  const hasFileContent = files.has(targetPath);
  if (hasFileContent === false) {
    return false;
  }

  const hasEditorBufferStatus = editorBufferStatuses.has(targetPath);
  if (hasEditorBufferStatus === true) {
    return false;
  }

  return true;
}

function hasWorkspaceIdePathSegment(segment: string): boolean {
  const hasSegment = segment.length > 0;
  return hasSegment === true;
}

function getWorkspaceIdePathSegments(path: string): string[] {
  const pathSegments: string[] = [];
  const rawSegments = path.split('/');

  for (const segment of rawSegments) {
    const hasSegment = hasWorkspaceIdePathSegment(segment);
    if (hasSegment === true) {
      pathSegments.push(segment);
    }
  }

  return pathSegments;
}

function hasWorkspaceIdeInteractionPath(path: string | null | undefined): path is string {
  const hasPath = hasWorkspaceIdeInteractionTextValue(path);
  return hasPath === true;
}

function hasWorkspaceIdeInteractionFileNode(node: FileNode | null): node is FileNode {
  return node !== null;
}

function hasWorkspaceIdeInteractionLastOpenFilePath(value: string | undefined): value is string {
  const hasLastOpenFile = value !== undefined;
  return hasLastOpenFile === true;
}

function getWorkspaceIdeInteractionLastOpenFilePath(
  openFiles: WorkspaceOpenFilePathList,
): string | null {
  let lastOpenFile: string | undefined;

  for (const openFile of openFiles) {
    lastOpenFile = openFile;
  }

  if (hasWorkspaceIdeInteractionLastOpenFilePath(lastOpenFile) === true) {
    return lastOpenFile;
  }

  return null;
}

function hasWorkspaceIdeInteractionLastPathSegment(value: string | undefined): value is string {
  const hasLastSegment = value !== undefined;
  return hasLastSegment === true;
}

function getWorkspaceIdeInteractionLastPathSegment(pathSegments: string[]): string | undefined {
  let lastSegment: string | undefined;

  for (const pathSegment of pathSegments) {
    lastSegment = pathSegment;
  }

  return lastSegment;
}

function getWorkspaceIdeInteractionDownloadFileName(path: string): string {
  const pathSegments = getWorkspaceIdePathSegments(path);
  const lastSegment = getWorkspaceIdeInteractionLastPathSegment(pathSegments);
  if (hasWorkspaceIdeInteractionLastPathSegment(lastSegment) === true) {
    return lastSegment;
  }

  return 'file';
}

function shouldDiscardWorkspaceIdeInteractionChanges(discardChanges: boolean): boolean {
  const shouldDiscard = discardChanges === true;
  return shouldDiscard === true;
}

function hasWorkspaceIdeInteractionSavedSnapshotContent(
  content: string | undefined,
): content is string {
  const hasContent = content !== undefined;
  return hasContent === true;
}

function shouldAppendWorkspaceIdeInteractionDirtyDiscardMessage(wasDirty: boolean): boolean {
  const shouldAppendMessage = wasDirty === true;
  return shouldAppendMessage === true;
}

function shouldSyncWorkspaceIdeInteractionMobileEditor(isMobile: boolean): boolean {
  const shouldSyncMobileEditor = isMobile === true;
  return shouldSyncMobileEditor === true;
}

function hasWorkspaceIdeInteractionPathMapEntry(entries: Map<string, string>, path: string): boolean {
  const hasEntry = entries.has(path);
  return hasEntry === true;
}

function renameWorkspacePathAfterOperation(candidatePath: string | null, sourcePath: string, targetPath: string) {
  if (hasWorkspaceIdeInteractionPath(candidatePath) === false) return candidatePath;
  if (candidatePath === sourcePath) return targetPath;
  if (candidatePath.startsWith(`${sourcePath}/`)) {
    return `${targetPath}/${candidatePath.slice(sourcePath.length + 1)}`;
  }
  return candidatePath;
}

function migrateWorkspacePathMap(
  entries: WorkspaceIdeInteractionPathContentMap,
  sourcePath: string,
  targetPath: string,
): WorkspaceIdeInteractionPathContentMap {
  let changed = false;
  const next = new Map<string, string>();

  for (const [key, value] of entries) {
    const migratedKey = getWorkspaceIdeInteractionMigratedPath(key, sourcePath, targetPath);
    if (migratedKey !== key) {
      changed = true;
    }
    next.set(migratedKey, value);
  }

  return changed ? next : entries;
}

function migrateWorkspaceEditorStatusMap(
  entries: WorkspaceIdeInteractionEditorStatusMap,
  sourcePath: string,
  targetPath: string,
): WorkspaceIdeInteractionEditorStatusMap {
  let changed = false;
  const next = new Map<string, EditorBufferStatus>();

  for (const [key, value] of entries) {
    const migratedKey = getWorkspaceIdeInteractionMigratedPath(key, sourcePath, targetPath);
    if (migratedKey !== key) {
      changed = true;
    }
    next.set(migratedKey, migratedKey === key ? value : buildLocalFileOperationEditorBufferStatus({
      previousStatus: value,
      filePath: migratedKey,
      previousPath: key,
    }));
  }

  return changed ? next : entries;
}

function getWorkspaceIdeInteractionPathMapWithoutDescendants(
  entries: WorkspaceIdeInteractionPathContentMap,
  targetPath: string,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): WorkspaceIdeInteractionPathContentMap {
  let changed = false;
  const next = new Map<string, string>();

  for (const [filePath, value] of entries) {
    const isDeleteTarget = isSameOrDescendantPath(filePath, targetPath);
    if (isDeleteTarget === true) {
      changed = true;
    } else {
      next.set(filePath, value);
    }
  }

  return changed ? next : entries;
}

function getWorkspaceIdeInteractionEditorStatusMapWithoutDescendants(
  entries: WorkspaceIdeInteractionEditorStatusMap,
  targetPath: string,
  isSameOrDescendantPath: WorkspaceIdeInteractionDescendantPathMatcher,
): WorkspaceIdeInteractionEditorStatusMap {
  let changed = false;
  const next = new Map<string, EditorBufferStatus>();

  for (const [filePath, value] of entries) {
    const isDeleteTarget = isSameOrDescendantPath(filePath, targetPath);
    if (isDeleteTarget === true) {
      changed = true;
    } else {
      next.set(filePath, value);
    }
  }

  return changed ? next : entries;
}

function formatExplorerRenameLocalMigrationNotice(summary: ExplorerRenameLocalMigrationSummary) {
  const migratedPointerSegments = getExplorerRenameLocalMigrationPointerSegments(summary);
  const pointerSummary = getExplorerContextOperationNoticeSegmentSummary(
    migratedPointerSegments,
    '指针已迁移',
    '无需迁移 active/mobile/pending-close 指针',
  );

  return [
    `${summary.dirtyBufferCount} 个 dirty buffer`,
    `${summary.savedSnapshotCount} 个 saved snapshot`,
    `${summary.openFileCount} 个 open tab`,
    pointerSummary,
  ].join('，');
}

function formatExplorerCreateLocalApplyNotice(summary: ExplorerCreateLocalApplySummary) {
  const nodeTypeLabel = getExplorerCreateLocalApplyNodeTypeLabel(summary.nodeType);
  const editorBufferLabel = getExplorerCreateLocalApplyEditorBufferLabel(summary.editorBufferCreated);

  return [
    `本地 Explorer 已反映 ${summary.path}`,
    `类型：${nodeTypeLabel}`,
    editorBufferLabel,
  ].join('，');
}

function formatExplorerDeleteLocalCleanupNotice(summary: ExplorerDeleteLocalCleanupSummary) {
  const clearedPointerSegments = getExplorerDeleteLocalCleanupPointerSegments(summary);
  const pointerSummary = getExplorerContextOperationNoticeSegmentSummary(
    clearedPointerSegments,
    '指针已清理',
    '无需清理 active/mobile/pending-close 指针',
  );

  return [
    `${summary.dirtyBufferCount} 个 dirty buffer`,
    `${summary.savedSnapshotCount} 个 saved snapshot`,
    `${summary.openFileCount} 个 open tab`,
    pointerSummary,
  ].join('，');
}

function buildExplorerContextOperationSyncFailureActions(
  result: ProjectFileOperationResponse,
  frontendRefreshFailure?: string,
): GuidanceAction[] {
  const actions: GuidanceAction[] = [];
  const hasFrontendRefreshFailure = hasWorkspaceIdeInteractionTextValue(frontendRefreshFailure);
  if (result.file_tree_status === 'failed' || hasFrontendRefreshFailure === true) {
    actions.push({
      label: '重新刷新 Explorer',
      kind: 'refresh_explorer_panel',
    });
  }
  if (
    result.commit_status === 'failed' ||
    result.commit_status === 'created_record_missing' ||
    result.commit_status === 'created_record_failed'
  ) {
    actions.push({
      label: '打开 Git 面板',
      kind: 'open_git_panel',
    });
  }
  return actions;
}

function buildOpenWorkspaceFileRefreshFailureState(
  path: string,
  reasonMessage: string,
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
      current_task: `已打开修复目标 ${path}，但文件树刷新失败`,
      completed_tasks: ['已打开修复目标文件', 'Explorer 已切换到文件视图'],
      blockers: [reasonMessage],
      next_action: '可以继续编辑已打开文件，稍后重新刷新文件树确认目录状态。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `修复目标 ${path} 打开后的文件树刷新失败`,
      next_action: '继续编辑已打开文件，或刷新 Explorer 校准目录真源。',
    },
    recovery: {
      blocked: false,
      reason_code: 'open_workspace_file_refresh_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildDiscardDirtyCloseState(
  path: string,
  restoredSavedSnapshot: boolean,
): WorkspaceEngineeringStateSnapshot {
  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: 'passed',
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `已关闭 ${path} 并丢弃未保存修改`,
      completed_tasks: restoredSavedSnapshot
        ? ['编辑器内容已恢复到最近保存快照', '文件标签页已关闭', '未保存修改未写入后端']
        : ['文件标签页已关闭', '未保存修改未写入后端'],
      blockers: [],
      next_action: '如需恢复丢弃内容，请从 Git 历史或外部备份中查找；当前不会创建新的保存快照。',
      status: 'passed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `关闭 ${path} 时已丢弃未保存修改`,
      next_action: '继续编辑其他文件；如需恢复内容，请查看 Git 历史或外部备份。',
    },
    recovery: {
      blocked: false,
      reason_code: 'file_close_discarded_dirty_buffer',
      reason_message: restoredSavedSnapshot
        ? '用户确认不保存，编辑器内容已恢复到最近保存快照后关闭标签页。'
        : '用户确认不保存，文件标签页已关闭；未找到可恢复的保存快照。',
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildUnavailableExplorerContextOperationState(
  operation: WorkspaceExplorerContextOperation,
  path: string,
): WorkspaceEngineeringStateSnapshot {
  const operationLabel = getWorkspaceExplorerContextOperationLabel(operation);
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
      current_task: `${operationLabel} ${path} 暂不可用`,
      completed_tasks: ['未调用后端文件系统事务接口', 'Workspace 文件树和编辑器缓存未变更'],
      blockers: [`Explorer 右键${operationLabel}能力尚未接入后端事务 API`],
      next_action: '暂时通过 AI 生成/修改文件或直接编辑文件内容；待后端事务 API 接入后再启用该右键操作。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `${operationLabel} ${path} 暂不可用`,
      next_action: '使用已有编辑和保存能力继续推进；不要把当前文件树状态误判为已执行右键操作。',
    },
    recovery: {
      blocked: false,
      reason_code: 'explorer_context_operation_unavailable',
      reason_message: `Explorer 右键${operationLabel}尚未开放后端事务能力；目标：${path}`,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildExplorerContextOperationAppliedState(
  operation: WorkspaceExplorerContextOperation,
  path: string,
  targetPath: string | undefined,
  result: ProjectFileOperationResponse,
  frontendRefreshFailure?: string,
  renameLocalMigration?: ExplorerRenameLocalMigrationSummary,
  createLocalApply?: ExplorerCreateLocalApplySummary,
  deleteLocalCleanup?: ExplorerDeleteLocalCleanupSummary,
): WorkspaceEngineeringStateSnapshot {
  const operationLabel = getWorkspaceExplorerContextOperationLabel(operation);
  const syncFailures = getExplorerContextOperationNoticeSegments([
    result.file_tree_status === 'failed'
      ? `文件树同步失败：${getWorkspaceIdeInteractionStructuredStatusLabel(result.file_tree_error, result.file_tree_status_label)}`
      : null,
    result.commit_status === 'failed'
      ? `Git 快照失败：${getWorkspaceIdeInteractionStructuredStatusLabel(result.commit_error, result.commit_status_label)}`
      : result.commit_status === 'created_record_missing' || result.commit_status === 'created_record_failed'
        ? `Git 快照记录同步异常：${getWorkspaceIdeInteractionStructuredStatusLabel(result.commit_error, result.commit_status_label)}`
      : null,
    result.collaboration_event_status === 'failed'
      ? `协作事件同步失败：${result.collaboration_event_error || '后端未记录文件树变更事件'}`
      : null,
    getWorkspaceIdeInteractionFrontendRefreshFailureSegment(frontendRefreshFailure),
  ]);
  const hasSyncFailures = syncFailures.length > 0;
  const operationPhaseStatus = getWorkspaceIdeInteractionPhaseStatus(hasSyncFailures);
  const targetLabel = getWorkspaceIdeInteractionTargetLabel(targetPath);
  const completedTasks = getExplorerContextOperationAppliedTasks(
    result,
    frontendRefreshFailure,
    renameLocalMigration,
    createLocalApply,
    deleteLocalCleanup,
  );
  const nextAction = getExplorerContextOperationNextAction(syncFailures);
  const executionNextAction = getExplorerContextOperationExecutionNextAction(syncFailures);
  const reasonCode = getExplorerContextOperationAppliedReasonCode(syncFailures);
  const reasonMessage = getExplorerContextOperationAppliedReasonMessage(
    operationLabel,
    syncFailures,
    renameLocalMigration,
    createLocalApply,
    deleteLocalCleanup,
  );

  return {
    workflow: {
      stage: 'implement',
      mode: 'implement',
      status: operationPhaseStatus,
    },
    validation: {
      status: 'not_applicable',
    },
    phase: {
      current_phase: '实现阶段',
      current_task: `${operationLabel} ${path}${targetLabel} 已执行`,
      completed_tasks: completedTasks,
      blockers: syncFailures,
      next_action: nextAction,
      status: operationPhaseStatus,
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `${operationLabel} ${path}${targetLabel} 已执行`,
      next_action: executionNextAction,
    },
    recovery: {
      blocked: false,
      reason_code: reasonCode,
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

function buildExplorerContextOperationFailureState(
  operation: WorkspaceExplorerContextOperation,
  path: string,
  reasonMessage: string,
): WorkspaceEngineeringStateSnapshot {
  const operationLabel = getWorkspaceExplorerContextOperationLabel(operation);
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
      current_task: `${operationLabel} ${path} 失败`,
      completed_tasks: ['Workspace 文件树和编辑器缓存未按失败操作变更'],
      blockers: [reasonMessage],
      next_action: '修复失败原因后重试；当前不要把 Explorer 目录快照误判为已执行该右键操作。',
      status: 'failed',
    },
    execution: {
      auto_progress_enabled: false,
      awaiting_confirmation: false,
      current_task: `${operationLabel} ${path} 失败`,
      next_action: '确认后端文件系统事务能力和目标路径状态后重试。',
    },
    recovery: {
      blocked: false,
      reason_code: 'explorer_context_operation_failed',
      reason_message: reasonMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: false,
    },
  };
}

export function useWorkspaceIdeInteractions({
  projectInfo,
  activeFile,
  openFiles,
  mobileEditingFile,
  isMobile,
  files,
  savedFiles,
  editorBufferStatuses,
  refreshProjectFileTree,
  setExplorerSnapshotStatus,
  setFileTree,
  setExpandedFolders,
  setFiles,
  setSavedFiles,
  setEditorBufferStatuses,
  setOpenFiles,
  setActiveFile,
  setEditorNavigationTarget,
  setMobileEditingFile,
  setMobileFileContent,
  applyIdeInteractionMessages,
  pendingCloseFile,
  setPendingCloseFile,
  setContextMenu,
  showExplorerTab,
  upsertFilePathIntoTree,
  removeFilePathFromTree,
  renameFilePathInTree,
}: UseWorkspaceIdeInteractionsOptions): WorkspaceIdeInteractionsContract {
  const expandAncestorFolders = useCallback((path: string) => {
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    if (hasPath === false) return;

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.add('');

      const segments = getWorkspaceIdePathSegments(path);
      let current = '';
      for (let i = 0; i < segments.length - 1; i += 1) {
        const hasCurrent = current.length > 0;
        current = hasCurrent === true ? `${current}/${segments[i]}` : segments[i];
        next.add(current);
      }
      return next;
    });
  }, [setExpandedFolders]);

  const reflectFilePathInTree = useCallback((path: string, leafType?: FileNodeType) => {
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    if (hasPath === false) return;
    setFileTree((prev) => upsertFilePathIntoTree(prev, path, leafType));
    expandAncestorFolders(path);
  }, [expandAncestorFolders, setFileTree, upsertFilePathIntoTree]);

  const removeFilePathFromWorkspaceTree = useCallback((path: string) => {
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    if (hasPath === false) return;
    setFileTree((prev) => removeFilePathFromTree(prev, path));
  }, [removeFilePathFromTree, setFileTree]);

  const renameFilePathInWorkspaceTree = useCallback((fromPath: string, toPath: string, leafType?: FileNodeType) => {
    const hasFromPath = hasWorkspaceIdeInteractionPath(fromPath);
    const hasToPath = hasWorkspaceIdeInteractionPath(toPath);
    if (hasFromPath === false || hasToPath === false) return;
    setFileTree((prev) => renameFilePathInTree(prev, fromPath, toPath, leafType));
    expandAncestorFolders(toPath);
  }, [expandAncestorFolders, renameFilePathInTree, setFileTree]);

  const isFileDirty = useCallback((path: string | null) => {
    return isWorkspaceEditorBufferDirty({
      files,
      savedFiles,
      filePath: path,
    });
  }, [files, savedFiles]);

  const isSameOrDescendantPath = useCallback((candidate: string, targetPath: string) => (
    candidate === targetPath || candidate.startsWith(`${targetPath}/`)
  ), []);

  const isExplorerDeleteLocalCleanupPointerCleared = useCallback((candidate: string | null, targetPath: string) => {
    if (candidate === null) {
      return false;
    }

    const isCleared = isSameOrDescendantPath(candidate, targetPath);
    return isCleared === true;
  }, [isSameOrDescendantPath]);

  const closeWorkspaceFile = useCallback((path: string, discardChanges = false) => {
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    if (hasPath === false) return;

    const wasDirty = isFileDirty(path);
    const persistedContent = savedFiles.get(path);
    const shouldDiscardChanges = shouldDiscardWorkspaceIdeInteractionChanges(discardChanges);
    if (shouldDiscardChanges === true) {
      const hasPersistedContent = hasWorkspaceIdeInteractionSavedSnapshotContent(persistedContent);
      if (hasPersistedContent === true) {
        setFiles((prev) => {
          const next = new Map(prev);
          next.set(path, persistedContent);
          return next;
        });
        setEditorBufferStatuses((prev) => new Map(prev).set(path, buildOpenFileSavedSnapshotEditorBufferStatus(path)));
      }
      const shouldAppendDirtyDiscardMessage = shouldAppendWorkspaceIdeInteractionDirtyDiscardMessage(wasDirty);
      if (shouldAppendDirtyDiscardMessage === true) {
        applyIdeInteractionMessages((prev) => [...prev, {
          id: `close-file-discarded-${Date.now()}`,
          role: 'assistant',
          kind: 'workflow',
          content: `已关闭 \`${path}\`，并按确认丢弃未保存修改。${hasPersistedContent === true ? '编辑器内容已恢复到最近保存快照；' : '当前未找到可恢复的保存快照；'}这次关闭不会写入后端文件，也不会创建新的 Git 快照。`,
          statusContent: '已丢弃未保存修改并关闭文件',
          engineeringState: buildDiscardDirtyCloseState(path, hasPersistedContent === true),
          timestamp: new Date().toISOString(),
        }]);
      }
    }

    setOpenFiles((prev) => {
      const next = getWorkspaceIdeInteractionRemainingOpenFilesAfterClose(prev, path);
      setActiveFile((current) => getWorkspaceIdeInteractionActiveFileAfterClose(current, next, path));
      return next;
    });

    const shouldClearMobileEditor = shouldClearWorkspaceIdeInteractionMobileEditorAfterClose(mobileEditingFile, path);
    if (shouldClearMobileEditor === true) {
      setMobileEditingFile(null);
      setMobileFileContent('');
    }
  }, [
    isFileDirty,
    mobileEditingFile,
    savedFiles,
    applyIdeInteractionMessages,
    setActiveFile,
    setEditorBufferStatuses,
    setFiles,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
  ]);

  const closeDeletedWorkspacePath = useCallback((path: string) => {
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    if (hasPath === false) return;

    setFiles((prev) => {
      return getWorkspaceIdeInteractionPathMapWithoutDescendants(
        prev,
        path,
        isSameOrDescendantPath,
      );
    });
    setSavedFiles((prev) => {
      return getWorkspaceIdeInteractionPathMapWithoutDescendants(
        prev,
        path,
        isSameOrDescendantPath,
      );
    });
    setEditorBufferStatuses((prev) => {
      return getWorkspaceIdeInteractionEditorStatusMapWithoutDescendants(
        prev,
        path,
        isSameOrDescendantPath,
      );
    });
    setOpenFiles((prev) => {
      const next = getWorkspaceIdeInteractionRemainingOpenFilesAfterDelete(prev, path, isSameOrDescendantPath);
      setActiveFile((current) => getWorkspaceIdeInteractionActiveFileAfterDelete(
        current,
        next,
        path,
        isSameOrDescendantPath,
      ));
      return next;
    });
    setPendingCloseFile((current) => getWorkspaceIdeInteractionPendingCloseFileAfterDelete(
      current,
      path,
      isSameOrDescendantPath,
    ));

    const shouldClearMobileEditor = shouldClearWorkspaceIdeInteractionMobileEditorAfterDelete(
      mobileEditingFile,
      path,
      isSameOrDescendantPath,
    );
    if (shouldClearMobileEditor === true) {
      setMobileEditingFile(null);
      setMobileFileContent('');
    }
  }, [
    isSameOrDescendantPath,
    mobileEditingFile,
    setActiveFile,
    setFiles,
    setEditorBufferStatuses,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    setPendingCloseFile,
    setSavedFiles,
  ]);

  const requestCloseWorkspaceFile = useCallback((path: string) => {
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    if (hasPath === false) return;
    if (isFileDirty(path)) {
      setPendingCloseFile(path);
      return;
    }
    closeWorkspaceFile(path);
  }, [closeWorkspaceFile, isFileDirty, setPendingCloseFile]);

  const applyIncrementalWorkflowStep = useCallback((step: WorkflowStep) => {
    const path = getWorkspaceIdeInteractionWorkflowStepTextMeta(step.meta, 'path');
    const fromPath = getWorkspaceIdeInteractionWorkflowStepTextMeta(step.meta, 'fromPath');
    const toPath = getWorkspaceIdeInteractionWorkflowStepTextMeta(step.meta, 'toPath');
    const content = getWorkspaceIdeInteractionWorkflowStepContentMeta(step.meta, 'content');
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    const hasFromPath = hasWorkspaceIdeInteractionPath(fromPath);
    const hasToPath = hasWorkspaceIdeInteractionPath(toPath);
    const hasContent = hasWorkspaceIdeInteractionTextValue(content);
    const markStreamPreviewSnapshot = () => {
      const nextStatus = buildExplorerImplementationStreamSnapshotStatus({
        kind: step.kind,
        status: step.status,
        path,
        fromPath,
        toPath,
      });
      if (nextStatus !== null) {
        setExplorerSnapshotStatus(nextStatus);
      }
    };

    if (step.status === 'running') {
      switch (step.kind) {
        case 'create_file':
        case 'write_file':
          if (hasPath === true) {
            reflectFilePathInTree(path);
            markStreamPreviewSnapshot();
            if (hasContent === true) {
              setFiles((prev) => {
                const next = new Map(prev);
                next.set(path, content);
                return next;
              });
              setEditorBufferStatuses((prev) => new Map(prev).set(path, buildImplementationStreamEditorBufferStatus({
                filePath: path,
                phase: 'running',
              })));
            }
          }
          break;
        case 'create_directory':
          if (hasPath === true) {
            reflectFilePathInTree(path);
            markStreamPreviewSnapshot();
          }
          break;
        default:
          break;
      }
      return;
    }

    if (step.status !== 'done') return;

    switch (step.kind) {
      case 'create_file':
      case 'write_file':
      case 'create_directory':
        if (hasPath === true) {
          reflectFilePathInTree(path);
          markStreamPreviewSnapshot();
          if (hasContent === true) {
            setFiles((prev) => {
              const next = new Map(prev);
              next.set(path, content);
              return next;
            });
            setSavedFiles((prev) => {
              const next = new Map(prev);
              next.set(path, content);
              return next;
            });
            setEditorBufferStatuses((prev) => new Map(prev).set(path, buildImplementationStreamEditorBufferStatus({
              filePath: path,
              phase: 'applied',
            })));
          }
        }
        break;
      case 'delete_file':
      case 'delete_directory':
        if (hasPath === true) {
          removeFilePathFromWorkspaceTree(path);
          closeDeletedWorkspacePath(path);
          markStreamPreviewSnapshot();
        }
        break;
      case 'rename_file':
        if (hasFromPath === true && hasToPath === true) {
          renameFilePathInWorkspaceTree(fromPath, toPath);
          markStreamPreviewSnapshot();
          setFiles((prev) => {
            const hasSourcePath = hasWorkspaceIdeInteractionPathMapEntry(prev, fromPath);
            if (hasSourcePath === false) return prev;
            const next = new Map(prev);
            const value = next.get(fromPath);
            next.delete(fromPath);
            if (value !== undefined) {
              next.set(toPath, value);
            }
            return next;
          });
          setSavedFiles((prev) => {
            const hasSourcePath = hasWorkspaceIdeInteractionPathMapEntry(prev, fromPath);
            if (hasSourcePath === false) return prev;
            const next = new Map(prev);
            const value = next.get(fromPath);
            next.delete(fromPath);
            if (value !== undefined) {
              next.set(toPath, value);
            }
            return next;
          });
          setEditorBufferStatuses((prev) => migrateWorkspaceEditorStatusMap(prev, fromPath, toPath));
          setOpenFiles((prev) => getWorkspaceIdeInteractionOpenFilesAfterExactRename(prev, fromPath, toPath));
          setActiveFile((prev) => getWorkspaceIdeInteractionExactRenamePath(prev, fromPath, toPath));
          setMobileEditingFile((prev) => getWorkspaceIdeInteractionExactRenamePath(prev, fromPath, toPath));
          setPendingCloseFile((prev) => getWorkspaceIdeInteractionExactRenamePath(prev, fromPath, toPath));
        }
        break;
      default:
        break;
    }
  }, [
    closeDeletedWorkspacePath,
    reflectFilePathInTree,
    removeFilePathFromWorkspaceTree,
    renameFilePathInWorkspaceTree,
    setActiveFile,
    setFiles,
    setEditorBufferStatuses,
    setMobileEditingFile,
    setOpenFiles,
    setPendingCloseFile,
    setSavedFiles,
    setExplorerSnapshotStatus,
  ]);

  const openWorkspaceFile = useCallback(async (target: WorkspaceIdeInteractionOpenFileTarget) => {
    const path = getWorkspaceIdeInteractionOpenFilePath(target);
    const hasPath = hasWorkspaceIdeInteractionPath(path);
    if (hasPath === false) return;

    setEditorNavigationTarget(getWorkspaceIdeInteractionNavigationTargetAfterOpen(target));

    showExplorerTab();
    expandAncestorFolders(path);
    setActiveFile(path);
    setOpenFiles((prev) => getWorkspaceIdeInteractionOpenFilesAfterOpen(prev, path));
    const shouldBuildOpenCacheStatus = shouldBuildWorkspaceIdeInteractionOpenCacheStatus(
      files,
      editorBufferStatuses,
      path,
    );
    if (shouldBuildOpenCacheStatus === true) {
      setEditorBufferStatuses((prev) => new Map(prev).set(path, buildOpenFileCacheEditorBufferStatus(path)));
    }

    const shouldSyncMobileEditor = shouldSyncWorkspaceIdeInteractionMobileEditor(isMobile);
    if (shouldSyncMobileEditor === true) {
      setMobileEditingFile(path);
      setMobileFileContent(getWorkspaceEditorBufferContent(files, path));
    }

    const persistedProject = getWorkspaceIdeInteractionPersistedProject(projectInfo);
    if (persistedProject !== null) {
      const projectId = persistedProject.projectId;
      try {
        await refreshProjectFileTree(projectId, true, {
          throwOnFailure: true,
          suppressNotice: true,
        });
        expandAncestorFolders(path);
      } catch (error) {
        const failureMessage = formatWorkspaceResourceOperationFailure(error);
        applyIdeInteractionMessages((prev) => [...prev, {
          id: `open-workspace-file-refresh-failed-${Date.now()}`,
          role: 'assistant',
          kind: 'workflow',
          content: `已打开修复目标 \`${path}\`，但文件树刷新失败：${failureMessage}。当前 Explorer 可能仍是旧快照；你可以继续编辑已打开文件，或稍后重新刷新文件树确认目录状态。`,
          statusContent: '修复目标已打开但 Explorer 可能旧',
          engineeringState: buildOpenWorkspaceFileRefreshFailureState(path, failureMessage),
          timestamp: new Date().toISOString(),
        }]);
      }
    }
  }, [
    expandAncestorFolders,
    editorBufferStatuses,
    files,
    isMobile,
    projectInfo,
    refreshProjectFileTree,
    applyIdeInteractionMessages,
    setActiveFile,
    setEditorNavigationTarget,
    setEditorBufferStatuses,
    setMobileEditingFile,
    setMobileFileContent,
    setOpenFiles,
    showExplorerTab,
  ]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, [setExpandedFolders]);

  const showContextMenu = useCallback((event: ReactMouseEvent, node: FileNode) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node,
      isFolder: node.type === 'folder' || node.type === 'directory',
    });
  }, [setContextMenu]);

  const handleExplorerContextOperation = useCallback(async (
    operation: WorkspaceExplorerContextOperation,
    node: FileNode | null,
    input: WorkspaceExplorerContextOperationInput = {},
  ) => {
    if (node === null) return;
    const operationLabel = getWorkspaceExplorerContextOperationLabel(operation);
    setContextMenu(null);
    const persistedProject = getWorkspaceIdeInteractionPersistedProject(projectInfo);
    if (persistedProject === null) {
      applyIdeInteractionMessages((prev) => [...prev, {
        id: `explorer-context-operation-unavailable-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Explorer 右键“${operationLabel}”暂不可用：当前项目尚未持久化，不能对 \`${node.path}\` 执行后端文件系统事务。Workspace 文件树和编辑器缓存保持不变。`,
        statusContent: `Explorer ${operationLabel}暂不可用`,
        engineeringState: buildUnavailableExplorerContextOperationState(operation, node.path),
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    const projectId = persistedProject.projectId;
    const path = getWorkspaceIdeInteractionOperationPath(input.path, node.path);
    const targetPath = getWorkspaceIdeInteractionTargetPath(input.targetPath);
    const content = getWorkspaceIdeInteractionOperationContent(input.content);
    const hasTargetPath = hasWorkspaceIdeInteractionTargetPath(targetPath);
    const isRenameOperation = isWorkspaceIdeInteractionRenameOperation(operation);
    const isCreateOperation = isWorkspaceIdeInteractionCreateOperation(operation);
    const isDeleteOperation = isWorkspaceIdeInteractionDeleteOperation(operation);
    const renameLocalMigration = getExplorerRenameLocalMigrationSummary({
      isRenameOperation,
      sourcePath: path,
      targetPath,
      files,
      savedFiles,
      openFiles,
      activeFile,
      mobileEditingFile,
      pendingCloseFile,
      isFileDirty,
    });
    const createLocalApply = getExplorerCreateLocalApplySummary({
      isCreateOperation,
      operation,
      path,
    });
    const deleteLocalCleanup = getExplorerDeleteLocalCleanupSummary({
      isDeleteOperation,
      path,
      files,
      savedFiles,
      openFiles,
      activeFile,
      mobileEditingFile,
      pendingCloseFile,
      isFileDirty,
      isSameOrDescendantPath,
      isExplorerDeleteLocalCleanupPointerCleared,
    });
    const localOperationNodeType = getExplorerLocalOperationNodeType(operation);

    try {
      const result = await projectApi.applyFileOperation(projectId, {
        operation,
        path,
        target_path: targetPath,
        content,
      });
      if (isCreateOperation === true) {
        reflectFilePathInTree(path, localOperationNodeType);
      } else if (isDeleteOperation === true) {
        removeFilePathFromWorkspaceTree(path);
        closeDeletedWorkspacePath(path);
      } else if (isRenameOperation === true && hasTargetPath === true) {
        renameFilePathInWorkspaceTree(path, targetPath, localOperationNodeType);
        setFiles((prev) => migrateWorkspacePathMap(prev, path, targetPath));
        setSavedFiles((prev) => migrateWorkspacePathMap(prev, path, targetPath));
        setEditorBufferStatuses((prev) => migrateWorkspaceEditorStatusMap(prev, path, targetPath));
        setOpenFiles((prev) => getWorkspaceIdeInteractionOpenFilesAfterPathMigration(prev, path, targetPath));
        setActiveFile((prev) => renameWorkspacePathAfterOperation(prev, path, targetPath));
        setMobileEditingFile((prev) => renameWorkspacePathAfterOperation(prev, path, targetPath));
        setPendingCloseFile((prev) => renameWorkspacePathAfterOperation(prev, path, targetPath));
      }

      let frontendRefreshFailure: string | undefined;
      try {
        await refreshProjectFileTree(projectId, true, {
          throwOnFailure: true,
          suppressNotice: true,
        });
      } catch (refreshError) {
        frontendRefreshFailure = formatWorkspaceResourceOperationFailure(refreshError);
        setExplorerSnapshotStatus(buildExplorerLocalFileOperationSnapshotStatus({
          operationLabel,
          path,
          targetPath,
          frontendRefreshFailure,
        }));
      }
      const syncFailureActions = buildExplorerContextOperationSyncFailureActions(result, frontendRefreshFailure);
      const hasSyncFailure = syncFailureActions.length > 0
        || result.collaboration_event_status === 'failed';
      const targetNotice = getWorkspaceIdeInteractionAppliedTargetNotice(targetPath);
      const renameMigrationNotice = getWorkspaceIdeInteractionRenameMigrationNotice(renameLocalMigration);
      const createApplyNotice = getWorkspaceIdeInteractionCreateApplyNotice(createLocalApply);
      const deleteCleanupNotice = getWorkspaceIdeInteractionDeleteCleanupNotice(deleteLocalCleanup);
      const frontendRefreshStatusLabel = getWorkspaceIdeInteractionFrontendRefreshStatusLabel(
        frontendRefreshFailure,
        result.file_tree_status_label,
      );
      const suggestedActions = getWorkspaceIdeInteractionSuggestedActions(syncFailureActions);

      applyIdeInteractionMessages((prev) => [...prev, {
        id: `explorer-context-operation-applied-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Explorer 右键“${operationLabel}”已执行：目标 \`${path}\`${targetNotice}。${renameMigrationNotice}${createApplyNotice}${deleteCleanupNotice}文件树同步状态：${frontendRefreshStatusLabel}；Git 快照状态：${result.commit_status_label}；协作事件状态：${result.collaboration_event_status}。`,
        statusContent: hasSyncFailure ? `Explorer ${operationLabel}已执行但同步失败` : `Explorer ${operationLabel}已执行`,
        suggestedActions,
        engineeringState: buildExplorerContextOperationAppliedState(operation, path, targetPath, result, frontendRefreshFailure, renameLocalMigration, createLocalApply, deleteLocalCleanup),
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      const failureMessage = formatWorkspaceResourceOperationFailure(error, '请稍后重试');
      applyIdeInteractionMessages((prev) => [...prev, {
        id: `explorer-context-operation-failed-${Date.now()}`,
        role: 'assistant',
        kind: 'workflow',
        content: `Explorer 右键“${operationLabel}”失败：${failureMessage}。未按该失败操作更新 Workspace 文件树或编辑器缓存；请修复原因后重试。`,
        statusContent: `Explorer ${operationLabel}失败`,
        engineeringState: buildExplorerContextOperationFailureState(operation, path, failureMessage),
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [
    activeFile,
    closeDeletedWorkspacePath,
    files,
    isExplorerDeleteLocalCleanupPointerCleared,
    isFileDirty,
    isSameOrDescendantPath,
    mobileEditingFile,
    openFiles,
    pendingCloseFile,
    projectInfo,
    reflectFilePathInTree,
    refreshProjectFileTree,
    removeFilePathFromWorkspaceTree,
    renameFilePathInWorkspaceTree,
    savedFiles,
    applyIdeInteractionMessages,
    setActiveFile,
    setContextMenu,
    setExplorerSnapshotStatus,
    setEditorBufferStatuses,
    setFiles,
    setMobileEditingFile,
    setOpenFiles,
    setPendingCloseFile,
    setSavedFiles,
  ]);

  const handleUnavailableExplorerContextOperation = useCallback((
    operation: WorkspaceExplorerContextOperation,
    node: FileNode | null,
  ) => {
    if (hasWorkspaceIdeInteractionFileNode(node) === false) return;
    const operationLabel = getWorkspaceExplorerContextOperationLabel(operation);
    setContextMenu(null);
    applyIdeInteractionMessages((prev) => [...prev, {
      id: `explorer-context-operation-unavailable-${Date.now()}`,
      role: 'assistant',
      kind: 'workflow',
      content: `Explorer 右键“${operationLabel}”暂不可用：当前尚未接入后端文件系统事务 API，因此没有对 \`${node.path}\` 执行任何文件系统操作，Workspace 文件树和编辑器缓存保持不变。`,
      statusContent: `Explorer ${operationLabel}暂不可用`,
      engineeringState: buildUnavailableExplorerContextOperationState(operation, node.path),
      timestamp: new Date().toISOString(),
    }]);
  }, [applyIdeInteractionMessages, setContextMenu]);

  const downloadFile = useCallback((path: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getWorkspaceIdeInteractionDownloadFileName(path);
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    expandAncestorFolders,
    reflectFilePathInTree,
    isFileDirty,
    closeWorkspaceFile,
    requestCloseWorkspaceFile,
    applyIncrementalWorkflowStep,
    openWorkspaceFile,
    toggleFolder,
    showContextMenu,
    handleExplorerContextOperation,
    handleUnavailableExplorerContextOperation,
    downloadFile,
  };
}
