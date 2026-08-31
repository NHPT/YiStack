'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { ArrowLeft, Copy, FileCode } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FileNode } from '@/lib/types';

import {
  applyTemporaryEditorHighlight,
  clearTemporaryEditorHighlight,
  type WorkspaceEditorDecorationIdList,
  type MonacoLikeEditor,
  navigateEditorToSelection,
  resolveEditorSelectionRange,
} from './workspace-editor-navigation';
import { FileTreeNode } from './workspace-page-components';
import type {
  MobileExplorerEditorProps,
  MonacoEditorLanguage,
  SharedExplorerProps,
  WorkspaceExplorerContextMenuAction,
  WorkspaceExplorerToggleFolderAction,
} from './workspace-ide-subpanel-types';
import type {
  EditorBufferStatus,
  ExplorerSnapshotStatus,
  WorkspaceEditorNavigationTarget,
} from './workspace-types';
import { buildEditorPanelSnapshot, EditorPanelSnapshotStrip } from './workspace-editor-panel-snapshot';
import { buildExplorerPanelSnapshot, ExplorerPanelSnapshotStrip } from './workspace-explorer-panel-snapshot';

type MobileExplorerPanelFileTreeNodeList = ReactNode[];
type MobileExplorerPanelSelectFileAction = (path: string) => void | Promise<void>;

function formatEditorBufferStatusTitle(status: EditorBufferStatus) {
  switch (status.status) {
    case 'backend_fresh':
      return '编辑器内容来自后端读取';
    case 'dirty_buffer':
      return '编辑器包含未保存 buffer';
    case 'saved_snapshot':
      return '编辑器已对齐最近保存快照';
    case 'local_preview':
      return '编辑器包含本地预览内容';
    case 'stale_from_cache':
      return '编辑器内容来自缓存快照';
    default:
      return '编辑器内容来源待确认';
  }
}

function getEditorBufferStatusClassName(status: EditorBufferStatus) {
  return status.status === 'backend_fresh' || status.status === 'saved_snapshot'
    ? 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function hasMobileExplorerPanelEditor(editor: MonacoLikeEditor | null): editor is MonacoLikeEditor {
  return editor !== null;
}

function hasMobileExplorerPanelNavigationTarget(
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null,
): editorNavigationTarget is WorkspaceEditorNavigationTarget {
  return editorNavigationTarget !== null;
}

function hasMobileExplorerPanelEditingFile(mobileEditingFile: string): boolean {
  const hasEditingFile = mobileEditingFile.length > 0;
  return hasEditingFile === true;
}

function getMobileExplorerPanelEditorContent(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }

  return value;
}

function getMobileExplorerPanelRenderableSnapshotStatus(
  explorerSnapshotStatus: ExplorerSnapshotStatus | null,
): ExplorerSnapshotStatus | null {
  if (explorerSnapshotStatus === null) {
    return null;
  }

  const isFreshSnapshot = explorerSnapshotStatus.status === 'fresh';
  if (isFreshSnapshot === true) {
    return null;
  }

  return explorerSnapshotStatus;
}

function getMobileExplorerPanelSnapshotStatusTitle(explorerSnapshotStatus: ExplorerSnapshotStatus): string {
  if (explorerSnapshotStatus.status === 'stale_with_stream_preview') {
    return 'Explorer 包含生成流本地预览';
  }

  if (explorerSnapshotStatus.status === 'stale_with_local_changes') {
    return 'Explorer 包含本地事务反映';
  }

  if (explorerSnapshotStatus.status === 'stale_with_snapshot') {
    return 'Explorer 当前显示旧快照';
  }

  return 'Explorer 当前没有可确认文件树快照';
}

function shouldRenderMobileExplorerPanelDirtySaveAction(mobileFileDirty: boolean): boolean {
  return mobileFileDirty === true;
}

function getMobileExplorerPanelRenderableEditorBufferStatus(
  mobileEditorBufferStatus: EditorBufferStatus | null,
): EditorBufferStatus | null {
  if (mobileEditorBufferStatus === null) {
    return null;
  }

  return mobileEditorBufferStatus;
}

function getMobileExplorerPanelEmptyTitle(hasOriginalFileTreeData: boolean): string {
  if (hasOriginalFileTreeData === true) {
    return '没有匹配当前搜索条件的文件';
  }

  return '项目文件树暂无原始数据';
}

function getMobileExplorerPanelEmptyDescription({
  hasOriginalFileTreeData,
  searchQuery,
}: {
  hasOriginalFileTreeData: boolean;
  searchQuery: string;
}): string {
  if (hasOriginalFileTreeData === true) {
    return `搜索 “${searchQuery.trim()}” 暂无结果；清空搜索可恢复完整文件树。`;
  }

  return '后端尚未返回文件树，或当前项目确实还没有文件。可刷新 Explorer 校准后端真源。';
}

function getMobileExplorerPanelEditorLanguage(mobileEditingFile: string): MonacoEditorLanguage {
  if (mobileEditingFile.endsWith('.json')) {
    return 'json';
  }

  if (mobileEditingFile.endsWith('.css')) {
    return 'css';
  }

  if (mobileEditingFile.endsWith('.md')) {
    return 'markdown';
  }

  return 'typescript';
}

function getMobileExplorerPanelDirtyEditingFileLabel({
  mobileEditingFile,
  mobileFileDirty,
}: {
  mobileEditingFile: string;
  mobileFileDirty: boolean;
}): string {
  if (mobileFileDirty === true) {
    return `* ${mobileEditingFile}`;
  }

  return mobileEditingFile;
}

function getMobileExplorerPanelFileTreeNodeKey({
  node,
  index,
}: {
  node: FileNode;
  index: number;
}): string {
  if (node.path.length > 0) {
    return node.path;
  }

  return `file-${index}`;
}

function materializeMobileExplorerPanelFileTreeNodes({
  filteredTree,
  expandedFolders,
  activeFile,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
}: {
  filteredTree: FileNode[];
  expandedFolders: Set<string>;
  activeFile: string | null;
  onToggleFolder: WorkspaceExplorerToggleFolderAction;
  onSelectFile: MobileExplorerPanelSelectFileAction;
  onContextMenu: WorkspaceExplorerContextMenuAction;
}): MobileExplorerPanelFileTreeNodeList {
  const nodes: MobileExplorerPanelFileTreeNodeList = [];

  for (let index = 0; index < filteredTree.length; index += 1) {
    const node = filteredTree[index];
    if (node === undefined) {
      continue;
    }

    nodes.push(
      <FileTreeNode
        key={getMobileExplorerPanelFileTreeNodeKey({ node, index })}
        node={node}
        depth={0}
        expandedFolders={expandedFolders}
        activeFile={activeFile}
        onToggleFolder={onToggleFolder}
        onSelectFile={(path) => void onSelectFile(path)}
        onContextMenu={onContextMenu}
      />,
    );
  }

  return nodes;
}

export function MobileExplorerList({
  filteredTree,
  hasOriginalFileTreeData,
  explorerSnapshotStatus,
  searchQuery,
  expandedFolders,
  activeFile,
  onSearchQueryChange,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
}: SharedExplorerProps) {
  const renderableExplorerSnapshotStatus = getMobileExplorerPanelRenderableSnapshotStatus(explorerSnapshotStatus);
  const emptyTitle = getMobileExplorerPanelEmptyTitle(hasOriginalFileTreeData);
  const emptyDescription = getMobileExplorerPanelEmptyDescription({
    hasOriginalFileTreeData,
    searchQuery,
  });
  const explorerPanelSnapshot = buildExplorerPanelSnapshot({
    filteredTree,
    hasOriginalFileTreeData,
    explorerSnapshotStatus,
    searchQuery,
    activeFile,
    openFiles: [],
    activeFileBufferStatus: null,
    isActiveDirty: false,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 border-b px-2 flex items-center">
        <Input placeholder="搜索文件..." value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} className="h-7 text-xs" />
      </div>
      <div className="app-debug-only">
        <ExplorerPanelSnapshotStrip snapshot={explorerPanelSnapshot} />
        {renderableExplorerSnapshotStatus !== null && (
          <div className="mx-3 mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
            <p className="font-medium">
              {getMobileExplorerPanelSnapshotStatusTitle(renderableExplorerSnapshotStatus)}
            </p>
            <p className="mt-1">{renderableExplorerSnapshotStatus.message}</p>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filteredTree.length === 0 ? (
          <div className="space-y-1 p-3 text-sm text-muted-foreground">
            <p>{emptyTitle}</p>
            <p className="text-xs">{emptyDescription}</p>
          </div>
        ) : (
          materializeMobileExplorerPanelFileTreeNodes({
            filteredTree,
            expandedFolders,
            activeFile,
            onToggleFolder,
            onSelectFile,
            onContextMenu,
          })
        )}
      </div>
    </div>
  );
}

export function MobileExplorerEditor({
  mobileEditingFile,
  mobileFileContent,
  mobileEditorBufferStatus,
  editorNavigationTarget,
  onClose,
  onEditorNavigationHandled,
  onCopy,
  onSave,
  isFileDirty,
  onUpdateMobileFileContent,
  monacoEditor: MonacoEditor,
}: MobileExplorerEditorProps) {
  const editorRef = useRef<MonacoLikeEditor | null>(null);
  const decorationIdsRef = useRef<WorkspaceEditorDecorationIdList>([]);
  const highlightTimeoutRef = useRef<number | null>(null);
  const mobileFileDirty = isFileDirty(mobileEditingFile);
  const shouldRenderDirtySaveAction = shouldRenderMobileExplorerPanelDirtySaveAction(mobileFileDirty);
  const renderableEditorBufferStatus = getMobileExplorerPanelRenderableEditorBufferStatus(mobileEditorBufferStatus);
  const editorPanelSnapshot = buildEditorPanelSnapshot({
    surface: 'mobile',
    activeFile: mobileEditingFile,
    content: mobileFileContent,
    editorBufferStatus: mobileEditorBufferStatus,
    isDirty: mobileFileDirty,
    editorNavigationTarget,
  });

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      const editor = editorRef.current;
      if (hasMobileExplorerPanelEditor(editor) === true) {
        decorationIdsRef.current = clearTemporaryEditorHighlight(editor, decorationIdsRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (
      hasMobileExplorerPanelNavigationTarget(editorNavigationTarget) === false
      || hasMobileExplorerPanelEditingFile(mobileEditingFile) === false
      || mobileEditingFile !== editorNavigationTarget.path
      || hasMobileExplorerPanelEditor(editor) === false
    ) {
      return;
    }

    const content = mobileFileContent;
    const selection = resolveEditorSelectionRange(content, editorNavigationTarget.searchText, {
      lineNumber: editorNavigationTarget.lineNumber,
      column: editorNavigationTarget.column,
    });

    navigateEditorToSelection(editor, selection);
    decorationIdsRef.current = applyTemporaryEditorHighlight(editor, selection, decorationIdsRef.current);

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      const activeEditor = editorRef.current;
      if (hasMobileExplorerPanelEditor(activeEditor) === false) {
        return;
      }
      decorationIdsRef.current = clearTemporaryEditorHighlight(activeEditor, decorationIdsRef.current);
      highlightTimeoutRef.current = null;
    }, 2200);

    onEditorNavigationHandled();
  }, [editorNavigationTarget, mobileEditingFile, mobileFileContent, onEditorNavigationHandled]);

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 shrink-0 border-b bg-muted/20 px-2 flex items-center">
        <button onClick={onClose} className="rounded p-1.5 hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <FileCode className="ml-1 mr-2 h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">
          {getMobileExplorerPanelDirtyEditingFileLabel({
            mobileEditingFile,
            mobileFileDirty,
          })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          <Copy className="w-4 h-4" />
        </Button>
        {shouldRenderDirtySaveAction === true && (
          <Button size="sm" className="ml-1 h-7 text-xs" onClick={onSave}>
            保存
          </Button>
        )}
      </div>
      <div className="app-debug-only">
        <EditorPanelSnapshotStrip snapshot={editorPanelSnapshot} />
        {renderableEditorBufferStatus !== null && (
          <div className={`mx-3 mt-2 rounded-md border p-2 text-xs ${getEditorBufferStatusClassName(renderableEditorBufferStatus)}`}>
            <p className="font-medium">{formatEditorBufferStatusTitle(renderableEditorBufferStatus)}</p>
            <p className="mt-1">{renderableEditorBufferStatus.message}</p>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language={getMobileExplorerPanelEditorLanguage(mobileEditingFile)}
          value={mobileFileContent}
          onMount={(editor: unknown) => {
            editorRef.current = editor as MonacoLikeEditor;
          }}
          onChange={(value: string | undefined) => onUpdateMobileFileContent(getMobileExplorerPanelEditorContent(value))}
          theme="vs-light"
          options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, wordWrap: 'on', readOnly: false }}
        />
      </div>
    </div>
  );
}
