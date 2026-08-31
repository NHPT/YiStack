/**
 * YiStack - 主界面
 * 道生一，二生三，三生万物
 */

'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

import { Spinner } from '@/components/ui/spinner';
import type { MonacoEditorComponent } from './workspace-ide-subpanel-types';
import { useWorkspacePageContainer } from './use-workspace-page-container';
import {
  WorkspacePageLoadingState,
  WorkspacePageScaffold,
} from './workspace-page-components';
import { buildWorkspaceProjectBootstrapSnapshot } from './workspace-project-bootstrap-snapshot';

// 动态导入 Monaco Editor 以避免 SSR 问题
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Spinner /></div>
});

const WorkspaceMonacoEditor: MonacoEditorComponent = (props) => <MonacoEditor {...props} />;

// 主组件
function WorkspacePage() {
  const {
    authLoading,
    isAuthenticated,
    hasMounted,
    projectIdParam,
    projectParam,
    goBack,
    projectInfo,
    isRestoringWorkspace,
    messageRestoreStatus,
    openFiles,
    files,
    savedFiles,
    pendingCloseFile,
    setPendingCloseFile,
    contextMenu,
    isRestoringCommit,
    pendingRestoreCommit,
    setPendingRestoreCommit,
    contextMenuRef,
    chatWidth,
    isResizing,
    chatExpanded,
    setChatExpanded,
    isMobile,
    mobileView,
    setMobileView,
    chatPanelRef,
    handleMouseDown,
    desktopChatPanel,
    mobileChatPanel,
    desktopIdePanel,
    mobileIdePanel,
    savePendingCloseFile,
    quoteToChat,
    clearChat,
    copyToClipboard,
    downloadFile,
    closeWorkspaceFile,
    isFileDirty,
    handleExplorerContextOperation,
    confirmRestoreCommit,
  } = useWorkspacePageContainer({
    monacoEditor: WorkspaceMonacoEditor,
  });

  if (authLoading || !isAuthenticated) {
    return (
      <WorkspacePageLoadingState
        source="auth_gate"
        authLoading={authLoading}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  const bootstrapSnapshot = buildWorkspaceProjectBootstrapSnapshot({
    hasMounted,
    projectIdParam,
    projectParam,
    projectId: projectInfo?.projectId || null,
    projectName: projectInfo?.projectName || null,
    isRestoringWorkspace,
    messageRestoreStatus,
  });

  return (
    <WorkspacePageScaffold
      header={{
        isMobile,
        projectName: projectInfo?.projectName,
        goBack,
        clearChat,
      }}
      bootstrapSnapshot={bootstrapSnapshot}
      desktop={{
        chatPanelRef,
        chatExpanded,
        chatWidth,
        isResizing,
        onResizeStart: handleMouseDown,
        onCollapseChat: () => setChatExpanded(false),
        onExpandChat: () => setChatExpanded(true),
        chatPanel: desktopChatPanel,
        idePanel: desktopIdePanel,
      }}
      mobile={{
        mobileView,
        setMobileView,
        chatPanel: mobileChatPanel,
        idePanel: mobileIdePanel,
      }}
      overlays={{
        contextMenu,
        contextMenuRef,
        openFiles,
        files,
        savedFiles,
        isFileDirty,
        pendingCloseFile,
        pendingRestoreCommit,
        isRestoringCommit,
        quoteToChat,
        copyToClipboard,
        downloadFile,
        handleExplorerContextOperation,
        setPendingCloseFile,
        closeWorkspaceFile,
        savePendingCloseFile,
        setPendingRestoreCommit,
        confirmRestoreCommit,
      }}
    />
  );
}

// 包装组件，添加 Suspense 支持 useSearchParams
export default function WorkspacePageWrapper() {
  return (
    <Suspense fallback={<WorkspacePageLoadingState source="suspense" authLoading={true} />}>
      <WorkspacePage />
    </Suspense>
  );
}
