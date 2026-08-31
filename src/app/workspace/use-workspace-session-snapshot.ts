import type { SetStateAction } from 'react';
import { useCallback, useEffect } from 'react';

import { formatWorkspaceSessionSnapshotLocalStateError } from '@/lib/workspace/workspace-session-snapshot-local-errors';

import type { WorkspaceMessageMutationSource } from './workspace-message-state';
import type { WorkspaceSessionSnapshotContract } from './workspace-session-snapshot-contract';
import type {
  EditorBufferStatus,
  WorkspaceChatMessage,
  WorkspaceEditorSessionSnapshot,
  WorkspaceOpenFilePathList,
  WorkspacePlanFlowState,
  WorkspaceSessionSnapshot,
} from './workspace-types';
import {
  buildWorkspaceSessionSnapshot,
  getWorkspaceSessionKey,
} from './workspace-plan-flow-state';

type WorkspaceMessagesApplier = (
  source: WorkspaceMessageMutationSource,
  value: SetStateAction<WorkspaceChatMessage[]>,
) => void;

type UseWorkspaceSessionSnapshotOptions = {
  projectId: string | null | undefined;
  messages: WorkspaceChatMessage[];
  planState: WorkspacePlanFlowState;
  editorState: WorkspaceSessionSnapshotEditorStateInput;
  applyWorkspaceMessages: WorkspaceMessagesApplier;
};

type WorkspaceSessionSnapshotEditorStateInput = {
  activeFile: string | null;
  openFiles: WorkspaceOpenFilePathList;
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  editorBufferStatuses: Map<string, EditorBufferStatus>;
  expandedFolders: Set<string>;
  searchQuery: string;
  pendingCloseFile: string | null;
};

function hasWorkspaceSessionSnapshotMessageId(
  messages: WorkspaceChatMessage[],
  messageId: string,
): boolean {
  for (const message of messages) {
    const hasMessageId = message.id === messageId;
    if (hasMessageId === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceSessionSnapshotRaw(raw: string | null): raw is string {
  if (raw === null) {
    return false;
  }

  const hasRaw = raw.length > 0;
  return hasRaw === true;
}

function hasWorkspaceSessionSnapshotProjectId(
  projectId: string | null | undefined,
): projectId is string {
  if (projectId === null || projectId === undefined) {
    return false;
  }

  const hasProjectId = projectId.length > 0;
  return hasProjectId === true;
}

function materializeWorkspaceSessionSnapshotFileEntries(
  files: Map<string, string>,
): WorkspaceEditorSessionSnapshot['files'] {
  const entries: WorkspaceEditorSessionSnapshot['files'] = [];

  for (const [path, content] of files) {
    entries.push({ path, content });
  }

  return entries;
}

function materializeWorkspaceSessionSnapshotEditorStatusEntries(
  editorBufferStatuses: Map<string, EditorBufferStatus>,
): WorkspaceEditorSessionSnapshot['editorBufferStatuses'] {
  const entries: WorkspaceEditorSessionSnapshot['editorBufferStatuses'] = [];

  for (const [path, status] of editorBufferStatuses) {
    entries.push({ path, status });
  }

  return entries;
}

function materializeWorkspaceSessionSnapshotExpandedFolders(
  expandedFolders: Set<string>,
): string[] {
  const folders: string[] = [];

  for (const folder of expandedFolders) {
    folders.push(folder);
  }

  return folders;
}

function buildWorkspaceEditorSessionSnapshot({
  activeFile,
  openFiles,
  files,
  savedFiles,
  editorBufferStatuses,
  expandedFolders,
  searchQuery,
  pendingCloseFile,
}: WorkspaceSessionSnapshotEditorStateInput): WorkspaceEditorSessionSnapshot {
  return {
    activeFile,
    openFiles,
    files: materializeWorkspaceSessionSnapshotFileEntries(files),
    savedFiles: materializeWorkspaceSessionSnapshotFileEntries(savedFiles),
    editorBufferStatuses: materializeWorkspaceSessionSnapshotEditorStatusEntries(editorBufferStatuses),
    expandedFolders: materializeWorkspaceSessionSnapshotExpandedFolders(expandedFolders),
    searchQuery,
    pendingCloseFile,
  };
}

export function useWorkspaceSessionSnapshot({
  projectId,
  messages,
  planState,
  editorState,
  applyWorkspaceMessages,
}: UseWorkspaceSessionSnapshotOptions): WorkspaceSessionSnapshotContract {
  const {
    availablePlans,
    recommendedPlanId,
    selectedPlanId,
    planCountdown,
    planAutoConfirmDeadlineAt,
    planSelectionReady,
  } = planState;

  const readWorkspaceSessionSnapshot = useCallback((targetProjectId: string): WorkspaceSessionSnapshot | null => {
    if (typeof window === 'undefined') return null;
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(getWorkspaceSessionKey(targetProjectId));
    } catch (error) {
      const reason = formatWorkspaceSessionSnapshotLocalStateError(error, '浏览器拒绝读取本地会话存储');
      applyWorkspaceMessages('session_snapshot_read_failure', (prev) => {
        const messageId = `workspace-session-snapshot-read-failed-${targetProjectId}`;
        const hasExistingMessage = hasWorkspaceSessionSnapshotMessageId(prev, messageId);
        if (hasExistingMessage === true) {
          return prev;
        }
        return [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: `本地会话快照读取失败：${reason}。系统无法确认 yistack_workspace_session:${targetProjectId} 是否可作为历史消息兜底；如果后端历史消息暂时不可用，当前聊天记录、工程状态或恢复入口可能无法从本地快照恢复。`,
            timestamp: new Date().toISOString(),
          },
        ];
      });
      return null;
    }
    if (hasWorkspaceSessionSnapshotRaw(raw) === false) return null;

    try {
      return JSON.parse(raw) as WorkspaceSessionSnapshot;
    } catch (error) {
      let cleanupError: unknown;
      try {
        sessionStorage.removeItem(getWorkspaceSessionKey(targetProjectId));
      } catch (removeError) {
        cleanupError = removeError;
      }
      const parseReason = formatWorkspaceSessionSnapshotLocalStateError(error, '本地缓存格式无效');
      const cleanupStatus = cleanupError
        ? `损坏快照清理也失败：${formatWorkspaceSessionSnapshotLocalStateError(cleanupError, '浏览器拒绝清理本地会话存储')}；旧的 yistack_workspace_session:${targetProjectId} 可能仍会残留。`
        : '已清理损坏的 Workspace 会话快照。';
      applyWorkspaceMessages('session_snapshot_parse_failure', (prev) => {
        const messageId = `workspace-session-snapshot-parse-failed-${targetProjectId}`;
        const hasExistingMessage = hasWorkspaceSessionSnapshotMessageId(prev, messageId);
        if (hasExistingMessage === true) {
          return prev;
        }
        return [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: `本地会话快照解析失败：${parseReason}。${cleanupStatus}如果后端历史消息暂时不可用，当前聊天记录、工程状态或恢复入口可能无法从本地快照兜底恢复。`,
            timestamp: new Date().toISOString(),
          },
        ];
      });
      return null;
    }
  }, [applyWorkspaceMessages]);

  useEffect(() => {
    const hasProjectId = hasWorkspaceSessionSnapshotProjectId(projectId);
    if (hasProjectId === false) return;
    const snapshot: WorkspaceSessionSnapshot = buildWorkspaceSessionSnapshot(
      messages,
      {
        availablePlans,
        recommendedPlanId,
        selectedPlanId,
        planCountdown,
        planAutoConfirmDeadlineAt,
        planSelectionReady,
      },
      buildWorkspaceEditorSessionSnapshot(editorState),
    );
    try {
      sessionStorage.setItem(getWorkspaceSessionKey(projectId), JSON.stringify(snapshot));
    } catch (error) {
      const reason = formatWorkspaceSessionSnapshotLocalStateError(error, '浏览器拒绝写入本地会话存储');
      applyWorkspaceMessages('session_snapshot_save_failure', (prev) => {
        const messageId = `workspace-session-snapshot-save-failed-${projectId}`;
        const hasExistingMessage = hasWorkspaceSessionSnapshotMessageId(prev, messageId);
        if (hasExistingMessage === true) {
          return prev;
        }
        return [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: `本地会话快照保存失败：${reason}。当前聊天记录、工程状态和恢复入口仍保留在当前页面内存中，但刷新或离开页面后可能无法从本地快照恢复。`,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    }
  }, [
    applyWorkspaceMessages,
    availablePlans,
    editorState,
    messages,
    planAutoConfirmDeadlineAt,
    planCountdown,
    planSelectionReady,
    projectId,
    recommendedPlanId,
    selectedPlanId,
  ]);

  return {
    readWorkspaceSessionSnapshot,
  };
}
