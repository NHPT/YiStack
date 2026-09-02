package service

import "unicode/utf8"

type StreamEventName = string
type StreamEventPayload = any
type StreamEventHandler func(StreamEventName, StreamEventPayload) error

const (
	StreamEventStart         StreamEventName = "start"
	StreamEventChunk         StreamEventName = "chunk"
	StreamEventPlan          StreamEventName = "plan"
	StreamEventProgress      StreamEventName = "progress"
	StreamEventVisualContext StreamEventName = "visual_context"
	StreamEventStep          StreamEventName = "step"
	StreamEventGuidance      StreamEventName = "guidance"
	StreamEventDone          StreamEventName = "done"
	StreamEventError         StreamEventName = "error"
)

// emitStreamEvent 统一包装流式事件发送，便于不同生成链路共享同一套事件协议。
func emitStreamEvent(handler StreamEventHandler, event StreamEventName, payload StreamEventPayload) error {
	if handler == nil {
		return nil
	}
	return handler(event, payload)
}

func emitWorkflowStep(handler StreamEventHandler, id, kind, title, detail, status string, meta map[string]any) error {
	if handler == nil {
		return nil
	}

	payload := map[string]any{
		"id":     id,
		"kind":   kind,
		"title":  title,
		"detail": detail,
		"status": status,
	}
	if len(meta) > 0 {
		payload["meta"] = meta
	}

	return emitStreamEvent(handler, StreamEventStep, payload)
}

// splitUTF8SafePrefix 按字节上限切分字符串，同时保证返回前缀始终是合法 UTF-8。
// 它用于流式输出中文，避免把一个汉字拆成半个字符导致前端乱码。
func splitUTF8SafePrefix(value string, byteLimit int) (string, string) {
	if byteLimit <= 0 || value == "" {
		return "", value
	}
	if byteLimit >= len(value) {
		return value, ""
	}

	safeLimit := byteLimit
	for safeLimit > 0 && !utf8.ValidString(value[:safeLimit]) {
		safeLimit--
	}
	if safeLimit <= 0 {
		return "", value
	}

	return value[:safeLimit], value[safeLimit:]
}
