'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminAuthApi } from '@/lib/admin/api';
import type { AdminLoginResponse } from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import { formatAdminAuthStorageUrlFailure } from '@/lib/admin/admin-auth-local-errors';
import { buildAdminLoginPageSnapshot, AdminLoginPageSnapshotStrip } from './admin-login-page-snapshot';

function getAdminProfileCacheErrorDetails(result: AdminLoginResponse): string {
  const profileCacheErrorDetails = result.profile_cache_error_details;
  const hasProfileCacheErrorDetails = profileCacheErrorDetails !== undefined;
  if (hasProfileCacheErrorDetails === true) {
    return profileCacheErrorDetails;
  }

  const profileCacheError = result.profile_cache_error;
  const hasProfileCacheError = profileCacheError !== undefined;
  if (hasProfileCacheError === true) {
    return profileCacheError;
  }

  return '';
}

function buildAdminProfileCacheFailureTarget(result: AdminLoginResponse) {
  const params = new URLSearchParams({ admin_profile_cache_status: 'failed' });
  const profileCacheErrorSource = result.profile_cache_error_source;
  const hasProfileCacheErrorSource = profileCacheErrorSource !== undefined && profileCacheErrorSource.length > 0;
  if (hasProfileCacheErrorSource === true) {
    params.set('admin_profile_cache_source', profileCacheErrorSource);
  }
  const profileCacheErrorDetails = getAdminProfileCacheErrorDetails(result);
  const hasProfileCacheErrorDetails = profileCacheErrorDetails.length > 0;
  if (hasProfileCacheErrorDetails === true) {
    params.set('admin_profile_cache_details', profileCacheErrorDetails);
  }
  return `/admin/llm?${params.toString()}`;
}

function getAdminLoginSubmitActionLabel(loading: boolean): string {
  return loading === true ? '登录中...' : '登录';
}

function getAdminPasswordChangeActionLabel(loading: boolean): string {
  return loading === true ? '修改中...' : '修改密码';
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authStorageNotice, setAuthStorageNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState('/admin/llm');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const adminLoginPageSnapshot = buildAdminLoginPageSnapshot({
    email,
    password,
    error,
    authStorageNotice,
    loading,
    redirecting,
    redirectTarget,
  });
  const hasLoginError = error.length > 0;
  const hasAuthStorageNotice = authStorageNotice !== null && authStorageNotice.length > 0;
  const submitActionLabel = getAdminLoginSubmitActionLabel(loading);
  const passwordChangeActionLabel = getAdminPasswordChangeActionLabel(loading);
  const canChangePassword = loading === false
    && password.length > 0
    && newPassword.length >= 12
    && newPassword === confirmPassword;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStorageStatus = params.get('admin_auth_storage');
    if (authStorageStatus === 'read_failed') {
      const reason = formatAdminAuthStorageUrlFailure(params, '浏览器拒绝访问本地 admin_token');
      setAuthStorageNotice(`Admin 登录凭据读取失败：${reason}。请检查浏览器本地存储权限后重新登录。`);
    } else if (authStorageStatus === 'clear_failed') {
      const reason = formatAdminAuthStorageUrlFailure(params, '浏览器拒绝清理 admin_token 或 admin_profile');
      setAuthStorageNotice(`Admin 登录凭据清理失败：${reason}。你已回到登录页，但旧凭据可能仍残留；请检查浏览器本地存储权限。`);
    }

    if (params.get('password_change') !== 'required') {
      return;
    }
    const tokenResult = adminAuthApi.readTokenStorage();
    if (!tokenResult.ok || !tokenResult.value) {
      setAuthStorageNotice('请先使用默认管理员密码登录，然后立即设置新密码。');
      return;
    }
    setLoading(true);
    adminAuthApi.getProfile()
      .then((profile) => {
        if (profile.must_change_password === true) {
          setEmail(profile.email);
          setMustChangePassword(true);
          return;
        }
        setRedirecting(true);
        router.replace('/admin/llm');
      })
      .catch((profileError: unknown) => {
        adminAuthApi.logout();
        setError(formatAdminOperationFailure(profileError, '管理员登录状态校验失败，请重新登录'));
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await adminAuthApi.login({ email, password });
      const hasToken = result.token.length > 0;
      if (hasToken === true) {
        if (result.admin.must_change_password === true) {
          setMustChangePassword(true);
          return;
        }
        const nextRedirectTarget = result.profile_cache_status === 'write_failed'
          ? buildAdminProfileCacheFailureTarget(result)
          : '/admin/llm';
        setRedirectTarget(nextRedirectTarget);
        setRedirecting(true);
        router.replace(nextRedirectTarget);
      }
    } catch (err: unknown) {
      const msg = formatAdminOperationFailure(err, '登录失败');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setLoading(true);
    try {
      const result = await adminAuthApi.changePassword({
        current_password: password,
        new_password: newPassword,
      });
      const nextRedirectTarget = result.profile_cache_status === 'write_failed'
        ? buildAdminProfileCacheFailureTarget(result)
        : '/admin/llm';
      setRedirectTarget(nextRedirectTarget);
      setRedirecting(true);
      router.replace(nextRedirectTarget);
    } catch (changeError: unknown) {
      setError(formatAdminOperationFailure(changeError, '修改密码失败'));
    } finally {
      setLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md space-y-4 px-4">
          <AdminLoginPageSnapshotStrip snapshot={adminLoginPageSnapshot} />
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">正在进入管理后台...</div>
        </div>
      </div>
    );
  }

  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">修改默认密码</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              首次登录必须设置至少 12 个字符的新密码。
            </p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                当前密码
              </label>
              <input
                id="current-password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                新密码
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={12}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                确认新密码
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {hasLoginError === true && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={canChangePassword === false}
              className="w-full py-2.5 px-4 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordChangeActionLabel}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">YiStack</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">管理后台</p>
        </div>
        <AdminLoginPageSnapshotStrip snapshot={adminLoginPageSnapshot} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              管理员邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="admin@yistack.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="请输入密码"
            />
          </div>

          {hasLoginError === true && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}
          {hasAuthStorageNotice === true && (
            <div role="status" className="p-3 text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-lg">
              {authStorageNotice}
            </div>
          )}

          <button
            type="submit"
            disabled={adminLoginPageSnapshot.canSubmit === false}
            className="w-full py-2.5 px-4 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitActionLabel}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400">
          <Link
            href="/"
            aria-disabled={adminLoginPageSnapshot.canReturnHome === false}
            className="hover:text-gray-600 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:text-gray-300"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
