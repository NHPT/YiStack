import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  ChatScrollSnapshot,
  PreviewUrlStatus,
  WorkspaceBrowserDevice,
  WorkspaceBrowserHistoryUrlList,
  WorkspaceMobileView,
} from './workspace-types';

export type WorkspaceShellStateSetter<T> = Dispatch<SetStateAction<T>>;

export type WorkspaceShellStateContract = {
  chatWidth: number;
  setChatWidth: WorkspaceShellStateSetter<number>;
  isResizing: boolean;
  setIsResizing: WorkspaceShellStateSetter<boolean>;
  chatExpanded: boolean;
  setChatExpanded: WorkspaceShellStateSetter<boolean>;
  isChatAutoScrollEnabled: boolean;
  setIsChatAutoScrollEnabled: WorkspaceShellStateSetter<boolean>;
  chatScrollSnapshot: ChatScrollSnapshot;
  browserUrl: string;
  setBrowserUrl: WorkspaceShellStateSetter<string>;
  previewUrlStatus: PreviewUrlStatus | null;
  setPreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus | null>;
  previewReloadToken: number;
  requestPreviewReload: () => void;
  browserDevice: WorkspaceBrowserDevice;
  setBrowserDevice: WorkspaceShellStateSetter<WorkspaceBrowserDevice>;
  isMobile: boolean;
  setIsMobile: WorkspaceShellStateSetter<boolean>;
  mobileView: WorkspaceMobileView;
  setMobileView: WorkspaceShellStateSetter<WorkspaceMobileView>;
  mobileEditingFile: string | null;
  setMobileEditingFile: WorkspaceShellStateSetter<string | null>;
  mobileFileContent: string;
  setMobileFileContent: WorkspaceShellStateSetter<string>;
  mobileBrowserUrl: string;
  setMobileBrowserUrl: WorkspaceShellStateSetter<string>;
  mobilePreviewUrlStatus: PreviewUrlStatus | null;
  setMobilePreviewUrlStatus: WorkspaceShellStateSetter<PreviewUrlStatus | null>;
  browserHistory: WorkspaceBrowserHistoryUrlList;
  setBrowserHistory: WorkspaceShellStateSetter<WorkspaceBrowserHistoryUrlList>;
  historyIndex: number;
  setHistoryIndex: WorkspaceShellStateSetter<number>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  desktopMessagesRef: RefObject<HTMLDivElement | null>;
  mobileMessagesRef: RefObject<HTMLDivElement | null>;
  chatPanelRef: RefObject<HTMLDivElement | null>;
  getActiveMessagesContainer: () => HTMLDivElement | null;
  updateChatAutoScrollState: (element: HTMLDivElement | null) => void;
  handleMouseDown: (event: ReactMouseEvent) => void;
  scrollToBottom: () => void;
  navigateTo: (url: string) => void;
  goBrowserBack: () => void;
  goForward: () => void;
};
