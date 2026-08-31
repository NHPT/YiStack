package handler

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/sse"

	"yistack/internal/model"
)

func generationEventCursor(ctx *app.RequestContext) int64 {
	if ctx == nil {
		return 0
	}
	values := []string{
		strings.TrimSpace(ctx.Query("cursor")),
		strings.TrimSpace(string(ctx.Request.Header.Peek("Last-Event-ID"))),
	}
	var cursor int64
	for _, value := range values {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err == nil && parsed > cursor {
			cursor = parsed
		}
	}
	return cursor
}

func generationSSEPayload(event model.GenerationEvent) []byte {
	payload := map[string]any{}
	if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
		payload = map[string]any{"payload": event.Payload}
	}
	payload["generation_job_id"] = event.JobID
	payload["generation_event_sequence"] = event.Sequence
	payload["generation_event_key"] = event.EventKey
	return []byte(toJSON(payload))
}

func writeGenerationSSEEvent(writer *sse.Writer, event model.GenerationEvent) error {
	return writer.WriteEvent(strconv.FormatInt(event.Sequence, 10), event.EventType, generationSSEPayload(event))
}
