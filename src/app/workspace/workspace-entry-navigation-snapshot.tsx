import { cn } from '@/lib/utils';

import type {
  WorkspaceEntryNavigationSnapshot,
  WorkspaceEntryNavigationSnapshotSource,
  WorkspaceEntryNavigationSnapshotStatus,
  WorkspaceEntryNavigationSurface,
} from './workspace-types';

type WorkspaceEntryNavigationBooleanFactList = readonly boolean[];
type WorkspaceEntryNavigationSnapshotStatusList = readonly WorkspaceEntryNavigationSnapshotStatus[];

const WORKSPACE_ENTRY_NAVIGATION_AUTH_STATUSES: WorkspaceEntryNavigationSnapshotStatusList = [
  'auth_loading',
  'unauthenticated',
];

const WORKSPACE_ENTRY_NAVIGATION_HOME_DRAFT_STATUSES: WorkspaceEntryNavigationSnapshotStatusList = [
  'draft_restoring',
  'draft_persistence_failed',
];

const WORKSPACE_ENTRY_NAVIGATION_WARNING_STATUSES: WorkspaceEntryNavigationSnapshotStatusList = [
  'unauthenticated',
  'draft_restoring',
  'draft_persistence_failed',
  'project_create_failed',
  'project_list_failed',
];

const WORKSPACE_ENTRY_NAVIGATION_LOADING_STATUSES: WorkspaceEntryNavigationSnapshotStatusList = [
  'auth_loading',
  'creating_project',
  'project_list_loading',
];

function hasWorkspaceEntryNavigationTrueFact(values: WorkspaceEntryNavigationBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function isWorkspaceEntryNavigationStatusIn(
  status: WorkspaceEntryNavigationSnapshotStatus,
  statuses: WorkspaceEntryNavigationSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceEntryNavigationTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasWorkspaceEntryNavigationProjectCount(projectCount: number): boolean {
  if (projectCount === 0) {
    return false;
  }

  return projectCount > 0;
}

function hasWorkspaceEntryNavigationLocalPersistenceIssue(
  hasDraftRestoreIssue: boolean,
  hasDraftPersistenceIssue: boolean,
): boolean {
  return hasWorkspaceEntryNavigationTrueFact([hasDraftRestoreIssue, hasDraftPersistenceIssue]);
}

function canMarkWorkspaceEntryPendingNavigation({
  canPrepareWorkspaceSnapshot,
  isHomeSurface,
  hasTargetProject,
  hasProjects,
}: {
  canPrepareWorkspaceSnapshot: boolean;
  isHomeSurface: boolean;
  hasTargetProject: boolean;
  hasProjects: boolean;
}): boolean {
  if (canPrepareWorkspaceSnapshot === false) {
    return false;
  }

  return hasWorkspaceEntryNavigationTrueFact([isHomeSurface, hasTargetProject, hasProjects]);
}

function canNavigateWorkspaceEntry({
  canMarkPendingNavigation,
  isHomeSurface,
  isBusy,
  hasTargetProject,
  hasProjects,
}: {
  canMarkPendingNavigation: boolean;
  isHomeSurface: boolean;
  isBusy: boolean;
  hasTargetProject: boolean;
  hasProjects: boolean;
}): boolean {
  if (canMarkPendingNavigation === false) {
    return false;
  }

  if (isHomeSurface === true) {
    return isBusy === false;
  }

  return hasWorkspaceEntryNavigationTrueFact([hasTargetProject, hasProjects]);
}

function getWorkspaceEntryNavigationSnapshotStatus({
  authLoading,
  isAuthenticated,
  hasDraftRestoreIssue,
  hasDraftPersistenceIssue,
  hasCreateError,
  isHomeSurface,
  isBusy,
  hasProjectListError,
  hasProjects,
}: {
  authLoading: boolean;
  isAuthenticated: boolean;
  hasDraftRestoreIssue: boolean;
  hasDraftPersistenceIssue: boolean;
  hasCreateError: boolean;
  isHomeSurface: boolean;
  isBusy: boolean;
  hasProjectListError: boolean;
  hasProjects: boolean;
}): WorkspaceEntryNavigationSnapshotStatus {
  if (authLoading === true) {
    return 'auth_loading';
  }

  if (isAuthenticated === false) {
    return 'unauthenticated';
  }

  if (hasDraftRestoreIssue === true) {
    return 'draft_restoring';
  }

  if (hasDraftPersistenceIssue === true) {
    return 'draft_persistence_failed';
  }

  if (hasCreateError === true) {
    return 'project_create_failed';
  }

  if (isHomeSurface === true && isBusy === true) {
    return 'creating_project';
  }

  if (isHomeSurface === true) {
    return 'ready_to_create';
  }

  if (hasProjectListError === true) {
    return 'project_list_failed';
  }

  if (isBusy === true) {
    return 'project_list_loading';
  }

  if (hasProjects === false) {
    return 'project_list_empty';
  }

  return 'project_list_ready';
}

function getWorkspaceEntryNavigationSnapshotSource({
  status,
  isHomeSurface,
}: {
  status: WorkspaceEntryNavigationSnapshotStatus;
  isHomeSurface: boolean;
}): WorkspaceEntryNavigationSnapshotSource {
  const hasAuthStatus = isWorkspaceEntryNavigationStatusIn(status, WORKSPACE_ENTRY_NAVIGATION_AUTH_STATUSES);
  if (hasAuthStatus === true) {
    return 'auth';
  }

  const hasHomeDraftStatus = isWorkspaceEntryNavigationStatusIn(status, WORKSPACE_ENTRY_NAVIGATION_HOME_DRAFT_STATUSES);
  if (hasHomeDraftStatus === true) {
    return 'home_draft';
  }

  if (isHomeSurface === true) {
    return 'home_create';
  }

  return 'project_list';
}

export function buildWorkspaceEntryNavigationSnapshot({
  surface,
  isAuthenticated,
  authLoading,
  isBusy,
  hasDraftRestoreIssue = false,
  hasDraftPersistenceIssue = false,
  hasCreateError = false,
  hasProjectListError = false,
  projectCount = 0,
  hasTargetProject = false,
  targetProjectId = null,
}: {
  surface: WorkspaceEntryNavigationSurface;
  isAuthenticated: boolean;
  authLoading: boolean;
  isBusy: boolean;
  hasDraftRestoreIssue?: boolean;
  hasDraftPersistenceIssue?: boolean;
  hasCreateError?: boolean;
  hasProjectListError?: boolean;
  projectCount?: number;
  hasTargetProject?: boolean;
  targetProjectId?: string | null;
}): WorkspaceEntryNavigationSnapshot {
  const isHomeSurface = surface === 'home';
  const hasProjects = hasWorkspaceEntryNavigationProjectCount(projectCount);
  const hasLocalPersistenceIssue = hasWorkspaceEntryNavigationLocalPersistenceIssue(
    hasDraftRestoreIssue,
    hasDraftPersistenceIssue,
  );
  const canPrepareWorkspaceSnapshot = isAuthenticated === true
    && authLoading === false
    && hasLocalPersistenceIssue === false
    && hasCreateError === false
    && hasProjectListError === false;
  const canMarkPendingNavigation = canMarkWorkspaceEntryPendingNavigation({
    canPrepareWorkspaceSnapshot,
    isHomeSurface,
    hasTargetProject,
    hasProjects,
  });
  const canNavigateWorkspace = canNavigateWorkspaceEntry({
    canMarkPendingNavigation,
    isHomeSurface,
    isBusy,
    hasTargetProject,
    hasProjects,
  });
  const status = getWorkspaceEntryNavigationSnapshotStatus({
    authLoading,
    isAuthenticated,
    hasDraftRestoreIssue,
    hasDraftPersistenceIssue,
    hasCreateError,
    isHomeSurface,
    isBusy,
    hasProjectListError,
    hasProjects,
  });
  const source = getWorkspaceEntryNavigationSnapshotSource({
    status,
    isHomeSurface,
  });

  return {
    status,
    source,
    surface,
    isAuthenticated,
    isBusy,
    hasLocalPersistenceIssue,
    canPrepareWorkspaceSnapshot,
    canMarkPendingNavigation,
    canNavigateWorkspace,
    projectCount,
    hasTargetProject,
    targetProjectId,
    message: status === 'auth_loading'
      ? '入口正在等待鉴权状态。'
      : status === 'unauthenticated'
        ? '入口需要登录后才能进入 Workspace。'
        : status === 'draft_restoring'
          ? '首页草稿恢复存在本地状态问题。'
          : status === 'draft_persistence_failed'
            ? '首页草稿保存存在本地状态问题。'
            : status === 'project_create_failed'
              ? '首页项目创建失败，尚未进入 Workspace。'
              : status === 'creating_project'
                ? '首页正在创建项目并准备 Workspace 入口。'
                : status === 'ready_to_create'
                  ? '首页已准备好创建项目并写入 Workspace 跳转保护。'
                  : status === 'project_list_failed'
                    ? '项目列表同步失败，打开入口不可视为最新状态。'
                    : status === 'project_list_loading'
                      ? '项目列表正在加载，等待可打开项目。'
                      : status === 'project_list_empty'
                        ? '项目列表为空，暂无可打开 Workspace 项目。'
                        : '项目列表已准备好写入 Workspace 项目快照并打开项目。',
    recovery: status === 'auth_loading'
      ? '等待 Auth Provider 返回结果。'
      : status === 'unauthenticated'
        ? '登录后再从当前入口创建或打开项目。'
        : hasLocalPersistenceIssue === true
          ? '修复浏览器本地存储权限；跳转失败详情会通过 URL 临时参数传入 Workspace。'
          : status === 'project_create_failed'
            ? '修复创建失败原因后重新提交需求。'
            : status === 'project_list_failed'
              ? '重新加载项目列表，或返回首页通过 projectId 入口进入。'
              : status === 'project_list_empty'
                ? '返回首页创建第一个项目。'
                : '进入 Workspace 前会写入本地项目快照和 pending navigation 保护；失败会转为 URL 临时状态。',
    updatedAt: 'derived',
  };
}

function getWorkspaceEntryNavigationSnapshotClassName(snapshot: WorkspaceEntryNavigationSnapshot) {
  const hasWarningStatus = isWorkspaceEntryNavigationStatusIn(snapshot.status, WORKSPACE_ENTRY_NAVIGATION_WARNING_STATUSES);
  if (hasWarningStatus === true) {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  const hasLoadingStatus = isWorkspaceEntryNavigationStatusIn(snapshot.status, WORKSPACE_ENTRY_NAVIGATION_LOADING_STATUSES);
  if (hasLoadingStatus === true) {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getWorkspaceEntryNavigationSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function getWorkspaceEntryNavigationSnapshotReadinessLabel(value: boolean): string {
  return value === true ? 'ready' : 'blocked';
}

function getWorkspaceEntryNavigationSnapshotTargetLabel(snapshot: WorkspaceEntryNavigationSnapshot): string {
  const targetProjectId = snapshot.targetProjectId;
  const hasTargetProjectId = hasWorkspaceEntryNavigationTextValue(targetProjectId);

  if (hasTargetProjectId === true) {
    return targetProjectId;
  }

  if (snapshot.hasTargetProject === true) {
    return 'selected';
  }

  return 'none';
}

export function WorkspaceEntryNavigationSnapshotStrip({ snapshot }: { snapshot: WorkspaceEntryNavigationSnapshot }) {
  const isAuthenticatedLabel = getWorkspaceEntryNavigationSnapshotBooleanLabel(snapshot.isAuthenticated);
  const isBusyLabel = getWorkspaceEntryNavigationSnapshotBooleanLabel(snapshot.isBusy);
  const hasLocalPersistenceIssueLabel = getWorkspaceEntryNavigationSnapshotBooleanLabel(snapshot.hasLocalPersistenceIssue);
  const canPrepareWorkspaceSnapshotLabel = getWorkspaceEntryNavigationSnapshotReadinessLabel(snapshot.canPrepareWorkspaceSnapshot);
  const canMarkPendingNavigationLabel = getWorkspaceEntryNavigationSnapshotReadinessLabel(snapshot.canMarkPendingNavigation);
  const canNavigateWorkspaceLabel = getWorkspaceEntryNavigationSnapshotBooleanLabel(snapshot.canNavigateWorkspace);
  const targetLabel = getWorkspaceEntryNavigationSnapshotTargetLabel(snapshot);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-entry-navigation-snapshot"
      className={cn('rounded-lg border px-3 py-2 text-xs', getWorkspaceEntryNavigationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="font-medium">Workspace 入口快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Surface: {snapshot.surface}</span>
        <span>Auth: {isAuthenticatedLabel}</span>
        <span>Busy: {isBusyLabel}</span>
        <span>LocalIssue: {hasLocalPersistenceIssueLabel}</span>
        <span>Snapshot: {canPrepareWorkspaceSnapshotLabel}</span>
        <span>PendingNav: {canMarkPendingNavigationLabel}</span>
        <span>Navigate: {canNavigateWorkspaceLabel}</span>
        <span>Projects: {snapshot.projectCount}</span>
        <span>Target: {targetLabel}</span>
      </div>
      <p className="mt-1 text-center">{snapshot.message}</p>
      <p className="mt-1 text-center opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 text-center opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
