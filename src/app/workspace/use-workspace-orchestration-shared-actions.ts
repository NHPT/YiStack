import { useCallback } from 'react';

import type { Plan } from '@/lib/api';
import {
  normalizeWorkspaceEngineeringState,
  type WorkspaceEngineeringStateSnapshot,
} from '@/lib/workspace/engineering-state';

import {
  appendWorkspaceProjectSnapshotPersistenceFailureMessage,
  createPersistedWorkspaceProject,
  persistWorkspaceProject as persistWorkspaceProjectSnapshot,
} from './workspace-orchestration-support';
import type {
  SharedActionOptions,
  WorkspaceOrchestrationSharedActionsContract,
} from './workspace-orchestration-action-types';
import type { ResolveStepEngineeringState } from './workspace-orchestration-shared';
import type { WorkspaceProjectInfo } from './workspace-types';

type RuntimeStatusPayload = {
  projectId?: string;
  project_id?: string;
  status?: string;
};

function readWorkspaceStepRuntimeStatus(data: Record<string, unknown>): RuntimeStatusPayload | null {
  const meta = data.meta;
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta) === true) {
    return null;
  }
  const runtimeStatus = (meta as Record<string, unknown>).runtime_status;
  if (runtimeStatus === null || typeof runtimeStatus !== 'object' || Array.isArray(runtimeStatus) === true) {
    return null;
  }
  return runtimeStatus as RuntimeStatusPayload;
}

function mapWorkspaceRuntimeStatusToEngineeringStatus(status: string | undefined) {
  switch ((status || '').trim()) {
    case 'ready':
    case 'completed':
    case 'success':
      return 'passed' as const;
    case 'failed':
      return 'failed' as const;
    case 'starting':
    case 'preparing':
    case 'running':
    case 'pending':
      return 'running' as const;
    default:
      return undefined;
  }
}

function mergeWorkspaceStepRuntimeStatus(
  state: WorkspaceEngineeringStateSnapshot | undefined,
  data: Record<string, unknown>,
): WorkspaceEngineeringStateSnapshot | undefined {
  const runtimeStatus = readWorkspaceStepRuntimeStatus(data);
  if (runtimeStatus === null) {
    return state;
  }
  const status = mapWorkspaceRuntimeStatusToEngineeringStatus(runtimeStatus.status);
  if (status === undefined) {
    return state;
  }
  return {
    ...state,
    runtime: {
      ...state?.runtime,
      project_id: runtimeStatus.projectId || runtimeStatus.project_id || state?.runtime?.project_id,
      status,
    },
  };
}

export function useWorkspaceOrchestrationSharedActions({
  initializedProjectIdRef,
  projectInfo,
  setProjectInfo,
  applyOrchestrationSharedMessages,
}: SharedActionOptions): WorkspaceOrchestrationSharedActionsContract {
  const persistWorkspaceProject = useCallback((nextProject: WorkspaceProjectInfo) => {
    appendWorkspaceProjectSnapshotPersistenceFailureMessage(
      applyOrchestrationSharedMessages,
      nextProject.projectId,
      persistWorkspaceProjectSnapshot(nextProject),
    );
  }, [applyOrchestrationSharedMessages]);

  const resolveStepEngineeringState: ResolveStepEngineeringState = useCallback((data) => (
    mergeWorkspaceStepRuntimeStatus(
      normalizeWorkspaceEngineeringState(data.engineeringState),
      data,
    )
  ), []);

  const createPersistedProject = useCallback(async (plan: Plan): Promise<WorkspaceProjectInfo> => {
    return createPersistedWorkspaceProject(plan, {
      initializedProjectIdRef,
      projectInfo,
      setProjectInfo,
      applyOrchestrationSharedMessages,
      persistWorkspaceProject,
    });
  }, [applyOrchestrationSharedMessages, initializedProjectIdRef, persistWorkspaceProject, projectInfo, setProjectInfo]);

  return {
    createPersistedProject,
    persistWorkspaceProject,
    resolveStepEngineeringState,
  };
}
