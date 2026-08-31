import {
  isWorkspaceEngineeringStatus,
  isWorkspaceWorkflowMode,
  isWorkspaceWorkflowStage,
  type WorkspaceEngineeringStatus,
  type WorkspaceWorkflowMode,
  type WorkspaceWorkflowStage,
} from './workflow-contract';

export type { WorkspaceEngineeringStatus } from './workflow-contract';

export type WorkspaceWorkflowStatus = WorkspaceEngineeringStatus;
export type WorkspaceValidationStatus = WorkspaceEngineeringStatus;
export type WorkspaceRuntimeStatus = WorkspaceEngineeringStatus;
export type WorkspacePlanSelectionStatus = WorkspaceEngineeringStatus;
export type WorkspacePhaseStatus = WorkspaceEngineeringStatus;

export type WorkspaceProjectPanelManualRefreshStatus = 'passed' | 'failed';
export type WorkspaceRuntimeRecoveryStatus = 'running' | 'passed' | 'failed';
export type WorkspaceValidationFailureSeverity = 'error' | 'warning' | 'info';
export type WorkspaceGateDecision = 'allow' | 'warn' | 'block';
export type WorkspaceFoundationRiskLevel = 'low' | 'medium' | 'high';
export type WorkspaceNormalizedString = string;
export type WorkspaceNormalizedStringList = WorkspaceNormalizedString[];
export type WorkspacePlanSelectionAvailablePlanId = string;
export type WorkspacePlanSelectionAvailablePlanIdList = WorkspacePlanSelectionAvailablePlanId[];
export type WorkspacePhaseCompletedTask = string;
export type WorkspacePhaseCompletedTaskList = WorkspacePhaseCompletedTask[];
export type WorkspacePhaseBlocker = string;
export type WorkspacePhaseBlockerList = WorkspacePhaseBlocker[];
export type WorkspaceBootstrapDecisionRisk = string;
export type WorkspaceBootstrapDecisionRiskList = WorkspaceBootstrapDecisionRisk[];
export type WorkspaceBootstrapDecisionFollowupAction = string;
export type WorkspaceBootstrapDecisionFollowupActionList = WorkspaceBootstrapDecisionFollowupAction[];
export type WorkspaceBootstrapDecisionArtifactTarget = string;
export type WorkspaceBootstrapDecisionArtifactTargetList = WorkspaceBootstrapDecisionArtifactTarget[];
export type WorkspaceGateReason = string;
export type WorkspaceGateReasonList = WorkspaceGateReason[];
export type WorkspaceGateBlockingItem = string;
export type WorkspaceGateBlockingItemList = WorkspaceGateBlockingItem[];
export type WorkspaceGateWarningItem = string;
export type WorkspaceGateWarningItemList = WorkspaceGateWarningItem[];
export type WorkspaceBootstrapBlocker = string;
export type WorkspaceBootstrapBlockerList = WorkspaceBootstrapBlocker[];
export type WorkspaceDeletionRecoveryCleanupScope = string;
export type WorkspaceDeletionRecoveryCleanupScopeList = WorkspaceDeletionRecoveryCleanupScope[];
export type WorkspaceEngineeringStateRawObject = {
  [fieldName: string]: unknown;
};

export type WorkspaceWorkflowState = {
  stage?: WorkspaceWorkflowStage;
  mode?: WorkspaceWorkflowMode;
  status?: WorkspaceWorkflowStatus;
};

export type WorkspaceValidationFailureItem = {
  id?: string;
  title?: string;
  detail?: string;
  severity?: WorkspaceValidationFailureSeverity;
  suggestion?: string;
  file_path?: string;
  line_number?: number;
  column?: number;
  search_text?: string;
};

export type WorkspaceValidationState = {
  gate?: string;
  status?: WorkspaceValidationStatus;
  failure_items?: WorkspaceValidationFailureItem[];
};

export type WorkspaceRuntimeState = {
  project_id?: string;
  app_type?: string;
  project_name?: string;
  status?: WorkspaceRuntimeStatus;
};

export type WorkspacePlanSelectionState = {
  status?: WorkspacePlanSelectionStatus;
  available_plan_ids?: WorkspacePlanSelectionAvailablePlanIdList;
  recommended_plan_id?: string;
  selected_plan_id?: string;
  ready?: boolean;
  countdown_seconds?: number;
  auto_confirm_deadline_at?: string;
  source_message_id?: string;
};

export type WorkspacePhaseState = {
  current_phase?: string;
  current_task?: string;
  completed_tasks?: WorkspacePhaseCompletedTaskList;
  blockers?: WorkspacePhaseBlockerList;
  next_action?: string;
  status?: WorkspacePhaseStatus;
};

export type WorkspaceExecutionState = {
  auto_progress_enabled?: boolean;
  awaiting_confirmation?: boolean;
  pause_reason?: string;
  approval_boundary?: string;
  approval_source?: string;
  approval_scope?: string;
  approved_plan_id?: string;
  approved_plan_name?: string;
  current_task?: string;
  next_action?: string;
};

export type WorkspaceRecoveryState = {
  blocked?: boolean;
  reason_code?: string;
  reason_message?: string;
  resume_stage?: string;
  resume_mode?: string;
  can_retry?: boolean;
  retry_label?: string;
  retry_prompt?: string;
};

export type WorkspaceBootstrapDecisionItem = {
  id?: string;
  domain?: string;
  title?: string;
  description?: string;
  bucket?: string;
  status?: string;
  owner?: string;
  rationale?: string;
  recommended_option?: string;
  selected_option?: string;
  notes?: string;
  risks_if_unset?: WorkspaceBootstrapDecisionRiskList;
  followup_actions?: WorkspaceBootstrapDecisionFollowupActionList;
  artifact_targets?: WorkspaceBootstrapDecisionArtifactTargetList;
};

export type WorkspaceGateResult = {
  decision?: WorkspaceGateDecision;
  reasons?: WorkspaceGateReasonList;
  blocking_items?: WorkspaceGateBlockingItemList;
  warning_items?: WorkspaceGateWarningItemList;
  next_action?: string;
};

export type WorkspaceBootstrapGateResult = WorkspaceGateResult;

export type WorkspaceBootstrapState = {
  schema_version?: string;
  status?: string;
  template_id?: string;
  project_type?: string;
  required_decisions?: WorkspaceBootstrapDecisionItem[];
  reserved_extensions?: WorkspaceBootstrapDecisionItem[];
  deferred_decisions?: WorkspaceBootstrapDecisionItem[];
  blockers?: WorkspaceBootstrapBlockerList;
  next_action?: string;
  approval_required?: boolean;
  foundation_risk_level?: WorkspaceFoundationRiskLevel;
  gate_result?: WorkspaceBootstrapGateResult;
};

export type WorkspaceDeletionRecoveryState = {
  status?: string;
  reason_code?: string;
  reason_message?: string;
  cleanup_scope?: WorkspaceDeletionRecoveryCleanupScopeList;
};

export type WorkspaceEngineeringStateSnapshot = {
  workflow?: WorkspaceWorkflowState;
  validation?: WorkspaceValidationState;
  runtime?: WorkspaceRuntimeState;
  plan_selection?: WorkspacePlanSelectionState;
  phase?: WorkspacePhaseState;
  execution?: WorkspaceExecutionState;
  recovery?: WorkspaceRecoveryState;
  bootstrap_state?: WorkspaceBootstrapState;
  deletion_recovery?: WorkspaceDeletionRecoveryState;
};

type WorkspaceEngineeringStateSnapshotSection =
  | WorkspaceWorkflowState
  | WorkspaceValidationState
  | WorkspaceRuntimeState
  | WorkspacePlanSelectionState
  | WorkspacePhaseState
  | WorkspaceExecutionState
  | WorkspaceRecoveryState
  | WorkspaceBootstrapState
  | WorkspaceDeletionRecoveryState
  | undefined;

type WorkspaceEngineeringStateSnapshotSectionList = WorkspaceEngineeringStateSnapshotSection[];

export type WorkspaceEngineeringStateCarrier = {
  engineeringState?: WorkspaceEngineeringStateSnapshot;
};

export type WorkspaceEngineeringStateCarrierList = readonly WorkspaceEngineeringStateCarrier[];

function normalizeWorkspaceText(value: string) {
  return value.trim();
}

function isWorkspaceEngineeringStateRawObject(value: unknown): value is WorkspaceEngineeringStateRawObject {
  const hasObject = value !== null && typeof value === 'object' && Array.isArray(value) === false;
  return hasObject === true;
}

function readWorkspaceEngineeringStateRawObject(value: unknown): WorkspaceEngineeringStateRawObject | undefined {
  const hasRawObject = isWorkspaceEngineeringStateRawObject(value);
  if (hasRawObject === false) {
    return undefined;
  }

  return value;
}

function isWorkspaceEngineeringStateRawList(value: unknown): value is unknown[] {
  const hasList = Array.isArray(value);
  return hasList === true;
}

function hasWorkspaceNormalizedString(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function isWorkspaceRawString(value: unknown): value is string {
  const hasString = typeof value === 'string';
  return hasString === true;
}

function getWorkspaceNormalizedText(value: unknown): WorkspaceNormalizedString | undefined {
  const hasString = isWorkspaceRawString(value);
  if (hasString === false) {
    return undefined;
  }

  return normalizeWorkspaceText(value);
}

function getWorkspaceFiniteNumber(value: unknown): number | undefined {
  const hasNumber = typeof value === 'number';
  if (hasNumber === false) {
    return undefined;
  }

  const hasFiniteNumber = Number.isFinite(value);
  if (hasFiniteNumber === false) {
    return undefined;
  }

  return value;
}

function hasWorkspaceNormalizedList<TValue>(value: TValue[]): boolean {
  const itemCount = value.length;
  const hasItems = itemCount > 0;
  return hasItems === true;
}

function hasWorkspaceNormalizedStateValue(value: unknown): boolean {
  if (Array.isArray(value) === true) {
    return hasWorkspaceNormalizedList(value);
  }

  if (typeof value === 'string') {
    return hasWorkspaceNormalizedString(value);
  }

  if (typeof value === 'boolean') {
    return value === true;
  }

  const hasValue = value !== undefined;
  return hasValue === true;
}

function hasWorkspaceNormalizedObjectValues(value: WorkspaceEngineeringStateRawObject): boolean {
  for (const fieldValue of Object.values(value)) {
    const hasValue = hasWorkspaceNormalizedStateValue(fieldValue);
    if (hasValue === true) {
      return true;
    }
  }

  return false;
}

function resolveWorkspaceNormalizedList<TValue>(value: TValue[]): TValue[] | undefined {
  const hasItems = hasWorkspaceNormalizedList(value);
  if (hasItems === false) {
    return undefined;
  }

  return value;
}

function resolveWorkspaceNormalizedObject<TValue extends WorkspaceEngineeringStateRawObject>(
  value: TValue,
): TValue | undefined {
  const hasNormalizedValues = hasWorkspaceNormalizedObjectValues(value);
  if (hasNormalizedValues === false) {
    return undefined;
  }

  return value;
}

function hasWorkspaceEngineeringStateSnapshotSection(value: unknown): boolean {
  const hasValue = value !== undefined;
  return hasValue === true;
}

function getWorkspaceEngineeringStateSnapshotSections(
  snapshot: WorkspaceEngineeringStateSnapshot,
): WorkspaceEngineeringStateSnapshotSectionList {
  return [
    snapshot.workflow,
    snapshot.validation,
    snapshot.runtime,
    snapshot.plan_selection,
    snapshot.phase,
    snapshot.execution,
    snapshot.recovery,
    snapshot.bootstrap_state,
    snapshot.deletion_recovery,
  ];
}

function hasWorkspaceEngineeringStateSnapshot(snapshot: WorkspaceEngineeringStateSnapshot): boolean {
  const sections = getWorkspaceEngineeringStateSnapshotSections(snapshot);
  for (const section of sections) {
    const hasSection = hasWorkspaceEngineeringStateSnapshotSection(section);
    if (hasSection === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceEngineeringStateCarrierState(
  engineeringState: WorkspaceEngineeringStateSnapshot | undefined,
): engineeringState is WorkspaceEngineeringStateSnapshot {
  return engineeringState !== undefined;
}

function hasWorkspaceEngineeringStateCarrierBootstrapState(
  bootstrapState: WorkspaceBootstrapState | undefined,
): bootstrapState is WorkspaceBootstrapState {
  return bootstrapState !== undefined;
}

function readWorkspaceBootstrapGateResult(
  bootstrapState: WorkspaceEngineeringStateRawObject | undefined,
): WorkspaceEngineeringStateRawObject | undefined {
  const hasBootstrapState = bootstrapState !== undefined;
  if (hasBootstrapState === false) {
    return undefined;
  }

  return readWorkspaceEngineeringStateRawObject(bootstrapState.gate_result);
}

export function resolveLatestWorkspaceEngineeringState(
  items: WorkspaceEngineeringStateCarrierList,
): WorkspaceEngineeringStateSnapshot | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const engineeringState = items[index]?.engineeringState;
    if (hasWorkspaceEngineeringStateCarrierState(engineeringState) === true) {
      return engineeringState;
    }
  }
  return undefined;
}

export function resolveLatestWorkspaceBootstrapState(
  items: WorkspaceEngineeringStateCarrierList,
): WorkspaceBootstrapState | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const bootstrapState = items[index]?.engineeringState?.bootstrap_state;
    if (hasWorkspaceEngineeringStateCarrierBootstrapState(bootstrapState) === true) {
      return bootstrapState;
    }
  }
  return undefined;
}

export function isWorkspaceFoundationCompleted(
  engineeringState?: WorkspaceEngineeringStateSnapshot,
) {
  return engineeringState?.bootstrap_state?.status === 'completed';
}

export function hasCompletedWorkspaceFoundation(
  items: WorkspaceEngineeringStateCarrierList,
) {
  return resolveLatestWorkspaceBootstrapState(items)?.status === 'completed';
}

export function normalizeWorkspaceEngineeringStatus(raw: unknown): WorkspaceEngineeringStatus | undefined {
  const hasStatus = isWorkspaceEngineeringStatus(raw);
  if (hasStatus === false) {
    return undefined;
  }

  return raw;
}

function normalizeWorkspaceWorkflowStage(raw: unknown): WorkspaceWorkflowStage | undefined {
  const normalized = getWorkspaceNormalizedText(raw);
  const hasStage = isWorkspaceWorkflowStage(normalized);
  if (hasStage === false) {
    return undefined;
  }

  return normalized;
}

function normalizeWorkspaceWorkflowMode(raw: unknown): WorkspaceWorkflowMode | undefined {
  const normalized = getWorkspaceNormalizedText(raw);
  const hasMode = isWorkspaceWorkflowMode(normalized);
  if (hasMode === false) {
    return undefined;
  }

  return normalized;
}

function isWorkspaceValidationFailureSeverity(value: unknown): value is WorkspaceValidationFailureSeverity {
  return value === 'error' || value === 'warning' || value === 'info';
}

function isWorkspaceGateDecision(value: unknown): value is WorkspaceGateDecision {
  return value === 'allow' || value === 'warn' || value === 'block';
}

function isWorkspaceFoundationRiskLevel(value: unknown): value is WorkspaceFoundationRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

function normalizeWorkspaceValidationFailureSeverity(
  value: unknown,
): WorkspaceValidationFailureSeverity | undefined {
  const hasSeverity = isWorkspaceValidationFailureSeverity(value);
  if (hasSeverity === false) {
    return undefined;
  }

  return value;
}

function normalizeWorkspaceGateDecision(value: unknown): WorkspaceGateDecision | undefined {
  const hasDecision = isWorkspaceGateDecision(value);
  if (hasDecision === false) {
    return undefined;
  }

  return value;
}

function normalizeWorkspaceFoundationRiskLevel(value: unknown): WorkspaceFoundationRiskLevel | undefined {
  const hasRiskLevel = isWorkspaceFoundationRiskLevel(value);
  if (hasRiskLevel === false) {
    return undefined;
  }

  return value;
}

function normalizeWorkspaceStringList(raw: unknown): WorkspaceNormalizedStringList | undefined {
  const hasRawList = isWorkspaceEngineeringStateRawList(raw);
  if (hasRawList === false) {
    return undefined;
  }

  const normalized: WorkspaceNormalizedStringList = [];
  for (const value of raw) {
    if (isWorkspaceRawString(value) === true) {
      const normalizedValue = normalizeWorkspaceText(value);
      const hasValue = hasWorkspaceNormalizedString(normalizedValue);
      if (hasValue === true) {
        normalized.push(normalizedValue);
      }
    }
  }

  return resolveWorkspaceNormalizedList(normalized);
}

function normalizeWorkspaceValidationFailureItems(raw: unknown): WorkspaceValidationFailureItem[] | undefined {
  const hasRawList = isWorkspaceEngineeringStateRawList(raw);
  if (hasRawList === false) {
    return undefined;
  }

  const items: WorkspaceValidationFailureItem[] = [];
  for (const item of raw) {
    const hasRawObject = isWorkspaceEngineeringStateRawObject(item);
    if (hasRawObject === true) {
      const normalized: WorkspaceValidationFailureItem = {
        id: getWorkspaceNormalizedText(item.id),
        title: getWorkspaceNormalizedText(item.title),
        detail: getWorkspaceNormalizedText(item.detail),
        severity: normalizeWorkspaceValidationFailureSeverity(item.severity),
        suggestion: getWorkspaceNormalizedText(item.suggestion),
        file_path: getWorkspaceNormalizedText(item.file_path),
        line_number: getWorkspaceFiniteNumber(item.line_number),
        column: getWorkspaceFiniteNumber(item.column),
        search_text: getWorkspaceNormalizedText(item.search_text),
      };
      const resolved = resolveWorkspaceNormalizedObject(normalized);
      if (resolved !== undefined) {
        items.push(normalized);
      }
    }
  }

  return resolveWorkspaceNormalizedList(items);
}

function normalizeWorkspacePlanSelectionState(raw: unknown): WorkspacePlanSelectionState | undefined {
  const hasRawObject = isWorkspaceEngineeringStateRawObject(raw);
  if (hasRawObject === false) {
    return undefined;
  }

  const planSelection = raw;
  const normalized: WorkspacePlanSelectionState = {
    status: normalizeWorkspaceEngineeringStatus(planSelection.status),
    available_plan_ids: normalizeWorkspaceStringList(planSelection.available_plan_ids),
    recommended_plan_id: getWorkspaceNormalizedText(planSelection.recommended_plan_id),
    selected_plan_id: getWorkspaceNormalizedText(planSelection.selected_plan_id),
    ready: planSelection.ready === true,
    countdown_seconds: getWorkspaceFiniteNumber(planSelection.countdown_seconds),
    auto_confirm_deadline_at: getWorkspaceNormalizedText(planSelection.auto_confirm_deadline_at),
    source_message_id: getWorkspaceNormalizedText(planSelection.source_message_id),
  };

  return resolveWorkspaceNormalizedObject(normalized);
}

function normalizeWorkspacePhaseState(raw: unknown): WorkspacePhaseState | undefined {
  const hasRawObject = isWorkspaceEngineeringStateRawObject(raw);
  if (hasRawObject === false) {
    return undefined;
  }

  const phase = raw;
  const normalized: WorkspacePhaseState = {
    current_phase: getWorkspaceNormalizedText(phase.current_phase),
    current_task: getWorkspaceNormalizedText(phase.current_task),
    completed_tasks: normalizeWorkspaceStringList(phase.completed_tasks),
    blockers: normalizeWorkspaceStringList(phase.blockers),
    next_action: getWorkspaceNormalizedText(phase.next_action),
    status: normalizeWorkspaceEngineeringStatus(phase.status),
  };

  return resolveWorkspaceNormalizedObject(normalized);
}

export function normalizeWorkspaceGateResult(raw: unknown): WorkspaceGateResult | undefined {
  const hasRawObject = isWorkspaceEngineeringStateRawObject(raw);
  if (hasRawObject === false) {
    return undefined;
  }

  const gateResult = raw;
  const normalized: WorkspaceGateResult = {
    decision: normalizeWorkspaceGateDecision(gateResult.decision),
    reasons: normalizeWorkspaceStringList(gateResult.reasons),
    blocking_items: normalizeWorkspaceStringList(gateResult.blocking_items),
    warning_items: normalizeWorkspaceStringList(gateResult.warning_items),
    next_action: getWorkspaceNormalizedText(gateResult.next_action),
  };

  return resolveWorkspaceNormalizedObject(normalized);
}

function normalizeWorkspaceBootstrapDecisionItems(raw: unknown): WorkspaceBootstrapDecisionItem[] | undefined {
  const hasRawList = isWorkspaceEngineeringStateRawList(raw);
  if (hasRawList === false) {
    return undefined;
  }

  const items: WorkspaceBootstrapDecisionItem[] = [];
  for (const item of raw) {
    const hasRawObject = isWorkspaceEngineeringStateRawObject(item);
    if (hasRawObject === true) {
      const normalized: WorkspaceBootstrapDecisionItem = {
        id: getWorkspaceNormalizedText(item.id),
        domain: getWorkspaceNormalizedText(item.domain),
        title: getWorkspaceNormalizedText(item.title),
        description: getWorkspaceNormalizedText(item.description),
        bucket: getWorkspaceNormalizedText(item.bucket),
        status: getWorkspaceNormalizedText(item.status),
        owner: getWorkspaceNormalizedText(item.owner),
        rationale: getWorkspaceNormalizedText(item.rationale),
        recommended_option: getWorkspaceNormalizedText(item.recommended_option),
        selected_option: getWorkspaceNormalizedText(item.selected_option),
        notes: getWorkspaceNormalizedText(item.notes),
        risks_if_unset: normalizeWorkspaceStringList(item.risks_if_unset),
        followup_actions: normalizeWorkspaceStringList(item.followup_actions),
        artifact_targets: normalizeWorkspaceStringList(item.artifact_targets),
      };
      const resolved = resolveWorkspaceNormalizedObject(normalized);
      if (resolved !== undefined) {
        items.push(normalized);
      }
    }
  }

  return resolveWorkspaceNormalizedList(items);
}

export function normalizeWorkspaceEngineeringState(
  raw: unknown,
): WorkspaceEngineeringStateSnapshot | undefined {
  const hasRawObject = isWorkspaceEngineeringStateRawObject(raw);
  if (hasRawObject === false) {
    return undefined;
  }

  const state = raw;
  const workflow = readWorkspaceEngineeringStateRawObject(state.workflow);
  const validation = readWorkspaceEngineeringStateRawObject(state.validation);
  const runtime = readWorkspaceEngineeringStateRawObject(state.runtime);
  const planSelection = readWorkspaceEngineeringStateRawObject(state.plan_selection);
  const phase = readWorkspaceEngineeringStateRawObject(state.phase);
  const execution = readWorkspaceEngineeringStateRawObject(state.execution);
  const recovery = readWorkspaceEngineeringStateRawObject(state.recovery);
  const bootstrapState = readWorkspaceEngineeringStateRawObject(state.bootstrap_state);
  const deletionRecovery = readWorkspaceEngineeringStateRawObject(state.deletion_recovery);
  const hasBootstrapState = bootstrapState !== undefined;
  const bootstrapGateResult = readWorkspaceBootstrapGateResult(bootstrapState);
  const hasWorkflow = workflow !== undefined;
  const hasValidation = validation !== undefined;
  const hasRuntime = runtime !== undefined;
  const hasExecution = execution !== undefined;
  const hasRecovery = recovery !== undefined;
  const hasDeletionRecovery = deletionRecovery !== undefined;

  const snapshot: WorkspaceEngineeringStateSnapshot = {
    workflow: hasWorkflow === true ? {
      stage: normalizeWorkspaceWorkflowStage(workflow.stage),
      mode: normalizeWorkspaceWorkflowMode(workflow.mode),
      status: normalizeWorkspaceEngineeringStatus(workflow.status),
    } : undefined,
    validation: hasValidation === true ? {
      gate: getWorkspaceNormalizedText(validation.gate),
      status: normalizeWorkspaceEngineeringStatus(validation.status),
      failure_items: normalizeWorkspaceValidationFailureItems(validation.failure_items),
    } : undefined,
    runtime: hasRuntime === true ? {
      project_id: getWorkspaceNormalizedText(runtime.project_id),
      app_type: getWorkspaceNormalizedText(runtime.app_type),
      project_name: getWorkspaceNormalizedText(runtime.project_name),
      status: normalizeWorkspaceEngineeringStatus(runtime.status),
    } : undefined,
    plan_selection: normalizeWorkspacePlanSelectionState(planSelection),
    phase: normalizeWorkspacePhaseState(phase),
    execution: hasExecution === true ? {
      auto_progress_enabled: execution.auto_progress_enabled === true,
      awaiting_confirmation: execution.awaiting_confirmation === true,
      pause_reason: getWorkspaceNormalizedText(execution.pause_reason),
      approval_boundary: getWorkspaceNormalizedText(execution.approval_boundary),
      approval_source: getWorkspaceNormalizedText(execution.approval_source),
      approval_scope: getWorkspaceNormalizedText(execution.approval_scope),
      approved_plan_id: getWorkspaceNormalizedText(execution.approved_plan_id),
      approved_plan_name: getWorkspaceNormalizedText(execution.approved_plan_name),
      current_task: getWorkspaceNormalizedText(execution.current_task),
      next_action: getWorkspaceNormalizedText(execution.next_action),
    } : undefined,
    recovery: hasRecovery === true ? {
      blocked: recovery.blocked === true,
      reason_code: getWorkspaceNormalizedText(recovery.reason_code),
      reason_message: getWorkspaceNormalizedText(recovery.reason_message),
      resume_stage: getWorkspaceNormalizedText(recovery.resume_stage),
      resume_mode: getWorkspaceNormalizedText(recovery.resume_mode),
      can_retry: recovery.can_retry === true,
      retry_label: getWorkspaceNormalizedText(recovery.retry_label),
      retry_prompt: getWorkspaceNormalizedText(recovery.retry_prompt),
    } : undefined,
    bootstrap_state: hasBootstrapState === true ? {
      schema_version: getWorkspaceNormalizedText(bootstrapState.schema_version),
      status: getWorkspaceNormalizedText(bootstrapState.status),
      template_id: getWorkspaceNormalizedText(bootstrapState.template_id),
      project_type: getWorkspaceNormalizedText(bootstrapState.project_type),
      required_decisions: normalizeWorkspaceBootstrapDecisionItems(bootstrapState.required_decisions),
      reserved_extensions: normalizeWorkspaceBootstrapDecisionItems(bootstrapState.reserved_extensions),
      deferred_decisions: normalizeWorkspaceBootstrapDecisionItems(bootstrapState.deferred_decisions),
      blockers: normalizeWorkspaceStringList(bootstrapState.blockers),
      next_action: getWorkspaceNormalizedText(bootstrapState.next_action),
      approval_required: bootstrapState.approval_required === true,
      foundation_risk_level: normalizeWorkspaceFoundationRiskLevel(bootstrapState.foundation_risk_level),
      gate_result: normalizeWorkspaceGateResult(bootstrapGateResult),
    } : undefined,
    deletion_recovery: hasDeletionRecovery === true ? {
      status: getWorkspaceNormalizedText(deletionRecovery.status),
      reason_code: getWorkspaceNormalizedText(deletionRecovery.reason_code),
      reason_message: getWorkspaceNormalizedText(deletionRecovery.reason_message),
      cleanup_scope: normalizeWorkspaceStringList(deletionRecovery.cleanup_scope),
    } : undefined,
  };

  const hasSnapshot = hasWorkspaceEngineeringStateSnapshot(snapshot);
  if (hasSnapshot === false) {
    return undefined;
  }

  return snapshot;
}
