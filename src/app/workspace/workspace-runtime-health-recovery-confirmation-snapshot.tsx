import { cn } from '@/lib/utils';

import type {
  RuntimeHealthRecoveryConfirmationRiskLevel,
  RuntimeHealthRecoveryConfirmationReasonCode,
  RuntimeHealthRecoveryConfirmationSnapshot,
  RuntimeHealthRecoveryConfirmationSnapshotAction,
  RuntimeHealthRecoveryConfirmationSnapshotSource,
  RuntimeHealthRecoveryConfirmationSnapshotStatus,
} from './workspace-types';

function getRuntimeHealthRecoveryConfirmationReasonCode(
  reasonCode: RuntimeHealthRecoveryConfirmationReasonCode | null,
): RuntimeHealthRecoveryConfirmationReasonCode | null {
  const hasReasonCode = reasonCode !== null;
  if (hasReasonCode === false) {
    return null;
  }

  return reasonCode;
}

function getRuntimeHealthRecoveryConfirmationNullableText(value: string | null): string | null {
  const hasValue = value !== null;
  if (hasValue === false) {
    return null;
  }

  const trimmedValue = value.trim();
  const hasTrimmedValue = trimmedValue.length > 0;
  if (hasTrimmedValue === false) {
    return null;
  }

  return trimmedValue;
}

function hasRuntimeHealthRecoveryConfirmationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function buildRuntimeHealthRecoveryConfirmationSnapshot({
  isOpen,
  isConfirming,
  actionLabel,
  actionDescription,
  reasonCode,
}: {
  isOpen: boolean;
  isConfirming: boolean;
  actionLabel: string | null;
  actionDescription: string | null;
  reasonCode: RuntimeHealthRecoveryConfirmationReasonCode | null;
}): RuntimeHealthRecoveryConfirmationSnapshot {
  const normalizedReasonCode = getRuntimeHealthRecoveryConfirmationReasonCode(reasonCode);
  const normalizedActionLabel = getRuntimeHealthRecoveryConfirmationNullableText(actionLabel);
  const normalizedActionDescription = getRuntimeHealthRecoveryConfirmationNullableText(actionDescription);
  const hasActionLabel = hasRuntimeHealthRecoveryConfirmationTextValue(normalizedActionLabel);
  const hasReasonCode = normalizedReasonCode !== null;
  const hasRecoveryAction = hasActionLabel === true && hasReasonCode === true;
  const canConfirm = isOpen === true && hasRecoveryAction === true && isConfirming === false;
  const canCancel = isOpen === true && isConfirming === false;
  const status: RuntimeHealthRecoveryConfirmationSnapshotStatus = isOpen
    ? isConfirming
      ? 'confirming'
      : 'awaiting_confirmation'
    : 'closed';
  const source: RuntimeHealthRecoveryConfirmationSnapshotSource = isOpen ? 'runtime_health_recovery' : 'dialog_state';
  const action: RuntimeHealthRecoveryConfirmationSnapshotAction = hasRecoveryAction ? 'recover_runtime' : 'none';
  const riskLevel: RuntimeHealthRecoveryConfirmationRiskLevel = hasRecoveryAction ? 'medium' : 'none';

  return {
    status,
    source,
    action,
    reasonCode: normalizedReasonCode,
    actionLabel: normalizedActionLabel,
    actionDescription: normalizedActionDescription,
    hasRecoveryAction,
    canConfirm,
    canCancel,
    riskLevel,
    message: isOpen
      ? isConfirming
        ? 'Runtime Health 恢复运行时正在执行。'
        : 'Runtime Health 恢复运行时等待确认。'
      : '当前没有待确认的 Runtime Health 恢复动作。',
    recovery: isOpen
      ? '确认后仍复用既有 start 容器与 runtime-status readiness 链路；取消不会触发后端 start/wait，也不会刷新 Explorer 或 Git 真源。'
      : '当 Runtime Health 派生模型暴露恢复动作后，点击恢复运行时会先打开确认边界。',
    updatedAt: 'derived',
  };
}

function getRuntimeHealthRecoveryConfirmationSnapshotClassName(
  snapshot: RuntimeHealthRecoveryConfirmationSnapshot,
) {
  if (snapshot.status === 'confirming') {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200';
  }
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  }
  return 'border-muted bg-muted/30 text-muted-foreground';
}

function getRuntimeHealthRecoveryConfirmationSnapshotLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const hasValue = hasRuntimeHealthRecoveryConfirmationTextValue(value);

  return hasValue === true ? value : fallback;
}

function getRuntimeHealthRecoveryConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function RuntimeHealthRecoveryConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: RuntimeHealthRecoveryConfirmationSnapshot;
}) {
  const reasonCodeLabel = getRuntimeHealthRecoveryConfirmationSnapshotLabel(snapshot.reasonCode, 'none');
  const actionLabel = getRuntimeHealthRecoveryConfirmationSnapshotLabel(snapshot.actionLabel, 'none');
  const actionDescriptionLabel = getRuntimeHealthRecoveryConfirmationSnapshotLabel(
    snapshot.actionDescription,
    'none',
  );
  const canConfirmLabel = getRuntimeHealthRecoveryConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getRuntimeHealthRecoveryConfirmationSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      data-testid="runtime-health-recovery-confirmation-snapshot"
      role="status"
      aria-live="polite"
      className={cn('rounded-md border px-3 py-2 text-xs', getRuntimeHealthRecoveryConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span className="font-medium">Runtime Health 恢复确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Reason: {reasonCodeLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">动作：{actionLabel}</p>
      <p className="mt-1 opacity-80">说明：{actionDescriptionLabel}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
