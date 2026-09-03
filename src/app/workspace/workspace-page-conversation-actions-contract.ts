import type { VisualEditContext } from '@/lib/visual-edit';
import type { WorkspaceFoundationDecisionConfirmation } from './workspace-prompt-actions-contract';
import type { GuidanceAction } from './workspace-types';

export type WorkspacePageConversationActionsContract = {
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
  handleStopGenerate: () => void;
  handleCancelStopGenerate: () => void;
};
