import { cn } from '@/lib/utils';
import type { Project } from '@/lib/api';

import type {
  ProjectEditSaveConfirmationSnapshot,
  ProjectEditSaveConfirmationSnapshotSource,
  ProjectEditSaveConfirmationSnapshotStatus,
  ProjectMutationDialogSnapshot,
  ProjectMutationDialogMode,
  ProjectMutationDialogSnapshotSource,
  ProjectMutationDialogSnapshotStatus,
} from '../workspace/workspace-types';

type ProjectEditFormSnapshotInput = {
  name: string;
  description: string;
  app_type: string;
};

export type ProjectMutationDialogSnapshotValue = string;
type ProjectMutationDialogSnapshotStatusList = readonly ProjectMutationDialogSnapshotStatus[];
type ProjectEditSaveConfirmationSnapshotStatusList = readonly ProjectEditSaveConfirmationSnapshotStatus[];

const PROJECT_MUTATION_DIALOG_BUSY_STATUSES: ProjectMutationDialogSnapshotStatusList = [
  'edit_saving',
  'delete_deleting',
];

const PROJECT_MUTATION_DIALOG_FAILED_STATUSES: ProjectMutationDialogSnapshotStatusList = [
  'edit_failed',
  'delete_failed',
];

const PROJECT_MUTATION_DIALOG_WARNING_STATUSES: ProjectMutationDialogSnapshotStatusList = [
  'edit_name_missing',
  'delete_confirming',
];

const PROJECT_EDIT_SAVE_CONFIRMATION_WARNING_STATUSES: ProjectEditSaveConfirmationSnapshotStatusList = [
  'awaiting_confirmation',
  'name_missing',
];

function hasProjectMutationDialogSnapshotValue(
  value: ProjectMutationDialogSnapshotValue | null | undefined,
): value is ProjectMutationDialogSnapshotValue {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getProjectMutationDialogSnapshotValue(
  value: ProjectMutationDialogSnapshotValue | null | undefined,
  fallback: ProjectMutationDialogSnapshotValue,
): ProjectMutationDialogSnapshotValue {
  const hasValue = hasProjectMutationDialogSnapshotValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getProjectMutationDialogSnapshotNullableValue(
  value: ProjectMutationDialogSnapshotValue | null | undefined,
): ProjectMutationDialogSnapshotValue | null {
  const hasValue = hasProjectMutationDialogSnapshotValue(value);
  if (hasValue === false) {
    return null;
  }

  return value;
}

function getProjectMutationDialogSnapshotTrimmedValue(
  value: ProjectMutationDialogSnapshotValue | null | undefined,
): ProjectMutationDialogSnapshotValue {
  return getProjectMutationDialogSnapshotValue(value, '').trim();
}

function isProjectMutationDialogSnapshotStatusIn(
  status: ProjectMutationDialogSnapshotStatus,
  statuses: ProjectMutationDialogSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    if (candidate === status) {
      return true;
    }
  }

  return false;
}

function isProjectEditSaveConfirmationSnapshotStatusIn(
  status: ProjectEditSaveConfirmationSnapshotStatus,
  statuses: ProjectEditSaveConfirmationSnapshotStatusList,
): boolean {
  for (const candidate of statuses) {
    if (candidate === status) {
      return true;
    }
  }

  return false;
}

function shouldCloseProjectEditSaveConfirmationSnapshot(isOpen: boolean, hasProject: boolean): boolean {
  if (isOpen === false) {
    return true;
  }

  if (hasProject === false) {
    return true;
  }

  return false;
}

function getProjectEditSaveConfirmationSnapshotStatus({
  shouldClose,
  nameLength,
  isSaving,
  hasError,
}: {
  shouldClose: boolean;
  nameLength: number;
  isSaving: boolean;
  hasError: boolean;
}): ProjectEditSaveConfirmationSnapshotStatus {
  if (shouldClose === true) {
    return 'closed';
  }

  if (nameLength === 0) {
    return 'name_missing';
  }

  if (isSaving === true) {
    return 'confirming';
  }

  if (hasError === true) {
    return 'save_failed';
  }

  return 'awaiting_confirmation';
}

export function buildProjectMutationDialogSnapshot({
  mode,
  project,
  editForm,
  isSaving,
  isDeleting,
  editProjectError,
  deleteProjectError,
}: {
  mode: ProjectMutationDialogMode;
  project: Project | null;
  editForm: ProjectEditFormSnapshotInput;
  isSaving: boolean;
  isDeleting: boolean;
  editProjectError: string | null;
  deleteProjectError: string | null;
}): ProjectMutationDialogSnapshot {
  const hasProject = project !== null;
  const hasEditError = hasProjectMutationDialogSnapshotValue(editProjectError);
  const hasDeleteError = hasProjectMutationDialogSnapshotValue(deleteProjectError);
  const projectName = hasProject === true ? project.name : null;
  const projectDescription = hasProject === true ? project.description : null;
  const projectAppType = hasProject === true ? project.app_type : null;
  const effectiveName = mode === 'edit'
    ? editForm.name
    : getProjectMutationDialogSnapshotValue(projectName, '');
  const effectiveDescription = mode === 'edit'
    ? editForm.description
    : getProjectMutationDialogSnapshotValue(projectDescription, '');
  const effectiveAppType = mode === 'edit'
    ? editForm.app_type
    : getProjectMutationDialogSnapshotValue(projectAppType, 'web');
  const appType = getProjectMutationDialogSnapshotValue(effectiveAppType, 'web');
  const nameLength = effectiveName.trim().length;
  const status: ProjectMutationDialogSnapshotStatus = mode === 'edit'
    ? isSaving === true
      ? 'edit_saving'
      : hasEditError === true
        ? 'edit_failed'
        : nameLength === 0
          ? 'edit_name_missing'
          : 'edit_ready'
    : mode === 'delete'
      ? isDeleting === true
        ? 'delete_deleting'
        : hasDeleteError === true
          ? 'delete_failed'
          : 'delete_confirming'
      : 'closed';
  const source: ProjectMutationDialogSnapshotSource = status === 'edit_failed'
    ? 'project_edit'
    : status === 'delete_failed'
      ? 'project_delete'
      : status === 'edit_name_missing'
        ? 'edit_form'
        : 'dialog_state';
  const canSubmit = mode === 'edit'
    ? hasProject === true && isSaving === false && nameLength > 0
    : mode === 'delete'
      ? hasProject === true && isDeleting === false
      : false;
  const canCancel = mode !== 'none' && isSaving === false && isDeleting === false;

  return {
    status,
    source,
    mode,
    projectId: hasProject === true
      ? getProjectMutationDialogSnapshotNullableValue(project.project_id)
      : null,
    projectName: getProjectMutationDialogSnapshotNullableValue(projectName),
    hasProject,
    nameLength,
    descriptionLength: effectiveDescription.trim().length,
    appType,
    isSaving,
    isDeleting,
    hasEditError,
    hasDeleteError,
    canSubmit,
    canCancel,
    message: status === 'closed'
      ? '项目变更弹窗未打开。'
      : status === 'edit_saving'
        ? '项目编辑正在保存，表单操作暂时收敛。'
        : status === 'edit_failed'
          ? '项目编辑保存失败，列表仍保留修改前状态。'
          : status === 'edit_name_missing'
            ? '项目名称为空，暂不能提交编辑。'
            : status === 'edit_ready'
              ? '项目编辑表单已就绪，可以保存修改。'
              : status === 'delete_deleting'
                ? '项目删除请求正在提交，删除确认操作暂时锁定。'
                : status === 'delete_failed'
                  ? '项目删除失败，项目仍保留在列表中。'
                  : '项目删除确认已打开，等待用户确认。',
    recovery: status === 'edit_failed'
      ? '修正表单或稍后重试保存；必要时刷新列表确认后端项目状态。'
      : status === 'delete_failed'
        ? '稍后重试删除或刷新项目列表，确认后端删除受理状态。'
        : status === 'edit_name_missing'
          ? '填写项目名称后再保存修改。'
          : isProjectMutationDialogSnapshotStatusIn(status, PROJECT_MUTATION_DIALOG_BUSY_STATUSES) === true
            ? '等待当前请求返回，避免重复提交。'
            : status === 'delete_confirming'
              ? '确认风险后提交删除，或取消返回项目列表。'
              : status === 'edit_ready'
                ? '确认名称、描述和应用类型后保存。'
                : '打开编辑或删除弹窗后会派生项目变更快照。',
    updatedAt: 'derived',
  };
}

function getProjectMutationDialogSnapshotClassName(snapshot: ProjectMutationDialogSnapshot) {
  const hasFailedStatus = isProjectMutationDialogSnapshotStatusIn(
    snapshot.status,
    PROJECT_MUTATION_DIALOG_FAILED_STATUSES,
  );
  if (hasFailedStatus === true) {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }

  const hasWarningStatus = isProjectMutationDialogSnapshotStatusIn(
    snapshot.status,
    PROJECT_MUTATION_DIALOG_WARNING_STATUSES,
  );
  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }

  const hasBusyStatus = isProjectMutationDialogSnapshotStatusIn(
    snapshot.status,
    PROJECT_MUTATION_DIALOG_BUSY_STATUSES,
  );
  if (hasBusyStatus === true) {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }

  return 'border-border bg-background/70 text-muted-foreground';
}

function getProjectMutationDialogSnapshotLabel(value: string | null | undefined, fallback: string): string {
  const hasValue = hasProjectMutationDialogSnapshotValue(value);

  return hasValue === true ? value : fallback;
}

function getProjectMutationDialogSnapshotBooleanLabel(value: boolean): string {
  return value === true ? 'yes' : 'no';
}

export function ProjectMutationDialogSnapshotStrip({ snapshot }: { snapshot: ProjectMutationDialogSnapshot }) {
  const projectIdLabel = getProjectMutationDialogSnapshotLabel(snapshot.projectId, 'none');
  const isSavingLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.isSaving);
  const isDeletingLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.isDeleting);
  const hasEditErrorLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.hasEditError);
  const hasDeleteErrorLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.hasDeleteError);
  const canSubmitLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.canSubmit);
  const canCancelLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="project-mutation-dialog-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getProjectMutationDialogSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">项目变更弹窗快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Mode: {snapshot.mode}</span>
        <span>Project: {projectIdLabel}</span>
        <span>NameChars: {snapshot.nameLength}</span>
        <span>DescriptionChars: {snapshot.descriptionLength}</span>
        <span>AppType: {snapshot.appType}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Deleting: {isDeletingLabel}</span>
        <span>EditError: {hasEditErrorLabel}</span>
        <span>DeleteError: {hasDeleteErrorLabel}</span>
        <span>Submit: {canSubmitLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}

export function buildProjectEditSaveConfirmationSnapshot({
  project,
  editForm,
  isOpen,
  isSaving,
  editProjectError,
}: {
  project: Project | null;
  editForm: ProjectEditFormSnapshotInput;
  isOpen: boolean;
  isSaving: boolean;
  editProjectError: string | null;
}): ProjectEditSaveConfirmationSnapshot {
  const hasProjectRecord = project !== null;
  const projectId = hasProjectRecord === true
    ? getProjectMutationDialogSnapshotNullableValue(project.project_id)
    : null;
  const originalProjectName = hasProjectRecord === true
    ? getProjectMutationDialogSnapshotNullableValue(project.name)
    : null;
  const originalProjectNameValue = getProjectMutationDialogSnapshotValue(originalProjectName, '');
  const nextProjectName = editForm.name.trim();
  const originalDescription = hasProjectRecord === true
    ? getProjectMutationDialogSnapshotTrimmedValue(project.description)
    : '';
  const nextDescription = editForm.description.trim();
  const originalAppType = hasProjectRecord === true
    ? getProjectMutationDialogSnapshotValue(project.app_type, 'web')
    : 'web';
  const nextAppType = getProjectMutationDialogSnapshotValue(editForm.app_type, 'web');
  const nameLength = nextProjectName.length;
  const hasProject = hasProjectMutationDialogSnapshotValue(projectId);
  const hasEditError = hasProjectMutationDialogSnapshotValue(editProjectError);
  const hasError = hasEditError === true && isOpen === true && hasProject === true;
  const canConfirm = isOpen === true && hasProject === true && nameLength > 0 && isSaving === false;
  const canCancel = isOpen === true && hasProject === true && isSaving === false;
  const shouldClose = shouldCloseProjectEditSaveConfirmationSnapshot(isOpen, hasProject);
  const status = getProjectEditSaveConfirmationSnapshotStatus({
    shouldClose,
    nameLength,
    isSaving,
    hasError,
  });
  const hasNameChange = nextProjectName !== originalProjectNameValue.trim();
  const hasDescriptionChange = nextDescription !== originalDescription;
  const hasAppTypeChange = nextAppType !== originalAppType;

  const source: ProjectEditSaveConfirmationSnapshotSource = status === 'closed'
    ? 'dialog_state'
    : status === 'name_missing'
      ? 'edit_form'
      : 'project_edit';

  return {
    status,
    source,
    projectId,
    originalProjectName,
    nextProjectName: getProjectMutationDialogSnapshotValue(nextProjectName, 'none'),
    originalAppType,
    nextAppType,
    nameLength,
    descriptionLength: nextDescription.length,
    hasNameChange,
    hasDescriptionChange,
    hasAppTypeChange,
    isSaving,
    hasError,
    canConfirm,
    canCancel,
    riskLevel: hasProject === true ? 'medium' : 'none',
    message: status === 'closed'
      ? '项目编辑保存确认弹窗未打开。'
      : status === 'name_missing'
        ? '项目名称为空，暂不能确认保存。'
        : status === 'confirming'
          ? '正在保存项目元数据，确认与取消入口暂时锁定。'
          : status === 'save_failed'
            ? '项目编辑保存失败，列表仍保留修改前状态。'
            : '正在确认保存项目名称、描述和应用类型变更。',
    recovery: status === 'closed'
      ? '打开保存确认弹窗后会展示原项目、目标名称、应用类型和字段变更。'
      : status === 'name_missing'
        ? '填写项目名称后再提交保存确认。'
        : status === 'confirming'
          ? '等待项目更新请求返回，避免重复提交。'
          : status === 'save_failed'
            ? '保留当前编辑表单，检查项目名称、应用类型和后端错误后重试，或取消并刷新列表确认。'
            : hasAppTypeChange
              ? '确认应用类型变更不会影响后续模板、运行时和 Workspace 预期后再保存。'
              : '确认项目元数据变更无误后保存。',
    updatedAt: 'derived',
  };
}

function getProjectEditSaveConfirmationSnapshotClassName(snapshot: ProjectEditSaveConfirmationSnapshot) {
  if (snapshot.status === 'save_failed') {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }
  if (snapshot.status === 'confirming') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }

  const hasWarningStatus = isProjectEditSaveConfirmationSnapshotStatusIn(
    snapshot.status,
    PROJECT_EDIT_SAVE_CONFIRMATION_WARNING_STATUSES,
  );
  if (hasWarningStatus === true) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }

  return 'border-border bg-background/70 text-muted-foreground';
}

export function ProjectEditSaveConfirmationSnapshotStrip({
  snapshot,
}: {
  snapshot: ProjectEditSaveConfirmationSnapshot;
}) {
  const projectIdLabel = getProjectMutationDialogSnapshotLabel(snapshot.projectId, 'none');
  const originalProjectNameLabel = getProjectMutationDialogSnapshotLabel(snapshot.originalProjectName, 'none');
  const hasNameChangeLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.hasNameChange);
  const hasDescriptionChangeLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.hasDescriptionChange);
  const hasAppTypeChangeLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.hasAppTypeChange);
  const isSavingLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.isSaving);
  const hasErrorLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.hasError);
  const canConfirmLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.canConfirm);
  const canCancelLabel = getProjectMutationDialogSnapshotBooleanLabel(snapshot.canCancel);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="project-edit-save-confirmation-snapshot"
      className={cn('rounded-md border px-3 py-2 text-xs', getProjectEditSaveConfirmationSnapshotClassName(snapshot))}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium">项目编辑保存确认快照</span>
        <span>Phase: {snapshot.status}</span>
        <span>Source: {snapshot.source}</span>
        <span>Project: {projectIdLabel}</span>
        <span>OriginalName: {originalProjectNameLabel}</span>
        <span>NextName: {snapshot.nextProjectName}</span>
        <span>OriginalApp: {snapshot.originalAppType}</span>
        <span>NextApp: {snapshot.nextAppType}</span>
        <span>NameChars: {snapshot.nameLength}</span>
        <span>DescriptionChars: {snapshot.descriptionLength}</span>
        <span>NameChanged: {hasNameChangeLabel}</span>
        <span>DescriptionChanged: {hasDescriptionChangeLabel}</span>
        <span>AppChanged: {hasAppTypeChangeLabel}</span>
        <span>Saving: {isSavingLabel}</span>
        <span>Error: {hasErrorLabel}</span>
        <span>Confirm: {canConfirmLabel}</span>
        <span>Cancel: {canCancelLabel}</span>
        <span>Risk: {snapshot.riskLevel}</span>
      </div>
      <p className="mt-1">{snapshot.message}</p>
      <p className="mt-1 opacity-80">恢复建议：{snapshot.recovery}</p>
      <p className="mt-1 opacity-60">Updated: {snapshot.updatedAt}</p>
    </div>
  );
}
