import assert from 'node:assert/strict';

import {
  replayWorkspaceGenerationJob,
  shouldReplayWorkspaceGenerationJob,
} from '../src/app/workspace/workspace-generation-job-replay';
import { parseSSEEvent } from '../src/app/workspace/workspace-orchestration-shared';

const encodeSSE = (id: number, event: string, data: Record<string, unknown>) => (
  `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`
);

const safeParseJSON = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

async function main() {
  const rawStream = [
    encodeSSE(1, 'progress', { message: '生成中' }),
    encodeSSE(2, 'step', { status: 'running', detail: '项目校验中' }),
    encodeSSE(3, 'done', { message: '完成' }),
  ].join('');
  const response = new Response(rawStream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
  const cursors: number[] = [];
  const events: string[] = [];
  const stages: string[] = [];
  const terminals: string[] = [];
  await replayWorkspaceGenerationJob(response, {
    onEvent: (event) => events.push(event),
    onCursor: (cursor) => cursors.push(cursor),
    onStage: (stage) => stages.push(stage),
    onTerminal: (status) => terminals.push(status),
  });

  assert.deepEqual(cursors, [1, 2, 3]);
  assert.deepEqual(events, ['progress', 'step', 'done']);
  assert.deepEqual(stages, ['生成中', '项目校验中']);
  assert.deepEqual(terminals, ['succeeded']);

  const parsed = parseSSEEvent<Record<string, unknown>>(
    encodeSSE(12, 'progress', { message: 'resume' }).trim(),
    safeParseJSON,
  );
  assert.equal(parsed?.id, '12');
  assert.equal(parsed?.event, 'progress');
  assert.equal(parsed?.data.message, 'resume');

  assert.equal(shouldReplayWorkspaceGenerationJob({
    generationActive: true,
    terminalReplayAllowed: false,
    lastEventSequence: 0,
    cursor: 0,
  }), true);
  assert.equal(shouldReplayWorkspaceGenerationJob({
    generationActive: false,
    terminalReplayAllowed: true,
    lastEventSequence: 4,
    cursor: 0,
  }), true);
  assert.equal(shouldReplayWorkspaceGenerationJob({
    generationActive: false,
    terminalReplayAllowed: true,
    lastEventSequence: 4,
    cursor: 4,
  }), false);
  assert.equal(shouldReplayWorkspaceGenerationJob({
    generationActive: false,
    terminalReplayAllowed: false,
    lastEventSequence: 4,
    cursor: 0,
  }), false);

  console.log('[YES] Generation Job SSE replay runtime model passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
