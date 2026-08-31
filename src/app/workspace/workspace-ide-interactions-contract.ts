import type { MouseEvent as ReactMouseEvent } from 'react';

import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { FileNode, FileNodeType } from '@/lib/types';

import type {
  WorkspaceContextMenu,
  WorkspaceEditorNavigationTarget,
  WorkspaceExplorerContextOperation,
  WorkspaceExplorerContextOperationInput,
} from './workspace-types';

export type WorkspaceIdeInteractionsContract = {
  expandAncestorFolders: (path: string) => void;
  reflectFilePathInTree: (path: string, leafType?: FileNodeType) => void;
  isFileDirty: (path: string | null) => boolean;
  closeWorkspaceFile: (path: string, discardChanges?: boolean) => void;
  requestCloseWorkspaceFile: (path: string) => void;
  applyIncrementalWorkflowStep: (step: WorkflowStep) => void;
  openWorkspaceFile: (target: string | WorkspaceEditorNavigationTarget) => Promise<void>;
  toggleFolder: (path: string) => void;
  showContextMenu: (event: ReactMouseEvent, node: FileNode) => void;
  handleExplorerContextOperation: (
    operation: WorkspaceExplorerContextOperation,
    node: FileNode | null,
    input?: WorkspaceExplorerContextOperationInput,
  ) => Promise<void>;
  handleUnavailableExplorerContextOperation: (
    operation: WorkspaceExplorerContextOperation,
    node: FileNode | null,
  ) => void;
  downloadFile: (path: string, content: string) => void;
};

export type WorkspaceIdeInteractionsContextMenu = WorkspaceContextMenu;
