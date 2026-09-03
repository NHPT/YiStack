'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Globe, Home as HomeIcon, Monitor, MoreVertical, RefreshCw, RotateCw, Smartphone, Tablet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { projectApi, type ProjectRuntimeStatus } from '@/lib/api';
import { formatUserVisibleApiError } from '@/lib/api-error-display';
import { formatPreviewLocalError, formatPreviewIframeError } from '@/lib/workspace/preview-local-errors';
import {
  buildRuntimeHealthCapabilityAuditSearch,
  deriveRuntimeHealthDiagnosticsSummary,
  type RuntimeHealthDiagnosticsSummary,
  type RuntimeHealthRelatedDiagnosticAction,
  type RuntimeHealthRestartAction,
  type RuntimeHealthRestartReasonCode,
  type RuntimeHealthSeverity,
} from '@/lib/workspace/runtime-health-diagnostics';

import type { DesktopPreviewPanelProps, SharedPreviewProps } from './workspace-ide-subpanel-types';
import type { PreviewUrlStatus, PreviewUrlStatusValue, PreviewUrlStatusValueList, WorkspaceBrowserDevice } from './workspace-types';
import { buildPreviewPanelSnapshot, PreviewPanelSnapshotStrip } from './workspace-preview-panel-snapshot';
import {
  buildRuntimeHealthRecoveryConfirmationSnapshot,
  RuntimeHealthRecoveryConfirmationSnapshotStrip,
} from './workspace-runtime-health-recovery-confirmation-snapshot';
import { normalizePreviewBrowserUrl } from './workspace-preview-url-status';
import {
  useWorkspaceVisualEdit,
  WorkspaceVisualEditPanel,
  WorkspaceVisualEditToggle,
} from './workspace-visual-edit';

export type RuntimeHealthBannerProps = {
  runtimeStatus?: ProjectRuntimeStatus;
  onOpenCapabilityAudit: () => void;
  onRecoverRuntime: () => void | Promise<void>;
};

type PreviewRuntimeRecoveryNoticeModel = {
  title: string;
  message: string;
  actionLabel: string;
};

type PreviewRuntimeRecoveryNoticeProps = {
  runtimeStatus?: ProjectRuntimeStatus;
  onRecoverRuntime: () => void | Promise<void>;
  compact?: boolean;
};

type PreviewShareControlProps = {
  projectId: string | null;
  compact?: boolean;
};

const DESKTOP_PREVIEW_SUCCESS_URL_STATUSES: PreviewUrlStatusValueList = [
  'runtime_fresh',
];

const DESKTOP_PREVIEW_ERROR_URL_STATUSES: PreviewUrlStatusValueList = [
  'stale_after_build_failure',
  'empty',
];

function isDesktopPreviewUrlStatusIn(
  status: PreviewUrlStatusValue,
  statuses: PreviewUrlStatusValueList,
): boolean {
  for (const candidate of statuses) {
    const matchedStatus = candidate === status;
    if (matchedStatus === true) {
      return true;
    }
  }

  return false;
}

function getRuntimeHealthClassName(severity: RuntimeHealthSeverity): string {
  switch (severity) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'running':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'blocked':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'idle':
      return 'border-gray-200 bg-gray-50 text-gray-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800';
  }
}

function getRuntimeRecoveryAction(summary: RuntimeHealthDiagnosticsSummary): RuntimeHealthRestartAction | null {
  const restartRuntimeAction = summary.restartRuntimeAction;
  const hasRestartRuntimeAction = restartRuntimeAction !== null;
  if (hasRestartRuntimeAction === false) {
    return null;
  }

  return restartRuntimeAction;
}

function getRuntimeHealthRelatedCapabilityAuditAction(
  summary: RuntimeHealthDiagnosticsSummary,
): RuntimeHealthRelatedDiagnosticAction | null {
  const relatedCapabilityAuditAction = summary.relatedCapabilityAuditAction;
  const hasRelatedCapabilityAuditAction = relatedCapabilityAuditAction !== null;
  if (hasRelatedCapabilityAuditAction === false) {
    return null;
  }

  return relatedCapabilityAuditAction;
}

function hasRuntimeRecoveryAction(action: RuntimeHealthRestartAction | null): boolean {
  const hasAction = action !== null;
  return hasAction === true;
}

function hasRuntimeRelatedCapabilityAuditAction(action: RuntimeHealthRelatedDiagnosticAction | null): boolean {
  const hasAction = action !== null;
  return hasAction === true;
}

function shouldRenderRuntimeHealthActionGroup(
  restartRuntimeAction: RuntimeHealthRestartAction | null,
  relatedCapabilityAuditAction: RuntimeHealthRelatedDiagnosticAction | null,
): boolean {
  const hasRestartRuntimeAction = hasRuntimeRecoveryAction(restartRuntimeAction);
  if (hasRestartRuntimeAction === true) {
    return true;
  }

  const hasRelatedCapabilityAuditAction = hasRuntimeRelatedCapabilityAuditAction(relatedCapabilityAuditAction);
  if (hasRelatedCapabilityAuditAction === true) {
    return true;
  }

  return false;
}

function getRuntimeRecoveryReasonCode(action: RuntimeHealthRestartAction | null): RuntimeHealthRestartReasonCode | '' {
  const hasRuntimeRecoveryAction = action !== null;
  if (hasRuntimeRecoveryAction === false) {
    return '';
  }

  return action.reasonCode;
}

function getRuntimeRecoveryActionLabel(action: RuntimeHealthRestartAction | null): string | null {
  const hasRuntimeRecoveryAction = action !== null;
  if (hasRuntimeRecoveryAction === false) {
    return null;
  }

  const actionLabel = action.label;
  const hasActionLabel = actionLabel.length > 0;
  if (hasActionLabel === false) {
    return null;
  }

  return actionLabel;
}

function getRuntimeRecoveryActionDescription(action: RuntimeHealthRestartAction | null): string | null {
  const hasRuntimeRecoveryAction = action !== null;
  if (hasRuntimeRecoveryAction === false) {
    return null;
  }

  const actionDescription = action.description;
  const hasActionDescription = actionDescription.length > 0;
  if (hasActionDescription === false) {
    return null;
  }

  return actionDescription;
}

function getRuntimeRecoveryActionReasonCode(action: RuntimeHealthRestartAction | null): RuntimeHealthRestartReasonCode | null {
  const hasRuntimeRecoveryAction = action !== null;
  if (hasRuntimeRecoveryAction === false) {
    return null;
  }

  return action.reasonCode;
}

function getRuntimeRecoveryReasonCodeLabel(reasonCode: RuntimeHealthRestartReasonCode | null): string {
  const hasReasonCode = reasonCode !== null;
  if (hasReasonCode === false) {
    return 'unknown';
  }

  return reasonCode;
}

function getRuntimeRecoveryActionButtonLabel({
  isRecoveringRuntime,
  runtimeRecoveryAction,
}: {
  isRecoveringRuntime: boolean;
  runtimeRecoveryAction: RuntimeHealthRestartAction;
}): string {
  if (isRecoveringRuntime === true) {
    return '恢复中...';
  }

  return runtimeRecoveryAction.label;
}

function getRuntimeRecoveryConfirmButtonLabel(isRecoveringRuntime: boolean): string {
  if (isRecoveringRuntime === true) {
    return '恢复中...';
  }

  return '确认恢复';
}

function getPreviewRuntimeRecoveryNoticeMessage(summary: RuntimeHealthDiagnosticsSummary): string {
  const phaseLabel = summary.phaseLabel;
  if (phaseLabel === 'preview') {
    return '预览服务启动失败，可以重启预览服务后再次加载。';
  }

  return summary.message;
}

function getPreviewRuntimeRecoveryNoticeActionLabel(summary: RuntimeHealthDiagnosticsSummary): string {
  const restartRuntimeAction = summary.restartRuntimeAction;
  if (restartRuntimeAction === null) {
    return '重启预览服务';
  }

  if (restartRuntimeAction.reasonCode === 'failed') {
    return '重启预览服务';
  }

  return restartRuntimeAction.label;
}

function getPreviewRuntimeRecoveryNotice(
  runtimeStatus?: ProjectRuntimeStatus,
): PreviewRuntimeRecoveryNoticeModel | null {
  const summary = deriveRuntimeHealthDiagnosticsSummary(runtimeStatus);
  const restartRuntimeAction = summary.restartRuntimeAction;
  if (restartRuntimeAction === null) {
    return null;
  }

  if (summary.isBlocking === false) {
    return null;
  }

  return {
    title: '预览服务未就绪',
    message: getPreviewRuntimeRecoveryNoticeMessage(summary),
    actionLabel: getPreviewRuntimeRecoveryNoticeActionLabel(summary),
  };
}

function getPreviewShareControlProjectId(projectId: string | null): string | null {
  if (projectId === null) {
    return null;
  }

  const normalizedProjectId = projectId.trim();
  if (normalizedProjectId.length === 0) {
    return null;
  }

  return normalizedProjectId;
}

function getPreviewShareControlAbsoluteUrl(path: string): string {
  const normalizedPath = path.trim();
  if (normalizedPath.length === 0) {
    return '';
  }

  if (typeof window === 'undefined') {
    return normalizedPath;
  }

  return new URL(normalizedPath, window.location.origin).toString();
}

function getPreviewShareControlDisplayUrl(shareUrl: string): string | null {
  const normalizedUrl = shareUrl.trim();
  if (normalizedUrl.length === 0) {
    return null;
  }

  return normalizedUrl;
}

function shouldClearRuntimeRecoveryError(
  runtimeRecoveryError: string,
  runtimeRecoveryReasonCode: RuntimeHealthRestartReasonCode | '',
): boolean {
  const hasRuntimeRecoveryError = hasDesktopPreviewTextValue(runtimeRecoveryError);
  if (hasRuntimeRecoveryError === false) {
    return false;
  }

  const hasRuntimeRecoveryReasonCode = hasDesktopPreviewTextValue(runtimeRecoveryReasonCode);
  if (hasRuntimeRecoveryReasonCode === true) {
    return false;
  }

  return true;
}

function getDesktopPreviewRenderableStatusMessage(message: string): string | null {
  const hasMessage = hasDesktopPreviewTextValue(message);
  if (hasMessage === true) {
    return message;
  }

  return null;
}

function getDesktopPreviewRenderableRuntimeRecoveryAction(
  action: RuntimeHealthRestartAction | null,
): RuntimeHealthRestartAction | null {
  const hasAction = hasRuntimeRecoveryAction(action);
  if (hasAction === true) {
    return action;
  }

  return null;
}

function getDesktopPreviewRenderableCapabilityAuditAction(
  action: RuntimeHealthRelatedDiagnosticAction | null,
): RuntimeHealthRelatedDiagnosticAction | null {
  const hasAction = hasRuntimeRelatedCapabilityAuditAction(action);
  if (hasAction === true) {
    return action;
  }

  return null;
}

function getDesktopPreviewRenderableUrlStatus(
  previewUrlStatus: PreviewUrlStatus | null,
): PreviewUrlStatus | null {
  if (previewUrlStatus === null) {
    return null;
  }

  return previewUrlStatus;
}

function shouldRenderDesktopPreviewIframe(normalizedBrowserUrl: string): boolean {
  const shouldRenderIframe = normalizedBrowserUrl !== 'about:blank';
  return shouldRenderIframe === true;
}

function shouldStartDesktopPreviewRuntimeHeartbeat(
  activeProjectId: string | null,
  normalizedBrowserUrl: string,
): activeProjectId is string {
  if (activeProjectId === null) {
    return false;
  }

  const shouldRenderIframe = shouldRenderDesktopPreviewIframe(normalizedBrowserUrl);
  if (shouldRenderIframe === false) {
    return false;
  }

  return true;
}

function shouldAutoOpenDesktopRuntimeHome(
  normalizedBrowserUrl: string,
  hasRuntimeHomeUrl: boolean,
): boolean {
  if (normalizedBrowserUrl !== 'about:blank') {
    return false;
  }

  return hasRuntimeHomeUrl === true;
}

function shouldKeepRuntimeRecoveryConfirmationOpen(open: boolean, isRecoveringRuntime: boolean): boolean {
  if (open === true) {
    return false;
  }

  if (isRecoveringRuntime === true) {
    return true;
  }

  return false;
}

function isPreviewTabletDevice(browserDevice: WorkspaceBrowserDevice): boolean {
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

function getPreviewDeviceButtonVariant(
  browserDevice: WorkspaceBrowserDevice,
  targetDevice: WorkspaceBrowserDevice,
): 'secondary' | 'ghost' {
  const isActiveDevice = browserDevice === targetDevice;
  if (isActiveDevice === true) {
    return 'secondary';
  }

  return 'ghost';
}

function getPreviewTabletDeviceButtonVariant(browserDevice: WorkspaceBrowserDevice): 'secondary' | 'ghost' {
  const isTabletDevice = isPreviewTabletDevice(browserDevice);
  if (isTabletDevice === true) {
    return 'secondary';
  }

  return 'ghost';
}

function getNextPreviewTabletDevice(browserDevice: WorkspaceBrowserDevice): WorkspaceBrowserDevice {
  const isTabletDevice = isPreviewTabletDevice(browserDevice);
  if (isTabletDevice === true) {
    return 'desktop';
  }

  return 'tablet';
}

function getDesktopPreviewProjectId(projectId: string | null): string | null {
  if (projectId === null) {
    return null;
  }

  const hasProjectId = projectId.length > 0;
  if (hasProjectId === true) {
    return projectId;
  }

  return null;
}

function getDesktopPreviewRuntimeHomeUrl(runtimeStatus: ProjectRuntimeStatus | undefined): string {
  if (runtimeStatus === undefined) {
    return '';
  }

  const previewUrl = runtimeStatus.previewUrl;
  if (previewUrl === undefined) {
    return '';
  }

  return previewUrl.trim();
}

function getDesktopPreviewBrowserInputValue(browserUrl: string): string {
  if (browserUrl === 'about:blank') {
    return '';
  }
  return browserUrl;
}

function getDesktopPreviewNavigationUrl(rawUrl: string): string | null {
  const normalizedUrl = rawUrl.trim();
  if (normalizedUrl.length === 0) {
    return null;
  }
  const hasProtocol = normalizedUrl.startsWith('http') || normalizedUrl.startsWith('/preview') || normalizedUrl === 'about:blank';
  if (hasProtocol === true) {
    return normalizedUrl;
  }
  return `https://${normalizedUrl}`;
}

function hasDesktopPreviewTextValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function shouldRenderPreviewTabletRotationAction(browserDevice: WorkspaceBrowserDevice): boolean {
  const isTabletDevice = isPreviewTabletDevice(browserDevice);
  return isTabletDevice === true;
}

function getNextPreviewTabletOrientationDevice(browserDevice: WorkspaceBrowserDevice): WorkspaceBrowserDevice {
  const isTabletPortrait = browserDevice === 'tablet';
  if (isTabletPortrait === true) {
    return 'tablet-landscape';
  }

  return 'tablet';
}

export function formatPreviewUrlStatusTitle(status: PreviewUrlStatus) {
  switch (status.status) {
    case 'runtime_fresh':
      return 'Preview 地址来自运行时状态';
    case 'project_detail_snapshot':
      return 'Preview 地址来自项目详情快照';
    case 'workspace_bootstrap_snapshot':
      return 'Preview 地址来自 Workspace 初始化快照';
    case 'manual_input':
      return 'Preview 地址来自手动输入';
    case 'mobile_history':
      return 'Preview 地址来自移动端历史';
    case 'stale_after_build_failure':
      return 'Preview 当前保留旧地址';
    case 'empty':
      return 'Preview 当前没有可确认地址';
    default:
      return 'Preview 地址来源待确认';
  }
}

export function getPreviewUrlStatusClassName(status: PreviewUrlStatus) {
  const hasSuccessStatus = isDesktopPreviewUrlStatusIn(status.status, DESKTOP_PREVIEW_SUCCESS_URL_STATUSES);
  if (hasSuccessStatus === true) {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }

  const hasErrorStatus = isDesktopPreviewUrlStatusIn(status.status, DESKTOP_PREVIEW_ERROR_URL_STATUSES);
  if (hasErrorStatus === true) {
    return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300';
  }

  return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

export function PreviewRuntimeRecoveryNotice({
  runtimeStatus,
  onRecoverRuntime,
  compact = false,
}: PreviewRuntimeRecoveryNoticeProps) {
  const [isRecoveringRuntime, setIsRecoveringRuntime] = useState(false);
  const [runtimeRecoveryError, setRuntimeRecoveryError] = useState('');
  const notice = getPreviewRuntimeRecoveryNotice(runtimeStatus);
  if (notice === null) {
    return null;
  }

  const recoverRuntime = async () => {
    if (isRecoveringRuntime === true) {
      return;
    }

    setIsRecoveringRuntime(true);
    setRuntimeRecoveryError('');
    try {
      await onRecoverRuntime();
    } catch (error) {
      const reason = formatUserVisibleApiError(error, '请稍后重试');
      setRuntimeRecoveryError(`预览服务重启失败：${reason}`);
    } finally {
      setIsRecoveringRuntime(false);
    }
  };

  return (
    <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      <div className={compact ? 'space-y-2' : 'flex items-center justify-between gap-3'}>
        <div className="min-w-0">
          <p className="font-medium">{notice.title}</p>
          <p className="mt-0.5 truncate text-amber-800/80 dark:text-amber-200/80">{notice.message}</p>
          {runtimeRecoveryError.length > 0 ? (
            <p className="mt-1 text-red-700 dark:text-red-300">{runtimeRecoveryError}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 border-amber-500/40 bg-background text-xs text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
          disabled={isRecoveringRuntime === true}
          onClick={() => void recoverRuntime()}
        >
          <RotateCw className="mr-1 h-3.5 w-3.5" />
          {isRecoveringRuntime === true ? '重启中...' : notice.actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function PreviewShareControl({
  projectId,
  compact = false,
}: PreviewShareControlProps) {
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [isMutatingShare, setIsMutatingShare] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const activeProjectId = getPreviewShareControlProjectId(projectId);
  const displayShareUrl = getPreviewShareControlDisplayUrl(shareUrl);

  useEffect(() => {
    if (activeProjectId === null) {
      setShareEnabled(false);
      setShareUrl('');
      setShareError('');
      return;
    }

    let cancelled = false;
    setIsLoadingShare(true);
    setShareError('');
    void projectApi.get(activeProjectId)
      .then((project) => {
        if (cancelled === true) {
          return;
        }
        const enabled = project.preview_share_enabled === true;
        const nextShareUrl = enabled === true
          ? getPreviewShareControlAbsoluteUrl(project.preview_share_url || '')
          : '';
        setShareEnabled(enabled);
        setShareUrl(nextShareUrl);
      })
      .catch((error) => {
        if (cancelled === true) {
          return;
        }
        const reason = formatUserVisibleApiError(error, '读取分享状态失败');
        setShareError(`读取分享状态失败：${reason}`);
      })
      .finally(() => {
        if (cancelled === false) {
          setIsLoadingShare(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const enableShare = async () => {
    if (activeProjectId === null || isMutatingShare === true) {
      return;
    }

    setIsMutatingShare(true);
    setShareError('');
    setShareCopied(false);
    try {
      const result = await projectApi.enablePreviewShare(activeProjectId);
      setShareEnabled(result.preview_share_enabled === true);
      setShareUrl(getPreviewShareControlAbsoluteUrl(result.preview_share_url || result.preview_share_path || ''));
    } catch (error) {
      const reason = formatUserVisibleApiError(error, '开启分享失败');
      setShareError(`开启分享失败：${reason}`);
    } finally {
      setIsMutatingShare(false);
    }
  };

  const disableShare = async () => {
    if (activeProjectId === null || isMutatingShare === true) {
      return;
    }

    setIsMutatingShare(true);
    setShareError('');
    setShareCopied(false);
    try {
      const result = await projectApi.disablePreviewShare(activeProjectId);
      setShareEnabled(result.preview_share_enabled === true);
      setShareUrl('');
    } catch (error) {
      const reason = formatUserVisibleApiError(error, '关闭分享失败');
      setShareError(`关闭分享失败：${reason}`);
    } finally {
      setIsMutatingShare(false);
    }
  };

  const copyShareUrl = async () => {
    if (displayShareUrl === null) {
      return;
    }
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      setShareError('复制分享链接失败：浏览器剪贴板不可用，请手动复制链接。');
      return;
    }
    try {
      await navigator.clipboard.writeText(displayShareUrl);
      setShareCopied(true);
      setShareError('');
    } catch (error) {
      const reason = formatUserVisibleApiError(error, '浏览器拒绝写入剪贴板');
      setShareError(`复制分享链接失败：${reason}。请手动复制链接。`);
    }
  };

  if (activeProjectId === null) {
    return null;
  }

  return (
    <div className="text-xs">
      <div className={compact ? 'space-y-2' : 'flex items-center justify-between gap-3'}>
        <div className="min-w-0">
          <p className="font-medium">预览分享</p>
          <p className="mt-0.5 truncate text-muted-foreground">
            {shareEnabled === true && displayShareUrl !== null
              ? displayShareUrl
              : '开启后，获取链接的人无需登录即可访问当前预览；关闭后链接立即失效。'}
          </p>
          {shareError.length > 0 ? (
            <p className="mt-1 text-red-600 dark:text-red-300">{shareError}</p>
          ) : null}
          {shareCopied === true ? (
            <p className="mt-1 text-emerald-600 dark:text-emerald-300">分享链接已复制。</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {shareEnabled === true && displayShareUrl !== null ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={isMutatingShare === true}
              onClick={() => void copyShareUrl()}
            >
              复制链接
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={shareEnabled === true ? 'destructive' : 'outline'}
            className="h-7 text-xs"
            disabled={isLoadingShare === true || isMutatingShare === true}
            onClick={() => {
              if (shareEnabled === true) {
                void disableShare();
                return;
              }
              void enableShare();
            }}
          >
            {isMutatingShare === true
              ? '处理中...'
              : shareEnabled === true
                ? '关闭分享'
                : '开启分享'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RuntimeHealthBanner({
  runtimeStatus,
  onOpenCapabilityAudit,
  onRecoverRuntime,
}: RuntimeHealthBannerProps) {
  const summary = deriveRuntimeHealthDiagnosticsSummary(runtimeStatus);
  const [capabilityAuditUrlSyncError, setCapabilityAuditUrlSyncError] = useState('');
  const [runtimeRecoveryError, setRuntimeRecoveryError] = useState('');
  const [isRecoveringRuntime, setIsRecoveringRuntime] = useState(false);
  const [isRuntimeRecoveryConfirmationOpen, setIsRuntimeRecoveryConfirmationOpen] = useState(false);
  const runtimeRecoveryAction = getRuntimeRecoveryAction(summary);
  const relatedCapabilityAuditAction = getRuntimeHealthRelatedCapabilityAuditAction(summary);
  const shouldRenderActionGroup = shouldRenderRuntimeHealthActionGroup(
    runtimeRecoveryAction,
    relatedCapabilityAuditAction,
  );
  const runtimeRecoveryReasonCode = getRuntimeRecoveryReasonCode(runtimeRecoveryAction);
  const renderableRuntimeRecoveryAction = getDesktopPreviewRenderableRuntimeRecoveryAction(runtimeRecoveryAction);
  const renderableRelatedCapabilityAuditAction = getDesktopPreviewRenderableCapabilityAuditAction(
    relatedCapabilityAuditAction,
  );
  const runtimeRecoveryConfirmationSnapshot = buildRuntimeHealthRecoveryConfirmationSnapshot({
    isOpen: isRuntimeRecoveryConfirmationOpen,
    isConfirming: isRecoveringRuntime,
    actionLabel: getRuntimeRecoveryActionLabel(runtimeRecoveryAction),
    actionDescription: getRuntimeRecoveryActionDescription(runtimeRecoveryAction),
    reasonCode: getRuntimeRecoveryActionReasonCode(runtimeRecoveryAction),
  });
  const runtimeRecoveryReasonCodeLabel = getRuntimeRecoveryReasonCodeLabel(
    runtimeRecoveryConfirmationSnapshot.reasonCode,
  );
  const capabilityAuditUrlSyncStatusMessage = getDesktopPreviewRenderableStatusMessage(capabilityAuditUrlSyncError);
  const runtimeRecoveryStatusMessage = getDesktopPreviewRenderableStatusMessage(runtimeRecoveryError);
  useEffect(() => {
    const shouldClearError = shouldClearRuntimeRecoveryError(runtimeRecoveryError, runtimeRecoveryReasonCode);
    if (shouldClearError === true) {
      setRuntimeRecoveryError('');
    }
  }, [runtimeRecoveryError, runtimeRecoveryReasonCode]);
  const openRelatedCapabilityAudit = () => {
    if (typeof window !== 'undefined') {
      const nextSearch = buildRuntimeHealthCapabilityAuditSearch(window.location.search, runtimeStatus);
      const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
      try {
        window.history.replaceState(window.history.state, '', nextUrl);
        setCapabilityAuditUrlSyncError('');
      } catch (error) {
        const reason = formatPreviewLocalError(error, '浏览器拒绝更新地址栏', 'browser_history');
        setCapabilityAuditUrlSyncError(`Capability Audit 定位参数写入失败：${reason}。已打开 Debug 面板，但地址栏未写入 runtime_project/runtime_reason 定位参数；Capability Audit 可能仍展示旧筛选或全部记录，请在面板内手动选择 blocked 筛选。`);
      }
    }
    onOpenCapabilityAudit();
  };
  const recoverRuntime = async () => {
    if (runtimeRecoveryConfirmationSnapshot.canConfirm !== true) {
      return;
    }
    setRuntimeRecoveryError('');
    setIsRecoveringRuntime(true);
    try {
      await onRecoverRuntime();
    } catch (error) {
      const reason = formatUserVisibleApiError(error, '恢复运行时失败');
      setRuntimeRecoveryError(`Runtime Health 恢复运行时失败：${reason}。当前 Preview 仍可能停留在旧地址或旧 iframe 状态；请根据消息流中的 recovery 状态重试，或稍后重新刷新 Runtime Health。`);
    } finally {
      setIsRecoveringRuntime(false);
      setIsRuntimeRecoveryConfirmationOpen(false);
    }
  };

  return (
    <div className={`m-2 rounded-lg border px-3 py-2 text-xs ${getRuntimeHealthClassName(summary.severity)}`}>
      <div className="flex flex-wrap items-center gap-2 font-medium">
        <span>Runtime: {summary.statusLabel}</span>
        <span>Container: {summary.containerLabel}</span>
        <span>Phase: {summary.phaseLabel}</span>
        <span>Persistence: {summary.persistenceLabel}</span>
        <span>Updated: {summary.updatedAtLabel}</span>
      </div>
      <div className="mt-1 line-clamp-2 opacity-80">
        {summary.message} / {summary.nextAction}
      </div>
      <div className="mt-1 opacity-70">
        诊断区只消费已有 runtime status；恢复按钮是显式受控动作，会复用 start 容器入口并等待 runtime-status 进入 ready。
      </div>
      {shouldRenderActionGroup === true && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {renderableRuntimeRecoveryAction !== null && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 bg-background/70 px-2 text-xs"
                disabled={isRecoveringRuntime === true}
                onClick={() => setIsRuntimeRecoveryConfirmationOpen(true)}
              >
                {getRuntimeRecoveryActionButtonLabel({
                  isRecoveringRuntime,
                  runtimeRecoveryAction: renderableRuntimeRecoveryAction,
                })}
              </Button>
              <span className="opacity-75">
                runtime_reason={renderableRuntimeRecoveryAction.reasonCode}
              </span>
            </>
          )}
          {renderableRelatedCapabilityAuditAction !== null && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 bg-background/70 px-2 text-xs"
                onClick={openRelatedCapabilityAudit}
              >
                {renderableRelatedCapabilityAuditAction.label}
              </Button>
              <span className="opacity-75">
                {renderableRelatedCapabilityAuditAction.searchParam}={renderableRelatedCapabilityAuditAction.searchValue}
              </span>
            </>
          )}
          {capabilityAuditUrlSyncStatusMessage !== null && (
            <span role="status" className="text-red-700 opacity-90">
              {capabilityAuditUrlSyncStatusMessage}
            </span>
          )}
          {runtimeRecoveryStatusMessage !== null && (
            <span role="status" className="text-red-700 opacity-90">
              {runtimeRecoveryStatusMessage}
            </span>
          )}
        </div>
      )}
      <AlertDialog
        open={isRuntimeRecoveryConfirmationOpen}
        onOpenChange={(open) => {
          const shouldKeepOpen = shouldKeepRuntimeRecoveryConfirmationOpen(open, isRecoveringRuntime);
          if (shouldKeepOpen === true) {
            return;
          }
          setIsRuntimeRecoveryConfirmationOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复运行时</AlertDialogTitle>
            <AlertDialogDescription>
              确认因 {runtimeRecoveryReasonCodeLabel} 触发 Runtime Health 恢复运行时？该操作会复用受控 start 容器入口并等待 runtime-status 进入 ready，不会绕过既有 failed snapshot、controller guard 或 runtime readiness in-flight guard。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RuntimeHealthRecoveryConfirmationSnapshotStrip snapshot={runtimeRecoveryConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runtimeRecoveryConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              type="button"
              disabled={runtimeRecoveryConfirmationSnapshot.canConfirm === false}
              onClick={() => {
                if (runtimeRecoveryConfirmationSnapshot.canConfirm === true) {
                  void recoverRuntime();
                }
              }}
            >
              {getRuntimeRecoveryConfirmButtonLabel(isRecoveringRuntime)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function DesktopPreviewDeviceControls({
  browserDevice,
  onSetBrowserDevice,
}: SharedPreviewProps) {
  const desktopButtonVariant = getPreviewDeviceButtonVariant(browserDevice, 'desktop');
  const tabletButtonVariant = getPreviewTabletDeviceButtonVariant(browserDevice);
  const mobileButtonVariant = getPreviewDeviceButtonVariant(browserDevice, 'mobile');
  const nextTabletDevice = getNextPreviewTabletDevice(browserDevice);
  const nextTabletOrientationDevice = getNextPreviewTabletOrientationDevice(browserDevice);
  const shouldRenderTabletRotationAction = shouldRenderPreviewTabletRotationAction(browserDevice);

  return (
    <div className="flex items-center gap-1 px-2">
      <Button variant={desktopButtonVariant} size="icon" className="h-7 w-7" onClick={() => onSetBrowserDevice('desktop')}>
        <Monitor className="w-4 h-4" />
      </Button>
      <div className="relative group">
        <Button
          variant={tabletButtonVariant}
          size="icon"
          className="h-7 w-7"
          onClick={() => onSetBrowserDevice(nextTabletDevice)}
        >
          <Tablet className="w-4 h-4" />
        </Button>
        {shouldRenderTabletRotationAction === true && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -bottom-1 -right-1 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onSetBrowserDevice(nextTabletOrientationDevice)}
          >
            <RotateCw className="w-3 h-3" />
          </Button>
        )}
      </div>
      <Button variant={mobileButtonVariant} size="icon" className="h-7 w-7" onClick={() => onSetBrowserDevice('mobile')}>
        <Smartphone className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function DesktopPreviewPanel({
  projectId,
  browserUrl,
  previewUrlStatus,
  previewReloadToken,
  onChangeBrowserUrl,
  onOpenRuntimeHomeUrl,
  previewDeviceStyle,
  runtimeStatus,
  canVisualEdit,
  onSubmitVisualEdit,
  onOpenCapabilityAudit,
  onRecoverRuntime,
}: DesktopPreviewPanelProps) {
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [previewIframeError, setPreviewIframeError] = useState('');
  const [browserUrlDraft, setBrowserUrlDraft] = useState(() => getDesktopPreviewBrowserInputValue(browserUrl));
  const [desktopBrowserHistory, setDesktopBrowserHistory] = useState<string[]>([]);
  const [desktopHistoryIndex, setDesktopHistoryIndex] = useState(-1);
  const runtimeHomeUrl = getDesktopPreviewRuntimeHomeUrl(runtimeStatus);
  const hasRuntimeHomeUrl = hasDesktopPreviewTextValue(runtimeHomeUrl);
  const normalizedBrowserUrl = normalizePreviewBrowserUrl(browserUrl);
  const shouldRenderPreviewIframe = shouldRenderDesktopPreviewIframe(normalizedBrowserUrl);
  const canReloadPreview = shouldRenderPreviewIframe;
  const shouldAutoOpenRuntimeHome = shouldAutoOpenDesktopRuntimeHome(normalizedBrowserUrl, hasRuntimeHomeUrl);
  const visualEditController = useWorkspaceVisualEdit({
    iframeRef: previewIframeRef,
    previewUrl: normalizedBrowserUrl,
    runtimeHomeUrl,
    projectId,
    canWrite: canVisualEdit,
    onSubmit: onSubmitVisualEdit,
  });
  useEffect(() => {
    if (shouldAutoOpenRuntimeHome === false) {
      return;
    }

    onOpenRuntimeHomeUrl(runtimeHomeUrl);
  }, [onOpenRuntimeHomeUrl, runtimeHomeUrl, shouldAutoOpenRuntimeHome]);

  useEffect(() => {
    const activeProjectId = getDesktopPreviewProjectId(projectId);
    const shouldStartHeartbeat = shouldStartDesktopPreviewRuntimeHeartbeat(activeProjectId, normalizedBrowserUrl);
    if (shouldStartHeartbeat === false) {
      return undefined;
    }

    const touchRuntimeActivity = () => {
      void projectApi.touchRuntimeActivity(activeProjectId).catch((error) => {
        console.warn('runtime activity heartbeat failed', error);
      });
    };

    touchRuntimeActivity();
    const heartbeat = window.setInterval(touchRuntimeActivity, 60_000);
    return () => window.clearInterval(heartbeat);
  }, [normalizedBrowserUrl, projectId]);

  useEffect(() => {
    setPreviewIframeError('');
  }, [previewReloadToken]);

  useEffect(() => {
    setBrowserUrlDraft(getDesktopPreviewBrowserInputValue(browserUrl));
  }, [browserUrl]);

  const previewPanelSnapshot = buildPreviewPanelSnapshot({
    surface: 'desktop',
    device: 'desktop',
    browserUrl: normalizedBrowserUrl,
    previewUrlStatus,
    canReload: canReloadPreview,
    canOpenRuntimeHome: hasRuntimeHomeUrl,
    iframeError: previewIframeError,
  });
  const renderablePreviewUrlStatus = getDesktopPreviewRenderableUrlStatus(previewUrlStatus);
  const renderablePreviewIframeError = getDesktopPreviewRenderableStatusMessage(previewIframeError);
  const reloadPreview = () => {
    setPreviewIframeError('');
    setPreviewReloadKey((value) => value + 1);
  };
  const navigateDesktopPreview = (nextUrl: string) => {
    setPreviewIframeError('');
    const normalizedNextUrl = normalizePreviewBrowserUrl(nextUrl);
    const nextHistory = desktopBrowserHistory.slice(0, desktopHistoryIndex + 1);
    nextHistory.push(normalizedNextUrl);
    setDesktopBrowserHistory(nextHistory);
    setDesktopHistoryIndex(nextHistory.length - 1);
    onChangeBrowserUrl(normalizedNextUrl);
  };
  const goDesktopBack = () => {
    if (desktopHistoryIndex <= 0) {
      return;
    }
    const nextIndex = desktopHistoryIndex - 1;
    const nextUrl = desktopBrowserHistory[nextIndex];
    setDesktopHistoryIndex(nextIndex);
    setPreviewIframeError('');
    onChangeBrowserUrl(nextUrl);
  };
  const goDesktopForward = () => {
    if (desktopHistoryIndex >= desktopBrowserHistory.length - 1) {
      return;
    }
    const nextIndex = desktopHistoryIndex + 1;
    const nextUrl = desktopBrowserHistory[nextIndex];
    setDesktopHistoryIndex(nextIndex);
    setPreviewIframeError('');
    onChangeBrowserUrl(nextUrl);
  };
  const openRuntimeHome = () => {
    if (hasRuntimeHomeUrl === false) {
      return;
    }
    setPreviewIframeError('');
    const normalizedRuntimeHomeUrl = normalizePreviewBrowserUrl(runtimeHomeUrl);
    const nextHistory = desktopBrowserHistory.slice(0, desktopHistoryIndex + 1);
    nextHistory.push(normalizedRuntimeHomeUrl);
    setDesktopBrowserHistory(nextHistory);
    setDesktopHistoryIndex(nextHistory.length - 1);
    onOpenRuntimeHomeUrl(runtimeHomeUrl);
    reloadPreview();
  };
  const handlePreviewIframeError = (error: unknown) => {
    const reason = formatPreviewIframeError(error, '预览 iframe 加载失败');
    setPreviewIframeError(`预览 iframe 加载失败：${reason}。当前地址栏仍保留 ${normalizedBrowserUrl}，但本地 iframe 未确认加载成功；你可以刷新预览或回到 Runtime Home 确认最新预览地址。`);
  };
  const handleBrowserUrlChange = (nextUrl: string) => {
    setBrowserUrlDraft(nextUrl);
  };
  const handleBrowserUrlSubmit = () => {
    const navigationUrl = getDesktopPreviewNavigationUrl(browserUrlDraft);
    if (navigationUrl === null) {
      return;
    }
    navigateDesktopPreview(navigationUrl);
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="h-10 shrink-0 border-b bg-background px-2 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goDesktopBack} disabled={desktopHistoryIndex <= 0}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goDesktopForward} disabled={desktopHistoryIndex >= desktopBrowserHistory.length - 1}>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reloadPreview} disabled={canReloadPreview === false}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openRuntimeHome} disabled={hasRuntimeHomeUrl === false}>
            <HomeIcon className="w-4 h-4" />
          </Button>
          <WorkspaceVisualEditToggle controller={visualEditController} />
        </div>
        <div className="h-7 flex-1 rounded-md bg-muted px-3 flex items-center">
          <Globe className="mr-2 h-3 w-3 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={browserUrlDraft}
            onChange={(event) => handleBrowserUrlChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleBrowserUrlSubmit();
              }
            }}
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="输入网址..."
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="打开预览更多操作">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <PreviewShareControl projectId={projectId} />
          </PopoverContent>
        </Popover>
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
        {renderablePreviewUrlStatus !== null && (
          <div className={`mx-2 mb-2 rounded-lg border px-3 py-2 text-xs ${getPreviewUrlStatusClassName(renderablePreviewUrlStatus)}`}>
            <p className="font-medium">{formatPreviewUrlStatusTitle(renderablePreviewUrlStatus)}</p>
            <p className="mt-1">{renderablePreviewUrlStatus.message}</p>
          </div>
        )}
      </div>
      <PreviewRuntimeRecoveryNotice
        runtimeStatus={runtimeStatus}
        onRecoverRuntime={onRecoverRuntime}
      />
      <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
        <div className="relative overflow-hidden rounded-lg border bg-white shadow-xl" style={{ ...previewDeviceStyle, maxWidth: '100%', maxHeight: '100%' }}>
          {shouldRenderPreviewIframe === true ? (
            <>
              {renderablePreviewIframeError !== null && (
                <div role="status" className="border-b bg-red-50 px-3 py-2 text-xs text-red-700">
                  {renderablePreviewIframeError}
                </div>
              )}
              <iframe
                ref={previewIframeRef}
                key={`${visualEditController.iframeUrl}:${previewReloadKey}:${previewReloadToken}`}
                src={visualEditController.iframeUrl}
                className="w-full h-full border-0"
                title="预览"
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setPreviewIframeError('')}
                onError={handlePreviewIframeError}
              />
              <WorkspaceVisualEditPanel controller={visualEditController} />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Globe className="mb-4 h-16 w-16 opacity-50" />
              <p className="mb-2 text-lg">浏览器模拟器</p>
              <p className="text-sm opacity-70">在地址栏输入网址开始浏览</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
