'use client';

import { useCallback, useState } from 'react';

import { formatAdminDiagnosticLocalError } from '@/lib/admin/admin-diagnostic-local-errors';

export function useAdminDiagnosticUrlSync() {
  const [diagnosticUrlSyncError, setDiagnosticUrlSyncError] = useState('');

  const replaceUrlSearch = useCallback((nextSearch: string) => {
    if (typeof window === 'undefined') {
      return false;
    }

    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    try {
      window.history.replaceState(window.history.state, '', nextUrl);
      setDiagnosticUrlSyncError('');
      return true;
    } catch (error) {
      const reason = formatAdminDiagnosticLocalError(error, '浏览器拒绝更新地址栏', 'browser_history');
      setDiagnosticUrlSyncError(`Admin 诊断筛选地址栏同步失败：${reason}。当前筛选已在面板内生效，但地址栏和复制的诊断链接可能仍是旧状态；请稍后重试筛选或手动刷新页面确认 URL 状态。`);
      return false;
    }
  }, []);

  return {
    diagnosticUrlSyncError,
    replaceUrlSearch,
  };
}
