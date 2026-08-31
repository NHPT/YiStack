import type { ReactNode } from 'react';
import type {
  AdminDiagnosticSectionSnapshot,
  AdminDiagnosticSectionSnapshotSource,
  AdminDiagnosticSectionSnapshotStatus,
  AdminDiagnosticTone as AdminDiagnosticToneContract,
} from '../workspace/workspace-types';

export type AdminDiagnosticTone = AdminDiagnosticToneContract;

export type AdminDiagnosticBadge = {
  label: string;
  tone?: AdminDiagnosticTone;
};

type AdminDiagnosticSectionProps = {
  title: string;
  badges?: AdminDiagnosticBadge[];
  children?: ReactNode;
  emptyMessage?: string;
  healthyMessage?: string;
  tone?: AdminDiagnosticTone;
};

function hasAdminDiagnosticReactNode(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false;
}

function getAdminDiagnosticMessageValue(value: string | undefined): string {
  const hasValue = value !== undefined;
  if (hasValue === false) {
    return '';
  }

  return value;
}

function hasAdminDiagnosticMessage(value: string | undefined): boolean {
  const messageValue = getAdminDiagnosticMessageValue(value);
  const hasValue = messageValue.length > 0;
  return hasValue === true;
}

function shouldRenderAdminDiagnosticSectionContent(hasContent: boolean): boolean {
  return hasContent === true;
}

function getAdminDiagnosticBadgeCountByTone(
  badges: readonly AdminDiagnosticBadge[],
  tone: AdminDiagnosticTone,
): number {
  let count = 0;

  for (const badge of badges) {
    const isMatchedTone = badge.tone === tone;
    if (isMatchedTone === true) {
      count += 1;
    }
  }

  return count;
}

export function getAdminDiagnosticToneClassName(tone: AdminDiagnosticTone = 'neutral'): string {
  if (tone === 'critical') {
    return 'border-red-100 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/10';
  }
  if (tone === 'warning') {
    return 'border-amber-100 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10';
  }
  if (tone === 'success') {
    return 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10';
  }
  if (tone === 'info') {
    return 'border-blue-100 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10';
  }
  return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40';
}

export function getAdminDiagnosticBadgeClassName(tone: AdminDiagnosticTone = 'neutral'): string {
  if (tone === 'critical') {
    return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';
  }
  if (tone === 'warning') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }
  if (tone === 'success') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (tone === 'info') {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300';
  }
  return 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200';
}

export function buildAdminDiagnosticSectionSnapshot({
  title,
  badges,
  hasContent,
  hasEmptyMessage,
  hasHealthyMessage,
  tone,
}: {
  title: string;
  badges: AdminDiagnosticBadge[];
  hasContent: boolean;
  hasEmptyMessage: boolean;
  hasHealthyMessage: boolean;
  tone: AdminDiagnosticTone;
}): AdminDiagnosticSectionSnapshot {
  const criticalBadgeCount = getAdminDiagnosticBadgeCountByTone(badges, 'critical');
  const warningBadgeCount = getAdminDiagnosticBadgeCountByTone(badges, 'warning');
  const infoBadgeCount = getAdminDiagnosticBadgeCountByTone(badges, 'info');
  const successBadgeCount = getAdminDiagnosticBadgeCountByTone(badges, 'success');
  const canRenderContent = hasContent === true;
  const canRenderEmptyMessage = hasEmptyMessage === true && hasContent === false;
  const canRenderHealthyMessage = hasHealthyMessage === true;
  const status: AdminDiagnosticSectionSnapshotStatus = tone === 'critical' || criticalBadgeCount > 0
    ? 'critical'
    : tone === 'warning' || warningBadgeCount > 0
      ? 'warning'
      : hasHealthyMessage
        ? 'healthy'
        : hasContent
          ? 'content'
          : hasEmptyMessage
            ? 'empty'
            : tone === 'info' || infoBadgeCount > 0
              ? 'info'
              : 'neutral';

  const source: AdminDiagnosticSectionSnapshotSource = status === 'critical' || status === 'warning' || status === 'info'
    ? 'tone'
    : status === 'content'
      ? 'content'
      : status === 'empty' || status === 'healthy'
        ? 'message'
        : badges.length > 0
          ? 'badges'
          : 'section_props';

  return {
    status,
    source,
    title,
    tone,
    badgeCount: badges.length,
    criticalBadgeCount,
    warningBadgeCount,
    infoBadgeCount,
    successBadgeCount,
    hasContent,
    hasEmptyMessage,
    hasHealthyMessage,
    canRenderContent,
    canRenderEmptyMessage,
    canRenderHealthyMessage,
    message: status === 'critical'
      ? 'Admin diagnostic section 正在展示 critical 诊断状态。'
      : status === 'warning'
        ? 'Admin diagnostic section 正在展示 warning 诊断状态。'
        : status === 'healthy'
          ? 'Admin diagnostic section 正在展示健康提示。'
          : status === 'content'
            ? 'Admin diagnostic section 已渲染诊断内容。'
            : status === 'empty'
              ? 'Admin diagnostic section 当前没有可渲染内容。'
              : status === 'info'
                ? 'Admin diagnostic section 正在展示信息型状态。'
                : 'Admin diagnostic section 使用默认中性状态。',
    recovery: status === 'critical' || status === 'warning'
      ? '查看该 section 的 badges 与诊断内容，按恢复建议处理对应异常。'
      : status === 'empty'
        ? '确认上游诊断数据是否为空，或检查 emptyMessage 是否符合当前权限范围。'
        : status === 'healthy'
          ? '保持只读观察；如状态变化，继续查看对应诊断卡快照。'
          : '该 section 可作为诊断视图骨架继续渲染。',
    updatedAt: 'derived',
  };
}

function getAdminDiagnosticSectionSnapshotClassName(snapshot: AdminDiagnosticSectionSnapshot) {
  if (snapshot.status === 'critical') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'warning' || snapshot.status === 'empty') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'healthy' || snapshot.status === 'content') {
    return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
  }
  if (snapshot.status === 'info') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  return 'border-gray-200 bg-white/70 text-gray-600 dark:border-gray-700 dark:bg-gray-950/20 dark:text-gray-300';
}

function getAdminDiagnosticSectionSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

function materializeAdminDiagnosticBadgeNodes(badges: readonly AdminDiagnosticBadge[]): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const badge of badges) {
    nodes.push(
      <span key={`${badge.label}-${badge.tone ?? 'neutral'}`} className={`rounded-full px-2 py-0.5 ${getAdminDiagnosticBadgeClassName(badge.tone)}`}>
        {badge.label}
      </span>,
    );
  }

  return nodes;
}

export function AdminDiagnosticSectionSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminDiagnosticSectionSnapshot;
}) {
  const hasContentLabel = getAdminDiagnosticSectionSnapshotBooleanLabel(snapshot.hasContent);
  const hasEmptyMessageLabel = getAdminDiagnosticSectionSnapshotBooleanLabel(snapshot.hasEmptyMessage);
  const hasHealthyMessageLabel = getAdminDiagnosticSectionSnapshotBooleanLabel(snapshot.hasHealthyMessage);
  const canRenderContentLabel = getAdminDiagnosticSectionSnapshotBooleanLabel(snapshot.canRenderContent);
  const canRenderEmptyMessageLabel = getAdminDiagnosticSectionSnapshotBooleanLabel(snapshot.canRenderEmptyMessage);
  const canRenderHealthyMessageLabel = getAdminDiagnosticSectionSnapshotBooleanLabel(snapshot.canRenderHealthyMessage);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-diagnostic-section-snapshot"
      className={`mt-2 rounded-lg border px-3 py-2 text-xs ${getAdminDiagnosticSectionSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Diagnostic Section 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Title: {snapshot.title}</span>
        <span>Tone: {snapshot.tone}</span>
        <span>Badges: {snapshot.badgeCount}</span>
        <span>Critical: {snapshot.criticalBadgeCount}</span>
        <span>Warning: {snapshot.warningBadgeCount}</span>
        <span>Info: {snapshot.infoBadgeCount}</span>
        <span>Success: {snapshot.successBadgeCount}</span>
        <span>Content: {hasContentLabel}</span>
        <span>EmptyMessage: {hasEmptyMessageLabel}</span>
        <span>HealthyMessage: {hasHealthyMessageLabel}</span>
        <span>RenderContent: {canRenderContentLabel}</span>
        <span>RenderEmpty: {canRenderEmptyMessageLabel}</span>
        <span>RenderHealthy: {canRenderHealthyMessageLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function AdminDiagnosticSection({
  title,
  badges = [],
  children,
  emptyMessage,
  healthyMessage,
  tone = 'neutral',
}: AdminDiagnosticSectionProps) {
  const hasContent = hasAdminDiagnosticReactNode(children);
  const hasEmptyMessage = hasAdminDiagnosticMessage(emptyMessage);
  const hasHealthyMessage = hasAdminDiagnosticMessage(healthyMessage);
  const shouldRenderEmptyMessage = hasEmptyMessage === true && hasContent === false;
  const shouldRenderHealthyMessage = hasHealthyMessage === true;
  const shouldRenderContent = shouldRenderAdminDiagnosticSectionContent(hasContent);
  const badgeNodes = materializeAdminDiagnosticBadgeNodes(badges);
  const adminDiagnosticSectionSnapshot = buildAdminDiagnosticSectionSnapshot({
    title,
    badges,
    hasContent,
    hasEmptyMessage,
    hasHealthyMessage,
    tone,
  });

  return (
    <section className={`rounded-xl border px-4 py-3 ${getAdminDiagnosticToneClassName(tone)}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
        <span>{title}</span>
        {badgeNodes}
      </div>
      <AdminDiagnosticSectionSnapshotStrip snapshot={adminDiagnosticSectionSnapshot} />
      {shouldRenderEmptyMessage === true && (
        <p className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white/60 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/20 dark:text-gray-400">
          {emptyMessage}
        </p>
      )}
      {shouldRenderHealthyMessage === true && (
        <p className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {healthyMessage}
        </p>
      )}
      {shouldRenderContent === true && <div className="mt-2">{children}</div>}
    </section>
  );
}
