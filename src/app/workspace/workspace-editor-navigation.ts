type EditorSelectionRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type WorkspaceEditorDecorationId = string;
export type WorkspaceEditorDecorationIdList = WorkspaceEditorDecorationId[];
export type WorkspaceEditorDecorationOptions = {
  isWholeLine?: boolean;
  className?: string;
  inlineClassName?: string;
};
export type WorkspaceEditorDecorationInput = {
  range: EditorSelectionRange;
  options: WorkspaceEditorDecorationOptions;
};
export type WorkspaceEditorDecorationInputList = WorkspaceEditorDecorationInput[];

export type MonacoLikeEditor = {
  focus?: () => void;
  setPosition?: (position: { lineNumber: number; column: number }) => void;
  setSelection?: (selection: EditorSelectionRange) => void;
  revealLineInCenter?: (lineNumber: number) => void;
  deltaDecorations?: (
    oldDecorations: WorkspaceEditorDecorationIdList,
    newDecorations: WorkspaceEditorDecorationInputList,
  ) => WorkspaceEditorDecorationIdList;
};

type EditorNavigationPosition = {
  lineNumber?: number;
  column?: number;
};

function getEditorNavigationSearchText(searchText: string | undefined): string {
  const hasSearchText = searchText !== undefined;
  if (hasSearchText === false) {
    return '';
  }

  return searchText.trim();
}

function getEditorNavigationLastLine(lines: string[]): string | undefined {
  let lastLine: string | undefined;

  for (const line of lines) {
    lastLine = line;
  }

  return lastLine;
}

function getEditorNavigationLineLength(line: string | undefined): number {
  if (line === undefined) {
    return 0;
  }

  return line.length;
}

export function resolveEditorSelectionRange(
  content: string,
  searchText?: string,
  position?: EditorNavigationPosition,
): EditorSelectionRange {
  const trimmedSearchText = getEditorNavigationSearchText(searchText);
  const hasSearchText = trimmedSearchText.length > 0;
  const normalizedSearchText = hasSearchText === true ? trimmedSearchText : null;
  let lineNumber = typeof position?.lineNumber === 'number' && position.lineNumber > 0
    ? position.lineNumber
    : 1;
  let column = typeof position?.column === 'number' && position.column > 0
    ? position.column
    : 1;

  if (normalizedSearchText !== null) {
    const index = content.indexOf(normalizedSearchText);
    if (index >= 0) {
      const prefix = content.slice(0, index);
      const lines = prefix.split('\n');
      const lastLine = getEditorNavigationLastLine(lines);
      const lastLineLength = getEditorNavigationLineLength(lastLine);
      lineNumber = lines.length;
      column = lastLineLength + 1;
    }
  }
  const searchTextLength = normalizedSearchText !== null ? normalizedSearchText.length : 0;
  const selectionLength = Math.max(searchTextLength, 1);

  return {
    startLineNumber: lineNumber,
    startColumn: column,
    endLineNumber: lineNumber,
    endColumn: column + selectionLength,
  };
}

export function navigateEditorToSelection(editor: MonacoLikeEditor, selection: EditorSelectionRange) {
  editor.focus?.();
  editor.setPosition?.({
    lineNumber: selection.startLineNumber,
    column: selection.startColumn,
  });
  editor.setSelection?.(selection);
  editor.revealLineInCenter?.(selection.startLineNumber);
}

export function applyTemporaryEditorHighlight(
  editor: MonacoLikeEditor,
  selection: EditorSelectionRange,
  previousDecorationIds: WorkspaceEditorDecorationIdList,
): WorkspaceEditorDecorationIdList {
  const deltaDecorations = editor.deltaDecorations;
  const hasDeltaDecorations = deltaDecorations !== undefined;

  if (hasDeltaDecorations === false) {
    return previousDecorationIds;
  }

  return deltaDecorations(previousDecorationIds, [
    {
      range: selection,
      options: {
        isWholeLine: true,
        className: 'workspace-editor-navigation-highlight-line',
      },
    },
    {
      range: selection,
      options: {
        inlineClassName: 'workspace-editor-navigation-highlight-inline',
      },
    },
  ]);
}

export function clearTemporaryEditorHighlight(
  editor: MonacoLikeEditor,
  decorationIds: WorkspaceEditorDecorationIdList,
): WorkspaceEditorDecorationIdList {
  const deltaDecorations = editor.deltaDecorations;
  const hasDeltaDecorations = deltaDecorations !== undefined;
  const hasDecorationIds = decorationIds.length > 0;

  if (hasDeltaDecorations === false || hasDecorationIds === false) {
    return [];
  }

  return deltaDecorations(decorationIds, []);
}
