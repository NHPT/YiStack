import type { GuidanceAction } from './workspace-types';

export type WorkspaceFoundationDecisionConfirmation = {
  id?: string;
  title?: string;
  bucket?: string;
  selectedOption?: string;
  notes?: string;
};

export type WorkspacePromptActionsContract = {
  submitPrompt: (rawPrompt: string) => Promise<void>;
  handleGenerate: () => Promise<void>;
  handleSuggestedQuestion: (question: string) => Promise<void>;
  handleSuggestedAction: (action: GuidanceAction) => Promise<void>;
  handleStartFoundation: () => Promise<void>;
  handleConfirmFoundationDecisions: (
    decisions: WorkspaceFoundationDecisionConfirmation[],
  ) => Promise<void>;
  foundationActionLabel: string;
  foundationStatusLabel: string;
};
