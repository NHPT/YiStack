import type { WorkspaceSessionSnapshot } from './workspace-types';

export type WorkspaceSessionSnapshotContract = {
  readWorkspaceSessionSnapshot: (projectId: string) => WorkspaceSessionSnapshot | null;
};
