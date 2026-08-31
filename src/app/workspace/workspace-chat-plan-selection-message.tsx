'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Bot } from 'lucide-react';

import { MarkdownContent } from '@/components/workspace/chat-message-content';
import { Badge } from '@/components/ui/badge';
import { getPlanFeatureSummary } from '@/lib/plan-features';
import { getTechStackLabels, getTechStackProfile } from '@/lib/tech-stack';
import { cn } from '@/lib/utils';
import type { Plan } from '@/lib/api';

import { MessageGuidance } from './workspace-chat-message-guidance';
import { PlanThoughtProcess } from './workspace-chat-plan-thought-process';
import { buildPlanSelectionSnapshot } from './workspace-chat-plan-snapshot';
import { getWorkspaceRecommendedPlanId } from './workspace-plan-message-helpers';
import type { GuidanceAction, PlanSelectionSnapshot, WorkspaceChatMessage } from './workspace-types';

type PlanSelectionMessagePlanList = Plan[];
type PlanSelectionMessagePlanNodeList = ReactNode[];
type PlanSelectionMessageTechStackLabelList = string[];
type PlanSelectionMessageTechStackLabelNodeList = ReactNode[];
type PlanSelectionMessagePlanSelectAction = (plan: Plan) => void;

function getPlanSelectionMessagePlans(message: WorkspaceChatMessage): PlanSelectionMessagePlanList {
  if (Array.isArray(message.plans) === false) {
    return [];
  }

  return message.plans;
}

function formatPlanSelectionSnapshotTitle(snapshot: PlanSelectionSnapshot) {
  switch (snapshot.status) {
    case 'streaming':
      return '方案仍在生成';
    case 'waiting_for_selection':
      return '等待确认方案';
    case 'selected':
      return '方案已确认';
    case 'superseded':
      return '方案已被新需求替代';
    case 'busy_blocked':
      return '方案选择暂被生成流程阻断';
    case 'empty_plans':
      return '没有可选择方案';
    default:
      return '方案选择状态待确认';
  }
}

function getPlanSelectionSnapshotClassName(snapshot: PlanSelectionSnapshot) {
  if (snapshot.status === 'empty_plans') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (hasPlanSelectionSnapshotAttentionStatus(snapshot) === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'selected') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  if (snapshot.status === 'superseded') {
    return 'border-border bg-muted/50 text-muted-foreground';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function hasPlanSelectionSnapshotAttentionStatus(snapshot: PlanSelectionSnapshot): boolean {
  if (snapshot.status === 'streaming') {
    return true;
  }

  if (snapshot.status === 'waiting_for_selection') {
    return true;
  }

  return snapshot.status === 'busy_blocked';
}

function hasPlanSelectionSnapshotTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getPlanSelectionSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasPlanSelectionSnapshotTextValue(value);

  return hasValue === true ? value : fallback;
}

function getPlanSelectionSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function hasPlanSelectionMessageSelectedPlan(selectedPlanId: string | null): boolean {
  return selectedPlanId !== null;
}

function isPlanSelectionMessageStreamComplete({
  isPlanSuperseded,
  planStreamComplete,
  selectionReady,
}: {
  isPlanSuperseded: boolean;
  planStreamComplete: boolean | undefined;
  selectionReady: boolean;
}): boolean {
  if (isPlanSuperseded === true) {
    return true;
  }

  const hasPlanStreamComplete = planStreamComplete === true;
  if (hasPlanStreamComplete === false) {
    return false;
  }

  return selectionReady === true;
}

function isPlanSelectionMessageSelectable({
  isPlanSuperseded,
  isStreamComplete,
  isBusy,
  hasSelectedPlan,
}: {
  isPlanSuperseded: boolean;
  isStreamComplete: boolean;
  isBusy: boolean;
  hasSelectedPlan: boolean;
}): boolean {
  if (isPlanSuperseded === true) {
    return false;
  }

  if (isStreamComplete === false) {
    return false;
  }

  if (isBusy === true) {
    return false;
  }

  return hasSelectedPlan === false;
}

function getPlanSelectionMessageTechStackProfile(plan: Plan): string {
  const profile = getTechStackProfile(plan.tech_stack);
  const hasProfile = hasPlanSelectionSnapshotTextValue(profile);
  if (hasProfile === true) {
    return profile;
  }

  return '运行配置待确定';
}

function shouldRenderPlanSelectionMessageRecommendedBadge(isRecommended: boolean): boolean {
  return isRecommended === true;
}

function shouldRenderPlanSelectionMessageSelectedBadge(isSelected: boolean): boolean {
  return isSelected === true;
}

function shouldRenderPlanSelectionMessageReasoning(plan: Plan): boolean {
  return hasPlanSelectionSnapshotTextValue(plan.reasoning);
}

function shouldRenderPlanSelectionMessageSupersededNotice(isPlanSuperseded: boolean): boolean {
  return isPlanSuperseded === true;
}

function shouldRenderPlanSelectionMessageWaitingNotice({
  isPlanSuperseded,
  hasSelectedPlan,
  isStreamComplete,
}: {
  isPlanSuperseded: boolean;
  hasSelectedPlan: boolean;
  isStreamComplete: boolean;
}): boolean {
  return false;
}

function shouldRenderPlanSelectionMessageGuidance(isPlanSuperseded: boolean): boolean {
  return isPlanSuperseded === false;
}

function getPlanSelectionMessageCountdownSeconds(planCountdown: number): number {
  if (Number.isFinite(planCountdown) === false) {
    return 0;
  }

  if (planCountdown <= 0) {
    return 0;
  }

  return Math.ceil(planCountdown);
}

function getPlanSelectionMessagePlanName(
  plans: PlanSelectionMessagePlanList,
  planId: string | null,
  fallback: string,
): string {
  if (planId === null) {
    return fallback;
  }

  for (const plan of plans) {
    if (plan.id === planId) {
      return plan.name;
    }
  }

  return fallback;
}

function shouldRenderPlanSelectionCountdownNotice({
  isPlanSuperseded,
  hasSelectedPlan,
  isStreamComplete,
  countdownSeconds,
}: {
  isPlanSuperseded: boolean;
  hasSelectedPlan: boolean;
  isStreamComplete: boolean;
  countdownSeconds: number;
}): boolean {
  if (isPlanSuperseded === true) {
    return false;
  }

  if (hasSelectedPlan === true) {
    return false;
  }

  if (isStreamComplete === false) {
    return false;
  }

  return countdownSeconds > 0;
}

function shouldRenderPlanSelectionAutoConfirmingNotice({
  isPlanSuperseded,
  hasSelectedPlan,
  isStreamComplete,
  countdownSeconds,
}: {
  isPlanSuperseded: boolean;
  hasSelectedPlan: boolean;
  isStreamComplete: boolean;
  countdownSeconds: number;
}): boolean {
  if (isPlanSuperseded === true) {
    return false;
  }

  if (hasSelectedPlan === true) {
    return false;
  }

  if (isStreamComplete === false) {
    return false;
  }

  return countdownSeconds <= 0;
}

function shouldRenderPlanSelectionSelectedNotice({
  isPlanSuperseded,
  hasSelectedPlan,
}: {
  isPlanSuperseded: boolean;
  hasSelectedPlan: boolean;
}): boolean {
  return false;
}

function getPlanSelectionMessageSelectedCardClassName(isSelected: boolean): string | undefined {
  if (isSelected === true) {
    return 'border-primary bg-background';
  }

  return undefined;
}

function getPlanSelectionMessageDisabledCardClassName({
  isSelectable,
  isSelected,
}: {
  isSelectable: boolean;
  isSelected: boolean;
}): string | undefined {
  if (isSelectable === true) {
    return undefined;
  }

  if (isSelected === true) {
    return undefined;
  }

  return 'opacity-80';
}

function materializePlanSelectionMessageTechStackLabelNodes(
  techStackLabels: PlanSelectionMessageTechStackLabelList,
): PlanSelectionMessageTechStackLabelNodeList {
  const nodes: PlanSelectionMessageTechStackLabelNodeList = [];

  for (const tech of techStackLabels) {
    nodes.push(
      <Badge key={tech} variant="outline" className="text-[10px]">{tech}</Badge>,
    );
  }

  return nodes;
}

function materializePlanSelectionMessagePlanNodes({
  plans,
  selectedPlanId,
  effectiveRecommendedPlanId,
  isSelectable,
  onSelectPlan,
}: {
  plans: PlanSelectionMessagePlanList;
  selectedPlanId: string | null;
  effectiveRecommendedPlanId: string | null;
  isSelectable: boolean;
  onSelectPlan: PlanSelectionMessagePlanSelectAction;
}): PlanSelectionMessagePlanNodeList {
  const nodes: PlanSelectionMessagePlanNodeList = [];

  for (const plan of plans) {
    const isSelected = selectedPlanId === plan.id;
    const isRecommended = effectiveRecommendedPlanId === plan.id;
    const shouldRenderRecommendedBadge = shouldRenderPlanSelectionMessageRecommendedBadge(isRecommended);
    const shouldRenderSelectedBadge = shouldRenderPlanSelectionMessageSelectedBadge(isSelected);
    const shouldRenderReasoning = shouldRenderPlanSelectionMessageReasoning(plan);
    const selectedCardClassName = getPlanSelectionMessageSelectedCardClassName(isSelected);
    const disabledCardClassName = getPlanSelectionMessageDisabledCardClassName({
      isSelectable,
      isSelected,
    });
    const techStackLabels = getTechStackLabels(plan.tech_stack);
    const featureSummary = getPlanFeatureSummary(plan);

    nodes.push(
      <button
        key={plan.id}
        type="button"
        onClick={() => onSelectPlan(plan)}
        disabled={isSelectable === false}
        className={cn(
          'w-full rounded-lg border p-3 text-left transition-colors',
          'hover:border-primary/60 hover:bg-background/80',
          selectedCardClassName,
          disabledCardClassName,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{plan.name}</span>
              {shouldRenderRecommendedBadge === true && <Badge variant="secondary" className="text-[10px]">推荐</Badge>}
              {shouldRenderSelectedBadge === true && <Badge className="text-[10px]">已选择</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {getPlanSelectionMessageTechStackProfile(plan)}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {materializePlanSelectionMessageTechStackLabelNodes(techStackLabels)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          核心功能：{featureSummary}
        </p>
        {shouldRenderReasoning === true && (
          <p className="mt-1 text-xs text-muted-foreground">
            推荐理由：{plan.reasoning}
          </p>
        )}
      </button>,
    );
  }

  return nodes;
}

export function PlanSelectionMessage({
  message,
  planCountdown,
  selectionReady,
  selectedPlanId,
  isBusy,
  onSelectPlan,
  onAskQuestion,
  onRunAction,
}: {
  message: WorkspaceChatMessage;
  planCountdown: number;
  selectionReady: boolean;
  selectedPlanId: string | null;
  isBusy: boolean;
  onSelectPlan: (plan: Plan) => void;
  onAskQuestion: (question: string) => void;
  onRunAction: (action: GuidanceAction) => void;
}) {
  const plans = getPlanSelectionMessagePlans(message);
  const isPlanSuperseded = message.planSuperseded === true;
  const hasSelectedPlan = hasPlanSelectionMessageSelectedPlan(selectedPlanId);
  const isStreamComplete = isPlanSelectionMessageStreamComplete({
    isPlanSuperseded,
    planStreamComplete: message.planStreamComplete,
    selectionReady,
  });
  const isSelectable = isPlanSelectionMessageSelectable({
    isPlanSuperseded,
    isStreamComplete,
    isBusy,
    hasSelectedPlan,
  });
  const effectiveRecommendedPlanId = getWorkspaceRecommendedPlanId(plans, message.recommendedPlanId);
  const planSelectionSnapshot = buildPlanSelectionSnapshot({
    timestamp: message.timestamp,
    planSuperseded: message.planSuperseded,
    planCount: plans.length,
    isStreamComplete,
    isSelectable,
    selectedPlanId,
    isBusy,
    recommendedPlanId: effectiveRecommendedPlanId,
  });
  const recommendedPlanLabel = getPlanSelectionSnapshotLabel(planSelectionSnapshot.recommendedPlanId, 'none');
  const selectedPlanLabel = getPlanSelectionSnapshotLabel(planSelectionSnapshot.selectedPlanId, 'none');
  const recommendedPlanName = getPlanSelectionMessagePlanName(plans, effectiveRecommendedPlanId, recommendedPlanLabel);
  const selectedPlanName = getPlanSelectionMessagePlanName(plans, selectedPlanId, selectedPlanLabel);
  const countdownSeconds = getPlanSelectionMessageCountdownSeconds(planCountdown);
  const canSelectLabel = getPlanSelectionSnapshotBooleanLabel(planSelectionSnapshot.canSelect);
  const contentValue = message.content;
  const hasContent = hasPlanSelectionSnapshotTextValue(contentValue);
  const shouldRenderSupersededNotice = shouldRenderPlanSelectionMessageSupersededNotice(isPlanSuperseded);
  const shouldRenderWaitingNotice = shouldRenderPlanSelectionMessageWaitingNotice({
    isPlanSuperseded,
    hasSelectedPlan,
    isStreamComplete,
  });
  const shouldRenderCountdownNotice = shouldRenderPlanSelectionCountdownNotice({
    isPlanSuperseded,
    hasSelectedPlan,
    isStreamComplete,
    countdownSeconds,
  });
  const shouldRenderAutoConfirmingNotice = shouldRenderPlanSelectionAutoConfirmingNotice({
    isPlanSuperseded,
    hasSelectedPlan,
    isStreamComplete,
    countdownSeconds,
  });
  const shouldRenderSelectedNotice = shouldRenderPlanSelectionSelectedNotice({
    isPlanSuperseded,
    hasSelectedPlan,
  });
  const shouldRenderGuidance = shouldRenderPlanSelectionMessageGuidance(isPlanSuperseded);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="h-3.5 w-3.5" />
        <span>YiStack 回复</span>
      </div>
      <PlanThoughtProcess
        content={message.reasoningContent}
        streaming={message.streaming}
      />
      {hasContent === true && (
        <div className="rounded-lg border bg-background/70 px-3 py-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">最终回答</div>
          <MarkdownContent content={contentValue} />
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        data-testid="workspace-plan-selection-snapshot"
        className={cn('rounded-lg border px-3 py-2 text-xs', getPlanSelectionSnapshotClassName(planSelectionSnapshot))}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{formatPlanSelectionSnapshotTitle(planSelectionSnapshot)}</span>
          <span>Phase: {planSelectionSnapshot.status}</span>
          <span>Source: {planSelectionSnapshot.source}</span>
          <span>Plans: {planSelectionSnapshot.planCount}</span>
          <span>Recommended: {recommendedPlanLabel}</span>
          <span>Selected: {selectedPlanLabel}</span>
          <span>CanSelect: {canSelectLabel}</span>
        </div>
        <p className="mt-1">{planSelectionSnapshot.message}</p>
        <p className="mt-1 opacity-80">恢复建议：{planSelectionSnapshot.recovery}</p>
      </div>
      <div className="space-y-2">
        {materializePlanSelectionMessagePlanNodes({
          plans,
          selectedPlanId,
          effectiveRecommendedPlanId,
          isSelectable,
          onSelectPlan,
        })}
      </div>
      {shouldRenderCountdownNotice === true && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-300">
          <p className="text-sm font-medium">将在 {countdownSeconds} 秒后自动确认推荐方案「{recommendedPlanName}」</p>
          <p className="mt-1 text-xs text-muted-foreground">你可以在倒计时结束前手动选择其他方案，或继续补充约束后重新规划。</p>
        </div>
      )}
      {shouldRenderAutoConfirmingNotice === true && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-300">
          <p className="text-sm font-medium">正在确认推荐方案「{recommendedPlanName}」</p>
          <p className="mt-1 text-xs text-muted-foreground">确认完成后会进入代码生成流程。</p>
        </div>
      )}
      {shouldRenderSelectedNotice === true && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-emerald-700 dark:text-emerald-300">
          <p className="text-sm font-medium">已选择「{selectedPlanName}」方案</p>
          <p className="mt-1 text-xs text-muted-foreground">YiStack 将按该方案继续执行后续生成流程。</p>
        </div>
      )}
      {shouldRenderSupersededNotice === true && (
        <div className="rounded-xl border border-muted bg-muted/40 px-4 py-3 text-muted-foreground">
          <p className="text-sm font-medium">这轮方案已失效</p>
          <p className="mt-1 text-xs">你后续补充了新需求，系统已基于新的约束重新规划；本组方案仅保留作历史参考，不能再被选择。</p>
        </div>
      )}
      {shouldRenderWaitingNotice === true && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-muted-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">等待你确认技术方案</p>
              <p className="mt-1 text-xs">你可以先确认当前方案，或继续补充约束后重新规划。</p>
            </div>
          </div>
        </div>
      )}
      {shouldRenderGuidance === true && (
        <MessageGuidance
          message={message}
          onAskQuestion={onAskQuestion}
          onRunAction={onRunAction}
        />
      )}
    </div>
  );
}
