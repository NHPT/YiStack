/**
 * YiStack 类型定义
 */

export type ProjectRuntimeLifecycleStatus = 'stopped' | 'starting' | 'preparing' | 'ready' | 'failed';

export type ProjectContainerStopStatus = 'stopped' | 'failed';

export type ProjectContainerStopContainerStatus = 'stopped' | 'unavailable';

export type ProjectContainerStatusPersistenceStatus = 'updated' | 'failed';

export type ProjectRuntimeStatusPersistenceStatus = 'persisted' | 'failed';

export type ProjectRuntimeContainerStatus = string;

export type ProjectRuntimePhase = string;

export type ProjectRuntimeMessage = string;

export type ProjectRuntimeError = string;

export type ProjectRuntimeSpecHash = string;

export type ProjectBackupReadinessStatus = 'ready' | 'empty' | 'disabled' | 'blocked';

export type ProjectResourceAlertReadinessStatus = 'ready' | 'alerting' | 'blocked' | 'disabled' | 'unavailable';

export type ProjectResourceAlertActionReadinessStatus = 'ready' | 'empty' | 'disabled' | 'blocked' | 'unavailable';

export type ProjectResourceAlertThresholdName = 'cpu' | 'memory' | 'disk';

export type ProjectResourceAlertThresholdUnit = 'percent' | 'bytes';

export type ProjectRestoreMutationStatus = 'restored' | 'blocked';

export type GitCreateMutationStatus = 'created' | 'blocked';

export type GitDeleteMutationStatus = 'deleted' | 'blocked';

export type GitApplyMutationStatus = 'applied' | 'blocked';

export type GitBranchTrackingStatus = 'none' | 'up_to_date' | 'ahead' | 'behind' | 'diverged' | 'gone';

export type ChatMessageAuthorRole = 'user' | 'assistant';

export type ChatMessageRole = ChatMessageAuthorRole | 'system';

export type FileNodeType = 'file' | 'folder' | 'directory';

export interface FileNode {
  name: string;
  path: string;
  type: FileNodeType;
  size?: number;
  extension?: string;
  modifiedAt?: string;
  children?: FileNode[];
}

export interface ChatMessage {
  id: string;
  role: ChatMessageAuthorRole;
  content: string;
  timestamp: string | Date;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  sha256?: string;
  width?: number;
  height?: number;
  visualContextId?: string;
}

export type GitCommitBranchName = string;

export type GitCommitBranchNameList = GitCommitBranchName[];

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  time: string;
  files: number;
  branches: GitCommitBranchNameList;
  diff?: GitDiff[];
}

export interface GitDiff {
  path: string;
  additions: number;
  deletions: number;
  content: string;
}

export interface GitBranch {
  name: string;
  is_current: boolean;
  last_commit: string;
  upstream: string;
  has_upstream: boolean;
  ahead: number;
  behind: number;
  tracking_status: GitBranchTrackingStatus;
}

export interface GitRemote {
  name: string;
}

export interface GitRemoteBranch {
  name: string;
  remote: string;
  branch: string;
  last_commit: string;
}

export interface GitTag {
  name: string;
  target_commit: string;
  message: string;
}

export interface GitTagCreateResult {
  name: string;
  current_branch: string;
  status: GitCreateMutationStatus;
  created: boolean;
  target_commit: string;
  message: string;
  recovery: string;
}

export interface GitTagDeleteResult {
  name: string;
  current_branch: string;
  status: GitDeleteMutationStatus;
  deleted: boolean;
  target_commit: string;
  message: string;
  recovery: string;
}

export interface GitStash {
  ref: string;
  target_commit: string;
  branch: string;
  message: string;
}

export interface GitStashApplyResult {
  ref: string;
  status: GitApplyMutationStatus;
  dirty_files: number;
  commit_created: boolean;
  commit_hash: string;
  message: string;
  recovery: string;
}

export interface GitStashCreateResult {
  ref: string;
  status: GitCreateMutationStatus | 'blocked';
  dirty_files: number;
  stash_created: boolean;
  message: string;
  recovery: string;
}

export type GitWorktreeFileStatus =
  | 'modified'
  | 'untracked'
  | 'renamed'
  | 'copied'
  | 'added'
  | 'deleted'
  | 'unmerged'
  | 'ignored'
  | 'updated';
export type GitWorktreePorcelainStatus = string;

export interface GitWorktreeFile {
  path: string;
  original_path?: string;
  status: GitWorktreeFileStatus;
  index_status: GitWorktreePorcelainStatus;
  worktree_status: GitWorktreePorcelainStatus;
}

export type GitWorktreeCleanlinessStatus = 'clean' | 'dirty';

export interface GitWorktreeStatus {
  current_branch: string;
  status: GitWorktreeCleanlinessStatus;
  dirty_files: number;
  files: GitWorktreeFile[];
  diff_files: number;
  additions: number;
  deletions: number;
  diff: GitDiff[];
  message: string;
  recovery: string;
}

export type GitWorktreeDiscardMutationStatus = 'discarded' | 'blocked';

export interface GitWorktreeFileDiscardResult {
  path: string;
  status: GitWorktreeDiscardMutationStatus;
  dirty_files: number;
  message: string;
  recovery: string;
}

export type GitWorktreeCommitMutationStatus =
  | 'committed'
  | 'blocked'
  | 'committed_record_missing'
  | 'committed_record_failed';

export interface GitWorktreeCommitResult {
  status: GitWorktreeCommitMutationStatus;
  dirty_files: number;
  commit_created: boolean;
  commit_hash: string;
  message: string;
  recovery: string;
}

export interface GitBranchCompareCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  time: string;
}

export interface GitBranchCompareFile {
  path: string;
  additions: number;
  deletions: number;
  is_binary: boolean;
  content: string;
}

export interface GitBranchCompare {
  base_branch: string;
  head_branch: string;
  commits_ahead: number;
  files_changed: number;
  additions: number;
  deletions: number;
  files: GitBranchCompareFile[];
  commits: GitBranchCompareCommit[];
}

export type GitBranchSwitchReadinessStatus =
  | 'ready'
  | 'already_current'
  | 'target_missing'
  | 'dirty_worktree'
  | 'current_missing';

export interface GitBranchSwitchReadiness {
  current_branch: string;
  target_branch: string;
  status: GitBranchSwitchReadinessStatus;
  can_switch: boolean;
  dirty_files: number;
  message: string;
  recovery: string;
}

export type GitBranchSwitchMutationStatus = 'switched' | 'blocked';

export interface GitBranchSwitchResult {
  previous_branch: string;
  current_branch: string;
  target_branch: string;
  status: GitBranchSwitchMutationStatus;
  readiness: GitBranchSwitchReadiness;
  message: string;
  recovery: string;
}

export interface GitBranchCreateResult {
  name: string;
  from_branch: string;
  status: GitCreateMutationStatus;
  created: boolean;
  last_commit: string;
  message: string;
  recovery: string;
}

export interface GitBranchCreateFromRemoteResult {
  name: string;
  remote_branch: string;
  remote: string;
  branch: string;
  current_branch: string;
  status: GitCreateMutationStatus;
  created: boolean;
  tracking: boolean;
  last_commit: string;
  message: string;
  recovery: string;
}

export type GitRemoteBranchRefreshMutationStatus = 'fetched' | 'blocked';

export interface GitRemoteBranchRefreshResult {
  remote: string;
  status: GitRemoteBranchRefreshMutationStatus;
  fetched: boolean;
  message: string;
  recovery: string;
}

export interface GitBranchDeleteResult {
  name: string;
  current_branch: string;
  status: GitDeleteMutationStatus;
  deleted: boolean;
  last_commit: string;
  message: string;
  recovery: string;
}

export type GitBranchRenameMutationStatus = 'renamed' | 'blocked';

export interface GitBranchRenameResult {
  previous_name: string;
  name: string;
  current_branch: string;
  status: GitBranchRenameMutationStatus;
  renamed: boolean;
  last_commit: string;
  message: string;
  recovery: string;
}

export type GitCommitFileRestoreMutationStatus = 'restored' | 'blocked';

export interface GitCommitFileRestoreResult {
  hash: string;
  path: string;
  status: GitCommitFileRestoreMutationStatus;
  dirty_files: number;
  commit_created: boolean;
  commit_hash: string;
  message: string;
  recovery: string;
}

export interface GitBranchCompareFileApplyResult {
  base_branch: string;
  head_branch: string;
  path: string;
  status: GitApplyMutationStatus;
  dirty_files: number;
  commit_created: boolean;
  commit_hash: string;
  message: string;
  recovery: string;
}

export type ProjectBackupCreateMutationStatus = 'created' | 'blocked';

export type ProjectBackupSource = string;

export type ProjectBackupExcludedPath = string;

export type ProjectBackupExcludedPathList = ProjectBackupExcludedPath[];

export type ProjectBackupRestoreConflictPath = string;

export type ProjectBackupRestoreConflictPathList = ProjectBackupRestoreConflictPath[];

export type ProjectBackupRestoreUnsafePath = string;

export type ProjectBackupRestoreUnsafePathList = ProjectBackupRestoreUnsafePath[];

export interface ProjectBackupResult {
  status: ProjectBackupCreateMutationStatus;
  project_id: string;
  backup_id: string;
  backup_created: boolean;
  file_name: string;
  manifest_name: string;
  size_bytes: number;
  file_count: number;
  directory_count: number;
  excluded_paths: ProjectBackupExcludedPathList;
  checksum_sha256: string;
  created_at: string;
  source: ProjectBackupSource;
  message: string;
  recovery: string;
}

export type ProjectBackupListRecordStatus = 'available' | 'archive_missing' | 'manifest_invalid';

export interface ProjectBackupListRecord {
  status: ProjectBackupListRecordStatus;
  project_id: string;
  backup_id: string;
  file_name: string;
  manifest_name: string;
  size_bytes: number;
  file_count: number;
  directory_count: number;
  excluded_paths: ProjectBackupExcludedPathList;
  checksum_sha256: string;
  created_at: string;
  source: ProjectBackupSource;
  message: string;
  recovery: string;
}

export type ProjectBackupListStatus = 'ready' | 'empty';

export interface ProjectBackupListResult {
  status: ProjectBackupListStatus;
  project_id: string;
  backup_count: number;
  backups: ProjectBackupListRecord[];
  message: string;
  recovery: string;
}

export type ProjectBackupRemoteProvider = string;
export type ProjectBackupRemoteBucket = string;
export type ProjectBackupRemotePrefix = string;
export type ProjectBackupRemoteEndpoint = string;
export type ProjectBackupRemoteRegion = string;
export type ProjectBackupRemoteObjectKey = string;

export interface ProjectBackupPolicyReadiness {
  status: ProjectBackupReadinessStatus;
  project_id: string;
  auto_backup_enabled: boolean;
  backup_dir_configured: boolean;
  backup_dir: string;
  available_backup_count: number;
  latest_available_backup: ProjectBackupListRecord | null;
  message: string;
  recovery: string;
}

export interface ProjectBackupRemoteStorageReadiness {
  status: ProjectBackupReadinessStatus;
  project_id: string;
  remote_backup_enabled: boolean;
  provider: ProjectBackupRemoteProvider;
  provider_configured: boolean;
  bucket: ProjectBackupRemoteBucket;
  bucket_configured: boolean;
  prefix: ProjectBackupRemotePrefix;
  endpoint: ProjectBackupRemoteEndpoint;
  region: ProjectBackupRemoteRegion;
  credentials_configured: boolean;
  available_backup_count: number;
  latest_available_backup: ProjectBackupListRecord | null;
  message: string;
  recovery: string;
}

export type ProjectBackupRemoteUploadMutationStatus = 'uploaded' | 'blocked' | 'failed';

export interface ProjectBackupRemoteUploadResult {
  status: ProjectBackupRemoteUploadMutationStatus;
  project_id: string;
  backup_id: string;
  uploaded: boolean;
  provider: ProjectBackupRemoteProvider;
  bucket: ProjectBackupRemoteBucket;
  prefix: ProjectBackupRemotePrefix;
  archive_object_key: ProjectBackupRemoteObjectKey;
  manifest_object_key: ProjectBackupRemoteObjectKey;
  archive_size_bytes: number;
  manifest_size_bytes: number;
  checksum_sha256: string;
  checksum_verified: boolean;
  credentials_configured: boolean;
  message: string;
  recovery: string;
}

export type ProjectBackupRemoteInventoryRecordStatus = 'complete' | 'manifest_only' | 'archive_only';

export interface ProjectBackupRemoteInventoryRecord {
  status: ProjectBackupRemoteInventoryRecordStatus;
  project_id: string;
  backup_id: string;
  archive_object_key: ProjectBackupRemoteObjectKey;
  manifest_object_key: ProjectBackupRemoteObjectKey;
  archive_size_bytes: number;
  manifest_size_bytes: number;
  archive_last_modified: string;
  manifest_last_modified: string;
  message: string;
}

export type ProjectBackupRemoteInventoryStatus = 'ready' | 'empty' | 'disabled' | 'blocked' | 'failed';

export interface ProjectBackupRemoteInventoryResult {
  status: ProjectBackupRemoteInventoryStatus;
  project_id: string;
  remote_backup_enabled: boolean;
  provider: ProjectBackupRemoteProvider;
  bucket: ProjectBackupRemoteBucket;
  prefix: ProjectBackupRemotePrefix;
  endpoint: ProjectBackupRemoteEndpoint;
  region: ProjectBackupRemoteRegion;
  credentials_configured: boolean;
  object_count: number;
  candidate_count: number;
  complete_count: number;
  candidates: ProjectBackupRemoteInventoryRecord[];
  message: string;
  recovery: string;
}

export type ProjectBackupRemoteDownloadMutationStatus = 'downloaded' | 'blocked' | 'failed';

export interface ProjectBackupRemoteDownloadResult {
  status: ProjectBackupRemoteDownloadMutationStatus;
  project_id: string;
  backup_id: string;
  downloaded: boolean;
  provider: ProjectBackupRemoteProvider;
  bucket: ProjectBackupRemoteBucket;
  prefix: ProjectBackupRemotePrefix;
  archive_object_key: ProjectBackupRemoteObjectKey;
  manifest_object_key: ProjectBackupRemoteObjectKey;
  file_name: string;
  manifest_name: string;
  archive_size_bytes: number;
  manifest_size_bytes: number;
  checksum_sha256: string;
  checksum_verified: boolean;
  credentials_configured: boolean;
  message: string;
  recovery: string;
}

export type ProjectBackupRemoteRestoreMutationStatus = 'restored' | 'blocked' | 'failed';
export type ProjectBackupRemoteRestoreDownloadStatus = ProjectBackupRemoteDownloadMutationStatus | '';
export type ProjectBackupRemoteRestoreApplyStatus = 'ready' | ProjectRestoreMutationStatus | '';

export interface ProjectBackupRemoteRestoreResult {
  status: ProjectBackupRemoteRestoreMutationStatus;
  project_id: string;
  backup_id: string;
  downloaded: boolean;
  restored: boolean;
  download_status: ProjectBackupRemoteRestoreDownloadStatus;
  restore_status: ProjectBackupRemoteRestoreApplyStatus;
  can_restore: boolean;
  provider: ProjectBackupRemoteProvider;
  bucket: ProjectBackupRemoteBucket;
  prefix: ProjectBackupRemotePrefix;
  archive_object_key: ProjectBackupRemoteObjectKey;
  manifest_object_key: ProjectBackupRemoteObjectKey;
  file_name: string;
  manifest_name: string;
  restored_files: number;
  restored_directories: number;
  archive_entry_count: number;
  conflict_paths: ProjectBackupRestoreConflictPathList;
  unsafe_paths: ProjectBackupRestoreUnsafePathList;
  checksum_sha256: string;
  checksum_verified: boolean;
  credentials_configured: boolean;
  message: string;
  recovery: string;
}

export type ProjectResourceSnapshotStatus = 'ready' | 'blocked' | 'failed' | 'unavailable' | 'not_required';
export type ProjectResourceAlertSnapshotStatus = ProjectResourceSnapshotStatus | 'not_checked';

export interface ProjectResourceSnapshotResult {
  status: ProjectResourceSnapshotStatus;
  project_id: string;
  app_type: string;
  container_status: ProjectRuntimeContainerStatus;
  container_id: string;
  container_name: string;
  container_image: string;
  container_port: number;
  metrics_available: boolean;
  cpu_percent: number;
  memory_usage_bytes: number;
  memory_limit_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  disk_usage_bytes: number;
  read_time: string;
  message: string;
  recovery: string;
}

export interface ProjectResourceAlertReadiness {
  status: ProjectResourceAlertReadinessStatus;
  project_id: string;
  resource_alert_enabled: boolean;
  cpu_threshold_configured: boolean;
  memory_threshold_configured: boolean;
  disk_threshold_configured: boolean;
  cpu_threshold_percent: number;
  memory_threshold_percent: number;
  disk_threshold_bytes: number;
  snapshot_status: ProjectResourceAlertSnapshotStatus;
  metrics_available: boolean;
  cpu_percent: number;
  memory_usage_bytes: number;
  memory_limit_bytes: number;
  memory_usage_percent: number;
  disk_usage_bytes: number;
  cpu_threshold_exceeded: boolean;
  memory_threshold_exceeded: boolean;
  disk_threshold_exceeded: boolean;
  any_threshold_exceeded: boolean;
  resource_snapshot: ProjectResourceSnapshotResult | null;
  message: string;
  recovery: string;
}

export interface ProjectResourceAlertThresholdPreview {
  name: ProjectResourceAlertThresholdName;
  configured: boolean;
  current_value: number;
  threshold_value: number;
  unit: ProjectResourceAlertThresholdUnit;
  exceeded: boolean;
}

export type ProjectResourceAlertEvaluationPreviewStatus =
  | 'ready'
  | 'would_alert'
  | 'blocked'
  | 'disabled'
  | 'unavailable';

export interface ProjectResourceAlertEvaluationPreview {
  status: ProjectResourceAlertEvaluationPreviewStatus;
  project_id: string;
  evaluation_id: string;
  evaluated_at: string;
  readiness_status: ProjectResourceAlertReadinessStatus;
  would_create_alert: boolean;
  triggered_count: number;
  triggered_thresholds: ProjectResourceAlertThresholdPreview[];
  thresholds: ProjectResourceAlertThresholdPreview[];
  readiness: ProjectResourceAlertReadiness;
  message: string;
  recovery: string;
}

export type ProjectResourceAlertEventCreateStatus =
  | 'created'
  | 'ready'
  | 'would_alert'
  | 'blocked'
  | 'disabled'
  | 'unavailable';
export type ProjectResourceAlertEventStatus = string;

export interface ProjectResourceAlertEventCreateResult {
  status: ProjectResourceAlertEventCreateStatus;
  project_id: string;
  event_created: boolean;
  event_id: number;
  evaluation_id: string;
  created_at: string;
  readiness_status: ProjectResourceAlertReadinessStatus | '';
  triggered_count: number;
  triggered_thresholds: ProjectResourceAlertThresholdPreview[];
  thresholds: ProjectResourceAlertThresholdPreview[];
  evaluation_preview: ProjectResourceAlertEvaluationPreview | null;
  message: string;
  recovery: string;
}

export interface ProjectResourceAlertEventRecord {
  id: number;
  project_id: string;
  user_id: string;
  status: ProjectResourceAlertEventStatus;
  evaluation_id: string;
  readiness_status: ProjectResourceAlertReadinessStatus | '';
  triggered_count: number;
  triggered_thresholds: ProjectResourceAlertThresholdPreview[];
  thresholds: ProjectResourceAlertThresholdPreview[];
  evaluation_preview: ProjectResourceAlertEvaluationPreview | null;
  triggered_thresholds_parse_error: string;
  thresholds_parse_error: string;
  evaluation_preview_parse_error: string;
  raw_triggered_thresholds: string;
  raw_thresholds: string;
  raw_evaluation_preview: string;
  message: string;
  recovery: string;
  created_at: string;
}

export type ProjectResourceAlertEventListStatus = 'ready' | 'empty' | 'unavailable';
export type ProjectResourceAlertNotificationProvider = string;

export interface ProjectResourceAlertEventListResult {
  status: ProjectResourceAlertEventListStatus;
  project_id: string;
  records: ProjectResourceAlertEventRecord[];
  total: number;
  offset: number;
  limit: number;
  message: string;
  recovery: string;
}

export interface ProjectResourceAlertNotificationReadiness {
  status: ProjectResourceAlertActionReadinessStatus;
  project_id: string;
  notification_enabled: boolean;
  provider: ProjectResourceAlertNotificationProvider;
  provider_supported: boolean;
  webhook_configured: boolean;
  candidate_event_available: boolean;
  candidate_event_id: number;
  candidate_event_status: ProjectResourceAlertEventStatus;
  candidate_evaluation_id: string;
  candidate_readiness_status: ProjectResourceAlertReadinessStatus | '';
  candidate_triggered_count: number;
  candidate_created_at: string;
  message: string;
  recovery: string;
}

export type ProjectResourceAlertNotificationSendStatus =
  | 'sent'
  | 'failed'
  | 'blocked'
  | 'empty'
  | 'disabled'
  | 'unavailable';
export type ProjectResourceAlertEnforcementMode = string;

export interface ProjectResourceAlertNotificationSendResult {
  status: ProjectResourceAlertNotificationSendStatus;
  project_id: string;
  provider: ProjectResourceAlertNotificationProvider;
  webhook_configured: boolean;
  notification_sent: boolean;
  notification_event_created: boolean;
  notification_event_id: number;
  candidate_event_id: number;
  candidate_evaluation_id: string;
  http_status_code: number;
  readiness: ProjectResourceAlertNotificationReadiness | null;
  message: string;
  recovery: string;
  created_at: string;
}

export interface ProjectResourceAlertEnforcementReadiness {
  status: ProjectResourceAlertActionReadinessStatus;
  project_id: string;
  enforcement_enabled: boolean;
  enforcement_mode: ProjectResourceAlertEnforcementMode;
  enforcement_mode_supported: boolean;
  notification_sent_required: boolean;
  notification_sent_available: boolean;
  candidate_event_available: boolean;
  candidate_event_id: number;
  candidate_evaluation_id: string;
  candidate_readiness_status: ProjectResourceAlertReadinessStatus | '';
  candidate_triggered_count: number;
  would_enforce: boolean;
  message: string;
  recovery: string;
}

export interface ProjectContainerStopResponse {
  project_id: string;
  stop_status: ProjectContainerStopStatus;
  container_status: ProjectContainerStopContainerStatus;
  container_status_persistence: ProjectContainerStatusPersistenceStatus;
  container_status_persistence_error?: string;
  runtime_status?: {
    projectId?: string;
    status: ProjectRuntimeLifecycleStatus;
    containerStatus?: ProjectRuntimeContainerStatus;
    phase?: ProjectRuntimePhase;
    message?: ProjectRuntimeMessage;
    error?: ProjectRuntimeError;
    containerStatusPersistence?: ProjectContainerStatusPersistenceStatus;
    containerStatusPersistenceError?: string;
    persistenceStatus?: ProjectRuntimeStatusPersistenceStatus;
    persistenceError?: string;
    completedAt?: string;
  };
}

export type ProjectResourceAlertEnforcementExecuteStatus =
  | 'executed'
  | 'failed'
  | 'blocked'
  | 'disabled'
  | 'empty'
  | 'unavailable';

export interface ProjectResourceAlertEnforcementExecuteResult {
  status: ProjectResourceAlertEnforcementExecuteStatus;
  project_id: string;
  enforcement_executed: boolean;
  enforcement_event_created: boolean;
  enforcement_event_id: number;
  candidate_event_id: number;
  candidate_evaluation_id: string;
  mode: ProjectResourceAlertEnforcementMode;
  readiness: ProjectResourceAlertEnforcementReadiness | null;
  stop_result: ProjectContainerStopResponse | null;
  message: string;
  recovery: string;
  created_at: string;
}

export type ProjectBackupRestorePreflightStatus = 'ready' | 'blocked';

export interface ProjectBackupRestorePreflightResult {
  status: ProjectBackupRestorePreflightStatus;
  project_id: string;
  backup_id: string;
  can_restore: boolean;
  file_name: string;
  manifest_name: string;
  size_bytes: number;
  file_count: number;
  directory_count: number;
  archive_entry_count: number;
  conflict_paths: ProjectBackupRestoreConflictPathList;
  unsafe_paths: ProjectBackupRestoreUnsafePathList;
  checksum_sha256: string;
  checksum_verified: boolean;
  message: string;
  recovery: string;
}

export interface ProjectBackupRestoreResult {
  status: ProjectRestoreMutationStatus;
  project_id: string;
  backup_id: string;
  restored: boolean;
  file_name: string;
  manifest_name: string;
  restored_files: number;
  restored_directories: number;
  archive_entry_count: number;
  conflict_paths: ProjectBackupRestoreConflictPathList;
  unsafe_paths: ProjectBackupRestoreUnsafePathList;
  checksum_sha256: string;
  checksum_verified: boolean;
  message: string;
  recovery: string;
}

export type AIModelProvider = string;
export type AIModelName = string;
export type AIModelProviderType = 'cloud' | 'local';
export type AIModelProviderBaseUrl = string;
export type AIModelProviderExtraConfig = string;
export type AIModelProviderReloadMessage = string;
export type AIModelProviderConnectionTestMessage = string;
export type AIModelProviderConnectionTestStatus = 'ready' | 'blocked' | 'failed';

export interface AIModel {
  id: AIModelName;
  name: AIModelName;
  provider: AIModelProvider;
}

// 重新导出 types/index.ts 中其他未冲突的类型
export {
  type UserIntent,
  type IntentType,
  type AppType,
  type FeatureList,
  type FeatureComponent,
  type FeatureComponentList,
  type Feature,
  type StylePreference,
  type TechStack,
  type ConstraintTargetAudience,
  type ConstraintTargetAudienceList,
  type ConstraintDevice,
  type ConstraintDeviceList,
  type TemplateTag,
  type TemplateTagList,
  type TemplateFileList,
  type TemplateVariableList,
  type TemplateExamplePrompt,
  type TemplateExamplePromptList,
  type TemplateFileDependency,
  type TemplateFileDependencyList,
  type TemplateVariableOption,
  type TemplateVariableOptionList,
  type Template,
  type TemplateFile,
  type TemplateVariable,
  type GenerationResult,
  type GeneratedFile,
  type GeneratedFileList,
  type GenerationStatus,
  type PackageInfo,
  type PackageInfoList,
  type GenerationProgress,
  type PreviewInfo,
  type PluginMetadata,
  type PluginType,
  type GenerateRequest,
  type GenerateOptions,
  type GenerateResponse,
} from './types/index';
