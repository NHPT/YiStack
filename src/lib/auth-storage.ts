import type { User } from '@/lib/api';
import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type UserAuthStorageStatus = 'read_failed' | 'write_failed' | 'clear_failed';
export type UserAuthStorageSource = 'local_storage';
export type UserAuthStorageDetails = string;

export type UserAuthStorageSuccessResult<T = void> = {
  ok: true;
  value: T;
};

export type UserAuthStorageFailureResult = {
  ok: false;
  status: UserAuthStorageStatus;
  source: UserAuthStorageSource;
  error: unknown;
  message: UserAuthStorageDetails;
  details: UserAuthStorageDetails;
};

export type UserAuthStorageResult<T = void> =
  | UserAuthStorageSuccessResult<T>
  | UserAuthStorageFailureResult;

export type UserAuthSessionStorage = {
  token: string | null;
  userRaw: string | null;
};

export type UserAuthClearValue = {
  hadToken: boolean;
  hadUser: boolean;
};

export function formatUserAuthStorageError(
  error: unknown,
  fallback: UserAuthStorageDetails,
): UserAuthStorageDetails {
  return error instanceof Error ? error.message : fallback;
}

export function buildUserAuthStorageFailure(
  error: unknown,
  status: UserAuthStorageStatus,
  fallback: UserAuthStorageDetails,
): UserAuthStorageFailureResult {
  const details = formatUserAuthStorageError(error, fallback);
  return {
    ok: false,
    status,
    source: 'local_storage',
    error,
    message: details,
    details,
  };
}

export function formatUserAuthStorageFailure(
  result: UserAuthStorageFailureResult,
  fallback: UserAuthStorageDetails,
) {
  return formatUserVisibleApiError({
    message: result.message,
    source: result.source,
    details: result.details,
  }, fallback);
}

export function formatUserAuthCacheParseFailure(
  error: unknown,
  fallback: UserAuthStorageDetails = '普通用户缓存格式无效',
) {
  const details = formatUserAuthStorageError(error, fallback);
  return formatUserVisibleApiError({
    message: details,
    source: 'local_storage',
    details,
  }, fallback);
}

export function readUserAuthSessionStorage(): UserAuthStorageResult<UserAuthSessionStorage> {
  if (typeof window === 'undefined') {
    return { ok: true, value: { token: null, userRaw: null } };
  }

  try {
    return {
      ok: true,
      value: {
        token: localStorage.getItem('yistack_token'),
        userRaw: localStorage.getItem('yistack_user'),
      },
    };
  } catch (error) {
    return buildUserAuthStorageFailure(error, 'read_failed', '浏览器拒绝读取普通登录凭据');
  }
}

export function readUserAuthTokenStorage(): UserAuthStorageResult<string | null> {
  if (typeof window === 'undefined') {
    return { ok: true, value: null };
  }

  try {
    return { ok: true, value: localStorage.getItem('yistack_token') };
  } catch (error) {
    return buildUserAuthStorageFailure(error, 'read_failed', '浏览器拒绝读取普通登录凭据');
  }
}

export function persistUserAuthSessionStorage(token: string, user: User): UserAuthStorageResult {
  if (typeof window === 'undefined') {
    return { ok: true, value: undefined };
  }

  try {
    localStorage.setItem('yistack_token', token);
    localStorage.setItem('yistack_user', JSON.stringify(user));
    return { ok: true, value: undefined };
  } catch (error) {
    return buildUserAuthStorageFailure(error, 'write_failed', '浏览器拒绝保存普通登录凭据');
  }
}

export function persistUserProfileStorage(user: User): UserAuthStorageResult {
  if (typeof window === 'undefined') {
    return { ok: true, value: undefined };
  }

  try {
    localStorage.setItem('yistack_user', JSON.stringify(user));
    return { ok: true, value: undefined };
  } catch (error) {
    return buildUserAuthStorageFailure(error, 'write_failed', '浏览器拒绝更新普通用户缓存');
  }
}

export function clearUserAuthSessionStorage(): UserAuthStorageResult<UserAuthClearValue> {
  if (typeof window === 'undefined') {
    return { ok: true, value: { hadToken: false, hadUser: false } };
  }

  try {
    const hadToken = !!localStorage.getItem('yistack_token');
    const hadUser = !!localStorage.getItem('yistack_user');
    localStorage.removeItem('yistack_token');
    localStorage.removeItem('yistack_user');
    localStorage.removeItem('yistack_current_project');
    return { ok: true, value: { hadToken, hadUser } };
  } catch (error) {
    return buildUserAuthStorageFailure(error, 'clear_failed', '浏览器拒绝清理普通登录凭据或本地项目快照');
  }
}
