'use client';

import type { WorkspaceGateResult } from '@/lib/workspace/engineering-state';

export type ContextGateRepairPath =
  | '.yistack/PROJECT_CONTEXT.md'
  | '.yistack/foundation/bootstrap_state.json';

export type ContextGateRepairTarget = {
  path: ContextGateRepairPath;
  label: string;
  field?: string;
  reason: string;
  suggestion: string;
  searchText?: string;
};

type ContextGateRepairReasonList = string[];

function getContextGateRepairBlockingItems(
  gateResult: WorkspaceGateResult | undefined,
): ContextGateRepairReasonList {
  if (gateResult === undefined) {
    return [];
  }

  if (Array.isArray(gateResult.blocking_items) === false) {
    return [];
  }

  return gateResult.blocking_items;
}

function getContextGateRepairReasons(
  gateResult: WorkspaceGateResult | undefined,
): ContextGateRepairReasonList {
  if (gateResult === undefined) {
    return [];
  }

  if (Array.isArray(gateResult.reasons) === false) {
    return [];
  }

  return gateResult.reasons;
}

function getContextGateRepairFieldValue(field: string | undefined): string {
  if (field === undefined) {
    return '';
  }

  return field;
}

function getContextGateRepairReasonText(item: string): string {
  return item.trim();
}

function hasContextGateRepairReasonText(item: string): boolean {
  const hasReason = item.length > 0;
  return hasReason === true;
}

function normalizeReasons(gateResult?: WorkspaceGateResult) {
  const blockingItems = getContextGateRepairBlockingItems(gateResult);
  const reasons = getContextGateRepairReasons(gateResult);
  const normalizedReasons: ContextGateRepairReasonList = [];

  for (const item of [
    ...blockingItems,
    ...reasons,
  ]) {
    const reason = getContextGateRepairReasonText(item);
    const hasReason = hasContextGateRepairReasonText(reason);
    if (hasReason === true) {
      normalizedReasons.push(reason);
    }
  }

  return normalizedReasons;
}

function buildProjectContextTarget(reason: string, field?: string): ContextGateRepairTarget {
  const fieldValue = getContextGateRepairFieldValue(field);
  const hasField = fieldValue.length > 0;
  const fieldSuffix = hasField === true ? ` · ${fieldValue}` : '';
  const suggestion = hasField === true
    ? `优先检查 .yistack/PROJECT_CONTEXT.md 中的“${fieldValue}”字段，确保与当前项目实际信息一致。`
    : '优先检查 .yistack/PROJECT_CONTEXT.md 中的项目标识与应用类型是否与当前项目一致。';
  const searchText = hasField === true ? `${fieldValue}：` : undefined;

  return {
    path: '.yistack/PROJECT_CONTEXT.md',
    label: `打开 PROJECT_CONTEXT${fieldSuffix}`,
    field,
    reason,
    suggestion,
    searchText,
  };
}

function buildBootstrapStateTarget(reason: string, field?: string): ContextGateRepairTarget {
  const fieldValue = getContextGateRepairFieldValue(field);
  const hasField = fieldValue.length > 0;
  const hasJsonStructureField = fieldValue === 'JSON 结构';
  const fieldSuffix = hasField === true ? ` · ${fieldValue}` : '';
  const suggestion = hasJsonStructureField === true
    ? '优先修复 .yistack/foundation/bootstrap_state.json 的 JSON 结构，确保文件是合法 JSON。'
    : hasField === true
      ? `优先检查 .yistack/foundation/bootstrap_state.json 中的“${fieldValue}”字段，确保与当前项目实际信息一致。`
      : '优先检查 .yistack/foundation/bootstrap_state.json 中记录的结构化真源是否与当前项目一致。';
  const searchText = hasJsonStructureField === true
    ? '"schema_version"'
    : hasField === true
      ? `"${fieldValue}"`
      : undefined;

  return {
    path: '.yistack/foundation/bootstrap_state.json',
    label: `打开 bootstrap_state${fieldSuffix}`,
    field,
    reason,
    suggestion,
    searchText,
  };
}

export function getContextGateRepairTargets(gateResult?: WorkspaceGateResult): ContextGateRepairTarget[] {
  const reasons = normalizeReasons(gateResult);
  const targets: ContextGateRepairTarget[] = [];

  for (const reason of reasons) {
    if (reason.includes('.yistack/PROJECT_CONTEXT.md 项目 ID=')) {
      targets.push(buildProjectContextTarget(reason, '项目 ID'));
      continue;
    }
    if (reason.includes('.yistack/PROJECT_CONTEXT.md 应用类型=')) {
      targets.push(buildProjectContextTarget(reason, '应用类型'));
      continue;
    }
    if (reason.includes('.yistack/foundation/bootstrap_state.json 不是合法 JSON')) {
      targets.push(buildBootstrapStateTarget(reason, 'JSON 结构'));
      continue;
    }
    if (reason.includes('.yistack/foundation/bootstrap_state.json project_type=')) {
      targets.push(buildBootstrapStateTarget(reason, 'project_type'));
      continue;
    }
  }

  const hasTargets = targets.length > 0;
  if (hasTargets === true) {
    return targets;
  }

  return [
    buildProjectContextTarget('检测到 .yistack/PROJECT_CONTEXT.md 与当前项目存在冲突'),
    buildBootstrapStateTarget('检测到 .yistack/foundation/bootstrap_state.json 与当前项目存在冲突'),
  ];
}
