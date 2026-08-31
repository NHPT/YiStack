import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type WorkspaceTransientUrlLocalSource = 'browser_history';
export type WorkspaceTransientUrlLocalDetails = string;

export type WorkspaceTransientUrlLocalFailure = {
  ok: false;
  error: unknown;
  source: WorkspaceTransientUrlLocalSource;
  details: WorkspaceTransientUrlLocalDetails;
};

export function getWorkspaceTransientUrlErrorDetails(
  error: unknown,
  fallback: WorkspaceTransientUrlLocalDetails,
): WorkspaceTransientUrlLocalDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildWorkspaceTransientUrlCleanupFailure(
  error: unknown,
  fallback: WorkspaceTransientUrlLocalDetails = '浏览器拒绝更新地址栏',
): WorkspaceTransientUrlLocalFailure {
  return {
    ok: false,
    error,
    source: 'browser_history',
    details: getWorkspaceTransientUrlErrorDetails(error, fallback),
  };
}

export function formatWorkspaceTransientUrlCleanupFailure(
  failure: WorkspaceTransientUrlLocalFailure,
  fallback: WorkspaceTransientUrlLocalDetails = '浏览器拒绝更新地址栏',
) {
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: failure.details,
  }, fallback);
}
