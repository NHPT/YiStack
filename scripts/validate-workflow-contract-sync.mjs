#!/usr/bin/env node

// YES workflow contract guard.
// Backend orchestration constants are the source of truth for backend-backed workflow semantics.
// Frontend-local workflow states must stay explicit and traceable instead of becoming hidden UI-only branches.

import fs from 'node:fs';
import path from 'node:path';

// File targets.
const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const backendWorkflowPath = path.join(rootDir, 'backend/internal/orchestration/workspace_orchestration_commands.go');
const backendEngineeringStatePath = path.join(rootDir, 'backend/internal/orchestration/workspace_engineering_state.go');
const backendEngineeringStateRecorderPath = path.join(rootDir, 'backend/internal/orchestration/workspace_engineering_state_recorder.go');
const backendOrchestrationEventsPath = path.join(rootDir, 'backend/internal/orchestration/workspace_orchestration_events.go');
const backendCapabilityStagePath = path.join(rootDir, 'backend/internal/orchestration/workspace_capability_stage.go');
const backendPlanOrchestratorPath = path.join(rootDir, 'backend/internal/orchestration/workspace_plan_orchestrator.go');
const backendGenerationStagePath = path.join(rootDir, 'backend/internal/orchestration/workspace_generation_stage.go');
const backendValidationGatePath = path.join(rootDir, 'backend/internal/orchestration/workspace_validation_gate.go');
const backendFoundationGatePath = path.join(rootDir, 'backend/internal/orchestration/workspace_foundation_gate.go');
const backendBootstrapOrchestratorPath = path.join(rootDir, 'backend/internal/orchestration/workspace_bootstrap_orchestrator.go');
const backendOrchestratorTestPath = path.join(rootDir, 'backend/internal/orchestration/workspace_orchestrator_test.go');
const backendGeneratorContentStagePath = path.join(rootDir, 'backend/internal/service/generator_content_stage.go');
const backendGeneratorContentStageTestPath = path.join(rootDir, 'backend/internal/service/generator_content_stage_test.go');
const backendGeneratorStreamPath = path.join(rootDir, 'backend/internal/service/generator_stream.go');
const backendGeneratorServicePath = path.join(rootDir, 'backend/internal/service/generator_service.go');
const backendSSEResponsePath = path.join(rootDir, 'backend/internal/handler/sse_response.go');
const backendStreamResponseWriterPath = path.join(rootDir, 'backend/internal/handler/stream_response_writer.go');
const backendServiceWorkflowPath = path.join(rootDir, 'backend/internal/service/generator_workflow_context.go');
const frontendContractPath = path.join(rootDir, 'src/lib/workspace/workflow-contract.ts');
const frontendWorkspaceDir = path.join(rootDir, 'src/app/workspace');
const frontendOrchestrationSupportPath = path.join(rootDir, 'src/app/workspace/workspace-orchestration-support.ts');
const frontendPlanImplementationPath = path.join(rootDir, 'src/app/workspace/workspace-plan-implementation.ts');
const chatMessageContentPath = path.join(rootDir, 'src/components/workspace/chat-message-content.tsx');
const workspaceChatComponentsPath = path.join(rootDir, 'src/app/workspace/workspace-chat-components.tsx');
const orchestrationSharedPath = path.join(rootDir, 'src/app/workspace/workspace-orchestration-shared.ts');
const planStepEffectsPath = path.join(rootDir, 'src/app/workspace/workspace-plan-step-effects.ts');
const implementationStepEffectsPath = path.join(rootDir, 'src/app/workspace/workspace-implementation-step-effects.ts');
const requiredFrontendPhaseFields = [
  'current_phase',
  'current_task',
  'completed_tasks',
  'blockers',
  'next_action',
  'status',
];

// Generic filesystem and collection helpers.
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  });
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

// Source extractors.
function extractGoStringConstants(source, prefix) {
  const pattern = new RegExp(`\\b${prefix}[A-Za-z0-9_]*\\s*=\\s*"([^"]+)"`, 'g');
  return uniqueSorted([...source.matchAll(pattern)].map((match) => match[1]));
}

function extractGoStringConstantMap(source, prefix) {
  const pattern = new RegExp(`\\b(${prefix}[A-Za-z0-9_]*)\\s*=\\s*"([^"]+)"`, 'g');
  return Object.fromEntries([...source.matchAll(pattern)].map((match) => [match[1], match[2]]));
}

function extractTsStringArray(source, constantName) {
  const pattern = new RegExp(`export\\s+const\\s+${constantName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as\\s+const`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Missing TS contract array: ${constantName}`);
  }
  return uniqueSorted([...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]));
}

function extractTsStringRecord(source, constantName) {
  const pattern = new RegExp(`export\\s+const\\s+${constantName}[^=]*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Missing TS contract record: ${constantName}`);
  }

  return Object.fromEntries([...match[1].matchAll(/(?:^|\n)\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*:\s*'([^']+)'/g)]
    .map((item) => [item[1] || item[2], item[3]]));
}

function extractWorkflowStageLabelKeys(source) {
  const match = source.match(/WORKSPACE_WORKFLOW_STAGE_LABELS[\s\S]*?=\s*\{([\s\S]*?)\};/);
  if (!match) {
    throw new Error('Missing WORKSPACE_WORKFLOW_STAGE_LABELS mapping.');
  }

  return uniqueSorted([...match[1].matchAll(/(?:^|\n)\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*:/g)]
    .map((item) => item[1] || item[2]));
}

// Contract assertions.
function assertSameSet(label, left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const missing = right.filter((item) => !leftSet.has(item));
  const extra = left.filter((item) => !rightSet.has(item));

  if (missing.length > 0 || extra.length > 0) {
    const parts = [
      `[YES] Workflow contract drift detected: ${label}`,
      missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
      extra.length > 0 ? `extra: ${extra.join(', ')}` : undefined,
    ].filter(Boolean);
    throw new Error(parts.join('\n'));
  }
}

function assertSameRecord(label, left, right) {
  const leftKeys = uniqueSorted(Object.keys(left));
  const rightKeys = uniqueSorted(Object.keys(right));
  assertSameSet(`${label} keys`, leftKeys, rightKeys);

  const mismatches = rightKeys
    .filter((key) => left[key] !== right[key])
    .map((key) => `${key}: expected ${right[key]}, got ${left[key] ?? '<missing>'}`);

  if (mismatches.length > 0) {
    throw new Error([
      `[YES] Workflow contract drift detected: ${label}`,
      ...mismatches,
    ].join('\n'));
  }
}

function extractGoFunctionBody(source, functionName) {
  const signaturePattern = new RegExp(`func\\s+(?:\\([^)]*\\)\\s*)?${functionName}\\s*\\(`);
  const signature = signaturePattern.exec(source);
  if (!signature) {
    throw new Error(`Missing Go function: ${functionName}`);
  }

  const bodyStart = source.indexOf('{', signature.index);
  if (bodyStart < 0) {
    throw new Error(`Missing Go function body: ${functionName}`);
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  throw new Error(`Unclosed Go function body: ${functionName}`);
}

function extractGoStageModeMap(source, functionName, stageConstants, modeConstants, allStages) {
  const body = extractGoFunctionBody(source, functionName);
  const mapped = {};
  const casePattern = /case\s+([^:]+):\s*return\s+([A-Za-z0-9_]+)/g;
  for (const match of body.matchAll(casePattern)) {
    const mode = modeConstants[match[2]];
    if (!mode) continue;

    for (const rawStage of match[1].split(',')) {
      const stage = stageConstants[rawStage.trim()];
      if (stage) {
        mapped[stage] = mode;
      }
    }
  }

  const defaultMatch = body.match(/default:\s*return\s+([A-Za-z0-9_]+)/);
  const defaultMode = defaultMatch ? modeConstants[defaultMatch[1]] : undefined;
  if (defaultMode) {
    for (const stage of allStages) {
      if (!mapped[stage]) {
        mapped[stage] = defaultMode;
      }
    }
  }

  return mapped;
}

function extractGoWorkflowStageDefinitionModeMap(source, stageConstants, modeConstants) {
  const body = extractGoFunctionBody(source, 'WorkflowStageDefinitions');
  const mapped = {};
  const definitionPattern = /\{Stage:\s+([A-Za-z0-9_]+),\s+DefaultMode:\s+([A-Za-z0-9_]+)/g;
  for (const match of body.matchAll(definitionPattern)) {
    const stage = stageConstants[match[1]];
    const mode = modeConstants[match[2]];
    if (stage && mode) {
      mapped[stage] = mode;
    }
  }
  return mapped;
}

function extractGoStageLabelMap(source, functionName, stageConstants) {
  const body = extractGoFunctionBody(source, functionName);
  const mapped = {};
  const casePattern = /case\s+([^:]+):\s*return\s+"([^"]+)"/g;
  for (const match of body.matchAll(casePattern)) {
    for (const rawStage of match[1].split(',')) {
      const stage = stageConstants[rawStage.trim()];
      if (stage) {
        mapped[stage] = match[2];
      }
    }
  }
  return mapped;
}

function pickRecord(record, keys) {
  return Object.fromEntries(keys.map((key) => [key, record[key]]));
}

function assertLocalStageSources(rootDir, localStages, sourceMap) {
  assertSameSet('frontend-local workflow stage source keys must match local stages', Object.keys(sourceMap), localStages);

  const failures = [];
  for (const stage of localStages) {
    const relativePath = sourceMap[stage];
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${stage}: source file missing (${relativePath})`);
      continue;
    }

    const source = readText(absolutePath);
    if (!source.includes(`stage: '${stage}'`) && !source.includes(`stage: "${stage}"`)) {
      failures.push(`${stage}: source file does not emit stage literal (${relativePath})`);
    }
  }

  if (failures.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: frontend-local workflow stage sources',
      ...failures,
    ].join('\n'));
  }
}

function assertWorkflowContractDisplayReaders(source) {
  if (!/export type WorkspaceExecutionPauseReasonList = readonly WorkspaceExecutionPauseReason\[\];[\s\S]*export type WorkspaceApprovalBoundaryList = readonly WorkspaceApprovalBoundary\[\];/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: pause reason and approval boundary guards must use named list contracts.');
  }

  if (!/function hasWorkspaceWorkflowContractTextValue\(value: string \| undefined\): value is string \{[\s\S]*if \(value === undefined\) \{[\s\S]*return false;[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: formatter text presence must use hasWorkspaceWorkflowContractTextValue().');
  }

  if (!/export function getWorkspaceWorkflowStageDefinition\([\s\S]*stage: string,[\s\S]*\): WorkspaceWorkflowStageDefinition \| undefined \{[\s\S]*for \(const definition of WORKSPACE_WORKFLOW_STAGE_DEFINITIONS\)[\s\S]*return definition;[\s\S]*return undefined;[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: workflow stage definition lookup must use the named stage definition reader.');
  }

  if (!/function getWorkspaceWorkflowStageDisplayLabel\(stage: string\): string \{[\s\S]*const definition = getWorkspaceWorkflowStageDefinition\(stage\);[\s\S]*if \(definition !== undefined\) \{[\s\S]*return WORKSPACE_WORKFLOW_STAGE_LABELS\[definition\.stage\];[\s\S]*const hasKnownWorkflowStage = isWorkspaceWorkflowStage\(stage\);[\s\S]*if \(hasKnownWorkflowStage === true\) \{[\s\S]*return WORKSPACE_WORKFLOW_STAGE_LABELS\[stage\];[\s\S]*return stage;[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: workflow stage label fallback must use the named stage definition reader before label fallback.');
  }

  if (!/function getWorkspaceExecutionPauseReasonDisplayLabel\(reason: string\): string \{[\s\S]*const hasKnownReason = isWorkspaceExecutionPauseReason\(reason\);[\s\S]*if \(hasKnownReason === true\) \{[\s\S]*return WORKSPACE_EXECUTION_PAUSE_REASON_LABELS\[reason\];[\s\S]*return reason;[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: pause reason label fallback must use the named pause reason display reader.');
  }

  if (!/function getWorkspaceApprovalBoundaryDisplayLabel\(boundary: string\): string \{[\s\S]*const hasKnownBoundary = isWorkspaceApprovalBoundary\(boundary\);[\s\S]*if \(hasKnownBoundary === true\) \{[\s\S]*return WORKSPACE_APPROVAL_BOUNDARY_LABELS\[boundary\];[\s\S]*return boundary;[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: approval boundary label fallback must use the named boundary display reader.');
  }

  if (!/export function formatWorkspaceWorkflowStage\(stage\?: string\): string \| undefined \{[\s\S]*const hasStage = hasWorkspaceWorkflowContractTextValue\(stage\);[\s\S]*if \(hasStage === false\) \{[\s\S]*return undefined;[\s\S]*return getWorkspaceWorkflowStageDisplayLabel\(stage\);[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: formatWorkspaceWorkflowStage must use explicit text fact and display reader.');
  }

  if (!/export function formatWorkspaceExecutionPauseReason\(reason\?: string\): string \| undefined \{[\s\S]*const hasReason = hasWorkspaceWorkflowContractTextValue\(reason\);[\s\S]*if \(hasReason === false\) \{[\s\S]*return undefined;[\s\S]*return getWorkspaceExecutionPauseReasonDisplayLabel\(reason\);[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: formatWorkspaceExecutionPauseReason must use explicit text fact and display reader.');
  }

  if (!/export function formatWorkspaceApprovalBoundary\(boundary\?: string\): string \| undefined \{[\s\S]*const hasBoundary = hasWorkspaceWorkflowContractTextValue\(boundary\);[\s\S]*if \(hasBoundary === false\) \{[\s\S]*return undefined;[\s\S]*return getWorkspaceApprovalBoundaryDisplayLabel\(boundary\);[\s\S]*\}/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: formatWorkspaceApprovalBoundary must use explicit text fact and display reader.');
  }

  if (/if \(!(?:stage|reason|boundary)\) return undefined|WORKSPACE_WORKFLOW_STAGE_LABELS\[stage as WorkspaceWorkflowStage\]\s*\|\|\s*stage|WORKSPACE_EXECUTION_PAUSE_REASON_LABELS\[reason as WorkspaceExecutionPauseReason\]\s*\|\|\s*reason|WORKSPACE_APPROVAL_BOUNDARY_LABELS\[boundary as WorkspaceApprovalBoundary\]\s*\|\|\s*boundary/.test(source)) {
    throw new Error('[YES] Workflow contract display reader drift detected: formatters must not regress to truthy text gates or inline OR label fallback.');
  }
}

function assertFrontendPhaseSnapshots(frontendDir, stageLabelMap) {
  const failures = [];
  const files = walkFiles(frontendDir, (filePath) => /\.(ts|tsx)$/.test(filePath));
  const knownPhaseLabels = new Set(Object.values(stageLabelMap));

  for (const filePath of files) {
    const source = readText(filePath);
    for (const match of source.matchAll(/phase:\s*\{([\s\S]*?)\n\s*\}/g)) {
      const phaseBody = match[1];
      if (!/current_phase:\s*['"]([^'"]+)['"]/.test(phaseBody)) continue;

      const missingFields = requiredFrontendPhaseFields.filter((field) => (
        !new RegExp(`\\b${field}\\s*:`).test(phaseBody)
      ));
      if (missingFields.length > 0) {
        failures.push(`${path.relative(rootDir, filePath)}: phase snapshot missing fields ${missingFields.join(', ')}`);
      }
    }

    for (const match of source.matchAll(/current_phase:\s*['"]([^'"]+)['"]/g)) {
      const currentPhase = match[1];
      if (!knownPhaseLabels.has(currentPhase)) {
        failures.push(`${path.relative(rootDir, filePath)}: current_phase ${currentPhase} is not a registered workflow stage label`);
      }
    }

    const statePattern = /workflow:\s*\{[\s\S]*?stage:\s*['"]([^'"]+)['"][\s\S]*?phase:\s*\{[\s\S]*?current_phase:\s*['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(statePattern)) {
      const [, stage, currentPhase] = match;
      const expected = stageLabelMap[stage];
      if (expected && currentPhase !== expected) {
        failures.push(`${path.relative(rootDir, filePath)}: ${stage} current_phase expected ${expected}, got ${currentPhase}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: frontend phase labels',
      ...failures,
    ].join('\n'));
  }
}

function assertEngineeringStatePanelPhaseSummary(source) {
  const requiredSnippets = [
    'EngineeringStatePanelSnapshot',
    'buildEngineeringStatePanelSnapshot',
    'data-testid="workspace-engineering-state-panel-snapshot"',
    'Phase: {snapshot.status}',
    'Source: {snapshot.source}',
    'Rows: {snapshot.rowCount}',
    'Failures: {snapshot.failureItemCount}',
    'Blockers: {snapshot.blockerCount}',
    'Actions: {snapshot.recoveryActionCount}',
    '<EngineeringStatePanelSnapshotStrip snapshot={engineeringStatePanelSnapshot} />',
    'label: "Phase"',
    'state.phase?.current_phase',
    'state.phase?.current_task',
    'function getEngineeringStatePanelPhaseState(',
    'function getEngineeringStatePanelPhaseCompletedTasks(phase: WorkspacePhaseState | undefined): string[]',
    'function getEngineeringStatePanelPhaseBlockers(phase: WorkspacePhaseState | undefined): string[]',
    'const phase = getEngineeringStatePanelPhaseState(state);',
    'const hasPhase = phase !== undefined;',
    'const phaseCompletedTasks = getEngineeringStatePanelPhaseCompletedTasks(phase);',
    'const hasPhaseCompletedTasks = phaseCompletedTasks.length > 0;',
    'const phaseBlockers = getEngineeringStatePanelPhaseBlockers(phase);',
    'const hasPhaseBlockers = phaseBlockers.length > 0;',
    'const phaseNextAction = getEngineeringStatePanelTextValue(phase?.next_action);',
    'const hasPhaseNextAction = hasEngineeringStatePanelTextValue(phaseNextAction);',
    '阶段任务',
  ];
  const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
  if (missing.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: Engineering State phase summary',
      `missing: ${missing.join(', ')}`,
    ].join('\n'));
  }
}

function assertWorkspacePhaseSnapshotStrip(source) {
  const requiredSnippets = [
    'function formatPhaseStatusLabel',
    'function getPhaseSnapshotTone',
    'function getWorkspaceChatEngineeringPhaseStatus(',
    'function getWorkspaceChatEngineeringPhaseStatusLabel(phase: WorkspacePhaseState | undefined): string',
    'function getWorkspaceChatEngineeringPhaseSummaryStatusLabel(phase: WorkspacePhaseState | undefined): string',
    'function shouldRenderWorkspaceChatPhaseSnapshot({',
    'function shouldRenderWorkspaceChatPhaseLists(',
    'function hasWorkspaceChatPhaseStatus(',
    'function hasWorkspaceChatScrollFollowingLatest(chatScrollSnapshot: ChatScrollSnapshot): boolean',
    "status === 'failed'",
    'if (hasBlockers === true)',
    "status === 'passed'",
    "status === 'running'",
    "status === 'pending'",
    'const phaseStatus = getWorkspaceChatEngineeringPhaseStatus(phase);',
    'const phaseStatusLabel = getWorkspaceChatEngineeringPhaseStatusLabel(phase);',
    'const hasPhaseStatusLabel = hasWorkspaceChatEngineeringTextValue(phaseStatusLabel);',
    'const tone = getPhaseSnapshotTone(phaseStatus, hasBlockers);',
    'const shouldRenderPhaseSnapshot = shouldRenderWorkspaceChatPhaseSnapshot({',
    'const shouldRenderPhaseLists = shouldRenderWorkspaceChatPhaseLists(hasCompletedTasks, hasBlockers);',
    'const phaseStatusLabel = getWorkspaceChatEngineeringPhaseSummaryStatusLabel(phase);',
    "const hasPhaseFailed = hasWorkspaceChatPhaseStatus(phase, 'failed');",
    "const hasPhasePending = hasWorkspaceChatPhaseStatus(phase, 'pending');",
    "const hasPhasePassed = hasWorkspaceChatPhaseStatus(phase, 'passed');",
    'const hasChatScrollFollowingLatest = hasWorkspaceChatScrollFollowingLatest(chatScrollSnapshot);',
    '{hasPhaseStatusLabel === true &&',
  ];
  const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
  if (missing.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: Workspace phase snapshot strip',
      `missing: ${missing.join(', ')}`,
    ].join('\n'));
  }

  const bannedSnippets = [
    "status === 'failed' || hasBlockers",
    'const phaseStatusLabel = formatPhaseStatusLabel(phase?.status)',
    'const hasPhaseStatusLabel = phaseStatusLabel !== undefined;',
    'const tone = getPhaseSnapshotTone(phase?.status, hasBlockers);',
    "const phaseStatusLabel = formatPhaseStatusLabel(phase?.status) ?? '无阶段状态';",
    "const hasPhaseFailed = phase?.status === 'failed';",
    "const hasPhasePending = phase?.status === 'pending';",
    "const hasPhasePassed = phase?.status === 'passed';",
    "chatScrollSnapshot.status === 'following_latest'\n    || chatScrollSnapshot.status === 'restored_to_latest'",
  ];
  const regressions = bannedSnippets.filter((snippet) => source.includes(snippet));
  if (regressions.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: Workspace phase snapshot strip regressed',
      `regressions: ${regressions.join(', ')}`,
    ].join('\n'));
  }

  const summarySnippets = [
    'function WorkspaceChatMessageStateSummary',
    'resolveWorkspaceChatStateSummaryRules',
    'testId="workspace-chat-message-state-summary"',
    '<>Workflow: {workflowStatusLabel}</>',
    '<>Phase: {currentPhase}</>',
    '<>PhaseStatus: {phaseStatusLabel}</>',
    '<>Scroll: {chatScrollSnapshot.status}</>',
    'chatScrollSnapshot={messagesProps.chatScrollSnapshot}',
  ];
  const missingSummary = summarySnippets.filter((snippet) => !source.includes(snippet));
  if (missingSummary.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: Workspace chat message state summary',
      `missing: ${missingSummary.join(', ')}`,
    ].join('\n'));
  }
}

function assertSharedStepEngineeringStateMapping(sources) {
  const requiredSnippets = [
    [sources.shared, 'ResolveStepEngineeringState'],
    [sources.shared, 'engineeringState?: WorkspaceEngineeringStateSnapshot'],
    [sources.shared, 'engineeringState: resolveStepEngineeringState?.(data)'],
    [sources.planStepEffects, 'const hasStepEngineeringState = stepEngineeringState !== undefined'],
    [sources.planStepEffects, 'engineeringState: hasStepEngineeringState === true ? stepEngineeringState : message.engineeringState'],
    [sources.planStepEffects, 'const { engineeringState: stepEngineeringState, step, statusLine } = stepEvent'],
    [sources.implementationStepEffects, 'function getImplementationStepEngineeringState(stepEvent: ResolvedWorkflowStepEvent)'],
    [sources.implementationStepEffects, 'const hasStepEngineeringState = stepEngineeringState !== undefined'],
    [sources.implementationStepEffects, 'return buildFailedWorkspaceFileOperationStepState(stepEvent.step)'],
    [sources.implementationStepEffects, 'const effectiveStepEngineeringState = getImplementationStepEngineeringState(stepEvent)'],
    [sources.implementationStepEffects, 'context.updateStreamingStepState(effectiveStepEngineeringState'],
  ];
  const missing = requiredSnippets
    .filter(([source, snippet]) => !source.includes(snippet))
    .map(([, snippet]) => snippet);
  if (missing.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: shared step engineeringState mapping',
      `missing: ${missing.join(', ')}`,
    ].join('\n'));
  }
}

function assertBackendStepEngineeringStateContract(sources) {
  const requiredSnippets = [
    [sources.events, '"engineeringState": engineeringStatePayload(state)'],
    [sources.engineeringState, '"phase": phaseStatePayload(state)'],
    [sources.engineeringState, '"current_phase"'],
    [sources.engineeringState, '"current_task"'],
    [sources.engineeringState, '"completed_tasks"'],
    [sources.engineeringState, '"blockers"'],
    [sources.engineeringState, '"next_action"'],
    [sources.engineeringState, '"status"'],
    [sources.capabilityStage, 'emitCapabilityResolveStep'],
    [sources.capabilityStage, 'buildEngineeringStateStep('],
    [sources.planOrchestrator, 'buildEngineeringStateStep('],
    [sources.planOrchestrator, 'buildPlanAnalysisWorkflowStageStep'],
    [sources.planOrchestrator, 'ErrPlanOrchestrationUnavailable'],
    [sources.planOrchestrator, 'withRecovery(buildPlanAnalysisRecoveryState(command, detail))'],
    [sources.generationStage, 'buildGenerationWorkflowStageStep'],
    [sources.generationStage, 'ErrGenerateOrchestrationUnavailable'],
    [sources.generationStage, 'service.GenerationFailureCode(err)'],
    [sources.generationStage, 'withRecovery(buildGenerationRecoveryState(command, reasonCode, err))'],
    [sources.generationStage, 'wrapGenerationWorkflowStepRecorder(ctx, stateRecorder, command, handler)'],
    [sources.generationStage, 'stepRecorder.RecordWorkflowStep(ctx, workflowStepRecordParams'],
    [sources.recorder, 'type WorkflowStepRecorder interface'],
    [sources.recorder, 'RecordWorkflowStep(ctx context.Context, params workflowStepRecordParams) error'],
    [sources.recorder, 'func (r *ChatMessageEngineeringStateRecorder) RecordWorkflowStep'],
    [sources.recorder, '"kind":          "workflow"'],
    [sources.recorder, '"statusContent": recordedWorkflowStepStatusContent(step)'],
    [sources.recorder, '"workflowSteps": []map[string]interface{}{step}'],
    [sources.recorder, 'normalizeRecordedWorkflowStep(params.Step, params.WorkflowStage, params.WorkflowMode)'],
    [sources.validationGate, 'buildValidationWorkflowStep'],
    [sources.validationGate, 'ErrValidationGateUnavailable'],
    [sources.validationGate, 'finishFailedValidationWorkflowStage(ctx, recorder, command, state, ValidationGateResult'],
    [sources.validationGate, 'validationLineLocationPattern'],
    [sources.validationGate, 'buildValidationFailureLocation(match[1], match[2], "0", line)'],
    [sources.foundationGate, 'buildEngineeringStateStep('],
    [sources.foundationGate, 'foundationGateArtifactReadFailureReason'],
    [sources.foundationGate, 'failed to read %s'],
    [sources.bootstrapOrchestrator, 'buildEngineeringStateStep('],
    [sources.orchestratorTest, 'assertStepEngineeringStatePhase'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "running", EngineeringStatusRunning)'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "done", EngineeringStatusPassed)'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "validation:"+ValidationGateBeforePreview, "failed", EngineeringStatusFailed)'],
    [sources.orchestratorTest, 'func TestExecuteValidationGateUnavailableEmitsFailedState'],
    [sources.orchestratorTest, 'func TestParseValidationFailureItemsExtractsLineOnlyLocations'],
    [sources.orchestratorTest, 'backend/internal/service/project_test.go:42: expected ready state'],
    [sources.orchestratorTest, 'errors.Is(err, ErrValidationGateUnavailable)'],
    [sources.orchestratorTest, 'func TestBuildPlanAnalysisDoneStateAwaitsSelection'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "orchestration:plan-analysis", "running", EngineeringStatusRunning)'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "orchestration:plan-analysis:failed", "failed", EngineeringStatusFailed)'],
    [sources.orchestratorTest, 'func TestPlanOrchestratorUnavailableEmitsFailedPlanAnalysisState'],
    [sources.orchestratorTest, 'recovery["reason_code"] != "plan_generation_failed"'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "foundation:"+FoundationGateBeforePlan, "failed", EngineeringStatusFailed)'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "foundation:"+FoundationGateBeforeImplement, "failed", EngineeringStatusFailed)'],
    [sources.orchestratorTest, 'func TestPlanOrchestratorGeneratePlansStreamSurfacesFoundationArtifactReadFailure'],
    [sources.orchestratorTest, 'func TestExecuteFoundationGateBeforeImplementSurfacesArtifactReadFailure'],
    [sources.orchestratorTest, 'service.ProjectBootstrapStatePath+" 读取失败"'],
    [sources.orchestratorTest, 'assertStepEngineeringStatePhase(t, step, EngineeringStatusPassed)'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "orchestration:"+WorkflowStageImplement, "running", EngineeringStatusRunning)'],
    [sources.orchestratorTest, 'assertCapturedStepEngineeringStatePhase(t, events, "orchestration:"+WorkflowStageImplement+":failed", "failed", EngineeringStatusFailed)'],
    [sources.orchestratorTest, 'func TestGenerateOrchestratorUnavailableEmitsFailedGenerationState'],
    [sources.orchestratorTest, 'recovery["reason_code"] != "generation_failed"'],
    [sources.orchestratorTest, 'func TestChatMessageEngineeringStateRecorderRecordsWorkflowStep'],
    [sources.orchestratorTest, 'func TestWrapGenerationWorkflowStepRecorderPersistsAndForwardsStepEvents'],
    [sources.orchestratorTest, 'expected non-step event not to persist'],
    [sources.orchestratorTest, 'recordedEngineeringState := assertStepEngineeringStatePhase(t, recordedPayload, EngineeringStatusFailed)'],
    [sources.orchestratorTest, 'requiredFields := []string{"current_phase", "current_task", "completed_tasks", "blockers", "next_action", "status"}'],
  ];
  const missing = requiredSnippets
    .filter(([source, snippet]) => !source.includes(snippet))
    .map(([, snippet]) => snippet);
  if (missing.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: backend step engineeringState contract',
      `missing: ${missing.join(', ')}`,
    ].join('\n'));
  }
}

function assertApprovedPlanContextContract(sources) {
  const requiredSnippets = [
    [sources.frontendSupport, 'export function buildImplementationPlanContext'],
    [sources.frontendSupport, "'已批准方案上下文'"],
    [sources.frontendSupport, '`方案 ID：${plan.id}`'],
    [sources.frontendSupport, 'import { getPlanFeatureSummary } from \'@/lib/plan-features\';'],
    [sources.frontendSupport, '`核心功能：${getPlanFeatureSummary(plan)}`'],
    [sources.frontendPlanImplementation, 'planContext: buildImplementationPlanContext(plan, targetProject)'],
    [sources.backendGeneratorContent, 'buildGenerationUserPrompt(req)'],
    [sources.backendGeneratorContent, 'func buildGenerationUserPrompt(req *GenerateRequest) string'],
    [sources.backendGeneratorContent, '"已批准方案上下文："'],
    [sources.backendGeneratorContent, '"用户实现请求："'],
    [sources.backendGeneratorContent, '"实现必须完整继承已批准方案上下文'],
    [sources.backendGeneratorContentTest, 'func TestBuildGenerationChatRequestInjectsApprovedPlanContext'],
    [sources.backendGeneratorContentTest, '方案 ID：plan-a'],
    [sources.backendGeneratorContentTest, 'func TestBuildGenerationUserPromptKeepsPromptWhenPlanContextEmpty'],
  ];
  const missing = requiredSnippets
    .filter(([source, snippet]) => !source.includes(snippet))
    .map(([, snippet]) => snippet);
  if (missing.length > 0) {
    throw new Error([
      '[YES] Workflow contract drift detected: approved plan context contract',
      `missing: ${missing.join(', ')}`,
    ].join('\n'));
  }
}

function assertBackendStreamEventHandlerContract(sources) {
  const requiredAnchors = [
    [sources.generatorStream, 'type StreamEventName = string'],
    [sources.generatorStream, 'type StreamEventPayload = any'],
    [sources.generatorStream, 'type StreamEventHandler func(StreamEventName, StreamEventPayload) error'],
    [sources.generatorStream, 'StreamEventStep     StreamEventName = "step"'],
    [sources.generatorStream, 'StreamEventDone     StreamEventName = "done"'],
    [sources.generatorStream, 'StreamEventError    StreamEventName = "error"'],
    [sources.generatorStream, 'func emitStreamEvent(handler StreamEventHandler, event StreamEventName, payload StreamEventPayload) error'],
    [sources.generatorService, 'func (s *GeneratorService) Generate(ctx context.Context, req *GenerateRequest, handler StreamEventHandler) error'],
    [sources.orchestrationEvents, 'return handler(service.StreamEventStep, payload)'],
    [sources.sseResponse, 'func writeSSEJSONEvent(writer *sse.Writer, event service.StreamEventName, data service.StreamEventPayload) error'],
    [sources.sseResponse, 'func newSSEJSONEventHandler(writer *sse.Writer) service.StreamEventHandler'],
    [sources.sseResponse, 'func newLoggedSSEJSONEventHandler(writer *sse.Writer, logPrefix, projectID string) service.StreamEventHandler'],
    [sources.sseResponse, 'case service.StreamEventError, service.StreamEventDone:'],
    [sources.streamResponseWriter, 'return writeSSEJSONEvent(writer, service.StreamEventError, buildGenerateStreamErrorPayload(err))'],
    [sources.streamResponseWriter, 'return writeSSEJSONEvent(writer, service.StreamEventDone, map[string]any{'],
    [sources.generationStage, 'return func(eventName service.StreamEventName, payload service.StreamEventPayload) error'],
    [sources.generationStage, 'if eventName == service.StreamEventStep {'],
    [sources.bootstrapOrchestrator, 'return handler(service.StreamEventDone, map[string]interface{}{'],
  ];

  for (const [source, anchor] of requiredAnchors) {
    if (!source.includes(anchor)) {
      throw new Error(`[YES] Backend stream event handler contract missing anchor: ${anchor}`);
    }
  }
}

function main() {
  const backendWorkflowSource = readText(backendWorkflowPath);
  const backendEngineeringStateSource = readText(backendEngineeringStatePath);
  const backendEngineeringStateRecorderSource = readText(backendEngineeringStateRecorderPath);
  const backendOrchestrationEventsSource = readText(backendOrchestrationEventsPath);
  const backendCapabilityStageSource = readText(backendCapabilityStagePath);
  const backendPlanOrchestratorSource = readText(backendPlanOrchestratorPath);
  const backendGenerationStageSource = readText(backendGenerationStagePath);
  const backendValidationGateSource = readText(backendValidationGatePath);
  const backendFoundationGateSource = readText(backendFoundationGatePath);
  const backendBootstrapOrchestratorSource = readText(backendBootstrapOrchestratorPath);
  const backendOrchestratorTestSource = readText(backendOrchestratorTestPath);
  const backendGeneratorContentStageSource = readText(backendGeneratorContentStagePath);
  const backendGeneratorContentStageTestSource = readText(backendGeneratorContentStageTestPath);
  const backendGeneratorStreamSource = readText(backendGeneratorStreamPath);
  const backendGeneratorServiceSource = readText(backendGeneratorServicePath);
  const backendSSEResponseSource = readText(backendSSEResponsePath);
  const backendStreamResponseWriterSource = readText(backendStreamResponseWriterPath);
  const backendServiceWorkflowSource = readText(backendServiceWorkflowPath);
  const frontendContractSource = readText(frontendContractPath);
  const frontendOrchestrationSupportSource = readText(frontendOrchestrationSupportPath);
  const frontendPlanImplementationSource = readText(frontendPlanImplementationPath);
  const chatMessageContentSource = readText(chatMessageContentPath);
  const workspaceChatComponentsSource = readText(workspaceChatComponentsPath);
  const orchestrationSharedSource = readText(orchestrationSharedPath);
  const planStepEffectsSource = readText(planStepEffectsPath);
  const implementationStepEffectsSource = readText(implementationStepEffectsPath);

  const backendStages = extractGoStringConstants(backendWorkflowSource, 'WorkflowStage');
  const backendModes = extractGoStringConstants(backendWorkflowSource, 'WorkflowMode');
  const backendStatuses = extractGoStringConstants(backendEngineeringStateSource, 'EngineeringStatus');
  const backendServiceStages = extractGoStringConstants(backendServiceWorkflowSource, 'serviceWorkflowStage');
  const backendServiceModes = extractGoStringConstants(backendServiceWorkflowSource, 'serviceWorkflowMode');
  const backendStageConstants = extractGoStringConstantMap(backendWorkflowSource, 'WorkflowStage');
  const backendModeConstants = extractGoStringConstantMap(backendWorkflowSource, 'WorkflowMode');
  const backendServiceStageConstants = extractGoStringConstantMap(backendServiceWorkflowSource, 'serviceWorkflowStage');
  const backendServiceModeConstants = extractGoStringConstantMap(backendServiceWorkflowSource, 'serviceWorkflowMode');

  const frontendBackendStages = extractTsStringArray(frontendContractSource, 'WORKSPACE_BACKEND_WORKFLOW_STAGES');
  const frontendLocalStages = extractTsStringArray(frontendContractSource, 'WORKSPACE_FRONTEND_LOCAL_WORKFLOW_STAGES');
  const frontendModes = extractTsStringArray(frontendContractSource, 'WORKSPACE_WORKFLOW_MODES');
  const frontendStatuses = extractTsStringArray(frontendContractSource, 'WORKSPACE_ENGINEERING_STATUSES');
  const frontendStageModeMap = extractTsStringRecord(frontendContractSource, 'WORKSPACE_BACKEND_WORKFLOW_STAGE_MODE_MAP');
  const frontendLocalStageSourceMap = extractTsStringRecord(frontendContractSource, 'WORKSPACE_FRONTEND_LOCAL_WORKFLOW_STAGE_SOURCES');
  const frontendStageLabelMap = extractTsStringRecord(frontendContractSource, 'WORKSPACE_WORKFLOW_STAGE_LABELS');
  const frontendAllStages = uniqueSorted([...frontendBackendStages, ...frontendLocalStages]);
  const frontendStageLabelKeys = extractWorkflowStageLabelKeys(frontendContractSource);

  const backendStageModeMap = extractGoWorkflowStageDefinitionModeMap(
    backendWorkflowSource,
    backendStageConstants,
    backendModeConstants,
  );
  const backendServiceStageModeMap = extractGoStageModeMap(
    backendServiceWorkflowSource,
    'workflowMode',
    backendServiceStageConstants,
    backendServiceModeConstants,
    backendServiceStages,
  );
  const backendStageLabelMap = extractGoStageLabelMap(
    backendEngineeringStateSource,
    'workflowPhaseLabel',
    backendStageConstants,
  );
  const frontendBackendStageLabelMap = pickRecord(frontendStageLabelMap, backendStages);

  assertSameSet('backend workflow stages must match frontend backend-backed contract', frontendBackendStages, backendStages);
  assertSameSet('workflow modes must match', frontendModes, backendModes);
  assertSameSet('engineering statuses must match', frontendStatuses, backendStatuses);
  assertSameSet('backend service workflow stages must match orchestration stages', backendServiceStages, backendStages);
  assertSameSet('backend service workflow modes must match orchestration modes', backendServiceModes, backendModes);
  assertSameSet('all frontend workflow stages must have display labels', frontendStageLabelKeys, frontendAllStages);
  assertSameRecord('backend workflow stage-mode map must match frontend contract', backendStageModeMap, frontendStageModeMap);
  assertSameRecord('backend service workflow stage-mode map must match frontend contract', backendServiceStageModeMap, frontendStageModeMap);
  assertSameRecord('backend workflow phase labels must match frontend backend stage labels', backendStageLabelMap, frontendBackendStageLabelMap);
  assertLocalStageSources(rootDir, frontendLocalStages, frontendLocalStageSourceMap);
  assertWorkflowContractDisplayReaders(frontendContractSource);
  assertFrontendPhaseSnapshots(frontendWorkspaceDir, frontendStageLabelMap);
  assertEngineeringStatePanelPhaseSummary(chatMessageContentSource);
  assertWorkspacePhaseSnapshotStrip(workspaceChatComponentsSource);
  assertSharedStepEngineeringStateMapping({
    shared: orchestrationSharedSource,
    planStepEffects: planStepEffectsSource,
    implementationStepEffects: implementationStepEffectsSource,
  });
  assertBackendStepEngineeringStateContract({
    events: backendOrchestrationEventsSource,
    engineeringState: backendEngineeringStateSource,
    recorder: backendEngineeringStateRecorderSource,
    capabilityStage: backendCapabilityStageSource,
    planOrchestrator: backendPlanOrchestratorSource,
    generationStage: backendGenerationStageSource,
    validationGate: backendValidationGateSource,
    foundationGate: backendFoundationGateSource,
    bootstrapOrchestrator: backendBootstrapOrchestratorSource,
    orchestratorTest: backendOrchestratorTestSource,
  });
  assertApprovedPlanContextContract({
    frontendSupport: frontendOrchestrationSupportSource,
    frontendPlanImplementation: frontendPlanImplementationSource,
    backendGeneratorContent: backendGeneratorContentStageSource,
    backendGeneratorContentTest: backendGeneratorContentStageTestSource,
  });
  assertBackendStreamEventHandlerContract({
    generatorStream: backendGeneratorStreamSource,
    generatorService: backendGeneratorServiceSource,
    sseResponse: backendSSEResponseSource,
    streamResponseWriter: backendStreamResponseWriterSource,
    orchestrationEvents: backendOrchestrationEventsSource,
    generationStage: backendGenerationStageSource,
    bootstrapOrchestrator: backendBootstrapOrchestratorSource,
  });

  const localStageOverlap = frontendLocalStages.filter((stage) => backendStages.includes(stage));
  if (localStageOverlap.length > 0) {
    throw new Error(`[YES] Frontend-local workflow stages overlap backend stages: ${localStageOverlap.join(', ')}`);
  }

  if (frontendLocalStages.length === 0) {
    throw new Error('[YES] Frontend-local workflow stage contract must stay explicit, even if temporarily empty.');
  }

  console.log('[YES] Workflow contract sync valid.');
}

main();
