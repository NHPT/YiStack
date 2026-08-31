import type { WorkspacePageCompositionContract } from './workspace-page-composition-contract';

export type WorkspacePageContainerContract =
  WorkspacePageCompositionContract
  & {
    hasMounted: boolean;
    goBack: () => void;
    authLoading: boolean;
    isAuthenticated: boolean;
    projectIdParam: string | null;
    projectParam: string | null;
  };
