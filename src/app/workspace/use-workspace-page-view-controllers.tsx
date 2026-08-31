'use client';

import { useWorkspacePageViewContent } from './use-workspace-page-view-content';
import { useWorkspacePageViewUi } from './use-workspace-page-view-ui';
import type { WorkspaceFlowStateContract } from './workspace-flow-state-contract';
import type { MonacoEditorComponent } from './workspace-ide-subpanel-types';
import type { WorkspacePageActionControllersContract } from './workspace-page-action-controllers-contract';
import type { WorkspacePageViewContentShellState } from './workspace-page-view-content-options';
import type { WorkspacePageLocalStateContract } from './workspace-page-local-state-contract';
import type { WorkspacePageViewControllersContract } from './workspace-page-view-controllers-contract';

type LocalState = WorkspacePageLocalStateContract;
type FlowState = WorkspaceFlowStateContract;

export type WorkspacePageViewControllersShellState =
  WorkspacePageViewContentShellState
  & {
    chatExpanded: boolean;
  };

type UseWorkspacePageViewControllersOptions = {
  localState: LocalState;
  flowState: FlowState;
  shellState: WorkspacePageViewControllersShellState;
  monacoEditor: MonacoEditorComponent;
  actions: WorkspacePageActionControllersContract;
};

export function useWorkspacePageViewControllers({
  localState,
  flowState,
  shellState,
  monacoEditor,
  actions,
}: UseWorkspacePageViewControllersOptions): WorkspacePageViewControllersContract {
  const uiState = useWorkspacePageViewUi({
    localState,
    shellState: {
      setChatExpanded: shellState.setChatExpanded,
      browserDevice: shellState.browserDevice,
      setPreviewUrlStatus: shellState.setPreviewUrlStatus,
      setMobilePreviewUrlStatus: shellState.setMobilePreviewUrlStatus,
    },
    handleGenerate: actions.handleGenerate,
    applyPageUiMessages: flowState.applyPageUiMessages,
  });

  const {
    desktopChatPanel,
    mobileChatPanel,
    desktopIdePanel,
    mobileIdePanel,
    savePendingCloseFile,
  } = useWorkspacePageViewContent({
    localState,
    flowState: {
      messages: flowState.messages,
      availablePlans: flowState.availablePlans,
      selectedPlanId: flowState.selectedPlanId,
      planCountdown: flowState.planCountdown,
      planSelectionReady: flowState.planSelectionReady,
      currentEngineeringState: flowState.currentEngineeringState,
      currentGateResult: flowState.currentGateResult,
    },
    shellState,
    monacoEditor,
    uiState,
    actions,
  });

  return {
    desktopChatPanel,
    mobileChatPanel,
    desktopIdePanel,
    mobileIdePanel,
    savePendingCloseFile,
    quoteToChat: uiState.quoteToChat,
    clearChat: uiState.clearChat,
    copyToClipboard: uiState.copyToClipboard,
    exportProject: uiState.exportProject,
  };
}
