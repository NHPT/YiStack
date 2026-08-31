import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceOrchestrationLocalStateSource =
  | 'local_storage'
  | 'session_storage'
  | 'browser_history';
export type WorkspaceOrchestrationLocalStateDetails = string;

export type WorkspaceOrchestrationLocalStateFailure<TSource extends WorkspaceOrchestrationLocalStateSource> = {
  ok: false;
  error: unknown;
  source: TSource;
  details: WorkspaceOrchestrationLocalStateDetails;
};

export function getWorkspaceOrchestrationLocalStateErrorDetails(
  error: unknown,
  fallback: WorkspaceOrchestrationLocalStateDetails,
): WorkspaceOrchestrationLocalStateDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildWorkspaceOrchestrationLocalStateFailure<TSource extends WorkspaceOrchestrationLocalStateSource>(
  error: unknown,
  source: TSource,
  fallback: WorkspaceOrchestrationLocalStateDetails,
): WorkspaceOrchestrationLocalStateFailure<TSource> {
  return {
    ok: false,
    error,
    source,
    details: getWorkspaceOrchestrationLocalStateErrorDetails(error, fallback),
  };
}

export function formatWorkspaceOrchestrationLocalStateFailure(
  failure: WorkspaceOrchestrationLocalStateFailure<WorkspaceOrchestrationLocalStateSource>,
  fallback: WorkspaceOrchestrationLocalStateDetails,
) {
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: failure.details,
  }, fallback);
}
