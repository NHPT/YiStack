package handler

import (
	"log"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/sse"

	"yistack/internal/service"
)

func prepareSSEWriter(ctx *app.RequestContext) *sse.Writer {
	ctx.Response.Header.Set("Content-Type", "text/event-stream; charset=utf-8")
	ctx.Response.Header.Set("Cache-Control", "no-cache, no-transform")
	ctx.Response.Header.Set("Connection", "keep-alive")
	ctx.Response.Header.Set("X-Accel-Buffering", "no")
	return sse.NewWriter(ctx)
}

func writeSSEJSONEvent(writer *sse.Writer, event service.StreamEventName, data service.StreamEventPayload) error {
	return writer.WriteEvent("", event, []byte(toJSON(data)))
}

func newSSEJSONEventHandler(writer *sse.Writer) service.StreamEventHandler {
	return func(event service.StreamEventName, data service.StreamEventPayload) error {
		return writeSSEJSONEvent(writer, event, data)
	}
}

func newLoggedSSEJSONEventHandler(writer *sse.Writer, logPrefix, projectID string) service.StreamEventHandler {
	return func(event service.StreamEventName, data service.StreamEventPayload) error {
		switch event {
		case service.StreamEventError, service.StreamEventDone:
			log.Printf("[%s] project=%s event=%s payload=%s", logPrefix, projectID, event, toJSON(data))
		case service.StreamEventStep:
			log.Printf("[%s] project=%s event=step payload=%s", logPrefix, projectID, toJSON(data))
		}
		return writeSSEJSONEvent(writer, event, data)
	}
}
