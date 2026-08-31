import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type AdminAuthStorageStatus = 'saved' | 'read_failed' | 'write_failed' | 'clear_failed';
export type AdminAuthStorageFailureStatus = 'read_failed' | 'write_failed' | 'clear_failed';
export type AdminAuthStorageRedirectStatus = 'read_failed' | 'clear_failed';
export type AdminAuthStorageSource = 'local_storage' | 'session_storage';
export type AdminAuthStorageDetails = string;

export type AdminAuthStorageResult<T = void> =
  | { ok: true; value: T }
  | AdminAuthStorageFailureResult;

export type AdminAuthStorageFailureResult = {
  ok: false;
  status: AdminAuthStorageFailureStatus;
  source: AdminAuthStorageSource;
  error: unknown;
  message: AdminAuthStorageDetails;
  details: AdminAuthStorageDetails;
};

export function getAdminAuthStorageErrorDetails(
  error: unknown,
  fallback: AdminAuthStorageDetails,
): AdminAuthStorageDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildAdminAuthStorageFailure(
  error: unknown,
  status: AdminAuthStorageFailureStatus,
  source: AdminAuthStorageSource,
  fallback: AdminAuthStorageDetails,
): AdminAuthStorageFailureResult {
  const details = getAdminAuthStorageErrorDetails(error, fallback);
  return {
    ok: false,
    status,
    source,
    error,
    message: details,
    details,
  };
}

export function formatAdminAuthStorageFailure(
  result: AdminAuthStorageFailureResult,
  fallback: AdminAuthStorageDetails,
) {
  return formatUserVisibleApiError({
    message: result.message,
    source: result.source,
    details: result.details,
  }, fallback);
}
