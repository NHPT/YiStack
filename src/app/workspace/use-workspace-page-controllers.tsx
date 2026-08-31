'use client';

import { useWorkspacePageActionControllers } from './use-workspace-page-action-controllers';
import type {
  WorkspacePageActionControllersRuntimeResources,
  WorkspacePageActionControllersShellState,
} from './use-workspace-page-action-controllers';
import { useWorkspacePageViewControllers } from './use-workspace-page-view-controllers';
import type { WorkspacePageViewControllersShellState } from './use-workspace-page-view-controllers';
import type { WorkspaceFlowStateContract } from './workspace-flow-state-contract';
import type { MonacoEditorComponent } from './workspace-ide-subpanel-types';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspacePageControllersContract } from './workspace-page-controllers-contract';
import type { WorkspacePlanGenerationProjectIdSet } from './workspace-plan-generation-types';
import type { PersistGenerationState } from './workspace-types';

type LocalState = WorkspacePageLocalStateContract;
type FlowState = WorkspaceFlowStateContract;

export type WorkspacePageControllersShellState =
  WorkspacePageViewControllersShellState
  & WorkspacePageActionControllersShellState;

export type WorkspacePageControllersRuntimeResources = WorkspacePageActionControllersRuntimeResources;

type UseWorkspacePageControllersOptions = {
  localState: LocalState;
  flowState: FlowState;
  shellState: WorkspacePageControllersShellState;
  runtimeResources: WorkspacePageControllersRuntimeResources;
  persistGenerationState: PersistGenerationState;
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  monacoEditor: MonacoEditorComponent;
};

export function useWorkspacePageControllers({
  localState,
  flowState,
  shellState,
  runtimeResources,
  persistGenerationState,
  requestedPlanProjectsAcrossMounts,
  plannedProjectIdsAcrossMounts,
  monacoEditor,
}: UseWorkspacePageControllersOptions): WorkspacePageControllersContract {
  const actions = useWorkspacePageActionControllers({
    localState,
    flowState,
    shellState,
    runtimeResources,
    persistGenerationState,
    requestedPlanProjectsAcrossMounts,
    plannedProjectIdsAcrossMounts,
  });

  const {
    desktopChatPanel,
    mobileChatPanel,
    desktopIdePanel,
    mobileIdePanel,
    savePendingCloseFile,
    quoteToChat,
    clearChat,
    copyToClipboard,
  } = useWorkspacePageViewControllers({
    localState,
    flowState,
    shellState,
    monacoEditor,
    actions,
  });

  return {
    desktopChatPanel,
    mobileChatPanel,
    desktopIdePanel,
    mobileIdePanel,
    savePendingCloseFile,
    quoteToChat,
    clearChat,
    copyToClipboard,
    downloadFile: actions.downloadFile,
    closeWorkspaceFile: actions.closeWorkspaceFile,
    isFileDirty: actions.isFileDirty,
    handleExplorerContextOperation: actions.handleExplorerContextOperation,
    confirmRestoreCommit: actions.confirmRestoreCommit,
  };
}
