'use client';

import { useWorkspacePageControllers } from './use-workspace-page-controllers';
import { useWorkspacePageFoundation } from './use-workspace-page-foundation';
import type { MonacoEditorComponent } from './workspace-ide-subpanel-types';
import type { WorkspacePageCompositionContract } from './workspace-page-composition-contract';
import type { WorkspacePlanGenerationProjectIdSet } from './workspace-plan-generation-types';
import type { PersistGenerationState } from './workspace-types';

type UseWorkspacePageCompositionOptions = {
  authLoading: boolean;
  isAuthenticated: boolean;
  hasMounted: boolean;
  projectIdParam: string | null;
  projectParam: string | null;
  replaceHome: () => void;
  persistGenerationState: PersistGenerationState;
  requestedPlanProjectsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  plannedProjectIdsAcrossMounts: WorkspacePlanGenerationProjectIdSet;
  monacoEditor: MonacoEditorComponent;
};

export function useWorkspacePageComposition({
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
}: UseWorkspacePageCompositionOptions): WorkspacePageCompositionContract {
  const {
    localState,
    flowState,
    shellState,
    runtimeResources,
    isRestoringWorkspace,
    messageRestoreStatus,
  } = useWorkspacePageFoundation({
    authLoading,
    isAuthenticated,
    hasMounted,
    projectIdParam,
    projectParam,
    replaceHome,
    plannedProjectIdsAcrossMounts,
  });

  const controllers = useWorkspacePageControllers({
    localState,
    flowState,
    shellState,
    runtimeResources,
    persistGenerationState,
    requestedPlanProjectsAcrossMounts,
    plannedProjectIdsAcrossMounts,
    monacoEditor,
  });

  return {
    ...localState,
    ...shellState,
    ...controllers,
    isRestoringWorkspace,
    messageRestoreStatus,
  };
}
