import type { ReactNode } from 'react';

import type { AdminCopy } from '@/lib/admin/i18n';
import type { AdminDashboardDiagnosticsLayoutSnapshot } from '../workspace/workspace-types';
import type {
  AdminDashboardDiagnosticsAnchorId,
  AdminDashboardHealthFocusSection,
  AdminDashboardHealthFocusSectionId,
  AdminDashboardHealthPriorityIssue,
  AdminDashboardHealthRunbookItem,
  AdminDashboardHealthSummary,
  AdminDashboardHealthTone,
} from './admin-dashboard-health-summary-model';
import {
  getAdminDashboardDiagnosticsAnchorId,
  getAdminDashboardDiagnosticsHashHref,
} from './admin-dashboard-health-summary-model';
import {
  buildAdminDashboardDiagnosticsLayoutSnapshot,
  AdminDashboardDiagnosticsLayoutSnapshotStrip,
} from './admin-dashboard-diagnostics-layout-snapshot';

type AdminDashboardDiagnosticsLayoutProps = {
  copy: AdminCopy;
  healthSummary: AdminDashboardHealthSummary;
  priorityDiagnostics: ReactNode;
  runtimeDiagnostics: ReactNode;
  configDiagnostics: ReactNode;
  auditDiagnostics: ReactNode;
};

type AdminDashboardDiagnosticsGroupProps = {
  id: AdminDashboardDiagnosticsAnchorId;
  title: string;
  description: string;
  children: ReactNode;
};

function AdminDashboardDiagnosticsGroup({
  id,
  title,
  description,
  children,
}: AdminDashboardDiagnosticsGroupProps) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function getDashboardHealthToneClassName(tone: AdminDashboardHealthTone): string {
  if (tone === 'critical') {
    return 'border-red-100 bg-red-50/80 dark:border-red-500/20 dark:bg-red-500/10';
  }
  if (tone === 'warning') {
    return 'border-amber-100 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10';
  }
  if (tone === 'success') {
    return 'border-emerald-100 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10';
  }
  return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40';
}

function getDashboardHealthFocusToneClassName(tone: AdminDashboardHealthTone): string {
  if (tone === 'critical') {
    return 'border-red-200 bg-red-100 text-red-700 hover:bg-red-200 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
  }
  return 'border-gray-200 bg-white/80 text-gray-700 hover:bg-white dark:border-gray-700 dark:bg-gray-950/20 dark:text-gray-200';
}

function getDashboardHealthFocusLabel(
  copy: AdminCopy,
  sectionId: AdminDashboardHealthFocusSectionId,
): string {
  switch (sectionId) {
    case 'priority':
      return copy.dashboardDiagnosticsPriority;
    case 'runtime':
      return copy.dashboardDiagnosticsRuntime;
    case 'config':
      return copy.dashboardDiagnosticsConfig;
    case 'audit':
      return copy.dashboardDiagnosticsAudit;
  }
}

function getDashboardDiagnosticsNavigationEnabled(
  sectionId: AdminDashboardHealthFocusSectionId,
  snapshot: AdminDashboardDiagnosticsLayoutSnapshot,
): boolean {
  switch (sectionId) {
    case 'priority':
      return snapshot.canNavigatePriority;
    case 'runtime':
      return snapshot.canNavigateRuntime;
    case 'config':
      return snapshot.canNavigateConfig;
    case 'audit':
      return snapshot.canNavigateAudit;
  }
}

function shouldRenderAdminDashboardHealthFocusSections(healthSummary: AdminDashboardHealthSummary): boolean {
  const focusSectionCount = healthSummary.focusSections.length;
  return focusSectionCount > 0;
}

function shouldRenderAdminDashboardHealthPriorityIssues(healthSummary: AdminDashboardHealthSummary): boolean {
  const priorityIssueCount = healthSummary.priorityIssues.length;
  return priorityIssueCount > 0;
}

function shouldRenderAdminDashboardHealthRunbookItems(healthSummary: AdminDashboardHealthSummary): boolean {
  const runbookItemCount = healthSummary.runbookItems.length;
  return runbookItemCount > 0;
}

function materializeAdminDashboardHealthFocusSectionNodes(
  sections: readonly AdminDashboardHealthFocusSection[],
  copy: AdminCopy,
  snapshot: AdminDashboardDiagnosticsLayoutSnapshot,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const section of sections) {
    const isNavigationEnabled = getDashboardDiagnosticsNavigationEnabled(section.id, snapshot);

    nodes.push(
      <a
        key={section.id}
        href={getAdminDashboardDiagnosticsHashHref(section.id)}
        aria-disabled={isNavigationEnabled === false}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${getDashboardHealthFocusToneClassName(section.tone)} ${
          isNavigationEnabled === true ? '' : 'pointer-events-none opacity-50'
        }`}
      >
        {getDashboardHealthFocusLabel(copy, section.id)}
        <span className="ml-1 opacity-75">
          {copy.dashboardHealthFocusSignalCount.replace('{count}', String(section.signalCount))}
        </span>
      </a>,
    );
  }

  return nodes;
}

function materializeAdminDashboardHealthPriorityIssueNodes(
  issues: readonly AdminDashboardHealthPriorityIssue[],
  copy: AdminCopy,
  snapshot: AdminDashboardDiagnosticsLayoutSnapshot,
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const issue of issues) {
    const isNavigationEnabled = getDashboardDiagnosticsNavigationEnabled(issue.sectionId, snapshot);

    nodes.push(
      <a
        key={issue.id}
        href={issue.href}
        aria-disabled={isNavigationEnabled === false}
        className={`rounded-xl border p-3 transition-colors ${getDashboardHealthFocusToneClassName(issue.tone)} ${
          isNavigationEnabled === true ? '' : 'pointer-events-none opacity-50'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{issue.title}</p>
          <span className="shrink-0 text-xs opacity-75">
            {getDashboardHealthFocusLabel(copy, issue.sectionId)}
          </span>
        </div>
        <p className="mt-1 text-xs opacity-90">{issue.description}</p>
        <p className="mt-2 text-xs opacity-75">{issue.evidence}</p>
      </a>,
    );
  }

  return nodes;
}

function materializeAdminDashboardHealthRunbookItemNodes(
  items: readonly AdminDashboardHealthRunbookItem[],
  copy: AdminCopy,
  snapshot: AdminDashboardDiagnosticsLayoutSnapshot,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;

  for (const item of items) {
    const itemNumber = index + 1;
    const isNavigationEnabled = getDashboardDiagnosticsNavigationEnabled(item.sectionId, snapshot);

    nodes.push(
      <li key={item.id} className="rounded-xl border border-white/70 bg-white/70 p-3 dark:border-white/10 dark:bg-gray-900/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">
              {itemNumber}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{item.description}</p>
            </div>
          </div>
          <a
            href={item.href}
            aria-disabled={isNavigationEnabled === false}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${getDashboardHealthFocusToneClassName(item.tone)} ${
              isNavigationEnabled === true ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            {getDashboardHealthFocusLabel(copy, item.sectionId)}
            <span className="ml-1 opacity-75">
              {copy.dashboardHealthFocusSignalCount.replace('{count}', String(item.signalCount))}
            </span>
          </a>
        </div>
      </li>,
    );

    index += 1;
  }

  return nodes;
}

export function AdminDashboardDiagnosticsLayout({
  copy,
  healthSummary,
  priorityDiagnostics,
  runtimeDiagnostics,
  configDiagnostics,
  auditDiagnostics,
}: AdminDashboardDiagnosticsLayoutProps) {
  const adminDashboardDiagnosticsLayoutSnapshot = buildAdminDashboardDiagnosticsLayoutSnapshot({
    healthSummary,
    priorityDiagnostics,
    runtimeDiagnostics,
    configDiagnostics,
    auditDiagnostics,
  });
  const shouldRenderHealthFocusSections = shouldRenderAdminDashboardHealthFocusSections(healthSummary);
  const shouldRenderHealthPriorityIssues = shouldRenderAdminDashboardHealthPriorityIssues(healthSummary);
  const shouldRenderHealthRunbookItems = shouldRenderAdminDashboardHealthRunbookItems(healthSummary);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 dark:border-blue-500/20 dark:bg-blue-500/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{copy.dashboardDiagnosticsTitle}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{copy.dashboardDiagnosticsDescription}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
            {copy.dashboardDiagnosticsReadOnly}
          </span>
        </div>
      </div>
      <AdminDashboardDiagnosticsLayoutSnapshotStrip snapshot={adminDashboardDiagnosticsLayoutSnapshot} />

      <div className={`rounded-2xl border p-5 ${getDashboardHealthToneClassName(healthSummary.tone)}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{copy.dashboardHealthSummary}</p>
            <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{healthSummary.primaryMessage}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{healthSummary.nextAction}</p>
          </div>
          <div className="grid min-w-full grid-cols-2 gap-2 sm:min-w-[28rem] sm:grid-cols-4">
            <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-950/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">{copy.dashboardHealthBlockers}</p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{healthSummary.blockerCount}</p>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-950/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">{copy.dashboardHealthWarnings}</p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{healthSummary.warningCount}</p>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-950/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">{copy.dashboardHealthPending}</p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{healthSummary.pendingCount}</p>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-950/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">{copy.dashboardHealthAuditSignals}</p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{healthSummary.auditSignalCount}</p>
            </div>
          </div>
        </div>
        {shouldRenderHealthFocusSections === true && (
          <div className="mt-4 border-t border-white/60 pt-4 dark:border-white/10">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{copy.dashboardHealthFocusAreas}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {materializeAdminDashboardHealthFocusSectionNodes(
                healthSummary.focusSections,
                copy,
                adminDashboardDiagnosticsLayoutSnapshot,
              )}
            </div>
          </div>
        )}
        {shouldRenderHealthPriorityIssues === true && (
          <div className="mt-4 rounded-2xl border border-white/60 bg-white/55 p-4 dark:border-white/10 dark:bg-gray-950/20">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {copy.dashboardHealthPriorityIssuesTitle}
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{copy.dashboardHealthPriorityIssuesDescription}</p>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {materializeAdminDashboardHealthPriorityIssueNodes(
                healthSummary.priorityIssues,
                copy,
                adminDashboardDiagnosticsLayoutSnapshot,
              )}
            </div>
          </div>
        )}
        {shouldRenderHealthRunbookItems === true && (
          <div className="mt-4 rounded-2xl border border-white/60 bg-white/55 p-4 dark:border-white/10 dark:bg-gray-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {copy.dashboardHealthRunbookTitle}
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{copy.dashboardHealthRunbookDescription}</p>
              </div>
            </div>
            <ol className="mt-3 space-y-2">
              {materializeAdminDashboardHealthRunbookItemNodes(
                healthSummary.runbookItems,
                copy,
                adminDashboardDiagnosticsLayoutSnapshot,
              )}
            </ol>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminDashboardDiagnosticsGroup
          id={getAdminDashboardDiagnosticsAnchorId('priority')}
          title={copy.dashboardDiagnosticsPriority}
          description={copy.dashboardDiagnosticsPriorityDescription}
        >
          {priorityDiagnostics}
        </AdminDashboardDiagnosticsGroup>
        <AdminDashboardDiagnosticsGroup
          id={getAdminDashboardDiagnosticsAnchorId('runtime')}
          title={copy.dashboardDiagnosticsRuntime}
          description={copy.dashboardDiagnosticsRuntimeDescription}
        >
          {runtimeDiagnostics}
        </AdminDashboardDiagnosticsGroup>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminDashboardDiagnosticsGroup
          id={getAdminDashboardDiagnosticsAnchorId('config')}
          title={copy.dashboardDiagnosticsConfig}
          description={copy.dashboardDiagnosticsConfigDescription}
        >
          {configDiagnostics}
        </AdminDashboardDiagnosticsGroup>
        <AdminDashboardDiagnosticsGroup
          id={getAdminDashboardDiagnosticsAnchorId('audit')}
          title={copy.dashboardDiagnosticsAudit}
          description={copy.dashboardDiagnosticsAuditDescription}
        >
          {auditDiagnostics}
        </AdminDashboardDiagnosticsGroup>
      </div>
    </section>
  );
}
