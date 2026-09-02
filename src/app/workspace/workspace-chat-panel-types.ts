import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
} from 'react';

import type { Plan } from '@/lib/api';
import type { GitCommit } from '@/lib/types';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';

import type {
  ChatAttachmentSnapshot,
  ChatInputSnapshot,
  ChatMode,
  ChatModeSnapshot,
  ChatModelRegistrySnapshot,
  ChatScrollSnapshot,
  GuidanceAction,
  StopGenerationConfirmationSnapshot,
  WorkspaceChatMessage,
  WorkspaceEditorNavigationTarget,
} from './workspace-types';

export type WorkspaceChatAttachment = {
  name: string;
  size: number;
  type: 'image/png' | 'image/jpeg';
  dataUrl: string;
};
export type WorkspaceChatModelOption = { id: string; name: string } & {
  providerId: string;
  providerName: string;
  modelName: string;
  supportsVision: boolean;
};
export type WorkspaceChatMessageList = WorkspaceChatMessage[];
export type WorkspacePlanCountdownValue = number;
export type WorkspacePlanSelectionReadyState = boolean;
export type WorkspaceSelectedPlanId = string | null;
export type WorkspaceChatAutoScrollEnabledState = boolean;
export type WorkspaceChatMessagesContainerRef = RefObject<HTMLDivElement | null>;
export type WorkspaceChatMessagesEndRef = RefObject<HTMLDivElement | null>;
export type WorkspaceChatAutoScrollStateUpdateAction = (element: HTMLDivElement) => void;
export type WorkspaceChatAdjustTextareaHeightAction = () => void;
export type WorkspaceChatKeyDownAction = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
export type WorkspaceChatImagePasteAction = (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
export type WorkspaceChatRemoveAttachmentAction = (index: number) => void;
export type WorkspaceChatFileUploadAction = (event: ChangeEvent<HTMLInputElement>) => void;
export type WorkspaceChatStopGenerateAction = () => void;
export type WorkspaceChatCancelStopGenerateAction = () => void;
export type WorkspaceChatExampleClickAction = (value: string) => void;
export type WorkspaceChatSelectPlanAction = (plan: Plan) => void | Promise<void>;
export type WorkspaceChatAskQuestionAction = (question: string) => void | Promise<void>;
export type WorkspaceChatRunGuidanceAction = (action: GuidanceAction) => void | Promise<void>;
export type WorkspaceChatRestoreCommitAction = (commit: GitCommit) => void | Promise<void>;
export type WorkspaceChatViewCommitAction = (commit: GitCommit) => void | Promise<void>;
export type WorkspaceChatOpenFileAction = (target: string | WorkspaceEditorNavigationTarget) => void | Promise<void>;

export type WorkspaceChatMessagesProps = {
  compact: boolean;
  messages: WorkspaceChatMessageList;
  isPlanning: boolean;
  isGenerating: boolean;
  generationStage: string;
  planCountdown: WorkspacePlanCountdownValue;
  planSelectionReady: WorkspacePlanSelectionReadyState;
  selectedPlanId: WorkspaceSelectedPlanId;
  isBusyGenerating: boolean;
  isChatAutoScrollEnabled: WorkspaceChatAutoScrollEnabledState;
  chatScrollSnapshot: ChatScrollSnapshot;
  containerRef: WorkspaceChatMessagesContainerRef;
  messagesEndRef: WorkspaceChatMessagesEndRef;
  updateChatAutoScrollState: WorkspaceChatAutoScrollStateUpdateAction;
  enableAutoScroll: () => void;
  onExampleClick: WorkspaceChatExampleClickAction;
  onSelectPlan: WorkspaceChatSelectPlanAction;
  onAskQuestion: WorkspaceChatAskQuestionAction;
  onRunAction: WorkspaceChatRunGuidanceAction;
  onRestoreCommit: WorkspaceChatRestoreCommitAction;
  onViewCommit: WorkspaceChatViewCommitAction;
  onOpenFile: WorkspaceChatOpenFileAction;
};

export type WorkspaceChatComposerProps = {
  compact: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  chatInputSnapshot: ChatInputSnapshot;
  planSelectionPending: boolean;
  attachedFiles: WorkspaceChatAttachment[];
  chatAttachmentSnapshot: ChatAttachmentSnapshot;
  chatMode: ChatMode;
  chatModeSnapshot: ChatModeSnapshot;
  models: WorkspaceChatModelOption[];
  selectedModel: string;
  chatModelRegistrySnapshot: ChatModelRegistrySnapshot;
  isOnline: boolean;
  isBusyGenerating: boolean;
  isStopConfirming: boolean;
  stopGenerationConfirmationSnapshot: StopGenerationConfirmationSnapshot;
  setInput: (value: string) => void;
  adjustTextareaHeight: WorkspaceChatAdjustTextareaHeightAction;
  handleKeyDown: WorkspaceChatKeyDownAction;
  handleImagePaste: WorkspaceChatImagePasteAction;
  removeAttachment: WorkspaceChatRemoveAttachmentAction;
  setChatMode: (mode: ChatMode) => void;
  setSelectedModel: (modelId: string) => void;
  toggleOnline: () => void;
  handleFileUpload: WorkspaceChatFileUploadAction;
  handleStopGenerate: WorkspaceChatStopGenerateAction;
  handleCancelStopGenerate: WorkspaceChatCancelStopGenerateAction;
  handleGenerate: () => void;
  foundationStatusLabel: string;
};

export type WorkspaceChatPanelProps = {
  header?: ReactNode;
  messagesProps: WorkspaceChatMessagesProps;
  composerProps: WorkspaceChatComposerProps;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
};
