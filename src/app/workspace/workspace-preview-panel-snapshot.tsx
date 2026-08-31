'use client';

import { cn } from '@/lib/utils';

import type {
  PreviewPanelSnapshot,
  PreviewPanelSnapshotSource,
  PreviewPanelSnapshotStatus,
  PreviewUrlStatus,
  PreviewUrlStatusValue,
  PreviewUrlStatusValueList,
  WorkspaceBrowserDevice,
  WorkspacePanelSurface,
} from './workspace-types';
import { normalizePreviewBrowserUrl } from './workspace-preview-url-status';

const PREVIEW_PANEL_READY_URL_STATUSES: PreviewUrlStatusValueList = [
  'runtime_fresh',
  'project_detail_snapshot',
  'workspace_bootstrap_snapshot',
  'mobile_history',
];

type PreviewPanelBooleanFactList = readonly boolean[];
type PreviewPanelSnapshotStatusList = readonly PreviewPanelSnapshotStatus[];

const PREVIEW_PANEL_ERROR_STATUSES: PreviewPanelSnapshotStatusList = [
  'iframe_failed',
  'stale_url',
  'empty',
];

const PREVIEW_PANEL_WARNING_STATUSES: PreviewPanelSnapshotStatusList = [
  'manual_input',
  'runtime_home_available',
];

function isPreviewUrlStatusIn(
  status: PreviewUrlStatusValue | 'unknown',
  statuses: PreviewUrlStatusValueList,
): boolean {
  const hasKnownPreviewUrlStatus = status !== 'unknown';
  if (hasKnownPreviewUrlStatus === false) {
    return false;
  }

  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function hasPreviewPanelTrueFact(values: PreviewPanelBooleanFactList): boolean {
  for (const value of values) {
    const matchedValue = value === true;
    if (matchedValue === true) {
      return true;
    }
  }

  return false;
}

function isPreviewPanelSnapshotStatusIn(
  status: PreviewPanelSnapshotStatus,
  statuses: PreviewPanelSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getPreviewPanelUrlStatusValue(previewUrlStatus: PreviewUrlStatus | null): PreviewUrlStatusValue | 'unknown' {
  const hasPreviewUrlStatus = previewUrlStatus !== null;
  if (hasPreviewUrlStatus === false) {
    return 'unknown';
  }

  return previewUrlStatus.status;
}

function shouldUsePreviewPanelEmptyStatus(hasUrl: boolean, previewUrlStatusValue: PreviewUrlStatusValue | 'unknown'): boolean {
  const hasEmptyUrl = hasUrl === false;
  const hasEmptyPreviewUrlStatus = previewUrlStatusValue === 'empty';
  return hasPreviewPanelTrueFact([hasEmptyUrl, hasEmptyPreviewUrlStatus]);
}

function getPreviewPanelSnapshotStatus({
  hasIframeError,
  previewUrlStatusValue,
  hasUrl,
  hasReadyPreviewUrlStatus,
  hasRuntimeHome,
}: {
  hasIframeError: boolean;
  previewUrlStatusValue: PreviewUrlStatusValue | 'unknown';
  hasUrl: boolean;
  hasReadyPreviewUrlStatus: boolean;
  hasRuntimeHome: boolean;
}): PreviewPanelSnapshotStatus {
  if (hasIframeError === true) {
    return 'iframe_failed';
  }

  if (previewUrlStatusValue === 'stale_after_build_failure') {
    return 'stale_url';
  }

  if (previewUrlStatusValue === 'manual_input') {
    return 'manual_input';
  }

  const hasEmptyStatus = shouldUsePreviewPanelEmptyStatus(hasUrl, previewUrlStatusValue);
  if (hasEmptyStatus === true) {
    return 'empty';
  }

  if (hasReadyPreviewUrlStatus === true) {
    return 'ready';
  }

  if (hasRuntimeHome === true) {
    return 'runtime_home_available';
  }

  return 'ready';
}

function getPreviewPanelSnapshotSource({
  hasIframeError,
  previewUrlStatusValue,
  hasPreviewUrlStatus,
  hasRuntimeHome,
}: {
  hasIframeError: boolean;
  previewUrlStatusValue: PreviewUrlStatusValue | 'unknown';
  hasPreviewUrlStatus: boolean;
  hasRuntimeHome: boolean;
}): PreviewPanelSnapshotSource {
  if (hasIframeError === true) {
    return 'iframe';
  }

  if (previewUrlStatusValue === 'manual_input') {
    return 'manual_input';
  }

  if (hasPreviewUrlStatus === true) {
    return 'preview_url_status';
  }

  if (hasRuntimeHome === true) {
    return 'runtime_status';
  }

  return 'browser_url';
}

function getPreviewPanelSnapshotMessage(status: PreviewPanelSnapshotStatus): string {
  if (status === 'iframe_failed') {
    return 'Preview iframe 加载失败，当前地址未确认渲染成功。';
  }

  if (status === 'stale_url') {
    return 'Preview 当前保留旧地址，最新地址构建失败。';
  }

  if (status === 'manual_input') {
    return 'Preview 地址来自手动输入。';
  }

  if (status === 'empty') {
    return 'Preview 当前没有可确认地址。';
  }

  if (status === 'runtime_home_available') {
    return 'Runtime Home 可用，可回到运行时首页。';
  }

  return 'Preview 面板已就绪。';
}

function getPreviewPanelSnapshotRecovery(status: PreviewPanelSnapshotStatus): string {
  if (status === 'iframe_failed') {
    return '刷新 Preview 或回到 Runtime Home，确认 iframe 能否重新加载。';
  }

  if (status === 'stale_url') {
    return '检查 Preview URL 构建失败原因，必要时回到 Runtime Home。';
  }

  if (status === 'empty') {
    return '等待 runtime status、项目详情或手动输入提供 Preview URL。';
  }

  if (status === 'manual_input') {
    return '如需确认后端真源，刷新 runtime status 或回到 Runtime Home。';
  }

  return '可继续刷新 Preview、切换设备或打开 Runtime Home。';
}

export function buildPreviewPanelSnapshot({
  surface,
  device,
  browserUrl,
  previewUrlStatus,
  canReload,
  canOpenRuntimeHome,
  iframeError,
}: {
  surface: WorkspacePanelSurface;
  device: WorkspaceBrowserDevice;
  browserUrl: string;
  previewUrlStatus: PreviewUrlStatus | null;
  canReload: boolean;
  canOpenRuntimeHome: boolean;
  iframeError: string;
}): PreviewPanelSnapshot {
  const normalizedUrl = normalizePreviewBrowserUrl(browserUrl);
  const hasUrl = normalizedUrl !== 'about:blank';
  const hasIframeError = iframeError.length > 0;
  const hasPreviewUrlStatus = previewUrlStatus !== null;
  const previewUrlStatusValue = getPreviewPanelUrlStatusValue(previewUrlStatus);
  const hasRuntimeHome = canOpenRuntimeHome === true;
  const hasReadyPreviewUrlStatus = isPreviewUrlStatusIn(previewUrlStatusValue, PREVIEW_PANEL_READY_URL_STATUSES);
  const status = getPreviewPanelSnapshotStatus({
    hasIframeError,
    previewUrlStatusValue,
    hasUrl,
    hasReadyPreviewUrlStatus,
    hasRuntimeHome,
  });
  const source = getPreviewPanelSnapshotSource({
    hasIframeError,
    previewUrlStatusValue,
    hasPreviewUrlStatus,
    hasRuntimeHome,
  });

  return {
    status,
    source,
    surface,
    device,
    url: hasUrl ? normalizedUrl : 'about:blank',
    urlStatus: previewUrlStatusValue,
    canReload,
    canOpenRuntimeHome,
    hasIframeError,
    message: getPreviewPanelSnapshotMessage(status),
    recovery: getPreviewPanelSnapshotRecovery(status),
    updatedAt: 'derived',
  };
}

function getPreviewPanelSnapshotClassName(snapshot: PreviewPanelSnapshot) {
  const hasErrorStatus = isPreviewPanelSnapshotStatusIn(snapshot.status, PREVIEW_PANEL_ERROR_STATUSES);
  if (hasErrorStatus === true) {
    return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300';
  }
  const hasWarningStatus = isPreviewPanelSnapshotStatusIn(snapshot.status, PREVIEW_PANEL_WARNING_STATUSES);
  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function getPreviewPanelSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function PreviewPanelSnapshotStrip({ snapshot }: { snapshot: PreviewPanelSnapshot }) {
  const canReloadLabel = getPreviewPanelSnapshotBooleanLabel(snapshot.canReload);
  const canOpenRuntimeHomeLabel = getPreviewPanelSnapshotBooleanLabel(snapshot.canOpenRuntimeHome);
  const hasIframeErrorLabel = getPreviewPanelSnapshotBooleanLabel(snapshot.hasIframeError);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="workspace-preview-panel-snapshot"
      className={cn('mx-2 mb-2 rounded-lg border px-3 py-2 text-xs', getPreviewPanelSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">Preview 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Surface: {snapshot.surface}</span>
        <span>Device: {snapshot.device}</span>
        <span>UrlStatus: {snapshot.urlStatus}</span>
        <span>Reload: {canReloadLabel}</span>
        <span>RuntimeHome: {canOpenRuntimeHomeLabel}</span>
        <span>IframeError: {hasIframeErrorLabel}</span>
      </div>
      <p className="mt-1 truncate">URL: {snapshot.url}</p>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
    </div>
  );
}
