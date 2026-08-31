import type {
  DirtyEditorBufferStatusSource,
  EditorBufferStatus,
  ImplementationStreamEditorBufferPhase,
} from './workspace-types';

type DirtyEditorBufferStatusOptions = {
  filePath: string;
  source: DirtyEditorBufferStatusSource;
};

type ImplementationStreamEditorBufferStatusOptions = {
  filePath: string;
  phase: ImplementationStreamEditorBufferPhase;
};

type LocalFileOperationEditorBufferStatusOptions = {
  previousStatus: EditorBufferStatus;
  filePath: string;
  previousPath: string;
};

export function buildFileSaveEditorBufferStatus(filePath: string): EditorBufferStatus {
  return {
    status: 'saved_snapshot',
    source: 'file_save',
    filePath,
    message: `文件 ${filePath} 已写入后端，编辑器保存快照已与本次保存内容对齐。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildFileReadEditorBufferStatus(filePath: string): EditorBufferStatus {
  return {
    status: 'backend_fresh',
    source: 'file_read',
    filePath,
    message: `文件 ${filePath} 已从后端文件读取接口加载，当前编辑器内容与后端读取结果一致。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildDirtyEditorBufferStatus({
  filePath,
  source,
}: DirtyEditorBufferStatusOptions): EditorBufferStatus {
  return {
    status: 'dirty_buffer',
    source,
    filePath,
    message: source === 'mobile_edit'
      ? `文件 ${filePath} 当前包含移动端未保存编辑器 buffer，尚未写入后端文件或 Git 快照。`
      : `文件 ${filePath} 当前包含未保存的编辑器 buffer，尚未写入后端文件或 Git 快照。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildOpenFileSavedSnapshotEditorBufferStatus(filePath: string): EditorBufferStatus {
  return {
    status: 'saved_snapshot',
    source: 'open_file_cache',
    filePath,
    message: `已丢弃 ${filePath} 的未保存修改，编辑器内容恢复到最近保存快照。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildOpenFileCacheEditorBufferStatus(filePath: string): EditorBufferStatus {
  return {
    status: 'stale_from_cache',
    source: 'open_file_cache',
    filePath,
    message: `文件 ${filePath} 当前从已存在的编辑器缓存打开，尚未在本次打开流程中重新确认后端读取结果。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildImplementationStreamEditorBufferStatus({
  filePath,
  phase,
}: ImplementationStreamEditorBufferStatusOptions): EditorBufferStatus {
  return {
    status: 'local_preview',
    source: 'implementation_stream',
    filePath,
    message: phase === 'running'
      ? `文件 ${filePath} 正在使用 Implementation 生成流本地预览内容，需等待最终资源刷新后再视为后端真源。`
      : `文件 ${filePath} 已应用 Implementation 本地预览内容，仍需最终文件树刷新确认后端真源。`,
    updatedAt: new Date().toISOString(),
  };
}

export function buildLocalFileOperationEditorBufferStatus({
  previousStatus,
  filePath,
  previousPath,
}: LocalFileOperationEditorBufferStatusOptions): EditorBufferStatus {
  return {
    ...previousStatus,
    status: 'local_preview',
    filePath,
    source: 'local_file_operation',
    message: `编辑器 buffer 已随本地文件事务从 ${previousPath} 迁移到 ${filePath}；当前来源需等待后端资源刷新确认。`,
    updatedAt: new Date().toISOString(),
  };
}
