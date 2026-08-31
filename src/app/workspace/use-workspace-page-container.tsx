'use client';

import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/contexts/auth-context';
import { useWorkspacePageComposition } from './use-workspace-page-composition';
import { useWorkspacePageShell } from './use-workspace-page-shell';
import type { MonacoEditorComponent } from './workspace-ide-subpanel-types';
import type { WorkspacePageContainerContract } from './workspace-page-container-contract';
import type {
  WorkspacePlanGenerationProjectId,
  WorkspacePlanGenerationProjectIdSet,
} from './workspace-plan-generation-types';

const requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet = new Set<WorkspacePlanGenerationProjectId>();
const plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet = new Set<WorkspacePlanGenerationProjectId>();

type UseWorkspacePageContainerOptions = {
  monacoEditor: MonacoEditorComponent;
};

export function useWorkspacePageContainer({
  monacoEditor,
}: UseWorkspacePageContainerOptions): WorkspacePageContainerContract {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const projectIdParam = searchParams.get('projectId');
  const projectParam = searchParams.get('project');

  const {
    hasMounted,
    goBack,
    replaceHome,
    persistGenerationState,
  } = useWorkspacePageShell({
    authLoading,
    isAuthenticated,
  });

  const composition = useWorkspacePageComposition({
    authLoading,
    isAuthenticated,
    hasMounted,
    projectIdParam,
    projectParam,
    replaceHome,
    persistGenerationState,
    requestedPlanProjectsAcrossMounts,
    plannedProjectIdsAcrossMounts,
    monacoEditor,
  });

  return {
    authLoading,
    isAuthenticated,
    hasMounted,
    projectIdParam,
    projectParam,
    goBack,
    ...composition,
  };
}
