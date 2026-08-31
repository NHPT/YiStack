import type {
  Plan,
  TechStackProfile,
  TechStackSectionRawObject,
  TechStackStructuredValue,
  TechStackValue,
} from '@/lib/api';

export type TechStackDisplayLabel = string;
export type TechStackDisplayLabelList = TechStackDisplayLabel[];
type TechStackDisplayLabelCandidateList = readonly unknown[];
type TechStackSectionList = readonly unknown[];
export type TechStackRuntimeProfileLabel = TechStackDisplayLabel;
export type TechStackRuntimeProfileLabelMap = {
  [profileName: TechStackProfile]: TechStackRuntimeProfileLabel;
};

const runtimeProfileLabels: TechStackRuntimeProfileLabelMap = {
  'node-nextjs': 'Next.js',
  'node-react': 'React',
  'node-vue': 'Vue',
  'node-express': 'Express',
  'python-fastapi': 'FastAPI',
  'python-django': 'Django',
  'python-flask': 'Flask',
  'go-gin': 'Gin',
  'go-fiber': 'Fiber',
  'static-html': '静态网页',
};

function getRuntimeProfileLabel(profile: string): TechStackRuntimeProfileLabel {
  return runtimeProfileLabels[profile] || profile;
}

function isTechStackStructuredValue(value: unknown): value is TechStackStructuredValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTechStackSectionRawObject(value: unknown): value is TechStackSectionRawObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasTechStackDisplayLabel(labels: TechStackDisplayLabelList, text: TechStackDisplayLabel) {
  for (const label of labels) {
    if (label === text) {
      return true;
    }
  }

  return false;
}

function addUnique(labels: TechStackDisplayLabelList, value: unknown) {
  if (typeof value !== 'string') return;
  const text = value.trim();
  if (!text) return;
  const hasLabel = hasTechStackDisplayLabel(labels, text);
  if (hasLabel === true) return;
  labels.push(text);
}

function addTechStackDisplayLabelsFromCandidates(
  labels: TechStackDisplayLabelList,
  candidates: TechStackDisplayLabelCandidateList,
) {
  for (const candidate of candidates) {
    addUnique(labels, candidate);
  }
}

function addTechStackDisplayLabelsFromSection(
  labels: TechStackDisplayLabelList,
  section: unknown,
) {
  if (!isTechStackSectionRawObject(section)) return;

  for (const fieldName in section) {
    const value = section[fieldName];

    if (typeof value === 'string') {
      addUnique(labels, value);
      continue;
    }

    if (Array.isArray(value)) {
      addTechStackDisplayLabelsFromCandidates(labels, value);
    }
  }
}

function getTechStackStructuredSections(parsed: TechStackStructuredValue): TechStackSectionList {
  return [parsed.frontend, parsed.backend, parsed.database, parsed.deployment];
}

function addTechStackDisplayLabelsFromStructuredValue(
  labels: TechStackDisplayLabelList,
  parsed: TechStackStructuredValue,
) {
  const summary = parsed.summary;
  if (Array.isArray(summary)) {
    addTechStackDisplayLabelsFromCandidates(labels, summary);
  }

  const sections = getTechStackStructuredSections(parsed);
  for (const section of sections) {
    addTechStackDisplayLabelsFromSection(labels, section);
  }
}

function getLimitedTechStackDisplayLabels(
  labels: TechStackDisplayLabelList,
  limit: number,
): TechStackDisplayLabelList {
  const limitedLabels: TechStackDisplayLabelList = [];

  for (const label of labels) {
    if (limitedLabels.length >= limit) {
      break;
    }

    limitedLabels.push(label);
  }

  return limitedLabels;
}

export function parseTechStack(raw: unknown): TechStackValue | null {
  if (!raw) return null;
  if (Array.isArray(raw) || isTechStackStructuredValue(raw)) return raw as TechStackValue;
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed) || isTechStackStructuredValue(parsed)) {
      return parsed as TechStackValue;
    }
  } catch {
    return [text];
  }
  return null;
}

export function getTechStackProfile(value: unknown, fallback?: string): string {
  const parsed = parseTechStack(value);
  if (isTechStackStructuredValue(parsed)) {
    const runtime = parsed.runtime;
    if (isTechStackSectionRawObject(runtime) && typeof runtime.profile === 'string' && runtime.profile.trim()) {
      return runtime.profile.trim();
    }
  }
  return fallback?.trim() || '';
}

export function getTechStackLabels(value: unknown, fallbackProfile?: string): TechStackDisplayLabelList {
  const parsed = parseTechStack(value);
  const labels: TechStackDisplayLabelList = [];

  if (Array.isArray(parsed)) {
    addTechStackDisplayLabelsFromCandidates(labels, parsed);
  } else if (isTechStackStructuredValue(parsed)) {
    addTechStackDisplayLabelsFromStructuredValue(labels, parsed);
  }

  const profile = getTechStackProfile(parsed, fallbackProfile);
  if (labels.length === 0 && profile) {
    addUnique(labels, getRuntimeProfileLabel(profile));
  }

  return getLimitedTechStackDisplayLabels(labels, 6);
}

export function serializePlanTechStack(plan: Plan): string {
  const parsed = parseTechStack(plan.tech_stack);
  if (parsed) {
    const profile = getTechStackProfile(parsed);
    if (isTechStackStructuredValue(parsed) && profile) {
      return JSON.stringify({
        ...parsed,
        runtime: {
          ...(isTechStackSectionRawObject(parsed.runtime) ? parsed.runtime : {}),
          profile,
        },
      });
    }
    return JSON.stringify(parsed);
  }

  return JSON.stringify({
    runtime: { profile: '' },
    summary: [],
  });
}

export function formatTechStack(value: unknown, fallbackProfile?: string): string {
  const labels = getTechStackLabels(value, fallbackProfile);
  return labels.length > 0 ? labels.join('、') : '待确定';
}
