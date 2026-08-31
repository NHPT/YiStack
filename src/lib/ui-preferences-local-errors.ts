import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type UIPreferenceLocaleStorageDetails = string;

export function formatUIPreferenceLocaleStorageFailure(
  error: unknown,
  fallback: UIPreferenceLocaleStorageDetails,
) {
  const details = error instanceof Error ? error.message : fallback;
  return formatUserVisibleApiError({
    message: details,
    source: 'local_storage',
    details,
  }, fallback);
}
