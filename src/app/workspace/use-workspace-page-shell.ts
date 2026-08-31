import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { buildWorkspaceGenerationStateStorageFailure } from '@/lib/workspace/workspace-generation-state-local-errors';

import type { WorkspacePageShellContract } from './workspace-page-shell-contract';
import type { PersistedGenerationState, PersistGenerationStateResult } from './workspace-types';

type UseWorkspacePageShellOptions = {
  authLoading: boolean;
  isAuthenticated: boolean;
};

function hasWorkspacePageShellPersistedGenerationState(
  state: PersistedGenerationState | null,
): state is PersistedGenerationState {
  return state !== null;
}

export function useWorkspacePageShell({
  authLoading,
  isAuthenticated,
}: UseWorkspacePageShellOptions): WorkspacePageShellContract {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  }, [router]);

  const replaceHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  const persistGenerationState = useCallback((
    state: PersistedGenerationState | null,
  ): PersistGenerationStateResult => {
    if (typeof window === 'undefined') return { ok: true };

    try {
      if (hasWorkspacePageShellPersistedGenerationState(state) === false) {
        sessionStorage.removeItem('yistack_generation_state');
        return { ok: true };
      }
      sessionStorage.setItem('yistack_generation_state', JSON.stringify(state));
      return { ok: true };
    } catch (error) {
      const failure = buildWorkspaceGenerationStateStorageFailure(
        error,
        state
          ? '浏览器拒绝写入本地生成恢复状态'
          : '浏览器拒绝清理本地生成恢复状态',
      );
      return {
        ...failure,
        operation: state ? 'save' : 'clear',
      };
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (authLoading || !hasMounted || isAuthenticated) return;
    const redirect = `/workspace${typeof window !== 'undefined' ? window.location.search : ''}`;
    router.replace(`/auth?redirect=${encodeURIComponent(redirect)}`);
  }, [authLoading, hasMounted, isAuthenticated, router]);

  return {
    hasMounted,
    goBack,
    replaceHome,
    persistGenerationState,
  };
}
