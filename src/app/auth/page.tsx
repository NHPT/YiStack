'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthOperationFailure } from '@/lib/auth-operation-errors';
import { Layers, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { buildAuthPageSnapshot, AuthPageSnapshotStrip } from './auth-page-snapshot';

type AuthMode = 'login' | 'register';

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, isAuthenticated, isLoading: authLoading, authStorageNotice } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 表单字段
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const redirectTarget = searchParams.get('redirect') || '/';
  const authPageSnapshot = buildAuthPageSnapshot({
    mode,
    redirectTarget,
    authLoading,
    isAuthenticated,
    isSubmitting,
    error,
    authStorageNotice,
    email,
    password,
    username,
  });
  
  // 跳转到首页如果已登录
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(redirectTarget);
    }
  }, [isAuthenticated, authLoading, router, redirectTarget]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        if (!username.trim()) {
          setError('请输入用户名');
          setIsSubmitting(false);
          return;
        }
        await register({ email, password, username });
      }
      
      // 登录/注册成功后跳转
      router.push(redirectTarget);
    } catch (err) {
      setError(formatAuthOperationFailure(err, '操作失败，请稍后重试'));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
  };
  
  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold">YiStack</h1>
            <p className="text-xs text-muted-foreground">一栈生成应用</p>
          </div>
        </Link>
      </div>
      
      {/* 表单卡片 */}
      <div className="bg-card rounded-2xl border shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          {mode === 'login' ? '欢迎回来' : '创建账号'}
        </h2>
        <AuthPageSnapshotStrip snapshot={authPageSnapshot} />
        
        {/* 错误提示 */}
        {error && (
          <Alert className="mb-6 bg-destructive/10 border-destructive/50 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </Alert>
        )}
        {authStorageNotice && (
          <Alert role="status" className="mb-6 bg-amber-50 border-amber-200 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            <span>{authStorageNotice}</span>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名（仅注册时显示） */}
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  required={mode === 'register'}
                />
              </div>
            </div>
          )}
          
          {/* 邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          
          {/* 密码 */}
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
          </div>
          
          {/* 提交按钮 */}
          <Button
            type="submit"
            className="w-full h-11"
            disabled={authPageSnapshot.canSubmit === false}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                {mode === 'login' ? '登录' : '注册'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
        
        {/* 切换模式 */}
        <div className="mt-6 text-center text-sm">
          {mode === 'login' ? (
            <p>
              还没有账号？
              <button
                type="button"
                onClick={toggleMode}
                disabled={authPageSnapshot.canToggleMode === false}
                className="text-primary hover:underline ml-1 disabled:pointer-events-none disabled:opacity-50"
              >
                立即注册
              </button>
            </p>
          ) : (
            <p>
              已有账号？
              <button
                type="button"
                onClick={toggleMode}
                disabled={authPageSnapshot.canToggleMode === false}
                className="text-primary hover:underline ml-1 disabled:pointer-events-none disabled:opacity-50"
              >
                立即登录
              </button>
            </p>
          )}
        </div>
      </div>
      
      {/* 返回首页 */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          aria-disabled={authPageSnapshot.canReturnHome === false}
          className="text-sm text-muted-foreground hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

function AuthLoading() {
  const authLoadingSnapshot = buildAuthPageSnapshot({
    mode: 'login',
    redirectTarget: '/',
    authLoading: true,
    isAuthenticated: false,
    isSubmitting: false,
    error: null,
    authStorageNotice: null,
    email: '',
    password: '',
    username: '',
    sourceOverride: 'suspense',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AuthPageSnapshotStrip snapshot={authLoadingSnapshot} />
      </div>
      <Spinner className="w-8 h-8" />
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Suspense fallback={<AuthLoading />}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
