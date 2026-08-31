import type {
  ChatThoughtProcessContentKind,
  ChatThoughtProcessSnapshot,
  ChatThoughtProcessSnapshotSource,
  ChatThoughtProcessSnapshotStatus,
} from './workspace-types';

type ChatThoughtProcessSnapshotOptions = {
  contentLength: number;
  streaming: boolean;
  open: boolean;
  fallback: boolean;
  source: ChatThoughtProcessSnapshotSource;
};

function isChatThoughtProcessSnapshotFallback(fallback: boolean): boolean {
  return fallback === true;
}

function isChatThoughtProcessSnapshotStreaming(streaming: boolean): boolean {
  return streaming === true;
}

function isChatThoughtProcessSnapshotOpen(open: boolean): boolean {
  return open === true;
}

function isChatThoughtProcessSnapshotUserToggle(source: ChatThoughtProcessSnapshotSource): boolean {
  return source === 'user_toggle';
}

function getChatThoughtProcessContentKind(fallback: boolean): ChatThoughtProcessContentKind {
  const isFallback = isChatThoughtProcessSnapshotFallback(fallback);
  return isFallback === true ? 'status_fallback' : 'reasoning';
}

function getChatThoughtProcessStreamingSource(fallback: boolean): ChatThoughtProcessSnapshotSource {
  const isFallback = isChatThoughtProcessSnapshotFallback(fallback);
  return isFallback === true ? 'status_content' : 'reasoning_content';
}

export function buildChatThoughtProcessSnapshot({
  contentLength,
  streaming,
  open,
  fallback,
  source,
}: ChatThoughtProcessSnapshotOptions): ChatThoughtProcessSnapshot {
  const contentKind = getChatThoughtProcessContentKind(fallback);
  const isFallback = isChatThoughtProcessSnapshotFallback(fallback);

  if (contentLength === 0) {
    const status: ChatThoughtProcessSnapshotStatus = 'empty';
    const snapshotSource: ChatThoughtProcessSnapshotSource = 'message_restore';
    return {
      status,
      source: snapshotSource,
      contentKind,
      contentLength,
      isOpen: false,
      message: isFallback === true ? '当前消息没有可展示的动作状态。' : '当前消息没有可展示的思考过程。',
      recovery: '检查消息恢复数据是否缺少 reasoningContent 或 statusContent。',
      updatedAt: 'derived',
    };
  }

  const isStreaming = isChatThoughtProcessSnapshotStreaming(streaming);
  if (isStreaming === true) {
    const status: ChatThoughtProcessSnapshotStatus = 'streaming';
    const snapshotSource = getChatThoughtProcessStreamingSource(fallback);
    return {
      status,
      source: snapshotSource,
      contentKind,
      contentLength,
      isOpen: true,
      message: isFallback === true ? '当前动作状态正在流式更新。' : '思考过程正在流式更新。',
      recovery: '等待流式更新完成后再根据最终消息继续操作。',
      updatedAt: 'derived',
    };
  }

  const isOpen = isChatThoughtProcessSnapshotOpen(open);
  if (isOpen === true) {
    const status: ChatThoughtProcessSnapshotStatus = 'expanded';
    return {
      status,
      source,
      contentKind,
      contentLength,
      isOpen: true,
      message: isFallback === true ? '动作记录已展开，当前可查看状态细节。' : '思考过程已展开，当前可查看推理细节。',
      recovery: '确认内容后可以折叠该区域，继续查看消息正文或恢复入口。',
      updatedAt: 'derived',
    };
  }

  const isUserToggle = isChatThoughtProcessSnapshotUserToggle(source);
  const status: ChatThoughtProcessSnapshotStatus = isUserToggle === true ? 'collapsed' : 'settled';
  return {
    status,
    source,
    contentKind,
    contentLength,
    isOpen: false,
    message: isUserToggle === true
      ? '该区域已由用户折叠，内容仍保留在当前消息中。'
      : '该区域已完成并默认折叠，内容仍可展开查看。',
    recovery: '点击标题可重新展开查看细节。',
    updatedAt: 'derived',
  };
}
