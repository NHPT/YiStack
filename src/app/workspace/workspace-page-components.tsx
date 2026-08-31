'use client';

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import {
  ArrowLeft,
  FolderOpen,
  Layers,
  Copy as CopyIcon,
  ChevronRight,
  Download,
  Edit3,
  FileCode,
  FileJson,
  FilePlus,
  FileText,
  FolderPlus,
  FolderClosed,
  MessageSquare,
  Settings,
  Trash2,
  Trash,
} from 'lucide-react';
import Link from 'next/link';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { FileNode } from '@/lib/types';

import type {
  WorkspaceContextMenu,
  WorkspaceContextMenuNode,
  WorkspaceExplorerContextOperation,
  WorkspaceExplorerContextOperationInput,
  WorkspaceMobileView,
  WorkspacePageLoadingSnapshotSource,
} from './workspace-types';
import type {
  WorkspaceDesktopShellProps,
  WorkspaceMobileShellProps,
  WorkspacePageHeaderProps,
  WorkspacePageOverlaysProps,
  WorkspacePageScaffoldProps,
} from './workspace-page-component-types';
import { getWorkspaceExplorerContextOperationLabel } from './workspace-explorer-context-operation-labels';
import { buildWorkspacePageHeaderSnapshot, WorkspacePageHeaderSnapshotStrip } from './workspace-page-header-snapshot';
import { buildWorkspacePageLoadingSnapshot, WorkspacePageLoadingSnapshotStrip } from './workspace-page-loading-snapshot';
import { buildWorkspaceMobileShellSnapshot, WorkspaceMobileShellSnapshotStrip } from './workspace-mobile-shell-snapshot';
import { WorkspaceProjectBootstrapSnapshotStrip } from './workspace-project-bootstrap-snapshot';
import {
  buildWorkspaceCommitRestoreConfirmationSnapshot,
  WorkspaceCommitRestoreConfirmationSnapshotStrip,
} from './workspace-commit-restore-confirmation-snapshot';
import {
  buildClearChatConfirmationSnapshot,
  ClearChatConfirmationSnapshotStrip,
} from './workspace-clear-chat-confirmation-snapshot';
import {
  buildWorkspaceDirtyCloseConfirmationSnapshot,
  WorkspaceDirtyCloseConfirmationSnapshotStrip,
} from './workspace-dirty-close-confirmation-snapshot';
import {
  buildWorkspaceExplorerOperationConfirmationSnapshot,
  WorkspaceExplorerOperationConfirmationSnapshotStrip,
} from './workspace-explorer-operation-confirmation-snapshot';

type WorkspaceFileTreeNodeList = ReactNode[];
type WorkspaceFileTreeNodeSelectAction = (path: string) => void;
type WorkspaceFileTreeNodeToggleAction = (path: string) => void;
type WorkspaceFileTreeNodeContextMenuAction = (event: ReactMouseEvent, node: FileNode) => void;

export function FileTreeNode({
  node,
  depth,
  expandedFolders,
  activeFile,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
}: {
  node: FileNode;
  depth: number;
  expandedFolders: Set<string>;
  activeFile: string | null;
  onToggleFolder: WorkspaceFileTreeNodeToggleAction;
  onSelectFile: WorkspaceFileTreeNodeSelectAction;
  onContextMenu: WorkspaceFileTreeNodeContextMenuAction;
}) {
  const isFolder = isWorkspaceFileTreeNodeFolder(node);
  const isExpanded = expandedFolders.has(node.path);
  const nodeIcon = renderWorkspaceFileTreeNodeIcon({ node, isFolder, isExpanded });
  const isActive = isWorkspaceFileTreeNodeActive({
    activeFile,
    nodePath: node.path,
  });
  const nodeActiveClassName = getWorkspaceFileTreeNodeActiveClassName(isActive);
  const chevronRotationClassName = getWorkspaceFileTreeNodeChevronRotationClassName(isExpanded);
  const children = getWorkspacePageComponentFileNodeChildren(node.children);
  const shouldRenderChevron = shouldRenderWorkspaceFileTreeNodeChevron(isFolder);
  const shouldRenderChildren = shouldRenderWorkspaceFileTreeNodeChildren({
    isFolder,
    isExpanded,
    children,
  });
  const handleNodeClick = () => {
    if (isFolder === true) {
      onToggleFolder(node.path);
      return;
    }

    onSelectFile(node.path);
  };

  return (
    <div>
      <button
        onClick={handleNodeClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        className={cn('w-full flex items-center gap-1 px-2 py-1 text-sm transition-colors hover:bg-muted/50', nodeActiveClassName)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {shouldRenderChevron === true && (
          <ChevronRight className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', chevronRotationClassName)} />
        )}
        {nodeIcon}
        <span className="truncate">{node.name}</span>
      </button>
      {shouldRenderChildren === true && (
        <div>
          {materializeWorkspaceFileTreeNodeChildren({
            children,
            depth,
            expandedFolders,
            activeFile,
            onToggleFolder,
            onSelectFile,
            onContextMenu,
          })}
        </div>
      )}
    </div>
  );
}

export function ContextMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const dangerClassName = getWorkspaceContextMenuItemDangerClassName(danger);

  return (
    <button
      onClick={onClick}
      className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-muted', dangerClassName)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Divider() {
  return <div className="my-1 h-px bg-border" />;
}

type PendingExplorerOperation = {
  operation: WorkspaceExplorerContextOperation;
  node: FileNode;
};

type WorkspaceExplorerOperationKind = 'create' | 'rename' | 'delete';

function isWorkspaceFileTreeNodeFolder(node: FileNode): boolean {
  if (node.type === 'folder') {
    return true;
  }

  if (node.type === 'directory') {
    return true;
  }

  return false;
}

function hasWorkspaceFileTreeTypeScriptExtension(name: string): boolean {
  if (name.endsWith('.tsx')) {
    return true;
  }

  if (name.endsWith('.ts')) {
    return true;
  }

  return false;
}

function renderWorkspaceFileTreeNodeIcon({
  node,
  isFolder,
  isExpanded,
}: {
  node: FileNode;
  isFolder: boolean;
  isExpanded: boolean;
}) {
  const className = cn('h-4 w-4 shrink-0', getWorkspaceFileTreeNodeIconToneClassName(isFolder));
  if (isFolder === true) {
    return isExpanded === true
      ? <FolderOpen className={className} />
      : <FolderClosed className={className} />;
  }
  if (hasWorkspaceFileTreeTypeScriptExtension(node.name) === true) {
    return <FileCode className={className} />;
  }
  if (node.name.endsWith('.json')) {
    return <FileJson className={className} />;
  }
  return <FileText className={className} />;
}

function shouldRenderWorkspaceFileTreeNodeChevron(isFolder: boolean): boolean {
  return isFolder === true;
}

function isWorkspaceFileTreeNodeActive({
  activeFile,
  nodePath,
}: {
  activeFile: string | null;
  nodePath: string;
}): boolean {
  const isActive = activeFile === nodePath;
  return isActive === true;
}

function getWorkspaceFileTreeNodeActiveClassName(isActive: boolean): string | undefined {
  if (isActive === true) {
    return 'bg-muted';
  }

  return undefined;
}

function getWorkspaceFileTreeNodeChevronRotationClassName(isExpanded: boolean): string | undefined {
  if (isExpanded === true) {
    return 'rotate-90';
  }

  return undefined;
}

function getWorkspaceFileTreeNodeIconToneClassName(isFolder: boolean): string {
  if (isFolder === true) {
    return 'text-amber-500';
  }

  return 'text-muted-foreground';
}

function getWorkspaceContextMenuItemDangerClassName(danger: boolean | undefined): string | undefined {
  if (danger === true) {
    return 'text-destructive hover:text-destructive';
  }

  return undefined;
}

function shouldRenderWorkspaceFileTreeNodeChildren({
  isFolder,
  isExpanded,
  children,
}: {
  isFolder: boolean;
  isExpanded: boolean;
  children: FileNode[];
}): boolean {
  if (isFolder === false) {
    return false;
  }

  if (isExpanded === false) {
    return false;
  }

  const hasChildren = children.length > 0;
  return hasChildren === true;
}

function materializeWorkspaceFileTreeNodeChildren({
  children,
  depth,
  expandedFolders,
  activeFile,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
}: {
  children: FileNode[];
  depth: number;
  expandedFolders: Set<string>;
  activeFile: string | null;
  onToggleFolder: WorkspaceFileTreeNodeToggleAction;
  onSelectFile: WorkspaceFileTreeNodeSelectAction;
  onContextMenu: WorkspaceFileTreeNodeContextMenuAction;
}): WorkspaceFileTreeNodeList {
  const nodes: WorkspaceFileTreeNodeList = [];
  const childDepth = depth + 1;

  for (const child of children) {
    nodes.push(
      <FileTreeNode
        key={child.path}
        node={child}
        depth={childDepth}
        expandedFolders={expandedFolders}
        activeFile={activeFile}
        onToggleFolder={onToggleFolder}
        onSelectFile={onSelectFile}
        onContextMenu={onContextMenu}
      />,
    );
  }

  return nodes;
}

function normalizeExplorerEntryName(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function hasWorkspacePageComponentTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspacePageComponentFallbackTextValue(value: string | null | undefined, fallback: string): string {
  const hasValue = hasWorkspacePageComponentTextValue(value);
  if (hasValue === true) {
    return value;
  }

  return fallback;
}

function getWorkspacePathSegments(path: string): string[] {
  const segments: string[] = [];
  for (const part of path.split('/')) {
    const hasPart = hasWorkspacePageComponentTextValue(part);
    if (hasPart === true) {
      segments.push(part);
    }
  }
  return segments;
}

function joinWorkspacePath(parentPath: string, name: string) {
  const normalizedName = normalizeExplorerEntryName(name);
  const hasParentPath = hasWorkspacePageComponentTextValue(parentPath);
  if (hasParentPath === false) {
    return normalizedName;
  }

  return `${parentPath.replace(/\/+$/g, '')}/${normalizedName}`;
}

function renameWorkspacePath(path: string, nextName: string) {
  const segments = getWorkspacePathSegments(path);
  segments.pop();
  return [...segments, normalizeExplorerEntryName(nextName)].join('/');
}

function hasWorkspacePageComponentLastPathSegment(value: string | undefined): value is string {
  const hasLastSegment = value !== undefined;
  return hasLastSegment === true;
}

function getWorkspacePageComponentLastPathSegment(segments: string[]): string | undefined {
  let lastSegment: string | undefined;

  for (const segment of segments) {
    lastSegment = segment;
  }

  return lastSegment;
}

function getExplorerEntryName(path: string) {
  const segments = getWorkspacePathSegments(path);
  const lastSegment = getWorkspacePageComponentLastPathSegment(segments);
  if (hasWorkspacePageComponentLastPathSegment(lastSegment) === true) {
    return lastSegment;
  }

  return path;
}

function getWorkspacePageComponentFileNodeChildren(children: FileNode[] | undefined): FileNode[] {
  if (children === undefined) {
    return [];
  }

  return children;
}

function hasWorkspacePageComponentPathSeparator(value: string): boolean {
  for (const character of value) {
    const hasPathSeparator = character === '/';
    if (hasPathSeparator === true) {
      return true;
    }
  }

  return false;
}

function isUnsafeExplorerEntryName(value: string) {
  const normalizedName = normalizeExplorerEntryName(value);
  const hasNormalizedName = hasWorkspacePageComponentTextValue(normalizedName);
  if (hasNormalizedName === false) {
    return true;
  }

  if (normalizedName === '.') {
    return true;
  }

  if (normalizedName === '..') {
    return true;
  }

  const hasPathSeparator = hasWorkspacePageComponentPathSeparator(normalizedName);
  return hasPathSeparator === true;
}

function hasWorkspacePageComponentMatchingChildName(child: FileNode, normalizedName: string): boolean {
  if (child.name === normalizedName) {
    return true;
  }

  const childEntryName = getExplorerEntryName(child.path);
  if (childEntryName === normalizedName) {
    return true;
  }

  return false;
}

function hasChildNamed(node: FileNode, name: string) {
  const normalizedName = normalizeExplorerEntryName(name);
  const children = getWorkspacePageComponentFileNodeChildren(node.children);
  for (const child of children) {
    const hasMatchingChild = hasWorkspacePageComponentMatchingChildName(child, normalizedName);
    if (hasMatchingChild === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspacePageHeaderAction(action: (() => void) | undefined): boolean {
  const hasAction = action !== undefined;
  return hasAction === true;
}

function shouldRenderWorkspacePageHeaderMobile(isMobile: boolean): boolean {
  const shouldRenderMobile = isMobile === true;
  return shouldRenderMobile === true;
}

function hasWorkspacePageHeaderSettingsAction(isMobile: boolean): boolean {
  const shouldRenderMobile = shouldRenderWorkspacePageHeaderMobile(isMobile);
  const hasSettingsAction = shouldRenderMobile === false;
  return hasSettingsAction === true;
}

function shouldRenderWorkspacePageScaffoldMobileShell(isMobile: boolean): boolean {
  const shouldRenderMobileShell = isMobile === true;
  return shouldRenderMobileShell === true;
}

function shouldRenderWorkspacePageScaffoldDesktopShell(isMobile: boolean): boolean {
  const shouldRenderMobileShell = shouldRenderWorkspacePageScaffoldMobileShell(isMobile);
  const shouldRenderDesktopShell = shouldRenderMobileShell === false;
  return shouldRenderDesktopShell === true;
}

function isWorkspaceMobileBottomNavItemActive(mobileView: WorkspaceMobileView, itemView: WorkspaceMobileView): boolean {
  const isItemActive = mobileView === itemView;
  return isItemActive === true;
}

function getWorkspaceMobileBottomNavItemToneClassName({
  mobileView,
  itemView,
}: {
  mobileView: WorkspaceMobileView;
  itemView: WorkspaceMobileView;
}): string {
  const isItemActive = isWorkspaceMobileBottomNavItemActive(mobileView, itemView);
  if (isItemActive === true) {
    return 'text-primary';
  }

  return 'text-muted-foreground';
}

function getWorkspaceDesktopShellChatPanelVisibilityClassName(chatExpanded: boolean): string {
  if (chatExpanded === true) {
    return 'border-r';
  }

  return 'w-0 border-0 overflow-hidden';
}

function getWorkspaceDesktopShellChatPanelStyle(
  chatExpanded: boolean,
  chatWidth: number,
): { width: number } | undefined {
  if (chatExpanded === true) {
    return { width: chatWidth };
  }

  return undefined;
}

function shouldRenderWorkspaceDesktopShellChatPanel(chatExpanded: boolean): boolean {
  return chatExpanded === true;
}

function shouldRenderWorkspaceDesktopShellResizeHandle(chatExpanded: boolean): boolean {
  return chatExpanded === true;
}

function shouldRenderWorkspaceDesktopShellExpandButton(chatExpanded: boolean): boolean {
  return chatExpanded === false;
}

function getWorkspaceDesktopShellResizeHandleActiveClassName(isResizing: boolean): string | undefined {
  if (isResizing === true) {
    return 'bg-primary';
  }

  return undefined;
}

function getWorkspaceMobileShellPanel({
  mobileView,
  chatPanel,
  idePanel,
}: {
  mobileView: WorkspaceMobileView;
  chatPanel: React.ReactNode;
  idePanel: React.ReactNode;
}): React.ReactNode {
  if (mobileView === 'chat') {
    return chatPanel;
  }

  return idePanel;
}

function isDeleteOperation(operation: WorkspaceExplorerContextOperation) {
  if (operation === 'delete_file') {
    return true;
  }

  if (operation === 'delete_directory') {
    return true;
  }

  return false;
}

function isCreateOperation(operation: WorkspaceExplorerContextOperation) {
  if (operation === 'create_file') {
    return true;
  }

  if (operation === 'create_directory') {
    return true;
  }

  return false;
}

function isRenameOperation(operation: WorkspaceExplorerContextOperation) {
  if (operation === 'rename_file') {
    return true;
  }

  if (operation === 'rename_directory') {
    return true;
  }

  return false;
}

function hasPendingExplorerOperation(
  pendingExplorerOperation: PendingExplorerOperation | null,
): pendingExplorerOperation is PendingExplorerOperation {
  const hasOperation = pendingExplorerOperation !== null;
  return hasOperation === true;
}

function getPendingExplorerOperationLabel(pendingExplorerOperation: PendingExplorerOperation | null): string {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === true) {
    return getWorkspaceExplorerContextOperationLabel(pendingExplorerOperation.operation);
  }

  return '';
}

function getPendingExplorerOperationCurrentName(pendingExplorerOperation: PendingExplorerOperation | null): string {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return '';
  }

  return getWorkspacePageComponentFallbackTextValue(
    pendingExplorerOperation.node.name,
    getExplorerEntryName(pendingExplorerOperation.node.path),
  );
}

function getPendingExplorerOperationPath(
  pendingExplorerOperation: PendingExplorerOperation | null,
  explorerOperationInput: string,
): string {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return '';
  }

  const shouldCreatePath = isCreateOperation(pendingExplorerOperation.operation);
  if (shouldCreatePath === true) {
    return joinWorkspacePath(pendingExplorerOperation.node.path, explorerOperationInput);
  }

  return pendingExplorerOperation.node.path;
}

function getPendingExplorerOperationTargetPath(
  pendingExplorerOperation: PendingExplorerOperation | null,
  explorerOperationInput: string,
): string | undefined {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return undefined;
  }

  const shouldRenamePath = isRenameOperation(pendingExplorerOperation.operation);
  if (shouldRenamePath === false) {
    return undefined;
  }

  return renameWorkspacePath(pendingExplorerOperation.node.path, explorerOperationInput);
}

function getExplorerOperationConfirmationTargetPath({
  pendingExplorerOperation,
  pendingExplorerOperationPath,
  pendingExplorerOperationTargetPath,
}: {
  pendingExplorerOperation: PendingExplorerOperation | null;
  pendingExplorerOperationPath: string;
  pendingExplorerOperationTargetPath: string | undefined;
}): string | null {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return null;
  }

  const shouldRenamePath = isRenameOperation(pendingExplorerOperation.operation);
  if (shouldRenamePath === true) {
    const hasTargetPath = pendingExplorerOperationTargetPath !== undefined;
    if (hasTargetPath === true) {
      return pendingExplorerOperationTargetPath;
    }

    return null;
  }

  const shouldCreatePath = isCreateOperation(pendingExplorerOperation.operation);
  if (shouldCreatePath === true) {
    const hasPendingPath = hasWorkspacePageComponentTextValue(pendingExplorerOperationPath);
    if (hasPendingPath === true) {
      return pendingExplorerOperationPath;
    }

    return null;
  }

  return pendingExplorerOperation.node.path;
}

function getPendingExplorerOperationInputPath(targetPath: string | null): string {
  return getWorkspacePageComponentFallbackTextValue(targetPath, '');
}

function getPendingExplorerOperationInputTargetPath(targetPath: string | null): string | undefined {
  const hasTargetPath = hasWorkspacePageComponentTextValue(targetPath);
  if (hasTargetPath === true) {
    return targetPath;
  }

  return undefined;
}

function shouldRequirePendingExplorerOperationTargetPath(operation: WorkspaceExplorerContextOperation): boolean {
  const shouldCreatePath = isCreateOperation(operation);
  if (shouldCreatePath === true) {
    return true;
  }

  const shouldRenamePath = isRenameOperation(operation);
  if (shouldRenamePath === true) {
    return true;
  }

  return false;
}

function getPendingExplorerOperationDialogInitialInput(
  operation: WorkspaceExplorerContextOperation,
  node: FileNode,
): string {
  const shouldUseCurrentName = isRenameOperation(operation);
  if (shouldUseCurrentName === true) {
    return getWorkspacePageComponentFallbackTextValue(node.name, getExplorerEntryName(node.path));
  }

  return '';
}

function getPendingExplorerOperationInput({
  operation,
  node,
  targetPath,
}: {
  operation: WorkspaceExplorerContextOperation;
  node: FileNode;
  targetPath: string | null;
}): WorkspaceExplorerContextOperationInput | null {
  const shouldUseCreateInput = isCreateOperation(operation);
  if (shouldUseCreateInput === true) {
    return { path: getPendingExplorerOperationInputPath(targetPath) };
  }

  const shouldUseRenameInput = isRenameOperation(operation);
  if (shouldUseRenameInput === true) {
    return { targetPath: getPendingExplorerOperationInputTargetPath(targetPath) };
  }

  return { path: node.path };
}

function getPendingExplorerOperationSnapshotOperation(
  pendingExplorerOperation: PendingExplorerOperation | null,
): WorkspaceExplorerContextOperation | null {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === true) {
    return pendingExplorerOperation.operation;
  }

  return null;
}

function getPendingExplorerOperationSnapshotNode(
  pendingExplorerOperation: PendingExplorerOperation | null,
): FileNode | null {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === true) {
    return pendingExplorerOperation.node;
  }

  return null;
}

function getPendingExplorerOperationSubmitLabel({
  isExplorerOperationSubmitting,
  pendingExplorerOperationLabel,
}: {
  isExplorerOperationSubmitting: boolean;
  pendingExplorerOperationLabel: string;
}): string {
  if (isExplorerOperationSubmitting === true) {
    return `${pendingExplorerOperationLabel}中...`;
  }

  return `确认${pendingExplorerOperationLabel}`;
}

function getWorkspaceCommitRestoreSubmitLabel(isRestoringCommit: boolean): string {
  if (isRestoringCommit === true) {
    return '恢复中...';
  }

  return '确认恢复';
}

function hasWorkspaceContextMenu(contextMenu: WorkspaceContextMenu | null): contextMenu is WorkspaceContextMenu {
  const hasContextMenu = contextMenu !== null;
  return hasContextMenu === true;
}

function hasWorkspaceContextMenuNode(node: WorkspaceContextMenuNode): node is FileNode {
  const hasNode = node !== null;
  return hasNode === true;
}

function hasWorkspaceContextMenuFolder(contextMenu: WorkspaceContextMenu | null): boolean {
  if (contextMenu === null) {
    return false;
  }

  return contextMenu.isFolder === true;
}

function shouldRenderWorkspaceContextMenuFileAction(contextMenu: WorkspaceContextMenu | null): boolean {
  const hasFolder = hasWorkspaceContextMenuFolder(contextMenu);
  return hasFolder === false;
}

function getWorkspaceContextMenuRenameOperation(contextMenu: WorkspaceContextMenu): WorkspaceExplorerContextOperation {
  if (contextMenu.isFolder === true) {
    return 'rename_directory';
  }

  return 'rename_file';
}

function getWorkspaceContextMenuDeleteOperation(contextMenu: WorkspaceContextMenu): WorkspaceExplorerContextOperation {
  if (contextMenu.isFolder === true) {
    return 'delete_directory';
  }

  return 'delete_file';
}

function getWorkspaceContextMenuFileContent(
  files: Map<string, string>,
  node: WorkspaceContextMenuNode,
): string | null {
  const hasNode = hasWorkspaceContextMenuNode(node);
  if (hasNode === false) {
    return null;
  }

  const fileContent = files.get(node.path);
  if (fileContent === undefined) {
    return null;
  }

  return fileContent;
}

function getPendingExplorerInputError({
  pendingExplorerOperation,
  explorerOperationInput,
  pendingExplorerOperationName,
  pendingExplorerOperationCurrentName,
}: {
  pendingExplorerOperation: PendingExplorerOperation | null;
  explorerOperationInput: string;
  pendingExplorerOperationName: string;
  pendingExplorerOperationCurrentName: string;
}): string | null {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return null;
  }

  const shouldSkipInputValidation = isDeleteOperation(pendingExplorerOperation.operation);
  if (shouldSkipInputValidation === true) {
    return null;
  }

  const hasUnsafeEntryName = isUnsafeExplorerEntryName(explorerOperationInput);
  if (hasUnsafeEntryName === true) {
    return '名称不能为空，且不能包含 /、. 或 ..。';
  }

  const shouldCheckChildName = isCreateOperation(pendingExplorerOperation.operation);
  if (shouldCheckChildName === true) {
    const hasExistingChildName = hasChildNamed(pendingExplorerOperation.node, explorerOperationInput);
    if (hasExistingChildName === true) {
      return '当前目录下已存在同名条目。';
    }
  }

  const shouldCheckRenameName = isRenameOperation(pendingExplorerOperation.operation);
  if (shouldCheckRenameName === true) {
    const hasSameName = pendingExplorerOperationName === pendingExplorerOperationCurrentName;
    if (hasSameName === true) {
      return '新名称与当前名称相同。';
    }
  }

  return null;
}

function isWorkspaceExplorerOperationDescendantPath(path: string, nodePath: string): boolean {
  if (path === nodePath) {
    return true;
  }

  const descendantPrefix = `${nodePath}/`;
  if (path.startsWith(descendantPrefix)) {
    return true;
  }

  return false;
}

function hasWorkspaceExplorerTargetPath(paths: string[], targetPath: string): boolean {
  for (const path of paths) {
    const hasTargetPath = path === targetPath;
    if (hasTargetPath === true) {
      return true;
    }
  }

  return false;
}

function getWorkspaceExplorerDirtyTargets(
  paths: Iterable<string>,
  nodePath: string,
  isFileDirty: (path: string | null) => boolean,
): string[] {
  const dirtyTargets: string[] = [];
  for (const path of paths) {
    const isTargetPath = isWorkspaceExplorerOperationDescendantPath(path, nodePath);
    if (isTargetPath === false) {
      continue;
    }

    const hasDirtyFile = isFileDirty(path);
    if (hasDirtyFile === true) {
      dirtyTargets.push(path);
    }
  }

  return dirtyTargets;
}

function getWorkspaceExplorerSavedCacheTargets(
  paths: Iterable<string>,
  nodePath: string,
  dirtyTargets: string[],
): string[] {
  const savedCacheTargets: string[] = [];
  for (const path of paths) {
    const isTargetPath = isWorkspaceExplorerOperationDescendantPath(path, nodePath);
    if (isTargetPath === false) {
      continue;
    }

    const hasDirtyTarget = hasWorkspaceExplorerTargetPath(dirtyTargets, path);
    if (hasDirtyTarget === true) {
      continue;
    }

    savedCacheTargets.push(path);
  }

  return savedCacheTargets;
}

function getWorkspaceExplorerOpenTargets(openFiles: string[], nodePath: string): string[] {
  const openTargets: string[] = [];
  for (const path of openFiles) {
    const isTargetPath = isWorkspaceExplorerOperationDescendantPath(path, nodePath);
    if (isTargetPath === true) {
      openTargets.push(path);
    }
  }

  return openTargets;
}

function getPendingExplorerOperationKind(
  pendingExplorerOperation: PendingExplorerOperation | null,
): WorkspaceExplorerOperationKind | null {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return null;
  }

  const hasDeleteOperation = isDeleteOperation(pendingExplorerOperation.operation);
  if (hasDeleteOperation === true) {
    return 'delete';
  }

  const hasRenameOperation = isRenameOperation(pendingExplorerOperation.operation);
  if (hasRenameOperation === true) {
    return 'rename';
  }

  return 'create';
}

function getPendingExplorerOperationDirtyTargets({
  pendingExplorerOperation,
  operationKind,
  files,
  isFileDirty,
}: {
  pendingExplorerOperation: PendingExplorerOperation | null;
  operationKind: WorkspaceExplorerOperationKind | null;
  files: Map<string, string>;
  isFileDirty: (path: string | null) => boolean;
}): string[] {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return [];
  }

  if (operationKind === 'create') {
    return [];
  }

  return getWorkspaceExplorerDirtyTargets(
    files.keys(),
    pendingExplorerOperation.node.path,
    isFileDirty,
  );
}

function getPendingExplorerOperationSavedCacheTargets({
  pendingExplorerOperation,
  operationKind,
  savedFiles,
  dirtyTargets,
}: {
  pendingExplorerOperation: PendingExplorerOperation | null;
  operationKind: WorkspaceExplorerOperationKind | null;
  savedFiles: Map<string, string>;
  dirtyTargets: string[];
}): string[] {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return [];
  }

  if (operationKind === 'create') {
    return [];
  }

  return getWorkspaceExplorerSavedCacheTargets(
    savedFiles.keys(),
    pendingExplorerOperation.node.path,
    dirtyTargets,
  );
}

function getPendingExplorerOperationOpenTargets({
  pendingExplorerOperation,
  operationKind,
  openFiles,
}: {
  pendingExplorerOperation: PendingExplorerOperation | null;
  operationKind: WorkspaceExplorerOperationKind | null;
  openFiles: string[];
}): string[] {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return [];
  }

  if (operationKind !== 'rename') {
    return [];
  }

  return getWorkspaceExplorerOpenTargets(openFiles, pendingExplorerOperation.node.path);
}

function getPendingExplorerOperationRiskTargetCount({
  operationKind,
  deleteTargetCount,
  renameTargetCount,
}: {
  operationKind: WorkspaceExplorerOperationKind | null;
  deleteTargetCount: number;
  renameTargetCount: number;
}): number {
  if (operationKind === 'delete') {
    return deleteTargetCount;
  }

  if (operationKind === 'rename') {
    return renameTargetCount;
  }

  return 0;
}

function getPendingExplorerOperationScopedTargets({
  operationKind,
  targetOperationKind,
  targets,
}: {
  operationKind: WorkspaceExplorerOperationKind | null;
  targetOperationKind: WorkspaceExplorerOperationKind;
  targets: string[];
}): string[] {
  if (operationKind === targetOperationKind) {
    return targets;
  }

  return [];
}

function shouldRenderPendingExplorerOperationInput(operationKind: WorkspaceExplorerOperationKind | null): boolean {
  if (operationKind === null) {
    return false;
  }

  return operationKind !== 'delete';
}

function shouldRenderPendingExplorerInputError(pendingExplorerInputError: string | null): boolean {
  return pendingExplorerInputError !== null;
}

function shouldRenderPendingExplorerRiskSection({
  operationKind,
  targetOperationKind,
  targetCount,
}: {
  operationKind: WorkspaceExplorerOperationKind | null;
  targetOperationKind: WorkspaceExplorerOperationKind;
  targetCount: number;
}): boolean {
  if (operationKind !== targetOperationKind) {
    return false;
  }

  const hasTargetCount = targetCount > 0;
  return hasTargetCount === true;
}

function getPendingExplorerOperationDialogDescription(
  pendingExplorerOperation: PendingExplorerOperation | null,
  pendingExplorerOperationLabel: string,
): string {
  const hasOperation = hasPendingExplorerOperation(pendingExplorerOperation);
  if (hasOperation === false) {
    return `请输入${pendingExplorerOperationLabel}名称。提交前不会调用后端事务 API。`;
  }

  const shouldDescribeDeleteOperation = isDeleteOperation(pendingExplorerOperation.operation);
  if (shouldDescribeDeleteOperation === true) {
    return `确认${pendingExplorerOperationLabel} ${pendingExplorerOperation.node.path}？该操作会修改后端文件系统并创建 Git 快照。`;
  }

  return `请输入${pendingExplorerOperationLabel}名称。提交前不会调用后端事务 API。`;
}

function getWorkspacePageHeaderProjectName(projectName: string | null | undefined): string {
  return getWorkspacePageComponentFallbackTextValue(projectName, '我的项目');
}

export function WorkspacePageOverlays({
  contextMenu,
  contextMenuRef,
  openFiles,
  files,
  savedFiles,
  isFileDirty,
  pendingCloseFile,
  pendingRestoreCommit,
  isRestoringCommit,
  quoteToChat,
  copyToClipboard,
  downloadFile,
  handleExplorerContextOperation,
  setPendingCloseFile,
  closeWorkspaceFile,
  savePendingCloseFile,
  setPendingRestoreCommit,
  confirmRestoreCommit,
}: WorkspacePageOverlaysProps) {
  const [pendingExplorerOperation, setPendingExplorerOperation] = useState<PendingExplorerOperation | null>(null);
  const [explorerOperationInput, setExplorerOperationInput] = useState('');
  const [isExplorerOperationSubmitting, setIsExplorerOperationSubmitting] = useState(false);
  const pendingExplorerOperationLabel = getPendingExplorerOperationLabel(pendingExplorerOperation);
  const pendingExplorerOperationName = normalizeExplorerEntryName(explorerOperationInput);
  const pendingExplorerOperationCurrentName = getPendingExplorerOperationCurrentName(pendingExplorerOperation);
  const pendingExplorerOperationPath = getPendingExplorerOperationPath(
    pendingExplorerOperation,
    explorerOperationInput,
  );
  const pendingExplorerOperationKind = getPendingExplorerOperationKind(pendingExplorerOperation);
  const pendingExplorerOperationTargetPath = getPendingExplorerOperationTargetPath(
    pendingExplorerOperation,
    explorerOperationInput,
  );
  const pendingExplorerInputError = getPendingExplorerInputError({
    pendingExplorerOperation,
    explorerOperationInput,
    pendingExplorerOperationName,
    pendingExplorerOperationCurrentName,
  });
  const pendingExplorerDirtyTargets = getPendingExplorerOperationDirtyTargets({
    pendingExplorerOperation,
    operationKind: pendingExplorerOperationKind,
    files,
    isFileDirty,
  });
  const pendingExplorerSavedCacheTargets = getPendingExplorerOperationSavedCacheTargets({
    pendingExplorerOperation,
    operationKind: pendingExplorerOperationKind,
    savedFiles,
    dirtyTargets: pendingExplorerDirtyTargets,
  });
  const pendingExplorerOpenTargets = getPendingExplorerOperationOpenTargets({
    pendingExplorerOperation,
    operationKind: pendingExplorerOperationKind,
    openFiles,
  });
  const pendingExplorerDeleteDirtyTargets = getPendingExplorerOperationScopedTargets({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'delete',
    targets: pendingExplorerDirtyTargets,
  });
  const pendingExplorerDeleteSavedCacheTargets = getPendingExplorerOperationScopedTargets({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'delete',
    targets: pendingExplorerSavedCacheTargets,
  });
  const pendingExplorerRenameDirtyTargets = getPendingExplorerOperationScopedTargets({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'rename',
    targets: pendingExplorerDirtyTargets,
  });
  const pendingExplorerRenameSavedCacheTargets = getPendingExplorerOperationScopedTargets({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'rename',
    targets: pendingExplorerSavedCacheTargets,
  });
  const pendingExplorerRenameOpenTargets = pendingExplorerOpenTargets;
  const explorerOperationConfirmationTargetPath = getExplorerOperationConfirmationTargetPath({
    pendingExplorerOperation,
    pendingExplorerOperationPath,
    pendingExplorerOperationTargetPath,
  });
  const explorerOperationConfirmationSnapshot = buildWorkspaceExplorerOperationConfirmationSnapshot({
    operation: getPendingExplorerOperationSnapshotOperation(pendingExplorerOperation),
    node: getPendingExplorerOperationSnapshotNode(pendingExplorerOperation),
    label: pendingExplorerOperationLabel,
    inputName: pendingExplorerOperationName,
    targetPath: explorerOperationConfirmationTargetPath,
    inputError: pendingExplorerInputError,
    isSubmitting: isExplorerOperationSubmitting,
    dirtyTargetCount: getPendingExplorerOperationRiskTargetCount({
      operationKind: pendingExplorerOperationKind,
      deleteTargetCount: pendingExplorerDeleteDirtyTargets.length,
      renameTargetCount: pendingExplorerRenameDirtyTargets.length,
    }),
    savedCacheTargetCount: getPendingExplorerOperationRiskTargetCount({
      operationKind: pendingExplorerOperationKind,
      deleteTargetCount: pendingExplorerDeleteSavedCacheTargets.length,
      renameTargetCount: pendingExplorerRenameSavedCacheTargets.length,
    }),
    openTargetCount: pendingExplorerRenameOpenTargets.length,
  });
  const shouldRenderContextMenu = hasWorkspaceContextMenu(contextMenu);
  const shouldRenderContextMenuFolderActions = hasWorkspaceContextMenuFolder(contextMenu);
  const shouldRenderContextMenuFileActions = shouldRenderWorkspaceContextMenuFileAction(contextMenu);
  const shouldRenderPendingExplorerInput = shouldRenderPendingExplorerOperationInput(pendingExplorerOperationKind);
  const shouldRenderPendingExplorerInputErrorMessage = shouldRenderPendingExplorerInputError(pendingExplorerInputError);
  const shouldRenderPendingExplorerDeleteDirtyTargets = shouldRenderPendingExplorerRiskSection({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'delete',
    targetCount: pendingExplorerDeleteDirtyTargets.length,
  });
  const shouldRenderPendingExplorerDeleteSavedCacheTargets = shouldRenderPendingExplorerRiskSection({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'delete',
    targetCount: pendingExplorerDeleteSavedCacheTargets.length,
  });
  const shouldRenderPendingExplorerRenameDirtyTargets = shouldRenderPendingExplorerRiskSection({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'rename',
    targetCount: pendingExplorerRenameDirtyTargets.length,
  });
  const shouldRenderPendingExplorerRenameSavedCacheTargets = shouldRenderPendingExplorerRiskSection({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'rename',
    targetCount: pendingExplorerRenameSavedCacheTargets.length,
  });
  const shouldRenderPendingExplorerRenameOpenTargets = shouldRenderPendingExplorerRiskSection({
    operationKind: pendingExplorerOperationKind,
    targetOperationKind: 'rename',
    targetCount: pendingExplorerRenameOpenTargets.length,
  });
  const pendingExplorerOperationDialogDescription = getPendingExplorerOperationDialogDescription(
    pendingExplorerOperation,
    pendingExplorerOperationLabel,
  );
  const dirtyCloseConfirmationSnapshot = buildWorkspaceDirtyCloseConfirmationSnapshot({
    filePath: pendingCloseFile,
    hasEditorBuffer: pendingCloseFile ? files.has(pendingCloseFile) : false,
    hasSavedSnapshot: pendingCloseFile ? savedFiles.has(pendingCloseFile) : false,
  });
  const commitRestoreConfirmationSnapshot = buildWorkspaceCommitRestoreConfirmationSnapshot({
    commit: pendingRestoreCommit,
    isRestoring: isRestoringCommit,
  });

  const openExplorerOperationDialog = (
    operation: WorkspaceExplorerContextOperation,
    node: WorkspaceContextMenuNode,
  ) => {
    if (node === null) return;
    if (isExplorerOperationSubmitting === true) return;
    setPendingExplorerOperation({ operation, node });
    setExplorerOperationInput(getPendingExplorerOperationDialogInitialInput(operation, node));
  };

  const closeExplorerOperationDialog = () => {
    if (isExplorerOperationSubmitting === true) return;
    setPendingExplorerOperation(null);
    setExplorerOperationInput('');
  };

  const confirmExplorerOperation = async () => {
    if (
      pendingExplorerOperation === null ||
      explorerOperationConfirmationSnapshot.canConfirm !== true
    ) return;
    const { operation, node } = pendingExplorerOperation;
    const targetPath = explorerOperationConfirmationSnapshot.targetPath;
    const shouldRequireTargetPath = shouldRequirePendingExplorerOperationTargetPath(operation);
    if (shouldRequireTargetPath === true && targetPath === null) return;
    const input = getPendingExplorerOperationInput({ operation, node, targetPath });
    if (input === null) return;
    setIsExplorerOperationSubmitting(true);
    try {
      await handleExplorerContextOperation(operation, node, input);
      setPendingExplorerOperation(null);
      setExplorerOperationInput('');
    } finally {
      setIsExplorerOperationSubmitting(false);
    }
  };

  return (
    <>
      {shouldRenderContextMenu === true && contextMenu !== null && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] rounded-lg border bg-popover py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {shouldRenderContextMenuFolderActions === true && (
            <>
              <ContextMenuItem
                key="new-folder"
                icon={<FolderPlus className="w-4 h-4" />}
                label="新建文件夹"
                onClick={() => openExplorerOperationDialog('create_directory', contextMenu.node)}
              />
              <ContextMenuItem
                key="new-file"
                icon={<FilePlus className="w-4 h-4" />}
                label="新建文件"
                onClick={() => openExplorerOperationDialog('create_file', contextMenu.node)}
              />
              <Divider key="divider-1" />
            </>
          )}
          <ContextMenuItem
            key="quote"
            icon={<FileText className="w-4 h-4" />}
            label="引用到对话"
            onClick={() => {
              const contextMenuNode = contextMenu.node;
              const hasNode = hasWorkspaceContextMenuNode(contextMenuNode);
              if (hasNode === true) {
                quoteToChat(contextMenuNode.path);
              }
            }}
          />
          <ContextMenuItem
            key="rename"
            icon={<Edit3 className="w-4 h-4" />}
            label="重命名"
            onClick={() => openExplorerOperationDialog(getWorkspaceContextMenuRenameOperation(contextMenu), contextMenu.node)}
          />
          <ContextMenuItem
            key="copy-path"
            icon={<CopyIcon className="w-4 h-4" />}
            label="复制路径"
            onClick={() => {
              const contextMenuNode = contextMenu.node;
              const hasNode = hasWorkspaceContextMenuNode(contextMenuNode);
              if (hasNode === true) {
                void copyToClipboard(contextMenuNode.path);
              }
            }}
          />
          {shouldRenderContextMenuFileActions === true && (
            <ContextMenuItem
              key="download"
              icon={<Download className="w-4 h-4" />}
              label="下载"
              onClick={() => {
                const contextMenuNode = contextMenu.node;
                const hasNode = hasWorkspaceContextMenuNode(contextMenuNode);
                if (hasNode === false) {
                  return;
                }

                const fileContent = getWorkspaceContextMenuFileContent(files, contextMenuNode);
                if (fileContent !== null) {
                  downloadFile(contextMenuNode.path, fileContent);
                }
              }}
            />
          )}
          <Divider key="divider-2" />
          <ContextMenuItem
            key="delete"
            icon={<Trash className="w-4 h-4" />}
            label="删除"
            onClick={() => openExplorerOperationDialog(getWorkspaceContextMenuDeleteOperation(contextMenu), contextMenu.node)}
            danger
          />
        </div>
      )}

      <AlertDialog
        open={pendingExplorerOperation !== null}
        onOpenChange={(open) => {
          if (open === false) closeExplorerOperationDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingExplorerOperationLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingExplorerOperationDialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <WorkspaceExplorerOperationConfirmationSnapshotStrip snapshot={explorerOperationConfirmationSnapshot} />

          {shouldRenderPendingExplorerInput === true && (
            <div className="space-y-2 py-2">
              <Input
                value={explorerOperationInput}
                onChange={(event) => setExplorerOperationInput(event.target.value)}
                placeholder="例如 src/components/NewFile.tsx"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                目标路径：{pendingExplorerOperationKind === 'rename'
                  ? pendingExplorerOperationTargetPath
                  : getWorkspacePageComponentFallbackTextValue(pendingExplorerOperationPath, '等待输入名称')}
              </p>
              {shouldRenderPendingExplorerInputErrorMessage === true && (
                <p className="text-xs text-destructive">{pendingExplorerInputError}</p>
              )}
            </div>
          )}

          {shouldRenderPendingExplorerDeleteDirtyTargets === true && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              将丢弃 {pendingExplorerDeleteDirtyTargets.length} 个未保存编辑器修改；这些内容尚未写入后端。
            </div>
          )}

          {shouldRenderPendingExplorerDeleteSavedCacheTargets === true && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              将关闭或清理 {pendingExplorerDeleteSavedCacheTargets.length} 个已保存编辑器缓存；后端删除成功后这些标签页会同步关闭。
            </div>
          )}

          {shouldRenderPendingExplorerRenameDirtyTargets === true && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              将迁移 {pendingExplorerRenameDirtyTargets.length} 个未保存编辑器修改到新路径；后端重命名成功前不会改写这些本地 buffer。
            </div>
          )}

          {shouldRenderPendingExplorerRenameSavedCacheTargets === true && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              将迁移 {pendingExplorerRenameSavedCacheTargets.length} 个已保存编辑器缓存到新路径；后端重命名成功后保存快照会同步改名。
            </div>
          )}

          {shouldRenderPendingExplorerRenameOpenTargets === true && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              将迁移 {pendingExplorerRenameOpenTargets.length} 个已打开标签页到新路径；active/mobile/pending-close 指针会在事务成功后同步更新。
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={explorerOperationConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void confirmExplorerOperation()}
              disabled={explorerOperationConfirmationSnapshot.canConfirm === false}
            >
              {getPendingExplorerOperationSubmitLabel({
                isExplorerOperationSubmitting,
                pendingExplorerOperationLabel,
              })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingCloseFile !== null}
        onOpenChange={(open) => {
          if (open === false) {
            setPendingCloseFile(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>关闭文件前是否保存？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCloseFile
                ? `${pendingCloseFile} 有未保存的修改。你可以先保存，再关闭标签页。`
                : '当前文件有未保存的修改。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <WorkspaceDirtyCloseConfirmationSnapshotStrip snapshot={dirtyCloseConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dirtyCloseConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={dirtyCloseConfirmationSnapshot.canDiscard === false}
              onClick={() => {
                if (
                  pendingCloseFile === null ||
                  dirtyCloseConfirmationSnapshot.canDiscard !== true
                ) return;
                closeWorkspaceFile(pendingCloseFile, true);
                setPendingCloseFile(null);
              }}
            >
              不保存
            </Button>
            <Button
              type="button"
              disabled={dirtyCloseConfirmationSnapshot.canSaveAndClose === false}
              onClick={() => {
                if (dirtyCloseConfirmationSnapshot.canSaveAndClose === true) {
                  void savePendingCloseFile();
                }
              }}
            >
              保存并关闭
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRestoreCommit !== null}
        onOpenChange={(open) => {
          if (open === false && isRestoringCommit === false) {
            setPendingRestoreCommit(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回到该版本</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRestoreCommit
                ? `确定回到版本 ${pendingRestoreCommit.hash} 吗？这会将当前工作区恢复到该提交的内容。`
                : '确定恢复当前版本吗？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <WorkspaceCommitRestoreConfirmationSnapshotStrip snapshot={commitRestoreConfirmationSnapshot} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={commitRestoreConfirmationSnapshot.canCancel === false}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (commitRestoreConfirmationSnapshot.canConfirm === true) {
                  void confirmRestoreCommit();
                }
              }}
              disabled={commitRestoreConfirmationSnapshot.canConfirm === false}
            >
              {getWorkspaceCommitRestoreSubmitLabel(isRestoringCommit)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function WorkspacePageHeader({
  isMobile,
  projectName,
  goBack,
  clearChat,
}: WorkspacePageHeaderProps) {
  const [isClearChatConfirmationOpen, setIsClearChatConfirmationOpen] = useState(false);
  const [isClearChatConfirming, setIsClearChatConfirming] = useState(false);
  const headerSnapshot = buildWorkspacePageHeaderSnapshot({
    isMobile,
    projectName,
    canGoBack: hasWorkspacePageHeaderAction(goBack),
    canClearChat: hasWorkspacePageHeaderAction(clearChat),
    hasSettingsAction: hasWorkspacePageHeaderSettingsAction(isMobile),
  });
  const clearChatConfirmationSnapshot = buildClearChatConfirmationSnapshot({
    isOpen: isClearChatConfirmationOpen,
    isConfirming: isClearChatConfirming,
    isMobile,
    projectName,
  });
  const requestClearChat = () => {
    setIsClearChatConfirmationOpen(true);
  };
  const confirmClearChat = () => {
    if (clearChatConfirmationSnapshot.canConfirm !== true) return;
    setIsClearChatConfirming(true);
    try {
      clearChat();
      setIsClearChatConfirmationOpen(false);
    } finally {
      setIsClearChatConfirming(false);
    }
  };
  const closeClearChatConfirmation = (nextOpen: boolean) => {
    if (nextOpen === false && isClearChatConfirming === true) return;
    setIsClearChatConfirmationOpen(nextOpen);
  };
  const clearChatConfirmationDialog = (
    <AlertDialog open={isClearChatConfirmationOpen} onOpenChange={closeClearChatConfirmation}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>清空当前 Workspace 对话？</AlertDialogTitle>
          <AlertDialogDescription>
            该操作会清理当前页面的聊天消息、Preview 地址、编辑器缓存和打开文件状态；不会删除项目文件或后端项目记录。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ClearChatConfirmationSnapshotStrip snapshot={clearChatConfirmationSnapshot} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearChatConfirmationSnapshot.canCancel === false}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={clearChatConfirmationSnapshot.canConfirm === false}
            onClick={(event) => {
              event.preventDefault();
              if (clearChatConfirmationSnapshot.canConfirm === true) {
                confirmClearChat();
              }
            }}
          >
            确认清空
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const shouldRenderMobileHeader = shouldRenderWorkspacePageHeaderMobile(isMobile);
  if (shouldRenderMobileHeader === true) {
    return (
      <>
        <header className="h-12 shrink-0 border-b bg-card px-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goBack} aria-label="返回上一页" className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Link href="/" className="flex min-w-0 items-center gap-2 rounded-lg transition-opacity hover:opacity-80">
              <div className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="truncate text-sm font-medium">
                {getWorkspacePageHeaderProjectName(projectName)}
              </span>
            </Link>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClearChat} title="清空对话" className="h-8 w-8">
            <Trash2 className="w-4 h-4" />
          </Button>
        </header>
        <WorkspacePageHeaderSnapshotStrip snapshot={headerSnapshot} />
        {clearChatConfirmationDialog}
      </>
    );
  }

  return (
    <>
      <header className="h-14 shrink-0 border-b bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="返回上一页" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Link href="/" className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold">YiStack</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{getWorkspacePageHeaderProjectName(projectName)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={requestClearChat} title="清空对话">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" title="设置">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>
      <WorkspacePageHeaderSnapshotStrip snapshot={headerSnapshot} />
      {clearChatConfirmationDialog}
    </>
  );
}

export function WorkspacePageLoadingState({
  label = '加载中...',
  source = 'manual_label',
  authLoading = false,
  isAuthenticated = false,
}: {
  label?: string;
  source?: WorkspacePageLoadingSnapshotSource;
  authLoading?: boolean;
  isAuthenticated?: boolean;
}) {
  const loadingSnapshot = buildWorkspacePageLoadingSnapshot({
    label,
    source,
    authLoading,
    isAuthenticated,
    hasCustomLabel: label !== '加载中...',
  });

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Spinner className="mx-auto mb-4 h-8 w-8" />
        <p className="text-muted-foreground">{label}</p>
        <WorkspacePageLoadingSnapshotStrip snapshot={loadingSnapshot} />
      </div>
    </div>
  );
}

export function WorkspaceMobileBottomNav({
  mobileView,
  setMobileView,
}: {
  mobileView: WorkspaceMobileView;
  setMobileView: (view: WorkspaceMobileView) => void;
}) {
  const chatItemToneClassName = getWorkspaceMobileBottomNavItemToneClassName({
    mobileView,
    itemView: 'chat',
  });
  const ideItemToneClassName = getWorkspaceMobileBottomNavItemToneClassName({
    mobileView,
    itemView: 'ide',
  });

  return (
    <div className="h-14 shrink-0 border-t bg-background flex">
      <button
        onClick={() => setMobileView('chat')}
        className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors', chatItemToneClassName)}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-xs">对话</span>
      </button>
      <button
        onClick={() => setMobileView('ide')}
        className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors', ideItemToneClassName)}
      >
        <FolderOpen className="w-5 h-5" />
        <span className="text-xs">IDE</span>
      </button>
    </div>
  );
}

export function WorkspaceDesktopShell({
  chatPanelRef,
  chatExpanded,
  chatWidth,
  isResizing,
  onResizeStart,
  onExpandChat,
  chatPanel,
  idePanel,
}: WorkspaceDesktopShellProps) {
  const chatPanelVisibilityClassName = getWorkspaceDesktopShellChatPanelVisibilityClassName(chatExpanded);
  const chatPanelStyle = getWorkspaceDesktopShellChatPanelStyle(chatExpanded, chatWidth);
  const shouldRenderChatPanel = shouldRenderWorkspaceDesktopShellChatPanel(chatExpanded);
  const shouldRenderResizeHandle = shouldRenderWorkspaceDesktopShellResizeHandle(chatExpanded);
  const shouldRenderExpandButton = shouldRenderWorkspaceDesktopShellExpandButton(chatExpanded);
  const resizeHandleActiveClassName = getWorkspaceDesktopShellResizeHandleActiveClassName(isResizing);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div
        ref={chatPanelRef}
        className={cn(
          'h-full flex flex-col shrink-0 transition-[width] duration-75',
          chatPanelVisibilityClassName,
        )}
        style={chatPanelStyle}
      >
        {shouldRenderChatPanel === true && chatPanel}
      </div>

      {shouldRenderResizeHandle === true && (
        <div
          className={cn(
            'w-1 cursor-col-resize shrink-0 bg-border hover:bg-primary/50 transition-colors',
            resizeHandleActiveClassName,
          )}
          onMouseDown={onResizeStart}
        />
      )}

      {shouldRenderExpandButton === true && (
        <Button
          variant="ghost"
          className="h-full w-10 flex flex-col items-center justify-center gap-4 border-r rounded-none shrink-0"
          onClick={onExpandChat}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-xs" style={{ writingMode: 'vertical-rl' }}>
            对话
          </span>
        </Button>
      )}

      <div className="flex min-h-0 flex-1 min-w-0">{idePanel}</div>
    </div>
  );
}

export function WorkspaceMobileShell({
  mobileView,
  setMobileView,
  chatPanel,
  idePanel,
}: WorkspaceMobileShellProps) {
  const mobileShellSnapshot = buildWorkspaceMobileShellSnapshot({
    mobileView,
    chatPanelMounted: chatPanel !== null && chatPanel !== undefined,
    idePanelMounted: idePanel !== null && idePanel !== undefined,
  });
  const mobileShellPanel = getWorkspaceMobileShellPanel({
    mobileView,
    chatPanel,
    idePanel,
  });

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        <WorkspaceMobileShellSnapshotStrip snapshot={mobileShellSnapshot} />
        <div className="flex-1 overflow-hidden">
          {mobileShellPanel}
        </div>
      </div>

      <WorkspaceMobileBottomNav
        mobileView={mobileView}
        setMobileView={setMobileView}
      />
    </>
  );
}

export function WorkspacePageScaffold({
  header,
  bootstrapSnapshot,
  desktop,
  mobile,
  overlays,
}: WorkspacePageScaffoldProps) {
  const shouldRenderDesktopShell = shouldRenderWorkspacePageScaffoldDesktopShell(header.isMobile);
  const shouldRenderMobileShell = shouldRenderWorkspacePageScaffoldMobileShell(header.isMobile);

  return (
    <div className="h-screen flex flex-col bg-background">
      <WorkspacePageHeader {...header} />
      <WorkspaceProjectBootstrapSnapshotStrip snapshot={bootstrapSnapshot} />

      {shouldRenderDesktopShell === true && <WorkspaceDesktopShell {...desktop} />}

      {shouldRenderMobileShell === true && <WorkspaceMobileShell {...mobile} />}

      <WorkspacePageOverlays {...overlays} />
    </div>
  );
}
