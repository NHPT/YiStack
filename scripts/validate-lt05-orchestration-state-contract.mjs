#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertIncludes(content, expected, message) {
  assert.ok(content.includes(expected), message);
}

const commandsSource = readText('backend/internal/orchestration/workspace_orchestration_commands.go');
const engineeringStateSource = readText('backend/internal/orchestration/workspace_engineering_state.go');
const frontendWorkflowContractSource = readText('src/lib/workspace/workflow-contract.ts');
const planFlowSource = readText('src/app/workspace/workspace-plan-flow-state.ts');
const planImplementationSource = readText('src/app/workspace/workspace-plan-implementation.ts');
const planImplementationActionSource = readText('src/app/workspace/use-workspace-plan-implementation-action.ts');
const workspaceChatComponentsSource = readText('src/app/workspace/workspace-chat-components.tsx');
const chatMessageContentSource = readText('src/components/workspace/chat-message-content.tsx');
const testsSource = readText('backend/internal/orchestration/workspace_orchestrator_test.go');
const validationLayerSource = readText('docs/engineering/VALIDATION_LAYER.md');

assertIncludes(
  commandsSource,
  'type WorkflowStageDefinition struct',
  'LT-05 should define a named workflow stage definition contract',
);
for (const field of ['Stage', 'DefaultMode', 'AutoProgressEnabled', 'ApprovalBoundary']) {
  assertIncludes(
    commandsSource,
    field,
    `WorkflowStageDefinition should include ${field}`,
  );
}
for (const stage of [
  'WorkflowStageBootstrap',
  'WorkflowStageBootstrapReview',
  'WorkflowStageBootstrapConfirmed',
  'WorkflowStagePlanAnalysis',
  'WorkflowStagePlanSelection',
  'WorkflowStagePlanApproved',
  'WorkflowStageImplement',
]) {
  assertIncludes(
    commandsSource,
    `{Stage: ${stage},`,
    `WorkflowStageDefinitions should include ${stage}`,
  );
}
assertIncludes(
  commandsSource,
  'func workflowStageDefinitionForStage(stage string) (WorkflowStageDefinition, bool)',
  'workflow stage definition lookup should be a named helper',
);
assertIncludes(
  commandsSource,
  'definition, ok := workflowStageDefinitionForStage(stage)',
  'default workflow mode resolution should consume workflow stage definitions',
);
assertIncludes(
  engineeringStateSource,
  'definition, ok := workflowStageDefinitionForStage(workflowStage)',
  'BuildEngineeringState should consume workflow stage definitions',
);
assertIncludes(
  engineeringStateSource,
  'execution.AutoProgressEnabled = definition.AutoProgressEnabled',
  'BuildEngineeringState should consume auto-progress policy from stage definition',
);
assertIncludes(
  engineeringStateSource,
  'execution.ApprovalBoundary = definition.ApprovalBoundary',
  'BuildEngineeringState should consume approval boundary from stage definition',
);
assertIncludes(
  frontendWorkflowContractSource,
  'export type WorkspaceWorkflowStageDefinition = {',
  'Frontend workflow contract should expose a named workflow stage definition type',
);
assertIncludes(
  frontendWorkflowContractSource,
  'export const WORKSPACE_WORKFLOW_STAGE_DEFINITIONS: WorkspaceWorkflowStageDefinitionList',
  'Frontend workflow contract should expose workflow stage definitions',
);
for (const stage of [
  "stage: 'bootstrap'",
  "stage: 'bootstrap_review'",
  "stage: 'bootstrap_confirmed'",
  "stage: 'plan-analysis'",
  "stage: 'plan-selection'",
  "stage: 'plan-approved'",
  "stage: 'implement'",
]) {
  assertIncludes(
    frontendWorkflowContractSource,
    stage,
    `Frontend workflow stage definitions should include ${stage}`,
  );
}
assertIncludes(
  frontendWorkflowContractSource,
  "approvalBoundary: 'implementation'",
  'Frontend workflow stage definitions should expose implementation approval boundary',
);
for (const helperName of [
  'getWorkspaceWorkflowStageDefinition',
  'getWorkspaceWorkflowStageDefaultMode',
  'getWorkspaceWorkflowStageAutoProgressEnabled',
  'getWorkspaceWorkflowStageApprovalBoundary',
  'getWorkspaceWorkflowStageDefaultModeOrFallback',
  'getWorkspaceWorkflowStageAutoProgressEnabledOrFallback',
  'getWorkspaceWorkflowStageApprovalBoundaryOrFallback',
]) {
  assertIncludes(
    frontendWorkflowContractSource,
    `export function ${helperName}`,
    `Frontend workflow contract should expose ${helperName}`,
  );
}
assertIncludes(
  frontendWorkflowContractSource,
  'const definition = getWorkspaceWorkflowStageDefinition(stage);',
  'Workflow stage display label should consume workflow stage definitions first',
);
assertIncludes(
  planFlowSource,
  "const WORKSPACE_PLAN_SELECTION_STAGE: WorkspaceBackendWorkflowStage = 'plan-selection';",
  'Plan selection engineering state should name the plan-selection stage contract',
);
assertIncludes(
  planFlowSource,
  "const WORKSPACE_PLAN_APPROVED_STAGE: WorkspaceBackendWorkflowStage = 'plan-approved';",
  'Plan selection engineering state should transition selected plans to plan-approved',
);
assertIncludes(
  planFlowSource,
  'getWorkspaceWorkflowStageDefaultModeOrFallback(workflowStage,',
  'Plan selection engineering state should consume stage definition default mode reader',
);
assertIncludes(
  planFlowSource,
  'getWorkspaceWorkflowStageAutoProgressEnabledOrFallback(workflowStage,',
  'Plan selection engineering state should consume stage definition auto-progress reader',
);
assertIncludes(
  planFlowSource,
  'getWorkspaceWorkflowStageApprovalBoundaryOrFallback(workflowStage,',
  'Plan selection engineering state should consume stage definition approval-boundary reader',
);
assertIncludes(
  planImplementationSource,
  'getWorkspaceWorkflowStageDefaultModeOrFallback(WORKSPACE_PLAN_APPROVED_STAGE',
  'Plan approved implementation kickoff should consume stage definition default mode reader',
);
assertIncludes(
  planImplementationSource,
  'getWorkspaceWorkflowStageAutoProgressEnabledOrFallback(',
  'Plan approved implementation kickoff should consume stage definition auto-progress reader',
);
assertIncludes(
  planImplementationSource,
  'getWorkspaceWorkflowStageApprovalBoundaryOrFallback(',
  'Plan approved implementation kickoff should consume stage definition approval-boundary reader',
);
assertIncludes(
  planImplementationActionSource,
  'getWorkspaceWorkflowStageDefaultModeOrFallback(',
  'Plan implementation retry action should consume stage definition default mode reader',
);
assertIncludes(
  planImplementationActionSource,
  'WORKSPACE_PLAN_IMPLEMENTATION_RETRY_STAGE',
  'Plan implementation retry action should use the named plan-approved stage',
);
assertIncludes(
  workspaceChatComponentsSource,
  'getWorkspaceChatEngineeringAutoProgressEnabled',
  'Workspace chat engineering strip should derive auto-progress through a named reader',
);
assertIncludes(
  workspaceChatComponentsSource,
  'getWorkspaceWorkflowStageAutoProgressEnabled(workflow.stage)',
  'Workspace chat engineering strip should fall back to stage definition auto-progress',
);
assertIncludes(
  workspaceChatComponentsSource,
  'getWorkspaceChatEngineeringApprovalBoundary',
  'Workspace chat engineering strip should derive approval boundary through a named reader',
);
assertIncludes(
  workspaceChatComponentsSource,
  'getWorkspaceWorkflowStageApprovalBoundary(workflow.stage)',
  'Workspace chat engineering strip should fall back to stage definition approval boundary',
);
assertIncludes(
  chatMessageContentSource,
  'getEngineeringStatePanelExecutionAutoProgressEnabled',
  'Engineering State panel should derive auto-progress through a named reader',
);
assertIncludes(
  chatMessageContentSource,
  'getWorkspaceWorkflowStageAutoProgressEnabled(workflow.stage)',
  'Engineering State panel should fall back to stage definition auto-progress',
);
assertIncludes(
  chatMessageContentSource,
  'getEngineeringStatePanelExecutionApprovalBoundary',
  'Engineering State panel should derive approval boundary through a named reader',
);
assertIncludes(
  chatMessageContentSource,
  'getWorkspaceWorkflowStageApprovalBoundary(workflow.stage)',
  'Engineering State panel should fall back to stage definition approval boundary',
);
assertIncludes(
  testsSource,
  'func TestWorkflowStageDefinitionsCoverCoreStages',
  'backend tests should cover workflow stage definition completeness',
);
assertIncludes(
  validationLayerSource,
  'LT-05 orchestration state contract 校验',
  'Validation Layer should document the LT-05 orchestration state contract gate',
);
console.log('[YES] LT-05 orchestration state contract validation passed.');
