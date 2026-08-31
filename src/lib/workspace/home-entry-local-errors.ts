import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type HomeEntryLocalStateSource =
  | 'local_storage'
  | 'session_storage';
export type HomeEntryLocalStateDetails = string;
export type HomeEntryLocalStateCleanupDetails = HomeEntryLocalStateDetails;

export type HomeEntryLocalStateFailure<TSource extends HomeEntryLocalStateSource> = {
  ok: false;
  error: unknown;
  source: TSource;
  details: HomeEntryLocalStateDetails;
  cleanupError?: unknown;
  cleanupDetails?: HomeEntryLocalStateCleanupDetails;
};

export function getHomeEntryLocalStateErrorDetails(
  error: unknown,
  fallback: HomeEntryLocalStateDetails,
): HomeEntryLocalStateDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildHomeEntryLocalStateFailure<TSource extends HomeEntryLocalStateSource>(
  error: unknown,
  source: TSource,
  fallback: HomeEntryLocalStateDetails,
  cleanup?: {
    error: unknown;
    fallback: HomeEntryLocalStateCleanupDetails;
  },
): HomeEntryLocalStateFailure<TSource> {
  return {
    ok: false,
    error,
    source,
    details: getHomeEntryLocalStateErrorDetails(error, fallback),
    ...(cleanup
      ? {
        cleanupError: cleanup.error,
        cleanupDetails: getHomeEntryLocalStateErrorDetails(cleanup.error, cleanup.fallback),
      }
      : {}),
  };
}

export function buildHomeEntryLocalStateFailureFromDetails<TSource extends HomeEntryLocalStateSource>(
  source: TSource,
  details: HomeEntryLocalStateDetails,
): HomeEntryLocalStateFailure<TSource> {
  return {
    ok: false,
    error: details,
    source,
    details,
  };
}

export function formatHomeEntryLocalStateFailure(
  failure: HomeEntryLocalStateFailure<HomeEntryLocalStateSource>,
  fallback: HomeEntryLocalStateDetails,
) {
  return formatUserVisibleApiError({
    message: failure.details,
    source: failure.source,
    details: failure.details,
  }, fallback);
}

export function formatHomeEntryLocalStateCleanupFailure(
  failure: HomeEntryLocalStateFailure<HomeEntryLocalStateSource>,
  fallback: HomeEntryLocalStateCleanupDetails,
) {
  const details = failure.cleanupDetails !== undefined ? failure.cleanupDetails : fallback;
  return formatUserVisibleApiError({
    message: details,
    source: failure.source,
    details,
  }, fallback);
}
