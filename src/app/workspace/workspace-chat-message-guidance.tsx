'use client';

import {
  WorkspaceGuidanceActions,
} from './workspace-guidance-actions';
import type { GuidanceAction, WorkspaceChatMessage } from './workspace-types';

export function MessageGuidance({
  message,
  onAskQuestion,
  onRunAction,
}: {
  message: WorkspaceChatMessage;
  onAskQuestion: (question: string) => void;
  onRunAction: (action: GuidanceAction) => void;
}) {
  return <WorkspaceGuidanceActions message={message} onAskQuestion={onAskQuestion} onRunAction={onRunAction} />;
}
