'use client';

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  adminAuthApi,
  adminConfigApi,
  adminEnterpriseApi,
  adminAuditApi,
  adminCapabilityApi,
  adminPermissionsApi,
  adminProjectsApi,
  adminRolesApi,
  adminUsersApi,
  type AuditLog,
  type AdminPermission,
  type AdminProject,
  type AdminRole,
  type AdminUser,
  type AdminEnterpriseSsoDiscoveryReadinessResponse,
  type AdminEnterprisePrivateDeploymentReadinessResponse,
  type AdminEnterpriseCommercialReadinessResponse,
  type AdminEnterpriseMemberBindInput,
  type AdminEnterpriseMemberStatus,
  type AdminEnterpriseOrganization,
  type AdminEnterpriseOrganizationCreateInput,
  type AdminEnterpriseOrganizationReadinessResponse,
  type AdminEnterpriseOrganizationStatus,
  type AdminEnterpriseProjectOwnershipMapping,
  type AdminEnterpriseAuditCoverageReadinessResponse,
  type AdminEnterpriseAuditExportReadinessResponse,
  type AdminEnterpriseAuditExportQueryReadinessResponse,
  type AdminEnterpriseAuditExportTaskPreflightReadinessResponse,
  type AdminEnterpriseAuditExportFileFormatReadinessResponse,
  type AdminEnterpriseAuditExportFileGeneratorReadinessResponse,
  type AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse,
  type AdminEnterpriseAuditExportTask,
  type AdminEnterpriseAuditExportTaskListResult,
  type AdminEnterpriseAuditExportTaskPersistenceReadinessResponse,
  type AdminEnterpriseAuditExportTaskStatusTransitionInput,
  type AdminEnterpriseAuditExportTaskStatusTransitionResult,
  type AdminEnterpriseAuditExportWorkerReadinessResponse,
  type AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse,
  type AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse,
  type AdminEnterpriseAuditExportWorkerExecutionDryRunInput,
  type AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateInput,
  type AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateResult,
  type AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse,
  type AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse,
  type AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreInput,
  type AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreResult,
  type AdminEnterpriseAuditExportWorkerExecutionTaskCompletionInput,
  type AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse,
  type AdminEnterpriseAuditExportWorkerExecutionTaskCompletionResult,
  type AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse,
  type AdminEnterpriseAuditExportWorkerExecutionDryRunResult,
  type AdminEnterpriseAuditExportWorkerExecutionRequestPersistInput,
  type AdminEnterpriseAuditExportWorkerExecutionRequestPersistResult,
  type AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse,
  type AdminEnterpriseAuditExportArchiveExpirationReadinessResponse,
  type AdminEnterpriseAuditExportDeliveryReportReadinessResponse,
  type AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse,
  type AdminEnterpriseAuditExportDeliveryReportGenerateInput,
  type AdminEnterpriseAuditExportDeliveryReportGenerateResult,
  type AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse,
  type AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse,
  type AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse,
  type AdminEnterpriseAuditExportDeliveryReportStoreInput,
  type AdminEnterpriseAuditExportDeliveryReportStoreResult,
  type AdminEnterpriseAuditRetentionReadinessResponse,
  type AdminEnterpriseProjectAccessGuardActivationAuditPlanItem,
  type AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityIssue,
  type AdminEnterpriseProjectAccessGuardActivationAuditRecentEvent,
  type AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse,
  type AdminEnterpriseProjectAccessGuardActivationAuditRequiredEvent,
  type AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityIssue,
  type AdminEnterpriseProjectAccessGuardActivationExecutionInput,
  type AdminEnterpriseProjectAccessGuardActivationManualApprovalInput,
  type AdminEnterpriseProjectAccessGuardActivationBlockerCandidate,
  type AdminEnterpriseProjectAccessGuardActivationReadinessResponse,
  type AdminEnterpriseProjectAccessGuardActivationReviewItem,
  type AdminEnterpriseProjectAccessGuardAuthorizationActivationInput,
  type AdminEnterpriseProjectAccessGuardPostActivationValidationInput,
  type AdminEnterpriseProjectAccessGuardRollbackEvidenceInput,
  type AdminEnterpriseProjectAccessGuardAuthorizationDryRunDriftCandidate,
  type AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse,
  type AdminEnterpriseProjectAccessGuardSwitchReadinessResponse,
  type AdminEnterpriseProjectOwnershipOwnerGuardReadinessCandidate,
  type AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse,
  type AdminEnterpriseProjectOwnershipMigrateInput,
  type AdminEnterpriseProjectOwnershipMappingsResponse,
  type AdminEnterpriseProjectOwnershipPreflightCandidate,
  type AdminEnterpriseProjectOwnershipPreflightResponse,
  type AdminEnterpriseProjectOwnershipReadinessResponse,
  type AdminEnterpriseTeam,
  type AdminEnterpriseTeamCreateInput,
  type AdminEnterpriseTeamId,
  type AdminEnterpriseTeamStatus,
  type CapabilityProviderPreflightResponse,
  type SystemConfig,
} from '@/lib/admin/api';
import { getEnterpriseGovernanceDefinitionList } from '@/lib/admin/enterprise-governance-contract';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import {
  AdminEnterpriseGovernancePageSnapshotStrip,
  AdminEnterpriseMutationConfirmationSnapshotStrip,
  AdminEnterpriseGovernanceReadinessList,
  ADMIN_ENTERPRISE_SSO_CONFIG_KEYS,
  ADMIN_ENTERPRISE_SSO_REQUIRED_CONFIG_KEYS,
  buildAdminEnterpriseMutationConfirmationSnapshot,
  buildAdminEnterpriseSsoConfigValueMap,
  buildAdminEnterpriseGovernancePageSnapshot,
  buildAdminEnterpriseGovernanceReadinessItems,
  countConfiguredEnterpriseSsoConfigs,
  countConfiguredEnterpriseSsoRequiredConfigs,
  resolveAdminEnterpriseSsoReadinessStatus,
} from './admin-enterprise-governance-page-snapshot';
import type {
  AdminEnterpriseGovernanceReadinessInput,
  AdminEnterpriseMutationConfirmationInput,
} from './admin-enterprise-governance-page-snapshot';
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

type AdminEnterprisePendingMutation = AdminEnterpriseMutationConfirmationInput & {
  organizationCreateInput: AdminEnterpriseOrganizationCreateInput | null;
  teamCreateInput: AdminEnterpriseTeamCreateInput | null;
  memberBindInput: AdminEnterpriseMemberBindInput | null;
  projectOwnershipMigrateInput: AdminEnterpriseProjectOwnershipMigrateInput | null;
};

type EnterpriseGovernanceCoverageNodeList = ReactNode[];

function getEnterpriseGovernanceEntrypointLabel(entrypoints: readonly string[]): string {
  let label = '';
  for (const entrypoint of entrypoints) {
    if (label.length === 0) {
      label = entrypoint;
      continue;
    }

    label = `${label} / ${entrypoint}`;
  }

  return label;
}

function materializeEnterpriseGovernanceCoverageNodes(): EnterpriseGovernanceCoverageNodeList {
  const nodes: EnterpriseGovernanceCoverageNodeList = [];
  const definitions = getEnterpriseGovernanceDefinitionList();

  for (const definition of definitions) {
    const entrypointLabel = getEnterpriseGovernanceEntrypointLabel(definition.entrypoints);
    nodes.push(
      <div key={definition.domain} className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">{definition.title}</div>
            <div className="mt-1 text-gray-500 dark:text-gray-400">{definition.primarySurface}</div>
          </div>
          <span className="rounded-full border border-gray-200 px-2 py-0.5 font-mono text-[10px] dark:border-gray-700">
            {definition.domain}
          </span>
        </div>
        <p className="mt-2">Readiness：{definition.readinessSource}</p>
        <p className="mt-1">边界：{definition.controlledMutationBoundary}</p>
        <p className="mt-1">审计证据：{definition.auditEvidence}</p>
        <p className="mt-1">恢复：{definition.recovery}</p>
        <p className="mt-1 truncate font-mono text-[10px] text-gray-500 dark:text-gray-400">入口：{entrypointLabel}</p>
      </div>,
    );
  }

  return nodes;
}

const ADMIN_ENTERPRISE_AUDIT_COVERAGE_REQUIRED_SOURCE_COUNT = 2;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_REQUIRED_SOURCE_COUNT = 3;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_SAMPLE_LIMIT = 10;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_MAX_WINDOW = 1000;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_REQUIRED_SOURCE_COUNT = 4;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_SAMPLE_LIMIT = 25;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_MAX_WINDOW = 1000;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_REQUIRED_FILTER_FIELD_COUNT = 5;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_TASK_PREFLIGHT_REQUIRED_SOURCE_COUNT = 5;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_FILE_FORMAT_REQUIRED_SOURCE_COUNT = 6;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_FILE_GENERATOR_REQUIRED_SOURCE_COUNT = 7;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_TASK_CREATE_REQUEST_REQUIRED_SOURCE_COUNT = 8;
const ADMIN_ENTERPRISE_AUDIT_EXPORT_TASK_PERSISTENCE_REQUIRED_SOURCE_COUNT = 10;
const ADMIN_ENTERPRISE_AUDIT_RETENTION_REQUIRED_SOURCE_COUNT = 3;
const ADMIN_ENTERPRISE_AUDIT_RETENTION_MINIMUM_DAYS = 30;
const ADMIN_ENTERPRISE_AUDIT_RETENTION_MAXIMUM_DAYS = 3650;

function hasAdminEnterpriseProviderPreflightResponse(
  preflight: CapabilityProviderPreflightResponse | null,
): preflight is CapabilityProviderPreflightResponse {
  return preflight !== null;
}

function readProviderPreflightItemCount(preflight: CapabilityProviderPreflightResponse | null) {
  const hasProviderPreflight = hasAdminEnterpriseProviderPreflightResponse(preflight);
  if (hasProviderPreflight === false) {
    return 0;
  }
  return preflight.items.length;
}

function readProviderPreflightCount(
  preflight: CapabilityProviderPreflightResponse | null,
  status: 'blocked' | 'skipped',
) {
  const hasProviderPreflight = hasAdminEnterpriseProviderPreflightResponse(preflight);
  if (hasProviderPreflight === false) {
    return 0;
  }
  let count = 0;
  for (const item of preflight.items) {
    const hasTargetStatus = item.status === status;
    if (hasTargetStatus === true) {
      count += 1;
    }
  }
  return count;
}

function isEnterpriseSsoConfig(config: SystemConfig) {
  return ADMIN_ENTERPRISE_SSO_CONFIG_KEYS.includes(config.key);
}

const emptyOrganizationForm: AdminEnterpriseOrganizationCreateInput = {
  slug: '',
  display_name: '',
  status: 'active',
};

const emptyTeamForm: AdminEnterpriseTeamCreateInput = {
  organization_id: '',
  slug: '',
  display_name: '',
  status: 'active',
};

const emptyMemberForm: AdminEnterpriseMemberBindInput = {
  organization_id: '',
  team_id: '',
  user_id: '',
  status: 'active',
};

const emptyProjectOwnershipMigrationForm: AdminEnterpriseProjectOwnershipMigrateInput = {
  project_record_id: '',
  organization_id: '',
  team_id: '',
  confirm_migrate: false,
};

const emptyEnterpriseAuditExportDeliveryReportGenerateForm: AdminEnterpriseAuditExportDeliveryReportGenerateInput = {
  reason: '',
  idempotency_key: '',
  confirm_generate_report: false,
};

const emptyEnterpriseAuditExportDeliveryReportStoreForm: AdminEnterpriseAuditExportDeliveryReportStoreInput = {
  reason: '',
  idempotency_key: '',
  report_format: 'markdown',
  report_content: '',
  generated_at: '',
  confirm_store_report: false,
};

const emptyEnterpriseAuditExportTaskStatusTransitionForm: AdminEnterpriseAuditExportTaskStatusTransitionInput = {
  task_id: '',
  target_status: 'processing',
  reason: '',
  confirm_status_transition: false,
};

const emptyEnterpriseAuditExportWorkerExecutionRequestPersistForm: AdminEnterpriseAuditExportWorkerExecutionRequestPersistInput = {
  task_id: '',
  reason: '',
  idempotency_key: '',
  batch_limit: 10,
  confirm_worker_execution: false,
};

const emptyEnterpriseAuditExportWorkerExecutionDryRunForm: AdminEnterpriseAuditExportWorkerExecutionDryRunInput = {
  request_id: '',
  reason: '',
  confirm_worker_execution_dry_run: false,
};

const emptyEnterpriseAuditExportWorkerExecutionArtifactForm: AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateInput = {
  request_id: '',
  reason: '',
  confirm_worker_execution_artifact: false,
};

const emptyEnterpriseAuditExportWorkerExecutionOutputStorageForm: AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreInput = {
  request_id: '',
  reason: '',
  confirm_worker_execution_output_storage: false,
};

const emptyEnterpriseAuditExportWorkerExecutionTaskCompletionForm: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionInput = {
  request_id: '',
  reason: '',
  confirm_worker_execution_task_completion: false,
};

function hasEnterpriseOrganizationFormValue(value: string) {
  return value.trim() !== '';
}

function getAdminEnterpriseOrganizationCount(organizations: readonly AdminEnterpriseOrganization[]): number {
  const hasOrganizationList = Array.isArray(organizations) === true;
  return hasOrganizationList === true ? organizations.length : 0;
}

function getAdminEnterpriseTeamCount(teams: readonly AdminEnterpriseTeam[]): number {
  const hasTeamList = Array.isArray(teams) === true;
  return hasTeamList === true ? teams.length : 0;
}

function getAdminEnterpriseUserCount(users: readonly AdminUser[]): number {
  const hasUserList = Array.isArray(users) === true;
  return hasUserList === true ? users.length : 0;
}

function hasEnterpriseOrganizations(organizations: readonly AdminEnterpriseOrganization[]) {
  const organizationCount = getAdminEnterpriseOrganizationCount(organizations);
  const hasOrganizations = Array.isArray(organizations) === true && organizationCount > 0;
  return hasOrganizations === true;
}

function hasEnterpriseTeams(teams: readonly AdminEnterpriseTeam[]) {
  const teamCount = getAdminEnterpriseTeamCount(teams);
  const hasTeams = Array.isArray(teams) === true && teamCount > 0;
  return hasTeams === true;
}

function hasEnterpriseUsers(users: readonly AdminUser[]) {
  const userCount = getAdminEnterpriseUserCount(users);
  const hasUsers = Array.isArray(users) === true && userCount > 0;
  return hasUsers === true;
}

function getAdminEnterprisePageBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function shouldRenderAdminEnterprisePageError(error: string): boolean {
  const hasError = error.length > 0;
  return hasError === true;
}

function shouldRenderAdminEnterpriseFormMessage(message: string): boolean {
  const hasMessage = hasEnterpriseOrganizationFormValue(message);
  return hasMessage === true;
}

function getAdminEnterpriseOrganizationCreateActionLabel(creating: boolean): string {
  return creating === true ? '创建中...' : '创建组织';
}

function getAdminEnterpriseTeamCreateActionLabel(creating: boolean): string {
  return creating === true ? '创建中...' : '创建团队';
}

function getAdminEnterpriseMemberBindActionLabel(binding: boolean): string {
  return binding === true ? '绑定中...' : '绑定成员';
}

function getAdminEnterpriseProjectOwnershipMigrationActionLabel(migrating: boolean): string {
  return migrating === true ? '迁移中...' : '写入映射';
}

function getAdminEnterpriseProjectAccessGuardActivationManualApprovalActionLabel(submitting: boolean): string {
  return submitting === true ? '记录中...' : '记录 manual approval';
}

function getAdminEnterpriseProjectAccessGuardActivationExecutionActionLabel(submitting: boolean): string {
  return submitting === true ? '记录中...' : '记录 activation execution';
}

function getAdminEnterpriseProjectAccessGuardPostActivationValidationActionLabel(submitting: boolean): string {
  return submitting === true ? '记录中...' : '记录 post-activation validation';
}

function getAdminEnterpriseProjectAccessGuardRollbackEvidenceActionLabel(submitting: boolean): string {
  return submitting === true ? '记录中...' : '记录 rollback evidence';
}

function getAdminEnterpriseProjectAccessGuardAuthorizationActivationActionLabel(submitting: boolean): string {
  return submitting === true ? '激活中...' : '受控激活 enterprise authorization';
}

function getAdminEnterpriseAuditExportDeliveryReportGenerateActionLabel(submitting: boolean): string {
  return submitting === true ? '生成中...' : '生成内存交付报告';
}

function getAdminEnterpriseAuditExportDeliveryReportStoreActionLabel(submitting: boolean): string {
  return submitting === true ? '存储中...' : '受控存储交付报告';
}

function getAdminEnterpriseAuditExportTaskStatusTransitionActionLabel(submitting: boolean): string {
  return submitting === true ? '转移中...' : '受控转移任务状态';
}

function getAdminEnterpriseAuditExportWorkerExecutionRequestPersistActionLabel(submitting: boolean): string {
  return submitting === true ? '持久化中...' : '受控持久化执行请求';
}

function getAdminEnterpriseAuditExportWorkerExecutionDryRunActionLabel(submitting: boolean): string {
  return submitting === true ? 'Dry-run 写入中...' : '受控写入 dry-run 结果';
}

function getAdminEnterpriseAuditExportWorkerExecutionArtifactActionLabel(submitting: boolean): string {
  return submitting === true ? 'Artifact 生成中...' : '受控生成 artifact snapshot';
}

function getAdminEnterpriseAuditExportWorkerExecutionOutputStorageActionLabel(submitting: boolean): string {
  return submitting === true ? 'Storage 写入中...' : '受控写入 output storage metadata';
}

function getAdminEnterpriseAuditExportWorkerExecutionTaskCompletionActionLabel(submitting: boolean): string {
  return submitting === true ? '完成推进中...' : '受控推进 task completed';
}

function hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardActivationReadinessResponse {
  return readiness !== null
    && readiness.status === 'ready_to_activate'
    && readiness.can_activate_enterprise_owned === true
    && readiness.current_mode === 'legacy_user_owned'
    && readiness.target_mode === 'enterprise_owned'
    && readiness.enterprise_authorization_active === false
    && readiness.blocker_candidates.length === 0;
}

function hasAdminEnterpriseProjectAccessGuardActivationManualApprovalEvidence(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardActivationReadinessResponse {
  if (readiness === null) {
    return false;
  }
  for (const item of readiness.audit_plan_items) {
    if (item.source === 'manual_approval' && item.status === 'evidence_ready') {
      return true;
    }
  }
  return false;
}

function hasAdminEnterpriseProjectAccessGuardActivationExecutionEvidence(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardActivationReadinessResponse {
  if (readiness === null) {
    return false;
  }
  for (const item of readiness.audit_plan_items) {
    if (item.source === 'activation_execution' && item.status === 'evidence_ready') {
      return true;
    }
  }
  return false;
}

function hasAdminEnterpriseProjectAccessGuardPostActivationValidationEvidence(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardActivationReadinessResponse {
  if (readiness === null) {
    return false;
  }
  for (const item of readiness.audit_plan_items) {
    if (item.source === 'post_activation_access_validation' && item.status === 'evidence_ready') {
      return true;
    }
  }
  return false;
}

function hasAdminEnterpriseProjectAccessGuardRollbackEvidence(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardActivationReadinessResponse {
  if (readiness === null) {
    return false;
  }
  for (const item of readiness.audit_plan_items) {
    if (item.source === 'rollback_evidence' && item.status === 'evidence_ready') {
      return true;
    }
  }
  return false;
}

function getAdminEnterpriseMutationConfirmationDescription(
  pendingMutation: AdminEnterprisePendingMutation | null,
): string {
  const hasPendingMutation = pendingMutation !== null;
  return hasPendingMutation === true ? pendingMutation.summary : '确认当前企业治理写入。';
}

function getAdminEnterpriseMutationConfirmationActionLabel(submitting: boolean): string {
  return submitting === true ? '执行中...' : '确认写入';
}

function hasAdminEnterpriseProjectOwnershipPreflightCandidates(
  preflight: AdminEnterpriseProjectOwnershipPreflightResponse,
): boolean {
  const hasCandidates = preflight.candidates.length > 0;
  return hasCandidates === true;
}

function shouldRenderAdminEnterpriseProjectOwnershipPreflightCandidates(
  preflight: AdminEnterpriseProjectOwnershipPreflightResponse,
): boolean {
  return hasAdminEnterpriseProjectOwnershipPreflightCandidates(preflight);
}

function shouldRenderAdminEnterpriseProjectOwnershipPreflightEmpty(
  preflight: AdminEnterpriseProjectOwnershipPreflightResponse,
): boolean {
  const hasCandidates = hasAdminEnterpriseProjectOwnershipPreflightCandidates(preflight);
  return hasCandidates === false;
}

function shouldRenderAdminEnterpriseProjectOwnershipPreflightPending(
  preflight: AdminEnterpriseProjectOwnershipPreflightResponse | null,
): boolean {
  return preflight === null;
}

function shouldRenderAdminEnterpriseProjectOwnershipPreflightContent(
  preflight: AdminEnterpriseProjectOwnershipPreflightResponse | null,
): preflight is AdminEnterpriseProjectOwnershipPreflightResponse {
  return preflight !== null;
}

function shouldRenderAdminEnterpriseProjectOwnershipMappings(
  mappings: AdminEnterpriseProjectOwnershipMappingsResponse,
): boolean {
  const hasMappings = mappings.mappings.length > 0;
  return hasMappings === true;
}

function shouldRenderAdminEnterpriseProjectOwnershipMappingsPending(
  mappings: AdminEnterpriseProjectOwnershipMappingsResponse | null,
): boolean {
  return mappings === null;
}

function shouldRenderAdminEnterpriseProjectOwnershipMappingsContent(
  mappings: AdminEnterpriseProjectOwnershipMappingsResponse | null,
): mappings is AdminEnterpriseProjectOwnershipMappingsResponse {
  return mappings !== null;
}

function shouldRenderAdminEnterpriseProjectOwnershipOwnerGuardUnmappedProjects(
  readiness: AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse,
): boolean {
  const hasUnmappedProjects = readiness.unmapped_projects.length > 0;
  return hasUnmappedProjects === true;
}

function shouldRenderAdminEnterpriseProjectOwnershipOwnerGuardPending(
  readiness: AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseProjectOwnershipOwnerGuardContent(
  readiness: AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse | null,
): readiness is AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardSwitchPending(
  readiness: AdminEnterpriseProjectAccessGuardSwitchReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardSwitchContent(
  readiness: AdminEnterpriseProjectAccessGuardSwitchReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardSwitchReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardDryRunDriftCandidates(
  evidence: AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse,
): boolean {
  const hasDriftCandidates = evidence.drift_candidates.length > 0;
  return hasDriftCandidates === true;
}

function shouldRenderAdminEnterpriseProjectAccessGuardDryRunPending(
  evidence: AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse | null,
): boolean {
  return evidence === null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardDryRunContent(
  evidence: AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse | null,
): evidence is AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse {
  return evidence !== null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationPending(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationContent(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardActivationReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditPlanItems(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse,
): boolean {
  const hasAuditPlanItems = readiness.audit_plan_items.length > 0;
  return hasAuditPlanItems === true;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationReviewItems(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse,
): boolean {
  const hasReviewItems = readiness.review_items.length > 0;
  return hasReviewItems === true;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationBlockerCandidates(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse,
): boolean {
  const hasBlockerCandidates = readiness.blocker_candidates.length > 0;
  return hasBlockerCandidates === true;
}

function getAdminEnterprisePageDisplayLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== undefined && value !== null && value.length > 0;
  return hasValue === true ? value : fallback;
}

function materializeAdminEnterpriseProjectAccessGuardActivationAuditPlanItemNodes(
  items: AdminEnterpriseProjectAccessGuardActivationAuditPlanItem[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    nodes.push(
      <tr key={`${item.source}:${item.status}`}>
        <td className="py-2 pr-4 font-mono">{item.source}</td>
        <td className="py-2 pr-4 font-mono">{item.status}</td>
        <td className="py-2 pr-4">{item.message}</td>
        <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{item.recovery}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectAccessGuardActivationReviewItemNodes(
  items: AdminEnterpriseProjectAccessGuardActivationReviewItem[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    nodes.push(
      <tr key={`${item.source}:${item.status}`}>
        <td className="py-2 pr-4 font-mono">{item.source}</td>
        <td className="py-2 pr-4 font-mono">{item.status}</td>
        <td className="py-2 pr-4">{item.message}</td>
        <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{item.recovery}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectAccessGuardActivationBlockerCandidateNodes(
  candidates: AdminEnterpriseProjectAccessGuardActivationBlockerCandidate[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const candidate of candidates) {
    const projectNameLabel = getAdminEnterprisePageDisplayLabel(candidate.project_name, '-');
    const projectIdLabel = getAdminEnterprisePageDisplayLabel(candidate.project_id, '-');
    const ownerUserIdLabel = getAdminEnterprisePageDisplayLabel(candidate.owner_user_id, '-');

    nodes.push(
      <tr key={`${candidate.source}:${candidate.project_record_id}:${candidate.drift_status}`}>
        <td className="py-2 pr-4 font-mono">{candidate.source}</td>
        <td className="py-2 pr-4">
          <div className="font-medium text-gray-900 dark:text-white">{projectNameLabel}</div>
          <div className="font-mono text-gray-500 dark:text-gray-400">{projectIdLabel}</div>
        </td>
        <td className="py-2 pr-4 font-mono">{candidate.project_record_id}</td>
        <td className="py-2 pr-4 font-mono">{ownerUserIdLabel}</td>
        <td className="py-2 pr-4">
          <div>{candidate.dry_run_status}</div>
          <div className="font-mono text-gray-500 dark:text-gray-400">{candidate.dry_run_decision}</div>
        </td>
        <td className="py-2 pr-4 font-mono">{candidate.drift_status}</td>
      </tr>,
    );
  }

  return nodes;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditRequiredEvents(
  readiness: AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse,
): boolean {
  const hasRequiredEvents = readiness.required_event_items.length > 0;
  return hasRequiredEvents === true;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditPayloadIssues(
  readiness: AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse,
): boolean {
  const hasPayloadIssues = readiness.payload_integrity_issues.length > 0;
  return hasPayloadIssues === true;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditMetadataIssues(
  readiness: AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse,
): boolean {
  const hasMetadataIssues = readiness.metadata_integrity_issues.length > 0;
  return hasMetadataIssues === true;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditRecentEvents(
  readiness: AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse,
): boolean {
  const hasRecentEvents = readiness.recent_events.length > 0;
  return hasRecentEvents === true;
}

function materializeAdminEnterpriseProjectAccessGuardActivationAuditRequiredEventNodes(
  items: AdminEnterpriseProjectAccessGuardActivationAuditRequiredEvent[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    const missingLabel = getAdminEnterprisePageBooleanLabel(item.missing);

    nodes.push(
      <tr key={item.event_type}>
        <td className="py-2 pr-4 font-mono">{item.event_type}</td>
        <td className="py-2 pr-4 font-mono">{item.recorded_count}</td>
        <td className="py-2 pr-4 font-mono">{item.latest_status}</td>
        <td className="py-2 pr-4 font-mono">{missingLabel}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectAccessGuardActivationAuditPayloadIssueNodes(
  issues: AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityIssue[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const issue of issues) {
    nodes.push(
      <tr key={`${issue.event_id}-${issue.source}`}>
        <td className="py-2 pr-4 font-mono">{issue.event_id}</td>
        <td className="py-2 pr-4 font-mono">{issue.event_type}</td>
        <td className="py-2 pr-4 font-mono">{issue.source}</td>
        <td className="py-2 pr-4">{issue.message}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectAccessGuardActivationAuditMetadataIssueNodes(
  issues: AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityIssue[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const issue of issues) {
    nodes.push(
      <tr key={`${issue.event_id}-${issue.source}`}>
        <td className="py-2 pr-4 font-mono">{issue.event_id}</td>
        <td className="py-2 pr-4 font-mono">{issue.event_type}</td>
        <td className="py-2 pr-4 font-mono">{issue.source}</td>
        <td className="py-2 pr-4">{issue.message}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectAccessGuardActivationAuditRecentEventNodes(
  events: AdminEnterpriseProjectAccessGuardActivationAuditRecentEvent[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const event of events) {
    nodes.push(
      <tr key={event.id}>
        <td className="py-2 pr-4 font-mono">{event.event_type}</td>
        <td className="py-2 pr-4 font-mono">{event.status}</td>
        <td className="py-2 pr-4 font-mono">
          {event.current_mode} -&gt; {event.target_mode}
        </td>
        <td className="py-2 pr-4 font-mono">{event.readiness_status}</td>
        <td className="py-2 pr-4 font-mono">{event.created_at}</td>
        <td className="py-2 pr-4 font-mono">{event.source}</td>
      </tr>,
    );
  }

  return nodes;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditPending(
  readiness: AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditContent(
  readiness: AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse | null,
): readiness is AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditCoveragePending(
  readiness: AdminEnterpriseAuditCoverageReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditCoverageContent(
  readiness: AdminEnterpriseAuditCoverageReadinessResponse | null,
): readiness is AdminEnterpriseAuditCoverageReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportPending(
  readiness: AdminEnterpriseAuditExportReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportContent(
  readiness: AdminEnterpriseAuditExportReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportQueryPending(
  readiness: AdminEnterpriseAuditExportQueryReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportQueryContent(
  readiness: AdminEnterpriseAuditExportQueryReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportQueryReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportTaskPreflightPending(
  readiness: AdminEnterpriseAuditExportTaskPreflightReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportTaskPreflightContent(
  readiness: AdminEnterpriseAuditExportTaskPreflightReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportTaskPreflightReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportFileFormatPending(
  readiness: AdminEnterpriseAuditExportFileFormatReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportFileFormatContent(
  readiness: AdminEnterpriseAuditExportFileFormatReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportFileFormatReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportFileGeneratorPending(
  readiness: AdminEnterpriseAuditExportFileGeneratorReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportFileGeneratorContent(
  readiness: AdminEnterpriseAuditExportFileGeneratorReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportFileGeneratorReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportTaskCreateRequestPending(
  readiness: AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportTaskCreateRequestContent(
  readiness: AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportTaskPersistencePending(
  readiness: AdminEnterpriseAuditExportTaskPersistenceReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportTaskPersistenceContent(
  readiness: AdminEnterpriseAuditExportTaskPersistenceReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportTaskPersistenceReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportTaskReadbackPending(
  readback: AdminEnterpriseAuditExportTaskListResult | null,
): boolean {
  return readback === null;
}

function shouldRenderAdminEnterpriseAuditExportTaskReadbackContent(
  readback: AdminEnterpriseAuditExportTaskListResult | null,
): readback is AdminEnterpriseAuditExportTaskListResult {
  return readback !== null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerPending(
  readiness: AdminEnterpriseAuditExportWorkerReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerContent(
  readiness: AdminEnterpriseAuditExportWorkerReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportWorkerReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestPending(
  readiness: AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestContent(
  readiness: AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestPersistencePending(
  readiness: AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestPersistenceContent(
  readiness: AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionDryRunPending(
  readiness: AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionDryRunContent(
  readiness: AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionArtifactPending(
  readiness: AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionArtifactContent(
  readiness: AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionOutputStoragePending(
  readiness: AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionOutputStorageContent(
  readiness: AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionTaskCompletionPending(
  readiness: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportWorkerExecutionTaskCompletionContent(
  readiness: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportTaskStatusTransitionPending(
  readiness: AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportTaskStatusTransitionContent(
  readiness: AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportArchiveExpirationPending(
  readiness: AdminEnterpriseAuditExportArchiveExpirationReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportArchiveExpirationContent(
  readiness: AdminEnterpriseAuditExportArchiveExpirationReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportArchiveExpirationReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportPending(
  readiness: AdminEnterpriseAuditExportDeliveryReportReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportContent(
  readiness: AdminEnterpriseAuditExportDeliveryReportReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportDeliveryReportReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportCompletedTaskPending(
  readiness: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportCompletedTaskContent(
  readiness: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportGenerateRequestPending(
  readiness: AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportGenerateRequestContent(
  readiness: AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportStoragePending(
  readiness: AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportStorageContent(
  readiness: AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse {
  return readiness !== null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportStoredPending(
  readiness: AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditExportDeliveryReportStoredContent(
  readiness: AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse | null,
): readiness is AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse {
  return readiness !== null;
}

function canGenerateAdminEnterpriseAuditExportDeliveryReport(
  readiness: AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse | null,
  form: AdminEnterpriseAuditExportDeliveryReportGenerateInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_delivery_report_generate_request_ready') {
    return false;
  }
  if (form.confirm_generate_report !== true) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.idempotency_key) === false) {
    return false;
  }
  return true;
}

function canStoreAdminEnterpriseAuditExportDeliveryReport(
  readiness: AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse | null,
  form: AdminEnterpriseAuditExportDeliveryReportStoreInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_delivery_report_storage_ready') {
    return false;
  }
  if (form.confirm_store_report !== true) {
    return false;
  }
  if (form.report_format !== 'markdown') {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.idempotency_key) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.generated_at) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.report_content) === false) {
    return false;
  }
  return true;
}

function canPersistAdminEnterpriseAuditExportWorkerExecutionRequest(
  readiness: AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse | null,
  form: AdminEnterpriseAuditExportWorkerExecutionRequestPersistInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_worker_execution_request_persistence_ready') {
    return false;
  }
  if (form.confirm_worker_execution !== true) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.task_id) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.idempotency_key) === false) {
    return false;
  }
  if (form.batch_limit <= 0) {
    return false;
  }
  return true;
}

function canDryRunAdminEnterpriseAuditExportWorkerExecutionRequest(
  readiness: AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse | null,
  form: AdminEnterpriseAuditExportWorkerExecutionDryRunInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_worker_execution_dry_run_ready') {
    return false;
  }
  if (form.confirm_worker_execution_dry_run !== true) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.request_id) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  return true;
}

function canGenerateAdminEnterpriseAuditExportWorkerExecutionArtifact(
  readiness: AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse | null,
  form: AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_worker_execution_artifact_ready') {
    return false;
  }
  if (form.confirm_worker_execution_artifact !== true) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.request_id) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  return true;
}

function canStoreAdminEnterpriseAuditExportWorkerExecutionOutputStorage(
  readiness: AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse | null,
  form: AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_worker_execution_output_storage_ready') {
    return false;
  }
  if (form.confirm_worker_execution_output_storage !== true) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.request_id) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  return true;
}

function canCompleteAdminEnterpriseAuditExportWorkerExecutionTask(
  readiness: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse | null,
  form: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_worker_execution_task_completion_ready') {
    return false;
  }
  if (form.confirm_worker_execution_task_completion !== true) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.request_id) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  return true;
}

function canTransitionAdminEnterpriseAuditExportTaskStatus(
  readiness: AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse | null,
  form: AdminEnterpriseAuditExportTaskStatusTransitionInput,
  submitting: boolean,
): boolean {
  if (submitting === true) {
    return false;
  }
  if (readiness === null) {
    return false;
  }
  if (readiness.readiness_status !== 'audit_export_task_status_transition_ready') {
    return false;
  }
  if (form.confirm_status_transition !== true) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.task_id) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.target_status) === false) {
    return false;
  }
  if (hasEnterpriseOrganizationFormValue(form.reason) === false) {
    return false;
  }
  return true;
}

function shouldRenderAdminEnterpriseAuditRetentionPending(
  readiness: AdminEnterpriseAuditRetentionReadinessResponse | null,
): boolean {
  return readiness === null;
}

function shouldRenderAdminEnterpriseAuditRetentionContent(
  readiness: AdminEnterpriseAuditRetentionReadinessResponse | null,
): readiness is AdminEnterpriseAuditRetentionReadinessResponse {
  return readiness !== null;
}

function getAdminEnterpriseBooleanFactLabel(value: boolean): string {
  return value === true ? 'true' : 'false';
}

function getAdminEnterpriseAuditExportQueryFilterFieldsLabel(fields: string[]): string {
  let label = '';
  for (const field of fields) {
    if (label === '') {
      label = field;
    } else {
      label = `${label}, ${field}`;
    }
  }
  return label;
}

function materializeAdminEnterpriseAuditExportTaskReadbackNodes(
  tasks: readonly AdminEnterpriseAuditExportTask[],
): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (const task of tasks) {
    nodes.push(
      <li key={task.id} className="rounded border border-gray-200 p-2 dark:border-gray-700">
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{task.id}</div>
        <div className="mt-1">
          status {task.status}；format {task.format}；source {task.source}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          requested_by {task.requested_by_admin_id}；created_at {task.created_at}
        </div>
      </li>,
    );
  }
  return nodes;
}

function getAdminEnterpriseProjectOwnershipMappingProjectLabel(
  mapping: AdminEnterpriseProjectOwnershipMapping,
): string {
  const hasProjectEvidence = mapping.project_found === true;
  return hasProjectEvidence === true ? mapping.project_name : '项目真源缺失';
}

function getAdminEnterpriseProjectOwnershipMappingProjectIdentityLabel(
  mapping: AdminEnterpriseProjectOwnershipMapping,
): string {
  const hasProjectEvidence = mapping.project_found === true;
  return hasProjectEvidence === true
    ? `${mapping.project_record_id} / ${mapping.project_id}`
    : mapping.project_record_id;
}

function getAdminEnterpriseProjectOwnershipMappingOrganizationIdentityLabel(
  mapping: AdminEnterpriseProjectOwnershipMapping,
): string {
  const hasOrganizationSlug = hasEnterpriseOrganizationFormValue(mapping.organization_slug);
  return hasOrganizationSlug === true ? mapping.organization_slug : mapping.organization_id;
}

function shouldRenderAdminEnterpriseProjectOwnershipMappingOwner(mapping: AdminEnterpriseProjectOwnershipMapping): boolean {
  return mapping.project_found === true;
}

function hasAdminEnterpriseProjectOwnershipMappingTeam(mapping: AdminEnterpriseProjectOwnershipMapping): boolean {
  const hasTeamId = mapping.team_id !== undefined;
  return hasTeamId === true;
}

function shouldRenderAdminEnterpriseProjectOwnershipMappingTeam(mapping: AdminEnterpriseProjectOwnershipMapping): boolean {
  const hasTeam = hasAdminEnterpriseProjectOwnershipMappingTeam(mapping);
  return hasTeam === true;
}

function shouldRenderAdminEnterpriseProjectOwnershipMappingTeamFallback(mapping: AdminEnterpriseProjectOwnershipMapping): boolean {
  const hasTeam = hasAdminEnterpriseProjectOwnershipMappingTeam(mapping);
  return hasTeam === false;
}

function getAdminEnterpriseProjectOwnershipMappingTeamIdentityLabel(
  mapping: AdminEnterpriseProjectOwnershipMapping,
): string {
  const teamId = mapping.team_id;
  const hasTeamId = teamId !== undefined;
  if (hasTeamId === false) {
    return '';
  }
  return hasEnterpriseOrganizationFormValue(mapping.team_slug) === true ? mapping.team_slug : teamId;
}

function materializeAdminEnterpriseProjectOwnershipMappingNodes(
  mappings: AdminEnterpriseProjectOwnershipMapping[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const mapping of mappings) {
    const projectLabel = getAdminEnterpriseProjectOwnershipMappingProjectLabel(mapping);
    const projectIdentityLabel = getAdminEnterpriseProjectOwnershipMappingProjectIdentityLabel(mapping);
    const shouldRenderMappingOwner = shouldRenderAdminEnterpriseProjectOwnershipMappingOwner(mapping);
    const organizationIdentityLabel = getAdminEnterpriseProjectOwnershipMappingOrganizationIdentityLabel(mapping);
    const shouldRenderMappingTeam = shouldRenderAdminEnterpriseProjectOwnershipMappingTeam(mapping);
    const shouldRenderMappingTeamFallback = shouldRenderAdminEnterpriseProjectOwnershipMappingTeamFallback(mapping);
    const mappingTeamIdentityLabel = getAdminEnterpriseProjectOwnershipMappingTeamIdentityLabel(mapping);

    nodes.push(
      <tr key={mapping.ownership_id}>
        <td className="py-2 pr-4">
          <div className="font-medium text-gray-900 dark:text-white">
            {projectLabel}
          </div>
          <div className="font-mono text-gray-500 dark:text-gray-400">
            {projectIdentityLabel}
          </div>
          {shouldRenderMappingOwner === true && (
            <div className="font-mono text-gray-500 dark:text-gray-400">owner_user_id={mapping.owner_user_id}</div>
          )}
        </td>
        <td className="py-2 pr-4">
          <div className="text-gray-900 dark:text-white">{mapping.organization_display_name}</div>
          <div className="font-mono text-gray-500 dark:text-gray-400">
            {organizationIdentityLabel}
          </div>
        </td>
        <td className="py-2 pr-4">
          {shouldRenderMappingTeam === true && (
            <>
              <div className="text-gray-900 dark:text-white">{mapping.team_display_name}</div>
              <div className="font-mono text-gray-500 dark:text-gray-400">
                {mappingTeamIdentityLabel}
              </div>
            </>
          )}
          {shouldRenderMappingTeamFallback === true && (
            <span className="text-gray-500 dark:text-gray-400">未绑定团队</span>
          )}
        </td>
        <td className="py-2 pr-4 font-mono">{mapping.source}</td>
        <td className="py-2 pr-4 font-mono">{mapping.status}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectOwnershipOwnerGuardUnmappedProjectNodes(
  projects: AdminEnterpriseProjectOwnershipOwnerGuardReadinessCandidate[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const project of projects) {
    nodes.push(
      <tr key={project.project_record_id}>
        <td className="py-2 pr-4">
          <div className="font-medium text-gray-900 dark:text-white">{project.project_name}</div>
          <div className="font-mono text-gray-500 dark:text-gray-400">{project.project_id}</div>
        </td>
        <td className="py-2 pr-4 font-mono">{project.project_record_id}</td>
        <td className="py-2 pr-4 font-mono">{project.owner_user_id}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectAccessGuardDryRunDriftCandidateNodes(
  candidates: AdminEnterpriseProjectAccessGuardAuthorizationDryRunDriftCandidate[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const candidate of candidates) {
    nodes.push(
      <tr key={`${candidate.project_record_id}:${candidate.drift_status}`}>
        <td className="py-2 pr-4">
          <div className="font-medium text-gray-900 dark:text-white">{candidate.project_name}</div>
          <div className="font-mono text-gray-500 dark:text-gray-400">{candidate.project_id}</div>
        </td>
        <td className="py-2 pr-4 font-mono">{candidate.project_record_id}</td>
        <td className="py-2 pr-4 font-mono">{candidate.owner_user_id}</td>
        <td className="py-2 pr-4">
          <div>{candidate.dry_run_status}</div>
          <div className="font-mono text-gray-500 dark:text-gray-400">{candidate.dry_run_decision}</div>
        </td>
        <td className="py-2 pr-4 font-mono">{candidate.drift_status}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseOrganizationOptionNodes(
  organizations: AdminEnterpriseOrganization[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const organization of organizations) {
    nodes.push(
      <option key={organization.id} value={organization.id}>
        {organization.display_name} ({organization.slug})
      </option>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseTeamOptionNodes(
  teams: AdminEnterpriseTeam[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const team of teams) {
    nodes.push(
      <option key={team.id} value={team.id}>
        {team.display_name} ({team.slug})
      </option>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseUserOptionNodes(users: AdminUser[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const user of users) {
    nodes.push(
      <option key={user.id} value={user.id}>
        {user.email}
      </option>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectOwnershipPreflightCandidateNodes(
  candidates: AdminEnterpriseProjectOwnershipPreflightCandidate[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const candidate of candidates) {
    nodes.push(
      <tr key={candidate.project_record_id}>
        <td className="py-2 pr-4 text-gray-900 dark:text-white">{candidate.name}</td>
        <td className="py-2 pr-4 font-mono">{candidate.project_id}</td>
        <td className="py-2 pr-4 font-mono">{candidate.owner_user_id}</td>
      </tr>,
    );
  }

  return nodes;
}

function materializeAdminEnterpriseProjectOwnershipPreflightCandidateOptionNodes(
  candidates: AdminEnterpriseProjectOwnershipPreflightCandidate[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const candidate of candidates) {
    nodes.push(
      <option key={candidate.project_record_id} value={candidate.project_record_id}>
        {candidate.name} ({candidate.project_id})
      </option>,
    );
  }

  return nodes;
}

function toEnterpriseOrganizationStatus(value: string): AdminEnterpriseOrganizationStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

function toEnterpriseTeamStatus(value: string): AdminEnterpriseTeamStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

function toEnterpriseMemberStatus(value: string): AdminEnterpriseMemberStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

function listEnterpriseTeamsForOrganization(teams: AdminEnterpriseTeam[], organizationId: string): AdminEnterpriseTeam[] {
  const matchedTeams: AdminEnterpriseTeam[] = [];

  for (const team of teams) {
    const matchesOrganization = team.organization_id === organizationId;
    if (matchesOrganization === true) {
      matchedTeams.push(team);
    }
  }

  return matchedTeams;
}

function resolveEnterpriseOrganizationName(organizations: AdminEnterpriseOrganization[], organizationId: string) {
  for (const organization of organizations) {
    const isTargetOrganization = organization.id === organizationId;
    if (isTargetOrganization === true) {
      return `${organization.display_name} (${organization.slug})`;
    }
  }
  return organizationId;
}

function resolveEnterpriseTeamName(teams: AdminEnterpriseTeam[], teamId: string) {
  for (const team of teams) {
    const isTargetTeam = team.id === teamId;
    if (isTargetTeam === true) {
      return `${team.display_name} (${team.slug})`;
    }
  }
  return teamId;
}

function resolveEnterpriseProjectOwnershipMigrationTeamId(
  input: AdminEnterpriseProjectOwnershipMigrateInput,
): AdminEnterpriseTeamId | null {
  const teamId = input.team_id;
  const hasTeamId = teamId !== undefined && hasEnterpriseOrganizationFormValue(teamId) === true;
  return hasTeamId === true ? teamId : null;
}

function hasEnterpriseProjectOwnershipMigrationTeamId(
  teamId: AdminEnterpriseTeamId | null,
): teamId is AdminEnterpriseTeamId {
  return teamId !== null;
}

function resolveEnterpriseProjectOwnershipMigrationTeamName(
  teams: AdminEnterpriseTeam[],
  teamId: AdminEnterpriseTeamId | null,
): string {
  const hasTeamId = hasEnterpriseProjectOwnershipMigrationTeamId(teamId);
  return hasTeamId === true ? resolveEnterpriseTeamName(teams, teamId) : 'none';
}

function getEnterpriseProjectOwnershipMigrationTeamSummarySegment(teamName: string): string {
  const hasTeamName = teamName !== 'none';
  return hasTeamName === true ? ` / 团队 ${teamName}` : '';
}

function resolveEnterpriseUserName(users: AdminUser[], userId: string) {
  for (const user of users) {
    const isTargetUser = user.id === userId;
    if (isTargetUser === true) {
      return user.email;
    }
  }
  return userId;
}

function resolveEnterpriseProjectName(
  preflight: AdminEnterpriseProjectOwnershipPreflightResponse | null,
  projectRecordId: string,
) {
  if (preflight === null) {
    return projectRecordId;
  }
  for (const candidate of preflight.candidates) {
    const isTargetProject = candidate.project_record_id === projectRecordId;
    if (isTargetProject === true) {
      return `${candidate.name} (${candidate.project_id})`;
    }
  }
  return projectRecordId;
}

function getAdminEnterpriseSsoConfigs(configs: SystemConfig[]): SystemConfig[] {
  const ssoConfigs: SystemConfig[] = [];

  for (const config of configs) {
    const isSsoConfig = isEnterpriseSsoConfig(config);
    if (isSsoConfig === true) {
      ssoConfigs.push(config);
    }
  }

  return ssoConfigs;
}

function getAdminEnterpriseSsoConfigEntries(configs: SystemConfig[]): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  for (const config of configs) {
    entries.push([config.key, config.value]);
  }

  return entries;
}

function countAdminEnterpriseProjectAccessGuardActivationReviewItemsByStatus(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
  status: AdminEnterpriseProjectAccessGuardActivationReviewItem['status'],
): number {
  if (readiness === null) {
    return 0;
  }

  let count = 0;
  for (const item of readiness.review_items) {
    const hasTargetStatus = item.status === status;
    if (hasTargetStatus === true) {
      count += 1;
    }
  }
  return count;
}

function countAdminEnterpriseProjectAccessGuardActivationAuditPlanItemsByStatus(
  readiness: AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null,
  status: AdminEnterpriseProjectAccessGuardActivationAuditPlanItem['status'],
): number {
  if (readiness === null) {
    return 0;
  }

  let count = 0;
  for (const item of readiness.audit_plan_items) {
    const hasTargetStatus = item.status === status;
    if (hasTargetStatus === true) {
      count += 1;
    }
  }
  return count;
}

export default function AdminEnterpriseGovernancePage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [runtimeProjects, setRuntimeProjects] = useState<AdminProject[]>([]);
  const [providerPreflight, setProviderPreflight] = useState<CapabilityProviderPreflightResponse | null>(null);
  const [organizationReadiness, setOrganizationReadiness] = useState<AdminEnterpriseOrganizationReadinessResponse | null>(null);
  const [projectOwnershipReadiness, setProjectOwnershipReadiness] = useState<AdminEnterpriseProjectOwnershipReadinessResponse | null>(null);
  const [projectOwnershipPreflight, setProjectOwnershipPreflight] = useState<AdminEnterpriseProjectOwnershipPreflightResponse | null>(null);
  const [projectOwnershipMappings, setProjectOwnershipMappings] = useState<AdminEnterpriseProjectOwnershipMappingsResponse | null>(null);
  const [projectOwnershipOwnerGuardReadiness, setProjectOwnershipOwnerGuardReadiness] = useState<AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse | null>(null);
  const [projectAccessGuardSwitchReadiness, setProjectAccessGuardSwitchReadiness] = useState<AdminEnterpriseProjectAccessGuardSwitchReadinessResponse | null>(null);
  const [projectAccessGuardAuthorizationDryRunEvidence, setProjectAccessGuardAuthorizationDryRunEvidence] = useState<AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse | null>(null);
  const [projectAccessGuardActivationReadiness, setProjectAccessGuardActivationReadiness] = useState<AdminEnterpriseProjectAccessGuardActivationReadinessResponse | null>(null);
  const [projectAccessGuardActivationAuditReadiness, setProjectAccessGuardActivationAuditReadiness] = useState<AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse | null>(null);
  const [enterpriseAuditCoverageReadiness, setEnterpriseAuditCoverageReadiness] = useState<AdminEnterpriseAuditCoverageReadinessResponse | null>(null);
  const [enterpriseAuditExportReadiness, setEnterpriseAuditExportReadiness] = useState<AdminEnterpriseAuditExportReadinessResponse | null>(null);
  const [enterpriseAuditExportQueryReadiness, setEnterpriseAuditExportQueryReadiness] = useState<AdminEnterpriseAuditExportQueryReadinessResponse | null>(null);
  const [enterpriseAuditExportTaskPreflightReadiness, setEnterpriseAuditExportTaskPreflightReadiness] = useState<AdminEnterpriseAuditExportTaskPreflightReadinessResponse | null>(null);
  const [enterpriseAuditExportFileFormatReadiness, setEnterpriseAuditExportFileFormatReadiness] = useState<AdminEnterpriseAuditExportFileFormatReadinessResponse | null>(null);
  const [enterpriseAuditExportFileGeneratorReadiness, setEnterpriseAuditExportFileGeneratorReadiness] = useState<AdminEnterpriseAuditExportFileGeneratorReadinessResponse | null>(null);
  const [enterpriseAuditExportTaskCreateRequestReadiness, setEnterpriseAuditExportTaskCreateRequestReadiness] = useState<AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse | null>(null);
  const [enterpriseAuditExportTaskPersistenceReadiness, setEnterpriseAuditExportTaskPersistenceReadiness] = useState<AdminEnterpriseAuditExportTaskPersistenceReadinessResponse | null>(null);
  const [enterpriseAuditExportTaskReadback, setEnterpriseAuditExportTaskReadback] = useState<AdminEnterpriseAuditExportTaskListResult | null>(null);
  const [enterpriseAuditExportWorkerReadiness, setEnterpriseAuditExportWorkerReadiness] = useState<AdminEnterpriseAuditExportWorkerReadinessResponse | null>(null);
  const [enterpriseAuditExportWorkerExecutionRequestReadiness, setEnterpriseAuditExportWorkerExecutionRequestReadiness] = useState<AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse | null>(null);
  const [enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness, setEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness] = useState<AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse | null>(null);
  const [enterpriseAuditExportWorkerExecutionRequestPersistForm, setEnterpriseAuditExportWorkerExecutionRequestPersistForm] = useState<AdminEnterpriseAuditExportWorkerExecutionRequestPersistInput>(emptyEnterpriseAuditExportWorkerExecutionRequestPersistForm);
  const [enterpriseAuditExportWorkerExecutionRequestPersisting, setEnterpriseAuditExportWorkerExecutionRequestPersisting] = useState(false);
  const [enterpriseAuditExportWorkerExecutionRequestPersistMessage, setEnterpriseAuditExportWorkerExecutionRequestPersistMessage] = useState('');
  const [enterpriseAuditExportWorkerExecutionRequestPersistResult, setEnterpriseAuditExportWorkerExecutionRequestPersistResult] = useState<AdminEnterpriseAuditExportWorkerExecutionRequestPersistResult | null>(null);
  const [enterpriseAuditExportWorkerExecutionDryRunReadiness, setEnterpriseAuditExportWorkerExecutionDryRunReadiness] = useState<AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse | null>(null);
  const [enterpriseAuditExportWorkerExecutionDryRunForm, setEnterpriseAuditExportWorkerExecutionDryRunForm] = useState<AdminEnterpriseAuditExportWorkerExecutionDryRunInput>(emptyEnterpriseAuditExportWorkerExecutionDryRunForm);
  const [enterpriseAuditExportWorkerExecutionDryRunning, setEnterpriseAuditExportWorkerExecutionDryRunning] = useState(false);
  const [enterpriseAuditExportWorkerExecutionDryRunMessage, setEnterpriseAuditExportWorkerExecutionDryRunMessage] = useState('');
  const [enterpriseAuditExportWorkerExecutionDryRunResult, setEnterpriseAuditExportWorkerExecutionDryRunResult] = useState<AdminEnterpriseAuditExportWorkerExecutionDryRunResult | null>(null);
  const [enterpriseAuditExportWorkerExecutionArtifactReadiness, setEnterpriseAuditExportWorkerExecutionArtifactReadiness] = useState<AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse | null>(null);
  const [enterpriseAuditExportWorkerExecutionArtifactForm, setEnterpriseAuditExportWorkerExecutionArtifactForm] = useState<AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateInput>(emptyEnterpriseAuditExportWorkerExecutionArtifactForm);
  const [enterpriseAuditExportWorkerExecutionArtifactGenerating, setEnterpriseAuditExportWorkerExecutionArtifactGenerating] = useState(false);
  const [enterpriseAuditExportWorkerExecutionArtifactMessage, setEnterpriseAuditExportWorkerExecutionArtifactMessage] = useState('');
  const [enterpriseAuditExportWorkerExecutionArtifactResult, setEnterpriseAuditExportWorkerExecutionArtifactResult] = useState<AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateResult | null>(null);
  const [enterpriseAuditExportWorkerExecutionOutputStorageReadiness, setEnterpriseAuditExportWorkerExecutionOutputStorageReadiness] = useState<AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse | null>(null);
  const [enterpriseAuditExportWorkerExecutionOutputStorageForm, setEnterpriseAuditExportWorkerExecutionOutputStorageForm] = useState<AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreInput>(emptyEnterpriseAuditExportWorkerExecutionOutputStorageForm);
  const [enterpriseAuditExportWorkerExecutionOutputStorageStoring, setEnterpriseAuditExportWorkerExecutionOutputStorageStoring] = useState(false);
  const [enterpriseAuditExportWorkerExecutionOutputStorageMessage, setEnterpriseAuditExportWorkerExecutionOutputStorageMessage] = useState('');
  const [enterpriseAuditExportWorkerExecutionOutputStorageResult, setEnterpriseAuditExportWorkerExecutionOutputStorageResult] = useState<AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreResult | null>(null);
  const [enterpriseAuditExportWorkerExecutionTaskCompletionReadiness, setEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness] = useState<AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse | null>(null);
  const [enterpriseAuditExportWorkerExecutionTaskCompletionForm, setEnterpriseAuditExportWorkerExecutionTaskCompletionForm] = useState<AdminEnterpriseAuditExportWorkerExecutionTaskCompletionInput>(emptyEnterpriseAuditExportWorkerExecutionTaskCompletionForm);
  const [enterpriseAuditExportWorkerExecutionTaskCompleting, setEnterpriseAuditExportWorkerExecutionTaskCompleting] = useState(false);
  const [enterpriseAuditExportWorkerExecutionTaskCompletionMessage, setEnterpriseAuditExportWorkerExecutionTaskCompletionMessage] = useState('');
  const [enterpriseAuditExportWorkerExecutionTaskCompletionResult, setEnterpriseAuditExportWorkerExecutionTaskCompletionResult] = useState<AdminEnterpriseAuditExportWorkerExecutionTaskCompletionResult | null>(null);
  const [enterpriseAuditExportTaskStatusTransitionReadiness, setEnterpriseAuditExportTaskStatusTransitionReadiness] = useState<AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse | null>(null);
  const [enterpriseAuditExportTaskStatusTransitionForm, setEnterpriseAuditExportTaskStatusTransitionForm] = useState<AdminEnterpriseAuditExportTaskStatusTransitionInput>(emptyEnterpriseAuditExportTaskStatusTransitionForm);
  const [enterpriseAuditExportTaskStatusTransitioning, setEnterpriseAuditExportTaskStatusTransitioning] = useState(false);
  const [enterpriseAuditExportTaskStatusTransitionMessage, setEnterpriseAuditExportTaskStatusTransitionMessage] = useState('');
  const [enterpriseAuditExportTaskStatusTransitionResult, setEnterpriseAuditExportTaskStatusTransitionResult] = useState<AdminEnterpriseAuditExportTaskStatusTransitionResult | null>(null);
  const [enterpriseAuditExportArchiveExpirationReadiness, setEnterpriseAuditExportArchiveExpirationReadiness] = useState<AdminEnterpriseAuditExportArchiveExpirationReadinessResponse | null>(null);
  const [enterpriseAuditExportDeliveryReportReadiness, setEnterpriseAuditExportDeliveryReportReadiness] = useState<AdminEnterpriseAuditExportDeliveryReportReadinessResponse | null>(null);
  const [enterpriseAuditExportDeliveryReportCompletedTaskReadiness, setEnterpriseAuditExportDeliveryReportCompletedTaskReadiness] = useState<AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse | null>(null);
  const [enterpriseAuditExportDeliveryReportGenerateRequestReadiness, setEnterpriseAuditExportDeliveryReportGenerateRequestReadiness] = useState<AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse | null>(null);
  const [enterpriseAuditExportDeliveryReportStorageReadiness, setEnterpriseAuditExportDeliveryReportStorageReadiness] = useState<AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse | null>(null);
  const [enterpriseAuditExportDeliveryReportStoredReadiness, setEnterpriseAuditExportDeliveryReportStoredReadiness] = useState<AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse | null>(null);
  const [enterpriseAuditExportDeliveryReportGenerateForm, setEnterpriseAuditExportDeliveryReportGenerateForm] = useState<AdminEnterpriseAuditExportDeliveryReportGenerateInput>(emptyEnterpriseAuditExportDeliveryReportGenerateForm);
  const [enterpriseAuditExportDeliveryReportGenerating, setEnterpriseAuditExportDeliveryReportGenerating] = useState(false);
  const [enterpriseAuditExportDeliveryReportGenerateMessage, setEnterpriseAuditExportDeliveryReportGenerateMessage] = useState('');
  const [enterpriseAuditExportDeliveryReportGenerateResult, setEnterpriseAuditExportDeliveryReportGenerateResult] = useState<AdminEnterpriseAuditExportDeliveryReportGenerateResult | null>(null);
  const [enterpriseAuditExportDeliveryReportStoreForm, setEnterpriseAuditExportDeliveryReportStoreForm] = useState<AdminEnterpriseAuditExportDeliveryReportStoreInput>(emptyEnterpriseAuditExportDeliveryReportStoreForm);
  const [enterpriseAuditExportDeliveryReportStoring, setEnterpriseAuditExportDeliveryReportStoring] = useState(false);
  const [enterpriseAuditExportDeliveryReportStoreMessage, setEnterpriseAuditExportDeliveryReportStoreMessage] = useState('');
  const [enterpriseAuditExportDeliveryReportStoreResult, setEnterpriseAuditExportDeliveryReportStoreResult] = useState<AdminEnterpriseAuditExportDeliveryReportStoreResult | null>(null);
  const [enterpriseAuditRetentionReadiness, setEnterpriseAuditRetentionReadiness] = useState<AdminEnterpriseAuditRetentionReadinessResponse | null>(null);
  const [projectAccessGuardActivationManualApprovalNote, setProjectAccessGuardActivationManualApprovalNote] = useState('');
  const [projectAccessGuardActivationManualApprovalSubmitting, setProjectAccessGuardActivationManualApprovalSubmitting] = useState(false);
  const [projectAccessGuardActivationManualApprovalMessage, setProjectAccessGuardActivationManualApprovalMessage] = useState('');
  const [projectAccessGuardActivationExecutionNote, setProjectAccessGuardActivationExecutionNote] = useState('');
  const [projectAccessGuardActivationExecutionSubmitting, setProjectAccessGuardActivationExecutionSubmitting] = useState(false);
  const [projectAccessGuardActivationExecutionMessage, setProjectAccessGuardActivationExecutionMessage] = useState('');
  const [projectAccessGuardPostActivationValidationNote, setProjectAccessGuardPostActivationValidationNote] = useState('');
  const [projectAccessGuardPostActivationValidationSubmitting, setProjectAccessGuardPostActivationValidationSubmitting] = useState(false);
  const [projectAccessGuardPostActivationValidationMessage, setProjectAccessGuardPostActivationValidationMessage] = useState('');
  const [projectAccessGuardRollbackEvidenceNote, setProjectAccessGuardRollbackEvidenceNote] = useState('');
  const [projectAccessGuardRollbackEvidenceReference, setProjectAccessGuardRollbackEvidenceReference] = useState('');
  const [projectAccessGuardRollbackEvidenceSubmitting, setProjectAccessGuardRollbackEvidenceSubmitting] = useState(false);
  const [projectAccessGuardRollbackEvidenceMessage, setProjectAccessGuardRollbackEvidenceMessage] = useState('');
  const [projectAccessGuardAuthorizationActivationNote, setProjectAccessGuardAuthorizationActivationNote] = useState('');
  const [projectAccessGuardAuthorizationActivationSubmitting, setProjectAccessGuardAuthorizationActivationSubmitting] = useState(false);
  const [projectAccessGuardAuthorizationActivationMessage, setProjectAccessGuardAuthorizationActivationMessage] = useState('');
  const [ssoDiscoveryReadiness, setSsoDiscoveryReadiness] = useState<AdminEnterpriseSsoDiscoveryReadinessResponse | null>(null);
  const [privateDeploymentReadiness, setPrivateDeploymentReadiness] = useState<AdminEnterprisePrivateDeploymentReadinessResponse | null>(null);
  const [commercialReadiness, setCommercialReadiness] = useState<AdminEnterpriseCommercialReadinessResponse | null>(null);
  const [organizations, setOrganizations] = useState<AdminEnterpriseOrganization[]>([]);
  const [teams, setTeams] = useState<AdminEnterpriseTeam[]>([]);
  const [ssoConfigs, setSsoConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [organizationForm, setOrganizationForm] = useState<AdminEnterpriseOrganizationCreateInput>(emptyOrganizationForm);
  const [organizationCreating, setOrganizationCreating] = useState(false);
  const [organizationCreateMessage, setOrganizationCreateMessage] = useState('');
  const [teamForm, setTeamForm] = useState<AdminEnterpriseTeamCreateInput>(emptyTeamForm);
  const [teamCreating, setTeamCreating] = useState(false);
  const [teamCreateMessage, setTeamCreateMessage] = useState('');
  const [memberForm, setMemberForm] = useState<AdminEnterpriseMemberBindInput>(emptyMemberForm);
  const [memberBinding, setMemberBinding] = useState(false);
  const [memberBindMessage, setMemberBindMessage] = useState('');
  const [projectOwnershipMigrationForm, setProjectOwnershipMigrationForm] = useState<AdminEnterpriseProjectOwnershipMigrateInput>(emptyProjectOwnershipMigrationForm);
  const [projectOwnershipMigrating, setProjectOwnershipMigrating] = useState(false);
  const [projectOwnershipMigrationMessage, setProjectOwnershipMigrationMessage] = useState('');
  const [pendingMutation, setPendingMutation] = useState<AdminEnterprisePendingMutation | null>(null);
  const [mutationConfirmationOpen, setMutationConfirmationOpen] = useState(false);
  const [mutationConfirmationError, setMutationConfirmationError] = useState('');
  const [mutationSubmitting, setMutationSubmitting] = useState(false);
  const profile = adminAuthApi.getCachedProfile();
  const canCreateOrganization = profile !== null && profile.role === 'super_admin';

  const loadEnterpriseReadiness = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        userList,
        roleList,
        permissionList,
        auditResult,
        projectResult,
        preflightResult,
        ssoDiscoveryReadinessResult,
        privateDeploymentReadinessResult,
        commercialReadinessResult,
        organizationReadinessResult,
        projectOwnershipReadinessResult,
        projectOwnershipPreflightResult,
        projectOwnershipMappingsResult,
        projectOwnershipOwnerGuardReadinessResult,
        projectAccessGuardSwitchReadinessResult,
        projectAccessGuardAuthorizationDryRunEvidenceResult,
        projectAccessGuardActivationReadinessResult,
        projectAccessGuardActivationAuditReadinessResult,
        enterpriseAuditCoverageReadinessResult,
        enterpriseAuditExportReadinessResult,
        enterpriseAuditExportQueryReadinessResult,
        enterpriseAuditExportTaskPreflightReadinessResult,
        enterpriseAuditExportFileFormatReadinessResult,
        enterpriseAuditExportFileGeneratorReadinessResult,
        enterpriseAuditExportTaskCreateRequestReadinessResult,
        enterpriseAuditExportTaskPersistenceReadinessResult,
        enterpriseAuditExportTaskReadbackResult,
        enterpriseAuditExportWorkerReadinessResult,
        enterpriseAuditExportWorkerExecutionRequestReadinessResult,
        enterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResult,
        enterpriseAuditExportWorkerExecutionDryRunReadinessResult,
        enterpriseAuditExportWorkerExecutionArtifactReadinessResult,
        enterpriseAuditExportWorkerExecutionOutputStorageReadinessResult,
        enterpriseAuditExportWorkerExecutionTaskCompletionReadinessResult,
        enterpriseAuditExportTaskStatusTransitionReadinessResult,
        enterpriseAuditExportArchiveExpirationReadinessResult,
        enterpriseAuditExportDeliveryReportReadinessResult,
        enterpriseAuditExportDeliveryReportCompletedTaskReadinessResult,
        enterpriseAuditExportDeliveryReportGenerateRequestReadinessResult,
        enterpriseAuditExportDeliveryReportStorageReadinessResult,
        enterpriseAuditExportDeliveryReportStoredReadinessResult,
        enterpriseAuditRetentionReadinessResult,
        organizationList,
        teamList,
        configList,
      ] = await Promise.all([
        adminUsersApi.list(),
        adminRolesApi.list(),
        adminPermissionsApi.list(),
        adminAuditApi.list({ limit: 50 }),
        adminProjectsApi.list({ pageSize: 50 }),
        adminCapabilityApi.getProviderPreflight(),
        adminEnterpriseApi.getSsoDiscoveryReadiness(),
        adminEnterpriseApi.getPrivateDeploymentReadiness(),
        adminEnterpriseApi.getCommercialReadiness(),
        adminEnterpriseApi.getOrganizationReadiness(),
        adminEnterpriseApi.getProjectOwnershipReadiness(),
        adminEnterpriseApi.getProjectOwnershipPreflight(),
        adminEnterpriseApi.getProjectOwnershipMappings(),
        adminEnterpriseApi.getProjectOwnershipOwnerGuardReadiness(),
        adminEnterpriseApi.getProjectAccessGuardSwitchReadiness(),
        adminEnterpriseApi.getProjectAccessGuardAuthorizationDryRunEvidence(),
        adminEnterpriseApi.getProjectAccessGuardActivationReadiness(),
        adminEnterpriseApi.getProjectAccessGuardActivationAuditReadiness(),
        adminEnterpriseApi.getAuditCoverageReadiness(),
        adminEnterpriseApi.getAuditExportReadiness(),
        adminEnterpriseApi.getAuditExportQueryReadiness(),
        adminEnterpriseApi.getAuditExportTaskPreflightReadiness(),
        adminEnterpriseApi.getAuditExportFileFormatReadiness(),
        adminEnterpriseApi.getAuditExportFileGeneratorReadiness(),
        adminEnterpriseApi.getAuditExportTaskCreateRequestReadiness(),
        adminEnterpriseApi.getAuditExportTaskPersistenceReadiness(),
        adminEnterpriseApi.listAuditExportTasks(),
        adminEnterpriseApi.getAuditExportWorkerReadiness(),
        adminEnterpriseApi.getAuditExportWorkerExecutionRequestReadiness(),
        adminEnterpriseApi.getAuditExportWorkerExecutionRequestPersistenceReadiness(),
        adminEnterpriseApi.getAuditExportWorkerExecutionDryRunReadiness(),
        adminEnterpriseApi.getAuditExportWorkerExecutionArtifactReadiness(),
        adminEnterpriseApi.getAuditExportWorkerExecutionOutputStorageReadiness(),
        adminEnterpriseApi.getAuditExportWorkerExecutionTaskCompletionReadiness(),
        adminEnterpriseApi.getAuditExportTaskStatusTransitionReadiness(),
        adminEnterpriseApi.getAuditExportArchiveExpirationReadiness(),
        adminEnterpriseApi.getAuditExportDeliveryReportReadiness(),
        adminEnterpriseApi.getAuditExportDeliveryReportCompletedTaskReadiness(),
        adminEnterpriseApi.getAuditExportDeliveryReportGenerateRequestReadiness(),
        adminEnterpriseApi.getAuditExportDeliveryReportStorageReadiness(),
        adminEnterpriseApi.getAuditExportDeliveryReportStoredReadiness(),
        adminEnterpriseApi.getAuditRetentionReadiness(),
        adminEnterpriseApi.listOrganizations(),
        adminEnterpriseApi.listTeams(),
        adminConfigApi.list(),
      ]);
      setUsers(userList);
      setRoles(roleList);
      setPermissions(permissionList);
      setAuditLogs(auditResult.logs);
      setRuntimeProjects(projectResult.projects);
      setProviderPreflight(preflightResult);
      setSsoDiscoveryReadiness(ssoDiscoveryReadinessResult);
      setPrivateDeploymentReadiness(privateDeploymentReadinessResult);
      setCommercialReadiness(commercialReadinessResult);
      setOrganizationReadiness(organizationReadinessResult);
      setProjectOwnershipReadiness(projectOwnershipReadinessResult);
      setProjectOwnershipPreflight(projectOwnershipPreflightResult);
      setProjectOwnershipMappings(projectOwnershipMappingsResult);
      setProjectOwnershipOwnerGuardReadiness(projectOwnershipOwnerGuardReadinessResult);
      setProjectAccessGuardSwitchReadiness(projectAccessGuardSwitchReadinessResult);
      setProjectAccessGuardAuthorizationDryRunEvidence(projectAccessGuardAuthorizationDryRunEvidenceResult);
      setProjectAccessGuardActivationReadiness(projectAccessGuardActivationReadinessResult);
      setProjectAccessGuardActivationAuditReadiness(projectAccessGuardActivationAuditReadinessResult);
      setEnterpriseAuditCoverageReadiness(enterpriseAuditCoverageReadinessResult);
      setEnterpriseAuditExportReadiness(enterpriseAuditExportReadinessResult);
      setEnterpriseAuditExportQueryReadiness(enterpriseAuditExportQueryReadinessResult);
      setEnterpriseAuditExportTaskPreflightReadiness(enterpriseAuditExportTaskPreflightReadinessResult);
      setEnterpriseAuditExportFileFormatReadiness(enterpriseAuditExportFileFormatReadinessResult);
      setEnterpriseAuditExportFileGeneratorReadiness(enterpriseAuditExportFileGeneratorReadinessResult);
      setEnterpriseAuditExportTaskCreateRequestReadiness(enterpriseAuditExportTaskCreateRequestReadinessResult);
      setEnterpriseAuditExportTaskPersistenceReadiness(enterpriseAuditExportTaskPersistenceReadinessResult);
      setEnterpriseAuditExportTaskReadback(enterpriseAuditExportTaskReadbackResult);
      setEnterpriseAuditExportWorkerReadiness(enterpriseAuditExportWorkerReadinessResult);
      setEnterpriseAuditExportWorkerExecutionRequestReadiness(enterpriseAuditExportWorkerExecutionRequestReadinessResult);
      setEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness(enterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResult);
      setEnterpriseAuditExportWorkerExecutionDryRunReadiness(enterpriseAuditExportWorkerExecutionDryRunReadinessResult);
      setEnterpriseAuditExportWorkerExecutionArtifactReadiness(enterpriseAuditExportWorkerExecutionArtifactReadinessResult);
      setEnterpriseAuditExportWorkerExecutionOutputStorageReadiness(enterpriseAuditExportWorkerExecutionOutputStorageReadinessResult);
      setEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness(enterpriseAuditExportWorkerExecutionTaskCompletionReadinessResult);
      setEnterpriseAuditExportTaskStatusTransitionReadiness(enterpriseAuditExportTaskStatusTransitionReadinessResult);
      setEnterpriseAuditExportArchiveExpirationReadiness(enterpriseAuditExportArchiveExpirationReadinessResult);
      setEnterpriseAuditExportDeliveryReportReadiness(enterpriseAuditExportDeliveryReportReadinessResult);
      setEnterpriseAuditExportDeliveryReportCompletedTaskReadiness(enterpriseAuditExportDeliveryReportCompletedTaskReadinessResult);
      setEnterpriseAuditExportDeliveryReportGenerateRequestReadiness(enterpriseAuditExportDeliveryReportGenerateRequestReadinessResult);
      setEnterpriseAuditExportDeliveryReportStorageReadiness(enterpriseAuditExportDeliveryReportStorageReadinessResult);
      setEnterpriseAuditExportDeliveryReportStoredReadiness(enterpriseAuditExportDeliveryReportStoredReadinessResult);
      setEnterpriseAuditRetentionReadiness(enterpriseAuditRetentionReadinessResult);
      setOrganizations(organizationList);
      setTeams(teamList);
      setSsoConfigs(getAdminEnterpriseSsoConfigs(configList));
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载企业治理 readiness 失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEnterpriseReadiness();
  }, [loadEnterpriseReadiness]);

  const organizationCreateReady = hasEnterpriseOrganizationFormValue(organizationForm.slug)
    && hasEnterpriseOrganizationFormValue(organizationForm.display_name);
  const teamCreateReady = hasEnterpriseOrganizationFormValue(teamForm.organization_id)
    && hasEnterpriseOrganizationFormValue(teamForm.slug)
    && hasEnterpriseOrganizationFormValue(teamForm.display_name);
  const memberBindReady = hasEnterpriseOrganizationFormValue(memberForm.organization_id)
    && hasEnterpriseOrganizationFormValue(memberForm.team_id)
    && hasEnterpriseOrganizationFormValue(memberForm.user_id);
  const projectOwnershipMigrationReady = hasEnterpriseOrganizationFormValue(projectOwnershipMigrationForm.project_record_id)
    && hasEnterpriseOrganizationFormValue(projectOwnershipMigrationForm.organization_id)
    && projectOwnershipMigrationForm.confirm_migrate;
  const projectAccessGuardActivationManualApprovalReady = canCreateOrganization === true
    && hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === true
    && hasEnterpriseOrganizationFormValue(projectAccessGuardActivationManualApprovalNote) === true;
  const projectAccessGuardActivationExecutionReady = canCreateOrganization === true
    && hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === true
    && hasAdminEnterpriseProjectAccessGuardActivationManualApprovalEvidence(projectAccessGuardActivationReadiness) === true
    && hasEnterpriseOrganizationFormValue(projectAccessGuardActivationExecutionNote) === true;
  const projectAccessGuardPostActivationValidationReady = canCreateOrganization === true
    && hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === true
    && hasAdminEnterpriseProjectAccessGuardActivationExecutionEvidence(projectAccessGuardActivationReadiness) === true
    && hasEnterpriseOrganizationFormValue(projectAccessGuardPostActivationValidationNote) === true;
  const projectAccessGuardRollbackEvidenceReady = canCreateOrganization === true
    && hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === true
    && hasAdminEnterpriseProjectAccessGuardPostActivationValidationEvidence(projectAccessGuardActivationReadiness) === true
    && hasEnterpriseOrganizationFormValue(projectAccessGuardRollbackEvidenceNote) === true
    && hasEnterpriseOrganizationFormValue(projectAccessGuardRollbackEvidenceReference) === true;
  const projectAccessGuardAuthorizationActivationReady = canCreateOrganization === true
    && hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === true
    && hasAdminEnterpriseProjectAccessGuardRollbackEvidence(projectAccessGuardActivationReadiness) === true
    && hasEnterpriseOrganizationFormValue(projectAccessGuardAuthorizationActivationNote) === true;
  const shouldRenderOrganizationCreateMessage = shouldRenderAdminEnterpriseFormMessage(organizationCreateMessage);
  const shouldRenderTeamCreateMessage = shouldRenderAdminEnterpriseFormMessage(teamCreateMessage);
  const shouldRenderMemberBindMessage = shouldRenderAdminEnterpriseFormMessage(memberBindMessage);
  const shouldRenderProjectOwnershipMigrationMessage = shouldRenderAdminEnterpriseFormMessage(projectOwnershipMigrationMessage);
  const shouldRenderProjectAccessGuardActivationManualApprovalMessage = shouldRenderAdminEnterpriseFormMessage(projectAccessGuardActivationManualApprovalMessage);
  const shouldRenderProjectAccessGuardActivationExecutionMessage = shouldRenderAdminEnterpriseFormMessage(projectAccessGuardActivationExecutionMessage);
  const shouldRenderProjectAccessGuardPostActivationValidationMessage = shouldRenderAdminEnterpriseFormMessage(projectAccessGuardPostActivationValidationMessage);
  const shouldRenderProjectAccessGuardRollbackEvidenceMessage = shouldRenderAdminEnterpriseFormMessage(projectAccessGuardRollbackEvidenceMessage);
  const shouldRenderProjectAccessGuardAuthorizationActivationMessage = shouldRenderAdminEnterpriseFormMessage(projectAccessGuardAuthorizationActivationMessage);
  const shouldRenderEnterpriseAuditExportDeliveryReportGenerateMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportDeliveryReportGenerateMessage);
  const shouldRenderEnterpriseAuditExportDeliveryReportStoreMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportDeliveryReportStoreMessage);
  const shouldRenderEnterpriseAuditExportWorkerExecutionRequestPersistMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportWorkerExecutionRequestPersistMessage);
  const shouldRenderEnterpriseAuditExportWorkerExecutionDryRunMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportWorkerExecutionDryRunMessage);
  const shouldRenderEnterpriseAuditExportWorkerExecutionArtifactMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportWorkerExecutionArtifactMessage);
  const shouldRenderEnterpriseAuditExportWorkerExecutionOutputStorageMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportWorkerExecutionOutputStorageMessage);
  const shouldRenderEnterpriseAuditExportWorkerExecutionTaskCompletionMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportWorkerExecutionTaskCompletionMessage);
  const shouldRenderEnterpriseAuditExportTaskStatusTransitionMessage = shouldRenderAdminEnterpriseFormMessage(enterpriseAuditExportTaskStatusTransitionMessage);
  const enterpriseAuditExportDeliveryReportGenerateReady = canCreateOrganization === true
    && canGenerateAdminEnterpriseAuditExportDeliveryReport(
      enterpriseAuditExportDeliveryReportGenerateRequestReadiness,
      enterpriseAuditExportDeliveryReportGenerateForm,
      enterpriseAuditExportDeliveryReportGenerating,
    );
  const enterpriseAuditExportDeliveryReportStoreReady = canCreateOrganization === true
    && canStoreAdminEnterpriseAuditExportDeliveryReport(
      enterpriseAuditExportDeliveryReportStorageReadiness,
      enterpriseAuditExportDeliveryReportStoreForm,
      enterpriseAuditExportDeliveryReportStoring,
    );
  const enterpriseAuditExportWorkerExecutionRequestPersistReady = canCreateOrganization === true
    && canPersistAdminEnterpriseAuditExportWorkerExecutionRequest(
      enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness,
      enterpriseAuditExportWorkerExecutionRequestPersistForm,
      enterpriseAuditExportWorkerExecutionRequestPersisting,
    );
  const enterpriseAuditExportWorkerExecutionDryRunReady = canCreateOrganization === true
    && canDryRunAdminEnterpriseAuditExportWorkerExecutionRequest(
      enterpriseAuditExportWorkerExecutionDryRunReadiness,
      enterpriseAuditExportWorkerExecutionDryRunForm,
      enterpriseAuditExportWorkerExecutionDryRunning,
    );
  const enterpriseAuditExportWorkerExecutionArtifactReady = canCreateOrganization === true
    && canGenerateAdminEnterpriseAuditExportWorkerExecutionArtifact(
      enterpriseAuditExportWorkerExecutionArtifactReadiness,
      enterpriseAuditExportWorkerExecutionArtifactForm,
      enterpriseAuditExportWorkerExecutionArtifactGenerating,
    );
  const enterpriseAuditExportWorkerExecutionOutputStorageReady = canCreateOrganization === true
    && canStoreAdminEnterpriseAuditExportWorkerExecutionOutputStorage(
      enterpriseAuditExportWorkerExecutionOutputStorageReadiness,
      enterpriseAuditExportWorkerExecutionOutputStorageForm,
      enterpriseAuditExportWorkerExecutionOutputStorageStoring,
    );
  const enterpriseAuditExportWorkerExecutionTaskCompletionReady = canCreateOrganization === true
    && canCompleteAdminEnterpriseAuditExportWorkerExecutionTask(
      enterpriseAuditExportWorkerExecutionTaskCompletionReadiness,
      enterpriseAuditExportWorkerExecutionTaskCompletionForm,
      enterpriseAuditExportWorkerExecutionTaskCompleting,
    );
  const enterpriseAuditExportTaskStatusTransitionReady = canCreateOrganization === true
    && canTransitionAdminEnterpriseAuditExportTaskStatus(
      enterpriseAuditExportTaskStatusTransitionReadiness,
      enterpriseAuditExportTaskStatusTransitionForm,
      enterpriseAuditExportTaskStatusTransitioning,
    );
  const organizationCreateActionLabel = getAdminEnterpriseOrganizationCreateActionLabel(organizationCreating);
  const teamCreateActionLabel = getAdminEnterpriseTeamCreateActionLabel(teamCreating);
  const memberBindActionLabel = getAdminEnterpriseMemberBindActionLabel(memberBinding);
  const projectOwnershipMigrationActionLabel = getAdminEnterpriseProjectOwnershipMigrationActionLabel(
    projectOwnershipMigrating,
  );
  const projectAccessGuardActivationManualApprovalActionLabel = getAdminEnterpriseProjectAccessGuardActivationManualApprovalActionLabel(
    projectAccessGuardActivationManualApprovalSubmitting,
  );
  const projectAccessGuardActivationExecutionActionLabel = getAdminEnterpriseProjectAccessGuardActivationExecutionActionLabel(
    projectAccessGuardActivationExecutionSubmitting,
  );
  const projectAccessGuardPostActivationValidationActionLabel = getAdminEnterpriseProjectAccessGuardPostActivationValidationActionLabel(
    projectAccessGuardPostActivationValidationSubmitting,
  );
  const projectAccessGuardRollbackEvidenceActionLabel = getAdminEnterpriseProjectAccessGuardRollbackEvidenceActionLabel(
    projectAccessGuardRollbackEvidenceSubmitting,
  );
  const projectAccessGuardAuthorizationActivationActionLabel = getAdminEnterpriseProjectAccessGuardAuthorizationActivationActionLabel(
    projectAccessGuardAuthorizationActivationSubmitting,
  );
  const enterpriseAuditExportDeliveryReportGenerateActionLabel = getAdminEnterpriseAuditExportDeliveryReportGenerateActionLabel(
    enterpriseAuditExportDeliveryReportGenerating,
  );
  const enterpriseAuditExportDeliveryReportStoreActionLabel = getAdminEnterpriseAuditExportDeliveryReportStoreActionLabel(
    enterpriseAuditExportDeliveryReportStoring,
  );
  const enterpriseAuditExportWorkerExecutionRequestPersistActionLabel = getAdminEnterpriseAuditExportWorkerExecutionRequestPersistActionLabel(
    enterpriseAuditExportWorkerExecutionRequestPersisting,
  );
  const enterpriseAuditExportWorkerExecutionDryRunActionLabel = getAdminEnterpriseAuditExportWorkerExecutionDryRunActionLabel(
    enterpriseAuditExportWorkerExecutionDryRunning,
  );
  const enterpriseAuditExportWorkerExecutionArtifactActionLabel = getAdminEnterpriseAuditExportWorkerExecutionArtifactActionLabel(
    enterpriseAuditExportWorkerExecutionArtifactGenerating,
  );
  const enterpriseAuditExportWorkerExecutionOutputStorageActionLabel = getAdminEnterpriseAuditExportWorkerExecutionOutputStorageActionLabel(
    enterpriseAuditExportWorkerExecutionOutputStorageStoring,
  );
  const enterpriseAuditExportWorkerExecutionTaskCompletionActionLabel = getAdminEnterpriseAuditExportWorkerExecutionTaskCompletionActionLabel(
    enterpriseAuditExportWorkerExecutionTaskCompleting,
  );
  const enterpriseAuditExportTaskStatusTransitionActionLabel = getAdminEnterpriseAuditExportTaskStatusTransitionActionLabel(
    enterpriseAuditExportTaskStatusTransitioning,
  );
  const mutationConfirmationDescription = getAdminEnterpriseMutationConfirmationDescription(pendingMutation);
  const mutationConfirmationActionLabel = getAdminEnterpriseMutationConfirmationActionLabel(mutationSubmitting);
  const memberTeams = useMemo(() => (
    listEnterpriseTeamsForOrganization(teams, memberForm.organization_id)
  ), [memberForm.organization_id, teams]);
  const projectOwnershipMigrationTeams = useMemo(() => (
    listEnterpriseTeamsForOrganization(teams, projectOwnershipMigrationForm.organization_id)
  ), [projectOwnershipMigrationForm.organization_id, teams]);

  const handleGenerateEnterpriseAuditExportDeliveryReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportDeliveryReportGenerateReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportDeliveryReportGenerateInput = {
      reason: enterpriseAuditExportDeliveryReportGenerateForm.reason.trim(),
      idempotency_key: enterpriseAuditExportDeliveryReportGenerateForm.idempotency_key.trim(),
      confirm_generate_report: true,
    };
    setEnterpriseAuditExportDeliveryReportGenerating(true);
    setEnterpriseAuditExportDeliveryReportGenerateMessage('');
    setEnterpriseAuditExportDeliveryReportGenerateResult(null);
    setEnterpriseAuditExportDeliveryReportStoreMessage('');
    setEnterpriseAuditExportDeliveryReportStoreResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.generateAuditExportDeliveryReport(input);
      setEnterpriseAuditExportDeliveryReportGenerateForm(emptyEnterpriseAuditExportDeliveryReportGenerateForm);
      setEnterpriseAuditExportDeliveryReportGenerateResult(result);
      setEnterpriseAuditExportDeliveryReportStoreForm({
        reason: result.reason,
        idempotency_key: result.idempotency_key,
        report_format: result.report_format,
        report_content: result.report_content,
        generated_at: result.generated_at,
        confirm_store_report: false,
      });
      setEnterpriseAuditExportDeliveryReportGenerateMessage(`${result.message} bytes=${result.report_content_byte_count}`);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '生成 Enterprise audit export delivery report 失败');
      setEnterpriseAuditExportDeliveryReportGenerateMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportDeliveryReportGenerating(false);
    }
  };

  const handleStoreEnterpriseAuditExportDeliveryReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportDeliveryReportStoreReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportDeliveryReportStoreInput = {
      reason: enterpriseAuditExportDeliveryReportStoreForm.reason.trim(),
      idempotency_key: enterpriseAuditExportDeliveryReportStoreForm.idempotency_key.trim(),
      report_format: enterpriseAuditExportDeliveryReportStoreForm.report_format,
      report_content: enterpriseAuditExportDeliveryReportStoreForm.report_content.trim(),
      generated_at: enterpriseAuditExportDeliveryReportStoreForm.generated_at.trim(),
      confirm_store_report: true,
    };
    setEnterpriseAuditExportDeliveryReportStoring(true);
    setEnterpriseAuditExportDeliveryReportStoreMessage('');
    setEnterpriseAuditExportDeliveryReportStoreResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.storeAuditExportDeliveryReport(input);
      setEnterpriseAuditExportDeliveryReportStoreForm(emptyEnterpriseAuditExportDeliveryReportStoreForm);
      setEnterpriseAuditExportDeliveryReportStoreResult(result);
      setEnterpriseAuditExportDeliveryReportStoreMessage(`${result.message} checksum=${result.checksum_sha256}`);
      const readiness = await adminEnterpriseApi.getAuditExportDeliveryReportStorageReadiness();
      const storedReadiness = await adminEnterpriseApi.getAuditExportDeliveryReportStoredReadiness();
      setEnterpriseAuditExportDeliveryReportStorageReadiness(readiness);
      setEnterpriseAuditExportDeliveryReportStoredReadiness(storedReadiness);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '存储 Enterprise audit export delivery report 失败');
      setEnterpriseAuditExportDeliveryReportStoreMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportDeliveryReportStoring(false);
    }
  };

  const handlePersistEnterpriseAuditExportWorkerExecutionRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportWorkerExecutionRequestPersistReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportWorkerExecutionRequestPersistInput = {
      task_id: enterpriseAuditExportWorkerExecutionRequestPersistForm.task_id.trim(),
      reason: enterpriseAuditExportWorkerExecutionRequestPersistForm.reason.trim(),
      idempotency_key: enterpriseAuditExportWorkerExecutionRequestPersistForm.idempotency_key.trim(),
      batch_limit: enterpriseAuditExportWorkerExecutionRequestPersistForm.batch_limit,
      confirm_worker_execution: true,
    };
    setEnterpriseAuditExportWorkerExecutionRequestPersisting(true);
    setEnterpriseAuditExportWorkerExecutionRequestPersistMessage('');
    setEnterpriseAuditExportWorkerExecutionRequestPersistResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.persistAuditExportWorkerExecutionRequest(input);
      setEnterpriseAuditExportWorkerExecutionRequestPersistForm(emptyEnterpriseAuditExportWorkerExecutionRequestPersistForm);
      setEnterpriseAuditExportWorkerExecutionRequestPersistResult(result);
      setEnterpriseAuditExportWorkerExecutionRequestPersistMessage(`${result.message} request=${result.request.id}`);
      const persistenceReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionRequestPersistenceReadiness();
      const requestReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionRequestReadiness();
      const dryRunReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionDryRunReadiness();
      const taskReadback = await adminEnterpriseApi.listAuditExportTasks();
      setEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness(persistenceReadiness);
      setEnterpriseAuditExportWorkerExecutionRequestReadiness(requestReadiness);
      setEnterpriseAuditExportWorkerExecutionDryRunReadiness(dryRunReadiness);
      setEnterpriseAuditExportTaskReadback(taskReadback);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '持久化 Enterprise audit export worker execution request 失败');
      setEnterpriseAuditExportWorkerExecutionRequestPersistMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportWorkerExecutionRequestPersisting(false);
    }
  };

  const handleDryRunEnterpriseAuditExportWorkerExecutionRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportWorkerExecutionDryRunReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportWorkerExecutionDryRunInput = {
      request_id: enterpriseAuditExportWorkerExecutionDryRunForm.request_id.trim(),
      reason: enterpriseAuditExportWorkerExecutionDryRunForm.reason.trim(),
      confirm_worker_execution_dry_run: true,
    };
    setEnterpriseAuditExportWorkerExecutionDryRunning(true);
    setEnterpriseAuditExportWorkerExecutionDryRunMessage('');
    setEnterpriseAuditExportWorkerExecutionDryRunResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.dryRunAuditExportWorkerExecutionRequest(input);
      setEnterpriseAuditExportWorkerExecutionDryRunForm(emptyEnterpriseAuditExportWorkerExecutionDryRunForm);
      setEnterpriseAuditExportWorkerExecutionDryRunResult(result);
      setEnterpriseAuditExportWorkerExecutionDryRunMessage(`${result.message} checksum=${result.checksum_sha256}`);
      const dryRunReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionDryRunReadiness();
      const artifactReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionArtifactReadiness();
      const persistenceReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionRequestPersistenceReadiness();
      setEnterpriseAuditExportWorkerExecutionDryRunReadiness(dryRunReadiness);
      setEnterpriseAuditExportWorkerExecutionArtifactReadiness(artifactReadiness);
      setEnterpriseAuditExportWorkerExecutionRequestPersistenceReadiness(persistenceReadiness);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '写入 Enterprise audit export worker execution dry-run result 失败');
      setEnterpriseAuditExportWorkerExecutionDryRunMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportWorkerExecutionDryRunning(false);
    }
  };

  const handleGenerateEnterpriseAuditExportWorkerExecutionArtifact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportWorkerExecutionArtifactReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateInput = {
      request_id: enterpriseAuditExportWorkerExecutionArtifactForm.request_id.trim(),
      reason: enterpriseAuditExportWorkerExecutionArtifactForm.reason.trim(),
      confirm_worker_execution_artifact: true,
    };
    setEnterpriseAuditExportWorkerExecutionArtifactGenerating(true);
    setEnterpriseAuditExportWorkerExecutionArtifactMessage('');
    setEnterpriseAuditExportWorkerExecutionArtifactResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.generateAuditExportWorkerExecutionArtifact(input);
      setEnterpriseAuditExportWorkerExecutionArtifactForm(emptyEnterpriseAuditExportWorkerExecutionArtifactForm);
      setEnterpriseAuditExportWorkerExecutionArtifactResult(result);
      setEnterpriseAuditExportWorkerExecutionArtifactMessage(`${result.message} checksum=${result.checksum_sha256}`);
      const artifactReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionArtifactReadiness();
      const outputStorageReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionOutputStorageReadiness();
      const dryRunReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionDryRunReadiness();
      const taskReadback = await adminEnterpriseApi.listAuditExportTasks();
      setEnterpriseAuditExportWorkerExecutionArtifactReadiness(artifactReadiness);
      setEnterpriseAuditExportWorkerExecutionOutputStorageReadiness(outputStorageReadiness);
      setEnterpriseAuditExportWorkerExecutionDryRunReadiness(dryRunReadiness);
      setEnterpriseAuditExportTaskReadback(taskReadback);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '生成 Enterprise audit export worker execution artifact 失败');
      setEnterpriseAuditExportWorkerExecutionArtifactMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportWorkerExecutionArtifactGenerating(false);
    }
  };

  const handleStoreEnterpriseAuditExportWorkerExecutionOutputStorage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportWorkerExecutionOutputStorageReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreInput = {
      request_id: enterpriseAuditExportWorkerExecutionOutputStorageForm.request_id.trim(),
      reason: enterpriseAuditExportWorkerExecutionOutputStorageForm.reason.trim(),
      confirm_worker_execution_output_storage: true,
    };
    setEnterpriseAuditExportWorkerExecutionOutputStorageStoring(true);
    setEnterpriseAuditExportWorkerExecutionOutputStorageMessage('');
    setEnterpriseAuditExportWorkerExecutionOutputStorageResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.storeAuditExportWorkerExecutionOutputStorage(input);
      setEnterpriseAuditExportWorkerExecutionOutputStorageForm(emptyEnterpriseAuditExportWorkerExecutionOutputStorageForm);
      setEnterpriseAuditExportWorkerExecutionOutputStorageResult(result);
      setEnterpriseAuditExportWorkerExecutionOutputStorageMessage(`${result.message} storage=${result.output_storage_path}`);
      const outputStorageReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionOutputStorageReadiness();
      const taskCompletionReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionTaskCompletionReadiness();
      const taskReadback = await adminEnterpriseApi.listAuditExportTasks();
      setEnterpriseAuditExportWorkerExecutionOutputStorageReadiness(outputStorageReadiness);
      setEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness(taskCompletionReadiness);
      setEnterpriseAuditExportTaskReadback(taskReadback);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '写入 Enterprise audit export worker execution output storage metadata 失败');
      setEnterpriseAuditExportWorkerExecutionOutputStorageMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportWorkerExecutionOutputStorageStoring(false);
    }
  };

  const handleCompleteEnterpriseAuditExportWorkerExecutionTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportWorkerExecutionTaskCompletionReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionInput = {
      request_id: enterpriseAuditExportWorkerExecutionTaskCompletionForm.request_id.trim(),
      reason: enterpriseAuditExportWorkerExecutionTaskCompletionForm.reason.trim(),
      confirm_worker_execution_task_completion: true,
    };
    setEnterpriseAuditExportWorkerExecutionTaskCompleting(true);
    setEnterpriseAuditExportWorkerExecutionTaskCompletionMessage('');
    setEnterpriseAuditExportWorkerExecutionTaskCompletionResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.completeAuditExportWorkerExecutionTask(input);
      setEnterpriseAuditExportWorkerExecutionTaskCompletionForm(emptyEnterpriseAuditExportWorkerExecutionTaskCompletionForm);
      setEnterpriseAuditExportWorkerExecutionTaskCompletionResult(result);
      setEnterpriseAuditExportWorkerExecutionTaskCompletionMessage(`${result.message} transition=${result.transition}`);
      const taskCompletionReadiness = await adminEnterpriseApi.getAuditExportWorkerExecutionTaskCompletionReadiness();
      const taskReadback = await adminEnterpriseApi.listAuditExportTasks();
      const statusReadiness = await adminEnterpriseApi.getAuditExportTaskStatusTransitionReadiness();
      const deliveryReportReadiness = await adminEnterpriseApi.getAuditExportDeliveryReportReadiness();
      const deliveryReportCompletedTaskReadiness = await adminEnterpriseApi.getAuditExportDeliveryReportCompletedTaskReadiness();
      setEnterpriseAuditExportWorkerExecutionTaskCompletionReadiness(taskCompletionReadiness);
      setEnterpriseAuditExportTaskReadback(taskReadback);
      setEnterpriseAuditExportTaskStatusTransitionReadiness(statusReadiness);
      setEnterpriseAuditExportDeliveryReportReadiness(deliveryReportReadiness);
      setEnterpriseAuditExportDeliveryReportCompletedTaskReadiness(deliveryReportCompletedTaskReadiness);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '推进 Enterprise audit export worker execution task completed 失败');
      setEnterpriseAuditExportWorkerExecutionTaskCompletionMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportWorkerExecutionTaskCompleting(false);
    }
  };

  const handleTransitionEnterpriseAuditExportTaskStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enterpriseAuditExportTaskStatusTransitionReady === false) {
      return;
    }

    const input: AdminEnterpriseAuditExportTaskStatusTransitionInput = {
      task_id: enterpriseAuditExportTaskStatusTransitionForm.task_id.trim(),
      target_status: enterpriseAuditExportTaskStatusTransitionForm.target_status.trim(),
      reason: enterpriseAuditExportTaskStatusTransitionForm.reason.trim(),
      confirm_status_transition: true,
    };
    setEnterpriseAuditExportTaskStatusTransitioning(true);
    setEnterpriseAuditExportTaskStatusTransitionMessage('');
    setEnterpriseAuditExportTaskStatusTransitionResult(null);
    setError('');
    try {
      const result = await adminEnterpriseApi.transitionAuditExportTaskStatus(input);
      setEnterpriseAuditExportTaskStatusTransitionForm(emptyEnterpriseAuditExportTaskStatusTransitionForm);
      setEnterpriseAuditExportTaskStatusTransitionResult(result);
      setEnterpriseAuditExportTaskStatusTransitionMessage(`${result.message} transition=${result.transition}`);
      const taskReadback = await adminEnterpriseApi.listAuditExportTasks();
      const statusReadiness = await adminEnterpriseApi.getAuditExportTaskStatusTransitionReadiness();
      const deliveryReportReadiness = await adminEnterpriseApi.getAuditExportDeliveryReportReadiness();
      setEnterpriseAuditExportTaskReadback(taskReadback);
      setEnterpriseAuditExportTaskStatusTransitionReadiness(statusReadiness);
      setEnterpriseAuditExportDeliveryReportReadiness(deliveryReportReadiness);
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '转移 Enterprise audit export task 状态失败');
      setEnterpriseAuditExportTaskStatusTransitionMessage(message);
      setError(message);
    } finally {
      setEnterpriseAuditExportTaskStatusTransitioning(false);
    }
  };

  const handleCreateOrganization = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canCreateOrganization === false || organizationCreateReady === false) {
      return;
    }

    const input: AdminEnterpriseOrganizationCreateInput = {
      slug: organizationForm.slug.trim(),
      display_name: organizationForm.display_name.trim(),
      status: organizationForm.status,
    };
    setPendingMutation({
      action: 'organization_create',
      organizationId: null,
      organizationName: `${input.display_name} (${input.slug})`,
      teamId: null,
      teamName: 'none',
      userId: null,
      projectRecordId: null,
      projectName: 'none',
      summary: `创建企业组织 ${input.display_name} (${input.slug})，只写 enterprise_organizations。`,
      organizationCreateInput: input,
      teamCreateInput: null,
      memberBindInput: null,
      projectOwnershipMigrateInput: null,
    });
    setMutationConfirmationError('');
    setMutationConfirmationOpen(true);
  };

  const handleCreateTeam = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canCreateOrganization === false || teamCreateReady === false) {
      return;
    }

    const input: AdminEnterpriseTeamCreateInput = {
      organization_id: teamForm.organization_id,
      slug: teamForm.slug.trim(),
      display_name: teamForm.display_name.trim(),
      status: teamForm.status,
    };
    const organizationName = resolveEnterpriseOrganizationName(organizations, input.organization_id);
    setPendingMutation({
      action: 'team_create',
      organizationId: input.organization_id,
      organizationName,
      teamId: null,
      teamName: `${input.display_name} (${input.slug})`,
      userId: null,
      projectRecordId: null,
      projectName: 'none',
      summary: `在组织 ${organizationName} 下创建企业团队 ${input.display_name} (${input.slug})，只写 enterprise_teams。`,
      organizationCreateInput: null,
      teamCreateInput: input,
      memberBindInput: null,
      projectOwnershipMigrateInput: null,
    });
    setMutationConfirmationError('');
    setMutationConfirmationOpen(true);
  };

  const handleBindMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canCreateOrganization === false || memberBindReady === false) {
      return;
    }

    const input: AdminEnterpriseMemberBindInput = {
      organization_id: memberForm.organization_id,
      team_id: memberForm.team_id,
      user_id: memberForm.user_id,
      status: memberForm.status,
    };
    const organizationName = resolveEnterpriseOrganizationName(organizations, input.organization_id);
    const teamName = resolveEnterpriseTeamName(teams, input.team_id);
    const userName = resolveEnterpriseUserName(users, input.user_id);
    setPendingMutation({
      action: 'member_bind',
      organizationId: input.organization_id,
      organizationName,
      teamId: input.team_id,
      teamName,
      userId: input.user_id,
      projectRecordId: null,
      projectName: 'none',
      summary: `把用户 ${userName} 绑定到组织 ${organizationName} / 团队 ${teamName}，只写 enterprise_members。`,
      organizationCreateInput: null,
      teamCreateInput: null,
      memberBindInput: input,
      projectOwnershipMigrateInput: null,
    });
    setMutationConfirmationError('');
    setMutationConfirmationOpen(true);
  };

  const handleMigrateProjectOwnership = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canCreateOrganization === false || projectOwnershipMigrationReady === false) {
      return;
    }

    const migrationTeamID = projectOwnershipMigrationForm.team_id;
    const confirmedMigrationTeamID = typeof migrationTeamID === 'string'
      && hasEnterpriseOrganizationFormValue(migrationTeamID)
      ? migrationTeamID
      : undefined;
    const input: AdminEnterpriseProjectOwnershipMigrateInput = {
      project_record_id: projectOwnershipMigrationForm.project_record_id,
      organization_id: projectOwnershipMigrationForm.organization_id,
      team_id: confirmedMigrationTeamID,
      confirm_migrate: projectOwnershipMigrationForm.confirm_migrate,
    };
    const organizationName = resolveEnterpriseOrganizationName(organizations, input.organization_id);
    const teamId = resolveEnterpriseProjectOwnershipMigrationTeamId(input);
    const teamName = resolveEnterpriseProjectOwnershipMigrationTeamName(teams, teamId);
    const teamSummarySegment = getEnterpriseProjectOwnershipMigrationTeamSummarySegment(teamName);
    const projectName = resolveEnterpriseProjectName(projectOwnershipPreflight, input.project_record_id);
    setPendingMutation({
      action: 'project_ownership_migrate',
      organizationId: input.organization_id,
      organizationName,
      teamId,
      teamName,
      userId: null,
      projectRecordId: input.project_record_id,
      projectName,
      summary: `把项目 ${projectName} 映射到组织 ${organizationName}${teamSummarySegment}，只写 enterprise_project_ownerships。`,
      organizationCreateInput: null,
      teamCreateInput: null,
      memberBindInput: null,
      projectOwnershipMigrateInput: input,
    });
    setMutationConfirmationError('');
    setMutationConfirmationOpen(true);
  };

  const handleRecordProjectAccessGuardActivationManualApproval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectAccessGuardActivationManualApprovalReady === false) {
      return;
    }

    const input: AdminEnterpriseProjectAccessGuardActivationManualApprovalInput = {
      confirm_manual_approval: true,
      approval_note: projectAccessGuardActivationManualApprovalNote.trim(),
    };
    setProjectAccessGuardActivationManualApprovalSubmitting(true);
    setProjectAccessGuardActivationManualApprovalMessage('');
    setError('');
    try {
      const result = await adminEnterpriseApi.recordProjectAccessGuardActivationManualApproval(input);
      setProjectAccessGuardActivationManualApprovalNote('');
      setProjectAccessGuardActivationManualApprovalMessage(`${result.message} Event ID：${result.event_id}`);
      await loadEnterpriseReadiness();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '记录 Project Access Guard activation manual approval 失败');
      setProjectAccessGuardActivationManualApprovalMessage(message);
      setError(message);
    } finally {
      setProjectAccessGuardActivationManualApprovalSubmitting(false);
    }
  };

  const handleRecordProjectAccessGuardActivationExecution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectAccessGuardActivationExecutionReady === false) {
      return;
    }

    const input: AdminEnterpriseProjectAccessGuardActivationExecutionInput = {
      confirm_activation_execution: true,
      execution_note: projectAccessGuardActivationExecutionNote.trim(),
    };
    setProjectAccessGuardActivationExecutionSubmitting(true);
    setProjectAccessGuardActivationExecutionMessage('');
    setError('');
    try {
      const result = await adminEnterpriseApi.recordProjectAccessGuardActivationExecution(input);
      setProjectAccessGuardActivationExecutionNote('');
      setProjectAccessGuardActivationExecutionMessage(`${result.message} Event ID：${result.event_id}`);
      await loadEnterpriseReadiness();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '记录 Project Access Guard activation execution 失败');
      setProjectAccessGuardActivationExecutionMessage(message);
      setError(message);
    } finally {
      setProjectAccessGuardActivationExecutionSubmitting(false);
    }
  };

  const handleRecordProjectAccessGuardPostActivationValidation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectAccessGuardPostActivationValidationReady === false) {
      return;
    }

    const input: AdminEnterpriseProjectAccessGuardPostActivationValidationInput = {
      confirm_post_activation_validation: true,
      validation_note: projectAccessGuardPostActivationValidationNote.trim(),
    };
    setProjectAccessGuardPostActivationValidationSubmitting(true);
    setProjectAccessGuardPostActivationValidationMessage('');
    setError('');
    try {
      const result = await adminEnterpriseApi.recordProjectAccessGuardPostActivationValidation(input);
      setProjectAccessGuardPostActivationValidationNote('');
      setProjectAccessGuardPostActivationValidationMessage(`${result.message} Event ID：${result.event_id}`);
      await loadEnterpriseReadiness();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '记录 Project Access Guard post-activation validation 失败');
      setProjectAccessGuardPostActivationValidationMessage(message);
      setError(message);
    } finally {
      setProjectAccessGuardPostActivationValidationSubmitting(false);
    }
  };

  const handleRecordProjectAccessGuardRollbackEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectAccessGuardRollbackEvidenceReady === false) {
      return;
    }

    const input: AdminEnterpriseProjectAccessGuardRollbackEvidenceInput = {
      confirm_rollback_evidence: true,
      rollback_note: projectAccessGuardRollbackEvidenceNote.trim(),
      rollback_reference: projectAccessGuardRollbackEvidenceReference.trim(),
    };
    setProjectAccessGuardRollbackEvidenceSubmitting(true);
    setProjectAccessGuardRollbackEvidenceMessage('');
    setError('');
    try {
      const result = await adminEnterpriseApi.recordProjectAccessGuardRollbackEvidence(input);
      setProjectAccessGuardRollbackEvidenceNote('');
      setProjectAccessGuardRollbackEvidenceReference('');
      setProjectAccessGuardRollbackEvidenceMessage(`${result.message} Event ID：${result.event_id} Rollback Reference：${result.rollback_reference}`);
      await loadEnterpriseReadiness();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '记录 Project Access Guard rollback evidence 失败');
      setProjectAccessGuardRollbackEvidenceMessage(message);
      setError(message);
    } finally {
      setProjectAccessGuardRollbackEvidenceSubmitting(false);
    }
  };

  const handleActivateProjectAccessGuardAuthorization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectAccessGuardAuthorizationActivationReady === false) {
      return;
    }

    const input: AdminEnterpriseProjectAccessGuardAuthorizationActivationInput = {
      confirm_enterprise_authorization_activation: true,
      activation_note: projectAccessGuardAuthorizationActivationNote.trim(),
    };
    setProjectAccessGuardAuthorizationActivationSubmitting(true);
    setProjectAccessGuardAuthorizationActivationMessage('');
    setError('');
    try {
      const result = await adminEnterpriseApi.activateProjectAccessGuardAuthorization(input);
      setProjectAccessGuardAuthorizationActivationNote('');
      setProjectAccessGuardAuthorizationActivationMessage(
        `${result.message} Event ID：${result.event_id} ${result.previous_mode} -> ${result.current_mode}`,
      );
      await loadEnterpriseReadiness();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '激活 Project Access Guard enterprise authorization 失败');
      setProjectAccessGuardAuthorizationActivationMessage(message);
      setError(message);
    } finally {
      setProjectAccessGuardAuthorizationActivationSubmitting(false);
    }
  };

  const cancelEnterpriseMutationConfirmation = () => {
    if (mutationSubmitting === true) {
      return;
    }
    setMutationConfirmationOpen(false);
    setMutationConfirmationError('');
    setPendingMutation(null);
  };

  const handleConfirmEnterpriseMutation = async () => {
    if (pendingMutation === null) {
      return;
    }

    setMutationSubmitting(true);
    setError('');
    setMutationConfirmationError('');
    try {
      if (pendingMutation.action === 'organization_create') {
        if (pendingMutation.organizationCreateInput === null) {
          return;
        }
        setOrganizationCreating(true);
        setOrganizationCreateMessage('');
        const organization = await adminEnterpriseApi.createOrganization(pendingMutation.organizationCreateInput);
        setOrganizationForm(emptyOrganizationForm);
        setOrganizationCreateMessage(`已创建企业组织：${organization.display_name} (${organization.slug})`);
      }
      if (pendingMutation.action === 'team_create') {
        if (pendingMutation.teamCreateInput === null) {
          return;
        }
        setTeamCreating(true);
        setTeamCreateMessage('');
        const team = await adminEnterpriseApi.createTeam(pendingMutation.teamCreateInput);
        setTeamForm(emptyTeamForm);
        setTeamCreateMessage(`已创建企业团队：${team.display_name} (${team.slug})`);
      }
      if (pendingMutation.action === 'member_bind') {
        if (pendingMutation.memberBindInput === null) {
          return;
        }
        setMemberBinding(true);
        setMemberBindMessage('');
        const member = await adminEnterpriseApi.bindMember(pendingMutation.memberBindInput);
        setMemberForm(emptyMemberForm);
        setMemberBindMessage(`已绑定企业成员：${member.user_id}`);
      }
      if (pendingMutation.action === 'project_ownership_migrate') {
        if (pendingMutation.projectOwnershipMigrateInput === null) {
          return;
        }
        setProjectOwnershipMigrating(true);
        setProjectOwnershipMigrationMessage('');
        const result = await adminEnterpriseApi.migrateProjectOwnership(pendingMutation.projectOwnershipMigrateInput);
        setProjectOwnershipMigrationForm(emptyProjectOwnershipMigrationForm);
        setProjectOwnershipMigrationMessage(result.message);
      }
      setMutationConfirmationOpen(false);
      setPendingMutation(null);
      await loadEnterpriseReadiness();
    } catch (err: unknown) {
      const message = formatAdminOperationFailure(err, '执行企业治理写入失败');
      setMutationConfirmationError(message);
      setError(message);
    } finally {
      setOrganizationCreating(false);
      setTeamCreating(false);
      setMemberBinding(false);
      setProjectOwnershipMigrating(false);
      setMutationSubmitting(false);
    }
  };

  const ssoConfigValues = useMemo(() => (
    buildAdminEnterpriseSsoConfigValueMap(Object.fromEntries(
      getAdminEnterpriseSsoConfigEntries(ssoConfigs),
    ))
  ), [ssoConfigs]);

  const ssoReadinessStatus = useMemo(() => (
    resolveAdminEnterpriseSsoReadinessStatus(ssoConfigValues)
  ), [ssoConfigValues]);

  const readinessInput = useMemo<AdminEnterpriseGovernanceReadinessInput>(() => ({
    userCount: users.length,
    roleCount: roles.length,
    permissionCount: permissions.length,
    auditLogCount: auditLogs.length,
    runtimeProjectCount: runtimeProjects.length,
    providerPreflightItemCount: readProviderPreflightItemCount(providerPreflight),
    providerBlockedCount: readProviderPreflightCount(providerPreflight, 'blocked'),
    providerSkippedCount: readProviderPreflightCount(providerPreflight, 'skipped'),
    ssoConfigCount: ssoConfigs.length,
    ssoConfiguredCount: countConfiguredEnterpriseSsoConfigs(ssoConfigValues),
    ssoRequiredConfiguredCount: countConfiguredEnterpriseSsoRequiredConfigs(ssoConfigValues),
    ssoRequiredConfigCount: ADMIN_ENTERPRISE_SSO_REQUIRED_CONFIG_KEYS.length,
    ssoEnabled: ssoConfigValues['enterprise.sso.enabled'].trim() === 'true',
    ssoReadinessStatus,
    organizationCount: organizationReadiness !== null ? organizationReadiness.organization_count : 0,
    teamCount: organizationReadiness !== null ? organizationReadiness.team_count : 0,
    memberCount: organizationReadiness !== null ? organizationReadiness.member_count : 0,
    organizationReadinessStatus: organizationReadiness !== null ? organizationReadiness.readiness_status : 'schema_ready_no_data',
    projectOwnershipProjectCount: projectOwnershipReadiness !== null ? projectOwnershipReadiness.project_count : 0,
    projectOwnershipLegacyUserOwnedProjectCount: projectOwnershipReadiness !== null ? projectOwnershipReadiness.legacy_user_owned_project_count : 0,
    projectOwnershipOrganizationProjectCount: projectOwnershipReadiness !== null ? projectOwnershipReadiness.organization_project_count : 0,
    projectOwnershipUnmigratedProjectCount: projectOwnershipReadiness !== null ? projectOwnershipReadiness.unmigrated_project_count : 0,
    projectOwnershipReadinessStatus: projectOwnershipReadiness !== null ? projectOwnershipReadiness.readiness_status : 'no_projects',
    projectOwnershipPreflightCandidateProjectCount: projectOwnershipPreflight !== null ? projectOwnershipPreflight.candidate_project_count : 0,
    projectOwnershipPreflightExistingOwnershipCount: projectOwnershipPreflight !== null ? projectOwnershipPreflight.existing_ownership_count : 0,
    projectOwnershipPreflightStatus: projectOwnershipPreflight !== null ? projectOwnershipPreflight.preflight_status : 'no_projects',
    projectOwnershipMappingCount: projectOwnershipMappings !== null ? projectOwnershipMappings.ownership_count : 0,
    projectOwnershipMissingProjectCount: projectOwnershipMappings !== null ? projectOwnershipMappings.missing_project_count : 0,
    projectOwnershipMappingStatus: projectOwnershipMappings !== null ? projectOwnershipMappings.mapping_status : 'no_mappings',
    projectOwnershipOwnerGuardMappedProjectCount: projectOwnershipOwnerGuardReadiness !== null ? projectOwnershipOwnerGuardReadiness.mapped_project_count : 0,
    projectOwnershipOwnerGuardUnmappedProjectCount: projectOwnershipOwnerGuardReadiness !== null ? projectOwnershipOwnerGuardReadiness.unmapped_project_count : 0,
    projectOwnershipOwnerGuardExtraOwnershipCount: projectOwnershipOwnerGuardReadiness !== null ? projectOwnershipOwnerGuardReadiness.extra_ownership_count : 0,
    projectOwnershipOwnerGuardStatus: projectOwnershipOwnerGuardReadiness !== null ? projectOwnershipOwnerGuardReadiness.owner_guard_status : 'no_projects',
    projectAccessGuardSwitchMappedProjectCount: projectAccessGuardSwitchReadiness !== null ? projectAccessGuardSwitchReadiness.mapped_project_count : 0,
    projectAccessGuardSwitchUnmappedProjectCount: projectAccessGuardSwitchReadiness !== null ? projectAccessGuardSwitchReadiness.unmapped_project_count : 0,
    projectAccessGuardSwitchExtraOwnershipCount: projectAccessGuardSwitchReadiness !== null ? projectAccessGuardSwitchReadiness.extra_ownership_count : 0,
    projectAccessGuardSwitchCanSwitch: projectAccessGuardSwitchReadiness !== null ? projectAccessGuardSwitchReadiness.can_switch_to_enterprise_owned : false,
    projectAccessGuardSwitchAuthorizationActive: projectAccessGuardSwitchReadiness !== null ? projectAccessGuardSwitchReadiness.enterprise_authorization_active : false,
    projectAccessGuardSwitchStatus: projectAccessGuardSwitchReadiness !== null ? projectAccessGuardSwitchReadiness.status : 'ownership_repo_unavailable',
    projectAccessGuardAuthorizationDryRunComparedProjectCount: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.compared_project_count : 0,
    projectAccessGuardAuthorizationDryRunAlignedProjectCount: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.aligned_project_count : 0,
    projectAccessGuardAuthorizationDryRunEnterpriseUnavailableProjectCount: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.enterprise_unavailable_project_count : 0,
    projectAccessGuardAuthorizationDryRunLegacyGrantedEnterpriseBlockedCount: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.legacy_granted_enterprise_blocked_count : 0,
    projectAccessGuardAuthorizationDryRunLegacyBlockedEnterpriseGrantedCount: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.legacy_blocked_enterprise_granted_count : 0,
    projectAccessGuardAuthorizationDryRunDriftCandidateCount: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.drift_candidates.length : 0,
    projectAccessGuardAuthorizationDryRunAuthorizationActive: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.enterprise_authorization_active : false,
    projectAccessGuardAuthorizationDryRunStatus: projectAccessGuardAuthorizationDryRunEvidence !== null ? projectAccessGuardAuthorizationDryRunEvidence.status : 'ownership_repo_unavailable',
    projectAccessGuardActivationCanActivate: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.can_activate_enterprise_owned : false,
    projectAccessGuardActivationSwitchStatus: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.switch_status : 'ownership_repo_unavailable',
    projectAccessGuardActivationAuthorizationDryRunStatus: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.authorization_dry_run_status : 'ownership_repo_unavailable',
    projectAccessGuardActivationMappedProjectCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.mapped_project_count : 0,
    projectAccessGuardActivationUnmappedProjectCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.unmapped_project_count : 0,
    projectAccessGuardActivationExtraOwnershipCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.extra_ownership_count : 0,
    projectAccessGuardActivationComparedProjectCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.compared_project_count : 0,
    projectAccessGuardActivationAlignedProjectCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.aligned_project_count : 0,
    projectAccessGuardActivationEnterpriseUnavailableCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.enterprise_unavailable_count : 0,
    projectAccessGuardActivationAuthorizationDriftCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.authorization_drift_count : 0,
    projectAccessGuardActivationBlockerCandidateCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.blocker_candidates.length : 0,
    projectAccessGuardActivationReviewItemCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.review_items.length : 0,
    projectAccessGuardActivationReviewBlockedCount: countAdminEnterpriseProjectAccessGuardActivationReviewItemsByStatus(projectAccessGuardActivationReadiness, 'blocked'),
    projectAccessGuardActivationReviewManualRequiredCount: countAdminEnterpriseProjectAccessGuardActivationReviewItemsByStatus(projectAccessGuardActivationReadiness, 'manual_required'),
    projectAccessGuardActivationAuditPlanItemCount: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.audit_plan_items.length : 0,
    projectAccessGuardActivationAuditPlanBlockedCount: countAdminEnterpriseProjectAccessGuardActivationAuditPlanItemsByStatus(projectAccessGuardActivationReadiness, 'blocked'),
    projectAccessGuardActivationAuditPlanManualRequiredCount: countAdminEnterpriseProjectAccessGuardActivationAuditPlanItemsByStatus(projectAccessGuardActivationReadiness, 'manual_required'),
    projectAccessGuardActivationAuthorizationActive: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.enterprise_authorization_active : false,
    projectAccessGuardActivationStatus: projectAccessGuardActivationReadiness !== null ? projectAccessGuardActivationReadiness.status : 'ownership_repo_unavailable',
    projectAccessGuardActivationAuditEventCount: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.audit_event_count : 0,
    projectAccessGuardActivationAuditRequiredEventTypeCount: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.required_event_type_count : 0,
    projectAccessGuardActivationAuditMissingRequiredEventTypeCount: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.missing_required_event_type_count : 0,
    projectAccessGuardActivationAuditRecentEventCount: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.recent_events.length : 0,
    projectAccessGuardActivationAuditPayloadIntegrityIssueCount: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.payload_integrity_issue_count : 0,
    projectAccessGuardActivationAuditPayloadIntegrityStatus: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.payload_integrity_status : 'payload_no_events',
    projectAccessGuardActivationAuditMetadataIntegrityIssueCount: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.metadata_integrity_issue_count : 0,
    projectAccessGuardActivationAuditMetadataIntegrityStatus: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.metadata_integrity_status : 'metadata_no_events',
    projectAccessGuardActivationAuditStatus: projectAccessGuardActivationAuditReadiness !== null ? projectAccessGuardActivationAuditReadiness.readiness_status : 'schema_ready_no_events',
    enterpriseAuditCoverageAdminAuditLogCount: enterpriseAuditCoverageReadiness !== null ? enterpriseAuditCoverageReadiness.admin_audit_log_count : 0,
    enterpriseAuditCoverageActivationAuditEventCount: enterpriseAuditCoverageReadiness !== null ? enterpriseAuditCoverageReadiness.activation_audit_event_count : 0,
    enterpriseAuditCoverageCoveredSourceCount: enterpriseAuditCoverageReadiness !== null ? enterpriseAuditCoverageReadiness.covered_source_count : 0,
    enterpriseAuditCoverageRequiredSourceCount: enterpriseAuditCoverageReadiness !== null ? enterpriseAuditCoverageReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_COVERAGE_REQUIRED_SOURCE_COUNT,
    enterpriseAuditCoverageStatus: enterpriseAuditCoverageReadiness !== null ? enterpriseAuditCoverageReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditExportAdminAuditLogCount: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.admin_audit_log_count : 0,
    enterpriseAuditExportActivationAuditEventCount: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.activation_audit_event_count : 0,
    enterpriseAuditExportSampleCount: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.export_sample_count : 0,
    enterpriseAuditExportSampleLimit: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.export_sample_limit : ADMIN_ENTERPRISE_AUDIT_EXPORT_SAMPLE_LIMIT,
    enterpriseAuditExportMaxWindow: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.max_export_window : ADMIN_ENTERPRISE_AUDIT_EXPORT_MAX_WINDOW,
    enterpriseAuditExportCoveredSourceCount: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.covered_source_count : 0,
    enterpriseAuditExportRequiredSourceCount: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_REQUIRED_SOURCE_COUNT,
    enterpriseAuditExportStatus: enterpriseAuditExportReadiness !== null ? enterpriseAuditExportReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditExportQuerySampleCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.query_sample_count : 0,
    enterpriseAuditExportQuerySampleLimit: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.query_sample_limit : ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_SAMPLE_LIMIT,
    enterpriseAuditExportQueryMaxWindow: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.max_query_window : ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_MAX_WINDOW,
    enterpriseAuditExportQuerySupportedFilterFieldCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.supported_filter_field_count : 0,
    enterpriseAuditExportQueryRequiredFilterFieldCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.required_filter_field_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_REQUIRED_FILTER_FIELD_COUNT,
    enterpriseAuditExportQuerySampleActionCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.sample_action_count : 0,
    enterpriseAuditExportQuerySampleTargetTypeCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.sample_target_type_count : 0,
    enterpriseAuditExportQuerySampleActorCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.sample_actor_count : 0,
    enterpriseAuditExportQueryTaskCreationEnabled: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.export_task_creation_enabled : false,
    enterpriseAuditExportQueryFileGenerationEnabled: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.export_file_generation_enabled : false,
    enterpriseAuditExportQueryCoveredSourceCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.covered_source_count : 0,
    enterpriseAuditExportQueryRequiredSourceCount: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_REQUIRED_SOURCE_COUNT,
    enterpriseAuditExportQueryStatus: enterpriseAuditExportQueryReadiness !== null ? enterpriseAuditExportQueryReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditExportTaskPreflightSampleCount: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.query_sample_count : 0,
    enterpriseAuditExportTaskPreflightSampleLimit: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.query_sample_limit : ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_SAMPLE_LIMIT,
    enterpriseAuditExportTaskPreflightSupportedFilterFieldCount: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.supported_filter_field_count : 0,
    enterpriseAuditExportTaskPreflightRequiredFilterFieldCount: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.required_filter_field_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_QUERY_REQUIRED_FILTER_FIELD_COUNT,
    enterpriseAuditExportTaskPreflightRetentionPolicyConfigured: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.retention_policy_configured : false,
    enterpriseAuditExportTaskPreflightRetentionDays: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.retention_days : 0,
    enterpriseAuditExportTaskPreflightTaskCreationEnabled: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.export_task_creation_enabled : false,
    enterpriseAuditExportTaskPreflightFileGenerationEnabled: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.export_file_generation_enabled : false,
    enterpriseAuditExportTaskPreflightCoveredSourceCount: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.covered_source_count : 0,
    enterpriseAuditExportTaskPreflightRequiredSourceCount: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_TASK_PREFLIGHT_REQUIRED_SOURCE_COUNT,
    enterpriseAuditExportTaskPreflightStatus: enterpriseAuditExportTaskPreflightReadiness !== null ? enterpriseAuditExportTaskPreflightReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditExportFileFormatSupportedFileFormatCount: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.supported_file_format_count : 0,
    enterpriseAuditExportFileFormatRequiredFileFormatCount: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.required_file_format_count : 0,
    enterpriseAuditExportFileFormatRequiredColumnCount: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.required_column_count : 0,
    enterpriseAuditExportFileFormatSchemaVersion: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.schema_version : '',
    enterpriseAuditExportFileFormatTaskCreationEnabled: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.export_task_creation_enabled : false,
    enterpriseAuditExportFileFormatFileGenerationEnabled: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.export_file_generation_enabled : false,
    enterpriseAuditExportFileFormatCoveredSourceCount: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.covered_source_count : 0,
    enterpriseAuditExportFileFormatRequiredSourceCount: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_FILE_FORMAT_REQUIRED_SOURCE_COUNT,
    enterpriseAuditExportFileFormatStatus: enterpriseAuditExportFileFormatReadiness !== null ? enterpriseAuditExportFileFormatReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditExportFileGeneratorOutputPathPrefix: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.output_path_prefix : '',
    enterpriseAuditExportFileGeneratorFileNameTemplate: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.file_name_template : '',
    enterpriseAuditExportFileGeneratorChecksumAlgorithm: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.checksum_algorithm : '',
    enterpriseAuditExportFileGeneratorMaxRowsPerFile: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.max_rows_per_file : 0,
    enterpriseAuditExportFileGeneratorDryRunEnabled: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.generator_dry_run_enabled : false,
    enterpriseAuditExportFileGeneratorOutputStorageWriteEnabled: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.output_storage_write_enabled : false,
    enterpriseAuditExportFileGeneratorTaskCreationEnabled: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.export_task_creation_enabled : false,
    enterpriseAuditExportFileGeneratorFileGenerationEnabled: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.export_file_generation_enabled : false,
    enterpriseAuditExportFileGeneratorCoveredSourceCount: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.covered_source_count : 0,
    enterpriseAuditExportFileGeneratorRequiredSourceCount: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_FILE_GENERATOR_REQUIRED_SOURCE_COUNT,
    enterpriseAuditExportFileGeneratorStatus: enterpriseAuditExportFileGeneratorReadiness !== null ? enterpriseAuditExportFileGeneratorReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditExportTaskCreateRequestSchemaVersion: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.request_schema_version : '',
    enterpriseAuditExportTaskCreateRequestRequiredFieldCount: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.required_request_field_count : 0,
    enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.idempotency_key_required : false,
    enterpriseAuditExportTaskCreateRequestConfirmationRequired: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.request_confirmation_required : false,
    enterpriseAuditExportTaskCreateRequestTaskCreationEnabled: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.export_task_creation_enabled : false,
    enterpriseAuditExportTaskCreateRequestFileGenerationEnabled: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.export_file_generation_enabled : false,
    enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.output_storage_write_enabled : false,
    enterpriseAuditExportTaskCreateRequestAuditWriteEnabled: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.audit_write_enabled : false,
    enterpriseAuditExportTaskCreateRequestCoveredSourceCount: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.covered_source_count : 0,
    enterpriseAuditExportTaskCreateRequestRequiredSourceCount: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_TASK_CREATE_REQUEST_REQUIRED_SOURCE_COUNT,
    enterpriseAuditExportTaskCreateRequestStatus: enterpriseAuditExportTaskCreateRequestReadiness !== null ? enterpriseAuditExportTaskCreateRequestReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditExportTaskPersistenceExistingTaskCount: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.existing_task_count : 0,
    enterpriseAuditExportTaskPersistenceTableName: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.table_name : '',
    enterpriseAuditExportTaskPersistenceSchemaVersion: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.persistence_schema_version : '',
    enterpriseAuditExportTaskPersistenceRequiredFieldCount: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.required_persistence_field_count : 0,
    enterpriseAuditExportTaskPersistenceIdempotencyKeyUnique: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.idempotency_key_unique : false,
    enterpriseAuditExportTaskPersistenceRequestedByAdminRequired: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.requested_by_admin_required : false,
    enterpriseAuditExportTaskPersistenceTimeRangeRequired: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.time_range_required : false,
    enterpriseAuditExportTaskPersistenceFiltersSnapshotRequired: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.filters_snapshot_required : false,
    enterpriseAuditExportTaskPersistenceTaskCreationEnabled: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.export_task_creation_enabled : false,
    enterpriseAuditExportTaskPersistenceWriteEnabled: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.export_task_persistence_write_enabled : false,
    enterpriseAuditExportTaskPersistenceFileGenerationEnabled: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.export_file_generation_enabled : false,
    enterpriseAuditExportTaskPersistenceOutputStorageWriteEnabled: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.output_storage_write_enabled : false,
    enterpriseAuditExportTaskPersistenceAuditWriteEnabled: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.audit_write_enabled : false,
    enterpriseAuditExportTaskPersistenceProjectWriteEnabled: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.project_write_enabled : false,
    enterpriseAuditExportTaskPersistenceCoveredSourceCount: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.covered_source_count : 0,
    enterpriseAuditExportTaskPersistenceRequiredSourceCount: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_EXPORT_TASK_PERSISTENCE_REQUIRED_SOURCE_COUNT,
    enterpriseAuditExportTaskPersistenceStatus: enterpriseAuditExportTaskPersistenceReadiness !== null ? enterpriseAuditExportTaskPersistenceReadiness.readiness_status : 'no_audit_logs',
    enterpriseAuditRetentionAdminAuditLogCount: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.admin_audit_log_count : 0,
    enterpriseAuditRetentionActivationAuditEventCount: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.activation_audit_event_count : 0,
    enterpriseAuditRetentionPolicyConfigured: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.retention_policy_configured : false,
    enterpriseAuditRetentionDays: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.retention_days : 0,
    enterpriseAuditRetentionMinimumDays: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.minimum_retention_days : ADMIN_ENTERPRISE_AUDIT_RETENTION_MINIMUM_DAYS,
    enterpriseAuditRetentionMaximumDays: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.maximum_retention_days : ADMIN_ENTERPRISE_AUDIT_RETENTION_MAXIMUM_DAYS,
    enterpriseAuditRetentionDeletionEnabled: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.retention_deletion_enabled : false,
    enterpriseAuditRetentionCoveredSourceCount: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.covered_source_count : 0,
    enterpriseAuditRetentionRequiredSourceCount: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.required_source_count : ADMIN_ENTERPRISE_AUDIT_RETENTION_REQUIRED_SOURCE_COUNT,
    enterpriseAuditRetentionStatus: enterpriseAuditRetentionReadiness !== null ? enterpriseAuditRetentionReadiness.readiness_status : 'no_audit_logs',
  }), [auditLogs.length, enterpriseAuditCoverageReadiness, enterpriseAuditExportFileFormatReadiness, enterpriseAuditExportFileGeneratorReadiness, enterpriseAuditExportQueryReadiness, enterpriseAuditExportReadiness, enterpriseAuditExportTaskCreateRequestReadiness, enterpriseAuditExportTaskPersistenceReadiness, enterpriseAuditExportTaskPreflightReadiness, enterpriseAuditRetentionReadiness, organizationReadiness, permissions.length, projectAccessGuardActivationAuditReadiness, projectAccessGuardActivationReadiness, projectAccessGuardAuthorizationDryRunEvidence, projectAccessGuardSwitchReadiness, projectOwnershipMappings, projectOwnershipOwnerGuardReadiness, projectOwnershipPreflight, projectOwnershipReadiness, providerPreflight, roles.length, runtimeProjects.length, ssoConfigValues, ssoConfigs.length, ssoReadinessStatus, users.length]);

  const readinessItems = useMemo(() => (
    buildAdminEnterpriseGovernanceReadinessItems(readinessInput)
  ), [readinessInput]);

  const enterpriseGovernanceSnapshot = buildAdminEnterpriseGovernancePageSnapshot({
    loading,
    error,
    readinessInput,
    readinessItems,
  });
  const enterpriseMutationConfirmationSnapshot = buildAdminEnterpriseMutationConfirmationSnapshot({
    pendingMutation,
    isOpen: mutationConfirmationOpen,
    submitting: mutationSubmitting,
    error: mutationConfirmationError,
  });
  const enterpriseMutationFormLocked = mutationConfirmationOpen || mutationSubmitting;
  const shouldRenderPageError = shouldRenderAdminEnterprisePageError(error);

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminEnterpriseGovernancePageSnapshotStrip snapshot={enterpriseGovernanceSnapshot} />
        <AdminEnterpriseMutationConfirmationSnapshotStrip snapshot={enterpriseMutationConfirmationSnapshot} />
        <div className="text-gray-500">正在加载企业治理 readiness...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">企业治理 Readiness</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            只读汇总企业 SSO、组织治理、RBAC、审计、Runtime 和 Provider 治理的当前接线状态。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadEnterpriseReadiness()}
          disabled={enterpriseGovernanceSnapshot.canReload === false}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          刷新 readiness
        </button>
      </div>

      <AdminEnterpriseGovernancePageSnapshotStrip snapshot={enterpriseGovernanceSnapshot} />
      <AdminEnterpriseMutationConfirmationSnapshotStrip snapshot={enterpriseMutationConfirmationSnapshot} />

      {shouldRenderPageError === true && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <section
        data-testid="admin-enterprise-governance-coverage"
        className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white">企业治理与商业化覆盖</h2>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Identity / RBAC / Project Ownership / Audit Compliance / Private Deployment / Commercial Readiness 已进入统一 Enterprise Governance catalog。
        </p>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {materializeEnterpriseGovernanceCoverageNodes()}
        </div>
      </section>

      <section
        data-testid="admin-enterprise-sso-discovery-readiness"
        className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise SSO OIDC discovery readiness</h2>
        {ssoDiscoveryReadiness === null && (
          <p className="mt-2">Enterprise SSO discovery readiness 尚未返回。</p>
        )}
        {ssoDiscoveryReadiness !== null && (
          <>
            <p className="mt-2">
              状态：{ssoDiscoveryReadiness.status}；
              enabled {getAdminEnterpriseBooleanFactLabel(ssoDiscoveryReadiness.sso_enabled)}；
              provider {ssoDiscoveryReadiness.provider_type || 'unknown'}；
              issuer {ssoDiscoveryReadiness.issuer_url || 'none'}；
              discovery performed {getAdminEnterpriseBooleanFactLabel(ssoDiscoveryReadiness.discovery_request_performed)}；
              HTTP {ssoDiscoveryReadiness.discovery_http_status_code}。
            </p>
            <p className="mt-2">
              client configured {getAdminEnterpriseBooleanFactLabel(ssoDiscoveryReadiness.client_id_configured)}；
              redirect configured {getAdminEnterpriseBooleanFactLabel(ssoDiscoveryReadiness.redirect_uri_configured)}；
              response types {ssoDiscoveryReadiness.response_types_supported_count}；
              scopes {ssoDiscoveryReadiness.scopes_supported_count}。
            </p>
            <p className="mt-2">
              discovered issuer {ssoDiscoveryReadiness.discovered_issuer || 'none'}；
              authorization {ssoDiscoveryReadiness.authorization_endpoint || 'none'}；
              token {ssoDiscoveryReadiness.token_endpoint || 'none'}；
              jwks {ssoDiscoveryReadiness.jwks_uri || 'none'}。
            </p>
            <p className="mt-2">
              login callback {getAdminEnterpriseBooleanFactLabel(ssoDiscoveryReadiness.login_callback_enabled)}；
              session normalization {getAdminEnterpriseBooleanFactLabel(ssoDiscoveryReadiness.session_normalization_enabled)}；
              admin audit write {getAdminEnterpriseBooleanFactLabel(ssoDiscoveryReadiness.admin_audit_write_enabled)}。
            </p>
            <p className="mt-2">{ssoDiscoveryReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{ssoDiscoveryReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读校验 OIDC discovery document；不创建 SSO provider、不写 session、不启用登录回调、不写 admin audit。
            </p>
          </>
        )}
      </section>

      <section
        data-testid="admin-enterprise-private-deployment-readiness"
        className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white">Private deployment readiness</h2>
        {privateDeploymentReadiness === null && (
          <p className="mt-2">Private deployment readiness 尚未返回。</p>
        )}
        {privateDeploymentReadiness !== null && (
          <>
            <p className="mt-2">
              状态：{privateDeploymentReadiness.readiness_status}；
              database {privateDeploymentReadiness.database_type || 'unknown'}；
              database configured {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.database_configured)}；
              supabase configured {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.supabase_configured)}；
              jwt configured {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.jwt_configured)}。
            </p>
            <p className="mt-2">
              system_config {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.system_config_available)}；
              runtime config {privateDeploymentReadiness.runtime_config_key_count}/{privateDeploymentReadiness.required_runtime_config_key_count}；
              covered {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.runtime_config_covered)}；
              migration schema {privateDeploymentReadiness.migration_schema_available_check_count}/{privateDeploymentReadiness.migration_schema_check_count}。
            </p>
            <p className="mt-2">
              container enabled {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.container_enabled)}；
              runtime {privateDeploymentReadiness.container_runtime || 'none'}；
              socket {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.container_socket_configured)}；
              project dir {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.project_directory_configured)}；
              preview gateway {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.preview_gateway_configured)}。
            </p>
            <p className="mt-2">
              env write {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.environment_variable_write_enabled)}；
              migration write {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.database_migration_write_enabled)}；
              container mutation {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.container_mutation_enabled)}；
              external probe {getAdminEnterpriseBooleanFactLabel(privateDeploymentReadiness.external_network_probe_enabled)}。
            </p>
            <p className="mt-2">{privateDeploymentReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{privateDeploymentReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读聚合 bootstrap 配置、DB-backed runtime config、企业治理 migration schema 与容器/Preview 边界；不写 env、不执行 migration、不启动容器、不访问外部网络、不写 admin audit。
            </p>
          </>
        )}
      </section>

      <section
        data-testid="admin-enterprise-commercial-readiness"
        className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <h2 className="font-semibold text-gray-900 dark:text-white">Commercial readiness</h2>
        {commercialReadiness === null && (
          <p className="mt-2">Commercial readiness 尚未返回。</p>
        )}
        {commercialReadiness !== null && (
          <>
            <p className="mt-2">
              状态：{commercialReadiness.readiness_status}；
              project ownership {commercialReadiness.project_ownership_status}；
              enterprise auth {getAdminEnterpriseBooleanFactLabel(commercialReadiness.enterprise_authorization_active)}；
              audit compliance {commercialReadiness.audit_compliance_status}；
              private deployment {commercialReadiness.private_deployment_status}。
            </p>
            <p className="mt-2">
              ownership ready {getAdminEnterpriseBooleanFactLabel(commercialReadiness.project_ownership_ready)}；
              audit ready {getAdminEnterpriseBooleanFactLabel(commercialReadiness.audit_compliance_ready)}；
              deployment ready {getAdminEnterpriseBooleanFactLabel(commercialReadiness.private_deployment_ready)}；
              launch ready {getAdminEnterpriseBooleanFactLabel(commercialReadiness.commercial_launch_ready)}。
            </p>
            <p className="mt-2">
              billing provider {getAdminEnterpriseBooleanFactLabel(commercialReadiness.billing_provider_configured)}；
              subscription write {getAdminEnterpriseBooleanFactLabel(commercialReadiness.subscription_write_enabled)}；
              contract write {getAdminEnterpriseBooleanFactLabel(commercialReadiness.contract_write_enabled)}；
              payment collection {getAdminEnterpriseBooleanFactLabel(commercialReadiness.payment_collection_enabled)}。
            </p>
            <p className="mt-2">{commercialReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{commercialReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读聚合 Project Ownership、Audit Compliance 与 Private Deployment 上游证据；不接入计费 provider、不写订阅、不生成合同、不收款、不写 admin audit。
            </p>
          </>
        )}
      </section>

      <AdminEnterpriseGovernanceReadinessList items={readinessItems} />

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">受控组织创建</h2>
        <p className="mt-2">
          这里只创建 enterprise_organizations 组织真源，不创建团队、不绑定成员、不迁移项目归属、不改变租户隔离或组织级 RBAC。
        </p>
        <form onSubmit={handleCreateOrganization} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
          <input
            value={organizationForm.slug}
            onChange={(event) => setOrganizationForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="organization-slug"
            disabled={canCreateOrganization === false || organizationCreating || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <input
            value={organizationForm.display_name}
            onChange={(event) => setOrganizationForm((prev) => ({ ...prev, display_name: event.target.value }))}
            placeholder="组织显示名"
            disabled={canCreateOrganization === false || organizationCreating || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <select
            value={organizationForm.status}
            onChange={(event) => setOrganizationForm((prev) => ({ ...prev, status: toEnterpriseOrganizationStatus(event.target.value) }))}
            disabled={canCreateOrganization === false || organizationCreating || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <button
            type="submit"
            disabled={canCreateOrganization === false || organizationCreateReady === false || organizationCreating || enterpriseMutationFormLocked}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {organizationCreateActionLabel}
          </button>
        </form>
        {canCreateOrganization === false && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以创建企业组织。</p>
        )}
        {shouldRenderOrganizationCreateMessage === true && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{organizationCreateMessage}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">受控团队创建</h2>
        <p className="mt-2">
          这里只在已存在组织下创建 enterprise_teams 团队真源，不绑定成员、不迁移项目归属、不改变租户隔离或组织级 RBAC。
        </p>
        <form onSubmit={handleCreateTeam} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_160px_auto]">
          <select
            value={teamForm.organization_id}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, organization_id: event.target.value }))}
            disabled={canCreateOrganization === false || teamCreating || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">选择组织</option>
            {materializeAdminEnterpriseOrganizationOptionNodes(organizations)}
          </select>
          <input
            value={teamForm.slug}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="team-slug"
            disabled={canCreateOrganization === false || teamCreating || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <input
            value={teamForm.display_name}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, display_name: event.target.value }))}
            placeholder="团队显示名"
            disabled={canCreateOrganization === false || teamCreating || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <select
            value={teamForm.status}
            onChange={(event) => setTeamForm((prev) => ({ ...prev, status: toEnterpriseTeamStatus(event.target.value) }))}
            disabled={canCreateOrganization === false || teamCreating || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <button
            type="submit"
            disabled={canCreateOrganization === false || teamCreateReady === false || teamCreating || enterpriseMutationFormLocked}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {teamCreateActionLabel}
          </button>
        </form>
        {canCreateOrganization === false && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以创建企业团队。</p>
        )}
        {hasEnterpriseOrganizations(organizations) === false && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">需要先创建企业组织，团队必须归属一个已有组织。</p>
        )}
        {shouldRenderTeamCreateMessage === true && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{teamCreateMessage}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">受控成员绑定</h2>
        <p className="mt-2">
          这里只把已有用户绑定到已有企业组织和团队，写入 enterprise_members 成员真源；成员 role 固定为 member，不接组织级 RBAC。
        </p>
        <form onSubmit={handleBindMember} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_160px_auto]">
          <select
            value={memberForm.organization_id}
            onChange={(event) => setMemberForm((prev) => ({
              ...prev,
              organization_id: event.target.value,
              team_id: '',
            }))}
            disabled={canCreateOrganization === false || memberBinding || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">选择组织</option>
            {materializeAdminEnterpriseOrganizationOptionNodes(organizations)}
          </select>
          <select
            value={memberForm.team_id}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, team_id: event.target.value }))}
            disabled={canCreateOrganization === false || memberBinding || enterpriseMutationFormLocked || hasEnterpriseOrganizationFormValue(memberForm.organization_id) === false}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">选择团队</option>
            {materializeAdminEnterpriseTeamOptionNodes(memberTeams)}
          </select>
          <select
            value={memberForm.user_id}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, user_id: event.target.value }))}
            disabled={canCreateOrganization === false || memberBinding || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">选择用户</option>
            {materializeAdminEnterpriseUserOptionNodes(users)}
          </select>
          <select
            value={memberForm.status}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, status: toEnterpriseMemberStatus(event.target.value) }))}
            disabled={canCreateOrganization === false || memberBinding || enterpriseMutationFormLocked}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <button
            type="submit"
            disabled={canCreateOrganization === false || memberBindReady === false || memberBinding || enterpriseMutationFormLocked}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {memberBindActionLabel}
          </button>
        </form>
        {canCreateOrganization === false && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以绑定企业成员。</p>
        )}
        {hasEnterpriseTeams(teams) === false && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">需要先创建企业团队，成员必须归属一个已有团队。</p>
        )}
        {hasEnterpriseUsers(users) === false && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">需要先存在用户，成员绑定不会创建新用户。</p>
        )}
        {shouldRenderMemberBindMessage === true && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{memberBindMessage}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">项目归属迁移预检</h2>
        {shouldRenderAdminEnterpriseProjectOwnershipPreflightPending(projectOwnershipPreflight) === true && (
          <p className="mt-2">项目归属迁移预检尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseProjectOwnershipPreflightContent(projectOwnershipPreflight) === true && (
          <>
            <p className="mt-2">
              状态：{projectOwnershipPreflight.preflight_status}；项目 {projectOwnershipPreflight.project_count} 个；
              已有显式归属 {projectOwnershipPreflight.existing_ownership_count} 个；
              待迁移候选 {projectOwnershipPreflight.candidate_project_count} 个。
            </p>
            <p className="mt-2">{projectOwnershipPreflight.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{projectOwnershipPreflight.recovery}</p>
            {shouldRenderAdminEnterpriseProjectOwnershipPreflightCandidates(projectOwnershipPreflight) === true && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-700">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">项目</th>
                      <th className="py-2 pr-4 font-medium">project_id</th>
                      <th className="py-2 pr-4 font-medium">owner_user_id</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectOwnershipPreflightCandidateNodes(
                      projectOwnershipPreflight.candidates,
                    )}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  当前仅展示最多 {projectOwnershipPreflight.candidate_limit} 个只读候选；本页面不执行迁移、不写 projects，也不写 enterprise_project_ownerships。
                </p>
              </div>
            )}
            <form onSubmit={handleMigrateProjectOwnership} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                value={projectOwnershipMigrationForm.project_record_id}
                onChange={(event) => setProjectOwnershipMigrationForm((prev) => ({ ...prev, project_record_id: event.target.value }))}
                disabled={canCreateOrganization === false || projectOwnershipMigrating || enterpriseMutationFormLocked || hasAdminEnterpriseProjectOwnershipPreflightCandidates(projectOwnershipPreflight) === false}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">选择待迁移项目</option>
                {materializeAdminEnterpriseProjectOwnershipPreflightCandidateOptionNodes(
                  projectOwnershipPreflight.candidates,
                )}
              </select>
              <select
                value={projectOwnershipMigrationForm.organization_id}
                onChange={(event) => setProjectOwnershipMigrationForm((prev) => ({ ...prev, organization_id: event.target.value, team_id: '' }))}
                disabled={canCreateOrganization === false || projectOwnershipMigrating || enterpriseMutationFormLocked || hasEnterpriseOrganizations(organizations) === false}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">选择组织</option>
                {materializeAdminEnterpriseOrganizationOptionNodes(organizations)}
              </select>
              <select
                value={projectOwnershipMigrationForm.team_id}
                onChange={(event) => setProjectOwnershipMigrationForm((prev) => ({ ...prev, team_id: event.target.value }))}
                disabled={canCreateOrganization === false || projectOwnershipMigrating || enterpriseMutationFormLocked || hasEnterpriseOrganizationFormValue(projectOwnershipMigrationForm.organization_id) === false}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">不绑定团队</option>
                {materializeAdminEnterpriseTeamOptionNodes(projectOwnershipMigrationTeams)}
              </select>
              <button
                type="submit"
                disabled={canCreateOrganization === false || projectOwnershipMigrationReady === false || projectOwnershipMigrating || enterpriseMutationFormLocked}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {projectOwnershipMigrationActionLabel}
              </button>
              <label className="md:col-span-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={projectOwnershipMigrationForm.confirm_migrate}
                  onChange={(event) => setProjectOwnershipMigrationForm((prev) => ({ ...prev, confirm_migrate: event.target.checked }))}
                  disabled={canCreateOrganization === false || projectOwnershipMigrating || enterpriseMutationFormLocked}
                  className="h-4 w-4 rounded border-gray-300"
                />
                我确认本次只写入 enterprise_project_ownerships 映射，不写 projects，不启用租户隔离、组织级 RBAC 或 owner guard。
              </label>
            </form>
            {canCreateOrganization === false && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以执行项目归属迁移映射写入。</p>
            )}
            {shouldRenderAdminEnterpriseProjectOwnershipPreflightEmpty(projectOwnershipPreflight) === true && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">当前没有待迁移候选项目。</p>
            )}
            {shouldRenderProjectOwnershipMigrationMessage === true && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{projectOwnershipMigrationMessage}</p>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">项目归属映射回读</h2>
        {shouldRenderAdminEnterpriseProjectOwnershipMappingsPending(projectOwnershipMappings) === true && (
          <p className="mt-2">项目归属映射回读尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseProjectOwnershipMappingsContent(projectOwnershipMappings) === true && (
          <>
            <p className="mt-2">
              状态：{projectOwnershipMappings.mapping_status}；显式映射 {projectOwnershipMappings.ownership_count} 个；
              当前返回 {projectOwnershipMappings.returned_mapping_count} 个；
              缺失项目真源 {projectOwnershipMappings.missing_project_count} 个。
            </p>
            <p className="mt-2">{projectOwnershipMappings.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{projectOwnershipMappings.recovery}</p>
            {shouldRenderAdminEnterpriseProjectOwnershipMappings(projectOwnershipMappings) === true && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-700">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">项目</th>
                      <th className="py-2 pr-4 font-medium">组织</th>
                      <th className="py-2 pr-4 font-medium">团队</th>
                      <th className="py-2 pr-4 font-medium">来源</th>
                      <th className="py-2 pr-4 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectOwnershipMappingNodes(projectOwnershipMappings.mappings)}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  当前最多回读 {projectOwnershipMappings.mapping_limit} 条显式映射；本区域只读，不改变 projects、owner guard、租户隔离或组织级 RBAC。
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">项目 owner guard 接线 readiness</h2>
        {shouldRenderAdminEnterpriseProjectOwnershipOwnerGuardPending(projectOwnershipOwnerGuardReadiness) === true && (
          <p className="mt-2">项目 owner guard 接线 readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseProjectOwnershipOwnerGuardContent(projectOwnershipOwnerGuardReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{projectOwnershipOwnerGuardReadiness.owner_guard_status}；项目 {projectOwnershipOwnerGuardReadiness.project_count} 个；
              显式映射 {projectOwnershipOwnerGuardReadiness.ownership_count} 个；
              已映射项目 {projectOwnershipOwnerGuardReadiness.mapped_project_count} 个；
              未映射项目 {projectOwnershipOwnerGuardReadiness.unmapped_project_count} 个；
              额外映射 {projectOwnershipOwnerGuardReadiness.extra_ownership_count} 个。
            </p>
            <p className="mt-2">{projectOwnershipOwnerGuardReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{projectOwnershipOwnerGuardReadiness.recovery}</p>
            {shouldRenderAdminEnterpriseProjectOwnershipOwnerGuardUnmappedProjects(projectOwnershipOwnerGuardReadiness) === true && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-700">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">未映射项目</th>
                      <th className="py-2 pr-4 font-medium">项目记录</th>
                      <th className="py-2 pr-4 font-medium">Legacy Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectOwnershipOwnerGuardUnmappedProjectNodes(
                      projectOwnershipOwnerGuardReadiness.unmapped_projects,
                    )}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  当前最多展示 {projectOwnershipOwnerGuardReadiness.preview_limit} 个未映射项目；本区域只读，不修改 requireOwnedProject、workspace_project_access、projects、租户隔离或组织级 RBAC。
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard switch readiness</h2>
        {shouldRenderAdminEnterpriseProjectAccessGuardSwitchPending(projectAccessGuardSwitchReadiness) === true && (
          <p className="mt-2">Project Access Guard switch readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseProjectAccessGuardSwitchContent(projectAccessGuardSwitchReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{projectAccessGuardSwitchReadiness.status}；当前模式 {projectAccessGuardSwitchReadiness.current_mode}；
              目标模式 {projectAccessGuardSwitchReadiness.target_mode}；
              项目 {projectAccessGuardSwitchReadiness.project_count} 个；
              显式映射 {projectAccessGuardSwitchReadiness.ownership_count} 个；
              已映射项目 {projectAccessGuardSwitchReadiness.mapped_project_count} 个；
              未映射项目 {projectAccessGuardSwitchReadiness.unmapped_project_count} 个；
              额外映射 {projectAccessGuardSwitchReadiness.extra_ownership_count} 个。
            </p>
            <p className="mt-2">
              CanSwitchToEnterpriseOwned：{getAdminEnterprisePageBooleanLabel(projectAccessGuardSwitchReadiness.can_switch_to_enterprise_owned)}；
              OwnershipLookupAvailable：{getAdminEnterprisePageBooleanLabel(projectAccessGuardSwitchReadiness.ownership_lookup_available)}；
              EnterpriseAuthorizationActive：{getAdminEnterprisePageBooleanLabel(projectAccessGuardSwitchReadiness.enterprise_authorization_active)}。
            </p>
            <p className="mt-2">{projectAccessGuardSwitchReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardSwitchReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读，只评估 Project Access Guard 从 legacy_user_owned 切到 enterprise_owned 的前置条件；当前不改变 AuthorizeProjectAccess 授权结果、不写 projects、不启用租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard authorization dry-run</h2>
        {shouldRenderAdminEnterpriseProjectAccessGuardDryRunPending(projectAccessGuardAuthorizationDryRunEvidence) === true && (
          <p className="mt-2">Project Access Guard authorization dry-run evidence 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseProjectAccessGuardDryRunContent(projectAccessGuardAuthorizationDryRunEvidence) === true && (
          <>
            <p className="mt-2">
              状态：{projectAccessGuardAuthorizationDryRunEvidence.status}；当前模式 {projectAccessGuardAuthorizationDryRunEvidence.current_mode}；
              目标模式 {projectAccessGuardAuthorizationDryRunEvidence.target_mode}；
              项目 {projectAccessGuardAuthorizationDryRunEvidence.project_count} 个；
              已比较 {projectAccessGuardAuthorizationDryRunEvidence.compared_project_count} 个；
              对齐 {projectAccessGuardAuthorizationDryRunEvidence.aligned_project_count} 个；
              enterprise unavailable {projectAccessGuardAuthorizationDryRunEvidence.enterprise_unavailable_project_count} 个。
            </p>
            <p className="mt-2">
              LegacyGrantedEnterpriseBlocked：{projectAccessGuardAuthorizationDryRunEvidence.legacy_granted_enterprise_blocked_count}；
              LegacyBlockedEnterpriseGranted：{projectAccessGuardAuthorizationDryRunEvidence.legacy_blocked_enterprise_granted_count}；
              DriftPreviewLimit：{projectAccessGuardAuthorizationDryRunEvidence.drift_preview_limit}；
              EnterpriseAuthorizationActive：{getAdminEnterprisePageBooleanLabel(projectAccessGuardAuthorizationDryRunEvidence.enterprise_authorization_active)}。
            </p>
            <p className="mt-2">{projectAccessGuardAuthorizationDryRunEvidence.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardAuthorizationDryRunEvidence.recovery}</p>
            {shouldRenderAdminEnterpriseProjectAccessGuardDryRunDriftCandidates(projectAccessGuardAuthorizationDryRunEvidence) === true && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">项目</th>
                      <th className="py-2 pr-4 font-medium">项目记录</th>
                      <th className="py-2 pr-4 font-medium">Legacy Owner</th>
                      <th className="py-2 pr-4 font-medium">Dry-run</th>
                      <th className="py-2 pr-4 font-medium">Drift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardDryRunDriftCandidateNodes(
                      projectAccessGuardAuthorizationDryRunEvidence.drift_candidates,
                    )}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  当前最多展示 {projectAccessGuardAuthorizationDryRunEvidence.drift_preview_limit} 条 drift candidate。
                </p>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读，只比较 legacy projects.user_id 授权与 enterprise_project_ownerships + enterprise_members active membership 的 hypothetical decision；当前不改变 AuthorizeProjectAccess 授权结果、不写 projects、不启用租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard activation readiness</h2>
        {shouldRenderAdminEnterpriseProjectAccessGuardActivationPending(projectAccessGuardActivationReadiness) === true && (
          <p className="mt-2">Project Access Guard activation readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseProjectAccessGuardActivationContent(projectAccessGuardActivationReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{projectAccessGuardActivationReadiness.status}；当前模式 {projectAccessGuardActivationReadiness.current_mode}；
              目标模式 {projectAccessGuardActivationReadiness.target_mode}；
              CanActivateEnterpriseOwned：{getAdminEnterprisePageBooleanLabel(projectAccessGuardActivationReadiness.can_activate_enterprise_owned)}；
              EnterpriseAuthorizationActive：{getAdminEnterprisePageBooleanLabel(projectAccessGuardActivationReadiness.enterprise_authorization_active)}。
            </p>
            <p className="mt-2">
              SwitchStatus：{projectAccessGuardActivationReadiness.switch_status}；
              AuthorizationDryRunStatus：{projectAccessGuardActivationReadiness.authorization_dry_run_status}；
              项目 {projectAccessGuardActivationReadiness.project_count} 个；
              已映射 {projectAccessGuardActivationReadiness.mapped_project_count} 个；
              未映射 {projectAccessGuardActivationReadiness.unmapped_project_count} 个；
              额外映射 {projectAccessGuardActivationReadiness.extra_ownership_count} 个。
            </p>
            <p className="mt-2">
              已比较 {projectAccessGuardActivationReadiness.compared_project_count} 个；
              对齐 {projectAccessGuardActivationReadiness.aligned_project_count} 个；
              enterprise unavailable {projectAccessGuardActivationReadiness.enterprise_unavailable_count} 个；
              authorization drift {projectAccessGuardActivationReadiness.authorization_drift_count} 个；
              blocker candidates {projectAccessGuardActivationReadiness.blocker_candidates.length} 条；
              review items {projectAccessGuardActivationReadiness.review_items.length} 条；
              audit plan items {projectAccessGuardActivationReadiness.audit_plan_items.length} 条。
            </p>
            {shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditPlanItems(projectAccessGuardActivationReadiness) === true && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Audit Plan</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Message</th>
                      <th className="py-2 pr-4">Recovery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardActivationAuditPlanItemNodes(
                      projectAccessGuardActivationReadiness.audit_plan_items,
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {shouldRenderAdminEnterpriseProjectAccessGuardActivationReviewItems(projectAccessGuardActivationReadiness) === true && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Review</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Message</th>
                      <th className="py-2 pr-4">Recovery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardActivationReviewItemNodes(
                      projectAccessGuardActivationReadiness.review_items,
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {shouldRenderAdminEnterpriseProjectAccessGuardActivationBlockerCandidates(projectAccessGuardActivationReadiness) === true && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">Project</th>
                      <th className="py-2 pr-4">Record</th>
                      <th className="py-2 pr-4">Owner</th>
                      <th className="py-2 pr-4">DryRun</th>
                      <th className="py-2 pr-4">Drift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardActivationBlockerCandidateNodes(
                      projectAccessGuardActivationReadiness.blocker_candidates,
                    )}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  当前最多展示 {projectAccessGuardActivationReadiness.blocker_preview_limit} 条 activation blocker candidate。
                </p>
              </div>
            )}
            <p className="mt-2">{projectAccessGuardActivationReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardActivationReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读，只合成 Project Access Guard switch readiness 与 authorization dry-run evidence；即使 ready_to_activate，也不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、不启用租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard manual approval evidence</h2>
        <p className="mt-2">
          这里只在 activation readiness 已达到 ready_to_activate 且当前管理员为 super_admin 时，写入一条 manual_approval activation audit event。
          它不会修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、不启用租户隔离或组织级 RBAC。
        </p>
        <form onSubmit={handleRecordProjectAccessGuardActivationManualApproval} className="mt-4 grid gap-3">
          <textarea
            value={projectAccessGuardActivationManualApprovalNote}
            onChange={(event) => setProjectAccessGuardActivationManualApprovalNote(event.target.value)}
            placeholder="记录人工审批依据，例如审批人、会议纪要、变更窗口和回滚确认。"
            disabled={canCreateOrganization === false || projectAccessGuardActivationManualApprovalSubmitting || hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === false}
            className="min-h-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={projectAccessGuardActivationManualApprovalReady === false || projectAccessGuardActivationManualApprovalSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {projectAccessGuardActivationManualApprovalActionLabel}
            </button>
            {canCreateOrganization === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以记录 manual approval evidence。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">activation readiness 尚未 ready_to_activate，不能记录人工审批证据。</span>
            )}
          </div>
        </form>
        {shouldRenderProjectAccessGuardActivationManualApprovalMessage === true && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardActivationManualApprovalMessage}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard activation execution evidence</h2>
        <p className="mt-2">
          这里只在 activation readiness ready 且 manual approval 已通过 audit readback 后，追加一条 activation_execution audit event。
          它只记录执行计划确认和 non-execution 结果，不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
        </p>
        <form onSubmit={handleRecordProjectAccessGuardActivationExecution} className="mt-4 grid gap-3">
          <textarea
            value={projectAccessGuardActivationExecutionNote}
            onChange={(event) => setProjectAccessGuardActivationExecutionNote(event.target.value)}
            placeholder="记录 execution 计划依据，例如变更窗口、执行人、验证命令和未执行真实切换的确认。"
            disabled={canCreateOrganization === false || projectAccessGuardActivationExecutionSubmitting || hasAdminEnterpriseProjectAccessGuardActivationManualApprovalEvidence(projectAccessGuardActivationReadiness) === false}
            className="min-h-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={projectAccessGuardActivationExecutionReady === false || projectAccessGuardActivationExecutionSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {projectAccessGuardActivationExecutionActionLabel}
            </button>
            {canCreateOrganization === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以记录 activation execution evidence。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">activation readiness 尚未 ready_to_activate，不能记录 execution evidence。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardActivationManualApprovalEvidence(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">manual approval evidence 尚未通过 audit readback，不能记录 execution evidence。</span>
            )}
          </div>
        </form>
        {shouldRenderProjectAccessGuardActivationExecutionMessage === true && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardActivationExecutionMessage}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard post-activation validation evidence</h2>
        <p className="mt-2">
          这里只在 activation execution 已通过 audit readback 后，追加一条 post_activation_access_validation audit event。
          它只记录 post-activation validation 计划确认；由于真实授权未切换，本入口不会执行真实访问验证、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
        </p>
        <form onSubmit={handleRecordProjectAccessGuardPostActivationValidation} className="mt-4 grid gap-3">
          <textarea
            value={projectAccessGuardPostActivationValidationNote}
            onChange={(event) => setProjectAccessGuardPostActivationValidationNote(event.target.value)}
            placeholder="记录 post-activation validation 计划依据，例如验证账号、验证项目、预期访问矩阵和未执行真实切换的确认。"
            disabled={canCreateOrganization === false || projectAccessGuardPostActivationValidationSubmitting || hasAdminEnterpriseProjectAccessGuardActivationExecutionEvidence(projectAccessGuardActivationReadiness) === false}
            className="min-h-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={projectAccessGuardPostActivationValidationReady === false || projectAccessGuardPostActivationValidationSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {projectAccessGuardPostActivationValidationActionLabel}
            </button>
            {canCreateOrganization === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以记录 post-activation validation evidence。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">activation readiness 尚未 ready_to_activate，不能记录 post-validation evidence。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardActivationExecutionEvidence(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">activation execution evidence 尚未通过 audit readback，不能记录 post-validation evidence。</span>
            )}
          </div>
        </form>
        {shouldRenderProjectAccessGuardPostActivationValidationMessage === true && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardPostActivationValidationMessage}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard rollback evidence</h2>
        <p className="mt-2">
          这里只在 post-activation validation 已通过 audit readback 后，追加一条 rollback_evidence audit event。
          它只记录 rollback runbook 与 rollback reference；本入口不会执行真实回滚、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
        </p>
        <form onSubmit={handleRecordProjectAccessGuardRollbackEvidence} className="mt-4 grid gap-3">
          <input
            value={projectAccessGuardRollbackEvidenceReference}
            onChange={(event) => setProjectAccessGuardRollbackEvidenceReference(event.target.value)}
            placeholder="rollback reference，例如 runbook URL、变更单号或审计证据编号。"
            disabled={canCreateOrganization === false || projectAccessGuardRollbackEvidenceSubmitting || hasAdminEnterpriseProjectAccessGuardPostActivationValidationEvidence(projectAccessGuardActivationReadiness) === false}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <textarea
            value={projectAccessGuardRollbackEvidenceNote}
            onChange={(event) => setProjectAccessGuardRollbackEvidenceNote(event.target.value)}
            placeholder="记录 rollback evidence，例如回滚触发条件、回滚步骤、验证矩阵和未执行真实回滚的确认。"
            disabled={canCreateOrganization === false || projectAccessGuardRollbackEvidenceSubmitting || hasAdminEnterpriseProjectAccessGuardPostActivationValidationEvidence(projectAccessGuardActivationReadiness) === false}
            className="min-h-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={projectAccessGuardRollbackEvidenceReady === false || projectAccessGuardRollbackEvidenceSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {projectAccessGuardRollbackEvidenceActionLabel}
            </button>
            {canCreateOrganization === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">只有 super_admin 可以记录 rollback evidence。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">activation readiness 尚未 ready_to_activate，不能记录 rollback evidence。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardPostActivationValidationEvidence(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs text-amber-600 dark:text-amber-400">post-activation validation evidence 尚未通过 audit readback，不能记录 rollback evidence。</span>
            )}
          </div>
        </form>
        {shouldRenderProjectAccessGuardRollbackEvidenceMessage === true && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardRollbackEvidenceMessage}</p>
        )}
      </section>

      <section
        data-testid="admin-enterprise-project-access-guard-authorization-activation"
        className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <h2 className="font-semibold">Project Access Guard enterprise authorization activation</h2>
        <p className="mt-2">
          这里是真实受控 activation：只有 rollback evidence 已通过 audit readback 后，才会把
          enterprise.project_access_guard.mode 写为 enterprise_owned。写入后 AuthorizeProjectAccess 将消费
          enterprise_project_ownerships 与 enterprise_members；本入口不写 projects、不启用租户隔离或组织级 RBAC。
        </p>
        <form onSubmit={handleActivateProjectAccessGuardAuthorization} className="mt-4 grid gap-3">
          <textarea
            value={projectAccessGuardAuthorizationActivationNote}
            onChange={(event) => setProjectAccessGuardAuthorizationActivationNote(event.target.value)}
            placeholder="记录本次 enterprise authorization activation 的审批结论、执行窗口、回滚引用和验证责任人。"
            disabled={canCreateOrganization === false || projectAccessGuardAuthorizationActivationSubmitting || hasAdminEnterpriseProjectAccessGuardRollbackEvidence(projectAccessGuardActivationReadiness) === false}
            className="min-h-24 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-amber-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={projectAccessGuardAuthorizationActivationReady === false || projectAccessGuardAuthorizationActivationSubmitting}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
            >
              {projectAccessGuardAuthorizationActivationActionLabel}
            </button>
            {canCreateOrganization === false && (
              <span className="text-xs">只有 super_admin 可以执行 enterprise authorization activation。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardActivationManualApprovalReadiness(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs">activation readiness 尚未 ready_to_activate，不能激活 enterprise authorization。</span>
            )}
            {hasAdminEnterpriseProjectAccessGuardRollbackEvidence(projectAccessGuardActivationReadiness) === false && (
              <span className="text-xs">rollback evidence 尚未通过 audit readback，不能激活 enterprise authorization。</span>
            )}
          </div>
        </form>
        {shouldRenderProjectAccessGuardAuthorizationActivationMessage === true && (
          <p className="mt-3 text-xs">{projectAccessGuardAuthorizationActivationMessage}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Project Access Guard activation audit schema</h2>
        {shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditPending(projectAccessGuardActivationAuditReadiness) === true && (
          <p className="mt-2">Project Access Guard activation audit schema readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditContent(projectAccessGuardActivationAuditReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{projectAccessGuardActivationAuditReadiness.readiness_status}；
              审计事件 {projectAccessGuardActivationAuditReadiness.audit_event_count} 条；
              required event types {projectAccessGuardActivationAuditReadiness.required_event_type_count} 个；
              缺失 required event types {projectAccessGuardActivationAuditReadiness.missing_required_event_type_count} 个；
              最近回读 {projectAccessGuardActivationAuditReadiness.recent_events.length}/{projectAccessGuardActivationAuditReadiness.recent_event_limit} 条；
              payload integrity {projectAccessGuardActivationAuditReadiness.payload_integrity_status}；
              payload issues {projectAccessGuardActivationAuditReadiness.payload_integrity_issue_count}/{projectAccessGuardActivationAuditReadiness.payload_integrity_issue_limit}；
              metadata integrity {projectAccessGuardActivationAuditReadiness.metadata_integrity_status}；
              metadata issues {projectAccessGuardActivationAuditReadiness.metadata_integrity_issue_count}/{projectAccessGuardActivationAuditReadiness.metadata_integrity_issue_limit}。
            </p>
            {shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditRequiredEvents(projectAccessGuardActivationAuditReadiness) === true && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Required Event</th>
                      <th className="py-2 pr-4">Recorded</th>
                      <th className="py-2 pr-4">Latest Status</th>
                      <th className="py-2 pr-4">Missing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardActivationAuditRequiredEventNodes(
                      projectAccessGuardActivationAuditReadiness.required_event_items,
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditPayloadIssues(projectAccessGuardActivationAuditReadiness) === true && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Event ID</th>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2 pr-4">Payload Source</th>
                      <th className="py-2 pr-4">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardActivationAuditPayloadIssueNodes(
                      projectAccessGuardActivationAuditReadiness.payload_integrity_issues,
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditMetadataIssues(projectAccessGuardActivationAuditReadiness) === true && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Event ID</th>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2 pr-4">Metadata Source</th>
                      <th className="py-2 pr-4">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardActivationAuditMetadataIssueNodes(
                      projectAccessGuardActivationAuditReadiness.metadata_integrity_issues,
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {shouldRenderAdminEnterpriseProjectAccessGuardActivationAuditRecentEvents(projectAccessGuardActivationAuditReadiness) === true && (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Mode</th>
                      <th className="py-2 pr-4">Readiness</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materializeAdminEnterpriseProjectAccessGuardActivationAuditRecentEventNodes(
                      projectAccessGuardActivationAuditReadiness.recent_events,
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2">{projectAccessGuardActivationAuditReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{projectAccessGuardActivationAuditReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域回读 enterprise_project_access_guard_activation_audits schema、计数和最近事件；manual approval、activation execution、post-activation validation 与 rollback evidence 是当前受控 activation audit 写入入口，不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit coverage readiness</h2>
        {shouldRenderAdminEnterpriseAuditCoveragePending(enterpriseAuditCoverageReadiness) === true && (
          <p className="mt-2">Enterprise audit coverage readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditCoverageContent(enterpriseAuditCoverageReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditCoverageReadiness.readiness_status}；
              Admin audit logs {enterpriseAuditCoverageReadiness.admin_audit_log_count} 条；
              activation audit events {enterpriseAuditCoverageReadiness.activation_audit_event_count} 条；
              覆盖源 {enterpriseAuditCoverageReadiness.covered_source_count}/{enterpriseAuditCoverageReadiness.required_source_count}。
            </p>
            <p className="mt-2">{enterpriseAuditCoverageReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditCoverageReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读聚合 admin_audit_log 与 enterprise_project_access_guard_activation_audits 计数；不新增写入口、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportPending(enterpriseAuditExportReadiness) === true && (
          <p className="mt-2">Enterprise audit export readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportContent(enterpriseAuditExportReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportReadiness.readiness_status}；
              Admin audit logs {enterpriseAuditExportReadiness.admin_audit_log_count} 条；
              activation audit events {enterpriseAuditExportReadiness.activation_audit_event_count} 条；
              export samples {enterpriseAuditExportReadiness.export_sample_count}/{enterpriseAuditExportReadiness.export_sample_limit}；
              max window {enterpriseAuditExportReadiness.max_export_window}；
              覆盖源 {enterpriseAuditExportReadiness.covered_source_count}/{enterpriseAuditExportReadiness.required_source_count}。
            </p>
            <p className="mt-2">{enterpriseAuditExportReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读回读 admin_audit_log 总数、最近样本和 enterprise_project_access_guard_activation_audits 计数；不生成导出文件、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export query readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportQueryPending(enterpriseAuditExportQueryReadiness) === true && (
          <p className="mt-2">Enterprise audit export query readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportQueryContent(enterpriseAuditExportQueryReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportQueryReadiness.readiness_status}；
              query samples {enterpriseAuditExportQueryReadiness.query_sample_count}/{enterpriseAuditExportQueryReadiness.query_sample_limit}；
              max query window {enterpriseAuditExportQueryReadiness.max_query_window}；
              filter fields {enterpriseAuditExportQueryReadiness.supported_filter_field_count}/{enterpriseAuditExportQueryReadiness.required_filter_field_count}；
              sample actions {enterpriseAuditExportQueryReadiness.sample_action_count}；
              target types {enterpriseAuditExportQueryReadiness.sample_target_type_count}；
              actors {enterpriseAuditExportQueryReadiness.sample_actor_count}；
              task creation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportQueryReadiness.export_task_creation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportQueryReadiness.export_file_generation_enabled)}；
              覆盖源 {enterpriseAuditExportQueryReadiness.covered_source_count}/{enterpriseAuditExportQueryReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              Supported filters: {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportQueryReadiness.supported_filter_fields)}
            </p>
            <p className="mt-2">{enterpriseAuditExportQueryReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportQueryReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读回读 admin_audit_log 最近样本和 enterprise_project_access_guard_activation_audits 计数；不创建导出任务、不生成导出文件、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export task preflight readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportTaskPreflightPending(enterpriseAuditExportTaskPreflightReadiness) === true && (
          <p className="mt-2">Enterprise audit export task preflight readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportTaskPreflightContent(enterpriseAuditExportTaskPreflightReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportTaskPreflightReadiness.readiness_status}；
              query samples {enterpriseAuditExportTaskPreflightReadiness.query_sample_count}/{enterpriseAuditExportTaskPreflightReadiness.query_sample_limit}；
              filter fields {enterpriseAuditExportTaskPreflightReadiness.supported_filter_field_count}/{enterpriseAuditExportTaskPreflightReadiness.required_filter_field_count}；
              retention configured {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPreflightReadiness.retention_policy_configured)}；
              retention days {enterpriseAuditExportTaskPreflightReadiness.retention_days}；
              task creation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPreflightReadiness.export_task_creation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPreflightReadiness.export_file_generation_enabled)}；
              覆盖源 {enterpriseAuditExportTaskPreflightReadiness.covered_source_count}/{enterpriseAuditExportTaskPreflightReadiness.required_source_count}。
            </p>
            <p className="mt-2">{enterpriseAuditExportTaskPreflightReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportTaskPreflightReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读评估导出任务创建前置条件；不创建导出任务、不生成导出文件、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export file format readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportFileFormatPending(enterpriseAuditExportFileFormatReadiness) === true && (
          <p className="mt-2">Enterprise audit export file format readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportFileFormatContent(enterpriseAuditExportFileFormatReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportFileFormatReadiness.readiness_status}；
              formats {enterpriseAuditExportFileFormatReadiness.supported_file_format_count}/{enterpriseAuditExportFileFormatReadiness.required_file_format_count}；
              columns {enterpriseAuditExportFileFormatReadiness.required_column_count}；
              schema {enterpriseAuditExportFileFormatReadiness.schema_version}；
              task creation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportFileFormatReadiness.export_task_creation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportFileFormatReadiness.export_file_generation_enabled)}；
              覆盖源 {enterpriseAuditExportFileFormatReadiness.covered_source_count}/{enterpriseAuditExportFileFormatReadiness.required_source_count}。
            </p>
            <p className="mt-2">Supported formats: {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportFileFormatReadiness.supported_file_formats)}</p>
            <p className="mt-1">Required columns: {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportFileFormatReadiness.required_columns)}</p>
            <p className="mt-2">{enterpriseAuditExportFileFormatReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportFileFormatReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明导出文件格式契约；不创建导出任务、不生成导出文件、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export file generator readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportFileGeneratorPending(enterpriseAuditExportFileGeneratorReadiness) === true && (
          <p className="mt-2">Enterprise audit export file generator readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportFileGeneratorContent(enterpriseAuditExportFileGeneratorReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportFileGeneratorReadiness.readiness_status}；
              output prefix {enterpriseAuditExportFileGeneratorReadiness.output_path_prefix}；
              checksum {enterpriseAuditExportFileGeneratorReadiness.checksum_algorithm}；
              max rows {enterpriseAuditExportFileGeneratorReadiness.max_rows_per_file}；
              dry-run {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportFileGeneratorReadiness.generator_dry_run_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportFileGeneratorReadiness.output_storage_write_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportFileGeneratorReadiness.export_file_generation_enabled)}；
              覆盖源 {enterpriseAuditExportFileGeneratorReadiness.covered_source_count}/{enterpriseAuditExportFileGeneratorReadiness.required_source_count}。
            </p>
            <p className="mt-2">File name template: {enterpriseAuditExportFileGeneratorReadiness.file_name_template}</p>
            <p className="mt-2">{enterpriseAuditExportFileGeneratorReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportFileGeneratorReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明导出文件生成器契约；不创建导出任务、不生成导出文件、不写 storage、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export task create request readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportTaskCreateRequestPending(enterpriseAuditExportTaskCreateRequestReadiness) === true && (
          <p className="mt-2">Enterprise audit export task create request readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportTaskCreateRequestContent(enterpriseAuditExportTaskCreateRequestReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportTaskCreateRequestReadiness.readiness_status}；
              request schema {enterpriseAuditExportTaskCreateRequestReadiness.request_schema_version}；
              required fields {enterpriseAuditExportTaskCreateRequestReadiness.required_request_field_count}；
              idempotency key {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskCreateRequestReadiness.idempotency_key_required)}；
              confirmation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskCreateRequestReadiness.request_confirmation_required)}；
              task creation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskCreateRequestReadiness.export_task_creation_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskCreateRequestReadiness.audit_write_enabled)}；
              覆盖源 {enterpriseAuditExportTaskCreateRequestReadiness.covered_source_count}/{enterpriseAuditExportTaskCreateRequestReadiness.required_source_count}。
            </p>
            <p className="mt-2">Required request fields: {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportTaskCreateRequestReadiness.required_request_fields)}</p>
            <p className="mt-2">{enterpriseAuditExportTaskCreateRequestReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportTaskCreateRequestReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明导出任务创建请求契约；不创建导出任务、不生成导出文件、不写 storage、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export task persistence readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportTaskPersistencePending(enterpriseAuditExportTaskPersistenceReadiness) === true && (
          <p className="mt-2">Enterprise audit export task persistence readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportTaskPersistenceContent(enterpriseAuditExportTaskPersistenceReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportTaskPersistenceReadiness.readiness_status}；
              table {enterpriseAuditExportTaskPersistenceReadiness.table_name}；
              schema {enterpriseAuditExportTaskPersistenceReadiness.persistence_schema_version}；
              existing tasks {enterpriseAuditExportTaskPersistenceReadiness.existing_task_count}；
              required fields {enterpriseAuditExportTaskPersistenceReadiness.required_persistence_field_count}；
              idempotency unique {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPersistenceReadiness.idempotency_key_unique)}；
              requested_by_admin required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPersistenceReadiness.requested_by_admin_required)}；
              task creation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPersistenceReadiness.export_task_creation_enabled)}；
              persistence write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPersistenceReadiness.export_task_persistence_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskPersistenceReadiness.project_write_enabled)}；
              覆盖源 {enterpriseAuditExportTaskPersistenceReadiness.covered_source_count}/{enterpriseAuditExportTaskPersistenceReadiness.required_source_count}。
            </p>
            <p className="mt-2">Required persistence fields: {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportTaskPersistenceReadiness.required_persistence_fields)}</p>
            <p className="mt-2">{enterpriseAuditExportTaskPersistenceReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportTaskPersistenceReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明导出任务持久化契约；不创建导出任务、不写任务表、不生成导出文件、不写 storage、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export task readback</h2>
        {shouldRenderAdminEnterpriseAuditExportTaskReadbackPending(enterpriseAuditExportTaskReadback) === true && (
          <p className="mt-2">Enterprise audit export task readback 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportTaskReadbackContent(enterpriseAuditExportTaskReadback) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportTaskReadback.status}；
              returned tasks {enterpriseAuditExportTaskReadback.task_count}/{enterpriseAuditExportTaskReadback.limit}；
              total tasks {enterpriseAuditExportTaskReadback.total_count}；
              persistence {enterpriseAuditExportTaskReadback.persistence_readiness_status}；
              file generation started {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskReadback.export_file_generation_started)}；
              storage write started {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskReadback.output_storage_write_started)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskReadback.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportTaskReadback.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportTaskReadback.recovery}</p>
            <ul className="mt-3 space-y-2">
              {materializeAdminEnterpriseAuditExportTaskReadbackNodes(enterpriseAuditExportTaskReadback.tasks)}
            </ul>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读回读最近企业治理审计导出任务；不生成导出文件、不写 storage、不启动 worker、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export worker readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportWorkerPending(enterpriseAuditExportWorkerReadiness) === true && (
          <p className="mt-2">Enterprise audit export worker readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportWorkerContent(enterpriseAuditExportWorkerReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportWorkerReadiness.readiness_status}；
              readback {enterpriseAuditExportWorkerReadiness.task_readback_status}；
              tasks {enterpriseAuditExportWorkerReadiness.task_count}；
              queued tasks {enterpriseAuditExportWorkerReadiness.queued_task_count}；
              mode {enterpriseAuditExportWorkerReadiness.worker_mode}；
              batch {enterpriseAuditExportWorkerReadiness.worker_batch_size}；
              lease {enterpriseAuditExportWorkerReadiness.worker_lease_seconds}s；
              output prefix {enterpriseAuditExportWorkerReadiness.output_path_prefix}；
              checksum {enterpriseAuditExportWorkerReadiness.checksum_algorithm}；
              覆盖源 {enterpriseAuditExportWorkerReadiness.covered_source_count}/{enterpriseAuditExportWorkerReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              worker dry run {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerReadiness.worker_dry_run_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerReadiness.worker_execution_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportWorkerReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportWorkerReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明企业治理审计导出 worker 输入队列和执行契约；不启动 worker、不生成导出文件、不写 storage、不写任务状态、不写 audit、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export worker execution request readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestPending(enterpriseAuditExportWorkerExecutionRequestReadiness) === true && (
          <p className="mt-2">Enterprise audit export worker execution request readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestContent(enterpriseAuditExportWorkerExecutionRequestReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportWorkerExecutionRequestReadiness.readiness_status}；
              worker {enterpriseAuditExportWorkerExecutionRequestReadiness.worker_readiness_status}；
              status transition {enterpriseAuditExportWorkerExecutionRequestReadiness.status_transition_readiness_status}；
              readback {enterpriseAuditExportWorkerExecutionRequestReadiness.task_readback_status}；
              queued tasks {enterpriseAuditExportWorkerExecutionRequestReadiness.queued_task_count}；
              schema {enterpriseAuditExportWorkerExecutionRequestReadiness.request_schema_version}；
              fields {enterpriseAuditExportWorkerExecutionRequestReadiness.required_request_field_count}；
              batch limit {enterpriseAuditExportWorkerExecutionRequestReadiness.batch_limit}；
              lease {enterpriseAuditExportWorkerExecutionRequestReadiness.worker_lease_seconds}s；
              覆盖源 {enterpriseAuditExportWorkerExecutionRequestReadiness.covered_source_count}/{enterpriseAuditExportWorkerExecutionRequestReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              required fields {enterpriseAuditExportWorkerExecutionRequestReadiness.required_request_fields.join(', ')}；
              confirmation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.request_confirmation_required)}；
              idempotency key {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.idempotency_key_required)}；
              max reason {enterpriseAuditExportWorkerExecutionRequestReadiness.max_reason_length}。
            </p>
            <p className="mt-2">
              request execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.request_execution_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.worker_execution_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.task_status_mutation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportWorkerExecutionRequestReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportWorkerExecutionRequestReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明企业治理审计导出 worker execution request 契约；不执行请求、不启动 worker、不生成导出文件、不写 output storage、不修改任务状态、不写 audit、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export worker execution request persistence readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestPersistencePending(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness) === true && (
          <p className="mt-2">Enterprise audit export worker execution request persistence readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionRequestPersistenceContent(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.readiness_status}；
              request readiness {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.execution_request_readiness_status}；
              existing requests {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.existing_execution_request_count}；
              table {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.table_name}；
              schema {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.persistence_schema_version}；
              request schema {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.request_schema_version}；
              fields {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.required_persistence_field_count}；
              覆盖源 {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.covered_source_count}/{enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              required fields {enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.required_persistence_fields.join(', ')}。
            </p>
            <p className="mt-2">
              idempotency unique {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.idempotency_key_unique)}；
              task reference {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.task_reference_required)}；
              admin reference {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.admin_reference_required)}；
              request payload snapshot {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.request_payload_snapshot_required)}；
              readiness snapshot {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.readiness_snapshot_required)}；
              execution result snapshot {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.execution_result_snapshot_required)}。
            </p>
            <p className="mt-2">
              request persistence write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.request_persistence_write_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.worker_execution_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.task_status_mutation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportWorkerExecutionRequestPersistenceReadiness.recovery}</p>
            <form className="mt-4 space-y-3" onSubmit={handlePersistEnterpriseAuditExportWorkerExecutionRequest}>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-request-task-id">
                  Task ID
                </label>
                <input
                  id="audit-export-worker-execution-request-task-id"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportWorkerExecutionRequestPersistForm.task_id}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionRequestPersistForm((current) => ({
                    ...current,
                    task_id: event.target.value,
                  }))}
                  placeholder="queued enterprise_audit_export_tasks.id"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-request-idempotency">
                    Idempotency key
                  </label>
                  <input
                    id="audit-export-worker-execution-request-idempotency"
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    value={enterpriseAuditExportWorkerExecutionRequestPersistForm.idempotency_key}
                    onChange={(event) => setEnterpriseAuditExportWorkerExecutionRequestPersistForm((current) => ({
                      ...current,
                      idempotency_key: event.target.value,
                    }))}
                    placeholder="worker-exec-request-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-request-batch-limit">
                    Batch limit
                  </label>
                  <input
                    id="audit-export-worker-execution-request-batch-limit"
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    type="number"
                    min={1}
                    value={enterpriseAuditExportWorkerExecutionRequestPersistForm.batch_limit}
                    onChange={(event) => setEnterpriseAuditExportWorkerExecutionRequestPersistForm((current) => ({
                      ...current,
                      batch_limit: Number(event.target.value),
                    }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-request-reason">
                  Reason
                </label>
                <textarea
                  id="audit-export-worker-execution-request-reason"
                  className="mt-1 min-h-20 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportWorkerExecutionRequestPersistForm.reason}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionRequestPersistForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                  placeholder="说明为什么持久化本次受控 worker execution request"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={enterpriseAuditExportWorkerExecutionRequestPersistForm.confirm_worker_execution}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionRequestPersistForm((current) => ({
                    ...current,
                    confirm_worker_execution: event.target.checked,
                  }))}
                />
                <span>confirm_worker_execution=true；本阶段只写 execution request 幂等证据和 admin audit，不启动 worker、不生成导出文件、不写 output storage、不修改任务状态。</span>
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportWorkerExecutionRequestPersistReady === false}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {enterpriseAuditExportWorkerExecutionRequestPersistActionLabel}
              </button>
            </form>
            {shouldRenderEnterpriseAuditExportWorkerExecutionRequestPersistMessage === true && (
              <p className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {enterpriseAuditExportWorkerExecutionRequestPersistMessage}
              </p>
            )}
            {enterpriseAuditExportWorkerExecutionRequestPersistResult !== null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                result {enterpriseAuditExportWorkerExecutionRequestPersistResult.status}；
                request {enterpriseAuditExportWorkerExecutionRequestPersistResult.request.id}；
                task {enterpriseAuditExportWorkerExecutionRequestPersistResult.request.task_id}；
                persisted {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.request_persistence_written)}；
                audit {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.request_audit_written)}；
                worker {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.worker_execution_started)}；
                task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.task_status_mutation_started)}；
                file {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.export_file_generation_started)}；
                output storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.output_storage_write_started)}；
                report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.delivery_report_storage_write_started)}；
                archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.archive_deletion_started)}；
                project {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionRequestPersistResult.project_write_started)}。
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域先只读声明企业治理审计导出 worker execution request 持久化落点，再通过确认表单受控写入执行请求幂等证据和 admin audit；不启动 worker、不生成导出文件、不写 output storage、不修改任务状态、不落报告文件、不删除审计数据、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export worker execution dry-run readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionDryRunPending(enterpriseAuditExportWorkerExecutionDryRunReadiness) === true && (
          <p className="mt-2">Enterprise audit export worker execution dry-run readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionDryRunContent(enterpriseAuditExportWorkerExecutionDryRunReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportWorkerExecutionDryRunReadiness.readiness_status}；
              persistence {enterpriseAuditExportWorkerExecutionDryRunReadiness.persistence_readiness_status}；
              existing requests {enterpriseAuditExportWorkerExecutionDryRunReadiness.existing_execution_request_count}；
              schema {enterpriseAuditExportWorkerExecutionDryRunReadiness.execution_dry_run_schema_version}；
              覆盖源 {enterpriseAuditExportWorkerExecutionDryRunReadiness.covered_source_count}/{enterpriseAuditExportWorkerExecutionDryRunReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              dry-run enabled {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.worker_execution_dry_run_enabled)}；
              real worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.worker_execution_enabled)}；
              execution result persistence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.execution_result_persistence_enabled)}；
              task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.task_status_mutation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.export_file_generation_enabled)}；
              output storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.output_storage_write_enabled)}；
              report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.delivery_report_storage_write_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.archive_deletion_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportWorkerExecutionDryRunReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportWorkerExecutionDryRunReadiness.recovery}</p>
            <form className="mt-4 space-y-3" onSubmit={handleDryRunEnterpriseAuditExportWorkerExecutionRequest}>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-dry-run-request-id">
                  Execution request ID
                </label>
                <input
                  id="audit-export-worker-execution-dry-run-request-id"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportWorkerExecutionDryRunForm.request_id}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionDryRunForm((current) => ({
                    ...current,
                    request_id: event.target.value,
                  }))}
                  placeholder="enterprise_audit_export_worker_execution_requests.id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-dry-run-reason">
                  Reason
                </label>
                <textarea
                  id="audit-export-worker-execution-dry-run-reason"
                  className="mt-1 min-h-20 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportWorkerExecutionDryRunForm.reason}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionDryRunForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                  placeholder="说明为什么写入本次受控 worker execution dry-run result"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={enterpriseAuditExportWorkerExecutionDryRunForm.confirm_worker_execution_dry_run}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionDryRunForm((current) => ({
                    ...current,
                    confirm_worker_execution_dry_run: event.target.checked,
                  }))}
                />
                <span>confirm_worker_execution_dry_run=true；本阶段只写 execution_result/checksum/row_count 和 admin audit，不启动真实 worker、不生成导出文件、不写 output storage、不修改任务状态。</span>
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportWorkerExecutionDryRunReady === false}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {enterpriseAuditExportWorkerExecutionDryRunActionLabel}
              </button>
            </form>
            {shouldRenderEnterpriseAuditExportWorkerExecutionDryRunMessage === true && (
              <p className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {enterpriseAuditExportWorkerExecutionDryRunMessage}
              </p>
            )}
            {enterpriseAuditExportWorkerExecutionDryRunResult !== null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                result {enterpriseAuditExportWorkerExecutionDryRunResult.status}；
                request {enterpriseAuditExportWorkerExecutionDryRunResult.request.id}；
                rows {enterpriseAuditExportWorkerExecutionDryRunResult.row_count}；
                checksum {enterpriseAuditExportWorkerExecutionDryRunResult.checksum_sha256}；
                result written {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.execution_result_written)}；
                audit {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.execution_audit_written)}；
                dry-run {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.worker_execution_dry_run_started)}；
                real worker {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.worker_execution_started)}；
                task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.task_status_mutation_started)}；
                file {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.export_file_generation_started)}；
                output storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.output_storage_write_started)}；
                report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.delivery_report_storage_write_started)}；
                archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.archive_deletion_started)}；
                project {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionDryRunResult.project_write_started)}。
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域通过确认表单受控写入 worker execution dry-run result；只更新 execution request 的 execution_result、checksum、row_count、status/source 并写入 admin audit，不启动真实 worker、不生成导出文件、不写 output storage、不修改任务状态、不落报告文件、不删除审计数据、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export worker execution artifact readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionArtifactPending(enterpriseAuditExportWorkerExecutionArtifactReadiness) === true && (
          <p className="mt-2">Enterprise audit export worker execution artifact readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionArtifactContent(enterpriseAuditExportWorkerExecutionArtifactReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportWorkerExecutionArtifactReadiness.readiness_status}；
              dry-run {enterpriseAuditExportWorkerExecutionArtifactReadiness.dry_run_readiness_status}；
              existing requests {enterpriseAuditExportWorkerExecutionArtifactReadiness.existing_execution_request_count}；
              dry-run completed {enterpriseAuditExportWorkerExecutionArtifactReadiness.dry_run_completed_request_count}；
              artifact schema {enterpriseAuditExportWorkerExecutionArtifactReadiness.execution_artifact_schema_version}；
              max rows {enterpriseAuditExportWorkerExecutionArtifactReadiness.max_rows_per_file}；
              覆盖源 {enterpriseAuditExportWorkerExecutionArtifactReadiness.covered_source_count}/{enterpriseAuditExportWorkerExecutionArtifactReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              output prefix {enterpriseAuditExportWorkerExecutionArtifactReadiness.output_path_prefix}；
              file template {enterpriseAuditExportWorkerExecutionArtifactReadiness.file_name_template}；
              checksum {enterpriseAuditExportWorkerExecutionArtifactReadiness.checksum_algorithm}。
            </p>
            <p className="mt-2">
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.worker_execution_enabled)}；
              result persistence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.execution_result_persistence_enabled)}；
              task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.task_status_mutation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.export_file_generation_enabled)}；
              output storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.output_storage_write_enabled)}；
              report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.delivery_report_storage_write_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.archive_deletion_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportWorkerExecutionArtifactReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportWorkerExecutionArtifactReadiness.recovery}</p>
            <form className="mt-4 space-y-3" onSubmit={handleGenerateEnterpriseAuditExportWorkerExecutionArtifact}>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Dry-run completed request ID</label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportWorkerExecutionArtifactForm.request_id}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionArtifactForm((current) => ({
                    ...current,
                    request_id: event.target.value,
                  }))}
                  placeholder="dry_run_completed worker execution request id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Reason</label>
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportWorkerExecutionArtifactForm.reason}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionArtifactForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                  rows={2}
                  placeholder="说明为什么生成受控 artifact snapshot"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={enterpriseAuditExportWorkerExecutionArtifactForm.confirm_worker_execution_artifact}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionArtifactForm((current) => ({
                    ...current,
                    confirm_worker_execution_artifact: event.target.checked,
                  }))}
                />
                <span>confirm_worker_execution_artifact=true；本阶段只写 artifact metadata、execution_result/checksum/output_path 和 admin audit，不写 output storage、不修改 task status。</span>
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportWorkerExecutionArtifactReady === false}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {enterpriseAuditExportWorkerExecutionArtifactActionLabel}
              </button>
            </form>
            {shouldRenderEnterpriseAuditExportWorkerExecutionArtifactMessage === true && (
              <p className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {enterpriseAuditExportWorkerExecutionArtifactMessage}
              </p>
            )}
            {enterpriseAuditExportWorkerExecutionArtifactResult !== null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                result {enterpriseAuditExportWorkerExecutionArtifactResult.status}；
                request {enterpriseAuditExportWorkerExecutionArtifactResult.request.id}；
                output {enterpriseAuditExportWorkerExecutionArtifactResult.output_path}；
                file {enterpriseAuditExportWorkerExecutionArtifactResult.file_name}；
                rows {enterpriseAuditExportWorkerExecutionArtifactResult.row_count}；
                checksum {enterpriseAuditExportWorkerExecutionArtifactResult.checksum_sha256}；
                result written {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.execution_result_written)}；
                audit {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.execution_audit_written)}；
                real worker {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.worker_execution_started)}；
                task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.task_status_mutation_started)}；
                file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.export_file_generation_started)}；
                output storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.output_storage_write_started)}；
                report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.delivery_report_storage_write_started)}；
                archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.archive_deletion_started)}；
                project {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionArtifactResult.project_write_started)}。
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域通过确认表单受控生成真实 worker execution artifact metadata；只更新 execution request 的 execution_result、checksum、output_path、row_count、status/source 并写入 admin audit，不写 output storage、不修改 task status、不落报告文件、不删除审计数据、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export worker execution output storage readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionOutputStoragePending(enterpriseAuditExportWorkerExecutionOutputStorageReadiness) === true && (
          <p className="mt-2">Enterprise audit export worker execution output storage readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionOutputStorageContent(enterpriseAuditExportWorkerExecutionOutputStorageReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportWorkerExecutionOutputStorageReadiness.readiness_status}；
              artifact {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.artifact_readiness_status}；
              existing requests {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.existing_execution_request_count}；
              artifact generated {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.artifact_generated_request_count}；
              storage schema {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.output_storage_schema_version}；
              覆盖源 {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.covered_source_count}/{enterpriseAuditExportWorkerExecutionOutputStorageReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              storage fields {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.required_storage_field_count}：
              {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.required_storage_fields)}；
              path prefix {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.output_storage_path_prefix}；
              checksum {enterpriseAuditExportWorkerExecutionOutputStorageReadiness.checksum_algorithm}；
              metadata required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.metadata_write_required)}。
            </p>
            <p className="mt-2">
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.worker_execution_enabled)}；
              result persistence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.execution_result_persistence_enabled)}；
              task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.task_status_mutation_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.export_file_generation_enabled)}；
              output storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.output_storage_write_enabled)}；
              report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.delivery_report_storage_write_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.archive_deletion_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportWorkerExecutionOutputStorageReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportWorkerExecutionOutputStorageReadiness.recovery}</p>
            <form className="mt-4 space-y-3" onSubmit={handleStoreEnterpriseAuditExportWorkerExecutionOutputStorage}>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Artifact generated request ID</label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportWorkerExecutionOutputStorageForm.request_id}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionOutputStorageForm((current) => ({
                    ...current,
                    request_id: event.target.value,
                  }))}
                  placeholder="artifact_generated worker execution request id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Reason</label>
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportWorkerExecutionOutputStorageForm.reason}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionOutputStorageForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                  rows={2}
                  placeholder="说明为什么受控写入 output storage metadata"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={enterpriseAuditExportWorkerExecutionOutputStorageForm.confirm_worker_execution_output_storage}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionOutputStorageForm((current) => ({
                    ...current,
                    confirm_worker_execution_output_storage: event.target.checked,
                  }))}
                />
                <span>confirm_worker_execution_output_storage=true；本阶段只写 output storage metadata snapshot 和 admin audit，不生成真实文件、不修改 task status。</span>
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportWorkerExecutionOutputStorageReady === false}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {enterpriseAuditExportWorkerExecutionOutputStorageActionLabel}
              </button>
            </form>
            {shouldRenderEnterpriseAuditExportWorkerExecutionOutputStorageMessage === true && (
              <p className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {enterpriseAuditExportWorkerExecutionOutputStorageMessage}
              </p>
            )}
            {enterpriseAuditExportWorkerExecutionOutputStorageResult !== null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                result {enterpriseAuditExportWorkerExecutionOutputStorageResult.status}；
                request {enterpriseAuditExportWorkerExecutionOutputStorageResult.request.id}；
                storage {enterpriseAuditExportWorkerExecutionOutputStorageResult.output_storage_path}；
                output {enterpriseAuditExportWorkerExecutionOutputStorageResult.output_path}；
                schema {enterpriseAuditExportWorkerExecutionOutputStorageResult.output_storage_schema_version}；
                rows {enterpriseAuditExportWorkerExecutionOutputStorageResult.row_count}；
                checksum {enterpriseAuditExportWorkerExecutionOutputStorageResult.checksum_sha256}；
                metadata {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.metadata_written)}；
                storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.output_storage_write_started)}；
                audit {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.execution_audit_written)}；
                real worker {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.worker_execution_started)}；
                task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.task_status_mutation_started)}；
                file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.export_file_generation_started)}；
                report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.delivery_report_storage_write_started)}；
                archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.archive_deletion_started)}；
                project {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionOutputStorageResult.project_write_started)}。
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域先只读冻结 worker execution output storage 的路径、字段、metadata 和 checksum 契约，再通过确认表单受控写入 output storage metadata snapshot 与 admin audit；不生成真实文件、不修改 task status、不落报告文件、不删除审计数据、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export worker execution task completion readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionTaskCompletionPending(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness) === true && (
          <p className="mt-2">Enterprise audit export worker execution task completion readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportWorkerExecutionTaskCompletionContent(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.readiness_status}；
              output storage {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.output_storage_readiness_status}；
              readback {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.task_readback_status}；
              requests {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.existing_execution_request_count}；
              output stored {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.output_stored_request_count}；
              tasks {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.task_count}；
              queued {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.queued_task_count}；
              target {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.target_task_status}；
              覆盖源 {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.covered_source_count}/{enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              required request status {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.required_request_status}；
              source {enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.task_completion_source}；
              request/task match {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.request_task_match_required)}；
              metadata required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.output_storage_metadata_required)}；
              confirmation required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.status_transition_confirmation_required)}。
            </p>
            <p className="mt-2">
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.task_status_mutation_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.task_status_audit_write_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.worker_execution_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.output_storage_write_enabled)}；
              report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.delivery_report_storage_write_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.archive_deletion_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportWorkerExecutionTaskCompletionReadiness.recovery}</p>
            <form className="mt-4 space-y-3" onSubmit={handleCompleteEnterpriseAuditExportWorkerExecutionTask}>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-task-completion-request-id">
                  Output stored request ID
                </label>
                <input
                  id="audit-export-worker-execution-task-completion-request-id"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportWorkerExecutionTaskCompletionForm.request_id}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionTaskCompletionForm((current) => ({
                    ...current,
                    request_id: event.target.value,
                  }))}
                  placeholder="enterprise_audit_export_worker_execution_requests.id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-worker-execution-task-completion-reason">
                  Reason
                </label>
                <textarea
                  id="audit-export-worker-execution-task-completion-reason"
                  className="mt-1 min-h-20 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportWorkerExecutionTaskCompletionForm.reason}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionTaskCompletionForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                  placeholder="说明为什么根据 output_stored request 推进 task completed"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={enterpriseAuditExportWorkerExecutionTaskCompletionForm.confirm_worker_execution_task_completion}
                  onChange={(event) => setEnterpriseAuditExportWorkerExecutionTaskCompletionForm((current) => ({
                    ...current,
                    confirm_worker_execution_task_completion: event.target.checked,
                  }))}
                />
                <span>confirm_worker_execution_task_completion=true；本阶段只根据 output_stored request 校验 request/task match 后推进 task completed 并写 admin audit。</span>
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportWorkerExecutionTaskCompletionReady === false}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {enterpriseAuditExportWorkerExecutionTaskCompletionActionLabel}
              </button>
            </form>
            {shouldRenderEnterpriseAuditExportWorkerExecutionTaskCompletionMessage === true && (
              <p className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {enterpriseAuditExportWorkerExecutionTaskCompletionMessage}
              </p>
            )}
            {enterpriseAuditExportWorkerExecutionTaskCompletionResult !== null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                result {enterpriseAuditExportWorkerExecutionTaskCompletionResult.status}；
                request {enterpriseAuditExportWorkerExecutionTaskCompletionResult.request.id}；
                task {enterpriseAuditExportWorkerExecutionTaskCompletionResult.task.id}；
                transition {enterpriseAuditExportWorkerExecutionTaskCompletionResult.transition}；
                required request {enterpriseAuditExportWorkerExecutionTaskCompletionResult.required_request_status}；
                output {enterpriseAuditExportWorkerExecutionTaskCompletionResult.output_path}；
                rows {enterpriseAuditExportWorkerExecutionTaskCompletionResult.row_count}；
                checksum {enterpriseAuditExportWorkerExecutionTaskCompletionResult.checksum_sha256}；
                match {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.request_task_matched)}；
                metadata {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.output_storage_metadata_verified)}；
                mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.task_status_mutation_written)}；
                audit {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.task_status_audit_written)}；
                worker {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.worker_execution_started)}；
                file {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.export_file_generation_started)}；
                storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.output_storage_write_started)}；
                report storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.delivery_report_storage_write_started)}；
                archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.archive_deletion_started)}；
                project {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportWorkerExecutionTaskCompletionResult.project_write_started)}。
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域先只读声明 output_stored worker execution request 推进 task completed 的前置契约，再通过确认表单受控推进 task completed 并写 admin audit；不启动 worker、不生成导出文件、不写 output storage、不落报告文件、不删除审计数据、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export task status transition readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportTaskStatusTransitionPending(enterpriseAuditExportTaskStatusTransitionReadiness) === true && (
          <p className="mt-2">Enterprise audit export task status transition readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportTaskStatusTransitionContent(enterpriseAuditExportTaskStatusTransitionReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportTaskStatusTransitionReadiness.readiness_status}；
              worker {enterpriseAuditExportTaskStatusTransitionReadiness.worker_readiness_status}；
              readback {enterpriseAuditExportTaskStatusTransitionReadiness.task_readback_status}；
              tasks {enterpriseAuditExportTaskStatusTransitionReadiness.task_count}；
              queued {enterpriseAuditExportTaskStatusTransitionReadiness.queued_task_count}；
              processing {enterpriseAuditExportTaskStatusTransitionReadiness.processing_task_count}；
              terminal {enterpriseAuditExportTaskStatusTransitionReadiness.terminal_task_count}；
              allowed statuses {enterpriseAuditExportTaskStatusTransitionReadiness.allowed_task_status_count}；
              allowed transitions {enterpriseAuditExportTaskStatusTransitionReadiness.allowed_transition_count}；
              覆盖源 {enterpriseAuditExportTaskStatusTransitionReadiness.covered_source_count}/{enterpriseAuditExportTaskStatusTransitionReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              Allowed statuses: {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportTaskStatusTransitionReadiness.allowed_task_statuses)}
            </p>
            <p className="mt-1">
              Allowed transitions: {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportTaskStatusTransitionReadiness.allowed_transitions)}
            </p>
            <p className="mt-2">
              task detail read {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.task_detail_read_enabled)}；
              confirmation required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.status_transition_confirmation_required)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.task_status_mutation_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.worker_execution_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportTaskStatusTransitionReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportTaskStatusTransitionReadiness.recovery}</p>
            <form className="mt-4 space-y-3" onSubmit={handleTransitionEnterpriseAuditExportTaskStatus}>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-task-status-transition-task-id">
                  Task ID
                </label>
                <input
                  id="audit-export-task-status-transition-task-id"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportTaskStatusTransitionForm.task_id}
                  onChange={(event) => setEnterpriseAuditExportTaskStatusTransitionForm((current) => ({
                    ...current,
                    task_id: event.target.value,
                  }))}
                  placeholder="enterprise_audit_export_tasks.id"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-task-status-transition-target">
                  Target status
                </label>
                <select
                  id="audit-export-task-status-transition-target"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportTaskStatusTransitionForm.target_status}
                  onChange={(event) => setEnterpriseAuditExportTaskStatusTransitionForm((current) => ({
                    ...current,
                    target_status: event.target.value,
                  }))}
                >
                  <option value="processing">processing</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="audit-export-task-status-transition-reason">
                  Reason
                </label>
                <textarea
                  id="audit-export-task-status-transition-reason"
                  className="mt-1 min-h-20 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={enterpriseAuditExportTaskStatusTransitionForm.reason}
                  onChange={(event) => setEnterpriseAuditExportTaskStatusTransitionForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))}
                  placeholder="说明为什么执行本次受控状态转移"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={enterpriseAuditExportTaskStatusTransitionForm.confirm_status_transition}
                  onChange={(event) => setEnterpriseAuditExportTaskStatusTransitionForm((current) => ({
                    ...current,
                    confirm_status_transition: event.target.checked,
                  }))}
                />
                <span>确认只修改任务状态并写 admin audit；不启动 worker、不生成导出文件、不写 output storage、不删除归档、不写 projects。</span>
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportTaskStatusTransitionReady === false}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {enterpriseAuditExportTaskStatusTransitionActionLabel}
              </button>
            </form>
            {shouldRenderEnterpriseAuditExportTaskStatusTransitionMessage === true && (
              <p className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {enterpriseAuditExportTaskStatusTransitionMessage}
              </p>
            )}
            {enterpriseAuditExportTaskStatusTransitionResult !== null && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                result {enterpriseAuditExportTaskStatusTransitionResult.status}；
                transition {enterpriseAuditExportTaskStatusTransitionResult.transition}；
                mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionResult.task_status_mutation_written)}；
                audit {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionResult.task_status_audit_written)}；
                worker {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionResult.worker_execution_started)}；
                file {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionResult.export_file_generation_started)}；
                storage {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionResult.output_storage_write_started)}；
                archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionResult.archive_deletion_started)}；
                project {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportTaskStatusTransitionResult.project_write_started)}。
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域先只读声明企业治理审计导出任务详情和状态转移 preflight 契约，再通过确认表单受控修改任务状态并写 admin audit；不启动 worker、不生成导出文件、不写 output storage、不删除归档、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export archive expiration readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportArchiveExpirationPending(enterpriseAuditExportArchiveExpirationReadiness) === true && (
          <p className="mt-2">Enterprise audit export archive expiration readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportArchiveExpirationContent(enterpriseAuditExportArchiveExpirationReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportArchiveExpirationReadiness.readiness_status}；
              retention {enterpriseAuditExportArchiveExpirationReadiness.retention_readiness_status}；
              readback {enterpriseAuditExportArchiveExpirationReadiness.task_readback_status}；
              tasks {enterpriseAuditExportArchiveExpirationReadiness.task_count}；
              terminal {enterpriseAuditExportArchiveExpirationReadiness.terminal_task_count}；
              completed {enterpriseAuditExportArchiveExpirationReadiness.completed_task_count}；
              failed {enterpriseAuditExportArchiveExpirationReadiness.failed_task_count}；
              cancelled {enterpriseAuditExportArchiveExpirationReadiness.cancelled_task_count}；
              expiration candidates {enterpriseAuditExportArchiveExpirationReadiness.expiration_candidate_count}；
              retention days {enterpriseAuditExportArchiveExpirationReadiness.retention_days}；
              覆盖源 {enterpriseAuditExportArchiveExpirationReadiness.covered_source_count}/{enterpriseAuditExportArchiveExpirationReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              retention policy {enterpriseAuditExportArchiveExpirationReadiness.retention_policy_key}；
              scan mode {enterpriseAuditExportArchiveExpirationReadiness.scan_mode}；
              candidate limit {enterpriseAuditExportArchiveExpirationReadiness.candidate_limit}。
            </p>
            <p className="mt-2">
              archive scan {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.archive_scan_enabled)}；
              retention deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.retention_deletion_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.task_status_mutation_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.worker_execution_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportArchiveExpirationReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportArchiveExpirationReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportArchiveExpirationReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明企业治理审计导出归档/过期扫描 preflight 契约；不删除审计数据、不修改任务状态、不启动 worker、不生成导出文件、不写 storage、不写 audit、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export delivery report readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportPending(enterpriseAuditExportDeliveryReportReadiness) === true && (
          <p className="mt-2">Enterprise audit export delivery report readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportContent(enterpriseAuditExportDeliveryReportReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportDeliveryReportReadiness.readiness_status}；
              worker {enterpriseAuditExportDeliveryReportReadiness.worker_readiness_status}；
              status transition {enterpriseAuditExportDeliveryReportReadiness.status_transition_readiness_status}；
              archive expiration {enterpriseAuditExportDeliveryReportReadiness.archive_expiration_readiness_status}；
              retention {enterpriseAuditExportDeliveryReportReadiness.retention_readiness_status}；
              readback {enterpriseAuditExportDeliveryReportReadiness.task_readback_status}；
              tasks {enterpriseAuditExportDeliveryReportReadiness.task_count}；
              queued {enterpriseAuditExportDeliveryReportReadiness.queued_task_count}；
              processing {enterpriseAuditExportDeliveryReportReadiness.processing_task_count}；
              terminal {enterpriseAuditExportDeliveryReportReadiness.terminal_task_count}；
              expiration candidates {enterpriseAuditExportDeliveryReportReadiness.expiration_candidate_count}；
              覆盖源 {enterpriseAuditExportDeliveryReportReadiness.covered_source_count}/{enterpriseAuditExportDeliveryReportReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              report format {enterpriseAuditExportDeliveryReportReadiness.report_format}；
              sections {enterpriseAuditExportDeliveryReportReadiness.required_report_section_count}：
              {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportDeliveryReportReadiness.required_report_sections)}
            </p>
            <p className="mt-2">
              report generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.report_generation_enabled)}；
              report storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.report_storage_write_enabled)}；
              report audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.report_audit_write_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.worker_execution_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.task_status_mutation_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.archive_deletion_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportDeliveryReportReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportDeliveryReportReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明企业治理审计导出交付报告 readiness；不生成报告文件、不写 report storage、不写 report audit、不启动 worker、不修改任务状态、不删除审计数据、不生成导出文件、不写 storage、不写 audit、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export delivery report completed task readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportCompletedTaskPending(enterpriseAuditExportDeliveryReportCompletedTaskReadiness) === true && (
          <p className="mt-2">Enterprise audit export delivery report completed task readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportCompletedTaskContent(enterpriseAuditExportDeliveryReportCompletedTaskReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportDeliveryReportCompletedTaskReadiness.readiness_status}；
              delivery report {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.delivery_report_readiness_status}；
              readback {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.task_readback_status}；
              tasks {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.task_count}；
              completed {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.completed_task_count}；
              worker completed {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.worker_execution_completed_task_count}；
              required status {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.required_task_status}；
              覆盖源 {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.covered_source_count}/{enterpriseAuditExportDeliveryReportCompletedTaskReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              required source {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.required_task_source}；
              completed evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.completed_task_evidence_required)}；
              worker source required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.worker_execution_task_source_required)}；
              report format {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.report_format}；
              sections {enterpriseAuditExportDeliveryReportCompletedTaskReadiness.required_report_section_count}：
              {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.required_report_sections)}
            </p>
            <p className="mt-2">
              report generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.report_generation_enabled)}；
              report storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.report_storage_write_enabled)}；
              report audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.report_audit_write_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.worker_execution_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.task_status_mutation_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.archive_deletion_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportCompletedTaskReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportDeliveryReportCompletedTaskReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportDeliveryReportCompletedTaskReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明 completed task 可作为 delivery report 生成/存储的输入证据；不生成报告文件、不写 report storage、不写 report audit、不启动 worker、不修改任务状态、不删除审计数据、不生成导出文件、不写 storage、不写 audit、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export delivery report generate request readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportGenerateRequestPending(enterpriseAuditExportDeliveryReportGenerateRequestReadiness) === true && (
          <p className="mt-2">Enterprise audit export delivery report generate request readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportGenerateRequestContent(enterpriseAuditExportDeliveryReportGenerateRequestReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportDeliveryReportGenerateRequestReadiness.readiness_status}；
              delivery report {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.delivery_report_readiness_status}；
              completed task {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.completed_task_readiness_status}；
              readback {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.task_readback_status}；
              completed {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.completed_task_count}；
              worker completed {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.worker_execution_completed_task_count}；
              schema {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.request_schema_version}；
              report format {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.report_format}；
              覆盖源 {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.covered_source_count}/{enterpriseAuditExportDeliveryReportGenerateRequestReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              required status {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.required_task_status}；
              required source {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.required_task_source}；
              completed evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.completed_task_evidence_required)}；
              worker source required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.worker_execution_task_source_required)}。
            </p>
            <p className="mt-2">
              sections {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.required_report_section_count}：
              {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.required_report_sections)}
            </p>
            <p className="mt-2">
              request fields {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.required_generate_request_field_count}：
              {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.required_generate_request_fields)}；
              confirm required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.confirm_generate_report_required)}；
              reason required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.reason_required)}；
              max reason length {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.maximum_reason_length}；
              idempotency key required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.idempotency_key_required)}；
              pattern {enterpriseAuditExportDeliveryReportGenerateRequestReadiness.idempotency_key_pattern}。
            </p>
            <p className="mt-2">
              request execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.request_execution_enabled)}；
              report generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.report_generation_enabled)}；
              report storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.report_storage_write_enabled)}；
              report audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.report_audit_write_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.worker_execution_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.task_status_mutation_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.archive_deletion_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateRequestReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportDeliveryReportGenerateRequestReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportDeliveryReportGenerateRequestReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明企业治理审计导出交付报告生成请求契约 readiness；不执行生成请求、不生成报告文件、不写 report storage、不写 report audit、不启动 worker、不修改任务状态、不删除审计数据、不生成导出文件、不写 storage、不写 audit、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
            <form className="mt-4 space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-700" onSubmit={handleGenerateEnterpriseAuditExportDeliveryReport}>
              <label className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Reason</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportDeliveryReportGenerateForm.reason}
                  onChange={(event) => setEnterpriseAuditExportDeliveryReportGenerateForm({
                    ...enterpriseAuditExportDeliveryReportGenerateForm,
                    reason: event.target.value,
                  })}
                  placeholder="说明本次生成内存交付报告的原因"
                  rows={3}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Idempotency key</span>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportDeliveryReportGenerateForm.idempotency_key}
                  onChange={(event) => setEnterpriseAuditExportDeliveryReportGenerateForm({
                    ...enterpriseAuditExportDeliveryReportGenerateForm,
                    idempotency_key: event.target.value,
                  })}
                  placeholder="enterprise-report-YYYYMMDD-001"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={enterpriseAuditExportDeliveryReportGenerateForm.confirm_generate_report}
                  onChange={(event) => setEnterpriseAuditExportDeliveryReportGenerateForm({
                    ...enterpriseAuditExportDeliveryReportGenerateForm,
                    confirm_generate_report: event.target.checked,
                  })}
                />
                confirm_generate_report=true；仅生成内存 markdown 响应，不写 report storage/audit。
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportDeliveryReportGenerateReady === false}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-100 dark:text-gray-900 dark:disabled:bg-gray-600"
              >
                {enterpriseAuditExportDeliveryReportGenerateActionLabel}
              </button>
              {shouldRenderEnterpriseAuditExportDeliveryReportGenerateMessage === true && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportDeliveryReportGenerateMessage}</p>
              )}
              {enterpriseAuditExportDeliveryReportGenerateResult !== null && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    generated_at {enterpriseAuditExportDeliveryReportGenerateResult.generated_at}；
                    status {enterpriseAuditExportDeliveryReportGenerateResult.status}；
                    completed task {enterpriseAuditExportDeliveryReportGenerateResult.completed_task_readiness_status}；
                    completed {enterpriseAuditExportDeliveryReportGenerateResult.completed_task_count}；
                    worker completed {enterpriseAuditExportDeliveryReportGenerateResult.worker_execution_completed_task_count}；
                    required status {enterpriseAuditExportDeliveryReportGenerateResult.required_task_status}；
                    required source {enterpriseAuditExportDeliveryReportGenerateResult.required_task_source}；
                    completed evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateResult.completed_task_evidence_required)}；
                    worker source required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateResult.worker_execution_task_source_required)}；
                    report file written {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateResult.report_file_written)}；
                    report storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateResult.report_storage_write_started)}；
                    report audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportGenerateResult.report_audit_write_started)}。
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-md bg-gray-950 p-3 text-xs text-gray-100">
                    {enterpriseAuditExportDeliveryReportGenerateResult.report_content}
                  </pre>
                </div>
              )}
            </form>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export delivery report storage readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportStoragePending(enterpriseAuditExportDeliveryReportStorageReadiness) === true && (
          <p className="mt-2">Enterprise audit export delivery report storage readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportStorageContent(enterpriseAuditExportDeliveryReportStorageReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportDeliveryReportStorageReadiness.readiness_status}；
              generate request {enterpriseAuditExportDeliveryReportStorageReadiness.generate_request_readiness_status}；
              delivery report {enterpriseAuditExportDeliveryReportStorageReadiness.delivery_report_readiness_status}；
              completed task {enterpriseAuditExportDeliveryReportStorageReadiness.completed_task_readiness_status}；
              readback {enterpriseAuditExportDeliveryReportStorageReadiness.task_readback_status}；
              completed {enterpriseAuditExportDeliveryReportStorageReadiness.completed_task_count}；
              worker completed {enterpriseAuditExportDeliveryReportStorageReadiness.worker_execution_completed_task_count}；
              schema {enterpriseAuditExportDeliveryReportStorageReadiness.storage_schema_version}；
              report format {enterpriseAuditExportDeliveryReportStorageReadiness.report_format}；
              stored reports {enterpriseAuditExportDeliveryReportStorageReadiness.existing_report_count}；
              覆盖源 {enterpriseAuditExportDeliveryReportStorageReadiness.covered_source_count}/{enterpriseAuditExportDeliveryReportStorageReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              required status {enterpriseAuditExportDeliveryReportStorageReadiness.required_task_status}；
              required source {enterpriseAuditExportDeliveryReportStorageReadiness.required_task_source}；
              completed evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.completed_task_evidence_required)}；
              worker source required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.worker_execution_task_source_required)}。
            </p>
            <p className="mt-2">
              storage fields {enterpriseAuditExportDeliveryReportStorageReadiness.required_storage_field_count}：
              {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportDeliveryReportStorageReadiness.required_storage_fields)}；
              path prefix {enterpriseAuditExportDeliveryReportStorageReadiness.storage_path_prefix}；
              checksum {enterpriseAuditExportDeliveryReportStorageReadiness.checksum_algorithm}；
              metadata required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.metadata_write_required)}。
            </p>
            <p className="mt-2">
              sections {enterpriseAuditExportDeliveryReportStorageReadiness.required_report_section_count}：
              {getAdminEnterpriseAuditExportQueryFilterFieldsLabel(enterpriseAuditExportDeliveryReportStorageReadiness.required_report_sections)}
            </p>
            <p className="mt-2">
              report storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.report_storage_write_enabled)}；
              report audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.report_audit_write_enabled)}；
              report file write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.report_file_write_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.worker_execution_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.task_status_mutation_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.archive_deletion_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStorageReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportDeliveryReportStorageReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportDeliveryReportStorageReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读声明企业治理审计导出交付报告存储契约 readiness；不写 report storage、不写 report audit、不落报告文件、不启动 worker、不修改任务状态、不删除审计数据、不生成导出文件、不写 storage、不写 audit、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
            <form className="mt-4 space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-700" onSubmit={handleStoreEnterpriseAuditExportDeliveryReport}>
              <label className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Reason</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportDeliveryReportStoreForm.reason}
                  onChange={(event) => setEnterpriseAuditExportDeliveryReportStoreForm({
                    ...enterpriseAuditExportDeliveryReportStoreForm,
                    reason: event.target.value,
                  })}
                  placeholder="先生成内存交付报告，或粘贴本次受控存储原因"
                  rows={2}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Idempotency key</span>
                  <input
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    value={enterpriseAuditExportDeliveryReportStoreForm.idempotency_key}
                    onChange={(event) => setEnterpriseAuditExportDeliveryReportStoreForm({
                      ...enterpriseAuditExportDeliveryReportStoreForm,
                      idempotency_key: event.target.value,
                    })}
                    placeholder="enterprise-report-YYYYMMDD-001"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Generated at</span>
                  <input
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    value={enterpriseAuditExportDeliveryReportStoreForm.generated_at}
                    onChange={(event) => setEnterpriseAuditExportDeliveryReportStoreForm({
                      ...enterpriseAuditExportDeliveryReportStoreForm,
                      generated_at: event.target.value,
                    })}
                    placeholder="2026-07-24T00:00:00Z"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Report content</span>
                <textarea
                  className="mt-1 h-56 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  value={enterpriseAuditExportDeliveryReportStoreForm.report_content}
                  onChange={(event) => setEnterpriseAuditExportDeliveryReportStoreForm({
                    ...enterpriseAuditExportDeliveryReportStoreForm,
                    report_content: event.target.value,
                  })}
                  placeholder="先生成内存 markdown 交付报告，或粘贴包含全部必备章节的 markdown"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={enterpriseAuditExportDeliveryReportStoreForm.confirm_store_report}
                  onChange={(event) => setEnterpriseAuditExportDeliveryReportStoreForm({
                    ...enterpriseAuditExportDeliveryReportStoreForm,
                    confirm_store_report: event.target.checked,
                  })}
                />
                confirm_store_report=true；只写 report storage 数据库表与 admin audit，不写报告文件、不启动 worker、不修改任务状态、不写 projects。
              </label>
              <button
                type="submit"
                disabled={enterpriseAuditExportDeliveryReportStoreReady === false}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-100 dark:text-gray-900 dark:disabled:bg-gray-600"
              >
                {enterpriseAuditExportDeliveryReportStoreActionLabel}
              </button>
              {shouldRenderEnterpriseAuditExportDeliveryReportStoreMessage === true && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportDeliveryReportStoreMessage}</p>
              )}
              {enterpriseAuditExportDeliveryReportStoreResult !== null && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  status {enterpriseAuditExportDeliveryReportStoreResult.status}；
                  completed task {enterpriseAuditExportDeliveryReportStoreResult.completed_task_readiness_status}；
                  completed {enterpriseAuditExportDeliveryReportStoreResult.completed_task_count}；
                  worker completed {enterpriseAuditExportDeliveryReportStoreResult.worker_execution_completed_task_count}；
                  required status {enterpriseAuditExportDeliveryReportStoreResult.required_task_status}；
                  required source {enterpriseAuditExportDeliveryReportStoreResult.required_task_source}；
                  completed evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.completed_task_evidence_required)}；
                  worker source required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.worker_execution_task_source_required)}；
                  storage path {enterpriseAuditExportDeliveryReportStoreResult.storage_path}；
                  checksum {enterpriseAuditExportDeliveryReportStoreResult.checksum_sha256}；
                  report storage written {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.report_storage_written)}；
                  admin audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.admin_audit_write_started)}；
                  report file written {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.report_file_written)}；
                  worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.worker_execution_started)}；
                  task mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.task_status_mutation_started)}；
                  project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoreResult.project_write_started)}。
                </p>
              )}
            </form>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit export delivery report stored readiness</h2>
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportStoredPending(enterpriseAuditExportDeliveryReportStoredReadiness) === true && (
          <p className="mt-2">Enterprise audit export delivery report stored readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditExportDeliveryReportStoredContent(enterpriseAuditExportDeliveryReportStoredReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditExportDeliveryReportStoredReadiness.readiness_status}；
              storage {enterpriseAuditExportDeliveryReportStoredReadiness.storage_readiness_status}；
              completed task {enterpriseAuditExportDeliveryReportStoredReadiness.completed_task_readiness_status}；
              stored reports {enterpriseAuditExportDeliveryReportStoredReadiness.stored_report_count}；
              read reports {enterpriseAuditExportDeliveryReportStoredReadiness.read_report_count}；
              audit evidence {enterpriseAuditExportDeliveryReportStoredReadiness.admin_audit_evidence_count}；
              覆盖源 {enterpriseAuditExportDeliveryReportStoredReadiness.covered_source_count}/{enterpriseAuditExportDeliveryReportStoredReadiness.required_source_count}。
            </p>
            <p className="mt-2">
              latest report {enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_id}；
              idempotency {enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_idempotency_key}；
              generated {enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_generated_at}；
              path {enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_storage_path}；
              checksum {enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_checksum_sha256}。
            </p>
            <p className="mt-2">
              row contract {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_storage_contract_ready)}；
              checksum matched {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_checksum_matched)}；
              metadata evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.metadata_evidence_ready)}；
              admin audit evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.admin_audit_evidence_ready)}。
            </p>
            <p className="mt-2">
              required status {enterpriseAuditExportDeliveryReportStoredReadiness.required_task_status}；
              required source {enterpriseAuditExportDeliveryReportStoredReadiness.required_task_source}；
              completed {enterpriseAuditExportDeliveryReportStoredReadiness.completed_task_count}；
              worker completed {enterpriseAuditExportDeliveryReportStoredReadiness.worker_execution_completed_task_count}；
              completed evidence {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.completed_task_evidence_required)}；
              worker source required {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.worker_execution_task_source_required)}。
            </p>
            <p className="mt-2">
              schema {enterpriseAuditExportDeliveryReportStoredReadiness.storage_schema_version}；
              source {enterpriseAuditExportDeliveryReportStoredReadiness.latest_report_source}；
              prefix {enterpriseAuditExportDeliveryReportStoredReadiness.storage_path_prefix}；
              checksum algorithm {enterpriseAuditExportDeliveryReportStoredReadiness.checksum_algorithm}。
            </p>
            <p className="mt-2">
              report storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.report_storage_write_enabled)}；
              report audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.report_audit_write_enabled)}；
              report file write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.report_file_write_enabled)}；
              worker execution {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.worker_execution_enabled)}；
              status mutation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.task_status_mutation_enabled)}；
              archive deletion {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.archive_deletion_enabled)}；
              file generation {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.export_file_generation_enabled)}；
              storage write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.output_storage_write_enabled)}；
              audit write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.audit_write_enabled)}；
              project write {getAdminEnterpriseBooleanFactLabel(enterpriseAuditExportDeliveryReportStoredReadiness.project_write_enabled)}。
            </p>
            <p className="mt-2">{enterpriseAuditExportDeliveryReportStoredReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditExportDeliveryReportStoredReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读校验已存交付报告、metadata evidence 与 admin audit evidence；不写 report storage、不写 report audit、不落报告文件、不启动 worker、不修改任务状态、不删除审计数据、不写 projects、不执行 activation、不修改 AuthorizeProjectAccess、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enterprise audit retention readiness</h2>
        {shouldRenderAdminEnterpriseAuditRetentionPending(enterpriseAuditRetentionReadiness) === true && (
          <p className="mt-2">Enterprise audit retention readiness 尚未返回。</p>
        )}
        {shouldRenderAdminEnterpriseAuditRetentionContent(enterpriseAuditRetentionReadiness) === true && (
          <>
            <p className="mt-2">
              状态：{enterpriseAuditRetentionReadiness.readiness_status}；
              Admin audit logs {enterpriseAuditRetentionReadiness.admin_audit_log_count} 条；
              activation audit events {enterpriseAuditRetentionReadiness.activation_audit_event_count} 条；
              retention policy {enterpriseAuditRetentionReadiness.retention_policy_key}；
              configured {getAdminEnterpriseBooleanFactLabel(enterpriseAuditRetentionReadiness.retention_policy_configured)}；
              days {enterpriseAuditRetentionReadiness.retention_days}；
              range {enterpriseAuditRetentionReadiness.minimum_retention_days}-{enterpriseAuditRetentionReadiness.maximum_retention_days}；
              deletion enabled {getAdminEnterpriseBooleanFactLabel(enterpriseAuditRetentionReadiness.retention_deletion_enabled)}；
              覆盖源 {enterpriseAuditRetentionReadiness.covered_source_count}/{enterpriseAuditRetentionReadiness.required_source_count}。
            </p>
            <p className="mt-2">{enterpriseAuditRetentionReadiness.message}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enterpriseAuditRetentionReadiness.recovery}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              本区域只读回读 enterprise.audit.retention_days、admin_audit_log 总数和 enterprise_project_access_guard_activation_audits 计数；不删除审计数据、不新增写入口、不写 audit 记录、不执行 activation、不修改 AuthorizeProjectAccess、不写 projects、不启用 enterprise_owned 授权、租户隔离或组织级 RBAC。
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h2 className="font-semibold text-gray-900 dark:text-white">企业治理边界</h2>
        <p className="mt-2">
          本页面不创建 SSO provider、不修改 RBAC、不触发 runtime 操作，也不执行 provider runner。
          它读取现有 Admin API、enterprise.sso.* 配置真源、企业组织 schema readiness、项目归属迁移只读预检、映射回读、owner guard 接线 readiness、Project Access Guard switch readiness、authorization dry-run evidence、activation readiness 与 activation audit schema readiness，并且只开放受控组织、团队创建、成员绑定和项目归属映射写入入口。
          项目 owner guard、企业映射授权切换、租户隔离和组织级 RBAC 仍会显式保持未接线状态。
        </p>
      </section>

      <AlertDialog
        open={mutationConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && enterpriseMutationConfirmationSnapshot.canCancel === true) {
            cancelEnterpriseMutationConfirmation();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认企业治理写入</AlertDialogTitle>
            <AlertDialogDescription>
              {mutationConfirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminEnterpriseMutationConfirmationSnapshotStrip snapshot={enterpriseMutationConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={enterpriseMutationConfirmationSnapshot.canCancel === false}
              onClick={cancelEnterpriseMutationConfirmation}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={enterpriseMutationConfirmationSnapshot.canConfirm === false}
              onClick={(event) => {
                event.preventDefault();
                if (enterpriseMutationConfirmationSnapshot.canConfirm === true) {
                  void handleConfirmEnterpriseMutation();
                }
              }}
            >
              {mutationConfirmationActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
