import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceEngineeringStatus,
} from '@/lib/workspace/engineering-state';

import type {
  EngineeringStatePanelSnapshot,
  EngineeringStatePanelSnapshotSource,
  EngineeringStatePanelSnapshotStatus,
} from './workspace-types';

type EngineeringStateRecoveryActionSummary = {
  actionCount: number;
  primaryActionCount: number;
  retryActionCount: number;
};

type EngineeringStatePanelBooleanFactList = readonly boolean[];

type EngineeringStatePanelSnapshotOptions = {
  state: WorkspaceEngineeringStateSnapshot;
  rowCount: number;
  recoveryActionSummary?: EngineeringStateRecoveryActionSummary;
};

function hasEngineeringStatePanelTrueFact(values: EngineeringStatePanelBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function getEngineeringStatePanelItemCount<TItem>(items: readonly TItem[] | undefined): number {
  if (items === undefined) {
    return 0;
  }

  return items.length;
}

function hasEngineeringStatePanelCount(value: number): boolean {
  const hasCount = value > 0;
  return hasCount === true;
}

function isEngineeringStatePanelStatus(
  status: WorkspaceEngineeringStatus | undefined,
  expectedStatus: WorkspaceEngineeringStatus,
): boolean {
  const hasExpectedStatus = status === expectedStatus;
  return hasExpectedStatus === true;
}

function getEngineeringStateValidationFailureCount(state: WorkspaceEngineeringStateSnapshot): number {
  return getEngineeringStatePanelItemCount(state.validation?.failure_items);
}

function getEngineeringStatePhaseBlockerCount(state: WorkspaceEngineeringStateSnapshot): number {
  return getEngineeringStatePanelItemCount(state.phase?.blockers);
}

function getEngineeringStateBootstrapBlockerCount(state: WorkspaceEngineeringStateSnapshot): number {
  return getEngineeringStatePanelItemCount(state.bootstrap_state?.blockers);
}

function getEngineeringStateBootstrapGateBlockingItemCount(state: WorkspaceEngineeringStateSnapshot): number {
  return getEngineeringStatePanelItemCount(state.bootstrap_state?.gate_result?.blocking_items);
}

function getEngineeringStatePanelRecoveryActionCount(
  recoveryActionSummary: EngineeringStateRecoveryActionSummary | undefined,
): number {
  if (recoveryActionSummary === undefined) {
    return 0;
  }

  return recoveryActionSummary.actionCount;
}

function getEngineeringStatePanelPrimaryActionCount(
  recoveryActionSummary: EngineeringStateRecoveryActionSummary | undefined,
): number {
  if (recoveryActionSummary === undefined) {
    return 0;
  }

  return recoveryActionSummary.primaryActionCount;
}

function getEngineeringStatePanelRetryActionCount(
  recoveryActionSummary: EngineeringStateRecoveryActionSummary | undefined,
): number {
  if (recoveryActionSummary === undefined) {
    return 0;
  }

  return recoveryActionSummary.retryActionCount;
}

function hasEngineeringStatePanelFailedState({
  hasWorkflowFailure,
  hasValidationFailure,
  hasRuntimeFailure,
  hasPhaseFailure,
  hasValidationFailures,
  hasPhaseBlockers,
}: {
  hasWorkflowFailure: boolean;
  hasValidationFailure: boolean;
  hasRuntimeFailure: boolean;
  hasPhaseFailure: boolean;
  hasValidationFailures: boolean;
  hasPhaseBlockers: boolean;
}): boolean {
  return hasEngineeringStatePanelTrueFact([
    hasWorkflowFailure,
    hasValidationFailure,
    hasRuntimeFailure,
    hasPhaseFailure,
    hasValidationFailures,
    hasPhaseBlockers,
  ]);
}

function hasEngineeringStatePanelFoundationBlock({
  hasBootstrapStateBlocked,
  hasBootstrapGateBlocked,
  hasFoundationBlockers,
}: {
  hasBootstrapStateBlocked: boolean;
  hasBootstrapGateBlocked: boolean;
  hasFoundationBlockers: boolean;
}): boolean {
  return hasEngineeringStatePanelTrueFact([
    hasBootstrapStateBlocked,
    hasBootstrapGateBlocked,
    hasFoundationBlockers,
  ]);
}

function hasEngineeringStatePanelRecovery({
  hasRecoveryBlocked,
  hasRecoveryRetry,
  hasRecoveryActions,
}: {
  hasRecoveryBlocked: boolean;
  hasRecoveryRetry: boolean;
  hasRecoveryActions: boolean;
}): boolean {
  return hasEngineeringStatePanelTrueFact([
    hasRecoveryBlocked,
    hasRecoveryRetry,
    hasRecoveryActions,
  ]);
}

function hasEngineeringStatePanelRunningState({
  hasWorkflowRunning,
  hasValidationRunning,
  hasRuntimeRunning,
  hasPhaseRunning,
  hasExecutionAutoProgress,
}: {
  hasWorkflowRunning: boolean;
  hasValidationRunning: boolean;
  hasRuntimeRunning: boolean;
  hasPhaseRunning: boolean;
  hasExecutionAutoProgress: boolean;
}): boolean {
  return hasEngineeringStatePanelTrueFact([
    hasWorkflowRunning,
    hasValidationRunning,
    hasRuntimeRunning,
    hasPhaseRunning,
    hasExecutionAutoProgress,
  ]);
}

function getEngineeringStatePanelSnapshotStatus({
  hasFailedState,
  hasFoundationBlock,
  hasRecovery,
  hasAwaitingConfirmation,
  hasRunningState,
}: {
  hasFailedState: boolean;
  hasFoundationBlock: boolean;
  hasRecovery: boolean;
  hasAwaitingConfirmation: boolean;
  hasRunningState: boolean;
}): EngineeringStatePanelSnapshotStatus {
  if (hasFailedState === true) {
    return 'failed';
  }

  if (hasFoundationBlock === true) {
    return 'foundation_blocked';
  }

  if (hasRecovery === true) {
    return 'recoverable';
  }

  if (hasAwaitingConfirmation === true) {
    return 'awaiting_confirmation';
  }

  if (hasRunningState === true) {
    return 'running';
  }

  return 'ready';
}

function getEngineeringStatePanelSnapshotSource({
  hasFailedState,
  hasValidationFailures,
  hasValidationFailure,
  hasFoundationBlock,
  hasRecovery,
  hasAwaitingConfirmation,
  hasRunningState,
  hasRows,
}: {
  hasFailedState: boolean;
  hasValidationFailures: boolean;
  hasValidationFailure: boolean;
  hasFoundationBlock: boolean;
  hasRecovery: boolean;
  hasAwaitingConfirmation: boolean;
  hasRunningState: boolean;
  hasRows: boolean;
}): EngineeringStatePanelSnapshotSource {
  if (hasFailedState === true) {
    const hasValidationSource = hasEngineeringStatePanelTrueFact([
      hasValidationFailures,
      hasValidationFailure,
    ]);
    if (hasValidationSource === true) {
      return 'validation';
    }

    return 'phase';
  }

  if (hasFoundationBlock === true) {
    return 'foundation';
  }

  if (hasRecovery === true) {
    return 'recovery';
  }

  const hasExecutionSource = hasEngineeringStatePanelTrueFact([
    hasAwaitingConfirmation,
    hasRunningState,
  ]);
  if (hasExecutionSource === true) {
    return 'execution';
  }

  if (hasRows === true) {
    return 'rows';
  }

  return 'phase';
}

function getEngineeringStatePanelSnapshotMessage(status: EngineeringStatePanelSnapshotStatus): string {
  if (status === 'failed') {
    return '工程状态存在失败或阻断项。';
  }

  if (status === 'foundation_blocked') {
    return '项目基础设定当前阻断，需要重试自动准备或补充关键约束。';
  }

  if (status === 'recoverable') {
    return '工程状态提供恢复或重试入口。';
  }

  if (status === 'awaiting_confirmation') {
    return '工程状态正在等待用户确认。';
  }

  if (status === 'running') {
    return '工程状态正在运行或自动推进。';
  }

  return '工程状态面板已就绪。';
}

function getEngineeringStatePanelSnapshotRecovery(status: EngineeringStatePanelSnapshotStatus): string {
  if (status === 'ready') {
    return '继续观察 Workflow、Phase、Validation、Runtime 与 Foundation 子状态。';
  }

  if (status === 'awaiting_confirmation') {
    return '查看确认边界并选择方案或继续动作。';
  }

  if (status === 'running') {
    return '等待当前阶段完成；若卡住，检查阶段任务和下一步。';
  }

  if (status === 'foundation_blocked') {
    return '重试自动准备项目基础设定，或补充 blockers 与必决项对应的关键约束后再恢复 workflow。';
  }

  return '优先处理校验失败项、阶段 blockers 或恢复入口，然后重试 workflow。';
}

export function buildEngineeringStatePanelSnapshot({
  state,
  rowCount,
  recoveryActionSummary,
}: EngineeringStatePanelSnapshotOptions): EngineeringStatePanelSnapshot {
  const validationFailures = getEngineeringStateValidationFailureCount(state);
  const phaseBlockers = getEngineeringStatePhaseBlockerCount(state);
  const bootstrapBlockerCount = getEngineeringStateBootstrapBlockerCount(state);
  const bootstrapGateBlockingItemCount = getEngineeringStateBootstrapGateBlockingItemCount(state);
  const foundationBlockers = bootstrapBlockerCount + bootstrapGateBlockingItemCount;
  const blockerCount = phaseBlockers + foundationBlockers;
  const hasValidationFailures = hasEngineeringStatePanelCount(validationFailures);
  const hasPhaseBlockers = hasEngineeringStatePanelCount(phaseBlockers);
  const hasFoundationBlockers = hasEngineeringStatePanelCount(foundationBlockers);
  const hasWorkflowFailure = isEngineeringStatePanelStatus(state.workflow?.status, 'failed');
  const hasValidationFailure = isEngineeringStatePanelStatus(state.validation?.status, 'failed');
  const hasRuntimeFailure = isEngineeringStatePanelStatus(state.runtime?.status, 'failed');
  const hasPhaseFailure = isEngineeringStatePanelStatus(state.phase?.status, 'failed');
  const hasFailedState = hasEngineeringStatePanelFailedState({
    hasWorkflowFailure,
    hasValidationFailure,
    hasRuntimeFailure,
    hasPhaseFailure,
    hasValidationFailures,
    hasPhaseBlockers,
  });
  const hasBootstrapStateBlocked = state.bootstrap_state?.status === 'blocked';
  const hasBootstrapGateBlocked = state.bootstrap_state?.gate_result?.decision === 'block';
  const hasFoundationBlock = hasEngineeringStatePanelFoundationBlock({
    hasBootstrapStateBlocked,
    hasBootstrapGateBlocked,
    hasFoundationBlockers,
  });
  const hasRecoveryBlocked = state.recovery?.blocked === true;
  const hasRecoveryRetry = state.recovery?.can_retry === true;
  const recoveryActionCount = getEngineeringStatePanelRecoveryActionCount(recoveryActionSummary);
  const primaryActionCount = getEngineeringStatePanelPrimaryActionCount(recoveryActionSummary);
  const retryActionCount = getEngineeringStatePanelRetryActionCount(recoveryActionSummary);
  const hasRecoveryActions = hasEngineeringStatePanelCount(recoveryActionCount);
  const hasRecovery = hasEngineeringStatePanelRecovery({
    hasRecoveryBlocked,
    hasRecoveryRetry,
    hasRecoveryActions,
  });
  const hasExecutionAutoProgress = state.execution?.auto_progress_enabled === true;
  const hasWorkflowRunning = isEngineeringStatePanelStatus(state.workflow?.status, 'running');
  const hasValidationRunning = isEngineeringStatePanelStatus(state.validation?.status, 'running');
  const hasRuntimeRunning = isEngineeringStatePanelStatus(state.runtime?.status, 'running');
  const hasPhaseRunning = isEngineeringStatePanelStatus(state.phase?.status, 'running');
  const hasRunningState = hasEngineeringStatePanelRunningState({
    hasWorkflowRunning,
    hasValidationRunning,
    hasRuntimeRunning,
    hasPhaseRunning,
    hasExecutionAutoProgress,
  });
  const hasAwaitingConfirmation = state.execution?.awaiting_confirmation === true;
  const hasRows = hasEngineeringStatePanelCount(rowCount);
  const status = getEngineeringStatePanelSnapshotStatus({
    hasFailedState,
    hasFoundationBlock,
    hasRecovery,
    hasAwaitingConfirmation,
    hasRunningState,
  });
  const source = getEngineeringStatePanelSnapshotSource({
    hasFailedState,
    hasValidationFailures,
    hasValidationFailure,
    hasFoundationBlock,
    hasRecovery,
    hasAwaitingConfirmation,
    hasRunningState,
    hasRows,
  });
  const message = getEngineeringStatePanelSnapshotMessage(status);
  const recovery = getEngineeringStatePanelSnapshotRecovery(status);

  return {
    status,
    source,
    rowCount,
    failureItemCount: validationFailures,
    blockerCount,
    recoveryActionCount,
    primaryActionCount,
    retryActionCount,
    message,
    recovery,
    updatedAt: 'derived',
  };
}
