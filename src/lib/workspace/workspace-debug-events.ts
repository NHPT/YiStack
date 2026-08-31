import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';

export type WorkspaceDebugEventSeverity = 'info' | 'warning' | 'error';
export type WorkspaceDebugEventCategory = 'file_system' | 'runtime' | 'git' | 'capability' | 'workspace';

export type WorkspaceDebugEvent = {
  id: string;
  projectId: string | null;
  category: WorkspaceDebugEventCategory;
  severity: WorkspaceDebugEventSeverity;
  title: string;
  detail: string;
  source: string;
  path?: string;
  recovery?: string;
  createdAt: string;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
};

export type WorkspaceDebugEventInput = Omit<WorkspaceDebugEvent, 'id' | 'createdAt'>;

export const workspaceDebugEventsUpdatedEvent = 'yistack:workspace-debug-events-updated';

const workspaceDebugEventsStorageKey = 'yistack_workspace_debug_events';
const workspaceDebugEventsLimit = 50;

function hasWorkspaceDebugEventTextValue(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function isWorkspaceDebugEventSeverity(value: unknown): value is WorkspaceDebugEventSeverity {
  return value === 'info' || value === 'warning' || value === 'error';
}

function isWorkspaceDebugEventCategory(value: unknown): value is WorkspaceDebugEventCategory {
  return value === 'file_system'
    || value === 'runtime'
    || value === 'git'
    || value === 'capability'
    || value === 'workspace';
}

function readWorkspaceDebugEventString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (hasWorkspaceDebugEventTextValue(normalized) === false) {
    return undefined;
  }

  return normalized;
}

function readWorkspaceDebugEventRecord(value: unknown): WorkspaceDebugEvent | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readWorkspaceDebugEventString(record, 'id');
  const title = readWorkspaceDebugEventString(record, 'title');
  const detail = readWorkspaceDebugEventString(record, 'detail');
  const source = readWorkspaceDebugEventString(record, 'source');
  const createdAt = readWorkspaceDebugEventString(record, 'createdAt');
  const severityValue = record.severity;
  const categoryValue = record.category;
  if (
    id === undefined
    || title === undefined
    || detail === undefined
    || source === undefined
    || createdAt === undefined
    || isWorkspaceDebugEventSeverity(severityValue) === false
    || isWorkspaceDebugEventCategory(categoryValue) === false
  ) {
    return null;
  }

  const projectId = readWorkspaceDebugEventString(record, 'projectId') ?? null;
  const path = readWorkspaceDebugEventString(record, 'path');
  const recovery = readWorkspaceDebugEventString(record, 'recovery');
  const engineeringState = record.engineeringState as WorkspaceEngineeringStateSnapshot | undefined;

  return {
    id,
    projectId,
    category: categoryValue,
    severity: severityValue,
    title,
    detail,
    source,
    path,
    recovery,
    createdAt,
    engineeringState,
  };
}

function readWorkspaceDebugEventList(): WorkspaceDebugEvent[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.sessionStorage.getItem(workspaceDebugEventsStorageKey);
  if (raw === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) === false) {
      return [];
    }

    const events: WorkspaceDebugEvent[] = [];
    for (const item of parsed) {
      const event = readWorkspaceDebugEventRecord(item);
      if (event !== null) {
        events.push(event);
      }
    }
    return events;
  } catch {
    return [];
  }
}

function writeWorkspaceDebugEventList(events: WorkspaceDebugEvent[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(workspaceDebugEventsStorageKey, JSON.stringify(events));
  window.dispatchEvent(new Event(workspaceDebugEventsUpdatedEvent));
}

export function readWorkspaceDebugEvents(projectId: string | null): WorkspaceDebugEvent[] {
  const events = readWorkspaceDebugEventList();
  if (projectId === null) {
    return events;
  }

  const scopedEvents: WorkspaceDebugEvent[] = [];
  for (const event of events) {
    const isCurrentProjectEvent = event.projectId === projectId;
    if (isCurrentProjectEvent === true) {
      scopedEvents.push(event);
    }
  }

  return scopedEvents;
}

export function appendWorkspaceDebugEvent(input: WorkspaceDebugEventInput): void {
  if (typeof window === 'undefined') {
    return;
  }

  const createdAt = new Date().toISOString();
  const event: WorkspaceDebugEvent = {
    ...input,
    id: `workspace-debug-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
  };
  const events = readWorkspaceDebugEventList();
  const nextEvents = [event, ...events].slice(0, workspaceDebugEventsLimit);
  writeWorkspaceDebugEventList(nextEvents);
}
