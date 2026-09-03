'use client';

import type { ReactNode } from 'react';
import type { IDETab } from './workspace-types';
import { TerminalPanel } from '@/components/terminal';
import { cn } from '@/lib/utils';
import {
  DesktopDebugPanel,
  DesktopExplorerPanel,
  DesktopFoundationPanel,
  DesktopGitPanel,
  DesktopPreviewDeviceControls,
  DesktopPreviewPanel,
  MobileDebugPanel,
  MobileExplorerEditor,
  MobileExplorerList,
  MobileFoundationPanel,
  MobileGitPanel,
  MobilePreviewPanel,
  type DesktopIdeProps,
  type MobileIdeProps,
} from './workspace-ide-subpanels';
import {
  buildWorkspaceGitTabBadgeSnapshot,
  buildWorkspaceIdeShellSnapshot,
  WorkspaceGitTabBadgeSnapshotStrip,
  WorkspaceIdeShellSnapshotStrip,
} from './workspace-ide-shell-snapshot';
import type { WorkspaceGitTabBadgeSnapshot } from './workspace-types';

type WorkspaceIdeTabNodeList = ReactNode[];
type WorkspaceIdeTabSelectAction = (tabId: IDETab) => void;
type WorkspaceDesktopIdeTabList = DesktopIdeProps['tabs'];
type WorkspaceMobileIdeTabList = MobileIdeProps['tabs'];

function hasWorkspaceIdePanelTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }
  const hasValue = value.length > 0;
  return hasValue === true;
}

function shouldRenderWorkspaceIdeGitTabBadge(tabId: IDETab): boolean {
  const shouldRenderGitTabBadge = tabId === 'git';
  return shouldRenderGitTabBadge === true;
}

function materializeWorkspaceDesktopIdeTabNodes({
  tabs,
  activeTab,
  gitTabBadgeSnapshot,
  onSelectTab,
}: {
  tabs: WorkspaceDesktopIdeTabList;
  activeTab: IDETab;
  gitTabBadgeSnapshot: WorkspaceGitTabBadgeSnapshot;
  onSelectTab: WorkspaceIdeTabSelectAction;
}): WorkspaceIdeTabNodeList {
  const nodes: WorkspaceIdeTabNodeList = [];

  for (const tab of tabs) {
    const tabButtonToneClassName = getWorkspaceIdeTabButtonToneClassName({
      activeTab,
      tabId: tab.id,
      surface: 'desktop',
    });

    nodes.push(
      <button
        key={tab.id}
        onClick={() => onSelectTab(tab.id)}
        className={cn('h-full border-b-2 px-4 text-sm flex items-center gap-2 transition-colors', tabButtonToneClassName)}
      >
        {tab.icon}
        <span>{tab.label}</span>
        {shouldRenderWorkspaceIdeGitTabBadge(tab.id) === true && <WorkspaceGitTabBadgeSnapshotStrip snapshot={gitTabBadgeSnapshot} />}
      </button>,
    );
  }

  return nodes;
}

function materializeWorkspaceMobileIdeTabNodes({
  tabs,
  activeTab,
  gitTabBadgeSnapshot,
  onSelectTab,
}: {
  tabs: WorkspaceMobileIdeTabList;
  activeTab: IDETab;
  gitTabBadgeSnapshot: WorkspaceGitTabBadgeSnapshot;
  onSelectTab: WorkspaceIdeTabSelectAction;
}): WorkspaceIdeTabNodeList {
  const nodes: WorkspaceIdeTabNodeList = [];

  for (const tab of tabs) {
    const tabButtonToneClassName = getWorkspaceIdeTabButtonToneClassName({
      activeTab,
      tabId: tab.id,
      surface: 'mobile',
    });

    nodes.push(
      <button
        key={tab.id}
        onClick={() => onSelectTab(tab.id)}
        className={cn('h-full whitespace-nowrap border-b-2 px-3 text-xs flex items-center gap-1.5 transition-colors', tabButtonToneClassName)}
      >
        {tab.icon}
        <span>{tab.label}</span>
        {shouldRenderWorkspaceIdeGitTabBadge(tab.id) === true && <WorkspaceGitTabBadgeSnapshotStrip snapshot={gitTabBadgeSnapshot} />}
      </button>,
    );
  }

  return nodes;
}

function shouldRenderWorkspaceIdeDebugPanel(activeTab: IDETab): boolean {
  const shouldRenderDebugPanel = activeTab === 'debug';
  return shouldRenderDebugPanel === true;
}

function shouldRenderWorkspaceIdeExplorerPanel(activeTab: IDETab): boolean {
  const shouldRenderExplorerPanel = activeTab === 'explorer';
  return shouldRenderExplorerPanel === true;
}

function shouldRenderWorkspaceIdeFoundationPanel(activeTab: IDETab): boolean {
  const isInternalFoundationTab = activeTab === 'foundation';
  if (isInternalFoundationTab === true) {
    return false;
  }

  return false;
}

function shouldRenderWorkspaceIdePreviewPanel(activeTab: IDETab): boolean {
  const shouldRenderPreviewPanel = activeTab === 'preview';
  return shouldRenderPreviewPanel === true;
}

function shouldRenderWorkspaceIdeGitPanel(activeTab: IDETab): boolean {
  const shouldRenderGitPanel = activeTab === 'git';
  return shouldRenderGitPanel === true;
}

function shouldRenderWorkspaceIdeTerminalPanel(activeTab: IDETab): boolean {
  const shouldRenderTerminalPanel = activeTab === 'terminal';
  return shouldRenderTerminalPanel === true;
}

type WorkspaceIdeTabButtonSurface = 'desktop' | 'mobile';

function isWorkspaceIdeTabActive(activeTab: IDETab, tabId: IDETab): boolean {
  const isTabActive = activeTab === tabId;
  return isTabActive === true;
}

function getWorkspaceIdeTabButtonToneClassName({
  activeTab,
  tabId,
  surface,
}: {
  activeTab: IDETab;
  tabId: IDETab;
  surface: WorkspaceIdeTabButtonSurface;
}): string {
  const isTabActive = isWorkspaceIdeTabActive(activeTab, tabId);
  if (isTabActive === true) {
    return 'border-primary bg-background text-foreground';
  }

  if (surface === 'desktop') {
    return 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground';
  }

  return 'border-transparent text-muted-foreground hover:text-foreground';
}

function getWorkspaceIdeTerminalPanelVisibilityClassName(shouldRenderTerminalPanel: boolean): string {
  if (shouldRenderTerminalPanel === true) {
    return 'block';
  }

  return 'hidden';
}

function shouldRenderWorkspaceIdeMobileExplorerList(activeTab: IDETab, mobileEditingFile: string | null): boolean {
  const shouldRenderExplorerPanel = shouldRenderWorkspaceIdeExplorerPanel(activeTab);
  const hasMobileEditingFile = hasWorkspaceIdePanelTextValue(mobileEditingFile);
  const shouldRenderExplorerList = shouldRenderExplorerPanel === true && hasMobileEditingFile === false;
  return shouldRenderExplorerList === true;
}

function shouldRenderWorkspaceIdeMobileExplorerEditor(activeTab: IDETab, mobileEditingFile: string | null): boolean {
  const shouldRenderExplorerPanel = shouldRenderWorkspaceIdeExplorerPanel(activeTab);
  const hasMobileEditingFile = hasWorkspaceIdePanelTextValue(mobileEditingFile);
  const shouldRenderExplorerEditor = shouldRenderExplorerPanel === true && hasMobileEditingFile === true;
  return shouldRenderExplorerEditor === true;
}

function getWorkspaceIdeMobileExplorerEditorFile(mobileEditingFile: string | null): string {
  const hasMobileEditingFile = hasWorkspaceIdePanelTextValue(mobileEditingFile);
  if (hasMobileEditingFile === false) {
    return '';
  }
  return mobileEditingFile;
}

function shouldRenderWorkspaceIdeDesktopFileCount(filesSize: number): boolean {
  const shouldRenderFileCount = filesSize > 0;
  return shouldRenderFileCount === true;
}

function getWorkspaceIdePanelLastFileNameSegment(fileNameSegments: string[]): string | undefined {
  let lastSegment: string | undefined;

  for (const segment of fileNameSegments) {
    lastSegment = segment;
  }

  return lastSegment;
}

function getWorkspaceIdeActiveFileTypeLabel(activeFile: string | null): string {
  const hasActiveFile = hasWorkspaceIdePanelTextValue(activeFile);
  if (hasActiveFile === false) {
    return 'No file';
  }
  const fileNameSegments = activeFile.split('.');
  const fileExtension = getWorkspaceIdePanelLastFileNameSegment(fileNameSegments);
  const hasFileExtension = hasWorkspaceIdePanelTextValue(fileExtension);
  if (hasFileExtension === false) {
    return 'Text';
  }
  return fileExtension.toUpperCase();
}

export function WorkspaceDesktopIde({
  tabs,
  activeTab,
  gitBranch,
  gitBranches,
  gitBranchListStatus,
  gitRemotes,
  gitRemoteListStatus,
  gitRemoteBranches,
  gitRemoteBranchListStatus,
  gitTags,
  gitTagListStatus,
  gitStashes,
  gitStashListStatus,
  gitWorktreeStatus,
  gitWorktreeStatusState,
  gitBranchCompare,
  gitBranchCompareStatus,
  gitBranchCompareTarget,
  gitBranchSwitchReadiness,
  gitCommits,
  gitCommitListStatus,
  browserDevice,
  previewDeviceStyle,
  browserUrl,
  previewUrlStatus,
  previewReloadToken,
  runtimeStatus,
  canVisualEdit,
  onSubmitVisualEdit,
  searchQuery,
  filteredTree,
  hasOriginalFileTreeData,
  explorerSnapshotStatus,
  expandedFolders,
  activeFile,
  editorNavigationTarget,
  openFiles,
  filesSize,
  activeFileContent,
  activeFileBufferStatus,
  selectedCommit,
  gitCommitDetailStatus,
  projectId,
  engineeringState,
  contextGateResult,
  foundationActionLabel,
  foundationStatusLabel,
  monacoEditor,
  onSelectTab,
  onSetBrowserDevice,
  onChangeBrowserUrl,
  onOpenRuntimeHomeUrl,
  onRecoverRuntime,
  onExportProject,
  onSearchQueryChange,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
  isFileDirty,
  onSelectOpenFile,
  onEditorNavigationHandled,
  onRequestCloseFile,
  onSaveActiveFile,
  onCopyActiveFile,
  onUpdateActiveFileContent,
  onSelectGitBranchCompareTarget,
  onCreateGitBranch,
  onCreateGitTag,
  onDeleteGitTag,
  onCreateGitBranchFromRemote,
  onRefreshGitPanel,
  onRefreshGitRemoteBranches,
  onDeleteGitBranch,
  onRenameGitBranch,
  onSwitchGitBranch,
  onOpenFile,
  onCopyText,
  onRestoreCommitFile,
  onCommitWorktree,
  onDiscardWorktreeFile,
  onApplyGitBranchCompareFile,
  onCreateGitStash,
  onApplyGitStash,
  onStartFoundation,
  onOpenFoundationFile,
  onConfirmFoundationDecisions,
  onViewCommit,
}: DesktopIdeProps) {
  const ideShellSnapshot = buildWorkspaceIdeShellSnapshot({
    tabs,
    activeTab,
    projectId,
    surface: 'desktop',
    fileCount: filesSize,
    gitCommitCount: gitCommits.length,
  });
  const gitTabBadgeSnapshot = buildWorkspaceGitTabBadgeSnapshot({
    surface: 'desktop',
    gitCommits,
    gitCommitListStatus,
    selectedCommit,
    gitCommitDetailStatus,
  });
  const shouldRenderDesktopExplorerPanel = shouldRenderWorkspaceIdeExplorerPanel(activeTab);
  const shouldRenderDesktopFoundationPanel = shouldRenderWorkspaceIdeFoundationPanel(activeTab);
  const shouldRenderDesktopPreviewPanel = shouldRenderWorkspaceIdePreviewPanel(activeTab);
  const shouldRenderDesktopGitPanel = shouldRenderWorkspaceIdeGitPanel(activeTab);
  const shouldRenderDesktopTerminalPanel = shouldRenderWorkspaceIdeTerminalPanel(activeTab);
  const shouldRenderDesktopDebugPanel = shouldRenderWorkspaceIdeDebugPanel(activeTab);
  const activeFileTypeLabel = getWorkspaceIdeActiveFileTypeLabel(activeFile);
  const shouldRenderDesktopFileCount = shouldRenderWorkspaceIdeDesktopFileCount(filesSize);
  const desktopTerminalPanelVisibilityClassName = getWorkspaceIdeTerminalPanelVisibilityClassName(
    shouldRenderDesktopTerminalPanel,
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col w-full">
      <div className="h-10 shrink-0 border-b bg-muted/30 flex items-center">
        {materializeWorkspaceDesktopIdeTabNodes({
          tabs,
          activeTab,
          gitTabBadgeSnapshot,
          onSelectTab,
        })}
        <div className="flex-1" />
        {shouldRenderDesktopPreviewPanel === true && (
          <DesktopPreviewDeviceControls browserDevice={browserDevice} onSetBrowserDevice={onSetBrowserDevice} />
        )}
      </div>
      <WorkspaceIdeShellSnapshotStrip snapshot={ideShellSnapshot} />

      <div className="flex-1 min-h-0 overflow-hidden">
        {shouldRenderDesktopExplorerPanel === true && (
          <DesktopExplorerPanel
            filteredTree={filteredTree}
            hasOriginalFileTreeData={hasOriginalFileTreeData}
            explorerSnapshotStatus={explorerSnapshotStatus}
            searchQuery={searchQuery}
            expandedFolders={expandedFolders}
            activeFile={activeFile}
            editorNavigationTarget={editorNavigationTarget}
            openFiles={openFiles}
            activeFileContent={activeFileContent}
            activeFileBufferStatus={activeFileBufferStatus}
            isFileDirty={isFileDirty}
            onSearchQueryChange={onSearchQueryChange}
            onToggleFolder={onToggleFolder}
            onSelectFile={onSelectFile}
            onContextMenu={onContextMenu}
            onExportProject={onExportProject}
            onSelectOpenFile={onSelectOpenFile}
            onEditorNavigationHandled={onEditorNavigationHandled}
            onRequestCloseFile={onRequestCloseFile}
            onSaveActiveFile={onSaveActiveFile}
            onCopyActiveFile={onCopyActiveFile}
            onUpdateActiveFileContent={onUpdateActiveFileContent}
            monacoEditor={monacoEditor}
          />
        )}

        {shouldRenderDesktopFoundationPanel === true && (
          <DesktopFoundationPanel
            engineeringState={engineeringState}
            contextGateResult={contextGateResult}
            foundationActionLabel={foundationActionLabel}
            foundationStatusLabel={foundationStatusLabel}
            onStartFoundation={onStartFoundation}
            onOpenFoundationFile={onOpenFoundationFile}
            onConfirmFoundationDecisions={onConfirmFoundationDecisions}
            isBusy={false}
          />
        )}

        {shouldRenderDesktopPreviewPanel === true && (
          <DesktopPreviewPanel
            projectId={projectId}
            browserUrl={browserUrl}
            previewUrlStatus={previewUrlStatus}
            previewReloadToken={previewReloadToken}
            onChangeBrowserUrl={onChangeBrowserUrl}
            onOpenRuntimeHomeUrl={onOpenRuntimeHomeUrl}
            previewDeviceStyle={previewDeviceStyle}
            runtimeStatus={runtimeStatus}
            canVisualEdit={canVisualEdit}
            onSubmitVisualEdit={onSubmitVisualEdit}
            onOpenCapabilityAudit={() => onSelectTab('debug')}
            onRecoverRuntime={onRecoverRuntime}
          />
        )}

        {shouldRenderDesktopGitPanel === true && (
          <DesktopGitPanel
            projectId={projectId}
            gitCommits={gitCommits}
            gitBranch={gitBranch}
            gitBranches={gitBranches}
            gitBranchListStatus={gitBranchListStatus}
            gitRemotes={gitRemotes}
            gitRemoteListStatus={gitRemoteListStatus}
            gitRemoteBranches={gitRemoteBranches}
            gitRemoteBranchListStatus={gitRemoteBranchListStatus}
            gitTags={gitTags}
            gitTagListStatus={gitTagListStatus}
            gitStashes={gitStashes}
            gitStashListStatus={gitStashListStatus}
            gitWorktreeStatus={gitWorktreeStatus}
            gitWorktreeStatusState={gitWorktreeStatusState}
            gitBranchCompare={gitBranchCompare}
            gitBranchCompareStatus={gitBranchCompareStatus}
            gitBranchCompareTarget={gitBranchCompareTarget}
            gitBranchSwitchReadiness={gitBranchSwitchReadiness}
            gitCommitListStatus={gitCommitListStatus}
            selectedCommit={selectedCommit}
            gitCommitDetailStatus={gitCommitDetailStatus}
            onSelectGitBranchCompareTarget={onSelectGitBranchCompareTarget}
            onCreateGitBranch={onCreateGitBranch}
            onCreateGitTag={onCreateGitTag}
            onDeleteGitTag={onDeleteGitTag}
            onCreateGitBranchFromRemote={onCreateGitBranchFromRemote}
            onRefreshGitPanel={onRefreshGitPanel}
            onRefreshGitRemoteBranches={onRefreshGitRemoteBranches}
            onDeleteGitBranch={onDeleteGitBranch}
            onRenameGitBranch={onRenameGitBranch}
            onSwitchGitBranch={onSwitchGitBranch}
            onOpenFile={onOpenFile}
            onCopyText={onCopyText}
            onRestoreCommitFile={onRestoreCommitFile}
            onCommitWorktree={onCommitWorktree}
            onDiscardWorktreeFile={onDiscardWorktreeFile}
            onApplyGitBranchCompareFile={onApplyGitBranchCompareFile}
            onCreateGitStash={onCreateGitStash}
            onApplyGitStash={onApplyGitStash}
            onViewCommit={onViewCommit}
          />
        )}

        {shouldRenderDesktopDebugPanel === true && <DesktopDebugPanel projectId={projectId} />}

        <div className={cn('h-full', desktopTerminalPanelVisibilityClassName)}>
          <TerminalPanel projectId={projectId} active={shouldRenderDesktopTerminalPanel} />
        </div>
      </div>

      <div className="h-6 shrink-0 border-t bg-muted/30 px-4 text-xs text-muted-foreground flex items-center">
        <span>YiStack</span>
        <span className="mx-2">|</span>
        <span>{activeFileTypeLabel}</span>
        <div className="ml-auto flex items-center gap-4">
          {shouldRenderDesktopFileCount === true && <span>{filesSize} 个文件</span>}
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
export function WorkspaceMobileIde({
  tabs,
  activeTab,
  browserDevice,
  historyIndex,
  browserHistoryLength,
  mobileBrowserUrl,
  mobilePreviewUrlStatus,
  previewReloadToken,
  runtimeStatus,
  canVisualEdit,
  onSubmitVisualEdit,
  searchQuery,
  filteredTree,
  hasOriginalFileTreeData,
  explorerSnapshotStatus,
  expandedFolders,
  activeFile,
  mobileEditingFile,
  mobileFileContent,
  mobileEditorBufferStatus,
  editorNavigationTarget,
  gitCommits,
  gitBranch,
  gitBranches,
  gitBranchListStatus,
  gitRemotes,
  gitRemoteListStatus,
  gitRemoteBranches,
  gitRemoteBranchListStatus,
  gitTags,
  gitTagListStatus,
  gitStashes,
  gitStashListStatus,
  gitWorktreeStatus,
  gitWorktreeStatusState,
  gitBranchCompare,
  gitBranchCompareStatus,
  gitBranchCompareTarget,
  gitBranchSwitchReadiness,
  gitCommitListStatus,
  selectedCommit,
  gitCommitDetailStatus,
  projectId,
  engineeringState,
  contextGateResult,
  foundationActionLabel,
  foundationStatusLabel,
  monacoEditor,
  onSelectTab,
  onSetBrowserDevice,
  onGoBrowserBack,
  onGoForward,
  onChangeMobileBrowserUrl,
  onOpenRuntimeHomeUrl,
  onNavigateTo,
  onRecoverRuntime,
  onSearchQueryChange,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
  isFileDirty,
  onEditorNavigationHandled,
  onCloseMobileEditor,
  onCopyMobileFile,
  onSaveMobileFile,
  onUpdateMobileFileContent,
  onStartFoundation,
  onOpenFoundationFile,
  onConfirmFoundationDecisions,
  onSelectGitBranchCompareTarget,
  onCreateGitBranch,
  onCreateGitTag,
  onDeleteGitTag,
  onCreateGitBranchFromRemote,
  onRefreshGitPanel,
  onRefreshGitRemoteBranches,
  onDeleteGitBranch,
  onRenameGitBranch,
  onSwitchGitBranch,
  onOpenFile,
  onCopyText,
  onRestoreCommitFile,
  onCommitWorktree,
  onDiscardWorktreeFile,
  onApplyGitBranchCompareFile,
  onCreateGitStash,
  onApplyGitStash,
  onViewCommit,
}: MobileIdeProps) {
  const ideShellSnapshot = buildWorkspaceIdeShellSnapshot({
    tabs,
    activeTab,
    projectId,
    surface: 'mobile',
    mobileEditingFile,
    fileCount: filteredTree.length,
    gitCommitCount: gitCommits.length,
  });
  const gitTabBadgeSnapshot = buildWorkspaceGitTabBadgeSnapshot({
    surface: 'mobile',
    gitCommits,
    gitCommitListStatus,
    selectedCommit,
    gitCommitDetailStatus,
  });
  const shouldRenderMobileExplorerList = shouldRenderWorkspaceIdeMobileExplorerList(activeTab, mobileEditingFile);
  const shouldRenderMobileExplorerEditor = shouldRenderWorkspaceIdeMobileExplorerEditor(activeTab, mobileEditingFile);
  const mobileExplorerEditorFile = getWorkspaceIdeMobileExplorerEditorFile(mobileEditingFile);
  const shouldRenderMobileFoundationPanel = shouldRenderWorkspaceIdeFoundationPanel(activeTab);
  const shouldRenderMobilePreviewPanel = shouldRenderWorkspaceIdePreviewPanel(activeTab);
  const shouldRenderMobileGitPanel = shouldRenderWorkspaceIdeGitPanel(activeTab);
  const shouldRenderMobileTerminalPanel = shouldRenderWorkspaceIdeTerminalPanel(activeTab);
  const shouldRenderMobileDebugPanel = shouldRenderWorkspaceIdeDebugPanel(activeTab);
  const mobileTerminalPanelVisibilityClassName = getWorkspaceIdeTerminalPanelVisibilityClassName(
    shouldRenderMobileTerminalPanel,
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col w-full">
      <div className="h-10 shrink-0 overflow-x-auto border-b bg-muted/30 flex items-center">
        {materializeWorkspaceMobileIdeTabNodes({
          tabs,
          activeTab,
          gitTabBadgeSnapshot,
          onSelectTab,
        })}
      </div>
      <WorkspaceIdeShellSnapshotStrip snapshot={ideShellSnapshot} />

      <div className="flex-1 overflow-hidden">
        {shouldRenderMobileExplorerList === true && (
          <MobileExplorerList
            filteredTree={filteredTree}
            hasOriginalFileTreeData={hasOriginalFileTreeData}
            explorerSnapshotStatus={explorerSnapshotStatus}
            searchQuery={searchQuery}
            expandedFolders={expandedFolders}
            activeFile={activeFile}
            onSearchQueryChange={onSearchQueryChange}
            onToggleFolder={onToggleFolder}
            onSelectFile={onSelectFile}
            onContextMenu={onContextMenu}
          />
        )}

        {shouldRenderMobileExplorerEditor === true && (
          <MobileExplorerEditor
            mobileEditingFile={mobileExplorerEditorFile}
            mobileFileContent={mobileFileContent}
            mobileEditorBufferStatus={mobileEditorBufferStatus}
            editorNavigationTarget={editorNavigationTarget}
            onClose={onCloseMobileEditor}
            onEditorNavigationHandled={onEditorNavigationHandled}
            onCopy={onCopyMobileFile}
            onSave={onSaveMobileFile}
            isFileDirty={isFileDirty}
            onUpdateMobileFileContent={onUpdateMobileFileContent}
            monacoEditor={monacoEditor}
          />
        )}

        {shouldRenderMobileFoundationPanel === true && (
          <MobileFoundationPanel
            engineeringState={engineeringState}
            contextGateResult={contextGateResult}
            foundationActionLabel={foundationActionLabel}
            foundationStatusLabel={foundationStatusLabel}
            onStartFoundation={onStartFoundation}
            onOpenFoundationFile={onOpenFoundationFile}
            onConfirmFoundationDecisions={onConfirmFoundationDecisions}
            isBusy={false}
          />
        )}

        {shouldRenderMobilePreviewPanel === true && (
          <MobilePreviewPanel
            projectId={projectId}
            browserDevice={browserDevice}
            onSetBrowserDevice={onSetBrowserDevice}
            historyIndex={historyIndex}
            browserHistoryLength={browserHistoryLength}
            mobileBrowserUrl={mobileBrowserUrl}
            mobilePreviewUrlStatus={mobilePreviewUrlStatus}
            previewReloadToken={previewReloadToken}
            runtimeStatus={runtimeStatus}
            canVisualEdit={canVisualEdit}
            onSubmitVisualEdit={onSubmitVisualEdit}
            onOpenCapabilityAudit={() => onSelectTab('debug')}
            onOpenRuntimeHomeUrl={onOpenRuntimeHomeUrl}
            onRecoverRuntime={onRecoverRuntime}
            onGoBrowserBack={onGoBrowserBack}
            onGoForward={onGoForward}
            onChangeMobileBrowserUrl={onChangeMobileBrowserUrl}
            onNavigateTo={onNavigateTo}
          />
        )}

        {shouldRenderMobileGitPanel === true && (
          <MobileGitPanel
            projectId={projectId}
            gitCommits={gitCommits}
            gitBranch={gitBranch}
            gitBranches={gitBranches}
            gitBranchListStatus={gitBranchListStatus}
            gitRemotes={gitRemotes}
            gitRemoteListStatus={gitRemoteListStatus}
            gitRemoteBranches={gitRemoteBranches}
            gitRemoteBranchListStatus={gitRemoteBranchListStatus}
            gitTags={gitTags}
            gitTagListStatus={gitTagListStatus}
            gitStashes={gitStashes}
            gitStashListStatus={gitStashListStatus}
            gitWorktreeStatus={gitWorktreeStatus}
            gitWorktreeStatusState={gitWorktreeStatusState}
            gitBranchCompare={gitBranchCompare}
            gitBranchCompareStatus={gitBranchCompareStatus}
            gitBranchCompareTarget={gitBranchCompareTarget}
            gitBranchSwitchReadiness={gitBranchSwitchReadiness}
            gitCommitListStatus={gitCommitListStatus}
            selectedCommit={selectedCommit}
            gitCommitDetailStatus={gitCommitDetailStatus}
            onSelectGitBranchCompareTarget={onSelectGitBranchCompareTarget}
            onCreateGitBranch={onCreateGitBranch}
            onCreateGitTag={onCreateGitTag}
            onDeleteGitTag={onDeleteGitTag}
            onCreateGitBranchFromRemote={onCreateGitBranchFromRemote}
            onRefreshGitPanel={onRefreshGitPanel}
            onRefreshGitRemoteBranches={onRefreshGitRemoteBranches}
            onDeleteGitBranch={onDeleteGitBranch}
            onRenameGitBranch={onRenameGitBranch}
            onSwitchGitBranch={onSwitchGitBranch}
            onOpenFile={onOpenFile}
            onCopyText={onCopyText}
            onRestoreCommitFile={onRestoreCommitFile}
            onCommitWorktree={onCommitWorktree}
            onDiscardWorktreeFile={onDiscardWorktreeFile}
            onApplyGitBranchCompareFile={onApplyGitBranchCompareFile}
            onCreateGitStash={onCreateGitStash}
            onApplyGitStash={onApplyGitStash}
            onViewCommit={onViewCommit}
          />
        )}

        {shouldRenderMobileDebugPanel === true && <MobileDebugPanel projectId={projectId} />}

        <div className={cn('h-full', mobileTerminalPanelVisibilityClassName)}>
          <TerminalPanel projectId={projectId} active={shouldRenderMobileTerminalPanel} />
        </div>
      </div>
    </div>
  );
}
