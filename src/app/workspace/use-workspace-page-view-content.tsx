'use client';

import { useWorkspacePageContent } from './use-workspace-page-content';
import type { WorkspacePageContentContract } from './workspace-page-content-contract';
import {
  buildWorkspacePageContentOptions,
  type UseWorkspacePageViewContentOptions,
} from './workspace-page-view-content-options';

export function useWorkspacePageViewContent({
  localState,
  flowState,
  shellState,
  monacoEditor,
  uiState,
  actions,
}: UseWorkspacePageViewContentOptions): WorkspacePageContentContract {
  return useWorkspacePageContent(
    buildWorkspacePageContentOptions({
      localState,
      flowState,
      shellState,
      monacoEditor,
      uiState,
      actions,
    }),
  );
}
