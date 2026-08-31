'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle2, Layers3, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  WorkspaceBootstrapDecisionItem,
  WorkspaceBootstrapState,
  WorkspaceEngineeringStateSnapshot,
  WorkspaceExecutionState,
  WorkspaceGateResult,
  WorkspaceRecoveryState,
} from '@/lib/workspace/engineering-state';
import type { FoundationPanelSnapshot } from './workspace-types';
import type {
  WorkspaceFoundationConfirmDecisionsAction,
  WorkspaceFoundationOpenFileAction,
  WorkspaceFoundationStartAction,
} from './workspace-ide-subpanel-types';
import type { WorkspaceFoundationDecisionConfirmation } from './workspace-prompt-actions-contract';
import type { ContextGateRepairTarget } from './context-gate-repair';
import { getContextGateRepairTargets } from './context-gate-repair';
import { buildFoundationPanelSnapshot } from './workspace-foundation-panel-snapshot';
import { cn } from '@/lib/utils';

function getFoundationDecisionStatusLabel(status?: string) {
  switch (status) {
    case 'proposed':
      return '待梳理';
    case 'recommended':
      return '待确认';
    case 'confirmed':
      return '已确认';
    case 'deferred':
      return '已暂缓';
    case 'blocked':
      return '已阻断';
    default:
      return getFoundationFallbackTextValue(status, '未记录');
  }
}

function getFoundationRiskLabel(level?: string) {
  switch (level) {
    case 'low':
      return '低';
    case 'medium':
      return '中';
    case 'high':
      return '高';
    default:
      return '未记录';
  }
}

type FoundationDecisionDraft = {
  selectedOption: string;
  notes: string;
};

type FoundationDecisionDraftMap = {
  [decisionId: string]: FoundationDecisionDraft;
};
type FoundationDecisionDraftPatch = Partial<FoundationDecisionDraft>;

type FoundationDecisionItemList = WorkspaceBootstrapDecisionItem[];
const emptyFoundationDecisionItems: FoundationDecisionItemList = [];
type FoundationDecisionItemNodeList = ReactNode[];
type FoundationBlockingItemList = string[];
const emptyFoundationBlockingItems: FoundationBlockingItemList = [];
type FoundationTextItemList = string[];
type FoundationContextRepairTargetNodeList = ReactNode[];
type FoundationBlockingItemNodeList = ReactNode[];
type FoundationDecisionConfirmationList = WorkspaceFoundationDecisionConfirmation[];

type FoundationDecisionItemKeyInput = {
  itemId: string;
  itemTitle: string;
  listTitle: string;
  index: number;
};

type FoundationNextActionInput = {
  gateNextAction: string;
  foundationNextAction: string;
};

type FoundationDecisionListMaterializerInput = {
  title: string;
  decisionItems: FoundationDecisionItemList;
  drafts: FoundationDecisionDraftMap;
  onDraftChange: (id: string, patch: FoundationDecisionDraftPatch) => void;
  editable: boolean;
};

function getFoundationOptionalTextValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value;
}

function getFoundationFallbackTextValue(value: string | undefined, fallback: string): string {
  const textValue = getFoundationOptionalTextValue(value);
  const hasTextValue = textValue.length > 0;
  if (hasTextValue === true) {
    return textValue;
  }

  return fallback;
}

function getFoundationBootstrapState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceBootstrapState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.bootstrap_state;
}

function getFoundationEngineeringExecution(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceExecutionState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.execution;
}

function getFoundationEngineeringRecovery(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceRecoveryState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.recovery;
}

function getFoundationEngineeringNextAction(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): string {
  const execution = getFoundationEngineeringExecution(engineeringState);
  if (execution === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(execution.next_action);
}

function getFoundationRecoveryResumeStage(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(recovery.resume_stage);
}

function getFoundationRecoveryResumeMode(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(recovery.resume_mode);
}

function canRetryFoundationRecovery(recovery: WorkspaceRecoveryState | undefined): boolean {
  if (recovery === undefined) {
    return false;
  }

  const canRetry = recovery.can_retry === true;
  return canRetry === true;
}

function getFoundationRecoveryRetryLabel(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(recovery.retry_label);
}

function getFoundationDecisionItemList(
  items: FoundationDecisionItemList | undefined,
): FoundationDecisionItemList {
  if (Array.isArray(items) === false) {
    return emptyFoundationDecisionItems;
  }

  return items;
}

function getFoundationRequiredDecisions(
  foundationState: WorkspaceBootstrapState | undefined,
): FoundationDecisionItemList {
  if (foundationState === undefined) {
    return emptyFoundationDecisionItems;
  }

  return getFoundationDecisionItemList(foundationState.required_decisions);
}

function getFoundationReservedDecisions(
  foundationState: WorkspaceBootstrapState | undefined,
): FoundationDecisionItemList {
  if (foundationState === undefined) {
    return emptyFoundationDecisionItems;
  }

  return getFoundationDecisionItemList(foundationState.reserved_extensions);
}

function getFoundationDeferredDecisions(
  foundationState: WorkspaceBootstrapState | undefined,
): FoundationDecisionItemList {
  if (foundationState === undefined) {
    return emptyFoundationDecisionItems;
  }

  return getFoundationDecisionItemList(foundationState.deferred_decisions);
}

function getFoundationAllDecisions(
  foundationState: WorkspaceBootstrapState | undefined,
): FoundationDecisionItemList {
  return [
    ...getFoundationRequiredDecisions(foundationState),
    ...getFoundationReservedDecisions(foundationState),
    ...getFoundationDeferredDecisions(foundationState),
  ];
}

function getFoundationStateBlockers(
  foundationState: WorkspaceBootstrapState | undefined,
): FoundationBlockingItemList {
  if (foundationState === undefined) {
    return emptyFoundationBlockingItems;
  }

  if (Array.isArray(foundationState.blockers) === false) {
    return emptyFoundationBlockingItems;
  }

  return foundationState.blockers;
}

function getFoundationGateBlockingItems(
  foundationState: WorkspaceBootstrapState | undefined,
): FoundationBlockingItemList {
  if (foundationState === undefined) {
    return emptyFoundationBlockingItems;
  }

  const gateResult = foundationState.gate_result;
  if (gateResult === undefined) {
    return emptyFoundationBlockingItems;
  }

  if (Array.isArray(gateResult.blocking_items) === false) {
    return emptyFoundationBlockingItems;
  }

  return gateResult.blocking_items;
}

function getFoundationGateDecision(foundationState: WorkspaceBootstrapState | undefined): string {
  if (foundationState === undefined) {
    return '';
  }

  const gateResult = foundationState.gate_result;
  if (gateResult === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(gateResult.decision);
}

function getFoundationTemplateId(foundationState: WorkspaceBootstrapState | undefined): string {
  if (foundationState === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(foundationState.template_id);
}

function getFoundationRiskLevel(foundationState: WorkspaceBootstrapState | undefined): string {
  if (foundationState === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(foundationState.foundation_risk_level);
}

function getFoundationGateNextAction(foundationState: WorkspaceBootstrapState | undefined): string {
  if (foundationState === undefined) {
    return '';
  }

  const gateResult = foundationState.gate_result;
  if (gateResult === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(gateResult.next_action);
}

function getFoundationNextAction(foundationState: WorkspaceBootstrapState | undefined): string {
  if (foundationState === undefined) {
    return '';
  }

  return getFoundationOptionalTextValue(foundationState.next_action);
}

function hasFoundationContextGateBlock(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): boolean {
  if (engineeringState === undefined) {
    return false;
  }

  const validation = engineeringState.validation;
  const hasContextGate = validation !== undefined && validation.gate === 'context-memory-isolation';
  const execution = getFoundationEngineeringExecution(engineeringState);
  const hasContextPauseReason = execution !== undefined && execution.pause_reason === 'context_gate_blocked';
  const hasContextGateBlock = hasContextGate === true || hasContextPauseReason === true;
  return hasContextGateBlock === true;
}

function hasFoundationGateBlock(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
  foundationState: WorkspaceBootstrapState | undefined,
): boolean {
  const execution = getFoundationEngineeringExecution(engineeringState);
  const hasFoundationPauseReason = execution !== undefined && execution.pause_reason === 'foundation_gate_blocked';
  const gateDecision = getFoundationGateDecision(foundationState);
  const hasBlockingGateDecision = gateDecision === 'block';
  const hasGateBlock = hasFoundationPauseReason === true || hasBlockingGateDecision === true;
  return hasGateBlock === true;
}

function hasFoundationTextItem(value: string): boolean {
  const hasTextItem = value.length > 0;
  return hasTextItem === true;
}

function getFoundationNonEmptyTextItems(items: FoundationTextItemList): FoundationTextItemList {
  const textItems: FoundationTextItemList = [];
  for (const item of items) {
    const hasTextItem = hasFoundationTextItem(item);
    if (hasTextItem === true) {
      textItems.push(item);
    }
  }

  return textItems;
}

function getFoundationRecoveryStageParts(resumeStage: string, resumeMode: string): FoundationTextItemList {
  return getFoundationNonEmptyTextItems([resumeStage, resumeMode]);
}

function getFoundationRecoveryDisplayStageParts(
  recovery: WorkspaceRecoveryState | undefined,
): FoundationTextItemList {
  const resumeStage = getFoundationRecoveryResumeStage(recovery);
  const resumeMode = getFoundationRecoveryResumeMode(recovery);
  return getFoundationRecoveryStageParts(resumeStage, resumeMode);
}

function getFoundationRecoveryStageLabel(recoveryStageParts: FoundationTextItemList): string {
  let label = '';
  for (const item of recoveryStageParts) {
    if (label.length === 0) {
      label = item;
    } else {
      label = `${label} / ${item}`;
    }
  }

  return label;
}

function getFoundationRecoveryRetryDisplayLabel({
  retryLabel,
  retryFallbackLabel,
}: {
  retryLabel: string;
  retryFallbackLabel: string;
}): string {
  const hasRetryLabel = retryLabel.length > 0;
  if (hasRetryLabel === true) {
    return retryLabel;
  }

  return retryFallbackLabel;
}

function getFoundationBlockingItems(
  foundationBlockers: FoundationBlockingItemList,
  gateBlockingItems: FoundationBlockingItemList,
): FoundationBlockingItemList {
  return getFoundationNonEmptyTextItems([
    ...foundationBlockers,
    ...gateBlockingItems,
  ]);
}

function getFoundationDefaultDecisionSelectedOption(item: WorkspaceBootstrapDecisionItem): string {
  const selectedOption = getFoundationDecisionItemSelectedOption(item);
  const hasSelectedOption = selectedOption.length > 0;
  if (hasSelectedOption === true) {
    return selectedOption;
  }

  return getFoundationDecisionItemRecommendedOption(item);
}

function getDefaultDecisionDraft(item: WorkspaceBootstrapDecisionItem): FoundationDecisionDraft {
  const notes = getFoundationDecisionItemNotes(item);

  return {
    selectedOption: getFoundationDefaultDecisionSelectedOption(item),
    notes,
  };
}

function getFoundationDecisionDisplayTitle(item: WorkspaceBootstrapDecisionItem) {
  const title = getFoundationDecisionItemTitle(item);
  const hasTitle = title.length > 0;
  const id = getFoundationDecisionId(item);
  const hasId = id.length > 0;

  if (hasTitle === true) return title;
  if (hasId === true) return id;
  return '未命名决策';
}

function getDecisionDraftInputValue(
  drafts: FoundationDecisionDraftMap,
  item: WorkspaceBootstrapDecisionItem,
  field: keyof FoundationDecisionDraft,
) {
  const decisionId = getFoundationDecisionId(item);
  const hasDecisionId = decisionId.length > 0;
  if (hasDecisionId === false) return '';

  return getFoundationDecisionDraftFieldValue(drafts, decisionId, field);
}

function getDecisionRecommendedOptionPlaceholder(item: WorkspaceBootstrapDecisionItem) {
  const recommendedOption = getFoundationDecisionItemRecommendedOption(item);
  const hasRecommendedOption = recommendedOption.length > 0;
  if (hasRecommendedOption === true) {
    return recommendedOption;
  }

  return '填写当前确认选项';
}

function getContextRepairTargetKey(target: ContextGateRepairTarget) {
  const field = getFoundationFallbackTextValue(target.field, 'default');
  return `${target.path}-${field}`;
}

function materializeFoundationContextRepairTargetDetailNodes(
  contextRepairTargets: ContextGateRepairTarget[],
): FoundationContextRepairTargetNodeList {
  const nodes: FoundationContextRepairTargetNodeList = [];

  for (const target of contextRepairTargets) {
    nodes.push(
      <div key={getContextRepairTargetKey(target)}>
        <div>- {target.reason}</div>
        <div className="pl-3 text-muted-foreground">{target.suggestion}</div>
      </div>,
    );
  }

  return nodes;
}

function materializeFoundationContextRepairTargetActionNodes({
  contextRepairTargets,
  onOpenFoundationFile,
}: {
  contextRepairTargets: ContextGateRepairTarget[];
  onOpenFoundationFile: WorkspaceFoundationOpenFileAction;
}): FoundationContextRepairTargetNodeList {
  const nodes: FoundationContextRepairTargetNodeList = [];

  for (const target of contextRepairTargets) {
    nodes.push(
      <Button
        key={getContextRepairTargetKey(target)}
        size="sm"
        variant="outline"
        className="border-destructive/30 bg-background"
        onClick={() => onOpenFoundationFile({
          path: target.path,
          searchText: target.searchText,
          label: target.label,
        })}
      >
        {target.label}
      </Button>,
    );
  }

  return nodes;
}

function materializeFoundationBlockingItemNodes(
  blockingItems: FoundationBlockingItemList,
): FoundationBlockingItemNodeList {
  const nodes: FoundationBlockingItemNodeList = [];

  for (let index = 0; index < blockingItems.length; index += 1) {
    const item = blockingItems[index];
    if (item === undefined) {
      continue;
    }

    nodes.push(
      <li key={`${item}-${index}`}>- {item}</li>,
    );
  }

  return nodes;
}

function hasFoundationDecisionId(item: WorkspaceBootstrapDecisionItem) {
  const decisionId = getFoundationDecisionId(item);
  return decisionId.length > 0;
}

function getFoundationDecisionId(item: WorkspaceBootstrapDecisionItem): string {
  const decisionId = getFoundationOptionalTextValue(item.id);
  const hasDecisionId = decisionId.length > 0;
  if (hasDecisionId === false) {
    return '';
  }

  return decisionId;
}

function getFoundationDecisionDraft(
  drafts: FoundationDecisionDraftMap,
  decisionId: string,
): FoundationDecisionDraft | undefined {
  const hasDecisionId = decisionId.length > 0;
  if (hasDecisionId === false) {
    return undefined;
  }

  return drafts[decisionId];
}

function getFoundationDecisionDraftFieldValue(
  drafts: FoundationDecisionDraftMap,
  decisionId: string,
  field: keyof FoundationDecisionDraft,
): string {
  const draft = getFoundationDecisionDraft(drafts, decisionId);
  if (draft === undefined) {
    return '';
  }

  return draft[field];
}

function getFoundationDecisionDraftSelectedOption(
  drafts: FoundationDecisionDraftMap,
  decisionId: string,
): string {
  return getFoundationDecisionDraftFieldValue(drafts, decisionId, 'selectedOption');
}

function getFoundationDecisionDraftNotes(
  drafts: FoundationDecisionDraftMap,
  decisionId: string,
): string {
  return getFoundationDecisionDraftFieldValue(drafts, decisionId, 'notes');
}

function getFoundationDecisionItemSelectedOption(item: WorkspaceBootstrapDecisionItem): string {
  return getFoundationOptionalTextValue(item.selected_option);
}

function getFoundationDecisionItemRecommendedOption(item: WorkspaceBootstrapDecisionItem): string {
  return getFoundationOptionalTextValue(item.recommended_option);
}

function getFoundationDecisionItemNotes(item: WorkspaceBootstrapDecisionItem): string {
  return getFoundationOptionalTextValue(item.notes);
}

function getFoundationDecisionItemTitle(item: WorkspaceBootstrapDecisionItem): string {
  return getFoundationOptionalTextValue(item.title);
}

function getFoundationDecisionItemDomain(item: WorkspaceBootstrapDecisionItem): string {
  return getFoundationOptionalTextValue(item.domain);
}

function getFoundationDecisionItemKey({
  itemId,
  itemTitle,
  listTitle,
  index,
}: FoundationDecisionItemKeyInput): string {
  const hasItemId = itemId.length > 0;
  if (hasItemId === true) {
    return itemId;
  }

  const hasItemTitle = itemTitle.length > 0;
  if (hasItemTitle === true) {
    return itemTitle;
  }

  return `${listTitle}-${index}`;
}

function getFoundationDecisionDraftOrDefault(
  drafts: FoundationDecisionDraftMap,
  decisionId: string,
  item: WorkspaceBootstrapDecisionItem,
): FoundationDecisionDraft {
  const draft = getFoundationDecisionDraft(drafts, decisionId);
  if (draft === undefined) {
    return getDefaultDecisionDraft(item);
  }

  return draft;
}

function getFoundationDecisionDraftPatchBase(
  drafts: FoundationDecisionDraftMap,
  decisionId: string,
): FoundationDecisionDraft {
  const draft = getFoundationDecisionDraft(drafts, decisionId);
  if (draft === undefined) {
    return { selectedOption: '', notes: '' };
  }

  return draft;
}

function hasFoundationDecisionOptionValue(value: string): boolean {
  const normalizedValue = value.trim();
  const hasValue = normalizedValue.length > 0;
  return hasValue === true;
}

function getFoundationDecisionConfirmationSelectedOption(
  item: WorkspaceBootstrapDecisionItem,
  drafts: FoundationDecisionDraftMap,
): string {
  const decisionId = getFoundationDecisionId(item);
  const hasDecisionId = decisionId.length > 0;
  const itemSelectedOption = getFoundationDecisionItemSelectedOption(item);
  if (hasDecisionId === false) {
    return itemSelectedOption;
  }

  const draftSelectedOption = getFoundationDecisionDraftSelectedOption(drafts, decisionId);
  const hasDraftSelectedOption = draftSelectedOption.length > 0;
  if (hasDraftSelectedOption === true) {
    return draftSelectedOption;
  }

  const hasItemSelectedOption = itemSelectedOption.length > 0;
  if (hasItemSelectedOption === true) {
    return itemSelectedOption;
  }

  return getFoundationDecisionItemRecommendedOption(item);
}

function getFoundationDecisionConfirmationNotes(
  item: WorkspaceBootstrapDecisionItem,
  drafts: FoundationDecisionDraftMap,
): string {
  const decisionId = getFoundationDecisionId(item);
  const hasDecisionId = decisionId.length > 0;
  if (hasDecisionId === false) {
    return '';
  }

  return getFoundationDecisionDraftNotes(drafts, decisionId);
}

function hasFoundationRequiredDecisionDraft(
  item: WorkspaceBootstrapDecisionItem,
  drafts: FoundationDecisionDraftMap,
): boolean {
  const decisionId = getFoundationDecisionId(item);
  const hasDecisionId = decisionId.length > 0;
  if (hasDecisionId === false) {
    return true;
  }

  const draftSelectedOption = getFoundationDecisionDraftSelectedOption(drafts, decisionId);
  const hasDraftSelectedOption = hasFoundationDecisionOptionValue(draftSelectedOption);
  if (hasDraftSelectedOption === true) {
    return true;
  }

  const itemSelectedOption = getFoundationDecisionItemSelectedOption(item);
  const hasItemSelectedOption = hasFoundationDecisionOptionValue(itemSelectedOption);
  if (hasItemSelectedOption === true) {
    return true;
  }

  const recommendedOption = getFoundationDecisionItemRecommendedOption(item);
  const hasRecommendedOption = hasFoundationDecisionOptionValue(recommendedOption);
  return hasRecommendedOption === true;
}

function hasAllFoundationRequiredDecisionDrafts(
  items: FoundationDecisionItemList,
  drafts: FoundationDecisionDraftMap,
): boolean {
  for (const item of items) {
    const hasRequiredDraft = hasFoundationRequiredDecisionDraft(item, drafts);
    if (hasRequiredDraft === false) {
      return false;
    }
  }

  return true;
}

function shouldRenderFoundationNextAction({
  gateNextAction,
  foundationNextAction,
}: FoundationNextActionInput): boolean {
  const hasGateNextAction = gateNextAction.length > 0;
  if (hasGateNextAction === true) {
    return true;
  }

  const hasFoundationNextAction = foundationNextAction.length > 0;
  return hasFoundationNextAction === true;
}

function getFoundationDisplayedNextAction({
  gateNextAction,
  foundationNextAction,
}: FoundationNextActionInput): string {
  const hasGateNextAction = gateNextAction.length > 0;
  if (hasGateNextAction === true) {
    return gateNextAction;
  }

  return foundationNextAction;
}

function materializeFoundationDecisionItemNodes({
  title,
  decisionItems,
  drafts,
  onDraftChange,
  editable,
}: FoundationDecisionListMaterializerInput): FoundationDecisionItemNodeList {
  const nodes: FoundationDecisionItemNodeList = [];

  for (let index = 0; index < decisionItems.length; index += 1) {
    const item = decisionItems[index];
    if (item === undefined) {
      continue;
    }

    const itemId = getFoundationDecisionId(item);
    const hasItemId = itemId.length > 0;
    const itemTitle = getFoundationDecisionItemTitle(item);
    const itemKey = getFoundationDecisionItemKey({
      itemId,
      itemTitle,
      listTitle: title,
      index,
    });
    const domain = getFoundationDecisionItemDomain(item);
    const hasDomain = domain.length > 0;
    const recommendedOption = getFoundationDecisionItemRecommendedOption(item);
    const hasRecommendedOption = recommendedOption.length > 0;
    const selectedOption = getFoundationDecisionItemSelectedOption(item);
    const hasSelectedOption = selectedOption.length > 0;
    const shouldRenderEditableDraft = hasItemId === true && editable === true;

    nodes.push(
      <div key={itemKey} className="rounded-lg border bg-card/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{getFoundationDecisionDisplayTitle(item)}</div>
            {hasDomain === true && <div className="mt-1 text-xs text-muted-foreground">{domain}</div>}
          </div>
          <Badge variant="outline">{getFoundationDecisionStatusLabel(item.status)}</Badge>
        </div>
        {hasRecommendedOption === true && (
          <div className="mt-2 text-xs text-muted-foreground">
            建议: {recommendedOption}
          </div>
        )}
        {shouldRenderEditableDraft === true ? (
          <div className="mt-3 space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">当前确认选项</div>
              <Input
                value={getDecisionDraftInputValue(drafts, item, 'selectedOption')}
                onChange={(event) => onDraftChange(itemId, { selectedOption: event.target.value })}
                placeholder={getDecisionRecommendedOptionPlaceholder(item)}
                className="h-9"
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">备注</div>
              <Textarea
                value={getDecisionDraftInputValue(drafts, item, 'notes')}
                onChange={(event) => onDraftChange(itemId, { notes: event.target.value })}
                placeholder="补充约束、原因、暂缓条件或后续动作"
                className="min-h-[72px] resize-y"
              />
            </div>
          </div>
        ) : hasSelectedOption === true ? (
          <div className="mt-1 text-xs text-foreground/80">
            已选: {selectedOption}
          </div>
        ) : null}
      </div>,
    );
  }

  return nodes;
}

function renderDecisionList(
  title: string,
  items: WorkspaceBootstrapDecisionItem[] | undefined,
  drafts: FoundationDecisionDraftMap,
  onDraftChange: (id: string, patch: FoundationDecisionDraftPatch) => void,
  editable: boolean,
) {
  const decisionItems = getFoundationDecisionItemList(items);
  const hasDecisionItems = decisionItems.length > 0;
  if (hasDecisionItems === false) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge variant="secondary">{decisionItems.length}</Badge>
      </div>
      <div className="space-y-2">
        {materializeFoundationDecisionItemNodes({
          title,
          decisionItems,
          drafts,
          onDraftChange,
          editable,
        })}
      </div>
    </section>
  );
}

function materializeFoundationDecisionDraftMap({
  previousDrafts,
  editableAllDecisions,
}: {
  previousDrafts: FoundationDecisionDraftMap;
  editableAllDecisions: FoundationDecisionItemList;
}): FoundationDecisionDraftMap {
  const nextDrafts: FoundationDecisionDraftMap = {};

  for (const item of editableAllDecisions) {
    const hasDecisionId = hasFoundationDecisionId(item);
    if (hasDecisionId === false) {
      continue;
    }

    const decisionId = getFoundationDecisionId(item);
    nextDrafts[decisionId] = getFoundationDecisionDraftOrDefault(previousDrafts, decisionId, item);
  }

  return nextDrafts;
}

function materializeFoundationDecisionConfirmationPayload({
  editableAllDecisions,
  decisionDrafts,
}: {
  editableAllDecisions: FoundationDecisionItemList;
  decisionDrafts: FoundationDecisionDraftMap;
}): FoundationDecisionConfirmationList {
  const confirmationPayload: FoundationDecisionConfirmationList = [];

  for (const item of editableAllDecisions) {
    const selectedOption = getFoundationDecisionConfirmationSelectedOption(item, decisionDrafts);
    const notes = getFoundationDecisionConfirmationNotes(item, decisionDrafts);

    confirmationPayload.push({
      id: item.id,
      title: item.title,
      bucket: item.bucket,
      selectedOption,
      notes,
    });
  }

  return confirmationPayload;
}

type FoundationPanelRecoverySummaryProps = {
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  retryFallbackLabel: string;
};

function FoundationPanelRecoverySummary({
  engineeringState,
  retryFallbackLabel,
}: FoundationPanelRecoverySummaryProps) {
  const nextAction = getFoundationEngineeringNextAction(engineeringState);
  const hasNextAction = nextAction.length > 0;
  const recovery = getFoundationEngineeringRecovery(engineeringState);
  const hasRecovery = recovery !== undefined;
  if (hasNextAction === false && hasRecovery === false) return null;

  const recoveryStageParts = getFoundationRecoveryDisplayStageParts(recovery);
  const hasRecoveryStageParts = recoveryStageParts.length > 0;
  const recoveryStageLabel = getFoundationRecoveryStageLabel(recoveryStageParts);
  const canRetry = canRetryFoundationRecovery(recovery);
  const retryLabel = getFoundationRecoveryRetryLabel(recovery);
  const retryDisplayLabel = getFoundationRecoveryRetryDisplayLabel({
    retryLabel,
    retryFallbackLabel,
  });

  return (
    <div className="mt-2 space-y-1 text-xs text-destructive/90">
      {hasNextAction === true && (
        <div>下一步：{nextAction}</div>
      )}
      {hasRecoveryStageParts === true && (
        <div>
          恢复阶段：{recoveryStageLabel}
        </div>
      )}
      {canRetry === true && (
        <div>
          重试入口：{retryDisplayLabel}
        </div>
      )}
    </div>
  );
}

function getFoundationPanelSnapshotClassName(snapshot: FoundationPanelSnapshot) {
  if (snapshot.status === 'foundation_blocked' || snapshot.status === 'context_blocked') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'awaiting_decisions') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'busy') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (snapshot.status === 'empty') {
    return 'border-muted-foreground/20 bg-muted/20 text-muted-foreground';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function getFoundationPanelSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function FoundationPanelSnapshotStrip({ snapshot }: { snapshot: FoundationPanelSnapshot }) {
  const canConfirmLabel = getFoundationPanelSnapshotBooleanLabel(snapshot.canConfirm);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-foundation-panel-snapshot"
      className={cn('mt-3 rounded-md border px-2.5 py-2 text-xs', getFoundationPanelSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Foundation 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Required: {snapshot.requiredDecisionCount}</span>
        <span>Reserved: {snapshot.reservedDecisionCount}</span>
        <span>Deferred: {snapshot.deferredDecisionCount}</span>
        <span>Blockers: {snapshot.blockerCount}</span>
        <span>ContextRepairs: {snapshot.contextRepairTargetCount}</span>
        <span>CanConfirm: {canConfirmLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

export function WorkspaceFoundationPanel({
  engineeringState,
  contextGateResult,
  foundationActionLabel,
  foundationStatusLabel,
  onStartFoundation,
  onOpenFoundationFile,
  onConfirmFoundationDecisions,
  isBusy,
}: {
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  contextGateResult?: WorkspaceGateResult;
  foundationActionLabel: string;
  foundationStatusLabel: string;
  onStartFoundation: WorkspaceFoundationStartAction;
  onOpenFoundationFile: WorkspaceFoundationOpenFileAction;
  onConfirmFoundationDecisions: WorkspaceFoundationConfirmDecisionsAction;
  isBusy: boolean;
}) {
  const foundationState = getFoundationBootstrapState(engineeringState);
  const contextGateBlocked = hasFoundationContextGateBlock(engineeringState);
  const foundationGateBlocked = hasFoundationGateBlock(engineeringState, foundationState);
  const contextRepairTargets = getContextGateRepairTargets(contextGateResult);
  const [decisionDrafts, setDecisionDrafts] = useState<FoundationDecisionDraftMap>({});

  const editableRequiredDecisions = getFoundationRequiredDecisions(foundationState);
  const editableReservedDecisions = getFoundationReservedDecisions(foundationState);
  const editableDeferredDecisions = getFoundationDeferredDecisions(foundationState);
  const editableAllDecisions = getFoundationAllDecisions(foundationState);

  useEffect(() => {
    setDecisionDrafts((prev) => {
      return materializeFoundationDecisionDraftMap({
        previousDrafts: prev,
        editableAllDecisions: getFoundationAllDecisions(foundationState),
      });
    });
  }, [foundationState]);

  const confirmationPayload = materializeFoundationDecisionConfirmationPayload({
    editableAllDecisions,
    decisionDrafts,
  });

  const hasAllRequiredDrafts = hasAllFoundationRequiredDecisionDrafts(
    editableRequiredDecisions,
    decisionDrafts,
  );
  const isConfirmFoundationDisabled = isBusy === true || hasAllRequiredDrafts === false;
  const foundationPanelSnapshot = buildFoundationPanelSnapshot({
    foundationState,
    contextGateBlocked,
    foundationGateBlocked,
    contextRepairTargetCount: contextRepairTargets.length,
    hasAllRequiredDrafts,
    isBusy,
  });

  const handleDraftChange = (id: string, patch: FoundationDecisionDraftPatch) => {
    setDecisionDrafts((prev) => ({
      ...prev,
      [id]: {
        ...getFoundationDecisionDraftPatchBase(prev, id),
        ...patch,
      },
    }));
  };
  const templateId = getFoundationTemplateId(foundationState);
  const hasTemplateId = templateId.length > 0;
  const gateDecision = getFoundationGateDecision(foundationState);
  const hasGateDecision = gateDecision.length > 0;
  const gateNextAction = getFoundationGateNextAction(foundationState);
  const foundationNextAction = getFoundationNextAction(foundationState);
  const shouldRenderNextAction = shouldRenderFoundationNextAction({
    gateNextAction,
    foundationNextAction,
  });
  const displayedNextAction = getFoundationDisplayedNextAction({
    gateNextAction,
    foundationNextAction,
  });
  const foundationBlockers = getFoundationStateBlockers(foundationState);
  const gateBlockingItems = getFoundationGateBlockingItems(foundationState);
  const blockingItems = getFoundationBlockingItems(foundationBlockers, gateBlockingItems);
  const hasBlockingItems = blockingItems.length > 0;
  const hasContextRepairTargets = contextRepairTargets.length > 0;
  const hasFoundationState = foundationState !== undefined;

  return (
    <div className="h-full w-full min-w-0 overflow-y-auto bg-background">
      <div className="border-b bg-muted/20 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Project Foundation</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              在进入 Plan / Implementation 前，先收敛 must_decide_now 决策与门禁状态。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onStartFoundation} disabled={isBusy}>
              {foundationActionLabel}
            </Button>
            <Button
              size="sm"
              onClick={() => void onConfirmFoundationDecisions(confirmationPayload)}
              disabled={isConfirmFoundationDisabled}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              确认并推进
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">状态: {foundationStatusLabel}</Badge>
          <Badge variant="outline">风险: {getFoundationRiskLabel(getFoundationRiskLevel(foundationState))}</Badge>
          {hasTemplateId === true && <Badge variant="outline">模板: {templateId}</Badge>}
          {hasGateDecision === true && <Badge variant="outline">Gate: {gateDecision}</Badge>}
        </div>
        <FoundationPanelSnapshotStrip snapshot={foundationPanelSnapshot} />
      </div>

      <div className="space-y-4 p-4">
        {foundationGateBlocked === true && (
          <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <ShieldAlert className="h-4 w-4" />
              <span>Foundation Gate 已阻断</span>
            </div>
            <div className="mt-2 text-sm text-destructive/90">
              Project Foundation 尚未完成，当前不能进入实现阶段。
            </div>
            <FoundationPanelRecoverySummary
              engineeringState={engineeringState}
              retryFallbackLabel="重试自动准备项目基础设定"
            />
          </section>
        )}

        {contextGateBlocked === true && (
          <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <ShieldAlert className="h-4 w-4" />
              <span>Context / Memory Gate 已阻断</span>
            </div>
            <div className="mt-2 text-sm text-destructive/90">
              检测到当前项目上下文与结构化真源不一致，继续生成已被阻断。
            </div>
            {hasContextRepairTargets === true && (
              <div className="mt-3 space-y-2 text-xs text-destructive/90">
                {materializeFoundationContextRepairTargetDetailNodes(contextRepairTargets)}
              </div>
            )}
            <FoundationPanelRecoverySummary
              engineeringState={engineeringState}
              retryFallbackLabel="修复后重试"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {materializeFoundationContextRepairTargetActionNodes({
                contextRepairTargets,
                onOpenFoundationFile,
              })}
            </div>
          </section>
        )}

        {shouldRenderNextAction === true && (
          <section className="rounded-lg border bg-card/70 p-4">
            <div className="text-xs font-medium text-muted-foreground">下一步</div>
            <div className="mt-2 text-sm">
              {displayedNextAction}
            </div>
          </section>
        )}

        {hasBlockingItems === true && (
          <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <ShieldAlert className="h-4 w-4" />
              <span>当前阻断项</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-destructive/90">
              {materializeFoundationBlockingItemNodes(blockingItems)}
            </ul>
          </section>
        )}

        {renderDecisionList(
          'Must Decide Now',
          editableRequiredDecisions,
          decisionDrafts,
          handleDraftChange,
          true,
        )}
        {renderDecisionList(
          'Reserve Extension Now',
          editableReservedDecisions,
          decisionDrafts,
          handleDraftChange,
          true,
        )}
        {renderDecisionList(
          'Defer With Record',
          editableDeferredDecisions,
          decisionDrafts,
          handleDraftChange,
          true,
        )}

        {hasFoundationState === false && (
          <section className="rounded-lg border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
            当前还没有 Foundation 状态。点击右上角按钮即可启动 Project Foundation。
          </section>
        )}

        {hasFoundationState === true && (
          <section className="rounded-lg border border-primary/15 bg-primary/5 p-4">
            <div className="text-xs font-medium text-muted-foreground">工作台说明</div>
            <p className="mt-2 text-sm text-foreground/80">
              你可以直接在这里填写每个决策项的确认选项和备注，再点击“确认并推进”。系统会自动生成 Foundation 确认摘要并推进主链，不需要手写 prompt。
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
