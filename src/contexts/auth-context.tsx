'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '@/lib/api';
import type { User, LoginRequest, RegisterRequest } from '@/lib/api';
import type { UserAuthStorageFailureResult } from '@/lib/auth-storage';
import {
  clearUserAuthSessionStorage,
  formatUserAuthCacheParseFailure,
  formatUserAuthStorageFailure,
  persistUserAuthSessionStorage,
  persistUserProfileStorage,
  readUserAuthSessionStorage,
} from '@/lib/auth-storage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authStorageNotice: string | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildUserAuthStorageError(
  message: string,
  result: UserAuthStorageFailureResult,
) {
  const error = new Error(message) as Error & { source: string; details: string };
  error.source = result.source;
  error.details = result.details;
  return error;
}

function setAuthCookie(token: string | null) {
  if (typeof window === 'undefined') return;

  if (!token) {
    document.cookie = 'yistack_token=; Path=/; Max-Age=0; SameSite=Lax';
    return;
  }

  document.cookie = `yistack_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authStorageNotice, setAuthStorageNotice] = useState<string | null>(null);

  // 初始化：从 localStorage 恢复会话
  useEffect(() => {
    const sessionResult = readUserAuthSessionStorage();
    if (!sessionResult.ok) {
      setAuthStorageNotice(`普通登录凭据读取失败：${formatUserAuthStorageFailure(sessionResult, '浏览器拒绝读取普通登录凭据')}。当前无法确认本地 yistack_token/yistack_user，会按未登录状态展示；请检查浏览器本地存储权限后重新登录。`);
      setAuthCookie(null);
      setIsLoading(false);
      return;
    }

    const { token: storedToken, userRaw: storedUser } = sessionResult.value;
    
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setAuthCookie(storedToken);
        setAuthStorageNotice(null);
      } catch (error) {
        const clearResult = clearUserAuthSessionStorage();
        setAuthCookie(null);
        const reason = formatUserAuthCacheParseFailure(error);
        const clearSuffix = clearResult.ok
          ? ''
          : `；损坏凭据清理也失败：${formatUserAuthStorageFailure(clearResult, '浏览器拒绝清理普通登录凭据或本地项目快照')}，yistack_token/yistack_user 可能仍残留`;
        setAuthStorageNotice(`普通登录缓存解析失败：${reason}。已按未登录状态展示并尝试清理损坏凭据${clearSuffix}。请重新登录以恢复会话。`);
      }
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleAuthExpired = (event: Event) => {
      setUser(null);
      setToken(null);
      setAuthCookie(null);
      if (event instanceof CustomEvent && typeof event.detail?.message === 'string') {
        setAuthStorageNotice(event.detail.message);
      }
    };
    const handleAuthStorageFailed = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail?.message === 'string') {
        setAuthStorageNotice(event.detail.message);
      }
    };

    window.addEventListener('yistack:auth-expired', handleAuthExpired);
    window.addEventListener('yistack:auth-storage-failed', handleAuthStorageFailed);
    return () => {
      window.removeEventListener('yistack:auth-expired', handleAuthExpired);
      window.removeEventListener('yistack:auth-storage-failed', handleAuthStorageFailed);
    };
  }, []);

  // 登录
  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    
    // 保存到状态和 localStorage
    setToken(response.token);
    setUser(response.user);
    
    const persistResult = persistUserAuthSessionStorage(response.token, response.user);
    if (!persistResult.ok) {
      setToken(null);
      setUser(null);
      setAuthCookie(null);
      const reason = formatUserAuthStorageFailure(persistResult, '浏览器拒绝保存普通登录凭据');
      setAuthStorageNotice(`登录成功但普通登录凭据保存失败：${reason}。当前不会进入登录态，以免刷新后丢失 yistack_token 或用户信息；请检查浏览器本地存储权限后重试。`);
      throw buildUserAuthStorageError(
        `登录成功但普通登录凭据保存失败：${reason}。请检查浏览器本地存储权限后重试。`,
        persistResult,
      );
    }
    setAuthCookie(response.token);
    setAuthStorageNotice(null);
  }, []);

  // 注册
  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    
    // 保存到状态和 localStorage
    setToken(response.token);
    setUser(response.user);
    
    const persistResult = persistUserAuthSessionStorage(response.token, response.user);
    if (!persistResult.ok) {
      setToken(null);
      setUser(null);
      setAuthCookie(null);
      const reason = formatUserAuthStorageFailure(persistResult, '浏览器拒绝保存普通登录凭据');
      setAuthStorageNotice(`注册成功但普通登录凭据保存失败：${reason}。当前不会进入登录态，以免刷新后丢失 yistack_token 或用户信息；请检查浏览器本地存储权限后重试登录。`);
      throw buildUserAuthStorageError(
        `注册成功但普通登录凭据保存失败：${reason}。请检查浏览器本地存储权限后重试登录。`,
        persistResult,
      );
    }
    setAuthCookie(response.token);
    setAuthStorageNotice(null);
  }, []);

  // 登出
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    
    const clearResult = clearUserAuthSessionStorage();
    setAuthCookie(null);
    if (!clearResult.ok) {
      setAuthStorageNotice(`普通登录凭据清理失败：${formatUserAuthStorageFailure(clearResult, '浏览器拒绝清理普通登录凭据或本地项目快照')}。页面状态已退出登录，但浏览器中的 yistack_token、yistack_user 或 yistack_current_project 可能仍残留；请检查本地存储权限。`);
    } else {
      setAuthStorageNotice(null);
    }
  }, []);

  // 更新用户信息
  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    const persistResult = persistUserProfileStorage(updatedUser);
    if (!persistResult.ok) {
      setAuthStorageNotice(`普通用户缓存更新失败：${formatUserAuthStorageFailure(persistResult, '浏览器拒绝更新普通用户缓存')}。当前页面会继续使用最新用户信息，但刷新后可能仍恢复到旧 yistack_user；请检查浏览器本地存储权限。`);
    } else {
      setAuthStorageNotice(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    authStorageNotice,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// 高阶组件：需要认证的组件包装器
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  { requiresAuth = true, requiredRole }: { requiresAuth?: boolean; requiredRole?: string } = {}
) {
  return function WithAuthComponent(props: P) {
    const { isAuthenticated, isLoading, user } = useAuth();
    
    if (isLoading) {
      return null;
    }
    
    if (requiresAuth && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth?redirect=' + encodeURIComponent(window.location.pathname);
      }
      return null;
    }
    
    if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return null;
    }
    
    return <WrappedComponent {...props} />;
  };
}
