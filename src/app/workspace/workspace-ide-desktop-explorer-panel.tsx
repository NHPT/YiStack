'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Copy, Download, File, FileCode, FilePlus, FolderPlus, Search, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FileNode } from '@/lib/types';
import { cn } from '@/lib/utils';

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
  DesktopExplorerPanelProps,
  MonacoEditorLanguage,
  WorkspaceEditorFileDirtyCheck,
  WorkspaceEditorRequestCloseFileAction,
  WorkspaceExplorerContextMenuAction,
  WorkspaceExplorerToggleFolderAction,
} from './workspace-ide-subpanel-types';
import type {
  EditorBufferStatus,
  ExplorerSnapshotStatus,
  WorkspaceOpenFilePathList,
  WorkspaceEditorNavigationTarget,
} from './workspace-types';
import { buildEditorPanelSnapshot, EditorPanelSnapshotStrip } from './workspace-editor-panel-snapshot';
import { buildExplorerPanelSnapshot, ExplorerPanelSnapshotStrip } from './workspace-explorer-panel-snapshot';

type DesktopExplorerPanelFileTreeNodeList = ReactNode[];
type DesktopExplorerPanelOpenFileTabNodeList = ReactNode[];
type DesktopExplorerPanelSelectFileAction = (path: string) => void | Promise<void>;
type DesktopExplorerPanelSelectOpenFileAction = (path: string) => void;

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

function hasDesktopExplorerPanelEditor(editor: MonacoLikeEditor | null): editor is MonacoLikeEditor {
  return editor !== null;
}

function hasDesktopExplorerPanelNavigationTarget(
  editorNavigationTarget: WorkspaceEditorNavigationTarget | null,
): editorNavigationTarget is WorkspaceEditorNavigationTarget {
  return editorNavigationTarget !== null;
}

function hasDesktopExplorerPanelActiveFile(activeFile: string | null): activeFile is string {
  return activeFile !== null;
}

function getDesktopExplorerPanelRenderableSnapshotStatus(
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

function getDesktopExplorerPanelSnapshotStatusTitle(explorerSnapshotStatus: ExplorerSnapshotStatus): string {
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

function shouldRenderDesktopExplorerPanelDirtySaveAction(activeFileDirty: boolean): boolean {
  return activeFileDirty === true;
}

function getDesktopExplorerPanelRenderableEditorBufferStatus(
  activeFileBufferStatus: EditorBufferStatus | null,
): EditorBufferStatus | null {
  if (activeFileBufferStatus === null) {
    return null;
  }

  return activeFileBufferStatus;
}

function getDesktopExplorerPanelEmptyTitle(hasOriginalFileTreeData: boolean): string {
  if (hasOriginalFileTreeData === true) {
    return '没有匹配当前搜索条件的文件';
  }

  return '项目文件树暂无原始数据';
}

function getDesktopExplorerPanelEmptyDescription({
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

function getDesktopExplorerPanelOpenFileTabToneClassName(isCurrent: boolean): string {
  if (isCurrent === true) {
    return 'border-border bg-background text-foreground';
  }

  return 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/60';
}

function getDesktopExplorerPanelFileName(filePath: string): string {
  const separatorIndex = filePath.lastIndexOf('/');
  if (separatorIndex === -1) {
    return filePath;
  }

  return filePath.slice(separatorIndex + 1);
}

function getDesktopExplorerPanelDirtyOpenFileLabel({
  filePath,
  isDirty,
}: {
  filePath: string;
  isDirty: boolean;
}): string {
  const fileName = getDesktopExplorerPanelFileName(filePath);
  if (isDirty === true) {
    return `* ${fileName}`;
  }

  return fileName;
}

function getDesktopExplorerPanelDirtyActiveFileLabel({
  activeFile,
  activeFileDirty,
}: {
  activeFile: string;
  activeFileDirty: boolean;
}): string {
  if (activeFileDirty === true) {
    return `* ${activeFile}`;
  }

  return activeFile;
}

function getDesktopExplorerPanelEditorLanguage(activeFile: string): MonacoEditorLanguage {
  if (activeFile.endsWith('.json')) {
    return 'json';
  }

  if (activeFile.endsWith('.css')) {
    return 'css';
  }

  if (activeFile.endsWith('.md')) {
    return 'markdown';
  }

  return 'typescript';
}

function getDesktopExplorerPanelFileTreeNodeKey({
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

function materializeDesktopExplorerPanelFileTreeNodes({
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
  onSelectFile: DesktopExplorerPanelSelectFileAction;
  onContextMenu: WorkspaceExplorerContextMenuAction;
}): DesktopExplorerPanelFileTreeNodeList {
  const nodes: DesktopExplorerPanelFileTreeNodeList = [];

  for (let index = 0; index < filteredTree.length; index += 1) {
    const node = filteredTree[index];
    if (node === undefined) {
      continue;
    }

    nodes.push(
      <FileTreeNode
        key={getDesktopExplorerPanelFileTreeNodeKey({ node, index })}
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

function materializeDesktopExplorerPanelOpenFileTabNodes({
  openFiles,
  activeFile,
  isFileDirty,
  onSelectOpenFile,
  onRequestCloseFile,
}: {
  openFiles: WorkspaceOpenFilePathList;
  activeFile: string;
  isFileDirty: WorkspaceEditorFileDirtyCheck;
  onSelectOpenFile: DesktopExplorerPanelSelectOpenFileAction;
  onRequestCloseFile: WorkspaceEditorRequestCloseFileAction;
}): DesktopExplorerPanelOpenFileTabNodeList {
  const nodes: DesktopExplorerPanelOpenFileTabNodeList = [];

  for (const path of openFiles) {
    const dirty = isFileDirty(path);
    const isCurrent = activeFile === path;
    const openFileTabToneClassName = getDesktopExplorerPanelOpenFileTabToneClassName(isCurrent);
    const openFileTabLabel = getDesktopExplorerPanelDirtyOpenFileLabel({
      filePath: path,
      isDirty: dirty,
    });

    nodes.push(
      <div
        key={path}
        className={cn(
          'flex h-8 min-w-0 max-w-[240px] items-center gap-1 rounded-md border px-2 text-xs',
          openFileTabToneClassName,
        )}
      >
        <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onSelectOpenFile(path)} title={path}>
          {openFileTabLabel}
        </button>
        <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => onRequestCloseFile(path)} aria-label={`关闭 ${path}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>,
    );
  }

  return nodes;
}

export function DesktopExplorerPanel({
  filteredTree,
  hasOriginalFileTreeData,
  explorerSnapshotStatus,
  searchQuery,
  expandedFolders,
  activeFile,
  openFiles,
  activeFileContent,
  activeFileBufferStatus,
  editorNavigationTarget,
  isFileDirty,
  onSearchQueryChange,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
  onExportProject,
  onSelectOpenFile,
  onEditorNavigationHandled,
  onRequestCloseFile,
  onSaveActiveFile,
  onCopyActiveFile,
  onUpdateActiveFileContent,
  monacoEditor: MonacoEditor,
}: DesktopExplorerPanelProps) {
  const editorRef = useRef<MonacoLikeEditor | null>(null);
  const decorationIdsRef = useRef<WorkspaceEditorDecorationIdList>([]);
  const highlightTimeoutRef = useRef<number | null>(null);
  const activeFileDirty = activeFile ? isFileDirty(activeFile) : false;
  const renderableExplorerSnapshotStatus = getDesktopExplorerPanelRenderableSnapshotStatus(explorerSnapshotStatus);
  const shouldRenderDirtySaveAction = shouldRenderDesktopExplorerPanelDirtySaveAction(activeFileDirty);
  const renderableEditorBufferStatus = getDesktopExplorerPanelRenderableEditorBufferStatus(activeFileBufferStatus);
  const emptyTitle = getDesktopExplorerPanelEmptyTitle(hasOriginalFileTreeData);
  const emptyDescription = getDesktopExplorerPanelEmptyDescription({
    hasOriginalFileTreeData,
    searchQuery,
  });
  const explorerPanelSnapshot = buildExplorerPanelSnapshot({
    filteredTree,
    hasOriginalFileTreeData,
    explorerSnapshotStatus,
    searchQuery,
    activeFile,
    openFiles,
    activeFileBufferStatus,
    isActiveDirty: activeFileDirty,
  });
  const editorPanelSnapshot = buildEditorPanelSnapshot({
    surface: 'desktop',
    activeFile,
    content: activeFileContent,
    editorBufferStatus: activeFileBufferStatus,
    isDirty: activeFileDirty,
    editorNavigationTarget,
  });

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      const editor = editorRef.current;
      if (hasDesktopExplorerPanelEditor(editor) === true) {
        decorationIdsRef.current = clearTemporaryEditorHighlight(editor, decorationIdsRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (
      hasDesktopExplorerPanelNavigationTarget(editorNavigationTarget) === false
      || hasDesktopExplorerPanelActiveFile(activeFile) === false
      || activeFile !== editorNavigationTarget.path
      || hasDesktopExplorerPanelEditor(editor) === false
    ) {
      return;
    }

    const content = activeFileContent;
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
      if (hasDesktopExplorerPanelEditor(activeEditor) === false) {
        return;
      }
      decorationIdsRef.current = clearTemporaryEditorHighlight(activeEditor, decorationIdsRef.current);
      highlightTimeoutRef.current = null;
    }, 2200);

    onEditorNavigationHandled();
  }, [activeFile, activeFileContent, editorNavigationTarget, onEditorNavigationHandled]);

  return (
    <div className="h-full flex">
      <div className="w-64 shrink-0 border-r flex flex-col">
        <div className="h-10 border-b bg-muted/20 px-2 flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="项目导出" onClick={onExportProject}>
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="新建文件">
            <FilePlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="新建文件夹">
            <FolderPlus className="w-4 h-4" />
          </Button>
          <label>
            <input type="file" multiple className="hidden" />
            <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" title="上传文件" asChild>
              <span><Upload className="w-4 h-4" /></span>
            </Button>
          </label>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-10 border-b px-2 flex items-center">
          <Input placeholder="搜索文件..." value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} className="h-7 text-xs" />
        </div>
        <div className="app-debug-only">
          <ExplorerPanelSnapshotStrip snapshot={explorerPanelSnapshot} />
          {renderableExplorerSnapshotStatus !== null && (
            <div className="mx-3 mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-medium">
                {getDesktopExplorerPanelSnapshotStatusTitle(renderableExplorerSnapshotStatus)}
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
            materializeDesktopExplorerPanelFileTreeNodes({
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

      <div className="flex-1 min-w-0 flex flex-col">
        {activeFile ? (
          <>
            <div className="min-h-10 shrink-0 border-b bg-muted/10 px-2 flex items-center gap-1 overflow-x-auto">
              {materializeDesktopExplorerPanelOpenFileTabNodes({
                openFiles,
                activeFile,
                isFileDirty,
                onSelectOpenFile,
                onRequestCloseFile,
              })}
            </div>
            <div className="h-10 shrink-0 border-b bg-muted/20 px-4 flex items-center">
              <FileCode className="mr-2 w-4 h-4 text-muted-foreground" />
              <span className="truncate text-sm font-medium">
                {getDesktopExplorerPanelDirtyActiveFileLabel({
                  activeFile,
                  activeFileDirty,
                })}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {shouldRenderDirtySaveAction === true && (
                  <Button size="sm" className="h-7 text-xs" onClick={onSaveActiveFile}>
                    保存
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopyActiveFile}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="app-debug-only">
              <EditorPanelSnapshotStrip snapshot={editorPanelSnapshot} />
              {renderableEditorBufferStatus !== null && (
                <div className={cn('mx-3 mt-2 rounded-md border p-2 text-xs', getEditorBufferStatusClassName(renderableEditorBufferStatus))}>
                  <p className="font-medium">{formatEditorBufferStatusTitle(renderableEditorBufferStatus)}</p>
                  <p className="mt-1">{renderableEditorBufferStatus.message}</p>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language={getDesktopExplorerPanelEditorLanguage(activeFile)}
                value={activeFileContent}
                onMount={(editor: unknown) => {
                  editorRef.current = editor as MonacoLikeEditor;
                }}
                onChange={(value: string | undefined) => {
                  if (value !== undefined) {
                    onUpdateActiveFileContent(value);
                  }
                }}
                theme="vs-light"
                options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, wordWrap: 'on' }}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <File className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <div className="app-debug-only">
                <EditorPanelSnapshotStrip snapshot={editorPanelSnapshot} />
              </div>
              <p className="text-sm">选择一个文件查看内容</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
