'use client';

import { useCallback, useState } from 'react';

import {
  formatAdminDiagnosticLocalError,
  formatAdminDiagnosticMissingClipboardError,
} from '@/lib/admin/admin-diagnostic-local-errors';

export function useAdminDiagnosticLinkCopy() {
  const [diagnosticLinkCopied, setDiagnosticLinkCopied] = useState(false);
  const [diagnosticLinkCopyError, setDiagnosticLinkCopyError] = useState('');

  const copyCurrentDiagnosticLink = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.clipboard) {
      const reason = formatAdminDiagnosticMissingClipboardError();
      setDiagnosticLinkCopied(false);
      setDiagnosticLinkCopyError(`复制诊断链接失败：${reason}，当前诊断链接没有写入系统剪贴板。`);
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setDiagnosticLinkCopyError('');
      setDiagnosticLinkCopied(true);
      window.setTimeout(() => setDiagnosticLinkCopied(false), 2000);
    } catch (error) {
      const reason = formatAdminDiagnosticLocalError(error, '浏览器拒绝了剪贴板访问', 'clipboard');
      setDiagnosticLinkCopied(false);
      setDiagnosticLinkCopyError(`复制诊断链接失败：${reason}。当前诊断链接没有写入系统剪贴板；你可以手动复制地址栏链接。`);
    }
  }, []);

  return {
    diagnosticLinkCopied,
    diagnosticLinkCopyError,
    copyCurrentDiagnosticLink,
  };
}
