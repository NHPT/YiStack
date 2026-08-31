import { cn } from '@/lib/utils';

import { normalizeCommitVersion } from './workspace-page-helpers';
import type { GitCommit } from '@/lib/types';
import type {
  GitCommitDetailStatus,
  GitCommitDetailStatusValue,
  GitCommitListStatus,
  GitCommitListStatusValue,
  IDETab,
  WorkspaceGitTabBadgeSnapshot,
  WorkspaceGitTabBadgeSnapshotSource,
  WorkspaceGitTabBadgeSnapshotStatus,
  WorkspaceIdeShellSnapshot,
  WorkspaceIdeShellSnapshotSource,
  WorkspaceIdeShellSnapshotStatus,
  WorkspacePanelSurface,
} from './workspace-types';
import type { TabOption } from './workspace-ide-subpanel-types';

type WorkspaceIdeShellBooleanFactList = readonly boolean[];
type WorkspaceIdeShellTabList = readonly IDETab[];
type WorkspaceIdeShellSnapshotStatusList = readonly WorkspaceIdeShellSnapshotStatus[];
type WorkspaceGitTabBadgeSnapshotStatusList = readonly WorkspaceGitTabBadgeSnapshotStatus[];

const WORKSPACE_IDE_SHELL_RUNTIME_TABS: WorkspaceIdeShellTabList = [
  'preview',
  'debug',
  'terminal',
];

const WORKSPACE_IDE_SHELL_WARNING_STATUSES: WorkspaceIdeShellSnapshotStatusList = [
  'project_missing',
  'tab_unavailable',
];

const WORKSPACE_IDE_SHELL_INFO_STATUSES: WorkspaceIdeShellSnapshotStatusList = [
  'mobile_editor',
  'terminal',
  'debug',
];

const WORKSPACE_GIT_TAB_BADGE_STALE_SOURCE_STATUSES: WorkspaceGitTabBadgeSnapshotStatusList = [
  'stale_with_cache',
  'stale_without_cache',
];

const WORKSPACE_GIT_TAB_BADGE_WARNING_STATUSES: WorkspaceGitTabBadgeSnapshotStatusList = [
  'stale_without_cache',
  'detail_stale',
];

const WORKSPACE_GIT_TAB_BADGE_INFO_STATUSES: WorkspaceGitTabBadgeSnapshotStatusList = [
  'stale_with_cache',
];

function hasWorkspaceIdeShellTrueFact(values: WorkspaceIdeShellBooleanFactList): boolean {
  for (const value of values) {
    if (value === true) {
      return true;
    }
  }

  return false;
}

function isWorkspaceIdeShellTabIn(tab: IDETab, tabs: WorkspaceIdeShellTabList): boolean {
  for (const candidate of tabs) {
    const matchedTab = candidate === tab;
    if (matchedTab === true) {
      return true;
    }
  }

  return false;
}

function isWorkspaceIdeShellSnapshotStatusIn(
  status: WorkspaceIdeShellSnapshotStatus,
  statuses: WorkspaceIdeShellSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function isWorkspaceGitTabBadgeSnapshotStatusIn(
  status: WorkspaceGitTabBadgeSnapshotStatus,
  statuses: WorkspaceGitTabBadgeSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceIdeShellTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceIdeShellLabel<TWorkspaceIdeShellLabel extends string>(
  value: TWorkspaceIdeShellLabel | null | undefined,
  fallback: TWorkspaceIdeShellLabel,
): TWorkspaceIdeShellLabel {
  const hasValue = hasWorkspaceIdeShellTextValue(value);

  return hasValue === true ? value : fallback;
}

function hasWorkspaceIdeShellActiveTab(tabs: TabOption[], activeTab: IDETab): boolean {
  for (const tab of tabs) {
    const matchedTab = tab.id === activeTab;
    if (matchedTab === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceIdeShellRuntimeTabs(tabs: TabOption[]): boolean {
  for (const tab of tabs) {
    const matchedTab = isWorkspaceIdeShellTabIn(tab.id, WORKSPACE_IDE_SHELL_RUNTIME_TABS);
    if (matchedTab === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceIdeShellMobileEditor({
  surface,
  activeTab,
  hasMobileEditingFile,
}: {
  surface: WorkspacePanelSurface;
  activeTab: IDETab;
  hasMobileEditingFile: boolean;
}): boolean {
  if (surface !== 'mobile') {
    return false;
  }

  if (activeTab !== 'explorer') {
    return false;
  }

  return hasMobileEditingFile === true;
}

function getWorkspaceIdeShellSnapshotStatus({
  hasProject,
  activeTabAvailable,
  hasMobileEditor,
  activeTab,
}: {
  hasProject: boolean;
  activeTabAvailable: boolean;
  hasMobileEditor: boolean;
  activeTab: IDETab;
}): WorkspaceIdeShellSnapshotStatus {
  if (hasProject === false) {
    return 'project_missing';
  }

  if (activeTabAvailable === false) {
    return 'tab_unavailable';
  }

  if (hasMobileEditor === true) {
    return 'mobile_editor';
  }

  return activeTab;
}

function getWorkspaceIdeShellSnapshotSource(
  status: WorkspaceIdeShellSnapshotStatus,
): WorkspaceIdeShellSnapshotSource {
  if (status === 'project_missing') {
    return 'workspace_project';
  }

  if (status === 'tab_unavailable') {
    return 'runtime_capability';
  }

  if (status === 'mobile_editor') {
    return 'mobile_editor';
  }

  return 'tab_state';
}

function getWorkspaceIdeShellSnapshotMessage({
  status,
  activeTab,
}: {
  status: WorkspaceIdeShellSnapshotStatus;
  activeTab: IDETab;
}): string {
  if (status === 'project_missing') {
    return 'Workspace IDE 尚未绑定项目。';
  }

  if (status === 'tab_unavailable') {
    return '当前 IDE tab 不在可用导航集合中。';
  }

  if (status === 'mobile_editor') {
    return '移动端 IDE 正在展示文件编辑器。';
  }

  return `Workspace IDE 当前展示 ${activeTab} 面板。`;
}

function getWorkspaceIdeShellSnapshotRecovery(status: WorkspaceIdeShellSnapshotStatus): string {
  if (status === 'project_missing') {
    return '先进入已绑定项目，再使用 IDE 面板。';
  }

  if (status === 'tab_unavailable') {
    return '切回 Foundation 或 Explorer；如果是运行时能力 tab，请确认当前应用类型需要 runtime。';
  }

  if (status === 'mobile_editor') {
    return '可返回文件列表，或保存/复制当前移动端编辑内容。';
  }

  return '可继续使用当前 tab，或通过顶部导航切换到其他面板。';
}

export function buildWorkspaceIdeShellSnapshot({
  tabs,
  activeTab,
  projectId,
  surface,
  mobileEditingFile,
  fileCount,
  gitCommitCount,
}: {
  tabs: TabOption[];
  activeTab: IDETab;
  projectId: string | null;
  surface: WorkspacePanelSurface;
  mobileEditingFile?: string | null;
  fileCount: number;
  gitCommitCount: number;
}): WorkspaceIdeShellSnapshot {
  const hasProject = hasWorkspaceIdeShellTextValue(projectId);
  const activeTabAvailable = hasWorkspaceIdeShellActiveTab(tabs, activeTab);
  const runtimeTabsAvailable = hasWorkspaceIdeShellRuntimeTabs(tabs);
  const hasMobileEditingFile = hasWorkspaceIdeShellTextValue(mobileEditingFile);
  const hasMobileEditor = hasWorkspaceIdeShellMobileEditor({
    surface,
    activeTab,
    hasMobileEditingFile,
  });
  const status = getWorkspaceIdeShellSnapshotStatus({
    hasProject,
    activeTabAvailable,
    hasMobileEditor,
    activeTab,
  });
  const source = getWorkspaceIdeShellSnapshotSource(status);
  const message = getWorkspaceIdeShellSnapshotMessage({ status, activeTab });
  const recovery = getWorkspaceIdeShellSnapshotRecovery(status);

  return {
    status,
    source,
    surface,
    activeTab,
    activeTabAvailable,
    tabCount: tabs.length,
    hasProject,
    runtimeTabsAvailable,
    hasMobileEditor,
    fileCount,
    gitCommitCount,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getWorkspaceIdeShellSnapshotClassName(snapshot: WorkspaceIdeShellSnapshot) {
  const hasWarningStatus = isWorkspaceIdeShellSnapshotStatusIn(snapshot.status, WORKSPACE_IDE_SHELL_WARNING_STATUSES);
  if (hasWarningStatus === true) {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  const hasInfoStatus = isWorkspaceIdeShellSnapshotStatusIn(snapshot.status, WORKSPACE_IDE_SHELL_INFO_STATUSES);
  if (hasInfoStatus === true) {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getWorkspaceIdeShellSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function WorkspaceIdeShellSnapshotStrip({ snapshot }: { snapshot: WorkspaceIdeShellSnapshot }) {
  const activeTabAvailableLabel = getWorkspaceIdeShellSnapshotBooleanLabel(snapshot.activeTabAvailable);
  const hasProjectLabel = getWorkspaceIdeShellSnapshotBooleanLabel(snapshot.hasProject);
  const runtimeTabsAvailableLabel = getWorkspaceIdeShellSnapshotBooleanLabel(snapshot.runtimeTabsAvailable);
  const hasMobileEditorLabel = getWorkspaceIdeShellSnapshotBooleanLabel(snapshot.hasMobileEditor);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-ide-shell-snapshot"
      className={cn('border-b px-3 py-2 text-xs', getWorkspaceIdeShellSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">IDE 外壳快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Surface: {snapshot.surface}</span>
        <span>ActiveTab: {snapshot.activeTab}</span>
        <span>TabAvailable: {activeTabAvailableLabel}</span>
        <span>Tabs: {snapshot.tabCount}</span>
        <span>Project: {hasProjectLabel}</span>
        <span>RuntimeTabs: {runtimeTabsAvailableLabel}</span>
        <span>MobileEditor: {hasMobileEditorLabel}</span>
        <span>Files: {snapshot.fileCount}</span>
        <span>Commits: {snapshot.gitCommitCount}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildWorkspaceGitTabBadgeSnapshot({
  surface,
  gitCommits,
  gitCommitListStatus,
  selectedCommit,
  gitCommitDetailStatus,
}: {
  surface: WorkspacePanelSurface;
  gitCommits: GitCommit[];
  gitCommitListStatus: GitCommitListStatus | null;
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): WorkspaceGitTabBadgeSnapshot {
  const hasCommits = gitCommits.length > 0;
  const hasSelectedCommit = selectedCommit !== null;
  const selectedHash = hasSelectedCommit === true ? normalizeCommitVersion(selectedCommit.hash) : 'none';
  const listStatus = getWorkspaceGitTabBadgeListStatus(gitCommitListStatus);
  const hasSelectedCommitDetailStatus = hasWorkspaceGitTabBadgeSelectedCommitDetailStatus({
    hasSelectedCommit,
    selectedCommit,
    gitCommitDetailStatus,
  });
  const detailStatus = getWorkspaceGitTabBadgeDetailStatus({
    hasSelectedCommitDetailStatus,
    gitCommitDetailStatus,
  });
  const status = getWorkspaceGitTabBadgeSnapshotStatus({
    detailStatus,
    hasSelectedCommit,
    listStatus,
    hasCommits,
  });
  const source = getWorkspaceGitTabBadgeSnapshotSource(status);
  const message = getWorkspaceGitTabBadgeSnapshotMessage(status);
  const recovery = getWorkspaceGitTabBadgeSnapshotRecovery(status);

  return {
    status,
    source,
    surface,
    badgeCount: gitCommits.length,
    hasCommits,
    hasSelectedCommit,
    selectedHash,
    listStatus,
    detailStatus,
    canOpenGitTab: true,
    message,
    recovery,
    updatedAt: 'derived',
  };
}

function getWorkspaceGitTabBadgeListStatus(
  gitCommitListStatus: GitCommitListStatus | null,
): GitCommitListStatusValue | 'unknown' {
  if (gitCommitListStatus === null) {
    return 'unknown';
  }

  return getWorkspaceIdeShellLabel(gitCommitListStatus.status, 'unknown');
}

function hasWorkspaceGitTabBadgeSelectedCommitDetailStatus({
  hasSelectedCommit,
  selectedCommit,
  gitCommitDetailStatus,
}: {
  hasSelectedCommit: boolean;
  selectedCommit: GitCommit | null;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): boolean {
  if (hasSelectedCommit === false) {
    return false;
  }

  if (selectedCommit === null) {
    return false;
  }

  if (gitCommitDetailStatus === null) {
    return false;
  }

  const hasMatchedCommitHash = gitCommitDetailStatus.commitHash === selectedCommit.hash;
  return hasMatchedCommitHash === true;
}

function getWorkspaceGitTabBadgeDetailStatus({
  hasSelectedCommitDetailStatus,
  gitCommitDetailStatus,
}: {
  hasSelectedCommitDetailStatus: boolean;
  gitCommitDetailStatus: GitCommitDetailStatus | null;
}): GitCommitDetailStatusValue | 'none' {
  if (hasSelectedCommitDetailStatus === false) {
    return 'none';
  }

  if (gitCommitDetailStatus === null) {
    return 'none';
  }

  return gitCommitDetailStatus.status;
}

function getWorkspaceGitTabBadgeSnapshotStatus({
  detailStatus,
  hasSelectedCommit,
  listStatus,
  hasCommits,
}: {
  detailStatus: GitCommitDetailStatusValue | 'none';
  hasSelectedCommit: boolean;
  listStatus: GitCommitListStatusValue | 'unknown';
  hasCommits: boolean;
}): WorkspaceGitTabBadgeSnapshotStatus {
  if (detailStatus === 'stale_from_cache') {
    return 'detail_stale';
  }

  if (hasSelectedCommit === true) {
    return 'selected';
  }

  if (listStatus === 'stale_with_cache') {
    return 'stale_with_cache';
  }

  if (listStatus === 'stale_without_cache') {
    return 'stale_without_cache';
  }

  if (hasCommits === true) {
    return 'fresh';
  }

  return 'empty';
}

function getWorkspaceGitTabBadgeSnapshotSource(
  status: WorkspaceGitTabBadgeSnapshotStatus,
): WorkspaceGitTabBadgeSnapshotSource {
  if (status === 'detail_stale') {
    return 'detail_status';
  }

  if (status === 'selected') {
    return 'selection';
  }

  const hasStaleListStatus = isWorkspaceGitTabBadgeSnapshotStatusIn(
    status,
    WORKSPACE_GIT_TAB_BADGE_STALE_SOURCE_STATUSES,
  );
  if (hasStaleListStatus === true) {
    return 'list_status';
  }

  if (status === 'empty') {
    return 'commit_list';
  }

  return 'tab_badge';
}

function getWorkspaceGitTabBadgeSnapshotMessage(status: WorkspaceGitTabBadgeSnapshotStatus): string {
  if (status === 'detail_stale') {
    return 'Git tab badge 关联的提交详情来自缓存。';
  }

  if (status === 'selected') {
    return 'Git tab badge 已关联当前选中提交。';
  }

  if (status === 'stale_with_cache') {
    return 'Git tab badge 当前数量来自旧快照。';
  }

  if (status === 'stale_without_cache') {
    return 'Git tab badge 当前没有可确认的提交列表。';
  }

  if (status === 'empty') {
    return 'Git tab badge 当前没有提交记录。';
  }

  return 'Git tab badge 当前数量已就绪。';
}

function getWorkspaceGitTabBadgeSnapshotRecovery(status: WorkspaceGitTabBadgeSnapshotStatus): string {
  if (status === 'stale_without_cache') {
    return '打开 Git tab 并刷新提交列表，确认后端 Git 历史是否可用。';
  }

  const hasRefreshRecoveryStatus = isWorkspaceGitTabBadgeSnapshotStatusIn(
    status,
    WORKSPACE_GIT_TAB_BADGE_WARNING_STATUSES,
  );
  if (hasRefreshRecoveryStatus === true) {
    return '打开 Git tab 后刷新提交列表或重新查看当前提交。';
  }

  if (status === 'empty') {
    return '打开 Git tab，确认当前项目是否已有提交历史。';
  }

  return '可打开 Git tab 查看提交列表与详情。';
}

function getWorkspaceGitTabBadgeSnapshotClassName(snapshot: WorkspaceGitTabBadgeSnapshot) {
  const hasWarningStatus = isWorkspaceGitTabBadgeSnapshotStatusIn(
    snapshot.status,
    WORKSPACE_GIT_TAB_BADGE_WARNING_STATUSES,
  );
  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  const hasInfoStatus = isWorkspaceGitTabBadgeSnapshotStatusIn(
    snapshot.status,
    WORKSPACE_GIT_TAB_BADGE_INFO_STATUSES,
  );
  if (hasInfoStatus === true) {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  }
  return 'border-muted-foreground/20 bg-background/80 text-muted-foreground';
}

export function WorkspaceGitTabBadgeSnapshotStrip({ snapshot }: { snapshot: WorkspaceGitTabBadgeSnapshot }) {
  const hasSelectedCommitLabel = getWorkspaceIdeShellSnapshotBooleanLabel(snapshot.hasSelectedCommit);
  const canOpenGitTabLabel = getWorkspaceIdeShellSnapshotBooleanLabel(snapshot.canOpenGitTab);

  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="workspace-git-tab-badge-snapshot"
      className={cn('ml-1 inline-flex flex-wrap items-center gap-x-1 rounded-md border px-1.5 py-0.5 text-[10px]', getWorkspaceGitTabBadgeSnapshotClassName(snapshot))}
    >
      <span className="font-medium">GitTab</span>
      <span>Phase: {snapshot.status}</span>
      <span>Source: {snapshot.source}</span>
      <span>Count: {snapshot.badgeCount}</span>
      <span>Surface: {snapshot.surface}</span>
      <span>Selected: {hasSelectedCommitLabel}</span>
      <span>Hash: {snapshot.selectedHash}</span>
      <span>List: {snapshot.listStatus}</span>
      <span>Detail: {snapshot.detailStatus}</span>
      <span>Open: {canOpenGitTabLabel}</span>
      <span>Message: {snapshot.message}</span>
      <span>恢复建议：{snapshot.recovery}</span>
    </span>
  );
}
