import type { ReactNode } from 'react';

export type WorkspacePageContentContract = {
  desktopChatPanel: ReactNode;
  mobileChatPanel: ReactNode;
  desktopIdePanel: ReactNode;
  mobileIdePanel: ReactNode;
  savePendingCloseFile: () => Promise<void>;
};
