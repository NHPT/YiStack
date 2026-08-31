import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceSessionSnapshotLocalStateSource = 'session_storage';
export type WorkspaceSessionSnapshotLocalStateDetails = string;

export type WorkspaceSessionSnapshotLocalStateFailure = {
  ok: false;
  error: unknown;
  source: WorkspaceSessionSnapshotLocalStateSource;
  details: WorkspaceSessionSnapshotLocalStateDetails;
};

export function getWorkspaceSessionSnapshotLocalStateDetails(
  error: unknown,
  fallback: WorkspaceSessionSnapshotLocalStateDetails,
): WorkspaceSessionSnapshotLocalStateDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildWorkspaceSessionSnapshotLocalStateFailure(
  error: unknown,
  fallback: WorkspaceSessionSnapshotLocalStateDetails,
): WorkspaceSessionSnapshotLocalStateFailure {
  return {
    ok: false,
    error,
    source: 'session_storage',
    details: getWorkspaceSessionSnapshotLocalStateDetails(error, fallback),
  };
}

export function formatWorkspaceSessionSnapshotLocalStateError(
  error: unknown,
  fallback: WorkspaceSessionSnapshotLocalStateDetails,
) {
  const failure = buildWorkspaceSessionSnapshotLocalStateFailure(error, fallback);
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: failure.details,
  }, fallback);
}
