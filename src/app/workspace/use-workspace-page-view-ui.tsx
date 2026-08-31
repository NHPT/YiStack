'use client';

import type { Dispatch, SetStateAction } from 'react';

import { useWorkspacePageUi } from './use-workspace-page-ui';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspacePageUiContract } from './workspace-page-ui-contract';
import type { WorkspaceShellStateSetter } from './workspace-shell-state-contract';
import type { PreviewUrlStatus, WorkspaceBrowserDevice, WorkspaceChatMessage } from './workspace-types';

type LocalState = WorkspacePageLocalStateContract;

export type WorkspacePageViewUiShellState = {
  setChatExpanded: WorkspaceShellStateSetter<boolean>;
  browserDevice: WorkspaceBrowserDevice;
  setPreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus | null>;
  setMobilePreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus | null>;
};

type UseWorkspacePageViewUiOptions = {
  localState: LocalState;
  shellState: WorkspacePageViewUiShellState;
  handleGenerate: () => Promise<void>;
  applyPageUiMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
};

export function useWorkspacePageViewUi({
  localState,
  shellState,
  handleGenerate,
  applyPageUiMessages,
}: UseWorkspacePageViewUiOptions): WorkspacePageUiContract {
  const {
    textareaRef,
    setInput,
    attachedFiles,
    setAttachedFiles,
    setChatAttachmentSnapshot,
    availableModels,
    setAvailableModels,
    selectedModel,
    activeTab,
    setActiveTab,
    setActiveFile,
    setOpenFiles,
    setFiles,
    setSavedFiles,
    setEditorBufferStatuses,
    fileTree,
    explorerSnapshotStatus,
    searchQuery,
    setPendingCloseFile,
    setContextMenu,
    projectInfo,
    setSelectedModel,
  } = localState;

  const {
    setChatExpanded,
    browserDevice,
    setPreviewUrlStatus,
    setMobilePreviewUrlStatus,
  } = shellState;

  return useWorkspacePageUi({
    textareaRef,
    handleGenerate,
    fileTree,
    explorerSnapshotStatus,
    searchQuery,
    availableModels,
    selectedModel,
    appType: projectInfo?.appType,
    activeTab,
    browserDevice: browserDevice as WorkspaceBrowserDevice,
    setActiveTab,
    applyPageUiMessages,
    setPreviewUrlStatus,
    setMobilePreviewUrlStatus,
    setFiles,
    setSavedFiles,
    setEditorBufferStatuses,
    setOpenFiles,
    setActiveFile,
    setPendingCloseFile,
    setInput,
    setChatExpanded,
    setContextMenu,
    attachedFiles,
    setAttachedFiles,
    setChatAttachmentSnapshot,
    setAvailableModels,
    setSelectedModel,
    setChatModelRegistrySnapshot: localState.setChatModelRegistrySnapshot,
  });
}
