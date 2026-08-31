'use client';

import type { FileNode } from '@/lib/types';
import { cn } from '@/lib/utils';

import type {
  WorkspaceExplorerContextOperation,
  WorkspaceExplorerOperationConfirmationRiskLevel,
  WorkspaceExplorerOperationConfirmationSnapshot,
  WorkspaceExplorerOperationConfirmationSnapshotAction,
  WorkspaceExplorerOperationConfirmationSnapshotSource,
  WorkspaceExplorerOperationConfirmationSnapshotStatus,
} from './workspace-types';

function resolveExplorerOperationAction(
  operation: WorkspaceExplorerContextOperation | null,
): WorkspaceExplorerOperationConfirmationSnapshotAction {
  if (operation === null) {
    return 'none';
  }

  const isCreateOperation = isWorkspaceExplorerOperationConfirmationCreateOperation(operation);
  if (isCreateOperation === true) {
    return 'create';
  }

  const isRenameOperation = isWorkspaceExplorerOperationConfirmationRenameOperation(operation);
  if (isRenameOperation === true) {
    return 'rename';
  }

  return 'delete';
}

function isWorkspaceExplorerOperationConfirmationCreateOperation(
  operation: WorkspaceExplorerContextOperation,
): boolean {
  if (operation === 'create_file') {
    return true;
  }

  if (operation === 'create_directory') {
    return true;
  }

  return false;
}

function isWorkspaceExplorerOperationConfirmationRenameOperation(
  operation: WorkspaceExplorerContextOperation,
): boolean {
  if (operation === 'rename_file') {
    return true;
  }

  if (operation === 'rename_directory') {
    return true;
  }

  return false;
}

function getWorkspaceExplorerOperationConfirmationOperationLabel(
  operation: WorkspaceExplorerContextOperation | null,
): WorkspaceExplorerContextOperation | 'none' {
  const hasOperation = operation !== null;

  return hasOperation === true ? operation : 'none';
}

function getWorkspaceExplorerOperationConfirmationTrimmedValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();
  const hasTrimmedValue = trimmedValue.length > 0;

  return hasTrimmedValue === true ? trimmedValue : null;
}

function hasWorkspaceExplorerOperationConfirmationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceExplorerOperationConfirmationNodePath(node: FileNode | null): string | null {
  if (node === null) {
    return null;
  }

  return node.path;
}

function getWorkspaceExplorerOperationConfirmationNodeName(node: FileNode | null): string | null {
  if (node === null) {
    return null;
  }

  return node.name;
}

function hasWorkspaceExplorerOperationConfirmationInputError(inputError: string | null): boolean {
  if (inputError === null) {
    return false;
  }

  return inputError.length > 0;
}

function hasWorkspaceExplorerOperationConfirmationPendingOperation({
  hasOperation,
  hasNode,
}: {
  hasOperation: boolean;
  hasNode: boolean;
}): boolean {
  if (hasOperation === false) {
    return false;
  }

  return hasNode === true;
}

function hasWorkspaceExplorerOperationConfirmationRiskCount(count: number): boolean {
  const hasCount = count > 0;
  return hasCount === true;
}

function shouldRequireWorkspaceExplorerOperationConfirmationTargetPath(
  action: WorkspaceExplorerOperationConfirmationSnapshotAction,
): boolean {
  if (action === 'none') {
    return false;
  }

  return true;
}

function hasWorkspaceExplorerOperationConfirmationMediumRenameRisk({
  savedCacheTargetCount,
  openTargetCount,
}: {
  savedCacheTargetCount: number;
  openTargetCount: number;
}): boolean {
  const hasSavedCacheTargets = hasWorkspaceExplorerOperationConfirmationRiskCount(savedCacheTargetCount);
  if (hasSavedCacheTargets === true) {
    return true;
  }

  const hasOpenTargets = hasWorkspaceExplorerOperationConfirmationRiskCount(openTargetCount);
  if (hasOpenTargets === true) {
    return true;
  }

  return false;
}

function resolveExplorerOperationRiskLevel({
  action,
  dirtyTargetCount,
  savedCacheTargetCount,
  openTargetCount,
}: {
  action: WorkspaceExplorerOperationConfirmationSnapshotAction;
  dirtyTargetCount: number;
  savedCacheTargetCount: number;
  openTargetCount: number;
}): WorkspaceExplorerOperationConfirmationRiskLevel {
  if (action === 'none') {
    return 'none';
  }

  const hasDirtyTargets = hasWorkspaceExplorerOperationConfirmationRiskCount(dirtyTargetCount);
  if (hasDirtyTargets === true) {
    return 'high';
  }

  const hasSavedCacheTargets = hasWorkspaceExplorerOperationConfirmationRiskCount(savedCacheTargetCount);
  if (action === 'delete') {
    if (hasSavedCacheTargets === true) {
      return 'medium';
    }
  }

  const hasMediumRenameRisk = hasWorkspaceExplorerOperationConfirmationMediumRenameRisk({
    savedCacheTargetCount,
    openTargetCount,
  });
  if (action === 'rename') {
    if (hasMediumRenameRisk === true) {
      return 'medium';
    }
  }

  return 'low';
}

function canConfirmWorkspaceExplorerOperationConfirmation({
  hasPendingOperation,
  hasInputError,
  isSubmitting,
  requiresTargetPath,
  hasTargetPath,
}: {
  hasPendingOperation: boolean;
  hasInputError: boolean;
  isSubmitting: boolean;
  requiresTargetPath: boolean;
  hasTargetPath: boolean;
}): boolean {
  if (hasPendingOperation === false) {
    return false;
  }

  if (hasInputError === true) {
    return false;
  }

  if (isSubmitting === true) {
    return false;
  }

  if (requiresTargetPath === true) {
    if (hasTargetPath === false) {
      return false;
    }
  }

  return true;
}

function canCancelWorkspaceExplorerOperationConfirmation({
  hasPendingOperation,
  isSubmitting,
}: {
  hasPendingOperation: boolean;
  isSubmitting: boolean;
}): boolean {
  if (hasPendingOperation === false) {
    return false;
  }

  if (isSubmitting === true) {
    return false;
  }

  return true;
}

function getWorkspaceExplorerOperationConfirmationSnapshotStatus({
  hasPendingOperation,
  isSubmitting,
  hasInputError,
  hasTargetPath,
}: {
  hasPendingOperation: boolean;
  isSubmitting: boolean;
  hasInputError: boolean;
  hasTargetPath: boolean;
}): WorkspaceExplorerOperationConfirmationSnapshotStatus {
  if (hasPendingOperation === false) {
    return 'closed';
  }

  if (isSubmitting === true) {
    return 'confirming';
  }

  if (hasInputError === true) {
    return 'blocked';
  }

  if (hasTargetPath === false) {
    return 'awaiting_input';
  }

  return 'awaiting_confirmation';
}

function getWorkspaceExplorerOperationConfirmationSnapshotSource(
  hasPendingOperation: boolean,
): WorkspaceExplorerOperationConfirmationSnapshotSource {
  if (hasPendingOperation === true) {
    return 'explorer_context_operation';
  }

  return 'dialog_state';
}

function getWorkspaceExplorerOperationConfirmationSnapshotMessage({
  hasPendingOperation,
  isSubmitting,
  hasInputError,
  labelLabel,
}: {
  hasPendingOperation: boolean;
  isSubmitting: boolean;
  hasInputError: boolean;
  labelLabel: string;
}): string {
  if (hasPendingOperation === false) {
    return '当前没有待确认的 Explorer 文件事务。';
  }

  if (isSubmitting === true) {
    return `正在执行 Explorer ${labelLabel} 事务。`;
  }

  if (hasInputError === true) {
    return `Explorer ${labelLabel} 事务被本地输入校验阻断。`;
  }

  return `Explorer ${labelLabel} 事务等待确认。`;
}

function getWorkspaceExplorerOperationConfirmationSnapshotRecovery(hasPendingOperation: boolean): string {
  if (hasPendingOperation === true) {
    return '确认后只调用既有 Explorer context operation 后端事务链路；取消不会调用后端事务 API。风险计数来自当前 editor buffer、saved cache 与打开标签页。';
  }

  return '从 Explorer 右键菜单重新选择新建、重命名或删除操作后再确认。';
}

export function buildWorkspaceExplorerOperationConfirmationSnapshot({
  operation,
  node,
  label,
  inputName,
  targetPath,
  inputError,
  isSubmitting,
  dirtyTargetCount,
  savedCacheTargetCount,
  openTargetCount,
}: {
  operation: WorkspaceExplorerContextOperation | null;
  node: FileNode | null;
  label: string;
  inputName: string;
  targetPath: string | null;
  inputError: string | null;
  isSubmitting: boolean;
  dirtyTargetCount: number;
  savedCacheTargetCount: number;
  openTargetCount: number;
}): WorkspaceExplorerOperationConfirmationSnapshot {
  const action = resolveExplorerOperationAction(operation);
  const hasOperation = operation !== null;
  const hasNode = node !== null;
  const hasPendingOperation = hasWorkspaceExplorerOperationConfirmationPendingOperation({
    hasOperation,
    hasNode,
  });
  const operationLabel = getWorkspaceExplorerOperationConfirmationOperationLabel(operation);
  const hasLabel = hasWorkspaceExplorerOperationConfirmationTextValue(label);
  const labelLabel = hasLabel === true ? label : 'none';
  const normalizedInputName = inputName.trim();
  const normalizedTargetPath = getWorkspaceExplorerOperationConfirmationTrimmedValue(targetPath);
  const nodePath = getWorkspaceExplorerOperationConfirmationNodePath(node);
  const nodeName = getWorkspaceExplorerOperationConfirmationNodeName(node);
  const hasInputName = hasWorkspaceExplorerOperationConfirmationTextValue(normalizedInputName);
  const inputNameValue = hasInputName === true ? normalizedInputName : null;
  const isCreateOperation = action === 'create';
  const isRenameOperation = action === 'rename';
  const isDeleteOperation = action === 'delete';
  const hasInputError = hasWorkspaceExplorerOperationConfirmationInputError(inputError);
  const hasTargetPath = hasWorkspaceExplorerOperationConfirmationTextValue(normalizedTargetPath);
  const targetPathValue = hasTargetPath === true ? normalizedTargetPath : null;
  const requiresTargetPath = shouldRequireWorkspaceExplorerOperationConfirmationTargetPath(action);
  const canConfirm = canConfirmWorkspaceExplorerOperationConfirmation({
    hasPendingOperation,
    hasInputError,
    isSubmitting,
    requiresTargetPath,
    hasTargetPath,
  });
  const canCancel = canCancelWorkspaceExplorerOperationConfirmation({
    hasPendingOperation,
    isSubmitting,
  });
  const status = getWorkspaceExplorerOperationConfirmationSnapshotStatus({
    hasPendingOperation,
    isSubmitting,
    hasInputError,
    hasTargetPath,
  });
  const source = getWorkspaceExplorerOperationConfirmationSnapshotSource(hasPendingOperation);
  const riskLevel: WorkspaceExplorerOperationConfirmationRiskLevel = resolveExplorerOperationRiskLevel({
    action,
    dirtyTargetCount,
    savedCacheTargetCount,
    openTargetCount,
  });

  return {
    status,
    source,
    operation: operationLabel,
    action,
    label: labelLabel,
    nodePath,
    nodeName,
    inputName: inputNameValue,
    targetPath: targetPathValue,
    inputError,
    hasPendingOperation,
    hasTargetPath,
    isCreateOperation,
    isRenameOperation,
    isDeleteOperation,
    dirtyTargetCount,
    savedCacheTargetCount,
    openTargetCount,
    canConfirm,
    canCancel,
    riskLevel,
    message: getWorkspaceExplorerOperationConfirmationSnapshotMessage({
      hasPendingOperation,
      isSubmitting,
      hasInputError,
      labelLabel,
    }),
    recovery: getWorkspaceExplorerOperationConfirmationSnapshotRecovery(hasPendingOperation),
    updatedAt: 'derived',
  };
}

function hasWorkspaceExplorerOperationConfirmationDestructiveSnapshot(
  snapshot: WorkspaceExplorerOperationConfirmationSnapshot,
): boolean {
  if (snapshot.status === 'blocked') {
    return true;
  }

  return snapshot.riskLevel === 'high';
}

function getWorkspaceExplorerOperationConfirmationSnapshotClassName(snapshot: WorkspaceExplorerOperationConfirmationSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  const hasDestructiveSnapshot = hasWorkspaceExplorerOperationConfirmationDestructiveSnapshot(snapshot);
  if (hasDestructiveSnapshot === true) {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  if (snapshot.riskLevel === 'medium') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
}

function getWorkspaceExplorerOperationConfirmationSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspaceExplorerOperationConfirmationTextValue(value);

  return hasValue === true ? value : fallback;
}

function getWorkspaceExplorerOperationConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function shouldRenderWorkspaceExplorerOperationConfirmationInputError(hasInputError: boolean): boolean {
  return hasInputError === true;
}

export function WorkspaceExplorerOperationConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: WorkspaceExplorerOperationConfirmationSnapshot;
}) {
  const targetPathLabel = getWorkspaceExplorerOperationConfirmationSnapshotLabel(snapshot.targetPath, 'none');
  const inputNameLabel = getWorkspaceExplorerOperationConfirmationSnapshotLabel(snapshot.inputName, 'none');
  const nodePathLabel = getWorkspaceExplorerOperationConfirmationSnapshotLabel(snapshot.nodePath, 'none');
  const canConfirmLabel = getWorkspaceExplorerOperationConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getWorkspaceExplorerOperationConfirmationSnapshotBooleanLabel(snapshot.canCancel);
  const hasInputError = hasWorkspaceExplorerOperationConfirmationInputError(snapshot.inputError);
  const shouldRenderInputError = shouldRenderWorkspaceExplorerOperationConfirmationInputError(hasInputError);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-explorer-operation-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getWorkspaceExplorerOperationConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Explorer 文件事务确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Operation: {snapshot.operation}</span>
        <span>Action: {snapshot.action}</span>
        <span>Target: {targetPathLabel}</span>
        <span>Input: {inputNameLabel}</span>
        <span>Dirty: {snapshot.dirtyTargetCount}</span>
        <span>Saved: {snapshot.savedCacheTargetCount}</span>
        <span>Open: {snapshot.openTargetCount}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      {shouldRenderInputError === true && <p className="mt-1 text-destructive">{snapshot.inputError}</p>}
      <p className="mt-1 truncate opacity-80">源路径：{nodePathLabel}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
