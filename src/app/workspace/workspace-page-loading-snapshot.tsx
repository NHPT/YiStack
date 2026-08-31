import { cn } from '@/lib/utils';

import type {
  WorkspacePageLoadingSnapshot,
  WorkspacePageLoadingSnapshotSource,
  WorkspacePageLoadingSnapshotStatus,
} from './workspace-types';

export function buildWorkspacePageLoadingSnapshot({
  label,
  source,
  authLoading,
  isAuthenticated,
  hasCustomLabel,
}: {
  label: string;
  source: WorkspacePageLoadingSnapshotSource;
  authLoading: boolean;
  isAuthenticated: boolean;
  hasCustomLabel: boolean;
}): WorkspacePageLoadingSnapshot {
  const status: WorkspacePageLoadingSnapshotStatus = source === 'suspense'
    ? 'suspense_pending'
    : authLoading
      ? 'auth_checking'
      : !isAuthenticated
        ? 'unauthenticated_redirect'
        : 'manual_loading';
  const canRedirectToAuth = status === 'unauthenticated_redirect';

  return {
    status,
    source,
    label,
    authLoading,
    isAuthenticated,
    canRedirectToAuth,
    hasCustomLabel,
    message: status === 'suspense_pending'
      ? 'Workspace 页面正在等待客户端路由与动态模块就绪。'
      : status === 'auth_checking'
        ? 'Workspace 正在确认当前用户鉴权状态。'
        : status === 'unauthenticated_redirect'
          ? 'Workspace 已识别未登录状态，正在等待跳转到登录页。'
          : 'Workspace 正在展示手工加载状态。',
    recovery: status === 'suspense_pending'
      ? '等待 Suspense 依赖恢复；若持续停留，请检查客户端动态导入。'
      : status === 'auth_checking'
        ? '等待 Auth Provider 返回结果；若持续停留，请检查用户会话刷新。'
        : status === 'unauthenticated_redirect'
          ? '等待重定向到登录页，并保留当前 workspace redirect 参数。'
          : '检查调用方传入的 label 与加载条件是否仍然有效。',
    updatedAt: 'derived',
  };
}

function getWorkspacePageLoadingSnapshotClassName(snapshot: WorkspacePageLoadingSnapshot) {
  if (snapshot.status === 'unauthenticated_redirect') {
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
  }
  if (snapshot.status === 'suspense_pending') {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100';
  }
  return 'border-border bg-background/80 text-muted-foreground';
}

function getWorkspacePageLoadingSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function WorkspacePageLoadingSnapshotStrip({ snapshot }: { snapshot: WorkspacePageLoadingSnapshot }) {
  const authLoadingLabel = getWorkspacePageLoadingSnapshotBooleanLabel(snapshot.authLoading);
  const isAuthenticatedLabel = getWorkspacePageLoadingSnapshotBooleanLabel(snapshot.isAuthenticated);
  const canRedirectToAuthLabel = getWorkspacePageLoadingSnapshotBooleanLabel(snapshot.canRedirectToAuth);
  const hasCustomLabelLabel = getWorkspacePageLoadingSnapshotBooleanLabel(snapshot.hasCustomLabel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-page-loading-snapshot"
      className={cn('mt-4 rounded-md border px-3 py-2 text-left text-xs', getWorkspacePageLoadingSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="font-medium">Workspace 加载快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Label: {snapshot.label}</span>
        <span>AuthLoading: {authLoadingLabel}</span>
        <span>Authenticated: {isAuthenticatedLabel}</span>
        <span>Redirect: {canRedirectToAuthLabel}</span>
        <span>CustomLabel: {hasCustomLabelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
