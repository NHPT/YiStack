import type { ProjectRuntimeStatus } from '@/lib/api';
import type {
  ChatMessageRole as SharedChatMessageRole,
  FileAttachment,
  FileNode,
  GitBranchCompare,
  GitBranchCompareCommit,
  GitBranchCompareFile,
  GitCommit,
  ProjectRuntimeContainerStatus,
  GitWorktreeCleanlinessStatus as ApiGitWorktreeCleanlinessStatus,
} from '@/lib/types';
import type { Plan } from '@/lib/api';
import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type {
  WorkspaceEngineeringStateSnapshot,
  WorkspaceGateResult,
} from '@/lib/workspace/engineering-state';
import type { WorkspaceBackendWorkflowStage } from '@/lib/workspace/workflow-contract';
import type {
  WorkspaceGenerationStateLocalDetails,
  WorkspaceGenerationStateStorageSource,
} from '@/lib/workspace/workspace-generation-state-local-errors';
import type {
  WorkspaceStreamEventData,
  WorkspaceWorkflowStepEventData,
} from './workspace-orchestration-shared';
import type {
  ProjectListApiHealthDetails,
  ProjectListApiHealthReasonCode,
  ProjectListApiHealthSource,
  ProjectListApiHealthStatus,
  ProjectListAuthRecoveryDetails,
  ProjectListAuthRecoveryReasonCode,
  ProjectListAuthRecoverySource,
  ProjectListAuthRecoveryStatus,
  ProjectListBackendHealthProbeBackendStatus,
  ProjectListBackendHealthProbeDetails,
  ProjectListBackendHealthProbeReasonCode,
  ProjectListBackendHealthProbeService,
  ProjectListBackendHealthProbeSource,
  ProjectListBackendHealthProbeStatus,
} from '@/lib/workspace/project-list-api-health';
import type { RuntimeHealthRestartReasonCode } from '@/lib/workspace/runtime-health-diagnostics';
import type {
  CapabilityProviderPreflightProvider,
  CapabilityProviderPreflightReasonCode,
  CapabilityProviderPreflightRunnerMode,
  CapabilityProviderPreflightSeverity,
  CapabilityProviderPreflightStatus,
  AdminLLMProviderId,
  AdminLLMProviderType,
  AdminEnterpriseAuditCoverageReadinessStatus,
  AdminEnterpriseAuditExportReadinessStatus,
  AdminEnterpriseAuditExportQueryReadinessStatus,
  AdminEnterpriseAuditExportTaskPreflightReadinessStatus,
  AdminEnterpriseAuditExportFileFormatReadinessStatus,
  AdminEnterpriseAuditExportFileGeneratorReadinessStatus,
  AdminEnterpriseAuditExportTaskCreateRequestReadinessStatus,
  AdminEnterpriseAuditExportTaskPersistenceReadinessStatus,
  AdminEnterpriseAuditRetentionReadinessStatus,
  AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityStatus,
  AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityStatus,
  AdminEnterpriseProjectAccessGuardActivationAuditReadinessStatus,
  AdminEnterpriseOrganizationReadinessStatus,
  AdminEnterpriseProjectAccessGuardActivationReadinessStatus,
  AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceStatus,
  AdminEnterpriseProjectAccessGuardSwitchReadinessStatus,
  AdminEnterpriseOrganizationId,
  AdminEnterpriseProjectOwnershipOwnerGuardReadinessStatus,
  AdminEnterpriseProjectOwnershipMappingStatus,
  AdminEnterpriseProjectOwnershipPreflightStatus,
  AdminEnterpriseProjectOwnershipReadinessStatus,
  AdminEnterpriseSsoConfigKey,
  AdminEnterpriseTeamId,
  AdminProjectRecordId,
  AdminUserId,
  AdminPromptConfigKey,
  AdminSystemConfigKey,
  AdminSystemConfigPublicFlag,
  AdminSystemConfigValueType,
  AdminTemplateConfigKey,
} from '@/lib/admin/api';

export type ChatMode = 'discuss' | 'implement';
export type IDETab = 'foundation' | 'explorer' | 'preview' | 'git' | 'debug' | 'terminal';
export type WorkspaceBrowserDevice = 'desktop' | 'mobile' | 'tablet' | 'tablet-landscape';
export type WorkspacePanelSurface = 'desktop' | 'mobile';
export type WorkspacePreviewUrlSurface = WorkspacePanelSurface | 'both';
export type WorkspaceMobileView = 'chat' | 'ide';
export type WorkspaceGenerationMode = ChatMode | 'foundation';
export type WorkspaceEventMessage = string;
export type WorkspaceEventMessageFallback = WorkspaceEventMessage;
export type TerminalThemeMode = 'dark' | 'light';

export type WorkspaceIdeShellSnapshotStatus = 'project_missing' | 'tab_unavailable' | 'foundation' | 'explorer' | 'preview' | 'git' | 'debug' | 'terminal' | 'mobile_editor';

export type WorkspaceIdeShellSnapshotSource = 'workspace_project' | 'tab_state' | 'runtime_capability' | 'mobile_editor';

export type WorkspaceIdeShellSnapshot = {
  status: WorkspaceIdeShellSnapshotStatus;
  source: WorkspaceIdeShellSnapshotSource;
  surface: WorkspacePanelSurface;
  activeTab: IDETab;
  activeTabAvailable: boolean;
  tabCount: number;
  hasProject: boolean;
  runtimeTabsAvailable: boolean;
  hasMobileEditor: boolean;
  fileCount: number;
  gitCommitCount: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceGitTabBadgeSnapshotStatus = 'empty' | 'fresh' | 'stale_with_cache' | 'stale_without_cache' | 'detail_stale' | 'selected';

export type WorkspaceGitTabBadgeSnapshotSource = 'commit_list' | 'list_status' | 'detail_status' | 'selection' | 'tab_badge';

export type WorkspaceGitTabBadgeSnapshot = {
  status: WorkspaceGitTabBadgeSnapshotStatus;
  source: WorkspaceGitTabBadgeSnapshotSource;
  surface: WorkspacePanelSurface;
  badgeCount: number;
  hasCommits: boolean;
  hasSelectedCommit: boolean;
  selectedHash: string;
  listStatus: GitCommitListStatusValue | 'unknown';
  detailStatus: GitCommitDetailStatusValue | 'none';
  canOpenGitTab: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceMobileShellSnapshotStatus = 'chat_active' | 'ide_active' | 'chat_panel_missing' | 'ide_panel_missing';

export type WorkspaceMobileShellSnapshotSource = 'mobile_view' | 'panel_mount' | 'bottom_navigation';

export type WorkspaceMobileShellVisiblePanel = 'chat' | 'ide' | 'missing';

export type WorkspaceMobileShellSnapshot = {
  status: WorkspaceMobileShellSnapshotStatus;
  source: WorkspaceMobileShellSnapshotSource;
  activeView: WorkspaceMobileView;
  visiblePanel: WorkspaceMobileShellVisiblePanel;
  chatPanelMounted: boolean;
  idePanelMounted: boolean;
  canOpenChat: boolean;
  canOpenIde: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type TerminalConnectionSnapshotStatus = 'idle' | 'ticket_requesting' | 'websocket_connecting' | 'pty_ready' | 'manual_closed' | 'remote_closed' | 'input_send_failed' | 'error';

export type TerminalConnectionSnapshotSource = 'workspace_project' | 'terminal_ticket' | 'terminal_websocket' | 'container_pty' | 'user_action';

export type TerminalConnectionSnapshot = {
  status: TerminalConnectionSnapshotStatus;
  source: TerminalConnectionSnapshotSource;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type TerminalPanelSnapshotStatus = 'project_missing' | 'inactive' | 'mounting' | 'starting' | 'ready' | 'closed' | 'error';

export type TerminalPanelSnapshotSource = 'workspace_project' | 'panel_visibility' | 'xterm_mount' | 'connection_snapshot' | 'user_action';

export type TerminalPanelConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';

export type TerminalPanelSnapshot = {
  status: TerminalPanelSnapshotStatus;
  source: TerminalPanelSnapshotSource;
  hasProject: boolean;
  isActive: boolean;
  terminalMounted: boolean;
  socketReady: boolean;
  canReconnect: boolean;
  canClose: boolean;
  theme: TerminalThemeMode;
  hasErrorBanner: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type TerminalCloseConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type TerminalCloseConfirmationSnapshotSource = 'dialog_state' | 'terminal_session';

export type TerminalCloseConfirmationSnapshotAction = 'none' | 'close_terminal';

export type TerminalCloseConfirmationRiskLevel = 'none' | 'low' | 'medium';

export type TerminalCloseConfirmationSnapshot = {
  status: TerminalCloseConfirmationSnapshotStatus;
  source: TerminalCloseConfirmationSnapshotSource;
  action: TerminalCloseConfirmationSnapshotAction;
  hasProject: boolean;
  socketReady: boolean;
  inputBufferLength: number;
  hasPendingInput: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: TerminalCloseConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspacePageHeaderSnapshotStatus = 'project_named' | 'project_fallback';

export type WorkspacePageHeaderSnapshotSource = 'project_info' | 'route_fallback' | 'header_actions';

export type WorkspacePageHeaderSnapshot = {
  status: WorkspacePageHeaderSnapshotStatus;
  source: WorkspacePageHeaderSnapshotSource;
  surface: WorkspacePanelSurface;
  displayName: string;
  hasProjectName: boolean;
  canGoBack: boolean;
  canClearChat: boolean;
  hasSettingsAction: boolean;
  homeLinkAvailable: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ClearChatConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type ClearChatConfirmationSnapshotSource = 'header_action' | 'dialog_state';

export type ClearChatConfirmationSnapshotAction = 'none' | 'clear_chat';

export type ClearChatConfirmationSurface = 'desktop' | 'mobile';

export type ClearChatConfirmationRiskLevel = 'none' | 'medium';

export type ClearChatConfirmationSnapshot = {
  status: ClearChatConfirmationSnapshotStatus;
  source: ClearChatConfirmationSnapshotSource;
  action: ClearChatConfirmationSnapshotAction;
  surface: ClearChatConfirmationSurface;
  projectName: string | null;
  hasProjectName: boolean;
  resetsMessages: boolean;
  resetsPreviewUrl: boolean;
  resetsEditorBuffers: boolean;
  resetsOpenFiles: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: ClearChatConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspacePageLoadingSnapshotStatus = 'suspense_pending' | 'auth_checking' | 'unauthenticated_redirect' | 'manual_loading';

export type WorkspacePageLoadingSnapshotSource = 'suspense' | 'auth_gate' | 'manual_label';

export type WorkspacePageLoadingSnapshot = {
  status: WorkspacePageLoadingSnapshotStatus;
  source: WorkspacePageLoadingSnapshotSource;
  label: string;
  authLoading: boolean;
  isAuthenticated: boolean;
  canRedirectToAuth: boolean;
  hasCustomLabel: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceProjectBootstrapSnapshotStatus = 'route_project_pending' | 'route_payload_pending' | 'local_snapshot_probe' | 'project_ready' | 'messages_restoring' | 'no_entry_redirect_pending';

export type WorkspaceProjectBootstrapSnapshotSource = 'route_project_id' | 'route_project_payload' | 'local_workspace_snapshot' | 'current_project' | 'workspace_session_snapshot' | 'route_guard';

export type WorkspaceProjectBootstrapMessageRestoreStatus =
  | 'not_started'
  | 'restoring'
  | 'backend_history_restored'
  | 'session_snapshot_restored'
  | 'empty_history_no_session'
  | 'restore_failed_session_snapshot'
  | 'restore_failed_no_snapshot';

export type WorkspaceProjectBootstrapMessageRestoreSource =
  | 'none'
  | 'backend_history'
  | 'workspace_session_snapshot'
  | 'empty_backend_history'
  | 'restore_failure';

export type WorkspaceProjectBootstrapSnapshot = {
  status: WorkspaceProjectBootstrapSnapshotStatus;
  source: WorkspaceProjectBootstrapSnapshotSource;
  messageRestoreStatus: WorkspaceProjectBootstrapMessageRestoreStatus;
  messageRestoreSource: WorkspaceProjectBootstrapMessageRestoreSource;
  hasMounted: boolean;
  hasRouteProjectId: boolean;
  hasRouteProjectPayload: boolean;
  hasProject: boolean;
  isRestoringWorkspace: boolean;
  canRedirectHome: boolean;
  projectId: string | null;
  projectName: string | null;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceEntryNavigationSnapshotStatus = 'auth_loading' | 'unauthenticated' | 'draft_restoring' | 'draft_persistence_failed' | 'project_create_failed' | 'creating_project' | 'ready_to_create' | 'project_list_loading' | 'project_list_failed' | 'project_list_empty' | 'project_list_ready';

export type WorkspaceEntryNavigationSnapshotSource = 'auth' | 'home_draft' | 'home_create' | 'project_list';

export type WorkspaceEntryNavigationSurface = 'home' | 'project_list';

export type WorkspaceEntryNavigationSnapshot = {
  status: WorkspaceEntryNavigationSnapshotStatus;
  source: WorkspaceEntryNavigationSnapshotSource;
  surface: WorkspaceEntryNavigationSurface;
  isAuthenticated: boolean;
  isBusy: boolean;
  hasLocalPersistenceIssue: boolean;
  canPrepareWorkspaceSnapshot: boolean;
  canMarkPendingNavigation: boolean;
  canNavigateWorkspace: boolean;
  projectCount: number;
  hasTargetProject: boolean;
  targetProjectId: string | null;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ProjectListPageSnapshotStatus = 'auth_loading' | 'unauthenticated' | 'loading' | 'sync_failed' | 'empty' | 'delete_accepted' | 'delete_restored' | 'delete_restore_failed' | 'runtime_stop_completed' | 'runtime_stop_failed' | 'resource_snapshot_ready' | 'resource_snapshot_blocked' | 'resource_snapshot_failed' | 'resource_alert_ready' | 'resource_alert_alerting' | 'resource_alert_blocked' | 'resource_alert_preview_ready' | 'resource_alert_preview_would_alert' | 'resource_alert_preview_blocked' | 'resource_alert_event_created' | 'resource_alert_event_blocked' | 'resource_alert_event_unavailable' | 'resource_alert_event_list_ready' | 'resource_alert_event_list_empty' | 'resource_alert_event_list_unavailable' | 'resource_alert_notification_ready' | 'resource_alert_notification_empty' | 'resource_alert_notification_blocked' | 'resource_alert_notification_unavailable' | 'resource_alert_notification_sent' | 'resource_alert_notification_failed' | 'resource_alert_notification_send_blocked' | 'resource_alert_notification_send_unavailable' | 'resource_alert_enforcement_ready' | 'resource_alert_enforcement_disabled' | 'resource_alert_enforcement_blocked' | 'resource_alert_enforcement_unavailable' | 'resource_alert_enforcement_executed' | 'resource_alert_enforcement_failed' | 'resource_alert_enforcement_execute_blocked' | 'backup_created' | 'backup_blocked' | 'backup_list_ready' | 'backup_list_empty' | 'backup_policy_ready' | 'backup_policy_blocked' | 'backup_remote_ready' | 'backup_remote_empty' | 'backup_remote_blocked' | 'backup_remote_inventory_ready' | 'backup_remote_inventory_empty' | 'backup_remote_inventory_blocked' | 'backup_remote_inventory_failed' | 'backup_remote_upload_completed' | 'backup_remote_upload_blocked' | 'backup_remote_upload_failed' | 'backup_remote_download_completed' | 'backup_remote_download_blocked' | 'backup_remote_download_failed' | 'backup_remote_restore_completed' | 'backup_remote_restore_blocked' | 'backup_remote_restore_failed' | 'backup_auto_run_created' | 'backup_auto_run_blocked' | 'backup_download_ready' | 'backup_download_blocked' | 'backup_preflight_ready' | 'backup_preflight_blocked' | 'backup_restore_completed' | 'backup_restore_blocked' | 'backup_failed' | 'edit_failed' | 'delete_failed' | 'ready';

export type ProjectListPageSnapshotStatusList = readonly ProjectListPageSnapshotStatus[];
export type ProjectListNoticeKind = 'delete_accepted' | 'delete_restored' | 'delete_restore_failed' | 'runtime_stop_completed' | 'resource_snapshot_ready' | 'resource_snapshot_blocked' | 'resource_snapshot_failed' | 'resource_alert_ready' | 'resource_alert_alerting' | 'resource_alert_blocked' | 'resource_alert_preview_ready' | 'resource_alert_preview_would_alert' | 'resource_alert_preview_blocked' | 'resource_alert_event_created' | 'resource_alert_event_blocked' | 'resource_alert_event_unavailable' | 'resource_alert_event_list_ready' | 'resource_alert_event_list_empty' | 'resource_alert_event_list_unavailable' | 'resource_alert_notification_ready' | 'resource_alert_notification_empty' | 'resource_alert_notification_blocked' | 'resource_alert_notification_unavailable' | 'resource_alert_notification_sent' | 'resource_alert_notification_failed' | 'resource_alert_notification_send_blocked' | 'resource_alert_notification_send_unavailable' | 'resource_alert_enforcement_ready' | 'resource_alert_enforcement_disabled' | 'resource_alert_enforcement_blocked' | 'resource_alert_enforcement_unavailable' | 'resource_alert_enforcement_executed' | 'resource_alert_enforcement_failed' | 'resource_alert_enforcement_execute_blocked' | 'backup_created' | 'backup_blocked' | 'backup_list_ready' | 'backup_list_empty' | 'backup_policy_ready' | 'backup_policy_blocked' | 'backup_remote_ready' | 'backup_remote_empty' | 'backup_remote_blocked' | 'backup_remote_inventory_ready' | 'backup_remote_inventory_empty' | 'backup_remote_inventory_blocked' | 'backup_remote_inventory_failed' | 'backup_remote_upload_completed' | 'backup_remote_upload_blocked' | 'backup_remote_upload_failed' | 'backup_remote_download_completed' | 'backup_remote_download_blocked' | 'backup_remote_download_failed' | 'backup_remote_restore_completed' | 'backup_remote_restore_blocked' | 'backup_remote_restore_failed' | 'backup_auto_run_created' | 'backup_auto_run_blocked' | 'backup_download_ready' | 'backup_download_blocked' | 'backup_preflight_ready' | 'backup_preflight_blocked' | 'backup_restore_completed' | 'backup_restore_blocked';

export type ProjectListPageSnapshotSource = 'auth' | 'project_list_api' | 'project_list_state' | 'project_delete' | 'runtime_stop' | 'project_resource' | 'project_backup' | 'project_edit';

export type ProjectListPageSnapshot = {
  status: ProjectListPageSnapshotStatus;
  source: ProjectListPageSnapshotSource;
  isAuthenticated: boolean;
  isLoading: boolean;
  projectCount: number;
  apiHealthStatus: ProjectListApiHealthStatus;
  apiHealthSource: ProjectListApiHealthSource;
  apiHealthReasonCode: ProjectListApiHealthReasonCode;
  apiHealthDetails: ProjectListApiHealthDetails;
  authRecoveryStatus: ProjectListAuthRecoveryStatus;
  authRecoverySource: ProjectListAuthRecoverySource;
  authRecoveryReasonCode: ProjectListAuthRecoveryReasonCode;
  authRecoveryDetails: ProjectListAuthRecoveryDetails;
  backendHealthStatus: ProjectListBackendHealthProbeStatus;
  backendHealthSource: ProjectListBackendHealthProbeSource;
  backendHealthReasonCode: ProjectListBackendHealthProbeReasonCode;
  backendHealthDetails: ProjectListBackendHealthProbeDetails;
  backendHealthService: ProjectListBackendHealthProbeService;
  backendHealthBackendStatus: ProjectListBackendHealthProbeBackendStatus;
  hasSyncError: boolean;
  hasNotice: boolean;
  hasStopError: boolean;
  hasResourceError: boolean;
  hasBackupError: boolean;
  hasEditError: boolean;
  hasDeleteError: boolean;
  stoppingProjectId: string | null;
  checkingResourceSnapshotProjectId: string | null;
  checkingResourceAlertReadinessProjectId: string | null;
  previewingResourceAlertEvaluationProjectId: string | null;
  creatingResourceAlertEventProjectId: string | null;
  listingResourceAlertEventsProjectId: string | null;
  checkingResourceAlertNotificationProjectId: string | null;
  sendingResourceAlertNotificationProjectId: string | null;
  checkingResourceAlertEnforcementProjectId: string | null;
  executingResourceAlertEnforcementProjectId: string | null;
  backingUpProjectId: string | null;
  listingBackupsProjectId: string | null;
  checkingBackupPolicyProjectId: string | null;
  checkingBackupRemoteStorageProjectId: string | null;
  checkingBackupRemoteInventoryProjectId: string | null;
  uploadingBackupRemoteStorageProjectId: string | null;
  downloadingBackupRemoteStorageProjectId: string | null;
  restoringBackupRemoteStorageProjectId: string | null;
  runningAutomaticBackupProjectId: string | null;
  downloadingBackupProjectId: string | null;
  preflightingBackupProjectId: string | null;
  restoringBackupProjectId: string | null;
  editingProjectId: string | null;
  deletingProjectId: string | null;
  restoringDeletedProjectId: string | null;
  canReload: boolean;
  canCreateProject: boolean;
  canLoginRecovery: boolean;
  canRetryProjectListAfterAuth: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ProjectCardSnapshotStatus = 'deletion_recovery' | 'runtime_stopping' | 'runtime_running' | 'runtime_starting' | 'runtime_stopped' | 'runtime_missing' | 'runtime_error' | 'runtime_unknown';

export type ProjectCardSnapshotSource = 'deletion_recovery' | 'runtime_status' | 'card_actions';

export type ProjectCardSnapshot = {
  status: ProjectCardSnapshotStatus;
  source: ProjectCardSnapshotSource;
  projectId: string;
  projectName: string;
  appType: string;
  containerStatus: ProjectRuntimeContainerStatus;
  isHovered: boolean;
  isStopping: boolean;
  canOpenWorkspace: boolean;
  canEdit: boolean;
  canStopRuntime: boolean;
  canDelete: boolean;
  hasDeletionRecovery: boolean;
  cleanupScope: string;
  techStackCount: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ProjectMutationDialogSnapshotStatus = 'closed' | 'edit_ready' | 'edit_name_missing' | 'edit_saving' | 'edit_failed' | 'delete_confirming' | 'delete_deleting' | 'delete_failed';

export type ProjectMutationDialogSnapshotSource = 'dialog_state' | 'edit_form' | 'project_edit' | 'project_delete';

export type ProjectMutationDialogMode = 'none' | 'edit' | 'delete';

export type ProjectMutationDialogSnapshot = {
  status: ProjectMutationDialogSnapshotStatus;
  source: ProjectMutationDialogSnapshotSource;
  mode: ProjectMutationDialogMode;
  projectId: string | null;
  projectName: string | null;
  hasProject: boolean;
  nameLength: number;
  descriptionLength: number;
  appType: string;
  isSaving: boolean;
  isDeleting: boolean;
  hasEditError: boolean;
  hasDeleteError: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ProjectEditSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed' | 'name_missing';

export type ProjectEditSaveConfirmationSnapshotSource = 'dialog_state' | 'project_edit' | 'edit_form';

export type ProjectEditSaveConfirmationRiskLevel = 'none' | 'medium';

export type ProjectEditSaveConfirmationSnapshot = {
  status: ProjectEditSaveConfirmationSnapshotStatus;
  source: ProjectEditSaveConfirmationSnapshotSource;
  projectId: string | null;
  originalProjectName: string | null;
  nextProjectName: string;
  originalAppType: string;
  nextAppType: string;
  nameLength: number;
  descriptionLength: number;
  hasNameChange: boolean;
  hasDescriptionChange: boolean;
  hasAppTypeChange: boolean;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: ProjectEditSaveConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ProjectActionConfirmationKind = 'runtime_stop' | 'delete_restore' | 'resource_alert_event_create' | 'resource_alert_notification_send' | 'resource_alert_enforcement_execute' | 'backup_create' | 'backup_auto_run' | 'backup_remote_upload' | 'backup_remote_download' | 'backup_restore' | 'backup_remote_restore';

export type ProjectActionConfirmationDialogSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type ProjectActionConfirmationDialogSnapshotSource = 'dialog_state' | 'runtime_stop' | 'project_delete' | 'project_resource' | 'project_backup';

export type ProjectActionConfirmationRiskLevel = 'medium' | 'high';

export type ProjectActionConfirmationDialogSnapshot = {
  status: ProjectActionConfirmationDialogSnapshotStatus;
  source: ProjectActionConfirmationDialogSnapshotSource;
  kind: ProjectActionConfirmationKind | 'none';
  projectId: string | null;
  projectName: string | null;
  backupId: string | null;
  isConfirming: boolean;
  hasProject: boolean;
  hasBackup: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: ProjectActionConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AuthPageSnapshotStatus = 'suspense_pending' | 'auth_checking' | 'authenticated_redirect' | 'login_ready' | 'register_ready' | 'form_incomplete' | 'submitting' | 'auth_failed' | 'storage_notice';

export type AuthPageSnapshotSource = 'suspense' | 'auth_gate' | 'auth_form' | 'auth_operation' | 'auth_storage';

export type AuthPageMode = 'login' | 'register';

export type AuthPageSnapshot = {
  status: AuthPageSnapshotStatus;
  source: AuthPageSnapshotSource;
  mode: AuthPageMode;
  redirectTarget: string;
  authLoading: boolean;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  hasError: boolean;
  hasStorageNotice: boolean;
  emailLength: number;
  passwordLength: number;
  usernameLength: number;
  canSubmit: boolean;
  canToggleMode: boolean;
  canReturnHome: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminLoginPageSnapshotStatus = 'form_incomplete' | 'ready' | 'submitting' | 'login_failed' | 'storage_notice' | 'redirecting';

export type AdminLoginPageSnapshotSource = 'admin_form' | 'admin_auth_operation' | 'admin_auth_storage' | 'admin_redirect';

export type AdminLoginPageSnapshot = {
  status: AdminLoginPageSnapshotStatus;
  source: AdminLoginPageSnapshotSource;
  redirectTarget: string;
  emailLength: number;
  passwordLength: number;
  isSubmitting: boolean;
  isRedirecting: boolean;
  hasError: boolean;
  hasStorageNotice: boolean;
  canSubmit: boolean;
  canReturnHome: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminLayoutSnapshotStatus = 'login_route' | 'checking' | 'token_missing_redirect' | 'token_read_failed_redirect' | 'cached_profile_ready' | 'profile_cache_read_failed' | 'profile_cache_write_failed' | 'profile_cache_url_cleanup_failed' | 'profile_verified' | 'profile_verification_failed_redirect' | 'unauthenticated' | 'ready';

export type AdminLayoutSnapshotSource = 'route' | 'token_storage' | 'profile_cache' | 'profile_api' | 'browser_history' | 'admin_session';

export type AdminSessionSnapshotRole = 'none' | 'admin' | 'super_admin' | 'unknown';

export type AdminEnterpriseReadinessStatus = 'ready' | 'warning' | 'blocked' | 'not_connected';

export type AdminEnterpriseReadinessStatusList = readonly AdminEnterpriseReadinessStatus[];

export type AdminEnterpriseSsoReadinessStatus = 'disabled' | 'missing_config' | 'configured_not_connected';

export type AdminEnterpriseSsoConfigKeyList = readonly AdminEnterpriseSsoConfigKey[];

export type AdminEnterpriseOrganizationGovernanceReadinessStatus = AdminEnterpriseOrganizationReadinessStatus;
export type AdminEnterpriseProjectOwnershipGovernanceReadinessStatus = AdminEnterpriseProjectOwnershipReadinessStatus;
export type AdminEnterpriseProjectOwnershipGovernancePreflightStatus = AdminEnterpriseProjectOwnershipPreflightStatus;
export type AdminEnterpriseProjectOwnershipGovernanceMappingStatus = AdminEnterpriseProjectOwnershipMappingStatus;
export type AdminEnterpriseProjectOwnershipGovernanceOwnerGuardReadinessStatus = AdminEnterpriseProjectOwnershipOwnerGuardReadinessStatus;
export type AdminEnterpriseProjectAccessGuardGovernanceSwitchReadinessStatus = AdminEnterpriseProjectAccessGuardSwitchReadinessStatus;
export type AdminEnterpriseProjectAccessGuardGovernanceAuthorizationDryRunStatus = AdminEnterpriseProjectAccessGuardAuthorizationDryRunEvidenceStatus;
export type AdminEnterpriseProjectAccessGuardGovernanceActivationReadinessStatus = AdminEnterpriseProjectAccessGuardActivationReadinessStatus;
export type AdminEnterpriseProjectAccessGuardGovernanceActivationAuditReadinessStatus = AdminEnterpriseProjectAccessGuardActivationAuditReadinessStatus;
export type AdminEnterpriseProjectAccessGuardGovernanceActivationAuditMetadataIntegrityStatus = AdminEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityStatus;
export type AdminEnterpriseProjectAccessGuardGovernanceActivationAuditPayloadIntegrityStatus = AdminEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityStatus;
export type AdminEnterpriseAuditCoverageGovernanceReadinessStatus = AdminEnterpriseAuditCoverageReadinessStatus;
export type AdminEnterpriseAuditExportGovernanceReadinessStatus = AdminEnterpriseAuditExportReadinessStatus;
export type AdminEnterpriseAuditExportQueryGovernanceReadinessStatus = AdminEnterpriseAuditExportQueryReadinessStatus;
export type AdminEnterpriseAuditExportTaskPreflightGovernanceReadinessStatus = AdminEnterpriseAuditExportTaskPreflightReadinessStatus;
export type AdminEnterpriseAuditExportFileFormatGovernanceReadinessStatus = AdminEnterpriseAuditExportFileFormatReadinessStatus;
export type AdminEnterpriseAuditExportFileGeneratorGovernanceReadinessStatus = AdminEnterpriseAuditExportFileGeneratorReadinessStatus;
export type AdminEnterpriseAuditExportTaskCreateRequestGovernanceReadinessStatus = AdminEnterpriseAuditExportTaskCreateRequestReadinessStatus;
export type AdminEnterpriseAuditExportTaskPersistenceGovernanceReadinessStatus = AdminEnterpriseAuditExportTaskPersistenceReadinessStatus;
export type AdminEnterpriseAuditRetentionGovernanceReadinessStatus = AdminEnterpriseAuditRetentionReadinessStatus;

export type AdminEnterpriseGovernanceArea =
  | 'enterprise_identity'
  | 'organization_governance'
  | 'project_ownership'
  | 'project_ownership_preflight'
  | 'project_ownership_mapping'
  | 'project_ownership_owner_guard'
  | 'project_access_guard_switch'
  | 'project_access_guard_authorization_dry_run'
  | 'project_access_guard_activation'
  | 'project_access_guard_activation_audit'
  | 'rbac'
  | 'audit'
  | 'audit_export'
  | 'audit_export_query'
  | 'audit_export_task_preflight'
  | 'audit_export_file_format'
  | 'audit_export_file_generator'
  | 'audit_export_task_create_request'
  | 'audit_export_task_persistence'
  | 'audit_retention'
  | 'runtime_governance'
  | 'provider_governance';

export type AdminEnterpriseGovernanceAreaList = readonly AdminEnterpriseGovernanceArea[];

export type AdminEnterpriseGovernancePageSnapshotStatus =
  | 'loading'
  | 'load_failed'
  | 'blocked'
  | 'partial'
  | 'ready';

export type AdminEnterpriseGovernancePageSnapshotSource =
  | 'enterprise_readiness'
  | 'admin_enterprise_organization_readiness'
  | 'admin_enterprise_project_ownership_readiness'
  | 'admin_enterprise_project_ownership_preflight'
  | 'admin_enterprise_project_ownership_mappings'
  | 'admin_enterprise_project_ownership_owner_guard_readiness'
  | 'admin_enterprise_project_access_guard_switch_readiness'
  | 'admin_enterprise_project_access_guard_authorization_dry_run'
  | 'admin_enterprise_project_access_guard_activation_readiness'
  | 'admin_enterprise_project_access_guard_activation_audit_readiness'
  | 'admin_enterprise_audit_coverage_readiness'
  | 'admin_enterprise_audit_export_readiness'
  | 'admin_enterprise_audit_export_query_readiness'
  | 'admin_enterprise_audit_export_task_preflight_readiness'
  | 'admin_enterprise_audit_export_file_format_readiness'
  | 'admin_enterprise_audit_export_file_generator_readiness'
  | 'admin_enterprise_audit_export_task_create_request_readiness'
  | 'admin_enterprise_audit_export_task_persistence_readiness'
  | 'admin_enterprise_audit_retention_readiness'
  | 'admin_config_list'
  | 'admin_user_list'
  | 'admin_role_list'
  | 'admin_audit_list'
  | 'admin_runtime_projects'
  | 'admin_provider_preflight';

export type AdminEnterpriseMutationConfirmationAction =
  | 'organization_create'
  | 'team_create'
  | 'member_bind'
  | 'project_ownership_migrate';

export type AdminEnterpriseMutationConfirmationStatus =
  | 'closed'
  | 'awaiting_confirmation'
  | 'confirming'
  | 'mutation_failed';

export type AdminEnterpriseMutationConfirmationSource =
  | 'dialog_state'
  | 'organization_mutation'
  | 'team_mutation'
  | 'member_mutation'
  | 'project_ownership_migration';

export type AdminEnterpriseMutationConfirmationRiskLevel = 'none' | 'medium' | 'high';

export type AdminEnterpriseGovernanceReadinessItem = {
  area: AdminEnterpriseGovernanceArea;
  status: AdminEnterpriseReadinessStatus;
  title: string;
  fact: string;
  recovery: string;
};

export type AdminEnterpriseGovernanceReadinessItemList = readonly AdminEnterpriseGovernanceReadinessItem[];

export type AdminEnterpriseGovernancePageSnapshot = {
  status: AdminEnterpriseGovernancePageSnapshotStatus;
  source: AdminEnterpriseGovernancePageSnapshotSource;
  userCount: number;
  roleCount: number;
  permissionCount: number;
  auditLogCount: number;
  runtimeProjectCount: number;
  providerPreflightItemCount: number;
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
  readyItemCount: number;
  warningItemCount: number;
  blockedItemCount: number;
  notConnectedItemCount: number;
  isLoading: boolean;
  hasError: boolean;
  canReload: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminEnterpriseMutationConfirmationSnapshot = {
  status: AdminEnterpriseMutationConfirmationStatus;
  source: AdminEnterpriseMutationConfirmationSource;
  action: AdminEnterpriseMutationConfirmationAction | null;
  organizationId: AdminEnterpriseOrganizationId | null;
  organizationName: string;
  teamId: AdminEnterpriseTeamId | null;
  teamName: string;
  userId: AdminUserId | null;
  projectRecordId: AdminProjectRecordId | null;
  projectName: string;
  summary: string;
  isSubmitting: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminEnterpriseMutationConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminLayoutNavHref = '/admin' | '/admin/llm' | '/admin/prompts' | '/admin/templates' | '/admin/config' | '/admin/audit' | '/admin/users' | '/admin/admins' | '/admin/roles' | '/admin/enterprise';

export type AdminLayoutNavLabelKey = 'dashboard' | 'llm' | 'prompts' | 'templates' | 'config' | 'audit' | 'users' | 'admins' | 'roles' | 'enterprise';

export type AdminLayoutSnapshot = {
  status: AdminLayoutSnapshotStatus;
  source: AdminLayoutSnapshotSource;
  pathname: string;
  isChecking: boolean;
  isAuthed: boolean;
  hasAdminInfo: boolean;
  role: AdminSessionSnapshotRole;
  rawRole: string;
  permissionCount: number;
  visibleNavCount: number;
  hasStorageNotice: boolean;
  canRenderChildren: boolean;
  canLogout: boolean;
  canOpenNav: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminDashboardPageSnapshotStatus = 'profile_missing' | 'loading' | 'empty' | 'limited_ready' | 'diagnostics_partial' | 'diagnostics_ready';

export type AdminDashboardPageSnapshotSource = 'admin_profile' | 'dashboard_data' | 'dashboard_permissions' | 'dashboard_diagnostics';

export type AdminDashboardPageSnapshot = {
  status: AdminDashboardPageSnapshotStatus;
  source: AdminDashboardPageSnapshotSource;
  role: AdminSessionSnapshotRole;
  isSuperAdmin: boolean;
  isLoading: boolean;
  cardCount: number;
  quickLinkCount: number;
  recentLogCount: number;
  adminProjectCount: number;
  hasProviderSnapshot: boolean;
  hasProviderPreflight: boolean;
  healthTone: 'success' | 'warning' | 'critical' | 'neutral';
  blockerCount: number;
  warningCount: number;
  pendingCount: number;
  auditSignalCount: number;
  canOpenDiagnostics: boolean;
  canOpenQuickLinks: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminConfigPageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'editing' | 'saving' | 'save_failed';

export type AdminConfigPageSnapshotSource = 'config_list' | 'config_permission' | 'config_edit' | 'config_save';

export type AdminConfigSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed';

export type AdminConfigSaveConfirmationSnapshotSource = 'dialog_state' | 'config_save' | 'container_config_save' | 'prompt_config_save';

export type AdminConfigSaveConfirmationRiskLevel = 'none' | 'medium' | 'high';

export type AdminConfigPageSnapshot = {
  status: AdminConfigPageSnapshotStatus;
  source: AdminConfigPageSnapshotSource;
  configCount: number;
  groupCount: number;
  containerConfigCount: number;
  generalConfigCount: number;
  editableConfigCount: number;
  canEditAll: boolean;
  canEditContainer: boolean;
  editingKey: AdminSystemConfigKey | null;
  editValueLength: number;
  isLoading: boolean;
  isSaving: boolean;
  hasError: boolean;
  canStartEdit: boolean;
  canSave: boolean;
  canCancel: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminConfigSaveConfirmationSnapshot = {
  status: AdminConfigSaveConfirmationSnapshotStatus;
  source: AdminConfigSaveConfirmationSnapshotSource;
  configKey: AdminSystemConfigKey | null;
  valueType: AdminSystemConfigValueType | null;
  editValueLength: number;
  isContainerConfig: boolean;
  isPromptConfig: boolean;
  isPublicConfig: AdminSystemConfigPublicFlag | null;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminConfigSaveConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminPromptPageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'editing' | 'saving' | 'save_failed';

export type AdminPromptPageSnapshotSource = 'prompt_config_list' | 'prompt_config_edit' | 'prompt_config_save' | 'prompt_config_permission';

export type AdminPromptSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed';

export type AdminPromptSaveConfirmationSnapshotSource = 'dialog_state' | 'prompt_config_save' | 'prompt_profile';

export type AdminPromptSaveConfirmationRiskLevel = 'none' | 'high';

export type AdminPromptProfilePhase = 'Plan' | 'Discuss' | 'Implement' | 'Custom';
export type AdminPromptProfileTitle = string;
export type AdminPromptProfileDescription = string;

export type AdminPromptPageSnapshot = {
  status: AdminPromptPageSnapshotStatus;
  source: AdminPromptPageSnapshotSource;
  promptCount: number;
  knownPromptCount: number;
  editablePromptCount: number;
  editingKey: AdminPromptConfigKey | null;
  editValueLength: number;
  totalPromptChars: number;
  isLoading: boolean;
  isSaving: boolean;
  hasError: boolean;
  canEdit: boolean;
  canStartEdit: boolean;
  canSave: boolean;
  canCancel: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminPromptSaveConfirmationSnapshot = {
  status: AdminPromptSaveConfirmationSnapshotStatus;
  source: AdminPromptSaveConfirmationSnapshotSource;
  promptKey: AdminPromptConfigKey | null;
  promptTitle: AdminPromptProfileTitle;
  promptPhase: AdminPromptProfilePhase;
  editValueLength: number;
  isKnownPrompt: boolean;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminPromptSaveConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminTemplatePageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'editing' | 'saving' | 'save_failed';

export type AdminTemplatePageSnapshotSource = 'template_config_list' | 'template_config_edit' | 'template_config_save' | 'template_config_permission';

export type AdminTemplateSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed';

export type AdminTemplateSaveConfirmationSnapshotSource = 'dialog_state' | 'template_config_save' | 'template_profile';

export type AdminTemplateSaveConfirmationRiskLevel = 'none' | 'high';

export type AdminTemplateProfileCategory = 'ProjectDocs' | 'NodeNextJS' | 'PythonFastAPI' | 'GoGin' | 'DefaultScaffold' | 'Custom';
export type AdminTemplateProfileTitle = string;
export type AdminTemplateProfileDescription = string;

export type AdminTemplatePageSnapshot = {
  status: AdminTemplatePageSnapshotStatus;
  source: AdminTemplatePageSnapshotSource;
  templateCount: number;
  knownTemplateCount: number;
  editableTemplateCount: number;
  editingKey: AdminTemplateConfigKey | null;
  editValueLength: number;
  configuredTemplateCount: number;
  emptyTemplateCount: number;
  isLoading: boolean;
  isSaving: boolean;
  hasError: boolean;
  canEdit: boolean;
  canStartEdit: boolean;
  canSave: boolean;
  canCancel: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminTemplateSaveConfirmationSnapshot = {
  status: AdminTemplateSaveConfirmationSnapshotStatus;
  source: AdminTemplateSaveConfirmationSnapshotSource;
  templateKey: AdminTemplateConfigKey | null;
  templateTitle: AdminTemplateProfileTitle;
  templateCategory: AdminTemplateProfileCategory;
  editValueLength: number;
  isKnownTemplate: boolean;
  isClearingOverride: boolean;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminTemplateSaveConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminRolesPageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'creating' | 'editing' | 'form_incomplete' | 'saving' | 'save_failed' | 'delete_confirming' | 'deleting' | 'delete_failed';

export type AdminRolesPageSnapshotSource = 'role_list' | 'permission_list' | 'role_form' | 'role_save' | 'role_delete';

export type AdminRoleFormMode = 'none' | 'create' | 'edit';

export type AdminRoleSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed';

export type AdminRoleSaveConfirmationSnapshotSource = 'dialog_state' | 'role_create' | 'role_update' | 'permission_binding';

export type AdminRoleSaveConfirmationRiskLevel = 'none' | 'medium' | 'high';

export type AdminRoleDeleteConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'delete_failed';

export type AdminRoleDeleteConfirmationSnapshotSource = 'dialog_state' | 'role_delete' | 'permission_binding';

export type AdminRoleDeleteConfirmationRiskLevel = 'none' | 'high' | 'blocked';

export type AdminPermissionCode = string;
export type AdminPermissionCodeList = AdminPermissionCode[];
export type AdminPermissionId = string;
export type AdminPermissionIdList = AdminPermissionId[];
export type AdminRoleId = string;
export type AdminRoleIdList = AdminRoleId[];
export type AdminRoleDraftId = 'new';
export type AdminRoleEditingId = AdminRoleId | AdminRoleDraftId;
export type AdminRoleDeletingId = AdminRoleId;
export type AdminManagerId = string;
export type AdminUnknownRawValue = string;
export type AdminUnknownRawValueList = AdminUnknownRawValue[];

export type AdminRolesPageSnapshot = {
  status: AdminRolesPageSnapshotStatus;
  source: AdminRolesPageSnapshotSource;
  roleCount: number;
  permissionCount: number;
  permissionGroupCount: number;
  systemRoleCount: number;
  unknownStatusCount: number;
  unknownStatusValues: AdminUnknownRawValueList;
  editingRoleId: AdminRoleEditingId | null;
  deletingRoleId: AdminRoleDeletingId | null;
  formMode: AdminRoleFormMode;
  nameLength: number;
  displayNameLength: number;
  descriptionLength: number;
  selectedPermissionCount: number;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  hasError: boolean;
  canCreate: boolean;
  canSave: boolean;
  canCancel: boolean;
  canDelete: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminRoleEditableSnapshotStatus = 'none' | 'active' | 'disabled';

export type AdminRoleSaveConfirmationSnapshot = {
  status: AdminRoleSaveConfirmationSnapshotStatus;
  source: AdminRoleSaveConfirmationSnapshotSource;
  formMode: AdminRoleFormMode;
  roleId: AdminRoleId | null;
  roleName: string;
  displayName: string;
  roleStatus: AdminRoleEditableSnapshotStatus;
  selectedPermissionCount: number;
  isSystemRole: boolean;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminRoleSaveConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminRoleDeleteConfirmationSnapshot = {
  status: AdminRoleDeleteConfirmationSnapshotStatus;
  source: AdminRoleDeleteConfirmationSnapshotSource;
  roleId: AdminRoleId | null;
  roleName: string;
  displayName: string;
  selectedPermissionCount: number;
  isSystemRole: boolean;
  isDeleting: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminRoleDeleteConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminManagerEditableSnapshotSystemRole = 'none' | 'admin' | 'super_admin';

export type AdminManagerEditableSnapshotStatus = 'none' | 'active' | 'disabled';

export type AdminManagersPageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'editing' | 'saving' | 'save_failed' | 'delete_confirming' | 'deleting' | 'delete_failed';

export type AdminManagersPageSnapshotSource = 'admin_list' | 'role_list' | 'admin_edit' | 'admin_save' | 'admin_delete';

export type AdminManagerSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed';

export type AdminManagerSaveConfirmationSnapshotSource = 'dialog_state' | 'admin_save' | 'role_binding';

export type AdminManagerSaveConfirmationRiskLevel = 'none' | 'medium' | 'high';

export type AdminManagerDeletingId = AdminManagerId;

export type AdminManagerDeleteSnapshotSystemRole = 'none' | 'admin' | 'super_admin' | 'unknown';

export type AdminManagerDeleteConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'delete_failed';

export type AdminManagerDeleteConfirmationSnapshotSource = 'dialog_state' | 'admin_delete';

export type AdminManagerDeleteConfirmationRiskLevel = 'none' | 'high';

export type AdminManagersPageSnapshot = {
  status: AdminManagersPageSnapshotStatus;
  source: AdminManagersPageSnapshotSource;
  adminCount: number;
  roleCount: number;
  activeAdminCount: number;
  disabledAdminCount: number;
  superAdminCount: number;
  unknownStatusCount: number;
  unknownSystemRoleCount: number;
  unknownStatusValues: AdminUnknownRawValueList;
  unknownSystemRoleValues: AdminUnknownRawValueList;
  editingAdminId: AdminManagerId | null;
  deletingAdminId: AdminManagerDeletingId | null;
  selectedRoleCount: number;
  selectedSystemRole: AdminManagerEditableSnapshotSystemRole;
  selectedStatus: AdminManagerEditableSnapshotStatus;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  hasError: boolean;
  canStartEdit: boolean;
  canSave: boolean;
  canCancel: boolean;
  canDelete: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminManagerSaveConfirmationSnapshot = {
  status: AdminManagerSaveConfirmationSnapshotStatus;
  source: AdminManagerSaveConfirmationSnapshotSource;
  adminId: AdminManagerId | null;
  selectedSystemRole: AdminManagerEditableSnapshotSystemRole;
  selectedStatus: AdminManagerEditableSnapshotStatus;
  selectedRoleCount: number;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminManagerSaveConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminManagerDeleteConfirmationSnapshot = {
  status: AdminManagerDeleteConfirmationSnapshotStatus;
  source: AdminManagerDeleteConfirmationSnapshotSource;
  adminId: AdminManagerId | null;
  adminEmail: string;
  systemRole: AdminManagerDeleteSnapshotSystemRole;
  selectedRoleCount: number;
  isDeleting: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminManagerDeleteConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminLLMProvidersPageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'runtime_drift' | 'reloading' | 'reload_failed' | 'creating' | 'editing' | 'form_incomplete' | 'saving' | 'save_failed' | 'delete_confirming' | 'delete_failed';

export type AdminLLMProvidersPageSnapshotSource = 'provider_list' | 'runtime_reload' | 'provider_form' | 'provider_delete' | 'provider_runtime';

export type AdminLLMProviderFormMode = 'none' | 'create' | 'edit';

export type AdminLLMProviderReloadMessageState = 'none' | 'success' | 'failed';

export type AdminLLMProviderSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed';

export type AdminLLMProviderSaveConfirmationSnapshotSource = 'dialog_state' | 'provider_create' | 'provider_update' | 'provider_runtime';

export type AdminLLMProviderDeleteConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'delete_failed';

export type AdminLLMProviderDeleteConfirmationSnapshotSource = 'dialog_state' | 'provider_delete' | 'provider_runtime';

export type AdminLLMProviderRuntimeMutationConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'mutation_failed';

export type AdminLLMProviderRuntimeMutationConfirmationSnapshotSource = 'dialog_state' | 'provider_runtime' | 'provider_default';

export type AdminLLMProviderRuntimeMutationAction = 'none' | 'toggle_enabled' | 'set_default';

export type AdminLLMProviderRuntimeMutationKind = 'toggle_enabled' | 'set_default';

export type AdminLLMProviderConfirmationRiskLevel = 'none' | 'medium' | 'high';

export type AdminLLMProvidersPageSnapshot = {
  status: AdminLLMProvidersPageSnapshotStatus;
  source: AdminLLMProvidersPageSnapshotSource;
  providerCount: number;
  enabledCount: number;
  loadedCount: number;
  driftCount: number;
  defaultProviderName: string;
  activeProviderName: string;
  formMode: AdminLLMProviderFormMode;
  editingProviderId: AdminLLMProviderId | null;
  deletingProviderId: AdminLLMProviderId | null;
  nameLength: number;
  displayNameLength: number;
  baseUrlLength: number;
  modelLength: number;
  hasApiKeyInput: boolean;
  reloadMessageState: AdminLLMProviderReloadMessageState;
  hasLastReloadAt: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isReloading: boolean;
  hasError: boolean;
  canCreate: boolean;
  canReload: boolean;
  canSave: boolean;
  canCancelForm: boolean;
  canConfirmDelete: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminLLMProviderSaveConfirmationSnapshot = {
  status: AdminLLMProviderSaveConfirmationSnapshotStatus;
  source: AdminLLMProviderSaveConfirmationSnapshotSource;
  formMode: AdminLLMProviderFormMode;
  providerId: AdminLLMProviderId | null;
  providerName: string;
  providerDisplayName: string;
  providerType: AdminLLMProviderType;
  baseUrlLength: number;
  modelLength: number;
  hasApiKeyInput: boolean;
  preservesExistingApiKey: boolean;
  willEnableProvider: boolean;
  willSetDefaultProvider: boolean;
  priority: number;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminLLMProviderConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminLLMProviderDeleteConfirmationSnapshot = {
  status: AdminLLMProviderDeleteConfirmationSnapshotStatus;
  source: AdminLLMProviderDeleteConfirmationSnapshotSource;
  providerId: AdminLLMProviderId | null;
  providerName: string | null;
  providerDisplayName: string | null;
  isDefaultProvider: boolean;
  isEnabled: boolean;
  isRuntimeLoaded: boolean;
  isRuntimeActive: boolean;
  isDeleting: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminLLMProviderConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminLLMProviderRuntimeMutationConfirmationSnapshot = {
  status: AdminLLMProviderRuntimeMutationConfirmationSnapshotStatus;
  source: AdminLLMProviderRuntimeMutationConfirmationSnapshotSource;
  action: AdminLLMProviderRuntimeMutationAction;
  providerId: AdminLLMProviderId | null;
  providerName: string | null;
  providerDisplayName: string | null;
  isDefaultProvider: boolean;
  isEnabled: boolean;
  nextEnabled: boolean | null;
  isRuntimeLoaded: boolean;
  isRuntimeActive: boolean;
  isMutating: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminLLMProviderConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminUsersPageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'editing' | 'saving' | 'save_failed' | 'delete_confirming' | 'deleting' | 'delete_failed';

export type AdminUsersPageSnapshotSource = 'user_list' | 'user_status' | 'user_role' | 'user_edit' | 'user_save' | 'user_delete';

export type AdminUserEditingId = AdminUserId;

export type AdminUserDeletingId = AdminUserId;

export type AdminUserEditableSnapshotStatus = 'none' | 'active' | 'disabled';

export type AdminUserEditableSnapshotRole = 'none' | 'user' | 'admin' | 'super_admin';

export type AdminUserDeleteSnapshotStatus = 'none' | 'active' | 'disabled' | 'deleted' | 'unknown';

export type AdminUserSaveConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'save_failed';

export type AdminUserSaveConfirmationSnapshotSource = 'dialog_state' | 'user_save' | 'role_update' | 'status_update';

export type AdminUserSaveConfirmationRiskLevel = 'none' | 'medium' | 'high';

export type AdminUserDeleteConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming' | 'delete_failed';

export type AdminUserDeleteConfirmationSnapshotSource = 'dialog_state' | 'user_delete';

export type AdminUserDeleteConfirmationRiskLevel = 'none' | 'high';

export type AdminUsersPageSnapshot = {
  status: AdminUsersPageSnapshotStatus;
  source: AdminUsersPageSnapshotSource;
  userCount: number;
  activeUserCount: number;
  disabledUserCount: number;
  deletedUserCount: number;
  unknownStatusCount: number;
  unknownRoleCount: number;
  unknownStatusValues: AdminUnknownRawValueList;
  unknownRoleValues: AdminUnknownRawValueList;
  namedUserCount: number;
  adminRoleCount: number;
  editingUserId: AdminUserEditingId | null;
  deletingUserId: AdminUserDeletingId | null;
  selectedRole: AdminUserEditableSnapshotRole;
  selectedStatus: AdminUserEditableSnapshotStatus;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  hasError: boolean;
  canStartEdit: boolean;
  canSave: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canReload: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminUserDeleteConfirmationSnapshot = {
  status: AdminUserDeleteConfirmationSnapshotStatus;
  source: AdminUserDeleteConfirmationSnapshotSource;
  userId: AdminUserId | null;
  userEmail: string;
  userStatus: AdminUserDeleteSnapshotStatus;
  isDeleting: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminUserDeleteConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminUserSaveConfirmationSnapshot = {
  status: AdminUserSaveConfirmationSnapshotStatus;
  source: AdminUserSaveConfirmationSnapshotSource;
  userId: AdminUserId | null;
  userEmail: string;
  userRole: AdminUserEditableSnapshotRole;
  userStatus: AdminUserEditableSnapshotStatus;
  isSaving: boolean;
  hasError: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AdminUserSaveConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminAuditPageSnapshotStatus = 'loading' | 'load_failed' | 'empty' | 'ready' | 'invalid_timestamp';

export type AdminAuditPageSnapshotSource = 'audit_list' | 'audit_action' | 'audit_target' | 'audit_timestamp';

export type AdminAuditPageSnapshot = {
  status: AdminAuditPageSnapshotStatus;
  source: AdminAuditPageSnapshotSource;
  logCount: number;
  actionCount: number;
  targetTypeCount: number;
  ipAddressCount: number;
  missingTargetCount: number;
  invalidTimestampCount: number;
  latestAction: string;
  latestTargetType: string;
  isLoading: boolean;
  hasError: boolean;
  canReload: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminRuntimeHealthSeverityFilterValue = 'all' | 'ready' | 'running' | 'blocked' | 'idle' | 'unknown';

export type AdminRuntimeHealthDynamicFilterValue = string;

export type AdminRuntimeHealthDiagnosticsSnapshotStatus = 'empty' | 'healthy' | 'issue_detected' | 'filtered' | 'filtered_empty' | 'focused' | 'copy_failed' | 'url_sync_failed';

export type AdminRuntimeHealthDiagnosticsSnapshotSource = 'runtime_projects' | 'runtime_filter' | 'runtime_project_drilldown' | 'diagnostic_link' | 'diagnostic_url';

export type AdminRuntimeHealthDiagnosticsSnapshot = {
  status: AdminRuntimeHealthDiagnosticsSnapshotStatus;
  source: AdminRuntimeHealthDiagnosticsSnapshotSource;
  totalProjectCount: number;
  matchedProjectCount: number;
  observedRuntimeCount: number;
  readyCount: number;
  runningCount: number;
  blockedCount: number;
  idleCount: number;
  unknownCount: number;
  priorityProjectCount: number;
  activeFilterCount: number;
  severityFilter: AdminRuntimeHealthSeverityFilterValue;
  statusFilter: AdminRuntimeHealthDynamicFilterValue;
  projectFilter: AdminRuntimeHealthDynamicFilterValue;
  hasFocusedProject: boolean;
  hasCopyError: boolean;
  hasUrlSyncError: boolean;
  canClearFilters: boolean;
  canCopyDiagnosticLink: boolean;
  canClearProjectDrilldown: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminProviderHealthSeverityFilterValue = 'all' | 'blocked' | 'warning' | 'idle' | 'ready';

export type AdminProviderHealthRuntimeFilterValue = 'all' | 'loaded' | 'not_loaded' | 'active' | 'inactive';

export type AdminProviderHealthDiagnosticsSnapshotStatus = 'empty' | 'healthy' | 'issue_detected' | 'filtered' | 'filtered_empty' | 'copy_failed' | 'url_sync_failed';

export type AdminProviderHealthDiagnosticsSnapshotSource = 'provider_snapshot' | 'provider_filter' | 'provider_runtime' | 'diagnostic_link' | 'diagnostic_url';

export type AdminProviderHealthDiagnosticsSnapshot = {
  status: AdminProviderHealthDiagnosticsSnapshotStatus;
  source: AdminProviderHealthDiagnosticsSnapshotSource;
  totalProviderCount: number;
  matchedProviderCount: number;
  enabledProviderCount: number;
  loadedProviderCount: number;
  driftCount: number;
  blockedCount: number;
  warningCount: number;
  readyCount: number;
  idleCount: number;
  priorityProviderCount: number;
  activeFilterCount: number;
  severityFilter: AdminProviderHealthSeverityFilterValue;
  runtimeFilter: AdminProviderHealthRuntimeFilterValue;
  defaultProviderName: string;
  activeProviderName: string;
  hasCopyError: boolean;
  hasUrlSyncError: boolean;
  canClearFilters: boolean;
  canCopyDiagnosticLink: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminAuditDynamicFilterValue = string;

export type AdminAuditDiagnosticsSnapshotStatus = 'empty' | 'ready' | 'activity_detected' | 'filtered' | 'filtered_empty' | 'copy_failed' | 'url_sync_failed';

export type AdminAuditDiagnosticsSnapshotSource = 'audit_logs' | 'audit_filter' | 'audit_context' | 'diagnostic_link' | 'diagnostic_url';

export type AdminAuditDiagnosticsSnapshot = {
  status: AdminAuditDiagnosticsSnapshotStatus;
  source: AdminAuditDiagnosticsSnapshotSource;
  totalLogCount: number;
  matchedLogCount: number;
  actionCount: number;
  targetTypeCount: number;
  topActionCount: number;
  targetTypeOptionCount: number;
  activeFilterCount: number;
  actionFilter: AdminAuditDynamicFilterValue;
  targetTypeFilter: AdminAuditDynamicFilterValue;
  latestAction: string;
  latestTargetType: string;
  hasLatestAt: boolean;
  hasCopyError: boolean;
  hasUrlSyncError: boolean;
  canClearFilters: boolean;
  canCopyDiagnosticLink: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminCapabilityPreflightDiagnosticsSnapshotStatus = 'unavailable' | 'empty' | 'healthy' | 'issue_detected' | 'filtered' | 'filtered_empty' | 'invalid_timestamp' | 'copy_failed' | 'url_sync_failed';

export type AdminCapabilityPreflightDiagnosticsSnapshotSource = 'provider_preflight' | 'provider_preflight_filter' | 'provider_preflight_snapshot' | 'diagnostic_link' | 'diagnostic_url';

export type AdminCapabilityPreflightTimestampState = 'available' | 'missing' | 'invalid';

export type AdminCapabilityPreflightDiagnosticsSnapshot = {
  status: AdminCapabilityPreflightDiagnosticsSnapshotStatus;
  source: AdminCapabilityPreflightDiagnosticsSnapshotSource;
  totalItemCount: number;
  matchedItemCount: number;
  providerCount: number;
  blockedProviderCount: number;
  readyProviderCount: number;
  skippedProviderCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  affectedConfigKeyCount: number;
  affectedReasonCodeCount: number;
  activeFilterCount: number;
  statusFilter: AdminCapabilityPreflightStatusFilterValue;
  severityFilter: AdminCapabilityPreflightSeverityFilterValue;
  configKeyFilter: AdminCapabilityPreflightDynamicFilterValue;
  reasonCodeFilter: AdminCapabilityPreflightDynamicFilterValue;
  timestampState: AdminCapabilityPreflightTimestampState;
  hasGeneratedAt: boolean;
  hasCopyError: boolean;
  hasUrlSyncError: boolean;
  canClearFilters: boolean;
  canCopyDiagnosticLink: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminCapabilityPreflightItemSnapshotStatus = 'blocked' | 'ready' | 'skipped' | 'action_required' | 'metadata_only' | 'config_scoped';

export type AdminCapabilityPreflightItemSnapshotSource = 'preflight_item' | 'severity' | 'reason_code' | 'metadata' | 'next_action';

export type AdminCapabilityPreflightItemStatus = CapabilityProviderPreflightStatus;

export type AdminCapabilityPreflightSeverity = CapabilityProviderPreflightSeverity;

export type AdminCapabilityPreflightProvider = CapabilityProviderPreflightProvider;

export type AdminCapabilityPreflightRunnerMode = CapabilityProviderPreflightRunnerMode;

export type AdminCapabilityPreflightReasonCode = CapabilityProviderPreflightReasonCode;

export type AdminCapabilityPreflightItemSnapshot = {
  status: AdminCapabilityPreflightItemSnapshotStatus;
  source: AdminCapabilityPreflightItemSnapshotSource;
  provider: AdminCapabilityPreflightProvider;
  runnerMode: AdminCapabilityPreflightRunnerMode;
  itemStatus: AdminCapabilityPreflightItemStatus;
  severity: AdminCapabilityPreflightSeverity;
  reasonCode: AdminCapabilityPreflightReasonCode;
  configKeyCount: number;
  metadataCount: number;
  hasNextAction: boolean;
  hasSourceNote: boolean;
  canInspectMetadata: boolean;
  canFollowNextAction: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminCapabilityPreflightStatusFilterValue = 'all' | 'ready' | 'skipped' | 'blocked';

export type AdminCapabilityPreflightSeverityFilterValue = 'all' | 'info' | 'warning' | 'critical';

export type AdminCapabilityPreflightDynamicFilterValue = string;

export type AdminCapabilityPreflightFiltersSnapshotStatus = 'idle' | 'active' | 'focused' | 'filtered_empty' | 'copy_failed' | 'copy_ready';

export type AdminCapabilityPreflightFiltersSnapshotSource = 'preflight_filters' | 'active_filters' | 'focus_summary' | 'diagnostic_link';

export type AdminCapabilityPreflightFiltersSnapshot = {
  status: AdminCapabilityPreflightFiltersSnapshotStatus;
  source: AdminCapabilityPreflightFiltersSnapshotSource;
  totalItemCount: number;
  matchedItemCount: number;
  activeFilterCount: number;
  statusFilter: AdminCapabilityPreflightStatusFilterValue;
  severityFilter: AdminCapabilityPreflightSeverityFilterValue;
  configKeyFilter: AdminCapabilityPreflightDynamicFilterValue;
  reasonCodeFilter: AdminCapabilityPreflightDynamicFilterValue;
  hasFocusedConfigKey: boolean;
  hasFocusedReasonCode: boolean;
  hasDiagnosticLinkCopyError: boolean;
  canClearFilters: boolean;
  canCopyDiagnosticLink: boolean;
  canClearConfigKeyFilter: boolean;
  canClearReasonCodeFilter: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminCapabilityPreflightRunbookItemSnapshotStatus = 'selected' | 'actionable' | 'provider_scoped' | 'reason_scoped' | 'empty_context';

export type AdminCapabilityPreflightRunbookItemSnapshotSource = 'config_key_runbook' | 'reason_code_runbook' | 'selection' | 'related_context';

export type AdminCapabilityPreflightRunbookKind = 'config_key' | 'reason_code';

export type AdminCapabilityPreflightRunbookItemSnapshot = {
  status: AdminCapabilityPreflightRunbookItemSnapshotStatus;
  source: AdminCapabilityPreflightRunbookItemSnapshotSource;
  kind: AdminCapabilityPreflightRunbookKind;
  value: string;
  providerCount: number;
  reasonCodeCount: number;
  configKeyCount: number;
  nextActionCount: number;
  isSelected: boolean;
  canSelect: boolean;
  canClearSelection: boolean;
  hasRelatedProviders: boolean;
  hasRelatedReasons: boolean;
  hasRelatedConfigKeys: boolean;
  hasNextActions: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminDashboardDiagnosticsLayoutSnapshotStatus = 'not_ready' | 'ready' | 'healthy' | 'warning' | 'critical' | 'audit_only';

export type AdminDashboardDiagnosticsLayoutSnapshotSource = 'diagnostics_layout' | 'health_summary' | 'focus_sections' | 'runbook' | 'priority_issues';

export type AdminDashboardDiagnosticsLayoutSnapshot = {
  status: AdminDashboardDiagnosticsLayoutSnapshotStatus;
  source: AdminDashboardDiagnosticsLayoutSnapshotSource;
  sectionCount: number;
  renderedSectionCount: number;
  focusSectionCount: number;
  runbookItemCount: number;
  priorityIssueCount: number;
  blockerCount: number;
  warningCount: number;
  pendingCount: number;
  auditSignalCount: number;
  hasPriorityDiagnostics: boolean;
  hasRuntimeDiagnostics: boolean;
  hasConfigDiagnostics: boolean;
  hasAuditDiagnostics: boolean;
  canNavigatePriority: boolean;
  canNavigateRuntime: boolean;
  canNavigateConfig: boolean;
  canNavigateAudit: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminDashboardQuickAccessSnapshotStatus = 'profile_missing' | 'empty' | 'limited' | 'ready' | 'super_admin_ready';

export type AdminDashboardQuickAccessSnapshotSource = 'admin_profile' | 'role_permissions' | 'quick_access_links';

export type AdminDashboardQuickAccessSnapshot = {
  status: AdminDashboardQuickAccessSnapshotStatus;
  source: AdminDashboardQuickAccessSnapshotSource;
  candidateLinkCount: number;
  visibleLinkCount: number;
  hiddenLinkCount: number;
  permissionCount: number;
  isSuperAdmin: boolean;
  hasLLMAccess: boolean;
  hasConfigAccess: boolean;
  hasUsersAccess: boolean;
  hasAuditAccess: boolean;
  hasAdminsAccess: boolean;
  hasRolesAccess: boolean;
  canNavigateAny: boolean;
  canNavigateLLM: boolean;
  canNavigateConfig: boolean;
  canNavigateUsers: boolean;
  canNavigateAudit: boolean;
  canNavigateAdmins: boolean;
  canNavigateRoles: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminDashboardStatsCardsSnapshotStatus = 'profile_missing' | 'loading' | 'empty' | 'partial' | 'ready' | 'super_admin_ready';

export type AdminDashboardStatsCardsSnapshotSource = 'admin_profile' | 'role_permissions' | 'dashboard_cards' | 'card_navigation';

export type AdminDashboardNavigationHref =
  | '/admin/llm'
  | '/admin/prompts'
  | '/admin/templates'
  | '/admin/config'
  | '/admin/users'
  | '/admin/audit'
  | '/admin/admins'
  | '/admin/roles'
  | '/admin/enterprise';

export type AdminDashboardStatsCardsSnapshot = {
  status: AdminDashboardStatsCardsSnapshotStatus;
  source: AdminDashboardStatsCardsSnapshotSource;
  expectedCardCount: number;
  loadedCardCount: number;
  missingCardCount: number;
  permissionCount: number;
  isSuperAdmin: boolean;
  hasProvidersCard: boolean;
  hasConfigsCard: boolean;
  hasUsersCard: boolean;
  hasAdminsCard: boolean;
  canNavigateAny: boolean;
  canNavigateProviders: boolean;
  canNavigateConfigs: boolean;
  canNavigateUsers: boolean;
  canNavigateAdmins: boolean;
  loading: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AdminDiagnosticSectionSnapshotStatus = 'empty' | 'healthy' | 'content' | 'critical' | 'warning' | 'info' | 'neutral';

export type AdminDiagnosticSectionSnapshotSource = 'section_props' | 'tone' | 'badges' | 'content' | 'message';

export type AdminDiagnosticTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

export type AdminDiagnosticSectionSnapshot = {
  status: AdminDiagnosticSectionSnapshotStatus;
  source: AdminDiagnosticSectionSnapshotSource;
  title: string;
  tone: AdminDiagnosticTone;
  badgeCount: number;
  criticalBadgeCount: number;
  warningBadgeCount: number;
  infoBadgeCount: number;
  successBadgeCount: number;
  hasContent: boolean;
  hasEmptyMessage: boolean;
  hasHealthyMessage: boolean;
  canRenderContent: boolean;
  canRenderEmptyMessage: boolean;
  canRenderHealthyMessage: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GuidanceActionKind =
  | 'send_prompt'
  | 'confirm_recommended_plan'
  | 'retry_plan_generation'
  | 'retry_context_gate'
  | 'retry_workflow_gate'
  | 'refresh_explorer_panel'
  | 'open_explorer_panel'
  | 'open_git_panel'
  | 'open_capability_audit'
  | 'open_validation_failure'
  | 'open_context_repair'
  | 'open_foundation_panel';

export type GuidanceAction = {
  label: string;
  kind: GuidanceActionKind;
  prompt?: string;
  mode?: WorkspaceGenerationMode;
  conversationStage?: WorkspaceBackendWorkflowStage;
  navigationTarget?: WorkspaceEditorNavigationTarget;
  capabilityAuditProfile?: string;
  capabilityAuditReasonCode?: string;
};

export type WorkspaceSuggestedQuestion = string;
export type WorkspaceSuggestedQuestionList = WorkspaceSuggestedQuestion[];
export type WorkspaceFallbackQuestion = string;
export type WorkspaceFallbackQuestionList = WorkspaceFallbackQuestion[];

export type WorkspaceGuidanceResolution = {
  suggestedQuestions: WorkspaceSuggestedQuestionList;
  suggestedActions: GuidanceAction[];
};

export type WorkspaceEventMessageResolver = (
  data: WorkspaceStreamEventData,
  fallback: WorkspaceEventMessageFallback,
) => WorkspaceEventMessage;

export type WorkspaceGeneratedFilesEventReader = (
  data: WorkspaceStreamEventData,
) => WorkspaceGeneratedFileList;

export type WorkspaceSuggestedQuestionsEventReader = (
  data: WorkspaceStreamEventData,
) => WorkspaceSuggestedQuestionList;

export type WorkspaceSuggestedActionsEventReader = (
  data: WorkspaceStreamEventData,
) => GuidanceAction[];

export type WorkspaceGeneratedFile = {
  path: string;
  content: string;
};

export type WorkspaceGeneratedFileList = WorkspaceGeneratedFile[];

export type WorkspaceGuidanceResolver = (
  data: WorkspaceStreamEventData,
  fallbackQuestions: WorkspaceFallbackQuestionList,
  fallbackActions: GuidanceAction[],
) => WorkspaceGuidanceResolution;

export type WorkspaceGuidanceSnapshotStatus = 'empty' | 'questions_only' | 'actions_available' | 'mixed' | 'recovery_fallback';

export type WorkspaceGuidanceSnapshotSource = 'suggested_questions' | 'suggested_actions' | 'engineering_recovery';

export type WorkspaceGuidanceSnapshot = {
  status: WorkspaceGuidanceSnapshotStatus;
  source: WorkspaceGuidanceSnapshotSource;
  questionCount: number;
  actionCount: number;
  primaryActionCount: number;
  retryActionCount: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type MessageRenderSnapshotStatus = 'code_idle' | 'code_copied' | 'code_copy_failed' | 'mermaid_rendering' | 'mermaid_rendered' | 'mermaid_failed';

export type MessageRenderSnapshotSource = 'code_block' | 'clipboard' | 'mermaid_render';

export type MermaidMessageRenderSnapshotStatus = 'mermaid_rendering' | 'mermaid_rendered' | 'mermaid_failed';

export type MessageRenderSnapshot = {
  status: MessageRenderSnapshotStatus;
  source: MessageRenderSnapshotSource;
  language: string;
  contentLength: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkflowSectionSnapshotStatus = 'running' | 'failed' | 'open' | 'collapsed' | 'empty_lines';

export type WorkflowSectionSnapshotSource = 'workflow_steps' | 'streaming' | 'user_toggle' | 'display_filter';

export type WorkflowSectionKind = 'file_ops' | 'other';

export type WorkflowSectionSnapshot = {
  status: WorkflowSectionSnapshotStatus;
  source: WorkflowSectionSnapshotSource;
  sectionKind: WorkflowSectionKind;
  stepCount: number;
  runningCount: number;
  failedCount: number;
  visibleLineCount: number;
  isOpen: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ChatMessageSnapshotStatus = 'user_message' | 'system_message' | 'assistant_streaming' | 'workflow_running' | 'workflow_failed' | 'engineering_failed' | 'guidance_available' | 'commit_attached' | 'content_only' | 'empty_message';

export type ChatMessageSnapshotSource = 'message_role' | 'streaming' | 'workflow_steps' | 'engineering_state' | 'guidance' | 'commit' | 'content';

export type ChatMessageRole = SharedChatMessageRole;

export type ChatMessageSnapshot = {
  status: ChatMessageSnapshotStatus;
  source: ChatMessageSnapshotSource;
  role: ChatMessageRole;
  workflowStepCount: number;
  visibleStepCount: number;
  suggestedQuestionCount: number;
  guidanceActionCount: number;
  hasEngineeringState: boolean;
  hasSummary: boolean;
  hasReasoning: boolean;
  hasStatus: boolean;
  hasRelatedCommit: boolean;
  isStreaming: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ChatThoughtProcessSnapshotStatus = 'empty' | 'streaming' | 'expanded' | 'collapsed' | 'settled';

export type ChatThoughtProcessSnapshotSource = 'reasoning_content' | 'status_content' | 'user_toggle' | 'message_restore';

export type ChatThoughtProcessContentKind = 'reasoning' | 'status_fallback';

export type ChatThoughtProcessSnapshot = {
  status: ChatThoughtProcessSnapshotStatus;
  source: ChatThoughtProcessSnapshotSource;
  contentKind: ChatThoughtProcessContentKind;
  contentLength: number;
  isOpen: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type CommitSummarySnapshotStatus = 'ready' | 'restore_only' | 'view_only' | 'actions_missing' | 'summary_missing';

export type CommitSummarySnapshotSource = 'commit_metadata' | 'commit_actions';

export type CommitSummarySnapshot = {
  status: CommitSummarySnapshotStatus;
  source: CommitSummarySnapshotSource;
  shortHash: string;
  hasMessage: boolean;
  canRestore: boolean;
  canView: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type EngineeringStatePanelSnapshotStatus = 'ready' | 'running' | 'awaiting_confirmation' | 'recoverable' | 'failed' | 'foundation_blocked';

export type EngineeringStatePanelSnapshotSource = 'rows' | 'phase' | 'execution' | 'recovery' | 'validation' | 'foundation';

export type EngineeringStatePanelSnapshot = {
  status: EngineeringStatePanelSnapshotStatus;
  source: EngineeringStatePanelSnapshotSource;
  rowCount: number;
  failureItemCount: number;
  blockerCount: number;
  recoveryActionCount: number;
  primaryActionCount: number;
  retryActionCount: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ValidationGateBlockedSnapshotStatus = 'validation_blocked' | 'context_blocked' | 'repair_targets_available' | 'repair_targets_missing';

export type ValidationGateBlockedSnapshotSource = 'validation_state' | 'context_gate' | 'gate_result' | 'repair_targets';

export type ValidationGateBlockedSnapshot = {
  status: ValidationGateBlockedSnapshotStatus;
  source: ValidationGateBlockedSnapshotSource;
  gate: string;
  failureItemCount: number;
  repairTargetCount: number;
  canOpenRepairTarget: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type CapabilityAuditPanelSnapshotStatus = 'idle_without_project' | 'loading' | 'ready' | 'load_failed' | 'filter_url_synced' | 'filter_url_stale' | 'link_copied' | 'link_copy_failed';

export type CapabilityAuditPanelSnapshotSource = 'project_binding' | 'audit_load' | 'browser_history' | 'clipboard';

export type CapabilityAuditPanelSnapshot = {
  status: CapabilityAuditPanelSnapshotStatus;
  source: CapabilityAuditPanelSnapshotSource;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type DebugPanelContextSnapshotStatus = 'idle_without_project' | 'manual_debug' | 'runtime_drilldown' | 'capability_filter_drilldown' | 'combined_drilldown';

export type DebugPanelContextSnapshotSource = 'project_binding' | 'debug_tab' | 'runtime_health' | 'capability_audit' | 'runtime_and_capability';

export type DebugPanelContextUrlParam = string;
export type DebugPanelContextUrlParamList = DebugPanelContextUrlParam[];

export type DebugPanelContextSnapshot = {
  status: DebugPanelContextSnapshotStatus;
  source: DebugPanelContextSnapshotSource;
  message: string;
  recovery: string;
  urlParams: DebugPanelContextUrlParamList;
  updatedAt: string;
};

export type FoundationPanelSnapshotStatus = 'empty' | 'ready' | 'busy' | 'awaiting_decisions' | 'foundation_blocked' | 'context_blocked' | 'completed';

export type FoundationPanelSnapshotSource = 'bootstrap_state' | 'gate_result' | 'context_gate' | 'decision_drafts' | 'action_state';

export type FoundationPanelSnapshot = {
  status: FoundationPanelSnapshotStatus;
  source: FoundationPanelSnapshotSource;
  requiredDecisionCount: number;
  reservedDecisionCount: number;
  deferredDecisionCount: number;
  blockerCount: number;
  contextRepairTargetCount: number;
  canConfirm: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitPanelSnapshotStatus = 'empty' | 'fresh' | 'list_stale_with_cache' | 'list_stale_without_cache' | 'detail_stale' | 'selected' | 'diff_empty';

export type GitPanelSnapshotSource = 'commit_list' | 'list_status' | 'detail_status' | 'selection' | 'diff';

export type GitPanelSnapshot = {
  status: GitPanelSnapshotStatus;
  source: GitPanelSnapshotSource;
  commitCount: number;
  hasSelectedCommit: boolean;
  selectedHash: string;
  diffFileCount: number;
  listStatus: GitCommitListStatusValue | 'unknown';
  detailStatus: GitCommitDetailStatusValue | 'none';
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitCommitDetailSnapshotStatus = 'no_selection' | 'stale_detail' | 'diff_ready' | 'diff_empty' | 'metadata_missing' | 'ready';

export type GitCommitDetailSnapshotSource = 'selection' | 'detail_status' | 'diff' | 'metadata' | 'commit_detail';

export type GitCommitDetailSnapshot = {
  status: GitCommitDetailSnapshotStatus;
  source: GitCommitDetailSnapshotSource;
  hash: string;
  shortHash: string;
  fileCount: number;
  diffFileCount: number;
  diffLineCount: number;
  hasMessage: boolean;
  hasAuthor: boolean;
  hasEmail: boolean;
  hasTime: boolean;
  hasStaleDetail: boolean;
  canInspectDiff: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitBranchSnapshotStatus = 'confirmed' | 'branch_list_current' | 'branch_list_stale' | 'inferred_from_commit' | 'missing';

export type GitBranchSnapshotSource = 'branch_list' | 'branch_list_status' | 'project_info' | 'commit_branches' | 'metadata';

export type GitBranchSnapshot = {
  status: GitBranchSnapshotStatus;
  source: GitBranchSnapshotSource;
  branch: string;
  branchCount: number;
  currentBranchCount: number;
  hasProjectBranch: boolean;
  hasBranchList: boolean;
  commitBranchCount: number;
  selectedCommitHasBranch: boolean;
  isDefaultBranch: boolean;
  listStatus: GitBranchListStatusValue | 'unknown';
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitBranchMutationConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitBranchMutationConfirmationSnapshotSource = 'dialog_state' | 'branch_create' | 'branch_delete' | 'branch_rename';

export type GitBranchMutationConfirmationSnapshotAction = 'none' | 'create' | 'delete' | 'rename';

export type GitBranchMutationConfirmationAction = 'create' | 'delete' | 'rename';

export type GitBranchMutationConfirmationRiskLevel = 'medium' | 'high';

export type GitBranchMutationConfirmationSnapshot = {
  status: GitBranchMutationConfirmationSnapshotStatus;
  source: GitBranchMutationConfirmationSnapshotSource;
  action: GitBranchMutationConfirmationSnapshotAction;
  branchName: string | null;
  nextBranchName: string | null;
  currentBranch: string;
  hasBranch: boolean;
  hasNextBranch: boolean;
  isCurrentBranch: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitBranchMutationConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitBranchSwitchConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitBranchSwitchConfirmationSnapshotSource = 'dialog_state' | 'branch_switch';

export type GitBranchSwitchConfirmationSnapshotAction = 'none' | 'switch';

export type GitBranchSwitchConfirmationRiskLevel = 'high';

export type GitBranchSwitchConfirmationSnapshot = {
  status: GitBranchSwitchConfirmationSnapshotStatus;
  source: GitBranchSwitchConfirmationSnapshotSource;
  action: GitBranchSwitchConfirmationSnapshotAction;
  currentBranch: string | null;
  targetBranch: string | null;
  readinessStatus: string;
  dirtyFiles: number;
  hasCurrentBranch: boolean;
  hasTargetBranch: boolean;
  isSameBranch: boolean;
  readinessAllowsSwitch: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitBranchSwitchConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitTagMutationConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitTagMutationConfirmationSnapshotSource = 'dialog_state' | 'tag_create' | 'tag_delete';

export type GitTagMutationConfirmationSnapshotAction = 'none' | 'create' | 'delete';

export type GitTagMutationConfirmationAction = 'create' | 'delete';

export type GitTagMutationConfirmationRiskLevel = 'high';

export type GitTagMutationConfirmationSnapshot = {
  status: GitTagMutationConfirmationSnapshotStatus;
  source: GitTagMutationConfirmationSnapshotSource;
  action: GitTagMutationConfirmationSnapshotAction;
  tagName: string | null;
  targetCommit: string | null;
  hasTag: boolean;
  hasTargetCommit: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitTagMutationConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitRemoteBranchSnapshotStatus = 'ready' | 'empty' | 'stale_with_cache' | 'stale_without_cache';

export type GitRemoteBranchSnapshotSource = 'remote_branch_list' | 'remote_branch_list_status';

export type GitRemoteBranchSnapshot = {
  status: GitRemoteBranchSnapshotStatus;
  source: GitRemoteBranchSnapshotSource;
  remoteBranchCount: number;
  remoteCount: number;
  hasRemoteBranches: boolean;
  listStatus: GitRemoteBranchListStatusValue | 'unknown';
  latestRemoteBranch: string;
  latestRemote: string;
  latestBranch: string;
  latestCommit: string;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitRemoteBranchRefreshConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitRemoteBranchRefreshConfirmationSnapshotSource = 'dialog_state' | 'remote_branch_refresh';

export type GitRemoteBranchRefreshConfirmationSnapshotAction = 'none' | 'refresh';

export type GitRemoteBranchRefreshConfirmationRiskLevel = 'high';

export type GitRemoteBranchRefreshConfirmationSnapshot = {
  status: GitRemoteBranchRefreshConfirmationSnapshotStatus;
  source: GitRemoteBranchRefreshConfirmationSnapshotSource;
  action: GitRemoteBranchRefreshConfirmationSnapshotAction;
  remoteName: string | null;
  hasRemote: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitRemoteBranchRefreshConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitRemoteBranchCreateConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitRemoteBranchCreateConfirmationSnapshotSource = 'dialog_state' | 'remote_branch_create';

export type GitRemoteBranchCreateConfirmationSnapshotAction = 'none' | 'create_tracking';

export type GitRemoteBranchCreateConfirmationRiskLevel = 'medium';

export type GitRemoteBranchCreateConfirmationSnapshot = {
  status: GitRemoteBranchCreateConfirmationSnapshotStatus;
  source: GitRemoteBranchCreateConfirmationSnapshotSource;
  action: GitRemoteBranchCreateConfirmationSnapshotAction;
  remoteBranchName: string | null;
  localBranchName: string | null;
  hasRemoteBranch: boolean;
  hasLocalBranch: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitRemoteBranchCreateConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitTagSnapshotStatus = 'ready' | 'empty' | 'stale_with_cache' | 'stale_without_cache';

export type GitTagSnapshotSource = 'tag_list' | 'tag_list_status';

export type GitTagSnapshot = {
  status: GitTagSnapshotStatus;
  source: GitTagSnapshotSource;
  tagCount: number;
  hasTags: boolean;
  listStatus: GitTagListStatusValue | 'unknown';
  latestTag: string;
  latestTargetCommit: string;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitStashSnapshotStatus = 'ready' | 'empty' | 'stale_with_cache' | 'stale_without_cache';

export type GitStashSnapshotSource = 'stash_list' | 'stash_list_status';

export type GitStashSnapshot = {
  status: GitStashSnapshotStatus;
  source: GitStashSnapshotSource;
  stashCount: number;
  hasStashes: boolean;
  listStatus: GitStashListStatusValue | 'unknown';
  latestRef: string;
  latestBranch: string;
  latestTargetCommit: string;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitStashMutationConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitStashMutationConfirmationSnapshotSource = 'dialog_state' | 'stash_apply' | 'stash_create';

export type GitStashMutationConfirmationSnapshotAction = 'none' | 'apply' | 'create';

export type GitStashMutationConfirmationAction = 'apply' | 'create';

export type GitStashMutationConfirmationRiskLevel = 'high';

export type GitStashMutationConfirmationSnapshot = {
  status: GitStashMutationConfirmationSnapshotStatus;
  source: GitStashMutationConfirmationSnapshotSource;
  action: GitStashMutationConfirmationSnapshotAction;
  stashRef: string | null;
  stashMessage: string | null;
  branch: string | null;
  targetCommit: string | null;
  hasStashRef: boolean;
  hasStashMessage: boolean;
  hasTargetCommit: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitStashMutationConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitWorktreeSnapshotStatus = 'clean' | 'dirty' | 'stale_with_cache' | 'stale_without_cache' | 'missing';

export type GitWorktreeSnapshotSource = 'worktree_status' | 'worktree_status_cache' | 'worktree_diff' | 'metadata';

export type GitWorktreeVisibleDirtyFile = string;
export type GitWorktreeVisibleDirtyFileList = GitWorktreeVisibleDirtyFile[];

export type GitWorktreeSnapshot = {
  status: GitWorktreeSnapshotStatus;
  source: GitWorktreeSnapshotSource;
  currentBranch: string;
  dirtyFiles: number;
  visibleDirtyFiles: GitWorktreeVisibleDirtyFileList;
  hiddenDirtyFileCount: number;
  diffFileCount: number;
  additions: number;
  deletions: number;
  hasDiffPreview: boolean;
  hasStatus: boolean;
  statusValue: GitWorktreeStatusStateValue | 'unknown';
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitWorktreeCommitConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitWorktreeCommitConfirmationSnapshotSource = 'dialog_state' | 'worktree_commit';

export type GitWorktreeCommitConfirmationSnapshotAction = 'none' | 'commit';

export type GitWorktreeCommitConfirmationRiskLevel = 'high';

export type GitWorktreeCommitConfirmationSnapshot = {
  status: GitWorktreeCommitConfirmationSnapshotStatus;
  source: GitWorktreeCommitConfirmationSnapshotSource;
  action: GitWorktreeCommitConfirmationSnapshotAction;
  commitMessage: string | null;
  messageLength: number;
  currentBranch: string;
  dirtyFiles: number;
  hasMessage: boolean;
  hasDirtyFiles: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitWorktreeCommitConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitWorktreeFileDiscardConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitWorktreeFileDiscardConfirmationSnapshotSource = 'dialog_state' | 'worktree_file_discard';

export type GitWorktreeFileDiscardConfirmationSnapshotAction = 'none' | 'discard';

export type GitWorktreeFileDiscardConfirmationRiskLevel = 'high';

export type GitWorktreeFileDiscardConfirmationSnapshot = {
  status: GitWorktreeFileDiscardConfirmationSnapshotStatus;
  source: GitWorktreeFileDiscardConfirmationSnapshotSource;
  action: GitWorktreeFileDiscardConfirmationSnapshotAction;
  filePath: string | null;
  hasPath: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitWorktreeFileDiscardConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitBranchCompareSnapshotStatus = 'ready' | 'no_target' | 'stale_with_cache' | 'stale_without_cache' | 'empty' | 'missing';

export type GitBranchCompareSnapshotSource = 'branch_compare' | 'branch_compare_status' | 'branch_list' | 'metadata';

export type GitBranchCompareSnapshot = {
  status: GitBranchCompareSnapshotStatus;
  source: GitBranchCompareSnapshotSource;
  baseBranch: string;
  headBranch: string;
  commitsAhead: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  filePreview: GitBranchCompareFile[];
  hiddenFileCount: number;
  filePatchPreviewCount: number;
  commitPreview: GitBranchCompareCommit[];
  hiddenCommitCount: number;
  hasCompare: boolean;
  hasTarget: boolean;
  statusValue: GitBranchCompareStatusValue | 'unknown';
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitBranchCompareFileApplyConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitBranchCompareFileApplyConfirmationSnapshotSource = 'dialog_state' | 'branch_compare_file_apply';

export type GitBranchCompareFileApplyConfirmationSnapshotAction = 'none' | 'apply';

export type GitBranchCompareFileApplyConfirmationRiskLevel = 'high';

export type GitBranchCompareFileApplyConfirmationSnapshot = {
  status: GitBranchCompareFileApplyConfirmationSnapshotStatus;
  source: GitBranchCompareFileApplyConfirmationSnapshotSource;
  action: GitBranchCompareFileApplyConfirmationSnapshotAction;
  baseBranch: string | null;
  headBranch: string | null;
  filePath: string | null;
  hasBaseBranch: boolean;
  hasHeadBranch: boolean;
  hasPath: boolean;
  isSameBranch: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitBranchCompareFileApplyConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitCommitFileRestoreConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type GitCommitFileRestoreConfirmationSnapshotSource = 'dialog_state' | 'commit_file_restore';

export type GitCommitFileRestoreConfirmationSnapshotAction = 'none' | 'restore';

export type GitCommitFileRestoreConfirmationRiskLevel = 'high';

export type GitCommitFileRestoreConfirmationSnapshot = {
  status: GitCommitFileRestoreConfirmationSnapshotStatus;
  source: GitCommitFileRestoreConfirmationSnapshotSource;
  action: GitCommitFileRestoreConfirmationSnapshotAction;
  commitHash: string | null;
  shortHash: string;
  filePath: string | null;
  hasCommit: boolean;
  hasFilePath: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: GitCommitFileRestoreConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceCommitRestoreConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type WorkspaceCommitRestoreConfirmationSnapshotSource = 'dialog_state' | 'commit_restore';

export type WorkspaceCommitRestoreConfirmationSnapshotAction = 'none' | 'restore';

export type WorkspaceCommitRestoreConfirmationRiskLevel = 'critical';

export type WorkspaceCommitRestoreConfirmationSnapshot = {
  status: WorkspaceCommitRestoreConfirmationSnapshotStatus;
  source: WorkspaceCommitRestoreConfirmationSnapshotSource;
  action: WorkspaceCommitRestoreConfirmationSnapshotAction;
  commitHash: string | null;
  shortHash: string;
  commitMessage: string | null;
  author: string | null;
  hasCommit: boolean;
  hasMessage: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: WorkspaceCommitRestoreConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceExplorerOperationConfirmationSnapshotStatus = 'closed' | 'awaiting_input' | 'blocked' | 'awaiting_confirmation' | 'confirming';

export type WorkspaceExplorerOperationConfirmationSnapshotSource = 'dialog_state' | 'explorer_context_operation';

export type WorkspaceExplorerOperationConfirmationSnapshotAction = 'none' | 'create' | 'rename' | 'delete';

export type WorkspaceExplorerOperationConfirmationRiskLevel = 'none' | 'low' | 'medium' | 'high';

export type WorkspaceExplorerOperationConfirmationSnapshot = {
  status: WorkspaceExplorerOperationConfirmationSnapshotStatus;
  source: WorkspaceExplorerOperationConfirmationSnapshotSource;
  operation: WorkspaceExplorerContextOperation | 'none';
  action: WorkspaceExplorerOperationConfirmationSnapshotAction;
  label: string;
  nodePath: string | null;
  nodeName: string | null;
  inputName: string | null;
  targetPath: string | null;
  inputError: string | null;
  hasPendingOperation: boolean;
  hasTargetPath: boolean;
  isCreateOperation: boolean;
  isRenameOperation: boolean;
  isDeleteOperation: boolean;
  dirtyTargetCount: number;
  savedCacheTargetCount: number;
  openTargetCount: number;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: WorkspaceExplorerOperationConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceDirtyCloseConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation';

export type WorkspaceDirtyCloseConfirmationSnapshotSource = 'dialog_state' | 'dirty_close';

export type WorkspaceDirtyCloseConfirmationSnapshotAction = 'none' | 'choose_save_or_discard';

export type WorkspaceDirtyCloseConfirmationRiskLevel = 'none' | 'high';

export type WorkspaceDirtyCloseConfirmationSnapshot = {
  status: WorkspaceDirtyCloseConfirmationSnapshotStatus;
  source: WorkspaceDirtyCloseConfirmationSnapshotSource;
  action: WorkspaceDirtyCloseConfirmationSnapshotAction;
  filePath: string | null;
  fileName: string | null;
  hasFile: boolean;
  hasEditorBuffer: boolean;
  hasSavedSnapshot: boolean;
  canCancel: boolean;
  canDiscard: boolean;
  canSaveAndClose: boolean;
  riskLevel: WorkspaceDirtyCloseConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitCommitItemSnapshotStatus = 'selected' | 'stale_detail' | 'diff_ready' | 'diff_empty' | 'metadata_missing' | 'ready';

export type GitCommitItemSnapshotSource = 'commit_item' | 'selection' | 'detail_status' | 'diff' | 'metadata';

export type GitCommitItemSnapshot = {
  status: GitCommitItemSnapshotStatus;
  source: GitCommitItemSnapshotSource;
  hash: string;
  shortHash: string;
  index: number;
  fileCount: number;
  diffFileCount: number;
  hasMessage: boolean;
  hasAuthor: boolean;
  hasTime: boolean;
  isSelected: boolean;
  hasStaleDetail: boolean;
  canView: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type GitDiffFileItemSnapshotStatus = 'added_only' | 'deleted_only' | 'mixed_changes' | 'metadata_only' | 'empty_diff' | 'path_missing';

export type GitDiffFileItemSnapshotSource = 'diff_file' | 'diff_stats' | 'diff_content' | 'metadata';

export type GitDiffFileItemSnapshot = {
  status: GitDiffFileItemSnapshotStatus;
  source: GitDiffFileItemSnapshotSource;
  path: string;
  index: number;
  additions: number;
  deletions: number;
  lineCount: number;
  hasPath: boolean;
  hasContent: boolean;
  hasAdditions: boolean;
  hasDeletions: boolean;
  canExpand: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceEditorNavigationTarget = {
  path: string;
  searchText?: string;
  lineNumber?: number;
  column?: number;
  label?: string;
};

export type WorkspaceOpenFilePath = string;
export type WorkspaceOpenFilePathList = WorkspaceOpenFilePath[];
export type WorkspaceBrowserHistoryUrl = string;
export type WorkspaceBrowserHistoryUrlList = WorkspaceBrowserHistoryUrl[];

export type ExplorerSnapshotStatusValue = 'fresh' | 'stale_with_snapshot' | 'stale_without_snapshot' | 'stale_with_local_changes' | 'stale_with_stream_preview';

export type ExplorerSnapshotStatusSource = 'project_detail' | 'file_tree_refresh' | 'manual_refresh' | 'workspace_bootstrap' | 'local_file_operation' | 'implementation_stream';

export type ExplorerSnapshotStatus = {
  status: ExplorerSnapshotStatusValue;
  source: ExplorerSnapshotStatusSource;
  message: string;
  updatedAt: string;
};

export type GitCommitDetailStatusValue = 'fresh' | 'stale_from_cache';

export type GitCommitDetailStatusSource = 'commit_detail' | 'commit_list_refresh' | 'view_commit_cache_fallback' | 'commit_restore';

export type GitCommitDetailStatus = {
  status: GitCommitDetailStatusValue;
  source: GitCommitDetailStatusSource;
  commitHash: string;
  message: string;
  updatedAt: string;
};

export type GitCommitListStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache';

export type GitCommitListStatusSource = 'commit_list_refresh' | 'workspace_bootstrap';

export type GitCommitListStatus = {
  status: GitCommitListStatusValue;
  source: GitCommitListStatusSource;
  message: string;
  updatedAt: string;
};

export type GitBranchListStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache';

export type GitBranchListStatusSource = 'branch_list_refresh' | 'workspace_bootstrap';

export type GitBranchListStatus = {
  status: GitBranchListStatusValue;
  source: GitBranchListStatusSource;
  message: string;
  updatedAt: string;
};

export type GitRemoteListStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache';

export type GitRemoteListStatusSource = 'remote_list_refresh' | 'workspace_bootstrap';

export type GitRemoteListStatus = {
  status: GitRemoteListStatusValue;
  source: GitRemoteListStatusSource;
  message: string;
  updatedAt: string;
};

export type GitRemoteBranchListStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache';

export type GitRemoteBranchListStatusSource = 'remote_branch_list_refresh' | 'workspace_bootstrap';

export type GitRemoteBranchListStatus = {
  status: GitRemoteBranchListStatusValue;
  source: GitRemoteBranchListStatusSource;
  message: string;
  updatedAt: string;
};

export type GitTagListStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache';

export type GitTagListStatusSource = 'tag_list_refresh' | 'workspace_bootstrap';

export type GitTagListStatus = {
  status: GitTagListStatusValue;
  source: GitTagListStatusSource;
  message: string;
  updatedAt: string;
};

export type GitStashListStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache';

export type GitStashListStatusSource = 'stash_list_refresh' | 'workspace_bootstrap';

export type GitStashListStatus = {
  status: GitStashListStatusValue;
  source: GitStashListStatusSource;
  message: string;
  updatedAt: string;
};

export type GitWorktreeCleanlinessStatus = ApiGitWorktreeCleanlinessStatus;

export type GitWorktreeStatusStateValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache';

export type GitWorktreeStatusStateSource = 'worktree_status_refresh' | 'workspace_bootstrap';

export type GitWorktreeStatusState = {
  status: GitWorktreeStatusStateValue;
  source: GitWorktreeStatusStateSource;
  message: string;
  updatedAt: string;
};

export type GitBranchCompareStatusValue = 'fresh' | 'stale_with_cache' | 'stale_without_cache' | 'no_target';

export type GitBranchCompareStatusSource = 'branch_compare_refresh' | 'branch_list_refresh' | 'workspace_bootstrap';

export type GitBranchCompareStatus = {
  status: GitBranchCompareStatusValue;
  source: GitBranchCompareStatusSource;
  baseBranch: string;
  headBranch: string;
  message: string;
  updatedAt: string;
};

export type WorkspaceGitBranchCompare = GitBranchCompare;

export type EditorBufferStatusValue = 'backend_fresh' | 'dirty_buffer' | 'saved_snapshot' | 'local_preview' | 'stale_from_cache';

export type EditorBufferStatusSource = 'file_read' | 'file_save' | 'user_edit' | 'mobile_edit' | 'open_file_cache' | 'implementation_stream' | 'local_file_operation';

export type DirtyEditorBufferStatusSource = 'user_edit' | 'mobile_edit';

export type ImplementationStreamEditorBufferPhase = 'running' | 'applied';

export type EditorPanelSnapshotStatus = 'empty' | 'clean' | 'dirty' | 'saved_snapshot' | 'local_preview' | 'stale_from_cache' | 'navigation_pending';

export type EditorPanelSnapshotSource = 'active_file' | 'editor_buffer' | 'dirty_state' | 'navigation_target' | 'empty_editor';

export type EditorBufferStatus = {
  status: EditorBufferStatusValue;
  source: EditorBufferStatusSource;
  filePath: string;
  message: string;
  updatedAt: string;
};

export type EditorPanelSnapshot = {
  status: EditorPanelSnapshotStatus;
  source: EditorPanelSnapshotSource;
  surface: WorkspacePanelSurface;
  activeFile: string;
  bufferStatus: EditorBufferStatusValue | 'none';
  isDirty: boolean;
  canSave: boolean;
  canCopy: boolean;
  hasNavigationTarget: boolean;
  contentLength: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ExplorerPanelSnapshotStatus = 'empty_tree' | 'filtered_empty' | 'ready' | 'stale_snapshot' | 'local_changes' | 'stream_preview' | 'active_dirty' | 'active_stale';

export type ExplorerPanelSnapshotSource = 'file_tree' | 'search_filter' | 'explorer_snapshot' | 'editor_buffer' | 'open_files';

export type ExplorerPanelSnapshot = {
  status: ExplorerPanelSnapshotStatus;
  source: ExplorerPanelSnapshotSource;
  hasOriginalFileTreeData: boolean;
  filteredItemCount: number;
  openFileCount: number;
  hasActiveFile: boolean;
  activeFile: string;
  activeBufferStatus: EditorBufferStatusValue | 'none';
  isActiveDirty: boolean;
  searchQuery: string;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type PreviewUrlStatusValue = 'runtime_fresh' | 'project_detail_snapshot' | 'workspace_bootstrap_snapshot' | 'manual_input' | 'mobile_history' | 'stale_after_build_failure' | 'empty';

export type PreviewUrlStatusValueList = readonly PreviewUrlStatusValue[];

export type PreviewUrlStatusSource = 'runtime_status' | 'project_detail' | 'workspace_bootstrap' | 'manual_input' | 'mobile_navigation' | 'preview_url_build';

export type PreviewPanelSnapshotStatus = 'empty' | 'ready' | 'stale_url' | 'iframe_failed' | 'runtime_home_available' | 'manual_input';

export type PreviewPanelSnapshotSource = 'preview_url_status' | 'browser_url' | 'iframe' | 'runtime_status' | 'manual_input';

export type PreviewUrlStatus = {
  status: PreviewUrlStatusValue;
  source: PreviewUrlStatusSource;
  surface: WorkspacePreviewUrlSurface;
  url: string;
  message: string;
  updatedAt: string;
};

export type PreviewPanelSnapshot = {
  status: PreviewPanelSnapshotStatus;
  source: PreviewPanelSnapshotSource;
  surface: WorkspacePanelSurface;
  device: WorkspaceBrowserDevice;
  url: string;
  urlStatus: PreviewUrlStatusValue | 'unknown';
  canReload: boolean;
  canOpenRuntimeHome: boolean;
  hasIframeError: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type RuntimeHealthRecoveryConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type RuntimeHealthRecoveryConfirmationSnapshotSource = 'dialog_state' | 'runtime_health_recovery';

export type RuntimeHealthRecoveryConfirmationSnapshotAction = 'none' | 'recover_runtime';

export type RuntimeHealthRecoveryConfirmationRiskLevel = 'none' | 'medium';

export type RuntimeHealthRecoveryConfirmationReasonCode = RuntimeHealthRestartReasonCode;

export type RuntimeHealthRecoveryConfirmationSnapshot = {
  status: RuntimeHealthRecoveryConfirmationSnapshotStatus;
  source: RuntimeHealthRecoveryConfirmationSnapshotSource;
  action: RuntimeHealthRecoveryConfirmationSnapshotAction;
  reasonCode: RuntimeHealthRecoveryConfirmationReasonCode | null;
  actionLabel: string | null;
  actionDescription: string | null;
  hasRecoveryAction: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: RuntimeHealthRecoveryConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ChatScrollSnapshotStatus = 'empty_messages' | 'following_latest' | 'paused_by_user' | 'restored_to_latest' | 'container_missing';

export type ChatScrollSnapshotSource = 'message_list' | 'user_scroll' | 'manual_restore' | 'scroll_effect';

export type ChatScrollSnapshot = {
  status: ChatScrollSnapshotStatus;
  source: ChatScrollSnapshotSource;
  distanceToBottom: number | null;
  messageCount: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ChatInputSnapshotStatus = 'empty_prompt' | 'ready_to_send' | 'plan_selection_required' | 'planning' | 'generating' | 'stop_confirmation' | 'model_unconfigured';

export type ChatInputSnapshotSource = 'input_buffer' | 'plan_selection' | 'generation_state' | 'stop_control' | 'model_registry';

export type ChatInputSnapshot = {
  status: ChatInputSnapshotStatus;
  source: ChatInputSnapshotSource;
  canSend: boolean;
  promptLength: number;
  attachmentCount: number;
  selectedModel: string;
  modelCount: number;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ChatModelRegistrySnapshotStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'load_failed' | 'default_selected';

export type ChatModelRegistrySnapshotSource = 'model_registry' | 'llm_provider_api' | 'default_provider';

export type ChatModelRegistrySnapshot = {
  status: ChatModelRegistrySnapshotStatus;
  source: ChatModelRegistrySnapshotSource;
  modelCount: number;
  selectedModel: string;
  defaultModel: string | null;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ChatAttachmentSnapshotStatus = 'empty' | 'selected' | 'removed' | 'picker_empty';

export type ChatAttachmentSnapshotSource = 'attachment_state' | 'file_picker' | 'user_action';

export type ChatAttachmentSnapshot = {
  status: ChatAttachmentSnapshotStatus;
  source: ChatAttachmentSnapshotSource;
  attachmentCount: number;
  totalSize: number;
  lastFileName: string | null;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type AttachmentRemovalConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation' | 'confirming';

export type AttachmentRemovalConfirmationSnapshotSource = 'attachment_badge' | 'dialog_state';

export type AttachmentRemovalConfirmationSnapshotAction = 'none' | 'remove_attachment';

export type AttachmentRemovalConfirmationRiskLevel = 'none' | 'low';

export type AttachmentRemovalConfirmationSnapshot = {
  status: AttachmentRemovalConfirmationSnapshotStatus;
  source: AttachmentRemovalConfirmationSnapshotSource;
  action: AttachmentRemovalConfirmationSnapshotAction;
  fileName: string | null;
  fileSize: number;
  attachmentIndex: number | null;
  attachmentCountBefore: number;
  attachmentCountAfter: number;
  hasAttachment: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: AttachmentRemovalConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type ChatModeSnapshotStatus = 'discuss_ready' | 'implement_ready' | 'online_discuss' | 'online_implement' | 'planning' | 'generating' | 'stop_confirmation';

export type ChatModeSnapshotSource = 'mode_toggle' | 'online_toggle' | 'foundation_status' | 'generation_state' | 'stop_control';

export type ChatModeSnapshot = {
  status: ChatModeSnapshotStatus;
  source: ChatModeSnapshotSource;
  chatMode: ChatMode;
  isOnline: boolean;
  foundationStatusLabel: string;
  isBusy: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type StopGenerationConfirmationSnapshotStatus = 'closed' | 'awaiting_confirmation';

export type StopGenerationConfirmationSnapshotSource = 'stop_control' | 'generation_state';

export type StopGenerationConfirmationSnapshotAction = 'none' | 'stop_generation';

export type StopGenerationConfirmationRiskLevel = 'none' | 'medium';

export type StopGenerationConfirmationSnapshot = {
  status: StopGenerationConfirmationSnapshotStatus;
  source: StopGenerationConfirmationSnapshotSource;
  action: StopGenerationConfirmationSnapshotAction;
  projectId: string | null;
  projectName: string | null;
  hasProject: boolean;
  isPersistedProject: boolean;
  isPlanning: boolean;
  isGenerating: boolean;
  promptLength: number;
  hasBackendStopSync: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  riskLevel: StopGenerationConfirmationRiskLevel;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type PlanSelectionSnapshotStatus = 'streaming' | 'waiting_for_selection' | 'selected' | 'superseded' | 'busy_blocked' | 'empty_plans';

export type PlanSelectionSnapshotSource = 'plan_stream' | 'user_selection' | 'new_requirement' | 'generation_state' | 'message_restore';

export type PlanSelectionSnapshot = {
  status: PlanSelectionSnapshotStatus;
  source: PlanSelectionSnapshotSource;
  planCount: number;
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  canSelect: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type PlanThoughtProcessSnapshotStatus = 'empty' | 'streaming' | 'expanded' | 'collapsed' | 'settled';

export type PlanThoughtProcessSnapshotSource = 'plan_stream' | 'user_toggle' | 'message_restore';

export type PlanThoughtProcessSnapshot = {
  status: PlanThoughtProcessSnapshotStatus;
  source: PlanThoughtProcessSnapshotSource;
  contentLength: number;
  isOpen: boolean;
  message: string;
  recovery: string;
  updatedAt: string;
};

export type WorkspaceChatMessageKind = 'text' | 'plan-options' | 'workflow';

export type WorkspaceRestoredMessagePayload = {
  kind?: WorkspaceChatMessageKind;
  content?: string;
  reasoningContent?: string;
  statusContent?: string;
  plans?: Plan[];
  recommendedPlanId?: string | null;
  selectedPlanId?: string | null;
  autoSelected?: boolean;
  planStreamComplete?: boolean;
  planSuperseded?: boolean;
  suggestedQuestions?: WorkspaceSuggestedQuestionList;
  suggestedActions?: GuidanceAction[];
  workflowSteps?: WorkspaceWorkflowStepEventData[];
  engineeringState?: WorkspaceStreamEventData;
  streaming?: boolean;
};

export type WorkspaceChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string | Date;
  attachments?: FileAttachment[];
  kind?: WorkspaceChatMessageKind;
  reasoningContent?: string;
  statusContent?: string;
  activeFileOperation?: string;
  relatedCommit?: GitCommit;
  plans?: Plan[];
  recommendedPlanId?: string;
  selectedPlanId?: string;
  autoSelected?: boolean;
  planStreamComplete?: boolean;
  planSuperseded?: boolean;
  suggestedQuestions?: WorkspaceSuggestedQuestionList;
  suggestedActions?: GuidanceAction[];
  workflowSteps?: WorkflowStep[];
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  gateResult?: WorkspaceGateResult;
  streaming?: boolean;
};

export type WorkspaceProjectInfo = {
  projectId: string;
  projectName: string;
  description: string;
  appType: string;
  initialMessage: string;
  techStack?: string;
  planId?: string;
  planData?: string;
  containerPort?: number;
  previewUrl?: string;
  containerStatus?: ProjectRuntimeContainerStatus;
  gitBranch?: string;
  runtimeStatus?: ProjectRuntimeStatus;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  isPersisted?: boolean;
};

export type PersistedGenerationStateStatus = 'running' | 'interrupted';

export type PersistedGenerationStateReason = 'refresh' | 'manual';

export type PersistGenerationStateOperation = 'save' | 'clear';
export type PersistGenerationStateSource = WorkspaceGenerationStateStorageSource;
export type PersistGenerationStateDetails = WorkspaceGenerationStateLocalDetails;

export type PersistedGenerationState = {
  projectId: string;
  projectName?: string;
  prompt: string;
  status: PersistedGenerationStateStatus;
  reason?: PersistedGenerationStateReason;
  startedAt: string;
};

export type PersistGenerationStateResult =
  | { ok: true }
  | {
    ok: false;
    operation: PersistGenerationStateOperation;
    error: unknown;
    source: PersistGenerationStateSource;
    details: PersistGenerationStateDetails;
  };

export type PersistGenerationState = (state: PersistedGenerationState | null) => PersistGenerationStateResult;

export type WorkspacePlanFlowState = {
  availablePlans: Plan[];
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  planCountdown: number;
  planAutoConfirmDeadlineAt: string | null;
  planSelectionReady: boolean;
};

export type WorkspaceSessionSnapshotFileEntry = {
  path: string;
  content: string;
};

export type WorkspaceSessionSnapshotEditorStatusEntry = {
  path: string;
  status: EditorBufferStatus;
};

export type WorkspaceEditorSessionSnapshot = {
  activeFile: string | null;
  openFiles: WorkspaceOpenFilePathList;
  files: WorkspaceSessionSnapshotFileEntry[];
  savedFiles: WorkspaceSessionSnapshotFileEntry[];
  editorBufferStatuses: WorkspaceSessionSnapshotEditorStatusEntry[];
  expandedFolders: string[];
  searchQuery: string;
  pendingCloseFile: string | null;
};

export type WorkspaceWorkflowSnapshot = {
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  gateResult?: WorkspaceGateResult;
};

export type WorkspaceSessionSnapshot = {
  messages: WorkspaceChatMessage[];
  editorState?: WorkspaceEditorSessionSnapshot;
} & WorkspacePlanFlowState;

export type WorkspaceContextMenuNode = FileNode | null;

export type WorkspaceContextMenu = {
  x: number;
  y: number;
  node: WorkspaceContextMenuNode;
  isFolder: boolean;
};

export type WorkspaceExplorerContextOperation =
  | 'create_file'
  | 'create_directory'
  | 'rename_file'
  | 'rename_directory'
  | 'delete_file'
  | 'delete_directory';

export type WorkspaceExplorerContextOperationInput = {
  path?: string;
  targetPath?: string;
  content?: string;
};
