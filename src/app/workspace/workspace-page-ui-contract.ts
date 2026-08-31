import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from 'react';

import type { FileNode } from '@/lib/types';

import type {
  ExplorerSnapshotStatus,
  IDETab,
  WorkspaceBrowserDevice,
} from './workspace-types';

export type WorkspacePageUiModel = {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  modelName: string;
};

export type WorkspacePageUiPreviewDeviceStyle = {
  width: string;
  height: string;
};

export type WorkspacePageUiPreviewDeviceStyleMap = {
  [device in WorkspaceBrowserDevice]: WorkspacePageUiPreviewDeviceStyle;
};

export type WorkspacePageUiTab = {
  id: IDETab;
  label: string;
  icon: ReactNode;
};

export type WorkspacePageUiContract = {
  adjustTextareaHeight: (value?: string) => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  copyToClipboard: (text: string) => Promise<void>;
  exportProject: () => void;
  quoteToChat: (path: string) => void;
  clearChat: () => void;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: (index: number) => void;
  filteredTree: FileNode[];
  hasOriginalFileTreeData: boolean;
  explorerSnapshotStatus: ExplorerSnapshotStatus | null;
  models: WorkspacePageUiModel[];
  runtimeEnabled: boolean;
  tabs: WorkspacePageUiTab[];
  previewDeviceStyle: WorkspacePageUiPreviewDeviceStyle;
};
