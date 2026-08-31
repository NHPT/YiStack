'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { adminAuthApi, formatAdminAuthStorageFailure } from '@/lib/admin/api';
import type { AdminAuthStorageRedirectStatus } from '@/lib/admin/api';
import type { AdminPermissionCodeList, AdminProfileCache, AdminSessionRole } from '@/lib/admin/api';
import {
  formatAdminAuthBrowserHistoryError,
  formatAdminProfileCacheUrlStorageFailure,
  resolveAdminProfileCacheUrlStorageSource,
} from '@/lib/admin/admin-auth-local-errors';
import type { AdminAuthStorageFailureResult } from '@/lib/admin/admin-auth-storage-local-errors';
import { useUIPreferences } from '@/contexts/ui-preferences-context';
import { getAdminCopy } from '@/lib/admin/i18n';
import { AppPreferenceControls } from '@/components/app-preference-controls';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { AdminLayoutNavHref, AdminLayoutNavLabelKey, AdminLayoutSnapshotStatus } from '../workspace/workspace-types';
import { buildAdminLayoutSnapshot, AdminLayoutSnapshotStrip } from './admin-layout-snapshot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NavItem = {
  href: AdminLayoutNavHref;
  labelKey: AdminLayoutNavLabelKey;
  icon: string;
  requiredPermissions?: AdminPermissionCodeList;
  superAdminOnly?: boolean;
};

type AdminRoleLabelProfile = {
  role: AdminSessionRole;
  raw_role: string;
};

const navItems: NavItem[] = [
  {
    href: '/admin',
    labelKey: 'dashboard',
    icon: 'M3.75 3h7.5v7.5h-7.5V3zm9 0h7.5v4.5h-7.5V3zm0 6h7.5V21h-7.5V9zm-9 3h7.5V21h-7.5v-9z',
  },
  {
    href: '/admin/llm',
    labelKey: 'llm',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 00-.659 1.591v1.689m-4.242 0h4.242m-4.242 0H9.75m4.5 0a2.25 2.25 0 00-2.25 2.25v.894m0 0a2.25 2.25 0 01-2.25 2.25H5.25',
    requiredPermissions: ['llm.provider.manage'],
  },
  {
    href: '/admin/config',
    labelKey: 'config',
    icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z',
    requiredPermissions: ['system.config.read', 'system.container_config.read'],
  },
  {
    href: '/admin/prompts',
    labelKey: 'prompts',
    icon: 'M7.5 8.25h9m-9 3h6m-7.5 8.25a3 3 0 01-3-3V6.75a3 3 0 013-3h12a3 3 0 013 3v9.75a3 3 0 01-3 3H6z',
    requiredPermissions: ['system.config.read'],
  },
  {
    href: '/admin/templates',
    labelKey: 'templates',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-6.375',
    requiredPermissions: ['system.config.read'],
  },
  {
    href: '/admin/audit',
    labelKey: 'audit',
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    requiredPermissions: ['audit.read'],
  },
  {
    href: '/admin/users',
    labelKey: 'users',
    icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    requiredPermissions: ['user.read'],
  },
  {
    href: '/admin/admins',
    labelKey: 'admins',
    icon: 'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.964 0a9 9 0 10-11.964 0m11.964 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z',
    superAdminOnly: true,
  },
  {
    href: '/admin/roles',
    labelKey: 'roles',
    icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m9 0a4.5 4.5 0 11-9 0m9 0v3.75a4.5 4.5 0 11-9 0V10.5',
    superAdminOnly: true,
  },
  {
    href: '/admin/enterprise',
    labelKey: 'enterprise',
    icon: 'M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6zm3 1.5v9h10.5v-9H6.75zm2.25 2.25h6v1.5h-6v-1.5zm0 3h4.5v1.5H9v-1.5z',
    superAdminOnly: true,
  },
];

const roleLabelMap: Partial<Record<AdminSessionRole, string>> = {
  admin: '管理员',
  super_admin: '超级管理员',
};

function getAdminLayoutOptionalLabel(value: string | undefined | null, fallback: string): string {
  const normalizedValue = value?.trim();
  const hasNormalizedValue = normalizedValue !== undefined && normalizedValue.length > 0;
  return hasNormalizedValue === true ? normalizedValue : fallback;
}

function getAdminLayoutUnknownRoleValue(profile: AdminRoleLabelProfile): string | null {
  const hasRawRole = profile.raw_role.length > 0;
  if (hasRawRole === true) {
    return profile.raw_role;
  }
  const hasRole = profile.role.length > 0;
  return hasRole === true ? profile.role : null;
}

function getAdminRoleLabel(profile?: AdminRoleLabelProfile | null) {
  if (profile === undefined || profile === null) return '';
  if (profile.role === 'unknown') {
    const roleValue = getAdminLayoutUnknownRoleValue(profile);
    const hasRoleValue = roleValue !== null;
    return hasRoleValue === true ? `未知：${roleValue}` : '未知：unknown';
  }
  const mappedRoleLabel = roleLabelMap[profile.role];
  const hasMappedRoleLabel = mappedRoleLabel !== undefined;
  return hasMappedRoleLabel === true ? mappedRoleLabel : profile.role;
}

function getAdminLayoutAvatarFallbackLabel(profile: AdminProfileCache | null): string {
  const emailLabel = getAdminLayoutOptionalLabel(profile?.email, 'A');
  return emailLabel.slice(0, 1).toUpperCase();
}

function hasAdminNavPermission(profile: AdminProfileCache, permission: string): boolean {
  for (const permissionCode of profile.permission_codes) {
    const isMatchedPermission = permissionCode === permission;
    if (isMatchedPermission === true) {
      return true;
    }
  }

  return false;
}

function hasRequiredAdminNavPermission(
  requiredPermissions: AdminPermissionCodeList,
  profile: AdminProfileCache,
): boolean {
  for (const permission of requiredPermissions) {
    const hasPermission = hasAdminNavPermission(profile, permission);
    if (hasPermission === true) {
      return true;
    }
  }

  return false;
}

function canAccessAdminNav(item: NavItem, profile: AdminProfileCache | null) {
  const hasProfile = profile !== null;
  if (hasProfile === false) return false;
  const isSuperAdmin = profile.role === 'super_admin';
  if (isSuperAdmin === true) return true;
  const isSuperAdminOnly = item.superAdminOnly === true;
  if (isSuperAdminOnly === true) return false;
  const requiredPermissions = item.requiredPermissions;
  const hasRequiredPermissions = requiredPermissions !== undefined && requiredPermissions.length > 0;
  if (hasRequiredPermissions === false) return true;
  return hasRequiredAdminNavPermission(requiredPermissions, profile);
}

function countVisibleAdminNavItems(items: readonly NavItem[], profile: AdminProfileCache | null): number {
  let count = 0;

  for (const item of items) {
    const canAccess = canAccessAdminNav(item, profile);
    if (canAccess === true) {
      count += 1;
    }
  }

  return count;
}

function isAdminLayoutNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/admin') {
    return pathname === '/admin';
  }

  const isExactPath = pathname === item.href;
  const isNestedPath = pathname.startsWith(`${item.href}/`);
  return isExactPath === true || isNestedPath === true;
}

function materializeAdminLayoutNavItemNodes({
  items,
  profile,
  pathname,
  copy,
}: {
  items: readonly NavItem[];
  profile: AdminProfileCache | null;
  pathname: string;
  copy: ReturnType<typeof getAdminCopy>;
}): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (const item of items) {
    const canAccess = canAccessAdminNav(item, profile);
    if (canAccess === true) {
      const active = isAdminLayoutNavItemActive(item, pathname);
      nodes.push(
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            active
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
          </svg>
          {copy[item.labelKey]}
        </Link>,
      );
    }
  }

  return nodes;
}

function getAdminAuthStorageFailureDetails(failure: AdminAuthStorageFailureResult | undefined): string {
  const hasFailure = failure !== undefined;
  if (hasFailure === false) {
    return '';
  }

  const failureDetails = failure.details;
  const hasFailureDetails = failureDetails.length > 0;
  if (hasFailureDetails === true) {
    return failureDetails;
  }

  return failure.message;
}

function buildAdminAuthStorageFailureTarget(
  status: AdminAuthStorageRedirectStatus,
  failure?: AdminAuthStorageFailureResult,
) {
  const params = new URLSearchParams({ admin_auth_storage: status });
  const failureSource = failure?.source;
  const hasFailureSource = failureSource !== undefined && failureSource.length > 0;
  if (hasFailureSource === true) {
    params.set('admin_auth_storage_source', failureSource);
  }
  const failureDetails = getAdminAuthStorageFailureDetails(failure);
  const hasFailureDetails = failureDetails.length > 0;
  if (hasFailureDetails === true) {
    params.set('admin_auth_storage_details', failureDetails);
  }
  return `/admin/login?${params.toString()}`;
}

const adminPasswordChangeTarget = '/admin/login?password_change=required';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useUIPreferences();
  const copy = getAdminCopy(locale);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(pathname !== '/admin/login');
  const [adminInfo, setAdminInfo] = useState<AdminProfileCache | null>(null);
  const [authStorageNotice, setAuthStorageNotice] = useState<string | null>(null);
  const [layoutStatusHint, setLayoutStatusHint] = useState<AdminLayoutSnapshotStatus | null>(
    pathname === '/admin/login' ? 'login_route' : 'checking',
  );

  useEffect(() => {
    if (pathname === '/admin/login') {
      setLayoutStatusHint('login_route');
      setChecking(false);
      setAuthed(false);
      return;
    }

    setLayoutStatusHint('checking');
    const url = new URL(window.location.href);
    if (url.searchParams.get('admin_profile_cache_status') === 'failed') {
      const profileCacheSource = resolveAdminProfileCacheUrlStorageSource(url.searchParams.get('admin_profile_cache_source'));
      const profileCacheDetails = url.searchParams.get('admin_profile_cache_details') || '浏览器拒绝保存 Admin 管理员缓存';
      const profileCacheReason = formatAdminProfileCacheUrlStorageFailure(profileCacheSource, profileCacheDetails);
      const profileCacheNotice = `Admin 管理员缓存保存失败：${profileCacheReason}。当前会继续使用后端 profile 响应完成鉴权，但刷新后可能无法从本地 admin_profile 快速恢复管理员信息。`;
      setLayoutStatusHint('profile_cache_write_failed');
      setAuthStorageNotice(profileCacheNotice);
      url.searchParams.delete('admin_profile_cache_status');
      url.searchParams.delete('admin_profile_cache_source');
      url.searchParams.delete('admin_profile_cache_details');
      try {
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      } catch (error) {
        const reason = formatAdminAuthBrowserHistoryError(error, '浏览器拒绝更新地址栏');
        setLayoutStatusHint('profile_cache_url_cleanup_failed');
        setAuthStorageNotice(`${profileCacheNotice} Admin 管理员缓存状态参数清理失败：${reason}。地址栏里的 admin_profile_cache_status/source/details 参数可能仍会残留；如果刷新后再次看到相同旧提示，请以后端最新 profile 校验结果为准。`);
      }
    }

    const tokenResult = adminAuthApi.readTokenStorage();
    if (!tokenResult.ok) {
      setLayoutStatusHint('token_read_failed_redirect');
      router.replace(buildAdminAuthStorageFailureTarget('read_failed', tokenResult));
      setChecking(false);
      return;
    }
    const token = tokenResult.value;
    if (!token) {
      setLayoutStatusHint('token_missing_redirect');
      router.replace('/admin/login');
      setChecking(false);
      return;
    }

    const cachedProfileResult = adminAuthApi.readCachedProfileStorage();
    if (!cachedProfileResult.ok) {
      setLayoutStatusHint('profile_cache_read_failed');
      setAuthStorageNotice(`Admin 管理员缓存读取失败：${formatAdminAuthStorageFailure(cachedProfileResult, '浏览器拒绝读取 Admin 管理员缓存')}。当前会继续向后端校验登录状态，但刷新前展示的管理员信息可能暂时不可用。`);
    } else if (cachedProfileResult.value) {
      if (cachedProfileResult.value.must_change_password === true) {
        setAuthed(false);
        setChecking(false);
        router.replace(adminPasswordChangeTarget);
        return;
      }
      setLayoutStatusHint('cached_profile_ready');
      setAdminInfo(cachedProfileResult.value);
      setAuthed(true);
      setChecking(false);
    } else {
      setChecking(true);
    }

    // Verify token by fetching profile in background
    adminAuthApi.getProfile().then((profile) => {
      if (profile.must_change_password === true) {
        setAuthed(false);
        setAdminInfo(null);
        router.replace(adminPasswordChangeTarget);
        return;
      }
      setAuthed(true);
      setAdminInfo({
        email: profile.email,
        role: profile.role,
        raw_role: profile.raw_role,
        must_change_password: profile.must_change_password,
        permission_codes: profile.permission_codes || [],
      });
      const profileCacheResult = adminAuthApi.persistCachedProfile({
        email: profile.email,
        role: profile.role,
        raw_role: profile.raw_role,
        must_change_password: profile.must_change_password,
        permission_codes: profile.permission_codes || [],
      });
      if (!profileCacheResult.ok) {
        setLayoutStatusHint('profile_cache_write_failed');
        setAuthStorageNotice(`Admin 管理员缓存保存失败：${formatAdminAuthStorageFailure(profileCacheResult, '浏览器拒绝保存 Admin 管理员缓存')}。当前会继续使用后端 profile 响应完成鉴权，但刷新后可能无法从本地 admin_profile 快速恢复管理员信息。`);
      } else {
        setLayoutStatusHint((current) => (
          current === 'profile_cache_url_cleanup_failed' || current === 'profile_cache_write_failed'
            ? current
            : 'profile_verified'
        ));
      }
    }).catch(() => {
      setLayoutStatusHint('profile_verification_failed_redirect');
      const tokenClearResult = adminAuthApi.clearTokenStorage();
      const profileClearResult = adminAuthApi.clearCachedProfile();
      setAuthed(false);
      setAdminInfo(null);
      const failedStorageResult = !tokenClearResult.ok ? tokenClearResult : (!profileClearResult.ok ? profileClearResult : undefined);
      router.replace(
        tokenClearResult.ok && profileClearResult.ok
          ? '/admin/login'
          : buildAdminAuthStorageFailureTarget('clear_failed', failedStorageResult),
      );
    }).finally(() => setChecking(false));
  }, [pathname, router]);

  const visibleNavCount = countVisibleAdminNavItems(navItems, adminInfo);
  const adminLayoutSnapshot = buildAdminLayoutSnapshot({
    pathname,
    checking,
    authed,
    adminInfo,
    authStorageNotice,
    visibleNavCount,
    statusHint: layoutStatusHint,
  });
  const hasAuthStorageNotice = authStorageNotice !== null && authStorageNotice.length > 0;
  const adminEmailLabel = getAdminLayoutOptionalLabel(adminInfo?.email, 'admin');
  const adminAvatarFallbackLabel = getAdminLayoutAvatarFallbackLabel(adminInfo);
  const adminLayoutNavItemNodes = materializeAdminLayoutNavItemNodes({
    items: navItems,
    profile: adminInfo,
    pathname,
    copy,
  });

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-2xl">
          <AdminLayoutSnapshotStrip snapshot={adminLayoutSnapshot} />
        </div>
        <div className="text-gray-500">{copy.loading}</div>
      </div>
    );
  }

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!authed) {
    return null;
  }

  const handleLogout = () => {
    const result = adminAuthApi.logout();
    const failedStorageResult = !result.token.ok ? result.token : (!result.profile.ok ? result.profile : undefined);
    router.push(
      result.token.ok && result.profile.ok
        ? '/admin/login'
        : buildAdminAuthStorageFailureTarget('clear_failed', failedStorageResult),
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">{copy.appTitle}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <AppPreferenceControls />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={undefined} alt={adminEmailLabel} />
                    <AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                      {adminAvatarFallbackLabel}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{adminInfo?.email}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{getAdminRoleLabel(adminInfo)}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-1">
                  <p className="truncate text-sm">{adminInfo?.email}</p>
                  <p className="text-xs font-normal text-muted-foreground">{getAdminRoleLabel(adminInfo)}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {copy.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <nav className="space-y-1 p-3">
            {adminLayoutNavItemNodes}
          </nav>
        </aside>

        <main className="min-h-0 flex-1 overflow-auto">
          <div className="p-6">
            <AdminLayoutSnapshotStrip snapshot={adminLayoutSnapshot} />
            {hasAuthStorageNotice === true && (
              <div role="status" className="mb-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {authStorageNotice}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
