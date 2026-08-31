import type { PreviewUrlStatus, WorkspacePreviewUrlSurface } from './workspace-types';

type PreviewUrlBuildFailureStatusOptions = {
  surface: WorkspacePreviewUrlSurface;
  currentUrl: string;
  failurePrefix: string;
  reasonMessage: string;
};

type ManualPreviewUrlStatusOptions = {
  surface: WorkspacePreviewUrlSurface;
  value: string;
};

type RuntimeHomePreviewUrlStatusOptions = {
  surface: WorkspacePreviewUrlSurface;
  value: string;
};

type ConfirmedPreviewUrlStatusOptions = {
  surface: WorkspacePreviewUrlSurface;
  value: string;
};

export type MobileHistoryPreviewUrlStatusAction = 'navigate' | 'back' | 'forward';

type MobileHistoryPreviewUrlStatusOptions = {
  value: string;
  action: MobileHistoryPreviewUrlStatusAction;
};

function formatPreviewSurfaceLabel(surface: WorkspacePreviewUrlSurface) {
  return surface === 'mobile' ? '移动端' : '桌面';
}

export function normalizePreviewBrowserUrl(value: string): string {
  const normalized = value.trim();
  return normalized || 'about:blank';
}

function formatMobileHistoryMessage(action: MobileHistoryPreviewUrlStatusAction, value: string) {
  if (action === 'back') {
    return `移动端 Preview 已回退到历史地址 ${value}，当前地址来自本地移动端浏览历史。`;
  }

  if (action === 'forward') {
    return `移动端 Preview 已前进到历史地址 ${value}，当前地址来自本地移动端浏览历史。`;
  }

  return `移动端 Preview 已导航到 ${value}，当前地址来自本地移动端浏览历史。`;
}

export function buildPreviewUrlBuildFailureStatus({
  surface,
  currentUrl,
  failurePrefix,
  reasonMessage,
}: PreviewUrlBuildFailureStatusOptions): PreviewUrlStatus {
  const url = normalizePreviewBrowserUrl(currentUrl);
  const hasConfirmedUrl = url !== 'about:blank';

  return {
    status: hasConfirmedUrl ? 'stale_after_build_failure' : 'empty',
    source: 'preview_url_build',
    surface,
    url,
    message: hasConfirmedUrl
      ? `${failurePrefix}：${reasonMessage}当前 Preview 面板仍保留旧地址 ${url}，不能视为最新运行时地址。`
      : `${failurePrefix}：${reasonMessage}当前 Preview 面板没有可确认地址。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildManualPreviewUrlStatus({
  surface,
  value,
}: ManualPreviewUrlStatusOptions): PreviewUrlStatus {
  const url = normalizePreviewBrowserUrl(value);
  const surfaceLabel = formatPreviewSurfaceLabel(surface);
  const hasManualUrl = url !== 'about:blank';

  return {
    status: hasManualUrl ? 'manual_input' : 'empty',
    source: 'manual_input',
    surface,
    url,
    message: hasManualUrl
      ? `${surfaceLabel} Preview 地址已手动输入为 ${url}，尚未由运行时状态重新确认。`
      : `${surfaceLabel} Preview 地址已被手动清空，当前没有可确认预览地址。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildRuntimeHomePreviewUrlStatus({
  surface,
  value,
}: RuntimeHomePreviewUrlStatusOptions): PreviewUrlStatus {
  const surfaceLabel = formatPreviewSurfaceLabel(surface);

  return {
    status: 'runtime_fresh',
    source: 'runtime_status',
    surface,
    url: value,
    message: `${surfaceLabel} Preview 已回到运行时 Home 地址：${value}。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildRuntimeFreshPreviewUrlStatus({
  surface,
  value,
}: ConfirmedPreviewUrlStatusOptions): PreviewUrlStatus {
  const surfaceLabel = formatPreviewSurfaceLabel(surface);

  return {
    status: 'runtime_fresh',
    source: 'runtime_status',
    surface,
    url: value,
    message: `${surfaceLabel} Preview URL 已从运行时状态同步：${value}。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildProjectDetailPreviewUrlStatus({
  surface,
  value,
}: ConfirmedPreviewUrlStatusOptions): PreviewUrlStatus {
  const surfaceLabel = formatPreviewSurfaceLabel(surface);

  return {
    status: 'project_detail_snapshot',
    source: 'project_detail',
    surface,
    url: value,
    message: `${surfaceLabel} Preview URL 已从项目详情同步：${value}。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildWorkspaceBootstrapPreviewUrlStatus({
  surface,
  value,
}: ConfirmedPreviewUrlStatusOptions): PreviewUrlStatus {
  const surfaceLabel = formatPreviewSurfaceLabel(surface);

  return {
    status: 'workspace_bootstrap_snapshot',
    source: 'workspace_bootstrap',
    surface,
    url: value,
    message: `${surfaceLabel} Preview URL 已从 Workspace 初始化快照恢复：${value}。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildMobileHistoryPreviewUrlStatus({
  value,
  action,
}: MobileHistoryPreviewUrlStatusOptions): PreviewUrlStatus {
  const url = normalizePreviewBrowserUrl(value);
  const hasHistoryUrl = url !== 'about:blank';

  return {
    status: hasHistoryUrl ? 'mobile_history' : 'empty',
    source: 'mobile_navigation',
    surface: 'mobile',
    url,
    message: hasHistoryUrl
      ? formatMobileHistoryMessage(action, url)
      : '移动端 Preview 历史地址为空，当前没有可确认预览地址。',
    updatedAt: new Date().toISOString(),
  };
}
