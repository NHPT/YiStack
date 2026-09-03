import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { projectApi, type Plan } from '@/lib/api';
import { getPlanFeatureSummary } from '@/lib/plan-features';
import { formatTechStack, getTechStackProfile, serializePlanTechStack } from '@/lib/tech-stack';
import {
  buildPlanImplementationProjectInfoError,
  buildProjectCreateResponseError,
} from '@/lib/workspace/workspace-business-boundary-errors';
import {
  buildWorkspaceOrchestrationLocalStateFailure,
  formatWorkspaceOrchestrationLocalStateFailure,
  type WorkspaceOrchestrationLocalStateFailure,
} from '@/lib/workspace/workspace-orchestration-local-errors';

import type { WorkspaceChatMessage, WorkspaceProjectInfo } from './workspace-types';

export type PersistWorkspaceProjectResult =
  | { ok: true }
  | WorkspaceOrchestrationLocalStateFailure<'local_storage'>;

export type ClearWorkspaceSessionSnapshotResult =
  | { ok: true }
  | WorkspaceOrchestrationLocalStateFailure<'session_storage'>;

export type ReplaceWorkspaceProjectUrlResult =
  | { ok: true }
  | WorkspaceOrchestrationLocalStateFailure<'browser_history'>;

type WorkspaceOrchestrationLocalStateResult =
  | PersistWorkspaceProjectResult
  | ClearWorkspaceSessionSnapshotResult
  | ReplaceWorkspaceProjectUrlResult;

export type WorkspaceOrchestrationPromptSection = string;
export type WorkspaceOrchestrationPromptSectionList = WorkspaceOrchestrationPromptSection[];
export type WorkspaceOrchestrationPlanList = Plan[];
export type WorkspaceOrchestrationPlanSummary = string;
export type WorkspaceOrchestrationPlanSummarySectionList = string[];

function hasWorkspaceOrchestrationMessageId(
  messages: WorkspaceChatMessage[],
  messageId: string,
): boolean {
  for (const message of messages) {
    const hasMessageId = message.id === messageId;
    if (hasMessageId === true) {
      return true;
    }
  }

  return false;
}

function hasWorkspaceOrchestrationLocalStateSucceeded(
  result: WorkspaceOrchestrationLocalStateResult,
): result is { ok: true } {
  return result.ok === true;
}

function hasWorkspaceOrchestrationProjectInfo(
  projectInfo: WorkspaceProjectInfo | null,
): projectInfo is WorkspaceProjectInfo {
  return projectInfo !== null;
}

function hasWorkspaceOrchestrationPromptValue(value: string | undefined | null): value is string {
  if (value === undefined || value === null) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function getWorkspaceOrchestrationPromptFallbackValue(
  value: string | undefined | null,
  fallback: string,
): string {
  const hasValue = hasWorkspaceOrchestrationPromptValue(value);
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

function getWorkspaceProjectDescriptionValue(projectInfo: WorkspaceProjectInfo | null): string {
  if (projectInfo === null) {
    return '';
  }

  return getWorkspaceOrchestrationPromptFallbackValue(projectInfo.description, '');
}

function getWorkspaceProjectNameValue(projectInfo: WorkspaceProjectInfo | null): string {
  if (projectInfo === null) {
    return '未命名项目';
  }

  return getWorkspaceOrchestrationPromptFallbackValue(projectInfo.projectName, '未命名项目');
}

function getWorkspaceProjectAppTypeValue(projectInfo: WorkspaceProjectInfo | null): string {
  if (projectInfo === null) {
    return 'web';
  }

  return getWorkspaceOrchestrationPromptFallbackValue(projectInfo.appType, 'web');
}

function getWorkspaceTechStackProfileValue(plan: Plan): string {
  return getWorkspaceOrchestrationPromptFallbackValue(getTechStackProfile(plan.tech_stack), '待确定');
}

function getPersistedWorkspaceProjectNameValue(
  createdProjectName: string | undefined,
  projectInfo: WorkspaceProjectInfo,
): string {
  return getWorkspaceOrchestrationPromptFallbackValue(createdProjectName, projectInfo.projectName);
}

function getPersistedWorkspaceProjectGitBranchValue(
  createdProjectGitBranch: string | undefined,
  projectInfo: WorkspaceProjectInfo,
): string | undefined {
  const hasCreatedProjectGitBranch = hasWorkspaceOrchestrationPromptValue(createdProjectGitBranch);
  if (hasCreatedProjectGitBranch === true) {
    return createdProjectGitBranch;
  }

  return projectInfo.gitBranch;
}

function hasPersistedWorkspaceProjectId(projectId: string | undefined): projectId is string {
  return hasWorkspaceOrchestrationPromptValue(projectId);
}

function getWorkspaceOrchestrationPlanList(plans: Plan[]): WorkspaceOrchestrationPlanList {
  const hasPlans = plans.length > 0;
  if (hasPlans === false) {
    return [];
  }

  return plans;
}

function getWorkspaceOrchestrationPlanById(
  plans: WorkspaceOrchestrationPlanList,
  planId: string | null,
): Plan | undefined {
  if (planId === null) {
    return undefined;
  }

  for (const plan of plans) {
    const hasPlanId = plan.id === planId;
    if (hasPlanId === true) {
      return plan;
    }
  }

  return undefined;
}

function getFirstWorkspaceOrchestrationPlan(plans: WorkspaceOrchestrationPlanList): Plan | undefined {
  for (const plan of plans) {
    return plan;
  }

  return undefined;
}

function getWorkspaceOrchestrationRecommendedPlan(
  plans: WorkspaceOrchestrationPlanList,
  recommendedPlanId: string | null,
): Plan | undefined {
  const matchedPlan = getWorkspaceOrchestrationPlanById(plans, recommendedPlanId);
  const hasMatchedPlan = matchedPlan !== undefined;
  if (hasMatchedPlan === true) {
    return matchedPlan;
  }

  const firstPlan = getFirstWorkspaceOrchestrationPlan(plans);
  const hasFirstPlan = firstPlan !== undefined;
  if (hasFirstPlan === true) {
    return firstPlan;
  }

  return undefined;
}

function getWorkspaceOrchestrationRecommendedPlanSection(
  plan: Plan | undefined,
): WorkspaceOrchestrationPromptSection | undefined {
  const hasPlan = plan !== undefined;
  if (hasPlan === false) {
    return undefined;
  }

  return `当前推荐方案：${plan.name}`;
}

function hasWorkspaceOrchestrationPromptSection(
  section: WorkspaceOrchestrationPromptSection | undefined,
): section is WorkspaceOrchestrationPromptSection {
  return hasWorkspaceOrchestrationPromptValue(section) === true;
}

function getWorkspaceOrchestrationPromptSections(
  sections: Array<WorkspaceOrchestrationPromptSection | undefined>,
): WorkspaceOrchestrationPromptSectionList {
  const promptSections: WorkspaceOrchestrationPromptSectionList = [];

  for (const section of sections) {
    const hasSection = hasWorkspaceOrchestrationPromptSection(section);
    if (hasSection === true) {
      promptSections.push(section);
    }
  }

  return promptSections;
}

function getWorkspaceOrchestrationPlanSummary(plans: WorkspaceOrchestrationPlanList): WorkspaceOrchestrationPlanSummary {
  const sections: WorkspaceOrchestrationPlanSummarySectionList = [];
  let index = 0;

  for (const plan of plans) {
    index += 1;

    sections.push([
      `${index}. ${plan.name}`,
      `运行配置：${getWorkspaceTechStackProfileValue(plan)}`,
      `技术栈：${formatTechStack(plan.tech_stack)}`,
      `方案说明：${plan.description}`,
      `推荐理由：${plan.reasoning}`,
    ].join('\n'));
  }

  return sections.join('\n\n');
}

export function getWorkspaceSessionKey(projectId: string) {
  return `yistack_workspace_session:${projectId}`;
}

export function persistWorkspaceProject(nextProject: WorkspaceProjectInfo): PersistWorkspaceProjectResult {
  try {
    localStorage.setItem('yistack_current_project', JSON.stringify(nextProject));
    return { ok: true };
  } catch (error) {
    return buildWorkspaceOrchestrationLocalStateFailure(
      error,
      'local_storage',
      '浏览器拒绝写入本地项目快照',
    );
  }
}

export function appendWorkspaceProjectSnapshotPersistenceFailureMessage(
  applyOrchestrationSharedMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>,
  projectId: string,
  result: PersistWorkspaceProjectResult,
) {
  const hasSucceeded = hasWorkspaceOrchestrationLocalStateSucceeded(result);
  if (hasSucceeded === true) return;

  const reason = formatWorkspaceOrchestrationLocalStateFailure(result, '浏览器拒绝写入本地项目快照');

  applyOrchestrationSharedMessages((prev) => {
    const messageId = `workspace-project-snapshot-save-failed-${projectId}`;
    const hasExistingMessage = hasWorkspaceOrchestrationMessageId(prev, messageId);
    if (hasExistingMessage === true) return prev;
    return [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        content: `本地项目快照保存失败：${reason}。当前项目已在本页继续使用，后端项目也可能已创建或更新；但刷新或重新进入 Workspace 时，可能无法从本地 yistack_current_project 自动恢复项目元信息、方案、Preview URL 或运行时状态。请优先使用当前地址栏 projectId 链接重新打开。`,
        timestamp: new Date().toISOString(),
      },
    ];
  });
}

export function replaceWorkspaceProjectUrl(projectId: string): ReplaceWorkspaceProjectUrlResult {
  try {
    window.history.replaceState(
      window.history.state,
      '',
      `/workspace?projectId=${encodeURIComponent(projectId)}`,
    );
    return { ok: true };
  } catch (error) {
    return buildWorkspaceOrchestrationLocalStateFailure(
      error,
      'browser_history',
      '浏览器拒绝更新地址栏',
    );
  }
}

export function appendWorkspaceProjectUrlReplaceFailureMessage(
  applyOrchestrationSharedMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>,
  projectId: string,
  result: ReplaceWorkspaceProjectUrlResult,
) {
  const hasSucceeded = hasWorkspaceOrchestrationLocalStateSucceeded(result);
  if (hasSucceeded === true) return;

  const reason = formatWorkspaceOrchestrationLocalStateFailure(result, '浏览器拒绝更新地址栏');

  applyOrchestrationSharedMessages((prev) => {
    const messageId = `workspace-project-url-replace-failed-${projectId}`;
    const hasExistingMessage = hasWorkspaceOrchestrationMessageId(prev, messageId);
    if (hasExistingMessage === true) return prev;
    return [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        content: `Workspace 项目地址栏切换失败：${reason}。后端持久项目已创建并在当前页面继续进入实现，但地址栏可能仍指向旧草稿或旧 projectId；如果刷新或复制当前链接，可能无法恢复到新项目 ${projectId}。请优先从项目列表重新打开该项目，或手动使用 /workspace?projectId=${projectId}。`,
        timestamp: new Date().toISOString(),
      },
    ];
  });
}

export function clearWorkspaceSessionSnapshot(projectId: string): ClearWorkspaceSessionSnapshotResult {
  try {
    sessionStorage.removeItem(getWorkspaceSessionKey(projectId));
    return { ok: true };
  } catch (error) {
    return buildWorkspaceOrchestrationLocalStateFailure(
      error,
      'session_storage',
      '浏览器拒绝清理旧 Workspace 会话快照',
    );
  }
}

export function appendWorkspaceSessionSnapshotClearFailureMessage(
  applyOrchestrationSharedMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>,
  projectId: string,
  result: ClearWorkspaceSessionSnapshotResult,
) {
  const hasSucceeded = hasWorkspaceOrchestrationLocalStateSucceeded(result);
  if (hasSucceeded === true) return;

  const reason = formatWorkspaceOrchestrationLocalStateFailure(result, '浏览器拒绝清理旧 Workspace 会话快照');

  applyOrchestrationSharedMessages((prev) => {
    const messageId = `workspace-session-snapshot-clear-failed-${projectId}`;
    const hasExistingMessage = hasWorkspaceOrchestrationMessageId(prev, messageId);
    if (hasExistingMessage === true) return prev;
    return [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        content: `旧 Workspace 会话快照清理失败：${reason}。当前持久项目已继续创建并进入实现流程，但旧的本地草稿会话快照可能仍留在浏览器会话存储中；如果稍后从旧入口返回 Workspace，请以当前地址栏 projectId 对应的项目状态为准。`,
        timestamp: new Date().toISOString(),
      },
    ];
  });
}

export async function createPersistedWorkspaceProject(
  plan: Plan,
  context: {
    initializedProjectIdRef: MutableRefObject<string | null>;
    projectInfo: WorkspaceProjectInfo | null;
    setProjectInfo: Dispatch<SetStateAction<WorkspaceProjectInfo | null>>;
    persistWorkspaceProject: (nextProject: WorkspaceProjectInfo) => void;
    applyOrchestrationSharedMessages: Dispatch<SetStateAction<WorkspaceChatMessage[]>>;
  },
): Promise<WorkspaceProjectInfo> {
  const projectInfo = context.projectInfo;
  const hasProjectInfo = hasWorkspaceOrchestrationProjectInfo(projectInfo);
  if (hasProjectInfo === false) {
    throw buildPlanImplementationProjectInfoError(plan);
  }

  const serializedPlan = JSON.stringify(plan);
  const serializedTechStack = serializePlanTechStack(plan);
  const createdProject = await projectApi.create({
    name: projectInfo.projectName,
    description: projectInfo.description,
    app_type: projectInfo.appType,
    tech_stack: serializedTechStack,
    plan_id: plan.id,
    plan_data: serializedPlan,
  });

  const persistedProjectId = createdProject.project_id;
  const hasPersistedProjectId = hasPersistedWorkspaceProjectId(persistedProjectId);

  if (hasPersistedProjectId === false) {
    throw buildProjectCreateResponseError(createdProject, {
      plan,
      appType: projectInfo.appType,
    });
  }

  const nextProject: WorkspaceProjectInfo = {
    projectId: persistedProjectId,
    projectName: getPersistedWorkspaceProjectNameValue(createdProject.name, projectInfo),
    description: projectInfo.description,
    appType: projectInfo.appType,
    initialMessage: `基于 ${plan.name} 方案开始实现`,
    techStack: serializedTechStack,
    planId: plan.id,
    planData: serializedPlan,
    gitBranch: getPersistedWorkspaceProjectGitBranchValue(createdProject.git_branch, projectInfo),
    accessRole: createdProject.access_role ?? 'owner',
    canWrite: createdProject.can_write ?? true,
    isPersisted: true,
  };

  context.setProjectInfo(nextProject);
  context.persistWorkspaceProject(nextProject);
  context.initializedProjectIdRef.current = persistedProjectId;
  if (typeof window !== 'undefined') {
    appendWorkspaceProjectUrlReplaceFailureMessage(
      context.applyOrchestrationSharedMessages,
      persistedProjectId,
      replaceWorkspaceProjectUrl(persistedProjectId),
    );
    appendWorkspaceSessionSnapshotClearFailureMessage(
      context.applyOrchestrationSharedMessages,
      projectInfo.projectId,
      clearWorkspaceSessionSnapshot(projectInfo.projectId),
    );
  }
  return nextProject;
}

export function buildImplementationPrompt(
  plan: Plan,
  projectInfo: WorkspaceProjectInfo | null,
) {
  return [
    '请基于以下用户需求和已选技术方案开始实现项目。',
    `用户需求：${getWorkspaceProjectDescriptionValue(projectInfo)}`,
    `项目名称：${getWorkspaceProjectNameValue(projectInfo)}`,
    `应用类型：${getWorkspaceProjectAppTypeValue(projectInfo)}`,
    `方案名称：${plan.name}`,
    `运行配置：${getWorkspaceTechStackProfileValue(plan)}`,
    `技术栈：${formatTechStack(plan.tech_stack)}`,
    `核心功能：${getPlanFeatureSummary(plan)}`,
    `架构说明：${plan.architecture}`,
    `方案说明：${plan.description}`,
    `推荐理由：${plan.reasoning}`,
    '请先输出可运行的核心代码与关键文件内容，并确保实现上述功能。',
  ].join('\n');
}

export function buildImplementationPlanContext(
  plan: Plan,
  projectInfo: WorkspaceProjectInfo | null,
) {
  return [
    '已批准方案上下文',
    `方案 ID：${plan.id}`,
    `方案名称：${plan.name}`,
    `项目名称：${getWorkspaceProjectNameValue(projectInfo)}`,
    `原始需求：${getWorkspaceProjectDescriptionValue(projectInfo)}`,
    `应用类型：${getWorkspaceProjectAppTypeValue(projectInfo)}`,
    `运行配置：${getWorkspaceTechStackProfileValue(plan)}`,
    `技术栈：${formatTechStack(plan.tech_stack)}`,
    `核心功能：${getPlanFeatureSummary(plan)}`,
    `架构说明：${plan.architecture}`,
    `方案说明：${plan.description}`,
    `推荐理由：${plan.reasoning}`,
    `复杂度：${plan.complexity}`,
    `预计文件数：${plan.est_files}`,
  ].join('\n');
}

export function buildPlanDiscussionPrompt(
  question: string,
  context: {
    availablePlans: Plan[];
    recommendedPlanId: string | null;
    projectInfo: WorkspaceProjectInfo | null;
  },
) {
  const availablePlans = getWorkspaceOrchestrationPlanList(context.availablePlans);
  const planSummary = getWorkspaceOrchestrationPlanSummary(availablePlans);
  const recommendedPlan = getWorkspaceOrchestrationRecommendedPlan(availablePlans, context.recommendedPlanId);
  const recommendedPlanSection = getWorkspaceOrchestrationRecommendedPlanSection(recommendedPlan);

  const sections = getWorkspaceOrchestrationPromptSections([
    '当前仍处于方案确认阶段，请只回答方案分析、取舍和澄清问题，不要开始实现，也不要输出代码文件。',
    `原始需求：${getWorkspaceProjectDescriptionValue(context.projectInfo)}`,
    `应用类型：${getWorkspaceProjectAppTypeValue(context.projectInfo)}`,
    recommendedPlanSection,
    '当前候选方案：',
    planSummary,
    `用户追问：${question}`,
    '请先直接回答用户问题，再补充一句：如果认可当前推荐方案，可以直接回复“按方案实现”开始开发；如果想调整约束，可以继续补充需求。',
  ]);

  return sections.join('\n\n');
}
