import type { WorkflowStep } from '@/components/workspace/chat-message-content';
import type { WorkspaceEngineeringStateSnapshot } from '@/lib/workspace/engineering-state';
import { buildSSEStreamUnreadableError } from '@/lib/workspace/workspace-stream-boundary-errors';

export type WorkspaceStreamEventData = {
  [fieldName: string]: unknown;
};

export type WorkspaceWorkflowStepEventData = WorkspaceStreamEventData;

export type WorkspaceParsedSSEEvent = {
  event: string;
  id?: string;
  data: WorkspaceStreamEventData;
};

export type SafeParseJSON = <T>(raw: string, fallback: T) => T;

export type WorkspaceStreamEventHandler = (data: WorkspaceStreamEventData) => void | Promise<void>;

export type WorkspaceStreamEventHandlerMap = {
  [eventName: string]: WorkspaceStreamEventHandler | undefined;
};

export type NormalizeWorkflowStep = (raw: WorkspaceWorkflowStepEventData | null | undefined) => WorkflowStep | null;
export type ResolveStepEngineeringState = (
  data: WorkspaceStreamEventData,
) => WorkspaceEngineeringStateSnapshot | undefined;

export type ResolvedWorkflowStepEvent = {
  step: WorkflowStep;
  engineeringState?: WorkspaceEngineeringStateSnapshot;
  statusLine: string;
  isFileOperation: boolean;
  isRunning: boolean;
  isFailed: boolean;
  shouldAppendStatusLine: boolean;
};

const WORKFLOW_FILE_OPERATION_KINDS = new Set([
  'read_file',
  'search_file',
  'create_file',
  'write_file',
  'delete_file',
  'rename_file',
  'create_directory',
  'delete_directory',
]);

function hasSSEBufferContent(buffer: string): boolean {
  const trimmedBuffer = buffer.trim();
  const hasBuffer = trimmedBuffer.length > 0;
  return hasBuffer === true;
}

function hasSSELastBufferEvent(event: string | undefined): event is string {
  const hasLastEvent = event !== undefined;
  return hasLastEvent === true;
}

function getSSEBufferRemainder(events: string[]): string {
  let lastEvent: string | undefined;

  for (const event of events) {
    lastEvent = event;
  }

  if (hasSSELastBufferEvent(lastEvent) === true) {
    return lastEvent;
  }

  return '';
}

function getSSECompletedBufferEvents(buffer: string): string[] {
  const hasBuffer = hasSSEBufferContent(buffer);
  if (hasBuffer === true) {
    return [buffer];
  }

  return [];
}

function hasSSEEventLine(line: string): boolean {
  const hasLine = line.length > 0;
  return hasLine === true;
}

function getSSEEventLines(rawEvent: string): string[] {
  const lines: string[] = [];
  for (const rawLine of rawEvent.split('\n')) {
    const line = rawLine.trim();
    const hasLine = hasSSEEventLine(line);
    if (hasLine === true) {
      lines.push(line);
    }
  }

  return lines;
}

function hasSSEEventField(value: string | undefined): value is string {
  if (value === undefined) {
    return false;
  }

  const hasValue = value.length > 0;
  return hasValue === true;
}

function hasSSEReader(
  reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
): reader is ReadableStreamDefaultReader<Uint8Array> {
  const hasReader = reader !== undefined;
  return hasReader === true;
}

function hasSSEStreamReadCompleted(done: boolean): boolean {
  const hasCompleted = done === true;
  return hasCompleted === true;
}

function hasWorkspaceParsedSSEEvent(
  parsedEvent: WorkspaceParsedSSEEvent | null,
): parsedEvent is WorkspaceParsedSSEEvent {
  return parsedEvent !== null;
}

function isSSEEventNameLine(line: string): boolean {
  return line.startsWith('event: ');
}

function isSSEEventIdLine(line: string): boolean {
  return line.startsWith('id: ');
}

function isSSEEventDataLine(line: string): boolean {
  return line.startsWith('data: ');
}

function getSSEEventIdValue(lines: string[]): string | undefined {
  for (const line of lines) {
    if (isSSEEventIdLine(line)) {
      return line.slice(4);
    }
  }
  return undefined;
}

function getSSEEventLineValue(lines: string[]): string | undefined {
  for (const line of lines) {
    const isEventLine = isSSEEventNameLine(line);
    if (isEventLine === true) {
      return line.slice(7);
    }
  }

  return undefined;
}

function getSSEDataLine(lines: string[]): string | undefined {
  for (const line of lines) {
    const isDataLine = isSSEEventDataLine(line);
    if (isDataLine === true) {
      return line;
    }
  }

  return undefined;
}

function hasSSEParsedData(data: unknown): data is WorkspaceStreamEventData {
  if (data === null) {
    return false;
  }

  const hasData = typeof data === 'object';
  return hasData === true;
}

function getWorkflowStepText(value: string | undefined): string {
  const hasValue = value !== undefined;
  if (hasValue === false) {
    return '';
  }

  return value;
}

function getWorkflowStepStatusLine(step: WorkflowStep): string {
  const detail = getWorkflowStepText(step.detail).trim();
  const hasDetail = detail.length > 0;
  if (hasDetail === true) {
    return detail;
  }

  return getWorkflowStepText(step.title).trim();
}

function shouldAppendWorkflowStepStatusLine({
  statusLine,
  isRunning,
  isFailed,
}: {
  statusLine: string;
  isRunning: boolean;
  isFailed: boolean;
}): boolean {
  const hasStatusLine = statusLine.length > 0;
  const isActiveStatus = isWorkflowStepActiveStatus({
    isRunning,
    isFailed,
  });
  return hasStatusLine === true && isActiveStatus === true;
}

function isWorkflowStepActiveStatus({
  isRunning,
  isFailed,
}: {
  isRunning: boolean;
  isFailed: boolean;
}): boolean {
  if (isRunning === true) {
    return true;
  }

  return isFailed === true;
}

export function consumeSSEBuffer(buffer: string, chunk: string, done: boolean) {
  const isDone = done === true;
  if (isDone === true) {
    return {
      events: getSSECompletedBufferEvents(buffer),
      nextBuffer: '',
    };
  }

  const nextBuffer = buffer + chunk;
  const events = nextBuffer.split('\n\n');
  return {
    events: events.slice(0, -1),
    nextBuffer: getSSEBufferRemainder(events),
  };
}

export function parseSSEEvent<T>(
  rawEvent: string,
  safeParseJSON: SafeParseJSON,
): WorkspaceParsedSSEEvent | null {
  const eventLines = getSSEEventLines(rawEvent);
  const event = getSSEEventLineValue(eventLines);
  const id = getSSEEventIdValue(eventLines);
  const dataLine = getSSEDataLine(eventLines);
  const hasEvent = hasSSEEventField(event);
  const hasDataLine = hasSSEEventField(dataLine);
  if (hasEvent === false) return null;
  if (hasDataLine === false) return null;

  const data = safeParseJSON<T | null>(dataLine.slice(6), null);
  const hasData = hasSSEParsedData(data);
  if (hasData === false) return null;

  return { event, id, data };
}

export function isWorkflowFileOperationKind(kind: string) {
  return WORKFLOW_FILE_OPERATION_KINDS.has(kind);
}

export function resolveWorkflowStepEvent(
  data: WorkspaceStreamEventData,
  normalizeWorkflowStep: NormalizeWorkflowStep,
  resolveStepEngineeringState?: ResolveStepEngineeringState,
): ResolvedWorkflowStepEvent | null {
  const step = normalizeWorkflowStep(data);
  const hasStep = step !== null;
  if (hasStep === false) return null;

  const statusLine = getWorkflowStepStatusLine(step);
  const isRunning = step.status === 'running';
  const isFailed = step.status === 'failed';

  return {
    step,
    engineeringState: resolveStepEngineeringState?.(data),
    statusLine,
    isFileOperation: isWorkflowFileOperationKind(step.kind),
    isRunning,
    isFailed,
    shouldAppendStatusLine: shouldAppendWorkflowStepStatusLine({
      statusLine,
      isRunning,
      isFailed,
    }),
  };
}

export async function runSSEEventStream({
  response,
  safeParseJSON,
  handlers,
  unreadableMessage,
  unreadableSource,
  onEventCursor,
}: {
  response: Response;
  safeParseJSON: SafeParseJSON;
  handlers: WorkspaceStreamEventHandlerMap;
  unreadableMessage: string;
  unreadableSource?: string;
  onEventCursor?: (cursor: string) => void;
}) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (hasSSEReader(reader) === false) {
    throw buildSSEStreamUnreadableError(unreadableMessage, unreadableSource);
  }

  let sseBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    const hasStreamReadCompleted = hasSSEStreamReadCompleted(done);
    const { events, nextBuffer } = consumeSSEBuffer(
      sseBuffer,
      decoder.decode(value, { stream: hasStreamReadCompleted === false }),
      hasStreamReadCompleted,
    );
    sseBuffer = nextBuffer;

    for (const rawEvent of events) {
      const parsedEvent = parseSSEEvent<WorkspaceStreamEventData>(rawEvent, safeParseJSON);
      if (hasWorkspaceParsedSSEEvent(parsedEvent) === false) continue;

      if (parsedEvent.id !== undefined) {
        onEventCursor?.(parsedEvent.id);
      }

      await handlers[parsedEvent.event]?.(parsedEvent.data);
    }

    if (hasStreamReadCompleted === true) {
      break;
    }
  }
}
