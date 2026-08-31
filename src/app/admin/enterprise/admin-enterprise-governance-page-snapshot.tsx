import type { ReactNode } from 'react';

import type {
  AdminEnterpriseGovernancePageSnapshot,
  AdminEnterpriseGovernancePageSnapshotSource,
  AdminEnterpriseGovernancePageSnapshotStatus,
  AdminEnterpriseMutationConfirmationAction,
  AdminEnterpriseMutationConfirmationRiskLevel,
  AdminEnterpriseMutationConfirmationSnapshot,
  AdminEnterpriseMutationConfirmationSource,
  AdminEnterpriseMutationConfirmationStatus,
  AdminEnterpriseGovernanceReadinessItem,
  AdminEnterpriseGovernanceReadinessItemList,
  AdminEnterpriseAuditCoverageGovernanceReadinessStatus,
  AdminEnterpriseAuditExportGovernanceReadinessStatus,
  AdminEnterpriseAuditExportQueryGovernanceReadinessStatus,
  AdminEnterpriseAuditExportTaskPreflightGovernanceReadinessStatus,
  AdminEnterpriseAuditExportFileFormatGovernanceReadinessStatus,
  AdminEnterpriseAuditExportFileGeneratorGovernanceReadinessStatus,
  AdminEnterpriseAuditExportTaskCreateRequestGovernanceReadinessStatus,
  AdminEnterpriseAuditExportTaskPersistenceGovernanceReadinessStatus,
  AdminEnterpriseAuditRetentionGovernanceReadinessStatus,
  AdminEnterpriseProjectAccessGuardGovernanceActivationAuditPayloadIntegrityStatus,
  AdminEnterpriseProjectAccessGuardGovernanceActivationAuditMetadataIntegrityStatus,
  AdminEnterpriseProjectAccessGuardGovernanceActivationAuditReadinessStatus,
  AdminEnterpriseOrganizationGovernanceReadinessStatus,
  AdminEnterpriseProjectAccessGuardGovernanceActivationReadinessStatus,
  AdminEnterpriseProjectAccessGuardGovernanceAuthorizationDryRunStatus,
  AdminEnterpriseProjectAccessGuardGovernanceSwitchReadinessStatus,
  AdminEnterpriseProjectOwnershipGovernanceMappingStatus,
  AdminEnterpriseProjectOwnershipGovernanceOwnerGuardReadinessStatus,
  AdminEnterpriseProjectOwnershipGovernancePreflightStatus,
  AdminEnterpriseProjectOwnershipGovernanceReadinessStatus,
  AdminEnterpriseSsoConfigKeyList,
  AdminEnterpriseSsoReadinessStatus,
  AdminEnterpriseReadinessStatus,
  AdminEnterpriseReadinessStatusList,
} from '../../workspace/workspace-types';
import type { AdminEnterpriseSsoConfigKey } from '@/lib/admin/api';
import type {
  AdminEnterpriseOrganizationId,
  AdminEnterpriseTeamId,
  AdminProjectRecordId,
  AdminUserId,
} from '@/lib/admin/api';

export const ADMIN_ENTERPRISE_SSO_CONFIG_KEYS: AdminEnterpriseSsoConfigKeyList = [
  'enterprise.sso.enabled',
  'enterprise.sso.provider_type',
  'enterprise.sso.issuer_url',
  'enterprise.sso.client_id',
  'enterprise.sso.redirect_uri',
  'enterprise.sso.allowed_domains',
];

export const ADMIN_ENTERPRISE_SSO_REQUIRED_CONFIG_KEYS: AdminEnterpriseSsoConfigKeyList = [
  'enterprise.sso.issuer_url',
  'enterprise.sso.client_id',
  'enterprise.sso.redirect_uri',
];

export type AdminEnterpriseGovernanceReadinessInput = {
  userCount: number;
  roleCount: number;
  permissionCount: number;
  auditLogCount: number;
  runtimeProjectCount: number;
  providerPreflightItemCount: number;
  providerBlockedCount: number;
  providerSkippedCount: number;
  ssoConfigCount: number;
  ssoConfiguredCount: number;
  ssoRequiredConfiguredCount: number;
  ssoRequiredConfigCount: number;
  ssoEnabled: boolean;
  ssoReadinessStatus: AdminEnterpriseSsoReadinessStatus;
  organizationCount: number;
  teamCount: number;
  memberCount: number;
  organizationReadinessStatus: AdminEnterpriseOrganizationGovernanceReadinessStatus;
  projectOwnershipProjectCount: number;
  projectOwnershipLegacyUserOwnedProjectCount: number;
  projectOwnershipOrganizationProjectCount: number;
  projectOwnershipUnmigratedProjectCount: number;
  projectOwnershipReadinessStatus: AdminEnterpriseProjectOwnershipGovernanceReadinessStatus;
  projectOwnershipPreflightCandidateProjectCount: number;
  projectOwnershipPreflightExistingOwnershipCount: number;
  projectOwnershipPreflightStatus: AdminEnterpriseProjectOwnershipGovernancePreflightStatus;
  projectOwnershipMappingCount: number;
  projectOwnershipMissingProjectCount: number;
  projectOwnershipMappingStatus: AdminEnterpriseProjectOwnershipGovernanceMappingStatus;
  projectOwnershipOwnerGuardMappedProjectCount: number;
  projectOwnershipOwnerGuardUnmappedProjectCount: number;
  projectOwnershipOwnerGuardExtraOwnershipCount: number;
  projectOwnershipOwnerGuardStatus: AdminEnterpriseProjectOwnershipGovernanceOwnerGuardReadinessStatus;
  projectAccessGuardSwitchMappedProjectCount: number;
  projectAccessGuardSwitchUnmappedProjectCount: number;
  projectAccessGuardSwitchExtraOwnershipCount: number;
  projectAccessGuardSwitchCanSwitch: boolean;
  projectAccessGuardSwitchAuthorizationActive: boolean;
  projectAccessGuardSwitchStatus: AdminEnterpriseProjectAccessGuardGovernanceSwitchReadinessStatus;
  projectAccessGuardAuthorizationDryRunComparedProjectCount: number;
  projectAccessGuardAuthorizationDryRunAlignedProjectCount: number;
  projectAccessGuardAuthorizationDryRunEnterpriseUnavailableProjectCount: number;
  projectAccessGuardAuthorizationDryRunLegacyGrantedEnterpriseBlockedCount: number;
  projectAccessGuardAuthorizationDryRunLegacyBlockedEnterpriseGrantedCount: number;
  projectAccessGuardAuthorizationDryRunDriftCandidateCount: number;
  projectAccessGuardAuthorizationDryRunAuthorizationActive: boolean;
  projectAccessGuardAuthorizationDryRunStatus: AdminEnterpriseProjectAccessGuardGovernanceAuthorizationDryRunStatus;
  projectAccessGuardActivationCanActivate: boolean;
  projectAccessGuardActivationSwitchStatus: AdminEnterpriseProjectAccessGuardGovernanceSwitchReadinessStatus;
  projectAccessGuardActivationAuthorizationDryRunStatus: AdminEnterpriseProjectAccessGuardGovernanceAuthorizationDryRunStatus;
  projectAccessGuardActivationMappedProjectCount: number;
  projectAccessGuardActivationUnmappedProjectCount: number;
  projectAccessGuardActivationExtraOwnershipCount: number;
  projectAccessGuardActivationComparedProjectCount: number;
  projectAccessGuardActivationAlignedProjectCount: number;
  projectAccessGuardActivationEnterpriseUnavailableCount: number;
  projectAccessGuardActivationAuthorizationDriftCount: number;
  projectAccessGuardActivationBlockerCandidateCount: number;
  projectAccessGuardActivationReviewItemCount: number;
  projectAccessGuardActivationReviewBlockedCount: number;
  projectAccessGuardActivationReviewManualRequiredCount: number;
  projectAccessGuardActivationAuditPlanItemCount: number;
  projectAccessGuardActivationAuditPlanBlockedCount: number;
  projectAccessGuardActivationAuditPlanManualRequiredCount: number;
  projectAccessGuardActivationAuthorizationActive: boolean;
  projectAccessGuardActivationStatus: AdminEnterpriseProjectAccessGuardGovernanceActivationReadinessStatus;
  projectAccessGuardActivationAuditEventCount: number;
  projectAccessGuardActivationAuditRequiredEventTypeCount: number;
  projectAccessGuardActivationAuditMissingRequiredEventTypeCount: number;
  projectAccessGuardActivationAuditRecentEventCount: number;
  projectAccessGuardActivationAuditPayloadIntegrityIssueCount: number;
  projectAccessGuardActivationAuditPayloadIntegrityStatus: AdminEnterpriseProjectAccessGuardGovernanceActivationAuditPayloadIntegrityStatus;
  projectAccessGuardActivationAuditMetadataIntegrityIssueCount: number;
  projectAccessGuardActivationAuditMetadataIntegrityStatus: AdminEnterpriseProjectAccessGuardGovernanceActivationAuditMetadataIntegrityStatus;
  projectAccessGuardActivationAuditStatus: AdminEnterpriseProjectAccessGuardGovernanceActivationAuditReadinessStatus;
  enterpriseAuditCoverageAdminAuditLogCount: number;
  enterpriseAuditCoverageActivationAuditEventCount: number;
  enterpriseAuditCoverageCoveredSourceCount: number;
  enterpriseAuditCoverageRequiredSourceCount: number;
  enterpriseAuditCoverageStatus: AdminEnterpriseAuditCoverageGovernanceReadinessStatus;
  enterpriseAuditExportAdminAuditLogCount: number;
  enterpriseAuditExportActivationAuditEventCount: number;
  enterpriseAuditExportSampleCount: number;
  enterpriseAuditExportSampleLimit: number;
  enterpriseAuditExportMaxWindow: number;
  enterpriseAuditExportCoveredSourceCount: number;
  enterpriseAuditExportRequiredSourceCount: number;
  enterpriseAuditExportStatus: AdminEnterpriseAuditExportGovernanceReadinessStatus;
  enterpriseAuditExportQuerySampleCount: number;
  enterpriseAuditExportQuerySampleLimit: number;
  enterpriseAuditExportQueryMaxWindow: number;
  enterpriseAuditExportQuerySupportedFilterFieldCount: number;
  enterpriseAuditExportQueryRequiredFilterFieldCount: number;
  enterpriseAuditExportQuerySampleActionCount: number;
  enterpriseAuditExportQuerySampleTargetTypeCount: number;
  enterpriseAuditExportQuerySampleActorCount: number;
  enterpriseAuditExportQueryTaskCreationEnabled: boolean;
  enterpriseAuditExportQueryFileGenerationEnabled: boolean;
  enterpriseAuditExportQueryCoveredSourceCount: number;
  enterpriseAuditExportQueryRequiredSourceCount: number;
  enterpriseAuditExportQueryStatus: AdminEnterpriseAuditExportQueryGovernanceReadinessStatus;
  enterpriseAuditExportTaskPreflightSampleCount: number;
  enterpriseAuditExportTaskPreflightSampleLimit: number;
  enterpriseAuditExportTaskPreflightSupportedFilterFieldCount: number;
  enterpriseAuditExportTaskPreflightRequiredFilterFieldCount: number;
  enterpriseAuditExportTaskPreflightRetentionPolicyConfigured: boolean;
  enterpriseAuditExportTaskPreflightRetentionDays: number;
  enterpriseAuditExportTaskPreflightTaskCreationEnabled: boolean;
  enterpriseAuditExportTaskPreflightFileGenerationEnabled: boolean;
  enterpriseAuditExportTaskPreflightCoveredSourceCount: number;
  enterpriseAuditExportTaskPreflightRequiredSourceCount: number;
  enterpriseAuditExportTaskPreflightStatus: AdminEnterpriseAuditExportTaskPreflightGovernanceReadinessStatus;
  enterpriseAuditExportFileFormatSupportedFileFormatCount: number;
  enterpriseAuditExportFileFormatRequiredFileFormatCount: number;
  enterpriseAuditExportFileFormatRequiredColumnCount: number;
  enterpriseAuditExportFileFormatSchemaVersion: string;
  enterpriseAuditExportFileFormatTaskCreationEnabled: boolean;
  enterpriseAuditExportFileFormatFileGenerationEnabled: boolean;
  enterpriseAuditExportFileFormatCoveredSourceCount: number;
  enterpriseAuditExportFileFormatRequiredSourceCount: number;
  enterpriseAuditExportFileFormatStatus: AdminEnterpriseAuditExportFileFormatGovernanceReadinessStatus;
  enterpriseAuditExportFileGeneratorOutputPathPrefix: string;
  enterpriseAuditExportFileGeneratorFileNameTemplate: string;
  enterpriseAuditExportFileGeneratorChecksumAlgorithm: string;
  enterpriseAuditExportFileGeneratorMaxRowsPerFile: number;
  enterpriseAuditExportFileGeneratorDryRunEnabled: boolean;
  enterpriseAuditExportFileGeneratorOutputStorageWriteEnabled: boolean;
  enterpriseAuditExportFileGeneratorTaskCreationEnabled: boolean;
  enterpriseAuditExportFileGeneratorFileGenerationEnabled: boolean;
  enterpriseAuditExportFileGeneratorCoveredSourceCount: number;
  enterpriseAuditExportFileGeneratorRequiredSourceCount: number;
  enterpriseAuditExportFileGeneratorStatus: AdminEnterpriseAuditExportFileGeneratorGovernanceReadinessStatus;
  enterpriseAuditExportTaskCreateRequestSchemaVersion: string;
  enterpriseAuditExportTaskCreateRequestRequiredFieldCount: number;
  enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired: boolean;
  enterpriseAuditExportTaskCreateRequestConfirmationRequired: boolean;
  enterpriseAuditExportTaskCreateRequestTaskCreationEnabled: boolean;
  enterpriseAuditExportTaskCreateRequestFileGenerationEnabled: boolean;
  enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled: boolean;
  enterpriseAuditExportTaskCreateRequestAuditWriteEnabled: boolean;
  enterpriseAuditExportTaskCreateRequestCoveredSourceCount: number;
  enterpriseAuditExportTaskCreateRequestRequiredSourceCount: number;
  enterpriseAuditExportTaskCreateRequestStatus: AdminEnterpriseAuditExportTaskCreateRequestGovernanceReadinessStatus;
  enterpriseAuditExportTaskPersistenceExistingTaskCount: number;
  enterpriseAuditExportTaskPersistenceTableName: string;
  enterpriseAuditExportTaskPersistenceSchemaVersion: string;
  enterpriseAuditExportTaskPersistenceRequiredFieldCount: number;
  enterpriseAuditExportTaskPersistenceIdempotencyKeyUnique: boolean;
  enterpriseAuditExportTaskPersistenceRequestedByAdminRequired: boolean;
  enterpriseAuditExportTaskPersistenceTimeRangeRequired: boolean;
  enterpriseAuditExportTaskPersistenceFiltersSnapshotRequired: boolean;
  enterpriseAuditExportTaskPersistenceTaskCreationEnabled: boolean;
  enterpriseAuditExportTaskPersistenceWriteEnabled: boolean;
  enterpriseAuditExportTaskPersistenceFileGenerationEnabled: boolean;
  enterpriseAuditExportTaskPersistenceOutputStorageWriteEnabled: boolean;
  enterpriseAuditExportTaskPersistenceAuditWriteEnabled: boolean;
  enterpriseAuditExportTaskPersistenceProjectWriteEnabled: boolean;
  enterpriseAuditExportTaskPersistenceCoveredSourceCount: number;
  enterpriseAuditExportTaskPersistenceRequiredSourceCount: number;
  enterpriseAuditExportTaskPersistenceStatus: AdminEnterpriseAuditExportTaskPersistenceGovernanceReadinessStatus;
  enterpriseAuditRetentionAdminAuditLogCount: number;
  enterpriseAuditRetentionActivationAuditEventCount: number;
  enterpriseAuditRetentionPolicyConfigured: boolean;
  enterpriseAuditRetentionDays: number;
  enterpriseAuditRetentionMinimumDays: number;
  enterpriseAuditRetentionMaximumDays: number;
  enterpriseAuditRetentionDeletionEnabled: boolean;
  enterpriseAuditRetentionCoveredSourceCount: number;
  enterpriseAuditRetentionRequiredSourceCount: number;
  enterpriseAuditRetentionStatus: AdminEnterpriseAuditRetentionGovernanceReadinessStatus;
};

export type AdminEnterpriseSsoConfigValueMap = {
  [key in AdminEnterpriseSsoConfigKey]: string;
};

export type AdminEnterpriseMutationConfirmationInput = {
  action: AdminEnterpriseMutationConfirmationAction;
  organizationId: AdminEnterpriseOrganizationId | null;
  organizationName: string;
  teamId: AdminEnterpriseTeamId | null;
  teamName: string;
  userId: AdminUserId | null;
  projectRecordId: AdminProjectRecordId | null;
  projectName: string;
  summary: string;
};

type AdminEnterpriseResolvedMutationConfirmationInput = {
  hasPendingMutation: boolean;
  action: AdminEnterpriseMutationConfirmationAction | null;
  organizationId: AdminEnterpriseOrganizationId | null;
  organizationName: string;
  teamId: AdminEnterpriseTeamId | null;
  teamName: string;
  userId: AdminUserId | null;
  projectRecordId: AdminProjectRecordId | null;
  projectName: string;
  summary: string;
};

function hasCount(value: number) {
  return value > 0;
}

function getAdminEnterpriseSnapshotTrueFalseLabel(value: boolean): string {
  return value === true ? 'true' : 'false';
}

function hasAdminEnterpriseGovernanceError(error: string) {
  return error !== '';
}

function resolveAdminEnterpriseMutationConfirmationInput(
  pendingMutation: AdminEnterpriseMutationConfirmationInput | null,
): AdminEnterpriseResolvedMutationConfirmationInput {
  const hasPendingMutation = pendingMutation !== null;
  if (hasPendingMutation === false) {
    return {
      hasPendingMutation,
      action: null,
      organizationId: null,
      organizationName: 'none',
      teamId: null,
      teamName: 'none',
      userId: null,
      projectRecordId: null,
      projectName: 'none',
      summary: 'none',
    };
  }

  return {
    hasPendingMutation,
    action: pendingMutation.action,
    organizationId: pendingMutation.organizationId,
    organizationName: pendingMutation.organizationName,
    teamId: pendingMutation.teamId,
    teamName: pendingMutation.teamName,
    userId: pendingMutation.userId,
    projectRecordId: pendingMutation.projectRecordId,
    projectName: pendingMutation.projectName,
    summary: pendingMutation.summary,
  };
}

function resolveAdminEnterpriseMutationConfirmationSource(
  action: AdminEnterpriseMutationConfirmationAction | null,
): AdminEnterpriseMutationConfirmationSource {
  if (action === 'organization_create') {
    return 'organization_mutation';
  }
  if (action === 'team_create') {
    return 'team_mutation';
  }
  if (action === 'member_bind') {
    return 'member_mutation';
  }
  if (action === 'project_ownership_migrate') {
    return 'project_ownership_migration';
  }
  return 'dialog_state';
}

function resolveAdminEnterpriseMutationConfirmationRiskLevel(
  action: AdminEnterpriseMutationConfirmationAction | null,
): AdminEnterpriseMutationConfirmationRiskLevel {
  if (action === 'project_ownership_migrate') {
    return 'high';
  }
  if (action !== null) {
    return 'medium';
  }
  return 'none';
}

export function buildAdminEnterpriseMutationConfirmationSnapshot({
  pendingMutation,
  isOpen,
  submitting,
  error,
}: {
  pendingMutation: AdminEnterpriseMutationConfirmationInput | null;
  isOpen: boolean;
  submitting: boolean;
  error: string;
}): AdminEnterpriseMutationConfirmationSnapshot {
  const resolvedPendingMutation = resolveAdminEnterpriseMutationConfirmationInput(pendingMutation);
  const hasError = hasAdminEnterpriseGovernanceError(error) && isOpen && resolvedPendingMutation.hasPendingMutation;
  const status: AdminEnterpriseMutationConfirmationStatus = isOpen === false || resolvedPendingMutation.hasPendingMutation === false
    ? 'closed'
    : submitting
      ? 'confirming'
      : hasError
        ? 'mutation_failed'
        : 'awaiting_confirmation';

  return {
    status,
    source: status === 'closed' ? 'dialog_state' : resolveAdminEnterpriseMutationConfirmationSource(resolvedPendingMutation.action),
    action: resolvedPendingMutation.action,
    organizationId: resolvedPendingMutation.organizationId,
    organizationName: resolvedPendingMutation.organizationName,
    teamId: resolvedPendingMutation.teamId,
    teamName: resolvedPendingMutation.teamName,
    userId: resolvedPendingMutation.userId,
    projectRecordId: resolvedPendingMutation.projectRecordId,
    projectName: resolvedPendingMutation.projectName,
    summary: resolvedPendingMutation.summary,
    isSubmitting: submitting,
    hasError,
    canConfirm: status === 'awaiting_confirmation',
    canCancel: status === 'awaiting_confirmation' || status === 'mutation_failed',
    riskLevel: resolveAdminEnterpriseMutationConfirmationRiskLevel(resolvedPendingMutation.action),
    message: status === 'closed'
      ? 'Admin Enterprise mutation confirmation 当前关闭。'
      : status === 'confirming'
        ? '正在执行已确认的企业治理写入。'
        : status === 'mutation_failed'
          ? error
          : '等待确认企业治理写入范围。',
    recovery: status === 'closed'
      ? '填写受控表单后再打开确认。'
      : status === 'mutation_failed'
        ? '修正失败原因后可以重试，或取消后重新生成确认快照。'
        : '确认前核对写入目标；本入口不会写 projects、启用租户隔离、启用组织级 RBAC 或改变真实授权语义。',
    updatedAt: 'derived',
  };
}

function getEnterpriseSsoConfigValue(
  values: AdminEnterpriseSsoConfigValueMap,
  key: AdminEnterpriseSsoConfigKey,
) {
  return getAdminEnterpriseSsoConfigFallbackValue(values[key]);
}

function hasEnterpriseSsoConfigValue(
  values: AdminEnterpriseSsoConfigValueMap,
  key: AdminEnterpriseSsoConfigKey,
) {
  return getEnterpriseSsoConfigValue(values, key).trim() !== '';
}

function hasEnterpriseSsoEnabledConfig(values: AdminEnterpriseSsoConfigValueMap) {
  return getEnterpriseSsoConfigValue(values, 'enterprise.sso.enabled').trim() === 'true';
}

function hasAdminEnterpriseReadinessProblem(
  item: AdminEnterpriseGovernanceReadinessItem | undefined,
): item is AdminEnterpriseGovernanceReadinessItem {
  return item !== undefined;
}

function getAdminEnterpriseSsoConfigFallbackValue(value: string | undefined): string {
  const hasValue = value !== undefined && value.length > 0;
  return hasValue === true ? value : '';
}

export function buildAdminEnterpriseSsoConfigValueMap(
  values: Partial<AdminEnterpriseSsoConfigValueMap>,
): AdminEnterpriseSsoConfigValueMap {
  return {
    'enterprise.sso.enabled': getAdminEnterpriseSsoConfigFallbackValue(values['enterprise.sso.enabled']),
    'enterprise.sso.provider_type': getAdminEnterpriseSsoConfigFallbackValue(values['enterprise.sso.provider_type']),
    'enterprise.sso.issuer_url': getAdminEnterpriseSsoConfigFallbackValue(values['enterprise.sso.issuer_url']),
    'enterprise.sso.client_id': getAdminEnterpriseSsoConfigFallbackValue(values['enterprise.sso.client_id']),
    'enterprise.sso.redirect_uri': getAdminEnterpriseSsoConfigFallbackValue(values['enterprise.sso.redirect_uri']),
    'enterprise.sso.allowed_domains': getAdminEnterpriseSsoConfigFallbackValue(values['enterprise.sso.allowed_domains']),
  };
}

export function countConfiguredEnterpriseSsoConfigs(values: AdminEnterpriseSsoConfigValueMap) {
  let count = 0;
  for (const key of ADMIN_ENTERPRISE_SSO_CONFIG_KEYS) {
    const hasConfigValue = hasEnterpriseSsoConfigValue(values, key);
    if (hasConfigValue === true) {
      count += 1;
    }
  }
  return count;
}

export function countConfiguredEnterpriseSsoRequiredConfigs(values: AdminEnterpriseSsoConfigValueMap) {
  let count = 0;
  for (const key of ADMIN_ENTERPRISE_SSO_REQUIRED_CONFIG_KEYS) {
    const hasConfigValue = hasEnterpriseSsoConfigValue(values, key);
    if (hasConfigValue === true) {
      count += 1;
    }
  }
  return count;
}

export function resolveAdminEnterpriseSsoReadinessStatus(
  values: AdminEnterpriseSsoConfigValueMap,
): AdminEnterpriseSsoReadinessStatus {
  const hasSsoEnabledConfig = hasEnterpriseSsoEnabledConfig(values);
  if (hasSsoEnabledConfig === false) {
    return 'disabled';
  }
  const configuredRequiredCount = countConfiguredEnterpriseSsoRequiredConfigs(values);
  if (configuredRequiredCount !== ADMIN_ENTERPRISE_SSO_REQUIRED_CONFIG_KEYS.length) {
    return 'missing_config';
  }
  return 'configured_not_connected';
}

function countReadinessItems(
  items: AdminEnterpriseGovernanceReadinessItemList,
  status: AdminEnterpriseReadinessStatus,
) {
  let count = 0;
  for (const item of items) {
    const hasTargetStatus = item.status === status;
    if (hasTargetStatus === true) {
      count += 1;
    }
  }
  return count;
}

function resolveAdminEnterpriseFirstReadinessProblem(
  items: AdminEnterpriseGovernanceReadinessItemList,
): AdminEnterpriseGovernanceReadinessItem | undefined {
  for (const item of items) {
    const hasProblemStatus = item.status === 'blocked' || item.status === 'not_connected' || item.status === 'warning';
    if (hasProblemStatus === true) {
      return item;
    }
  }
  return undefined;
}

function getAdminEnterpriseReadinessStatusList(
  items: AdminEnterpriseGovernanceReadinessItemList,
): AdminEnterpriseReadinessStatusList {
  const statuses: AdminEnterpriseReadinessStatus[] = [];

  for (const item of items) {
    statuses.push(item.status);
  }

  return statuses as AdminEnterpriseReadinessStatusList;
}

export function buildAdminEnterpriseGovernanceReadinessItems({
  userCount,
  roleCount,
  permissionCount,
  auditLogCount,
  runtimeProjectCount,
  providerPreflightItemCount,
  providerBlockedCount,
  providerSkippedCount,
  ssoConfiguredCount,
  ssoRequiredConfiguredCount,
  ssoRequiredConfigCount,
  ssoEnabled,
  ssoReadinessStatus,
  organizationCount,
  teamCount,
  memberCount,
  organizationReadinessStatus,
  projectOwnershipProjectCount,
  projectOwnershipLegacyUserOwnedProjectCount,
  projectOwnershipOrganizationProjectCount,
  projectOwnershipUnmigratedProjectCount,
  projectOwnershipReadinessStatus,
  projectOwnershipPreflightCandidateProjectCount,
  projectOwnershipPreflightExistingOwnershipCount,
  projectOwnershipPreflightStatus,
  projectOwnershipMappingCount,
  projectOwnershipMissingProjectCount,
  projectOwnershipMappingStatus,
  projectOwnershipOwnerGuardMappedProjectCount,
  projectOwnershipOwnerGuardUnmappedProjectCount,
  projectOwnershipOwnerGuardExtraOwnershipCount,
  projectOwnershipOwnerGuardStatus,
  projectAccessGuardSwitchMappedProjectCount,
  projectAccessGuardSwitchUnmappedProjectCount,
  projectAccessGuardSwitchExtraOwnershipCount,
  projectAccessGuardSwitchCanSwitch,
  projectAccessGuardSwitchAuthorizationActive,
  projectAccessGuardSwitchStatus,
  projectAccessGuardAuthorizationDryRunComparedProjectCount,
  projectAccessGuardAuthorizationDryRunAlignedProjectCount,
  projectAccessGuardAuthorizationDryRunEnterpriseUnavailableProjectCount,
  projectAccessGuardAuthorizationDryRunLegacyGrantedEnterpriseBlockedCount,
  projectAccessGuardAuthorizationDryRunLegacyBlockedEnterpriseGrantedCount,
  projectAccessGuardAuthorizationDryRunDriftCandidateCount,
  projectAccessGuardAuthorizationDryRunAuthorizationActive,
  projectAccessGuardAuthorizationDryRunStatus,
  projectAccessGuardActivationCanActivate,
  projectAccessGuardActivationSwitchStatus,
  projectAccessGuardActivationAuthorizationDryRunStatus,
  projectAccessGuardActivationMappedProjectCount,
  projectAccessGuardActivationUnmappedProjectCount,
  projectAccessGuardActivationExtraOwnershipCount,
  projectAccessGuardActivationComparedProjectCount,
  projectAccessGuardActivationAlignedProjectCount,
  projectAccessGuardActivationEnterpriseUnavailableCount,
  projectAccessGuardActivationAuthorizationDriftCount,
  projectAccessGuardActivationBlockerCandidateCount,
  projectAccessGuardActivationReviewItemCount,
  projectAccessGuardActivationReviewBlockedCount,
  projectAccessGuardActivationReviewManualRequiredCount,
  projectAccessGuardActivationAuditPlanItemCount,
  projectAccessGuardActivationAuditPlanBlockedCount,
  projectAccessGuardActivationAuditPlanManualRequiredCount,
  projectAccessGuardActivationAuthorizationActive,
  projectAccessGuardActivationStatus,
  projectAccessGuardActivationAuditEventCount,
  projectAccessGuardActivationAuditRequiredEventTypeCount,
  projectAccessGuardActivationAuditMissingRequiredEventTypeCount,
  projectAccessGuardActivationAuditRecentEventCount,
  projectAccessGuardActivationAuditPayloadIntegrityIssueCount,
  projectAccessGuardActivationAuditPayloadIntegrityStatus,
  projectAccessGuardActivationAuditMetadataIntegrityIssueCount,
  projectAccessGuardActivationAuditMetadataIntegrityStatus,
  projectAccessGuardActivationAuditStatus,
  enterpriseAuditCoverageAdminAuditLogCount,
  enterpriseAuditCoverageActivationAuditEventCount,
  enterpriseAuditCoverageCoveredSourceCount,
  enterpriseAuditCoverageRequiredSourceCount,
  enterpriseAuditCoverageStatus,
  enterpriseAuditExportAdminAuditLogCount,
  enterpriseAuditExportActivationAuditEventCount,
  enterpriseAuditExportSampleCount,
  enterpriseAuditExportSampleLimit,
  enterpriseAuditExportMaxWindow,
  enterpriseAuditExportCoveredSourceCount,
  enterpriseAuditExportRequiredSourceCount,
  enterpriseAuditExportStatus,
  enterpriseAuditExportQuerySampleCount,
  enterpriseAuditExportQuerySampleLimit,
  enterpriseAuditExportQueryMaxWindow,
  enterpriseAuditExportQuerySupportedFilterFieldCount,
  enterpriseAuditExportQueryRequiredFilterFieldCount,
  enterpriseAuditExportQuerySampleActionCount,
  enterpriseAuditExportQuerySampleTargetTypeCount,
  enterpriseAuditExportQuerySampleActorCount,
  enterpriseAuditExportQueryTaskCreationEnabled,
  enterpriseAuditExportQueryFileGenerationEnabled,
  enterpriseAuditExportQueryCoveredSourceCount,
  enterpriseAuditExportQueryRequiredSourceCount,
  enterpriseAuditExportQueryStatus,
  enterpriseAuditExportTaskPreflightSampleCount,
  enterpriseAuditExportTaskPreflightSampleLimit,
  enterpriseAuditExportTaskPreflightSupportedFilterFieldCount,
  enterpriseAuditExportTaskPreflightRequiredFilterFieldCount,
  enterpriseAuditExportTaskPreflightRetentionPolicyConfigured,
  enterpriseAuditExportTaskPreflightRetentionDays,
  enterpriseAuditExportTaskPreflightTaskCreationEnabled,
  enterpriseAuditExportTaskPreflightFileGenerationEnabled,
  enterpriseAuditExportTaskPreflightCoveredSourceCount,
  enterpriseAuditExportTaskPreflightRequiredSourceCount,
  enterpriseAuditExportTaskPreflightStatus,
  enterpriseAuditExportFileFormatSupportedFileFormatCount,
  enterpriseAuditExportFileFormatRequiredFileFormatCount,
  enterpriseAuditExportFileFormatRequiredColumnCount,
  enterpriseAuditExportFileFormatSchemaVersion,
  enterpriseAuditExportFileFormatTaskCreationEnabled,
  enterpriseAuditExportFileFormatFileGenerationEnabled,
  enterpriseAuditExportFileFormatCoveredSourceCount,
  enterpriseAuditExportFileFormatRequiredSourceCount,
  enterpriseAuditExportFileFormatStatus,
  enterpriseAuditExportFileGeneratorOutputPathPrefix,
  enterpriseAuditExportFileGeneratorFileNameTemplate,
  enterpriseAuditExportFileGeneratorChecksumAlgorithm,
  enterpriseAuditExportFileGeneratorMaxRowsPerFile,
  enterpriseAuditExportFileGeneratorDryRunEnabled,
  enterpriseAuditExportFileGeneratorOutputStorageWriteEnabled,
  enterpriseAuditExportFileGeneratorTaskCreationEnabled,
  enterpriseAuditExportFileGeneratorFileGenerationEnabled,
  enterpriseAuditExportFileGeneratorCoveredSourceCount,
  enterpriseAuditExportFileGeneratorRequiredSourceCount,
  enterpriseAuditExportFileGeneratorStatus,
  enterpriseAuditExportTaskCreateRequestSchemaVersion,
  enterpriseAuditExportTaskCreateRequestRequiredFieldCount,
  enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired,
  enterpriseAuditExportTaskCreateRequestConfirmationRequired,
  enterpriseAuditExportTaskCreateRequestTaskCreationEnabled,
  enterpriseAuditExportTaskCreateRequestFileGenerationEnabled,
  enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled,
  enterpriseAuditExportTaskCreateRequestAuditWriteEnabled,
  enterpriseAuditExportTaskCreateRequestCoveredSourceCount,
  enterpriseAuditExportTaskCreateRequestRequiredSourceCount,
  enterpriseAuditExportTaskCreateRequestStatus,
  enterpriseAuditExportTaskPersistenceExistingTaskCount,
  enterpriseAuditExportTaskPersistenceTableName,
  enterpriseAuditExportTaskPersistenceSchemaVersion,
  enterpriseAuditExportTaskPersistenceRequiredFieldCount,
  enterpriseAuditExportTaskPersistenceIdempotencyKeyUnique,
  enterpriseAuditExportTaskPersistenceRequestedByAdminRequired,
  enterpriseAuditExportTaskPersistenceTimeRangeRequired,
  enterpriseAuditExportTaskPersistenceFiltersSnapshotRequired,
  enterpriseAuditExportTaskPersistenceTaskCreationEnabled,
  enterpriseAuditExportTaskPersistenceWriteEnabled,
  enterpriseAuditExportTaskPersistenceFileGenerationEnabled,
  enterpriseAuditExportTaskPersistenceOutputStorageWriteEnabled,
  enterpriseAuditExportTaskPersistenceAuditWriteEnabled,
  enterpriseAuditExportTaskPersistenceProjectWriteEnabled,
  enterpriseAuditExportTaskPersistenceCoveredSourceCount,
  enterpriseAuditExportTaskPersistenceRequiredSourceCount,
  enterpriseAuditExportTaskPersistenceStatus,
  enterpriseAuditRetentionAdminAuditLogCount,
  enterpriseAuditRetentionActivationAuditEventCount,
  enterpriseAuditRetentionPolicyConfigured,
  enterpriseAuditRetentionDays,
  enterpriseAuditRetentionMinimumDays,
  enterpriseAuditRetentionMaximumDays,
  enterpriseAuditRetentionDeletionEnabled,
  enterpriseAuditRetentionCoveredSourceCount,
  enterpriseAuditRetentionRequiredSourceCount,
  enterpriseAuditRetentionStatus,
}: AdminEnterpriseGovernanceReadinessInput): AdminEnterpriseGovernanceReadinessItemList {
  const rbacReady = hasCount(roleCount) && hasCount(permissionCount);
  const runtimeObserved = hasCount(runtimeProjectCount);
  const providerObserved = hasCount(providerPreflightItemCount);
  const hasInactiveProjectAccessGuardSwitchAuthorization = projectAccessGuardSwitchAuthorizationActive === false;
  const hasInactiveProjectAccessGuardDryRunAuthorization = projectAccessGuardAuthorizationDryRunAuthorizationActive === false;
  const hasInactiveProjectAccessGuardActivationAuthorization = projectAccessGuardActivationAuthorizationActive === false;
  const ssoEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(ssoEnabled);
  const projectAccessGuardSwitchCanSwitchLabel = getAdminEnterpriseSnapshotTrueFalseLabel(projectAccessGuardSwitchCanSwitch);
  const projectAccessGuardSwitchAuthorizationActiveLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    projectAccessGuardSwitchAuthorizationActive,
  );
  const projectAccessGuardAuthorizationDryRunAuthorizationActiveLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    projectAccessGuardAuthorizationDryRunAuthorizationActive,
  );
  const projectAccessGuardActivationCanActivateLabel = getAdminEnterpriseSnapshotTrueFalseLabel(projectAccessGuardActivationCanActivate);
  const projectAccessGuardActivationAuthorizationActiveLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    projectAccessGuardActivationAuthorizationActive,
  );
  const enterpriseAuditRetentionPolicyConfiguredLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditRetentionPolicyConfigured,
  );
  const enterpriseAuditExportQueryTaskCreationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportQueryTaskCreationEnabled,
  );
  const enterpriseAuditExportQueryFileGenerationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportQueryFileGenerationEnabled,
  );
  const enterpriseAuditExportTaskPreflightRetentionPolicyConfiguredLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPreflightRetentionPolicyConfigured,
  );
  const enterpriseAuditExportTaskPreflightTaskCreationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPreflightTaskCreationEnabled,
  );
  const enterpriseAuditExportTaskPreflightFileGenerationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPreflightFileGenerationEnabled,
  );
  const enterpriseAuditExportFileFormatTaskCreationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportFileFormatTaskCreationEnabled,
  );
  const enterpriseAuditExportFileFormatFileGenerationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportFileFormatFileGenerationEnabled,
  );
  const enterpriseAuditExportFileGeneratorDryRunEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportFileGeneratorDryRunEnabled,
  );
  const enterpriseAuditExportFileGeneratorOutputStorageWriteEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportFileGeneratorOutputStorageWriteEnabled,
  );
  const enterpriseAuditExportFileGeneratorTaskCreationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportFileGeneratorTaskCreationEnabled,
  );
  const enterpriseAuditExportFileGeneratorFileGenerationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportFileGeneratorFileGenerationEnabled,
  );
  const enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequiredLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired,
  );
  const enterpriseAuditExportTaskCreateRequestConfirmationRequiredLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskCreateRequestConfirmationRequired,
  );
  const enterpriseAuditExportTaskCreateRequestTaskCreationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskCreateRequestTaskCreationEnabled,
  );
  const enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled,
  );
  const enterpriseAuditExportTaskCreateRequestAuditWriteEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskCreateRequestAuditWriteEnabled,
  );
  const enterpriseAuditExportTaskPersistenceIdempotencyKeyUniqueLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceIdempotencyKeyUnique,
  );
  const enterpriseAuditExportTaskPersistenceRequestedByAdminRequiredLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceRequestedByAdminRequired,
  );
  const enterpriseAuditExportTaskPersistenceTimeRangeRequiredLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceTimeRangeRequired,
  );
  const enterpriseAuditExportTaskPersistenceFiltersSnapshotRequiredLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceFiltersSnapshotRequired,
  );
  const enterpriseAuditExportTaskPersistenceTaskCreationEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceTaskCreationEnabled,
  );
  const enterpriseAuditExportTaskPersistenceWriteEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceWriteEnabled,
  );
  const enterpriseAuditExportTaskPersistenceAuditWriteEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceAuditWriteEnabled,
  );
  const enterpriseAuditExportTaskPersistenceProjectWriteEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditExportTaskPersistenceProjectWriteEnabled,
  );
  const enterpriseAuditRetentionDeletionEnabledLabel = getAdminEnterpriseSnapshotTrueFalseLabel(
    enterpriseAuditRetentionDeletionEnabled,
  );

  return [
    {
      area: 'enterprise_identity',
      status: ssoReadinessStatus === 'missing_config'
        ? 'blocked'
        : ssoReadinessStatus === 'configured_not_connected'
          ? 'warning'
          : 'not_connected',
      title: '企业 SSO',
      fact: ssoReadinessStatus === 'disabled'
        ? `当前企业 SSO 未启用，已观测到 SSO 配置 ${ssoConfiguredCount} 项。`
        : ssoReadinessStatus === 'missing_config'
          ? `企业 SSO 已启用，但必填配置 ${ssoRequiredConfiguredCount}/${ssoRequiredConfigCount} 项完整。`
          : `企业 SSO 配置已完整，但登录回调和真实 provider 尚未接线；enabled=${ssoEnabledLabel}。`,
      recovery: ssoReadinessStatus === 'disabled'
        ? '如需推进企业统一身份，先在 system_config 中启用 enterprise.sso.enabled 并补齐 issuer/client/redirect 配置。'
        : ssoReadinessStatus === 'missing_config'
          ? '先补齐 enterprise.sso.issuer_url、enterprise.sso.client_id 与 enterprise.sso.redirect_uri，再接入登录回调和审计写入。'
          : '下一步需要新增只读 SSO provider 验证、登录回调、会话归一化与审计写入，不能仅凭配置把 SSO 标记为 ready。',
    },
    {
      area: 'organization_governance',
      status: organizationReadinessStatus === 'member_ready' ? 'ready' : 'warning',
      title: '组织 / 团队 / 成员模型',
      fact: organizationReadinessStatus === 'schema_ready_no_data'
        ? `企业组织、团队与成员 schema 已就绪，但当前组织 ${organizationCount} 个、团队 ${teamCount} 个、成员绑定 ${memberCount} 个；用户总数 ${userCount}。`
        : organizationReadinessStatus === 'team_ready_no_members'
          ? `已观测到组织 ${organizationCount} 个、团队 ${teamCount} 个，但成员绑定仍为 ${memberCount} 个。`
          : `已观测到组织 ${organizationCount} 个、团队 ${teamCount} 个、成员绑定 ${memberCount} 个。`,
      recovery: organizationReadinessStatus === 'schema_ready_no_data'
        ? '先通过受控入口创建企业组织和团队，再补齐 enterprise_members 成员绑定；不能仅凭 schema 把组织治理标记为 ready。'
        : organizationReadinessStatus === 'team_ready_no_members'
          ? '先补齐 enterprise_members 成员绑定，再推进组织级 RBAC、项目归属和租户隔离。'
          : '继续推进组织级 RBAC、项目归属迁移、租户隔离和企业审计增强。',
    },
    {
      area: 'project_ownership',
      status: projectOwnershipReadinessStatus === 'legacy_user_owned' ? 'blocked' : 'warning',
      title: '项目归属迁移',
      fact: projectOwnershipReadinessStatus === 'no_projects'
        ? '当前没有可观测项目，项目归属迁移尚无执行对象。'
        : projectOwnershipReadinessStatus === 'organization_model_not_ready'
          ? `已观测到项目 ${projectOwnershipProjectCount} 个，但企业组织/团队/成员真源尚未完整；legacy user-owned=${projectOwnershipLegacyUserOwnedProjectCount}。`
          : projectOwnershipReadinessStatus === 'legacy_user_owned'
            ? `项目 ${projectOwnershipProjectCount} 个仍有 ${projectOwnershipLegacyUserOwnedProjectCount} 个缺少显式企业归属映射，组织项目 ${projectOwnershipOrganizationProjectCount} 个，未迁移 ${projectOwnershipUnmigratedProjectCount} 个。`
            : projectOwnershipReadinessStatus === 'ownership_schema_ready'
              ? `项目 ${projectOwnershipProjectCount} 个均已有显式企业归属映射，组织项目 ${projectOwnershipOrganizationProjectCount} 个，未迁移 ${projectOwnershipUnmigratedProjectCount} 个；租户隔离和组织级 RBAC 仍未接线。`
              : '项目归属 readiness 返回了未知状态，需要先收口后端枚举契约。',
      recovery: projectOwnershipReadinessStatus === 'no_projects'
        ? '先确认 Admin Projects 能读取项目真源；有项目后再设计 organization/team ownership contract。'
        : projectOwnershipReadinessStatus === 'organization_model_not_ready'
          ? '先补齐企业组织、团队和成员绑定，再开放项目归属迁移入口。'
          : projectOwnershipReadinessStatus === 'legacy_user_owned'
            ? '开放受控项目归属迁移入口；迁移完成前不得启用租户隔离或组织级 RBAC。'
            : projectOwnershipReadinessStatus === 'ownership_schema_ready'
              ? '继续查证映射来源，再推进租户隔离、组织级 RBAC 与 owner guard 改造。'
              : '先更新前后端项目归属 readiness 枚举契约，再继续企业治理接线。',
    },
    {
      area: 'project_ownership_preflight',
      status: projectOwnershipPreflightStatus === 'organization_model_not_ready' ? 'blocked' : 'warning',
      title: '项目归属迁移预检',
      fact: projectOwnershipPreflightStatus === 'no_projects'
        ? '当前没有可观测项目，迁移预检尚无候选对象。'
        : projectOwnershipPreflightStatus === 'organization_model_not_ready'
          ? `组织/团队/成员真源尚未完整；现有显式归属 ${projectOwnershipPreflightExistingOwnershipCount} 个，候选 ${projectOwnershipPreflightCandidateProjectCount} 个。`
          : projectOwnershipPreflightStatus === 'no_candidates'
            ? `当前没有待迁移项目；现有显式归属 ${projectOwnershipPreflightExistingOwnershipCount} 个。`
            : projectOwnershipPreflightStatus === 'candidate_ready'
              ? `已生成只读候选事实 ${projectOwnershipPreflightCandidateProjectCount} 个；现有显式归属 ${projectOwnershipPreflightExistingOwnershipCount} 个。`
              : '项目归属 preflight 返回了未知状态，需要先收口后端枚举契约。',
      recovery: projectOwnershipPreflightStatus === 'no_projects'
        ? '先确认 Admin Projects 能读取项目真源，再重新运行项目归属迁移预检。'
        : projectOwnershipPreflightStatus === 'organization_model_not_ready'
          ? '先补齐企业组织、团队和成员绑定；预检不会写 projects 或映射表。'
          : projectOwnershipPreflightStatus === 'no_candidates'
            ? '继续查证映射来源与审计事实，再推进租户隔离、组织级 RBAC 和 owner guard 改造。'
            : projectOwnershipPreflightStatus === 'candidate_ready'
              ? '下一步设计受控迁移确认入口；执行前仍不得启用租户隔离、组织级 RBAC 或修改 owner guard。'
              : '先更新前后端项目归属 preflight 枚举契约，再继续企业治理接线。',
    },
    {
      area: 'project_ownership_mapping',
      status: projectOwnershipMappingStatus === 'mapping_ready' ? 'warning' : 'blocked',
      title: '项目归属映射回读',
      fact: projectOwnershipMappingStatus === 'no_mappings'
        ? '当前尚未观测到企业项目归属映射，无法查证迁移结果。'
        : `已回读企业项目归属映射 ${projectOwnershipMappingCount} 个；缺失项目真源 ${projectOwnershipMissingProjectCount} 个。`,
      recovery: projectOwnershipMappingStatus === 'no_mappings'
        ? '先通过受控迁移入口写入 enterprise_project_ownerships，再回读映射与 Admin audit。'
        : '继续核对映射、项目、组织、团队和审计记录；owner guard、租户隔离和组织级 RBAC 仍需后续显式接线。',
    },
    {
      area: 'project_ownership_owner_guard',
      status: projectOwnershipOwnerGuardStatus === 'owner_guard_ready'
        ? 'warning'
        : projectOwnershipOwnerGuardStatus === 'mapping_evidence_drift'
          ? 'warning'
          : 'blocked',
      title: '项目 owner guard 接线 readiness',
      fact: projectOwnershipOwnerGuardStatus === 'no_projects'
        ? '当前没有可观测项目，无法评估 owner guard 显式归属覆盖率。'
        : projectOwnershipOwnerGuardStatus === 'no_mappings'
          ? '当前没有企业项目归属映射，owner guard 仍只能依赖 legacy projects.user_id。'
          : projectOwnershipOwnerGuardStatus === 'unmapped_projects'
            ? `现有项目中已映射 ${projectOwnershipOwnerGuardMappedProjectCount} 个，未映射 ${projectOwnershipOwnerGuardUnmappedProjectCount} 个。`
            : projectOwnershipOwnerGuardStatus === 'mapping_evidence_drift'
              ? `现有项目均有映射，但存在 ${projectOwnershipOwnerGuardExtraOwnershipCount} 个指向缺失项目真源的额外映射。`
              : `现有项目已映射 ${projectOwnershipOwnerGuardMappedProjectCount} 个，未映射 ${projectOwnershipOwnerGuardUnmappedProjectCount} 个，可进入 owner guard 接线设计评审。`,
      recovery: projectOwnershipOwnerGuardStatus === 'owner_guard_ready'
        ? '下一步显式改造 requireOwnedProject / workspace_project_access，并配套租户隔离和组织级 RBAC；当前 readiness 不改变访问控制。'
        : projectOwnershipOwnerGuardStatus === 'mapping_evidence_drift'
          ? '先核对缺失项目真源、软删除历史和 Admin audit，清理证据漂移后再推进 owner guard 设计。'
          : '先补齐 enterprise_project_ownerships 对现有项目的覆盖；不得在未覆盖时启用 owner guard 接线。',
    },
    {
      area: 'project_access_guard_switch',
      status: projectAccessGuardSwitchStatus === 'enterprise_switch_ready' && projectAccessGuardSwitchCanSwitch === true && hasInactiveProjectAccessGuardSwitchAuthorization === true
        ? 'warning'
        : projectAccessGuardSwitchStatus === 'mapping_evidence_drift'
          ? 'warning'
          : 'blocked',
      title: 'Project Access Guard switch readiness',
      fact: projectAccessGuardSwitchStatus === 'ownership_repo_unavailable'
        ? 'Project Access Guard 尚不能读取企业项目归属映射，不能评估企业授权切换 readiness。'
        : projectAccessGuardSwitchStatus === 'no_projects'
          ? '当前没有可观测项目，企业映射授权切换尚无评估对象。'
          : projectAccessGuardSwitchStatus === 'no_mappings'
            ? '当前没有企业项目归属映射，Project Access Guard 不能切换到 enterprise_owned 模式。'
            : projectAccessGuardSwitchStatus === 'unmapped_projects'
              ? `现有项目中已映射 ${projectAccessGuardSwitchMappedProjectCount} 个，未映射 ${projectAccessGuardSwitchUnmappedProjectCount} 个，不能切换授权模式。`
              : projectAccessGuardSwitchStatus === 'mapping_evidence_drift'
                ? `现有项目均有映射，但存在 ${projectAccessGuardSwitchExtraOwnershipCount} 个指向缺失项目真源的额外映射。`
                : `现有项目已映射 ${projectAccessGuardSwitchMappedProjectCount} 个，未映射 ${projectAccessGuardSwitchUnmappedProjectCount} 个；canSwitch=${projectAccessGuardSwitchCanSwitchLabel}，enterpriseAuthorizationActive=${projectAccessGuardSwitchAuthorizationActiveLabel}。`,
      recovery: projectAccessGuardSwitchStatus === 'enterprise_switch_ready'
        ? '下一步仍需显式实现授权模式切换、租户隔离和组织级 RBAC；当前 readiness 不改变访问控制。'
        : projectAccessGuardSwitchStatus === 'mapping_evidence_drift'
          ? '先核对缺失项目真源、软删除历史和 Admin audit，清理证据漂移后再推进授权切换设计。'
          : '先补齐 enterprise_project_ownerships 对现有项目的覆盖；不得在 readiness 未满足时切换授权模式。',
    },
    {
      area: 'project_access_guard_authorization_dry_run',
      status: projectAccessGuardAuthorizationDryRunStatus === 'dry_run_aligned' && hasInactiveProjectAccessGuardDryRunAuthorization === true
        ? 'warning'
        : projectAccessGuardAuthorizationDryRunStatus === 'drift_detected'
          ? 'blocked'
          : projectAccessGuardAuthorizationDryRunStatus === 'enterprise_unavailable'
            ? 'blocked'
            : 'warning',
      title: 'Project Access Guard authorization dry-run',
      fact: projectAccessGuardAuthorizationDryRunStatus === 'ownership_repo_unavailable'
        ? 'Project Access Guard dry-run 不能读取企业项目归属和成员真源，无法比较 legacy 与 enterprise 授权。'
        : projectAccessGuardAuthorizationDryRunStatus === 'no_projects'
          ? '当前没有可观测项目，企业映射授权 dry-run 尚无比较对象。'
          : projectAccessGuardAuthorizationDryRunStatus === 'enterprise_unavailable'
            ? `已比较 ${projectAccessGuardAuthorizationDryRunComparedProjectCount} 个项目，其中 ${projectAccessGuardAuthorizationDryRunEnterpriseUnavailableProjectCount} 个项目的企业授权 evidence 不可用。`
            : projectAccessGuardAuthorizationDryRunStatus === 'drift_detected'
              ? `已比较 ${projectAccessGuardAuthorizationDryRunComparedProjectCount} 个项目，legacy granted / enterprise blocked=${projectAccessGuardAuthorizationDryRunLegacyGrantedEnterpriseBlockedCount}，legacy blocked / enterprise granted=${projectAccessGuardAuthorizationDryRunLegacyBlockedEnterpriseGrantedCount}，预览 ${projectAccessGuardAuthorizationDryRunDriftCandidateCount} 条。`
              : `已比较 ${projectAccessGuardAuthorizationDryRunComparedProjectCount} 个项目，aligned=${projectAccessGuardAuthorizationDryRunAlignedProjectCount}；enterpriseAuthorizationActive=${projectAccessGuardAuthorizationDryRunAuthorizationActiveLabel}。`,
      recovery: projectAccessGuardAuthorizationDryRunStatus === 'dry_run_aligned'
        ? 'dry-run 已对齐，但仍需后续显式评审授权模式切换、租户隔离和组织级 RBAC；当前不改变真实访问控制。'
        : projectAccessGuardAuthorizationDryRunStatus === 'drift_detected'
          ? '先修复 legacy 与 enterprise dry-run 授权漂移，核对 enterprise_project_ownerships 和 enterprise_members，再评审真实切换。'
          : projectAccessGuardAuthorizationDryRunStatus === 'enterprise_unavailable'
            ? '先修复成员查询、映射查询或底层 repo 可用性；不可用 evidence 不能作为授权切换依据。'
            : '先补齐可观测项目、企业项目归属和成员绑定，再重新运行 dry-run evidence。',
    },
    {
      area: 'project_access_guard_activation',
      status: projectAccessGuardActivationStatus === 'ready_to_activate' && projectAccessGuardActivationCanActivate === true && hasInactiveProjectAccessGuardActivationAuthorization === true
        ? 'warning'
        : projectAccessGuardActivationStatus === 'switch_not_ready'
          ? 'blocked'
          : projectAccessGuardActivationStatus === 'dry_run_unavailable'
            ? 'blocked'
            : projectAccessGuardActivationStatus === 'drift_detected'
              ? 'blocked'
              : projectAccessGuardActivationStatus === 'already_active'
                ? 'warning'
                : 'warning',
      title: 'Project Access Guard activation readiness',
      fact: projectAccessGuardActivationStatus === 'ownership_repo_unavailable'
        ? 'Project Access Guard activation readiness 不能读取企业项目归属或成员真源。'
        : projectAccessGuardActivationStatus === 'no_projects'
          ? '当前没有可观测项目，企业映射授权 activation readiness 尚无评估对象。'
          : projectAccessGuardActivationStatus === 'switch_not_ready'
            ? `switchStatus=${projectAccessGuardActivationSwitchStatus}；已映射 ${projectAccessGuardActivationMappedProjectCount} 个，未映射 ${projectAccessGuardActivationUnmappedProjectCount} 个，额外映射 ${projectAccessGuardActivationExtraOwnershipCount} 个，blockers=${projectAccessGuardActivationBlockerCandidateCount}。`
            : projectAccessGuardActivationStatus === 'dry_run_unavailable'
              ? `authorizationDryRunStatus=${projectAccessGuardActivationAuthorizationDryRunStatus}；已比较 ${projectAccessGuardActivationComparedProjectCount} 个，enterprise unavailable=${projectAccessGuardActivationEnterpriseUnavailableCount}，blockers=${projectAccessGuardActivationBlockerCandidateCount}。`
              : projectAccessGuardActivationStatus === 'drift_detected'
                ? `authorizationDryRunStatus=${projectAccessGuardActivationAuthorizationDryRunStatus}；authorization drift=${projectAccessGuardActivationAuthorizationDriftCount}，aligned=${projectAccessGuardActivationAlignedProjectCount}，blockers=${projectAccessGuardActivationBlockerCandidateCount}。`
                : `canActivate=${projectAccessGuardActivationCanActivateLabel}；switch=${projectAccessGuardActivationSwitchStatus}；dryRun=${projectAccessGuardActivationAuthorizationDryRunStatus}；reviewItems=${projectAccessGuardActivationReviewItemCount}，reviewBlocked=${projectAccessGuardActivationReviewBlockedCount}，manualRequired=${projectAccessGuardActivationReviewManualRequiredCount}；auditPlanItems=${projectAccessGuardActivationAuditPlanItemCount}，auditBlocked=${projectAccessGuardActivationAuditPlanBlockedCount}，auditManualRequired=${projectAccessGuardActivationAuditPlanManualRequiredCount}；enterpriseAuthorizationActive=${projectAccessGuardActivationAuthorizationActiveLabel}。`,
      recovery: projectAccessGuardActivationStatus === 'ready_to_activate'
        ? 'activation readiness 已满足，但真实切换仍必须通过独立显式任务实现，并同步租户隔离、组织级 RBAC 和审计验证。'
        : projectAccessGuardActivationStatus === 'switch_not_ready'
          ? '先让 switch readiness 达到 enterprise_switch_ready；不得在映射覆盖或证据漂移未收口时切换授权模式。'
          : projectAccessGuardActivationStatus === 'dry_run_unavailable'
            ? '先修复成员查询、映射查询或 repo 可用性；不可用 dry-run 不能作为授权切换依据。'
            : projectAccessGuardActivationStatus === 'drift_detected'
              ? '先处理 legacy 与 enterprise dry-run 授权漂移，补齐成员绑定或修正映射。'
              : '先补齐可观测项目、企业项目归属、成员绑定与 dry-run evidence，再重新评估 activation readiness。',
    },
    {
      area: 'project_access_guard_activation_audit',
      status: projectAccessGuardActivationAuditStatus === 'audit_events_recorded' && projectAccessGuardActivationAuditPayloadIntegrityStatus === 'payload_integrity_ready' && projectAccessGuardActivationAuditMetadataIntegrityStatus === 'metadata_integrity_ready' ? 'ready' : 'warning',
      title: 'Project Access Guard activation audit readback',
      fact: projectAccessGuardActivationAuditStatus === 'schema_ready_no_events'
        ? `activation audit schema 已就绪但尚无真实事件；auditEvents=${projectAccessGuardActivationAuditEventCount}，requiredEventTypes=${projectAccessGuardActivationAuditRequiredEventTypeCount}，missing=${projectAccessGuardActivationAuditMissingRequiredEventTypeCount}，payload=${projectAccessGuardActivationAuditPayloadIntegrityStatus}，metadata=${projectAccessGuardActivationAuditMetadataIntegrityStatus}。`
        : projectAccessGuardActivationAuditStatus === 'partial_events_recorded'
          ? `activation audit 已记录部分事件；auditEvents=${projectAccessGuardActivationAuditEventCount}，recent=${projectAccessGuardActivationAuditRecentEventCount}，missing=${projectAccessGuardActivationAuditMissingRequiredEventTypeCount}，payloadIssues=${projectAccessGuardActivationAuditPayloadIntegrityIssueCount}，metadataIssues=${projectAccessGuardActivationAuditMetadataIntegrityIssueCount}。`
          : `activation audit 已记录完整 required event type 覆盖；auditEvents=${projectAccessGuardActivationAuditEventCount}，recent=${projectAccessGuardActivationAuditRecentEventCount}，payload=${projectAccessGuardActivationAuditPayloadIntegrityStatus}，payloadIssues=${projectAccessGuardActivationAuditPayloadIntegrityIssueCount}，metadata=${projectAccessGuardActivationAuditMetadataIntegrityStatus}，metadataIssues=${projectAccessGuardActivationAuditMetadataIntegrityIssueCount}。`,
      recovery: projectAccessGuardActivationAuditStatus === 'schema_ready_no_events'
        ? 'manual approval、activation execution、post-activation validation 与 rollback evidence 是当前受控 activation audit 写入入口；后续真实切换任务仍必须显式执行 activation。'
        : projectAccessGuardActivationAuditMetadataIntegrityStatus === 'metadata_integrity_failed'
          ? '先修复 activation audit metadata integrity issues；event type/status、current/target mode 或 source 不符合契约时不得作为完整审计证据。'
        : projectAccessGuardActivationAuditPayloadIntegrityStatus === 'payload_integrity_failed'
          ? '先修复 activation audit payload integrity issues；缺少 snapshot payload、非法 JSON object 或 rollback reference 缺失时不得作为完整审计证据。'
        : projectAccessGuardActivationAuditStatus === 'partial_events_recorded'
          ? '继续只读核对缺失 required event types；不得把部分事件记录视为完整 activation audit 证据。'
          : '继续核对 activation audit 事件内容，再评估企业授权、租户隔离和组织级 RBAC 的真实接线证据。',
    },
    {
      area: 'rbac',
      status: rbacReady ? 'ready' : 'warning',
      title: '企业级 RBAC 基础',
      fact: `当前角色 ${roleCount} 个，权限点 ${permissionCount} 个。`,
      recovery: rbacReady
        ? '已有角色与权限点真源，可继续扩展组织级角色绑定和跨租户隔离。'
        : '先确认后台角色和权限点初始化完整，再推进组织级 RBAC。',
    },
    {
      area: 'audit',
      status: enterpriseAuditCoverageStatus === 'audit_coverage_ready' ? 'ready' : 'warning',
      title: '企业审计覆盖 readiness',
      fact: enterpriseAuditCoverageStatus === 'no_audit_logs'
        ? `后台审计日志总数 ${enterpriseAuditCoverageAdminAuditLogCount} 条；最近列表回读 ${auditLogCount} 条；activation audit 事件 ${enterpriseAuditCoverageActivationAuditEventCount} 条。`
        : enterpriseAuditCoverageStatus === 'activation_audit_missing'
          ? `后台审计日志总数 ${enterpriseAuditCoverageAdminAuditLogCount} 条，但 activation audit 事件 ${enterpriseAuditCoverageActivationAuditEventCount} 条；覆盖源 ${enterpriseAuditCoverageCoveredSourceCount}/${enterpriseAuditCoverageRequiredSourceCount}。`
          : `后台审计日志总数 ${enterpriseAuditCoverageAdminAuditLogCount} 条，activation audit 事件 ${enterpriseAuditCoverageActivationAuditEventCount} 条；覆盖源 ${enterpriseAuditCoverageCoveredSourceCount}/${enterpriseAuditCoverageRequiredSourceCount}。`,
      recovery: enterpriseAuditCoverageStatus === 'no_audit_logs'
        ? '先通过受控 Admin 操作写入 admin_audit_log，再核对企业治理审计覆盖；不得在 readiness 聚合中新增写入口。'
        : enterpriseAuditCoverageStatus === 'activation_audit_missing'
          ? '继续通过受控 activation audit evidence 入口补齐 manual approval、execution、post-validation 与 rollback 事件；当前聚合只读。'
          : '已有 admin_audit_log 与 activation audit 只读覆盖事实，可继续扩展企业审计筛选、导出和高风险操作 coverage。',
    },
    {
      area: 'audit_export',
      status: enterpriseAuditExportStatus === 'audit_export_ready' ? 'ready' : 'warning',
      title: '企业审计导出 readiness',
      fact: enterpriseAuditExportStatus === 'no_audit_logs'
        ? `后台审计日志总数 ${enterpriseAuditExportAdminAuditLogCount} 条；导出样本 ${enterpriseAuditExportSampleCount}/${enterpriseAuditExportSampleLimit}；最大窗口 ${enterpriseAuditExportMaxWindow}。`
        : enterpriseAuditExportStatus === 'activation_audit_missing'
          ? `后台审计日志总数 ${enterpriseAuditExportAdminAuditLogCount} 条，但 activation audit 事件 ${enterpriseAuditExportActivationAuditEventCount} 条；导出样本 ${enterpriseAuditExportSampleCount}/${enterpriseAuditExportSampleLimit}。`
          : enterpriseAuditExportStatus === 'export_sample_missing'
            ? `后台审计日志总数 ${enterpriseAuditExportAdminAuditLogCount} 条，activation audit 事件 ${enterpriseAuditExportActivationAuditEventCount} 条，但最近导出样本回读为空。`
            : `后台审计日志总数 ${enterpriseAuditExportAdminAuditLogCount} 条，activation audit 事件 ${enterpriseAuditExportActivationAuditEventCount} 条；导出样本 ${enterpriseAuditExportSampleCount}/${enterpriseAuditExportSampleLimit}，覆盖源 ${enterpriseAuditExportCoveredSourceCount}/${enterpriseAuditExportRequiredSourceCount}。`,
      recovery: enterpriseAuditExportStatus === 'no_audit_logs'
        ? '先通过受控 Admin 操作形成 admin_audit_log 真源，再评估导出窗口；不得在导出 readiness 中新增写入口。'
        : enterpriseAuditExportStatus === 'activation_audit_missing'
          ? '继续补齐 activation audit evidence 后再开放导出任务设计；当前导出 readiness 只读。'
          : enterpriseAuditExportStatus === 'export_sample_missing'
            ? '先核对 admin_audit_log 列表回读与分页权限；不得通过写入新审计记录来掩盖样本回读问题。'
            : '已有导出前置只读证据，可继续设计受控导出任务、格式和保留策略；当前不生成导出文件。',
    },
    {
      area: 'audit_export_query',
      status: enterpriseAuditExportQueryStatus === 'audit_export_query_ready' ? 'ready' : 'warning',
      title: '企业审计导出查询 readiness',
      fact: enterpriseAuditExportQueryStatus === 'no_audit_logs'
        ? `后台审计日志样本 ${enterpriseAuditExportQuerySampleCount}/${enterpriseAuditExportQuerySampleLimit}；支持过滤字段 ${enterpriseAuditExportQuerySupportedFilterFieldCount}/${enterpriseAuditExportQueryRequiredFilterFieldCount}。`
        : enterpriseAuditExportQueryStatus === 'activation_audit_missing'
          ? `activation audit 覆盖缺失；样本 action ${enterpriseAuditExportQuerySampleActionCount} 类，targetType ${enterpriseAuditExportQuerySampleTargetTypeCount} 类。`
          : enterpriseAuditExportQueryStatus === 'query_sample_missing'
            ? `导出查询样本为空；maxQueryWindow=${enterpriseAuditExportQueryMaxWindow}，taskCreation=${enterpriseAuditExportQueryTaskCreationEnabledLabel}。`
            : `导出查询字段已具备；样本 ${enterpriseAuditExportQuerySampleCount}/${enterpriseAuditExportQuerySampleLimit}，action ${enterpriseAuditExportQuerySampleActionCount} 类，actor ${enterpriseAuditExportQuerySampleActorCount} 个，覆盖源 ${enterpriseAuditExportQueryCoveredSourceCount}/${enterpriseAuditExportQueryRequiredSourceCount}；fileGeneration=${enterpriseAuditExportQueryFileGenerationEnabledLabel}。`,
      recovery: enterpriseAuditExportQueryStatus === 'no_audit_logs'
        ? '先形成 admin_audit_log 真源，再评估导出查询字段；当前不创建导出任务或文件。'
        : enterpriseAuditExportQueryStatus === 'activation_audit_missing'
          ? '继续补齐 activation audit evidence 后再推进导出查询条件；当前 readiness 只读。'
          : enterpriseAuditExportQueryStatus === 'query_sample_missing'
            ? '先核对 admin_audit_log 列表回读和分页权限；不得通过写入新审计记录来掩盖查询样本问题。'
            : '已有导出查询只读证据，可继续设计受控导出任务创建、过滤请求校验和文件生成流程；当前不创建任务、不生成文件。',
    },
    {
      area: 'audit_export_task_preflight',
      status: enterpriseAuditExportTaskPreflightStatus === 'audit_export_task_preflight_ready' ? 'ready' : 'warning',
      title: '企业审计导出任务 preflight readiness',
      fact: enterpriseAuditExportTaskPreflightStatus === 'no_audit_logs'
        ? `后台审计日志样本 ${enterpriseAuditExportTaskPreflightSampleCount}/${enterpriseAuditExportTaskPreflightSampleLimit}；taskCreation=${enterpriseAuditExportTaskPreflightTaskCreationEnabledLabel}。`
        : enterpriseAuditExportTaskPreflightStatus === 'activation_audit_missing'
          ? `activation audit 覆盖缺失；filter fields ${enterpriseAuditExportTaskPreflightSupportedFilterFieldCount}/${enterpriseAuditExportTaskPreflightRequiredFilterFieldCount}。`
          : enterpriseAuditExportTaskPreflightStatus === 'query_not_ready'
            ? `导出查询前置未就绪；样本 ${enterpriseAuditExportTaskPreflightSampleCount}/${enterpriseAuditExportTaskPreflightSampleLimit}，filter fields ${enterpriseAuditExportTaskPreflightSupportedFilterFieldCount}/${enterpriseAuditExportTaskPreflightRequiredFilterFieldCount}。`
            : enterpriseAuditExportTaskPreflightStatus === 'retention_not_ready'
              ? `保留策略前置未就绪；retentionConfigured=${enterpriseAuditExportTaskPreflightRetentionPolicyConfiguredLabel}，retentionDays=${enterpriseAuditExportTaskPreflightRetentionDays}。`
              : `导出任务创建前置已具备；覆盖源 ${enterpriseAuditExportTaskPreflightCoveredSourceCount}/${enterpriseAuditExportTaskPreflightRequiredSourceCount}；taskCreation=${enterpriseAuditExportTaskPreflightTaskCreationEnabledLabel}；fileGeneration=${enterpriseAuditExportTaskPreflightFileGenerationEnabledLabel}。`,
      recovery: enterpriseAuditExportTaskPreflightStatus === 'no_audit_logs'
        ? '先形成 admin_audit_log 真源，再评估导出任务创建 preflight；当前不创建任务或文件。'
        : enterpriseAuditExportTaskPreflightStatus === 'activation_audit_missing'
          ? '继续补齐 activation audit evidence 后再评估导出任务创建前置条件；当前 preflight 只读。'
          : enterpriseAuditExportTaskPreflightStatus === 'query_not_ready'
            ? '先确认导出查询样本和过滤字段 readiness；不得通过创建任务来掩盖查询 readiness 问题。'
            : enterpriseAuditExportTaskPreflightStatus === 'retention_not_ready'
              ? '先补齐有效的 enterprise.audit.retention_days 配置；当前 preflight 不自动写入配置、不删除审计数据。'
              : '已有导出任务创建前置只读证据，可继续设计受控任务创建 API、请求确认和文件格式；当前不创建任务、不生成文件。',
    },
    {
      area: 'audit_export_file_format',
      status: enterpriseAuditExportFileFormatStatus === 'audit_export_file_format_ready' ? 'ready' : 'warning',
      title: '企业审计导出文件格式 readiness',
      fact: enterpriseAuditExportFileFormatStatus === 'no_audit_logs'
        ? `后台审计日志真源未就绪；formats ${enterpriseAuditExportFileFormatSupportedFileFormatCount}/${enterpriseAuditExportFileFormatRequiredFileFormatCount}。`
        : enterpriseAuditExportFileFormatStatus === 'task_preflight_not_ready'
          ? `导出任务 preflight 前置未就绪；formats ${enterpriseAuditExportFileFormatSupportedFileFormatCount}/${enterpriseAuditExportFileFormatRequiredFileFormatCount}，columns ${enterpriseAuditExportFileFormatRequiredColumnCount}。`
          : enterpriseAuditExportFileFormatStatus === 'format_contract_missing'
            ? `文件格式契约缺失；schema=${enterpriseAuditExportFileFormatSchemaVersion}，columns ${enterpriseAuditExportFileFormatRequiredColumnCount}。`
            : `文件格式契约已声明；formats ${enterpriseAuditExportFileFormatSupportedFileFormatCount}/${enterpriseAuditExportFileFormatRequiredFileFormatCount}，columns ${enterpriseAuditExportFileFormatRequiredColumnCount}，schema=${enterpriseAuditExportFileFormatSchemaVersion}，覆盖源 ${enterpriseAuditExportFileFormatCoveredSourceCount}/${enterpriseAuditExportFileFormatRequiredSourceCount}；fileGeneration=${enterpriseAuditExportFileFormatFileGenerationEnabledLabel}。`,
      recovery: enterpriseAuditExportFileFormatStatus === 'no_audit_logs'
        ? '先形成 admin_audit_log 真源，再评估导出文件格式；当前不创建任务、不生成文件。'
        : enterpriseAuditExportFileFormatStatus === 'task_preflight_not_ready'
          ? '先补齐导出任务创建 preflight 所需 activation audit、查询样本、过滤字段和 retention policy；当前 readiness 只读。'
          : enterpriseAuditExportFileFormatStatus === 'format_contract_missing'
            ? '先补齐受支持文件格式、必备列和 schema version；当前不生成文件、不写 audit。'
            : `已有导出文件格式只读契约，可继续设计受控导出任务创建 API 和文件生成器；taskCreation=${enterpriseAuditExportFileFormatTaskCreationEnabledLabel}，当前不创建任务、不生成文件。`,
    },
    {
      area: 'audit_export_file_generator',
      status: enterpriseAuditExportFileGeneratorStatus === 'audit_export_file_generator_ready' ? 'ready' : 'warning',
      title: '企业审计导出文件生成器 readiness',
      fact: enterpriseAuditExportFileGeneratorStatus === 'no_audit_logs'
        ? `后台审计日志真源未就绪；outputPrefix=${enterpriseAuditExportFileGeneratorOutputPathPrefix}。`
        : enterpriseAuditExportFileGeneratorStatus === 'file_format_not_ready'
          ? `文件格式 readiness 未就绪；checksum=${enterpriseAuditExportFileGeneratorChecksumAlgorithm}，maxRows=${enterpriseAuditExportFileGeneratorMaxRowsPerFile}。`
          : enterpriseAuditExportFileGeneratorStatus === 'generator_contract_missing'
            ? `生成器契约缺失；prefix=${enterpriseAuditExportFileGeneratorOutputPathPrefix}，template=${enterpriseAuditExportFileGeneratorFileNameTemplate}。`
            : `生成器契约已声明；prefix=${enterpriseAuditExportFileGeneratorOutputPathPrefix}，checksum=${enterpriseAuditExportFileGeneratorChecksumAlgorithm}，maxRows=${enterpriseAuditExportFileGeneratorMaxRowsPerFile}，覆盖源 ${enterpriseAuditExportFileGeneratorCoveredSourceCount}/${enterpriseAuditExportFileGeneratorRequiredSourceCount}；storageWrite=${enterpriseAuditExportFileGeneratorOutputStorageWriteEnabledLabel}，fileGeneration=${enterpriseAuditExportFileGeneratorFileGenerationEnabledLabel}。`,
      recovery: enterpriseAuditExportFileGeneratorStatus === 'no_audit_logs'
        ? '先形成 admin_audit_log 真源，再评估导出文件生成器；当前不创建任务、不生成文件、不写 storage。'
        : enterpriseAuditExportFileGeneratorStatus === 'file_format_not_ready'
          ? '先补齐导出文件格式 readiness；当前生成器 readiness 只读，不写配置、不生成文件。'
          : enterpriseAuditExportFileGeneratorStatus === 'generator_contract_missing'
            ? '先补齐输出路径前缀、文件名模板、checksum algorithm 和单文件行数上限；当前不写 storage、不生成文件。'
            : `已有导出文件生成器只读契约，可继续设计受控导出任务创建 API 或真实生成器；dryRun=${enterpriseAuditExportFileGeneratorDryRunEnabledLabel}，taskCreation=${enterpriseAuditExportFileGeneratorTaskCreationEnabledLabel}，当前不创建任务、不生成文件。`,
    },
    {
      area: 'audit_export_task_create_request',
      status: enterpriseAuditExportTaskCreateRequestStatus === 'audit_export_task_create_request_ready' ? 'ready' : 'warning',
      title: '企业审计导出任务创建请求 readiness',
      fact: enterpriseAuditExportTaskCreateRequestStatus === 'no_audit_logs'
        ? `后台审计日志真源未就绪；requestSchema=${enterpriseAuditExportTaskCreateRequestSchemaVersion}。`
        : enterpriseAuditExportTaskCreateRequestStatus === 'file_generator_not_ready'
          ? `文件生成器 readiness 未就绪；requestFields=${enterpriseAuditExportTaskCreateRequestRequiredFieldCount}，idempotency=${enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequiredLabel}。`
          : enterpriseAuditExportTaskCreateRequestStatus === 'task_create_request_contract_missing'
            ? `任务创建请求契约缺失；requestSchema=${enterpriseAuditExportTaskCreateRequestSchemaVersion}，confirmation=${enterpriseAuditExportTaskCreateRequestConfirmationRequiredLabel}。`
            : `任务创建请求契约已声明；requestSchema=${enterpriseAuditExportTaskCreateRequestSchemaVersion}，fields=${enterpriseAuditExportTaskCreateRequestRequiredFieldCount}，覆盖源 ${enterpriseAuditExportTaskCreateRequestCoveredSourceCount}/${enterpriseAuditExportTaskCreateRequestRequiredSourceCount}；taskCreation=${enterpriseAuditExportTaskCreateRequestTaskCreationEnabledLabel}，storageWrite=${enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabledLabel}，auditWrite=${enterpriseAuditExportTaskCreateRequestAuditWriteEnabledLabel}。`,
      recovery: enterpriseAuditExportTaskCreateRequestStatus === 'no_audit_logs'
        ? '先形成 admin_audit_log 真源，再评估导出任务创建请求；当前不创建任务、不生成文件、不写 storage。'
        : enterpriseAuditExportTaskCreateRequestStatus === 'file_generator_not_ready'
          ? '先补齐导出文件生成器 readiness；当前任务创建请求 readiness 只读，不创建任务。'
          : enterpriseAuditExportTaskCreateRequestStatus === 'task_create_request_contract_missing'
            ? '先补齐请求 schema、必备字段、幂等键和确认字段；当前不写 audit、不生成文件。'
            : `已有导出任务创建请求只读契约，可继续设计受控 POST 任务创建 API；fileGeneration=${getAdminEnterpriseSnapshotTrueFalseLabel(enterpriseAuditExportTaskCreateRequestFileGenerationEnabled)}，当前不创建任务、不生成文件、不写 storage。`,
    },
    {
      area: 'audit_export_task_persistence',
      status: enterpriseAuditExportTaskPersistenceStatus === 'audit_export_task_persistence_ready' ? 'ready' : 'warning',
      title: '企业审计导出任务持久化 readiness',
      fact: enterpriseAuditExportTaskPersistenceStatus === 'no_audit_logs'
        ? `后台审计日志真源未就绪；table=${enterpriseAuditExportTaskPersistenceTableName}，schema=${enterpriseAuditExportTaskPersistenceSchemaVersion}。`
        : enterpriseAuditExportTaskPersistenceStatus === 'task_create_request_not_ready'
          ? `任务创建请求 readiness 未就绪；fields=${enterpriseAuditExportTaskPersistenceRequiredFieldCount}，idempotencyUnique=${enterpriseAuditExportTaskPersistenceIdempotencyKeyUniqueLabel}。`
          : enterpriseAuditExportTaskPersistenceStatus === 'task_persistence_contract_missing'
            ? `任务持久化契约缺失；requestedByAdminRequired=${enterpriseAuditExportTaskPersistenceRequestedByAdminRequiredLabel}，timeRangeRequired=${enterpriseAuditExportTaskPersistenceTimeRangeRequiredLabel}，filtersSnapshotRequired=${enterpriseAuditExportTaskPersistenceFiltersSnapshotRequiredLabel}。`
            : `任务持久化契约已声明；table=${enterpriseAuditExportTaskPersistenceTableName}，schema=${enterpriseAuditExportTaskPersistenceSchemaVersion}，existingTasks=${enterpriseAuditExportTaskPersistenceExistingTaskCount}，fields=${enterpriseAuditExportTaskPersistenceRequiredFieldCount}，覆盖源 ${enterpriseAuditExportTaskPersistenceCoveredSourceCount}/${enterpriseAuditExportTaskPersistenceRequiredSourceCount}；taskCreation=${enterpriseAuditExportTaskPersistenceTaskCreationEnabledLabel}，persistenceWrite=${enterpriseAuditExportTaskPersistenceWriteEnabledLabel}，auditWrite=${enterpriseAuditExportTaskPersistenceAuditWriteEnabledLabel}，projectWrite=${enterpriseAuditExportTaskPersistenceProjectWriteEnabledLabel}。`,
      recovery: enterpriseAuditExportTaskPersistenceStatus === 'no_audit_logs'
        ? '先形成 admin_audit_log 真源，再评估导出任务持久化；当前不创建任务、不写任务表。'
        : enterpriseAuditExportTaskPersistenceStatus === 'task_create_request_not_ready'
          ? '先补齐导出任务创建请求 readiness；不得绕过请求契约直接开放任务持久化写入。'
          : enterpriseAuditExportTaskPersistenceStatus === 'task_persistence_contract_missing'
            ? '先补齐 enterprise_audit_export_tasks 表、schema version、幂等唯一键、请求人、时间范围、过滤快照和输出校验字段；当前不写 storage、不写 audit。'
            : `已有导出任务持久化只读契约，可继续设计受控 POST 任务创建 API；fileGeneration=${getAdminEnterpriseSnapshotTrueFalseLabel(enterpriseAuditExportTaskPersistenceFileGenerationEnabled)}，storageWrite=${getAdminEnterpriseSnapshotTrueFalseLabel(enterpriseAuditExportTaskPersistenceOutputStorageWriteEnabled)}，当前不创建任务、不写任务表、不写 projects。`,
    },
    {
      area: 'audit_retention',
      status: enterpriseAuditRetentionStatus === 'audit_retention_ready' ? 'ready' : 'warning',
      title: '企业审计保留 readiness',
      fact: enterpriseAuditRetentionStatus === 'no_audit_logs'
        ? `后台审计日志总数 ${enterpriseAuditRetentionAdminAuditLogCount} 条；retentionPolicyConfigured=${enterpriseAuditRetentionPolicyConfiguredLabel}；deletionEnabled=${enterpriseAuditRetentionDeletionEnabledLabel}。`
        : enterpriseAuditRetentionStatus === 'activation_audit_missing'
          ? `后台审计日志总数 ${enterpriseAuditRetentionAdminAuditLogCount} 条，但 activation audit 事件 ${enterpriseAuditRetentionActivationAuditEventCount} 条；retentionDays=${enterpriseAuditRetentionDays}。`
          : enterpriseAuditRetentionStatus === 'retention_policy_missing'
            ? `审计保留策略未配置；retentionDays=${enterpriseAuditRetentionDays}，允许范围 ${enterpriseAuditRetentionMinimumDays}-${enterpriseAuditRetentionMaximumDays}。`
            : enterpriseAuditRetentionStatus === 'retention_policy_invalid'
              ? `审计保留策略配置非法；retentionDays=${enterpriseAuditRetentionDays}，允许范围 ${enterpriseAuditRetentionMinimumDays}-${enterpriseAuditRetentionMaximumDays}。`
              : `审计保留策略已配置 ${enterpriseAuditRetentionDays} 天；覆盖源 ${enterpriseAuditRetentionCoveredSourceCount}/${enterpriseAuditRetentionRequiredSourceCount}；deletionEnabled=${enterpriseAuditRetentionDeletionEnabledLabel}。`,
      recovery: enterpriseAuditRetentionStatus === 'no_audit_logs'
        ? '先形成 admin_audit_log 真源，再核对保留策略配置；不得在 retention readiness 中新增写入口或删除审计数据。'
        : enterpriseAuditRetentionStatus === 'activation_audit_missing'
          ? '继续补齐 activation audit evidence 后再推进审计保留策略；当前 readiness 只读。'
          : enterpriseAuditRetentionStatus === 'retention_policy_missing'
            ? '补齐 enterprise.audit.retention_days 配置后再评估保留策略；不得在 readiness 中自动写入配置。'
            : enterpriseAuditRetentionStatus === 'retention_policy_invalid'
              ? '将 enterprise.audit.retention_days 调整为 30 到 3650 之间的整数；当前 readiness 不修正配置、不删除审计数据。'
              : '已有保留策略只读证据，可继续设计受控归档、过期扫描和删除审批流程；当前不执行删除。',
    },
    {
      area: 'runtime_governance',
      status: runtimeObserved ? 'ready' : 'warning',
      title: 'Runtime / 项目治理观测',
      fact: `当前 Admin 项目 runtime 观测 ${runtimeProjectCount} 个。`,
      recovery: runtimeObserved
        ? '已有项目 runtime 只读观测，可继续扩展组织配额、SLA 和资源治理聚合。'
        : '先确认 Admin Projects 只读列表可返回项目 runtime 快照，再推进企业资源治理。',
    },
    {
      area: 'provider_governance',
      status: hasCount(providerBlockedCount)
        ? 'blocked'
        : providerObserved && hasCount(providerSkippedCount)
          ? 'warning'
          : providerObserved
            ? 'ready'
            : 'warning',
      title: 'Capability / Provider 治理',
      fact: `当前 provider preflight ${providerPreflightItemCount} 项，blocked=${providerBlockedCount}，skipped=${providerSkippedCount}。`,
      recovery: hasCount(providerBlockedCount)
        ? '优先处理 blocked provider preflight 项，再推进企业级能力接入。'
        : providerObserved
          ? '已有 provider preflight 真源，可继续扩展企业 runner 策略和运维面板。'
          : '先确认 super_admin Dashboard 能读取 provider preflight，再推进企业能力接入。',
    },
  ];
}

function resolveAdminEnterpriseSnapshotStatus({
  loading,
  hasError,
  readinessStatuses,
}: {
  loading: boolean;
  hasError: boolean;
  readinessStatuses: AdminEnterpriseReadinessStatusList;
}): AdminEnterpriseGovernancePageSnapshotStatus {
  if (loading) {
    return 'loading';
  }
  if (hasError) {
    return 'load_failed';
  }
  if (readinessStatuses.includes('blocked') || readinessStatuses.includes('not_connected')) {
    return 'blocked';
  }
  if (readinessStatuses.includes('warning')) {
    return 'partial';
  }
  return 'ready';
}

function resolveAdminEnterpriseSnapshotSource(
  status: AdminEnterpriseGovernancePageSnapshotStatus,
  items: AdminEnterpriseGovernanceReadinessItemList,
): AdminEnterpriseGovernancePageSnapshotSource {
  if (status === 'loading' || status === 'load_failed') {
    return 'enterprise_readiness';
  }

  const firstProblem = resolveAdminEnterpriseFirstReadinessProblem(items);
  const hasFirstProblem = hasAdminEnterpriseReadinessProblem(firstProblem);
  if (hasFirstProblem === false) {
    return 'enterprise_readiness';
  }
  if (firstProblem.area === 'enterprise_identity') {
    return 'admin_config_list';
  }
  if (firstProblem.area === 'organization_governance') {
    return 'admin_enterprise_organization_readiness';
  }
  if (firstProblem.area === 'project_ownership') {
    return 'admin_enterprise_project_ownership_readiness';
  }
  if (firstProblem.area === 'project_ownership_preflight') {
    return 'admin_enterprise_project_ownership_preflight';
  }
  if (firstProblem.area === 'project_ownership_mapping') {
    return 'admin_enterprise_project_ownership_mappings';
  }
  if (firstProblem.area === 'project_ownership_owner_guard') {
    return 'admin_enterprise_project_ownership_owner_guard_readiness';
  }
  if (firstProblem.area === 'project_access_guard_switch') {
    return 'admin_enterprise_project_access_guard_switch_readiness';
  }
  if (firstProblem.area === 'project_access_guard_authorization_dry_run') {
    return 'admin_enterprise_project_access_guard_authorization_dry_run';
  }
  if (firstProblem.area === 'project_access_guard_activation') {
    return 'admin_enterprise_project_access_guard_activation_readiness';
  }
  if (firstProblem.area === 'project_access_guard_activation_audit') {
    return 'admin_enterprise_project_access_guard_activation_audit_readiness';
  }
  if (firstProblem.area === 'rbac') {
    return 'admin_role_list';
  }
  if (firstProblem.area === 'audit') {
    return 'admin_enterprise_audit_coverage_readiness';
  }
  if (firstProblem.area === 'audit_export') {
    return 'admin_enterprise_audit_export_readiness';
  }
  if (firstProblem.area === 'audit_export_query') {
    return 'admin_enterprise_audit_export_query_readiness';
  }
  if (firstProblem.area === 'audit_export_task_preflight') {
    return 'admin_enterprise_audit_export_task_preflight_readiness';
  }
  if (firstProblem.area === 'audit_export_file_format') {
    return 'admin_enterprise_audit_export_file_format_readiness';
  }
  if (firstProblem.area === 'audit_export_file_generator') {
    return 'admin_enterprise_audit_export_file_generator_readiness';
  }
  if (firstProblem.area === 'audit_export_task_create_request') {
    return 'admin_enterprise_audit_export_task_create_request_readiness';
  }
  if (firstProblem.area === 'audit_export_task_persistence') {
    return 'admin_enterprise_audit_export_task_persistence_readiness';
  }
  if (firstProblem.area === 'audit_retention') {
    return 'admin_enterprise_audit_retention_readiness';
  }
  if (firstProblem.area === 'runtime_governance') {
    return 'admin_runtime_projects';
  }
  if (firstProblem.area === 'provider_governance') {
    return 'admin_provider_preflight';
  }
  return 'enterprise_readiness';
}

export function buildAdminEnterpriseGovernancePageSnapshot({
  loading,
  error,
  readinessInput,
  readinessItems,
}: {
  loading: boolean;
  error: string;
  readinessInput: AdminEnterpriseGovernanceReadinessInput;
  readinessItems: AdminEnterpriseGovernanceReadinessItemList;
}): AdminEnterpriseGovernancePageSnapshot {
  const hasError = hasAdminEnterpriseGovernanceError(error);
  const readinessStatuses = getAdminEnterpriseReadinessStatusList(readinessItems);
  const status = resolveAdminEnterpriseSnapshotStatus({
    loading,
    hasError,
    readinessStatuses,
  });
  const source = resolveAdminEnterpriseSnapshotSource(status, readinessItems);
  const readyItemCount = countReadinessItems(readinessItems, 'ready');
  const warningItemCount = countReadinessItems(readinessItems, 'warning');
  const blockedItemCount = countReadinessItems(readinessItems, 'blocked');
  const notConnectedItemCount = countReadinessItems(readinessItems, 'not_connected');

  return {
    status,
    source,
    userCount: readinessInput.userCount,
    roleCount: readinessInput.roleCount,
    permissionCount: readinessInput.permissionCount,
    auditLogCount: readinessInput.auditLogCount,
    runtimeProjectCount: readinessInput.runtimeProjectCount,
    providerPreflightItemCount: readinessInput.providerPreflightItemCount,
    ssoConfigCount: readinessInput.ssoConfigCount,
    ssoConfiguredCount: readinessInput.ssoConfiguredCount,
    ssoRequiredConfiguredCount: readinessInput.ssoRequiredConfiguredCount,
    ssoRequiredConfigCount: readinessInput.ssoRequiredConfigCount,
    ssoEnabled: readinessInput.ssoEnabled,
    ssoReadinessStatus: readinessInput.ssoReadinessStatus,
    organizationCount: readinessInput.organizationCount,
    teamCount: readinessInput.teamCount,
    memberCount: readinessInput.memberCount,
    organizationReadinessStatus: readinessInput.organizationReadinessStatus,
    projectOwnershipProjectCount: readinessInput.projectOwnershipProjectCount,
    projectOwnershipLegacyUserOwnedProjectCount: readinessInput.projectOwnershipLegacyUserOwnedProjectCount,
    projectOwnershipOrganizationProjectCount: readinessInput.projectOwnershipOrganizationProjectCount,
    projectOwnershipUnmigratedProjectCount: readinessInput.projectOwnershipUnmigratedProjectCount,
    projectOwnershipReadinessStatus: readinessInput.projectOwnershipReadinessStatus,
    projectOwnershipPreflightCandidateProjectCount: readinessInput.projectOwnershipPreflightCandidateProjectCount,
    projectOwnershipPreflightExistingOwnershipCount: readinessInput.projectOwnershipPreflightExistingOwnershipCount,
    projectOwnershipPreflightStatus: readinessInput.projectOwnershipPreflightStatus,
    projectOwnershipMappingCount: readinessInput.projectOwnershipMappingCount,
    projectOwnershipMissingProjectCount: readinessInput.projectOwnershipMissingProjectCount,
    projectOwnershipMappingStatus: readinessInput.projectOwnershipMappingStatus,
    projectOwnershipOwnerGuardMappedProjectCount: readinessInput.projectOwnershipOwnerGuardMappedProjectCount,
    projectOwnershipOwnerGuardUnmappedProjectCount: readinessInput.projectOwnershipOwnerGuardUnmappedProjectCount,
    projectOwnershipOwnerGuardExtraOwnershipCount: readinessInput.projectOwnershipOwnerGuardExtraOwnershipCount,
    projectOwnershipOwnerGuardStatus: readinessInput.projectOwnershipOwnerGuardStatus,
    projectAccessGuardSwitchMappedProjectCount: readinessInput.projectAccessGuardSwitchMappedProjectCount,
    projectAccessGuardSwitchUnmappedProjectCount: readinessInput.projectAccessGuardSwitchUnmappedProjectCount,
    projectAccessGuardSwitchExtraOwnershipCount: readinessInput.projectAccessGuardSwitchExtraOwnershipCount,
    projectAccessGuardSwitchCanSwitch: readinessInput.projectAccessGuardSwitchCanSwitch,
    projectAccessGuardSwitchAuthorizationActive: readinessInput.projectAccessGuardSwitchAuthorizationActive,
    projectAccessGuardSwitchStatus: readinessInput.projectAccessGuardSwitchStatus,
    projectAccessGuardAuthorizationDryRunComparedProjectCount: readinessInput.projectAccessGuardAuthorizationDryRunComparedProjectCount,
    projectAccessGuardAuthorizationDryRunAlignedProjectCount: readinessInput.projectAccessGuardAuthorizationDryRunAlignedProjectCount,
    projectAccessGuardAuthorizationDryRunEnterpriseUnavailableProjectCount: readinessInput.projectAccessGuardAuthorizationDryRunEnterpriseUnavailableProjectCount,
    projectAccessGuardAuthorizationDryRunLegacyGrantedEnterpriseBlockedCount: readinessInput.projectAccessGuardAuthorizationDryRunLegacyGrantedEnterpriseBlockedCount,
    projectAccessGuardAuthorizationDryRunLegacyBlockedEnterpriseGrantedCount: readinessInput.projectAccessGuardAuthorizationDryRunLegacyBlockedEnterpriseGrantedCount,
    projectAccessGuardAuthorizationDryRunDriftCandidateCount: readinessInput.projectAccessGuardAuthorizationDryRunDriftCandidateCount,
    projectAccessGuardAuthorizationDryRunAuthorizationActive: readinessInput.projectAccessGuardAuthorizationDryRunAuthorizationActive,
    projectAccessGuardAuthorizationDryRunStatus: readinessInput.projectAccessGuardAuthorizationDryRunStatus,
    projectAccessGuardActivationCanActivate: readinessInput.projectAccessGuardActivationCanActivate,
    projectAccessGuardActivationSwitchStatus: readinessInput.projectAccessGuardActivationSwitchStatus,
    projectAccessGuardActivationAuthorizationDryRunStatus: readinessInput.projectAccessGuardActivationAuthorizationDryRunStatus,
    projectAccessGuardActivationMappedProjectCount: readinessInput.projectAccessGuardActivationMappedProjectCount,
    projectAccessGuardActivationUnmappedProjectCount: readinessInput.projectAccessGuardActivationUnmappedProjectCount,
    projectAccessGuardActivationExtraOwnershipCount: readinessInput.projectAccessGuardActivationExtraOwnershipCount,
    projectAccessGuardActivationComparedProjectCount: readinessInput.projectAccessGuardActivationComparedProjectCount,
    projectAccessGuardActivationAlignedProjectCount: readinessInput.projectAccessGuardActivationAlignedProjectCount,
    projectAccessGuardActivationEnterpriseUnavailableCount: readinessInput.projectAccessGuardActivationEnterpriseUnavailableCount,
    projectAccessGuardActivationAuthorizationDriftCount: readinessInput.projectAccessGuardActivationAuthorizationDriftCount,
    projectAccessGuardActivationBlockerCandidateCount: readinessInput.projectAccessGuardActivationBlockerCandidateCount,
    projectAccessGuardActivationReviewItemCount: readinessInput.projectAccessGuardActivationReviewItemCount,
    projectAccessGuardActivationReviewBlockedCount: readinessInput.projectAccessGuardActivationReviewBlockedCount,
    projectAccessGuardActivationReviewManualRequiredCount: readinessInput.projectAccessGuardActivationReviewManualRequiredCount,
    projectAccessGuardActivationAuditPlanItemCount: readinessInput.projectAccessGuardActivationAuditPlanItemCount,
    projectAccessGuardActivationAuditPlanBlockedCount: readinessInput.projectAccessGuardActivationAuditPlanBlockedCount,
    projectAccessGuardActivationAuditPlanManualRequiredCount: readinessInput.projectAccessGuardActivationAuditPlanManualRequiredCount,
    projectAccessGuardActivationAuthorizationActive: readinessInput.projectAccessGuardActivationAuthorizationActive,
    projectAccessGuardActivationStatus: readinessInput.projectAccessGuardActivationStatus,
    projectAccessGuardActivationAuditEventCount: readinessInput.projectAccessGuardActivationAuditEventCount,
    projectAccessGuardActivationAuditRequiredEventTypeCount: readinessInput.projectAccessGuardActivationAuditRequiredEventTypeCount,
    projectAccessGuardActivationAuditMissingRequiredEventTypeCount: readinessInput.projectAccessGuardActivationAuditMissingRequiredEventTypeCount,
    projectAccessGuardActivationAuditRecentEventCount: readinessInput.projectAccessGuardActivationAuditRecentEventCount,
    projectAccessGuardActivationAuditPayloadIntegrityIssueCount: readinessInput.projectAccessGuardActivationAuditPayloadIntegrityIssueCount,
    projectAccessGuardActivationAuditPayloadIntegrityStatus: readinessInput.projectAccessGuardActivationAuditPayloadIntegrityStatus,
    projectAccessGuardActivationAuditMetadataIntegrityIssueCount: readinessInput.projectAccessGuardActivationAuditMetadataIntegrityIssueCount,
    projectAccessGuardActivationAuditMetadataIntegrityStatus: readinessInput.projectAccessGuardActivationAuditMetadataIntegrityStatus,
    projectAccessGuardActivationAuditStatus: readinessInput.projectAccessGuardActivationAuditStatus,
    enterpriseAuditCoverageAdminAuditLogCount: readinessInput.enterpriseAuditCoverageAdminAuditLogCount,
    enterpriseAuditCoverageActivationAuditEventCount: readinessInput.enterpriseAuditCoverageActivationAuditEventCount,
    enterpriseAuditCoverageCoveredSourceCount: readinessInput.enterpriseAuditCoverageCoveredSourceCount,
    enterpriseAuditCoverageRequiredSourceCount: readinessInput.enterpriseAuditCoverageRequiredSourceCount,
    enterpriseAuditCoverageStatus: readinessInput.enterpriseAuditCoverageStatus,
    enterpriseAuditExportAdminAuditLogCount: readinessInput.enterpriseAuditExportAdminAuditLogCount,
    enterpriseAuditExportActivationAuditEventCount: readinessInput.enterpriseAuditExportActivationAuditEventCount,
    enterpriseAuditExportSampleCount: readinessInput.enterpriseAuditExportSampleCount,
    enterpriseAuditExportSampleLimit: readinessInput.enterpriseAuditExportSampleLimit,
    enterpriseAuditExportMaxWindow: readinessInput.enterpriseAuditExportMaxWindow,
    enterpriseAuditExportCoveredSourceCount: readinessInput.enterpriseAuditExportCoveredSourceCount,
    enterpriseAuditExportRequiredSourceCount: readinessInput.enterpriseAuditExportRequiredSourceCount,
    enterpriseAuditExportStatus: readinessInput.enterpriseAuditExportStatus,
    enterpriseAuditExportQuerySampleCount: readinessInput.enterpriseAuditExportQuerySampleCount,
    enterpriseAuditExportQuerySampleLimit: readinessInput.enterpriseAuditExportQuerySampleLimit,
    enterpriseAuditExportQueryMaxWindow: readinessInput.enterpriseAuditExportQueryMaxWindow,
    enterpriseAuditExportQuerySupportedFilterFieldCount: readinessInput.enterpriseAuditExportQuerySupportedFilterFieldCount,
    enterpriseAuditExportQueryRequiredFilterFieldCount: readinessInput.enterpriseAuditExportQueryRequiredFilterFieldCount,
    enterpriseAuditExportQuerySampleActionCount: readinessInput.enterpriseAuditExportQuerySampleActionCount,
    enterpriseAuditExportQuerySampleTargetTypeCount: readinessInput.enterpriseAuditExportQuerySampleTargetTypeCount,
    enterpriseAuditExportQuerySampleActorCount: readinessInput.enterpriseAuditExportQuerySampleActorCount,
    enterpriseAuditExportQueryTaskCreationEnabled: readinessInput.enterpriseAuditExportQueryTaskCreationEnabled,
    enterpriseAuditExportQueryFileGenerationEnabled: readinessInput.enterpriseAuditExportQueryFileGenerationEnabled,
    enterpriseAuditExportQueryCoveredSourceCount: readinessInput.enterpriseAuditExportQueryCoveredSourceCount,
    enterpriseAuditExportQueryRequiredSourceCount: readinessInput.enterpriseAuditExportQueryRequiredSourceCount,
    enterpriseAuditExportQueryStatus: readinessInput.enterpriseAuditExportQueryStatus,
    enterpriseAuditExportTaskPreflightSampleCount: readinessInput.enterpriseAuditExportTaskPreflightSampleCount,
    enterpriseAuditExportTaskPreflightSampleLimit: readinessInput.enterpriseAuditExportTaskPreflightSampleLimit,
    enterpriseAuditExportTaskPreflightSupportedFilterFieldCount: readinessInput.enterpriseAuditExportTaskPreflightSupportedFilterFieldCount,
    enterpriseAuditExportTaskPreflightRequiredFilterFieldCount: readinessInput.enterpriseAuditExportTaskPreflightRequiredFilterFieldCount,
    enterpriseAuditExportTaskPreflightRetentionPolicyConfigured: readinessInput.enterpriseAuditExportTaskPreflightRetentionPolicyConfigured,
    enterpriseAuditExportTaskPreflightRetentionDays: readinessInput.enterpriseAuditExportTaskPreflightRetentionDays,
    enterpriseAuditExportTaskPreflightTaskCreationEnabled: readinessInput.enterpriseAuditExportTaskPreflightTaskCreationEnabled,
    enterpriseAuditExportTaskPreflightFileGenerationEnabled: readinessInput.enterpriseAuditExportTaskPreflightFileGenerationEnabled,
    enterpriseAuditExportTaskPreflightCoveredSourceCount: readinessInput.enterpriseAuditExportTaskPreflightCoveredSourceCount,
    enterpriseAuditExportTaskPreflightRequiredSourceCount: readinessInput.enterpriseAuditExportTaskPreflightRequiredSourceCount,
    enterpriseAuditExportTaskPreflightStatus: readinessInput.enterpriseAuditExportTaskPreflightStatus,
    enterpriseAuditExportFileFormatSupportedFileFormatCount: readinessInput.enterpriseAuditExportFileFormatSupportedFileFormatCount,
    enterpriseAuditExportFileFormatRequiredFileFormatCount: readinessInput.enterpriseAuditExportFileFormatRequiredFileFormatCount,
    enterpriseAuditExportFileFormatRequiredColumnCount: readinessInput.enterpriseAuditExportFileFormatRequiredColumnCount,
    enterpriseAuditExportFileFormatSchemaVersion: readinessInput.enterpriseAuditExportFileFormatSchemaVersion,
    enterpriseAuditExportFileFormatTaskCreationEnabled: readinessInput.enterpriseAuditExportFileFormatTaskCreationEnabled,
    enterpriseAuditExportFileFormatFileGenerationEnabled: readinessInput.enterpriseAuditExportFileFormatFileGenerationEnabled,
    enterpriseAuditExportFileFormatCoveredSourceCount: readinessInput.enterpriseAuditExportFileFormatCoveredSourceCount,
    enterpriseAuditExportFileFormatRequiredSourceCount: readinessInput.enterpriseAuditExportFileFormatRequiredSourceCount,
    enterpriseAuditExportFileFormatStatus: readinessInput.enterpriseAuditExportFileFormatStatus,
    enterpriseAuditExportFileGeneratorOutputPathPrefix: readinessInput.enterpriseAuditExportFileGeneratorOutputPathPrefix,
    enterpriseAuditExportFileGeneratorFileNameTemplate: readinessInput.enterpriseAuditExportFileGeneratorFileNameTemplate,
    enterpriseAuditExportFileGeneratorChecksumAlgorithm: readinessInput.enterpriseAuditExportFileGeneratorChecksumAlgorithm,
    enterpriseAuditExportFileGeneratorMaxRowsPerFile: readinessInput.enterpriseAuditExportFileGeneratorMaxRowsPerFile,
    enterpriseAuditExportFileGeneratorDryRunEnabled: readinessInput.enterpriseAuditExportFileGeneratorDryRunEnabled,
    enterpriseAuditExportFileGeneratorOutputStorageWriteEnabled: readinessInput.enterpriseAuditExportFileGeneratorOutputStorageWriteEnabled,
    enterpriseAuditExportFileGeneratorTaskCreationEnabled: readinessInput.enterpriseAuditExportFileGeneratorTaskCreationEnabled,
    enterpriseAuditExportFileGeneratorFileGenerationEnabled: readinessInput.enterpriseAuditExportFileGeneratorFileGenerationEnabled,
    enterpriseAuditExportFileGeneratorCoveredSourceCount: readinessInput.enterpriseAuditExportFileGeneratorCoveredSourceCount,
    enterpriseAuditExportFileGeneratorRequiredSourceCount: readinessInput.enterpriseAuditExportFileGeneratorRequiredSourceCount,
    enterpriseAuditExportFileGeneratorStatus: readinessInput.enterpriseAuditExportFileGeneratorStatus,
    enterpriseAuditExportTaskCreateRequestSchemaVersion: readinessInput.enterpriseAuditExportTaskCreateRequestSchemaVersion,
    enterpriseAuditExportTaskCreateRequestRequiredFieldCount: readinessInput.enterpriseAuditExportTaskCreateRequestRequiredFieldCount,
    enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired: readinessInput.enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired,
    enterpriseAuditExportTaskCreateRequestConfirmationRequired: readinessInput.enterpriseAuditExportTaskCreateRequestConfirmationRequired,
    enterpriseAuditExportTaskCreateRequestTaskCreationEnabled: readinessInput.enterpriseAuditExportTaskCreateRequestTaskCreationEnabled,
    enterpriseAuditExportTaskCreateRequestFileGenerationEnabled: readinessInput.enterpriseAuditExportTaskCreateRequestFileGenerationEnabled,
    enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled: readinessInput.enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled,
    enterpriseAuditExportTaskCreateRequestAuditWriteEnabled: readinessInput.enterpriseAuditExportTaskCreateRequestAuditWriteEnabled,
    enterpriseAuditExportTaskCreateRequestCoveredSourceCount: readinessInput.enterpriseAuditExportTaskCreateRequestCoveredSourceCount,
    enterpriseAuditExportTaskCreateRequestRequiredSourceCount: readinessInput.enterpriseAuditExportTaskCreateRequestRequiredSourceCount,
    enterpriseAuditExportTaskCreateRequestStatus: readinessInput.enterpriseAuditExportTaskCreateRequestStatus,
    enterpriseAuditExportTaskPersistenceExistingTaskCount: readinessInput.enterpriseAuditExportTaskPersistenceExistingTaskCount,
    enterpriseAuditExportTaskPersistenceTableName: readinessInput.enterpriseAuditExportTaskPersistenceTableName,
    enterpriseAuditExportTaskPersistenceSchemaVersion: readinessInput.enterpriseAuditExportTaskPersistenceSchemaVersion,
    enterpriseAuditExportTaskPersistenceRequiredFieldCount: readinessInput.enterpriseAuditExportTaskPersistenceRequiredFieldCount,
    enterpriseAuditExportTaskPersistenceIdempotencyKeyUnique: readinessInput.enterpriseAuditExportTaskPersistenceIdempotencyKeyUnique,
    enterpriseAuditExportTaskPersistenceRequestedByAdminRequired: readinessInput.enterpriseAuditExportTaskPersistenceRequestedByAdminRequired,
    enterpriseAuditExportTaskPersistenceTimeRangeRequired: readinessInput.enterpriseAuditExportTaskPersistenceTimeRangeRequired,
    enterpriseAuditExportTaskPersistenceFiltersSnapshotRequired: readinessInput.enterpriseAuditExportTaskPersistenceFiltersSnapshotRequired,
    enterpriseAuditExportTaskPersistenceTaskCreationEnabled: readinessInput.enterpriseAuditExportTaskPersistenceTaskCreationEnabled,
    enterpriseAuditExportTaskPersistenceWriteEnabled: readinessInput.enterpriseAuditExportTaskPersistenceWriteEnabled,
    enterpriseAuditExportTaskPersistenceFileGenerationEnabled: readinessInput.enterpriseAuditExportTaskPersistenceFileGenerationEnabled,
    enterpriseAuditExportTaskPersistenceOutputStorageWriteEnabled: readinessInput.enterpriseAuditExportTaskPersistenceOutputStorageWriteEnabled,
    enterpriseAuditExportTaskPersistenceAuditWriteEnabled: readinessInput.enterpriseAuditExportTaskPersistenceAuditWriteEnabled,
    enterpriseAuditExportTaskPersistenceProjectWriteEnabled: readinessInput.enterpriseAuditExportTaskPersistenceProjectWriteEnabled,
    enterpriseAuditExportTaskPersistenceCoveredSourceCount: readinessInput.enterpriseAuditExportTaskPersistenceCoveredSourceCount,
    enterpriseAuditExportTaskPersistenceRequiredSourceCount: readinessInput.enterpriseAuditExportTaskPersistenceRequiredSourceCount,
    enterpriseAuditExportTaskPersistenceStatus: readinessInput.enterpriseAuditExportTaskPersistenceStatus,
    enterpriseAuditRetentionAdminAuditLogCount: readinessInput.enterpriseAuditRetentionAdminAuditLogCount,
    enterpriseAuditRetentionActivationAuditEventCount: readinessInput.enterpriseAuditRetentionActivationAuditEventCount,
    enterpriseAuditRetentionPolicyConfigured: readinessInput.enterpriseAuditRetentionPolicyConfigured,
    enterpriseAuditRetentionDays: readinessInput.enterpriseAuditRetentionDays,
    enterpriseAuditRetentionMinimumDays: readinessInput.enterpriseAuditRetentionMinimumDays,
    enterpriseAuditRetentionMaximumDays: readinessInput.enterpriseAuditRetentionMaximumDays,
    enterpriseAuditRetentionDeletionEnabled: readinessInput.enterpriseAuditRetentionDeletionEnabled,
    enterpriseAuditRetentionCoveredSourceCount: readinessInput.enterpriseAuditRetentionCoveredSourceCount,
    enterpriseAuditRetentionRequiredSourceCount: readinessInput.enterpriseAuditRetentionRequiredSourceCount,
    enterpriseAuditRetentionStatus: readinessInput.enterpriseAuditRetentionStatus,
    readyItemCount,
    warningItemCount,
    blockedItemCount,
    notConnectedItemCount,
    isLoading: loading,
    hasError,
    canReload: loading === false,
    message: status === 'loading'
      ? 'Admin Enterprise Governance 正在读取企业治理 readiness 真源。'
      : status === 'load_failed'
        ? 'Admin Enterprise Governance readiness 加载失败。'
        : status === 'blocked'
          ? 'Admin Enterprise Governance 已就绪，但存在必须先接线或设计的企业能力阻断项。'
          : status === 'partial'
            ? 'Admin Enterprise Governance 已读取现有真源，但仍有 warning 项需要补强。'
            : 'Admin Enterprise Governance readiness 全部通过。',
    recovery: status === 'loading'
      ? '等待用户、角色、权限、审计、项目 runtime 和 provider preflight 请求返回。'
      : status === 'load_failed'
        ? '刷新企业治理页；如果持续失败，先检查 Admin API 权限与 super_admin 登录状态。'
        : status === 'blocked'
          ? '按 blocked/not_connected 项逐一推进 SSO、组织模型或 provider 阻断恢复，不要把未接线能力标记为 ready。'
          : status === 'partial'
            ? '优先处理 warning 项，让企业治理从可观测进入可执行治理。'
            : '可以继续推进组织级治理、SSO 接线和企业审计增强。',
    updatedAt: 'derived',
  };
}

function getReadinessItemClassName(item: AdminEnterpriseGovernanceReadinessItem) {
  if (item.status === 'blocked' || item.status === 'not_connected') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (item.status === 'warning') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminEnterpriseSnapshotClassName(snapshot: AdminEnterpriseGovernancePageSnapshot) {
  if (snapshot.status === 'load_failed' || snapshot.status === 'blocked') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'loading') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.status === 'partial') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminEnterpriseMutationConfirmationClassName(snapshot: AdminEnterpriseMutationConfirmationSnapshot) {
  if (snapshot.status === 'mutation_failed') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (snapshot.riskLevel === 'high') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
}

function getAdminEnterpriseSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = value !== null && value !== undefined && value.length > 0;

  return hasValue === true ? value : fallback;
}

function getAdminEnterpriseSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminEnterpriseGovernancePageSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminEnterpriseGovernancePageSnapshot;
}) {
  const ssoEnabledLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.ssoEnabled);
  const projectAccessGuardSwitchCanSwitchLabel = getAdminEnterpriseSnapshotBooleanLabel(
    snapshot.projectAccessGuardSwitchCanSwitch,
  );
  const projectAccessGuardSwitchAuthorizationActiveLabel = getAdminEnterpriseSnapshotBooleanLabel(
    snapshot.projectAccessGuardSwitchAuthorizationActive,
  );
  const projectAccessGuardDryRunAuthorizationActiveLabel = getAdminEnterpriseSnapshotBooleanLabel(
    snapshot.projectAccessGuardAuthorizationDryRunAuthorizationActive,
  );
  const projectAccessGuardActivationCanActivateLabel = getAdminEnterpriseSnapshotBooleanLabel(
    snapshot.projectAccessGuardActivationCanActivate,
  );
  const projectAccessGuardActivationAuthorizationActiveLabel = getAdminEnterpriseSnapshotBooleanLabel(
    snapshot.projectAccessGuardActivationAuthorizationActive,
  );
  const isLoadingLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.isLoading);
  const hasErrorLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.hasError);
  const canReloadLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.canReload);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-enterprise-governance-page-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminEnterpriseSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Enterprise Governance 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Users: {snapshot.userCount}</span>
        <span>Roles: {snapshot.roleCount}</span>
        <span>Permissions: {snapshot.permissionCount}</span>
        <span>AuditLogs: {snapshot.auditLogCount}</span>
        <span>RuntimeProjects: {snapshot.runtimeProjectCount}</span>
        <span>ProviderPreflight: {snapshot.providerPreflightItemCount}</span>
        <span>SsoConfigs: {snapshot.ssoConfigCount}</span>
        <span>SsoConfigured: {snapshot.ssoConfiguredCount}</span>
        <span>SsoRequired: {snapshot.ssoRequiredConfiguredCount}/{snapshot.ssoRequiredConfigCount}</span>
        <span>SsoEnabled: {ssoEnabledLabel}</span>
        <span>SsoReadiness: {snapshot.ssoReadinessStatus}</span>
        <span>Organizations: {snapshot.organizationCount}</span>
        <span>Teams: {snapshot.teamCount}</span>
        <span>Members: {snapshot.memberCount}</span>
        <span>OrgReadiness: {snapshot.organizationReadinessStatus}</span>
        <span>ProjectOwnershipProjects: {snapshot.projectOwnershipProjectCount}</span>
        <span>LegacyUserOwnedProjects: {snapshot.projectOwnershipLegacyUserOwnedProjectCount}</span>
        <span>OrganizationProjects: {snapshot.projectOwnershipOrganizationProjectCount}</span>
        <span>UnmigratedProjects: {snapshot.projectOwnershipUnmigratedProjectCount}</span>
        <span>ProjectOwnershipReadiness: {snapshot.projectOwnershipReadinessStatus}</span>
        <span>ProjectOwnershipPreflightCandidates: {snapshot.projectOwnershipPreflightCandidateProjectCount}</span>
        <span>ProjectOwnershipExistingOwnerships: {snapshot.projectOwnershipPreflightExistingOwnershipCount}</span>
        <span>ProjectOwnershipPreflight: {snapshot.projectOwnershipPreflightStatus}</span>
        <span>ProjectOwnershipMappings: {snapshot.projectOwnershipMappingCount}</span>
        <span>ProjectOwnershipMissingProjects: {snapshot.projectOwnershipMissingProjectCount}</span>
        <span>ProjectOwnershipMappingStatus: {snapshot.projectOwnershipMappingStatus}</span>
        <span>ProjectOwnershipOwnerGuardMapped: {snapshot.projectOwnershipOwnerGuardMappedProjectCount}</span>
        <span>ProjectOwnershipOwnerGuardUnmapped: {snapshot.projectOwnershipOwnerGuardUnmappedProjectCount}</span>
        <span>ProjectOwnershipOwnerGuardExtra: {snapshot.projectOwnershipOwnerGuardExtraOwnershipCount}</span>
        <span>ProjectOwnershipOwnerGuardStatus: {snapshot.projectOwnershipOwnerGuardStatus}</span>
        <span>ProjectAccessGuardSwitchMapped: {snapshot.projectAccessGuardSwitchMappedProjectCount}</span>
        <span>ProjectAccessGuardSwitchUnmapped: {snapshot.projectAccessGuardSwitchUnmappedProjectCount}</span>
        <span>ProjectAccessGuardSwitchExtra: {snapshot.projectAccessGuardSwitchExtraOwnershipCount}</span>
        <span>ProjectAccessGuardSwitchCanSwitch: {projectAccessGuardSwitchCanSwitchLabel}</span>
        <span>ProjectAccessGuardSwitchAuthorizationActive: {projectAccessGuardSwitchAuthorizationActiveLabel}</span>
        <span>ProjectAccessGuardSwitchStatus: {snapshot.projectAccessGuardSwitchStatus}</span>
        <span>ProjectAccessGuardDryRunCompared: {snapshot.projectAccessGuardAuthorizationDryRunComparedProjectCount}</span>
        <span>ProjectAccessGuardDryRunAligned: {snapshot.projectAccessGuardAuthorizationDryRunAlignedProjectCount}</span>
        <span>ProjectAccessGuardDryRunUnavailable: {snapshot.projectAccessGuardAuthorizationDryRunEnterpriseUnavailableProjectCount}</span>
        <span>ProjectAccessGuardDryRunLegacyGrantedEnterpriseBlocked: {snapshot.projectAccessGuardAuthorizationDryRunLegacyGrantedEnterpriseBlockedCount}</span>
        <span>ProjectAccessGuardDryRunLegacyBlockedEnterpriseGranted: {snapshot.projectAccessGuardAuthorizationDryRunLegacyBlockedEnterpriseGrantedCount}</span>
        <span>ProjectAccessGuardDryRunDriftCandidates: {snapshot.projectAccessGuardAuthorizationDryRunDriftCandidateCount}</span>
        <span>ProjectAccessGuardDryRunAuthorizationActive: {projectAccessGuardDryRunAuthorizationActiveLabel}</span>
        <span>ProjectAccessGuardDryRunStatus: {snapshot.projectAccessGuardAuthorizationDryRunStatus}</span>
        <span>ProjectAccessGuardActivationCanActivate: {projectAccessGuardActivationCanActivateLabel}</span>
        <span>ProjectAccessGuardActivationSwitchStatus: {snapshot.projectAccessGuardActivationSwitchStatus}</span>
        <span>ProjectAccessGuardActivationDryRunStatus: {snapshot.projectAccessGuardActivationAuthorizationDryRunStatus}</span>
        <span>ProjectAccessGuardActivationMapped: {snapshot.projectAccessGuardActivationMappedProjectCount}</span>
        <span>ProjectAccessGuardActivationUnmapped: {snapshot.projectAccessGuardActivationUnmappedProjectCount}</span>
        <span>ProjectAccessGuardActivationExtra: {snapshot.projectAccessGuardActivationExtraOwnershipCount}</span>
        <span>ProjectAccessGuardActivationCompared: {snapshot.projectAccessGuardActivationComparedProjectCount}</span>
        <span>ProjectAccessGuardActivationAligned: {snapshot.projectAccessGuardActivationAlignedProjectCount}</span>
        <span>ProjectAccessGuardActivationUnavailable: {snapshot.projectAccessGuardActivationEnterpriseUnavailableCount}</span>
        <span>ProjectAccessGuardActivationDrift: {snapshot.projectAccessGuardActivationAuthorizationDriftCount}</span>
        <span>ProjectAccessGuardActivationBlockers: {snapshot.projectAccessGuardActivationBlockerCandidateCount}</span>
        <span>ProjectAccessGuardActivationReviewItems: {snapshot.projectAccessGuardActivationReviewItemCount}</span>
        <span>ProjectAccessGuardActivationReviewBlocked: {snapshot.projectAccessGuardActivationReviewBlockedCount}</span>
        <span>ProjectAccessGuardActivationReviewManualRequired: {snapshot.projectAccessGuardActivationReviewManualRequiredCount}</span>
        <span>ProjectAccessGuardActivationAuditPlanItems: {snapshot.projectAccessGuardActivationAuditPlanItemCount}</span>
        <span>ProjectAccessGuardActivationAuditPlanBlocked: {snapshot.projectAccessGuardActivationAuditPlanBlockedCount}</span>
        <span>ProjectAccessGuardActivationAuditPlanManualRequired: {snapshot.projectAccessGuardActivationAuditPlanManualRequiredCount}</span>
        <span>ProjectAccessGuardActivationAuthorizationActive: {projectAccessGuardActivationAuthorizationActiveLabel}</span>
        <span>ProjectAccessGuardActivationStatus: {snapshot.projectAccessGuardActivationStatus}</span>
        <span>ProjectAccessGuardActivationAuditEvents: {snapshot.projectAccessGuardActivationAuditEventCount}</span>
        <span>ProjectAccessGuardActivationAuditRequiredEventTypes: {snapshot.projectAccessGuardActivationAuditRequiredEventTypeCount}</span>
        <span>ProjectAccessGuardActivationAuditMissingRequiredEventTypes: {snapshot.projectAccessGuardActivationAuditMissingRequiredEventTypeCount}</span>
        <span>ProjectAccessGuardActivationAuditRecentEvents: {snapshot.projectAccessGuardActivationAuditRecentEventCount}</span>
        <span>ProjectAccessGuardActivationAuditPayloadIntegrityIssues: {snapshot.projectAccessGuardActivationAuditPayloadIntegrityIssueCount}</span>
        <span>ProjectAccessGuardActivationAuditPayloadIntegrityStatus: {snapshot.projectAccessGuardActivationAuditPayloadIntegrityStatus}</span>
        <span>ProjectAccessGuardActivationAuditMetadataIntegrityIssues: {snapshot.projectAccessGuardActivationAuditMetadataIntegrityIssueCount}</span>
        <span>ProjectAccessGuardActivationAuditMetadataIntegrityStatus: {snapshot.projectAccessGuardActivationAuditMetadataIntegrityStatus}</span>
        <span>ProjectAccessGuardActivationAuditStatus: {snapshot.projectAccessGuardActivationAuditStatus}</span>
        <span>EnterpriseAuditCoverageAdminAuditLogs: {snapshot.enterpriseAuditCoverageAdminAuditLogCount}</span>
        <span>EnterpriseAuditCoverageActivationAuditEvents: {snapshot.enterpriseAuditCoverageActivationAuditEventCount}</span>
        <span>EnterpriseAuditCoverageSources: {snapshot.enterpriseAuditCoverageCoveredSourceCount}/{snapshot.enterpriseAuditCoverageRequiredSourceCount}</span>
        <span>EnterpriseAuditCoverageStatus: {snapshot.enterpriseAuditCoverageStatus}</span>
        <span>EnterpriseAuditExportAdminAuditLogs: {snapshot.enterpriseAuditExportAdminAuditLogCount}</span>
        <span>EnterpriseAuditExportActivationAuditEvents: {snapshot.enterpriseAuditExportActivationAuditEventCount}</span>
        <span>EnterpriseAuditExportSamples: {snapshot.enterpriseAuditExportSampleCount}/{snapshot.enterpriseAuditExportSampleLimit}</span>
        <span>EnterpriseAuditExportMaxWindow: {snapshot.enterpriseAuditExportMaxWindow}</span>
        <span>EnterpriseAuditExportSources: {snapshot.enterpriseAuditExportCoveredSourceCount}/{snapshot.enterpriseAuditExportRequiredSourceCount}</span>
        <span>EnterpriseAuditExportStatus: {snapshot.enterpriseAuditExportStatus}</span>
        <span>EnterpriseAuditExportQuerySamples: {snapshot.enterpriseAuditExportQuerySampleCount}/{snapshot.enterpriseAuditExportQuerySampleLimit}</span>
        <span>EnterpriseAuditExportQueryMaxWindow: {snapshot.enterpriseAuditExportQueryMaxWindow}</span>
        <span>EnterpriseAuditExportQueryFilterFields: {snapshot.enterpriseAuditExportQuerySupportedFilterFieldCount}/{snapshot.enterpriseAuditExportQueryRequiredFilterFieldCount}</span>
        <span>EnterpriseAuditExportQuerySampleActions: {snapshot.enterpriseAuditExportQuerySampleActionCount}</span>
        <span>EnterpriseAuditExportQuerySampleTargetTypes: {snapshot.enterpriseAuditExportQuerySampleTargetTypeCount}</span>
        <span>EnterpriseAuditExportQuerySampleActors: {snapshot.enterpriseAuditExportQuerySampleActorCount}</span>
        <span>EnterpriseAuditExportQueryTaskCreationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportQueryTaskCreationEnabled)}</span>
        <span>EnterpriseAuditExportQueryFileGenerationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportQueryFileGenerationEnabled)}</span>
        <span>EnterpriseAuditExportQuerySources: {snapshot.enterpriseAuditExportQueryCoveredSourceCount}/{snapshot.enterpriseAuditExportQueryRequiredSourceCount}</span>
        <span>EnterpriseAuditExportQueryStatus: {snapshot.enterpriseAuditExportQueryStatus}</span>
        <span>EnterpriseAuditExportTaskPreflightSamples: {snapshot.enterpriseAuditExportTaskPreflightSampleCount}/{snapshot.enterpriseAuditExportTaskPreflightSampleLimit}</span>
        <span>EnterpriseAuditExportTaskPreflightFilterFields: {snapshot.enterpriseAuditExportTaskPreflightSupportedFilterFieldCount}/{snapshot.enterpriseAuditExportTaskPreflightRequiredFilterFieldCount}</span>
        <span>EnterpriseAuditExportTaskPreflightRetentionConfigured: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPreflightRetentionPolicyConfigured)}</span>
        <span>EnterpriseAuditExportTaskPreflightRetentionDays: {snapshot.enterpriseAuditExportTaskPreflightRetentionDays}</span>
        <span>EnterpriseAuditExportTaskPreflightTaskCreationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPreflightTaskCreationEnabled)}</span>
        <span>EnterpriseAuditExportTaskPreflightFileGenerationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPreflightFileGenerationEnabled)}</span>
        <span>EnterpriseAuditExportTaskPreflightSources: {snapshot.enterpriseAuditExportTaskPreflightCoveredSourceCount}/{snapshot.enterpriseAuditExportTaskPreflightRequiredSourceCount}</span>
        <span>EnterpriseAuditExportTaskPreflightStatus: {snapshot.enterpriseAuditExportTaskPreflightStatus}</span>
        <span>EnterpriseAuditExportFileFormatFormats: {snapshot.enterpriseAuditExportFileFormatSupportedFileFormatCount}/{snapshot.enterpriseAuditExportFileFormatRequiredFileFormatCount}</span>
        <span>EnterpriseAuditExportFileFormatColumns: {snapshot.enterpriseAuditExportFileFormatRequiredColumnCount}</span>
        <span>EnterpriseAuditExportFileFormatSchemaVersion: {snapshot.enterpriseAuditExportFileFormatSchemaVersion}</span>
        <span>EnterpriseAuditExportFileFormatTaskCreationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportFileFormatTaskCreationEnabled)}</span>
        <span>EnterpriseAuditExportFileFormatFileGenerationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportFileFormatFileGenerationEnabled)}</span>
        <span>EnterpriseAuditExportFileFormatSources: {snapshot.enterpriseAuditExportFileFormatCoveredSourceCount}/{snapshot.enterpriseAuditExportFileFormatRequiredSourceCount}</span>
        <span>EnterpriseAuditExportFileFormatStatus: {snapshot.enterpriseAuditExportFileFormatStatus}</span>
        <span>EnterpriseAuditExportFileGeneratorOutputPathPrefix: {snapshot.enterpriseAuditExportFileGeneratorOutputPathPrefix}</span>
        <span>EnterpriseAuditExportFileGeneratorFileNameTemplate: {snapshot.enterpriseAuditExportFileGeneratorFileNameTemplate}</span>
        <span>EnterpriseAuditExportFileGeneratorChecksumAlgorithm: {snapshot.enterpriseAuditExportFileGeneratorChecksumAlgorithm}</span>
        <span>EnterpriseAuditExportFileGeneratorMaxRowsPerFile: {snapshot.enterpriseAuditExportFileGeneratorMaxRowsPerFile}</span>
        <span>EnterpriseAuditExportFileGeneratorDryRunEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportFileGeneratorDryRunEnabled)}</span>
        <span>EnterpriseAuditExportFileGeneratorOutputStorageWriteEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportFileGeneratorOutputStorageWriteEnabled)}</span>
        <span>EnterpriseAuditExportFileGeneratorFileGenerationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportFileGeneratorFileGenerationEnabled)}</span>
        <span>EnterpriseAuditExportFileGeneratorSources: {snapshot.enterpriseAuditExportFileGeneratorCoveredSourceCount}/{snapshot.enterpriseAuditExportFileGeneratorRequiredSourceCount}</span>
        <span>EnterpriseAuditExportFileGeneratorStatus: {snapshot.enterpriseAuditExportFileGeneratorStatus}</span>
        <span>EnterpriseAuditExportTaskCreateRequestSchemaVersion: {snapshot.enterpriseAuditExportTaskCreateRequestSchemaVersion}</span>
        <span>EnterpriseAuditExportTaskCreateRequestRequiredFields: {snapshot.enterpriseAuditExportTaskCreateRequestRequiredFieldCount}</span>
        <span>EnterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskCreateRequestIdempotencyKeyRequired)}</span>
        <span>EnterpriseAuditExportTaskCreateRequestConfirmationRequired: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskCreateRequestConfirmationRequired)}</span>
        <span>EnterpriseAuditExportTaskCreateRequestTaskCreationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskCreateRequestTaskCreationEnabled)}</span>
        <span>EnterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskCreateRequestOutputStorageWriteEnabled)}</span>
        <span>EnterpriseAuditExportTaskCreateRequestAuditWriteEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskCreateRequestAuditWriteEnabled)}</span>
        <span>EnterpriseAuditExportTaskCreateRequestSources: {snapshot.enterpriseAuditExportTaskCreateRequestCoveredSourceCount}/{snapshot.enterpriseAuditExportTaskCreateRequestRequiredSourceCount}</span>
        <span>EnterpriseAuditExportTaskCreateRequestStatus: {snapshot.enterpriseAuditExportTaskCreateRequestStatus}</span>
        <span>EnterpriseAuditExportTaskPersistenceExistingTasks: {snapshot.enterpriseAuditExportTaskPersistenceExistingTaskCount}</span>
        <span>EnterpriseAuditExportTaskPersistenceTable: {snapshot.enterpriseAuditExportTaskPersistenceTableName}</span>
        <span>EnterpriseAuditExportTaskPersistenceSchemaVersion: {snapshot.enterpriseAuditExportTaskPersistenceSchemaVersion}</span>
        <span>EnterpriseAuditExportTaskPersistenceRequiredFields: {snapshot.enterpriseAuditExportTaskPersistenceRequiredFieldCount}</span>
        <span>EnterpriseAuditExportTaskPersistenceIdempotencyKeyUnique: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPersistenceIdempotencyKeyUnique)}</span>
        <span>EnterpriseAuditExportTaskPersistenceRequestedByAdminRequired: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPersistenceRequestedByAdminRequired)}</span>
        <span>EnterpriseAuditExportTaskPersistenceTaskCreationEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPersistenceTaskCreationEnabled)}</span>
        <span>EnterpriseAuditExportTaskPersistenceWriteEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPersistenceWriteEnabled)}</span>
        <span>EnterpriseAuditExportTaskPersistenceAuditWriteEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPersistenceAuditWriteEnabled)}</span>
        <span>EnterpriseAuditExportTaskPersistenceProjectWriteEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditExportTaskPersistenceProjectWriteEnabled)}</span>
        <span>EnterpriseAuditExportTaskPersistenceSources: {snapshot.enterpriseAuditExportTaskPersistenceCoveredSourceCount}/{snapshot.enterpriseAuditExportTaskPersistenceRequiredSourceCount}</span>
        <span>EnterpriseAuditExportTaskPersistenceStatus: {snapshot.enterpriseAuditExportTaskPersistenceStatus}</span>
        <span>EnterpriseAuditRetentionAdminAuditLogs: {snapshot.enterpriseAuditRetentionAdminAuditLogCount}</span>
        <span>EnterpriseAuditRetentionActivationAuditEvents: {snapshot.enterpriseAuditRetentionActivationAuditEventCount}</span>
        <span>EnterpriseAuditRetentionPolicyConfigured: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditRetentionPolicyConfigured)}</span>
        <span>EnterpriseAuditRetentionDays: {snapshot.enterpriseAuditRetentionDays}</span>
        <span>EnterpriseAuditRetentionRange: {snapshot.enterpriseAuditRetentionMinimumDays}-{snapshot.enterpriseAuditRetentionMaximumDays}</span>
        <span>EnterpriseAuditRetentionDeletionEnabled: {getAdminEnterpriseSnapshotTrueFalseLabel(snapshot.enterpriseAuditRetentionDeletionEnabled)}</span>
        <span>EnterpriseAuditRetentionSources: {snapshot.enterpriseAuditRetentionCoveredSourceCount}/{snapshot.enterpriseAuditRetentionRequiredSourceCount}</span>
        <span>EnterpriseAuditRetentionStatus: {snapshot.enterpriseAuditRetentionStatus}</span>
        <span>Ready: {snapshot.readyItemCount}</span>
        <span>Warnings: {snapshot.warningItemCount}</span>
        <span>Blocked: {snapshot.blockedItemCount}</span>
        <span>NotConnected: {snapshot.notConnectedItemCount}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Reload: {canReloadLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function AdminEnterpriseMutationConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminEnterpriseMutationConfirmationSnapshot;
}) {
  const actionLabel = getAdminEnterpriseSnapshotLabel(snapshot.action, 'none');
  const userIdLabel = getAdminEnterpriseSnapshotLabel(snapshot.userId, 'none');
  const projectRecordIdLabel = getAdminEnterpriseSnapshotLabel(snapshot.projectRecordId, 'none');
  const isSubmittingLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.isSubmitting);
  const hasErrorLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getAdminEnterpriseSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-enterprise-mutation-confirmation-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminEnterpriseMutationConfirmationClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Enterprise Mutation 确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Action: {actionLabel}</span>
        <span>Organization: {snapshot.organizationName}</span>
        <span>Team: {snapshot.teamName}</span>
        <span>User: {userIdLabel}</span>
        <span>Project: {snapshot.projectName}</span>
        <span>ProjectRecord: {projectRecordIdLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
        <span>Submitting: {isSubmittingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.summary}</p>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

function materializeAdminEnterpriseGovernanceReadinessItemNodes(
  items: AdminEnterpriseGovernanceReadinessItemList,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    nodes.push(
      <article
        key={item.area}
        data-testid={`admin-enterprise-readiness-${item.area}`}
        className={`rounded-lg border p-4 ${getReadinessItemClassName(item)}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{item.title}</h2>
          <span className="rounded-full border px-2 py-0.5 text-xs uppercase">{item.status}</span>
        </div>
        <p className="mt-2 text-sm">{item.fact}</p>
        <p className="mt-2 text-xs opacity-80">恢复建议：{item.recovery}</p>
      </article>,
    );
  }

  return nodes;
}

export function AdminEnterpriseGovernanceReadinessList({
  items,
}: {
  items: AdminEnterpriseGovernanceReadinessItemList;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {materializeAdminEnterpriseGovernanceReadinessItemNodes(items)}
    </div>
  );
}
