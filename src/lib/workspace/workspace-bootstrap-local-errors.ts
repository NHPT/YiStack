import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceBootstrapLocalStateSource =
  | 'url_project_snapshot'
  | 'local_storage'
  | 'session_storage'
  | 'browser_history';
export type WorkspaceBootstrapLocalStateDetails = string;

export type WorkspaceBootstrapLocalStateFailure<TSource extends WorkspaceBootstrapLocalStateSource> = {
  ok: false;
  error: unknown;
  source: TSource;
  details: WorkspaceBootstrapLocalStateDetails;
};

export type WorkspaceProjectPayloadParseSource = 'url' | 'localStorage';
export type WorkspaceProjectPayloadParseDetails = WorkspaceBootstrapLocalStateDetails;
export type WorkspaceProjectPayloadParseFallback = string;

export type WorkspaceProjectPayloadParseFailure = {
  source: WorkspaceProjectPayloadParseSource;
  localStateSource: WorkspaceBootstrapLocalStateSource;
  details: WorkspaceProjectPayloadParseDetails;
  fallback: WorkspaceProjectPayloadParseFallback;
};

export function getWorkspaceBootstrapLocalStateErrorDetails(
  error: unknown,
  fallback: WorkspaceBootstrapLocalStateDetails,
): WorkspaceBootstrapLocalStateDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildWorkspaceBootstrapLocalStateFailure<TSource extends WorkspaceBootstrapLocalStateSource>(
  error: unknown,
  source: TSource,
  fallback: WorkspaceBootstrapLocalStateDetails,
): WorkspaceBootstrapLocalStateFailure<TSource> {
  return {
    ok: false,
    error,
    source,
    details: getWorkspaceBootstrapLocalStateErrorDetails(error, fallback),
  };
}

export function formatWorkspaceBootstrapLocalStateError(
  source: WorkspaceBootstrapLocalStateSource,
  details: WorkspaceBootstrapLocalStateDetails,
  fallback: WorkspaceBootstrapLocalStateDetails,
) {
  return formatUserVisibleApiError({
    message: details,
    source,
    details,
  }, fallback);
}

export function buildWorkspaceProjectPayloadParseFailure(
  source: WorkspaceProjectPayloadParseSource,
  error?: unknown,
): WorkspaceProjectPayloadParseFailure {
  const fallback = source === 'url' ? '项目参数格式无效' : '本地缓存格式无效';
  return {
    source,
    localStateSource: source === 'url' ? 'url_project_snapshot' : 'local_storage',
    details: getWorkspaceBootstrapLocalStateErrorDetails(error, fallback),
    fallback,
  };
}
