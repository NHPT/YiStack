export type RuntimeHealthSearchParamKey = string;
export type RuntimeHealthSearchParamKeyList = RuntimeHealthSearchParamKey[];

export const RUNTIME_HEALTH_PROJECT_QUERY_PARAM: RuntimeHealthSearchParamKey = 'runtime_project';
export const RUNTIME_HEALTH_REASON_QUERY_PARAM: RuntimeHealthSearchParamKey = 'runtime_reason';

export type RuntimeHealthDiagnosticContextActiveLabel = string;
export type RuntimeHealthDiagnosticContextActiveLabelList = RuntimeHealthDiagnosticContextActiveLabel[];
export type RuntimeHealthDiagnosticReasonCode = string;

export type RuntimeHealthDiagnosticContext = {
  projectId: string;
  reasonCode: RuntimeHealthDiagnosticReasonCode;
  activeLabels: RuntimeHealthDiagnosticContextActiveLabelList;
};

function readString(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasRuntimeHealthQueryValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function shouldDeleteRuntimeHealthSearchParamValue(value: string): boolean {
  const hasValue = hasRuntimeHealthQueryValue(value);
  const isAllValue = value === 'all';
  return hasValue === false || isAllValue === true;
}

function getRuntimeHealthSearch(searchParams: URLSearchParams): string {
  const nextSearch = searchParams.toString();
  const hasNextSearch = hasRuntimeHealthQueryValue(nextSearch);
  if (hasNextSearch === false) {
    return '';
  }

  return `?${nextSearch}`;
}

function hasRuntimeHealthDiagnosticContextValue({
  hasProjectId,
  hasReasonCode,
}: {
  hasProjectId: boolean;
  hasReasonCode: boolean;
}): boolean {
  if (hasProjectId === true) {
    return true;
  }

  return hasReasonCode === true;
}

function hasRuntimeHealthDiagnosticContext({
  projectId,
  reasonCode,
}: {
  projectId: string;
  reasonCode: RuntimeHealthDiagnosticReasonCode;
}): boolean {
  const hasProjectId = hasRuntimeHealthQueryValue(projectId);
  const hasReasonCode = hasRuntimeHealthQueryValue(reasonCode);
  return hasRuntimeHealthDiagnosticContextValue({
    hasProjectId,
    hasReasonCode,
  });
}

function getRuntimeHealthDiagnosticContextActiveLabel({
  key,
  value,
}: {
  key: RuntimeHealthSearchParamKey;
  value: string;
}): RuntimeHealthDiagnosticContextActiveLabel {
  const hasValue = hasRuntimeHealthQueryValue(value);
  if (hasValue === false) {
    return '';
  }

  return `${key}=${value}`;
}

function hasRuntimeHealthDiagnosticContextActiveLabel(
  label: RuntimeHealthDiagnosticContextActiveLabel,
): boolean {
  const hasLabel = hasRuntimeHealthQueryValue(label);
  return hasLabel === true;
}

function getRuntimeHealthDiagnosticContextActiveLabels(
  labels: RuntimeHealthDiagnosticContextActiveLabelList,
): RuntimeHealthDiagnosticContextActiveLabelList {
  const activeLabels: RuntimeHealthDiagnosticContextActiveLabelList = [];
  for (const label of labels) {
    const hasLabel = hasRuntimeHealthDiagnosticContextActiveLabel(label);
    if (hasLabel === true) {
      activeLabels.push(label);
    }
  }

  return activeLabels;
}

export function updateRuntimeHealthSearchParam(search: string, key: RuntimeHealthSearchParamKey, value?: string | null): string {
  const searchParams = new URLSearchParams(search);
  const normalizedValue = readString(value);
  const shouldDeleteParam = shouldDeleteRuntimeHealthSearchParamValue(normalizedValue);
  if (shouldDeleteParam === true) {
    searchParams.delete(key);
  } else {
    searchParams.set(key, normalizedValue);
  }
  return getRuntimeHealthSearch(searchParams);
}

export function updateRuntimeHealthProjectSearch(search: string, projectId?: string | null): string {
  return updateRuntimeHealthSearchParam(search, RUNTIME_HEALTH_PROJECT_QUERY_PARAM, projectId);
}

export function clearRuntimeHealthSearchParams(search: string, keys: RuntimeHealthSearchParamKeyList): string {
  const searchParams = new URLSearchParams(search);
  for (const key of keys) {
    searchParams.delete(key);
  }
  return getRuntimeHealthSearch(searchParams);
}

export function clearRuntimeHealthDiagnosticContextSearch(search: string): string {
  return clearRuntimeHealthSearchParams(search, [
    RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
    RUNTIME_HEALTH_REASON_QUERY_PARAM,
  ]);
}

export function deriveRuntimeHealthDiagnosticContext(search: string): RuntimeHealthDiagnosticContext | null {
  const searchParams = new URLSearchParams(search);
  const projectId = readString(searchParams.get(RUNTIME_HEALTH_PROJECT_QUERY_PARAM));
  const reasonCode: RuntimeHealthDiagnosticReasonCode = readString(searchParams.get(RUNTIME_HEALTH_REASON_QUERY_PARAM));
  const hasDiagnosticContext = hasRuntimeHealthDiagnosticContext({ projectId, reasonCode });
  if (hasDiagnosticContext === false) {
    return null;
  }
  const activeLabelCandidates: RuntimeHealthDiagnosticContextActiveLabelList = [
    getRuntimeHealthDiagnosticContextActiveLabel({
      key: RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
      value: projectId,
    }),
    getRuntimeHealthDiagnosticContextActiveLabel({
      key: RUNTIME_HEALTH_REASON_QUERY_PARAM,
      value: reasonCode,
    }),
  ];
  const activeLabels = getRuntimeHealthDiagnosticContextActiveLabels(activeLabelCandidates);
  return {
    projectId,
    reasonCode,
    activeLabels,
  };
}
