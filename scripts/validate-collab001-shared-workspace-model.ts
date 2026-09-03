import assert from 'node:assert/strict';
import fs from 'node:fs';

import { runSSEEventStream } from '../src/app/workspace/workspace-orchestration-shared';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function requireSnippets(path: string, snippets: string[]) {
  const source = read(path);
  for (const snippet of snippets) {
    assert.ok(source.includes(snippet), `${path} is missing COLLAB-001 contract: ${snippet}`);
  }
}

requireSnippets('backend/init.sql', [
  'CREATE TABLE IF NOT EXISTS public.project_collaboration_sessions',
  'CREATE TABLE IF NOT EXISTS public.project_collaboration_events',
  "'presence_expired'",
  'touch_project_collaboration_session',
  'leave_project_collaboration_session',
  'expire_project_collaboration_sessions',
  'Service role full access on project_collaboration_sessions',
  'Service role full access on project_collaboration_events',
]);
requireSnippets('backend/internal/service/project_collaboration_live.go', [
  'ProjectCollaborationSchemaVersion = "project_collaboration.v1"',
  'projectCollaborationPresenceTTL = 45 * time.Second',
  'Viewer role cannot publish write activity',
  'ExpireCollaborationSessions',
  'ListCollaborationEvents',
  'ResourceRevision',
]);
requireSnippets('backend/internal/service/project_file_service.go', [
  'ProjectFileRevisionConflictError',
  'ProjectFileContentRevision',
  'lockProjectMutation',
  'expectedRevision',
  'ProjectCollaborationEventFileSaved',
  'ProjectCollaborationEventTreeChanged',
]);
requireSnippets('backend/internal/repository/project_collaboration_repository.go', [
  'query.Omit("session_id")',
]);
requireSnippets('backend/internal/handler/project_collaboration_handler.go', [
  'generationEventCursor(ctx)',
  'collaboration_heartbeat',
  'time.After(time.Second)',
]);
requireSnippets('backend/cmd/server/main.go', [
  '/:id/collaboration/state',
  '/:id/collaboration/presence',
  '/:id/collaboration/events',
]);
assert.equal(
  read('backend/cmd/server/main.go').includes('project.POST("/:id/collaboration/events"'),
  false,
  'clients must not be able to forge workspace mutation audit events',
);
requireSnippets('src/app/workspace/workspace-collaboration-presence.tsx', [
  'workspace-collaboration-presence',
  'presence_expired',
  'collaboration-resource-changed',
  'collaboration-conflict',
  'collaboration-conflict-resolved',
]);
requireSnippets('src/app/workspace/use-workspace-resource-operations.ts', [
  'getWorkspaceFileContentRevision',
  'expectedRevision',
  'file_revision_conflict',
  'filesRef.current.get(resourcePath) !== savedFilesRef.current.get(resourcePath)',
]);
requireSnippets('backend/internal/service/project_collaboration_live_test.go', [
  'TestProjectCollaborationPresenceLifecycleAndReplay',
  'TestProjectCollaborationViewerCannotPublishWriteActivity',
  'TestProjectCollaborationExpiresStalePresenceWithReplayableAuditEvent',
]);
requireSnippets('backend/pkg/supabase/project_collaboration_repository_test.go', [
  'TestSupabaseProjectCollaborationTouchUsesAtomicRPC',
  'TestSupabaseProjectCollaborationLeaveUsesAtomicRPC',
  'TestSupabaseProjectCollaborationExpiryUsesAtomicRPC',
]);
requireSnippets('package.json', ['test:collab001-browser']);
requireSnippets('.github/workflows/ci.yml', ['pnpm test:collab001-browser']);

async function verifyCursorReplay() {
  const received: string[] = [];
  let cursor = '';
  const response = new Response(
    'id: 41\nevent: file_saved\ndata: {"sequence":41,"project_id":"project-1"}\n\n'
      + 'id: 42\nevent: tree_changed\ndata: {"sequence":42,"project_id":"project-1"}\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
  await runSSEEventStream({
    response,
    safeParseJSON: (raw, fallback) => {
      try {
        return JSON.parse(raw) as typeof fallback;
      } catch {
        return fallback;
      }
    },
    handlers: {
      file_saved: () => {
        received.push('file_saved');
      },
      tree_changed: () => {
        received.push('tree_changed');
      },
    },
    unreadableMessage: 'COLLAB-001 replay stream unreadable',
    onEventCursor: (value) => {
      cursor = value;
    },
  });
  assert.deepEqual(received, ['file_saved', 'tree_changed']);
  assert.equal(cursor, '42');
}

void verifyCursorReplay().then(() => {
  console.log('[YES] COLLAB-001 shared workspace model validation passed.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
