"use client";

import type { ReactNode } from "react";
import { Children, isValidElement, useEffect, useId, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  FilePenLine,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { GitCommit } from "@/lib/types";
import type {
  WorkspaceBootstrapState,
  WorkspaceEngineeringStateSnapshot,
  WorkspaceExecutionState,
  WorkspaceGateResult,
  WorkspacePhaseState,
  WorkspaceRecoveryState,
  WorkspaceValidationState,
  WorkspaceValidationFailureItem,
  WorkspaceWorkflowState,
} from "@/lib/workspace/engineering-state";
import {
  getWorkspaceWorkflowStageApprovalBoundary,
  getWorkspaceWorkflowStageAutoProgressEnabled,
} from "@/lib/workspace/workflow-contract";
import { buildEngineeringStatePanelSnapshot } from "@/app/workspace/workspace-engineering-state-panel-snapshot";
import type { ContextGateRepairTarget } from "@/app/workspace/context-gate-repair";
import { getContextGateRepairTargets } from "@/app/workspace/context-gate-repair";
import { buildChatMessageSnapshot } from "@/app/workspace/workspace-chat-message-snapshot";
import { buildChatThoughtProcessSnapshot } from "@/app/workspace/workspace-chat-thought-process-snapshot";
import {
  buildCodeBlockMessageRenderSnapshot,
  buildMermaidMessageRenderSnapshot,
  type CodeBlockCopyStatus,
} from "@/app/workspace/workspace-message-render-snapshot";
import { buildValidationGateBlockedSnapshot } from "@/app/workspace/workspace-validation-gate-blocked-snapshot";
import { buildWorkflowSectionSnapshot } from "@/app/workspace/workspace-workflow-section-snapshot";
import {
  deriveWorkspaceRecoveryActionSummary,
  WorkspaceGuidanceActions,
  type WorkspaceRecoveryActionSummary,
} from "@/app/workspace/workspace-guidance-actions";
import { buildCommitSummarySnapshot } from "@/app/workspace/workspace-commit-summary-snapshot";
import type {
  ChatMessageRole,
  ChatMessageSnapshot,
  ChatThoughtProcessSnapshot,
  ChatThoughtProcessSnapshotSource,
  CommitSummarySnapshot,
  EngineeringStatePanelSnapshot,
  GuidanceAction,
  MessageRenderSnapshot,
  ValidationGateBlockedSnapshot,
  WorkflowSectionKind,
  WorkflowSectionSnapshot,
  WorkflowSectionSnapshotSource,
  WorkspaceEditorNavigationTarget,
  WorkspaceSuggestedQuestionList,
} from "@/app/workspace/workspace-types";
import {
  formatWorkspaceClipboardError,
  formatWorkspaceMissingClipboardError,
} from "@/lib/workspace/workspace-clipboard-local-errors";
import { formatWorkspaceMermaidRenderError } from "@/lib/workspace/workspace-message-render-errors";

export type WorkspaceGuidanceAction = GuidanceAction;

export type WorkflowStepStatus = "pending" | "running" | "done" | "failed";

export type WorkflowStepMeta = {
  [fieldName: string]: unknown;
};

export type WorkflowStep = {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  status?: WorkflowStepStatus;
  meta?: WorkflowStepMeta;
};

type WorkflowStepSection = {
  kind: WorkflowSectionKind;
  steps: WorkflowStep[];
};

export type WorkspaceMessageLike = {
  role: ChatMessageRole;
  content: string;
  reasoningContent?: string;
  statusContent?: string;
  activeFileOperation?: string;
  workflowSteps?: WorkflowStep[];
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  gateResult?: WorkspaceGateResult;
  streaming?: boolean;
  suggestedQuestions?: WorkspaceSuggestedQuestionList;
  suggestedActions?: WorkspaceGuidanceAction[];
  relatedCommit?: GitCommit;
};

const FILE_OP_RUNNING_MIN_VISIBLE_MS = 1200;

function getWorkspaceChatSnapshotBooleanLabel(value: boolean): string {
  return value === true ? "yes" : "no";
}

function getWorkflowSectionKind(step: WorkflowStep): WorkflowSectionKind {
  if (step.id === "load-project-context" && typeof step.meta?.path !== "string") {
    return "other";
  }
  if (step.id === "prepare-runtime" && typeof step.meta?.command !== "string") {
    return "other";
  }
    switch (step.kind) {
      case "search_file":
      case "read_file":
      case "write_file":
      case "create_file":
      case "delete_file":
      case "rename_file":
      case "create_directory":
      case "delete_directory":
        return "file_ops";
      default:
        return "other";
    }
}

  function getWorkflowSectionMeta(kind: WorkflowSectionKind) {
  switch (kind) {
      case "file_ops":
        return {
          title: "文件操作",
          icon: FilePenLine,
        };
    default:
      return {
          title: "流程状态",
          icon: ClipboardList,
      };
  }
}

function getWorkflowStepLine(step: WorkflowStep) {
  const path = typeof step.meta?.path === "string" ? step.meta.path : "";
  const fromPath = typeof step.meta?.fromPath === "string" ? step.meta.fromPath : "";
  const toPath = typeof step.meta?.toPath === "string" ? step.meta.toPath : "";
  const status = step.status ?? "done";
  const hasPath = path.length > 0;
  const hasFromPath = fromPath.length > 0;
  const hasToPath = toPath.length > 0;

  switch (step.kind) {
    case "read_file":
    case "search_file":
      if (hasPath === false) return "";
      return status === "running" ? `正在读取 ${path}` : `已读取 ${path}`;
    case "create_file":
      if (hasPath === false) return "";
      if (status === "running") return `正在创建 ${path}`;
      if (status === "failed") return `创建 ${path} 失败`;
      return `已创建 ${path}`;
    case "write_file":
      if (hasPath === false) return "";
      if (status === "running") return `正在修改 ${path}`;
      if (status === "failed") return `修改 ${path} 失败`;
      return `已完成 ${path}`;
    case "delete_file":
      if (hasPath === false) return "";
      if (status === "running") return `正在删除 ${path}`;
      if (status === "failed") return `删除 ${path} 失败`;
      return `已删除 ${path}`;
    case "rename_file":
      if (hasFromPath === false || hasToPath === false) return "";
      if (status === "running") return `正在重命名 ${fromPath} -> ${toPath}`;
      if (status === "failed") return `重命名 ${fromPath} 失败`;
      return `已重命名 ${fromPath} -> ${toPath}`;
    case "create_directory":
      if (hasPath === false) return "";
      if (status === "running") return `正在创建目录 ${path}`;
      if (status === "failed") return `创建目录 ${path} 失败`;
      return `已创建目录 ${path}`;
    case "delete_directory":
      if (hasPath === false) return "";
      if (status === "running") return `正在删除目录 ${path}`;
      if (status === "failed") return `删除目录 ${path} 失败`;
      return `已删除目录 ${path}`;
  }

    switch (getWorkflowSectionKind(step)) {
      case "file_ops":
        return "";
      default:
        const detail = step.detail?.trim() ?? "";
        const hasDetail = detail.length > 0;
        if (hasDetail === true) return detail;

        const title = step.title.trim();
        const hasTitle = title.length > 0;
        if (hasTitle === true) {
          if (status === "running") return `正在${title}`;
          if (status === "failed") return `${title}失败`;
          return title;
        }
        return "";
    }
}

function getWorkflowStepPath(step: WorkflowStep) {
  if (typeof step.meta?.toPath === "string" && step.meta.toPath.trim().length > 0) {
    return step.meta.toPath;
  }
  return typeof step.meta?.path === "string" && step.meta.path.trim().length > 0
    ? step.meta.path
    : "";
}

function WorkflowStepStatusIcon({ step }: { step: WorkflowStep }) {
  if (step.status === "running") {
    return <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary" />;
  }

  if (step.status === "failed") {
    return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
  }

  return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
}

function getEngineeringStatusLabel(status?: string) {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "运行中";
    case "passed":
      return "已通过";
    case "failed":
      return "失败";
    case "not_applicable":
      return "不适用";
    default:
      return status ?? "未记录";
  }
}

function getBootstrapStatusLabel(status?: string) {
  switch (status) {
    case "not_started":
      return "未开始";
    case "classifying":
      return "分类中";
    case "collecting_decisions":
      return "决策收集中";
    case "awaiting_confirmation":
      return "待确认";
    case "documenting":
      return "文档整理中";
    case "completed":
      return "已完成";
    case "blocked":
      return "已阻断";
    default:
      return status ?? "未记录";
  }
}

function getFoundationRiskLabel(level?: string) {
  switch (level) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    default:
      return "";
  }
}

function getFoundationGateDecisionLabel(decision?: string) {
  switch (decision) {
    case "allow":
      return "允许";
    case "warn":
      return "警告";
    case "block":
      return "阻断";
    default:
      return "";
  }
}

type EngineeringStateRow = {
  label: string;
  statusLabel: string;
  detail: string;
};

function joinEngineeringStateDetail(parts: Array<string | undefined>) {
  let detail = "";
  for (const part of parts) {
    const text = getEngineeringStatePanelTextValue(part);
    const hasText = hasEngineeringStatePanelTextValue(text);
    if (hasText === false) {
      continue;
    }

    const hasDetail = detail.length > 0;
    if (hasDetail === true) {
      detail = `${detail} / ${text}`;
    } else {
      detail = text;
    }
  }

  return detail;
}

function hasEngineeringStateRow(statusLabel: string, detail: string) {
  const hasStatusLabel = statusLabel.length > 0;
  const hasDetail = detail.length > 0;
  return hasStatusLabel === true || hasDetail === true;
}

function appendEngineeringStateRow(rows: EngineeringStateRow[], row: EngineeringStateRow) {
  const shouldAppendRow = hasEngineeringStateRow(row.statusLabel, row.detail);
  if (shouldAppendRow === true) {
    rows.push(row);
  }
}

function getEngineeringStatePanelPhaseState(
  state: WorkspaceEngineeringStateSnapshot,
): WorkspacePhaseState | undefined {
  return state.phase;
}

function getEngineeringStatePanelExecutionState(
  state: WorkspaceEngineeringStateSnapshot,
): WorkspaceExecutionState | undefined {
  return state.execution;
}

function getEngineeringStatePanelWorkflowState(
  state: WorkspaceEngineeringStateSnapshot,
): WorkspaceWorkflowState | undefined {
  return state.workflow;
}

function getEngineeringStatePanelRecoveryState(
  state: WorkspaceEngineeringStateSnapshot,
): WorkspaceRecoveryState | undefined {
  return state.recovery;
}

function getEngineeringStatePanelValidationState(
  state: WorkspaceEngineeringStateSnapshot,
): WorkspaceValidationState | undefined {
  return state.validation;
}

function getEngineeringStatePanelBootstrapState(
  state: WorkspaceEngineeringStateSnapshot,
): WorkspaceBootstrapState | undefined {
  return state.bootstrap_state;
}

function getEngineeringStatePanelGateResult(
  bootstrapState: WorkspaceBootstrapState | undefined,
): WorkspaceGateResult | undefined {
  if (bootstrapState === undefined) {
    return undefined;
  }

  return bootstrapState.gate_result;
}

function getEngineeringStatePanelTextValue(value: string | undefined): string {
  if (value === undefined) {
    return "";
  }

  return value;
}

function hasEngineeringStatePanelTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getEngineeringStatePanelItemListLabel(items: string[]): string {
  let label = "";
  for (const item of items) {
    const text = getEngineeringStatePanelTextValue(item);
    const hasText = hasEngineeringStatePanelTextValue(text);
    if (hasText === false) {
      continue;
    }

    const hasLabel = label.length > 0;
    if (hasLabel === true) {
      label = `${label} / ${text}`;
    } else {
      label = text;
    }
  }

  return label;
}

function getEngineeringStatePanelPhaseCompletedTasks(phase: WorkspacePhaseState | undefined): string[] {
  if (phase === undefined) {
    return [];
  }

  if (Array.isArray(phase.completed_tasks) === false) {
    return [];
  }

  return phase.completed_tasks;
}

function getEngineeringStatePanelPhaseBlockers(phase: WorkspacePhaseState | undefined): string[] {
  if (phase === undefined) {
    return [];
  }

  if (Array.isArray(phase.blockers) === false) {
    return [];
  }

  return phase.blockers;
}

function getEngineeringStatePanelValidationFailureItems(
  validationState: WorkspaceValidationState | undefined,
): WorkspaceValidationFailureItem[] {
  if (validationState === undefined) {
    return [];
  }

  if (Array.isArray(validationState.failure_items) === false) {
    return [];
  }

  return validationState.failure_items;
}

function getEngineeringStatePanelBootstrapBlockers(
  bootstrapState: WorkspaceBootstrapState | undefined,
): string[] {
  if (bootstrapState === undefined) {
    return [];
  }

  if (Array.isArray(bootstrapState.blockers) === false) {
    return [];
  }

  return bootstrapState.blockers;
}

function getEngineeringStatePanelGateBlockingItems(gateResult: WorkspaceGateResult | undefined): string[] {
  if (gateResult === undefined) {
    return [];
  }

  if (Array.isArray(gateResult.blocking_items) === false) {
    return [];
  }

  return gateResult.blocking_items;
}

type EngineeringStatePanelNextActionInput = {
  gateNextAction: string;
  bootstrapNextAction: string;
};

function getEngineeringStatePanelRequiredDecisionCount(
  bootstrapState: WorkspaceBootstrapState | undefined,
): number | undefined {
  if (bootstrapState === undefined) {
    return undefined;
  }

  if (Array.isArray(bootstrapState.required_decisions) === false) {
    return undefined;
  }

  return bootstrapState.required_decisions.length;
}

function getEngineeringStatePanelFoundationRiskDetail(foundationRiskLevel: string): string {
  const hasFoundationRiskLevel = foundationRiskLevel.length > 0;
  if (hasFoundationRiskLevel === true) {
    return `风险 ${getFoundationRiskLabel(foundationRiskLevel)}`;
  }

  return "";
}

function getEngineeringStatePanelRequiredDecisionDetail(requiredDecisionCount: number | undefined): string {
  const hasRequiredDecisionCount = typeof requiredDecisionCount === "number";
  if (hasRequiredDecisionCount === true) {
    return `必决 ${requiredDecisionCount}`;
  }

  return "";
}

function getEngineeringStatePanelExecutionAutoProgressEnabled({
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

function getEngineeringStatePanelExecutionApprovalBoundary({
  workflow,
  execution,
}: {
  workflow: WorkspaceWorkflowState | undefined;
  execution: WorkspaceExecutionState | undefined;
}): string {
  const rawExecutionApprovalBoundary = execution === undefined ? undefined : execution.approval_boundary;
  const executionApprovalBoundary = getEngineeringStatePanelTextValue(rawExecutionApprovalBoundary);
  const hasExecutionApprovalBoundary = hasEngineeringStatePanelTextValue(executionApprovalBoundary);
  if (hasExecutionApprovalBoundary === true) {
    return executionApprovalBoundary;
  }

  if (workflow === undefined || workflow.stage === undefined) {
    return "";
  }

  const workflowApprovalBoundary = getWorkspaceWorkflowStageApprovalBoundary(workflow.stage);
  if (workflowApprovalBoundary === undefined) {
    return "";
  }

  return workflowApprovalBoundary;
}

function getEngineeringStatePanelExecutionStatusLabel({
  workflow,
  execution,
}: {
  workflow: WorkspaceWorkflowState | undefined;
  execution: WorkspaceExecutionState | undefined;
}): string {
  const hasExecutionAwaitingConfirmation = execution?.awaiting_confirmation === true;
  if (hasExecutionAwaitingConfirmation === true) {
    return "等待确认";
  }

  const hasExecutionAutoProgress = getEngineeringStatePanelExecutionAutoProgressEnabled({
    workflow,
    execution,
  });
  if (hasExecutionAutoProgress === true) {
    return "运行中";
  }

  return "";
}

function getEngineeringStatePanelExecutionAutoProgressDetail({
  workflow,
  execution,
}: {
  workflow: WorkspaceWorkflowState | undefined;
  execution: WorkspaceExecutionState | undefined;
}): string {
  const hasExecutionAutoProgress = getEngineeringStatePanelExecutionAutoProgressEnabled({
    workflow,
    execution,
  });
  if (hasExecutionAutoProgress === true) {
    return "自动推进已启用";
  }

  return "";
}

function getEngineeringStatePanelExecutionAwaitingConfirmationDetail(
  execution: WorkspaceExecutionState | undefined,
): string {
  const hasExecutionAwaitingConfirmation = execution?.awaiting_confirmation === true;
  if (hasExecutionAwaitingConfirmation === true) {
    return "等待确认";
  }

  return "";
}

function shouldRenderEngineeringStatePanelExecutionState({
  hasExecutionPauseReason,
  hasExecutionApprovalBoundary,
  hasExecutionNextAction,
}: {
  hasExecutionPauseReason: boolean;
  hasExecutionApprovalBoundary: boolean;
  hasExecutionNextAction: boolean;
}): boolean {
  if (hasExecutionPauseReason === true) {
    return true;
  }

  if (hasExecutionApprovalBoundary === true) {
    return true;
  }

  return hasExecutionNextAction === true;
}

function getEngineeringStatePanelRecoveryStageLabel(recovery: WorkspaceRecoveryState | undefined): string {
  const recoveryResumeStage = getEngineeringStatePanelTextValue(recovery?.resume_stage);
  const recoveryResumeMode = getEngineeringStatePanelTextValue(recovery?.resume_mode);
  return joinEngineeringStateDetail([recoveryResumeStage, recoveryResumeMode]);
}

function getEngineeringStatePanelRecoveryActionCount(
  recoveryActionSummary: WorkspaceRecoveryActionSummary | undefined,
): number {
  if (recoveryActionSummary === undefined) {
    return 0;
  }

  return recoveryActionSummary.actionCount;
}

function shouldRenderEngineeringStatePanelRecoveryActions(
  recoveryActionSummary: WorkspaceRecoveryActionSummary | undefined,
): recoveryActionSummary is WorkspaceRecoveryActionSummary {
  const recoveryActionCount = getEngineeringStatePanelRecoveryActionCount(recoveryActionSummary);
  const hasRecoveryActions = recoveryActionCount > 0;
  return hasRecoveryActions === true;
}

function shouldRenderEngineeringStatePanelBootstrapNextAction({
  gateNextAction,
  bootstrapNextAction,
}: EngineeringStatePanelNextActionInput): boolean {
  const hasGateNextAction = hasEngineeringStatePanelTextValue(gateNextAction);
  if (hasGateNextAction === true) {
    return true;
  }

  const hasBootstrapNextAction = hasEngineeringStatePanelTextValue(bootstrapNextAction);
  return hasBootstrapNextAction === true;
}

function getEngineeringStatePanelDisplayedBootstrapNextAction({
  gateNextAction,
  bootstrapNextAction,
}: EngineeringStatePanelNextActionInput): string {
  const hasGateNextAction = hasEngineeringStatePanelTextValue(gateNextAction);
  if (hasGateNextAction === true) {
    return gateNextAction;
  }

  return bootstrapNextAction;
}

function getEngineeringStatePanelBootstrapBlockingItems({
  bootstrapBlockers,
  gateBlockingItems,
}: {
  bootstrapBlockers: string[];
  gateBlockingItems: string[];
}): string[] {
  const blockingItems: string[] = [];
  for (const item of bootstrapBlockers) {
    const text = getEngineeringStatePanelTextValue(item);
    const hasText = hasEngineeringStatePanelTextValue(text);
    if (hasText === true) {
      blockingItems.push(text);
    }
  }

  for (const item of gateBlockingItems) {
    const text = getEngineeringStatePanelTextValue(item);
    const hasText = hasEngineeringStatePanelTextValue(text);
    if (hasText === true) {
      blockingItems.push(text);
    }
  }

  return blockingItems;
}

function getChatMessageContentWorkflowSteps(message: WorkspaceMessageLike): WorkflowStep[] {
  if (Array.isArray(message.workflowSteps) === false) {
    return [];
  }

  return message.workflowSteps;
}

function getChatMessageContentTextValue(value: string | undefined): string {
  if (value === undefined) {
    return "";
  }

  return value.trim();
}

function hasChatMessageContentTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getChatMessageContentDisplayStatus({
  hasDisplayReasoning,
  hasStatusContent,
  statusContent,
}: {
  hasDisplayReasoning: boolean;
  hasStatusContent: boolean;
  statusContent: string;
}): string {
  if (hasDisplayReasoning === true) {
    return "";
  }

  if (hasStatusContent === true) {
    return statusContent;
  }

  return "";
}

function hasChatMessageContentFileOperationSteps(workflowSteps: WorkflowStep[]): boolean {
  for (const step of workflowSteps) {
    const sectionKind = getWorkflowSectionKind(step);
    const isFileOperationStep = sectionKind === "file_ops";
    if (isFileOperationStep === true) {
      return true;
    }
  }

  return false;
}

function getChatMessageContentFileOperationSteps(workflowSteps: WorkflowStep[]): WorkflowStep[] {
  const fileOperationSteps: WorkflowStep[] = [];
  for (const step of workflowSteps) {
    const sectionKind = getWorkflowSectionKind(step);
    const isFileOperationStep = sectionKind === "file_ops";
    if (isFileOperationStep === true) {
      fileOperationSteps.push(step);
    }
  }

  return fileOperationSteps;
}

function getChatMessageContentDisplaySteps(workflowSteps: WorkflowStep[]): WorkflowStep[] {
  const hasFileOperationSteps = hasChatMessageContentFileOperationSteps(workflowSteps);
  if (hasFileOperationSteps === true) {
    return getChatMessageContentFileOperationSteps(workflowSteps);
  }

  return workflowSteps;
}

function isChatMessageContentStreaming(message: WorkspaceMessageLike): boolean {
  return message.streaming === true;
}

function hasChatMessageContentSteps(displaySteps: WorkflowStep[]): boolean {
  const hasSteps = displaySteps.length > 0;
  return hasSteps === true;
}

function shouldStreamChatMessageThoughtProcess({
  isStreaming,
  hasSteps,
}: {
  isStreaming: boolean;
  hasSteps: boolean;
}): boolean {
  if (isStreaming === false) {
    return false;
  }

  return hasSteps === false;
}

function isChatMessageContentUserMessage(message: WorkspaceMessageLike): boolean {
  return message.role === "user";
}

function shouldRenderChatMessageRoleHeader(message: WorkspaceMessageLike): boolean {
  const isUserMessage = isChatMessageContentUserMessage(message);
  return isUserMessage === false;
}

function getChatMessageContentRoleLabel(message: WorkspaceMessageLike): string {
  if (message.role === "assistant") {
    return "YiStack 回复";
  }

  return "系统消息";
}

function getChatMessageContentEngineeringState(
  message: WorkspaceMessageLike,
): WorkspaceEngineeringStateSnapshot | undefined {
  return message.engineeringState;
}

function hasChatMessageContentEngineeringState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): engineeringState is WorkspaceEngineeringStateSnapshot {
  const hasEngineeringState = engineeringState !== undefined;
  return hasEngineeringState === true;
}

function getChatMessageContentRecoveryActionSummary({
  message,
  hasEngineeringState,
}: {
  message: WorkspaceMessageLike;
  hasEngineeringState: boolean;
}): WorkspaceRecoveryActionSummary | undefined {
  if (hasEngineeringState === true) {
    return deriveWorkspaceRecoveryActionSummary(message);
  }

  return undefined;
}

function hasChatMessageContentThoughtProcessContent({
  hasDisplayReasoning,
  hasDisplayStatus,
}: {
  hasDisplayReasoning: boolean;
  hasDisplayStatus: boolean;
}): boolean {
  if (hasDisplayReasoning === true) {
    return true;
  }

  return hasDisplayStatus === true;
}

function getChatMessageContentThoughtProcessContent({
  displayReasoning,
  displayStatus,
  hasDisplayReasoning,
}: {
  displayReasoning: string;
  displayStatus: string;
  hasDisplayReasoning: boolean;
}): string {
  if (hasDisplayReasoning === true) {
    return displayReasoning;
  }

  return displayStatus;
}

function shouldRenderChatMessageThoughtProcess(hasThoughtProcessContent: boolean): boolean {
  return hasThoughtProcessContent === true;
}

function isChatMessageContentThoughtProcessFallback(hasDisplayReasoning: boolean): boolean {
  return hasDisplayReasoning === false;
}

function getChatMessageContentRelatedCommit(message: WorkspaceMessageLike): GitCommit | undefined {
  const relatedCommit = message.relatedCommit;
  if (relatedCommit === undefined) {
    return undefined;
  }

  if (relatedCommit === null) {
    return undefined;
  }

  return relatedCommit;
}

function hasChatMessageContentRelatedCommit(relatedCommit: GitCommit | undefined): relatedCommit is GitCommit {
  const hasRelatedCommit = relatedCommit !== undefined;
  return hasRelatedCommit === true;
}

function shouldRenderChatMessageAssistantGuidance(message: WorkspaceMessageLike): boolean {
  const isAssistantMessage = message.role === "assistant";
  return isAssistantMessage === true;
}

function getRecoveryRetryLabel(retryLabel: string | undefined) {
  const retryLabelValue = retryLabel ?? "";
  const hasRetryLabel = retryLabelValue.length > 0;
  if (hasRetryLabel === true) {
    return retryLabelValue;
  }

  return "修复后重试";
}

function getValidationFailureItemTitle(item: WorkspaceValidationFailureItem) {
  const title = item.title ?? "";
  const hasTitle = title.length > 0;
  if (hasTitle === true) {
    return title;
  }

  return "Validation Gate 失败项";
}

function getValidationFailureItemKey(item: WorkspaceValidationFailureItem, index: number) {
  const id = item.id ?? "";
  const hasId = id.length > 0;
  const title = item.title ?? "";
  const hasTitle = title.length > 0;
  if (hasId === true) return id;
  if (hasTitle === true) return `${title}-${index}`;
  return `failure-${index}`;
}

function getContextRepairTargetKey(target: ContextGateRepairTarget) {
  const field = target.field ?? "default";
  return `${target.path}-${field}`;
}

function getEngineeringStateRows(state: WorkspaceEngineeringStateSnapshot) {
  const rows: EngineeringStateRow[] = [];
  const workflow = getEngineeringStatePanelWorkflowState(state);
  const execution = getEngineeringStatePanelExecutionState(state);
  const bootstrapState = getEngineeringStatePanelBootstrapState(state);
  const executionStatusLabel = getEngineeringStatePanelExecutionStatusLabel({
    workflow,
    execution,
  });
  const foundationRiskLevel = state.bootstrap_state?.foundation_risk_level ?? "";
  const foundationRiskDetail = getEngineeringStatePanelFoundationRiskDetail(foundationRiskLevel);
  const requiredDecisionCount = getEngineeringStatePanelRequiredDecisionCount(bootstrapState);
  const requiredDecisionDetail = getEngineeringStatePanelRequiredDecisionDetail(requiredDecisionCount);

  appendEngineeringStateRow(rows, {
    label: "Workflow",
    statusLabel: getEngineeringStatusLabel(state.workflow?.status),
    detail: joinEngineeringStateDetail([state.workflow?.stage, state.workflow?.mode]),
  });
  appendEngineeringStateRow(rows, {
    label: "Validation",
    statusLabel: getEngineeringStatusLabel(state.validation?.status),
    detail: state.validation?.gate ?? "",
  });
  appendEngineeringStateRow(rows, {
    label: "Runtime",
    statusLabel: getEngineeringStatusLabel(state.runtime?.status),
    detail: joinEngineeringStateDetail([state.runtime?.project_name, state.runtime?.app_type]),
  });
  appendEngineeringStateRow(rows, {
    label: "Phase",
    statusLabel: getEngineeringStatusLabel(state.phase?.status),
    detail: joinEngineeringStateDetail([state.phase?.current_phase, state.phase?.current_task]),
  });
  appendEngineeringStateRow(rows, {
    label: "Execution",
    statusLabel: executionStatusLabel,
    detail: joinEngineeringStateDetail([
      getEngineeringStatePanelExecutionAutoProgressDetail({
        workflow,
        execution,
      }),
      getEngineeringStatePanelExecutionAwaitingConfirmationDetail(execution),
      execution?.current_task,
    ]),
  });
  appendEngineeringStateRow(rows, {
    label: "Foundation",
    statusLabel: getBootstrapStatusLabel(state.bootstrap_state?.status),
    detail: joinEngineeringStateDetail([
      state.bootstrap_state?.template_id,
      foundationRiskDetail,
      requiredDecisionDetail,
    ]),
  });

  return rows;
}

function buildValidationFailureNavigationTarget(
  item: WorkspaceValidationFailureItem,
): WorkspaceEditorNavigationTarget | null {
  const filePath = item.file_path ?? "";
  const hasFilePath = filePath.length > 0;
  if (hasFilePath === false) return null;

  return {
    path: filePath,
    lineNumber: item.line_number,
    column: item.column,
    searchText: item.search_text,
    label: getValidationFailureItemTitle(item),
  };
}

function materializeEngineeringStatePanelRowNodes(rows: EngineeringStateRow[]): ReactNode[] {
  const rowNodes: ReactNode[] = [];

  for (const row of rows) {
    const hasRowDetail = row.detail.length > 0;
    rowNodes.push(
      <div key={row.label} className="rounded-md border bg-background/70 px-2.5 py-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</div>
        <div className="mt-1 font-medium">{row.statusLabel}</div>
        {hasRowDetail === true && (
          <div className="mt-1 truncate text-muted-foreground" title={row.detail}>
            {row.detail}
          </div>
        )}
      </div>,
    );
  }

  return rowNodes;
}

type ValidationFailureItemNodeMaterializerInput = {
  validationFailureItems: WorkspaceValidationFailureItem[];
  hasOpenFileAction: boolean;
  onOpenFile?: (target: string | WorkspaceEditorNavigationTarget) => void;
};

function materializeValidationFailureItemNodes({
  validationFailureItems,
  hasOpenFileAction,
  onOpenFile,
}: ValidationFailureItemNodeMaterializerInput): ReactNode[] {
  const itemNodes: ReactNode[] = [];

  for (let index = 0; index < validationFailureItems.length; index += 1) {
    const item = validationFailureItems[index];
    const navigationTarget = buildValidationFailureNavigationTarget(item);
    const hasNavigationTarget = navigationTarget !== null;
    const canOpenValidationFailure = hasNavigationTarget === true && hasOpenFileAction === true;
    const filePath = item.file_path ?? "";
    const hasFilePath = filePath.length > 0;
    const lineNumber = item.line_number ?? 0;
    const hasLineNumber = lineNumber > 0;
    const column = item.column ?? 0;
    const hasColumn = column > 0;
    const detail = item.detail ?? "";
    const hasDetail = detail.length > 0;
    const suggestion = item.suggestion ?? "";
    const hasSuggestion = suggestion.length > 0;

    itemNodes.push(
      <div key={getValidationFailureItemKey(item, index)} className="rounded-md border bg-muted/30 px-2 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium">{getValidationFailureItemTitle(item)}</div>
          {canOpenValidationFailure === true && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => {
                if (navigationTarget !== null && onOpenFile !== undefined) {
                  onOpenFile(navigationTarget);
                }
              }}
            >
              <FilePenLine className="mr-1 h-3 w-3" />
              打开修复位置
            </Button>
          )}
        </div>
        {hasFilePath === true && (
          <div className="mt-1 text-muted-foreground">
            位置：{filePath}
            {hasLineNumber === true ? `:${lineNumber}` : ""}
            {hasColumn === true ? `:${column}` : ""}
          </div>
        )}
        {hasDetail === true && (
          <div className="mt-1 text-muted-foreground">{detail}</div>
        )}
        {hasSuggestion === true && (
          <div className="mt-1 text-muted-foreground">
            修复建议：{suggestion}
          </div>
        )}
      </div>,
    );
  }

  return itemNodes;
}

function getEngineeringStatePanelSnapshotClassName(snapshot: EngineeringStatePanelSnapshot) {
  if (snapshot.status === "failed" || snapshot.status === "foundation_blocked") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (snapshot.status === "awaiting_confirmation" || snapshot.status === "recoverable") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (snapshot.status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function EngineeringStatePanelSnapshotStrip({ snapshot }: { snapshot: EngineeringStatePanelSnapshot }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-engineering-state-panel-snapshot"
      className={cn("mb-2 rounded-md border px-2.5 py-2 text-xs", getEngineeringStatePanelSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">工程状态快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Rows: {snapshot.rowCount}</span>
        <span>Failures: {snapshot.failureItemCount}</span>
        <span>Blockers: {snapshot.blockerCount}</span>
        <span>Actions: {snapshot.recoveryActionCount}</span>
        <span>Primary: {snapshot.primaryActionCount}</span>
        <span>Retry: {snapshot.retryActionCount}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function EngineeringStatePanel({
  state,
  recoveryActionSummary,
  onOpenFile,
}: {
  state: WorkspaceEngineeringStateSnapshot;
  recoveryActionSummary?: WorkspaceRecoveryActionSummary;
  onOpenFile?: (target: string | WorkspaceEditorNavigationTarget) => void;
}) {
  const rows = getEngineeringStateRows(state);
  if (rows.length === 0) return null;
  const hasOpenFileAction = onOpenFile !== undefined;
  const workflow = getEngineeringStatePanelWorkflowState(state);
  const phase = getEngineeringStatePanelPhaseState(state);
  const execution = getEngineeringStatePanelExecutionState(state);
  const recovery = getEngineeringStatePanelRecoveryState(state);
  const validation = getEngineeringStatePanelValidationState(state);
  const bootstrapState = getEngineeringStatePanelBootstrapState(state);
  const gateResult = getEngineeringStatePanelGateResult(bootstrapState);
  const hasPhase = phase !== undefined;
  const phaseCurrentTask = getEngineeringStatePanelTextValue(phase?.current_task);
  const hasPhaseCurrentTask = hasEngineeringStatePanelTextValue(phaseCurrentTask);
  const phaseCompletedTasks = getEngineeringStatePanelPhaseCompletedTasks(phase);
  const hasPhaseCompletedTasks = phaseCompletedTasks.length > 0;
  const phaseCompletedTasksLabel = getEngineeringStatePanelItemListLabel(phaseCompletedTasks);
  const phaseBlockers = getEngineeringStatePanelPhaseBlockers(phase);
  const hasPhaseBlockers = phaseBlockers.length > 0;
  const phaseBlockersLabel = getEngineeringStatePanelItemListLabel(phaseBlockers);
  const phaseNextAction = getEngineeringStatePanelTextValue(phase?.next_action);
  const hasPhaseNextAction = hasEngineeringStatePanelTextValue(phaseNextAction);
  const executionPauseReason = getEngineeringStatePanelTextValue(execution?.pause_reason);
  const hasExecutionPauseReason = hasEngineeringStatePanelTextValue(executionPauseReason);
  const executionApprovalBoundary = getEngineeringStatePanelExecutionApprovalBoundary({
    workflow,
    execution,
  });
  const hasExecutionApprovalBoundary = hasEngineeringStatePanelTextValue(executionApprovalBoundary);
  const executionNextAction = getEngineeringStatePanelTextValue(execution?.next_action);
  const hasExecutionNextAction = hasEngineeringStatePanelTextValue(executionNextAction);
  const shouldRenderExecutionState = shouldRenderEngineeringStatePanelExecutionState({
    hasExecutionPauseReason,
    hasExecutionApprovalBoundary,
    hasExecutionNextAction,
  });
  const hasRecovery = recovery !== undefined;
  const recoveryReasonMessage = getEngineeringStatePanelTextValue(recovery?.reason_message);
  const hasRecoveryReasonMessage = hasEngineeringStatePanelTextValue(recoveryReasonMessage);
  const recoveryStageLabel = getEngineeringStatePanelRecoveryStageLabel(recovery);
  const hasRecoveryStageLabel = hasEngineeringStatePanelTextValue(recoveryStageLabel);
  const canRetryRecovery = recovery?.can_retry === true;
  const shouldRenderRecoveryActions = shouldRenderEngineeringStatePanelRecoveryActions(recoveryActionSummary);
  const validationFailureItems = getEngineeringStatePanelValidationFailureItems(validation);
  const hasValidationFailureItems = validationFailureItems.length > 0;
  const hasBootstrapState = bootstrapState !== undefined;
  const bootstrapSchemaVersion = getEngineeringStatePanelTextValue(bootstrapState?.schema_version);
  const hasBootstrapSchemaVersion = hasEngineeringStatePanelTextValue(bootstrapSchemaVersion);
  const bootstrapProjectType = getEngineeringStatePanelTextValue(bootstrapState?.project_type);
  const hasBootstrapProjectType = hasEngineeringStatePanelTextValue(bootstrapProjectType);
  const bootstrapApprovalRequired = bootstrapState?.approval_required === true;
  const bootstrapSummary = joinEngineeringStateDetail([
    hasBootstrapSchemaVersion === true ? `Schema ${bootstrapSchemaVersion}` : "",
    hasBootstrapProjectType === true ? bootstrapProjectType : "",
    bootstrapApprovalRequired === true ? "需要确认" : "",
  ]);
  const gateNextAction = getEngineeringStatePanelTextValue(gateResult?.next_action);
  const bootstrapNextAction = getEngineeringStatePanelTextValue(bootstrapState?.next_action);
  const shouldRenderBootstrapNextAction = shouldRenderEngineeringStatePanelBootstrapNextAction({
    gateNextAction,
    bootstrapNextAction,
  });
  const displayedBootstrapNextAction = getEngineeringStatePanelDisplayedBootstrapNextAction({
    gateNextAction,
    bootstrapNextAction,
  });
  const bootstrapGateDecision = getEngineeringStatePanelTextValue(gateResult?.decision);
  const hasBootstrapGateDecision = hasEngineeringStatePanelTextValue(bootstrapGateDecision);
  const bootstrapBlockers = getEngineeringStatePanelBootstrapBlockers(bootstrapState);
  const gateBlockingItems = getEngineeringStatePanelGateBlockingItems(gateResult);
  const bootstrapBlockingItems = getEngineeringStatePanelBootstrapBlockingItems({
    bootstrapBlockers,
    gateBlockingItems,
  });
  const hasBootstrapBlockingItems = bootstrapBlockingItems.length > 0;
  const bootstrapBlockingItemsLabel = getEngineeringStatePanelItemListLabel(bootstrapBlockingItems);
  const engineeringStatePanelSnapshot = buildEngineeringStatePanelSnapshot({
    state,
    rowCount: rows.length,
    recoveryActionSummary,
  });
  const rowNodes = materializeEngineeringStatePanelRowNodes(rows);
  const validationFailureItemNodes = materializeValidationFailureItemNodes({
    validationFailureItems,
    hasOpenFileAction,
    onOpenFile,
  });

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        工程状态
      </div>
      <EngineeringStatePanelSnapshotStrip snapshot={engineeringStatePanelSnapshot} />
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        {rowNodes}
      </div>
      {hasPhase === true && (
        <div className="mt-2 rounded-md border bg-background/70 px-2.5 py-2 text-xs">
          <div className="font-medium">阶段任务</div>
          {hasPhaseCurrentTask === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">当前任务：</span>
              <span>{phaseCurrentTask}</span>
            </div>
          )}
          {hasPhaseCompletedTasks === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">已完成：</span>
              <span>{phaseCompletedTasksLabel}</span>
            </div>
          )}
          {hasPhaseBlockers === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">阻断项：</span>
              <span>{phaseBlockersLabel}</span>
            </div>
          )}
          {hasPhaseNextAction === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">阶段下一步：</span>
              <span>{phaseNextAction}</span>
            </div>
          )}
        </div>
      )}
      {shouldRenderExecutionState === true && (
        <div className="mt-2 rounded-md border bg-background/70 px-2.5 py-2 text-xs">
          {hasExecutionPauseReason === true && (
            <div>
              <span className="text-muted-foreground">暂停原因：</span>
              <span>{executionPauseReason}</span>
            </div>
          )}
          {hasExecutionApprovalBoundary === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">确认边界：</span>
              <span>{executionApprovalBoundary}</span>
            </div>
          )}
          {hasExecutionNextAction === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">下一步：</span>
              <span>{executionNextAction}</span>
            </div>
          )}
        </div>
      )}
      {hasRecovery === true && (
        <div className="mt-2 rounded-md border bg-background/70 px-2.5 py-2 text-xs">
          <div className="font-medium">恢复与重试</div>
          {hasRecoveryReasonMessage === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">阻断说明：</span>
              <span>{recoveryReasonMessage}</span>
            </div>
          )}
          {hasRecoveryStageLabel === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">恢复阶段：</span>
              <span>{recoveryStageLabel}</span>
            </div>
          )}
          {canRetryRecovery === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">重试入口：</span>
              <span>{getRecoveryRetryLabel(state.recovery?.retry_label)}</span>
            </div>
          )}
          {shouldRenderRecoveryActions === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">可用入口：</span>
              <span>{recoveryActionSummary.summaryLabel}</span>
              <div className="mt-1 text-muted-foreground">
                主入口 {recoveryActionSummary.primaryActionCount} 个 / 重试 {recoveryActionSummary.retryActionCount} 个
              </div>
            </div>
          )}
        </div>
      )}
      {hasValidationFailureItems === true && (
        <div className="mt-2 rounded-md border bg-background/70 px-2.5 py-2 text-xs">
          <div className="font-medium">校验失败项</div>
          <div className="mt-2 space-y-2">
            {validationFailureItemNodes}
          </div>
        </div>
      )}
      {hasBootstrapState === true && (
        <div className="mt-2 rounded-md border bg-background/70 px-2.5 py-2 text-xs">
          <div className="font-medium">Project Foundation</div>
          <div className="mt-1 text-muted-foreground">
            {bootstrapSummary}
          </div>
          {shouldRenderBootstrapNextAction === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">下一步：</span>
              <span>{displayedBootstrapNextAction}</span>
            </div>
          )}
          {hasBootstrapGateDecision === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">Gate：</span>
              <span>{getFoundationGateDecisionLabel(bootstrapGateDecision)}</span>
            </div>
          )}
          {hasBootstrapBlockingItems === true && (
            <div className="mt-1">
              <span className="text-muted-foreground">阻塞项：</span>
              <span>{bootstrapBlockingItemsLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getValidationGateBlockedSnapshotClassName(snapshot: ValidationGateBlockedSnapshot) {
  if (snapshot.status === "repair_targets_missing") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-destructive/30 bg-destructive/5 text-destructive";
}

function ValidationGateBlockedSnapshotStrip({ snapshot }: { snapshot: ValidationGateBlockedSnapshot }) {
  const canOpenRepairTargetLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.canOpenRepairTarget);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-validation-gate-blocked-snapshot"
      className={cn("mb-2 rounded-md border px-2.5 py-2 text-xs", getValidationGateBlockedSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Gate 阻断快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Gate: {snapshot.gate}</span>
        <span>Failures: {snapshot.failureItemCount}</span>
        <span>RepairTargets: {snapshot.repairTargetCount}</span>
        <span>CanOpen: {canOpenRepairTargetLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function materializeContextGateRepairTargetDescriptionNodes(
  contextGateRepairTargets: ContextGateRepairTarget[],
): ReactNode[] {
  const repairTargetNodes: ReactNode[] = [];

  for (const item of contextGateRepairTargets) {
    repairTargetNodes.push(
      <div key={getContextRepairTargetKey(item)}>
        - {item.reason}
        <div className="pl-3 text-muted-foreground">{item.suggestion}</div>
      </div>,
    );
  }

  return repairTargetNodes;
}

type ContextGateRepairTargetActionNodeMaterializerInput = {
  contextGateRepairTargets: ContextGateRepairTarget[];
  onOpenFile?: (target: string | WorkspaceEditorNavigationTarget) => void;
};

function materializeContextGateRepairTargetActionNodes({
  contextGateRepairTargets,
  onOpenFile,
}: ContextGateRepairTargetActionNodeMaterializerInput): ReactNode[] {
  const repairTargetNodes: ReactNode[] = [];

  for (const target of contextGateRepairTargets) {
    repairTargetNodes.push(
      <Button
        key={target.path}
        type="button"
        variant="outline"
        size="sm"
        className="h-8 border-destructive/30 bg-background"
        onClick={() => {
          if (onOpenFile !== undefined) {
            onOpenFile({
              path: target.path,
              searchText: target.searchText,
              label: target.label,
            });
          }
        }}
      >
        {target.label}
      </Button>,
    );
  }

  return repairTargetNodes;
}

function ValidationGateBlockedAlert({
  state,
  gateResult,
  onOpenFile,
}: {
  state: WorkspaceEngineeringStateSnapshot;
  gateResult?: WorkspaceGateResult;
  onOpenFile?: (target: string | WorkspaceEditorNavigationTarget) => void;
}) {
  if (state.validation?.status !== "failed") return null;

  const hasContextValidationGate = state.validation?.gate === "context-memory-isolation";
  const hasContextPauseReason = state.execution?.pause_reason === "context_gate_blocked";
  const isContextGateBlocked = hasContextValidationGate === true || hasContextPauseReason === true;
  const contextGateRepairTargets = getContextGateRepairTargets(gateResult);
  const hasGateResult = gateResult !== undefined;
  const hasOpenFileAction = onOpenFile !== undefined;
  const hasContextGateRepairTargets = contextGateRepairTargets.length > 0;
  const canOpenRepairTarget = hasOpenFileAction === true && hasContextGateRepairTargets === true;
  const validationGateBlockedSnapshot = buildValidationGateBlockedSnapshot({
    state,
    isContextGateBlocked,
    hasGateResult,
    repairTargetCount: contextGateRepairTargets.length,
    canOpenRepairTarget,
  });
  const title = isContextGateBlocked === true ? "Context Gate 阻断" : "Validation Gate 阻断";
  const validationGate = state.validation?.gate ?? "";
  const hasValidationGate = validationGate.length > 0;
  const description = isContextGateBlocked === true
    ? "检测到当前项目上下文与结构化真源存在冲突，继续生成已被阻断。"
    : (hasValidationGate === true
      ? `YES 校验 ${validationGate} 未通过，当前阶段已被阻断。`
      : "YES 校验未通过，当前阶段已被阻断。");
  const contextGateRepairTargetDescriptionNodes = materializeContextGateRepairTargetDescriptionNodes(
    contextGateRepairTargets,
  );
  const contextGateRepairTargetActionNodes = materializeContextGateRepairTargetActionNodes({
    contextGateRepairTargets,
    onOpenFile,
  });

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
      <ValidationGateBlockedSnapshotStrip snapshot={validationGateBlockedSnapshot} />
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-destructive">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {description}
          </div>
            {isContextGateBlocked === true && hasGateResult === true && (
              <>
                {hasContextGateRepairTargets === true ? (
                  <div className="mt-2 text-xs text-destructive/90">
                    {contextGateRepairTargetDescriptionNodes}
                  </div>
                ) : null}
              </>
            )}
          {isContextGateBlocked === true && hasOpenFileAction === true && (
            <div className="mt-3 flex flex-wrap gap-2">
              {contextGateRepairTargetActionNodes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getWorkflowStepTimestamp(step: WorkflowStep, key: "__startedAt" | "__completedAt") {
  const value = step.meta?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getMessageRenderSnapshotClassName(snapshot: MessageRenderSnapshot) {
  if (snapshot.status === "code_copy_failed" || snapshot.status === "mermaid_failed") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (snapshot.status === "mermaid_rendering") {
    return "border-primary/20 bg-primary/5 text-primary";
  }
  if (snapshot.status === "code_copied" || snapshot.status === "mermaid_rendered") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "border-border bg-background/80 text-muted-foreground";
}

function getMessageRenderSnapshotLanguageLabel(language: string) {
  const hasLanguage = language.length > 0;
  return hasLanguage === true ? language : "plain";
}

function MessageRenderSnapshotStrip({ snapshot }: { snapshot: MessageRenderSnapshot }) {
  const languageLabel = getMessageRenderSnapshotLanguageLabel(snapshot.language);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-message-render-snapshot"
      className={cn("border-b px-3 py-2 text-xs", getMessageRenderSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">消息渲染状态</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Language: {languageLabel}</span>
        <span>Chars: {snapshot.contentLength}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function getWorkflowStepDisplayStatus(step: WorkflowStep, now: number) {
  const status = step.status ?? "done";
  if (status !== "done" && status !== "failed") {
    return status;
  }

  const startedAt = getWorkflowStepTimestamp(step, "__startedAt");
  const completedAt = getWorkflowStepTimestamp(step, "__completedAt");
  const hasStartedAt = startedAt !== undefined;
  const hasCompletedAt = completedAt !== undefined;
  if (hasStartedAt === false || hasCompletedAt === false) {
    return status;
  }

  const visibleUntil = startedAt + FILE_OP_RUNNING_MIN_VISIBLE_MS;
  if (completedAt < visibleUntil && now < visibleUntil) {
    return "running";
  }
  return status;
}

const WORKFLOW_SECTION_ORDER: WorkflowSectionKind[] = ["file_ops", "other"];

function getWorkflowSectionSteps(steps: WorkflowStep[], kind: WorkflowSectionKind): WorkflowStep[] {
  const sectionSteps: WorkflowStep[] = [];
  for (const step of steps) {
    const stepKind = getWorkflowSectionKind(step);
    const isTargetKind = stepKind === kind;
    if (isTargetKind === true) {
      sectionSteps.push(step);
    }
  }

  return sectionSteps;
}

function getWorkflowStepSections(steps: WorkflowStep[]): WorkflowStepSection[] {
  const sections: WorkflowStepSection[] = [];
  for (const kind of WORKFLOW_SECTION_ORDER) {
    const sectionSteps = getWorkflowSectionSteps(steps, kind);
    const hasSectionSteps = sectionSteps.length > 0;
    if (hasSectionSteps === true) {
      sections.push({
        kind,
        steps: sectionSteps,
      });
    }
  }

  return sections;
}

function getWorkflowStepDisplayStatusForMessage({
  step,
  statusNow,
  isStreaming,
}: {
  step: WorkflowStep;
  statusNow: number;
  isStreaming: boolean;
}): WorkflowStepStatus {
  if (isStreaming === false && step.status === "running") {
    return "done";
  }

  return getWorkflowStepDisplayStatus(step, statusNow);
}

function getWorkflowSectionDisplaySteps(steps: WorkflowStep[], statusNow: number, isStreaming: boolean): WorkflowStep[] {
  const displaySteps: WorkflowStep[] = [];
  for (const step of steps) {
    displaySteps.push({
      ...step,
      status: getWorkflowStepDisplayStatusForMessage({
        step,
        statusNow,
        isStreaming,
      }),
    });
  }

  return displaySteps;
}

function hasWorkflowSectionRunningStep(displaySteps: WorkflowStep[]): boolean {
  for (const step of displaySteps) {
    const isRunning = step.status === "running";
    if (isRunning === true) {
      return true;
    }
  }

  return false;
}

function shouldOpenWorkflowSectionInitially({
  isStreaming,
  hasRunning,
}: {
  isStreaming: boolean;
  hasRunning: boolean;
}): boolean {
  if (isStreaming === true) {
    return true;
  }

  return hasRunning === true;
}

function getWorkflowSectionActiveSnapshotSource(isStreaming: boolean): WorkflowSectionSnapshotSource {
  if (isStreaming === true) {
    return "streaming";
  }

  return "workflow_steps";
}

function getWorkflowSectionInitialSnapshotSource({
  isStreaming,
  shouldOpenInitially,
}: {
  isStreaming: boolean;
  shouldOpenInitially: boolean;
}): WorkflowSectionSnapshotSource {
  if (shouldOpenInitially === true) {
    return getWorkflowSectionActiveSnapshotSource(isStreaming);
  }

  return "workflow_steps";
}

function getWorkflowSectionVisibleLines(displaySteps: WorkflowStep[]): string[] {
  const lines: string[] = [];
  for (const step of displaySteps) {
    const line = getWorkflowStepLine(step);
    const hasLine = line.length > 0;
    if (hasLine === true) {
      lines.push(line);
    }
  }

  return lines;
}

function getWorkflowSectionStatusRefreshWaitUntil(steps: WorkflowStep[], statusNow: number): number | null {
  let waitUntil: number | null = null;

  for (const step of steps) {
    const actualStatus = step.status ?? "done";
    if (actualStatus !== "running") {
      if (actualStatus !== "done" && actualStatus !== "failed") {
        continue;
      }
    }

    const startedAt = getWorkflowStepTimestamp(step, "__startedAt");
    const completedAt = getWorkflowStepTimestamp(step, "__completedAt");
    const hasStartedAt = startedAt !== undefined;
    const hasCompletedAt = completedAt !== undefined;
    if (hasStartedAt === false || hasCompletedAt === false) {
      continue;
    }

    const visibleUntil = startedAt + FILE_OP_RUNNING_MIN_VISIBLE_MS;
    if (completedAt >= visibleUntil || visibleUntil <= statusNow) {
      continue;
    }

    if (waitUntil === null || visibleUntil < waitUntil) {
      waitUntil = visibleUntil;
    }
  }

  return waitUntil;
}

type WorkflowSectionNodeMaterializerInput = {
  sections: WorkflowStepSection[];
  streaming?: boolean;
  activeOperation?: string;
  onOpenFile?: (path: string) => void;
};

function materializeWorkflowSectionNodes({
  sections,
  streaming,
  activeOperation,
  onOpenFile,
}: WorkflowSectionNodeMaterializerInput): ReactNode[] {
  const sectionNodes: ReactNode[] = [];

  for (const section of sections) {
    sectionNodes.push(
      <WorkflowSection
        key={section.kind}
        kind={section.kind}
        steps={section.steps}
        streaming={streaming}
        activeOperation={activeOperation}
        onOpenFile={onOpenFile}
      />,
    );
  }

  return sectionNodes;
}

type WorkflowStepNodeMaterializerInput = {
  kind: WorkflowSectionKind;
  displaySteps: WorkflowStep[];
  hasOpenFileAction: boolean;
  onOpenFile?: (path: string) => void;
};

function materializeWorkflowStepNodes({
  kind,
  displaySteps,
  hasOpenFileAction,
  onOpenFile,
}: WorkflowStepNodeMaterializerInput): ReactNode[] {
  const stepNodes: ReactNode[] = [];

  for (let index = 0; index < displaySteps.length; index += 1) {
    const step = displaySteps[index];
    const line = getWorkflowStepLine(step);
    const hasLine = line.length > 0;
    if (hasLine === false) {
      continue;
    }

    const path = getWorkflowStepPath(step);
    const hasPath = path.length > 0;
    const canOpenWorkflowStep = hasPath === true && hasOpenFileAction === true;
    const content = (
      <>
        <WorkflowStepStatusIcon step={step} />
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line}</span>
      </>
    );

    if (canOpenWorkflowStep === true) {
      stepNodes.push(
        <button
          key={`${kind}-${step.id}-${index}`}
          type="button"
          onClick={() => {
            if (onOpenFile !== undefined) {
              onOpenFile(path);
            }
          }}
          className="flex w-full items-start gap-2 rounded-md bg-muted/25 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/45"
        >
          {content}
        </button>,
      );
      continue;
    }

    stepNodes.push(
      <div
        key={`${kind}-${step.id}-${index}`}
        className="flex items-start gap-2 rounded-md bg-muted/25 px-3 py-2 text-sm text-muted-foreground"
      >
        {content}
      </div>,
    );
  }

  return stepNodes;
}

function getWorkflowSectionSnapshotClassName(snapshot: WorkflowSectionSnapshot) {
  if (snapshot.status === "failed" || snapshot.status === "empty_lines") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (snapshot.status === "running") {
    return "border-primary/20 bg-primary/5 text-primary";
  }
  if (snapshot.status === "open") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "border-border bg-background/80 text-muted-foreground";
}

function WorkflowSectionSnapshotStrip({ snapshot }: { snapshot: WorkflowSectionSnapshot }) {
  const isOpenLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.isOpen);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-workflow-section-snapshot"
      className={cn("border-t px-3 py-2 text-xs", getWorkflowSectionSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Workflow 分组状态</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Kind: {snapshot.sectionKind}</span>
        <span>Steps: {snapshot.stepCount}</span>
        <span>Running: {snapshot.runningCount}</span>
        <span>Failed: {snapshot.failedCount}</span>
        <span>Visible: {snapshot.visibleLineCount}</span>
        <span>Open: {isOpenLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function getChatMessageSnapshotClassName(snapshot: ChatMessageSnapshot) {
  if (snapshot.status === "engineering_failed" || snapshot.status === "workflow_failed" || snapshot.status === "empty_message") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (snapshot.status === "workflow_running" || snapshot.status === "assistant_streaming") {
    return "border-primary/20 bg-primary/5 text-primary";
  }
  if (snapshot.status === "guidance_available" || snapshot.status === "commit_attached") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-border bg-background/80 text-muted-foreground";
}

function ChatMessageSnapshotStrip({ snapshot }: { snapshot: ChatMessageSnapshot }) {
  const hasEngineeringStateLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.hasEngineeringState);
  const isStreamingLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.isStreaming);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-chat-message-snapshot"
      className={cn("rounded-lg border px-3 py-2 text-xs", getChatMessageSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">消息状态</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Role: {snapshot.role}</span>
        <span>Steps: {snapshot.workflowStepCount}</span>
        <span>Visible: {snapshot.visibleStepCount}</span>
        <span>Questions: {snapshot.suggestedQuestionCount}</span>
        <span>Actions: {snapshot.guidanceActionCount}</span>
        <span>Engineering: {hasEngineeringStateLabel}</span>
        <span>Streaming: {isStreamingLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function MermaidDiagram({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const diagramId = useId();
  const renderId = useMemo(() => `workspace-mermaid-${diagramId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [diagramId]);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });

        const { svg: renderedSvg } = await mermaid.render(renderId, source);
        const hasRenderCancelled = cancelled === true;
        if (hasRenderCancelled === false) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (renderError) {
        const hasRenderCancelled = cancelled === true;
        if (hasRenderCancelled === false) {
          setSvg(null);
          setError(formatWorkspaceMermaidRenderError(renderError));
        }
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [renderId, source]);

  const hasError = error !== null;
  const svgValue = svg ?? "";
  const hasSvg = svgValue.length > 0;

  if (hasError === true) {
    const renderSnapshot = buildMermaidMessageRenderSnapshot({
      status: "mermaid_failed",
      contentLength: source.length,
      error,
    });

    return (
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          mermaid
        </div>
        <MessageRenderSnapshotStrip snapshot={renderSnapshot} />
        <div className="space-y-2 px-3 py-3">
          <p className="text-xs text-destructive">{error}</p>
          <pre className="overflow-x-auto text-xs leading-6">
            <code>{source}</code>
          </pre>
        </div>
      </div>
    );
  }

  if (hasSvg === false) {
    const renderSnapshot = buildMermaidMessageRenderSnapshot({
      status: "mermaid_rendering",
      contentLength: source.length,
    });

    return (
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">mermaid</span>
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            渲染中
          </span>
        </div>
        <MessageRenderSnapshotStrip snapshot={renderSnapshot} />
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">正在生成流程图预览...</div>
      </div>
    );
  }

  const renderSnapshot = buildMermaidMessageRenderSnapshot({
    status: "mermaid_rendered",
    contentLength: source.length,
  });

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        mermaid
      </div>
      <MessageRenderSnapshotStrip snapshot={renderSnapshot} />
      <div
        className="overflow-x-auto px-3 py-3 [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svgValue }}
      />
    </div>
  );
}

function getMarkdownCodeBlockLanguage(className: string | undefined) {
  const languageClassName = className ?? "";
  const language = languageClassName.replace("language-", "");
  const hasLanguage = language.length > 0;
  return hasLanguage === true ? language : "";
}

function MarkdownCodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const rawCode = String(children ?? "").replace(/\n$/, "");
  const language = getMarkdownCodeBlockLanguage(className);
  const hasLanguage = language.length > 0;
  const languageLabel = hasLanguage === true ? language : "code";
  const isMermaidLanguage = language.toLowerCase() === "mermaid";
  const [copyStatus, setCopyStatus] = useState<CodeBlockCopyStatus>("idle");
  const [copyError, setCopyError] = useState("");

  if (isMermaidLanguage === true) {
    return <MermaidDiagram source={rawCode} />;
  }

  const handleCopy = async () => {
    const hasClipboard = navigator.clipboard !== undefined;
    if (hasClipboard === false) {
      const reason = formatWorkspaceMissingClipboardError();
      setCopyError(reason);
      setCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(rawCode);
      setCopyError("");
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1500);
    } catch (error) {
      console.error("复制代码块失败:", error);
      setCopyError(formatWorkspaceClipboardError(error, "浏览器拒绝了剪贴板访问"));
      setCopyStatus("failed");
    }
  };

  const renderSnapshot = buildCodeBlockMessageRenderSnapshot({
    copyStatus,
    copyError,
    language,
    contentLength: rawCode.length,
  });
  const hasCopyError = copyError.length > 0;
  const copyErrorMessage = hasCopyError === true
    ? copyError
    : formatWorkspaceMissingClipboardError();
  const hasCopyFailed = copyStatus === "failed";

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {languageLabel}
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          {copyStatus === "copied" ? "已复制" : "复制"}
        </Button>
      </div>
      <MessageRenderSnapshotStrip snapshot={renderSnapshot} />
      {hasCopyFailed === true ? (
        <div
          data-testid="chat-code-block-copy-failed"
          role="status"
          aria-live="polite"
          className="border-b bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          复制代码块失败：{copyErrorMessage}。当前内容没有写入系统剪贴板；请手动选中代码复制，或检查浏览器剪贴板权限后重试。
        </div>
      ) : null}
      <pre className="overflow-x-auto px-3 py-3 text-xs leading-6">
        <code className={className}>{rawCode}</code>
      </pre>
    </div>
  );
}

function getMarkdownPreFirstChild(children: ReactNode): ReactNode | undefined {
  const childNodes = Children.toArray(children);
  for (const child of childNodes) {
    return child;
  }

  return undefined;
}

export function MarkdownContent({ content }: { content: string }) {
  const normalized = content.trim();
  const hasNormalizedContent = normalized.length > 0;
  if (hasNormalizedContent === false) return null;

  return (
    <div className="prose prose-sm max-w-none break-words dark:prose-invert prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none prose-table:block prose-table:overflow-x-auto prose-table:whitespace-nowrap">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            const child = getMarkdownPreFirstChild(children);
            const hasCodeChild = isValidElement<{ className?: string; children?: React.ReactNode }>(child);
            if (hasCodeChild === false) {
              return <pre className="overflow-x-auto rounded-lg border bg-background px-3 py-3 text-xs leading-6">{children}</pre>;
            }

            return (
              <MarkdownCodeBlock className={child.props.className}>
                {child.props.children}
              </MarkdownCodeBlock>
            );
          },
          code({ className, children }) {
            return (
              <code className={cn("rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.92em] dark:bg-white/10", className)}>
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full border-collapse text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border-b bg-muted/40 px-3 py-2 text-left font-medium">{children}</th>;
          },
          td({ children }) {
            return <td className="border-b px-3 py-2 align-top">{children}</td>;
          },
          p({ children }) {
            return <p className="whitespace-pre-wrap break-words">{children}</p>;
          },
          li({ children }) {
            return <li className="whitespace-pre-wrap break-words">{children}</li>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-2 border-primary/40 pl-4 text-muted-foreground">{children}</blockquote>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                {children}
              </a>
            );
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

export function WorkflowSteps({
  steps,
  streaming,
  activeOperation,
  onOpenFile,
}: {
  steps: WorkflowStep[];
  streaming?: boolean;
  activeOperation?: string;
  onOpenFile?: (path: string) => void;
}) {
  const sections = useMemo(() => getWorkflowStepSections(steps), [steps]);
  const sectionNodes = materializeWorkflowSectionNodes({
    sections,
    streaming,
    activeOperation,
    onOpenFile,
  });

  if (sections.length === 0) return null;

  return (
    <div className="space-y-2">
      {sectionNodes}
    </div>
  );
}

function WorkflowSection({
  kind,
  steps,
  streaming,
  activeOperation,
  onOpenFile,
}: {
  kind: WorkflowSectionKind;
  steps: WorkflowStep[];
  streaming?: boolean;
  activeOperation?: string;
  onOpenFile?: (path: string) => void;
}) {
  const isStreaming = streaming === true;
  const [statusNow, setStatusNow] = useState(() => Date.now());
  const displaySteps = useMemo(
    () => getWorkflowSectionDisplaySteps(steps, statusNow, isStreaming),
    [isStreaming, statusNow, steps],
  );
  const hasRunning = hasWorkflowSectionRunningStep(displaySteps);
  const shouldOpenInitially = shouldOpenWorkflowSectionInitially({
    isStreaming,
    hasRunning,
  });
  const [open, setOpen] = useState(shouldOpenInitially);
  const [snapshotSource, setSnapshotSource] = useState<WorkflowSectionSnapshotSource>(
    getWorkflowSectionInitialSnapshotSource({
      isStreaming,
      shouldOpenInitially,
    }),
  );

  useEffect(() => {
    const waitUntil = getWorkflowSectionStatusRefreshWaitUntil(steps, statusNow);

    if (waitUntil === null) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setStatusNow(Date.now());
    }, Math.max(0, waitUntil - Date.now()));

    return () => window.clearTimeout(timeout);
  }, [statusNow, steps]);

  useEffect(() => {
    if (isStreaming === true || hasRunning === true) {
      setOpen(true);
      setSnapshotSource(getWorkflowSectionActiveSnapshotSource(isStreaming));
      return;
    }
    setOpen(false);
    setSnapshotSource("workflow_steps");
  }, [hasRunning, isStreaming, steps.length]);

  const meta = getWorkflowSectionMeta(kind);
  const Icon = meta.icon;
  const lines = getWorkflowSectionVisibleLines(displaySteps);
  const hasVisibleLines = lines.length > 0;
  const activeOperationValue = activeOperation ?? "";
  const hasActiveOperation = activeOperationValue.length > 0;
  const shouldRenderActiveOperation = isStreaming === true && hasActiveOperation === true;
  const hasOpenFileAction = onOpenFile !== undefined;
  const sectionSnapshot = buildWorkflowSectionSnapshot({
    kind,
    displaySteps,
    visibleLineCount: lines.length,
    open,
    source: snapshotSource,
  });
  const workflowStepNodes = materializeWorkflowStepNodes({
    kind,
    displaySteps,
    hasOpenFileAction,
    onOpenFile,
  });
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setSnapshotSource("user_toggle");
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="rounded-lg border bg-background/70">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Icon className={cn(
              "h-4 w-4",
              hasRunning === true && "text-primary",
              hasRunning === false && "text-muted-foreground",
            )} />
            <span className="text-sm font-medium">{meta.title}</span>
            {hasRunning === true && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                <LoaderCircle className="h-3 w-3 animate-spin" />
                进行中
              </span>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <WorkflowSectionSnapshotStrip snapshot={sectionSnapshot} />
      <CollapsibleContent className="border-t">
        <div className="space-y-2 px-3 py-3">
          {shouldRenderActiveOperation === true && (
            <div className="flex items-start gap-2 rounded-md bg-primary/5 px-3 py-2 text-sm text-primary">
              <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{activeOperationValue}</span>
            </div>
          )}
          {hasVisibleLines === false && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              当前 workflow 分组存在 {displaySteps.length} 个步骤，但没有生成可展示行。
            </div>
          )}
          {workflowStepNodes}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function getChatThoughtProcessSnapshotClassName(snapshot: ChatThoughtProcessSnapshot) {
  if (snapshot.status === "streaming") {
    return "border-primary/20 bg-primary/5 text-primary";
  }
  if (snapshot.status === "expanded") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (snapshot.status === "settled") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "border-border bg-background/80 text-muted-foreground";
}

function ChatThoughtProcessSnapshotStrip({ snapshot }: { snapshot: ChatThoughtProcessSnapshot }) {
  const isOpenLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.isOpen);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-chat-thought-process-snapshot"
      className={cn("border-t px-3 py-2 text-xs", getChatThoughtProcessSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">思考状态</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Kind: {snapshot.contentKind}</span>
        <span>Open: {isOpenLabel}</span>
        <span>Chars: {snapshot.contentLength}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function ThoughtProcessPanel({
  content,
  streaming,
  fallback,
}: {
  content: string;
  streaming?: boolean;
  fallback?: boolean;
}) {
  const normalized = content.trim();
  const hasNormalizedContent = normalized.length > 0;
  const isStreaming = streaming === true;
  const hasFallback = fallback === true;
  const [open, setOpen] = useState(isStreaming);
  const [snapshotSource, setSnapshotSource] = useState<ChatThoughtProcessSnapshotSource>(
    isStreaming === true
      ? (hasFallback === true ? "status_content" : "reasoning_content")
      : "message_restore",
  );

  useEffect(() => {
    if (isStreaming === true) {
      setOpen(true);
      setSnapshotSource(hasFallback === true ? "status_content" : "reasoning_content");
      return;
    }
    setOpen(false);
    setSnapshotSource("message_restore");
  }, [hasFallback, isStreaming, normalized]);

  if (hasNormalizedContent === false) return null;
  const thoughtProcessSnapshot = buildChatThoughtProcessSnapshot({
    contentLength: normalized.length,
    streaming: isStreaming,
    open,
    fallback: hasFallback,
    source: snapshotSource,
  });
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setSnapshotSource("user_toggle");
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="rounded-lg border bg-background/70">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Brain className={cn(
              "h-4 w-4",
              isStreaming === true ? "animate-spin text-primary" : "text-muted-foreground",
            )} />
            <span className="text-sm font-medium">
              {hasFallback === true
                ? (isStreaming === true ? "当前动作" : "动作记录")
                : (isStreaming === true ? "思考中" : "思考过程")}
            </span>
          </div>
          {isStreaming === true && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              流式更新
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <ChatThoughtProcessSnapshotStrip snapshot={thoughtProcessSnapshot} />
      <CollapsibleContent className="border-t">
        <div className="px-3 py-3">
          <div className="rounded-lg border bg-background px-3 py-3 text-sm text-muted-foreground">
            <MarkdownContent content={normalized} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const diffMinutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} 天前`;
}

function normalizeCommitVersion(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  const hasNormalizedVersion = normalized.length > 0;
  if (hasNormalizedVersion === false) return value.trim();
  return normalized.slice(0, 7);
}

function getCommitSummarySnapshotClassName(snapshot: CommitSummarySnapshot) {
  if (snapshot.status === "actions_missing" || snapshot.status === "summary_missing") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (snapshot.status === "restore_only" || snapshot.status === "view_only") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function CommitSummarySnapshotStrip({ snapshot }: { snapshot: CommitSummarySnapshot }) {
  const hasMessageLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.hasMessage);
  const canRestoreLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.canRestore);
  const canViewLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.canView);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-commit-summary-snapshot"
      className={cn("rounded-md border px-2.5 py-2 text-xs", getCommitSummarySnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">版本状态</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Hash: {snapshot.shortHash}</span>
        <span>Summary: {hasMessageLabel}</span>
        <span>Restore: {canRestoreLabel}</span>
        <span>View: {canViewLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}

function CommitSummaryCard({
  commit,
  onRestoreCommit,
  onViewCommit,
}: {
  commit: GitCommit;
  onRestoreCommit?: (commit: GitCommit) => void;
  onViewCommit?: (commit: GitCommit) => void;
}) {
  const shortHash = normalizeCommitVersion(commit.hash);
  const canRestoreCommit = onRestoreCommit !== undefined;
  const canViewCommit = onViewCommit !== undefined;
  const commitSummarySnapshot = buildCommitSummarySnapshot({
    commit,
    shortHash,
    canRestore: canRestoreCommit,
    canView: canViewCommit,
  });
  const handleRestoreCommit = () => {
    if (onRestoreCommit === undefined) {
      return;
    }
    onRestoreCommit(commit);
  };
  const handleViewCommit = () => {
    if (onViewCommit === undefined) {
      return;
    }
    onViewCommit(commit);
  };

  return (
    <div className="rounded-lg border bg-background/70 px-3 py-3">
      <CommitSummarySnapshotStrip snapshot={commitSummarySnapshot} />
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="text-sm font-semibold text-foreground">版本 {shortHash}</span>
        <span>{formatRelativeTime(commit.time)}</span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{commit.message}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={canRestoreCommit === false}
          onClick={handleRestoreCommit}
        >
          回到该版本
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={canViewCommit === false}
          onClick={handleViewCommit}
        >
          查看修改记录
        </Button>
      </div>
    </div>
  );
}

export function ChatMessageContent({
  message,
  onAskQuestion,
  onRunAction,
  onRestoreCommit,
  onViewCommit,
  onOpenFile,
}: {
  message: WorkspaceMessageLike;
  onAskQuestion: (question: string) => void;
  onRunAction: (action: WorkspaceGuidanceAction) => void;
  onRestoreCommit?: (commit: GitCommit) => void;
  onViewCommit?: (commit: GitCommit) => void;
  onOpenFile?: (target: string | WorkspaceEditorNavigationTarget) => void;
}) {
  const displayReasoning = getChatMessageContentTextValue(message.reasoningContent);
  const hasDisplayReasoning = hasChatMessageContentTextValue(displayReasoning);
  const statusContent = getChatMessageContentTextValue(message.statusContent);
  const hasStatusContent = hasChatMessageContentTextValue(statusContent);
  const displayStatus = getChatMessageContentDisplayStatus({
    hasDisplayReasoning,
    hasStatusContent,
    statusContent,
  });
  const hasDisplayStatus = hasChatMessageContentTextValue(displayStatus);
  const workflowSteps = getChatMessageContentWorkflowSteps(message);
  const displaySteps = getChatMessageContentDisplaySteps(workflowSteps);
  const isStreaming = isChatMessageContentStreaming(message);
  const hasSteps = hasChatMessageContentSteps(displaySteps);
  const thoughtStreaming = shouldStreamChatMessageThoughtProcess({
    isStreaming,
    hasSteps,
  });
  const summaryContent = getChatMessageContentTextValue(message.content);
  const hasSummary = hasChatMessageContentTextValue(summaryContent);
  const isUserMessage = isChatMessageContentUserMessage(message);
  const shouldRenderRoleHeader = shouldRenderChatMessageRoleHeader(message);
  const roleLabel = getChatMessageContentRoleLabel(message);
  const engineeringState = getChatMessageContentEngineeringState(message);
  const hasEngineeringState = hasChatMessageContentEngineeringState(engineeringState);
  const recoveryActionSummary = getChatMessageContentRecoveryActionSummary({
    message,
    hasEngineeringState,
  });
  const hasThoughtProcessContent = hasChatMessageContentThoughtProcessContent({
    hasDisplayReasoning,
    hasDisplayStatus,
  });
  const thoughtProcessContent = getChatMessageContentThoughtProcessContent({
    displayReasoning,
    displayStatus,
    hasDisplayReasoning,
  });
  const shouldRenderThoughtProcess = shouldRenderChatMessageThoughtProcess(hasThoughtProcessContent);
  const thoughtProcessFallback = isChatMessageContentThoughtProcessFallback(hasDisplayReasoning);
  const relatedCommit = getChatMessageContentRelatedCommit(message);
  const hasRelatedCommit = hasChatMessageContentRelatedCommit(relatedCommit);
  const shouldRenderAssistantGuidance = shouldRenderChatMessageAssistantGuidance(message);
  const chatMessageSnapshot = buildChatMessageSnapshot({
    message,
    displaySteps,
    hasSummary,
    hasReasoning: hasDisplayReasoning,
    hasStatus: hasDisplayStatus,
    recoveryActionSummary,
  });

  if (isUserMessage) {
    return (
      <div className="space-y-3">
        <ChatMessageSnapshotStrip snapshot={chatMessageSnapshot} />
        <MarkdownContent content={message.content} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ChatMessageSnapshotStrip snapshot={chatMessageSnapshot} />
      {shouldRenderRoleHeader === true && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5" />
            <span>{roleLabel}</span>
        </div>
      )}

      {shouldRenderThoughtProcess === true && (
        <ThoughtProcessPanel
          content={thoughtProcessContent}
          streaming={thoughtStreaming}
          fallback={thoughtProcessFallback}
        />
      )}

      {hasSteps === true && (
        <WorkflowSteps
          steps={displaySteps}
          streaming={isStreaming}
          activeOperation={message.activeFileOperation}
          onOpenFile={onOpenFile}
        />
      )}

      {hasEngineeringState === true && (
        <>
          <ValidationGateBlockedAlert
            state={engineeringState}
            gateResult={message.gateResult}
            onOpenFile={onOpenFile}
          />
          <div className="app-debug-only">
            <EngineeringStatePanel
              state={engineeringState}
              recoveryActionSummary={recoveryActionSummary}
              onOpenFile={onOpenFile}
            />
          </div>
        </>
      )}

      {hasSummary === true ? (
        <div className="rounded-lg border bg-background/70 px-3 py-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            {hasSteps === true ? "最终回答" : "回复内容"}
          </div>
          <MarkdownContent content={message.content} />
        </div>
      ) : hasSteps === true ? null : (
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      )}

      {hasRelatedCommit === true && (
        <CommitSummaryCard
          commit={relatedCommit}
          onRestoreCommit={onRestoreCommit}
          onViewCommit={onViewCommit}
        />
      )}

      {shouldRenderAssistantGuidance === true && (
        <WorkspaceGuidanceActions
          message={message}
          onAskQuestion={onAskQuestion}
          onRunAction={onRunAction}
        />
      )}
    </div>
  );
}
