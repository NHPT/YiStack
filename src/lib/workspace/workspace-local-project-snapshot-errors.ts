import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceLocalProjectSnapshotOperation = 'read' | 'clear';
export type WorkspaceLocalProjectSnapshotSource = 'local_storage';
export type WorkspaceLocalProjectSnapshotDetails = string;

export type WorkspaceLocalProjectSnapshotFailure<TOperation extends WorkspaceLocalProjectSnapshotOperation> = {
  ok: false;
  error: unknown;
  operation: TOperation;
  source: WorkspaceLocalProjectSnapshotSource;
  details: WorkspaceLocalProjectSnapshotDetails;
};

export function getWorkspaceLocalProjectSnapshotErrorDetails(
  error: unknown,
  fallback: WorkspaceLocalProjectSnapshotDetails,
): WorkspaceLocalProjectSnapshotDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildWorkspaceLocalProjectSnapshotFailure<
  TOperation extends WorkspaceLocalProjectSnapshotOperation,
>(
  error: unknown,
  operation: TOperation,
  fallback: WorkspaceLocalProjectSnapshotDetails,
): WorkspaceLocalProjectSnapshotFailure<TOperation> {
  return {
    ok: false,
    error,
    operation,
    source: 'local_storage',
    details: getWorkspaceLocalProjectSnapshotErrorDetails(error, fallback),
  };
}

export function formatWorkspaceLocalProjectSnapshotFailure(
  failure: WorkspaceLocalProjectSnapshotFailure<WorkspaceLocalProjectSnapshotOperation>,
  fallback: WorkspaceLocalProjectSnapshotDetails = '浏览器拒绝访问本地 Workspace 项目快照',
) {
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: `operation=${failure.operation}；details=${failure.details}`,
  }, fallback);
}
