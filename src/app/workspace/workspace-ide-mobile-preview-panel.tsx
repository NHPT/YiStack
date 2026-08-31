'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, Home as HomeIcon, Monitor, MoreVertical, RefreshCw, Smartphone, Tablet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ProjectRuntimeStatus } from '@/lib/api';
import { projectApi } from '@/lib/api';
import { formatPreviewIframeError } from '@/lib/workspace/preview-local-errors';

import type { MobilePreviewPanelProps } from './workspace-ide-subpanel-types';
import type { PreviewUrlStatus, WorkspaceBrowserDevice } from './workspace-types';
import { PreviewRuntimeRecoveryNotice, PreviewShareControl, RuntimeHealthBanner } from './workspace-ide-desktop-preview-panel';
import { buildPreviewPanelSnapshot, PreviewPanelSnapshotStrip } from './workspace-preview-panel-snapshot';
import { normalizePreviewBrowserUrl } from './workspace-preview-url-status';
import {
  formatPreviewUrlStatusTitle,
  getPreviewUrlStatusClassName,
} from './workspace-ide-desktop-preview-panel';

function getMobilePreviewProjectId(projectId: string | null): string | null {
  if (projectId === null) {
    return null;
  }

  const hasProjectId = projectId.length > 0;
  if (hasProjectId === true) {
    return projectId;
  }

  return null;
}

function getMobilePreviewRuntimeHomeUrl(runtimeStatus: ProjectRuntimeStatus | undefined): string {
  if (runtimeStatus === undefined) {
    return '';
  }

  const previewUrl = runtimeStatus.previewUrl;
  if (previewUrl === undefined) {
    return '';
  }

  return previewUrl.trim();
}

function hasMobilePreviewTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasMobilePreviewUrlStatus(status: PreviewUrlStatus | null): status is PreviewUrlStatus {
  return status !== null;
}

function getMobilePreviewRenderableUrlStatus(
  mobilePreviewUrlStatus: PreviewUrlStatus | null,
): PreviewUrlStatus | null {
  if (hasMobilePreviewUrlStatus(mobilePreviewUrlStatus) === true) {
    return mobilePreviewUrlStatus;
  }

  return null;
}

function getMobilePreviewNavigationUrl(rawUrl: string): string | null {
  if (hasMobilePreviewTextValue(rawUrl) === false) {
    return null;
  }

  const hasProtocol = rawUrl.startsWith('http');
  if (hasProtocol === true) {
    return rawUrl;
  }

  return `https://${rawUrl}`;
}

function getMobilePreviewBrowserInputValue(mobileBrowserUrl: string): string {
  if (mobileBrowserUrl === 'about:blank') {
    return '';
  }

  return mobileBrowserUrl;
}

function isMobilePreviewTabletDevice(browserDevice: WorkspaceBrowserDevice): boolean {
  const isTabletPortrait = browserDevice === 'tablet';
  if (isTabletPortrait === true) {
    return true;
  }

  const isTabletLandscape = browserDevice === 'tablet-landscape';
  if (isTabletLandscape === true) {
    return true;
  }

  return false;
}

function getMobilePreviewDeviceButtonVariant(
  browserDevice: WorkspaceBrowserDevice,
  targetDevice: WorkspaceBrowserDevice,
): 'secondary' | 'ghost' {
  const isActiveDevice = browserDevice === targetDevice;
  if (isActiveDevice === true) {
    return 'secondary';
  }

  return 'ghost';
}

function getMobilePreviewTabletButtonVariant(browserDevice: WorkspaceBrowserDevice): 'secondary' | 'ghost' {
  const isTabletDevice = isMobilePreviewTabletDevice(browserDevice);
  if (isTabletDevice === true) {
    return 'secondary';
  }

  return 'ghost';
}

function getMobilePreviewFrameWidth(browserDevice: WorkspaceBrowserDevice): string {
  const isMobileDevice = browserDevice === 'mobile';
  if (isMobileDevice === true) {
    return '375px';
  }

  const isTabletDevice = isMobilePreviewTabletDevice(browserDevice);
  if (isTabletDevice === true) {
    return '768px';
  }

  return '100%';
}

function getMobilePreviewFrameHeight(browserDevice: WorkspaceBrowserDevice): string {
  const isTabletLandscape = browserDevice === 'tablet-landscape';
  if (isTabletLandscape === true) {
    return '576px';
  }

  return '667px';
}

function shouldRenderMobilePreviewIframe(normalizedMobileBrowserUrl: string): boolean {
  const shouldRenderIframe = normalizedMobileBrowserUrl !== 'about:blank';
  return shouldRenderIframe === true;
}

function shouldStartMobilePreviewRuntimeHeartbeat(
  activeProjectId: string | null,
  normalizedMobileBrowserUrl: string,
): activeProjectId is string {
  if (activeProjectId === null) {
    return false;
  }

  const shouldRenderIframe = shouldRenderMobilePreviewIframe(normalizedMobileBrowserUrl);
  if (shouldRenderIframe === false) {
    return false;
  }

  return true;
}

function shouldAutoOpenMobileRuntimeHome(
  normalizedMobileBrowserUrl: string,
  hasRuntimeHomeUrl: boolean,
): boolean {
  if (normalizedMobileBrowserUrl !== 'about:blank') {
    return false;
  }

  return hasRuntimeHomeUrl === true;
}

function getMobilePreviewRenderableStatusMessage(message: string): string | null {
  const hasMessage = hasMobilePreviewTextValue(message);
  if (hasMessage === true) {
    return message;
  }

  return null;
}

export function MobilePreviewPanel({
  projectId,
  browserDevice,
  historyIndex,
  browserHistoryLength,
  mobileBrowserUrl,
  mobilePreviewUrlStatus,
  previewReloadToken,
  runtimeStatus,
  onOpenCapabilityAudit,
  onOpenRuntimeHomeUrl,
  onRecoverRuntime,
  onSetBrowserDevice,
  onGoBrowserBack,
  onGoForward,
  onChangeMobileBrowserUrl,
  onNavigateTo,
}: MobilePreviewPanelProps) {
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [previewIframeError, setPreviewIframeError] = useState('');
  const [mobileBrowserUrlDraft, setMobileBrowserUrlDraft] = useState(() => getMobilePreviewBrowserInputValue(mobileBrowserUrl));
  const runtimeHomeUrl = getMobilePreviewRuntimeHomeUrl(runtimeStatus);
  const hasRuntimeHomeUrl = hasMobilePreviewTextValue(runtimeHomeUrl);
  const normalizedMobileBrowserUrl = normalizePreviewBrowserUrl(mobileBrowserUrl);
  const shouldRenderPreviewIframe = shouldRenderMobilePreviewIframe(normalizedMobileBrowserUrl);
  const canReloadPreview = shouldRenderPreviewIframe;
  const shouldAutoOpenRuntimeHome = shouldAutoOpenMobileRuntimeHome(normalizedMobileBrowserUrl, hasRuntimeHomeUrl);
  const mobileButtonVariant = getMobilePreviewDeviceButtonVariant(browserDevice, 'mobile');
  const tabletButtonVariant = getMobilePreviewTabletButtonVariant(browserDevice);
  const desktopButtonVariant = getMobilePreviewDeviceButtonVariant(browserDevice, 'desktop');
  const previewFrameWidth = getMobilePreviewFrameWidth(browserDevice);
  const previewFrameHeight = getMobilePreviewFrameHeight(browserDevice);
  useEffect(() => {
    if (shouldAutoOpenRuntimeHome === false) {
      return;
    }

    onOpenRuntimeHomeUrl(runtimeHomeUrl);
  }, [onOpenRuntimeHomeUrl, runtimeHomeUrl, shouldAutoOpenRuntimeHome]);

  useEffect(() => {
    const activeProjectId = getMobilePreviewProjectId(projectId);
    const shouldStartHeartbeat = shouldStartMobilePreviewRuntimeHeartbeat(activeProjectId, normalizedMobileBrowserUrl);
    if (shouldStartHeartbeat === false) {
      return undefined;
    }

    const touchRuntimeActivity = () => {
      void projectApi.touchRuntimeActivity(activeProjectId).catch((error) => {
        console.warn('mobile runtime activity heartbeat failed', error);
      });
    };

    touchRuntimeActivity();
    const heartbeat = window.setInterval(touchRuntimeActivity, 60_000);
    return () => window.clearInterval(heartbeat);
  }, [normalizedMobileBrowserUrl, projectId]);

  useEffect(() => {
    setPreviewIframeError('');
  }, [previewReloadToken]);

  useEffect(() => {
    setMobileBrowserUrlDraft(getMobilePreviewBrowserInputValue(mobileBrowserUrl));
  }, [mobileBrowserUrl]);

  const renderableMobilePreviewUrlStatus = getMobilePreviewRenderableUrlStatus(mobilePreviewUrlStatus);
  const renderablePreviewIframeError = getMobilePreviewRenderableStatusMessage(previewIframeError);

  const previewPanelSnapshot = buildPreviewPanelSnapshot({
    surface: 'mobile',
    device: browserDevice,
    browserUrl: normalizedMobileBrowserUrl,
    previewUrlStatus: mobilePreviewUrlStatus,
    canReload: canReloadPreview,
    canOpenRuntimeHome: hasRuntimeHomeUrl,
    iframeError: previewIframeError,
  });
  const reloadPreview = () => {
    setPreviewIframeError('');
    setPreviewReloadKey((value) => value + 1);
  };
  const handlePreviewIframeError = (error: unknown) => {
    const reason = formatPreviewIframeError(error, '移动端预览 iframe 加载失败');
    setPreviewIframeError(`移动端预览 iframe 加载失败：${reason}。当前地址栏仍保留 ${normalizedMobileBrowserUrl}，但本地 iframe 未确认加载成功；你可以刷新预览或检查 Runtime Preview 地址。`);
  };
  const handleMobileBrowserUrlChange = (nextUrl: string) => {
    setMobileBrowserUrlDraft(nextUrl);
  };
  const navigateMobilePreview = (nextUrl: string) => {
    setPreviewIframeError('');
    onNavigateTo(nextUrl);
  };
  const openRuntimeHome = () => {
    if (hasRuntimeHomeUrl === false) {
      return;
    }
    setPreviewIframeError('');
    onOpenRuntimeHomeUrl(runtimeHomeUrl);
    setPreviewReloadKey((value) => value + 1);
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="h-10 shrink-0 border-b bg-background px-2 flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGoBrowserBack} disabled={historyIndex <= 0}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGoForward} disabled={historyIndex >= browserHistoryLength - 1}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="mx-1 h-7 flex-1 rounded bg-muted px-2 flex items-center">
          <Globe className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="输入网址..."
            value={mobileBrowserUrlDraft}
            onChange={(event) => handleMobileBrowserUrlChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const rawUrl = event.currentTarget.value.trim();
                const navigationUrl = getMobilePreviewNavigationUrl(rawUrl);
                if (navigationUrl === null) {
                  return;
                }
                navigateMobilePreview(navigationUrl);
              }
            }}
            className="flex-1 bg-transparent text-xs outline-none"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reloadPreview} disabled={canReloadPreview === false}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openRuntimeHome} disabled={hasRuntimeHomeUrl === false}>
          <HomeIcon className="w-4 h-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="打开预览更多操作">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <PreviewShareControl projectId={projectId} compact />
          </PopoverContent>
        </Popover>
      </div>
      <div className="h-8 shrink-0 border-b bg-background flex items-center justify-center gap-2">
        <Button variant={mobileButtonVariant} size="icon" className="h-6 w-6" onClick={() => onSetBrowserDevice('mobile')}>
          <Smartphone className="h-3.5 w-3.5" />
        </Button>
        <Button variant={tabletButtonVariant} size="icon" className="h-6 w-6" onClick={() => onSetBrowserDevice('tablet')}>
          <Tablet className="h-3.5 w-3.5" />
        </Button>
        <Button variant={desktopButtonVariant} size="icon" className="h-6 w-6" onClick={() => onSetBrowserDevice('desktop')}>
          <Monitor className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="app-debug-only">
        <RuntimeHealthBanner
          runtimeStatus={runtimeStatus}
          onOpenCapabilityAudit={onOpenCapabilityAudit}
          onRecoverRuntime={onRecoverRuntime}
        />
      </div>
      <div className="app-debug-only">
        <PreviewPanelSnapshotStrip snapshot={previewPanelSnapshot} />
        {renderableMobilePreviewUrlStatus !== null && (
          <div className={`mx-2 mb-2 rounded-lg border px-3 py-2 text-xs ${getPreviewUrlStatusClassName(renderableMobilePreviewUrlStatus)}`}>
            <p className="font-medium">{formatPreviewUrlStatusTitle(renderableMobilePreviewUrlStatus)}</p>
            <p className="mt-1">{renderableMobilePreviewUrlStatus.message}</p>
          </div>
        )}
      </div>
      <PreviewRuntimeRecoveryNotice
        runtimeStatus={runtimeStatus}
        onRecoverRuntime={onRecoverRuntime}
        compact
      />
      <div className="flex-1 overflow-auto p-2 flex items-center justify-center">
        <div
          className="overflow-hidden rounded-lg border bg-white shadow-xl"
          style={{
            width: previewFrameWidth,
            height: previewFrameHeight,
            maxWidth: '100%',
          }}
        >
          {shouldRenderPreviewIframe === true ? (
            <>
              {renderablePreviewIframeError !== null && (
                <div role="status" className="border-b bg-red-50 px-3 py-2 text-xs text-red-700">
                  {renderablePreviewIframeError}
                </div>
              )}
              <iframe
                key={`${normalizedMobileBrowserUrl}:${previewReloadKey}:${previewReloadToken}`}
                src={normalizedMobileBrowserUrl}
                className="w-full h-full border-0"
                title="预览"
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setPreviewIframeError('')}
                onError={handlePreviewIframeError}
              />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Globe className="mb-2 h-12 w-12 opacity-50" />
              <p className="mb-1 text-sm">输入网址开始浏览</p>
              <p className="text-xs opacity-70">使用上方地址栏</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
