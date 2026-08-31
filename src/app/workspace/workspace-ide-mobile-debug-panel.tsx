'use client';

import { WorkspaceDebugPanel } from './workspace-ide-desktop-debug-panel';

type MobileDebugPanelProps = {
  projectId: string | null;
};

export function MobileDebugPanel({ projectId }: MobileDebugPanelProps) {
  return <WorkspaceDebugPanel projectId={projectId} compact />;
}
