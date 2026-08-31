import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { projectApi, type Plan, type ProjectMessage, type ProjectRuntimeStatus } from '@/lib/api';
import type { FileNode } from '@/lib/types';
import { normalizeWorkspaceEngineeringState } from '@/lib/workspace/engineering-state';
import { formatPreviewUrlBuildFailure } from '@/lib/workspace/preview-url-build-errors';
import {
  buildWorkspaceProjectPayloadParseFailure,
  formatWorkspaceBootstrapLocalStateError,
  type WorkspaceProjectPayloadParseSource,
} from '@/lib/workspace/workspace-bootstrap-local-errors';
import {
  buildHomeEntryLocalStateFailureFromDetails,
  formatHomeEntryLocalStateFailure,
} from '@/lib/workspace/home-entry-local-errors';
import {
  buildProjectListSnapshotPersistenceFailureFromDetails,
  formatProjectListSnapshotPersistenceFailure,
} from '@/lib/workspace/project-list-snapshot-local-errors';
import {
  formatWorkspacePendingNavigationLocalFailure,
  type WorkspacePendingNavigationLocalFailure,
  type WorkspacePendingNavigationOperation,
} from '@/lib/workspace/workspace-pending-navigation-local-errors';
import {
  buildWorkspaceTransientUrlCleanupFailure,
  formatWorkspaceTransientUrlCleanupFailure,
  type WorkspaceTransientUrlLocalFailure,
} from '@/lib/workspace/workspace-transient-url-local-errors';
import {
  buildWorkspaceLocalProjectSnapshotFailure,
  formatWorkspaceLocalProjectSnapshotFailure,
  type WorkspaceLocalProjectSnapshotFailure,
  type WorkspaceLocalProjectSnapshotOperation,
} from '@/lib/workspace/workspace-local-project-snapshot-errors';
import {
  buildProjectBootstrapFileTreeParseError,
  formatProjectBootstrapFileTreeParseFailure,
  formatProjectBootstrapRecoveryFailure,
} from '@/lib/workspace/workspace-project-bootstrap-errors';

import type {
  EditorBufferStatus,
  ExplorerSnapshotStatus,
  PreviewUrlStatus,
  WorkspaceChatMessage,
  WorkspaceEditorSessionSnapshot,
  WorkspaceOpenFilePathList,
  WorkspacePreviewUrlSurface,
  WorkspaceProjectInfo,
  WorkspaceProjectBootstrapMessageRestoreStatus,
  WorkspaceSessionSnapshot,
} from './workspace-types';
import {
  getWorkspaceSessionSnapshotEditorState,
  resolveRestoredPlanFlowState,
} from './workspace-plan-flow-state';
import {
  appTypeNeedsRuntime,
  mergeRestoredWorkspaceMessages,
} from './workspace-page-helpers';
import type {
  InitialWorkspaceMessagesProject,
  PendingWorkspaceNavigationClearResult,
  PendingWorkspaceNavigationFreshResult,
  ProjectPreviewUrlBuildResult,
} from './workspace-page-helpers';
import { buildFreshExplorerSnapshotStatus } from './workspace-explorer-snapshot-status';
import {
  buildPreviewUrlBuildFailureStatus,
  buildWorkspaceBootstrapPreviewUrlStatus,
} from './workspace-preview-url-status';
import type { WorkspaceProjectBootstrapContract } from './workspace-project-bootstrap-contract';
import type {
  WorkspacePlanGenerationProjectIdSet,
  WorkspacePlanGenerationProjectIdSetRef,
} from './workspace-plan-generation-types';

type InitializeProjectPayload = WorkspaceProjectInfo & {
  fileTree?: unknown;
  containerPort?: number;
  previewUrl?: string;
  containerStatus?: string;
  runtimeStatus?: ProjectRuntimeStatus;
  directoryPath?: string;
};

type WorkspaceBootstrapProjectInitializeOptions = {
  skipDetailRefresh?: boolean;
};

type WorkspaceBootstrapMessageDeserializer = (message: ProjectMessage) => WorkspaceChatMessage;

type WorkspaceBootstrapRestoredMessagesMaterializerInput = {
  historyMessages: ProjectMessage[];
  deserializeWorkspaceMessage: WorkspaceBootstrapMessageDeserializer;
};

const homeProjectSnapshotStatusParam = 'home_project_snapshot_status';
const homeProjectSnapshotDetailsParam = 'home_project_snapshot_details';
const homePendingNavigationStatusParam = 'home_pending_navigation_status';
const homePendingNavigationDetailsParam = 'home_pending_navigation_details';
const homeDraftCleanupStatusParam = 'home_draft_cleanup_status';
const homeDraftCleanupDetailsParam = 'home_draft_cleanup_details';
const projectListSnapshotStatusParam = 'project_list_snapshot_status';
const projectListSnapshotDetailsParam = 'project_list_snapshot_details';
const localWorkspaceProjectSnapshotKey = 'yistack_current_project';

function hasWorkspaceBootstrapPreviewSourceUrl(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasWorkspaceBootstrapProjectTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceBootstrapProjectNameValue(projectName: string | null | undefined): string {
  const hasProjectName = hasWorkspaceBootstrapProjectTextValue(projectName);
  if (hasProjectName === true) {
    return projectName;
  }

  return '未命名项目';
}

function getWorkspaceBootstrapProjectAppTypeValue(appType: string | null | undefined): string {
  const hasAppType = hasWorkspaceBootstrapProjectTextValue(appType);
  if (hasAppType === true) {
    return appType;
  }

  return 'web';
}

function getWorkspaceBootstrapProjectTextValue(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspaceBootstrapProjectTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getWorkspaceBootstrapProjectNumberValue(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value;
}

function hasWorkspaceBootstrapProjectPlanArtifact(
  planId: string | null | undefined,
  planData: string | null | undefined,
): boolean {
  const hasPlanId = hasWorkspaceBootstrapProjectTextValue(planId);
  if (hasPlanId === true) {
    return true;
  }

  const hasPlanData = hasWorkspaceBootstrapProjectTextValue(planData);
  return hasPlanData === true;
}

function getWorkspaceBootstrapProjectInitialMessage({
  description,
  planId,
  planData,
}: {
  description: string | null | undefined;
  planId: string | null | undefined;
  planData: string | null | undefined;
}): string {
  const hasPlanArtifact = hasWorkspaceBootstrapProjectPlanArtifact(planId, planData);
  if (hasPlanArtifact === false) {
    return '';
  }

  const hasDescription = hasWorkspaceBootstrapProjectTextValue(description);
  if (hasDescription === true) {
    return `开始实现：${description}`;
  }

  return '开始开发';
}

function getWorkspaceBootstrapRestoredSnapshotProjectId(
  snapshotProjectId: string | null | undefined,
  fallbackProjectId: string,
): string {
  const hasSnapshotProjectId = hasWorkspaceBootstrapProjectTextValue(snapshotProjectId);
  if (hasSnapshotProjectId === true) {
    return snapshotProjectId;
  }

  return fallbackProjectId;
}

function getWorkspaceBootstrapRestoredSnapshotPersistedValue(
  snapshotPersistedValue: boolean | null | undefined,
): boolean {
  if (snapshotPersistedValue === null || snapshotPersistedValue === undefined) {
    return true;
  }

  return snapshotPersistedValue;
}

function materializeWorkspaceBootstrapRestoredMessages({
  historyMessages,
  deserializeWorkspaceMessage,
}: WorkspaceBootstrapRestoredMessagesMaterializerInput): WorkspaceChatMessage[] {
  const restoredMessages: WorkspaceChatMessage[] = [];

  for (const historyMessage of historyMessages) {
    restoredMessages.push(deserializeWorkspaceMessage(historyMessage));
  }

  return restoredMessages;
}

function isWorkspaceBootstrapInitializedProject(
  initializedProjectId: string | null,
  projectId: string,
): boolean {
  const isInitializedProject = initializedProjectId === projectId;
  return isInitializedProject === true;
}

function isWorkspaceBootstrapPersistedProject(data: InitializeProjectPayload): boolean {
  const hasPersistedFlag = data.isPersisted === true;
  if (hasPersistedFlag === true) {
    return true;
  }

  const hasProjectId = hasWorkspaceBootstrapProjectTextValue(data.projectId);
  if (hasProjectId === false) {
    return false;
  }

  const hasPersistedProjectId = data.projectId.startsWith('proj_');
  return hasPersistedProjectId === true;
}

function hasWorkspaceBootstrapSessionSnapshot(
  snapshot: WorkspaceSessionSnapshot | null,
): snapshot is WorkspaceSessionSnapshot {
  const hasSnapshot = snapshot !== null;
  return hasSnapshot === true;
}

function getWorkspaceBootstrapInitializeFileTreePayload(data: InitializeProjectPayload): unknown {
  const hasPayload = hasWorkspaceBootstrapProjectFileTreePayload(data.fileTree);
  if (hasPayload === false) {
    return undefined;
  }

  return data.fileTree;
}

function hasWorkspaceBootstrapExpandedFileTree(tree: FileNode[]): boolean {
  const hasItems = tree.length > 0;
  return hasItems === true;
}

function shouldSkipWorkspaceBootstrapProjectDetailRefresh(
  options: WorkspaceBootstrapProjectInitializeOptions | undefined,
): boolean {
  if (options === undefined) {
    return false;
  }

  const shouldSkip = options.skipDetailRefresh === true;
  return shouldSkip === true;
}

function shouldRefreshWorkspaceBootstrapProjectDetail({
  isPersistedProject,
  options,
}: {
  isPersistedProject: boolean;
  options: WorkspaceBootstrapProjectInitializeOptions | undefined;
}): boolean {
  if (isPersistedProject === false) {
    return false;
  }

  const shouldSkip = shouldSkipWorkspaceBootstrapProjectDetailRefresh(options);
  return shouldSkip === false;
}

function getWorkspaceBootstrapPersistedProject(projectInfo: WorkspaceProjectInfo | null): WorkspaceProjectInfo | null {
  if (projectInfo === null) {
    return null;
  }

  const isPersistedProject = projectInfo.isPersisted === true;
  if (isPersistedProject === false) {
    return null;
  }

  const hasProjectId = hasWorkspaceBootstrapProjectTextValue(projectInfo.projectId);
  if (hasProjectId === false) {
    return null;
  }

  return projectInfo;
}

function getWorkspaceBootstrapSelectedPlanId(
  snapshotSelectedPlanId: string | null | undefined,
  persistedPlanId: string | null | undefined,
): string | null {
  const hasSnapshotSelectedPlan = hasWorkspaceBootstrapProjectTextValue(snapshotSelectedPlanId);
  if (hasSnapshotSelectedPlan === true) {
    return snapshotSelectedPlanId;
  }

  const hasPersistedPlan = hasWorkspaceBootstrapProjectTextValue(persistedPlanId);
  if (hasPersistedPlan === true) {
    return persistedPlanId;
  }

  return null;
}

function hasWorkspaceBootstrapSessionMessages(
  snapshot: WorkspaceSessionSnapshot | null,
): snapshot is WorkspaceSessionSnapshot {
  if (snapshot === null) {
    return false;
  }

  const hasMessages = snapshot.messages.length > 0;
  return hasMessages === true;
}

function hasWorkspaceBootstrapEditorPath(path: string): boolean {
  const hasPath = path.length > 0;
  return hasPath === true;
}

function materializeWorkspaceBootstrapOpenFiles(
  openFiles: WorkspaceOpenFilePathList,
): WorkspaceOpenFilePathList {
  const files: WorkspaceOpenFilePathList = [];

  for (const openFile of openFiles) {
    const hasPath = hasWorkspaceBootstrapEditorPath(openFile);
    if (hasPath === true) {
      files.push(openFile);
    }
  }

  return files;
}

function materializeWorkspaceBootstrapFileMap(
  entries: WorkspaceEditorSessionSnapshot['files'],
): Map<string, string> {
  const files = new Map<string, string>();

  for (const entry of entries) {
    const hasPath = hasWorkspaceBootstrapEditorPath(entry.path);
    if (hasPath === true) {
      files.set(entry.path, entry.content);
    }
  }

  return files;
}

function materializeWorkspaceBootstrapEditorStatusMap(
  entries: WorkspaceEditorSessionSnapshot['editorBufferStatuses'],
): Map<string, EditorBufferStatus> {
  const statuses = new Map<string, EditorBufferStatus>();

  for (const entry of entries) {
    const hasPath = hasWorkspaceBootstrapEditorPath(entry.path);
    if (hasPath === true) {
      statuses.set(entry.path, entry.status);
    }
  }

  return statuses;
}

function materializeWorkspaceBootstrapExpandedFolderSet(
  folders: string[],
): Set<string> {
  const expandedFolders = new Set<string>();

  for (const folder of folders) {
    expandedFolders.add(folder);
  }

  return expandedFolders;
}

function getWorkspaceBootstrapRestoredActiveFile({
  activeFile,
  openFiles,
}: {
  activeFile: string | null;
  openFiles: WorkspaceOpenFilePathList;
}): string | null {
  if (activeFile !== null && hasWorkspaceBootstrapEditorPath(activeFile) === true) {
    return activeFile;
  }

  for (const openFile of openFiles) {
    return openFile;
  }

  return null;
}

function hasWorkspaceBootstrapRestoredPlanState(availablePlans: Plan[], selectedPlanId: string | null): boolean {
  const hasAvailablePlans = availablePlans.length > 0;
  if (hasAvailablePlans === true) {
    return true;
  }

  const hasSelectedPlan = hasWorkspaceBootstrapProjectTextValue(selectedPlanId);
  return hasSelectedPlan === true;
}

function isWorkspaceProjectBootstrapEffectActive(cancelled: boolean): boolean {
  return cancelled === false;
}

function getWorkspaceBootstrapRuntimePreviewUrl(runtimeStatus: ProjectRuntimeStatus | undefined): string | undefined {
  const hasRuntimeStatus = runtimeStatus !== undefined;
  if (hasRuntimeStatus === false) {
    return undefined;
  }

  return runtimeStatus.previewUrl;
}

function getWorkspaceBootstrapPreviewSourceUrl({
  previewUrl,
  runtimePreviewUrl,
}: {
  previewUrl: string | null | undefined;
  runtimePreviewUrl: string | null | undefined;
}): string | undefined {
  const hasPreviewUrl = hasWorkspaceBootstrapPreviewSourceUrl(previewUrl);
  if (hasPreviewUrl === true) {
    return previewUrl;
  }

  const hasRuntimePreviewUrl = hasWorkspaceBootstrapPreviewSourceUrl(runtimePreviewUrl);
  if (hasRuntimePreviewUrl === true) {
    return runtimePreviewUrl;
  }

  return undefined;
}

function shouldSyncWorkspaceBootstrapPreviewUrl({
  previewSourceUrl,
  appType,
}: {
  previewSourceUrl: string | null | undefined;
  appType: string | null | undefined;
}): boolean {
  const hasPreviewSourceUrl = hasWorkspaceBootstrapPreviewSourceUrl(previewSourceUrl);
  const needsRuntime = appTypeNeedsRuntime(appType);
  return hasPreviewSourceUrl === true || needsRuntime === true;
}

function isWorkspaceBootstrapPreviewBuildReady(
  result: ProjectPreviewUrlBuildResult,
): result is Extract<ProjectPreviewUrlBuildResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function shouldAppendWorkspaceBootstrapPreviewBuildFailure(
  result: ProjectPreviewUrlBuildResult,
): result is Extract<ProjectPreviewUrlBuildResult, { ok: false }> {
  const isReady = isWorkspaceBootstrapPreviewBuildReady(result);
  if (isReady === true) {
    return false;
  }

  const hasProjectIdFailure = result.reasonCode === 'missing_project_id';
  if (hasProjectIdFailure === true) {
    return false;
  }

  return true;
}

function getWorkspaceBootstrapPreviewStatusUrl(status: PreviewUrlStatus | null): string {
  if (status === null) {
    return 'about:blank';
  }

  return getWorkspaceBootstrapProjectTextValue(status.url, 'about:blank');
}

function hasWorkspaceBootstrapMessage(messages: WorkspaceChatMessage[], messageId: string): boolean {
  for (const message of messages) {
    const isMatchedMessage = message.id === messageId;
    if (isMatchedMessage === true) {
      return true;
    }
  }

  return false;
}

function getWorkspaceBootstrapUrlSearchParamText(url: URL, param: string, fallback: string): string {
  const value = url.searchParams.get(param);
  return getWorkspaceBootstrapProjectTextValue(value, fallback);
}

function hasWorkspaceBootstrapUrlFailureStatus(url: URL, param: string): boolean {
  const status = url.searchParams.get(param);
  const hasFailureStatus = status === 'failed';
  return hasFailureStatus === true;
}

function hasWorkspaceBootstrapHomeNavigationPersistenceFailure({
  projectSnapshotFailed,
  pendingNavigationFailed,
  homeDraftCleanupFailed,
  projectListSnapshotFailed,
}: {
  projectSnapshotFailed: boolean;
  pendingNavigationFailed: boolean;
  homeDraftCleanupFailed: boolean;
  projectListSnapshotFailed: boolean;
}): boolean {
  if (projectSnapshotFailed === true) {
    return true;
  }

  if (pendingNavigationFailed === true) {
    return true;
  }

  if (homeDraftCleanupFailed === true) {
    return true;
  }

  return projectListSnapshotFailed === true;
}

function getWorkspaceBootstrapNewMessages(
  previousMessages: WorkspaceChatMessage[],
  candidateMessages: WorkspaceChatMessage[],
): WorkspaceChatMessage[] {
  const nextMessages: WorkspaceChatMessage[] = [];
  for (const message of candidateMessages) {
    const hasExistingMessage = hasWorkspaceBootstrapMessage(previousMessages, message.id);
    const hasNextMessage = hasWorkspaceBootstrapMessage(nextMessages, message.id);
    if (hasExistingMessage === false && hasNextMessage === false) {
      nextMessages.push(message);
    }
  }

  return nextMessages;
}

type LocalWorkspaceProjectSnapshotReadResult =
  | { ok: true; raw: string | null }
  | WorkspaceLocalProjectSnapshotFailure<'read'>;

type LocalWorkspaceProjectSnapshotClearResult =
  | { ok: true }
  | WorkspaceLocalProjectSnapshotFailure<'clear'>;

type WorkspaceTransientStatusUrlCleanupResult =
  | { ok: true }
  | WorkspaceTransientUrlLocalFailure;

function isLocalWorkspaceProjectSnapshotReadReady(
  result: LocalWorkspaceProjectSnapshotReadResult,
): result is Extract<LocalWorkspaceProjectSnapshotReadResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function isLocalWorkspaceProjectSnapshotClearReady(
  result: LocalWorkspaceProjectSnapshotClearResult,
): result is Extract<LocalWorkspaceProjectSnapshotClearResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function isPendingWorkspaceNavigationClearReady(
  result: PendingWorkspaceNavigationClearResult,
): result is Extract<PendingWorkspaceNavigationClearResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function hasLocalWorkspaceProjectSnapshotRaw(raw: string | null): raw is string {
  const hasRaw = hasWorkspaceBootstrapProjectTextValue(raw);
  return hasRaw === true;
}

function isPendingWorkspaceNavigationFreshReadReady(
  result: PendingWorkspaceNavigationFreshResult,
): result is Extract<PendingWorkspaceNavigationFreshResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function hasPendingWorkspaceNavigationFreshState(result: Extract<PendingWorkspaceNavigationFreshResult, { ok: true }>): boolean {
  const hasFresh = result.hasFresh === true;
  return hasFresh === true;
}

function getWorkspaceBootstrapSnapshotProjectId(data: WorkspaceProjectInfo): string | null {
  const hasProjectId = hasWorkspaceBootstrapProjectTextValue(data.projectId);
  if (hasProjectId === true) {
    return data.projectId;
  }

  return null;
}

function getWorkspaceBootstrapOptionalSnapshotProjectId(projectId: string | null): string | undefined {
  if (projectId === null) {
    return undefined;
  }

  return projectId;
}

function shouldClearWorkspaceBootstrapLocalSnapshot(data: WorkspaceProjectInfo): boolean {
  const isPersisted = data.isPersisted === true;
  if (isPersisted === true) {
    return true;
  }

  const snapshotProjectId = getWorkspaceBootstrapSnapshotProjectId(data);
  return snapshotProjectId !== null;
}

function hasWorkspaceBootstrapProjectFileTreePayload(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return hasWorkspaceBootstrapProjectTextValue(value);
  }

  const isObjectPayload = typeof value === 'object';
  return isObjectPayload === true;
}

function readWorkspaceBootstrapProjectFileTree(
  payload: unknown,
  parseFileTree: <T>(raw: string, fallback: T) => T,
): FileNode | FileNode[] | null | undefined {
  if (typeof payload === 'string') {
    return parseFileTree<FileNode[] | null>(payload, null);
  }

  return payload as FileNode | FileNode[] | null | undefined;
}

function hasWorkspaceBootstrapParsedFileTree(
  tree: FileNode | FileNode[] | null | undefined,
): tree is FileNode | FileNode[] {
  if (tree === null || tree === undefined) {
    return false;
  }

  return true;
}

function isWorkspaceTransientStatusUrlCleanupReady(
  result: WorkspaceTransientStatusUrlCleanupResult,
): result is Extract<WorkspaceTransientStatusUrlCleanupResult, { ok: true }> {
  const isReady = result.ok === true;
  return isReady === true;
}

function shouldSkipWorkspaceBootstrapRouteEffect({
  authLoading,
  isAuthenticated,
}: {
  authLoading: boolean;
  isAuthenticated: boolean;
}): boolean {
  if (authLoading === true) {
    return true;
  }

  const hasAuthenticatedUser = isAuthenticated === true;
  return hasAuthenticatedUser === false;
}

function hasWorkspaceBootstrapRouteProjectId(projectIdParam: string | null): projectIdParam is string {
  const hasProjectId = hasWorkspaceBootstrapProjectTextValue(projectIdParam);
  return hasProjectId === true;
}

function isWorkspaceBootstrapCurrentRouteProjectId(
  currentProjectId: string | null,
  routeProjectId: string,
): boolean {
  const isCurrent = currentProjectId === routeProjectId;
  return isCurrent === true;
}

function hasWorkspaceBootstrapRouteProjectPayload(projectParam: string | null): projectParam is string {
  const hasProjectPayload = hasWorkspaceBootstrapProjectTextValue(projectParam);
  return hasProjectPayload === true;
}

function readWorkspaceBootstrapRouteProjectPayload(projectParam: string): InitializeProjectPayload {
  return JSON.parse(decodeURIComponent(projectParam)) as InitializeProjectPayload;
}

function hasWorkspaceBootstrapParsedProjectInfo(
  data: WorkspaceProjectInfo | null,
): data is WorkspaceProjectInfo {
  const hasProjectInfo = data !== null;
  return hasProjectInfo === true;
}

function hasWorkspaceBootstrapMountedState(hasMounted: boolean): boolean {
  const hasReadyMount = hasMounted === true;
  return hasReadyMount === true;
}

function hasWorkspaceBootstrapProjectInfo(projectInfo: WorkspaceProjectInfo | null): boolean {
  const hasProjectInfo = projectInfo !== null;
  return hasProjectInfo === true;
}

function shouldSkipWorkspaceBootstrapLocalSnapshotEffect({
  hasMounted,
  authLoading,
  isAuthenticated,
  projectInfo,
  projectIdParam,
  projectParam,
}: {
  hasMounted: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  projectInfo: WorkspaceProjectInfo | null;
  projectIdParam: string | null;
  projectParam: string | null;
}): boolean {
  const hasReadyMount = hasWorkspaceBootstrapMountedState(hasMounted);
  if (hasReadyMount === false) {
    return true;
  }

  const shouldSkipRoute = shouldSkipWorkspaceBootstrapRouteEffect({
    authLoading,
    isAuthenticated,
  });
  if (shouldSkipRoute === true) {
    return true;
  }

  const hasProject = hasWorkspaceBootstrapProjectInfo(projectInfo);
  if (hasProject === true) {
    return true;
  }

  const hasRouteProjectId = hasWorkspaceBootstrapRouteProjectId(projectIdParam);
  if (hasRouteProjectId === true) {
    return true;
  }

  const hasRouteProjectPayload = hasWorkspaceBootstrapRouteProjectPayload(projectParam);
  return hasRouteProjectPayload === true;
}

function readLocalWorkspaceProjectSnapshot(): LocalWorkspaceProjectSnapshotReadResult {
  try {
    return { ok: true, raw: localStorage.getItem(localWorkspaceProjectSnapshotKey) };
  } catch (error) {
    return buildWorkspaceLocalProjectSnapshotFailure(
      error,
      'read',
      '浏览器拒绝读取本地 Workspace 项目快照',
    );
  }
}

function clearLocalWorkspaceProjectSnapshot(): LocalWorkspaceProjectSnapshotClearResult {
  try {
    localStorage.removeItem(localWorkspaceProjectSnapshotKey);
    return { ok: true };
  } catch (error) {
    return buildWorkspaceLocalProjectSnapshotFailure(
      error,
      'clear',
      '浏览器拒绝清理本地 Workspace 项目快照',
    );
  }
}

function replaceWorkspaceTransientStatusUrl(url: URL): WorkspaceTransientStatusUrlCleanupResult {
  try {
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    return { ok: true };
  } catch (error) {
    return buildWorkspaceTransientUrlCleanupFailure(error);
  }
}

type UseWorkspaceProjectBootstrapOptions = {
  authLoading: boolean;
  isAuthenticated: boolean;
  hasMounted: boolean;
  projectIdParam: string | null;
  projectParam: string | null;
  projectInfo: WorkspaceProjectInfo | null;
  safeParseJSON: <T>(raw: string, fallback: T) => T;
  normalizeFileTreePayload: (tree: FileNode | FileNode[] | null | undefined) => FileNode[];
  buildProjectPreviewUrlResult: (projectId: string, explicitPreviewUrl?: string | null) => ProjectPreviewUrlBuildResult;
  buildInitialWorkspaceMessages: (project: InitialWorkspaceMessagesProject) => WorkspaceChatMessage[];
  deserializeWorkspaceMessage: (message: ProjectMessage) => WorkspaceChatMessage;
  readWorkspaceSessionSnapshot: (projectId: string) => WorkspaceSessionSnapshot | null;
  applyWorkspaceState: (
    nextMessages: WorkspaceChatMessage[],
    options?: {
      availablePlans?: Plan[];
      recommendedPlanId?: string | null;
      selectedPlanId?: string | null;
      planCountdown?: number;
      planAutoConfirmDeadlineAt?: string | null;
      planSelectionReady?: boolean;
    },
  ) => void;
  clearPendingWorkspaceNavigation: () => PendingWorkspaceNavigationClearResult;
  hasFreshPendingWorkspaceNavigation: () => PendingWorkspaceNavigationFreshResult;
  routerReplaceHome: () => void;
  fetchProjectDetail: (projectId: string) => Promise<void>;
  setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  setOpenFiles: Dispatch<SetStateAction<WorkspaceOpenFilePathList>>;
  setFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setSavedFiles: Dispatch<SetStateAction<Map<string, string>>>;
  setEditorBufferStatuses: Dispatch<SetStateAction<Map<string, EditorBufferStatus>>>;
  setFileTree: Dispatch<SetStateAction<FileNode[]>>;
  setExplorerSnapshotStatus: Dispatch<SetStateAction<ExplorerSnapshotStatus | null>>;
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setPendingCloseFile: Dispatch<SetStateAction<string | null>>;
  setBrowserUrl: Dispatch<SetStateAction<string>>;
  setPreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  setMobileBrowserUrl: Dispatch<SetStateAction<string>>;
  setMobilePreviewUrlStatus: Dispatch<SetStateAction<PreviewUrlStatus | null>>;
  applyProjectBootstrapMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  resetWorkspaceRuntimeBootstrapState: (projectId: string) => void;
  initializedProjectIdRef: MutableRefObject<string | null>;
  restoredProjectIdRef: MutableRefObject<string | null>;
  routeProjectIdRef: MutableRefObject<string | null>;
  planningProjectIdRef: MutableRefObject<string | null>;
  plannedProjectIdsRef: WorkspacePlanGenerationProjectIdSetRef;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  autoPlanTriggeredRef: MutableRefObject<boolean>;
};

export function useWorkspaceProjectBootstrap({
  authLoading,
  isAuthenticated,
  hasMounted,
  projectIdParam,
  projectParam,
  projectInfo,
  safeParseJSON,
  normalizeFileTreePayload,
  buildProjectPreviewUrlResult,
  buildInitialWorkspaceMessages,
  deserializeWorkspaceMessage,
  readWorkspaceSessionSnapshot,
  applyWorkspaceState,
  clearPendingWorkspaceNavigation,
  hasFreshPendingWorkspaceNavigation,
  routerReplaceHome,
  fetchProjectDetail,
  setProjectInfo,
  setActiveFile,
  setOpenFiles,
  setFiles,
  setSavedFiles,
  setEditorBufferStatuses,
  setFileTree,
  setExplorerSnapshotStatus,
  setExpandedFolders,
  setSearchQuery,
  setPendingCloseFile,
  setBrowserUrl,
  setPreviewUrlStatus,
  setMobileBrowserUrl,
  setMobilePreviewUrlStatus,
  applyProjectBootstrapMessages,
  resetWorkspaceRuntimeBootstrapState,
  initializedProjectIdRef,
  restoredProjectIdRef,
  routeProjectIdRef,
  planningProjectIdRef,
  plannedProjectIdsRef,
  plannedProjectIdsAcrossMounts,
  autoPlanTriggeredRef,
}: UseWorkspaceProjectBootstrapOptions): WorkspaceProjectBootstrapContract {
  const [isRestoringWorkspace, setIsRestoringWorkspace] = useState(false);
  const [messageRestoreStatus, setMessageRestoreStatus] = useState<WorkspaceProjectBootstrapMessageRestoreStatus>('not_started');

  const appendProjectRestoreFailureMessage = useCallback((
    projectId: string,
    error: unknown,
    usedLocalSnapshot: boolean,
  ) => {
    const now = Date.now();
    applyProjectBootstrapMessages((prev) => [...prev, {
      id: `project-restore-failed-${projectId}-${now}`,
      role: 'assistant',
      content: usedLocalSnapshot
        ? `项目详情恢复失败：${formatProjectBootstrapRecoveryFailure(error)}。已使用本地 Workspace 快照兜底，当前项目元信息、文件树、Preview URL 或运行时状态可能仍是旧状态；你可以稍后刷新项目重新同步，已打开文件的本地编辑内容不会因此丢失。`
        : `项目详情恢复失败：${formatProjectBootstrapRecoveryFailure(error)}。未找到可用的本地 Workspace 快照，当前项目无法自动恢复；你可以稍后重新打开项目或返回项目列表重试。`,
      timestamp: new Date().toISOString(),
    }]);
  }, [applyProjectBootstrapMessages]);

  const appendWorkspaceMessagesRestoreFailureMessage = useCallback((
    projectId: string,
    error: unknown,
    usedSessionSnapshot: boolean,
  ) => {
    const now = Date.now();
    applyProjectBootstrapMessages((prev) => [...prev, {
      id: `workspace-messages-restore-failed-${projectId}-${now}`,
      role: 'assistant',
      content: usedSessionSnapshot
        ? `历史消息恢复失败：${formatProjectBootstrapRecoveryFailure(error)}。已使用本地会话快照兜底，当前聊天记录、工程状态或恢复入口可能不是后端最新状态；你可以稍后刷新项目重新同步，已打开文件的本地编辑内容不会因此丢失。`
        : `历史消息恢复失败：${formatProjectBootstrapRecoveryFailure(error)}。未找到可用的本地会话快照，当前聊天记录、工程状态或恢复入口可能不完整；你可以稍后刷新项目重新同步。`,
      timestamp: new Date().toISOString(),
    }]);
  }, [applyProjectBootstrapMessages]);

  const appendProjectPayloadParseFailureMessage = useCallback((
    source: WorkspaceProjectPayloadParseSource,
    error?: unknown,
  ) => {
    const now = Date.now();
    const failure = buildWorkspaceProjectPayloadParseFailure(source, error);
    const reason = formatWorkspaceBootstrapLocalStateError(
      failure.localStateSource,
      failure.details,
      failure.fallback,
    );
    applyProjectBootstrapMessages((prev) => [...prev, {
      id: `project-payload-parse-failed-${source}-${now}`,
      role: 'assistant',
      content: source === 'url'
        ? `URL 项目数据解析失败：${reason}。当前链接中的项目快照无法直接恢复；系统会继续尝试本地 Workspace 快照，若仍不可用请返回项目列表重新打开。`
        : `本地 Workspace 快照解析失败：${reason}。已清理损坏的本地项目快照，当前项目无法从本地缓存自动恢复；请返回项目列表重新打开。`,
      timestamp: new Date().toISOString(),
    }]);
  }, [applyProjectBootstrapMessages]);

  const appendInitialPreviewUrlBuildFailureMessage = useCallback((
    projectId: string,
    result: ProjectPreviewUrlBuildResult,
  ) => {
    const shouldAppendFailure = shouldAppendWorkspaceBootstrapPreviewBuildFailure(result);
    if (shouldAppendFailure === false) return;
    const reasonMessage = formatPreviewUrlBuildFailure(result);
    const buildFailureStatus = (surface: WorkspacePreviewUrlSurface, currentUrl: string): PreviewUrlStatus =>
      buildPreviewUrlBuildFailureStatus({
        surface,
        currentUrl,
        failurePrefix: '初始 Preview URL 构建失败',
        reasonMessage,
      });
    setPreviewUrlStatus((prev) => buildFailureStatus('desktop', getWorkspaceBootstrapPreviewStatusUrl(prev)));
    setMobilePreviewUrlStatus((prev) => buildFailureStatus('mobile', getWorkspaceBootstrapPreviewStatusUrl(prev)));
    applyProjectBootstrapMessages((prev) => {
      const messageId = `initial-preview-url-build-failed-${projectId}`;
      const hasMessage = hasWorkspaceBootstrapMessage(prev, messageId);
      if (hasMessage === true) return prev;
      return [
        ...prev,
        {
          id: messageId,
          role: 'assistant',
          content: `初始 Preview URL 构建失败：${reasonMessage}当前 Workspace 已继续恢复项目、消息和文件树，但 Preview 面板可能保持空白或旧地址；请检查同源 /preview/ 代理、Preview Gateway 内部配置，或等待后端运行时状态返回明确 previewUrl 后刷新。`,
          timestamp: new Date().toISOString(),
        },
      ];
    });
  }, [applyProjectBootstrapMessages, setMobilePreviewUrlStatus, setPreviewUrlStatus]);

  const appendLocalWorkspaceProjectSnapshotAccessFailureMessage = useCallback((
    failure: WorkspaceLocalProjectSnapshotFailure<WorkspaceLocalProjectSnapshotOperation>,
    projectId?: string,
  ) => {
    const reason = formatWorkspaceLocalProjectSnapshotFailure(failure);
    const messageId = projectId
      ? `local-workspace-project-snapshot-${failure.operation}-failed-${projectId}`
      : `local-workspace-project-snapshot-${failure.operation}-failed`;
    applyProjectBootstrapMessages((prev) => {
      const hasMessage = hasWorkspaceBootstrapMessage(prev, messageId);
      if (hasMessage === true) return prev;
      return [...prev, {
        id: messageId,
        role: 'assistant',
        content: failure.operation === 'read'
          ? `本地 Workspace 项目快照读取失败：${reason}。系统无法确认浏览器中的 yistack_current_project 是否可作为兜底；当前会继续依赖 URL projectId 或后端项目详情恢复，若仍不可用请返回项目列表重新打开。`
          : `本地 Workspace 项目快照清理失败：${reason}。当前 Workspace 会继续使用已恢复的项目状态，但浏览器里的 yistack_current_project 可能仍是旧快照；如果稍后从本地入口恢复到旧项目，请返回项目列表重新打开最新项目。`,
        timestamp: new Date().toISOString(),
      }];
    });
  }, [applyProjectBootstrapMessages]);

  const appendPendingWorkspaceNavigationAccessFailureMessage = useCallback((
    failure: WorkspacePendingNavigationLocalFailure<WorkspacePendingNavigationOperation>,
    projectId?: string,
  ) => {
    const reason = formatWorkspacePendingNavigationLocalFailure(
      {
        ...failure,
        cleanupDetails: undefined,
      },
      '浏览器拒绝访问 Workspace 跳转保护状态',
    );
    const cleanupSuffix = failure.cleanupDetails
      ? `；损坏跳转保护清理也失败：${formatWorkspacePendingNavigationLocalFailure(
        {
          ...failure,
          operation: 'parse_cleanup',
          details: failure.cleanupDetails,
          cleanupDetails: undefined,
        },
        '浏览器拒绝清理 Workspace 跳转保护状态',
      )}`
      : '';
    const messageId = projectId
      ? `pending-workspace-navigation-${failure.operation}-failed-${projectId}`
      : `pending-workspace-navigation-${failure.operation}-failed`;
    applyProjectBootstrapMessages((prev) => {
      const hasMessage = hasWorkspaceBootstrapMessage(prev, messageId);
      if (hasMessage === true) return prev;
      return [...prev, {
        id: messageId,
        role: 'assistant',
        content: failure.operation === 'clear'
          ? `Workspace 跳转保护清理失败：${reason}。当前项目会继续按 URL projectId、后端项目详情或本地快照恢复，但浏览器里的 yistack_pending_workspace_navigation 可能仍残留；如果稍后认证跳转或刷新行为看起来仍沿用旧入口，请以当前地址栏和后端项目详情为准。`
          : `Workspace 跳转保护读取失败：${reason}。系统无法确认 yistack_pending_workspace_navigation 是否仍在有效窗口内；当前会保留页面状态并继续依赖 URL projectId、后端项目详情或本地项目快照恢复，避免把无法确认的跳转保护误判为可安全返回首页${cleanupSuffix}。`,
        timestamp: new Date().toISOString(),
      }];
    });
  }, [applyProjectBootstrapMessages]);

  const clearPendingWorkspaceNavigationWithNotice = useCallback((projectId?: string) => {
    const clearResult = clearPendingWorkspaceNavigation();
    const isClearReady = isPendingWorkspaceNavigationClearReady(clearResult);
    if (isClearReady === false) {
      appendPendingWorkspaceNavigationAccessFailureMessage(
        clearResult,
        projectId,
      );
    }
  }, [appendPendingWorkspaceNavigationAccessFailureMessage, clearPendingWorkspaceNavigation]);

  const appendWorkspaceTransientUrlCleanupFailureMessage = useCallback((
    projectId: string,
    failure: WorkspaceTransientUrlLocalFailure,
  ) => {
    const reason = formatWorkspaceTransientUrlCleanupFailure(failure);
    const messageId = `workspace-transient-url-cleanup-failed-${projectId}`;
    applyProjectBootstrapMessages((prev) => {
      const hasMessage = hasWorkspaceBootstrapMessage(prev, messageId);
      if (hasMessage === true) return prev;
      return [...prev, {
        id: messageId,
        role: 'assistant',
        content: `Workspace 临时 URL 状态清理失败：${reason}。首页或项目列表传入的本地持久化失败状态已经在消息流中提示，但地址栏里的 home_*_status/details 或 project_list_snapshot_status/details 参数可能仍会残留；如果刷新后再次看到相同旧提示，请以当前 projectId 的后端项目状态为准，并可手动移除这些临时参数。`,
        timestamp: new Date().toISOString(),
      }];
    });
  }, [applyProjectBootstrapMessages]);

  const appendProjectBootstrapFileTreeParseFailureMessage = useCallback((
    projectId: string,
    error?: unknown,
  ) => {
    const now = Date.now();
    applyProjectBootstrapMessages((prev) => [...prev, {
      id: `project-bootstrap-file-tree-parse-failed-${projectId}-${now}`,
      role: 'assistant',
      content: `项目初始文件树解析失败：${formatProjectBootstrapFileTreeParseFailure(error)}。项目元信息、方案、Preview URL 或运行时字段已继续恢复，但初始 Explorer 可能为空或仍是旧快照；你可以稍后刷新文件树或重新进入 Workspace，已打开文件的本地编辑内容不会因此丢失。`,
      timestamp: new Date().toISOString(),
    }]);
  }, [applyProjectBootstrapMessages]);

  const appendHomeNavigationPersistenceFailureMessages = useCallback((projectId: string) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const projectSnapshotFailed = hasWorkspaceBootstrapUrlFailureStatus(url, homeProjectSnapshotStatusParam);
    const projectSnapshotDetails = getWorkspaceBootstrapUrlSearchParamText(
      url,
      homeProjectSnapshotDetailsParam,
      '浏览器未能写入本地 yistack_current_project',
    );
    const pendingNavigationFailed = hasWorkspaceBootstrapUrlFailureStatus(url, homePendingNavigationStatusParam);
    const pendingNavigationDetails = getWorkspaceBootstrapUrlSearchParamText(
      url,
      homePendingNavigationDetailsParam,
      '浏览器未能写入本地 pending navigation 状态',
    );
    const homeDraftCleanupFailed = hasWorkspaceBootstrapUrlFailureStatus(url, homeDraftCleanupStatusParam);
    const homeDraftCleanupDetails = getWorkspaceBootstrapUrlSearchParamText(
      url,
      homeDraftCleanupDetailsParam,
      '浏览器未能删除本地 yistack_home_draft',
    );
    const projectListSnapshotFailed = hasWorkspaceBootstrapUrlFailureStatus(url, projectListSnapshotStatusParam);
    const projectListSnapshotDetails = getWorkspaceBootstrapUrlSearchParamText(
      url,
      projectListSnapshotDetailsParam,
      '浏览器未能写入本地 yistack_current_project',
    );
    const hasPersistenceFailure = hasWorkspaceBootstrapHomeNavigationPersistenceFailure({
      projectSnapshotFailed,
      pendingNavigationFailed,
      homeDraftCleanupFailed,
      projectListSnapshotFailed,
    });
    if (hasPersistenceFailure === false) return;

    const messagesToAppend: WorkspaceChatMessage[] = [];
    const now = Date.now();
    if (projectSnapshotFailed === true) {
      const failure = buildHomeEntryLocalStateFailureFromDetails(
        'local_storage',
        projectSnapshotDetails,
      );
      const reason = formatHomeEntryLocalStateFailure(
        failure,
        '浏览器未能写入本地 yistack_current_project',
      );
      messagesToAppend.push({
        id: `home-project-snapshot-save-failed-${projectId}`,
        role: 'assistant',
        content: `首页项目快照保存失败：${reason}。项目已通过当前 projectId 链接进入 Workspace 并会继续从后端恢复；但刷新或从本地入口重新进入时，可能无法依赖首页保存的本地项目快照。`,
        timestamp: new Date(now).toISOString(),
      });
    }
    if (pendingNavigationFailed === true) {
      const failure = buildHomeEntryLocalStateFailureFromDetails(
        'session_storage',
        pendingNavigationDetails,
      );
      const reason = formatHomeEntryLocalStateFailure(
        failure,
        '浏览器未能写入本地 pending navigation 状态',
      );
      messagesToAppend.push({
        id: `home-pending-navigation-save-failed-${projectId}`,
        role: 'assistant',
        content: `首页 Workspace 跳转保护保存失败：${reason}。当前已通过 projectId 进入 Workspace；如果跳转过程中被认证或页面刷新打断，系统可能无法用本地跳转保护判断这次跳转仍在有效窗口内。`,
        timestamp: new Date(now + messagesToAppend.length).toISOString(),
      });
    }
    if (homeDraftCleanupFailed === true) {
      const failure = buildHomeEntryLocalStateFailureFromDetails(
        'session_storage',
        homeDraftCleanupDetails,
      );
      const reason = formatHomeEntryLocalStateFailure(
        failure,
        '浏览器未能删除本地 yistack_home_draft',
      );
      messagesToAppend.push({
        id: `home-draft-cleanup-failed-${projectId}`,
        role: 'assistant',
        content: `首页草稿清理失败：${reason}。当前项目已通过 projectId 进入 Workspace 并会继续从后端恢复；但如果稍后返回首页，旧需求草稿可能仍会显示，请以当前 Workspace 项目状态为准。`,
        timestamp: new Date(now + messagesToAppend.length).toISOString(),
      });
    }
    if (projectListSnapshotFailed === true) {
      const failure = buildProjectListSnapshotPersistenceFailureFromDetails(
        projectListSnapshotDetails,
      );
      const reason = formatProjectListSnapshotPersistenceFailure(
        failure,
        '浏览器未能写入本地 yistack_current_project',
      );
      messagesToAppend.push({
        id: `project-list-snapshot-save-failed-${projectId}`,
        role: 'assistant',
        content: `项目列表快照保存失败：${reason}。当前已通过 projectId 进入 Workspace 并会继续从后端恢复；但刷新或从本地入口重新进入时，可能无法依赖项目列表写入的本地项目快照。`,
        timestamp: new Date(now + messagesToAppend.length).toISOString(),
      });
    }

    applyProjectBootstrapMessages((prev) => {
      const nextMessages = getWorkspaceBootstrapNewMessages(prev, messagesToAppend);
      return nextMessages.length > 0 ? [...prev, ...nextMessages] : prev;
    });

    url.searchParams.delete(homeProjectSnapshotStatusParam);
    url.searchParams.delete(homeProjectSnapshotDetailsParam);
    url.searchParams.delete(homePendingNavigationStatusParam);
    url.searchParams.delete(homePendingNavigationDetailsParam);
    url.searchParams.delete(homeDraftCleanupStatusParam);
    url.searchParams.delete(homeDraftCleanupDetailsParam);
    url.searchParams.delete(projectListSnapshotStatusParam);
    url.searchParams.delete(projectListSnapshotDetailsParam);
    const cleanupResult = replaceWorkspaceTransientStatusUrl(url);
    const isCleanupReady = isWorkspaceTransientStatusUrlCleanupReady(cleanupResult);
    if (isCleanupReady === false) {
      appendWorkspaceTransientUrlCleanupFailureMessage(projectId, cleanupResult);
    }
  }, [appendWorkspaceTransientUrlCleanupFailureMessage, applyProjectBootstrapMessages]);

  const initializeProject = useCallback((data: InitializeProjectPayload, options?: WorkspaceBootstrapProjectInitializeOptions) => {
    clearPendingWorkspaceNavigationWithNotice(data.projectId);
    const isInitializedProject = isWorkspaceBootstrapInitializedProject(
      initializedProjectIdRef.current,
      data.projectId,
    );
    const isPersistedProject = isWorkspaceBootstrapPersistedProject(data);

    setProjectInfo({
      projectId: data.projectId,
      projectName: data.projectName,
      description: data.description,
      appType: data.appType,
      initialMessage: data.initialMessage,
      techStack: data.techStack,
      planId: data.planId,
      planData: data.planData,
      containerPort: data.containerPort,
      previewUrl: data.previewUrl,
      containerStatus: data.containerStatus,
      gitBranch: data.gitBranch,
      runtimeStatus: data.runtimeStatus,
      engineeringState: data.engineeringState,
      isPersisted: isPersistedProject,
    });

    if (isInitializedProject === false) {
      initializedProjectIdRef.current = data.projectId;
      restoredProjectIdRef.current = null;
      setMessageRestoreStatus('not_started');
      planningProjectIdRef.current = null;
      resetWorkspaceRuntimeBootstrapState(data.projectId);
      const hasSelectedPlan = hasWorkspaceBootstrapProjectTextValue(data.planId);
      const hasPlanData = hasWorkspaceBootstrapProjectTextValue(data.planData);
      if (hasSelectedPlan === true || hasPlanData === true) {
        plannedProjectIdsRef.current.add(data.projectId);
        plannedProjectIdsAcrossMounts.add(data.projectId);
      } else {
        plannedProjectIdsRef.current.delete(data.projectId);
        plannedProjectIdsAcrossMounts.delete(data.projectId);
      }
      autoPlanTriggeredRef.current = false;
      const sessionSnapshot = readWorkspaceSessionSnapshot(data.projectId);
      const hasSessionSnapshot = hasWorkspaceBootstrapSessionSnapshot(sessionSnapshot);
      if (hasSessionSnapshot === true) {
        applyWorkspaceState(sessionSnapshot.messages, {
          availablePlans: sessionSnapshot.availablePlans,
          recommendedPlanId: sessionSnapshot.recommendedPlanId,
          selectedPlanId: getWorkspaceBootstrapSelectedPlanId(sessionSnapshot.selectedPlanId, data.planId),
          planCountdown: sessionSnapshot.planCountdown,
          planAutoConfirmDeadlineAt: sessionSnapshot.planAutoConfirmDeadlineAt,
          planSelectionReady: sessionSnapshot.planSelectionReady,
        });
      } else {
        applyWorkspaceState(buildInitialWorkspaceMessages(data), {
          selectedPlanId: getWorkspaceBootstrapSelectedPlanId(null, data.planId),
          planAutoConfirmDeadlineAt: null,
          planSelectionReady: false,
        });
      }

      const editorState = getWorkspaceSessionSnapshotEditorState(sessionSnapshot);
      if (editorState !== null) {
        const restoredOpenFiles = materializeWorkspaceBootstrapOpenFiles(editorState.openFiles);
        setOpenFiles(restoredOpenFiles);
        setActiveFile(getWorkspaceBootstrapRestoredActiveFile({
          activeFile: editorState.activeFile,
          openFiles: restoredOpenFiles,
        }));
        setFiles(materializeWorkspaceBootstrapFileMap(editorState.files));
        setSavedFiles(materializeWorkspaceBootstrapFileMap(editorState.savedFiles));
        setEditorBufferStatuses(materializeWorkspaceBootstrapEditorStatusMap(editorState.editorBufferStatuses));
        setExpandedFolders(materializeWorkspaceBootstrapExpandedFolderSet(editorState.expandedFolders));
        setSearchQuery(editorState.searchQuery);
        setPendingCloseFile(editorState.pendingCloseFile);
      } else {
        setOpenFiles([]);
        setActiveFile(null);
        setFiles(new Map());
        setSavedFiles(new Map());
        setEditorBufferStatuses(new Map());
        setExpandedFolders(new Set());
        setSearchQuery('');
        setPendingCloseFile(null);
      }

      const fileTreePayload = getWorkspaceBootstrapInitializeFileTreePayload(data);
      const hasFileTreePayload = hasWorkspaceBootstrapProjectFileTreePayload(fileTreePayload);
      if (hasFileTreePayload === true) {
        const normalizedTree = normalizeFileTreePayload(fileTreePayload as FileNode | FileNode[]);
        setFileTree(normalizedTree);
        setExplorerSnapshotStatus(buildFreshExplorerSnapshotStatus({
          source: 'workspace_bootstrap',
          itemCount: normalizedTree.length,
        }));
        const hasExpandedFileTree = hasWorkspaceBootstrapExpandedFileTree(normalizedTree);
        if (hasExpandedFileTree === true) {
          setExpandedFolders((prev) => {
            const next = new Set(prev);
            next.add('');
            return next;
          });
        }
      }

      const runtimePreviewUrl = getWorkspaceBootstrapRuntimePreviewUrl(data.runtimeStatus);
      const previewSourceUrl = getWorkspaceBootstrapPreviewSourceUrl({
        previewUrl: data.previewUrl,
        runtimePreviewUrl,
      });
      const shouldSyncPreviewUrl = shouldSyncWorkspaceBootstrapPreviewUrl({
        previewSourceUrl,
        appType: data.appType,
      });
      if (shouldSyncPreviewUrl === true) {
        const previewResult = buildProjectPreviewUrlResult(data.projectId, previewSourceUrl);
        const isPreviewReady = isWorkspaceBootstrapPreviewBuildReady(previewResult);
        if (isPreviewReady === true) {
          setBrowserUrl(previewResult.url);
          setPreviewUrlStatus(buildWorkspaceBootstrapPreviewUrlStatus({ surface: 'desktop', value: previewResult.url }));
          setMobileBrowserUrl(previewResult.url);
          setMobilePreviewUrlStatus(buildWorkspaceBootstrapPreviewUrlStatus({ surface: 'mobile', value: previewResult.url }));
        } else {
          appendInitialPreviewUrlBuildFailureMessage(data.projectId, previewResult);
        }
      }
    }

    const shouldRefreshProjectDetail = shouldRefreshWorkspaceBootstrapProjectDetail({
      isPersistedProject,
      options,
    });
    if (shouldRefreshProjectDetail === true) {
      void fetchProjectDetail(data.projectId);
    }
  }, [
    applyWorkspaceState,
    autoPlanTriggeredRef,
    buildInitialWorkspaceMessages,
    appendInitialPreviewUrlBuildFailureMessage,
    buildProjectPreviewUrlResult,
    clearPendingWorkspaceNavigationWithNotice,
    fetchProjectDetail,
    initializedProjectIdRef,
    normalizeFileTreePayload,
    plannedProjectIdsAcrossMounts,
    plannedProjectIdsRef,
    planningProjectIdRef,
    readWorkspaceSessionSnapshot,
    resetWorkspaceRuntimeBootstrapState,
    restoredProjectIdRef,
    setActiveFile,
    setBrowserUrl,
    setEditorBufferStatuses,
    setExplorerSnapshotStatus,
    setExpandedFolders,
    setFiles,
    setFileTree,
    setMobileBrowserUrl,
    setMobilePreviewUrlStatus,
    setOpenFiles,
    setPendingCloseFile,
    setPreviewUrlStatus,
    setProjectInfo,
    setSavedFiles,
    setSearchQuery,
  ]);

  const fetchProjectAndInit = useCallback(async (projectId: string) => {
    try {
      const project = await projectApi.get(projectId);
      let restoredFileTree: FileNode | FileNode[] | undefined;
      const hasFileTreePayload = hasWorkspaceBootstrapProjectFileTreePayload(project.file_tree);
      if (hasFileTreePayload === true) {
        const parsedFileTree = readWorkspaceBootstrapProjectFileTree(project.file_tree, safeParseJSON);
        const hasParsedFileTree = hasWorkspaceBootstrapParsedFileTree(parsedFileTree);
        if (hasParsedFileTree === true) {
          restoredFileTree = parsedFileTree;
        } else {
          appendProjectBootstrapFileTreeParseFailureMessage(
            projectId,
            buildProjectBootstrapFileTreeParseError(projectId),
          );
        }
      }
      initializeProject({
        projectId: project.project_id,
        projectName: getWorkspaceBootstrapProjectNameValue(project.name),
        description: getWorkspaceBootstrapProjectTextValue(project.description, ''),
        appType: getWorkspaceBootstrapProjectAppTypeValue(project.app_type),
        initialMessage: getWorkspaceBootstrapProjectInitialMessage({
          description: project.description,
          planId: project.plan_id,
          planData: project.plan_data,
        }),
        fileTree: restoredFileTree,
        containerPort: getWorkspaceBootstrapProjectNumberValue(project.container_port, 0),
        previewUrl: getWorkspaceBootstrapProjectTextValue(project.preview_url, ''),
        containerStatus: getWorkspaceBootstrapProjectTextValue(project.container_status, ''),
        gitBranch: getWorkspaceBootstrapProjectTextValue(project.git_branch, ''),
        runtimeStatus: undefined,
        engineeringState: normalizeWorkspaceEngineeringState(project.engineering_state),
        techStack: getWorkspaceBootstrapProjectTextValue(project.tech_stack, ''),
        planId: getWorkspaceBootstrapProjectTextValue(project.plan_id, ''),
        planData: getWorkspaceBootstrapProjectTextValue(project.plan_data, ''),
        isPersisted: true,
        directoryPath: getWorkspaceBootstrapProjectTextValue(project.directory_path, ''),
      }, { skipDetailRefresh: true });
      return;
    } catch (error) {
      const storedResult = readLocalWorkspaceProjectSnapshot();
      const isStoredResultReady = isLocalWorkspaceProjectSnapshotReadReady(storedResult);
      if (isStoredResultReady === false) {
        appendLocalWorkspaceProjectSnapshotAccessFailureMessage(
          storedResult,
          projectId,
        );
        appendProjectRestoreFailureMessage(projectId, error, false);
        return;
      }
      const storedSnapshotRaw = storedResult.raw;
      const hasStoredSnapshotRaw = hasLocalWorkspaceProjectSnapshotRaw(storedSnapshotRaw);
      if (hasStoredSnapshotRaw === false) {
        appendProjectRestoreFailureMessage(projectId, error, false);
        return;
      }

      const data = safeParseJSON<WorkspaceProjectInfo | null>(storedSnapshotRaw, null);
      const hasParsedProjectInfo = hasWorkspaceBootstrapParsedProjectInfo(data);
      if (hasParsedProjectInfo === true) {
        initializeProject({
          ...data,
          projectId: getWorkspaceBootstrapRestoredSnapshotProjectId(data.projectId, projectId),
          isPersisted: getWorkspaceBootstrapRestoredSnapshotPersistedValue(data.isPersisted),
        });
        appendProjectRestoreFailureMessage(projectId, error, true);
      } else {
        appendProjectRestoreFailureMessage(projectId, error, false);
      }
      const clearResult = clearLocalWorkspaceProjectSnapshot();
      const isClearReady = isLocalWorkspaceProjectSnapshotClearReady(clearResult);
      if (isClearReady === false) {
        appendLocalWorkspaceProjectSnapshotAccessFailureMessage(
          clearResult,
          projectId,
        );
      }
    }
  }, [
    appendLocalWorkspaceProjectSnapshotAccessFailureMessage,
    appendProjectBootstrapFileTreeParseFailureMessage,
    appendProjectRestoreFailureMessage,
    initializeProject,
    safeParseJSON,
  ]);

  useEffect(() => {
    const shouldSkipRouteEffect = shouldSkipWorkspaceBootstrapRouteEffect({
      authLoading,
      isAuthenticated,
    });
    if (shouldSkipRouteEffect === true) return;

    const hasRouteProjectId = hasWorkspaceBootstrapRouteProjectId(projectIdParam);
    if (hasRouteProjectId === true) {
      const isCurrentRouteProject = isWorkspaceBootstrapCurrentRouteProjectId(
        routeProjectIdRef.current,
        projectIdParam,
      );
      if (isCurrentRouteProject === true) return;
      routeProjectIdRef.current = projectIdParam;
      appendHomeNavigationPersistenceFailureMessages(projectIdParam);
      clearPendingWorkspaceNavigationWithNotice(projectIdParam);
      void fetchProjectAndInit(projectIdParam);
      return;
    }

    routeProjectIdRef.current = null;

    const hasRouteProjectPayload = hasWorkspaceBootstrapRouteProjectPayload(projectParam);
    if (hasRouteProjectPayload === true) {
      clearPendingWorkspaceNavigationWithNotice();
      try {
        const data = readWorkspaceBootstrapRouteProjectPayload(projectParam);
        initializeProject(data);
        return;
      } catch (error) {
        console.error('解析 URL 项目数据失败:', error);
        appendProjectPayloadParseFailureMessage('url', error);
      }
    }

    const storedResult = readLocalWorkspaceProjectSnapshot();
    const isStoredResultReady = isLocalWorkspaceProjectSnapshotReadReady(storedResult);
    if (isStoredResultReady === false) {
      appendLocalWorkspaceProjectSnapshotAccessFailureMessage(
        storedResult,
      );
      return;
    }
    const storedSnapshotRaw = storedResult.raw;
    const hasStoredSnapshotRaw = hasLocalWorkspaceProjectSnapshotRaw(storedSnapshotRaw);
    if (hasStoredSnapshotRaw === false) return;
    const data = safeParseJSON<WorkspaceProjectInfo | null>(storedSnapshotRaw, null);
    const hasParsedProjectInfo = hasWorkspaceBootstrapParsedProjectInfo(data);
    if (hasParsedProjectInfo === true) {
      const snapshotProjectId = getWorkspaceBootstrapSnapshotProjectId(data);
      const optionalSnapshotProjectId = getWorkspaceBootstrapOptionalSnapshotProjectId(snapshotProjectId);
      clearPendingWorkspaceNavigationWithNotice(optionalSnapshotProjectId);
      if (snapshotProjectId !== null) {
        void fetchProjectAndInit(snapshotProjectId);
      } else {
        initializeProject(data);
      }
      const shouldClearSnapshot = shouldClearWorkspaceBootstrapLocalSnapshot(data);
      if (shouldClearSnapshot === true) {
        const clearResult = clearLocalWorkspaceProjectSnapshot();
        const isClearReady = isLocalWorkspaceProjectSnapshotClearReady(clearResult);
        if (isClearReady === false) {
          appendLocalWorkspaceProjectSnapshotAccessFailureMessage(
            clearResult,
            optionalSnapshotProjectId,
          );
        }
      }
    } else {
      console.error('解析 localStorage 项目数据失败');
      appendProjectPayloadParseFailureMessage('localStorage');
      const clearResult = clearLocalWorkspaceProjectSnapshot();
      const isClearReady = isLocalWorkspaceProjectSnapshotClearReady(clearResult);
      if (isClearReady === false) {
        appendLocalWorkspaceProjectSnapshotAccessFailureMessage(
          clearResult,
        );
      }
    }
  }, [
    appendLocalWorkspaceProjectSnapshotAccessFailureMessage,
    appendHomeNavigationPersistenceFailureMessages,
    appendProjectPayloadParseFailureMessage,
    authLoading,
    clearPendingWorkspaceNavigationWithNotice,
    fetchProjectAndInit,
    initializeProject,
    isAuthenticated,
    projectIdParam,
    projectParam,
    routeProjectIdRef,
    safeParseJSON,
  ]);

  useEffect(() => {
    const shouldSkipLocalSnapshot = shouldSkipWorkspaceBootstrapLocalSnapshotEffect({
      hasMounted,
      authLoading,
      isAuthenticated,
      projectInfo,
      projectIdParam,
      projectParam,
    });
    if (shouldSkipLocalSnapshot === true) return;
    const pendingNavigationFreshResult = hasFreshPendingWorkspaceNavigation();
    const isPendingNavigationFreshReady = isPendingWorkspaceNavigationFreshReadReady(pendingNavigationFreshResult);
    if (isPendingNavigationFreshReady === false) {
      appendPendingWorkspaceNavigationAccessFailureMessage(
        pendingNavigationFreshResult,
        undefined,
      );
      return;
    }
    const hasFreshPendingNavigation = hasPendingWorkspaceNavigationFreshState(pendingNavigationFreshResult);
    if (hasFreshPendingNavigation === true) return;

    const storedResult = readLocalWorkspaceProjectSnapshot();
    const isStoredResultReady = isLocalWorkspaceProjectSnapshotReadReady(storedResult);
    if (isStoredResultReady === false) {
      appendLocalWorkspaceProjectSnapshotAccessFailureMessage(
        storedResult,
      );
      return;
    }
    const storedSnapshotRaw = storedResult.raw;
    const hasStoredSnapshotRaw = hasLocalWorkspaceProjectSnapshotRaw(storedSnapshotRaw);
    if (hasStoredSnapshotRaw === false) {
      routerReplaceHome();
    }
  }, [
    appendLocalWorkspaceProjectSnapshotAccessFailureMessage,
    appendPendingWorkspaceNavigationAccessFailureMessage,
    authLoading,
    hasMounted,
    hasFreshPendingWorkspaceNavigation,
    isAuthenticated,
    projectIdParam,
    projectInfo,
    projectParam,
    routerReplaceHome,
  ]);

  useEffect(() => {
    const persistedProject = getWorkspaceBootstrapPersistedProject(projectInfo);
    if (persistedProject === null) return;
    if (restoredProjectIdRef.current === persistedProject.projectId) return;

    let cancelled = false;
    const currentProjectId = persistedProject.projectId;
    const persistedPlanId = persistedProject.planId;

    const restoreWorkspaceMessages = async () => {
      setIsRestoringWorkspace(true);
      setMessageRestoreStatus('restoring');
      try {
        const historyMessages = await projectApi.getMessages(currentProjectId);
        if (isWorkspaceProjectBootstrapEffectActive(cancelled) === false) return;

        const snapshot = readWorkspaceSessionSnapshot(currentProjectId);
        if (historyMessages.length === 0) {
          restoredProjectIdRef.current = currentProjectId;
          const hasSessionMessages = hasWorkspaceBootstrapSessionMessages(snapshot);
          if (hasSessionMessages === true) {
            applyWorkspaceState(snapshot.messages, {
              availablePlans: snapshot.availablePlans,
              recommendedPlanId: snapshot.recommendedPlanId,
              selectedPlanId: getWorkspaceBootstrapSelectedPlanId(snapshot.selectedPlanId, persistedPlanId),
              planCountdown: snapshot.planCountdown,
              planAutoConfirmDeadlineAt: snapshot.planAutoConfirmDeadlineAt,
            });
            setMessageRestoreStatus('session_snapshot_restored');
          } else {
            setMessageRestoreStatus('empty_history_no_session');
          }
          return;
        }

        const restoredMessages = materializeWorkspaceBootstrapRestoredMessages({
          historyMessages,
          deserializeWorkspaceMessage,
        });
        const hasSessionMessages = hasWorkspaceBootstrapSessionMessages(snapshot);
        const sessionMessages = hasSessionMessages === true ? snapshot.messages : undefined;
        const preferredMessages = mergeRestoredWorkspaceMessages(restoredMessages, sessionMessages);
        const restoredPlanFlowState = resolveRestoredPlanFlowState(
          preferredMessages,
          snapshot,
          persistedPlanId,
        );
        const hasRestoredPlanState = hasWorkspaceBootstrapRestoredPlanState(
          restoredPlanFlowState.availablePlans,
          restoredPlanFlowState.selectedPlanId,
        );
        if (hasRestoredPlanState === true) {
          plannedProjectIdsRef.current.add(currentProjectId);
          plannedProjectIdsAcrossMounts.add(currentProjectId);
        }
        applyWorkspaceState(preferredMessages, restoredPlanFlowState);
        restoredProjectIdRef.current = currentProjectId;
        setMessageRestoreStatus('backend_history_restored');
      } catch (error) {
        if (isWorkspaceProjectBootstrapEffectActive(cancelled) === true) {
          console.error('恢复项目消息失败:', error);
          const snapshot = readWorkspaceSessionSnapshot(currentProjectId);
          const hasSessionMessages = hasWorkspaceBootstrapSessionMessages(snapshot);
          if (hasSessionMessages === true) {
            applyWorkspaceState(snapshot.messages, {
              availablePlans: snapshot.availablePlans,
              recommendedPlanId: snapshot.recommendedPlanId,
              selectedPlanId: getWorkspaceBootstrapSelectedPlanId(snapshot.selectedPlanId, persistedPlanId),
              planCountdown: snapshot.planCountdown,
              planAutoConfirmDeadlineAt: snapshot.planAutoConfirmDeadlineAt,
              planSelectionReady: snapshot.planSelectionReady,
            });
            appendWorkspaceMessagesRestoreFailureMessage(currentProjectId, error, true);
            setMessageRestoreStatus('restore_failed_session_snapshot');
          } else {
            appendWorkspaceMessagesRestoreFailureMessage(currentProjectId, error, false);
            setMessageRestoreStatus('restore_failed_no_snapshot');
          }
        }
      } finally {
        if (isWorkspaceProjectBootstrapEffectActive(cancelled) === true) {
          setIsRestoringWorkspace(false);
        }
      }
    };

    void restoreWorkspaceMessages();

    return () => {
      cancelled = true;
    };
  }, [appendWorkspaceMessagesRestoreFailureMessage, applyWorkspaceState, deserializeWorkspaceMessage, plannedProjectIdsAcrossMounts, plannedProjectIdsRef, projectInfo, readWorkspaceSessionSnapshot, restoredProjectIdRef]);

  return {
    isRestoringWorkspace,
    messageRestoreStatus,
  };
}
