import type {
  ChatScrollSnapshot,
  ChatScrollSnapshotSource,
  ChatScrollSnapshotStatus,
} from './workspace-types';

type MissingChatScrollContainerSnapshotOptions = {
  messageCount: number;
  anchorMissing?: boolean;
};

type UserScrollChatScrollSnapshotOptions = {
  messageCount: number;
  distanceToBottom: number;
};

export type ChatScrollManualRestoreMethod = 'container' | 'anchor';

type ManualRestoreChatScrollSnapshotOptions = {
  messageCount: number;
  method: ChatScrollManualRestoreMethod;
};

export function buildInitialChatScrollSnapshot(messageCount: number): ChatScrollSnapshot {
  return {
    status: 'empty_messages',
    source: 'message_list',
    distanceToBottom: null,
    messageCount,
    message: '聊天列表当前没有消息。',
    recovery: '发送第一条消息后，聊天列表会自动跟随最新输出。',
    updatedAt: 'pending',
  };
}

export function buildEmptyMessagesChatScrollSnapshot(): ChatScrollSnapshot {
  return {
    status: 'empty_messages',
    source: 'message_list',
    distanceToBottom: null,
    messageCount: 0,
    message: '聊天列表当前没有消息。',
    recovery: '发送第一条消息后，聊天列表会自动跟随最新输出。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildMissingChatScrollContainerSnapshot({
  messageCount,
  anchorMissing = false,
}: MissingChatScrollContainerSnapshotOptions): ChatScrollSnapshot {
  return {
    status: 'container_missing',
    source: 'scroll_effect',
    distanceToBottom: null,
    messageCount,
    message: anchorMissing
      ? '聊天滚动容器和消息末端锚点都不可用，无法恢复到最新输出。'
      : '聊天滚动容器尚未挂载，无法确认是否跟随最新输出。',
    recovery: '切回聊天面板或刷新 Workspace 后，系统会重新绑定消息滚动容器。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildUserScrollChatScrollSnapshot({
  messageCount,
  distanceToBottom,
}: UserScrollChatScrollSnapshotOptions): ChatScrollSnapshot {
  const shouldFollowLatest = distanceToBottom <= 96;
  const status: ChatScrollSnapshotStatus = messageCount === 0
    ? 'empty_messages'
    : shouldFollowLatest
      ? 'following_latest'
      : 'paused_by_user';
  const source: ChatScrollSnapshotSource = 'user_scroll';

  return {
    status,
    source,
    distanceToBottom,
    messageCount,
    message: status === 'empty_messages'
      ? '聊天列表当前没有消息。'
      : status === 'following_latest'
        ? '聊天列表正在跟随最新输出。'
        : `聊天列表已因用户上滑暂停自动跟随，距离最新输出约 ${Math.max(0, Math.round(distanceToBottom))}px。`,
    recovery: status === 'empty_messages'
      ? '发送第一条消息后，聊天列表会自动跟随最新输出。'
      : status === 'following_latest'
        ? '新消息到达时会自动滚动到最新输出。'
        : '点击“回到最新输出”可恢复自动跟随。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildManualRestoreChatScrollSnapshot({
  messageCount,
  method,
}: ManualRestoreChatScrollSnapshotOptions): ChatScrollSnapshot {
  const isEmpty = messageCount === 0;
  const status: ChatScrollSnapshotStatus = isEmpty ? 'empty_messages' : 'restored_to_latest';
  const source: ChatScrollSnapshotSource = 'manual_restore';
  return {
    status,
    source,
    distanceToBottom: 0,
    messageCount,
    message: isEmpty
      ? '聊天列表当前没有消息。'
      : method === 'anchor'
        ? '已通过消息末端锚点恢复到最新输出。'
        : '已请求滚动到最新输出并恢复自动跟随。',
    recovery: isEmpty
      ? '发送第一条消息后，聊天列表会自动跟随最新输出。'
      : '新消息到达时会继续自动滚动到最新输出。',
    updatedAt: new Date().toISOString(),
  };
}

export function buildPausedMessageCountChatScrollSnapshot(
  previousSnapshot: ChatScrollSnapshot,
  messageCount: number,
): ChatScrollSnapshot {
  return {
    ...previousSnapshot,
    messageCount,
    message: previousSnapshot.status === 'paused_by_user'
      ? previousSnapshot.message
      : '聊天列表自动跟随当前已暂停，最新消息可能在列表底部。',
    recovery: '点击“回到最新输出”可恢复自动跟随。',
    updatedAt: new Date().toISOString(),
  };
}
