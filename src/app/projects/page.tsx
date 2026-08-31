/**
 * YiStack - 我的项目页面
 */

'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { projectApi } from '@/lib/api';
import type {
  Project,
  ProjectDeleteAcceptedResponse,
  ProjectDeletionCleanupScopeList,
  ProjectSoftDeleteRestoreResponse,
} from '@/lib/api';
import type {
  ProjectBackupListRecord,
  ProjectBackupListResult,
  ProjectBackupPolicyReadiness,
  ProjectBackupRemoteDownloadResult,
  ProjectBackupRemoteInventoryRecord,
  ProjectBackupRemoteInventoryResult,
  ProjectBackupRemoteRestoreResult,
  ProjectBackupRemoteStorageReadiness,
  ProjectBackupRemoteUploadResult,
  ProjectBackupRestorePreflightResult,
  ProjectBackupRestoreResult,
  ProjectBackupResult,
  ProjectResourceAlertEnforcementExecuteResult,
  ProjectResourceAlertEnforcementReadiness,
  ProjectResourceAlertEvaluationPreview,
  ProjectResourceAlertEventCreateResult,
  ProjectResourceAlertEventRecord,
  ProjectResourceAlertEventListResult,
  ProjectResourceAlertNotificationReadiness,
  ProjectResourceAlertNotificationSendResult,
  ProjectResourceAlertReadiness,
  ProjectResourceAlertThresholdPreview,
  ProjectResourceSnapshotResult,
} from '@/lib/types';
import {
  buildProjectListApiHealthFailure,
  buildProjectListSyncFailureDiagnosis,
  type ProjectListApiHealthFailure,
} from '@/lib/workspace/project-list-api-health';
import { formatProjectListOperationError } from '@/lib/workspace/project-list-operation-errors';
import {
  formatProjectRuntimeStopFailure,
  formatProjectRuntimeStopNotice,
} from '@/lib/workspace/project-list-runtime-stop-errors';
import {
  buildProjectListSnapshotPersistenceFailure,
  type ProjectListSnapshotPersistenceFailure,
} from '@/lib/workspace/project-list-snapshot-local-errors';
import { buildWorkspaceEntryNavigationSnapshot, WorkspaceEntryNavigationSnapshotStrip } from '../workspace/workspace-entry-navigation-snapshot';
import { getTechStackLabels } from '@/lib/tech-stack';
import {
  Activity,
  ArrowLeft,
  Archive,
  BellPlus,
  BellRing,
  Cloud,
  Plus,
  Layers,
  Calendar,
  Download,
  Upload,
  Trash2,
  Pencil,
  Folder,
  History,
  LogIn,
  MoreHorizontal,
  RefreshCw,
  Repeat,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildProjectCardSnapshot, ProjectCardSnapshotStrip } from './project-card-snapshot';
import type {
  ProjectCardDeletionRecovery,
  ProjectCardDeletionRecoveryCleanupScopeList,
} from './project-card-snapshot';
import { buildProjectListPageSnapshot, ProjectListPageSnapshotStrip } from './project-list-page-snapshot';
import {
  buildProjectEditSaveConfirmationSnapshot,
  buildProjectMutationDialogSnapshot,
  ProjectEditSaveConfirmationSnapshotStrip,
  ProjectMutationDialogSnapshotStrip,
} from './project-mutation-dialog-snapshot';
import {
  buildProjectActionConfirmationDialogSnapshot,
  getProjectActionConfirmationDialogNullableValue,
  getProjectActionConfirmationDialogValue,
  ProjectActionConfirmationDialogSnapshotStrip,
  type ProjectActionConfirmation,
} from './project-action-confirmation-dialog-snapshot';
import type { ProjectListNoticeKind } from '../workspace/workspace-types';

const projectListSnapshotStatusParam = 'project_list_snapshot_status';
const projectListSnapshotDetailsParam = 'project_list_snapshot_details';

type ProjectAppTypeBadgeKey = 'web' | 'mobile' | 'miniprogram' | 'desktop';

type ProjectAppTypeBadgeProfile = {
  label: string;
  color: string;
};

type ProjectAppTypeBadgeMap = {
  web: ProjectAppTypeBadgeProfile;
  mobile: ProjectAppTypeBadgeProfile;
  miniprogram: ProjectAppTypeBadgeProfile;
  desktop: ProjectAppTypeBadgeProfile;
};

const PROJECT_APP_TYPE_BADGES: ProjectAppTypeBadgeMap = {
  web: { label: '网页应用', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  mobile: { label: '移动应用', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  miniprogram: { label: '小程序', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  desktop: { label: '桌面应用', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
};

const PROJECT_APP_TYPE_EXPLICIT_BADGE_KEYS: readonly ProjectAppTypeBadgeKey[] = [
  'mobile',
  'miniprogram',
  'desktop',
];

function getProjectAppTypeExplicitBadgeKey(appType: string): ProjectAppTypeBadgeKey | null {
  for (const candidate of PROJECT_APP_TYPE_EXPLICIT_BADGE_KEYS) {
    if (candidate === appType) {
      return candidate;
    }
  }

  return null;
}

function getProjectAppTypeBadgeKey(appType: string): ProjectAppTypeBadgeKey {
  const explicitKey = getProjectAppTypeExplicitBadgeKey(appType);
  if (explicitKey === null) {
    return 'web';
  }

  return explicitKey;
}

function getProjectAppTypeBadge(appType: string): ProjectAppTypeBadgeProfile {
  return PROJECT_APP_TYPE_BADGES[getProjectAppTypeBadgeKey(appType)];
}

type LocalPersistenceResult =
  | { ok: true }
  | ProjectListSnapshotPersistenceFailure;

type RecoverableDeletedProject = {
  project: Project;
  restoreWindowSeconds: number;
  cleanupScope: ProjectDeletionCleanupScopeList;
};

type ProjectListProjectActionBusyState = {
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
  pendingProjectActionProjectId: string | null;
};

type ProjectListContainerStatusBadgeProfile = {
  label: string;
  color: string;
};

type ProjectListContainerStatusList = readonly string[];
type ProjectListBooleanFactList = readonly boolean[];
type ProjectListNullableProjectIdList = readonly (string | null)[];
type ProjectListBackupContextActionKindList = readonly ProjectActionConfirmation['kind'][];
type ProjectListNoticePreviewLabelList = string[];
type ProjectListTriggeredThresholdLabelList = string[];
type ProjectListTechStackBadgeNodeList = ReactNode[];
type ProjectListProjectCardNodeList = ReactNode[];
type ProjectListProjectPatch = Partial<Project>;

const PROJECT_LIST_STOPPABLE_CONTAINER_STATUSES: ProjectListContainerStatusList = [
  'running',
  'starting',
  'creating',
];

const PROJECT_LIST_STOPPED_CONTAINER_STATUSES: ProjectListContainerStatusList = [
  'stopped',
  'exited',
];

const PROJECT_LIST_STARTING_CONTAINER_STATUSES: ProjectListContainerStatusList = [
  'creating',
  'starting',
];

const PROJECT_LIST_ERROR_CONTAINER_STATUSES: ProjectListContainerStatusList = [
  'error',
  'failed',
];

const PROJECT_LIST_BACKUP_CONTEXT_ACTION_KINDS: ProjectListBackupContextActionKindList = [
  'backup_restore',
  'backup_remote_restore',
  'backup_remote_upload',
  'backup_remote_download',
];

export type ProjectDeletionRecoveryRawObject = {
  [fieldName: string]: unknown;
};

export type ProjectListWorkspaceSnapshotValue = string;

function hasProjectListWorkspaceSnapshotValue(
  value: ProjectListWorkspaceSnapshotValue | null | undefined,
): value is ProjectListWorkspaceSnapshotValue {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getProjectListWorkspaceSnapshotValue(
  value: ProjectListWorkspaceSnapshotValue | null | undefined,
  fallback: ProjectListWorkspaceSnapshotValue,
): ProjectListWorkspaceSnapshotValue {
  const hasValue = hasProjectListWorkspaceSnapshotValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectListWorkspaceSnapshotNumberValue(
  value: number | null | undefined,
  fallback: number,
): number {
  const hasValue = value !== null && value !== undefined;
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectListWorkspaceSnapshotProjectName(project: Project, fallback: string): string {
  return getProjectListWorkspaceSnapshotValue(project.name, fallback);
}

export type ProjectListNoticeValue = string;
const PROJECT_LIST_NOTICE_PREVIEW_LIMIT = 3;

function materializeProjectListTechStackBadgeNodes(techStack: Project['tech_stack']): ProjectListTechStackBadgeNodeList {
  const nodes: ProjectListTechStackBadgeNodeList = [];
  const labels = getTechStackLabels(techStack);

  for (const tech of labels) {
    nodes.push(
      <Badge key={tech} variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
        {tech}
      </Badge>,
    );
  }

  return nodes;
}

function hasProjectListNoticeValue(
  value: ProjectListNoticeValue | null | undefined,
): value is ProjectListNoticeValue {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getProjectListNoticeValue(
  value: ProjectListNoticeValue | null | undefined,
  fallback: ProjectListNoticeValue,
): ProjectListNoticeValue {
  const hasValue = hasProjectListNoticeValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectListNoticeProjectName(project: Project, fallbackProjectId: string): string {
  return getProjectListNoticeValue(project.name, fallbackProjectId);
}

function getProjectListNoticeNumberValue(value: number | null | undefined, fallback: number): number {
  const hasValue = value !== null && value !== undefined;
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectListNoticeOptionalSegment(value: string, prefix: string): string {
  const hasValue = hasProjectListNoticeValue(value);
  if (hasValue === false) {
    return '';
  }

  return `${prefix}${value}`;
}

function getProjectListNoticeBooleanSegment(isEnabled: boolean, segment: string): string {
  if (isEnabled === false) {
    return '';
  }

  return segment;
}

function getProjectListNoticePositiveNumberSegment(value: number, segment: string): string {
  const hasPositiveValue = value > 0;
  if (hasPositiveValue === false) {
    return '';
  }

  return segment;
}

function getProjectListNoticeItemCount<TItem>(items: readonly TItem[]): number {
  return items.length;
}

function hasProjectListNoticeItems<TItem>(items: readonly TItem[]): boolean {
  const itemCount = getProjectListNoticeItemCount(items);
  const hasItems = itemCount > 0;
  return hasItems === true;
}

function getProjectListNoticePreviewItems<TItem>(items: readonly TItem[]): readonly TItem[] {
  return items.slice(0, PROJECT_LIST_NOTICE_PREVIEW_LIMIT);
}

function getProjectListNoticeHiddenCount(totalCount: number, visibleCount: number): number {
  const hiddenCount = totalCount - visibleCount;
  const hasHiddenItems = hiddenCount > 0;
  if (hasHiddenItems === false) {
    return 0;
  }

  return hiddenCount;
}

function getProjectListNoticeHiddenLabel(totalCount: number, visibleCount: number, unitLabel: string): string {
  const hiddenCount = getProjectListNoticeHiddenCount(totalCount, visibleCount);
  const hasHiddenItems = hiddenCount > 0;
  if (hasHiddenItems === false) {
    return '';
  }

  return `；另有 ${hiddenCount} ${unitLabel}未展开`;
}

function getProjectListNoticeJoinedPreviewLabel<TItem>(
  items: readonly TItem[],
  separator: string,
  fallback: string,
  formatItem: (item: TItem) => string,
): string {
  const previewItems = getProjectListNoticePreviewItems(items);
  const labels: ProjectListNoticePreviewLabelList = [];

  for (const item of previewItems) {
    labels.push(formatItem(item));
  }

  const preview = labels.join(separator);
  return getProjectListNoticeValue(preview, fallback);
}

function getProjectListAvailableBackup(backups: readonly ProjectBackupListRecord[]): ProjectBackupListRecord | null {
  for (const backup of backups) {
    if (backup.status === 'available') {
      return backup;
    }
  }

  return null;
}

function getProjectListCompleteRemoteBackupCandidate(
  candidates: readonly ProjectBackupRemoteInventoryRecord[],
): ProjectBackupRemoteInventoryRecord | null {
  for (const candidate of candidates) {
    if (candidate.status === 'complete') {
      return candidate;
    }
  }

  return null;
}

function getProjectListNoticePathLabel(paths: readonly string[], prefix: string): string {
  const hasPaths = hasProjectListNoticeItems(paths);
  if (hasPaths === false) {
    return '';
  }

  return `${prefix}${paths.join(' / ')}`;
}

function getProjectListNoticeThresholdLabel(threshold: ProjectResourceAlertThresholdPreview): string {
  return `${threshold.name}:${threshold.current_value}/${threshold.threshold_value}${threshold.unit}`;
}

function getProjectListTriggeredThresholdsLabel(thresholds: readonly ProjectResourceAlertThresholdPreview[]): string {
  const labels: ProjectListTriggeredThresholdLabelList = [];

  for (const threshold of thresholds) {
    labels.push(getProjectListNoticeThresholdLabel(threshold));
  }

  const triggered = labels.join('；');
  return getProjectListNoticeValue(triggered, 'none');
}

function getProjectListNoticeAlertEventRecordLabel(record: ProjectResourceAlertEventRecord): string {
  const readiness = getProjectListNoticeValue(record.readiness_status, 'unknown');
  const evaluation = getProjectListNoticeValue(record.evaluation_id, 'none');
  const createdAt = getProjectListNoticeValue(record.created_at, 'none');
  return `#${record.id}:${record.status},readiness=${readiness},triggered=${record.triggered_count},evaluation=${evaluation},created_at=${createdAt}`;
}

function getProjectListNoticeRemoteCandidateLabel(candidate: ProjectBackupRemoteInventoryRecord): string {
  return `${candidate.backup_id}:${candidate.status},archive=${candidate.archive_size_bytes} bytes,manifest=${candidate.manifest_size_bytes} bytes`;
}

function getProjectResourceAlertNotificationReadinessCandidateSegment(
  result: ProjectResourceAlertNotificationReadiness,
  candidateReadiness: string,
  candidateEvaluation: string,
  candidateCreatedAt: string,
): string {
  const createdAtSegment = getProjectListNoticeOptionalSegment(candidateCreatedAt, ',created_at=');
  const candidateSegment = `；候选事件=#${result.candidate_event_id}:${result.candidate_event_status},readiness=${candidateReadiness},triggered=${result.candidate_triggered_count},evaluation=${candidateEvaluation}${createdAtSegment}`;
  return getProjectListNoticeBooleanSegment(result.candidate_event_available, candidateSegment);
}

function getProjectResourceAlertEnforcementReadinessCandidateSegment(
  result: ProjectResourceAlertEnforcementReadiness,
  candidateReadiness: string,
  candidateEvaluation: string,
): string {
  const candidateSegment = `；候选事件=#${result.candidate_event_id},readiness=${candidateReadiness},triggered=${result.candidate_triggered_count},evaluation=${candidateEvaluation}`;
  return getProjectListNoticeBooleanSegment(result.candidate_event_available, candidateSegment);
}

function getProjectResourceAlertCandidateIdSegment(candidateEventId: number, candidateEvaluation: string): string {
  const candidateSegment = `；候选事件=#${candidateEventId},evaluation=${candidateEvaluation}`;
  return getProjectListNoticePositiveNumberSegment(candidateEventId, candidateSegment);
}

function getProjectResourceAlertEventCreatedSegment(
  isCreated: boolean,
  eventId: number,
  createdAt: string,
  label: string,
): string {
  const eventSegment = `；${label}=#${eventId},created_at=${createdAt}`;
  return getProjectListNoticeBooleanSegment(isCreated, eventSegment);
}

function getProjectResourceAlertHttpStatusSegment(httpStatusCode: number): string {
  const httpStatusSegment = `；http_status=${httpStatusCode}`;
  return getProjectListNoticePositiveNumberSegment(httpStatusCode, httpStatusSegment);
}

function getProjectResourceAlertStopResultSegment(
  stopResult: ProjectResourceAlertEnforcementExecuteResult['stop_result'],
): string {
  if (stopResult === null) {
    return '';
  }

  return `；stop_status=${stopResult.stop_status},container_status=${stopResult.container_status},container_status_persistence=${stopResult.container_status_persistence}`;
}

function getProjectBackupDownloadRegexCapture(match: RegExpMatchArray, index: number): string | undefined {
  const capture = match[index];
  if (capture === undefined) {
    return undefined;
  }

  return capture;
}

function getProjectBackupDownloadMatchedFileName(match: RegExpMatchArray | null): string | null {
  if (match === null) {
    return null;
  }

  const fileName = getProjectBackupDownloadRegexCapture(match, 1);
  if (fileName === undefined) {
    return null;
  }

  return fileName;
}

function getProjectListDisplayValue(
  value: string | null | undefined,
  fallback: string,
): string {
  return getProjectListNoticeValue(value, fallback);
}

function getProjectListSnapshotDetailsLabel(value: string | null | undefined): string {
  return getProjectListDisplayValue(value, 'none');
}

function getProjectListReadinessLabel(value: boolean): string {
  if (value === true) {
    return 'ready';
  }

  return 'blocked';
}

function getProjectListNoticeTitleLabel(value: string | null | undefined): string {
  return getProjectListDisplayValue(value, '项目状态提示');
}

function getProjectListCardDescriptionLabel(project: Project): string {
  return getProjectListDisplayValue(project.description, '暂无描述');
}

function getProjectListCardTimestampValue(value: string | null | undefined, fallback: string): string {
  return getProjectListDisplayValue(value, fallback);
}

function getProjectListSoftDeleteRestoredProject(restoredProject: Project | undefined, fallbackProject: Project): Project {
  const hasRestoredProject = restoredProject !== undefined;
  if (hasRestoredProject === false) {
    return fallbackProject;
  }

  return restoredProject;
}

function getProjectListWithoutProject(projects: readonly Project[], projectId: string): Project[] {
  const nextProjects: Project[] = [];

  for (const project of projects) {
    const isTargetProject = project.project_id === projectId;
    if (isTargetProject === false) {
      nextProjects.push(project);
    }
  }

  return nextProjects;
}

function getProjectListWithProjectUpsert(projects: readonly Project[], projectId: string, nextProject: Project): Project[] {
  const nextProjects: Project[] = [];
  let hasMatchedProject = false;

  for (const project of projects) {
    const isTargetProject = project.project_id === projectId;
    if (isTargetProject === true) {
      nextProjects.push(nextProject);
      hasMatchedProject = true;
    } else {
      nextProjects.push(project);
    }
  }

  if (hasMatchedProject === false) {
    return [nextProject, ...nextProjects];
  }

  return nextProjects;
}

function getProjectListWithProjectPatch(
  projects: readonly Project[],
  projectId: string,
  patch: ProjectListProjectPatch,
): Project[] {
  const nextProjects: Project[] = [];

  for (const project of projects) {
    const isTargetProject = project.project_id === projectId;
    if (isTargetProject === true) {
      nextProjects.push({ ...project, ...patch });
    } else {
      nextProjects.push(project);
    }
  }

  return nextProjects;
}

function getProjectListConfirmableAction(
  confirmation: ProjectActionConfirmation | null,
  canConfirm: boolean,
): ProjectActionConfirmation | null {
  if (confirmation === null) {
    return null;
  }

  if (canConfirm !== true) {
    return null;
  }

  return confirmation;
}

function getProjectListSubmittableDialogProject(project: Project | null, canSubmit: boolean): Project | null {
  if (project === null) {
    return null;
  }

  if (canSubmit !== true) {
    return null;
  }

  return project;
}

function getProjectListConfirmableDialogProject(project: Project | null, canConfirm: boolean): Project | null {
  if (project === null) {
    return null;
  }

  if (canConfirm !== true) {
    return null;
  }

  return project;
}

function hasProjectListTrueFact(values: ProjectListBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function hasProjectListBusyProjectId(projectId: string, values: ProjectListNullableProjectIdList): boolean {
  for (const value of values) {
    if (value === projectId) {
      return true;
    }
  }

  return false;
}

function shouldRenderProjectListLoadingPanel(isLoading: boolean, authLoading: boolean): boolean {
  return hasProjectListTrueFact([isLoading, authLoading]);
}

function isProjectListProjectActionBusy(projectId: string, state: ProjectListProjectActionBusyState): boolean {
  const busyProjectIds: ProjectListNullableProjectIdList = [
    state.stoppingProjectId,
    state.checkingResourceSnapshotProjectId,
    state.checkingResourceAlertReadinessProjectId,
    state.previewingResourceAlertEvaluationProjectId,
    state.creatingResourceAlertEventProjectId,
    state.listingResourceAlertEventsProjectId,
    state.checkingResourceAlertNotificationProjectId,
    state.sendingResourceAlertNotificationProjectId,
    state.checkingResourceAlertEnforcementProjectId,
    state.executingResourceAlertEnforcementProjectId,
    state.backingUpProjectId,
    state.listingBackupsProjectId,
    state.checkingBackupPolicyProjectId,
    state.checkingBackupRemoteStorageProjectId,
    state.checkingBackupRemoteInventoryProjectId,
    state.uploadingBackupRemoteStorageProjectId,
    state.downloadingBackupRemoteStorageProjectId,
    state.restoringBackupRemoteStorageProjectId,
    state.runningAutomaticBackupProjectId,
    state.downloadingBackupProjectId,
    state.preflightingBackupProjectId,
    state.restoringBackupProjectId,
    state.pendingProjectActionProjectId,
  ];
  return hasProjectListBusyProjectId(projectId, busyProjectIds);
}

function isProjectListValueInList(value: string | undefined, values: ProjectListContainerStatusList): boolean {
  for (const candidate of values) {
    if (candidate === value) {
      return true;
    }
  }

  return false;
}

function canStopProjectListContainerStatus(containerStatus: string | undefined): boolean {
  return isProjectListValueInList(containerStatus, PROJECT_LIST_STOPPABLE_CONTAINER_STATUSES);
}

function isProjectListBackupContextActionKind(kind: ProjectActionConfirmation['kind']): boolean {
  for (const candidate of PROJECT_LIST_BACKUP_CONTEXT_ACTION_KINDS) {
    if (candidate === kind) {
      return true;
    }
  }

  return false;
}

function getProjectListBlockedActionNoticeKind(kind: ProjectActionConfirmation['kind']): ProjectListNoticeKind {
  const isBackupContextAction = isProjectListBackupContextActionKind(kind);
  if (isBackupContextAction === true) {
    return 'backup_restore_blocked';
  }

  return 'resource_alert_enforcement_execute_blocked';
}

function persistProjectListWorkspaceSnapshot(project: Project, projectId: string): LocalPersistenceResult {
  const projectName = getProjectListWorkspaceSnapshotProjectName(project, projectId);
  const projectDescription = getProjectListWorkspaceSnapshotValue(project.description, '');
  const projectAppType = getProjectListWorkspaceSnapshotValue(project.app_type, 'web');
  const projectTechStack = getProjectListWorkspaceSnapshotValue(project.tech_stack, '');
  const projectPlanId = getProjectListWorkspaceSnapshotValue(project.plan_id, '');
  const projectPlanData = getProjectListWorkspaceSnapshotValue(project.plan_data, '');
  const projectContainerPort = getProjectListWorkspaceSnapshotNumberValue(project.container_port, 0);
  const projectPreviewUrl = getProjectListWorkspaceSnapshotValue(project.preview_url, '');
  const projectContainerStatus = getProjectListWorkspaceSnapshotValue(project.container_status, '');

  try {
    localStorage.setItem('yistack_current_project', JSON.stringify({
      projectId,
      projectName,
      description: projectDescription,
      appType: projectAppType,
      fileTree: project,
      initialMessage: `继续完善 ${projectName} 项目`,
      techStack: projectTechStack,
      planId: projectPlanId,
      planData: projectPlanData,
      containerPort: projectContainerPort,
      previewUrl: projectPreviewUrl,
      containerStatus: projectContainerStatus,
      isPersisted: true,
    }));
    return { ok: true };
  } catch (error) {
    return buildProjectListSnapshotPersistenceFailure(error);
  }
}

function formatProjectDeletionAcceptedNotice(project: Project, result: ProjectDeleteAcceptedResponse) {
  const hasCleanupScope = hasProjectListNoticeItems(result.cleanup_scope);
  const cleanupScope = hasCleanupScope === true
    ? result.cleanup_scope.join(' / ')
    : 'container / project_directory / chat_messages / generated_file_metadata / git_commits';
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  return `项目 ${projectName} 已从列表移除，后端已受理删除请求并进入 ${result.restore_window_seconds} 秒软删除恢复窗口。窗口内可显式恢复项目记录；窗口结束后容器、项目目录、历史消息、生成文件元数据和 Git 提交记录会按异步清理策略继续处理。清理范围：${cleanupScope}。`;
}

function formatProjectSoftDeleteRestoreNotice(project: Project, result: ProjectSoftDeleteRestoreResponse) {
  const restoreScopeItems = result.restore_scope;
  const hasRestoreScopeItems = restoreScopeItems !== undefined && hasProjectListNoticeItems(restoreScopeItems) === true;
  const restoreScope = hasRestoreScopeItems === true
    ? restoreScopeItems.join(' / ')
    : 'project_record.deleted_at';
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const cleanupStatus = getProjectListNoticeValue(result.cleanup_status, 'unknown');
  const restoreBoundary = getProjectListNoticeValue(
    result.restore_boundary,
    '该入口只恢复项目软删标记，不启动容器、不执行 Git 或备份写操作。',
  );
  return `项目 ${projectName} 已在软删除恢复窗口内恢复：restore_status=${result.restore_status}，cleanup_status=${cleanupStatus}，恢复范围=${restoreScope}。${restoreBoundary}`;
}

function formatProjectBackupNotice(project: Project, result: ProjectBackupResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  if (result.status === 'blocked') {
    return `项目 ${projectName} 当前无法创建备份：${result.message}。${result.recovery}`;
  }
  const sizeLabel = result.size_bytes > 0 ? `${result.size_bytes} bytes` : '0 bytes';
  const excludedLabel = getProjectListNoticePathLabel(result.excluded_paths, '；已排除：');
  return `项目 ${projectName} 备份已创建：${result.file_name}，manifest：${result.manifest_name}，文件 ${result.file_count} 个，目录 ${result.directory_count} 个，归档大小 ${sizeLabel}，checksum=${result.checksum_sha256}${excludedLabel}。${result.recovery}`;
}

function formatProjectBackupListNotice(project: Project, result: ProjectBackupListResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  if (result.status === 'empty') {
    return `项目 ${projectName} 当前没有本地备份 manifest。${result.recovery}`;
  }
  const previewItems = getProjectListNoticePreviewItems(result.backups);
  const visibleCount = getProjectListNoticeItemCount(previewItems);
  const previewLabel = getProjectListNoticeJoinedPreviewLabel(
    result.backups,
    ' / ',
    '无可展示记录',
    (backup) => `${getProjectListNoticeValue(backup.backup_id, backup.manifest_name)}(${backup.status}, ${backup.size_bytes} bytes)`,
  );
  const hiddenLabel = getProjectListNoticeHiddenLabel(result.backup_count, visibleCount, '条');
  return `项目 ${projectName} 已读取 ${result.backup_count} 条本地备份记录：${previewLabel}${hiddenLabel}。${result.recovery}`;
}

function formatProjectBackupPolicyReadinessNotice(project: Project, result: ProjectBackupPolicyReadiness) {
  const latest = result.latest_available_backup
    ? `；最近可用备份=${result.latest_available_backup.backup_id}(${result.latest_available_backup.size_bytes} bytes)`
    : '';
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  return `项目 ${projectName} 自动备份策略状态：status=${result.status}，auto_backup_enabled=${result.auto_backup_enabled}，backup_dir_configured=${result.backup_dir_configured}，available_backup_count=${result.available_backup_count}${latest}。${result.message}。${result.recovery}`;
}

function formatProjectBackupRemoteStorageReadinessNotice(project: Project, result: ProjectBackupRemoteStorageReadiness) {
  const latest = result.latest_available_backup
    ? `；最近可上传本地备份=${result.latest_available_backup.backup_id}(${result.latest_available_backup.size_bytes} bytes)`
    : '';
  const endpoint = getProjectListNoticeOptionalSegment(result.endpoint, '，endpoint=');
  const region = getProjectListNoticeOptionalSegment(result.region, '，region=');
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const provider = getProjectListNoticeValue(result.provider, 'unconfigured');
  return `项目 ${projectName} 备份远端存储状态：status=${result.status}，remote_backup_enabled=${result.remote_backup_enabled}，provider=${provider}，provider_configured=${result.provider_configured}，bucket_configured=${result.bucket_configured}，credentials_configured=${result.credentials_configured}，available_backup_count=${result.available_backup_count}${latest}${endpoint}${region}。${result.message}。${result.recovery}`;
}

function formatProjectBackupRemoteUploadNotice(project: Project, result: ProjectBackupRemoteUploadResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const backupId = getProjectListNoticeValue(result.backup_id, 'none');
  const provider = getProjectListNoticeValue(result.provider, 'unconfigured');
  const bucket = getProjectListNoticeValue(result.bucket, 'unconfigured');
  if (result.status !== 'uploaded') {
    return `项目 ${projectName} 备份远端上传未完成：status=${result.status}，backup_id=${backupId}，provider=${provider}，bucket=${bucket}，credentials_configured=${result.credentials_configured}。${result.message}。${result.recovery}`;
  }
  return `项目 ${projectName} 备份已上传远端存储：backup_id=${result.backup_id}，archive_object_key=${result.archive_object_key}，manifest_object_key=${result.manifest_object_key}，archive_size=${result.archive_size_bytes} bytes，manifest_size=${result.manifest_size_bytes} bytes，checksum=${result.checksum_sha256}，checksum_verified=${result.checksum_verified}。${result.recovery}`;
}

function formatProjectBackupRemoteDownloadNotice(project: Project, result: ProjectBackupRemoteDownloadResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const backupId = getProjectListNoticeValue(result.backup_id, 'none');
  const provider = getProjectListNoticeValue(result.provider, 'unconfigured');
  const bucket = getProjectListNoticeValue(result.bucket, 'unconfigured');
  if (result.status !== 'downloaded') {
    return `项目 ${projectName} 备份远端下载导入未完成：status=${result.status}，backup_id=${backupId}，provider=${provider}，bucket=${bucket}，credentials_configured=${result.credentials_configured}。${result.message}。${result.recovery}`;
  }
  return `项目 ${projectName} 远端备份完整候选已导入本地备份缓存：backup_id=${result.backup_id}，archive_object_key=${result.archive_object_key}，manifest_object_key=${result.manifest_object_key}，file=${result.file_name}，manifest=${result.manifest_name}，archive_size=${result.archive_size_bytes} bytes，manifest_size=${result.manifest_size_bytes} bytes，checksum=${result.checksum_sha256}，checksum_verified=${result.checksum_verified}。${result.recovery}`;
}

function formatProjectBackupRemoteRestoreNotice(project: Project, result: ProjectBackupRemoteRestoreResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const downloadStatus = getProjectListNoticeValue(result.download_status, 'none');
  const restoreStatus = getProjectListNoticeValue(result.restore_status, 'none');
  const backupId = getProjectListNoticeValue(result.backup_id, 'none');
  const provider = getProjectListNoticeValue(result.provider, 'unconfigured');
  const bucket = getProjectListNoticeValue(result.bucket, 'unconfigured');
  if (result.status !== 'restored') {
    return `项目 ${projectName} 备份远端恢复未完成：status=${result.status}，download_status=${downloadStatus}，restore_status=${restoreStatus}，backup_id=${backupId}，provider=${provider}，bucket=${bucket}，downloaded=${result.downloaded}，restored=${result.restored}，can_restore=${result.can_restore}，checksum_verified=${result.checksum_verified}。${result.message}。${result.recovery}`;
  }
  return `项目 ${projectName} 远端备份完整候选已导入并完成受控恢复：backup_id=${result.backup_id}，archive_object_key=${result.archive_object_key}，manifest_object_key=${result.manifest_object_key}，file=${result.file_name}，manifest=${result.manifest_name}，restored_files=${result.restored_files}，restored_directories=${result.restored_directories}，archive_entry_count=${result.archive_entry_count}，checksum=${result.checksum_sha256}，checksum_verified=${result.checksum_verified}。${result.recovery}`;
}

function formatProjectResourceSnapshotNotice(project: Project, result: ProjectResourceSnapshotResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const containerStatus = getProjectListNoticeValue(result.container_status, 'unknown');
  const containerFallback = getProjectListNoticeValue(result.container_id, 'none');
  const container = getProjectListNoticeValue(result.container_name, containerFallback);
  const containerImage = getProjectListNoticeValue(result.container_image, 'unknown');
  const containerPort = getProjectListNoticeNumberValue(result.container_port, 0);
  const readTime = getProjectListNoticeValue(result.read_time, 'unknown');
  return `项目 ${projectName} 资源快照：status=${result.status}，app_type=${result.app_type}，container_status=${containerStatus}，container=${container}，image=${containerImage}，port=${containerPort}，metrics_available=${result.metrics_available}，cpu=${result.cpu_percent}%，memory=${result.memory_usage_bytes}/${result.memory_limit_bytes} bytes，network_rx=${result.network_rx_bytes} bytes，network_tx=${result.network_tx_bytes} bytes，disk=${result.disk_usage_bytes} bytes，read_time=${readTime}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertReadinessNotice(project: Project, result: ProjectResourceAlertReadiness) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  return `项目 ${projectName} 资源告警 readiness：status=${result.status}，enabled=${result.resource_alert_enabled}，snapshot_status=${result.snapshot_status}，metrics_available=${result.metrics_available}，cpu=${result.cpu_percent}%/${result.cpu_threshold_percent}% exceeded=${result.cpu_threshold_exceeded}，memory=${result.memory_usage_bytes}/${result.memory_limit_bytes} bytes ${result.memory_usage_percent}%/${result.memory_threshold_percent}% exceeded=${result.memory_threshold_exceeded}，disk=${result.disk_usage_bytes}/${result.disk_threshold_bytes} bytes exceeded=${result.disk_threshold_exceeded}，any_exceeded=${result.any_threshold_exceeded}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertEvaluationPreviewNotice(project: Project, result: ProjectResourceAlertEvaluationPreview) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const triggeredLabel = getProjectListTriggeredThresholdsLabel(result.triggered_thresholds);
  return `项目 ${projectName} 资源告警评估预览：status=${result.status}，readiness=${result.readiness_status}，would_create_alert=${result.would_create_alert}，triggered_count=${result.triggered_count}，triggered=${triggeredLabel}，evaluation_id=${result.evaluation_id}，evaluated_at=${result.evaluated_at}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertEventCreateNotice(project: Project, result: ProjectResourceAlertEventCreateResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const eventId = result.event_id > 0 ? String(result.event_id) : 'none';
  const evaluationId = getProjectListNoticeValue(result.evaluation_id, 'none');
  const readiness = getProjectListNoticeValue(result.readiness_status, 'unknown');
  const triggeredLabel = getProjectListTriggeredThresholdsLabel(result.triggered_thresholds);
  const createdAt = getProjectListNoticeValue(result.created_at, 'none');
  return `项目 ${projectName} 资源告警事件创建：status=${result.status}，event_created=${result.event_created}，event_id=${eventId}，evaluation_id=${evaluationId}，readiness=${readiness}，triggered_count=${result.triggered_count}，triggered=${triggeredLabel}，created_at=${createdAt}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertEventListNotice(project: Project, result: ProjectResourceAlertEventListResult) {
  const previewItems = getProjectListNoticePreviewItems(result.records);
  const visibleCount = getProjectListNoticeItemCount(previewItems);
  const hidden = getProjectListNoticeHiddenLabel(result.total, visibleCount, '条');
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const previewLabel = getProjectListNoticeJoinedPreviewLabel(
    result.records,
    '；',
    'none',
    getProjectListNoticeAlertEventRecordLabel,
  );
  return `项目 ${projectName} 资源告警事件列表：status=${result.status}，total=${result.total}，offset=${result.offset}，limit=${result.limit}，events=${previewLabel}${hidden}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertNotificationReadinessNotice(project: Project, result: ProjectResourceAlertNotificationReadiness) {
  const candidateReadiness = getProjectListNoticeValue(result.candidate_readiness_status, 'unknown');
  const candidateEvaluation = getProjectListNoticeValue(result.candidate_evaluation_id, 'none');
  const candidateCreatedAt = getProjectListNoticeValue(result.candidate_created_at, 'none');
  const candidate = getProjectResourceAlertNotificationReadinessCandidateSegment(
    result,
    candidateReadiness,
    candidateEvaluation,
    candidateCreatedAt,
  );
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const provider = getProjectListNoticeValue(result.provider, 'unconfigured');
  return `项目 ${projectName} 资源告警通知通道 readiness：status=${result.status}，enabled=${result.notification_enabled}，provider=${provider}，provider_supported=${result.provider_supported}，webhook_configured=${result.webhook_configured}，candidate_event_available=${result.candidate_event_available}${candidate}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertNotificationSendNotice(project: Project, result: ProjectResourceAlertNotificationSendResult) {
  const candidateEvaluation = getProjectListNoticeValue(result.candidate_evaluation_id, 'none');
  const candidate = getProjectResourceAlertCandidateIdSegment(result.candidate_event_id, candidateEvaluation);
  const createdAt = getProjectListNoticeValue(result.created_at, 'none');
  const delivery = getProjectResourceAlertEventCreatedSegment(
    result.notification_event_created,
    result.notification_event_id,
    createdAt,
    '通知事件',
  );
  const httpStatus = getProjectResourceAlertHttpStatusSegment(result.http_status_code);
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const provider = getProjectListNoticeValue(result.provider, 'unconfigured');
  return `项目 ${projectName} 资源告警通知发送：status=${result.status}，sent=${result.notification_sent}，provider=${provider}，webhook_configured=${result.webhook_configured}${candidate}${delivery}${httpStatus}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertEnforcementReadinessNotice(project: Project, result: ProjectResourceAlertEnforcementReadiness) {
  const candidateReadiness = getProjectListNoticeValue(result.candidate_readiness_status, 'unknown');
  const candidateEvaluation = getProjectListNoticeValue(result.candidate_evaluation_id, 'none');
  const candidate = getProjectResourceAlertEnforcementReadinessCandidateSegment(
    result,
    candidateReadiness,
    candidateEvaluation,
  );
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const enforcementMode = getProjectListNoticeValue(result.enforcement_mode, 'unconfigured');
  return `项目 ${projectName} 资源告警硬配额执行 readiness：status=${result.status}，enabled=${result.enforcement_enabled}，mode=${enforcementMode}，mode_supported=${result.enforcement_mode_supported}，notification_sent_required=${result.notification_sent_required}，notification_sent_available=${result.notification_sent_available}，would_enforce=${result.would_enforce}${candidate}。${result.message}。${result.recovery}`;
}

function formatProjectResourceAlertEnforcementExecuteNotice(project: Project, result: ProjectResourceAlertEnforcementExecuteResult) {
  const candidateEvaluation = getProjectListNoticeValue(result.candidate_evaluation_id, 'none');
  const candidate = getProjectResourceAlertCandidateIdSegment(result.candidate_event_id, candidateEvaluation);
  const createdAt = getProjectListNoticeValue(result.created_at, 'none');
  const enforcementEvent = getProjectResourceAlertEventCreatedSegment(
    result.enforcement_event_created,
    result.enforcement_event_id,
    createdAt,
    '执行事件',
  );
  const stopResult = getProjectResourceAlertStopResultSegment(result.stop_result);
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const mode = getProjectListNoticeValue(result.mode, 'unconfigured');
  return `项目 ${projectName} 资源告警硬配额执行：status=${result.status}，executed=${result.enforcement_executed}，mode=${mode}${candidate}${enforcementEvent}${stopResult}。${result.message}。${result.recovery}`;
}

function formatProjectBackupRemoteInventoryNotice(project: Project, result: ProjectBackupRemoteInventoryResult) {
  const previewItems = getProjectListNoticePreviewItems(result.candidates);
  const visibleCount = getProjectListNoticeItemCount(previewItems);
  const candidateCount = getProjectListNoticeItemCount(result.candidates);
  const hidden = getProjectListNoticeHiddenLabel(candidateCount, visibleCount, '个候选');
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const provider = getProjectListNoticeValue(result.provider, 'unconfigured');
  const bucket = getProjectListNoticeValue(result.bucket, 'unconfigured');
  const previewLabel = getProjectListNoticeJoinedPreviewLabel(
    result.candidates,
    '；',
    'none',
    getProjectListNoticeRemoteCandidateLabel,
  );
  return `项目 ${projectName} 远端备份对象清单：status=${result.status}，provider=${provider}，bucket=${bucket}，credentials_configured=${result.credentials_configured}，object_count=${result.object_count}，candidate_count=${result.candidate_count}，complete_count=${result.complete_count}，候选=${previewLabel}${hidden}。${result.message}。${result.recovery}`;
}

function formatProjectAutomaticBackupRunNotice(project: Project, result: ProjectBackupResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  if (result.status !== 'created') {
    return `项目 ${projectName} 自动备份策略执行被阻断：${result.message}。${result.recovery}`;
  }
  const sizeLabel = result.size_bytes > 0 ? `${result.size_bytes} bytes` : '0 bytes';
  const excludedLabel = getProjectListNoticePathLabel(result.excluded_paths, '；已排除：');
  return `项目 ${projectName} 已按自动备份策略创建本地备份：${result.file_name}，source=${result.source}，manifest：${result.manifest_name}，文件 ${result.file_count} 个，目录 ${result.directory_count} 个，归档大小 ${sizeLabel}，checksum=${result.checksum_sha256}${excludedLabel}。${result.recovery}`;
}

function getProjectBackupDownloadFileName(response: Response, fallbackFileName: string) {
  const disposition = getProjectListNoticeValue(response.headers.get('Content-Disposition'), '');
  const match = disposition.match(/filename="([^"]+)"/);
  const matchedFileName = getProjectBackupDownloadMatchedFileName(match);
  const candidate = getProjectListNoticeValue(matchedFileName, fallbackFileName);
  return getProjectListNoticeValue(candidate.trim(), fallbackFileName);
}

function formatProjectBackupDownloadNotice(project: Project, backupId: string, response: Response, fileName: string) {
  const checksum = getProjectListNoticeValue(response.headers.get('X-YiStack-Backup-Checksum-SHA256'), 'unknown');
  const verified = getProjectListNoticeValue(response.headers.get('X-YiStack-Backup-Checksum-Verified'), 'false');
  const size = getProjectListNoticeValue(response.headers.get('Content-Length'), 'unknown');
  const projectName = getProjectListNoticeProjectName(project, backupId);
  return `项目 ${projectName} 的本地备份归档已开始下载：backup_id=${backupId}，文件=${fileName}，大小=${size} bytes，checksum=${checksum}，checksum_verified=${verified}。该入口只读取本地备份归档并交给浏览器下载，不写项目目录、不启动容器、不执行 Git 操作，也不上传远端存储。`;
}

function formatProjectBackupRestorePreflightNotice(project: Project, result: ProjectBackupRestorePreflightResult) {
  const conflictLabel = getProjectListNoticePathLabel(result.conflict_paths, '；冲突路径：');
  const unsafeLabel = getProjectListNoticePathLabel(result.unsafe_paths, '；不安全路径：');
  const checksumLabel = result.checksum_verified ? '已验证' : '未通过';
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  const fileName = getProjectListNoticeValue(result.file_name, '未确认');
  const manifestName = getProjectListNoticeValue(result.manifest_name, '未确认');
  return `项目 ${projectName} 的备份恢复预检${result.status === 'ready' ? '通过' : '被阻断'}：backup_id=${result.backup_id}，归档=${fileName}，manifest=${manifestName}，条目 ${result.archive_entry_count} 个，checksum ${checksumLabel}${conflictLabel}${unsafeLabel}。${result.message}。${result.recovery}`;
}

function formatProjectBackupRestoreNotice(project: Project, result: ProjectBackupRestoreResult) {
  const projectName = getProjectListNoticeProjectName(project, result.project_id);
  if (result.status === 'blocked') {
    const conflictLabel = getProjectListNoticePathLabel(result.conflict_paths, '；冲突路径：');
    const unsafeLabel = getProjectListNoticePathLabel(result.unsafe_paths, '；不安全路径：');
    return `项目 ${projectName} 的备份恢复被阻断：backup_id=${result.backup_id}${conflictLabel}${unsafeLabel}。${result.message}。${result.recovery}`;
  }
  return `项目 ${projectName} 已从本地备份恢复：backup_id=${result.backup_id}，归档=${result.file_name}，写入文件 ${result.restored_files} 个，目录 ${result.restored_directories} 个，checksum=${result.checksum_sha256}。${result.recovery}`;
}

function normalizeProjectCardDeletionRecoveryCleanupScope(raw: unknown): ProjectCardDeletionRecoveryCleanupScopeList {
  const isRawList = Array.isArray(raw);
  if (isRawList === false) return [];

  const cleanupScope: ProjectCardDeletionRecoveryCleanupScopeList = [];

  for (const item of raw) {
    const isCleanupScopeItem = typeof item === 'string';
    if (isCleanupScopeItem === true) {
      cleanupScope.push(item);
    }
  }

  return cleanupScope;
}

function isProjectDeletionRecoveryRawObject(value: unknown): value is ProjectDeletionRecoveryRawObject {
  const isRawList = Array.isArray(value);
  const isRawObject = value !== null && typeof value === 'object' && isRawList === false;
  return isRawObject === true;
}

function getProjectDeletionRecoveryRawValue(project: Project): unknown {
  const engineeringState = project.engineering_state;
  const hasEngineeringState = engineeringState !== undefined;
  if (hasEngineeringState === false) {
    return null;
  }

  return engineeringState.deletion_recovery;
}

function getProjectDeletionRecovery(project: Project): ProjectCardDeletionRecovery {
  const rawRecovery = getProjectDeletionRecoveryRawValue(project);
  const hasRawRecovery = isProjectDeletionRecoveryRawObject(rawRecovery);
  if (hasRawRecovery === false) return null;

  const recovery = rawRecovery;
  const status = typeof recovery.status === 'string' ? recovery.status : '';
  if (status !== 'restored_after_cleanup_failure') return null;

  return {
    reason: typeof recovery.reason_message === 'string'
      ? recovery.reason_message
      : '后台资源清理失败',
    cleanupScope: normalizeProjectCardDeletionRecoveryCleanupScope(recovery.cleanup_scope),
  };
}

export default function ProjectsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    app_type: 'web',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editSaveConfirmationOpen, setEditSaveConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [projectListError, setProjectListError] = useState<string | null>(null);
  const [projectListApiFailure, setProjectListApiFailure] = useState<ProjectListApiHealthFailure | null>(null);
  const [projectListNotice, setProjectListNotice] = useState<string | null>(null);
  const [projectListNoticeTitle, setProjectListNoticeTitle] = useState<string | null>(null);
  const [projectListNoticeKind, setProjectListNoticeKind] = useState<ProjectListNoticeKind | null>(null);
  const [editProjectError, setEditProjectError] = useState<string | null>(null);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);
  const [stopProjectError, setStopProjectError] = useState<string | null>(null);
  const [resourceProjectError, setResourceProjectError] = useState<string | null>(null);
  const [backupProjectError, setBackupProjectError] = useState<string | null>(null);
  const [stoppingProjectId, setStoppingProjectId] = useState<string | null>(null);
  const [checkingResourceSnapshotProjectId, setCheckingResourceSnapshotProjectId] = useState<string | null>(null);
  const [checkingResourceAlertReadinessProjectId, setCheckingResourceAlertReadinessProjectId] = useState<string | null>(null);
  const [previewingResourceAlertEvaluationProjectId, setPreviewingResourceAlertEvaluationProjectId] = useState<string | null>(null);
  const [creatingResourceAlertEventProjectId, setCreatingResourceAlertEventProjectId] = useState<string | null>(null);
  const [listingResourceAlertEventsProjectId, setListingResourceAlertEventsProjectId] = useState<string | null>(null);
  const [checkingResourceAlertNotificationProjectId, setCheckingResourceAlertNotificationProjectId] = useState<string | null>(null);
  const [sendingResourceAlertNotificationProjectId, setSendingResourceAlertNotificationProjectId] = useState<string | null>(null);
  const [checkingResourceAlertEnforcementProjectId, setCheckingResourceAlertEnforcementProjectId] = useState<string | null>(null);
  const [executingResourceAlertEnforcementProjectId, setExecutingResourceAlertEnforcementProjectId] = useState<string | null>(null);
  const [backingUpProjectId, setBackingUpProjectId] = useState<string | null>(null);
  const [listingBackupsProjectId, setListingBackupsProjectId] = useState<string | null>(null);
  const [checkingBackupPolicyProjectId, setCheckingBackupPolicyProjectId] = useState<string | null>(null);
  const [checkingBackupRemoteStorageProjectId, setCheckingBackupRemoteStorageProjectId] = useState<string | null>(null);
  const [checkingBackupRemoteInventoryProjectId, setCheckingBackupRemoteInventoryProjectId] = useState<string | null>(null);
  const [uploadingBackupRemoteStorageProjectId, setUploadingBackupRemoteStorageProjectId] = useState<string | null>(null);
  const [downloadingBackupRemoteStorageProjectId, setDownloadingBackupRemoteStorageProjectId] = useState<string | null>(null);
  const [restoringBackupRemoteStorageProjectId, setRestoringBackupRemoteStorageProjectId] = useState<string | null>(null);
  const [runningAutomaticBackupProjectId, setRunningAutomaticBackupProjectId] = useState<string | null>(null);
  const [downloadingBackupProjectId, setDownloadingBackupProjectId] = useState<string | null>(null);
  const [preflightingBackupProjectId, setPreflightingBackupProjectId] = useState<string | null>(null);
  const [restoringBackupProjectId, setRestoringBackupProjectId] = useState<string | null>(null);
  const [recoverableDeletedProject, setRecoverableDeletedProject] = useState<RecoverableDeletedProject | null>(null);
  const [restoringDeletedProjectId, setRestoringDeletedProjectId] = useState<string | null>(null);
  const [pendingProjectActionConfirmation, setPendingProjectActionConfirmation] = useState<ProjectActionConfirmation | null>(null);
  const [isConfirmingProjectAction, setIsConfirmingProjectAction] = useState(false);
  const [projectListReloadToken, setProjectListReloadToken] = useState(0);

  const getProjectKey = (project: Project) => project.project_id;
  const hasProjectListError = projectListError !== null;
  const hasHoveredProject = hoveredProject !== null;
  const projectCount = getProjectListNoticeItemCount(projects);
  const hasProjects = hasProjectListNoticeItems(projects);
  const isProjectListEntryBusy = shouldRenderProjectListLoadingPanel(isLoading, authLoading);
  const entryNavigationSnapshot = buildWorkspaceEntryNavigationSnapshot({
    surface: 'project_list',
    isAuthenticated,
    authLoading,
    isBusy: isProjectListEntryBusy,
    hasProjectListError,
    projectCount,
    hasTargetProject: hasHoveredProject,
    targetProjectId: hoveredProject,
  });
  const projectListPageSnapshot = buildProjectListPageSnapshot({
    isAuthenticated,
    authLoading,
    isLoading,
    projectCount,
    projectListApiFailure,
    projectListBackendHealthProbe: null,
    projectListBackendHealthFailure: null,
    isCheckingProjectListBackendHealth: false,
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
    editingProjectId: editingProject ? getProjectKey(editingProject) : null,
    deletingProjectId: deletingProject ? getProjectKey(deletingProject) : null,
  });
  const editDialogSnapshot = buildProjectMutationDialogSnapshot({
    mode: editingProject ? 'edit' : 'none',
    project: editingProject,
    editForm,
    isSaving,
    isDeleting,
    editProjectError,
    deleteProjectError,
  });
  const editSaveConfirmationSnapshot = buildProjectEditSaveConfirmationSnapshot({
    project: editingProject,
    editForm,
    isOpen: editSaveConfirmationOpen,
    isSaving,
    editProjectError,
  });
  const deleteDialogSnapshot = buildProjectMutationDialogSnapshot({
    mode: deletingProject ? 'delete' : 'none',
    project: deletingProject,
    editForm,
    isSaving,
    isDeleting,
    editProjectError,
    deleteProjectError,
  });
  const projectActionConfirmationSnapshot = buildProjectActionConfirmationDialogSnapshot({
    confirmation: pendingProjectActionConfirmation,
    isConfirming: isConfirmingProjectAction,
  });
  const hasPendingProjectActionConfirmation = pendingProjectActionConfirmation !== null;
  const pendingProjectActionProjectId = hasPendingProjectActionConfirmation === true
    ? getProjectKey(pendingProjectActionConfirmation.project)
    : null;
  const pendingProjectActionTitle = hasPendingProjectActionConfirmation === true
    ? getProjectActionConfirmationDialogValue(pendingProjectActionConfirmation.title, '确认项目受控操作')
    : '确认项目受控操作';
  const pendingProjectActionDescription = hasPendingProjectActionConfirmation === true
    ? getProjectActionConfirmationDialogValue(
      pendingProjectActionConfirmation.description,
      '请确认是否执行该项目受控操作。',
    )
    : '请确认是否执行该项目受控操作。';
  const pendingProjectActionProjectNameFallback = pendingProjectActionProjectId !== null
    ? pendingProjectActionProjectId
    : '未选择项目';
  const pendingProjectActionProjectLabel = hasPendingProjectActionConfirmation === true
    ? getProjectListWorkspaceSnapshotProjectName(
      pendingProjectActionConfirmation.project,
      pendingProjectActionProjectNameFallback,
    )
    : '未选择项目';
  const pendingProjectActionKindLabel = hasPendingProjectActionConfirmation === true
    ? pendingProjectActionConfirmation.kind
    : 'none';
  const pendingProjectActionBackupId = hasPendingProjectActionConfirmation === true
    ? getProjectActionConfirmationDialogNullableValue(pendingProjectActionConfirmation.backupId)
    : null;
  const shouldRenderPendingProjectActionBackupId = pendingProjectActionBackupId !== null;
  const pendingProjectActionConfirmLabel = isConfirmingProjectAction === true
    ? '执行中...'
    : hasPendingProjectActionConfirmation === true
      ? getProjectActionConfirmationDialogValue(pendingProjectActionConfirmation.confirmLabel, '确认执行')
      : '确认执行';
  const projectListApiHealthDetailsLabel = getProjectListSnapshotDetailsLabel(projectListPageSnapshot.apiHealthDetails);
  const projectListAuthRecoveryDetailsLabel = getProjectListSnapshotDetailsLabel(projectListPageSnapshot.authRecoveryDetails);
  const projectListSyncFailureDiagnosis = buildProjectListSyncFailureDiagnosis({
    apiHealthStatus: projectListPageSnapshot.apiHealthStatus,
    apiHealthSource: projectListPageSnapshot.apiHealthSource,
    apiHealthReasonCode: projectListPageSnapshot.apiHealthReasonCode,
    apiHealthDetails: projectListPageSnapshot.apiHealthDetails,
    authRecoveryStatus: projectListPageSnapshot.authRecoveryStatus,
    authRecoveryReasonCode: projectListPageSnapshot.authRecoveryReasonCode,
    authRecoveryDetails: projectListPageSnapshot.authRecoveryDetails,
    canLoginRecovery: projectListPageSnapshot.canLoginRecovery,
    canRetryProjectListAfterAuth: projectListPageSnapshot.canRetryProjectListAfterAuth,
    backendHealthStatus: projectListPageSnapshot.backendHealthStatus,
    backendHealthSource: projectListPageSnapshot.backendHealthSource,
    backendHealthReasonCode: projectListPageSnapshot.backendHealthReasonCode,
    backendHealthDetails: projectListPageSnapshot.backendHealthDetails,
  });
  const projectListSyncFailureRetryLabel = getProjectListReadinessLabel(projectListSyncFailureDiagnosis.canRetryProjectList);
  const projectListSyncFailureLoginLabel = getProjectListReadinessLabel(projectListSyncFailureDiagnosis.canLoginRecovery);
  const projectListNoticeTitleLabel = getProjectListNoticeTitleLabel(projectListNoticeTitle);
  const shouldShowProjectListLoadingPanel = shouldRenderProjectListLoadingPanel(isLoading, authLoading);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  // 加载项目列表
  useEffect(() => {
    if (authLoading === true) return;
    
    if (isAuthenticated === false) {
      // 未登录，显示空状态，引导登录
      setProjectListApiFailure(null);
      setIsLoading(false);
      return;
    }

    const loadProjects = async () => {
      setProjectListError(null);
      setProjectListApiFailure(null);
      setProjectListNotice(null);
      setProjectListNoticeTitle(null);
      setProjectListNoticeKind(null);
      setRecoverableDeletedProject(null);
      setStopProjectError(null);
      setResourceProjectError(null);
      setBackupProjectError(null);
      setPendingProjectActionConfirmation(null);
      setIsConfirmingProjectAction(false);
      try {
        const response = await projectApi.list();
        setProjects(response.projects);
      } catch (error) {
        console.error('加载项目失败:', error);
        setProjectListApiFailure(buildProjectListApiHealthFailure(error));
        setProjectListError(
          `项目列表加载失败：${formatProjectListOperationError(error, '请稍后重试')}。当前列表可能为空或不是最新状态；你可以稍后重试，或返回首页后通过项目链接重新进入。`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [isAuthenticated, authLoading, projectListReloadToken]);

  // 进入项目工作台
  const openProject = (project: Project) => {
    const projectId = getProjectKey(project);

    const persistResult = persistProjectListWorkspaceSnapshot(project, projectId);
    const targetParams = new URLSearchParams({ projectId });
    if (persistResult.ok === false) {
      targetParams.set(projectListSnapshotStatusParam, 'failed');
      targetParams.set(projectListSnapshotDetailsParam, persistResult.details);
    }
    router.push(`/workspace?${targetParams.toString()}`);
  };

  // 删除项目
  const deleteProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteProjectError(null);
    setDeletingProject(project);
  };

  const handleDeleteProject = async () => {
    const projectToDelete = getProjectListSubmittableDialogProject(
      deletingProject,
      deleteDialogSnapshot.canSubmit,
    );
    if (projectToDelete === null) {
      return;
    }

    const projectId = getProjectKey(projectToDelete);
    const deletingProjectSnapshot = projectToDelete;
    setIsDeleting(true);
    setDeleteProjectError(null);

    try {
      const deleteResult = await projectApi.delete(projectId);
      setProjects((prev) => getProjectListWithoutProject(prev, projectId));
      setRecoverableDeletedProject({
        project: deletingProjectSnapshot,
        restoreWindowSeconds: deleteResult.restore_window_seconds,
        cleanupScope: deleteResult.cleanup_scope,
      });
      setProjectListNoticeTitle(null);
      setProjectListNoticeKind(null);
      setProjectListNotice(null);
      setDeletingProject(null);
    } catch (error) {
      console.error('删除项目失败:', error);
      setDeleteProjectError(
        `删除项目失败：${formatProjectListOperationError(error, '请稍后重试')}。当前项目仍保留在列表中，后端删除状态未确认；请稍后重试或刷新项目列表确认。`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const restoreDeletedProject = async () => {
    const hasRecoverableDeletedProject = recoverableDeletedProject !== null;
    if (hasRecoverableDeletedProject === false) return;

    const project = recoverableDeletedProject.project;
    const projectId = getProjectKey(project);
    setRestoringDeletedProjectId(projectId);
    setDeleteProjectError(null);

    try {
      const result = await projectApi.restoreDeleted(projectId);
      const restoredProject = getProjectListSoftDeleteRestoredProject(result.restored_project, project);
      setProjects((prev) => getProjectListWithProjectUpsert(prev, projectId, restoredProject));
      setRecoverableDeletedProject(null);
      setProjectListNoticeTitle('项目已从软删除恢复窗口恢复');
      setProjectListNoticeKind('delete_restored');
      setProjectListNotice(formatProjectSoftDeleteRestoreNotice(restoredProject, result));
    } catch (error) {
      console.error('恢复软删除项目失败:', error);
      setProjectListNoticeTitle('项目软删除恢复失败');
      setProjectListNoticeKind('delete_restore_failed');
      setProjectListNotice(
        `恢复项目失败：${formatProjectListOperationError(error, '请稍后重试')}。恢复窗口可能已过期，或后台资源清理已经开始；请刷新项目列表确认最新状态。`,
      );
    } finally {
      setRestoringDeletedProjectId(null);
    }
  };

  const openRestoreDeletedProjectConfirmation = () => {
    const hasRecoverableDeletedProject = recoverableDeletedProject !== null;
    if (hasRecoverableDeletedProject === false) return;

    const project = recoverableDeletedProject.project;
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    const cleanupScope = getProjectListNoticeValue(
      recoverableDeletedProject.cleanupScope.join(' / '),
      'project_record.deleted_at',
    );
    setPendingProjectActionConfirmation({
      kind: 'delete_restore',
      project,
      title: '确认恢复软删除项目',
      description: `确认在 ${recoverableDeletedProject.restoreWindowSeconds} 秒恢复窗口内恢复项目 ${projectName}？该操作只恢复项目记录的软删除状态，不启动容器、不恢复项目文件、不执行 Git 或备份写入。`,
      confirmLabel: '确认恢复项目',
      riskLevel: 'medium',
      recovery: `取消不会修改项目删除状态或后台清理状态。恢复范围：${cleanupScope}。`,
    });
  };

  const canStopProjectRuntime = (project: Project) => canStopProjectListContainerStatus(project.container_status);

  const requestStopProjectRuntime = (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setPendingProjectActionConfirmation({
      kind: 'runtime_stop',
      project,
      title: '确认停止项目运行时',
      description: `确认停止项目 ${projectName} 的开发运行时？该操作会调用 stop_container，可能断开 Preview、Terminal、Explorer/Git 运行时只读资源，并写入 container_status 与 runtime-status 停止快照。`,
      confirmLabel: '确认停止运行时',
      riskLevel: 'high',
      recovery: '取消不会调用 stop_container，也不会改变项目卡片状态、container_status 或 runtime-status 快照；确认后请以停止结果提示和后续 Runtime Health 快照为准。',
    });
  };

  const confirmStopProjectRuntime = async (project: Project) => {
    const projectId = getProjectKey(project);
    setStopProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setStoppingProjectId(projectId);

    try {
      const result = await projectApi.stopContainer(projectId);
      setProjects((prev) => getProjectListWithProjectPatch(prev, projectId, {
        container_status: result.container_status,
      }));
      setProjectListNoticeTitle('项目运行时停止结果已返回');
      setProjectListNoticeKind('runtime_stop_completed');
      setProjectListNotice(formatProjectRuntimeStopNotice(project, result));
    } catch (error) {
      console.error('停止项目运行时失败:', error);
      setStopProjectError(
        `停止项目运行时失败：${formatProjectRuntimeStopFailure(error, '请稍后重试')}。当前项目卡片仍保留停止前状态，停止动作、container_status 同步和 runtime-status 停止快照写入结果未完全确认；请稍后刷新项目列表或查看 Runtime Health。`,
      );
    } finally {
      setStoppingProjectId(null);
    }
  };

  const checkProjectResourceSnapshot = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCheckingResourceSnapshotProjectId(projectId);

    try {
      const result = await projectApi.getResourceSnapshot(projectId);
      const noticeKind = result.status === 'ready'
        ? 'resource_snapshot_ready'
        : result.status === 'failed'
          ? 'resource_snapshot_failed'
          : 'resource_snapshot_blocked';
      setProjectListNoticeTitle(result.status === 'ready' ? '项目资源快照已读取' : '项目资源快照未就绪');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceSnapshotNotice(project, result));
    } catch (error) {
      console.error('读取项目资源快照失败:', error);
      setResourceProjectError(
        `读取项目资源快照失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认资源观测未读取成功；不会启动或停止容器，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setCheckingResourceSnapshotProjectId(null);
    }
  };

  const checkProjectResourceAlertReadiness = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCheckingResourceAlertReadinessProjectId(projectId);

    try {
      const result = await projectApi.getResourceAlertReadiness(projectId);
      const noticeKind = result.status === 'ready'
        ? 'resource_alert_ready'
        : result.status === 'alerting'
          ? 'resource_alert_alerting'
          : 'resource_alert_blocked';
      setProjectListNoticeTitle(result.status === 'ready' ? '项目资源告警策略就绪' : '项目资源告警策略未就绪');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertReadinessNotice(project, result));
    } catch (error) {
      console.error('读取项目资源告警 readiness 失败:', error);
      setResourceProjectError(
        `读取项目资源告警 readiness 失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认资源告警策略未读取成功；不会启动或停止容器，不会创建告警，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setCheckingResourceAlertReadinessProjectId(null);
    }
  };

  const previewProjectResourceAlertEvaluation = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setPreviewingResourceAlertEvaluationProjectId(projectId);

    try {
      const result = await projectApi.getResourceAlertEvaluationPreview(projectId);
      const noticeKind = result.status === 'would_alert'
        ? 'resource_alert_preview_would_alert'
        : result.status === 'ready'
          ? 'resource_alert_preview_ready'
          : 'resource_alert_preview_blocked';
      setProjectListNoticeTitle(result.status === 'would_alert' ? '项目资源告警评估预览已触发' : '项目资源告警评估预览');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertEvaluationPreviewNotice(project, result));
    } catch (error) {
      console.error('读取项目资源告警评估预览失败:', error);
      setResourceProjectError(
        `读取项目资源告警评估预览失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认评估预览未读取成功；不会启动或停止容器，不会创建或持久化告警，不会发送通知，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setPreviewingResourceAlertEvaluationProjectId(null);
    }
  };

  const createProjectResourceAlertEvent = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setPendingProjectActionConfirmation({
      kind: 'resource_alert_event_create',
      project,
      title: '确认创建资源告警事件',
      description: `确认为项目 ${projectName} 创建资源告警事件？该操作会在后端重新执行资源告警评估预览，只有当前仍会触发告警时才追加 append-only 告警事件。`,
      confirmLabel: '确认创建告警事件',
      riskLevel: 'medium',
      recovery: '取消不会重新评估资源，也不会写入告警事件；确认后若当前资源状态不再满足告警条件，后端 guard 会阻断写入。',
    });
  };

  const confirmProjectResourceAlertEventCreate = async (project: Project) => {
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCreatingResourceAlertEventProjectId(projectId);

    try {
      const result = await projectApi.createResourceAlertEvent(projectId, true);
      const noticeKind = result.event_created
        ? 'resource_alert_event_created'
        : result.status === 'unavailable'
          ? 'resource_alert_event_unavailable'
          : 'resource_alert_event_blocked';
      setProjectListNoticeTitle(result.event_created ? '项目资源告警事件已创建' : '项目资源告警事件未创建');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertEventCreateNotice(project, result));
    } catch (error) {
      console.error('创建项目资源告警事件失败:', error);
      setResourceProjectError(
        `创建项目资源告警事件失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认告警事件未创建成功；不会启动或停止容器，不会发送通知，不会执行硬配额，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setCreatingResourceAlertEventProjectId(null);
    }
  };

  const listProjectResourceAlertEvents = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setListingResourceAlertEventsProjectId(projectId);

    try {
      const result = await projectApi.listResourceAlertEvents(projectId, { limit: 20 });
      const noticeKind = result.status === 'ready'
        ? 'resource_alert_event_list_ready'
        : result.status === 'unavailable'
          ? 'resource_alert_event_list_unavailable'
          : 'resource_alert_event_list_empty';
      setProjectListNoticeTitle(result.status === 'ready' ? '项目资源告警事件列表已读取' : '项目资源告警事件列表为空或不可用');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertEventListNotice(project, result));
    } catch (error) {
      console.error('读取项目资源告警事件列表失败:', error);
      setResourceProjectError(
        `读取项目资源告警事件列表失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认告警事件列表未读取成功；不会重新评估资源，不会启动或停止容器，不会发送通知，不会执行硬配额，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setListingResourceAlertEventsProjectId(null);
    }
  };

  const checkProjectResourceAlertNotificationReadiness = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCheckingResourceAlertNotificationProjectId(projectId);

    try {
      const result = await projectApi.getResourceAlertNotificationReadiness(projectId);
      const noticeKind = result.status === 'ready'
        ? 'resource_alert_notification_ready'
        : result.status === 'empty'
          ? 'resource_alert_notification_empty'
          : result.status === 'unavailable'
            ? 'resource_alert_notification_unavailable'
            : 'resource_alert_notification_blocked';
      setProjectListNoticeTitle(result.status === 'ready' ? '项目资源告警通知通道就绪' : '项目资源告警通知通道未就绪');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertNotificationReadinessNotice(project, result));
    } catch (error) {
      console.error('读取项目资源告警通知通道 readiness 失败:', error);
      setResourceProjectError(
        `读取项目资源告警通知通道 readiness 失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认通知通道 readiness 未读取成功；不会发送通知，不会更新告警事件，不会重新评估资源，不会启动或停止容器，不会执行硬配额，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setCheckingResourceAlertNotificationProjectId(null);
    }
  };

  const sendProjectResourceAlertNotification = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setPendingProjectActionConfirmation({
      kind: 'resource_alert_notification_send',
      project,
      title: '确认发送资源告警通知',
      description: `确认向项目 ${projectName} 的资源告警 webhook 发送通知？该操作会访问已配置 webhook，并追加通知发送事件。`,
      confirmLabel: '确认发送通知',
      riskLevel: 'medium',
      recovery: '取消不会访问 webhook，也不会追加通知事件；确认后若发送失败，后端会追加 notification_failed 证据。',
    });
  };

  const confirmProjectResourceAlertNotification = async (project: Project) => {
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setSendingResourceAlertNotificationProjectId(projectId);

    try {
      const result = await projectApi.sendResourceAlertNotification(projectId, true);
      const noticeKind = result.status === 'sent'
        ? 'resource_alert_notification_sent'
        : result.status === 'failed'
          ? 'resource_alert_notification_failed'
          : result.status === 'unavailable'
            ? 'resource_alert_notification_send_unavailable'
            : 'resource_alert_notification_send_blocked';
      setProjectListNoticeTitle(result.status === 'sent' ? '项目资源告警通知已发送' : '项目资源告警通知未发送');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertNotificationSendNotice(project, result));
    } catch (error) {
      console.error('发送项目资源告警通知失败:', error);
      setResourceProjectError(
        `发送项目资源告警通知失败：${formatProjectListOperationError(error, '请稍后重试')}。当前发送结果未确认；前端不会自动重试，不会更新告警事件，不会重新评估资源，不会启动或停止容器，不会执行硬配额，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setSendingResourceAlertNotificationProjectId(null);
    }
  };

  const checkProjectResourceAlertEnforcementReadiness = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCheckingResourceAlertEnforcementProjectId(projectId);

    try {
      const result = await projectApi.getResourceAlertEnforcementReadiness(projectId);
      const noticeKind = result.status === 'ready'
        ? 'resource_alert_enforcement_ready'
        : result.status === 'disabled'
          ? 'resource_alert_enforcement_disabled'
          : result.status === 'unavailable'
            ? 'resource_alert_enforcement_unavailable'
            : 'resource_alert_enforcement_blocked';
      setProjectListNoticeTitle(result.status === 'ready' ? '项目资源告警硬配额执行前置条件就绪' : '项目资源告警硬配额执行前置条件未就绪');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertEnforcementReadinessNotice(project, result));
    } catch (error) {
      console.error('读取项目资源告警硬配额执行 readiness 失败:', error);
      setResourceProjectError(
        `读取项目资源告警硬配额执行 readiness 失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认硬配额执行前置条件未读取成功；不会执行硬配额，不会启动或停止容器，不会更新告警事件，不会重新评估资源，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setCheckingResourceAlertEnforcementProjectId(null);
    }
  };

  const executeProjectResourceAlertEnforcement = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setPendingProjectActionConfirmation({
      kind: 'resource_alert_enforcement_execute',
      project,
      title: '确认执行资源告警硬配额',
      description: `确认执行项目 ${projectName} 的资源告警硬配额 stop_container？该操作会在后端重新校验 readiness、通知证据和候选事件后停止项目容器，并追加 append-only 执行事件。`,
      confirmLabel: '确认执行 stop_container',
      riskLevel: 'high',
      recovery: '取消不会停止容器，也不会追加 enforcement_executed 事件；确认后若后端 guard 阻断，容器状态不会改变。',
    });
  };

  const confirmProjectResourceAlertEnforcement = async (project: Project) => {
    const projectId = getProjectKey(project);
    setResourceProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setExecutingResourceAlertEnforcementProjectId(projectId);

    try {
      const result = await projectApi.executeResourceAlertEnforcement(projectId, true);
      const noticeKind = result.status === 'executed'
        ? 'resource_alert_enforcement_executed'
        : result.status === 'failed'
          ? 'resource_alert_enforcement_failed'
          : 'resource_alert_enforcement_execute_blocked';
      setProjectListNoticeTitle(result.status === 'executed' ? '项目资源告警硬配额已受控执行' : '项目资源告警硬配额未执行');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectResourceAlertEnforcementExecuteNotice(project, result));
      if (result.status === 'executed') {
        const resultContainerStatus = result.stop_result !== null
          ? result.stop_result.container_status
          : 'stopped';
        setProjects((currentProjects) => getProjectListWithProjectPatch(currentProjects, projectId, {
          container_status: resultContainerStatus,
        }));
      }
    } catch (error) {
      console.error('执行项目资源告警硬配额失败:', error);
      setResourceProjectError(
        `执行项目资源告警硬配额失败：${formatProjectListOperationError(error, '请稍后重试')}。当前执行结果未确认；前端不会自动重试，不会更新告警事件，不会重新评估资源，不会修改项目文件、备份或 Git 状态。`,
      );
    } finally {
      setExecutingResourceAlertEnforcementProjectId(null);
    }
  };

  const createProjectBackup = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setPendingProjectActionConfirmation({
      kind: 'backup_create',
      project,
      title: '确认创建项目备份',
      description: `确认创建项目 ${projectName} 的本地备份？该操作会读取项目宿主目录、生成归档和 manifest，但不会启动容器或执行 Git 操作。`,
      confirmLabel: '确认创建备份',
      riskLevel: 'medium',
      recovery: '取消不会读取项目文件、不会创建归档或 manifest；确认后若后端 guard 阻断，项目代码、运行时和 Git 状态不会改变。',
    });
  };

  const confirmCreateProjectBackup = async (project: Project) => {
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setBackingUpProjectId(projectId);

    try {
      const result = await projectApi.createBackup(projectId);
      setProjectListNoticeTitle(result.status === 'created' ? '项目备份已创建' : '项目备份被阻断');
      setProjectListNoticeKind(result.status === 'created' ? 'backup_created' : 'backup_blocked');
      setProjectListNotice(formatProjectBackupNotice(project, result));
    } catch (error) {
      console.error('创建项目备份失败:', error);
      setBackupProjectError(
        `创建项目备份失败：${formatProjectListOperationError(error, '请稍后重试')}。当前备份归档和 manifest 未确认创建；项目代码、运行时和 Git 状态不会因此改变。`,
      );
    } finally {
      setBackingUpProjectId(null);
    }
  };

  const listProjectBackups = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setListingBackupsProjectId(projectId);

    try {
      const result = await projectApi.listBackups(projectId);
      setProjectListNoticeTitle(result.status === 'empty' ? '项目暂无本地备份' : '项目备份列表已读取');
      setProjectListNoticeKind(result.status === 'empty' ? 'backup_list_empty' : 'backup_list_ready');
      setProjectListNotice(formatProjectBackupListNotice(project, result));
    } catch (error) {
      console.error('读取项目备份列表失败:', error);
      setBackupProjectError(
        `读取项目备份列表失败：${formatProjectListOperationError(error, '请稍后重试')}。当前仅确认备份列表读取失败；项目代码、运行时、Git 状态和已有备份文件不会因此改变。`,
      );
    } finally {
      setListingBackupsProjectId(null);
    }
  };

  const checkProjectBackupPolicyReadiness = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCheckingBackupPolicyProjectId(projectId);

    try {
      const result = await projectApi.getBackupPolicyReadiness(projectId);
      setProjectListNoticeTitle(result.status === 'ready' ? '项目自动备份策略已就绪' : '项目自动备份策略未就绪');
      setProjectListNoticeKind(result.status === 'ready' ? 'backup_policy_ready' : 'backup_policy_blocked');
      setProjectListNotice(formatProjectBackupPolicyReadinessNotice(project, result));
    } catch (error) {
      console.error('读取项目自动备份策略失败:', error);
      setBackupProjectError(
        `读取项目自动备份策略失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认策略 readiness 未读取成功；项目代码、运行时、Git 状态和已有备份文件不会因此改变。`,
      );
    } finally {
      setCheckingBackupPolicyProjectId(null);
    }
  };

  const checkProjectBackupRemoteStorageReadiness = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCheckingBackupRemoteStorageProjectId(projectId);

    try {
      const result = await projectApi.getBackupRemoteStorageReadiness(projectId);
      const noticeKind = result.status === 'ready'
        ? 'backup_remote_ready'
        : result.status === 'empty'
          ? 'backup_remote_empty'
          : 'backup_remote_blocked';
      setProjectListNoticeTitle(result.status === 'ready' ? '项目备份远端存储已就绪' : '项目备份远端存储未就绪');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectBackupRemoteStorageReadinessNotice(project, result));
    } catch (error) {
      console.error('读取项目备份远端存储 readiness 失败:', error);
      setBackupProjectError(
        `读取项目备份远端存储 readiness 失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认远端存储 readiness 未读取成功；项目代码、运行时、Git 状态、本地备份和远端对象不会因此改变。`,
      );
    } finally {
      setCheckingBackupRemoteStorageProjectId(null);
    }
  };

  const checkProjectBackupRemoteInventory = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setCheckingBackupRemoteInventoryProjectId(projectId);

    try {
      const result = await projectApi.getBackupRemoteInventory(projectId);
      const noticeKind = result.status === 'ready'
        ? 'backup_remote_inventory_ready'
        : result.status === 'empty'
          ? 'backup_remote_inventory_empty'
          : result.status === 'failed'
            ? 'backup_remote_inventory_failed'
            : 'backup_remote_inventory_blocked';
      setProjectListNoticeTitle(result.status === 'ready' ? '项目备份远端对象清单已读取' : '项目备份远端对象清单未就绪');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectBackupRemoteInventoryNotice(project, result));
    } catch (error) {
      console.error('读取项目备份远端对象清单失败:', error);
      setBackupProjectError(
        `读取项目备份远端对象清单失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认远端归档和 manifest object key 状态；项目代码、运行时、Git 状态、本地备份和恢复链路不会因此改变。`,
      );
    } finally {
      setCheckingBackupRemoteInventoryProjectId(null);
    }
  };

  const uploadLatestProjectBackupToRemoteStorage = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setUploadingBackupRemoteStorageProjectId(projectId);

    try {
      const backups = await projectApi.listBackups(projectId);
      const latestAvailableBackup = getProjectListAvailableBackup(backups.backups);
      if (latestAvailableBackup === null) {
        const backupProjectName = getProjectListNoticeProjectName(project, backups.project_id);
        setProjectListNoticeTitle('项目备份远端上传被阻断');
        setProjectListNoticeKind('backup_remote_upload_blocked');
        setProjectListNotice(
          `项目 ${backupProjectName} 当前没有可上传的本地备份归档。${backups.recovery}`,
        );
        return;
      }

      setPendingProjectActionConfirmation({
        kind: 'backup_remote_upload',
        project,
        backupId: latestAvailableBackup.backup_id,
        title: '确认上传项目备份到远端',
        description: `确认把项目 ${projectName} 的本地备份 ${latestAvailableBackup.backup_id} 上传到远端存储？该操作会写入远端归档对象和 manifest 对象。`,
        confirmLabel: '确认上传远端备份',
        riskLevel: 'medium',
        recovery: `取消不会访问远端对象存储，也不会写远端归档或 manifest。${backups.recovery}`,
      });
    } catch (error) {
      console.error('项目备份远端上传准备失败:', error);
      setBackupProjectError(
        `项目备份远端上传准备失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认可上传本地备份；远端对象、项目代码、运行时、Git 状态和恢复链路不会因此改变。`,
      );
    } finally {
      setUploadingBackupRemoteStorageProjectId(null);
    }
  };

  const confirmUploadProjectBackupToRemoteStorage = async (project: Project, backupId: string) => {
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setUploadingBackupRemoteStorageProjectId(projectId);

    try {
      const result = await projectApi.uploadBackupToRemoteStorage(projectId, backupId);
      const noticeKind = result.status === 'uploaded'
        ? 'backup_remote_upload_completed'
        : result.status === 'failed'
          ? 'backup_remote_upload_failed'
          : 'backup_remote_upload_blocked';
      setProjectListNoticeTitle(result.status === 'uploaded' ? '项目备份已上传远端存储' : '项目备份远端上传未完成');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectBackupRemoteUploadNotice(project, result));
    } catch (error) {
      console.error('项目备份远端上传失败:', error);
      setBackupProjectError(
        `项目备份远端上传失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认远端归档和 manifest 都已上传；项目代码、运行时、Git 状态、本地备份和恢复链路不会因此改变。`,
      );
    } finally {
      setUploadingBackupRemoteStorageProjectId(null);
    }
  };

  const downloadFirstCompleteRemoteBackupToLocalCache = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setDownloadingBackupRemoteStorageProjectId(projectId);

    try {
      const inventory = await projectApi.getBackupRemoteInventory(projectId);
      const completeCandidate = getProjectListCompleteRemoteBackupCandidate(inventory.candidates);
      if (completeCandidate === null) {
        const inventoryProjectName = getProjectListNoticeProjectName(project, inventory.project_id);
        setProjectListNoticeTitle('项目备份远端下载导入被阻断');
        setProjectListNoticeKind('backup_remote_download_blocked');
        setProjectListNotice(
          `项目 ${inventoryProjectName} 当前没有可导入的远端完整备份候选：status=${inventory.status}，candidate_count=${inventory.candidate_count}，complete_count=${inventory.complete_count}。${inventory.message}。${inventory.recovery}`,
        );
        return;
      }

      setPendingProjectActionConfirmation({
        kind: 'backup_remote_download',
        project,
        backupId: completeCandidate.backup_id,
        title: '确认导入远端完整备份',
        description: `确认把项目 ${projectName} 的远端完整备份 ${completeCandidate.backup_id} 下载导入本地备份缓存？该操作会读取远端归档和 manifest，并写入本地备份缓存。`,
        confirmLabel: '确认导入远端备份',
        riskLevel: 'medium',
        recovery: `取消不会读取远端对象，也不会写入本地备份缓存。${inventory.recovery}`,
      });
    } catch (error) {
      console.error('项目备份远端下载导入准备失败:', error);
      setBackupProjectError(
        `项目备份远端下载导入准备失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认远端完整备份候选；项目代码、运行时、Git 状态和恢复链路不会因此改变。`,
      );
    } finally {
      setDownloadingBackupRemoteStorageProjectId(null);
    }
  };

  const confirmDownloadRemoteBackupToLocalCache = async (project: Project, backupId: string) => {
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setDownloadingBackupRemoteStorageProjectId(projectId);

    try {
      const result = await projectApi.downloadBackupFromRemoteStorage(projectId, backupId);
      const noticeKind = result.status === 'downloaded'
        ? 'backup_remote_download_completed'
        : result.status === 'failed'
          ? 'backup_remote_download_failed'
          : 'backup_remote_download_blocked';
      setProjectListNoticeTitle(result.status === 'downloaded' ? '项目备份远端完整候选已导入' : '项目备份远端下载导入未完成');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectBackupRemoteDownloadNotice(project, result));
    } catch (error) {
      console.error('项目备份远端下载导入失败:', error);
      setBackupProjectError(
        `项目备份远端下载导入失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认远端归档和 manifest 已通过校验并导入本地备份缓存；项目代码、运行时、Git 状态和恢复链路不会因此改变。`,
      );
    } finally {
      setDownloadingBackupRemoteStorageProjectId(null);
    }
  };

  const restoreFirstCompleteRemoteBackup = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setRestoringBackupRemoteStorageProjectId(projectId);

    try {
      const inventory = await projectApi.getBackupRemoteInventory(projectId);
      const completeCandidate = getProjectListCompleteRemoteBackupCandidate(inventory.candidates);
      const inventoryProjectName = getProjectListNoticeProjectName(project, inventory.project_id);
      if (completeCandidate === null) {
        setProjectListNoticeTitle('项目备份远端恢复被阻断');
        setProjectListNoticeKind('backup_remote_restore_blocked');
        setProjectListNotice(
          `项目 ${inventoryProjectName} 当前没有可恢复的远端完整备份候选：status=${inventory.status}，candidate_count=${inventory.candidate_count}，complete_count=${inventory.complete_count}。${inventory.message}。${inventory.recovery}`,
        );
        return;
      }

      setPendingProjectActionConfirmation({
        kind: 'backup_remote_restore',
        project,
        backupId: completeCandidate.backup_id,
        title: '确认从远端备份恢复项目',
        description: `确认从远端完整备份 ${completeCandidate.backup_id} 恢复项目 ${inventoryProjectName}？该操作会先导入本地备份缓存，再通过本地恢复 guard 写入项目目录；不会启动容器或执行 Git 操作。`,
        confirmLabel: '确认远端恢复',
        riskLevel: 'high',
        recovery: `取消不会下载远端归档、不会导入本地缓存、不会写项目目录。${inventory.recovery}`,
      });
    } catch (error) {
      console.error('项目备份远端恢复失败:', error);
      setBackupProjectError(
        `项目备份远端恢复失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认远端归档已导入、恢复预检已通过或项目目录写入已完成；请重新读取项目文件、备份列表和远端清单后再继续操作。`,
      );
    } finally {
      setRestoringBackupRemoteStorageProjectId(null);
    }
  };

  const confirmRemoteProjectBackupRestore = async (project: Project, backupId: string) => {
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setRestoringBackupRemoteStorageProjectId(projectId);

    try {
      const result = await projectApi.restoreBackupFromRemoteStorage(projectId, backupId, true);
      const noticeKind = result.status === 'restored'
        ? 'backup_remote_restore_completed'
        : result.status === 'failed'
          ? 'backup_remote_restore_failed'
          : 'backup_remote_restore_blocked';
      setProjectListNoticeTitle(result.status === 'restored' ? '项目备份远端完整候选已恢复' : '项目备份远端恢复未完成');
      setProjectListNoticeKind(noticeKind);
      setProjectListNotice(formatProjectBackupRemoteRestoreNotice(project, result));
    } catch (error) {
      console.error('项目备份远端恢复失败:', error);
      setBackupProjectError(
        `项目备份远端恢复失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认远端归档已导入、恢复预检已通过或项目目录写入已完成；请重新读取项目文件、备份列表和远端清单后再继续操作。`,
      );
    } finally {
      setRestoringBackupRemoteStorageProjectId(null);
    }
  };

  const runProjectAutomaticBackup = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    const projectName = getProjectListNoticeProjectName(project, projectId);
    setPendingProjectActionConfirmation({
      kind: 'backup_auto_run',
      project,
      title: '确认执行项目自动备份',
      description: `确认对项目 ${projectName} 执行一次自动备份策略？该操作会检查 auto_backup 和 backup_dir 策略，允许时创建 source=automatic_policy 的备份。`,
      confirmLabel: '确认执行自动备份',
      riskLevel: 'medium',
      recovery: '取消不会创建备份目录、归档或 manifest；确认后若策略关闭或目录缺失，后端会返回 blocked。',
    });
  };

  const confirmRunProjectAutomaticBackup = async (project: Project) => {
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setRunningAutomaticBackupProjectId(projectId);

    try {
      const result = await projectApi.runAutomaticBackup(projectId);
      setProjectListNoticeTitle(result.status === 'created' ? '项目自动备份已执行' : '项目自动备份被阻断');
      setProjectListNoticeKind(result.status === 'created' ? 'backup_auto_run_created' : 'backup_auto_run_blocked');
      setProjectListNotice(formatProjectAutomaticBackupRunNotice(project, result));
    } catch (error) {
      console.error('执行项目自动备份失败:', error);
      setBackupProjectError(
        `执行项目自动备份失败：${formatProjectListOperationError(error, '请稍后重试')}。当前未确认自动备份归档和 manifest 已创建；项目运行时、Git 状态、恢复和远端存储不会因此改变。`,
      );
    } finally {
      setRunningAutomaticBackupProjectId(null);
    }
  };

  const downloadLatestProjectBackup = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setDownloadingBackupProjectId(projectId);

    try {
      const backups = await projectApi.listBackups(projectId);
      const latestAvailableBackup = getProjectListAvailableBackup(backups.backups);
      if (latestAvailableBackup === null) {
        const backupProjectName = getProjectListNoticeProjectName(project, backups.project_id);
        setProjectListNoticeTitle('项目备份下载被阻断');
        setProjectListNoticeKind('backup_download_blocked');
        setProjectListNotice(
          `项目 ${backupProjectName} 当前没有可下载的本地备份归档。${backups.recovery}`,
        );
        return;
      }

      const response = await projectApi.downloadBackup(projectId, latestAvailableBackup.backup_id);
      const fileName = getProjectBackupDownloadFileName(response, latestAvailableBackup.file_name);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setProjectListNoticeTitle('项目备份下载已开始');
      setProjectListNoticeKind('backup_download_ready');
      setProjectListNotice(formatProjectBackupDownloadNotice(project, latestAvailableBackup.backup_id, response, fileName));
    } catch (error) {
      console.error('项目备份下载失败:', error);
      setBackupProjectError(
        `项目备份下载失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只确认下载未完成；项目代码、运行时、Git 状态和已有备份文件不会因此改变。`,
      );
    } finally {
      setDownloadingBackupProjectId(null);
    }
  };

  const preflightLatestProjectBackupRestore = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setPreflightingBackupProjectId(projectId);

    try {
      const backups = await projectApi.listBackups(projectId);
      const latestAvailableBackup = getProjectListAvailableBackup(backups.backups);
      if (latestAvailableBackup === null) {
        const backupProjectName = getProjectListNoticeProjectName(project, backups.project_id);
        setProjectListNoticeTitle('项目备份恢复预检被阻断');
        setProjectListNoticeKind('backup_preflight_blocked');
        setProjectListNotice(
          `项目 ${backupProjectName} 当前没有可用于恢复预检的本地备份归档。${backups.recovery}`,
        );
        return;
      }

      const result = await projectApi.preflightBackupRestore(projectId, latestAvailableBackup.backup_id);
      setProjectListNoticeTitle(result.status === 'ready' ? '项目备份恢复预检通过' : '项目备份恢复预检被阻断');
      setProjectListNoticeKind(result.status === 'ready' ? 'backup_preflight_ready' : 'backup_preflight_blocked');
      setProjectListNotice(formatProjectBackupRestorePreflightNotice(project, result));
    } catch (error) {
      console.error('项目备份恢复预检失败:', error);
      setBackupProjectError(
        `项目备份恢复预检失败：${formatProjectListOperationError(error, '请稍后重试')}。当前只读预检结果未确认；项目代码、备份归档、运行时和 Git 状态不会因此改变。`,
      );
    } finally {
      setPreflightingBackupProjectId(null);
    }
  };

  const restoreLatestProjectBackup = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setRestoringBackupProjectId(projectId);

    try {
      const backups = await projectApi.listBackups(projectId);
      const latestAvailableBackup = getProjectListAvailableBackup(backups.backups);
      if (latestAvailableBackup === null) {
        const backupProjectName = getProjectListNoticeProjectName(project, backups.project_id);
        setProjectListNoticeTitle('项目备份恢复被阻断');
        setProjectListNoticeKind('backup_restore_blocked');
        setProjectListNotice(
          `项目 ${backupProjectName} 当前没有可恢复的本地备份归档。${backups.recovery}`,
        );
        return;
      }

      const preflight = await projectApi.preflightBackupRestore(projectId, latestAvailableBackup.backup_id);
      const canRestoreBackup = preflight.status === 'ready' && preflight.can_restore === true;
      if (canRestoreBackup === false) {
        setProjectListNoticeTitle('项目备份恢复被阻断');
        setProjectListNoticeKind('backup_restore_blocked');
        setProjectListNotice(formatProjectBackupRestorePreflightNotice(project, preflight));
        return;
      }

      setPendingProjectActionConfirmation({
        kind: 'backup_restore',
        project,
        backupId: preflight.backup_id,
        title: '确认从本地备份恢复项目',
        description: `确认从本地备份 ${preflight.backup_id} 恢复项目 ${getProjectListNoticeProjectName(project, preflight.project_id)}？该操作会把归档内容写入项目目录，但不会启动容器或执行 Git 操作。`,
        confirmLabel: '确认本地恢复',
        riskLevel: 'high',
        recovery: `取消不会写项目目录，也不会改变运行时或 Git 状态。${preflight.recovery}`,
      });
    } catch (error) {
      console.error('项目备份恢复失败:', error);
      setBackupProjectError(
        `项目备份恢复失败：${formatProjectListOperationError(error, '请稍后重试')}。当前恢复写入结果未确认；请重新读取备份列表和项目文件后再继续操作。`,
      );
    } finally {
      setRestoringBackupProjectId(null);
    }
  };

  const confirmLocalProjectBackupRestore = async (project: Project, backupId: string) => {
    const projectId = getProjectKey(project);
    setBackupProjectError(null);
    setProjectListNotice(null);
    setProjectListNoticeTitle(null);
    setProjectListNoticeKind(null);
    setRestoringBackupProjectId(projectId);

    try {
      const result = await projectApi.restoreBackup(projectId, backupId, true);
      setProjectListNoticeTitle(result.status === 'restored' ? '项目备份已恢复' : '项目备份恢复被阻断');
      setProjectListNoticeKind(result.status === 'restored' ? 'backup_restore_completed' : 'backup_restore_blocked');
      setProjectListNotice(formatProjectBackupRestoreNotice(project, result));
    } catch (error) {
      console.error('项目备份恢复失败:', error);
      setBackupProjectError(
        `项目备份恢复失败：${formatProjectListOperationError(error, '请稍后重试')}。当前恢复写入结果未确认；请重新读取备份列表和项目文件后再继续操作。`,
      );
    } finally {
      setRestoringBackupProjectId(null);
    }
  };

  const handleConfirmProjectAction = async () => {
    const confirmation = getProjectListConfirmableAction(
      pendingProjectActionConfirmation,
      projectActionConfirmationSnapshot.canConfirm,
    );
    if (confirmation === null) {
      return;
    }

    const confirmationBackupId = getProjectActionConfirmationDialogNullableValue(confirmation.backupId);
    setIsConfirmingProjectAction(true);
    try {
      if (confirmation.kind === 'runtime_stop') {
        await confirmStopProjectRuntime(confirmation.project);
        return;
      }
      if (confirmation.kind === 'delete_restore') {
        await restoreDeletedProject();
        return;
      }
      if (confirmation.kind === 'resource_alert_event_create') {
        await confirmProjectResourceAlertEventCreate(confirmation.project);
        return;
      }
      if (confirmation.kind === 'resource_alert_notification_send') {
        await confirmProjectResourceAlertNotification(confirmation.project);
        return;
      }
      if (confirmation.kind === 'resource_alert_enforcement_execute') {
        await confirmProjectResourceAlertEnforcement(confirmation.project);
        return;
      }
      if (confirmation.kind === 'backup_create') {
        await confirmCreateProjectBackup(confirmation.project);
        return;
      }
      if (confirmation.kind === 'backup_auto_run') {
        await confirmRunProjectAutomaticBackup(confirmation.project);
        return;
      }
      if (confirmation.kind === 'backup_remote_upload' && confirmationBackupId !== null) {
        await confirmUploadProjectBackupToRemoteStorage(confirmation.project, confirmationBackupId);
        return;
      }
      if (confirmation.kind === 'backup_remote_download' && confirmationBackupId !== null) {
        await confirmDownloadRemoteBackupToLocalCache(confirmation.project, confirmationBackupId);
        return;
      }
      if (confirmation.kind === 'backup_restore' && confirmationBackupId !== null) {
        await confirmLocalProjectBackupRestore(confirmation.project, confirmationBackupId);
        return;
      }
      if (confirmation.kind === 'backup_remote_restore' && confirmationBackupId !== null) {
        await confirmRemoteProjectBackupRestore(confirmation.project, confirmationBackupId);
        return;
      }

      setProjectListNoticeTitle('项目受控操作被阻断');
      setProjectListNoticeKind(getProjectListBlockedActionNoticeKind(confirmation.kind));
      setProjectListNotice(
        `项目 ${getProjectListWorkspaceSnapshotProjectName(confirmation.project, confirmation.project.project_id)} 的受控操作未执行：确认上下文缺少必要项目或备份标识。请重新触发该操作。`,
      );
    } finally {
      setIsConfirmingProjectAction(false);
      setPendingProjectActionConfirmation(null);
    }
  };

  const startEditProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProjectError(null);
    setEditSaveConfirmationOpen(false);
    setEditingProject(project);
    setEditForm({
      name: getProjectListWorkspaceSnapshotValue(project.name, ''),
      description: getProjectListWorkspaceSnapshotValue(project.description, ''),
      app_type: getProjectListWorkspaceSnapshotValue(project.app_type, 'web'),
    });
  };

  const handleEditSubmit = async () => {
    const projectToEdit = getProjectListConfirmableDialogProject(
      editingProject,
      editSaveConfirmationSnapshot.canConfirm,
    );
    if (projectToEdit === null) {
      return;
    }

    const projectId = getProjectKey(projectToEdit);
    if (editForm.name.trim().length === 0) {
      return;
    }

    setIsSaving(true);
    setEditProjectError(null);
    try {
      const updatedProject = await projectApi.update(projectId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        app_type: editForm.app_type,
      });

      setProjects((prev) => getProjectListWithProjectPatch(prev, projectId, updatedProject));
      setEditSaveConfirmationOpen(false);
      setEditingProject(null);
    } catch (error) {
      console.error('更新项目失败:', error);
      setEditProjectError(
        `更新项目失败：${formatProjectListOperationError(error, '请稍后重试')}。当前列表仍保留修改前的项目名称、描述和应用类型；请修复后重新保存或刷新列表确认。`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openEditSaveConfirmation = () => {
    setEditProjectError(null);
    setEditSaveConfirmationOpen(true);
  };

  // 获取容器状态标签。项目生命周期 status 已不再作为列表展示字段。
  const getContainerStatusBadge = (containerStatus?: string): ProjectListContainerStatusBadgeProfile => {
    if (containerStatus === 'running') {
      return { label: '运行中', color: 'bg-green-500/10 text-green-600 border-green-500/20' };
    }
    const isStoppedStatus = isProjectListValueInList(containerStatus, PROJECT_LIST_STOPPED_CONTAINER_STATUSES);
    if (isStoppedStatus === true) {
      return { label: '已停止', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
    }
    const isStartingStatus = isProjectListValueInList(containerStatus, PROJECT_LIST_STARTING_CONTAINER_STATUSES);
    if (isStartingStatus === true) {
      return { label: '启动中', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
    }
    if (containerStatus === 'missing') {
      return { label: '容器不存在', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
    }
    const isErrorStatus = isProjectListValueInList(containerStatus, PROJECT_LIST_ERROR_CONTAINER_STATUSES);
    if (isErrorStatus === true) {
      return { label: '异常', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
    }
    return { label: '未启动', color: 'bg-muted text-muted-foreground border-muted' };
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const materializeProjectListCardNodes = (): ProjectListProjectCardNodeList => {
    const nodes: ProjectListProjectCardNodeList = [];

    for (const project of projects) {
      const projectId = getProjectKey(project);
      const deletionRecovery = getProjectDeletionRecovery(project);
      const projectAppType = getProjectListWorkspaceSnapshotValue(project.app_type, 'web');
      const appTypeBadge = getProjectAppTypeBadge(projectAppType);
      const projectDescriptionLabel = getProjectListCardDescriptionLabel(project);
      const projectTimestampFallback = new Date().toISOString();
      const projectCreatedAt = getProjectListCardTimestampValue(project.created_at, projectTimestampFallback);
      const projectUpdatedAt = getProjectListCardTimestampValue(project.updated_at, projectTimestampFallback);
      const projectCardSnapshot = buildProjectCardSnapshot({
        project,
        projectId,
        isHovered: hoveredProject === projectId,
        isStopping: stoppingProjectId === projectId,
        canStopRuntime: canStopProjectRuntime(project),
        deletionRecovery,
      });
      const canWriteProject = project.can_write !== false;
      const canManageProject = project.can_manage_members !== false;
      const projectActionBusy = isProjectListProjectActionBusy(projectId, {
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
        pendingProjectActionProjectId,
      });

      nodes.push(
        <Card
          key={projectId}
          className={cn(
            "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-muted",
            hoveredProject === projectId && "ring-2 ring-primary"
          )}
          onClick={() => openProject(project)}
          onMouseEnter={() => setHoveredProject(projectId)}
          onMouseLeave={() => setHoveredProject(null)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {projectDescriptionLabel}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => startEditProject(project, e)}
                disabled={projectActionBusy || canManageProject === false}
                aria-label="编辑项目"
                title="编辑"
              >
                <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
              </Button>
              <div className="hidden">
              <span
                role="status"
                aria-live="polite"
                className="inline-flex"
                data-testid="project-card-resource-observe"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(event) => checkProjectResourceSnapshot(project, event)}
                  disabled={projectActionBusy}
                  aria-label="查看项目资源快照"
                >
                  {checkingResourceSnapshotProjectId === projectId ? (
                    <Spinner className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Activity className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  )}
                </Button>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => checkProjectResourceAlertReadiness(project, event)}
                disabled={projectActionBusy}
                aria-label="查看项目资源告警 readiness"
                data-testid="project-card-resource-alert-readiness"
              >
                {checkingResourceAlertReadinessProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => checkProjectResourceAlertNotificationReadiness(project, event)}
                disabled={projectActionBusy}
                aria-label="查看项目资源告警通知通道 readiness"
                data-testid="project-card-resource-alert-notification-readiness"
              >
                {checkingResourceAlertNotificationProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Send className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => sendProjectResourceAlertNotification(project, event)}
                disabled={projectActionBusy}
                aria-label="发送项目资源告警通知"
                data-testid="project-card-resource-alert-notification-send"
              >
                {sendingResourceAlertNotificationProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Send className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => checkProjectResourceAlertEnforcementReadiness(project, event)}
                disabled={projectActionBusy}
                aria-label="查看项目资源告警硬配额执行 readiness"
                data-testid="project-card-resource-alert-enforcement-readiness"
              >
                {checkingResourceAlertEnforcementProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => executeProjectResourceAlertEnforcement(project, event)}
                disabled={projectActionBusy}
                aria-label="执行项目资源告警硬配额 stop_container"
                data-testid="project-card-resource-alert-enforcement-execute"
              >
                {executingResourceAlertEnforcementProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => previewProjectResourceAlertEvaluation(project, event)}
                disabled={projectActionBusy}
                aria-label="预览项目资源告警评估"
                data-testid="project-card-resource-alert-evaluation-preview"
              >
                {previewingResourceAlertEvaluationProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <BellRing className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => createProjectResourceAlertEvent(project, event)}
                disabled={projectActionBusy}
                aria-label="创建项目资源告警事件"
                data-testid="project-card-resource-alert-event-create"
              >
                {creatingResourceAlertEventProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <BellPlus className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => listProjectResourceAlertEvents(project, event)}
                disabled={projectActionBusy}
                aria-label="查看项目资源告警事件"
                data-testid="project-card-resource-alert-events"
              >
                {listingResourceAlertEventsProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <History className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => createProjectBackup(project, event)}
                disabled={projectActionBusy}
                aria-label="创建项目备份"
                data-testid="project-card-create-backup"
              >
                {backingUpProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Archive className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => listProjectBackups(project, event)}
                disabled={projectActionBusy}
                aria-label="查看项目备份列表"
                data-testid="project-card-list-backups"
              >
                {listingBackupsProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <History className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => checkProjectBackupPolicyReadiness(project, event)}
                disabled={projectActionBusy}
                aria-label="检查自动备份策略"
                data-testid="project-card-backup-policy-readiness"
              >
                {checkingBackupPolicyProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Calendar className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => checkProjectBackupRemoteStorageReadiness(project, event)}
                disabled={projectActionBusy}
                aria-label="检查备份远端存储"
                data-testid="project-card-backup-remote-storage-readiness"
              >
                {checkingBackupRemoteStorageProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Cloud className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => checkProjectBackupRemoteInventory(project, event)}
                disabled={projectActionBusy}
                aria-label="查看备份远端对象清单"
                data-testid="project-card-backup-remote-inventory"
              >
                {checkingBackupRemoteInventoryProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Layers className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => runProjectAutomaticBackup(project, event)}
                disabled={projectActionBusy}
                aria-label="执行自动备份策略"
                data-testid="project-card-run-automatic-backup"
              >
                {runningAutomaticBackupProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Repeat className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => uploadLatestProjectBackupToRemoteStorage(project, event)}
                disabled={projectActionBusy}
                aria-label="上传最近项目备份到远端存储"
                data-testid="project-card-upload-backup-remote-storage"
              >
                {uploadingBackupRemoteStorageProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Upload className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => downloadFirstCompleteRemoteBackupToLocalCache(project, event)}
                disabled={projectActionBusy}
                aria-label="导入远端完整备份到本地缓存"
                data-testid="project-card-download-backup-remote-storage"
              >
                {downloadingBackupRemoteStorageProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Download className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => restoreFirstCompleteRemoteBackup(project, event)}
                disabled={projectActionBusy}
                aria-label="从远端完整备份受控恢复"
                data-testid="project-card-restore-backup-remote-storage"
              >
                {restoringBackupRemoteStorageProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => downloadLatestProjectBackup(project, event)}
                disabled={projectActionBusy}
                aria-label="下载最近项目备份"
                data-testid="project-card-download-backup"
              >
                {downloadingBackupProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Download className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => preflightLatestProjectBackupRestore(project, event)}
                disabled={projectActionBusy}
                aria-label="预检最近项目备份恢复"
                data-testid="project-card-preflight-backup-restore"
              >
                {preflightingBackupProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => restoreLatestProjectBackup(project, event)}
                disabled={projectActionBusy}
                aria-label="恢复最近项目备份"
                data-testid="project-card-restore-backup"
              >
                {restoringBackupProjectId === projectId ? (
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </Button>
              </div>
              {canStopProjectRuntime(project) ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 text-amber-600 transition-opacity hover:bg-amber-500/10 hover:text-amber-700 group-hover:opacity-100"
                  onClick={(event) => requestStopProjectRuntime(project, event)}
                  disabled={projectActionBusy || canWriteProject === false}
                  aria-label="停止项目运行时"
                  title="停止"
                >
                  {stoppingProjectId === projectId ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 text-destructive transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                onClick={(e) => deleteProject(project, e)}
                disabled={projectActionBusy || canManageProject === false}
                aria-label="删除项目"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                    disabled={projectActionBusy}
                    aria-label="更多项目操作"
                    title="更多"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  sideOffset={8}
                  avoidCollisions={false}
                  className="w-64"
                  onClick={(event) => event.stopPropagation()}
                >
                  <DropdownMenuItem asChild><Link href={`/projects/${encodeURIComponent(projectId)}/collaboration`}>项目成员与权限</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => checkProjectResourceSnapshot(project, event)} disabled={projectActionBusy}>查看资源快照</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => checkProjectResourceAlertReadiness(project, event)} disabled={projectActionBusy}>资源告警 readiness</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => checkProjectResourceAlertNotificationReadiness(project, event)} disabled={projectActionBusy}>告警通知 readiness</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => sendProjectResourceAlertNotification(project, event)} disabled={projectActionBusy}>发送资源告警通知</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => checkProjectResourceAlertEnforcementReadiness(project, event)} disabled={projectActionBusy}>硬配额执行 readiness</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => executeProjectResourceAlertEnforcement(project, event)} disabled={projectActionBusy}>执行硬配额 stop_container</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => previewProjectResourceAlertEvaluation(project, event)} disabled={projectActionBusy}>预览资源告警评估</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => createProjectResourceAlertEvent(project, event)} disabled={projectActionBusy}>创建资源告警事件</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => listProjectResourceAlertEvents(project, event)} disabled={projectActionBusy}>查看资源告警事件</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => createProjectBackup(project, event)} disabled={projectActionBusy}>创建项目备份</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => listProjectBackups(project, event)} disabled={projectActionBusy}>查看项目备份</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => checkProjectBackupPolicyReadiness(project, event)} disabled={projectActionBusy}>自动备份策略</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => checkProjectBackupRemoteStorageReadiness(project, event)} disabled={projectActionBusy}>备份远端存储</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => checkProjectBackupRemoteInventory(project, event)} disabled={projectActionBusy}>远端备份对象清单</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => runProjectAutomaticBackup(project, event)} disabled={projectActionBusy}>执行自动备份</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => uploadLatestProjectBackupToRemoteStorage(project, event)} disabled={projectActionBusy}>上传最近备份到远端</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => downloadFirstCompleteRemoteBackupToLocalCache(project, event)} disabled={projectActionBusy}>导入远端完整备份</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => restoreFirstCompleteRemoteBackup(project, event)} disabled={projectActionBusy}>从远端完整备份恢复</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => downloadLatestProjectBackup(project, event)} disabled={projectActionBusy}>下载最近项目备份</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => preflightLatestProjectBackupRestore(project, event)} disabled={projectActionBusy}>预检最近备份恢复</DropdownMenuItem>
                  <DropdownMenuItem onClick={(event) => restoreLatestProjectBackup(project, event)} disabled={projectActionBusy}>恢复最近项目备份</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn("text-xs", appTypeBadge.color)}>
                {appTypeBadge.label}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", getContainerStatusBadge(project.container_status).color)}>
                {getContainerStatusBadge(project.container_status).label}
              </Badge>
              {materializeProjectListTechStackBadgeNodes(project.tech_stack)}
            </div>
            <div className="app-debug-only">
              <ProjectCardSnapshotStrip snapshot={projectCardSnapshot} />
              {deletionRecovery ? (
                <div role="status" className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  项目曾因删除后台清理失败被系统恢复。原因：{deletionRecovery.reason}；清理范围：{projectCardSnapshot.cleanupScope}；请确认关联资源状态后再重试删除。
                </div>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="pt-0 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
              <span>创建于 {formatDate(projectCreatedAt)}</span>
              <span>更新于 {formatDate(projectUpdatedAt)}</span>
            </div>
          </CardFooter>
        </Card>,
      );
    }

    return nodes;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* 顶部导航 */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack} aria-label="返回上一页">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Link href="/" className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">YiStack</h1>
                <p className="text-xs text-muted-foreground">我的项目</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="gap-2"><Link href="/templates"><Layers className="h-4 w-4" />官方模板</Link></Button>
            <Button onClick={() => router.push('/')} className="gap-2"><Plus className="w-4 h-4" />新建项目</Button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <WorkspaceEntryNavigationSnapshotStrip snapshot={entryNavigationSnapshot} />
        </div>
        <ProjectListPageSnapshotStrip snapshot={projectListPageSnapshot} />

        {projectListError ? (
          <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="font-medium">项目列表同步失败</div>
            <div className="mt-1 text-destructive/90">{projectListError}</div>
            <div
              data-testid="project-list-sync-failure-diagnostics"
              className="mt-3 rounded-md border border-destructive/20 bg-background/80 px-3 py-2 text-xs text-destructive/90"
            >
              <div className="space-y-2">
                <div>
                  <div className="font-medium">主因：{projectListSyncFailureDiagnosis.summary}</div>
                  <p className="mt-1">下一步：{projectListSyncFailureDiagnosis.nextAction}</p>
                </div>
                <div
                  data-testid="project-list-sync-failure-action-readiness"
                  className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground"
                >
                  <span>Status: {projectListSyncFailureDiagnosis.status}</span>
                  <span>Action: {projectListSyncFailureDiagnosis.action}</span>
                  <span>Retry: {projectListSyncFailureRetryLabel}</span>
                  <span>Login: {projectListSyncFailureLoginLabel}</span>
                </div>
                <details className="rounded border border-destructive/10 bg-muted/30 px-2 py-1">
                  <summary className="cursor-pointer font-medium">技术证据</summary>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <span>ApiHealth: {projectListPageSnapshot.apiHealthStatus}</span>
                    <span>Reason: {projectListPageSnapshot.apiHealthReasonCode}</span>
                    <span>BackendHealth: {projectListPageSnapshot.backendHealthStatus}</span>
                    <span>BackendReason: {projectListPageSnapshot.backendHealthReasonCode}</span>
                    <span>AuthRecovery: {projectListPageSnapshot.authRecoveryStatus}</span>
                  </div>
                  <p className="mt-1 truncate">API 细节：{projectListApiHealthDetailsLabel}</p>
                  <p className="mt-1 truncate">鉴权恢复：{projectListAuthRecoveryDetailsLabel}</p>
                  <p className="mt-1">诊断证据：{projectListSyncFailureDiagnosis.evidence}</p>
                </details>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 border-destructive/30 bg-background"
              onClick={() => {
                setProjectListError(null);
                setProjectListApiFailure(null);
                setProjectListReloadToken((prev) => prev + 1);
                setIsLoading(true);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              重新加载项目列表
            </Button>
            {projectListSyncFailureDiagnosis.canLoginRecovery === true ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2 mt-3 border-destructive/30 bg-background"
                data-testid="project-list-auth-recovery-login"
                onClick={() => router.push('/auth?redirect=/projects')}
              >
                <LogIn className="h-4 w-4" />
                重新登录后返回项目列表
              </Button>
            ) : null}
          </div>
        ) : null}

        {projectListNotice ? (
          <div role="status" className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <div className="font-medium">{projectListNoticeTitleLabel}</div>
            <div className="mt-1">{projectListNotice}</div>
            {recoverableDeletedProject ? (
              <span className="app-debug-only">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-amber-500/30 bg-background"
                data-testid="project-list-restore-deleted-project"
                onClick={openRestoreDeletedProjectConfirmation}
                disabled={restoringDeletedProjectId === getProjectKey(recoverableDeletedProject.project)}
              >
                {restoringDeletedProjectId === getProjectKey(recoverableDeletedProject.project) ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {restoringDeletedProjectId === getProjectKey(recoverableDeletedProject.project)
                  ? '恢复项目中'
                  : `在 ${recoverableDeletedProject.restoreWindowSeconds} 秒窗口内恢复项目`}
              </Button>
              </span>
            ) : null}
          </div>
        ) : null}

        {stopProjectError ? (
          <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="font-medium">项目运行时停止失败</div>
            <div className="mt-1 text-destructive/90">{stopProjectError}</div>
          </div>
        ) : null}

        {resourceProjectError ? (
          <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="font-medium">项目资源快照读取失败</div>
            <div className="mt-1 text-destructive/90">{resourceProjectError}</div>
          </div>
        ) : null}

        {backupProjectError ? (
          <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="font-medium">项目备份失败</div>
            <div className="mt-1 text-destructive/90">{backupProjectError}</div>
          </div>
        ) : null}

        {shouldShowProjectListLoadingPanel === true ? (
          <div className="flex items-center justify-center h-64">
            <Spinner className="w-8 h-8" />
          </div>
        ) : isAuthenticated === false ? (
          /* 未登录状态 */
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <LogIn className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">登录后查看项目</h2>
            <p className="text-muted-foreground mb-4">登录后可管理你的项目，跟踪生成进度</p>
            <Button
              data-testid="project-list-auth-recovery-login"
              onClick={() => router.push('/auth?redirect=/projects')}
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              登录
            </Button>
          </div>
        ) : hasProjects === false ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Folder className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">暂无项目</h2>
            <p className="text-muted-foreground mb-4">创建你的第一个项目，开始 AI 生成之旅</p>
            <Button onClick={() => router.push('/')} className="gap-2">
              <Plus className="w-4 h-4" />
              创建项目
            </Button>
          </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materializeProjectListCardNodes()}
          </div>
        )}
      </main>

      <Dialog
        open={editingProject !== null}
        onOpenChange={(open) => {
          if (open === false && isSaving === false) {
            setEditSaveConfirmationOpen(false);
            setEditingProject(null);
            setEditProjectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
            <DialogDescription>更新项目名称、描述和应用类型。</DialogDescription>
          </DialogHeader>
          <ProjectMutationDialogSnapshotStrip snapshot={editDialogSnapshot} />

          {editProjectError ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {editProjectError}
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">项目名称</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="请输入项目名称"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">项目描述</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="请输入项目描述"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">应用类型</label>
              <select
                value={editForm.app_type}
                onChange={(e) => setEditForm((prev) => ({ ...prev, app_type: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="web">网页应用</option>
                <option value="mobile">移动应用</option>
                <option value="miniprogram">小程序</option>
                <option value="desktop">桌面应用</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditSaveConfirmationOpen(false);
                setEditingProject(null);
                setEditProjectError(null);
              }}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button onClick={openEditSaveConfirmation} disabled={editDialogSnapshot.canSubmit === false}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editSaveConfirmationOpen}
        onOpenChange={(open) => {
          if (open === false && editSaveConfirmationSnapshot.canCancel === true) {
            setEditSaveConfirmationOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认保存项目修改</DialogTitle>
            <DialogDescription>
              {editingProject !== null
                ? `确定要保存项目“${getProjectListWorkspaceSnapshotProjectName(editingProject, getProjectKey(editingProject))}”的元数据修改吗？`
                : '确定要保存当前项目修改吗？'}
            </DialogDescription>
          </DialogHeader>
          <ProjectEditSaveConfirmationSnapshotStrip snapshot={editSaveConfirmationSnapshot} />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSaveConfirmationOpen(false)}
              disabled={editSaveConfirmationSnapshot.canCancel === false}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (editSaveConfirmationSnapshot.canConfirm === true) {
                  void handleEditSubmit();
                }
              }}
              disabled={editSaveConfirmationSnapshot.canConfirm === false}
            >
              {isSaving ? '保存中...' : '确认保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingProject !== null}
        onOpenChange={(open) => {
          if (open === false && isDeleting === false) {
            setDeletingProject(null);
            setDeleteProjectError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除项目</DialogTitle>
            <DialogDescription>
              删除后项目记录会立即移出列表，聊天记录、代码目录、项目文档、Git 历史和容器等关联资源会在后台继续清理，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <ProjectMutationDialogSnapshotStrip snapshot={deleteDialogSnapshot} />

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            项目：{deletingProject !== null
              ? getProjectListWorkspaceSnapshotProjectName(deletingProject, '未命名项目')
              : '未命名项目'}
          </div>

          {deleteProjectError ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {deleteProjectError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeletingProject(null);
                setDeleteProjectError(null);
              }}
              disabled={deleteDialogSnapshot.canCancel === false}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialogSnapshot.canSubmit === true) {
                  void handleDeleteProject();
                }
              }}
              disabled={deleteDialogSnapshot.canSubmit === false}
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingProjectActionConfirmation !== null}
        onOpenChange={(open) => {
          if (open === false && isConfirmingProjectAction === false) {
            setPendingProjectActionConfirmation(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingProjectActionTitle}</DialogTitle>
            <DialogDescription>
              {pendingProjectActionDescription}
            </DialogDescription>
          </DialogHeader>
          <ProjectActionConfirmationDialogSnapshotStrip snapshot={projectActionConfirmationSnapshot} />

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <div>项目：{pendingProjectActionProjectLabel}</div>
            <div>操作：{pendingProjectActionKindLabel}</div>
            {shouldRenderPendingProjectActionBackupId === true && pendingProjectActionBackupId !== null ? (
              <div>备份：{pendingProjectActionBackupId}</div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingProjectActionConfirmation(null)}
              disabled={projectActionConfirmationSnapshot.canCancel === false}
            >
              取消
            </Button>
            <Button
              variant={projectActionConfirmationSnapshot.riskLevel === 'high' ? 'destructive' : 'default'}
              onClick={() => {
                if (projectActionConfirmationSnapshot.canConfirm === true) {
                  void handleConfirmProjectAction();
                }
              }}
              disabled={projectActionConfirmationSnapshot.canConfirm === false}
            >
              {pendingProjectActionConfirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
