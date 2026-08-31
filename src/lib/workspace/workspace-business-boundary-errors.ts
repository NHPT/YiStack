export type PlanGenerationFinalizationGeneratedPlanList = unknown[];
export type PlanGenerationFinalizationSuggestedQuestionList = unknown[];
export type PlanGenerationFinalizationSuggestedActionList = unknown[];

export type PlanGenerationFinalizationErrorPayload = {
  generatedPlans: PlanGenerationFinalizationGeneratedPlanList;
  analysisContent: string;
  planSuggestedQuestions: PlanGenerationFinalizationSuggestedQuestionList;
  planSuggestedActions: PlanGenerationFinalizationSuggestedActionList;
};

export type PlanImplementationProjectInfoErrorPlan = {
  id: string;
  name: string;
};

export type ProjectCreateResponseErrorProject = {
  project_id: string;
  name: string;
};

export type ProjectCreateResponseErrorPlanContext = {
  id: string;
};

export type ProjectCreateResponseErrorContext = {
  plan: ProjectCreateResponseErrorPlanContext;
  appType: string;
};

export type HomeProjectCreateResponseErrorContext = {
  name: string;
  appType: string;
  description: string;
};

export function buildPlanGenerationFinalizationError(payload: PlanGenerationFinalizationErrorPayload) {
  return Object.assign(new Error('未生成可用方案'), {
    source: 'plan_generation_finalization',
    details: `generated_plans=${payload.generatedPlans.length}; analysis_content_length=${payload.analysisContent.length}; suggested_questions=${payload.planSuggestedQuestions.length}; suggested_actions=${payload.planSuggestedActions.length}`,
  });
}

export function buildPlanImplementationProjectInfoError(plan: PlanImplementationProjectInfoErrorPlan) {
  return Object.assign(new Error('项目信息不存在'), {
    source: 'plan_implementation_project_info',
    details: `plan_id=${plan.id}; plan_name=${plan.name}; reason=projectInfo is null before persisted project creation`,
  });
}

function getProjectCreateResponseErrorFieldValue(value: string): string {
  const hasValue = value.length > 0;
  if (hasValue === false) {
    return '';
  }

  return value;
}

export function buildProjectCreateResponseError(
  createdProject: ProjectCreateResponseErrorProject,
  context: ProjectCreateResponseErrorContext,
) {
  const projectId = getProjectCreateResponseErrorFieldValue(createdProject.project_id);
  const projectName = getProjectCreateResponseErrorFieldValue(createdProject.name);

  return Object.assign(new Error('创建项目成功，但未返回有效项目 ID'), {
    source: 'project_create_response',
    details: `project_id=${projectId}; name=${projectName}; plan_id=${context.plan.id}; app_type=${context.appType}`,
  });
}

export function buildHomeProjectCreateResponseError(
  createdProject: ProjectCreateResponseErrorProject,
  context: HomeProjectCreateResponseErrorContext,
) {
  const projectId = getProjectCreateResponseErrorFieldValue(createdProject.project_id);
  const projectName = getProjectCreateResponseErrorFieldValue(createdProject.name);

  return Object.assign(new Error('创建项目成功，但未返回有效项目 ID'), {
    source: 'home_project_create_response',
    details: `project_id=${projectId}; name=${projectName}; requested_name=${context.name}; app_type=${context.appType}; description_length=${context.description.length}`,
  });
}
