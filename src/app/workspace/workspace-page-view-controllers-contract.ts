import type { ReactNode } from 'react';

export type WorkspacePageViewControllersContract = {
  desktopChatPanel: ReactNode;
  mobileChatPanel: ReactNode;
  desktopIdePanel: ReactNode;
  mobileIdePanel: ReactNode;
  savePendingCloseFile: () => Promise<void>;
  quoteToChat: (path: string) => void;
  clearChat: () => void;
  copyToClipboard: (text: string) => Promise<void>;
  exportProject: () => void;
};
