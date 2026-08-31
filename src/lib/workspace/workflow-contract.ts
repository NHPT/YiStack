export const WORKSPACE_BACKEND_WORKFLOW_STAGES = [
  'bootstrap',
  'bootstrap_review',
  'bootstrap_confirmed',
  'plan-analysis',
  'plan-selection',
  'plan-approved',
  'implement',
] as const;

export const WORKSPACE_FRONTEND_LOCAL_WORKFLOW_STAGES = [
  'git-restore',
  'runtime-readiness',
] as const;

export const WORKSPACE_WORKFLOW_STAGES = [
  ...WORKSPACE_BACKEND_WORKFLOW_STAGES,
  ...WORKSPACE_FRONTEND_LOCAL_WORKFLOW_STAGES,
] as const;

export const WORKSPACE_WORKFLOW_MODES = [
  'foundation',
  'plan',
  'discuss',
  'implement',
] as const;

export const WORKSPACE_ENGINEERING_STATUSES = [
  'pending',
  'running',
  'passed',
  'failed',
  'not_applicable',
] as const;

export const WORKSPACE_BACKEND_EXECUTION_PAUSE_REASONS = [
  'awaiting_foundation_confirmation',
  'awaiting_plan_confirmation',
  'capability_execution_blocked',
  'context_gate_blocked',
  'foundation_gate_blocked',
  'browser_acceptance_failed',
  'generation_command_failed',
  'generation_file_conflict',
  'generation_failed',
  'generation_schema_invalid',
  'plan_generation_failed',
  'project_validation_failed',
  'repair_budget_exhausted',
  'repair_repeated_failure',
  'repair_result_invalid',
  'validation_gate_blocked',
] as const;

export const WORKSPACE_FRONTEND_LOCAL_EXECUTION_PAUSE_REASONS = [
  'branch_compare_file_apply_blocked',
  'branch_compare_file_apply_failed',
  'branch_compare_file_apply_post_sync_failed',
  'commit_file_restore_failed',
  'commit_restore_failed',
  'git_branch_create_blocked',
  'git_branch_create_failed',
  'git_branch_create_from_remote_blocked',
  'git_branch_create_from_remote_failed',
  'git_branch_create_from_remote_post_sync_failed',
  'git_branch_create_post_sync_failed',
  'git_branch_delete_blocked',
  'git_branch_delete_failed',
  'git_branch_delete_post_sync_failed',
  'git_branch_rename_blocked',
  'git_branch_rename_failed',
  'git_branch_rename_post_sync_failed',
  'git_branch_switch_blocked',
  'git_branch_switch_failed',
  'git_branch_switch_post_sync_failed',
  'git_stash_apply_blocked',
  'git_stash_apply_failed',
  'git_stash_apply_post_sync_failed',
  'git_stash_create_blocked',
  'git_stash_create_failed',
  'git_stash_create_post_sync_failed',
  'git_tag_create_blocked',
  'git_tag_create_failed',
  'git_tag_create_post_sync_failed',
  'git_tag_delete_blocked',
  'git_tag_delete_failed',
  'git_tag_delete_post_sync_failed',
  'git_remote_branch_refresh_blocked',
  'git_remote_branch_refresh_failed',
  'git_remote_branch_refresh_post_sync_failed',
  'plan_implementation_launch_failed',
  'runtime_readiness_failed',
  'worktree_commit_blocked',
  'worktree_commit_failed',
  'worktree_commit_post_sync_failed',
  'worktree_commit_record_sync_failed',
  'worktree_file_discard_blocked',
  'worktree_file_discard_failed',
  'worktree_file_discard_post_sync_failed',
  'workspace_file_operation_step_failed',
] as const;

export const WORKSPACE_EXECUTION_PAUSE_REASONS = [
  ...WORKSPACE_BACKEND_EXECUTION_PAUSE_REASONS,
  ...WORKSPACE_FRONTEND_LOCAL_EXECUTION_PAUSE_REASONS,
] as const;

export const WORKSPACE_BACKEND_APPROVAL_BOUNDARIES = [
  'approved_plan',
  'capability_provider_runner',
  'context_governance',
  'foundation',
  'foundation_confirmed',
  'foundation_review',
  'generation',
  'implementation',
  'plan_generation',
  'plan_selection',
  'validation_gate',
] as const;

export const WORKSPACE_FRONTEND_LOCAL_APPROVAL_BOUNDARIES = [
  'git_branch_create',
  'git_branch_create_from_remote',
  'git_branch_create_from_remote_sync',
  'git_branch_create_sync',
  'git_branch_delete',
  'git_branch_delete_sync',
  'git_branch_rename',
  'git_branch_rename_sync',
  'git_branch_switch',
  'git_branch_switch_sync',
  'git_remote_branch_refresh',
  'git_remote_branch_refresh_sync',
  'git_restore',
  'git_worktree_commit',
  'git_worktree_commit_sync',
  'git_tag_create',
  'git_tag_create_sync',
  'git_tag_delete',
  'git_tag_delete_sync',
  'runtime_recovery',
] as const;

export const WORKSPACE_APPROVAL_BOUNDARIES = [
  ...WORKSPACE_BACKEND_APPROVAL_BOUNDARIES,
  ...WORKSPACE_FRONTEND_LOCAL_APPROVAL_BOUNDARIES,
] as const;

export type WorkspaceBackendWorkflowStage =
  | 'bootstrap'
  | 'bootstrap_review'
  | 'bootstrap_confirmed'
  | 'plan-analysis'
  | 'plan-selection'
  | 'plan-approved'
  | 'implement';
export type WorkspaceBackendWorkflowStageList = readonly WorkspaceBackendWorkflowStage[];
export type WorkspaceFrontendLocalWorkflowStage =
  | 'git-restore'
  | 'runtime-readiness';
export type WorkspaceWorkflowStage = WorkspaceBackendWorkflowStage | WorkspaceFrontendLocalWorkflowStage;
export type WorkspaceWorkflowStageList = readonly WorkspaceWorkflowStage[];
export type WorkspaceWorkflowMode =
  | 'foundation'
  | 'plan'
  | 'discuss'
  | 'implement';
export type WorkspaceWorkflowModeList = readonly WorkspaceWorkflowMode[];
export type WorkspaceEngineeringStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'not_applicable';
export type WorkspaceEngineeringStatusList = readonly WorkspaceEngineeringStatus[];
export type WorkspaceExecutionPauseReason =
  | 'awaiting_foundation_confirmation'
  | 'awaiting_plan_confirmation'
  | 'branch_compare_file_apply_blocked'
  | 'branch_compare_file_apply_failed'
  | 'branch_compare_file_apply_post_sync_failed'
  | 'capability_execution_blocked'
  | 'commit_file_restore_failed'
  | 'commit_restore_failed'
  | 'context_gate_blocked'
  | 'foundation_gate_blocked'
  | 'browser_acceptance_failed'
  | 'generation_command_failed'
  | 'generation_file_conflict'
  | 'generation_failed'
  | 'generation_schema_invalid'
  | 'git_branch_create_blocked'
  | 'git_branch_create_failed'
  | 'git_branch_create_from_remote_blocked'
  | 'git_branch_create_from_remote_failed'
  | 'git_branch_create_from_remote_post_sync_failed'
  | 'git_branch_create_post_sync_failed'
  | 'git_branch_delete_blocked'
  | 'git_branch_delete_failed'
  | 'git_branch_delete_post_sync_failed'
  | 'git_branch_rename_blocked'
  | 'git_branch_rename_failed'
  | 'git_branch_rename_post_sync_failed'
  | 'git_branch_switch_blocked'
  | 'git_branch_switch_failed'
  | 'git_branch_switch_post_sync_failed'
  | 'git_remote_branch_refresh_blocked'
  | 'git_remote_branch_refresh_failed'
  | 'git_remote_branch_refresh_post_sync_failed'
  | 'git_stash_apply_blocked'
  | 'git_stash_apply_failed'
  | 'git_stash_apply_post_sync_failed'
  | 'git_stash_create_blocked'
  | 'git_stash_create_failed'
  | 'git_stash_create_post_sync_failed'
  | 'git_tag_create_blocked'
  | 'git_tag_create_failed'
  | 'git_tag_create_post_sync_failed'
  | 'git_tag_delete_blocked'
  | 'git_tag_delete_failed'
  | 'git_tag_delete_post_sync_failed'
  | 'plan_generation_failed'
  | 'plan_implementation_launch_failed'
  | 'project_validation_failed'
  | 'repair_budget_exhausted'
  | 'repair_repeated_failure'
  | 'repair_result_invalid'
  | 'runtime_readiness_failed'
  | 'validation_gate_blocked'
  | 'worktree_commit_blocked'
  | 'worktree_commit_failed'
  | 'worktree_commit_post_sync_failed'
  | 'worktree_commit_record_sync_failed'
  | 'worktree_file_discard_blocked'
  | 'worktree_file_discard_failed'
  | 'worktree_file_discard_post_sync_failed'
  | 'workspace_file_operation_step_failed';
export type WorkspaceExecutionPauseReasonList = readonly WorkspaceExecutionPauseReason[];
export type WorkspaceApprovalBoundary =
  | 'approved_plan'
  | 'capability_provider_runner'
  | 'context_governance'
  | 'foundation'
  | 'foundation_confirmed'
  | 'foundation_review'
  | 'generation'
  | 'implementation'
  | 'git_branch_create'
  | 'git_branch_create_from_remote'
  | 'git_branch_create_from_remote_sync'
  | 'git_branch_create_sync'
  | 'git_branch_delete'
  | 'git_branch_delete_sync'
  | 'git_branch_rename'
  | 'git_branch_rename_sync'
  | 'git_branch_switch'
  | 'git_branch_switch_sync'
  | 'git_remote_branch_refresh'
  | 'git_remote_branch_refresh_sync'
  | 'git_restore'
  | 'git_tag_create'
  | 'git_tag_create_sync'
  | 'git_tag_delete'
  | 'git_tag_delete_sync'
  | 'git_worktree_commit'
  | 'git_worktree_commit_sync'
  | 'plan_generation'
  | 'plan_selection'
  | 'runtime_recovery'
  | 'validation_gate';
export type WorkspaceApprovalBoundaryList = readonly WorkspaceApprovalBoundary[];

export type WorkspaceBackendWorkflowStageModeMap = {
  [stage in WorkspaceBackendWorkflowStage]: WorkspaceWorkflowMode;
};

export type WorkspaceWorkflowStageDefinition = {
  stage: WorkspaceBackendWorkflowStage;
  defaultMode: WorkspaceWorkflowMode;
  autoProgressEnabled: boolean;
  approvalBoundary: WorkspaceApprovalBoundary;
};

export type WorkspaceWorkflowStageDefinitionList = readonly WorkspaceWorkflowStageDefinition[];

export type WorkspaceFrontendLocalWorkflowStageSourceMap = {
  [stage in WorkspaceFrontendLocalWorkflowStage]: string;
};

export type WorkspaceWorkflowStageLabelMap = {
  [stage in WorkspaceWorkflowStage]: string;
};

export type WorkspaceExecutionPauseReasonLabelMap = {
  [reason in WorkspaceExecutionPauseReason]: string;
};

export type WorkspaceApprovalBoundaryLabelMap = {
  [boundary in WorkspaceApprovalBoundary]: string;
};

export const WORKSPACE_BACKEND_WORKFLOW_STAGE_MODE_MAP: WorkspaceBackendWorkflowStageModeMap = {
  bootstrap: 'foundation',
  bootstrap_review: 'foundation',
  bootstrap_confirmed: 'foundation',
  'plan-analysis': 'plan',
  'plan-selection': 'discuss',
  'plan-approved': 'implement',
  implement: 'implement',
};

export const WORKSPACE_WORKFLOW_STAGE_DEFINITIONS: WorkspaceWorkflowStageDefinitionList = [
  {
    stage: 'bootstrap',
    defaultMode: 'foundation',
    autoProgressEnabled: false,
    approvalBoundary: 'foundation',
  },
  {
    stage: 'bootstrap_review',
    defaultMode: 'foundation',
    autoProgressEnabled: false,
    approvalBoundary: 'foundation_review',
  },
  {
    stage: 'bootstrap_confirmed',
    defaultMode: 'foundation',
    autoProgressEnabled: true,
    approvalBoundary: 'foundation_confirmed',
  },
  {
    stage: 'plan-analysis',
    defaultMode: 'plan',
    autoProgressEnabled: true,
    approvalBoundary: 'plan_generation',
  },
  {
    stage: 'plan-selection',
    defaultMode: 'discuss',
    autoProgressEnabled: false,
    approvalBoundary: 'plan_selection',
  },
  {
    stage: 'plan-approved',
    defaultMode: 'implement',
    autoProgressEnabled: true,
    approvalBoundary: 'approved_plan',
  },
  {
    stage: 'implement',
    defaultMode: 'implement',
    autoProgressEnabled: true,
    approvalBoundary: 'implementation',
  },
] as const;

export const WORKSPACE_FRONTEND_LOCAL_WORKFLOW_STAGE_SOURCES: WorkspaceFrontendLocalWorkflowStageSourceMap = {
  'git-restore': 'src/app/workspace/use-workspace-resource-operations.ts',
  'runtime-readiness': 'src/app/workspace/use-workspace-runtime-resources.ts',
};

export const WORKSPACE_WORKFLOW_STAGE_LABELS: WorkspaceWorkflowStageLabelMap = {
  bootstrap: '项目基础设定',
  bootstrap_review: '基础设定确认',
  bootstrap_confirmed: '基础设定已确认',
  'plan-analysis': '方案分析',
  'plan-selection': '方案选择',
  'plan-approved': '已批准方案',
  implement: '实现阶段',
  'git-restore': '版本恢复',
  'runtime-readiness': '运行时准备',
};

export const WORKSPACE_EXECUTION_PAUSE_REASON_LABELS: WorkspaceExecutionPauseReasonLabelMap = {
  awaiting_foundation_confirmation: '等待基础设定确认',
  awaiting_plan_confirmation: '等待方案确认',
  branch_compare_file_apply_blocked: '分支对比文件引入被阻断',
  branch_compare_file_apply_failed: '分支对比文件引入失败',
  branch_compare_file_apply_post_sync_failed: '分支对比文件引入后同步失败',
  capability_execution_blocked: '能力执行阻断',
  commit_file_restore_failed: '单文件版本恢复失败',
  commit_restore_failed: '版本恢复失败',
  context_gate_blocked: '上下文门禁阻断',
  foundation_gate_blocked: '基础设定门禁阻断',
  browser_acceptance_failed: '浏览器验收失败',
  generation_command_failed: '生成命令执行失败',
  generation_file_conflict: '生成文件操作冲突',
  generation_failed: '生成阶段失败',
  generation_schema_invalid: '生成结果协议校验失败',
  git_branch_create_blocked: 'Git 分支创建被阻断',
  git_branch_create_failed: 'Git 分支创建失败',
  git_branch_create_from_remote_blocked: 'Git 远端引用创建本地分支被阻断',
  git_branch_create_from_remote_failed: 'Git 远端引用创建本地分支失败',
  git_branch_create_from_remote_post_sync_failed: 'Git 远端引用创建本地分支后同步失败',
  git_branch_create_post_sync_failed: 'Git 分支创建后同步失败',
  git_branch_delete_blocked: 'Git 分支删除被阻断',
  git_branch_delete_failed: 'Git 分支删除失败',
  git_branch_delete_post_sync_failed: 'Git 分支删除后同步失败',
  git_branch_rename_blocked: 'Git 分支重命名被阻断',
  git_branch_rename_failed: 'Git 分支重命名失败',
  git_branch_rename_post_sync_failed: 'Git 分支重命名后同步失败',
  git_branch_switch_blocked: 'Git 分支切换被阻断',
  git_branch_switch_failed: 'Git 分支切换失败',
  git_branch_switch_post_sync_failed: 'Git 分支切换后同步失败',
  git_stash_apply_blocked: 'Git stash 应用被阻断',
  git_stash_apply_failed: 'Git stash 应用失败',
  git_stash_apply_post_sync_failed: 'Git stash 应用后同步失败',
  git_stash_create_blocked: 'Git stash 创建被阻断',
  git_stash_create_failed: 'Git stash 创建失败',
  git_stash_create_post_sync_failed: 'Git stash 创建后同步失败',
  git_tag_create_blocked: 'Git 标签创建被阻断',
  git_tag_create_failed: 'Git 标签创建失败',
  git_tag_create_post_sync_failed: 'Git 标签创建后同步失败',
  git_tag_delete_blocked: 'Git 标签删除被阻断',
  git_tag_delete_failed: 'Git 标签删除失败',
  git_tag_delete_post_sync_failed: 'Git 标签删除后同步失败',
  git_remote_branch_refresh_blocked: 'Git 远端引用刷新被阻断',
  git_remote_branch_refresh_failed: 'Git 远端引用刷新失败',
  git_remote_branch_refresh_post_sync_failed: 'Git 远端引用刷新后同步失败',
  plan_implementation_launch_failed: '方案进入实现失败',
  plan_generation_failed: '方案生成失败',
  project_validation_failed: '生成项目质量校验失败',
  repair_budget_exhausted: '自动修复预算已耗尽',
  repair_repeated_failure: '自动修复未改变失败原因',
  repair_result_invalid: '自动修复结果无效',
  runtime_readiness_failed: '运行时准备失败',
  validation_gate_blocked: '校验门禁阻断',
  worktree_commit_blocked: 'Git worktree 提交被阻断',
  worktree_commit_failed: 'Git worktree 提交失败',
  worktree_commit_post_sync_failed: 'Git worktree 提交后同步失败',
  worktree_commit_record_sync_failed: 'Git worktree 提交记录同步失败',
  worktree_file_discard_blocked: 'Git worktree 文件丢弃被阻断',
  worktree_file_discard_failed: 'Git worktree 文件丢弃失败',
  worktree_file_discard_post_sync_failed: 'Git worktree 文件丢弃后同步失败',
  workspace_file_operation_step_failed: '文件操作步骤失败',
};

export const WORKSPACE_APPROVAL_BOUNDARY_LABELS: WorkspaceApprovalBoundaryLabelMap = {
  approved_plan: '当前已批准方案',
  capability_provider_runner: '能力 Provider Runner',
  context_governance: '上下文治理',
  foundation: '基础设定',
  foundation_confirmed: '基础设定已确认',
  foundation_review: '基础设定确认',
  generation: '生成阶段',
  implementation: '实现阶段',
  git_branch_create: 'Git 分支创建',
  git_branch_create_from_remote: 'Git 远端引用创建本地分支',
  git_branch_create_from_remote_sync: 'Git 远端引用创建本地分支后同步',
  git_branch_create_sync: 'Git 分支创建后同步',
  git_branch_delete: 'Git 分支删除',
  git_branch_delete_sync: 'Git 分支删除后同步',
  git_branch_rename: 'Git 分支重命名',
  git_branch_rename_sync: 'Git 分支重命名后同步',
  git_branch_switch: 'Git 分支切换',
  git_branch_switch_sync: 'Git 分支切换后同步',
  git_remote_branch_refresh: 'Git 远端引用刷新',
  git_remote_branch_refresh_sync: 'Git 远端引用刷新后同步',
  git_restore: 'Git 版本恢复',
  git_worktree_commit: 'Git worktree 提交',
  git_worktree_commit_sync: 'Git worktree 提交后同步',
  git_tag_create: 'Git 标签创建',
  git_tag_create_sync: 'Git 标签创建后同步',
  git_tag_delete: 'Git 标签删除',
  git_tag_delete_sync: 'Git 标签删除后同步',
  plan_generation: '方案生成',
  plan_selection: '方案选择',
  runtime_recovery: '运行时恢复',
  validation_gate: 'YES 校验门禁',
};

function hasWorkspaceWorkflowContractTextValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

export function getWorkspaceWorkflowStageDefinition(
  stage: string,
): WorkspaceWorkflowStageDefinition | undefined {
  if (isWorkspaceBackendWorkflowStage(stage) === false) {
    return undefined;
  }

  for (const definition of WORKSPACE_WORKFLOW_STAGE_DEFINITIONS) {
    if (definition.stage === stage) {
      return definition;
    }
  }

  return undefined;
}

export function getWorkspaceWorkflowStageDefaultMode(stage: string): WorkspaceWorkflowMode | undefined {
  const definition = getWorkspaceWorkflowStageDefinition(stage);
  if (definition === undefined) {
    return undefined;
  }

  return definition.defaultMode;
}

export function getWorkspaceWorkflowStageAutoProgressEnabled(stage: string): boolean | undefined {
  const definition = getWorkspaceWorkflowStageDefinition(stage);
  if (definition === undefined) {
    return undefined;
  }

  return definition.autoProgressEnabled;
}

export function getWorkspaceWorkflowStageApprovalBoundary(stage: string): WorkspaceApprovalBoundary | undefined {
  const definition = getWorkspaceWorkflowStageDefinition(stage);
  if (definition === undefined) {
    return undefined;
  }

  return definition.approvalBoundary;
}

export function getWorkspaceWorkflowStageDefaultModeOrFallback(
  stage: string,
  fallback: WorkspaceWorkflowMode,
): WorkspaceWorkflowMode {
  const defaultMode = getWorkspaceWorkflowStageDefaultMode(stage);
  if (defaultMode === undefined) {
    return fallback;
  }

  return defaultMode;
}

export function getWorkspaceWorkflowStageAutoProgressEnabledOrFallback(
  stage: string,
  fallback: boolean,
): boolean {
  const autoProgressEnabled = getWorkspaceWorkflowStageAutoProgressEnabled(stage);
  if (autoProgressEnabled === undefined) {
    return fallback;
  }

  return autoProgressEnabled;
}

export function getWorkspaceWorkflowStageApprovalBoundaryOrFallback(
  stage: string,
  fallback: WorkspaceApprovalBoundary,
): WorkspaceApprovalBoundary {
  const approvalBoundary = getWorkspaceWorkflowStageApprovalBoundary(stage);
  if (approvalBoundary === undefined) {
    return fallback;
  }

  return approvalBoundary;
}

function getWorkspaceWorkflowStageDisplayLabel(stage: string): string {
  const definition = getWorkspaceWorkflowStageDefinition(stage);
  if (definition !== undefined) {
    return WORKSPACE_WORKFLOW_STAGE_LABELS[definition.stage];
  }

  const hasKnownWorkflowStage = isWorkspaceWorkflowStage(stage);
  if (hasKnownWorkflowStage === true) {
    return WORKSPACE_WORKFLOW_STAGE_LABELS[stage];
  }

  return stage;
}

function getWorkspaceExecutionPauseReasonDisplayLabel(reason: string): string {
  const hasKnownReason = isWorkspaceExecutionPauseReason(reason);

  if (hasKnownReason === true) {
    return WORKSPACE_EXECUTION_PAUSE_REASON_LABELS[reason];
  }

  return reason;
}

function getWorkspaceApprovalBoundaryDisplayLabel(boundary: string): string {
  const hasKnownBoundary = isWorkspaceApprovalBoundary(boundary);

  if (hasKnownBoundary === true) {
    return WORKSPACE_APPROVAL_BOUNDARY_LABELS[boundary];
  }

  return boundary;
}

export function formatWorkspaceWorkflowStage(stage?: string): string | undefined {
  const hasStage = hasWorkspaceWorkflowContractTextValue(stage);

  if (hasStage === false) {
    return undefined;
  }

  return getWorkspaceWorkflowStageDisplayLabel(stage);
}

export function formatWorkspaceExecutionPauseReason(reason?: string): string | undefined {
  const hasReason = hasWorkspaceWorkflowContractTextValue(reason);

  if (hasReason === false) {
    return undefined;
  }

  return getWorkspaceExecutionPauseReasonDisplayLabel(reason);
}

export function formatWorkspaceApprovalBoundary(boundary?: string): string | undefined {
  const hasBoundary = hasWorkspaceWorkflowContractTextValue(boundary);

  if (hasBoundary === false) {
    return undefined;
  }

  return getWorkspaceApprovalBoundaryDisplayLabel(boundary);
}

export function isWorkspaceWorkflowStage(raw: unknown): raw is WorkspaceWorkflowStage {
  return typeof raw === 'string'
    && (WORKSPACE_WORKFLOW_STAGES as WorkspaceWorkflowStageList).includes(raw as WorkspaceWorkflowStage);
}

export function isWorkspaceBackendWorkflowStage(raw: unknown): raw is WorkspaceBackendWorkflowStage {
  return typeof raw === 'string'
    && (WORKSPACE_BACKEND_WORKFLOW_STAGES as WorkspaceBackendWorkflowStageList).includes(raw as WorkspaceBackendWorkflowStage);
}

export function isWorkspaceWorkflowMode(raw: unknown): raw is WorkspaceWorkflowMode {
  return typeof raw === 'string'
    && (WORKSPACE_WORKFLOW_MODES as WorkspaceWorkflowModeList).includes(raw as WorkspaceWorkflowMode);
}

export function isWorkspaceEngineeringStatus(raw: unknown): raw is WorkspaceEngineeringStatus {
  return typeof raw === 'string'
    && (WORKSPACE_ENGINEERING_STATUSES as WorkspaceEngineeringStatusList).includes(raw as WorkspaceEngineeringStatus);
}

export function isWorkspaceExecutionPauseReason(raw: unknown): raw is WorkspaceExecutionPauseReason {
  return typeof raw === 'string'
    && (WORKSPACE_EXECUTION_PAUSE_REASONS as WorkspaceExecutionPauseReasonList).includes(raw as WorkspaceExecutionPauseReason);
}

export function isWorkspaceApprovalBoundary(raw: unknown): raw is WorkspaceApprovalBoundary {
  return typeof raw === 'string'
    && (WORKSPACE_APPROVAL_BOUNDARIES as WorkspaceApprovalBoundaryList).includes(raw as WorkspaceApprovalBoundary);
}
