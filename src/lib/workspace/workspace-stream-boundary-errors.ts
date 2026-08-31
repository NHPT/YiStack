import type { WorkspaceEngineeringStateSnapshot, WorkspaceGateResult } from './engineering-state';

export type WorkspaceStreamErrorFieldKey = 'code' | 'source' | 'details' | 'error' | 'message' | 'gate';
export type WorkspaceStreamErrorMessage = string;
export type WorkspaceStreamErrorCode = string;
export type WorkspaceStreamErrorSource = string;
export type WorkspaceStreamErrorDetails = string;
export type WorkspaceStreamErrorGate = string;
export type WorkspaceStreamErrorFieldValue = string;
export type WorkspaceStreamExecutionResultStatus = 'deferred' | 'skipped' | 'executed' | 'blocked' | 'unknown';
export type WorkspaceStreamBoundaryPayload = {
  [fieldName: string]: unknown;
};
export type WorkspaceStreamBoundaryObject = WorkspaceStreamBoundaryPayload;
export type WorkspaceStreamBoundaryItemList = unknown[];
export type WorkspaceStreamExecutionResultMetadata = WorkspaceStreamBoundaryObject;
export type WorkspaceStreamExecutionArtifact = {
  id: string;
  type: string;
  name: string;
  uri: string;
  sourceNote: string;
  metadata: WorkspaceStreamExecutionResultMetadata;
};
export type WorkspaceStreamExecutionArtifactList = WorkspaceStreamExecutionArtifact[];
export type WorkspaceStreamExecutionResultItem = {
  capabilityId: string;
  provider: string;
  status: WorkspaceStreamExecutionResultStatus;
  reasonCode: string;
  sourceNote: string;
  metadata: WorkspaceStreamExecutionResultMetadata;
  artifacts: WorkspaceStreamExecutionArtifactList;
};
export type WorkspaceStreamExecutionResultItemList = WorkspaceStreamExecutionResultItem[];
export type WorkspaceStreamExecutionResult = {
  status: WorkspaceStreamExecutionResultStatus;
  capabilityProfile: string;
  items: WorkspaceStreamExecutionResultItemList;
  reasonCode: string;
  sourceNote: string;
};

export type WorkspacePlanStreamError = Error & {
  code?: WorkspaceStreamErrorCode;
  source: WorkspaceStreamErrorSource;
  details: WorkspaceStreamErrorDetails;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
};

export type WorkspaceSSEStreamUnreadableError = Error & {
  source: WorkspaceStreamErrorSource;
  details: WorkspaceStreamErrorDetails;
};

export type WorkspaceImplementationStreamPayloadErrorInput = {
  message: WorkspaceStreamErrorMessage;
  code?: WorkspaceStreamErrorCode;
  source?: WorkspaceStreamErrorSource;
  details?: WorkspaceStreamErrorDetails;
  gate?: WorkspaceStreamErrorGate;
  blocking?: boolean;
  gateResult?: WorkspaceGateResult;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  executionResult?: WorkspaceStreamExecutionResult;
};

export type WorkspaceImplementationStreamPayloadError = Error & {
  code?: WorkspaceStreamErrorCode;
  source?: WorkspaceStreamErrorSource;
  details?: WorkspaceStreamErrorDetails;
  gate?: WorkspaceStreamErrorGate;
  blocking?: boolean;
  gateResult?: WorkspaceGateResult;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  executionResult?: WorkspaceStreamExecutionResult;
};

export function readWorkspaceStreamErrorField(
  data: WorkspaceStreamBoundaryPayload,
  key: WorkspaceStreamErrorFieldKey,
): WorkspaceStreamErrorFieldValue | undefined {
  const value = data[key];
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  const hasValue = hasWorkspaceStreamFieldValue(normalizedValue);
  if (hasValue === false) {
    return undefined;
  }

  return normalizedValue;
}

function readWorkspaceStreamObject(value: unknown): WorkspaceStreamBoundaryObject {
  const hasObject = isWorkspaceStreamBoundaryObject(value);
  return hasObject === true
    ? value
    : {};
}

function readWorkspaceStreamString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasWorkspaceStreamFieldValue(value: string): boolean {
  const hasValue = value.length > 0;
  return hasValue === true;
}

function isWorkspaceStreamBoundaryObject(value: unknown): value is WorkspaceStreamBoundaryObject {
  const hasObject = value !== null && typeof value === 'object' && Array.isArray(value) === false;
  return hasObject === true;
}

function readWorkspaceStreamBoundaryItemList(value: unknown): WorkspaceStreamBoundaryItemList {
  const hasItems = Array.isArray(value);
  if (hasItems === false) {
    return [];
  }

  return value;
}

function readWorkspaceStreamErrorFallbackValue(
  value: WorkspaceStreamErrorFieldValue | undefined,
  fallback: WorkspaceStreamErrorFieldValue,
): WorkspaceStreamErrorFieldValue {
  const hasValue = value !== undefined;
  if (hasValue === false) {
    return fallback;
  }

  return value;
}

export function readWorkspaceStreamErrorSource(
  data: WorkspaceStreamBoundaryPayload,
  fallback: WorkspaceStreamErrorSource,
): WorkspaceStreamErrorSource {
  return readWorkspaceStreamErrorFallbackValue(
    readWorkspaceStreamErrorField(data, 'source'),
    fallback,
  );
}

export function readWorkspaceStreamErrorMessage(
  data: WorkspaceStreamBoundaryPayload,
  fallback: WorkspaceStreamErrorMessage,
): WorkspaceStreamErrorMessage {
  const message = readWorkspaceStreamErrorField(data, 'message');
  const hasMessage = message !== undefined;
  if (hasMessage === true) {
    return message;
  }

  return readWorkspaceStreamErrorFallbackValue(
    readWorkspaceStreamErrorField(data, 'error'),
    fallback,
  );
}

export function readWorkspaceStreamErrorDetails(
  data: WorkspaceStreamBoundaryPayload,
  fallback: WorkspaceStreamErrorDetails,
): WorkspaceStreamErrorDetails {
  const details = readWorkspaceStreamErrorField(data, 'details');
  const hasDetails = details !== undefined;
  if (hasDetails === true) {
    return details;
  }

  const error = readWorkspaceStreamErrorField(data, 'error');
  const hasError = error !== undefined;
  if (hasError === true) {
    return error;
  }

  return readWorkspaceStreamErrorFallbackValue(
    readWorkspaceStreamErrorField(data, 'message'),
    fallback,
  );
}

function readWorkspaceStreamExecutionResultStatus(value: unknown): WorkspaceStreamExecutionResultStatus {
  switch (readWorkspaceStreamString(value)) {
    case 'deferred':
      return 'deferred';
    case 'skipped':
      return 'skipped';
    case 'executed':
      return 'executed';
    case 'blocked':
      return 'blocked';
    default:
      return 'unknown';
  }
}

function readWorkspaceStreamExecutionArtifact(value: unknown): WorkspaceStreamExecutionArtifact {
  const artifact = readWorkspaceStreamObject(value);
  return {
    id: readWorkspaceStreamString(artifact.id),
    type: readWorkspaceStreamString(artifact.type),
    name: readWorkspaceStreamString(artifact.name),
    uri: readWorkspaceStreamString(artifact.uri),
    sourceNote: readWorkspaceStreamString(artifact.source_note),
    metadata: readWorkspaceStreamObject(artifact.metadata),
  };
}

function readWorkspaceStreamExecutionArtifactList(value: unknown): WorkspaceStreamExecutionArtifactList {
  const items = readWorkspaceStreamBoundaryItemList(value);
  const artifacts: WorkspaceStreamExecutionArtifactList = [];
  for (const item of items) {
    artifacts.push(readWorkspaceStreamExecutionArtifact(item));
  }

  return artifacts;
}

function readWorkspaceStreamExecutionResultItem(value: unknown): WorkspaceStreamExecutionResultItem {
  const resultItem = readWorkspaceStreamObject(value);
  return {
    capabilityId: readWorkspaceStreamString(resultItem.capability_id),
    provider: readWorkspaceStreamString(resultItem.provider),
    status: readWorkspaceStreamExecutionResultStatus(resultItem.status),
    reasonCode: readWorkspaceStreamString(resultItem.reason_code),
    sourceNote: readWorkspaceStreamString(resultItem.source_note),
    metadata: readWorkspaceStreamObject(resultItem.metadata),
    artifacts: readWorkspaceStreamExecutionArtifactList(resultItem.artifacts),
  };
}

function readWorkspaceStreamExecutionResultItemList(value: unknown): WorkspaceStreamExecutionResultItemList {
  const items = readWorkspaceStreamBoundaryItemList(value);
  const resultItems: WorkspaceStreamExecutionResultItemList = [];
  for (const item of items) {
    resultItems.push(readWorkspaceStreamExecutionResultItem(item));
  }

  return resultItems;
}

export function readWorkspaceStreamExecutionResult(value: unknown): WorkspaceStreamExecutionResult | undefined {
  const hasResult = isWorkspaceStreamBoundaryObject(value);
  if (hasResult === false) {
    return undefined;
  }

  const result = readWorkspaceStreamObject(value);
  return {
    status: readWorkspaceStreamExecutionResultStatus(result.status),
    capabilityProfile: readWorkspaceStreamString(result.capability_profile),
    reasonCode: readWorkspaceStreamString(result.reason_code),
    sourceNote: readWorkspaceStreamString(result.source_note),
    items: readWorkspaceStreamExecutionResultItemList(result.items),
  };
}

export function buildPlanStreamError(
  data: WorkspaceStreamBoundaryPayload,
  message: WorkspaceStreamErrorMessage,
  engineeringState?: WorkspaceEngineeringStateSnapshot,
): WorkspacePlanStreamError {
  const code = readWorkspaceStreamErrorField(data, 'code');
  const source = readWorkspaceStreamErrorSource(data, 'plan_generation_stream');
  const details = readWorkspaceStreamErrorDetails(data, message);
  return Object.assign(new Error(message), {
    code,
    source,
    details,
    engineeringState,
  });
}

export function buildPlanFoundationGateBlockedStreamError(
  message: WorkspaceStreamErrorMessage,
  engineeringState?: WorkspaceEngineeringStateSnapshot,
): WorkspacePlanStreamError {
  return Object.assign(new Error(message), {
    code: 'foundation_gate_blocked',
    source: 'plan_generation_foundation_gate',
    details: message,
    engineeringState,
  });
}

export function buildSSEStreamUnreadableError(
  message: WorkspaceStreamErrorMessage,
  source: WorkspaceStreamErrorSource = 'sse_stream_reader',
): WorkspaceSSEStreamUnreadableError {
  return Object.assign(new Error(message), {
    source,
    details: 'response.body is unavailable; the browser could not attach an SSE reader',
  });
}

export function buildImplementationStreamPayloadError(
  streamError: WorkspaceImplementationStreamPayloadErrorInput,
): WorkspaceImplementationStreamPayloadError {
  return Object.assign(new Error(streamError.message), {
    code: streamError.code,
    source: streamError.source,
    details: streamError.details,
    gate: streamError.gate,
    blocking: streamError.blocking,
    gateResult: streamError.gateResult,
    engineeringState: streamError.engineeringState,
    executionResult: streamError.executionResult,
  });
}
