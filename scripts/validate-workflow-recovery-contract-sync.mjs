#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const backendDirs = [
  path.join(rootDir, 'backend/internal/orchestration'),
  path.join(rootDir, 'backend/internal/service'),
  path.join(rootDir, 'backend/internal/handler'),
];
const frontendDirs = [
  path.join(rootDir, 'src/app/workspace'),
  path.join(rootDir, 'src/components/workspace'),
];
const frontendContractPath = path.join(rootDir, 'src/lib/workspace/workflow-contract.ts');

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function uniqueSorted(values) {
  return [...new Set(values)].filter(Boolean).sort((left, right) => left.localeCompare(right));
}

function extractTsStringArray(source, constantName) {
  const pattern = new RegExp(`export\\s+const\\s+${constantName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as\\s+const`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Missing TS contract array: ${constantName}`);
  }
  return uniqueSorted([...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]));
}

function extractTsStringRecordKeys(source, constantName) {
  const pattern = new RegExp(`export\\s+const\\s+${constantName}[^=]*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Missing TS contract record: ${constantName}`);
  }
  return uniqueSorted([...match[1].matchAll(/(?:^|\n)\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*:/g)]
    .map((item) => item[1] || item[2]));
}

function extractBackendPauseReasons(source) {
  return uniqueSorted([
    ...[...source.matchAll(/withExecutionPause\(\s*(?:true|false)\s*,\s*"([^"]*)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/"pause_reason"\s*:\s*"([^"]+)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/PauseReason:\s*"([^"]+)"/g)].map((match) => match[1]),
  ]);
}

function extractBackendApprovalBoundaries(source) {
  return uniqueSorted([
    ...[...source.matchAll(/withExecutionPause\(\s*(?:true|false)\s*,\s*"[^"]*"\s*,\s*"([^"]*)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/"approval_boundary"\s*:\s*"([^"]+)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/ApprovalBoundary:\s*"([^"]+)"/g)].map((match) => match[1]),
  ]);
}

function extractFrontendCodeValues(source, fieldName) {
  const patterns = [
    new RegExp(`${fieldName}\\s*:\\s*'([^']+)'`, 'g'),
    new RegExp(`${fieldName}\\s*:\\s*[^?]+\\?\\s*'([^']+)'`, 'g'),
    new RegExp(`${fieldName}\\s*===\\s*'([^']+)'`, 'g'),
  ];

  return uniqueSorted(patterns.flatMap((pattern) => (
    [...source.matchAll(pattern)].map((match) => match[1])
  )));
}

function assertCovered(label, observed, allowed) {
  const allowedSet = new Set(allowed);
  const missing = observed.filter((item) => !allowedSet.has(item));
  if (missing.length > 0) {
    throw new Error(`[YES] Workflow recovery contract drift detected: ${label} missing ${missing.join(', ')}`);
  }
}

function assertSameSet(label, left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const missing = right.filter((item) => !leftSet.has(item));
  const extra = left.filter((item) => !rightSet.has(item));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error([
      `[YES] Workflow recovery contract drift detected: ${label}`,
      missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
      extra.length > 0 ? `extra: ${extra.join(', ')}` : undefined,
    ].filter(Boolean).join('\n'));
  }
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) {
    throw new Error(`[YES] Workflow recovery contract drift detected: ${message}`);
  }
}

function assertNotIncludes(source, snippet, message) {
  if (source.includes(snippet)) {
    throw new Error(`[YES] Workflow recovery contract drift detected: ${message}`);
  }
}

const backendSource = backendDirs
  .flatMap((dir) => walkFiles(dir, (filePath) => filePath.endsWith('.go') && !filePath.endsWith('_test.go')))
  .map(readText)
  .join('\n');
const frontendSource = frontendDirs
  .flatMap((dir) => walkFiles(dir, (filePath) => /\.(ts|tsx)$/.test(filePath) && !filePath.endsWith('.test.ts')))
  .map(readText)
  .join('\n');
const frontendContractSource = readText(frontendContractPath);
const workspaceTypesSource = readText(path.join(rootDir, 'src/app/workspace/workspace-types.ts'));
const workspacePageEffectsSource = readText(path.join(rootDir, 'src/app/workspace/use-workspace-page-effects.ts'));
const workspaceGenerationJobReplaySource = readText(path.join(rootDir, 'src/app/workspace/workspace-generation-job-replay.ts'));
const workspaceBusinessBoundaryErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/workspace-business-boundary-errors.ts'));
const workspaceStreamBoundaryErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/workspace-stream-boundary-errors.ts'));
const guidanceSnapshotSource = readText(path.join(rootDir, 'src/app/workspace/workspace-guidance-snapshot.ts'));
const messageRenderSnapshotSource = readText(path.join(rootDir, 'src/app/workspace/workspace-message-render-snapshot.ts'));
const chatThoughtProcessSnapshotSource = readText(path.join(rootDir, 'src/app/workspace/workspace-chat-thought-process-snapshot.ts'));

const backendPauseReasons = extractBackendPauseReasons(backendSource);
const backendApprovalBoundaries = extractBackendApprovalBoundaries(backendSource);
const frontendPauseReasons = extractFrontendCodeValues(frontendSource, 'pause_reason');
const frontendApprovalBoundaries = extractFrontendCodeValues(frontendSource, 'approval_boundary');

const contractBackendPauseReasons = extractTsStringArray(frontendContractSource, 'WORKSPACE_BACKEND_EXECUTION_PAUSE_REASONS');
const contractFrontendLocalPauseReasons = extractTsStringArray(frontendContractSource, 'WORKSPACE_FRONTEND_LOCAL_EXECUTION_PAUSE_REASONS');
const contractAllPauseReasons = uniqueSorted([...contractBackendPauseReasons, ...contractFrontendLocalPauseReasons]);
const contractPauseReasonLabelKeys = extractTsStringRecordKeys(frontendContractSource, 'WORKSPACE_EXECUTION_PAUSE_REASON_LABELS');
const contractBackendApprovalBoundaries = extractTsStringArray(frontendContractSource, 'WORKSPACE_BACKEND_APPROVAL_BOUNDARIES');
const contractFrontendLocalApprovalBoundaries = extractTsStringArray(frontendContractSource, 'WORKSPACE_FRONTEND_LOCAL_APPROVAL_BOUNDARIES');
const contractAllApprovalBoundaries = uniqueSorted([...contractBackendApprovalBoundaries, ...contractFrontendLocalApprovalBoundaries]);
const contractApprovalBoundaryLabelKeys = extractTsStringRecordKeys(frontendContractSource, 'WORKSPACE_APPROVAL_BOUNDARY_LABELS');

assertCovered('backend pause_reason values must be in backend contract', backendPauseReasons, contractBackendPauseReasons);
assertCovered('backend approval_boundary values must be in backend contract', backendApprovalBoundaries, contractBackendApprovalBoundaries);
assertCovered('frontend pause_reason values must be in full contract', frontendPauseReasons, contractAllPauseReasons);
assertCovered('frontend approval_boundary values must be in full contract', frontendApprovalBoundaries, contractAllApprovalBoundaries);
assertSameSet('pause_reason label keys must match full contract', contractPauseReasonLabelKeys, contractAllPauseReasons);
assertSameSet('approval_boundary label keys must match full contract', contractApprovalBoundaryLabelKeys, contractAllApprovalBoundaries);

assertIncludes(frontendSource, "'open_validation_failure'", 'GuidanceAction must include open_validation_failure');
assertIncludes(frontendSource, "'open_context_repair'", 'GuidanceAction must include open_context_repair');
assertIncludes(frontendSource, "'open_foundation_panel'", 'GuidanceAction must include open_foundation_panel');
assertIncludes(frontendSource, "'refresh_explorer_panel'", 'GuidanceAction must include refresh_explorer_panel');
assertIncludes(frontendSource, "'open_explorer_panel'", 'GuidanceAction must include open_explorer_panel');
assertIncludes(frontendSource, "'open_git_panel'", 'GuidanceAction must include open_git_panel');
assertIncludes(frontendSource, 'navigationTarget?: WorkspaceEditorNavigationTarget', 'GuidanceAction must carry validation failure navigation targets');
assertIncludes(frontendSource, "kind: 'open_validation_failure'", 'validation gate failure patch must build an executable open_validation_failure action');
assertIncludes(frontendSource, "kind: 'open_context_repair'", 'context gate failure patch must build an executable open_context_repair action');
assertNotIncludes(frontendSource, "kind: 'open_foundation_panel'", 'foundation gate recovery must not generate a visible Foundation panel action');
assertIncludes(frontendSource, 'buildValidationFailureSuggestedAction', 'validation gate failure patch must derive the first repairable failure item');
assertIncludes(frontendSource, 'buildContextRepairSuggestedAction', 'context gate failure patch must derive the first repair target');
assertIncludes(frontendSource, 'buildFoundationAutoRetrySuggestedAction', 'implementation foundation gate patch must build an automatic foundation retry action');
assertIncludes(frontendSource, 'canOpenWorkspacePromptRepairNavigation(action)', 'suggested action handler must derive repair navigation capability through a named fact');
assertIncludes(frontendSource, 'getWorkspacePromptNavigationTarget(action)', 'suggested action handler must read validation failure navigation targets through a named reader');
assertIncludes(frontendSource, 'onOpenValidationFailure(navigationTarget)', 'suggested action handler must open validation failure navigation targets');
assertIncludes(frontendSource, "action.kind === 'open_foundation_panel'", 'suggested action handler must keep legacy foundation panel action compatibility');
assertIncludes(frontendSource, 'await requestPlansForProject({', 'legacy foundation panel action should retry automatic project setup instead of opening a panel');
assertIncludes(frontendSource, 'await onRefreshExplorerPanel()', 'suggested action handler must execute the Explorer refresh action');
assertIncludes(frontendSource, 'onOpenExplorerPanel()', 'suggested action handler must execute the Explorer open action');
assertIncludes(frontendSource, 'onOpenGitPanel()', 'suggested action handler must open the Git panel action');
assertIncludes(frontendSource, 'onOpenValidationFailure: projectActions.openWorkspaceFile', 'workspace conversation actions must reuse the existing openWorkspaceFile path');
assertIncludes(frontendSource, 'onRefreshExplorerPanel: projectActions.refreshExplorerPanel', 'workspace conversation actions must wire Explorer refresh recovery actions');
assertNotIncludes(frontendSource, "setActiveTab('foundation')", 'workspace conversation actions must not open a visible Foundation tab');
assertIncludes(frontendSource, "kind === 'refresh_explorer_panel'", 'guidance recovery summary should treat Explorer refresh as a recovery action');
assertIncludes(frontendSource, "setActiveTab('git')", 'workspace conversation actions must open the Git tab');
assertIncludes(frontendSource, 'buildPlanFoundationGateActions', 'plan foundation gate should expose structured recovery actions');
assertIncludes(workspaceBusinessBoundaryErrorsSource, "source: 'plan_generation_finalization'", 'plan generation finalization should expose empty-plan result source/details');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'export type PlanGenerationFinalizationErrorPayload = {', 'plan generation finalization should expose a named error payload contract');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'generated_plans=${payload.generatedPlans.length}', 'plan generation finalization should include empty result counts in details');
assertIncludes(frontendSource, 'buildPlanGenerationFinalizationError(payload)', 'plan generation finalization should use the shared business boundary error helper');
assertIncludes(frontendSource, 'deriveWorkspaceGuidanceActions', 'workspace suggested action fallback should be centralized');
assertIncludes(frontendSource, 'WorkspaceGuidanceActions', 'workspace suggested action rendering should use the shared guidance component');
assertIncludes(frontendSource, 'getWorkspaceGuidanceActionKey', 'workspace suggested action keys should be centralized');
assertIncludes(frontendSource, 'WORKSPACE_GUIDANCE_ACTION_PRIORITY', 'workspace suggested action ordering should be centralized');
assertIncludes(frontendSource, 'sortWorkspaceGuidanceActions', 'workspace suggested actions should use a stable priority sort');
assertIncludes(frontendSource, 'deriveWorkspaceGuidanceActionViewModels', 'workspace suggested action view models should be centralized');
assertIncludes(frontendSource, "export type WorkspaceGuidanceActionTone = 'primary' | 'secondary'", 'workspace suggested action primary/secondary tone should use an exported contract');
assertIncludes(frontendSource, 'getWorkspaceGuidanceActionTone', 'workspace suggested action primary/secondary tone should be centralized');
assertIncludes(frontendSource, 'WorkspaceGuidanceSnapshot', 'workspace guidance should type its structured guidance snapshot explicitly');
assertIncludes(frontendSource, 'buildWorkspaceGuidanceSnapshot', 'workspace guidance should derive a structured guidance snapshot from questions, actions and recovery fallback');
assertIncludes(guidanceSnapshotSource, 'WorkspaceGuidanceSnapshotStatus', 'workspace guidance snapshot should use named status contract');
assertIncludes(guidanceSnapshotSource, "status: WorkspaceGuidanceSnapshotStatus = 'recovery_fallback'", 'workspace guidance snapshot should distinguish engineering recovery fallback');
assertIncludes(guidanceSnapshotSource, 'hasRecoveryRetry', 'workspace guidance snapshot should preserve recovery retry fallback input');
assertIncludes(frontendSource, 'data-testid="workspace-guidance-snapshot"', 'workspace guidance should render a stable guidance snapshot target');
assertIncludes(frontendSource, "status: WorkspaceGuidanceSnapshotStatus = 'recovery_fallback'", 'workspace guidance snapshot should distinguish engineering recovery fallback actions');
assertIncludes(frontendSource, "Questions: {guidanceSnapshot.questionCount}", 'workspace guidance snapshot should expose suggested question count');
assertIncludes(frontendSource, "Retry: {guidanceSnapshot.retryActionCount}", 'workspace guidance snapshot should expose retry action count');
assertIncludes(frontendSource, 'deriveWorkspaceRecoveryActionSummary', 'workspace engineering state should derive recovery action summary from shared guidance actions');
assertIncludes(frontendSource, 'WorkspaceRecoveryActionSummary', 'workspace engineering state should type recovery action summary explicitly');
assertIncludes(frontendSource, 'recoveryActionSummary.summaryLabel', 'workspace engineering state panel should render recovery action summary');
assertIncludes(frontendSource, 'primaryActionCount', 'workspace engineering state panel should expose primary recovery action count');
assertIncludes(frontendSource, 'retryActionCount', 'workspace engineering state panel should expose retry recovery action count');
assertIncludes(frontendSource, "action.kind.startsWith('open_')", 'local recovery actions should share the primary action tone');
assertIncludes(frontendSource, "confirm_recommended_plan: 20", 'recommended plan confirmation should keep a stable primary priority');
assertIncludes(frontendSource, 'projectApi.stopGeneration(persistedProject.projectId).catch', 'manual stop generation should handle backend stop request failures');
assertIncludes(frontendSource, '停止生成请求同步失败', 'manual stop generation backend failure should append a user-visible recovery prompt');
assertIncludes(frontendSource, '本地生成流已中断，但后端可能仍在处理当前项目', 'manual stop generation backend failure should explain local/backend stop state drift');
const workspaceImplementationErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/workspace-implementation-errors.ts'));
assertIncludes(workspaceImplementationErrorsSource, 'export function formatImplementationGenerationFailure', 'local generation_failed recovery reasons should use a shared implementation error formatter');
assertIncludes(workspaceImplementationErrorsSource, "formatUserVisibleApiError(error, '请重试')", 'local generation_failed shared formatter should preserve structured source/details');
const workspaceGenerationControlErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/workspace-generation-control-errors.ts'));
assertIncludes(workspaceGenerationControlErrorsSource, 'export function formatStopGenerationSyncFailure', 'manual stop generation sync failures should use a shared generation control error formatter');
assertIncludes(workspaceGenerationControlErrorsSource, "formatUserVisibleApiError(error, '请稍后重试')", 'manual stop generation sync shared formatter should preserve structured source/details');
assertIncludes(frontendSource, 'function buildLocalGenerationFailureState(error: unknown): WorkspaceEngineeringStateSnapshot', 'frontend implementation stream failures without backend state should build a local generation_failed recovery state');
assertIncludes(frontendSource, 'formatImplementationGenerationFailure(error)', 'frontend implementation stream failures should preserve structured source/details through the shared formatter');
assertIncludes(frontendSource, 'formatStopGenerationSyncFailure(error)', 'manual stop generation backend failure should preserve structured source/details through the shared formatter');
if (frontendSource.includes('function getImplementationFailureMessage')) {
  throw new Error('[YES] Workflow recovery contract drift detected: implementation failure effects should not keep a hook-local generation_failed formatter');
}
if (workspacePageEffectsSource.includes("formatUserVisibleApiError(error, '请稍后重试')")) {
  throw new Error('[YES] Workflow recovery contract drift detected: manual stop generation sync failures should not format source/details in page effects');
}
assertIncludes(workspaceStreamBoundaryErrorsSource, 'export function readWorkspaceStreamErrorField', 'frontend implementation stream errors should use the shared safe structured SSE field reader');
assertIncludes(workspaceStreamBoundaryErrorsSource, 'export function readWorkspaceStreamErrorSource', 'frontend implementation stream errors should use the shared SSE source fallback reader');
assertIncludes(workspaceStreamBoundaryErrorsSource, 'export function readWorkspaceStreamErrorDetails', 'frontend implementation stream errors should use the shared SSE details fallback reader');
assertIncludes(frontendSource, "source: readWorkspaceStreamErrorSource(data, 'implementation_generation_stream')", 'frontend implementation stream errors should preserve SSE source with a stable local fallback');
assertIncludes(frontendSource, 'details: readWorkspaceStreamErrorDetails(data, message)', 'frontend implementation stream errors should preserve SSE details for user-visible recovery reasons');
assertIncludes(workspaceStreamBoundaryErrorsSource, 'export function buildImplementationStreamPayloadError', 'frontend implementation stream payload errors should use the shared stream boundary error builder');
assertIncludes(frontendSource, 'buildImplementationStreamPayloadError(streamError)', 'frontend implementation stream errors should not reassemble payload Error source/details locally');
assertIncludes(frontendSource, "pause_reason: 'generation_failed'", 'frontend implementation stream failures should preserve generation_failed pause reason');
assertIncludes(frontendSource, "approval_boundary: 'generation'", 'frontend implementation stream failures should preserve generation approval boundary');
assertIncludes(frontendSource, "retry_label: '重试实现阶段'", 'frontend implementation stream failures should expose a retry workflow action label');
assertIncludes(frontendSource, '当前实现阶段已进入 generation_failed 恢复状态', 'frontend implementation stream failures should explain local recovery state instead of plain text only');
assertIncludes(frontendSource, 'const shouldBuildLocalGenerationFailureState = validationGateBlocked === false', 'frontend implementation stream failures should avoid masking backend gate blockers as local generation failures');
assertIncludes(frontendSource, '?? (shouldBuildLocalGenerationFailureState === true ? buildLocalGenerationFailureState(error) : undefined);', 'frontend implementation stream failures should only synthesize local recovery for non-gate stream failures without backend engineeringState');
assertIncludes(workspacePageEffectsSource, 'projectApi.replayGenerationEvents', 'persisted generation state recovery should replay durable Job events');
assertIncludes(workspacePageEffectsSource, 'pollGenerationStatusUntilSettled', 'persisted generation state recovery should poll the durable Job summary');
assertNotIncludes(workspacePageEffectsSource, 'generation-state-restore-failed-notice', 'durable generation recovery must not append a fixed restore chat prompt');
assertIncludes(frontendSource, 'function readGenerationStateStorage()', 'persisted generation state reads should use a guarded helper');
assertIncludes(frontendSource, "export type PersistedGenerationStateStatus = 'running' | 'interrupted'", 'persisted generation state status should use a named contract');
assertIncludes(frontendSource, "export type PersistedGenerationStateReason = 'refresh' | 'manual'", 'persisted generation state reason should use a named contract');
assertIncludes(frontendSource, "export type PersistGenerationStateOperation = 'save' | 'clear'", 'persisted generation state persistence operation should use a named contract');
assertIncludes(workspaceTypesSource, 'WorkspaceGenerationStateLocalDetails', 'persisted generation state workspace types should import shared local details contract');
assertIncludes(workspaceTypesSource, 'WorkspaceGenerationStateStorageSource', 'persisted generation state workspace types should import shared storage source contract');
assertIncludes(workspaceTypesSource, 'export type PersistGenerationStateSource = WorkspaceGenerationStateStorageSource;', 'persisted generation state result should name the storage source contract');
assertIncludes(workspaceTypesSource, 'export type PersistGenerationStateDetails = WorkspaceGenerationStateLocalDetails;', 'persisted generation state result should name the details contract');
assertIncludes(frontendSource, 'status: PersistedGenerationStateStatus;', 'persisted generation state should consume the named status contract');
assertIncludes(frontendSource, 'reason?: PersistedGenerationStateReason;', 'persisted generation state should consume the named reason contract');
assertIncludes(frontendSource, 'operation: PersistGenerationStateOperation;', 'persist generation result should consume the named operation contract');
assertIncludes(workspaceTypesSource, 'source: PersistGenerationStateSource;', 'persist generation result should consume the named source contract');
assertIncludes(workspaceTypesSource, 'details: PersistGenerationStateDetails;', 'persist generation result should consume the named details contract');
if (/source: 'session_storage';[\s\S]*details: string;/.test(workspaceTypesSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: persist generation result must not regress source/details to raw contracts');
}
assertIncludes(workspacePageEffectsSource, 'WorkspaceGenerationStateLocalDetails', 'page effects generation state read/parse results should import shared local details contract');
assertIncludes(workspacePageEffectsSource, 'WorkspaceGenerationStateParseSource', 'page effects generation state parse result should import shared parse source contract');
assertIncludes(workspacePageEffectsSource, 'WorkspaceGenerationStateStorageSource', 'page effects generation state read result should import shared storage source contract');
assertIncludes(workspacePageEffectsSource, 'source: WorkspaceGenerationStateStorageSource;', 'generation state storage read failure should consume named storage source contract');
assertIncludes(workspacePageEffectsSource, 'source: WorkspaceGenerationStateParseSource;', 'generation state parse failure should consume named parse source contract');
assertIncludes(workspacePageEffectsSource, 'details: WorkspaceGenerationStateLocalDetails;', 'generation state read/parse failures should consume named details contract');
if (/source: 'session_storage';[\s\S]*details: string;|source: 'generation_state_parse';[\s\S]*details: string;/.test(workspacePageEffectsSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: generation state read/parse results must not regress source/details to raw contracts');
}
assertIncludes(frontendSource, 'function parsePersistedGenerationState(rawState: string): GenerationStateParseResult', 'persisted generation state parse failures should use an explicit parse helper');
assertIncludes(workspacePageEffectsSource, 'export type PersistedGenerationStateRawObject = {\n  [fieldName: string]: unknown;\n};', 'persisted generation state parse should name the raw JSON object boundary');
assertIncludes(workspacePageEffectsSource, 'function isPersistedGenerationStateRawObject(value: unknown): value is PersistedGenerationStateRawObject', 'persisted generation state parse should use a named raw object guard');
assertIncludes(workspacePageEffectsSource, 'isPersistedGenerationStateRawObject(parsed) === false', 'persisted generation state parse should guard parsed JSON through the named raw object contract');
assertIncludes(workspacePageEffectsSource, 'function hasPersistedGenerationStateRequiredShape(', 'persisted generation state parse should validate the required fields through a named shape fact');
assertIncludes(workspacePageEffectsSource, 'hasPersistedGenerationStateRequiredShape(parsed) === false', 'persisted generation state parse should reject invalid shapes through the named shape fact');
assertIncludes(frontendSource, 'function isPersistedGenerationStateStatus(value: unknown): value is PersistedGenerationStateStatus', 'persisted generation state parsing should use a field-level status guard');
assertIncludes(frontendSource, 'function isPersistedGenerationStateReason(value: unknown): value is PersistedGenerationStateReason', 'persisted generation state parsing should use a field-level reason guard');
assertIncludes(frontendSource, 'isPersistedGenerationStateStatus(value.status)', 'persisted generation state parsing should reject unknown status values before restoring');
assertIncludes(frontendSource, 'reason !== undefined && isPersistedGenerationStateReason(reason) === false', 'persisted generation state parsing should reject unknown interruption reasons before restoring');
if (/function isRecord\(value: unknown\): value is Record<string, unknown>|value is Record<string, unknown>|parsed as Record<string, unknown>|as Record<string, unknown>/.test(workspacePageEffectsSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: persisted generation state parsing must not regress to anonymous Record raw object boundaries');
}
if (/!isPersistedGenerationStateRawObject\(parsed\)|!isPersistedGenerationStateStatus\(parsed\.status\)|parsed\.reason !== undefined && !isPersistedGenerationStateReason\(parsed\.reason\)/.test(workspacePageEffectsSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: persisted generation state parsing must not regress to inline negated shape guards');
}
if (frontendSource.includes('parsed as PersistedGenerationState')) {
  throw new Error('[YES] Workflow recovery contract drift detected: persisted generation state parsing must not cast unknown JSON directly to PersistedGenerationState');
}
const workspaceGenerationStateLocalErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/workspace-generation-state-local-errors.ts'));
assertIncludes(workspaceGenerationStateLocalErrorsSource, "export type WorkspaceGenerationStateStorageSource = 'session_storage';", 'persisted generation state failures should name storage source contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, "export type WorkspaceGenerationStateParseSource = 'generation_state_parse';", 'persisted generation state failures should name parse source contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, "export type WorkspaceGenerationStateRestoreSource = 'generation_state_restore';", 'persisted generation state failures should name restore source contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, '| WorkspaceGenerationStateStorageSource', 'persisted generation state local source should compose storage source contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, '| WorkspaceGenerationStateParseSource', 'persisted generation state local source should compose parse source contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, '| WorkspaceGenerationStateRestoreSource', 'persisted generation state local source should compose restore source contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'export type WorkspaceGenerationStateLocalDetails = string;', 'persisted generation state failures should name local details contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'export type WorkspaceGenerationStateParseReason = string;', 'persisted generation state parse failures should name parse reason contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'export type WorkspaceGenerationStateProjectId = string;', 'persisted generation state restore failures should name project id contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'export type WorkspaceGenerationStateStatus = string;', 'persisted generation state restore failures should name status contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'details: WorkspaceGenerationStateLocalDetails;', 'persisted generation state failure details should consume named details contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'export type WorkspaceGenerationStateLocalFailureFormatInput = {', 'persisted generation state formatter should expose a named source/details input contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'failure: WorkspaceGenerationStateLocalFailureFormatInput', 'persisted generation state formatter should consume the named source/details input contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, '): WorkspaceGenerationStateLocalDetails', 'persisted generation state details helpers should return named details contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'fallback: WorkspaceGenerationStateLocalDetails', 'persisted generation state details helpers should consume named fallback contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'reason: WorkspaceGenerationStateParseReason', 'persisted generation state parse details should consume named parse reason contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'projectId: WorkspaceGenerationStateProjectId', 'persisted generation state restore failures should consume named project id contract');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'stateStatus: WorkspaceGenerationStateStatus', 'persisted generation state restore failures should consume named status contract');
if (/details: string;/.test(workspaceGenerationStateLocalErrorsSource)
  || /reason: string/.test(workspaceGenerationStateLocalErrorsSource)
  || /projectId: string/.test(workspaceGenerationStateLocalErrorsSource)
  || /stateStatus: string/.test(workspaceGenerationStateLocalErrorsSource)
  || /fallback: string/.test(workspaceGenerationStateLocalErrorsSource)
  || /Pick<WorkspaceGenerationStateLocalFailure/.test(workspaceGenerationStateLocalErrorsSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: persisted generation state local errors must not regress details/reason/project/status/fallback fields to raw string contracts');
}
assertIncludes(workspaceGenerationStateLocalErrorsSource, "source: 'generation_state_parse'", 'persisted generation state parse failures should preserve a distinct parse source');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'storage_key=yistack_generation_state；raw_length=${rawState.length}；reason=${reason}', 'persisted generation state parse failures should preserve storage key and parse details');
assertIncludes(workspaceGenerationStateLocalErrorsSource, "source: 'generation_state_restore'", 'persisted generation state restore application failures should preserve a distinct restore source');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'project_id=${projectId}；state_project_id=${stateProjectId}；state_status=${stateStatus}；reason=${reason}', 'persisted generation state restore application failures should preserve project and state details');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'buildWorkspaceGenerationStateInvalidShapeFailure', 'persisted generation state invalid shape failures should be built by the shared local helper');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'invalid_generation_state_shape', 'persisted generation state parse failures should distinguish invalid JSON shape in the shared helper');
assertIncludes(frontendSource, 'buildWorkspaceGenerationStateInvalidShapeFailure(rawState)', 'page effects should consume the shared invalid generation state helper instead of constructing parse errors locally');
if (frontendSource.includes("new Error('本地生成恢复状态结构无效')")) {
  throw new Error('[YES] Workflow recovery contract drift detected: page effects must not construct invalid generation state errors locally');
}
assertIncludes(workspaceGenerationStateLocalErrorsSource, "source: 'session_storage'", 'persisted generation state storage failures should preserve local storage source');
assertIncludes(workspaceGenerationStateLocalErrorsSource, 'formatWorkspaceGenerationStateLocalFailure', 'persisted generation state storage failures should render structured source/details through the shared helper');
assertIncludes(workspacePageEffectsSource, 'formatWorkspaceGenerationStateLocalFailure(generationStateReadResult', 'persisted generation state read failures should use the shared local formatter');
assertIncludes(workspacePageEffectsSource, "console.error(\n        '读取本地生成恢复状态失败:'", 'persisted generation state read failures should remain diagnostic without entering ordinary chat');
assertIncludes(workspacePageEffectsSource, "console.error(\n          '解析本地生成恢复状态失败:'", 'invalid persisted generation state should remain diagnostic without entering ordinary chat');
assertIncludes(workspacePageEffectsSource, 'appendGenerationStatePersistenceFailureMessage(applyPageEffectMessages, persistGenerationState(null))', 'invalid local generation state should be cleared before durable Job recovery');
for (const legacyNotice of [
  'generation-state-read-failed-notice',
  'generation-state-restore-failed-notice',
  'generation-interrupted-notice',
  '当前页面不会自动恢复中断前的生成进度',
]) {
  assertNotIncludes(workspacePageEffectsSource, legacyNotice, `durable generation recovery must not append legacy chat notice: ${legacyNotice}`);
}
assertIncludes(workspacePageEffectsSource, 'const shouldReplayGenerationJob = generationJob !== null', 'generation recovery should attach to an active durable Job or a terminal Job with unreplayed events');
assertIncludes(workspacePageEffectsSource, 'shouldReplayWorkspaceGenerationJob({', 'generation recovery should use the shared replay decision helper');
assertIncludes(workspaceGenerationJobReplaySource, 'if (generationActive === true)', 'active durable generation jobs should always replay');
assertIncludes(workspaceGenerationJobReplaySource, 'terminalReplayAllowed === true', 'terminal replay should require an explicit replay allowance');
assertIncludes(workspaceGenerationJobReplaySource, 'lastEventSequence > cursor', 'generation recovery should not skip a durable terminal event after a replay disconnect');
assertIncludes(workspacePageEffectsSource, 'startGenerationEventReplay(generationJob.id, generationJob.idempotency_key)', 'generation recovery should replay the matched durable Job into its assistant message');
assertIncludes(frontendSource, 'generation-state-persist-failed-save', 'persisted generation state save failures should append a stable user-visible prompt');
assertIncludes(frontendSource, '本地生成恢复状态保存失败', 'persisted generation state save failures should explain the local save failure');
assertIncludes(frontendSource, '刷新或离开页面后可能无法提示上一次生成已中断', 'persisted generation state save failures should explain refresh interruption restore risk');
assertIncludes(frontendSource, 'generation-state-persist-failed-clear', 'persisted generation state clear failures should append a stable user-visible prompt');
assertIncludes(frontendSource, '本地生成恢复状态清理失败', 'persisted generation state clear failures should explain the stale local state risk');
assertIncludes(frontendSource, '如果刷新后再次看到中断提示，请以当前页面的最新生成状态为准', 'persisted generation state clear failures should explain how to interpret stale interruption prompts');
const workspaceClipboardLocalErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/workspace-clipboard-local-errors.ts'));
assertIncludes(workspaceClipboardLocalErrorsSource, 'export function formatWorkspaceClipboardError', 'workspace clipboard failures should use a shared clipboard local error formatter');
assertIncludes(workspaceClipboardLocalErrorsSource, 'export type WorkspaceClipboardLocalErrorDetails = string', 'workspace clipboard local error formatter should expose a named details contract');
assertIncludes(workspaceClipboardLocalErrorsSource, 'fallback: WorkspaceClipboardLocalErrorDetails', 'workspace clipboard local error formatter should consume the named details contract');
assertIncludes(workspaceClipboardLocalErrorsSource, "source: 'clipboard'", 'workspace clipboard local error formatter should preserve clipboard source');
assertIncludes(workspaceClipboardLocalErrorsSource, 'workspaceMissingClipboardDetails: WorkspaceClipboardLocalErrorDetails', 'workspace clipboard local error formatter should preserve missing clipboard API details through the named contract');
assertIncludes(workspaceClipboardLocalErrorsSource, 'details: workspaceMissingClipboardDetails', 'workspace clipboard local error formatter should pass named missing clipboard API details');
const workspaceMessageRenderErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/workspace-message-render-errors.ts'));
assertIncludes(workspaceMessageRenderErrorsSource, 'export function formatWorkspaceMermaidRenderError', 'workspace Mermaid render failures should use a shared message render error formatter');
assertIncludes(workspaceMessageRenderErrorsSource, "source: 'mermaid_render'", 'workspace Mermaid render formatter should preserve mermaid_render source');
assertIncludes(frontendSource, 'clipboard-copy-failed', 'workspace clipboard copy failures should append a user-visible recovery prompt');
assertIncludes(frontendSource, '复制到剪贴板失败', 'workspace clipboard copy failures should explain the failed copy action');
assertIncludes(frontendSource, "formatWorkspaceClipboardError(error, '浏览器拒绝了剪贴板访问')", 'workspace clipboard copy failures should use the shared clipboard formatter');
assertIncludes(frontendSource, '当前内容没有写入系统剪贴板', 'workspace clipboard copy failures should explain clipboard state instead of silently failing');
const planImplementationErrorsSource = readText(path.join(rootDir, 'src/lib/workspace/plan-implementation-errors.ts'));
assertIncludes(planImplementationErrorsSource, 'export function formatPlanImplementationLaunchFailure', 'plan implementation launch failures should use a shared formatter');
assertIncludes(planImplementationErrorsSource, "formatUserVisibleApiError(error, '请修复后重试')", 'plan implementation launch shared formatter should preserve structured source/details in recovery reason messages');
assertIncludes(frontendSource, 'plan_implementation_launch_failed', 'plan implementation launch failures should enter a registered recovery state');
assertIncludes(frontendSource, 'buildPlanImplementationFailureState', 'plan implementation launch failures should build a structured engineering state');
assertIncludes(frontendSource, 'formatPlanImplementationLaunchFailure(error)', 'plan implementation launch failures should preserve structured source/details through the shared formatter');
if (frontendSource.includes('function getPlanImplementationFailureMessage')) {
  throw new Error('[YES] Workflow recovery contract drift detected: plan implementation launch should not keep a hook-local failure formatter');
}
assertIncludes(workspaceBusinessBoundaryErrorsSource, "source: 'plan_implementation_project_info'", 'plan implementation launch should expose missing project info source/details');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'export type PlanImplementationProjectInfoErrorPlan = {', 'plan implementation launch should expose a named project info error plan contract');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'export type ProjectCreateResponseErrorProject = {', 'project creation response boundary should expose a named created project contract');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'export type ProjectCreateResponseErrorContext = {', 'project creation response boundary should expose a named context contract');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'export type HomeProjectCreateResponseErrorContext = {', 'home project creation response boundary should expose a named context contract');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'plan_id=${plan.id}; plan_name=${plan.name}; reason=projectInfo is null before persisted project creation', 'plan implementation launch should include plan context when project info is missing');
assertIncludes(frontendSource, 'buildPlanImplementationProjectInfoError(plan)', 'plan implementation launch should use the shared missing project info helper');
assertIncludes(workspaceBusinessBoundaryErrorsSource, "source: 'project_create_response'", 'persisted project creation should expose malformed create response source/details');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'function getProjectCreateResponseErrorFieldValue(value: string): string', 'project creation response boundary should normalize missing project fields through a named reader');
assertIncludes(workspaceBusinessBoundaryErrorsSource, 'project_id=${projectId}; name=${projectName}; plan_id=${context.plan.id}; app_type=${context.appType}', 'persisted project creation should include missing project_id details');
assertIncludes(frontendSource, 'buildProjectCreateResponseError(createdProject', 'persisted project creation should use the shared create response boundary helper');
if (/Pick<Plan|Pick<Project|\{\s*plan: Pick<Plan/.test(workspaceBusinessBoundaryErrorsSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: business boundary error helpers must not derive inputs from Plan/Project with Pick');
}
if (/createdProject\.(project_id|name) \|\| ''/.test(workspaceBusinessBoundaryErrorsSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: business boundary error helpers must not regress create response details to inline OR fallback');
}
if (frontendSource.includes("throw new Error('项目信息不存在')")) {
  throw new Error('[YES] Workflow recovery contract drift detected: missing project info before implementation launch must not be a bare Error');
}
assertIncludes(frontendSource, 'clearPlanImplementationSelection', 'plan implementation launch failures should restore the plan selection UI state');
assertIncludes(frontendSource, '方案确认进入实现失败', 'plan implementation launch failures should append a user-visible workflow failure message');
assertIncludes(frontendSource, '重新应用该方案', 'plan implementation launch failures should expose an executable retry action');
assertIncludes(frontendSource, "kind: 'retry_plan_generation'", 'plan implementation launch failures should preserve a replan recovery action');
assertIncludes(frontendSource, 'commit_restore_failed', 'commit restore failures should enter a registered recovery state');
assertIncludes(frontendSource, 'buildCommitRestoreFailureState', 'commit restore failures should build a structured engineering state');
assertIncludes(frontendSource, '版本恢复失败', 'commit restore failures should append a user-visible workflow failure message');
assertIncludes(frontendSource, "kind: 'open_git_panel'", 'commit restore failures should expose an executable Git panel recovery action');

const chatMessageContentSource = readText(path.join(rootDir, 'src/components/workspace/chat-message-content.tsx'));
const planMessageGuidanceSource = readText(path.join(rootDir, 'src/app/workspace/workspace-chat-message-guidance.tsx'));
const foundationPanelSource = readText(path.join(rootDir, 'src/app/workspace/workspace-foundation-panel.tsx'));
if (chatMessageContentSource.includes('function MessageGuidance')) {
  throw new Error('[YES] Workflow recovery contract drift detected: chat-message-content must not define a local MessageGuidance');
}
if (chatMessageContentSource.includes('ignore clipboard failures')) {
  throw new Error('[YES] Workflow recovery contract drift detected: chat message code block copy failures must not be ignored');
}
assertIncludes(chatMessageContentSource, '复制代码块失败', 'chat message code block copy failures should expose inline feedback');
assertIncludes(chatMessageContentSource, '当前内容没有写入系统剪贴板', 'chat message code block copy failures should explain clipboard state');
assertIncludes(chatMessageContentSource, 'formatWorkspaceClipboardError(error, "浏览器拒绝了剪贴板访问")', 'chat message code block copy failures should use the shared clipboard formatter');
assertIncludes(chatMessageContentSource, 'formatWorkspaceMissingClipboardError()', 'chat message code block copy failures should surface missing clipboard API details through the shared formatter');
assertIncludes(chatMessageContentSource, 'data-testid="chat-code-block-copy-failed"', 'chat message code block copy failures should expose a stable inline status target');
assertIncludes(chatMessageContentSource, 'role="status"', 'chat message code block copy failures should be announced as status feedback');
assertIncludes(chatMessageContentSource, 'aria-live="polite"', 'chat message code block copy failures should use polite live-region feedback');
assertIncludes(chatMessageContentSource, 'formatWorkspaceMermaidRenderError(renderError)', 'chat message Mermaid render failures should preserve mermaid_render source/details through the shared formatter');
assertIncludes(chatMessageContentSource, 'MessageRenderSnapshot', 'chat message render state should be typed as a structured snapshot');
assertIncludes(chatMessageContentSource, 'buildCodeBlockMessageRenderSnapshot', 'chat code block render state should use the shared snapshot helper');
assertIncludes(chatMessageContentSource, 'buildMermaidMessageRenderSnapshot', 'chat Mermaid render state should use the shared snapshot helper');
assertIncludes(chatMessageContentSource, 'data-testid="workspace-message-render-snapshot"', 'chat message render state should expose a stable snapshot target');
assertIncludes(chatMessageContentSource, 'Phase: {snapshot.status}', 'chat message render snapshot should expose render phase');
assertIncludes(chatMessageContentSource, 'Source: {snapshot.source}', 'chat message render snapshot should expose render source');
assertIncludes(chatMessageContentSource, 'Chars: {snapshot.contentLength}', 'chat message render snapshot should expose content length');
assertIncludes(messageRenderSnapshotSource, 'MessageRenderSnapshotStatus', 'chat message render snapshot should use named status contract');
assertIncludes(messageRenderSnapshotSource, 'MessageRenderSnapshotSource', 'chat message render snapshot should use named source contract');
assertIncludes(messageRenderSnapshotSource, "status: MessageRenderSnapshotStatus = 'code_copy_failed'", 'chat message render snapshot should distinguish code copy failures');
assertIncludes(messageRenderSnapshotSource, "status: MessageRenderSnapshotStatus = 'code_copied'", 'chat message render snapshot should distinguish successful code copies');
assertIncludes(messageRenderSnapshotSource, 'MermaidMessageRenderSnapshotStatus', 'chat message render snapshot should use named Mermaid render status contract');
assertIncludes(messageRenderSnapshotSource, "status === 'mermaid_rendering'", 'chat message render snapshot should distinguish Mermaid rendering state');
assertIncludes(messageRenderSnapshotSource, "status === 'mermaid_failed'", 'chat message render snapshot should distinguish Mermaid failure state');
assertIncludes(chatMessageContentSource, 'WorkflowSectionSnapshot', 'chat workflow section state should be typed as a structured snapshot');
assertIncludes(chatMessageContentSource, 'buildWorkflowSectionSnapshot', 'chat workflow section should derive a structured snapshot from steps and disclosure state');
assertIncludes(chatMessageContentSource, 'data-testid="workspace-workflow-section-snapshot"', 'chat workflow section should expose a stable snapshot target');
assertIncludes(chatMessageContentSource, 'Phase: {snapshot.status}', 'chat workflow section snapshot should expose section phase');
assertIncludes(chatMessageContentSource, 'Running: {snapshot.runningCount}', 'chat workflow section snapshot should expose running step count');
assertIncludes(chatMessageContentSource, 'Failed: {snapshot.failedCount}', 'chat workflow section snapshot should expose failed step count');
assertIncludes(chatMessageContentSource, 'Visible: {snapshot.visibleLineCount}', 'chat workflow section snapshot should expose visible line count');
assertIncludes(chatMessageContentSource, 'const isOpenLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.isOpen);', 'chat workflow section snapshot should derive open state as a named display label');
assertIncludes(chatMessageContentSource, 'Open: {isOpenLabel}', 'chat workflow section snapshot should expose open state');
assertIncludes(chatMessageContentSource, 'status === "empty_lines"', 'chat workflow section snapshot should distinguish steps filtered out of visible lines');
assertIncludes(chatMessageContentSource, '当前 workflow 分组存在 {displaySteps.length} 个步骤，但没有生成可展示行', 'chat workflow section should render empty-line state instead of hiding the section');
assertIncludes(chatMessageContentSource, 'ChatMessageSnapshot', 'chat message container state should be typed as a structured snapshot');
assertIncludes(chatMessageContentSource, 'buildChatMessageSnapshot', 'chat message container should derive a structured snapshot from role, workflow, engineering and guidance facts');
assertIncludes(chatMessageContentSource, 'data-testid="workspace-chat-message-snapshot"', 'chat message container should expose a stable snapshot target');
assertIncludes(chatMessageContentSource, 'Phase: {snapshot.status}', 'chat message snapshot should expose message phase');
assertIncludes(chatMessageContentSource, 'Role: {snapshot.role}', 'chat message snapshot should expose message role');
assertIncludes(chatMessageContentSource, 'Steps: {snapshot.workflowStepCount}', 'chat message snapshot should expose workflow step count');
assertIncludes(chatMessageContentSource, 'Questions: {snapshot.suggestedQuestionCount}', 'chat message snapshot should expose suggested question count');
assertIncludes(chatMessageContentSource, 'const hasEngineeringStateLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.hasEngineeringState);', 'chat message snapshot should derive engineering state presence as a named display label');
assertIncludes(chatMessageContentSource, 'const isStreamingLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.isStreaming);', 'chat message snapshot should derive streaming state as a named display label');
assertIncludes(chatMessageContentSource, 'Engineering: {hasEngineeringStateLabel}', 'chat message snapshot should expose engineering state presence');
assertIncludes(chatMessageContentSource, 'Streaming: {isStreamingLabel}', 'chat message snapshot should expose streaming state');
assertIncludes(chatMessageContentSource, 'status === "engineering_failed"', 'chat message snapshot should distinguish failed engineering state');
assertIncludes(chatMessageContentSource, '<ChatMessageSnapshotStrip snapshot={chatMessageSnapshot} />', 'chat message content should render the message snapshot before role-specific content');
assertIncludes(chatMessageContentSource, 'ChatThoughtProcessSnapshot', 'chat thought process state should be typed as a structured snapshot');
assertIncludes(chatMessageContentSource, 'buildChatThoughtProcessSnapshot', 'chat thought process should derive a structured snapshot from content, streaming, fallback and disclosure facts');
assertIncludes(chatMessageContentSource, 'data-testid="workspace-chat-thought-process-snapshot"', 'chat thought process should expose a stable snapshot target');
assertIncludes(chatMessageContentSource, 'Kind: {snapshot.contentKind}', 'chat thought process snapshot should expose reasoning or status fallback kind');
assertIncludes(chatMessageContentSource, 'Chars: {snapshot.contentLength}', 'chat thought process snapshot should expose content length');
assertIncludes(chatThoughtProcessSnapshotSource, 'ChatThoughtProcessSnapshotStatus', 'chat thought process snapshot helper should consume named status contract');
assertIncludes(chatThoughtProcessSnapshotSource, 'ChatThoughtProcessSnapshotSource', 'chat thought process snapshot helper should consume named source contract');
assertIncludes(chatThoughtProcessSnapshotSource, 'ChatThoughtProcessContentKind', 'chat thought process snapshot helper should consume named content kind contract');
assertIncludes(chatThoughtProcessSnapshotSource, "const status: ChatThoughtProcessSnapshotStatus = 'streaming'", 'chat thought process snapshot should distinguish streaming state');
assertIncludes(chatThoughtProcessSnapshotSource, 'function isChatThoughtProcessSnapshotUserToggle(source: ChatThoughtProcessSnapshotSource): boolean', 'chat thought process snapshot should derive user-collapsed state through a named source fact');
assertIncludes(chatThoughtProcessSnapshotSource, "const status: ChatThoughtProcessSnapshotStatus = isUserToggle === true ? 'collapsed' : 'settled'", 'chat thought process snapshot should distinguish user-collapsed and settled states');
assertIncludes(chatMessageContentSource, '<ChatThoughtProcessSnapshotStrip snapshot={thoughtProcessSnapshot} />', 'chat thought process panel should render the structured snapshot before content details');
assertIncludes(chatMessageContentSource, 'CommitSummarySnapshot', 'commit summary state should be typed as a structured snapshot');
assertIncludes(chatMessageContentSource, 'buildCommitSummarySnapshot', 'commit summary card should derive a structured snapshot from commit metadata and action wiring');
assertIncludes(chatMessageContentSource, 'data-testid="workspace-commit-summary-snapshot"', 'commit summary card should expose a stable snapshot target');
assertIncludes(chatMessageContentSource, 'Phase: {snapshot.status}', 'commit summary snapshot should expose commit panel phase');
assertIncludes(chatMessageContentSource, 'Hash: {snapshot.shortHash}', 'commit summary snapshot should expose normalized commit hash');
assertIncludes(chatMessageContentSource, 'const hasMessageLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.hasMessage);', 'commit summary snapshot should derive summary presence as a named display label');
assertIncludes(chatMessageContentSource, 'const canRestoreLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.canRestore);', 'commit summary snapshot should derive restore action availability as a named display label');
assertIncludes(chatMessageContentSource, 'const canViewLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.canView);', 'commit summary snapshot should derive view action availability as a named display label');
assertIncludes(chatMessageContentSource, 'Summary: {hasMessageLabel}', 'commit summary snapshot should expose commit summary presence');
assertIncludes(chatMessageContentSource, 'Restore: {canRestoreLabel}', 'commit summary snapshot should expose restore action availability');
assertIncludes(chatMessageContentSource, 'View: {canViewLabel}', 'commit summary snapshot should expose view action availability');
assertIncludes(chatMessageContentSource, 'const canRestoreCommit = onRestoreCommit !== undefined', 'commit summary restore button should use an explicit callback presence gate');
assertIncludes(chatMessageContentSource, 'const canViewCommit = onViewCommit !== undefined', 'commit summary view button should use an explicit callback presence gate');
assertIncludes(chatMessageContentSource, 'disabled={canRestoreCommit === false}', 'commit summary restore button should be disabled when the restore action is not wired');
assertIncludes(chatMessageContentSource, 'disabled={canViewCommit === false}', 'commit summary view button should be disabled when the view action is not wired');
assertIncludes(chatMessageContentSource, '<CommitSummarySnapshotStrip snapshot={commitSummarySnapshot} />', 'commit summary card should render the structured snapshot before commit controls');
assertIncludes(chatMessageContentSource, 'ValidationGateBlockedSnapshot', 'validation gate blocked alert should be typed as a structured snapshot');
assertIncludes(chatMessageContentSource, 'buildValidationGateBlockedSnapshot', 'validation gate blocked alert should derive a structured snapshot from engineering state and gate result');
assertIncludes(chatMessageContentSource, 'data-testid="workspace-validation-gate-blocked-snapshot"', 'validation gate blocked alert should expose a stable snapshot target');
assertIncludes(chatMessageContentSource, 'Phase: {snapshot.status}', 'validation gate blocked snapshot should expose blocked phase');
assertIncludes(chatMessageContentSource, 'Gate: {snapshot.gate}', 'validation gate blocked snapshot should expose gate name');
assertIncludes(chatMessageContentSource, 'Failures: {snapshot.failureItemCount}', 'validation gate blocked snapshot should expose validation failure item count');
assertIncludes(chatMessageContentSource, 'RepairTargets: {snapshot.repairTargetCount}', 'validation gate blocked snapshot should expose context repair target count');
assertIncludes(chatMessageContentSource, 'const canOpenRepairTargetLabel = getWorkspaceChatSnapshotBooleanLabel(snapshot.canOpenRepairTarget);', 'validation gate blocked snapshot should derive repair target open capability as a named display label');
assertIncludes(chatMessageContentSource, 'CanOpen: {canOpenRepairTargetLabel}', 'validation gate blocked snapshot should expose repair target open capability');
assertIncludes(chatMessageContentSource, '<ValidationGateBlockedSnapshotStrip snapshot={validationGateBlockedSnapshot} />', 'validation gate blocked alert should render the structured snapshot before alert details');
if (/snapshot\.(?:canOpenRepairTarget|isOpen|hasEngineeringState|isStreaming|hasMessage|canRestore|canView) \? "yes" : "no"/.test(chatMessageContentSource)) {
  throw new Error('[YES] Workflow recovery contract drift detected: workspace chat snapshots must not regress to inline yes-no display gates');
}
if (chatMessageContentSource.includes('function formatChatLocalError')) {
  throw new Error('[YES] Workflow recovery contract drift detected: chat message Mermaid render failures must not keep a component-local formatter');
}
if (planMessageGuidanceSource.includes('suggestedActions.map')) {
  throw new Error('[YES] Workflow recovery contract drift detected: plan message guidance must not render suggestedActions outside WorkspaceGuidanceActions');
}
if (chatMessageContentSource.includes('retry_prompt?.trim()')) {
  throw new Error('[YES] Workflow recovery contract drift detected: recovery fallback action must live in workspace-guidance-actions.tsx');
}
assertIncludes(foundationPanelSource, 'function FoundationPanelRecoverySummary', 'Foundation Panel gate cards must share the recovery summary renderer');
assertIncludes(foundationPanelSource, 'FoundationPanelSnapshot', 'Foundation Panel state should be typed as a structured snapshot');
assertIncludes(foundationPanelSource, 'buildFoundationPanelSnapshot', 'Foundation Panel should derive a structured snapshot from bootstrap state, gates and decision drafts');
assertIncludes(foundationPanelSource, 'data-testid="workspace-foundation-panel-snapshot"', 'Foundation Panel should expose a stable snapshot target');
assertIncludes(foundationPanelSource, 'Phase: {snapshot.status}', 'Foundation Panel snapshot should expose panel phase');
assertIncludes(foundationPanelSource, 'Required: {snapshot.requiredDecisionCount}', 'Foundation Panel snapshot should expose required decision count');
assertIncludes(foundationPanelSource, 'Blockers: {snapshot.blockerCount}', 'Foundation Panel snapshot should expose blocker count');
assertIncludes(foundationPanelSource, 'ContextRepairs: {snapshot.contextRepairTargetCount}', 'Foundation Panel snapshot should expose context repair target count');
assertIncludes(foundationPanelSource, 'const canConfirmLabel = getFoundationPanelSnapshotBooleanLabel(snapshot.canConfirm)', 'Foundation Panel snapshot should derive confirmability display label');
assertIncludes(foundationPanelSource, 'CanConfirm: {canConfirmLabel}', 'Foundation Panel snapshot should expose confirmability');
if (foundationPanelSource.includes('snapshot.canConfirm ? \'yes\' : \'no\'')) {
  throw new Error('[YES] Workflow recovery contract drift detected: Foundation Panel snapshot should not regress to inline confirmability display gate');
}
assertIncludes(foundationPanelSource, '<FoundationPanelSnapshotStrip snapshot={foundationPanelSnapshot} />', 'Foundation Panel should render the structured snapshot in the panel header');
assertIncludes(foundationPanelSource, 'retryFallbackLabel="重试自动准备项目基础设定"', 'Foundation Gate card must preserve its automatic recovery fallback label');
assertIncludes(foundationPanelSource, 'retryFallbackLabel="修复后重试"', 'Context Gate card must preserve its recovery fallback label');
if ((foundationPanelSource.match(/engineeringState\?\.recovery/g) || []).length > 1) {
  throw new Error('[YES] Workflow recovery contract drift detected: Foundation Panel recovery rendering must stay centralized');
}

console.log('[YES] Workflow recovery contract sync valid.');
