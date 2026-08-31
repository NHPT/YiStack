import { strict as assert } from 'node:assert';
import fs from 'node:fs';

import {
  buildInitialWorkspaceMessages,
  mergeRestoredWorkspaceMessages,
} from '../src/app/workspace/workspace-page-helpers';
import {
  deriveWorkspaceGuidanceActions,
  deriveWorkspaceRecoveryActionSummary,
} from '../src/app/workspace/workspace-guidance-actions';
import type { WorkspaceChatMessage } from '../src/app/workspace/workspace-types';

const baseTimestamp = '2026-07-14T10:00:00.000Z';

function createWorkflowMessage(overrides: Partial<WorkspaceChatMessage> = {}): WorkspaceChatMessage {
  return {
    id: 'workflow-message-1',
    role: 'assistant',
    kind: 'workflow',
    content: 'Foundation Gate blocked',
    timestamp: baseTimestamp,
    workflowSteps: [{
      id: 'foundation:foundation-before-plan',
      kind: 'foundation_gate',
      title: '检查 Plan 前 Foundation 门禁',
      detail: '缺少 .yistack/foundation/bootstrap_state.json',
      status: 'failed',
    }],
    ...overrides,
  };
}

const sessionMessage = createWorkflowMessage({
  engineeringState: {
    phase: {
      current_phase: 'Plan',
      current_task: '分析需求并生成候选方案',
      completed_tasks: [],
      blockers: [],
      next_action: '等待候选方案生成完成',
      status: 'running',
    },
  },
});

const restoredMessage = createWorkflowMessage({
  engineeringState: {
    phase: {
      current_phase: 'Plan',
      current_task: '处理 Project Foundation 门禁阻断',
      completed_tasks: [],
      blockers: ['缺少 .yistack/foundation/bootstrap_state.json，Project Foundation 尚未完成'],
      next_action: '完成 Project Foundation 必要决策后再生成 Plan',
      status: 'failed',
    },
    recovery: {
      blocked: true,
      reason_code: 'foundation_gate_blocked',
      reason_message: '缺少 .yistack/foundation/bootstrap_state.json，Project Foundation 尚未完成',
      resume_stage: 'bootstrap_review',
      resume_mode: 'foundation',
      can_retry: true,
      retry_label: '回到 Foundation 修复',
      retry_prompt: '请进入 Project Foundation review，补齐必要决策后重试。',
    },
  },
});

const mergedById = mergeRestoredWorkspaceMessages([restoredMessage], [sessionMessage]);
assert.equal(mergedById.length, 1);
assert.equal(
  mergedById[0].engineeringState?.phase?.status,
  'failed',
  'restored history message phase should override stale session phase for the same message id',
);
assert.equal(
  mergedById[0].engineeringState?.recovery?.reason_code,
  'foundation_gate_blocked',
  'restored history message recovery should survive session merge for the same message id',
);

const mergedByIdentity = mergeRestoredWorkspaceMessages(
  [{ ...restoredMessage, id: 'history-db-id' }],
  [{ ...sessionMessage, id: 'session-local-id' }],
);
assert.equal(mergedByIdentity.length, 1);
assert.equal(
  mergedByIdentity[0].id,
  'history-db-id',
  'restored history message identity should remain authoritative when content/timestamp match',
);
assert.equal(
  mergedByIdentity[0].engineeringState?.phase?.status,
  'failed',
  'message identity merge should not duplicate stale session state when ids differ',
);
assert.equal(
  mergedByIdentity[0].engineeringState?.recovery?.resume_mode,
  'foundation',
  'message identity merge should preserve restored recovery payload when ids differ',
);

const sessionOnlyMessage = createWorkflowMessage({
  id: 'session-only-workflow',
  content: '本地仍在展示的 workflow 消息',
  timestamp: '2026-07-14T10:01:00.000Z',
  engineeringState: {
    phase: {
      current_phase: '运行时准备',
      current_task: '等待容器与运行时服务就绪',
      completed_tasks: [],
      blockers: [],
      next_action: '等待后端返回 previewUrl 或检查端口映射。',
      status: 'running',
    },
  },
});
const mergedWithSupplemental = mergeRestoredWorkspaceMessages([restoredMessage], [sessionOnlyMessage]);
assert.equal(
  mergedWithSupplemental.length,
  2,
  'session-only workflow messages should still be preserved as supplemental restore context',
);
assert.equal(
  mergedWithSupplemental[1].engineeringState?.phase?.current_phase,
  '运行时准备',
  'supplemental session workflow state should keep its phase snapshot',
);

const initialMessages = buildInitialWorkspaceMessages({
  description: '',
  initialMessage: '',
  engineeringState: restoredMessage.engineeringState,
});
assert.equal(initialMessages.length, 1);
assert.equal(initialMessages[0].kind, 'workflow');
assert.match(
  initialMessages[0].content,
  /处理 Project Foundation 门禁阻断/,
  'project engineering_state restore message should describe the restored phase task',
);
assert.match(
  initialMessages[0].content,
  /缺少 \.yistack\/foundation\/bootstrap_state\.json/,
  'project engineering_state restore message should expose the recovery reason',
);
assert.equal(
  initialMessages[0].statusContent,
  'Plan: failed',
  'project engineering_state restore message should summarize phase status',
);
assert.match(
  initialMessages[0].workflowSteps?.[0]?.detail || '',
  /下一步：完成 Project Foundation 必要决策后再生成 Plan/,
  'project engineering_state restore step should preserve the phase next action',
);
assert.equal(
  initialMessages[0].suggestedActions?.[0]?.kind,
  'retry_workflow_gate',
  'project engineering_state restore message should explicitly carry a retry workflow action',
);
assert.equal(
  initialMessages[0].suggestedActions?.[0]?.prompt,
  restoredMessage.engineeringState?.recovery?.retry_prompt,
  'project engineering_state restore retry action should preserve the recovery retry prompt',
);
assert.equal(
  initialMessages[0].suggestedActions?.[0]?.mode,
  'foundation',
  'project engineering_state restore retry action should normalize the recovery resume mode',
);
assert.equal(
  deriveWorkspaceGuidanceActions(initialMessages[0])[0]?.kind,
  'retry_workflow_gate',
  'project engineering_state restore message should render through shared guidance action derivation',
);
assert.match(
  deriveWorkspaceRecoveryActionSummary(initialMessages[0]).summaryLabel,
  /恢复入口 1 个：回到 Foundation 修复/,
  'project engineering_state restore message should contribute to the shared recovery action summary',
);

const helperSource = fs.readFileSync('src/app/workspace/workspace-page-helpers.ts', 'utf8');
const projectBootstrapSource = fs.readFileSync('src/app/workspace/use-workspace-project-bootstrap.ts', 'utf8');
const workspaceProjectBootstrapContractSource = fs.readFileSync('src/app/workspace/workspace-project-bootstrap-contract.ts', 'utf8');
const flowStateSource = fs.readFileSync('src/app/workspace/use-workspace-flow-state.ts', 'utf8');
const workspaceFlowStateContractSource = fs.readFileSync('src/app/workspace/workspace-flow-state-contract.ts', 'utf8');
const workspaceFlowRefsContractSource = fs.readFileSync('src/app/workspace/workspace-flow-refs-contract.ts', 'utf8');
const workspaceFlowRefsHookSource = fs.readFileSync('src/app/workspace/use-workspace-flow-refs.ts', 'utf8');
const workspaceMessageStateSource = fs.readFileSync('src/app/workspace/workspace-message-state.ts', 'utf8');
const workspaceMessageDispatchContractSource = fs.readFileSync('src/app/workspace/workspace-message-dispatch-contract.ts', 'utf8');
const workspaceMessageDispatchHookSource = fs.readFileSync('src/app/workspace/use-workspace-message-dispatch.ts', 'utf8');
const workspaceHookReturnContractViolations = fs
  .readdirSync('src/app/workspace')
  .filter((fileName) => /^use-workspace-.*\.(ts|tsx)$/.test(fileName))
  .flatMap((fileName) => {
    const filePath = `src/app/workspace/${fileName}`;
    const source = fs.readFileSync(filePath, 'utf8');
    return Array.from(source.matchAll(/export function (useWorkspace[A-Za-z0-9]+)[\s\S]*?\):\s*([A-Za-z0-9]+)\s*\{/g))
      .filter((match) => !match[2].endsWith('Contract'))
      .map((match) => `${filePath}:${match[1]}:${match[2]}`);
  });
assert.deepEqual(
  workspaceHookReturnContractViolations,
  [],
  'all exported Workspace hooks should explicitly return a *Contract type',
);
const workspaceComponentParameterInferenceViolations = fs
  .readdirSync('src/app/workspace')
  .filter((fileName) => /\.(ts|tsx)$/.test(fileName))
  .flatMap((fileName) => {
    const filePath = `src/app/workspace/${fileName}`;
    const source = fs.readFileSync(filePath, 'utf8');
    return source.includes('Parameters<typeof') ? [filePath] : [];
  });
assert.deepEqual(
  workspaceComponentParameterInferenceViolations,
  [],
  'Workspace modules should not infer contracts from component or helper parameter lists',
);
const workspaceMessageActionsContractSource = fs.readFileSync('src/app/workspace/workspace-message-actions-contract.ts', 'utf8');
const workspaceMessageActionsHookSource = fs.readFileSync('src/app/workspace/use-workspace-message-actions.ts', 'utf8');
const workspacePlanFlowStateContractSource = fs.readFileSync('src/app/workspace/workspace-plan-flow-state-contract.ts', 'utf8');
const workspacePlanFlowStateSource = fs.readFileSync('src/app/workspace/workspace-plan-flow-state.ts', 'utf8');
const workspacePlanFlowStateHookSource = fs.readFileSync('src/app/workspace/use-workspace-plan-flow-state.ts', 'utf8');
const workspaceSessionSnapshotContractSource = fs.readFileSync('src/app/workspace/workspace-session-snapshot-contract.ts', 'utf8');
const workspaceSessionSnapshotHookSource = fs.readFileSync('src/app/workspace/use-workspace-session-snapshot.ts', 'utf8');
const sessionSnapshotLocalErrorsSource = fs.readFileSync('src/lib/workspace/workspace-session-snapshot-local-errors.ts', 'utf8');
const libTypesSource = fs.readFileSync('src/lib/types.ts', 'utf8');
const workspaceTypesSource = fs.readFileSync('src/app/workspace/workspace-types.ts', 'utf8');
const localStateSource = fs.readFileSync('src/app/workspace/use-workspace-page-local-state.ts', 'utf8');
const workspacePageLocalStateContractSource = fs.readFileSync('src/app/workspace/workspace-page-local-state-contract.ts', 'utf8');
const pageUiSource = fs.readFileSync('src/app/workspace/use-workspace-page-ui.tsx', 'utf8');
const mobilePreviewPanelSource = fs.readFileSync('src/app/workspace/workspace-ide-mobile-preview-panel.tsx', 'utf8');
const workspacePageUiContractSource = fs.readFileSync('src/app/workspace/workspace-page-ui-contract.ts', 'utf8');
const shellStateSource = fs.readFileSync('src/app/workspace/use-workspace-shell-state.ts', 'utf8');
const workspaceShellStateContractSource = fs.readFileSync('src/app/workspace/workspace-shell-state-contract.ts', 'utf8');
const chatScrollSnapshotSource = fs.readFileSync('src/app/workspace/workspace-chat-scroll-snapshot.ts', 'utf8');
const chatComponentsSource = fs.readFileSync('src/app/workspace/workspace-chat-components.tsx', 'utf8');
const chatPanelTypesSource = fs.readFileSync('src/app/workspace/workspace-chat-panel-types.ts', 'utf8');
const chatStateSummarySource = fs.readFileSync('src/app/workspace/workspace-chat-state-summary.tsx', 'utf8');
const chatPlanSelectionSource = fs.readFileSync('src/app/workspace/workspace-chat-plan-selection-message.tsx', 'utf8');
const chatPlanThoughtSource = fs.readFileSync('src/app/workspace/workspace-chat-plan-thought-process.tsx', 'utf8');
const chatPlanSnapshotSource = fs.readFileSync('src/app/workspace/workspace-chat-plan-snapshot.ts', 'utf8');
const planMessageHelpersSource = fs.readFileSync('src/app/workspace/workspace-plan-message-helpers.ts', 'utf8');
const chatMessageListSource = fs.readFileSync('src/app/workspace/workspace-chat-message-list.tsx', 'utf8');
const guidanceActionsSource = fs.readFileSync('src/app/workspace/workspace-guidance-actions.tsx', 'utf8');
const guidanceSnapshotSource = fs.readFileSync('src/app/workspace/workspace-guidance-snapshot.ts', 'utf8');
const chatMessageContentSource = fs.readFileSync('src/components/workspace/chat-message-content.tsx', 'utf8');
const workspaceClipboardLocalErrorsSource = fs.readFileSync('src/lib/workspace/workspace-clipboard-local-errors.ts', 'utf8');
const messageRenderSnapshotSource = fs.readFileSync('src/app/workspace/workspace-message-render-snapshot.ts', 'utf8');
const commitSummarySnapshotSource = fs.readFileSync('src/app/workspace/workspace-commit-summary-snapshot.ts', 'utf8');
const validationGateBlockedSnapshotSource = fs.readFileSync('src/app/workspace/workspace-validation-gate-blocked-snapshot.ts', 'utf8');
const contextGateRepairSource = fs.readFileSync('src/app/workspace/context-gate-repair.ts', 'utf8');
const workflowSectionSnapshotSource = fs.readFileSync('src/app/workspace/workspace-workflow-section-snapshot.ts', 'utf8');
const chatMessageSnapshotSource = fs.readFileSync('src/app/workspace/workspace-chat-message-snapshot.ts', 'utf8');
const chatThoughtProcessSnapshotSource = fs.readFileSync('src/app/workspace/workspace-chat-thought-process-snapshot.ts', 'utf8');
const engineeringStatePanelSnapshotSource = fs.readFileSync('src/app/workspace/workspace-engineering-state-panel-snapshot.ts', 'utf8');
const pagePanelPropsSource = fs.readFileSync('src/app/workspace/workspace-page-panel-props.ts', 'utf8');
const pageComponentsSource = fs.readFileSync('src/app/workspace/workspace-page-components.tsx', 'utf8');
const pageComponentTypesSource = fs.readFileSync('src/app/workspace/workspace-page-component-types.ts', 'utf8');
const pageContentSource = fs.readFileSync('src/app/workspace/use-workspace-page-content.tsx', 'utf8');
const pageViewContentSource = fs.readFileSync('src/app/workspace/use-workspace-page-view-content.tsx', 'utf8');
const workspacePageContentContractSource = fs.readFileSync('src/app/workspace/workspace-page-content-contract.ts', 'utf8');
const chatComposerSnapshotSource = fs.readFileSync('src/app/workspace/workspace-chat-composer-snapshot.ts', 'utf8');
const stopGenerationConfirmationSnapshotSource = fs.readFileSync('src/app/workspace/workspace-stop-generation-confirmation-snapshot.tsx', 'utf8');
const clearChatConfirmationSnapshotSource = fs.readFileSync('src/app/workspace/workspace-clear-chat-confirmation-snapshot.tsx', 'utf8');
const attachmentRemovalConfirmationSnapshotSource = fs.readFileSync('src/app/workspace/workspace-attachment-removal-confirmation-snapshot.tsx', 'utf8');
const pageContentOptionsSource = fs.readFileSync('src/app/workspace/workspace-page-view-content-options.ts', 'utf8');
const pageContainerSource = fs.readFileSync('src/app/workspace/use-workspace-page-container.tsx', 'utf8');
const workspacePageContainerContractSource = fs.readFileSync('src/app/workspace/workspace-page-container-contract.ts', 'utf8');
const pageShellSource = fs.readFileSync('src/app/workspace/use-workspace-page-shell.ts', 'utf8');
const workspacePageShellContractSource = fs.readFileSync('src/app/workspace/workspace-page-shell-contract.ts', 'utf8');
const pageCompositionSource = fs.readFileSync('src/app/workspace/use-workspace-page-composition.tsx', 'utf8');
const workspacePageCompositionContractSource = fs.readFileSync('src/app/workspace/workspace-page-composition-contract.ts', 'utf8');
const pageControllersSource = fs.readFileSync('src/app/workspace/use-workspace-page-controllers.tsx', 'utf8');
const workspacePageControllersContractSource = fs.readFileSync('src/app/workspace/workspace-page-controllers-contract.ts', 'utf8');
const pageActionControllersSource = fs.readFileSync('src/app/workspace/use-workspace-page-action-controllers.tsx', 'utf8');
const workspacePageActionControllersContractSource = fs.readFileSync('src/app/workspace/workspace-page-action-controllers-contract.ts', 'utf8');
const pageProjectActionsSource = fs.readFileSync('src/app/workspace/use-workspace-page-project-actions.tsx', 'utf8');
const pageAiActionsSource = fs.readFileSync('src/app/workspace/use-workspace-page-ai-actions.tsx', 'utf8');
const workspacePageAiActionsContractSource = fs.readFileSync('src/app/workspace/workspace-page-ai-actions-contract.ts', 'utf8');
const pageOrchestrationActionsSource = fs.readFileSync('src/app/workspace/use-workspace-page-orchestration-actions.tsx', 'utf8');
const orchestrationActionsSource = fs.readFileSync('src/app/workspace/use-workspace-orchestration-actions.ts', 'utf8');
const orchestrationHookSource = fs.readFileSync('src/app/workspace/use-workspace-orchestration.ts', 'utf8');
const orchestrationActionOptionBuildersSource = fs.readFileSync('src/app/workspace/workspace-orchestration-action-option-builders.ts', 'utf8');
const orchestrationActionTypesSource = fs.readFileSync('src/app/workspace/workspace-orchestration-action-types.ts', 'utf8');
const workspaceOrchestrationActionsContractSource = fs.readFileSync('src/app/workspace/workspace-orchestration-actions-contract.ts', 'utf8');
const orchestrationHookTypesSource = fs.readFileSync('src/app/workspace/workspace-orchestration-hook-types.ts', 'utf8');
const pageConversationActionsSource = fs.readFileSync('src/app/workspace/use-workspace-page-conversation-actions.tsx', 'utf8');
const workspacePageConversationActionsContractSource = fs.readFileSync('src/app/workspace/workspace-page-conversation-actions-contract.ts', 'utf8');
const promptActionsSource = fs.readFileSync('src/app/workspace/use-workspace-prompt-actions.ts', 'utf8');
const workspacePromptActionsContractSource = fs.readFileSync('src/app/workspace/workspace-prompt-actions-contract.ts', 'utf8');
const pageEffectsSource = fs.readFileSync('src/app/workspace/use-workspace-page-effects.ts', 'utf8');
const workspacePageEffectsContractSource = fs.readFileSync('src/app/workspace/workspace-page-effects-contract.ts', 'utf8');
const implementationGenerationActionSource = fs.readFileSync('src/app/workspace/use-workspace-implementation-generation-action.ts', 'utf8');
const orchestrationImplementationActionsSource = fs.readFileSync('src/app/workspace/use-workspace-orchestration-implementation-actions.ts', 'utf8');
const orchestrationSharedActionsSource = fs.readFileSync('src/app/workspace/use-workspace-orchestration-shared-actions.ts', 'utf8');
const implementationGenerationSource = fs.readFileSync('src/app/workspace/workspace-implementation-generation.ts', 'utf8');
const implementationStreamTypesSource = fs.readFileSync('src/app/workspace/workspace-implementation-stream-types.ts', 'utf8');
const implementationStreamEventsSource = fs.readFileSync('src/app/workspace/workspace-implementation-stream-events.ts', 'utf8');
const implementationStepEffectsSource = fs.readFileSync('src/app/workspace/workspace-implementation-step-effects.ts', 'utf8');
const implementationFinalizationEffectsSource = fs.readFileSync('src/app/workspace/workspace-implementation-finalization-effects.ts', 'utf8');
const implementationFailureEffectsSource = fs.readFileSync('src/app/workspace/workspace-implementation-failure-effects.ts', 'utf8');
const implementationStreamFinalizationSource = fs.readFileSync('src/app/workspace/workspace-implementation-stream-finalization.ts', 'utf8');
const orchestrationImplementationActionTypesSource = fs.readFileSync('src/app/workspace/workspace-orchestration-implementation-action-types.ts', 'utf8');
const orchestrationImplementationExecutionSource = fs.readFileSync('src/app/workspace/workspace-orchestration-implementation-execution.ts', 'utf8');
const orchestrationExecutionTypesSource = fs.readFileSync('src/app/workspace/workspace-orchestration-execution-types.ts', 'utf8');
const generationStatePersistenceSource = fs.readFileSync('src/app/workspace/workspace-generation-state-persistence.ts', 'utf8');
const planImplementationActionSource = fs.readFileSync('src/app/workspace/use-workspace-plan-implementation-action.ts', 'utf8');
const planImplementationSource = fs.readFileSync('src/app/workspace/workspace-plan-implementation.ts', 'utf8');
const orchestrationFlowTypesSource = fs.readFileSync('src/app/workspace/workspace-orchestration-flow-types.ts', 'utf8');
const orchestrationPlanningActionsSource = fs.readFileSync('src/app/workspace/use-workspace-orchestration-planning-actions.ts', 'utf8');
const orchestrationPlanExecutionSource = fs.readFileSync('src/app/workspace/workspace-orchestration-plan-execution.ts', 'utf8');
const planGenerationTypesSource = fs.readFileSync('src/app/workspace/workspace-plan-generation-types.ts', 'utf8');
const planGenerationLifecycleSource = fs.readFileSync('src/app/workspace/workspace-plan-generation-lifecycle.ts', 'utf8');
const planGenerationExecutionSource = fs.readFileSync('src/app/workspace/workspace-plan-generation-execution.ts', 'utf8');
const planGenerationFinalizationSource = fs.readFileSync('src/app/workspace/workspace-plan-generation-finalization.ts', 'utf8');
const planGenerationStreamTypesSource = fs.readFileSync('src/app/workspace/workspace-plan-generation-stream-types.ts', 'utf8');
const planGenerationStreamEventsSource = fs.readFileSync('src/app/workspace/workspace-plan-generation-stream-events.ts', 'utf8');
const planStepEffectsSource = fs.readFileSync('src/app/workspace/workspace-plan-step-effects.ts', 'utf8');
const pageFoundationSource = fs.readFileSync('src/app/workspace/use-workspace-page-foundation.tsx', 'utf8');
const workspacePageFoundationContractSource = fs.readFileSync('src/app/workspace/workspace-page-foundation-contract.ts', 'utf8');
const runtimeResourcesSource = fs.readFileSync('src/app/workspace/use-workspace-runtime-resources.ts', 'utf8');
const workspaceRuntimeResourcesContractSource = fs.readFileSync('src/app/workspace/workspace-runtime-resources-contract.ts', 'utf8');
const workspacePageProjectActionsContractSource = fs.readFileSync('src/app/workspace/workspace-page-project-actions-contract.ts', 'utf8');
const workspacePageOrchestrationActionsContractSource = fs.readFileSync('src/app/workspace/workspace-page-orchestration-actions-contract.ts', 'utf8');
const pageViewControllersSource = fs.readFileSync('src/app/workspace/use-workspace-page-view-controllers.tsx', 'utf8');
const workspacePageViewControllersContractSource = fs.readFileSync('src/app/workspace/workspace-page-view-controllers-contract.ts', 'utf8');
const pageViewUiSource = fs.readFileSync('src/app/workspace/use-workspace-page-view-ui.tsx', 'utf8');
const ideInteractionsSource = fs.readFileSync('src/app/workspace/use-workspace-ide-interactions.ts', 'utf8');
const workspaceIdeInteractionsContractSource = fs.readFileSync('src/app/workspace/workspace-ide-interactions-contract.ts', 'utf8');
const resourceOperationsSource = fs.readFileSync('src/app/workspace/use-workspace-resource-operations.ts', 'utf8');
const workspaceResourceOperationsContractSource = fs.readFileSync('src/app/workspace/workspace-resource-operations-contract.ts', 'utf8');
const foundationPanelSource = fs.readFileSync('src/app/workspace/workspace-foundation-panel.tsx', 'utf8');
const foundationPanelSnapshotSource = fs.readFileSync('src/app/workspace/workspace-foundation-panel-snapshot.ts', 'utf8');
const workspaceFlowStateConsumerSources = [
  pageContentOptionsSource,
  pageControllersSource,
  pageActionControllersSource,
  pageProjectActionsSource,
  pageAiActionsSource,
  pageOrchestrationActionsSource,
  pageConversationActionsSource,
  pageViewControllersSource,
].join('\n');
const workspacePageLocalStateConsumerSources = [
  pageContentOptionsSource,
  pageControllersSource,
  pageActionControllersSource,
  pageProjectActionsSource,
  pageAiActionsSource,
  pageOrchestrationActionsSource,
  pageConversationActionsSource,
  pageViewControllersSource,
  pageViewUiSource,
].join('\n');
const workspaceShellStateConsumerSources = [
  pageContentOptionsSource,
  pageControllersSource,
  pageActionControllersSource,
  pageProjectActionsSource,
  pageAiActionsSource,
  pageConversationActionsSource,
  pageViewControllersSource,
  pageViewUiSource,
].join('\n');
const workspaceRuntimeResourcesConsumerSources = [
  pageControllersSource,
  pageActionControllersSource,
  pageProjectActionsSource,
  pageAiActionsSource,
  pageOrchestrationActionsSource,
].join('\n');
const workspacePageProjectActionsConsumerSources = [
  pageAiActionsSource,
  pageOrchestrationActionsSource,
  pageConversationActionsSource,
].join('\n');
const workspacePageOrchestrationActionsConsumerSources = [
  pageConversationActionsSource,
].join('\n');

const refreshExplorerPanelSource = pageProjectActionsSource.slice(
  pageProjectActionsSource.indexOf('const refreshExplorerPanel = async () => {'),
  pageProjectActionsSource.indexOf('const openGitPanel = () => {'),
);
const refreshGitPanelSource = pageProjectActionsSource.slice(
  pageProjectActionsSource.indexOf('const refreshGitPanel = async () => {'),
  pageProjectActionsSource.indexOf('const {\n    saveFile,'),
);
assert.match(
  helperSource,
  /function mergeWorkspaceEngineeringState/,
  'workspace message restore should explicitly merge engineeringState sections',
);
assert.match(
  helperSource,
  /function buildWorkspaceMessageIdentityKey/,
  'workspace message restore should dedupe persisted/session messages without including engineeringState in the identity key',
);
assert.match(
  helperSource,
  /function buildEngineeringStateRestoreSummary/,
  'project engineering_state restore message should use a dedicated phase/recovery summary helper',
);
assert.match(
  helperSource,
  /(?=[\s\S]*isWorkspaceBackendWorkflowStage)(?=[\s\S]*WorkspaceGenerationMode)(?=[\s\S]*WorkspaceBackendWorkflowStage)(?=[\s\S]*function normalizeEngineeringStateRecoveryMode\(mode\?: string\): WorkspaceGenerationMode \| undefined)(?=[\s\S]*function hasEngineeringStateRestoreRecoveryRetry\([\s\S]*recovery: WorkspaceRecoveryState \| undefined,[\s\S]*\): recovery is WorkspaceRecoveryState \{)(?=[\s\S]*function getEngineeringStateRestoreRetryPrompt\(recovery: WorkspaceRecoveryState \| undefined\): string \{)(?=[\s\S]*function getEngineeringStateRestoreRetryLabel\(recovery: WorkspaceRecoveryState \| undefined\): string \{)(?=[\s\S]*function getEngineeringStateRestoreRecoveryMode\(recovery: WorkspaceRecoveryState\): WorkspaceGenerationMode \| undefined \{)(?=[\s\S]*function getEngineeringStateRestoreRecoveryStage\(recovery: WorkspaceRecoveryState\): WorkspaceBackendWorkflowStage \| undefined \{)(?=[\s\S]*function buildEngineeringStateRestoreActions[\s\S]*const recovery = getEngineeringStateRestoreRecovery\(engineeringState\);[\s\S]*const hasRecoveryRetry = hasEngineeringStateRestoreRecoveryRetry\(recovery\);[\s\S]*const retryPrompt = getEngineeringStateRestoreRetryPrompt\(recovery\);[\s\S]*const hasRetryPrompt = hasEngineeringStateRestoreTextValue\(retryPrompt\);[\s\S]*kind: 'retry_workflow_gate'[\s\S]*prompt: retryPrompt[\s\S]*mode: getEngineeringStateRestoreRecoveryMode\(recovery\)[\s\S]*conversationStage: getEngineeringStateRestoreRecoveryStage\(recovery\))/,
  'project engineering_state restore message should use a dedicated recovery action helper with backend workflow stage guarding',
);
assert.match(
  helperSource,
  /function getEngineeringStateRestoreFoundationStatus\(bootstrapState: WorkspaceBootstrapState \| undefined\): string \{[\s\S]*function getEngineeringStateRestoreCurrentPhase\(phase: WorkspacePhaseState \| undefined\): string \{[\s\S]*function getEngineeringStateRestoreCurrentTask\(phase: WorkspacePhaseState \| undefined\): string \{[\s\S]*function getEngineeringStateRestoreRecoveryReasonMessage\(recovery: WorkspaceRecoveryState \| undefined\): string \{[\s\S]*function getEngineeringStateRestoreRecoveryReasonCode\(recovery: WorkspaceRecoveryState \| undefined\): string \{[\s\S]*function getEngineeringStateRestorePhaseNextAction\(phase: WorkspacePhaseState \| undefined\): string \{[\s\S]*function getEngineeringStateRestoreExecutionNextAction\(execution: WorkspaceExecutionState \| undefined\): string \{[\s\S]*function getEngineeringStateRestoreBootstrapNextAction\(bootstrapState: WorkspaceBootstrapState \| undefined\): string \{[\s\S]*function buildEngineeringStateRestoreSummary\(engineeringState: WorkspaceEngineeringStateSnapshot\) \{[\s\S]*const phase = getEngineeringStateRestorePhase\(engineeringState\);[\s\S]*const recovery = getEngineeringStateRestoreRecovery\(engineeringState\);[\s\S]*const execution = getEngineeringStateRestoreExecution\(engineeringState\);[\s\S]*const bootstrapState = getEngineeringStateRestoreBootstrapState\(engineeringState\);[\s\S]*const foundationStatus = getEngineeringStateRestoreFoundationStatus\(bootstrapState\);[\s\S]*const currentPhase = getEngineeringStateRestoreCurrentPhase\(phase\);[\s\S]*const currentTask = getEngineeringStateRestoreCurrentTask\(phase\);[\s\S]*const recoveryReasonMessage = getEngineeringStateRestoreRecoveryReasonMessage\(recovery\);[\s\S]*const recoveryReasonCode = getEngineeringStateRestoreRecoveryReasonCode\(recovery\);[\s\S]*const phaseNextAction = getEngineeringStateRestorePhaseNextAction\(phase\);[\s\S]*const executionNextAction = getEngineeringStateRestoreExecutionNextAction\(execution\);[\s\S]*const retryLabel = getEngineeringStateRestoreRetryLabel\(recovery\);[\s\S]*const foundationNextAction = getEngineeringStateRestoreBootstrapNextAction\(bootstrapState\);/,
  'project engineering_state restore summary should derive foundation, phase, recovery and next action text through named readers',
);
assert.doesNotMatch(
  helperSource,
  /recovery\?\.retry_prompt\?\.trim\(\) \?\? ''|recovery\?\.retry_label\?\.trim\(\) \?\? ''|phase\?\.current_phase \?\? ''|phase\?\.current_task \?\? ''|recovery\?\.reason_message \?\? ''|recovery\?\.reason_code \?\? ''|phase\?\.next_action \?\? ''|engineeringState\.execution\?\.next_action \?\? ''|engineeringState\.bootstrap_state\?\.(?:status|next_action) \?\? ''|phaseNextAction\.length > 0|executionNextAction\.length > 0|retryLabel\.length > 0/,
  'project engineering_state restore helper should not regress to optional fallback or inline next-action presence gates',
);
assert.doesNotMatch(
  helperSource,
  /GuidanceAction\['mode'\]/,
  'project engineering_state restore helper should consume WorkspaceGenerationMode directly instead of indexed GuidanceAction mode access',
);
assert.match(
  helperSource,
  /export type InitialWorkspaceMessagesProject = \{[\s\S]*description: string;[\s\S]*initialMessage: string;[\s\S]*engineeringState\?: WorkspaceEngineeringStateSnapshot;[\s\S]*\};[\s\S]*export function buildInitialWorkspaceMessages\(project: InitialWorkspaceMessagesProject\): WorkspaceChatMessage\[\] \{/,
  'initial workspace messages helper should consume an explicit project input contract without Pick inference',
);
assert.match(
  helperSource,
  /const WORKSPACE_INITIAL_ANALYSIS_PLACEHOLDER_MESSAGE = '正在分析你的需求并规划技术方案\.\.\.';[\s\S]*function getInitialWorkspaceMessageTextValue\(value: string\): string \{[\s\S]*function hasInitialWorkspaceMessageTextValue\(value: string\): boolean \{[\s\S]*function isInitialWorkspaceAnalysisPlaceholder\(value: string\): boolean \{[\s\S]*function getInitialWorkspaceEngineeringState\([\s\S]*project: InitialWorkspaceMessagesProject,[\s\S]*\): WorkspaceEngineeringStateSnapshot \| undefined \{[\s\S]*function hasInitialWorkspaceEngineeringState\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*\): engineeringState is WorkspaceEngineeringStateSnapshot \{[\s\S]*export function buildInitialWorkspaceMessages\(project: InitialWorkspaceMessagesProject\): WorkspaceChatMessage\[\] \{[\s\S]*const description = getInitialWorkspaceMessageTextValue\(project\.description\);[\s\S]*const hasDescription = hasInitialWorkspaceMessageTextValue\(description\);[\s\S]*if \(hasDescription === true\)[\s\S]*const normalizedInitialMessage = getInitialWorkspaceMessageTextValue\(project\.initialMessage\);[\s\S]*const hasInitialMessage = hasInitialWorkspaceMessageTextValue\(normalizedInitialMessage\);[\s\S]*if \(hasInitialMessage === true\)[\s\S]*const isPlaceholderMessage = isInitialWorkspaceAnalysisPlaceholder\(normalizedInitialMessage\);[\s\S]*if \(isPlaceholderMessage === true\)[\s\S]*const engineeringState = getInitialWorkspaceEngineeringState\(project\);[\s\S]*const hasEngineeringState = hasInitialWorkspaceEngineeringState\(engineeringState\);[\s\S]*if \(hasEngineeringState === true\)/,
  'initial workspace messages helper should derive description, assistant placeholder and engineering state gates through named facts',
);
assert.doesNotMatch(
  helperSource,
  /if \(project\.description\)|if \(project\.initialMessage\)|project\.initialMessage\.trim\(\)|normalizedInitialMessage === '正在分析你的需求并规划技术方案\.\.\.'|if \(project\.engineeringState\)/,
  'initial workspace messages helper should not regress to direct project truthy or inline placeholder gates',
);
assert.doesNotMatch(
  helperSource,
  /buildInitialWorkspaceMessages\([\s\S]*Pick<WorkspaceProjectInfo, 'description' \| 'initialMessage' \| 'engineeringState'>/,
  'initial workspace messages helper should not regress to a Pick-derived project input slice',
);
assert.match(
  projectBootstrapSource,
  /import type \{[\s\S]*InitialWorkspaceMessagesProject,[\s\S]*PendingWorkspaceNavigationClearResult,[\s\S]*\} from '\.\/workspace-page-helpers';[\s\S]*buildInitialWorkspaceMessages: \(project: InitialWorkspaceMessagesProject\) => WorkspaceChatMessage\[\];/,
  'workspace project bootstrap should reuse the explicit initial messages project input contract',
);
assert.doesNotMatch(
  projectBootstrapSource,
  /buildInitialWorkspaceMessages: \(project: Pick<WorkspaceProjectInfo, 'description' \| 'initialMessage' \| 'engineeringState'>\)/,
  'workspace project bootstrap should not regress to a Pick-derived initial messages project input slice',
);
assert.match(
  helperSource,
  /function hasEngineeringStateRestoreSuggestedActions\(suggestedActions: GuidanceAction\[\]\): boolean \{[\s\S]*const hasSuggestedActions = suggestedActions\.length > 0;[\s\S]*return hasSuggestedActions === true;[\s\S]*\}[\s\S]*suggestedActions: hasEngineeringStateRestoreSuggestedActions\(suggestedActions\) === true[\s\S]*\? suggestedActions[\s\S]*: undefined/,
  'project engineering_state restore message should explicitly attach recovery suggested actions when available',
);
assert.match(
  projectBootstrapSource,
  /const appendWorkspaceMessagesRestoreFailureMessage = useCallback\(\([\s\S]*usedSessionSnapshot: boolean,[\s\S]*id: `workspace-messages-restore-failed-\$\{projectId\}-\$\{now\}`/,
  'workspace message restore failures should use a dedicated user-visible recovery prompt helper',
);
assert.match(
  projectBootstrapSource,
  /已使用本地会话快照兜底，当前聊天记录、工程状态或恢复入口可能不是后端最新状态；你可以稍后刷新项目重新同步，已打开文件的本地编辑内容不会因此丢失。/,
  'workspace message restore failures should warn when falling back to a local session snapshot',
);
assert.match(
  projectBootstrapSource,
  /未找到可用的本地会话快照，当前聊天记录、工程状态或恢复入口可能不完整；你可以稍后刷新项目重新同步。/,
  'workspace message restore failures should warn when no local session snapshot is available',
);
assert.match(
  projectBootstrapSource,
  /catch \(error\) \{[\s\S]*console\.error\('恢复项目消息失败:', error\);[\s\S]*const snapshot = readWorkspaceSessionSnapshot\(currentProjectId\);[\s\S]*const hasSessionMessages = hasWorkspaceBootstrapSessionMessages\(snapshot\);[\s\S]*if \(hasSessionMessages === true\) \{[\s\S]*applyWorkspaceState\(snapshot\.messages,[\s\S]*selectedPlanId: getWorkspaceBootstrapSelectedPlanId\(snapshot\.selectedPlanId, persistedPlanId\),[\s\S]*appendWorkspaceMessagesRestoreFailureMessage\(currentProjectId, error, true\);[\s\S]*appendWorkspaceMessagesRestoreFailureMessage\(currentProjectId, error, false\);/,
  'workspace message restore failures should surface both session-snapshot fallback and missing-snapshot states',
);
assert.match(
  projectBootstrapSource,
  /function getWorkspaceBootstrapPersistedProject\(projectInfo: WorkspaceProjectInfo \| null\): WorkspaceProjectInfo \| null \{[\s\S]*const isPersistedProject = projectInfo\.isPersisted === true;[\s\S]*const hasProjectId = hasWorkspaceBootstrapProjectTextValue\(projectInfo\.projectId\);[\s\S]*function getWorkspaceBootstrapSelectedPlanId\([\s\S]*snapshotSelectedPlanId: string \| null \| undefined,[\s\S]*persistedPlanId: string \| null \| undefined,[\s\S]*const hasSnapshotSelectedPlan = hasWorkspaceBootstrapProjectTextValue\(snapshotSelectedPlanId\);[\s\S]*const hasPersistedPlan = hasWorkspaceBootstrapProjectTextValue\(persistedPlanId\);[\s\S]*function hasWorkspaceBootstrapSessionMessages\([\s\S]*snapshot: WorkspaceSessionSnapshot \| null,[\s\S]*const hasMessages = snapshot\.messages\.length > 0;[\s\S]*function hasWorkspaceBootstrapRestoredPlanState\(availablePlans: Plan\[\], selectedPlanId: string \| null\): boolean \{[\s\S]*const hasAvailablePlans = availablePlans\.length > 0;[\s\S]*const hasSelectedPlan = hasWorkspaceBootstrapProjectTextValue\(selectedPlanId\);/,
  'workspace project bootstrap should derive persisted project, selected plan and session message facts through named helpers',
);
assert.match(
  projectBootstrapSource,
  /type WorkspaceBootstrapMessageDeserializer = \(message: ProjectMessage\) => WorkspaceChatMessage;[\s\S]*type WorkspaceBootstrapRestoredMessagesMaterializerInput = \{[\s\S]*historyMessages: ProjectMessage\[\];[\s\S]*deserializeWorkspaceMessage: WorkspaceBootstrapMessageDeserializer;[\s\S]*function materializeWorkspaceBootstrapRestoredMessages\(\{[\s\S]*historyMessages,[\s\S]*deserializeWorkspaceMessage,[\s\S]*\}: WorkspaceBootstrapRestoredMessagesMaterializerInput\): WorkspaceChatMessage\[\] \{[\s\S]*const restoredMessages: WorkspaceChatMessage\[\] = \[\];[\s\S]*for \(const historyMessage of historyMessages\) \{[\s\S]*restoredMessages\.push\(deserializeWorkspaceMessage\(historyMessage\)\);[\s\S]*return restoredMessages;[\s\S]*\}/,
  'workspace project bootstrap should materialize restored history messages through a named for-of materializer',
);
assert.match(
  projectBootstrapSource,
  /const sessionSnapshot = readWorkspaceSessionSnapshot\(data\.projectId\);[\s\S]*const hasSessionSnapshot = hasWorkspaceBootstrapSessionSnapshot\(sessionSnapshot\);[\s\S]*if \(hasSessionSnapshot === true\) \{[\s\S]*selectedPlanId: getWorkspaceBootstrapSelectedPlanId\(sessionSnapshot\.selectedPlanId, data\.planId\),[\s\S]*selectedPlanId: getWorkspaceBootstrapSelectedPlanId\(null, data\.planId\),/,
  'workspace project initialization should restore selected plan through the bootstrap selected plan reader',
);
assert.match(
  projectBootstrapSource,
  /const persistedProject = getWorkspaceBootstrapPersistedProject\(projectInfo\);[\s\S]*if \(persistedProject === null\) return;[\s\S]*if \(restoredProjectIdRef\.current === persistedProject\.projectId\) return;[\s\S]*const currentProjectId = persistedProject\.projectId;[\s\S]*const persistedPlanId = persistedProject\.planId;[\s\S]*const snapshot = readWorkspaceSessionSnapshot\(currentProjectId\);[\s\S]*const restoredMessages = materializeWorkspaceBootstrapRestoredMessages\(\{[\s\S]*historyMessages,[\s\S]*deserializeWorkspaceMessage,[\s\S]*\}\);[\s\S]*const hasSessionMessages = hasWorkspaceBootstrapSessionMessages\(snapshot\);[\s\S]*const sessionMessages = hasSessionMessages === true \? snapshot\.messages : undefined;[\s\S]*resolveRestoredPlanFlowState\([\s\S]*persistedPlanId,[\s\S]*const hasRestoredPlanState = hasWorkspaceBootstrapRestoredPlanState\(/,
  'workspace message restore effect should consume persisted project, session message and selected plan facts',
);
assert.doesNotMatch(
  projectBootstrapSource,
  /if \(sessionSnapshot\)|selectedPlanId: sessionSnapshot\.selectedPlanId \|\| data\.planId \|\| null|selectedPlanId: data\.planId \|\| null|if \(!projectInfo\?\.isPersisted \|\| !projectInfo\.projectId\) return|snapshot\?\.messages\?\.length|selectedPlanId: snapshot\.selectedPlanId \|\| projectInfo\.planId \|\| null|projectInfo\?\.isPersisted, projectInfo\?\.planId, projectInfo\?\.projectId|historyMessages\.map\(deserializeWorkspaceMessage\)/,
  'workspace project bootstrap message restore should not regress to truthy session snapshot, optional project gate, selected plan OR fallback or inline restored message mapping',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /function hasWorkspaceSessionSnapshotMessageId\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*messageId: string,[\s\S]*\): boolean[\s\S]*for \(const message of messages\)[\s\S]*const hasMessageId = message\.id === messageId;[\s\S]*if \(hasMessageId === true\)[\s\S]*function hasWorkspaceSessionSnapshotRaw\(raw: string \| null\): raw is string[\s\S]*const hasRaw = raw\.length > 0;[\s\S]*return hasRaw === true;[\s\S]*function hasWorkspaceSessionSnapshotProjectId\([\s\S]*projectId: string \| null \| undefined,[\s\S]*\): projectId is string[\s\S]*const hasProjectId = projectId\.length > 0;[\s\S]*return hasProjectId === true;[\s\S]*try \{[\s\S]*raw = sessionStorage\.getItem\(getWorkspaceSessionKey\(targetProjectId\)\);[\s\S]*\} catch \(error\) \{[\s\S]*const messageId = `workspace-session-snapshot-read-failed-\$\{targetProjectId\}`;[\s\S]*const hasExistingMessage = hasWorkspaceSessionSnapshotMessageId\(prev, messageId\);[\s\S]*if \(hasExistingMessage === true\)[\s\S]*id: messageId/,
  'workspace session snapshot read failures should be surfaced with a stable user-visible prompt id',
);
assert.match(
  sessionSnapshotLocalErrorsSource,
  /export type WorkspaceSessionSnapshotLocalStateSource = 'session_storage';[\s\S]*export type WorkspaceSessionSnapshotLocalStateDetails = string;[\s\S]*export type WorkspaceSessionSnapshotLocalStateFailure =[\s\S]*source: WorkspaceSessionSnapshotLocalStateSource;[\s\S]*details: WorkspaceSessionSnapshotLocalStateDetails;[\s\S]*export function getWorkspaceSessionSnapshotLocalStateDetails\([\s\S]*fallback: WorkspaceSessionSnapshotLocalStateDetails,[\s\S]*\): WorkspaceSessionSnapshotLocalStateDetails[\s\S]*export function buildWorkspaceSessionSnapshotLocalStateFailure\([\s\S]*fallback: WorkspaceSessionSnapshotLocalStateDetails,[\s\S]*details: getWorkspaceSessionSnapshotLocalStateDetails\(error, fallback\)[\s\S]*export function formatWorkspaceSessionSnapshotLocalStateError\([\s\S]*fallback: WorkspaceSessionSnapshotLocalStateDetails,[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source: failure\.source,[\s\S]*details: failure\.details,[\s\S]*\}, fallback\)/,
  'workspace session snapshot local errors should centralize structured session_storage source/details formatting',
);
assert.doesNotMatch(
  sessionSnapshotLocalErrorsSource,
  /source: 'session_storage';[\s\S]*details: string;|fallback: string/,
  'workspace session snapshot local errors should not regress source/details fields or fallback to raw contracts',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /本地会话快照读取失败：[\s\S]*无法确认 yistack_workspace_session:\$\{targetProjectId\} 是否可作为历史消息兜底[\s\S]*当前聊天记录、工程状态或恢复入口可能无法从本地快照恢复/,
  'workspace session snapshot read failures should explain missing local fallback certainty',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /if \(hasWorkspaceSessionSnapshotRaw\(raw\) === false\) return null;[\s\S]*return JSON\.parse\(raw\) as WorkspaceSessionSnapshot;/,
  'workspace session snapshot reader should gate raw snapshot payloads through the explicit raw fact',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /catch \(error\) \{[\s\S]*try \{[\s\S]*sessionStorage\.removeItem\(getWorkspaceSessionKey\(targetProjectId\)\);[\s\S]*\} catch \(removeError\) \{[\s\S]*cleanupError = removeError;[\s\S]*const messageId = `workspace-session-snapshot-parse-failed-\$\{targetProjectId\}`;[\s\S]*const hasExistingMessage = hasWorkspaceSessionSnapshotMessageId\(prev, messageId\);[\s\S]*if \(hasExistingMessage === true\)[\s\S]*id: messageId/,
  'corrupted workspace session snapshots should be cleared and surfaced with a stable user-visible prompt id',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /const cleanupStatus = cleanupError[\s\S]*损坏快照清理也失败：\$\{formatWorkspaceSessionSnapshotLocalStateError\(cleanupError, '浏览器拒绝清理本地会话存储'\)\}[\s\S]*旧的 yistack_workspace_session:\$\{targetProjectId\} 可能仍会残留/,
  'corrupted workspace session snapshot cleanup failures should explain stale local snapshot risk',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /本地会话快照解析失败：[\s\S]*当前聊天记录、工程状态或恢复入口可能无法从本地快照兜底恢复。/,
  'corrupted workspace session snapshots should explain that local fallback restore is unavailable',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /const hasProjectId = hasWorkspaceSessionSnapshotProjectId\(projectId\);[\s\S]*if \(hasProjectId === false\) return;[\s\S]*try \{[\s\S]*sessionStorage\.setItem\(getWorkspaceSessionKey\(projectId\), JSON\.stringify\(snapshot\)\);[\s\S]*\} catch \(error\) \{[\s\S]*const messageId = `workspace-session-snapshot-save-failed-\$\{projectId\}`;[\s\S]*const hasExistingMessage = hasWorkspaceSessionSnapshotMessageId\(prev, messageId\);[\s\S]*if \(hasExistingMessage === true\)[\s\S]*id: messageId/,
  'workspace session snapshot save failures should be surfaced with a stable user-visible prompt id',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /本地会话快照保存失败：[\s\S]*当前聊天记录、工程状态和恢复入口仍保留在当前页面内存中，但刷新或离开页面后可能无法从本地快照恢复。/,
  'workspace session snapshot save failures should explain current-memory and refresh restore risk',
);
assert.doesNotMatch(
  workspaceSessionSnapshotHookSource,
  /prev\.some\(\(message\) => message\.id === `workspace-session-snapshot-(?:read|parse|save)-failed-|if \(!raw\)|if \(!projectId\)/,
  'workspace session snapshot hook should not regress read, parse or save gates to inline predicates',
);
assert.match(
  workspaceTypesSource,
  /export type WorkspaceWorkflowSnapshot = \{[\s\S]*engineeringState\?: WorkspaceEngineeringStateSnapshot;[\s\S]*gateResult\?: WorkspaceGateResult;[\s\S]*\};/,
  'workspace workflow snapshot state should have an explicit type entry for latest engineering state and gate result',
);
assert.match(
  workspaceFlowStateContractSource,
  /export type WorkspaceRuntimeRecoveryMessagesAction = WorkspaceMessageListAction;[\s\S]*export type WorkspaceProjectPanelRefreshMessagesAction = WorkspaceMessageListAction;[\s\S]*export type WorkspaceFlowStateContract = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*setMessages: WorkspaceMessageListAction;[\s\S]*messagesRef: RefObject<WorkspaceChatMessage\[\]>;[\s\S]*workflowSnapshotRef: RefObject<WorkspaceWorkflowSnapshot>;[\s\S]*availablePlans: Plan\[\];[\s\S]*recommendedPlanId: string \| null;[\s\S]*selectedPlanId: string \| null;[\s\S]*updatePlanFlowState: \(patch: WorkspacePlanFlowStatePatch\) => void;[\s\S]*applyWorkspaceState: \([\s\S]*nextMessages: WorkspaceChatMessage\[\],[\s\S]*options\?: WorkspacePlanFlowStateApplyOptions,[\s\S]*\) => void;[\s\S]*applyWorkflowStepToMessage: \(messageId: string, step: WorkflowStep\) => void;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*applyRuntimeRecoveryMessages: WorkspaceRuntimeRecoveryMessagesAction;[\s\S]*applyProjectPanelRefreshMessages: WorkspaceProjectPanelRefreshMessagesAction;[\s\S]*applyImplementationStreamPatchMessages: WorkspaceMessageListAction;[\s\S]*readWorkspaceSessionSnapshot: \(projectId: string\) => WorkspaceSessionSnapshot \| null;[\s\S]*currentEngineeringState: WorkspaceEngineeringStateSnapshot \| undefined;[\s\S]*currentGateResult: WorkspaceGateResult \| undefined;[\s\S]*\};/,
  'workspace flow state should expose an explicit contract type for the StateManager composition boundary',
);
assert.match(
  workspaceFlowRefsContractSource,
  /export type WorkspaceFlowRefsContract = \{[\s\S]*messagesRef: RefObject<WorkspaceChatMessage\[\]>;[\s\S]*workflowSnapshotRef: RefObject<WorkspaceWorkflowSnapshot>;[\s\S]*\};/,
  'workspace flow refs should expose an explicit contract type for the StateManager refs boundary',
);
assert.match(
  workspaceMessageStateSource,
  /export type WorkspaceMessageMutationSource =[\s\S]*'external_set_messages'[\s\S]*'session_snapshot_read_failure'[\s\S]*'session_snapshot_parse_failure'[\s\S]*'workflow_step'[\s\S]*'message_streaming'[\s\S]*'workspace_state_apply'[\s\S]*'plan_flow_state'[\s\S]*'runtime_recovery'[\s\S]*'project_panel_refresh'[\s\S]*'prompt_interaction'[\s\S]*'runtime_resource'[\s\S]*'project_bootstrap'[\s\S]*'page_effect'[\s\S]*'page_ui'[\s\S]*'ide_interaction'[\s\S]*'resource_file'[\s\S]*'resource_git'[\s\S]*'orchestration_shared'[\s\S]*'generation_state_persistence'[\s\S]*'plan_generation'[\s\S]*'plan_stream_patch'[\s\S]*'plan_implementation'[\s\S]*'implementation_generation'[\s\S]*'implementation_stream_patch'[\s\S]*'session_snapshot_save_failure'[\s\S]*export type WorkspaceMessageState = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*workflowSnapshot: WorkspaceWorkflowSnapshot;[\s\S]*lastMutationSource: WorkspaceMessageMutationSource \| null;[\s\S]*mutationVersion: number;/,
  'workspace message state module should model message mutations with explicit sources for StateManager migration',
);
assert.match(
  workspaceMessageStateSource,
  /export type WorkspaceMessageStateAction = \{[\s\S]*type: 'apply_messages';[\s\S]*source: WorkspaceMessageMutationSource;[\s\S]*export function reduceWorkspaceMessageState\([\s\S]*workflowSnapshot: resolveLatestWorkflowSnapshot\(nextMessages\),[\s\S]*lastMutationSource: action\.source,[\s\S]*mutationVersion: state\.mutationVersion \+ 1,/,
  'workspace message state module should atomically maintain messages, workflow snapshot and mutation metadata through a reducer',
);
assert.match(
  workspaceMessageStateSource,
  /function hasWorkspaceMessageStateGateResult\([\s\S]*gateResult: WorkspaceGateResult \| undefined,[\s\S]*\): gateResult is WorkspaceGateResult \{[\s\S]*return gateResult !== undefined;[\s\S]*function hasWorkspaceMessageStateMessage\([\s\S]*message: WorkspaceChatMessage \| undefined,[\s\S]*\): message is WorkspaceChatMessage \{[\s\S]*return message !== undefined;[\s\S]*export function resolveLatestWorkflowSnapshot\([\s\S]*const hasMessage = hasWorkspaceMessageStateMessage\(message\);[\s\S]*if \(hasMessage === false\)[\s\S]*continue;[\s\S]*const hasGateResult = hasWorkspaceMessageStateGateResult\(gateResult\);[\s\S]*const messageGateResult = message\.gateResult;[\s\S]*const hasMessageGateResult = hasWorkspaceMessageStateGateResult\(messageGateResult\);[\s\S]*if \(hasGateResult === false && hasMessageGateResult === true\)[\s\S]*gateResult = messageGateResult;[\s\S]*const hasResolvedGateResult = hasWorkspaceMessageStateGateResult\(gateResult\);[\s\S]*if \(hasResolvedGateResult === true\)/,
  'workspace message state module should resolve latest gate result through explicit presence facts',
);
assert.doesNotMatch(
  workspaceMessageStateSource,
  /if \(!gateResult && message\?\.gateResult\)|if \(gateResult\)|message\?\.gateResult/,
  'workspace message state module should not regress latest gate result resolution to object truthy gates',
);
assert.match(
  workspaceMessageDispatchContractSource,
  /export type WorkspaceMessageDispatchAction = Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*export type WorkspaceMessageDispatchContract = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*workflowSnapshot: WorkspaceWorkflowSnapshot;[\s\S]*initialWorkflowSnapshot: WorkspaceWorkflowSnapshot;[\s\S]*applyWorkspaceMessages: \([\s\S]*source: WorkspaceMessageMutationSource,[\s\S]*value: SetStateAction<WorkspaceChatMessage\[\]>,[\s\S]*\) => void;[\s\S]*setMessages: WorkspaceMessageDispatchAction;[\s\S]*currentEngineeringState: WorkspaceEngineeringStateSnapshot \| undefined;[\s\S]*currentGateResult: WorkspaceGateResult \| undefined;[\s\S]*\};/,
  'workspace message dispatch should expose an explicit contract type for the StateManager dispatch boundary',
);
assert.match(
  workspaceMessageActionsContractSource,
  /export type WorkspaceMessageAction = Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*export type WorkspaceMessageActionsContract = \{[\s\S]*applyWorkflowStepToMessage: \(messageId: string, step: WorkflowStep\) => void;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*applyRuntimeRecoveryMessages: WorkspaceMessageAction;[\s\S]*applyProjectPanelRefreshMessages: WorkspaceMessageAction;[\s\S]*applyPromptInteractionMessages: WorkspaceMessageAction;[\s\S]*applyRuntimeResourceMessages: WorkspaceMessageAction;[\s\S]*applyProjectBootstrapMessages: WorkspaceMessageAction;[\s\S]*applyPageEffectMessages: WorkspaceMessageAction;[\s\S]*applyPageUiMessages: WorkspaceMessageAction;[\s\S]*applyIdeInteractionMessages: WorkspaceMessageAction;[\s\S]*applyResourceFileMessages: WorkspaceMessageAction;[\s\S]*applyResourceGitMessages: WorkspaceMessageAction;[\s\S]*applyOrchestrationSharedMessages: WorkspaceMessageAction;[\s\S]*applyGenerationStateMessages: WorkspaceMessageAction;[\s\S]*applyPlanGenerationMessages: WorkspaceMessageAction;[\s\S]*applyPlanStreamPatchMessages: WorkspaceMessageAction;[\s\S]*applyPlanImplementationMessages: WorkspaceMessageAction;[\s\S]*applyImplementationGenerationMessages: WorkspaceMessageAction;[\s\S]*applyImplementationStreamPatchMessages: WorkspaceMessageAction;[\s\S]*\};/,
  'workspace message actions should expose an explicit contract type for grouped StateManager message writers',
);
assert.match(
  workspacePlanFlowStateContractSource,
  /export type WorkspacePlanSelectionAction<T> = Dispatch<SetStateAction<T>>;[\s\S]*export type WorkspacePlanFlowStateContract = \{[\s\S]*availablePlans: Plan\[\];[\s\S]*recommendedPlanId: string \| null;[\s\S]*selectedPlanId: string \| null;[\s\S]*setSelectedPlanId: WorkspacePlanSelectionAction<string \| null>;[\s\S]*planCountdown: number;[\s\S]*setPlanCountdown: WorkspacePlanSelectionAction<number>;[\s\S]*planSelectionReady: boolean;[\s\S]*updatePlanFlowState: \(patch: WorkspacePlanFlowStatePatch\) => void;[\s\S]*applyWorkspaceState: \([\s\S]*nextMessages: WorkspaceChatMessage\[\],[\s\S]*options\?: WorkspacePlanFlowStateApplyOptions,[\s\S]*\) => void;[\s\S]*\};/,
  'workspace plan flow state should expose an explicit contract type for the StateManager plan flow boundary',
);
assert.match(
  workspacePlanFlowStateContractSource,
  /planAutoConfirmDeadlineAt: string \| null;[\s\S]*setPlanAutoConfirmDeadlineAt: WorkspacePlanSelectionAction<string \| null>;/,
  'workspace plan flow state contract should carry the absolute auto-confirm deadline to prevent refresh reset',
);
assert.match(
  workspaceSessionSnapshotContractSource,
  /export type WorkspaceSessionSnapshotContract = \{[\s\S]*readWorkspaceSessionSnapshot: \(projectId: string\) => WorkspaceSessionSnapshot \| null;[\s\S]*\};/,
  'workspace session snapshot should expose an explicit contract type for the StateManager snapshot boundary',
);
assert.match(
  workspacePageLocalStateContractSource,
  /export type WorkspacePageLocalStateSetter<T> = Dispatch<SetStateAction<T>>;[\s\S]*export type WorkspacePageLocalStateContract = \{[\s\S]*projectInfo: WorkspaceProjectInfo \| null;[\s\S]*setProjectInfo: WorkspacePageLocalStateSetter<WorkspaceProjectInfo \| null>;[\s\S]*input: string;[\s\S]*setInput: WorkspacePageLocalStateSetter<string>;[\s\S]*isGenerating: boolean;[\s\S]*setIsGenerating: WorkspacePageLocalStateSetter<boolean>;[\s\S]*chatMode: ChatMode;[\s\S]*setChatMode: WorkspacePageLocalStateSetter<ChatMode>;[\s\S]*chatAttachmentSnapshot: ChatAttachmentSnapshot;[\s\S]*chatModelRegistrySnapshot: ChatModelRegistrySnapshot;[\s\S]*activeTab: IDETab;[\s\S]*setActiveTab: WorkspacePageLocalStateSetter<IDETab>;[\s\S]*fileTree: FileNode\[\];[\s\S]*setFileTree: WorkspacePageLocalStateSetter<FileNode\[\]>;[\s\S]*explorerSnapshotStatus: ExplorerSnapshotStatus \| null;[\s\S]*gitBranches: GitBranch\[\];[\s\S]*gitRemoteBranches: GitRemoteBranch\[\];[\s\S]*gitWorktreeStatus: GitWorktreeStatus \| null;[\s\S]*gitBranchCompareTarget: string;[\s\S]*selectedCommit: GitCommit \| null;[\s\S]*textareaRef: RefObject<HTMLTextAreaElement \| null>;[\s\S]*requestedPlansRef: RefObject<WorkspacePlanGenerationProjectIdSet>;[\s\S]*plannedProjectIdsRef: RefObject<WorkspacePlanGenerationProjectIdSet>;[\s\S]*generationAbortRef: RefObject<AbortController \| null>;[\s\S]*planningAbortRef: RefObject<AbortController \| null>;[\s\S]*\};/,
  'workspace page local state should expose an explicit contract type for page StateManager local state boundaries',
);
assert.match(
  workspaceShellStateContractSource,
  /WorkspaceBrowserHistoryUrlList[\s\S]*export type WorkspaceShellStateSetter<T> = Dispatch<SetStateAction<T>>;[\s\S]*export type WorkspaceShellStateContract = \{[\s\S]*chatWidth: number;[\s\S]*setChatWidth: WorkspaceShellStateSetter<number>;[\s\S]*isResizing: boolean;[\s\S]*chatExpanded: boolean;[\s\S]*isChatAutoScrollEnabled: boolean;[\s\S]*chatScrollSnapshot: ChatScrollSnapshot;[\s\S]*browserUrl: string;[\s\S]*previewUrlStatus: PreviewUrlStatus \| null;[\s\S]*browserDevice: WorkspaceBrowserDevice;[\s\S]*isMobile: boolean;[\s\S]*mobileView: WorkspaceMobileView;[\s\S]*mobileEditingFile: string \| null;[\s\S]*mobileFileContent: string;[\s\S]*mobileBrowserUrl: string;[\s\S]*mobilePreviewUrlStatus: PreviewUrlStatus \| null;[\s\S]*browserHistory: WorkspaceBrowserHistoryUrlList;[\s\S]*setBrowserHistory: WorkspaceShellStateSetter<WorkspaceBrowserHistoryUrlList>;[\s\S]*historyIndex: number;[\s\S]*messagesEndRef: RefObject<HTMLDivElement \| null>;[\s\S]*desktopMessagesRef: RefObject<HTMLDivElement \| null>;[\s\S]*mobileMessagesRef: RefObject<HTMLDivElement \| null>;[\s\S]*chatPanelRef: RefObject<HTMLDivElement \| null>;[\s\S]*getActiveMessagesContainer: \(\) => HTMLDivElement \| null;[\s\S]*updateChatAutoScrollState: \(element: HTMLDivElement \| null\) => void;[\s\S]*handleMouseDown: \(event: ReactMouseEvent\) => void;[\s\S]*scrollToBottom: \(\) => void;[\s\S]*navigateTo: \(url: string\) => void;[\s\S]*goBrowserBack: \(\) => void;[\s\S]*goForward: \(\) => void;[\s\S]*\};/,
  'workspace shell state should expose an explicit contract type for page shell StateManager boundaries',
);
assert.doesNotMatch(
  workspaceShellStateContractSource,
  /browserHistory: string\[\]|setBrowserHistory: WorkspaceShellStateSetter<string\[\]>/,
  'workspace shell state browser history should not regress to anonymous string arrays',
);
assert.match(
  workspaceRuntimeResourcesContractSource,
  /export type WorkspaceFileTreeRefreshOptions = \{[\s\S]*throwOnFailure\?: boolean;[\s\S]*suppressNotice\?: boolean;[\s\S]*export type WorkspaceGitResourceRefreshOptions = \{[\s\S]*throwOnFailure\?: boolean;[\s\S]*suppressNotice\?: boolean;[\s\S]*export type WorkspaceRuntimeReadinessOptions = \{[\s\S]*initialStage\?: string;[\s\S]*waitStage\?: string;[\s\S]*export type WorkspaceRuntimeResourcesContract = \{[\s\S]*fetchProjectDetail: \(projectId: string\) => Promise<void>;[\s\S]*fetchProjectFileTree: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceFileTreeRefreshOptions,[\s\S]*\) => Promise<void>;[\s\S]*refreshProjectFileTree: \([\s\S]*projectId: string,[\s\S]*force\?: boolean,[\s\S]*options\?: WorkspaceFileTreeRefreshOptions,[\s\S]*\) => Promise<void>;[\s\S]*waitForProjectRuntimeReady: \(projectId: string\) => Promise<ProjectRuntimeStatus>;[\s\S]*ensureProjectRuntimeReady: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceRuntimeReadinessOptions,[\s\S]*\) => Promise<ProjectRuntimeStatus>;[\s\S]*fetchProjectBranches: \([\s\S]*projectId: string,[\s\S]*preferredTargetBranch\?: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitBranch\[\]>;[\s\S]*refreshProjectBranchCompareTarget: \([\s\S]*projectId: string,[\s\S]*targetBranch: string,[\s\S]*\) => Promise<GitBranchCompare \| null>;[\s\S]*fetchProjectRemotes: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitRemote\[\]>;[\s\S]*fetchProjectCommits: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitCommit\[\]>;[\s\S]*fetchProjectRemoteBranches: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitRemoteBranch\[\]>;[\s\S]*fetchProjectTags: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitTag\[\]>;[\s\S]*fetchProjectStashes: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitStash\[\]>;[\s\S]*fetchProjectWorktreeStatus: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitWorktreeStatus \| null>;[\s\S]*resetWorkspaceRuntimeBootstrapState: \(projectId: string\) => void;[\s\S]*\};/,
  'workspace runtime resources should expose an explicit contract type for runtime/resource StateManager boundaries',
);
assert.match(
  workspacePageProjectActionsContractSource,
  /import type \{ FileNode, FileNodeType, GitCommit \} from '@\/lib\/types';[\s\S]*export type WorkspacePageProjectActionsContract = \{[\s\S]*saveFile: \(filePath: string, content: string\) => Promise<boolean>;[\s\S]*handleViewCommit: \(commit: GitCommit\) => Promise<void>;[\s\S]*handleRestoreCommit: \(commit: GitCommit\) => void;[\s\S]*handleRestoreCommitFile: \(commit: GitCommit, filePath: string\) => Promise<void>;[\s\S]*handleCommitWorktree: \(message: string\) => Promise<void>;[\s\S]*handleDiscardWorktreeFile: \(filePath: string\) => Promise<void>;[\s\S]*handleApplyGitBranchCompareFile: \(baseBranch: string, headBranch: string, filePath: string\) => Promise<void>;[\s\S]*handleApplyGitStash: \(stashRef: string\) => Promise<void>;[\s\S]*handleCreateGitBranch: \(branchName: string\) => Promise<void>;[\s\S]*handleCreateGitTag: \(tagName: string\) => Promise<void>;[\s\S]*handleDeleteGitTag: \(tagName: string\) => Promise<void>;[\s\S]*handleCreateGitBranchFromRemote: \(remoteBranch: string, branchName: string\) => Promise<void>;[\s\S]*handleRefreshGitRemoteBranches: \(remoteName: string\) => Promise<void>;[\s\S]*handleDeleteGitBranch: \(branchName: string\) => Promise<void>;[\s\S]*handleRenameGitBranch: \(previousName: string, nextName: string\) => Promise<void>;[\s\S]*handleSwitchGitBranch: \(targetBranch: string\) => Promise<void>;[\s\S]*confirmRestoreCommit: \(\) => Promise<void>;[\s\S]*reflectFilePathInTree: \(path: string, leafType\?: FileNodeType\) => void;[\s\S]*applyIncrementalWorkflowStep: \(step: WorkflowStep\) => void;[\s\S]*openWorkspaceFile: \(target: string \| WorkspaceEditorNavigationTarget\) => Promise<void>;[\s\S]*handleExplorerContextOperation: \([\s\S]*operation: WorkspaceExplorerContextOperation,[\s\S]*node: FileNode \| null,[\s\S]*input\?: WorkspaceExplorerContextOperationInput,[\s\S]*\) => Promise<void>;[\s\S]*refreshExplorerPanel: \(\) => Promise<void>;[\s\S]*refreshGitPanel: \(\) => Promise<void>;[\s\S]*mobileFileContent: string;[\s\S]*setMobileFileContent: Dispatch<SetStateAction<string>>;[\s\S]*\};/,
  'workspace page project actions should expose an explicit contract type for IDE/resource project action boundaries',
);
assert.match(
  workspaceResourceOperationsContractSource,
  /import type \{ GitCommit \} from '@\/lib\/types';[\s\S]*export type WorkspaceResourceOperationsContract = \{[\s\S]*saveFile: \(filePath: string, content: string\) => Promise<boolean>;[\s\S]*handleViewCommit: \(commit: GitCommit\) => Promise<void>;[\s\S]*handleRestoreCommit: \(commit: GitCommit\) => void;[\s\S]*handleRestoreCommitFile: \(commit: GitCommit, filePath: string\) => Promise<void>;[\s\S]*handleCommitWorktree: \(message: string\) => Promise<void>;[\s\S]*handleDiscardWorktreeFile: \(filePath: string\) => Promise<void>;[\s\S]*handleApplyGitBranchCompareFile: \([\s\S]*baseBranch: string,[\s\S]*headBranch: string,[\s\S]*filePath: string,[\s\S]*\) => Promise<void>;[\s\S]*handleApplyGitStash: \(stashRef: string\) => Promise<void>;[\s\S]*handleCreateGitBranch: \(branchName: string\) => Promise<void>;[\s\S]*handleCreateGitTag: \(tagName: string\) => Promise<void>;[\s\S]*handleDeleteGitTag: \(tagName: string\) => Promise<void>;[\s\S]*handleCreateGitBranchFromRemote: \([\s\S]*remoteBranch: string,[\s\S]*branchName: string,[\s\S]*\) => Promise<void>;[\s\S]*handleRefreshGitRemoteBranches: \(remoteName: string\) => Promise<void>;[\s\S]*handleDeleteGitBranch: \(branchName: string\) => Promise<void>;[\s\S]*handleRenameGitBranch: \([\s\S]*previousName: string,[\s\S]*nextName: string,[\s\S]*\) => Promise<void>;[\s\S]*handleSwitchGitBranch: \(targetBranch: string\) => Promise<void>;[\s\S]*confirmRestoreCommit: \(\) => Promise<void>;[\s\S]*\};/,
  'workspace resource operations should expose an explicit contract type for file and Git resource action boundaries',
);
assert.match(
  workspaceOrchestrationActionsContractSource,
  /export type WorkspacePlanImplementationActionContract = \([\s\S]*plan: Plan,[\s\S]*options\?: ChoosePlanOptions,[\s\S]*\) => Promise<void>;[\s\S]*export type WorkspaceImplementationGenerationActionContract = \([\s\S]*prompt: string,[\s\S]*targetProject\?: WorkspaceProjectInfo,[\s\S]*options\?: GenerateOptions,[\s\S]*\) => Promise<void>;[\s\S]*export type WorkspaceOrchestrationActionsContract = \{[\s\S]*choosePlanAndImplement: WorkspacePlanImplementationActionContract;[\s\S]*handleLLMGenerate: WorkspaceImplementationGenerationActionContract;[\s\S]*buildPlanDiscussionPrompt: \(question: string\) => string;[\s\S]*requestPlansForProject: \(options\?: PlanRequestOptions\) => Promise<void>;[\s\S]*\};/,
  'workspace orchestration actions should expose an explicit contract type for plan and implementation orchestration boundaries',
);
assert.match(
  orchestrationActionTypesSource,
  /import type \{ Dispatch, MutableRefObject, SetStateAction \} from 'react';[\s\S]*import type \{ WorkflowStep \} from '@\/components\/workspace\/chat-message-content';[\s\S]*WorkspaceEventMessageResolver,[\s\S]*WorkspaceSuggestedActionsEventReader,[\s\S]*WorkspaceSuggestedQuestionsEventReader,[\s\S]*import type \{[\s\S]*WorkspaceImplementationGenerationActionContract,[\s\S]*WorkspacePlanImplementationActionContract,[\s\S]*\} from '\.\/workspace-orchestration-actions-contract';[\s\S]*NormalizeWorkflowStep,[\s\S]*ResolveStepEngineeringState,[\s\S]*SafeParseJSON,[\s\S]*PlanRequestOptions,[\s\S]*WorkspacePlanGenerationProjectIdSet,[\s\S]*WorkspacePlanGenerationProjectIdSetRef,[\s\S]*ApplyWorkspaceState[\s\S]*export type SharedActionOptions = \{[\s\S]*initializedProjectIdRef: MutableRefObject<string \| null>;[\s\S]*projectInfo: WorkspaceProjectInfo \| null;[\s\S]*setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo \| null>>;[\s\S]*applyOrchestrationSharedMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*\};[\s\S]*export type SharedActions = \{[\s\S]*createPersistedProject: \(plan: Plan\) => Promise<WorkspaceProjectInfo>;[\s\S]*persistWorkspaceProject: \(nextProject: WorkspaceProjectInfo\) => void;[\s\S]*resolveStepEngineeringState: ResolveStepEngineeringState;[\s\S]*\};[\s\S]*export type WorkspaceOrchestrationSharedActionsContract =[\s\S]*SharedActions;[\s\S]*export type WorkspaceOrchestrationPlanningEngineeringActions = \{[\s\S]*resolveStepEngineeringState: ResolveStepEngineeringState;[\s\S]*\};[\s\S]*export type ImplementationActions = \{[\s\S]*choosePlanAndImplement: WorkspacePlanImplementationActionContract;[\s\S]*handleLLMGenerate: WorkspaceImplementationGenerationActionContract;[\s\S]*\};[\s\S]*export type WorkspaceOrchestrationImplementationActionsContract =[\s\S]*ImplementationActions;[\s\S]*export type PlanningActionOptions =[\s\S]*WorkspaceOrchestrationPlanningEngineeringActions[\s\S]*& \{[\s\S]*projectInfo: WorkspaceProjectInfo \| null;[\s\S]*availablePlans: Plan\[\];[\s\S]*recommendedPlanId: string \| null;[\s\S]*requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;[\s\S]*plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;[\s\S]*messagesRef: MutableRefObject<WorkspaceChatMessage\[\]>;[\s\S]*planningAbortRef: MutableRefObject<AbortController \| null>;[\s\S]*planningProjectIdRef: MutableRefObject<string \| null>;[\s\S]*autoPlanTriggeredRef: MutableRefObject<boolean>;[\s\S]*requestedPlansRef: WorkspacePlanGenerationProjectIdSetRef;[\s\S]*plannedProjectIdsRef: WorkspacePlanGenerationProjectIdSetRef;[\s\S]*applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*setIsPlanning: Dispatch<SetStateAction<boolean>>;[\s\S]*applyWorkspaceState: ApplyWorkspaceState;[\s\S]*applyWorkflowStepToMessage: \(messageId: string, step: WorkflowStep\) => void;[\s\S]*applyPlanStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*safeParseJSON: SafeParseJSON;[\s\S]*appendReasoningChunk: \(current: string, nextChunk: string\) => string;[\s\S]*appendReasoningLine: \(current: string, nextLine: string\) => string;[\s\S]*normalizeWorkflowStep: NormalizeWorkflowStep;[\s\S]*getEventMessage: WorkspaceEventMessageResolver;[\s\S]*getSuggestedQuestionsFromEvent: WorkspaceSuggestedQuestionsEventReader;[\s\S]*getSuggestedActionsFromEvent: WorkspaceSuggestedActionsEventReader;[\s\S]*enrichPlanMessageGuidance: \(message: WorkspaceChatMessage\) => WorkspaceChatMessage;[\s\S]*supersedePlanSelectionMessages: \(messages: WorkspaceChatMessage\[\]\) => WorkspaceChatMessage\[\];[\s\S]*\};[\s\S]*export type PlanningActions = \{[\s\S]*buildPlanDiscussionPrompt: \(question: string\) => string;[\s\S]*requestPlansForProject: \(options\?: PlanRequestOptions\) => Promise<void>;[\s\S]*\};[\s\S]*export type WorkspaceOrchestrationPlanningActionsContract =[\s\S]*PlanningActions;/,
  'workspace orchestration child action return contracts should be derived from the core orchestration actions contract',
);
assert.doesNotMatch(
  orchestrationActionTypesSource,
  /export type PlanningActionOptions = Pick<[\s\S]*UseWorkspaceOrchestrationOptions/,
  'workspace orchestration planning action options should not regress to a Pick-derived orchestration options slice',
);
assert.doesNotMatch(
  orchestrationActionTypesSource,
  /export type (ImplementationActions|PlanningActions) = Pick<[\s\S]*WorkspaceOrchestrationActionsContract/,
  'workspace orchestration child action return contracts should not regress to Pick-derived orchestration action slices',
);
assert.doesNotMatch(
  orchestrationActionTypesSource,
  /export type SharedActionOptions = Pick<[\s\S]*UseWorkspaceOrchestrationOptions/,
  'workspace orchestration shared action input should not regress to a Pick-derived orchestration options slice',
);
assert.doesNotMatch(
  orchestrationActionTypesSource,
  /Pick<SharedActions, 'resolveStepEngineeringState'>/,
  'workspace orchestration planning engineering input should not regress to a Pick-derived shared action slice',
);
assert.match(
  orchestrationSharedActionsSource,
  /import type \{[\s\S]*SharedActionOptions,[\s\S]*WorkspaceOrchestrationSharedActionsContract,[\s\S]*\} from '\.\/workspace-orchestration-action-types';[\s\S]*\}: SharedActionOptions\): WorkspaceOrchestrationSharedActionsContract \{[\s\S]*return \{[\s\S]*createPersistedProject,[\s\S]*persistWorkspaceProject,[\s\S]*resolveStepEngineeringState,/,
  'workspace orchestration shared actions hook should return the explicit shared actions contract',
);
assert.match(
  orchestrationImplementationActionsSource,
  /import type \{[\s\S]*ImplementationActionOptions,[\s\S]*WorkspaceOrchestrationImplementationActionsContract,[\s\S]*\} from '\.\/workspace-orchestration-action-types';[\s\S]*export function useWorkspaceOrchestrationImplementationActions\([\s\S]*\): WorkspaceOrchestrationImplementationActionsContract \{/,
  'workspace orchestration implementation action hook should return the explicit implementation actions contract',
);
assert.match(
  orchestrationPlanningActionsSource,
  /import type \{[\s\S]*PlanningActionOptions,[\s\S]*WorkspaceOrchestrationPlanningActionsContract,[\s\S]*\} from '\.\/workspace-orchestration-action-types';[\s\S]*function hasWorkspaceOrchestrationPlanningProjectInfo\([\s\S]*projectInfo: WorkspaceProjectInfo \| null,[\s\S]*\): projectInfo is WorkspaceProjectInfo[\s\S]*return projectInfo !== null;[\s\S]*export function useWorkspaceOrchestrationPlanningActions\([\s\S]*\): WorkspaceOrchestrationPlanningActionsContract \{/,
  'workspace orchestration planning action hook should return the explicit planning actions contract',
);
assert.match(
  workspacePageOrchestrationActionsContractSource,
  /import type \{ WorkspaceOrchestrationActionsContract \} from '\.\/workspace-orchestration-actions-contract';[\s\S]*export type WorkspacePageOrchestrationActionsContract = WorkspaceOrchestrationActionsContract;/,
  'workspace page orchestration actions contract should reuse the core orchestration actions contract',
);
assert.match(
  workspacePromptActionsContractSource,
  /import type \{ GuidanceAction \} from '\.\/workspace-types';[\s\S]*export type WorkspaceFoundationDecisionConfirmation = \{[\s\S]*id\?: string;[\s\S]*title\?: string;[\s\S]*bucket\?: string;[\s\S]*selectedOption\?: string;[\s\S]*notes\?: string;[\s\S]*\};[\s\S]*export type WorkspacePromptActionsContract = \{[\s\S]*submitPrompt: \(rawPrompt: string\) => Promise<void>;[\s\S]*handleGenerate: \(\) => Promise<void>;[\s\S]*handleSuggestedQuestion: \(question: string\) => Promise<void>;[\s\S]*handleSuggestedAction: \(action: GuidanceAction\) => Promise<void>;[\s\S]*handleStartFoundation: \(\) => Promise<void>;[\s\S]*handleConfirmFoundationDecisions: \([\s\S]*decisions: WorkspaceFoundationDecisionConfirmation\[\],[\s\S]*\) => Promise<void>;[\s\S]*foundationActionLabel: string;[\s\S]*foundationStatusLabel: string;[\s\S]*\};/,
  'workspace prompt actions should expose an explicit contract type for prompt interaction and foundation action boundaries without Pick inference',
);
assert.doesNotMatch(
  workspacePromptActionsContractSource,
  /Pick<[\s\S]*WorkspaceBootstrapDecisionItem/,
  'workspace foundation decision confirmation should not regress to a Pick-derived bootstrap decision item slice',
);
assert.match(
  workspacePageConversationActionsContractSource,
  /import type \{ WorkspaceFoundationDecisionConfirmation \} from '\.\/workspace-prompt-actions-contract';[\s\S]*import type \{ GuidanceAction \} from '\.\/workspace-types';[\s\S]*export type WorkspacePageConversationActionsContract = \{[\s\S]*handleGenerate: \(\) => Promise<void>;[\s\S]*handleSuggestedQuestion: \(question: string\) => Promise<void>;[\s\S]*handleSuggestedAction: \(action: GuidanceAction\) => Promise<void>;[\s\S]*handleStartFoundation: \(\) => Promise<void>;[\s\S]*handleConfirmFoundationDecisions: \([\s\S]*decisions: WorkspaceFoundationDecisionConfirmation\[\],[\s\S]*\) => Promise<void>;[\s\S]*foundationActionLabel: string;[\s\S]*foundationStatusLabel: string;[\s\S]*handleStopGenerate: \(\) => void;[\s\S]*handleCancelStopGenerate: \(\) => void;[\s\S]*\};/,
  'workspace page conversation actions should expose an explicit prompt interaction and stop-confirmation contract without Pick inference',
);
assert.doesNotMatch(
  workspacePageConversationActionsContractSource,
  /Pick<[\s\S]*WorkspacePromptActionsContract/,
  'workspace page conversation actions contract should not regress to a Pick-derived prompt action slice',
);
assert.match(
  workspacePageAiActionsContractSource,
  /import type \{ WorkspacePageConversationActionsContract \} from '\.\/workspace-page-conversation-actions-contract';[\s\S]*import type \{ WorkspacePlanImplementationActionContract \} from '\.\/workspace-orchestration-actions-contract';[\s\S]*import type \{ PlanRequestOptions \} from '\.\/workspace-orchestration-hook-types';[\s\S]*export type WorkspacePageAiActionsContract =[\s\S]*WorkspacePageConversationActionsContract[\s\S]*& \{[\s\S]*choosePlanAndImplement: WorkspacePlanImplementationActionContract;[\s\S]*requestPlansForProject: \(options\?: PlanRequestOptions\) => Promise<void>;[\s\S]*\};/,
  'workspace page AI actions should expose explicit conversation, plan implementation and plan request contracts without Pick inference',
);
assert.doesNotMatch(
  workspacePageAiActionsContractSource,
  /Pick<WorkspacePageOrchestrationActionsContract, 'choosePlanAndImplement'>|WorkspacePageOrchestrationActionsContract/,
  'workspace page AI actions contract should not regress to a Pick-derived orchestration action slice',
);
assert.match(
  workspacePageActionControllersContractSource,
  /import type \{ GitCommit \} from '@\/lib\/types';[\s\S]*import type \{ WorkspacePageAiActionsContract \} from '\.\/workspace-page-ai-actions-contract';[\s\S]*import type \{ WorkspacePageLocalStateSetter \} from '\.\/workspace-page-local-state-contract';[\s\S]*import type \{ WorkspacePageProjectActionsContract \} from '\.\/workspace-page-project-actions-contract';[\s\S]*import type \{ WorkspaceOpenFilePathList \} from '\.\/workspace-types';[\s\S]*export type WorkspacePageActionControllersContract =[\s\S]*WorkspacePageProjectActionsContract[\s\S]*& WorkspacePageAiActionsContract[\s\S]*& \{[\s\S]*pendingCloseFile: string \| null;[\s\S]*setPendingCloseFile: WorkspacePageLocalStateSetter<string \| null>;[\s\S]*gitCommits: GitCommit\[\];[\s\S]*openFiles: WorkspaceOpenFilePathList;[\s\S]*handleSelectGitBranchCompareTarget: \(targetBranch: string\) => Promise<void>;[\s\S]*handleRecoverRuntime: \(\) => Promise<void>;[\s\S]*\};/,
  'workspace page action controllers should expose an explicit project, AI and local state aggregation contract without Pick inference',
);
assert.doesNotMatch(
  workspacePageActionControllersContractSource,
  /Pick<[\s\S]*WorkspacePageLocalStateContract/,
  'workspace page action controllers contract should not regress to a Pick-derived local state slice',
);
assert.match(
  workspacePageViewControllersContractSource,
  /import type \{ ReactNode \} from 'react';[\s\S]*export type WorkspacePageViewControllersContract = \{[\s\S]*desktopChatPanel: ReactNode;[\s\S]*mobileChatPanel: ReactNode;[\s\S]*desktopIdePanel: ReactNode;[\s\S]*mobileIdePanel: ReactNode;[\s\S]*savePendingCloseFile: \(\) => Promise<void>;[\s\S]*quoteToChat: \(path: string\) => void;[\s\S]*clearChat: \(\) => void;[\s\S]*copyToClipboard: \(text: string\) => Promise<void>;[\s\S]*exportProject: \(\) => void;[\s\S]*\};/,
  'workspace page view controllers should expose an explicit contract type for rendered panels and view UI actions',
);
assert.match(
  workspacePageControllersContractSource,
  /import type \{ ReactNode \} from 'react';[\s\S]*import type \{ FileNode \} from '@\/lib\/types';[\s\S]*WorkspaceExplorerContextOperation,[\s\S]*WorkspaceExplorerContextOperationInput,[\s\S]*export type WorkspacePageControllersContract = \{[\s\S]*desktopChatPanel: ReactNode;[\s\S]*mobileChatPanel: ReactNode;[\s\S]*desktopIdePanel: ReactNode;[\s\S]*mobileIdePanel: ReactNode;[\s\S]*savePendingCloseFile: \(\) => Promise<void>;[\s\S]*quoteToChat: \(path: string\) => void;[\s\S]*clearChat: \(\) => void;[\s\S]*copyToClipboard: \(text: string\) => Promise<void>;[\s\S]*downloadFile: \(path: string, content: string\) => void;[\s\S]*closeWorkspaceFile: \(path: string, discardChanges\?: boolean\) => void;[\s\S]*isFileDirty: \(path: string \| null\) => boolean;[\s\S]*handleExplorerContextOperation: \([\s\S]*operation: WorkspaceExplorerContextOperation,[\s\S]*node: FileNode \| null,[\s\S]*input\?: WorkspaceExplorerContextOperationInput,[\s\S]*\) => Promise<void>;[\s\S]*confirmRestoreCommit: \(\) => Promise<void>;[\s\S]*\};/,
  'workspace page controllers should expose an explicit contract for the page controller aggregation surface without Pick inference',
);
assert.doesNotMatch(
  workspacePageControllersContractSource,
  /Pick<[\s\S]*WorkspacePage(View|Action)ControllersContract/,
  'workspace page controllers contract should not regress to Pick-derived view/action controller slices',
);
assert.match(
  workspacePageFoundationContractSource,
  /import type \{ WorkspaceFlowStateContract \} from '\.\/workspace-flow-state-contract';[\s\S]*import type \{ WorkspacePageLocalStateContract \} from '\.\/workspace-page-local-state-contract';[\s\S]*import type \{ WorkspaceRuntimeResourcesContract \} from '\.\/workspace-runtime-resources-contract';[\s\S]*import type \{ WorkspaceShellStateContract \} from '\.\/workspace-shell-state-contract';[\s\S]*import type \{ WorkspaceProjectBootstrapMessageRestoreStatus \} from '\.\/workspace-types';[\s\S]*export type WorkspacePageFoundationContract = \{[\s\S]*localState: WorkspacePageLocalStateContract;[\s\S]*flowState: WorkspaceFlowStateContract;[\s\S]*shellState: WorkspaceShellStateContract;[\s\S]*runtimeResources: WorkspaceRuntimeResourcesContract;[\s\S]*isRestoringWorkspace: boolean;[\s\S]*messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;[\s\S]*\};/,
  'workspace page foundation should expose an explicit contract for local, flow, shell and runtime foundation state',
);
assert.match(
  workspacePageCompositionContractSource,
  /import type \{ WorkspacePageControllersContract \} from '\.\/workspace-page-controllers-contract';[\s\S]*import type \{ WorkspacePageLocalStateContract \} from '\.\/workspace-page-local-state-contract';[\s\S]*import type \{ WorkspaceShellStateContract \} from '\.\/workspace-shell-state-contract';[\s\S]*import type \{ WorkspaceProjectBootstrapMessageRestoreStatus \} from '\.\/workspace-types';[\s\S]*export type WorkspacePageCompositionContract =[\s\S]*WorkspacePageLocalStateContract[\s\S]*& WorkspaceShellStateContract[\s\S]*& WorkspacePageControllersContract[\s\S]*& \{[\s\S]*isRestoringWorkspace: boolean;[\s\S]*messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;[\s\S]*\};/,
  'workspace page composition should expose an explicit contract derived from local, shell and page controllers contracts',
);
assert.match(
  workspacePageShellContractSource,
  /import type \{ PersistGenerationState \} from '\.\/workspace-types';[\s\S]*export type WorkspacePageShellContract = \{[\s\S]*hasMounted: boolean;[\s\S]*goBack: \(\) => void;[\s\S]*replaceHome: \(\) => void;[\s\S]*persistGenerationState: PersistGenerationState;[\s\S]*\};/,
  'workspace page shell should expose an explicit contract for mount, navigation and generation state persistence actions',
);
assert.match(
  workspacePageContainerContractSource,
  /import type \{ WorkspacePageCompositionContract \} from '\.\/workspace-page-composition-contract';[\s\S]*export type WorkspacePageContainerContract =[\s\S]*WorkspacePageCompositionContract[\s\S]*& \{[\s\S]*hasMounted: boolean;[\s\S]*goBack: \(\) => void;[\s\S]*authLoading: boolean;[\s\S]*isAuthenticated: boolean;[\s\S]*projectIdParam: string \| null;[\s\S]*projectParam: string \| null;[\s\S]*\};/,
  'workspace page container should expose an explicit contract for composition, mount, navigation, auth and route params without Pick inference',
);
assert.doesNotMatch(
  workspacePageContainerContractSource,
  /Pick<WorkspacePageShellContract, 'hasMounted' \| 'goBack'>|WorkspacePageShellContract/,
  'workspace page container contract should not regress to a Pick-derived shell contract slice',
);
assert.match(
  workspacePageUiContractSource,
  /import type \{[\s\S]*ChangeEvent,[\s\S]*KeyboardEvent as ReactKeyboardEvent,[\s\S]*ReactNode,[\s\S]*\} from 'react';[\s\S]*export type WorkspacePageUiModel = \{[\s\S]*id: string;[\s\S]*name: string;[\s\S]*providerId: string;[\s\S]*providerName: string;[\s\S]*modelName: string;[\s\S]*\};[\s\S]*export type WorkspacePageUiContract = \{[\s\S]*adjustTextareaHeight: \(value\?: string\) => void;[\s\S]*handleKeyDown: \(event: ReactKeyboardEvent<HTMLTextAreaElement>\) => void;[\s\S]*copyToClipboard: \(text: string\) => Promise<void>;[\s\S]*exportProject: \(\) => void;[\s\S]*quoteToChat: \(path: string\) => void;[\s\S]*clearChat: \(\) => void;[\s\S]*handleFileUpload: \(event: ChangeEvent<HTMLInputElement>\) => void;[\s\S]*removeAttachment: \(index: number\) => void;[\s\S]*filteredTree: FileNode\[\];[\s\S]*hasOriginalFileTreeData: boolean;[\s\S]*explorerSnapshotStatus: ExplorerSnapshotStatus \| null;[\s\S]*models: WorkspacePageUiModel\[\];[\s\S]*runtimeEnabled: boolean;[\s\S]*tabs: WorkspacePageUiTab\[\];[\s\S]*previewDeviceStyle: WorkspacePageUiPreviewDeviceStyle;[\s\S]*\};/,
  'workspace page UI should expose an explicit contract for UI actions, filtered tree, models, tabs and preview style',
);
assert.match(
  workspacePageContentContractSource,
  /import type \{ ReactNode \} from 'react';[\s\S]*export type WorkspacePageContentContract = \{[\s\S]*desktopChatPanel: ReactNode;[\s\S]*mobileChatPanel: ReactNode;[\s\S]*desktopIdePanel: ReactNode;[\s\S]*mobileIdePanel: ReactNode;[\s\S]*savePendingCloseFile: \(\) => Promise<void>;[\s\S]*\};/,
  'workspace page content should expose an explicit contract for rendered panels and close-save action without Pick inference',
);
assert.doesNotMatch(
  workspacePageContentContractSource,
  /Pick<[\s\S]*WorkspacePageViewControllersContract/,
  'workspace page content contract should not regress to a Pick-derived view controller slice',
);
assert.match(
  orchestrationActionsSource,
  /import type \{ WorkspaceOrchestrationActionsContract \} from '\.\/workspace-orchestration-actions-contract';[\s\S]*export function useWorkspaceOrchestrationActions\([\s\S]*options: UseWorkspaceOrchestrationOptions,[\s\S]*\): WorkspaceOrchestrationActionsContract \{/,
  'workspace orchestration action hook should return the explicit orchestration actions contract',
);
assert.match(
  orchestrationHookSource,
  /import type \{ WorkspaceOrchestrationActionsContract \} from '\.\/workspace-orchestration-actions-contract';[\s\S]*export function useWorkspaceOrchestration\([\s\S]*\): WorkspaceOrchestrationActionsContract \{[\s\S]*return useWorkspaceOrchestrationActions\(options\);/,
  'workspace orchestration hook should return the explicit orchestration actions contract',
);
assert.match(
  flowStateSource,
  /import type \{ WorkspaceFlowStateContract \} from '\.\/workspace-flow-state-contract';[\s\S]*import \{ useWorkspaceFlowRefs \} from '\.\/use-workspace-flow-refs';[\s\S]*import \{ useWorkspaceMessageDispatch \} from '\.\/use-workspace-message-dispatch';[\s\S]*export function useWorkspaceFlowState\([\s\S]*\): WorkspaceFlowStateContract \{[\s\S]*const messageDispatch = useWorkspaceMessageDispatch\(\);/,
  'workspace flow state should compose the dedicated message dispatch hook instead of owning reducer wiring or message state imports directly',
);
assert.match(
  localStateSource,
  /import type \{[\s\S]*WorkspacePageLocalStateContract,[\s\S]*\} from '\.\/workspace-page-local-state-contract';[\s\S]*export function useWorkspacePageLocalState\(\): WorkspacePageLocalStateContract \{/,
  'workspace page local state hook should return the explicit page local state contract instead of inferred hook implementation shape',
);
assert.match(
  shellStateSource,
  /import type \{ WorkspaceShellStateContract \} from '\.\/workspace-shell-state-contract';[\s\S]*export function useWorkspaceShellState\(\{[\s\S]*messagesLength,[\s\S]*\}: UseWorkspaceShellStateOptions\): WorkspaceShellStateContract \{/,
  'workspace shell state hook should return the explicit shell state contract instead of inferred hook implementation shape',
);
assert.match(
  runtimeResourcesSource,
  /import type \{[\s\S]*WorkspaceRuntimeResourcesContract,[\s\S]*\} from '\.\/workspace-runtime-resources-contract';[\s\S]*export function useWorkspaceRuntimeResources\(\{[\s\S]*setSelectedCommit,[\s\S]*\}: UseWorkspaceRuntimeResourcesOptions\): WorkspaceRuntimeResourcesContract \{/,
  'workspace runtime resources hook should return the explicit runtime resources contract instead of inferred hook implementation shape',
);
assert.match(
  pageProjectActionsSource,
  /import type \{ WorkspacePageProjectActionsContract \} from '\.\/workspace-page-project-actions-contract';[\s\S]*export function useWorkspacePageProjectActions\(\{[\s\S]*runtimeResources,[\s\S]*\}: UseWorkspacePageProjectActionsOptions\): WorkspacePageProjectActionsContract \{/,
  'workspace page project actions hook should return the explicit project actions contract instead of inferred hook implementation shape',
);
assert.match(
  pageProjectActionsSource,
  /export type WorkspacePageProjectActionsFlowState = \{[\s\S]*applyProjectPanelRefreshMessages: WorkspaceProjectPanelRefreshMessagesAction;[\s\S]*applyIdeInteractionMessages: WorkspaceMessageListAction;[\s\S]*applyResourceFileMessages: WorkspaceMessageListAction;[\s\S]*applyResourceGitMessages: WorkspaceMessageListAction;[\s\S]*\};[\s\S]*export type WorkspacePageProjectActionsShellState = \{[\s\S]*isMobile: boolean;[\s\S]*mobileEditingFile: string \| null;[\s\S]*setMobileEditingFile: WorkspaceShellStateSetter<string \| null>;[\s\S]*mobileFileContent: string;[\s\S]*setMobileFileContent: WorkspaceShellStateSetter<string>;[\s\S]*setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>;[\s\S]*\};[\s\S]*export type WorkspacePageProjectActionsRuntimeResources = \{[\s\S]*fetchProjectDetail: \(projectId: string\) => Promise<void>;[\s\S]*refreshProjectFileTree: \([\s\S]*projectId: string,[\s\S]*force\?: boolean,[\s\S]*options\?: WorkspaceFileTreeRefreshOptions,[\s\S]*\) => Promise<void>;[\s\S]*fetchProjectBranches: \([\s\S]*projectId: string,[\s\S]*preferredTargetBranch\?: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitBranch\[\]>;[\s\S]*fetchProjectRemotes: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitRemote\[\]>;[\s\S]*fetchProjectRemoteBranches: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitRemoteBranch\[\]>;[\s\S]*fetchProjectTags: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitTag\[\]>;[\s\S]*fetchProjectStashes: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitStash\[\]>;[\s\S]*fetchProjectWorktreeStatus: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitWorktreeStatus \| null>;[\s\S]*fetchProjectCommits: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitCommit\[\]>;[\s\S]*\};[\s\S]*flowState: WorkspacePageProjectActionsFlowState;[\s\S]*shellState: WorkspacePageProjectActionsShellState;[\s\S]*runtimeResources: WorkspacePageProjectActionsRuntimeResources;/,
  'workspace page project actions should expose named flow, shell and runtime input contracts',
);
assert.doesNotMatch(
  pageProjectActionsSource,
  /type (FlowState|ShellState|RuntimeResources) = Pick<|Pick<Workspace(FlowState|ShellState|RuntimeResources)Contract/,
  'workspace page project actions inputs should not regress to Pick-derived flow, shell or runtime slices',
);
assert.doesNotMatch(
  pageProjectActionsSource,
  /if \(isMobile\)/,
  'workspace page project actions should not regress mobile IDE view switching to a direct isMobile gate',
);
assert.match(
  pageProjectActionsSource,
  /function shouldUseWorkspacePageProjectActionMobileIdeView\(isMobile: boolean\): boolean[\s\S]*const shouldUseMobileIdeView = isMobile === true;[\s\S]*return shouldUseMobileIdeView === true;[\s\S]*function applyWorkspacePageProjectActionMobileIdeView\([\s\S]*isMobile: boolean,[\s\S]*setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>,[\s\S]*\)[\s\S]*const shouldUseMobileIdeView = shouldUseWorkspacePageProjectActionMobileIdeView\(isMobile\);[\s\S]*if \(shouldUseMobileIdeView === true\)[\s\S]*setMobileView\('ide'\);[\s\S]*function hasWorkspacePageProjectActionTextValue\(value: string \| null \| undefined\): value is string \{[\s\S]*if \(value === null \|\| value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;[\s\S]*function materializeWorkspacePageProjectActionRejectedResults\([\s\S]*results: PromiseSettledResult<unknown>\[\],[\s\S]*\): PromiseRejectedResult\[\] \{[\s\S]*for \(const result of results\)[\s\S]*const isRejectedResult = result\.status === 'rejected';[\s\S]*rejectedResults\.push\(result\);[\s\S]*function getWorkspacePageProjectActionPersistedProject\(projectInfo: WorkspaceProjectInfo \| null\): WorkspaceProjectInfo \| null \{[\s\S]*const isPersistedProject = projectInfo\.isPersisted === true;[\s\S]*const hasProjectId = hasWorkspacePageProjectActionTextValue\(projectInfo\.projectId\);[\s\S]*function getWorkspacePageProjectActionFallbackMessage\(value: string \| null \| undefined, fallback: string\): string \{[\s\S]*function getWorkspacePageProjectActionFailureMessages\(failures: PromiseRejectedResult\[\]\): WorkspacePageProjectActionFailureMessageList \{[\s\S]*for \(const failure of failures\)[\s\S]*const hasFailureMessage = hasWorkspacePageProjectActionTextValue\(failureMessage\);[\s\S]*failureMessages\.push\(failureMessage\);[\s\S]*function getWorkspacePageProjectActionFailureMessage\(failures: PromiseRejectedResult\[\]\): string \{[\s\S]*return getWorkspacePageProjectActionFallbackMessage\(joinedFailureMessage, '未知错误'\);/,
  'page project actions should derive mobile IDE view, manual refresh project and failure message facts through named helpers',
);
assert.match(
  refreshExplorerPanelSource,
  /const persistedProject = getWorkspacePageProjectActionPersistedProject\(projectInfo\);[\s\S]*if \(persistedProject === null\)[\s\S]*const projectId = persistedProject\.projectId;[\s\S]*await refreshProjectFileTree\(projectId, true,/,
  'Explorer manual refresh should use a validated persisted project before refreshing file tree truth source',
);
assert.match(
  refreshGitPanelSource,
  /const persistedProject = getWorkspacePageProjectActionPersistedProject\(projectInfo\);[\s\S]*if \(persistedProject === null\)[\s\S]*const projectId = persistedProject\.projectId;[\s\S]*fetchProjectWorktreeStatus\(projectId, refreshOptions\)[\s\S]*fetchProjectBranches\(projectId, undefined, refreshOptions\)[\s\S]*fetchProjectCommits\(projectId, refreshOptions\)[\s\S]*const failures = materializeWorkspacePageProjectActionRejectedResults\(results\);[\s\S]*if \(failures\.length === 0\)[\s\S]*return;/,
  'Git manual refresh should use a validated persisted project and refresh Git truth sources without reporting non-AI chat messages',
);
assert.doesNotMatch(
  refreshGitPanelSource,
  /appendProjectPanelRefreshMessage|git-panel-refresh-|Git 面板已重新刷新|Git 面板重新刷新存在失败资源/,
  'Git manual refresh should not write non-AI refresh results into the chat window',
);
assert.doesNotMatch(
  refreshExplorerPanelSource + refreshGitPanelSource,
  /if \(!projectInfo\?\.projectId \|\| !projectInfo\.isPersisted\)|projectInfo\.projectId|\.filter\(Boolean\)|results\.filter\(|failureMessage \|\| '未知错误'/,
  'manual Explorer/Git refresh should not regress to optional project gates, inline rejected-result filtering, filter(Boolean), direct project id use or inline fallback',
);
assert.match(
  pageOrchestrationActionsSource,
  /import type \{ WorkspacePageOrchestrationActionsContract \} from '\.\/workspace-page-orchestration-actions-contract';[\s\S]*export function useWorkspacePageOrchestrationActions\(\{[\s\S]*plannedProjectIdsAcrossMounts,[\s\S]*\}: UseWorkspacePageOrchestrationActionsOptions\): WorkspacePageOrchestrationActionsContract \{/,
  'workspace page orchestration actions hook should return the explicit orchestration actions contract instead of inferred hook implementation shape',
);
assert.match(
  workspaceMessageDispatchHookSource,
  /import type \{[\s\S]*WorkspaceMessageDispatchAction,[\s\S]*WorkspaceMessageDispatchContract,[\s\S]*\} from '\.\/workspace-message-dispatch-contract';[\s\S]*import \{[\s\S]*initialWorkspaceMessageState,[\s\S]*reduceWorkspaceMessageState,[\s\S]*selectWorkspaceCurrentEngineeringState,[\s\S]*selectWorkspaceCurrentGateResult,[\s\S]*selectWorkspaceWorkflowSnapshot,[\s\S]*type WorkspaceMessageMutationSource,[\s\S]*\} from '\.\/workspace-message-state';[\s\S]*export function useWorkspaceMessageDispatch\(\): WorkspaceMessageDispatchContract \{[\s\S]*const \[messageState, dispatchMessages\] = useReducer\(reduceWorkspaceMessageState, initialWorkspaceMessageState\);[\s\S]*const messages = messageState\.messages;[\s\S]*const workflowSnapshot = selectWorkspaceWorkflowSnapshot\(messageState\);[\s\S]*initialWorkflowSnapshot: initialWorkspaceMessageState\.workflowSnapshot,/,
  'workspace message dispatch hook should consume the message state reducer, workflow snapshot selector and initial workflow snapshot from the StateManager module',
);
assert.match(
  workspaceMessageDispatchHookSource,
  /const applyWorkspaceMessages = useCallback\(\([\s\S]*source: WorkspaceMessageMutationSource,[\s\S]*value: SetStateAction<WorkspaceChatMessage\[\]>,[\s\S]*dispatchMessages\(\{ type: 'apply_messages', source, value \}\);[\s\S]*const setMessages = useCallback<WorkspaceMessageDispatchAction>\(\(value\) => \{[\s\S]*applyWorkspaceMessages\('external_set_messages', value\);/,
  'workspace message dispatch hook should keep the external setMessages contract while routing updates through the message reducer',
);
assert.match(
  workspaceMessageActionsHookSource,
  /applyWorkspaceMessages\('workflow_step'[\s\S]*applyWorkspaceMessages\('message_streaming'/,
  'workspace message action hook should route workflow step and streaming writes through explicit mutation sources',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /applyWorkspaceMessages\('session_snapshot_read_failure'[\s\S]*applyWorkspaceMessages\('session_snapshot_parse_failure'[\s\S]*applyWorkspaceMessages\('session_snapshot_save_failure'/,
  'workspace session snapshot hook should route read, parse and save failures through explicit mutation sources',
);
assert.match(
  flowStateSource,
  /import \{ useWorkspacePlanFlowState \} from '\.\/use-workspace-plan-flow-state';[\s\S]*const planFlowState = useWorkspacePlanFlowState\(\{[\s\S]*normalizePlanSelectionMessages,[\s\S]*removeLegacyPlaceholderMessages,[\s\S]*applyWorkspaceMessages: messageDispatch\.applyWorkspaceMessages,[\s\S]*\}\);[\s\S]*availablePlans: planFlowState\.availablePlans,[\s\S]*recommendedPlanId: planFlowState\.recommendedPlanId,[\s\S]*selectedPlanId: planFlowState\.selectedPlanId,[\s\S]*setSelectedPlanId: planFlowState\.setSelectedPlanId,[\s\S]*planCountdown: planFlowState\.planCountdown,[\s\S]*setPlanCountdown: planFlowState\.setPlanCountdown,[\s\S]*planSelectionReady: planFlowState\.planSelectionReady,[\s\S]*updatePlanFlowState: planFlowState\.updatePlanFlowState,[\s\S]*applyWorkspaceState: planFlowState\.applyWorkspaceState,/,
  'workspace flow state should compose the dedicated plan flow state hook instead of owning plan flow state directly',
);
assert.match(
  flowStateSource,
  /import \{ useWorkspaceSessionSnapshot \} from '\.\/use-workspace-session-snapshot';[\s\S]*const sessionSnapshot = useWorkspaceSessionSnapshot\(\{[\s\S]*projectId,[\s\S]*messages: messageDispatch\.messages,[\s\S]*planState: \{[\s\S]*availablePlans: planFlowState\.availablePlans,[\s\S]*recommendedPlanId: planFlowState\.recommendedPlanId,[\s\S]*selectedPlanId: planFlowState\.selectedPlanId,[\s\S]*planCountdown: planFlowState\.planCountdown,[\s\S]*planSelectionReady: planFlowState\.planSelectionReady,[\s\S]*\},[\s\S]*applyWorkspaceMessages: messageDispatch\.applyWorkspaceMessages,[\s\S]*\}\);[\s\S]*readWorkspaceSessionSnapshot: sessionSnapshot\.readWorkspaceSessionSnapshot,/,
  'workspace flow state should compose the dedicated session snapshot hook instead of owning session storage effects directly',
);
assert.match(
  flowStateSource,
  /import \{ useWorkspaceMessageActions \} from '\.\/use-workspace-message-actions';[\s\S]*const messageActions = useWorkspaceMessageActions\(\{[\s\S]*applyWorkspaceMessages: messageDispatch\.applyWorkspaceMessages,[\s\S]*\}\);[\s\S]*applyWorkflowStepToMessage: messageActions\.applyWorkflowStepToMessage,[\s\S]*setMessageStreamingState: messageActions\.setMessageStreamingState,[\s\S]*applyRuntimeRecoveryMessages: messageActions\.applyRuntimeRecoveryMessages,[\s\S]*applyProjectPanelRefreshMessages: messageActions\.applyProjectPanelRefreshMessages,[\s\S]*applyPromptInteractionMessages: messageActions\.applyPromptInteractionMessages,[\s\S]*applyRuntimeResourceMessages: messageActions\.applyRuntimeResourceMessages,[\s\S]*applyProjectBootstrapMessages: messageActions\.applyProjectBootstrapMessages,[\s\S]*applyPageEffectMessages: messageActions\.applyPageEffectMessages,[\s\S]*applyPageUiMessages: messageActions\.applyPageUiMessages,[\s\S]*applyIdeInteractionMessages: messageActions\.applyIdeInteractionMessages,[\s\S]*applyResourceFileMessages: messageActions\.applyResourceFileMessages,[\s\S]*applyResourceGitMessages: messageActions\.applyResourceGitMessages,[\s\S]*applyOrchestrationSharedMessages: messageActions\.applyOrchestrationSharedMessages,[\s\S]*applyGenerationStateMessages: messageActions\.applyGenerationStateMessages,[\s\S]*applyPlanGenerationMessages: messageActions\.applyPlanGenerationMessages,[\s\S]*applyPlanStreamPatchMessages: messageActions\.applyPlanStreamPatchMessages,[\s\S]*applyPlanImplementationMessages: messageActions\.applyPlanImplementationMessages,[\s\S]*applyImplementationGenerationMessages: messageActions\.applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages: messageActions\.applyImplementationStreamPatchMessages,/,
  'workspace flow state should compose the dedicated message action hook instead of owning grouped message action wrappers',
);
assert.match(
  flowStateSource,
  /const flowRefs = useWorkspaceFlowRefs\(\{[\s\S]*messages: messageDispatch\.messages,[\s\S]*workflowSnapshot: messageDispatch\.workflowSnapshot,[\s\S]*initialWorkflowSnapshot: messageDispatch\.initialWorkflowSnapshot,[\s\S]*\}\);[\s\S]*messagesRef: flowRefs\.messagesRef,[\s\S]*workflowSnapshotRef: flowRefs\.workflowSnapshotRef,/,
  'workspace flow state should compose the dedicated flow refs hook instead of owning ref synchronization directly',
);
assert.match(
  workspaceFlowRefsHookSource,
  /import type \{ WorkspaceFlowRefsContract \} from '\.\/workspace-flow-refs-contract';[\s\S]*export function useWorkspaceFlowRefs\([\s\S]*\): WorkspaceFlowRefsContract \{[\s\S]*const messagesRef = useRef<WorkspaceChatMessage\[\]>\(\[\]\);[\s\S]*const workflowSnapshotRef = useRef<WorkspaceWorkflowSnapshot>\(initialWorkflowSnapshot\);[\s\S]*useEffect\(\(\) => \{[\s\S]*messagesRef\.current = messages;[\s\S]*workflowSnapshotRef\.current = workflowSnapshot;[\s\S]*\}, \[messages, workflowSnapshot\]\);/,
  'workspace flow refs hook should own messagesRef and workflowSnapshotRef synchronization',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /import type \{ WorkspaceSessionSnapshotContract \} from '\.\/workspace-session-snapshot-contract';[\s\S]*export function useWorkspaceSessionSnapshot\([\s\S]*\): WorkspaceSessionSnapshotContract \{[\s\S]*const \{[\s\S]*availablePlans,[\s\S]*recommendedPlanId,[\s\S]*selectedPlanId,[\s\S]*planCountdown,[\s\S]*planAutoConfirmDeadlineAt,[\s\S]*planSelectionReady,[\s\S]*\} = planState;[\s\S]*const readWorkspaceSessionSnapshot = useCallback\([\s\S]*sessionStorage\.getItem\(getWorkspaceSessionKey\(targetProjectId\)\)[\s\S]*sessionStorage\.removeItem\(getWorkspaceSessionKey\(targetProjectId\)\)[\s\S]*useEffect\(\(\) => \{[\s\S]*buildWorkspaceSessionSnapshot\([\s\S]*messages,[\s\S]*\{[\s\S]*availablePlans,[\s\S]*recommendedPlanId,[\s\S]*selectedPlanId,[\s\S]*planCountdown,[\s\S]*planAutoConfirmDeadlineAt,[\s\S]*planSelectionReady,[\s\S]*\},[\s\S]*buildWorkspaceEditorSessionSnapshot\(editorState\),[\s\S]*\);[\s\S]*sessionStorage\.setItem\(getWorkspaceSessionKey\(projectId\), JSON\.stringify\(snapshot\)\);/,
  'workspace session snapshot hook should own read, corrupted snapshot cleanup and save effects',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /WorkspaceSessionSnapshotEditorStateInput[\s\S]*activeFile: string \| null;[\s\S]*openFiles: WorkspaceOpenFilePathList;[\s\S]*files: Map<string, string>;[\s\S]*savedFiles: Map<string, string>;[\s\S]*editorBufferStatuses: Map<string, EditorBufferStatus>;[\s\S]*expandedFolders: Set<string>;[\s\S]*searchQuery: string;[\s\S]*pendingCloseFile: string \| null;[\s\S]*materializeWorkspaceSessionSnapshotFileEntries[\s\S]*for \(const \[path, content\] of files\)[\s\S]*materializeWorkspaceSessionSnapshotEditorStatusEntries[\s\S]*for \(const \[path, status\] of editorBufferStatuses\)[\s\S]*materializeWorkspaceSessionSnapshotExpandedFolders[\s\S]*for \(const folder of expandedFolders\)[\s\S]*buildWorkspaceEditorSessionSnapshot/,
  'workspace session snapshot should persist editor buffers, saved buffers, open files, active file, expanded folders and pending dirty close state through named materializers',
);
assert.match(
  workspaceSessionSnapshotHookSource,
  /planAutoConfirmDeadlineAt,[\s\S]*buildWorkspaceSessionSnapshot\([\s\S]*messages,[\s\S]*\{[\s\S]*planAutoConfirmDeadlineAt,[\s\S]*planSelectionReady,[\s\S]*\},[\s\S]*buildWorkspaceEditorSessionSnapshot\(editorState\),/,
  'workspace session snapshot should persist the absolute plan auto-confirm deadline with plan selection state',
);
assert.match(
  workspacePlanFlowStateHookSource,
  /import type \{ WorkspacePlanFlowStateContract \} from '\.\/workspace-plan-flow-state-contract';[\s\S]*WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS,[\s\S]*initialWorkspacePlanFlowState,[\s\S]*export function useWorkspacePlanFlowState\([\s\S]*\): WorkspacePlanFlowStateContract \{[\s\S]*const \[availablePlans, setAvailablePlans\] = useState<Plan\[\]>\(\[\]\);[\s\S]*const \[recommendedPlanId, setRecommendedPlanId\] = useState<string \| null>\(null\);[\s\S]*const \[selectedPlanId, setSelectedPlanId\] = useState<string \| null>\(null\);[\s\S]*const \[planCountdown, setPlanCountdown\] = useState\(WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS\);[\s\S]*const \[planSelectionReady, setPlanSelectionReady\] = useState\(false\);[\s\S]*const planFlowStateRef = useRef<WorkspacePlanFlowState>\(initialWorkspacePlanFlowState\);/,
  'workspace plan flow state should own plan selection state and initialize countdown through the shared auto-confirm timeout constant',
);
assert.match(
  workspacePlanFlowStateSource,
  /export type WorkspaceExtractedPlanFlowState = \{[\s\S]*availablePlans: Plan\[\];[\s\S]*recommendedPlanId: string \| null;[\s\S]*selectedPlanId: string \| null;[\s\S]*planSelectionReady: boolean;[\s\S]*\};[\s\S]*export function extractPlanStateFromMessages\([\s\S]*nextMessages: WorkspaceChatMessage\[\],[\s\S]*\): WorkspaceExtractedPlanFlowState \{/,
  'workspace plan flow extracted state should use an explicit named contract',
);
assert.match(
  workspacePlanFlowStateSource,
  /export const WORKSPACE_PLAN_AUTO_CONFIRM_SECONDS = 120;[\s\S]*export function getWorkspacePlanAutoConfirmDeadlineFromSeconds\(seconds: number\): string \| null[\s\S]*export function getWorkspacePlanAutoConfirmRemainingSeconds\(deadlineAt: string \| null\): number \| null[\s\S]*auto_confirm_deadline_at: state\.planAutoConfirmDeadlineAt \?\? undefined[\s\S]*const remainingCountdown = getWorkspacePlanAutoConfirmRemainingSeconds\(nextAutoConfirmDeadlineAt\)/,
  'workspace plan flow state should use an absolute 120-second auto-confirm deadline and derive remaining countdown from it',
);
assert.match(
  workspacePlanFlowStateSource,
  /(?=[\s\S]*WorkspacePlanSelectionState)(?=[\s\S]*getWorkspaceRecommendedPlanId)(?=[\s\S]*type WorkspacePlanFlowMessageList = WorkspaceChatMessage\[\];)(?=[\s\S]*type WorkspacePlanSelectionEngineeringStateMessageMaterializerInput = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*messageIndex: number;[\s\S]*state: WorkspacePlanFlowState;[\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot;[\s\S]*\};)(?=[\s\S]*function getWorkspacePlanList)(?=[\s\S]*function hasWorkspacePlanList)(?=[\s\S]*function hasWorkspacePlanId\(planId: string\): boolean)(?=[\s\S]*function getWorkspacePlanIds\(plans: Plan\[\]\): string\[\] \{[\s\S]*for \(const plan of plans\)[\s\S]*planIds\.push\(planId\);)(?=[\s\S]*function getWorkspacePlansById\(plans: Plan\[\]\): Map<string, Plan> \{[\s\S]*for \(const plan of plans\)[\s\S]*plansById\.set\(plan\.id, plan\);)(?=[\s\S]*function getWorkspacePlansFromPlanIds\(planIds: string\[\], plansById: Map<string, Plan>\): Plan\[\] \{[\s\S]*for \(const planId of planIds\)[\s\S]*plans\.push\(plan\);)(?=[\s\S]*function getLatestWorkspacePlanMessage)(?=[\s\S]*isPlanOptionsMessage === true)(?=[\s\S]*isPlanSuperseded === false)(?=[\s\S]*hasMessagePlans === true)(?=[\s\S]*function getWorkspacePlanMessagePlans)(?=[\s\S]*function getWorkspacePlanMessageRecommendedPlanId)(?=[\s\S]*function getWorkspacePlanMessageSelectedPlanId)(?=[\s\S]*function isWorkspacePlanMessageStreamComplete)(?=[\s\S]*function getWorkspacePlanSelectionOptionalId)(?=[\s\S]*function getWorkspacePlanMessageEngineeringState)(?=[\s\S]*function getWorkspacePlanSelectionState)(?=[\s\S]*function getLatestWorkspacePlanSelectionState)(?=[\s\S]*function getWorkspacePlanSelectionAvailablePlanIds)(?=[\s\S]*function getWorkspacePlanSelectionPlanId)(?=[\s\S]*function getWorkspacePlanSelectionAvailablePlansPatch)(?=[\s\S]*function getWorkspacePlanFlowOptionPlans)(?=[\s\S]*function getRestoredWorkspaceSnapshotPlans)(?=[\s\S]*function getRestoredWorkspacePersistedPlanId)(?=[\s\S]*function shouldAwaitWorkspacePlanSelection\(\{[\s\S]*planSelectionReady: boolean;[\s\S]*hasAvailablePlans: boolean;[\s\S]*hasSelectedPlan: boolean;[\s\S]*return hasSelectedPlan === false;)(?=[\s\S]*function getWorkspacePlanSelectionCurrentTask)(?=[\s\S]*function getWorkspacePlanSelectionNextAction)(?=[\s\S]*function getWorkspacePlanSelectionApprovalBoundary)(?=[\s\S]*function getWorkspacePlanSelectionTargetMessageIndex\(messages: WorkspaceChatMessage\[\]\): number \{[\s\S]*for \(let index = messages\.length - 1; index >= 0; index -= 1\)[\s\S]*return index;)(?=[\s\S]*function canUseWorkspaceMessagePlanSelectionReady)(?=[\s\S]*function shouldResetWorkspacePlanCountdown\(\{[\s\S]*nextPlanSelectionReady: boolean;[\s\S]*hasNextAvailablePlans: boolean;[\s\S]*hasNextSelectedPlan: boolean;[\s\S]*return hasNextSelectedPlan === false;)(?=[\s\S]*function shouldRestoreWorkspacePlanCountdown\(\{[\s\S]*hasRestoredAvailablePlans: boolean;[\s\S]*hasRestoredSelectedPlan: boolean;[\s\S]*return hasRestoredSelectedPlan === false;)(?=[\s\S]*function materializeWorkspacePlanSelectionEngineeringStateMessages\(\{[\s\S]*messages,[\s\S]*messageIndex,[\s\S]*state,[\s\S]*engineeringState,[\s\S]*\}: WorkspacePlanSelectionEngineeringStateMessageMaterializerInput\): WorkspacePlanFlowMessageList \{[\s\S]*const nextMessages: WorkspacePlanFlowMessageList = \[\];[\s\S]*for \(let index = 0; index < messages\.length; index \+= 1\)[\s\S]*if \(index !== messageIndex\)[\s\S]*nextMessages\.push\(message\);[\s\S]*recommendedPlanId: getWorkspacePlanSelectionOptionalId\(state\.recommendedPlanId\)[\s\S]*selectedPlanId: getWorkspacePlanSelectionOptionalId\(state\.selectedPlanId\)[\s\S]*planStreamComplete: state\.planSelectionReady[\s\S]*\.\.\.getWorkspacePlanMessageEngineeringState\(message\)[\s\S]*return nextMessages;)(?=[\s\S]*const latestPlanMessage = getLatestWorkspacePlanMessage\(nextMessages\);)(?=[\s\S]*const messagePlans = getWorkspacePlanMessagePlans\(latestPlanMessage\);)(?=[\s\S]*const recommendedPlanId = getWorkspacePlanMessageRecommendedPlanId\(latestPlanMessage\);)(?=[\s\S]*selectedPlanId: getWorkspacePlanMessageSelectedPlanId\(latestPlanMessage\))(?=[\s\S]*planSelectionReady: isWorkspacePlanMessageStreamComplete\(latestPlanMessage\))(?=[\s\S]*const awaitingSelection = shouldAwaitWorkspacePlanSelection\(\{[\s\S]*planSelectionReady: state\.planSelectionReady,[\s\S]*hasAvailablePlans,[\s\S]*hasSelectedPlan,[\s\S]*\}\);)(?=[\s\S]*available_plan_ids: getWorkspacePlanIds\(state\.availablePlans\))(?=[\s\S]*recommended_plan_id: getWorkspacePlanSelectionOptionalId\(state\.recommendedPlanId\))(?=[\s\S]*approval_boundary: approvalBoundary)(?=[\s\S]*const messageIndex = getWorkspacePlanSelectionTargetMessageIndex\(messages\);)(?=[\s\S]*materializeWorkspacePlanSelectionEngineeringStateMessages\(\{[\s\S]*messages,[\s\S]*messageIndex,[\s\S]*state,[\s\S]*engineeringState,[\s\S]*\}\);)(?=[\s\S]*const latestPlanSelection = getLatestWorkspacePlanSelectionState\(nextMessages\);)(?=[\s\S]*const availablePlanIds = getWorkspacePlanSelectionAvailablePlanIds\(latestPlanSelection\);)(?=[\s\S]*const plansById = getWorkspacePlansById\(availablePlans\);)(?=[\s\S]*const plansFromState = getWorkspacePlansFromPlanIds\(availablePlanIds, plansById\);)(?=[\s\S]*availablePlans: getWorkspacePlanSelectionAvailablePlansPatch\(plansFromState\))(?=[\s\S]*const hasMessageAvailablePlans = hasWorkspacePlanList\(messageState\.availablePlans\);)(?=[\s\S]*const nextAvailablePlans = getWorkspacePlanFlowOptionPlans\(options\))(?=[\s\S]*const canUseMessagePlanSelectionReady = canUseWorkspaceMessagePlanSelectionReady\(\{[\s\S]*hasMessageAvailablePlans,[\s\S]*hasMessagePlanSelectionReady,[\s\S]*\}\);)(?=[\s\S]*const hasNextAvailablePlans = hasWorkspacePlanList\(nextAvailablePlans\);)(?=[\s\S]*const shouldResetPlanCountdown = shouldResetWorkspacePlanCountdown\(\{[\s\S]*nextPlanSelectionReady,[\s\S]*hasNextAvailablePlans,[\s\S]*hasNextSelectedPlan,[\s\S]*\}\);)(?=[\s\S]*const snapshotAvailablePlans = getRestoredWorkspaceSnapshotPlans\(snapshot\);)(?=[\s\S]*const engineeringAvailablePlans = getWorkspacePlanList\(engineeringState\.availablePlans\);)(?=[\s\S]*const hasRestoredAvailablePlans = hasWorkspacePlanList\(availablePlans\);)(?=[\s\S]*const shouldRestorePlanCountdown = shouldRestoreWorkspacePlanCountdown\(\{[\s\S]*hasRestoredAvailablePlans,[\s\S]*hasRestoredSelectedPlan,[\s\S]*\}\);)/,
  'workspace plan flow state should derive plan selection recovery and engineering state through explicit presence gates',
);
assert.doesNotMatch(
  workspacePlanFlowStateSource,
  /extractPlanStateFromMessages\([\s\S]*\): Pick<[\s\S]*WorkspacePlanFlowState/,
  'workspace plan flow extracted state should not regress to a Pick-derived return contract',
);
assert.doesNotMatch(
  workspacePlanFlowStateSource,
  /latestPlanMessage\?\.plans\?\.\[0\]|latestPlanMessage\?\.(?:plans|recommendedPlanId|selectedPlanId|planStreamComplete)|message\.engineeringState \?\? \{\}|snapshot\?\.availablePlans \?\? \[\]|latestPlanSelection\.available_plan_ids \?\? \[\]|engineeringState\.availablePlans \?\? \[\]|options\?\.(?:availablePlans|recommendedPlanId|selectedPlanId|planSelectionReady|planCountdown)|!message\.planSuperseded|find\(Boolean\)|filter\(Boolean\)|Boolean\(state\.selectedPlanId\)|state\.(?:selectedPlanId|recommendedPlanId) \|\| undefined|selectedPlanId \|\| persistedPlanId|availablePlans\.length > 0 && !selectedPlanId|nextPlanSelectionReady && nextAvailablePlans\.length > 0 && !nextSelectedPlanId|state\.availablePlans[\s\S]*\.map\(\(plan\) => plan\.id\)[\s\S]*\.filter\(\(planId\) => planId\.length > 0\)|availablePlanIds[\s\S]*\.map\(\(planId\) => plansById\.get\(planId\)\)[\s\S]*\.filter\(\(plan\): plan is Plan => plan !== undefined\)|return messages\.map\(|reverse\(\)\.findIndex\(|message\.kind === 'plan-options' && message\.planSuperseded !== true|hasMessageAvailablePlans === true \|\| hasMessagePlanSelectionReady === true|nextPlanSelectionReady === true[\s\S]*&&[\s\S]*hasNextAvailablePlans === true[\s\S]*&&[\s\S]*hasNextSelectedPlan === false|hasRestoredAvailablePlans === true && hasRestoredSelectedPlan === false|awaitingSelection === true \|\| hasSelectedPlan === true/,
  'workspace plan flow state should not regress to implicit plan selection, fallback or countdown gates',
);
assert.match(
  workspacePlanFlowStateHookSource,
  /(?=[\s\S]*type WorkspacePlanFlowStatePatchValue = Partial<WorkspacePlanFlowState>;)(?=[\s\S]*function hasWorkspacePlanFlowStatePatch\([\s\S]*nextPatch: WorkspacePlanFlowStatePatchValue \| null \| undefined,[\s\S]*\): nextPatch is WorkspacePlanFlowStatePatchValue[\s\S]*nextPatch === null[\s\S]*return nextPatch !== undefined;)(?=[\s\S]*const applyWorkspaceState = useCallback\([\s\S]*resolvePlanFlowState\(planFlowStateRef\.current, normalizedMessages, options\);[\s\S]*attachPlanSelectionEngineeringState\(normalizedMessages, nextPlanState\);[\s\S]*applyWorkspaceMessages\('workspace_state_apply', messagesWithPlanState\);[\s\S]*syncNextPlanFlowState\(nextPlanState\);)(?=[\s\S]*const updatePlanFlowState = useCallback\([\s\S]*const nextPatch = typeof patch === 'function' \? patch\(currentState\) : patch;[\s\S]*if \(hasWorkspacePlanFlowStatePatch\(nextPatch\) === false\) \{[\s\S]*applyWorkspaceMessages\('plan_flow_state', \(prev\) => attachPlanSelectionEngineeringState\(prev, nextState\)\);[\s\S]*syncNextPlanFlowState\(nextState\);)/,
  'workspace plan flow state hook should route workspace state apply and plan flow patches through explicit mutation sources',
);
assert.doesNotMatch(
  workspacePlanFlowStateHookSource,
  /if \(!nextPatch\)/,
  'workspace plan flow state hook should not regress to implicit next patch gate',
);
assert.match(
  workspaceMessageActionsHookSource,
  /type WorkspaceMessageActionMessageList = WorkspaceChatMessage\[\];[\s\S]*type WorkspaceMessageActionWorkflowStepList = WorkflowStep\[\];[\s\S]*type WorkspaceMessageActionWorkflowMessageMaterializerInput = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*messageId: string;[\s\S]*step: WorkflowStep;[\s\S]*\};[\s\S]*type WorkspaceMessageActionStreamingMessageMaterializerInput = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*messageId: string;[\s\S]*streaming: boolean;[\s\S]*\};[\s\S]*function getWorkspaceMessageActionWorkflowSteps\([\s\S]*message: WorkspaceChatMessage,[\s\S]*\): WorkspaceMessageActionWorkflowStepList[\s\S]*Array\.isArray\(message\.workflowSteps\) === false[\s\S]*function getWorkspaceMessageActionWorkflowStepMeta\([\s\S]*meta: WorkflowStepMeta \| undefined,[\s\S]*\): WorkflowStepMeta[\s\S]*function hasWorkspaceMessageActionWorkflowStepMeta\(meta: WorkflowStepMeta\): boolean[\s\S]*function getWorkspaceMessageActionNextWorkflowStepMeta\([\s\S]*nextMeta: WorkflowStepMeta,[\s\S]*step: WorkflowStep,[\s\S]*\): WorkflowStepMeta \| undefined[\s\S]*function getWorkspaceMessageActionWorkflowStepIndex\([\s\S]*steps: WorkspaceMessageActionWorkflowStepList,[\s\S]*stepId: string,[\s\S]*\): number \{[\s\S]*for \(let index = 0; index < steps\.length; index \+= 1\)[\s\S]*const isMatchingStep = item\.id === stepId;[\s\S]*if \(isMatchingStep === true\)[\s\S]*function materializeWorkspaceMessageActionWorkflowSteps\([\s\S]*workflowSteps: WorkspaceMessageActionWorkflowStepList,[\s\S]*step: WorkflowStep,[\s\S]*\): WorkspaceMessageActionWorkflowStepList \{[\s\S]*const nextSteps: WorkspaceMessageActionWorkflowStepList = \[\];[\s\S]*for \(const workflowStep of workflowSteps\)[\s\S]*const existingIndex = getWorkspaceMessageActionWorkflowStepIndex\(nextSteps, step\.id\);[\s\S]*const existingMeta = getWorkspaceMessageActionWorkflowStepMeta\(existingStep\.meta\);[\s\S]*\.\.\.getWorkspaceMessageActionWorkflowStepMeta\(step\.meta\),[\s\S]*meta: getWorkspaceMessageActionNextWorkflowStepMeta\(nextMeta, step\),[\s\S]*function materializeWorkspaceMessageActionWorkflowMessages\(\{[\s\S]*messages,[\s\S]*messageId,[\s\S]*step,[\s\S]*\}: WorkspaceMessageActionWorkflowMessageMaterializerInput\): WorkspaceMessageActionMessageList \{[\s\S]*for \(const message of messages\)[\s\S]*const workflowSteps = getWorkspaceMessageActionWorkflowSteps\(message\);[\s\S]*const nextSteps = materializeWorkspaceMessageActionWorkflowSteps\(workflowSteps, step\);[\s\S]*function materializeWorkspaceMessageActionStreamingMessages\(\{[\s\S]*messages,[\s\S]*messageId,[\s\S]*streaming,[\s\S]*\}: WorkspaceMessageActionStreamingMessageMaterializerInput\): WorkspaceMessageActionMessageList \{[\s\S]*for \(const message of messages\)[\s\S]*streaming,[\s\S]*applyWorkspaceMessages\('workflow_step', \(prev\) => materializeWorkspaceMessageActionWorkflowMessages\(\{[\s\S]*messages: prev,[\s\S]*messageId,[\s\S]*step,[\s\S]*\}\)\);[\s\S]*applyWorkspaceMessages\('message_streaming', \(prev\) => materializeWorkspaceMessageActionStreamingMessages\(\{[\s\S]*messages: prev,[\s\S]*messageId,[\s\S]*streaming,[\s\S]*\}\)\);/,
  'workspace message action workflow and streaming writers should derive message and step updates through explicit materializers',
);
assert.doesNotMatch(
  workspaceMessageActionsHookSource,
  /message\.workflowSteps \|\| \[\]|message\.workflowSteps \?\? \[\]|existingStep\.meta \|\| \{\}|existingStep\.meta \?\? \{\}|step\.meta \|\| \{\}|step\.meta \?\? \{\}|Object\.keys\(nextMeta\)\.length > 0 \? nextMeta : step\.meta|prev\.map\(\(message\) =>|nextSteps\.findIndex\(/,
  'workspace message action workflow and streaming writers should not regress to legacy workflow step, metadata or inline list fallbacks',
);
assert.match(
  workspaceMessageActionsHookSource,
  /import type \{ WorkspaceMessageActionsContract \} from '\.\/workspace-message-actions-contract';[\s\S]*export function useWorkspaceMessageActions\([\s\S]*\): WorkspaceMessageActionsContract \{[\s\S]*const applyRuntimeRecoveryMessages = useCallback\([\s\S]*applyWorkspaceMessages\('runtime_recovery', value\);[\s\S]*const applyProjectPanelRefreshMessages = useCallback\([\s\S]*applyWorkspaceMessages\('project_panel_refresh', value\);[\s\S]*const applyPromptInteractionMessages = useCallback\([\s\S]*applyWorkspaceMessages\('prompt_interaction', value\);[\s\S]*const applyRuntimeResourceMessages = useCallback\([\s\S]*void value;[\s\S]*const applyProjectBootstrapMessages = useCallback\([\s\S]*applyWorkspaceMessages\('project_bootstrap', value\);[\s\S]*const applyPageEffectMessages = useCallback\([\s\S]*applyWorkspaceMessages\('page_effect', value\);[\s\S]*const applyPageUiMessages = useCallback\([\s\S]*applyWorkspaceMessages\('page_ui', value\);[\s\S]*const applyIdeInteractionMessages = useCallback\([\s\S]*applyWorkspaceMessages\('ide_interaction', value\);[\s\S]*const applyResourceFileMessages = useCallback\([\s\S]*applyWorkspaceMessages\('resource_file', value\);[\s\S]*const applyResourceGitMessages = useCallback\([\s\S]*applyWorkspaceMessages\('resource_git', value\);[\s\S]*const applyOrchestrationSharedMessages = useCallback\([\s\S]*applyWorkspaceMessages\('orchestration_shared', value\);[\s\S]*const applyGenerationStateMessages = useCallback\([\s\S]*applyWorkspaceMessages\('generation_state_persistence', value\);[\s\S]*const applyPlanGenerationMessages = useCallback\([\s\S]*applyWorkspaceMessages\('plan_generation', value\);[\s\S]*const applyPlanStreamPatchMessages = useCallback\([\s\S]*applyWorkspaceMessages\('plan_stream_patch', value\);[\s\S]*const applyPlanImplementationMessages = useCallback\([\s\S]*applyWorkspaceMessages\('plan_implementation', value\);[\s\S]*const applyImplementationGenerationMessages = useCallback\([\s\S]*applyWorkspaceMessages\('implementation_generation', value\);[\s\S]*const applyImplementationStreamPatchMessages = useCallback\([\s\S]*applyWorkspaceMessages\('implementation_stream_patch', value\);/,
  'workspace message action hook should expose explicit grouped message actions for all external flow writers',
);
assert.match(
  pageActionControllersSource,
  /WorkspaceRuntimeRecoveryMessagesAction[\s\S]*function appendRuntimeRecoveryMessage\([\s\S]*applyRuntimeRecoveryMessages: WorkspaceRuntimeRecoveryMessagesAction,[\s\S]*applyRuntimeRecoveryMessages\(\(prev\) => \[\.\.\.prev, message\]\);/,
  'runtime recovery controller should use the explicit runtime recovery message action helper',
);
assert.match(
  pageActionControllersSource,
  /import type \{ WorkspacePageActionControllersContract \} from '\.\/workspace-page-action-controllers-contract';[\s\S]*\}: UseWorkspacePageActionControllersOptions\): WorkspacePageActionControllersContract \{[\s\S]*const projectActions = useWorkspacePageProjectActions\([\s\S]*const aiActions = useWorkspacePageAiActions\([\s\S]*return \{[\s\S]*\.\.\.projectActions,[\s\S]*\.\.\.aiActions,[\s\S]*handleSelectGitBranchCompareTarget,[\s\S]*handleRecoverRuntime,[\s\S]*pendingCloseFile: localState\.pendingCloseFile,[\s\S]*setPendingCloseFile: localState\.setPendingCloseFile,[\s\S]*gitCommits: localState\.gitCommits,[\s\S]*openFiles: localState\.openFiles,/,
  'page action controllers hook should return the explicit page action controllers contract',
);
assert.match(
  pageActionControllersSource,
  /function hasWorkspacePageActionControllerProjectPlan\(projectInfo: WorkspaceProjectInfo\): boolean \{[\s\S]*const hasPlanId = hasWorkspacePageActionControllerTextValue\(projectInfo\.planId\);[\s\S]*if \(hasPlanId === true\)[\s\S]*const hasPlanData = hasWorkspacePageActionControllerTextValue\(projectInfo\.planData\);[\s\S]*return hasPlanData === true;[\s\S]*function shouldAutoRequestWorkspacePlan\(\{[\s\S]*projectInfo,[\s\S]*availablePlanCount,[\s\S]*isPlanning,[\s\S]*isGenerating,[\s\S]*requestedProjectId,[\s\S]*\}: \{[\s\S]*projectInfo: WorkspaceProjectInfo \| null;[\s\S]*availablePlanCount: number;[\s\S]*isPlanning: boolean;[\s\S]*isGenerating: boolean;[\s\S]*requestedProjectId: string \| null;[\s\S]*\}\): boolean \{[\s\S]*const persistedProject = getWorkspacePageActionControllerPersistedProject\(projectInfo\);[\s\S]*if \(persistedProject === null\)[\s\S]*return false;[\s\S]*const hasProjectPlan = hasWorkspacePageActionControllerProjectPlan\(persistedProject\);[\s\S]*if \(hasProjectPlan === true\)[\s\S]*return false;[\s\S]*const hasAvailablePlans = availablePlanCount > 0;[\s\S]*if \(hasAvailablePlans === true\)[\s\S]*return false;[\s\S]*if \(isPlanning === true \|\| isGenerating === true\)[\s\S]*return false;[\s\S]*const hasRequestedProject = requestedProjectId === persistedProject\.projectId;[\s\S]*return hasRequestedProject === false;[\s\S]*const autoPlanRequestedProjectRef = useRef<string \| null>\(null\);[\s\S]*useEffect\(\(\) => \{[\s\S]*const shouldRequestPlan = shouldAutoRequestWorkspacePlan\(\{[\s\S]*projectInfo: localState\.projectInfo,[\s\S]*availablePlanCount: flowState\.availablePlans\.length,[\s\S]*isPlanning: localState\.isPlanning,[\s\S]*isGenerating: localState\.isGenerating,[\s\S]*requestedProjectId: autoPlanRequestedProjectRef\.current,[\s\S]*\}\);[\s\S]*if \(shouldRequestPlan === false\)[\s\S]*return;[\s\S]*const project = getWorkspacePageActionControllerPersistedProject\(localState\.projectInfo\);[\s\S]*if \(project === null\)[\s\S]*return;[\s\S]*autoPlanRequestedProjectRef\.current = project\.projectId;[\s\S]*void aiActions\.requestPlansForProject\(\{[\s\S]*baseMessages: flowState\.messagesRef\.current,[\s\S]*\}\);[\s\S]*\}, \[/,
  'workspace page action controllers should auto request Plan for a persisted project without existing plan or available plans after Workspace initialization',
);
assert.match(
  pageActionControllersSource,
  /import \{ getWorkspacePlanAutoConfirmRemainingSeconds \} from '\.\/workspace-plan-flow-state';[\s\S]*function shouldRunWorkspacePlanAutoConfirmCountdown\([\s\S]*planAutoConfirmDeadlineAt: string \| null;[\s\S]*getWorkspacePlanAutoConfirmRemainingSeconds\(planAutoConfirmDeadlineAt\)[\s\S]*function shouldAutoConfirmWorkspaceRecommendedPlan\([\s\S]*autoConfirmingPlanId: string \| null;[\s\S]*const hasLiveDeadline = remainingSeconds !== null;[\s\S]*const autoConfirmingPlanRef = useRef<string \| null>\(null\);[\s\S]*const syncRemainingCountdown = \(\) => \{[\s\S]*getWorkspacePlanAutoConfirmRemainingSeconds\(flowState\.planAutoConfirmDeadlineAt\)[\s\S]*window\.setInterval\(\(\) => \{[\s\S]*flowState\.setPlanCountdown\(remainingSeconds\);[\s\S]*window\.clearInterval\(timer\);[\s\S]*autoConfirmingPlanRef\.current = recommendedPlan\.id;[\s\S]*void aiActions\.choosePlanAndImplement\(recommendedPlan, \{[\s\S]*confirmationSource: 'timeout',/,
  'workspace page action controllers should run deadline-based plan auto-confirm countdown and guard duplicate timeout confirmation',
);
assert.match(
  pageActionControllersSource,
  /import type \{ WorkspacePageAiRuntimeResources \} from '\.\/use-workspace-page-ai-actions';[\s\S]*import type \{[\s\S]*WorkspacePageProjectActionsRuntimeResources,[\s\S]*WorkspacePageProjectActionsShellState,[\s\S]*\} from '\.\/use-workspace-page-project-actions';[\s\S]*export type WorkspacePageActionControllersShellState = WorkspacePageProjectActionsShellState;[\s\S]*export type WorkspacePageActionControllersRuntimeResources =[\s\S]*WorkspacePageProjectActionsRuntimeResources[\s\S]*& WorkspacePageAiRuntimeResources[\s\S]*& \{[\s\S]*refreshProjectBranchCompareTarget: \([\s\S]*projectId: string,[\s\S]*targetBranch: string,[\s\S]*\) => Promise<GitBranchCompare \| null>;[\s\S]*\};[\s\S]*shellState: WorkspacePageActionControllersShellState;[\s\S]*runtimeResources: WorkspacePageActionControllersRuntimeResources;/,
  'page action controllers should expose named shell and runtime input contracts',
);
assert.doesNotMatch(
  pageActionControllersSource,
  /type (ShellState|RuntimeResources) = Pick<|Pick<Workspace(ShellState|RuntimeResources)Contract/,
  'page action controllers inputs should not regress to Pick-derived shell or runtime slices',
);
assert.match(
  pageActionControllersSource,
  /flowState: \{[\s\S]*applyProjectPanelRefreshMessages: flowState\.applyProjectPanelRefreshMessages,[\s\S]*applyIdeInteractionMessages: flowState\.applyIdeInteractionMessages,[\s\S]*applyResourceFileMessages: flowState\.applyResourceFileMessages,[\s\S]*applyResourceGitMessages: flowState\.applyResourceGitMessages,/,
  'page action controller should pass project panel refresh, IDE interaction, resource file and resource Git actions to project actions',
);
assert.match(
  workspaceFlowStateConsumerSources,
  /import type \{ WorkspaceFlowStateContract \} from '\.\/workspace-flow-state-contract';[\s\S]*type FlowState = WorkspaceFlowStateContract;[\s\S]*WorkspacePageProjectActionsFlowState[\s\S]*WorkspacePageOrchestrationFlowState[\s\S]*WorkspacePageConversationFlowState/,
  'workspace flow state consumers should type against the explicit flow state contract or named flow input contracts rather than hook implementation ReturnType',
);
assert.match(
  pageActionControllersSource,
  /handleRecoverRuntime[\s\S]*appendRuntimeRecoveryMessage\(flowState\.applyRuntimeRecoveryMessages,[\s\S]*runtime-recovery-unavailable[\s\S]*runtime-recovery-in-progress[\s\S]*flowState\.applyRuntimeRecoveryMessages\(\(prev\) => \([\s\S]*materializeWorkspacePageActionControllerUpsertedMessages\(prev, nextMessage\)[\s\S]*\)\);[\s\S]*appendRuntimeRecoveryMessage\(flowState\.applyRuntimeRecoveryMessages,[\s\S]*runtime-recovery-refresh-partial[\s\S]*appendRuntimeRecoveryMessage\(flowState\.applyRuntimeRecoveryMessages,[\s\S]*runtime-recovery-completed[\s\S]*appendRuntimeRecoveryMessage\(flowState\.applyRuntimeRecoveryMessages,[\s\S]*runtime-recovery-failed/,
  'runtime recovery controller should route unavailable, inflight, partial, completed and failed messages through runtime recovery action',
);
assert.match(
  pageActionControllersSource,
  /type WorkspacePageActionControllerMessageList = WorkspaceChatMessage\[\];[\s\S]*function getWorkspacePageActionControllerMessageIndex\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*messageId: string,[\s\S]*\): number[\s\S]*for \(let index = 0; index < messages\.length; index \+= 1\)[\s\S]*function materializeWorkspacePageActionControllerUpsertedMessages\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*nextMessage: WorkspaceChatMessage,[\s\S]*\): WorkspacePageActionControllerMessageList[\s\S]*const existingIndex = getWorkspacePageActionControllerMessageIndex\(messages, nextMessage\.id\);[\s\S]*nextMessages\.push\(nextMessage\);[\s\S]*function shouldUseWorkspacePageActionControllerMobileIdeView\(isMobile: boolean\): boolean[\s\S]*const shouldUseMobileIdeView = isMobile === true;[\s\S]*return shouldUseMobileIdeView === true;[\s\S]*function getWorkspacePageActionControllerPersistedProject\([\s\S]*projectInfo: WorkspaceProjectInfo \| null,[\s\S]*const isPersistedProject = projectInfo\.isPersisted === true;[\s\S]*const hasProjectId = hasWorkspacePageActionControllerTextValue\(projectInfo\.projectId\);[\s\S]*function getWorkspacePageActionControllerRecoveryProjectId\([\s\S]*recoveryProjectId: string \| null,[\s\S]*function materializeWorkspacePageActionControllerRejectedResults\([\s\S]*results: PromiseSettledResult<unknown>\[\],[\s\S]*\): PromiseRejectedResult\[\][\s\S]*for \(const result of results\)[\s\S]*const isRejectedResult = result\.status === 'rejected';[\s\S]*function getWorkspacePageActionControllerFailureMessage\([\s\S]*failures: PromiseRejectedResult\[\],[\s\S]*fallback: string,[\s\S]*function getWorkspacePageActionControllerRuntimeFailureMessage\(error: unknown\): string[\s\S]*const persistedProject = getWorkspacePageActionControllerPersistedProject\(localState\.projectInfo\);[\s\S]*if \(persistedProject === null\)[\s\S]*const projectId = persistedProject\.projectId;[\s\S]*const recoveryProjectId = getWorkspacePageActionControllerRecoveryProjectId\(recoveringRuntimeProjectRef\.current\);[\s\S]*if \(recoveryProjectId !== null\)[\s\S]*materializeWorkspacePageActionControllerUpsertedMessages\(prev, nextMessage\)[\s\S]*const shouldUseMobileIdeView = shouldUseWorkspacePageActionControllerMobileIdeView\(shellState\.isMobile\);[\s\S]*if \(shouldUseMobileIdeView === true\)[\s\S]*shellState\.setMobileView\('ide'\);[\s\S]*const refreshFailures = materializeWorkspacePageActionControllerRejectedResults\(refreshResults\);[\s\S]*const failureMessage = getWorkspacePageActionControllerFailureMessage\([\s\S]*refreshFailures,[\s\S]*'后置真源刷新失败',[\s\S]*const failureMessage = getWorkspacePageActionControllerRuntimeFailureMessage\(error\);/,
  'runtime recovery controller should derive mobile IDE view, persisted project, in-flight guard and failure message facts through named readers before writing recovery messages',
);
assert.doesNotMatch(
  pageActionControllersSource,
  /localState\.projectInfo\?\.projectId|!currentProjectInfo|!currentProjectInfo\.projectId|!currentProjectInfo\.isPersisted|if \(recoveringRuntimeProjectRef\.current\)|if \(shellState\.isMobile\)|\.filter\(Boolean\)|refreshResults\.filter\(|prev\.findIndex\(\(message\) => message\.id === messageId\)|prev\.slice\(0, existingIndex\)|prev\.slice\(existingIndex \+ 1\)|failureMessage \|\| '未知错误'|reasonMessage \?|reasonMessage \|\| '运行时恢复失败'/,
  'runtime recovery controller should not regress recovery messages to optional project gates, truthy in-flight gates, inline rejected-result filtering, inline upsert materialization, filter(Boolean) or inline failure fallback',
);
assert.doesNotMatch(
  pageActionControllersSource,
  /handleRecoverRuntime[\s\S]*flowState\.setMessages\(\(prev\)/,
  'runtime recovery controller should not write recovery messages through the external setMessages compatibility wrapper',
);
assert.match(
  pageProjectActionsSource,
  /(?=[\s\S]*WorkspaceProjectPanelRefreshMessagesAction)(?=[\s\S]*export type WorkspacePageProjectActionsFlowState = \{[\s\S]*applyProjectPanelRefreshMessages: WorkspaceProjectPanelRefreshMessagesAction;[\s\S]*applyIdeInteractionMessages: WorkspaceMessageListAction;[\s\S]*applyResourceFileMessages: WorkspaceMessageListAction;[\s\S]*applyResourceGitMessages: WorkspaceMessageListAction;)(?=[\s\S]*function appendProjectPanelRefreshMessage\([\s\S]*applyProjectPanelRefreshMessages: WorkspaceProjectPanelRefreshMessagesAction,[\s\S]*message: WorkspaceChatMessage,[\s\S]*applyProjectPanelRefreshMessages\(\(prev\) => \[\.\.\.prev, message\]\);)/,
  'page project actions should use an explicit project panel refresh message helper',
);
assert.doesNotMatch(
  pageActionControllersSource + pageProjectActionsSource,
  /FlowState\['(?:applyRuntimeRecoveryMessages|applyProjectPanelRefreshMessages)'\]/,
  'runtime recovery and project panel refresh controllers should not infer message action contracts through FlowState indexed access',
);
assert.match(
  pageProjectActionsSource,
  /const \{ applyProjectPanelRefreshMessages \} = flowState;[\s\S]*refreshExplorerPanel[\s\S]*appendProjectPanelRefreshMessage\(applyProjectPanelRefreshMessages,[\s\S]*explorer-refresh-unavailable[\s\S]*appendProjectPanelRefreshMessage\(applyProjectPanelRefreshMessages,[\s\S]*explorer-refresh-recovered[\s\S]*appendProjectPanelRefreshMessage\(applyProjectPanelRefreshMessages,[\s\S]*explorer-refresh-retry-failed[\s\S]*refreshGitPanel[\s\S]*fetchProjectWorktreeStatus\(projectId, refreshOptions\)[\s\S]*fetchProjectCommits\(projectId, refreshOptions\)/,
  'Explorer refresh messages may route through project panel refresh action while Git manual refresh stays out of chat messages',
);
assert.doesNotMatch(
  refreshExplorerPanelSource,
  /setMessages\(\(prev\)/,
  'Explorer panel refresh should not write messages through the external setMessages compatibility wrapper',
);
assert.doesNotMatch(
  refreshGitPanelSource,
  /setMessages\(\(prev\)/,
  'Git panel refresh should not write messages through the external setMessages compatibility wrapper',
);
assert.match(
  pageAiActionsSource,
  /useWorkspacePageOrchestrationActions\(\{[\s\S]*flowState: \{[\s\S]*applyWorkspaceState: flowState\.applyWorkspaceState,[\s\S]*applyWorkflowStepToMessage: flowState\.applyWorkflowStepToMessage,[\s\S]*applyOrchestrationSharedMessages: flowState\.applyOrchestrationSharedMessages,[\s\S]*applyGenerationStateMessages: flowState\.applyGenerationStateMessages,[\s\S]*applyPlanGenerationMessages: flowState\.applyPlanGenerationMessages,[\s\S]*applyPlanStreamPatchMessages: flowState\.applyPlanStreamPatchMessages,[\s\S]*applyPlanImplementationMessages: flowState\.applyPlanImplementationMessages,[\s\S]*applyImplementationGenerationMessages: flowState\.applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages: flowState\.applyImplementationStreamPatchMessages,[\s\S]*setMessageStreamingState: flowState\.setMessageStreamingState,/,
  'page AI actions should pass orchestration shared, generation state, plan generation, plan stream patch, plan implementation, implementation generation and implementation stream patch actions to orchestration actions',
);
assert.doesNotMatch(
  pageAiActionsSource,
  /useWorkspacePageOrchestrationActions\(\{[\s\S]*flowState: \{[\s\S]*setMessages: flowState\.setMessages,/,
  'page AI orchestration wiring should not pass the external setMessages compatibility wrapper',
);
assert.match(
  pageOrchestrationActionsSource,
  /export type WorkspacePageOrchestrationFlowState = \{[\s\S]*messagesRef: RefObject<WorkspaceChatMessage\[\]>;[\s\S]*availablePlans: Plan\[\];[\s\S]*recommendedPlanId: string \| null;[\s\S]*selectedPlanId: string \| null;[\s\S]*updatePlanFlowState: \(patch: WorkspacePlanFlowStatePatch\) => void;[\s\S]*applyWorkspaceState: \([\s\S]*nextMessages: WorkspaceChatMessage\[\],[\s\S]*options\?: WorkspacePlanFlowStateApplyOptions,[\s\S]*\) => void;[\s\S]*applyWorkflowStepToMessage: \(messageId: string, step: WorkflowStep\) => void;[\s\S]*applyOrchestrationSharedMessages: WorkspaceMessageListAction;[\s\S]*applyGenerationStateMessages: WorkspaceMessageListAction;[\s\S]*applyPlanGenerationMessages: WorkspaceMessageListAction;[\s\S]*applyPlanStreamPatchMessages: WorkspaceMessageListAction;[\s\S]*applyPlanImplementationMessages: WorkspaceMessageListAction;[\s\S]*applyImplementationGenerationMessages: WorkspaceMessageListAction;[\s\S]*applyImplementationStreamPatchMessages: WorkspaceMessageListAction;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*\};[\s\S]*flowState: WorkspacePageOrchestrationFlowState;[\s\S]*const \{[\s\S]*applyOrchestrationSharedMessages,[\s\S]*applyGenerationStateMessages,[\s\S]*applyPlanGenerationMessages,[\s\S]*applyPlanStreamPatchMessages,[\s\S]*applyPlanImplementationMessages,[\s\S]*applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages,[\s\S]*useWorkspaceOrchestration\(\{[\s\S]*applyOrchestrationSharedMessages,[\s\S]*applyGenerationStateMessages,[\s\S]*applyPlanGenerationMessages,[\s\S]*applyPlanStreamPatchMessages,[\s\S]*applyPlanImplementationMessages,[\s\S]*applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages,/,
  'page orchestration actions should pass generation state, plan generation, plan stream patch, plan implementation, implementation generation and implementation stream patch actions through a named flow input contract',
);
assert.match(
  pageOrchestrationActionsSource,
  /export type WorkspacePageOrchestrationRuntimeResources = \{[\s\S]*fetchProjectDetail: \(projectId: string\) => Promise<void>;[\s\S]*refreshProjectFileTree: \([\s\S]*projectId: string,[\s\S]*force\?: boolean,[\s\S]*options\?: WorkspaceFileTreeRefreshOptions,[\s\S]*\) => Promise<void>;[\s\S]*ensureProjectRuntimeReady: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceRuntimeReadinessOptions,[\s\S]*\) => Promise<ProjectRuntimeStatus>;[\s\S]*fetchProjectCommits: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitCommit\[\]>;[\s\S]*\};[\s\S]*export type WorkspacePageOrchestrationProjectActions = \{[\s\S]*reflectFilePathInTree: \(path: string, leafType\?: FileNodeType\) => void;[\s\S]*applyIncrementalWorkflowStep: \(step: WorkflowStep\) => void;[\s\S]*\};[\s\S]*runtimeResources: WorkspacePageOrchestrationRuntimeResources;[\s\S]*projectActions: WorkspacePageOrchestrationProjectActions;/,
  'page orchestration actions should expose named runtime and project action input contracts',
);
assert.doesNotMatch(
  pageOrchestrationActionsSource,
  /type (FlowState|RuntimeResources|ProjectActions) = Pick<|Pick<Workspace(FlowState|RuntimeResources|PageProjectActions)Contract/,
  'page orchestration action inputs should not regress to Pick-derived flow, runtime or project action slices',
);
assert.match(
  orchestrationHookTypesSource,
  /applyPlanStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;/,
  'orchestration hook options should expose plan stream patch as an explicit message action',
);
assert.match(
  orchestrationHookTypesSource,
  /applyImplementationGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;/,
  'orchestration hook options should expose implementation generation as an explicit message action',
);
assert.match(
  orchestrationHookTypesSource,
  /applyImplementationStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;/,
  'orchestration hook options should expose implementation stream patch as an explicit message action',
);
assert.doesNotMatch(
  orchestrationHookTypesSource,
  /setMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;/,
  'orchestration hook options should not expose the external setMessages compatibility wrapper',
);
assert.match(
  orchestrationActionOptionBuildersSource,
  /buildImplementationActionOptions\([\s\S]*applyImplementationGenerationMessages: options\.applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages: options\.applyImplementationStreamPatchMessages,[\s\S]*applyPlanImplementationMessages: options\.applyPlanImplementationMessages,[\s\S]*applyGenerationStateMessages: options\.applyGenerationStateMessages,[\s\S]*persistGenerationState: options\.persistGenerationState,/,
  'implementation action options should pass implementation generation, implementation stream patch, plan implementation and generation state actions',
);
assert.doesNotMatch(
  orchestrationActionOptionBuildersSource.slice(
    orchestrationActionOptionBuildersSource.indexOf('export function buildImplementationActionOptions'),
    orchestrationActionOptionBuildersSource.indexOf('export function buildPlanningActionOptions'),
  ),
  /patchWorkspaceMessage: sharedActions\.patchWorkspaceMessage/,
  'implementation action options should not pass shared patchWorkspaceMessage into implementation generation',
);
assert.match(
  orchestrationImplementationActionsSource,
  /applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages,[\s\S]*applyGenerationStateMessages,[\s\S]*useWorkspaceImplementationGenerationAction\(\{[\s\S]*applyImplementationGenerationMessages,[\s\S]*applyGenerationStateMessages,[\s\S]*applyImplementationStreamPatchMessages,/,
  'orchestration implementation actions should pass implementation generation, implementation stream patch and generation state persistence actions to implementation generation',
);
assert.match(
  orchestrationImplementationActionsSource,
  /import type \{[\s\S]*ImplementationActionOptions,[\s\S]*WorkspaceOrchestrationImplementationActionsContract,[\s\S]*\} from '\.\/workspace-orchestration-action-types';[\s\S]*\}: ImplementationActionOptions\): WorkspaceOrchestrationImplementationActionsContract \{[\s\S]*return \{[\s\S]*choosePlanAndImplement,[\s\S]*handleLLMGenerate,/,
  'orchestration implementation actions hook should return the explicit implementation actions contract',
);
assert.match(
  orchestrationImplementationActionsSource,
  /applyPlanImplementationMessages,[\s\S]*useWorkspacePlanImplementationAction\(\{[\s\S]*setProjectInfo,[\s\S]*applyPlanImplementationMessages,[\s\S]*applyWorkspaceState,/,
  'orchestration implementation actions should pass plan implementation action to plan implementation flow without setMessages compatibility',
);
assert.doesNotMatch(
  orchestrationImplementationActionsSource,
  /setMessages/,
  'orchestration implementation actions should not depend on the external setMessages compatibility wrapper',
);
assert.match(
  orchestrationActionTypesSource,
  /export type ImplementationActions = \{[\s\S]*choosePlanAndImplement: WorkspacePlanImplementationActionContract;[\s\S]*handleLLMGenerate: WorkspaceImplementationGenerationActionContract;[\s\S]*\};[\s\S]*export type WorkspaceOrchestrationImplementationActionsContract =[\s\S]*ImplementationActions;/,
  'orchestration action types should expose implementation action aggregation as an explicit contract alias',
);
assert.match(
  orchestrationImplementationActionTypesSource,
  /import type \{ Dispatch, MutableRefObject, SetStateAction \} from 'react';[\s\S]*import type \{ GitCommit \} from '@\/lib\/types';[\s\S]*import type \{ WorkflowStep \} from '@\/components\/workspace\/chat-message-content';[\s\S]*ChatMode,[\s\S]*PersistGenerationState,[\s\S]*WorkspaceChatMessage,[\s\S]*WorkspaceEventMessageResolver,[\s\S]*WorkspaceGeneratedFilesEventReader,[\s\S]*WorkspaceGuidanceResolver,[\s\S]*WorkspaceProjectInfo,[\s\S]*NormalizeWorkflowStep,[\s\S]*ResolveStepEngineeringState,[\s\S]*SafeParseJSON,[\s\S]*ApplyWorkspaceState[\s\S]*import type \{[\s\S]*WorkspaceImplementationGenerationActionContract as CoreWorkspaceImplementationGenerationActionContract,[\s\S]*WorkspacePlanImplementationActionContract as CoreWorkspacePlanImplementationActionContract,[\s\S]*\} from '\.\/workspace-orchestration-actions-contract';[\s\S]*export type ImplementationGenerationAction =[\s\S]*CoreWorkspaceImplementationGenerationActionContract;[\s\S]*export type WorkspaceImplementationGenerationActionContract =[\s\S]*CoreWorkspaceImplementationGenerationActionContract;[\s\S]*export type ImplementationGenerationActionOptions = \{[\s\S]*projectInfo: WorkspaceProjectInfo \| null;[\s\S]*chatMode: ChatMode;[\s\S]*isOnline: boolean;[\s\S]*selectedModel: string;[\s\S]*files: Map<string, string>;[\s\S]*savedFiles: Map<string, string>;[\s\S]*generationAbortRef: MutableRefObject<AbortController \| null>;[\s\S]*applyImplementationGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*applyImplementationStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*applyGenerationStateMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*setFiles: Dispatch<SetStateAction<Map<string, string>>>;[\s\S]*setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;[\s\S]*setIsGenerating: Dispatch<SetStateAction<boolean>>;[\s\S]*setIsStopConfirming: Dispatch<SetStateAction<boolean>>;[\s\S]*setGenerationStage: Dispatch<SetStateAction<string>>;[\s\S]*persistGenerationState: PersistGenerationState;[\s\S]*applyWorkflowStepToMessage: \(messageId: string, step: WorkflowStep\) => void;[\s\S]*applyIncrementalWorkflowStep: \(step: WorkflowStep\) => void;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*yieldStepRender: \(\) => Promise<void>;[\s\S]*reflectFilePathInTree: \(filePath: string\) => void;[\s\S]*fetchProjectDetail: \(projectId: string\) => Promise<void>;[\s\S]*refreshProjectFileTree: \([\s\S]*projectId: string,[\s\S]*force\?: boolean,[\s\S]*options\?: \{[\s\S]*throwOnFailure\?: boolean;[\s\S]*suppressNotice\?: boolean;[\s\S]*\},[\s\S]*\) => Promise<void>;[\s\S]*fetchProjectCommits: \(projectId: string\) => Promise<GitCommit\[\]>;[\s\S]*safeParseJSON: SafeParseJSON;[\s\S]*appendStatusLine: \(current: string, nextLine: string\) => string;[\s\S]*appendReasoningChunk: \(current: string, nextChunk: string\) => string;[\s\S]*normalizeWorkflowStep: NormalizeWorkflowStep;[\s\S]*getEventMessage: WorkspaceEventMessageResolver;[\s\S]*getGeneratedFilesFromEvent: WorkspaceGeneratedFilesEventReader;[\s\S]*getGuidanceFromEvent: WorkspaceGuidanceResolver;[\s\S]*resolveStepEngineeringState: ResolveStepEngineeringState;[\s\S]*\};[\s\S]*export type PlanImplementationAction =[\s\S]*CoreWorkspacePlanImplementationActionContract;[\s\S]*export type WorkspacePlanImplementationActionContract =[\s\S]*CoreWorkspacePlanImplementationActionContract;[\s\S]*export type PlanImplementationBaseActionOptions = \{[\s\S]*projectInfo: WorkspaceProjectInfo \| null;[\s\S]*isOnline: boolean;[\s\S]*availablePlans: Plan\[\];[\s\S]*recommendedPlanId: string \| null;[\s\S]*selectedPlanId: string \| null;[\s\S]*messagesRef: MutableRefObject<WorkspaceChatMessage\[\]>;[\s\S]*implementingPlanRef: MutableRefObject<boolean>;[\s\S]*autoPlanTriggeredRef: MutableRefObject<boolean>;[\s\S]*setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo \| null>>;[\s\S]*applyPlanImplementationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*applyWorkspaceState: ApplyWorkspaceState;[\s\S]*ensureProjectRuntimeReady: \([\s\S]*projectId: string,[\s\S]*options\?: \{[\s\S]*initialStage\?: string;[\s\S]*waitStage\?: string;[\s\S]*\},[\s\S]*\) => Promise<unknown>;[\s\S]*createPersistedProject: \(plan: Plan\) => Promise<WorkspaceProjectInfo>;[\s\S]*persistWorkspaceProject: \(nextProject: WorkspaceProjectInfo\) => void;[\s\S]*updatePlanFlowState: UpdatePlanFlowState;[\s\S]*\};[\s\S]*export type PlanImplementationActionOptions = PlanImplementationBaseActionOptions & \{[\s\S]*handleLLMGenerate: WorkspaceImplementationGenerationActionContract;/,
  'implementation action types should expose implementation generation and plan implementation as explicit contract aliases derived from the core orchestration actions contract',
);
assert.doesNotMatch(
  orchestrationImplementationActionTypesSource,
  /export type ImplementationGenerationActionOptions = Pick<[\s\S]*UseWorkspaceOrchestrationOptions/,
  'implementation generation action options should not regress to a Pick-derived orchestration options slice',
);
assert.doesNotMatch(
  orchestrationImplementationActionTypesSource,
  /export type PlanImplementationBaseActionOptions = Pick<[\s\S]*UseWorkspaceOrchestrationOptions/,
  'plan implementation base action options should not regress to a Pick-derived orchestration options slice',
);
assert.doesNotMatch(
  orchestrationImplementationActionTypesSource,
  /WorkspaceOrchestrationActionsContract\['(?:handleLLMGenerate|choosePlanAndImplement)'\]|Omit<PlanImplementationActionOptions,\s*['"]handleLLMGenerate['"]>/,
  'implementation action types should not infer single action contracts through WorkspaceOrchestrationActionsContract indexed access or derive base plan options with Omit',
);
assert.doesNotMatch(
  orchestrationImplementationActionTypesSource,
  /patchWorkspaceMessage/,
  'implementation action types should not expose shared patchWorkspaceMessage to implementation generation',
);
assert.doesNotMatch(
  orchestrationImplementationActionTypesSource,
  /'setMessages'/,
  'implementation action types should not pick the external setMessages compatibility wrapper',
);
assert.match(
  implementationGenerationActionSource,
  /import type \{[\s\S]*ImplementationGenerationActionOptions,[\s\S]*WorkspaceImplementationGenerationActionContract,[\s\S]*\} from '\.\/workspace-orchestration-implementation-action-types';[\s\S]*\}: ImplementationGenerationActionOptions\): WorkspaceImplementationGenerationActionContract \{/,
  'implementation generation hook should return the explicit implementation generation action contract',
);
assert.match(
  implementationGenerationActionSource,
  /applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages,[\s\S]*applyGenerationStateMessages,[\s\S]*runWorkspaceImplementationGeneration\(\{[\s\S]*applyImplementationGenerationMessages,[\s\S]*applyImplementationStreamPatchMessages,[\s\S]*applyGenerationStateMessages,/,
  'implementation generation hook should pass implementation generation, implementation stream patch and generation state persistence actions to the execution layer',
);
assert.match(
  planImplementationActionSource,
  /import type \{[\s\S]*PlanImplementationActionOptions,[\s\S]*WorkspacePlanImplementationActionContract,[\s\S]*\} from '\.\/workspace-orchestration-implementation-action-types';[\s\S]*\}: PlanImplementationActionOptions\): WorkspacePlanImplementationActionContract \{/,
  'plan implementation hook should return the explicit plan implementation action contract',
);
assert.match(
  planImplementationActionSource,
  /(?=[\s\S]*function hasPlanImplementationProjectIdValue\(value: string \| null \| undefined\): value is string \{[\s\S]*if \(value === null \|\| value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;)(?=[\s\S]*function getPlanImplementationProject\(projectInfo: WorkspaceProjectInfo \| null\): WorkspaceProjectInfo \| null \{[\s\S]*if \(projectInfo === null\)[\s\S]*const hasProjectId = hasPlanImplementationProjectIdValue\(projectInfo\.projectId\);[\s\S]*if \(hasProjectId === true\)[\s\S]*return projectInfo;)(?=[\s\S]*function hasPlanImplementationSelectedPlan\(selectedPlanId: string \| null \| undefined\): selectedPlanId is string \{[\s\S]*return hasPlanImplementationProjectIdValue\(selectedPlanId\);)(?=[\s\S]*function isPlanImplementationInProgress\(implementingPlan: boolean\): boolean \{[\s\S]*return implementingPlan === true;)(?=[\s\S]*function shouldBlockPlanImplementationSelectedPlan\(\{[\s\S]*hasSelectedPlan: boolean;[\s\S]*selectedPlanId: string \| null;[\s\S]*planId: string;[\s\S]*if \(hasSelectedPlan === false\)[\s\S]*return selectedPlanId !== planId;)(?=[\s\S]*function getPlanImplementationAvailablePlans\(\{[\s\S]*availablePlans: Plan\[\];[\s\S]*plan: Plan;[\s\S]*const hasAvailablePlans = availablePlans\.length > 0;[\s\S]*return \[plan\];)(?=[\s\S]*function shouldClearPlanImplementationSelection\(message: WorkspaceChatMessage, planId: string\): boolean[\s\S]*const isPlanOptionsMessage = message\.kind === 'plan-options';[\s\S]*return message\.selectedPlanId === planId;)(?=[\s\S]*function clearPlanImplementationSelection\(messages: WorkspaceChatMessage\[\], planId: string\): WorkspaceChatMessage\[\] \{[\s\S]*const clearedMessages: WorkspaceChatMessage\[\] = \[\];[\s\S]*for \(const message of messages\)[\s\S]*const shouldClearSelection = shouldClearPlanImplementationSelection\(message, planId\);[\s\S]*clearedMessages\.push\(message\);)(?=[\s\S]*const effectiveProject = getPlanImplementationProject\(projectInfo\);[\s\S]*if \(effectiveProject === null\) return;)(?=[\s\S]*const implementationInProgress = isPlanImplementationInProgress\(implementingPlanRef\.current\);[\s\S]*if \(implementationInProgress === true\) return;)(?=[\s\S]*const hasSelectedPlan = hasPlanImplementationSelectedPlan\(selectedPlanId\);[\s\S]*const shouldBlockSelectedPlan = shouldBlockPlanImplementationSelectedPlan\(\{[\s\S]*hasSelectedPlan,[\s\S]*selectedPlanId,[\s\S]*planId: plan\.id,[\s\S]*\}\);[\s\S]*if \(shouldBlockSelectedPlan === true\) return;)(?=[\s\S]*availablePlans: getPlanImplementationAvailablePlans\(\{[\s\S]*availablePlans,[\s\S]*plan,[\s\S]*\}\),)(?=[\s\S]*projectInfo: effectiveProject,)/,
  'plan implementation hook should derive project id, in-progress and selected plan gates through explicit facts',
);
assert.doesNotMatch(
  planImplementationActionSource,
  /if \(!projectInfo\?\.projectId\) return;|if \(implementingPlanRef\.current\) return;|if \(selectedPlanId && selectedPlanId !== plan\.id\) return;|hasSelectedPlan === true && selectedPlanId !== plan\.id|availablePlans\.length > 0 \? availablePlans : \[plan\]|messages\.map\(\(message\) => \(/,
  'plan implementation hook should not regress to optional project id, truthy in-progress or truthy selected plan gates',
);
assert.doesNotMatch(
  implementationGenerationActionSource,
  /setMessages/,
  'implementation generation hook should not depend on the external setMessages compatibility wrapper',
);
assert.match(
  orchestrationExecutionTypesSource,
  /applyImplementationGenerationMessages: \(value: SetStateAction<WorkspaceChatMessage\[\]>\) => void;[\s\S]*applyImplementationStreamPatchMessages: \(value: SetStateAction<WorkspaceChatMessage\[\]>\) => void;[\s\S]*applyGenerationStateMessages: \(value: SetStateAction<WorkspaceChatMessage\[\]>\) => void;/,
  'implementation generation execution options should require explicit implementation generation, implementation stream patch and generation state actions',
);
assert.doesNotMatch(
  orchestrationExecutionTypesSource.slice(
    orchestrationExecutionTypesSource.indexOf('export type RunWorkspaceImplementationGenerationOptions'),
    orchestrationExecutionTypesSource.indexOf('export type RunWorkspacePlanGenerationOptions'),
  ),
  /patchWorkspaceMessage/,
  'implementation generation execution options should not expose shared patchWorkspaceMessage',
);
assert.doesNotMatch(
  orchestrationExecutionTypesSource,
  /setMessages: \(value: SetStateAction<WorkspaceChatMessage\[\]>\) => void;/,
  'implementation generation execution options should not expose the external setMessages compatibility wrapper',
);
assert.match(
  orchestrationImplementationExecutionSource,
  /WorkspaceChatMessage[\s\S]*type WorkspaceImplementationStreamPatchMessageList = WorkspaceChatMessage\[\];[\s\S]*type WorkspaceImplementationStreamPatchMessageMaterializerInput = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*messageId: string;[\s\S]*patch: WorkspaceMessagePatch;[\s\S]*\};[\s\S]*function materializeWorkspaceImplementationStreamPatchMessages\(\{[\s\S]*messages,[\s\S]*messageId,[\s\S]*patch,[\s\S]*\}: WorkspaceImplementationStreamPatchMessageMaterializerInput\): WorkspaceImplementationStreamPatchMessageList \{[\s\S]*const nextMessages: WorkspaceImplementationStreamPatchMessageList = \[\];[\s\S]*for \(const message of messages\)[\s\S]*if \(message\.id !== messageId\)[\s\S]*const nextPatch = typeof patch === 'function' \? patch\(message\) : patch;[\s\S]*const hasNextPatch = nextPatch !== null && nextPatch !== undefined;[\s\S]*if \(hasNextPatch === false\)[\s\S]*nextMessages\.push\(\{[\s\S]*\.\.\.message,[\s\S]*\.\.\.nextPatch,[\s\S]*\}\);[\s\S]*return nextMessages;[\s\S]*applyImplementationStreamPatchMessages,[\s\S]*const patchImplementationStreamMessage = \([\s\S]*applyImplementationStreamPatchMessages\(\(prev\) => materializeWorkspaceImplementationStreamPatchMessages\(\{[\s\S]*messages: prev,[\s\S]*messageId,[\s\S]*patch,[\s\S]*\}\)\);[\s\S]*createImplementationStreamingUpdaters\([\s\S]*patchImplementationStreamMessage,[\s\S]*buildImplementationStreamContext\([\s\S]*patchImplementationStreamMessage,[\s\S]*handleImplementationStreamFailure\((?:error|streamFailure), \{[\s\S]*patchImplementationStreamMessage,/,
  'implementation generation execution should route running, done and failure stream patches through the implementation stream patch action',
);
assert.match(
  orchestrationImplementationExecutionSource,
  /applyImplementationGenerationMessages,[\s\S]*initializeImplementationGeneration\(\{[\s\S]*applyImplementationGenerationMessages,[\s\S]*applyGenerationStateMessages,/,
  'implementation generation execution should pass the explicit implementation generation action to initialization',
);
assert.doesNotMatch(
  orchestrationImplementationExecutionSource,
  /patchWorkspaceMessage|prev\.map\(\(message\) =>/,
  'implementation generation execution should not depend on shared patchWorkspaceMessage',
);
assert.match(
  implementationStreamTypesSource,
  /patchImplementationStreamMessage: \(messageId: string, patch: WorkspaceMessagePatch\) => void;/,
  'implementation stream context should expose a dedicated implementation stream patch helper',
);
assert.match(
  implementationStreamTypesSource,
  /export type ImplementationStreamContextInput = \{[\s\S]*appendReasoningChunk: \(current: string, nextChunk: string\) => string;[\s\S]*patchImplementationStreamMessage: \(messageId: string, patch: WorkspaceMessagePatch\) => void;[\s\S]*resolveStepEngineeringState: ResolveStepEngineeringState;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*yieldStepRender: \(\) => Promise<void>;[\s\S]*\};/,
  'implementation stream context builder input should be represented by an explicit named contract',
);
assert.match(
  workspaceTypesSource,
  /export type WorkspaceSuggestedQuestion = string;[\s\S]*export type WorkspaceSuggestedQuestionList = WorkspaceSuggestedQuestion\[\];[\s\S]*export type WorkspaceFallbackQuestion = string;[\s\S]*export type WorkspaceFallbackQuestionList = WorkspaceFallbackQuestion\[\];[\s\S]*export type WorkspaceGuidanceResolution = \{[\s\S]*suggestedQuestions: WorkspaceSuggestedQuestionList;[\s\S]*suggestedActions: GuidanceAction\[\];[\s\S]*\};[\s\S]*export type WorkspaceGuidanceResolver = \([\s\S]*data: WorkspaceStreamEventData,[\s\S]*fallbackQuestions: WorkspaceFallbackQuestionList,[\s\S]*fallbackActions: GuidanceAction\[\],[\s\S]*\) => WorkspaceGuidanceResolution;/,
  'workspace guidance resolver should expose explicit guidance resolution and resolver contracts',
);
assert.doesNotMatch(
  workspaceTypesSource,
  /suggestedQuestions: string\[\];|fallbackQuestions: string\[\],/,
  'workspace guidance resolver should not regress suggested or fallback question lists to anonymous string arrays',
);
assert.match(
  chatMessageContentSource,
  /WorkspaceSuggestedQuestionList[\s\S]*suggestedQuestions\?: WorkspaceSuggestedQuestionList;/,
  'chat message content should consume the named suggested question list contract',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /suggestedQuestions\?: string\[\];/,
  'chat message content should not regress suggested questions to an anonymous string array',
);
assert.match(
  `${implementationStreamTypesSource}\n${orchestrationExecutionTypesSource}\n${orchestrationHookTypesSource}\n${planMessageHelpersSource}\n${implementationFinalizationEffectsSource}`,
  /(?=[\s\S]*getGuidanceFromEvent: WorkspaceGuidanceResolver;)(?=[\s\S]*export function getGuidanceFromEvent\([\s\S]*\): WorkspaceGuidanceResolution)(?=[\s\S]*getGuidanceFromEvent: WorkspaceGuidanceResolver)(?=[\s\S]*buildImplementationDoneMessagePatch\([\s\S]*getGuidanceFromEvent: WorkspaceGuidanceResolver)/,
  'implementation guidance resolution should consume WorkspaceGuidanceResolver across stream context, orchestration options, helper, and finalization patches',
);
assert.match(
  planMessageHelpersSource,
  /export function getGuidanceFromEvent\([\s\S]*const hasSuggestedQuestions = suggestedQuestions\.length > 0;[\s\S]*const hasSuggestedActions = suggestedActions\.length > 0;[\s\S]*suggestedQuestions: hasSuggestedQuestions === true \? suggestedQuestions : fallbackQuestions,[\s\S]*suggestedActions: hasSuggestedActions === true \? suggestedActions : fallbackActions,/,
  'workspace plan guidance resolver should select event guidance or fallback guidance through explicit presence facts',
);
assert.doesNotMatch(
  `${implementationStreamTypesSource}\n${orchestrationExecutionTypesSource}\n${orchestrationHookTypesSource}\n${implementationFinalizationEffectsSource}`,
  /ImplementationStreamContext\['getGuidanceFromEvent'\]|getGuidanceFromEvent: \([\s\S]*fallbackQuestions: string\[\],[\s\S]*fallbackActions: GuidanceAction\[\],[\s\S]*\) => \{[\s\S]*suggestedQuestions: string\[\];[\s\S]*suggestedActions: GuidanceAction\[\];[\s\S]*\};/,
  'implementation guidance resolution should not infer or duplicate the guidance resolver contract inline',
);
assert.match(
  planMessageHelpersSource,
  /export type PlanSearchTerm = string;[\s\S]*export type PlanSearchTermList = PlanSearchTerm\[\];[\s\S]*export type PlanOrdinalDigit = string;[\s\S]*export type PlanOrdinalValue = number;[\s\S]*export type PlanOrdinalDigitMap = \{[\s\S]*\[digit: PlanOrdinalDigit\]: PlanOrdinalValue;[\s\S]*\};[\s\S]*const PLAN_ORDINAL_DIGIT_MAP: PlanOrdinalDigitMap = \{[\s\S]*function getPlanOrdinalCharacter\(text: string, targetIndex: number\): PlanOrdinalDigit \| undefined \{[\s\S]*for \(const character of text\)[\s\S]*function getPlanOrdinalDigitValue\(digit: PlanOrdinalDigit \| undefined\): PlanOrdinalValue \| undefined \{[\s\S]*return PLAN_ORDINAL_DIGIT_MAP\[digit\];[\s\S]*function parsePlanOrdinal\(value: string\): number \| null \{[\s\S]*const directOrdinalValue = getPlanOrdinalDigitValue\(text\);[\s\S]*const firstCharacter = getPlanOrdinalCharacter\(text, 0\);[\s\S]*const secondCharacter = getPlanOrdinalCharacter\(text, 1\);[\s\S]*const thirdCharacter = getPlanOrdinalCharacter\(text, 2\);[\s\S]*function resolvePlanByOrdinal\(plans: Plan\[\], ordinal: number\): Plan \| undefined \{[\s\S]*for \(const plan of plans\)[\s\S]*return plan;[\s\S]*function findPlanByOrdinalInput\(input: string, plans: Plan\[\]\): Plan \| null \| undefined[\s\S]*return resolvePlanByOrdinal\(plans, ordinal\);[\s\S]*function getPlanSearchTerms\(plan: Plan\): PlanSearchTermList \{[\s\S]*const terms: PlanSearchTermList = \[[\s\S]*plan\.name,[\s\S]*getTechStackProfile\(plan\.tech_stack\),[\s\S]*\.\.\.getTechStackLabels\(plan\.tech_stack\),/,
  'workspace plan message helper should name the plan search term list contract',
);
assert.match(
  planMessageHelpersSource,
  /function normalizeSuggestionLabel\(raw: string\): string \{[\s\S]*const hasText = text\.length > 0;[\s\S]*if \(hasText === false\) return '';[\s\S]*function getPlanMessageEventSuggestedQuestions\(data: WorkspaceStreamEventData\): unknown\[\][\s\S]*function getPlanMessageEventSuggestedActions\(data: WorkspaceStreamEventData\): unknown\[\][\s\S]*function isPlanMessageEventSuggestedQuestion\(item: unknown\): item is WorkspaceSuggestedQuestion[\s\S]*function isPlanMessageEventSuggestedAction\(item: unknown\): item is PlanMessageEventSuggestedAction[\s\S]*const hasActionObject = item !== null && item !== undefined && typeof item === 'object';[\s\S]*function getPlanMessageNormalizedSuggestedQuestions\(items: unknown\[\]\): WorkspaceSuggestedQuestionList[\s\S]*const normalizedQuestions: WorkspaceSuggestedQuestionList = \[\];[\s\S]*const seenQuestions = new Set<string>\(\);[\s\S]*for \(const item of items\)[\s\S]*function getPlanMessageNormalizedSuggestedActions\(items: unknown\[\]\): GuidanceAction\[\][\s\S]*const normalizedActions: GuidanceAction\[\] = \[\];[\s\S]*for \(const item of items\)[\s\S]*export function getSuggestedQuestionsFromEvent[\s\S]*const suggestedQuestions = getPlanMessageEventSuggestedQuestions\(data\);[\s\S]*return getPlanMessageNormalizedSuggestedQuestions\(suggestedQuestions\);[\s\S]*export function getSuggestedActionsFromEvent[\s\S]*const suggestedActions = getPlanMessageEventSuggestedActions\(data\);[\s\S]*return getPlanMessageNormalizedSuggestedActions\(suggestedActions\);/,
  'workspace plan message helper should normalize event guidance through explicit parser facts',
);
assert.match(
  planMessageHelpersSource,
  /(?=[\s\S]*function hasPlanMessageRegexMatch\(match: RegExpMatchArray \| null\): match is RegExpMatchArray)(?=[\s\S]*function getPlanMessageRegexCapture\(match: RegExpMatchArray \| null, index: number\): string)(?=[\s\S]*function classifyPendingPlanIntent\(rawInput: string\): PendingPlanIntent \{[\s\S]*const hasNormalizedInput = normalized\.length > 0;[\s\S]*if \(hasNormalizedInput === false\) return 'replan';)(?=[\s\S]*function parsePlanOrdinal\(value: string\): number \| null \{[\s\S]*const hasText = text\.length > 0;[\s\S]*if \(hasText === false\) return null;)(?=[\s\S]*const rawOrdinal = getPlanMessageRegexCapture\(match, 1\);[\s\S]*const hasRawOrdinal = rawOrdinal\.length > 0;[\s\S]*if \(hasRawOrdinal === false\) continue;[\s\S]*const hasOrdinal = ordinal !== null;[\s\S]*if \(hasOrdinal === false\) continue;)(?=[\s\S]*function findPlansByNameOrTech\(input: string, plans: Plan\[\]\): Plan\[\] \{[\s\S]*const hasNormalizedInput = normalizedInput\.length > 0;[\s\S]*if \(hasNormalizedInput === false\) return \[\];)/,
  'workspace plan message helper should derive pending intent parser gates explicitly',
);
assert.doesNotMatch(
  planMessageHelpersSource,
  /function getPlanSearchTerms\(plan: Plan\): string\[\]|const terms: string\[\] = \[|const digitMap: Record<string, number>|text\[[0-9]+\]|plans\[ordinal - 1\]/,
  'workspace plan message helper should not regress plan search terms to anonymous string arrays or plan ordinal digits to an anonymous Record map',
);
assert.match(
  planMessageHelpersSource,
  /export type WorkspaceRecommendedPlanList = Plan\[\];[\s\S]*function getWorkspaceFirstRecommendedPlan\(plans: WorkspaceRecommendedPlanList\): Plan \| undefined \{[\s\S]*for \(const plan of plans\)[\s\S]*return plan;[\s\S]*return undefined;[\s\S]*export function getWorkspaceRecommendedPlan\([\s\S]*plans: WorkspaceRecommendedPlanList,[\s\S]*recommendedPlanId\?: string \| null,[\s\S]*\): Plan \| undefined \{[\s\S]*const matchedRecommendedPlan = getWorkspaceMatchedRecommendedPlan\(plans, recommendedPlanId\);[\s\S]*const hasMatchedRecommendedPlan = matchedRecommendedPlan !== undefined;[\s\S]*if \(hasMatchedRecommendedPlan === true\)[\s\S]*const fallbackRecommendedPlan = getWorkspaceFirstRecommendedPlan\(plans\);[\s\S]*const hasFallbackRecommendedPlan = fallbackRecommendedPlan !== undefined;[\s\S]*if \(hasFallbackRecommendedPlan === true\)[\s\S]*function getWorkspaceMatchedRecommendedPlan\([\s\S]*for \(const plan of plans\)[\s\S]*const isRecommendedPlan = plan\.id === recommendedPlanId;[\s\S]*export function getWorkspaceRecommendedPlanId\([\s\S]*\): string \| null \{[\s\S]*const recommendedPlan = getWorkspaceRecommendedPlan\(plans, recommendedPlanId\);[\s\S]*const hasRecommendedPlan = recommendedPlan !== undefined;[\s\S]*function buildPlanSuggestedActions\(plans: Plan\[\],[\s\S]*const hasPlans = plans\.length > 0;[\s\S]*if \(hasPlans === false\) return \[\];[\s\S]*const recommendedPlan = getWorkspaceRecommendedPlan\(plans, recommendedPlanId\);[\s\S]*const hasRecommendedPlan = recommendedPlan !== undefined;[\s\S]*if \(hasRecommendedPlan === true\)/,
  'workspace plan suggested actions should derive recommended-plan fallback through explicit facts',
);
assert.match(
  planMessageHelpersSource,
  /function getSingleMatchedPlan\(plans: Plan\[\]\): Plan \| null \| undefined \{[\s\S]*if \(plans\.length === 0\)[\s\S]*return null;[\s\S]*if \(plans\.length > 1\)[\s\S]*return undefined;[\s\S]*for \(const plan of plans\)[\s\S]*return plan;[\s\S]*return null;[\s\S]*const matchedPlans = findPlansByNameOrTech\(input, plans\);[\s\S]*return getSingleMatchedPlan\(matchedPlans\);/,
  'workspace referenced plan resolution should derive the single matched plan through a named reader',
);
assert.doesNotMatch(
  planMessageHelpersSource,
  /plans\.at\(0\)|matchedPlans\[0\]/,
  'workspace plan suggested actions and referenced plan resolution should not regress to direct first item access',
);
assert.match(
  planMessageHelpersSource,
  /(?=[\s\S]*function getPlanMessageSuggestedQuestions\(message: WorkspaceChatMessage\): WorkspaceSuggestedQuestionList)(?=[\s\S]*function getPlanMessageSuggestedActions\(message: WorkspaceChatMessage\): GuidanceAction\[\])(?=[\s\S]*export function enrichPlanMessageGuidance\(message: WorkspaceChatMessage\): WorkspaceChatMessage \{[\s\S]*const isPlanOptionsMessage = message\.kind === 'plan-options';[\s\S]*const messagePlans = Array\.isArray\(message\.plans\) \? message\.plans : \[\];[\s\S]*const hasMessagePlans = messagePlans\.length > 0;[\s\S]*const isPlanSuperseded = message\.planSuperseded === true;[\s\S]*const planStreamComplete = message\.planStreamComplete === true;[\s\S]*const suggestedQuestions = getPlanMessageSuggestedQuestions\(message\);[\s\S]*const hasSuggestedQuestions = suggestedQuestions\.length > 0;[\s\S]*const suggestedActions = getPlanMessageSuggestedActions\(message\);[\s\S]*const hasSuggestedActions = suggestedActions\.length > 0;[\s\S]*const shouldSkipGuidanceEnrichment = planStreamComplete === false[\s\S]*hasSuggestedQuestions === false[\s\S]*hasSuggestedActions === false;)/,
  'workspace plan message guidance enrichment should derive message kind, plan list, stream and guidance presence through explicit facts',
);
assert.match(
  planMessageHelpersSource,
  /(?=[\s\S]*function getPlanMessageTrimmedTextValue\(value: string \| null \| undefined\): string)(?=[\s\S]*function getPlanClarifyPlanList\(plans: Plan\[\]\): string[\s\S]*const planLines: string\[\] = \[\];[\s\S]*for \(const plan of plans\))(?=[\s\S]*function getPlanClarifyReasonMessage\(reason\?: string\): string[\s\S]*const reasonMessage = getPlanMessageTrimmedTextValue\(reason\);[\s\S]*const hasReasonMessage = reasonMessage\.length > 0;[\s\S]*if \(hasReasonMessage === true\))(?=[\s\S]*function getPlanClarifyPlanListSection\(planList: string\): string[\s\S]*const hasPlanList = planList\.length > 0;[\s\S]*if \(hasPlanList === true\))(?=[\s\S]*function getPlanClarifyMessageSections\([\s\S]*const candidateSections = \[[\s\S]*getPlanClarifyReasonMessage\(reason\),[\s\S]*getPlanClarifyPlanListSection\(planList\),[\s\S]*const sections: string\[\] = \[\];[\s\S]*for \(const section of candidateSections\))(?=[\s\S]*function buildPlanClarifyMessage\(plans: Plan\[\], reason\?: string\) \{[\s\S]*const planList = getPlanClarifyPlanList\(plans\);[\s\S]*const clarifyMessageSections = getPlanClarifyMessageSections\()/,
  'workspace plan clarify message should derive reason and plan-list sections through explicit presence facts',
);
assert.match(
  planMessageHelpersSource,
  /(?=[\s\S]*function getPlanMessageWorkflowSteps\(message: WorkspaceChatMessage\): PlanMessageWorkflowStepList)(?=[\s\S]*function getWorkspaceFocusedPlan\([\s\S]*plans: WorkspaceRecommendedPlanList,[\s\S]*focusedPlanId\?: string \| null,[\s\S]*\): Plan \| null[\s\S]*for \(const plan of plans\))(?=[\s\S]*function shouldDiscussPendingPlanQuestion\([\s\S]*implementationRequest: boolean;[\s\S]*\): boolean)(?=[\s\S]*function shouldConfirmRecommendedPlan\([\s\S]*hasRecommendedPlan: boolean;[\s\S]*\): boolean)(?=[\s\S]*function canConfirmPendingContextPlan\(input: string, normalized: string\): boolean)(?=[\s\S]*function shouldConfirmReferencedPlan\([\s\S]*hasReferencedPlan: boolean;[\s\S]*implementationRequest: boolean;[\s\S]*\): boolean)(?=[\s\S]*function shouldReplanForConstraintChange\([\s\S]*constraintChange: boolean;[\s\S]*implementationRequest: boolean;[\s\S]*\): boolean)(?=[\s\S]*function shouldSupersedePlanSelectionMessage\(message: WorkspaceChatMessage\): boolean)(?=[\s\S]*export function supersedePlanSelectionMessages\(messages: WorkspaceChatMessage\[\]\)[\s\S]*const normalizedMessages: WorkspaceChatMessage\[\] = \[\];[\s\S]*for \(const message of messages\))(?=[\s\S]*function shouldKeepActivePlanSelectionMessage\([\s\S]*activePlanMessageSeen: boolean;[\s\S]*message: WorkspaceChatMessage;[\s\S]*\): boolean)(?=[\s\S]*export function normalizePlanSelectionMessages\(messages: WorkspaceChatMessage\[\]\): WorkspaceChatMessage\[\][\s\S]*const normalizedMessages: WorkspaceChatMessage\[\] = \[\];[\s\S]*for \(let index = messages\.length - 1; index >= 0; index -= 1\))(?=[\s\S]*function hasPlanMessageContent\(content: string\): boolean[\s\S]*return hasContent === true;)(?=[\s\S]*function shouldKeepLegacyPlaceholderMessage\(message: WorkspaceChatMessage\): boolean[\s\S]*const workflowSteps = getPlanMessageWorkflowSteps\(message\);[\s\S]*const hasWorkflowSteps = workflowSteps\.length > 0;[\s\S]*const reasoningContent = getPlanMessageTrimmedTextValue\(message\.reasoningContent\);[\s\S]*const hasReasoningContent = hasPlanMessageContent\(reasoningContent\);[\s\S]*const statusContent = getPlanMessageTrimmedTextValue\(message\.statusContent\);[\s\S]*const hasStatusContent = hasPlanMessageContent\(statusContent\);)(?=[\s\S]*export function removeLegacyPlaceholderMessages\(messages: WorkspaceChatMessage\[\]\): WorkspaceChatMessage\[\][\s\S]*const retainedMessages: WorkspaceChatMessage\[\] = \[\];[\s\S]*for \(const message of messages\))/,
  'workspace plan message helper should normalize active plan selection and legacy placeholders through explicit facts',
);
assert.doesNotMatch(
  planMessageHelpersSource,
  /suggestedQuestions: suggestedQuestions\.length > 0 \? suggestedQuestions : fallbackQuestions|suggestedActions: suggestedActions\.length > 0 \? suggestedActions : fallbackActions|plans\.find\(\(plan\) => plan\.id === recommendedPlanId\)|plans\.find\(\(plan\) => plan\.id === focusedPlanId\)|plans\.find\(\(plan\) => plan\.id === recommendedPlanId\) \|\| plans\[0\]|const fallbackRecommendedPlan = plans\[0\]|const recommendedPlan = matchedRecommendedPlan \?\? fallbackRecommendedPlan|suggestedQuestions: message\.suggestedQuestions \|\| \[\]|message\.suggestedQuestions \?\? \[\]|message\.suggestedActions \?\? \[\]|message\.workflowSteps \?\? \[\]|message\.suggestedActions\?\.length|reason \|\| '我还不能确定你想选择哪个方案。'|reason\?\.trim\(\) \?\? ''|planList \? `当前候选方案|filter\(Boolean\)|focusedPlan \|\| recommendedPlan|if \(!input \|\| plans\.length === 0\)|&& !implementationRequest|referencedPlan && implementationRequest|if \(!text\)|if \(!Array\.isArray\(data\.suggestedQuestions\)\)|if \(!Array\.isArray\(data\.suggestedActions\)\)|if \(!item \|\| typeof item !== 'object'\)|if \(!normalized\)|if \(match\)|match\?\.\[1\] \?\? ''|if \(!match\?\.\[1\]\)|if \(!ordinal\)|if \(constraintChange\)|term \?\? ''|terms[\s\S]*\.map\(\(term\) => normalizePlanMatchText|getPlanSearchTerms\(plan\)[\s\S]*\.filter\(\(term\) => term\.length >= 2\)|return plans\.filter\(\(plan\)|terms\.some\(\(term\) => normalizedInput\.includes\(term\)\)|plans\.map\(\(plan, index\)|\]\.filter\(\(section\) => section\.length > 0\)|messages\.map\(\(message\)|\[\.\.\.messages\]\.reverse\(\)\.map\(\(message\)|messages\.filter\(\(message\)|if \(!activePlanMessageSeen && !message\.planSuperseded\)|workflowSteps\?\.length \|\| 0|message\.reasoningContent\?\.trim\(\) \?\? ''|message\.statusContent\?\.trim\(\) \?\? ''|message\.reasoningContent\?\.trim\(\)\)|message\.statusContent\?\.trim\(\)\)/,
  'workspace plan message helper should not regress guidance, clarify or pending intent gates to implicit truthy fallback',
);
assert.doesNotMatch(
  implementationStreamTypesSource,
  /patchWorkspaceMessage/,
  'implementation stream context should not expose shared patchWorkspaceMessage',
);
assert.match(
  implementationGenerationSource,
  /ImplementationStreamContextInput[\s\S]*export type ImplementationStreamingUpdaters = \{[\s\S]*updateStreamingMessage: \(patch: Partial<WorkspaceChatMessage>\) => void;[\s\S]*updateStreamingStepState: \([\s\S]*stepEngineeringState\?: WorkspaceEngineeringStateSnapshot,[\s\S]*patch\?: Partial<WorkspaceChatMessage>,[\s\S]*\) => WorkspaceEngineeringStateSnapshot \| undefined;[\s\S]*export function createImplementationStreamingUpdaters\([\s\S]*patchImplementationStreamMessage: \(messageId: string, patch: WorkspaceMessagePatch\) => void;[\s\S]*\): ImplementationStreamingUpdaters \{[\s\S]*context\.patchImplementationStreamMessage\(assistantMessageId, \{ kind: 'workflow', \.\.\.patch \}\);[\s\S]*export function buildImplementationStreamContext\([\s\S]*updaters: ImplementationStreamingUpdaters,[\s\S]*context: ImplementationStreamContextInput,[\s\S]*\): ImplementationStreamContext/,
  'implementation streaming updaters should expose an explicit contract and route running stream patches through the dedicated implementation stream patch helper',
);
assert.doesNotMatch(
  implementationGenerationSource,
  /ReturnType<typeof createImplementationStreamingUpdaters>|Omit<[\s\S]*ImplementationStreamContext/,
  'implementation stream context builder should not infer updater shape from createImplementationStreamingUpdaters or derive builder input with Omit',
);
assert.match(
  implementationStreamTypesSource,
  /export type ImplementationStepEffectsContext = \{[\s\S]*assistantMessageId: string;[\s\S]*appendStatusLine: \(current: string, nextLine: string\) => string;[\s\S]*applyIncrementalWorkflowStep: \(step: WorkflowStep\) => void;[\s\S]*applyWorkflowStepToMessage: \(messageId: string, step: WorkflowStep\) => void;[\s\S]*updateStreamingStepState: \([\s\S]*engineeringState\?: WorkspaceEngineeringStateSnapshot,[\s\S]*patch\?: Partial<WorkspaceChatMessage>,[\s\S]*\) => WorkspaceEngineeringStateSnapshot \| undefined;[\s\S]*yieldStepRender: \(\) => Promise<void>;[\s\S]*\};[\s\S]*export type ImplementationStepEventContext = ImplementationStepEffectsContext & \{[\s\S]*normalizeWorkflowStep: NormalizeWorkflowStep;[\s\S]*resolveStepEngineeringState: ResolveStepEngineeringState;[\s\S]*\};[\s\S]*export type ImplementationProgressEventContext = \{[\s\S]*appendStatusLine: \(current: string, nextLine: string\) => string;[\s\S]*getEventMessage: WorkspaceEventMessageResolver;[\s\S]*updateStreamingMessage: \(patch: Partial<WorkspaceChatMessage>\) => void;[\s\S]*\};[\s\S]*export type ImplementationStreamErrorContext = \{[\s\S]*appendStatusLine: \(current: string, nextLine: string\) => string;[\s\S]*updateStreamingMessage: \(patch: Partial<WorkspaceChatMessage>\) => void;[\s\S]*\};[\s\S]*export type ImplementationStartEventContext = \{[\s\S]*assistantMessageId: string;[\s\S]*appendStatusLine: \(current: string, nextLine: string\) => string;[\s\S]*setGenerationStage: Dispatch<SetStateAction<string>>;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*updateStreamingMessage: \(patch: Partial<WorkspaceChatMessage>\) => void;[\s\S]*\};[\s\S]*export type ImplementationChunkEventContext = \{[\s\S]*appendReasoningChunk: \(current: string, nextChunk: string\) => string;[\s\S]*setGenerationStage: Dispatch<SetStateAction<string>>;[\s\S]*updateStreamingMessage: \(patch: Partial<WorkspaceChatMessage>\) => void;[\s\S]*\};/,
  'implementation stream event context contracts should be explicit named slices of the stream context',
);
assert.match(
  implementationStreamEventsSource,
  /ImplementationChunkEventContext,[\s\S]*ImplementationProgressEventContext,[\s\S]*ImplementationStartEventContext,[\s\S]*ImplementationStepEventContext,[\s\S]*ImplementationStreamErrorContext,[\s\S]*ResolvedWorkflowStepEvent,[\s\S]*function hasImplementationStepEvent\([\s\S]*stepEvent: ResolvedWorkflowStepEvent \| null,[\s\S]*\): stepEvent is ResolvedWorkflowStepEvent[\s\S]*return stepEvent !== null;[\s\S]*function hasImplementationProgressMessage\(progressMessage: string\): boolean[\s\S]*const hasProgressMessage = progressMessage\.length > 0;[\s\S]*return hasProgressMessage === true;[\s\S]*function hasImplementationStartMessage\(startMessage: string\): boolean[\s\S]*const hasStartMessage = startMessage\.length > 0;[\s\S]*return hasStartMessage === true;[\s\S]*handleImplementationStepEvent\([\s\S]*context: ImplementationStepEventContext,[\s\S]*if \(hasImplementationStepEvent\(stepEvent\) === false\)[\s\S]*handleImplementationProgressEvent\([\s\S]*context: ImplementationProgressEventContext,[\s\S]*const hasProgressMessage = hasImplementationProgressMessage\(progressMessage\);[\s\S]*if \(hasProgressMessage === false\)[\s\S]*buildImplementationStreamError\([\s\S]*context: ImplementationStreamErrorContext,[\s\S]*handleImplementationStartEvent\([\s\S]*context: ImplementationStartEventContext,[\s\S]*const hasStartMessage = hasImplementationStartMessage\(startMessage\);[\s\S]*if \(hasStartMessage === true\)[\s\S]*handleImplementationChunkEvent\([\s\S]*context: ImplementationChunkEventContext,/,
  'implementation stream events should consume named event context contracts and explicit step/progress/start message facts',
);
assert.doesNotMatch(
  implementationStreamEventsSource,
  /if \(!stepEvent\)|if \(!progressMessage\)|if \(startMessage\)/,
  'implementation stream events should not regress to truthy step, progress or start message gates',
);
assert.match(
  implementationStepEffectsSource,
  /ImplementationStepEffectsContext,[\s\S]*function getImplementationStepEngineeringState\(stepEvent: ResolvedWorkflowStepEvent\)[\s\S]*const stepEngineeringState = stepEvent\.engineeringState;[\s\S]*const hasStepEngineeringState = stepEngineeringState !== undefined;[\s\S]*if \(hasStepEngineeringState === true\)[\s\S]*return buildFailedWorkspaceFileOperationStepState\(stepEvent\.step\);[\s\S]*function shouldAppendImplementationStepStatusLine\(stepEvent: ResolvedWorkflowStepEvent\): boolean[\s\S]*const shouldAppendStatusLine = stepEvent\.shouldAppendStatusLine === true;[\s\S]*return shouldAppendStatusLine === true;[\s\S]*function hasImplementationStepActiveFileOperation\(stepEvent: ResolvedWorkflowStepEvent\): boolean[\s\S]*const isRunning = stepEvent\.isRunning === true;[\s\S]*const isFileOperation = stepEvent\.isFileOperation === true;[\s\S]*return isRunning === true && isFileOperation === true;[\s\S]*applyImplementationStepEffects\([\s\S]*context: ImplementationStepEffectsContext,[\s\S]*const effectiveStepEngineeringState = getImplementationStepEngineeringState\(stepEvent\);[\s\S]*const shouldAppendStatusLine = shouldAppendImplementationStepStatusLine\(stepEvent\);[\s\S]*const hasActiveFileOperation = hasImplementationStepActiveFileOperation\(stepEvent\);[\s\S]*if \(shouldAppendStatusLine === true\)[\s\S]*activeFileOperation: hasActiveFileOperation === true[\s\S]*if \(hasActiveFileOperation === true\)/,
  'implementation step effects should consume the named step effects context contract',
);
assert.doesNotMatch(
  `${implementationStreamEventsSource}\n${implementationStepEffectsSource}`,
  /Pick<[\s\S]*ImplementationStreamContext|if \(!stepEvent\)|if \(!progressMessage\)|stepEngineeringState \|\| buildFailedWorkspaceFileOperationStepState|if \(stepEvent\.shouldAppendStatusLine\)|stepEvent\.isRunning && stepEvent\.isFileOperation/,
  'implementation stream events and step effects should not derive handler inputs with Pick<ImplementationStreamContext> or truthy event gates',
);
assert.match(
  implementationStreamTypesSource,
  /export type ImplementationStreamStatusState = \{[\s\S]*statusContent: string;[\s\S]*\};[\s\S]*export type ImplementationStreamFailureState = \{[\s\S]*reasoningContent: string;[\s\S]*statusContent: string;[\s\S]*\};[\s\S]*export type ImplementationGeneratedFilesApplyContext = \{[\s\S]*files: Map<string, string>;[\s\S]*reflectFilePathInTree: \(filePath: string\) => void;[\s\S]*savedFiles: Map<string, string>;[\s\S]*setFiles: Dispatch<SetStateAction<Map<string, string>>>;[\s\S]*setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;[\s\S]*\};[\s\S]*export type ImplementationRelatedCommitContext = \{[\s\S]*effectiveMode: WorkspaceGenerationMode;[\s\S]*effectiveProject: WorkspaceProjectInfo \| null;[\s\S]*fetchProjectCommits: \(projectId: string\) => Promise<GitCommit\[\]>;[\s\S]*fetchProjectDetail: \(projectId: string\) => Promise<void>;[\s\S]*refreshProjectFileTree: \([\s\S]*projectId: string,[\s\S]*force\?: boolean,[\s\S]*options\?: \{ throwOnFailure\?: boolean; suppressNotice\?: boolean \},[\s\S]*\) => Promise<void>;[\s\S]*\};[\s\S]*export type ImplementationDoneEffectsContext = \{[\s\S]*getGeneratedFilesFromEvent: WorkspaceGeneratedFilesEventReader;[\s\S]*getGuidanceFromEvent: WorkspaceGuidanceResolver;[\s\S]*\};[\s\S]*export type ImplementationDoneFinalizationContext =[\s\S]*ImplementationGeneratedFilesApplyContext[\s\S]*& ImplementationRelatedCommitContext[\s\S]*& ImplementationDoneEffectsContext[\s\S]*& \{[\s\S]*assistantMessageId: string;[\s\S]*patchImplementationStreamMessage: \(messageId: string, patch: WorkspaceMessagePatch\) => void;[\s\S]*setGenerationStage: Dispatch<SetStateAction<string>>;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*updateStreamingMessage: \(patch: Partial<WorkspaceChatMessage>\) => void;[\s\S]*\};[\s\S]*export type ImplementationStreamFailureContext = \{[\s\S]*assistantMessageId: string;[\s\S]*patchImplementationStreamMessage: \(messageId: string, patch: WorkspaceMessagePatch\) => void;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*\};/,
  'implementation finalization context and execution state slices should be explicit named contracts',
);
assert.match(
  implementationStreamFinalizationSource,
  /ImplementationDoneFinalizationContext,[\s\S]*ImplementationStreamFailureContext,[\s\S]*ImplementationStreamFailureState,[\s\S]*ImplementationFinalSyncFailure[\s\S]*function hasImplementationFinalSyncFailure\([\s\S]*syncFailure: ImplementationFinalSyncFailure \| undefined,[\s\S]*\): syncFailure is ImplementationFinalSyncFailure[\s\S]*return syncFailure !== undefined;[\s\S]*finalizeImplementationDoneEvent\([\s\S]*context: ImplementationDoneFinalizationContext,[\s\S]*context\.patchImplementationStreamMessage\(context\.assistantMessageId, doneMessagePatch\);[\s\S]*context\.patchImplementationStreamMessage\(context\.assistantMessageId, \{[\s\S]*relatedCommit,[\s\S]*if \(hasImplementationFinalSyncFailure\(syncFailure\) === true\)[\s\S]*context\.patchImplementationStreamMessage\([\s\S]*buildImplementationFinalSyncFailurePatch\(syncFailure\)[\s\S]*handleImplementationStreamFailure\([\s\S]*context: ImplementationStreamFailureContext,[\s\S]*state: ImplementationStreamFailureState,[\s\S]*context\.patchImplementationStreamMessage\(context\.assistantMessageId, \(msg\) => \([\s\S]*context\.patchImplementationStreamMessage\(context\.assistantMessageId, buildImplementationFailurePatch/,
  'implementation stream finalization and failure patches should use the dedicated implementation stream patch helper',
);
assert.doesNotMatch(
  implementationStreamFinalizationSource,
  /if \(syncFailure\)/,
  'implementation stream finalization should not regress sync failure handling to a truthy gate',
);
assert.match(
  implementationFailureEffectsSource,
  /ImplementationStreamFailureState[\s\S]*buildImplementationFailurePatch\([\s\S]*context: ImplementationStreamFailureState,/,
  'implementation failure patch builder should consume the named stream failure state contract',
);
assert.match(
  implementationFailureEffectsSource,
  /function normalizeImplementationFailureRecoveryMode\(mode\?: string\): WorkspaceGenerationMode \| undefined[\s\S]*if \(mode === 'foundation'\) return mode;[\s\S]*if \(mode === 'discuss'\) return mode;[\s\S]*if \(mode === 'implement'\) return mode;[\s\S]*function hasImplementationFailureTextValue\(value: string \| undefined\): value is string[\s\S]*if \(value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;/,
  'implementation failure recovery actions should normalize retry mode through an explicit named gate',
);
assert.match(
  implementationFailureEffectsSource,
  /(?=[\s\S]*function getImplementationFailureGateBlockingItems\(gateResult: WorkspaceGateResult \| undefined\): string\[\])(?=[\s\S]*function getImplementationFailureBootstrapBlockers\(bootstrapState: WorkspaceBootstrapState \| undefined\): string\[\])(?=[\s\S]*function getImplementationFailureUniqueTextItems\(items: string\[\]\): string\[\] \{[\s\S]*const uniqueItems: string\[\] = \[\];[\s\S]*const seenItems = new Set<string>\(\);[\s\S]*for \(const item of items\)[\s\S]*seenItems\.add\(textValue\);[\s\S]*uniqueItems\.push\(textValue\);)(?=[\s\S]*function getImplementationFailureTextLines\(items: string\[\]\): string\[\] \{[\s\S]*for \(const item of items\)[\s\S]*lines\.push\(`- \$\{item\}`\);)(?=[\s\S]*const bootstrapState = getImplementationFailureBootstrapState\(engineeringState\);[\s\S]*const uniqueBlockers = getImplementationFailureUniqueTextItems\(\[[\s\S]*\.\.\.getImplementationFailureGateBlockingItems\(gateResult\),[\s\S]*\.\.\.getImplementationFailureBootstrapBlockers\(bootstrapState\),[\s\S]*\]\);)(?=[\s\S]*getImplementationFailureTextLines\(uniqueBlockers\)\.join\('\\n'\))/,
  'foundation gate blocked message should merge blockers through named list readers and explicit item presence gates',
);
assert.match(
  implementationFailureEffectsSource,
  /function getImplementationFailureGateNextAction\(gateResult: WorkspaceGateResult \| undefined\): string[\s\S]*function getImplementationFailureExecutionNextAction\(executionState: WorkspaceExecutionState \| undefined\): string[\s\S]*const executionState = getImplementationFailureExecutionState\(engineeringState\);[\s\S]*const gateNextAction = getImplementationFailureGateNextAction\(gateResult\);[\s\S]*const hasGateNextAction = gateNextAction\.length > 0;[\s\S]*const executionNextAction = getImplementationFailureExecutionNextAction\(executionState\);[\s\S]*const hasExecutionNextAction = executionNextAction\.length > 0;/,
  'implementation failure messages should derive next action fallback through explicit presence facts',
);
assert.match(
  implementationFailureEffectsSource,
  /function getImplementationFailureRecoveryRetryPrompt\(recovery: WorkspaceRecoveryState \| undefined\): string[\s\S]*const recovery = getImplementationFailureRecoveryState\(engineeringState\);[\s\S]*const hasRecoveryRetry = hasImplementationFailureRecoveryRetry\(recovery\);[\s\S]*const retryPrompt = getImplementationFailureRecoveryRetryPrompt\(recovery\);[\s\S]*const hasRetryPrompt = retryPrompt\.length > 0;[\s\S]*label: hasRetryLabel === true \? retryLabel : '修复后重试'[\s\S]*prompt: retryPrompt[\s\S]*mode: normalizeImplementationFailureRecoveryMode\(recovery\.resume_mode\)/,
  'implementation failure recovery action should use explicit retry gates and normalized mode',
);
assert.match(
  implementationFailureEffectsSource,
  /(?=[\s\S]*function getImplementationFailurePendingDecisions\([\s\S]*requiredDecisions: WorkspaceBootstrapDecisionItem\[\],[\s\S]*\): WorkspaceBootstrapDecisionItem\[\] \{[\s\S]*for \(const decision of requiredDecisions\)[\s\S]*decision\.bucket === 'must_decide_now'[\s\S]*decision\.status === 'confirmed'[\s\S]*pendingDecisions\.push\(decision\);)(?=[\s\S]*function getImplementationFailureDecisionLines\([\s\S]*decisions: WorkspaceBootstrapDecisionItem\[\],[\s\S]*\): string\[\] \{[\s\S]*for \(const decision of decisions\)[\s\S]*getImplementationFailureDecisionLabel\(decision\))(?=[\s\S]*function getImplementationFailureValidationLines\(items: WorkspaceValidationFailureItem\[\]\): string\[\] \{[\s\S]*for \(const item of items\)[\s\S]*getImplementationFailureValidationLine\(item\))(?=[\s\S]*function getImplementationFailureContextRepairTargetLines\([\s\S]*targets: ImplementationFailureContextRepairTarget\[\],[\s\S]*\): string\[\] \{[\s\S]*for \(const target of targets\)[\s\S]*getImplementationFailureContextRepairTargetLine\(target\))(?=[\s\S]*function getBlockedCapabilityExecutionItems\([\s\S]*\): ImplementationFailureExecutionItem\[\] \{[\s\S]*for \(const item of getImplementationFailureExecutionItems\(executionResult\)\)[\s\S]*item\.status === 'blocked'[\s\S]*blockedItems\.push\(item\);)(?=[\s\S]*function getFirstBlockedCapabilityExecutionItem\([\s\S]*\): ImplementationFailureExecutionItem \| undefined \{[\s\S]*for \(const item of getImplementationFailureExecutionItems\(executionResult\)\)[\s\S]*item\.status === 'blocked'[\s\S]*return item;)(?=[\s\S]*function getImplementationFailureAuditFilters\(\{[\s\S]*hasCapabilityAuditProfile: boolean;[\s\S]*hasCapabilityAuditReason: boolean;[\s\S]*const auditFilters = \[`\$\{CAPABILITY_AUDIT_STATUS_QUERY_PARAM\}=blocked`\];[\s\S]*if \(hasCapabilityAuditProfile === true\)[\s\S]*if \(hasCapabilityAuditReason === true\)[\s\S]*return auditFilters;)(?=[\s\S]*function getFirstValidationFailureItemWithNavigationTarget\([\s\S]*items: WorkspaceValidationFailureItem\[\],[\s\S]*\): WorkspaceValidationFailureItem \| null \{[\s\S]*for \(const item of items\)[\s\S]*buildValidationFailureNavigationTarget\(item\)[\s\S]*return item;)(?=[\s\S]*const hasCurrentTask = hasImplementationFailureTextValue\(currentTask\);)(?=[\s\S]*const recoveryStageLabels = getImplementationFailureRecoveryStageLabels\(recovery\);[\s\S]*const hasRecoveryStageLabels = recoveryStageLabels\.length > 0;)(?=[\s\S]*const hasCapabilityAuditProfile = hasImplementationFailureTextValue\(capabilityAuditProfile\);)(?=[\s\S]*const hasCapabilityAuditReason = hasImplementationFailureTextValue\(capabilityAuditReason\);)(?=[\s\S]*const auditFilters = getImplementationFailureAuditFilters\(\{[\s\S]*capabilityAuditProfile,[\s\S]*hasCapabilityAuditProfile,[\s\S]*capabilityAuditReason,[\s\S]*hasCapabilityAuditReason,[\s\S]*\}\)\.join\(' \+ '\);)/,
  'capability gate blocked message should derive recovery stage labels and audit filters through explicit presence gates',
);
assert.match(
  implementationFailureEffectsSource,
  /function getFirstImplementationFailureContextRepairTarget\([\s\S]*targets: ImplementationFailureContextRepairTarget\[\],[\s\S]*\): ImplementationFailureContextRepairTarget \| undefined \{[\s\S]*for \(const target of targets\)[\s\S]*return target;[\s\S]*return undefined;[\s\S]*function buildContextRepairNavigationTarget\(gateResult\?: WorkspaceGateResult\): WorkspaceEditorNavigationTarget \| null \{[\s\S]*const repairTargets = getContextGateRepairTargets\(gateResult\);[\s\S]*const repairTarget = getFirstImplementationFailureContextRepairTarget\(repairTargets\);/,
  'implementation failure context repair navigation should derive the first repair target through a named reader',
);
assert.match(
  implementationFailureEffectsSource,
  /const shouldBuildLocalGenerationFailureState = validationGateBlocked === false[\s\S]*foundationGateBlocked === false[\s\S]*contextGateBlocked === false[\s\S]*capabilityGateBlocked === false;[\s\S]*const effectiveEngineeringState = blockingEngineeringState[\s\S]*\?\? \(shouldBuildLocalGenerationFailureState === true \? buildLocalGenerationFailureState\(error\) : undefined\);/,
  'implementation failure patch should build local generation failure state only through explicit gate facts',
);
assert.match(
  implementationFailureEffectsSource,
  /(?=[\s\S]*function buildFoundationAutoRetrySuggestedAction\(\): GuidanceAction \{[\s\S]*label: '重试自动准备项目基础设定',[\s\S]*kind: 'retry_workflow_gate',[\s\S]*conversationStage: 'bootstrap_confirmed',)(?=[\s\S]*function buildFailureSuggestedActions\(\{[\s\S]*foundationGateBlocked: boolean;[\s\S]*validationFailureSuggestedAction: GuidanceAction \| null;[\s\S]*contextRepairSuggestedAction: GuidanceAction \| null;[\s\S]*capabilityGateBlocked: boolean;[\s\S]*recoverySuggestedActions: GuidanceAction\[\];[\s\S]*const actions: GuidanceAction\[\] = \[\];[\s\S]*actions\.push\(buildFoundationAutoRetrySuggestedAction\(\)\);[\s\S]*actions\.push\(validationFailureSuggestedAction\);[\s\S]*actions\.push\(contextRepairSuggestedAction\);[\s\S]*actions\.push\(buildCapabilityAuditSuggestedAction\(executionResult\)\);[\s\S]*for \(const action of recoverySuggestedActions\))(?=[\s\S]*const failureSuggestedActions = buildFailureSuggestedActions\(\{[\s\S]*foundationGateBlocked,[\s\S]*validationFailureSuggestedAction,[\s\S]*contextRepairSuggestedAction,[\s\S]*capabilityGateBlocked,[\s\S]*executionResult,[\s\S]*recoverySuggestedActions,[\s\S]*\}\);)(?=[\s\S]*const hasEffectiveEngineeringState = effectiveEngineeringState !== undefined;[\s\S]*const hasGateResult = gateResult !== undefined;[\s\S]*const hasFailureSuggestedActions = failureSuggestedActions\.length > 0;[\s\S]*const hasContextReasoningContent = context\.reasoningContent\.length > 0;[\s\S]*const hasContextStatusContent = context\.statusContent\.length > 0;[\s\S]*engineeringState: hasEffectiveEngineeringState === true \? effectiveEngineeringState : message\.engineeringState,[\s\S]*gateResult: hasGateResult === true \? gateResult : message\.gateResult,[\s\S]*suggestedActions: hasFailureSuggestedActions === true \? failureSuggestedActions : message\.suggestedActions,[\s\S]*reasoningContent: hasContextReasoningContent === true \? context\.reasoningContent : message\.reasoningContent,)/,
  'implementation failure patch should merge message fallback fields through explicit presence facts',
);
assert.doesNotMatch(
  implementationFailureEffectsSource,
  /filter\(Boolean\)|\|\| \[\]|kind: 'open_foundation_panel'|gateResult\?\.blocking_items \?\? \[\]|engineeringState\?\.bootstrap_state\?\.blockers \?\? \[\]|engineeringState\?\.validation\?\.failure_items \?\? \[\]|executionResult\?\.items \?\? \[\]|!recovery\?\.can_retry|!recovery\.retry_prompt\?\.trim\(\)|recovery\?\.retry_prompt\?\.trim\(\) \?\? ''|recovery\.retry_label\?\.trim\(\) \|\| '修复后重试'|gateResult\?\.next_action\?\.trim\(\)[\s\S]{0,80}\|\||engineeringState\?\.execution\?\.next_action\?\.trim\(\)[\s\S]{0,80}\|\||recovery\?\.reason_message\?\.trim\(\)[\s\S]{0,80}\|\||\[recovery\.resume_stage, recovery\.resume_mode\]\.filter\(Boolean\)|path !== undefined && path\.length > 0|currentTask !== undefined && currentTask\.length > 0|capabilityAuditProfile !== undefined && capabilityAuditProfile\.length > 0|capabilityAuditReason !== undefined && capabilityAuditReason\.length > 0|capabilityAuditProfile \?|capabilityAuditReason \?|if \(!(?:path|repairTarget|failureItem|navigationTarget)\)|getContextGateRepairTargets\(gateResult\)\[0\]|effectiveEngineeringState \|\| message\.engineeringState|gateResult \|\| message\.gateResult|context\.reasoningContent \|\| message\.reasoningContent|context\.statusContent \|\| message\.statusContent|shouldBuildLocalGenerationFailureState = !validationGateBlocked|\.filter\(\(item\) => item\.length > 0\)|requiredDecisions\.filter\(|failureItems\.map\(|repairTargets\.map\(|getImplementationFailureExecutionItems\(executionResult\)[\s\S]*\.filter\(|getImplementationFailureExecutionItems\(executionResult\)[\s\S]*\.find\(|getImplementationFailureValidationItems\(validationState\)[\s\S]*\.find\(|const auditFilters = \[[\s\S]*\]\.filter\(|\.\.\.\(foundationGateBlocked \?|validationFailureSuggestedAction \? \[validationFailureSuggestedAction\]|contextRepairSuggestedAction \? \[contextRepairSuggestedAction\]|capabilityGateBlocked \? \[buildCapabilityAuditSuggestedAction/,
  'implementation failure effects should not regress to implicit failure, recovery, audit or patch fallback gates',
);
assert.match(
  implementationFinalizationEffectsSource,
  /ImplementationDoneEffectsContext,[\s\S]*ImplementationGeneratedFilesApplyContext,[\s\S]*ImplementationRelatedCommitContext,[\s\S]*applyGeneratedFilesToWorkspace\([\s\S]*context: ImplementationGeneratedFilesApplyContext,[\s\S]*resolveImplementationRelatedCommit\([\s\S]*context: ImplementationRelatedCommitContext,[\s\S]*buildImplementationDoneEffects\([\s\S]*context: ImplementationDoneEffectsContext,/,
  'implementation finalization effects should consume named finalization helper context contracts',
);
assert.match(
  implementationFinalizationEffectsSource,
  /function getImplementationFinalizationFirstCommit\(commits: GitCommit\[\]\): GitCommit \| undefined \{[\s\S]*for \(const commit of commits\)[\s\S]*return commit;[\s\S]*return undefined;[\s\S]*const latestCommits = await context\.fetchProjectCommits\(context\.effectiveProject\.projectId\);[\s\S]*return \{ relatedCommit: getImplementationFinalizationFirstCommit\(latestCommits\) \};/,
  'implementation finalization should derive the related commit through a named first-commit reader',
);
assert.doesNotMatch(
  implementationFinalizationEffectsSource,
  /latestCommits\[0\]/,
  'implementation finalization should not regress related commit selection to direct first commit indexing',
);
assert.match(
  implementationFinalizationEffectsSource,
  /type ImplementationFinalizationGuidanceActionList = GuidanceAction\[\];[\s\S]*function getImplementationFinalizationSuggestedActions\([\s\S]*message: WorkspaceChatMessage,[\s\S]*\): ImplementationFinalizationGuidanceActionList[\s\S]*Array\.isArray\(message\.suggestedActions\) === false[\s\S]*const existingActions = getImplementationFinalizationSuggestedActions\(message\);[\s\S]*const nextActions = \[[\s\S]*\.\.\.buildImplementationFinalSyncFailureActions\(failure\),[\s\S]*\.\.\.existingActions,/,
  'implementation finalization sync failure patch should merge suggested actions through explicit readers',
);
assert.doesNotMatch(
  implementationFinalizationEffectsSource,
  /message\.suggestedActions \|\| \[\]|message\.suggestedActions \?\? \[\]|const existingActions = message\.suggestedActions/,
  'implementation finalization sync failure patch should not regress suggested actions to inline fallback',
);
assert.match(
  implementationFinalizationEffectsSource,
  /function hasImplementationFinalizationTextValue\(value: string\): boolean \{[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;[\s\S]*function hasImplementationFinalizationEventText\(value: unknown\): value is string \{[\s\S]*if \(typeof value !== 'string'\) \{[\s\S]*return false;[\s\S]*const trimmedValue = value\.trim\(\);[\s\S]*return hasImplementationFinalizationTextValue\(trimmedValue\);[\s\S]*function getImplementationFinalizationTextValue\(value: string\): string \{[\s\S]*return value\.trim\(\);[\s\S]*function getImplementationFinalizationOptionalText\(value: string\): string \| undefined \{[\s\S]*const trimmedValue = getImplementationFinalizationTextValue\(value\);[\s\S]*const hasTrimmedValue = hasImplementationFinalizationTextValue\(trimmedValue\);[\s\S]*return hasTrimmedValue === true \? trimmedValue : undefined;[\s\S]*function getImplementationDoneMessageContent\([\s\S]*data: WorkspaceStreamEventData,[\s\S]*fallbackContent: string,[\s\S]*\): string \{[\s\S]*const generatedMessage = data\.genMessage;[\s\S]*const hasGeneratedMessage = hasImplementationFinalizationEventText\(generatedMessage\);[\s\S]*if \(hasGeneratedMessage === true\) \{[\s\S]*return generatedMessage;[\s\S]*const eventContent = data\.content;[\s\S]*const hasEventContent = hasImplementationFinalizationEventText\(eventContent\);[\s\S]*if \(hasEventContent === true\) \{[\s\S]*return eventContent;[\s\S]*return fallbackContent;[\s\S]*const finalMessageContent = getImplementationDoneMessageContent\(data, context\.fullContent\);[\s\S]*const finalReasoningContent = getImplementationFinalizationOptionalText\(context\.reasoningContent\);[\s\S]*const finalStatusContent = finalReasoningContent !== undefined[\s\S]*\? undefined[\s\S]*: getImplementationFinalizationOptionalText\(context\.statusContent\);[\s\S]*reasoningContent: finalReasoningContent,/,
  'implementation done message patch should derive content, reasoning and status fallback through explicit readers',
);
assert.doesNotMatch(
  implementationFinalizationEffectsSource,
  /typeof data\.(?:genMessage|content) === 'string' && data\.(?:genMessage|content)\.trim\(\)|context\.statusContent\.trim\(\) \|\| undefined|finalReasoningContent \? undefined|reasoningContent: finalReasoningContent \|\| undefined/,
  'implementation done message patch should not regress content, reasoning or status fallback to truthy gates',
);
assert.match(
  implementationFinalizationEffectsSource,
  /export type ImplementationFinalSyncStageLabelMap = \{[\s\S]*\[stage in ImplementationFinalSyncStage\]: string;[\s\S]*\};[\s\S]*const implementationFinalSyncStageLabels: ImplementationFinalSyncStageLabelMap = \{[\s\S]*project_detail: '项目详情同步'[\s\S]*file_tree: 'Explorer 文件树同步'[\s\S]*commit_list: 'Git 提交列表同步'/,
  'implementation finalization effects should use a named final sync stage label map contract',
);
assert.doesNotMatch(
  implementationFinalizationEffectsSource,
  /Record<ImplementationFinalSyncStage, string>/,
  'implementation finalization effects should not use an anonymous Record for final sync stage labels',
);
assert.match(
  implementationGenerationSource,
  /(?=[\s\S]*ImplementationStreamStatusState)(?=[\s\S]*function hasImplementationGenerationExistingAssistantMessage\(hasExistingAssistantMessage: boolean\): boolean[\s\S]*return hasExistingAssistantMessage === true;)(?=[\s\S]*function getImplementationGenerationStatusContent\(statusContent: string\): string \| undefined[\s\S]*const hasStatusContent = statusContent\.length > 0;[\s\S]*if \(hasStatusContent === true\))(?=[\s\S]*function hasImplementationGenerationTextValue\(value: string \| undefined\): value is string[\s\S]*return hasValue === true;)(?=[\s\S]*function getImplementationGenerationAssistantMessageId\(options: GenerateOptions \| undefined\): string[\s\S]*hasImplementationGenerationTextValue\(assistantMessageId\))(?=[\s\S]*function getImplementationGenerationMode\([\s\S]*options: GenerateOptions \| undefined,[\s\S]*chatMode: ChatMode,[\s\S]*\): WorkspaceGenerationMode)(?=[\s\S]*function getImplementationGenerationOnline\(options: GenerateOptions \| undefined, isOnline: boolean\): boolean)(?=[\s\S]*function getImplementationGenerationProject\([\s\S]*targetProject: WorkspaceProjectInfo \| undefined,[\s\S]*projectInfo: WorkspaceProjectInfo \| null,[\s\S]*\): WorkspaceProjectInfo \| null)(?=[\s\S]*function getImplementationGenerationInitialReasoningContent\(options: GenerateOptions \| undefined\): string[\s\S]*hasImplementationGenerationTextValue\(initialReasoningContent\))(?=[\s\S]*function hasImplementationGenerationAssistantMessageId\(options: GenerateOptions \| undefined\): boolean[\s\S]*hasImplementationGenerationTextValue\(options\.assistantMessageId\))(?=[\s\S]*function hasImplementationGenerationEffectiveProjectId\([\s\S]*effectiveProject: WorkspaceProjectInfo \| null,[\s\S]*\): effectiveProject is WorkspaceProjectInfo[\s\S]*if \(effectiveProject === null\)[\s\S]*const hasProjectId = effectiveProject\.projectId\.length > 0;[\s\S]*return hasProjectId === true;)(?=[\s\S]*prepareImplementationGenerationRequest\([\s\S]*assistantMessageId: getImplementationGenerationAssistantMessageId\(options\),[\s\S]*effectiveMode: getImplementationGenerationMode\(options, chatMode\),[\s\S]*effectiveOnline: getImplementationGenerationOnline\(options, isOnline\),[\s\S]*effectiveProject: getImplementationGenerationProject\(targetProject, projectInfo\),[\s\S]*statusContent: getImplementationGenerationInitialReasoningContent\(options\),[\s\S]*hasExistingAssistantMessage: hasImplementationGenerationAssistantMessageId\(options\),)(?=[\s\S]*initializeImplementationGeneration\([\s\S]*state: ImplementationStreamStatusState,[\s\S]*const hasExistingAssistantMessage = hasImplementationGenerationExistingAssistantMessage\(context\.hasExistingAssistantMessage\);[\s\S]*const statusContent = getImplementationGenerationStatusContent\(state\.statusContent\);[\s\S]*if \(hasExistingAssistantMessage === false\)[\s\S]*statusContent,[\s\S]*else if \(statusContent !== undefined\)[\s\S]*if \(hasImplementationGenerationEffectiveProjectId\(context\.effectiveProject\) === true\))/,
  'implementation generation initialization should consume named stream status, assistant message and project facts',
);
assert.doesNotMatch(
  `${implementationStreamFinalizationSource}\n${implementationFinalizationEffectsSource}\n${implementationGenerationSource}\n${implementationFailureEffectsSource}`,
  /Pick<[\s\S]*(ImplementationStreamContext|ImplementationStreamExecutionState)/,
  'implementation finalization and initialization should not derive helper inputs with Pick over stream context or execution state',
);
assert.doesNotMatch(
  implementationStreamFinalizationSource,
  /patchWorkspaceMessage/,
  'implementation stream finalization should not depend on shared patchWorkspaceMessage',
);
assert.match(
  implementationGenerationSource,
  /applyImplementationGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*if \(hasExistingAssistantMessage === false\)[\s\S]*context\.applyImplementationGenerationMessages\(\(prev\) => \[\.\.\.prev, \{[\s\S]*id: context\.assistantMessageId,[\s\S]*statusContent,[\s\S]*kind: 'workflow'[\s\S]*streaming: true,/,
  'implementation generation should route the assistant workflow message through the implementation generation action',
);
assert.doesNotMatch(
  implementationGenerationSource,
  /setMessages|if \(!context\.hasExistingAssistantMessage\)|state\.statusContent \|\| undefined|else if \(state\.statusContent\)|context\.effectiveProject\?\.projectId|options\?\.assistantMessageId \|\||options\?\.mode \|\||options\?\.online \?\?|targetProject \|\| projectInfo|options\?\.initialReasoningContent \|\||!!options\?\.assistantMessageId/,
  'implementation generation helper should not depend on the external setMessages compatibility wrapper or truthy initialization gates',
);
assert.match(
  implementationGenerationSource,
  /appendGenerationStatePersistenceFailureMessage\(context\.applyGenerationStateMessages, context\.persistGenerationState\(\{[\s\S]*status: 'running'[\s\S]*appendGenerationStatePersistenceFailureMessage\(context\.applyGenerationStateMessages, context\.persistGenerationState\(null\)\);/,
  'implementation generation should route local generation state save and cleanup failures through the generation state action',
);
assert.doesNotMatch(
  generationStatePersistenceSource,
  /setMessages/,
  'generation state persistence helper should not write through the external setMessages compatibility wrapper',
);
assert.match(
  generationStatePersistenceSource,
  /function hasGenerationStatePersistenceMessageId\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*messageId: string,[\s\S]*\): boolean[\s\S]*for \(const message of messages\)[\s\S]*const hasMessageId = message\.id === messageId;[\s\S]*if \(hasMessageId === true\)[\s\S]*function hasGenerationStatePersistenceSucceeded\([\s\S]*result: PersistGenerationStateResult,[\s\S]*\): result is \{ ok: true \}[\s\S]*return result\.ok === true;[\s\S]*const hasSucceeded = hasGenerationStatePersistenceSucceeded\(result\);[\s\S]*if \(hasSucceeded === true\) return;[\s\S]*const hasExistingMessage = hasGenerationStatePersistenceMessageId\(prev, messageId\);[\s\S]*if \(hasExistingMessage === true\) return prev;/,
  'generation state persistence helper should derive success and message dedupe gates through explicit facts',
);
assert.doesNotMatch(
  generationStatePersistenceSource,
  /if \(result\.ok\) return|prev\.some\(\(message\) => message\.id === messageId\)|some\(\(message\) => message\.id === messageId\)/,
  'generation state persistence helper should not regress success or failure message dedupe to inline predicates',
);
assert.match(
  planImplementationActionSource,
  /applyPlanImplementationMessages,[\s\S]*executePlanImplementation\([\s\S]*applyPlanImplementationMessages,[\s\S]*applyPlanImplementationMessages\(\(prev\) => \[/,
  'plan implementation action should route kickoff failures through the plan implementation action',
);
assert.doesNotMatch(
  planImplementationActionSource,
  /setMessages\(\(prev\)/,
  'plan implementation action should not write plan implementation failure messages through the external setMessages compatibility wrapper',
);
assert.match(
  planImplementationSource,
  /appendImplementationKickoffMessage\([\s\S]*applyPlanImplementationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>,[\s\S]*applyPlanImplementationMessages\(\(prev\) => \[\.\.\.prev, \{[\s\S]*buildPlanApprovedEngineeringState[\s\S]*context\.applyPlanImplementationMessages,/,
  'plan implementation kickoff message should route through the plan implementation action',
);
assert.match(
  planImplementationSource,
  /(?=[\s\S]*type SelectedPlanProjectPreparationContext = \{[\s\S]*createPersistedProject: \(plan: Plan\) => Promise<WorkspaceProjectInfo>;[\s\S]*persistWorkspaceProject: \(project: WorkspaceProjectInfo\) => void;[\s\S]*projectInfo: WorkspaceProjectInfo;[\s\S]*setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo \| null>>;[\s\S]*\};)(?=[\s\S]*type PlanImplementationRuntimePreparationContext = \{[\s\S]*ensureProjectRuntimeReady: \(projectId: string, options\?: \{[\s\S]*initialStage\?: string;[\s\S]*waitStage\?: string;[\s\S]*\}\) => Promise<unknown>;[\s\S]*\};)(?=[\s\S]*function hasPlanImplementationExistingProject\(projectInfo: WorkspaceProjectInfo\): boolean[\s\S]*const isPersistedProject = projectInfo\.isPersisted === true;[\s\S]*if \(isPersistedProject === true\)[\s\S]*const hasPersistedProjectId = projectInfo\.projectId\.startsWith\('proj_'\);[\s\S]*return hasPersistedProjectId === true;)(?=[\s\S]*function getPlanImplementationAutoSelected\(options: ChoosePlanOptions \| undefined\): boolean[\s\S]*if \(options === undefined\)[\s\S]*return options\.autoSelected === true;)(?=[\s\S]*function getPlanImplementationConfirmationSource\(\{[\s\S]*options: ChoosePlanOptions \| undefined;[\s\S]*autoSelected: boolean;[\s\S]*options\.confirmationSource !== undefined[\s\S]*if \(autoSelected === true\)[\s\S]*return 'manual';)(?=[\s\S]*function getPlanImplementationBaseMessages\(\{[\s\S]*options: ChoosePlanOptions \| undefined;[\s\S]*messagesRef: MutableRefObject<WorkspaceChatMessage\[\]>;[\s\S]*options\.baseMessages !== undefined[\s\S]*return messagesRef\.current;)(?=[\s\S]*function getPlanImplementationUpdatedPlanMessages\(\{[\s\S]*baseMessages: WorkspaceChatMessage\[\];[\s\S]*plan: Plan;[\s\S]*autoSelected: boolean;[\s\S]*const updatedPlanMessages: WorkspaceChatMessage\[\] = \[\];[\s\S]*for \(const message of baseMessages\)[\s\S]*updatedPlanMessages\.push\(updatePlanImplementationMessageSelection\(\{)(?=[\s\S]*prepareProjectForSelectedPlan\([\s\S]*context: SelectedPlanProjectPreparationContext,[\s\S]*const hasExistingProject = hasPlanImplementationExistingProject\(context\.projectInfo\);[\s\S]*if \(hasExistingProject === false\))(?=[\s\S]*prepareRuntimeForImplementation\([\s\S]*context: PlanImplementationRuntimePreparationContext,)(?=[\s\S]*const autoSelected = getPlanImplementationAutoSelected\(options\);)(?=[\s\S]*const confirmationSource = getPlanImplementationConfirmationSource\(\{[\s\S]*options,[\s\S]*autoSelected,[\s\S]*\}\);)(?=[\s\S]*const baseMessages = getPlanImplementationBaseMessages\(\{[\s\S]*options,[\s\S]*messagesRef,[\s\S]*\}\);)(?=[\s\S]*const updatedPlanMessages = getPlanImplementationUpdatedPlanMessages\(\{[\s\S]*baseMessages,[\s\S]*plan,[\s\S]*autoSelected,[\s\S]*\}\);)/,
  'plan implementation helper contexts should be explicit named contracts',
);
assert.doesNotMatch(
  planImplementationSource,
  /Pick<[\s\S]*PlanImplementationPreparationContext|context\.projectInfo\.isPersisted \|\| context\.projectInfo\.projectId\.startsWith\('proj_'\)|isPersistedProject === true \|\| hasPersistedProjectId === true|if \(!isExistingProject\)|if \(!hasExistingProject\)|options\?\.autoSelected \?\? false|options\?\.confirmationSource \?\?|options\?\.baseMessages \|\| messagesRef\.current|baseMessages\.map\(\(msg\) =>|msg\.kind === 'plan-options'[\s\S]*\? \{ \.\.\.msg,/,
  'plan implementation helpers should not derive preparation inputs with Pick<PlanImplementationPreparationContext> or truthy existing project gates',
);
assert.match(
  orchestrationFlowTypesSource,
  /export type PlanConfirmationSource = 'manual' \| 'confirmed' \| 'timeout';[\s\S]*export type ChoosePlanOptions = \{[\s\S]*confirmationSource\?: PlanConfirmationSource;/,
  'workspace orchestration flow should expose plan confirmation source as a named contract consumed by choose plan options',
);
assert.match(
  planImplementationSource,
  /import type \{ ChoosePlanOptions, PlanConfirmationSource \} from '\.\/workspace-orchestration-flow-types';[\s\S]*confirmationSource: PlanConfirmationSource;[\s\S]*function formatConfirmationSource\(source: PlanConfirmationSource\)[\s\S]*buildPlanApprovedEngineeringState\([\s\S]*confirmationSource: PlanConfirmationSource[\s\S]*appendImplementationKickoffMessage\([\s\S]*confirmationSource: PlanConfirmationSource[\s\S]*executePlanImplementation\([\s\S]*confirmationSource: PlanConfirmationSource;/,
  'plan implementation should consume the named plan confirmation source contract for approval state and kickoff messaging',
);
assert.doesNotMatch(
  planImplementationSource,
  /ChoosePlanOptions\['confirmationSource'\]/,
  'plan implementation should not infer confirmation source from indexed choose plan options access',
);
assert.doesNotMatch(
  planImplementationSource,
  /setMessages/,
  'plan implementation helper should not depend on the external setMessages compatibility wrapper',
);
assert.match(
  orchestrationActionOptionBuildersSource,
  /WorkspaceOrchestrationPlanningEngineeringActions[\s\S]*buildPlanningActionOptions\([\s\S]*sharedActions: WorkspaceOrchestrationPlanningEngineeringActions,[\s\S]*applyPlanGenerationMessages: options\.applyPlanGenerationMessages,[\s\S]*setIsPlanning: options\.setIsPlanning,[\s\S]*applyWorkspaceState: options\.applyWorkspaceState,[\s\S]*applyWorkflowStepToMessage: options\.applyWorkflowStepToMessage,[\s\S]*applyPlanStreamPatchMessages: options\.applyPlanStreamPatchMessages,/,
  'planning action options should pass explicit plan generation and plan stream patch actions',
);
assert.doesNotMatch(
  orchestrationActionOptionBuildersSource,
  /sharedActions: Pick<SharedActions, 'resolveStepEngineeringState'>/,
  'planning action option builder should not regress to a Pick-derived shared action slice',
);
assert.doesNotMatch(
  orchestrationActionOptionBuildersSource.slice(
    orchestrationActionOptionBuildersSource.indexOf('export function buildPlanningActionOptions'),
  ),
  /setMessages: options\.setMessages/,
  'planning action options should not pass the external setMessages compatibility wrapper',
);
assert.doesNotMatch(
  orchestrationActionOptionBuildersSource.slice(
    orchestrationActionOptionBuildersSource.indexOf('export function buildPlanningActionOptions'),
  ),
  /patchWorkspaceMessage/,
  'planning action options should not pass shared patchWorkspaceMessage into plan generation',
);
assert.match(
  orchestrationPlanningActionsSource,
  /applyPlanGenerationMessages,[\s\S]*applyPlanStreamPatchMessages,[\s\S]*const hasProjectInfo = hasWorkspaceOrchestrationPlanningProjectInfo\(projectInfo\);[\s\S]*if \(hasProjectInfo === false\)[\s\S]*runWorkspacePlanGeneration\(\{[\s\S]*projectInfo,[\s\S]*applyPlanGenerationMessages,[\s\S]*setIsPlanning,[\s\S]*applyWorkspaceState,[\s\S]*applyWorkflowStepToMessage,[\s\S]*applyPlanStreamPatchMessages,/,
  'orchestration planning actions should pass explicit plan generation and plan stream patch actions to the execution layer after project fact validation',
);
assert.doesNotMatch(
  orchestrationPlanningActionsSource,
  /setMessages|patchWorkspaceMessage|if \(!projectInfo\)/,
  'orchestration planning actions should not depend on the external setMessages compatibility wrapper, shared patchWorkspaceMessage or truthy project gate',
);
assert.match(
  orchestrationPlanExecutionSource,
  /(?=[\s\S]*const autoFoundationBeforePlanMessagePrefix = 'auto-foundation-before-plan-';)(?=[\s\S]*type WorkspacePlanGenerationFailureResult = \{[\s\S]*aborted: boolean;[\s\S]*\};)(?=[\s\S]*type WorkspaceAutoFoundationBeforePlanResult = \{[\s\S]*completed: boolean;[\s\S]*\};)(?=[\s\S]*function hasWorkspacePlanExecutionTextValue\(value: string\): boolean[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;)(?=[\s\S]*function hasWorkspacePlanExecutionProjectContext\(projectInfo: WorkspaceProjectInfo\): boolean[\s\S]*const hasDescription = hasWorkspacePlanExecutionTextValue\(projectInfo\.description\);[\s\S]*if \(hasDescription === false\)[\s\S]*const hasProjectId = hasWorkspacePlanExecutionTextValue\(projectInfo\.projectId\);[\s\S]*return hasProjectId === true;)(?=[\s\S]*function hasWorkspacePlanExecutionCompletedFoundation\(messages: WorkspaceChatMessage\[\]\): boolean[\s\S]*const hasCompletedFoundation = hasCompletedWorkspaceFoundation\(messages\);[\s\S]*return hasCompletedFoundation === true;)(?=[\s\S]*function shouldSkipWorkspacePlanExecutionRequest\(\{[\s\S]*request,[\s\S]*plannedProjectIdsRef,[\s\S]*plannedProjectIdsAcrossMounts,[\s\S]*\}: \{[\s\S]*request: PreparedPlanGenerationRequest;[\s\S]*\}\): boolean[\s\S]*const isReplan = request\.isReplan === true;[\s\S]*const isRetry = request\.isRetry === true;[\s\S]*const hasPlannedProjectInRef = plannedProjectIdsRef\.current\.has\(request\.projectId\);[\s\S]*if \(hasPlannedProjectInRef === true\)[\s\S]*shouldSkipWorkspacePlanExecutionPreviouslyPlannedRequest\(\{[\s\S]*isReplan,[\s\S]*isRetry,[\s\S]*\}\);[\s\S]*const hasPlannedProjectAcrossMounts = plannedProjectIdsAcrossMounts\.has\(request\.projectId\);[\s\S]*if \(hasPlannedProjectAcrossMounts === false\)[\s\S]*return false;[\s\S]*shouldSkipWorkspacePlanExecutionPreviouslyPlannedRequest\(\{[\s\S]*isReplan,[\s\S]*isRetry,[\s\S]*\}\);)(?=[\s\S]*function shouldSkipWorkspacePlanExecutionPreviouslyPlannedRequest\(\{[\s\S]*isReplan: boolean;[\s\S]*isRetry: boolean;[\s\S]*if \(isReplan === true\)[\s\S]*return isRetry === false;)(?=[\s\S]*function shouldResetWorkspacePlanExecutionRequestTracking\(request: PreparedPlanGenerationRequest\): boolean[\s\S]*const isReplan = request\.isReplan === true;[\s\S]*if \(isReplan === true\)[\s\S]*return true;[\s\S]*const isRetry = request\.isRetry === true;[\s\S]*return isRetry === true;)(?=[\s\S]*function shouldSupersedeWorkspacePlanExecutionMessages\(request: PreparedPlanGenerationRequest\): boolean[\s\S]*const shouldSupersede = request\.isReplan === true;[\s\S]*return shouldSupersede === true;)(?=[\s\S]*function hasWorkspacePlanGenerationFailureAborted\(result: WorkspacePlanGenerationFailureResult\): boolean[\s\S]*const hasAborted = result\.aborted === true;[\s\S]*return hasAborted === true;)(?=[\s\S]*function hasActiveAutoFoundationBeforePlanMessage\(messages: WorkspaceChatMessage\[\]\): boolean[\s\S]*for \(const message of messages\)[\s\S]*const hasMessagePrefix = message\.id\.startsWith\(autoFoundationBeforePlanMessagePrefix\);[\s\S]*if \(hasMessagePrefix === false\)[\s\S]*continue;[\s\S]*const isStreaming = message\.streaming === true;[\s\S]*if \(isStreaming === true\))(?=[\s\S]*function buildAutoFoundationRetrySuggestedAction\(\)[\s\S]*label: '重试自动准备项目基础设定',[\s\S]*kind: 'retry_plan_generation' as const,)(?=[\s\S]*async function runAutoFoundationBeforePlan\([\s\S]*Promise<WorkspaceAutoFoundationBeforePlanResult>[\s\S]*chatApi\.generateStream\(\{[\s\S]*mode: 'foundation',[\s\S]*conversation_stage: 'bootstrap_confirmed',[\s\S]*project_name: projectInfo\.projectName,)(?=[\s\S]*suggestedActions: \[buildAutoFoundationRetrySuggestedAction\(\)\])(?=[\s\S]*const hasProjectContext = hasWorkspacePlanExecutionProjectContext\(projectInfo\);[\s\S]*if \(hasProjectContext === false\) return;)(?=[\s\S]*const hasCompletedFoundation = hasWorkspacePlanExecutionCompletedFoundation\(messagesRef\.current\);[\s\S]*if \(hasCompletedFoundation === false\)[\s\S]*planningProjectIdRef\.current = projectInfo\.projectId;[\s\S]*setIsPlanning\(true\);[\s\S]*runAutoFoundationBeforePlan\(\{[\s\S]*setMessageStreamingState,[\s\S]*\}\);[\s\S]*planningProjectIdRef\.current = null;[\s\S]*setIsPlanning\(false\);[\s\S]*if \(autoFoundationResult\.completed === false\)[\s\S]*return;)(?=[\s\S]*const shouldSkipRequest = shouldSkipWorkspacePlanExecutionRequest\([\s\S]*if \(shouldSkipRequest === true\))(?=[\s\S]*const shouldResetTracking = shouldResetWorkspacePlanExecutionRequestTracking\(request\);[\s\S]*if \(shouldResetTracking === true\))(?=[\s\S]*const shouldSupersedeMessages = shouldSupersedeWorkspacePlanExecutionMessages\(request\);[\s\S]*if \(shouldSupersedeMessages === true\))(?=[\s\S]*executePlanGenerationRequest\([\s\S]*applyPlanStreamPatchMessages,[\s\S]*applyPlanGenerationMessages,)(?=[\s\S]*appendPlanGenerationFailureMessage\([\s\S]*applyPlanGenerationMessages,)(?=[\s\S]*const hasAborted = hasWorkspacePlanGenerationFailureAborted\(result\);[\s\S]*if \(hasAborted === true\))/,
  'plan orchestration execution should auto-confirm Foundation before Plan, keep terminal plan messages routed through plan generation and pass stream patch action to stream execution with explicit facts',
);
assert.doesNotMatch(
  orchestrationPlanExecutionSource,
  /patchWorkspaceMessage|foundation-required-before-plan|appendFoundationRequiredBeforePlanMessage|hasFoundationRequiredBeforePlanMessage|hasAutoFoundationBeforePlanMessage|kind: 'open_foundation_panel'|prev\.some\(\(message\) => message\.id\.startsWith\('foundation-required-before-plan-'\)\)|if \(!projectInfo\.description \|\| !projectInfo\.projectId\) return;|hasDescription === true && hasProjectId === true|if \(!hasCompletedWorkspaceFoundation\(messagesRef\.current\)\)|!request\.isReplan|!request\.isRetry|hasPlannedProjectInRef === true \|\| hasPlannedProjectAcrossMounts === true|isReplan === false && isRetry === false && hasPlannedProject === true|request\.isReplan \|\| request\.isRetry|isReplan === true \|\| isRetry === true|if \(request\.isReplan\)|if \(result\.aborted\)/,
  'plan orchestration execution should not depend on shared patchWorkspaceMessage, manual Foundation blocker messages or inline project gates',
);
assert.doesNotMatch(
  planGenerationLifecycleSource,
  /setMessages/,
  'plan generation lifecycle helpers should not write terminal messages through the external setMessages compatibility wrapper',
);
assert.match(
  planGenerationLifecycleSource,
  /(?=[\s\S]*function hasPlanGenerationLifecycleProjectIdSetRef\([\s\S]*ref: WorkspacePlanGenerationProjectIdSetRef \| undefined,[\s\S]*\): ref is WorkspacePlanGenerationProjectIdSetRef[\s\S]*const hasRef = ref !== undefined;[\s\S]*return hasRef === true;)(?=[\s\S]*function hasPlanGenerationLifecycleProjectIdSet\([\s\S]*set: WorkspacePlanGenerationProjectIdSet \| undefined,[\s\S]*\): set is WorkspacePlanGenerationProjectIdSet[\s\S]*const hasSet = set !== undefined;[\s\S]*return hasSet === true;)(?=[\s\S]*function hasPlanGenerationLifecycleAutoPlanTriggeredRef\([\s\S]*ref: MutableRefObject<boolean> \| undefined,[\s\S]*\): ref is MutableRefObject<boolean>[\s\S]*const hasRef = ref !== undefined;[\s\S]*return hasRef === true;)(?=[\s\S]*function hasPlanGenerationLifecyclePlanningAbortRef\([\s\S]*ref: MutableRefObject<AbortController \| null> \| undefined,[\s\S]*\): ref is MutableRefObject<AbortController \| null>[\s\S]*const hasRef = ref !== undefined;[\s\S]*return hasRef === true;)(?=[\s\S]*function hasPlanGenerationLifecycleSetIsPlanningAction\([\s\S]*action: Dispatch<SetStateAction<boolean>> \| undefined,[\s\S]*\): action is Dispatch<SetStateAction<boolean>>[\s\S]*const hasAction = action !== undefined;[\s\S]*return hasAction === true;)(?=[\s\S]*const plannedProjectIdsRef = context\.plannedProjectIdsRef;[\s\S]*const hasPlannedProjectIdsRef = hasPlanGenerationLifecycleProjectIdSetRef\(plannedProjectIdsRef\);[\s\S]*if \(hasPlannedProjectIdsRef === true\) \{[\s\S]*plannedProjectIdsRef\.current\.delete\(projectId\);)(?=[\s\S]*const plannedProjectIdsAcrossMounts = context\.plannedProjectIdsAcrossMounts;[\s\S]*const hasPlannedProjectIdsAcrossMounts = hasPlanGenerationLifecycleProjectIdSet\([\s\S]*plannedProjectIdsAcrossMounts,[\s\S]*\);[\s\S]*if \(hasPlannedProjectIdsAcrossMounts === true\) \{[\s\S]*plannedProjectIdsAcrossMounts\.delete\(projectId\);)(?=[\s\S]*const autoPlanTriggeredRef = context\.autoPlanTriggeredRef;[\s\S]*const hasAutoPlanTriggeredRef = hasPlanGenerationLifecycleAutoPlanTriggeredRef\(autoPlanTriggeredRef\);[\s\S]*if \(hasAutoPlanTriggeredRef === true\) \{[\s\S]*autoPlanTriggeredRef\.current = false;)(?=[\s\S]*const planningAbortRef = context\.planningAbortRef;[\s\S]*const hasPlanningAbortRef = hasPlanGenerationLifecyclePlanningAbortRef\(planningAbortRef\);[\s\S]*if \(hasPlanningAbortRef === true\) \{[\s\S]*planningAbortRef\.current = null;)(?=[\s\S]*const setIsPlanning = context\.setIsPlanning;[\s\S]*const hasSetIsPlanningAction = hasPlanGenerationLifecycleSetIsPlanningAction\(setIsPlanning\);[\s\S]*if \(hasSetIsPlanningAction === true\) \{[\s\S]*setIsPlanning\(false\);)/,
  'plan generation lifecycle should derive optional reset and clear context gates through named facts',
);
assert.doesNotMatch(
  planGenerationLifecycleSource,
  /context\.plannedProjectIdsRef\?\.current\.delete|context\.plannedProjectIdsAcrossMounts\?\.delete|if \(context\.autoPlanTriggeredRef\)|if \(context\.planningAbortRef\)|context\.setIsPlanning\?\.\(false\)/,
  'plan generation lifecycle should not regress optional reset or clear context gates to optional chaining or direct truthy refs',
);
assert.match(
  planGenerationLifecycleSource,
  /function buildPlanGenerationFailureEngineeringState\(error: unknown\): WorkspaceEngineeringStateSnapshot \{[\s\S]*stage: 'plan-analysis'[\s\S]*mode: 'plan'[\s\S]*status: 'failed'[\s\S]*plan_selection: \{[\s\S]*status: 'failed'[\s\S]*validation: \{[\s\S]*status: 'not_applicable'[\s\S]*current_phase: '方案分析'[\s\S]*pause_reason: 'plan_generation_failed'[\s\S]*approval_boundary: 'plan_generation'[\s\S]*reason_code: 'plan_generation_failed'[\s\S]*retry_label: '重新生成方案'[\s\S]*engineeringState: buildPlanGenerationFailureEngineeringState\(payload\.error\)/,
  'plan generation failure should publish a failed plan-analysis engineering state so the top flow cannot stay on stale validation',
);
assert.match(
  planGenerationTypesSource,
  /export type PlanRequestTerminalMessageKind = 'aborted' \| 'error';[\s\S]*export type PlanGenerationAvailablePlans = Plan\[\];[\s\S]*export type PlanGenerationMessagesRef = MutableRefObject<WorkspaceChatMessage\[\]>;[\s\S]*availablePlans: PlanGenerationAvailablePlans;[\s\S]*messagesRef: PlanGenerationMessagesRef;/,
  'plan generation types should name terminal request message, available plans and messages ref contracts',
);
assert.match(
  planGenerationLifecycleSource,
  /PlanRequestTerminalMessageKind[\s\S]*PlanGenerationAvailablePlans[\s\S]*PlanGenerationMessagesRef[\s\S]*type PlanGenerationLifecycleMessageList = WorkspaceChatMessage\[\];[\s\S]*function materializePlanRequestTerminalMessages\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*planMessageId: string,[\s\S]*terminalMessage: WorkspaceChatMessage,[\s\S]*\): PlanGenerationLifecycleMessageList[\s\S]*kind: PlanRequestTerminalMessageKind;[\s\S]*const terminalMessage: WorkspaceChatMessage = \{[\s\S]*id: `plan-request-\$\{payload\.kind\}-\$\{Date\.now\(\)\}`[\s\S]*return materializePlanRequestTerminalMessages\([\s\S]*prev,[\s\S]*context\.planMessageId,[\s\S]*terminalMessage,[\s\S]*\);[\s\S]*availablePlans: PlanGenerationAvailablePlans,[\s\S]*messagesRef: PlanGenerationMessagesRef,/,
  'plan generation lifecycle helpers should consume named terminal kind, available plans and messages ref contracts',
);
assert.match(
  planGenerationLifecycleSource,
  /(?=[\s\S]*function isPlanGenerationLifecyclePlanRequestTerminalMessage\([\s\S]*message: WorkspaceChatMessage,[\s\S]*\): boolean[\s\S]*const isPlanRequestErrorMessage = message\.id\.startsWith\('plan-request-error-'\);[\s\S]*if \(isPlanRequestErrorMessage === true\)[\s\S]*const isPlanRequestAbortedMessage = message\.id\.startsWith\('plan-request-aborted-'\);[\s\S]*return isPlanRequestAbortedMessage === true;)(?=[\s\S]*function materializePlanGenerationLifecycleBaseMessages\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*\): PlanGenerationLifecycleMessageList \{[\s\S]*const nextMessages: PlanGenerationLifecycleMessageList = \[\];[\s\S]*for \(const message of messages\)[\s\S]*const isPlanRequestTerminalMessage = isPlanGenerationLifecyclePlanRequestTerminalMessage\(message\);[\s\S]*if \(isPlanRequestTerminalMessage === true\)[\s\S]*nextMessages\.push\(message\);)(?=[\s\S]*function getPlanGenerationLifecycleTextValue\(value: string \| null \| undefined\): string[\s\S]*value === null \|\| value === undefined[\s\S]*return value\.trim\(\);)(?=[\s\S]*function hasPlanGenerationLifecycleTextValue\(value: string\): boolean[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;)(?=[\s\S]*function getPlanGenerationLifecycleUserFeedback\(options: PlanRequestOptions \| undefined\): string[\s\S]*options === undefined[\s\S]*return getPlanGenerationLifecycleTextValue\(options\.userFeedback\);)(?=[\s\S]*export function preparePlanGenerationRequest\([\s\S]*const hasForceReplan = options\?\.force === true;[\s\S]*const userFeedback = getPlanGenerationLifecycleUserFeedback\(options\);[\s\S]*const hasUserFeedback = hasPlanGenerationLifecycleTextValue\(userFeedback\);[\s\S]*const isReplan = hasForceReplan === true && hasUserFeedback === true;[\s\S]*const isRetry = options\?\.retry === true;[\s\S]*const optionBaseMessages = options\?\.baseMessages;[\s\S]*const hasOptionBaseMessages = optionBaseMessages !== undefined;[\s\S]*const baseMessageSource = hasOptionBaseMessages === true \? optionBaseMessages : messagesRef\.current;[\s\S]*const baseMessages = materializePlanGenerationLifecycleBaseMessages\(baseMessageSource\);)/,
  'plan generation request preparation should derive replan, retry and base-message filtering through explicit facts',
);
assert.doesNotMatch(
  planGenerationLifecycleSource,
  /prev\.filter\(\(msg\) => msg\.id !== context\.planMessageId\)|baseMessageSource\.filter\(/,
  'plan generation lifecycle should not regress terminal or base message materialization to inline filter callbacks',
);
assert.match(
  planGenerationLifecycleSource,
  /function getPlanFoundationGateEngineeringState\(error: unknown\): WorkspaceEngineeringStateSnapshot \| undefined \{[\s\S]*const hasErrorObject = error !== null && typeof error === 'object';[\s\S]*if \(hasErrorObject === false\)[\s\S]*const hasFoundationGateRecoveryReason = engineeringState\?\.recovery\?\.reason_code === 'foundation_gate_blocked';[\s\S]*const hasFoundationGatePauseReason = engineeringState\?\.execution\?\.pause_reason === 'foundation_gate_blocked';[\s\S]*const hasFoundationGateState = hasFoundationGateRecoveryReason === true \|\| hasFoundationGatePauseReason === true;[\s\S]*if \(hasFoundationGateState === true\)/,
  'plan generation lifecycle should derive Foundation gate engineering state through explicit error and gate facts',
);
assert.match(
  planGenerationLifecycleSource,
  /(?=[\s\S]*function getPlanGenerationLifecycleRecoveryState\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*\): WorkspaceRecoveryState \| undefined[\s\S]*engineeringState === undefined[\s\S]*return engineeringState\.recovery;)(?=[\s\S]*function hasPlanGenerationLifecycleRecoveryRetry\(recovery: WorkspaceRecoveryState \| undefined\): boolean[\s\S]*recovery === undefined[\s\S]*return recovery\.can_retry === true;)(?=[\s\S]*function getPlanGenerationLifecycleRetryPrompt\(recovery: WorkspaceRecoveryState \| undefined\): string[\s\S]*return getPlanGenerationLifecycleTextValue\(recovery\.retry_prompt\);)(?=[\s\S]*function buildPlanFoundationGateActions\(engineeringState\?: WorkspaceEngineeringStateSnapshot\): GuidanceAction\[\] \{[\s\S]*const recovery = getPlanGenerationLifecycleRecoveryState\(engineeringState\);[\s\S]*const hasRecoveryRetry = hasPlanGenerationLifecycleRecoveryRetry\(recovery\);[\s\S]*const retryPrompt = getPlanGenerationLifecycleRetryPrompt\(recovery\);[\s\S]*const hasRetryPrompt = hasPlanGenerationLifecycleTextValue\(retryPrompt\);[\s\S]*if \(hasRecoveryRetry === true && hasRetryPrompt === true\) \{[\s\S]*label: '重试自动准备项目基础设定',[\s\S]*kind: 'retry_workflow_gate',[\s\S]*prompt: retryPrompt,[\s\S]*mode: 'foundation',)(?=[\s\S]*label: '重试自动准备项目基础设定',[\s\S]*kind: 'send_prompt',[\s\S]*conversationStage: 'bootstrap_confirmed',)/,
  'plan generation Foundation gate actions should route recovery through automatic project setup retry without a visible Foundation panel',
);
assert.match(
  planGenerationLifecycleSource,
  /(?=[\s\S]*function getPlanGenerationLifecycleExecutionState\([\s\S]*\): WorkspaceExecutionState \| undefined)(?=[\s\S]*function getPlanGenerationLifecycleBootstrapState\([\s\S]*\): WorkspaceBootstrapState \| undefined)(?=[\s\S]*function getPlanGenerationLifecycleRecoveryReasonMessage\(recovery: WorkspaceRecoveryState \| undefined\): string[\s\S]*return getPlanGenerationLifecycleTextValue\(recovery\.reason_message\);)(?=[\s\S]*function getPlanGenerationLifecycleExecutionNextAction\([\s\S]*execution: WorkspaceExecutionState \| undefined,[\s\S]*\): string[\s\S]*return getPlanGenerationLifecycleTextValue\(execution\.next_action\);)(?=[\s\S]*function getPlanGenerationLifecycleBootstrapNextAction\([\s\S]*bootstrapState: WorkspaceBootstrapState \| undefined,[\s\S]*\): string[\s\S]*return getPlanGenerationLifecycleTextValue\(bootstrapState\.next_action\);)(?=[\s\S]*const foundationGateState = getPlanFoundationGateEngineeringState\(payload\.error\);[\s\S]*const hasFoundationGateState = foundationGateState !== undefined;[\s\S]*if \(hasFoundationGateState === true\) \{[\s\S]*const recovery = getPlanGenerationLifecycleRecoveryState\(foundationGateState\);[\s\S]*const execution = getPlanGenerationLifecycleExecutionState\(foundationGateState\);[\s\S]*const bootstrapState = getPlanGenerationLifecycleBootstrapState\(foundationGateState\);[\s\S]*const recoveryReasonMessage = getPlanGenerationLifecycleRecoveryReasonMessage\(recovery\);[\s\S]*const hasRecoveryReasonMessage = hasPlanGenerationLifecycleTextValue\(recoveryReasonMessage\);[\s\S]*const executionNextAction = getPlanGenerationLifecycleExecutionNextAction\(execution\);[\s\S]*const hasExecutionNextAction = hasPlanGenerationLifecycleTextValue\(executionNextAction\);[\s\S]*const bootstrapNextAction = getPlanGenerationLifecycleBootstrapNextAction\(bootstrapState\);[\s\S]*const hasBootstrapNextAction = hasPlanGenerationLifecycleTextValue\(bootstrapNextAction\);[\s\S]*const nextAction = hasRecoveryReasonMessage === true)/,
  'plan generation lifecycle should derive Foundation gate terminal next action through explicit priority facts',
);
assert.doesNotMatch(
  planGenerationLifecycleSource,
  /kind: 'aborted' \| 'error'|PreparePlanGenerationRequestOptions\['(?:availablePlans|messagesRef)'\]|!!options\?\.force|!!options\?\.retry|options\?\.userFeedback\?\.trim\(\) \|\| ''|options\?\.userFeedback\?\.trim\(\) \?\? ''|options\?\.baseMessages \|\| messagesRef\.current|!msg\.id\.startsWith\('plan-request-error-'\)|if \(!error \|\| typeof error !== 'object'\)|recovery\?\.can_retry && recovery\.retry_prompt|recovery\?\.retry_prompt\?\.trim\(\) \?\? ''|recovery\?\.retry_label\?\.trim\(\) \?\? ''|recovery\.retry_label \|\| '回到 Foundation 修复'|foundationGateState\.recovery\?\.reason_message\?\.trim\(\) \?\? ''|foundationGateState\.execution\?\.next_action\?\.trim\(\) \?\? ''|foundationGateState\.bootstrap_state\?\.next_action\?\.trim\(\) \?\? ''|foundationGateState\.recovery\?\.reason_message[\s\S]*\|\| foundationGateState\.execution\?\.next_action/,
  'plan generation lifecycle helpers should not regress terminal message kind, request option fields or request gates to inline or implicit forms',
);
assert.match(
  orchestrationExecutionTypesSource,
  /export type WorkspacePlanGenerationMessagesAction = \(value: SetStateAction<WorkspaceChatMessage\[\]>\) => void;[\s\S]*export type WorkspacePlanGenerationAutoPlanTriggeredRef = MutableRefLike<boolean>;[\s\S]*export type WorkspacePlanGenerationRequestedPlansRef = MutableRefLike<WorkspacePlanGenerationProjectIdSet>;[\s\S]*export type WorkspacePlanGenerationRequestedProjects = WorkspacePlanGenerationProjectIdSet;[\s\S]*requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationRequestedProjects;[\s\S]*plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;[\s\S]*autoPlanTriggeredRef: WorkspacePlanGenerationAutoPlanTriggeredRef;[\s\S]*requestedPlansRef: WorkspacePlanGenerationRequestedPlansRef;[\s\S]*plannedProjectIdsRef: MutableRefLike<WorkspacePlanGenerationProjectIdSet>;[\s\S]*applyPlanGenerationMessages: WorkspacePlanGenerationMessagesAction;/,
  'plan generation execution options should name plan message action and request tracking refs',
);
assert.match(
  planGenerationTypesSource,
  /export type WorkspacePlanGenerationProjectId = string;[\s\S]*export type WorkspacePlanGenerationProjectIdSet = Set<WorkspacePlanGenerationProjectId>;[\s\S]*export type WorkspacePlanGenerationProjectIdSetRef = MutableRefObject<WorkspacePlanGenerationProjectIdSet>;/,
  'plan generation types should name project id set and ref contracts for request tracking',
);
assert.doesNotMatch(
  [
    pageContainerSource,
    pageCompositionSource,
    pageControllersSource,
    pageActionControllersSource,
    pageAiActionsSource,
    pageOrchestrationActionsSource,
    pageFoundationSource,
    orchestrationExecutionTypesSource,
    orchestrationHookTypesSource,
    planGenerationLifecycleSource,
    planGenerationExecutionSource,
    planGenerationFinalizationSource,
  ].join('\n'),
  /(?:requestedPlanProjectsAcrossMounts|plannedProjectIdsAcrossMounts|plannedProjectIdsRef|requestedPlansRef): (?:MutableRefObject<)?Set<string>/,
  'plan generation project tracking should not regress to raw Set<string> contracts',
);
assert.match(
  planGenerationFinalizationSource,
  /type PlanGenerationFinalizationMessageList = WorkspaceChatMessage\[\];[\s\S]*function getPlanGenerationFinalizationTextValue\(value: string \| null \| undefined\): string \{[\s\S]*if \(value === null \|\| value === undefined\) \{[\s\S]*return '';[\s\S]*return value\.trim\(\);[\s\S]*function hasPlanGenerationFinalizationTextValue\(value: string\): boolean \{[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;[\s\S]*function getPlanGenerationFinalizationMessage\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*planMessageId: string,[\s\S]*\): WorkspaceChatMessage \| undefined \{[\s\S]*for \(const message of messages\)[\s\S]*const isTargetMessage = message\.id === planMessageId;[\s\S]*if \(isTargetMessage === true\)[\s\S]*function getPlanGenerationFinalizationWorkflowSteps\([\s\S]*latestPlanMessage: WorkspaceChatMessage \| undefined,[\s\S]*\)[\s\S]*if \(latestPlanMessage === undefined\)[\s\S]*return latestPlanMessage\.workflowSteps;[\s\S]*function materializePlanGenerationFinalizedMessages\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*planMessageId: string,[\s\S]*planMessage: WorkspaceChatMessage,[\s\S]*\): PlanGenerationFinalizationMessageList \{[\s\S]*const nextMessages: PlanGenerationFinalizationMessageList = \[\];[\s\S]*for \(const message of messages\)[\s\S]*const isCurrentPlanMessage = message\.id === planMessageId;[\s\S]*if \(isCurrentPlanMessage === true\)[\s\S]*nextMessages\.push\(message\);[\s\S]*nextMessages\.push\(planMessage\);[\s\S]*function getPlanGenerationFinalizationReasoningContent\([\s\S]*payload: PlanGenerationStreamResult,[\s\S]*latestPlanMessage: WorkspaceChatMessage \| undefined,[\s\S]*\): string \| undefined \{[\s\S]*const analysisContent = getPlanGenerationFinalizationTextValue\(payload\.analysisContent\);[\s\S]*const hasAnalysisContent = hasPlanGenerationFinalizationTextValue\(analysisContent\);[\s\S]*if \(hasAnalysisContent === true\) \{[\s\S]*return analysisContent;[\s\S]*const latestReasoningContent = getPlanGenerationFinalizationTextValue\(latestPlanMessage\?\.reasoningContent\);[\s\S]*const hasLatestReasoningContent = hasPlanGenerationFinalizationTextValue\(latestReasoningContent\);[\s\S]*return hasLatestReasoningContent === true \? latestReasoningContent : undefined;[\s\S]*const latestPlanMessage = getPlanGenerationFinalizationMessage\([\s\S]*context\.messagesRef\.current,[\s\S]*context\.planMessageId,[\s\S]*\);[\s\S]*const reasoningContent = getPlanGenerationFinalizationReasoningContent\(payload, latestPlanMessage\);[\s\S]*const workflowSteps = getPlanGenerationFinalizationWorkflowSteps\(latestPlanMessage\);[\s\S]*workflowSteps,[\s\S]*const nextMessages = materializePlanGenerationFinalizedMessages\([\s\S]*context\.messagesRef\.current,[\s\S]*context\.planMessageId,[\s\S]*context\.planMessage,[\s\S]*\);[\s\S]*context\.applyWorkspaceState\(nextMessages,/,
  'plan generation finalization should derive final reasoning content and finalized messages through explicit readers/materializers',
);
assert.doesNotMatch(
  planGenerationFinalizationSource,
  /payload\.analysisContent\.trim\(\) \|\| latestPlanMessage\?\.reasoningContent|payload\.analysisContent\.trim\(\) \|\| undefined|latestPlanMessage\?\.reasoningContent \|\| undefined|messagesRef\.current\.find\(|messagesRef\.current\.filter\(|latestPlanMessage\?\.workflowSteps|\[\.\.\.currentMessages,\s*context\.planMessage\]/,
  'plan generation finalization should not regress final reasoning content or finalized message assembly to inline fallbacks',
);
assert.match(
  orchestrationPlanExecutionSource,
  /(?=[\s\S]*WorkspacePlanGenerationMessagesAction)(?=[\s\S]*WorkspacePlanGenerationAutoPlanTriggeredRef)(?=[\s\S]*WorkspacePlanGenerationRequestedPlansRef)(?=[\s\S]*WorkspacePlanGenerationRequestedProjects)(?=[\s\S]*applyPlanGenerationMessages: WorkspacePlanGenerationMessagesAction;)(?=[\s\S]*autoPlanTriggeredRef: WorkspacePlanGenerationAutoPlanTriggeredRef;)(?=[\s\S]*requestedPlansRef: WorkspacePlanGenerationRequestedPlansRef;)(?=[\s\S]*requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationRequestedProjects;)/,
  'plan orchestration execution should consume named plan message action and request tracking refs for foundation-required messages',
);
assert.doesNotMatch(
  orchestrationPlanExecutionSource,
  /RunWorkspacePlanGenerationOptions\['(?:applyPlanGenerationMessages|autoPlanTriggeredRef|requestedPlansRef|requestedPlanProjectsAcrossMounts)'\]/,
  'plan orchestration execution should not infer plan message action or request tracking refs through RunWorkspacePlanGenerationOptions indexed access',
);
assert.doesNotMatch(
  planGenerationExecutionSource,
  /setMessages/,
  'plan generation execution helpers should not create streaming messages through the external setMessages compatibility wrapper',
);
assert.match(
  planGenerationExecutionSource,
  /export type PlanGenerationExecutionContext = \{[\s\S]*appendReasoningChunk: \(current: string, nextChunk: string\) => string;[\s\S]*applyWorkspaceState: ApplyWorkspaceState;[\s\S]*applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*applyPlanStreamPatchMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*plannedProjectIdsRef: WorkspacePlanGenerationProjectIdSetRef;[\s\S]*\};[\s\S]*type WorkspacePlanStreamPatchMessageList = WorkspaceChatMessage\[\];[\s\S]*type WorkspacePlanStreamPatchMessageMaterializerInput = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*messageId: string;[\s\S]*patch: WorkspaceMessagePatch;[\s\S]*\};[\s\S]*function materializeWorkspacePlanStreamPatchMessages\(\{[\s\S]*messages,[\s\S]*messageId,[\s\S]*patch,[\s\S]*\}: WorkspacePlanStreamPatchMessageMaterializerInput\): WorkspacePlanStreamPatchMessageList \{[\s\S]*const nextMessages: WorkspacePlanStreamPatchMessageList = \[\];[\s\S]*for \(const message of messages\)[\s\S]*if \(message\.id !== messageId\)[\s\S]*const nextPatch = typeof patch === 'function' \? patch\(message\) : patch;[\s\S]*const hasNextPatch = nextPatch !== null && nextPatch !== undefined;[\s\S]*if \(hasNextPatch === false\)[\s\S]*nextMessages\.push\(\{[\s\S]*\.\.\.message,[\s\S]*\.\.\.nextPatch,[\s\S]*\}\);[\s\S]*return nextMessages;[\s\S]*context: PlanGenerationExecutionContext,[\s\S]*const patchPlanStreamMessage = \([\s\S]*context\.applyPlanStreamPatchMessages\(\(prev\) => materializeWorkspacePlanStreamPatchMessages\(\{[\s\S]*messages: prev,[\s\S]*messageId,[\s\S]*patch,[\s\S]*\}\)\);[\s\S]*consumePlanGenerationStream\([\s\S]*patchPlanStreamMessage,/,
  'plan generation execution should expose an explicit execution context and route running, done and error stream patches through the plan stream patch action',
);
assert.match(
  planGenerationExecutionSource,
  /const hasUserFeedback = request\.userFeedback\.length > 0;[\s\S]*const hasCurrentPlansForReplan = request\.currentPlansForReplan\.length > 0;[\s\S]*user_feedback: hasUserFeedback === true \? request\.userFeedback : undefined,[\s\S]*current_plans: hasCurrentPlansForReplan === true \? request\.currentPlansForReplan : undefined,/,
  'plan generation execution should build request payload optional fields through explicit presence facts',
);
assert.doesNotMatch(
  planGenerationExecutionSource,
  /patchWorkspaceMessage|Omit<PlanStreamContext,\s*['"]patchPlanStreamMessage['"]>|prev\.map\(\(message\) =>|user_feedback: request\.userFeedback \|\| undefined|current_plans: request\.currentPlansForReplan\.length > 0 \? request\.currentPlansForReplan : undefined/,
  'plan generation execution should not depend on shared patchWorkspaceMessage, derive execution context with Omit or regress request payload gates',
);
assert.doesNotMatch(
  planGenerationStreamTypesSource,
  /setMessages/,
  'plan generation stream context should not expose the external setMessages compatibility wrapper',
);
assert.match(
  planGenerationStreamTypesSource,
  /patchPlanStreamMessage: \(messageId: string, patch: WorkspaceMessagePatch\) => void;/,
  'plan generation stream context should expose a dedicated plan stream patch helper',
);
assert.doesNotMatch(
  planGenerationStreamTypesSource,
  /patchWorkspaceMessage/,
  'plan generation stream context should not expose shared patchWorkspaceMessage',
);
assert.match(
  planGenerationStreamTypesSource,
  /export type PlanMessagePatchWriter = \(patch: WorkspaceMessagePatch\) => void;[\s\S]*export type PlanMessagePatcherContext = \{[\s\S]*patchPlanStreamMessage: \(messageId: string, patch: WorkspaceMessagePatch\) => void;[\s\S]*\};[\s\S]*export type PlanProgressEventContext = PlanMessagePatchContext & \{[\s\S]*appendReasoningLine: \(current: string, nextLine: string\) => string;[\s\S]*\};[\s\S]*export type PlanStepEffectsContext = PlanMessagePatchContext & PlanMessageIdentityContext & \{[\s\S]*appendReasoningLine: \(current: string, nextLine: string\) => string;[\s\S]*applyWorkflowStepToMessage: \(messageId: string, step: WorkflowStep\) => void;[\s\S]*\};[\s\S]*export type PlanStepEventContext = PlanStepEffectsContext & \{[\s\S]*normalizeWorkflowStep: NormalizeWorkflowStep;[\s\S]*resolveStepEngineeringState: ResolveStepEngineeringState;[\s\S]*\};[\s\S]*export type PlanChunkEventContext = PlanMessagePatchContext & \{[\s\S]*appendReasoningChunk: \(current: string, nextChunk: string\) => string;[\s\S]*\};[\s\S]*export type PlanEventContext = \{[\s\S]*applyPlanGenerationMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*enrichPlanMessageGuidance: \(message: WorkspaceChatMessage\) => WorkspaceChatMessage;[\s\S]*\};[\s\S]*export type PlanDoneEventContext = PlanMessagePatchContext & PlanMessageIdentityContext & \{[\s\S]*getSuggestedActionsFromEvent: WorkspaceSuggestedActionsEventReader;[\s\S]*getSuggestedQuestionsFromEvent: WorkspaceSuggestedQuestionsEventReader;[\s\S]*setMessageStreamingState: \(messageId: string, streaming: boolean\) => void;[\s\S]*\};[\s\S]*export type PlanErrorEventContext = PlanMessagePatchContext & \{[\s\S]*appendReasoningLine: \(current: string, nextLine: string\) => string;[\s\S]*getEventMessage: WorkspaceEventMessageResolver;[\s\S]*resolveStepEngineeringState: ResolveStepEngineeringState;[\s\S]*\};/,
  'plan generation stream event context contracts should be explicit named slices of the stream context',
);
assert.match(
  planGenerationStreamEventsSource,
  /PlanChunkEventContext,[\s\S]*PlanDoneEventContext,[\s\S]*PlanErrorEventContext,[\s\S]*PlanEventContext,[\s\S]*PlanMessagePatcherContext,[\s\S]*PlanProgressEventContext,[\s\S]*PlanStepEventContext,[\s\S]*type PlanGenerationStreamPlanList = Plan\[\];[\s\S]*type PlanGenerationStreamMessageList = WorkspaceChatMessage\[\];[\s\S]*type PlanGenerationStreamMessageMaterializerInput = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*planMessageId: string;[\s\S]*planMessage: WorkspaceChatMessage;[\s\S]*\};[\s\S]*function getPlanGenerationStreamPlanIndex\([\s\S]*plans: Plan\[\],[\s\S]*planId: string,[\s\S]*\): number \{[\s\S]*for \(let index = 0; index < plans\.length; index \+= 1\)[\s\S]*const isTargetPlan = plan\.id === planId;[\s\S]*if \(isTargetPlan === true\)[\s\S]*function materializePlanGenerationStreamPlans\([\s\S]*plans: Plan\[\],[\s\S]*nextPlan: Plan,[\s\S]*\): PlanGenerationStreamPlanList \{[\s\S]*const nextPlans: PlanGenerationStreamPlanList = \[\];[\s\S]*for \(const plan of plans\)[\s\S]*const existingIndex = getPlanGenerationStreamPlanIndex\(nextPlans, nextPlan\.id\);[\s\S]*function getPlanGenerationStreamMessageWorkflowSteps\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*planMessageId: string,[\s\S]*\)[\s\S]*for \(const message of messages\)[\s\S]*return message\.workflowSteps;[\s\S]*function materializePlanGenerationStreamMessages\(\{[\s\S]*messages,[\s\S]*planMessageId,[\s\S]*planMessage,[\s\S]*\}: PlanGenerationStreamMessageMaterializerInput\): PlanGenerationStreamMessageList \{[\s\S]*const nextMessages: PlanGenerationStreamMessageList = \[\];[\s\S]*let hasReplacedPlanMessage = false;[\s\S]*for \(const message of messages\)[\s\S]*\.\.\.message,[\s\S]*\.\.\.planMessage,[\s\S]*hasReplacedPlanMessage = true;[\s\S]*if \(hasReplacedPlanMessage === false\)[\s\S]*nextMessages\.push\(planMessage\);[\s\S]*handlePlanEvent\([\s\S]*context: PlanEventContext,[\s\S]*const dedupedPlans = materializePlanGenerationStreamPlans\(state\.generatedPlans, nextPlan\);[\s\S]*context\.applyPlanGenerationMessages\(\(prev\) => \{[\s\S]*const workflowSteps = getPlanGenerationStreamMessageWorkflowSteps\(prev, state\.planMessageId\);[\s\S]*workflowSteps,[\s\S]*return materializePlanGenerationStreamMessages\(\{[\s\S]*messages: prev,[\s\S]*planMessageId: state\.planMessageId,[\s\S]*planMessage: nextPlanMessage,[\s\S]*\}\);/,
  'plan generation stream plan events should update plans and plan-options messages through explicit materializers',
);
assert.doesNotMatch(
  planGenerationStreamEventsSource,
  /dedupedPlans\.findIndex\(|nextMessages\.findIndex\(|const dedupedPlans = \[\.\.\.state\.generatedPlans\]|const nextMessages = \[\.\.\.prev\]|nextMessages\[messageIndex\]\?\.workflowSteps/,
  'plan generation stream plan events should not regress plan or message updates to inline array scans',
);
assert.match(
  planGenerationStreamEventsSource,
  /createPlanMessagePatcher\([\s\S]*context: PlanMessagePatcherContext,[\s\S]*context\.patchPlanStreamMessage\(planMessageId, \(message\) => \{/,
  'plan generation stream patch helper should route progress, chunk, done and error patches through the dedicated plan stream patch helper',
);
assert.match(
  planGenerationStreamEventsSource,
  /const nextPatch = typeof patch === 'function' \? patch\(message\) : patch;[\s\S]*const hasNextPatch = nextPatch !== null && nextPatch !== undefined;[\s\S]*return hasNextPatch === true \? \{ kind: 'plan-options', \.\.\.nextPatch \} : null;/,
  'plan generation stream patch helper should derive patch presence explicitly',
);
assert.match(
  planGenerationStreamEventsSource,
  /function getPlanStreamReasoningContent\(value: string \| null \| undefined\): string[\s\S]*value === null \|\| value === undefined[\s\S]*const hasStatusMessage = statusMessage\.length > 0;[\s\S]*const hasRepeatedStatusMessage = statusMessage === lastStatusMessage;[\s\S]*if \(hasStatusMessage === false \|\| hasRepeatedStatusMessage === true\)[\s\S]*const analysisContentValue = analysisContent\.trim\(\);[\s\S]*const hasAnalysisContent = analysisContentValue\.length > 0;[\s\S]*if \(hasAnalysisContent === true\) return null;[\s\S]*const reasoningContent = getPlanStreamReasoningContent\(message\.reasoningContent\);/,
  'plan generation progress events should append status reasoning through explicit status and analysis facts',
);
assert.match(
  planGenerationStreamEventsSource,
  /const nextPlan = data\.plan as Plan \| undefined;[\s\S]*const hasNextPlan = nextPlan !== undefined && nextPlan !== null && typeof nextPlan === 'object';[\s\S]*if \(hasNextPlan === false\)[\s\S]*const analysisContent = state\.analysisContent\.trim\(\);[\s\S]*const hasAnalysisContent = analysisContent\.length > 0;[\s\S]*reasoningContent: hasAnalysisContent === true \? analysisContent : state\.lastStatusMessage,/,
  'plan generation plan events should derive plan presence and reasoning fallback through explicit facts',
);
assert.match(
  planGenerationStreamEventsSource,
  /function getPlanStreamEventText\(value: unknown\): string[\s\S]*typeof value !== 'string'[\s\S]*function hasPlanStreamContent\(value: string\): boolean[\s\S]*const hasContent = value\.length > 0;[\s\S]*return hasContent === true;[\s\S]*function handlePlanChunkEvent\([\s\S]*const reasoningContent = getPlanStreamEventText\(data\.reasoningContent\);[\s\S]*const hasReasoningContent = hasPlanStreamContent\(reasoningContent\);[\s\S]*if \(hasReasoningContent === true\)[\s\S]*context\.appendReasoningChunk\(analysisContent, reasoningContent\)[\s\S]*const eventContent = getPlanStreamEventText\(data\.content\);[\s\S]*nextAnalysisContent \+= eventContent;/,
  'plan generation chunk events should derive reasoning and content text through explicit stream readers',
);
assert.match(
  planGenerationStreamEventsSource,
  /const hasEventPlans = Array\.isArray\(data\.plans\) && data\.plans\.length > 0;[\s\S]*if \(hasEventPlans === true\)[\s\S]*const eventContent = typeof data\.content === 'string' \? data\.content\.trim\(\) : '';[\s\S]*const hasEventContent = eventContent\.length > 0;[\s\S]*if \(hasEventContent === true\)/,
  'plan generation done events should derive plan and content presence through explicit facts',
);
assert.match(
  planGenerationStreamEventsSource,
  /const hasEngineeringState = engineeringState !== undefined;[\s\S]*reasoningContent: context\.appendReasoningLine\([\s\S]*getPlanStreamReasoningContent\(currentMessage\.reasoningContent\),[\s\S]*message,[\s\S]*\),[\s\S]*engineeringState: hasEngineeringState === true \? engineeringState : currentMessage\.engineeringState,/,
  'plan generation error events should merge reasoning and engineering state through explicit presence facts',
);
assert.match(
  planStepEffectsSource,
  /PlanStepEffectsContext,[\s\S]*applyPlanStepEffects\([\s\S]*context: PlanStepEffectsContext,/,
  'plan step effects should consume the named step effects context contract',
);
assert.match(
  planStepEffectsSource,
  /function getPlanStepReasoningContent\(value: string \| null \| undefined\): string[\s\S]*value === null \|\| value === undefined[\s\S]*const hasStatusLine = statusLine\.length > 0;[\s\S]*const analysisContentValue = state\.analysisContent\.trim\(\);[\s\S]*const hasAnalysisContent = analysisContentValue\.length > 0;[\s\S]*const shouldAppendStatusLine = hasStatusLine === true && hasAnalysisContent === false;[\s\S]*const hasStepEngineeringState = stepEngineeringState !== undefined;[\s\S]*if \(shouldAppendStatusLine === true\)[\s\S]*const reasoningContent = getPlanStepReasoningContent\(message\.reasoningContent\);[\s\S]*reasoningContent: context\.appendReasoningLine\(reasoningContent, statusLine\),[\s\S]*engineeringState: hasStepEngineeringState === true \? stepEngineeringState : message\.engineeringState,[\s\S]*if \(hasStepEngineeringState === true\)[\s\S]*nextLastStatusMessage: shouldAppendStatusLine === true/,
  'plan step effects should derive status line, analysis and step engineering state gates explicitly',
);
assert.doesNotMatch(
  `${planGenerationStreamEventsSource}\n${planStepEffectsSource}`,
  /Pick<[\s\S]*PlanStreamContext|return nextPatch \?|!analysisContent\.trim\(\)|message\.reasoningContent \|\| ''|message\.reasoningContent \?\? ''|currentMessage\.reasoningContent \|\| ''|currentMessage\.reasoningContent \?\? ''|engineeringState \|\| currentMessage\.engineeringState|statusLine && !state\.analysisContent\.trim\(\)|stepEngineeringState \|\| message\.engineeringState|if \(!nextPlan \|\| typeof nextPlan !== 'object'\)|state\.analysisContent\.trim\(\) \|\| state\.lastStatusMessage|typeof data\.reasoningContent === 'string' && data\.reasoningContent|typeof data\.content === 'string' \? data\.content : ''|typeof data\.content === 'string' && data\.content\.trim\(\)/,
  'plan generation stream events and step effects should not derive handler inputs with Pick<PlanStreamContext> or regress to implicit stream gates',
);
assert.doesNotMatch(
  planGenerationStreamEventsSource,
  /setMessages|patchWorkspaceMessage/,
  'plan generation stream events should not write plan messages through the external setMessages compatibility wrapper or shared patchWorkspaceMessage',
);
assert.match(
  pageAiActionsSource,
  /useWorkspacePageConversationActions\(\{[\s\S]*flowState: \{[\s\S]*applyPromptInteractionMessages: flowState\.applyPromptInteractionMessages,[\s\S]*applyPageEffectMessages: flowState\.applyPageEffectMessages,[\s\S]*messagesRef: flowState\.messagesRef,/,
  'page AI actions should pass prompt interaction and page effect actions to conversation actions',
);
assert.match(
  pageAiActionsSource,
  /import type \{ WorkspacePageAiActionsContract \} from '\.\/workspace-page-ai-actions-contract';[\s\S]*\}: UseWorkspacePageAiActionsOptions\): WorkspacePageAiActionsContract \{[\s\S]*const orchestrationActions = useWorkspacePageOrchestrationActions\([\s\S]*const conversationActions = useWorkspacePageConversationActions\([\s\S]*return \{[\s\S]*\.\.\.conversationActions,[\s\S]*choosePlanAndImplement: orchestrationActions\.choosePlanAndImplement,[\s\S]*requestPlansForProject: orchestrationActions\.requestPlansForProject,/,
  'page AI actions hook should return the explicit page AI actions contract including plan request forwarding',
);
assert.match(
  pageAiActionsSource,
  /import type \{[\s\S]*WorkspacePageConversationProjectActions,[\s\S]*WorkspacePageConversationShellState,[\s\S]*\} from '\.\/use-workspace-page-conversation-actions';[\s\S]*export type WorkspacePageAiRuntimeResources = \{[\s\S]*fetchProjectDetail: \(projectId: string\) => Promise<void>;[\s\S]*refreshProjectFileTree: \([\s\S]*projectId: string,[\s\S]*force\?: boolean,[\s\S]*options\?: WorkspaceFileTreeRefreshOptions,[\s\S]*\) => Promise<void>;[\s\S]*waitForProjectRuntimeReady: \(projectId: string\) => Promise<ProjectRuntimeStatus>;[\s\S]*ensureProjectRuntimeReady: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceRuntimeReadinessOptions,[\s\S]*\) => Promise<ProjectRuntimeStatus>;[\s\S]*fetchProjectCommits: \([\s\S]*projectId: string,[\s\S]*options\?: WorkspaceGitResourceRefreshOptions,[\s\S]*\) => Promise<GitCommit\[\]>;[\s\S]*\};[\s\S]*export type WorkspacePageAiProjectActions =[\s\S]*WorkspacePageConversationProjectActions[\s\S]*& \{[\s\S]*reflectFilePathInTree: \(path: string, leafType\?: FileNodeType\) => void;[\s\S]*applyIncrementalWorkflowStep: \(step: WorkflowStep\) => void;[\s\S]*\};[\s\S]*export type WorkspacePageAiShellState = WorkspacePageConversationShellState;[\s\S]*shellState: WorkspacePageAiShellState;[\s\S]*runtimeResources: WorkspacePageAiRuntimeResources;[\s\S]*projectActions: WorkspacePageAiProjectActions;/,
  'page AI actions should expose named runtime, shell and project action input contracts',
);
assert.doesNotMatch(
  pageAiActionsSource,
  /type (RuntimeResources|ProjectActions|ShellState) = Pick<|Pick<Workspace(RuntimeResources|PageProjectActions|ShellState)Contract/,
  'page AI action inputs should not regress to Pick-derived runtime, project action or shell slices',
);
assert.match(
  pageConversationActionsSource,
  /export type WorkspacePageConversationFlowState = \{[\s\S]*applyPromptInteractionMessages: WorkspaceMessageListAction;[\s\S]*applyPageEffectMessages: WorkspaceMessageListAction;[\s\S]*messagesRef: RefObject<WorkspaceChatMessage\[\]>;[\s\S]*availablePlans: Plan\[\];[\s\S]*recommendedPlanId: string \| null;[\s\S]*selectedPlanId: string \| null;[\s\S]*updatePlanFlowState: \(patch: WorkspacePlanFlowStatePatch\) => void;[\s\S]*\};[\s\S]*flowState: WorkspacePageConversationFlowState;[\s\S]*const \{[\s\S]*applyPromptInteractionMessages,[\s\S]*applyPageEffectMessages,[\s\S]*useWorkspacePageEffects\(\{[\s\S]*applyPageEffectMessages,[\s\S]*useWorkspacePromptActions\(\{[\s\S]*setInput,[\s\S]*applyPromptInteractionMessages,[\s\S]*updatePlanFlowState,/,
  'conversation actions should pass prompt interaction action to prompt actions and page effect action through a named flow input contract',
);
assert.match(
  pageConversationActionsSource,
  /export type WorkspacePageConversationOrchestrationActions = \{[\s\S]*buildPlanDiscussionPrompt: \(question: string\) => string;[\s\S]*choosePlanAndImplement: WorkspacePlanImplementationActionContract;[\s\S]*handleLLMGenerate: WorkspaceImplementationGenerationActionContract;[\s\S]*requestPlansForProject: \(options\?: PlanRequestOptions\) => Promise<void>;[\s\S]*\};[\s\S]*export type WorkspacePageConversationShellState = \{[\s\S]*setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>;[\s\S]*\};[\s\S]*export type WorkspacePageConversationProjectActions = \{[\s\S]*openWorkspaceFile: \(target: string \| WorkspaceEditorNavigationTarget\) => Promise<void>;[\s\S]*openExplorerPanel: \(\) => void;[\s\S]*refreshExplorerPanel: \(\) => Promise<void>;[\s\S]*\};[\s\S]*shellState: WorkspacePageConversationShellState;[\s\S]*projectActions: WorkspacePageConversationProjectActions;[\s\S]*orchestrationActions: WorkspacePageConversationOrchestrationActions;/,
  'conversation actions should expose named orchestration, shell and project action input contracts',
);
assert.doesNotMatch(
  pageConversationActionsSource,
  /type (FlowState|OrchestrationActions|ShellState|ProjectActions) = Pick<|Pick<Workspace(FlowState|PageOrchestrationActions|ShellState|PageProjectActions)Contract/,
  'conversation actions inputs should not regress to Pick-derived state or action slices',
);
assert.match(
  pageConversationActionsSource,
  /import type \{ WorkspacePageConversationActionsContract \} from '\.\/workspace-page-conversation-actions-contract';[\s\S]*\}: UseWorkspacePageConversationActionsOptions\): WorkspacePageConversationActionsContract \{[\s\S]*const \{ handleCancelStopGenerate, handleStopGenerate \} = useWorkspacePageEffects\([\s\S]*const \{[\s\S]*handleGenerate,[\s\S]*handleSuggestedQuestion,[\s\S]*handleSuggestedAction,[\s\S]*handleStartFoundation,[\s\S]*handleConfirmFoundationDecisions,[\s\S]*foundationActionLabel,[\s\S]*foundationStatusLabel,[\s\S]*\} = useWorkspacePromptActions\([\s\S]*return \{[\s\S]*handleCancelStopGenerate,[\s\S]*handleStopGenerate,[\s\S]*handleGenerate,[\s\S]*handleSuggestedQuestion,[\s\S]*handleSuggestedAction,[\s\S]*handleStartFoundation,[\s\S]*handleConfirmFoundationDecisions,[\s\S]*foundationActionLabel,[\s\S]*foundationStatusLabel,/,
  'conversation actions hook should return the explicit page conversation actions contract',
);
assert.match(
  promptActionsSource,
  /export type FoundationActionStage = 'bootstrap' \| 'bootstrap_review' \| 'bootstrap_confirmed';[\s\S]*export type FoundationAction = \{[\s\S]*stage: FoundationActionStage;[\s\S]*label: string;[\s\S]*prompt: string;[\s\S]*statusLabel: string;[\s\S]*\};[\s\S]*export type FoundationDecisionBucket = 'must_decide_now' \| 'reserve_extension_now' \| 'defer_with_record';[\s\S]*function getFoundationBlockedStatusLabel\(status: string \| undefined\): string[\s\S]*const isBlockedStatus = status === 'blocked';[\s\S]*if \(isBlockedStatus === true\)[\s\S]*function resolveFoundationAction\(messages: WorkspaceChatMessage\[\]\): FoundationAction[\s\S]*statusLabel: getFoundationBlockedStatusLabel\(foundationStatus\)[\s\S]*export type FoundationDecisionDraft = \{[\s\S]*bucket: FoundationDecisionBucket;[\s\S]*function decisionBucketToDraftBucket\(bucket\?: string\): FoundationDecisionBucket/,
  'prompt actions should expose explicit Foundation action and decision bucket contracts instead of inferring them from helper implementations',
);
assert.doesNotMatch(
  promptActionsSource,
  /ReturnType<typeof resolveFoundationAction>/,
  'prompt actions should not infer FoundationAction from resolveFoundationAction',
);
assert.doesNotMatch(
  promptActionsSource,
  /bucket: 'must_decide_now' \| 'reserve_extension_now' \| 'defer_with_record';/,
  'prompt actions should not regress Foundation decision bucket to an inline union',
);
assert.match(
  promptActionsSource,
  /import type \{[\s\S]*WorkspaceFoundationDecisionConfirmation,[\s\S]*WorkspacePromptActionsContract,[\s\S]*\} from '\.\/workspace-prompt-actions-contract';[\s\S]*\}: UseWorkspacePromptActionsOptions\): WorkspacePromptActionsContract \{[\s\S]*decisions: WorkspaceFoundationDecisionConfirmation\[\],[\s\S]*return \{[\s\S]*submitPrompt,[\s\S]*handleGenerate,[\s\S]*handleSuggestedQuestion,[\s\S]*handleSuggestedAction,[\s\S]*handleStartFoundation,[\s\S]*handleConfirmFoundationDecisions,[\s\S]*foundationActionLabel: foundationAction\.label,[\s\S]*foundationStatusLabel: foundationAction\.statusLabel,/,
  'prompt actions hook should return the explicit prompt actions contract',
);
assert.match(
  promptActionsSource,
  /export type FoundationDecisionDraftList = FoundationDecisionDraft\[\];[\s\S]*export type FoundationDecisionDraftGroup = \{[\s\S]*title: string;[\s\S]*bucket: FoundationDecisionBucket;[\s\S]*\};[\s\S]*export type FoundationDecisionDraftGroupList = FoundationDecisionDraftGroup\[\];[\s\S]*function buildFoundationDecisionPrompt\(drafts: FoundationDecisionDraftList\)[\s\S]*const groupedDrafts: FoundationDecisionDraftGroupList = \[/,
  'Prompt Foundation decision prompt should name draft and group list contracts',
);
assert.match(
  promptActionsSource,
  /function normalizeFoundationDecisionInputValue\(value: string \| undefined\): string[\s\S]*const hasValue = value !== undefined;[\s\S]*if \(hasValue === false\)[\s\S]*function getFoundationDecisionDraftTitle\(decisionTitle: string, decisionId: string\): string[\s\S]*const hasDecisionTitle = decisionTitle\.length > 0;[\s\S]*function getFoundationDecisionDraftSelectedOption\(selectedOption: string\): string[\s\S]*const hasSelectedOption = selectedOption\.length > 0;[\s\S]*function getFoundationDecisionDraftNotes\(notes: string\): string \| undefined[\s\S]*const hasNotes = notes\.length > 0;[\s\S]*function normalizeFoundationDecisionDraft\([\s\S]*decision: WorkspaceFoundationDecisionConfirmation,[\s\S]*\): FoundationDecisionDraft \| null \{[\s\S]*const decisionId = typeof decision\.id === 'string' \? decision\.id\.trim\(\) : '';[\s\S]*const hasDecisionId = decisionId\.length > 0;[\s\S]*if \(hasDecisionId === false\) return null;[\s\S]*const decisionTitle = normalizeFoundationDecisionInputValue\(decision\.title\);[\s\S]*const selectedOption = normalizeFoundationDecisionInputValue\(decision\.selectedOption\);[\s\S]*const notes = normalizeFoundationDecisionInputValue\(decision\.notes\);[\s\S]*title: getFoundationDecisionDraftTitle\(decisionTitle, decisionId\),[\s\S]*selectedOption: getFoundationDecisionDraftSelectedOption\(selectedOption\),[\s\S]*notes: getFoundationDecisionDraftNotes\(notes\),/,
  'Prompt Foundation decision drafts should normalize id, title, selected option and notes through explicit facts',
);
assert.match(
  promptActionsSource,
  /function hasFoundationDecisionPromptNotes\(notes: string \| undefined\): notes is string[\s\S]*if \(notes === undefined\)[\s\S]*const hasNotes = notes\.length > 0;[\s\S]*return hasNotes === true;[\s\S]*function shouldRenderFoundationDecisionPromptGroup\(items: FoundationDecisionDraftList\): boolean[\s\S]*const hasItems = items\.length > 0;[\s\S]*function getFoundationDecisionPromptGroupItems\([\s\S]*drafts: FoundationDecisionDraftList,[\s\S]*bucket: FoundationDecisionBucket,[\s\S]*\): FoundationDecisionDraftList \{[\s\S]*for \(const draft of drafts\)[\s\S]*const hasTargetBucket = draft\.bucket === bucket;[\s\S]*if \(hasTargetBucket === true\)[\s\S]*function getFoundationDecisionPromptLine\(draft: FoundationDecisionDraft\): string[\s\S]*const notes = draft\.notes;[\s\S]*const hasNotes = hasFoundationDecisionPromptNotes\(notes\);[\s\S]*for \(const group of groupedDrafts\)[\s\S]*const items = getFoundationDecisionPromptGroupItems\(drafts, group\.bucket\);[\s\S]*const shouldRenderGroup = shouldRenderFoundationDecisionPromptGroup\(items\);[\s\S]*if \(shouldRenderGroup === false\)[\s\S]*continue;[\s\S]*for \(const draft of items\)[\s\S]*sections\.push\(getFoundationDecisionPromptLine\(draft\)\);/,
  'Prompt Foundation decision prompt should derive group rendering and note lines through named display facts',
);
assert.doesNotMatch(
  promptActionsSource,
  /buildFoundationDecisionPrompt\(drafts: FoundationDecisionDraft\[\]\)|groupedDrafts: Array<\{[\s\S]*bucket: FoundationDecisionBucket;[\s\S]*\}>|notes !== undefined && notes\.length > 0|draft\.notes \? `；备注：\$\{draft\.notes\}` : ''/,
  'Prompt Foundation decision prompt should not regress draft or group lists to anonymous arrays',
);
assert.match(
  promptActionsSource,
  /applyPromptInteractionMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*applyPromptInteractionMessages,[\s\S]*applyPromptInteractionMessages\(nextMessages\);[\s\S]*applyPromptInteractionMessages\(nextMessages\);[\s\S]*plan-clarify-[\s\S]*applyPromptInteractionMessages\(nextMessages\);[\s\S]*applyPromptInteractionMessages\(\(prev\) => \[\.\.\.prev, userMessage\]\);[\s\S]*capability-audit-url-sync-failed-[\s\S]*user-gate-retry-[\s\S]*user-foundation-[\s\S]*user-foundation-confirm-/,
  'prompt actions should route user input, plan clarification, capability audit failure, gate retry and foundation messages through prompt interaction action',
);
assert.match(
  promptActionsSource,
  /(?=[\s\S]*function hasWorkspacePromptBusyGeneration\(\{[\s\S]*isGenerating: boolean;[\s\S]*isPlanning: boolean;[\s\S]*if \(isGenerating === true\)[\s\S]*return isPlanning === true;)(?=[\s\S]*function shouldBlockWorkspacePromptSubmit\(\{[\s\S]*hasPrompt: boolean;[\s\S]*hasBusyGeneration: boolean;[\s\S]*if \(hasPrompt === false\)[\s\S]*return hasBusyGeneration === true;)(?=[\s\S]*function hasWorkspacePromptProjectPlanId\(projectInfo: WorkspaceProjectInfo \| null\): boolean[\s\S]*projectInfo === null[\s\S]*projectInfo\.planId === undefined[\s\S]*return projectInfo\.planId !== null;)(?=[\s\S]*function hasWorkspacePromptProjectPlanData\(projectInfo: WorkspaceProjectInfo \| null\): boolean[\s\S]*projectInfo === null[\s\S]*projectInfo\.planData === undefined[\s\S]*return projectInfo\.planData !== null;)(?=[\s\S]*function isWorkspacePromptPlanSelectionPending\(\{[\s\S]*hasAvailablePlans: boolean;[\s\S]*hasSelectedPlan: boolean;[\s\S]*return hasSelectedPlan === false;)(?=[\s\S]*function needsWorkspacePromptPlanBeforeImplementation\(\{[\s\S]*foundationCompleted: boolean;[\s\S]*isPlanSelectionPending: boolean;[\s\S]*hasProjectPlanId: boolean;[\s\S]*hasProjectPlanData: boolean;[\s\S]*hasSelectedPlan: boolean;[\s\S]*return hasSelectedPlan === false;)(?=[\s\S]*function hasWorkspacePromptReferencedPlanForContext\(plan: Plan \| null \| undefined\): plan is Plan)(?=[\s\S]*const prompt = rawPrompt\.trim\(\);[\s\S]*const hasPrompt = prompt\.length > 0;[\s\S]*const hasBusyGeneration = hasWorkspacePromptBusyGeneration\(\{[\s\S]*isGenerating,[\s\S]*isPlanning,[\s\S]*\}\);[\s\S]*const shouldBlockSubmit = shouldBlockWorkspacePromptSubmit\(\{[\s\S]*hasPrompt,[\s\S]*hasBusyGeneration,[\s\S]*\}\);[\s\S]*if \(shouldBlockSubmit === true\) return;)(?=[\s\S]*const needsFoundationFirst = foundationCompleted === false;[\s\S]*const hasAvailablePlans = availablePlans\.length > 0;[\s\S]*const hasSelectedPlan = selectedPlanId !== null;[\s\S]*const hasProjectPlanId = hasWorkspacePromptProjectPlanId\(projectInfo\);[\s\S]*const hasProjectPlanData = hasWorkspacePromptProjectPlanData\(projectInfo\);[\s\S]*const isPlanSelectionPending = isWorkspacePromptPlanSelectionPending\(\{[\s\S]*hasAvailablePlans,[\s\S]*hasSelectedPlan,[\s\S]*\}\);[\s\S]*const needsPlanBeforeImplementation = needsWorkspacePromptPlanBeforeImplementation\(\{[\s\S]*foundationCompleted,[\s\S]*isPlanSelectionPending,[\s\S]*hasProjectPlanId,[\s\S]*hasProjectPlanData,[\s\S]*hasSelectedPlan,[\s\S]*\}\);)(?=[\s\S]*if \(needsFoundationFirst === true\))(?=[\s\S]*if \(isPlanSelectionPending === true\))(?=[\s\S]*const hasReferencedPlanForContext = hasWorkspacePromptReferencedPlanForContext\(referencedPlanForContext\);[\s\S]*if \(hasReferencedPlanForContext === true\))(?=[\s\S]*if \(needsPlanBeforeImplementation === true\))(?=[\s\S]*const recommendedPlan = getWorkspaceRecommendedPlan\(availablePlans, recommendedPlanId\);[\s\S]*if \(recommendedPlan === undefined\) return;)/,
  'prompt actions should derive prompt, plan selection and recommended-plan fallback gates through explicit facts',
);
assert.match(
  promptActionsSource,
  /(?=[\s\S]*function getWorkspaceFoundationStatus\(foundationState: WorkspaceBootstrapState \| undefined\): string \| undefined)(?=[\s\S]*function getGuidanceActionPrompt\(action: GuidanceAction\): string[\s\S]*return normalizeFoundationDecisionInputValue\(action\.prompt\);)(?=[\s\S]*function getRecoveryStageLabel\(action: GuidanceAction\): string[\s\S]*const stage = action\.conversationStage;[\s\S]*const hasStage = stage !== undefined;)(?=[\s\S]*function getRecoveryInitialReasoningContent\(recoveryStageLabel: string\): string[\s\S]*const hasRecoveryStageLabel = recoveryStageLabel\.length > 0;)(?=[\s\S]*function getFoundationStartPrompt\(input: string, action: FoundationAction\): string[\s\S]*const hasPrompt = prompt\.length > 0;)(?=[\s\S]*function shouldUseSendPromptAction\(action: GuidanceAction\): boolean[\s\S]*const isSendPromptAction = action\.kind === 'send_prompt';[\s\S]*if \(isSendPromptAction === false\)[\s\S]*return hasPrompt === true;)(?=[\s\S]*function isWorkspacePromptRepairNavigationAction\(action: GuidanceAction\): boolean[\s\S]*action\.kind === 'open_validation_failure'[\s\S]*action\.kind === 'open_context_repair';)(?=[\s\S]*function getWorkspacePromptNavigationTarget\([\s\S]*action: GuidanceAction,[\s\S]*\): WorkspaceEditorNavigationTarget \| undefined[\s\S]*return action\.navigationTarget;)(?=[\s\S]*function canOpenWorkspacePromptRepairNavigation\(action: GuidanceAction\): boolean[\s\S]*const isRepairNavigationAction = isWorkspacePromptRepairNavigationAction\(action\);[\s\S]*return navigationTarget !== undefined;)(?=[\s\S]*function isWorkspacePromptRetryGateAction\(action: GuidanceAction\): boolean[\s\S]*action\.kind === 'retry_context_gate'[\s\S]*action\.kind === 'retry_workflow_gate';)(?=[\s\S]*function canRunWorkspacePromptRetryGateAction\(\{[\s\S]*isRetryGateAction: boolean;[\s\S]*hasActionPrompt: boolean;[\s\S]*return hasActionPrompt === true;)(?=[\s\S]*const canOpenRepairNavigation = canOpenWorkspacePromptRepairNavigation\(action\);[\s\S]*if \(canOpenRepairNavigation === true\)[\s\S]*const navigationTarget = getWorkspacePromptNavigationTarget\(action\);)(?=[\s\S]*const isRetryGateAction = isWorkspacePromptRetryGateAction\(action\);[\s\S]*const actionPrompt = getGuidanceActionPrompt\(action\);[\s\S]*const hasActionPrompt = actionPrompt\.length > 0;[\s\S]*const canRunRetryGateAction = canRunWorkspacePromptRetryGateAction\(\{[\s\S]*isRetryGateAction,[\s\S]*hasActionPrompt,[\s\S]*\}\);[\s\S]*if \(canRunRetryGateAction === true\)[\s\S]*const hasBusyGeneration = hasWorkspacePromptBusyGeneration\(\{[\s\S]*isGenerating,[\s\S]*isPlanning,[\s\S]*\}\);[\s\S]*if \(hasBusyGeneration === true\) return;)(?=[\s\S]*const recoveryStageLabel = getRecoveryStageLabel\(action\);[\s\S]*initialReasoningContent: getRecoveryInitialReasoningContent\(recoveryStageLabel\),)(?=[\s\S]*const shouldSendPrompt = shouldUseSendPromptAction\(action\);[\s\S]*if \(shouldSendPrompt === true\))(?=[\s\S]*const prompt = getFoundationStartPrompt\(input, nextAction\);)(?=[\s\S]*const foundationStatus = getWorkspaceFoundationStatus\(foundationState\);)/,
  'prompt actions should execute retry gate actions through explicit kind, prompt, busy and stage-label facts',
);
assert.match(
  promptActionsSource,
  /function getFoundationDecisionDrafts\([\s\S]*decisions: WorkspaceFoundationDecisionConfirmation\[\],[\s\S]*\): FoundationDecisionDraftList \{[\s\S]*const drafts: FoundationDecisionDraftList = \[\];[\s\S]*for \(const decision of decisions\)[\s\S]*const draft = normalizeFoundationDecisionDraft\(decision\);[\s\S]*if \(draft !== null\)[\s\S]*drafts\.push\(draft\);[\s\S]*const drafts = getFoundationDecisionDrafts\(decisions\);[\s\S]*const hasDrafts = drafts\.length > 0;[\s\S]*if \(hasDrafts === false\) return;/,
  'prompt actions should build Foundation decision drafts through the named normalizer and explicit empty-list gate',
);
assert.doesNotMatch(
  promptActionsSource,
  /!rawPrompt\.trim\(\)|availablePlans\.length > 0 && !selectedPlanId|&& !isPlanSelectionPending|&& !projectInfo\?\.planId|&& !projectInfo\?\.planData|&& !selectedPlanId|if \(needsFoundationFirst\)|if \(isPlanSelectionPending\)|if \(needsPlanBeforeImplementation\)|referencedPlanForContext && referencedPlanForContext !== undefined|availablePlans\.find\(\(plan\) => plan\.id === recommendedPlanId\) \|\| availablePlans\[0\]|const fallbackRecommendedPlan = availablePlans\[0\]|const recommendedPlan = matchedRecommendedPlan \?\? fallbackRecommendedPlan|if \(!recommendedPlan\)|foundationStatus === 'blocked' \? '已阻断' : '待确认'|foundationState\?\.status|action\.conversationStage \|\| '当前'|action\.conversationStage \?\? ''|action\.prompt\?\.trim\(\) \?\? ''|decision\.title\?\.trim\(\) \?\? ''|decision\.selectedOption\?\.trim\(\) \?\? ''|decision\.notes\?\.trim\(\) \?\? ''|decision\.title\?\.trim\(\) \|\| decision\.id|decision\.selectedOption\?\.trim\(\) \|\| '按工作台当前建议确认'|decision\.id!|input\.trim\(\) \|\| nextAction\.prompt|drafts\.filter\(|decisions[\s\S]*\.map\(\(decision\) => normalizeFoundationDecisionDraft\(decision\)\)[\s\S]*\.filter\(|action\.kind === 'send_prompt' && action\.prompt|if \(\(action\.kind === 'retry_context_gate' \|\| action\.kind === 'retry_workflow_gate'\) && action\.prompt\)|if \(!prompt\)|isGenerating === true \|\| isPlanning === true|hasPrompt === false \|\| hasBusyGeneration === true|projectInfo\?\.planId !== undefined && projectInfo\.planId !== null|projectInfo\?\.planData !== undefined && projectInfo\.planData !== null|hasAvailablePlans === true && hasSelectedPlan === false|foundationCompleted === true[\s\S]*isPlanSelectionPending === false[\s\S]*hasProjectPlanId === false[\s\S]*hasProjectPlanData === false[\s\S]*hasSelectedPlan === false|\(action\.kind === 'open_validation_failure' \|\| action\.kind === 'open_context_repair'\) && action\.navigationTarget|isRetryContextGate === true \|\| isRetryWorkflowGate === true|isRetryGateAction === true && hasActionPrompt === true/,
  'prompt actions should not regress to implicit prompt, plan selection, retry action or Foundation decision fallback gates',
);
assert.doesNotMatch(
  promptActionsSource,
  /setMessages/,
  'prompt actions should not write messages through the external setMessages compatibility wrapper',
);
assert.match(
  workspacePageEffectsContractSource,
  /export type WorkspacePageEffectsContract = \{[\s\S]*handleStopGenerate: \(\) => void;[\s\S]*handleCancelStopGenerate: \(\) => void;[\s\S]*\};/,
  'page effects should expose an explicit contract for stop-generation side-effect actions',
);
assert.match(
  pageEffectsSource,
  /import type \{ WorkspacePageEffectsContract \} from '\.\/workspace-page-effects-contract';[\s\S]*\}: UseWorkspacePageEffectsOptions\): WorkspacePageEffectsContract \{[\s\S]*const handleCancelStopGenerate = useCallback\(\(\) => \{[\s\S]*setIsStopConfirming\(false\)[\s\S]*const handleStopGenerate = useCallback[\s\S]*setIsStopConfirming\(false\)[\s\S]*return \{[\s\S]*handleCancelStopGenerate,[\s\S]*handleStopGenerate,/,
  'page effects hook should return the explicit page effects contract',
);
assert.match(
  pageEffectsSource,
  /applyPageEffectMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*projectApi\.replayGenerationEvents\([\s\S]*projectApi\.getGenerationStatus\(effectiveProject\.projectId\)[\s\S]*appendGenerationStatePersistenceFailureMessage\(applyPageEffectMessages, persistGenerationState\(null\)\)[\s\S]*reason: 'refresh'[\s\S]*reason: 'manual'[\s\S]*stop-generation-failed-\$\{persistedProject\.projectId\}-\$\{Date\.now\(\)\}/,
  'page effects should recover durable generation state and route local persistence or stop failures through the page effect action',
);
assert.match(
  pageEffectsSource,
  /function hasWorkspacePageEffectProjectIdValue\(value: string \| null \| undefined\): value is string \{[\s\S]*function getWorkspacePageEffectProject\(projectInfo: WorkspaceProjectInfo \| null\): WorkspaceProjectInfo \| null \{[\s\S]*function getWorkspacePageEffectPersistedProject\(projectInfo: WorkspaceProjectInfo \| null\): WorkspaceProjectInfo \| null \{[\s\S]*function hasWorkspacePageEffectActiveGeneration\(isGenerating: boolean, isPlanning: boolean\): boolean \{[\s\S]*function hasWorkspacePageEffectRawGenerationState\(rawState: string \| null\): rawState is string[\s\S]*function isPersistedGenerationStateRawObject\(value: unknown\): value is PersistedGenerationStateRawObject \{[\s\S]*function hasPersistedGenerationStateRequiredShape\([\s\S]*projectApi\.getGenerationStatus\(effectiveProject\.projectId\)[\s\S]*const shouldReplayGenerationJob = generationJob !== null[\s\S]*shouldReplayWorkspaceGenerationJob\(\{[\s\S]*startGenerationEventReplay\(generationJob\.id, generationJob\.idempotency_key\)[\s\S]*const persistedProject = getWorkspacePageEffectPersistedProject\(projectInfo\);[\s\S]*projectApi\.stopGeneration\(persistedProject\.projectId\)/,
  'page effects should derive project, local state shape, durable Job replay and stop-generation gates through explicit facts',
);
assert.doesNotMatch(
  pageEffectsSource,
  /if \(!projectInfo\?\.projectId\) return;|if \(!isGenerating \|\| !projectInfo\?\.projectId\) return;|if \(!isGenerating && !isPlanning\) return;|const hasActiveGeneration = isGenerating === true \|\| isPlanning === true;|if \(projectInfo\?\.projectId\)|if \(projectInfo\?\.isPersisted && projectInfo\.projectId\)|prev\.some\(\(message\) => message\.id === '(?:generation-state-read-failed-notice|generation-state-restore-failed-notice|generation-interrupted-notice)'\)|if \(!rawState\)|if \(!generationStateReadResult\.ok\)|if \(!parseResult\.ok\)|if \(!isStopConfirming\)|if \(!isPersistedGenerationStateRawObject\(parsed\)[\s\S]*\|\|[\s\S]*typeof parsed\.startedAt !== 'string'\)/,
  'page effects should not regress to optional project id, truthy generation, truthy persisted project or inline restore notice gates',
);
assert.doesNotMatch(
  pageEffectsSource,
  /setMessages/,
  'page effects should not write messages through the external setMessages compatibility wrapper',
);
assert.match(
  pageFoundationSource,
  /import type \{ WorkspacePageFoundationContract \} from '\.\/workspace-page-foundation-contract';[\s\S]*\}: UseWorkspacePageFoundationOptions\): WorkspacePageFoundationContract \{[\s\S]*const localState = useWorkspacePageLocalState\(\);[\s\S]*const flowState = useWorkspaceFlowState\([\s\S]*const shellState = useWorkspaceShellState\([\s\S]*const runtimeResources = useWorkspaceRuntimeResources\([\s\S]*const \{ isRestoringWorkspace, messageRestoreStatus \} = useWorkspaceProjectBootstrap\([\s\S]*return \{[\s\S]*localState,[\s\S]*flowState,[\s\S]*shellState,[\s\S]*runtimeResources,[\s\S]*isRestoringWorkspace,[\s\S]*messageRestoreStatus,/,
  'workspace page foundation hook should return the explicit foundation contract',
);
assert.match(
  pageFoundationSource,
  /useWorkspaceRuntimeResources\(\{[\s\S]*setGenerationStage: localState\.setGenerationStage,[\s\S]*applyRuntimeResourceMessages: flowState\.applyRuntimeResourceMessages,[\s\S]*gitBranches: localState\.gitBranches,/,
  'workspace foundation should pass runtime resource message action to runtime resources',
);
assert.match(
  workspaceMessageActionsHookSource,
  /const applyRuntimeResourceMessages = useCallback\(\(value: SetStateAction<WorkspaceChatMessage\[\]>\) => \{[\s\S]*void value;[\s\S]*\}, \[\]\);/,
  'runtime resource messages should be explicitly suppressed from the chat flow because Preview/Explorer/Git panels own those system states',
);
assert.doesNotMatch(
  runtimeResourcesSource,
  /prev\.findIndex\(\(message\) => message\.id === messageId\)|prev\.slice\(0, existingIndex\)|prev\.slice\(existingIndex \+ 1\)/,
  'runtime resources should not regress runtime readiness message upsert to inline findIndex/slice materialization',
);
assert.match(
  runtimeResourcesSource,
  /preview-url-build-failed-\$\{projectId\}-\$\{now\}[\s\S]*runtime-status-snapshot-failed-\$\{projectId\}-\$\{now\}[\s\S]*project-detail-file-tree-parse-failed-\$\{projectId\}-\$\{now\}[\s\S]*project-detail-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*file-tree-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*git-commits-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*git-tags-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*git-remotes-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*git-remote-branches-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*git-stashes-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*git-worktree-status-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*git-branches-refresh-failed-\$\{projectId\}-\$\{now\}[\s\S]*workspace-bootstrap-failed-\$\{currentProjectId\}-\$\{now\}/,
  'runtime resources should keep runtime, preview, project detail, file tree, Git and bootstrap notices in the runtime resource action scope',
);
assert.doesNotMatch(
  runtimeResourcesSource,
  /setMessages/,
  'runtime resources should not write notices through the external setMessages compatibility wrapper',
);
assert.match(
  pageFoundationSource,
  /useWorkspaceProjectBootstrap\(\{[\s\S]*readWorkspaceSessionSnapshot: flowState\.readWorkspaceSessionSnapshot,[\s\S]*applyWorkspaceState: flowState\.applyWorkspaceState,[\s\S]*applyProjectBootstrapMessages: flowState\.applyProjectBootstrapMessages,[\s\S]*resetWorkspaceRuntimeBootstrapState: runtimeResources\.resetWorkspaceRuntimeBootstrapState,/,
  'workspace foundation should pass project bootstrap message action to project bootstrap',
);
assert.match(
  workspaceProjectBootstrapContractSource,
  /import type \{ WorkspaceProjectBootstrapMessageRestoreStatus \} from '\.\/workspace-types';[\s\S]*export type WorkspaceProjectBootstrapContract = \{[\s\S]*isRestoringWorkspace: boolean;[\s\S]*messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;[\s\S]*\};/,
  'project bootstrap should expose an explicit contract for workspace restoration state',
);
assert.match(
  projectBootstrapSource,
  /(?=[\s\S]*import type \{ WorkspaceProjectBootstrapContract \} from '\.\/workspace-project-bootstrap-contract';)(?=[\s\S]*WorkspaceProjectBootstrapMessageRestoreStatus,)(?=[\s\S]*\}: UseWorkspaceProjectBootstrapOptions\): WorkspaceProjectBootstrapContract \{)(?=[\s\S]*const \[isRestoringWorkspace, setIsRestoringWorkspace\] = useState\(false\);)(?=[\s\S]*const \[messageRestoreStatus, setMessageRestoreStatus\] = useState<WorkspaceProjectBootstrapMessageRestoreStatus>\('not_started'\);)(?=[\s\S]*setMessageRestoreStatus\('not_started'\);)(?=[\s\S]*setMessageRestoreStatus\('restoring'\);)(?=[\s\S]*setMessageRestoreStatus\('session_snapshot_restored'\);)(?=[\s\S]*setMessageRestoreStatus\('empty_history_no_session'\);)(?=[\s\S]*setMessageRestoreStatus\('backend_history_restored'\);)(?=[\s\S]*setMessageRestoreStatus\('restore_failed_session_snapshot'\);)(?=[\s\S]*setMessageRestoreStatus\('restore_failed_no_snapshot'\);)(?=[\s\S]*return \{[\s\S]*isRestoringWorkspace,[\s\S]*messageRestoreStatus,)/,
  'project bootstrap hook should return the explicit project bootstrap contract',
);
assert.match(
  projectBootstrapSource,
  /applyProjectBootstrapMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*export function useWorkspaceProjectBootstrap\(\{[\s\S]*applyProjectBootstrapMessages,[\s\S]*project-restore-failed-\$\{projectId\}-\$\{now\}[\s\S]*workspace-messages-restore-failed-\$\{projectId\}-\$\{now\}[\s\S]*project-payload-parse-failed-\$\{source\}-\$\{now\}[\s\S]*initial-preview-url-build-failed-\$\{projectId\}[\s\S]*local-workspace-project-snapshot-\$\{failure\.operation\}-failed[\s\S]*pending-workspace-navigation-\$\{failure\.operation\}-failed[\s\S]*workspace-transient-url-cleanup-failed-\$\{projectId\}[\s\S]*project-bootstrap-file-tree-parse-failed-\$\{projectId\}-\$\{now\}[\s\S]*home-project-snapshot-save-failed-\$\{projectId\}[\s\S]*project-list-snapshot-save-failed-\$\{projectId\}/,
  'project bootstrap should route restore, local snapshot, pending navigation, preview and transient URL notices through the project bootstrap action',
);
assert.doesNotMatch(
  projectBootstrapSource,
  /setMessages/,
  'project bootstrap should not write notices through the external setMessages compatibility wrapper',
);
assert.match(
  pageViewControllersSource,
  /useWorkspacePageViewUi\(\{[\s\S]*handleGenerate: actions\.handleGenerate,[\s\S]*applyPageUiMessages: flowState\.applyPageUiMessages,/,
  'page view controllers should pass the page UI message action to page UI state',
);
assert.match(
  pageViewControllersSource,
  /import type \{ WorkspacePageActionControllersContract \} from '\.\/workspace-page-action-controllers-contract';[\s\S]*import type \{ WorkspacePageViewContentShellState \} from '\.\/workspace-page-view-content-options';[\s\S]*import type \{ WorkspacePageViewControllersContract \} from '\.\/workspace-page-view-controllers-contract';[\s\S]*export type WorkspacePageViewControllersShellState =[\s\S]*WorkspacePageViewContentShellState[\s\S]*& \{[\s\S]*chatExpanded: boolean;[\s\S]*\};[\s\S]*shellState: WorkspacePageViewControllersShellState;[\s\S]*actions: WorkspacePageActionControllersContract;[\s\S]*\}: UseWorkspacePageViewControllersOptions\): WorkspacePageViewControllersContract \{[\s\S]*const uiState = useWorkspacePageViewUi\([\s\S]*const \{[\s\S]*desktopChatPanel,[\s\S]*mobileChatPanel,[\s\S]*desktopIdePanel,[\s\S]*mobileIdePanel,[\s\S]*savePendingCloseFile,[\s\S]*\} = useWorkspacePageViewContent\([\s\S]*return \{[\s\S]*desktopChatPanel,[\s\S]*mobileChatPanel,[\s\S]*desktopIdePanel,[\s\S]*mobileIdePanel,[\s\S]*savePendingCloseFile,[\s\S]*quoteToChat: uiState\.quoteToChat,[\s\S]*clearChat: uiState\.clearChat,[\s\S]*copyToClipboard: uiState\.copyToClipboard,[\s\S]*exportProject: uiState\.exportProject,/,
  'page view controllers hook should consume named shell/action contracts and return the explicit view controllers contract',
);
assert.doesNotMatch(
  pageViewControllersSource,
  /type ShellState = Pick<|Pick<WorkspaceShellStateContract/,
  'page view controllers shell input should not regress to a Pick-derived shell state slice',
);
assert.match(
  pageControllersSource,
  /import type \{ WorkspacePageControllersContract \} from '\.\/workspace-page-controllers-contract';[\s\S]*\}: UseWorkspacePageControllersOptions\): WorkspacePageControllersContract \{[\s\S]*const actions = useWorkspacePageActionControllers\([\s\S]*\} = useWorkspacePageViewControllers\([\s\S]*return \{[\s\S]*desktopChatPanel,[\s\S]*mobileChatPanel,[\s\S]*desktopIdePanel,[\s\S]*mobileIdePanel,[\s\S]*savePendingCloseFile,[\s\S]*quoteToChat,[\s\S]*clearChat,[\s\S]*copyToClipboard,[\s\S]*downloadFile: actions\.downloadFile,[\s\S]*closeWorkspaceFile: actions\.closeWorkspaceFile,[\s\S]*isFileDirty: actions\.isFileDirty,[\s\S]*handleExplorerContextOperation: actions\.handleExplorerContextOperation,[\s\S]*confirmRestoreCommit: actions\.confirmRestoreCommit,/,
  'page controllers hook should return the explicit page controllers contract derived from view and action controllers',
);
assert.match(
  pageControllersSource,
  /import type \{[\s\S]*WorkspacePageActionControllersRuntimeResources,[\s\S]*WorkspacePageActionControllersShellState,[\s\S]*\} from '\.\/use-workspace-page-action-controllers';[\s\S]*import type \{ WorkspacePageViewControllersShellState \} from '\.\/use-workspace-page-view-controllers';[\s\S]*export type WorkspacePageControllersShellState =[\s\S]*WorkspacePageViewControllersShellState[\s\S]*& WorkspacePageActionControllersShellState;[\s\S]*export type WorkspacePageControllersRuntimeResources = WorkspacePageActionControllersRuntimeResources;[\s\S]*shellState: WorkspacePageControllersShellState;[\s\S]*runtimeResources: WorkspacePageControllersRuntimeResources;/,
  'page controllers should expose named shell and runtime input contracts',
);
assert.doesNotMatch(
  pageControllersSource,
  /type (ShellState|RuntimeResources) = Pick<|Pick<Workspace(ShellState|RuntimeResources)Contract/,
  'page controllers inputs should not regress to Pick-derived shell or runtime slices',
);
assert.match(
  pageCompositionSource,
  /import type \{ WorkspacePageCompositionContract \} from '\.\/workspace-page-composition-contract';[\s\S]*\}: UseWorkspacePageCompositionOptions\): WorkspacePageCompositionContract \{[\s\S]*messageRestoreStatus,[\s\S]*\} = useWorkspacePageFoundation\([\s\S]*const controllers = useWorkspacePageControllers\([\s\S]*return \{[\s\S]*\.\.\.localState,[\s\S]*\.\.\.shellState,[\s\S]*\.\.\.controllers,[\s\S]*isRestoringWorkspace,[\s\S]*messageRestoreStatus,/,
  'page composition hook should return the explicit composition contract derived from foundation and controllers',
);
assert.match(
  pageShellSource,
  /import type \{ WorkspacePageShellContract \} from '\.\/workspace-page-shell-contract';[\s\S]*\}: UseWorkspacePageShellOptions\): WorkspacePageShellContract \{[\s\S]*const \[hasMounted, setHasMounted\] = useState\(false\);[\s\S]*const goBack = useCallback\([\s\S]*const replaceHome = useCallback\([\s\S]*const persistGenerationState = useCallback\([\s\S]*return \{[\s\S]*hasMounted,[\s\S]*goBack,[\s\S]*replaceHome,[\s\S]*persistGenerationState,/,
  'page shell hook should return the explicit page shell contract',
);
assert.match(
  `${pageShellSource}\n${projectBootstrapSource}`,
  /(?=[\s\S]*function hasWorkspacePageShellPersistedGenerationState\([\s\S]*state: PersistedGenerationState \| null,[\s\S]*\): state is PersistedGenerationState[\s\S]*return state !== null;)(?=[\s\S]*if \(hasWorkspacePageShellPersistedGenerationState\(state\) === false\)[\s\S]*sessionStorage\.removeItem\('yistack_generation_state'\);)(?=[\s\S]*function isWorkspaceProjectBootstrapEffectActive\(cancelled: boolean\): boolean[\s\S]*return cancelled === false;)(?=[\s\S]*if \(isWorkspaceProjectBootstrapEffectActive\(cancelled\) === false\) return;)(?=[\s\S]*if \(isWorkspaceProjectBootstrapEffectActive\(cancelled\) === true\)[\s\S]*setIsRestoringWorkspace\(false\);)/,
  'page shell persistence and project bootstrap restore effects should derive nullable state and cancelled gates through explicit facts',
);
assert.doesNotMatch(
  `${pageShellSource}\n${projectBootstrapSource}`,
  /if \(!state\)|if \(!cancelled\)|if \(cancelled\) return;/,
  'page shell and project bootstrap restore should not regress to implicit state or cancelled gates',
);
assert.match(
  pageContainerSource,
  /import type \{ WorkspacePageContainerContract \} from '\.\/workspace-page-container-contract';[\s\S]*\}: UseWorkspacePageContainerOptions\): WorkspacePageContainerContract \{[\s\S]*const searchParams = useSearchParams\(\);[\s\S]*const \{ isAuthenticated, isLoading: authLoading \} = useAuth\(\);[\s\S]*const projectIdParam = searchParams\.get\('projectId'\);[\s\S]*const projectParam = searchParams\.get\('project'\);[\s\S]*\} = useWorkspacePageShell\([\s\S]*const composition = useWorkspacePageComposition\([\s\S]*return \{[\s\S]*authLoading,[\s\S]*isAuthenticated,[\s\S]*hasMounted,[\s\S]*projectIdParam,[\s\S]*projectParam,[\s\S]*goBack,[\s\S]*\.\.\.composition,/,
  'page container hook should return the explicit page container contract',
);
assert.match(
  pageViewUiSource,
  /import type \{ WorkspacePageUiContract \} from '\.\/workspace-page-ui-contract';[\s\S]*import type \{ WorkspaceShellStateSetter \} from '\.\/workspace-shell-state-contract';[\s\S]*import type \{ PreviewUrlStatus, WorkspaceBrowserDevice, WorkspaceChatMessage \} from '\.\/workspace-types';[\s\S]*export type WorkspacePageViewUiShellState = \{[\s\S]*setChatExpanded: WorkspaceShellStateSetter<boolean>;[\s\S]*browserDevice: WorkspaceBrowserDevice;[\s\S]*setPreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus \| null>;[\s\S]*setMobilePreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus \| null>;[\s\S]*\};[\s\S]*shellState: WorkspacePageViewUiShellState;[\s\S]*applyPageUiMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*export function useWorkspacePageViewUi\(\{[\s\S]*applyPageUiMessages,[\s\S]*\}: UseWorkspacePageViewUiOptions\): WorkspacePageUiContract \{[\s\S]*useWorkspacePageUi\(\{[\s\S]*applyPageUiMessages,/,
  'page view UI should return the explicit page UI contract and pass the page UI message action through a named shell input contract',
);
assert.doesNotMatch(
  pageViewUiSource,
  /type ShellState = Pick<|Pick<WorkspaceShellStateContract/,
  'page view UI shell input should not regress to a Pick-derived shell state slice',
);
assert.match(
  pageUiSource,
  /import type \{[\s\S]*WorkspacePageUiContract,[\s\S]*WorkspacePageUiModel,[\s\S]*WorkspacePageUiPreviewDeviceStyleMap,[\s\S]*WorkspacePageUiTab,[\s\S]*\} from '\.\/workspace-page-ui-contract';[\s\S]*type AvailableModel = WorkspacePageUiModel;[\s\S]*applyPageUiMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*\}: UseWorkspacePageUiOptions\): WorkspacePageUiContract \{[\s\S]*clipboard-copy-failed-\$\{Date\.now\(\)\}[\s\S]*export-project-notice-\$\{Date\.now\(\)\}[\s\S]*applyPageUiMessages\(\[\]\)[\s\S]*model-list-load-failed-\$\{Date\.now\(\)\}[\s\S]*const tabs = useMemo<WorkspacePageUiTab\[\]>\([\s\S]*const deviceSizes: WorkspacePageUiPreviewDeviceStyleMap = \{/,
  'page UI should return the explicit page UI contract and route clipboard, export, clear-chat and model-list notices through the page UI action',
);
assert.match(
  pageUiSource,
  /function hasWorkspacePageUiSearchQuery\(query: string\): boolean[\s\S]*const hasQuery = query\.length > 0;[\s\S]*function hasWorkspacePageUiFileNodeChildren\(children: FileNode\[\] \| undefined\): children is FileNode\[\][\s\S]*function hasWorkspacePageUiTextarea\(textarea: HTMLTextAreaElement \| null\): textarea is HTMLTextAreaElement[\s\S]*function getWorkspacePageUiProviderList\([\s\S]*providers: LLMProvider\[\] \| null \| undefined,[\s\S]*\): LLMProvider\[\][\s\S]*function getWorkspacePageUiDefaultModelName\(defaultName: string \| null \| undefined\): string \| null[\s\S]*function hasWorkspacePageUiDefaultModelName\(defaultName: string \| null\): defaultName is string[\s\S]*function getWorkspacePageUiSelectedModelSnapshotValue\(selectedModel: string\): string[\s\S]*function getWorkspacePageUiProviderDisplayName\(provider: LLMProvider\): string[\s\S]*function getWorkspacePageUiProviderModelDisplayName\(provider: LLMProvider, model: NonNullable<LLMProvider\['models'\]>\[number\]\): string[\s\S]*function getWorkspacePageUiProviderModels\(provider: LLMProvider\): NonNullable<LLMProvider\['models'\]>[\s\S]*function isWorkspacePageUiDefaultProvider\(provider: LLMProvider\): boolean[\s\S]*return provider\.is_default === true;[\s\S]*function hasWorkspacePageUiProvider\(provider: LLMProvider \| undefined\): provider is LLMProvider[\s\S]*function hasWorkspacePageUiModel\(model: AvailableModel \| undefined\): model is AvailableModel[\s\S]*function materializeWorkspacePageUiFilteredTree\(nodes: FileNode\[\], query: string\): FileNode\[\][\s\S]*for \(const node of nodes\)[\s\S]*filteredNodes\.push\(node\);[\s\S]*filteredNodes\.push\(\{ \.\.\.node, children: filteredChildren \}\);[\s\S]*function materializeWorkspacePageUiUploadedFiles\(uploads: FileList\): WorkspacePageUiAttachedFileList[\s\S]*for \(let index = 0; index < uploads\.length; index \+= 1\)[\s\S]*selectedFiles\.push\(\{[\s\S]*function materializeWorkspacePageUiAttachedFiles\([\s\S]*currentFiles: WorkspacePageUiAttachedFileList,[\s\S]*selectedFiles: WorkspacePageUiAttachedFileList,[\s\S]*\): WorkspacePageUiAttachedFileList[\s\S]*for \(const file of currentFiles\)[\s\S]*for \(const file of selectedFiles\)[\s\S]*function getWorkspacePageUiAttachedFileTotalSize\(files: WorkspacePageUiAttachedFileList\): number[\s\S]*totalSize \+= file\.size;[\s\S]*function getWorkspacePageUiLastAttachedFileName\(files: WorkspacePageUiAttachedFileList\): string \| null[\s\S]*function getWorkspacePageUiAttachedFileAt\([\s\S]*targetIndex: number,[\s\S]*\): AttachedFile \| null[\s\S]*function materializeWorkspacePageUiRemainingAttachedFiles\([\s\S]*removedIndex: number,[\s\S]*\): WorkspacePageUiAttachedFileList[\s\S]*function getWorkspacePageUiAttachmentSnapshotFileName\(file: AttachedFile \| null\): string \| null[\s\S]*function materializeWorkspacePageUiModelList\(providers: LLMProvider\[\]\): WorkspacePageUiModelList[\s\S]*for \(const provider of providers\)[\s\S]*const providerModels = getWorkspacePageUiProviderModels\(provider\);[\s\S]*for \(const model of providerModels\)[\s\S]*id: model\.runtime_id,[\s\S]*name: getWorkspacePageUiProviderModelDisplayName\(provider, model\),[\s\S]*function getWorkspacePageUiDefaultProvider\(providers: LLMProvider\[\]\): LLMProvider \| undefined[\s\S]*function getWorkspacePageUiDefaultProviderModelId\(provider: LLMProvider\): string[\s\S]*function getWorkspacePageUiFirstModel\(models: WorkspacePageUiModelList\): AvailableModel \| undefined[\s\S]*function shouldRenderWorkspacePageUiRuntimeTabs\(runtimeEnabled: boolean\): boolean[\s\S]*const shouldRender = runtimeEnabled === true;[\s\S]*return shouldRender === true;[\s\S]*function isWorkspacePageUiRuntimeTab\(activeTab: IDETab\): boolean[\s\S]*const isPreviewTab = activeTab === 'preview';[\s\S]*const isDebugTab = activeTab === 'debug';[\s\S]*const isTerminalTab = activeTab === 'terminal';[\s\S]*return isTerminalTab === true;[\s\S]*function shouldResetWorkspacePageUiRuntimeTab\(activeTab: IDETab, runtimeEnabled: boolean\): boolean[\s\S]*const shouldRenderRuntimeTabs = shouldRenderWorkspacePageUiRuntimeTabs\(runtimeEnabled\);[\s\S]*if \(shouldRenderRuntimeTabs === true\)[\s\S]*const isRuntimeTab = isWorkspacePageUiRuntimeTab\(activeTab\);[\s\S]*return isRuntimeTab === true;[\s\S]*function shouldResetWorkspacePageUiInternalFoundationTab\(activeTab: IDETab\): boolean[\s\S]*const isInternalFoundationTab = activeTab === 'foundation';[\s\S]*return isInternalFoundationTab === true;/,
  'page UI should derive search, textarea, model provider and runtime tab facts through named helpers',
);
assert.doesNotMatch(
  pageUiSource,
  /nodes\.reduce<FileNode\[\]>|Array\.from\(uploads\)\.map|const next = \[\.\.\.attachedFiles, \.\.\.selectedFiles\]|next\.reduce\(\(sum, file\) => sum \+ file\.size|attachedFiles\.filter\(|attachedFiles\[index\] \|\| null|removed\?\.name \|\| null|providers\.map\(|providers\.find\(|modelList\[0\]/,
  'page UI should not regress attachment, model provider or filtered tree materialization to inline array pipelines or OR fallbacks',
);
assert.match(
  pageContentOptionsSource,
  /WorkspaceEngineeringStateSnapshot,[\s\S]*WorkspaceGateResult,[\s\S]*WorkspacePageUiModel,[\s\S]*WorkspacePageUiPreviewDeviceStyle,[\s\S]*WorkspacePageUiTab,[\s\S]*WorkspaceShellStateSetter[\s\S]*export type WorkspacePageViewContentFlowState = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*availablePlans: Plan\[\];[\s\S]*selectedPlanId: string \| null;[\s\S]*planCountdown: number;[\s\S]*planSelectionReady: boolean;[\s\S]*currentEngineeringState: WorkspaceEngineeringStateSnapshot \| undefined;[\s\S]*currentGateResult: WorkspaceGateResult \| undefined;[\s\S]*\};[\s\S]*export type WorkspacePageViewContentShellState = \{[\s\S]*setChatExpanded: WorkspaceShellStateSetter<boolean>;[\s\S]*isChatAutoScrollEnabled: boolean;[\s\S]*chatScrollSnapshot: ChatScrollSnapshot;[\s\S]*browserUrl: string;[\s\S]*previewUrlStatus: PreviewUrlStatus \| null;[\s\S]*browserDevice: WorkspaceBrowserDevice;[\s\S]*browserHistory: WorkspaceBrowserHistoryUrlList;[\s\S]*messagesEndRef: RefObject<HTMLDivElement \| null>;[\s\S]*navigateTo: \(url: string\) => void;[\s\S]*goBrowserBack: \(\) => void;[\s\S]*goForward: \(\) => void;[\s\S]*\};[\s\S]*export type WorkspacePageViewContentUiState = \{[\s\S]*adjustTextareaHeight: \(value\?: string\) => void;[\s\S]*handleKeyDown: \(event: ReactKeyboardEvent<HTMLTextAreaElement>\) => void;[\s\S]*copyToClipboard: \(text: string\) => Promise<void>;[\s\S]*exportProject: \(\) => void;[\s\S]*handleFileUpload: \(event: ChangeEvent<HTMLInputElement>\) => void;[\s\S]*filteredTree: FileNode\[\];[\s\S]*explorerSnapshotStatus: ExplorerSnapshotStatus \| null;[\s\S]*models: WorkspacePageUiModel\[\];[\s\S]*tabs: WorkspacePageUiTab\[\];[\s\S]*previewDeviceStyle: WorkspacePageUiPreviewDeviceStyle;[\s\S]*\};[\s\S]*flowState: WorkspacePageViewContentFlowState;[\s\S]*shellState: WorkspacePageViewContentShellState;[\s\S]*uiState: WorkspacePageViewContentUiState;/,
  'page view content options should expose explicit flow, shell and UI state input contracts without Pick inference',
);
assert.doesNotMatch(
  pageContentOptionsSource,
  /type FlowState = Pick<|type ShellState = Pick<|uiState: Pick</,
  'page view content options should not regress to Pick-derived flow, shell or UI state input slices',
);
assert.match(
  pageContentSource,
  /import type \{ WorkspacePageContentContract \} from '\.\/workspace-page-content-contract';[\s\S]*\}: UseWorkspacePageContentOptions\): WorkspacePageContentContract \{[\s\S]*const desktopChatPanel = buildDesktopChatPanel[\s\S]*const mobileChatPanel = buildMobileChatPanel[\s\S]*const desktopIdePanel = buildDesktopIdePanel[\s\S]*const mobileIdePanel = buildMobileIdePanel[\s\S]*const savePendingCloseFile = useCallback[\s\S]*return \{[\s\S]*desktopChatPanel,[\s\S]*mobileChatPanel,[\s\S]*desktopIdePanel,[\s\S]*mobileIdePanel,[\s\S]*savePendingCloseFile,/,
  'page content hook should return the explicit page content contract',
);
assert.match(
  pageViewContentSource,
  /import type \{ WorkspacePageContentContract \} from '\.\/workspace-page-content-contract';[\s\S]*\}: UseWorkspacePageViewContentOptions\): WorkspacePageContentContract \{[\s\S]*return useWorkspacePageContent\([\s\S]*buildWorkspacePageContentOptions\(\{[\s\S]*localState,[\s\S]*flowState,[\s\S]*shellState,[\s\S]*monacoEditor,[\s\S]*uiState,[\s\S]*actions,/,
  'page view content hook should return the explicit page content contract',
);
assert.match(
  workspaceIdeInteractionsContractSource,
  /import type \{ MouseEvent as ReactMouseEvent \} from 'react';[\s\S]*import type \{ FileNode, FileNodeType \} from '@\/lib\/types';[\s\S]*export type WorkspaceIdeInteractionsContract = \{[\s\S]*expandAncestorFolders: \(path: string\) => void;[\s\S]*reflectFilePathInTree: \(path: string, leafType\?: FileNodeType\) => void;[\s\S]*isFileDirty: \(path: string \| null\) => boolean;[\s\S]*closeWorkspaceFile: \(path: string, discardChanges\?: boolean\) => void;[\s\S]*requestCloseWorkspaceFile: \(path: string\) => void;[\s\S]*applyIncrementalWorkflowStep: \(step: WorkflowStep\) => void;[\s\S]*openWorkspaceFile: \(target: string \| WorkspaceEditorNavigationTarget\) => Promise<void>;[\s\S]*toggleFolder: \(path: string\) => void;[\s\S]*showContextMenu: \(event: ReactMouseEvent, node: FileNode\) => void;[\s\S]*handleExplorerContextOperation: \([\s\S]*operation: WorkspaceExplorerContextOperation,[\s\S]*node: FileNode \| null,[\s\S]*input\?: WorkspaceExplorerContextOperationInput,[\s\S]*\) => Promise<void>;[\s\S]*handleUnavailableExplorerContextOperation: \([\s\S]*operation: WorkspaceExplorerContextOperation,[\s\S]*node: FileNode \| null,[\s\S]*\) => void;[\s\S]*downloadFile: \(path: string, content: string\) => void;[\s\S]*\};/,
  'IDE interactions should expose an explicit contract for editor, Explorer and download actions',
);
assert.match(
  libTypesSource,
  /export type FileNodeType = 'file' \| 'folder' \| 'directory';[\s\S]*export interface FileNode \{[\s\S]*type: FileNodeType;/,
  'shared FileNode should expose a named FileNodeType contract for file tree node kind boundaries',
);
[
  workspacePageProjectActionsContractSource,
  workspaceIdeInteractionsContractSource,
].forEach((source) => assert.doesNotMatch(
  source,
  /FileNode\['type'\]/,
  'Workspace file tree action contracts should not infer leaf type from FileNode indexed access',
));
assert.doesNotMatch(
  pageUiSource,
  /setMessages|if \(!query\)|if \(!textarea\)|data\.providers \|\| \[\]|selectedModel \|\| 'default'|data\.default_name \|\| null|provider\.display_name \|\| provider\.model \|\| provider\.name|defaultName \|\| ''|if \(defaultName\)|provider\.is_default\)|runtimeEnabled \? \[\{|if \(runtimeEnabled\) return|activeTab === 'preview' \|\| activeTab === 'debug' \|\| activeTab === 'terminal'/,
  'page UI should not write messages through the external setMessages compatibility wrapper or regress query/textarea/model gates to truthy fallbacks',
);
assert.match(
  pageProjectActionsSource,
  /useWorkspaceIdeInteractions\(\{[\s\S]*setMobileFileContent,[\s\S]*applyIdeInteractionMessages: flowState\.applyIdeInteractionMessages,[\s\S]*pendingCloseFile,/,
  'page project actions should pass the IDE interaction message action into IDE interactions',
);
assert.match(
  ideInteractionsSource,
  /import type \{ WorkspaceIdeInteractionsContract \} from '\.\/workspace-ide-interactions-contract';[\s\S]*applyIdeInteractionMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*\}: UseWorkspaceIdeInteractionsOptions\): WorkspaceIdeInteractionsContract \{[\s\S]*return \{[\s\S]*expandAncestorFolders,[\s\S]*reflectFilePathInTree,[\s\S]*isFileDirty,[\s\S]*closeWorkspaceFile,[\s\S]*requestCloseWorkspaceFile,[\s\S]*applyIncrementalWorkflowStep,[\s\S]*openWorkspaceFile,[\s\S]*toggleFolder,[\s\S]*showContextMenu,[\s\S]*handleExplorerContextOperation,[\s\S]*handleUnavailableExplorerContextOperation,[\s\S]*downloadFile,/,
  'IDE interactions should return the explicit IDE interactions contract',
);
assert.match(
  ideInteractionsSource,
  /function shouldSyncWorkspaceIdeInteractionMobileEditor\(isMobile: boolean\): boolean[\s\S]*const shouldSyncMobileEditor = isMobile === true;[\s\S]*return shouldSyncMobileEditor === true;[\s\S]*applyIdeInteractionMessages[\s\S]*close-file-discarded-\$\{Date\.now\(\)\}[\s\S]*const shouldSyncMobileEditor = shouldSyncWorkspaceIdeInteractionMobileEditor\(isMobile\);[\s\S]*if \(shouldSyncMobileEditor === true\)[\s\S]*setMobileEditingFile\(path\);[\s\S]*setMobileFileContent\(getWorkspaceEditorBufferContent\(files, path\)\);[\s\S]*open-workspace-file-refresh-failed-\$\{Date\.now\(\)\}[\s\S]*explorer-context-operation-unavailable-\$\{Date\.now\(\)\}[\s\S]*explorer-context-operation-applied-\$\{Date\.now\(\)\}[\s\S]*explorer-context-operation-failed-\$\{Date\.now\(\)\}/,
  'IDE interactions should route close-file, open-file refresh and Explorer context operation notices through the IDE interaction action while deriving mobile editor sync through a named fact',
);
assert.doesNotMatch(
  ideInteractionsSource,
  /setMessages|if \(isMobile\)/,
  'IDE interactions should not write messages through the external setMessages compatibility wrapper or regress mobile editor sync to a direct isMobile gate',
);
assert.match(
  pageProjectActionsSource,
  /useWorkspaceResourceOperations\(\{[\s\S]*applyResourceFileMessages: flowState\.applyResourceFileMessages,[\s\S]*applyResourceGitMessages: flowState\.applyResourceGitMessages,[\s\S]*setSelectedCommit,/,
  'page project actions should pass resource file and resource Git message actions into resource operations',
);
assert.match(
  resourceOperationsSource,
  /import type \{ WorkspaceResourceOperationsContract \} from '\.\/workspace-resource-operations-contract';[\s\S]*\}: UseWorkspaceResourceOperationsOptions\): WorkspaceResourceOperationsContract \{[\s\S]*return \{[\s\S]*saveFile,[\s\S]*handleViewCommit,[\s\S]*handleRestoreCommit,[\s\S]*handleRestoreCommitFile,[\s\S]*handleCommitWorktree,[\s\S]*handleDiscardWorktreeFile,[\s\S]*handleApplyGitBranchCompareFile,[\s\S]*handleApplyGitStash,[\s\S]*handleCreateGitBranch,[\s\S]*handleCreateGitTag,[\s\S]*handleDeleteGitTag,[\s\S]*handleCreateGitBranchFromRemote,[\s\S]*handleRefreshGitRemoteBranches,[\s\S]*handleDeleteGitBranch,[\s\S]*handleRenameGitBranch,[\s\S]*handleSwitchGitBranch,[\s\S]*confirmRestoreCommit,/,
  'resource operations should return the explicit resource operations contract',
);
assert.match(
  resourceOperationsSource,
  /applyResourceFileMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*export function useWorkspaceResourceOperations\(\{[\s\S]*applyResourceFileMessages,[\s\S]*save-file-failed-\$\{Date\.now\(\)\}[\s\S]*save-file-resource-sync-failed-\$\{Date\.now\(\)\}[\s\S]*save-file-tree-cache-failed-\$\{Date\.now\(\)\}[\s\S]*save-file-git-commit-failed-\$\{Date\.now\(\)\}[\s\S]*save-file-git-commit-record-failed-\$\{Date\.now\(\)\}[\s\S]*save-file-git-commit-skipped-\$\{Date\.now\(\)\}[\s\S]*appendWorkspaceDebugEvent\(\{[\s\S]*title: '文件读取失败'[\s\S]*source: 'workspace_file_read'[\s\S]*view-commit-refresh-failed-\$\{Date\.now\(\)\}/,
  'resource operations should route file save and commit detail notices through resource file action while routing file read failures into Debug events',
);
assert.match(
  resourceOperationsSource,
  /applyResourceGitMessages: Dispatch<SetStateAction<WorkspaceChatMessage\[\]>>;[\s\S]*export function useWorkspaceResourceOperations\(\{[\s\S]*applyResourceGitMessages,[\s\S]*restore-commit-file-failed-\$\{Date\.now\(\)\}[\s\S]*worktree-file-discard-failed-\$\{Date\.now\(\)\}[\s\S]*worktree-commit-failed-\$\{Date\.now\(\)\}[\s\S]*branch-compare-file-apply-failed-\$\{Date\.now\(\)\}[\s\S]*git-stash-apply-failed-\$\{Date\.now\(\)\}[\s\S]*git-branch-create-failed-\$\{Date\.now\(\)\}[\s\S]*git-tag-create-failed-\$\{Date\.now\(\)\}[\s\S]*git-remote-branch-refresh-failed-\$\{Date\.now\(\)\}[\s\S]*git-branch-switch-failed-\$\{Date\.now\(\)\}[\s\S]*restore-commit-failed-\$\{Date\.now\(\)\}/,
  'resource operations should route Git restore, worktree, branch, tag, stash and remote notices through the resource Git action',
);
assert.doesNotMatch(
  resourceOperationsSource,
  /setMessages/,
  'resource operations should not write resource messages through the external setMessages compatibility wrapper',
);
assert.match(
  flowStateSource,
  /currentEngineeringState: messageDispatch\.currentEngineeringState,[\s\S]*currentGateResult: messageDispatch\.currentGateResult,/,
  'workspace flow state should return current engineering state and gate result from the dedicated message dispatch hook',
);
assert.match(
  workspaceMessageDispatchHookSource,
  /currentEngineeringState: selectWorkspaceCurrentEngineeringState\(messageState\),[\s\S]*currentGateResult: selectWorkspaceCurrentGateResult\(messageState\),/,
  'workspace message dispatch hook should return current engineering state and gate result through explicit workflow snapshot selectors',
);
assert.match(
  workspaceMessageStateSource,
  /export function selectWorkspaceWorkflowSnapshot\([\s\S]*state: WorkspaceMessageState,[\s\S]*\): WorkspaceWorkflowSnapshot \{[\s\S]*return state\.workflowSnapshot;[\s\S]*export function selectWorkspaceCurrentEngineeringState\([\s\S]*return selectWorkspaceWorkflowSnapshot\(state\)\.engineeringState;[\s\S]*export function selectWorkspaceCurrentGateResult\([\s\S]*return selectWorkspaceWorkflowSnapshot\(state\)\.gateResult;/,
  'workspace message state module should expose selectors for workflow snapshot, engineering state and gate result',
);
assert.doesNotMatch(
  flowStateSource,
  /useMemo\(\(\) => resolveLatestWorkflowSnapshot\(messages\), \[messages\]\)/,
  'workspace flow state should not derive the latest workflow snapshot through render-time message scanning',
);
assert.doesNotMatch(
  flowStateSource,
  /function reduceWorkspaceMessageState|type WorkspaceMessageState =|type WorkspaceMessageStateAction =/,
  'workspace flow state hook should not own the message state reducer or state action types after selector extraction',
);
assert.doesNotMatch(
  flowStateSource,
  /workspace-message-state|initialWorkspaceMessageState|useReducer|dispatchMessages|reduceWorkspaceMessageState|selectWorkspaceWorkflowSnapshot|selectWorkspaceCurrentEngineeringState|selectWorkspaceCurrentGateResult|type WorkspaceMessageMutationSource|const applyWorkspaceMessages = useCallback|const setMessages = useCallback/,
  'workspace flow state hook should not own message dispatch, reducer selectors, initial workflow snapshot or compatibility setter wiring after message dispatch hook extraction',
);
assert.doesNotMatch(
  flowStateSource,
  /planFlowStateRef|initialWorkspacePlanFlowState|resolvePlanFlowState|syncPlanFlowState|const \[availablePlans, setAvailablePlans\]|const \[recommendedPlanId, setRecommendedPlanId\]|const \[selectedPlanId, setSelectedPlanId\]|const \[planCountdown, setPlanCountdown\]|const \[planSelectionReady, setPlanSelectionReady\]/,
  'workspace flow state hook should not own plan flow state, plan flow refs or plan selection React state after plan flow hook extraction',
);
assert.doesNotMatch(
  flowStateSource,
  /sessionStorage|getWorkspaceSessionKey|buildWorkspaceSessionSnapshot|formatWorkspaceSessionSnapshotLocalStateError/,
  'workspace flow state hook should not own session snapshot storage effects or local storage error formatting after session snapshot hook extraction',
);
assert.doesNotMatch(
  flowStateSource,
  /const applyWorkflowStepToMessage = useCallback|const setMessageStreamingState = useCallback|const applyRuntimeRecoveryMessages = useCallback|const applyProjectPanelRefreshMessages = useCallback|const applyPromptInteractionMessages = useCallback|const applyRuntimeResourceMessages = useCallback|const applyProjectBootstrapMessages = useCallback|const applyPageEffectMessages = useCallback|const applyPageUiMessages = useCallback|const applyIdeInteractionMessages = useCallback|const applyResourceFileMessages = useCallback|const applyResourceGitMessages = useCallback|const applyOrchestrationSharedMessages = useCallback|const applyGenerationStateMessages = useCallback|const applyPlanGenerationMessages = useCallback|const applyPlanStreamPatchMessages = useCallback|const applyPlanImplementationMessages = useCallback|const applyImplementationGenerationMessages = useCallback|const applyImplementationStreamPatchMessages = useCallback/,
  'workspace flow state hook should not own grouped message action wrappers after message action hook extraction',
);
assert.doesNotMatch(
  flowStateSource,
  /useRef<WorkspaceChatMessage\[\]>|useRef<WorkspaceWorkflowSnapshot>|messagesRef\.current = messages|workflowSnapshotRef\.current = workflowSnapshot/,
  'workspace flow state hook should not own flow refs or ref synchronization after flow refs hook extraction',
);
assert.doesNotMatch(
  workspaceFlowStateConsumerSources,
  /ReturnType<typeof useWorkspaceFlowState>|import \{ useWorkspaceFlowState \} from '\.\/use-workspace-flow-state';/,
  'workspace flow state consumers should not infer their FlowState type from useWorkspaceFlowState after contract extraction',
);
assert.doesNotMatch(
  workspacePageLocalStateConsumerSources,
  /ReturnType<typeof useWorkspacePageLocalState>|import \{ useWorkspacePageLocalState \} from '\.\/use-workspace-page-local-state';/,
  'workspace page local state consumers should not infer LocalState from useWorkspacePageLocalState after contract extraction',
);
assert.doesNotMatch(
  workspaceShellStateConsumerSources,
  /ReturnType<typeof useWorkspaceShellState>|import \{ useWorkspaceShellState \} from '\.\/use-workspace-shell-state';/,
  'workspace shell state consumers should not infer ShellState from useWorkspaceShellState after contract extraction',
);
assert.doesNotMatch(
  workspaceRuntimeResourcesConsumerSources,
  /ReturnType<typeof useWorkspaceRuntimeResources>|import \{ useWorkspaceRuntimeResources \} from '\.\/use-workspace-runtime-resources';/,
  'workspace runtime resources consumers should not infer RuntimeResources from useWorkspaceRuntimeResources after contract extraction',
);
assert.doesNotMatch(
  workspacePageProjectActionsConsumerSources,
  /ReturnType<typeof useWorkspacePageProjectActions>|import \{ useWorkspacePageProjectActions \} from '\.\/use-workspace-page-project-actions';/,
  'workspace page project action consumers should not infer ProjectActions from useWorkspacePageProjectActions after contract extraction',
);
assert.doesNotMatch(
  workspacePageOrchestrationActionsConsumerSources,
  /ReturnType<typeof useWorkspacePageOrchestrationActions>|import \{ useWorkspacePageOrchestrationActions \} from '\.\/use-workspace-page-orchestration-actions';/,
  'workspace page orchestration action consumers should not infer OrchestrationActions from useWorkspacePageOrchestrationActions after contract extraction',
);

assert.match(
  workspaceTypesSource,
  /export type ChatScrollSnapshotStatus = 'empty_messages' \| 'following_latest' \| 'paused_by_user' \| 'restored_to_latest' \| 'container_missing';[\s\S]*export type ChatScrollSnapshotSource = 'message_list' \| 'user_scroll' \| 'manual_restore' \| 'scroll_effect';[\s\S]*export type ChatScrollSnapshot = \{[\s\S]*status: ChatScrollSnapshotStatus;[\s\S]*source: ChatScrollSnapshotSource;[\s\S]*distanceToBottom: number \| null;[\s\S]*messageCount: number;[\s\S]*recovery: string;/,
  'workspace chat scroll state should be represented as a structured snapshot with phase, source, distance, count and recovery fields',
);
assert.match(
  workspaceTypesSource,
  /export type ChatInputSnapshotStatus = 'empty_prompt' \| 'ready_to_send' \| 'plan_selection_required' \| 'planning' \| 'generating' \| 'stop_confirmation' \| 'model_unconfigured';[\s\S]*export type ChatInputSnapshotSource = 'input_buffer' \| 'plan_selection' \| 'generation_state' \| 'stop_control' \| 'model_registry';[\s\S]*export type ChatInputSnapshot = \{[\s\S]*status: ChatInputSnapshotStatus;[\s\S]*source: ChatInputSnapshotSource;[\s\S]*canSend: boolean;[\s\S]*promptLength: number;[\s\S]*attachmentCount: number;[\s\S]*selectedModel: string;[\s\S]*modelCount: number;[\s\S]*recovery: string;/,
  'workspace chat input state should be represented as a structured snapshot with phase, source, sendability, prompt, attachment and model facts',
);
assert.match(
  workspaceTypesSource,
  /export type ChatModelRegistrySnapshotStatus = 'idle' \| 'loading' \| 'ready' \| 'empty' \| 'load_failed' \| 'default_selected';[\s\S]*export type ChatModelRegistrySnapshotSource = 'model_registry' \| 'llm_provider_api' \| 'default_provider';[\s\S]*export type ChatModelRegistrySnapshot = \{[\s\S]*status: ChatModelRegistrySnapshotStatus;[\s\S]*source: ChatModelRegistrySnapshotSource;[\s\S]*modelCount: number;[\s\S]*selectedModel: string;[\s\S]*defaultModel: string \| null;[\s\S]*recovery: string;/,
  'workspace chat model registry state should be represented as a structured snapshot with phase, source, count, selected/default model and recovery fields',
);
assert.match(
  workspaceTypesSource,
  /export type ChatAttachmentSnapshotStatus = 'empty' \| 'selected' \| 'removed' \| 'picker_empty';[\s\S]*export type ChatAttachmentSnapshotSource = 'attachment_state' \| 'file_picker' \| 'user_action';[\s\S]*export type ChatAttachmentSnapshot = \{[\s\S]*status: ChatAttachmentSnapshotStatus;[\s\S]*source: ChatAttachmentSnapshotSource;[\s\S]*attachmentCount: number;[\s\S]*totalSize: number;[\s\S]*lastFileName: string \| null;[\s\S]*recovery: string;/,
  'workspace chat attachment state should be represented as a structured snapshot with phase, source, count, size, last file and recovery fields',
);
assert.match(
  workspaceTypesSource,
  /export type AttachmentRemovalConfirmationSnapshotStatus = 'closed' \| 'awaiting_confirmation' \| 'confirming';[\s\S]*export type AttachmentRemovalConfirmationSnapshotSource = 'attachment_badge' \| 'dialog_state';[\s\S]*export type AttachmentRemovalConfirmationSnapshotAction = 'none' \| 'remove_attachment';[\s\S]*export type AttachmentRemovalConfirmationRiskLevel = 'none' \| 'low';[\s\S]*export type AttachmentRemovalConfirmationSnapshot = \{[\s\S]*status: AttachmentRemovalConfirmationSnapshotStatus;[\s\S]*source: AttachmentRemovalConfirmationSnapshotSource;[\s\S]*action: AttachmentRemovalConfirmationSnapshotAction;[\s\S]*fileName: string \| null;[\s\S]*fileSize: number;[\s\S]*attachmentIndex: number \| null;[\s\S]*attachmentCountBefore: number;[\s\S]*attachmentCountAfter: number;[\s\S]*hasAttachment: boolean;[\s\S]*canConfirm: boolean;[\s\S]*canCancel: boolean;[\s\S]*riskLevel: AttachmentRemovalConfirmationRiskLevel;[\s\S]*recovery: string;/,
  'workspace attachment removal confirmation should be represented as a structured snapshot with file, count and action capability facts',
);
assert.match(
  attachmentRemovalConfirmationSnapshotSource,
  /(?=[\s\S]*AttachmentRemovalConfirmationSnapshotStatus)(?=[\s\S]*AttachmentRemovalConfirmationSnapshotSource)(?=[\s\S]*AttachmentRemovalConfirmationSnapshotAction)(?=[\s\S]*AttachmentRemovalConfirmationRiskLevel)(?=[\s\S]*export function buildAttachmentRemovalConfirmationSnapshot\([\s\S]*\): AttachmentRemovalConfirmationSnapshot \{)(?=[\s\S]*const hasAttachment = attachment !== null && attachmentIndex !== null;)(?=[\s\S]*const canConfirm = isOpen === true && isConfirming === false && hasAttachment === true;)(?=[\s\S]*const canCancel = isOpen === true && isConfirming === false;)(?=[\s\S]*status: AttachmentRemovalConfirmationSnapshotStatus = isConfirming)(?=[\s\S]*source: AttachmentRemovalConfirmationSnapshotSource = isActionActive)(?=[\s\S]*action: AttachmentRemovalConfirmationSnapshotAction = isActionActive)(?=[\s\S]*riskLevel: AttachmentRemovalConfirmationRiskLevel = isActionActive)(?=[\s\S]*'confirming')(?=[\s\S]*isOpen)(?=[\s\S]*'awaiting_confirmation')(?=[\s\S]*'closed')(?=[\s\S]*attachmentCountAfter)(?=[\s\S]*function getAttachmentRemovalConfirmationSnapshotLabel\(value: string \| null \| undefined, fallback: string\): string)(?=[\s\S]*function getAttachmentRemovalConfirmationSnapshotBooleanLabel\(value: boolean\): string)(?=[\s\S]*const fileNameLabel = getAttachmentRemovalConfirmationSnapshotLabel\(snapshot\.fileName, 'none'\);)(?=[\s\S]*const canConfirmLabel = getAttachmentRemovalConfirmationSnapshotBooleanLabel\(snapshot\.canConfirm\);)(?=[\s\S]*const canCancelLabel = getAttachmentRemovalConfirmationSnapshotBooleanLabel\(snapshot\.canCancel\);)(?=[\s\S]*data-testid="workspace-attachment-removal-confirmation-snapshot")(?=[\s\S]*Phase: \{snapshot\.status\})(?=[\s\S]*File: \{fileNameLabel\})(?=[\s\S]*Before: \{snapshot\.attachmentCountBefore\})(?=[\s\S]*After: \{snapshot\.attachmentCountAfter\})(?=[\s\S]*Confirm: \{canConfirmLabel\})(?=[\s\S]*Cancel: \{canCancelLabel\})/,
  'workspace attachment removal confirmation snapshot helper should derive phase, file facts, count deltas and expose a stable UI target',
);
assert.doesNotMatch(
  attachmentRemovalConfirmationSnapshotSource,
  /AttachmentRemovalConfirmationSnapshot\['status'\]|AttachmentRemovalConfirmationSnapshot\['source'\]|AttachmentRemovalConfirmationSnapshot\['action'\]|AttachmentRemovalConfirmationSnapshot\['riskLevel'\]|&& !isConfirming|snapshot\.fileName (\|\||\?\?) 'none'|snapshot\.(canConfirm|canCancel) \? 'yes' : 'no'/,
  'workspace attachment removal confirmation snapshot helper should not infer status/source/action/risk from indexed snapshot access or implicit negation gates',
);
assert.match(
  workspaceTypesSource,
  /export type ChatModeSnapshotStatus = 'discuss_ready' \| 'implement_ready' \| 'online_discuss' \| 'online_implement' \| 'planning' \| 'generating' \| 'stop_confirmation';[\s\S]*export type ChatModeSnapshotSource = 'mode_toggle' \| 'online_toggle' \| 'foundation_status' \| 'generation_state' \| 'stop_control';[\s\S]*export type ChatModeSnapshot = \{[\s\S]*status: ChatModeSnapshotStatus;[\s\S]*source: ChatModeSnapshotSource;[\s\S]*chatMode: ChatMode;[\s\S]*isOnline: boolean;[\s\S]*foundationStatusLabel: string;[\s\S]*isBusy: boolean;[\s\S]*recovery: string;/,
  'workspace chat mode state should be represented as a structured snapshot with phase, source, mode, online, foundation and busy facts',
);
assert.match(
  workspaceTypesSource,
  /export type StopGenerationConfirmationSnapshotStatus = 'closed' \| 'awaiting_confirmation';[\s\S]*export type StopGenerationConfirmationSnapshotSource = 'stop_control' \| 'generation_state';[\s\S]*export type StopGenerationConfirmationSnapshotAction = 'none' \| 'stop_generation';[\s\S]*export type StopGenerationConfirmationRiskLevel = 'none' \| 'medium';[\s\S]*export type StopGenerationConfirmationSnapshot = \{[\s\S]*status: StopGenerationConfirmationSnapshotStatus;[\s\S]*source: StopGenerationConfirmationSnapshotSource;[\s\S]*action: StopGenerationConfirmationSnapshotAction;[\s\S]*projectId: string \| null;[\s\S]*isPersistedProject: boolean;[\s\S]*isPlanning: boolean;[\s\S]*isGenerating: boolean;[\s\S]*promptLength: number;[\s\S]*hasBackendStopSync: boolean;[\s\S]*canConfirm: boolean;[\s\S]*canCancel: boolean;[\s\S]*riskLevel: StopGenerationConfirmationRiskLevel;[\s\S]*recovery: string;/,
  'workspace stop generation confirmation should be represented as a structured snapshot with project, generation, backend sync and action capability facts',
);
assert.match(
  stopGenerationConfirmationSnapshotSource,
  /(?=[\s\S]*StopGenerationConfirmationSnapshotStatus)(?=[\s\S]*StopGenerationConfirmationSnapshotSource)(?=[\s\S]*StopGenerationConfirmationSnapshotAction)(?=[\s\S]*StopGenerationConfirmationRiskLevel)(?=[\s\S]*function getStopGenerationConfirmationNullableText\(value: string \| null\): string \| null)(?=[\s\S]*function hasStopGenerationConfirmationTextValue\(value: string \| null \| undefined\): value is string \{[\s\S]*if \(value === null \|\| value === undefined\)[\s\S]*return false;[\s\S]*const hasValue = value\.length > 0;)(?=[\s\S]*export function buildStopGenerationConfirmationSnapshot\([\s\S]*\): StopGenerationConfirmationSnapshot \{)(?=[\s\S]*const normalizedProjectId = getStopGenerationConfirmationNullableText\(projectId\);)(?=[\s\S]*const normalizedProjectName = getStopGenerationConfirmationNullableText\(projectName\);)(?=[\s\S]*const hasProject = hasStopGenerationConfirmationTextValue\(normalizedProjectId\);)(?=[\s\S]*const isBusy = isPlanning === true \|\| isGenerating === true;)(?=[\s\S]*const hasBackendStopSync = isPersistedProject === true && hasProject === true;)(?=[\s\S]*const canConfirm = isStopConfirming === true && isBusy === true;)(?=[\s\S]*const canCancel = isStopConfirming === true;)(?=[\s\S]*status: StopGenerationConfirmationSnapshotStatus = isStopConfirming)(?=[\s\S]*source: StopGenerationConfirmationSnapshotSource = isStopConfirming)(?=[\s\S]*action: StopGenerationConfirmationSnapshotAction = isStopConfirming)(?=[\s\S]*riskLevel: StopGenerationConfirmationRiskLevel = isStopConfirming)(?=[\s\S]*'awaiting_confirmation')(?=[\s\S]*'closed')(?=[\s\S]*function getStopGenerationConfirmationSnapshotLabel\(value: string \| null \| undefined, fallback: string\): string)(?=[\s\S]*const hasValue = hasStopGenerationConfirmationTextValue\(value\);)(?=[\s\S]*function getStopGenerationConfirmationSnapshotBooleanLabel\(value: boolean\): string)(?=[\s\S]*const projectIdLabel = getStopGenerationConfirmationSnapshotLabel\(snapshot\.projectId, 'none'\);)(?=[\s\S]*const isPersistedProjectLabel = getStopGenerationConfirmationSnapshotBooleanLabel\(snapshot\.isPersistedProject\);)(?=[\s\S]*const hasBackendStopSyncLabel = getStopGenerationConfirmationSnapshotBooleanLabel\(snapshot\.hasBackendStopSync\);)(?=[\s\S]*const canConfirmLabel = getStopGenerationConfirmationSnapshotBooleanLabel\(snapshot\.canConfirm\);)(?=[\s\S]*const canCancelLabel = getStopGenerationConfirmationSnapshotBooleanLabel\(snapshot\.canCancel\);)(?=[\s\S]*data-testid="workspace-stop-generation-confirmation-snapshot")(?=[\s\S]*Phase: \{snapshot\.status\})(?=[\s\S]*Project: \{projectIdLabel\})(?=[\s\S]*BackendStop: \{hasBackendStopSyncLabel\})(?=[\s\S]*Confirm: \{canConfirmLabel\})(?=[\s\S]*Cancel: \{canCancelLabel\})/,
  'workspace stop generation confirmation snapshot helper should derive confirmation phase and expose a stable UI target',
);
assert.doesNotMatch(
  stopGenerationConfirmationSnapshotSource,
  /StopGenerationConfirmationSnapshot\['status'\]|StopGenerationConfirmationSnapshot\['source'\]|StopGenerationConfirmationSnapshot\['action'\]|StopGenerationConfirmationSnapshot\['riskLevel'\]|Boolean\(normalizedProjectId\)|projectId\.trim\(\) \|\| null|projectName\.trim\(\) \|\| null|normalizedProjectId !== null && normalizedProjectId\.length > 0|value !== null && value !== undefined && value\.length > 0|const isBusy = isPlanning \|\| isGenerating;|isPersistedProject && hasProject|canConfirm: isStopConfirming && isBusy|canCancel: isStopConfirming|snapshot\.projectId (\|\||\?\?) 'none'|snapshot\.(isPersistedProject|isPlanning|isGenerating|hasBackendStopSync|canConfirm|canCancel) \? 'yes' : 'no'/,
  'workspace stop generation confirmation snapshot helper should not infer status/source/action/risk from indexed snapshot access, direct nullable length checks or implicit Boolean gates',
);
assert.match(
  workspaceTypesSource,
  /export type PlanSelectionSnapshotStatus = 'streaming' \| 'waiting_for_selection' \| 'selected' \| 'superseded' \| 'busy_blocked' \| 'empty_plans';[\s\S]*export type PlanSelectionSnapshotSource = 'plan_stream' \| 'user_selection' \| 'new_requirement' \| 'generation_state' \| 'message_restore';[\s\S]*export type PlanSelectionSnapshot = \{[\s\S]*status: PlanSelectionSnapshotStatus;[\s\S]*source: PlanSelectionSnapshotSource;[\s\S]*planCount: number;[\s\S]*recommendedPlanId: string \| null;[\s\S]*selectedPlanId: string \| null;[\s\S]*canSelect: boolean;[\s\S]*recovery: string;/,
  'workspace plan selection state should be represented as a structured snapshot with phase, source, plan facts and recovery fields',
);
assert.match(
  workspaceTypesSource,
  /export type PlanThoughtProcessSnapshotStatus = 'empty' \| 'streaming' \| 'expanded' \| 'collapsed' \| 'settled';[\s\S]*export type PlanThoughtProcessSnapshotSource = 'plan_stream' \| 'user_toggle' \| 'message_restore';[\s\S]*export type PlanThoughtProcessSnapshot = \{[\s\S]*status: PlanThoughtProcessSnapshotStatus;[\s\S]*source: PlanThoughtProcessSnapshotSource;[\s\S]*contentLength: number;[\s\S]*isOpen: boolean;[\s\S]*recovery: string;/,
  'workspace plan thought process state should be represented as a structured snapshot with phase, source, content length, open state and recovery fields',
);
assert.match(
  workspaceTypesSource,
  /export type WorkspaceGuidanceSnapshotStatus = 'empty' \| 'questions_only' \| 'actions_available' \| 'mixed' \| 'recovery_fallback';[\s\S]*export type WorkspaceGuidanceSnapshotSource = 'suggested_questions' \| 'suggested_actions' \| 'engineering_recovery';[\s\S]*export type WorkspaceGuidanceSnapshot = \{[\s\S]*status: WorkspaceGuidanceSnapshotStatus;[\s\S]*source: WorkspaceGuidanceSnapshotSource;[\s\S]*questionCount: number;[\s\S]*actionCount: number;[\s\S]*primaryActionCount: number;[\s\S]*retryActionCount: number;[\s\S]*recovery: string;/,
  'workspace guidance state should be represented as a structured snapshot with phase, source, question/action counts and recovery fields',
);
assert.match(
  guidanceSnapshotSource,
  /(?=[\s\S]*WorkspaceGuidanceSnapshotStatus)(?=[\s\S]*WorkspaceGuidanceSnapshotSource)(?=[\s\S]*function usesWorkspaceGuidanceRecoveryFallback\([\s\S]*hasExplicitSuggestedActions: boolean;[\s\S]*actionCount: number;[\s\S]*hasRecoveryRetry: boolean;[\s\S]*\): boolean \{[\s\S]*if \(hasExplicitSuggestedActions === true\)[\s\S]*return false;[\s\S]*const hasActions = hasWorkspaceGuidanceSnapshotCount\(actionCount\);[\s\S]*if \(hasActions === false\)[\s\S]*return false;[\s\S]*return hasRecoveryRetry === true;)(?=[\s\S]*function hasWorkspaceGuidanceSnapshotCount\(count: number\): boolean)(?=[\s\S]*function hasWorkspaceGuidanceSnapshotEmptyCounts\(\{[\s\S]*questionCount,[\s\S]*actionCount,[\s\S]*\}: \{[\s\S]*questionCount: number;[\s\S]*actionCount: number;[\s\S]*\}\): boolean \{[\s\S]*const hasQuestions = hasWorkspaceGuidanceSnapshotCount\(questionCount\);[\s\S]*if \(hasQuestions === true\)[\s\S]*const hasActions = hasWorkspaceGuidanceSnapshotCount\(actionCount\);[\s\S]*if \(hasActions === true\)[\s\S]*return true;)(?=[\s\S]*function hasWorkspaceGuidanceSnapshotMixedCounts\(\{[\s\S]*questionCount,[\s\S]*actionCount,[\s\S]*\}: \{[\s\S]*questionCount: number;[\s\S]*actionCount: number;[\s\S]*\}\): boolean \{[\s\S]*const hasQuestions = hasWorkspaceGuidanceSnapshotCount\(questionCount\);[\s\S]*if \(hasQuestions === false\)[\s\S]*const hasActions = hasWorkspaceGuidanceSnapshotCount\(actionCount\);[\s\S]*return hasActions === true;)(?=[\s\S]*export function buildWorkspaceGuidanceSnapshot\([\s\S]*\): WorkspaceGuidanceSnapshot \{)(?=[\s\S]*const hasEmptyCounts = hasWorkspaceGuidanceSnapshotEmptyCounts\(\{[\s\S]*questionCount,[\s\S]*actionCount,[\s\S]*\}\);[\s\S]*if \(hasEmptyCounts === true\)[\s\S]*status: WorkspaceGuidanceSnapshotStatus = 'empty'[\s\S]*source: WorkspaceGuidanceSnapshotSource = 'suggested_questions')(?=[\s\S]*const usesRecoveryFallback = usesWorkspaceGuidanceRecoveryFallback\(\{[\s\S]*hasExplicitSuggestedActions,[\s\S]*actionCount,[\s\S]*hasRecoveryRetry,[\s\S]*\}\);)(?=[\s\S]*if \(usesRecoveryFallback === true\)[\s\S]*status: WorkspaceGuidanceSnapshotStatus = 'recovery_fallback'[\s\S]*source: WorkspaceGuidanceSnapshotSource = 'engineering_recovery')(?=[\s\S]*const hasMixedCounts = hasWorkspaceGuidanceSnapshotMixedCounts\(\{[\s\S]*questionCount,[\s\S]*actionCount,[\s\S]*\}\);[\s\S]*if \(hasMixedCounts === true\)[\s\S]*status: WorkspaceGuidanceSnapshotStatus = 'mixed'[\s\S]*source: WorkspaceGuidanceSnapshotSource = 'suggested_actions')(?=[\s\S]*const hasActions = hasWorkspaceGuidanceSnapshotCount\(actionCount\);[\s\S]*if \(hasActions === true\)[\s\S]*status: WorkspaceGuidanceSnapshotStatus = 'actions_available')(?=[\s\S]*status: WorkspaceGuidanceSnapshotStatus = 'questions_only')/,
  'workspace guidance snapshot helper should derive all guidance phases from question, action, primary, retry and recovery fallback facts',
);
assert.doesNotMatch(
  guidanceSnapshotSource,
  /WorkspaceGuidanceSnapshot\['status'\]|WorkspaceGuidanceSnapshot\['source'\]|!hasExplicitSuggestedActions|if \(usesRecoveryFallback\)|actionCount > 0 && hasRecoveryRetry === true|questionCount === 0 && actionCount === 0|questionCount > 0 && actionCount > 0/,
  'workspace guidance snapshot helper should not infer status/source from indexed snapshot access or regress to implicit recovery fallback gates',
);
assert.match(
  guidanceActionsSource,
  /import \{ buildWorkspaceGuidanceSnapshot \} from '\.\/workspace-guidance-snapshot';[\s\S]*function getWorkspaceGuidanceSuggestedActions\(message: GuidanceMessageLike\): WorkspaceGuidanceActionList[\s\S]*function getWorkspaceGuidanceSuggestedQuestions\(message: GuidanceMessageLike\): WorkspaceSuggestedQuestionList[\s\S]*function getWorkspaceGuidanceRecoveryState\([\s\S]*message: GuidanceMessageLike,[\s\S]*\): WorkspaceRecoveryState \| undefined[\s\S]*function hasWorkspaceGuidanceRecoveryRetry\(recovery: WorkspaceRecoveryState \| undefined\): boolean[\s\S]*const suggestedQuestions = getWorkspaceGuidanceSuggestedQuestions\(message\);[\s\S]*const hasSuggestedQuestions = suggestedQuestions\.length > 0;[\s\S]*const explicitSuggestedActions = getWorkspaceGuidanceSuggestedActions\(message\);[\s\S]*const hasExplicitSuggestedActions = explicitSuggestedActions\.length > 0;[\s\S]*const recovery = getWorkspaceGuidanceRecoveryState\(message\);[\s\S]*const hasRecoveryRetry = hasWorkspaceGuidanceRecoveryRetry\(recovery\);[\s\S]*const guidanceSnapshot = buildWorkspaceGuidanceSnapshot\(\{[\s\S]*questionCount: suggestedQuestions\.length,[\s\S]*actionCount,[\s\S]*primaryActionCount,[\s\S]*retryActionCount,[\s\S]*hasExplicitSuggestedActions,[\s\S]*hasRecoveryRetry,/,
  'workspace guidance actions should use the shared snapshot helper with authoritative question, action and recovery fallback facts',
);
assert.match(
  guidanceActionsSource,
  /GuidanceActionKind[\s\S]*WorkspaceGenerationMode[\s\S]*export type WorkspaceGuidanceActionTone = 'primary' \| 'secondary';[\s\S]*export type WorkspaceRecoveryActionLabel = string;[\s\S]*export type WorkspaceRecoveryActionLabelList = WorkspaceRecoveryActionLabel\[\];[\s\S]*export type WorkspaceGuidanceActionPriorityMap = \{[\s\S]*\[kind in GuidanceActionKind\]: number;[\s\S]*\};[\s\S]*labels: WorkspaceRecoveryActionLabelList;[\s\S]*const WORKSPACE_GUIDANCE_ACTION_PRIORITY: WorkspaceGuidanceActionPriorityMap = \{[\s\S]*retry_workflow_gate: 30,[\s\S]*retry_context_gate: 30,[\s\S]*retry_plan_generation: 35,[\s\S]*function normalizeRecoveryActionMode\(mode\?: string\): WorkspaceGenerationMode \| undefined[\s\S]*if \(mode === 'foundation'\) return mode;[\s\S]*if \(mode === 'discuss'\) return mode;[\s\S]*if \(mode === 'implement'\) return mode;[\s\S]*function hasWorkspaceGuidancePrimaryActionTone\(action: GuidanceAction\): boolean[\s\S]*const isConfirmRecommendedPlan = action\.kind === 'confirm_recommended_plan';[\s\S]*if \(isConfirmRecommendedPlan === true\)[\s\S]*const isOpenAction = action\.kind\.startsWith\('open_'\);[\s\S]*if \(isOpenAction === true\)[\s\S]*const isRefreshExplorerPanel = action\.kind === 'refresh_explorer_panel';[\s\S]*return isRefreshExplorerPanel === true;[\s\S]*export function getWorkspaceGuidanceActionTone\(action: GuidanceAction\): WorkspaceGuidanceActionTone[\s\S]*const hasPrimaryTone = hasWorkspaceGuidancePrimaryActionTone\(action\);[\s\S]*if \(hasPrimaryTone === true\)[\s\S]*return 'secondary';[\s\S]*function getWorkspaceGuidanceActionClassName\(tone: WorkspaceGuidanceActionTone\)[\s\S]*if \(tone === 'primary'\)/,
  'workspace guidance action priority, recovery mode, tone and recovery labels should consume named contracts',
);
assert.match(
  guidanceActionsSource,
  /function getWorkspaceGuidanceRetryPrompt\(recovery: WorkspaceRecoveryState \| undefined\): string[\s\S]*function getWorkspaceGuidanceRetryLabel\(recovery: WorkspaceRecoveryState \| undefined\): string[\s\S]*function getWorkspaceGuidanceRecoveryMode\([\s\S]*recovery: WorkspaceRecoveryState \| undefined,[\s\S]*\): WorkspaceGenerationMode \| undefined[\s\S]*function getWorkspaceGuidanceRecoveryStage\([\s\S]*recovery: WorkspaceRecoveryState \| undefined,[\s\S]*\)[\s\S]*function lacksWorkspaceGuidanceRecoveryRetryFallback\(\{[\s\S]*hasRecoveryRetry,[\s\S]*hasRetryPrompt,[\s\S]*\}: \{[\s\S]*hasRecoveryRetry: boolean;[\s\S]*hasRetryPrompt: boolean;[\s\S]*\}\): boolean \{[\s\S]*if \(hasRecoveryRetry === false\)[\s\S]*return hasRetryPrompt === false;[\s\S]*function getWorkspaceGuidanceRetryActionLabel\(\{[\s\S]*retryLabel,[\s\S]*hasRetryLabel,[\s\S]*\}: \{[\s\S]*retryLabel: string;[\s\S]*hasRetryLabel: boolean;[\s\S]*\}\): string \{[\s\S]*if \(hasRetryLabel === true\)[\s\S]*return '修复后重试';[\s\S]*const hasRecoveryRetry = hasWorkspaceGuidanceRecoveryRetry\(recovery\);[\s\S]*const retryPrompt = getWorkspaceGuidanceRetryPrompt\(recovery\);[\s\S]*const hasRetryPrompt = hasWorkspaceGuidanceTextValue\(retryPrompt\);[\s\S]*const lacksRetryFallback = lacksWorkspaceGuidanceRecoveryRetryFallback\(\{[\s\S]*hasRecoveryRetry,[\s\S]*hasRetryPrompt,[\s\S]*\}\);[\s\S]*if \(lacksRetryFallback === true\)[\s\S]*label: getWorkspaceGuidanceRetryActionLabel\(\{[\s\S]*retryLabel,[\s\S]*hasRetryLabel,[\s\S]*\}\)[\s\S]*prompt: retryPrompt[\s\S]*mode: getWorkspaceGuidanceRecoveryMode\(recovery\)[\s\S]*conversationStage: getWorkspaceGuidanceRecoveryStage\(recovery\)/,
  'workspace guidance recovery fallback action should use explicit retry gates and normalized mode',
);
assert.match(
  guidanceActionsSource,
  /function getWorkspaceGuidanceActionSortValue\(\{[\s\S]*priorityDelta,[\s\S]*leftIndex,[\s\S]*rightIndex,[\s\S]*\}: \{[\s\S]*priorityDelta: number;[\s\S]*leftIndex: number;[\s\S]*rightIndex: number;[\s\S]*\}\): number \{[\s\S]*const hasPriorityDelta = priorityDelta !== 0;[\s\S]*if \(hasPriorityDelta === true\)[\s\S]*return leftIndex - rightIndex;[\s\S]*function materializeWorkspaceGuidanceActionSortItems\(actions: GuidanceAction\[\]\): WorkspaceGuidanceActionSortItemList \{[\s\S]*for \(let index = 0; index < actions\.length; index \+= 1\)[\s\S]*items\.push\(\{ action, index \}\);[\s\S]*function compareWorkspaceGuidanceActionSortItems\([\s\S]*left: WorkspaceGuidanceActionSortItem,[\s\S]*right: WorkspaceGuidanceActionSortItem,[\s\S]*\): number \{[\s\S]*const priorityDelta = WORKSPACE_GUIDANCE_ACTION_PRIORITY\[left\.action\.kind\][\s\S]*return getWorkspaceGuidanceActionSortValue\(\{[\s\S]*priorityDelta,[\s\S]*leftIndex: left\.index,[\s\S]*rightIndex: right\.index,[\s\S]*\}\);[\s\S]*function materializeWorkspaceGuidanceActionsFromSortItems\([\s\S]*items: WorkspaceGuidanceActionSortItemList,[\s\S]*\): WorkspaceGuidanceActionList \{[\s\S]*for \(const item of items\)[\s\S]*actions\.push\(item\.action\);[\s\S]*const items = materializeWorkspaceGuidanceActionSortItems\(actions\);[\s\S]*items\.sort\(compareWorkspaceGuidanceActionSortItems\);[\s\S]*return materializeWorkspaceGuidanceActionsFromSortItems\(items\);[\s\S]*function isWorkspaceRecoveryAction\(action: GuidanceAction\)[\s\S]*const isOpenAction = action\.kind\.startsWith\('open_'\);[\s\S]*if \(isOpenAction === true\)[\s\S]*const isRetryAction = action\.kind\.startsWith\('retry_'\);[\s\S]*if \(isRetryAction === true\)[\s\S]*const isRefreshExplorerPanel = action\.kind === 'refresh_explorer_panel';[\s\S]*return isRefreshExplorerPanel === true;[\s\S]*function getWorkspaceGuidanceRecoveryActions\(actions: GuidanceAction\[\]\): WorkspaceGuidanceRecoveryActionList[\s\S]*function getWorkspaceGuidanceRecoveryActionLabels\([\s\S]*actions: WorkspaceGuidanceRecoveryActionList,[\s\S]*\): WorkspaceRecoveryActionLabelList[\s\S]*function getWorkspaceGuidancePrimaryActionCount\(actions: GuidanceAction\[\]\): number[\s\S]*function getWorkspaceGuidanceRetryActionCount\(actions: GuidanceAction\[\]\): number[\s\S]*function getWorkspaceRecoveryActionSummaryLabel\([\s\S]*labels: WorkspaceRecoveryActionLabelList,[\s\S]*\): string \{[\s\S]*const hasLabels = labels\.length > 0;[\s\S]*if \(hasLabels === true\)[\s\S]*return `恢复入口 \$\{labels\.length\} 个：\$\{labels\.join\(' \/ '\)\}`;[\s\S]*return '';[\s\S]*const labels = getWorkspaceGuidanceRecoveryActionLabels\(actions\);[\s\S]*const primaryActionCount = getWorkspaceGuidancePrimaryActionCount\(actions\);[\s\S]*const retryActionCount = getWorkspaceGuidanceRetryActionCount\(actions\);[\s\S]*summaryLabel: getWorkspaceRecoveryActionSummaryLabel\(labels\),/,
  'workspace guidance sorting and recovery summary should use explicit fallback gates',
);
assert.match(
  guidanceActionsSource,
  /function shouldUseWorkspaceGuidanceRecoveryHighlight\(snapshot: WorkspaceGuidanceSnapshot\): boolean \{[\s\S]*const hasRecoveryFallback = snapshot\.status === 'recovery_fallback';[\s\S]*if \(hasRecoveryFallback === true\)[\s\S]*const hasRetryActions = snapshot\.retryActionCount > 0;[\s\S]*return hasRetryActions === true;[\s\S]*function getWorkspaceGuidanceSnapshotClassName\(snapshot: WorkspaceGuidanceSnapshot\)[\s\S]*const shouldUseRecoveryHighlight = shouldUseWorkspaceGuidanceRecoveryHighlight\(snapshot\);[\s\S]*if \(shouldUseRecoveryHighlight === true\)/,
  'workspace guidance snapshot class should use a named recovery highlight fact',
);
assert.match(
  guidanceActionsSource,
  /function shouldRenderWorkspaceGuidanceContent\(\{[\s\S]*hasSuggestedQuestions,[\s\S]*hasActions,[\s\S]*\}: \{[\s\S]*hasSuggestedQuestions: boolean;[\s\S]*hasActions: boolean;[\s\S]*\}\): boolean \{[\s\S]*if \(hasSuggestedQuestions === true\)[\s\S]*return hasActions === true;[\s\S]*const shouldRenderGuidanceContent = shouldRenderWorkspaceGuidanceContent\(\{[\s\S]*hasSuggestedQuestions,[\s\S]*hasActions,[\s\S]*\}\);[\s\S]*if \(shouldRenderGuidanceContent === false\)/,
  'workspace guidance content render gate should use a named render fact',
);
assert.match(
  guidanceActionsSource,
  /import type \{ ReactNode \} from 'react';[\s\S]*type WorkspaceGuidanceActionViewModel = \{[\s\S]*action: GuidanceAction;[\s\S]*key: string;[\s\S]*tone: WorkspaceGuidanceActionTone;[\s\S]*className: string;[\s\S]*\};[\s\S]*type WorkspaceGuidanceQuestionNodeList = ReactNode\[\];[\s\S]*type WorkspaceGuidanceActionNodeList = ReactNode\[\];[\s\S]*function materializeWorkspaceGuidanceActionViewModels\([\s\S]*actions: GuidanceAction\[\],[\s\S]*\): WorkspaceGuidanceActionViewModelList \{[\s\S]*for \(const action of actions\)[\s\S]*viewModels\.push\(\{[\s\S]*key: getWorkspaceGuidanceActionKey\(action\),[\s\S]*className: getWorkspaceGuidanceActionClassName\(tone\),[\s\S]*export function deriveWorkspaceGuidanceActionViewModels\([\s\S]*\): WorkspaceGuidanceActionViewModelList \{[\s\S]*const actions = sortWorkspaceGuidanceActions\(deriveWorkspaceGuidanceActions\(message\)\);[\s\S]*return materializeWorkspaceGuidanceActionViewModels\(actions\);[\s\S]*function getWorkspaceGuidancePrimaryViewModelCount\(viewModels: WorkspaceGuidanceActionViewModelList\): number \{[\s\S]*for \(const viewModel of viewModels\)[\s\S]*viewModel\.tone === 'primary'[\s\S]*function getWorkspaceGuidanceRetryViewModelCount\(viewModels: WorkspaceGuidanceActionViewModelList\): number \{[\s\S]*for \(const viewModel of viewModels\)[\s\S]*viewModel\.action\.kind\.startsWith\('retry_'\)[\s\S]*function materializeWorkspaceGuidanceQuestionNodes\(\{[\s\S]*suggestedQuestions,[\s\S]*onAskQuestion,[\s\S]*\}: \{[\s\S]*suggestedQuestions: WorkspaceSuggestedQuestionList;[\s\S]*onAskQuestion: WorkspaceGuidanceQuestionHandler;[\s\S]*\}\): WorkspaceGuidanceQuestionNodeList \{[\s\S]*for \(const question of suggestedQuestions\)[\s\S]*nodes\.push\([\s\S]*onClick=\{\(\) => onAskQuestion\(question\)\}[\s\S]*function materializeWorkspaceGuidanceActionNodes\(\{[\s\S]*suggestedActionViewModels,[\s\S]*onRunAction,[\s\S]*\}: \{[\s\S]*suggestedActionViewModels: WorkspaceGuidanceActionViewModelList;[\s\S]*onRunAction: WorkspaceGuidanceActionHandler;[\s\S]*\}\): WorkspaceGuidanceActionNodeList \{[\s\S]*for \(const viewModel of suggestedActionViewModels\)[\s\S]*onClick=\{\(\) => onRunAction\(viewModel\.action\)\}[\s\S]*className=\{viewModel\.className\}[\s\S]*\{viewModel\.action\.label\}[\s\S]*const primaryActionCount = getWorkspaceGuidancePrimaryViewModelCount\(suggestedActionViewModels\);[\s\S]*const retryActionCount = getWorkspaceGuidanceRetryViewModelCount\(suggestedActionViewModels\);[\s\S]*materializeWorkspaceGuidanceQuestionNodes\(\{[\s\S]*suggestedQuestions,[\s\S]*onAskQuestion,[\s\S]*\}\)[\s\S]*materializeWorkspaceGuidanceActionNodes\(\{[\s\S]*suggestedActionViewModels,[\s\S]*onRunAction,[\s\S]*\}\)/,
  'workspace guidance view models, counts and nodes should be materialized through named for-loop helpers',
);
assert.doesNotMatch(
  guidanceActionsSource,
  /Record<GuidanceActionKind, number>/,
  'workspace guidance action priority should not regress to an anonymous Record map',
);
assert.doesNotMatch(
  guidanceActionsSource,
  /!recovery\?\.can_retry|!recovery\.retry_prompt\?\.trim\(\)|message\.suggestedQuestions \?\? \[\]|message\.suggestedActions \?\? \[\]|message\.engineeringState\?\.recovery\?\.can_retry|recovery\?\.retry_prompt|recovery\?\.retry_label|recovery\.retry_label\?\.trim\(\) \|\| '修复后重试'|\.filter\(Boolean\)|\.filter\(isWorkspaceRecoveryAction\)|\.filter\(\(label\) => label\.length > 0\)|Boolean\(message\.suggestedActions\?\.length\)|Boolean\(message\.engineeringState\?\.recovery\?\.can_retry\)|priorityDelta \|\| left\.index|actions\s*\.\s*map\(\(action, index\) => \(\{ action, index \}\)\)|\.map\(\(item\) => item\.action\)|sortWorkspaceGuidanceActions\(deriveWorkspaceGuidanceActions\(message\)\)\.map|suggestedActionViewModels\.map\(\(\{ action \}\) => action\)|suggestedQuestions\.map\(\(question\)|suggestedActionViewModels\.map\(\(\{ action, className, key \}\)|message\.suggestedQuestions \|\| \[\]|message\.suggestedActions \|\| \[\]|action\.conversationStage \?\? ''|action\.conversationStage \|\| ''|action\.navigationTarget\?\.path \?\? ''|action\.navigationTarget\?\.path \|\| ''|action\.navigationTarget\?\.lineNumber\?\.toString\(\) \?\? ''|action\.navigationTarget\?\.lineNumber \|\| ''|isConfirmRecommendedPlan === true\s*\|\||isOpenAction === true\s*\|\||hasRecoveryRetry === false \|\| hasRetryPrompt === false|isRetryAction === true\s*\|\||snapshot\.status === 'recovery_fallback' \|\| snapshot\.retryActionCount > 0|hasPrimaryTone === true \? 'primary' : 'secondary'|tone === 'primary'\s*\?|hasRetryLabel === true \? retryLabel : '修复后重试'|hasPriorityDelta === true \? priorityDelta : left\.index - right\.index|summaryLabel: hasLabels === true \?|hasSuggestedQuestions === false && hasActions === false/,
  'workspace guidance actions should not regress to implicit recovery, snapshot, sorting or key fallback gates',
);
assert.doesNotMatch(
  guidanceActionsSource,
  /labels: string\[\];|const labels = actions\.map/,
  'workspace recovery action labels should not regress to anonymous string arrays',
);
assert.doesNotMatch(
  guidanceActionsSource,
  /GuidanceAction\['kind'\]/,
  'workspace guidance actions should not infer action kind from indexed GuidanceAction access',
);
assert.doesNotMatch(
  guidanceActionsSource,
  /GuidanceAction\['mode'\]/,
  'workspace guidance actions should not infer recovery mode from indexed GuidanceAction access',
);
assert.doesNotMatch(
  guidanceActionsSource,
  /(?:^|\n)type WorkspaceGuidanceActionTone = 'primary' \| 'secondary';/,
  'workspace guidance action tone should remain an exported contract instead of a local inline type',
);
assert.match(
  workspaceTypesSource,
  /export type MessageRenderSnapshotStatus = 'code_idle' \| 'code_copied' \| 'code_copy_failed' \| 'mermaid_rendering' \| 'mermaid_rendered' \| 'mermaid_failed';[\s\S]*export type MessageRenderSnapshotSource = 'code_block' \| 'clipboard' \| 'mermaid_render';[\s\S]*export type MermaidMessageRenderSnapshotStatus = 'mermaid_rendering' \| 'mermaid_rendered' \| 'mermaid_failed';[\s\S]*export type MessageRenderSnapshot = \{[\s\S]*status: MessageRenderSnapshotStatus;[\s\S]*source: MessageRenderSnapshotSource;[\s\S]*language: string;[\s\S]*contentLength: number;[\s\S]*recovery: string;/,
  'workspace message render state should be represented as a structured snapshot with phase, source, language, content length and recovery fields',
);
assert.match(
  messageRenderSnapshotSource,
  /(?=[\s\S]*export type CodeBlockCopyStatus = 'idle' \| 'copied' \| 'failed';)(?=[\s\S]*MessageRenderSnapshotStatus)(?=[\s\S]*MessageRenderSnapshotSource)(?=[\s\S]*copyStatus: CodeBlockCopyStatus;)(?=[\s\S]*function hasMessageRenderSnapshotTextValue\(value: string\): boolean[\s\S]*return hasValue === true;)(?=[\s\S]*function getMessageRenderSnapshotFallbackTextValue\(value: string, fallback: string\): string)(?=[\s\S]*function getMessageRenderSnapshotLanguage\(language: string\): string[\s\S]*getMessageRenderSnapshotFallbackTextValue\(language, 'code'\))(?=[\s\S]*function getCodeBlockCopyErrorMessage\(copyError: string\): string[\s\S]*getMessageRenderSnapshotFallbackTextValue\(copyError, '浏览器拒绝了剪贴板访问'\))(?=[\s\S]*export function buildCodeBlockMessageRenderSnapshot\([\s\S]*\): MessageRenderSnapshot \{)(?=[\s\S]*const resolvedLanguage = getMessageRenderSnapshotLanguage\(language\);)(?=[\s\S]*copyStatus === 'failed'[\s\S]*status: MessageRenderSnapshotStatus = 'code_copy_failed'[\s\S]*source: MessageRenderSnapshotSource = 'clipboard'[\s\S]*const copyErrorMessage = getCodeBlockCopyErrorMessage\(copyError\);)(?=[\s\S]*copyStatus === 'copied'[\s\S]*status: MessageRenderSnapshotStatus = 'code_copied'[\s\S]*source: MessageRenderSnapshotSource = 'clipboard')(?=[\s\S]*status: MessageRenderSnapshotStatus = 'code_idle'[\s\S]*source: MessageRenderSnapshotSource = 'code_block')/,
  'workspace code block message render snapshot helper should derive copy phases from copy status, error, language and content facts',
);
assert.match(
  messageRenderSnapshotSource,
  /(?=[\s\S]*MermaidMessageRenderSnapshotStatus)(?=[\s\S]*status: MermaidMessageRenderSnapshotStatus)(?=[\s\S]*function getMessageRenderSnapshotOptionalTextValue\(value: string \| undefined\): string)(?=[\s\S]*function getMermaidRenderErrorMessage\(error: string \| undefined\): string[\s\S]*getMessageRenderSnapshotOptionalTextValue\(error\)[\s\S]*getMessageRenderSnapshotFallbackTextValue\(errorValue, '未知渲染错误'\))(?=[\s\S]*export function buildMermaidMessageRenderSnapshot\([\s\S]*\): MessageRenderSnapshot \{)(?=[\s\S]*status === 'mermaid_failed'[\s\S]*source: MessageRenderSnapshotSource = 'mermaid_render'[\s\S]*const errorMessage = getMermaidRenderErrorMessage\(error\);)(?=[\s\S]*status === 'mermaid_rendering'[\s\S]*source: MessageRenderSnapshotSource = 'mermaid_render')(?=[\s\S]*status,[\s\S]*source,[\s\S]*language: 'mermaid')/,
  'workspace Mermaid message render snapshot helper should derive render phases from render status, error and content facts',
);
assert.match(
  workspaceClipboardLocalErrorsSource,
  /export type WorkspaceClipboardLocalErrorDetails = string;[\s\S]*const workspaceMissingClipboardMessage: WorkspaceClipboardLocalErrorDetails[\s\S]*const workspaceMissingClipboardDetails: WorkspaceClipboardLocalErrorDetails[\s\S]*export function formatWorkspaceClipboardError\([\s\S]*fallback: WorkspaceClipboardLocalErrorDetails,[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source: 'clipboard'[\s\S]*details,[\s\S]*\}, fallback\)/,
  'workspace clipboard local errors should format clipboard failures with named details contract',
);
assert.match(
  workspaceClipboardLocalErrorsSource,
  /export function formatWorkspaceMissingClipboardError\(\)[\s\S]*message: workspaceMissingClipboardMessage[\s\S]*source: 'clipboard'[\s\S]*details: workspaceMissingClipboardDetails[\s\S]*workspaceMissingClipboardMessage/,
  'workspace missing clipboard formatter should keep message/details under the named details contract',
);
assert.doesNotMatch(
  workspaceClipboardLocalErrorsSource,
  /fallback: string|details: 'navigator\.clipboard is unavailable'|message: '浏览器当前不支持剪贴板访问'/,
  'workspace clipboard local errors should not regress to raw fallback strings or inline missing clipboard literals',
);
assert.doesNotMatch(
  messageRenderSnapshotSource,
  /MessageRenderSnapshot\['status'\]|MessageRenderSnapshot\['source'\]|language \|\| 'code'|copyError \|\| '浏览器拒绝了剪贴板访问'|error \|\| '未知渲染错误'/,
  'workspace message render snapshot helper should not infer status/source from indexed snapshot access or regress language/error fallback to inline OR gates',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*import \{[\s\S]*buildCodeBlockMessageRenderSnapshot,[\s\S]*buildMermaidMessageRenderSnapshot,[\s\S]*type CodeBlockCopyStatus,[\s\S]*\} from "@\/app\/workspace\/workspace-message-render-snapshot";)(?=[\s\S]*function getMessageRenderSnapshotLanguageLabel\(language: string\)[\s\S]*const hasLanguage = language\.length > 0;)(?=[\s\S]*function getMarkdownCodeBlockLanguage\(className: string \| undefined\)[\s\S]*const languageClassName = className \?\? "";[\s\S]*const hasLanguage = language\.length > 0;)(?=[\s\S]*const hasLanguage = language\.length > 0;)(?=[\s\S]*const languageLabel = hasLanguage === true \? language : "code";)(?=[\s\S]*const isMermaidLanguage = language\.toLowerCase\(\) === "mermaid";)(?=[\s\S]*useState<CodeBlockCopyStatus>\("idle"\))(?=[\s\S]*const hasClipboard = navigator\.clipboard !== undefined;)(?=[\s\S]*const hasCopyError = copyError\.length > 0;)(?=[\s\S]*const copyErrorMessage = hasCopyError === true[\s\S]*\? copyError[\s\S]*: formatWorkspaceMissingClipboardError\(\);)(?=[\s\S]*const hasCopyFailed = copyStatus === "failed";)(?=[\s\S]*const renderSnapshot = buildCodeBlockMessageRenderSnapshot\(\{[\s\S]*copyStatus,[\s\S]*copyError,[\s\S]*language,[\s\S]*contentLength: rawCode\.length,)/,
  'workspace code block render surface should use shared copy status and snapshot helper with authoritative copy facts',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*const hasRenderCancelled = cancelled === true;)(?=[\s\S]*if \(hasRenderCancelled === false\))(?=[\s\S]*const hasError = error !== null;)(?=[\s\S]*const svgValue = svg \?\? "";)(?=[\s\S]*const hasSvg = svgValue\.length > 0;)(?=[\s\S]*if \(hasError === true\))(?=[\s\S]*const renderSnapshot = buildMermaidMessageRenderSnapshot\(\{[\s\S]*status: "mermaid_failed"[\s\S]*contentLength: source\.length,[\s\S]*error,[\s\S]*if \(hasSvg === false\)[\s\S]*const renderSnapshot = buildMermaidMessageRenderSnapshot\(\{[\s\S]*status: "mermaid_rendering"[\s\S]*contentLength: source\.length,[\s\S]*const renderSnapshot = buildMermaidMessageRenderSnapshot\(\{[\s\S]*status: "mermaid_rendered"[\s\S]*contentLength: source\.length,)/,
  'workspace Mermaid render surface should use shared snapshot helper with authoritative render facts',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /useState<["']idle["'] \| ["']copied["'] \| ["']failed["']>/,
  'workspace code block copy state should not regress to a component-local inline union',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*function getMarkdownPreFirstChild\(children: ReactNode\): ReactNode \| undefined \{[\s\S]*const childNodes = Children\.toArray\(children\);[\s\S]*for \(const child of childNodes\)[\s\S]*return child;[\s\S]*return undefined;)(?=[\s\S]*export function MarkdownContent\(\{ content \}: \{ content: string \}\)[\s\S]*const hasNormalizedContent = normalized\.length > 0;[\s\S]*if \(hasNormalizedContent === false\) return null;)(?=[\s\S]*const child = getMarkdownPreFirstChild\(children\);[\s\S]*const hasCodeChild = isValidElement<\{ className\?: string; children\?: React\.ReactNode \}>\(child\);[\s\S]*if \(hasCodeChild === false\))(?=[\s\S]*function normalizeCommitVersion\(value: string\)[\s\S]*const hasNormalizedVersion = normalized\.length > 0;[\s\S]*if \(hasNormalizedVersion === false\) return value\.trim\(\);)/,
  'workspace markdown content and commit summary helpers should derive normalized content, code child and hash gates through explicit facts',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /Children\.toArray\(children\)\[0\]/,
  'workspace markdown pre child reader should not regress to direct first child indexing',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /snapshot\.language \|\| "plain"|className\?\.replace\("language-", ""\) \|\| ""|if \(!cancelled\)|if \(error\)|if \(!svg\)|if \(!navigator\.clipboard\)|language \|\| "code"|copyError \|\| "浏览器拒绝了剪贴板访问"|if \(!normalized\) return null|if \(!isValidElement<\{ className\?: string; children\?: React\.ReactNode \}>\(child\)\)|if \(!normalized\) return value\.trim\(\);/,
  'workspace message render, markdown content and commit summary helpers should not regress to truthy language, clipboard, mermaid, normalized content or hash gates',
);
assert.match(
  workspaceTypesSource,
  /export type WorkflowSectionSnapshotStatus = 'running' \| 'failed' \| 'open' \| 'collapsed' \| 'empty_lines';[\s\S]*export type WorkflowSectionSnapshotSource = 'workflow_steps' \| 'streaming' \| 'user_toggle' \| 'display_filter';[\s\S]*export type WorkflowSectionKind = 'file_ops' \| 'other';[\s\S]*export type WorkflowSectionSnapshot = \{[\s\S]*status: WorkflowSectionSnapshotStatus;[\s\S]*source: WorkflowSectionSnapshotSource;[\s\S]*sectionKind: WorkflowSectionKind;[\s\S]*stepCount: number;[\s\S]*runningCount: number;[\s\S]*failedCount: number;[\s\S]*visibleLineCount: number;[\s\S]*isOpen: boolean;[\s\S]*recovery: string;/,
  'workspace workflow section state should be represented as a structured snapshot with phase, source, counts, open state and recovery fields',
);
assert.match(
  chatMessageContentSource,
  /import type \{[\s\S]*WorkflowSectionKind,[\s\S]*WorkflowSectionSnapshot,[\s\S]*\} from "@\/app\/workspace\/workspace-types";[\s\S]*function getWorkflowSectionKind\(step: WorkflowStep\): WorkflowSectionKind/,
  'workspace workflow section rendering should consume the central workflow section kind contract',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /type WorkflowSectionKind = ["']file_ops["'] \| ["']other["'];/,
  'workspace workflow section rendering should not regress section kind to a local inline union',
);
assert.match(
  chatMessageContentSource,
  /export type WorkflowStepStatus = "pending" \| "running" \| "done" \| "failed";[\s\S]*export type WorkflowStep = \{[\s\S]*status\?: WorkflowStepStatus;/,
  'workspace workflow steps should expose a named status contract consumed by message and workflow snapshot helpers',
);
assert.match(
  chatMessageContentSource,
  /export type WorkflowStepMeta = \{[\s\S]*\[fieldName: string\]: unknown;[\s\S]*\};[\s\S]*export type WorkflowStep = \{[\s\S]*meta\?: WorkflowStepMeta;/,
  'workspace workflow steps should expose a named meta map contract instead of anonymous Record metadata',
);
assert.match(
  workspaceMessageActionsHookSource,
  /import type \{[\s\S]*WorkflowStep,[\s\S]*WorkflowStepMeta,[\s\S]*\} from '@\/components\/workspace\/chat-message-content';[\s\S]*function getWorkspaceMessageActionWorkflowStepMeta\([\s\S]*meta: WorkflowStepMeta \| undefined,[\s\S]*\): WorkflowStepMeta[\s\S]*function getWorkspaceMessageActionNextWorkflowStepMeta\([\s\S]*nextMeta: WorkflowStepMeta,[\s\S]*step: WorkflowStep,[\s\S]*\): WorkflowStepMeta \| undefined[\s\S]*const existingMeta = getWorkspaceMessageActionWorkflowStepMeta\(existingStep\.meta\);[\s\S]*const nextMeta: WorkflowStepMeta = \{[\s\S]*\.\.\.existingMeta,[\s\S]*\.\.\.getWorkspaceMessageActionWorkflowStepMeta\(step\.meta\),[\s\S]*const nextMeta: WorkflowStepMeta = \{[\s\S]*\.\.\.getWorkspaceMessageActionWorkflowStepMeta\(step\.meta\),[\s\S]*meta: getWorkspaceMessageActionNextWorkflowStepMeta\(nextMeta, step\),/,
  'workspace message actions should merge workflow step metadata through WorkflowStepMeta',
);
assert.match(
  `${workspaceTypesSource}\n${helperSource}`,
  /export type WorkspaceRestoredMessagePayload = \{[\s\S]*workflowSteps\?: WorkspaceWorkflowStepEventData\[\];[\s\S]*engineeringState\?: WorkspaceStreamEventData;[\s\S]*function materializeWorkspaceWorkflowStepMeta\(rawMeta: WorkspaceStreamEventData\): WorkspaceStreamEventData \{[\s\S]*for \(const \[key, value\] of Object\.entries\(rawMeta\)\)[\s\S]*meta\[key\] = sanitizeWorkspaceText\(value\);[\s\S]*function getWorkflowStepMeta\(meta: WorkflowStepMeta \| undefined\): WorkflowStepMeta \{[\s\S]*\.\.\.getWorkflowStepMeta\(step\.meta\),[\s\S]*\.\.\.getWorkflowStepMeta\(merged\[index\]\.meta\),/,
  'workspace message restore helper should deserialize workflow step and engineering state payloads through named restore payload and WorkflowStepMeta contracts',
);
assert.match(
  workspaceTypesSource,
  /export type WorkspaceRestoredMessagePayload = \{[\s\S]*kind\?: WorkspaceChatMessageKind;[\s\S]*content\?: string;[\s\S]*plans\?: Plan\[\];[\s\S]*suggestedQuestions\?: WorkspaceSuggestedQuestionList;[\s\S]*suggestedActions\?: GuidanceAction\[\];[\s\S]*workflowSteps\?: WorkspaceWorkflowStepEventData\[\];[\s\S]*engineeringState\?: WorkspaceStreamEventData;[\s\S]*streaming\?: boolean;[\s\S]*\};/,
  'workspace restored ProjectMessage payload should be represented by a named restore payload contract',
);
assert.match(
  helperSource,
  /WorkspaceRestoredMessagePayload[\s\S]*const parsed = JSON\.parse\(message\.content\) as WorkspaceRestoredMessagePayload;/,
  'workspace message restore helper should parse ProjectMessage content through WorkspaceRestoredMessagePayload',
);
assert.match(
  helperSource,
  /(?=[\s\S]*const hasRecoveryRetry = hasEngineeringStateRestoreRecoveryRetry\(recovery\);)(?=[\s\S]*const retryPrompt = getEngineeringStateRestoreRetryPrompt\(recovery\);)(?=[\s\S]*const hasRetryPrompt = hasEngineeringStateRestoreTextValue\(retryPrompt\);)(?=[\s\S]*label: hasRetryLabel === true \? retryLabel : '修复后重试')(?=[\s\S]*mode: getEngineeringStateRestoreRecoveryMode\(recovery\))(?=[\s\S]*conversationStage: getEngineeringStateRestoreRecoveryStage\(recovery\))(?=[\s\S]*function getEngineeringStateRestorePhaseStatus\(engineeringState: WorkspaceEngineeringStateSnapshot\): string \{[\s\S]*const phase = engineeringState\.phase;[\s\S]*const hasPhase = phase !== undefined;[\s\S]*hasPhase === false[\s\S]*return 'unknown';[\s\S]*const phaseStatus = phase\.status;[\s\S]*const hasPhaseStatus = phaseStatus !== undefined;[\s\S]*hasPhaseStatus === false[\s\S]*return 'unknown';[\s\S]*return phaseStatus;)(?=[\s\S]*function getEngineeringStateRestorePhaseLabel\(\{[\s\S]*hasCurrentPhase: boolean;[\s\S]*hasCurrentTask: boolean;[\s\S]*if \(hasCurrentPhase === true\)[\s\S]*if \(hasCurrentTask === true\)[\s\S]*return `\$\{currentPhase\} \/ \$\{currentTask\}`;)(?=[\s\S]*function getEngineeringStateRestoreNextAction\(\{[\s\S]*hasPhaseNextAction: boolean;[\s\S]*hasExecutionNextAction: boolean;[\s\S]*hasRetryLabel: boolean;[\s\S]*return foundationNextAction;)(?=[\s\S]*function getEngineeringStateRestoreDetailSegments\(\{[\s\S]*hasRecoveryReason: boolean;[\s\S]*hasNextAction: boolean;[\s\S]*const segments: string\[\] = \[\];[\s\S]*segments\.push\(`阻断原因：\$\{recoveryReason\}`\);[\s\S]*segments\.push\(`下一步：\$\{nextAction\}`\);)(?=[\s\S]*const currentPhase = getEngineeringStateRestoreCurrentPhase\(phase\);)(?=[\s\S]*const hasCurrentPhase = hasEngineeringStateRestoreTextValue\(currentPhase\);)(?=[\s\S]*const phaseLabel = getEngineeringStateRestorePhaseLabel\(\{[\s\S]*currentPhase,[\s\S]*hasCurrentPhase,[\s\S]*currentTask,[\s\S]*hasCurrentTask,[\s\S]*\}\);)(?=[\s\S]*const hasRecoveryReason = hasEngineeringStateRestoreTextValue\(recoveryReason\);)(?=[\s\S]*const nextAction = getEngineeringStateRestoreNextAction\(\{[\s\S]*phaseNextAction,[\s\S]*hasPhaseNextAction,[\s\S]*executionNextAction,[\s\S]*hasExecutionNextAction,[\s\S]*retryLabel,[\s\S]*hasRetryLabel,[\s\S]*foundationNextAction,[\s\S]*\}\);)(?=[\s\S]*const detailSegments = getEngineeringStateRestoreDetailSegments\(\{[\s\S]*hasRecoveryReason,[\s\S]*recoveryReason,[\s\S]*hasNextAction,[\s\S]*nextAction,[\s\S]*\}\);)(?=[\s\S]*const phaseStatus = getEngineeringStateRestorePhaseStatus\(engineeringState\);)(?=[\s\S]*detail: hasDetailSegments === true \? detailSegments\.join\('；'\) : '已从项目详情恢复最新工程状态。')(?=[\s\S]*function getWorkspaceReasoningLineList\(current: string\): string\[\] \{[\s\S]*for \(const line of current\.split\('\\n'\)\)[\s\S]*lines\.push\(normalizedLine\);)(?=[\s\S]*function hasWorkspaceReasoningLine\(existingLines: string\[\], normalizedNextLine: string\): boolean \{[\s\S]*for \(const existingLine of existingLines\)[\s\S]*return true;)(?=[\s\S]*const existingLines = getWorkspaceReasoningLineList\(normalizedCurrent\);)(?=[\s\S]*const hasExistingLine = hasWorkspaceReasoningLine\(existingLines, normalizedNextLine\);)(?=[\s\S]*function hasWorkspaceFileTreeExtensionSeparator\(path: string\): boolean \{[\s\S]*for \(const character of path\)[\s\S]*character === '\.';)(?=[\s\S]*const segments = getWorkspaceFileTreePathSegments\(filePath\);)(?=[\s\S]*for \(const segment of filePath\.split\('\/'\)\)[\s\S]*segments\.push\(normalizedSegment\);)(?=[\s\S]*function materializeNormalizedWorkspaceFileNodeChildren\(children: FileNode\[\]\): FileNode\[\] \{[\s\S]*for \(const child of children\)[\s\S]*const normalizedChild = normalizeFileNode\(child\);[\s\S]*shouldKeepNormalizedWorkspaceFileNode\(normalizedChild\)[\s\S]*normalizedChildren\.push\(normalizedChild\);)(?=[\s\S]*function getWorkspaceFileTreeNodeIndex\(nodes: FileNode\[\], path: string\): number \{[\s\S]*for \(let index = 0; index < nodes\.length; index \+= 1\)[\s\S]*return index;)(?=[\s\S]*function materializeWorkspaceFileTreeNodeList\(nodes: FileNode\[\]\): FileNode\[\] \{[\s\S]*for \(const node of nodes\)[\s\S]*nextNodes\.push\(node\);)(?=[\s\S]*const existingIndex = getWorkspaceFileTreeNodeIndex\(currentNodes, currentPath\);)(?=[\s\S]*const nextNodes = materializeWorkspaceFileTreeNodeList\(currentNodes\);)(?=[\s\S]*const hasParentPath = hasWorkspaceFileTreeParentPath\(parentPath\);)(?=[\s\S]*const hasNormalizedFromPath = normalizedFromPath\.length > 0;)(?=[\s\S]*function isWorkspaceGeneratedFile\(value: unknown\): value is WorkspaceGeneratedFile \{[\s\S]*const file = value as \{ path\?: unknown; content\?: unknown \};[\s\S]*return typeof file\.path === 'string' && typeof file\.content === 'string';)(?=[\s\S]*for \(const file of files\)[\s\S]*const isGeneratedFile = isWorkspaceGeneratedFile\(file\);[\s\S]*generatedFiles\.push\(file\);)(?=[\s\S]*if \(raw === null \|\| raw === undefined \|\| typeof raw !== 'object'\) return null;)(?=[\s\S]*function isWorkflowStep\(value: WorkflowStep \| null\): value is WorkflowStep)(?=[\s\S]*function materializeWorkspaceWorkflowStepMeta\(rawMeta: WorkspaceStreamEventData\): WorkspaceStreamEventData \{[\s\S]*for \(const \[key, value\] of Object\.entries\(rawMeta\)\)[\s\S]*meta\[key\] = sanitizeWorkspaceText\(value\);)(?=[\s\S]*function materializeNormalizedWorkflowSteps\(rawSteps: WorkspaceRestoredMessagePayload\['workflowSteps'\]\): WorkflowStep\[\] \{[\s\S]*for \(const step of rawSteps\)[\s\S]*normalizedSteps\.push\(normalizedStep\);)(?=[\s\S]*function normalizeWorkflowSteps\(rawSteps: WorkspaceRestoredMessagePayload\['workflowSteps'\]\): WorkflowStep\[\] \| undefined)(?=[\s\S]*const normalizedSteps = materializeNormalizedWorkflowSteps\(rawSteps\);)(?=[\s\S]*const hasParsedPayload = parsed !== null && typeof parsed === 'object';)(?=[\s\S]*workflowSteps: normalizeWorkflowSteps\(parsed\.workflowSteps\))(?=[\s\S]*const nextSessionMessages = getRestoredWorkspaceSessionMessages\(sessionMessages\);)(?=[\s\S]*const hasSessionMessages = hasRestoredWorkspaceMessageList\(nextSessionMessages\);)(?=[\s\S]*const baseMessages = materializeRestoredWorkspaceBaseMessages\(restoredMessages\);)(?=[\s\S]*const existingIdentityKeys = materializeRestoredWorkspaceIdentityIndexes\(baseMessages\);)(?=[\s\S]*const idIndex = getRestoredWorkspaceMessageIndex\(baseMessages, message\.id\);)(?=[\s\S]*reasoningContent: getMergedRestoredWorkspaceMessageValue\()(?=[\s\S]*const existingSteps = getWorkflowStepList\(existing\);)(?=[\s\S]*const hasExistingSteps = hasWorkflowStepList\(existingSteps\);)(?=[\s\S]*const merged = materializeWorkflowStepList\(existingSteps\);)(?=[\s\S]*const stepIndexes = materializeWorkflowStepIndexes\(merged\);)(?=[\s\S]*getWorkflowStepMeta\(step\.meta\))(?=[\s\S]*if \(restoredState === undefined\) return sessionState;)(?=[\s\S]*const hasEngineeringState = message\.engineeringState !== undefined;)(?=[\s\S]*const workflowSteps = getWorkspaceMessageWorkflowSteps\(message\);)(?=[\s\S]*const hasWorkflowSteps = hasWorkflowStepList\(workflowSteps\);)(?=[\s\S]*getWorkspaceMessageKind\(message\))(?=[\s\S]*return materializeNormalizedFileTreePayload\(tree\);)(?=[\s\S]*function materializeNormalizedFileTreePayload\(tree: FileNode\[\]\): FileNode\[\] \{[\s\S]*for \(const node of tree\)[\s\S]*const normalizedNode = normalizeFileNode\(node\);[\s\S]*shouldKeepNormalizedWorkspaceFileNode\(normalizedNode\)[\s\S]*normalizedTree\.push\(normalizedNode\);)/,
  'workspace page helpers should derive recovery, path, workflow-step restore and supplemental message gates through explicit facts',
);
assert.doesNotMatch(
  helperSource,
  /!recovery\?\.can_retry|!recovery\.retry_prompt\?\.trim\(\)|recovery\.retry_label\?\.trim\(\) \|\| '修复后重试'|\[phase\?\.current_phase, phase\?\.current_task\]\.filter\(Boolean\)|phase\?\.status \?\? 'unknown'|recovery\?\.reason_message \|\| recovery\?\.reason_code|phase\?\.next_action[\s\S]{0,80}\|\| engineeringState\.execution\?\.next_action|recoveryReason \?|children\.map\(\(child\) => normalizeFileNode\(child\)\)|currentNodes\.findIndex\(|const nextNodes = \[\.\.\.currentNodes\]|Object\.fromEntries\([\s\S]{0,240}Object\.entries\(raw\.meta as WorkspaceStreamEventData\)\.map|\.filter\(Boolean\) as WorkflowStep\[\]|rawSteps[\s\S]{0,120}\.map\(\(step\) => normalizeWorkflowStep\(step\)\)[\s\S]{0,120}\.filter\(isWorkflowStep\)|baseMessages\.forEach\(|nextSessionMessages\.forEach\(|baseMessages\.findIndex\(|new Map\(merged\.map|incomingSteps\.forEach\(|tree\.map\(\(node\) => normalizeFileNode\(node\)\)|Boolean\(message\.(?:engineeringState|gateResult)|Boolean\(message\.workflowSteps\?\.length\)|reasoningContent: restoredMessage\.reasoningContent \|\| sessionMessage\.reasoningContent|statusContent: restoredMessage\.statusContent \|\| sessionMessage\.statusContent|gateResult: restoredMessage\.gateResult \|\| sessionMessage\.gateResult|step\.meta \|\| \{\}|message\.kind \|\| ''|parentPath \?|sessionMessages \?\? \[\]|existing \?\? \[\]|incoming \?\? \[\]|message\.workflowSteps\?\.length \?\? 0|message\.kind \?\? ''|plans: parsed\.plans \?\? \[\]|\.filter\(\(line\) => line\.length > 0\)|existingLines\.includes\(normalizedNextLine\)|normalized\.includes\('\.'\)|\.filter\(isWorkspaceGeneratedFile\)|\.filter\(\(node\) => node\.path !== normalizedTargetPath\)/,
  'workspace page helpers should not regress to implicit recovery, path, workflow-step or supplemental message gates',
);
assert.doesNotMatch(
  `${chatMessageContentSource}\n${workspaceMessageActionsHookSource}\n${helperSource}`,
  /meta\?: Record<string, unknown>|const existingMeta = .*Record<string, unknown>|const nextMeta: Record<string, unknown>|workflowSteps\?: Record<string, unknown>\[\]|engineeringState\?: Record<string, unknown>/,
  'workspace workflow step metadata and restored workflow payloads should not regress to anonymous Record contracts',
);
assert.doesNotMatch(
  helperSource,
  /JSON\.parse\(message\.content\) as \{[\s\S]*kind\?: WorkspaceChatMessageKind;[\s\S]*workflowSteps\?: WorkspaceWorkflowStepEventData\[\];[\s\S]*engineeringState\?: WorkspaceStreamEventData;/,
  'workspace message restore helper should not regress ProjectMessage content parsing to an inline payload object',
);
assert.match(
  workflowSectionSnapshotSource,
  /import type \{ WorkflowStepStatus \} from '@\/components\/workspace\/chat-message-content';[\s\S]*type WorkflowSectionSnapshotStep = \{[\s\S]*status\?: WorkflowStepStatus;/,
  'workspace workflow section snapshot helper should consume the named workflow step status contract',
);
assert.match(
  chatMessageSnapshotSource,
  /import type \{ WorkflowStepStatus \} from '@\/components\/workspace\/chat-message-content';[\s\S]*type ChatMessageSnapshotStep = \{[\s\S]*status\?: WorkflowStepStatus;/,
  'workspace chat message snapshot helper should consume the named workflow step status contract',
);
assert.doesNotMatch(
  `${chatMessageContentSource}\n${workflowSectionSnapshotSource}\n${chatMessageSnapshotSource}`,
  /status\?: ['"]pending['"] \| ['"]running['"] \| ['"]done['"] \| ['"]failed['"];/,
  'workspace workflow step status should not regress to duplicated inline unions',
);
assert.match(
  chatMessageContentSource,
  /function getWorkspaceChatSnapshotBooleanLabel\(value: boolean\): string \{[\s\S]*return value === true \? "yes" : "no";[\s\S]*\}/,
  'workspace chat snapshot strips should derive yes-no display labels through a local boolean label helper',
);
assert.match(
  chatMessageContentSource,
  /function ValidationGateBlockedSnapshotStrip\(\{ snapshot \}: \{ snapshot: ValidationGateBlockedSnapshot \}\) \{[\s\S]*const canOpenRepairTargetLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.canOpenRepairTarget\);[\s\S]*<span>CanOpen: \{canOpenRepairTargetLabel\}<\/span>/,
  'workspace validation gate blocked snapshot strip should render can-open through a named boolean display label',
);
assert.match(
  chatMessageContentSource,
  /function WorkflowSectionSnapshotStrip\(\{ snapshot \}: \{ snapshot: WorkflowSectionSnapshot \}\) \{[\s\S]*const isOpenLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.isOpen\);[\s\S]*<span>Open: \{isOpenLabel\}<\/span>/,
  'workspace workflow section snapshot strip should render open state through a named boolean display label',
);
assert.match(
  chatMessageContentSource,
  /function ChatMessageSnapshotStrip\(\{ snapshot \}: \{ snapshot: ChatMessageSnapshot \}\) \{[\s\S]*const hasEngineeringStateLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.hasEngineeringState\);[\s\S]*const isStreamingLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.isStreaming\);[\s\S]*<span>Engineering: \{hasEngineeringStateLabel\}<\/span>[\s\S]*<span>Streaming: \{isStreamingLabel\}<\/span>/,
  'workspace chat message snapshot strip should render engineering and streaming states through named boolean display labels',
);
assert.match(
  chatMessageContentSource,
  /function ChatThoughtProcessSnapshotStrip\(\{ snapshot \}: \{ snapshot: ChatThoughtProcessSnapshot \}\) \{[\s\S]*const isOpenLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.isOpen\);[\s\S]*<span>Open: \{isOpenLabel\}<\/span>/,
  'workspace chat thought process snapshot strip should render open state through a named boolean display label',
);
assert.match(
  chatMessageContentSource,
  /function CommitSummarySnapshotStrip\(\{ snapshot \}: \{ snapshot: CommitSummarySnapshot \}\) \{[\s\S]*const hasMessageLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.hasMessage\);[\s\S]*const canRestoreLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.canRestore\);[\s\S]*const canViewLabel = getWorkspaceChatSnapshotBooleanLabel\(snapshot\.canView\);[\s\S]*<span>Summary: \{hasMessageLabel\}<\/span>[\s\S]*<span>Restore: \{canRestoreLabel\}<\/span>[\s\S]*<span>View: \{canViewLabel\}<\/span>/,
  'workspace commit summary snapshot strip should render summary and action availability through named boolean display labels',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /snapshot\.(?:canOpenRepairTarget|isOpen|hasEngineeringState|isStreaming|hasMessage|canRestore|canView) \? "yes" : "no"/,
  'workspace chat snapshot strips should not regress to inline yes-no display gates',
);
assert.match(
  workflowSectionSnapshotSource,
  /(?=[\s\S]*WorkflowSectionKind)(?=[\s\S]*WorkflowSectionSnapshotSource)(?=[\s\S]*WorkflowSectionSnapshotStatus)(?=[\s\S]*function getWorkflowSectionSnapshotStepStatusCount\([\s\S]*displaySteps: WorkflowSectionSnapshotStep\[\],[\s\S]*status: WorkflowStepStatus,[\s\S]*\): number[\s\S]*for \(const step of displaySteps\)[\s\S]*const hasTargetStatus = stepStatus === status;[\s\S]*if \(hasTargetStatus === true\))(?=[\s\S]*function getWorkflowSectionSnapshotStatus\([\s\S]*runningCount: number;[\s\S]*failedCount: number;[\s\S]*visibleLineCount: number;[\s\S]*open: boolean;[\s\S]*\): WorkflowSectionSnapshotStatus)(?=[\s\S]*function getWorkflowSectionSnapshotSource\([\s\S]*visibleLineCount: number;[\s\S]*source: WorkflowSectionSnapshotSource;[\s\S]*\): WorkflowSectionSnapshotSource)(?=[\s\S]*function getWorkflowSectionSnapshotMessage\([\s\S]*status: WorkflowSectionSnapshotStatus;[\s\S]*open: boolean;[\s\S]*\): string)(?=[\s\S]*function getWorkflowSectionSnapshotRecovery\([\s\S]*status: WorkflowSectionSnapshotStatus;[\s\S]*open: boolean;[\s\S]*\): string)(?=[\s\S]*export function buildWorkflowSectionSnapshot\([\s\S]*\): WorkflowSectionSnapshot \{)(?=[\s\S]*const runningCount = getWorkflowSectionSnapshotStepStatusCount\(displaySteps, 'running'\);)(?=[\s\S]*const failedCount = getWorkflowSectionSnapshotStepStatusCount\(displaySteps, 'failed'\);)(?=[\s\S]*const status = getWorkflowSectionSnapshotStatus\(\{[\s\S]*runningCount,[\s\S]*failedCount,[\s\S]*visibleLineCount,[\s\S]*open,[\s\S]*\}\);)(?=[\s\S]*const snapshotSource = getWorkflowSectionSnapshotSource\(\{[\s\S]*visibleLineCount,[\s\S]*source,[\s\S]*\}\);)(?=[\s\S]*const message = getWorkflowSectionSnapshotMessage\(\{[\s\S]*status,[\s\S]*open,[\s\S]*\}\);)(?=[\s\S]*const recovery = getWorkflowSectionSnapshotRecovery\(\{[\s\S]*status,[\s\S]*open,[\s\S]*\}\);)/,
  'workspace workflow section snapshot helper should derive all workflow section phases from step, visible line and open facts',
);
assert.doesNotMatch(
  workflowSectionSnapshotSource,
  /WorkflowSectionSnapshot\['status'\]|WorkflowSectionSnapshot\['source'\]|WorkflowSectionSnapshot\['sectionKind'\]|displaySteps\.filter\(\(step\) => step\.status === ['"](?:running|failed)['"]\)\.length|status: WorkflowSectionSnapshotStatus = runningCount > 0|visibleLineCount === 0 \? ['"]display_filter['"] : source|message: status === ['"]running['"]|recovery: status === ['"]failed['"]/,
  'workspace workflow section snapshot helper should not infer status/source/kind from indexed snapshot access or inline count/status/message gates',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*WorkflowSectionSnapshotSource)(?=[\s\S]*import \{ buildWorkflowSectionSnapshot \} from "@\/app\/workspace\/workspace-workflow-section-snapshot";)(?=[\s\S]*type WorkflowStepSection = \{[\s\S]*kind: WorkflowSectionKind;[\s\S]*steps: WorkflowStep\[\];)(?=[\s\S]*const WORKFLOW_SECTION_ORDER: WorkflowSectionKind\[\] = \["file_ops", "other"\];)(?=[\s\S]*function getWorkflowSectionSteps\(steps: WorkflowStep\[\], kind: WorkflowSectionKind\): WorkflowStep\[\][\s\S]*for \(const step of steps\)[\s\S]*const isTargetKind = stepKind === kind;[\s\S]*if \(isTargetKind === true\))(?=[\s\S]*function getWorkflowStepSections\(steps: WorkflowStep\[\]\): WorkflowStepSection\[\][\s\S]*for \(const kind of WORKFLOW_SECTION_ORDER\)[\s\S]*const hasSectionSteps = sectionSteps\.length > 0;[\s\S]*if \(hasSectionSteps === true\))(?=[\s\S]*function getWorkflowStepDisplayStatusForMessage\(\{[\s\S]*isStreaming === false && step\.status === "running"[\s\S]*return "done";[\s\S]*return getWorkflowStepDisplayStatus\(step, statusNow\);)(?=[\s\S]*function getWorkflowSectionDisplaySteps\(steps: WorkflowStep\[\], statusNow: number, isStreaming: boolean\): WorkflowStep\[\][\s\S]*for \(const step of steps\)[\s\S]*status: getWorkflowStepDisplayStatusForMessage\(\{[\s\S]*step,[\s\S]*statusNow,[\s\S]*isStreaming,)(?=[\s\S]*function hasWorkflowSectionRunningStep\(displaySteps: WorkflowStep\[\]\): boolean[\s\S]*for \(const step of displaySteps\)[\s\S]*const isRunning = step\.status === "running";[\s\S]*if \(isRunning === true\))(?=[\s\S]*function shouldOpenWorkflowSectionInitially\([\s\S]*isStreaming: boolean;[\s\S]*hasRunning: boolean;[\s\S]*\): boolean[\s\S]*if \(isStreaming === true\)[\s\S]*return hasRunning === true;)(?=[\s\S]*function getWorkflowSectionActiveSnapshotSource\(isStreaming: boolean\): WorkflowSectionSnapshotSource[\s\S]*if \(isStreaming === true\)[\s\S]*return "workflow_steps";)(?=[\s\S]*function getWorkflowSectionInitialSnapshotSource\([\s\S]*shouldOpenInitially: boolean;[\s\S]*\): WorkflowSectionSnapshotSource[\s\S]*getWorkflowSectionActiveSnapshotSource\(isStreaming\))(?=[\s\S]*function getWorkflowSectionVisibleLines\(displaySteps: WorkflowStep\[\]\): string\[\][\s\S]*for \(const step of displaySteps\)[\s\S]*const hasLine = line\.length > 0;[\s\S]*if \(hasLine === true\))(?=[\s\S]*const sections = useMemo\(\(\) => getWorkflowStepSections\(steps\), \[steps\]\);)(?=[\s\S]*const displaySteps = useMemo\([\s\S]*getWorkflowSectionDisplaySteps\(steps, statusNow, isStreaming\))(?=[\s\S]*const hasRunning = hasWorkflowSectionRunningStep\(displaySteps\);)(?=[\s\S]*const shouldOpenInitially = shouldOpenWorkflowSectionInitially\(\{[\s\S]*isStreaming,[\s\S]*hasRunning,)(?=[\s\S]*useState<WorkflowSectionSnapshotSource>\([\s\S]*getWorkflowSectionInitialSnapshotSource\(\{[\s\S]*isStreaming,[\s\S]*shouldOpenInitially,)(?=[\s\S]*setSnapshotSource\(getWorkflowSectionActiveSnapshotSource\(isStreaming\)\);)(?=[\s\S]*const lines = getWorkflowSectionVisibleLines\(displaySteps\);)(?=[\s\S]*const shouldRenderActiveOperation = isStreaming === true && hasActiveOperation === true;)(?=[\s\S]*const canOpenWorkflowStep = hasPath === true && hasOpenFileAction === true;)(?=[\s\S]*const sectionSnapshot = buildWorkflowSectionSnapshot\(\{[\s\S]*kind,[\s\S]*displaySteps,[\s\S]*visibleLineCount: lines\.length,[\s\S]*open,[\s\S]*source: snapshotSource,)/,
  'workspace workflow section should derive grouping, display steps, running fact, source and visible lines through named helpers before building the shared snapshot',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /WorkflowSectionSnapshot\["source"\]|WorkflowSectionSnapshot\['source'\]|steps\.filter\(\(step\) => getWorkflowSectionKind\(step\) === kind\)|\.filter\(\(section\) => section\.steps\.length > 0\)|steps\.map\(\(step\) => \(\{[\s\S]*status: getWorkflowStepDisplayStatus\(step, statusNow\)|displaySteps\.some\(\(step\) => step\.status === "running"\)|shouldOpenInitially === true \? "streaming" : "workflow_steps"|isStreaming === true \? "streaming" : "workflow_steps"|const lines = displaySteps[\s\S]*\.filter\(\(line\) => line\.length > 0\);/,
  'workspace workflow section component should not regress to indexed snapshot source, inline section/display step materializers, running scan, source ternary or visible line filter',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /const \[open, setOpen\] = useState\(Boolean\(streaming\) \|\| hasRunning\)|streaming \|\| hasRunning \? "streaming" : "workflow_steps"|const actualStatus = step\.status \|\| "done"|\.filter\(Boolean\)|streaming && activeOperation|if \(!line\) return null|Boolean\(path && onOpenFile\)|onOpenFile\?\.\(path\)/,
  'workspace workflow section should not regress to truthy streaming, status, line, active operation or open-file gates',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*import type \{ ReactNode \} from "react";)(?=[\s\S]*function materializeEngineeringStatePanelRowNodes\(rows: EngineeringStateRow\[\]\): ReactNode\[\][\s\S]*for \(const row of rows\)[\s\S]*rowNodes\.push\()(?=[\s\S]*type ValidationFailureItemNodeMaterializerInput = \{[\s\S]*validationFailureItems: WorkspaceValidationFailureItem\[\];[\s\S]*hasOpenFileAction: boolean;[\s\S]*onOpenFile\?: \(target: string \| WorkspaceEditorNavigationTarget\) => void;[\s\S]*\};)(?=[\s\S]*function materializeValidationFailureItemNodes\([\s\S]*\): ReactNode\[\][\s\S]*for \(let index = 0; index < validationFailureItems\.length; index \+= 1\)[\s\S]*itemNodes\.push\()(?=[\s\S]*function materializeContextGateRepairTargetDescriptionNodes\([\s\S]*contextGateRepairTargets: ContextGateRepairTarget\[\],[\s\S]*\): ReactNode\[\][\s\S]*for \(const item of contextGateRepairTargets\)[\s\S]*repairTargetNodes\.push\()(?=[\s\S]*function materializeContextGateRepairTargetActionNodes\([\s\S]*\): ReactNode\[\][\s\S]*for \(const target of contextGateRepairTargets\)[\s\S]*repairTargetNodes\.push\()(?=[\s\S]*function getWorkflowSectionStatusRefreshWaitUntil\(steps: WorkflowStep\[\], statusNow: number\): number \| null[\s\S]*for \(const step of steps\)[\s\S]*return waitUntil;)(?=[\s\S]*function materializeWorkflowSectionNodes\([\s\S]*\): ReactNode\[\][\s\S]*for \(const section of sections\)[\s\S]*sectionNodes\.push\()(?=[\s\S]*function materializeWorkflowStepNodes\([\s\S]*\): ReactNode\[\][\s\S]*for \(let index = 0; index < displaySteps\.length; index \+= 1\)[\s\S]*stepNodes\.push\()(?=[\s\S]*const rowNodes = materializeEngineeringStatePanelRowNodes\(rows\);)(?=[\s\S]*const validationFailureItemNodes = materializeValidationFailureItemNodes\(\{[\s\S]*validationFailureItems,[\s\S]*hasOpenFileAction,[\s\S]*onOpenFile,[\s\S]*\}\);)(?=[\s\S]*const contextGateRepairTargetDescriptionNodes = materializeContextGateRepairTargetDescriptionNodes\()(?=[\s\S]*const contextGateRepairTargetActionNodes = materializeContextGateRepairTargetActionNodes\(\{)(?=[\s\S]*const sectionNodes = materializeWorkflowSectionNodes\(\{[\s\S]*sections,[\s\S]*streaming,[\s\S]*activeOperation,[\s\S]*onOpenFile,[\s\S]*\}\);)(?=[\s\S]*const waitUntil = getWorkflowSectionStatusRefreshWaitUntil\(steps, statusNow\);)(?=[\s\S]*const workflowStepNodes = materializeWorkflowStepNodes\(\{[\s\S]*kind,[\s\S]*displaySteps,[\s\S]*hasOpenFileAction,[\s\S]*onOpenFile,[\s\S]*\}\);)/,
  'workspace chat message render nodes and workflow refresh timing should be materialized through named ReactNode helpers and explicit scans',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /rows\.map\(|validationFailureItems\.map\(|contextGateRepairTargets\.map\(|sections\.map\(|displaySteps\.map\(|steps\.reduce</,
  'workspace chat message render nodes and workflow refresh timing should not regress to inline JSX map or reduce scans',
);
assert.match(
  workspaceTypesSource,
  /ChatMessageRole as SharedChatMessageRole[\s\S]*FileAttachment[\s\S]*export type ChatMessageSnapshotStatus = 'user_message' \| 'system_message' \| 'assistant_streaming' \| 'workflow_running' \| 'workflow_failed' \| 'engineering_failed' \| 'guidance_available' \| 'commit_attached' \| 'content_only' \| 'empty_message';[\s\S]*export type ChatMessageSnapshotSource = 'message_role' \| 'streaming' \| 'workflow_steps' \| 'engineering_state' \| 'guidance' \| 'commit' \| 'content';[\s\S]*export type ChatMessageRole = SharedChatMessageRole;[\s\S]*export type ChatMessageSnapshot = \{[\s\S]*status: ChatMessageSnapshotStatus;[\s\S]*source: ChatMessageSnapshotSource;[\s\S]*role: ChatMessageRole;[\s\S]*workflowStepCount: number;[\s\S]*visibleStepCount: number;[\s\S]*suggestedQuestionCount: number;[\s\S]*guidanceActionCount: number;[\s\S]*hasEngineeringState: boolean;[\s\S]*isStreaming: boolean;[\s\S]*recovery: string;[\s\S]*export type WorkspaceChatMessageKind = 'text' \| 'plan-options' \| 'workflow';[\s\S]*export type WorkspaceChatMessage = \{[\s\S]*id: string;[\s\S]*role: ChatMessageRole;[\s\S]*content: string;[\s\S]*timestamp: string \| Date;[\s\S]*attachments\?: FileAttachment\[\];[\s\S]*kind\?: WorkspaceChatMessageKind;/,
  'workspace chat message state should consume shared role, shared attachments and named kind contracts while explicitly listing the Workspace message fields',
);
assert.doesNotMatch(
  workspaceTypesSource,
  /export type ChatMessageRole = 'user' \| 'assistant' \| 'system';|role: 'user' \| 'assistant' \| 'system';|kind\?: 'text' \| 'plan-options' \| 'workflow';|WorkspaceChatMessage = Omit<ChatMessage, 'role'>|WorkspaceChatMessage = Omit<ChatMessage, "role">/,
  'workspace chat message types should not regress shared chat message role, named kind consumption or explicit message fields to inline unions or Omit-derived contracts',
);
assert.match(
  chatMessageContentSource,
  /import type \{[\s\S]*ChatMessageRole,[\s\S]*ChatMessageSnapshot,[\s\S]*\} from "@\/app\/workspace\/workspace-types";[\s\S]*export type WorkspaceMessageLike = \{[\s\S]*role: ChatMessageRole;/,
  'workspace message render input should consume the shared chat message role contract',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /role: ['"]user['"] \| ['"]assistant['"] \| ['"]system['"];/,
  'workspace message render input should not regress role to an inline union',
);
assert.match(
  `${workspaceTypesSource}\n${helperSource}`,
  /(?=[\s\S]*export type WorkspaceRestoredMessagePayload = \{[\s\S]*kind\?: WorkspaceChatMessageKind;)(?=[\s\S]*WorkspaceRestoredMessagePayload,)(?=[\s\S]*const parsed = JSON\.parse\(message\.content\) as WorkspaceRestoredMessagePayload;)/,
  'workspace message deserialization should consume the named restored message payload and chat message kind contracts',
);
assert.doesNotMatch(
  helperSource,
  /kind\?: 'text' \| 'plan-options' \| 'workflow';/,
  'workspace message deserialization should not regress persisted message kind to an inline union',
);
assert.match(
  chatMessageSnapshotSource,
  /(?=[\s\S]*ChatMessageRole)(?=[\s\S]*ChatMessageSnapshotSource)(?=[\s\S]*ChatMessageSnapshotStatus)(?=[\s\S]*WorkspaceEngineeringStatus)(?=[\s\S]*function hasChatMessageSnapshotWorkflowStatus\([\s\S]*for \(const step of displaySteps\)[\s\S]*const hasTargetStatus = stepStatus === status;[\s\S]*if \(hasTargetStatus === true\))(?=[\s\S]*function getChatMessageSnapshotEngineeringState\([\s\S]*message: ChatMessageSnapshotMessage,[\s\S]*\): WorkspaceEngineeringStateSnapshot \| undefined)(?=[\s\S]*function hasChatMessageSnapshotEngineeringStatusFailed\([\s\S]*status: WorkspaceEngineeringStatus \| undefined,[\s\S]*\): boolean)(?=[\s\S]*function getChatMessageSnapshotEngineeringPhaseStatus\([\s\S]*\): WorkspaceEngineeringStatus \| undefined)(?=[\s\S]*function getChatMessageSnapshotEngineeringWorkflowStatus\([\s\S]*\): WorkspaceEngineeringStatus \| undefined)(?=[\s\S]*function getChatMessageSnapshotEngineeringValidationStatus\([\s\S]*\): WorkspaceEngineeringStatus \| undefined)(?=[\s\S]*function hasChatMessageSnapshotEngineeringFailed\([\s\S]*const phaseStatus = getChatMessageSnapshotEngineeringPhaseStatus\(engineeringState\);[\s\S]*const hasPhaseFailed = hasChatMessageSnapshotEngineeringStatusFailed\(phaseStatus\);[\s\S]*if \(hasPhaseFailed === true\)[\s\S]*const workflowStatus = getChatMessageSnapshotEngineeringWorkflowStatus\(engineeringState\);[\s\S]*const hasWorkflowFailed = hasChatMessageSnapshotEngineeringStatusFailed\(workflowStatus\);[\s\S]*if \(hasWorkflowFailed === true\)[\s\S]*const validationStatus = getChatMessageSnapshotEngineeringValidationStatus\(engineeringState\);[\s\S]*const hasValidationFailed = hasChatMessageSnapshotEngineeringStatusFailed\(validationStatus\);[\s\S]*if \(hasValidationFailed === true\))(?=[\s\S]*function getChatMessageSnapshotWorkflowStepCount\(message: ChatMessageSnapshotMessage\): number)(?=[\s\S]*function getChatMessageSnapshotSuggestedQuestionCount\(message: ChatMessageSnapshotMessage\): number)(?=[\s\S]*function getChatMessageSnapshotSuggestedActionCount\(message: ChatMessageSnapshotMessage\): number)(?=[\s\S]*function getChatMessageSnapshotRecoveryActionCount\([\s\S]*recoveryActionSummary: ChatMessageSnapshotRecoveryActionSummary \| undefined,[\s\S]*\): number)(?=[\s\S]*function getChatMessageSnapshotGuidanceActionCount\([\s\S]*suggestedActionCount: number;[\s\S]*recoveryActionCount: number;[\s\S]*\): number)(?=[\s\S]*function hasChatMessageSnapshotRelatedCommit\(message: ChatMessageSnapshotMessage\): boolean[\s\S]*message\.relatedCommit === undefined[\s\S]*return message\.relatedCommit !== null;)(?=[\s\S]*function hasChatMessageSnapshotGuidance\([\s\S]*suggestedQuestionCount: number,[\s\S]*guidanceActionCount: number,[\s\S]*\): boolean)(?=[\s\S]*function hasChatMessageSnapshotContent\([\s\S]*hasSummary: boolean,[\s\S]*hasReasoning: boolean,[\s\S]*hasStatus: boolean)(?=[\s\S]*function getChatMessageSnapshotStatus\([\s\S]*\): ChatMessageSnapshotStatus)(?=[\s\S]*function getChatMessageSnapshotSource\(status: ChatMessageSnapshotStatus\): ChatMessageSnapshotSource)(?=[\s\S]*function getChatMessageSnapshotMessage\(status: ChatMessageSnapshotStatus\): string)(?=[\s\S]*function getChatMessageSnapshotRecovery\(status: ChatMessageSnapshotStatus\): string)(?=[\s\S]*export function buildChatMessageSnapshot\([\s\S]*\): ChatMessageSnapshot \{)(?=[\s\S]*const workflowFailed = hasChatMessageSnapshotWorkflowStatus\(displaySteps, 'failed'\);)(?=[\s\S]*const workflowRunning = hasChatMessageSnapshotWorkflowStatus\(displaySteps, 'running'\);)(?=[\s\S]*const engineeringState = getChatMessageSnapshotEngineeringState\(message\);)(?=[\s\S]*const engineeringFailed = hasChatMessageSnapshotEngineeringFailed\(engineeringState\);)(?=[\s\S]*const suggestedQuestionCount = getChatMessageSnapshotSuggestedQuestionCount\(message\);)(?=[\s\S]*const suggestedActionCount = getChatMessageSnapshotSuggestedActionCount\(message\);)(?=[\s\S]*const recoveryActionCount = getChatMessageSnapshotRecoveryActionCount\(recoveryActionSummary\);)(?=[\s\S]*const guidanceActionCount = getChatMessageSnapshotGuidanceActionCount\(\{[\s\S]*suggestedActionCount,[\s\S]*recoveryActionCount,[\s\S]*\}\);)(?=[\s\S]*const hasGuidance = hasChatMessageSnapshotGuidance\(suggestedQuestionCount, guidanceActionCount\);)(?=[\s\S]*const hasRelatedCommit = hasChatMessageSnapshotRelatedCommit\(message\);)(?=[\s\S]*const hasContent = hasChatMessageSnapshotContent\(hasSummary, hasReasoning, hasStatus\);)(?=[\s\S]*const status = getChatMessageSnapshotStatus\(\{[\s\S]*engineeringFailed,[\s\S]*workflowFailed,[\s\S]*workflowRunning,[\s\S]*isStreaming,[\s\S]*hasGuidance,[\s\S]*hasRelatedCommit,[\s\S]*role,[\s\S]*hasContent,)(?=[\s\S]*const source = getChatMessageSnapshotSource\(status\);)(?=[\s\S]*const workflowStepCount = getChatMessageSnapshotWorkflowStepCount\(message\);)(?=[\s\S]*const snapshotMessage = getChatMessageSnapshotMessage\(status\);)(?=[\s\S]*const recovery = getChatMessageSnapshotRecovery\(status\);)/,
  'workspace chat message snapshot helper should derive all message phases from named workflow, engineering, guidance, content, message and recovery facts',
);
assert.doesNotMatch(
  chatMessageSnapshotSource,
  /ChatMessageSnapshot\['status'\]|ChatMessageSnapshot\['source'\]|ChatMessageSnapshot\['role'\]|displaySteps\.some\(\(step\) => step\.status === ['"](?:failed|running)['"]\)|message\.engineeringState\?\.phase\?\.status === ['"]failed['"]|message\.engineeringState\?\.workflow\?\.status === ['"]failed['"]|message\.engineeringState\?\.validation\?\.status === ['"]failed['"]|message\.suggestedQuestions\?\.length \?\? 0|message\.suggestedActions\?\.length \?\? 0|recoveryActionSummary\?\.actionCount \?\? 0|suggestedQuestionCount > 0 \|\| guidanceActionCount > 0|message\.workflowSteps\?\.length \?\? 0|message\.relatedCommit !== undefined && message\.relatedCommit !== null|hasSummary \|\| hasReasoning \|\| hasStatus|status === ['"]workflow_running['"] \|\| status === ['"]assistant_streaming['"]/,
  'workspace chat message snapshot helper should not infer snapshot contracts or regress to inline workflow, engineering, guidance, count, content or recovery gates',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*import \{ buildChatMessageSnapshot \} from "@\/app\/workspace\/workspace-chat-message-snapshot";)(?=[\s\S]*function getChatMessageContentWorkflowSteps\(message: WorkspaceMessageLike\): WorkflowStep\[\])(?=[\s\S]*function getChatMessageContentTextValue\(value: string \| undefined\): string[\s\S]*return value\.trim\(\);)(?=[\s\S]*function hasChatMessageContentTextValue\(value: string\): boolean)(?=[\s\S]*function getChatMessageContentDisplayStatus\([\s\S]*hasDisplayReasoning: boolean;[\s\S]*hasStatusContent: boolean;[\s\S]*statusContent: string;)(?=[\s\S]*function hasChatMessageContentFileOperationSteps\(workflowSteps: WorkflowStep\[\]\): boolean[\s\S]*for \(const step of workflowSteps\))(?=[\s\S]*function getChatMessageContentFileOperationSteps\(workflowSteps: WorkflowStep\[\]\): WorkflowStep\[\][\s\S]*for \(const step of workflowSteps\))(?=[\s\S]*function getChatMessageContentDisplaySteps\(workflowSteps: WorkflowStep\[\]\): WorkflowStep\[\])(?=[\s\S]*function isChatMessageContentStreaming\(message: WorkspaceMessageLike\): boolean)(?=[\s\S]*function hasChatMessageContentSteps\(displaySteps: WorkflowStep\[\]\): boolean)(?=[\s\S]*function shouldStreamChatMessageThoughtProcess\([\s\S]*isStreaming: boolean;[\s\S]*hasSteps: boolean;)(?=[\s\S]*function isChatMessageContentUserMessage\(message: WorkspaceMessageLike\): boolean)(?=[\s\S]*function shouldRenderChatMessageRoleHeader\(message: WorkspaceMessageLike\): boolean)(?=[\s\S]*function getChatMessageContentRoleLabel\(message: WorkspaceMessageLike\): string)(?=[\s\S]*function getChatMessageContentEngineeringState\([\s\S]*\): WorkspaceEngineeringStateSnapshot \| undefined)(?=[\s\S]*function hasChatMessageContentEngineeringState\([\s\S]*\): engineeringState is WorkspaceEngineeringStateSnapshot)(?=[\s\S]*function getChatMessageContentRecoveryActionSummary\([\s\S]*\): WorkspaceRecoveryActionSummary \| undefined)(?=[\s\S]*function hasChatMessageContentThoughtProcessContent\([\s\S]*hasDisplayReasoning: boolean;[\s\S]*hasDisplayStatus: boolean;)(?=[\s\S]*function getChatMessageContentThoughtProcessContent\([\s\S]*displayReasoning: string;[\s\S]*displayStatus: string;[\s\S]*hasDisplayReasoning: boolean;)(?=[\s\S]*function shouldRenderChatMessageThoughtProcess\(hasThoughtProcessContent: boolean\): boolean)(?=[\s\S]*function isChatMessageContentThoughtProcessFallback\(hasDisplayReasoning: boolean\): boolean)(?=[\s\S]*function getChatMessageContentRelatedCommit\(message: WorkspaceMessageLike\): GitCommit \| undefined)(?=[\s\S]*function hasChatMessageContentRelatedCommit\(relatedCommit: GitCommit \| undefined\): relatedCommit is GitCommit)(?=[\s\S]*function shouldRenderChatMessageAssistantGuidance\(message: WorkspaceMessageLike\): boolean)(?=[\s\S]*const displayReasoning = getChatMessageContentTextValue\(message\.reasoningContent\);)(?=[\s\S]*const hasDisplayReasoning = hasChatMessageContentTextValue\(displayReasoning\);)(?=[\s\S]*const statusContent = getChatMessageContentTextValue\(message\.statusContent\);)(?=[\s\S]*const displayStatus = getChatMessageContentDisplayStatus\(\{)(?=[\s\S]*const displaySteps = getChatMessageContentDisplaySteps\(workflowSteps\);)(?=[\s\S]*const isStreaming = isChatMessageContentStreaming\(message\);)(?=[\s\S]*const hasSteps = hasChatMessageContentSteps\(displaySteps\);)(?=[\s\S]*const thoughtStreaming = shouldStreamChatMessageThoughtProcess\(\{)(?=[\s\S]*const summaryContent = getChatMessageContentTextValue\(message\.content\);)(?=[\s\S]*const hasSummary = hasChatMessageContentTextValue\(summaryContent\);)(?=[\s\S]*const isUserMessage = isChatMessageContentUserMessage\(message\);)(?=[\s\S]*const shouldRenderRoleHeader = shouldRenderChatMessageRoleHeader\(message\);)(?=[\s\S]*const roleLabel = getChatMessageContentRoleLabel\(message\);)(?=[\s\S]*const engineeringState = getChatMessageContentEngineeringState\(message\);)(?=[\s\S]*const hasEngineeringState = hasChatMessageContentEngineeringState\(engineeringState\);)(?=[\s\S]*const recoveryActionSummary = getChatMessageContentRecoveryActionSummary\(\{)(?=[\s\S]*const hasThoughtProcessContent = hasChatMessageContentThoughtProcessContent\(\{)(?=[\s\S]*const thoughtProcessContent = getChatMessageContentThoughtProcessContent\(\{)(?=[\s\S]*const shouldRenderThoughtProcess = shouldRenderChatMessageThoughtProcess\(hasThoughtProcessContent\);)(?=[\s\S]*const thoughtProcessFallback = isChatMessageContentThoughtProcessFallback\(hasDisplayReasoning\);)(?=[\s\S]*const relatedCommit = getChatMessageContentRelatedCommit\(message\);)(?=[\s\S]*const hasRelatedCommit = hasChatMessageContentRelatedCommit\(relatedCommit\);)(?=[\s\S]*const shouldRenderAssistantGuidance = shouldRenderChatMessageAssistantGuidance\(message\);)(?=[\s\S]*const chatMessageSnapshot = buildChatMessageSnapshot\(\{[\s\S]*message,[\s\S]*displaySteps,[\s\S]*hasSummary,[\s\S]*hasReasoning: hasDisplayReasoning,[\s\S]*hasStatus: hasDisplayStatus,[\s\S]*recoveryActionSummary,)/,
  'workspace chat message content should derive message display, workflow, thought process, engineering, role and commit facts through named readers before building the shared snapshot',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /message\.reasoningContent\?\.trim\(\) \|\| ""|message\.reasoningContent\?\.trim\(\) \?\? ""|message\.statusContent\?\.trim\(\) \?\? ""|!displayReasoning \? \(message\.statusContent\?\.trim\(\) \|\| ""\) : ""|const displayStatus = hasDisplayReasoning === false && hasStatusContent === true \? statusContent : ""|message\.workflowSteps \|\| \[\]|message\.workflowSteps \?\? \[\]|workflowSteps\.some\(\(step\) => getWorkflowSectionKind\(step\) === "file_ops"\)|workflowSteps\.filter\(\(step\) => getWorkflowSectionKind\(step\) === "file_ops"\)|Boolean\(message\.streaming\)|const thoughtStreaming = isStreaming === true && displaySteps\.length === 0|message\.content\?\.trim\(\) \?\? ""|Boolean\(message\.content\?\.trim\(\)\)|const hasEngineeringState = engineeringState !== undefined;[\s\S]*const recoveryActionSummary = hasEngineeringState === true[\s\S]*\? deriveWorkspaceRecoveryActionSummary\(message\)|const guidanceActionCount = \(message\.suggestedActions\?\.length \?\? 0\) \+ \(recoveryActionSummary\?\.actionCount \?\? 0\)|hasReasoning: Boolean\(displayReasoning\)|hasStatus: Boolean\(displayStatus\)|const hasThoughtProcessContent = hasDisplayReasoning === true \|\| hasDisplayStatus === true|Boolean\(displayReasoning \|\| displayStatus\)|const thoughtProcessContent = hasDisplayReasoning === true \? displayReasoning : displayStatus|displayReasoning \|\| displayStatus|fallback=\{!displayReasoning\}|const relatedCommit = message\.relatedCommit;[\s\S]*const hasRelatedCommit = relatedCommit !== undefined && relatedCommit !== null|\{message\.role !== "user" &&|\{message\.role === "assistant" &&|message\.role === "assistant" \? "YiStack 回复" : "系统消息"|message\.relatedCommit &&/,
  'workspace chat message content should not regress to inline text fallback, workflow materializers, streaming/thought gates, engineering recovery gate, role display gate or commit gate',
);
assert.match(
  workspaceTypesSource,
  /export type ChatThoughtProcessSnapshotStatus = 'empty' \| 'streaming' \| 'expanded' \| 'collapsed' \| 'settled';[\s\S]*export type ChatThoughtProcessSnapshotSource = 'reasoning_content' \| 'status_content' \| 'user_toggle' \| 'message_restore';[\s\S]*export type ChatThoughtProcessContentKind = 'reasoning' \| 'status_fallback';[\s\S]*export type ChatThoughtProcessSnapshot = \{[\s\S]*status: ChatThoughtProcessSnapshotStatus;[\s\S]*source: ChatThoughtProcessSnapshotSource;[\s\S]*contentKind: ChatThoughtProcessContentKind;[\s\S]*contentLength: number;[\s\S]*isOpen: boolean;[\s\S]*recovery: string;/,
  'workspace chat thought process state should be represented as a structured snapshot with phase, source, content kind, content length, open state and recovery fields',
);
assert.match(
  chatThoughtProcessSnapshotSource,
  /(?=[\s\S]*ChatThoughtProcessContentKind)(?=[\s\S]*ChatThoughtProcessSnapshotSource)(?=[\s\S]*ChatThoughtProcessSnapshotStatus)(?=[\s\S]*function isChatThoughtProcessSnapshotFallback\(fallback: boolean\): boolean \{[\s\S]*return fallback === true;)(?=[\s\S]*function isChatThoughtProcessSnapshotStreaming\(streaming: boolean\): boolean \{[\s\S]*return streaming === true;)(?=[\s\S]*function isChatThoughtProcessSnapshotOpen\(open: boolean\): boolean \{[\s\S]*return open === true;)(?=[\s\S]*function isChatThoughtProcessSnapshotUserToggle\(source: ChatThoughtProcessSnapshotSource\): boolean \{[\s\S]*return source === 'user_toggle';)(?=[\s\S]*function getChatThoughtProcessContentKind\(fallback: boolean\): ChatThoughtProcessContentKind \{[\s\S]*const isFallback = isChatThoughtProcessSnapshotFallback\(fallback\);[\s\S]*return isFallback === true \? 'status_fallback' : 'reasoning';)(?=[\s\S]*function getChatThoughtProcessStreamingSource\(fallback: boolean\): ChatThoughtProcessSnapshotSource \{[\s\S]*const isFallback = isChatThoughtProcessSnapshotFallback\(fallback\);[\s\S]*return isFallback === true \? 'status_content' : 'reasoning_content';)(?=[\s\S]*export function buildChatThoughtProcessSnapshot\([\s\S]*\): ChatThoughtProcessSnapshot \{)(?=[\s\S]*const contentKind = getChatThoughtProcessContentKind\(fallback\);)(?=[\s\S]*const isFallback = isChatThoughtProcessSnapshotFallback\(fallback\);)(?=[\s\S]*status: ChatThoughtProcessSnapshotStatus = 'empty')(?=[\s\S]*snapshotSource: ChatThoughtProcessSnapshotSource = 'message_restore')(?=[\s\S]*const isStreaming = isChatThoughtProcessSnapshotStreaming\(streaming\);)(?=[\s\S]*if \(isStreaming === true\))(?=[\s\S]*status: ChatThoughtProcessSnapshotStatus = 'streaming')(?=[\s\S]*const snapshotSource = getChatThoughtProcessStreamingSource\(fallback\);)(?=[\s\S]*const isOpen = isChatThoughtProcessSnapshotOpen\(open\);)(?=[\s\S]*if \(isOpen === true\))(?=[\s\S]*status: ChatThoughtProcessSnapshotStatus = 'expanded')(?=[\s\S]*const isUserToggle = isChatThoughtProcessSnapshotUserToggle\(source\);)(?=[\s\S]*status: ChatThoughtProcessSnapshotStatus = isUserToggle === true \? 'collapsed' : 'settled')/,
  'workspace chat thought process snapshot helper should derive all phases from content, streaming, open, fallback and source facts through named predicates',
);
assert.doesNotMatch(
  chatThoughtProcessSnapshotSource,
  /ChatThoughtProcessSnapshot\['status'\]|ChatThoughtProcessSnapshot\['source'\]|ChatThoughtProcessSnapshot\['contentKind'\]|contentKind: ChatThoughtProcessContentKind = fallback|if \(streaming\)|if \(open\)|status: ChatThoughtProcessSnapshotStatus = source === 'user_toggle'|message: fallback \?|snapshotSource: ChatThoughtProcessSnapshotSource = fallback \?/,
  'workspace chat thought process snapshot helper should not infer status/source/contentKind from indexed snapshot access or implicit streaming/open/fallback gates',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*ChatThoughtProcessSnapshotSource)(?=[\s\S]*import \{ buildChatThoughtProcessSnapshot \} from "@\/app\/workspace\/workspace-chat-thought-process-snapshot";)(?=[\s\S]*const hasNormalizedContent = normalized\.length > 0;)(?=[\s\S]*const isStreaming = streaming === true;)(?=[\s\S]*const hasFallback = fallback === true;)(?=[\s\S]*useState<ChatThoughtProcessSnapshotSource>)(?=[\s\S]*if \(hasNormalizedContent === false\) return null;)(?=[\s\S]*const thoughtProcessSnapshot = buildChatThoughtProcessSnapshot\(\{[\s\S]*contentLength: normalized\.length,[\s\S]*streaming: isStreaming,[\s\S]*open,[\s\S]*fallback: hasFallback,[\s\S]*source: snapshotSource,)/,
  'workspace chat thought process panel should use the shared snapshot helper and named source contract with authoritative content and disclosure facts',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /ChatThoughtProcessSnapshot\["source"\]|ChatThoughtProcessSnapshot\['source'\]/,
  'workspace chat thought process component should not infer source from indexed snapshot access',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /const \[open, setOpen\] = useState\(Boolean\(streaming\)\)|streaming \? \(fallback \? "status_content" : "reasoning_content"\) : "message_restore"|function ThoughtProcessPanel\([\s\S]*if \(!normalized\) return null|streaming: Boolean\(streaming\)|fallback: Boolean\(fallback\)|streaming \? "当前动作" : "动作记录"|streaming && \(/,
  'workspace chat thought process panel should not regress to truthy streaming, fallback or content gates',
);
assert.match(
  workspaceTypesSource,
  /export type CommitSummarySnapshotStatus = 'ready' \| 'restore_only' \| 'view_only' \| 'actions_missing' \| 'summary_missing';[\s\S]*export type CommitSummarySnapshotSource = 'commit_metadata' \| 'commit_actions';[\s\S]*export type CommitSummarySnapshot = \{[\s\S]*status: CommitSummarySnapshotStatus;[\s\S]*source: CommitSummarySnapshotSource;[\s\S]*shortHash: string;[\s\S]*hasMessage: boolean;[\s\S]*canRestore: boolean;[\s\S]*canView: boolean;[\s\S]*recovery: string;/,
  'workspace commit summary state should be represented as a structured snapshot with phase, source, hash, summary and action availability fields',
);
assert.match(
  commitSummarySnapshotSource,
  /(?=[\s\S]*CommitSummarySnapshotSource)(?=[\s\S]*CommitSummarySnapshotStatus)(?=[\s\S]*function getCommitSummarySnapshotMessage\(value: string \| null \| undefined\): string[\s\S]*value === null \|\| value === undefined[\s\S]*return value\.trim\(\);)(?=[\s\S]*function hasCommitSummarySnapshotMessage\(message: string\): boolean[\s\S]*const hasMessage = message\.length > 0;[\s\S]*return hasMessage === true;)(?=[\s\S]*export function buildCommitSummarySnapshot\([\s\S]*\): CommitSummarySnapshot \{)(?=[\s\S]*const normalizedMessage = getCommitSummarySnapshotMessage\(commit\.message\);)(?=[\s\S]*const hasMessage = hasCommitSummarySnapshotMessage\(normalizedMessage\);)(?=[\s\S]*const hasRestoreAction = canRestore === true;)(?=[\s\S]*const hasViewAction = canView === true;)(?=[\s\S]*const hasAllActions = hasRestoreAction === true && hasViewAction === true;)(?=[\s\S]*status: CommitSummarySnapshotStatus = hasMessage === false)(?=[\s\S]*source: CommitSummarySnapshotSource = status === 'summary_missing')(?=[\s\S]*'summary_missing')(?=[\s\S]*hasAllActions === true)(?=[\s\S]*'ready')(?=[\s\S]*hasRestoreAction === true)(?=[\s\S]*'restore_only')(?=[\s\S]*hasViewAction === true)(?=[\s\S]*'view_only')(?=[\s\S]*'actions_missing')/,
  'workspace commit summary snapshot helper should derive all commit summary phases from metadata and action wiring facts',
);
assert.doesNotMatch(
  commitSummarySnapshotSource,
  /CommitSummarySnapshot\['status'\]|CommitSummarySnapshot\['source'\]|Boolean\(|!hasMessage|commit\.message\?\.trim\(\) \|\| ''|commit\.message\?\.trim\(\) \?\? ''|canRestore && canView|canRestore === true && canView === true/,
  'workspace commit summary snapshot helper should not infer status/source from indexed snapshot access or implicit Boolean/action/message gates',
);
assert.match(
  chatMessageContentSource,
  /import \{ buildCommitSummarySnapshot \} from "@\/app\/workspace\/workspace-commit-summary-snapshot";[\s\S]*const canRestoreCommit = onRestoreCommit !== undefined;[\s\S]*const canViewCommit = onViewCommit !== undefined;[\s\S]*const commitSummarySnapshot = buildCommitSummarySnapshot\(\{[\s\S]*commit,[\s\S]*shortHash,[\s\S]*canRestore: canRestoreCommit,[\s\S]*canView: canViewCommit,[\s\S]*disabled=\{canRestoreCommit === false\}[\s\S]*onClick=\{handleRestoreCommit\}[\s\S]*disabled=\{canViewCommit === false\}[\s\S]*onClick=\{handleViewCommit\}/,
  'workspace commit summary card should use the shared commit summary snapshot helper with authoritative commit action facts',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /canRestore: Boolean\(onRestoreCommit\)|canView: Boolean\(onViewCommit\)|disabled=\{!onRestoreCommit\}|disabled=\{!onViewCommit\}|onRestoreCommit\?\.\(commit\)|onViewCommit\?\.\(commit\)/,
  'workspace commit summary card should not infer optional commit actions from truthy callback checks',
);
assert.match(
  workspaceTypesSource,
  /export type EngineeringStatePanelSnapshotStatus = 'ready' \| 'running' \| 'awaiting_confirmation' \| 'recoverable' \| 'failed' \| 'foundation_blocked';[\s\S]*export type EngineeringStatePanelSnapshotSource = 'rows' \| 'phase' \| 'execution' \| 'recovery' \| 'validation' \| 'foundation';[\s\S]*export type EngineeringStatePanelSnapshot = \{[\s\S]*status: EngineeringStatePanelSnapshotStatus;[\s\S]*source: EngineeringStatePanelSnapshotSource;[\s\S]*rowCount: number;[\s\S]*failureItemCount: number;[\s\S]*blockerCount: number;[\s\S]*recoveryActionCount: number;[\s\S]*primaryActionCount: number;[\s\S]*retryActionCount: number;[\s\S]*recovery: string;/,
  'workspace engineering state panel should be represented as a structured snapshot with named phase/source contracts plus row, failure, blocker and recovery action fields',
);
assert.match(
  engineeringStatePanelSnapshotSource,
  /(?=[\s\S]*WorkspaceEngineeringStatus)(?=[\s\S]*EngineeringStatePanelSnapshotSource)(?=[\s\S]*EngineeringStatePanelSnapshotStatus)(?=[\s\S]*type EngineeringStatePanelBooleanFactList = readonly boolean\[\];)(?=[\s\S]*function hasEngineeringStatePanelTrueFact\(values: EngineeringStatePanelBooleanFactList\): boolean)(?=[\s\S]*function getEngineeringStatePanelItemCount<TItem>\(items: readonly TItem\[\] \| undefined\): number)(?=[\s\S]*function hasEngineeringStatePanelCount\(value: number\): boolean)(?=[\s\S]*function isEngineeringStatePanelStatus\([\s\S]*status: WorkspaceEngineeringStatus \| undefined,[\s\S]*expectedStatus: WorkspaceEngineeringStatus)(?=[\s\S]*function getEngineeringStateValidationFailureCount\(state: WorkspaceEngineeringStateSnapshot\): number)(?=[\s\S]*function getEngineeringStatePhaseBlockerCount\(state: WorkspaceEngineeringStateSnapshot\): number)(?=[\s\S]*function getEngineeringStateBootstrapBlockerCount\(state: WorkspaceEngineeringStateSnapshot\): number)(?=[\s\S]*function getEngineeringStateBootstrapGateBlockingItemCount\(state: WorkspaceEngineeringStateSnapshot\): number)(?=[\s\S]*function getEngineeringStatePanelRecoveryActionCount\()(?=[\s\S]*function getEngineeringStatePanelPrimaryActionCount\()(?=[\s\S]*function getEngineeringStatePanelRetryActionCount\()(?=[\s\S]*function hasEngineeringStatePanelFailedState\()(?=[\s\S]*function hasEngineeringStatePanelFoundationBlock\()(?=[\s\S]*function hasEngineeringStatePanelRecovery\()(?=[\s\S]*function hasEngineeringStatePanelRunningState\()(?=[\s\S]*function getEngineeringStatePanelSnapshotStatus\()(?=[\s\S]*function getEngineeringStatePanelSnapshotSource\()(?=[\s\S]*function getEngineeringStatePanelSnapshotMessage\(status: EngineeringStatePanelSnapshotStatus\): string)(?=[\s\S]*function getEngineeringStatePanelSnapshotRecovery\(status: EngineeringStatePanelSnapshotStatus\): string)(?=[\s\S]*export function buildEngineeringStatePanelSnapshot\([\s\S]*\): EngineeringStatePanelSnapshot \{)(?=[\s\S]*const validationFailures = getEngineeringStateValidationFailureCount\(state\);)(?=[\s\S]*const phaseBlockers = getEngineeringStatePhaseBlockerCount\(state\);)(?=[\s\S]*const bootstrapBlockerCount = getEngineeringStateBootstrapBlockerCount\(state\);)(?=[\s\S]*const bootstrapGateBlockingItemCount = getEngineeringStateBootstrapGateBlockingItemCount\(state\);)(?=[\s\S]*const hasValidationFailures = hasEngineeringStatePanelCount\(validationFailures\);)(?=[\s\S]*const hasPhaseBlockers = hasEngineeringStatePanelCount\(phaseBlockers\);)(?=[\s\S]*const recoveryActionCount = getEngineeringStatePanelRecoveryActionCount\(recoveryActionSummary\);)(?=[\s\S]*const hasAwaitingConfirmation = state\.execution\?\.awaiting_confirmation === true;)(?=[\s\S]*const hasRows = hasEngineeringStatePanelCount\(rowCount\);)(?=[\s\S]*const status = getEngineeringStatePanelSnapshotStatus\(\{[\s\S]*hasFailedState,[\s\S]*hasFoundationBlock,[\s\S]*hasRecovery,[\s\S]*hasAwaitingConfirmation,[\s\S]*hasRunningState,[\s\S]*\}\);)(?=[\s\S]*const source = getEngineeringStatePanelSnapshotSource\(\{[\s\S]*hasFailedState,[\s\S]*hasValidationFailures,[\s\S]*hasValidationFailure,[\s\S]*hasFoundationBlock,[\s\S]*hasRecovery,[\s\S]*hasAwaitingConfirmation,[\s\S]*hasRunningState,[\s\S]*hasRows,[\s\S]*\}\);)(?=[\s\S]*const message = getEngineeringStatePanelSnapshotMessage\(status\);)(?=[\s\S]*const recovery = getEngineeringStatePanelSnapshotRecovery\(status\);)(?=[\s\S]*'failed')(?=[\s\S]*'foundation_blocked')(?=[\s\S]*'recoverable')(?=[\s\S]*'awaiting_confirmation')(?=[\s\S]*'running')(?=[\s\S]*'ready')/,
  'workspace engineering state panel snapshot helper should derive all panel phases from engineering state, blockers, recovery and execution facts while consuming named snapshot contracts',
);
assert.doesNotMatch(
  engineeringStatePanelSnapshotSource,
  /EngineeringStatePanelSnapshot\['status'\]|EngineeringStatePanelSnapshot\['source'\]|state\.validation\?\.failure_items\?\.length \?\? 0|state\.phase\?\.blockers\?\.length \?\? 0|state\.bootstrap_state\?\.blockers\?\.length \?\? 0|state\.bootstrap_state\?\.gate_result\?\.blocking_items\?\.length \?\? 0|failure_items\?\.length \|\| 0|blockers\?\.length \|\| 0|blocking_items\?\.length \|\| 0|recoveryActionSummary\?\.(?:actionCount|primaryActionCount|retryActionCount) (?:\?\?|\|\|) 0|hasWorkflowFailure === true\s*\|\||hasBootstrapStateBlocked === true\s*\|\||hasRecoveryBlocked === true\s*\|\||hasWorkflowRunning === true\s*\|\||hasValidationFailures === true \|\| hasValidationFailure === true|hasAwaitingConfirmation === true \|\| hasRunningState === true|status: EngineeringStatePanelSnapshotStatus = hasFailedState|source: EngineeringStatePanelSnapshotSource = hasFailedState|message: status === 'failed'|recovery: status === 'ready'|state\.execution\?\.awaiting_confirmation\s*\?/,
  'workspace engineering state panel snapshot helper should not infer status/source from indexed snapshot access or count/recovery/confirmation fallback gates',
);
assert.doesNotMatch(
  engineeringStatePanelSnapshotSource,
  /values\.find\(|const matchedValue = values\.find/,
  'workspace engineering state panel snapshot helper should not regress boolean fact scans to Array.find callbacks',
);
assert.match(
  chatMessageContentSource,
  /import \{ buildEngineeringStatePanelSnapshot \} from "@\/app\/workspace\/workspace-engineering-state-panel-snapshot";[\s\S]*const engineeringStatePanelSnapshot = buildEngineeringStatePanelSnapshot\(\{[\s\S]*state,[\s\S]*rowCount: rows\.length,[\s\S]*recoveryActionSummary,/,
  'workspace engineering state panel should use the shared snapshot helper with authoritative row and recovery action facts',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*import type \{ ContextGateRepairTarget \} from "@\/app\/workspace\/context-gate-repair";)(?=[\s\S]*function joinEngineeringStateDetail\(parts: Array<string \| undefined>\)[\s\S]*for \(const part of parts\)[\s\S]*const text = getEngineeringStatePanelTextValue\(part\);[\s\S]*const hasText = hasEngineeringStatePanelTextValue\(text\);[\s\S]*detail = `\$\{detail\} \/ \$\{text\}`;)(?=[\s\S]*function getEngineeringStatePanelItemListLabel\(items: string\[\]\): string[\s\S]*for \(const item of items\)[\s\S]*label = `\$\{label\} \/ \$\{text\}`;)(?=[\s\S]*function appendEngineeringStateRow\(rows: EngineeringStateRow\[\], row: EngineeringStateRow\)[\s\S]*const shouldAppendRow = hasEngineeringStateRow\(row\.statusLabel, row\.detail\);[\s\S]*if \(shouldAppendRow === true\))(?=[\s\S]*function getRecoveryRetryLabel\(retryLabel: string \| undefined\)[\s\S]*const hasRetryLabel = retryLabelValue\.length > 0;[\s\S]*if \(hasRetryLabel === true\))(?=[\s\S]*function getValidationFailureItemKey\(item: WorkspaceValidationFailureItem, index: number\)[\s\S]*const hasId = id\.length > 0;[\s\S]*const hasTitle = title\.length > 0;)(?=[\s\S]*function getContextRepairTargetKey\(target: ContextGateRepairTarget\)[\s\S]*const field = target\.field \?\? "default";)/,
  'workspace engineering state panel should derive row details, list labels, retry labels, failure item keys and context repair target keys through explicit helper facts',
);
assert.match(
  chatMessageContentSource,
  /(?=[\s\S]*type EngineeringStatePanelNextActionInput = \{[\s\S]*gateNextAction: string;[\s\S]*bootstrapNextAction: string;[\s\S]*\};)(?=[\s\S]*function getEngineeringStatePanelRequiredDecisionCount\([\s\S]*bootstrapState: WorkspaceBootstrapState \| undefined,[\s\S]*\): number \| undefined)(?=[\s\S]*function getEngineeringStatePanelFoundationRiskDetail\(foundationRiskLevel: string\): string)(?=[\s\S]*function getEngineeringStatePanelExecutionStatusLabel\([\s\S]*execution: WorkspaceExecutionState \| undefined,[\s\S]*\): string)(?=[\s\S]*function shouldRenderEngineeringStatePanelExecutionState\([\s\S]*hasExecutionPauseReason,[\s\S]*hasExecutionApprovalBoundary,[\s\S]*hasExecutionNextAction,[\s\S]*\}:)(?=[\s\S]*function getEngineeringStatePanelRecoveryStageLabel\(recovery: WorkspaceRecoveryState \| undefined\): string)(?=[\s\S]*function shouldRenderEngineeringStatePanelRecoveryActions\([\s\S]*recoveryActionSummary: WorkspaceRecoveryActionSummary \| undefined,[\s\S]*\): recoveryActionSummary is WorkspaceRecoveryActionSummary)(?=[\s\S]*function shouldRenderEngineeringStatePanelBootstrapNextAction\([\s\S]*EngineeringStatePanelNextActionInput)(?=[\s\S]*function getEngineeringStatePanelDisplayedBootstrapNextAction\([\s\S]*EngineeringStatePanelNextActionInput)(?=[\s\S]*function getEngineeringStatePanelBootstrapBlockingItems\([\s\S]*bootstrapBlockers: string\[\];[\s\S]*gateBlockingItems: string\[\];[\s\S]*const blockingItems: string\[\] = \[\];[\s\S]*for \(const item of bootstrapBlockers\)[\s\S]*for \(const item of gateBlockingItems\))(?=[\s\S]*const phase = getEngineeringStatePanelPhaseState\(state\);)(?=[\s\S]*const hasPhase = phase !== undefined;)(?=[\s\S]*const phaseCompletedTasksLabel = getEngineeringStatePanelItemListLabel\(phaseCompletedTasks\);)(?=[\s\S]*const phaseBlockersLabel = getEngineeringStatePanelItemListLabel\(phaseBlockers\);)(?=[\s\S]*const shouldRenderExecutionState = shouldRenderEngineeringStatePanelExecutionState\(\{[\s\S]*hasExecutionPauseReason,[\s\S]*hasExecutionApprovalBoundary,[\s\S]*hasExecutionNextAction,[\s\S]*\}\);)(?=[\s\S]*const recoveryStageLabel = getEngineeringStatePanelRecoveryStageLabel\(recovery\);)(?=[\s\S]*const shouldRenderRecoveryActions = shouldRenderEngineeringStatePanelRecoveryActions\(recoveryActionSummary\);)(?=[\s\S]*const shouldRenderBootstrapNextAction = shouldRenderEngineeringStatePanelBootstrapNextAction\(\{[\s\S]*gateNextAction,[\s\S]*bootstrapNextAction,[\s\S]*\}\);)(?=[\s\S]*const displayedBootstrapNextAction = getEngineeringStatePanelDisplayedBootstrapNextAction\(\{[\s\S]*gateNextAction,[\s\S]*bootstrapNextAction,[\s\S]*\}\);)(?=[\s\S]*const bootstrapBlockingItems = getEngineeringStatePanelBootstrapBlockingItems\(\{[\s\S]*bootstrapBlockers,[\s\S]*gateBlockingItems,[\s\S]*\}\);)(?=[\s\S]*const bootstrapBlockingItemsLabel = getEngineeringStatePanelItemListLabel\(bootstrapBlockingItems\);)/,
  'workspace engineering state panel should derive phase, execution, recovery, validation and Foundation summary gates through explicit facts',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /\[state\.workflow\?\.stage, state\.workflow\?\.mode\]\.filter\(Boolean\)|\[state\.runtime\?\.project_name, state\.runtime\?\.app_type\]\.filter\(Boolean\)|\[state\.phase\?\.current_phase, state\.phase\?\.current_task\]\.filter\(Boolean\)|Boolean\(row\.statusLabel \|\| row\.detail\)|if \(!item\.file_path\)|\[state\.recovery\.resume_stage, state\.recovery\.resume_mode\]\.filter\(Boolean\)|state\.recovery\.retry_label \|\| '修复后重试'|item\.id \|\| `\$\{item\.title \|\| 'failure'\}-\$\{index\}`|item\.title \|\| 'Validation Gate 失败项'|state\.bootstrap_state\.schema_version \? `Schema \$\{state\.bootstrap_state\.schema_version\}` : ""|state\.bootstrap_state\.gate_result\?\.next_action \|\| state\.bootstrap_state\.next_action|state\.bootstrap_state\.blockers \|\| \[\]|state\.bootstrap_state\.gate_result\?\.blocking_items \|\| \[\]|state\.phase\?\.completed_tasks \?\? \[\]|state\.phase\?\.blockers \?\? \[\]|state\.validation\?\.failure_items \?\? \[\]|state\.bootstrap_state\?\.blockers \?\? \[\]|state\.bootstrap_state\?\.gate_result\?\.blocking_items \?\? \[\]|item\.field \|\| 'default'|\.filter\(\(part\) => part\.length > 0\)[\s\S]*\.join\(" \/ "\)|phaseCompletedTasks\.join\(" \/ "\)|phaseBlockers\.join\(" \/ "\)|bootstrapBlockingItems\.join\(" \/ "\)|hasGateNextAction === true \|\| hasBootstrapNextAction === true|hasGateNextAction === true \? gateNextAction : bootstrapNextAction|const recoveryActionCount = recoveryActionSummary\?\.actionCount \?\? 0|const bootstrapBlockingItems = \[[\s\S]*\]\.filter\(\(item\) => item\.length > 0\)/,
  'workspace engineering state panel should not regress to legacy row, recovery, validation failure, Foundation summary or context repair target fallbacks',
);
assert.match(
  workspaceTypesSource,
  /export type ValidationGateBlockedSnapshotStatus = 'validation_blocked' \| 'context_blocked' \| 'repair_targets_available' \| 'repair_targets_missing';[\s\S]*export type ValidationGateBlockedSnapshotSource = 'validation_state' \| 'context_gate' \| 'gate_result' \| 'repair_targets';[\s\S]*export type ValidationGateBlockedSnapshot = \{[\s\S]*status: ValidationGateBlockedSnapshotStatus;[\s\S]*source: ValidationGateBlockedSnapshotSource;[\s\S]*gate: string;[\s\S]*failureItemCount: number;[\s\S]*repairTargetCount: number;[\s\S]*canOpenRepairTarget: boolean;[\s\S]*recovery: string;/,
  'workspace validation gate blocked alert should be represented as a structured snapshot with named phase/source contracts plus gate, failure item and repair target fields',
);
assert.match(
  validationGateBlockedSnapshotSource,
  /(?=[\s\S]*ValidationGateBlockedSnapshotSource)(?=[\s\S]*ValidationGateBlockedSnapshotStatus)(?=[\s\S]*function getValidationGateBlockedFailureItems\([\s\S]*validationState: WorkspaceValidationState \| undefined,[\s\S]*\): WorkspaceValidationFailureItem\[\][\s\S]*validationState === undefined[\s\S]*failureItems === undefined[\s\S]*return failureItems;)(?=[\s\S]*function hasValidationGateBlockedItems\(itemCount: number\): boolean[\s\S]*const hasItems = itemCount > 0;[\s\S]*return hasItems === true;)(?=[\s\S]*function getValidationGateBlockedGate\(validationState: WorkspaceValidationState \| undefined\): string[\s\S]*validationState === undefined[\s\S]*validationGate === undefined[\s\S]*return validationGate;)(?=[\s\S]*function hasValidationGateBlockedGate\(validationGate: string\): boolean[\s\S]*const hasValidationGate = validationGate\.length > 0;[\s\S]*return hasValidationGate === true;)(?=[\s\S]*export function buildValidationGateBlockedSnapshot\([\s\S]*\): ValidationGateBlockedSnapshot \{)(?=[\s\S]*const validationState = state\.validation;)(?=[\s\S]*const failureItems = getValidationGateBlockedFailureItems\(validationState\);)(?=[\s\S]*const failureItemCount = failureItems\.length;)(?=[\s\S]*const hasFailureItems = hasValidationGateBlockedItems\(failureItemCount\);)(?=[\s\S]*const validationGate = getValidationGateBlockedGate\(validationState\);)(?=[\s\S]*const hasValidationGate = hasValidationGateBlockedGate\(validationGate\);)(?=[\s\S]*const hasRepairTargets = hasValidationGateBlockedItems\(repairTargetCount\);)(?=[\s\S]*status: ValidationGateBlockedSnapshotStatus = isContextGateBlocked === true)(?=[\s\S]*source: ValidationGateBlockedSnapshotSource = isContextGateBlocked === true)(?=[\s\S]*'repair_targets_available')(?=[\s\S]*hasGateResult === true)(?=[\s\S]*'repair_targets_missing')(?=[\s\S]*'context_blocked')(?=[\s\S]*'validation_blocked')(?=[\s\S]*message,)(?=[\s\S]*recovery,)/,
  'workspace validation gate blocked snapshot helper should derive all validation and context gate blocked phases from gate, repair target and action facts while consuming named snapshot contracts',
);
assert.doesNotMatch(
  validationGateBlockedSnapshotSource,
  /ValidationGateBlockedSnapshot\['status'\]|ValidationGateBlockedSnapshot\['source'\]|failure_items\?\.length \|\| 0|state\.validation\?\.failure_items\?\.length \?\? 0|state\.validation\?\.gate \|\||state\.validation\?\.gate \?\? ''|status: ValidationGateBlockedSnapshotStatus = isContextGateBlocked\s*\?|source: ValidationGateBlockedSnapshotSource = isContextGateBlocked\s*\?|repairTargetCount > 0\s*\?|hasGateResult\s*\?|canOpenRepairTarget\s*\?/,
  'workspace validation gate blocked snapshot helper should not infer status/source from indexed snapshot access or implicit gate fallbacks',
);
assert.match(
  chatMessageContentSource,
  /import \{ buildValidationGateBlockedSnapshot \} from "@\/app\/workspace\/workspace-validation-gate-blocked-snapshot";[\s\S]*const hasContextValidationGate = state\.validation\?\.gate === "context-memory-isolation";[\s\S]*const hasContextPauseReason = state\.execution\?\.pause_reason === "context_gate_blocked";[\s\S]*const isContextGateBlocked = hasContextValidationGate === true \|\| hasContextPauseReason === true;[\s\S]*const hasGateResult = gateResult !== undefined;[\s\S]*const hasOpenFileAction = onOpenFile !== undefined;[\s\S]*const hasContextGateRepairTargets = contextGateRepairTargets\.length > 0;[\s\S]*const canOpenRepairTarget = hasOpenFileAction === true && hasContextGateRepairTargets === true;[\s\S]*const validationGateBlockedSnapshot = buildValidationGateBlockedSnapshot\(\{[\s\S]*state,[\s\S]*isContextGateBlocked,[\s\S]*hasGateResult,[\s\S]*repairTargetCount: contextGateRepairTargets\.length,[\s\S]*canOpenRepairTarget,/,
  'workspace validation gate blocked alert should use the shared snapshot helper with authoritative gate and repair target facts',
);
assert.doesNotMatch(
  chatMessageContentSource,
  /hasGateResult: Boolean\(gateResult\)|canOpenRepairTarget: Boolean\(onOpenFile && contextGateRepairTargets\.length > 0\)|state\.validation\?\.gate === "context-memory-isolation"\s*\|\| state\.execution\?\.pause_reason === "context_gate_blocked"/,
  'workspace validation gate blocked alert should not regress helper inputs to Boolean(...) or inline context gate OR checks',
);
assert.match(
  contextGateRepairSource,
  /export type ContextGateRepairPath =[\s\S]*'\.yistack\/PROJECT_CONTEXT\.md'[\s\S]*'\.yistack\/foundation\/bootstrap_state\.json';[\s\S]*export type ContextGateRepairTarget = \{[\s\S]*path: ContextGateRepairPath;[\s\S]*function buildProjectContextTarget\(reason: string, field\?: string\): ContextGateRepairTarget[\s\S]*path: '\.yistack\/PROJECT_CONTEXT\.md'[\s\S]*function buildBootstrapStateTarget\(reason: string, field\?: string\): ContextGateRepairTarget[\s\S]*path: '\.yistack\/foundation\/bootstrap_state\.json'[\s\S]*export function getContextGateRepairTargets\(gateResult\?: WorkspaceGateResult\): ContextGateRepairTarget\[\]/,
  'context gate repair targets should expose a named repair path contract for .yistack project context and bootstrap state repair entries',
);
assert.match(
  contextGateRepairSource,
  /(?=[\s\S]*type ContextGateRepairReasonList = string\[\];)(?=[\s\S]*function getContextGateRepairBlockingItems\([\s\S]*gateResult: WorkspaceGateResult \| undefined)(?=[\s\S]*Array\.isArray\(gateResult\.blocking_items\) === false)(?=[\s\S]*function getContextGateRepairReasons\([\s\S]*gateResult: WorkspaceGateResult \| undefined)(?=[\s\S]*Array\.isArray\(gateResult\.reasons\) === false)(?=[\s\S]*function getContextGateRepairFieldValue\(field: string \| undefined\): string)(?=[\s\S]*function getContextGateRepairReasonText\(item: string\): string)(?=[\s\S]*function hasContextGateRepairReasonText\(item: string\): boolean)(?=[\s\S]*const blockingItems = getContextGateRepairBlockingItems\(gateResult\);)(?=[\s\S]*const reasons = getContextGateRepairReasons\(gateResult\);)(?=[\s\S]*const normalizedReasons: ContextGateRepairReasonList = \[\];)(?=[\s\S]*for \(const item of \[[\s\S]*\.\.\.blockingItems,[\s\S]*\.\.\.reasons,[\s\S]*\]\))(?=[\s\S]*const hasReason = hasContextGateRepairReasonText\(reason\);[\s\S]*if \(hasReason === true\))(?=[\s\S]*const fieldValue = getContextGateRepairFieldValue\(field\);)(?=[\s\S]*const hasField = fieldValue\.length > 0;)(?=[\s\S]*const fieldSuffix = hasField === true \? ` · \$\{fieldValue\}` : '';)(?=[\s\S]*const hasJsonStructureField = fieldValue === 'JSON 结构';)(?=[\s\S]*const hasTargets = targets\.length > 0;[\s\S]*if \(hasTargets === true\))/,
  'context gate repair targets should derive reasons, field labels, search text and fallback target presence through explicit facts',
);
assert.doesNotMatch(
  contextGateRepairSource,
  /path: 'PROJECT_CONTEXT\.md' \| 'bootstrap_state\.json';|gateResult\?\.blocking_items \?\? \[\]|gateResult\?\.reasons \?\? \[\]|gateResult\?\.blocking_items \|\| \[\]|gateResult\?\.reasons \|\| \[\]|\.filter\(\(item\) => item\.length > 0\)|filter\(Boolean\)|field \?\? ''|field \? ` · \$\{field\}` : ''|field \? `优先检查|field \? `\$\{field\}：` : undefined|field === 'JSON 结构'\s*\?|if \(targets\.length > 0\)/,
  'context gate repair target path and field gates should not regress to inline unions or implicit field/reason fallbacks',
);
assert.match(
  workspaceTypesSource,
  /export type FoundationPanelSnapshotStatus = 'empty' \| 'ready' \| 'busy' \| 'awaiting_decisions' \| 'foundation_blocked' \| 'context_blocked' \| 'completed';[\s\S]*export type FoundationPanelSnapshotSource = 'bootstrap_state' \| 'gate_result' \| 'context_gate' \| 'decision_drafts' \| 'action_state';[\s\S]*export type FoundationPanelSnapshot = \{[\s\S]*status: FoundationPanelSnapshotStatus;[\s\S]*source: FoundationPanelSnapshotSource;[\s\S]*requiredDecisionCount: number;[\s\S]*reservedDecisionCount: number;[\s\S]*deferredDecisionCount: number;[\s\S]*blockerCount: number;[\s\S]*contextRepairTargetCount: number;[\s\S]*canConfirm: boolean;[\s\S]*recovery: string;/,
  'workspace foundation panel should be represented as a structured snapshot with named phase/source contracts plus decision, blocker and confirmability fields',
);
assert.match(
  foundationPanelSnapshotSource,
  /(?=[\s\S]*WorkspaceBootstrapState)(?=[\s\S]*FoundationPanelSnapshotSource)(?=[\s\S]*FoundationPanelSnapshotStatus)(?=[\s\S]*type FoundationPanelBooleanFactList = readonly boolean\[\];)(?=[\s\S]*type FoundationPanelBootstrapCompletedStatus = 'completed';)(?=[\s\S]*function hasFoundationPanelTrueFact\(values: FoundationPanelBooleanFactList\): boolean)(?=[\s\S]*function getFoundationPanelItemCount<TItem>\(items: readonly TItem\[\] \| undefined\): number)(?=[\s\S]*function hasFoundationPanelCount\(value: number\): boolean)(?=[\s\S]*function getFoundationPanelRequiredDecisionCount\(foundationState: WorkspaceBootstrapState \| undefined\): number)(?=[\s\S]*function getFoundationPanelReservedDecisionCount\(foundationState: WorkspaceBootstrapState \| undefined\): number)(?=[\s\S]*function getFoundationPanelDeferredDecisionCount\(foundationState: WorkspaceBootstrapState \| undefined\): number)(?=[\s\S]*function getFoundationPanelStateBlockerCount\(foundationState: WorkspaceBootstrapState \| undefined\): number)(?=[\s\S]*function getFoundationPanelGateBlockingItemCount\(foundationState: WorkspaceBootstrapState \| undefined\): number)(?=[\s\S]*function isFoundationPanelBootstrapCompleted\()(?=[\s\S]*function hasFoundationPanelFoundationGateBlock\()(?=[\s\S]*function canConfirmFoundationPanel\()(?=[\s\S]*function getFoundationPanelSnapshotStatus\()(?=[\s\S]*function getFoundationPanelSnapshotSource\()(?=[\s\S]*function getFoundationPanelSnapshotMessage\(status: FoundationPanelSnapshotStatus\): string)(?=[\s\S]*function getFoundationPanelSnapshotRecovery\(status: FoundationPanelSnapshotStatus\): string)(?=[\s\S]*export function buildFoundationPanelSnapshot\([\s\S]*\): FoundationPanelSnapshot \{)(?=[\s\S]*const requiredDecisionCount = getFoundationPanelRequiredDecisionCount\(foundationState\);)(?=[\s\S]*const reservedDecisionCount = getFoundationPanelReservedDecisionCount\(foundationState\);)(?=[\s\S]*const deferredDecisionCount = getFoundationPanelDeferredDecisionCount\(foundationState\);)(?=[\s\S]*const stateBlockerCount = getFoundationPanelStateBlockerCount\(foundationState\);)(?=[\s\S]*const gateBlockingItemCount = getFoundationPanelGateBlockingItemCount\(foundationState\);)(?=[\s\S]*const hasBlockers = hasFoundationPanelCount\(blockerCount\);)(?=[\s\S]*const hasFoundationGateBlock = hasFoundationPanelFoundationGateBlock\(\{[\s\S]*foundationGateBlocked,[\s\S]*hasBlockers,[\s\S]*\}\);)(?=[\s\S]*const hasCompletedFoundation = isFoundationPanelBootstrapCompleted\(foundationState, 'completed'\);)(?=[\s\S]*const canConfirm = canConfirmFoundationPanel\(\{[\s\S]*hasFoundationState,[\s\S]*hasAllRequiredDrafts,[\s\S]*isBusy,[\s\S]*\}\);)(?=[\s\S]*const status = getFoundationPanelSnapshotStatus\(\{[\s\S]*contextGateBlocked,[\s\S]*hasFoundationGateBlock,[\s\S]*isBusy,[\s\S]*hasFoundationState,[\s\S]*hasCompletedFoundation,[\s\S]*hasAllRequiredDrafts,[\s\S]*\}\);)(?=[\s\S]*const source = getFoundationPanelSnapshotSource\(\{[\s\S]*contextGateBlocked,[\s\S]*hasFoundationGateBlock,[\s\S]*isBusy,[\s\S]*hasAllRequiredDrafts,[\s\S]*\}\);)(?=[\s\S]*const message = getFoundationPanelSnapshotMessage\(status\);)(?=[\s\S]*const recovery = getFoundationPanelSnapshotRecovery\(status\);)(?=[\s\S]*'context_blocked')(?=[\s\S]*'foundation_blocked')(?=[\s\S]*'busy')(?=[\s\S]*'empty')(?=[\s\S]*'completed')(?=[\s\S]*'awaiting_decisions')(?=[\s\S]*'ready')/,
  'workspace foundation panel snapshot helper should derive all Foundation panel phases from gate, draft, blocker and busy facts while consuming named snapshot contracts',
);
assert.doesNotMatch(
  foundationPanelSnapshotSource,
  /FoundationPanelSnapshot\['status'\]|FoundationPanelSnapshot\['source'\]|Boolean\(|!foundationState|!hasAllRequiredDrafts|foundationState\?\.required_decisions\?\.length \?\? 0|foundationState\?\.reserved_extensions\?\.length \?\? 0|foundationState\?\.deferred_decisions\?\.length \?\? 0|foundationState\?\.blockers\?\.length \?\? 0|foundationState\?\.gate_result\?\.blocking_items\?\.length \?\? 0|required_decisions\?\.length \|\| 0|reserved_extensions\?\.length \|\| 0|deferred_decisions\?\.length \|\| 0|blockers\?\.length \|\| 0|blocking_items\?\.length \|\| 0|foundationGateBlocked === true \|\| hasBlockers === true|foundationGateBlocked \|\| blockerCount > 0|hasFoundationState === true[\s\S]*&& hasAllRequiredDrafts === true[\s\S]*&& isBusy === false|status: FoundationPanelSnapshotStatus = contextGateBlocked\s*\?|source: FoundationPanelSnapshotSource = contextGateBlocked\s*\?|message: status === 'context_blocked'|recovery: status === 'empty'/,
  'workspace foundation panel snapshot helper should not infer status/source from indexed snapshot access or implicit Boolean/count/presence gates',
);
assert.doesNotMatch(
  foundationPanelSnapshotSource,
  /values\.find\(|const matchedValue = values\.find/,
  'workspace foundation panel snapshot helper should not regress boolean fact scans to Array.find callbacks',
);
assert.match(
  foundationPanelSource,
  /import \{ buildFoundationPanelSnapshot \} from '\.\/workspace-foundation-panel-snapshot';[\s\S]*const foundationPanelSnapshot = buildFoundationPanelSnapshot\(\{[\s\S]*foundationState,[\s\S]*contextGateBlocked,[\s\S]*foundationGateBlocked,[\s\S]*contextRepairTargetCount: contextRepairTargets\.length,[\s\S]*hasAllRequiredDrafts,[\s\S]*isBusy,/,
  'workspace foundation panel should use the shared snapshot helper with authoritative Foundation facts',
);
assert.match(
  foundationPanelSource,
  /type FoundationDecisionDraftMap = \{[\s\S]*\[decisionId: string\]: FoundationDecisionDraft;[\s\S]*type FoundationDecisionDraftPatch = Partial<FoundationDecisionDraft>;[\s\S]*drafts: FoundationDecisionDraftMap,[\s\S]*onDraftChange: \(id: string, patch: FoundationDecisionDraftPatch\) => void,[\s\S]*function materializeFoundationDecisionDraftMap\(\{[\s\S]*previousDrafts,[\s\S]*editableAllDecisions,[\s\S]*\}: \{[\s\S]*previousDrafts: FoundationDecisionDraftMap;[\s\S]*editableAllDecisions: FoundationDecisionItemList;[\s\S]*\}\): FoundationDecisionDraftMap \{[\s\S]*const nextDrafts: FoundationDecisionDraftMap = \{\};[\s\S]*useState<FoundationDecisionDraftMap>\(\{\}\)[\s\S]*const handleDraftChange = \(id: string, patch: FoundationDecisionDraftPatch\)/,
  'workspace foundation panel should keep decision draft state behind named draft map and patch contracts',
);
assert.doesNotMatch(
  foundationPanelSource,
  /Record<string, FoundationDecisionDraft>|Partial<FoundationDecisionDraft>\) => void|Partial<FoundationDecisionDraft>\) => \{/,
  'workspace foundation panel decision drafts should not regress to anonymous Record state or inline draft patch signatures',
);
assert.match(
  foundationPanelSource,
  /(?=[\s\S]*import type \{ ContextGateRepairTarget \} from '\.\/context-gate-repair';)(?=[\s\S]*function getFoundationOptionalTextValue\(value: string \| undefined\): string)(?=[\s\S]*function getFoundationFallbackTextValue\(value: string \| undefined, fallback: string\): string)(?=[\s\S]*function getFoundationDefaultDecisionSelectedOption\(item: WorkspaceBootstrapDecisionItem\): string \{[\s\S]*const selectedOption = getFoundationDecisionItemSelectedOption\(item\);[\s\S]*const hasSelectedOption = selectedOption\.length > 0;[\s\S]*if \(hasSelectedOption === true\)[\s\S]*return selectedOption;[\s\S]*return getFoundationDecisionItemRecommendedOption\(item\);)(?=[\s\S]*function getDefaultDecisionDraft\(item: WorkspaceBootstrapDecisionItem\): FoundationDecisionDraft \{[\s\S]*selectedOption: getFoundationDefaultDecisionSelectedOption\(item\),)(?=[\s\S]*function getFoundationDecisionDisplayTitle\(item: WorkspaceBootstrapDecisionItem\)[\s\S]*const hasTitle = title\.length > 0;[\s\S]*const hasId = id\.length > 0;)(?=[\s\S]*function getDecisionDraftInputValue\([\s\S]*field: keyof FoundationDecisionDraft,[\s\S]*const hasDecisionId = decisionId\.length > 0;[\s\S]*if \(hasDecisionId === false\) return '';)(?=[\s\S]*function getDecisionRecommendedOptionPlaceholder\(item: WorkspaceBootstrapDecisionItem\)[\s\S]*const hasRecommendedOption = recommendedOption\.length > 0;[\s\S]*if \(hasRecommendedOption === true\)[\s\S]*return recommendedOption;[\s\S]*return '填写当前确认选项';)(?=[\s\S]*function getContextRepairTargetKey\(target: ContextGateRepairTarget\)[\s\S]*const field = getFoundationFallbackTextValue\(target\.field, 'default'\);)(?=[\s\S]*function hasFoundationDecisionId\(item: WorkspaceBootstrapDecisionItem\)[\s\S]*return decisionId\.length > 0;)/,
  'workspace foundation panel should derive decision defaults, display labels, draft inputs and repair target keys through explicit helper facts',
);
assert.match(
  foundationPanelSource,
  /(?=[\s\S]*type FoundationDecisionItemKeyInput = \{[\s\S]*itemId: string;[\s\S]*itemTitle: string;[\s\S]*listTitle: string;[\s\S]*index: number;)(?=[\s\S]*type FoundationDecisionListMaterializerInput = \{[\s\S]*title: string;[\s\S]*decisionItems: FoundationDecisionItemList;[\s\S]*drafts: FoundationDecisionDraftMap;[\s\S]*editable: boolean;)(?=[\s\S]*function getFoundationDecisionItemKey\(\{[\s\S]*itemId,[\s\S]*itemTitle,[\s\S]*listTitle,[\s\S]*index,[\s\S]*\}: FoundationDecisionItemKeyInput\): string)(?=[\s\S]*const hasItemId = itemId\.length > 0;[\s\S]*if \(hasItemId === true\)[\s\S]*return itemId;)(?=[\s\S]*const hasItemTitle = itemTitle\.length > 0;[\s\S]*if \(hasItemTitle === true\)[\s\S]*return itemTitle;)(?=[\s\S]*return `\$\{listTitle\}-\$\{index\}`;)(?=[\s\S]*function getFoundationDecisionItemList\([\s\S]*items: FoundationDecisionItemList \| undefined,[\s\S]*\): FoundationDecisionItemList)(?=[\s\S]*function materializeFoundationDecisionItemNodes\(\{[\s\S]*title,[\s\S]*decisionItems,[\s\S]*drafts,[\s\S]*onDraftChange,[\s\S]*editable,[\s\S]*\}: FoundationDecisionListMaterializerInput\): FoundationDecisionItemNodeList \{[\s\S]*const nodes: FoundationDecisionItemNodeList = \[\];[\s\S]*for \(let index = 0; index < decisionItems\.length; index \+= 1\)[\s\S]*const item = decisionItems\[index\];[\s\S]*if \(item === undefined\)[\s\S]*const itemId = getFoundationDecisionId\(item\);[\s\S]*const hasItemId = itemId\.length > 0;[\s\S]*const itemKey = getFoundationDecisionItemKey\(\{[\s\S]*listTitle: title,[\s\S]*index,[\s\S]*\}\);[\s\S]*const hasDomain = domain\.length > 0;[\s\S]*const hasRecommendedOption = recommendedOption\.length > 0;[\s\S]*const hasSelectedOption = selectedOption\.length > 0;[\s\S]*const shouldRenderEditableDraft = hasItemId === true && editable === true;[\s\S]*nodes\.push\([\s\S]*\{hasDomain === true &&[\s\S]*\{hasRecommendedOption === true &&[\s\S]*\{shouldRenderEditableDraft === true \?[\s\S]*return nodes;)(?=[\s\S]*const decisionItems = getFoundationDecisionItemList\(items\);[\s\S]*const hasDecisionItems = decisionItems\.length > 0;[\s\S]*if \(hasDecisionItems === false\) return null;)(?=[\s\S]*materializeFoundationDecisionItemNodes\(\{[\s\S]*title,[\s\S]*decisionItems,[\s\S]*drafts,[\s\S]*onDraftChange,[\s\S]*editable,[\s\S]*\}\))/,
  'workspace foundation panel decision list should render from explicit item presence, draft and display gates',
);
assert.match(
  foundationPanelSource,
  /(?=[\s\S]*type FoundationTextItemList = string\[\];)(?=[\s\S]*function hasFoundationTextItem\(value: string\): boolean)(?=[\s\S]*function getFoundationNonEmptyTextItems\(items: FoundationTextItemList\): FoundationTextItemList)(?=[\s\S]*for \(const item of items\))(?=[\s\S]*function getFoundationRecoveryStageParts\(resumeStage: string, resumeMode: string\): FoundationTextItemList)(?=[\s\S]*function getFoundationRecoveryDisplayStageParts\([\s\S]*recovery: WorkspaceRecoveryState \| undefined,[\s\S]*\): FoundationTextItemList \{[\s\S]*const resumeStage = getFoundationRecoveryResumeStage\(recovery\);[\s\S]*const resumeMode = getFoundationRecoveryResumeMode\(recovery\);[\s\S]*return getFoundationRecoveryStageParts\(resumeStage, resumeMode\);)(?=[\s\S]*function getFoundationRecoveryStageLabel\(recoveryStageParts: FoundationTextItemList\): string \{[\s\S]*let label = '';[\s\S]*for \(const item of recoveryStageParts\))(?=[\s\S]*function getFoundationRecoveryRetryDisplayLabel\(\{[\s\S]*retryLabel,[\s\S]*retryFallbackLabel,[\s\S]*\}: \{[\s\S]*retryLabel: string;[\s\S]*retryFallbackLabel: string;[\s\S]*\}\): string)(?=[\s\S]*function getFoundationEngineeringNextAction\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*\): string)(?=[\s\S]*function getFoundationEngineeringRecovery\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*\): WorkspaceRecoveryState \| undefined)(?=[\s\S]*function getFoundationRecoveryResumeStage\(recovery: WorkspaceRecoveryState \| undefined\): string)(?=[\s\S]*function getFoundationRecoveryResumeMode\(recovery: WorkspaceRecoveryState \| undefined\): string)(?=[\s\S]*function canRetryFoundationRecovery\(recovery: WorkspaceRecoveryState \| undefined\): boolean)(?=[\s\S]*function getFoundationRecoveryRetryLabel\(recovery: WorkspaceRecoveryState \| undefined\): string)(?=[\s\S]*const nextAction = getFoundationEngineeringNextAction\(engineeringState\);[\s\S]*const hasNextAction = nextAction\.length > 0;)(?=[\s\S]*const recovery = getFoundationEngineeringRecovery\(engineeringState\);[\s\S]*const hasRecovery = recovery !== undefined;[\s\S]*if \(hasNextAction === false && hasRecovery === false\) return null;)(?=[\s\S]*const recoveryStageParts = getFoundationRecoveryDisplayStageParts\(recovery\);)(?=[\s\S]*const hasRecoveryStageParts = recoveryStageParts\.length > 0;)(?=[\s\S]*const recoveryStageLabel = getFoundationRecoveryStageLabel\(recoveryStageParts\);)(?=[\s\S]*const canRetry = canRetryFoundationRecovery\(recovery\);)(?=[\s\S]*const retryDisplayLabel = getFoundationRecoveryRetryDisplayLabel\(\{[\s\S]*retryLabel,[\s\S]*retryFallbackLabel,)(?=[\s\S]*恢复阶段：\{recoveryStageLabel\})(?=[\s\S]*重试入口：\{retryDisplayLabel\})(?=[\s\S]*\{hasNextAction === true &&)(?=[\s\S]*\{hasRecoveryStageParts === true &&)(?=[\s\S]*\{canRetry === true &&)/,
  'workspace foundation panel recovery summary should derive next action, resume labels and retry display through explicit facts and scan helpers',
);
assert.match(
  foundationPanelSource,
  /function getFoundationAllDecisions\([\s\S]*foundationState: WorkspaceBootstrapState \| undefined,[\s\S]*\): FoundationDecisionItemList \{[\s\S]*\.\.\.getFoundationRequiredDecisions\(foundationState\),[\s\S]*\.\.\.getFoundationReservedDecisions\(foundationState\),[\s\S]*\.\.\.getFoundationDeferredDecisions\(foundationState\),/,
  'workspace foundation panel should derive the complete editable decision list from all three decision buckets',
);
assert.match(
  foundationPanelSource,
  /function materializeFoundationDecisionDraftMap\([\s\S]*for \(const item of editableAllDecisions\)[\s\S]*const decisionId = getFoundationDecisionId\(item\);[\s\S]*nextDrafts\[decisionId\] = getFoundationDecisionDraftOrDefault\(previousDrafts, decisionId, item\);/,
  'workspace foundation panel should restore decision drafts through explicit decision id readers and a for-of scan',
);
assert.match(
  foundationPanelSource,
  /function materializeFoundationDecisionConfirmationPayload\([\s\S]*for \(const item of editableAllDecisions\)[\s\S]*const selectedOption = getFoundationDecisionConfirmationSelectedOption\(item, decisionDrafts\);[\s\S]*const notes = getFoundationDecisionConfirmationNotes\(item, decisionDrafts\);[\s\S]*confirmationPayload\.push\(/,
  'workspace foundation panel should build confirmation payloads through named readers and a for-of scan',
);
assert.match(
  foundationPanelSource,
  /const editableAllDecisions = getFoundationAllDecisions\(foundationState\);[\s\S]*editableAllDecisions: getFoundationAllDecisions\(foundationState\),[\s\S]*\}, \[foundationState\]\);[\s\S]*const confirmationPayload = materializeFoundationDecisionConfirmationPayload\(\{[\s\S]*editableAllDecisions,[\s\S]*decisionDrafts,[\s\S]*\}\);[\s\S]*const hasAllRequiredDrafts = hasAllFoundationRequiredDecisionDrafts\(/,
  'workspace foundation panel should key draft restoration to the Foundation snapshot and derive confirmation payloads without mutable-array memo dependencies',
);
assert.match(
  foundationPanelSource,
  /(?=[\s\S]*type FoundationNextActionInput = \{[\s\S]*gateNextAction: string;[\s\S]*foundationNextAction: string;)(?=[\s\S]*function shouldRenderFoundationNextAction\(\{[\s\S]*gateNextAction,[\s\S]*foundationNextAction,[\s\S]*\}: FoundationNextActionInput\): boolean)(?=[\s\S]*function getFoundationDisplayedNextAction\(\{[\s\S]*gateNextAction,[\s\S]*foundationNextAction,[\s\S]*\}: FoundationNextActionInput\): string)(?=[\s\S]*function getFoundationBootstrapState\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*\): WorkspaceBootstrapState \| undefined)(?=[\s\S]*function hasFoundationContextGateBlock\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*\): boolean)(?=[\s\S]*function hasFoundationGateBlock\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*foundationState: WorkspaceBootstrapState \| undefined,[\s\S]*\): boolean)(?=[\s\S]*function getFoundationTemplateId\(foundationState: WorkspaceBootstrapState \| undefined\): string)(?=[\s\S]*function getFoundationGateDecision\(foundationState: WorkspaceBootstrapState \| undefined\): string)(?=[\s\S]*function getFoundationRiskLevel\(foundationState: WorkspaceBootstrapState \| undefined\): string)(?=[\s\S]*function getFoundationGateNextAction\(foundationState: WorkspaceBootstrapState \| undefined\): string)(?=[\s\S]*function getFoundationNextAction\(foundationState: WorkspaceBootstrapState \| undefined\): string)(?=[\s\S]*function getFoundationBlockingItems\([\s\S]*foundationBlockers: FoundationBlockingItemList,[\s\S]*gateBlockingItems: FoundationBlockingItemList,[\s\S]*\): FoundationBlockingItemList)(?=[\s\S]*return getFoundationNonEmptyTextItems\(\[[\s\S]*\.\.\.foundationBlockers,[\s\S]*\.\.\.gateBlockingItems,[\s\S]*\]\);)(?=[\s\S]*const foundationState = getFoundationBootstrapState\(engineeringState\);)(?=[\s\S]*const contextGateBlocked = hasFoundationContextGateBlock\(engineeringState\);)(?=[\s\S]*const foundationGateBlocked = hasFoundationGateBlock\(engineeringState, foundationState\);)(?=[\s\S]*const templateId = getFoundationTemplateId\(foundationState\);[\s\S]*const hasTemplateId = templateId\.length > 0;)(?=[\s\S]*const gateDecision = getFoundationGateDecision\(foundationState\);[\s\S]*const hasGateDecision = gateDecision\.length > 0;)(?=[\s\S]*const gateNextAction = getFoundationGateNextAction\(foundationState\);)(?=[\s\S]*const foundationNextAction = getFoundationNextAction\(foundationState\);)(?=[\s\S]*const shouldRenderNextAction = shouldRenderFoundationNextAction\(\{[\s\S]*gateNextAction,[\s\S]*foundationNextAction,)(?=[\s\S]*const displayedNextAction = getFoundationDisplayedNextAction\(\{[\s\S]*gateNextAction,[\s\S]*foundationNextAction,)(?=[\s\S]*const foundationBlockers = getFoundationStateBlockers\(foundationState\);)(?=[\s\S]*const gateBlockingItems = getFoundationGateBlockingItems\(foundationState\);)(?=[\s\S]*const blockingItems = getFoundationBlockingItems\(foundationBlockers, gateBlockingItems\);)(?=[\s\S]*const hasBlockingItems = blockingItems\.length > 0;)(?=[\s\S]*const hasContextRepairTargets = contextRepairTargets\.length > 0;)(?=[\s\S]*const hasFoundationState = foundationState !== undefined;)/,
  'workspace foundation panel metadata, next action, blocker and section visibility gates should use explicit facts and scan helpers',
);
assert.match(
  foundationPanelSource,
  /(?=[\s\S]*import type \{ ReactNode \} from 'react';)(?=[\s\S]*type FoundationContextRepairTargetNodeList = ReactNode\[\];)(?=[\s\S]*type FoundationBlockingItemNodeList = ReactNode\[\];)(?=[\s\S]*function materializeFoundationContextRepairTargetDetailNodes\([\s\S]*contextRepairTargets: ContextGateRepairTarget\[\],[\s\S]*\): FoundationContextRepairTargetNodeList \{[\s\S]*const nodes: FoundationContextRepairTargetNodeList = \[\];[\s\S]*for \(const target of contextRepairTargets\)[\s\S]*<div key=\{getContextRepairTargetKey\(target\)\}>[\s\S]*<div>- \{target\.reason\}<\/div>[\s\S]*<div className="pl-3 text-muted-foreground">\{target\.suggestion\}<\/div>[\s\S]*return nodes;)(?=[\s\S]*function materializeFoundationContextRepairTargetActionNodes\(\{[\s\S]*contextRepairTargets,[\s\S]*onOpenFoundationFile,[\s\S]*\}: \{[\s\S]*contextRepairTargets: ContextGateRepairTarget\[\];[\s\S]*onOpenFoundationFile: WorkspaceFoundationOpenFileAction;[\s\S]*\}\): FoundationContextRepairTargetNodeList \{[\s\S]*const nodes: FoundationContextRepairTargetNodeList = \[\];[\s\S]*for \(const target of contextRepairTargets\)[\s\S]*<Button[\s\S]*key=\{getContextRepairTargetKey\(target\)\}[\s\S]*onClick=\{\(\) => onOpenFoundationFile\(\{[\s\S]*path: target\.path,[\s\S]*searchText: target\.searchText,[\s\S]*label: target\.label,[\s\S]*\}\)\}[\s\S]*\{target\.label\}[\s\S]*return nodes;)(?=[\s\S]*function materializeFoundationBlockingItemNodes\([\s\S]*blockingItems: FoundationBlockingItemList,[\s\S]*\): FoundationBlockingItemNodeList \{[\s\S]*const nodes: FoundationBlockingItemNodeList = \[\];[\s\S]*for \(let index = 0; index < blockingItems\.length; index \+= 1\)[\s\S]*const item = blockingItems\[index\];[\s\S]*if \(item === undefined\)[\s\S]*<li key=\{`\$\{item\}-\$\{index\}`\}>- \{item\}<\/li>[\s\S]*return nodes;)(?=[\s\S]*materializeFoundationContextRepairTargetDetailNodes\(contextRepairTargets\))(?=[\s\S]*materializeFoundationContextRepairTargetActionNodes\(\{[\s\S]*contextRepairTargets,[\s\S]*onOpenFoundationFile,[\s\S]*\}\))(?=[\s\S]*materializeFoundationBlockingItemNodes\(blockingItems\))/,
  'workspace foundation panel repair targets and blocking items should render through named node materializers',
);
assert.doesNotMatch(
  foundationPanelSource,
  /status \|\| '未记录'|status \?\? '未记录'|item\.selected_option \|\| item\.recommended_option \|\| ''|item\.selected_option \?\? ''|item\.recommended_option \?\? ''|item\.notes \?\? ''|item\.title \?\? ''|item\.id \?\? ''|item\.domain \?\? ''|if \(!items \|\| items\.length === 0\)|items \?\? \[\]|item\.title \|\| item\.id \|\| '未命名决策'|drafts\[item\.id\]\?\.selectedOption \|\| ''|item\.recommended_option \|\| '填写当前确认选项'|selectedOption: hasSelectedOption === true \? selectedOption : recommendedOption|hasRecommendedOption === true \? recommendedOption : '填写当前确认选项'|hasResumeStage === true \? resumeStage : ''|hasResumeMode === true \? resumeMode : ''|recoveryStageParts\.join\(' \/ '\)|hasRetryLabel === true \? retryLabel : retryFallbackLabel|hasGateNextAction === true \? gateNextAction : foundationNextAction|drafts\[item\.id\]\?\.notes \|\| ''|draft\?\.selectedOption \?\? ''|decisionDrafts\[decisionId\]\?\.selectedOption \?\? ''|prev\[[^\]]+\] \?\?|editableRequiredDecisions\.every\(|\.filter\(\(item\) => item\.length > 0\)|decisionItems\.map\(|editableAllDecisions\.forEach\(|editableAllDecisions\.map\(|contextRepairTargets\.map\(|blockingItems\.map\(|if \(!nextAction && !recovery\)|filter\(Boolean\)|engineeringState\?\.|recovery\?\.|foundationState\?\.|if \(!item\.id\)|Boolean\(selectedOption\?\.trim\(\)\)|disabled=\{isBusy \|\| !hasAllRequiredDrafts\}|target\.field \|\| 'default'|target\.field \?\? 'default'|item\.id!/,
  'workspace foundation panel should not regress to legacy OR fallback, inline optional draft fallback, every scans, filter(Boolean), Boolean drafts, item.id! or implicit disabled gates',
);
assert.match(
  workspaceTypesSource,
  /export type GitPanelSnapshotStatus = 'empty' \| 'fresh' \| 'list_stale_with_cache' \| 'list_stale_without_cache' \| 'detail_stale' \| 'selected' \| 'diff_empty';[\s\S]*export type GitPanelSnapshotSource = 'commit_list' \| 'list_status' \| 'detail_status' \| 'selection' \| 'diff';[\s\S]*export type GitPanelSnapshot = \{[\s\S]*status: GitPanelSnapshotStatus;[\s\S]*source: GitPanelSnapshotSource;[\s\S]*commitCount: number;[\s\S]*hasSelectedCommit: boolean;[\s\S]*selectedHash: string;[\s\S]*diffFileCount: number;[\s\S]*listStatus: GitCommitListStatusValue \| 'unknown';[\s\S]*detailStatus: GitCommitDetailStatusValue \| 'none';[\s\S]*recovery: string;/,
  'workspace Git panel should be represented as a structured snapshot with phase, source, commit, selection, diff and freshness fields',
);
assert.match(
  workspaceTypesSource,
  /export type WorkspacePanelSurface = 'desktop' \| 'mobile';[\s\S]*export type PreviewPanelSnapshot = \{[\s\S]*status: PreviewPanelSnapshotStatus;[\s\S]*source: PreviewPanelSnapshotSource;[\s\S]*surface: WorkspacePanelSurface;[\s\S]*device: WorkspaceBrowserDevice;[\s\S]*url: string;[\s\S]*urlStatus: PreviewUrlStatusValue \| 'unknown';[\s\S]*canReload: boolean;[\s\S]*canOpenRuntimeHome: boolean;[\s\S]*hasIframeError: boolean;[\s\S]*recovery: string;/,
  'workspace Preview panel should be represented as a structured snapshot with named phase/source contracts plus surface, device, URL, reload, runtime home and iframe error fields',
);
assert.match(
  mobilePreviewPanelSource,
  /(?=[\s\S]*function getMobilePreviewProjectId\(projectId: string \| null\): string \| null[\s\S]*projectId === null[\s\S]*const hasProjectId = projectId\.length > 0;[\s\S]*hasProjectId === true)(?=[\s\S]*function getMobilePreviewRuntimeHomeUrl\(runtimeStatus: ProjectRuntimeStatus \| undefined\): string[\s\S]*runtimeStatus === undefined[\s\S]*const previewUrl = runtimeStatus\.previewUrl;[\s\S]*if \(previewUrl === undefined\)[\s\S]*return previewUrl\.trim\(\);)(?=[\s\S]*function hasMobilePreviewTextValue\(value: string\): boolean[\s\S]*return hasValue === true;)(?=[\s\S]*function getMobilePreviewRenderableUrlStatus\([\s\S]*mobilePreviewUrlStatus: PreviewUrlStatus \| null,[\s\S]*\): PreviewUrlStatus \| null)(?=[\s\S]*function getMobilePreviewNavigationUrl\(rawUrl: string\): string \| null[\s\S]*hasMobilePreviewTextValue\(rawUrl\) === false[\s\S]*const hasProtocol = rawUrl\.startsWith\('http'\);[\s\S]*hasProtocol === true)(?=[\s\S]*function getMobilePreviewBrowserInputValue\(mobileBrowserUrl: string\): string \{[\s\S]*if \(mobileBrowserUrl === 'about:blank'\)[\s\S]*return '';[\s\S]*return mobileBrowserUrl;)(?=[\s\S]*function shouldRenderMobilePreviewIframe\(normalizedMobileBrowserUrl: string\): boolean)(?=[\s\S]*function shouldStartMobilePreviewRuntimeHeartbeat\([\s\S]*activeProjectId: string \| null,[\s\S]*normalizedMobileBrowserUrl: string,[\s\S]*\): activeProjectId is string)(?=[\s\S]*function getMobilePreviewRenderableStatusMessage\(message: string\): string \| null)(?=[\s\S]*const runtimeHomeUrl = getMobilePreviewRuntimeHomeUrl\(runtimeStatus\);)(?=[\s\S]*const hasRuntimeHomeUrl = hasMobilePreviewTextValue\(runtimeHomeUrl\);)(?=[\s\S]*const \[mobileBrowserUrlDraft, setMobileBrowserUrlDraft\] = useState\(\(\) => getMobilePreviewBrowserInputValue\(mobileBrowserUrl\)\);)(?=[\s\S]*const shouldRenderPreviewIframe = shouldRenderMobilePreviewIframe\(normalizedMobileBrowserUrl\);)(?=[\s\S]*const activeProjectId = getMobilePreviewProjectId\(projectId\);[\s\S]*const shouldStartHeartbeat = shouldStartMobilePreviewRuntimeHeartbeat\(activeProjectId, normalizedMobileBrowserUrl\);[\s\S]*if \(shouldStartHeartbeat === false\))(?=[\s\S]*projectApi\.touchRuntimeActivity\(activeProjectId\))(?=[\s\S]*const renderableMobilePreviewUrlStatus = getMobilePreviewRenderableUrlStatus\(mobilePreviewUrlStatus\);)(?=[\s\S]*const renderablePreviewIframeError = getMobilePreviewRenderableStatusMessage\(previewIframeError\);)(?=[\s\S]*if \(hasRuntimeHomeUrl === false\))(?=[\s\S]*value=\{mobileBrowserUrlDraft\})(?=[\s\S]*const navigationUrl = getMobilePreviewNavigationUrl\(rawUrl\);[\s\S]*if \(navigationUrl === null\))(?=[\s\S]*disabled=\{hasRuntimeHomeUrl === false\})(?=[\s\S]*\{renderableMobilePreviewUrlStatus !== null &&)(?=[\s\S]*\{shouldRenderPreviewIframe === true \?)(?=[\s\S]*\{renderablePreviewIframeError !== null &&)/,
  'workspace mobile Preview panel should derive runtime home, heartbeat, navigation input and status/error rendering through explicit facts',
);
assert.doesNotMatch(
  mobilePreviewPanelSource,
  /runtimeStatus\?\.previewUrl|if \(!projectId|if \(!rawUrl\)|runtimeHomeUrl\.length === 0|mobilePreviewUrlStatus &&|previewIframeError \?|mobileBrowserUrl === 'about:blank' \? '' : mobileBrowserUrl|activeProjectId === null \|\| normalizedMobileBrowserUrl === 'about:blank'|normalizedMobileBrowserUrl !== 'about:blank' \?/,
  'workspace mobile Preview panel should not regress to optional, truthy or inline URL/status/error gates',
);
assert.match(
  workspaceTypesSource,
  /export type ExplorerPanelSnapshotStatus = 'empty_tree' \| 'filtered_empty' \| 'ready' \| 'stale_snapshot' \| 'local_changes' \| 'stream_preview' \| 'active_dirty' \| 'active_stale';[\s\S]*export type ExplorerPanelSnapshotSource = 'file_tree' \| 'search_filter' \| 'explorer_snapshot' \| 'editor_buffer' \| 'open_files';[\s\S]*export type ExplorerPanelSnapshot = \{[\s\S]*status: ExplorerPanelSnapshotStatus;[\s\S]*source: ExplorerPanelSnapshotSource;[\s\S]*hasOriginalFileTreeData: boolean;[\s\S]*filteredItemCount: number;[\s\S]*openFileCount: number;[\s\S]*hasActiveFile: boolean;[\s\S]*activeFile: string;[\s\S]*activeBufferStatus: EditorBufferStatusValue \| 'none';[\s\S]*isActiveDirty: boolean;[\s\S]*searchQuery: string;[\s\S]*recovery: string;/,
  'workspace Explorer panel should be represented as a structured snapshot with named phase/source contracts plus tree, filter, open file and named editor buffer fields',
);
assert.match(
  workspaceTypesSource,
  /export type WorkspacePanelSurface = 'desktop' \| 'mobile';[\s\S]*export type EditorPanelSnapshot = \{[\s\S]*status: EditorPanelSnapshotStatus;[\s\S]*source: EditorPanelSnapshotSource;[\s\S]*surface: WorkspacePanelSurface;[\s\S]*activeFile: string;[\s\S]*bufferStatus: EditorBufferStatusValue \| 'none';[\s\S]*isDirty: boolean;[\s\S]*canSave: boolean;[\s\S]*canCopy: boolean;[\s\S]*hasNavigationTarget: boolean;[\s\S]*contentLength: number;[\s\S]*recovery: string;/,
  'workspace Editor panel should be represented as a structured snapshot with named phase/source contracts plus surface, active file, buffer, dirty, action and navigation fields',
);
assert.match(
  chatComposerSnapshotSource,
  /(?=[\s\S]*ChatInputSnapshotStatus)(?=[\s\S]*ChatInputSnapshotSource)(?=[\s\S]*export function buildChatInputSnapshot\([\s\S]*\): ChatInputSnapshot \{)(?=[\s\S]*const hasPrompt = promptLength > 0;)(?=[\s\S]*const hasSelectedModel = selectedModel\.length > 0;)(?=[\s\S]*const canSendBase = planSelectionPending === false[\s\S]*hasPrompt === true[\s\S]*isBusyGenerating === false;)(?=[\s\S]*canSend: canSendBase)(?=[\s\S]*selectedModel: hasSelectedModel === true \? selectedModel : 'default')(?=[\s\S]*updatedAt: 'derived')(?=[\s\S]*if \(isStopConfirming === true\)[\s\S]*status: ChatInputSnapshotStatus = 'stop_confirmation'[\s\S]*source: ChatInputSnapshotSource = 'stop_control')(?=[\s\S]*if \(isGenerating === true\)[\s\S]*status: ChatInputSnapshotStatus = 'generating'[\s\S]*source: ChatInputSnapshotSource = 'generation_state')(?=[\s\S]*if \(isPlanning === true\)[\s\S]*status: ChatInputSnapshotStatus = 'planning'[\s\S]*source: ChatInputSnapshotSource = 'generation_state')(?=[\s\S]*if \(planSelectionPending === true\)[\s\S]*status: ChatInputSnapshotStatus = 'plan_selection_required'[\s\S]*source: ChatInputSnapshotSource = 'plan_selection')(?=[\s\S]*if \(hasPrompt === false\)[\s\S]*status: ChatInputSnapshotStatus = 'empty_prompt'[\s\S]*source: ChatInputSnapshotSource = 'input_buffer')(?=[\s\S]*status: ChatInputSnapshotStatus = 'model_unconfigured'[\s\S]*source: ChatInputSnapshotSource = 'model_registry')(?=[\s\S]*status: ChatInputSnapshotStatus = 'ready_to_send'[\s\S]*source: ChatInputSnapshotSource = 'input_buffer')/,
  'workspace chat input snapshot helper should derive all input/send phases without render-time timestamps',
);
assert.doesNotMatch(
  chatComposerSnapshotSource,
  /ChatInputSnapshot\['status'\]|ChatInputSnapshot\['source'\]/,
  'workspace chat input snapshot helper should not infer status/source from indexed snapshot access',
);
assert.doesNotMatch(
  chatComposerSnapshotSource,
  /canSend: !planSelectionPending|&& !isBusyGenerating|if \(isStopConfirming\) \{[\s\S]{0,120}ChatInputSnapshotStatus|if \(isGenerating\) \{[\s\S]{0,120}ChatInputSnapshotStatus|if \(isPlanning\) \{[\s\S]{0,120}ChatInputSnapshotStatus|if \(planSelectionPending\) \{[\s\S]{0,120}ChatInputSnapshotStatus|selectedModel: selectedModel \|\| 'default',\n    modelCount,\n    updatedAt: 'derived'/,
  'workspace chat input snapshot helper should not regress to implicit send capability, busy or selected-model gates',
);
assert.match(
  chatComposerSnapshotSource,
  /(?=[\s\S]*ChatModeSnapshotStatus)(?=[\s\S]*ChatModeSnapshotSource)(?=[\s\S]*export function buildChatModeSnapshot\([\s\S]*\): ChatModeSnapshot \{)(?=[\s\S]*const isDiscussMode = chatMode === 'discuss';)(?=[\s\S]*const isImplementMode = chatMode === 'implement';)(?=[\s\S]*const hasOnlineMode = isOnline === true;)(?=[\s\S]*const hasBusyGeneration = isBusyGenerating === true;)(?=[\s\S]*isBusy: hasBusyGeneration)(?=[\s\S]*updatedAt: 'derived')(?=[\s\S]*if \(isStopConfirming === true\)[\s\S]*status: ChatModeSnapshotStatus = 'stop_confirmation'[\s\S]*source: ChatModeSnapshotSource = 'stop_control')(?=[\s\S]*if \(isGenerating === true\)[\s\S]*status: ChatModeSnapshotStatus = 'generating'[\s\S]*source: ChatModeSnapshotSource = 'generation_state')(?=[\s\S]*if \(isPlanning === true\)[\s\S]*status: ChatModeSnapshotStatus = 'planning'[\s\S]*source: ChatModeSnapshotSource = 'generation_state')(?=[\s\S]*hasOnlineMode === true && isDiscussMode === true[\s\S]*status: ChatModeSnapshotStatus = 'online_discuss'[\s\S]*source: ChatModeSnapshotSource = 'online_toggle')(?=[\s\S]*hasOnlineMode === true && isImplementMode === true[\s\S]*status: ChatModeSnapshotStatus = 'online_implement'[\s\S]*source: ChatModeSnapshotSource = 'online_toggle')(?=[\s\S]*if \(isDiscussMode === true\)[\s\S]*status: ChatModeSnapshotStatus = 'discuss_ready'[\s\S]*source: ChatModeSnapshotSource = 'mode_toggle')(?=[\s\S]*status: ChatModeSnapshotStatus = 'implement_ready'[\s\S]*source: ChatModeSnapshotSource = 'mode_toggle')/,
  'workspace chat mode snapshot helper should derive mode, online and busy phases without render-time timestamps',
);
assert.doesNotMatch(
  chatComposerSnapshotSource,
  /ChatModeSnapshot\['status'\]|ChatModeSnapshot\['source'\]/,
  'workspace chat mode snapshot helper should not infer status/source from indexed snapshot access',
);
assert.doesNotMatch(
  chatComposerSnapshotSource,
  /if \(isStopConfirming\) \{[\s\S]{0,120}ChatModeSnapshotStatus|if \(isGenerating\) \{[\s\S]{0,120}ChatModeSnapshotStatus|if \(isPlanning\) \{[\s\S]{0,120}ChatModeSnapshotStatus|if \(isOnline && chatMode ===|if \(chatMode === 'discuss'\)|isBusy: isBusyGenerating|chatMode === 'implement' \? '实现' : '探讨'|isOnline \? '已开启' : '未开启'/,
  'workspace chat mode snapshot helper should not regress to implicit mode, online or busy gates',
);
assert.match(
  pageContentSource,
  /import \{ buildChatInputSnapshot, buildChatModeSnapshot, getWorkspaceChatComposerSnapshotSelectedModel \} from '\.\/workspace-chat-composer-snapshot';[\s\S]*const chatInputSnapshot = buildChatInputSnapshot\(\{[\s\S]*input,[\s\S]*planSelectionPending,[\s\S]*isBusyGenerating,[\s\S]*isStopConfirming,[\s\S]*isPlanning,[\s\S]*isGenerating,[\s\S]*selectedModel,[\s\S]*modelCount: models\.length,[\s\S]*attachmentCount: attachedFiles\.length/,
  'workspace page content should derive chat input snapshot through the shared helper from authoritative input and generation facts',
);
assert.match(
  pageContentSource,
  /function hasWorkspacePageContentAvailablePlans\(availablePlansCount: number\): boolean \{[\s\S]*const hasAvailablePlans = availablePlansCount > 0;[\s\S]*return hasAvailablePlans === true;[\s\S]*function hasWorkspacePageContentSelectedPlan\(selectedPlanId: WorkspaceSelectedPlanId\): boolean \{[\s\S]*return selectedPlanId !== null;[\s\S]*function isWorkspacePageContentPlanSelectionPending\([\s\S]*availablePlansCount: number,[\s\S]*selectedPlanId: WorkspaceSelectedPlanId,[\s\S]*\): boolean \{[\s\S]*const hasAvailablePlans = hasWorkspacePageContentAvailablePlans\(availablePlansCount\);[\s\S]*const hasSelectedPlan = hasWorkspacePageContentSelectedPlan\(selectedPlanId\);[\s\S]*return hasAvailablePlans === true && hasSelectedPlan === false;[\s\S]*function isWorkspacePageContentBusyGenerating\(isGenerating: boolean, isPlanning: boolean\): boolean \{[\s\S]*const hasGenerating = isGenerating === true;[\s\S]*const hasPlanning = isPlanning === true;[\s\S]*return hasGenerating === true \|\| hasPlanning === true;[\s\S]*function hasWorkspacePageContentSaveSucceeded\(ok: boolean\): boolean \{[\s\S]*return ok === true;[\s\S]*const planSelectionPending = isWorkspacePageContentPlanSelectionPending\([\s\S]*availablePlansCount,[\s\S]*selectedPlanId,[\s\S]*\);[\s\S]*const isBusyGenerating = isWorkspacePageContentBusyGenerating\(isGenerating, isPlanning\);[\s\S]*const hasSaveSucceeded = hasWorkspacePageContentSaveSucceeded\(ok\);[\s\S]*if \(hasSaveSucceeded === true\)/,
  'workspace page content should derive plan selection, busy generation and save result gates through explicit facts',
);
assert.doesNotMatch(
  pageContentSource,
  /availablePlansCount > 0 && !selectedPlanId|const isBusyGenerating = isGenerating \|\| isPlanning|if \(ok\)/,
  'workspace page content should not regress to inline plan selection, busy generation or save result gates',
);
assert.match(
  pageContentSource,
  /const visibleChatModelRegistrySnapshot = \{[\s\S]*\.\.\.chatModelRegistrySnapshot,[\s\S]*selectedModel: getWorkspaceChatComposerSnapshotSelectedModel\(selectedModel, chatModelRegistrySnapshot\.selectedModel\),[\s\S]*chatModelRegistrySnapshot: visibleChatModelRegistrySnapshot/,
  'workspace page content should keep model registry selected model display aligned with the current user-selected model',
);
assert.match(
  pageContentSource,
  /const chatModeSnapshot = buildChatModeSnapshot\(\{[\s\S]*chatMode,[\s\S]*isOnline,[\s\S]*foundationStatusLabel,[\s\S]*isBusyGenerating,[\s\S]*isStopConfirming,[\s\S]*isPlanning,[\s\S]*isGenerating/,
  'workspace page content should derive chat mode snapshot through the shared helper from authoritative mode, online, foundation and generation facts',
);
assert.match(
  pageContentSource,
  /import \{ buildStopGenerationConfirmationSnapshot \} from '\.\/workspace-stop-generation-confirmation-snapshot';[\s\S]*function hasWorkspacePageContentPersistedProject\(projectInfo: WorkspaceProjectInfo \| null\): boolean \{[\s\S]*if \(projectInfo === null\)[\s\S]*const isPersistedProject = projectInfo\.isPersisted === true;[\s\S]*return isPersistedProject === true;[\s\S]*function getWorkspacePageContentProjectTextValue\(value: string \| null \| undefined\): string \| null \{[\s\S]*if \(value === null \|\| value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*if \(hasValue === true\)[\s\S]*return value;[\s\S]*return null;[\s\S]*const stopGenerationConfirmationSnapshot = buildStopGenerationConfirmationSnapshot\(\{[\s\S]*isStopConfirming,[\s\S]*isPlanning,[\s\S]*isGenerating,[\s\S]*projectId: getWorkspacePageContentProjectTextValue\(projectInfo\?\.projectId\),[\s\S]*projectName: getWorkspacePageContentProjectTextValue\(projectInfo\?\.projectName\),[\s\S]*isPersistedProject: hasWorkspacePageContentPersistedProject\(projectInfo\),[\s\S]*prompt: input,[\s\S]*stopGenerationConfirmationSnapshot,/,
  'workspace page content should derive stop generation confirmation snapshot from project, prompt and generation facts and pass it through composer props',
);
assert.doesNotMatch(
  pageContentSource,
  /isPersistedProject: Boolean\(projectInfo\?\.isPersisted\)|projectId: projectInfo\?\.projectId \|\| null|projectName: projectInfo\?\.projectName \|\| null/,
  'workspace page content should not regress stop generation project facts to Boolean optional access or inline OR fallback',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*function hasWorkspaceChatComposerSnapshotTextValue\(value: string \| null \| undefined\): value is string[\s\S]*if \(value === null \|\| value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;)(?=[\s\S]*function getWorkspaceChatComposerSnapshotLabel[\s\S]*const hasValue = hasWorkspaceChatComposerSnapshotTextValue\(value\);)(?=[\s\S]*function getWorkspaceChatComposerSnapshotBooleanLabel)(?=[\s\S]*function getWorkspaceChatComposerSnapshotOnlineLabel)(?=[\s\S]*const canSendLabel = getWorkspaceChatComposerSnapshotBooleanLabel\(chatInputSnapshot\.canSend\);)(?=[\s\S]*data-testid="workspace-chat-input-snapshot"[\s\S]*Phase: \{chatInputSnapshot\.status\}[\s\S]*Source: \{chatInputSnapshot\.source\}[\s\S]*CanSend: \{canSendLabel\}[\s\S]*Prompt: \{chatInputSnapshot\.promptLength\}[\s\S]*Attachments: \{chatInputSnapshot\.attachmentCount\}[\s\S]*Model: \{chatInputSnapshot\.selectedModel\}[\s\S]*Models: \{chatInputSnapshot\.modelCount\}[\s\S]*恢复建议：\{chatInputSnapshot\.recovery\})/,
  'workspace chat composer should render chat input phase, source, sendability, prompt, attachment, model and recovery guidance',
);
assert.match(
  chatComponentsSource,
  /import \{ StopGenerationConfirmationSnapshotStrip \} from '\.\/workspace-stop-generation-confirmation-snapshot';[\s\S]*stopGenerationConfirmationSnapshot,[\s\S]*handleCancelStopGenerate,[\s\S]*const hasStopConfirming = isStopConfirming === true;[\s\S]*const shouldDisableStopAction = shouldDisableWorkspaceChatComposerStopAction\(\{[\s\S]*hasStopConfirming,[\s\S]*canConfirmStop: stopGenerationConfirmationSnapshot\.canConfirm,[\s\S]*\}\);[\s\S]*disabled=\{shouldDisableStopAction\}[\s\S]*<StopGenerationConfirmationSnapshotStrip[\s\S]*snapshot=\{stopGenerationConfirmationSnapshot\}[\s\S]*disabled=\{stopGenerationConfirmationSnapshot\.canCancel === false\}[\s\S]*onClick=\{handleCancelStopGenerate\}/,
  'workspace chat composer should render stop generation confirmation snapshot and provide a cancel action during stop confirmation',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*function shouldRenderWorkspaceChatComposerStopAction\(isGenerating: boolean\): boolean \{[\s\S]*return isGenerating === true;)(?=[\s\S]*function shouldRenderWorkspaceChatComposerSendAction\(isGenerating: boolean\): boolean \{[\s\S]*return isGenerating === false;)(?=[\s\S]*function getWorkspaceChatComposerStopActionVariant\([\s\S]*hasStopConfirming: boolean,[\s\S]*\): 'destructive' \| 'outline' \{[\s\S]*if \(hasStopConfirming === true\)[\s\S]*return 'outline';)(?=[\s\S]*function getWorkspaceChatComposerActionMinWidthClassName\(isCompact: boolean\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*return undefined;)(?=[\s\S]*function getWorkspaceChatComposerStopActionMinWidthClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'min-w-\[96px\]';)(?=[\s\S]*function getWorkspaceChatComposerStopActionLabel\(\{[\s\S]*hasStopConfirming,[\s\S]*isCompact,[\s\S]*\}: \{[\s\S]*hasStopConfirming: boolean;[\s\S]*isCompact: boolean;[\s\S]*\}\): string \{[\s\S]*if \(hasStopConfirming === true\)[\s\S]*if \(isCompact === true\)[\s\S]*return '停止生成';)(?=[\s\S]*function shouldDisableWorkspaceChatComposerStopAction\(\{[\s\S]*hasStopConfirming,[\s\S]*canConfirmStop,[\s\S]*\}: \{[\s\S]*hasStopConfirming: boolean;[\s\S]*canConfirmStop: boolean;[\s\S]*\}\): boolean \{[\s\S]*if \(hasStopConfirming === false\)[\s\S]*return canConfirmStop === false;)(?=[\s\S]*const shouldRenderStopAction = shouldRenderWorkspaceChatComposerStopAction\(isGenerating\);)(?=[\s\S]*const shouldRenderSendAction = shouldRenderWorkspaceChatComposerSendAction\(isGenerating\);)(?=[\s\S]*const stopActionVariant = getWorkspaceChatComposerStopActionVariant\(hasStopConfirming\);)(?=[\s\S]*const stopActionMinWidthClassName = getWorkspaceChatComposerStopActionMinWidthClassName\(isCompact\);)(?=[\s\S]*const actionMinWidthClassName = getWorkspaceChatComposerActionMinWidthClassName\(isCompact\);)(?=[\s\S]*const stopActionLabel = getWorkspaceChatComposerStopActionLabel\(\{[\s\S]*hasStopConfirming,[\s\S]*isCompact,[\s\S]*\}\);)(?=[\s\S]*const shouldDisableStopAction = shouldDisableWorkspaceChatComposerStopAction\(\{[\s\S]*hasStopConfirming,[\s\S]*canConfirmStop: stopGenerationConfirmationSnapshot\.canConfirm,[\s\S]*\}\);)(?=[\s\S]*\{shouldRenderStopAction === true &&[\s\S]*variant=\{stopActionVariant\}[\s\S]*stopActionMinWidthClassName[\s\S]*disabled=\{shouldDisableStopAction\}[\s\S]*\{stopActionLabel\})(?=[\s\S]*\{shouldRenderSendAction === true &&[\s\S]*className=\{actionMinWidthClassName\})/,
  'workspace chat composer should derive stop/send generation actions through named render facts',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*function getWorkspaceChatMessageStateSummaryContainerTextClassName\(compact: boolean \| undefined\): string \{[\s\S]*if \(compact === true\)[\s\S]*return 'text-\[11px\]';)(?=[\s\S]*function getWorkspaceChatScrollDistanceLabel\(distanceToBottom: number \| null\): string \{[\s\S]*if \(distanceToBottom === null\)[\s\S]*return `\$\{Math\.max\(0, Math\.round\(distanceToBottom\)\)\}px`;)(?=[\s\S]*function getWorkspaceChatComposerOnlineButtonModeClassName\(isOnlineMode: boolean\): string \| undefined \{[\s\S]*if \(isOnlineMode === true\)[\s\S]*return undefined;)(?=[\s\S]*function getWorkspaceChatComposerStopActionToneClassName\(hasStopConfirming: boolean\): string \| undefined \{[\s\S]*if \(hasStopConfirming === true\)[\s\S]*return 'border-destructive\/30 bg-destructive\/5 text-destructive hover:bg-destructive\/10 hover:text-destructive';)(?=[\s\S]*function getWorkspaceChatComposerStopActionAnimationClassName\(hasStopConfirming: boolean\): string \| undefined \{[\s\S]*if \(hasStopConfirming === true\)[\s\S]*return 'animate-pulse';)(?=[\s\S]*const containerTextClassName = getWorkspaceChatMessageStateSummaryContainerTextClassName\(compact\);)(?=[\s\S]*const chatScrollDistanceLabel = getWorkspaceChatScrollDistanceLabel\(chatScrollSnapshot\.distanceToBottom\);)(?=[\s\S]*containerClassName=\{cn\('app-debug-only border-b bg-muted\/20 px-3 py-2', containerTextClassName\)\})(?=[\s\S]*Distance: \{chatScrollDistanceLabel\})(?=[\s\S]*const onlineButtonModeClassName = getWorkspaceChatComposerOnlineButtonModeClassName\(isOnlineMode\);)(?=[\s\S]*const stopActionToneClassName = getWorkspaceChatComposerStopActionToneClassName\(hasStopConfirming\);)(?=[\s\S]*const stopActionAnimationClassName = getWorkspaceChatComposerStopActionAnimationClassName\(hasStopConfirming\);)(?=[\s\S]*className=\{cn\('h-8 w-8', onlineButtonModeClassName\)\})(?=[\s\S]*stopActionToneClassName)(?=[\s\S]*stopActionAnimationClassName)/,
  'workspace chat composer and message summary display classes should use named display readers',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*import type \{ ReactNode \} from 'react';)(?=[\s\S]*type WorkspaceChatComposerAttachmentNodeList = ReactNode\[\];)(?=[\s\S]*type WorkspaceChatComposerAttachmentRemovalRequest = \(index: number\) => void;)(?=[\s\S]*function getWorkspaceChatComposerAttachmentListClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'gap-2';)(?=[\s\S]*function getWorkspaceChatComposerAttachmentBadgeClassName\(isCompact: boolean\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*return undefined;)(?=[\s\S]*function getWorkspaceChatComposerAttachmentNameClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'max-w-\[80px\]';)(?=[\s\S]*function getWorkspaceChatComposerAttachmentRemoveClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'ml-1';)(?=[\s\S]*function materializeWorkspaceChatComposerAttachmentNodes\(\{[\s\S]*attachedFiles,[\s\S]*attachmentBadgeClassName,[\s\S]*attachmentNameClassName,[\s\S]*attachmentRemoveClassName,[\s\S]*requestAttachmentRemoval,[\s\S]*\}: \{[\s\S]*attachedFiles: WorkspaceChatAttachment\[\];[\s\S]*requestAttachmentRemoval: WorkspaceChatComposerAttachmentRemovalRequest;[\s\S]*\}\): WorkspaceChatComposerAttachmentNodeList \{[\s\S]*const nodes: WorkspaceChatComposerAttachmentNodeList = \[\];[\s\S]*for \(let index = 0; index < attachedFiles\.length; index \+= 1\)[\s\S]*const file = attachedFiles\[index\];[\s\S]*if \(file === undefined\)[\s\S]*nodes\.push\([\s\S]*<Badge key=\{file\.name \+ index\}[\s\S]*className=\{cn\('flex items-center gap-1', attachmentBadgeClassName\)\}[\s\S]*className=\{cn\('truncate', attachmentNameClassName\)\}[\s\S]*onClick=\{\(\) => requestAttachmentRemoval\(index\)\}[\s\S]*className=\{cn\('hover:text-destructive', attachmentRemoveClassName\)\}[\s\S]*return nodes;)(?=[\s\S]*const attachmentListClassName = getWorkspaceChatComposerAttachmentListClassName\(isCompact\);)(?=[\s\S]*const attachmentBadgeClassName = getWorkspaceChatComposerAttachmentBadgeClassName\(isCompact\);)(?=[\s\S]*const attachmentNameClassName = getWorkspaceChatComposerAttachmentNameClassName\(isCompact\);)(?=[\s\S]*const attachmentRemoveClassName = getWorkspaceChatComposerAttachmentRemoveClassName\(isCompact\);)(?=[\s\S]*className=\{cn\('mb-2 flex flex-wrap', attachmentListClassName\)\})(?=[\s\S]*materializeWorkspaceChatComposerAttachmentNodes\(\{[\s\S]*attachedFiles,[\s\S]*attachmentBadgeClassName,[\s\S]*attachmentNameClassName,[\s\S]*attachmentRemoveClassName,[\s\S]*requestAttachmentRemoval,[\s\S]*\}\))/,
  'workspace chat composer attachment list should use named compact display readers and node materializer',
);
assert.doesNotMatch(
  chatComponentsSource,
  /attachedFiles\.map\(/,
  'workspace chat composer attachment list should not regress to inline attachedFiles.map JSX materialization',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*function getWorkspaceChatComposerContainerClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'p-4';)(?=[\s\S]*function getWorkspaceChatComposerInputRowClassName\(isCompact: boolean\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'flex gap-2';)(?=[\s\S]*function getWorkspaceChatComposerInputPlaceholder\(hasPlanSelectionPending: boolean\): string \{[\s\S]*if \(hasPlanSelectionPending === true\)[\s\S]*return '继续描述你的需求或修改意见\.\.\.';)(?=[\s\S]*function getWorkspaceChatComposerTextareaClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'min-h-\[88px\] max-h-\[224px\] resize-none';)(?=[\s\S]*function getWorkspaceChatComposerPopoverContentClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'w-40';)(?=[\s\S]*function getWorkspaceChatComposerModeButtonKey\(\{[\s\S]*isCompact,[\s\S]*mode,[\s\S]*\}: \{[\s\S]*isCompact: boolean;[\s\S]*mode: ChatMode;[\s\S]*\}\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return mode;)(?=[\s\S]*function getWorkspaceChatComposerTransitionClassName\(isCompact: boolean\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'transition-colors';)(?=[\s\S]*function getWorkspaceChatComposerModeButtonToneClassName\(\{[\s\S]*chatMode,[\s\S]*mode,[\s\S]*\}: \{[\s\S]*chatMode: ChatMode;[\s\S]*mode: ChatMode;[\s\S]*\}\): string \{[\s\S]*if \(chatMode === mode\)[\s\S]*return 'hover:bg-muted';)(?=[\s\S]*function getWorkspaceChatComposerModelButtonToneClassName\(\{[\s\S]*selectedModel,[\s\S]*modelId,[\s\S]*\}: \{[\s\S]*selectedModel: string;[\s\S]*modelId: string;[\s\S]*\}\): string \{[\s\S]*if \(selectedModel === modelId\)[\s\S]*return 'hover:bg-muted';)(?=[\s\S]*function materializeWorkspaceChatComposerModelNodes\(\{[\s\S]*models,[\s\S]*selectedModel,[\s\S]*transitionClassName,[\s\S]*setSelectedModel,[\s\S]*\}: \{[\s\S]*models: WorkspaceChatComposerProps\['models'\];[\s\S]*selectedModel: string;[\s\S]*transitionClassName: string \| undefined;[\s\S]*setSelectedModel: WorkspaceChatComposerModelSetter;[\s\S]*\}\): WorkspaceChatComposerModelNodeList \{[\s\S]*const nodes: WorkspaceChatComposerModelNodeList = \[\];[\s\S]*for \(const model of models\)[\s\S]*const modelButtonToneClassName = getWorkspaceChatComposerModelButtonToneClassName\(\{[\s\S]*selectedModel,[\s\S]*modelId: model\.id,[\s\S]*\}\);)(?=[\s\S]*function getWorkspaceChatComposerModelEmptyStateClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'text-sm';)(?=[\s\S]*const composerContainerClassName = getWorkspaceChatComposerContainerClassName\(isCompact\);)(?=[\s\S]*const inputRowClassName = getWorkspaceChatComposerInputRowClassName\(isCompact\);)(?=[\s\S]*const inputPlaceholder = getWorkspaceChatComposerInputPlaceholder\(hasPlanSelectionPending\);)(?=[\s\S]*const textareaClassName = getWorkspaceChatComposerTextareaClassName\(isCompact\);)(?=[\s\S]*const popoverContentClassName = getWorkspaceChatComposerPopoverContentClassName\(isCompact\);)(?=[\s\S]*const discussModeButtonKey = getWorkspaceChatComposerModeButtonKey\(\{ isCompact, mode: 'discuss' \}\);)(?=[\s\S]*const implementModeButtonKey = getWorkspaceChatComposerModeButtonKey\(\{ isCompact, mode: 'implement' \}\);)(?=[\s\S]*const transitionClassName = getWorkspaceChatComposerTransitionClassName\(isCompact\);)(?=[\s\S]*const discussModeButtonToneClassName = getWorkspaceChatComposerModeButtonToneClassName\(\{[\s\S]*chatMode,[\s\S]*mode: 'discuss',[\s\S]*\}\);)(?=[\s\S]*const implementModeButtonToneClassName = getWorkspaceChatComposerModeButtonToneClassName\(\{[\s\S]*chatMode,[\s\S]*mode: 'implement',[\s\S]*\}\);)(?=[\s\S]*const modelEmptyStateClassName = getWorkspaceChatComposerModelEmptyStateClassName\(isCompact\);)(?=[\s\S]*className=\{cn\('shrink-0 border-t bg-background', composerContainerClassName\)\})(?=[\s\S]*className=\{inputRowClassName\})(?=[\s\S]*placeholder=\{inputPlaceholder\})(?=[\s\S]*className=\{textareaClassName\})(?=[\s\S]*className=\{cn\('p-1', popoverContentClassName\)\})(?=[\s\S]*key=\{discussModeButtonKey\})(?=[\s\S]*key=\{implementModeButtonKey\})(?=[\s\S]*transitionClassName)(?=[\s\S]*discussModeButtonToneClassName)(?=[\s\S]*implementModeButtonToneClassName)(?=[\s\S]*materializeWorkspaceChatComposerModelNodes\(\{[\s\S]*models,[\s\S]*selectedModel,[\s\S]*transitionClassName,[\s\S]*setSelectedModel,[\s\S]*\}\))(?=[\s\S]*className=\{cn\('px-3 py-2 text-muted-foreground', modelEmptyStateClassName\)\})/,
  'workspace chat composer input and picker controls should use named display readers',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*import \{[\s\S]*AttachmentRemovalConfirmationSnapshotStrip,[\s\S]*buildAttachmentRemovalConfirmationSnapshot,[\s\S]*\} from '\.\/workspace-attachment-removal-confirmation-snapshot';)(?=[\s\S]*const \[pendingAttachmentRemovalIndex, setPendingAttachmentRemovalIndex\] = useState<number \| null>\(null\);)(?=[\s\S]*const attachmentRemovalConfirmationSnapshot = buildAttachmentRemovalConfirmationSnapshot\(\{[\s\S]*attachment: pendingAttachmentRemoval,[\s\S]*attachmentIndex: pendingAttachmentRemovalIndex,[\s\S]*attachmentCount: attachedFiles\.length,)(?=[\s\S]*const requestAttachmentRemoval = \(index: number\) => \{[\s\S]*setPendingAttachmentRemovalIndex\(index\);)(?=[\s\S]*const confirmAttachmentRemoval = \(\) => \{[\s\S]*attachmentRemovalConfirmationSnapshot\.canConfirm !== true[\s\S]*pendingAttachmentRemovalIndex === null[\s\S]*removeAttachment\(pendingAttachmentRemovalIndex\);)(?=[\s\S]*onClick=\{\(\) => requestAttachmentRemoval\(index\)\})(?=[\s\S]*<AttachmentRemovalConfirmationSnapshotStrip snapshot=\{attachmentRemovalConfirmationSnapshot\} \/>)(?=[\s\S]*disabled=\{attachmentRemovalConfirmationSnapshot\.canConfirm === false\})/,
  'workspace chat composer should open a structured attachment removal confirmation before invoking removeAttachment',
);
assert.doesNotMatch(
  chatComponentsSource,
  /onClick=\{\(\) => removeAttachment\(index\)\}/,
  'workspace chat attachment remove buttons must not directly invoke removeAttachment',
);
assert.match(
  localStateSource,
  /import \{[\s\S]*buildInitialChatAttachmentSnapshot,[\s\S]*buildInitialChatModelRegistrySnapshot,[\s\S]*\} from '\.\/workspace-chat-composer-snapshot';[\s\S]*useState\(buildInitialChatAttachmentSnapshot\)[\s\S]*useState\(buildInitialChatModelRegistrySnapshot\)/,
  'workspace page local state should initialize chat model registry and attachment snapshots through shared helpers without render-time timestamps',
);
assert.match(
  chatComposerSnapshotSource,
  /(?=[\s\S]*ChatModelRegistrySnapshotStatus)(?=[\s\S]*ChatModelRegistrySnapshotSource)(?=[\s\S]*ChatAttachmentSnapshotStatus)(?=[\s\S]*ChatAttachmentSnapshotSource)(?=[\s\S]*export function buildInitialChatModelRegistrySnapshot\([\s\S]*status: ChatModelRegistrySnapshotStatus = 'idle'[\s\S]*source: ChatModelRegistrySnapshotSource = 'model_registry'[\s\S]*updatedAt: 'pending')(?=[\s\S]*export function buildInitialChatAttachmentSnapshot\([\s\S]*status: ChatAttachmentSnapshotStatus = 'empty'[\s\S]*source: ChatAttachmentSnapshotSource = 'attachment_state'[\s\S]*updatedAt: 'pending')/,
  'workspace chat composer helper should construct initial model registry and attachment snapshots without render-time timestamps',
);
assert.match(
  chatComposerSnapshotSource,
  /(?=[\s\S]*export function buildLoadingChatModelRegistrySnapshot\([\s\S]*status: ChatModelRegistrySnapshotStatus = 'loading'[\s\S]*source: ChatModelRegistrySnapshotSource = 'llm_provider_api')(?=[\s\S]*export function buildLoadedChatModelRegistrySnapshot\([\s\S]*status: ChatModelRegistrySnapshotStatus = resolvedModel \? 'default_selected' : 'ready'[\s\S]*source: ChatModelRegistrySnapshotSource = resolvedModel \? 'default_provider' : 'llm_provider_api')(?=[\s\S]*export function buildEmptyChatModelRegistrySnapshot\([\s\S]*status: ChatModelRegistrySnapshotStatus = 'empty')(?=[\s\S]*export function buildLoadFailedChatModelRegistrySnapshot\([\s\S]*status: ChatModelRegistrySnapshotStatus = 'load_failed')/,
  'workspace chat composer helper should construct loading, ready/default, empty and failure registry snapshots',
);
assert.match(
  chatComposerSnapshotSource,
  /(?=[\s\S]*export function buildPickerEmptyChatAttachmentSnapshot\([\s\S]*status: ChatAttachmentSnapshotStatus = 'picker_empty'[\s\S]*source: ChatAttachmentSnapshotSource = 'file_picker')(?=[\s\S]*export function buildSelectedChatAttachmentSnapshot\([\s\S]*status: ChatAttachmentSnapshotStatus = 'selected'[\s\S]*source: ChatAttachmentSnapshotSource = 'file_picker')(?=[\s\S]*export function buildRemovedChatAttachmentSnapshot\([\s\S]*status: ChatAttachmentSnapshotStatus = attachmentCount > 0 \? 'removed' : 'empty'[\s\S]*source: ChatAttachmentSnapshotSource = 'user_action')/,
  'workspace chat composer helper should construct picker-empty, selected, removed and empty attachment snapshots',
);
assert.doesNotMatch(
  chatComposerSnapshotSource,
  /ChatModelRegistrySnapshot\['status'\]|ChatModelRegistrySnapshot\['source'\]|ChatAttachmentSnapshot\['status'\]|ChatAttachmentSnapshot\['source'\]/,
  'workspace chat model registry and attachment snapshot helpers should not infer status/source from indexed snapshot access',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*const defaultModelLabel = getWorkspaceChatComposerSnapshotLabel\(chatModelRegistrySnapshot\.defaultModel, 'none'\);)(?=[\s\S]*data-testid="workspace-chat-model-registry-snapshot"[\s\S]*Phase: \{chatModelRegistrySnapshot\.status\}[\s\S]*Source: \{chatModelRegistrySnapshot\.source\}[\s\S]*Models: \{chatModelRegistrySnapshot\.modelCount\}[\s\S]*Selected: \{chatModelRegistrySnapshot\.selectedModel\}[\s\S]*Default: \{defaultModelLabel\}[\s\S]*恢复建议：\{chatModelRegistrySnapshot\.recovery\})/,
  'workspace chat composer should render model registry phase, source, counts, selected/default model and recovery guidance',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*type WorkspaceChatComposerModelNodeList = ReactNode\[\];)(?=[\s\S]*type WorkspaceChatComposerModelSetter = \(modelId: string\) => void;)(?=[\s\S]*function hasWorkspaceChatComposerModels\(models: WorkspaceChatComposerProps\['models'\]\): boolean \{[\s\S]*const hasModels = models\.length > 0;[\s\S]*return hasModels === true;)(?=[\s\S]*function shouldRenderWorkspaceChatComposerModelList\(models: WorkspaceChatComposerProps\['models'\]\): boolean \{[\s\S]*return hasWorkspaceChatComposerModels\(models\);)(?=[\s\S]*function shouldRenderWorkspaceChatComposerModelEmptyState\(models: WorkspaceChatComposerProps\['models'\]\): boolean \{[\s\S]*const hasModels = hasWorkspaceChatComposerModels\(models\);[\s\S]*return hasModels === false;)(?=[\s\S]*function getWorkspaceChatComposerModelEmptyStateLabel\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return '未配置 LLM 模型，请在管理后台配置';)(?=[\s\S]*function materializeWorkspaceChatComposerModelNodes\(\{[\s\S]*models,[\s\S]*selectedModel,[\s\S]*transitionClassName,[\s\S]*setSelectedModel,[\s\S]*\}: \{[\s\S]*models: WorkspaceChatComposerProps\['models'\];[\s\S]*setSelectedModel: WorkspaceChatComposerModelSetter;[\s\S]*\}\): WorkspaceChatComposerModelNodeList \{[\s\S]*const nodes: WorkspaceChatComposerModelNodeList = \[\];[\s\S]*for \(const model of models\)[\s\S]*nodes\.push\([\s\S]*<button[\s\S]*key=\{model\.id\}[\s\S]*onClick=\{\(\) => setSelectedModel\(model\.id\)\}[\s\S]*modelButtonToneClassName[\s\S]*\{model\.name\}[\s\S]*return nodes;)(?=[\s\S]*const shouldRenderModelList = shouldRenderWorkspaceChatComposerModelList\(models\);)(?=[\s\S]*const shouldRenderModelEmptyState = shouldRenderWorkspaceChatComposerModelEmptyState\(models\);)(?=[\s\S]*const modelEmptyStateLabel = getWorkspaceChatComposerModelEmptyStateLabel\(isCompact\);)(?=[\s\S]*\{shouldRenderModelList === true &&)(?=[\s\S]*materializeWorkspaceChatComposerModelNodes\(\{[\s\S]*models,[\s\S]*selectedModel,[\s\S]*transitionClassName,[\s\S]*setSelectedModel,[\s\S]*\}\))(?=[\s\S]*\{shouldRenderModelEmptyState === true &&[\s\S]*\{modelEmptyStateLabel\})/,
  'workspace chat composer model picker should use named model list render facts and node materializer',
);
assert.doesNotMatch(
  chatComponentsSource,
  /models\.map\(\(model\) =>/,
  'workspace chat composer model picker should not regress to inline models.map JSX materialization',
);
assert.match(
  pageUiSource,
  /import \{[\s\S]*buildEmptyChatModelRegistrySnapshot,[\s\S]*buildLoadedChatModelRegistrySnapshot,[\s\S]*buildLoadingChatModelRegistrySnapshot,[\s\S]*buildLoadFailedChatModelRegistrySnapshot,[\s\S]*buildPickerEmptyChatAttachmentSnapshot,[\s\S]*buildRemovedChatAttachmentSnapshot,[\s\S]*buildSelectedChatAttachmentSnapshot,[\s\S]*\} from '\.\/workspace-chat-composer-snapshot';[\s\S]*setChatModelRegistrySnapshot\(buildLoadingChatModelRegistrySnapshot\(\{[\s\S]*setChatModelRegistrySnapshot\(buildLoadedChatModelRegistrySnapshot\(\{[\s\S]*setChatModelRegistrySnapshot\(buildEmptyChatModelRegistrySnapshot\(defaultName\)\)[\s\S]*setChatModelRegistrySnapshot\(buildLoadFailedChatModelRegistrySnapshot\(\{/,
  'workspace model list loader should use shared helpers for loading, ready/default, empty and failure registry snapshots',
);
assert.match(
  pageUiSource,
  /const handleFileUpload = useCallback\(\(event: ChangeEvent<HTMLInputElement>\) => \{[\s\S]*setChatAttachmentSnapshot\(buildPickerEmptyChatAttachmentSnapshot\(\)\)[\s\S]*const selectedFiles = materializeWorkspacePageUiUploadedFiles\(uploads\);[\s\S]*const next = materializeWorkspacePageUiAttachedFiles\(attachedFiles, selectedFiles\);[\s\S]*const totalSize = getWorkspacePageUiAttachedFileTotalSize\(next\);[\s\S]*const lastFileName = getWorkspacePageUiLastAttachedFileName\(selectedFiles\);[\s\S]*setAttachedFiles\(next\);[\s\S]*setChatAttachmentSnapshot\(buildSelectedChatAttachmentSnapshot\(\{[\s\S]*selectedCount: selectedFiles\.length,[\s\S]*attachmentCount: next\.length,[\s\S]*totalSize,[\s\S]*lastFileName,[\s\S]*event\.target\.value = '';[\s\S]*const removeAttachment = useCallback\(\(index: number\) => \{[\s\S]*const removed = getWorkspacePageUiAttachedFileAt\(attachedFiles, index\);[\s\S]*const next = materializeWorkspacePageUiRemainingAttachedFiles\(attachedFiles, index\);[\s\S]*const totalSize = getWorkspacePageUiAttachedFileTotalSize\(next\);[\s\S]*setAttachedFiles\(next\);[\s\S]*setChatAttachmentSnapshot\(buildRemovedChatAttachmentSnapshot\(\{[\s\S]*attachmentCount: next\.length,[\s\S]*totalSize,[\s\S]*removedFileName: getWorkspacePageUiAttachmentSnapshotFileName\(removed\),/,
  'workspace attachment upload and removal should use shared helpers for picker-empty, selected, removed and empty snapshots',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*const lastFileNameLabel = getWorkspaceChatComposerSnapshotLabel\(chatAttachmentSnapshot\.lastFileName, 'none'\);)(?=[\s\S]*data-testid="workspace-chat-attachment-snapshot"[\s\S]*Phase: \{chatAttachmentSnapshot\.status\}[\s\S]*Source: \{chatAttachmentSnapshot\.source\}[\s\S]*Files: \{chatAttachmentSnapshot\.attachmentCount\}[\s\S]*Total: \{formatAttachmentSize\(chatAttachmentSnapshot\.totalSize\)\}[\s\S]*Last: \{lastFileNameLabel\}[\s\S]*恢复建议：\{chatAttachmentSnapshot\.recovery\})/,
  'workspace chat composer should render attachment phase, source, file count, total size, last file and recovery guidance',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*const onlineLabel = getWorkspaceChatComposerSnapshotOnlineLabel\(chatModeSnapshot\.isOnline\);)(?=[\s\S]*const busyLabel = getWorkspaceChatComposerSnapshotBooleanLabel\(chatModeSnapshot\.isBusy\);)(?=[\s\S]*data-testid="workspace-chat-mode-snapshot"[\s\S]*Phase: \{chatModeSnapshot\.status\}[\s\S]*Source: \{chatModeSnapshot\.source\}[\s\S]*Mode: \{chatModeSnapshot\.chatMode\}[\s\S]*Online: \{onlineLabel\}[\s\S]*Busy: \{busyLabel\}[\s\S]*基础设定: \{chatModeSnapshot\.foundationStatusLabel\}[\s\S]*恢复建议：\{chatModeSnapshot\.recovery\})/,
  'workspace chat composer should render mode phase, source, mode, online, busy, internal setup status and recovery guidance',
);
assert.match(
  chatPlanSnapshotSource,
  /(?=[\s\S]*PlanSelectionSnapshotSource)(?=[\s\S]*PlanSelectionSnapshotStatus)(?=[\s\S]*function createPlanSelectionSnapshot\()(?=[\s\S]*status: PlanSelectionSnapshotStatus)(?=[\s\S]*source: PlanSelectionSnapshotSource)(?=[\s\S]*function isPlanSelectionSnapshotSuperseded\(planSuperseded: boolean \| undefined\): boolean[\s\S]*return planSuperseded === true;)(?=[\s\S]*function hasPlanSelectionSnapshotSelectedPlanId\(selectedPlanId: string \| null\): selectedPlanId is string[\s\S]*return selectedPlanId !== null;)(?=[\s\S]*function isPlanSelectionSnapshotStreamComplete\(isStreamComplete: boolean\): boolean[\s\S]*return isStreamComplete === true;)(?=[\s\S]*function isPlanSelectionSnapshotBusy\(isBusy: boolean\): boolean[\s\S]*return isBusy === true;)(?=[\s\S]*export function buildPlanSelectionSnapshot\([\s\S]*\): PlanSelectionSnapshot \{)(?=[\s\S]*status: 'empty_plans')(?=[\s\S]*source: 'message_restore')(?=[\s\S]*if \(isPlanSelectionSnapshotSuperseded\(planSuperseded\) === true\))(?=[\s\S]*status: 'superseded')(?=[\s\S]*source: 'new_requirement')(?=[\s\S]*if \(hasPlanSelectionSnapshotSelectedPlanId\(selectedPlanId\) === true\))(?=[\s\S]*status: 'selected')(?=[\s\S]*source: 'user_selection')(?=[\s\S]*if \(isPlanSelectionSnapshotStreamComplete\(isStreamComplete\) === false\))(?=[\s\S]*status: 'streaming')(?=[\s\S]*source: 'plan_stream')(?=[\s\S]*if \(isPlanSelectionSnapshotBusy\(isBusy\) === true\))(?=[\s\S]*status: 'busy_blocked')(?=[\s\S]*source: 'generation_state')(?=[\s\S]*status: 'waiting_for_selection')/,
  'workspace plan selection helper should derive empty, superseded, selected, streaming, busy-blocked and waiting phases from message facts',
);
assert.doesNotMatch(
  chatPlanSnapshotSource,
  /PlanSelectionSnapshot\['status'\]|PlanSelectionSnapshot\['source'\]|if \(planSuperseded\)|if \(selectedPlanId\)|if \(!isStreamComplete\)|if \(isBusy\)/,
  'workspace plan selection snapshot helper should not infer status/source from indexed snapshot access or truthy selection phase gates',
);
assert.match(
  chatPlanSelectionSource,
  /import \{ buildPlanSelectionSnapshot \} from '\.\/workspace-chat-plan-snapshot';[\s\S]*import \{ getWorkspaceRecommendedPlanId \} from '\.\/workspace-plan-message-helpers';[\s\S]*type PlanSelectionMessagePlanList = Plan\[\];[\s\S]*function getPlanSelectionMessagePlans\(message: WorkspaceChatMessage\): PlanSelectionMessagePlanList[\s\S]*Array\.isArray\(message\.plans\) === false[\s\S]*const plans = getPlanSelectionMessagePlans\(message\);[\s\S]*const effectiveRecommendedPlanId = getWorkspaceRecommendedPlanId\(plans, message\.recommendedPlanId\);[\s\S]*const planSelectionSnapshot = buildPlanSelectionSnapshot\(\{[\s\S]*timestamp: message\.timestamp,[\s\S]*planSuperseded: message\.planSuperseded,[\s\S]*planCount: plans\.length,[\s\S]*isStreamComplete,[\s\S]*isSelectable,[\s\S]*selectedPlanId,[\s\S]*isBusy,[\s\S]*recommendedPlanId: effectiveRecommendedPlanId,/,
  'workspace plan selection message should use the shared helper with authoritative message and selection facts',
);
assert.match(
  chatPlanSelectionSource,
  /import type \{ ReactNode \} from 'react';[\s\S]*type PlanSelectionMessagePlanList = Plan\[\];[\s\S]*type PlanSelectionMessagePlanNodeList = ReactNode\[\];[\s\S]*type PlanSelectionMessageTechStackLabelList = string\[\];[\s\S]*type PlanSelectionMessageTechStackLabelNodeList = ReactNode\[\];[\s\S]*type PlanSelectionMessagePlanSelectAction = \(plan: Plan\) => void;[\s\S]*function hasPlanSelectionSnapshotAttentionStatus\(snapshot: PlanSelectionSnapshot\): boolean[\s\S]*if \(snapshot\.status === 'streaming'\)[\s\S]*if \(snapshot\.status === 'waiting_for_selection'\)[\s\S]*return snapshot\.status === 'busy_blocked';[\s\S]*function hasPlanSelectionMessageSelectedPlan\(selectedPlanId: string \| null\): boolean[\s\S]*return selectedPlanId !== null;[\s\S]*function isPlanSelectionMessageStreamComplete\([\s\S]*isPlanSuperseded: boolean;[\s\S]*planStreamComplete: boolean \| undefined;[\s\S]*selectionReady: boolean;[\s\S]*\): boolean[\s\S]*if \(isPlanSuperseded === true\)[\s\S]*const hasPlanStreamComplete = planStreamComplete === true;[\s\S]*if \(hasPlanStreamComplete === false\)[\s\S]*return selectionReady === true;[\s\S]*function isPlanSelectionMessageSelectable\([\s\S]*isPlanSuperseded: boolean;[\s\S]*isStreamComplete: boolean;[\s\S]*isBusy: boolean;[\s\S]*hasSelectedPlan: boolean;[\s\S]*\): boolean[\s\S]*if \(isPlanSuperseded === true\)[\s\S]*if \(isStreamComplete === false\)[\s\S]*if \(isBusy === true\)[\s\S]*return hasSelectedPlan === false;[\s\S]*function getPlanSelectionMessageTechStackProfile\(plan: Plan\): string[\s\S]*getTechStackProfile\(plan\.tech_stack\)[\s\S]*return '运行配置待确定';[\s\S]*function shouldRenderPlanSelectionMessageRecommendedBadge\(isRecommended: boolean\): boolean[\s\S]*function shouldRenderPlanSelectionMessageSelectedBadge\(isSelected: boolean\): boolean[\s\S]*function shouldRenderPlanSelectionMessageReasoning\(plan: Plan\): boolean[\s\S]*function shouldRenderPlanSelectionMessageSupersededNotice\(isPlanSuperseded: boolean\): boolean[\s\S]*function shouldRenderPlanSelectionMessageWaitingNotice\([\s\S]*hasSelectedPlan: boolean;[\s\S]*isStreamComplete: boolean;[\s\S]*\): boolean[\s\S]*function shouldRenderPlanSelectionMessageGuidance\(isPlanSuperseded: boolean\): boolean[\s\S]*function getPlanSelectionMessageSelectedCardClassName\(isSelected: boolean\): string \| undefined[\s\S]*function getPlanSelectionMessageDisabledCardClassName\([\s\S]*isSelectable: boolean;[\s\S]*isSelected: boolean;[\s\S]*\): string \| undefined[\s\S]*function materializePlanSelectionMessageTechStackLabelNodes\([\s\S]*techStackLabels: PlanSelectionMessageTechStackLabelList,[\s\S]*\): PlanSelectionMessageTechStackLabelNodeList \{[\s\S]*const nodes: PlanSelectionMessageTechStackLabelNodeList = \[\];[\s\S]*for \(const tech of techStackLabels\)[\s\S]*<Badge key=\{tech\} variant="outline" className="text-\[10px\]">\{tech\}<\/Badge>[\s\S]*return nodes;[\s\S]*function materializePlanSelectionMessagePlanNodes\(\{[\s\S]*plans,[\s\S]*selectedPlanId,[\s\S]*effectiveRecommendedPlanId,[\s\S]*isSelectable,[\s\S]*onSelectPlan,[\s\S]*\}: \{[\s\S]*plans: PlanSelectionMessagePlanList;[\s\S]*onSelectPlan: PlanSelectionMessagePlanSelectAction;[\s\S]*\}\): PlanSelectionMessagePlanNodeList \{[\s\S]*const nodes: PlanSelectionMessagePlanNodeList = \[\];[\s\S]*for \(const plan of plans\)[\s\S]*const techStackLabels = getTechStackLabels\(plan\.tech_stack\);[\s\S]*nodes\.push\([\s\S]*<button[\s\S]*key=\{plan\.id\}[\s\S]*onClick=\{\(\) => onSelectPlan\(plan\)\}[\s\S]*disabled=\{isSelectable === false\}[\s\S]*selectedCardClassName[\s\S]*disabledCardClassName[\s\S]*materializePlanSelectionMessageTechStackLabelNodes\(techStackLabels\)[\s\S]*return nodes;[\s\S]*const hasSelectedPlan = hasPlanSelectionMessageSelectedPlan\(selectedPlanId\);[\s\S]*const isStreamComplete = isPlanSelectionMessageStreamComplete\(\{[\s\S]*const isSelectable = isPlanSelectionMessageSelectable\(\{[\s\S]*const shouldRenderSupersededNotice = shouldRenderPlanSelectionMessageSupersededNotice\(isPlanSuperseded\);[\s\S]*const shouldRenderWaitingNotice = shouldRenderPlanSelectionMessageWaitingNotice\(\{[\s\S]*const shouldRenderGuidance = shouldRenderPlanSelectionMessageGuidance\(isPlanSuperseded\);[\s\S]*materializePlanSelectionMessagePlanNodes\(\{[\s\S]*plans,[\s\S]*selectedPlanId,[\s\S]*effectiveRecommendedPlanId,[\s\S]*isSelectable,[\s\S]*onSelectPlan,[\s\S]*\}\)[\s\S]*\{shouldRenderSupersededNotice === true &&[\s\S]*\{shouldRenderWaitingNotice === true &&/,
  'workspace plan selection message should derive selectable state through explicit boolean gates',
);
assert.match(
  chatPlanSelectionSource,
  /import \{ getPlanFeatureSummary \} from '@\/lib\/plan-features';[\s\S]*const featureSummary = getPlanFeatureSummary\(plan\);[\s\S]*核心功能：\{featureSummary\}/,
  'workspace plan selection message should render plan features through the shared runtime-safe feature summary reader',
);
assert.doesNotMatch(
  chatPlanSelectionSource,
  /message\.plans \|\| \[\]|message\.plans \?\? \[\]|plans\.map\(|getTechStackLabels\(plan\.tech_stack\)\.map\(|plan\.features\.join\(|message\.recommendedPlanId \|\| plans\[0\]|disabled=\{!isSelectable\}|!message\.planSuperseded|!selectedPlanId|!isBusy|!Boolean\(selectedPlanId\)|Boolean\(message\.planStreamComplete && selectionReady\)|isPlanSuperseded === true \? true : message\.planStreamComplete === true && selectionReady === true|isPlanSuperseded === false && isStreamComplete === true && isBusy === false && hasSelectedPlan === false|snapshot\.status === 'streaming' \|\| snapshot\.status === 'waiting_for_selection' \|\| snapshot\.status === 'busy_blocked'|getTechStackProfile\(plan\.tech_stack\) \|\| '运行配置待确定'|isRecommended &&|isSelected &&|plan\.reasoning &&|isSelected === true && 'border-primary bg-background'|isSelectable === false && isSelected === false && 'opacity-80'|shouldRenderSupersededNotice === true \? |shouldRenderWaitingNotice === true \? |message\.planSuperseded \?|message\.content\?\.trim\(\) &&|value !== null && value !== undefined && value\.length > 0|planSelectionSnapshot\.recommendedPlanId \?\? 'none'|planSelectionSnapshot\.selectedPlanId \?\? 'none'|planSelectionSnapshot\.canSelect \? 'yes' : 'no'/,
  'workspace plan selection message should not regress to implicit truthy or negated boolean gates',
);
assert.match(
  chatPlanSelectionSource,
  /(?=[\s\S]*function hasPlanSelectionSnapshotTextValue\(value: string \| null \| undefined\): value is string[\s\S]*if \(value === null \|\| value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;)(?=[\s\S]*function getPlanSelectionSnapshotLabel[\s\S]*const hasValue = hasPlanSelectionSnapshotTextValue\(value\);)(?=[\s\S]*function getPlanSelectionSnapshotBooleanLabel)(?=[\s\S]*const recommendedPlanLabel = getPlanSelectionSnapshotLabel\(planSelectionSnapshot\.recommendedPlanId, 'none'\);)(?=[\s\S]*const selectedPlanLabel = getPlanSelectionSnapshotLabel\(planSelectionSnapshot\.selectedPlanId, 'none'\);)(?=[\s\S]*const canSelectLabel = getPlanSelectionSnapshotBooleanLabel\(planSelectionSnapshot\.canSelect\);)(?=[\s\S]*const contentValue = message\.content;)(?=[\s\S]*const hasContent = hasPlanSelectionSnapshotTextValue\(contentValue\);)(?=[\s\S]*\{hasContent === true &&)(?=[\s\S]*<MarkdownContent content=\{contentValue\} \/>)(?=[\s\S]*data-testid="workspace-plan-selection-snapshot"[\s\S]*Phase: \{planSelectionSnapshot\.status\}[\s\S]*Source: \{planSelectionSnapshot\.source\}[\s\S]*Plans: \{planSelectionSnapshot\.planCount\}[\s\S]*Recommended: \{recommendedPlanLabel\}[\s\S]*Selected: \{selectedPlanLabel\}[\s\S]*CanSelect: \{canSelectLabel\}[\s\S]*恢复建议：\{planSelectionSnapshot\.recovery\})/,
  'workspace plan selection message should render phase, source, plan count, recommendation, selection, selectability and recovery guidance',
);
assert.match(
  planMessageHelpersSource,
  /export type PendingPlanConfirmIntent = 'confirm';[\s\S]*export type PendingPlanDiscussIntent = 'discuss';[\s\S]*export type PendingPlanReplanIntent = 'replan';[\s\S]*export type PendingPlanClarifyIntent = 'clarify';[\s\S]*export type PendingPlanIntent =[\s\S]*PendingPlanConfirmIntent[\s\S]*PendingPlanDiscussIntent[\s\S]*PendingPlanReplanIntent[\s\S]*PendingPlanClarifyIntent;[\s\S]*export type PendingPlanIntentResult =[\s\S]*intent: PendingPlanConfirmIntent; plan: Plan[\s\S]*intent: PendingPlanDiscussIntent[\s\S]*intent: PendingPlanReplanIntent[\s\S]*intent: PendingPlanClarifyIntent; message: string[\s\S]*function classifyPendingPlanIntent\(rawInput: string\): PendingPlanIntent[\s\S]*export function resolvePendingPlanIntent\([\s\S]*\): PendingPlanIntentResult/,
  'workspace plan message helper should expose pending plan intent as a named contract consumed by classification and resolution results',
);
assert.doesNotMatch(
  planMessageHelpersSource,
  /(?:^|\n)type PendingPlanIntent = 'confirm' \| 'discuss' \| 'replan' \| 'clarify';/,
  'workspace plan message helper should not regress pending plan intent to a local inline type',
);
assert.doesNotMatch(
  planMessageHelpersSource,
  /Extract<PendingPlanIntent,/,
  'workspace plan message helper should not infer pending plan intent results through Extract',
);
assert.match(
  chatPlanSnapshotSource,
  /(?=[\s\S]*PlanThoughtProcessSnapshotSource)(?=[\s\S]*PlanThoughtProcessSnapshotStatus)(?=[\s\S]*function isPlanThoughtProcessSnapshotStreaming\(streaming: boolean\): boolean \{[\s\S]*return streaming === true;)(?=[\s\S]*function isPlanThoughtProcessSnapshotOpen\(open: boolean\): boolean \{[\s\S]*return open === true;)(?=[\s\S]*function isPlanThoughtProcessSnapshotUserToggle\(source: PlanThoughtProcessSnapshotSource\): boolean \{[\s\S]*return source === 'user_toggle';)(?=[\s\S]*export function buildPlanThoughtProcessSnapshot\([\s\S]*\): PlanThoughtProcessSnapshot \{)(?=[\s\S]*status: PlanThoughtProcessSnapshotStatus = 'empty')(?=[\s\S]*snapshotSource: PlanThoughtProcessSnapshotSource = 'message_restore')(?=[\s\S]*const isStreaming = isPlanThoughtProcessSnapshotStreaming\(streaming\);)(?=[\s\S]*if \(isStreaming === true\))(?=[\s\S]*status: PlanThoughtProcessSnapshotStatus = 'streaming')(?=[\s\S]*snapshotSource: PlanThoughtProcessSnapshotSource = 'plan_stream')(?=[\s\S]*const isOpen = isPlanThoughtProcessSnapshotOpen\(open\);)(?=[\s\S]*if \(isOpen === true\))(?=[\s\S]*status: PlanThoughtProcessSnapshotStatus = 'expanded')(?=[\s\S]*const isUserToggle = isPlanThoughtProcessSnapshotUserToggle\(source\);)(?=[\s\S]*status: PlanThoughtProcessSnapshotStatus = isUserToggle === true \? 'collapsed' : 'settled')/,
  'workspace plan thought process helper should derive empty, streaming, expanded, collapsed and settled phases from content, streaming and toggle facts through named predicates',
);
assert.doesNotMatch(
  chatPlanSnapshotSource,
  /PlanThoughtProcessSnapshot\['status'\]|PlanThoughtProcessSnapshot\['source'\]|if \(streaming\)|if \(open\)|status: PlanThoughtProcessSnapshotStatus = source === 'user_toggle'|message: source === 'user_toggle'/,
  'workspace plan thought process snapshot helper should not infer status/source from indexed snapshot access or implicit streaming/open/source gates',
);
assert.doesNotMatch(
  chatPlanThoughtSource,
  /thoughtProcessSnapshot\.isOpen \? 'yes' : 'no'|content\?\.trim\(\) \?\? ''|Boolean\(streaming\)|Boolean\(thoughtContent\)|streaming \? 'plan_stream' : 'message_restore'|streaming: Boolean\(streaming\)|const isStreaming = streaming === true;|const shouldOpenInitially = isStreaming === true \|\| hasThoughtContent === true;|isStreaming === true \? 'plan_stream' : 'message_restore'|const planThoughtProcessTitle = isStreaming === true \? '思考中' : '思考过程';|const shouldRenderStreamingIndicator = isStreaming === true;|const DisclosureIcon = open === true \? ChevronDown : ChevronRight;|\{thoughtContent \? \(|\{hasThoughtContent === true \?/,
  'workspace plan thought process should not regress to inline open-state display gates or truthy streaming/content facts',
);
assert.match(
  chatPlanThoughtSource,
  /(?=[\s\S]*import \{ buildPlanThoughtProcessSnapshot \} from '\.\/workspace-chat-plan-snapshot';)(?=[\s\S]*function getPlanThoughtProcessContent\(content: string \| undefined\): string \{[\s\S]*if \(content === undefined\)[\s\S]*return content\.trim\(\);)(?=[\s\S]*function hasPlanThoughtProcessContent\(content: string\): boolean \{[\s\S]*const hasContent = content\.length > 0;[\s\S]*return hasContent === true;)(?=[\s\S]*function isPlanThoughtProcessStreaming\(streaming: boolean \| undefined\): boolean \{[\s\S]*return streaming === true;)(?=[\s\S]*function shouldOpenPlanThoughtProcessInitially\([\s\S]*isStreaming: boolean;[\s\S]*hasThoughtContent: boolean;[\s\S]*\): boolean[\s\S]*if \(isStreaming === true\)[\s\S]*return hasThoughtContent === true;)(?=[\s\S]*function getPlanThoughtProcessSnapshotSource\(isStreaming: boolean\): PlanThoughtProcessSnapshotSource[\s\S]*if \(isStreaming === true\)[\s\S]*return 'message_restore';)(?=[\s\S]*const thoughtContent = getPlanThoughtProcessContent\(content\);[\s\S]*const hasThoughtContent = hasPlanThoughtProcessContent\(thoughtContent\);[\s\S]*const isStreaming = isPlanThoughtProcessStreaming\(streaming\);[\s\S]*const shouldOpenInitially = shouldOpenPlanThoughtProcessInitially\(\{[\s\S]*isStreaming,[\s\S]*hasThoughtContent,[\s\S]*\}\);[\s\S]*useState\(shouldOpenInitially\)[\s\S]*useState<PlanThoughtProcessSnapshotSource>\([\s\S]*getPlanThoughtProcessSnapshotSource\(isStreaming\)[\s\S]*if \(isStreaming === true\)[\s\S]*setSnapshotSource\(getPlanThoughtProcessSnapshotSource\(isStreaming\)\);[\s\S]*const thoughtProcessSnapshot = buildPlanThoughtProcessSnapshot\(\{[\s\S]*contentLength: thoughtContent\.length,[\s\S]*streaming: isStreaming,[\s\S]*open,[\s\S]*source: snapshotSource,)/,
  'workspace plan thought process should use the shared helper with authoritative content, streaming and toggle facts',
);
assert.match(
  chatPlanThoughtSource,
  /(?=[\s\S]*function getPlanThoughtProcessSnapshotBooleanLabel)(?=[\s\S]*function getPlanThoughtProcessTitle\(isStreaming: boolean\): string[\s\S]*return '思考过程';)(?=[\s\S]*function shouldRenderPlanThoughtProcessStreamingIndicator\(isStreaming: boolean\): boolean[\s\S]*return isStreaming === true;)(?=[\s\S]*function renderPlanThoughtProcessDisclosureIcon\(open: boolean\)[\s\S]*<ChevronDown[\s\S]*<ChevronRight)(?=[\s\S]*function shouldRenderPlanThoughtProcessContent\(hasThoughtContent: boolean\): boolean[\s\S]*return hasThoughtContent === true;)(?=[\s\S]*const isOpenLabel = getPlanThoughtProcessSnapshotBooleanLabel\(thoughtProcessSnapshot\.isOpen\);)(?=[\s\S]*const planThoughtProcessTitle = getPlanThoughtProcessTitle\(isStreaming\);)(?=[\s\S]*const shouldRenderStreamingIndicator = shouldRenderPlanThoughtProcessStreamingIndicator\(isStreaming\);)(?=[\s\S]*const disclosureIcon = renderPlanThoughtProcessDisclosureIcon\(open\);)(?=[\s\S]*\{disclosureIcon\})(?=[\s\S]*data-testid="workspace-plan-thought-process-snapshot"[\s\S]*Phase: \{thoughtProcessSnapshot\.status\}[\s\S]*Source: \{thoughtProcessSnapshot\.source\}[\s\S]*Open: \{isOpenLabel\}[\s\S]*Chars: \{thoughtProcessSnapshot\.contentLength\}[\s\S]*恢复建议：\{thoughtProcessSnapshot\.recovery\})/,
  'workspace plan thought process should render phase, source, open state, content length and recovery guidance without dynamic component creation',
);
assert.match(
  chatStateSummarySource,
  /export type WorkspaceChatStateSummaryTone = 'neutral' \| 'info' \| 'success' \| 'warning' \| 'danger';[\s\S]*export type WorkspaceChatStateSummaryToneTarget = 'container' \| 'summary';[\s\S]*export type WorkspaceChatStateSummaryTonePriorityMap = \{[\s\S]*\[tone in WorkspaceChatStateSummaryTone\]: number;[\s\S]*\};[\s\S]*type WorkspaceChatStateSummaryFactNodeList = ReactNode\[\];[\s\S]*const summaryTonePriority: WorkspaceChatStateSummaryTonePriorityMap = \{[\s\S]*danger: 4,[\s\S]*function getWorkspaceChatStateSummaryActiveRules\([\s\S]*rules: WorkspaceChatStateSummaryRule\[\],[\s\S]*\): WorkspaceChatStateSummaryRule\[\] \{[\s\S]*const activeRules: WorkspaceChatStateSummaryRule\[\] = \[\];[\s\S]*for \(const rule of rules\)[\s\S]*if \(rule\.active === true\)[\s\S]*activeRules\.push\(rule\);[\s\S]*function getWorkspaceChatStateSummaryTone\([\s\S]*activeRules: WorkspaceChatStateSummaryRule\[\],[\s\S]*fallbackTone: WorkspaceChatStateSummaryTone,[\s\S]*\): WorkspaceChatStateSummaryTone \{[\s\S]*let tone = fallbackTone;[\s\S]*for \(const rule of activeRules\)[\s\S]*const hasHigherPriority = summaryTonePriority\[rule\.tone\] > summaryTonePriority\[tone\];[\s\S]*if \(hasHigherPriority === true\)[\s\S]*tone = rule\.tone;[\s\S]*function shouldOpenWorkspaceChatStateSummary\([\s\S]*activeRules: WorkspaceChatStateSummaryRule\[\],[\s\S]*\): boolean \{[\s\S]*for \(const rule of activeRules\)[\s\S]*if \(rule\.autoOpen === true\)[\s\S]*return true;[\s\S]*return false;[\s\S]*function getWorkspaceChatStateSummaryOpenValue\(shouldOpen: boolean\): true \| undefined \{[\s\S]*if \(shouldOpen === true\)[\s\S]*return true;[\s\S]*return undefined;[\s\S]*function shouldApplyWorkspaceChatStateSummaryContainerTone\([\s\S]*toneTarget: WorkspaceChatStateSummaryToneTarget,[\s\S]*\): boolean \{[\s\S]*return toneTarget === 'container';[\s\S]*function shouldApplyWorkspaceChatStateSummarySummaryTone\([\s\S]*toneTarget: WorkspaceChatStateSummaryToneTarget,[\s\S]*\): boolean \{[\s\S]*return toneTarget === 'summary';[\s\S]*function materializeWorkspaceChatStateSummaryFactNodes\([\s\S]*facts: ReactNode\[\],[\s\S]*\): WorkspaceChatStateSummaryFactNodeList \{[\s\S]*const nodes: WorkspaceChatStateSummaryFactNodeList = \[\];[\s\S]*for \(let index = 0; index < facts\.length; index \+= 1\)[\s\S]*const fact = facts\[index\];[\s\S]*if \(fact === undefined\)[\s\S]*nodes\.push\([\s\S]*<span key=\{index\}>\{fact\}<\/span>[\s\S]*return nodes;[\s\S]*resolveWorkspaceChatStateSummaryRules[\s\S]*const activeRules = getWorkspaceChatStateSummaryActiveRules\(rules\);[\s\S]*const tone = getWorkspaceChatStateSummaryTone\(activeRules, fallbackTone\);[\s\S]*shouldOpen: shouldOpenWorkspaceChatStateSummary\(activeRules\)[\s\S]*getWorkspaceChatStateSummaryToneClassName[\s\S]*WorkspaceChatStateSummaryDisclosure[\s\S]*toneTarget: WorkspaceChatStateSummaryToneTarget;[\s\S]*const detailsOpenValue = getWorkspaceChatStateSummaryOpenValue\(shouldOpen\);[\s\S]*const shouldApplyContainerTone = shouldApplyWorkspaceChatStateSummaryContainerTone\(toneTarget\);[\s\S]*const shouldApplySummaryTone = shouldApplyWorkspaceChatStateSummarySummaryTone\(toneTarget\);[\s\S]*open=\{detailsOpenValue\}[\s\S]*shouldApplyContainerTone === true && toneClassName[\s\S]*shouldApplySummaryTone === true && toneClassName[\s\S]*materializeWorkspaceChatStateSummaryFactNodes\(facts\)/,
  'workspace chat state summaries should share named rule scanning, tone priority, auto-open resolution and disclosure rendering helpers',
);
assert.doesNotMatch(
  chatStateSummarySource,
  /Record<WorkspaceChatStateSummaryTone, number>|rules\.filter\(|activeRules\.reduce|activeRules\.some\(|facts\.map\(|shouldOpen \? true : undefined|toneTarget === 'container' && toneClassName|toneTarget === 'summary' && toneClassName/,
  'workspace chat state summary rule resolution and disclosure rendering should not regress to anonymous maps, array pipeline gates or inline render gates',
);
assert.doesNotMatch(
  chatStateSummarySource,
  /toneTarget: ['"]container['"] \| ['"]summary['"];/,
  'workspace chat state summary tone target should not regress to an inline union',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*function getWorkspaceChatPendingAttachmentRemoval\([\s\S]*attachedFiles: WorkspaceChatAttachment\[\],[\s\S]*pendingAttachmentRemovalIndex: number \| null,[\s\S]*\): WorkspaceChatAttachment \| null)(?=[\s\S]*function hasWorkspaceChatBusyInputSnapshot\(\{[\s\S]*hasInputPlanning,[\s\S]*hasInputGenerating,[\s\S]*hasInputPlanSelectionRequired,)(?=[\s\S]*function hasWorkspaceChatBusyModeSnapshot\([\s\S]*hasModePlanning: boolean,[\s\S]*hasModeGenerating: boolean,)(?=[\s\S]*function shouldRenderWorkspaceChatAttachedFiles\(attachedFiles: WorkspaceChatAttachment\[\]\): boolean)(?=[\s\S]*function shouldRenderWorkspaceChatStopConfirmation\(isStopConfirming: boolean\): boolean)(?=[\s\S]*const pendingAttachmentRemoval = getWorkspaceChatPendingAttachmentRemoval\([\s\S]*attachedFiles,[\s\S]*pendingAttachmentRemovalIndex,)(?=[\s\S]*const hasInputStopConfirmation = chatInputSnapshot\.status === 'stop_confirmation';)(?=[\s\S]*const hasModelLoadFailed = chatModelRegistrySnapshot\.status === 'load_failed';)(?=[\s\S]*const hasModeStopConfirmation = chatModeSnapshot\.status === 'stop_confirmation';)(?=[\s\S]*const hasBusyInputSnapshot = hasWorkspaceChatBusyInputSnapshot\(\{[\s\S]*hasInputPlanning,[\s\S]*hasInputGenerating,[\s\S]*hasInputPlanSelectionRequired,)(?=[\s\S]*const hasModelEmpty = chatModelRegistrySnapshot\.status === 'empty';)(?=[\s\S]*const hasAttachmentPickerEmpty = chatAttachmentSnapshot\.status === 'picker_empty';)(?=[\s\S]*const hasBusyModeSnapshot = hasWorkspaceChatBusyModeSnapshot\(hasModePlanning, hasModeGenerating\);)(?=[\s\S]*const shouldRenderAttachedFiles = shouldRenderWorkspaceChatAttachedFiles\(attachedFiles\);)(?=[\s\S]*const shouldRenderStopConfirmation = shouldRenderWorkspaceChatStopConfirmation\(isStopConfirming\);)(?=[\s\S]*const composerStateSummary = resolveWorkspaceChatStateSummaryRules\(\[[\s\S]*active: hasInputStopConfirmation[\s\S]*tone: 'danger'[\s\S]*autoOpen: true[\s\S]*active: hasModelLoadFailed[\s\S]*tone: 'danger'[\s\S]*autoOpen: true[\s\S]*active: hasModeStopConfirmation[\s\S]*tone: 'danger'[\s\S]*autoOpen: true[\s\S]*active: hasBusyInputSnapshot[\s\S]*tone: 'warning'[\s\S]*active: hasModelEmpty[\s\S]*tone: 'warning'[\s\S]*autoOpen: true[\s\S]*active: hasAttachmentPickerEmpty[\s\S]*tone: 'warning'[\s\S]*autoOpen: true[\s\S]*active: hasBusyModeSnapshot[\s\S]*tone: 'warning')/,
  'workspace chat composer summary should use shared rules for critical input, model, attachment and mode states',
);
assert.match(
  chatComponentsSource,
  /<WorkspaceChatStateSummaryDisclosure[\s\S]*testId="workspace-chat-composer-state-summary"[\s\S]*title="Composer 状态汇总"[\s\S]*<>Input: \{chatInputSnapshot\.status\}<\/>[\s\S]*<>Model: \{chatModelRegistrySnapshot\.status\}<\/>[\s\S]*<>Attachment: \{chatAttachmentSnapshot\.status\}<\/>[\s\S]*<>Mode: \{chatModeSnapshot\.status\}<\/>[\s\S]*<>CanSend: \{canSendLabel\}<\/>[\s\S]*<>Online: \{onlineLabel\}<\/>[\s\S]*description="展开查看输入、模型、附件和模式的完整 Phase\/Source\/Recovery 子快照。"[\s\S]*containerClassName="app-debug-only/,
  'workspace chat composer should keep child snapshot summary available only in debug UI while preserving key state facts',
);
assert.match(
  shellStateSource,
  /import \{[\s\S]*buildEmptyMessagesChatScrollSnapshot,[\s\S]*buildInitialChatScrollSnapshot,[\s\S]*buildManualRestoreChatScrollSnapshot,[\s\S]*buildMissingChatScrollContainerSnapshot,[\s\S]*buildPausedMessageCountChatScrollSnapshot,[\s\S]*buildUserScrollChatScrollSnapshot,[\s\S]*\} from '\.\/workspace-chat-scroll-snapshot';[\s\S]*useState<ChatScrollSnapshot>\([\s\S]*\(\) => buildInitialChatScrollSnapshot\(messagesLength\),/,
  'workspace shell state should initialize chat scroll snapshot through the shared helper without render-time timestamps',
);
assert.match(
  shellStateSource,
  /function isWorkspaceShellMobileChatView\(isMobile: boolean, mobileView: WorkspaceMobileView\): boolean[\s\S]*return isMobile === true && mobileView === 'chat';[\s\S]*function hasWorkspaceShellMessagesContainer\([\s\S]*element: HTMLDivElement \| null,[\s\S]*\): element is HTMLDivElement[\s\S]*return element !== null;[\s\S]*function isWorkspaceShellResizing\(isResizing: boolean\): boolean[\s\S]*return isResizing === true;[\s\S]*function isWorkspaceShellChatAutoScrollEnabled\(isChatAutoScrollEnabled: boolean\): boolean[\s\S]*return isChatAutoScrollEnabled === true;/,
  'workspace shell state should derive mobile view, container, resizing and auto-scroll facts through named helpers',
);
assert.match(
  chatScrollSnapshotSource,
  /export function buildInitialChatScrollSnapshot\([\s\S]*status: 'empty_messages'[\s\S]*source: 'message_list'[\s\S]*updatedAt: 'pending'[\s\S]*export function buildEmptyMessagesChatScrollSnapshot\([\s\S]*status: 'empty_messages'[\s\S]*source: 'message_list'/,
  'workspace chat scroll helper should construct initial and empty message snapshots',
);
assert.match(
  chatScrollSnapshotSource,
  /(?=[\s\S]*export function buildMissingChatScrollContainerSnapshot\()(?=[\s\S]*status: 'container_missing')(?=[\s\S]*source: 'scroll_effect')(?=[\s\S]*聊天滚动容器尚未挂载)(?=[\s\S]*聊天滚动容器和消息末端锚点都不可用)/,
  'workspace chat scroll helper should surface missing chat scroll containers as persistent snapshots',
);
assert.match(
  chatScrollSnapshotSource,
  /(?=[\s\S]*ChatScrollSnapshotSource)(?=[\s\S]*ChatScrollSnapshotStatus)(?=[\s\S]*export function buildUserScrollChatScrollSnapshot\()(?=[\s\S]*status: ChatScrollSnapshotStatus = messageCount === 0)(?=[\s\S]*source: ChatScrollSnapshotSource = 'user_scroll')(?=[\s\S]*'empty_messages')(?=[\s\S]*'following_latest')(?=[\s\S]*'paused_by_user')(?=[\s\S]*距离最新输出约)/,
  'workspace chat scroll helper should derive empty, following and user-paused scroll phases from message count and distance',
);
assert.doesNotMatch(
  chatScrollSnapshotSource,
  /ChatScrollSnapshot\['status'\]|ChatScrollSnapshot\['source'\]/,
  'workspace chat scroll helper should not infer status/source from indexed snapshot access',
);
assert.match(
  chatScrollSnapshotSource,
  /export type ChatScrollManualRestoreMethod = 'container' \| 'anchor';[\s\S]*method: ChatScrollManualRestoreMethod;[\s\S]*export function buildManualRestoreChatScrollSnapshot\([\s\S]*status: ChatScrollSnapshotStatus = isEmpty \? 'empty_messages' : 'restored_to_latest'[\s\S]*source: ChatScrollSnapshotSource = 'manual_restore'[\s\S]*distanceToBottom: 0[\s\S]*已通过消息末端锚点恢复到最新输出/,
  'workspace manual restore helper should write a restored_to_latest snapshot with zero bottom distance through a named restore method contract',
);
assert.doesNotMatch(
  chatScrollSnapshotSource,
  /method: 'container' \| 'anchor';/,
  'workspace manual restore helper should not regress restore method to an inline union',
);
assert.match(
  chatScrollSnapshotSource,
  /export function buildPausedMessageCountChatScrollSnapshot\([\s\S]*messageCount,[\s\S]*previousSnapshot\.status === 'paused_by_user'[\s\S]*点击“回到最新输出”可恢复自动跟随。/,
  'workspace chat scroll helper should keep paused snapshots current and actionable on message count changes',
);
assert.match(
  shellStateSource,
  /(?=[\s\S]*const chatWidthRef = useRef\(chatWidth\);)(?=[\s\S]*const shouldUseMobileMessages = isWorkspaceShellMobileChatView\(isMobile, mobileView\);[\s\S]*if \(shouldUseMobileMessages === true\))(?=[\s\S]*const hasMessagesContainer = hasWorkspaceShellMessagesContainer\(element\);[\s\S]*if \(hasMessagesContainer === false\)[\s\S]*setChatScrollSnapshot\(buildMissingChatScrollContainerSnapshot\(\{ messageCount: messagesLength \}\)\)[\s\S]*setChatScrollSnapshot\(buildUserScrollChatScrollSnapshot\(\{ messageCount: messagesLength, distanceToBottom \}\)\))(?=[\s\S]*const shouldResize = isWorkspaceShellResizing\(isResizing\);[\s\S]*if \(shouldResize === false\) return;[\s\S]*if \(chatWidthRef\.current === newWidth\)[\s\S]*chatWidthRef\.current = newWidth;[\s\S]*setChatWidth\(newWidth\);)(?=[\s\S]*if \(isWorkspaceShellResizing\(isResizing\) === true\))(?=[\s\S]*if \(hasWorkspaceShellMessagesContainer\(activeContainer\) === true\)[\s\S]*buildManualRestoreChatScrollSnapshot\(\{[\s\S]*method: 'container')(?=[\s\S]*const messagesEndElement = messagesEndRef\.current;[\s\S]*if \(hasWorkspaceShellMessagesContainer\(messagesEndElement\) === true\)[\s\S]*buildManualRestoreChatScrollSnapshot\(\{[\s\S]*method: 'anchor')(?=[\s\S]*buildMissingChatScrollContainerSnapshot\(\{[\s\S]*anchorMissing: true)(?=[\s\S]*buildEmptyMessagesChatScrollSnapshot\(\))(?=[\s\S]*if \(isWorkspaceShellChatAutoScrollEnabled\(isChatAutoScrollEnabled\) === false\)[\s\S]*buildPausedMessageCountChatScrollSnapshot\(prev, messagesLength\))/,
  'workspace shell state should use explicit facts, avoid duplicate chat width updates and share chat scroll helpers for container, user scroll, manual restore, empty and paused refresh paths',
);
assert.doesNotMatch(
  shellStateSource,
  /if \(!element\)|if \(!isResizing\)|if \(!isChatAutoScrollEnabled\)|if \(activeContainer\)|if \(messagesEndRef\.current\)|if \(isResizing\)|isMobile && mobileView === 'chat'/,
  'workspace shell state should not regress chat scroll and resizing gates to truthy checks',
);
assert.match(
  chatComponentsSource,
  /<WorkspaceChatStateSummaryDisclosure[\s\S]*testId="workspace-chat-message-state-summary"[\s\S]*title="消息区状态汇总"[\s\S]*<>Workflow: \{workflowStatusLabel\}<\/>[\s\S]*<>Phase: \{currentPhase\}<\/>[\s\S]*<>PhaseStatus: \{phaseStatusLabel\}<\/>[\s\S]*<>Scroll: \{chatScrollSnapshot\.status\}<\/>[\s\S]*<>Messages: \{chatScrollSnapshot\.messageCount\}<\/>[\s\S]*description="展开查看 workflow、phase 和 scroll 的完整结构化状态与恢复建议。"[\s\S]*containerClassName=\{cn\('app-debug-only/,
  'workspace chat panel should keep workflow, phase and scroll state summary behind debug-only UI',
);
assert.match(
  chatComponentsSource,
  /function appendWorkspaceUserFlowFoundationStep\([\s\S]*Foundation 前置设计[\s\S]*function appendWorkspaceUserFlowPlanGenerationStep\([\s\S]*id: 'plan-generation'[\s\S]*label: '方案生成'[\s\S]*技术方案生成失败[\s\S]*function appendWorkspaceUserFlowPlanSelectionStep\([\s\S]*已选择「\$\{selectedPlanName\}」[\s\S]*方案选择[\s\S]*function appendWorkspaceUserFlowPlanExecutionStep\([\s\S]*开始按方案执行[\s\S]*function appendWorkspaceUserFlowPhaseStep\([\s\S]*function appendWorkspaceUserFlowValidationStep\([\s\S]*验证与修复[\s\S]*function appendWorkspaceUserFlowRuntimeStep\([\s\S]*运行与预览[\s\S]*function appendWorkspaceUserFlowRecoveryStep\([\s\S]*恢复与后续迭代/,
  'workspace user flow progress should derive the visible flow from Foundation, plan generation, plan selection, execution, phase, validation, runtime and recovery states',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*type WorkspaceUserFlowStepStatus = 'completed' \| 'active' \| 'pending' \| 'paused' \| 'blocked';)(?=[\s\S]*status: hasPauseReason === true \|\| isAwaitingConfirmation === true \? 'paused' : 'completed')(?=[\s\S]*if \(step\.status === 'paused'\)[\s\S]*return step;)(?=[\s\S]*if \(status === 'paused'\)[\s\S]*border-amber-500\/35[\s\S]*bg-amber-500\/10[\s\S]*text-amber-700[\s\S]*dark:text-amber-300)(?=[\s\S]*function normalizeWorkspaceUserFlowSteps\([\s\S]*if \(step\.status === 'pending'\)[\s\S]*if \(step\.status !== 'completed'\)[\s\S]*if \(hasCurrentStep === true\))(?=[\s\S]*function getWorkspaceUserFlowTimelineTextClassName\(status: WorkspaceUserFlowStepStatus\): string[\s\S]*text-emerald-700[\s\S]*text-primary[\s\S]*text-amber-700[\s\S]*text-destructive)(?=[\s\S]*function getWorkspaceUserFlowTimelineText\(status: WorkspaceUserFlowStepStatus, label: string, detail: string\): string[\s\S]*return `\$\{label\}中`;[\s\S]*return `暂停中 \$\{pauseReason\}`;[\s\S]*return `需要处理 \$\{detail\}`;)(?=[\s\S]*function materializeWorkspaceUserFlowTimelineNodes\(steps: WorkspaceUserFlowStepList\): WorkspaceUserFlowStepNodeList)(?=[\s\S]*const timelineText = getWorkspaceUserFlowTimelineText\(step\.status, step\.label, step\.detail\);)(?=[\s\S]*<li key=\{step\.id\} className=\{cn\('flex min-w-0 items-center gap-2 text-\[11px\] leading-5', getWorkspaceUserFlowTimelineTextClassName\(step\.status\)\)\}>)(?=[\s\S]*<span className="min-w-0 truncate font-medium" title=\{timelineText\}>\{timelineText\}<\/span>)(?=[\s\S]*const activeStepTimelineText = getWorkspaceUserFlowTimelineText\(activeStep\.status, activeStep\.label, activeStep\.detail\);)(?=[\s\S]*data-testid="workspace-user-flow-progress"[\s\S]*bg-gradient-to-r from-background via-muted\/20 to-background)(?=[\s\S]*rounded-xl border bg-background\/80 px-3 py-2 shadow-sm)(?=[\s\S]*\{activeStepTimelineText\})/,
  'workspace user flow progress should render only completed steps plus the current step, render paused flow in amber, present a concise current-step summary, and expand into a compact icon-plus-text timeline list',
);
assert.doesNotMatch(
  chatComponentsSource,
  /id: 'preview-check'|status: previewStatus|const approvedPlanStatus|const planPreparationStatus|status: planSelectionStatus|return \[\s*\{\s*id: 'plan-preparation'|flex-wrap items-center gap-x-2|overflow-x-auto|WORKSPACE_USER_FLOW_MIN_STEP_WIDTH|getWorkspaceUserFlowRowSize|getWorkspaceUserFlowRows|materializeWorkspaceUserFlowRows|getWorkspaceUserFlowRowDirectionClassName|getWorkspaceUserFlowTurnConnectorNode|getWorkspaceUserFlowTimelineConnectorNode|getWorkspaceUserFlowStatusLabel|flex-row-reverse|ResizeObserver|flowContainerWidthRef|<Badge variant="outline" className="shrink-0 bg-background\/60 text-\[10px\]">|<p className="mt-1 truncate text-\[11px\] text-muted-foreground">\{step\.detail\}<\/p>|grid grid-cols-\[1\.5rem_1fr\] gap-3 pb-3 last:pb-0/,
  'workspace user flow progress must not render a fixed example-only flow, grey pending future steps, S-shaped row layout machinery, status badges or verbose detail rows',
);
assert.match(
  chatMessageContentSource,
  /<div className="app-debug-only">[\s\S]*<EngineeringStatePanel[\s\S]*<\/div>/,
  'workspace engineering state detail panel should be hidden behind debug-only UI for ordinary users',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*function getWorkspaceChatEngineeringExecutionState\([\s\S]*\): WorkspaceExecutionState \| undefined)(?=[\s\S]*function getWorkspaceChatEngineeringPhaseState\([\s\S]*\): WorkspacePhaseState \| undefined)(?=[\s\S]*function getWorkspaceChatEngineeringWorkflowStageLabel\([\s\S]*\): string)(?=[\s\S]*function getWorkspaceChatEngineeringPhaseTasks\(phase: WorkspacePhaseState \| undefined\): string\[\])(?=[\s\S]*function getWorkspaceChatEngineeringPhaseBlockers\(phase: WorkspacePhaseState \| undefined\): string\[\])(?=[\s\S]*function getWorkspaceChatPhaseListLimit\(compact: boolean \| undefined\): number \{[\s\S]*if \(compact === true\)[\s\S]*return WORKSPACE_CHAT_PHASE_LIST_DEFAULT_LIMIT;)(?=[\s\S]*function materializeWorkspaceChatPhaseItemNodes\(\{[\s\S]*items,[\s\S]*limit,[\s\S]*\}: \{[\s\S]*items: string\[\];[\s\S]*limit: number;[\s\S]*\}\): WorkspaceChatPhaseItemNodeList \{[\s\S]*const nodes: WorkspaceChatPhaseItemNodeList = \[\];[\s\S]*for \(let index = 0; index < items\.length && index < limit; index \+= 1\)[\s\S]*const itemKey = `\$\{item\}-\$\{index\}`;[\s\S]*nodes\.push\([\s\S]*<div key=\{itemKey\} className="truncate">· \{item\}<\/div>[\s\S]*return nodes;)(?=[\s\S]*function getWorkspaceChatEngineeringPhaseStatus\([\s\S]*phase: WorkspacePhaseState \| undefined,[\s\S]*\): WorkspacePhaseStatus \| undefined)(?=[\s\S]*function getWorkspaceChatEngineeringPhaseCurrentPhase\(phase: WorkspacePhaseState \| undefined\): string)(?=[\s\S]*function getWorkspaceChatEngineeringExecutionPauseReason\(execution: WorkspaceExecutionState \| undefined\): string)(?=[\s\S]*function hasWorkspaceChatEngineeringExecutionAwaitingConfirmation\([\s\S]*execution: WorkspaceExecutionState \| undefined,[\s\S]*\): boolean)(?=[\s\S]*function hasWorkspaceChatEngineeringActiveExecution\([\s\S]*hasCurrentTask: boolean,[\s\S]*hasNextAction: boolean,[\s\S]*\): boolean)(?=[\s\S]*function getWorkspaceChatEngineeringFallbackTextValue\(value: string \| undefined, fallback: string\): string)(?=[\s\S]*function getWorkspaceChatEngineeringPhaseStatusLabel\(phase: WorkspacePhaseState \| undefined\): string)(?=[\s\S]*function getWorkspaceChatEngineeringPhaseSummaryStatusLabel\(phase: WorkspacePhaseState \| undefined\): string)(?=[\s\S]*function getWorkspaceChatWorkflowSummaryStatusLabel\([\s\S]*engineeringState: WorkspaceEngineeringStateSnapshot \| undefined,[\s\S]*\): string)(?=[\s\S]*function getWorkspaceChatEngineeringCurrentPhase\([\s\S]*fallback: string,[\s\S]*\): string)(?=[\s\S]*function getWorkspaceChatEngineeringCurrentTask\([\s\S]*phase: WorkspacePhaseState \| undefined,[\s\S]*execution: WorkspaceExecutionState \| undefined,[\s\S]*\): string)(?=[\s\S]*function getWorkspaceChatEngineeringNextAction\([\s\S]*phase: WorkspacePhaseState \| undefined,[\s\S]*execution: WorkspaceExecutionState \| undefined,[\s\S]*\): string)(?=[\s\S]*function shouldRenderWorkspaceChatPhaseSnapshot\([\s\S]*hasCurrentPhase: boolean;[\s\S]*hasCurrentTask: boolean;[\s\S]*hasNextAction: boolean;[\s\S]*hasCompletedTasks: boolean;[\s\S]*hasBlockers: boolean;)(?=[\s\S]*function shouldRenderWorkspaceChatPhaseLists\([\s\S]*hasCompletedTasks: boolean,[\s\S]*hasBlockers: boolean,[\s\S]*\): boolean)(?=[\s\S]*function hasWorkspaceChatPhaseStatus\([\s\S]*phase: WorkspacePhaseState \| undefined,[\s\S]*status: WorkspacePhaseStatus,[\s\S]*\): boolean)(?=[\s\S]*function hasWorkspaceChatScrollFollowingLatest\(chatScrollSnapshot: ChatScrollSnapshot\): boolean)(?=[\s\S]*function buildWorkflowStatusLabel\(engineeringState\?: WorkspaceEngineeringStateSnapshot\)[\s\S]*const hasExecution = execution !== undefined;[\s\S]*const hasPauseReason = hasWorkspaceChatEngineeringTextValue\(pauseReason\);[\s\S]*const hasAwaitingConfirmation = execution\.awaiting_confirmation === true;[\s\S]*const hasActiveExecution = hasWorkspaceChatEngineeringActiveExecution\(hasCurrentTask, hasNextAction\);)(?=[\s\S]*function WorkspaceEngineeringStatusStrip[\s\S]*const hasStatusLabel = statusLabel !== undefined;[\s\S]*const hasApprovalBoundary = hasWorkspaceChatEngineeringTextValue\(approvalBoundary\);[\s\S]*const hasNextAction = hasWorkspaceChatEngineeringTextValue\(nextAction\);)(?=[\s\S]*function WorkspacePhaseSnapshotStrip[\s\S]*const currentPhase = getWorkspaceChatEngineeringCurrentPhase\(phase, workflow, ''\);[\s\S]*const currentTask = getWorkspaceChatEngineeringCurrentTask\(phase, execution\);[\s\S]*const nextAction = getWorkspaceChatEngineeringNextAction\(phase, execution\);[\s\S]*const completedTasks = getWorkspaceChatEngineeringPhaseTasks\(phase\);[\s\S]*const blockers = getWorkspaceChatEngineeringPhaseBlockers\(phase\);[\s\S]*const phaseStatus = getWorkspaceChatEngineeringPhaseStatus\(phase\);[\s\S]*const phaseStatusLabel = getWorkspaceChatEngineeringPhaseStatusLabel\(phase\);[\s\S]*const shouldRenderPhaseSnapshot = shouldRenderWorkspaceChatPhaseSnapshot\(\{[\s\S]*hasCurrentPhase,[\s\S]*hasCurrentTask,[\s\S]*hasNextAction,[\s\S]*hasCompletedTasks,[\s\S]*hasBlockers,)(?=[\s\S]*const shouldRenderPhaseLists = shouldRenderWorkspaceChatPhaseLists\(hasCompletedTasks, hasBlockers\);)(?=[\s\S]*const phaseListLimit = getWorkspaceChatPhaseListLimit\(compact\);)(?=[\s\S]*materializeWorkspaceChatPhaseItemNodes\(\{[\s\S]*items: completedTasks,[\s\S]*limit: phaseListLimit,[\s\S]*\}\))(?=[\s\S]*materializeWorkspaceChatPhaseItemNodes\(\{[\s\S]*items: blockers,[\s\S]*limit: phaseListLimit,[\s\S]*\}\))(?=[\s\S]*const workflowStatusLabel = getWorkspaceChatWorkflowSummaryStatusLabel\(engineeringState\);)(?=[\s\S]*const phaseStatusLabel = getWorkspaceChatEngineeringPhaseSummaryStatusLabel\(phase\);)(?=[\s\S]*const currentPhase = getWorkspaceChatEngineeringCurrentPhase\(phase, workflow, '无阶段'\);)(?=[\s\S]*const executionPauseReason = getWorkspaceChatEngineeringExecutionPauseReason\(execution\);)(?=[\s\S]*const hasExecutionAwaitingConfirmation = hasWorkspaceChatEngineeringExecutionAwaitingConfirmation\(execution\);)(?=[\s\S]*const hasPhaseFailed = hasWorkspaceChatPhaseStatus\(phase, 'failed'\);)(?=[\s\S]*const hasPhasePending = hasWorkspaceChatPhaseStatus\(phase, 'pending'\);)(?=[\s\S]*const hasPhasePassed = hasWorkspaceChatPhaseStatus\(phase, 'passed'\);)(?=[\s\S]*const hasChatScrollFollowingLatest = hasWorkspaceChatScrollFollowingLatest\(chatScrollSnapshot\);)(?=[\s\S]*const messageStateSummary = resolveWorkspaceChatStateSummaryRules\(\[[\s\S]*active: hasExecutionPauseReason[\s\S]*active: hasPhaseFailed[\s\S]*active: hasPhaseBlockers[\s\S]*active: hasChatScrollContainerMissing[\s\S]*active: hasExecutionAwaitingConfirmation[\s\S]*active: hasChatScrollPausedByUser)/,
  'workspace chat message state summary should auto-expand for paused, blocked and missing-container states',
);
assert.match(
  chatComponentsSource,
  /(?=[\s\S]*function canSendWorkspaceChatComposerPrompt\(\{[\s\S]*hasPlanSelectionPending,[\s\S]*hasPrompt,[\s\S]*\}: \{[\s\S]*hasPlanSelectionPending: boolean;[\s\S]*hasPrompt: boolean;[\s\S]*\}\): boolean \{[\s\S]*if \(hasPlanSelectionPending === true\)[\s\S]*return hasPrompt === true;)(?=[\s\S]*function shouldRenderWorkspaceChatComposerOfflineFoundationStatus\(\{[\s\S]*isOfflineMode,[\s\S]*isCompact,[\s\S]*\}: \{[\s\S]*isOfflineMode: boolean;[\s\S]*isCompact: boolean;[\s\S]*\}\): boolean \{[\s\S]*if \(isOfflineMode === false\)[\s\S]*return isCompact === false;)(?=[\s\S]*function getWorkspaceChatComposerOnlineButtonTitle\(\{[\s\S]*isCompact,[\s\S]*isOnlineMode,[\s\S]*\}: \{[\s\S]*isCompact: boolean;[\s\S]*isOnlineMode: boolean;[\s\S]*\}\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*if \(isOnlineMode === true\)[\s\S]*return '联网已关闭';)(?=[\s\S]*function shouldRenderWorkspaceChatComposerExpandedFoundationStatus\(isCompact: boolean\): boolean \{[\s\S]*return isCompact === false;)(?=[\s\S]*function getWorkspaceChatComposerUploadButtonTitle\(isCompact: boolean\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*return '上传文件';)(?=[\s\S]*function getWorkspaceChatComposerOnlineStatusClassName\(isCompact: boolean\): string \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'gap-2 text-xs text-muted-foreground';)(?=[\s\S]*function getWorkspaceChatComposerOnlineIconClassName\(isCompact: boolean\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'text-primary';)(?=[\s\S]*function getWorkspaceChatComposerOnlineLabelClassName\(isCompact: boolean\): string \| undefined \{[\s\S]*if \(isCompact === true\)[\s\S]*return 'text-primary';)(?=[\s\S]*const promptValue = input\.trim\(\);)(?=[\s\S]*const hasPrompt = promptValue\.length > 0;)(?=[\s\S]*const hasPlanSelectionPending = planSelectionPending === true;)(?=[\s\S]*const canSendPrompt = canSendWorkspaceChatComposerPrompt\(\{[\s\S]*hasPlanSelectionPending,[\s\S]*hasPrompt,[\s\S]*\}\);)(?=[\s\S]*const isOnlineMode = isOnline === true;)(?=[\s\S]*const shouldRenderOnlineStatus = isOnlineMode === true;)(?=[\s\S]*const shouldRenderOfflineFoundationStatus = shouldRenderWorkspaceChatComposerOfflineFoundationStatus\(\{[\s\S]*isOfflineMode,[\s\S]*isCompact,[\s\S]*\}\);)(?=[\s\S]*const shouldRenderExpandedFoundationStatus = shouldRenderWorkspaceChatComposerExpandedFoundationStatus\(isCompact\);)(?=[\s\S]*const onlineButtonTitle = getWorkspaceChatComposerOnlineButtonTitle\(\{[\s\S]*isCompact,[\s\S]*isOnlineMode,[\s\S]*\}\);)(?=[\s\S]*const uploadButtonTitle = getWorkspaceChatComposerUploadButtonTitle\(isCompact\);)(?=[\s\S]*const onlineStatusClassName = getWorkspaceChatComposerOnlineStatusClassName\(isCompact\);)(?=[\s\S]*const onlineIconClassName = getWorkspaceChatComposerOnlineIconClassName\(isCompact\);)(?=[\s\S]*const onlineLabelClassName = getWorkspaceChatComposerOnlineLabelClassName\(isCompact\);)(?=[\s\S]*const hasBusyInputSnapshot = hasWorkspaceChatBusyInputSnapshot\(\{[\s\S]*hasInputPlanning,[\s\S]*hasInputGenerating,[\s\S]*hasInputPlanSelectionRequired,)(?=[\s\S]*const hasBusyModeSnapshot = hasWorkspaceChatBusyModeSnapshot\(hasModePlanning, hasModeGenerating\);)(?=[\s\S]*const shouldRenderAttachedFiles = shouldRenderWorkspaceChatAttachedFiles\(attachedFiles\);)(?=[\s\S]*const shouldRenderStopConfirmation = shouldRenderWorkspaceChatStopConfirmation\(isStopConfirming\);)(?=[\s\S]*const composerStateSummary = resolveWorkspaceChatStateSummaryRules\(\[[\s\S]*active: hasInputStopConfirmation[\s\S]*active: hasBusyInputSnapshot[\s\S]*active: hasBusyModeSnapshot)(?=[\s\S]*disabled=\{canSendPrompt === false\})(?=[\s\S]*title=\{uploadButtonTitle\})(?=[\s\S]*className=\{cn\('mt-2 flex items-center', onlineStatusClassName\)\})(?=[\s\S]*className=\{cn\('w-3 h-3', onlineIconClassName\)\})(?=[\s\S]*className=\{onlineLabelClassName\})(?=[\s\S]*\{shouldRenderOnlineStatus === true &&)(?=[\s\S]*\{shouldRenderOfflineFoundationStatus === true &&)(?=[\s\S]*\{shouldRenderAttachedFiles === true &&)(?=[\s\S]*\{shouldRenderStopConfirmation === true &&)/,
  'workspace chat composer should derive send, online and composer summary gates through explicit facts',
);
assert.doesNotMatch(
  chatComponentsSource,
  /if \(!execution\) return undefined|if \(!execution \|\| !statusLabel\) return null|const tone = execution\.pause_reason\s*\?|execution\.current_task &&|execution\.pause_reason &&|execution\.approval_boundary &&|execution\.approval_scope &&|phase\?\.current_phase|phase\?\.current_task|phase\?\.next_action|phase\?\.status|execution\?\.current_task|execution\?\.next_action|execution\?\.pause_reason|execution\?\.awaiting_confirmation|phase\?\.completed_tasks \|\| \[\]|phase\?\.blockers \|\| \[\]|phase\?\.completed_tasks \?\? \[\]|phase\?\.blockers \?\? \[\]|value !== null && value !== undefined && value\.length > 0|if \(!currentPhase && !currentTask && !nextAction|hasCurrentTask === true \|\| hasNextAction === true|hasSummary \|\| hasReasoning|hasCompletedTasks === true \|\| hasBlockers === true|chatScrollSnapshot\.status === 'following_latest'[\s\S]*\|\| chatScrollSnapshot\.status === 'restored_to_latest'|buildWorkflowStatusLabel\(engineeringState\) \?\? '无工作流执行状态'|formatPhaseStatusLabel\(phase\?\.status\) \?\? '无阶段状态'|completedTasks\.slice\(0, compact \? 2 : 3\)\.map|blockers\.slice\(0, compact \? 2 : 3\)\.map|Boolean\(execution\?\.pause_reason\)|Boolean\(execution\?\.awaiting_confirmation\)|disabled=\{planSelectionPending \|\| !input\.trim\(\)\}|hasPlanSelectionPending === false && hasPrompt === true|isOnline &&|!isOnline && !compact|isOfflineMode === true && isCompact === false|const onlineButtonTitle = isCompact === true|title=\{compact \? undefined : '上传文件'\}|compact \? 'gap-1 text-xs text-primary' : 'gap-2 text-xs text-muted-foreground'|isCompact === false && 'text-primary'|className=\{compact \? '' : 'text-primary'\}|compact \? 'p-3' : 'p-4'|className=\{compact \? '' : 'flex gap-2'\}|planSelectionPending \? '请先选择一个技术方案\.\.\.'|compact \? 'min-h-\[84px\] max-h-\[192px\] resize-none text-sm'|compact \? 'w-32' : 'w-40'|compact \? 'discuss-mobile' : 'discuss'|compact \? 'implement-mobile' : 'implement'|!compact && 'transition-colors'|chatMode === 'discuss' \? 'bg-primary text-primary-foreground' : 'hover:bg-muted'|chatMode === 'implement' \? 'bg-primary text-primary-foreground' : 'hover:bg-muted'|selectedModel === model\.id \? 'bg-primary text-primary-foreground' : 'hover:bg-muted'|compact \? 'text-xs' : 'text-sm'|compact \? 'text-\[11px\]' : 'text-xs'|chatScrollSnapshot\.distanceToBottom === null \? 'unknown'|isOnlineMode === true && 'bg-primary\/10 text-primary'|hasStopConfirming === false && 'border-destructive\/30|hasStopConfirming === true && 'animate-pulse'|chatInputSnapshot\.canSend \? 'yes' : 'no'|chatModelRegistrySnapshot\.defaultModel \?\? 'none'|chatAttachmentSnapshot\.lastFileName \?\? 'none'|chatModeSnapshot\.isOnline \? 'on' : 'off'|chatModeSnapshot\.isBusy \? 'yes' : 'no'|models\.length > 0 \? models\.map|models\.length > 0 \?|isBusyGenerating \?|variant=\{hasStopConfirming === true \?|hasStopConfirming === true \? '确认停止'|compact \? '停止' : '停止生成'|disabled=\{hasStopConfirming === true && stopGenerationConfirmationSnapshot\.canConfirm === false\}|className=\{compact \? 'min-w-\[92px\]' : undefined\}|attachedFiles\[pendingAttachmentRemovalIndex\] \|\| null|attachedFiles\.length > 0 &&|compact && 'text-xs'|compact \? 'gap-1\.5' : 'gap-2'|compact \? 'max-w-\[60px\]' : 'max-w-\[80px\]'|compact \? 'ml-0\.5' : 'ml-1'|isStopConfirming &&|hasInputPlanning === true[\s\S]*\|\| hasInputGenerating === true[\s\S]*\|\| hasInputPlanSelectionRequired === true|hasModePlanning === true \|\| hasModeGenerating === true|const composerStateSummary = resolveWorkspaceChatStateSummaryRules\(\[[\s\S]*chatInputSnapshot\.status === 'planning' \|\| chatInputSnapshot\.status === 'generating'|const composerStateSummary = resolveWorkspaceChatStateSummaryRules\(\[[\s\S]*chatModeSnapshot\.status === 'planning' \|\| chatModeSnapshot\.status === 'generating'/,
  'workspace chat components should not regress to truthy execution, phase, composer send, online or summary gates',
);
assert.match(
  chatComponentsSource,
  /data-testid="workspace-chat-scroll-snapshot"[\s\S]*Phase: \{chatScrollSnapshot\.status\}[\s\S]*Source: \{chatScrollSnapshot\.source\}[\s\S]*Messages: \{chatScrollSnapshot\.messageCount\}[\s\S]*Distance: \{chatScrollDistanceLabel\}[\s\S]*恢复建议：\{chatScrollSnapshot\.recovery\}/,
  'workspace chat message state summary should render chat scroll phase, source, distance, count and recovery guidance',
);
assert.doesNotMatch(
  chatMessageListSource,
  /data-testid="workspace-chat-scroll-snapshot"/,
  'workspace chat message list should not render an extra standalone scroll snapshot outside the unified message state summary',
);
assert.match(
  chatMessageListSource,
  /import type \{ ReactNode \} from 'react';[\s\S]*WorkspaceChatExampleClickAction,[\s\S]*WorkspaceChatMessagesProps,[\s\S]*type WorkspaceChatMessageListExampleList = string\[\];[\s\S]*type WorkspaceChatMessageListExampleNodeList = ReactNode\[\];[\s\S]*type WorkspaceChatMessageListMessageNodeList = ReactNode\[\];[\s\S]*type WorkspaceChatMessageListNodeMaterializerInput = \{[\s\S]*messages: WorkspaceChatMessage\[\];[\s\S]*onOpenFile: WorkspaceChatMessageListOpenFileAction;[\s\S]*\};[\s\S]*function hasWorkspaceChatMessageListStreamingKind\([\s\S]*function hasWorkspaceChatMessageListKind\([\s\S]*messages: WorkspaceChatMessage\[\],[\s\S]*kind: WorkspaceChatMessageKind,[\s\S]*\): boolean[\s\S]*for \(const message of messages\)[\s\S]*const hasKind = message\.kind === kind;[\s\S]*if \(hasKind === true\)[\s\S]*return true;[\s\S]*function getWorkspaceChatMessageListExamples\(compact: boolean\): WorkspaceChatMessageListExampleList[\s\S]*function shouldRenderWorkspaceChatMessageListEmptyState\(messages: WorkspaceChatMessage\[\]\): boolean[\s\S]*function getWorkspaceChatMessageListGenerationStageLabel\(generationStage: string\): string[\s\S]*function shouldRenderWorkspaceChatMessageListPlanSelection\(message: WorkspaceChatMessage\): boolean[\s\S]*message\.plans !== undefined[\s\S]*function shouldRenderWorkspaceChatMessageListTimestamp\(message: WorkspaceChatMessage\): boolean[\s\S]*function getWorkspaceChatMessageListTimestampLabel\(message: WorkspaceChatMessage\): string[\s\S]*function shouldRenderWorkspaceChatMessageListPlanningPlaceholder\([\s\S]*isPlanning: boolean;[\s\S]*hasStreamingPlanOptionsMessage: boolean;[\s\S]*\): boolean[\s\S]*if \(isPlanning === false\)[\s\S]*return hasStreamingPlanOptionsMessage === false;[\s\S]*function shouldRenderWorkspaceChatMessageListGeneratingPlaceholder\([\s\S]*isGenerating: boolean;[\s\S]*hasWorkflowMessage: boolean;[\s\S]*\): boolean[\s\S]*if \(isGenerating === false\)[\s\S]*return hasWorkflowMessage === false;[\s\S]*function shouldRenderWorkspaceChatMessageListAutoScrollAction\(isChatAutoScrollEnabled: boolean\): boolean[\s\S]*function getWorkspaceChatMessageListContainerClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListEmptySparklesClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListEmptyTitleClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListEmptyDescriptionClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListExampleListClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListExampleButtonClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListExampleIconClassName\(compact: boolean\): string[\s\S]*function materializeWorkspaceChatMessageListExampleNodes\(\{[\s\S]*examples,[\s\S]*exampleButtonClassName,[\s\S]*exampleIconClassName,[\s\S]*onExampleClick,[\s\S]*\}: \{[\s\S]*examples: WorkspaceChatMessageListExampleList;[\s\S]*onExampleClick: WorkspaceChatExampleClickAction;[\s\S]*\}\): WorkspaceChatMessageListExampleNodeList \{[\s\S]*const nodes: WorkspaceChatMessageListExampleNodeList = \[\];[\s\S]*for \(const example of examples\)[\s\S]*nodes\.push\([\s\S]*<Button[\s\S]*key=\{example\}[\s\S]*variant="outline"[\s\S]*onClick=\{\(\) => onExampleClick\(example\)\}[\s\S]*<Sparkles className=\{exampleIconClassName\} \/>[\s\S]*return nodes;[\s\S]*function getWorkspaceChatMessageListMessageRowClassName\(message: WorkspaceChatMessage\): string[\s\S]*function getWorkspaceChatMessageListMessageBubbleToneClassName\(message: WorkspaceChatMessage\): string[\s\S]*function getWorkspaceChatMessageListMessageBubblePaddingClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListTimestampClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListPlaceholderBubbleClassName\(compact: boolean\): string[\s\S]*function getWorkspaceChatMessageListAutoScrollContainerClassName\(compact: boolean\): string[\s\S]*function materializeWorkspaceChatMessageListMessageNodes\([\s\S]*const hasWorkflowMessage = hasWorkspaceChatMessageListKind\(messages, 'workflow'\);[\s\S]*shouldRenderGeneratingPlaceholder = shouldRenderWorkspaceChatMessageListGeneratingPlaceholder\(\{[\s\S]*hasWorkflowMessage,[\s\S]*\}\);[\s\S]*shouldRenderEmptyState === true[\s\S]*materializeWorkspaceChatMessageListExampleNodes\([\s\S]*materializeWorkspaceChatMessageListMessageNodes\([\s\S]*shouldRenderPlanningPlaceholder === true[\s\S]*shouldRenderGeneratingPlaceholder === true[\s\S]*\{generationStageLabel\}[\s\S]*shouldRenderAutoScrollAction === true/,
  'workspace chat message list should derive placeholders, empty state, plan selection, timestamp and auto-scroll gates through explicit facts',
);
assert.doesNotMatch(
  chatMessageListSource,
  /messages\.some\(\(message\) => message\.kind === '(?:plan-options|workflow)' && message\.streaming\)|messages\.map\(|examples\.map\(|if \(hasKind === true && isStreaming === true\)|messages\.length === 0 &&|isPlanning === true && hasStreamingPlanOptionsMessage === false|isGenerating === true && hasStreamingWorkflowMessage === false|!isChatAutoScrollEnabled &&|message\.kind === 'plan-options' && message\.plans|message\.timestamp &&|generationStage \|\| '生成中\.\.\.'|message\.id \|\| `msg-\$\{idx\}`|compact \? 'space-y-3 p-3'|compact \? 'mb-2 h-8 w-8'|compact \? 'mb-1 text-sm'|compact \? 'mb-3 text-xs'|compact \? 'space-y-1\.5'|compact \? 'h-8 text-xs'|compact \? 'mr-1\.5 h-3 w-3'|message\.role === 'user' \? 'justify-end'|message\.role === 'user' \? 'bg-primary text-primary-foreground'|compact \? 'p-2\.5'|compact \? 'mt-0\.5'|compact \? 'px-3 py-2'/,
  'workspace chat message list should not regress render gates or labels to inline truthy fallbacks',
);
for (const [label, source] of [
  ['page panel props', pagePanelPropsSource],
  ['page content', pageContentSource],
  ['page content options', pageContentOptionsSource],
] as const) {
  assert.match(
    source,
    /chatScrollSnapshot/,
    `workspace ${label} should preserve chat scroll snapshot through the chat panel props chain`,
  );
}
assert.match(
  pageControllersSource,
  /WorkspacePageViewControllersShellState[\s\S]*export type WorkspacePageControllersShellState =[\s\S]*WorkspacePageViewControllersShellState[\s\S]*& WorkspacePageActionControllersShellState;/,
  'workspace page controllers should preserve chat scroll snapshot through the named view controllers shell contract',
);
assert.match(
  pageViewControllersSource,
  /WorkspacePageViewContentShellState/,
  'workspace page view controllers should preserve chat scroll snapshot by reusing the named view content shell state contract',
);
assert.match(
  pagePanelPropsSource,
  /chatInputSnapshot: ChatInputSnapshot[\s\S]*chatInputSnapshot,[\s\S]*chatInputSnapshot,/,
  'workspace chat panel props should preserve chat input snapshot through the composer props chain',
);
assert.match(
  pagePanelPropsSource,
  /chatModelRegistrySnapshot: ChatModelRegistrySnapshot[\s\S]*chatModelRegistrySnapshot,[\s\S]*chatModelRegistrySnapshot,/,
  'workspace chat panel props should preserve chat model registry snapshot through the composer props chain',
);
assert.match(
  pagePanelPropsSource,
  /chatAttachmentSnapshot: ChatAttachmentSnapshot[\s\S]*chatAttachmentSnapshot,[\s\S]*chatAttachmentSnapshot,/,
  'workspace chat panel props should preserve chat attachment snapshot through the composer props chain',
);
assert.match(
  pagePanelPropsSource,
  /chatModeSnapshot: ChatModeSnapshot[\s\S]*chatModeSnapshot,[\s\S]*chatModeSnapshot,/,
  'workspace chat panel props should preserve chat mode snapshot through the composer props chain',
);
assert.match(
  pagePanelPropsSource,
  /(?=[\s\S]*StopGenerationConfirmationSnapshot)(?=[\s\S]*WorkspaceChatCancelStopGenerateAction)(?=[\s\S]*stopGenerationConfirmationSnapshot: StopGenerationConfirmationSnapshot;)(?=[\s\S]*handleCancelStopGenerate: WorkspaceChatCancelStopGenerateAction;)(?=[\s\S]*stopGenerationConfirmationSnapshot,)(?=[\s\S]*handleCancelStopGenerate,)(?=[\s\S]*stopGenerationConfirmationSnapshot,)(?=[\s\S]*handleCancelStopGenerate,)/,
  'workspace chat panel props should preserve stop generation confirmation snapshot and cancel action through the composer props chain',
);
assert.match(
  chatPanelTypesSource,
  /export type WorkspaceChatMessageList = WorkspaceChatMessage\[\];[\s\S]*export type WorkspaceChatAutoScrollStateUpdateAction = \(element: HTMLDivElement\) => void;[\s\S]*export type WorkspaceChatSelectPlanAction = \(plan: Plan\) => void \| Promise<void>;[\s\S]*export type WorkspaceChatOpenFileAction = \(target: string \| WorkspaceEditorNavigationTarget\) => void \| Promise<void>;[\s\S]*export type WorkspaceChatMessagesProps = \{[\s\S]*messages: WorkspaceChatMessageList;[\s\S]*chatScrollSnapshot: ChatScrollSnapshot;[\s\S]*containerRef: WorkspaceChatMessagesContainerRef;[\s\S]*messagesEndRef: WorkspaceChatMessagesEndRef;[\s\S]*updateChatAutoScrollState: WorkspaceChatAutoScrollStateUpdateAction;[\s\S]*onSelectPlan: WorkspaceChatSelectPlanAction;[\s\S]*onOpenFile: WorkspaceChatOpenFileAction;/,
  'workspace chat messages props should be an explicit contract carrying messages, scroll, plan selection and file navigation facts',
);
assert.match(
  chatPanelTypesSource,
  /export type WorkspaceChatStopGenerateAction = \(\) => void;[\s\S]*export type WorkspaceChatCancelStopGenerateAction = \(\) => void;[\s\S]*export type WorkspaceChatComposerProps = \{[\s\S]*chatInputSnapshot: ChatInputSnapshot;[\s\S]*chatAttachmentSnapshot: ChatAttachmentSnapshot;[\s\S]*chatModeSnapshot: ChatModeSnapshot;[\s\S]*chatModelRegistrySnapshot: ChatModelRegistrySnapshot;[\s\S]*stopGenerationConfirmationSnapshot: StopGenerationConfirmationSnapshot;[\s\S]*handleStopGenerate: WorkspaceChatStopGenerateAction;[\s\S]*handleCancelStopGenerate: WorkspaceChatCancelStopGenerateAction;[\s\S]*handleGenerate: \(\) => void;/,
  'workspace chat composer props should be an explicit contract carrying input, attachment, mode, model registry, stop confirmation and generation actions',
);
assert.match(
  chatPanelTypesSource,
  /export type WorkspaceChatPanelProps = \{[\s\S]*messagesProps: WorkspaceChatMessagesProps;[\s\S]*composerProps: WorkspaceChatComposerProps;[\s\S]*engineeringState\?: WorkspaceEngineeringStateSnapshot;/,
  'workspace chat panel props should be an explicit aggregate contract for messages, composer and engineering state',
);
for (const [label, source] of [
  ['chat components', chatComponentsSource],
  ['chat message list', chatMessageListSource],
  ['page panel props', pagePanelPropsSource],
] as const) {
  assert.doesNotMatch(
    source,
    /Parameters<typeof/,
    `workspace ${label} should not infer panel props from component implementation parameters`,
  );
}
assert.match(
  pagePanelPropsSource,
  /export type ChatMessagesProps = WorkspaceChatMessagesProps;[\s\S]*export type ChatComposerProps = WorkspaceChatComposerProps;[\s\S]*export type DesktopIdeProps = WorkspaceDesktopIdeProps;[\s\S]*export type MobileIdeProps = WorkspaceMobileIdeProps;/,
  'workspace page panel props should re-export explicit Chat and IDE panel props contracts instead of component-derived parameter types',
);
assert.match(
  pageComponentTypesSource,
  /export type WorkspacePageHeaderProps = \{[\s\S]*isMobile: boolean;[\s\S]*projectName\?: string \| null;[\s\S]*goBack: \(\) => void;[\s\S]*clearChat: \(\) => void;/,
  'workspace page header props should be an explicit contract for routing and chat clearing actions',
);
assert.match(
  workspaceTypesSource,
  /export type ClearChatConfirmationSnapshotStatus = 'closed' \| 'awaiting_confirmation' \| 'confirming';[\s\S]*export type ClearChatConfirmationSnapshotSource = 'header_action' \| 'dialog_state';[\s\S]*export type ClearChatConfirmationSnapshotAction = 'none' \| 'clear_chat';[\s\S]*export type ClearChatConfirmationSurface = 'desktop' \| 'mobile';[\s\S]*export type ClearChatConfirmationRiskLevel = 'none' \| 'medium';[\s\S]*export type ClearChatConfirmationSnapshot = \{[\s\S]*status: ClearChatConfirmationSnapshotStatus;[\s\S]*source: ClearChatConfirmationSnapshotSource;[\s\S]*action: ClearChatConfirmationSnapshotAction;[\s\S]*surface: ClearChatConfirmationSurface;[\s\S]*projectName: string \| null;[\s\S]*resetsMessages: boolean;[\s\S]*resetsPreviewUrl: boolean;[\s\S]*resetsEditorBuffers: boolean;[\s\S]*resetsOpenFiles: boolean;[\s\S]*canConfirm: boolean;[\s\S]*canCancel: boolean;[\s\S]*riskLevel: ClearChatConfirmationRiskLevel;[\s\S]*recovery: string;/,
  'workspace clear chat confirmation should be represented as a structured snapshot with reset scope and action capability facts',
);
assert.match(
  clearChatConfirmationSnapshotSource,
  /(?=[\s\S]*ClearChatConfirmationSnapshotStatus)(?=[\s\S]*ClearChatConfirmationSnapshotSource)(?=[\s\S]*ClearChatConfirmationSnapshotAction)(?=[\s\S]*ClearChatConfirmationSurface)(?=[\s\S]*ClearChatConfirmationRiskLevel)(?=[\s\S]*function getClearChatConfirmationProjectName\(projectName: string \| null \| undefined\): string \| null)(?=[\s\S]*export function buildClearChatConfirmationSnapshot\([\s\S]*\): ClearChatConfirmationSnapshot \{)(?=[\s\S]*const normalizedProjectName = getClearChatConfirmationProjectName\(projectName\);)(?=[\s\S]*status: ClearChatConfirmationSnapshotStatus = isConfirming)(?=[\s\S]*source: ClearChatConfirmationSnapshotSource = isActionActive)(?=[\s\S]*action: ClearChatConfirmationSnapshotAction = isActionActive)(?=[\s\S]*surface: ClearChatConfirmationSurface = isMobile)(?=[\s\S]*riskLevel: ClearChatConfirmationRiskLevel = isActionActive)(?=[\s\S]*const canConfirm = isOpen === true && isConfirming === false;)(?=[\s\S]*const canCancel = isOpen === true && isConfirming === false;)(?=[\s\S]*'confirming')(?=[\s\S]*isOpen)(?=[\s\S]*'awaiting_confirmation')(?=[\s\S]*'closed')(?=[\s\S]*resetsMessages: true)(?=[\s\S]*resetsPreviewUrl: true)(?=[\s\S]*resetsEditorBuffers: true)(?=[\s\S]*resetsOpenFiles: true)(?=[\s\S]*function getClearChatConfirmationSnapshotLabel)(?=[\s\S]*function getClearChatConfirmationSnapshotBooleanLabel)(?=[\s\S]*function getClearChatConfirmationSnapshotResetLabel)(?=[\s\S]*const projectNameLabel = getClearChatConfirmationSnapshotLabel\(snapshot\.projectName, 'none'\);)(?=[\s\S]*const resetsMessagesLabel = getClearChatConfirmationSnapshotResetLabel\(snapshot\.resetsMessages\);)(?=[\s\S]*const canConfirmLabel = getClearChatConfirmationSnapshotBooleanLabel\(snapshot\.canConfirm\);)(?=[\s\S]*const canCancelLabel = getClearChatConfirmationSnapshotBooleanLabel\(snapshot\.canCancel\);)(?=[\s\S]*data-testid="workspace-clear-chat-confirmation-snapshot")(?=[\s\S]*Phase: \{snapshot\.status\})(?=[\s\S]*Project: \{projectNameLabel\})(?=[\s\S]*Messages: \{resetsMessagesLabel\})(?=[\s\S]*Confirm: \{canConfirmLabel\})/,
  'workspace clear chat confirmation snapshot helper should derive phase, reset scope and expose a stable UI target',
);
assert.doesNotMatch(
  clearChatConfirmationSnapshotSource,
  /ClearChatConfirmationSnapshot\['status'\]|ClearChatConfirmationSnapshot\['source'\]|ClearChatConfirmationSnapshot\['action'\]|ClearChatConfirmationSnapshot\['surface'\]|ClearChatConfirmationSnapshot\['riskLevel'\]|projectName\.trim\(\) \|\| null|&& !isConfirming|snapshot\.projectName \|\| 'none'|snapshot\.projectName \?\? 'none'|snapshot\.(resetsMessages|resetsPreviewUrl|resetsEditorBuffers|resetsOpenFiles) \? 'reset' : 'keep'|snapshot\.(canConfirm|canCancel) \? 'yes' : 'no'/,
  'workspace clear chat confirmation snapshot helper should not infer status/source/action/surface/risk from indexed snapshot access or implicit negation gates',
);
assert.match(
  pageComponentTypesSource,
  /export type WorkspaceDesktopShellProps = \{[\s\S]*chatPanelRef: RefObject<HTMLDivElement \| null>;[\s\S]*chatExpanded: boolean;[\s\S]*onResizeStart: \(event: ReactMouseEvent<HTMLDivElement>\) => void;[\s\S]*chatPanel: ReactNode;[\s\S]*idePanel: ReactNode;/,
  'workspace desktop shell props should be an explicit contract for chat resize and panel composition',
);
assert.match(
  pageComponentTypesSource,
  /import type \{[\s\S]*WorkspaceMobileView,[\s\S]*\} from '\.\/workspace-types';[\s\S]*export type WorkspaceMobileShellProps = \{[\s\S]*mobileView: WorkspaceMobileView;[\s\S]*setMobileView: \(view: WorkspaceMobileView\) => void;[\s\S]*chatPanel: ReactNode;[\s\S]*idePanel: ReactNode;/,
  'workspace mobile shell props should consume the named WorkspaceMobileView contract for mobile panel selection',
);
assert.match(
  pageComponentsSource,
  /import type \{[\s\S]*WorkspaceMobileView,[\s\S]*\} from '\.\/workspace-types';[\s\S]*export function WorkspaceMobileBottomNav\([\s\S]*mobileView: WorkspaceMobileView;[\s\S]*setMobileView: \(view: WorkspaceMobileView\) => void;[\s\S]*setMobileView\('chat'\)[\s\S]*setMobileView\('ide'\)/,
  'workspace mobile bottom navigation should consume the named WorkspaceMobileView contract',
);
[
  /mobileView: 'chat' \| 'ide';/,
  /setMobileView: \(view: 'chat' \| 'ide'\) => void;/,
].forEach((pattern) => {
  assert.doesNotMatch(
    pageComponentTypesSource,
    pattern,
    'workspace mobile shell props should not regress mobile view to an inline union',
  );
  assert.doesNotMatch(
    pageComponentsSource,
    pattern,
    'workspace mobile bottom navigation should not regress mobile view to an inline union',
  );
});
assert.match(
  pageComponentTypesSource,
  /WorkspaceContextMenuNode[\s\S]*export type WorkspacePageOverlaysProps = \{[\s\S]*contextMenu: WorkspaceContextMenu \| null;[\s\S]*pendingCloseFile: string \| null;[\s\S]*pendingRestoreCommit: GitCommit \| null;[\s\S]*handleExplorerContextOperation: \([\s\S]*operation: WorkspaceExplorerContextOperation,[\s\S]*node: WorkspaceContextMenuNode,[\s\S]*input\?: WorkspaceExplorerContextOperationInput/,
  'workspace page overlays props should be an explicit contract for context menu, close-file and commit restore overlays',
);
assert.doesNotMatch(
  pageComponentTypesSource + pageComponentsSource,
  /WorkspaceContextMenu\['node'\]/,
  'workspace page overlays should not infer context menu node contracts through WorkspaceContextMenu indexed access',
);
assert.match(
  pageComponentTypesSource,
  /export type WorkspacePageScaffoldProps = \{[\s\S]*header: WorkspacePageHeaderProps;[\s\S]*bootstrapSnapshot: WorkspaceProjectBootstrapSnapshot;[\s\S]*desktop: WorkspaceDesktopShellProps;[\s\S]*mobile: WorkspaceMobileShellProps;[\s\S]*overlays: WorkspacePageOverlaysProps;/,
  'workspace page scaffold props should explicitly aggregate header, bootstrap, desktop, mobile and overlay contracts',
);
assert.match(
  pageComponentsSource,
  /function shouldRenderWorkspacePageHeaderMobile\(isMobile: boolean\): boolean[\s\S]*const shouldRenderMobile = isMobile === true;[\s\S]*return shouldRenderMobile === true;[\s\S]*function hasWorkspacePageHeaderSettingsAction\(isMobile: boolean\): boolean[\s\S]*const shouldRenderMobile = shouldRenderWorkspacePageHeaderMobile\(isMobile\);[\s\S]*return hasSettingsAction === true;[\s\S]*function shouldRenderWorkspacePageScaffoldMobileShell\(isMobile: boolean\): boolean[\s\S]*const shouldRenderMobileShell = isMobile === true;[\s\S]*return shouldRenderMobileShell === true;[\s\S]*function shouldRenderWorkspacePageScaffoldDesktopShell\(isMobile: boolean\): boolean[\s\S]*const shouldRenderMobileShell = shouldRenderWorkspacePageScaffoldMobileShell\(isMobile\);[\s\S]*return shouldRenderDesktopShell === true;[\s\S]*export function WorkspacePageHeader\([\s\S]*\}: WorkspacePageHeaderProps\)[\s\S]*const shouldRenderMobileHeader = shouldRenderWorkspacePageHeaderMobile\(isMobile\);[\s\S]*if \(shouldRenderMobileHeader === true\)[\s\S]*export function WorkspaceDesktopShell\([\s\S]*\}: WorkspaceDesktopShellProps\)[\s\S]*export function WorkspaceMobileShell\([\s\S]*\}: WorkspaceMobileShellProps\)[\s\S]*export function WorkspacePageScaffold\([\s\S]*\}: WorkspacePageScaffoldProps\)[\s\S]*const shouldRenderDesktopShell = shouldRenderWorkspacePageScaffoldDesktopShell\(header\.isMobile\);[\s\S]*const shouldRenderMobileShell = shouldRenderWorkspacePageScaffoldMobileShell\(header\.isMobile\);[\s\S]*\{shouldRenderDesktopShell === true && <WorkspaceDesktopShell \{\.\.\.desktop\} \/>\}[\s\S]*\{shouldRenderMobileShell === true && <WorkspaceMobileShell \{\.\.\.mobile\} \/>\}/,
  'workspace page components should consume explicit page component props contracts',
);
assert.match(
  pageComponentsSource,
  /(?=[\s\S]*function isWorkspaceMobileBottomNavItemActive\(mobileView: WorkspaceMobileView, itemView: WorkspaceMobileView\): boolean \{[\s\S]*const isItemActive = mobileView === itemView;[\s\S]*return isItemActive === true;)(?=[\s\S]*function getWorkspaceMobileBottomNavItemToneClassName\(\{[\s\S]*mobileView,[\s\S]*itemView,[\s\S]*\}: \{[\s\S]*mobileView: WorkspaceMobileView;[\s\S]*itemView: WorkspaceMobileView;[\s\S]*\}\): string \{[\s\S]*const isItemActive = isWorkspaceMobileBottomNavItemActive\(mobileView, itemView\);[\s\S]*if \(isItemActive === true\)[\s\S]*return 'text-muted-foreground';)(?=[\s\S]*function getWorkspaceDesktopShellChatPanelVisibilityClassName\(chatExpanded: boolean\): string \{[\s\S]*if \(chatExpanded === true\)[\s\S]*return 'w-0 border-0 overflow-hidden';)(?=[\s\S]*function getWorkspaceDesktopShellChatPanelStyle\([\s\S]*chatExpanded: boolean,[\s\S]*chatWidth: number,[\s\S]*\): \{ width: number \} \| undefined \{[\s\S]*if \(chatExpanded === true\)[\s\S]*return undefined;)(?=[\s\S]*function shouldRenderWorkspaceDesktopShellChatPanel\(chatExpanded: boolean\): boolean \{[\s\S]*return chatExpanded === true;)(?=[\s\S]*function shouldRenderWorkspaceDesktopShellResizeHandle\(chatExpanded: boolean\): boolean \{[\s\S]*return chatExpanded === true;)(?=[\s\S]*function shouldRenderWorkspaceDesktopShellExpandButton\(chatExpanded: boolean\): boolean \{[\s\S]*return chatExpanded === false;)(?=[\s\S]*function getWorkspaceDesktopShellResizeHandleActiveClassName\(isResizing: boolean\): string \| undefined \{[\s\S]*if \(isResizing === true\)[\s\S]*return undefined;)(?=[\s\S]*function getWorkspaceMobileShellPanel\(\{[\s\S]*mobileView,[\s\S]*chatPanel,[\s\S]*idePanel,[\s\S]*\}: \{[\s\S]*mobileView: WorkspaceMobileView;[\s\S]*chatPanel: React\.ReactNode;[\s\S]*idePanel: React\.ReactNode;[\s\S]*\}\): React\.ReactNode \{[\s\S]*if \(mobileView === 'chat'\)[\s\S]*return idePanel;)(?=[\s\S]*const chatItemToneClassName = getWorkspaceMobileBottomNavItemToneClassName\(\{[\s\S]*mobileView,[\s\S]*itemView: 'chat',[\s\S]*\}\);)(?=[\s\S]*const ideItemToneClassName = getWorkspaceMobileBottomNavItemToneClassName\(\{[\s\S]*mobileView,[\s\S]*itemView: 'ide',[\s\S]*\}\);)(?=[\s\S]*className=\{cn\('flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors', chatItemToneClassName\)\})(?=[\s\S]*className=\{cn\('flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors', ideItemToneClassName\)\})(?=[\s\S]*const chatPanelVisibilityClassName = getWorkspaceDesktopShellChatPanelVisibilityClassName\(chatExpanded\);)(?=[\s\S]*const chatPanelStyle = getWorkspaceDesktopShellChatPanelStyle\(chatExpanded, chatWidth\);)(?=[\s\S]*const shouldRenderChatPanel = shouldRenderWorkspaceDesktopShellChatPanel\(chatExpanded\);)(?=[\s\S]*const shouldRenderResizeHandle = shouldRenderWorkspaceDesktopShellResizeHandle\(chatExpanded\);)(?=[\s\S]*const shouldRenderExpandButton = shouldRenderWorkspaceDesktopShellExpandButton\(chatExpanded\);)(?=[\s\S]*const resizeHandleActiveClassName = getWorkspaceDesktopShellResizeHandleActiveClassName\(isResizing\);)(?=[\s\S]*chatPanelVisibilityClassName)(?=[\s\S]*style=\{chatPanelStyle\})(?=[\s\S]*\{shouldRenderChatPanel === true && chatPanel\})(?=[\s\S]*\{shouldRenderResizeHandle === true &&)(?=[\s\S]*resizeHandleActiveClassName)(?=[\s\S]*\{shouldRenderExpandButton === true &&)(?=[\s\S]*const mobileShellPanel = getWorkspaceMobileShellPanel\(\{[\s\S]*mobileView,[\s\S]*chatPanel,[\s\S]*idePanel,[\s\S]*\}\);)(?=[\s\S]*\{mobileShellPanel\})/,
  'workspace page shell display should derive mobile nav tone, desktop chat panel visibility and mobile shell panel through named readers',
);
assert.doesNotMatch(
  pageComponentsSource,
  /hasSettingsAction: !isMobile|if \(isMobile\)|header\.isMobile &&|!header\.isMobile &&|mobileView === 'chat' \? 'text-primary' : 'text-muted-foreground'|mobileView === 'ide' \? 'text-primary' : 'text-muted-foreground'|chatExpanded \? 'border-r' : 'w-0 border-0 overflow-hidden'|style=\{chatExpanded \? \{ width: chatWidth \} : undefined\}|chatExpanded \? chatPanel : null|\{chatExpanded &&|\{!chatExpanded &&|isResizing && 'bg-primary'|mobileView === 'chat' \? chatPanel : idePanel/,
  'workspace page header and scaffold should not regress mobile render, desktop render or settings action gates to direct isMobile checks',
);
assert.match(
  pageComponentsSource,
  /import \{[\s\S]*buildClearChatConfirmationSnapshot,[\s\S]*ClearChatConfirmationSnapshotStrip,[\s\S]*\} from '\.\/workspace-clear-chat-confirmation-snapshot';[\s\S]*const \[isClearChatConfirmationOpen, setIsClearChatConfirmationOpen\] = useState\(false\);[\s\S]*const clearChatConfirmationSnapshot = buildClearChatConfirmationSnapshot\(\{[\s\S]*isOpen: isClearChatConfirmationOpen,[\s\S]*isConfirming: isClearChatConfirming,[\s\S]*isMobile,[\s\S]*projectName,[\s\S]*const requestClearChat = \(\) => \{[\s\S]*setIsClearChatConfirmationOpen\(true\);[\s\S]*const confirmClearChat = \(\) => \{[\s\S]*clearChatConfirmationSnapshot\.canConfirm !== true[\s\S]*clearChat\(\);[\s\S]*<ClearChatConfirmationSnapshotStrip snapshot=\{clearChatConfirmationSnapshot\} \/>[\s\S]*disabled=\{clearChatConfirmationSnapshot\.canConfirm === false\}[\s\S]*event\.preventDefault\(\)[\s\S]*clearChatConfirmationSnapshot\.canConfirm === true[\s\S]*onClick=\{requestClearChat\}/,
  'workspace page header should open a structured clear chat confirmation before invoking clearChat',
);
assert.doesNotMatch(
  pageComponentsSource,
  /onClick=\{clearChat\} title="清空对话"/,
  'workspace page header clear chat buttons must not directly invoke clearChat',
);

console.log('[YES] Workspace message restore, chat scroll, chat input, model registry, attachment, mode, plan selection, plan thought process, message render, workflow section, chat message, chat thought process, commit summary, engineering state panel, validation gate blocked alert, foundation panel, Git panel, Preview panel, Explorer panel and Editor panel validation passed.');
