import type { VisualEditContext } from '@/lib/visual-edit';
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
  handleVisualEdit: (
    context: VisualEditContext,
    instruction: string,
  ) => Promise<void>;
  handleStartFoundation: () => Promise<void>;
  handleConfirmFoundationDecisions: (
    decisions: WorkspaceFoundationDecisionConfirmation[],
  ) => Promise<void>;
  foundationActionLabel: string;
  foundationStatusLabel: string;
};
