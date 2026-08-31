import { runSSEEventStream } from './workspace-orchestration-shared';
import type { WorkspaceStreamEventData } from './workspace-orchestration-shared';

export type WorkspaceGenerationJobReplayCallbacks = {
  onCursor: (cursor: number) => void;
  onEvent?: (event: string, data: WorkspaceStreamEventData) => void;
  onStage: (stage: string) => void;
  onTerminal: (status: 'succeeded' | 'failed') => void;
};

export type WorkspaceGenerationReplayDecisionInput = {
  generationActive: boolean;
  terminalReplayAllowed: boolean;
  lastEventSequence: number;
  cursor: number;
};

export function shouldReplayWorkspaceGenerationJob({
  generationActive,
  terminalReplayAllowed,
  lastEventSequence,
  cursor,
}: WorkspaceGenerationReplayDecisionInput): boolean {
  if (generationActive === true) {
    return true;
  }

  return terminalReplayAllowed === true
    && Number.isSafeInteger(lastEventSequence)
    && lastEventSequence > cursor;
}

function safeParseGenerationReplayJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readGenerationReplayText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function generationReplayStage(data: WorkspaceStreamEventData): string {
  const message = readGenerationReplayText(data.message);
  if (message) return message;
  const detail = readGenerationReplayText(data.detail);
  if (detail) return detail;
  return readGenerationReplayText(data.title);
}

export async function replayWorkspaceGenerationJob(
  response: Response,
  callbacks: WorkspaceGenerationJobReplayCallbacks,
) {
  await runSSEEventStream({
    response,
    safeParseJSON: safeParseGenerationReplayJSON,
    unreadableMessage: '无法读取持久生成事件流',
    unreadableSource: 'generation_job_event_replay',
    onEventCursor: (cursor) => {
      const parsed = Number.parseInt(cursor, 10);
      if (Number.isFinite(parsed) && parsed >= 0) callbacks.onCursor(parsed);
    },
    handlers: {
      start: (data) => {
        callbacks.onEvent?.('start', data);
        callbacks.onStage(generationReplayStage(data));
      },
      progress: (data) => {
        callbacks.onEvent?.('progress', data);
        callbacks.onStage(generationReplayStage(data));
      },
      step: (data) => {
        callbacks.onEvent?.('step', data);
        if (data.status === 'running') callbacks.onStage(generationReplayStage(data));
      },
      chunk: (data) => callbacks.onEvent?.('chunk', data),
      guidance: (data) => callbacks.onEvent?.('guidance', data),
      done: (data) => {
        callbacks.onEvent?.('done', data);
        callbacks.onTerminal('succeeded');
      },
      error: (data) => {
        callbacks.onEvent?.('error', data);
        callbacks.onTerminal('failed');
      },
    },
  });
}
