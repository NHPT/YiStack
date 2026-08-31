import { cn } from '@/lib/utils';
import type { Project } from '@/lib/api';

import type {
  ProjectActionConfirmationDialogSnapshot,
  ProjectActionConfirmationDialogSnapshotSource,
  ProjectActionConfirmationDialogSnapshotStatus,
  ProjectActionConfirmationKind,
  ProjectActionConfirmationRiskLevel,
} from '../workspace/workspace-types';

export type ProjectActionConfirmation = {
  kind: ProjectActionConfirmationKind;
  project: Project;
  backupId?: string;
  title: string;
  description: string;
  confirmLabel: string;
  riskLevel: ProjectActionConfirmationRiskLevel;
  recovery: string;
};

export type ProjectActionConfirmationKindList = readonly ProjectActionConfirmationKind[];
export type ProjectActionConfirmationBackupKindList = ProjectActionConfirmationKindList;
export type ProjectActionConfirmationResourceKindList = ProjectActionConfirmationKindList;
export type ProjectActionConfirmationDialogValue = string;
type ProjectActionConfirmationDialogBooleanFactList = readonly boolean[];
type ProjectActionConfirmationDialogSnapshotStatusList = readonly ProjectActionConfirmationDialogSnapshotStatus[];
type ProjectActionConfirmationRiskLevelList = readonly ProjectActionConfirmationRiskLevel[];

const PROJECT_ACTION_CONFIRMATION_BACKUP_KINDS: ProjectActionConfirmationBackupKindList = [
  'backup_create',
  'backup_auto_run',
  'backup_remote_upload',
  'backup_remote_download',
  'backup_restore',
  'backup_remote_restore',
];

const PROJECT_ACTION_CONFIRMATION_BACKUP_REQUIRED_KINDS: ProjectActionConfirmationBackupKindList = [
  'backup_remote_upload',
  'backup_remote_download',
  'backup_restore',
  'backup_remote_restore',
];

const PROJECT_ACTION_CONFIRMATION_RESOURCE_KINDS: ProjectActionConfirmationResourceKindList = [
  'resource_alert_event_create',
  'resource_alert_notification_send',
  'resource_alert_enforcement_execute',
];

const PROJECT_ACTION_CONFIRMATION_WARNING_STATUSES: ProjectActionConfirmationDialogSnapshotStatusList = [
  'awaiting_confirmation',
];

const PROJECT_ACTION_CONFIRMATION_WARNING_RISK_LEVELS: ProjectActionConfirmationRiskLevelList = [
  'high',
];

function hasProjectActionConfirmationTrueFact(
  values: ProjectActionConfirmationDialogBooleanFactList,
): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function isProjectActionConfirmationKindIn(
  kind: ProjectActionConfirmationKind | 'none',
  kinds: ProjectActionConfirmationKindList,
): boolean {
  if (kind === 'none') {
    return false;
  }

  for (const candidate of kinds) {
    if (candidate === kind) {
      return true;
    }
  }

  return false;
}

function isProjectActionConfirmationStatusIn(
  status: ProjectActionConfirmationDialogSnapshotStatus,
  statuses: ProjectActionConfirmationDialogSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    if (candidate === status) {
      return true;
    }
  }

  return false;
}

function isProjectActionConfirmationRiskLevelIn(
  riskLevel: ProjectActionConfirmationRiskLevel,
  riskLevels: ProjectActionConfirmationRiskLevelList,
): boolean {
  for (const candidate of riskLevels) {
    if (candidate === riskLevel) {
      return true;
    }
  }

  return false;
}

function hasProjectActionConfirmationBackupContext(requiresBackup: boolean, hasBackupId: boolean): boolean {
  if (requiresBackup === false) {
    return true;
  }

  if (hasBackupId === true) {
    return true;
  }

  return false;
}

function shouldUseProjectActionConfirmationWarningTone(
  snapshot: ProjectActionConfirmationDialogSnapshot,
): boolean {
  const hasWarningStatus = isProjectActionConfirmationStatusIn(
    snapshot.status,
    PROJECT_ACTION_CONFIRMATION_WARNING_STATUSES,
  );
  const hasWarningRiskLevel = isProjectActionConfirmationRiskLevelIn(
    snapshot.riskLevel,
    PROJECT_ACTION_CONFIRMATION_WARNING_RISK_LEVELS,
  );
  return hasProjectActionConfirmationTrueFact([hasWarningStatus, hasWarningRiskLevel]);
}

function resolveProjectActionConfirmationDialogSnapshotSource(
  kind: ProjectActionConfirmationKind | 'none',
): ProjectActionConfirmationDialogSnapshotSource {
  if (kind === 'runtime_stop') {
    return 'runtime_stop';
  }

  if (kind === 'delete_restore') {
    return 'project_delete';
  }

  if (isProjectActionConfirmationKindIn(kind, PROJECT_ACTION_CONFIRMATION_BACKUP_KINDS)) {
    return 'project_backup';
  }

  if (isProjectActionConfirmationKindIn(kind, PROJECT_ACTION_CONFIRMATION_RESOURCE_KINDS)) {
    return 'project_resource';
  }

  return 'dialog_state';
}

function hasProjectActionConfirmationBackupRequirement(kind: ProjectActionConfirmationKind | 'none') {
  return isProjectActionConfirmationKindIn(kind, PROJECT_ACTION_CONFIRMATION_BACKUP_REQUIRED_KINDS);
}

export function hasProjectActionConfirmationDialogValue(
  value: ProjectActionConfirmationDialogValue | null | undefined,
): value is ProjectActionConfirmationDialogValue {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function getProjectActionConfirmationDialogValue(
  value: ProjectActionConfirmationDialogValue | null | undefined,
  fallback: ProjectActionConfirmationDialogValue,
): ProjectActionConfirmationDialogValue {
  const hasValue = hasProjectActionConfirmationDialogValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

export function getProjectActionConfirmationDialogNullableValue(
  value: ProjectActionConfirmationDialogValue | null | undefined,
): ProjectActionConfirmationDialogValue | null {
  const hasValue = hasProjectActionConfirmationDialogValue(value);
  if (hasValue === false) {
    return null;
  }

  return value;
}

export function buildProjectActionConfirmationDialogSnapshot({
  confirmation,
  isConfirming,
}: {
  confirmation: ProjectActionConfirmation | null;
  isConfirming: boolean;
}): ProjectActionConfirmationDialogSnapshot {
  const hasConfirmation = confirmation !== null;
  const kind = hasConfirmation === true ? confirmation.kind : 'none';
  const source = resolveProjectActionConfirmationDialogSnapshotSource(kind);
  const projectId = hasConfirmation === true
    ? getProjectActionConfirmationDialogNullableValue(confirmation.project.project_id)
    : null;
  const projectName = hasConfirmation === true
    ? getProjectActionConfirmationDialogNullableValue(confirmation.project.name)
    : null;
  const hasProject = hasProjectActionConfirmationDialogValue(projectId);
  const backupId = hasConfirmation === true
    ? getProjectActionConfirmationDialogNullableValue(confirmation.backupId)
    : null;
  const hasBackupId = hasProjectActionConfirmationDialogValue(backupId);
  const requiresBackup = hasProjectActionConfirmationBackupRequirement(kind);
  const hasBackup = hasProjectActionConfirmationBackupContext(requiresBackup, hasBackupId);
  const canConfirm = hasConfirmation === true
    && hasProject === true
    && hasBackup === true
    && isConfirming === false;
  const canCancel = hasConfirmation === true && isConfirming === false;
  const status: ProjectActionConfirmationDialogSnapshotStatus = hasConfirmation === true
    ? isConfirming === true
      ? 'confirming'
      : 'awaiting_confirmation'
    : 'closed';

  return {
    status,
    source,
    kind,
    projectId,
    projectName,
    backupId,
    isConfirming,
    hasProject,
    hasBackup,
    canConfirm,
    canCancel,
    riskLevel: hasConfirmation === true ? confirmation.riskLevel : 'medium',
    message: status === 'closed'
      ? '项目受控操作确认弹窗未打开。'
      : status === 'confirming'
        ? '项目受控操作正在提交，确认与取消入口暂时锁定。'
        : kind === 'runtime_stop'
          ? '项目运行时停止确认已打开，等待用户确认 stop_container。'
          : kind === 'delete_restore'
            ? '项目软删除恢复确认已打开，等待用户确认恢复项目记录。'
          : requiresBackup
          ? kind === 'backup_remote_upload'
            ? '项目备份远端上传确认已打开，等待用户确认上传归档和 manifest。'
            : kind === 'backup_remote_download'
              ? '项目备份远端下载导入确认已打开，等待用户确认导入完整远端候选。'
              : '项目备份恢复确认已打开，等待用户确认 confirm_restore。'
          : kind === 'backup_create'
            ? '项目手动备份创建确认已打开，等待用户确认创建归档和 manifest。'
            : kind === 'backup_auto_run'
              ? '项目自动备份策略执行确认已打开，等待用户确认执行一次策略备份。'
          : kind === 'resource_alert_enforcement_execute'
            ? '项目资源告警硬配额执行确认已打开，等待用户确认 stop_container。'
            : kind === 'resource_alert_notification_send'
              ? '项目资源告警通知发送确认已打开，等待用户确认 webhook 发送。'
              : '项目资源告警事件创建确认已打开，等待用户确认 append-only 事件写入。',
    recovery: hasConfirmation === true
      ? getProjectActionConfirmationDialogValue(
        confirmation.recovery,
        '打开受控操作确认弹窗后会显示风险边界和恢复建议。',
      )
      : '打开受控操作确认弹窗后会显示风险边界和恢复建议。',
    updatedAt: 'derived',
  };
}

function getProjectActionConfirmationSnapshotClassName(snapshot: ProjectActionConfirmationDialogSnapshot) {
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }

  const hasWarningTone = shouldUseProjectActionConfirmationWarningTone(snapshot);
  if (hasWarningTone === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }

  return 'border-border bg-background/70 text-muted-foreground';
}

function getProjectActionConfirmationSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasProjectActionConfirmationDialogValue(value);

  return hasValue === true ? value : fallback;
}

function getProjectActionConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function ProjectActionConfirmationDialogSnapshotStrip({
  snapshot,
}: {
  snapshot: ProjectActionConfirmationDialogSnapshot;
}) {
  const projectIdLabel = getProjectActionConfirmationSnapshotLabel(snapshot.projectId, 'none');
  const backupIdLabel = getProjectActionConfirmationSnapshotLabel(snapshot.backupId, 'none');
  const isConfirmingLabel = getProjectActionConfirmationSnapshotBooleanLabel(snapshot.isConfirming);
  const canConfirmLabel = getProjectActionConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getProjectActionConfirmationSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="project-action-confirmation-dialog-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getProjectActionConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">项目受控操作确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Kind: {snapshot.kind}</span>
        <span>Project: {projectIdLabel}</span>
        <span>Backup: {backupIdLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Confirming: {isConfirmingLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
