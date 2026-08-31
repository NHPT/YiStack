'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  adminAuthApi,
  adminAuditApi,
  adminCapabilityApi,
  adminConfigApi,
  adminLLMApi,
  adminManagersApi,
  adminProjectsApi,
  adminUsersApi,
  type AdminLLMProvidersResponse,
  type AdminProject,
  type AuditLog,
  type CapabilityProviderPreflightResponse,
} from '@/lib/admin/api';
import { useUIPreferences } from '@/contexts/ui-preferences-context';
import { getAdminCopy } from '@/lib/admin/i18n';
import { AdminAuditDiagnosticsCard } from './admin-audit-diagnostics-card';
import { buildAdminDashboardPageSnapshot, AdminDashboardPageSnapshotStrip } from './admin-dashboard-page-snapshot';
import {
  buildAdminDashboardQuickAccessSnapshot,
  AdminDashboardQuickAccessSnapshotStrip,
} from './admin-dashboard-quick-access-snapshot';
import type { AdminDashboardQuickAccessLinkSnapshotInput } from './admin-dashboard-quick-access-snapshot';
import {
  buildAdminDashboardStatsCardsSnapshot,
  AdminDashboardStatsCardsSnapshotStrip,
} from './admin-dashboard-stats-cards-snapshot';
import type { AdminDashboardStatsCardSnapshotInput } from './admin-dashboard-stats-cards-snapshot';
import { AdminCapabilityPreflightCard } from './admin-capability-preflight-card';
import { AdminDashboardDiagnosticsLayout } from './admin-dashboard-diagnostics-layout';
import { deriveAdminDashboardHealthSummary } from './admin-dashboard-health-summary-model';
import { AdminProviderHealthDiagnosticsCard } from './admin-provider-health-diagnostics-card';
import { AdminRuntimeHealthDiagnosticsCard } from './admin-runtime-health-diagnostics-card';
import type { AdminDashboardNavigationHref } from '../workspace/workspace-types';

type DashboardCard = {
  title: string;
  value: string;
  href?: AdminDashboardNavigationHref;
};

function isAdminDashboardRequestActive(cancelled: boolean): boolean {
  return cancelled === false;
}

function shouldRenderAdminDashboardLoadingEmpty(loading: boolean, cards: DashboardCard[]): boolean {
  const hasCards = cards.length > 0;
  return loading === true && hasCards === false;
}

function shouldRenderAdminDashboardDiagnosticsLayout(isSuperAdmin: boolean): boolean {
  return isSuperAdmin === true;
}

function shouldRenderAdminDashboardAuditFallback(isSuperAdmin: boolean): boolean {
  return isSuperAdmin === false;
}

function getAdminDashboardQuickAccessSectionClassName(isSuperAdmin: boolean): string {
  const shouldUseSingleColumnLayout = isSuperAdmin === true;
  return shouldUseSingleColumnLayout === true ? 'grid gap-6' : 'grid gap-6 xl:grid-cols-[1.2fr_0.8fr]';
}

function AdminDashboardCardLink({ card, label }: { card: DashboardCard; label: string }) {
  const cardHref = card.href;
  const shouldRenderCardLink = cardHref !== undefined;
  if (shouldRenderCardLink === false) {
    return null;
  }

  return (
    <Link href={cardHref} className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
      {label}
    </Link>
  );
}

function listVisibleAdminDashboardQuickLinks(
  candidates: AdminDashboardQuickAccessLinkSnapshotInput[],
): AdminDashboardQuickAccessLinkSnapshotInput[] {
  const links: AdminDashboardQuickAccessLinkSnapshotInput[] = [];

  for (const candidate of candidates) {
    const isVisible = candidate.visible === true;
    if (isVisible === true) {
      links.push(candidate);
    }
  }

  return links;
}

function materializeAdminDashboardStatsCardNodes(cards: DashboardCard[], linkLabel: string): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const card of cards) {
    nodes.push(
      <div key={card.title} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">{card.title}</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{card.value}</p>
        <AdminDashboardCardLink card={card} label={linkLabel} />
      </div>,
    );
  }

  return nodes;
}

function materializeAdminDashboardQuickLinkNodes(
  links: AdminDashboardQuickAccessLinkSnapshotInput[],
): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of links) {
    nodes.push(
      <Link
        key={item.href}
        href={item.href}
        className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700/60"
      >
        {item.label}
      </Link>,
    );
  }

  return nodes;
}

export default function AdminPage() {
  const { locale } = useUIPreferences();
  const copy = getAdminCopy(locale);
  const profile = useMemo(() => adminAuthApi.getCachedProfile(), []);
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>([]);
  const [providerHealthSnapshot, setProviderHealthSnapshot] = useState<AdminLLMProvidersResponse | null>(null);
  const [providerPreflight, setProviderPreflight] = useState<CapabilityProviderPreflightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const hasProfile = profile !== null;
  const isSuperAdmin = profile !== null && profile.role === 'super_admin';
  const hasPermission = useCallback((permission: string) => {
    const hasSuperAdminAccess = isSuperAdmin === true;
    const hasPermissionCode = profile !== null && profile.permission_codes.includes(permission);

    return hasSuperAdminAccess === true || hasPermissionCode === true;
  }, [isSuperAdmin, profile]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      const nextCards: DashboardCard[] = [];

      const tasks: Array<Promise<void>> = [];

      if (hasPermission('llm.provider.manage')) {
        tasks.push(
          adminLLMApi.listProviders().then((data) => {
            if (isAdminDashboardRequestActive(cancelled) === true) {
              setProviderHealthSnapshot(data);
            }
            nextCards.push({
              title: copy.totalProviders,
              value: String(data.providers.length),
              href: '/admin/llm',
            });
          }).catch(() => undefined),
        );
      }

      if (hasPermission('system.config.read') || hasPermission('system.container_config.read')) {
        tasks.push(
          adminConfigApi.list().then((data) => {
            nextCards.push({
              title: copy.totalConfigs,
              value: String(data.length),
              href: '/admin/config',
            });
          }).catch(() => undefined),
        );
      }

      if (hasPermission('user.read')) {
        tasks.push(
          adminUsersApi.list().then((data) => {
            nextCards.push({
              title: copy.totalUsers,
              value: String(data.length),
              href: '/admin/users',
            });
          }).catch(() => undefined),
        );
      }

      if (isSuperAdmin === true) {
        tasks.push(
          adminManagersApi.list().then((data) => {
            nextCards.push({
              title: copy.totalAdmins,
              value: String(data.total),
              href: '/admin/admins',
            });
          }).catch(() => undefined),
        );
        tasks.push(
          adminCapabilityApi.getProviderPreflight().then((data) => {
            if (isAdminDashboardRequestActive(cancelled) === true) {
              setProviderPreflight(data);
            }
          }).catch(() => undefined),
        );
        tasks.push(
          adminProjectsApi.list({ pageSize: 50 }).then((data) => {
            if (isAdminDashboardRequestActive(cancelled) === true) {
              setAdminProjects(data.projects);
            }
          }).catch(() => undefined),
        );
      }

      if (hasPermission('audit.read')) {
        tasks.push(
          adminAuditApi.list({ limit: 5 }).then((data) => {
            if (isAdminDashboardRequestActive(cancelled) === true) {
              setRecentLogs(data.logs);
            }
          }).catch(() => undefined),
        );
      }

      await Promise.all(tasks);
      if (isAdminDashboardRequestActive(cancelled) === true) {
        setCards(nextCards);
        setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [copy.totalAdmins, copy.totalConfigs, copy.totalProviders, copy.totalUsers, hasPermission, isSuperAdmin]);

  const statsCardCandidates = useMemo<AdminDashboardStatsCardSnapshotInput[]>(() => {
    const canViewProviders = hasPermission('llm.provider.manage');
    const canViewConfig = hasPermission('system.config.read') === true || hasPermission('system.container_config.read') === true;
    const canViewUsers = hasPermission('user.read');
    const canViewAdmins = isSuperAdmin === true;

    return [
      { href: '/admin/llm', label: copy.totalProviders, visible: canViewProviders },
      { href: '/admin/config', label: copy.totalConfigs, visible: canViewConfig },
      { href: '/admin/users', label: copy.totalUsers, visible: canViewUsers },
      { href: '/admin/admins', label: copy.totalAdmins, visible: canViewAdmins },
    ];
  }, [copy.totalAdmins, copy.totalConfigs, copy.totalProviders, copy.totalUsers, hasPermission, isSuperAdmin]);
  const quickLinkCandidates = useMemo<AdminDashboardQuickAccessLinkSnapshotInput[]>(() => {
    const canViewLLM = hasPermission('llm.provider.manage');
    const canViewPrompts = hasPermission('system.config.read');
    const canViewTemplates = hasPermission('system.config.read');
    const canViewConfig = hasPermission('system.config.read') === true || hasPermission('system.container_config.read') === true;
    const canViewUsers = hasPermission('user.read');
    const canViewAudit = hasPermission('audit.read');
    const canViewAdmins = isSuperAdmin === true;
    const canViewRoles = isSuperAdmin === true;
    const canViewEnterprise = isSuperAdmin === true;

    return [
      { href: '/admin/llm', label: copy.llm, visible: canViewLLM },
      { href: '/admin/prompts', label: copy.prompts, visible: canViewPrompts },
      { href: '/admin/templates', label: copy.templates, visible: canViewTemplates },
      { href: '/admin/config', label: copy.config, visible: canViewConfig },
      { href: '/admin/users', label: copy.users, visible: canViewUsers },
      { href: '/admin/audit', label: copy.audit, visible: canViewAudit },
      { href: '/admin/admins', label: copy.admins, visible: canViewAdmins },
      { href: '/admin/roles', label: copy.roles, visible: canViewRoles },
      { href: '/admin/enterprise', label: copy.enterprise, visible: canViewEnterprise },
    ];
  }, [copy.admins, copy.audit, copy.config, copy.enterprise, copy.llm, copy.prompts, copy.roles, copy.templates, copy.users, hasPermission, isSuperAdmin]);
  const quickLinks = useMemo(() => listVisibleAdminDashboardQuickLinks(quickLinkCandidates), [quickLinkCandidates]);
  const dashboardHealthSummary = useMemo(() => deriveAdminDashboardHealthSummary({
    providerSnapshot: providerHealthSnapshot,
    runtimeProjects: adminProjects,
    providerPreflight,
    auditLogs: recentLogs,
  }), [adminProjects, providerHealthSnapshot, providerPreflight, recentLogs]);
  const adminDashboardPageSnapshot = buildAdminDashboardPageSnapshot({
    profile,
    loading,
    cardCount: cards.length,
    quickLinkCount: quickLinks.length,
    recentLogCount: recentLogs.length,
    adminProjectCount: adminProjects.length,
    hasProviderSnapshot: providerHealthSnapshot !== null,
    hasProviderPreflight: providerPreflight !== null,
    healthSummary: dashboardHealthSummary,
  });
  const adminDashboardQuickAccessSnapshot = buildAdminDashboardQuickAccessSnapshot({
    profile,
    links: quickLinkCandidates,
  });
  const adminDashboardStatsCardsSnapshot = buildAdminDashboardStatsCardsSnapshot({
    profile,
    loading,
    cards,
    candidates: statsCardCandidates,
  });
  const shouldRenderLoadingEmpty = shouldRenderAdminDashboardLoadingEmpty(loading, cards);
  const shouldRenderStatsCards = shouldRenderLoadingEmpty === false;
  const shouldRenderDiagnosticsLayout = shouldRenderAdminDashboardDiagnosticsLayout(isSuperAdmin);
  const shouldRenderAuditFallback = shouldRenderAdminDashboardAuditFallback(isSuperAdmin);
  const quickAccessSectionClassName = getAdminDashboardQuickAccessSectionClassName(isSuperAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{copy.dashboardTitle}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{copy.dashboardDescription}</p>
      </div>
      <AdminDashboardPageSnapshotStrip snapshot={adminDashboardPageSnapshot} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminDashboardStatsCardsSnapshotStrip snapshot={adminDashboardStatsCardsSnapshot} />
        {shouldRenderLoadingEmpty === true && (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            {copy.loading}
          </div>
        )}
        {shouldRenderStatsCards === true && materializeAdminDashboardStatsCardNodes(cards, copy.viewModule)}
      </section>

      {shouldRenderDiagnosticsLayout === true && (
        <AdminDashboardDiagnosticsLayout
          copy={copy}
          healthSummary={dashboardHealthSummary}
          priorityDiagnostics={<AdminProviderHealthDiagnosticsCard copy={copy} snapshot={providerHealthSnapshot} />}
          runtimeDiagnostics={<AdminRuntimeHealthDiagnosticsCard copy={copy} projects={adminProjects} />}
          configDiagnostics={<AdminCapabilityPreflightCard copy={copy} providerPreflight={providerPreflight} />}
          auditDiagnostics={<AdminAuditDiagnosticsCard copy={copy} logs={recentLogs} />}
        />
      )}

      <section className={quickAccessSectionClassName}>
        <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{copy.quickAccess}</h2>
          <div className="mt-3">
            <AdminDashboardQuickAccessSnapshotStrip snapshot={adminDashboardQuickAccessSnapshot} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {materializeAdminDashboardQuickLinkNodes(quickLinks)}
          </div>
        </div>

        {shouldRenderAuditFallback === true && (
          <AdminAuditDiagnosticsCard copy={copy} logs={recentLogs} />
        )}
      </section>
    </div>
  );
}
