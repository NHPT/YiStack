import { cn } from '@/lib/utils';
import {
  buildProjectListBackendHealthProbe,
  buildProjectListApiHealth,
  buildProjectListAuthRecovery,
  type ProjectListBackendHealthProbeResult,
  type ProjectListApiHealthFailure,
} from '@/lib/workspace/project-list-api-health';

import type {
  ProjectListNoticeKind,
  ProjectListPageSnapshot,
  ProjectListPageSnapshotSource,
  ProjectListPageSnapshotStatus,
  ProjectListPageSnapshotStatusList,
} from '../workspace/workspace-types';

type ProjectListPageBooleanFactList = readonly boolean[];

const PROJECT_LIST_AUTH_SOURCE_STATUSES: ProjectListPageSnapshotStatusList = [
  'auth_loading',
  'unauthenticated',
];

const PROJECT_LIST_API_SOURCE_STATUSES: ProjectListPageSnapshotStatusList = [
  'sync_failed',
  'loading',
];

const PROJECT_DELETE_SOURCE_STATUSES: ProjectListPageSnapshotStatusList = [
  'delete_accepted',
  'delete_restored',
  'delete_restore_failed',
  'delete_failed',
];

const RUNTIME_STOP_SOURCE_STATUSES: ProjectListPageSnapshotStatusList = [
  'runtime_stop_failed',
  'runtime_stop_completed',
];

const PROJECT_RESOURCE_SOURCE_STATUSES: ProjectListPageSnapshotStatusList = [
  'resource_snapshot_ready',
  'resource_snapshot_blocked',
  'resource_snapshot_failed',
  'resource_alert_ready',
  'resource_alert_alerting',
  'resource_alert_blocked',
  'resource_alert_preview_ready',
  'resource_alert_preview_would_alert',
  'resource_alert_preview_blocked',
  'resource_alert_event_created',
  'resource_alert_event_blocked',
  'resource_alert_event_unavailable',
  'resource_alert_event_list_ready',
  'resource_alert_event_list_empty',
  'resource_alert_event_list_unavailable',
  'resource_alert_notification_ready',
  'resource_alert_notification_empty',
  'resource_alert_notification_blocked',
  'resource_alert_notification_unavailable',
  'resource_alert_notification_sent',
  'resource_alert_notification_failed',
  'resource_alert_notification_send_blocked',
  'resource_alert_notification_send_unavailable',
  'resource_alert_enforcement_ready',
  'resource_alert_enforcement_disabled',
  'resource_alert_enforcement_blocked',
  'resource_alert_enforcement_unavailable',
  'resource_alert_enforcement_executed',
  'resource_alert_enforcement_failed',
  'resource_alert_enforcement_execute_blocked',
];

const PROJECT_BACKUP_SOURCE_STATUSES: ProjectListPageSnapshotStatusList = [
  'backup_created',
  'backup_blocked',
  'backup_list_ready',
  'backup_list_empty',
  'backup_policy_ready',
  'backup_policy_blocked',
  'backup_remote_ready',
  'backup_remote_empty',
  'backup_remote_blocked',
  'backup_remote_inventory_ready',
  'backup_remote_inventory_empty',
  'backup_remote_inventory_blocked',
  'backup_remote_inventory_failed',
  'backup_remote_upload_completed',
  'backup_remote_upload_blocked',
  'backup_remote_upload_failed',
  'backup_remote_download_completed',
  'backup_remote_download_blocked',
  'backup_remote_download_failed',
  'backup_remote_restore_completed',
  'backup_remote_restore_blocked',
  'backup_remote_restore_failed',
  'backup_auto_run_created',
  'backup_auto_run_blocked',
  'backup_download_ready',
  'backup_download_blocked',
  'backup_preflight_ready',
  'backup_preflight_blocked',
  'backup_restore_completed',
  'backup_restore_blocked',
  'backup_failed',
];

const PROJECT_LIST_WARNING_TONE_STATUSES: ProjectListPageSnapshotStatusList = [
  'unauthenticated',
  'sync_failed',
  'runtime_stop_failed',
  'resource_snapshot_blocked',
  'resource_snapshot_failed',
  'resource_alert_alerting',
  'resource_alert_blocked',
  'resource_alert_preview_would_alert',
  'resource_alert_preview_blocked',
  'resource_alert_event_blocked',
  'resource_alert_event_unavailable',
  'resource_alert_event_list_unavailable',
  'resource_alert_notification_blocked',
  'resource_alert_notification_unavailable',
  'resource_alert_notification_failed',
  'resource_alert_notification_send_blocked',
  'resource_alert_notification_send_unavailable',
  'resource_alert_enforcement_blocked',
  'resource_alert_enforcement_unavailable',
  'resource_alert_enforcement_failed',
  'resource_alert_enforcement_execute_blocked',
  'backup_failed',
  'backup_blocked',
  'backup_policy_blocked',
  'backup_remote_blocked',
  'backup_remote_inventory_blocked',
  'backup_remote_inventory_failed',
  'backup_remote_upload_blocked',
  'backup_remote_upload_failed',
  'backup_remote_download_blocked',
  'backup_remote_download_failed',
  'backup_remote_restore_blocked',
  'backup_remote_restore_failed',
  'backup_auto_run_blocked',
  'backup_download_blocked',
  'backup_preflight_blocked',
  'backup_restore_blocked',
  'edit_failed',
  'delete_failed',
  'delete_restore_failed',
];

const PROJECT_LIST_ACTIVE_TONE_STATUSES: ProjectListPageSnapshotStatusList = [
  'auth_loading',
  'loading',
  'delete_accepted',
  'delete_restored',
  'runtime_stop_completed',
  'resource_snapshot_ready',
  'resource_alert_ready',
  'resource_alert_preview_ready',
  'resource_alert_event_created',
  'resource_alert_event_list_ready',
  'resource_alert_event_list_empty',
  'resource_alert_notification_sent',
  'resource_alert_notification_ready',
  'resource_alert_notification_empty',
  'resource_alert_enforcement_ready',
  'resource_alert_enforcement_disabled',
  'resource_alert_enforcement_executed',
  'backup_created',
  'backup_list_ready',
  'backup_list_empty',
  'backup_policy_ready',
  'backup_remote_ready',
  'backup_remote_empty',
  'backup_remote_inventory_ready',
  'backup_remote_inventory_empty',
  'backup_remote_upload_completed',
  'backup_remote_download_completed',
  'backup_remote_restore_completed',
  'backup_auto_run_created',
  'backup_download_ready',
  'backup_preflight_ready',
  'backup_restore_completed',
];

function isProjectListPageStatusIn(status: ProjectListPageSnapshotStatus, statuses: ProjectListPageSnapshotStatusList) {
  for (const candidate of statuses) {
    if (candidate === status) {
      return true;
    }
  }

  return false;
}

function hasProjectListPageTrueFact(values: ProjectListPageBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function shouldReloadProjectListPageSnapshot({
  hasSyncError,
  hasStopError,
  hasResourceError,
  hasBackupError,
}: {
  hasSyncError: boolean;
  hasStopError: boolean;
  hasResourceError: boolean;
  hasBackupError: boolean;
}): boolean {
  return hasProjectListPageTrueFact([
    hasSyncError,
    hasStopError,
    hasResourceError,
    hasBackupError,
  ]);
}

function isProjectListPageSnapshotLoading(authLoading: boolean, isLoading: boolean): boolean {
  return hasProjectListPageTrueFact([authLoading, isLoading]);
}

function hasProjectListPageSnapshotTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  return value.length > 0;
}

function getProjectListPageSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasProjectListPageSnapshotTextValue(value);

  return hasValue === true ? value : fallback;
}

function getProjectListPageSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function resolveProjectListPageSnapshotSource(status: ProjectListPageSnapshotStatus): ProjectListPageSnapshotSource {
  if (isProjectListPageStatusIn(status, PROJECT_LIST_AUTH_SOURCE_STATUSES)) {
    return 'auth';
  }
  if (isProjectListPageStatusIn(status, PROJECT_LIST_API_SOURCE_STATUSES)) {
    return 'project_list_api';
  }
  if (isProjectListPageStatusIn(status, PROJECT_DELETE_SOURCE_STATUSES)) {
    return 'project_delete';
  }
  if (isProjectListPageStatusIn(status, RUNTIME_STOP_SOURCE_STATUSES)) {
    return 'runtime_stop';
  }
  if (isProjectListPageStatusIn(status, PROJECT_RESOURCE_SOURCE_STATUSES)) {
    return 'project_resource';
  }
  if (isProjectListPageStatusIn(status, PROJECT_BACKUP_SOURCE_STATUSES)) {
    return 'project_backup';
  }
  if (status === 'edit_failed') {
    return 'project_edit';
  }
  return 'project_list_state';
}

export function buildProjectListPageSnapshot({
  isAuthenticated,
  authLoading,
  isLoading,
  projectCount,
  projectListApiFailure,
  projectListBackendHealthProbe,
  projectListBackendHealthFailure,
  isCheckingProjectListBackendHealth,
  projectListError,
  projectListNotice,
  projectListNoticeKind,
  stopProjectError,
  resourceProjectError,
  backupProjectError,
  editProjectError,
  deleteProjectError,
  stoppingProjectId,
  checkingResourceSnapshotProjectId,
  checkingResourceAlertReadinessProjectId,
  previewingResourceAlertEvaluationProjectId,
  creatingResourceAlertEventProjectId,
  listingResourceAlertEventsProjectId,
  checkingResourceAlertNotificationProjectId,
  sendingResourceAlertNotificationProjectId,
  checkingResourceAlertEnforcementProjectId,
  executingResourceAlertEnforcementProjectId,
  backingUpProjectId,
  listingBackupsProjectId,
  checkingBackupPolicyProjectId,
  checkingBackupRemoteStorageProjectId,
  checkingBackupRemoteInventoryProjectId,
  uploadingBackupRemoteStorageProjectId,
  downloadingBackupRemoteStorageProjectId,
  restoringBackupRemoteStorageProjectId,
  runningAutomaticBackupProjectId,
  downloadingBackupProjectId,
  preflightingBackupProjectId,
  restoringBackupProjectId,
  restoringDeletedProjectId,
  editingProjectId,
  deletingProjectId,
}: {
  isAuthenticated: boolean;
  authLoading: boolean;
  isLoading: boolean;
  projectCount: number;
  projectListApiFailure: ProjectListApiHealthFailure | null;
  projectListBackendHealthProbe: ProjectListBackendHealthProbeResult | null;
  projectListBackendHealthFailure: ProjectListApiHealthFailure | null;
  isCheckingProjectListBackendHealth: boolean;
  projectListError: string | null;
  projectListNotice: string | null;
  projectListNoticeKind: ProjectListNoticeKind | null;
  stopProjectError: string | null;
  resourceProjectError: string | null;
  backupProjectError: string | null;
  editProjectError: string | null;
  deleteProjectError: string | null;
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
  restoringDeletedProjectId: string | null;
  editingProjectId: string | null;
  deletingProjectId: string | null;
}): ProjectListPageSnapshot {
  const apiHealth = buildProjectListApiHealth({
    isAuthenticated,
    authLoading,
    isLoading,
    projectCount,
    failure: projectListApiFailure,
  });
  const backendHealth = buildProjectListBackendHealthProbe({
    isChecking: isCheckingProjectListBackendHealth,
    result: projectListBackendHealthProbe,
    failure: projectListBackendHealthFailure,
  });
  const authRecovery = buildProjectListAuthRecovery({
    apiHealth,
    backendHealth,
  });
  const hasSyncError = hasProjectListPageSnapshotTextValue(projectListError);
  const hasNotice = hasProjectListPageSnapshotTextValue(projectListNotice);
  const hasNoticeKind = projectListNoticeKind !== null;
  const hasStopError = hasProjectListPageSnapshotTextValue(stopProjectError);
  const hasResourceError = hasProjectListPageSnapshotTextValue(resourceProjectError);
  const hasBackupError = hasProjectListPageSnapshotTextValue(backupProjectError);
  const hasEditError = hasProjectListPageSnapshotTextValue(editProjectError);
  const hasDeleteError = hasProjectListPageSnapshotTextValue(deleteProjectError);
  const canReload = shouldReloadProjectListPageSnapshot({
    hasSyncError,
    hasStopError,
    hasResourceError,
    hasBackupError,
  });
  const snapshotLoading = isProjectListPageSnapshotLoading(authLoading, isLoading);
  const canCreateProject = isAuthenticated === true && authLoading === false;
  const status: ProjectListPageSnapshotStatus = authLoading === true
    ? 'auth_loading'
    : isAuthenticated === false
      ? 'unauthenticated'
      : hasSyncError === true
        ? 'sync_failed'
        : hasStopError === true
          ? 'runtime_stop_failed'
          : hasResourceError === true
            ? 'resource_snapshot_failed'
            : hasBackupError === true
              ? 'backup_failed'
              : hasEditError === true
                ? 'edit_failed'
                : hasDeleteError === true
                  ? 'delete_failed'
                  : hasNotice === true && hasNoticeKind === true
                    ? projectListNoticeKind
                    : isLoading === true
                      ? 'loading'
                      : projectCount === 0
                        ? 'empty'
                        : 'ready';
  const source = resolveProjectListPageSnapshotSource(status);

  return {
    status,
    source,
    isAuthenticated,
    isLoading: snapshotLoading,
    projectCount,
    apiHealthStatus: apiHealth.status,
    apiHealthSource: apiHealth.source,
    apiHealthReasonCode: apiHealth.reasonCode,
    apiHealthDetails: apiHealth.details,
    authRecoveryStatus: authRecovery.status,
    authRecoverySource: authRecovery.source,
    authRecoveryReasonCode: authRecovery.reasonCode,
    authRecoveryDetails: authRecovery.details,
    backendHealthStatus: backendHealth.status,
    backendHealthSource: backendHealth.source,
    backendHealthReasonCode: backendHealth.reasonCode,
    backendHealthDetails: backendHealth.details,
    backendHealthService: backendHealth.service,
    backendHealthBackendStatus: backendHealth.backendStatus,
    hasSyncError,
    hasNotice,
    hasStopError,
    hasResourceError,
    hasBackupError,
    hasEditError,
    hasDeleteError,
    stoppingProjectId,
    checkingResourceSnapshotProjectId,
    checkingResourceAlertReadinessProjectId,
    previewingResourceAlertEvaluationProjectId,
    creatingResourceAlertEventProjectId,
    listingResourceAlertEventsProjectId,
    checkingResourceAlertNotificationProjectId,
    sendingResourceAlertNotificationProjectId,
    checkingResourceAlertEnforcementProjectId,
    executingResourceAlertEnforcementProjectId,
    backingUpProjectId,
    listingBackupsProjectId,
    checkingBackupPolicyProjectId,
    checkingBackupRemoteStorageProjectId,
    checkingBackupRemoteInventoryProjectId,
    uploadingBackupRemoteStorageProjectId,
    downloadingBackupRemoteStorageProjectId,
    restoringBackupRemoteStorageProjectId,
    runningAutomaticBackupProjectId,
    downloadingBackupProjectId,
    preflightingBackupProjectId,
    restoringBackupProjectId,
    restoringDeletedProjectId,
    editingProjectId,
    deletingProjectId,
    canReload,
    canCreateProject,
    canLoginRecovery: authRecovery.canLogin,
    canRetryProjectListAfterAuth: authRecovery.canRetryList,
    message: status === 'auth_loading'
      ? '项目列表正在等待鉴权状态。'
      : status === 'unauthenticated'
        ? '项目列表需要登录后查看。'
        : status === 'sync_failed'
          ? apiHealth.message
          : status === 'runtime_stop_failed'
            ? '项目运行时停止失败，卡片状态可能仍保留停止前状态。'
            : status === 'runtime_stop_completed'
              ? '项目运行时停止结果已返回。'
              : status === 'resource_snapshot_ready'
                ? '项目运行时资源快照已读取。'
                : status === 'resource_snapshot_blocked'
                  ? '项目运行时资源快照读取被 guard 阻断。'
                  : status === 'resource_snapshot_failed'
                    ? '项目运行时资源快照读取失败。'
                    : status === 'resource_alert_ready'
                      ? '项目资源告警策略 readiness 已就绪。'
                      : status === 'resource_alert_alerting'
                        ? '项目资源告警策略已触发阈值。'
                        : status === 'resource_alert_blocked'
                          ? '项目资源告警策略 readiness 未就绪。'
                          : status === 'resource_alert_preview_ready'
                            ? '项目资源告警评估预览未发现触发项。'
                            : status === 'resource_alert_preview_would_alert'
                              ? '项目资源告警评估预览发现当前阈值触发。'
                              : status === 'resource_alert_preview_blocked'
                                ? '项目资源告警评估预览未就绪。'
                                : status === 'resource_alert_event_created'
                                  ? '项目资源告警事件已受控创建。'
                                  : status === 'resource_alert_event_blocked'
                                    ? '项目资源告警事件创建被 guard 阻断。'
                                    : status === 'resource_alert_event_unavailable'
                                      ? '项目资源告警事件仓储不可用。'
                                      : status === 'resource_alert_event_list_ready'
                                        ? '项目资源告警事件列表已读取。'
                                        : status === 'resource_alert_event_list_empty'
                                          ? '项目资源告警事件列表为空。'
                                          : status === 'resource_alert_event_list_unavailable'
                                            ? '项目资源告警事件列表仓储不可用。'
                                            : status === 'resource_alert_notification_ready'
                                              ? '项目资源告警通知通道 readiness 已就绪。'
                                              : status === 'resource_alert_notification_empty'
                                                ? '项目资源告警通知通道可用但没有候选事件。'
                                                : status === 'resource_alert_notification_blocked'
                                                  ? '项目资源告警通知通道 readiness 未就绪。'
                                                  : status === 'resource_alert_notification_unavailable'
                                                    ? '项目资源告警通知通道候选事件仓储不可用。'
                                                    : status === 'resource_alert_notification_sent'
                                                      ? '项目资源告警通知已发送，并已追加发送事件。'
                                                      : status === 'resource_alert_notification_failed'
                                                        ? '项目资源告警通知发送失败，失败事件已记录。'
                                                        : status === 'resource_alert_notification_send_blocked'
                                                          ? '项目资源告警通知发送被 guard 阻断。'
                                                          : status === 'resource_alert_notification_send_unavailable'
                                                            ? '项目资源告警通知发送依赖的事件仓储不可用。'
                                                            : status === 'resource_alert_enforcement_ready'
                                                              ? '项目资源告警硬配额执行 readiness 已就绪，但尚未执行硬配额。'
                                                              : status === 'resource_alert_enforcement_disabled'
                                                                ? '项目资源告警硬配额执行 readiness 已关闭。'
                                                                : status === 'resource_alert_enforcement_unavailable'
                                                                  ? '项目资源告警硬配额执行 readiness 依赖的事件仓储不可用。'
                                                                  : status === 'resource_alert_enforcement_blocked'
                                                                    ? '项目资源告警硬配额执行 readiness 被 guard 阻断。'
                                                                    : status === 'resource_alert_enforcement_executed'
                                                                      ? '项目资源告警硬配额已受控执行，并已追加执行事件。'
                                                                      : status === 'resource_alert_enforcement_failed'
                                                                        ? '项目资源告警硬配额执行失败，停止容器结果未确认成功。'
                                                                        : status === 'resource_alert_enforcement_execute_blocked'
                                                                          ? '项目资源告警硬配额执行被 guard 阻断。'
                                      : status === 'backup_failed'
                ? '项目备份创建失败，备份产物未确认创建。'
                : status === 'backup_blocked'
                  ? '项目备份被后端 guard 阻断。'
                  : status === 'backup_created'
                    ? '项目备份归档和 manifest 已创建。'
                    : status === 'backup_list_ready'
                      ? '项目本地备份 manifest 列表已读取。'
                      : status === 'backup_list_empty'
                        ? '项目本地备份 manifest 列表为空。'
                        : status === 'backup_policy_ready'
                          ? '项目自动备份策略 readiness 已就绪。'
                          : status === 'backup_policy_blocked'
                            ? '项目自动备份策略 readiness 未就绪。'
                            : status === 'backup_remote_ready'
                              ? '项目备份远端存储 readiness 已就绪。'
                              : status === 'backup_remote_empty'
                                ? '项目备份远端存储配置就绪，但暂无可上传本地备份。'
                                : status === 'backup_remote_blocked'
                                  ? '项目备份远端存储 readiness 未就绪。'
                                  : status === 'backup_remote_inventory_ready'
                                    ? '项目备份远端对象清单已读取。'
                                    : status === 'backup_remote_inventory_empty'
                                      ? '项目备份远端对象清单为空。'
                                      : status === 'backup_remote_inventory_blocked'
                                        ? '项目备份远端对象清单读取被 guard 阻断。'
                                        : status === 'backup_remote_inventory_failed'
                                          ? '项目备份远端对象清单读取失败。'
                                  : status === 'backup_remote_upload_completed'
                                    ? '项目备份归档和 manifest 已上传到远端存储。'
                                    : status === 'backup_remote_upload_blocked'
                                      ? '项目备份远端上传被 guard 阻断。'
                                      : status === 'backup_remote_upload_failed'
                                        ? '项目备份远端上传失败，远端对象完整性未确认。'
                                        : status === 'backup_remote_download_completed'
                                          ? '项目备份远端完整候选已下载并导入本地备份缓存。'
                                          : status === 'backup_remote_download_blocked'
                                            ? '项目备份远端下载导入被 guard 阻断。'
                                            : status === 'backup_remote_download_failed'
                                              ? '项目备份远端下载导入失败，本地缓存完整性未确认。'
                                              : status === 'backup_remote_restore_completed'
                                                ? '项目备份远端完整候选已导入并完成受控恢复。'
                                                : status === 'backup_remote_restore_blocked'
                                                  ? '项目备份远端恢复被 guard 阻断。'
                                                  : status === 'backup_remote_restore_failed'
                                                    ? '项目备份远端恢复失败，项目目录写入结果未确认。'
                                  : status === 'backup_auto_run_created'
                              ? '项目自动备份策略已执行一次受控本地备份。'
                              : status === 'backup_auto_run_blocked'
                                ? '项目自动备份策略执行被后端 guard 阻断。'
                            : status === 'backup_download_ready'
                              ? '项目本地备份归档下载已开始。'
                              : status === 'backup_download_blocked'
                                ? '项目本地备份归档下载被阻断。'
                                : status === 'backup_preflight_ready'
                          ? '项目备份恢复只读预检已通过。'
                          : status === 'backup_preflight_blocked'
                            ? '项目备份恢复只读预检被阻断。'
                          : status === 'backup_restore_completed'
                            ? '项目备份恢复已执行。'
                            : status === 'backup_restore_blocked'
                              ? '项目备份恢复被阻断或取消。'
                              : status === 'edit_failed'
                                ? '项目编辑失败，列表仍保留修改前信息。'
                                : status === 'delete_failed'
                                  ? '项目删除失败，列表仍保留原项目。'
                                  : status === 'delete_restore_failed'
                                    ? '项目软删除恢复失败，后台清理可能已开始。'
                                    : status === 'delete_restored'
                                      ? '项目已在软删除恢复窗口内恢复。'
                                  : status === 'delete_accepted'
                                    ? '项目删除已受理，后台资源仍在清理。'
                                    : status === 'loading'
                                      ? '项目列表正在从后端同步。'
                                      : status === 'empty'
                                        ? '项目列表为空，尚无可打开项目。'
                                        : '项目列表已同步并可打开项目。',
    recovery: status === 'auth_loading'
      ? '等待 Auth Provider 返回结果。'
      : status === 'unauthenticated'
        ? '登录后可查看和管理项目。'
        : status === 'sync_failed'
          ? apiHealth.recovery
          : status === 'runtime_stop_failed'
            ? '刷新项目列表或查看 Runtime Health 确认运行时最终状态。'
            : status === 'runtime_stop_completed'
              ? '必要时刷新项目列表或查看 Runtime Health 确认运行时最终状态。'
              : status === 'resource_snapshot_ready'
                ? '资源快照只读展示当前 CPU、内存、网络和磁盘事实；告警策略仍需后续入口。'
                : status === 'resource_snapshot_blocked'
                  ? '先显式启动项目运行时或修复容器状态，再重新读取资源快照。'
                  : status === 'resource_snapshot_failed'
                    ? '检查容器运行时连接、stats 接口和项目容器状态后重试。'
                    : status === 'resource_alert_ready'
                      ? '资源告警 readiness 只读校验配置和当前快照；通知、持久化和硬配额仍需后续入口。'
                      : status === 'resource_alert_alerting'
                        ? '结合资源快照和运行时日志处理阈值触发；当前不会持久化告警或执行硬配额限制。'
                        : status === 'resource_alert_blocked'
                          ? '启用资源告警策略、配置阈值，并确保资源快照可读取后重试。'
                          : status === 'resource_alert_preview_ready'
                            ? '评估预览只读展示当前不会创建告警；后续告警执行仍需单独受控入口。'
                            : status === 'resource_alert_preview_would_alert'
                              ? '预览结果只表示若执行告警会创建事件；当前不会持久化告警、通知或限制资源。'
                              : status === 'resource_alert_preview_blocked'
                                ? '先让资源告警 readiness 可评估，再重新生成评估预览。'
                                : status === 'resource_alert_event_created'
                                  ? '该入口只写 append-only 告警事件；仍未发送通知、执行硬配额或修改项目目录。'
                                  : status === 'resource_alert_event_blocked'
                                    ? '先确认评估预览为 would_alert，再通过受控入口创建告警事件。'
                                    : status === 'resource_alert_event_unavailable'
                                      ? '检查数据库仓储配置后重试；当前不会降级为通知或硬配额动作。'
                                      : status === 'resource_alert_event_list_ready'
                                        ? '列表只读查证 append-only 告警事件；不会重新评估资源、发送通知或修改运行时。'
                                        : status === 'resource_alert_event_list_empty'
                                          ? '如需记录新事件，先确认评估预览为 would_alert，再通过受控创建入口写入。'
                                          : status === 'resource_alert_event_list_unavailable'
                                            ? '检查数据库仓储配置后重试；当前不会重新评估资源或执行告警动作。'
                                            : status === 'resource_alert_notification_ready'
                                              ? '通知通道 readiness 只确认 webhook 配置和候选事件；发送通知必须由后续受控入口执行。'
                                              : status === 'resource_alert_notification_empty'
                                                ? '先通过受控入口创建 append-only 告警事件，再重新检查通知通道候选。'
                                                : status === 'resource_alert_notification_blocked'
                                                  ? '启用通知通道、配置 webhook provider 和目标 URL 后重试；当前不发送通知。'
                                                  : status === 'resource_alert_notification_unavailable'
                                                    ? '检查告警事件仓储配置后重试；当前不会降级为发送通知或重新评估资源。'
                                                    : status === 'resource_alert_notification_sent'
                                                      ? '可通过告警事件列表查证 notification_sent 事件；该入口不更新源告警事件、不重新评估资源。'
                                                      : status === 'resource_alert_notification_failed'
                                                        ? '检查 webhook provider、网络和目标服务；失败事件已追加，重试前确认候选事件仍可发送。'
                                                        : status === 'resource_alert_notification_send_blocked'
                                                          ? '按通知发送 guard 提示处理确认参数、候选事件或重复发送证据后重试。'
                                                          : status === 'resource_alert_notification_send_unavailable'
                                                            ? '检查告警事件仓储配置后重试；当前不会降级为重新评估资源或直接执行硬配额。'
                                                            : status === 'resource_alert_enforcement_ready'
                                                              ? 'readiness 只说明可执行 stop_container；真正停止容器仍需通过受控执行入口确认。'
                                                              : status === 'resource_alert_enforcement_disabled'
                                                                ? '启用 PROJECT_RESOURCE_ALERT_ENFORCEMENT_ENABLED 并配置 MODE=stop_container 后重新检查。'
                                                                : status === 'resource_alert_enforcement_unavailable'
                                                                  ? '检查告警事件仓储和通知发送证据后重试；当前不会执行 stop_container。'
                                                                  : status === 'resource_alert_enforcement_blocked'
                                                                    ? '按 enforcement readiness 提示补齐触发告警、notification_sent 证据或执行模式后重试。'
                                                                    : status === 'resource_alert_enforcement_executed'
                                                                      ? '通过告警事件列表查证 enforcement_executed 事件，并刷新项目列表或 Runtime Health 确认容器最终状态。'
                                                                      : status === 'resource_alert_enforcement_failed'
                                                                        ? '检查 StopProjectContainer 失败原因和容器状态；停止失败不会追加执行事件，可修复后重新执行。'
                                                                        : status === 'resource_alert_enforcement_execute_blocked'
                                                                          ? '按执行 guard 提示处理确认参数、候选事件漂移或重复执行证据后重试。'
                                      : status === 'backup_failed'
                ? '稍后重试创建备份；失败不会改变项目代码、运行时或 Git 状态。'
                : status === 'backup_blocked'
                  ? '按备份 guard 提示修复项目目录或大小问题后重试。'
                  : status === 'backup_created'
                    ? '可在后端备份目录查验归档和 manifest；当前入口不上传远端存储。'
                    : status === 'backup_list_ready'
                      ? '列表只确认本地 manifest 与归档存在性；下载、恢复和远端上传仍需后续入口。'
                      : status === 'backup_list_empty'
                        ? '可先创建一次本地备份，再重新读取备份列表。'
                        : status === 'backup_policy_ready'
                          ? '后续自动调度可沿用该策略 readiness 和 manifest 校验边界。'
                          : status === 'backup_policy_blocked'
                            ? '按 readiness 提示启用 PROJECT_AUTO_BACKUP、配置备份目录或先创建本地备份。'
                            : status === 'backup_remote_ready'
                              ? '后续远端上传可沿用该 readiness 和本地 manifest 校验边界。'
                              : status === 'backup_remote_empty'
                                ? '先创建本地备份或等待自动备份生成归档，再重新检查远端存储 readiness。'
                                : status === 'backup_remote_blocked'
                                  ? '按 readiness 提示配置远端 provider、bucket 和访问凭据。'
                                  : status === 'backup_remote_inventory_ready'
                                    ? 'complete 候选只说明远端归档和 manifest object key 同时存在；下载或恢复前仍需读取 manifest 并复核 checksum。'
                                    : status === 'backup_remote_inventory_empty'
                                      ? '可先执行远端上传入口，再重新读取远端对象清单。'
                                      : status === 'backup_remote_inventory_blocked'
                                        ? '按远端清单提示配置远端 provider、bucket、凭据和 endpoint 后重试。'
                                        : status === 'backup_remote_inventory_failed'
                                          ? '检查远端 endpoint、region、ListBucket 权限、网络和凭据后重试。'
                                  : status === 'backup_remote_upload_completed'
                                    ? '可在远端对象存储中核对归档和 manifest object key；该入口不下载远端对象、不恢复项目。'
                                    : status === 'backup_remote_upload_blocked'
                                      ? '按远端上传提示修复 readiness、本地备份 manifest 或 backup_id 后重试。'
                                      : status === 'backup_remote_upload_failed'
                                        ? '检查远端 endpoint、region、bucket 权限、网络和凭据；必要时核对是否只上传了归档或 manifest 的一部分。'
                                        : status === 'backup_remote_download_completed'
                                          ? '导入后的备份可继续走本地列表、下载、恢复预检和恢复入口；当前入口不恢复项目、不启动容器、不执行 Git。'
                                          : status === 'backup_remote_download_blocked'
                                            ? '按远端下载提示修复 inventory 完整候选、manifest、checksum 或本地备份冲突后重试。'
                                            : status === 'backup_remote_download_failed'
                                              ? '检查远端 endpoint、region、GetObject 权限、网络和本地备份目录写入权限后重试。'
                                              : status === 'backup_remote_restore_completed'
                                                ? '恢复后请重新读取项目文件、备份列表和运行时状态；当前入口不启动容器、不执行 Git。'
                                                : status === 'backup_remote_restore_blocked'
                                                  ? '按远端恢复提示修复完整候选、确认参数、本地缓存冲突或恢复预检冲突后重试。'
                                                  : status === 'backup_remote_restore_failed'
                                                    ? '检查远端读取、本地备份目录、目标项目目录权限和恢复预检证据后重试。'
                                  : status === 'backup_auto_run_created'
                              ? '可在本地备份目录查验 automatic_policy 来源的归档和 manifest；当前入口不启动后台调度、不上传远端存储。'
                              : status === 'backup_auto_run_blocked'
                                ? '按自动备份策略执行提示启用 PROJECT_AUTO_BACKUP、配置 PROJECT_BACKUP_DIR 或修复项目目录后重试。'
                            : status === 'backup_download_ready'
                              ? '在浏览器下载记录中确认本地归档；该入口不写项目目录、不启动容器、不执行 Git。'
                              : status === 'backup_download_blocked'
                                ? '先创建本地备份或修复 manifest/归档状态，再重新下载。'
                                : status === 'backup_preflight_ready'
                          ? '当前只读预检不执行恢复；后续恢复入口仍需显式确认覆盖策略。'
                          : status === 'backup_preflight_blocked'
                            ? '按预检提示处理 manifest、归档 checksum、tar 路径或目标目录冲突后重试。'
                          : status === 'backup_restore_completed'
                            ? '重新打开项目或刷新 Workspace 文件树，确认恢复后的项目文件。'
                            : status === 'backup_restore_blocked'
                              ? '先处理预检阻断、缺少确认或目标目录冲突，再重新发起受控恢复。'
                              : status === 'edit_failed'
                                ? '修正项目名称、描述或应用类型后重新保存。'
                                : status === 'delete_failed'
                                  ? '稍后重试删除，或刷新列表确认后端删除状态。'
                                  : status === 'delete_restore_failed'
                                    ? '刷新项目列表确认删除状态；如果后台清理已开始，请等待清理完成或联系管理员。'
                                    : status === 'delete_restored'
                                      ? '项目记录已恢复到列表；请打开项目确认运行时、文件树和工程状态是否仍完整。'
                                  : status === 'delete_accepted'
                                    ? '等待后台清理完成；必要时刷新列表确认关联资源状态。'
                                    : status === 'loading'
                                      ? '等待列表 API 返回；若持续加载，请检查项目列表接口。'
                                      : status === 'empty'
                                        ? '返回首页创建第一个项目。'
                                        : '可打开项目、编辑信息、停止运行时、创建备份、查看备份列表、预检或恢复备份、删除项目。',
    updatedAt: 'derived',
  };
}

function getProjectListPageSnapshotClassName(snapshot: ProjectListPageSnapshot) {
  if (isProjectListPageStatusIn(snapshot.status, PROJECT_LIST_WARNING_TONE_STATUSES)) {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  if (isProjectListPageStatusIn(snapshot.status, PROJECT_LIST_ACTIVE_TONE_STATUSES)) {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

export function ProjectListPageSnapshotStrip({ snapshot }: { snapshot: ProjectListPageSnapshot }) {
  const backendHealthServiceLabel = getProjectListPageSnapshotLabel(snapshot.backendHealthService, 'none');
  const backendHealthBackendStatusLabel = getProjectListPageSnapshotLabel(snapshot.backendHealthBackendStatus, 'none');
  const stoppingProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.stoppingProjectId, 'none');
  const backingUpProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.backingUpProjectId, 'none');
  const listingBackupsProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.listingBackupsProjectId, 'none');
  const checkingBackupPolicyProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.checkingBackupPolicyProjectId, 'none');
  const checkingBackupRemoteStorageProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.checkingBackupRemoteStorageProjectId, 'none');
  const checkingBackupRemoteInventoryProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.checkingBackupRemoteInventoryProjectId, 'none');
  const uploadingBackupRemoteStorageProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.uploadingBackupRemoteStorageProjectId, 'none');
  const downloadingBackupRemoteStorageProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.downloadingBackupRemoteStorageProjectId, 'none');
  const restoringBackupRemoteStorageProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.restoringBackupRemoteStorageProjectId, 'none');
  const runningAutomaticBackupProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.runningAutomaticBackupProjectId, 'none');
  const downloadingBackupProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.downloadingBackupProjectId, 'none');
  const preflightingBackupProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.preflightingBackupProjectId, 'none');
  const restoringBackupProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.restoringBackupProjectId, 'none');
  const restoringDeletedProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.restoringDeletedProjectId, 'none');
  const editingProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.editingProjectId, 'none');
  const deletingProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.deletingProjectId, 'none');
  const checkingResourceSnapshotProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.checkingResourceSnapshotProjectId, 'none');
  const checkingResourceAlertReadinessProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.checkingResourceAlertReadinessProjectId, 'none');
  const previewingResourceAlertEvaluationProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.previewingResourceAlertEvaluationProjectId, 'none');
  const creatingResourceAlertEventProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.creatingResourceAlertEventProjectId, 'none');
  const listingResourceAlertEventsProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.listingResourceAlertEventsProjectId, 'none');
  const checkingResourceAlertNotificationProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.checkingResourceAlertNotificationProjectId, 'none');
  const sendingResourceAlertNotificationProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.sendingResourceAlertNotificationProjectId, 'none');
  const checkingResourceAlertEnforcementProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.checkingResourceAlertEnforcementProjectId, 'none');
  const executingResourceAlertEnforcementProjectIdLabel = getProjectListPageSnapshotLabel(snapshot.executingResourceAlertEnforcementProjectId, 'none');
  const isAuthenticatedLabel = getProjectListPageSnapshotBooleanLabel(snapshot.isAuthenticated);
  const isLoadingLabel = getProjectListPageSnapshotBooleanLabel(snapshot.isLoading);
  const hasSyncErrorLabel = getProjectListPageSnapshotBooleanLabel(snapshot.hasSyncError);
  const hasNoticeLabel = getProjectListPageSnapshotBooleanLabel(snapshot.hasNotice);
  const hasStopErrorLabel = getProjectListPageSnapshotBooleanLabel(snapshot.hasStopError);
  const hasResourceErrorLabel = getProjectListPageSnapshotBooleanLabel(snapshot.hasResourceError);
  const hasBackupErrorLabel = getProjectListPageSnapshotBooleanLabel(snapshot.hasBackupError);
  const hasEditErrorLabel = getProjectListPageSnapshotBooleanLabel(snapshot.hasEditError);
  const hasDeleteErrorLabel = getProjectListPageSnapshotBooleanLabel(snapshot.hasDeleteError);
  const canReloadLabel = getProjectListPageSnapshotBooleanLabel(snapshot.canReload);
  const canCreateProjectLabel = getProjectListPageSnapshotBooleanLabel(snapshot.canCreateProject);
  const canLoginRecoveryLabel = getProjectListPageSnapshotBooleanLabel(snapshot.canLoginRecovery);
  const canRetryProjectListAfterAuthLabel = getProjectListPageSnapshotBooleanLabel(snapshot.canRetryProjectListAfterAuth);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="project-list-page-snapshot"
      className={cn('mb-6 rounded-lg border px-3 py-2 text-xs', getProjectListPageSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">项目列表页快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Auth: {isAuthenticatedLabel}</span>
        <span>Loading: {isLoadingLabel}</span>
        <span>Projects: {snapshot.projectCount}</span>
        <span>ApiHealth: {snapshot.apiHealthStatus}</span>
        <span>ApiSource: {snapshot.apiHealthSource}</span>
        <span>Reason: {snapshot.apiHealthReasonCode}</span>
        <span>AuthRecovery: {snapshot.authRecoveryStatus}</span>
        <span>AuthSource: {snapshot.authRecoverySource}</span>
        <span>AuthReason: {snapshot.authRecoveryReasonCode}</span>
        <span>BackendHealth: {snapshot.backendHealthStatus}</span>
        <span>BackendSource: {snapshot.backendHealthSource}</span>
        <span>BackendReason: {snapshot.backendHealthReasonCode}</span>
        <span>BackendService: {backendHealthServiceLabel}</span>
        <span>BackendStatus: {backendHealthBackendStatusLabel}</span>
        <span>SyncError: {hasSyncErrorLabel}</span>
        <span>Notice: {hasNoticeLabel}</span>
        <span>StopError: {hasStopErrorLabel}</span>
        <span>ResourceError: {hasResourceErrorLabel}</span>
        <span>BackupError: {hasBackupErrorLabel}</span>
        <span>EditError: {hasEditErrorLabel}</span>
        <span>DeleteError: {hasDeleteErrorLabel}</span>
        <span>Stopping: {stoppingProjectIdLabel}</span>
        <span>BackingUp: {backingUpProjectIdLabel}</span>
        <span>ListingBackups: {listingBackupsProjectIdLabel}</span>
        <span>CheckingBackupPolicy: {checkingBackupPolicyProjectIdLabel}</span>
        <span>CheckingBackupRemoteStorage: {checkingBackupRemoteStorageProjectIdLabel}</span>
        <span>CheckingBackupRemoteInventory: {checkingBackupRemoteInventoryProjectIdLabel}</span>
        <span>UploadingBackupRemoteStorage: {uploadingBackupRemoteStorageProjectIdLabel}</span>
        <span>DownloadingBackupRemoteStorage: {downloadingBackupRemoteStorageProjectIdLabel}</span>
        <span>RestoringBackupRemoteStorage: {restoringBackupRemoteStorageProjectIdLabel}</span>
        <span>RunningAutomaticBackup: {runningAutomaticBackupProjectIdLabel}</span>
        <span>DownloadingBackup: {downloadingBackupProjectIdLabel}</span>
        <span>PreflightingBackup: {preflightingBackupProjectIdLabel}</span>
        <span>RestoringBackup: {restoringBackupProjectIdLabel}</span>
        <span>RestoringDeleted: {restoringDeletedProjectIdLabel}</span>
        <span>Editing: {editingProjectIdLabel}</span>
        <span>Deleting: {deletingProjectIdLabel}</span>
        <span>CheckingResourceSnapshot: {checkingResourceSnapshotProjectIdLabel}</span>
        <span>CheckingResourceAlertReadiness: {checkingResourceAlertReadinessProjectIdLabel}</span>
        <span>PreviewingResourceAlertEvaluation: {previewingResourceAlertEvaluationProjectIdLabel}</span>
        <span>CreatingResourceAlertEvent: {creatingResourceAlertEventProjectIdLabel}</span>
        <span>ListingResourceAlertEvents: {listingResourceAlertEventsProjectIdLabel}</span>
        <span>CheckingResourceAlertNotification: {checkingResourceAlertNotificationProjectIdLabel}</span>
        <span>SendingResourceAlertNotification: {sendingResourceAlertNotificationProjectIdLabel}</span>
        <span>CheckingResourceAlertEnforcement: {checkingResourceAlertEnforcementProjectIdLabel}</span>
        <span>ExecutingResourceAlertEnforcement: {executingResourceAlertEnforcementProjectIdLabel}</span>
        <span>Reload: {canReloadLabel}</span>
        <span>Create: {canCreateProjectLabel}</span>
        <span>Login: {canLoginRecoveryLabel}</span>
        <span>RetryAfterAuth: {canRetryProjectListAfterAuthLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 truncate opacity-80">API 细节：{snapshot.apiHealthDetails}</p>
      <p className="mt-1 truncate opacity-80">鉴权恢复：{snapshot.authRecoveryDetails}</p>
      <p className="mt-1 truncate opacity-80">后端健康：{snapshot.backendHealthDetails}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
