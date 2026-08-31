import type {
  WorkspaceBootstrapDecisionItem,
  WorkspaceBootstrapState,
  WorkspaceExecutionState,
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
  WorkspaceRecoveryState,
  WorkspaceValidationState,
  WorkspaceValidationFailureItem,
} from '@/lib/workspace/engineering-state';
import {
  CAPABILITY_AUDIT_PROFILE_QUERY_PARAM,
  CAPABILITY_AUDIT_REASON_QUERY_PARAM,
  CAPABILITY_AUDIT_STATUS_QUERY_PARAM,
} from '@/lib/workspace/capability-audit-diagnostics';
import { isWorkspaceBackendWorkflowStage } from '@/lib/workspace/workflow-contract';
import { formatImplementationGenerationFailure } from '@/lib/workspace/workspace-implementation-errors';
import type { WorkspaceStreamExecutionResult } from '@/lib/workspace/workspace-stream-boundary-errors';

import { getContextGateRepairTargets } from './context-gate-repair';
import type { ImplementationStreamFailureState } from './workspace-implementation-stream-types';
import type {
  WorkspaceGenerationMode,
  GuidanceAction,
  WorkspaceChatMessage,
  WorkspaceEditorNavigationTarget,
} from './workspace-types';

type ImplementationFailureExecutionItem = NonNullable<WorkspaceStreamExecutionResult['items']>[number];
type ImplementationFailureContextRepairTarget = ReturnType<typeof getContextGateRepairTargets>[number];

function normalizeImplementationFailureRecoveryMode(mode?: string): WorkspaceGenerationMode | undefined {
  if (mode === 'foundation') return mode;
  if (mode === 'discuss') return mode;
  if (mode === 'implement') return mode;
  return undefined;
}

function hasImplementationFailureTextValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getImplementationFailureTextValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value.trim();
}

function getImplementationFailureList<TValue>(items: TValue[] | undefined): TValue[] {
  if (Array.isArray(items) === false) {
    return [];
  }

  return items;
}

function getImplementationFailureBootstrapState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceBootstrapState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.bootstrap_state;
}

function getImplementationFailureExecutionState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceExecutionState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.execution;
}

function getImplementationFailureRecoveryState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceRecoveryState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.recovery;
}

function getImplementationFailureValidationState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceValidationState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.validation;
}

function getImplementationFailureGateBlockingItems(gateResult: WorkspaceGateResult | undefined): string[] {
  if (gateResult === undefined) {
    return [];
  }

  return getImplementationFailureList(gateResult.blocking_items);
}

function getImplementationFailureGateReasons(gateResult: WorkspaceGateResult | undefined): string[] {
  if (gateResult === undefined) {
    return [];
  }

  return getImplementationFailureList(gateResult.reasons);
}

function getImplementationFailureBootstrapBlockers(bootstrapState: WorkspaceBootstrapState | undefined): string[] {
  if (bootstrapState === undefined) {
    return [];
  }

  return getImplementationFailureList(bootstrapState.blockers);
}

function getImplementationFailureRequiredDecisions(
  bootstrapState: WorkspaceBootstrapState | undefined,
): WorkspaceBootstrapDecisionItem[] {
  if (bootstrapState === undefined) {
    return [];
  }

  return getImplementationFailureList(bootstrapState.required_decisions);
}

function getImplementationFailureValidationItems(
  validationState: WorkspaceValidationState | undefined,
): WorkspaceValidationFailureItem[] {
  if (validationState === undefined) {
    return [];
  }

  return getImplementationFailureList(validationState.failure_items);
}

function getImplementationFailureExecutionItems(
  executionResult: WorkspaceStreamExecutionResult | undefined,
): WorkspaceStreamExecutionResult['items'] {
  if (executionResult === undefined) {
    return [];
  }

  return getImplementationFailureList(executionResult.items);
}

function hasImplementationFailureRecoveryRetry(
  recovery: WorkspaceRecoveryState | undefined,
): recovery is WorkspaceRecoveryState {
  if (recovery === undefined) {
    return false;
  }

  const canRetry = recovery.can_retry === true;
  return canRetry === true;
}

function getImplementationFailureRecoveryStageLabels(recovery: WorkspaceRecoveryState | undefined): string[] {
  if (recovery === undefined) {
    return [];
  }

  const labels: string[] = [];
  const resumeStage = getImplementationFailureTextValue(recovery.resume_stage);
  const hasResumeStage = hasImplementationFailureTextValue(resumeStage);
  if (hasResumeStage === true) {
    labels.push(resumeStage);
  }

  const resumeMode = getImplementationFailureTextValue(recovery.resume_mode);
  const hasResumeMode = hasImplementationFailureTextValue(resumeMode);
  if (hasResumeMode === true) {
    labels.push(resumeMode);
  }

  return labels;
}

function getImplementationFailureGateNextAction(gateResult: WorkspaceGateResult | undefined): string {
  if (gateResult === undefined) {
    return '';
  }

  return getImplementationFailureTextValue(gateResult.next_action);
}

function getImplementationFailureExecutionNextAction(executionState: WorkspaceExecutionState | undefined): string {
  if (executionState === undefined) {
    return '';
  }

  return getImplementationFailureTextValue(executionState.next_action);
}

function getImplementationFailureExecutionCurrentTask(executionState: WorkspaceExecutionState | undefined): string {
  if (executionState === undefined) {
    return '';
  }

  return getImplementationFailureTextValue(executionState.current_task);
}

function getImplementationFailureRecoveryReasonMessage(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getImplementationFailureTextValue(recovery.reason_message);
}

function getImplementationFailureRecoveryReasonCode(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getImplementationFailureTextValue(recovery.reason_code);
}

function getImplementationFailureRecoveryRetryLabel(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getImplementationFailureTextValue(recovery.retry_label);
}

function getImplementationFailureRecoveryRetryPrompt(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getImplementationFailureTextValue(recovery.retry_prompt);
}

function getImplementationFailureCapabilityProfile(
  executionResult: WorkspaceStreamExecutionResult | undefined,
): string {
  if (executionResult === undefined) {
    return '';
  }

  return readString(executionResult.capabilityProfile);
}

function getImplementationFailureExecutionReasonCode(
  executionResult: WorkspaceStreamExecutionResult | undefined,
): string {
  if (executionResult === undefined) {
    return '';
  }

  return readString(executionResult.reasonCode);
}

function getImplementationFailureExecutionItemMetadataProfile(
  item: ImplementationFailureExecutionItem | undefined,
): string {
  if (item === undefined) {
    return '';
  }

  return readString(item.metadata.capability_profile);
}

function getImplementationFailureExecutionItemReasonCode(
  item: ImplementationFailureExecutionItem | undefined,
): string {
  if (item === undefined) {
    return '';
  }

  return readString(item.reasonCode);
}

function getImplementationFailureUniqueTextItems(items: string[]): string[] {
  const uniqueItems: string[] = [];
  const seenItems = new Set<string>();
  for (const item of items) {
    const textValue = getImplementationFailureTextValue(item);
    const hasTextValue = textValue.length > 0;
    if (hasTextValue === false) {
      continue;
    }

    const hasSeenItem = seenItems.has(textValue);
    if (hasSeenItem === true) {
      continue;
    }

    seenItems.add(textValue);
    uniqueItems.push(textValue);
  }

  return uniqueItems;
}

function getImplementationFailureTextLines(items: string[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    lines.push(`- ${item}`);
  }

  return lines;
}

function getImplementationFailurePendingDecisions(
  requiredDecisions: WorkspaceBootstrapDecisionItem[],
): WorkspaceBootstrapDecisionItem[] {
  const pendingDecisions: WorkspaceBootstrapDecisionItem[] = [];
  for (const decision of requiredDecisions) {
    const isMustDecideNow = decision.bucket === 'must_decide_now';
    if (isMustDecideNow === false) {
      continue;
    }

    const isConfirmed = decision.status === 'confirmed';
    if (isConfirmed === false) {
      pendingDecisions.push(decision);
    }
  }

  return pendingDecisions;
}

function getImplementationFailureDecisionLabel(item: WorkspaceBootstrapDecisionItem): string {
  const decisionTitle = getImplementationFailureTextValue(item.title);
  const hasDecisionTitle = decisionTitle.length > 0;
  if (hasDecisionTitle === true) {
    return decisionTitle;
  }

  const decisionId = getImplementationFailureTextValue(item.id);
  const hasDecisionId = decisionId.length > 0;
  if (hasDecisionId === true) {
    return decisionId;
  }

  return '未命名决策';
}

function getImplementationFailureDecisionLines(
  decisions: WorkspaceBootstrapDecisionItem[],
): string[] {
  const lines: string[] = [];
  for (const decision of decisions) {
    lines.push(`- ${getImplementationFailureDecisionLabel(decision)}`);
  }

  return lines;
}

function getImplementationFailureValidationLine(item: WorkspaceValidationFailureItem): string {
  const title = getImplementationFailureTextValue(item.title);
  const hasTitle = title.length > 0;
  const detailValue = getImplementationFailureTextValue(item.detail);
  const hasDetailValue = detailValue.length > 0;
  const suggestionValue = getImplementationFailureTextValue(item.suggestion);
  const hasSuggestionValue = suggestionValue.length > 0;
  const filePath = getImplementationFailureTextValue(item.file_path);
  const hasFilePath = filePath.length > 0;
  const hasLineNumber = item.line_number !== undefined;
  const hasColumn = item.column !== undefined;
  const lineLabel = hasLineNumber === true ? `:${item.line_number}` : '';
  const columnLabel = hasColumn === true ? `:${item.column}` : '';
  const titleLabel = hasTitle === true ? title : 'Validation Gate 失败项';
  const detail = hasDetailValue === true ? `：${detailValue}` : '';
  const suggestion = hasSuggestionValue === true ? `\n  建议：${suggestionValue}` : '';
  const location = hasFilePath === true
    ? `\n  位置：${filePath}${lineLabel}${columnLabel}`
    : '';
  return `- ${titleLabel}${detail}${suggestion}${location}`;
}

function getImplementationFailureValidationLines(items: WorkspaceValidationFailureItem[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    lines.push(getImplementationFailureValidationLine(item));
  }

  return lines;
}

function getImplementationFailureContextRepairTargetLine(
  target: ImplementationFailureContextRepairTarget,
): string {
  const targetField = getImplementationFailureTextValue(target.field);
  const hasTargetField = targetField.length > 0;
  const targetSearchText = getImplementationFailureTextValue(target.searchText);
  const hasTargetSearchText = targetSearchText.length > 0;
  const field = hasTargetField === true ? ` · ${targetField}` : '';
  const searchText = hasTargetSearchText === true ? `\n  定位：${targetSearchText}` : '';
  return `- ${target.path}${field}\n  建议：${target.suggestion}${searchText}`;
}

function getImplementationFailureContextRepairTargetLines(
  targets: ImplementationFailureContextRepairTarget[],
): string[] {
  const lines: string[] = [];
  for (const target of targets) {
    lines.push(getImplementationFailureContextRepairTargetLine(target));
  }

  return lines;
}

function getBlockedCapabilityExecutionItems(
  executionResult?: WorkspaceStreamExecutionResult,
): ImplementationFailureExecutionItem[] {
  const blockedItems: ImplementationFailureExecutionItem[] = [];
  for (const item of getImplementationFailureExecutionItems(executionResult)) {
    const isBlocked = item.status === 'blocked';
    if (isBlocked === true) {
      blockedItems.push(item);
    }
  }

  return blockedItems;
}

function getBlockedCapabilityResultLine(item: ImplementationFailureExecutionItem): string {
  const capabilityValue = readString(item.capabilityId);
  const hasCapabilityValue = capabilityValue.length > 0;
  const providerValue = readString(item.provider);
  const hasProviderValue = providerValue.length > 0;
  const reasonValue = readString(item.reasonCode);
  const hasReasonValue = reasonValue.length > 0;
  const capability = hasCapabilityValue === true ? capabilityValue : 'unknown-capability';
  const provider = hasProviderValue === true ? providerValue : 'unknown-provider';
  const reason = hasReasonValue === true ? reasonValue : 'unknown_reason';
  return `- ${capability} / ${provider} / ${reason}`;
}

function getFirstBlockedCapabilityExecutionItem(
  executionResult?: WorkspaceStreamExecutionResult,
): ImplementationFailureExecutionItem | undefined {
  for (const item of getImplementationFailureExecutionItems(executionResult)) {
    const isBlocked = item.status === 'blocked';
    if (isBlocked === true) {
      return item;
    }
  }

  return undefined;
}

function getImplementationFailureAuditFilters({
  capabilityAuditProfile,
  hasCapabilityAuditProfile,
  capabilityAuditReason,
  hasCapabilityAuditReason,
}: {
  capabilityAuditProfile: string | undefined;
  hasCapabilityAuditProfile: boolean;
  capabilityAuditReason: string | undefined;
  hasCapabilityAuditReason: boolean;
}): string[] {
  const auditFilters = [`${CAPABILITY_AUDIT_STATUS_QUERY_PARAM}=blocked`];
  if (hasCapabilityAuditProfile === true) {
    auditFilters.push(`${CAPABILITY_AUDIT_PROFILE_QUERY_PARAM}=${capabilityAuditProfile}`);
  }

  if (hasCapabilityAuditReason === true) {
    auditFilters.push(`${CAPABILITY_AUDIT_REASON_QUERY_PARAM}=${capabilityAuditReason}`);
  }

  return auditFilters;
}

function getFirstValidationFailureItemWithNavigationTarget(
  items: WorkspaceValidationFailureItem[],
): WorkspaceValidationFailureItem | null {
  for (const item of items) {
    const navigationTarget = buildValidationFailureNavigationTarget(item);
    const hasNavigationTarget = navigationTarget !== null;
    if (hasNavigationTarget === true) {
      return item;
    }
  }

  return null;
}

function buildFoundationGateBlockedMessage(
  gateResult?: WorkspaceGateResult,
  engineeringState?: WorkspaceEngineeringStateSnapshot,
) {
  const sections = ['项目基础设定尚未完成，已暂停进入实现。'];
  const bootstrapState = getImplementationFailureBootstrapState(engineeringState);
  const uniqueBlockers = getImplementationFailureUniqueTextItems([
    ...getImplementationFailureGateBlockingItems(gateResult),
    ...getImplementationFailureBootstrapBlockers(bootstrapState),
  ]);
  if (uniqueBlockers.length > 0) {
    sections.push(`阻断项：\n${getImplementationFailureTextLines(uniqueBlockers).join('\n')}`);
  }
  const requiredDecisions = getImplementationFailureRequiredDecisions(bootstrapState);
  const pendingDecisions = getImplementationFailurePendingDecisions(requiredDecisions);
  if (pendingDecisions.length > 0) {
    sections.push(`待确认决策：\n${getImplementationFailureDecisionLines(pendingDecisions).join('\n')}`);
  }
  const executionState = getImplementationFailureExecutionState(engineeringState);
  const gateNextAction = getImplementationFailureGateNextAction(gateResult);
  const hasGateNextAction = gateNextAction.length > 0;
  const executionNextAction = getImplementationFailureExecutionNextAction(executionState);
  const hasExecutionNextAction = executionNextAction.length > 0;
  const nextAction = hasGateNextAction === true
    ? gateNextAction
    : hasExecutionNextAction === true
      ? executionNextAction
      : '重试自动准备项目基础设定；如果连续失败，请补充关键业务、鉴权、数据或合规约束后再继续。';
  sections.push(`下一步：${nextAction}`);
  return sections.join('\n\n');
}

function buildValidationGateBlockedMessage(
  gate?: string,
  engineeringState?: WorkspaceEngineeringStateSnapshot,
) {
  const gateValue = getImplementationFailureTextValue(gate);
  const hasGateValue = gateValue.length > 0;
  const gateLabel = hasGateValue === true ? `（${gateValue}）` : '';
  const sections = [`YES 校验未通过${gateLabel}，当前阶段已阻断。`];
  const validationState = getImplementationFailureValidationState(engineeringState);
  const failureItems = getImplementationFailureValidationItems(validationState);

  if (failureItems.length > 0) {
    sections.push(`失败项：\n${getImplementationFailureValidationLines(failureItems).join('\n')}`);
  }

  const executionState = getImplementationFailureExecutionState(engineeringState);
  const executionNextAction = getImplementationFailureExecutionNextAction(executionState);
  const hasExecutionNextAction = executionNextAction.length > 0;
  const nextAction = hasExecutionNextAction === true
    ? executionNextAction
    : '请先处理校验失败项，再继续后续流程。';
  sections.push(`下一步：${nextAction}`);
  return sections.join('\n\n');
}

function buildValidationFailureNavigationTarget(
  item: WorkspaceValidationFailureItem,
): WorkspaceEditorNavigationTarget | null {
  const path = getImplementationFailureTextValue(item.file_path);
  const hasPath = hasImplementationFailureTextValue(path);
  if (hasPath === false) return null;
  const searchText = getImplementationFailureTextValue(item.search_text);
  const hasSearchText = searchText.length > 0;
  const title = getImplementationFailureTextValue(item.title);
  const hasTitle = title.length > 0;
  return {
    path,
    lineNumber: item.line_number,
    column: item.column,
    searchText: hasSearchText === true ? searchText : hasTitle === true ? title : undefined,
    label: hasTitle === true ? title : 'Validation Gate 失败项',
  };
}

function buildContextGateBlockedMessage(gateResult?: WorkspaceGateResult) {
  const uniqueReasons = getImplementationFailureUniqueTextItems([
    ...getImplementationFailureGateBlockingItems(gateResult),
    ...getImplementationFailureGateReasons(gateResult),
  ]);
  const gateNextAction = getImplementationFailureGateNextAction(gateResult);
  const hasGateNextAction = gateNextAction.length > 0;
  const nextAction = hasGateNextAction === true
    ? gateNextAction
    : '修复 .yistack/PROJECT_CONTEXT.md 或 .yistack/foundation/bootstrap_state.json 中与当前项目不一致的内容后重试。';

  const sections = ['检测到当前项目上下文冲突，已阻断继续生成。'];
  if (uniqueReasons.length > 0) {
    sections.push(`冲突原因：\n${getImplementationFailureTextLines(uniqueReasons).join('\n')}`);
  }
  const repairTargets = getContextGateRepairTargets(gateResult);
  if (repairTargets.length > 0) {
    sections.push(`修复位置：\n${getImplementationFailureContextRepairTargetLines(repairTargets).join('\n')}`);
  }
  sections.push(`下一步：${nextAction}`);
  return sections.join('\n\n');
}

function getFirstImplementationFailureContextRepairTarget(
  targets: ImplementationFailureContextRepairTarget[],
): ImplementationFailureContextRepairTarget | undefined {
  for (const target of targets) {
    return target;
  }

  return undefined;
}

function buildContextRepairNavigationTarget(gateResult?: WorkspaceGateResult): WorkspaceEditorNavigationTarget | null {
  const repairTargets = getContextGateRepairTargets(gateResult);
  const repairTarget = getFirstImplementationFailureContextRepairTarget(repairTargets);
  const hasRepairTarget = repairTarget !== undefined;
  if (hasRepairTarget === false) return null;

  return {
    path: repairTarget.path,
    searchText: repairTarget.searchText,
    label: repairTarget.label,
  };
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getBlockedCapabilityResultLines(executionResult?: WorkspaceStreamExecutionResult) {
  const blockedCapabilityLines: string[] = [];
  for (const item of getBlockedCapabilityExecutionItems(executionResult)) {
    blockedCapabilityLines.push(getBlockedCapabilityResultLine(item));
  }

  return blockedCapabilityLines;
}

function getBlockedCapabilityAuditProfile(executionResult?: WorkspaceStreamExecutionResult): string | undefined {
  const topLevelProfile = getImplementationFailureCapabilityProfile(executionResult);
  const hasTopLevelProfile = topLevelProfile.length > 0;
  if (hasTopLevelProfile === true) {
    return topLevelProfile;
  }

  const blockedItem = getFirstBlockedCapabilityExecutionItem(executionResult);
  const metadataProfile = getImplementationFailureExecutionItemMetadataProfile(blockedItem);
  const hasMetadataProfile = metadataProfile.length > 0;
  return hasMetadataProfile === true ? metadataProfile : undefined;
}

function getBlockedCapabilityAuditReason(executionResult?: WorkspaceStreamExecutionResult): string | undefined {
  const blockedItem = getFirstBlockedCapabilityExecutionItem(executionResult);
  const blockedReason = getImplementationFailureExecutionItemReasonCode(blockedItem);
  const hasBlockedReason = blockedReason.length > 0;
  const executionReason = getImplementationFailureExecutionReasonCode(executionResult);
  const hasExecutionReason = executionReason.length > 0;
  return hasBlockedReason === true
    ? blockedReason
    : hasExecutionReason === true
      ? executionReason
      : undefined;
}

function buildCapabilityGateBlockedMessage(
  engineeringState?: WorkspaceEngineeringStateSnapshot,
  executionResult?: WorkspaceStreamExecutionResult,
) {
  const sections = ['能力执行被阻断，当前阶段已暂停。'];
  const recovery = getImplementationFailureRecoveryState(engineeringState);
  const reasonMessage = getImplementationFailureRecoveryReasonMessage(recovery);
  const hasReasonMessage = reasonMessage.length > 0;
  const reasonCode = getImplementationFailureRecoveryReasonCode(recovery);
  const hasReasonCode = reasonCode.length > 0;
  const reason = hasReasonMessage === true
    ? reasonMessage
    : hasReasonCode === true
      ? reasonCode
      : '能力 provider 或 runner 尚未满足当前工作流要求。';
  sections.push(`阻断原因：${reason}`);

  const blockedCapabilities = getBlockedCapabilityResultLines(executionResult);
  if (blockedCapabilities.length > 0) {
    sections.push(`阻断能力：\n${blockedCapabilities.join('\n')}`);
  }

  const executionState = getImplementationFailureExecutionState(engineeringState);
  const currentTask = getImplementationFailureExecutionCurrentTask(executionState);
  const hasCurrentTask = hasImplementationFailureTextValue(currentTask);
  if (hasCurrentTask === true) {
    sections.push(`当前任务：${currentTask}`);
  }

  const executionNextAction = getImplementationFailureExecutionNextAction(executionState);
  const hasExecutionNextAction = executionNextAction.length > 0;
  const retryLabel = getImplementationFailureRecoveryRetryLabel(recovery);
  const hasRetryLabel = retryLabel.length > 0;
  const nextAction = hasExecutionNextAction === true
    ? executionNextAction
    : hasRetryLabel === true
      ? retryLabel
      : '接入缺失的 Skill / MCP runner 或调整能力计划后重试。';
  sections.push(`下一步：${nextAction}`);

  const recoveryStageLabels = getImplementationFailureRecoveryStageLabels(recovery);
  const hasRecoveryStageLabels = recoveryStageLabels.length > 0;
  if (hasRecoveryStageLabels === true) {
    sections.push(`恢复阶段：${recoveryStageLabels.join(' / ')}`);
  }

  const capabilityAuditProfile = getBlockedCapabilityAuditProfile(executionResult);
  const capabilityAuditReason = getBlockedCapabilityAuditReason(executionResult);
  const hasCapabilityAuditProfile = hasImplementationFailureTextValue(capabilityAuditProfile);
  const hasCapabilityAuditReason = hasImplementationFailureTextValue(capabilityAuditReason);
  const auditFilters = getImplementationFailureAuditFilters({
    capabilityAuditProfile,
    hasCapabilityAuditProfile,
    capabilityAuditReason,
    hasCapabilityAuditReason,
  }).join(' + ');
  sections.push(`定位审计：打开右侧/底部「调试」面板的 Capability 审计，使用 \`${auditFilters}\` 筛选最近阻断记录。`);

  return sections.join('\n\n');
}

function buildRecoverySuggestedActions(engineeringState?: WorkspaceEngineeringStateSnapshot): GuidanceAction[] {
  const recovery = getImplementationFailureRecoveryState(engineeringState);
  const hasRecoveryRetry = hasImplementationFailureRecoveryRetry(recovery);
  const retryPrompt = getImplementationFailureRecoveryRetryPrompt(recovery);
  const hasRetryPrompt = retryPrompt.length > 0;
  if (hasRecoveryRetry === false) {
    return [];
  }

  if (hasRetryPrompt === false) {
    return [];
  }
  const retryLabel = getImplementationFailureTextValue(recovery.retry_label);
  const hasRetryLabel = retryLabel.length > 0;

  return [{
    label: hasRetryLabel === true ? retryLabel : '修复后重试',
    kind: 'retry_workflow_gate',
    prompt: retryPrompt,
    mode: normalizeImplementationFailureRecoveryMode(recovery.resume_mode),
    conversationStage: isWorkspaceBackendWorkflowStage(recovery.resume_stage) ? recovery.resume_stage : undefined,
  }];
}

function buildCapabilityAuditSuggestedAction(executionResult?: WorkspaceStreamExecutionResult): GuidanceAction {
  return {
    label: '查看 Capability 审计',
    kind: 'open_capability_audit',
    capabilityAuditProfile: getBlockedCapabilityAuditProfile(executionResult),
    capabilityAuditReasonCode: getBlockedCapabilityAuditReason(executionResult),
  };
}

function buildFailureSuggestedActions({
  foundationGateBlocked,
  validationFailureSuggestedAction,
  contextRepairSuggestedAction,
  capabilityGateBlocked,
  executionResult,
  recoverySuggestedActions,
}: {
  foundationGateBlocked: boolean;
  validationFailureSuggestedAction: GuidanceAction | null;
  contextRepairSuggestedAction: GuidanceAction | null;
  capabilityGateBlocked: boolean;
  executionResult: WorkspaceStreamExecutionResult | undefined;
  recoverySuggestedActions: GuidanceAction[];
}): GuidanceAction[] {
  const actions: GuidanceAction[] = [];
  if (foundationGateBlocked === true) {
    actions.push(buildFoundationAutoRetrySuggestedAction());
  }

  if (validationFailureSuggestedAction !== null) {
    actions.push(validationFailureSuggestedAction);
  }

  if (contextRepairSuggestedAction !== null) {
    actions.push(contextRepairSuggestedAction);
  }

  if (capabilityGateBlocked === true) {
    actions.push(buildCapabilityAuditSuggestedAction(executionResult));
  }

  for (const action of recoverySuggestedActions) {
    actions.push(action);
  }

  return actions;
}

function buildLocalGenerationFailureState(error: unknown): WorkspaceEngineeringStateSnapshot {
  const failureMessage = formatImplementationGenerationFailure(error);
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
      current_task: '实现阶段生成',
      completed_tasks: [],
      blockers: [failureMessage],
      next_action: '修复网络、模型或生成服务异常后，从当前 Workspace 状态重新发起实现阶段。',
      status: 'failed',
    },
    execution: {
      pause_reason: 'generation_failed',
      approval_boundary: 'generation',
      current_task: '实现阶段生成',
      next_action: '修复异常后重试生成，或调整需求后重新提交。',
    },
    recovery: {
      blocked: true,
      reason_code: 'generation_failed',
      reason_message: failureMessage,
      resume_stage: 'implement',
      resume_mode: 'implement',
      can_retry: true,
      retry_label: '重试实现阶段',
      retry_prompt: '请基于当前 Workspace 的方案、文件和工程状态，重新发起实现阶段生成；如果上一次失败与网络、模型或运行时有关，请先避开相同故障后继续。',
    },
  };
}

function buildLocalGenerationFailureMessage(error: unknown) {
  return [
    `生成失败: ${formatImplementationGenerationFailure(error)}`,
    '当前实现阶段已进入 generation_failed 恢复状态；如果失败来自网络、模型或生成服务异常，当前 Workspace 文件、工程状态和已打开内容仍会保留。',
    '下一步：修复异常后点击“重试实现阶段”，或调整需求后重新提交。',
  ].join('\n\n');
}

function buildFoundationAutoRetrySuggestedAction(): GuidanceAction {
  return {
    label: '重试自动准备项目基础设定',
    kind: 'retry_workflow_gate',
    prompt: '请自动完成项目基础设定：基于当前需求选择默认可执行决策并继续实现；只有存在无法自动判断的高风险冲突时才列出需要补充的关键信息。',
    mode: 'foundation',
    conversationStage: 'bootstrap_confirmed',
  };
}

function buildValidationFailureSuggestedAction(engineeringState?: WorkspaceEngineeringStateSnapshot): GuidanceAction | null {
  const validationState = getImplementationFailureValidationState(engineeringState);
  const failureItem = getFirstValidationFailureItemWithNavigationTarget(
    getImplementationFailureValidationItems(validationState),
  );
  const hasFailureItem = failureItem !== null;
  if (hasFailureItem === false) return null;

  const navigationTarget = buildValidationFailureNavigationTarget(failureItem);
  const hasNavigationTarget = navigationTarget !== null;
  if (hasNavigationTarget === false) return null;
  const failureTitle = getImplementationFailureTextValue(failureItem.title);
  const hasFailureTitle = failureTitle.length > 0;
  const failurePath = getImplementationFailureTextValue(failureItem.file_path);
  const hasFailurePath = failurePath.length > 0;
  const failureLabel = hasFailureTitle === true
    ? failureTitle
    : hasFailurePath === true
      ? failurePath
      : 'Validation Gate 失败项';

  return {
    label: `打开修复位置：${failureLabel}`,
    kind: 'open_validation_failure',
    navigationTarget,
  };
}

function buildContextRepairSuggestedAction(gateResult?: WorkspaceGateResult): GuidanceAction | null {
  const navigationTarget = buildContextRepairNavigationTarget(gateResult);
  const hasNavigationTarget = navigationTarget !== null;
  if (hasNavigationTarget === false) return null;
  const navigationLabel = getImplementationFailureTextValue(navigationTarget.label);
  const hasNavigationLabel = navigationLabel.length > 0;
  const actionLabel = hasNavigationLabel === true ? navigationLabel : navigationTarget.path;

  return {
    label: `打开修复位置：${actionLabel}`,
    kind: 'open_context_repair',
    navigationTarget,
  };
}

export function buildImplementationFailurePatch(
  error: unknown,
  context: ImplementationStreamFailureState,
) {
  const validationGateBlocked = typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'validation_gate_blocked';
  const foundationGateBlocked = typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'foundation_gate_blocked';
  const contextGateBlocked = typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'context_gate_blocked';
  const capabilityGateBlocked = typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'capability_execution_blocked';
  const blockingGate = typeof error === 'object'
    && error !== null
    && 'gate' in error
    && typeof (error as { gate?: unknown }).gate === 'string'
    ? (error as { gate: string }).gate
    : undefined;
  const gateResult = typeof error === 'object'
    && error !== null
    && 'gateResult' in error
    ? (error as { gateResult?: WorkspaceGateResult }).gateResult
    : undefined;
  const blockingEngineeringState = typeof error === 'object'
    && error !== null
    && 'engineeringState' in error
    ? (error as { engineeringState?: WorkspaceEngineeringStateSnapshot }).engineeringState
    : undefined;
  const shouldBuildLocalGenerationFailureState = validationGateBlocked === false
    && foundationGateBlocked === false
    && contextGateBlocked === false
    && capabilityGateBlocked === false;
  const effectiveEngineeringState = blockingEngineeringState
    ?? (shouldBuildLocalGenerationFailureState === true ? buildLocalGenerationFailureState(error) : undefined);
  const executionResult = typeof error === 'object'
    && error !== null
    && 'executionResult' in error
    ? (error as { executionResult?: WorkspaceStreamExecutionResult }).executionResult
    : undefined;
  const recoverySuggestedActions = buildRecoverySuggestedActions(effectiveEngineeringState);
  const validationFailureSuggestedAction = validationGateBlocked
    ? buildValidationFailureSuggestedAction(blockingEngineeringState)
    : null;
  const contextRepairSuggestedAction = contextGateBlocked
    ? buildContextRepairSuggestedAction(gateResult)
    : null;
  const failureSuggestedActions = buildFailureSuggestedActions({
    foundationGateBlocked,
    validationFailureSuggestedAction,
    contextRepairSuggestedAction,
    capabilityGateBlocked,
    executionResult,
    recoverySuggestedActions,
  });
  const hasEffectiveEngineeringState = effectiveEngineeringState !== undefined;
  const hasGateResult = gateResult !== undefined;
  const hasFailureSuggestedActions = failureSuggestedActions.length > 0;
  const hasContextReasoningContent = context.reasoningContent.length > 0;
  const hasContextStatusContent = context.statusContent.length > 0;

  return (message: WorkspaceChatMessage) => ({
    kind: 'workflow' as const,
    streaming: false,
    content: validationGateBlocked
      ? buildValidationGateBlockedMessage(blockingGate, blockingEngineeringState)
      : foundationGateBlocked
        ? buildFoundationGateBlockedMessage(gateResult, blockingEngineeringState)
        : contextGateBlocked
          ? buildContextGateBlockedMessage(gateResult)
          : capabilityGateBlocked
            ? buildCapabilityGateBlockedMessage(blockingEngineeringState, executionResult)
            : buildLocalGenerationFailureMessage(error),
    engineeringState: hasEffectiveEngineeringState === true ? effectiveEngineeringState : message.engineeringState,
    gateResult: hasGateResult === true ? gateResult : message.gateResult,
    suggestedActions: hasFailureSuggestedActions === true ? failureSuggestedActions : message.suggestedActions,
    reasoningContent: hasContextReasoningContent === true ? context.reasoningContent : message.reasoningContent,
    statusContent: hasContextReasoningContent === true
      ? undefined
      : hasContextStatusContent === true
        ? context.statusContent
        : message.statusContent,
  });
}
