import type {
  MouseEvent as ReactMouseEvent,
  ReactNode,
  RefObject,
} from 'react';

import type { GitCommit } from '@/lib/types';

import type {
  WorkspaceContextMenu,
  WorkspaceContextMenuNode,
  WorkspaceExplorerContextOperation,
  WorkspaceExplorerContextOperationInput,
  WorkspaceMobileView,
  WorkspaceOpenFilePathList,
  WorkspaceProjectBootstrapSnapshot,
} from './workspace-types';

export type WorkspacePageOverlaysProps = {
  contextMenu: WorkspaceContextMenu | null;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  openFiles: WorkspaceOpenFilePathList;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  isFileDirty: (path: string | null) => boolean;
  pendingCloseFile: string | null;
  pendingRestoreCommit: GitCommit | null;
  isRestoringCommit: boolean;
  quoteToChat: (path: string) => void;
  copyToClipboard: (text: string) => Promise<void>;
  downloadFile: (path: string, content: string) => void;
  handleExplorerContextOperation: (
    operation: WorkspaceExplorerContextOperation,
    node: WorkspaceContextMenuNode,
    input?: WorkspaceExplorerContextOperationInput,
  ) => Promise<void> | void;
  setPendingCloseFile: (path: string | null) => void;
  closeWorkspaceFile: (path: string, discard?: boolean) => void;
  savePendingCloseFile: () => Promise<void>;
  setPendingRestoreCommit: (commit: GitCommit | null) => void;
  confirmRestoreCommit: () => Promise<void>;
};

export type WorkspacePageHeaderProps = {
  isMobile: boolean;
  projectName?: string | null;
  goBack: () => void;
  clearChat: () => void;
};

export type WorkspaceDesktopShellProps = {
  chatPanelRef: RefObject<HTMLDivElement | null>;
  chatExpanded: boolean;
  chatWidth: number;
  isResizing: boolean;
  onResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onCollapseChat: () => void;
  onExpandChat: () => void;
  chatPanel: ReactNode;
  idePanel: ReactNode;
};

export type WorkspaceMobileShellProps = {
  mobileView: WorkspaceMobileView;
  setMobileView: (view: WorkspaceMobileView) => void;
  chatPanel: ReactNode;
  idePanel: ReactNode;
};

export type WorkspacePageScaffoldProps = {
  header: WorkspacePageHeaderProps;
  bootstrapSnapshot: WorkspaceProjectBootstrapSnapshot;
  desktop: WorkspaceDesktopShellProps;
  mobile: WorkspaceMobileShellProps;
  overlays: WorkspacePageOverlaysProps;
};
