// 管理后台 API 客户端，所有请求都通过 Next.js 代理路由转发
import {
  buildAdminAuthStorageFailure,
  formatAdminAuthStorageFailure,
  type AdminAuthStorageDetails,
  type AdminAuthStorageRedirectStatus,
  type AdminAuthStorageResult,
  type AdminAuthStorageSource,
  type AdminAuthStorageStatus,
} from '@/lib/admin/admin-auth-storage-local-errors';
import type {
  AIModelName,
  AIModelProviderBaseUrl,
  AIModelProviderConnectionTestMessage,
  AIModelProviderConnectionTestStatus,
  AIModelProviderExtraConfig,
  AIModelProviderReloadMessage,
  AIModelProvider,
  AIModelProviderType,
  ProjectContainerStatusPersistenceStatus,
  ProjectRuntimeContainerStatus,
  ProjectRuntimeError,
  ProjectRuntimeLifecycleStatus,
  ProjectRuntimeMessage,
  ProjectRuntimePhase,
  ProjectRuntimeSpecHash,
  ProjectRuntimeStatusPersistenceStatus,
} from '@/lib/types';

export { formatAdminAuthStorageFailure };
export type {
  AdminAuthStorageRedirectStatus,
  AdminAuthStorageDetails,
  AdminAuthStorageResult,
  AdminAuthStorageSource,
  AdminAuthStorageStatus,
};

const API_BASE = '/api/admin';

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminPasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export type AdminSessionRole = 'admin' | 'super_admin' | 'unknown';
export type AdminPermissionCode = string;
export type AdminPermissionCodeList = AdminPermissionCode[];
export type AdminPermissionId = string;
export type AdminPermissionIdList = AdminPermissionId[];
export type AdminRoleId = string;
export type AdminRoleIdList = AdminRoleId[];
export type AdminManagerId = string;
export type AdminAuditLogId = number;
export type AdminAuditActorAdminId = string;
export type AdminAuditTargetId = string;
export type AdminProjectRecordId = string;
export type AdminProjectId = string;
export type AdminProjectOwnerUserId = string;
export type AdminSystemConfigId = number;
export type AdminSystemConfigKey = string;
export type AdminSystemConfigValueType = 'string' | 'number' | 'boolean' | 'json';
export type AdminSystemConfigPublicFlag = boolean;
export type AdminSystemConfigDescription = string;
export type AdminPromptConfigKey = AdminSystemConfigKey;
export type AdminTemplateConfigKey = AdminSystemConfigKey;
export type AdminEnterpriseSsoConfigKey = AdminSystemConfigKey;
export type AdminEnterpriseSsoConfigKeyList = readonly AdminEnterpriseSsoConfigKey[];
export type AdminEnterpriseSsoDiscoveryReadinessStatus =
  | 'disabled'
  | 'missing_config'
  | 'discovery_failed'
  | 'discovery_ready';
export type AdminEnterpriseOrganizationId = string;
export type AdminEnterpriseOrganizationSlug = string;
export type AdminEnterpriseOrganizationDisplayName = string;
export type AdminEnterpriseOrganizationStatus = 'active' | 'disabled';
export type AdminEnterpriseTeamId = string;
export type AdminEnterpriseTeamSlug = string;
export type AdminEnterpriseTeamDisplayName = string;
export type AdminEnterpriseTeamStatus = 'active' | 'disabled';
export type AdminEnterpriseMemberId = number;
export type AdminEnterpriseMemberRole = 'member';
export type AdminEnterpriseMemberStatus = 'active' | 'disabled';
export type AdminEnterpriseOrganizationReadinessStatus =
  | 'schema_ready_no_data'
  | 'team_ready_no_members'
  | 'member_ready';
export type AdminEnterpriseProjectOwnershipReadinessStatus =
  | 'no_projects'
  | 'organization_model_not_ready'
  | 'legacy_user_owned'
  | 'ownership_schema_ready';
export type AdminEnterpriseProjectOwnershipPreflightStatus =
  | 'no_projects'
  | 'organization_model_not_ready'
  | 'no_candidates'
  | 'candidate_ready';
export type AdminEnterpriseProjectOwnershipMappingStatus =
  | 'no_mappings'
  | 'mapping_ready';
export type AdminEnterpriseProjectOwnershipOwnerGuardReadinessStatus =
  | 'no_projects'
  | 'no_mappings'
  | 'unmapped_projects'
  | 'mapping_evidence_drift'
  | 'owner_guard_ready';
export type AdminEnterpriseProjectAccessGuardSwitchReadinessStatus =
  | 'ownership_repo_unavailable'
  | 'no_projects'
  | 'no_mappings'
  | 'unmapped_projects'
  | 'mapping_evidence_drift'
  | 'enterprise_switch_ready';
export type AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceStatus =
  | 'ownership_repo_unavailable'
  | 'no_projects'
  | 'enterprise_unavailable'
  | 'drift_detected'
  | 'dry_run_aligned';
export type AdminEnterpriseProjectAccessGuardActivationReadinessStatus =
  | 'ownership_repo_unavailable'
  | 'no_projects'
  | 'switch_not_ready'
  | 'dry_run_unavailable'
  | 'drift_detected'
  | 'already_active'
  | 'ready_to_activate';
export type AdminEnterpriseProjectAccessGuardActivationAuditReadinessStatus =
  | 'schema_ready_no_events'
  | 'partial_events_recorded'
  | 'audit_events_recorded';
export type AdminEnterpriseProjectAccessGuardActivationAuditEventType =
  | 'readiness_snapshot'
  | 'blocker_snapshot'
  | 'manual_approval'
  | 'activation_execution'
  | 'post_activation_access_validation'
  | 'rollback_evidence';
export type AdminEnterpriseProjectAccessGuardActivationAuditEventStatus =
  | 'planned'
  | 'recorded'
  | 'failed';
export type AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityStatus =
  | 'payload_no_events'
  | 'payload_integrity_pending'
  | 'payload_integrity_failed'
  | 'payload_integrity_ready';
export type AdminEnterpriseProjectAccessGuardActivationAuditPayloadIssueSource =
  | 'event_type'
  | 'readiness_snapshot'
  | 'blocker_snapshot'
  | 'review_snapshot'
  | 'audit_plan_snapshot'
  | 'execution_result'
  | 'rollback_reference';
export type AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityStatus =
  | 'metadata_no_events'
  | 'metadata_integrity_failed'
  | 'metadata_integrity_ready';
export type AdminEnterpriseProjectAccessGuardActivationAuditMetadataIssueSource =
  | 'event_type'
  | 'event_status'
  | 'current_mode'
  | 'target_mode'
  | 'source';
export type AdminEnterpriseAuditCoverageReadinessStatus =
  | 'no_audit_logs'
  | 'activation_audit_missing'
  | 'audit_coverage_ready';
export type AdminEnterpriseAuditExportReadinessStatus =
  | 'no_audit_logs'
  | 'activation_audit_missing'
  | 'export_sample_missing'
  | 'audit_export_ready';
export type AdminEnterpriseAuditExportQueryReadinessStatus =
  | 'no_audit_logs'
  | 'activation_audit_missing'
  | 'query_sample_missing'
  | 'audit_export_query_ready';
export type AdminEnterpriseAuditExportTaskPreflightReadinessStatus =
  | 'no_audit_logs'
  | 'activation_audit_missing'
  | 'query_not_ready'
  | 'retention_not_ready'
  | 'audit_export_task_preflight_ready';
export type AdminEnterpriseAuditExportFileFormatReadinessStatus =
  | 'no_audit_logs'
  | 'task_preflight_not_ready'
  | 'format_contract_missing'
  | 'audit_export_file_format_ready';
export type AdminEnterpriseAuditExportFileGeneratorReadinessStatus =
  | 'no_audit_logs'
  | 'file_format_not_ready'
  | 'generator_contract_missing'
  | 'audit_export_file_generator_ready';
export type AdminEnterpriseAuditExportTaskCreateRequestReadinessStatus =
  | 'no_audit_logs'
  | 'file_generator_not_ready'
  | 'task_create_request_contract_missing'
  | 'audit_export_task_create_request_ready';
export type AdminEnterpriseAuditExportTaskPersistenceReadinessStatus =
  | 'no_audit_logs'
  | 'task_create_request_not_ready'
  | 'task_persistence_contract_missing'
  | 'audit_export_task_persistence_ready';
export type AdminEnterpriseAuditExportWorkerReadinessStatus =
  | 'no_audit_logs'
  | 'file_generator_not_ready'
  | 'task_readback_not_ready'
  | 'no_queued_tasks'
  | 'worker_contract_missing'
  | 'audit_export_worker_ready';
export type AdminEnterpriseAuditExportWorkerExecutionRequestReadinessStatus =
  | 'no_audit_logs'
  | 'worker_not_ready'
  | 'status_transition_not_ready'
  | 'worker_execution_request_contract_missing'
  | 'audit_export_worker_execution_request_ready';
export type AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessStatus =
  | 'no_audit_logs'
  | 'worker_execution_request_not_ready'
  | 'worker_execution_request_persistence_contract_missing'
  | 'audit_export_worker_execution_request_persistence_ready';
export type AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessStatus =
  | 'no_audit_logs'
  | 'worker_execution_request_persistence_not_ready'
  | 'no_worker_execution_requests'
  | 'worker_execution_dry_run_contract_missing'
  | 'audit_export_worker_execution_dry_run_ready';
export type AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessStatus =
  | 'no_audit_logs'
  | 'worker_execution_dry_run_not_ready'
  | 'no_dry_run_completed_requests'
  | 'worker_execution_artifact_contract_missing'
  | 'audit_export_worker_execution_artifact_ready';
export type AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessStatus =
  | 'no_audit_logs'
  | 'worker_execution_artifact_not_ready'
  | 'no_artifact_generated_requests'
  | 'worker_execution_output_storage_contract_missing'
  | 'audit_export_worker_execution_output_storage_ready';
export type AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessStatus =
  | 'no_audit_logs'
  | 'worker_execution_output_storage_not_ready'
  | 'no_output_stored_requests'
  | 'task_readback_not_ready'
  | 'no_queued_tasks'
  | 'worker_execution_task_completion_contract_missing'
  | 'audit_export_worker_execution_task_completion_ready';
export type AdminEnterpriseAuditExportTaskStatusTransitionReadinessStatus =
  | 'no_audit_logs'
  | 'worker_not_ready'
  | 'task_readback_not_ready'
  | 'no_transition_candidates'
  | 'status_transition_contract_missing'
  | 'audit_export_task_status_transition_ready';
export type AdminEnterpriseAuditExportArchiveExpirationReadinessStatus =
  | 'no_audit_logs'
  | 'retention_not_ready'
  | 'task_readback_not_ready'
  | 'no_expiration_candidates'
  | 'archive_expiration_contract_missing'
  | 'audit_export_archive_expiration_ready';
export type AdminEnterpriseAuditExportDeliveryReportReadinessStatus =
  | 'no_audit_logs'
  | 'worker_not_ready'
  | 'status_transition_not_ready'
  | 'archive_expiration_not_ready'
  | 'delivery_report_contract_missing'
  | 'audit_export_delivery_report_ready';
export type AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessStatus =
  | 'no_audit_logs'
  | 'delivery_report_not_ready'
  | 'task_readback_not_ready'
  | 'no_completed_tasks'
  | 'no_worker_execution_completed_tasks'
  | 'delivery_report_completed_task_contract_missing'
  | 'audit_export_delivery_report_completed_task_ready';
export type AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessStatus =
  | 'no_audit_logs'
  | 'delivery_report_not_ready'
  | 'delivery_report_completed_task_not_ready'
  | 'delivery_report_generate_request_contract_missing'
  | 'audit_export_delivery_report_generate_request_ready';
export type AdminEnterpriseAuditExportDeliveryReportStorageReadinessStatus =
  | 'no_audit_logs'
  | 'generate_request_not_ready'
  | 'delivery_report_storage_contract_missing'
  | 'audit_export_delivery_report_storage_ready';
export type AdminEnterpriseAuditExportDeliveryReportStoredReadinessStatus =
  | 'no_audit_logs'
  | 'delivery_report_storage_not_ready'
  | 'no_stored_reports'
  | 'delivery_report_stored_contract_missing'
  | 'delivery_report_metadata_evidence_missing'
  | 'delivery_report_admin_audit_evidence_missing'
  | 'audit_export_delivery_report_stored_ready';
export type AdminEnterpriseAuditExportWorkerExecutionRequestPersistStatus = 'requested' | 'idempotent_existing';
export type AdminEnterpriseAuditExportWorkerExecutionDryRunStatus = 'dry_run_completed' | 'dry_run_existing';
export type AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateStatus = 'artifact_generated' | 'artifact_existing';
export type AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreStatus = 'output_stored' | 'storage_existing';
export type AdminEnterpriseAuditExportDeliveryReportGenerateStatus = 'generated';
export type AdminEnterpriseAuditExportDeliveryReportStoreStatus = 'stored' | 'idempotent_existing';
export type AdminEnterpriseAuditRetentionReadinessStatus =
  | 'no_audit_logs'
  | 'activation_audit_missing'
  | 'retention_policy_missing'
  | 'retention_policy_invalid'
  | 'audit_retention_ready';
export type AdminEnterprisePrivateDeploymentReadinessStatus =
  | 'system_config_unavailable'
  | 'bootstrap_config_missing'
  | 'runtime_config_missing'
  | 'migration_schema_missing'
  | 'container_boundary_missing'
  | 'private_deployment_ready';
export type AdminEnterpriseCommercialReadinessStatus =
  | 'project_ownership_not_ready'
  | 'audit_compliance_not_ready'
  | 'private_deployment_not_ready'
  | 'commercial_contract_missing'
  | 'commercial_readiness_ready';
export type AdminEnterpriseProjectAccessGuardActivationBlockerSource =
  | 'switch_unmapped_project'
  | 'switch_extra_ownership'
  | 'dry_run_enterprise_unavailable'
  | 'dry_run_authorization_drift';
export type AdminEnterpriseProjectAccessGuardActivationReviewItemSource =
  | 'switch_readiness'
  | 'authorization_dry_run'
  | 'blocker_candidates'
  | 'authorization_mode'
  | 'tenant_isolation_boundary'
  | 'organization_rbac_boundary'
  | 'manual_activation_task';

export type AdminEnterpriseProjectAccessGuardActivationReviewItemStatus =
  | 'passed'
  | 'blocked'
  | 'manual_required';
export type AdminEnterpriseProjectAccessGuardActivationAuditPlanItemSource =
  | 'readiness_snapshot'
  | 'blocker_snapshot'
  | 'manual_approval'
  | 'activation_execution'
  | 'post_activation_access_validation'
  | 'rollback_evidence';

export type AdminEnterpriseProjectAccessGuardActivationAuditPlanItemStatus =
  | 'evidence_ready'
  | 'blocked'
  | 'manual_required';
export type AdminEnterpriseProjectAccessGuardMode =
  | 'legacy_user_owned'
  | 'enterprise_owned';
export type AdminEnterpriseProjectAccessDecisionStatus =
  | 'service_unavailable'
  | 'not_found'
  | 'forbidden'
  | 'granted';
export type AdminEnterpriseProjectAccessGuardAuthorizationDryRunStatus =
  | 'unavailable'
  | 'no_mapping'
  | 'membership_lookup_failed'
  | 'no_active_membership'
  | 'membership_ready';
export type AdminEnterpriseProjectAccessGuardAuthorizationDriftStatus =
  | 'not_compared'
  | 'aligned'
  | 'enterprise_unavailable'
  | 'legacy_granted_enterprise_blocked'
  | 'legacy_blocked_enterprise_granted';
export type AdminEnterpriseProjectOwnershipStatus = 'active';
export type AdminEnterpriseProjectOwnershipMigrationStatus = 'migrated';

export interface AdminProfile {
  id?: string;
  email: string;
  username?: string;
  role: AdminSessionRole;
  raw_role: string;
  must_change_password: boolean;
  avatar_url?: string;
  permission_codes: AdminPermissionCodeList;
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminProfile;
  expires_in?: number;
  token_storage_status?: AdminAuthStorageStatus;
  token_storage_error?: string;
  token_storage_error_source?: AdminAuthStorageSource;
  token_storage_error_details?: AdminAuthStorageDetails;
  profile_cache_status?: AdminAuthStorageStatus;
  profile_cache_error?: string;
  profile_cache_error_source?: AdminAuthStorageSource;
  profile_cache_error_details?: AdminAuthStorageDetails;
}

type AdminProfileRawResponse = {
  id?: string;
  email: string;
  username?: string;
  role?: string;
  status?: string;
  must_change_password?: boolean;
  avatar_url?: string;
  created_at?: string;
  permission_codes?: AdminPermissionCodeList;
};

type AdminLoginRawResponse = {
  token: string;
  expires_in?: number;
  admin: AdminProfileRawResponse;
};

export type AdminProfileCache = {
  email: string;
  role: AdminSessionRole;
  raw_role: string;
  must_change_password: boolean;
  permission_codes: AdminPermissionCodeList;
};
export type AdminProfileCacheRawPayload = {
  email?: string;
  role?: string;
  raw_role?: string;
  must_change_password?: boolean;
  permission_codes?: AdminPermissionCodeList;
};
export type AdminLLMProviderType = AIModelProviderType;
export type AdminLLMProviderId = number;
export type AdminApiErrorDetails = string;
export type AdminApiErrorSource = string;

export type AdminApiErrorMetadata = {
  details?: AdminApiErrorDetails;
  source?: AdminApiErrorSource;
};

export type AdminApiResponseRawObject = {
  [fieldName: string]: unknown;
};

export type AdminRequestHeaderMap = {
  [headerName: string]: string;
};

type AdminStructuredErrorSuffixSegment = string;
type AdminStructuredErrorSuffixSegmentList = AdminStructuredErrorSuffixSegment[];
type AdminRoleList = AdminRole[];
type AdminManagerAssignedRoleList = AdminRole[];
type AdminManagerList = AdminManager[];
type AdminUserList = AdminUser[];

export class AdminApiError extends Error {
  status: number;
  data?: unknown;
  details?: AdminApiErrorDetails;
  source?: AdminApiErrorSource;

  constructor(
    message: string,
    status: number,
    data?: unknown,
    metadata: AdminApiErrorMetadata = {},
  ) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.data = data;
    this.details = metadata.details;
    this.source = metadata.source;
  }
}

export interface LLMProvider {
  id: AdminLLMProviderId;
  name: AIModelProvider;
  display_name: string;
  type: AdminLLMProviderType;
  has_api_key: boolean;
  base_url: AIModelProviderBaseUrl;
  model: AIModelName;
  enabled: boolean;
  is_default: boolean;
  priority: number;
  sort_order: number;
  extra_config: AIModelProviderExtraConfig;
  use_count: number;
  runtime_loaded?: boolean;
  runtime_active?: boolean;
  models?: LLMProviderModel[];
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LLMProviderModel {
  id: number;
  provider_id: AdminLLMProviderId;
  model_id: AIModelName;
  display_name: string;
  enabled: boolean;
  is_default: boolean;
  capability_tags?: string;
  context_window?: number;
  default_for?: string;
  priority?: number;
  sort_order?: number;
  extra_config?: AIModelProviderExtraConfig;
  runtime_id: AIModelProvider;
  runtime_loaded?: boolean;
  runtime_active?: boolean;
}

export interface AdminLLMProvidersResponse {
  providers: LLMProvider[];
  default_id?: AdminLLMProviderId;
  default_name?: AIModelProvider;
}

export interface LLMRuntimeProviderInfo {
  name: AIModelProvider;
  type?: AIModelProviderType;
  model?: AIModelName;
  base_url?: AIModelProviderBaseUrl;
  is_default?: boolean;
  enabled?: boolean;
}

export interface LLMReloadResponse {
  success: boolean;
  message?: AIModelProviderReloadMessage;
  providers?: LLMRuntimeProviderInfo[];
}

export interface LLMProviderModelDiscoveryResult {
  provider_id: AdminLLMProviderId;
  provider_name: AIModelProvider;
  discovered_count: number;
  models: LLMProviderModel[];
  message: string;
  recovery: string;
}

export interface AdminLLMProviderConnectionTestResponse {
  provider: AIModelProvider;
  model: AIModelName;
  has_api_key: boolean;
  status: AIModelProviderConnectionTestStatus;
  latency_ms: number;
  message: AIModelProviderConnectionTestMessage;
  recovery: string;
}

export interface LLMProviderCreate {
  name: AIModelProvider;
  display_name?: string;
  type?: AdminLLMProviderType;
  api_key?: string;
  base_url?: AIModelProviderBaseUrl;
  model?: AIModelName;
  enabled?: boolean;
  is_default?: boolean;
  priority?: number;
  sort_order?: number;
  extra_config?: AIModelProviderExtraConfig;
  models?: LLMProviderModelCreate[];
}

export interface LLMProviderModelCreate {
  model_id: AIModelName;
  display_name?: string;
  enabled?: boolean;
  is_default?: boolean;
  capability_tags?: string;
  context_window?: number;
  default_for?: string;
  priority?: number;
  sort_order?: number;
  extra_config?: AIModelProviderExtraConfig;
}

export interface SystemConfig {
  id: AdminSystemConfigId;
  key: AdminSystemConfigKey;
  value: string;
  value_type?: AdminSystemConfigValueType;
  description: AdminSystemConfigDescription;
  is_public?: AdminSystemConfigPublicFlag;
  updated_at: string;
}

export interface AdminPermission {
  id: AdminPermissionId;
  code: string;
  name: string;
  description?: string;
}

export type AdminRoleStatus = 'active' | 'disabled' | 'unknown';
export type AdminRoleMutableStatus = 'active' | 'disabled';

export interface AdminRole {
  id: AdminRoleId;
  name: string;
  display_name: string;
  description?: string;
  is_system: boolean;
  status: AdminRoleStatus;
  raw_status: string;
  permissions?: AdminPermission[];
  created_at: string;
  updated_at: string;
}

type AdminRoleRawResponse = {
  id: AdminRoleId;
  name: string;
  display_name: string;
  description?: string;
  is_system: boolean;
  status?: string;
  permissions?: AdminPermission[];
  created_at: string;
  updated_at: string;
};

export type AdminManagerStatus = 'active' | 'disabled' | 'unknown';
export type AdminManagerSystemRole = 'admin' | 'super_admin' | 'unknown';
export type AdminManagerMutableStatus = 'active' | 'disabled';
export type AdminManagerMutableSystemRole = 'admin' | 'super_admin';

export interface AdminManager {
  id: AdminManagerId;
  email: string;
  username?: string;
  role: AdminManagerSystemRole;
  status: AdminManagerStatus;
  raw_role: string;
  raw_status: string;
  must_change_password: boolean;
  avatar_url?: string;
  assigned_roles?: AdminRole[];
  permission_codes?: AdminPermissionCodeList;
  created_at: string;
  updated_at?: string;
}

type AdminManagerRawResponse = {
  id: AdminManagerId;
  email: string;
  username?: string;
  role?: string;
  status?: string;
  must_change_password?: boolean;
  avatar_url?: string;
  last_login_at?: string | null;
  assigned_roles?: AdminRoleRawResponse[];
  permission_codes?: AdminPermissionCodeList;
  created_at: string;
  updated_at?: string;
};

type AdminManagerListRawResponse = {
  admins: AdminManagerRawResponse[];
  total: number;
  page: number;
  pageSize: number;
};

export interface AdminManagerListResponse {
  admins: AdminManager[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminUserStatus = 'active' | 'disabled' | 'deleted' | 'unknown';
export type AdminUserRole = 'user' | 'admin' | 'super_admin' | 'unknown';
export type AdminUserMutableStatus = 'active' | 'disabled';
export type AdminUserMutableRole = 'user' | 'admin' | 'super_admin';
export type AdminUserId = string;

export interface AuditLog {
  id: AdminAuditLogId;
  admin_id: AdminAuditActorAdminId;
  action: string;
  target_type: string;
  target_id: AdminAuditTargetId;
  detail: string;
  ip_address: string;
  created_at: string;
}

export interface AdminAuditListResponse {
  logs: AuditLog[];
  total: number;
}

export interface AdminUser {
  id: AdminUserId;
  email: string;
  username?: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  raw_role: string;
  raw_status: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

type AdminUserRawResponse = {
  id: AdminUserId;
  email: string;
  username?: string;
  avatar_url?: string;
  role?: string;
  status?: string;
  email_verified?: boolean;
  plan?: string;
  llm_model?: string;
  llm_temperature?: string;
  llm_max_tokens?: number;
  created_at: string;
  updated_at: string;
  instance_id?: string;
};

type AdminUserListRawResponse = {
  users: AdminUserRawResponse[];
  total: number;
};

export interface AdminProjectRuntimeStatus {
  projectId?: string;
  taskId?: string;
  status: ProjectRuntimeLifecycleStatus;
  containerStatus?: ProjectRuntimeContainerStatus;
  internalPort?: number;
  previewUrl?: string;
  phase?: ProjectRuntimePhase;
  message?: ProjectRuntimeMessage;
  error?: ProjectRuntimeError;
  specHash?: ProjectRuntimeSpecHash;
  containerStatusPersistence?: ProjectContainerStatusPersistenceStatus;
  containerStatusPersistenceError?: string;
  persistenceStatus?: ProjectRuntimeStatusPersistenceStatus;
  persistenceError?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface AdminProject {
  id: AdminProjectRecordId;
  project_id: AdminProjectId;
  user_id: AdminProjectOwnerUserId;
  name: string;
  description?: string;
  app_type?: string;
  tech_stack?: string;
  plan_id?: string;
  container_port?: number;
  internal_port?: number;
  container_status?: ProjectRuntimeContainerStatus;
  runtime_status?: AdminProjectRuntimeStatus;
  created_at?: string;
  updated_at?: string;
}

export interface AdminProjectsResponse {
  projects: AdminProject[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminEnterpriseSsoDiscoveryReadinessResponse {
  status: AdminEnterpriseSsoDiscoveryReadinessStatus;
  sso_enabled: boolean;
  provider_type: string;
  issuer_url: string;
  client_id_configured: boolean;
  redirect_uri_configured: boolean;
  discovery_url: string;
  discovered_issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  response_types_supported_count: number;
  scopes_supported_count: number;
  discovery_http_status_code: number;
  login_callback_enabled: boolean;
  session_normalization_enabled: boolean;
  admin_audit_write_enabled: boolean;
  discovery_request_performed: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseOrganizationReadinessResponse {
  organization_count: number;
  team_count: number;
  member_count: number;
  readiness_status: AdminEnterpriseOrganizationReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectOwnershipReadinessResponse {
  project_count: number;
  legacy_user_owned_project_count: number;
  organization_project_count: number;
  unmigrated_project_count: number;
  organization_count: number;
  team_count: number;
  member_count: number;
  readiness_status: AdminEnterpriseProjectOwnershipReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectOwnershipPreflightCandidate {
  project_record_id: AdminProjectRecordId;
  project_id: AdminProjectId;
  name: string;
  owner_user_id: AdminProjectOwnerUserId;
}

export interface AdminEnterpriseProjectOwnershipPreflightResponse {
  project_count: number;
  existing_ownership_count: number;
  candidate_project_count: number;
  organization_count: number;
  team_count: number;
  member_count: number;
  candidate_limit: number;
  candidates: AdminEnterpriseProjectOwnershipPreflightCandidate[];
  preflight_status: AdminEnterpriseProjectOwnershipPreflightStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectOwnership {
  id: number;
  project_id: AdminProjectId;
  organization_id: AdminEnterpriseOrganizationId;
  team_id?: AdminEnterpriseTeamId;
  status: AdminEnterpriseProjectOwnershipStatus;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminEnterpriseProjectOwnershipMigrateInput {
  project_record_id: AdminProjectRecordId;
  organization_id: AdminEnterpriseOrganizationId;
  team_id?: AdminEnterpriseTeamId;
  confirm_migrate: boolean;
}

export interface AdminEnterpriseProjectOwnershipMigrationResult {
  status: AdminEnterpriseProjectOwnershipMigrationStatus;
  ownership: AdminEnterpriseProjectOwnership;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectOwnershipMapping {
  ownership_id: number;
  project_record_id: AdminProjectRecordId;
  project_id: AdminProjectId;
  project_name: string;
  owner_user_id: AdminProjectOwnerUserId;
  project_found: boolean;
  organization_id: AdminEnterpriseOrganizationId;
  organization_slug: AdminEnterpriseOrganizationSlug;
  organization_display_name: AdminEnterpriseOrganizationDisplayName;
  team_id?: AdminEnterpriseTeamId;
  team_slug: AdminEnterpriseTeamSlug;
  team_display_name: AdminEnterpriseTeamDisplayName;
  status: AdminEnterpriseProjectOwnershipStatus;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminEnterpriseProjectOwnershipMappingsResponse {
  ownership_count: number;
  returned_mapping_count: number;
  missing_project_count: number;
  mapping_limit: number;
  mappings: AdminEnterpriseProjectOwnershipMapping[];
  mapping_status: AdminEnterpriseProjectOwnershipMappingStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectOwnershipOwnerGuardReadinessCandidate {
  project_record_id: AdminProjectRecordId;
  project_id: AdminProjectId;
  project_name: string;
  owner_user_id: AdminProjectOwnerUserId;
}

export interface AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse {
  project_count: number;
  ownership_count: number;
  mapped_project_count: number;
  unmapped_project_count: number;
  extra_ownership_count: number;
  preview_limit: number;
  unmapped_projects: AdminEnterpriseProjectOwnershipOwnerGuardReadinessCandidate[];
  owner_guard_status: AdminEnterpriseProjectOwnershipOwnerGuardReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardSwitchReadinessResponse {
  status: AdminEnterpriseProjectAccessGuardSwitchReadinessStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  can_switch_to_enterprise_owned: boolean;
  project_count: number;
  ownership_count: number;
  mapped_project_count: number;
  unmapped_project_count: number;
  extra_ownership_count: number;
  ownership_lookup_available: boolean;
  enterprise_authorization_active: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardAuthorizationDryRunDriftCandidate {
  project_record_id: AdminProjectRecordId;
  project_id: AdminProjectId;
  project_name: string;
  owner_user_id: AdminProjectOwnerUserId;
  dry_run_status: AdminEnterpriseProjectAccessGuardAuthorizationDryRunStatus;
  dry_run_decision: AdminEnterpriseProjectAccessDecisionStatus;
  drift_status: AdminEnterpriseProjectAccessGuardAuthorizationDriftStatus;
}

export interface AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse {
  status: AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  project_count: number;
  compared_project_count: number;
  aligned_project_count: number;
  enterprise_unavailable_project_count: number;
  legacy_granted_enterprise_blocked_count: number;
  legacy_blocked_enterprise_granted_count: number;
  drift_preview_limit: number;
  drift_candidates: AdminEnterpriseProjectAccessGuardAuthorizationDryRunDriftCandidate[];
  enterprise_authorization_active: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationBlockerCandidate {
  source: AdminEnterpriseProjectAccessGuardActivationBlockerSource;
  project_record_id: AdminProjectRecordId;
  project_id: AdminProjectId;
  project_name: string;
  owner_user_id: AdminProjectOwnerUserId;
  dry_run_status: AdminEnterpriseProjectAccessGuardAuthorizationDryRunStatus;
  dry_run_decision: AdminEnterpriseProjectAccessDecisionStatus;
  drift_status: AdminEnterpriseProjectAccessGuardAuthorizationDriftStatus;
}

export interface AdminEnterpriseProjectAccessGuardActivationReviewItem {
  source: AdminEnterpriseProjectAccessGuardActivationReviewItemSource;
  status: AdminEnterpriseProjectAccessGuardActivationReviewItemStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationAuditPlanItem {
  source: AdminEnterpriseProjectAccessGuardActivationAuditPlanItemSource;
  status: AdminEnterpriseProjectAccessGuardActivationAuditPlanItemStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationReadinessResponse {
  status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  can_activate_enterprise_owned: boolean;
  switch_status: AdminEnterpriseProjectAccessGuardSwitchReadinessStatus;
  authorization_dry_run_status: AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceStatus;
  project_count: number;
  mapped_project_count: number;
  unmapped_project_count: number;
  extra_ownership_count: number;
  compared_project_count: number;
  aligned_project_count: number;
  enterprise_unavailable_count: number;
  authorization_drift_count: number;
  blocker_preview_limit: number;
  blocker_candidates: AdminEnterpriseProjectAccessGuardActivationBlockerCandidate[];
  review_items: AdminEnterpriseProjectAccessGuardActivationReviewItem[];
  audit_plan_items: AdminEnterpriseProjectAccessGuardActivationAuditPlanItem[];
  enterprise_authorization_active: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse {
  audit_event_count: number;
  required_event_type_count: number;
  missing_required_event_type_count: number;
  recent_event_limit: number;
  payload_integrity_status: AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityStatus;
  payload_integrity_issue_count: number;
  payload_integrity_issue_limit: number;
  payload_integrity_issues: AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityIssue[];
  metadata_integrity_status: AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityStatus;
  metadata_integrity_issue_count: number;
  metadata_integrity_issue_limit: number;
  metadata_integrity_issues: AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityIssue[];
  required_event_items: AdminEnterpriseProjectAccessGuardActivationAuditRequiredEvent[];
  recent_events: AdminEnterpriseProjectAccessGuardActivationAuditRecentEvent[];
  readiness_status: AdminEnterpriseProjectAccessGuardActivationAuditReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditCoverageReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditCoverageReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  export_sample_count: number;
  export_sample_limit: number;
  max_export_window: number;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportQueryReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  query_sample_count: number;
  query_sample_limit: number;
  max_query_window: number;
  supported_filter_fields: string[];
  supported_filter_field_count: number;
  required_filter_field_count: number;
  sample_action_count: number;
  sample_target_type_count: number;
  sample_actor_count: number;
  export_task_creation_enabled: boolean;
  export_file_generation_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportQueryReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportTaskPreflightReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  query_sample_count: number;
  query_sample_limit: number;
  supported_filter_field_count: number;
  required_filter_field_count: number;
  retention_policy_configured: boolean;
  retention_days: number;
  minimum_retention_days: number;
  maximum_retention_days: number;
  export_task_creation_enabled: boolean;
  export_file_generation_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportTaskPreflightReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportFileFormatReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  query_sample_count: number;
  query_sample_limit: number;
  supported_filter_field_count: number;
  required_filter_field_count: number;
  retention_policy_configured: boolean;
  retention_days: number;
  supported_file_formats: string[];
  supported_file_format_count: number;
  required_file_format_count: number;
  required_columns: string[];
  required_column_count: number;
  schema_version: string;
  export_task_creation_enabled: boolean;
  export_file_generation_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportFileFormatReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportFileGeneratorReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  query_sample_count: number;
  query_sample_limit: number;
  retention_policy_configured: boolean;
  retention_days: number;
  supported_file_format_count: number;
  required_file_format_count: number;
  required_column_count: number;
  schema_version: string;
  output_path_prefix: string;
  file_name_template: string;
  checksum_algorithm: string;
  max_rows_per_file: number;
  generator_dry_run_enabled: boolean;
  output_storage_write_enabled: boolean;
  export_task_creation_enabled: boolean;
  export_file_generation_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportFileGeneratorReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  query_sample_count: number;
  query_sample_limit: number;
  supported_filter_field_count: number;
  required_filter_field_count: number;
  retention_policy_configured: boolean;
  retention_days: number;
  supported_file_format_count: number;
  required_file_format_count: number;
  required_column_count: number;
  file_format_schema_version: string;
  output_path_prefix: string;
  file_name_template: string;
  checksum_algorithm: string;
  max_rows_per_file: number;
  request_schema_version: string;
  required_request_fields: string[];
  required_request_field_count: number;
  idempotency_key_required: boolean;
  request_confirmation_required: boolean;
  export_task_creation_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportTaskCreateRequestReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportTaskPersistenceReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  existing_task_count: number;
  table_name: string;
  persistence_schema_version: string;
  request_schema_version: string;
  file_format_schema_version: string;
  required_persistence_fields: string[];
  required_persistence_field_count: number;
  idempotency_key_unique: boolean;
  requested_by_admin_required: boolean;
  time_range_required: boolean;
  filters_snapshot_required: boolean;
  output_path_prefix: string;
  checksum_algorithm: string;
  export_task_creation_enabled: boolean;
  export_task_persistence_write_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportTaskPersistenceReadinessStatus;
  message: string;
  recovery: string;
}

export type AdminEnterpriseAuditExportTaskCreateStatus =
  | 'queued'
  | 'idempotent_existing';

export type AdminEnterpriseAuditExportTaskStatusTransitionStatus =
  | 'transitioned';

export type AdminEnterpriseAuditExportWorkerExecutionTaskCompletionStatus =
  | 'completed';

export type AdminEnterpriseAuditExportTaskReadbackStatus =
  | 'no_audit_export_tasks'
  | 'task_persistence_not_ready'
  | 'audit_export_task_readback_ready';

export interface AdminEnterpriseAuditExportTask {
  id: string;
  idempotency_key: string;
  requested_by_admin_id: string;
  status: string;
  format: string;
  reason: string;
  filters_snapshot: string;
  time_range_start: string;
  time_range_end: string;
  request_schema_version: string;
  file_schema_version: string;
  output_path: string;
  checksum_sha256: string;
  row_count: number;
  error_message: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface AdminEnterpriseAuditExportTaskCreateInput {
  format: 'jsonl' | 'csv';
  reason: string;
  filters: Record<string, unknown>;
  time_range_start: string;
  time_range_end: string;
  idempotency_key: string;
  confirm_create_task: boolean;
}

export interface AdminEnterpriseAuditExportTaskCreateResult {
  status: AdminEnterpriseAuditExportTaskCreateStatus;
  task: AdminEnterpriseAuditExportTask;
  persistence_readiness_status: AdminEnterpriseAuditExportTaskPersistenceReadinessStatus;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  project_write_enabled: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportTaskStatusTransitionInput {
  task_id: string;
  target_status: string;
  reason: string;
  confirm_status_transition: boolean;
}

export interface AdminEnterpriseAuditExportTaskStatusTransitionResult {
  status: AdminEnterpriseAuditExportTaskStatusTransitionStatus;
  task: AdminEnterpriseAuditExportTask;
  previous_status: string;
  target_status: string;
  transition: string;
  readiness_status: AdminEnterpriseAuditExportTaskStatusTransitionReadinessStatus;
  task_status_mutation_written: boolean;
  task_status_audit_written: boolean;
  worker_execution_started: boolean;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  archive_deletion_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionTaskCompletionInput {
  request_id: string;
  reason: string;
  confirm_worker_execution_task_completion: boolean;
}

export interface AdminEnterpriseAuditExportWorkerExecutionTaskCompletionResult {
  status: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionStatus;
  request: AdminEnterpriseAuditExportWorkerExecutionRequestRecord;
  task: AdminEnterpriseAuditExportTask;
  previous_task_status: string;
  target_task_status: string;
  required_request_status: string;
  transition: string;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessStatus;
  output_storage_readiness_status: AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessStatus;
  output_path: string;
  checksum_sha256: string;
  row_count: number;
  request_task_matched: boolean;
  output_storage_metadata_verified: boolean;
  task_status_mutation_written: boolean;
  task_status_audit_written: boolean;
  worker_execution_started: boolean;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  delivery_report_storage_write_started: boolean;
  archive_deletion_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportTaskListResult {
  status: AdminEnterpriseAuditExportTaskReadbackStatus;
  tasks: AdminEnterpriseAuditExportTask[];
  task_count: number;
  total_count: number;
  limit: number;
  persistence_readiness_status: AdminEnterpriseAuditExportTaskPersistenceReadinessStatus;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  project_write_enabled: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  task_count: number;
  queued_task_count: number;
  worker_mode: string;
  worker_batch_size: number;
  worker_lease_seconds: number;
  output_path_prefix: string;
  checksum_algorithm: string;
  worker_dry_run_enabled: boolean;
  worker_execution_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportWorkerReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  worker_readiness_status: AdminEnterpriseAuditExportWorkerReadinessStatus;
  status_transition_readiness_status: AdminEnterpriseAuditExportTaskStatusTransitionReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  queued_task_count: number;
  request_schema_version: string;
  required_request_fields: string[];
  required_request_field_count: number;
  request_confirmation_required: boolean;
  idempotency_key_required: boolean;
  max_reason_length: number;
  batch_limit: number;
  worker_mode: string;
  worker_lease_seconds: number;
  output_path_prefix: string;
  checksum_algorithm: string;
  request_execution_enabled: boolean;
  worker_execution_enabled: boolean;
  task_status_mutation_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionRequestReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  execution_request_readiness_status: AdminEnterpriseAuditExportWorkerExecutionRequestReadinessStatus;
  existing_execution_request_count: number;
  table_name: string;
  persistence_schema_version: string;
  request_schema_version: string;
  required_persistence_fields: string[];
  required_persistence_field_count: number;
  idempotency_key_unique: boolean;
  task_reference_required: boolean;
  admin_reference_required: boolean;
  request_payload_snapshot_required: boolean;
  readiness_snapshot_required: boolean;
  execution_result_snapshot_required: boolean;
  request_persistence_write_enabled: boolean;
  worker_execution_enabled: boolean;
  task_status_mutation_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionRequestRecord {
  id: string;
  idempotency_key: string;
  task_id: string;
  requested_by_admin_id: string;
  status: string;
  reason: string;
  batch_limit: number;
  request_schema_version: string;
  worker_readiness_status: string;
  status_transition_readiness_status: string;
  task_readback_status: string;
  queued_task_count: number;
  request_payload_snapshot: string;
  readiness_snapshot: string;
  execution_result: string;
  output_path: string;
  checksum_sha256: string;
  row_count: number;
  error_message: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionRequestPersistInput {
  task_id: string;
  reason: string;
  idempotency_key: string;
  batch_limit: number;
  confirm_worker_execution: boolean;
}

export interface AdminEnterpriseAuditExportWorkerExecutionRequestPersistResult {
  status: AdminEnterpriseAuditExportWorkerExecutionRequestPersistStatus;
  request: AdminEnterpriseAuditExportWorkerExecutionRequestRecord;
  persistence_readiness_status: AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessStatus;
  execution_request_readiness_status: AdminEnterpriseAuditExportWorkerExecutionRequestReadinessStatus;
  worker_readiness_status: AdminEnterpriseAuditExportWorkerReadinessStatus;
  status_transition_readiness_status: AdminEnterpriseAuditExportTaskStatusTransitionReadinessStatus;
  request_persistence_written: boolean;
  request_audit_written: boolean;
  worker_execution_started: boolean;
  task_status_mutation_started: boolean;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  delivery_report_storage_write_started: boolean;
  archive_deletion_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  persistence_readiness_status: AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessStatus;
  existing_execution_request_count: number;
  execution_dry_run_schema_version: string;
  worker_execution_dry_run_enabled: boolean;
  worker_execution_enabled: boolean;
  execution_result_persistence_enabled: boolean;
  task_status_mutation_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  delivery_report_storage_write_enabled: boolean;
  archive_deletion_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionDryRunInput {
  request_id: string;
  reason: string;
  confirm_worker_execution_dry_run: boolean;
}

export interface AdminEnterpriseAuditExportWorkerExecutionDryRunResult {
  status: AdminEnterpriseAuditExportWorkerExecutionDryRunStatus;
  request: AdminEnterpriseAuditExportWorkerExecutionRequestRecord;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessStatus;
  persistence_readiness_status: AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessStatus;
  execution_dry_run_schema_version: string;
  checksum_sha256: string;
  row_count: number;
  execution_result_written: boolean;
  execution_audit_written: boolean;
  worker_execution_dry_run_started: boolean;
  worker_execution_started: boolean;
  task_status_mutation_started: boolean;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  delivery_report_storage_write_started: boolean;
  archive_deletion_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  dry_run_readiness_status: AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessStatus;
  existing_execution_request_count: number;
  dry_run_completed_request_count: number;
  execution_artifact_schema_version: string;
  output_path_prefix: string;
  file_name_template: string;
  checksum_algorithm: string;
  max_rows_per_file: number;
  worker_execution_enabled: boolean;
  execution_result_persistence_enabled: boolean;
  task_status_mutation_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  delivery_report_storage_write_enabled: boolean;
  archive_deletion_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateInput {
  request_id: string;
  reason: string;
  confirm_worker_execution_artifact: boolean;
}

export interface AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateResult {
  status: AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateStatus;
  request: AdminEnterpriseAuditExportWorkerExecutionRequestRecord;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessStatus;
  dry_run_readiness_status: AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessStatus;
  execution_artifact_schema_version: string;
  output_path: string;
  file_name: string;
  checksum_sha256: string;
  row_count: number;
  execution_result_written: boolean;
  execution_audit_written: boolean;
  worker_execution_started: boolean;
  task_status_mutation_started: boolean;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  delivery_report_storage_write_started: boolean;
  archive_deletion_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  artifact_readiness_status: AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessStatus;
  existing_execution_request_count: number;
  artifact_generated_request_count: number;
  output_storage_schema_version: string;
  output_storage_path_prefix: string;
  required_storage_fields: string[];
  required_storage_field_count: number;
  checksum_algorithm: string;
  metadata_write_required: boolean;
  worker_execution_enabled: boolean;
  execution_result_persistence_enabled: boolean;
  task_status_mutation_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  delivery_report_storage_write_enabled: boolean;
  archive_deletion_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreInput {
  request_id: string;
  reason: string;
  confirm_worker_execution_output_storage: boolean;
}

export interface AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreResult {
  status: AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreStatus;
  request: AdminEnterpriseAuditExportWorkerExecutionRequestRecord;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessStatus;
  artifact_readiness_status: AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessStatus;
  output_storage_schema_version: string;
  output_storage_path: string;
  output_path: string;
  checksum_sha256: string;
  row_count: number;
  metadata_written: boolean;
  output_storage_write_started: boolean;
  execution_audit_written: boolean;
  worker_execution_started: boolean;
  task_status_mutation_started: boolean;
  export_file_generation_started: boolean;
  delivery_report_storage_write_started: boolean;
  archive_deletion_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  output_storage_readiness_status: AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  existing_execution_request_count: number;
  output_stored_request_count: number;
  task_count: number;
  queued_task_count: number;
  target_task_status: string;
  required_request_status: string;
  task_completion_source: string;
  request_task_match_required: boolean;
  output_storage_metadata_required: boolean;
  status_transition_confirmation_required: boolean;
  task_status_mutation_enabled: boolean;
  task_status_audit_write_enabled: boolean;
  worker_execution_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  delivery_report_storage_write_enabled: boolean;
  archive_deletion_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  worker_readiness_status: AdminEnterpriseAuditExportWorkerReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  task_count: number;
  queued_task_count: number;
  processing_task_count: number;
  terminal_task_count: number;
  allowed_task_statuses: string[];
  allowed_task_status_count: number;
  allowed_transitions: string[];
  allowed_transition_count: number;
  task_detail_read_enabled: boolean;
  status_transition_confirmation_required: boolean;
  task_status_mutation_enabled: boolean;
  worker_execution_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportTaskStatusTransitionReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportArchiveExpirationReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  retention_readiness_status: AdminEnterpriseAuditRetentionReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  task_count: number;
  terminal_task_count: number;
  completed_task_count: number;
  failed_task_count: number;
  cancelled_task_count: number;
  expiration_candidate_count: number;
  retention_policy_key: string;
  retention_days: number;
  scan_mode: string;
  candidate_limit: number;
  archive_scan_enabled: boolean;
  retention_deletion_enabled: boolean;
  task_status_mutation_enabled: boolean;
  worker_execution_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportArchiveExpirationReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  worker_readiness_status: AdminEnterpriseAuditExportWorkerReadinessStatus;
  status_transition_readiness_status: AdminEnterpriseAuditExportTaskStatusTransitionReadinessStatus;
  archive_expiration_readiness_status: AdminEnterpriseAuditExportArchiveExpirationReadinessStatus;
  retention_readiness_status: AdminEnterpriseAuditRetentionReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  task_count: number;
  queued_task_count: number;
  processing_task_count: number;
  terminal_task_count: number;
  expiration_candidate_count: number;
  report_format: string;
  required_report_sections: string[];
  required_report_section_count: number;
  report_generation_enabled: boolean;
  report_storage_write_enabled: boolean;
  report_audit_write_enabled: boolean;
  worker_execution_enabled: boolean;
  task_status_mutation_enabled: boolean;
  archive_deletion_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportDeliveryReportReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  delivery_report_readiness_status: AdminEnterpriseAuditExportDeliveryReportReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  task_count: number;
  completed_task_count: number;
  worker_execution_completed_task_count: number;
  required_task_status: string;
  required_task_source: string;
  completed_task_evidence_required: boolean;
  worker_execution_task_source_required: boolean;
  report_format: string;
  required_report_sections: string[];
  required_report_section_count: number;
  report_generation_enabled: boolean;
  report_storage_write_enabled: boolean;
  report_audit_write_enabled: boolean;
  worker_execution_enabled: boolean;
  task_status_mutation_enabled: boolean;
  archive_deletion_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  delivery_report_readiness_status: AdminEnterpriseAuditExportDeliveryReportReadinessStatus;
  completed_task_readiness_status: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  completed_task_count: number;
  worker_execution_completed_task_count: number;
  required_task_status: string;
  required_task_source: string;
  completed_task_evidence_required: boolean;
  worker_execution_task_source_required: boolean;
  report_format: string;
  required_report_sections: string[];
  required_report_section_count: number;
  request_schema_version: string;
  required_generate_request_fields: string[];
  required_generate_request_field_count: number;
  confirm_generate_report_required: boolean;
  reason_required: boolean;
  maximum_reason_length: number;
  idempotency_key_required: boolean;
  idempotency_key_pattern: string;
  request_execution_enabled: boolean;
  report_generation_enabled: boolean;
  report_storage_write_enabled: boolean;
  report_audit_write_enabled: boolean;
  worker_execution_enabled: boolean;
  task_status_mutation_enabled: boolean;
  archive_deletion_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  generate_request_readiness_status: AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessStatus;
  delivery_report_readiness_status: AdminEnterpriseAuditExportDeliveryReportReadinessStatus;
  completed_task_readiness_status: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessStatus;
  task_readback_status: AdminEnterpriseAuditExportTaskReadbackStatus;
  completed_task_count: number;
  worker_execution_completed_task_count: number;
  required_task_status: string;
  required_task_source: string;
  completed_task_evidence_required: boolean;
  worker_execution_task_source_required: boolean;
  report_format: string;
  required_report_sections: string[];
  required_report_section_count: number;
  storage_schema_version: string;
  required_storage_fields: string[];
  required_storage_field_count: number;
  existing_report_count: number;
  storage_path_prefix: string;
  checksum_algorithm: string;
  metadata_write_required: boolean;
  report_storage_write_enabled: boolean;
  report_audit_write_enabled: boolean;
  report_file_write_enabled: boolean;
  worker_execution_enabled: boolean;
  task_status_mutation_enabled: boolean;
  archive_deletion_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportDeliveryReportStorageReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  storage_readiness_status: AdminEnterpriseAuditExportDeliveryReportStorageReadinessStatus;
  completed_task_readiness_status: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessStatus;
  stored_report_count: number;
  read_report_count: number;
  latest_report_id: string;
  latest_report_idempotency_key: string;
  latest_report_generated_at: string;
  latest_report_storage_path: string;
  latest_report_checksum_sha256: string;
  latest_report_storage_schema_version: string;
  latest_report_source: string;
  latest_report_metadata_json: string;
  latest_report_storage_contract_ready: boolean;
  latest_report_checksum_matched: boolean;
  metadata_evidence_ready: boolean;
  admin_audit_evidence_ready: boolean;
  admin_audit_evidence_count: number;
  completed_task_count: number;
  worker_execution_completed_task_count: number;
  required_task_status: string;
  required_task_source: string;
  completed_task_evidence_required: boolean;
  worker_execution_task_source_required: boolean;
  report_format: string;
  required_report_sections: string[];
  required_report_section_count: number;
  storage_schema_version: string;
  storage_path_prefix: string;
  checksum_algorithm: string;
  report_storage_write_enabled: boolean;
  report_audit_write_enabled: boolean;
  report_file_write_enabled: boolean;
  worker_execution_enabled: boolean;
  task_status_mutation_enabled: boolean;
  archive_deletion_enabled: boolean;
  export_file_generation_enabled: boolean;
  output_storage_write_enabled: boolean;
  audit_write_enabled: boolean;
  project_write_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditExportDeliveryReportStoredReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportGenerateInput {
  reason: string;
  idempotency_key: string;
  confirm_generate_report: boolean;
}

export interface AdminEnterpriseAuditExportDeliveryReportGenerateResult {
  status: AdminEnterpriseAuditExportDeliveryReportGenerateStatus;
  idempotency_key: string;
  reason: string;
  generated_at: string;
  report_format: string;
  report_content: string;
  report_content_byte_count: number;
  required_report_sections: string[];
  required_report_section_count: number;
  delivery_report_readiness_status: AdminEnterpriseAuditExportDeliveryReportReadinessStatus;
  completed_task_readiness_status: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessStatus;
  generate_request_readiness_status: AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessStatus;
  completed_task_count: number;
  worker_execution_completed_task_count: number;
  required_task_status: string;
  required_task_source: string;
  completed_task_evidence_required: boolean;
  worker_execution_task_source_required: boolean;
  report_file_written: boolean;
  report_storage_write_started: boolean;
  report_audit_write_started: boolean;
  worker_execution_started: boolean;
  task_status_mutation_started: boolean;
  archive_deletion_started: boolean;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  audit_write_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportStoredReport {
  id: string;
  idempotency_key: string;
  requested_by_admin_id: string;
  reason: string;
  report_format: string;
  report_content: string;
  report_content_byte_count: number;
  generated_at: string;
  checksum_sha256: string;
  storage_path: string;
  storage_schema_version: string;
  metadata_json: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface AdminEnterpriseAuditExportDeliveryReportStoreInput {
  reason: string;
  idempotency_key: string;
  report_format: string;
  report_content: string;
  generated_at: string;
  confirm_store_report: boolean;
}

export interface AdminEnterpriseAuditExportDeliveryReportStoreResult {
  status: AdminEnterpriseAuditExportDeliveryReportStoreStatus;
  report: AdminEnterpriseAuditExportDeliveryReportStoredReport;
  storage_readiness_status: AdminEnterpriseAuditExportDeliveryReportStorageReadinessStatus;
  completed_task_readiness_status: AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessStatus;
  completed_task_count: number;
  worker_execution_completed_task_count: number;
  required_task_status: string;
  required_task_source: string;
  completed_task_evidence_required: boolean;
  worker_execution_task_source_required: boolean;
  checksum_algorithm: string;
  checksum_sha256: string;
  storage_path: string;
  report_storage_written: boolean;
  report_audit_written: boolean;
  report_file_written: boolean;
  worker_execution_started: boolean;
  task_status_mutation_started: boolean;
  archive_deletion_started: boolean;
  export_file_generation_started: boolean;
  output_storage_write_started: boolean;
  admin_audit_write_started: boolean;
  project_write_started: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseAuditRetentionReadinessResponse {
  admin_audit_log_count: number;
  activation_audit_event_count: number;
  retention_policy_key: string;
  retention_policy_configured: boolean;
  retention_days: number;
  minimum_retention_days: number;
  maximum_retention_days: number;
  retention_deletion_enabled: boolean;
  covered_source_count: number;
  required_source_count: number;
  readiness_status: AdminEnterpriseAuditRetentionReadinessStatus;
  message: string;
  recovery: string;
}

export interface AdminEnterprisePrivateDeploymentReadinessResponse {
  readiness_status: AdminEnterprisePrivateDeploymentReadinessStatus;
  database_type: string;
  database_configured: boolean;
  supabase_configured: boolean;
  jwt_configured: boolean;
  system_config_available: boolean;
  runtime_config_key_count: number;
  required_runtime_config_key_count: number;
  runtime_config_covered: boolean;
  migration_schema_available: boolean;
  migration_schema_check_count: number;
  migration_schema_available_check_count: number;
  container_enabled: boolean;
  container_runtime: string;
  container_socket_configured: boolean;
  project_directory_configured: boolean;
  preview_gateway_configured: boolean;
  environment_variable_write_enabled: boolean;
  database_migration_write_enabled: boolean;
  container_mutation_enabled: boolean;
  external_network_probe_enabled: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseCommercialReadinessResponse {
  readiness_status: AdminEnterpriseCommercialReadinessStatus;
  project_ownership_status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  enterprise_authorization_active: boolean;
  audit_compliance_status: AdminEnterpriseAuditExportDeliveryReportStoredReadinessStatus;
  private_deployment_status: AdminEnterprisePrivateDeploymentReadinessStatus;
  project_ownership_ready: boolean;
  audit_compliance_ready: boolean;
  private_deployment_ready: boolean;
  billing_provider_configured: boolean;
  subscription_write_enabled: boolean;
  contract_write_enabled: boolean;
  payment_collection_enabled: boolean;
  commercial_launch_ready: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationManualApprovalInput {
  confirm_manual_approval: boolean;
  approval_note: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationManualApprovalResult {
  status: 'manual_approval_recorded';
  event_id: number;
  event_type: 'manual_approval';
  readiness_status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationExecutionInput {
  confirm_activation_execution: boolean;
  execution_note: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationExecutionResult {
  status: 'activation_execution_recorded';
  event_id: number;
  event_type: 'activation_execution';
  readiness_status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardPostActivationValidationInput {
  confirm_post_activation_validation: boolean;
  validation_note: string;
}

export interface AdminEnterpriseProjectAccessGuardPostActivationValidationResult {
  status: 'post_activation_validation_recorded';
  event_id: number;
  event_type: 'post_activation_access_validation';
  readiness_status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardRollbackEvidenceInput {
  confirm_rollback_evidence: boolean;
  rollback_note: string;
  rollback_reference: string;
}

export interface AdminEnterpriseProjectAccessGuardRollbackEvidenceResult {
  status: 'rollback_evidence_recorded';
  event_id: number;
  event_type: 'rollback_evidence';
  readiness_status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  rollback_reference: string;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardAuthorizationActivationInput {
  confirm_enterprise_authorization_activation: boolean;
  activation_note: string;
}

export interface AdminEnterpriseProjectAccessGuardAuthorizationActivationResult {
  status: 'enterprise_authorization_activated';
  event_id: number;
  event_type: 'activation_execution';
  readiness_status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  previous_mode: AdminEnterpriseProjectAccessGuardMode;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  enterprise_authorization_active: boolean;
  config_key: string;
  config_written: boolean;
  projects_written: boolean;
  tenant_isolation_enabled: boolean;
  organization_rbac_enabled: boolean;
  message: string;
  recovery: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationAuditRequiredEvent {
  event_type: AdminEnterpriseProjectAccessGuardActivationAuditEventType;
  recorded_count: number;
  latest_status: AdminEnterpriseProjectAccessGuardActivationAuditEventStatus;
  missing: boolean;
}

export interface AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityIssue {
  event_id: number;
  event_type: AdminEnterpriseProjectAccessGuardActivationAuditEventType;
  source: AdminEnterpriseProjectAccessGuardActivationAuditPayloadIssueSource;
  message: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityIssue {
  event_id: number;
  event_type: string;
  source: AdminEnterpriseProjectAccessGuardActivationAuditMetadataIssueSource;
  message: string;
}

export interface AdminEnterpriseProjectAccessGuardActivationAuditRecentEvent {
  id: number;
  event_type: AdminEnterpriseProjectAccessGuardActivationAuditEventType;
  status: AdminEnterpriseProjectAccessGuardActivationAuditEventStatus;
  actor_admin_id: AdminAuditActorAdminId;
  readiness_status: AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
  current_mode: AdminEnterpriseProjectAccessGuardMode;
  target_mode: AdminEnterpriseProjectAccessGuardMode;
  rollback_reference: string;
  source: string;
  created_at: string;
}

export interface AdminEnterpriseOrganization {
  id: AdminEnterpriseOrganizationId;
  slug: AdminEnterpriseOrganizationSlug;
  display_name: AdminEnterpriseOrganizationDisplayName;
  status: AdminEnterpriseOrganizationStatus;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminEnterpriseOrganizationCreateInput {
  slug: AdminEnterpriseOrganizationSlug;
  display_name: AdminEnterpriseOrganizationDisplayName;
  status: AdminEnterpriseOrganizationStatus;
}

export interface AdminEnterpriseTeam {
  id: AdminEnterpriseTeamId;
  organization_id: AdminEnterpriseOrganizationId;
  slug: AdminEnterpriseTeamSlug;
  display_name: AdminEnterpriseTeamDisplayName;
  status: AdminEnterpriseTeamStatus;
  created_at?: string;
  updated_at?: string;
}

export interface AdminEnterpriseTeamCreateInput {
  organization_id: AdminEnterpriseOrganizationId;
  slug: AdminEnterpriseTeamSlug;
  display_name: AdminEnterpriseTeamDisplayName;
  status: AdminEnterpriseTeamStatus;
}

export interface AdminEnterpriseMember {
  id: AdminEnterpriseMemberId;
  organization_id: AdminEnterpriseOrganizationId;
  team_id: AdminEnterpriseTeamId;
  user_id: AdminUserId;
  role: AdminEnterpriseMemberRole;
  status: AdminEnterpriseMemberStatus;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminEnterpriseMemberBindInput {
  organization_id: AdminEnterpriseOrganizationId;
  team_id: AdminEnterpriseTeamId;
  user_id: AdminUserId;
  status: AdminEnterpriseMemberStatus;
}

export type CapabilityProviderPreflightProvider = string;
export type CapabilityProviderPreflightRunnerMode = string;
export type CapabilityProviderPreflightStatus = 'ready' | 'skipped' | 'blocked';
export type CapabilityProviderPreflightSeverity = 'info' | 'warning' | 'critical';
export type CapabilityProviderPreflightReasonCode = string;
export type CapabilityProviderPreflightSourceNote = string;
export type CapabilityProviderPreflightNextAction = string;
export type CapabilityProviderPreflightMetadata = {
  [fieldName: string]: unknown;
};

export interface CapabilityProviderPreflightItem {
  provider: CapabilityProviderPreflightProvider;
  runner_mode: CapabilityProviderPreflightRunnerMode;
  status: CapabilityProviderPreflightStatus;
  severity: CapabilityProviderPreflightSeverity;
  reason_code: CapabilityProviderPreflightReasonCode;
  source_note: CapabilityProviderPreflightSourceNote;
  next_action: CapabilityProviderPreflightNextAction;
  metadata?: CapabilityProviderPreflightMetadata;
}

export type CapabilityProviderPreflightItemList = CapabilityProviderPreflightItem[];

export type CapabilityProviderPreflightStatusCounts = {
  ready?: number;
  skipped?: number;
  blocked?: number;
  [key: string]: number | undefined;
};

export interface CapabilityProviderPreflightResponse {
  generated_at: string;
  source_note: CapabilityProviderPreflightSourceNote;
  items: CapabilityProviderPreflightItemList;
  status_counts: CapabilityProviderPreflightStatusCounts;
}

function getAdminToken(): string | null {
  const result = readAdminTokenStorage();
  return result.ok ? result.value : null;
}

function extractAdminErrorMetadata(result: AdminApiResponseRawObject): AdminApiErrorMetadata {
  return {
    details: typeof result.details === 'string' ? result.details : undefined,
    source: typeof result.source === 'string' ? result.source : undefined,
  } satisfies AdminApiErrorMetadata;
}

function getStructuredAdminErrorSourceSegment(
  source: AdminApiErrorSource | undefined,
): AdminStructuredErrorSuffixSegment | undefined {
  if (source === undefined) {
    return undefined;
  }

  return `来源：${source}`;
}

function addStructuredAdminErrorSuffixSegment(
  segments: AdminStructuredErrorSuffixSegmentList,
  segment: AdminStructuredErrorSuffixSegment | undefined,
) {
  if (segment === undefined) {
    return;
  }

  segments.push(segment);
}

function materializeStructuredAdminErrorSuffixSegments(
  metadata: AdminApiErrorMetadata,
): AdminStructuredErrorSuffixSegmentList {
  const segments: AdminStructuredErrorSuffixSegmentList = [];
  const sourceSegment = getStructuredAdminErrorSourceSegment(metadata.source);

  addStructuredAdminErrorSuffixSegment(segments, sourceSegment);
  addStructuredAdminErrorSuffixSegment(segments, metadata.details);

  return segments;
}

function formatStructuredAdminErrorMessage(
  message: string,
  metadata: AdminApiErrorMetadata,
) {
  const suffixSegments = materializeStructuredAdminErrorSuffixSegments(metadata);
  const suffix = suffixSegments.join('；');
  return suffix ? `${message}（${suffix}）` : message;
}

async function parseAdminResponseBody(res: Response): Promise<AdminApiResponseRawObject> {
  const rawText = await res.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText) as AdminApiResponseRawObject;
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Admin response is not valid JSON';
    throw new AdminApiError(
      formatStructuredAdminErrorMessage(rawText || `请求失败：${res.status}`, {
        details,
        source: 'admin_api_client_response_parse',
      }),
      res.status,
      undefined,
      { details, source: 'admin_api_client_response_parse' },
    );
  }
}

function throwStructuredAdminApiError(
  result: AdminApiResponseRawObject,
  status: number,
  fallback: AdminApiErrorDetails,
): never {
  const metadata = extractAdminErrorMetadata(result);
  const message = (typeof result.error === 'string' ? result.error : undefined)
    || (typeof result.message === 'string' ? result.message : undefined)
    || fallback;

  throw new AdminApiError(
    formatStructuredAdminErrorMessage(message, metadata),
    status,
    result.data,
    metadata,
  );
}

function normalizeAdminSessionRole(rawRole?: string): AdminSessionRole {
  const role = rawRole?.trim() || '';
  if (role === 'admin' || role === 'super_admin') return role;
  return 'unknown';
}

function normalizeAdminProfile(rawProfile: AdminProfileRawResponse): AdminProfile {
  const rawRole = rawProfile.role?.trim() || '';
  return {
    ...rawProfile,
    role: normalizeAdminSessionRole(rawRole),
    raw_role: rawRole,
    must_change_password: rawProfile.must_change_password !== false,
    permission_codes: rawProfile.permission_codes || [],
  };
}

function hasAdminLoginToken(token: string): boolean {
  const hasToken = token.length > 0;
  return hasToken === true;
}

function canPersistAdminLoginStorage(token: string): boolean {
  const hasToken = hasAdminLoginToken(token);
  const hasBrowserWindow = typeof window !== 'undefined';
  return hasToken === true && hasBrowserWindow === true;
}

function hasAdminLoginProfileCacheInput(admin: AdminProfile): boolean {
  const hasAdminEmail = admin.email.length > 0;
  const hasAdminRole = admin.role.length > 0;
  return hasAdminEmail === true && hasAdminRole === true;
}

function getAdminLoginTokenStorageStatus(
  result: AdminAuthStorageResult | null,
): AdminAuthStorageStatus | undefined {
  const hasResult = result !== null;
  if (hasResult === false) {
    return undefined;
  }
  return result.ok === true ? 'saved' : result.status;
}

function getAdminLoginProfileCacheStatus(
  result: AdminAuthStorageResult | null,
): AdminAuthStorageStatus | undefined {
  const hasResult = result !== null;
  if (hasResult === false) {
    return undefined;
  }
  return result.ok === true ? 'saved' : result.status;
}

function getAdminLoginProfileCacheError(
  result: AdminAuthStorageResult | null,
): AdminAuthStorageDetails | undefined {
  const hasResult = result !== null;
  if (hasResult === false) {
    return undefined;
  }
  if (result.ok === true) {
    return undefined;
  }
  return result.message;
}

function getAdminLoginProfileCacheErrorSource(
  result: AdminAuthStorageResult | null,
): AdminAuthStorageSource | undefined {
  const hasResult = result !== null;
  if (hasResult === false) {
    return undefined;
  }
  if (result.ok === true) {
    return undefined;
  }
  return result.source;
}

function getAdminLoginProfileCacheErrorDetails(
  result: AdminAuthStorageResult | null,
): AdminAuthStorageDetails | undefined {
  const hasResult = result !== null;
  if (hasResult === false) {
    return undefined;
  }
  if (result.ok === true) {
    return undefined;
  }
  return result.details;
}

export function readAdminTokenStorage(): AdminAuthStorageResult<string | null> {
  if (typeof window === 'undefined') return { ok: true, value: null };
  try {
    return { ok: true, value: localStorage.getItem('admin_token') };
  } catch (error) {
    return buildAdminAuthStorageFailure(
      error,
      'read_failed',
      'local_storage',
      '浏览器拒绝读取 Admin 登录凭据',
    );
  }
}

export function persistAdminTokenStorage(token: string): AdminAuthStorageResult {
  if (typeof window === 'undefined') return { ok: true, value: undefined };
  try {
    localStorage.setItem('admin_token', token);
    return { ok: true, value: undefined };
  } catch (error) {
    return buildAdminAuthStorageFailure(
      error,
      'write_failed',
      'local_storage',
      '浏览器拒绝保存 Admin 登录凭据',
    );
  }
}

export function clearAdminTokenStorage(): AdminAuthStorageResult {
  if (typeof window === 'undefined') return { ok: true, value: undefined };
  try {
    localStorage.removeItem('admin_token');
    return { ok: true, value: undefined };
  } catch (error) {
    return buildAdminAuthStorageFailure(
      error,
      'clear_failed',
      'local_storage',
      '浏览器拒绝清理 Admin 登录凭据',
    );
  }
}

export function readCachedAdminProfile(): AdminAuthStorageResult<AdminProfileCache | null> {
  if (typeof window === 'undefined') return { ok: true, value: null };
  try {
    const raw = sessionStorage.getItem('admin_profile');
    if (!raw) return { ok: true, value: null };
    const parsed = JSON.parse(raw) as AdminProfileCacheRawPayload;
    if (!parsed.email || !parsed.role) return { ok: true, value: null };
    const rawRole = parsed.raw_role?.trim() || parsed.role.trim();
    return {
      ok: true,
      value: {
        email: parsed.email,
        role: normalizeAdminSessionRole(rawRole),
        raw_role: rawRole,
        must_change_password: parsed.must_change_password !== false,
        permission_codes: parsed.permission_codes || [],
      },
    };
  } catch (error) {
    return buildAdminAuthStorageFailure(
      error,
      'read_failed',
      'session_storage',
      '浏览器拒绝读取 Admin 管理员缓存',
    );
  }
}

export function persistCachedAdminProfile(profile: AdminProfileCache): AdminAuthStorageResult {
  if (typeof window === 'undefined') return { ok: true, value: undefined };
  try {
    sessionStorage.setItem('admin_profile', JSON.stringify(profile));
    return { ok: true, value: undefined };
  } catch (error) {
    return buildAdminAuthStorageFailure(
      error,
      'write_failed',
      'session_storage',
      '浏览器拒绝保存 Admin 管理员缓存',
    );
  }
}

export function clearCachedAdminProfile(): AdminAuthStorageResult {
  if (typeof window === 'undefined') return { ok: true, value: undefined };
  try {
    sessionStorage.removeItem('admin_profile');
    return { ok: true, value: undefined };
  } catch (error) {
    return buildAdminAuthStorageFailure(
      error,
      'clear_failed',
      'session_storage',
      '浏览器拒绝清理 Admin 管理员缓存',
    );
  }
}

function buildAdminRequestHeaders(
  token: string | null,
  initialHeaders?: HeadersInit,
): AdminRequestHeaderMap {
  const headers: AdminRequestHeaderMap = {
    'Content-Type': 'application/json',
  };

  if (initialHeaders) {
    for (const [key, value] of new Headers(initialHeaders)) {
      headers[key] = value;
    }
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers = buildAdminRequestHeaders(token, options.headers);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : '浏览器无法连接 Admin Next API 代理';
    throw new AdminApiError(
      formatStructuredAdminErrorMessage('Admin API 请求失败', {
        details,
        source: 'admin_api_client',
      }),
      0,
      undefined,
      { details, source: 'admin_api_client' },
    );
  }

  const data = await parseAdminResponseBody(res);

  if (!res.ok) {
    throwStructuredAdminApiError(data, res.status, `请求失败：${res.status}`);
  }

  if (data.success === false) {
    throwStructuredAdminApiError(data, -1, 'Admin API 请求失败');
  }

  if (data.success === true && data.data !== undefined) return data.data as T;
  return data as T;
}

// Auth
export const adminAuthApi = {
  login: async (data: AdminLoginRequest): Promise<AdminLoginResponse> => {
    const loginResponse = await adminRequest<AdminLoginRawResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const token = loginResponse.token;
    const admin = normalizeAdminProfile(loginResponse.admin);
    let tokenStorageResult: AdminAuthStorageResult | null = null;
    let profileCacheResult: AdminAuthStorageResult | null = null;
    const canPersistStorage = canPersistAdminLoginStorage(token);
    if (canPersistStorage === true) {
      tokenStorageResult = persistAdminTokenStorage(token);
      if (tokenStorageResult.ok === false) {
        throw new AdminApiError(
          '登录成功但 Admin 登录凭据保存失败',
          0,
          undefined,
          { details: tokenStorageResult.details, source: tokenStorageResult.source },
        );
      }
      const hasProfileCacheInput = hasAdminLoginProfileCacheInput(admin);
      if (hasProfileCacheInput === true) {
        profileCacheResult = persistCachedAdminProfile({
          email: admin.email,
          role: admin.role,
          raw_role: admin.raw_role,
          must_change_password: admin.must_change_password,
          permission_codes: admin.permission_codes,
        });
      }
    }
    return {
      token,
      admin,
      expires_in: loginResponse.expires_in,
      token_storage_status: getAdminLoginTokenStorageStatus(tokenStorageResult),
      profile_cache_status: getAdminLoginProfileCacheStatus(profileCacheResult),
      profile_cache_error: getAdminLoginProfileCacheError(profileCacheResult),
      profile_cache_error_source: getAdminLoginProfileCacheErrorSource(profileCacheResult),
      profile_cache_error_details: getAdminLoginProfileCacheErrorDetails(profileCacheResult),
    };
  },

  getProfile: async (): Promise<AdminProfile> => {
    const profile = await adminRequest<AdminProfileRawResponse>('/auth/profile');
    return normalizeAdminProfile(profile);
  },

  changePassword: async (data: AdminPasswordChangeRequest): Promise<AdminLoginResponse> => {
    const response = await adminRequest<AdminLoginRawResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const admin = normalizeAdminProfile(response.admin);
    const tokenStorageResult = persistAdminTokenStorage(response.token);
    if (tokenStorageResult.ok === false) {
      throw new AdminApiError(
        '密码已修改，但新登录凭据保存失败，请重新登录',
        0,
        undefined,
        { details: tokenStorageResult.details, source: tokenStorageResult.source },
      );
    }
    const profileCacheResult = persistCachedAdminProfile({
      email: admin.email,
      role: admin.role,
      raw_role: admin.raw_role,
      must_change_password: admin.must_change_password,
      permission_codes: admin.permission_codes,
    });
    return {
      token: response.token,
      admin,
      expires_in: response.expires_in,
      token_storage_status: 'saved',
      profile_cache_status: getAdminLoginProfileCacheStatus(profileCacheResult),
      profile_cache_error: getAdminLoginProfileCacheError(profileCacheResult),
      profile_cache_error_source: getAdminLoginProfileCacheErrorSource(profileCacheResult),
      profile_cache_error_details: getAdminLoginProfileCacheErrorDetails(profileCacheResult),
    };
  },

  logout: () => {
    return {
      token: clearAdminTokenStorage(),
      profile: clearCachedAdminProfile(),
    };
  },

  getCachedProfile: () => {
    const result = readCachedAdminProfile();
    return result.ok ? result.value : null;
  },
  readTokenStorage: readAdminTokenStorage,
  readCachedProfileStorage: readCachedAdminProfile,
  persistCachedProfile: persistCachedAdminProfile,
  clearTokenStorage: clearAdminTokenStorage,
  clearCachedProfile: clearCachedAdminProfile,
};

// LLM Providers
export const adminLLMApi = {
  listProviders: async (): Promise<AdminLLMProvidersResponse> => {
    const data = await adminRequest<AdminLLMProvidersResponse>('/llm/providers');
    return {
      providers: data.providers || [],
      default_id: data.default_id,
      default_name: data.default_name,
    };
  },

  getProvider: async (id: AdminLLMProviderId): Promise<LLMProvider> => {
    return adminRequest<LLMProvider>(`/llm/providers/${id}`);
  },

  createProvider: async (data: LLMProviderCreate): Promise<LLMProvider> => {
    return adminRequest<LLMProvider>('/llm/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProvider: async (id: AdminLLMProviderId, data: Partial<LLMProviderCreate>): Promise<LLMProvider> => {
    return adminRequest<LLMProvider>(`/llm/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteProvider: async (id: AdminLLMProviderId): Promise<void> => {
    return adminRequest<void>(`/llm/providers/${id}`, {
      method: 'DELETE',
    });
  },

  setDefault: async (id: AdminLLMProviderId): Promise<void> => {
    return adminRequest<void>(`/llm/providers/${id}/default`, {
      method: 'PUT',
    });
  },

  discoverModels: async (id: AdminLLMProviderId): Promise<LLMProviderModelDiscoveryResult> => {
    return adminRequest<LLMProviderModelDiscoveryResult>(`/llm/providers/${id}/models/discover`, {
      method: 'POST',
    });
  },

  reload: async (): Promise<LLMReloadResponse> => {
    return adminRequest<LLMReloadResponse>('/llm/providers/reload', {
      method: 'POST',
    });
  },

  testConnection: async (
    provider: AIModelProvider,
    model: AIModelName,
  ): Promise<AdminLLMProviderConnectionTestResponse> => {
    return adminRequest<AdminLLMProviderConnectionTestResponse>('/llm/providers/test', {
      method: 'POST',
      body: JSON.stringify({ provider, model }),
    });
  },
};

// System Config
export const adminConfigApi = {
  list: async (): Promise<SystemConfig[]> => {
    return adminRequest<SystemConfig[]>('/config');
  },

  update: async (key: AdminSystemConfigKey, value: string): Promise<SystemConfig> => {
    return adminRequest<SystemConfig>(`/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },
};

export const adminPermissionsApi = {
  list: async (): Promise<AdminPermission[]> => {
    return adminRequest<AdminPermission[]>('/permissions');
  },
};

export const adminRolesApi = {
  list: async (): Promise<AdminRole[]> => {
    const roles = await adminRequest<AdminRoleRawResponse[]>('/roles');
    return normalizeAdminRoleList(roles);
  },

  create: async (data: {
    name: string;
    display_name: string;
    description?: string;
    status?: AdminRoleMutableStatus;
    permission_ids: AdminPermissionIdList;
  }): Promise<AdminRole> => {
    const role = await adminRequest<AdminRoleRawResponse>('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return normalizeAdminRole(role);
  },

  update: async (id: AdminRoleId, data: {
    display_name?: string;
    description?: string;
    status?: AdminRoleMutableStatus;
    permission_ids?: AdminPermissionIdList;
  }): Promise<AdminRole> => {
    const role = await adminRequest<AdminRoleRawResponse>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return normalizeAdminRole(role);
  },

  delete: async (id: AdminRoleId): Promise<void> => {
    await adminRequest(`/roles/${id}`, {
      method: 'DELETE',
    });
  },
};

function normalizeAdminRoleStatus(rawStatus?: string): AdminRoleStatus {
  const status = rawStatus?.trim() || '';
  if (status === '' || status === 'active') return 'active';
  if (status === 'disabled') return 'disabled';
  return 'unknown';
}

function normalizeAdminRole(rawRole: AdminRoleRawResponse): AdminRole {
  const rawStatus = rawRole.status?.trim() || '';
  return {
    ...rawRole,
    status: normalizeAdminRoleStatus(rawStatus),
    raw_status: rawStatus,
  };
}

function normalizeAdminRoleList(roles: AdminRoleRawResponse[]): AdminRoleList {
  const normalizedRoles: AdminRoleList = [];

  for (const role of roles) {
    normalizedRoles.push(normalizeAdminRole(role));
  }

  return normalizedRoles;
}

function normalizeAdminManagerStatus(rawStatus?: string): AdminManagerStatus {
  const status = rawStatus?.trim() || '';
  if (status === '' || status === 'active') return 'active';
  if (status === 'disabled') return 'disabled';
  return 'unknown';
}

function normalizeAdminManagerSystemRole(rawRole?: string): AdminManagerSystemRole {
  const role = rawRole?.trim() || '';
  if (role === 'admin' || role === 'super_admin') return role;
  return 'unknown';
}

function normalizeAdminManager(rawManager: AdminManagerRawResponse): AdminManager {
  const rawStatus = rawManager.status?.trim() || '';
  const rawRole = rawManager.role?.trim() || '';
  const assignedRoles = normalizeAdminManagerAssignedRoles(rawManager.assigned_roles);

  return {
    ...rawManager,
    role: normalizeAdminManagerSystemRole(rawRole),
    status: normalizeAdminManagerStatus(rawStatus),
    raw_role: rawRole,
    raw_status: rawStatus,
    must_change_password: rawManager.must_change_password !== false,
    assigned_roles: assignedRoles,
  };
}

function normalizeAdminManagerAssignedRoles(
  roles: AdminRoleRawResponse[] | undefined,
): AdminManagerAssignedRoleList | undefined {
  if (roles === undefined) {
    return undefined;
  }

  return normalizeAdminRoleList(roles);
}

function normalizeAdminManagerList(admins: AdminManagerRawResponse[]): AdminManagerList {
  const normalizedManagers: AdminManagerList = [];

  for (const admin of admins) {
    normalizedManagers.push(normalizeAdminManager(admin));
  }

  return normalizedManagers;
}

function normalizeAdminManagerListResponse(data: AdminManagerListRawResponse): AdminManagerListResponse {
  const admins = normalizeAdminManagerList(data.admins);

  return {
    ...data,
    admins,
  };
}

export const adminManagersApi = {
  list: async (): Promise<AdminManagerListResponse> => {
    const data = await adminRequest<AdminManagerListRawResponse>('/admins');
    return normalizeAdminManagerListResponse(data);
  },

  update: async (id: AdminManagerId, data: {
    username?: string;
    status?: AdminManagerMutableStatus;
    role?: AdminManagerMutableSystemRole;
    role_ids?: AdminRoleIdList;
  }): Promise<AdminManager> => {
    const manager = await adminRequest<AdminManagerRawResponse>(`/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return normalizeAdminManager(manager);
  },

  delete: async (id: AdminManagerId): Promise<void> => {
    await adminRequest(`/admins/${id}`, {
      method: 'DELETE',
    });
  },
};

// Audit Log
export const adminAuditApi = {
  list: async (params?: { limit?: number; offset?: number }): Promise<AdminAuditListResponse> => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return adminRequest<AdminAuditListResponse>(`/audit${qs ? '?' + qs : ''}`);
  },
};

function normalizeAdminUserStatus(rawStatus?: string): AdminUserStatus {
  const status = rawStatus?.trim() || '';
  if (status === '' || status === 'active') return 'active';
  if (status === 'disabled') return 'disabled';
  if (status === 'deleted') return 'deleted';
  return 'unknown';
}

function normalizeAdminUserRole(rawRole?: string): AdminUserRole {
  const role = rawRole?.trim() || '';
  if (role === 'user' || role === 'admin' || role === 'super_admin') return role;
  return 'unknown';
}

function normalizeAdminUser(rawUser: AdminUserRawResponse): AdminUser {
  const rawStatus = rawUser.status?.trim() || '';
  const rawRole = rawUser.role?.trim() || '';
  return {
    ...rawUser,
    role: normalizeAdminUserRole(rawRole),
    status: normalizeAdminUserStatus(rawStatus),
    raw_role: rawRole,
    raw_status: rawStatus,
  };
}

function normalizeAdminUserList(users: AdminUserRawResponse[]): AdminUserList {
  const normalizedUsers: AdminUserList = [];

  for (const user of users) {
    normalizedUsers.push(normalizeAdminUser(user));
  }

  return normalizedUsers;
}

function normalizeAdminUserListResponse(data: AdminUserListRawResponse): AdminUser[] {
  return normalizeAdminUserList(data.users);
}

// Users
export const adminUsersApi = {
  list: async (): Promise<AdminUser[]> => {
    const data = await adminRequest<AdminUserListRawResponse>('/users');
    return normalizeAdminUserListResponse(data);
  },

  update: async (id: AdminUserId, data: { role?: AdminUserMutableRole; status?: AdminUserMutableStatus }): Promise<void> => {
    return adminRequest<void>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: AdminUserId): Promise<void> => {
    return adminRequest<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

export const adminProjectsApi = {
  list: async (params?: { page?: number; pageSize?: number }): Promise<AdminProjectsResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return adminRequest<AdminProjectsResponse>(`/projects${qs ? '?' + qs : ''}`);
  },
};

export const adminCapabilityApi = {
  getProviderPreflight: async (): Promise<CapabilityProviderPreflightResponse> => {
    return adminRequest<CapabilityProviderPreflightResponse>('/capability/provider-preflight');
  },
};

export const adminEnterpriseApi = {
  getSsoDiscoveryReadiness: async (): Promise<AdminEnterpriseSsoDiscoveryReadinessResponse> => {
    return adminRequest<AdminEnterpriseSsoDiscoveryReadinessResponse>('/enterprise/sso-discovery-readiness');
  },

  getPrivateDeploymentReadiness: async (): Promise<AdminEnterprisePrivateDeploymentReadinessResponse> => {
    return adminRequest<AdminEnterprisePrivateDeploymentReadinessResponse>('/enterprise/private-deployment-readiness');
  },

  getCommercialReadiness: async (): Promise<AdminEnterpriseCommercialReadinessResponse> => {
    return adminRequest<AdminEnterpriseCommercialReadinessResponse>('/enterprise/commercial-readiness');
  },

  getOrganizationReadiness: async (): Promise<AdminEnterpriseOrganizationReadinessResponse> => {
    return adminRequest<AdminEnterpriseOrganizationReadinessResponse>('/enterprise/organization-readiness');
  },

  getProjectOwnershipReadiness: async (): Promise<AdminEnterpriseProjectOwnershipReadinessResponse> => {
    return adminRequest<AdminEnterpriseProjectOwnershipReadinessResponse>('/enterprise/project-ownership-readiness');
  },

  getProjectOwnershipPreflight: async (): Promise<AdminEnterpriseProjectOwnershipPreflightResponse> => {
    return adminRequest<AdminEnterpriseProjectOwnershipPreflightResponse>('/enterprise/project-ownership-preflight');
  },

  getProjectOwnershipMappings: async (): Promise<AdminEnterpriseProjectOwnershipMappingsResponse> => {
    return adminRequest<AdminEnterpriseProjectOwnershipMappingsResponse>('/enterprise/project-ownership-mappings');
  },

  getProjectOwnershipOwnerGuardReadiness: async (): Promise<AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse> => {
    return adminRequest<AdminEnterpriseProjectOwnershipOwnerGuardReadinessResponse>('/enterprise/project-ownership-owner-guard-readiness');
  },

  getProjectAccessGuardSwitchReadiness: async (): Promise<AdminEnterpriseProjectAccessGuardSwitchReadinessResponse> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardSwitchReadinessResponse>('/enterprise/project-access-guard-switch-readiness');
  },

  getProjectAccessGuardAuthorizationDryRunEvidence: async (): Promise<AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceResponse>('/enterprise/project-access-guard-authorization-dry-run');
  },

  getProjectAccessGuardActivationReadiness: async (): Promise<AdminEnterpriseProjectAccessGuardActivationReadinessResponse> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardActivationReadinessResponse>('/enterprise/project-access-guard-activation-readiness');
  },

  getProjectAccessGuardActivationAuditReadiness: async (): Promise<AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardActivationAuditReadinessResponse>('/enterprise/project-access-guard-activation-audit-readiness');
  },

  getAuditCoverageReadiness: async (): Promise<AdminEnterpriseAuditCoverageReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditCoverageReadinessResponse>('/enterprise/audit-coverage-readiness');
  },

  getAuditExportReadiness: async (): Promise<AdminEnterpriseAuditExportReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportReadinessResponse>('/enterprise/audit-export-readiness');
  },

  getAuditExportQueryReadiness: async (): Promise<AdminEnterpriseAuditExportQueryReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportQueryReadinessResponse>('/enterprise/audit-export-query-readiness');
  },

  getAuditExportTaskPreflightReadiness: async (): Promise<AdminEnterpriseAuditExportTaskPreflightReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportTaskPreflightReadinessResponse>('/enterprise/audit-export-task-preflight-readiness');
  },

  getAuditExportFileFormatReadiness: async (): Promise<AdminEnterpriseAuditExportFileFormatReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportFileFormatReadinessResponse>('/enterprise/audit-export-file-format-readiness');
  },

  getAuditExportFileGeneratorReadiness: async (): Promise<AdminEnterpriseAuditExportFileGeneratorReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportFileGeneratorReadinessResponse>('/enterprise/audit-export-file-generator-readiness');
  },

  getAuditExportTaskCreateRequestReadiness: async (): Promise<AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportTaskCreateRequestReadinessResponse>('/enterprise/audit-export-task-create-request-readiness');
  },

  getAuditExportTaskPersistenceReadiness: async (): Promise<AdminEnterpriseAuditExportTaskPersistenceReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportTaskPersistenceReadinessResponse>('/enterprise/audit-export-task-persistence-readiness');
  },

  listAuditExportTasks: async (): Promise<AdminEnterpriseAuditExportTaskListResult> => {
    return adminRequest<AdminEnterpriseAuditExportTaskListResult>('/enterprise/audit-export-tasks');
  },

  getAuditExportWorkerReadiness: async (): Promise<AdminEnterpriseAuditExportWorkerReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerReadinessResponse>('/enterprise/audit-export-worker-readiness');
  },

  getAuditExportWorkerExecutionRequestReadiness: async (): Promise<AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionRequestReadinessResponse>('/enterprise/audit-export-worker-execution-request-readiness');
  },

  getAuditExportWorkerExecutionRequestPersistenceReadiness: async (): Promise<AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionRequestPersistenceReadinessResponse>('/enterprise/audit-export-worker-execution-request-persistence-readiness');
  },

  getAuditExportWorkerExecutionDryRunReadiness: async (): Promise<AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionDryRunReadinessResponse>('/enterprise/audit-export-worker-execution-dry-run-readiness');
  },

  getAuditExportWorkerExecutionArtifactReadiness: async (): Promise<AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionArtifactReadinessResponse>('/enterprise/audit-export-worker-execution-artifact-readiness');
  },

  persistAuditExportWorkerExecutionRequest: async (
    data: AdminEnterpriseAuditExportWorkerExecutionRequestPersistInput,
  ): Promise<AdminEnterpriseAuditExportWorkerExecutionRequestPersistResult> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionRequestPersistResult>('/enterprise/audit-export-worker-execution-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  dryRunAuditExportWorkerExecutionRequest: async (
    data: AdminEnterpriseAuditExportWorkerExecutionDryRunInput,
  ): Promise<AdminEnterpriseAuditExportWorkerExecutionDryRunResult> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionDryRunResult>('/enterprise/audit-export-worker-execution-dry-run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  generateAuditExportWorkerExecutionArtifact: async (
    data: AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateInput,
  ): Promise<AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateResult> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionArtifactGenerateResult>('/enterprise/audit-export-worker-execution-artifact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAuditExportWorkerExecutionOutputStorageReadiness: async (): Promise<AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionOutputStorageReadinessResponse>('/enterprise/audit-export-worker-execution-output-storage-readiness');
  },

  storeAuditExportWorkerExecutionOutputStorage: async (
    data: AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreInput,
  ): Promise<AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreResult> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionOutputStorageStoreResult>('/enterprise/audit-export-worker-execution-output-storage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAuditExportTaskStatusTransitionReadiness: async (): Promise<AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportTaskStatusTransitionReadinessResponse>('/enterprise/audit-export-task-status-transition-readiness');
  },

  getAuditExportWorkerExecutionTaskCompletionReadiness: async (): Promise<AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionTaskCompletionReadinessResponse>('/enterprise/audit-export-worker-execution-task-completion-readiness');
  },

  completeAuditExportWorkerExecutionTask: async (
    data: AdminEnterpriseAuditExportWorkerExecutionTaskCompletionInput,
  ): Promise<AdminEnterpriseAuditExportWorkerExecutionTaskCompletionResult> => {
    return adminRequest<AdminEnterpriseAuditExportWorkerExecutionTaskCompletionResult>('/enterprise/audit-export-worker-execution-task-completions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAuditExportArchiveExpirationReadiness: async (): Promise<AdminEnterpriseAuditExportArchiveExpirationReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportArchiveExpirationReadinessResponse>('/enterprise/audit-export-archive-expiration-readiness');
  },

  getAuditExportDeliveryReportReadiness: async (): Promise<AdminEnterpriseAuditExportDeliveryReportReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportDeliveryReportReadinessResponse>('/enterprise/audit-export-delivery-report-readiness');
  },

  getAuditExportDeliveryReportCompletedTaskReadiness: async (): Promise<AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportDeliveryReportCompletedTaskReadinessResponse>('/enterprise/audit-export-delivery-report-completed-task-readiness');
  },

  getAuditExportDeliveryReportGenerateRequestReadiness: async (): Promise<AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportDeliveryReportGenerateRequestReadinessResponse>('/enterprise/audit-export-delivery-report-generate-request-readiness');
  },

  getAuditExportDeliveryReportStorageReadiness: async (): Promise<AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportDeliveryReportStorageReadinessResponse>('/enterprise/audit-export-delivery-report-storage-readiness');
  },

  getAuditExportDeliveryReportStoredReadiness: async (): Promise<AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditExportDeliveryReportStoredReadinessResponse>('/enterprise/audit-export-delivery-report-stored-readiness');
  },

  generateAuditExportDeliveryReport: async (
    data: AdminEnterpriseAuditExportDeliveryReportGenerateInput,
  ): Promise<AdminEnterpriseAuditExportDeliveryReportGenerateResult> => {
    return adminRequest<AdminEnterpriseAuditExportDeliveryReportGenerateResult>('/enterprise/audit-export-delivery-report', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  storeAuditExportDeliveryReport: async (
    data: AdminEnterpriseAuditExportDeliveryReportStoreInput,
  ): Promise<AdminEnterpriseAuditExportDeliveryReportStoreResult> => {
    return adminRequest<AdminEnterpriseAuditExportDeliveryReportStoreResult>('/enterprise/audit-export-delivery-report-storage', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createAuditExportTask: async (data: AdminEnterpriseAuditExportTaskCreateInput): Promise<AdminEnterpriseAuditExportTaskCreateResult> => {
    return adminRequest<AdminEnterpriseAuditExportTaskCreateResult>('/enterprise/audit-export-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  transitionAuditExportTaskStatus: async (
    data: AdminEnterpriseAuditExportTaskStatusTransitionInput,
  ): Promise<AdminEnterpriseAuditExportTaskStatusTransitionResult> => {
    return adminRequest<AdminEnterpriseAuditExportTaskStatusTransitionResult>('/enterprise/audit-export-task-status-transitions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAuditRetentionReadiness: async (): Promise<AdminEnterpriseAuditRetentionReadinessResponse> => {
    return adminRequest<AdminEnterpriseAuditRetentionReadinessResponse>('/enterprise/audit-retention-readiness');
  },

  recordProjectAccessGuardActivationManualApproval: async (
    data: AdminEnterpriseProjectAccessGuardActivationManualApprovalInput,
  ): Promise<AdminEnterpriseProjectAccessGuardActivationManualApprovalResult> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardActivationManualApprovalResult>(
      '/enterprise/project-access-guard-activation/manual-approval',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  recordProjectAccessGuardActivationExecution: async (
    data: AdminEnterpriseProjectAccessGuardActivationExecutionInput,
  ): Promise<AdminEnterpriseProjectAccessGuardActivationExecutionResult> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardActivationExecutionResult>(
      '/enterprise/project-access-guard-activation/execution',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  recordProjectAccessGuardPostActivationValidation: async (
    data: AdminEnterpriseProjectAccessGuardPostActivationValidationInput,
  ): Promise<AdminEnterpriseProjectAccessGuardPostActivationValidationResult> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardPostActivationValidationResult>(
      '/enterprise/project-access-guard-activation/post-validation',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  recordProjectAccessGuardRollbackEvidence: async (
    data: AdminEnterpriseProjectAccessGuardRollbackEvidenceInput,
  ): Promise<AdminEnterpriseProjectAccessGuardRollbackEvidenceResult> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardRollbackEvidenceResult>(
      '/enterprise/project-access-guard-activation/rollback-evidence',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  activateProjectAccessGuardAuthorization: async (
    data: AdminEnterpriseProjectAccessGuardAuthorizationActivationInput,
  ): Promise<AdminEnterpriseProjectAccessGuardAuthorizationActivationResult> => {
    return adminRequest<AdminEnterpriseProjectAccessGuardAuthorizationActivationResult>(
      '/enterprise/project-access-guard-activation/activate',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  migrateProjectOwnership: async (data: AdminEnterpriseProjectOwnershipMigrateInput): Promise<AdminEnterpriseProjectOwnershipMigrationResult> => {
    return adminRequest<AdminEnterpriseProjectOwnershipMigrationResult>('/enterprise/project-ownership-migrations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listOrganizations: async (): Promise<AdminEnterpriseOrganization[]> => {
    return adminRequest<AdminEnterpriseOrganization[]>('/enterprise/organizations');
  },

  listTeams: async (): Promise<AdminEnterpriseTeam[]> => {
    return adminRequest<AdminEnterpriseTeam[]>('/enterprise/teams');
  },

  createOrganization: async (data: AdminEnterpriseOrganizationCreateInput): Promise<AdminEnterpriseOrganization> => {
    return adminRequest<AdminEnterpriseOrganization>('/enterprise/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createTeam: async (data: AdminEnterpriseTeamCreateInput): Promise<AdminEnterpriseTeam> => {
    return adminRequest<AdminEnterpriseTeam>('/enterprise/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  bindMember: async (data: AdminEnterpriseMemberBindInput): Promise<AdminEnterpriseMember> => {
    return adminRequest<AdminEnterpriseMember>('/enterprise/members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
