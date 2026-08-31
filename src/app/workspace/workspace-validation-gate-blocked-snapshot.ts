import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceValidationFailureItem,
  WorkspaceValidationState,
} from '@/lib/workspace/engineering-state';

import type {
  ValidationGateBlockedSnapshot,
  ValidationGateBlockedSnapshotSource,
  ValidationGateBlockedSnapshotStatus,
} from './workspace-types';

type ValidationGateBlockedSnapshotOptions = {
  state: WorkspaceEngineeringStateSnapshot;
  isContextGateBlocked: boolean;
  hasGateResult: boolean;
  repairTargetCount: number;
  canOpenRepairTarget: boolean;
};

function getValidationGateBlockedFailureItems(
  validationState: WorkspaceValidationState | undefined,
): WorkspaceValidationFailureItem[] {
  if (validationState === undefined) {
    return [];
  }

  const failureItems = validationState.failure_items;
  if (failureItems === undefined) {
    return [];
  }

  return failureItems;
}

function hasValidationGateBlockedItems(itemCount: number): boolean {
  const hasItems = itemCount > 0;
  return hasItems === true;
}

function getValidationGateBlockedGate(validationState: WorkspaceValidationState | undefined): string {
  if (validationState === undefined) {
    return '';
  }

  const validationGate = validationState.gate;
  if (validationGate === undefined) {
    return '';
  }

  return validationGate;
}

function hasValidationGateBlockedGate(validationGate: string): boolean {
  const hasValidationGate = validationGate.length > 0;
  return hasValidationGate === true;
}

export function buildValidationGateBlockedSnapshot({
  state,
  isContextGateBlocked,
  hasGateResult,
  repairTargetCount,
  canOpenRepairTarget,
}: ValidationGateBlockedSnapshotOptions): ValidationGateBlockedSnapshot {
  const validationState = state.validation;
  const failureItems = getValidationGateBlockedFailureItems(validationState);
  const failureItemCount = failureItems.length;
  const hasFailureItems = hasValidationGateBlockedItems(failureItemCount);
  const validationGate = getValidationGateBlockedGate(validationState);
  const hasValidationGate = hasValidationGateBlockedGate(validationGate);
  const gate = hasValidationGate === true
    ? validationGate
    : isContextGateBlocked === true
      ? 'context-memory-isolation'
      : 'validation';
  const hasRepairTargets = hasValidationGateBlockedItems(repairTargetCount);
  const status: ValidationGateBlockedSnapshotStatus = isContextGateBlocked === true
    ? hasRepairTargets === true
      ? 'repair_targets_available'
      : hasGateResult === true
        ? 'repair_targets_missing'
        : 'context_blocked'
    : 'validation_blocked';

  const source: ValidationGateBlockedSnapshotSource = isContextGateBlocked === true
    ? hasRepairTargets === true
      ? 'repair_targets'
      : hasGateResult === true
        ? 'gate_result'
        : 'context_gate'
    : hasFailureItems === true
      ? 'validation_state'
      : 'gate_result';
  const message = isContextGateBlocked === true
    ? hasRepairTargets === true
      ? 'Context Gate 已阻断，并提供可定位修复目标。'
      : hasGateResult === true
        ? 'Context Gate 已阻断，但当前缺少可定位修复目标。'
        : 'Context Gate 已阻断，等待 gate result 同步。'
    : hasFailureItems === true
      ? 'Validation Gate 已阻断，并记录了校验失败项。'
      : 'Validation Gate 已阻断，等待校验失败详情同步。';
  const recovery = isContextGateBlocked === true
    ? canOpenRepairTarget === true
      ? '打开修复目标，处理上下文隔离问题后重试 workflow。'
      : '检查 gate result 是否缺少修复目标，或通过工程状态恢复入口继续排查。'
    : hasFailureItems === true
      ? '优先处理校验失败项，再通过 retry workflow gate 恢复自动推进。'
      : '检查 Validation Gate 输出，确认 failure_items 是否已写入 engineeringState。';

  return {
    status,
    source,
    gate,
    failureItemCount,
    repairTargetCount,
    canOpenRepairTarget,
    message,
    recovery,
    updatedAt: 'derived',
  };
}
