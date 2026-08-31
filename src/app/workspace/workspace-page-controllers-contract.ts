import type { ReactNode } from 'react';

import type { FileNode } from '@/lib/types';

import type {
  WorkspaceExplorerContextOperation,
  WorkspaceExplorerContextOperationInput,
} from './workspace-types';

export type WorkspacePageControllersContract = {
  desktopChatPanel: ReactNode;
  mobileChatPanel: ReactNode;
  desktopIdePanel: ReactNode;
  mobileIdePanel: ReactNode;
  savePendingCloseFile: () => Promise<void>;
  quoteToChat: (path: string) => void;
  clearChat: () => void;
  copyToClipboard: (text: string) => Promise<void>;
  downloadFile: (path: string, content: string) => void;
  closeWorkspaceFile: (path: string, discardChanges?: boolean) => void;
  isFileDirty: (path: string | null) => boolean;
  handleExplorerContextOperation: (
    operation: WorkspaceExplorerContextOperation,
    node: FileNode | null,
    input?: WorkspaceExplorerContextOperationInput,
  ) => Promise<void>;
  confirmRestoreCommit: () => Promise<void>;
};
