'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCcw, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  projectApi,
  type CapabilityExecutionAuditCapabilityProfile,
  type CapabilityExecutionAuditListResponse,
  type CapabilityExecutionAuditRecord,
  type CapabilityExecutionAuditStatus,
  type CapabilityExecutionAuditWorkflowMode,
  type CapabilityExecutionAuditWorkflowStage,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatCapabilityAuditLoadFailure } from '@/lib/workspace/capability-audit-operation-errors';
import {
  formatCapabilityAuditLocalError,
  formatCapabilityAuditMissingClipboardError,
} from '@/lib/workspace/capability-audit-local-errors';
import {
  clearRuntimeHealthDiagnosticContextSearch,
  deriveRuntimeHealthDiagnosticContext,
  RUNTIME_HEALTH_PROJECT_QUERY_PARAM,
  RUNTIME_HEALTH_REASON_QUERY_PARAM,
  type RuntimeHealthDiagnosticContext,
} from '@/lib/workspace/runtime-health-diagnostics';
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
  type CapabilityAuditDistributionItemList,
  type CapabilityAuditLatestRecord,
  type CapabilityAuditProfileFilter,
  type CapabilityAuditReasonFilter,
  type CapabilityAuditRuntimeSourceLabelList,
  type CapabilityAuditStatusFilter,
  updateCapabilityAuditProfileSearch,
  updateCapabilityAuditReasonSearch,
  updateCapabilityAuditStatusSearch,
} from '@/lib/workspace/capability-audit-diagnostics';
import type {
  CapabilityAuditPanelSnapshot,
  CapabilityAuditPanelSnapshotSource,
  CapabilityAuditPanelSnapshotStatus,
} from './workspace-types';

type CapabilityAuditPanelProps = {
  projectId: string | null;
  compact?: boolean;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type CapabilityAuditPanelOptionNodeList = ReactNode[];
type CapabilityAuditPanelRecordNodeList = ReactNode[];
type CapabilityAuditPanelSnapshotStatusList = CapabilityAuditPanelSnapshotStatus[];
type CapabilityAuditPanelRawObject = {
  [fieldName: string]: unknown;
};
type CapabilityAuditPanelExecutionAuditItemList = unknown[];
type CapabilityAuditPanelCatalogEvidence = {
  capabilityVersion: string;
  capabilityCatalogSource: string;
  providerResolutionStatus: string;
};

const capabilityAuditStatusOptions: CapabilityAuditStatusFilter[] = ['all', 'blocked', 'executed', 'deferred', 'skipped', 'unknown'];
const CAPABILITY_AUDIT_PANEL_ERROR_SNAPSHOT_STATUSES: CapabilityAuditPanelSnapshotStatusList = [
  'load_failed',
  'filter_url_stale',
  'link_copy_failed',
];
const CAPABILITY_AUDIT_PANEL_SUCCESS_SNAPSHOT_STATUSES: CapabilityAuditPanelSnapshotStatusList = [
  'ready',
  'filter_url_synced',
  'link_copied',
];

function hasCapabilityAuditPanelTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function isCapabilityAuditPanelRawObject(value: unknown): value is CapabilityAuditPanelRawObject {
  const hasObject = value !== null && typeof value === 'object' && Array.isArray(value) === false;
  return hasObject === true;
}

function getCapabilityAuditPanelRawObject(value: unknown): CapabilityAuditPanelRawObject | null {
  const hasRawObject = isCapabilityAuditPanelRawObject(value);
  if (hasRawObject === false) {
    return null;
  }

  return value;
}

function getCapabilityAuditPanelRawString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

function getCapabilityAuditPanelProjectId(projectId: string | null): string | null {
  if (hasCapabilityAuditPanelTextValue(projectId) === false) {
    return null;
  }

  return projectId;
}

function getCapabilityAuditRecordStatusLabel(record: CapabilityExecutionAuditRecord): CapabilityExecutionAuditStatus | 'unknown' {
  const status = record.status;
  const hasStatus = hasCapabilityAuditPanelTextValue(status);
  if (hasStatus === false) {
    return 'unknown';
  }

  return status;
}

function getCapabilityAuditRecordProfileLabel(record: CapabilityExecutionAuditRecord): CapabilityExecutionAuditCapabilityProfile | 'default-profile' {
  const capabilityProfile = record.capability_profile;
  const hasCapabilityProfile = hasCapabilityAuditPanelTextValue(capabilityProfile);
  if (hasCapabilityProfile === false) {
    return 'default-profile';
  }

  return capabilityProfile;
}

function getCapabilityAuditRecordWorkflowStageLabel(record: CapabilityExecutionAuditRecord): CapabilityExecutionAuditWorkflowStage | 'unknown-stage' {
  const workflowStage = record.workflow_stage;
  const hasWorkflowStage = hasCapabilityAuditPanelTextValue(workflowStage);
  if (hasWorkflowStage === false) {
    return 'unknown-stage';
  }

  return workflowStage;
}

function getCapabilityAuditRecordWorkflowModeLabel(record: CapabilityExecutionAuditRecord): CapabilityExecutionAuditWorkflowMode | 'unknown-mode' {
  const workflowMode = record.workflow_mode;
  const hasWorkflowMode = hasCapabilityAuditPanelTextValue(workflowMode);
  if (hasWorkflowMode === false) {
    return 'unknown-mode';
  }

  return workflowMode;
}

function getCapabilityAuditPanelExecutionAuditItems(
  record: CapabilityExecutionAuditRecord,
): CapabilityAuditPanelExecutionAuditItemList {
  const executionAudit = getCapabilityAuditPanelRawObject(record.execution_audit);
  if (executionAudit === null) {
    return [];
  }

  const items = executionAudit.items;
  if (Array.isArray(items) === false) {
    return [];
  }

  return items;
}

function getCapabilityAuditPanelFirstExecutionAuditItem(
  items: CapabilityAuditPanelExecutionAuditItemList,
): CapabilityAuditPanelRawObject | null {
  for (const item of items) {
    const rawItem = getCapabilityAuditPanelRawObject(item);
    if (rawItem !== null) {
      return rawItem;
    }
  }

  return null;
}

function getCapabilityAuditPanelCatalogEvidence(
  record: CapabilityExecutionAuditRecord,
): CapabilityAuditPanelCatalogEvidence {
  const items = getCapabilityAuditPanelExecutionAuditItems(record);
  const firstItem = getCapabilityAuditPanelFirstExecutionAuditItem(items);
  if (firstItem === null) {
    return {
      capabilityVersion: '',
      capabilityCatalogSource: '',
      providerResolutionStatus: '',
    };
  }

  return {
    capabilityVersion: getCapabilityAuditPanelRawString(firstItem.capability_version),
    capabilityCatalogSource: getCapabilityAuditPanelRawString(firstItem.capability_catalog_source),
    providerResolutionStatus: getCapabilityAuditPanelRawString(firstItem.provider_resolution_status),
  };
}

function shouldRenderCapabilityAuditPanelCatalogEvidence(
  evidence: CapabilityAuditPanelCatalogEvidence,
): boolean {
  if (hasCapabilityAuditPanelTextValue(evidence.capabilityVersion) === true) {
    return true;
  }

  if (hasCapabilityAuditPanelTextValue(evidence.providerResolutionStatus) === true) {
    return true;
  }

  return hasCapabilityAuditPanelTextValue(evidence.capabilityCatalogSource);
}

function getCapabilityAuditPanelResponseRecords(
  result: CapabilityExecutionAuditListResponse,
): CapabilityExecutionAuditRecord[] {
  return result.records;
}

function getCapabilityAuditPanelResponseTotal(result: CapabilityExecutionAuditListResponse): number {
  return result.total;
}

function isCapabilityAuditPanelEffectActive(cancelled: boolean): boolean {
  return cancelled === false;
}

function isCapabilityAuditPanelLoadState(
  loadState: LoadState,
  expectedLoadState: LoadState,
): boolean {
  return loadState === expectedLoadState;
}

function isCapabilityAuditPanelLoading(loadState: LoadState): boolean {
  return isCapabilityAuditPanelLoadState(loadState, 'loading');
}

function hasCapabilityAuditPanelRecords(records: CapabilityExecutionAuditRecord[]): boolean {
  const hasRecords = records.length > 0;
  return hasRecords === true;
}

function hasCapabilityAuditPanelDistributionItems(items: CapabilityAuditDistributionItemList): boolean {
  const hasItems = items.length > 0;
  return hasItems === true;
}

function hasCapabilityAuditPanelLatestRecord(
  latestRecord: CapabilityAuditLatestRecord | null,
): latestRecord is CapabilityAuditLatestRecord {
  return latestRecord !== null;
}

function hasCapabilityAuditPanelRuntimeDiagnosticContext(
  runtimeDiagnosticContext: RuntimeHealthDiagnosticContext | null,
): runtimeDiagnosticContext is RuntimeHealthDiagnosticContext {
  return runtimeDiagnosticContext !== null;
}

function getCapabilityAuditPanelRuntimeSourceLabels(
  runtimeDiagnosticContext: RuntimeHealthDiagnosticContext | null,
): CapabilityAuditRuntimeSourceLabelList | undefined {
  const hasRuntimeDiagnosticContext = hasCapabilityAuditPanelRuntimeDiagnosticContext(runtimeDiagnosticContext);
  if (hasRuntimeDiagnosticContext === false) {
    return undefined;
  }

  return runtimeDiagnosticContext.activeLabels;
}

function hasCapabilityAuditPanelActiveFilters(activeFilterCount: number): boolean {
  return activeFilterCount > 0;
}

function canClearCapabilityAuditPanelFilters({
  activeFilterCount,
  runtimeDiagnosticContext,
}: {
  activeFilterCount: number;
  runtimeDiagnosticContext: RuntimeHealthDiagnosticContext | null;
}): boolean {
  const hasActiveFilters = hasCapabilityAuditPanelActiveFilters(activeFilterCount);
  const hasRuntimeDiagnosticContext = hasCapabilityAuditPanelRuntimeDiagnosticContext(runtimeDiagnosticContext);
  return hasActiveFilters === true || hasRuntimeDiagnosticContext === true;
}

function getCapabilityAuditPanelSyncedSearchLabel(nextSearch: string): string {
  const hasNextSearch = hasCapabilityAuditPanelTextValue(nextSearch);
  if (hasNextSearch === false) {
    return '无筛选参数';
  }

  return nextSearch;
}

function isCapabilityAuditPanelSnapshotStatusIn(
  status: CapabilityAuditPanelSnapshotStatus,
  statuses: CapabilityAuditPanelSnapshotStatusList,
): boolean {
  for (const candidateStatus of statuses) {
    if (candidateStatus === status) {
      return true;
    }
  }

  return false;
}

function isCapabilityAuditPanelErrorSnapshot(snapshot: CapabilityAuditPanelSnapshot): boolean {
  return isCapabilityAuditPanelSnapshotStatusIn(
    snapshot.status,
    CAPABILITY_AUDIT_PANEL_ERROR_SNAPSHOT_STATUSES,
  );
}

function isCapabilityAuditPanelSuccessSnapshot(snapshot: CapabilityAuditPanelSnapshot): boolean {
  return isCapabilityAuditPanelSnapshotStatusIn(
    snapshot.status,
    CAPABILITY_AUDIT_PANEL_SUCCESS_SNAPSHOT_STATUSES,
  );
}

function getCapabilityAuditPanelQueryStatusFilter(
  statusFilter: CapabilityAuditStatusFilter,
): CapabilityAuditStatusFilter | undefined {
  if (statusFilter === 'all') {
    return undefined;
  }

  return statusFilter;
}

function getCapabilityAuditPanelQueryProfileFilter(
  profileFilter: CapabilityAuditProfileFilter,
): CapabilityAuditProfileFilter | undefined {
  if (profileFilter === 'all') {
    return undefined;
  }

  return profileFilter;
}

function canRefreshCapabilityAuditPanel({
  hasCapabilityAuditProjectId,
  loadState,
}: {
  hasCapabilityAuditProjectId: boolean;
  loadState: LoadState;
}): boolean {
  const isLoading = isCapabilityAuditPanelLoading(loadState);
  return hasCapabilityAuditProjectId === true && isLoading === false;
}

function getStatusBadgeVariant(status: CapabilityExecutionAuditStatus | 'unknown'): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'executed':
      return 'default';
    case 'blocked':
      return 'destructive';
    case 'deferred':
    case 'skipped':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatCapabilityAuditPanelSnapshotTitle(snapshot: CapabilityAuditPanelSnapshot) {
  switch (snapshot.status) {
    case 'idle_without_project':
      return 'Capability Audit 尚未绑定项目';
    case 'loading':
      return 'Capability Audit 正在加载审计快照';
    case 'ready':
      return 'Capability Audit 审计快照已就绪';
    case 'load_failed':
      return 'Capability Audit 审计快照加载失败';
    case 'filter_url_synced':
      return 'Capability Audit 筛选已同步到地址栏';
    case 'filter_url_stale':
      return 'Capability Audit 地址栏筛选可能是旧状态';
    case 'link_copied':
      return 'Capability Audit 诊断链接已复制';
    case 'link_copy_failed':
      return 'Capability Audit 诊断链接复制失败';
    default:
      return 'Capability Audit 面板状态待确认';
  }
}

function getCapabilityAuditPanelSnapshotClassName(snapshot: CapabilityAuditPanelSnapshot) {
  const isErrorSnapshot = isCapabilityAuditPanelErrorSnapshot(snapshot);
  if (isErrorSnapshot === true) {
    return 'border-destructive/30 bg-destructive/5 text-destructive';
  }

  const isSuccessSnapshot = isCapabilityAuditPanelSuccessSnapshot(snapshot);
  if (isSuccessSnapshot === true) {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }

  return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function getCapabilityAuditPanelRootPaddingClassName(compact: boolean): string {
  if (compact === true) {
    return 'p-3';
  }

  return 'p-5';
}

function getCapabilityAuditPanelTitleTextClassName(compact: boolean): string {
  if (compact === true) {
    return 'text-sm';
  }

  return 'text-base';
}

function getCapabilityAuditPanelDescriptionTextClassName(compact: boolean): string {
  if (compact === true) {
    return 'text-xs';
  }

  return 'text-sm';
}

function getCapabilityAuditPanelActionSize(compact: boolean): 'sm' | 'default' {
  if (compact === true) {
    return 'sm';
  }

  return 'default';
}

function getCapabilityAuditPanelFilterOptionLabel({
  option,
  fallbackLabel,
}: {
  option: string;
  fallbackLabel: string;
}): string {
  if (option === 'all') {
    return fallbackLabel;
  }

  return option;
}

function getCapabilityAuditPanelDiagnosticLinkCopyLabel(diagnosticLinkCopied: boolean): string {
  if (diagnosticLinkCopied === true) {
    return '已复制链接';
  }

  return '复制诊断链接';
}

function getCapabilityAuditPanelActiveFilterLabel(activeLabels: string[]): string {
  const hasActiveLabels = activeLabels.length > 0;
  if (hasActiveLabels === false) {
    return '全部记录';
  }

  let label = '';
  for (const activeLabel of activeLabels) {
    if (label.length === 0) {
      label = activeLabel;
    } else {
      label = `${label} / ${activeLabel}`;
    }
  }

  return label;
}

function getCapabilityAuditPanelDistributionLabel(items: CapabilityAuditDistributionItemList): string {
  let label = '';
  for (const item of items) {
    const itemLabel = `${item.label} (${item.count})`;
    if (label.length === 0) {
      label = itemLabel;
    } else {
      label = `${label}, ${itemLabel}`;
    }
  }

  return label;
}

function getCapabilityAuditPanelVisibleTotal({
  reasonFilter,
  total,
  visibleRecordCount,
}: {
  reasonFilter: CapabilityAuditReasonFilter;
  total: number;
  visibleRecordCount: number;
}): number {
  if (reasonFilter === 'all') {
    return total;
  }

  return visibleRecordCount;
}

function shouldRenderCapabilityAuditPanelDiagnosticMessage(message: string): boolean {
  return hasCapabilityAuditPanelTextValue(message);
}

function shouldRenderCapabilityAuditPanelRuntimeContext(
  runtimeDiagnosticContext: RuntimeHealthDiagnosticContext | null,
): boolean {
  return hasCapabilityAuditPanelRuntimeDiagnosticContext(runtimeDiagnosticContext);
}

function shouldRenderCapabilityAuditPanelLoadingState(loadState: LoadState): boolean {
  return isCapabilityAuditPanelLoading(loadState);
}

function shouldRenderCapabilityAuditPanelErrorState(loadState: LoadState): boolean {
  return isCapabilityAuditPanelLoadState(loadState, 'error');
}

function shouldRenderCapabilityAuditPanelEmptyState({
  loadState,
  visibleRecords,
}: {
  loadState: LoadState;
  visibleRecords: CapabilityExecutionAuditRecord[];
}): boolean {
  const isReady = isCapabilityAuditPanelLoadState(loadState, 'ready');
  const hasRecords = hasCapabilityAuditPanelRecords(visibleRecords);
  return isReady === true && hasRecords === false;
}

function shouldRenderCapabilityAuditPanelRecordList(
  visibleRecords: CapabilityExecutionAuditRecord[],
): boolean {
  return hasCapabilityAuditPanelRecords(visibleRecords);
}

function shouldRenderCapabilityAuditPanelLatestRecord(
  latestRecord: CapabilityAuditLatestRecord | null,
): boolean {
  return hasCapabilityAuditPanelLatestRecord(latestRecord);
}

function getCapabilityAuditPanelLatestRecordStatus(
  latestRecord: CapabilityAuditLatestRecord | null,
): CapabilityExecutionAuditStatus | '' {
  const hasLatestRecord = hasCapabilityAuditPanelLatestRecord(latestRecord);
  if (hasLatestRecord === false) {
    return '';
  }

  return latestRecord.status;
}

function getCapabilityAuditPanelLatestRecordReason(
  latestRecord: CapabilityAuditLatestRecord | null,
): string {
  const hasLatestRecord = hasCapabilityAuditPanelLatestRecord(latestRecord);
  if (hasLatestRecord === false) {
    return '';
  }

  return latestRecord.reason;
}

function getCapabilityAuditPanelLatestRecordCreatedAt(
  latestRecord: CapabilityAuditLatestRecord | null,
): string {
  const hasLatestRecord = hasCapabilityAuditPanelLatestRecord(latestRecord);
  if (hasLatestRecord === false) {
    return formatCapabilityAuditTime();
  }

  return formatCapabilityAuditTime(latestRecord.createdAt);
}

function getCapabilityAuditPanelLatestRecordSourceNote(
  latestRecord: CapabilityAuditLatestRecord | null,
): string {
  const hasLatestRecord = hasCapabilityAuditPanelLatestRecord(latestRecord);
  if (hasLatestRecord === false) {
    return '';
  }

  return latestRecord.sourceNote;
}

function shouldRenderCapabilityAuditPanelDistribution(
  items: CapabilityAuditDistributionItemList,
): boolean {
  return hasCapabilityAuditPanelDistributionItems(items);
}

function getCapabilityAuditPanelOptionNodes({
  options,
  fallbackLabel,
}: {
  options: string[];
  fallbackLabel: string;
}): CapabilityAuditPanelOptionNodeList {
  const optionNodes: CapabilityAuditPanelOptionNodeList = [];
  for (const option of options) {
    optionNodes.push(
      <option key={option} value={option}>
        {getCapabilityAuditPanelFilterOptionLabel({ option, fallbackLabel })}
      </option>,
    );
  }

  return optionNodes;
}

function getCapabilityAuditPanelRecordNodes(records: CapabilityExecutionAuditRecord[]): CapabilityAuditPanelRecordNodeList {
  const recordNodes: CapabilityAuditPanelRecordNodeList = [];
  for (const record of records) {
    const statusLabel = getCapabilityAuditRecordStatusLabel(record);
    const capabilityProfileLabel = getCapabilityAuditRecordProfileLabel(record);
    const workflowStageLabel = getCapabilityAuditRecordWorkflowStageLabel(record);
    const workflowModeLabel = getCapabilityAuditRecordWorkflowModeLabel(record);
    const catalogEvidence = getCapabilityAuditPanelCatalogEvidence(record);
    const shouldRenderCatalogEvidence = shouldRenderCapabilityAuditPanelCatalogEvidence(catalogEvidence);

    recordNodes.push(
      <div key={record.id} className="rounded-lg border bg-background p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusBadgeVariant(statusLabel)}>{statusLabel}</Badge>
              <span className="truncate text-sm font-medium">{capabilityProfileLabel}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{workflowStageLabel}</span>
              <span>{workflowModeLabel}</span>
              <span>{formatCapabilityAuditTime(record.created_at)}</span>
            </div>
          </div>
          <Activity className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="mt-3 rounded-md bg-muted/50 p-2 text-xs">
          <div className="font-mono text-foreground">{getCapabilityAuditRecordReason(record)}</div>
          <div className="mt-1 text-muted-foreground">{getCapabilityAuditRecordSourceNote(record)}</div>
        </div>
        {shouldRenderCatalogEvidence === true && (
          <div className="mt-2 rounded-md border bg-background/70 p-2 text-[11px] text-muted-foreground">
            <div>CatalogVersion: {catalogEvidence.capabilityVersion}</div>
            <div>ProviderResolution: {catalogEvidence.providerResolutionStatus}</div>
            <div>CatalogSource: {catalogEvidence.capabilityCatalogSource}</div>
          </div>
        )}
      </div>,
    );
  }

  return recordNodes;
}

function getCapabilityAuditPanelVisibleRecords({
  records,
  reasonFilter,
}: {
  records: CapabilityExecutionAuditRecord[];
  reasonFilter: CapabilityAuditReasonFilter;
}): CapabilityExecutionAuditRecord[] {
  if (reasonFilter === 'all') {
    return records;
  }

  const visibleRecords: CapabilityExecutionAuditRecord[] = [];
  for (const record of records) {
    const recordReason = getCapabilityAuditRecordReason(record);
    if (recordReason === reasonFilter) {
      visibleRecords.push(record);
    }
  }

  return visibleRecords;
}

export function CapabilityAuditPanel({ projectId, compact = false }: CapabilityAuditPanelProps) {
  const capabilityAuditProjectId = getCapabilityAuditPanelProjectId(projectId);
  const hasCapabilityAuditProjectId = capabilityAuditProjectId !== null;
  const [records, setRecords] = useState<CapabilityExecutionAuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<CapabilityAuditStatusFilter>('all');
  const [profileFilter, setProfileFilter] = useState<CapabilityAuditProfileFilter>('all');
  const [reasonFilter, setReasonFilter] = useState<CapabilityAuditReasonFilter>('all');
  const [runtimeDiagnosticContext, setRuntimeDiagnosticContext] = useState<RuntimeHealthDiagnosticContext | null>(null);
  const [diagnosticLinkCopied, setDiagnosticLinkCopied] = useState(false);
  const [diagnosticLinkCopyError, setDiagnosticLinkCopyError] = useState('');
  const [diagnosticUrlSyncError, setDiagnosticUrlSyncError] = useState('');
  const [panelSnapshot, setPanelSnapshot] = useState<CapabilityAuditPanelSnapshot>({
    status: 'idle_without_project',
    source: 'project_binding',
    message: 'Capability Audit 尚未绑定项目。',
    recovery: '进入已绑定的 Workspace 项目后会加载能力审计记录。',
    updatedAt: 'pending',
  });

  const updatePanelSnapshot = useCallback((
    status: CapabilityAuditPanelSnapshotStatus,
    source: CapabilityAuditPanelSnapshotSource,
    message: string,
    recovery: string,
  ) => {
    setPanelSnapshot({
      status,
      source,
      message,
      recovery,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const replaceUrlSearch = useCallback((nextSearch: string) => {
    if (typeof window === 'undefined') {
      return false;
    }
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    try {
      window.history.replaceState(window.history.state, '', nextUrl);
      setDiagnosticUrlSyncError('');
      const syncedSearchLabel = getCapabilityAuditPanelSyncedSearchLabel(nextSearch);
      updatePanelSnapshot(
        'filter_url_synced',
        'browser_history',
        `Capability Audit 筛选已同步到地址栏：${syncedSearchLabel}。`,
        '复制诊断链接时会携带当前筛选与 runtime 来源上下文。',
      );
      window.dispatchEvent(new Event('yistack:debug-context-updated'));
      return true;
    } catch (error) {
      const reason = formatCapabilityAuditLocalError(error, '浏览器拒绝更新地址栏', 'browser_history');
      setDiagnosticUrlSyncError(`Capability Audit 筛选地址栏同步失败：${reason}。当前筛选已在面板内生效，但地址栏和复制的诊断链接可能仍是旧状态；请稍后重试筛选或手动刷新页面确认 URL 状态。`);
      updatePanelSnapshot(
        'filter_url_stale',
        'browser_history',
        `Capability Audit 筛选地址栏同步失败：${reason}。`,
        '当前筛选已在面板内生效，但地址栏和复制的诊断链接可能仍是旧状态；请稍后重试筛选或手动刷新页面确认 URL 状态。',
      );
      window.dispatchEvent(new Event('yistack:debug-context-updated'));
      return false;
    }
  }, [updatePanelSnapshot]);

  const readStatusFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeCapabilityAuditStatusFilter(
      new URLSearchParams(window.location.search).get(CAPABILITY_AUDIT_STATUS_QUERY_PARAM),
    );
  }, []);

  const readProfileFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeCapabilityAuditProfileFilter(
      new URLSearchParams(window.location.search).get(CAPABILITY_AUDIT_PROFILE_QUERY_PARAM),
    );
  }, []);

  const readReasonFilterFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }
    return normalizeCapabilityAuditReasonFilter(
      new URLSearchParams(window.location.search).get(CAPABILITY_AUDIT_REASON_QUERY_PARAM),
    );
  }, []);

  const readRuntimeDiagnosticContextFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return deriveRuntimeHealthDiagnosticContext(window.location.search);
  }, []);

  const updateStatusFilter = useCallback((nextFilter: CapabilityAuditStatusFilter) => {
    setStatusFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateCapabilityAuditStatusSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const updateProfileFilter = useCallback((nextFilter: CapabilityAuditProfileFilter) => {
    setProfileFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateCapabilityAuditProfileSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const updateReasonFilter = useCallback((nextFilter: CapabilityAuditReasonFilter) => {
    setReasonFilter(nextFilter);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(updateCapabilityAuditReasonSearch(window.location.search, nextFilter));
    }
  }, [replaceUrlSearch]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setProfileFilter('all');
    setReasonFilter('all');
    setRuntimeDiagnosticContext(null);
    if (typeof window !== 'undefined') {
      replaceUrlSearch(clearRuntimeHealthDiagnosticContextSearch(clearCapabilityAuditFilterSearch(window.location.search)));
    }
  }, [replaceUrlSearch]);

  const copyCurrentDiagnosticLink = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.clipboard) {
      const reason = formatCapabilityAuditMissingClipboardError();
      setDiagnosticLinkCopied(false);
      setDiagnosticLinkCopyError(`复制诊断链接失败：${reason}，当前诊断链接没有写入系统剪贴板。`);
      updatePanelSnapshot(
        'link_copy_failed',
        'clipboard',
        `复制诊断链接失败：${reason}。`,
        '当前诊断链接没有写入系统剪贴板；可手动复制地址栏链接。',
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setDiagnosticLinkCopyError('');
      setDiagnosticLinkCopied(true);
      updatePanelSnapshot(
        'link_copied',
        'clipboard',
        'Capability Audit 诊断链接已复制到系统剪贴板。',
        '粘贴该链接可恢复当前筛选和 runtime 诊断来源上下文。',
      );
      window.setTimeout(() => setDiagnosticLinkCopied(false), 2000);
    } catch (error) {
      const reason = formatCapabilityAuditLocalError(error, '浏览器拒绝了剪贴板访问', 'clipboard');
      setDiagnosticLinkCopied(false);
      setDiagnosticLinkCopyError(`复制诊断链接失败：${reason}。当前诊断链接没有写入系统剪贴板；你可以手动复制地址栏链接。`);
      updatePanelSnapshot(
        'link_copy_failed',
        'clipboard',
        `复制诊断链接失败：${reason}。`,
        '当前诊断链接没有写入系统剪贴板；你可以手动复制地址栏链接。',
      );
    }
  }, [updatePanelSnapshot]);

  useEffect(() => {
    setStatusFilter(readStatusFilterFromUrl());
    setProfileFilter(readProfileFilterFromUrl());
    setReasonFilter(readReasonFilterFromUrl());
    setRuntimeDiagnosticContext(readRuntimeDiagnosticContextFromUrl());

    const handlePopState = () => {
      setStatusFilter(readStatusFilterFromUrl());
      setProfileFilter(readProfileFilterFromUrl());
      setReasonFilter(readReasonFilterFromUrl());
      setRuntimeDiagnosticContext(readRuntimeDiagnosticContextFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [readProfileFilterFromUrl, readReasonFilterFromUrl, readRuntimeDiagnosticContextFromUrl, readStatusFilterFromUrl]);

  useEffect(() => {
    if (hasCapabilityAuditProjectId === false) {
      setRecords([]);
      setTotal(0);
      setLoadState('idle');
      setError('');
      updatePanelSnapshot(
        'idle_without_project',
        'project_binding',
        'Capability Audit 当前没有绑定项目。',
        '进入已绑定的 Workspace 项目后会加载能力审计记录。',
      );
      return;
    }

    const currentProjectId = capabilityAuditProjectId;
    let cancelled = false;
    setLoadState('loading');
    setError('');
    updatePanelSnapshot(
      'loading',
      'audit_load',
      '正在从后端加载 Capability Audit 只读审计快照。',
      '如果长时间停留在加载状态，可刷新审计面板或检查项目能力审计接口。',
    );

    projectApi.listCapabilityAudits(currentProjectId, {
      limit: 20,
      status: getCapabilityAuditPanelQueryStatusFilter(statusFilter),
      capabilityProfile: getCapabilityAuditPanelQueryProfileFilter(profileFilter),
    })
      .then((result) => {
        if (isCapabilityAuditPanelEffectActive(cancelled) === false) return;
        const nextRecords = getCapabilityAuditPanelResponseRecords(result);
        const nextTotal = getCapabilityAuditPanelResponseTotal(result);
        setRecords(nextRecords);
        setTotal(nextTotal);
        setLoadState('ready');
        updatePanelSnapshot(
          'ready',
          'audit_load',
          `Capability Audit 已加载 ${nextRecords.length} 条可见记录，后端总数 ${nextTotal}。`,
          '可继续使用 status/profile/reason 筛选定位阻断来源。',
        );
      })
      .catch((err: unknown) => {
        if (isCapabilityAuditPanelEffectActive(cancelled) === false) return;
        const failureMessage = formatCapabilityAuditLoadFailure(err);
        setRecords([]);
        setTotal(0);
        setLoadState('error');
        setError(failureMessage);
        updatePanelSnapshot(
          'load_failed',
          'audit_load',
          `Capability Audit 加载失败：${failureMessage}`,
          '请刷新审计面板；如果持续失败，请检查项目能力审计接口和后端 source/details。',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [capabilityAuditProjectId, hasCapabilityAuditProjectId, profileFilter, refreshKey, statusFilter, updatePanelSnapshot]);

  const loadedDiagnosticsSummary = useMemo(() => {
    return deriveCapabilityAuditDiagnosticsSummary(records, total);
  }, [records, total]);

  const visibleRecords = useMemo(() => (
    getCapabilityAuditPanelVisibleRecords({
      records,
      reasonFilter,
    })
  ), [reasonFilter, records]);

  const diagnosticsSummary = useMemo(() => {
    return deriveCapabilityAuditDiagnosticsSummary(
      visibleRecords,
      getCapabilityAuditPanelVisibleTotal({
        reasonFilter,
        total,
        visibleRecordCount: visibleRecords.length,
      }),
    );
  }, [reasonFilter, total, visibleRecords]);

  const runtimeSourceLabels = useMemo(() => (
    getCapabilityAuditPanelRuntimeSourceLabels(runtimeDiagnosticContext)
  ), [runtimeDiagnosticContext]);

  const activeFilterSummary = useMemo(() => (
    deriveCapabilityAuditActiveFilterSummary({
      statusFilter,
      profileFilter,
      reasonFilter,
      runtimeSourceLabels,
      matchedRecordCount: visibleRecords.length,
      loadedRecordCount: records.length,
      totalRecordCount: total,
    })
  ), [profileFilter, reasonFilter, records.length, runtimeSourceLabels, statusFilter, total, visibleRecords.length]);

  const profileOptions = useMemo(() => {
    return buildCapabilityAuditProfileFilterOptions(
      loadedDiagnosticsSummary.capabilityProfiles,
      profileFilter,
    );
  }, [loadedDiagnosticsSummary.capabilityProfiles, profileFilter]);

  const reasonOptions = useMemo(() => {
    return buildCapabilityAuditReasonFilterOptions(
      loadedDiagnosticsSummary.reasonCodes,
      reasonFilter,
    );
  }, [loadedDiagnosticsSummary.reasonCodes, reasonFilter]);
  const canRefreshCapabilityAudit = canRefreshCapabilityAuditPanel({
    hasCapabilityAuditProjectId,
    loadState,
  });
  const canClearFilters = canClearCapabilityAuditPanelFilters({
    activeFilterCount: activeFilterSummary.activeFilterCount,
    runtimeDiagnosticContext,
  });
  const rootPaddingClassName = getCapabilityAuditPanelRootPaddingClassName(compact);
  const titleTextClassName = getCapabilityAuditPanelTitleTextClassName(compact);
  const descriptionTextClassName = getCapabilityAuditPanelDescriptionTextClassName(compact);
  const refreshActionSize = getCapabilityAuditPanelActionSize(compact);
  const diagnosticLinkCopyLabel = getCapabilityAuditPanelDiagnosticLinkCopyLabel(diagnosticLinkCopied);
  const activeFilterLabel = getCapabilityAuditPanelActiveFilterLabel(activeFilterSummary.activeLabels);
  const statusOptionNodes = getCapabilityAuditPanelOptionNodes({
    options: capabilityAuditStatusOptions,
    fallbackLabel: '全部状态',
  });
  const profileOptionNodes = getCapabilityAuditPanelOptionNodes({
    options: profileOptions,
    fallbackLabel: '全部 Profile',
  });
  const reasonOptionNodes = getCapabilityAuditPanelOptionNodes({
    options: reasonOptions,
    fallbackLabel: '全部 Reason',
  });
  const recordNodes = getCapabilityAuditPanelRecordNodes(visibleRecords);
  const latestRecordStatus = getCapabilityAuditPanelLatestRecordStatus(diagnosticsSummary.latestRecord);
  const latestRecordReason = getCapabilityAuditPanelLatestRecordReason(diagnosticsSummary.latestRecord);
  const latestRecordCreatedAt = getCapabilityAuditPanelLatestRecordCreatedAt(diagnosticsSummary.latestRecord);
  const latestRecordSourceNote = getCapabilityAuditPanelLatestRecordSourceNote(diagnosticsSummary.latestRecord);
  const profileDistributionLabel = getCapabilityAuditPanelDistributionLabel(diagnosticsSummary.capabilityProfiles);
  const reasonDistributionLabel = getCapabilityAuditPanelDistributionLabel(diagnosticsSummary.reasonCodes);
  const shouldRenderDiagnosticLinkCopyError = shouldRenderCapabilityAuditPanelDiagnosticMessage(diagnosticLinkCopyError);
  const shouldRenderDiagnosticUrlSyncError = shouldRenderCapabilityAuditPanelDiagnosticMessage(diagnosticUrlSyncError);
  const shouldRenderRuntimeContext = shouldRenderCapabilityAuditPanelRuntimeContext(runtimeDiagnosticContext);
  const shouldRenderLoadingState = shouldRenderCapabilityAuditPanelLoadingState(loadState);
  const shouldRenderErrorState = shouldRenderCapabilityAuditPanelErrorState(loadState);
  const shouldRenderEmptyState = shouldRenderCapabilityAuditPanelEmptyState({
    loadState,
    visibleRecords,
  });
  const shouldRenderRecordList = shouldRenderCapabilityAuditPanelRecordList(visibleRecords);
  const shouldRenderLatestRecord = shouldRenderCapabilityAuditPanelLatestRecord(diagnosticsSummary.latestRecord);
  const shouldRenderProfileDistribution = shouldRenderCapabilityAuditPanelDistribution(diagnosticsSummary.capabilityProfiles);
  const shouldRenderReasonDistribution = shouldRenderCapabilityAuditPanelDistribution(diagnosticsSummary.reasonCodes);

  return (
    <div className={cn('h-full overflow-auto', rootPaddingClassName)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className={cn('font-semibold', titleTextClassName)}>Capability 审计</h3>
          </div>
          <p className={cn('mt-1 text-muted-foreground', descriptionTextClassName)}>
            按项目隔离展示最近能力门禁、执行与阻断记录。
          </p>
        </div>
        <Button
          variant="outline"
          size={refreshActionSize}
          disabled={canRefreshCapabilityAudit === false}
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      <div
        role="status"
        aria-live="polite"
        data-testid="workspace-capability-audit-panel-snapshot"
        className={cn('mb-4 rounded-lg border px-3 py-2 text-xs', getCapabilityAuditPanelSnapshotClassName(panelSnapshot))}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{formatCapabilityAuditPanelSnapshotTitle(panelSnapshot)}</span>
          <span>Phase: {panelSnapshot.status}</span>
          <span>Source: {panelSnapshot.source}</span>
          <span>Updated: {panelSnapshot.updatedAt}</span>
        </div>
        <p className="mt-1">{panelSnapshot.message}</p>
        <p className="mt-1 opacity-80">恢复建议：{panelSnapshot.recovery}</p>
      </div>

      {hasCapabilityAuditProjectId === false && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          当前还没有绑定项目，暂无能力执行审计。
        </div>
      )}

      {hasCapabilityAuditProjectId === true && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">总记录</div>
              <div className="mt-1 text-lg font-semibold">{diagnosticsSummary.totalRecordCount}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">已执行</div>
              <div className="mt-1 text-lg font-semibold">{diagnosticsSummary.executedCount}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">已阻断</div>
              <div className="mt-1 text-lg font-semibold">{diagnosticsSummary.blockedCount}</div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">延后/跳过</div>
              <div className="mt-1 text-lg font-semibold">{diagnosticsSummary.deferredCount + diagnosticsSummary.skippedCount}</div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              状态筛选
              <select
                value={statusFilter}
                onChange={(event) => updateStatusFilter(event.target.value as CapabilityAuditStatusFilter)}
                className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {statusOptionNodes}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Profile 筛选
              <select
                value={profileFilter}
                onChange={(event) => updateProfileFilter(event.target.value)}
                className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {profileOptionNodes}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Reason 筛选
              <select
                value={reasonFilter}
                onChange={(event) => updateReasonFilter(event.target.value)}
                className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {reasonOptionNodes}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={canClearFilters === false}
              onClick={clearFilters}
            >
              清除筛选
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCurrentDiagnosticLink}
            >
              {diagnosticLinkCopyLabel}
            </Button>
            <span className="text-xs text-muted-foreground">
              当前筛选：{activeFilterLabel}；{activeFilterSummary.matchSummary}；{activeFilterSummary.sourceSummary}
            </span>
            {shouldRenderDiagnosticLinkCopyError === true && (
              <span role="status" className="text-xs text-destructive">
                {diagnosticLinkCopyError}
              </span>
            )}
            {shouldRenderDiagnosticUrlSyncError === true && (
              <span role="status" className="text-xs text-destructive">
                {diagnosticUrlSyncError}
              </span>
            )}
          </div>
          {shouldRenderRuntimeContext === true && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-medium">Runtime 来源：</span>
              {activeFilterSummary.runtimeSourceLabels.join(' / ')}
              <span className="ml-2 opacity-80">
                该上下文来自 Workspace Preview runtime 阻断入口，仅用于保留诊断来源，不会改变 Capability Audit 查询条件。
              </span>
              <span className="ml-2 opacity-70">
                参数：{RUNTIME_HEALTH_PROJECT_QUERY_PARAM} / {RUNTIME_HEALTH_REASON_QUERY_PARAM}
              </span>
            </div>
          )}

          {shouldRenderLoadingState === true && (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">正在加载能力审计...</div>
          )}

          {shouldRenderErrorState === true && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                能力审计加载失败
              </div>
              <p>{error}</p>
            </div>
          )}

          {shouldRenderEmptyState === true && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {activeFilterSummary.activeFilterCount > 0
                ? '当前筛选条件下暂无能力执行审计，可清除筛选后查看最近记录。'
                : '暂无能力执行审计。触发一次 Plan 或 Implementation 后，这里会显示 capability:resolve 的落库结果。'}
            </div>
          )}

          {shouldRenderRecordList === true && (
            <div className="space-y-2">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                {shouldRenderLatestRecord === true ? (
                  <div className="space-y-1">
                    <div>
                      <span className="font-medium text-foreground">最近记录：</span>
                      <span className="text-muted-foreground">
                        {latestRecordStatus} / {latestRecordReason} / {latestRecordCreatedAt}
                      </span>
                    </div>
                    <div className="text-muted-foreground">{latestRecordSourceNote}</div>
                  </div>
                ) : null}
                {shouldRenderProfileDistribution === true ? (
                  <div className="mt-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Profile 分布：</span>
                    {profileDistributionLabel}
                  </div>
                ) : null}
                {shouldRenderReasonDistribution === true ? (
                  <div className="mt-1 text-muted-foreground">
                    <span className="font-medium text-foreground">Reason 分布：</span>
                    {reasonDistributionLabel}
                  </div>
                ) : null}
              </div>
              {recordNodes}
            </div>
          )}
        </>
      )}
    </div>
  );
}
