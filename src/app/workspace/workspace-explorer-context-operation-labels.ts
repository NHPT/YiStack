import type { WorkspaceExplorerContextOperation } from './workspace-types';

export type WorkspaceExplorerContextOperationLabelMap = {
  [operation in WorkspaceExplorerContextOperation]: string;
};

const workspaceExplorerContextOperationLabels: WorkspaceExplorerContextOperationLabelMap = {
  create_file: '新建文件',
  create_directory: '新建文件夹',
  rename_file: '重命名文件',
  rename_directory: '重命名文件夹',
  delete_file: '删除文件',
  delete_directory: '删除文件夹',
};

export function getWorkspaceExplorerContextOperationLabel(operation: WorkspaceExplorerContextOperation) {
  return workspaceExplorerContextOperationLabels[operation];
}
