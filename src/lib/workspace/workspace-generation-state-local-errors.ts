import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceGenerationStateStorageSource = 'session_storage';
export type WorkspaceGenerationStateParseSource = 'generation_state_parse';
export type WorkspaceGenerationStateRestoreSource = 'generation_state_restore';
export type WorkspaceGenerationStateLocalSource =
  | WorkspaceGenerationStateStorageSource
  | WorkspaceGenerationStateParseSource
  | WorkspaceGenerationStateRestoreSource;
export type WorkspaceGenerationStateLocalDetails = string;
export type WorkspaceGenerationStateParseReason = string;
export type WorkspaceGenerationStateProjectId = string;
export type WorkspaceGenerationStateStatus = string;

export type WorkspaceGenerationStateLocalFailure<TSource extends WorkspaceGenerationStateLocalSource> = {
  ok: false;
  error: unknown;
  source: TSource;
  details: WorkspaceGenerationStateLocalDetails;
};

export type WorkspaceGenerationStateLocalFailureFormatInput = {
  source: WorkspaceGenerationStateLocalSource;
  details: WorkspaceGenerationStateLocalDetails;
};

export function getWorkspaceGenerationStateStorageDetails(
  error: unknown,
  fallback: WorkspaceGenerationStateLocalDetails,
): WorkspaceGenerationStateLocalDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildWorkspaceGenerationStateStorageFailure(
  error: unknown,
  fallback: WorkspaceGenerationStateLocalDetails,
): WorkspaceGenerationStateLocalFailure<'session_storage'> {
  return {
    ok: false,
    error,
    source: 'session_storage',
    details: getWorkspaceGenerationStateStorageDetails(error, fallback),
  };
}

export function buildWorkspaceGenerationStateParseDetails(
  rawState: string,
  reason: WorkspaceGenerationStateParseReason,
): WorkspaceGenerationStateLocalDetails {
  return `storage_key=yistack_generation_state；raw_length=${rawState.length}；reason=${reason}`;
}

export function buildWorkspaceGenerationStateParseFailure(
  error: unknown,
  rawState: string,
  reason: WorkspaceGenerationStateParseReason,
): WorkspaceGenerationStateLocalFailure<'generation_state_parse'> {
  return {
    ok: false,
    error,
    source: 'generation_state_parse',
    details: buildWorkspaceGenerationStateParseDetails(rawState, reason),
  };
}

export function buildWorkspaceGenerationStateInvalidShapeFailure(
  rawState: string,
): WorkspaceGenerationStateLocalFailure<'generation_state_parse'> {
  return buildWorkspaceGenerationStateParseFailure(
    new Error('本地生成恢复状态结构无效'),
    rawState,
    'invalid_generation_state_shape',
  );
}

export function buildWorkspaceGenerationStateRestoreFailure(
  error: unknown,
  projectId: WorkspaceGenerationStateProjectId,
  stateProjectId: WorkspaceGenerationStateProjectId,
  stateStatus: WorkspaceGenerationStateStatus,
): WorkspaceGenerationStateLocalFailure<'generation_state_restore'> {
  const reason: WorkspaceGenerationStateLocalDetails = error instanceof Error
    ? error.message
    : 'restore interrupted state failed';
  return {
    ok: false,
    error,
    source: 'generation_state_restore',
    details: `project_id=${projectId}；state_project_id=${stateProjectId}；state_status=${stateStatus}；reason=${reason}`,
  };
}

export function formatWorkspaceGenerationStateLocalFailure(
  failure: WorkspaceGenerationStateLocalFailureFormatInput,
  fallback: WorkspaceGenerationStateLocalDetails,
) {
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: failure.details,
  }, fallback);
}
