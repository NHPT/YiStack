import type { WorkspaceBootstrapState } from '@/lib/workspace/engineering-state';

import type {
  FoundationPanelSnapshot,
  FoundationPanelSnapshotSource,
  FoundationPanelSnapshotStatus,
} from './workspace-types';

type FoundationPanelSnapshotOptions = {
  foundationState: WorkspaceBootstrapState | undefined;
  contextGateBlocked: boolean;
  foundationGateBlocked: boolean;
  contextRepairTargetCount: number;
  hasAllRequiredDrafts: boolean;
  isBusy: boolean;
};

type FoundationPanelBooleanFactList = readonly boolean[];
type FoundationPanelBootstrapCompletedStatus = 'completed';

function hasFoundationPanelTrueFact(values: FoundationPanelBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function getFoundationPanelItemCount<TItem>(items: readonly TItem[] | undefined): number {
  if (items === undefined) {
    return 0;
  }

  return items.length;
}

function hasFoundationPanelCount(value: number): boolean {
  const hasCount = value > 0;
  return hasCount === true;
}

function getFoundationPanelRequiredDecisionCount(foundationState: WorkspaceBootstrapState | undefined): number {
  if (foundationState === undefined) {
    return 0;
  }

  return getFoundationPanelItemCount(foundationState.required_decisions);
}

function getFoundationPanelReservedDecisionCount(foundationState: WorkspaceBootstrapState | undefined): number {
  if (foundationState === undefined) {
    return 0;
  }

  return getFoundationPanelItemCount(foundationState.reserved_extensions);
}

function getFoundationPanelDeferredDecisionCount(foundationState: WorkspaceBootstrapState | undefined): number {
  if (foundationState === undefined) {
    return 0;
  }

  return getFoundationPanelItemCount(foundationState.deferred_decisions);
}

function getFoundationPanelStateBlockerCount(foundationState: WorkspaceBootstrapState | undefined): number {
  if (foundationState === undefined) {
    return 0;
  }

  return getFoundationPanelItemCount(foundationState.blockers);
}

function getFoundationPanelGateBlockingItemCount(foundationState: WorkspaceBootstrapState | undefined): number {
  if (foundationState === undefined) {
    return 0;
  }

  return getFoundationPanelItemCount(foundationState.gate_result?.blocking_items);
}

function isFoundationPanelBootstrapCompleted(
  foundationState: WorkspaceBootstrapState | undefined,
  expectedStatus: FoundationPanelBootstrapCompletedStatus,
): boolean {
  if (foundationState === undefined) {
    return false;
  }

  const hasCompletedStatus = foundationState.status === expectedStatus;
  return hasCompletedStatus === true;
}

function hasFoundationPanelFoundationGateBlock({
  foundationGateBlocked,
  hasBlockers,
}: {
  foundationGateBlocked: boolean;
  hasBlockers: boolean;
}): boolean {
  return hasFoundationPanelTrueFact([foundationGateBlocked, hasBlockers]);
}

function canConfirmFoundationPanel({
  hasFoundationState,
  hasAllRequiredDrafts,
  isBusy,
}: {
  hasFoundationState: boolean;
  hasAllRequiredDrafts: boolean;
  isBusy: boolean;
}): boolean {
  if (hasFoundationState === false) {
    return false;
  }

  if (hasAllRequiredDrafts === false) {
    return false;
  }

  return isBusy === false;
}

function getFoundationPanelSnapshotStatus({
  contextGateBlocked,
  hasFoundationGateBlock,
  isBusy,
  hasFoundationState,
  hasCompletedFoundation,
  hasAllRequiredDrafts,
}: {
  contextGateBlocked: boolean;
  hasFoundationGateBlock: boolean;
  isBusy: boolean;
  hasFoundationState: boolean;
  hasCompletedFoundation: boolean;
  hasAllRequiredDrafts: boolean;
}): FoundationPanelSnapshotStatus {
  if (contextGateBlocked === true) {
    return 'context_blocked';
  }

  if (hasFoundationGateBlock === true) {
    return 'foundation_blocked';
  }

  if (isBusy === true) {
    return 'busy';
  }

  if (hasFoundationState === false) {
    return 'empty';
  }

  if (hasCompletedFoundation === true) {
    return 'completed';
  }

  if (hasAllRequiredDrafts === false) {
    return 'awaiting_decisions';
  }

  return 'ready';
}

function getFoundationPanelSnapshotSource({
  contextGateBlocked,
  hasFoundationGateBlock,
  isBusy,
  hasAllRequiredDrafts,
}: {
  contextGateBlocked: boolean;
  hasFoundationGateBlock: boolean;
  isBusy: boolean;
  hasAllRequiredDrafts: boolean;
}): FoundationPanelSnapshotSource {
  if (contextGateBlocked === true) {
    return 'context_gate';
  }

  if (hasFoundationGateBlock === true) {
    return 'gate_result';
  }

  if (isBusy === true) {
    return 'action_state';
  }

  if (hasAllRequiredDrafts === false) {
    return 'decision_drafts';
  }

  return 'bootstrap_state';
}

function getFoundationPanelSnapshotMessage(status: FoundationPanelSnapshotStatus): string {
  if (status === 'context_blocked') {
    return 'Context Gate 已阻断 Foundation 推进。';
  }

  if (status === 'foundation_blocked') {
    return 'Foundation Gate 当前存在阻断项。';
  }

  if (status === 'busy') {
    return 'Foundation 面板正在执行操作。';
  }

  if (status === 'empty') {
    return '当前还没有 Foundation 状态。';
  }

  if (status === 'completed') {
    return 'Project Foundation 已完成。';
  }

  if (status === 'awaiting_decisions') {
    return '仍有必决项需要确认。';
  }

  return 'Foundation 面板已就绪，可确认并推进。';
}

function getFoundationPanelSnapshotRecovery(status: FoundationPanelSnapshotStatus): string {
  if (status === 'empty') {
    return '点击启动 Project Foundation，生成结构化决策真源。';
  }

  if (status === 'awaiting_decisions') {
    return '补齐 Must Decide Now 的确认选项后再推进。';
  }

  if (status === 'context_blocked') {
    return '打开 Context 修复目标，处理上下文隔离问题后重试。';
  }

  if (status === 'foundation_blocked') {
    return '处理 Foundation blockers 或必决项，再回到自动推进链路。';
  }

  if (status === 'busy') {
    return '等待当前 Foundation 操作完成。';
  }

  return '继续观察 gate result、next action 和决策项状态。';
}

export function buildFoundationPanelSnapshot({
  foundationState,
  contextGateBlocked,
  foundationGateBlocked,
  contextRepairTargetCount,
  hasAllRequiredDrafts,
  isBusy,
}: FoundationPanelSnapshotOptions): FoundationPanelSnapshot {
  const requiredDecisionCount = getFoundationPanelRequiredDecisionCount(foundationState);
  const reservedDecisionCount = getFoundationPanelReservedDecisionCount(foundationState);
  const deferredDecisionCount = getFoundationPanelDeferredDecisionCount(foundationState);
  const stateBlockerCount = getFoundationPanelStateBlockerCount(foundationState);
  const gateBlockingItemCount = getFoundationPanelGateBlockingItemCount(foundationState);
  const blockerCount = stateBlockerCount + gateBlockingItemCount;
  const hasFoundationState = foundationState !== undefined;
  const hasBlockers = hasFoundationPanelCount(blockerCount);
  const hasFoundationGateBlock = hasFoundationPanelFoundationGateBlock({
    foundationGateBlocked,
    hasBlockers,
  });
  const hasCompletedFoundation = isFoundationPanelBootstrapCompleted(foundationState, 'completed');
  const canConfirm = canConfirmFoundationPanel({
    hasFoundationState,
    hasAllRequiredDrafts,
    isBusy,
  });
  const status = getFoundationPanelSnapshotStatus({
    contextGateBlocked,
    hasFoundationGateBlock,
    isBusy,
    hasFoundationState,
    hasCompletedFoundation,
    hasAllRequiredDrafts,
  });
  const source = getFoundationPanelSnapshotSource({
    contextGateBlocked,
    hasFoundationGateBlock,
    isBusy,
    hasAllRequiredDrafts,
  });
  const message = getFoundationPanelSnapshotMessage(status);
  const recovery = getFoundationPanelSnapshotRecovery(status);

  return {
    status,
    source,
    requiredDecisionCount,
    reservedDecisionCount,
    deferredDecisionCount,
    blockerCount,
    contextRepairTargetCount,
    canConfirm,
    message,
    recovery,
    updatedAt: 'derived',
  };
}
