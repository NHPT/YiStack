import type {
  WorkflowStep,
  WorkflowStepMeta,
} from '@/components/workspace/chat-message-content';
import type { ProjectMessage } from '@/lib/api';
import type { FileAttachment, FileNode, FileNodeType } from '@/lib/types';
import {
  normalizeWorkspaceEngineeringState,
  type WorkspaceBootstrapState,
  type WorkspaceExecutionState,
  type WorkspaceEngineeringStateSnapshot,
  type WorkspacePhaseState,
  type WorkspaceRecoveryState,
} from '@/lib/workspace/engineering-state';
import {
  isWorkspaceBackendWorkflowStage,
  type WorkspaceBackendWorkflowStage,
} from '@/lib/workspace/workflow-contract';
import {
  buildWorkspacePendingNavigationLocalFailure,
  type WorkspacePendingNavigationLocalFailure,
} from '@/lib/workspace/workspace-pending-navigation-local-errors';
import type { PreviewUrlBuildReasonSource } from '@/lib/workspace/preview-url-build-errors';
import {
  parseVisualAttachmentInputsJSON,
  parseVisualContextJSON,
  type VisualAttachmentInput,
} from '@/lib/visual-context';

import type {
  GuidanceAction,
  WorkspaceChatMessage,
  WorkspaceEventMessage,
  WorkspaceEventMessageFallback,
  WorkspaceGeneratedFile,
  WorkspaceGeneratedFileList,
  WorkspaceGenerationMode,
  WorkspaceChatMessageKind,
  WorkspaceRestoredMessagePayload,
} from './workspace-types';
import type {
  WorkspaceStreamEventData,
  WorkspaceWorkflowStepEventData,
} from './workspace-orchestration-shared';

type PendingWorkspaceNavigation = {
  projectId?: string;
  target?: string;
  createdAt?: number;
};

export type PendingWorkspaceNavigationReadResult =
  | { ok: true; value: PendingWorkspaceNavigation | null }
  | WorkspacePendingNavigationLocalFailure<'read' | 'parse_cleanup'>;

export type PendingWorkspaceNavigationClearResult =
  | { ok: true }
  | WorkspacePendingNavigationLocalFailure<'clear'>;

export type PendingWorkspaceNavigationFreshResult =
  | { ok: true; hasFresh: boolean }
  | WorkspacePendingNavigationLocalFailure<'read' | 'parse_cleanup'>;

const pendingWorkspaceNavigationKey = 'yistack_pending_workspace_navigation';
const pendingWorkspaceNavigationTtlMs = 15_000;
const PREVIEW_GATEWAY_URL = getWorkspacePreviewGatewayEnvValue(process.env.NEXT_PUBLIC_PREVIEW_GATEWAY_URL);
const WORKSPACE_PREVIEW_LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1'] as const;
const WORKSPACE_INITIAL_ANALYSIS_PLACEHOLDER_MESSAGE = '正在分析你的需求并规划技术方案...';

export type ProjectPreviewUrlBuildReasonCode = 'missing_project_id' | 'missing_gateway_config' | 'invalid_gateway_url';
export type ProjectPreviewUrlBuildReasonSource = PreviewUrlBuildReasonSource;

export type ProjectPreviewUrlBuildResult =
  | { ok: true; url: string }
  | {
    ok: false;
    url: 'about:blank';
    reasonCode: ProjectPreviewUrlBuildReasonCode;
    reasonMessage: string;
    reasonSource: ProjectPreviewUrlBuildReasonSource;
    reasonDetails: string;
  };

export function sanitizeWorkspaceText(value: string) {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function isWorkspaceFilePathCharacterSafe(character: string): boolean {
  const code = character.charCodeAt(0);
  if (code <= 31) {
    return false;
  }
  if (code >= 127 && code <= 159) {
    return false;
  }
  if (character === '\uFFFD') {
    return false;
  }
  return true;
}

function sanitizeWorkspaceFilePathText(value: string): string {
  let sanitized = '';
  for (const character of value) {
    const isSafeCharacter = isWorkspaceFilePathCharacterSafe(character);
    if (isSafeCharacter === true) {
      sanitized += character;
    }
  }

  return sanitizeWorkspaceText(sanitized);
}

function getWorkspacePreviewGatewayEnvValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value;
}

function getWorkspacePreviewOptionalTextValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value;
}

function getWorkspacePreviewTrimmedTextValue(value: string | null | undefined): string {
  const textValue = getWorkspacePreviewOptionalTextValue(value);
  return textValue.trim();
}

function hasWorkspacePreviewTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasWorkspacePreviewBrowserLocation(): boolean {
  const hasBrowserLocation = typeof window !== 'undefined';
  return hasBrowserLocation === true;
}

function isWorkspacePreviewLoopbackHost(hostname: string): boolean {
  for (const loopbackHost of WORKSPACE_PREVIEW_LOOPBACK_HOSTS) {
    const isMatchedHost = loopbackHost === hostname;
    if (isMatchedHost === true) {
      return true;
    }
  }

  return false;
}

function shouldRewriteWorkspacePreviewLoopbackHost(hostname: string): boolean {
  const isLoopbackHost = isWorkspacePreviewLoopbackHost(hostname);
  if (isLoopbackHost === false) {
    return false;
  }

  return hasWorkspacePreviewBrowserLocation();
}

function getWorkspacePreviewGatewayBase(): string {
  const configuredBase = PREVIEW_GATEWAY_URL.trim();
  const hasConfiguredBase = hasWorkspacePreviewTextValue(configuredBase);
  if (hasConfiguredBase === true) {
    return configuredBase;
  }

  return '/preview';
}

function getWorkspacePreviewUrl(base: string): URL {
  if (hasWorkspacePreviewBrowserLocation() === true) {
    return new URL(base, window.location.origin);
  }

  return new URL(base);
}

function hasWorkspacePreviewProjectId(projectId: string): boolean {
  return hasWorkspacePreviewTextValue(projectId);
}

function shouldAttachWorkspacePreviewProjectParam(url: URL): boolean {
  const normalizedPath = url.pathname.replace(/\/$/, '');
  if (normalizedPath !== '/preview') {
    return false;
  }

  const hasProjectParam = hasWorkspacePreviewTextValue(url.searchParams.get('project') || '');
  if (hasProjectParam === true) {
    return false;
  }

  const hasPreviewTokenParam = hasWorkspacePreviewTextValue(url.searchParams.get('preview_token') || '');
  if (hasPreviewTokenParam === true) {
    return false;
  }

  return true;
}

function normalizeWorkspacePreviewExplicitUrlForProject(
  normalizedExplicit: string,
  projectId: string,
): string {
  const hasProjectId = hasWorkspacePreviewProjectId(projectId);
  if (hasProjectId === false) {
    return normalizedExplicit;
  }

  try {
    const url = getWorkspacePreviewUrl(normalizedExplicit);
    const shouldAttachProjectParam = shouldAttachWorkspacePreviewProjectParam(url);
    if (shouldAttachProjectParam === false) {
      return normalizedExplicit;
    }

    url.searchParams.set('project', projectId);
    return url.toString();
  } catch {
    return normalizedExplicit;
  }
}

function getInitialWorkspaceMessageTextValue(value: string): string {
  return value.trim();
}

function hasInitialWorkspaceMessageTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function isInitialWorkspaceAnalysisPlaceholder(value: string): boolean {
  const isPlaceholder = value === WORKSPACE_INITIAL_ANALYSIS_PLACEHOLDER_MESSAGE;
  return isPlaceholder === true;
}

function getInitialWorkspaceEngineeringState(
  project: InitialWorkspaceMessagesProject,
): WorkspaceEngineeringStateSnapshot | undefined {
  const engineeringState = project.engineeringState;
  const hasEngineeringState = engineeringState !== undefined;
  if (hasEngineeringState === false) {
    return undefined;
  }

  return engineeringState;
}

function hasInitialWorkspaceEngineeringState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): engineeringState is WorkspaceEngineeringStateSnapshot {
  const hasEngineeringState = engineeringState !== undefined;
  return hasEngineeringState === true;
}

function hasEngineeringStateRestoreSuggestedActions(suggestedActions: GuidanceAction[]): boolean {
  const hasSuggestedActions = suggestedActions.length > 0;
  return hasSuggestedActions === true;
}

function getEngineeringStateRestoreTextValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value;
}

function getEngineeringStateRestoreTrimmedTextValue(value: string | undefined): string {
  const textValue = getEngineeringStateRestoreTextValue(value);
  return textValue.trim();
}

function hasEngineeringStateRestoreTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function getEngineeringStateRestorePhase(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): WorkspacePhaseState | undefined {
  return engineeringState.phase;
}

function getEngineeringStateRestoreRecovery(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): WorkspaceRecoveryState | undefined {
  return engineeringState.recovery;
}

function getEngineeringStateRestoreExecution(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): WorkspaceExecutionState | undefined {
  return engineeringState.execution;
}

function getEngineeringStateRestoreBootstrapState(
  engineeringState: WorkspaceEngineeringStateSnapshot,
): WorkspaceBootstrapState | undefined {
  return engineeringState.bootstrap_state;
}

function hasEngineeringStateRestoreRecoveryRetry(
  recovery: WorkspaceRecoveryState | undefined,
): recovery is WorkspaceRecoveryState {
  if (recovery === undefined) {
    return false;
  }

  const canRetry = recovery.can_retry === true;
  return canRetry === true;
}

function getEngineeringStateRestoreRetryPrompt(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTrimmedTextValue(recovery.retry_prompt);
}

function getEngineeringStateRestoreRetryLabel(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTrimmedTextValue(recovery.retry_label);
}

function getEngineeringStateRestoreRecoveryMode(recovery: WorkspaceRecoveryState): WorkspaceGenerationMode | undefined {
  return normalizeEngineeringStateRecoveryMode(recovery.resume_mode);
}

function getEngineeringStateRestoreRecoveryStage(recovery: WorkspaceRecoveryState): WorkspaceBackendWorkflowStage | undefined {
  const resumeStage = recovery.resume_stage;
  const hasRecoveryStage = isWorkspaceBackendWorkflowStage(resumeStage);
  if (hasRecoveryStage === false) {
    return undefined;
  }

  return resumeStage;
}

function getEngineeringStateRestoreFoundationStatus(bootstrapState: WorkspaceBootstrapState | undefined): string {
  if (bootstrapState === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(bootstrapState.status);
}

function getEngineeringStateRestoreCurrentPhase(phase: WorkspacePhaseState | undefined): string {
  if (phase === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(phase.current_phase);
}

function getEngineeringStateRestoreCurrentTask(phase: WorkspacePhaseState | undefined): string {
  if (phase === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(phase.current_task);
}

function getEngineeringStateRestoreRecoveryReasonMessage(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(recovery.reason_message);
}

function getEngineeringStateRestoreRecoveryReasonCode(recovery: WorkspaceRecoveryState | undefined): string {
  if (recovery === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(recovery.reason_code);
}

function getEngineeringStateRestorePhaseNextAction(phase: WorkspacePhaseState | undefined): string {
  if (phase === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(phase.next_action);
}

function getEngineeringStateRestoreExecutionNextAction(execution: WorkspaceExecutionState | undefined): string {
  if (execution === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(execution.next_action);
}

function getEngineeringStateRestoreBootstrapNextAction(bootstrapState: WorkspaceBootstrapState | undefined): string {
  if (bootstrapState === undefined) {
    return '';
  }

  return getEngineeringStateRestoreTextValue(bootstrapState.next_action);
}

export function normalizeExplicitPreviewUrl(explicitPreviewUrl?: string | null): string {
  const trimmedExplicit = getWorkspacePreviewTrimmedTextValue(explicitPreviewUrl);
  const hasExplicitPreviewUrl = hasWorkspacePreviewTextValue(trimmedExplicit);
  if (hasExplicitPreviewUrl === false) return '';

  try {
    const url = new URL(trimmedExplicit);
    const shouldRewriteLoopbackHost = shouldRewriteWorkspacePreviewLoopbackHost(url.hostname);
    if (shouldRewriteLoopbackHost === true) {
      url.protocol = window.location.protocol;
      url.hostname = window.location.hostname;
    }
    return url.toString();
  } catch {
    return trimmedExplicit;
  }
}

export function buildProjectPreviewUrl(projectId: string, explicitPreviewUrl?: string | null): string {
  return buildProjectPreviewUrlResult(projectId, explicitPreviewUrl).url;
}

export function buildProjectPreviewUrlResult(
  projectId: string,
  explicitPreviewUrl?: string | null,
): ProjectPreviewUrlBuildResult {
  const normalizedExplicit = normalizeExplicitPreviewUrl(explicitPreviewUrl);
  const hasExplicitPreviewUrl = hasWorkspacePreviewTextValue(normalizedExplicit);
  if (hasExplicitPreviewUrl === true) {
    return {
      ok: true,
      url: normalizeWorkspacePreviewExplicitUrlForProject(normalizedExplicit, projectId),
    };
  }
  const hasProjectId = hasWorkspacePreviewProjectId(projectId);
  if (hasProjectId === false) {
    return {
      ok: false,
      url: 'about:blank',
      reasonCode: 'missing_project_id',
      reasonMessage: '缺少项目 ID，无法生成 Preview URL。',
      reasonSource: 'workspace_project',
      reasonDetails: 'projectId is empty',
    };
  }

  const base = getWorkspacePreviewGatewayBase();
  const hasGatewayBase = hasWorkspacePreviewTextValue(base);
  if (hasGatewayBase === false) {
    return {
      ok: false,
      url: 'about:blank',
      reasonCode: 'missing_gateway_config',
      reasonMessage: '未配置 Preview Gateway URL 或端口，无法从项目 ID 推导预览地址。',
      reasonSource: 'preview_gateway_config',
      reasonDetails: 'NEXT_PUBLIC_PREVIEW_GATEWAY_URL is empty and the same-origin /preview/ proxy fallback is unavailable',
    };
  }

  try {
    const url = getWorkspacePreviewUrl(base);
    url.searchParams.set('project', projectId);
    return { ok: true, url: url.toString() };
  } catch (error) {
    const details = error instanceof Error ? error.message : 'URL 格式无效';
    return {
      ok: false,
      url: 'about:blank',
      reasonCode: 'invalid_gateway_url',
      reasonMessage: 'Preview Gateway 配置无法解析。',
      reasonSource: 'preview_gateway_config',
      reasonDetails: details,
    };
  }
}

function hasPendingWorkspaceNavigationBrowserStorage(): boolean {
  const hasBrowserStorage = typeof window !== 'undefined';
  return hasBrowserStorage === true;
}

function hasPendingWorkspaceNavigationRawValue(raw: string | null): raw is string {
  if (raw === null) {
    return false;
  }

  const hasRaw = raw.length > 0;
  return hasRaw === true;
}

function getPendingWorkspaceNavigationRawValue(raw: string | null): string | null {
  const hasRaw = hasPendingWorkspaceNavigationRawValue(raw);
  if (hasRaw === false) {
    return null;
  }

  return raw;
}

function readPendingWorkspaceNavigationPayload(pendingRaw: string): PendingWorkspaceNavigation {
  return JSON.parse(pendingRaw) as PendingWorkspaceNavigation;
}

function isPendingWorkspaceNavigationReadReady(
  result: PendingWorkspaceNavigationReadResult,
): result is Extract<PendingWorkspaceNavigationReadResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function getPendingWorkspaceNavigationCreatedAt(value: PendingWorkspaceNavigation | null): number | null {
  if (value === null) {
    return null;
  }

  if (value.createdAt === undefined) {
    return null;
  }

  return value.createdAt;
}

function hasPendingWorkspaceNavigationCreatedAt(createdAt: number | null): createdAt is number {
  const hasCreatedAt = createdAt !== null;
  return hasCreatedAt === true;
}

function isPendingWorkspaceNavigationWithinFreshWindow({
  now,
  createdAt,
}: {
  now: number;
  createdAt: number;
}): boolean {
  const elapsedMs = now - createdAt;
  const hasFreshWindow = elapsedMs < pendingWorkspaceNavigationTtlMs;
  return hasFreshWindow === true;
}

export function readPendingWorkspaceNavigation(): PendingWorkspaceNavigationReadResult {
  const hasBrowserStorage = hasPendingWorkspaceNavigationBrowserStorage();
  if (hasBrowserStorage === false) return { ok: true, value: null };

  let raw: string | null;
  try {
    raw = sessionStorage.getItem(pendingWorkspaceNavigationKey);
  } catch (error) {
    return buildWorkspacePendingNavigationLocalFailure(
      error,
      'read',
      '浏览器拒绝读取 Workspace 跳转保护状态',
    );
  }
  const pendingRaw = getPendingWorkspaceNavigationRawValue(raw);
  if (pendingRaw === null) return { ok: true, value: null };

  try {
    return { ok: true, value: readPendingWorkspaceNavigationPayload(pendingRaw) };
  } catch (error) {
    try {
      sessionStorage.removeItem(pendingWorkspaceNavigationKey);
      return buildWorkspacePendingNavigationLocalFailure(
        error,
        'parse_cleanup',
        'Workspace 跳转保护状态格式无效',
      );
    } catch (cleanupError) {
      return buildWorkspacePendingNavigationLocalFailure(
        error,
        'parse_cleanup',
        'Workspace 跳转保护状态格式无效',
        {
          error: cleanupError,
          fallback: '浏览器拒绝清理 Workspace 跳转保护状态',
        },
      );
    }
  }
}

export function clearPendingWorkspaceNavigation(): PendingWorkspaceNavigationClearResult {
  const hasBrowserStorage = hasPendingWorkspaceNavigationBrowserStorage();
  if (hasBrowserStorage === false) return { ok: true };
  try {
    sessionStorage.removeItem(pendingWorkspaceNavigationKey);
    return { ok: true };
  } catch (error) {
    return buildWorkspacePendingNavigationLocalFailure(
      error,
      'clear',
      '浏览器拒绝清理 Workspace 跳转保护状态',
    );
  }
}

export function hasFreshPendingWorkspaceNavigation(): PendingWorkspaceNavigationFreshResult {
  const pendingResult = readPendingWorkspaceNavigation();
  const isPendingResultReady = isPendingWorkspaceNavigationReadReady(pendingResult);
  if (isPendingResultReady === false) return pendingResult;
  const createdAt = getPendingWorkspaceNavigationCreatedAt(pendingResult.value);
  const hasCreatedAt = hasPendingWorkspaceNavigationCreatedAt(createdAt);
  if (hasCreatedAt === false) return { ok: true, hasFresh: false };
  return {
    ok: true,
    hasFresh: isPendingWorkspaceNavigationWithinFreshWindow({
      now: Date.now(),
      createdAt,
    }),
  };
}

export type InitialWorkspaceMessagesProject = {
  description: string;
  initialMessage: string;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
};

export function buildInitialWorkspaceMessages(project: InitialWorkspaceMessagesProject): WorkspaceChatMessage[] {
  const nextMessages: WorkspaceChatMessage[] = [];
  const description = getInitialWorkspaceMessageTextValue(project.description);
  const hasDescription = hasInitialWorkspaceMessageTextValue(description);
  if (hasDescription === true) {
    nextMessages.push({
      id: `initial-user-${Date.now()}`,
      role: 'user',
      content: description,
      timestamp: new Date().toISOString(),
    });
  }
  const normalizedInitialMessage = getInitialWorkspaceMessageTextValue(project.initialMessage);
  const hasInitialMessage = hasInitialWorkspaceMessageTextValue(normalizedInitialMessage);
  if (hasInitialMessage === true) {
    const isPlaceholderMessage = isInitialWorkspaceAnalysisPlaceholder(normalizedInitialMessage);
    if (isPlaceholderMessage === true) {
      return nextMessages;
    }
    nextMessages.push({
      id: `initial-assistant-${Date.now()}`,
      role: 'assistant',
      content: normalizedInitialMessage,
      timestamp: new Date().toISOString(),
    });
  }
  const engineeringState = getInitialWorkspaceEngineeringState(project);
  const hasEngineeringState = hasInitialWorkspaceEngineeringState(engineeringState);
  if (hasEngineeringState === true) {
    nextMessages.push(buildEngineeringStateRestoredMessage(engineeringState));
  }
  return nextMessages;
}

function buildEngineeringStateRestoredMessage(engineeringState: WorkspaceEngineeringStateSnapshot): WorkspaceChatMessage {
  const restoreSummary = buildEngineeringStateRestoreSummary(engineeringState);
  const suggestedActions = buildEngineeringStateRestoreActions(engineeringState);

  return {
    id: `engineering-state-restored-${Date.now()}`,
    role: 'assistant',
    kind: 'workflow',
    content: restoreSummary.content,
    statusContent: restoreSummary.statusContent,
    suggestedActions: hasEngineeringStateRestoreSuggestedActions(suggestedActions) === true
      ? suggestedActions
      : undefined,
    timestamp: new Date().toISOString(),
    engineeringState,
    workflowSteps: [{
      id: 'engineering-state:restored',
      kind: 'engineering_state_restored',
      title: '恢复工程状态快照',
      detail: restoreSummary.detail,
      status: 'done',
    }],
  };
}

function normalizeEngineeringStateRecoveryMode(mode?: string): WorkspaceGenerationMode | undefined {
  return mode === 'foundation' || mode === 'discuss' || mode === 'implement'
    ? mode
    : undefined;
}

function buildEngineeringStateRestoreActions(engineeringState: WorkspaceEngineeringStateSnapshot): GuidanceAction[] {
  const recovery = getEngineeringStateRestoreRecovery(engineeringState);
  const hasRecoveryRetry = hasEngineeringStateRestoreRecoveryRetry(recovery);
  const retryPrompt = getEngineeringStateRestoreRetryPrompt(recovery);
  const hasRetryPrompt = hasEngineeringStateRestoreTextValue(retryPrompt);
  if (hasRecoveryRetry === false || hasRetryPrompt === false) {
    return [];
  }
  const retryLabel = getEngineeringStateRestoreRetryLabel(recovery);
  const hasRetryLabel = hasEngineeringStateRestoreTextValue(retryLabel);

  return [{
    label: hasRetryLabel === true ? retryLabel : '修复后重试',
    kind: 'retry_workflow_gate',
    prompt: retryPrompt,
    mode: getEngineeringStateRestoreRecoveryMode(recovery),
    conversationStage: getEngineeringStateRestoreRecoveryStage(recovery),
  }];
}

function getEngineeringStateRestorePhaseStatus(engineeringState: WorkspaceEngineeringStateSnapshot): string {
  const phase = engineeringState.phase;
  const hasPhase = phase !== undefined;
  if (hasPhase === false) {
    return 'unknown';
  }

  const phaseStatus = phase.status;
  const hasPhaseStatus = phaseStatus !== undefined;
  if (hasPhaseStatus === false) {
    return 'unknown';
  }

  return phaseStatus;
}

function getEngineeringStateRestorePhaseLabel({
  currentPhase,
  hasCurrentPhase,
  currentTask,
  hasCurrentTask,
}: {
  currentPhase: string;
  hasCurrentPhase: boolean;
  currentTask: string;
  hasCurrentTask: boolean;
}): string {
  if (hasCurrentPhase === true) {
    if (hasCurrentTask === true) {
      return `${currentPhase} / ${currentTask}`;
    }

    return currentPhase;
  }

  if (hasCurrentTask === true) {
    return currentTask;
  }

  return '';
}

function getEngineeringStateRestoreNextAction({
  phaseNextAction,
  hasPhaseNextAction,
  executionNextAction,
  hasExecutionNextAction,
  retryLabel,
  hasRetryLabel,
  foundationNextAction,
}: {
  phaseNextAction: string;
  hasPhaseNextAction: boolean;
  executionNextAction: string;
  hasExecutionNextAction: boolean;
  retryLabel: string;
  hasRetryLabel: boolean;
  foundationNextAction: string;
}): string {
  if (hasPhaseNextAction === true) {
    return phaseNextAction;
  }

  if (hasExecutionNextAction === true) {
    return executionNextAction;
  }

  if (hasRetryLabel === true) {
    return retryLabel;
  }

  return foundationNextAction;
}

function getEngineeringStateRestoreDetailSegments({
  hasRecoveryReason,
  recoveryReason,
  hasNextAction,
  nextAction,
}: {
  hasRecoveryReason: boolean;
  recoveryReason: string;
  hasNextAction: boolean;
  nextAction: string;
}): string[] {
  const segments: string[] = [];
  if (hasRecoveryReason === true) {
    segments.push(`阻断原因：${recoveryReason}`);
  }

  if (hasNextAction === true) {
    segments.push(`下一步：${nextAction}`);
  }

  return segments;
}

function buildEngineeringStateRestoreSummary(engineeringState: WorkspaceEngineeringStateSnapshot) {
  const phase = getEngineeringStateRestorePhase(engineeringState);
  const recovery = getEngineeringStateRestoreRecovery(engineeringState);
  const execution = getEngineeringStateRestoreExecution(engineeringState);
  const bootstrapState = getEngineeringStateRestoreBootstrapState(engineeringState);
  const foundationStatus = getEngineeringStateRestoreFoundationStatus(bootstrapState);
  const hasFoundationStatus = hasEngineeringStateRestoreTextValue(foundationStatus);
  const currentPhase = getEngineeringStateRestoreCurrentPhase(phase);
  const currentTask = getEngineeringStateRestoreCurrentTask(phase);
  const hasCurrentPhase = hasEngineeringStateRestoreTextValue(currentPhase);
  const hasCurrentTask = hasEngineeringStateRestoreTextValue(currentTask);
  const phaseLabel = getEngineeringStateRestorePhaseLabel({
    currentPhase,
    hasCurrentPhase,
    currentTask,
    hasCurrentTask,
  });
  const hasPhaseLabel = hasEngineeringStateRestoreTextValue(phaseLabel);
  const recoveryReasonMessage = getEngineeringStateRestoreRecoveryReasonMessage(recovery);
  const recoveryReasonCode = getEngineeringStateRestoreRecoveryReasonCode(recovery);
  const hasRecoveryReasonMessage = hasEngineeringStateRestoreTextValue(recoveryReasonMessage);
  const recoveryReason = hasRecoveryReasonMessage === true ? recoveryReasonMessage : recoveryReasonCode;
  const hasRecoveryReason = hasEngineeringStateRestoreTextValue(recoveryReason);
  const phaseNextAction = getEngineeringStateRestorePhaseNextAction(phase);
  const executionNextAction = getEngineeringStateRestoreExecutionNextAction(execution);
  const retryLabel = getEngineeringStateRestoreRetryLabel(recovery);
  const foundationNextAction = getEngineeringStateRestoreBootstrapNextAction(bootstrapState);
  const hasPhaseNextAction = hasEngineeringStateRestoreTextValue(phaseNextAction);
  const hasExecutionNextAction = hasEngineeringStateRestoreTextValue(executionNextAction);
  const hasRetryLabel = hasEngineeringStateRestoreTextValue(retryLabel);
  const nextAction = getEngineeringStateRestoreNextAction({
    phaseNextAction,
    hasPhaseNextAction,
    executionNextAction,
    hasExecutionNextAction,
    retryLabel,
    hasRetryLabel,
    foundationNextAction,
  });
  const hasNextAction = hasEngineeringStateRestoreTextValue(nextAction);
  const detailSegments = getEngineeringStateRestoreDetailSegments({
    hasRecoveryReason,
    recoveryReason,
    hasNextAction,
    nextAction,
  });
  const hasDetailSegments = detailSegments.length > 0;
  const phaseStatus = getEngineeringStateRestorePhaseStatus(engineeringState);
  const content = hasPhaseLabel === true
    ? `已恢复工程状态：${phaseLabel}。${hasRecoveryReason === true ? `阻断原因：${recoveryReason}。` : ''}`
    : hasFoundationStatus === true
    ? `已恢复项目基础设定状态：${foundationStatus}。`
    : '已恢复项目工程状态快照。';
  return {
    content,
    statusContent: hasCurrentPhase === true
      ? `${currentPhase}: ${phaseStatus}`
      : hasFoundationStatus === true
        ? `项目基础设定: ${foundationStatus}`
        : '工程状态已恢复',
    detail: hasDetailSegments === true ? detailSegments.join('；') : '已从项目详情恢复最新工程状态。',
  };
}

export function appTypeNeedsRuntime(appType?: string | null) {
  void appType;
  return true;
}

export function safeParseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hasWorkspaceEventTextValue(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim();
  const hasValue = normalizedValue.length > 0;
  return hasValue === true;
}

function getWorkspaceEventTextValue(value: unknown): string | null {
  const hasValue = hasWorkspaceEventTextValue(value);
  if (hasValue === false) {
    return null;
  }

  return value;
}

export function getEventMessage(
  data: WorkspaceStreamEventData,
  fallback: WorkspaceEventMessageFallback,
): WorkspaceEventMessage {
  const message = getWorkspaceEventTextValue(data.message);
  if (message !== null) return message;

  const error = getWorkspaceEventTextValue(data.error);
  if (error !== null) return error;

  return fallback;
}

export function appendReasoningLine(current: string, nextLine: string) {
  const normalizedNextLine = nextLine.trim();
  if (normalizedNextLine.length === 0) return current;

  const normalizedCurrent = current.trim();
  if (normalizedCurrent.length === 0) return normalizedNextLine;

  const existingLines = getWorkspaceReasoningLineList(normalizedCurrent);

  const hasExistingLine = hasWorkspaceReasoningLine(existingLines, normalizedNextLine);
  if (hasExistingLine === true) {
    return normalizedCurrent;
  }

  return `${normalizedCurrent}\n${normalizedNextLine}`;
}

function getWorkspaceReasoningLineList(current: string): string[] {
  const lines: string[] = [];
  for (const line of current.split('\n')) {
    const normalizedLine = line.trim();
    const hasLine = normalizedLine.length > 0;
    if (hasLine === true) {
      lines.push(normalizedLine);
    }
  }

  return lines;
}

function hasWorkspaceReasoningLine(existingLines: string[], normalizedNextLine: string): boolean {
  for (const existingLine of existingLines) {
    const hasMatchingLine = existingLine === normalizedNextLine;
    if (hasMatchingLine === true) {
      return true;
    }
  }

  return false;
}

export function appendReasoningChunk(current: string, nextChunk: string) {
  if (nextChunk.length === 0) return current;
  return `${current}${nextChunk}`;
}

export function appendStatusLine(current: string, nextLine: string) {
  return appendReasoningLine(current, nextLine);
}

export function normalizeCommitVersion(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
  if (normalized.length === 0) return value.trim();
  return normalized.slice(0, 7);
}

function inferFileNodeTypeFromPath(path: string): FileNodeType {
  const normalized = path.trim();
  if (normalized.length === 0) return 'file';
  const hasExtensionSeparator = hasWorkspaceFileTreeExtensionSeparator(normalized);
  if (hasExtensionSeparator === true) {
    return 'file';
  }

  return 'folder';
}

function getWorkspaceFileTreePathSegments(filePath: string): string[] {
  const segments: string[] = [];
  for (const segment of filePath.split('/')) {
    const normalizedSegment = sanitizeWorkspaceFilePathText(segment);
    const hasSegment = normalizedSegment.length > 0;
    if (hasSegment === true) {
      segments.push(normalizedSegment);
    }
  }

  return segments;
}

function hasWorkspaceFileTreeExtensionSeparator(path: string): boolean {
  for (const character of path) {
    const isExtensionSeparator = character === '.';
    if (isExtensionSeparator === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceFileTreePathSegments(segments: string[]): boolean {
  const hasSegments = segments.length > 0;
  return hasSegments === true;
}

function hasWorkspaceFileTreeParentPath(parentPath: string): boolean {
  const hasParentPath = parentPath.length > 0;
  return hasParentPath === true;
}

function getWorkspaceFileTreeLeafType(
  segment: string,
  isLeaf: boolean,
  leafType?: FileNodeType,
): FileNodeType {
  if (isLeaf === false) {
    return 'folder';
  }

  if (leafType !== undefined) {
    return leafType;
  }

  return inferFileNodeTypeFromPath(segment);
}

function getWorkspaceFileNodeChildren(children: FileNode[] | undefined): FileNode[] {
  if (children === undefined) {
    return [];
  }

  return children;
}

function getNormalizedWorkspaceFileNodeChildren(children: FileNode[] | undefined): FileNode[] | undefined {
  const hasChildren = Array.isArray(children);
  if (hasChildren === false) {
    return undefined;
  }

  return materializeNormalizedWorkspaceFileNodeChildren(children);
}

function materializeNormalizedWorkspaceFileNodeChildren(children: FileNode[]): FileNode[] {
  const normalizedChildren: FileNode[] = [];

  for (const child of children) {
    const normalizedChild = normalizeFileNode(child);
    const shouldKeepChild = shouldKeepNormalizedWorkspaceFileNode(normalizedChild);
    if (shouldKeepChild === true) {
      normalizedChildren.push(normalizedChild);
    }
  }

  return normalizedChildren;
}

function hasWorkspaceFileNodeChildren(children: FileNode[] | undefined): children is FileNode[] {
  const hasChildren = children !== undefined;
  return hasChildren === true;
}

function hasWorkspaceGeneratedFilesEventList(files: unknown): files is unknown[] {
  const hasFiles = Array.isArray(files);
  return hasFiles === true;
}

function isWorkspaceGeneratedFile(value: unknown): value is WorkspaceGeneratedFile {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false;
  }

  const file = value as { path?: unknown; content?: unknown };
  return typeof file.path === 'string' && typeof file.content === 'string';
}

function sortFileNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    const typeWeight = (node: FileNode) => (node.type === 'folder' || node.type === 'directory' ? 0 : 1);
    const typeDiff = typeWeight(a) - typeWeight(b);
    if (typeDiff !== 0) return typeDiff;
    return a.name.localeCompare(b.name);
  });
}

function getWorkspaceFileTreeNodeIndex(nodes: FileNode[], path: string): number {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const isTargetNode = node.path === path;
    if (isTargetNode === true) {
      return index;
    }
  }

  return -1;
}

function materializeWorkspaceFileTreeNodeList(nodes: FileNode[]): FileNode[] {
  const nextNodes: FileNode[] = [];

  for (const node of nodes) {
    nextNodes.push(node);
  }

  return nextNodes;
}

export function upsertFilePathIntoTree(
  nodes: FileNode[],
  filePath: string,
  leafType?: FileNodeType,
): FileNode[] {
  const segments = getWorkspaceFileTreePathSegments(filePath);
  const hasSegments = hasWorkspaceFileTreePathSegments(segments);
  if (hasSegments === false) return nodes;

  const insert = (currentNodes: FileNode[], index: number, parentPath: string): FileNode[] => {
    const segment = segments[index];
    const hasParentPath = hasWorkspaceFileTreeParentPath(parentPath);
    const currentPath = hasParentPath === true ? `${parentPath}/${segment}` : segment;
    const isLeaf = index === segments.length - 1;
    const expectedType = getWorkspaceFileTreeLeafType(segment, isLeaf, leafType);
    const existingIndex = getWorkspaceFileTreeNodeIndex(currentNodes, currentPath);
    const nextNodes = materializeWorkspaceFileTreeNodeList(currentNodes);

    if (existingIndex >= 0) {
      const existingNode = nextNodes[existingIndex];
      if (isLeaf === false) {
        nextNodes[existingIndex] = {
          ...existingNode,
          type: existingNode.type === 'file' ? 'folder' : existingNode.type,
          children: insert(getWorkspaceFileNodeChildren(existingNode.children), index + 1, currentPath),
        };
      }
      return nextNodes;
    }

    const nextNode: FileNode = {
      name: segment,
      path: currentPath,
      type: expectedType,
      children: isLeaf === true ? undefined : insert([], index + 1, currentPath),
    };
    nextNodes.push(nextNode);
    return sortFileNodes(nextNodes);
  };

  return insert(nodes, 0, '');
}

export function removeFilePathFromTree(nodes: FileNode[], targetPath: string): FileNode[] {
  const normalizedTargetPath = targetPath.trim();
  if (normalizedTargetPath.length === 0) return nodes;

  const nextNodes: FileNode[] = [];
  for (const node of nodes) {
    const isTargetNode = node.path === normalizedTargetPath;
    if (isTargetNode === true) {
      continue;
    }

    nextNodes.push({
      ...node,
      children: hasWorkspaceFileNodeChildren(node.children) === true
        ? removeFilePathFromTree(node.children, normalizedTargetPath)
        : node.children,
    });
  }

  return nextNodes;
}

export function renameFilePathInTree(
  nodes: FileNode[],
  fromPath: string,
  toPath: string,
  leafType?: FileNodeType,
): FileNode[] {
  const normalizedFromPath = fromPath.trim();
  const normalizedToPath = toPath.trim();
  const hasNormalizedFromPath = normalizedFromPath.length > 0;
  const hasNormalizedToPath = normalizedToPath.length > 0;
  if (hasNormalizedFromPath === false || hasNormalizedToPath === false || normalizedFromPath === normalizedToPath) {
    return nodes;
  }
  return upsertFilePathIntoTree(removeFilePathFromTree(nodes, normalizedFromPath), normalizedToPath, leafType);
}

export function getGeneratedFilesFromEvent(data: WorkspaceStreamEventData): WorkspaceGeneratedFileList {
  const files = data.files;
  const hasFiles = hasWorkspaceGeneratedFilesEventList(files);
  if (hasFiles === false) return [];

  const generatedFiles: WorkspaceGeneratedFileList = [];
  for (const file of files) {
    const isGeneratedFile = isWorkspaceGeneratedFile(file);
    if (isGeneratedFile === true) {
      generatedFiles.push(file);
    }
  }

  return generatedFiles;
}

export function normalizeWorkflowStep(raw: WorkspaceWorkflowStepEventData | null | undefined): WorkflowStep | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? sanitizeWorkspaceText(raw.title) : '';
  if (title.length === 0) return null;

  const status = typeof raw.status === 'string' ? raw.status : undefined;
  const hasMeta = raw.meta !== null && raw.meta !== undefined && typeof raw.meta === 'object';
  const meta = hasMeta === true ? materializeWorkspaceWorkflowStepMeta(raw.meta as WorkspaceStreamEventData) : undefined;

  return {
    id: typeof raw.id === 'string' ? sanitizeWorkspaceText(raw.id) : `${typeof raw.kind === 'string' ? raw.kind : 'step'}-${title}`,
    kind: typeof raw.kind === 'string' ? raw.kind : 'step',
    title,
    detail: typeof raw.detail === 'string' ? sanitizeWorkspaceText(raw.detail) : undefined,
    status: status === 'pending' || status === 'running' || status === 'done' || status === 'failed'
      ? status
      : undefined,
    meta,
  };
}

function isWorkflowStep(value: WorkflowStep | null): value is WorkflowStep {
  return value !== null;
}

function materializeWorkspaceWorkflowStepMeta(rawMeta: WorkspaceStreamEventData): WorkspaceStreamEventData {
  const meta: WorkspaceStreamEventData = {};

  for (const [key, value] of Object.entries(rawMeta)) {
    if (typeof value === 'string') {
      meta[key] = sanitizeWorkspaceText(value);
    } else {
      meta[key] = value;
    }
  }

  return meta;
}

function getRestoredWorkspacePlanList(
  plans: WorkspaceRestoredMessagePayload['plans'],
): NonNullable<WorkspaceRestoredMessagePayload['plans']> {
  if (Array.isArray(plans) === false) {
    return [];
  }

  return plans;
}

function getRestoredWorkspaceSessionMessages(
  sessionMessages: WorkspaceChatMessage[] | undefined,
): WorkspaceChatMessage[] {
  if (sessionMessages === undefined) {
    return [];
  }

  return sessionMessages;
}

function hasRestoredWorkspaceMessageList(messages: WorkspaceChatMessage[]): boolean {
  const hasMessages = messages.length > 0;
  return hasMessages === true;
}

function getMergedRestoredWorkspaceMessageValue<TValue>(
  restoredValue: TValue | undefined,
  sessionValue: TValue | undefined,
): TValue | undefined {
  if (restoredValue === undefined) {
    return sessionValue;
  }

  return restoredValue;
}

function getWorkflowStepList(steps: WorkflowStep[] | undefined): WorkflowStep[] {
  if (steps === undefined) {
    return [];
  }

  return steps;
}

function hasWorkflowStepList(steps: WorkflowStep[]): boolean {
  const hasSteps = steps.length > 0;
  return hasSteps === true;
}

function getWorkflowStepMeta(meta: WorkflowStepMeta | undefined): WorkflowStepMeta {
  if (meta === undefined) {
    return {};
  }

  return meta;
}

function getWorkspaceMessageWorkflowSteps(message: WorkspaceChatMessage): WorkflowStep[] {
  return getWorkflowStepList(message.workflowSteps);
}

function getWorkspaceMessageKind(message: WorkspaceChatMessage): WorkspaceChatMessageKind | '' {
  const kind = message.kind;
  if (kind === undefined) {
    return '';
  }

  return kind;
}

function normalizeWorkflowSteps(rawSteps: WorkspaceRestoredMessagePayload['workflowSteps']): WorkflowStep[] | undefined {
  if (Array.isArray(rawSteps) === false) return undefined;
  const normalizedSteps = materializeNormalizedWorkflowSteps(rawSteps);
  return normalizedSteps.length > 0 ? normalizedSteps : undefined;
}

function materializeNormalizedWorkflowSteps(rawSteps: WorkspaceRestoredMessagePayload['workflowSteps']): WorkflowStep[] {
  const normalizedSteps: WorkflowStep[] = [];

  if (Array.isArray(rawSteps) === false) {
    return normalizedSteps;
  }

  for (const step of rawSteps) {
    const normalizedStep = normalizeWorkflowStep(step);
    const hasWorkflowStep = isWorkflowStep(normalizedStep);
    if (hasWorkflowStep === true) {
      normalizedSteps.push(normalizedStep);
    }
  }

  return normalizedSteps;
}

function materializeRestoredVisualAttachments(
  attachments: VisualAttachmentInput[],
): FileAttachment[] {
  const restoredAttachments: FileAttachment[] = [];
  for (const attachment of attachments) {
    restoredAttachments.push({
      name: attachment.name,
      size: attachment.size,
      type: attachment.content_type,
      dataUrl: attachment.data_url,
    });
  }
  return restoredAttachments;
}

export function deserializeWorkspaceMessage(message: ProjectMessage): WorkspaceChatMessage {
  const attachments = materializeRestoredVisualAttachments(
    parseVisualAttachmentInputsJSON(message.visual_attachments),
  );
  const restoredAttachments = attachments.length > 0 ? attachments : undefined;
  const visualContext = parseVisualContextJSON(message.visual_context);

  try {
    const parsed = JSON.parse(message.content) as WorkspaceRestoredMessagePayload;
    const hasParsedPayload = parsed !== null && typeof parsed === 'object';

    if (hasParsedPayload === true && parsed.kind === 'plan-options' && typeof parsed.content === 'string') {
      return {
        id: String(message.id),
        role: message.role,
        kind: 'plan-options',
        content: parsed.content,
        reasoningContent: typeof parsed.reasoningContent === 'string' ? parsed.reasoningContent : undefined,
        statusContent: typeof parsed.statusContent === 'string' ? parsed.statusContent : undefined,
        timestamp: message.created_at ?? new Date().toISOString(),
        attachments: restoredAttachments,
        visualContext,
        plans: getRestoredWorkspacePlanList(parsed.plans),
        recommendedPlanId: parsed.recommendedPlanId ?? undefined,
        selectedPlanId: parsed.selectedPlanId ?? undefined,
        autoSelected: parsed.autoSelected ?? undefined,
        planStreamComplete: parsed.planStreamComplete ?? undefined,
        planSuperseded: parsed.planSuperseded ?? undefined,
        suggestedQuestions: parsed.suggestedQuestions ?? undefined,
        suggestedActions: parsed.suggestedActions ?? undefined,
        workflowSteps: normalizeWorkflowSteps(parsed.workflowSteps),
        engineeringState: normalizeWorkspaceEngineeringState(parsed.engineeringState),
        streaming: parsed.streaming ?? undefined,
      };
    }

    if (hasParsedPayload === true && parsed.kind === 'workflow' && typeof parsed.content === 'string') {
      return {
        id: String(message.id),
        role: message.role,
        kind: 'workflow',
        content: parsed.content,
        timestamp: message.created_at ?? new Date().toISOString(),
        attachments: restoredAttachments,
        visualContext,
        reasoningContent: typeof parsed.reasoningContent === 'string' ? parsed.reasoningContent : undefined,
        statusContent: typeof parsed.statusContent === 'string' ? parsed.statusContent : undefined,
        workflowSteps: normalizeWorkflowSteps(parsed.workflowSteps),
        engineeringState: normalizeWorkspaceEngineeringState(parsed.engineeringState),
        streaming: parsed.streaming ?? undefined,
        suggestedQuestions: parsed.suggestedQuestions ?? undefined,
        suggestedActions: parsed.suggestedActions ?? undefined,
      };
    }
  } catch {
    // Ignore JSON parse failure and treat the message as plain text.
  }

  return {
    id: String(message.id),
    role: message.role,
    content: message.content,
    timestamp: message.created_at ?? new Date().toISOString(),
    attachments: restoredAttachments,
    visualContext,
  };
}

export function mergeRestoredWorkspaceMessages(
  restoredMessages: WorkspaceChatMessage[],
  sessionMessages?: WorkspaceChatMessage[],
): WorkspaceChatMessage[] {
  const nextSessionMessages = getRestoredWorkspaceSessionMessages(sessionMessages);
  const hasSessionMessages = hasRestoredWorkspaceMessageList(nextSessionMessages);
  if (hasSessionMessages === false) return restoredMessages;
  if (restoredMessages.length === 0) return nextSessionMessages;

  const baseMessages = materializeRestoredWorkspaceBaseMessages(restoredMessages);
  const existingIdentityKeys = materializeRestoredWorkspaceIdentityIndexes(baseMessages);

  for (const message of nextSessionMessages) {
    const identityKey = buildWorkspaceMessageIdentityKey(message);
    const idIndex = getRestoredWorkspaceMessageIndex(baseMessages, message.id);
    const hasIdentityKey = identityKey.length > 0;
    const identityIndex = hasIdentityKey === true ? existingIdentityKeys.get(identityKey) : undefined;
    const existingIndex = idIndex >= 0 ? idIndex : identityIndex;
    if (typeof existingIndex === 'number' && existingIndex >= 0) {
      baseMessages[existingIndex] = mergeRestoredWorkspaceMessage(baseMessages[existingIndex], message);
      continue;
    }
    const shouldPreserveMessage = shouldPreserveSupplementalWorkspaceMessage(message);
    if (shouldPreserveMessage === false) {
      continue;
    }
    baseMessages.push(message);
    if (hasIdentityKey === true) {
      existingIdentityKeys.set(identityKey, baseMessages.length - 1);
    }
  }

  return baseMessages;
}

function materializeRestoredWorkspaceBaseMessages(messages: WorkspaceChatMessage[]): WorkspaceChatMessage[] {
  const baseMessages: WorkspaceChatMessage[] = [];

  for (const message of messages) {
    baseMessages.push(message);
  }

  return baseMessages;
}

function materializeRestoredWorkspaceIdentityIndexes(messages: WorkspaceChatMessage[]): Map<string, number> {
  const identityKeys = new Map<string, number>();

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const identityKey = buildWorkspaceMessageIdentityKey(message);
    const hasIdentityKey = identityKey.length > 0;
    if (hasIdentityKey === true) {
      identityKeys.set(identityKey, index);
    }
  }

  return identityKeys;
}

function getRestoredWorkspaceMessageIndex(messages: WorkspaceChatMessage[], messageId: string): number {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const isTargetMessage = message.id === messageId;
    if (isTargetMessage === true) {
      return index;
    }
  }

  return -1;
}

function mergeRestoredWorkspaceMessage(
  restoredMessage: WorkspaceChatMessage,
  sessionMessage: WorkspaceChatMessage,
): WorkspaceChatMessage {
  return {
    ...sessionMessage,
    ...restoredMessage,
    reasoningContent: getMergedRestoredWorkspaceMessageValue(
      restoredMessage.reasoningContent,
      sessionMessage.reasoningContent,
    ),
    statusContent: getMergedRestoredWorkspaceMessageValue(
      restoredMessage.statusContent,
      sessionMessage.statusContent,
    ),
    attachments: getMergedRestoredWorkspaceMessageValue(
      restoredMessage.attachments,
      sessionMessage.attachments,
    ),
    visualContext: getMergedRestoredWorkspaceMessageValue(
      restoredMessage.visualContext,
      sessionMessage.visualContext,
    ),
    suggestedQuestions: getMergedRestoredWorkspaceMessageValue(
      restoredMessage.suggestedQuestions,
      sessionMessage.suggestedQuestions,
    ),
    suggestedActions: getMergedRestoredWorkspaceMessageValue(
      restoredMessage.suggestedActions,
      sessionMessage.suggestedActions,
    ),
    workflowSteps: mergeWorkflowSteps(restoredMessage.workflowSteps, sessionMessage.workflowSteps),
    engineeringState: mergeWorkspaceEngineeringState(restoredMessage.engineeringState, sessionMessage.engineeringState),
    gateResult: getMergedRestoredWorkspaceMessageValue(restoredMessage.gateResult, sessionMessage.gateResult),
    streaming: getMergedRestoredWorkspaceMessageValue(restoredMessage.streaming, sessionMessage.streaming),
  };
}

function mergeWorkflowSteps(existing?: WorkflowStep[], incoming?: WorkflowStep[]) {
  const existingSteps = getWorkflowStepList(existing);
  const incomingSteps = getWorkflowStepList(incoming);
  const hasExistingSteps = hasWorkflowStepList(existingSteps);
  const hasIncomingSteps = hasWorkflowStepList(incomingSteps);
  if (hasExistingSteps === false) return incoming;
  if (hasIncomingSteps === false) return existing;

  const merged = materializeWorkflowStepList(existingSteps);
  const stepIndexes = materializeWorkflowStepIndexes(merged);

  for (const step of incomingSteps) {
    const index = stepIndexes.get(step.id);
    if (typeof index === 'number') {
      merged[index] = {
        ...step,
        ...merged[index],
        meta: {
          ...getWorkflowStepMeta(step.meta),
          ...getWorkflowStepMeta(merged[index].meta),
        },
      };
      continue;
    }
    stepIndexes.set(step.id, merged.length);
    merged.push(step);
  }
  return merged;
}

function materializeWorkflowStepList(steps: WorkflowStep[]): WorkflowStep[] {
  const nextSteps: WorkflowStep[] = [];

  for (const step of steps) {
    nextSteps.push(step);
  }

  return nextSteps;
}

function materializeWorkflowStepIndexes(steps: WorkflowStep[]): Map<string, number> {
  const indexes = new Map<string, number>();

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    indexes.set(step.id, index);
  }

  return indexes;
}

function mergeWorkspaceEngineeringState(
  restoredState?: WorkspaceEngineeringStateSnapshot,
  sessionState?: WorkspaceEngineeringStateSnapshot,
): WorkspaceEngineeringStateSnapshot | undefined {
  if (restoredState === undefined) return sessionState;
  if (sessionState === undefined) return restoredState;

  return {
    workflow: mergeWorkspaceStateSection(restoredState.workflow, sessionState.workflow),
    validation: mergeWorkspaceStateSection(restoredState.validation, sessionState.validation),
    runtime: mergeWorkspaceStateSection(restoredState.runtime, sessionState.runtime),
    plan_selection: mergeWorkspaceStateSection(restoredState.plan_selection, sessionState.plan_selection),
    phase: mergeWorkspaceStateSection(restoredState.phase, sessionState.phase),
    execution: mergeWorkspaceStateSection(restoredState.execution, sessionState.execution),
    recovery: mergeWorkspaceStateSection(restoredState.recovery, sessionState.recovery),
    bootstrap_state: mergeWorkspaceStateSection(restoredState.bootstrap_state, sessionState.bootstrap_state),
  };
}

function mergeWorkspaceStateSection<T extends object>(
  restoredSection?: T,
  sessionSection?: T,
): T | undefined {
  if (restoredSection === undefined) return sessionSection;
  if (sessionSection === undefined) return restoredSection;
  return {
    ...sessionSection,
    ...restoredSection,
  };
}

function shouldPreserveSupplementalWorkspaceMessage(message: WorkspaceChatMessage) {
  const hasEngineeringState = message.engineeringState !== undefined;
  const hasGateResult = message.gateResult !== undefined;
  const workflowSteps = getWorkspaceMessageWorkflowSteps(message);
  const hasWorkflowSteps = hasWorkflowStepList(workflowSteps);
  return message.kind === 'workflow'
    || hasEngineeringState === true
    || hasGateResult === true
    || hasWorkflowSteps === true;
}

function buildWorkspaceMessageIdentityKey(message: WorkspaceChatMessage) {
  const createdAt = typeof message.timestamp === 'string'
    ? message.timestamp
    : message.timestamp instanceof Date
      ? message.timestamp.toISOString()
      : '';
  return [
    message.role,
    getWorkspaceMessageKind(message),
    createdAt,
    message.content,
  ].join('|');
}

function normalizeFileNode(node: FileNode): FileNode {
  const normalizedName = sanitizeWorkspaceFilePathText(node.name);
  const normalizedPath = sanitizeWorkspaceFilePathText(node.path);
  return {
    ...node,
    name: normalizedName,
    path: normalizedPath,
    type: node.type === 'directory' ? 'folder' : node.type,
    children: getNormalizedWorkspaceFileNodeChildren(node.children),
  };
}

function shouldKeepNormalizedWorkspaceFileNode(node: FileNode): boolean {
  const hasPath = node.path.length > 0;
  if (hasPath === true) {
    return true;
  }

  const children = getWorkspaceFileNodeChildren(node.children);
  const hasChildren = children.length > 0;
  return hasChildren === true;
}

export function normalizeFileTreePayload(tree: FileNode | FileNode[] | null | undefined): FileNode[] {
  if (tree === null || tree === undefined) return [];
  if (Array.isArray(tree)) {
    return materializeNormalizedFileTreePayload(tree);
  }
  const normalizedRoot = normalizeFileNode(tree);
  const hasNormalizedRootPath = normalizedRoot.path.length > 0;
  const normalizedRootChildren = getWorkspaceFileNodeChildren(normalizedRoot.children);
  const hasNormalizedRootChildren = normalizedRootChildren.length > 0;
  if (hasNormalizedRootPath === false && hasNormalizedRootChildren === true) {
    return normalizedRootChildren;
  }
  return hasNormalizedRootPath === true || normalizedRoot.name !== '.'
    ? [normalizedRoot]
    : [];
}

function materializeNormalizedFileTreePayload(tree: FileNode[]): FileNode[] {
  const normalizedTree: FileNode[] = [];

  for (const node of tree) {
    const normalizedNode = normalizeFileNode(node);
    const shouldKeepNode = shouldKeepNormalizedWorkspaceFileNode(normalizedNode);
    if (shouldKeepNode === true) {
      normalizedTree.push(normalizedNode);
    }
  }

  return normalizedTree;
}
