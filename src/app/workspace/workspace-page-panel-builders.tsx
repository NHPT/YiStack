'use client';

import { WorkspaceChatPanel, WorkspaceDesktopChatHeader } from './workspace-chat-components';
import { WorkspaceDesktopIde, WorkspaceMobileIde } from './workspace-ide-panels';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';
import type {
  ChatComposerProps,
  ChatMessagesProps,
  DesktopIdeProps,
  MobileIdeProps,
} from './workspace-page-panel-props';

export function buildDesktopChatPanel({
  onCollapseDesktopChat,
  messagesProps,
  composerProps,
  engineeringState,
}: {
  onCollapseDesktopChat: () => void;
  messagesProps: ChatMessagesProps;
  composerProps: ChatComposerProps;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
}) {
  return (
    <WorkspaceChatPanel
      header={<WorkspaceDesktopChatHeader onCollapse={onCollapseDesktopChat} />}
      messagesProps={messagesProps}
      composerProps={composerProps}
      engineeringState={engineeringState}
    />
  );
}

export function buildMobileChatPanel({
  messagesProps,
  composerProps,
  engineeringState,
}: {
  messagesProps: ChatMessagesProps;
  composerProps: ChatComposerProps;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
}) {
  return (
    <WorkspaceChatPanel
      messagesProps={messagesProps}
      composerProps={composerProps}
      engineeringState={engineeringState}
    />
  );
}

export function buildDesktopIdePanel(props: DesktopIdeProps) {
  return <WorkspaceDesktopIde {...props} />;
}

export function buildMobileIdePanel(props: MobileIdeProps) {
  return <WorkspaceMobileIde {...props} />;
}
