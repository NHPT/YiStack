'use client';

import type { ReactNode } from 'react';

import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceRecoveryState,
} from '@/lib/workspace/engineering-state';
import { isWorkspaceBackendWorkflowStage } from '@/lib/workspace/workflow-contract';

import { cn } from '@/lib/utils';

import { buildWorkspaceGuidanceSnapshot } from './workspace-guidance-snapshot';
import type {
  GuidanceAction,
  GuidanceActionKind,
  WorkspaceGenerationMode,
  WorkspaceGuidanceSnapshot,
  WorkspaceSuggestedQuestionList,
} from './workspace-types';

export type WorkspaceGuidanceActionTone = 'primary' | 'secondary';
export type WorkspaceRecoveryActionLabel = string;
export type WorkspaceRecoveryActionLabelList = WorkspaceRecoveryActionLabel[];
export type WorkspaceGuidanceActionPriorityMap = {
  [kind in GuidanceActionKind]: number;
};

export type WorkspaceRecoveryActionSummary = {
  actionCount: number;
  primaryActionCount: number;
  retryActionCount: number;
  labels: WorkspaceRecoveryActionLabelList;
  summaryLabel: string;
};

type GuidanceMessageLike = {
  suggestedQuestions?: WorkspaceSuggestedQuestionList;
  suggestedActions?: GuidanceAction[];
  engineeringState?: WorkspaceEngineeringStateSnapshot;
};

type WorkspaceGuidanceActionList = GuidanceAction[];
type WorkspaceGuidanceRecoveryActionList = GuidanceAction[];
type WorkspaceGuidanceActionSortItem = {
  action: GuidanceAction;
  index: number;
};
type WorkspaceGuidanceActionSortItemList = WorkspaceGuidanceActionSortItem[];
type WorkspaceGuidanceActionViewModel = {
  action: GuidanceAction;
  key: string;
  tone: WorkspaceGuidanceActionTone;
  className: string;
};
type WorkspaceGuidanceActionViewModelList = WorkspaceGuidanceActionViewModel[];
type WorkspaceGuidanceQuestionNodeList = ReactNode[];
type WorkspaceGuidanceActionNodeList = ReactNode[];
type WorkspaceGuidanceQuestionHandler = (question: string) => void;
type WorkspaceGuidanceActionHandler = (action: GuidanceAction) => void;

const WORKSPACE_GUIDANCE_ACTION_PRIORITY: WorkspaceGuidanceActionPriorityMap = {
  open_foundation_panel: 10,
  refresh_explorer_panel: 10,
  open_explorer_panel: 10,
  open_git_panel: 10,
  open_context_repair: 10,
  open_validation_failure: 10,
  open_capability_audit: 10,
  confirm_recommended_plan: 20,
  retry_workflow_gate: 30,
  retry_context_gate: 30,
  retry_plan_generation: 35,
  send_prompt: 40,
};

function normalizeRecoveryActionMode(mode?: string): WorkspaceGenerationMode | undefined {
  if (mode === 'foundation') return mode;
  if (mode === 'discuss') return mode;
  if (mode === 'implement') return mode;
  return undefined;
}

function hasWorkspaceGuidancePrimaryActionTone(action: GuidanceAction): boolean {
  const isConfirmRecommendedPlan = action.kind === 'confirm_recommended_plan';
  if (isConfirmRecommendedPlan === true) {
    return true;
  }

  const isOpenAction = action.kind.startsWith('open_');
  if (isOpenAction === true) {
    return true;
  }

  const isRefreshExplorerPanel = action.kind === 'refresh_explorer_panel';
  return isRefreshExplorerPanel === true;
}

export function getWorkspaceGuidanceActionTone(action: GuidanceAction): WorkspaceGuidanceActionTone {
  const hasPrimaryTone = hasWorkspaceGuidancePrimaryActionTone(action);
  if (hasPrimaryTone === true) {
    return 'primary';
  }

  return 'secondary';
}

function getWorkspaceGuidanceActionClassName(tone: WorkspaceGuidanceActionTone) {
  if (tone === 'primary') {
    return 'rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15';
  }

  return 'rounded-md border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground';
}

function getWorkspaceGuidanceSuggestedActions(message: GuidanceMessageLike): WorkspaceGuidanceActionList {
  if (Array.isArray(message.suggestedActions) === false) {
    return [];
  }

  return message.suggestedActions;
}

function getWorkspaceGuidanceSuggestedQuestions(message: GuidanceMessageLike): WorkspaceSuggestedQuestionList {
  if (Array.isArray(message.suggestedQuestions) === false) {
    return [];
  }

  return message.suggestedQuestions;
}

function getWorkspaceGuidanceRecoveryState(
  message: GuidanceMessageLike,
): WorkspaceRecoveryState | undefined {
  const engineeringState = message.engineeringState;
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.recovery;
}

function hasWorkspaceGuidanceRecoveryRetry(recovery: WorkspaceRecoveryState | undefined): boolean {
  if (recovery === undefined) {
    return false;
  }

  return recovery.can_retry === true;
}

function getWorkspaceGuidanceTrimmedTextValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value.trim();
}

function hasWorkspaceGuidanceTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceGuidanceRetryPrompt(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getWorkspaceGuidanceTrimmedTextValue(recovery.retry_prompt);
}

function getWorkspaceGuidanceRetryLabel(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getWorkspaceGuidanceTrimmedTextValue(recovery.retry_label);
}

function getWorkspaceGuidanceRecoveryMode(
  recovery: WorkspaceRecoveryState | undefined,
): WorkspaceGenerationMode | undefined {
  if (recovery === undefined) {
    return undefined;
  }

  return normalizeRecoveryActionMode(recovery.resume_mode);
}

function getWorkspaceGuidanceRecoveryStage(
  recovery: WorkspaceRecoveryState | undefined,
) {
  if (recovery === undefined) {
    return undefined;
  }

  if (isWorkspaceBackendWorkflowStage(recovery.resume_stage) === false) {
    return undefined;
  }

  return recovery.resume_stage;
}

function getWorkspaceGuidanceActionConversationStage(action: GuidanceAction): string {
  if (action.conversationStage === undefined) {
    return '';
  }

  return action.conversationStage;
}

function getWorkspaceGuidanceActionNavigationPath(action: GuidanceAction): string {
  const navigationTarget = action.navigationTarget;
  if (navigationTarget === undefined) {
    return '';
  }

  return navigationTarget.path;
}

function getWorkspaceGuidanceActionNavigationLineNumber(action: GuidanceAction): string {
  const navigationTarget = action.navigationTarget;
  if (navigationTarget === undefined) {
    return '';
  }

  if (navigationTarget.lineNumber === undefined) {
    return '';
  }

  return navigationTarget.lineNumber.toString();
}

function lacksWorkspaceGuidanceRecoveryRetryFallback({
  hasRecoveryRetry,
  hasRetryPrompt,
}: {
  hasRecoveryRetry: boolean;
  hasRetryPrompt: boolean;
}): boolean {
  if (hasRecoveryRetry === false) {
    return true;
  }

  return hasRetryPrompt === false;
}

function getWorkspaceGuidanceRetryActionLabel({
  retryLabel,
  hasRetryLabel,
}: {
  retryLabel: string;
  hasRetryLabel: boolean;
}): string {
  if (hasRetryLabel === true) {
    return retryLabel;
  }

  return '修复后重试';
}

export function deriveWorkspaceGuidanceActions(message: GuidanceMessageLike): GuidanceAction[] {
  const explicitSuggestedActions = getWorkspaceGuidanceSuggestedActions(message);
  const hasExplicitSuggestedActions = explicitSuggestedActions.length > 0;
  if (hasExplicitSuggestedActions === true) {
    return explicitSuggestedActions;
  }

  const recovery = getWorkspaceGuidanceRecoveryState(message);
  const hasRecoveryRetry = hasWorkspaceGuidanceRecoveryRetry(recovery);
  const retryPrompt = getWorkspaceGuidanceRetryPrompt(recovery);
  const hasRetryPrompt = hasWorkspaceGuidanceTextValue(retryPrompt);
  const lacksRetryFallback = lacksWorkspaceGuidanceRecoveryRetryFallback({
    hasRecoveryRetry,
    hasRetryPrompt,
  });
  if (lacksRetryFallback === true) {
    return [];
  }
  const retryLabel = getWorkspaceGuidanceRetryLabel(recovery);
  const hasRetryLabel = hasWorkspaceGuidanceTextValue(retryLabel);

  return [{
    label: getWorkspaceGuidanceRetryActionLabel({
      retryLabel,
      hasRetryLabel,
    }),
    kind: 'retry_workflow_gate',
    prompt: retryPrompt,
    mode: getWorkspaceGuidanceRecoveryMode(recovery),
    conversationStage: getWorkspaceGuidanceRecoveryStage(recovery),
  }];
}

function getWorkspaceGuidanceActionSortValue({
  priorityDelta,
  leftIndex,
  rightIndex,
}: {
  priorityDelta: number;
  leftIndex: number;
  rightIndex: number;
}): number {
  const hasPriorityDelta = priorityDelta !== 0;
  if (hasPriorityDelta === true) {
    return priorityDelta;
  }

  return leftIndex - rightIndex;
}

function materializeWorkspaceGuidanceActionSortItems(actions: GuidanceAction[]): WorkspaceGuidanceActionSortItemList {
  const items: WorkspaceGuidanceActionSortItemList = [];

  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (action === undefined) {
      continue;
    }

    items.push({ action, index });
  }

  return items;
}

function compareWorkspaceGuidanceActionSortItems(
  left: WorkspaceGuidanceActionSortItem,
  right: WorkspaceGuidanceActionSortItem,
): number {
  const priorityDelta = WORKSPACE_GUIDANCE_ACTION_PRIORITY[left.action.kind]
    - WORKSPACE_GUIDANCE_ACTION_PRIORITY[right.action.kind];

  return getWorkspaceGuidanceActionSortValue({
    priorityDelta,
    leftIndex: left.index,
    rightIndex: right.index,
  });
}

function materializeWorkspaceGuidanceActionsFromSortItems(
  items: WorkspaceGuidanceActionSortItemList,
): WorkspaceGuidanceActionList {
  const actions: WorkspaceGuidanceActionList = [];

  for (const item of items) {
    actions.push(item.action);
  }

  return actions;
}

export function sortWorkspaceGuidanceActions(actions: GuidanceAction[]): GuidanceAction[] {
  const items = materializeWorkspaceGuidanceActionSortItems(actions);
  items.sort(compareWorkspaceGuidanceActionSortItems);
  return materializeWorkspaceGuidanceActionsFromSortItems(items);
}

function isWorkspaceRecoveryAction(action: GuidanceAction) {
  const isOpenAction = action.kind.startsWith('open_');
  if (isOpenAction === true) {
    return true;
  }

  const isRetryAction = action.kind.startsWith('retry_');
  if (isRetryAction === true) {
    return true;
  }

  const isRefreshExplorerPanel = action.kind === 'refresh_explorer_panel';
  return isRefreshExplorerPanel === true;
}

function getWorkspaceGuidanceRecoveryActions(actions: GuidanceAction[]): WorkspaceGuidanceRecoveryActionList {
  const recoveryActions: WorkspaceGuidanceRecoveryActionList = [];
  for (const action of actions) {
    const isRecoveryAction = isWorkspaceRecoveryAction(action);
    if (isRecoveryAction === true) {
      recoveryActions.push(action);
    }
  }

  return recoveryActions;
}

function getWorkspaceGuidanceRecoveryActionLabels(
  actions: WorkspaceGuidanceRecoveryActionList,
): WorkspaceRecoveryActionLabelList {
  const labels: WorkspaceRecoveryActionLabelList = [];
  for (const action of actions) {
    const label = getWorkspaceGuidanceTrimmedTextValue(action.label);
    const hasLabel = hasWorkspaceGuidanceTextValue(label);
    if (hasLabel === true) {
      labels.push(label);
    }
  }

  return labels;
}

function getWorkspaceGuidancePrimaryActionCount(actions: GuidanceAction[]): number {
  let primaryActionCount = 0;
  for (const action of actions) {
    const tone = getWorkspaceGuidanceActionTone(action);
    if (tone === 'primary') {
      primaryActionCount += 1;
    }
  }

  return primaryActionCount;
}

function getWorkspaceGuidanceRetryActionCount(actions: GuidanceAction[]): number {
  let retryActionCount = 0;
  for (const action of actions) {
    const isRetryAction = action.kind.startsWith('retry_');
    if (isRetryAction === true) {
      retryActionCount += 1;
    }
  }

  return retryActionCount;
}

function getWorkspaceRecoveryActionSummaryLabel(
  labels: WorkspaceRecoveryActionLabelList,
): string {
  const hasLabels = labels.length > 0;
  if (hasLabels === true) {
    return `恢复入口 ${labels.length} 个：${labels.join(' / ')}`;
  }

  return '';
}

export function deriveWorkspaceRecoveryActionSummary(message: GuidanceMessageLike): WorkspaceRecoveryActionSummary {
  const actions = getWorkspaceGuidanceRecoveryActions(sortWorkspaceGuidanceActions(deriveWorkspaceGuidanceActions(message)));
  const labels = getWorkspaceGuidanceRecoveryActionLabels(actions);
  const primaryActionCount = getWorkspaceGuidancePrimaryActionCount(actions);
  const retryActionCount = getWorkspaceGuidanceRetryActionCount(actions);

  return {
    actionCount: actions.length,
    primaryActionCount,
    retryActionCount,
    labels,
    summaryLabel: getWorkspaceRecoveryActionSummaryLabel(labels),
  };
}

export function getWorkspaceGuidanceActionKey(action: GuidanceAction) {
  const conversationStage = getWorkspaceGuidanceActionConversationStage(action);
  const navigationPath = getWorkspaceGuidanceActionNavigationPath(action);
  const navigationLineNumber = getWorkspaceGuidanceActionNavigationLineNumber(action);
  return [
    action.kind,
    action.label,
    conversationStage,
    navigationPath,
    navigationLineNumber,
  ].join(':');
}

function materializeWorkspaceGuidanceActionViewModels(
  actions: GuidanceAction[],
): WorkspaceGuidanceActionViewModelList {
  const viewModels: WorkspaceGuidanceActionViewModelList = [];

  for (const action of actions) {
    const tone = getWorkspaceGuidanceActionTone(action);
    viewModels.push({
      action,
      key: getWorkspaceGuidanceActionKey(action),
      tone,
      className: getWorkspaceGuidanceActionClassName(tone),
    });
  }

  return viewModels;
}

export function deriveWorkspaceGuidanceActionViewModels(
  message: GuidanceMessageLike,
): WorkspaceGuidanceActionViewModelList {
  const actions = sortWorkspaceGuidanceActions(deriveWorkspaceGuidanceActions(message));
  return materializeWorkspaceGuidanceActionViewModels(actions);
}

function getWorkspaceGuidancePrimaryViewModelCount(viewModels: WorkspaceGuidanceActionViewModelList): number {
  let primaryActionCount = 0;

  for (const viewModel of viewModels) {
    if (viewModel.tone === 'primary') {
      primaryActionCount += 1;
    }
  }

  return primaryActionCount;
}

function getWorkspaceGuidanceRetryViewModelCount(viewModels: WorkspaceGuidanceActionViewModelList): number {
  let retryActionCount = 0;

  for (const viewModel of viewModels) {
    const isRetryAction = viewModel.action.kind.startsWith('retry_');
    if (isRetryAction === true) {
      retryActionCount += 1;
    }
  }

  return retryActionCount;
}

function shouldUseWorkspaceGuidanceRecoveryHighlight(snapshot: WorkspaceGuidanceSnapshot): boolean {
  const hasRecoveryFallback = snapshot.status === 'recovery_fallback';
  if (hasRecoveryFallback === true) {
    return true;
  }

  const hasRetryActions = snapshot.retryActionCount > 0;
  return hasRetryActions === true;
}

function getWorkspaceGuidanceSnapshotClassName(snapshot: WorkspaceGuidanceSnapshot) {
  const shouldUseRecoveryHighlight = shouldUseWorkspaceGuidanceRecoveryHighlight(snapshot);
  if (shouldUseRecoveryHighlight === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.primaryActionCount > 0) {
    return 'border-primary/20 bg-primary/5 text-primary';
  }
  if (snapshot.status === 'questions_only') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function shouldRenderWorkspaceGuidanceContent({
  hasSuggestedQuestions,
  hasActions,
}: {
  hasSuggestedQuestions: boolean;
  hasActions: boolean;
}): boolean {
  if (hasSuggestedQuestions === true) {
    return true;
  }

  return hasActions === true;
}

function materializeWorkspaceGuidanceQuestionNodes({
  suggestedQuestions,
  onAskQuestion,
}: {
  suggestedQuestions: WorkspaceSuggestedQuestionList;
  onAskQuestion: WorkspaceGuidanceQuestionHandler;
}): WorkspaceGuidanceQuestionNodeList {
  const nodes: WorkspaceGuidanceQuestionNodeList = [];

  for (const question of suggestedQuestions) {
    nodes.push(
      <button
        key={question}
        type="button"
        onClick={() => onAskQuestion(question)}
        className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        {question}
      </button>,
    );
  }

  return nodes;
}

function materializeWorkspaceGuidanceActionNodes({
  suggestedActionViewModels,
  onRunAction,
}: {
  suggestedActionViewModels: WorkspaceGuidanceActionViewModelList;
  onRunAction: WorkspaceGuidanceActionHandler;
}): WorkspaceGuidanceActionNodeList {
  const nodes: WorkspaceGuidanceActionNodeList = [];

  for (const viewModel of suggestedActionViewModels) {
    nodes.push(
      <button
        key={viewModel.key}
        type="button"
        onClick={() => onRunAction(viewModel.action)}
        className={viewModel.className}
      >
        {viewModel.action.label}
      </button>,
    );
  }

  return nodes;
}

export function WorkspaceGuidanceActions({
  message,
  onAskQuestion,
  onRunAction,
}: {
  message: GuidanceMessageLike;
  onAskQuestion: (question: string) => void;
  onRunAction: (action: GuidanceAction) => void;
}) {
  const suggestedQuestions = getWorkspaceGuidanceSuggestedQuestions(message);
  const hasSuggestedQuestions = suggestedQuestions.length > 0;
  const suggestedActionViewModels = deriveWorkspaceGuidanceActionViewModels(message);
  const actionCount = suggestedActionViewModels.length;
  const hasActions = actionCount > 0;
  const primaryActionCount = getWorkspaceGuidancePrimaryViewModelCount(suggestedActionViewModels);
  const retryActionCount = getWorkspaceGuidanceRetryViewModelCount(suggestedActionViewModels);
  const explicitSuggestedActions = getWorkspaceGuidanceSuggestedActions(message);
  const hasExplicitSuggestedActions = explicitSuggestedActions.length > 0;
  const recovery = getWorkspaceGuidanceRecoveryState(message);
  const hasRecoveryRetry = hasWorkspaceGuidanceRecoveryRetry(recovery);
  const guidanceSnapshot = buildWorkspaceGuidanceSnapshot({
    questionCount: suggestedQuestions.length,
    actionCount,
    primaryActionCount,
    retryActionCount,
    hasExplicitSuggestedActions,
    hasRecoveryRetry,
  });
  const shouldRenderGuidanceContent = shouldRenderWorkspaceGuidanceContent({
    hasSuggestedQuestions,
    hasActions,
  });

  if (shouldRenderGuidanceContent === false) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div
        role="status"
        aria-live="polite"
        data-testid="workspace-guidance-snapshot"
        className={cn('rounded-lg border px-3 py-2 text-xs', getWorkspaceGuidanceSnapshotClassName(guidanceSnapshot))}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">建议动作状态</span>
          <span>Phase: {guidanceSnapshot.status}</span>
          <span>Source: {guidanceSnapshot.source}</span>
          <span>Questions: {guidanceSnapshot.questionCount}</span>
          <span>Actions: {guidanceSnapshot.actionCount}</span>
          <span>Primary: {guidanceSnapshot.primaryActionCount}</span>
          <span>Retry: {guidanceSnapshot.retryActionCount}</span>
        </div>
        <p className="mt-1">{guidanceSnapshot.message}</p>
        <p className="mt-1 opacity-80">恢复建议：{guidanceSnapshot.recovery}</p>
      </div>
      {hasSuggestedQuestions === true && (
        <div className="flex flex-wrap gap-2">
          {materializeWorkspaceGuidanceQuestionNodes({
            suggestedQuestions,
            onAskQuestion,
          })}
        </div>
      )}
      {hasActions === true && (
        <div className="flex flex-wrap gap-2">
          {materializeWorkspaceGuidanceActionNodes({
            suggestedActionViewModels,
            onRunAction,
          })}
        </div>
      )}
    </div>
  );
}
