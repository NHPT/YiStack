import type {
  AdminDashboardQuickAccessSnapshot,
  AdminDashboardNavigationHref,
  AdminDashboardQuickAccessSnapshotSource,
  AdminDashboardQuickAccessSnapshotStatus,
  AdminPermissionCodeList,
} from '../workspace/workspace-types';
import type { AdminSessionRole } from '@/lib/admin/api';

export type AdminDashboardQuickAccessLinkSnapshotInput = {
  href: AdminDashboardNavigationHref;
  label: string;
  visible: boolean;
};

export type AdminDashboardQuickAccessProfileSnapshotInput = {
  role: AdminSessionRole;
  permission_codes: AdminPermissionCodeList;
};

function hasAdminDashboardQuickAccessProfile(
  profile: AdminDashboardQuickAccessProfileSnapshotInput | null,
): profile is AdminDashboardQuickAccessProfileSnapshotInput {
  return profile !== null;
}

function isAdminDashboardQuickAccessSuperAdmin(
  profile: AdminDashboardQuickAccessProfileSnapshotInput | null,
): boolean {
  const hasProfile = hasAdminDashboardQuickAccessProfile(profile);
  const isSuperAdmin = hasProfile === true && profile.role === 'super_admin';
  return isSuperAdmin === true;
}

function getAdminDashboardQuickAccessPermissionCount(
  profile: AdminDashboardQuickAccessProfileSnapshotInput | null,
): number {
  const hasProfile = hasAdminDashboardQuickAccessProfile(profile);
  if (hasProfile === false) {
    return 0;
  }

  const hasPermissionCodes = Array.isArray(profile.permission_codes) === true;
  return hasPermissionCodes === true ? profile.permission_codes.length : 0;
}

function hasQuickAccessLink(
  links: AdminDashboardQuickAccessLinkSnapshotInput[],
  href: AdminDashboardNavigationHref,
): boolean {
  for (const link of links) {
    const isMatchedHref = link.href === href;
    const isVisible = link.visible === true;
    const hasMatchedVisibleLink = isMatchedHref === true && isVisible === true;
    if (hasMatchedVisibleLink === true) {
      return true;
    }
  }

  return false;
}

function countVisibleAdminDashboardQuickAccessLinks(
  links: readonly AdminDashboardQuickAccessLinkSnapshotInput[],
): number {
  let count = 0;

  for (const link of links) {
    const isVisible = link.visible === true;
    if (isVisible === true) {
      count += 1;
    }
  }

  return count;
}

export function buildAdminDashboardQuickAccessSnapshot({
  profile,
  links,
}: {
  profile: AdminDashboardQuickAccessProfileSnapshotInput | null;
  links: AdminDashboardQuickAccessLinkSnapshotInput[];
}): AdminDashboardQuickAccessSnapshot {
  const visibleLinkCount = countVisibleAdminDashboardQuickAccessLinks(links);
  const hasProfile = hasAdminDashboardQuickAccessProfile(profile);
  const isSuperAdmin = isAdminDashboardQuickAccessSuperAdmin(profile);
  const permissionCount = getAdminDashboardQuickAccessPermissionCount(profile);
  const hasVisibleLinks = visibleLinkCount > 0;
  const hasHiddenLinks = visibleLinkCount < links.length;
  const status: AdminDashboardQuickAccessSnapshotStatus = hasProfile === false
    ? 'profile_missing'
    : hasVisibleLinks === false
      ? 'empty'
      : isSuperAdmin === true
        ? 'super_admin_ready'
        : hasHiddenLinks === true
          ? 'limited'
          : 'ready';

  const source: AdminDashboardQuickAccessSnapshotSource = status === 'profile_missing'
    ? 'admin_profile'
    : status === 'empty'
      ? 'role_permissions'
      : 'quick_access_links';

  return {
    status,
    source,
    candidateLinkCount: links.length,
    visibleLinkCount,
    hiddenLinkCount: links.length - visibleLinkCount,
    permissionCount,
    isSuperAdmin,
    hasLLMAccess: hasQuickAccessLink(links, '/admin/llm'),
    hasConfigAccess: hasQuickAccessLink(links, '/admin/config'),
    hasUsersAccess: hasQuickAccessLink(links, '/admin/users'),
    hasAuditAccess: hasQuickAccessLink(links, '/admin/audit'),
    hasAdminsAccess: hasQuickAccessLink(links, '/admin/admins'),
    hasRolesAccess: hasQuickAccessLink(links, '/admin/roles'),
    canNavigateAny: hasVisibleLinks,
    canNavigateLLM: hasQuickAccessLink(links, '/admin/llm'),
    canNavigateConfig: hasQuickAccessLink(links, '/admin/config'),
    canNavigateUsers: hasQuickAccessLink(links, '/admin/users'),
    canNavigateAudit: hasQuickAccessLink(links, '/admin/audit'),
    canNavigateAdmins: hasQuickAccessLink(links, '/admin/admins'),
    canNavigateRoles: hasQuickAccessLink(links, '/admin/roles'),
    message: status === 'profile_missing'
      ? 'Admin Quick Access 缺少管理员 profile，无法判断入口可见性。'
      : status === 'empty'
        ? 'Admin Quick Access 当前没有任何可见入口。'
        : status === 'super_admin_ready'
          ? 'Admin Quick Access 已展示 super_admin 的全部后台入口。'
          : status === 'limited'
            ? 'Admin Quick Access 正在展示当前权限允许的后台入口。'
            : 'Admin Quick Access 已就绪。',
    recovery: status === 'profile_missing'
      ? '重新校验 Admin profile cache 或重新登录后台。'
      : status === 'empty'
        ? '检查当前管理员角色和 permission_codes 是否应授予后台模块读取权限。'
        : status === 'limited'
          ? '如需更多入口，请通过角色权限配置补齐对应 permission_codes。'
          : '可通过下方入口进入对应后台模块。',
    updatedAt: 'derived',
  };
}

function getAdminDashboardQuickAccessSnapshotClassName(snapshot: AdminDashboardQuickAccessSnapshot) {
  if (snapshot.status === 'profile_missing' || snapshot.status === 'empty') {
    return 'border-red-500/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
  }
  if (snapshot.status === 'limited') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminDashboardQuickAccessSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminDashboardQuickAccessSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminDashboardQuickAccessSnapshot;
}) {
  const isSuperAdminLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.isSuperAdmin);
  const hasLLMAccessLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.hasLLMAccess);
  const hasConfigAccessLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.hasConfigAccess);
  const hasUsersAccessLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.hasUsersAccess);
  const hasAuditAccessLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.hasAuditAccess);
  const hasAdminsAccessLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.hasAdminsAccess);
  const hasRolesAccessLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.hasRolesAccess);
  const canNavigateAnyLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.canNavigateAny);
  const canNavigateLLMLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.canNavigateLLM);
  const canNavigateConfigLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.canNavigateConfig);
  const canNavigateUsersLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.canNavigateUsers);
  const canNavigateAuditLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.canNavigateAudit);
  const canNavigateAdminsLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.canNavigateAdmins);
  const canNavigateRolesLabel = getAdminDashboardQuickAccessSnapshotBooleanLabel(snapshot.canNavigateRoles);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-dashboard-quick-access-snapshot"
      className={`rounded-lg border px-3 py-2 text-xs ${getAdminDashboardQuickAccessSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Quick Access 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Visible: {snapshot.visibleLinkCount}</span>
        <span>Candidates: {snapshot.candidateLinkCount}</span>
        <span>Hidden: {snapshot.hiddenLinkCount}</span>
        <span>Permissions: {snapshot.permissionCount}</span>
        <span>SuperAdmin: {isSuperAdminLabel}</span>
        <span>LLM: {hasLLMAccessLabel}</span>
        <span>Config: {hasConfigAccessLabel}</span>
        <span>Users: {hasUsersAccessLabel}</span>
        <span>Audit: {hasAuditAccessLabel}</span>
        <span>Admins: {hasAdminsAccessLabel}</span>
        <span>Roles: {hasRolesAccessLabel}</span>
        <span>NavigateAny: {canNavigateAnyLabel}</span>
        <span>NavLLM: {canNavigateLLMLabel}</span>
        <span>NavConfig: {canNavigateConfigLabel}</span>
        <span>NavUsers: {canNavigateUsersLabel}</span>
        <span>NavAudit: {canNavigateAuditLabel}</span>
        <span>NavAdmins: {canNavigateAdminsLabel}</span>
        <span>NavRoles: {canNavigateRolesLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
