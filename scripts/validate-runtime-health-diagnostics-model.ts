import { strict as assert } from 'node:assert';
import fs from 'node:fs';

import { deriveWorkspaceRecoveryActionSummary } from '../src/app/workspace/workspace-guidance-actions';
import type { ProjectRuntimeStatus } from '../src/lib/api';
import type { WorkspaceEngineeringStateSnapshot } from '../src/lib/workspace/engineering-state';
import {
  buildRuntimeHealthCapabilityAuditSearch,
  clearRuntimeHealthDiagnosticContextSearch,
  deriveRuntimeHealthDiagnosticContext,
  deriveRuntimeHealthDiagnosticsSummary,
  RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  RUNTIME_HEALTH_REASON_QUERY_PARAM,
  type RuntimeHealthRestartReasonCode,
} from '../src/lib/workspace/runtime-health-diagnostics';

function createRuntimeStatus(status: ProjectRuntimeStatus['status'], overrides: Partial<ProjectRuntimeStatus> = {}): ProjectRuntimeStatus {
  return {
    projectId: 'project-1',
    status,
    containerStatus: status === 'ready' ? 'running' : status,
    phase: `phase-${status}`,
    message: `${status} message`,
    updatedAt: '2026-07-14T10:00:00Z',
    completedAt: '2026-07-14T10:05:00Z',
    ...overrides,
  };
}

const restartReasonCodes: RuntimeHealthRestartReasonCode[] = [
  'stopped',
  'failed',
  'persistence_failed',
  'container_status_persistence_failed',
  'unknown',
];
assert.deepEqual(
  restartReasonCodes,
  ['stopped', 'failed', 'persistence_failed', 'container_status_persistence_failed', 'unknown'],
  'runtime health restart reason code contract should stay explicit and named',
);

assert.deepEqual(
  deriveRuntimeHealthDiagnosticsSummary(null),
  {
    severity: 'unknown',
    statusLabel: 'unknown',
    containerLabel: 'unknown',
    phaseLabel: '未读取',
    previewLabel: '未提供预览地址',
    message: '尚未读取项目运行时状态。',
    nextAction: '选择项目或等待 Workspace 初始化后读取运行时状态。',
    persistenceLabel: '未读取',
    updatedAtLabel: '未知时间',
    completedAtLabel: '未知时间',
    isPreviewAvailable: false,
    isBlocking: false,
    relatedCapabilityAuditAction: null,
    restartRuntimeAction: null,
  },
  'runtime health diagnostics should expose a stable empty state',
);

const readySummary = deriveRuntimeHealthDiagnosticsSummary(createRuntimeStatus('ready', {
  previewUrl: 'http://localhost:3000',
}));
assert.equal(readySummary.severity, 'ready');
assert.equal(readySummary.statusLabel, 'ready');
assert.equal(readySummary.containerLabel, 'running');
assert.equal(readySummary.isPreviewAvailable, true);
assert.equal(readySummary.isBlocking, false);
assert.equal(readySummary.persistenceLabel, 'unknown');
assert.equal(readySummary.nextAction, '刷新预览或继续代码生成。');
assert.equal(readySummary.restartRuntimeAction, null);

const preparingSummary = deriveRuntimeHealthDiagnosticsSummary(createRuntimeStatus('preparing', {
  containerStatus: '',
  previewUrl: '',
}));
assert.equal(preparingSummary.severity, 'running');
assert.equal(preparingSummary.containerLabel, 'pending');
assert.equal(preparingSummary.previewLabel, '预览地址待生成');
assert.equal(preparingSummary.nextAction, '等待容器启动、依赖安装或运行时校验完成。');
assert.equal(preparingSummary.restartRuntimeAction, null);

const failedSummary = deriveRuntimeHealthDiagnosticsSummary(createRuntimeStatus('failed', {
  error: 'apt mirror unavailable',
  message: 'prepare failed',
}));
assert.equal(failedSummary.severity, 'blocked');
assert.equal(failedSummary.message, 'apt mirror unavailable');
assert.equal(failedSummary.nextAction, 'apt mirror unavailable');
assert.equal(failedSummary.isBlocking, true);
assert.deepEqual(failedSummary.relatedCapabilityAuditAction, {
  label: '查看 Capability 审计',
  description: '使用 blocked 筛选最近被阻断的能力执行记录，确认是否与当前运行时阻断相关。',
  searchParam: 'capability_status',
  searchValue: 'blocked',
});
assert.deepEqual(failedSummary.restartRuntimeAction, {
  label: '恢复运行时',
  description: '显式重新启动开发运行时并等待 runtime-status 进入 ready；该动作复用受控 start 容器入口。',
  reasonCode: 'failed',
});
assert.equal(
  buildRuntimeHealthCapabilityAuditSearch('?foo=bar&capability_profile=mcp'),
  '?foo=bar&capability_profile=mcp&capability_status=blocked',
  'runtime health should preserve existing search params when linking to blocked capability audit records',
);
assert.equal(
  buildRuntimeHealthCapabilityAuditSearch('?foo=bar&capability_profile=mcp', createRuntimeStatus('failed', {
    projectId: 'runtime-project-1',
  })),
  '?foo=bar&capability_profile=mcp&capability_status=blocked&runtime_project=runtime-project-1&runtime_reason=runtime_readiness_failed',
  'runtime health should preserve runtime project and reason context when linking to capability audit records',
);
assert.deepEqual(
  deriveRuntimeHealthDiagnosticContext('?capability_status=blocked&runtime_project=runtime-project-1&runtime_reason=runtime_readiness_failed'),
  {
    projectId: 'runtime-project-1',
    reasonCode: 'runtime_readiness_failed',
    activeLabels: ['runtime_project=runtime-project-1', 'runtime_reason=runtime_readiness_failed'],
  },
  'runtime health diagnostic context should be readable from URL search params',
);
assert.deepEqual(
  deriveRuntimeHealthDiagnosticContext('?runtime_project=&runtime_reason='),
  null,
  'runtime health diagnostic context should stay absent when both shared URL context values are empty',
);
assert.deepEqual(
  deriveRuntimeHealthDiagnosticContext('?runtime_reason=runtime_readiness_failed'),
  {
    projectId: '',
    reasonCode: 'runtime_readiness_failed',
    activeLabels: ['runtime_reason=runtime_readiness_failed'],
  },
  'runtime health diagnostic context should derive active labels through explicit context label facts',
);
assert.equal(
  clearRuntimeHealthDiagnosticContextSearch('?capability_status=blocked&runtime_project=runtime-project-1&runtime_reason=runtime_readiness_failed'),
  '?capability_status=blocked',
  'runtime health diagnostic context clearing should preserve capability audit filters',
);

const stoppedSummary = deriveRuntimeHealthDiagnosticsSummary(createRuntimeStatus('stopped', {
  containerStatus: '',
  message: '',
}));
assert.equal(stoppedSummary.severity, 'idle');
assert.equal(stoppedSummary.containerLabel, 'stopped');
assert.equal(stoppedSummary.nextAction, '需要预览或执行运行时任务时启动开发环境。');
assert.deepEqual(stoppedSummary.restartRuntimeAction, {
  label: '恢复运行时',
  description: '显式重新启动开发运行时并等待 runtime-status 进入 ready；该动作复用受控 start 容器入口。',
  reasonCode: 'stopped',
});

const unknownSummary = deriveRuntimeHealthDiagnosticsSummary({
  status: 'ready',
  containerStatus: 'paused',
  phase: '',
  message: '',
  error: 'unexpected runtime marker',
  updatedAt: 'not-a-date',
} as ProjectRuntimeStatus);
assert.equal(unknownSummary.severity, 'ready');
assert.equal(unknownSummary.updatedAtLabel, 'not-a-date');

const persistenceFailedSummary = deriveRuntimeHealthDiagnosticsSummary(createRuntimeStatus('ready', {
  persistenceStatus: 'failed',
  persistenceError: 'path escapes project root',
}));
assert.equal(persistenceFailedSummary.severity, 'blocked');
assert.equal(persistenceFailedSummary.persistenceLabel, 'failed');
assert.match(
  persistenceFailedSummary.message,
  /运行时状态持久化失败：path escapes project root/,
  'runtime health should surface runtime status persistence failures',
);
assert.match(
  persistenceFailedSummary.nextAction,
  /刷新或重新进入 Workspace 后恢复/,
  'runtime health persistence failures should explain refresh restore risk',
);
assert.equal(persistenceFailedSummary.restartRuntimeAction?.reasonCode, 'persistence_failed');

const containerStatusPersistenceFailedSummary = deriveRuntimeHealthDiagnosticsSummary(createRuntimeStatus('failed', {
  containerStatus: 'running',
  containerStatusPersistence: 'failed',
  containerStatusPersistenceError: 'database unavailable',
}));
assert.equal(containerStatusPersistenceFailedSummary.severity, 'blocked');
assert.match(
  containerStatusPersistenceFailedSummary.message,
  /项目容器状态同步失败：database unavailable/,
  'runtime health should surface container status persistence failures',
);
assert.match(
  containerStatusPersistenceFailedSummary.nextAction,
  /容器真实状态与项目列表状态可能不一致/,
  'runtime health container status persistence failures should explain project list drift risk',
);
assert.equal(containerStatusPersistenceFailedSummary.restartRuntimeAction?.reasonCode, 'container_status_persistence_failed');

const desktopPreviewPanel = fs.readFileSync('src/app/workspace/workspace-ide-desktop-preview-panel.tsx', 'utf8');
const mobilePreviewPanel = fs.readFileSync('src/app/workspace/workspace-ide-mobile-preview-panel.tsx', 'utf8');
const previewLocalErrors = fs.readFileSync('src/lib/workspace/preview-local-errors.ts', 'utf8');
const runtimeHealthDiagnosticsSource = fs.readFileSync('src/lib/workspace/runtime-health-diagnostics.ts', 'utf8');
const runtimeHealthRecoveryConfirmationSnapshot = fs.readFileSync('src/app/workspace/workspace-runtime-health-recovery-confirmation-snapshot.tsx', 'utf8');
assert.match(
  runtimeHealthDiagnosticsSource,
  /export type RuntimeHealthRestartReasonCode =[\s\S]*'stopped'[\s\S]*'failed'[\s\S]*'persistence_failed'[\s\S]*'container_status_persistence_failed'[\s\S]*'unknown';[\s\S]*reasonCode: RuntimeHealthRestartReasonCode;[\s\S]*function buildRestartRuntimeAction\(reasonCode: RuntimeHealthRestartReasonCode\): RuntimeHealthRestartAction/,
  'runtime health restart action should expose restart reason code as a named contract',
);
assert.doesNotMatch(
  runtimeHealthDiagnosticsSource,
  /RuntimeHealthRestartAction\['reasonCode'\]/,
  'runtime health restart action helper should not infer reason code from indexed action access',
);
assert.match(
  desktopPreviewPanel,
  /relatedCapabilityAuditAction/,
  'runtime health banner should render the related capability audit action from the model',
);
assert.match(
  desktopPreviewPanel,
  /buildRuntimeHealthCapabilityAuditSearch\(window\.location\.search, runtimeStatus\)/,
  'runtime health banner should pass runtime status into the model search helper for capability audit linking',
);
assert.match(
  desktopPreviewPanel,
  /const \[capabilityAuditUrlSyncError, setCapabilityAuditUrlSyncError\] = useState\(''\);[\s\S]*window\.history\.replaceState\(window\.history\.state, '', nextUrl\);[\s\S]*setCapabilityAuditUrlSyncError\(''\);[\s\S]*catch \(error\) \{[\s\S]*formatPreviewLocalError\(error, '浏览器拒绝更新地址栏', 'browser_history'\)[\s\S]*Capability Audit 定位参数写入失败：[\s\S]*地址栏未写入 runtime_project\/runtime_reason 定位参数/,
  'runtime health banner should surface capability audit URL drilldown sync failures through the shared browser_history formatter',
);
assert.match(
  desktopPreviewPanel,
  /const capabilityAuditUrlSyncStatusMessage = getDesktopPreviewRenderableStatusMessage\(capabilityAuditUrlSyncError\);[\s\S]*\{capabilityAuditUrlSyncStatusMessage !== null && \([\s\S]*<span role="status"[\s\S]*\{capabilityAuditUrlSyncStatusMessage\}/,
  'runtime health banner should render capability audit URL drilldown sync failures inline through a named renderable status reader',
);
assert.match(
  desktopPreviewPanel,
  /诊断区只消费已有 runtime status；恢复按钮是显式受控动作，会复用 start 容器入口并等待 runtime-status 进入 ready。/,
  'runtime health banner should render the explicit recovery boundary',
);
assert.match(
  desktopPreviewPanel,
  /function getRuntimeRecoveryActionButtonLabel\(\{[\s\S]*isRecoveringRuntime,[\s\S]*runtimeRecoveryAction,[\s\S]*\}: \{[\s\S]*isRecoveringRuntime: boolean;[\s\S]*runtimeRecoveryAction: RuntimeHealthRestartAction;[\s\S]*\}\): string[\s\S]*if \(isRecoveringRuntime === true\)[\s\S]*return '恢复中\.\.\.';[\s\S]*return runtimeRecoveryAction\.label;[\s\S]*function getRuntimeRecoveryConfirmButtonLabel\(isRecoveringRuntime: boolean\): string[\s\S]*if \(isRecoveringRuntime === true\)[\s\S]*return '恢复中\.\.\.';[\s\S]*return '确认恢复';[\s\S]*const runtimeRecoveryAction = getRuntimeRecoveryAction\(summary\);[\s\S]*const renderableRuntimeRecoveryAction = getDesktopPreviewRenderableRuntimeRecoveryAction\(runtimeRecoveryAction\);[\s\S]*\{renderableRuntimeRecoveryAction !== null && \([\s\S]*onClick=\{\(\) => setIsRuntimeRecoveryConfirmationOpen\(true\)\}[\s\S]*\{getRuntimeRecoveryActionButtonLabel\(\{[\s\S]*isRecoveringRuntime,[\s\S]*runtimeRecoveryAction: renderableRuntimeRecoveryAction,[\s\S]*\}\)\}[\s\S]*runtime_reason=\{renderableRuntimeRecoveryAction\.reasonCode\}/,
  'runtime health banner should render an explicit recover runtime action from the model through a named renderable action reader',
);
assert.match(
  desktopPreviewPanel,
  /const \[isRecoveringRuntime, setIsRecoveringRuntime\] = useState\(false\);[\s\S]*const \[isRuntimeRecoveryConfirmationOpen, setIsRuntimeRecoveryConfirmationOpen\] = useState\(false\);[\s\S]*const recoverRuntime = async \(\) => \{[\s\S]*runtimeRecoveryConfirmationSnapshot\.canConfirm !== true[\s\S]*return;[\s\S]*setIsRecoveringRuntime\(true\);[\s\S]*await onRecoverRuntime\(\);[\s\S]*setIsRecoveringRuntime\(false\);[\s\S]*setIsRuntimeRecoveryConfirmationOpen\(false\);/,
  'runtime health recover action should guard duplicate clicks while recovery is running',
);
assert.match(
  runtimeHealthRecoveryConfirmationSnapshot,
  /(?=[\s\S]*RuntimeHealthRecoveryConfirmationSnapshotStatus)(?=[\s\S]*RuntimeHealthRecoveryConfirmationSnapshotSource)(?=[\s\S]*RuntimeHealthRecoveryConfirmationSnapshotAction)(?=[\s\S]*RuntimeHealthRecoveryConfirmationRiskLevel)(?=[\s\S]*RuntimeHealthRecoveryConfirmationReasonCode)(?=[\s\S]*function getRuntimeHealthRecoveryConfirmationReasonCode\([\s\S]*reasonCode: RuntimeHealthRecoveryConfirmationReasonCode \| null,[\s\S]*\): RuntimeHealthRecoveryConfirmationReasonCode \| null)(?=[\s\S]*function getRuntimeHealthRecoveryConfirmationNullableText\(value: string \| null\): string \| null)(?=[\s\S]*function hasRuntimeHealthRecoveryConfirmationTextValue\(value: string \| null \| undefined\): value is string \{[\s\S]*if \(value === null \|\| value === undefined\)[\s\S]*return false;[\s\S]*const hasValue = value\.length > 0;)(?=[\s\S]*export function buildRuntimeHealthRecoveryConfirmationSnapshot\()(?=[\s\S]*reasonCode: RuntimeHealthRecoveryConfirmationReasonCode \| null)(?=[\s\S]*const normalizedReasonCode = getRuntimeHealthRecoveryConfirmationReasonCode\(reasonCode\);)(?=[\s\S]*const normalizedActionLabel = getRuntimeHealthRecoveryConfirmationNullableText\(actionLabel\);)(?=[\s\S]*const normalizedActionDescription = getRuntimeHealthRecoveryConfirmationNullableText\(actionDescription\);)(?=[\s\S]*const hasActionLabel = hasRuntimeHealthRecoveryConfirmationTextValue\(normalizedActionLabel\);)(?=[\s\S]*const hasReasonCode = normalizedReasonCode !== null;)(?=[\s\S]*const hasRecoveryAction = hasActionLabel === true && hasReasonCode === true;)(?=[\s\S]*const canConfirm = isOpen === true && hasRecoveryAction === true && isConfirming === false;)(?=[\s\S]*const canCancel = isOpen === true && isConfirming === false;)(?=[\s\S]*status: RuntimeHealthRecoveryConfirmationSnapshotStatus = isOpen)(?=[\s\S]*source: RuntimeHealthRecoveryConfirmationSnapshotSource = isOpen)(?=[\s\S]*action: RuntimeHealthRecoveryConfirmationSnapshotAction = hasRecoveryAction)(?=[\s\S]*riskLevel: RuntimeHealthRecoveryConfirmationRiskLevel = hasRecoveryAction)(?=[\s\S]*'confirming')(?=[\s\S]*'awaiting_confirmation')(?=[\s\S]*'closed')(?=[\s\S]*function getRuntimeHealthRecoveryConfirmationSnapshotLabel)(?=[\s\S]*const hasValue = hasRuntimeHealthRecoveryConfirmationTextValue\(value\);)(?=[\s\S]*function getRuntimeHealthRecoveryConfirmationSnapshotBooleanLabel)(?=[\s\S]*const reasonCodeLabel = getRuntimeHealthRecoveryConfirmationSnapshotLabel\(snapshot\.reasonCode, 'none'\);)(?=[\s\S]*const actionLabel = getRuntimeHealthRecoveryConfirmationSnapshotLabel\(snapshot\.actionLabel, 'none'\);)(?=[\s\S]*const actionDescriptionLabel = getRuntimeHealthRecoveryConfirmationSnapshotLabel)(?=[\s\S]*const canConfirmLabel = getRuntimeHealthRecoveryConfirmationSnapshotBooleanLabel\(snapshot\.canConfirm\);)(?=[\s\S]*const canCancelLabel = getRuntimeHealthRecoveryConfirmationSnapshotBooleanLabel\(snapshot\.canCancel\);)(?=[\s\S]*data-testid="runtime-health-recovery-confirmation-snapshot")(?=[\s\S]*Phase: \{snapshot\.status\})(?=[\s\S]*Action: \{snapshot\.action\})(?=[\s\S]*Reason: \{reasonCodeLabel\})(?=[\s\S]*动作：\{actionLabel\})(?=[\s\S]*说明：\{actionDescriptionLabel\})(?=[\s\S]*Confirm: \{canConfirmLabel\})(?=[\s\S]*Cancel: \{canCancelLabel\})/,
  'runtime health recovery confirmation snapshot should expose action, reason and confirm/cancel capability through a stable UI target',
);
assert.doesNotMatch(
  runtimeHealthRecoveryConfirmationSnapshot,
  /RuntimeHealthRecoveryConfirmationSnapshot\['status'\]|RuntimeHealthRecoveryConfirmationSnapshot\['source'\]|RuntimeHealthRecoveryConfirmationSnapshot\['action'\]|RuntimeHealthRecoveryConfirmationSnapshot\['riskLevel'\]|reasonCode: string \| null|reasonCode \|\| null|actionLabel\?\.trim\(\) \|\| null|actionDescription\?\.trim\(\) \|\| null|Boolean\(|&& !isConfirming|normalizedActionLabel !== null && normalizedActionLabel\.length > 0|value !== null && value !== undefined && value\.length > 0|snapshot\.reasonCode \|\| 'none'|snapshot\.actionLabel \|\| 'none'|snapshot\.actionDescription \|\| 'none'|snapshot\.reasonCode \?\? 'none'|snapshot\.actionLabel \?\? 'none'|snapshot\.actionDescription \?\? 'none'|snapshot\.(canConfirm|canCancel) \? 'yes' : 'no'/,
  'runtime health recovery confirmation snapshot helper should not infer status/source/action/risk from indexed snapshot access, use raw reason code strings, direct nullable length checks, or implicit Boolean/negation gates',
);
assert.match(
  desktopPreviewPanel,
  /function getRuntimeRecoveryAction\(summary: RuntimeHealthDiagnosticsSummary\): RuntimeHealthRestartAction \| null \{[\s\S]*const restartRuntimeAction = summary\.restartRuntimeAction;[\s\S]*const hasRestartRuntimeAction = restartRuntimeAction !== null;[\s\S]*hasRestartRuntimeAction === false[\s\S]*function getRuntimeHealthRelatedCapabilityAuditAction\([\s\S]*summary: RuntimeHealthDiagnosticsSummary,[\s\S]*\): RuntimeHealthRelatedDiagnosticAction \| null[\s\S]*function shouldRenderRuntimeHealthActionGroup\([\s\S]*restartRuntimeAction: RuntimeHealthRestartAction \| null,[\s\S]*relatedCapabilityAuditAction: RuntimeHealthRelatedDiagnosticAction \| null,[\s\S]*\): boolean[\s\S]*function getRuntimeRecoveryActionLabel\(action: RuntimeHealthRestartAction \| null\): string \| null \{[\s\S]*function getRuntimeRecoveryActionDescription\(action: RuntimeHealthRestartAction \| null\): string \| null \{[\s\S]*function getRuntimeRecoveryActionReasonCode\(action: RuntimeHealthRestartAction \| null\): RuntimeHealthRestartReasonCode \| null \{[\s\S]*const runtimeRecoveryAction = getRuntimeRecoveryAction\(summary\);[\s\S]*const relatedCapabilityAuditAction = getRuntimeHealthRelatedCapabilityAuditAction\(summary\);[\s\S]*const shouldRenderActionGroup = shouldRenderRuntimeHealthActionGroup\([\s\S]*runtimeRecoveryAction,[\s\S]*relatedCapabilityAuditAction,[\s\S]*\);[\s\S]*buildRuntimeHealthRecoveryConfirmationSnapshot\(\{[\s\S]*isOpen: isRuntimeRecoveryConfirmationOpen,[\s\S]*isConfirming: isRecoveringRuntime,[\s\S]*actionLabel: getRuntimeRecoveryActionLabel\(runtimeRecoveryAction\),[\s\S]*actionDescription: getRuntimeRecoveryActionDescription\(runtimeRecoveryAction\),[\s\S]*reasonCode: getRuntimeRecoveryActionReasonCode\(runtimeRecoveryAction\),[\s\S]*\{shouldRenderActionGroup === true &&[\s\S]*<RuntimeHealthRecoveryConfirmationSnapshotStrip snapshot=\{runtimeRecoveryConfirmationSnapshot\} \/>[\s\S]*<AlertDialogCancel disabled=\{runtimeRecoveryConfirmationSnapshot\.canCancel === false\}>取消<\/AlertDialogCancel>[\s\S]*disabled=\{runtimeRecoveryConfirmationSnapshot\.canConfirm === false\}[\s\S]*runtimeRecoveryConfirmationSnapshot\.canConfirm === true[\s\S]*void recoverRuntime\(\)/,
  'runtime health banner should gate runtime recovery through the confirmation snapshot before calling the recovery action',
);
assert.match(
  desktopPreviewPanel,
  /import \{ formatUserVisibleApiError \} from '@\/lib\/api-error-display';[\s\S]*const \[runtimeRecoveryError, setRuntimeRecoveryError\] = useState\(''\);[\s\S]*setRuntimeRecoveryError\(''\);[\s\S]*catch \(error\) \{[\s\S]*formatUserVisibleApiError\(error, '恢复运行时失败'\)[\s\S]*Runtime Health 恢复运行时失败：[\s\S]*旧地址或旧 iframe 状态/,
  'runtime health recover action should surface recovery failures inline with structured source/details',
);
assert.match(
  desktopPreviewPanel,
  /function getRuntimeRecoveryReasonCode\(action: RuntimeHealthRestartAction \| null\): RuntimeHealthRestartReasonCode \| '' \{[\s\S]*const hasRuntimeRecoveryAction = action !== null;[\s\S]*hasRuntimeRecoveryAction === false[\s\S]*return '';[\s\S]*return action\.reasonCode;[\s\S]*function shouldClearRuntimeRecoveryError\([\s\S]*runtimeRecoveryError: string,[\s\S]*runtimeRecoveryReasonCode: RuntimeHealthRestartReasonCode \| '',[\s\S]*\): boolean[\s\S]*const hasRuntimeRecoveryError = hasDesktopPreviewTextValue\(runtimeRecoveryError\);[\s\S]*const hasRuntimeRecoveryReasonCode = hasDesktopPreviewTextValue\(runtimeRecoveryReasonCode\);[\s\S]*const runtimeRecoveryReasonCode = getRuntimeRecoveryReasonCode\(runtimeRecoveryAction\);[\s\S]*useEffect\(\(\) => \{[\s\S]*const shouldClearError = shouldClearRuntimeRecoveryError\(runtimeRecoveryError, runtimeRecoveryReasonCode\);[\s\S]*if \(shouldClearError === true\) \{[\s\S]*setRuntimeRecoveryError\(''\);[\s\S]*\}, \[runtimeRecoveryError, runtimeRecoveryReasonCode\]\);/,
  'runtime health recovery error should clear through a named reader when runtime status no longer exposes a recovery action',
);
assert.doesNotMatch(
  desktopPreviewPanel,
  /summary\.restartRuntimeAction \|\||summary\.restartRuntimeAction &&|summary\.relatedCapabilityAuditAction &&|summary\.restartRuntimeAction\?\.reasonCode \|\| ''|summary\.restartRuntimeAction\?\.label \|\| null|summary\.restartRuntimeAction\?\.description \|\| null|summary\.restartRuntimeAction\?\.reasonCode \|\| null|runtimeRecoveryError && !runtimeRecoveryReasonCode|capabilityAuditUrlSyncError \? \(|runtimeRecoveryError \? \(/,
  'runtime health banner should not regress recovery action inputs or reason code cleanup to inline OR fallback',
);
assert.match(
  desktopPreviewPanel,
  /const runtimeRecoveryStatusMessage = getDesktopPreviewRenderableStatusMessage\(runtimeRecoveryError\);[\s\S]*\{runtimeRecoveryStatusMessage !== null && \([\s\S]*<span role="status"[\s\S]*\{runtimeRecoveryStatusMessage\}/,
  'runtime health banner should render runtime recovery failures inline through a named renderable status reader',
);
assert.match(
  desktopPreviewPanel,
  /disabled=\{isRecoveringRuntime === true\}[\s\S]*onClick=\{\(\) => setIsRuntimeRecoveryConfirmationOpen\(true\)\}[\s\S]*\{getRuntimeRecoveryActionButtonLabel\(\{[\s\S]*isRecoveringRuntime,[\s\S]*runtimeRecoveryAction: renderableRuntimeRecoveryAction,[\s\S]*\}\)\}[\s\S]*<Button[\s\S]*disabled=\{runtimeRecoveryConfirmationSnapshot\.canConfirm === false\}[\s\S]*\{getRuntimeRecoveryConfirmButtonLabel\(isRecoveringRuntime\)\}/,
  'runtime health recover action should expose a visible pending state',
);
assert.doesNotMatch(
  desktopPreviewPanel,
  /isRecoveringRuntime \? '恢复中\.\.\.' : runtimeRecoveryAction\.label|isRecoveringRuntime \? '恢复中\.\.\.' : '确认恢复'/,
  'runtime health recover action labels should not regress to inline ternary display gates',
);
assert.match(
  desktopPreviewPanel,
  /Persistence: \{summary\.persistenceLabel\}/,
  'runtime health banner should expose runtime status persistence state',
);
assert.match(
  desktopPreviewPanel,
  /const \[previewReloadKey, setPreviewReloadKey\] = useState\(0\)/,
  'desktop preview panel should maintain a local iframe reload key',
);
assert.match(
  desktopPreviewPanel,
  /(?=[\s\S]*type PreviewRuntimeRecoveryNoticeModel)(?=[\s\S]*function getPreviewRuntimeRecoveryNotice\()(?=[\s\S]*deriveRuntimeHealthDiagnosticsSummary\(runtimeStatus\))(?=[\s\S]*summary\.isBlocking === false)(?=[\s\S]*title: '预览服务未就绪')(?=[\s\S]*export function PreviewRuntimeRecoveryNotice)(?=[\s\S]*预览服务重启失败)(?=[\s\S]*重启预览服务)(?=[\s\S]*<PreviewRuntimeRecoveryNotice[\s\S]*runtimeStatus=\{runtimeStatus\}[\s\S]*onRecoverRuntime=\{onRecoverRuntime\})/,
  'preview panel should expose a normal-user recovery notice and restart action when preview runtime is blocked',
);
assert.match(
  previewLocalErrors,
  /export type PreviewLocalErrorSource = 'preview_iframe' \| 'browser_history';[\s\S]*export type PreviewLocalErrorDetails = string;[\s\S]*export function getPreviewLocalErrorDetails\([\s\S]*fallback: PreviewLocalErrorDetails,[\s\S]*\): PreviewLocalErrorDetails[\s\S]*export function formatPreviewLocalError\([\s\S]*fallback: PreviewLocalErrorDetails,[\s\S]*source: PreviewLocalErrorSource[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source,[\s\S]*details,[\s\S]*\}, fallback\);[\s\S]*export function formatPreviewIframeError\(error: unknown, fallback: PreviewLocalErrorDetails\) \{[\s\S]*return formatPreviewLocalError\(error, fallback, 'preview_iframe'\);/,
  'preview local errors should centralize preview_iframe and browser_history source/details formatting',
);
assert.doesNotMatch(
  previewLocalErrors,
  /fallback: string/,
  'preview local errors should not regress to raw fallback strings',
);
assert.match(
  desktopPreviewPanel,
  /const \[previewIframeError, setPreviewIframeError\] = useState\(''\);[\s\S]*const reloadPreview = \(\) => \{[\s\S]*setPreviewIframeError\(''\);[\s\S]*setPreviewReloadKey\(\(value\) => value \+ 1\);[\s\S]*\};/,
  'desktop preview reload should clear stale iframe load errors before remounting the iframe',
);
assert.match(
  desktopPreviewPanel,
  /(?=[\s\S]*import \{ normalizePreviewBrowserUrl \} from '\.\/workspace-preview-url-status';)(?=[\s\S]*function getDesktopPreviewRuntimeHomeUrl\(runtimeStatus: ProjectRuntimeStatus \| undefined\): string)(?=[\s\S]*function hasDesktopPreviewTextValue\(value: string\): boolean)(?=[\s\S]*function shouldRenderDesktopPreviewIframe\(normalizedBrowserUrl: string\): boolean)(?=[\s\S]*const runtimeHomeUrl = getDesktopPreviewRuntimeHomeUrl\(runtimeStatus\);)(?=[\s\S]*const hasRuntimeHomeUrl = hasDesktopPreviewTextValue\(runtimeHomeUrl\);)(?=[\s\S]*const normalizedBrowserUrl = normalizePreviewBrowserUrl\(browserUrl\);)(?=[\s\S]*const shouldRenderPreviewIframe = shouldRenderDesktopPreviewIframe\(normalizedBrowserUrl\);)(?=[\s\S]*const canReloadPreview = shouldRenderPreviewIframe;)/,
  'desktop preview home, reload and iframe state should derive URLs from normalized preview input through named facts',
);
assert.match(
  desktopPreviewPanel,
  /onClick=\{reloadPreview\} disabled=\{canReloadPreview === false\}/,
  'desktop preview refresh button should force a local iframe reload without changing runtime state',
);
assert.match(
  desktopPreviewPanel,
  /onClick=\{openRuntimeHome\} disabled=\{hasRuntimeHomeUrl === false\}/,
  'desktop preview home button should navigate back to the runtime preview URL when available',
);
assert.match(
  desktopPreviewPanel,
  /<PreviewRuntimeRecoveryNotice[\s\S]*runtimeStatus=\{runtimeStatus\}[\s\S]*onRecoverRuntime=\{onRecoverRuntime\}/,
  'desktop preview should render the user-visible preview recovery notice outside app-debug-only',
);
assert.match(
  desktopPreviewPanel,
  /shouldRenderPreviewIframe === true \? \([\s\S]*key=\{`\$\{normalizedBrowserUrl\}:\$\{previewReloadKey\}:\$\{previewReloadToken\}`\}[\s\S]*src=\{normalizedBrowserUrl\}/,
  'desktop preview iframe should remount when the local reload key or save-triggered reload token changes through a named iframe render fact',
);
assert.match(
  desktopPreviewPanel,
  /const renderablePreviewIframeError = getDesktopPreviewRenderableStatusMessage\(previewIframeError\);[\s\S]*\{renderablePreviewIframeError !== null && \([\s\S]*<div role="status"[\s\S]*\{renderablePreviewIframeError\}[\s\S]*<iframe[\s\S]*onLoad=\{\(\) => setPreviewIframeError\(''\)\}[\s\S]*onError=\{handlePreviewIframeError\}/,
  'desktop preview iframe load failures should render a user-visible status with preview_iframe source/details through a named renderable status reader',
);
assert.match(
  mobilePreviewPanel,
  /import \{ formatPreviewIframeError \} from '@\/lib\/workspace\/preview-local-errors';[\s\S]*import \{ PreviewRuntimeRecoveryNotice, PreviewShareControl, RuntimeHealthBanner \} from '\.\/workspace-ide-desktop-preview-panel'/,
  'mobile preview panel should reuse the shared preview iframe formatter from lib and the shared runtime health banner',
);
assert.match(
  mobilePreviewPanel,
  /<RuntimeHealthBanner[\s\S]*runtimeStatus=\{runtimeStatus\}[\s\S]*onOpenCapabilityAudit=\{onOpenCapabilityAudit\}[\s\S]*onRecoverRuntime=\{onRecoverRuntime\}[\s\S]*\/>/,
  'mobile preview panel should pass runtime status, capability audit action and runtime recovery action into the shared banner',
);
assert.match(
  mobilePreviewPanel,
  /<PreviewRuntimeRecoveryNotice[\s\S]*runtimeStatus=\{runtimeStatus\}[\s\S]*onRecoverRuntime=\{onRecoverRuntime\}[\s\S]*compact/,
  'mobile preview panel should render the compact user-visible preview recovery notice outside app-debug-only',
);
assert.match(
  desktopPreviewPanel + mobilePreviewPanel,
  /export function PreviewShareControl[\s\S]*projectApi\.get\(activeProjectId\)[\s\S]*projectApi\.enablePreviewShare\(activeProjectId\)[\s\S]*projectApi\.disablePreviewShare\(activeProjectId\)[\s\S]*获取链接的人无需登录[\s\S]*<PopoverContent[\s\S]*<PreviewShareControl projectId=\{projectId\} \/>[\s\S]*<PopoverContent[\s\S]*<PreviewShareControl projectId=\{projectId\} compact \/>/,
  'desktop and mobile Preview panels should expose preview share controls inside the URL bar more-actions popover',
);
assert.doesNotMatch(
  desktopPreviewPanel + mobilePreviewPanel,
  /<PreviewRuntimeRecoveryNotice[\s\S]*\/>\s*<PreviewShareControl/,
  'preview share controls should not be rendered as a permanent panel row outside the URL bar more-actions popover',
);
assert.match(
  mobilePreviewPanel,
  /const \[previewReloadKey, setPreviewReloadKey\] = useState\(0\)/,
  'mobile preview panel should maintain a local iframe reload key',
);
assert.match(
  mobilePreviewPanel,
  /import \{ normalizePreviewBrowserUrl \} from '\.\/workspace-preview-url-status';[\s\S]*function shouldRenderMobilePreviewIframe\(normalizedMobileBrowserUrl: string\): boolean[\s\S]*const normalizedMobileBrowserUrl = normalizePreviewBrowserUrl\(mobileBrowserUrl\);[\s\S]*const shouldRenderPreviewIframe = shouldRenderMobilePreviewIframe\(normalizedMobileBrowserUrl\);[\s\S]*const canReloadPreview = shouldRenderPreviewIframe;[\s\S]*const reloadPreview = \(\) => \{[\s\S]*setPreviewIframeError\(''\);[\s\S]*setPreviewReloadKey\(\(value\) => value \+ 1\);[\s\S]*\};[\s\S]*onClick=\{reloadPreview\} disabled=\{canReloadPreview === false\}/,
  'mobile preview refresh should normalize empty URLs, derive reload through a named iframe fact, clear stale iframe errors and reload without duplicating browser history',
);
assert.match(
  mobilePreviewPanel,
  /shouldRenderPreviewIframe === true \? \([\s\S]*key=\{`\$\{normalizedMobileBrowserUrl\}:\$\{previewReloadKey\}:\$\{previewReloadToken\}`\}[\s\S]*src=\{normalizedMobileBrowserUrl\}/,
  'mobile preview iframe should remount when the local reload key or save-triggered reload token changes through a named iframe render fact',
);
assert.match(
  mobilePreviewPanel,
  /function getMobilePreviewNavigationUrl\(rawUrl: string\): string \| null[\s\S]*hasMobilePreviewTextValue\(rawUrl\) === false[\s\S]*return null;[\s\S]*const hasProtocol = rawUrl\.startsWith\('http'\);[\s\S]*if \(hasProtocol === true\)[\s\S]*return `https:\/\/\$\{rawUrl\}`;[\s\S]*const rawUrl = event\.currentTarget\.value\.trim\(\);[\s\S]*const navigationUrl = getMobilePreviewNavigationUrl\(rawUrl\);[\s\S]*if \(navigationUrl === null\) \{[\s\S]*return;[\s\S]*navigateMobilePreview\(navigationUrl\);/,
  'mobile preview address submit should ignore blank input instead of navigating to an invalid https URL',
);
assert.match(
  mobilePreviewPanel,
  /(?=[\s\S]*formatPreviewIframeError\(error, '移动端预览 iframe 加载失败'\))(?=[\s\S]*const renderablePreviewIframeError = getMobilePreviewRenderableStatusMessage\(previewIframeError\);)(?=[\s\S]*\{renderablePreviewIframeError !== null && \()(?=[\s\S]*<div role="status"[\s\S]*\{renderablePreviewIframeError\})(?=[\s\S]*<iframe[\s\S]*onLoad=\{\(\) => setPreviewIframeError\(''\)\}[\s\S]*onError=\{handlePreviewIframeError\})/,
  'mobile preview iframe load failures should render a user-visible status with preview_iframe source/details through a named renderable status reader',
);

const idePanels = fs.readFileSync('src/app/workspace/workspace-ide-panels.tsx', 'utf8');
assert.match(
  idePanels,
  /onOpenCapabilityAudit=\{\(\) => onSelectTab\('debug'\)\}/,
  'runtime health preview panels should route capability audit actions to the debug tab',
);
assert.ok(
  (idePanels.match(/onOpenCapabilityAudit=\{\(\) => onSelectTab\('debug'\)\}/g) || []).length >= 2,
  'runtime health capability audit action should be wired in both desktop and mobile preview panels',
);
assert.ok(
  (idePanels.match(/onRecoverRuntime=\{onRecoverRuntime\}/g) || []).length >= 2,
  'runtime health recover runtime action should be wired in both desktop and mobile preview panels',
);

const workspacePageActionControllers = fs.readFileSync('src/app/workspace/use-workspace-page-action-controllers.tsx', 'utf8');
assert.match(
  workspacePageActionControllers,
  /const handleRecoverRuntime = async \(\) => \{[\s\S]*runtimeResources\.ensureProjectRuntimeReady\(projectId, \{[\s\S]*initialStage: '正在恢复开发运行时\.\.\.',[\s\S]*waitStage: '正在等待运行时就绪\.\.\.',[\s\S]*\}\);/,
  'runtime health recovery controller should reuse the existing runtime readiness start/wait chain',
);
assert.match(
  workspacePageActionControllers,
  /function materializeWorkspacePageActionControllerRejectedResults\([\s\S]*results: PromiseSettledResult<unknown>\[\],[\s\S]*\): PromiseRejectedResult\[\][\s\S]*for \(const result of results\)[\s\S]*const isRejectedResult = result\.status === 'rejected';[\s\S]*const refreshResults = await Promise\.allSettled\(\[[\s\S]*runtimeResources\.fetchProjectDetail\(projectId\),[\s\S]*runtimeResources\.refreshProjectFileTree\(projectId, true,[\s\S]*runtimeResources\.fetchProjectWorktreeStatus\(projectId,[\s\S]*runtimeResources\.fetchProjectCommits\(projectId,[\s\S]*const refreshFailures = materializeWorkspacePageActionControllerRejectedResults\(refreshResults\);/,
  'runtime health recovery controller should refresh project detail, Explorer and Git true sources after recovery',
);
assert.doesNotMatch(
  workspacePageActionControllers,
  /refreshResults\.filter\(/,
  'runtime health recovery controller should not regress post-ready true-source failure reads to inline filter callbacks',
);
assert.match(
  workspacePageActionControllers,
  /Runtime Health 已恢复运行时，但后置真源刷新存在失败资源[\s\S]*Runtime 已恢复，真源刷新不完整/,
  'runtime health recovery controller should not report full recovery when post-ready true-source refresh has partial failures',
);
assert.match(
  workspacePageActionControllers,
  /reason_code: status === 'passed'[\s\S]*'runtime_health_recovery_completed'[\s\S]*'runtime_health_recovery_failed'[\s\S]*retry_label: status === 'failed' \? '恢复运行时' : undefined/,
  'runtime health recovery controller should publish workflow recovery state and retry metadata',
);
assert.match(
  workspacePageActionControllers,
  /const recoveringRuntimeProjectRef = useRef<string \| null>\(null\);[\s\S]*const recoveryProjectId = getWorkspacePageActionControllerRecoveryProjectId\(recoveringRuntimeProjectRef\.current\);[\s\S]*if \(recoveryProjectId !== null\) \{[\s\S]*runtime-recovery-in-progress-\$\{recoveryProjectId\}[\s\S]*控制器已拦截重复恢复请求[\s\S]*return;[\s\S]*recoveringRuntimeProjectRef\.current = projectId;[\s\S]*finally \{[\s\S]*if \(recoveringRuntimeProjectRef\.current === projectId\) \{[\s\S]*recoveringRuntimeProjectRef\.current = null;/,
  'runtime health recovery controller should guard duplicate start/wait recovery chains and release the guard after completion',
);
assert.match(
  workspacePageActionControllers,
  /WorkspaceRuntimeRecoveryStatus[\s\S]*status: WorkspaceRuntimeRecoveryStatus[\s\S]*Workspace Runtime Health 显式恢复进行中[\s\S]*重复恢复请求已被控制器防重入拦截[\s\S]*recovery: status === 'running' \? undefined : \{/,
  'runtime health recovery controller should expose an in-progress engineering state without marking duplicate requests as failed recovery',
);

const runtimeResources = fs.readFileSync('src/app/workspace/use-workspace-runtime-resources.ts', 'utf8');
const workspaceRuntimeResourceErrors = fs.readFileSync('src/lib/workspace/workspace-runtime-resource-errors.ts', 'utf8');
const runtimeHealthDiagnostics = fs.readFileSync('src/lib/workspace/runtime-health-diagnostics.ts', 'utf8');
const runtimeHealthQuery = fs.readFileSync('src/lib/workspace/runtime-health-query.ts', 'utf8');
const apiClient = fs.readFileSync('src/lib/api/index.ts', 'utf8');
const projectsPage = fs.readFileSync('src/app/projects/page.tsx', 'utf8');
const projectListRuntimeStopErrors = fs.readFileSync('src/lib/workspace/project-list-runtime-stop-errors.ts', 'utf8');
const runtimeHandler = fs.readFileSync('backend/internal/handler/project_runtime_handler.go', 'utf8');
const runtimeStatusService = fs.readFileSync('backend/internal/service/runtime_status.go', 'utf8');
const runtimePreviewService = fs.readFileSync('backend/internal/service/project_preview_runtime.go', 'utf8');
const previewShareService = fs.readFileSync('backend/internal/service/project_preview_share_service.go', 'utf8');
const projectRuntimeFacade = fs.readFileSync('backend/internal/service/project_runtime_facade.go', 'utf8');
const generationApplyService = fs.readFileSync('backend/internal/service/generation_apply_service.go', 'utf8');
const previewProxyRoute = fs.readFileSync('src/app/preview/_preview-proxy.ts', 'utf8');
const previewRootRoute = fs.readFileSync('src/app/preview/route.ts', 'utf8');
const previewPathRoute = fs.readFileSync('src/app/preview/[...path]/route.ts', 'utf8');
const runtimeFacadeService = fs.readFileSync('backend/internal/service/project_runtime_facade.go', 'utf8');
const previewGateway = fs.readFileSync('backend/internal/handler/preview_gateway.go', 'utf8');
const previewAccess = fs.readFileSync('backend/internal/handler/preview_access.go', 'utf8');
const previewAccessTest = fs.readFileSync('backend/internal/handler/preview_access_test.go', 'utf8');
const projectHandler = fs.readFileSync('backend/internal/handler/project.go', 'utf8');
const backendRoutes = fs.readFileSync('backend/cmd/server/main.go', 'utf8');
const projectFileService = fs.readFileSync('backend/internal/service/project_file_service.go', 'utf8');
const projectGitService = fs.readFileSync('backend/internal/service/git.go', 'utf8');
const projectPreviewService = fs.readFileSync('backend/internal/service/project_preview_service.go', 'utf8');
const runtimeActivityProxyRoute = fs.readFileSync('src/app/api/project/[id]/runtime-activity/route.ts', 'utf8');
const containerManagerTest = fs.readFileSync('backend/pkg/container/container_test.go', 'utf8');
const projectServiceAdminTest = fs.readFileSync('backend/internal/service/project_service_admin_test.go', 'utf8');
assert.match(
  runtimeResources,
  /const runtimeReadinessInFlightRef = useRef<Map<string, Promise<ProjectRuntimeStatus>>>\(new Map\(\)\);/,
  'runtime resources should keep an explicit project-scoped in-flight readiness guard',
);
assert.match(
  runtimeResources,
  /function hasWorkspaceRuntimeReadinessInFlight\([\s\S]*readiness: Promise<ProjectRuntimeStatus> \| undefined,[\s\S]*\): readiness is Promise<ProjectRuntimeStatus>[\s\S]*return readiness !== undefined;[\s\S]*const existingReadiness = runtimeReadinessInFlightRef\.current\.get\(projectId\);[\s\S]*const hasReadinessInFlight = hasWorkspaceRuntimeReadinessInFlight\(existingReadiness\);[\s\S]*if \(hasReadinessInFlight === true\) \{[\s\S]*运行时启动或恢复已在进行中[\s\S]*phase: 'runtime_readiness_in_flight'[\s\S]*return existingReadiness;/,
  'runtime resources should reuse an existing readiness promise instead of issuing duplicate start requests',
);
assert.doesNotMatch(
  runtimeResources,
  /if \(existingReadiness\)/,
  'runtime resources should not regress in-flight readiness reuse to a direct truthy gate',
);
assert.match(
  runtimeResources,
  /const readinessPromise = \(async \(\) => \{[\s\S]*projectApi\.startContainer\(projectId\)[\s\S]*return waitForProjectRuntimeReady\(projectId\);[\s\S]*runtimeReadinessInFlightRef\.current\.set\(projectId, readinessPromise\);[\s\S]*finally \{[\s\S]*runtimeReadinessInFlightRef\.current\.delete\(projectId\);/,
  'runtime resources should register the start/wait promise and release the in-flight guard after completion',
);
assert.match(
  runtimeResources,
  /resetWorkspaceRuntimeBootstrapState[\s\S]*runtimeReadinessInFlightRef\.current\.delete\(projectId\);/,
  'workspace runtime reset should clear stale readiness in-flight guards for the project',
);
assert.match(
  runtimeHealthDiagnostics,
  /from '@\/lib\/workspace\/runtime-health-query'/,
  'workspace runtime diagnostics should reuse the shared runtime health query helper',
);
assert.match(
  runtimeHealthQuery,
  /(?=[\s\S]*export type RuntimeHealthDiagnosticContextActiveLabel = string;)(?=[\s\S]*export type RuntimeHealthDiagnosticContextActiveLabelList = RuntimeHealthDiagnosticContextActiveLabel\[\];)(?=[\s\S]*export type RuntimeHealthDiagnosticReasonCode = string;)(?=[\s\S]*reasonCode: RuntimeHealthDiagnosticReasonCode;)(?=[\s\S]*activeLabels: RuntimeHealthDiagnosticContextActiveLabelList;)(?=[\s\S]*function hasRuntimeHealthQueryValue\(value: string\): boolean)(?=[\s\S]*function shouldDeleteRuntimeHealthSearchParamValue\(value: string\): boolean)(?=[\s\S]*function getRuntimeHealthSearch\(searchParams: URLSearchParams\): string \{[\s\S]*const hasNextSearch = hasRuntimeHealthQueryValue\(nextSearch\);[\s\S]*if \(hasNextSearch === false\) \{[\s\S]*return '';[\s\S]*return `\?\$\{nextSearch\}`;)(?=[\s\S]*function hasRuntimeHealthDiagnosticContextValue\(\{[\s\S]*hasProjectId,[\s\S]*hasReasonCode,[\s\S]*\}: \{[\s\S]*hasProjectId: boolean;[\s\S]*hasReasonCode: boolean;[\s\S]*\}\): boolean \{[\s\S]*if \(hasProjectId === true\) \{[\s\S]*return true;[\s\S]*return hasReasonCode === true;)(?=[\s\S]*function hasRuntimeHealthDiagnosticContext\(\{[\s\S]*projectId,[\s\S]*reasonCode,[\s\S]*\}: \{[\s\S]*projectId: string;[\s\S]*reasonCode: RuntimeHealthDiagnosticReasonCode;[\s\S]*\}\): boolean)(?=[\s\S]*return hasRuntimeHealthDiagnosticContextValue\(\{[\s\S]*hasProjectId,[\s\S]*hasReasonCode,[\s\S]*\}\);)(?=[\s\S]*function getRuntimeHealthDiagnosticContextActiveLabel\(\{[\s\S]*key,[\s\S]*value,[\s\S]*\}: \{[\s\S]*key: RuntimeHealthSearchParamKey;[\s\S]*value: string;[\s\S]*\}\): RuntimeHealthDiagnosticContextActiveLabel)(?=[\s\S]*function hasRuntimeHealthDiagnosticContextActiveLabel\([\s\S]*label: RuntimeHealthDiagnosticContextActiveLabel,[\s\S]*\): boolean)(?=[\s\S]*function getRuntimeHealthDiagnosticContextActiveLabels\([\s\S]*labels: RuntimeHealthDiagnosticContextActiveLabelList,[\s\S]*\): RuntimeHealthDiagnosticContextActiveLabelList \{[\s\S]*const activeLabels: RuntimeHealthDiagnosticContextActiveLabelList = \[\];[\s\S]*for \(const label of labels\) \{[\s\S]*const hasLabel = hasRuntimeHealthDiagnosticContextActiveLabel\(label\);[\s\S]*if \(hasLabel === true\) \{[\s\S]*activeLabels\.push\(label\);)(?=[\s\S]*const shouldDeleteParam = shouldDeleteRuntimeHealthSearchParamValue\(normalizedValue\);)(?=[\s\S]*return getRuntimeHealthSearch\(searchParams\);)(?=[\s\S]*for \(const key of keys\) \{[\s\S]*searchParams\.delete\(key\);[\s\S]*\})(?=[\s\S]*const reasonCode: RuntimeHealthDiagnosticReasonCode = readString\(searchParams\.get\(RUNTIME_HEALTH_REASON_QUERY_PARAM\)\);)(?=[\s\S]*const hasDiagnosticContext = hasRuntimeHealthDiagnosticContext\(\{ projectId, reasonCode \}\);)(?=[\s\S]*const activeLabelCandidates: RuntimeHealthDiagnosticContextActiveLabelList = \[[\s\S]*getRuntimeHealthDiagnosticContextActiveLabel\(\{[\s\S]*key: RUNTIME_HEALTH_PROJECT_QUERY_PARAM,[\s\S]*value: projectId,[\s\S]*\}\),[\s\S]*getRuntimeHealthDiagnosticContextActiveLabel\(\{[\s\S]*key: RUNTIME_HEALTH_REASON_QUERY_PARAM,[\s\S]*value: reasonCode,[\s\S]*\}\),[\s\S]*\];[\s\S]*const activeLabels = getRuntimeHealthDiagnosticContextActiveLabels\(activeLabelCandidates\);)/,
  'runtime health diagnostic context should name active label, reason code, query value and context label facts',
);
assert.doesNotMatch(
  runtimeHealthQuery,
  /activeLabels: string\[\];|const activeLabels: string\[\]|reasonCode: string;|if \(!normalizedValue \|\| normalizedValue === 'all'\)|return nextSearch \?|hasNextSearch === true \? `\?\$\{nextSearch\}` : ''|if \(!projectId && !reasonCode\)|hasProjectId === true \|\| hasReasonCode === true|projectId \?|reasonCode \?|\]\.filter\(Boolean\)|\]\.filter\(\(label\) => hasRuntimeHealthDiagnosticContextActiveLabel\(label\)\)|keys\.forEach\(\(key\) => searchParams\.delete\(key\)\)/,
  'runtime health diagnostic context should not keep active labels, reason code, query value or context labels as anonymous string contracts or truthy predicates',
);
assert.match(
  runtimeHealthDiagnostics,
  /function getRuntimeHealthLabel\(value: string, fallback: string\): string \{[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true \? value : fallback;[\s\S]*function hasRuntimeHealthTextValue\(value: string\): boolean \{[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;[\s\S]*function hasRuntimeHealthProjectId\(projectId: string\): boolean \{[\s\S]*const hasProjectId = hasRuntimeHealthTextValue\(projectId\);[\s\S]*return hasProjectId === true;[\s\S]*function hasRuntimeHealthStatus\(status: ProjectRuntimeStatus \| null \| undefined\): status is ProjectRuntimeStatus \{[\s\S]*if \(status === null\)[\s\S]*return false;[\s\S]*return status !== undefined;[\s\S]*const hasRawTimestamp = hasRuntimeHealthTextValue\(raw\);[\s\S]*if \(hasRawTimestamp === false\)[\s\S]*const hasProjectId = hasRuntimeHealthProjectId\(projectId\);[\s\S]*if \(hasProjectId === true\)[\s\S]*const hasPreviewUrl = previewUrl\.length > 0;[\s\S]*const hasError = error\.length > 0;[\s\S]*const isPreviewAvailable = hasPreviewUrl === true;[\s\S]*const statusLabel = getRuntimeHealthLabel\(runtimeStatus, 'unknown'\);[\s\S]*const unknownContainerLabel = getRuntimeHealthLabel\(containerStatus, 'unknown'\);[\s\S]*const readyContainerLabel = getRuntimeHealthLabel\(containerStatus, 'running'\);[\s\S]*const preparingContainerLabel = getRuntimeHealthLabel\(containerStatus, 'pending'\);[\s\S]*const stoppedContainerLabel = getRuntimeHealthLabel\(containerStatus, 'stopped'\);[\s\S]*const persistenceLabel = getRuntimeHealthLabel\(persistenceStatus, 'unknown'\);[\s\S]*const previewUnavailableLabel = getRuntimeHealthLabel\(previewUrl, '未提供预览地址'\);[\s\S]*const previewPendingLabel = getRuntimeHealthLabel\(previewUrl, '预览地址待生成'\);[\s\S]*const persistenceFailureMessage = getRuntimeHealthLabel\(persistenceError, '无法写入 runtime-status 快照'\);[\s\S]*const failedRuntimeMessage = getRuntimeHealthLabel\(error, getRuntimeHealthLabel\(message, '运行时准备失败。'\)\);[\s\S]*const relatedCapabilityAuditAction = hasError === true \? buildRelatedCapabilityAuditAction\(\) : null;[\s\S]*const hasStatus = hasRuntimeHealthStatus\(status\);[\s\S]*if \(hasStatus === false\)[\s\S]*if \(persistenceStatus === 'failed'\) \{[\s\S]*message: `运行时状态持久化失败：\$\{persistenceFailureMessage\}`[\s\S]*刷新或重新进入 Workspace 后恢复/,
  'runtime health diagnostics should prioritize failed runtime status persistence metadata through explicit label facts',
);
assert.match(
  runtimeHealthDiagnostics,
  /const containerStatusPersistenceFailureMessage = getRuntimeHealthLabel\([\s\S]*containerStatusPersistenceError,[\s\S]*'无法更新项目 container_status'[\s\S]*if \(containerStatusPersistence === 'failed'\) \{[\s\S]*message: `项目容器状态同步失败：\$\{containerStatusPersistenceFailureMessage\}`[\s\S]*容器真实状态与项目列表状态可能不一致/,
  'runtime health diagnostics should surface container status persistence failures through explicit label facts',
);
assert.doesNotMatch(
  runtimeHealthDiagnostics,
  /Boolean\(previewUrl\)|Boolean\(error\)|runtimeStatus \|\| 'unknown'|containerStatus \|\| 'unknown'|containerStatus \|\| 'running'|containerStatus \|\| 'pending'|containerStatus \|\| 'stopped'|persistenceStatus \|\| 'unknown'|previewUrl \|\| '未提供预览地址'|previewUrl \|\| '预览地址待生成'|persistenceError \|\| '无法写入 runtime-status 快照'|containerStatusPersistenceError \|\| '无法更新项目 container_status'|message \|\| error \|\| '运行时状态未归类。'|error \|\| message \|\| '运行时准备失败。'|isBlocking: Boolean\(error\)|error \? buildRelatedCapabilityAuditAction\(\) : null|if \(!raw\)|if \(projectId\)|if \(!status\)/,
  'runtime health diagnostics should not regress to inline OR fallback or implicit Boolean gates for summary labels',
);
assert.match(
  runtimeHealthQuery,
  /export type RuntimeHealthSearchParamKey = string;[\s\S]*export type RuntimeHealthSearchParamKeyList = RuntimeHealthSearchParamKey\[\];[\s\S]*export const RUNTIME_HEALTH_PROJECT_QUERY_PARAM: RuntimeHealthSearchParamKey = 'runtime_project';[\s\S]*export const RUNTIME_HEALTH_REASON_QUERY_PARAM: RuntimeHealthSearchParamKey = 'runtime_reason';[\s\S]*export function updateRuntimeHealthSearchParam\(search: string, key: RuntimeHealthSearchParamKey, value\?: string \| null\): string[\s\S]*export function clearRuntimeHealthSearchParams\(search: string, keys: RuntimeHealthSearchParamKeyList\): string/,
  'shared runtime health query helper should name runtime search param key contracts',
);
assert.doesNotMatch(
  runtimeHealthQuery,
  /updateRuntimeHealthSearchParam\(search: string, key: string, value\?: string \| null\): string|clearRuntimeHealthSearchParams\(search: string, keys: string\[\]\): string/,
  'shared runtime health query helper should not regress runtime search param keys to broad string or anonymous arrays',
);
assert.match(
  runtimeHealthQuery,
  /export const RUNTIME_HEALTH_PROJECT_QUERY_PARAM: RuntimeHealthSearchParamKey = 'runtime_project'/,
  'shared runtime health query helper should own the runtime project query key',
);
assert.match(
  runtimeHealthQuery,
  /export function updateRuntimeHealthProjectSearch/,
  'shared runtime health query helper should own runtime project search updates',
);
assert.match(
  runtimeResources,
  /recovery: isFailed \? \{/,
  'runtime failed engineering state should include a unified recovery payload',
);
assert.match(
  runtimeResources,
  /reason_code: 'runtime_readiness_failed'/,
  'runtime recovery payload should use the runtime readiness failure reason code',
);
assert.match(
  runtimeResources,
  /resume_stage: 'runtime_recovery'/,
  'runtime recovery payload should expose the runtime recovery stage',
);
assert.match(
  runtimeResources,
  /resume_mode: 'implement'/,
  'runtime recovery payload should resume through the implementation workflow mode',
);
assert.match(
  runtimeResources,
  /retry_label: '重新恢复运行时'/,
  'runtime recovery payload should provide a user-visible retry label',
);
assert.match(
  runtimeResources,
  /retry_prompt: `请恢复项目 \$\{projectId\} 的开发运行时/,
  'runtime recovery payload should provide a project-scoped retry prompt',
);
assert.match(
  workspaceRuntimeResourceErrors,
  /export function buildRuntimeStatusFailureError\([\s\S]*source: 'runtime_status_snapshot'[\s\S]*details: formatRuntimeStatusFailureDetails\(projectId, status\)/,
  'runtime failed snapshots should be built with runtime_status_snapshot source/details instead of bare Error',
);
assert.match(
  runtimeResources,
  /buildRuntimeStatusFailureError\(projectId, status\)/,
  'runtime resources hook should rethrow runtime failed snapshots through the shared structured error builder',
);
assert.match(
  runtimeResources,
  /status\.status === 'failed'[\s\S]*publishRuntimeEngineeringState\([\s\S]*projectId,[\s\S]*status,[\s\S]*getWorkspaceRuntimeResourceTextValue\([\s\S]*status\.message,[\s\S]*getWorkspaceRuntimeResourceTextValue\(status\.error, '开发环境准备失败'\),[\s\S]*\),[\s\S]*\);[\s\S]*throw buildRuntimeStatusFailureError\(projectId, status\);/,
  'runtime wait failures should preserve failed snapshot details for user-visible recovery errors',
);
assert.match(
  runtimeResources,
  /if \(status\.status === 'failed'\) \{[\s\S]*publishRuntimeEngineeringState\([\s\S]*projectId,[\s\S]*status,[\s\S]*getWorkspaceRuntimeResourceTextValue\([\s\S]*status\.message,[\s\S]*getWorkspaceRuntimeResourceTextValue\(status\.error, '开发环境准备失败'\),[\s\S]*\),[\s\S]*\);[\s\S]*throw buildRuntimeStatusFailureError\(projectId, status\);[\s\S]*const waitStage = getWorkspaceRuntimeResourceReadinessWaitStage\(options\);[\s\S]*const hasWaitStage = hasWorkspaceRuntimeResourceReadinessStage\(waitStage\);/,
  'runtime start failed snapshots should not be hidden behind a follow-up polling failure',
);
assert.match(
  workspaceRuntimeResourceErrors,
  /export function buildRuntimeStatusWaitTimeoutError\(projectId: string, maxAttempts: number\)[\s\S]*source: 'runtime_status_wait'[\s\S]*max_attempts=\$\{maxAttempts\}/,
  'runtime wait timeout helper should expose runtime_status_wait source/details',
);
assert.match(
  runtimeResources,
  /throw buildRuntimeStatusWaitTimeoutError\(projectId, maxAttempts\);/,
  'runtime resources hook should throw runtime wait timeout through the shared structured error builder',
);
assert.match(
  runtimeResources,
  /const fetchRuntimeStatusSnapshot = useCallback/,
  'workspace runtime bootstrap should provide a read-only runtime status snapshot refresh',
);
assert.match(
  runtimeResources,
  /projectApi\.getRuntimeStatus\(projectId\)/,
  'workspace runtime bootstrap should refresh the authoritative runtime status before deciding recovery',
);
assert.match(
  runtimeResources,
  /const hasRuntimeStatus = hasWorkspaceRuntimeResourceTextValue\(runtimeStatus\);[\s\S]*if \(containerStatus === 'running' && hasRuntimeStatus === false\) \{/,
  'workspace runtime bootstrap should not treat a running container as a ready runtime when runtimeStatus is missing',
);
assert.match(
  runtimeResources,
  /runtimeReady = runtimeStatus === 'ready';/,
  'workspace runtime bootstrap should derive readiness from runtime status instead of container status',
);
assert.match(
  runtimeResources,
  /else if \(runtimeReady === false && runtimeFailed === false && hasSelectedPlan === true\) \{/,
  'workspace runtime bootstrap should preserve failed runtime state instead of auto-starting over it',
);
assert.match(
  runtimePreviewService,
  /func ensureProjectPreviewServer\([\s\S]*buildProjectPreviewServerCommand\(internalPort, forceRestart\)[\s\S]*result\.ExitCode == 42[\s\S]*errProjectPreviewEntrypointMissing[\s\S]*func buildProjectPreviewServerCommand\(internalPort int, forceRestart bool\) string/,
  'backend runtime should start and verify a real project preview server instead of only exposing a Preview Gateway URL',
);
for (const requiredPreviewServerSegment of [
  'package.json',
  'pnpm install --prefer-offline --no-frozen-lockfile',
  'npm install --legacy-peer-deps',
  '.next/BUILD_ID',
  'run start',
  'run dev',
  'http://127.0.0.1:${PORT}/',
  'preview server did not become ready',
]) {
  assert.ok(
    runtimePreviewService.includes(requiredPreviewServerSegment),
    `preview server command should include ${requiredPreviewServerSegment}`,
  );
}
assert.match(
  projectRuntimeFacade,
  /prepareProjectPreviewReadyStatus\([\s\S]*Message:\s+"正在启动预览服务"[\s\S]*ensureProjectPreviewServer\(ctx, s\.containerMgr, project, spec, false\)[\s\S]*errProjectPreviewEntrypointMissing[\s\S]*Message:\s+"开发环境已就绪，等待生成预览入口"[\s\S]*Message:\s+"预览服务启动失败"[\s\S]*Message:\s+"开发环境和预览服务已就绪"/,
  'runtime ready status should mean the preview server has been started, while missing generated entrypoints stay explicit',
);
assert.match(
  generationApplyService,
  /emitWorkflowStep\(handler, "preview-server", "run_command", "启动预览服务"[\s\S]*startGeneratedProjectPreview\(ctx, project\)[\s\S]*"runtime_status": runtimeStatus[\s\S]*"previewUrl":\s+runtimeStatus\.PreviewURL[\s\S]*func \(s \*GeneratorService\) startGeneratedProjectPreview/,
  'generation finalization should start the preview server after generated files and Git snapshot are written',
);
assert.match(
  previewProxyRoute,
  /process\.env\.PREVIEW_GATEWAY_URL[\s\S]*process\.env\.CONTAINER_PREVIEW_INTERNAL_URL[\s\S]*process\.env\.CONTAINER_PREVIEW_PORT[\s\S]*function getPreviewProxyPublicShareBasePath[\s\S]*\/preview\/\$\{encodeURIComponent\(shareId\)\}[\s\S]*function getPreviewProxyTargetUrl[\s\S]*function rewritePreviewProxyHtml[\s\S]*publicShareBasePath[\s\S]*export async function proxyPreviewRequest/,
  'Next preview route should proxy same-origin /preview traffic to the internal Preview Gateway',
);
assert.match(
  previewRootRoute + previewPathRoute,
  /proxyPreviewRequest\(request, \[\]\)[\s\S]*params: Promise<\{ path\?: string\[\] \}>[\s\S]*proxyPreviewRequest\(request, await getPreviewPathSegments\(context\)\)/,
  'Preview proxy routes should cover /preview/ and nested preview asset paths',
);
assert.match(
  previewAccess,
  /func projectIDFromPreviewAccessToken\(tokenString, jwtSecret string\) \(string, bool\) \{[\s\S]*jwt\.NewParser\(\)\.ParseUnverified\(tokenString, claims\)[\s\S]*claims\.Scope != "preview"[\s\S]*projectID := strings\.TrimSpace\(claims\.ProjectID\)/,
  'Preview gateway should read project id from preview_token without treating expiration as a missing project',
);
assert.match(
  previewAccessTest,
  /func TestPreviewProjectIDCanBeReadFromExpiredTokenForErrorClassification[\s\S]*projectIDFromPreviewAccessToken\(token, "secret"\)[\s\S]*validatePreviewAccessToken\(token, "proj_expired", "secret"\)/,
  'Go tests should cover expired preview tokens being classified as invalid tokens instead of missing project',
);
assert.match(
  previewShareService,
  /crypto\/rand[\s\S]*ProjectPreviewShareResult[\s\S]*preview_share_enabled[\s\S]*preview_share_id[\s\S]*buildProjectPreviewSharePath[\s\S]*EnableProjectPreviewShare[\s\S]*DisableProjectPreviewShare[\s\S]*GetProjectByPreviewShareID/,
  'preview share should use an explicit enable/disable model with a random share id path instead of projectId or query token sharing',
);
assert.match(
  previewGateway,
  /publicShareRequest := false[\s\S]*previewShareIDFromRequestPath\(r\.URL\.Path\)[\s\S]*GetProjectByPreviewShareID\(r\.Context\(\), shareID\)[\s\S]*publicShareRequest = true[\s\S]*stripPreviewShareIDFromRequestPath\(r, shareID\)[\s\S]*publicShareRequest == false[\s\S]*authenticateRequest/,
  'Preview gateway should allow enabled public share paths while keeping normal preview access authenticated',
);
assert.match(
  projectHandler,
  /previewURL = h\.projectService\.BuildProjectPreviewURL\(project\.ProjectID\)(?![\s\S]{0,160}buildSignedPreviewURL)[\s\S]*preview_share_enabled[\s\S]*preview_share_id[\s\S]*preview_share_url[\s\S]*EnablePreviewShare[\s\S]*DisablePreviewShare/,
  'project responses should expose share state while keeping workspace preview URLs free of GET preview tokens',
);
assert.doesNotMatch(
  runtimeHandler,
  /buildSignedPreviewURL\(projectID, project\.UserID, status\.PreviewURL\)/,
  'runtime status and start responses should not append preview_token to workspace preview URLs',
);
assert.match(
  backendRoutes,
  /project\.POST\("\/:id\/preview-share", projectHandler\.EnablePreviewShare\)[\s\S]*project\.DELETE\("\/:id\/preview-share", projectHandler\.DisablePreviewShare\)/,
  'backend routes should expose owner-controlled preview share enable/disable endpoints',
);
assert.match(
  runtimeHandler,
  /func \(h \*ProjectHandler\) GetRuntimeStatus[\s\S]*"success": true,[\s\S]*"status":\s+"failed"[\s\S]*"message":\s+"获取运行时状态失败"/,
  'runtime status query failures should return a successful status payload with status=failed instead of triggering generic request failure',
);
assert.doesNotMatch(
  runtimeHandler,
  /GetRuntimeStatus[\s\S]*"success": false,[\s\S]*"status":\s+"failed"/,
  'runtime status failed snapshots should not be hidden behind success=false API envelopes',
);
assert.match(
  runtimeStatusService,
  /json\.Unmarshal\(data, &status\)[\s\S]*archiveBrokenRuntimeStateFile\(path\)[\s\S]*return nil, fmt\.Errorf\("invalid runtime status snapshot: %w", err\)/,
  'corrupt runtime status snapshots should be archived and returned as explicit read errors',
);
assert.match(
  runtimeStatusService,
  /ContainerStatusPersistence\s+string `json:"containerStatusPersistence,omitempty"`[\s\S]*ContainerStatusPersistenceError string `json:"containerStatusPersistenceError,omitempty"`[\s\S]*PersistenceStatus\s+string `json:"persistenceStatus,omitempty"`[\s\S]*PersistenceError\s+string `json:"persistenceError,omitempty"`/,
  'runtime status snapshots should expose container status and runtime status persistence metadata',
);
assert.match(
  runtimeStatusService,
  /type ProjectRuntimeActivityStatus struct \{[\s\S]*ProjectID\s+string `json:"projectId,omitempty"`[\s\S]*ActivityStatus\s+string `json:"activityStatus"`[\s\S]*ContainerStatus string `json:"containerStatus,omitempty"`[\s\S]*Source\s+string `json:"source,omitempty"`[\s\S]*UpdatedAt\s+string `json:"updatedAt,omitempty"`/,
  'runtime activity touch should expose a structured activity status payload',
);
assert.match(
  runtimeStatusService,
  /status\.PersistenceStatus = "persisted"[\s\S]*status\.PersistenceError = ""[\s\S]*markProjectRuntimeStatusPersistenceFailure\(status, err\)/,
  'runtime status writes should mark persisted success and failed persistence attempts',
);
assert.match(
  runtimeStatusService,
  /func markProjectRuntimeStatusPersistenceFailure\(status \*ProjectRuntimeStatus, err error\) \{[\s\S]*status\.PersistenceStatus = "failed"[\s\S]*status\.PersistenceError = err\.Error\(\)[\s\S]*log\.Printf\("Warning: failed to persist runtime status for project %s: %v", status\.ProjectID, err\)/,
  'runtime status persistence failures should be kept on the returned status and logged',
);
assert.match(
  apiClient,
  /ProjectRuntimeContainerStatus[\s\S]*ProjectRuntimeError[\s\S]*ProjectRuntimeLifecycleStatus[\s\S]*ProjectRuntimeMessage[\s\S]*ProjectRuntimePhase[\s\S]*ProjectRuntimeSpecHash[\s\S]*ProjectRuntimeStatusPersistenceStatus[\s\S]*export interface ProjectRuntimeStatus \{[\s\S]*status: ProjectRuntimeLifecycleStatus;[\s\S]*containerStatus\?: ProjectRuntimeContainerStatus;[\s\S]*phase\?: ProjectRuntimePhase;[\s\S]*message\?: ProjectRuntimeMessage;[\s\S]*error\?: ProjectRuntimeError;[\s\S]*specHash\?: ProjectRuntimeSpecHash;[\s\S]*containerStatusPersistence\?: ProjectContainerStatusPersistenceStatus;[\s\S]*containerStatusPersistenceError\?: string;[\s\S]*persistenceStatus\?: ProjectRuntimeStatusPersistenceStatus;[\s\S]*persistenceError\?: string;/,
  'frontend runtime status type should include named dynamic runtime snapshot fields, container status persistence and runtime status persistence metadata',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) TouchProjectRuntimeActivity\(ctx context\.Context, project \*model\.Project, source string\) ProjectRuntimeActivityStatus \{[\s\S]*ActivityStatus: "failed"[\s\S]*Source:\s+strings\.TrimSpace\(source\)[\s\S]*s\.containerMgr == nil[\s\S]*ActivityStatus = "unavailable"[\s\S]*InspectProject\(syncCtx, project\.ProjectID\)[\s\S]*ActivityStatus = "inspect_failed"[\s\S]*ActivityStatus = "missing"[\s\S]*info\.Status != container\.ContainerStatusRunning[\s\S]*ActivityStatus = "inactive"[\s\S]*s\.containerMgr\.MarkProjectActive\(project\.ProjectID\)[\s\S]*ActivityStatus = "touched"/,
  'runtime activity touch should inspect the runtime container and refresh LastActiveAt only for running containers',
);
assert.match(
  runtimeHandler,
  /func \(h \*ProjectHandler\) GetRuntimeStatus[\s\S]*projectService\.TouchProjectRuntimeActivity\(c, project, "runtime_status"\)[\s\S]*projectService\.GetProjectRuntimeStatusForProject\(c, project\)/,
  'runtime status reads from the user workspace should refresh runtime activity before returning the snapshot',
);
assert.match(
  runtimeHandler,
  /func \(h \*ProjectHandler\) TouchRuntimeActivity\(c context\.Context, ctx \*app\.RequestContext\)[\s\S]*projectService\.TouchProjectRuntimeActivity\(c, project, "runtime_activity_api"\)[\s\S]*status\.ActivityStatus == "failed" \|\| status\.ActivityStatus == "inspect_failed"[\s\S]*"data":\s+status/,
  'runtime activity endpoint should expose structured touch results and reserve 503 for failed inspect/service states',
);
assert.match(
  backendRoutes,
  /project\.GET\("\/:id\/runtime-status", projectHandler\.GetRuntimeStatus\)[\s\S]*project\.POST\("\/:id\/runtime-activity", projectHandler\.TouchRuntimeActivity\)/,
  'backend routes should expose the authenticated runtime activity heartbeat endpoint next to runtime status',
);
assert.match(
  previewGateway,
  /project\.UserID != userID[\s\S]*g\.projectService\.TouchProjectRuntimeActivity\(ctx, project, "preview_gateway"\)[\s\S]*g\.projectService\.ResolveProjectPreviewTarget\(ctx, projectID\)/,
  'preview gateway requests should refresh runtime activity before resolving the preview target',
);
assert.match(
  apiClient,
  /export type ProjectRuntimeActivityStatusValue =[\s\S]*\| 'touched'[\s\S]*\| 'not_required'[\s\S]*\| 'unavailable'[\s\S]*\| 'inspect_failed'[\s\S]*\| 'missing'[\s\S]*\| 'inactive'[\s\S]*\| 'failed';[\s\S]*export type ProjectRuntimeActivitySource = string;[\s\S]*export type ProjectRuntimeActivityMessage = string;[\s\S]*export type ProjectRuntimeActivityError = string;[\s\S]*export interface ProjectRuntimeActivityStatus \{[\s\S]*activityStatus: ProjectRuntimeActivityStatusValue;[\s\S]*containerStatus\?: ProjectRuntimeContainerStatus;[\s\S]*source\?: ProjectRuntimeActivitySource;[\s\S]*message\?: ProjectRuntimeActivityMessage;[\s\S]*error\?: ProjectRuntimeActivityError;[\s\S]*touchRuntimeActivity: async \(id: string\): Promise<ProjectRuntimeActivityStatus> => \{[\s\S]*`\/project\/\$\{id\}\/runtime-activity`[\s\S]*method: 'POST'/,
  'frontend API client should model and call the runtime activity heartbeat endpoint through named activity status, source, message and error contracts',
);
assert.doesNotMatch(
  apiClient,
  /activityStatus: 'touched' \| 'not_required' \| 'unavailable' \| 'inspect_failed' \| 'missing' \| 'inactive' \| 'failed';|export interface ProjectRuntimeActivityStatus \{[\s\S]*containerStatus\?: string;[\s\S]*source\?: string;[\s\S]*message\?: string;[\s\S]*error\?: string;/,
  'runtime activity API response should not duplicate the activity status inline union or expose heartbeat dynamic fields as raw strings',
);
assert.match(
  runtimeActivityProxyRoute,
  /backendPath: `\/api\/project\/\$\{id\}\/runtime-activity`[\s\S]*buildBackendProxyErrorBody\('project runtime activity', error\)[\s\S]*Runtime activity service unavailable/,
  'Next runtime activity route should proxy heartbeat failures with a stable project runtime activity scope',
);
assert.match(
  desktopPreviewPanel,
  /function shouldStartDesktopPreviewRuntimeHeartbeat\([\s\S]*activeProjectId: string \| null,[\s\S]*normalizedBrowserUrl: string,[\s\S]*\): activeProjectId is string[\s\S]*const shouldRenderIframe = shouldRenderDesktopPreviewIframe\(normalizedBrowserUrl\);/,
  'desktop preview should derive heartbeat readiness through a named heartbeat reader',
);
assert.match(
  desktopPreviewPanel,
  /const activeProjectId = getDesktopPreviewProjectId\(projectId\);[\s\S]*const shouldStartHeartbeat = shouldStartDesktopPreviewRuntimeHeartbeat\(activeProjectId, normalizedBrowserUrl\);[\s\S]*if \(shouldStartHeartbeat === false\) \{[\s\S]*return undefined;[\s\S]*\}/,
  'desktop preview heartbeat effect should consume the named heartbeat reader before touching runtime activity',
);
assert.match(
  desktopPreviewPanel,
  /projectApi\.touchRuntimeActivity\(activeProjectId\)[\s\S]*window\.setInterval\(touchRuntimeActivity, 60_000\)[\s\S]*window\.clearInterval\(heartbeat\)[\s\S]*\}, \[normalizedBrowserUrl, projectId\]\);/,
  'desktop preview should send a lightweight runtime activity heartbeat through a named heartbeat reader while a project preview is open',
);
assert.match(
  mobilePreviewPanel,
  /function shouldStartMobilePreviewRuntimeHeartbeat\([\s\S]*activeProjectId: string \| null,[\s\S]*normalizedMobileBrowserUrl: string,[\s\S]*\): activeProjectId is string[\s\S]*const shouldRenderIframe = shouldRenderMobilePreviewIframe\(normalizedMobileBrowserUrl\);[\s\S]*const activeProjectId = getMobilePreviewProjectId\(projectId\);[\s\S]*const shouldStartHeartbeat = shouldStartMobilePreviewRuntimeHeartbeat\(activeProjectId, normalizedMobileBrowserUrl\);[\s\S]*if \(shouldStartHeartbeat === false\)[\s\S]*projectApi\.touchRuntimeActivity\(activeProjectId\)[\s\S]*window\.setInterval\(touchRuntimeActivity, 60_000\)[\s\S]*window\.clearInterval\(heartbeat\)[\s\S]*\}, \[normalizedMobileBrowserUrl, projectId\]\)/,
  'mobile preview should send a lightweight runtime activity heartbeat through a named heartbeat reader while a project preview is open',
);
assert.match(
  idePanels,
  /<DesktopPreviewPanel[\s\S]*projectId=\{projectId\}[\s\S]*<MobilePreviewPanel[\s\S]*projectId=\{projectId\}/,
  'workspace IDE panels should pass projectId into desktop and mobile preview heartbeat surfaces',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) persistRuntimeStartFailure\(ctx context\.Context, projectID string, status ProjectRuntimeStatus\) ProjectRuntimeStatus \{[\s\S]*status\.ContainerStatusPersistence = "updated"[\s\S]*UpdateContainerStatus\(safeContext\(ctx\), projectID, "failed"\)[\s\S]*status\.ContainerStatusPersistence = "failed"[\s\S]*status\.ContainerStatusPersistenceError = err\.Error\(\)/,
  'runtime start failures should persist failed container status and expose DB sync failures',
);
assert.match(
  runtimeFacadeService,
  /if s\.containerMgr == nil \{[\s\S]*failed := s\.persistRuntimeUnavailable\(ctx, project, "开发容器管理器不可用", err\)[\s\S]*return s\.AttachPreviewStatus\(project, &failed\), nil/,
  'runtime start should return failed unavailable snapshots instead of hiding container manager failures behind generic request errors',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) persistRuntimeUnavailable\(ctx context\.Context, project \*model\.Project, message string, cause error\) ProjectRuntimeStatus \{[\s\S]*Status:\s+"failed"[\s\S]*ContainerStatus:\s+"unavailable"[\s\S]*ContainerStatusPersistence: "updated"[\s\S]*UpdateContainerStatus\(safeContext\(ctx\), project\.ProjectID, "unavailable"\)[\s\S]*ContainerStatusPersistenceError = err\.Error\(\)[\s\S]*return setProjectRuntimeStatus\(project\.DirectoryPath, status\)/,
  'runtime unavailable helper should persist DB unavailable status and failed runtime snapshots with persistence metadata',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) StartProjectContainer\(ctx context\.Context, projectID string\) error \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "同步启动无法连接容器管理器", containerErr\)[\s\S]*return containerErr/,
  'synchronous container start should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) ensureProjectContainerRunning\(ctx context\.Context, project \*model\.Project\) \(\*container\.ContainerInfo, error\) \{[\s\S]*if project == nil \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "容器运行状态确认无法连接容器管理器", containerErr\)[\s\S]*return nil, containerErr/,
  'container running checks should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) ExecuteInContainer\(ctx context\.Context, projectID, command string\) \(\*container\.ExecResult, error\) \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "开发容器管理器不可用", containerErr\)[\s\S]*return nil, containerErr/,
  'container exec should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  fs.readFileSync('backend/internal/service/project_terminal_service.go', 'utf8'),
  /func \(s \*ProjectService\) CreateTerminalSession\(ctx context\.Context, projectID string, rows, cols int\) \(\*TerminalSessionInfo, error\) \{[\s\S]*project, err := s\.projectRepo\.FindByProjectID\(ctx, projectID\)[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "开发终端无法连接容器管理器", containerErr\)[\s\S]*return nil, containerErr/,
  'terminal session creation should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  projectFileService,
  /func \(s \*ProjectService\) GetProjectFileTree\(ctx context\.Context, projectID string\) \(\*file\.FileNode, error\) \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "文件树无法连接容器管理器", containerErr\)[\s\S]*return nil, containerErr/,
  'file tree reads should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  projectFileService,
  /func \(s \*ProjectService\) ReadProjectFile\(ctx context\.Context, projectID, filePath string\) \(string, error\) \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "文件读取无法连接容器管理器", containerErr\)[\s\S]*return "", containerErr/,
  'file content reads should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  projectFileService,
  /func \(s \*ProjectService\) WriteProjectFile\(ctx context\.Context, projectID, filePath, content string\) \(\*ProjectFileWriteResult, error\) \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "文件保存无法连接容器管理器", containerErr\)[\s\S]*return nil, containerErr/,
  'file writes should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  projectGitService,
  /func \(s \*ProjectService\) GetProjectGitCommits\(ctx context\.Context, projectID string\) \(\[\]GitCommitRecord, error\) \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := fmt\.Errorf\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "Git 提交列表无法连接容器管理器", containerErr\)[\s\S]*return nil, containerErr/,
  'Git commit list refresh should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  projectGitService,
  /func \(s \*ProjectService\) RestoreProjectGitCommit\(ctx context\.Context, projectID, commitHash string\) error \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := fmt\.Errorf\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "Git 恢复无法连接容器管理器", containerErr\)[\s\S]*return containerErr/,
  'Git restore should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  projectPreviewService,
  /func \(s \*ProjectService\) resolveProjectPreviewTargetFromProject\(ctx context\.Context, project \*model\.Project\) \(\*ProjectPreviewTarget, error\) \{[\s\S]*if s\.containerMgr == nil \{[\s\S]*containerErr := fmt\.Errorf\("container manager not available"\)[\s\S]*s\.persistRuntimeUnavailable\(ctx, project, "Preview 无法连接容器管理器", containerErr\)[\s\S]*return nil, containerErr/,
  'Preview target resolution should persist unavailable runtime snapshots when the container manager is missing',
);
assert.match(
  runtimeFacadeService,
  /type ProjectContainerStopResult struct \{[\s\S]*ContainerStatusPersistence\s+string\s+`json:"container_status_persistence"`[\s\S]*ContainerStatusPersistenceError\s+string\s+`json:"container_status_persistence_error,omitempty"`[\s\S]*RuntimeStatus\s+\*ProjectRuntimeStatus\s+`json:"runtime_status,omitempty"`/,
  'container stop should expose database and runtime status persistence state',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) StopProjectContainer\(ctx context\.Context, projectID string\) \(\*ProjectContainerStopResult, error\)[\s\S]*StopStatus:\s+"stopped"[\s\S]*status := s\.persistStoppedRuntimeStatus\(ctx, projectID, "开发容器已停止"\)[\s\S]*result\.ContainerStatusPersistence = status\.ContainerStatusPersistence[\s\S]*result\.RuntimeStatus = status/,
  'container stop should keep stop success separate from container status and runtime snapshot persistence',
);
assert.match(
  runtimeFacadeService,
  /if s\.containerMgr == nil \{[\s\S]*containerErr := errors\.New\("container manager not available"\)[\s\S]*result\.StopStatus = "failed"[\s\S]*result\.ContainerStatus = "unavailable"[\s\S]*FindByProjectID\(safeContext\(ctx\), projectID\)[\s\S]*status := s\.persistRuntimeUnavailable\(ctx, project, "停止运行时无法连接容器管理器", containerErr\)[\s\S]*result\.ContainerStatusPersistence = status\.ContainerStatusPersistence[\s\S]*result\.RuntimeStatus = &status[\s\S]*UpdateContainerStatus\(safeContext\(ctx\), projectID, "unavailable"\)[\s\S]*result\.ContainerStatusPersistence = "failed"[\s\S]*result\.ContainerStatusPersistenceError = err\.Error\(\)[\s\S]*return result, containerErr/,
  'container stop should return structured unavailable results, persist runtime snapshots, and expose DB sync failures when the container manager is missing',
);
assert.match(
  runtimeFacadeService,
  /StartContainerIdleReaper[\s\S]*status := s\.persistStoppedRuntimeStatus\(ctx, projectID, "开发容器因空闲超时已自动停止"\)[\s\S]*idle stopped runtime status persistence failed/,
  'idle reaper should persist stopped runtime status snapshots after successful idle stop',
);
assert.match(
  runtimeFacadeService,
  /func \(s \*ProjectService\) persistStoppedRuntimeStatus\(ctx context\.Context, projectID, message string\) \*ProjectRuntimeStatus \{[\s\S]*Status:\s+"stopped"[\s\S]*ContainerStatusPersistence: "updated"[\s\S]*UpdateContainerStatus\(safeContext\(ctx\), projectID, "stopped"\)[\s\S]*writeProjectRuntimeStatus\(project\.DirectoryPath, status\)/,
  'stopped container status helper should persist DB state and runtime-status snapshots',
);
assert.match(
  runtimeHandler,
  /result, err := projectService\.StopProjectContainer\(c, projectID\)[\s\S]*"success": true,[\s\S]*"message": "Container stopped",[\s\S]*"data":\s+result/,
  'container stop handler should return structured stop result data',
);
assert.match(
  runtimeHandler,
  /result, err := projectService\.StopProjectContainer\(c, projectID\)[\s\S]*if err != nil \{[\s\S]*"details": err\.Error\(\),[\s\S]*"data":\s+result/,
  'container stop handler should preserve structured stop result data on error responses',
);
assert.match(
  runtimeHandler,
  /httpStatus := consts\.StatusAccepted[\s\S]*status\.Status == "ready" \|\| status\.Status == "failed"[\s\S]*"success": true,[\s\S]*"data":\s+status/,
  'runtime start handler should return failed runtime snapshots in a successful envelope',
);
assert.match(
  apiClient,
  /export type ApiErrorDetails = string;[\s\S]*export type ApiErrorSource = string;[\s\S]*export type ApiErrorReasonCode = string;[\s\S]*export type ApiErrorMetadata = \{[\s\S]*details\?: ApiErrorDetails;[\s\S]*source\?: ApiErrorSource;[\s\S]*reasonCode\?: ApiErrorReasonCode;[\s\S]*export type ApiResponseRawObject = \{[\s\S]*\[fieldName: string\]: unknown;[\s\S]*\};[\s\S]*export class ApiError extends Error \{[\s\S]*data\?: unknown;[\s\S]*details\?: ApiErrorDetails;[\s\S]*source\?: ApiErrorSource;[\s\S]*reasonCode\?: ApiErrorReasonCode;[\s\S]*metadata: ApiErrorMetadata = \{\}[\s\S]*this\.data = data;[\s\S]*this\.details = metadata\.details;[\s\S]*this\.source = metadata\.source;[\s\S]*this\.reasonCode = metadata\.reasonCode;[\s\S]*function extractStructuredErrorMetadata\(result: ApiResponseRawObject\): ApiErrorMetadata[\s\S]*satisfies ApiErrorMetadata[\s\S]*throw new ApiError\([\s\S]*formatStructuredApiErrorMessage\(errorMessage, metadata\),[\s\S]*errorCode,[\s\S]*result\.data,[\s\S]*metadata/,
  'frontend API errors should preserve structured response data and consume named source/details/reasonCode contracts for runtime recovery diagnostics',
);
assert.doesNotMatch(
  apiClient,
  /metadata: \{ details\?: string; source\?: string; reasonCode\?: string \} = \{\}|details\?: string;[\s\S]*source\?: string;[\s\S]*reasonCode\?: string;|function extractStructuredErrorMetadata\(result: Record<string, unknown>\)|let result: Record<string, unknown> = \{\}|JSON\.parse\(rawText\) as Record<string, unknown>/,
  'frontend API errors should not regress runtime recovery diagnostics to anonymous string metadata or anonymous response raw objects',
);
assert.match(
  apiClient,
  /ProjectContainerStatusPersistenceStatus[\s\S]*ProjectContainerStopContainerStatus[\s\S]*ProjectContainerStopStatus[\s\S]*ProjectRuntimeContainerStatus[\s\S]*ProjectRuntimeLifecycleStatus[\s\S]*interface ProjectPayload \{[\s\S]*container_status\?: ProjectRuntimeContainerStatus;[\s\S]*export interface Project \{[\s\S]*container_status\?: ProjectRuntimeContainerStatus;[\s\S]*export interface ProjectRuntimeStatus \{[\s\S]*status: ProjectRuntimeLifecycleStatus;[\s\S]*containerStatus\?: ProjectRuntimeContainerStatus;[\s\S]*containerStatusPersistence\?: ProjectContainerStatusPersistenceStatus;[\s\S]*export interface ProjectContainerStopResponse \{[\s\S]*stop_status: ProjectContainerStopStatus;[\s\S]*container_status: ProjectContainerStopContainerStatus;[\s\S]*container_status_persistence: ProjectContainerStatusPersistenceStatus;[\s\S]*runtime_status\?: ProjectRuntimeStatus;[\s\S]*stopContainer: async \(id: string\): Promise<ProjectContainerStopResponse>/,
  'frontend API client should consume shared runtime lifecycle, project container status projection, dynamic runtime snapshot and container stop persistence status contracts',
);
assert.doesNotMatch(
  apiClient,
  /interface ProjectPayload \{[\s\S]*container_status\?: string;|export interface Project \{[\s\S]*container_status\?: string;|export interface ProjectRuntimeStatus \{[\s\S]*containerStatus\?: string;[\s\S]*phase\?: string;[\s\S]*message\?: string;[\s\S]*error\?: string;[\s\S]*specHash\?: string;|stop_status: 'stopped' \| 'failed';|container_status: 'stopped' \| 'unavailable';|container_status_persistence: 'updated' \| 'failed';|containerStatusPersistence\?: 'updated' \| 'failed';|persistenceStatus\?: 'persisted' \| 'failed';/,
  'frontend API client should not regress project container status projections or dynamic runtime snapshot fields to raw strings, or container stop/runtime persistence status fields to inline unions',
);
assert.match(
  projectListRuntimeStopErrors,
  /export function formatProjectRuntimeStopNotice\([\s\S]*stop_status=\$\{result\.stop_status\}[\s\S]*container_status=\$\{result\.container_status\}/,
  'project list runtime stop notice should explain stop status and container status',
);
assert.match(
  projectListRuntimeStopErrors,
  /container_status_persistence_error[\s\S]*runtime-status 停止快照写入失败/,
  'project list runtime stop notice should explain stop status, container status, DB persistence, and runtime snapshot persistence',
);
assert.match(
  projectListRuntimeStopErrors,
  /(?=[\s\S]*import type \{ Project, ProjectContainerStopResponse, ProjectRuntimeStatus \} from '@\/lib\/api';)(?=[\s\S]*export type ProjectRuntimeStopFailureRawObject = \{[\s\S]*\[fieldName: string\]: unknown;[\s\S]*\};)(?=[\s\S]*export type ProjectRuntimeStopSummarySegment = string;)(?=[\s\S]*export type ProjectRuntimeStopSummarySegmentList = ProjectRuntimeStopSummarySegment\[\];)(?=[\s\S]*type ProjectRuntimeStopFailureData = \{[\s\S]*stopStatus\?: ProjectContainerStopStatus;[\s\S]*containerStatus\?: ProjectContainerStopContainerStatus;[\s\S]*containerStatusPersistence\?: ProjectContainerStatusPersistenceStatus;[\s\S]*runtimeStatus\?: ProjectRuntimeStatus;)(?=[\s\S]*function readProjectRuntimeStopFailureRawObject\(value: unknown\): ProjectRuntimeStopFailureRawObject \| null[\s\S]*const hasObject = value !== null && typeof value === 'object' && Array\.isArray\(value\) === false;[\s\S]*\? value as ProjectRuntimeStopFailureRawObject)(?=[\s\S]*function readOptionalString\(record: ProjectRuntimeStopFailureRawObject \| null, key: string\): string \| undefined)(?=[\s\S]*function readOptionalNumber\(record: ProjectRuntimeStopFailureRawObject \| null, key: string\): number \| undefined[\s\S]*const hasNumber = typeof value === 'number';[\s\S]*const hasFiniteNumber = Number\.isFinite\(value\);)(?=[\s\S]*function hasProjectRuntimeStopTextValue\(value: string \| undefined\): value is string[\s\S]*if \(value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;)(?=[\s\S]*function hasProjectRuntimeStopSummarySegment\(segment: ProjectRuntimeStopSummarySegment\): boolean)(?=[\s\S]*function getProjectRuntimeStopSummarySegments\([\s\S]*segments: ProjectRuntimeStopSummarySegmentList,[\s\S]*\): ProjectRuntimeStopSummarySegmentList \{[\s\S]*const summarySegments: ProjectRuntimeStopSummarySegmentList = \[\];[\s\S]*for \(const segment of segments\) \{[\s\S]*const hasSegment = hasProjectRuntimeStopSummarySegment\(segment\);[\s\S]*if \(hasSegment === true\) \{[\s\S]*summarySegments\.push\(segment\);)(?=[\s\S]*function getProjectRuntimeStopSummarySegment\([\s\S]*\): ProjectRuntimeStopSummarySegment \{[\s\S]*const hasValue = hasProjectRuntimeStopTextValue\(value\);)(?=[\s\S]*function getProjectRuntimeStopFallbackMessage\(value: string \| undefined, fallback: string\): string \{[\s\S]*const hasValue = hasProjectRuntimeStopTextValue\(value\);)(?=[\s\S]*function getProjectRuntimeStopNoticeProjectName\(project: Project, result: ProjectContainerStopResponse\): string)(?=[\s\S]*function readProjectRuntimeStopErrorData\(error: unknown\): unknown[\s\S]*const record = readProjectRuntimeStopFailureRawObject\(error\);[\s\S]*return record\.data;)(?=[\s\S]*function readProjectRuntimeStopStatusPersistence\([\s\S]*runtimeStatus: ProjectRuntimeStatus \| undefined,[\s\S]*\): ProjectRuntimeStatusPersistenceStatus \| undefined[\s\S]*return runtimeStatus\.persistenceStatus;)(?=[\s\S]*function readProjectRuntimeStopStatusPersistenceError\(runtimeStatus: ProjectRuntimeStatus \| undefined\): string \| undefined[\s\S]*return runtimeStatus\.persistenceError;)(?=[\s\S]*function readProjectRuntimeStopFailureRuntimeStatus\([\s\S]*errorData: ProjectRuntimeStopFailureData \| null,[\s\S]*\): ProjectRuntimeStatus \| undefined[\s\S]*return errorData\.runtimeStatus;)(?=[\s\S]*function readProjectRuntimeStopFailureStopStatus\([\s\S]*\): ProjectContainerStopStatus \| undefined[\s\S]*return errorData\.stopStatus;)(?=[\s\S]*function readProjectRuntimeStopFailureContainerStatus\([\s\S]*\): ProjectContainerStopContainerStatus \| undefined[\s\S]*return errorData\.containerStatus;)(?=[\s\S]*function readProjectRuntimeStopFailureContainerPersistence\([\s\S]*\): ProjectContainerStatusPersistenceStatus \| undefined[\s\S]*return errorData\.containerStatusPersistence;)(?=[\s\S]*function readProjectRuntimeStopFailureContainerPersistenceError\([\s\S]*\): string \| undefined[\s\S]*return errorData\.containerStatusPersistenceError;)(?=[\s\S]*function readProjectRuntimeStatus\(value: unknown\): ProjectRuntimeStatus \| undefined[\s\S]*const record = readProjectRuntimeStopFailureRawObject\(value\);[\s\S]*internalPort: readOptionalNumber\(record, 'internalPort'\),)(?=[\s\S]*function readProjectRuntimeStopFailureData\(value: unknown\): ProjectRuntimeStopFailureData \| null[\s\S]*const record = readProjectRuntimeStopFailureRawObject\(value\);)(?=[\s\S]*function formatStopRuntimeStatusSummary\(runtimeStatus\?: ProjectRuntimeStatus\)[\s\S]*const summarySegmentCandidates: ProjectRuntimeStopSummarySegmentList = \[[\s\S]*getProjectRuntimeStopSummarySegment\(\{ key: 'runtime_status', value: runtimeStatus\.status \}\)[\s\S]*getProjectRuntimeStopSummarySegment\(\{ key: 'runtime_container_status', value: runtimeStatus\.containerStatus \}\)[\s\S]*getProjectRuntimeStopSummarySegment\(\{ key: 'runtime_phase', value: runtimeStatus\.phase \}\)[\s\S]*getProjectRuntimeStopSummarySegment\(\{ key: 'runtime_persistence', value: runtimeStatus\.persistenceStatus \}\)[\s\S]*getProjectRuntimeStopSummarySegment\(\{ key: 'runtime_container_status_persistence_error', value: runtimeStatus\.containerStatusPersistenceError \}\)[\s\S]*const summarySegmentList = getProjectRuntimeStopSummarySegments\(summarySegmentCandidates\);[\s\S]*const summarySegments = summarySegmentList\.join\('；'\);)(?=[\s\S]*export function formatProjectRuntimeStopNotice[\s\S]*getProjectRuntimeStopNoticeProjectName\(project, result\)[\s\S]*const runtimeStatusPersistence = readProjectRuntimeStopStatusPersistence\(runtimeStatus\);[\s\S]*readProjectRuntimeStopStatusPersistenceError\(runtimeStatus\)[\s\S]*'后端未返回快照写入失败原因')(?=[\s\S]*export function formatProjectRuntimeStopFailure\([\s\S]*fallback: ProjectListOperationErrorDetails,[\s\S]*formatProjectListOperationError\(error, fallback\)[\s\S]*const rawErrorData = readProjectRuntimeStopErrorData\(error\);[\s\S]*readProjectRuntimeStopFailureData\(rawErrorData\)[\s\S]*formatStopRuntimeStatusSummary\(readProjectRuntimeStopFailureRuntimeStatus\(errorData\)\)[\s\S]*const stopDataSummaryCandidates: ProjectRuntimeStopSummarySegmentList = \[[\s\S]*getProjectRuntimeStopSummarySegment\(\{ key: 'stop_status', value: readProjectRuntimeStopFailureStopStatus\(errorData\) \}\)[\s\S]*getProjectRuntimeStopSummarySegment\(\{ key: 'container_status_persistence_error', value: readProjectRuntimeStopFailureContainerPersistenceError\(errorData\) \}\)[\s\S]*runtimeStatusSummary,[\s\S]*\];[\s\S]*const stopDataSummary = getProjectRuntimeStopSummarySegments\(stopDataSummaryCandidates\)\.join\('；'\);)/,
  'project list runtime stop failure should preserve structured API errors, stop result data, and runtime status snapshots',
);
assert.doesNotMatch(
  projectListRuntimeStopErrors,
  /type ProjectRuntimeStopFailureRawObject = Record<string, unknown>|function readObject\(value: unknown\): ProjectRuntimeStopFailureRawObject \| null|as Record<string, unknown>|as \{ data\?: unknown \}|function formatStopRuntimeStatusSummary\(runtimeStatus: Record<string, unknown> \| null\)|formatStopRuntimeStatusSummary\(readRecord\(errorData\?\.runtime_status\)\)|readString\(errorData, 'stop_status'\)|readRecord\(errorData\?\.runtime_status\)|value !== undefined && value\.length > 0|\.filter\(Boolean\)|\]\s*\.filter\(\(segment\) => hasProjectRuntimeStopSummarySegment\(segment\)\)|runtimeStatus\?\.persistenceStatus|runtimeStatus\?\.persistenceError|typeof record\.internalPort === 'number'|hasRuntimeStatus === true \? runtimeStatus\.persistenceStatus : undefined|hasRuntimeStatus === true \? runtimeStatus\.persistenceError : undefined|hasErrorData === true \? errorData\.|project\.name \|\| result\.project_id|container_status_persistence_error \|\| '后端未返回同步失败原因'|persistenceError \|\| '后端未返回快照写入失败原因'/,
  'project list runtime stop failure should not regress runtime stop failure data or runtime_status snapshots to anonymous Record reads',
);
assert.match(
  projectsPage,
  /canStopProjectRuntime[\s\S]*canStopProjectListContainerStatus\(project\.container_status\)[\s\S]*kind: 'runtime_stop'[\s\S]*confirmLabel: '确认停止运行时'[\s\S]*const confirmStopProjectRuntime = async \(project: Project\) => \{[\s\S]*projectApi\.stopContainer\(projectId\)[\s\S]*container_status: result\.container_status[\s\S]*formatProjectRuntimeStopNotice\(project, result\)[\s\S]*formatProjectRuntimeStopFailure\(error, '请稍后重试'\)[\s\S]*confirmation\.kind === 'runtime_stop'[\s\S]*confirmStopProjectRuntime\(confirmation\.project\)[\s\S]*onClick=\{\(event\) => requestStopProjectRuntime\(project, event\)\}/,
  'project list should open a structured confirmation before runtime stop and render structured stop persistence results after confirmation',
);
assert.doesNotMatch(
  projectsPage,
  /onClick=\{\(event\) => stopProjectRuntime\(project, event\)\}|project\.container_status === 'running'|project\.container_status === 'starting'|project\.container_status === 'creating'/,
  'project list runtime stop button must not directly call the stop runtime side effect',
);
assert.match(
  runtimeFacadeService,
  /if err != nil \{[\s\S]*"Warning: failed to read runtime status for project %s: %v"[\s\S]*Status:\s+"failed",[\s\S]*Phase:\s+"status_snapshot",[\s\S]*Message:\s+"运行时状态快照读取失败",[\s\S]*Error:\s+err\.Error\(\)/,
  'runtime status read errors should surface as failed status_snapshot payloads',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectServiceGetRuntimeStatusSurfacesCorruptSnapshot[\s\S]*\[\]byte\(`\{"status":`\)[\s\S]*status\.Status != "failed" \|\| status\.Phase != "status_snapshot"[\s\S]*filepath\.Glob\(statusPath \+ "\.corrupt-\*"\)/,
  'Go tests should cover corrupt runtime status snapshot archiving and failed payload exposure',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectRuntimeStatusPersistenceFailureIsExposed[\s\S]*setProjectRuntimeStatus\(filepath\.Join\(t\.TempDir\(\), "outside-root"\)[\s\S]*status\.PersistenceStatus != "failed"[\s\S]*status\.PersistenceError == ""/,
  'Go tests should cover runtime status persistence failure metadata',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectRuntimeStatusPersistenceSuccessIsExposed[\s\S]*status\.PersistenceStatus != "persisted"[\s\S]*readProjectRuntimeStatus\(projectDir\)[\s\S]*stored\.PersistenceStatus != "persisted"/,
  'Go tests should cover runtime status persistence success metadata',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectRuntimeStartFailurePersistsFailedContainerStatus[\s\S]*persistRuntimeStartFailure\(context\.Background\(\), "proj_start_failed"[\s\S]*repo\.updatedContainerStatus != "failed"[\s\S]*status\.ContainerStatusPersistence != "updated"/,
  'Go tests should cover runtime start failure container status persistence success',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectRuntimeStartFailureExposesContainerStatusPersistenceFailure[\s\S]*updateContainerStatusErr: errors\.New\("database unavailable"\)[\s\S]*status\.ContainerStatusPersistence != "failed"[\s\S]*status\.ContainerStatusPersistenceError != "database unavailable"/,
  'Go tests should cover runtime start failure container status persistence errors',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectRuntimeUnavailablePersistsFailedSnapshot[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*status\.ContainerStatusPersistence != "updated"[\s\S]*stored\.Status != "failed" \|\| stored\.ContainerStatus != "unavailable"/,
  'Go tests should cover runtime unavailable failed snapshot persistence',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectRuntimeUnavailableExposesContainerStatusPersistenceFailure[\s\S]*updateContainerStatusErr: errors\.New\("database unavailable"\)[\s\S]*status\.ContainerStatusPersistence != "failed"[\s\S]*status\.ContainerStatusPersistenceError != "database unavailable"/,
  'Go tests should cover runtime unavailable container status persistence failures',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectStartContainerManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.StartProjectContainer\(context\.Background\(\), "proj_start_unavailable"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "同步启动无法连接容器管理器"/,
  'Go tests should cover synchronous start manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectEnsureContainerRunningManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.ensureProjectContainerRunning\(context\.Background\(\), &repo\.projects\[0\]\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "容器运行状态确认无法连接容器管理器"/,
  'Go tests should cover container running manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectExecuteInContainerManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.ExecuteInContainer\(context\.Background\(\), "proj_exec_unavailable", "npm test"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Status != "failed" \|\| stored\.ContainerStatus != "unavailable"/,
  'Go tests should cover exec manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectTerminalManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.CreateTerminalSession\(context\.Background\(\), "proj_terminal_unavailable"[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "开发终端无法连接容器管理器"/,
  'Go tests should cover terminal manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectFileTreeManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.GetProjectFileTree\(context\.Background\(\), "proj_file_tree_unavailable"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "文件树无法连接容器管理器"/,
  'Go tests should cover file tree manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectReadFileManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.ReadProjectFile\(context\.Background\(\), "proj_read_file_unavailable", "src\/App\.tsx"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "文件读取无法连接容器管理器"/,
  'Go tests should cover file read manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectWriteFileManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.WriteProjectFile\(context\.Background\(\), "proj_write_file_unavailable", "src\/App\.tsx"[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "文件保存无法连接容器管理器"/,
  'Go tests should cover file write manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectGitCommitsManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.GetProjectGitCommits\(context\.Background\(\), "proj_git_commits_unavailable"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "Git 提交列表无法连接容器管理器"/,
  'Go tests should cover Git commits manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectGitRestoreManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.RestoreProjectGitCommit\(context\.Background\(\), "proj_git_restore_unavailable", "abcdef1"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "Git 恢复无法连接容器管理器"/,
  'Go tests should cover Git restore manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectPreviewTargetManagerUnavailablePersistsRuntimeSnapshot[\s\S]*service\.ResolveProjectPreviewTarget\(context\.Background\(\), "proj_preview_unavailable"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*stored\.Message != "Preview 无法连接容器管理器"/,
  'Go tests should cover Preview target manager unavailable runtime snapshots',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectStoppedRuntimeStatusPersistsSnapshot[\s\S]*persistStoppedRuntimeStatus\(context\.Background\(\), "proj_idle_stopped", "开发容器因空闲超时已自动停止"\)[\s\S]*repo\.updatedContainerStatus != "stopped"[\s\S]*stored\.Status != "stopped"/,
  'Go tests should cover stopped runtime status snapshot persistence',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectStoppedRuntimeStatusExposesPersistenceFailures[\s\S]*updateContainerStatusErr: errors\.New\("database unavailable"\)[\s\S]*status\.ContainerStatusPersistence != "failed"[\s\S]*status\.PersistenceStatus != "failed"/,
  'Go tests should cover stopped runtime status persistence failures',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectRuntimeActivityManagerUnavailable[\s\S]*TouchProjectRuntimeActivity\(context\.Background\(\), project, "runtime_activity_api"\)[\s\S]*status\.ActivityStatus != "unavailable"[\s\S]*status\.ContainerStatus != "unavailable"[\s\S]*status\.Error != "container manager not available"/,
  'Go tests should cover structured runtime activity status when the container manager is missing',
);
assert.match(
  containerManagerTest,
  /func TestManagerMarkProjectActiveUpdatesLastActiveAt[\s\S]*LastActiveAt: previous[\s\S]*manager\.MarkProjectActive\("proj_active"\)[\s\S]*!updated\.After\(previous\)/,
  'container manager tests should cover runtime activity updates moving LastActiveAt forward',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectStopContainerManagerUnavailableReturnsStructuredResult[\s\S]*projectDir := filepath\.Join\(rootDir, "proj_stop_unavailable"\)[\s\S]*repo\.updatedContainerStatus != "unavailable"[\s\S]*result\.StopStatus != "failed" \|\| result\.ContainerStatus != "unavailable"[\s\S]*result\.ContainerStatusPersistence != "updated"[\s\S]*result\.RuntimeStatus == nil[\s\S]*readProjectRuntimeStatus\(projectDir\)[\s\S]*stored\.Status != "failed"[\s\S]*stored\.ContainerStatus != "unavailable"/,
  'Go tests should cover structured stop results and runtime snapshots when the container manager is missing',
);
assert.match(
  projectServiceAdminTest,
  /func TestProjectStopContainerManagerUnavailableExposesPersistenceFailure[\s\S]*updateContainerStatusErr: errors\.New\("database unavailable"\)[\s\S]*result\.ContainerStatusPersistence != "failed"[\s\S]*result\.ContainerStatusPersistenceError != "database unavailable"[\s\S]*result\.RuntimeStatus == nil[\s\S]*result\.RuntimeStatus\.ContainerStatusPersistence != "failed"[\s\S]*result\.RuntimeStatus\.PersistenceStatus != "persisted"[\s\S]*readProjectRuntimeStatus\(projectDir\)[\s\S]*stored\.ContainerStatusPersistence != "failed"/,
  'Go tests should cover stop unavailable container status persistence failures while preserving runtime snapshots',
);

const runtimeFailedEngineeringState: WorkspaceEngineeringStateSnapshot = {
  workflow: {
    stage: 'runtime-readiness',
    mode: 'implement',
    status: 'failed',
  },
  phase: {
    current_phase: '运行时准备',
    current_task: '开发运行时准备失败',
    completed_tasks: [],
    blockers: ['apt mirror unavailable'],
    next_action: 'apt mirror unavailable',
    status: 'failed',
  },
  recovery: {
    blocked: true,
    reason_code: 'runtime_readiness_failed',
    reason_message: 'apt mirror unavailable',
    resume_stage: 'runtime_recovery',
    resume_mode: 'implement',
    can_retry: true,
    retry_label: '重新恢复运行时',
    retry_prompt: '请恢复项目 project-1 的开发运行时，优先检查容器状态、依赖安装和运行时日志后重试。',
  },
};
const runtimeRecoveryActionSummary = deriveWorkspaceRecoveryActionSummary({
  engineeringState: runtimeFailedEngineeringState,
});
assert.equal(runtimeRecoveryActionSummary.actionCount, 1);
assert.equal(runtimeRecoveryActionSummary.retryActionCount, 1);
assert.equal(runtimeRecoveryActionSummary.primaryActionCount, 0);
assert.deepEqual(runtimeRecoveryActionSummary.labels, ['重新恢复运行时']);
assert.equal(
  runtimeRecoveryActionSummary.summaryLabel,
  '恢复入口 1 个：重新恢复运行时',
  'runtime failed engineering state should be consumable by the shared recovery guidance model',
);

assert.equal(RUNTIME_HEALTH_PROJECT_QUERY_PARAM, 'runtime_project');
assert.equal(RUNTIME_HEALTH_REASON_QUERY_PARAM, 'runtime_reason');
const capabilityAuditPanel = fs.readFileSync('src/app/workspace/workspace-capability-audit-panel.tsx', 'utf8');
assert.match(
  capabilityAuditPanel,
  /deriveRuntimeHealthDiagnosticContext\(window\.location\.search\)/,
  'capability audit panel should read runtime diagnostic context from URL search params',
);
assert.match(
  capabilityAuditPanel,
  /clearRuntimeHealthDiagnosticContextSearch\(clearCapabilityAuditFilterSearch\(window\.location\.search\)\)/,
  'capability audit panel clear action should remove runtime diagnostic context with capability filters',
);
assert.match(
  capabilityAuditPanel,
  /function canClearCapabilityAuditPanelFilters\(\{[\s\S]*runtimeDiagnosticContext: RuntimeHealthDiagnosticContext \| null;[\s\S]*\}\): boolean \{[\s\S]*const hasRuntimeDiagnosticContext = hasCapabilityAuditPanelRuntimeDiagnosticContext\(runtimeDiagnosticContext\);[\s\S]*return hasActiveFilters === true \|\| hasRuntimeDiagnosticContext === true;[\s\S]*disabled=\{canClearFilters === false\}/,
  'capability audit panel clear action should expose runtime diagnostic context clearing through an explicit local gate',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelSyncedSearchLabel\(nextSearch: string\): string \{[\s\S]*return '无筛选参数';[\s\S]*return nextSearch;[\s\S]*const syncedSearchLabel = getCapabilityAuditPanelSyncedSearchLabel\(nextSearch\);/,
  'capability audit panel should derive URL sync empty-search label through a named reader',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelQueryStatusFilter\([\s\S]*statusFilter: CapabilityAuditStatusFilter,[\s\S]*\): CapabilityAuditStatusFilter \| undefined \{[\s\S]*return undefined;[\s\S]*return statusFilter;[\s\S]*function getCapabilityAuditPanelQueryProfileFilter\([\s\S]*profileFilter: CapabilityAuditProfileFilter,[\s\S]*\): CapabilityAuditProfileFilter \| undefined \{[\s\S]*return undefined;[\s\S]*return profileFilter;[\s\S]*status: getCapabilityAuditPanelQueryStatusFilter\(statusFilter\),[\s\S]*capabilityProfile: getCapabilityAuditPanelQueryProfileFilter\(profileFilter\),/,
  'capability audit panel should derive backend audit query filters through named readers',
);
assert.match(
  capabilityAuditPanel,
  /function canRefreshCapabilityAuditPanel\(\{[\s\S]*hasCapabilityAuditProjectId,[\s\S]*loadState,[\s\S]*\}: \{[\s\S]*hasCapabilityAuditProjectId: boolean;[\s\S]*loadState: LoadState;[\s\S]*\}\): boolean \{[\s\S]*const isLoading = isCapabilityAuditPanelLoading\(loadState\);[\s\S]*return hasCapabilityAuditProjectId === true && isLoading === false;[\s\S]*disabled=\{canRefreshCapabilityAudit === false\}/,
  'capability audit panel refresh action should derive loading state through a named local gate',
);
assert.match(
  capabilityAuditPanel,
  /Runtime 来源/,
  'capability audit panel should display runtime diagnostic source context',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelRuntimeSourceLabels\([\s\S]*runtimeDiagnosticContext: RuntimeHealthDiagnosticContext \| null,[\s\S]*\): CapabilityAuditRuntimeSourceLabelList \| undefined \{[\s\S]*const hasRuntimeDiagnosticContext = hasCapabilityAuditPanelRuntimeDiagnosticContext\(runtimeDiagnosticContext\);[\s\S]*if \(hasRuntimeDiagnosticContext === false\) \{[\s\S]*return undefined;[\s\S]*return runtimeDiagnosticContext\.activeLabels;[\s\S]*const runtimeSourceLabels = useMemo\(\(\) => \([\s\S]*getCapabilityAuditPanelRuntimeSourceLabels\(runtimeDiagnosticContext\)[\s\S]*runtimeSourceLabels,/,
  'capability audit panel should include runtime source context in the active filter summary model through an explicit reader',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /runtimeSourceLabels: runtimeDiagnosticContext\?\.activeLabels|activeFilterSummary\.activeFilterCount === 0 && !runtimeDiagnosticContext|nextSearch \|\| '无筛选参数'|statusFilter === 'all' \? undefined : statusFilter|profileFilter === 'all' \? undefined : profileFilter|hasCapabilityAuditProjectId === true && loadState !== 'loading'/,
  'capability audit panel should not regress runtime source context, clear gate, query filters, refresh gate or URL sync label to optional/truthy fallbacks',
);
assert.match(
  capabilityAuditPanel,
  /activeFilterSummary\.sourceSummary/,
  'capability audit panel should render runtime source summary with filter impact',
);
assert.match(
  capabilityAuditPanel,
  /不会改变 Capability Audit 查询条件/,
  'runtime diagnostic source context should be explicitly documented as non-filtering context',
);

console.log('[YES] Runtime health diagnostics model validation passed.');
