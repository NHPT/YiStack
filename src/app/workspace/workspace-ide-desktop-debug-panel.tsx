'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  readWorkspaceDebugEvents,
  workspaceDebugEventsUpdatedEvent,
} from '@/lib/workspace/workspace-debug-events';
import type { WorkspaceDebugEvent } from '@/lib/workspace/workspace-debug-events';
import { CapabilityAuditPanel } from './workspace-capability-audit-panel';
import { buildDebugPanelContextSnapshot } from './workspace-debug-panel-context-snapshot';
import type { DebugPanelContextSnapshot } from './workspace-types';

type DesktopDebugPanelProps = {
  projectId: string | null;
};

type WorkspaceDebugPanelProps = {
  projectId: string | null;
  compact?: boolean;
};

function getDebugPanelContextSnapshotClassName(snapshot: DebugPanelContextSnapshot) {
  if (snapshot.status === 'idle_without_project') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (snapshot.status === 'manual_debug') {
    return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

function getDebugPanelUrlParamsLabel(urlParams: string[]): string {
  const hasUrlParams = urlParams.length > 0;
  if (hasUrlParams === true) {
    return urlParams.join(' / ');
  }

  return '无诊断定位参数';
}

function getDebugEventClassName(event: WorkspaceDebugEvent): string {
  if (event.severity === 'error') {
    return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300';
  }
  if (event.severity === 'warning') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300';
}

function getDebugEventOptionalLabel(value: string | undefined): string {
  if (value === undefined) {
    return 'none';
  }

  return value;
}

function materializeWorkspaceDebugEventNodes(events: WorkspaceDebugEvent[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (const event of events) {
    nodes.push(
      <div
        key={event.id}
        className={cn('rounded-lg border px-3 py-2', getDebugEventClassName(event))}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{event.title}</span>
          <span>Severity: {event.severity}</span>
          <span>Category: {event.category}</span>
          <span>Source: {event.source}</span>
          <span>Time: {event.createdAt}</span>
        </div>
        <p className="mt-1 break-words">{event.detail}</p>
        <p className="mt-1 opacity-80">Path: {getDebugEventOptionalLabel(event.path)}</p>
        <p className="mt-1 opacity-80">Recovery: {getDebugEventOptionalLabel(event.recovery)}</p>
      </div>,
    );
  }

  return nodes;
}

export function WorkspaceDebugPanel({ projectId, compact = false }: WorkspaceDebugPanelProps) {
  const [locationSearch, setLocationSearch] = useState('');
  const [contextUpdatedAt, setContextUpdatedAt] = useState('pending');
  const [debugEvents, setDebugEvents] = useState<WorkspaceDebugEvent[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncLocationSearch = () => {
      setLocationSearch(window.location.search);
      setContextUpdatedAt(new Date().toISOString());
    };
    syncLocationSearch();
    window.addEventListener('popstate', syncLocationSearch);
    window.addEventListener('yistack:debug-context-updated', syncLocationSearch);
    return () => {
      window.removeEventListener('popstate', syncLocationSearch);
      window.removeEventListener('yistack:debug-context-updated', syncLocationSearch);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncDebugEvents = () => {
      setDebugEvents(readWorkspaceDebugEvents(projectId));
    };
    syncDebugEvents();
    window.addEventListener(workspaceDebugEventsUpdatedEvent, syncDebugEvents);
    return () => window.removeEventListener(workspaceDebugEventsUpdatedEvent, syncDebugEvents);
  }, [projectId]);

  const contextSnapshot = useMemo(
    () => buildDebugPanelContextSnapshot(projectId, locationSearch, contextUpdatedAt),
    [contextUpdatedAt, locationSearch, projectId],
  );

  return (
    <div className="h-full overflow-auto">
      <div
        role="status"
        aria-live="polite"
        data-testid="workspace-debug-panel-context-snapshot"
        className={cn('m-3 rounded-lg border px-3 py-2 text-xs', getDebugPanelContextSnapshotClassName(contextSnapshot))}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">Debug 诊断上下文</span>
          <span>Phase: {contextSnapshot.status}</span>
          <span>Source: {contextSnapshot.source}</span>
          <span>Updated: {contextSnapshot.updatedAt}</span>
        </div>
        <p className="mt-1">{contextSnapshot.message}</p>
        <p className="mt-1 opacity-80">恢复建议：{contextSnapshot.recovery}</p>
        <p className="mt-1 opacity-70">URL 参数：{getDebugPanelUrlParamsLabel(contextSnapshot.urlParams)}</p>
      </div>
      <div className="m-3 rounded-lg border border-border/80 bg-background/70 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">Workspace 诊断事件</span>
          <span>Count: {debugEvents.length}</span>
        </div>
        <div className="mt-2 space-y-2">
          {debugEvents.length > 0 ? materializeWorkspaceDebugEventNodes(debugEvents) : (
            <p className="text-muted-foreground">暂无 Workspace 诊断事件。</p>
          )}
        </div>
      </div>
      <CapabilityAuditPanel projectId={projectId} compact={compact} />
    </div>
  );
}

export function DesktopDebugPanel({ projectId }: DesktopDebugPanelProps) {
  return <WorkspaceDebugPanel projectId={projectId} />;
}
