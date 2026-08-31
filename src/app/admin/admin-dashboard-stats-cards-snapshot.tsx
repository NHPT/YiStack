import type {
  AdminDashboardStatsCardsSnapshot,
  AdminDashboardNavigationHref,
  AdminDashboardStatsCardsSnapshotSource,
  AdminDashboardStatsCardsSnapshotStatus,
  AdminPermissionCodeList,
} from '../workspace/workspace-types';
import type { AdminSessionRole } from '@/lib/admin/api';

export type AdminDashboardStatsCardSnapshotInput = {
  href: AdminDashboardNavigationHref;
  label: string;
  visible: boolean;
};

export type AdminDashboardLoadedStatsCardSnapshotInput = {
  href?: AdminDashboardNavigationHref;
  title: string;
  value: string;
};

export type AdminDashboardStatsCardsProfileSnapshotInput = {
  role: AdminSessionRole;
  permission_codes: AdminPermissionCodeList;
};

function hasAdminDashboardStatsCardsProfile(
  profile: AdminDashboardStatsCardsProfileSnapshotInput | null,
): profile is AdminDashboardStatsCardsProfileSnapshotInput {
  return profile !== null;
}

function isAdminDashboardStatsCardsSuperAdmin(
  profile: AdminDashboardStatsCardsProfileSnapshotInput | null,
): boolean {
  const hasProfile = hasAdminDashboardStatsCardsProfile(profile);
  const isSuperAdmin = hasProfile === true && profile.role === 'super_admin';
  return isSuperAdmin === true;
}

function getAdminDashboardStatsCardsPermissionCount(
  profile: AdminDashboardStatsCardsProfileSnapshotInput | null,
): number {
  const hasProfile = hasAdminDashboardStatsCardsProfile(profile);
  if (hasProfile === false) {
    return 0;
  }

  const hasPermissionCodes = Array.isArray(profile.permission_codes) === true;
  return hasPermissionCodes === true ? profile.permission_codes.length : 0;
}

function hasLoadedStatsCard(
  cards: AdminDashboardLoadedStatsCardSnapshotInput[],
  href: AdminDashboardNavigationHref,
): boolean {
  for (const card of cards) {
    const isMatchedHref = card.href === href;
    if (isMatchedHref === true) {
      return true;
    }
  }

  return false;
}

function countVisibleAdminDashboardStatsCardCandidates(
  candidates: readonly AdminDashboardStatsCardSnapshotInput[],
): number {
  let count = 0;

  for (const candidate of candidates) {
    const isVisible = candidate.visible === true;
    if (isVisible === true) {
      count += 1;
    }
  }

  return count;
}

function canNavigateAdminDashboardStatsCards(cards: readonly AdminDashboardLoadedStatsCardSnapshotInput[]): boolean {
  for (const card of cards) {
    const canNavigate = card.href !== undefined;
    if (canNavigate === true) {
      return true;
    }
  }

  return false;
}

export function buildAdminDashboardStatsCardsSnapshot({
  profile,
  loading,
  cards,
  candidates,
}: {
  profile: AdminDashboardStatsCardsProfileSnapshotInput | null;
  loading: boolean;
  cards: AdminDashboardLoadedStatsCardSnapshotInput[];
  candidates: AdminDashboardStatsCardSnapshotInput[];
}): AdminDashboardStatsCardsSnapshot {
  const expectedCardCount = countVisibleAdminDashboardStatsCardCandidates(candidates);
  const loadedCardCount = cards.length;
  const missingCardCount = Math.max(expectedCardCount - loadedCardCount, 0);
  const isSuperAdmin = isAdminDashboardStatsCardsSuperAdmin(profile);
  const hasProfile = hasAdminDashboardStatsCardsProfile(profile);
  const permissionCount = getAdminDashboardStatsCardsPermissionCount(profile);
  const hasExpectedCards = expectedCardCount > 0;
  const hasLoadedCards = loadedCardCount > 0;
  const canNavigateAny = canNavigateAdminDashboardStatsCards(cards);
  const status: AdminDashboardStatsCardsSnapshotStatus = hasProfile === false
    ? 'profile_missing'
    : loading === true
      ? 'loading'
      : hasExpectedCards === false || hasLoadedCards === false
        ? 'empty'
        : missingCardCount > 0
          ? 'partial'
          : isSuperAdmin === true
            ? 'super_admin_ready'
            : 'ready';

  const source: AdminDashboardStatsCardsSnapshotSource = status === 'profile_missing'
    ? 'admin_profile'
    : status === 'empty'
      ? 'role_permissions'
      : status === 'partial'
        ? 'card_navigation'
        : 'dashboard_cards';

  return {
    status,
    source,
    expectedCardCount,
    loadedCardCount,
    missingCardCount,
    permissionCount,
    isSuperAdmin,
    hasProvidersCard: hasLoadedStatsCard(cards, '/admin/llm'),
    hasConfigsCard: hasLoadedStatsCard(cards, '/admin/config'),
    hasUsersCard: hasLoadedStatsCard(cards, '/admin/users'),
    hasAdminsCard: hasLoadedStatsCard(cards, '/admin/admins'),
    canNavigateAny,
    canNavigateProviders: hasLoadedStatsCard(cards, '/admin/llm'),
    canNavigateConfigs: hasLoadedStatsCard(cards, '/admin/config'),
    canNavigateUsers: hasLoadedStatsCard(cards, '/admin/users'),
    canNavigateAdmins: hasLoadedStatsCard(cards, '/admin/admins'),
    loading,
    message: status === 'profile_missing'
      ? 'Admin Dashboard Stats 缺少管理员 profile，无法判断统计卡片范围。'
      : status === 'loading'
        ? 'Admin Dashboard Stats 正在加载当前权限允许的统计卡片。'
        : status === 'empty'
          ? 'Admin Dashboard Stats 当前没有可展示的统计卡片。'
          : status === 'partial'
            ? 'Admin Dashboard Stats 仅加载了部分预期统计卡片。'
            : status === 'super_admin_ready'
              ? 'Admin Dashboard Stats 已加载 super_admin 的全部统计卡片。'
              : 'Admin Dashboard Stats 已就绪。',
    recovery: status === 'profile_missing'
      ? '重新校验 Admin profile cache 或重新登录后台。'
      : status === 'loading'
        ? '等待 Dashboard 统计请求完成。'
        : status === 'empty'
          ? '检查当前管理员角色权限，或确认统计 API 是否全部返回失败。'
          : status === 'partial'
            ? '对照 missing card 数量检查对应统计 API、权限和路由目标。'
            : '可通过统计卡片进入对应后台模块。',
    updatedAt: 'derived',
  };
}

function getAdminDashboardStatsCardsSnapshotClassName(snapshot: AdminDashboardStatsCardsSnapshot) {
  if (snapshot.status === 'profile_missing' || snapshot.status === 'empty' || snapshot.status === 'partial') {
    return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }
  if (snapshot.status === 'loading') {
    return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
  return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
}

function getAdminDashboardStatsCardsSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function AdminDashboardStatsCardsSnapshotStrip({
  snapshot,
}: {
  snapshot: AdminDashboardStatsCardsSnapshot;
}) {
  const isSuperAdminLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.isSuperAdmin);
  const hasProvidersCardLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.hasProvidersCard);
  const hasConfigsCardLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.hasConfigsCard);
  const hasUsersCardLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.hasUsersCard);
  const hasAdminsCardLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.hasAdminsCard);
  const canNavigateAnyLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.canNavigateAny);
  const canNavigateProvidersLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.canNavigateProviders);
  const canNavigateConfigsLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.canNavigateConfigs);
  const canNavigateUsersLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.canNavigateUsers);
  const canNavigateAdminsLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.canNavigateAdmins);
  const loadingLabel = getAdminDashboardStatsCardsSnapshotBooleanLabel(snapshot.loading);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="admin-dashboard-stats-cards-snapshot"
      className={`col-span-full rounded-lg border px-3 py-2 text-xs ${getAdminDashboardStatsCardsSnapshotClassName(snapshot)}`}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">Admin Dashboard Stats 快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Expected: {snapshot.expectedCardCount}</span>
        <span>Loaded: {snapshot.loadedCardCount}</span>
        <span>Missing: {snapshot.missingCardCount}</span>
        <span>Permissions: {snapshot.permissionCount}</span>
        <span>SuperAdmin: {isSuperAdminLabel}</span>
        <span>Providers: {hasProvidersCardLabel}</span>
        <span>Configs: {hasConfigsCardLabel}</span>
        <span>Users: {hasUsersCardLabel}</span>
        <span>Admins: {hasAdminsCardLabel}</span>
        <span>NavigateAny: {canNavigateAnyLabel}</span>
        <span>NavProviders: {canNavigateProvidersLabel}</span>
        <span>NavConfigs: {canNavigateConfigsLabel}</span>
        <span>NavUsers: {canNavigateUsersLabel}</span>
        <span>NavAdmins: {canNavigateAdminsLabel}</span>
        <span>Loading: {loadingLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
