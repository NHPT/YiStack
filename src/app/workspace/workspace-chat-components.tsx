'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Circle,
  Cpu,
  Globe,
  ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  Square,
  Upload,
  Wifi,
  X,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  WorkspaceBootstrapState,
  WorkspaceEngineeringStateSnapshot,
  WorkspaceExecutionState,
  WorkspacePhaseState,
  WorkspacePhaseStatus,
  WorkspacePlanSelectionState,
  WorkspaceRecoveryState,
  WorkspaceRuntimeState,
  WorkspaceValidationState,
  WorkspaceWorkflowState,
} from '@/lib/workspace/engineering-state';
import {
  formatWorkspaceApprovalBoundary,
  formatWorkspaceExecutionPauseReason,
  formatWorkspaceWorkflowStage,
  getWorkspaceWorkflowStageApprovalBoundary,
  getWorkspaceWorkflowStageAutoProgressEnabled,
} from '@/lib/workspace/workflow-contract';
import type {
  ChatAttachmentSnapshot,
  ChatInputSnapshot,
  ChatMode,
  ChatModeSnapshot,
  ChatModelRegistrySnapshot,
  ChatScrollSnapshot,
} from './workspace-types';

import { WorkspaceChatMessages } from './workspace-chat-message-components';
import type {
  WorkspaceChatAttachment,
  WorkspaceChatComposerProps,
  WorkspaceChatMessagesProps,
  WorkspaceChatPanelProps,
} from './workspace-chat-panel-types';
import {
  AttachmentRemovalConfirmationSnapshotStrip,
  buildAttachmentRemovalConfirmationSnapshot,
} from './workspace-attachment-removal-confirmation-snapshot';
import { StopGenerationConfirmationSnapshotStrip } from './workspace-stop-generation-confirmation-snapshot';
import {
  WorkspaceChatStateSummaryDisclosure,
  resolveWorkspaceChatStateSummaryRules,
} from './workspace-chat-state-summary';

type WorkspaceChatComposerAttachmentNodeList = ReactNode[];
type WorkspaceChatComposerAttachmentRemovalRequest = (index: number) => void;
type WorkspaceChatComposerModelNodeList = ReactNode[];
type WorkspaceChatComposerModelSetter = (modelId: string) => void;
type WorkspaceChatComposerProviderOption = {
  id: string;
  name: string;
};
type WorkspaceChatComposerProviderOptionList = WorkspaceChatComposerProviderOption[];
type WorkspaceChatPhaseItemNodeList = ReactNode[];
type WorkspaceUserFlowStepStatus = 'completed' | 'active' | 'pending' | 'paused' | 'blocked';
type WorkspaceUserFlowStep = {
  id: string;
  label: string;
  status: WorkspaceUserFlowStepStatus;
  detail: string;
};
type WorkspaceUserFlowStepList = WorkspaceUserFlowStep[];
type WorkspaceUserFlowStepNodeList = ReactNode[];

function appendWorkspaceUserFlowStep(
  steps: WorkspaceUserFlowStepList,
  step: WorkspaceUserFlowStep,
): void {
  steps.push(step);
}

function hasWorkspaceUserFlowStep(steps: WorkspaceUserFlowStepList): boolean {
  return steps.length > 0;
}

function getWorkspaceUserFlowStatusFromEngineeringStatus(
  status: string | undefined,
): WorkspaceUserFlowStepStatus {
  if (status === 'failed') {
    return 'blocked';
  }
  if (status === 'passed') {
    return 'completed';
  }
  if (status === 'ready' || status === 'completed' || status === 'success') {
    return 'completed';
  }
  if (status === 'running' || status === 'pending') {
    return 'active';
  }
  return 'active';
}

function getWorkspaceUserFlowWorkflowStatus(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): string | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  if (engineeringState.workflow === undefined) {
    return undefined;
  }

  return engineeringState.workflow.status;
}

function getWorkspaceUserFlowWorkflowStage(
  workflow: WorkspaceWorkflowState | undefined,
): string {
  if (workflow === undefined) {
    return '';
  }

  return getWorkspaceUserFlowOptionalText(workflow.stage);
}

function getWorkspaceUserFlowOptionalText(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }
  return value.trim();
}

function getWorkspaceUserFlowPlanSelectionAvailablePlanIds(
  planSelection: WorkspacePlanSelectionState | undefined,
): string[] | undefined {
  if (planSelection === undefined) {
    return undefined;
  }
  return planSelection.available_plan_ids;
}

function getWorkspaceUserFlowPlanSelectionStatus(
  planSelection: WorkspacePlanSelectionState | undefined,
): string | undefined {
  if (planSelection === undefined) {
    return undefined;
  }
  return planSelection.status;
}

function getWorkspaceUserFlowExecutionApprovedPlanName(
  execution: WorkspaceExecutionState | undefined,
): string {
  if (execution === undefined) {
    return '';
  }
  return getWorkspaceUserFlowOptionalText(execution.approved_plan_name);
}

function getWorkspaceUserFlowExecutionPauseReason(
  execution: WorkspaceExecutionState | undefined,
): string {
  if (execution === undefined) {
    return '';
  }
  return getWorkspaceUserFlowOptionalText(execution.pause_reason);
}

function isWorkspaceUserFlowExecutionAwaitingConfirmation(
  execution: WorkspaceExecutionState | undefined,
): boolean {
  if (execution === undefined) {
    return false;
  }
  return execution.awaiting_confirmation === true;
}

function getWorkspaceUserFlowPhaseCurrentPhase(
  phase: WorkspacePhaseState | undefined,
): string {
  if (phase === undefined) {
    return '';
  }
  return getWorkspaceUserFlowOptionalText(phase.current_phase);
}

function getWorkspaceUserFlowPhaseCurrentTask(
  phase: WorkspacePhaseState | undefined,
): string {
  if (phase === undefined) {
    return '';
  }
  return getWorkspaceUserFlowOptionalText(phase.current_task);
}

function getWorkspaceUserFlowPhaseStatus(
  phase: WorkspacePhaseState | undefined,
): string | undefined {
  if (phase === undefined) {
    return undefined;
  }
  return phase.status;
}

function getWorkspaceUserFlowBootstrapStatus(
  bootstrapState: WorkspaceBootstrapState | undefined,
  hasDownstreamProgress: boolean,
): WorkspaceUserFlowStepStatus {
  if (bootstrapState === undefined) {
    if (hasDownstreamProgress === true) {
      return 'completed';
    }
    return 'active';
  }

  const gateDecision = bootstrapState.gate_result?.decision;
  if (gateDecision === 'block' || (bootstrapState.blockers !== undefined && bootstrapState.blockers.length > 0)) {
    return 'blocked';
  }
  if (bootstrapState.status === 'completed' || gateDecision === 'allow' || gateDecision === 'warn') {
    return 'completed';
  }
  return 'active';
}

function appendWorkspaceUserFlowFoundationStep(
  steps: WorkspaceUserFlowStepList,
  bootstrapState: WorkspaceBootstrapState | undefined,
  hasDownstreamProgress: boolean,
): void {
  const status = getWorkspaceUserFlowBootstrapStatus(bootstrapState, hasDownstreamProgress);
  appendWorkspaceUserFlowStep(steps, {
    id: 'foundation',
    label: 'Foundation 前置设计',
    status,
    detail: status === 'completed'
      ? 'Foundation 决策与生成前事实已准备'
      : status === 'blocked'
        ? 'Foundation Gate 存在阻断项'
        : '正在整理需求、约束、技术栈与生成前决策',
  });
}

function appendWorkspaceUserFlowPlanGenerationStep({
  steps,
  workflow,
  planSelection,
  planSelectionReady,
  selectedPlanId,
  isPlanning,
}: {
  steps: WorkspaceUserFlowStepList;
  workflow: WorkspaceWorkflowState | undefined;
  planSelection: WorkspacePlanSelectionState | undefined;
  planSelectionReady: boolean;
  selectedPlanId: string | null;
  isPlanning: boolean;
}): void {
  const workflowStage = getWorkspaceUserFlowWorkflowStage(workflow);
  const hasPlanGenerationWorkflow = workflowStage === 'plan-analysis';
  const hasPlanSelectionProgress = hasWorkspaceUserFlowPlanSelectionProgress({
    planSelection,
    planSelectionReady,
    selectedPlanId,
  });
  const shouldRender = isPlanning === true || hasPlanGenerationWorkflow === true || hasPlanSelectionProgress === true;
  if (shouldRender === false) {
    return;
  }

  const status = hasPlanGenerationWorkflow === true
    ? getWorkspaceUserFlowStatusFromEngineeringStatus(workflow?.status)
    : hasPlanSelectionProgress === true
      ? 'completed'
      : 'active';

  appendWorkspaceUserFlowStep(steps, {
    id: 'plan-generation',
    label: '方案生成',
    status,
    detail: status === 'blocked'
      ? '技术方案生成失败，可重试或切换模型后重新生成'
      : status === 'completed'
        ? '候选技术方案已生成'
        : '正在生成候选技术方案',
  });
}

function hasWorkspaceUserFlowPlanSelectionProgress({
  planSelection,
  planSelectionReady,
  selectedPlanId,
}: {
  planSelection: WorkspacePlanSelectionState | undefined;
  planSelectionReady: boolean;
  selectedPlanId: string | null;
}): boolean {
  if (hasWorkspaceUserFlowSelectedPlan(selectedPlanId) === true) {
    return true;
  }

  if (planSelectionReady === true) {
    return true;
  }

  if (planSelection !== undefined) {
    return true;
  }

  return false;
}

function hasWorkspaceUserFlowDownstreamProgress({
  planSelection,
  planSelectionReady,
  selectedPlanId,
  execution,
  phase,
  validation,
  runtime,
  recovery,
  isGenerating,
}: {
  planSelection: WorkspacePlanSelectionState | undefined;
  planSelectionReady: boolean;
  selectedPlanId: string | null;
  execution: WorkspaceExecutionState | undefined;
  phase: WorkspacePhaseState | undefined;
  validation: WorkspaceValidationState | undefined;
  runtime: WorkspaceRuntimeState | undefined;
  recovery: WorkspaceRecoveryState | undefined;
  isGenerating: boolean;
}): boolean {
  if (hasWorkspaceUserFlowPlanSelectionProgress({ planSelection, planSelectionReady, selectedPlanId }) === true) {
    return true;
  }

  if (execution !== undefined) {
    return true;
  }

  if (phase !== undefined || validation !== undefined || runtime !== undefined || recovery !== undefined) {
    return true;
  }

  return isGenerating === true;
}

function normalizeWorkspaceUserFlowSteps(steps: WorkspaceUserFlowStepList): WorkspaceUserFlowStepList {
  const normalizedSteps: WorkspaceUserFlowStepList = [];
  let hasCurrentStep = false;

  for (const step of steps) {
    if (step.status === 'pending') {
      continue;
    }

    appendWorkspaceUserFlowStep(normalizedSteps, step);

    if (step.status !== 'completed') {
      hasCurrentStep = true;
    }

    if (hasCurrentStep === true) {
      break;
    }
  }

  return normalizedSteps;
}

function appendWorkspaceUserFlowPlanSelectionStep({
  steps,
  planSelection,
  planSelectionReady,
  selectedPlanId,
  selectedPlanName,
}: {
  steps: WorkspaceUserFlowStepList;
  planSelection: WorkspacePlanSelectionState | undefined;
  planSelectionReady: boolean;
  selectedPlanId: string | null;
  selectedPlanName: string;
}): void {
  const hasSelectedPlan = hasWorkspaceUserFlowSelectedPlan(selectedPlanId);
  const availablePlanIds = getWorkspaceUserFlowPlanSelectionAvailablePlanIds(planSelection);
  const hasAvailablePlans = Array.isArray(availablePlanIds) === true && availablePlanIds.length > 0;
  const shouldRender = hasSelectedPlan === true || planSelectionReady === true || hasAvailablePlans === true || planSelection !== undefined;
  if (shouldRender === false) {
    return;
  }

  const status: WorkspaceUserFlowStepStatus = hasSelectedPlan === true
    ? 'completed'
    : planSelectionReady === true || hasAvailablePlans === true
      ? 'active'
      : getWorkspaceUserFlowStatusFromEngineeringStatus(getWorkspaceUserFlowPlanSelectionStatus(planSelection));
  const label = hasSelectedPlan === true && hasWorkspaceChatEngineeringTextValue(selectedPlanName)
    ? `已选择「${selectedPlanName}」`
    : hasSelectedPlan === true
      ? '已选择方案'
      : '方案选择';
  appendWorkspaceUserFlowStep(steps, {
    id: 'plan-selection',
    label,
    status,
    detail: status === 'completed' ? '方案已选择' : '等待确认推荐方案或候选方案',
  });
}

function appendWorkspaceUserFlowPlanExecutionStep({
  steps,
  selectedPlanName,
  selectedPlanId,
  execution,
}: {
  steps: WorkspaceUserFlowStepList;
  selectedPlanName: string;
  selectedPlanId: string | null;
  execution: WorkspaceExecutionState | undefined;
}): void {
  const approvedPlanName = getWorkspaceUserFlowExecutionApprovedPlanName(execution);
  const pauseReason = getWorkspaceUserFlowExecutionPauseReason(execution);
  const planName = hasWorkspaceChatEngineeringTextValue(approvedPlanName) ? approvedPlanName : selectedPlanName;
  const hasPlan = hasWorkspaceChatEngineeringTextValue(planName) || hasWorkspaceUserFlowSelectedPlan(selectedPlanId);
  const hasExecution = execution !== undefined;
  if (hasPlan === false && hasExecution === false) {
    return;
  }

  const isAwaitingConfirmation = isWorkspaceUserFlowExecutionAwaitingConfirmation(execution);
  const hasPauseReason = hasWorkspaceChatEngineeringTextValue(pauseReason);
  appendWorkspaceUserFlowStep(steps, {
    id: 'plan-execution',
    label: '开始按方案执行',
    status: hasPauseReason === true || isAwaitingConfirmation === true ? 'paused' : 'completed',
    detail: hasPauseReason === true
      ? `执行暂停：${pauseReason}`
      : isAwaitingConfirmation === true
        ? '等待确认后继续执行'
        : '已进入当前方案执行范围',
  });
}

function appendWorkspaceUserFlowPhaseStep({
  steps,
  phase,
  isGenerating,
}: {
  steps: WorkspaceUserFlowStepList;
  phase: WorkspacePhaseState | undefined;
  isGenerating: boolean;
}): void {
  if (phase === undefined && isGenerating === false) {
    return;
  }

  const phaseCurrentPhase = getWorkspaceUserFlowPhaseCurrentPhase(phase);
  if (isGenerating === false && phaseCurrentPhase === '已批准方案') {
    return;
  }

  const phaseCurrentTask = getWorkspaceUserFlowPhaseCurrentTask(phase);
  const phaseLabel = hasWorkspaceChatEngineeringTextValue(phaseCurrentPhase) ? phaseCurrentPhase : '代码生成';
  const currentTask = hasWorkspaceChatEngineeringTextValue(phaseCurrentTask) ? phaseCurrentTask : '正在生成或应用代码';
  const status = isGenerating === true
    ? 'active'
    : getWorkspaceUserFlowStatusFromEngineeringStatus(getWorkspaceUserFlowPhaseStatus(phase));

  appendWorkspaceUserFlowStep(steps, {
    id: 'phase',
    label: phaseLabel,
    status,
    detail: currentTask,
  });
}

function appendWorkspaceUserFlowValidationStep(
  steps: WorkspaceUserFlowStepList,
  validation: WorkspaceValidationState | undefined,
): void {
  if (validation === undefined) {
    return;
  }

  if (validation.status === 'not_applicable') {
    return;
  }

  const failureItems = validation.failure_items;
  const failureCount = Array.isArray(failureItems) ? failureItems.length : 0;
  const status = failureCount > 0 || validation.status === 'failed'
    ? 'blocked'
    : getWorkspaceUserFlowStatusFromEngineeringStatus(validation.status);

  appendWorkspaceUserFlowStep(steps, {
    id: 'validation',
    label: '验证与修复',
    status,
    detail: status === 'blocked'
      ? `发现 ${failureCount} 个校验问题`
      : '验证门禁已执行',
  });
}

function appendWorkspaceUserFlowRuntimeStep(
  steps: WorkspaceUserFlowStepList,
  runtime: WorkspaceRuntimeState | undefined,
): void {
  if (runtime === undefined) {
    return;
  }

  const runtimeStatus = getWorkspaceUserFlowOptionalText(runtime.status);
  appendWorkspaceUserFlowStep(steps, {
    id: 'runtime-preview',
    label: '运行与预览',
    status: getWorkspaceUserFlowStatusFromEngineeringStatus(runtime.status),
    detail: hasWorkspaceChatEngineeringTextValue(runtimeStatus)
      ? `Runtime 状态：${runtimeStatus}`
      : '运行态与预览状态已同步',
  });
}

function appendWorkspaceUserFlowRecoveryStep(
  steps: WorkspaceUserFlowStepList,
  recovery: WorkspaceRecoveryState | undefined,
): void {
  if (recovery === undefined) {
    return;
  }

  const reasonMessage = getWorkspaceUserFlowOptionalText(recovery.reason_message);
  appendWorkspaceUserFlowStep(steps, {
    id: 'recovery',
    label: '恢复与后续迭代',
    status: recovery.blocked === true ? 'blocked' : 'active',
    detail: hasWorkspaceChatEngineeringTextValue(reasonMessage)
      ? reasonMessage
      : '可按恢复入口继续修复或进入下一轮迭代',
  });
}

const WORKSPACE_CHAT_PHASE_LIST_COMPACT_LIMIT = 2;
const WORKSPACE_CHAT_PHASE_LIST_DEFAULT_LIMIT = 3;

function formatChatInputSnapshotTitle(snapshot: ChatInputSnapshot) {
  switch (snapshot.status) {
    case 'empty_prompt':
      return '输入区等待内容';
    case 'ready_to_send':
      return '输入区已可发送';
    case 'plan_selection_required':
      return '输入区等待方案选择';
    case 'planning':
      return '输入区等待方案生成';
    case 'generating':
      return '输入区正在生成';
    case 'stop_confirmation':
      return '输入区等待停止确认';
    case 'model_unconfigured':
      return '输入区模型配置待确认';
    default:
      return '输入区状态待确认';
  }
}

function getChatInputSnapshotClassName(snapshot: ChatInputSnapshot) {
  if (snapshot.status === 'stop_confirmation') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'planning' || snapshot.status === 'generating' || snapshot.status === 'plan_selection_required') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'ready_to_send') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  if (snapshot.status === 'model_unconfigured') {
    return 'border-primary/20 bg-primary/5 text-primary';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function formatChatModelRegistrySnapshotTitle(snapshot: ChatModelRegistrySnapshot) {
  switch (snapshot.status) {
    case 'idle':
      return '模型列表等待加载';
    case 'loading':
      return '模型列表正在加载';
    case 'ready':
      return '模型列表已加载';
    case 'empty':
      return '模型列表为空';
    case 'load_failed':
      return '模型列表加载失败';
    case 'default_selected':
      return '默认模型已选择';
    default:
      return '模型列表状态待确认';
  }
}

function getChatModelRegistrySnapshotClassName(snapshot: ChatModelRegistrySnapshot) {
  if (snapshot.status === 'load_failed') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'loading' || snapshot.status === 'empty') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'ready' || snapshot.status === 'default_selected') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function formatChatAttachmentSnapshotTitle(snapshot: ChatAttachmentSnapshot) {
  switch (snapshot.status) {
    case 'empty':
      return '附件区暂无文件';
    case 'selected':
      return '附件已选择';
    case 'removed':
      return '附件已移除';
    case 'picker_empty':
      return '附件选择未返回文件';
    case 'rejected':
      return '图片附件已拒绝';
    default:
      return '附件状态待确认';
  }
}

function getChatAttachmentSnapshotClassName(snapshot: ChatAttachmentSnapshot) {
  if (snapshot.status === 'rejected') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'picker_empty') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'selected') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  if (snapshot.status === 'removed') {
    return 'border-primary/20 bg-primary/5 text-primary';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function formatAttachmentSize(size: number) {
  if (size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatChatModeSnapshotTitle(snapshot: ChatModeSnapshot) {
  switch (snapshot.status) {
    case 'discuss_ready':
      return '探讨模式就绪';
    case 'implement_ready':
      return '实现模式就绪';
    case 'online_discuss':
      return '联网探讨模式';
    case 'online_implement':
      return '联网实现模式';
    case 'planning':
      return '模式等待方案生成';
    case 'generating':
      return '模式正在生成';
    case 'stop_confirmation':
      return '模式等待停止确认';
    default:
      return '模式状态待确认';
  }
}

function getChatModeSnapshotClassName(snapshot: ChatModeSnapshot) {
  if (snapshot.status === 'stop_confirmation') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'planning' || snapshot.status === 'generating') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'online_discuss' || snapshot.status === 'online_implement') {
    return 'border-primary/20 bg-primary/5 text-primary';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function hasWorkspaceChatComposerSnapshotTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceChatComposerSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspaceChatComposerSnapshotTextValue(value);

  return hasValue === true ? value : fallback;
}

function getWorkspaceChatComposerSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getWorkspaceChatComposerSnapshotOnlineLabel(value: boolean): string {
  return value === true ? 'on' : 'off';
}

function hasWorkspaceChatComposerModels(models: WorkspaceChatComposerProps['models']): boolean {
  const hasModels = models.length > 0;
  return hasModels === true;
}

function shouldRenderWorkspaceChatComposerModelList(models: WorkspaceChatComposerProps['models']): boolean {
  return hasWorkspaceChatComposerModels(models);
}

function shouldRenderWorkspaceChatComposerModelEmptyState(models: WorkspaceChatComposerProps['models']): boolean {
  const hasModels = hasWorkspaceChatComposerModels(models);
  return hasModels === false;
}

function getWorkspaceChatComposerModelEmptyStateLabel(isCompact: boolean): string {
  if (isCompact === true) {
    return '未配置模型';
  }

  return '未配置 LLM 模型，请在管理后台配置';
}

function canSendWorkspaceChatComposerPrompt({
  hasPlanSelectionPending,
  hasContent,
  visualInputBlocked,
}: {
  hasPlanSelectionPending: boolean;
  hasContent: boolean;
  visualInputBlocked: boolean;
}): boolean {
  if (hasPlanSelectionPending === true || visualInputBlocked === true) {
    return false;
  }

  return hasContent === true;
}

function workspaceChatSelectedModelSupportsVision(
  models: WorkspaceChatComposerProps['models'],
  selectedModel: string,
): boolean {
  for (const model of models) {
    if (model.id === selectedModel) {
      return model.supportsVision === true;
    }
  }
  return false;
}

function shouldRenderWorkspaceChatComposerOfflineFoundationStatus({
  isOfflineMode,
  isCompact,
}: {
  isOfflineMode: boolean;
  isCompact: boolean;
}): boolean {
  if (isOfflineMode === false) {
    return false;
  }

  return isCompact === false;
}

function getWorkspaceChatComposerOnlineButtonTitle({
  isCompact,
  isOnlineMode,
}: {
  isCompact: boolean;
  isOnlineMode: boolean;
}): string | undefined {
  if (isCompact === true) {
    return undefined;
  }

  if (isOnlineMode === true) {
    return '联网已开启';
  }

  return '联网已关闭';
}

function shouldRenderWorkspaceChatComposerExpandedFoundationStatus(isCompact: boolean): boolean {
  return isCompact === false;
}

function getWorkspaceChatComposerUploadButtonTitle(isCompact: boolean): string | undefined {
  if (isCompact === true) {
    return undefined;
  }

  return '上传文件';
}

function getWorkspaceChatComposerOnlineStatusClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'gap-1 text-xs text-primary';
  }

  return 'gap-2 text-xs text-muted-foreground';
}

function getWorkspaceChatComposerOnlineIconClassName(isCompact: boolean): string | undefined {
  if (isCompact === true) {
    return undefined;
  }

  return 'text-primary';
}

function getWorkspaceChatComposerOnlineLabelClassName(isCompact: boolean): string | undefined {
  if (isCompact === true) {
    return undefined;
  }

  return 'text-primary';
}

function getWorkspaceChatComposerAttachmentListClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'gap-1.5';
  }

  return 'gap-2';
}

function getWorkspaceChatComposerAttachmentBadgeClassName(isCompact: boolean): string | undefined {
  if (isCompact === true) {
    return 'text-xs';
  }

  return undefined;
}

function getWorkspaceChatComposerAttachmentNameClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'max-w-[60px]';
  }

  return 'max-w-[80px]';
}

function getWorkspaceChatComposerAttachmentRemoveClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'ml-0.5';
  }

  return 'ml-1';
}

function getWorkspaceChatComposerContainerClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'p-3';
  }

  return 'p-4';
}

function getWorkspaceChatComposerInputRowClassName(isCompact: boolean): string | undefined {
  if (isCompact === true) {
    return undefined;
  }

  return 'flex gap-2';
}

function getWorkspaceChatComposerInputPlaceholder(hasPlanSelectionPending: boolean): string {
  if (hasPlanSelectionPending === true) {
    return '请先选择一个技术方案...';
  }

  return '继续描述你的需求或修改意见...';
}

function getWorkspaceChatComposerTextareaClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'min-h-[84px] max-h-[192px] resize-none text-sm';
  }

  return 'min-h-[88px] max-h-[224px] resize-none';
}

function getWorkspaceChatComposerPopoverContentClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'w-32';
  }

  return 'w-40';
}

function getWorkspaceChatComposerModelPopoverContentClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'w-[min(calc(100vw-2rem),26rem)]';
  }

  return 'w-[30rem]';
}

function getWorkspaceChatComposerModeButtonKey({
  isCompact,
  mode,
}: {
  isCompact: boolean;
  mode: ChatMode;
}): string {
  if (isCompact === true) {
    return `${mode}-mobile`;
  }

  return mode;
}

function getWorkspaceChatComposerTransitionClassName(isCompact: boolean): string | undefined {
  if (isCompact === true) {
    return undefined;
  }

  return 'transition-colors';
}

function getWorkspaceChatComposerModeButtonToneClassName({
  chatMode,
  mode,
}: {
  chatMode: ChatMode;
  mode: ChatMode;
}): string {
  if (chatMode === mode) {
    return 'bg-primary text-primary-foreground';
  }

  return 'hover:bg-muted';
}

function getWorkspaceChatComposerModelButtonToneClassName({
  selectedModel,
  modelId,
}: {
  selectedModel: string;
  modelId: string;
}): string {
  if (selectedModel === modelId) {
    return 'bg-primary text-primary-foreground';
  }

  return 'hover:bg-muted';
}

function materializeWorkspaceChatComposerProviderOptions(
  models: WorkspaceChatComposerProps['models'],
): WorkspaceChatComposerProviderOptionList {
  const providers: WorkspaceChatComposerProviderOptionList = [];
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model.providerId)) {
      continue;
    }
    seen.add(model.providerId);
    providers.push({
      id: model.providerId,
      name: model.providerName,
    });
  }
  return providers;
}

function getWorkspaceChatComposerFirstProviderId(
  providers: WorkspaceChatComposerProviderOptionList,
): string {
  for (const provider of providers) {
    return provider.id;
  }
  return '';
}

function getWorkspaceChatComposerSelectedProviderId({
  models,
  selectedModel,
  fallbackProviderId,
}: {
  models: WorkspaceChatComposerProps['models'];
  selectedModel: string;
  fallbackProviderId: string;
}): string {
  for (const model of models) {
    if (model.id === selectedModel) {
      return model.providerId;
    }
  }
  return fallbackProviderId;
}

function materializeWorkspaceChatComposerModelNodes({
  models,
  selectedModel,
  transitionClassName,
  setSelectedModel,
  activeProviderId,
}: {
  models: WorkspaceChatComposerProps['models'];
  selectedModel: string;
  transitionClassName: string | undefined;
  setSelectedModel: WorkspaceChatComposerModelSetter;
  activeProviderId: string;
}): WorkspaceChatComposerModelNodeList {
  const nodes: WorkspaceChatComposerModelNodeList = [];

  for (const model of models) {
    const modelButtonToneClassName = getWorkspaceChatComposerModelButtonToneClassName({
      selectedModel,
      modelId: model.id,
    });
    if (model.providerId !== activeProviderId) {
      continue;
    }

    nodes.push(
      <button
        key={model.id}
        type="button"
        onClick={() => setSelectedModel(model.id)}
        title={model.name}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
          transitionClassName,
          modelButtonToneClassName,
        )}
      >
        <span className="sr-only">{model.name}</span>
        <span aria-hidden="true" className="min-w-0 flex-1 truncate whitespace-nowrap">{model.modelName}</span>
        {model.supportsVision === true && (
          <ImageIcon aria-label="支持图片输入" className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>,
    );
  }

  return nodes;
}

function getWorkspaceChatComposerProviderButtonToneClassName({
  activeProviderId,
  providerId,
}: {
  activeProviderId: string;
  providerId: string;
}): string {
  if (activeProviderId === providerId) {
    return 'bg-muted text-foreground';
  }
  return 'text-muted-foreground hover:bg-muted/70 hover:text-foreground';
}

function materializeWorkspaceChatComposerProviderNodes({
  providers,
  activeProviderId,
  transitionClassName,
  setActiveProviderId,
}: {
  providers: WorkspaceChatComposerProviderOptionList;
  activeProviderId: string;
  transitionClassName: string | undefined;
  setActiveProviderId: (providerId: string) => void;
}): WorkspaceChatComposerModelNodeList {
  const nodes: WorkspaceChatComposerModelNodeList = [];

  for (const provider of providers) {
    const providerButtonToneClassName = getWorkspaceChatComposerProviderButtonToneClassName({
      activeProviderId,
      providerId: provider.id,
    });
    nodes.push(
      <button
        key={provider.id}
        type="button"
        onClick={() => setActiveProviderId(provider.id)}
        onMouseEnter={() => setActiveProviderId(provider.id)}
        title={provider.name}
        className={cn(
          'w-full rounded-md px-3 py-2 text-left text-sm font-medium',
          'truncate whitespace-nowrap',
          transitionClassName,
          providerButtonToneClassName,
        )}
      >
        {provider.name}
      </button>,
    );
  }

  return nodes;
}

function shouldRenderWorkspaceChatComposerModelColumn(modelNodes: WorkspaceChatComposerModelNodeList): boolean {
  return modelNodes.length > 0;
}

function getWorkspaceChatComposerModelEmptyStateClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'text-xs';
  }

  return 'text-sm';
}

function shouldRenderWorkspaceChatComposerStopAction(isGenerating: boolean): boolean {
  return isGenerating === true;
}

function shouldRenderWorkspaceChatComposerSendAction(isGenerating: boolean): boolean {
  return isGenerating === false;
}

function getWorkspaceChatComposerStopActionVariant(
  hasStopConfirming: boolean,
): 'destructive' | 'outline' {
  if (hasStopConfirming === true) {
    return 'destructive';
  }

  return 'outline';
}

function getWorkspaceChatComposerActionMinWidthClassName(isCompact: boolean): string | undefined {
  if (isCompact === true) {
    return 'min-w-[92px]';
  }

  return undefined;
}

function getWorkspaceChatComposerStopActionMinWidthClassName(isCompact: boolean): string {
  if (isCompact === true) {
    return 'min-w-[92px]';
  }

  return 'min-w-[96px]';
}

function getWorkspaceChatComposerStopActionLabel({
  hasStopConfirming,
  isCompact,
}: {
  hasStopConfirming: boolean;
  isCompact: boolean;
}): string {
  if (hasStopConfirming === true) {
    return '确认停止';
  }

  if (isCompact === true) {
    return '停止';
  }

  return '停止生成';
}

function shouldDisableWorkspaceChatComposerStopAction({
  hasStopConfirming,
  canConfirmStop,
}: {
  hasStopConfirming: boolean;
  canConfirmStop: boolean;
}): boolean {
  if (hasStopConfirming === false) {
    return false;
  }

  return canConfirmStop === false;
}

function getWorkspaceChatComposerOnlineButtonModeClassName(isOnlineMode: boolean): string | undefined {
  if (isOnlineMode === true) {
    return 'bg-primary/10 text-primary';
  }

  return undefined;
}

function getWorkspaceChatComposerStopActionToneClassName(hasStopConfirming: boolean): string | undefined {
  if (hasStopConfirming === true) {
    return undefined;
  }

  return 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive';
}

function getWorkspaceChatComposerStopActionAnimationClassName(hasStopConfirming: boolean): string | undefined {
  if (hasStopConfirming === true) {
    return 'animate-pulse';
  }

  return undefined;
}

function getWorkspaceChatPendingAttachmentRemoval(
  attachedFiles: WorkspaceChatAttachment[],
  pendingAttachmentRemovalIndex: number | null,
): WorkspaceChatAttachment | null {
  if (pendingAttachmentRemovalIndex === null) {
    return null;
  }

  const pendingAttachmentRemoval = attachedFiles[pendingAttachmentRemovalIndex];
  if (pendingAttachmentRemoval === undefined) {
    return null;
  }

  return pendingAttachmentRemoval;
}

function hasWorkspaceChatBusyInputSnapshot({
  hasInputPlanning,
  hasInputGenerating,
  hasInputPlanSelectionRequired,
}: {
  hasInputPlanning: boolean;
  hasInputGenerating: boolean;
  hasInputPlanSelectionRequired: boolean;
}): boolean {
  if (hasInputPlanning === true) {
    return true;
  }

  if (hasInputGenerating === true) {
    return true;
  }

  if (hasInputPlanSelectionRequired === true) {
    return true;
  }

  return false;
}

function hasWorkspaceChatBusyModeSnapshot(
  hasModePlanning: boolean,
  hasModeGenerating: boolean,
): boolean {
  if (hasModePlanning === true) {
    return true;
  }

  if (hasModeGenerating === true) {
    return true;
  }

  return false;
}

function shouldRenderWorkspaceChatAttachedFiles(attachedFiles: WorkspaceChatAttachment[]): boolean {
  const hasAttachedFiles = attachedFiles.length > 0;
  return hasAttachedFiles === true;
}

function materializeWorkspaceChatComposerAttachmentNodes({
  attachedFiles,
  attachmentBadgeClassName,
  attachmentNameClassName,
  attachmentRemoveClassName,
  requestAttachmentRemoval,
}: {
  attachedFiles: WorkspaceChatAttachment[];
  attachmentBadgeClassName: string | undefined;
  attachmentNameClassName: string;
  attachmentRemoveClassName: string;
  requestAttachmentRemoval: WorkspaceChatComposerAttachmentRemovalRequest;
}): WorkspaceChatComposerAttachmentNodeList {
  const nodes: WorkspaceChatComposerAttachmentNodeList = [];

  for (let index = 0; index < attachedFiles.length; index += 1) {
    const file = attachedFiles[index];
    if (file === undefined) {
      continue;
    }

    nodes.push(
      <Badge key={file.name + index} variant="secondary" className={cn('flex items-center gap-1', attachmentBadgeClassName)}>
        <span
          role="img"
          aria-label={`图片预览：${file.name}`}
          className="h-7 w-7 shrink-0 rounded border bg-cover bg-center"
          style={{ backgroundImage: `url(${file.dataUrl})` }}
        />
        <span className={cn('truncate', attachmentNameClassName)}>{file.name}</span>
        <button
          type="button"
          onClick={() => requestAttachmentRemoval(index)}
          className={cn('hover:text-destructive', attachmentRemoveClassName)}
        >
          <X className="w-3 h-3" />
        </button>
      </Badge>,
    );
  }

  return nodes;
}

function shouldRenderWorkspaceChatStopConfirmation(isStopConfirming: boolean): boolean {
  return isStopConfirming === true;
}

function getWorkspaceChatEngineeringExecutionState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceExecutionState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.execution;
}

function getWorkspaceChatEngineeringPhaseState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspacePhaseState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.phase;
}

function getWorkspaceChatEngineeringWorkflowState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): WorkspaceWorkflowState | undefined {
  if (engineeringState === undefined) {
    return undefined;
  }

  return engineeringState.workflow;
}

function getWorkspaceChatEngineeringTextValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value;
}

function hasWorkspaceChatEngineeringTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceChatEngineeringPhaseTasks(phase: WorkspacePhaseState | undefined): string[] {
  if (phase === undefined) {
    return [];
  }

  if (Array.isArray(phase.completed_tasks) === false) {
    return [];
  }

  return phase.completed_tasks;
}

function getWorkspaceChatEngineeringPhaseBlockers(phase: WorkspacePhaseState | undefined): string[] {
  if (phase === undefined) {
    return [];
  }

  if (Array.isArray(phase.blockers) === false) {
    return [];
  }

  return phase.blockers;
}

function getWorkspaceChatPhaseListLimit(compact: boolean | undefined): number {
  if (compact === true) {
    return WORKSPACE_CHAT_PHASE_LIST_COMPACT_LIMIT;
  }

  return WORKSPACE_CHAT_PHASE_LIST_DEFAULT_LIMIT;
}

function materializeWorkspaceChatPhaseItemNodes({
  items,
  limit,
}: {
  items: string[];
  limit: number;
}): WorkspaceChatPhaseItemNodeList {
  const nodes: WorkspaceChatPhaseItemNodeList = [];

  for (let index = 0; index < items.length && index < limit; index += 1) {
    const item = items[index];
    if (item === undefined) {
      continue;
    }

    const itemKey = `${item}-${index}`;
    nodes.push(
      <div key={itemKey} className="truncate">· {item}</div>,
    );
  }

  return nodes;
}

function getWorkspaceChatEngineeringWorkflowStageLabel(
  workflow: WorkspaceWorkflowState | undefined,
): string {
  if (workflow === undefined) {
    return '';
  }

  const stageLabel = formatWorkspaceWorkflowStage(workflow.stage);
  if (stageLabel === undefined) {
    return '';
  }

  return stageLabel;
}

function getWorkspaceChatEngineeringAutoProgressEnabled({
  workflow,
  execution,
}: {
  workflow: WorkspaceWorkflowState | undefined;
  execution: WorkspaceExecutionState | undefined;
}): boolean {
  if (execution !== undefined && execution.auto_progress_enabled !== undefined) {
    return execution.auto_progress_enabled === true;
  }

  if (workflow === undefined || workflow.stage === undefined) {
    return false;
  }

  const autoProgressEnabled = getWorkspaceWorkflowStageAutoProgressEnabled(workflow.stage);
  if (autoProgressEnabled === undefined) {
    return false;
  }

  return autoProgressEnabled;
}

function getWorkspaceChatEngineeringApprovalBoundary({
  workflow,
  execution,
}: {
  workflow: WorkspaceWorkflowState | undefined;
  execution: WorkspaceExecutionState | undefined;
}): string {
  const rawExecutionApprovalBoundary = execution === undefined ? undefined : execution.approval_boundary;
  const executionApprovalBoundary = getWorkspaceChatEngineeringTextValue(rawExecutionApprovalBoundary);
  const hasExecutionApprovalBoundary = hasWorkspaceChatEngineeringTextValue(executionApprovalBoundary);
  if (hasExecutionApprovalBoundary === true) {
    return executionApprovalBoundary;
  }

  if (workflow === undefined || workflow.stage === undefined) {
    return '';
  }

  const workflowApprovalBoundary = getWorkspaceWorkflowStageApprovalBoundary(workflow.stage);
  if (workflowApprovalBoundary === undefined) {
    return '';
  }

  return workflowApprovalBoundary;
}

function getWorkspaceChatEngineeringPhaseStatus(
  phase: WorkspacePhaseState | undefined,
): WorkspacePhaseStatus | undefined {
  if (phase === undefined) {
    return undefined;
  }

  return phase.status;
}

function getWorkspaceChatEngineeringPhaseCurrentPhase(phase: WorkspacePhaseState | undefined): string {
  if (phase === undefined) {
    return '';
  }

  return getWorkspaceChatEngineeringTextValue(phase.current_phase);
}

function getWorkspaceChatEngineeringPhaseCurrentTask(phase: WorkspacePhaseState | undefined): string {
  if (phase === undefined) {
    return '';
  }

  return getWorkspaceChatEngineeringTextValue(phase.current_task);
}

function getWorkspaceChatEngineeringExecutionCurrentTask(execution: WorkspaceExecutionState | undefined): string {
  if (execution === undefined) {
    return '';
  }

  return getWorkspaceChatEngineeringTextValue(execution.current_task);
}

function getWorkspaceChatEngineeringPhaseNextAction(phase: WorkspacePhaseState | undefined): string {
  if (phase === undefined) {
    return '';
  }

  return getWorkspaceChatEngineeringTextValue(phase.next_action);
}

function getWorkspaceChatEngineeringExecutionNextAction(execution: WorkspaceExecutionState | undefined): string {
  if (execution === undefined) {
    return '';
  }

  return getWorkspaceChatEngineeringTextValue(execution.next_action);
}

function getWorkspaceChatEngineeringExecutionPauseReason(execution: WorkspaceExecutionState | undefined): string {
  if (execution === undefined) {
    return '';
  }

  return getWorkspaceChatEngineeringTextValue(execution.pause_reason);
}

function hasWorkspaceChatEngineeringExecutionAwaitingConfirmation(
  execution: WorkspaceExecutionState | undefined,
): boolean {
  if (execution === undefined) {
    return false;
  }

  return execution.awaiting_confirmation === true;
}

function hasWorkspaceChatEngineeringActiveExecution(
  hasCurrentTask: boolean,
  hasNextAction: boolean,
): boolean {
  if (hasCurrentTask === true) {
    return true;
  }

  if (hasNextAction === true) {
    return true;
  }

  return false;
}

function getWorkspaceChatEngineeringFallbackTextValue(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }

  return value;
}

function getWorkspaceChatEngineeringPhaseStatusLabel(phase: WorkspacePhaseState | undefined): string {
  const phaseStatus = getWorkspaceChatEngineeringPhaseStatus(phase);
  const statusLabel = formatPhaseStatusLabel(phaseStatus);
  return getWorkspaceChatEngineeringFallbackTextValue(statusLabel, '');
}

function getWorkspaceChatEngineeringPhaseSummaryStatusLabel(phase: WorkspacePhaseState | undefined): string {
  const phaseStatus = getWorkspaceChatEngineeringPhaseStatus(phase);
  const statusLabel = formatPhaseStatusLabel(phaseStatus);
  return getWorkspaceChatEngineeringFallbackTextValue(statusLabel, '无阶段状态');
}

function getWorkspaceChatWorkflowSummaryStatusLabel(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): string {
  const workflowStatusLabel = buildWorkflowStatusLabel(engineeringState);
  return getWorkspaceChatEngineeringFallbackTextValue(workflowStatusLabel, '无工作流执行状态');
}

function getWorkspaceChatEngineeringCurrentPhase(
  phase: WorkspacePhaseState | undefined,
  workflow: WorkspaceWorkflowState | undefined,
  fallback: string,
): string {
  const phaseCurrentPhase = getWorkspaceChatEngineeringPhaseCurrentPhase(phase);
  const hasPhaseCurrentPhase = hasWorkspaceChatEngineeringTextValue(phaseCurrentPhase);
  if (hasPhaseCurrentPhase === true) {
    return phaseCurrentPhase;
  }

  const workflowStageLabel = getWorkspaceChatEngineeringWorkflowStageLabel(workflow);
  const hasWorkflowStageLabel = hasWorkspaceChatEngineeringTextValue(workflowStageLabel);
  if (hasWorkflowStageLabel === true) {
    return workflowStageLabel;
  }

  return fallback;
}

function getWorkspaceChatEngineeringCurrentTask(
  phase: WorkspacePhaseState | undefined,
  execution: WorkspaceExecutionState | undefined,
): string {
  const phaseCurrentTask = getWorkspaceChatEngineeringPhaseCurrentTask(phase);
  const hasPhaseCurrentTask = hasWorkspaceChatEngineeringTextValue(phaseCurrentTask);
  if (hasPhaseCurrentTask === true) {
    return phaseCurrentTask;
  }

  const executionCurrentTask = getWorkspaceChatEngineeringExecutionCurrentTask(execution);
  const hasExecutionCurrentTask = hasWorkspaceChatEngineeringTextValue(executionCurrentTask);
  if (hasExecutionCurrentTask === true) {
    return executionCurrentTask;
  }

  return '';
}

function getWorkspaceChatEngineeringNextAction(
  phase: WorkspacePhaseState | undefined,
  execution: WorkspaceExecutionState | undefined,
): string {
  const phaseNextAction = getWorkspaceChatEngineeringPhaseNextAction(phase);
  const hasPhaseNextAction = hasWorkspaceChatEngineeringTextValue(phaseNextAction);
  if (hasPhaseNextAction === true) {
    return phaseNextAction;
  }

  const executionNextAction = getWorkspaceChatEngineeringExecutionNextAction(execution);
  const hasExecutionNextAction = hasWorkspaceChatEngineeringTextValue(executionNextAction);
  if (hasExecutionNextAction === true) {
    return executionNextAction;
  }

  return '';
}

function shouldRenderWorkspaceChatPhaseSnapshot({
  hasCurrentPhase,
  hasCurrentTask,
  hasNextAction,
  hasCompletedTasks,
  hasBlockers,
}: {
  hasCurrentPhase: boolean;
  hasCurrentTask: boolean;
  hasNextAction: boolean;
  hasCompletedTasks: boolean;
  hasBlockers: boolean;
}): boolean {
  if (hasCurrentPhase === true) {
    return true;
  }

  if (hasCurrentTask === true) {
    return true;
  }

  if (hasNextAction === true) {
    return true;
  }

  if (hasCompletedTasks === true) {
    return true;
  }

  if (hasBlockers === true) {
    return true;
  }

  return false;
}

function shouldRenderWorkspaceChatPhaseLists(
  hasCompletedTasks: boolean,
  hasBlockers: boolean,
): boolean {
  if (hasCompletedTasks === true) {
    return true;
  }

  if (hasBlockers === true) {
    return true;
  }

  return false;
}

function hasWorkspaceChatPhaseStatus(
  phase: WorkspacePhaseState | undefined,
  status: WorkspacePhaseStatus,
): boolean {
  const phaseStatus = getWorkspaceChatEngineeringPhaseStatus(phase);
  return phaseStatus === status;
}

function hasWorkspaceChatScrollFollowingLatest(chatScrollSnapshot: ChatScrollSnapshot): boolean {
  if (chatScrollSnapshot.status === 'following_latest') {
    return true;
  }

  if (chatScrollSnapshot.status === 'restored_to_latest') {
    return true;
  }

  return false;
}

function getWorkspaceChatMessageStateSummaryContainerTextClassName(compact: boolean | undefined): string {
  if (compact === true) {
    return 'text-[11px]';
  }

  return 'text-xs';
}

function getWorkspaceChatScrollDistanceLabel(distanceToBottom: number | null): string {
  if (distanceToBottom === null) {
    return 'unknown';
  }

  return `${Math.max(0, Math.round(distanceToBottom))}px`;
}

function buildWorkflowStatusLabel(engineeringState?: WorkspaceEngineeringStateSnapshot) {
  const execution = getWorkspaceChatEngineeringExecutionState(engineeringState);
  const workflow = getWorkspaceChatEngineeringWorkflowState(engineeringState);
  const hasExecution = execution !== undefined;
  if (hasExecution === false) return undefined;

  const pauseReason = getWorkspaceChatEngineeringTextValue(execution.pause_reason);
  const hasPauseReason = hasWorkspaceChatEngineeringTextValue(pauseReason);
  const hasAwaitingConfirmation = execution.awaiting_confirmation === true;
  const hasAutoProgress = getWorkspaceChatEngineeringAutoProgressEnabled({
    workflow,
    execution,
  });
  const currentTask = getWorkspaceChatEngineeringTextValue(execution.current_task);
  const hasCurrentTask = hasWorkspaceChatEngineeringTextValue(currentTask);
  const nextAction = getWorkspaceChatEngineeringTextValue(execution.next_action);
  const hasNextAction = hasWorkspaceChatEngineeringTextValue(nextAction);
  const hasActiveExecution = hasWorkspaceChatEngineeringActiveExecution(hasCurrentTask, hasNextAction);

  if (hasPauseReason === true) return '已阻断';
  if (hasAwaitingConfirmation === true) return '等待确认';
  if (hasAutoProgress === true) return '自动推进中';
  if (hasActiveExecution === true) return '进行中';
  return undefined;
}

function formatPhaseStatusLabel(status?: WorkspacePhaseStatus) {
  switch (status) {
    case 'failed':
      return '失败';
    case 'passed':
      return '已完成';
    case 'running':
      return '进行中';
    case 'pending':
      return '等待中';
    case 'not_applicable':
      return '不适用';
    default:
      return undefined;
  }
}

function getPhaseSnapshotTone(
  status?: WorkspacePhaseStatus,
  hasBlockers?: boolean,
) {
  if (status === 'failed') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (hasBlockers === true) {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (status === 'passed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'running') {
    return 'border-primary/20 bg-primary/5 text-primary';
  }
  if (status === 'pending') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-border bg-background/70 text-foreground';
}

function getWorkspaceUserFlowPlanName({
  messages,
  selectedPlanId,
}: {
  messages: WorkspaceChatMessagesProps['messages'];
  selectedPlanId: string | null;
}): string {
  if (selectedPlanId === null) {
    return '';
  }

  for (const message of messages) {
    const plans = message.plans;
    if (Array.isArray(plans) === false) {
      continue;
    }

    for (const plan of plans) {
      if (plan.id === selectedPlanId) {
        return plan.name;
      }
    }
  }

  return selectedPlanId;
}

function hasWorkspaceUserFlowSelectedPlan(selectedPlanId: string | null): boolean {
  return selectedPlanId !== null;
}

function getWorkspaceUserFlowCodeGenerationStatus({
  hasSelectedPlan,
  isGenerating,
  phase,
}: {
  hasSelectedPlan: boolean;
  isGenerating: boolean;
  phase: WorkspacePhaseState | undefined;
}): WorkspaceUserFlowStepStatus {
  if (hasSelectedPlan === false) {
    return 'pending';
  }

  if (isGenerating === true) {
    return 'active';
  }

  if (hasWorkspaceChatPhaseStatus(phase, 'failed')) {
    return 'blocked';
  }

  if (hasWorkspaceChatPhaseStatus(phase, 'passed')) {
    return 'completed';
  }

  return 'active';
}

function buildWorkspaceUserFlowSteps({
  messages,
  planSelectionReady,
  selectedPlanId,
  isPlanning,
  isGenerating,
  engineeringState,
}: {
  messages: WorkspaceChatMessagesProps['messages'];
  planSelectionReady: boolean;
  selectedPlanId: string | null;
  isPlanning: boolean;
  isGenerating: boolean;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
}): WorkspaceUserFlowStepList {
  const steps: WorkspaceUserFlowStepList = [];
  const phase = getWorkspaceChatEngineeringPhaseState(engineeringState);
  const workflow = getWorkspaceChatEngineeringWorkflowState(engineeringState);
  const selectedPlanName = getWorkspaceUserFlowPlanName({ messages, selectedPlanId });
  const bootstrapState = engineeringState?.bootstrap_state;
  const planSelection = engineeringState?.plan_selection;
  const execution = engineeringState?.execution;
  const validation = engineeringState?.validation;
  const runtime = engineeringState?.runtime;
  const recovery = engineeringState?.recovery;
  const hasDownstreamProgress = hasWorkspaceUserFlowDownstreamProgress({
    planSelection,
    planSelectionReady,
    selectedPlanId,
    execution,
    phase,
    validation,
    runtime,
    recovery,
    isGenerating,
  });

  appendWorkspaceUserFlowFoundationStep(steps, bootstrapState, hasDownstreamProgress);
  appendWorkspaceUserFlowPlanGenerationStep({
    steps,
    workflow,
    planSelection,
    planSelectionReady,
    selectedPlanId,
    isPlanning,
  });
  appendWorkspaceUserFlowPlanSelectionStep({
    steps,
    planSelection,
    planSelectionReady,
    selectedPlanId,
    selectedPlanName,
  });
  appendWorkspaceUserFlowPlanExecutionStep({
    steps,
    selectedPlanName,
    selectedPlanId,
    execution,
  });
  appendWorkspaceUserFlowPhaseStep({
    steps,
    phase,
    isGenerating,
  });
  appendWorkspaceUserFlowValidationStep(steps, validation);
  appendWorkspaceUserFlowRuntimeStep(steps, runtime);
  appendWorkspaceUserFlowRecoveryStep(steps, recovery);

  if (hasWorkspaceUserFlowStep(steps) === false) {
    appendWorkspaceUserFlowStep(steps, {
      id: 'foundation',
      label: 'Foundation 前置设计',
      status: isPlanning === true
        ? 'active'
        : getWorkspaceUserFlowStatusFromEngineeringStatus(getWorkspaceUserFlowWorkflowStatus(engineeringState)),
      detail: '正在整理需求、约束、技术栈与生成前决策',
    });
  }

  return normalizeWorkspaceUserFlowSteps(steps);
}

function getWorkspaceUserFlowActiveStep(steps: WorkspaceUserFlowStepList): WorkspaceUserFlowStep {
  for (const step of steps) {
    if (step.status === 'blocked') {
      return step;
    }
  }

  for (const step of steps) {
    if (step.status === 'paused') {
      return step;
    }
  }

  for (const step of steps) {
    if (step.status === 'active') {
      return step;
    }
  }

  const lastStep = steps[steps.length - 1];
  if (lastStep !== undefined) {
    return lastStep;
  }

  return {
    id: 'foundation',
    label: 'Foundation 前置设计',
    status: 'active',
    detail: '正在整理需求、约束、技术栈与生成前决策',
  };
}

function getWorkspaceUserFlowStepClassName(status: WorkspaceUserFlowStepStatus): string {
  if (status === 'completed') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 shadow-sm shadow-emerald-500/5 dark:text-emerald-300';
  }
  if (status === 'active') {
    return 'border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10';
  }
  if (status === 'paused') {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-700 shadow-sm shadow-amber-500/5 dark:text-amber-300';
  }
  if (status === 'blocked') {
    return 'border-destructive/30 bg-destructive/10 text-destructive shadow-sm shadow-destructive/10';
  }

  return 'border-border bg-muted/40 text-muted-foreground';
}

function getWorkspaceUserFlowTimelineTextClassName(status: WorkspaceUserFlowStepStatus): string {
  if (status === 'completed') {
    return 'text-emerald-700 dark:text-emerald-300';
  }
  if (status === 'active') {
    return 'text-primary';
  }
  if (status === 'paused') {
    return 'text-amber-700 dark:text-amber-300';
  }
  if (status === 'blocked') {
    return 'text-destructive';
  }

  return 'text-muted-foreground';
}

function getWorkspaceUserFlowTimelineText(status: WorkspaceUserFlowStepStatus, label: string, detail: string): string {
  if (status === 'completed') {
    return label;
  }
  if (status === 'active') {
    if (label.endsWith('中')) {
      return label;
    }
    return `${label}中`;
  }
  if (status === 'paused') {
    const pauseReason = detail.replace(/^执行暂停：/, '').trim();
    if (pauseReason.length > 0) {
      return `暂停中 ${pauseReason}`;
    }
    return `暂停中 ${label}`;
  }
  if (status === 'blocked') {
    if (detail.length > 0) {
      return `需要处理 ${detail}`;
    }
    return `需要处理 ${label}`;
  }

  return label;
}

function WorkspaceUserFlowStepIcon({ status }: { status: WorkspaceUserFlowStepStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  if (status === 'active') {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }
  if (status === 'paused') {
    return <Circle className="h-4 w-4 fill-current" />;
  }
  if (status === 'blocked') {
    return <Circle className="h-4 w-4 fill-current" />;
  }

  return <Circle className="h-4 w-4" />;
}

function materializeWorkspaceUserFlowTimelineNodes(steps: WorkspaceUserFlowStepList): WorkspaceUserFlowStepNodeList {
  const nodes: WorkspaceUserFlowStepNodeList = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (step === undefined) {
      continue;
    }

    const timelineText = getWorkspaceUserFlowTimelineText(step.status, step.label, step.detail);

    nodes.push(
      <li key={step.id} className={cn('flex min-w-0 items-center gap-2 text-[11px] leading-5', getWorkspaceUserFlowTimelineTextClassName(step.status))}>
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          <div
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
              getWorkspaceUserFlowStepClassName(step.status),
            )}
            title={timelineText}
          >
            <WorkspaceUserFlowStepIcon status={step.status} />
          </div>
        </div>
        <span className="min-w-0 truncate font-medium" title={timelineText}>{timelineText}</span>
      </li>,
    );
  }

  return nodes;
}

function WorkspaceUserFlowProgress({
  messages,
  planSelectionReady,
  selectedPlanId,
  isPlanning,
  isGenerating,
  engineeringState,
}: {
  messages: WorkspaceChatMessagesProps['messages'];
  planSelectionReady: boolean;
  selectedPlanId: string | null;
  isPlanning: boolean;
  isGenerating: boolean;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const steps = buildWorkspaceUserFlowSteps({
    messages,
    planSelectionReady,
    selectedPlanId,
    isPlanning,
    isGenerating,
    engineeringState,
  });
  const activeStep = getWorkspaceUserFlowActiveStep(steps);
  const toggleLabel = isCollapsed === true ? '展开完整流程' : '收起流程';
  const activeStepTimelineText = getWorkspaceUserFlowTimelineText(activeStep.status, activeStep.label, activeStep.detail);

  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="workspace-user-flow-progress"
      className="border-b bg-gradient-to-r from-background via-muted/20 to-background px-3 py-2"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/80 px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border', getWorkspaceUserFlowStepClassName(activeStep.status))}>
            <WorkspaceUserFlowStepIcon status={activeStep.status} />
          </div>
          <div className="min-w-0">
            <div className={cn('truncate text-sm font-semibold', getWorkspaceUserFlowTimelineTextClassName(activeStep.status))}>
              {activeStepTimelineText}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 text-xs"
          onClick={() => setIsCollapsed((current) => !current)}
        >
          {toggleLabel}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isCollapsed === false && 'rotate-180')} />
        </Button>
      </div>
      {isCollapsed === false && (
        <div className="mt-2 overflow-hidden rounded-lg border bg-background/60 px-3 py-2">
          <ol className="min-w-0 space-y-1">
            {materializeWorkspaceUserFlowTimelineNodes(steps)}
          </ol>
        </div>
      )}
    </section>
  );
}

function formatChatScrollSnapshotTitle(snapshot: ChatScrollSnapshot) {
  switch (snapshot.status) {
    case 'empty_messages':
      return '聊天滚动等待首条消息';
    case 'following_latest':
      return '聊天滚动正在跟随最新输出';
    case 'paused_by_user':
      return '聊天滚动已暂停自动跟随';
    case 'restored_to_latest':
      return '聊天滚动已恢复到最新输出';
    case 'container_missing':
      return '聊天滚动容器暂不可用';
    default:
      return '聊天滚动状态待确认';
  }
}

function getChatScrollSnapshotClassName(snapshot: ChatScrollSnapshot) {
  if (snapshot.status === 'container_missing') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'paused_by_user') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'following_latest' || snapshot.status === 'restored_to_latest') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function WorkspaceEngineeringStatusStrip({
  compact,
  engineeringState,
}: {
  compact?: boolean;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
}) {
  const execution = getWorkspaceChatEngineeringExecutionState(engineeringState);
  const statusLabel = buildWorkflowStatusLabel(engineeringState);
  const hasExecution = execution !== undefined;
  const hasStatusLabel = statusLabel !== undefined;
  if (hasExecution === false || hasStatusLabel === false) return null;

  const currentTask = getWorkspaceChatEngineeringTextValue(execution.current_task);
  const hasCurrentTask = hasWorkspaceChatEngineeringTextValue(currentTask);
  const pauseReason = getWorkspaceChatEngineeringTextValue(execution.pause_reason);
  const hasPauseReason = hasWorkspaceChatEngineeringTextValue(pauseReason);
  const workflow = getWorkspaceChatEngineeringWorkflowState(engineeringState);
  const approvalBoundary = getWorkspaceChatEngineeringApprovalBoundary({
    workflow,
    execution,
  });
  const hasApprovalBoundary = hasWorkspaceChatEngineeringTextValue(approvalBoundary);
  const approvalSource = getWorkspaceChatEngineeringTextValue(execution.approval_source);
  const hasApprovalSource = hasWorkspaceChatEngineeringTextValue(approvalSource);
  const approvalScope = getWorkspaceChatEngineeringTextValue(execution.approval_scope);
  const hasApprovalScope = hasWorkspaceChatEngineeringTextValue(approvalScope);
  const nextAction = getWorkspaceChatEngineeringTextValue(execution.next_action);
  const hasNextAction = hasWorkspaceChatEngineeringTextValue(nextAction);

  const tone = hasPauseReason === true
    ? 'border-destructive/30 bg-destructive/5 text-destructive'
    : execution.awaiting_confirmation === true
      ? 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-primary/20 bg-primary/5 text-primary';

  return (
    <div className={cn('rounded-lg border px-3 py-2', tone)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-background/60 text-[10px]">
          {statusLabel}
        </Badge>
        {hasCurrentTask === true && (
          <span className="font-medium">当前任务：{currentTask}</span>
        )}
        {hasPauseReason === true && (
          <span>暂停原因：{formatWorkspaceExecutionPauseReason(pauseReason)}</span>
        )}
        {hasApprovalBoundary === true && (
          <span>确认边界：{formatWorkspaceApprovalBoundary(approvalBoundary)}</span>
        )}
        {hasApprovalSource === true && (
          <span>确认来源：{approvalSource}</span>
        )}
      </div>
      {hasApprovalScope === true && (
        <div className="mt-1 text-muted-foreground">
          自动推进范围：{approvalScope}
        </div>
      )}
      {hasNextAction === true && (
        <div className="mt-1 text-muted-foreground">
          下一步：{nextAction}
        </div>
      )}
    </div>
  );
}

function WorkspacePhaseSnapshotStrip({
  compact,
  engineeringState,
}: {
  compact?: boolean;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
}) {
  const phase = getWorkspaceChatEngineeringPhaseState(engineeringState);
  const execution = getWorkspaceChatEngineeringExecutionState(engineeringState);
  const workflow = getWorkspaceChatEngineeringWorkflowState(engineeringState);
  const currentPhase = getWorkspaceChatEngineeringCurrentPhase(phase, workflow, '');
  const hasCurrentPhase = hasWorkspaceChatEngineeringTextValue(currentPhase);
  const currentTask = getWorkspaceChatEngineeringCurrentTask(phase, execution);
  const hasCurrentTask = hasWorkspaceChatEngineeringTextValue(currentTask);
  const nextAction = getWorkspaceChatEngineeringNextAction(phase, execution);
  const hasNextAction = hasWorkspaceChatEngineeringTextValue(nextAction);
  const completedTasks = getWorkspaceChatEngineeringPhaseTasks(phase);
  const hasCompletedTasks = completedTasks.length > 0;
  const blockers = getWorkspaceChatEngineeringPhaseBlockers(phase);
  const hasBlockers = blockers.length > 0;
  const phaseStatus = getWorkspaceChatEngineeringPhaseStatus(phase);
  const phaseStatusLabel = getWorkspaceChatEngineeringPhaseStatusLabel(phase);
  const hasPhaseStatusLabel = hasWorkspaceChatEngineeringTextValue(phaseStatusLabel);
  const tone = getPhaseSnapshotTone(phaseStatus, hasBlockers);
  const shouldRenderPhaseSnapshot = shouldRenderWorkspaceChatPhaseSnapshot({
    hasCurrentPhase,
    hasCurrentTask,
    hasNextAction,
    hasCompletedTasks,
    hasBlockers,
  });
  const shouldRenderPhaseLists = shouldRenderWorkspaceChatPhaseLists(hasCompletedTasks, hasBlockers);
  const phaseListLimit = getWorkspaceChatPhaseListLimit(compact);

  if (shouldRenderPhaseSnapshot === false) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border px-3 py-2', tone)}>
      <div className="flex flex-wrap items-center gap-2">
        {hasCurrentPhase === true && (
          <Badge variant="secondary" className="bg-background/60 text-[10px]">
            {currentPhase}
          </Badge>
        )}
        {hasPhaseStatusLabel === true && (
          <Badge variant="outline" className="bg-background/60 text-[10px]">
            {phaseStatusLabel}
          </Badge>
        )}
        {hasCurrentTask === true && (
          <span className="font-medium text-foreground">当前任务：{currentTask}</span>
        )}
      </div>

      {shouldRenderPhaseLists === true && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {hasCompletedTasks === true && (
            <div className="rounded-md bg-emerald-500/10 px-2 py-1.5 text-emerald-700 dark:text-emerald-300">
              <div className="font-medium">已完成</div>
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                {materializeWorkspaceChatPhaseItemNodes({
                  items: completedTasks,
                  limit: phaseListLimit,
                })}
              </div>
            </div>
          )}
          {hasBlockers === true && (
            <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
              <div className="font-medium">阻塞项</div>
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                {materializeWorkspaceChatPhaseItemNodes({
                  items: blockers,
                  limit: phaseListLimit,
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {hasNextAction === true && (
        <div className="mt-2 text-muted-foreground">
          下一步：{nextAction}
        </div>
      )}
    </div>
  );
}

function WorkspaceChatMessageStateSummary({
  compact,
  engineeringState,
  chatScrollSnapshot,
}: {
  compact?: boolean;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  chatScrollSnapshot: ChatScrollSnapshot;
}) {
  const execution = getWorkspaceChatEngineeringExecutionState(engineeringState);
  const phase = getWorkspaceChatEngineeringPhaseState(engineeringState);
  const workflow = getWorkspaceChatEngineeringWorkflowState(engineeringState);
  const workflowStatusLabel = getWorkspaceChatWorkflowSummaryStatusLabel(engineeringState);
  const phaseStatusLabel = getWorkspaceChatEngineeringPhaseSummaryStatusLabel(phase);
  const currentPhase = getWorkspaceChatEngineeringCurrentPhase(phase, workflow, '无阶段');
  const executionPauseReason = getWorkspaceChatEngineeringExecutionPauseReason(execution);
  const hasExecutionPauseReason = hasWorkspaceChatEngineeringTextValue(executionPauseReason);
  const hasExecutionAwaitingConfirmation = hasWorkspaceChatEngineeringExecutionAwaitingConfirmation(execution);
  const hasPhaseFailed = hasWorkspaceChatPhaseStatus(phase, 'failed');
  const phaseBlockers = getWorkspaceChatEngineeringPhaseBlockers(phase);
  const hasPhaseBlockers = phaseBlockers.length > 0;
  const hasPhasePending = hasWorkspaceChatPhaseStatus(phase, 'pending');
  const hasPhasePassed = hasWorkspaceChatPhaseStatus(phase, 'passed');
  const hasChatScrollContainerMissing = chatScrollSnapshot.status === 'container_missing';
  const hasChatScrollPausedByUser = chatScrollSnapshot.status === 'paused_by_user';
  const hasChatScrollFollowingLatest = hasWorkspaceChatScrollFollowingLatest(chatScrollSnapshot);
  const containerTextClassName = getWorkspaceChatMessageStateSummaryContainerTextClassName(compact);
  const chatScrollDistanceLabel = getWorkspaceChatScrollDistanceLabel(chatScrollSnapshot.distanceToBottom);
  const messageStateSummary = resolveWorkspaceChatStateSummaryRules([
    { active: hasExecutionPauseReason, tone: 'danger', autoOpen: true },
    { active: hasPhaseFailed, tone: 'danger', autoOpen: true },
    { active: hasPhaseBlockers, tone: 'danger', autoOpen: true },
    { active: hasChatScrollContainerMissing, tone: 'danger', autoOpen: true },
    { active: hasExecutionAwaitingConfirmation, tone: 'warning', autoOpen: true },
    { active: hasPhasePending, tone: 'warning' },
    { active: hasChatScrollPausedByUser, tone: 'warning', autoOpen: true },
    { active: hasPhasePassed, tone: 'success' },
    { active: hasChatScrollFollowingLatest, tone: 'success' },
  ]);

  return (
    <WorkspaceChatStateSummaryDisclosure
      testId="workspace-chat-message-state-summary"
      title="消息区状态汇总"
      facts={[
        <>Workflow: {workflowStatusLabel}</>,
        <>Phase: {currentPhase}</>,
        <>PhaseStatus: {phaseStatusLabel}</>,
        <>Scroll: {chatScrollSnapshot.status}</>,
        <>Messages: {chatScrollSnapshot.messageCount}</>,
      ]}
      description="展开查看 workflow、phase 和 scroll 的完整结构化状态与恢复建议。"
      tone={messageStateSummary.tone}
      shouldOpen={messageStateSummary.shouldOpen}
      toneTarget="summary"
      containerClassName={cn('app-debug-only border-b bg-muted/20 px-3 py-2', containerTextClassName)}
      summaryClassName="rounded-lg border px-3 py-2"
    >
        <WorkspaceEngineeringStatusStrip compact={compact} engineeringState={engineeringState} />
        <WorkspacePhaseSnapshotStrip compact={compact} engineeringState={engineeringState} />
        <div
          role="status"
          aria-live="polite"
          data-testid="workspace-chat-scroll-snapshot"
          className={cn('rounded-lg border px-3 py-2', getChatScrollSnapshotClassName(chatScrollSnapshot))}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{formatChatScrollSnapshotTitle(chatScrollSnapshot)}</span>
            <span>Phase: {chatScrollSnapshot.status}</span>
            <span>Source: {chatScrollSnapshot.source}</span>
            <span>Messages: {chatScrollSnapshot.messageCount}</span>
            <span>Distance: {chatScrollDistanceLabel}</span>
            <span>Updated: {chatScrollSnapshot.updatedAt}</span>
          </div>
          <p className="mt-1">{chatScrollSnapshot.message}</p>
          <p className="mt-1 opacity-80">恢复建议：{chatScrollSnapshot.recovery}</p>
        </div>
    </WorkspaceChatStateSummaryDisclosure>
  );
}

export function WorkspaceChatComposer({
  compact,
  textareaRef,
  input,
  chatInputSnapshot,
  planSelectionPending,
  attachedFiles,
  chatAttachmentSnapshot,
  chatMode,
  chatModeSnapshot,
  models,
  selectedModel,
  chatModelRegistrySnapshot,
  isOnline,
  isBusyGenerating,
  isStopConfirming,
  stopGenerationConfirmationSnapshot,
  setInput,
  adjustTextareaHeight,
  handleKeyDown,
  handleImagePaste,
  removeAttachment,
  setChatMode,
  setSelectedModel,
  toggleOnline,
  handleFileUpload,
  handleStopGenerate,
  handleCancelStopGenerate,
  handleGenerate,
  foundationStatusLabel,
}: WorkspaceChatComposerProps) {
  const [pendingAttachmentRemovalIndex, setPendingAttachmentRemovalIndex] = useState<number | null>(null);
  const [isAttachmentRemovalConfirming, setIsAttachmentRemovalConfirming] = useState(false);
  const pendingAttachmentRemoval = getWorkspaceChatPendingAttachmentRemoval(
    attachedFiles,
    pendingAttachmentRemovalIndex,
  );
  const attachmentRemovalConfirmationSnapshot = buildAttachmentRemovalConfirmationSnapshot({
    isOpen: pendingAttachmentRemovalIndex !== null,
    isConfirming: isAttachmentRemovalConfirming,
    attachment: pendingAttachmentRemoval,
    attachmentIndex: pendingAttachmentRemovalIndex,
    attachmentCount: attachedFiles.length,
  });
  const isCompact = compact === true;
  const promptValue = input.trim();
  const hasPrompt = promptValue.length > 0;
  const hasAttachments = attachedFiles.length > 0;
  const selectedModelSupportsVision = workspaceChatSelectedModelSupportsVision(models, selectedModel);
  const visualInputBlocked = hasAttachments === true && selectedModelSupportsVision === false;
  const hasPlanSelectionPending = planSelectionPending === true;
  const canSendPrompt = canSendWorkspaceChatComposerPrompt({
    hasPlanSelectionPending,
    hasContent: hasPrompt || hasAttachments,
    visualInputBlocked,
  });
  const isOnlineMode = isOnline === true;
  const isOfflineMode = isOnlineMode === false;
  const isGenerating = isBusyGenerating === true;
  const hasStopConfirming = isStopConfirming === true;
  const shouldRenderStopAction = shouldRenderWorkspaceChatComposerStopAction(isGenerating);
  const shouldRenderSendAction = shouldRenderWorkspaceChatComposerSendAction(isGenerating);
  const stopActionVariant = getWorkspaceChatComposerStopActionVariant(hasStopConfirming);
  const stopActionMinWidthClassName = getWorkspaceChatComposerStopActionMinWidthClassName(isCompact);
  const actionMinWidthClassName = getWorkspaceChatComposerActionMinWidthClassName(isCompact);
  const stopActionLabel = getWorkspaceChatComposerStopActionLabel({
    hasStopConfirming,
    isCompact,
  });
  const stopActionToneClassName = getWorkspaceChatComposerStopActionToneClassName(hasStopConfirming);
  const stopActionAnimationClassName = getWorkspaceChatComposerStopActionAnimationClassName(hasStopConfirming);
  const shouldDisableStopAction = shouldDisableWorkspaceChatComposerStopAction({
    hasStopConfirming,
    canConfirmStop: stopGenerationConfirmationSnapshot.canConfirm,
  });
  const shouldRenderOnlineStatus = isOnlineMode === true;
  const shouldRenderOfflineFoundationStatus = shouldRenderWorkspaceChatComposerOfflineFoundationStatus({
    isOfflineMode,
    isCompact,
  });
  const shouldRenderExpandedFoundationStatus = shouldRenderWorkspaceChatComposerExpandedFoundationStatus(isCompact);
  const onlineButtonTitle = getWorkspaceChatComposerOnlineButtonTitle({
    isCompact,
    isOnlineMode,
  });
  const uploadButtonTitle = getWorkspaceChatComposerUploadButtonTitle(isCompact);
  const onlineStatusClassName = getWorkspaceChatComposerOnlineStatusClassName(isCompact);
  const onlineIconClassName = getWorkspaceChatComposerOnlineIconClassName(isCompact);
  const onlineLabelClassName = getWorkspaceChatComposerOnlineLabelClassName(isCompact);
  const attachmentListClassName = getWorkspaceChatComposerAttachmentListClassName(isCompact);
  const attachmentBadgeClassName = getWorkspaceChatComposerAttachmentBadgeClassName(isCompact);
  const attachmentNameClassName = getWorkspaceChatComposerAttachmentNameClassName(isCompact);
  const attachmentRemoveClassName = getWorkspaceChatComposerAttachmentRemoveClassName(isCompact);
  const composerContainerClassName = getWorkspaceChatComposerContainerClassName(isCompact);
  const inputRowClassName = getWorkspaceChatComposerInputRowClassName(isCompact);
  const inputPlaceholder = getWorkspaceChatComposerInputPlaceholder(hasPlanSelectionPending);
  const textareaClassName = getWorkspaceChatComposerTextareaClassName(isCompact);
  const popoverContentClassName = getWorkspaceChatComposerPopoverContentClassName(isCompact);
  const modelPopoverContentClassName = getWorkspaceChatComposerModelPopoverContentClassName(isCompact);
  const discussModeButtonKey = getWorkspaceChatComposerModeButtonKey({ isCompact, mode: 'discuss' });
  const implementModeButtonKey = getWorkspaceChatComposerModeButtonKey({ isCompact, mode: 'implement' });
  const transitionClassName = getWorkspaceChatComposerTransitionClassName(isCompact);
  const discussModeButtonToneClassName = getWorkspaceChatComposerModeButtonToneClassName({
    chatMode,
    mode: 'discuss',
  });
  const implementModeButtonToneClassName = getWorkspaceChatComposerModeButtonToneClassName({
    chatMode,
    mode: 'implement',
  });
  const modelEmptyStateClassName = getWorkspaceChatComposerModelEmptyStateClassName(isCompact);
  const onlineButtonModeClassName = getWorkspaceChatComposerOnlineButtonModeClassName(isOnlineMode);
  const hasInputStopConfirmation = chatInputSnapshot.status === 'stop_confirmation';
  const hasModelLoadFailed = chatModelRegistrySnapshot.status === 'load_failed';
  const hasModeStopConfirmation = chatModeSnapshot.status === 'stop_confirmation';
  const hasInputPlanning = chatInputSnapshot.status === 'planning';
  const hasInputGenerating = chatInputSnapshot.status === 'generating';
  const hasInputPlanSelectionRequired = chatInputSnapshot.status === 'plan_selection_required';
  const hasBusyInputSnapshot = hasWorkspaceChatBusyInputSnapshot({
    hasInputPlanning,
    hasInputGenerating,
    hasInputPlanSelectionRequired,
  });
  const hasModelLoading = chatModelRegistrySnapshot.status === 'loading';
  const hasModelEmpty = chatModelRegistrySnapshot.status === 'empty';
  const shouldRenderModelList = shouldRenderWorkspaceChatComposerModelList(models);
  const shouldRenderModelEmptyState = shouldRenderWorkspaceChatComposerModelEmptyState(models);
  const modelEmptyStateLabel = getWorkspaceChatComposerModelEmptyStateLabel(isCompact);
  const providerOptions = materializeWorkspaceChatComposerProviderOptions(models);
  const firstProviderId = getWorkspaceChatComposerFirstProviderId(providerOptions);
  const selectedProviderId = getWorkspaceChatComposerSelectedProviderId({
    models,
    selectedModel,
    fallbackProviderId: firstProviderId,
  });
  const [activeProviderId, setActiveProviderId] = useState(selectedProviderId);
  useEffect(() => {
    setActiveProviderId(selectedProviderId);
  }, [selectedProviderId]);
  const effectiveActiveProviderId = activeProviderId.length > 0 ? activeProviderId : selectedProviderId;
  const providerNodes = materializeWorkspaceChatComposerProviderNodes({
    providers: providerOptions,
    activeProviderId: effectiveActiveProviderId,
    transitionClassName,
    setActiveProviderId,
  });
  const modelNodes = materializeWorkspaceChatComposerModelNodes({
    models,
    selectedModel,
    transitionClassName,
    setSelectedModel,
    activeProviderId: effectiveActiveProviderId,
  });
  const shouldRenderModelColumn = shouldRenderWorkspaceChatComposerModelColumn(modelNodes);
  const hasAttachmentPickerEmpty = chatAttachmentSnapshot.status === 'picker_empty';
  const hasAttachmentRejected = chatAttachmentSnapshot.status === 'rejected';
  const hasModePlanning = chatModeSnapshot.status === 'planning';
  const hasModeGenerating = chatModeSnapshot.status === 'generating';
  const hasBusyModeSnapshot = hasWorkspaceChatBusyModeSnapshot(hasModePlanning, hasModeGenerating);
  const shouldRenderAttachedFiles = shouldRenderWorkspaceChatAttachedFiles(attachedFiles);
  const shouldRenderStopConfirmation = shouldRenderWorkspaceChatStopConfirmation(isStopConfirming);
  const requestAttachmentRemoval = (index: number) => {
    setPendingAttachmentRemovalIndex(index);
  };
  const closeAttachmentRemovalConfirmation = (nextOpen: boolean) => {
    if (nextOpen === false && isAttachmentRemovalConfirming === true) return;
    if (nextOpen === false) {
      setPendingAttachmentRemovalIndex(null);
    }
  };
  const confirmAttachmentRemoval = () => {
    if (
      attachmentRemovalConfirmationSnapshot.canConfirm !== true ||
      pendingAttachmentRemovalIndex === null
    ) return;
    setIsAttachmentRemovalConfirming(true);
    try {
      removeAttachment(pendingAttachmentRemovalIndex);
      setPendingAttachmentRemovalIndex(null);
    } finally {
      setIsAttachmentRemovalConfirming(false);
    }
  };
  const composerStateSummary = resolveWorkspaceChatStateSummaryRules([
    { active: hasInputStopConfirmation, tone: 'danger', autoOpen: true },
    { active: hasModelLoadFailed, tone: 'danger', autoOpen: true },
    { active: hasModeStopConfirmation, tone: 'danger', autoOpen: true },
    { active: hasBusyInputSnapshot, tone: 'warning' },
    { active: hasModelLoading, tone: 'warning' },
    { active: hasModelEmpty, tone: 'warning', autoOpen: true },
    { active: hasAttachmentRejected, tone: 'danger', autoOpen: true },
    { active: hasAttachmentPickerEmpty, tone: 'warning', autoOpen: true },
    { active: hasBusyModeSnapshot, tone: 'warning' },
  ]);
  const canSendLabel = getWorkspaceChatComposerSnapshotBooleanLabel(chatInputSnapshot.canSend);
  const defaultModelLabel = getWorkspaceChatComposerSnapshotLabel(chatModelRegistrySnapshot.defaultModel, 'none');
  const lastFileNameLabel = getWorkspaceChatComposerSnapshotLabel(chatAttachmentSnapshot.lastFileName, 'none');
  const onlineLabel = getWorkspaceChatComposerSnapshotOnlineLabel(chatModeSnapshot.isOnline);
  const busyLabel = getWorkspaceChatComposerSnapshotBooleanLabel(chatModeSnapshot.isBusy);

  return (
    <div className={cn('shrink-0 border-t bg-background', composerContainerClassName)}>
      <WorkspaceChatStateSummaryDisclosure
        testId="workspace-chat-composer-state-summary"
        title="Composer 状态汇总"
        facts={[
          <>Input: {chatInputSnapshot.status}</>,
          <>Model: {chatModelRegistrySnapshot.status}</>,
          <>Attachment: {chatAttachmentSnapshot.status}</>,
          <>Mode: {chatModeSnapshot.status}</>,
          <>CanSend: {canSendLabel}</>,
          <>Online: {onlineLabel}</>,
        ]}
        description="展开查看输入、模型、附件和模式的完整 Phase/Source/Recovery 子快照。"
        tone={composerStateSummary.tone}
        shouldOpen={composerStateSummary.shouldOpen}
        toneTarget="container"
        containerClassName="app-debug-only mb-2 rounded-lg border px-3 py-2 text-xs"
      >
          <div
            role="status"
            aria-live="polite"
            data-testid="workspace-chat-input-snapshot"
            className={cn('rounded-lg border px-3 py-2', getChatInputSnapshotClassName(chatInputSnapshot))}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{formatChatInputSnapshotTitle(chatInputSnapshot)}</span>
              <span>Phase: {chatInputSnapshot.status}</span>
              <span>Source: {chatInputSnapshot.source}</span>
              <span>CanSend: {canSendLabel}</span>
              <span>Prompt: {chatInputSnapshot.promptLength}</span>
              <span>Attachments: {chatInputSnapshot.attachmentCount}</span>
              <span>Model: {chatInputSnapshot.selectedModel}</span>
              <span>Models: {chatInputSnapshot.modelCount}</span>
              <span>Updated: {chatInputSnapshot.updatedAt}</span>
            </div>
            <p className="mt-1">{chatInputSnapshot.message}</p>
            <p className="mt-1 opacity-80">恢复建议：{chatInputSnapshot.recovery}</p>
          </div>

          <div
            role="status"
            aria-live="polite"
            data-testid="workspace-chat-model-registry-snapshot"
            className={cn('rounded-lg border px-3 py-2', getChatModelRegistrySnapshotClassName(chatModelRegistrySnapshot))}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{formatChatModelRegistrySnapshotTitle(chatModelRegistrySnapshot)}</span>
              <span>Phase: {chatModelRegistrySnapshot.status}</span>
              <span>Source: {chatModelRegistrySnapshot.source}</span>
              <span>Models: {chatModelRegistrySnapshot.modelCount}</span>
              <span>Selected: {chatModelRegistrySnapshot.selectedModel}</span>
              <span>Default: {defaultModelLabel}</span>
              <span>Updated: {chatModelRegistrySnapshot.updatedAt}</span>
            </div>
            <p className="mt-1">{chatModelRegistrySnapshot.message}</p>
            <p className="mt-1 opacity-80">恢复建议：{chatModelRegistrySnapshot.recovery}</p>
          </div>

          <div
            role="status"
            aria-live="polite"
            data-testid="workspace-chat-attachment-snapshot"
            className={cn('rounded-lg border px-3 py-2', getChatAttachmentSnapshotClassName(chatAttachmentSnapshot))}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{formatChatAttachmentSnapshotTitle(chatAttachmentSnapshot)}</span>
              <span>Phase: {chatAttachmentSnapshot.status}</span>
              <span>Source: {chatAttachmentSnapshot.source}</span>
              <span>Files: {chatAttachmentSnapshot.attachmentCount}</span>
              <span>Total: {formatAttachmentSize(chatAttachmentSnapshot.totalSize)}</span>
              <span>Last: {lastFileNameLabel}</span>
              <span>Updated: {chatAttachmentSnapshot.updatedAt}</span>
            </div>
            <p className="mt-1">{chatAttachmentSnapshot.message}</p>
            <p className="mt-1 opacity-80">恢复建议：{chatAttachmentSnapshot.recovery}</p>
          </div>

          <div
            role="status"
            aria-live="polite"
            data-testid="workspace-chat-mode-snapshot"
            className={cn('rounded-lg border px-3 py-2', getChatModeSnapshotClassName(chatModeSnapshot))}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{formatChatModeSnapshotTitle(chatModeSnapshot)}</span>
              <span>Phase: {chatModeSnapshot.status}</span>
              <span>Source: {chatModeSnapshot.source}</span>
              <span>Mode: {chatModeSnapshot.chatMode}</span>
              <span>Online: {onlineLabel}</span>
              <span>Busy: {busyLabel}</span>
              <span>基础设定: {chatModeSnapshot.foundationStatusLabel}</span>
              <span>Updated: {chatModeSnapshot.updatedAt}</span>
            </div>
            <p className="mt-1">{chatModeSnapshot.message}</p>
            <p className="mt-1 opacity-80">恢复建议：{chatModeSnapshot.recovery}</p>
          </div>
      </WorkspaceChatStateSummaryDisclosure>

      {shouldRenderAttachedFiles === true && (
        <div className={cn('mb-2 flex flex-wrap', attachmentListClassName)}>
          {materializeWorkspaceChatComposerAttachmentNodes({
            attachedFiles,
            attachmentBadgeClassName,
            attachmentNameClassName,
            attachmentRemoveClassName,
            requestAttachmentRemoval,
          })}
        </div>
      )}
      {hasAttachmentRejected === true && (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {chatAttachmentSnapshot.message}
        </p>
      )}
      {visualInputBlocked === true && (
        <p role="alert" className="mb-2 text-xs text-amber-700 dark:text-amber-300">
          当前模型不支持图片输入。请选择标记为支持视觉的模型后再发送。
        </p>
      )}
      <AlertDialog open={pendingAttachmentRemovalIndex !== null} onOpenChange={closeAttachmentRemovalConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除这个待发送附件？</AlertDialogTitle>
            <AlertDialogDescription>
              该操作只会从当前输入区移除附件，不会删除本地文件、项目文件或已经发送的消息。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AttachmentRemovalConfirmationSnapshotStrip snapshot={attachmentRemovalConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={attachmentRemovalConfirmationSnapshot.canCancel === false}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={attachmentRemovalConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (attachmentRemovalConfirmationSnapshot.canConfirm === true) {
                  confirmAttachmentRemoval();
                }
              }}
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className={inputRowClassName}>
        <Textarea
          ref={textareaRef}
          placeholder={inputPlaceholder}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handleImagePaste}
          className={textareaClassName}
          rows={3}
        />
      </div>

      <div className="mt-2 flex items-center justify-between border-t pt-2">
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Bot className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className={cn('p-1', popoverContentClassName)} align="start">
              <div className="space-y-1">
                <button
                  key={discussModeButtonKey}
                  onClick={() => setChatMode('discuss')}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm',
                    transitionClassName,
                    discussModeButtonToneClassName,
                  )}
                >
                  探讨
                </button>
                <button
                  key={implementModeButtonKey}
                  onClick={() => setChatMode('implement')}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm',
                    transitionClassName,
                    implementModeButtonToneClassName,
                  )}
                >
                  实现
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button data-testid="workspace-chat-model-trigger" variant="ghost" size="icon" className="h-8 w-8">
                <Cpu className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className={cn('p-2', modelPopoverContentClassName)} align="start">
              <div className="min-h-[12rem]">
                {shouldRenderModelList === true && (
                  <div className="grid grid-cols-[minmax(8rem,0.42fr)_minmax(0,0.58fr)] gap-2">
                    <div className="space-y-1 border-r pr-2">
                      <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">Provider</div>
                      {providerNodes}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">模型</div>
                      {shouldRenderModelColumn === true ? modelNodes : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">该 Provider 暂无可选模型</div>
                      )}
                    </div>
                  </div>
                )}
                {shouldRenderModelEmptyState === true && (
                  <div className={cn('px-3 py-2 text-muted-foreground', modelEmptyStateClassName)}>
                    {modelEmptyStateLabel}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', onlineButtonModeClassName)}
            title={onlineButtonTitle}
            onClick={toggleOnline}
          >
            <Globe className="w-4 h-4" />
          </Button>

          <label>
            <input data-testid="workspace-chat-image-input" type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={handleFileUpload} />
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" title={uploadButtonTitle} asChild>
              <span><Upload className="w-4 h-4" /></span>
            </Button>
          </label>
        </div>

        {shouldRenderStopAction === true && (
          <Button
            onClick={handleStopGenerate}
            variant={stopActionVariant}
            size="sm"
            className={cn(
              stopActionMinWidthClassName,
              stopActionToneClassName,
              stopActionAnimationClassName,
            )}
            disabled={shouldDisableStopAction}
          >
            <Square className="mr-1 h-4 w-4" />
            {stopActionLabel}
          </Button>
        )}
        {shouldRenderSendAction === true && (
          <Button
            data-testid="workspace-chat-send"
            onClick={handleGenerate}
            disabled={canSendPrompt === false}
            size="sm"
            className={actionMinWidthClassName}
          >
            <Send className="mr-1 h-4 w-4" />
            发送
          </Button>
        )}
      </div>

      {shouldRenderOnlineStatus === true && (
        <div className={cn('mt-2 flex items-center', onlineStatusClassName)}>
          <Wifi className={cn('w-3 h-3', onlineIconClassName)} />
          <span className={onlineLabelClassName}>联网</span>
          {shouldRenderExpandedFoundationStatus === true && <span className="text-muted-foreground">基础设定: {foundationStatusLabel}</span>}
        </div>
      )}

      {shouldRenderOfflineFoundationStatus === true && (
        <div className="mt-2 text-xs text-muted-foreground">
          基础设定: {foundationStatusLabel}
        </div>
      )}

      {shouldRenderStopConfirmation === true && (
        compact ? (
          <div className="mt-2 space-y-2">
            <StopGenerationConfirmationSnapshotStrip
              compact
              snapshot={stopGenerationConfirmationSnapshot}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full"
              disabled={stopGenerationConfirmationSnapshot.canCancel === false}
              onClick={handleCancelStopGenerate}
            >
              取消停止
            </Button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>再次点击“确认停止”将终止当前 AI 生成；也可以取消并继续等待当前输出。</span>
            </div>
            <StopGenerationConfirmationSnapshotStrip snapshot={stopGenerationConfirmationSnapshot} />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={stopGenerationConfirmationSnapshot.canCancel === false}
                onClick={handleCancelStopGenerate}
              >
                取消停止
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export function WorkspaceChatPanel({
  header,
  messagesProps,
  composerProps,
  engineeringState,
}: WorkspaceChatPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {header}
      <WorkspaceUserFlowProgress
        messages={messagesProps.messages}
        planSelectionReady={messagesProps.planSelectionReady}
        selectedPlanId={messagesProps.selectedPlanId}
        isPlanning={messagesProps.isPlanning}
        isGenerating={messagesProps.isGenerating}
        engineeringState={engineeringState}
      />
      <WorkspaceChatMessageStateSummary
        compact={messagesProps.compact}
        engineeringState={engineeringState}
        chatScrollSnapshot={messagesProps.chatScrollSnapshot}
      />
      <WorkspaceChatMessages {...messagesProps} />
      <WorkspaceChatComposer {...composerProps} />
    </div>
  );
}

export function WorkspaceDesktopChatHeader({
  onCollapse,
}: {
  onCollapse: () => void;
}) {
  return (
    <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">对话</span>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCollapse}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
    </div>
  );
}
