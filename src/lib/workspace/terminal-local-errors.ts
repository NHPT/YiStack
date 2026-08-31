import { formatUserVisibleApiError } from '@/lib/api-error-display';

export type TerminalWebSocketLocalMessage = string;
export type TerminalWebSocketLocalDetails = string;
export type TerminalWebSocketStructuredError = {
  source?: unknown;
};

function readTerminalWebSocketStructuredError(error: unknown): TerminalWebSocketStructuredError | null {
  const hasErrorObject = error !== null && typeof error === 'object';
  if (hasErrorObject === false) {
    return null;
  }

  const hasSourceField = 'source' in error;
  if (hasSourceField === false) {
    return null;
  }

  return error as TerminalWebSocketStructuredError;
}

function hasStructuredErrorSource(error: unknown): boolean {
  const structuredError = readTerminalWebSocketStructuredError(error);
  const hasStructuredError = structuredError !== null;
  if (hasStructuredError === false) {
    return false;
  }

  const hasSource = typeof structuredError.source === 'string';
  return hasSource === true;
}

export function formatTerminalWebSocketError(
  error: unknown,
  fallback: TerminalWebSocketLocalDetails,
) {
  if (hasStructuredErrorSource(error)) {
    return formatUserVisibleApiError(error, fallback);
  }

  const details = error instanceof Error ? error.message : fallback;
  return formatUserVisibleApiError({
    message: details,
    source: 'terminal_websocket',
    details,
  }, fallback);
}

export function formatTerminalWebSocketState(
  message: TerminalWebSocketLocalMessage,
  details: TerminalWebSocketLocalDetails,
) {
  return formatUserVisibleApiError({
    message,
    source: 'terminal_websocket',
    details,
  }, message);
}
