import { strict as assert } from 'node:assert';
import fs from 'node:fs';

import type {
  CapabilityExecutionAuditCapabilityProfile,
  CapabilityExecutionAuditCreatedAt,
  CapabilityExecutionAuditRecord,
  CapabilityExecutionAuditStatus,
} from '../src/lib/api';
import {
  CAPABILITY_AUDIT_PROFILE_QUERY_PARAM,
  CAPABILITY_AUDIT_REASON_QUERY_PARAM,
  CAPABILITY_AUDIT_STATUS_QUERY_PARAM,
  buildCapabilityAuditProfileFilterOptions,
  buildCapabilityAuditReasonFilterOptions,
  clearCapabilityAuditFilterSearch,
  deriveCapabilityAuditActiveFilterSummary,
  deriveCapabilityAuditDiagnosticsSummary,
  formatCapabilityAuditTime,
  getCapabilityAuditRecordReason,
  getCapabilityAuditRecordSourceNote,
  normalizeCapabilityAuditProfileFilter,
  normalizeCapabilityAuditReasonFilter,
  normalizeCapabilityAuditStatusFilter,
  updateCapabilityAuditProfileSearch,
  updateCapabilityAuditReasonSearch,
  updateCapabilityAuditStatusSearch,
} from '../src/lib/workspace/capability-audit-diagnostics';

const apiClient = fs.readFileSync('src/lib/api/index.ts', 'utf8');
const capabilityAuditDiagnosticsModel = fs.readFileSync('src/lib/workspace/capability-audit-diagnostics.ts', 'utf8');
assert.match(
  apiClient,
  /export type CapabilityExecutionAuditProjectId = string;[\s\S]*export type CapabilityExecutionAuditUserId = string;[\s\S]*export type CapabilityExecutionAuditWorkflowStage = string;[\s\S]*export type CapabilityExecutionAuditWorkflowMode = string;[\s\S]*export type CapabilityExecutionAuditCapabilityProfile = string;[\s\S]*export type CapabilityExecutionAuditStatus = string;[\s\S]*export type CapabilityExecutionAuditSourceNote = string;[\s\S]*export type CapabilityExecutionAuditCreatedAt = string;[\s\S]*export type CapabilityExecutionAuditListStatusFilter = CapabilityExecutionAuditStatus;[\s\S]*export type CapabilityExecutionAuditListCapabilityProfileFilter = CapabilityExecutionAuditCapabilityProfile;[\s\S]*export interface CapabilityExecutionAuditRecord \{[\s\S]*project_id: CapabilityExecutionAuditProjectId;[\s\S]*user_id\?: CapabilityExecutionAuditUserId;[\s\S]*workflow_stage\?: CapabilityExecutionAuditWorkflowStage;[\s\S]*workflow_mode\?: CapabilityExecutionAuditWorkflowMode;[\s\S]*capability_profile\?: CapabilityExecutionAuditCapabilityProfile;[\s\S]*status\?: CapabilityExecutionAuditStatus;[\s\S]*source_note\?: CapabilityExecutionAuditSourceNote;[\s\S]*created_at\?: CapabilityExecutionAuditCreatedAt;[\s\S]*export type CapabilityExecutionAuditListOptions = \{[\s\S]*status\?: CapabilityExecutionAuditListStatusFilter;[\s\S]*capabilityProfile\?: CapabilityExecutionAuditListCapabilityProfileFilter;/,
  'Capability Execution Audit API records and list options should name dynamic identity/status/profile/source/timestamp contracts',
);
assert.doesNotMatch(
  apiClient,
  /export interface CapabilityExecutionAuditRecord \{[\s\S]*project_id: string;[\s\S]*workflow_stage\?: string;[\s\S]*workflow_mode\?: string;[\s\S]*capability_profile\?: string;[\s\S]*status\?: string;[\s\S]*source_note\?: string;[\s\S]*created_at\?: string;|export type CapabilityExecutionAuditListOptions = \{[\s\S]*status\?: string;[\s\S]*capabilityProfile\?: string;/,
  'Capability Execution Audit API records and list options should not regress dynamic fields to raw string contracts',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /import type \{[\s\S]*CapabilityExecutionAuditCapabilityProfile,[\s\S]*CapabilityExecutionAuditCreatedAt,[\s\S]*CapabilityExecutionAuditSourceNote,[\s\S]*CapabilityExecutionAuditStatus,[\s\S]*CapabilityExecutionAuditWorkflowMode,[\s\S]*CapabilityExecutionAuditWorkflowStage,[\s\S]*\} from '@\/lib\/api';[\s\S]*export type CapabilityAuditDistributionItemList = CapabilityAuditDistributionItem\[\];[\s\S]*export type CapabilityAuditDistributionCountMap = Map<string, number>;[\s\S]*export type CapabilityAuditStatusCounts = \{[\s\S]*\[status in CapabilityExecutionAuditStatus\]: number;[\s\S]*\};[\s\S]*export type CapabilityAuditRecordReasonCode = string;[\s\S]*export type CapabilityAuditLatestRecord = \{[\s\S]*status: CapabilityExecutionAuditStatus;[\s\S]*reason: CapabilityAuditRecordReasonCode;[\s\S]*sourceNote: CapabilityExecutionAuditSourceNote;[\s\S]*createdAt\?: CapabilityExecutionAuditCreatedAt;[\s\S]*capabilityProfile: CapabilityExecutionAuditCapabilityProfile;[\s\S]*workflowStage: CapabilityExecutionAuditWorkflowStage;[\s\S]*workflowMode: CapabilityExecutionAuditWorkflowMode;[\s\S]*statusCounts: CapabilityAuditStatusCounts;[\s\S]*latestRecord: CapabilityAuditLatestRecord \| null;[\s\S]*capabilityProfiles: CapabilityAuditDistributionItemList;[\s\S]*reasonCodes: CapabilityAuditDistributionItemList;/,
  'Capability Audit diagnostics summary should consume named API audit field contracts for status, reason, source note, profile and workflow dimensions',
);
assert.doesNotMatch(
  capabilityAuditDiagnosticsModel,
  /statusCounts: Record<string, number>;|CapabilityAuditStatusCounts = Record<|latestRecord: \{[\s\S]*status: string;[\s\S]*reason: string;[\s\S]*sourceNote: string;[\s\S]*capabilityProfile: string;[\s\S]*workflowStage: string;[\s\S]*workflowMode: string;|capabilityProfiles: CapabilityAuditDistributionItem\[\];|reasonCodes: CapabilityAuditDistributionItem\[\];|const statusCounts: Record<string, number> = \{\};|new Map<string, number>\(\);/,
  'Capability Audit diagnostics summary should not regress dynamic summary fields to raw string or anonymous list contracts',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /(?=[\s\S]*function getCapabilityAuditCreatedAtSortValue\(value: CapabilityExecutionAuditCreatedAt \| undefined\): string \{[\s\S]*const hasValue = value !== undefined;[\s\S]*if \(hasValue === false\)[\s\S]*return '';[\s\S]*return value;)(?=[\s\S]*function hasCapabilityAuditCreatedAtDisplayValue\([\s\S]*value: CapabilityExecutionAuditCreatedAt \| undefined,[\s\S]*\): value is CapabilityExecutionAuditCreatedAt[\s\S]*if \(value === undefined\)[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;)(?=[\s\S]*function getCapabilityAuditDisplayValue\(value: string, fallback: string\): string)(?=[\s\S]*function getCapabilityAuditFallbackValue\(values: string\[\], fallback: string\): string)(?=[\s\S]*function getCapabilityAuditExecutionResultItems\(value: unknown\): CapabilityAuditExecutionResultItemList)(?=[\s\S]*function getCapabilityAuditRecordStatusValue\([\s\S]*record: CapabilityExecutionAuditRecord,[\s\S]*\): CapabilityExecutionAuditStatus)(?=[\s\S]*function getCapabilityAuditRecordProfileValue\([\s\S]*record: CapabilityExecutionAuditRecord,[\s\S]*\): CapabilityExecutionAuditCapabilityProfile)(?=[\s\S]*function getCapabilityAuditRecordWorkflowStageValue\([\s\S]*record: CapabilityExecutionAuditRecord,[\s\S]*\): CapabilityExecutionAuditWorkflowStage)(?=[\s\S]*function getCapabilityAuditRecordWorkflowModeValue\([\s\S]*record: CapabilityExecutionAuditRecord,[\s\S]*\): CapabilityExecutionAuditWorkflowMode)(?=[\s\S]*function getCapabilityAuditDistributionItems\([\s\S]*counts: CapabilityAuditDistributionCountMap,[\s\S]*\): CapabilityAuditDistributionItemList \{[\s\S]*const items: CapabilityAuditDistributionItemList = \[\];[\s\S]*for \(const \[label, count\] of counts\) \{[\s\S]*items\.push\(\{ label, count \}\);)(?=[\s\S]*function getCapabilityAuditStatusCount\([\s\S]*counts: CapabilityAuditStatusCounts,[\s\S]*status: CapabilityExecutionAuditStatus,[\s\S]*\): number \{[\s\S]*const count = counts\[status\];[\s\S]*if \(count === undefined\) \{[\s\S]*return 0;[\s\S]*function addCapabilityAuditStatusCount\([\s\S]*counts: CapabilityAuditStatusCounts,[\s\S]*status: CapabilityExecutionAuditStatus,[\s\S]*\) \{[\s\S]*const count = getCapabilityAuditStatusCount\(counts, status\);[\s\S]*counts\[status\] = count \+ 1;)(?=[\s\S]*function addCapabilityAuditDistributionCount\([\s\S]*counts: CapabilityAuditDistributionCountMap,[\s\S]*label: string,[\s\S]*\) \{[\s\S]*const count = getCapabilityAuditDistributionCount\(counts, label\);[\s\S]*counts\.set\(label, count \+ 1\);)(?=[\s\S]*function materializeCapabilityAuditLatestRecord\([\s\S]*record: CapabilityExecutionAuditRecord \| undefined,[\s\S]*\): CapabilityAuditLatestRecord \| null \{[\s\S]*if \(record === undefined\) \{[\s\S]*return null;[\s\S]*status: getCapabilityAuditRecordStatusValue\(record\),[\s\S]*capabilityProfile: getCapabilityAuditRecordProfileValue\(record\),[\s\S]*workflowStage: getCapabilityAuditRecordWorkflowStageValue\(record\),[\s\S]*workflowMode: getCapabilityAuditRecordWorkflowModeValue\(record\),)(?=[\s\S]*export function getCapabilityAuditRecordReason\(record: CapabilityExecutionAuditRecord\): CapabilityAuditRecordReasonCode[\s\S]*const items = getCapabilityAuditExecutionResultItems\(executionResult\.items\);[\s\S]*return getCapabilityAuditFallbackValue\()(?=[\s\S]*export function getCapabilityAuditRecordSourceNote\(record: CapabilityExecutionAuditRecord\): CapabilityExecutionAuditSourceNote[\s\S]*const items = getCapabilityAuditExecutionResultItems\(executionResult\.items\);[\s\S]*return getCapabilityAuditFallbackValue\()(?=[\s\S]*export function formatCapabilityAuditTime\(value\?: CapabilityExecutionAuditCreatedAt\): string[\s\S]*const hasValue = hasCapabilityAuditCreatedAtDisplayValue\(value\);[\s\S]*if \(hasValue === false\)[\s\S]*return '未知时间';)(?=[\s\S]*const statusCounts: CapabilityAuditStatusCounts = \{\};)(?=[\s\S]*const profileCounts: CapabilityAuditDistributionCountMap = new Map<CapabilityExecutionAuditCapabilityProfile, number>\(\);)(?=[\s\S]*const reasonCounts: CapabilityAuditDistributionCountMap = new Map<CapabilityAuditRecordReasonCode, number>\(\);)(?=[\s\S]*const sortedRecords = \[\.\.\.records\]\.sort\(\(left, right\) => \{[\s\S]*const rightCreatedAt = getCapabilityAuditCreatedAtSortValue\(right\.created_at\);[\s\S]*const leftCreatedAt = getCapabilityAuditCreatedAtSortValue\(left\.created_at\);[\s\S]*return rightCreatedAt\.localeCompare\(leftCreatedAt\);[\s\S]*\}\);)(?=[\s\S]*addCapabilityAuditStatusCount\(statusCounts, status\);)(?=[\s\S]*addCapabilityAuditDistributionCount\(profileCounts, profile\);)(?=[\s\S]*addCapabilityAuditDistributionCount\(reasonCounts, reason\);)(?=[\s\S]*executedCount: getCapabilityAuditStatusCount\(statusCounts, 'executed'\),)(?=[\s\S]*latestRecord: materializeCapabilityAuditLatestRecord\(latest\),)(?=[\s\S]*capabilityProfiles: sortDistributionItems\([\s\S]*getCapabilityAuditDistributionItems\(profileCounts\),[\s\S]*\),)(?=[\s\S]*reasonCodes: sortDistributionItems\([\s\S]*getCapabilityAuditDistributionItems\(reasonCounts\),[\s\S]*\),)/,
  'Capability Audit diagnostics helpers should return named reason/source/timestamp contracts and use named status counts',
);
assert.doesNotMatch(
  capabilityAuditDiagnosticsModel,
  /created_at \?\? ''|\(right\.created_at \?\? ''\)\.localeCompare\(left\.created_at \?\? ''\)|readCapabilityAuditExecutionResultRawObject\(items\[0\]\)|sortedRecords\[0\]|readString\(firstItem\.reason_code\)[\s\S]*\|\| readString\(executionResult\.reason_code\)|readString\(firstItem\.source_note\)[\s\S]*\|\| readString\(executionResult\.source_note\)|value !== undefined && value\.length > 0|if \(!value\) return '未知时间'|readString\(record\.status\) \|\| 'unknown'|readString\(record\.capability_profile\) \|\| 'default-profile'|readString\(latest\.status\) \|\| 'unknown'|readString\(latest\.capability_profile\) \|\| 'default-profile'|readString\(latest\.workflow_stage\) \|\| 'unknown-stage'|readString\(latest\.workflow_mode\) \|\| 'unknown-mode'|\[\.\.\.profileCounts\.entries\(\)\]\.map\(\(\[label, count\]\) => \(\{ label, count \}\)\)|\[\.\.\.reasonCounts\.entries\(\)\]\.map\(\(\[label, count\]\) => \(\{ label, count \}\)\)|statusCounts\[status\] = \(statusCounts\[status\] \?\? 0\) \+ 1|profileCounts\.set\(profile, \(profileCounts\.get\(profile\) \?\? 0\) \+ 1\)|reasonCounts\.set\(reason, \(reasonCounts\.get\(reason\) \?\? 0\) \+ 1\)|statusCounts\.executed \?\? 0|latestRecord: latest\s*\?/,
  'Capability Audit diagnostics should not regress created_at, reason/source, time or latest record display to inline fallback',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /export type CapabilityAuditExecutionResultRawObject = \{[\s\S]*\[fieldName: string\]: unknown;[\s\S]*\};[\s\S]*export type CapabilityAuditExecutionResultItemList = unknown\[\];[\s\S]*function isCapabilityAuditExecutionResultRawObject\(value: unknown\): value is CapabilityAuditExecutionResultRawObject \{[\s\S]*if \(value === null\) \{[\s\S]*return false;[\s\S]*const hasObject = typeof value === 'object';[\s\S]*const hasArray = Array\.isArray\(value\);[\s\S]*return hasObject === true && hasArray === false;[\s\S]*function readCapabilityAuditExecutionResultRawObject\(value: unknown\): CapabilityAuditExecutionResultRawObject \{[\s\S]*const hasRawObject = isCapabilityAuditExecutionResultRawObject\(value\);[\s\S]*if \(hasRawObject === false\) \{[\s\S]*return \{\};[\s\S]*return value;[\s\S]*function getCapabilityAuditExecutionResultItems\(value: unknown\): CapabilityAuditExecutionResultItemList[\s\S]*function getCapabilityAuditFirstExecutionResultItem\([\s\S]*items: CapabilityAuditExecutionResultItemList,[\s\S]*\): CapabilityAuditExecutionResultRawObject \{[\s\S]*for \(const item of items\)[\s\S]*return readCapabilityAuditExecutionResultRawObject\(item\);[\s\S]*return \{\};[\s\S]*const executionResult = readCapabilityAuditExecutionResultRawObject\(record\.execution_result\);[\s\S]*const items = getCapabilityAuditExecutionResultItems\(executionResult\.items\);[\s\S]*const firstItem = getCapabilityAuditFirstExecutionResultItem\(items\);[\s\S]*const executionResult = readCapabilityAuditExecutionResultRawObject\(record\.execution_result\);[\s\S]*const items = getCapabilityAuditExecutionResultItems\(executionResult\.items\);[\s\S]*const firstItem = getCapabilityAuditFirstExecutionResultItem\(items\);/,
  'Capability Audit diagnostics should consume a named execution result raw object contract',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /function getCapabilityAuditLatestSortedRecord\([\s\S]*sortedRecords: CapabilityExecutionAuditRecord\[\],[\s\S]*\): CapabilityExecutionAuditRecord \| undefined \{[\s\S]*for \(const record of sortedRecords\)[\s\S]*return record;[\s\S]*return undefined;[\s\S]*const latest = getCapabilityAuditLatestSortedRecord\(sortedRecords\);[\s\S]*latestRecord: materializeCapabilityAuditLatestRecord\(latest\),/,
  'Capability Audit diagnostics should derive the latest sorted record through a named first-record reader',
);
assert.doesNotMatch(
  capabilityAuditDiagnosticsModel,
  /function readObject\(value: unknown\): Record<string, unknown>|as Record<string, unknown>|value is Record<string, unknown>|return value && typeof value === 'object' && !Array\.isArray\(value\)/,
  'Capability Audit diagnostics should not regress execution_result readers to anonymous Record raw objects',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /(?=[\s\S]*export type CapabilityAuditActiveFilterLabel = string;)(?=[\s\S]*export type CapabilityAuditActiveFilterLabelList = CapabilityAuditActiveFilterLabel\[\];)(?=[\s\S]*export type CapabilityAuditRuntimeSourceLabel = string;)(?=[\s\S]*export type CapabilityAuditRuntimeSourceLabelList = CapabilityAuditRuntimeSourceLabel\[\];)(?=[\s\S]*activeLabels: CapabilityAuditActiveFilterLabelList;)(?=[\s\S]*runtimeSourceLabels: CapabilityAuditRuntimeSourceLabelList;)(?=[\s\S]*runtimeSourceLabels\?: CapabilityAuditRuntimeSourceLabelList;)(?=[\s\S]*function getCapabilityAuditRuntimeSourceLabelInput\([\s\S]*labels: CapabilityAuditRuntimeSourceLabelList \| undefined,[\s\S]*\): CapabilityAuditRuntimeSourceLabelList \{[\s\S]*const hasLabels = labels !== undefined;[\s\S]*if \(hasLabels === false\)[\s\S]*return \[\];[\s\S]*return labels;)(?=[\s\S]*function hasCapabilityAuditRuntimeSourceLabel\(label: CapabilityAuditRuntimeSourceLabel\): boolean \{[\s\S]*const hasLabel = label\.length > 0;[\s\S]*return hasLabel === true;)(?=[\s\S]*function getCapabilityAuditRuntimeSourceLabels\([\s\S]*labels: CapabilityAuditRuntimeSourceLabelList \| undefined,[\s\S]*\): CapabilityAuditRuntimeSourceLabelList \{[\s\S]*const runtimeSourceLabelInput = getCapabilityAuditRuntimeSourceLabelInput\(labels\);[\s\S]*const runtimeSourceLabels: CapabilityAuditRuntimeSourceLabelList = \[\];[\s\S]*for \(const label of runtimeSourceLabelInput\) \{[\s\S]*const normalizedLabel = readString\(label\);[\s\S]*const hasLabel = hasCapabilityAuditRuntimeSourceLabel\(normalizedLabel\);[\s\S]*if \(hasLabel === true\) \{[\s\S]*runtimeSourceLabels\.push\(normalizedLabel\);)(?=[\s\S]*function getCapabilityAuditRuntimeSourceSummary\([\s\S]*labels: CapabilityAuditRuntimeSourceLabelList,[\s\S]*\): string \{[\s\S]*const hasRuntimeSourceLabels = labels\.length > 0;[\s\S]*if \(hasRuntimeSourceLabels === false\) \{[\s\S]*return '无外部诊断来源';[\s\S]*return `来源 \$\{labels\.join\(' \/ '\)\}`;)(?=[\s\S]*const activeLabels: CapabilityAuditActiveFilterLabelList = \[\];)(?=[\s\S]*const runtimeSourceLabels = getCapabilityAuditRuntimeSourceLabels\(filters\.runtimeSourceLabels\);)(?=[\s\S]*sourceSummary: getCapabilityAuditRuntimeSourceSummary\(runtimeSourceLabels\),)/,
  'capability audit diagnostics should name active filter and runtime source label list contracts',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /(?=[\s\S]*export type CapabilityAuditSearchParamKey = string;)(?=[\s\S]*export const CAPABILITY_AUDIT_STATUS_QUERY_PARAM: CapabilityAuditSearchParamKey = 'capability_status';)(?=[\s\S]*export const CAPABILITY_AUDIT_PROFILE_QUERY_PARAM: CapabilityAuditSearchParamKey = 'capability_profile';)(?=[\s\S]*export const CAPABILITY_AUDIT_REASON_QUERY_PARAM: CapabilityAuditSearchParamKey = 'capability_reason';)(?=[\s\S]*function hasCapabilityAuditQueryValue\(value: string\): boolean)(?=[\s\S]*function getCapabilityAuditFilterValue\(value\?: string \| null\): string)(?=[\s\S]*function shouldDeleteCapabilityAuditSearchParamValue\(value: string\): boolean)(?=[\s\S]*function getCapabilityAuditSearch\(searchParams: URLSearchParams\): string)(?=[\s\S]*const hasOption = hasCapabilityAuditQueryValue\(normalizedOption\);)(?=[\s\S]*return getCapabilityAuditFilterValue\(value\);)(?=[\s\S]*function updateCapabilityAuditSearchParam\(search: string, key: CapabilityAuditSearchParamKey, value: string\): string)(?=[\s\S]*const shouldDeleteParam = shouldDeleteCapabilityAuditSearchParamValue\(normalizedValue\);)(?=[\s\S]*return getCapabilityAuditSearch\(searchParams\);)/,
  'capability audit query helpers should name query keys, filter fallback, search param deletion and search formatting facts',
);
assert.doesNotMatch(
  capabilityAuditDiagnosticsModel,
  /function updateCapabilityAuditSearchParam\(search: string, key: string, value: string\): string|return readString\(value\) \|\| 'all';|if \(!normalizedValue \|\| normalizedValue === 'all'\)|return nextSearch \?|if \(normalizedOption\) \{/,
  'capability audit query helpers should not regress to broad query keys, inline OR fallback, truthy option gates or inline search formatting',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /function getCapabilityAuditNonNegativeCount\(value: number \| undefined, fallback: number\): number \{[\s\S]*if \(value === undefined\) \{[\s\S]*return Math\.max\(0, fallback\);[\s\S]*return Math\.max\(0, value\);[\s\S]*const matchedRecordCount = getCapabilityAuditNonNegativeCount\(filters\.matchedRecordCount, 0\);[\s\S]*const loadedRecordCount = getCapabilityAuditNonNegativeCount\(filters\.loadedRecordCount, matchedRecordCount\);[\s\S]*const totalRecordCount = getCapabilityAuditNonNegativeCount\(filters\.totalRecordCount, loadedRecordCount\);/,
  'capability audit active filter summary should derive optional counts through a named non-negative count reader',
);
assert.doesNotMatch(
  capabilityAuditDiagnosticsModel,
  /return hasValue === true \? normalizedValue : 'all';|return hasNextSearch === true \? `\?\$\{nextSearch\}` : '';|filters\.matchedRecordCount \?\? 0|filters\.loadedRecordCount \?\? matchedRecordCount|filters\.totalRecordCount \?\? loadedRecordCount/,
  'capability audit filter/search/count readers should not regress to inline ternary or nullish fallback',
);
assert.doesNotMatch(
  capabilityAuditDiagnosticsModel,
  /activeLabels: string\[\];|runtimeSourceLabels: string\[\];|runtimeSourceLabels\?: string\[\];|const activeLabels: string\[\]|\(filters\.runtimeSourceLabels \?\? \[\]\)[\s\S]*\.filter\(Boolean\)|runtimeSourceLabelInput[\s\S]*\.map\(\(label\) => readString\(label\)\)[\s\S]*\.filter\(\(label\) => hasCapabilityAuditRuntimeSourceLabel\(label\)\)|sourceSummary: runtimeSourceLabels\.length > 0 \? `来源 \$\{runtimeSourceLabels\.join\(' \/ '\)\}` : '无外部诊断来源'/,
  'capability audit diagnostics should not keep active/runtime labels as anonymous string arrays',
);
assert.match(
  capabilityAuditDiagnosticsModel,
  /export type CapabilityAuditProfileFilterOption = CapabilityAuditProfileFilter;[\s\S]*export type CapabilityAuditProfileFilterOptionList = CapabilityAuditProfileFilterOption\[\];[\s\S]*export type CapabilityAuditProfileFilterOptionSet = Set<CapabilityAuditProfileFilterOption>;[\s\S]*export type CapabilityAuditReasonFilterOption = CapabilityAuditReasonFilter;[\s\S]*export type CapabilityAuditReasonFilterOptionList = CapabilityAuditReasonFilterOption\[\];[\s\S]*export type CapabilityAuditReasonFilterOptionSet = Set<CapabilityAuditReasonFilterOption>;[\s\S]*export const DEFAULT_CAPABILITY_AUDIT_PROFILE_FILTER_OPTIONS: CapabilityAuditProfileFilterOptionList = \['all'\];[\s\S]*export const DEFAULT_CAPABILITY_AUDIT_REASON_FILTER_OPTIONS: CapabilityAuditReasonFilterOptionList = \['all'\];[\s\S]*function addCapabilityAuditFilterOptions\([\s\S]*values: Set<string>,[\s\S]*items: CapabilityAuditDistributionItemList,[\s\S]*\) \{[\s\S]*for \(const item of items\) \{[\s\S]*addCapabilityAuditFilterOption\(values, item\.label\);[\s\S]*\}[\s\S]*\}[\s\S]*export function buildCapabilityAuditProfileFilterOptions\([\s\S]*\): CapabilityAuditProfileFilterOptionList[\s\S]*const values: CapabilityAuditProfileFilterOptionSet = new Set\(DEFAULT_CAPABILITY_AUDIT_PROFILE_FILTER_OPTIONS\)[\s\S]*addCapabilityAuditFilterOptions\(values, items\);[\s\S]*export function buildCapabilityAuditReasonFilterOptions\([\s\S]*\): CapabilityAuditReasonFilterOptionList[\s\S]*const values: CapabilityAuditReasonFilterOptionSet = new Set\(DEFAULT_CAPABILITY_AUDIT_REASON_FILTER_OPTIONS\)[\s\S]*addCapabilityAuditFilterOptions\(values, items\);/,
  'capability audit diagnostics should name dynamic profile/reason filter option list contracts',
);
assert.doesNotMatch(
  capabilityAuditDiagnosticsModel,
  /new Set<string>\(\['all'\]\)|new Set<CapabilityAuditProfileFilterOption>\(\['all'\]\)|new Set<CapabilityAuditReasonFilterOption>\(\['all'\]\)|CapabilityAuditProfileFilterOptionList = string\[\]|CapabilityAuditReasonFilterOptionList = string\[\]|items\.forEach\(\(item\) => \{[\s\S]*addCapabilityAuditFilterOption\(values, item\.label\);[\s\S]*\}\);/,
  'capability audit diagnostics should not build dynamic filter options as anonymous string sets, inline default sets or raw lists',
);

function createAuditRecord(
  id: number,
  status: CapabilityExecutionAuditStatus,
  capabilityProfile: CapabilityExecutionAuditCapabilityProfile,
  createdAt: CapabilityExecutionAuditCreatedAt,
  executionResult: unknown = {},
): CapabilityExecutionAuditRecord {
  return {
    id,
    project_id: 'project-1',
    workflow_stage: 'implement',
    workflow_mode: 'implement',
    capability_profile: capabilityProfile,
    status,
    execution_result: executionResult,
    source_note: `${status} source note`,
    created_at: createdAt,
  };
}

const blockedRecord = createAuditRecord(
  1,
  'blocked',
  'mcp',
  '2026-07-14T10:00:00Z',
  {
    items: [
      {
        reason_code: 'mcp_endpoint_missing',
        source_note: 'mcp endpoint missing from execution result',
      },
    ],
  },
);
const executedRecord = createAuditRecord(2, 'executed', 'skill', '2026-07-14T11:00:00Z', {
  reason_code: 'skill_executed',
  source_note: 'skill execution completed',
});
const deferredRecord = createAuditRecord(3, 'deferred', '', '2026-07-14T09:00:00Z');
const skippedRecord = createAuditRecord(4, 'skipped', 'mcp', '2026-07-14T08:00:00Z', {
  items: [{ reason_code: 'mcp_skipped' }],
});

assert.equal(
  getCapabilityAuditRecordReason(blockedRecord),
  'mcp_endpoint_missing',
  'capability audit reason should prefer first execution result item reason_code',
);
assert.equal(
  getCapabilityAuditRecordSourceNote(blockedRecord),
  'mcp endpoint missing from execution result',
  'capability audit source note should prefer first execution result item source_note',
);
assert.equal(
  getCapabilityAuditRecordReason(deferredRecord),
  'deferred',
  'capability audit reason should fall back to record status',
);
assert.equal(
  getCapabilityAuditRecordSourceNote({ ...deferredRecord, source_note: '' }),
  '暂无来源说明',
  'capability audit source note should expose a stable fallback',
);

assert.deepEqual(
  deriveCapabilityAuditDiagnosticsSummary([blockedRecord, executedRecord, deferredRecord, skippedRecord], 9),
  {
    loadedRecordCount: 4,
    totalRecordCount: 9,
    statusCounts: {
      blocked: 1,
      executed: 1,
      deferred: 1,
      skipped: 1,
    },
    executedCount: 1,
    blockedCount: 1,
    deferredCount: 1,
    skippedCount: 1,
    unknownCount: 0,
    latestRecord: {
      id: 2,
      status: 'executed',
      reason: 'skill_executed',
      sourceNote: 'skill execution completed',
      createdAt: '2026-07-14T11:00:00Z',
      capabilityProfile: 'skill',
      workflowStage: 'implement',
      workflowMode: 'implement',
    },
    capabilityProfiles: [
      { label: 'mcp', count: 2 },
      { label: 'default-profile', count: 1 },
      { label: 'skill', count: 1 },
    ],
    reasonCodes: [
      { label: 'deferred', count: 1 },
      { label: 'mcp_endpoint_missing', count: 1 },
      { label: 'mcp_skipped', count: 1 },
      { label: 'skill_executed', count: 1 },
    ],
  },
  'capability audit diagnostics should derive status, profile, reason and latest-record summaries',
);

assert.deepEqual(
  deriveCapabilityAuditDiagnosticsSummary([], 0),
  {
    loadedRecordCount: 0,
    totalRecordCount: 0,
    statusCounts: {},
    executedCount: 0,
    blockedCount: 0,
    deferredCount: 0,
    skippedCount: 0,
    unknownCount: 0,
    latestRecord: null,
    capabilityProfiles: [],
    reasonCodes: [],
  },
  'capability audit diagnostics should expose a stable empty state',
);

assert.equal(
  formatCapabilityAuditTime('not-a-date'),
  'not-a-date',
  'capability audit time formatter should preserve invalid timestamps for diagnostics',
);

assert.equal(CAPABILITY_AUDIT_STATUS_QUERY_PARAM, 'capability_status');
assert.equal(CAPABILITY_AUDIT_PROFILE_QUERY_PARAM, 'capability_profile');
assert.equal(CAPABILITY_AUDIT_REASON_QUERY_PARAM, 'capability_reason');
assert.equal(normalizeCapabilityAuditStatusFilter('blocked'), 'blocked');
assert.equal(normalizeCapabilityAuditStatusFilter('invalid'), 'all');
assert.equal(normalizeCapabilityAuditProfileFilter(' implementation-mcp-dry-run-capability-profile '), 'implementation-mcp-dry-run-capability-profile');
assert.equal(normalizeCapabilityAuditProfileFilter(''), 'all');
assert.equal(normalizeCapabilityAuditProfileFilter('   '), 'all');
assert.equal(normalizeCapabilityAuditReasonFilter(' mcp_endpoint_missing '), 'mcp_endpoint_missing');
assert.equal(normalizeCapabilityAuditReasonFilter(''), 'all');
assert.equal(normalizeCapabilityAuditReasonFilter('   '), 'all');
assert.equal(
  updateCapabilityAuditStatusSearch('?foo=bar&capability_profile=mcp', 'blocked'),
  '?foo=bar&capability_profile=mcp&capability_status=blocked',
  'capability audit status filter should update URL search',
);
assert.equal(
  updateCapabilityAuditStatusSearch('?foo=bar&capability_status=blocked', 'all'),
  '?foo=bar',
  'capability audit all status should clear status query',
);
assert.equal(
  updateCapabilityAuditProfileSearch('?capability_status=blocked', 'mcp'),
  '?capability_status=blocked&capability_profile=mcp',
  'capability audit profile filter should update URL search',
);
assert.equal(
  updateCapabilityAuditReasonSearch('?capability_status=blocked&capability_profile=mcp', 'mcp_endpoint_missing'),
  '?capability_status=blocked&capability_profile=mcp&capability_reason=mcp_endpoint_missing',
  'capability audit reason filter should update URL search',
);
assert.equal(
  clearCapabilityAuditFilterSearch('?capability_status=blocked&capability_profile=mcp&capability_reason=mcp_endpoint_missing&foo=bar'),
  '?foo=bar',
  'capability audit clear filters should preserve unrelated search params',
);
assert.deepEqual(
  buildCapabilityAuditProfileFilterOptions(
    [
      { label: 'mcp', count: 2 },
      { label: 'skill', count: 1 },
      { label: ' ', count: 1 },
    ],
    'runtime-profile',
  ),
  ['all', 'runtime-profile', 'mcp', 'skill'],
  'capability audit profile filter options should retain current URL drilldown and named distribution options',
);
assert.deepEqual(
  buildCapabilityAuditReasonFilterOptions(
    [
      { label: 'mcp_endpoint_missing', count: 2 },
      { label: 'mcp_skipped', count: 1 },
      { label: 'mcp_endpoint_missing', count: 1 },
    ],
    'all',
  ),
  ['all', 'mcp_endpoint_missing', 'mcp_skipped'],
  'capability audit reason filter options should expose a stable deduplicated option list',
);
assert.deepEqual(
  deriveCapabilityAuditActiveFilterSummary({
    statusFilter: 'blocked',
    profileFilter: 'mcp',
    reasonFilter: 'mcp_endpoint_missing',
    matchedRecordCount: 1,
    loadedRecordCount: 2,
    totalRecordCount: 9,
  }),
  {
    activeFilterCount: 3,
    sourceContextCount: 0,
    statusFilter: 'blocked',
    profileFilter: 'mcp',
    reasonFilter: 'mcp_endpoint_missing',
    matchedRecordCount: 1,
    loadedRecordCount: 2,
    totalRecordCount: 9,
    matchSummary: '命中 1 / 已加载 2 / 总计 9',
    sourceSummary: '无外部诊断来源',
    activeLabels: ['status=blocked', 'profile=mcp', 'reason=mcp_endpoint_missing'],
    runtimeSourceLabels: [],
  },
  'capability audit active filter summary should expose stable labels and match counts',
);
assert.deepEqual(
  deriveCapabilityAuditActiveFilterSummary({
    statusFilter: 'blocked',
    profileFilter: 'all',
    reasonFilter: 'all',
    runtimeSourceLabels: ['runtime_project=project-1', ' runtime_reason=runtime_readiness_failed ', ''],
    matchedRecordCount: 1,
    loadedRecordCount: 1,
    totalRecordCount: 1,
  }),
  {
    activeFilterCount: 1,
    sourceContextCount: 2,
    statusFilter: 'blocked',
    profileFilter: 'all',
    reasonFilter: 'all',
    matchedRecordCount: 1,
    loadedRecordCount: 1,
    totalRecordCount: 1,
    matchSummary: '命中 1 / 已加载 1 / 总计 1',
    sourceSummary: '来源 runtime_project=project-1 / runtime_reason=runtime_readiness_failed',
    activeLabels: ['status=blocked'],
    runtimeSourceLabels: ['runtime_project=project-1', 'runtime_reason=runtime_readiness_failed'],
  },
  'capability audit active filter summary should carry runtime diagnostic source context without counting it as a filter',
);

const implementationFailureEffects = fs.readFileSync('src/app/workspace/workspace-implementation-failure-effects.ts', 'utf8');
assert.match(
  implementationFailureEffects,
  /CAPABILITY_AUDIT_STATUS_QUERY_PARAM/,
  'capability execution blocked recovery message should reuse capability audit status query constant',
);
assert.match(
  implementationFailureEffects,
  /CAPABILITY_AUDIT_PROFILE_QUERY_PARAM/,
  'capability execution blocked recovery message should mention capability audit profile query when available',
);
assert.match(
  implementationFailureEffects,
  /CAPABILITY_AUDIT_REASON_QUERY_PARAM/,
  'capability execution blocked recovery message should mention capability audit reason query when available',
);
assert.match(
  implementationFailureEffects,
  /Capability 审计/,
  'capability execution blocked recovery message should point users to Capability Audit diagnostics',
);
assert.match(
  implementationFailureEffects,
  /getBlockedCapabilityResultLines/,
  'capability execution blocked recovery message should summarize blocked capability result items',
);
assert.match(
  implementationFailureEffects,
  /open_capability_audit/,
  'capability execution blocked recovery message should expose an executable capability audit action',
);
assert.match(
  implementationFailureEffects,
  /getBlockedCapabilityAuditProfile/,
  'capability execution blocked action should derive the audit profile from execution_result',
);
assert.match(
  implementationFailureEffects,
  /getBlockedCapabilityAuditReason/,
  'capability execution blocked action should derive the audit reason from execution_result',
);
assert.match(
  implementationFailureEffects,
  /capabilityAuditProfile: getBlockedCapabilityAuditProfile\(executionResult\)/,
  'capability execution blocked action should carry capabilityAuditProfile for URL drilldown',
);
assert.match(
  implementationFailureEffects,
  /capabilityAuditReasonCode: getBlockedCapabilityAuditReason\(executionResult\)/,
  'capability execution blocked action should carry capabilityAuditReasonCode for URL drilldown',
);

const workspaceTypes = fs.readFileSync('src/app/workspace/workspace-types.ts', 'utf8');
assert.match(
  workspaceTypes,
  /'open_capability_audit'/,
  'workspace guidance action kinds should include the capability audit action',
);

const chatMessageContent = fs.readFileSync('src/components/workspace/chat-message-content.tsx', 'utf8');
assert.match(
  chatMessageContent,
  /GuidanceAction/,
  'shared chat message guidance action type should reuse the workspace GuidanceAction type',
);
assert.match(
  chatMessageContent,
  /export type WorkspaceGuidanceAction = GuidanceAction/,
  'shared chat message guidance action alias should not duplicate action kind unions',
);
assert.doesNotMatch(
  chatMessageContent,
  /kind:\s*"send_prompt"\s*\|/,
  'shared chat message guidance action type should not maintain a separate action kind union',
);

const promptActions = fs.readFileSync('src/app/workspace/use-workspace-prompt-actions.ts', 'utf8');
const capabilityAuditLocalErrors = fs.readFileSync('src/lib/workspace/capability-audit-local-errors.ts', 'utf8');
assert.match(
  capabilityAuditLocalErrors,
  /export type CapabilityAuditLocalErrorSource = 'browser_history' \| 'clipboard';[\s\S]*export type CapabilityAuditLocalErrorDetails = string;[\s\S]*export function formatCapabilityAuditLocalError\([\s\S]*source: CapabilityAuditLocalErrorSource[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source,[\s\S]*details,[\s\S]*\}, fallback\)/,
  'capability audit local errors should share browser_history/clipboard source formatting through one helper',
);
assert.match(
  capabilityAuditLocalErrors,
  /const capabilityAuditMissingClipboardMessage: CapabilityAuditLocalErrorDetails[\s\S]*const capabilityAuditMissingClipboardDetails: CapabilityAuditLocalErrorDetails/,
  'capability audit missing clipboard message/details should consume the named details contract',
);
assert.match(
  capabilityAuditLocalErrors,
  /export function formatCapabilityAuditLocalError\([\s\S]*fallback: CapabilityAuditLocalErrorDetails,[\s\S]*source: CapabilityAuditLocalErrorSource/,
  'capability audit local error formatter should consume named fallback/details and source contracts',
);
assert.doesNotMatch(
  capabilityAuditLocalErrors,
  /(?:^|\n)type CapabilityAuditLocalErrorSource = 'browser_history' \| 'clipboard';|fallback: string/,
  'capability audit local errors should not regress to a local non-exported source type or raw fallback string',
);
assert.match(
  capabilityAuditLocalErrors,
  /export function formatCapabilityAuditMissingClipboardError\(\)[\s\S]*source: 'clipboard' satisfies CapabilityAuditLocalErrorSource[\s\S]*details: capabilityAuditMissingClipboardDetails[\s\S]*capabilityAuditMissingClipboardMessage/,
  'capability audit local errors should share missing clipboard support formatting',
);
assert.match(
  promptActions,
  /updateCapabilityAuditStatusSearch\(window\.location\.search, 'blocked'\)/,
  'capability audit action should reuse the shared blocked status search helper',
);
assert.match(
  promptActions,
  /updateCapabilityAuditProfileSearch\(blockedSearch, action\.capabilityAuditProfile\)/,
  'capability audit action should preserve the blocked filter and add profile drilldown when provided',
);
assert.match(
  promptActions,
  /updateCapabilityAuditReasonSearch\(profileSearch, action\.capabilityAuditReasonCode\)/,
  'capability audit action should preserve status/profile filters and add reason drilldown when provided',
);
assert.match(
  promptActions,
  /try \{[\s\S]*window\.history\.replaceState\(window\.history\.state, '', nextUrl\);[\s\S]*\} catch \(error\) \{[\s\S]*formatCapabilityAuditLocalError\(error, '浏览器拒绝更新地址栏', 'browser_history'\)[\s\S]*Capability Audit 定位参数写入失败：[\s\S]*地址栏未写入 blocked\/profile\/reason 定位参数[\s\S]*请在面板内手动选择 blocked、Profile 或 Reason 筛选继续排查/,
  'capability audit action should surface URL drilldown sync failures through the shared browser_history formatter when opening the audit panel',
);
assert.match(
  promptActions,
  /onOpenCapabilityAudit\(\)/,
  'capability audit action should call the injected UI navigation callback',
);

const capabilityAuditPanel = fs.readFileSync('src/app/workspace/workspace-capability-audit-panel.tsx', 'utf8');
const desktopDebugPanel = fs.readFileSync('src/app/workspace/workspace-ide-desktop-debug-panel.tsx', 'utf8');
const debugPanelContextSnapshot = fs.readFileSync('src/app/workspace/workspace-debug-panel-context-snapshot.ts', 'utf8');
const mobileDebugPanel = fs.readFileSync('src/app/workspace/workspace-ide-mobile-debug-panel.tsx', 'utf8');
const capabilityAuditOperationErrors = fs.readFileSync('src/lib/workspace/capability-audit-operation-errors.ts', 'utf8');
assert.match(
  capabilityAuditPanel,
  /CAPABILITY_AUDIT_REASON_QUERY_PARAM/,
  'workspace capability audit panel should read capability_reason from URL query',
);
assert.match(
  capabilityAuditPanel,
  /normalizeCapabilityAuditReasonFilter/,
  'workspace capability audit panel should normalize reason URL filters through the shared model',
);
assert.match(
  capabilityAuditPanel,
  /updateCapabilityAuditReasonSearch/,
  'workspace capability audit panel should write reason URL filters through the shared model',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelVisibleRecords\(\{[\s\S]*records,[\s\S]*reasonFilter,[\s\S]*\}: \{[\s\S]*records: CapabilityExecutionAuditRecord\[\];[\s\S]*reasonFilter: CapabilityAuditReasonFilter;[\s\S]*\}\): CapabilityExecutionAuditRecord\[\][\s\S]*if \(reasonFilter === 'all'\)[\s\S]*return records;[\s\S]*const visibleRecords: CapabilityExecutionAuditRecord\[\] = \[\];[\s\S]*for \(const record of records\)[\s\S]*const recordReason = getCapabilityAuditRecordReason\(record\);[\s\S]*if \(recordReason === reasonFilter\)[\s\S]*visibleRecords\.push\(record\);[\s\S]*return visibleRecords;[\s\S]*const visibleRecords = useMemo\(\(\) => \([\s\S]*getCapabilityAuditPanelVisibleRecords\(\{[\s\S]*records,[\s\S]*reasonFilter,[\s\S]*\}\)/,
  'workspace capability audit panel should apply reason drilldown to the loaded read-only audit snapshot',
);
assert.match(
  capabilityAuditPanel,
  /matchedRecordCount: visibleRecords\.length/,
  'workspace capability audit panel should pass matched count into the shared active filter summary',
);
assert.match(
  capabilityAuditPanel,
  /loadedRecordCount: records\.length/,
  'workspace capability audit panel should pass loaded count into the shared active filter summary',
);
assert.match(
  capabilityAuditPanel,
  /activeFilterSummary\.matchSummary/,
  'workspace capability audit panel should render the active filter match summary',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelRuntimeSourceLabels\([\s\S]*runtimeDiagnosticContext: RuntimeHealthDiagnosticContext \| null,[\s\S]*\): CapabilityAuditRuntimeSourceLabelList \| undefined \{[\s\S]*const hasRuntimeDiagnosticContext = hasCapabilityAuditPanelRuntimeDiagnosticContext\(runtimeDiagnosticContext\);[\s\S]*if \(hasRuntimeDiagnosticContext === false\) \{[\s\S]*return undefined;[\s\S]*return runtimeDiagnosticContext\.activeLabels;[\s\S]*const runtimeSourceLabels = useMemo\(\(\) => \([\s\S]*getCapabilityAuditPanelRuntimeSourceLabels\(runtimeDiagnosticContext\)[\s\S]*runtimeSourceLabels,/,
  'workspace capability audit panel should pass runtime source context into the active filter summary through an explicit reader',
);
assert.match(
  capabilityAuditPanel,
  /activeFilterSummary\.sourceSummary/,
  'workspace capability audit panel should render the runtime source summary beside filter impact',
);
assert.match(
  capabilityAuditPanel,
  /activeFilterSummary\.runtimeSourceLabels\.join/,
  'workspace capability audit panel should render runtime source labels from the shared active filter summary',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelRootPaddingClassName\(compact: boolean\): string[\s\S]*function getCapabilityAuditPanelTitleTextClassName\(compact: boolean\): string[\s\S]*function getCapabilityAuditPanelDescriptionTextClassName\(compact: boolean\): string[\s\S]*function getCapabilityAuditPanelActionSize\(compact: boolean\): 'sm' \| 'default'[\s\S]*function getCapabilityAuditPanelFilterOptionLabel\(\{[\s\S]*option,[\s\S]*fallbackLabel,[\s\S]*\}: \{[\s\S]*option: string;[\s\S]*fallbackLabel: string;[\s\S]*\}\): string[\s\S]*function getCapabilityAuditPanelDiagnosticLinkCopyLabel\(diagnosticLinkCopied: boolean\): string[\s\S]*function getCapabilityAuditPanelActiveFilterLabel\(activeLabels: string\[\]\): string[\s\S]*function getCapabilityAuditPanelDistributionLabel\(items: CapabilityAuditDistributionItemList\): string \{[\s\S]*for \(const item of items\) \{[\s\S]*const itemLabel = `\$\{item\.label\} \(\$\{item\.count\}\)`;[\s\S]*const rootPaddingClassName = getCapabilityAuditPanelRootPaddingClassName\(compact\);[\s\S]*const titleTextClassName = getCapabilityAuditPanelTitleTextClassName\(compact\);[\s\S]*const descriptionTextClassName = getCapabilityAuditPanelDescriptionTextClassName\(compact\);[\s\S]*const refreshActionSize = getCapabilityAuditPanelActionSize\(compact\);[\s\S]*const diagnosticLinkCopyLabel = getCapabilityAuditPanelDiagnosticLinkCopyLabel\(diagnosticLinkCopied\);[\s\S]*const activeFilterLabel = getCapabilityAuditPanelActiveFilterLabel\(activeFilterSummary\.activeLabels\);[\s\S]*const profileDistributionLabel = getCapabilityAuditPanelDistributionLabel\(diagnosticsSummary\.capabilityProfiles\);[\s\S]*const reasonDistributionLabel = getCapabilityAuditPanelDistributionLabel\(diagnosticsSummary\.reasonCodes\);/,
  'workspace capability audit panel should derive compact styles, option labels, copy label, active filter label and distribution labels through named display readers',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelSyncedSearchLabel\(nextSearch: string\): string \{[\s\S]*const hasNextSearch = hasCapabilityAuditPanelTextValue\(nextSearch\);[\s\S]*if \(hasNextSearch === false\) \{[\s\S]*return '无筛选参数';[\s\S]*return nextSearch;[\s\S]*const syncedSearchLabel = getCapabilityAuditPanelSyncedSearchLabel\(nextSearch\);[\s\S]*`Capability Audit 筛选已同步到地址栏：\$\{syncedSearchLabel\}。`/,
  'workspace capability audit panel should derive URL sync search display text through a named reader',
);
assert.match(
  capabilityAuditPanel,
  /function canClearCapabilityAuditPanelFilters\(\{[\s\S]*activeFilterCount,[\s\S]*runtimeDiagnosticContext,[\s\S]*\}: \{[\s\S]*activeFilterCount: number;[\s\S]*runtimeDiagnosticContext: RuntimeHealthDiagnosticContext \| null;[\s\S]*\}\): boolean \{[\s\S]*const hasActiveFilters = hasCapabilityAuditPanelActiveFilters\(activeFilterCount\);[\s\S]*const hasRuntimeDiagnosticContext = hasCapabilityAuditPanelRuntimeDiagnosticContext\(runtimeDiagnosticContext\);[\s\S]*return hasActiveFilters === true \|\| hasRuntimeDiagnosticContext === true;[\s\S]*const canClearFilters = canClearCapabilityAuditPanelFilters\(\{[\s\S]*activeFilterCount: activeFilterSummary\.activeFilterCount,[\s\S]*runtimeDiagnosticContext,[\s\S]*\}\);[\s\S]*disabled=\{canClearFilters === false\}/,
  'workspace capability audit panel should derive clear-filter capability through an explicit local gate',
);
assert.match(
  capabilityAuditPanel,
  /type CapabilityAuditPanelSnapshotStatusList = CapabilityAuditPanelSnapshotStatus\[\];[\s\S]*const CAPABILITY_AUDIT_PANEL_ERROR_SNAPSHOT_STATUSES: CapabilityAuditPanelSnapshotStatusList = \[[\s\S]*'load_failed',[\s\S]*'filter_url_stale',[\s\S]*'link_copy_failed',[\s\S]*\];[\s\S]*const CAPABILITY_AUDIT_PANEL_SUCCESS_SNAPSHOT_STATUSES: CapabilityAuditPanelSnapshotStatusList = \[[\s\S]*'ready',[\s\S]*'filter_url_synced',[\s\S]*'link_copied',[\s\S]*\];[\s\S]*function isCapabilityAuditPanelSnapshotStatusIn\([\s\S]*status: CapabilityAuditPanelSnapshotStatus,[\s\S]*statuses: CapabilityAuditPanelSnapshotStatusList,[\s\S]*\): boolean \{[\s\S]*for \(const candidateStatus of statuses\) \{[\s\S]*if \(candidateStatus === status\) \{[\s\S]*return true;[\s\S]*function isCapabilityAuditPanelErrorSnapshot\(snapshot: CapabilityAuditPanelSnapshot\): boolean \{[\s\S]*CAPABILITY_AUDIT_PANEL_ERROR_SNAPSHOT_STATUSES[\s\S]*function isCapabilityAuditPanelSuccessSnapshot\(snapshot: CapabilityAuditPanelSnapshot\): boolean \{[\s\S]*CAPABILITY_AUDIT_PANEL_SUCCESS_SNAPSHOT_STATUSES[\s\S]*const isErrorSnapshot = isCapabilityAuditPanelErrorSnapshot\(snapshot\);[\s\S]*if \(isErrorSnapshot === true\)[\s\S]*const isSuccessSnapshot = isCapabilityAuditPanelSuccessSnapshot\(snapshot\);[\s\S]*if \(isSuccessSnapshot === true\)/,
  'workspace capability audit panel should derive snapshot tone class through explicit status membership scans',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelQueryStatusFilter\([\s\S]*statusFilter: CapabilityAuditStatusFilter,[\s\S]*\): CapabilityAuditStatusFilter \| undefined \{[\s\S]*if \(statusFilter === 'all'\) \{[\s\S]*return undefined;[\s\S]*return statusFilter;[\s\S]*function getCapabilityAuditPanelQueryProfileFilter\([\s\S]*profileFilter: CapabilityAuditProfileFilter,[\s\S]*\): CapabilityAuditProfileFilter \| undefined \{[\s\S]*if \(profileFilter === 'all'\) \{[\s\S]*return undefined;[\s\S]*return profileFilter;[\s\S]*status: getCapabilityAuditPanelQueryStatusFilter\(statusFilter\),[\s\S]*capabilityProfile: getCapabilityAuditPanelQueryProfileFilter\(profileFilter\),/,
  'workspace capability audit panel should derive audit request filter params through explicit query readers',
);
assert.match(
  capabilityAuditPanel,
  /function isCapabilityAuditPanelLoading\(loadState: LoadState\): boolean \{[\s\S]*return isCapabilityAuditPanelLoadState\(loadState, 'loading'\);[\s\S]*function canRefreshCapabilityAuditPanel\(\{[\s\S]*hasCapabilityAuditProjectId,[\s\S]*loadState,[\s\S]*\}: \{[\s\S]*hasCapabilityAuditProjectId: boolean;[\s\S]*loadState: LoadState;[\s\S]*\}\): boolean \{[\s\S]*const isLoading = isCapabilityAuditPanelLoading\(loadState\);[\s\S]*return hasCapabilityAuditProjectId === true && isLoading === false;[\s\S]*const canRefreshCapabilityAudit = canRefreshCapabilityAuditPanel\(\{[\s\S]*hasCapabilityAuditProjectId,[\s\S]*loadState,[\s\S]*\}\);[\s\S]*disabled=\{canRefreshCapabilityAudit === false\}/,
  'workspace capability audit panel should derive refresh capability through an explicit local gate',
);
assert.match(
  capabilityAuditPanel,
  /type CapabilityAuditPanelOptionNodeList = ReactNode\[\];[\s\S]*type CapabilityAuditPanelRecordNodeList = ReactNode\[\];[\s\S]*function getCapabilityAuditPanelOptionNodes\(\{[\s\S]*options,[\s\S]*fallbackLabel,[\s\S]*\}: \{[\s\S]*options: string\[\];[\s\S]*fallbackLabel: string;[\s\S]*\}\): CapabilityAuditPanelOptionNodeList \{[\s\S]*const optionNodes: CapabilityAuditPanelOptionNodeList = \[\];[\s\S]*for \(const option of options\) \{[\s\S]*optionNodes\.push\([\s\S]*<option key=\{option\} value=\{option\}>[\s\S]*getCapabilityAuditPanelFilterOptionLabel\(\{ option, fallbackLabel \}\)[\s\S]*return optionNodes;[\s\S]*function getCapabilityAuditPanelRecordNodes\(records: CapabilityExecutionAuditRecord\[\]\): CapabilityAuditPanelRecordNodeList \{[\s\S]*const recordNodes: CapabilityAuditPanelRecordNodeList = \[\];[\s\S]*for \(const record of records\) \{[\s\S]*const statusLabel = getCapabilityAuditRecordStatusLabel\(record\);[\s\S]*const capabilityProfileLabel = getCapabilityAuditRecordProfileLabel\(record\);[\s\S]*recordNodes\.push\([\s\S]*<Badge variant=\{getStatusBadgeVariant\(statusLabel\)\}>\{statusLabel\}<\/Badge>[\s\S]*return recordNodes;[\s\S]*const statusOptionNodes = getCapabilityAuditPanelOptionNodes\(\{[\s\S]*options: capabilityAuditStatusOptions,[\s\S]*fallbackLabel: '全部状态',[\s\S]*\}\);[\s\S]*const profileOptionNodes = getCapabilityAuditPanelOptionNodes\(\{[\s\S]*options: profileOptions,[\s\S]*fallbackLabel: '全部 Profile',[\s\S]*\}\);[\s\S]*const reasonOptionNodes = getCapabilityAuditPanelOptionNodes\(\{[\s\S]*options: reasonOptions,[\s\S]*fallbackLabel: '全部 Reason',[\s\S]*\}\);[\s\S]*const recordNodes = getCapabilityAuditPanelRecordNodes\(visibleRecords\);/,
  'workspace capability audit panel should materialize option and record JSX nodes through explicit for-of materializers',
);
assert.match(
  capabilityAuditPanel,
  /buildCapabilityAuditProfileFilterOptions\([\s\S]*loadedDiagnosticsSummary\.capabilityProfiles,[\s\S]*profileFilter,[\s\S]*\)/,
  'workspace capability audit panel should build Profile filter options through the shared named option contract',
);
assert.match(
  capabilityAuditPanel,
  /buildCapabilityAuditReasonFilterOptions\([\s\S]*loadedDiagnosticsSummary\.reasonCodes,[\s\S]*reasonFilter,[\s\S]*\)/,
  'workspace capability audit panel should build Reason filter options through the shared named option contract',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /new Set<string>\(\['all'\]\)|reasonFilter === 'all'\s*\?\s*records\s*:\s*records\.filter|compact \? 'p-3' : 'p-5'|compact \? 'text-sm' : 'text-base'|compact \? 'text-xs' : 'text-sm'|size=\{compact \? 'sm' : 'default'\}|option === 'all' \? '全部状态' : option|option === 'all' \? '全部 Profile' : option|option === 'all' \? '全部 Reason' : option|diagnosticLinkCopied \? '已复制链接' : '复制诊断链接'|activeFilterSummary\.activeLabels\.length > 0 \? activeFilterSummary\.activeLabels\.join\(' \/ '\) : '全部记录'|diagnosticsSummary\.capabilityProfiles\.map\(\(item\) => `\$\{item\.label\} \(\$\{item\.count\}\)`\)\.join\(', '\)|diagnosticsSummary\.reasonCodes\.map\(\(item\) => `\$\{item\.label\} \(\$\{item\.count\}\)`\)\.join\(', '\)|capabilityAuditStatusOptions\.map|profileOptions\.map|reasonOptions\.map|visibleRecords\.map|nextSearch \|\| '无筛选参数'|activeFilterSummary\.activeFilterCount === 0 && !runtimeDiagnosticContext|snapshot\.status === 'load_failed'|snapshot\.status === 'filter_url_stale'|snapshot\.status === 'link_copy_failed'|snapshot\.status === 'ready'|snapshot\.status === 'filter_url_synced'|snapshot\.status === 'link_copied'|statusFilter === 'all' \? undefined : statusFilter|profileFilter === 'all' \? undefined : profileFilter|hasCapabilityAuditProjectId === true && loadState !== 'loading'/,
  'workspace capability audit panel should not build dynamic filter options with anonymous string sets or regress visible filter/compact/copy/distribution/option/list/snapshot/query labels to inline gates',
);
assert.match(
  capabilityAuditOperationErrors,
  /export function formatCapabilityAuditLoadFailure\([\s\S]*formatUserVisibleApiError\(error, '能力审计加载失败'\)/,
  'workspace capability audit operation helper should preserve structured source/details when audit loading fails',
);
assert.match(
  capabilityAuditPanel,
  /const failureMessage = formatCapabilityAuditLoadFailure\(err\);[\s\S]*setError\(failureMessage\);[\s\S]*updatePanelSnapshot\([\s\S]*'load_failed'[\s\S]*`Capability Audit 加载失败：\$\{failureMessage\}`/,
  'workspace capability audit panel should use the shared audit load formatter for both inline error and panel snapshot',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /setError\(formatUserVisibleApiError\(err, '能力审计加载失败'\)\)/,
  'workspace capability audit panel should not format audit loading source/details locally',
);
assert.match(
  capabilityAuditPanel,
  /const \[diagnosticLinkCopyError, setDiagnosticLinkCopyError\] = useState\(''\);/,
  'workspace capability audit panel should keep user-visible diagnostic link copy failure state',
);
assert.match(
  workspaceTypes,
  /export type CapabilityAuditPanelSnapshotStatus = 'idle_without_project' \| 'loading' \| 'ready' \| 'load_failed' \| 'filter_url_synced' \| 'filter_url_stale' \| 'link_copied' \| 'link_copy_failed';[\s\S]*export type CapabilityAuditPanelSnapshotSource = 'project_binding' \| 'audit_load' \| 'browser_history' \| 'clipboard';[\s\S]*export type CapabilityAuditPanelSnapshot = \{[\s\S]*status: CapabilityAuditPanelSnapshotStatus;[\s\S]*source: CapabilityAuditPanelSnapshotSource;[\s\S]*recovery: string;[\s\S]*updatedAt: string;[\s\S]*\};/,
  'workspace types should model Capability Audit panel operations as a structured snapshot',
);
assert.match(
  capabilityAuditPanel,
  /import type \{[\s\S]*CapabilityAuditPanelSnapshot,[\s\S]*CapabilityAuditPanelSnapshotSource,[\s\S]*CapabilityAuditPanelSnapshotStatus,[\s\S]*\} from '\.\/workspace-types';/,
  'workspace capability audit panel should consume the shared Capability Audit panel snapshot types',
);
assert.match(
  capabilityAuditPanel,
  /import \{[\s\S]*type CapabilityExecutionAuditRecord,[\s\S]*type CapabilityExecutionAuditStatus,[\s\S]*\} from '@\/lib\/api';[\s\S]*function hasCapabilityAuditPanelTextValue\(value: string \| null \| undefined\): value is string[\s\S]*const hasValue = value\.length > 0;[\s\S]*return hasValue === true;[\s\S]*function getCapabilityAuditRecordStatusLabel\(record: CapabilityExecutionAuditRecord\): CapabilityExecutionAuditStatus \| 'unknown' \{[\s\S]*const status = record\.status;[\s\S]*const hasStatus = hasCapabilityAuditPanelTextValue\(status\);[\s\S]*hasStatus === false[\s\S]*return 'unknown';[\s\S]*return status;[\s\S]*const statusLabel = getCapabilityAuditRecordStatusLabel\(record\);[\s\S]*<Badge variant=\{getStatusBadgeVariant\(statusLabel\)\}>\{statusLabel\}<\/Badge>/,
  'workspace capability audit panel should derive record status badge labels through an explicit display fact',
);
assert.match(
  capabilityAuditPanel,
  /import \{[\s\S]*type CapabilityExecutionAuditCapabilityProfile,[\s\S]*type CapabilityExecutionAuditWorkflowMode,[\s\S]*type CapabilityExecutionAuditWorkflowStage,[\s\S]*\} from '@\/lib\/api';[\s\S]*function getCapabilityAuditRecordProfileLabel\(record: CapabilityExecutionAuditRecord\): CapabilityExecutionAuditCapabilityProfile \| 'default-profile' \{[\s\S]*const capabilityProfile = record\.capability_profile;[\s\S]*const hasCapabilityProfile = hasCapabilityAuditPanelTextValue\(capabilityProfile\);[\s\S]*hasCapabilityProfile === false[\s\S]*return 'default-profile';[\s\S]*return capabilityProfile;[\s\S]*function getCapabilityAuditRecordWorkflowStageLabel\(record: CapabilityExecutionAuditRecord\): CapabilityExecutionAuditWorkflowStage \| 'unknown-stage' \{[\s\S]*const workflowStage = record\.workflow_stage;[\s\S]*const hasWorkflowStage = hasCapabilityAuditPanelTextValue\(workflowStage\);[\s\S]*hasWorkflowStage === false[\s\S]*return 'unknown-stage';[\s\S]*return workflowStage;[\s\S]*function getCapabilityAuditRecordWorkflowModeLabel\(record: CapabilityExecutionAuditRecord\): CapabilityExecutionAuditWorkflowMode \| 'unknown-mode' \{[\s\S]*const workflowMode = record\.workflow_mode;[\s\S]*const hasWorkflowMode = hasCapabilityAuditPanelTextValue\(workflowMode\);[\s\S]*hasWorkflowMode === false[\s\S]*return 'unknown-mode';[\s\S]*return workflowMode;[\s\S]*const capabilityProfileLabel = getCapabilityAuditRecordProfileLabel\(record\);[\s\S]*const workflowStageLabel = getCapabilityAuditRecordWorkflowStageLabel\(record\);[\s\S]*const workflowModeLabel = getCapabilityAuditRecordWorkflowModeLabel\(record\);[\s\S]*\{capabilityProfileLabel\}[\s\S]*\{workflowStageLabel\}[\s\S]*\{workflowModeLabel\}/,
  'workspace capability audit panel should derive record profile, workflow stage and workflow mode labels through explicit display facts',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /type CapabilityAuditPanelSnapshot = \{/,
  'workspace capability audit panel should not keep a local CapabilityAuditPanelSnapshot type',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /record\.status \|\| 'unknown'|record\.capability_profile \|\| 'default-profile'|record\.workflow_stage \|\| 'unknown-stage'|record\.workflow_mode \|\| 'unknown-mode'|<Badge[^>]*getStatusBadgeVariant\(record\.status\)[\s\S]*record\.status|status !== undefined && status\.length > 0|capabilityProfile !== undefined && capabilityProfile\.length > 0|workflowStage !== undefined && workflowStage\.length > 0|workflowMode !== undefined && workflowMode\.length > 0/,
  'workspace capability audit panel should not regress record status/profile/stage/mode display to inline OR fallback',
);
assert.match(
  capabilityAuditPanel,
  /const \[panelSnapshot, setPanelSnapshot\] = useState<CapabilityAuditPanelSnapshot>[\s\S]*const updatePanelSnapshot = useCallback\(\([\s\S]*status: CapabilityAuditPanelSnapshotStatus,[\s\S]*source: CapabilityAuditPanelSnapshotSource,/,
  'workspace capability audit panel should store and update the structured operation snapshot with named status/source contracts',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /CapabilityAuditPanelSnapshot\['status'\]|CapabilityAuditPanelSnapshot\['source'\]/,
  'workspace capability audit panel should not infer status/source from indexed snapshot access',
);
assert.match(
  capabilityAuditPanel,
  /const \[diagnosticUrlSyncError, setDiagnosticUrlSyncError\] = useState\(''\);[\s\S]*const replaceUrlSearch = useCallback\(\(nextSearch: string\) => \{[\s\S]*window\.history\.replaceState\(window\.history\.state, '', nextUrl\);[\s\S]*setDiagnosticUrlSyncError\(''\);[\s\S]*catch \(error\) \{[\s\S]*formatCapabilityAuditLocalError\(error, '浏览器拒绝更新地址栏', 'browser_history'\)[\s\S]*Capability Audit 筛选地址栏同步失败：[\s\S]*当前筛选已在面板内生效，但地址栏和复制的诊断链接可能仍是旧状态/,
  'workspace capability audit panel should surface URL filter sync failures and stale diagnostic link risk through the shared browser_history formatter',
);
assert.match(
  capabilityAuditPanel,
  /updatePanelSnapshot\([\s\S]*'filter_url_synced'[\s\S]*'browser_history'[\s\S]*updatePanelSnapshot\([\s\S]*'filter_url_stale'[\s\S]*'browser_history'/,
  'workspace capability audit panel should mark URL filter sync success and stale URL failures in the panel snapshot',
);
assert.match(
  capabilityAuditPanel,
  /!navigator\.clipboard[\s\S]*formatCapabilityAuditMissingClipboardError\(\)[\s\S]*复制诊断链接失败：\$\{reason\}，当前诊断链接没有写入系统剪贴板/,
  'workspace capability audit panel should surface missing clipboard support through the shared clipboard formatter when copying diagnostic links',
);
assert.match(
  capabilityAuditPanel,
  /catch \(error\) \{[\s\S]*formatCapabilityAuditLocalError\(error, '浏览器拒绝了剪贴板访问', 'clipboard'\)[\s\S]*复制诊断链接失败：\$\{reason\}。当前诊断链接没有写入系统剪贴板；你可以手动复制地址栏链接。/,
  'workspace capability audit panel should surface clipboard write failures through the shared clipboard formatter for diagnostic links',
);
assert.match(
  capabilityAuditPanel,
  /updatePanelSnapshot\([\s\S]*'link_copy_failed'[\s\S]*'clipboard'[\s\S]*updatePanelSnapshot\([\s\S]*'link_copied'[\s\S]*'clipboard'/,
  'workspace capability audit panel should mark diagnostic link copy success and clipboard failures in the panel snapshot',
);
assert.match(
  capabilityAuditPanel,
  /updatePanelSnapshot\([\s\S]*'idle_without_project'[\s\S]*'project_binding'[\s\S]*updatePanelSnapshot\([\s\S]*'loading'[\s\S]*'audit_load'[\s\S]*updatePanelSnapshot\([\s\S]*'ready'[\s\S]*'audit_load'[\s\S]*updatePanelSnapshot\([\s\S]*'load_failed'[\s\S]*'audit_load'/,
  'workspace capability audit panel should mark project binding and audit loading phases in the panel snapshot',
);
assert.match(
  capabilityAuditPanel,
  /(?=[\s\S]*type CapabilityExecutionAuditListResponse)(?=[\s\S]*function getCapabilityAuditPanelResponseRecords\([\s\S]*result: CapabilityExecutionAuditListResponse,[\s\S]*\): CapabilityExecutionAuditRecord\[\][\s\S]*return result\.records;)(?=[\s\S]*function getCapabilityAuditPanelResponseTotal\(result: CapabilityExecutionAuditListResponse\): number[\s\S]*return result\.total;)(?=[\s\S]*const nextRecords = getCapabilityAuditPanelResponseRecords\(result\);)(?=[\s\S]*const nextTotal = getCapabilityAuditPanelResponseTotal\(result\);)(?=[\s\S]*setRecords\(nextRecords\);)(?=[\s\S]*setTotal\(nextTotal\);)(?=[\s\S]*Capability Audit 已加载 \$\{nextRecords\.length\} 条可见记录，后端总数 \$\{nextTotal\}。)/,
  'workspace capability audit panel should consume audit list records and totals through explicit response readers',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /result\.records \|\| \[\]|result\.total \|\| 0|result\.records\?\.length \|\| 0/,
  'workspace capability audit panel should not regress to OR fallback for audit list response records or totals',
);
assert.match(
  capabilityAuditPanel,
  /function isCapabilityAuditPanelEffectActive\(cancelled: boolean\): boolean \{[\s\S]*return cancelled === false;[\s\S]*\.then\(\(result\) => \{[\s\S]*if \(isCapabilityAuditPanelEffectActive\(cancelled\) === false\) return;[\s\S]*\.catch\(\(err: unknown\) => \{[\s\S]*if \(isCapabilityAuditPanelEffectActive\(cancelled\) === false\) return;/,
  'workspace capability audit panel should derive async cancellation through an explicit effect active fact',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /if \(cancelled\) return;/,
  'workspace capability audit panel should not regress async cancellation to an implicit cancelled gate',
);
assert.match(
  capabilityAuditPanel,
  /function shouldRenderCapabilityAuditPanelDiagnosticMessage\(message: string\): boolean \{[\s\S]*return hasCapabilityAuditPanelTextValue\(message\);[\s\S]*const shouldRenderDiagnosticLinkCopyError = shouldRenderCapabilityAuditPanelDiagnosticMessage\(diagnosticLinkCopyError\);[\s\S]*\{shouldRenderDiagnosticLinkCopyError === true && \([\s\S]*<span role="status" className="text-xs text-destructive">[\s\S]*\{diagnosticLinkCopyError\}/,
  'workspace capability audit panel should render diagnostic link copy failures through an explicit render fact',
);
assert.match(
  capabilityAuditPanel,
  /const shouldRenderDiagnosticUrlSyncError = shouldRenderCapabilityAuditPanelDiagnosticMessage\(diagnosticUrlSyncError\);[\s\S]*\{shouldRenderDiagnosticUrlSyncError === true && \([\s\S]*<span role="status" className="text-xs text-destructive">[\s\S]*\{diagnosticUrlSyncError\}/,
  'workspace capability audit panel should render diagnostic URL sync failures through an explicit render fact',
);
assert.match(
  capabilityAuditPanel,
  /(?=[\s\S]*function shouldRenderCapabilityAuditPanelRuntimeContext\([\s\S]*runtimeDiagnosticContext: RuntimeHealthDiagnosticContext \| null,[\s\S]*\): boolean \{[\s\S]*return hasCapabilityAuditPanelRuntimeDiagnosticContext\(runtimeDiagnosticContext\);)(?=[\s\S]*function shouldRenderCapabilityAuditPanelLoadingState\(loadState: LoadState\): boolean \{[\s\S]*return isCapabilityAuditPanelLoading\(loadState\);)(?=[\s\S]*function shouldRenderCapabilityAuditPanelErrorState\(loadState: LoadState\): boolean \{[\s\S]*return isCapabilityAuditPanelLoadState\(loadState, 'error'\);)(?=[\s\S]*function shouldRenderCapabilityAuditPanelEmptyState\(\{[\s\S]*loadState,[\s\S]*visibleRecords,[\s\S]*\}: \{[\s\S]*loadState: LoadState;[\s\S]*visibleRecords: CapabilityExecutionAuditRecord\[\];[\s\S]*\}\): boolean \{[\s\S]*const isReady = isCapabilityAuditPanelLoadState\(loadState, 'ready'\);[\s\S]*const hasRecords = hasCapabilityAuditPanelRecords\(visibleRecords\);[\s\S]*return isReady === true && hasRecords === false;)(?=[\s\S]*function shouldRenderCapabilityAuditPanelRecordList\([\s\S]*visibleRecords: CapabilityExecutionAuditRecord\[\],[\s\S]*\): boolean \{[\s\S]*return hasCapabilityAuditPanelRecords\(visibleRecords\);)(?=[\s\S]*function shouldRenderCapabilityAuditPanelLatestRecord\([\s\S]*latestRecord: CapabilityAuditLatestRecord \| null,[\s\S]*\): boolean \{[\s\S]*return hasCapabilityAuditPanelLatestRecord\(latestRecord\);)(?=[\s\S]*function shouldRenderCapabilityAuditPanelDistribution\([\s\S]*items: CapabilityAuditDistributionItemList,[\s\S]*\): boolean \{[\s\S]*return hasCapabilityAuditPanelDistributionItems\(items\);)(?=[\s\S]*\{shouldRenderRuntimeContext === true && \()(?=[\s\S]*\{shouldRenderLoadingState === true && \()(?=[\s\S]*\{shouldRenderErrorState === true && \()(?=[\s\S]*\{shouldRenderEmptyState === true && \()(?=[\s\S]*\{shouldRenderRecordList === true && \()(?=[\s\S]*\{shouldRenderLatestRecord === true \? \()(?=[\s\S]*\{shouldRenderProfileDistribution === true \? \()(?=[\s\S]*\{shouldRenderReasonDistribution === true \? \()/,
  'workspace capability audit panel should render runtime context, load states, empty state, record list and distributions through explicit render facts',
);
assert.match(
  capabilityAuditPanel,
  /(?=[\s\S]*function getCapabilityAuditPanelLatestRecordStatus\([\s\S]*latestRecord: CapabilityAuditLatestRecord \| null,[\s\S]*\): CapabilityExecutionAuditStatus \| '' \{[\s\S]*return latestRecord\.status;)(?=[\s\S]*function getCapabilityAuditPanelLatestRecordReason\([\s\S]*latestRecord: CapabilityAuditLatestRecord \| null,[\s\S]*\): string \{[\s\S]*return latestRecord\.reason;)(?=[\s\S]*function getCapabilityAuditPanelLatestRecordCreatedAt\([\s\S]*latestRecord: CapabilityAuditLatestRecord \| null,[\s\S]*\): string \{[\s\S]*return formatCapabilityAuditTime\(latestRecord\.createdAt\);)(?=[\s\S]*function getCapabilityAuditPanelLatestRecordSourceNote\([\s\S]*latestRecord: CapabilityAuditLatestRecord \| null,[\s\S]*\): string \{[\s\S]*return latestRecord\.sourceNote;)(?=[\s\S]*const latestRecordStatus = getCapabilityAuditPanelLatestRecordStatus\(diagnosticsSummary\.latestRecord\);)(?=[\s\S]*const latestRecordReason = getCapabilityAuditPanelLatestRecordReason\(diagnosticsSummary\.latestRecord\);)(?=[\s\S]*const latestRecordCreatedAt = getCapabilityAuditPanelLatestRecordCreatedAt\(diagnosticsSummary\.latestRecord\);)(?=[\s\S]*const latestRecordSourceNote = getCapabilityAuditPanelLatestRecordSourceNote\(diagnosticsSummary\.latestRecord\);)(?=[\s\S]*\{latestRecordStatus\} \/ \{latestRecordReason\} \/ \{latestRecordCreatedAt\})(?=[\s\S]*\{latestRecordSourceNote\})/,
  'workspace capability audit panel should read latest record display fields through named readers before rendering',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /diagnosticLinkCopyError &&|diagnosticUrlSyncError &&|runtimeDiagnosticContext &&|loadState === 'loading' &&|loadState === 'error' &&|loadState === 'ready' && visibleRecords\.length === 0|visibleRecords\.length > 0 &&|runtimeDiagnosticContext\?\.activeLabels|diagnosticsSummary\.latestRecord\.status|diagnosticsSummary\.latestRecord\.reason|diagnosticsSummary\.latestRecord\.sourceNote|diagnosticsSummary\.latestRecord\.createdAt/,
  'workspace capability audit panel should not regress key display render gates or runtime context reads to inline truthy/optional gates',
);
assert.match(
  capabilityAuditPanel,
  /data-testid="workspace-capability-audit-panel-snapshot"[\s\S]*formatCapabilityAuditPanelSnapshotTitle\(panelSnapshot\)[\s\S]*Phase: \{panelSnapshot\.status\}[\s\S]*Source: \{panelSnapshot\.source\}[\s\S]*Updated: \{panelSnapshot\.updatedAt\}[\s\S]*\{panelSnapshot\.message\}[\s\S]*恢复建议：\{panelSnapshot\.recovery\}/,
  'workspace capability audit panel should render the structured panel snapshot with stable UI target, phase, source, message, recovery, and update time',
);
assert.match(
  capabilityAuditPanel,
  /function getCapabilityAuditPanelProjectId\(projectId: string \| null\): string \| null \{[\s\S]*hasCapabilityAuditPanelTextValue\(projectId\) === false[\s\S]*return null;[\s\S]*return projectId;[\s\S]*const capabilityAuditProjectId = getCapabilityAuditPanelProjectId\(projectId\);[\s\S]*const hasCapabilityAuditProjectId = capabilityAuditProjectId !== null;[\s\S]*const canRefreshCapabilityAudit = canRefreshCapabilityAuditPanel\(\{[\s\S]*hasCapabilityAuditProjectId,[\s\S]*loadState,[\s\S]*\}\);[\s\S]*disabled=\{canRefreshCapabilityAudit === false\}/,
  'workspace capability audit refresh action should consume an explicit local gate',
);
assert.doesNotMatch(
  capabilityAuditPanel,
  /disabled=\{!projectId \|\| loadState === 'loading'\}|projectId !== null && projectId\.length > 0|if \(!projectId\)|\{!projectId &&| \{projectId &&/,
  'workspace capability audit refresh action should not regress to implicit or direct project id gates',
);
assert.match(
  workspaceTypes,
  /export type DebugPanelContextSnapshotStatus = 'idle_without_project' \| 'manual_debug' \| 'runtime_drilldown' \| 'capability_filter_drilldown' \| 'combined_drilldown';[\s\S]*export type DebugPanelContextSnapshotSource = 'project_binding' \| 'debug_tab' \| 'runtime_health' \| 'capability_audit' \| 'runtime_and_capability';[\s\S]*export type DebugPanelContextUrlParam = string;[\s\S]*export type DebugPanelContextUrlParamList = DebugPanelContextUrlParam\[\];[\s\S]*export type DebugPanelContextSnapshot = \{[\s\S]*status: DebugPanelContextSnapshotStatus;[\s\S]*source: DebugPanelContextSnapshotSource;[\s\S]*urlParams: DebugPanelContextUrlParamList;[\s\S]*updatedAt: string;[\s\S]*\};/,
  'workspace types should model the Debug panel diagnostic entry context as a structured snapshot',
);
assert.doesNotMatch(
  workspaceTypes,
  /urlParams: string\[\];/,
  'workspace Debug panel context snapshot should not regress URL params to an anonymous string array',
);
assert.match(
  desktopDebugPanel,
  /import type \{ DebugPanelContextSnapshot \} from '\.\/workspace-types';/,
  'workspace Debug panel should consume the shared Debug panel context snapshot type',
);
assert.doesNotMatch(
  desktopDebugPanel,
  /type DebugPanelContextSnapshot = \{/,
  'workspace Debug panel should not keep a local DebugPanelContextSnapshot type',
);
assert.match(
  debugPanelContextSnapshot,
  /(?=[\s\S]*DebugPanelContextSnapshotStatus)(?=[\s\S]*DebugPanelContextSnapshotSource)(?=[\s\S]*export function buildDebugPanelContextSnapshot\([\s\S]*\): DebugPanelContextSnapshot \{)(?=[\s\S]*deriveRuntimeHealthDiagnosticContext\(search\))(?=[\s\S]*normalizeCapabilityAuditStatusFilter\(params\.get\(CAPABILITY_AUDIT_STATUS_QUERY_PARAM\)\))(?=[\s\S]*normalizeCapabilityAuditProfileFilter\(params\.get\(CAPABILITY_AUDIT_PROFILE_QUERY_PARAM\)\))(?=[\s\S]*normalizeCapabilityAuditReasonFilter\(params\.get\(CAPABILITY_AUDIT_REASON_QUERY_PARAM\)\))(?=[\s\S]*status: DebugPanelContextSnapshotStatus = 'idle_without_project'[\s\S]*source: DebugPanelContextSnapshotSource = 'project_binding')(?=[\s\S]*status: DebugPanelContextSnapshotStatus = 'combined_drilldown'[\s\S]*source: DebugPanelContextSnapshotSource = 'runtime_and_capability')(?=[\s\S]*status: DebugPanelContextSnapshotStatus = 'runtime_drilldown'[\s\S]*source: DebugPanelContextSnapshotSource = 'runtime_health')(?=[\s\S]*status: DebugPanelContextSnapshotStatus = 'capability_filter_drilldown'[\s\S]*source: DebugPanelContextSnapshotSource = 'capability_audit')(?=[\s\S]*status: DebugPanelContextSnapshotStatus = 'manual_debug'[\s\S]*source: DebugPanelContextSnapshotSource = 'debug_tab')/,
  'workspace Debug panel context snapshot helper should derive runtime and capability drilldown phases from shared URL query models',
);
assert.doesNotMatch(
  debugPanelContextSnapshot,
  /DebugPanelContextSnapshot\['status'\]|DebugPanelContextSnapshot\['source'\]/,
  'workspace Debug panel context snapshot helper should not infer status/source from indexed snapshot access',
);
assert.match(
  desktopDebugPanel,
  /import \{ buildDebugPanelContextSnapshot \} from '\.\/workspace-debug-panel-context-snapshot';[\s\S]*const contextSnapshot = useMemo\([\s\S]*buildDebugPanelContextSnapshot\(projectId, locationSearch, contextUpdatedAt\)/,
  'workspace Debug panel should consume the shared Debug panel context snapshot helper',
);
assert.match(
  desktopDebugPanel,
  /window\.addEventListener\('popstate', syncLocationSearch\);[\s\S]*window\.addEventListener\('yistack:debug-context-updated', syncLocationSearch\);/,
  'workspace Debug panel should refresh its context snapshot after URL navigation or guarded diagnostic URL updates',
);
assert.match(
  capabilityAuditPanel,
  /window\.dispatchEvent\(new Event\('yistack:debug-context-updated'\)\);/,
  'Capability Audit URL sync should notify the Debug panel context snapshot after guarded replaceState calls',
);
assert.match(
  desktopDebugPanel,
  /function getDebugPanelUrlParamsLabel\(urlParams: string\[\]\): string \{[\s\S]*const hasUrlParams = urlParams\.length > 0;[\s\S]*if \(hasUrlParams === true\)[\s\S]*return urlParams\.join\(' \/ '\);[\s\S]*return '无诊断定位参数';[\s\S]*data-testid="workspace-debug-panel-context-snapshot"[\s\S]*Debug 诊断上下文[\s\S]*Phase: \{contextSnapshot\.status\}[\s\S]*Source: \{contextSnapshot\.source\}[\s\S]*Updated: \{contextSnapshot\.updatedAt\}[\s\S]*URL 参数：\{getDebugPanelUrlParamsLabel\(contextSnapshot\.urlParams\)\}/,
  'workspace Debug panel should render a stable context snapshot target with phase, source, update time, and URL parameter context above Capability Audit',
);
assert.doesNotMatch(
  desktopDebugPanel,
  /contextSnapshot\.urlParams\.length > 0 \? contextSnapshot\.urlParams\.join\(' \/ '\) : '无诊断定位参数'/,
  'workspace Debug panel should not regress URL parameter context display to an inline ternary gate',
);
assert.match(
  mobileDebugPanel,
  /import \{ WorkspaceDebugPanel \} from '\.\/workspace-ide-desktop-debug-panel';[\s\S]*<WorkspaceDebugPanel projectId=\{projectId\} compact \/>/,
  'mobile Debug panel should reuse the shared Debug context snapshot instead of duplicating or omitting it',
);

const capabilityExecutor = fs.readFileSync('backend/internal/orchestration/workspace_capability_executor.go', 'utf8');
const capabilityStage = fs.readFileSync('backend/internal/orchestration/workspace_capability_stage.go', 'utf8');
const streamResponseWriter = fs.readFileSync('backend/internal/handler/stream_response_writer.go', 'utf8');
assert.match(
  capabilityExecutor,
  /CapabilityProfile string/,
  'capability execution result should carry the resolved capability profile',
);
assert.match(
  capabilityStage,
  /executionResult\.CapabilityProfile = strings\.TrimSpace\(capabilityContext\.Profile\)/,
  'capability gate should stamp execution_result with the resolved capability profile',
);
assert.match(
  streamResponseWriter,
  /"capability_profile": result\.CapabilityProfile/,
  'capability gate SSE error payload should expose capability_profile for frontend audit drilldown',
);

const conversationActions = fs.readFileSync('src/app/workspace/use-workspace-page-conversation-actions.tsx', 'utf8');
assert.match(
  conversationActions,
  /setActiveTab\('debug'\)/,
  'capability audit action should open the workspace debug tab',
);
assert.match(
  conversationActions,
  /setMobileView\('ide'\)/,
  'capability audit action should switch mobile users to the IDE view',
);

console.log('[YES] Capability audit diagnostics model validation passed.');
