import { formatUserVisibleApiError } from '@/lib/api-error-display';
import type {
  AdminAuthStorageDetails,
  AdminAuthStorageSource,
} from '@/lib/admin/admin-auth-storage-local-errors';

export type AdminAuthBrowserHistorySource = 'browser_history';
export type AdminAuthBrowserHistoryDetails = AdminAuthStorageDetails;
export type AdminAuthStorageUrlSource = AdminAuthStorageSource;
export type AdminAuthStorageUrlDetails = AdminAuthStorageDetails;
export type AdminProfileCacheUrlStorageSource = AdminAuthStorageSource;
export type AdminProfileCacheUrlStorageDetails = AdminAuthStorageDetails;

function resolveAdminAuthStorageUrlSource(source: string | null): AdminAuthStorageUrlSource {
  return source === 'session_storage' ? 'session_storage' : 'local_storage';
}

export function resolveAdminProfileCacheUrlStorageSource(
  source: string | null,
): AdminProfileCacheUrlStorageSource {
  return source === 'local_storage' ? 'local_storage' : 'session_storage';
}

export function formatAdminAuthBrowserHistoryError(
  error: unknown,
  fallback: AdminAuthBrowserHistoryDetails,
) {
  const details = error instanceof Error ? error.message : fallback;
  return formatUserVisibleApiError({
    message: details,
    source: 'browser_history' satisfies AdminAuthBrowserHistorySource,
    details,
  }, fallback);
}

export function formatAdminAuthStorageUrlFailure(
  params: URLSearchParams,
  fallback: AdminAuthStorageUrlDetails,
) {
  const source = resolveAdminAuthStorageUrlSource(params.get('admin_auth_storage_source'));
  const details: AdminAuthStorageUrlDetails = params.get('admin_auth_storage_details') || fallback;
  return formatUserVisibleApiError({
    message: details,
    source,
    details,
  }, fallback);
}

export function formatAdminProfileCacheUrlStorageFailure(
  source: AdminProfileCacheUrlStorageSource,
  details: AdminProfileCacheUrlStorageDetails,
  fallback: AdminProfileCacheUrlStorageDetails = '浏览器拒绝保存 Admin 管理员缓存',
) {
  return formatUserVisibleApiError({
    message: details,
    source,
    details,
  }, fallback);
}
