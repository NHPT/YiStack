import type { Dispatch, SetStateAction } from 'react';

import { formatWorkspaceGenerationStateLocalFailure } from '@/lib/workspace/workspace-generation-state-local-errors';

import type {
  PersistGenerationStateResult,
  WorkspaceChatMessage,
} from './workspace-types';

const generationStatePersistenceFailureMessageIds = {
  save: 'generation-state-persist-failed-save',
  clear: 'generation-state-persist-failed-clear',
} as const;

function hasGenerationStatePersistenceMessageId(
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

function hasGenerationStatePersistenceSucceeded(
  result: PersistGenerationStateResult,
): result is { ok: true } {
  return result.ok === true;
}

export function appendGenerationStatePersistenceFailureMessage(
  applyGenerationStateMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>,
  result: PersistGenerationStateResult,
) {
  const hasSucceeded = hasGenerationStatePersistenceSucceeded(result);
  if (hasSucceeded === true) return;

  const isSaveFailure = result.operation === 'save';
  const messageId = generationStatePersistenceFailureMessageIds[result.operation];
  const reason = formatWorkspaceGenerationStateLocalFailure(result, isSaveFailure
    ? '浏览器拒绝写入本地生成恢复状态'
    : '浏览器拒绝清理本地生成恢复状态');

  applyGenerationStateMessages((prev) => {
    const hasExistingMessage = hasGenerationStatePersistenceMessageId(prev, messageId);
    if (hasExistingMessage === true) return prev;
    return [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        content: isSaveFailure
          ? `本地生成恢复状态保存失败：${reason}。当前生成仍会在本页继续，但刷新或离开页面后可能无法提示上一次生成已中断；请在当前页面完成或手动记录关键输入后再离开。`
          : `本地生成恢复状态清理失败：${reason}。已完成或已停止的本地生成恢复状态可能仍留在浏览器会话存储中；如果刷新后再次看到中断提示，请以当前页面的最新生成状态为准。`,
        timestamp: new Date().toISOString(),
      },
    ];
  });
}
