import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatScrollSnapshot, PreviewUrlStatus, WorkspaceBrowserDevice, WorkspaceBrowserHistoryUrlList, WorkspaceMobileView } from './workspace-types';
import {
  buildEmptyMessagesChatScrollSnapshot,
  buildInitialChatScrollSnapshot,
  buildManualRestoreChatScrollSnapshot,
  buildMissingChatScrollContainerSnapshot,
  buildPausedMessageCountChatScrollSnapshot,
  buildUserScrollChatScrollSnapshot,
} from './workspace-chat-scroll-snapshot';
import { buildMobileHistoryPreviewUrlStatus, normalizePreviewBrowserUrl } from './workspace-preview-url-status';
import type { WorkspaceShellStateContract } from './workspace-shell-state-contract';

type UseWorkspaceShellStateOptions = {
  messagesLength: number;
};

function isWorkspaceShellMobileChatView(isMobile: boolean, mobileView: WorkspaceMobileView): boolean {
  return isMobile === true && mobileView === 'chat';
}

function hasWorkspaceShellMessagesContainer(
  element: HTMLDivElement | null,
): element is HTMLDivElement {
  return element !== null;
}

function isWorkspaceShellResizing(isResizing: boolean): boolean {
  return isResizing === true;
}

function isWorkspaceShellChatAutoScrollEnabled(isChatAutoScrollEnabled: boolean): boolean {
  return isChatAutoScrollEnabled === true;
}

export function useWorkspaceShellState({
  messagesLength,
}: UseWorkspaceShellStateOptions): WorkspaceShellStateContract {
  const [chatWidth, setChatWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [isChatAutoScrollEnabled, setIsChatAutoScrollEnabled] = useState(true);
  const [chatScrollSnapshot, setChatScrollSnapshot] = useState<ChatScrollSnapshot>(
    () => buildInitialChatScrollSnapshot(messagesLength),
  );
  const [browserUrl, setBrowserUrl] = useState('about:blank');
  const [previewUrlStatus, setPreviewUrlStatus] = useState<PreviewUrlStatus | null>(null);
  const [previewReloadToken, setPreviewReloadToken] = useState(0);
  const [browserDevice, setBrowserDevice] = useState<WorkspaceBrowserDevice>('desktop');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<WorkspaceMobileView>('chat');
  const [mobileEditingFile, setMobileEditingFile] = useState<string | null>(null);
  const [mobileFileContent, setMobileFileContent] = useState<string>('');
  const [mobileBrowserUrl, setMobileBrowserUrl] = useState('about:blank');
  const [mobilePreviewUrlStatus, setMobilePreviewUrlStatus] = useState<PreviewUrlStatus | null>(null);
  const [browserHistory, setBrowserHistory] = useState<WorkspaceBrowserHistoryUrlList>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const desktopMessagesRef = useRef<HTMLDivElement>(null);
  const mobileMessagesRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const chatWidthRef = useRef(chatWidth);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncMobileState = (event?: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile((event ?? mediaQuery).matches);
    };

    syncMobileState(mediaQuery);
    mediaQuery.addEventListener('change', syncMobileState);
    return () => mediaQuery.removeEventListener('change', syncMobileState);
  }, []);

  const getActiveMessagesContainer = useCallback(() => {
    const shouldUseMobileMessages = isWorkspaceShellMobileChatView(isMobile, mobileView);
    if (shouldUseMobileMessages === true) {
      return mobileMessagesRef.current;
    }
    return desktopMessagesRef.current;
  }, [isMobile, mobileView]);

  const updateChatAutoScrollState = useCallback((element: HTMLDivElement | null) => {
    const hasMessagesContainer = hasWorkspaceShellMessagesContainer(element);
    if (hasMessagesContainer === false) {
      setIsChatAutoScrollEnabled(false);
      setChatScrollSnapshot(buildMissingChatScrollContainerSnapshot({ messageCount: messagesLength }));
      return;
    }
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const shouldFollowLatest = distanceToBottom <= 96;
    setIsChatAutoScrollEnabled(shouldFollowLatest);
    setChatScrollSnapshot(buildUserScrollChatScrollSnapshot({ messageCount: messagesLength, distanceToBottom }));
  }, [messagesLength]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const shouldResize = isWorkspaceShellResizing(isResizing);
      if (shouldResize === false) return;
      const maxWidth = window.innerWidth * 0.75;
      const newWidth = Math.max(320, Math.min(maxWidth, event.clientX));
      if (chatWidthRef.current === newWidth) {
        return;
      }
      chatWidthRef.current = newWidth;
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isWorkspaceShellResizing(isResizing) === true) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const scrollToBottom = useCallback(() => {
    const activeContainer = getActiveMessagesContainer();
    if (hasWorkspaceShellMessagesContainer(activeContainer) === true) {
      activeContainer.scrollTo({ top: activeContainer.scrollHeight, behavior: 'smooth' });
      setChatScrollSnapshot(buildManualRestoreChatScrollSnapshot({
        messageCount: messagesLength,
        method: 'container',
      }));
      return;
    }
    const messagesEndElement = messagesEndRef.current;
    if (hasWorkspaceShellMessagesContainer(messagesEndElement) === true) {
      messagesEndElement.scrollIntoView({ behavior: 'smooth' });
      setChatScrollSnapshot(buildManualRestoreChatScrollSnapshot({
        messageCount: messagesLength,
        method: 'anchor',
      }));
      return;
    }
    setIsChatAutoScrollEnabled(false);
    setChatScrollSnapshot(buildMissingChatScrollContainerSnapshot({
      messageCount: messagesLength,
      anchorMissing: true,
    }));
  }, [getActiveMessagesContainer, messagesLength]);

  useEffect(() => {
    if (messagesLength === 0) {
      setChatScrollSnapshot(buildEmptyMessagesChatScrollSnapshot());
      return;
    }
    if (isWorkspaceShellChatAutoScrollEnabled(isChatAutoScrollEnabled) === false) {
      setChatScrollSnapshot((prev) => buildPausedMessageCountChatScrollSnapshot(prev, messagesLength));
      return;
    }
    scrollToBottom();
  }, [isChatAutoScrollEnabled, messagesLength, scrollToBottom]);

  const navigateTo = useCallback((url: string) => {
    const normalizedUrl = normalizePreviewBrowserUrl(url);
    const newHistory = browserHistory.slice(0, historyIndex + 1);
    newHistory.push(normalizedUrl);
    setBrowserHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setMobileBrowserUrl(normalizedUrl);
    setMobilePreviewUrlStatus(buildMobileHistoryPreviewUrlStatus({ value: normalizedUrl, action: 'navigate' }));
  }, [browserHistory, historyIndex]);

  const goBrowserBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const nextUrl = browserHistory[newIndex];
      setHistoryIndex(newIndex);
      setMobileBrowserUrl(nextUrl);
      setMobilePreviewUrlStatus(buildMobileHistoryPreviewUrlStatus({ value: nextUrl, action: 'back' }));
    }
  }, [browserHistory, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex < browserHistory.length - 1) {
      const newIndex = historyIndex + 1;
      const nextUrl = browserHistory[newIndex];
      setHistoryIndex(newIndex);
      setMobileBrowserUrl(nextUrl);
      setMobilePreviewUrlStatus(buildMobileHistoryPreviewUrlStatus({ value: nextUrl, action: 'forward' }));
    }
  }, [browserHistory, historyIndex]);

  const requestPreviewReload = useCallback(() => {
    setPreviewReloadToken((value) => value + 1);
  }, []);

  return {
    chatWidth,
    setChatWidth,
    isResizing,
    setIsResizing,
    chatExpanded,
    setChatExpanded,
    isChatAutoScrollEnabled,
    setIsChatAutoScrollEnabled,
    chatScrollSnapshot,
    browserUrl,
    setBrowserUrl,
    previewUrlStatus,
    setPreviewUrlStatus,
    previewReloadToken,
    requestPreviewReload,
    browserDevice,
    setBrowserDevice,
    isMobile,
    setIsMobile,
    mobileView,
    setMobileView,
    mobileEditingFile,
    setMobileEditingFile,
    mobileFileContent,
    setMobileFileContent,
    mobileBrowserUrl,
    setMobileBrowserUrl,
    mobilePreviewUrlStatus,
    setMobilePreviewUrlStatus,
    browserHistory,
    setBrowserHistory,
    historyIndex,
    setHistoryIndex,
    messagesEndRef,
    desktopMessagesRef,
    mobileMessagesRef,
    chatPanelRef,
    getActiveMessagesContainer,
    updateChatAutoScrollState,
    handleMouseDown,
    scrollToBottom,
    navigateTo,
    goBrowserBack,
    goForward,
  };
}
