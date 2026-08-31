import type { Plan } from '@/lib/api';
import { getTechStackLabels, getTechStackProfile } from '@/lib/tech-stack';

import type {
  GuidanceAction,
  WorkspaceFallbackQuestionList,
  WorkspaceChatMessage,
  WorkspaceGuidanceResolution,
  WorkspaceSuggestedQuestion,
  WorkspaceSuggestedQuestionList,
} from './workspace-types';
import type { WorkspaceStreamEventData } from './workspace-orchestration-shared';

export type PlanSearchTerm = string;
export type PlanSearchTermList = PlanSearchTerm[];
export type WorkspaceRecommendedPlanList = Plan[];
export type PlanOrdinalDigit = string;
export type PlanOrdinalValue = number;
export type PlanOrdinalDigitMap = {
  [digit: PlanOrdinalDigit]: PlanOrdinalValue;
};
type PlanMessageWorkflowStepList = NonNullable<WorkspaceChatMessage['workflowSteps']>;
type PlanMessageEventSuggestedAction = {
  label: string;
  kind?: string;
  prompt: string;
};

const PLAN_ORDINAL_DIGIT_MAP: PlanOrdinalDigitMap = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function hasPlanMessageRegexMatch(match: RegExpMatchArray | null): match is RegExpMatchArray {
  return match !== null;
}

function getPlanMessageRegexCapture(match: RegExpMatchArray | null, index: number): string {
  const hasMatch = hasPlanMessageRegexMatch(match);
  if (hasMatch === false) {
    return '';
  }

  const value = match[index];
  const hasValue = value !== undefined;
  if (hasValue === true) {
    return value;
  }

  return '';
}

function getPlanMessageTextValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value;
}

function getPlanMessageTrimmedTextValue(value: string | null | undefined): string {
  return getPlanMessageTextValue(value).trim();
}

function isPlanMessageConstraintChange(constraintChange: boolean): boolean {
  return constraintChange === true;
}

function hasPlanMessageContent(content: string): boolean {
  const hasContent = content.length > 0;
  return hasContent === true;
}

export type PendingPlanConfirmIntent = 'confirm';
export type PendingPlanDiscussIntent = 'discuss';
export type PendingPlanReplanIntent = 'replan';
export type PendingPlanClarifyIntent = 'clarify';
export type PendingPlanIntent =
  | PendingPlanConfirmIntent
  | PendingPlanDiscussIntent
  | PendingPlanReplanIntent
  | PendingPlanClarifyIntent;

export type PendingPlanIntentResult =
  | { intent: PendingPlanConfirmIntent; plan: Plan }
  | { intent: PendingPlanDiscussIntent }
  | { intent: PendingPlanReplanIntent }
  | { intent: PendingPlanClarifyIntent; message: string };

function getWorkspaceFirstRecommendedPlan(plans: WorkspaceRecommendedPlanList): Plan | undefined {
  for (const plan of plans) {
    return plan;
  }

  return undefined;
}

export function getWorkspaceRecommendedPlan(
  plans: WorkspaceRecommendedPlanList,
  recommendedPlanId?: string | null,
): Plan | undefined {
  const matchedRecommendedPlan = getWorkspaceMatchedRecommendedPlan(plans, recommendedPlanId);
  const hasMatchedRecommendedPlan = matchedRecommendedPlan !== undefined;
  if (hasMatchedRecommendedPlan === true) {
    return matchedRecommendedPlan;
  }

  const fallbackRecommendedPlan = getWorkspaceFirstRecommendedPlan(plans);
  const hasFallbackRecommendedPlan = fallbackRecommendedPlan !== undefined;
  if (hasFallbackRecommendedPlan === true) {
    return fallbackRecommendedPlan;
  }

  return undefined;
}

function getWorkspaceMatchedRecommendedPlan(
  plans: WorkspaceRecommendedPlanList,
  recommendedPlanId?: string | null,
): Plan | undefined {
  for (const plan of plans) {
    const isRecommendedPlan = plan.id === recommendedPlanId;
    if (isRecommendedPlan === true) {
      return plan;
    }
  }

  return undefined;
}

export function getWorkspaceRecommendedPlanId(
  plans: WorkspaceRecommendedPlanList,
  recommendedPlanId?: string | null,
): string | null {
  const recommendedPlan = getWorkspaceRecommendedPlan(plans, recommendedPlanId);
  const hasRecommendedPlan = recommendedPlan !== undefined;
  if (hasRecommendedPlan === false) {
    return null;
  }

  return recommendedPlan.id;
}

function normalizeSuggestionLabel(raw: string): string {
  const text = raw.trim().replace(/[？?]+$/g, '');
  const hasText = text.length > 0;
  if (hasText === false) return '';

  if (/^[你您]更倾向于.+还是.+/.test(text)) {
    const match = text.match(/^[你您]更倾向于(.+)还是(.+)$/);
    const hasMatch = hasPlanMessageRegexMatch(match);
    if (hasMatch === true) {
      const firstOption = getPlanMessageRegexCapture(match, 1).replace(/等$/, '').trim();
      const secondOption = getPlanMessageRegexCapture(match, 2).replace(/等$/, '').trim();
      return `比较一下${firstOption}和${secondOption}的区别`;
    }
  }
  if (/^还有没有其他功能需求或约束需要考虑$/.test(text)) {
    return '我再补充一些功能需求和约束';
  }
  if (/^项目的预算和上线时间大概是多少$/.test(text)) {
    return '我再补充一下预算和上线时间';
  }
  if (/^按推荐方案实现$/.test(text)) {
    return '好的，就按你的建议实现';
  }
  return text;
}

function getPlanMessageEventSuggestedQuestions(data: WorkspaceStreamEventData): unknown[] {
  if (Array.isArray(data.suggestedQuestions) === false) {
    return [];
  }

  return data.suggestedQuestions;
}

function getPlanMessageEventSuggestedActions(data: WorkspaceStreamEventData): unknown[] {
  if (Array.isArray(data.suggestedActions) === false) {
    return [];
  }

  return data.suggestedActions;
}

function isPlanMessageEventSuggestedQuestion(item: unknown): item is WorkspaceSuggestedQuestion {
  if (typeof item !== 'string') {
    return false;
  }

  const trimmedItem = item.trim();
  const hasItem = trimmedItem.length > 0;
  return hasItem === true;
}

function isPlanMessageEventSuggestedAction(item: unknown): item is PlanMessageEventSuggestedAction {
  const hasActionObject = item !== null && item !== undefined && typeof item === 'object';
  if (hasActionObject === false) {
    return false;
  }

  const action = item as { label?: unknown; prompt?: unknown };
  const hasLabel = typeof action.label === 'string' && action.label.trim().length > 0;
  if (hasLabel === false) {
    return false;
  }

  const hasPrompt = typeof action.prompt === 'string' && action.prompt.trim().length > 0;
  return hasPrompt === true;
}

function getPlanMessageNormalizedSuggestedQuestions(items: unknown[]): WorkspaceSuggestedQuestionList {
  const normalizedQuestions: WorkspaceSuggestedQuestionList = [];
  const seenQuestions = new Set<string>();
  for (const item of items) {
    const isSuggestedQuestion = isPlanMessageEventSuggestedQuestion(item);
    if (isSuggestedQuestion === false) {
      continue;
    }

    const question = normalizeSuggestionLabel(item);
    const hasQuestion = question.length > 0;
    if (hasQuestion === false) {
      continue;
    }

    const hasSeenQuestion = seenQuestions.has(question);
    if (hasSeenQuestion === true) {
      continue;
    }

    seenQuestions.add(question);
    normalizedQuestions.push(question);
    const hasQuestionLimitReached = normalizedQuestions.length >= 3;
    if (hasQuestionLimitReached === true) {
      return normalizedQuestions;
    }
  }

  return normalizedQuestions;
}

function getPlanMessageNormalizedSuggestedAction(item: PlanMessageEventSuggestedAction): GuidanceAction | undefined {
  const label = normalizeSuggestionLabel(item.label);
  const hasLabel = label.length > 0;
  if (hasLabel === false) {
    return undefined;
  }

  return {
    label,
    kind: 'send_prompt',
    prompt: item.prompt.trim(),
  };
}

function getPlanMessageNormalizedSuggestedActions(items: unknown[]): GuidanceAction[] {
  const normalizedActions: GuidanceAction[] = [];
  for (const item of items) {
    const isSuggestedAction = isPlanMessageEventSuggestedAction(item);
    if (isSuggestedAction === false) {
      continue;
    }

    const action = getPlanMessageNormalizedSuggestedAction(item);
    const hasAction = action !== undefined;
    if (hasAction === false) {
      continue;
    }

    normalizedActions.push(action);
    const hasActionLimitReached = normalizedActions.length >= 2;
    if (hasActionLimitReached === true) {
      return normalizedActions;
    }
  }

  return normalizedActions;
}

export function getSuggestedQuestionsFromEvent(data: WorkspaceStreamEventData): WorkspaceSuggestedQuestionList {
  const suggestedQuestions = getPlanMessageEventSuggestedQuestions(data);
  const hasSuggestedQuestions = suggestedQuestions.length > 0;
  if (hasSuggestedQuestions === false) return [];
  return getPlanMessageNormalizedSuggestedQuestions(suggestedQuestions);
}

export function getSuggestedActionsFromEvent(data: WorkspaceStreamEventData): GuidanceAction[] {
  const suggestedActions = getPlanMessageEventSuggestedActions(data);
  const hasSuggestedActions = suggestedActions.length > 0;
  if (hasSuggestedActions === false) return [];
  return getPlanMessageNormalizedSuggestedActions(suggestedActions);
}

export function getGuidanceFromEvent(
  data: WorkspaceStreamEventData,
  fallbackQuestions: WorkspaceFallbackQuestionList,
  fallbackActions: GuidanceAction[],
): WorkspaceGuidanceResolution {
  const suggestedQuestions = getSuggestedQuestionsFromEvent(data);
  const suggestedActions = getSuggestedActionsFromEvent(data);
  const hasSuggestedQuestions = suggestedQuestions.length > 0;
  const hasSuggestedActions = suggestedActions.length > 0;
  return {
    suggestedQuestions: hasSuggestedQuestions === true ? suggestedQuestions : fallbackQuestions,
    suggestedActions: hasSuggestedActions === true ? suggestedActions : fallbackActions,
  };
}

function buildPlanSuggestedActions(plans: Plan[], recommendedPlanId?: string | null): GuidanceAction[] {
  const hasPlans = plans.length > 0;
  if (hasPlans === false) return [];

  const recommendedPlan = getWorkspaceRecommendedPlan(plans, recommendedPlanId);
  const hasRecommendedPlan = recommendedPlan !== undefined;
  const actions: GuidanceAction[] = [];
  if (hasRecommendedPlan === true) {
    actions.push({
      label: '好的，就按你的建议实现',
      kind: 'confirm_recommended_plan',
    });
  }
  actions.push(
    {
      label: '我再补充一些功能需求和约束',
      kind: 'send_prompt',
      prompt: '我想调整当前方案，请根据以下新约束重新规划：',
    },
    {
      label: '比较一下推荐方案和其他方案的区别',
      kind: 'send_prompt',
      prompt: getPlanSuggestedActionComparePrompt(recommendedPlan),
    },
  );
  return actions;
}

function getPlanSuggestedActionComparePrompt(recommendedPlan: Plan | undefined): string {
  const hasRecommendedPlan = recommendedPlan !== undefined;
  if (hasRecommendedPlan === true) {
    return `请进一步比较当前推荐方案「${recommendedPlan.name}」与其他候选方案的差异和取舍。`;
  }

  return '请进一步比较这些候选方案的差异和取舍。';
}

function getPlanMessageSuggestedQuestions(message: WorkspaceChatMessage): WorkspaceSuggestedQuestionList {
  if (Array.isArray(message.suggestedQuestions) === false) {
    return [];
  }

  return message.suggestedQuestions;
}

function getPlanMessageSuggestedActions(message: WorkspaceChatMessage): GuidanceAction[] {
  if (Array.isArray(message.suggestedActions) === false) {
    return [];
  }

  return message.suggestedActions;
}

function getPlanMessageWorkflowSteps(message: WorkspaceChatMessage): PlanMessageWorkflowStepList {
  if (Array.isArray(message.workflowSteps) === false) {
    return [];
  }

  return message.workflowSteps;
}

export function enrichPlanMessageGuidance(message: WorkspaceChatMessage): WorkspaceChatMessage {
  const isPlanOptionsMessage = message.kind === 'plan-options';
  const messagePlans = Array.isArray(message.plans) ? message.plans : [];
  const hasMessagePlans = messagePlans.length > 0;
  const isPlanSuperseded = message.planSuperseded === true;
  if (isPlanOptionsMessage === false || hasMessagePlans === false || isPlanSuperseded === true) {
    return message;
  }

  const planStreamComplete = message.planStreamComplete === true;
  const suggestedQuestions = getPlanMessageSuggestedQuestions(message);
  const hasSuggestedQuestions = suggestedQuestions.length > 0;
  const suggestedActions = getPlanMessageSuggestedActions(message);
  const hasSuggestedActions = suggestedActions.length > 0;
  const shouldSkipGuidanceEnrichment = planStreamComplete === false
    && hasSuggestedQuestions === false
    && hasSuggestedActions === false;
  if (shouldSkipGuidanceEnrichment === true) {
    return message;
  }

  return {
    ...message,
    suggestedQuestions,
    suggestedActions: hasSuggestedActions === true
      ? suggestedActions
      : buildPlanSuggestedActions(messagePlans, message.recommendedPlanId).slice(0, 1),
  };
}

function classifyPendingPlanIntent(rawInput: string): PendingPlanIntent {
  const normalized = rawInput.trim().toLowerCase();
  const hasNormalizedInput = normalized.length > 0;
  if (hasNormalizedInput === false) return 'replan';

  const explicitConfirmPattern = /(按.*(方案|推荐).*(实现|开发|做)|开始(实现|开发)|直接(实现|开发)|就按.*(做|实现|开发)|采用推荐方案|按推荐方案来|按这个方案来)/i;
  const discussPattern = /(\?|？|为什么|为何|怎么|如何|区别|对比|比较|优缺点|解释|说明|详细|展开|风险|成本|适合|不适合|兼容|扩展|能否|可以.*吗)/i;
  const shortConfirmPattern = /^(好|好的|好啊|行|可以|没问题|就这样|就这个|可以开始了|开始吧)$/i;

  if (explicitConfirmPattern.test(normalized)) return 'confirm';
  if (discussPattern.test(normalized)) return 'discuss';
  if (shortConfirmPattern.test(normalized)) return 'confirm';
  return 'replan';
}

function normalizePlanMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[「」《》"'`.,，。:：;；!！?？()[\]（）【】]/g, ' ')
    .replace(/[+／/\\_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPlanOrdinalCharacter(text: string, targetIndex: number): PlanOrdinalDigit | undefined {
  let index = 0;

  for (const character of text) {
    const isTargetCharacter = index === targetIndex;
    if (isTargetCharacter === true) {
      return character;
    }

    index += 1;
  }

  return undefined;
}

function getPlanOrdinalDigitValue(digit: PlanOrdinalDigit | undefined): PlanOrdinalValue | undefined {
  const hasDigit = digit !== undefined;
  if (hasDigit === false) {
    return undefined;
  }

  return PLAN_ORDINAL_DIGIT_MAP[digit];
}

function parsePlanOrdinal(value: string): number | null {
  const text = value.trim();
  const hasText = text.length > 0;
  if (hasText === false) return null;
  if (/^\d+$/.test(text)) return Number(text);

  const directOrdinalValue = getPlanOrdinalDigitValue(text);
  if (directOrdinalValue !== undefined) return directOrdinalValue;

  const firstCharacter = getPlanOrdinalCharacter(text, 0);
  const secondCharacter = getPlanOrdinalCharacter(text, 1);
  const thirdCharacter = getPlanOrdinalCharacter(text, 2);
  const firstDigitValue = getPlanOrdinalDigitValue(firstCharacter);
  const secondDigitValue = getPlanOrdinalDigitValue(secondCharacter);
  const thirdDigitValue = getPlanOrdinalDigitValue(thirdCharacter);

  if (text.startsWith('十') && text.length === 2 && secondDigitValue !== undefined) {
    return 10 + secondDigitValue;
  }
  if (text.length === 2 && secondCharacter === '十' && firstDigitValue !== undefined) {
    return firstDigitValue * 10;
  }
  if (text.length === 3 && secondCharacter === '十' && firstDigitValue !== undefined && thirdDigitValue !== undefined) {
    return firstDigitValue * 10 + thirdDigitValue;
  }
  return null;
}

function resolvePlanByOrdinal(plans: Plan[], ordinal: number): Plan | undefined {
  let currentOrdinal = 1;

  for (const plan of plans) {
    const isTargetPlan = currentOrdinal === ordinal;
    if (isTargetPlan === true) {
      return plan;
    }

    currentOrdinal += 1;
  }

  return undefined;
}

function findPlanByOrdinalInput(input: string, plans: Plan[]): Plan | null | undefined {
  const patterns = [
    /方案\s*([0-9一二两三四五六七八九十]+)/i,
    /第\s*([0-9一二两三四五六七八九十]+)\s*(?:个|套|种|项|个方案|套方案)?/i,
    /(?:选择|选|采用|按|就)\s*(?:第)?\s*([0-9一二两三四五六七八九十]+)\s*(?:个|套|种|项)?/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    const rawOrdinal = getPlanMessageRegexCapture(match, 1);
    const hasRawOrdinal = rawOrdinal.length > 0;
    if (hasRawOrdinal === false) continue;
    const ordinal = parsePlanOrdinal(rawOrdinal);
    const hasOrdinal = ordinal !== null;
    if (hasOrdinal === false) continue;
    if (ordinal < 1 || ordinal > plans.length) return undefined;
    return resolvePlanByOrdinal(plans, ordinal);
  }
  return null;
}


function getPlanSearchTerms(plan: Plan): PlanSearchTermList {
  const terms: PlanSearchTermList = [
    plan.name,
    getTechStackProfile(plan.tech_stack),
    ...getTechStackLabels(plan.tech_stack),
  ];

  const normalizedTerms: PlanSearchTermList = [];
  const seenTerms = new Set<string>();
  for (const term of terms) {
    const normalizedTerm = normalizePlanMatchText(getPlanMessageTextValue(term));
    const hasSearchTerm = normalizedTerm.length >= 2;
    if (hasSearchTerm === false) {
      continue;
    }

    const hasSeenTerm = seenTerms.has(normalizedTerm);
    if (hasSeenTerm === true) {
      continue;
    }

    seenTerms.add(normalizedTerm);
    normalizedTerms.push(normalizedTerm);
  }

  return normalizedTerms;
}

function hasPlanMatchedSearchTerm(input: string, terms: PlanSearchTermList): boolean {
  for (const term of terms) {
    const hasMatchedTerm = input.includes(term);
    if (hasMatchedTerm === true) {
      return true;
    }
  }

  return false;
}

function findPlansByNameOrTech(input: string, plans: Plan[]): Plan[] {
  const normalizedInput = normalizePlanMatchText(input);
  const hasNormalizedInput = normalizedInput.length > 0;
  if (hasNormalizedInput === false) return [];

  const matchedPlans: Plan[] = [];
  for (const plan of plans) {
    const terms = getPlanSearchTerms(plan);
    const hasMatchedTerm = hasPlanMatchedSearchTerm(normalizedInput, terms);
    if (hasMatchedTerm === true) {
      matchedPlans.push(plan);
    }
  }

  return matchedPlans;
}

function isPlanImplementationRequest(input: string) {
  return /(实现|开发|开始|采用|选择|选|按|就|确认|确定|执行|生成|做)/i.test(input);
}

function isPlanConstraintChange(input: string) {
  return /(我想|想要|希望|需要|要求|改成|换成|换|调整|修改|变成|不要|不用|别用|去掉|替换|不满意|太复杂|太重|简单点|使用|用|后端|前端|数据库|技术栈|框架|语言|python|django|fastapi|flask|go|golang|java|spring|node|express|react|vue|next\.?js|nuxt|postgres|postgresql|mysql|redis|cms|后台|管理端)/i.test(input);
}

function isContextPlanConfirm(input: string) {
  return /^(按)?(刚刚|上面|前面|你说的|推荐的|这个|该方案|当前方案|就这个|这个吧|就它|就这样|就按这个|按这个|按刚刚说的|按你说的)(方案)?(来|做|实现|开发)?(吧)?$/i.test(input.trim());
}

function isShortPlanConfirm(input: string) {
  return /^(好|好的|好啊|行|可以|没问题|ok|okay|yes|嗯|嗯嗯|开始吧|可以开始了)$/i.test(input.trim().toLowerCase());
}

function getSingleMatchedPlan(plans: Plan[]): Plan | null | undefined {
  if (plans.length === 0) {
    return null;
  }

  if (plans.length > 1) {
    return undefined;
  }

  for (const plan of plans) {
    return plan;
  }

  return null;
}

export function resolveReferencedPlan(input: string, plans: Plan[]): Plan | null | undefined {
  const ordinalPlan = findPlanByOrdinalInput(input, plans);
  if (ordinalPlan !== null) return ordinalPlan;

  const matchedPlans = findPlansByNameOrTech(input, plans);
  return getSingleMatchedPlan(matchedPlans);
}

function getPlanClarifyPlanList(plans: Plan[]): string {
  const planLines: string[] = [];
  let planIndex = 1;
  for (const plan of plans) {
    planLines.push(`${planIndex}. ${plan.name}`);
    planIndex += 1;
  }

  return planLines.join('\n');
}

function getPlanClarifyReasonMessage(reason?: string): string {
  const reasonMessage = getPlanMessageTrimmedTextValue(reason);
  const hasReasonMessage = reasonMessage.length > 0;
  if (hasReasonMessage === true) {
    return reasonMessage;
  }

  return '我还不能确定你想选择哪个方案。';
}

function getPlanClarifyPlanListSection(planList: string): string {
  const hasPlanList = planList.length > 0;
  if (hasPlanList === true) {
    return `当前候选方案：\n${planList}`;
  }

  return '';
}

function getPlanClarifyMessageSections({
  planList,
  reason,
}: {
  planList: string;
  reason?: string;
}): string[] {
  const candidateSections = [
    getPlanClarifyReasonMessage(reason),
    '请明确回复“按方案 1 实现”“按方案 2 实现”，或直接点击对应方案。',
    getPlanClarifyPlanListSection(planList),
  ];
  const sections: string[] = [];
  for (const section of candidateSections) {
    const hasSection = section.length > 0;
    if (hasSection === true) {
      sections.push(section);
    }
  }

  return sections;
}

function buildPlanClarifyMessage(plans: Plan[], reason?: string) {
  const planList = getPlanClarifyPlanList(plans);
  const clarifyMessageSections = getPlanClarifyMessageSections({
    planList,
    reason,
  });

  return clarifyMessageSections.join('\n\n');
}

function getWorkspaceFocusedPlan(
  plans: WorkspaceRecommendedPlanList,
  focusedPlanId?: string | null,
): Plan | null {
  for (const plan of plans) {
    const isFocusedPlan = plan.id === focusedPlanId;
    if (isFocusedPlan === true) {
      return plan;
    }
  }

  return null;
}

function shouldDiscussPendingPlanQuestion({
  input,
  implementationRequest,
}: {
  input: string;
  implementationRequest: boolean;
}): boolean {
  const questionPattern = /(\?|？|为什么|为何|怎么|如何|区别|对比|比较|优缺点|解释|说明|详细|展开|风险|成本|适合|不适合|兼容|扩展|能否|可以.*吗|是否|是不是|哪个更|哪.?个更|如果|但是|还是|后续|有没有)/i;
  const hasQuestion = questionPattern.test(input);
  if (hasQuestion === false) {
    return false;
  }

  return implementationRequest === false;
}

function shouldConfirmRecommendedPlan({
  input,
  hasRecommendedPlan,
}: {
  input: string;
  hasRecommendedPlan: boolean;
}): boolean {
  const recommendedPattern = /(推荐方案|默认方案|按推荐|采用推荐|推荐的|就推荐)/i;
  const mentionsRecommendedPlan = recommendedPattern.test(input);
  if (mentionsRecommendedPlan === false) {
    return false;
  }

  return hasRecommendedPlan === true;
}

function canConfirmPendingContextPlan(input: string, normalized: string): boolean {
  if (isContextPlanConfirm(input) === true) {
    return true;
  }

  return isShortPlanConfirm(normalized) === true;
}

function shouldConfirmReferencedPlan({
  hasReferencedPlan,
  implementationRequest,
}: {
  hasReferencedPlan: boolean;
  implementationRequest: boolean;
}): boolean {
  if (hasReferencedPlan === false) {
    return false;
  }

  return implementationRequest === true;
}

function shouldReplanForConstraintChange({
  constraintChange,
  implementationRequest,
}: {
  constraintChange: boolean;
  implementationRequest: boolean;
}): boolean {
  if (constraintChange === false) {
    return false;
  }

  return implementationRequest === false;
}

function shouldReplanForExplicitActionConstraintChange(constraintChange: boolean): boolean {
  const hasConstraintChange = isPlanMessageConstraintChange(constraintChange);
  return hasConstraintChange === true;
}

function getFallbackPendingPlanIntent(input: string): PendingPlanDiscussIntent | PendingPlanReplanIntent {
  const classifiedIntent = classifyPendingPlanIntent(input);
  if (classifiedIntent === 'discuss') {
    return 'discuss';
  }

  return 'replan';
}

export function resolvePendingPlanIntent(
  rawInput: string,
  plans: Plan[],
  recommendedPlanId: string | null,
  focusedPlanId?: string | null,
): PendingPlanIntentResult {
  const input = rawInput.trim();
  const normalized = input.toLowerCase();
  const recommendedPlan = getWorkspaceRecommendedPlan(plans, recommendedPlanId);
  const focusedPlan = getWorkspaceFocusedPlan(plans, focusedPlanId);
  const hasInput = input.length > 0;
  const hasPlans = plans.length > 0;
  if (hasInput === false || hasPlans === false) return { intent: 'replan' };

  const explicitActionPattern = /(实现|开发|开始|采用|选择|选|按|就|做|确认|确定|执行|生成)/i;
  const implementationRequest = isPlanImplementationRequest(input);
  const constraintChange = isPlanConstraintChange(input);
  const shouldDiscussQuestion = shouldDiscussPendingPlanQuestion({
    input,
    implementationRequest,
  });

  if (shouldDiscussQuestion === true) {
    return { intent: 'discuss' };
  }

  const ordinalPlan = findPlanByOrdinalInput(input, plans);
  if (ordinalPlan === undefined) {
    return { intent: 'clarify', message: buildPlanClarifyMessage(plans, '你提到的方案序号不在当前候选范围内。') };
  }
  const hasOrdinalPlan = ordinalPlan !== null && ordinalPlan !== undefined;
  if (hasOrdinalPlan === true) {
    return { intent: 'confirm', plan: ordinalPlan };
  }

  const hasRecommendedPlan = recommendedPlan !== undefined;
  const shouldConfirmRecommended = shouldConfirmRecommendedPlan({
    input,
    hasRecommendedPlan,
  });
  if (shouldConfirmRecommended === true) {
    if (recommendedPlan !== undefined) {
      return { intent: 'confirm', plan: recommendedPlan };
    }
  }

  const hasFocusedPlan = focusedPlan !== null;
  const canConfirmContextPlan = canConfirmPendingContextPlan(input, normalized);
  if (canConfirmContextPlan === true && hasFocusedPlan === true) {
    if (focusedPlan !== null) {
      return { intent: 'confirm', plan: focusedPlan };
    }
  }

  if (canConfirmContextPlan === true && hasRecommendedPlan === true) {
    if (recommendedPlan !== undefined) {
      return { intent: 'confirm', plan: recommendedPlan };
    }
  }

  const referencedPlan = resolveReferencedPlan(input, plans);
  if (referencedPlan === undefined) {
    return { intent: 'clarify', message: buildPlanClarifyMessage(plans, '你的输入匹配到多个候选方案，我不能替你猜。') };
  }
  const hasReferencedPlan = referencedPlan !== null && referencedPlan !== undefined;
  const shouldConfirmReferenced = shouldConfirmReferencedPlan({
    hasReferencedPlan,
    implementationRequest,
  });
  if (shouldConfirmReferenced === true) {
    if (referencedPlan !== null) {
      return { intent: 'confirm', plan: referencedPlan };
    }
  }

  const shouldReplanConstraintChange = shouldReplanForConstraintChange({
    constraintChange,
    implementationRequest,
  });
  if (shouldReplanConstraintChange === true) {
    return { intent: 'replan' };
  }

  if (explicitActionPattern.test(input)) {
    const shouldReplanExplicitAction = shouldReplanForExplicitActionConstraintChange(constraintChange);
    if (shouldReplanExplicitAction === true) {
      return { intent: 'replan' };
    }
    return { intent: 'discuss' };
  }

  return { intent: getFallbackPendingPlanIntent(input) };
}

function shouldSupersedePlanSelectionMessage(message: WorkspaceChatMessage): boolean {
  const isPlanOptionsMessage = message.kind === 'plan-options';
  if (isPlanOptionsMessage === false) {
    return false;
  }

  const isPlanSuperseded = message.planSuperseded === true;
  return isPlanSuperseded === false;
}

function getSupersededPlanSelectionMessage(message: WorkspaceChatMessage): WorkspaceChatMessage {
  return {
    ...message,
    planSuperseded: true,
    planStreamComplete: true,
    content: `${message.content}\n\n已根据你后续补充的需求停止本轮方案选择，以下方案仅保留为历史记录。`,
  };
}

export function supersedePlanSelectionMessages(messages: WorkspaceChatMessage[]) {
  const normalizedMessages: WorkspaceChatMessage[] = [];
  for (const message of messages) {
    const shouldSupersedeMessage = shouldSupersedePlanSelectionMessage(message);
    if (shouldSupersedeMessage === true) {
      normalizedMessages.push(getSupersededPlanSelectionMessage(message));
      continue;
    }

    normalizedMessages.push(message);
  }

  return normalizedMessages;
}

function shouldKeepActivePlanSelectionMessage({
  activePlanMessageSeen,
  message,
}: {
  activePlanMessageSeen: boolean;
  message: WorkspaceChatMessage;
}): boolean {
  const hasActivePlanMessageSeen = activePlanMessageSeen === true;
  const isPlanSuperseded = message.planSuperseded === true;
  if (hasActivePlanMessageSeen === true) {
    return false;
  }

  return isPlanSuperseded === false;
}

function getInactivePlanSelectionMessage(message: WorkspaceChatMessage): WorkspaceChatMessage {
  return {
    ...message,
    planSuperseded: true,
    planStreamComplete: true,
  };
}

export function normalizePlanSelectionMessages(messages: WorkspaceChatMessage[]): WorkspaceChatMessage[] {
  let activePlanMessageSeen = false;
  const normalizedMessages: WorkspaceChatMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind !== 'plan-options') {
      normalizedMessages.unshift(message);
      continue;
    }

    const shouldKeepActivePlanMessage = shouldKeepActivePlanSelectionMessage({
      activePlanMessageSeen,
      message,
    });
    if (shouldKeepActivePlanMessage === true) {
      activePlanMessageSeen = true;
      normalizedMessages.unshift(message);
      continue;
    }

    normalizedMessages.unshift(getInactivePlanSelectionMessage(message));
  }

  return normalizedMessages;
}

function shouldKeepLegacyPlaceholderMessage(message: WorkspaceChatMessage): boolean {
  if (message.role !== 'assistant') return true;

    const content = message.content.trim();
    if (content !== '正在分析你的需求并规划技术方案...') return true;
    if (message.kind === 'plan-options') return true;
    const workflowSteps = getPlanMessageWorkflowSteps(message);
    const hasWorkflowSteps = workflowSteps.length > 0;
    if (hasWorkflowSteps === true) return true;
    const reasoningContent = getPlanMessageTrimmedTextValue(message.reasoningContent);
    const hasReasoningContent = hasPlanMessageContent(reasoningContent);
    if (hasReasoningContent === true) return true;
    const statusContent = getPlanMessageTrimmedTextValue(message.statusContent);
    const hasStatusContent = hasPlanMessageContent(statusContent);
    if (hasStatusContent === true) return true;
    return false;
}

export function removeLegacyPlaceholderMessages(messages: WorkspaceChatMessage[]): WorkspaceChatMessage[] {
  const retainedMessages: WorkspaceChatMessage[] = [];
  for (const message of messages) {
    const shouldKeepMessage = shouldKeepLegacyPlaceholderMessage(message);
    if (shouldKeepMessage === true) {
      retainedMessages.push(message);
    }
  }

  return retainedMessages;
}
