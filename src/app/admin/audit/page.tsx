'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import type { AuditLog } from '@/lib/admin/api';
import { adminAuditApi } from '@/lib/admin/api';
import { formatAdminOperationFailure } from '@/lib/admin/admin-operation-errors';
import { buildAdminAuditPageSnapshot, AdminAuditPageSnapshotStrip } from './admin-audit-page-snapshot';

function getAdminAuditCreatedAtLabel(createdAt: string): string {
  const hasCreatedAt = createdAt.length > 0;
  return hasCreatedAt === true ? new Date(createdAt).toLocaleString() : '-';
}

function shouldRenderAdminAuditTargetType(log: AuditLog): boolean {
  const hasTargetType = log.target_type.length > 0;
  return hasTargetType === true;
}

function shouldRenderAdminAuditEmptyRow(logs: AuditLog[]): boolean {
  const hasLogs = logs.length > 0;
  return hasLogs === false;
}

function materializeAdminAuditRowNodes(logs: AuditLog[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const log of logs) {
    nodes.push(
      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {getAdminAuditCreatedAtLabel(log.created_at)}
        </td>
        <td className="px-4 py-3">
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
          {shouldRenderAdminAuditTargetType(log) === true && <span className="text-xs text-gray-400">{log.target_type}/</span>}
          {log.target_id}
        </td>
        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">{log.detail}</td>
        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.ip_address}</td>
      </tr>,
    );
  }

  return nodes;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminAuditApi.list({ limit: 50 });
      setLogs(result.logs);
    } catch (err: unknown) {
      setError(formatAdminOperationFailure(err, '加载审计日志失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const adminAuditPageSnapshot = buildAdminAuditPageSnapshot({
    loading,
    error,
    logs,
  });
  const hasPageError = error.length > 0;
  const shouldRenderEmptyRow = shouldRenderAdminAuditEmptyRow(logs);
  const shouldRenderAuditRows = shouldRenderEmptyRow === false;

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminAuditPageSnapshotStrip snapshot={adminAuditPageSnapshot} />
        <div className="text-gray-500">正在加载审计日志...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">审计日志</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">管理员操作历史记录</p>
        </div>
        <button
          type="button"
          onClick={() => void loadLogs()}
          disabled={adminAuditPageSnapshot.canReload === false}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          刷新日志
        </button>
      </div>
      <AdminAuditPageSnapshotStrip snapshot={adminAuditPageSnapshot} />

      {hasPageError === true && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">时间</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">动作</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">目标</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">详情</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {shouldRenderEmptyRow === true && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">暂无审计日志</td>
              </tr>
            )}
            {shouldRenderAuditRows === true && materializeAdminAuditRowNodes(logs)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
