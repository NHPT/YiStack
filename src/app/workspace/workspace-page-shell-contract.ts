import type { PersistGenerationState } from './workspace-types';

export type WorkspacePageShellContract = {
  hasMounted: boolean;
  goBack: () => void;
  replaceHome: () => void;
  persistGenerationState: PersistGenerationState;
};
