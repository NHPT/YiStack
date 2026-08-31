'use client';

import { useRef, useState } from 'react';

import type { FileNode, GitBranch, GitBranchCompare, GitBranchSwitchReadiness, GitCommit, GitRemote, GitRemoteBranch, GitStash, GitTag, GitWorktreeStatus } from '@/lib/types';

import type {
  ChatMode,
  EditorBufferStatus,
  GitCommitDetailStatus,
  GitCommitListStatus,
  GitBranchCompareStatus,
  GitBranchListStatus,
  GitRemoteListStatus,
  GitRemoteBranchListStatus,
  GitStashListStatus,
  GitTagListStatus,
  GitWorktreeStatusState,
  IDETab,
  WorkspaceContextMenu,
  WorkspaceEditorNavigationTarget,
  ExplorerSnapshotStatus,
  WorkspaceOpenFilePathList,
  WorkspaceProjectInfo,
} from './workspace-types';
import {
  buildInitialChatAttachmentSnapshot,
  buildInitialChatModelRegistrySnapshot,
} from './workspace-chat-composer-snapshot';
import type {
  WorkspaceAttachment,
  WorkspaceAvailableModel,
  WorkspacePageLocalStateContract,
} from './workspace-page-local-state-contract';
import type {
  WorkspacePlanGenerationProjectId,
  WorkspacePlanGenerationProjectIdSet,
} from './workspace-plan-generation-types';

export function useWorkspacePageLocalState(): WorkspacePageLocalStateContract {
  const [projectInfo, setProjectInfo] = useState<WorkspaceProjectInfo | null>(null);

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [isStopConfirming, setIsStopConfirming] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);

  const [selectedModel, setSelectedModel] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('implement');
  const [isOnline, setIsOnline] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<WorkspaceAttachment[]>([]);
  const [chatAttachmentSnapshot, setChatAttachmentSnapshot] = useState(buildInitialChatAttachmentSnapshot);
  const [availableModels, setAvailableModels] = useState<WorkspaceAvailableModel[]>([]);
  const [chatModelRegistrySnapshot, setChatModelRegistrySnapshot] = useState(buildInitialChatModelRegistrySnapshot);

  const [activeTab, setActiveTab] = useState<IDETab>('explorer');
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editorNavigationTarget, setEditorNavigationTarget] = useState<WorkspaceEditorNavigationTarget | null>(null);
  const [openFiles, setOpenFiles] = useState<WorkspaceOpenFilePathList>([]);
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [savedFiles, setSavedFiles] = useState<Map<string, string>>(new Map());
  const [editorBufferStatuses, setEditorBufferStatuses] = useState<Map<string, EditorBufferStatus>>(new Map());
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [explorerSnapshotStatus, setExplorerSnapshotStatus] = useState<ExplorerSnapshotStatus | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingCloseFile, setPendingCloseFile] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<WorkspaceContextMenu | null>(null);

  const [gitCommits, setGitCommits] = useState<GitCommit[]>([]);
  const [gitCommitListStatus, setGitCommitListStatus] = useState<GitCommitListStatus | null>(null);
  const [gitBranches, setGitBranches] = useState<GitBranch[]>([]);
  const [gitBranchListStatus, setGitBranchListStatus] = useState<GitBranchListStatus | null>(null);
  const [gitRemotes, setGitRemotes] = useState<GitRemote[]>([]);
  const [gitRemoteListStatus, setGitRemoteListStatus] = useState<GitRemoteListStatus | null>(null);
  const [gitRemoteBranches, setGitRemoteBranches] = useState<GitRemoteBranch[]>([]);
  const [gitRemoteBranchListStatus, setGitRemoteBranchListStatus] = useState<GitRemoteBranchListStatus | null>(null);
  const [gitTags, setGitTags] = useState<GitTag[]>([]);
  const [gitTagListStatus, setGitTagListStatus] = useState<GitTagListStatus | null>(null);
  const [gitStashes, setGitStashes] = useState<GitStash[]>([]);
  const [gitStashListStatus, setGitStashListStatus] = useState<GitStashListStatus | null>(null);
  const [gitWorktreeStatus, setGitWorktreeStatus] = useState<GitWorktreeStatus | null>(null);
  const [gitWorktreeStatusState, setGitWorktreeStatusState] = useState<GitWorktreeStatusState | null>(null);
  const [gitBranchCompare, setGitBranchCompare] = useState<GitBranchCompare | null>(null);
  const [gitBranchCompareStatus, setGitBranchCompareStatus] = useState<GitBranchCompareStatus | null>(null);
  const [gitBranchCompareTarget, setGitBranchCompareTarget] = useState('');
  const [gitBranchSwitchReadiness, setGitBranchSwitchReadiness] = useState<GitBranchSwitchReadiness | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [gitCommitDetailStatus, setGitCommitDetailStatus] = useState<GitCommitDetailStatus | null>(null);
  const [isRestoringCommit, setIsRestoringCommit] = useState(false);
  const [pendingRestoreCommit, setPendingRestoreCommit] = useState<GitCommit | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const initializedProjectIdRef = useRef<string | null>(null);
  const restoredProjectIdRef = useRef<string | null>(null);
  const routeProjectIdRef = useRef<string | null>(null);
  const requestedPlansRef = useRef<WorkspacePlanGenerationProjectIdSet>(new Set<WorkspacePlanGenerationProjectId>());
  const planningProjectIdRef = useRef<string | null>(null);
  const plannedProjectIdsRef = useRef<WorkspacePlanGenerationProjectIdSet>(new Set<WorkspacePlanGenerationProjectId>());
  const autoPlanTriggeredRef = useRef(false);
  const implementingPlanRef = useRef(false);
  const focusedPlanIdRef = useRef<string | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const planningAbortRef = useRef<AbortController | null>(null);

  return {
    projectInfo,
    setProjectInfo,
    input,
    setInput,
    isGenerating,
    setIsGenerating,
    generationStage,
    setGenerationStage,
    isStopConfirming,
    setIsStopConfirming,
    isPlanning,
    setIsPlanning,
    selectedModel,
    setSelectedModel,
    chatMode,
    setChatMode,
    isOnline,
    setIsOnline,
    attachedFiles,
    setAttachedFiles,
    chatAttachmentSnapshot,
    setChatAttachmentSnapshot,
    availableModels,
    setAvailableModels,
    chatModelRegistrySnapshot,
    setChatModelRegistrySnapshot,
    activeTab,
    setActiveTab,
    activeFile,
    setActiveFile,
    editorNavigationTarget,
    setEditorNavigationTarget,
    openFiles,
    setOpenFiles,
    files,
    setFiles,
    savedFiles,
    setSavedFiles,
    editorBufferStatuses,
    setEditorBufferStatuses,
    fileTree,
    setFileTree,
    explorerSnapshotStatus,
    setExplorerSnapshotStatus,
    expandedFolders,
    setExpandedFolders,
    searchQuery,
    setSearchQuery,
    pendingCloseFile,
    setPendingCloseFile,
    contextMenu,
    setContextMenu,
    gitCommits,
    setGitCommits,
    gitCommitListStatus,
    setGitCommitListStatus,
    gitBranches,
    setGitBranches,
    gitBranchListStatus,
    setGitBranchListStatus,
    gitRemotes,
    setGitRemotes,
    gitRemoteListStatus,
    setGitRemoteListStatus,
    gitRemoteBranches,
    setGitRemoteBranches,
    gitRemoteBranchListStatus,
    setGitRemoteBranchListStatus,
    gitTags,
    setGitTags,
    gitTagListStatus,
    setGitTagListStatus,
    gitStashes,
    setGitStashes,
    gitStashListStatus,
    setGitStashListStatus,
    gitWorktreeStatus,
    setGitWorktreeStatus,
    gitWorktreeStatusState,
    setGitWorktreeStatusState,
    gitBranchCompare,
    setGitBranchCompare,
    gitBranchCompareStatus,
    setGitBranchCompareStatus,
    gitBranchCompareTarget,
    setGitBranchCompareTarget,
    gitBranchSwitchReadiness,
    setGitBranchSwitchReadiness,
    selectedCommit,
    setSelectedCommit,
    gitCommitDetailStatus,
    setGitCommitDetailStatus,
    isRestoringCommit,
    setIsRestoringCommit,
    pendingRestoreCommit,
    setPendingRestoreCommit,
    textareaRef,
    contextMenuRef,
    initializedProjectIdRef,
    restoredProjectIdRef,
    routeProjectIdRef,
    requestedPlansRef,
    planningProjectIdRef,
    plannedProjectIdsRef,
    autoPlanTriggeredRef,
    implementingPlanRef,
    focusedPlanIdRef,
    generationAbortRef,
    planningAbortRef,
  };
}
