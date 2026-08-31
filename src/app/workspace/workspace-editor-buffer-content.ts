import type { EditorBufferStatus } from './workspace-types';

function hasWorkspaceEditorBufferFilePath(filePath: string | null): filePath is string {
  if (filePath === null) {
    return false;
  }

  const hasFilePath = filePath.length > 0;
  return hasFilePath === true;
}

export function hasWorkspaceEditorBufferContent(
  files: Map<string, string>,
  filePath: string | null,
): filePath is string {
  const hasFilePath = hasWorkspaceEditorBufferFilePath(filePath);
  if (hasFilePath === false) {
    return false;
  }

  return files.has(filePath) === true;
}

export function getWorkspaceEditorBufferContent(
  files: Map<string, string>,
  filePath: string | null,
): string {
  const hasBufferContent = hasWorkspaceEditorBufferContent(files, filePath);
  if (hasBufferContent === false) {
    return '';
  }

  const content = files.get(filePath);
  const hasContent = content !== undefined;
  if (hasContent === false) {
    return '';
  }

  return content;
}

export function getWorkspaceEditorBufferStatus(
  editorBufferStatuses: Map<string, EditorBufferStatus>,
  filePath: string | null,
): EditorBufferStatus | null {
  const hasFilePath = hasWorkspaceEditorBufferFilePath(filePath);
  if (hasFilePath === false) {
    return null;
  }

  const status = editorBufferStatuses.get(filePath);
  const hasStatus = status !== undefined;
  if (hasStatus === false) {
    return null;
  }

  return status;
}

export function isWorkspaceEditorBufferDirty({
  files,
  savedFiles,
  filePath,
}: {
  files: Map<string, string>;
  savedFiles: Map<string, string>;
  filePath: string | null;
}): boolean {
  const currentContent = getWorkspaceEditorBufferContent(files, filePath);
  const savedContent = getWorkspaceEditorBufferContent(savedFiles, filePath);

  return currentContent !== savedContent;
}
