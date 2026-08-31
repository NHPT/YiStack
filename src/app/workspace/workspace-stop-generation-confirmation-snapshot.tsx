import { cn } from '@/lib/utils';

import type {
  StopGenerationConfirmationRiskLevel,
  StopGenerationConfirmationSnapshot,
  StopGenerationConfirmationSnapshotAction,
  StopGenerationConfirmationSnapshotSource,
  StopGenerationConfirmationSnapshotStatus,
} from './workspace-types';

function getStopGenerationConfirmationNullableText(value: string | null): string | null {
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

function hasStopGenerationConfirmationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function buildStopGenerationConfirmationSnapshot({
  isStopConfirming,
  isPlanning,
  isGenerating,
  projectId,
  projectName,
  isPersistedProject,
  prompt,
}: {
  isStopConfirming: boolean;
  isPlanning: boolean;
  isGenerating: boolean;
  projectId: string | null;
  projectName: string | null;
  isPersistedProject: boolean;
  prompt: string;
}): StopGenerationConfirmationSnapshot {
  const normalizedProjectId = getStopGenerationConfirmationNullableText(projectId);
  const normalizedProjectName = getStopGenerationConfirmationNullableText(projectName);
  const promptLength = prompt.trim().length;
  const hasProject = hasStopGenerationConfirmationTextValue(normalizedProjectId);
  const isBusy = isPlanning === true || isGenerating === true;
  const hasBackendStopSync = isPersistedProject === true && hasProject === true;
  const canConfirm = isStopConfirming === true && isBusy === true;
  const canCancel = isStopConfirming === true;
  const status: StopGenerationConfirmationSnapshotStatus = isStopConfirming
    ? 'awaiting_confirmation'
    : 'closed';
  const source: StopGenerationConfirmationSnapshotSource = isStopConfirming ? 'stop_control' : 'generation_state';
  const action: StopGenerationConfirmationSnapshotAction = isStopConfirming ? 'stop_generation' : 'none';
  const riskLevel: StopGenerationConfirmationRiskLevel = isStopConfirming ? 'medium' : 'none';

  return {
    status,
    source,
    action,
    projectId: normalizedProjectId,
    projectName: normalizedProjectName,
    hasProject,
    isPersistedProject,
    isPlanning,
    isGenerating,
    promptLength,
    hasBackendStopSync,
    canConfirm,
    canCancel,
    riskLevel,
    message: isStopConfirming
      ? '停止生成等待确认；确认后会中断本地生成或规划流。'
      : '当前没有待确认的停止生成动作。',
    recovery: isStopConfirming
      ? hasBackendStopSync === true
        ? '确认后会持久化本地 interrupted 状态、abort 当前规划/生成流，并向后端同步 stopGeneration；取消不会中断本地流，也不会发送后端停止请求。'
        : '确认后只会中断当前本地规划/生成流；当前项目未持久化或缺少项目标识，因此不会发送后端 stopGeneration 同步请求。'
      : '点击停止生成会先进入确认边界，再允许执行本地 abort 与后端停止同步。',
    updatedAt: 'derived',
  };
}

function getStopGenerationConfirmationSnapshotClassName(snapshot: StopGenerationConfirmationSnapshot) {
  if (snapshot.status === 'awaiting_confirmation') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getStopGenerationConfirmationSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasStopGenerationConfirmationTextValue(value);

  return hasValue === true ? value : fallback;
}

function getStopGenerationConfirmationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function StopGenerationConfirmationSnapshotStrip({
  snapshot,
  compact,
}: {
  snapshot: StopGenerationConfirmationSnapshot;
  compact?: boolean;
}) {
  const projectIdLabel = getStopGenerationConfirmationSnapshotLabel(snapshot.projectId, 'none');
  const isPersistedProjectLabel = getStopGenerationConfirmationSnapshotBooleanLabel(snapshot.isPersistedProject);
  const isPlanningLabel = getStopGenerationConfirmationSnapshotBooleanLabel(snapshot.isPlanning);
  const isGeneratingLabel = getStopGenerationConfirmationSnapshotBooleanLabel(snapshot.isGenerating);
  const hasBackendStopSyncLabel = getStopGenerationConfirmationSnapshotBooleanLabel(snapshot.hasBackendStopSync);
  const canConfirmLabel = getStopGenerationConfirmationSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getStopGenerationConfirmationSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-stop-generation-confirmation-snapshot"
      className={cn(
        'rounded-lg border px-3 py-2',
        compact ? 'text-[11px]' : 'text-xs',
        getStopGenerationConfirmationSnapshotClassName(snapshot),
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">停止生成确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {snapshot.action}</span>
        <span>Project: {projectIdLabel}</span>
        <span>Persisted: {isPersistedProjectLabel}</span>
        <span>Planning: {isPlanningLabel}</span>
        <span>Generating: {isGeneratingLabel}</span>
        <span>BackendStop: {hasBackendStopSyncLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Updated: {snapshot.updatedAt}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
