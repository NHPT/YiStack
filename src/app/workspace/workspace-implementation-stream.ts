import { runSSEEventStream } from './workspace-orchestration-shared';
import {
  buildImplementationStreamError,
  handleImplementationChunkEvent,
  handleImplementationGuidanceEvent,
  handleImplementationProgressEvent,
  handleImplementationStartEvent,
  handleImplementationStepEvent,
} from './workspace-implementation-stream-events';
import { finalizeImplementationDoneEvent } from './workspace-implementation-stream-finalization';
import type {
  ImplementationStreamContext,
  ImplementationStreamExecutionState,
} from './workspace-implementation-stream-types';

export type {
  ImplementationStreamContext,
  ImplementationStreamContextInput,
  ImplementationStreamExecutionState,
  ImplementationStreamStatusState,
} from './workspace-implementation-stream-types';
export { handleImplementationStreamFailure } from './workspace-implementation-stream-finalization';

export type ImplementationStreamConsumeOptions = {
  onEventCursor?: (cursor: string) => void;
  onTerminal?: (status: "succeeded" | "failed") => void;
};

export async function consumeImplementationStream(
  response: Response,
  context: ImplementationStreamContext,
  state: ImplementationStreamExecutionState,
  options: ImplementationStreamConsumeOptions = {},
) {
  await runSSEEventStream({
    response,
    safeParseJSON: context.safeParseJSON,
    unreadableMessage: '无法读取响应流',
    unreadableSource: 'implementation_generation_stream_reader',
    onEventCursor: options.onEventCursor,
    handlers: {
      start: (data) => {
        const result = handleImplementationStartEvent(data, context, state.statusContent);
        state.statusContent = result.nextStatusContent;
      },
      step: async (data) => {
        const result = await handleImplementationStepEvent(data, context, state.statusContent);
        state.statusContent = result.nextStatusContent;
      },
      progress: (data) => {
        const result = handleImplementationProgressEvent(data, context, state.statusContent);
        state.statusContent = result.nextStatusContent;
      },
      chunk: (data) => {
        const result = handleImplementationChunkEvent(
          data,
          context,
          state.fullContent,
          state.reasoningContent,
        );
        state.fullContent = result.nextFullContent;
        state.reasoningContent = result.nextReasoningContent;
      },
      done: async (data) => {
        options.onTerminal?.("succeeded");
        await finalizeImplementationDoneEvent(data, context, state);
      },
      guidance: (data) => {
        handleImplementationGuidanceEvent(data, context);
      },
      error: (data) => {
        options.onTerminal?.("failed");
        const result = buildImplementationStreamError(data, context, state.statusContent);
        state.statusContent = result.nextStatusContent;
        throw result.error;
      },
    },
  });
}
